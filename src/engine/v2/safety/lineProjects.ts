// Safety projects on the shared project stepper (RD-R02b, design/RD-AUDIT/SAFETY-REDESIGN.md §3.1). Owner: WS2.
//
// A safety project asks one question: does this node's technique / finding work? It runs as RD-R05's unlock projects do:
// one test (SafProjectState: work / workNeed = the agenda's T₁ months at reference inputs) that the science teams and the
// experiment CES work through together (models/research.ts stepProject, dept 'saf'), at
//   science      (m_ideas × capacity ÷ SERIOUS_CAP)^λ × taste × speed ÷ 30 per day, and
//   experiments  X(c, ℓ) × speed ÷ (30 X_ref) per day, in the capability units (RD-R02a): c = the project's experiment FLOP per
//                day ÷ (its agenda's computeNeed × C_UNIT_FLOP_PER_DAY), ℓ = (m_exp × engineers ÷ RE_LABOUR_UNIT)^λ, X_ref =
//                X(1, SAF_RE_ASK^λ);
// speed = the research modifiers every project has (departments/workfit.ts researchMods). Then the hidden works draw
// against the agenda's true efficacy decides: works → the node's own technique or finding (findings.ts nodeTestResult;
// SAFSAB can rig it into a FALSE result); doesn't → a dead end for this attempt (the posterior moves toward failure, the
// project retries at the posterior odds). A line's follow-up is its open study: its result is an event (fireFinding:
// discoveries, negatives, spillovers, tools no node owns). No candidates, no beliefs.
//
// Research engineers (RD-A04, SR-21): one needs list in the player's order (research.safRe, set in LAB; models/research.ts
// allocate, the capability engineers' allocator): human review, open cases, validation jobs, eval suites, environment fixes,
// foothold removals, line experiments (each project in priority order asks SAF_RE_ASK labour units × its science
// staffing); the rest is idle. safetySpend sums the filled needs' staff and compute cost.
// Compute: the safety line after cases and eval suites (in the list's order) goes to validation and the projects in experiments by need (RD-R02a, the capability
// rule of RD-B08 expShares): each project's need is its ask × its agenda's computeNeed; a project with engineers takes
// its full share, one with none leaves its share unused (idle). AI labour enters as the effective-labour multipliers m_ideas and m_exp from
// the SAF_IDEAS / SAF_EXP work types (lineLabour, model v3 E2) and as AI taste in ideation (safSciOn).
import { AGENDA_BY_ID, LINE_MULT_MAX, SAF_RE_ASK, SERIOUS_CAP } from '../../../data/v2/agendas';
import { C_UNIT_FLOP_PER_DAY, RE_LABOUR_UNIT } from '../../../data/v2/workTypes';
import { TEAM_SIZE } from '../../../data/v2/teams';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { DEFAULT_SAF_RE_ALLOC, SAF_RE_NEEDS } from '../../../data/v2/research';
import { evalH100eAsk, evalM, evalReDemand } from '../models/evals';
import { removalFte } from './footholds';
import { allocate } from '../models/research';
import { jobComputeNeed, jobStaffing, liveJobs, validationDemand } from './validation';
import { PROJECT_BY_ID, isLineNode, type TreeNodeDef } from '../../../data/v2/tree';
import { teamCapacity } from '../departments/capacity';
import { handedLabour, onDuty, qualityZ, researchMods, resetSafetyLabour, safetyLabour, sdAIOf, shiftFit, teamTaste, type LabourOf } from '../departments/workfit';
import { Xces } from '../production/ces';
import { trainNow } from '../models/stacks';
import type { AgendaId, GameStateV2, SafReNeed, SafProjectState, TreeNodeState } from '../types';
import { aiShareOf } from './agents';
import { safetySandbag } from './covert';
import { investigationFte, safeguardFte, safetyReHeads } from './investigations';
import { envFixFte } from './responses';
import { aarAuto, aarFindingOom } from './ideas';

const node = (id: string): TreeNodeDef | undefined => PROJECT_BY_ID[id];

/** RD-R02a: safety research-engineer heads (× quality, the allocator's unit) in one experiment-labour unit
 *  (RE_LABOUR_UNIT team-equivalents of TEAM_SIZE.re heads; departments/capacity.ts reCapacity). */
const HEADS_PER_LABOUR_UNIT = RE_LABOUR_UNIT * TEAM_SIZE.re;
const agendaOf = (n: TreeNodeDef) => n.agenda as AgendaId;

// ───────────────────────────── state ─────────────────────────────

