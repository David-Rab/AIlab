// Safety research-line projects on the project mechanism (model v3 E1: design/MODEL-V3.md §11.7, §5.3; notes in
// design/notes/E1.md). Owner: WS2.
//
// A line project (a safety node with an agenda, or a line's follow-up) runs the capability lifecycle's stages:
//   1 ideation    the project's safety science teams find candidate approaches at (m_ideas × capacity ÷ SERIOUS_CAP)^λ ×
//                 taste per (SAF_STAGES.idea × T₁) months. Each candidate carries the team's belief about the chance of
//                 a working result: the line's posterior, updated by a reading of the hidden efficacy whose noise falls
//                 with taste. Scientists keep ideating while a test runs (pool ≤ SAF_POOL_MAX).
//   2 small       safety research engineers + experiment compute: work at the experiment CES X(c, ℓ) (the capability
//                 projects' function and parameters), c = the project's experiment FLOP per day ÷ its agenda's
//                 reference (computeRef × the leader's day-0 compute), ℓ = (m_exp × engineers ÷ SAF_RE_UNIT)^λ. A reading
//                 narrows the belief.
//   3 validation  the same CES: the approach is validated on the frontier model (in place of the scale test); a second
//                 reading narrows the belief.
//   4 result      findings.ts fireFinding draws the result's type from the line's hidden efficacy (working tool, weak,
//                 dead end, negative, discovery, false result) and moves the Beta posterior, as before E1.
// At reference inputs (serious science staffing, SAF_RE_UNIT engineers, the reference compute at the leader's day-0
// compute) every stage runs at rate 1, so the first result takes T₁ (research/14's pacing). The belief is a readout (the
// project card's "the team thinks …"); the result's type never reads it.
//
// Research engineers: investigations and patches first, then line experiments in priority order (SAF_RE_UNIT each, at
// most SAF_EXP_SHARE of the free engineers), the rest keeps tools validated (agendas.ts upkeep). Compute: the safety
// pool after monitors, safety agents and investigations is shared by the projects in experiments in proportion to
// engineers × their agenda's compute need. AI labour enters as the effective-labour multipliers m_ideas and m_exp from
// the SAF_IDEAS / SAF_EXP work types (lineLabour, model v3 E2) and as AI taste in ideation (safSciOn).
import {
  AGENDA_BY_ID, LINE_MULT_MAX, SAF_BELIEF, SAF_C0_H100E, SAF_EXP_SHARE, SAF_PICK_AT, SAF_POOL_MAX, SAF_RE_UNIT, SAF_STAGES, SERIOUS_CAP,
} from '../../../data/v2/agendas';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { RISK_KAPPA } from '../../../data/v2/research';
import { CAPACITY_UNIT, PROJECT_BY_ID, SPECIALTY_BONUS, isLineNode, type TreeNodeDef } from '../../../data/v2/tree';
import { QUALITY } from '../../../data/v2/teams';
import { hash32 } from '../core/rng';
import { safetyPoolClaims } from '../departments/agents';
import { handedLabour, qualityZ, resetSafetyLabour, safetyLabour, sdAIOf, shiftFit, teamTaste, type LabourOf } from '../departments/workfit';
import { Xces } from '../production/ces';
import { trainNow } from '../models/stacks';
import type { AgendaId, GameStateV2, SafCandidate, SafProjectState, TreeNodeState } from '../types';
import { aiShareOf } from './agents';
import { safetySandbag } from './covert';
import { trueEfficacy } from './common';
import { investigationFte, safetyReHeads } from './investigations';
import { patchFte } from './responses';
import { aarAuto, aarFindingOom } from './ideas';

const node = (id: string): TreeNodeDef | undefined => PROJECT_BY_ID[id];
const agendaOf = (n: TreeNodeDef) => n.agenda as AgendaId;

// ───────────────────────────── hidden readings (deterministic per world) ─────────────────────────────

const U = (s: GameStateV2, key: string) => (hash32(s.setup.seed, key) + 0.5) / 4294967297;
function Z(s: GameStateV2, key: string): number {
  return Math.sqrt(-2 * Math.log(U(s, `${key}:a`))) * Math.cos(2 * Math.PI * U(s, `${key}:b`));
}

// ───────────────────────────── state ─────────────────────────────

/** Total months of work (at rate 1) of the stages after ideation. */
const testMonths = (T1: number) => (SAF_STAGES.small + SAF_STAGES.val) * T1;

/** A fresh project state (ideation). */
export const freshSaf = (): SafProjectState => ({ stage: 'ideation', idea: 0, cands: [], next: 1 });

