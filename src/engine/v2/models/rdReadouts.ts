// UB-2: R&D readouts the approved mockups need (design/ux/mockups/rd/DATA.md items marked NEW). Pure view functions:
// each reads beliefs, measurements and facts only (UI-IA §2 basis), never hidden truth; one function per readout, one
// home (UI-IA §2), units per VOCAB §1. Display thresholds are stated where used; no engine number depends on them.
import { DOMAIN_IDS, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { STACK_LABEL } from '../../../data/v2/research';
import { aiStaffSpeedPart, labSpeedRel } from '../production/production';
import { resultsPerYearAt } from '../safety/agendas';
import { sizeCertainty, type Certainty } from '../core/certainty';
import { skillMarks } from './capability';
import { internalVersion, measuredDomainOf, versionById } from './labs';
import { believedAdoptedSince, capPriorityList, stackViews, type CapProjectView } from './researchView';
import { believedSciOn, capEta } from './research';
import { runForecast, type LaunchRunParams } from './runs';
import type { DomainId, GameStateV2, ModelVersion, StackKey } from '../types';

const Z90 = 1.64;
const X = (oom: number) => Math.pow(10, oom);

// ───────────────────────────── L0 #6: Research speed ─────────────────────────────

/** Research speed with its history and AI staff's part. Home: L0 #6 (tooltip). Unit: × the leading lab in July 2025.
 *  Basis: B (labSpeedRel: believed throughput scaled to the observed one, RF-R4; the AI part from measured skills and
 *  believed parameters, production.ts aiStaffSpeedPart). History: the weekly series (s.series.speed / speedAI, from
 *  UB-2 on; empty on older saves); `trend90` = now ÷ the sample ~90 days ago (undefined without one). */
export interface ResearchSpeedReadout {
  now: number;
  /** × from AI staff (1 = none), its experiments and ideas parts, and the speed of the same lab without AI staff. */
  ai: number; aiExperiments: number; aiIdeas: number; withoutAI: number;
  history: { day: number; speed: number; ai?: number }[];
  trend90?: number;
}
export function researchSpeedReadout(s: GameStateV2): ResearchSpeedReadout {
  const now = labSpeedRel(s);
  const p = aiStaffSpeedPart(s);
  const S = s.series;
  const sp = S.speed ?? [];
  const ai = S.speedAI ?? [];
  const days = S.day.slice(S.day.length - sp.length);
  const history = sp.map((x, i) => ({ day: days[i], speed: x, ...(ai.length === sp.length ? { ai: ai[i] } : {}) }));
  const back = [...history].reverse().find((h) => h.day <= s.time.day - 90);
  return {
    now, ai: p.total, aiExperiments: p.experiments, aiIdeas: p.ideas, withoutAI: now / Math.max(1e-9, p.total), history,
    ...(back && back.speed > 0 ? { trend90: now / back.speed } : {}),
  };
}

// ───────────────────────────── RESEARCH › Know-how ─────────────────────────────

/** One know-how area as × vs July 2025 (the leading lab's July 2025 recipe = ×1). Home: RESEARCH › Know-how · L1 (growth
 *  L2). Unit: × the area's own quantity. Basis: Public F (the stack's start + public know-how), Yours B (+ Σ the adopted
 *  results' estimates, 90% range), Waiting B (stackViews gap), growth B (Σ estimates of the last 365 days). */
export interface KnowHowArea {
  key: StackKey; name: string;
  public: number; yours: number; yoursRange: [number, number];
  /** × waiting for the next model (pretraining recipe and the two post-training areas only), ideas, since (day). */
  waiting?: { x: number; range: [number, number]; ideas: number; since: number };
  /** × per year from your own results over the last 365 days, and the ideas counted. */
  perYear: number; perYearIdeas: number;
  certainty: Certainty;
}
export function knowHowAreas(s: GameStateV2): KnowHowArea[] {
  const y = believedAdoptedSince(s, s.time.day - 365);
  return stackViews(s).map((v) => {
    const sd = v.adoptedSd;
    const w = v.gap !== undefined && v.gapSince !== undefined
      ? { x: X(v.gap), range: [X(Math.max(0, v.gap - Z90 * (v.gapSd ?? 0))), X(v.gap + Z90 * (v.gapSd ?? 0))] as [number, number], ideas: v.gapN ?? 0, since: v.gapSince }
      : undefined;
    return {
      key: v.key, name: v.name, public: X(v.base), yours: X(v.now), yoursRange: [X(v.now - Z90 * sd), X(v.now + Z90 * sd)],
      ...(w ? { waiting: w } : {}), perYear: X(y[v.key].oom), perYearIdeas: y[v.key].n,
      certainty: sizeCertainty(v.adopted, v.adopted - Z90 * sd, v.adopted + Z90 * sd),
    };
  });
}

// ───────────────────────────── RESEARCH › Portfolio ─────────────────────────────

/** A capability programme's rate at its current staffing. Home: RESEARCH › Portfolio card · L1 (next result: tooltip).
 *  Unit: ≈ × per year on its know-how area. Basis: B (results per year = 365 ÷ the days one full result takes at today's
 *  teams and compute: capEta on the programme with no result under way, believed parameters scaled to the observed
 *  throughput; each result ≈ the believed size of the next, line.nextPrior). `soFar`: results so far ÷ days played. */
export interface ProgrammeRate {
  id: string; name: string; area?: string; stack?: StackKey;
  /** Days for one full result now, results per year now, × per year now. */
  cycleDays: number; perYear: number; xPerYear: number;
  /** The next result: × on the area (best guess) and its 90% range, with a certainty word. */
  next: { x: number; range: [number, number]; certainty: Certainty };
  /** Results per year so far (line.gen ÷ days played × 365) and the × per year at that pace. */
  soFar: { perYear: number; xPerYear: number };
}
export function programmeRates(s: GameStateV2, list: CapProjectView[] = capPriorityList(s).list): ProgrammeRate[] {
  const out: ProgrammeRate[] = [];
  for (const v of list) {
    if (v.kind !== 'line' || !v.line) continue;
    const ts = s.player.tree[v.id];
    const st = ts?.cap;
    // The same programme with no result under way (a view copy; the engine state is not touched).
    const fresh = st ? { ...s, player: { ...s.player, tree: { ...s.player.tree, [v.id]: { ...ts, cap: { ...st, cands: [], idea: 0, test: undefined, stage: 'ideation' as const } } } } } as GameStateV2 : s;
    const e = capEta(fresh, v.id, believedSciOn(s, v.id));
    const cycle = e.ideation + e.experiments;
    const perYear = Number.isFinite(cycle) && cycle > 0 ? 365 / cycle : 0;
    const r = v.line.nextPrior;
    const sdNext = v.belief?.sd ?? 0;
    const soFar = s.time.day > 0 ? (v.line.gen / s.time.day) * 365 : 0;
    out.push({
      id: v.id, name: v.name, ...(v.stack ? { area: STACK_LABEL[v.stack], stack: v.stack } : {}),
      cycleDays: cycle, perYear, xPerYear: X(r * perYear),
      next: { x: X(r), range: [X(r - Z90 * sdNext), X(r + Z90 * sdNext)], certainty: sizeCertainty(r, r - Z90 * sdNext, r + Z90 * sdNext) },
      soFar: { perYear: soFar, xPerYear: X(r * soFar) },
    });
  }
  return out;
}

/** What a capability programme or project gets and tests now. Home: RESEARCH › card drawer "Gets" · L2. Units: H100e
 *  and % of experiment compute; the idea under test as × on its area (range, certainty word). Basis: F (yesterday's
 *  experiment FLOP, research.last.flopProj; teams), B (the idea's estimate). */
export interface ProgrammeGets {
  id: string; h100e: number; shareOfExperiments: number;
  idea?: { x: number; range: [number, number]; certainty: Certainty; testedAtScale: boolean; atScale: 'grows' | 'holds' | 'shrinks' };
  waitingIdeas: number;
}
export function programmeGets(s: GameStateV2, list: CapProjectView[] = capPriorityList(s).list): ProgrammeGets[] {
  const total = list.reduce((a, v) => a + v.flopDay, 0);
  return list.map((v) => {
    const b = v.belief;
    const lo = b ? b.mu - Z90 * b.sd : 0;
    const hi = b ? b.mu + Z90 * b.sd : 0;
    // At scale: the believed scale exponent's sign, with a ±0.05 dead band (display threshold).
    const atScale = b ? (b.sMu > 0.05 ? 'grows' : b.sMu < -0.05 ? 'shrinks' : 'holds') : 'holds';
    return {
      id: v.id, h100e: v.flopDay / PHI_FLOP_PER_H100E_DAY, shareOfExperiments: total > 0 ? v.flopDay / total : 0,
      ...(b ? { idea: { x: X(b.mu), range: [X(lo), X(hi)] as [number, number], certainty: sizeCertainty(b.mu, lo, hi), testedAtScale: b.tested, atScale } } : {}),
      waitingIdeas: v.cands,
    };
  });
}

// ───────────────────────────── LAB › Best moves ─────────────────────────────

/** UB-2 common value for Best moves: **days of progress a year**. A move that raises its target's rate by a share f
 *  of today's rate gives f × 365 more days of today's progress each year (research speed +66% → +241 days of research a
 *  year; a safety team +0.54 results / yr when the lab makes 3 → +66 days of safety research a year). One value across
 *  targets, so the list sorts across compute and hires. A target with no progress today (rate 0) has no value: those
 *  moves go last, flagged "starts it". Home: LAB › Best moves · L1. Basis: B (the moves' believed gains). */
export type MoveTarget = 'research' | 'safety';
export interface Move { id: string; target: MoveTarget; /** Change of the target's rate, in its unit (× research speed; results / yr). */ gain: number }
export interface RankedMove extends Move { rateNow: number; share: number; days?: number; startsIt: boolean }
/** Today's rate of a Best-moves target: research speed (× the leading lab in July 2025) or safety results per year. */
export const targetRate = (s: GameStateV2, t: MoveTarget): number => (t === 'research' ? labSpeedRel(s) : resultsPerYearAt(s));
export function rankMoves(s: GameStateV2, moves: Move[]): RankedMove[] {
  const rate: Partial<Record<MoveTarget, number>> = {};
  const out = moves.map((m) => {
    const r = (rate[m.target] ??= targetRate(s, m.target));
    const share = r > 0 ? m.gain / r : 0;
    return { ...m, rateNow: r, share, ...(r > 0 ? { days: share * 365 } : {}), startsIt: !(r > 0) && m.gain > 0 };
  });
  return out.sort((a, b) => (b.days ?? -Infinity) - (a.days ?? -Infinity) || Number(b.startsIt) - Number(a.startsIt));
}

// ───────────────────────────── TRAINING › Next run (ghost bars) ─────────────────────────────

/** A plan's skill gains per skill on the job scale (the skill bars' scale: skillMarks median expert / best human doing
 *  the job). Home: TRAINING › Next run prediction · L1 (ghosts), level changes in the tooltip (DQ-3). Unit: levels.
 *  Basis: today M (the reference model's measured skill, or a measured relative's: `measured` false), the plan B·fc
 *  (runForecast, UB-2b: believed recipe, measured start model, 90% range). One function for the next run, another
 *  start-from model or another post-training budget: pass the plan. */
export interface SkillGain {
  d: DomainId; now: number; next: [number, number]; mid: number; dLevels: number;
  median: number; best: number;
  /** Position on the bar: 0 = median expert, 1 = best human (job scale), today and planned. */
  posNow: number; posNext: number;
  measured: boolean;
}
export interface SkillGains { ref?: string; gains: SkillGain[]; reason?: string }
export function skillGains(s: GameStateV2, plan: LaunchRunParams, ref?: ModelVersion): SkillGains {
  let fc;
  try { fc = runForecast(s, plan, ref); } catch { return { gains: [], reason: 'No plan' }; }
  if (!fc) return { gains: [], reason: 'No model of yours is measured yet' };
  const rv = versionById(s, fc.refId) ?? internalVersion(s);
  const w = s.hidden.timeline; // public reference points only (skillMarks)
  const gains = DOMAIN_IDS.map((d) => {
    const m = skillMarks(w, d);
    const now = rv ? measuredDomainOf(s, rv, d) : 0;
    const next = fc.domains[d] ?? [now, now];
    const mid = (next[0] + next[1]) / 2;
    const pos = (L: number) => (L - m.median) / Math.max(1e-9, m.best - m.median);
    return { d, now, next, mid, dLevels: mid - now, median: m.median, best: m.best, posNow: pos(now), posNext: pos(mid), measured: !!rv?.evals.measuredDom?.[d] };
  });
  return { ref: fc.refName, gains };
}