/** A fresh test of a safety project: the agenda's T₁ months of work at reference inputs. */
export const freshSaf = (n: TreeNodeDef): SafProjectState => ({ work: 0, workNeed: AGENDA_BY_ID[agendaOf(n)].T1, flop: 0 });

/** The project's test state (created on first use; a pre-RD-R02b shape is restated by the 60 → 61 migration). */
export function safState(_s: GameStateV2, ts: TreeNodeState, n: TreeNodeDef): SafProjectState {
  ts.saf ??= freshSaf(n);
  return ts.saf;
}

/** Progress readout of a project (0..1 of its test). */
export function safProgress(st: SafProjectState | undefined): number {
  return st && st.workNeed > 0 ? Math.min(1, st.work / st.workNeed) : 0;
}

// ───────────────────────────── inputs ─────────────────────────────

/** Science capacity and taste of the teams on a project. Taste: each team's E[max(human, AI)] on the AIFM taste
 *  distribution, as capability projects (models/research.ts sciOn), with the safety model's AI taste from its SAF_IDEAS
 *  fit, weighted by AI's share of the SAF_IDEAS labour (DD-13; departments/workfit.ts aiIdeasShare); on the
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
    const c = teamCapacity(onDuty(s, t), n.column);
    cap += c;
    heads += onDuty(s, t).heads;
    qw += c * teamTaste(qualityZ(t.quality), sdAI, sl.sAI, m2b);
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

/** Safety projects in their test (priority order), optionally counting `extra` as one (previews). */
function experimenting(s: GameStateV2, extra?: string): string[] {
  const out: string[] = [];
  for (const id of s.player.research.queue) {
    const n = node(id);
    if (!n || !isLineNode(n)) continue;
    const st = s.player.tree[id];
    if (id !== extra && st?.status !== 'researching') continue;
    if (!s.player.teams.some((t) => t.projectId === id && t.role === 'sci')) continue;
    out.push(id);
  }
  if (extra && !out.includes(extra) && node(extra)) out.push(extra);
  return out;
}

/** H100e left for validation jobs and line experiments (the safety line after cases and eval suites; a readout). */
export const linePoolH100e = (s: GameStateV2): number => safAllocation(s).pool;

/** SR-21: a safety need's compute (H100e): its ask and what the safety line gave it. */
export interface SafCompute { ask: number; got: number }
/** Open cases' compute shares of the safety line (the player's choice per case). */
const openCaseShare = (s: GameStateV2) => s.player.safety.investigations.filter((i) => !i.outcome).reduce((a, i) => a + i.computeShare, 0);
/** The safety compute line (H100e): split.safety of the online compute (RD-A05a's flat allocation). */
export const safetyLineH100e = (s: GameStateV2) => s.player.computeOnline * Math.max(0, s.player.split.safety);

/** Today's safety research-engineer and compute allocation (SR-21: LAB's one needs list). Heads are heads × quality. */
export interface SafAlloc {
  /** Engineers not on review, cases, fixes or removals; on line experiments; on validation jobs (SR-09; valPool = their
   *  H100e of the line); idle (no need takes them); on human review (the 'review' need, SR-21: in the list). */
  free: number; exp: number; validation: number; valPool: number; idle: number; safeguards: number;
  /** RD-A04 / SR-21: capacity (heads × quality), each need's demand and what it got (player's order). */
  heads: number; demand: Record<SafReNeed, number>; got: Record<SafReNeed, number>;
  /** SR-21: each need's compute on the safety line (H100e). Cases and evals ask a fixed amount, filled in the needs
   *  list's order; validation jobs and line experiments share what is left by need (RD-B08 rule). computeIdle = the
   *  line's H100e no need uses. caseScale = the cases' compute granted ÷ asked (1 when filled). */
  compute: Record<SafReNeed, SafCompute>; line: number; computeIdle: number; caseScale: number;
  /** Engineers and experiment FLOP per day per project in experiments. */
  re: Map<string, number>; flop: Map<string, number>;
  /** Pool left for validation and line experiments (H100e) and the line experiments' share of it per agenda. */
  pool: number; share: Partial<Record<AgendaId, number>>;
}
/** RD-A04: share of the open cases' engineers served today (1 with no case): a case below its staffing gains clarity at
 *  the engineers it gets. */
