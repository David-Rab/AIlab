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
// Research engineers (RD-A04): one needs list in the player's order (research.safRe, models/research.ts allocate, the
// capability engineers' allocator): open cases, patches and removals, line experiments (each project in priority order
// asks SAF_RE_ASK labour units × its science staffing), tool re-validation (agendas.ts revalDemand); the rest is idle.
// Compute: the safety line after investigations goes to the projects in experiments by need (RD-R02a, the capability
// rule of RD-B08 expShares): each project's need is its ask × its agenda's computeNeed; a project with engineers takes
// its full share, one with none leaves its share unused (idle). AI labour enters as the effective-labour multipliers m_ideas and m_exp from
// the SAF_IDEAS / SAF_EXP work types (lineLabour, model v3 E2) and as AI taste in ideation (safSciOn).
import { AGENDA_BY_ID, LINE_MULT_MAX, SAF_RE_ASK, SERIOUS_CAP } from '../../../data/v2/agendas';
import { C_UNIT_FLOP_PER_DAY, RE_LABOUR_UNIT } from '../../../data/v2/workTypes';
import { TEAM_SIZE } from '../../../data/v2/teams';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { DEFAULT_SAF_RE_ALLOC } from '../../../data/v2/research';
import { allocate } from '../models/research';
import { revalDemand } from './agendas';
import { PROJECT_BY_ID, isLineNode, type TreeNodeDef } from '../../../data/v2/tree';
import { teamCapacity } from '../departments/capacity';
import { safetyPoolClaims } from '../departments/agents';
import { handedLabour, qualityZ, researchMods, resetSafetyLabour, safetyLabour, sdAIOf, shiftFit, teamTaste, type LabourOf } from '../departments/workfit';
import { Xces } from '../production/ces';
import { trainNow } from '../models/stacks';
import type { AgendaId, GameStateV2, SafReNeed, SafProjectState, TreeNodeState } from '../types';
import { aiShareOf } from './agents';
import { safetySandbag } from './covert';
import { investigationFte, safetyReHeads } from './investigations';
import { patchFte } from './responses';
import { aarAuto, aarFindingOom } from './ideas';

const node = (id: string): TreeNodeDef | undefined => PROJECT_BY_ID[id];

/** RD-R02a: safety research-engineer heads (× quality, the allocator's unit) in one experiment-labour unit
 *  (RE_LABOUR_UNIT team-equivalents of TEAM_SIZE.re heads; departments/capacity.ts reCapacity). */
const HEADS_PER_LABOUR_UNIT = RE_LABOUR_UNIT * TEAM_SIZE.re;
const agendaOf = (n: TreeNodeDef) => n.agenda as AgendaId;

// ───────────────────────────── state ─────────────────────────────

/** A fresh test of a safety project: the agenda's T₁ months of work at reference inputs. */
export const freshSaf = (n: TreeNodeDef): SafProjectState => ({ work: 0, workNeed: AGENDA_BY_ID[agendaOf(n)].T1, flop: 0 });

/** The project's test state (created on first use; a pre-RD-R02b shape is restated by the 56 → 57 migration). */
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
    const c = teamCapacity(t, n.column);
    cap += c;
    heads += t.heads;
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

/** Pool for research lines (H100e): the safety pool after monitors, investigations and the safety agents, each at its
 *  granted share (RD-B07 safetyPoolClaims: served in that order, so the claims never total more than the pool). */
export function linePoolH100e(s: GameStateV2): number {
  return s.player.computeOnline * s.player.split.safety * safetyPoolClaims(s).lines.granted;
}

/** Today's safety research-engineer and compute allocation. Heads are heads × quality. */
export interface SafAlloc {
  /** Engineers not on cases or patches; on line experiments; on tool re-validation (upkeep); idle (no need takes them). */
  free: number; exp: number; upkeep: number; idle: number;
  /** RD-A04: capacity (heads × quality), each need's demand and what it got (player's order). */
  heads: number; demand: Record<SafReNeed, number>; got: Record<SafReNeed, number>;
  /** Engineers and experiment FLOP per day per project in experiments. */
  re: Map<string, number>; flop: Map<string, number>;
  /** Line pool (H100e) and its share per agenda. */
  pool: number; share: Partial<Record<AgendaId, number>>;
}
/** RD-A04: share of the open cases' engineers served today (1 with no case): a case below its staffing gains clarity at
 *  the engineers it gets. */
export function casesServed(s: GameStateV2): number {
  const a = safAllocation(s);
  return a.demand.cases > 1e-12 ? Math.min(1, a.got.cases / a.demand.cases) : 1;
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
  const demand: Record<SafReNeed, number> = { cases: investigationFte(s), patches: patchFte(s), safExp: askSum, reval: revalDemand(s) };
  const got = allocate(heads, s.player.research.safRe ?? DEFAULT_SAF_RE_ALLOC, demand);
  const free = Math.max(0, heads - got.cases - got.patches);
  let left = got.safExp;
  const re = new Map<string, number>();
  for (const id of ids) {
    const x = Math.min(ask.get(id) ?? 0, left);
    left -= x;
    re.set(id, x);
  }
  let exp = 0;
  for (const x of re.values()) exp += x;
  const pool = linePoolH100e(s);
  const flopPerH = PHI_FLOP_PER_H100E_DAY * Math.pow(10, trainNow(s));
  const flop = new Map<string, number>();
  const share: Partial<Record<AgendaId, number>> = {};
  for (const id of ids) {
    // By need (RD-B08 rule): a project with engineers takes its full share; one with none leaves it unused.
    const f = needSum > 0 && (re.get(id) ?? 0) > 0 ? (need.get(id) ?? 0) / needSum : 0;
    flop.set(id, pool * f * flopPerH);
    const ag = agendaOf(node(id) as TreeNodeDef);
    share[ag] = (share[ag] ?? 0) + f;
  }
  const used = got.cases + got.patches + got.safExp + got.reval;
  const a: SafAlloc = { free, exp, upkeep: got.reval, idle: Math.max(0, heads - used), heads, demand, got, re, flop, pool, share };
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