/** The project's lifecycle state (created on first use: ts.saf exists since schemaRev 21, below the save floor). */
export function safState(_s: GameStateV2, ts: TreeNodeState, _n: TreeNodeDef): SafProjectState {
  ts.saf ??= freshSaf();
  return ts.saf;
}

/** Progress readout of a project (0..1 of the stage chain, in reference-time shares). */
export function safProgress(st: SafProjectState | undefined): number {
  if (!st) return 0;
  const t = st.test;
  if (!t) return SAF_STAGES.idea * Math.min(1, st.cands.length >= SAF_PICK_AT ? 1 : st.idea);
  const f = t.workNeed > 0 ? Math.min(1, t.work / t.workNeed) : 1;
  return st.stage === 'small' ? SAF_STAGES.idea + SAF_STAGES.small * f : SAF_STAGES.idea + SAF_STAGES.small + SAF_STAGES.val * f;
}

// ───────────────────────────── beliefs ─────────────────────────────

const betaBand = (p: { a: number; b: number }) => {
  const n = p.a + p.b;
  return { mean: p.a / n, sd: Math.sqrt((p.a * p.b) / (n * n * (n + 1))) };
};
/** Precision-weighted update of a belief by a reading y with noise sd. */
function readInto(c: SafCandidate, y: number, sd: number) {
  const w1 = 1 / (c.sd * c.sd);
  const w2 = 1 / (sd * sd);
  c.mu = (c.mu * w1 + y * w2) / (w1 + w2);
  c.sd = Math.sqrt(1 / (w1 + w2));
}

/** A new candidate: the line's posterior, updated by the scientists' reading of the hidden efficacy (noise ÷ taste). */
export function newSafCandidate(s: GameStateV2, n: TreeNodeDef, st: SafProjectState, q: number): SafCandidate {
  const ag = agendaOf(n);
  const k = st.next++;
  const { mean, sd } = betaBand(s.player.safety.agendas[ag].posterior);
  const c: SafCandidate = { k, q, mu: mean, sd: Math.max(1e-3, sd) };
  const noise = SAF_BELIEF.idea / Math.max(0.2, q);
  readInto(c, trueEfficacy(s, ag) + noise * Z(s, `sb:${n.id}:${k}`), noise);
  return c;
}

/** An experiment stage's reading narrows the belief. */
function readStage(s: GameStateV2, n: TreeNodeDef, c: SafCandidate, stage: 'small' | 'validation') {
  const sd = stage === 'small' ? SAF_BELIEF.small : SAF_BELIEF.val;
  readInto(c, trueEfficacy(s, agendaOf(n)) + sd * Z(s, `${stage === 'small' ? 'ss' : 'sv'}:${n.id}:${c.k}`), sd);
}

// ───────────────────────────── inputs ─────────────────────────────

/** Science capacity and taste of the teams on a project. Taste: each team's E[max(human, AI)] on the AIFM taste
 *  distribution, as capability projects (models/research.ts sciOn), with the safety model's AI taste from its SAF_IDEAS
 *  fit and cover φ = Trusted to AI while the safety agents work on ideas (model v3 E2; departments/workfit.ts); on the
 *  benchmarked agendas F44 raises that fit (model v3 E14, safety/ideas.ts aarFindingOom). */
export function safSciOn(s: GameStateV2, id: string): { cap: number; q: number; heads: number } {
  const n = node(id);
  if (!n) return { cap: 0, q: 1, heads: 0 };
  const m2b = s.hidden.timeline.prod.m2b;
  const sl = safetyLabour(s);
  const dG = aarFindingOom(s, agendaOf(n));
  const sdAI = dG ? sdAIOf(s.hidden.timeline, sl.ideas.fit.fit + dG, 'SAF_IDEAS') : sl.sdAI;
  let cap = 0;
  let qw = 0;
  let heads = 0;
  for (const t of s.player.teams) {
    if (t.projectId !== id || t.role !== 'sci') continue;
    const c = (t.heads / CAPACITY_UNIT) * QUALITY[t.quality].out * (t.specialty === n.column ? SPECIALTY_BONUS : 1);
    cap += c;
    heads += t.heads;
    qw += c * teamTaste(qualityZ(t.quality), sdAI, sl.phi, m2b);
  }
  return { cap, q: cap > 0 ? qw / cap : 1, heads };
}