export function casesServed(s: GameStateV2): number {
  const a = safAllocation(s);
  return a.demand.cases > 1e-12 ? Math.min(1, a.got.cases / a.demand.cases) : 1;
}
/** SR-21: share of a need's staff served today (1 with no demand). */
export function needServed(s: GameStateV2, k: SafReNeed): number {
  const a = safAllocation(s);
  return a.demand[k] > 1e-12 ? Math.min(1, a.got[k] / a.demand[k]) : 1;
}
/** SR-21: the cases' compute granted ÷ asked with `extraShare` more asked (the Investigate preview): the line minus what
 *  the needs ahead of cases in the order (eval suites) took, over the cases' ask. */
export function caseComputeScale(s: GameStateV2, extraShare = 0): number {
  const a = safAllocation(s);
  const ask = a.line * (openCaseShare(s) + Math.max(0, extraShare));
  if (ask <= 1e-12) return 1;
  const order = (s.player.research.safRe ?? DEFAULT_SAF_RE_ALLOC).order;
  const ahead = order.indexOf('evals') >= 0 && order.indexOf('evals') < order.indexOf('cases') ? a.compute.evals.got : 0;
  return Math.min(1, Math.max(0, a.line - ahead) / ask);
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
  const ids = experimenting(s, extra);
  // A project asks for engineers in proportion to its science staffing (a serious programme: SAF_RE_ASK labour units; at
  // most the old Major level); the asks sum to the line experiments' demand and are served in priority order. Its
  // compute need is the ask × its agenda's computeNeed (capability C_UNITs).
  const ask = new Map<string, number>();
  const need = new Map<string, number>();
  let askSum = 0;
  let needSum = 0;
  for (const id of ids) {
    const m = (id === extra && extraCap !== undefined ? extraCap : safSciOn(s, id).cap) / SERIOUS_CAP;
    const units = SAF_RE_ASK * Math.min(LINE_MULT_MAX, m);
    const x = units * HEADS_PER_LABOUR_UNIT;
    const k = (units / SAF_RE_ASK) * AGENDA_BY_ID[agendaOf(node(id) as TreeNodeDef)].computeNeed;
    ask.set(id, x);
    need.set(id, k);
    askSum += x;
    needSum += k;
  }
  const mSaf = evalM(s);
  // SR-21: one needs list; human review (SR-13b's pre-commit) and eval suites (the capability engineers' 'evals' need)
  // are needs in it; eval staff are safety engineers (heads × quality = team-equivalents × TEAM_SIZE.re).
  const demand: Record<SafReNeed, number> = {
    review: safeguardFte(s), cases: investigationFte(s), validation: validationDemand(s), evals: evalReDemand(s, mSaf) * TEAM_SIZE.re,
    envFix: envFixFte(s), removal: removalFte(s), safExp: askSum,
  };
  const order = s.player.research.safRe ?? DEFAULT_SAF_RE_ALLOC;
  const got = allocate(heads, order, demand);
  const free = Math.max(0, heads - got.review - got.cases - got.envFix - got.removal);
  let left = got.safExp;
  const re = new Map<string, number>();
  for (const id of ids) {
    const x = Math.min(ask.get(id) ?? 0, left);
    left -= x;
    re.set(id, x);
  }
  let exp = 0;
  for (const x of re.values()) exp += x;
  // SR-21 compute: the safety line's sub-uses. Cases (their chosen shares of the line) and eval suites (H100e at the
  // engineers they got) ask fixed amounts, filled in the list's order; the rest goes to validation and line experiments.
  const line = safetyLineH100e(s);
  const compute = Object.fromEntries(SAF_RE_NEEDS.map((k) => [k, { ask: 0, got: 0 }])) as Record<SafReNeed, SafCompute>;
  compute.cases.ask = line * openCaseShare(s);
  compute.evals.ask = evalH100eAsk(s, mSaf, got.evals / TEAM_SIZE.re);
  let cLeft = line;
  for (const k of order.order) {
    const c = compute[k];
    if (!c || c.ask <= 0) continue;
    c.got = Math.min(cLeft, c.ask);
    cLeft -= c.got;
  }
  const pool = Math.max(0, cLeft);
  const flopPerH = PHI_FLOP_PER_H100E_DAY * Math.pow(10, trainNow(s));
  const flop = new Map<string, number>();
  const share: Partial<Record<AgendaId, number>> = {};
  // SR-09: staffed validation jobs take their compute need from the same pool, by need (the lines' shares shrink).
  let valNeed = 0;
  if (got.validation > 0) {
    const staffed = jobStaffing(s, got.validation);
    for (const j of liveJobs(s)) if ((staffed.get(j.id) ?? 0) > 0) valNeed += jobComputeNeed(s, j);
  }
  const den = needSum + valNeed;
  let expH = 0;
  for (const id of ids) {
    // By need (RD-B08 rule): a project with engineers takes its full share; one with none leaves it unused.
    const f = den > 0 && (re.get(id) ?? 0) > 0 ? (need.get(id) ?? 0) / den : 0;
    flop.set(id, pool * f * flopPerH);
    expH += pool * f;
    const ag = agendaOf(node(id) as TreeNodeDef);
    share[ag] = (share[ag] ?? 0) + f;
  }
  const valPool = den > 0 ? (pool * valNeed) / den : 0;
  compute.validation = { ask: valPool, got: valPool };
  compute.safExp = { ask: den > 0 ? (pool * needSum) / den : 0, got: expH };
  let cUsed = 0;
  for (const k of SAF_RE_NEEDS) cUsed += compute[k].got;
  let used = 0;
  for (const k of SAF_RE_NEEDS) used += got[k];
  const a: SafAlloc = {
    free, exp, validation: got.validation, valPool, idle: Math.max(0, heads - used), safeguards: got.review, heads, demand, got,
    compute, line, computeIdle: Math.max(0, line - cUsed), caseScale: compute.cases.ask > 1e-12 ? compute.cases.got / compute.cases.ask : 1,
    re, flop, pool, share,
  };
  if (extra === undefined) allocMemo.set(s, { day: s.time.day, a });
  return a;
}

