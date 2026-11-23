// UB-2: SAFETY and safety-programme readouts the approved mockups need (design/ux/mockups/rd/DATA.md items marked NEW).
// Pure view functions on beliefs, measurements and facts only (UI-IA §2 basis), never hidden truth; one function per
// readout, one home (UI-IA §2), units per VOCAB §1. Display thresholds are stated where used.
import { SAF_STAGES } from '../../../data/v2/agendas';
import { AGENT_USES } from '../../../data/v2/agents';
import { HUMAN_REVIEW_L } from '../../../data/v2/oversight';
import { PROJECT_BY_ID, isLineNode } from '../../../data/v2/tree';
import { chanceCertainty, isUnknown, type Certainty } from '../core/certainty';
import { agentVersion, internalFleets, monitorVersion, usesOf } from '../departments/agents';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { modelLossRisk, rowSev, runningModels, type LossRisk } from './lossRisk';
import { actTable } from './actTable';
import { internalVersion, measuredLOf, versionById } from '../models/labs';
import { believedEfficacy, clamp01 } from './common';
import { instrumentName, instrumentReads, instruments, reliability, reliabilityReasons, validatedLabel } from './instruments';
import { measuredOom, oversightGap } from './oversight';
import { plannedSightLimit, sightLimit } from './sightLimit';
import { lineRows } from './view';
import type { ActRow, ActTable } from './actTable';
import type { AgendaId, AgentUse, GameStateV2 } from '../types';

const Z90 = 1.64;

// ───────────────────────────── RESEARCH › Portfolio (safety column) ─────────────────────────────

/** The stage track of a safety programme: its project's progress split at the stage shares of its work (data
 *  SAF_STAGES: ideas 20%, small test 35%, validate 45%). The engine has no big-test stage for safety work, so the track is
 *  Ideas · Small test · Validate. */
export type SafStage = 'Ideas' | 'Small test' | 'Validate';
export function safStageOf(progress: number): { stage: SafStage; frac: number } {
  const a = SAF_STAGES.idea;
  const b = a + SAF_STAGES.small;
  const p = clamp01(progress);
  if (p < a) return { stage: 'Ideas', frac: p / a };
  if (p < b) return { stage: 'Small test', frac: (p - a) / SAF_STAGES.small };
  return { stage: 'Validate', frac: Math.min(1, (p - b) / SAF_STAGES.val) };
}

/** Safety programmes in priority order with their stage. Home: RESEARCH › Portfolio, Safety column · L1. Units: stage
 *  track, days, results / yr. Basis: F (order, teams, stage, compute share), B (outlook, next-result days). Order (UB-2
 *  proposal: idle safety programmes have no engine order): those on your research list in its order, then the other
 *  staffed ones, then the idle ones by outlook (best guess that the programme works, highest first). */
export interface SafetyProgramme {
  id: AgendaId; name: string; rank: number; why: 'your order' | 'staffed' | 'by outlook';
  staffed: boolean; teams: number; outlook: string; outlookMean: number;
  stage?: SafStage; stageFrac?: number; nextDays?: number; next?: string;
  computeShare: number; resultsPerYear: number;
}
export function safetyProgrammes(s: GameStateV2): SafetyProgramme[] {
  const rows = lineRows(s);
  const q = s.player.research.queue;
  const qPos = (id: AgendaId) => {
    const i = q.findIndex((x) => { const n = PROJECT_BY_ID[x]; return !!n && isLineNode(n) && n.agenda === id; });
    return i < 0 ? Infinity : i;
  };
  const items = rows.map((r) => {
    const p = r.projects[0];
    const st = p ? safStageOf(p.progress) : undefined;
    const pos = qPos(r.id);
    const why: SafetyProgramme['why'] = Number.isFinite(pos) && r.teams.length ? 'your order' : r.teams.length ? 'staffed' : 'by outlook';
    return {
      pos, item: {
        id: r.id, name: r.name, rank: 0, why, staffed: r.teams.length > 0, teams: r.teams.length, outlook: r.band.label, outlookMean: r.band.mean,
        ...(st ? { stage: st.stage, stageFrac: st.frac, nextDays: p!.eta } : {}),
        ...(r.next ? { next: PROJECT_BY_ID[r.next]?.name ?? r.next } : {}),
        computeShare: r.computeShare, resultsPerYear: r.resultsPerYear,
      } as SafetyProgramme,
    };
  });
  const tier = (x: SafetyProgramme) => (x.why === 'your order' ? 0 : x.why === 'staffed' ? 1 : 2);
  items.sort((a, b) => tier(a.item) - tier(b.item) || a.pos - b.pos || b.item.outlookMean - a.item.outlookMean);
  return items.map((x, i) => ({ ...x.item, rank: i + 1 }));
}