/** AI labour on a line's work (model v3 E2): the effective-labour multipliers m_ideas and m_exp that enter ideation
 *  (m_ideas × capacity) and ℓ (m_exp × engineers), and the share of the line's work AI does on its own (A = t × a ×
 *  Auto, stage-weighted; the weight of a FALSE result). Both come from the safety work types (departments/workfit.ts safetyLabour: SAF_IDEAS and
 *  SAF_EXP, coverage from the safety model's fit and horizon, AI FTE from the package's compute) through handedLabour,
 *  the capabilities CES with the Trusted-to-AI share. Per line: the agenda's automation factor (research/14 "Auto": AI
 *  speeds agendas whose outputs can be checked, Carlsmith 2025) is the share of the line's work inside the work type's
 *  coverage (a × Auto; Auto 1 = the work type, AG12's 0.2 barely automatable; P27's AAR harnesses close half the gap to
 *  1, safety/ideas.ts aarAuto, and add fit on SAF_*, workfit.ts safetyLabour; AG17's science teams add their harness's
 *  fit there too, model v3 E14), and F44 raises the safety model's fit on the benchmarked agendas' work (AG18 / AG03 /
 *  AG16: safety/ideas.ts aarFindingOom, E14). A sabotaging safety model sandbags a share of its own labour (model v3
 *  E7, safety/covert.ts safetySandbag): the lines slow. */
export function lineLabour(s: GameStateV2, ag: AgendaId, truth = true): { ideas: number; exp: number; aiShare: number } {
  const sl = safetyLabour(s);
  if (sl.t <= 0) return { ideas: 1, exp: 1, aiShare: 0 };
  const P = s.hidden.timeline.prod;
  const auto = aarAuto(s, AGENDA_BY_ID[ag].auto);
  // Model v3 E7: the share of their own work the safety agents sandbag (SAFSAB attempts containment does not stop) is lost;
  // SAFMECH: on the lines whose work would expose them (× the line's threat). Hidden: the readouts (`truth` false: ETAs,
  // cycle times, results per year) leave it out, so a sandbagged line runs slower than the lab expects (the symptom).
  const kept = truth ? 1 - safetySandbag(s, ag) : 1;
  const dG = aarFindingOom(s, ag);
  const one = (x: LabourOf) => {
    if (x.aiFte <= 0) return { m: 1, A: 0 };
    const f = shiftFit(s.hidden.timeline, x.wt, x.fit, dG);
    return handedLabour(P, f.a * auto, sl.t, x.H, x.AI * kept, f.assist);
  };
  const e = one(sl.exp);
  const i = one(sl.ideas);
  return { ideas: i.m, exp: e.m, aiShare: aiShareOf(i.A, e.A) };
}
/** The multipliers alone (E1's plug). */
export function lineLabourMult(s: GameStateV2, ag: AgendaId, truth = true): { ideas: number; exp: number } {
  const l = lineLabour(s, ag, truth);
  return { ideas: l.ideas, exp: l.exp };
}

/** Speed modifiers of a line's stages: siloing −5% per level and a custom-ASIC migration −15% (as all research) and a
 *  dead-end line at half speed. No agenda-specific factor: P27, F44 and AG17 act on the lines' AI labour (lineLabour;
 *  model v3 E13, E14). */
export function lineSpeed(s: GameStateV2, ag: AgendaId): number {
  const p = s.player;
  let v = 1 - 0.05 * p.security.siloing;
  if ((p.finance.ws3.asicMigrationUntil ?? -1) > s.time.day) v *= 0.85;
  if (p.safety.agendas[ag].status === 'deadEnd') v *= 0.5;
  return v;
}

/** Projects in an experiment stage (priority order), optionally counting `extra` as one (previews). */
function experimenting(s: GameStateV2, extra?: string): string[] {
  const out: string[] = [];
  for (const id of s.player.research.queue) {
    const n = node(id);
    if (!n || !isLineNode(n)) continue;
    const st = s.player.tree[id];
    if (id !== extra && !(st?.status === 'researching' && st.saf?.test)) continue;
    if (!s.player.teams.some((t) => t.projectId === id && t.role === 'sci')) continue;
    out.push(id);
  }
  if (extra && !out.includes(extra) && node(extra)) out.push(extra);
  return out;
}

/** Pool for research lines (H100e): the safety pool after monitors, investigations and the safety agents, each at its
 *  granted share (RD-B07 safetyPoolClaims: served in that order, so the claims never total more than the pool). */
export function linePoolH100e(s: GameStateV2): number {
  return s.player.computeOnline * s.player.split.safety * safetyPoolClaims(s).lines.granted;
}