/** Work rates of a safety project's test (months of work per day; each is 1/30 at reference inputs): the science teams'
 *  and the experiment CES's, and the experiment inputs in reference units (c, ℓ, X). `cap` overrides the science capacity
 *  (previews). */
export interface LineRates { sci: number; exp: number; c: number; l: number; X: number; re: number; flop: number; q: number; cap: number }
export function lineRates(s: GameStateV2, id: string, alloc: SafAlloc, cap?: number, truth = true): LineRates {
  const n = node(id);
  const zero = { sci: 0, exp: 0, c: 0, l: 0, X: 0, re: 0, flop: 0, q: 1, cap: 0 };
  if (!n || !isLineNode(n)) return zero;
  const ag = agendaOf(n);
  const def = AGENDA_BY_ID[ag];
  const P = s.hidden.timeline.prod;
  const sci = safSciOn(s, id);
  const capNow = cap ?? sci.cap;
  const m = lineLabourMult(s, ag, truth);
  const speed = researchMods(s).speed;
  const sciRate = capNow > 0 ? (Math.pow((m.ideas * capNow) / SERIOUS_CAP, P.lam) * sci.q * speed) / 30 : 0;
  const re = alloc.re.get(id) ?? 0;
  const flop = alloc.flop.get(id) ?? 0;
  // RD-R02a: shared units. c in the agenda's need of capability C_UNITs, ℓ in RE_LABOUR_UNITs; X ÷ X_ref keeps rate 1
  // (the first result at T₁) at reference inputs (c = 1, ℓ = SAF_RE_ASK^λ).
  const c = flop / (def.computeNeed * C_UNIT_FLOP_PER_DAY);
  const l = Math.pow(Math.max(1e-12, (m.exp * re) / HEADS_PER_LABOUR_UNIT), P.lam);
  const X = re > 0 && flop > 0 ? Xces(P, Math.max(1e-12, c), l) : 0;
  const Xref = Xces(P, 1, Math.pow(SAF_RE_ASK, P.lam));
  return { sci: sciRate, exp: (X * speed) / (30 * Xref), c, l, X, re, flop, q: sci.q, cap: capNow };
}

// ───────────────────────────── readouts ─────────────────────────────

/** Days to a project's result at today's inputs (Infinity with no input). `cap` previews another science capacity. A
 *  project not in its test is priced at the engineers and compute it would get once it is. */
export function lineEtaDays(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n || !isLineNode(n)) return Infinity;
  const ts = s.player.tree[id];
  const st = ts?.status === 'researching' && ts.saf ? ts.saf : freshSaf(n);
  const r = lineRates(s, id, safAllocation(s, id, cap), cap, false);
  const rate = r.sci + r.exp;
  return rate > 0 ? Math.max(0, st.workNeed - st.work) / rate : Infinity;
}

/** Days between results of a project (one test after another) at today's inputs. `cap` previews another science
 *  capacity. */
export function lineCycleDays(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n || !isLineNode(n)) return Infinity;
  const r = lineRates(s, id, safAllocation(s, id, cap), cap, false);
  const rate = r.sci + r.exp;
  return rate > 0 ? AGENDA_BY_ID[agendaOf(n)].T1 / rate : Infinity;
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