// ───────────────────────────── SAFETY › Instruments ─────────────────────────────

/** Each instrument's reliability on a model as % with a 90% range. Home: SAFETY › Instruments reliability grid · L1.
 *  Unit: % (low–high). Basis: M / B: the believed reliability at the model's measured capability (instruments.ts
 *  reliability, believed), averaged over the traits it reads; the range runs the programme's believed efficacy at the
 *  ends of its 90% range (Beta posterior, normal approximation). */
export interface InstrumentReading { id: string; name: string; reads: string[]; pct: number; lo: number; hi: number; certainty: Certainty; validatedOn: string; reasons: string[] }
export function instrumentReliability(s: GameStateV2, versionId?: string): { model?: string; rows: InstrumentReading[] } {
  const v = versionById(s, versionId) ?? internalVersion(s);
  if (!v) return { rows: [] };
  const x = measuredOom(s, v);
  const rows = instruments(s).map((t) => {
    const reads = instrumentReads(t);
    const p = s.player.safety.agendas[t.agenda]?.posterior;
    const be = believedEfficacy(s, t.agenda);
    const sd = p ? Math.sqrt((p.a * p.b) / ((p.a + p.b) ** 2 * (p.a + p.b + 1))) : 0;
    const at = (eff?: number) => {
      if (!reads.length) return reliability(s, t, { x, v, ...(eff !== undefined ? { eff } : {}) }, true).value;
      let sum = 0;
      for (const trait of reads) sum += reliability(s, t, { x, v, trait, ...(eff !== undefined ? { eff } : {}) }, true).value;
      return sum / reads.length;
    };
    const pct = at();
    const lo = Math.min(pct, at(clamp01(be - Z90 * sd)));
    const hi = Math.max(pct, at(clamp01(be + Z90 * sd)));
    return { id: t.id, name: instrumentName(t), reads, pct, lo, hi, certainty: chanceCertainty(lo, hi), validatedOn: validatedLabel(s, t), reasons: reliabilityReasons(s, t, v) };
  });
  return { model: v.name, rows };
}

/** The sight limit against a model, in levels short of / past it (VOCAB: "1.2 levels short of Atlas-4"). Home: SAFETY
 *  header · L1 (current); TRAINING › Prediction tick · L1 (planned, pass the planned run's predicted level). Unit:
 *  levels. Basis: B (believed sight limit) vs M (measured level) / B·fc (planned). */
export interface SightGap { levels: number; side: 'short' | 'past'; none: boolean; text: string }
export function sightGaps(s: GameStateV2, plannedL?: number, plannedName = 'the next run'): { current: SightGap; planned?: SightGap } {
  const sl = sightLimit(s);
  const v = internalVersion(s);
  const name = v?.name ?? 'your model';
  const gap = (g: number, who: string, none: boolean): SightGap => {
    const levels = Math.round(Math.abs(g) * 10) / 10;
    const side = g < 0 ? 'short' : 'past';
    return { levels, side, none, text: none ? `Your instruments read no model for hidden goals` : `${levels} levels ${side === 'short' ? 'short of' : 'past'} ${who}` };
  };
  const out: { current: SightGap; planned?: SightGap } = { current: gap(sl.gap, name, sl.none) };
  if (plannedL !== undefined) out.planned = gap(plannedSightLimit(s, plannedL).gap, plannedName, sl.none);
  return out;
}

// ───────────────────────────── SAFETY › Risks ─────────────────────────────