/** Today's safety research-engineer and compute allocation. Heads are heads × quality. */
export interface SafAlloc {
  /** Engineers not on investigations or patches; on line experiments; left for tool upkeep. */
  free: number; exp: number; upkeep: number;
  /** Engineers and experiment FLOP per day per project in experiments. */
  re: Map<string, number>; flop: Map<string, number>;
  /** Line pool (H100e) and its share per agenda. */
  pool: number; share: Partial<Record<AgendaId, number>>;
}
/** Today's allocation is memoised per state and day (understanding and the readouts ask for it many times a tick); the
 *  research system and every player action recompute it (resetSafAllocation). Previews (extra) are never memoised. */
const allocMemo = new WeakMap<GameStateV2, { day: number; a: SafAlloc }>();
export const resetSafAllocation = (s: GameStateV2) => {
  allocMemo.delete(s);
  resetSafetyLabour(s); // the safety agents' labour reads the same inputs (teams, Trusted to AI, the package)
};
export function safAllocation(s: GameStateV2, extra?: string, extraCap?: number): SafAlloc {
  if (extra === undefined) {
    const hit = allocMemo.get(s);
    if (hit && hit.day === s.time.day) return hit.a;
  }
  const heads = safetyReHeads(s);
  const free = Math.max(0, heads - investigationFte(s) - patchFte(s));
  let left = SAF_EXP_SHARE * free;
  const ids = experimenting(s, extra);
  const re = new Map<string, number>();
  let w = 0;
  const wOf = new Map<string, number>();
  for (const id of ids) {
    // A project asks for engineers in proportion to its science staffing (a serious programme: SAF_RE_UNIT; at most the
    // old Major level), in priority order.
    const m = (id === extra && extraCap !== undefined ? extraCap : safSciOn(s, id).cap) / SERIOUS_CAP;
    const x = Math.min(SAF_RE_UNIT * Math.min(LINE_MULT_MAX, m), left);
    left -= x;
    re.set(id, x);
    const k = x * AGENDA_BY_ID[agendaOf(node(id) as TreeNodeDef)].computeRef;
    wOf.set(id, k);
    w += k;
  }
  let exp = 0;
  for (const x of re.values()) exp += x;
  const pool = linePoolH100e(s);
  const flopPerH = PHI_FLOP_PER_H100E_DAY * Math.pow(10, trainNow(s));
  const flop = new Map<string, number>();
  const share: Partial<Record<AgendaId, number>> = {};
  for (const id of ids) {
    const f = w > 0 ? (wOf.get(id) ?? 0) / w : 0;
    flop.set(id, pool * f * flopPerH);
    const ag = agendaOf(node(id) as TreeNodeDef);
    share[ag] = (share[ag] ?? 0) + f;
  }
  const a: SafAlloc = { free, exp, upkeep: Math.max(0, free - exp), re, flop, pool, share };
  if (extra === undefined) allocMemo.set(s, { day: s.time.day, a });
  return a;
}

/** Stage rates of a line project: candidates per day from ideation, experiment work per day (months at X = 1), and the
 *  experiment inputs in reference units (c, ℓ, X). `cap` overrides the science capacity (previews). */
export interface LineRates { idea: number; exp: number; c: number; l: number; X: number; re: number; flop: number; q: number; cap: number }
export function lineRates(s: GameStateV2, id: string, alloc: SafAlloc, cap?: number, truth = true): LineRates {
  const n = node(id);
  const zero = { idea: 0, exp: 0, c: 0, l: 0, X: 0, re: 0, flop: 0, q: 1, cap: 0 };
  if (!n || !isLineNode(n)) return zero;
  const ag = agendaOf(n);
  const def = AGENDA_BY_ID[ag];
  const P = s.hidden.timeline.prod;
  const sci = safSciOn(s, id);
  const capNow = cap ?? sci.cap;
  const m = lineLabourMult(s, ag, truth);
  const speed = lineSpeed(s, ag);
  const idea = capNow > 0 ? (Math.pow((m.ideas * capNow) / SERIOUS_CAP, P.lam) * sci.q * speed) / (SAF_STAGES.idea * def.T1 * 30) : 0;
  const re = alloc.re.get(id) ?? 0;
  const flop = alloc.flop.get(id) ?? 0;
  const c = flop / (def.computeRef * SAF_C0_H100E * PHI_FLOP_PER_H100E_DAY);
  const l = Math.pow(Math.max(1e-12, (m.exp * re) / SAF_RE_UNIT), P.lam);
  const X = re > 0 && flop > 0 ? Xces(P, Math.max(1e-12, c), l) : 0;
  return { idea, exp: (X * speed) / 30, c, l, X, re, flop, q: sci.q, cap: capNow };
}

// ───────────────────────────── one day ─────────────────────────────