/** An act row's player readouts. Home: SAFETY › Risks act table · L1. Units: Would try % (range), Able to bar,
 *  Chances / yr (per work item for the per-item acts), Stop rate %, Unstopped / yr. Basis: B · M · F · B · B.
 *  Chances / yr = κ × chances × 365 (per item: κ × chances), so Would try × Able to × Chances / yr = attempts / yr; the
 *  escape row (no κ) reads attempts ÷ (Would try × Able to). `unknown`: VOCAB's rule on the Would-try range.
 *  `ableToMeasured` false = the model has no measured skill of its own in the act's skill yet (show "not measured yet"). */
export interface ActReadout { id: string; name: string; group: string; per: ActRow['per']; chancesPerYear?: number; chancesUnit: '/ yr' | '/ item' | ''; wouldTry: number; wouldTryRange: [number, number]; unknown: boolean; certainty: Certainty; ableTo: number; ableToMeasured: boolean; stopRate: number; unstopped: number;
  /** UB-9: Unstopped's 90% range (unstoppedRange) and, on per-year rows, the expected severity word. */
  unstoppedRange: [number, number]; severity?: (typeof SEVERITY_WORDS)[number] }
export function chancesPerYear(r: ActRow): number | undefined {
  if (r.per === 'exposure') return undefined;
  if (r.kappa !== undefined) return r.kappa * r.chances * (r.per === 'year' ? 365 : 1);
  const wa = r.wouldTry * r.ableTo;
  return wa > 0 ? r.attempts / wa : undefined;
}
export function actReadouts(t: ActTable): ActReadout[] {
  const af = t.site.site.autonomy * t.site.site.afford;
  return t.rows.map((r) => {
    const c = chancesPerYear(r);
    return {
      id: String(r.id), name: r.name, group: r.group, per: r.per, ...(c !== undefined ? { chancesPerYear: c } : {}), chancesUnit: r.per === 'year' ? '/ yr' : r.per === 'item' ? '/ item' : '',
      wouldTry: r.wouldTry, wouldTryRange: [r.wouldTryLo, r.wouldTryHi], unknown: isUnknown(r.wouldTryLo, r.wouldTryHi), certainty: chanceCertainty(r.wouldTryLo, r.wouldTryHi),
      ableTo: r.ableTo, ableToMeasured: r.measured !== false, stopRate: r.stopRate, unstopped: r.unstopped,
      unstoppedRange: unstoppedRange(r), ...(r.per === 'year' ? { severity: severityWord(rowSev(r.id, r.ableTo, af)) } : {}),
    };
  });
}

// ───────────────────────────── SAFETY › Safeguards ─────────────────────────────

/** Human reviewer and watcher gaps per AI staff job, in levels. Home: SAFETY › Safeguards · L2 (watcher gap) and the
 *  human review line. Unit: levels (0 = no gap). Basis: M (measured levels; human reviewers at the best-human level,
 *  10). */
const USE_NAME: Record<AgentUse, string> = { eng: 'engineering', capRoutine: 'experiments', capFrontier: 'ideas', safety: 'safety' };
export interface OversightGapRow { use: AgentUse; job: string; model: string; measured: boolean; humanGap: number; watcher?: string; watcherGap?: number }
export function oversightGaps(s: GameStateV2): OversightGapRow[] {
  const w = s.hidden.timeline; // public level scale only
  const out: OversightGapRow[] = [];
  for (const use of AGENT_USES) {
    const v = agentVersion(s, use);
    if (!v) continue;
    const m = measuredLOf(s, v);
    const mon = monitorVersion(s, use);
    out.push({
      use, job: USE_NAME[use], model: v.name, measured: !m.evaluating, humanGap: oversightGap(w, m.L, HUMAN_REVIEW_L).levels,
      ...(mon ? { watcher: mon.name, watcherGap: oversightGap(w, m.L, measuredLOf(s, mon).L).levels } : {}),
    });
  }
  return out;
}


// ───────────────────────────── SAFETY header (UB-9) ─────────────────────────────

/** The SAFETY model picker: every model you run (lossRisk.ts runningModels) with its AI staff jobs, the products it
 *  serves, whether its evals are still running, and its Loss-of-control risk; riskiest first (the default pick). Home:
 *  SAFETY header picker · L1. Basis: F (jobs, products), B (risk). */
export interface SafetyModelOption { id: string; name: string; jobs: string[]; products: number; evaluating: boolean; risk: LossRisk }
export function safetyModels(s: GameStateV2): SafetyModelOption[] {
  return runningModels(s).map((v) => ({
    id: v.id, name: v.name, jobs: usesOf(s, v.id).model.map((u) => USE_NAME[u]),
    products: s.player.deployments.filter((d) => d.channel !== 'internal' && d.status !== 'withdrawn' && d.versionId === v.id).length,
    evaluating: measuredLOf(s, v).evaluating, risk: modelLossRisk(s, v),
  })).sort((a, b) => b.risk.p - a.risk.p);
}

/** The act table SAFETY › Risks shows for a model: its internal fleet (AI staff work) when it has one, else its first live
 *  product. Home: SAFETY › Risks · L1. Basis: B · M · F (actTable believed). */
export interface RiskTable { table: ActTable; where: 'staff' | 'product'; deploymentId: string; product?: string }
export function riskTableOf(s: GameStateV2, versionId: string | undefined): RiskTable | undefined {
  const v = versionById(s, versionId);
  if (!v) return undefined;
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');
  const fl = internalFleets(s).find((f) => f.v.id === v.id);
  if (d && fl) {
    const t = actTable(s, { deploymentId: d.id, versionId: v.id, usage: fl.usage }, true);
    if (t) return { table: t, where: 'staff', deploymentId: d.id };
  }
  const pd = s.player.deployments.find((x) => x.channel !== 'internal' && x.status !== 'withdrawn' && x.versionId === v.id);
  const t = pd ? actTable(s, { deploymentId: pd.id }, true) : undefined;
  return pd && t ? { table: t, where: 'product', deploymentId: pd.id, product: PRODUCT_DEFS[pd.channel]?.name ?? pd.channel } : undefined;
}

/** Severity words of the incident scale (VOCAB §2), 1..5. */
export const SEVERITY_WORDS = ['Minor', 'Serious', 'Severe', 'Critical', 'Catastrophic'] as const;
/** A per-year row's expected severity word: the incident severity rule's mean (lossRisk.ts rowSev), rounded. */
export const severityWord = (sev: number) => SEVERITY_WORDS[Math.max(0, Math.min(4, Math.round(sev) - 1))];

/** A row's Unstopped / yr range: Unstopped scales with Would try (attempts = Would try × Able to × Chances), so its 90%
 *  range is Unstopped × the Would-try range ÷ the best guess. */
export function unstoppedRange(r: ActRow): [number, number] {
  if (r.wouldTry <= 1e-9) return [0, r.unstopped];
  return [r.unstopped * (r.wouldTryLo / r.wouldTry), r.unstopped * (r.wouldTryHi / r.wouldTry)];
}

/** Unstopped harm / yr of one act table, by severity word: Σ of the per-year rows' Unstopped (the composite and per-item
 *  rows are left out, as in unstoppedHarmPerYear), each binned by its expected severity; with the 90% range (rows' ranges
 *  summed, the same Would-try uncertainty on every row). Home: SAFETY header tile · L1. Unit: acts / yr. Basis: B. */
export interface HarmBySeverity { acts: number; lo: number; hi: number; bins: { word: (typeof SEVERITY_WORDS)[number]; acts: number }[] }
export function unstoppedBySeverity(t: ActTable): HarmBySeverity {
  const af = t.site.site.autonomy * t.site.site.afford;
  const by = new Map<(typeof SEVERITY_WORDS)[number], number>();
  let acts = 0;
  let lo = 0;
  let hi = 0;
  for (const r of t.rows) {
    if (r.per !== 'year') continue;
    const [a, b] = unstoppedRange(r);
    acts += r.unstopped;
    lo += a;
    hi += b;
    const w = severityWord(rowSev(r.id, r.ableTo, af));
    by.set(w, (by.get(w) ?? 0) + r.unstopped);
  }
  return { acts, lo, hi, bins: SEVERITY_WORDS.filter((w) => by.has(w)).map((w) => ({ word: w, acts: by.get(w)! })) };
}