/** One day of a line project. `onResult` resolves a finished validation (findings.ts) and returns true if the project
 *  keeps running (its node is not known yet). */
export function stepLineProject(s: GameStateV2, id: string, ts: TreeNodeState, alloc: SafAlloc, onResult: () => boolean): void {
  const n = node(id) as TreeNodeDef;
  const st = safState(s, ts, n);
  const r = lineRates(s, id, alloc);
  const T1 = AGENDA_BY_ID[agendaOf(n)].T1;
  const kappa = RISK_KAPPA[s.player.research.risk ?? 'balanced'];
  // 1 Ideation (while scientists are on it and the pool has room).
  if (r.idea > 0 && st.cands.length < SAF_POOL_MAX) {
    st.idea += r.idea;
    for (let g = 0; st.idea >= 1 && st.cands.length < SAF_POOL_MAX && g < 8; g++) {
      st.idea -= 1;
      st.cands.push(newSafCandidate(s, n, st, r.q));
    }
    st.idea = Math.min(st.idea, 1);
  }
  // 2–3 Experiments; work left over when a stage ends carries into the next the same day.
  let time = 1;
  for (let guard = 0; guard < 6 && time > 1e-9; guard++) {
    if (!st.test && st.cands.length >= SAF_PICK_AT) {
      let bi = 0;
      for (let i = 1; i < st.cands.length; i++) if (st.cands[i].mu + kappa * st.cands[i].sd > st.cands[bi].mu + kappa * st.cands[bi].sd + 1e-12) bi = i;
      const c = st.cands.splice(bi, 1)[0];
      st.test = { c, work: 0, workNeed: SAF_STAGES.small * T1 };
      st.stage = 'small';
    }
    const t = st.test;
    if (!t) {
      st.stage = 'ideation';
      break;
    }
    if (r.exp <= 0) break;
    const need = Math.max(0, t.workNeed - t.work);
    const dt = need / r.exp;
    const step = Math.min(time, dt);
    t.work = dt > time ? t.work + r.exp * time : t.workNeed;
    time -= step;
    if (t.work < t.workNeed - 1e-12) break;
    readStage(s, n, t.c, st.stage === 'small' ? 'small' : 'validation');
    if (st.stage === 'small') {
      st.stage = 'validation';
      st.test = { c: t.c, work: 0, workNeed: SAF_STAGES.val * T1 };
      continue;
    }
    delete st.test;
    st.stage = 'ideation';
    if (!onResult()) break;
  }
  ts.progress = safProgress(st);
}

// ───────────────────────────── readouts ─────────────────────────────

/** Days to a project's next result at today's inputs (Infinity if a stage has no input). `cap` previews another science
 *  capacity. A project not in experiments is priced at the engineers and compute it would get once it is. */
export function lineEtaDays(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n || !isLineNode(n)) return Infinity;
  const T1 = AGENDA_BY_ID[agendaOf(n)].T1;
  const ts = s.player.tree[id];
  const st = ts?.status === 'researching' ? ts.saf : undefined;
  const r = lineRates(s, id, safAllocation(s, id, cap), cap, false);
  if (st?.test) {
    const left = st.test.workNeed - st.test.work + (st.stage === 'small' ? SAF_STAGES.val * T1 : 0);
    return r.exp > 0 ? left / r.exp : Infinity;
  }
  const ideaDays = (st?.cands.length ?? 0) >= SAF_PICK_AT ? 0 : r.idea > 0 ? (1 - (st?.idea ?? 0)) / r.idea : Infinity;
  return ideaDays + (r.exp > 0 ? testMonths(T1) / r.exp : Infinity);
}

/** Days between results once a project's pipeline is full (scientists ideate while engineers test): the slower of a
 *  candidate's ideation and its two test stages. `cap` previews another science capacity. */
export function lineCycleDays(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n || !isLineNode(n)) return Infinity;
  const r = lineRates(s, id, safAllocation(s, id, cap), cap, false);
  const T1 = AGENDA_BY_ID[agendaOf(n)].T1;
  return Math.max(r.idea > 0 ? 1 / r.idea : Infinity, r.exp > 0 ? testMonths(T1) / r.exp : Infinity);
}

/** The line projects teams work on, with their science teams. */
export function lineProjectsOf(s: GameStateV2, ag: AgendaId): string[] {
  const out = new Set<string>();
  for (const t of s.player.teams) {
    const n = t.role === 'sci' && t.projectId ? node(t.projectId) : undefined;
    if (n && n.agenda === ag && isLineNode(n)) out.add(n.id);
  }
  return [...out];
}

