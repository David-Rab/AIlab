// Capability research projects (model v3 V2/V3: design/MODEL-V3.md §5, §6, §8; design/V3-BUILD.md V2.2–V2.6, V3.4; content
// design/TECH-TREE.md §6). Owner: WS1. Safety research runs on its own copy of this lifecycle (safety/lineProjects.ts) and
// the remaining rolled nodes on models/tree.ts, until RD-R02b / RD-R04 (SYNTHESIS §6 Phase 3) move them onto this engine.
//
// A project's life runs by itself (MODEL-V3 §5.3):
//   1 ideation      the project's science teams find candidates at (m_IDEAS × capacity)^λ × taste per team-month of
//                   ideation work (m_IDEAS: AI labour in research ideas, departments/workfit.ts). Each candidate has a
//                   hidden true small-scale effect x (the project's per-world draw × a candidate factor) and a belief =
//                   x + noise (taste lowers the noise). Once PICK_AT candidates exist the team tests the one with the best
//                   score μ + κσ (κ from the lab's risk policy); scientists keep ideating meanwhile (pool ≤ POOL_MAX, then a
//                   better find replaces the weakest).
//   2 small         experiment work at the AI Futures experiment CES X(c, ℓ) of the project's own experiment FLOP per day
//                   (c) and research-engineer labour (ℓ = (m_EXP × team-equivalents)^λ), both in fixed physical units (the
//                   leader lab's day-0 inputs per project = 1; data/v2/workTypes.ts). A noisy reading narrows the belief.
//                   Posterior below DROP_FRAC × the prior mean: the candidate is dropped, the team picks another.
//   3 scale test    the same CES; it reads the effect at test scale (x·1000^s) and the scale exponent s. Below
//                   SURVIVE_FRAC of the small-scale estimate: dropped.
//   4 result        the final estimate band at the lab's latest base. Ideas and axes fail after MAX_DROPS dropped
//                   candidates (weak candidates, which can be noise; the direction may still work) and can be
//                   reopened as speculative.
//   5 adoption      the engineers build it in (team-weeks ∝ effect); then the TRUE effect enters its stack (models/
//                   stacks.ts; HEADROOM of it waits for routine tuning), an axis's lever unlocks, a domain effect applies.
// Lines repeat. Each line is a pool with returns r (V3 notes, derivation 1): the result that brings research input q (its
// team's taste × the ideas it batches) to a pool at state R has prior mean r_l·log₁₀((R + q)/R), so the line's stack is
// r_l·log₁₀ of its cumulative research input (AI Futures' SE = r·log₁₀ RS).
// Experiment FLOP is real: the experiments pool (plus idle training compute, R5) is shared by the projects in experiments
// and routine tuning in proportion to their research engineers, and consumed while they run.
//
// Allocation without micromanagement (V2.5): capability science teams go down the priority list (teams wanted per
// project, best specialty first), then one pass of pairwise swaps that raise total progress, then leftovers to the
// highest-priority project under PROJECT_MAX_TEAMS. Research engineers serve needs in the player's order (run
// operations → project experiments by priority → routine tuning), with optional caps; overflow flows down.
import {
  BELIEF_NOISE, CAND, DROP_FRAC, DUD_SD, EXP_NOISE, IDEA_STAGES, LINE_FIT, LINE_STAGES, MAX_DROPS, PACE_BATCH,
  AUTO_RANK_W, PICK_AT, POOL_MAX, PROJECT_MAX_TEAMS, PROJECT_SD, RE_OPS, RE_MAX_PER_PROJECT, RISK_KAPPA, SMALL_TO_TEST,
  SPECULATIVE, SURVIVE_FRAC, S_RANGE, S_READ_SD, TASTE_MEAN, TEST_READ_SD, ADOPT_TW, TUNE_K, TUNE_RE_PER_OOM,
} from '../../../data/v2/research';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { C_UNIT_FLOP_PER_DAY, RE_LABOUR_UNIT } from '../../../data/v2/workTypes';
import { EFFORT_TM, PROJECT_BY_ID, TREE, type EffortClass, type TreeNodeDef } from '../../../data/v2/tree';
import { AGENDA_BY_ID, SAF_PICK_AT, SAF_STAGES } from '../../../data/v2/agendas';
import { COLUMN_DEPT } from '../../../data/v2/teams';
import { hash32 } from '../core/rng';
import { reCapacity, teamCapacity } from '../departments/capacity';
import type {
  AgendaId, Allocation, CapProjectState, CapResult, Candidate, GameStateV2, ReNeed, StackKey, SystemCtx, Team,
} from '../types';
import { poolsOf } from '../compute/power';
import { Phi, Xces } from '../production/ces';
import { qualityZ, researchMods, starTaste, teamTaste, workContext } from '../departments/workfit';
import { adopted, PARADIGM_BY_ID } from './paradigms';
import { idleTrainingShare } from './runs';
import { evalReDemand, evalsDay } from './evals';
import { addSuiteExpertData } from './suites';
import { addIdea, headroomTotal, latestBaseFlop, publicBase, researchG, STACK_KEYS, trainNow, tuneDay, stacksGEquiv } from './stacks';
import { steerAdoption } from '../safety/covert';

const node = (id: string): TreeNodeDef | undefined => PROJECT_BY_ID[id];

/** A capability research project (a capability-column node that is not ★ and not a product placeholder). */
export const isCapProject = (n: TreeNodeDef | undefined): boolean => !!n && !!n.kind && COLUMN_DEPT[n.column] === 'cap' && !n.star && !n.soon;

// ───────────────────────────── hidden draws (deterministic per world) ─────────────────────────────

const U = (s: GameStateV2, key: string) => (hash32(s.setup.seed, key) + 0.5) / 4294967297;
/** Standard normal from two hashes (Box–Muller). */
function Z(s: GameStateV2, key: string): number {
  const u1 = U(s, `${key}:a`);
  const u2 = U(s, `${key}:b`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ───────────────────────────── project parameters ─────────────────────────────

/** Stage work (team-months at unit inputs) and the scale test's FLOP share of the latest base (the scale the effect is
 *  measured at). */
export function stagesOf(n: TreeNodeDef): { idea: number; small: number; scale: number; testFrac: number } {
  if (n.kind === 'line') return LINE_STAGES;
  const E = n.effortTM ?? 8;
  return { idea: IDEA_STAGES.idea * E, small: IDEA_STAGES.small * E, scale: IDEA_STAGES.scale * E, testFrac: IDEA_STAGES.testFrac };
}

/** A line's pool in this world (V3 notes, derivation 1): returns r_l = rShare × the preset's r, and the research input
 *  before the start n₀ from the start effect per idea μ₁ = r_l·log₁₀(1 + 1/n₀). */
export function linePool(s: Pick<GameStateV2, 'hidden'>, n: TreeNodeDef): { r: number; n0: number } {
  const r = Math.max(1e-6, (n.effect?.rShare ?? 0.1) * s.hidden.timeline.v3.r);
  const mu1 = Math.max(1e-9, (n.effect?.mean ?? 0) * LINE_FIT.mu);
  return { r, n0: 1 / (Math.pow(10, mu1 / r) - 1) };
}
/** Per-idea prior mean of a batch of b ideas of taste q at pool state R (research input since the start). */
export const poolMean = (pool: { r: number; n0: number }, R: number, q: number, b: number) =>
  (pool.r * Math.log10((pool.n0 + R + b * q) / (pool.n0 + R))) / Math.max(1, b);
/** Taste's lift on a one-off idea's mean: 1 + TASTE_MEAN·(1 − 1/T), ×0.9 for Solid teams, ×1.5 at most [D]. */
export const ideaTaste = (q: number) => 1 + TASTE_MEAN * (1 - 1 / Math.max(0.2, q));

/** Public prior mean of a candidate's small-scale effect per idea (project unit): lines read their pool at the candidate's
 *  position (default: the line's pool now) with its taste and batch; ideas and axes their prior × taste's lift. */
export function priorMean(s: GameStateV2, n: TreeNodeDef, c: Partial<Pick<Candidate, 'at' | 'q' | 'b'>> = {}, spec = 0): number {
  if (n.kind === 'line') return poolMean(linePool(s, n), c.at ?? s.player.tree[n.id]?.cap?.pool ?? 0, c.q ?? 1, c.b ?? 1);
  return (n.effect?.mean ?? 1) * Math.pow(SPECULATIVE.mean, spec) * ideaTaste(c.q ?? 1);
}

/** Base odds that the direction works in a world (paradigm prior or node odds; lines always). */
export const baseOdds = (n: TreeNodeDef) => (n.kind === 'line' ? 1 : n.paradigm ? (PARADIGM_BY_ID[n.id]?.prior ?? 1) : (n.odds ?? 1));
/** Odds of the current attempt (each speculative reopen halves them). */
export const attemptOdds = (n: TreeNodeDef, spec = 0) => baseOdds(n) * Math.pow(SPECULATIVE.odds, spec);

/** Hidden: does the direction work in this world on attempt 1 + spec? A paradigm's first attempt is the hidden paradigm
 *  draw from newGame; every other attempt hash32(seed, 'node:'+id[+':'+attempt]) against its odds (as v2's roll). */
function works(s: GameStateV2, n: TreeNodeDef, spec: number): boolean {
  if (n.kind === 'line') return true;
  const attempt = 1 + spec;
  if (n.paradigm && attempt <= 1) return s.hidden.paradigmSuccess[n.id] === true;
  const u = hash32(s.setup.seed, attempt <= 1 ? `node:${n.id}` : `node:${n.id}:${attempt}`) / 4294967296;
  return u < attemptOdds(n, spec);
}

/** Scale exponent below which a small-scale win does not survive the scale test (its effect at test scale falls
 *  under SURVIVE_FRAC of the small-scale one). */
const S_SURVIVE = Math.log10(SURVIVE_FRAC) / Math.log10(SMALL_TO_TEST);

/** Hidden: a candidate's true effect at the scale test and its scale exponent. One idea: x·1000^s. A batch of b ideas
 *  (lines at high research speed) keeps its survivors: the expected survivor-weighted factor E[1000^s; s ≥ s*] of the
 *  line's scale prior and the survivors' mean exponent (the central limit of b independent ideas). */
export function atTest(n: TreeNodeDef, c: Pick<Candidate, 'b'>, truth: { x: number; s: number }): { xTest: number; s: number; batch: boolean } {
  const [mu, sd] = n.effect?.s ?? [0, 0];
  if (c.b <= 1 || sd <= 0) return { xTest: truth.x * Math.pow(SMALL_TO_TEST, truth.s), s: truth.s, batch: false };
  const a = Math.log(SMALL_TO_TEST);
  const al = (S_SURVIVE - mu) / sd;
  const p = Math.max(1e-9, 1 - Phi(al));
  const factor = Math.exp(a * mu + (a * a * sd * sd) / 2) * Phi((mu + a * sd * sd - S_SURVIVE) / sd);
  const sEff = mu + (sd * Math.exp(-al * al / 2)) / Math.sqrt(2 * Math.PI) / p;
  return { xTest: truth.x * factor, s: Math.max(S_RANGE[0], Math.min(S_RANGE[1], sEff)), batch: true };
}

/** Hidden truth of a candidate: small-scale effect x (project unit, the whole batch) and scale exponent s. Recomputed from
 *  the seed, never stored (engine only). The per-world draw of the project's mean is keyed by generation. */
export function candidateTruth(s: GameStateV2, n: TreeNodeDef, st: CapProjectState, c: Candidate): { x: number; s: number } {
  const spec = st.spec ?? 0;
  const key = `${n.id}:${spec}:${c.k}`;
  const z = Z(s, `cx:${key}`);
  const [sm, ssd] = n.effect?.s ?? [0, 0];
  // Clamped [D]: no idea grows faster than ×1.8 per OOM of run compute (the Transformer's ≈ 0.23, Gundlach) or fades
  // faster than ×0.25 per OOM.
  const sx = Math.max(S_RANGE[0], Math.min(S_RANGE[1], sm + ssd * Z(s, `cs:${key}`)));
  const pub = priorMean(s, n, c, spec);
  if (!works(s, n, spec)) return { x: Math.sqrt(c.b) * pub * DUD_SD * z, s: sx };
  const sd = n.effect?.sd ?? PROJECT_SD;
  const T = pub * Math.exp(sd * Z(s, `T:${n.id}:${spec}:${c.gen}`) - (sd * sd) / 2);
  const spread = Math.pow(SPECULATIVE.spread, spec);
  const x = c.b * T * (CAND.mean0 + CAND.meanNov * c.nov) + Math.sqrt(c.b) * T * (CAND.sd0 + CAND.sdNov * c.nov) * spread * z;
  return { x, s: sx };
}

// ───────────────────────────── capacities and taste ─────────────────────────────

/** Ideas a line candidate batches at today's experiment throughput X (1 below PACE_BATCH) [D: performance]. */
export const batchOf = (X: number) => Math.max(1, Math.floor(X / PACE_BATCH));


/** Science teams of the capabilities department. */
export const capSciTeams = (s: GameStateV2) => s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap');
/** Capabilities research engineers, team-equivalents. */
export const capReCapacity = (s: GameStateV2) => s.player.teams.reduce((a, t) => a + (t.role === 're' && t.dept === 'cap' ? reCapacity(t) : 0), 0);

/** Capacity and taste of the science teams on a project. Taste (MODEL-V3 §8, V3.4) is each team's E[max(human, AI)] on
 *  the AIFM taste distribution (quality sets the team's place in it, the frontier-research model's AI taste lifts it),
 *  capacity-weighted; 1 = a Strong team without AI. */
export function sciOn(s: GameStateV2, id: string, teams = s.player.teams): { cap: number; q: number } {
  const n = node(id);
  if (!n) return { cap: 0, q: 1 };
  const wc = workContext(s);
  const m2b = s.hidden.timeline.prod.m2b;
  const star = starTaste(s);
  let cap = 0;
  let qw = 0;
  for (const t of teams) {
    if (t.projectId !== id || t.role !== 'sci') continue;
    const c = teamCapacity(t, n.column);
    cap += c;
    qw += c * teamTaste(qualityZ(t.quality), wc.sdAI, wc.phi, m2b, star);
  }
  return { cap, q: cap > 0 ? qw / cap : 1 };
}

/** A project's experiment inputs as the next research day gives them: its research-engineer team-equivalents from the
 *  allocation that day runs (reAllocation; a project not yet in experiments is read at a full project's RE_MAX_PER_PROJECT,
 *  what it gets when its test starts if engineers are free), its experiment compute c (a full project's share of FLOP,
 *  which goes by need, RD-B08; yesterday's unit project), labour ℓ and CES throughput X (0 for a test with no research
 *  engineers: it waits for them). */
export function projectExpInputs(s: GameStateV2, id: string, alloc: Pick<ReAllocation, 'perProject'> = reAllocation(s)): { re: number; reEval: number; cc: number; l: number; X: number } {
  const P = s.hidden.timeline.prod;
  const x = s.player.research.last?.x;
  const testing = !!s.player.tree[id]?.cap?.test;
  const re = alloc.perProject.get(id) ?? 0;
  const reEval = re > 0 || testing ? re : RE_MAX_PER_PROJECT;
  const cc = (x?.c ?? 0) * (RE_MAX_PER_PROJECT / RE_LABOUR_UNIT);
  const l = Math.pow(Math.max(1e-12, ((x?.mExp ?? 1) * reEval) / RE_LABOUR_UNIT), P.lam);
  return { re, reEval, cc, l, X: cc > 0 && reEval > 0 ? Xces(P, cc, l) : 0 };
}

/** RD-B18 (B31): the one capability-project ETA, in days, that every readout and preview uses. Ideation to PICK_AT
 *  candidates at the science teams' rate (as stepProject: (m_IDEAS × capacity)^λ × taste × speed over the ideation
 *  stage's team-months, a line's batch), then the test stages at the project's experiment inputs (projectExpInputs).
 *  `sci` previews other staffing (default: the teams on it). 0 for a project past its tests; Infinity = stalled. */
export function capEta(s: GameStateV2, id: string, sci: { cap: number; q: number } = sciOn(s, id)): { ideation: number; experiments: number; eta: number } {
  const n = node(id);
  const ts = s.player.tree[id];
  const st = ts?.cap;
  if (!n || ts?.status === 'known' || ts?.status === 'failed' || !takesTeams(st)) return { ideation: 0, experiments: 0, eta: 0 };
  const P = s.hidden.timeline.prod;
  const x = s.player.research.last?.x;
  const sg = stagesOf(n);
  const b = n.kind === 'line' ? batchOf(x?.X ?? 1) : 1;
  const speed = researchMods(s).speed;
  const ideaPerDay = sci.cap > 0 ? (Math.pow(Math.max(1, x?.mIdeas ?? 1) * sci.cap, P.lam) * sci.q * speed) / (sg.idea * b * 30) : 0;
  const { X } = projectExpInputs(s, id);
  const workPerDay = X > 0 ? (X * speed * Math.sqrt(RE_LABOUR_UNIT)) / 30 : 0;
  const t = st?.test;
  const ideation = t ? 0 : ideaPerDay > 0 ? Math.max(0, PICK_AT - (st?.cands.length ?? 0) - (st?.idea ?? 0)) / ideaPerDay : Infinity;
  const left = t ? Math.max(0, t.workNeed - t.work) + (st?.stage === 'small' ? sg.scale * t.c.b : 0) : (sg.small + sg.scale) * b;
  const experiments = workPerDay > 0 ? left / workPerDay : Infinity;
  return { ideation, experiments, eta: ideation + experiments };
}

/** RD-B18 (B31): a project's work in the units the engine runs, one readout for every view: capability projects in
 *  team-months at unit inputs (ideation of PICK_AT candidates by science teams; the two test stages by research
 *  engineers and experiment compute); a safety research-line project in months at serious staffing (T₁: its ideation
 *  and test stages, safety/lineProjects.ts); any other project in team-months at research speed 1 (√ capacity). */
export function effortOfNode(n: TreeNodeDef): { sci: number; exp: number; unit: 'team-months' | 'months' } {
  if (isCapProject(n)) {
    const sg = stagesOf(n);
    return { sci: PICK_AT * sg.idea, exp: sg.small + sg.scale, unit: 'team-months' };
  }
  if (n.agenda && !n.paradigm) {
    const T1 = AGENDA_BY_ID[n.agenda as AgendaId].T1;
    return { sci: SAF_PICK_AT * SAF_STAGES.idea * T1, exp: (SAF_STAGES.small + SAF_STAGES.val) * T1, unit: 'months' };
  }
  return { sci: n.effortTM ?? EFFORT_TM[n.effort ?? 'M'], exp: 0, unit: 'team-months' };
}
/** The size class shown for a node's work (S ≤ 6, M ≤ 12, L ≤ 24 team-months, else XL), from effortOfNode; a research
 *  line's class is its agenda's (data/v2/tree.ts, from T₁). */
export function effortClassOf(n: TreeNodeDef): EffortClass {
  const e = effortOfNode(n);
  if (e.unit === 'months') return n.effort ?? 'M';
  const tm = e.sci + e.exp;
  return tm <= 6 ? 'S' : tm <= 12 ? 'M' : tm <= 24 ? 'L' : 'XL';
}

// ───────────────────────────── state ─────────────────────────────

/** A fresh project state (generation 1, ideation). */
export const freshCap = (spec = 0): CapProjectState => ({ stage: 'ideation', gen: 1, idea: 0, cands: [], drops: 0, next: 1, ...(spec ? { spec } : {}) });

/** The project's state, created on first use (status 'researching'). */
export function capState(s: GameStateV2, id: string): CapProjectState {
  const p = s.player;
  let st = p.tree[id];
  if (!st || (st.status !== 'researching' && st.status !== 'failed')) st = p.tree[id] = { status: 'researching', progress: 0, attempts: 1 };
  st.cap ??= freshCap();
  return st.cap;
}

/** Stages in which a project uses science teams. */
export const takesTeams = (st: CapProjectState | undefined) => !st || st.stage === 'ideation' || st.stage === 'small' || st.stage === 'scale';

// ───────────────────────────── allocation: scientists (V2.5) ─────────────────────────────

/** B4: whether a project's teams wanted is "auto". */
export const wantIsAuto = (s: GameStateV2, id: string) => !!s.player.research.wantAuto?.includes(id);
/** Teams wanted for a project (default 1; an auto project asks for 1 in the first pass and takes spare teams after). */
export const teamsWanted = (s: GameStateV2, id: string) => Math.max(0, Math.min(PROJECT_MAX_TEAMS, Math.round(s.player.research.want[id] ?? 1)));

/** Progress value of an assignment: Σ over projects of √capacity ÷ ideation effort (candidates per day at unit inputs). */
export function assignmentValue(projects: string[], teams: { t: Team; p: string | undefined }[]): number {
  let v = 0;
  for (const id of projects) {
    const n = node(id);
    if (!n) continue;
    let cap = 0;
    for (const x of teams) if (x.p === id) cap += teamCapacity(x.t, n.column);
    v += Math.sqrt(cap) / stagesOf(n).idea;
  }
  return v;
}

/** Deterministic assignment of capabilities science teams to the ready projects (in priority order). Returns the team
 *  → project map and why each team is there; teams placed by hand stay. Pure (does not mutate the state). */
export function planAssignment(s: GameStateV2, ready: string[]): Map<string, { p?: string; why: string }> {
  const out = new Map<string, { p?: string; why: string }>();
  const all = capSciTeams(s);
  const manual = all.filter((t) => t.manual && t.projectId && ready.includes(t.projectId));
  for (const t of manual) out.set(t.id, { p: t.projectId, why: 'Placed by hand' });
  const pool = all.filter((t) => !out.has(t.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const count = new Map<string, number>(ready.map((id) => [id, manual.filter((t) => t.projectId === id).length]));
  const left = [...pool];
  // 1. Down the list: each project up to its teams wanted, best specialty match (then capacity) first.
  ready.forEach((id, rank) => {
    const n = node(id) as TreeNodeDef;
    const auto = wantIsAuto(s, id);
    let need = (auto ? 1 : teamsWanted(s, id)) - (count.get(id) ?? 0);
    while (need > 0 && left.length) {
      left.sort((a, b) => teamCapacity(b, n.column) - teamCapacity(a, n.column) || (a.id < b.id ? -1 : 1));
      const t = left.shift() as Team;
      out.set(t.id, { p: id, why: `Priority ${rank + 1}: ${n.name} ${auto ? 'is on auto (first team)' : `wants ${teamsWanted(s, id)} team${teamsWanted(s, id) === 1 ? '' : 's'}`}${t.specialty === n.column ? ' (its specialty)' : ''}` });
      count.set(id, (count.get(id) ?? 0) + 1);
      need--;
    }
  });
  // 2. One improvement pass: swap two teams on different projects when that raises total progress.
  //    P2: assignmentValue(ready, all with their current project) evaluated on precomputed capacities (same sums in the
  //    same order), and the value before a swap carried over (it only changes when a swap is kept).
  const placed = pool.filter((t) => out.get(t.id)?.p);
  const ents = all.map((t) => out.get(t.id));
  const capRows: { id: string; cap: number[]; idea: number }[] = [];
  for (const id of ready) {
    const n = node(id);
    if (n) capRows.push({ id, cap: all.map((t) => teamCapacity(t, n.column)), idea: stagesOf(n).idea });
  }
  // Each row's term √cap ÷ idea is recomputed only for the two projects a swap touches (the same ordered sum), the
  // total re-added in row order.
  const term = (row: (typeof capRows)[number]) => {
    let cap = 0;
    for (let k = 0; k < ents.length; k++) if (ents[k]?.p === row.id) cap += row.cap[k];
    return Math.sqrt(cap) / row.idea;
  };
  const terms = capRows.map(term);
  const total = () => {
    let v = 0;
    for (const x of terms) v += x;
    return v;
  };
  const retouch = (p1: string | undefined, p2: string | undefined) => {
    for (let r = 0; r < capRows.length; r++) if (capRows[r].id === p1 || capRows[r].id === p2) terms[r] = term(capRows[r]);
  };
  let before = placed.length > 1 ? total() : 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = out.get(placed[i].id) as { p?: string; why: string };
      const b = out.get(placed[j].id) as { p?: string; why: string };
      if (a.p === b.p) continue;
      const pa = a.p;
      const pb = b.p;
      a.p = pb;
      b.p = pa;
      retouch(pa, pb);
      const after = total();
      if (after > before + 1e-9) {
        before = after;
        a.why = `Swapped onto ${node(a.p as string)?.name}: a better fit for total progress`;
        b.why = `Swapped onto ${node(b.p as string)?.name}: a better fit for total progress`;
      } else {
        b.p = a.p;
        a.p = pa;
        retouch(pa, pb);
      }
    }
  }
  // 3. Leftovers. B4: auto projects first, each spare team where it adds the most progress (√capacity ÷ ideation
  //    effort, × AUTO_RANK_W per rank); then the highest-priority project still under the most a project takes.
  const autos = ready.filter((id) => wantIsAuto(s, id));
  const capOn = new Map<string, number>();
  if (autos.length) for (const t of all) { const p = out.get(t.id)?.p; if (p && autos.includes(p)) capOn.set(p, (capOn.get(p) ?? 0) + teamCapacity(t, (node(p) as TreeNodeDef).column)); }
  for (const t of left) {
    let best: string | undefined;
    let bestGain = 0;
    for (const a of autos) {
      if ((count.get(a) ?? 0) >= PROJECT_MAX_TEAMS) continue;
      const n = node(a) as TreeNodeDef;
      const c0 = capOn.get(a) ?? 0;
      const gain = ((Math.sqrt(c0 + teamCapacity(t, n.column)) - Math.sqrt(c0)) / stagesOf(n).idea) * AUTO_RANK_W ** ready.indexOf(a);
      if (gain > bestGain) { best = a; bestGain = gain; }
    }
    if (best) {
      count.set(best, (count.get(best) ?? 0) + 1);
      capOn.set(best, (capOn.get(best) ?? 0) + teamCapacity(t, (node(best) as TreeNodeDef).column));
      out.set(t.id, { p: best, why: `Auto: ${node(best)?.name} (priority ${ready.indexOf(best) + 1}) gains the most progress from it${t.specialty === node(best)?.column ? ' (its specialty)' : ''}` });
      continue;
    }
    const id = ready.find((x) => (count.get(x) ?? 0) < PROJECT_MAX_TEAMS);
    if (!id) {
      out.set(t.id, { why: 'Idle: every ready project has the most teams it can use' });
      continue;
    }
    count.set(id, (count.get(id) ?? 0) + 1);
    out.set(t.id, { p: id, why: `Spare: every project has its teams wanted, so it joins the top project (${node(id)?.name})` });
  }
  if (!ready.length) for (const t of pool) out.set(t.id, { why: 'Idle: no capability project is ready (rank one on Research)' });
  return out;
}

/** Apply the assignment to the capabilities science teams. */
export function assignCapTeams(s: GameStateV2, ready: string[]) {
  const plan = planAssignment(s, ready);
  for (const t of capSciTeams(s)) {
    const x = plan.get(t.id);
    if (!x) continue;
    if (x.p) t.projectId = x.p;
    else delete t.projectId;
    t.why = x.why;
  }
}

// ───────────────────────────── allocation: research engineers (V2.5) ─────────────────────────────

/** Research engineers that keep the running runs and the stream going today (team-equivalents of effective labour).
 *  RD-B09 (DD-11): the only charge for operating a run (engineers build its setup); short of it, runs slow (opsServed). */
export function reOpsNeed(s: GameStateV2): number {
  let need = 0;
  for (const r of s.player.models.runs) {
    if (r.status !== 'running' || (r.setupId !== undefined && r.readyDay === undefined)) continue;
    need += r.kind === 'base' ? RE_OPS.base : r.kind === 'continue' || (r.kind === 'post' && !r.name.startsWith('IDA')) ? RE_OPS.mid : RE_OPS.small;
  }
  if (s.player.models.stream) need += RE_OPS.stream;
  return need;
}

/** RD-B09: share of the run-operations need served (gets ÷ needs; 1 with no need). Running runs and the stream advance
 *  at this share (models/runs.ts): a run short of operators loses goodput (failures and restarts wait). */
export const opsServed = (a: Pick<ReAllocation, 're' | 'demand'>) =>
  (a.demand.ops > 1e-12 ? Math.min(1, Math.round((a.re.ops / a.demand.ops) * 1000) / 1000) : 1);

/** Split a capacity over needs in order: each takes min(its demand, its caps, what is left); unused flows down. */
export function allocate<K extends string>(cap: number, alloc: Allocation<K>, demand: Record<K, number>): Record<K, number> {
  const out = {} as Record<K, number>;
  let left = Math.max(0, cap);
  for (const k of alloc.order) {
    const lim = Math.min(alloc.max[k] ?? Infinity, (alloc.share[k] ?? Infinity) * cap);
    const take = Math.max(0, Math.min(left, demand[k] ?? 0, lim));
    out[k] = take;
    left -= take;
  }
  for (const k of Object.keys(demand) as K[]) out[k] ??= 0;
  return out;
}

/** Projects in an experiment stage, in priority order. */
const experimenting = (s: GameStateV2, q: string[]) => q.filter((id) => {
  const st = s.player.tree[id]?.cap;
  return !!st && !!st.test;
});

/** Today's research-engineer demand per need (human team-equivalents) at the AI labour multiplier m on experiments: run
 *  operations ÷ m, the eval suites (model v3 D7, models/evals.ts), RE_MAX_PER_PROJECT per project in experiments, routine
 *  tuning TUNE_RE_PER_OOM per OOM of remaining headroom (RD-B08: a finite need, 0 with nothing to tune). */
export function reDemand(s: GameStateV2, m = Math.max(1, workContext(s).slots.EXP.m)): Record<ReNeed, number> {
  return {
    ops: reOpsNeed(s) / m, evals: evalReDemand(s, m), exp: experimenting(s, s.player.research.queue).length * RE_MAX_PER_PROJECT,
    tune: TUNE_RE_PER_OOM * headroomTotal(s),
  };
}

/** Research engineers by need and per project (human team-equivalents) for today. AI labour in experiments (m_EXP)
 *  carries part of the run operations and evals, so their human need is the effective need ÷ m_EXP. Capacity no need
 *  takes is idle. */
export interface ReAllocation { re: Record<ReNeed, number>; demand: Record<ReNeed, number>; perProject: Map<string, number>; total: number }
export function reAllocation(s: GameStateV2): ReAllocation {
  const total = capReCapacity(s);
  const exp = experimenting(s, s.player.research.queue);
  const m = Math.max(1, workContext(s).slots.EXP.m);
  const demand = reDemand(s, m);
  const re = allocate(total, s.player.research.re, demand);
  const perProject = new Map<string, number>();
  let left = re.exp;
  for (const id of exp) {
    const x = Math.min(RE_MAX_PER_PROJECT, left);
    perProject.set(id, x);
    left -= x;
  }
  return { re, demand, perProject, total };
}

/** Experiment FLOP by need (RD-B08), not by headcount: the pool is divided over the needs' research-engineer demands,
 *  RE_MAX_PER_PROJECT for each project in experiments and routine tuning's demand. A project with research engineers takes
 *  its full share first; routine tuning takes what is left (with the shares of projects that got none). So more research
 *  engineers never take FLOP from a project. units = the demands' team-equivalents the pool is divided over. */
export function expShares(alloc: ReAllocation, avail: number): { units: number; perProject: Map<string, number>; tune: number } {
  const units = alloc.perProject.size * RE_MAX_PER_PROJECT + alloc.demand.tune;
  const per = units > 0 ? Math.max(0, avail) / units : 0;
  const perProject = new Map<string, number>();
  let used = 0;
  for (const [id, re] of alloc.perProject) {
    const f = re > 0 ? RE_MAX_PER_PROJECT * per : 0;
    perProject.set(id, f);
    used += f;
  }
  return { units, perProject, tune: alloc.re.tune > 0 ? Math.max(0, avail - used) : 0 };
}

// ───────────────────────────── research inputs in physical units (V3.4) ─────────────────────────────

/** Experiment FLOP the lab's research can use per day: the experiments pool (and idle training compute unless the
 *  policy sends it to data, R5) at today's training throughput. P13's multiplier is applied by the callers
 *  (researchInputs, stepProject and routine tuning take it as `p13`). */
export function projectFlopPerDay(s: GameStateV2): number {
  return expPoolH100e(s) * PHI_FLOP_PER_H100E_DAY * Math.pow(10, trainNow(s));
}
/** H100e of the experiments pool (and idle training compute unless the policy sends it to data) today. */
export function expPoolH100e(s: GameStateV2): number {
  const pools = poolsOf(s);
  const idle = s.player.policies.spareTraining !== 'data' ? idleTrainingShare(s) * pools.training : 0;
  return pools.experiments + idle;
}
/** P13 (automated AI research agents): a flat experiment-FLOP multiplier, up to ×1.5 as the internal model's measured RSCH
 *  goes 6.5 → 8.5 (models/tree.ts payoffOf, passed in by the tree's day step). Deleted by RD-E01a (SYNTHESIS §6 Phase 3). */
const p13Mult = (s: GameStateV2, payoff: number) => (adopted(s, 'P13') ? 1 + 0.5 * payoff : 1);

/** The lab's research inputs today: labour multipliers (AI in experiments and in ideas), the speed modifiers (pauses,
 *  treaty, siloing, migrations), the experiment FLOP per RE_LABOUR_UNIT of `reRes` (capResearchDay passes the needs' units of
 *  expShares, so c is a full project's) and the X of a unit project. */
export interface ResearchInputs { mExp: number; mIdeas: number; speed: number; flopDay: number; reRes: number; c: number; l: number; X: number }
export function researchInputs(s: GameStateV2, reRes: number, flopDay = projectFlopPerDay(s), p13 = 1): ResearchInputs {
  const wc = workContext(s);
  const P = s.hidden.timeline.prod;
  const mExp = wc.slots.EXP.m;
  const mIdeas = wc.slots.IDEAS.m;
  const speed = researchMods(s).speed;
  const units = Math.max(1e-9, reRes / RE_LABOUR_UNIT);
  const c = (flopDay * p13) / units / C_UNIT_FLOP_PER_DAY;
  const l = Math.pow(Math.max(1e-12, mExp), P.lam);
  return { mExp, mIdeas, speed, flopDay, reRes, c, l, X: reRes > 0 ? Xces(P, Math.max(1e-12, c), l) * speed : 0 };
}

// ───────────────────────────── candidates and beliefs ─────────────────────────────

const RISK = (s: GameStateV2) => RISK_KAPPA[s.player.research.risk ?? 'balanced'];
/** The score a team pursues: μ + κσ of its belief. */
export const candidateScore = (c: Pick<Candidate, 'mu' | 'sd'>, kappa: number) => c.mu + kappa * c.sd;

/** A new candidate from ideation (belief = truth + noise; taste lowers the noise). Lines read their pool now. */
export function newCandidate(s: GameStateV2, n: TreeNodeDef, st: CapProjectState, q: number, b: number): Candidate {
  const spec = st.spec ?? 0;
  const k = st.next++;
  const nov = U(s, `nov:${n.id}:${spec}:${k}`);
  const c: Candidate = { k, gen: st.gen, nov, b, q, mu: 0, sd: 1, muS: n.effect?.s?.[0] ?? 0, sdS: n.effect?.s?.[1] ?? 0, ...(n.kind === 'line' ? { at: st.pool ?? 0 } : {}) };
  const truth = candidateTruth(s, n, st, c);
  const pub = priorMean(s, n, c, spec);
  // Taste narrows the belief noise ÷ T [D; V2a: ÷ quality², but AI taste reaches T ≈ 30–200].
  const sd = (Math.sqrt(b) * pub * BELIEF_NOISE * (0.5 + nov) * Math.pow(SPECULATIVE.spread, spec)) / Math.max(0.2, q);
  c.mu = truth.x + sd * Z(s, `cb:${n.id}:${spec}:${k}`);
  c.sd = sd;
  return c;
}

/** A line candidate picked for testing reads its pool at today's state (results since it was found made ideas harder);
 *  its belief scales with the prior. */
function repool(s: GameStateV2, n: TreeNodeDef, st: CapProjectState, c: Candidate) {
  if (n.kind !== 'line') return;
  const now = st.pool ?? 0;
  if ((c.at ?? 0) === now) return;
  const before = priorMean(s, n, c, st.spec ?? 0);
  c.at = now;
  const ratio = priorMean(s, n, c, st.spec ?? 0) / Math.max(1e-30, before);
  c.mu *= ratio;
  c.sd *= ratio;
}

/** Add a candidate to the pool: below POOL_MAX it joins; else it replaces the weakest by score if it scores higher. */
function addCandidate(st: CapProjectState, c: Candidate, kappa: number) {
  if (st.cands.length < POOL_MAX) {
    st.cands.push(c);
    return;
  }
  let wi = 0;
  for (let i = 1; i < st.cands.length; i++) if (candidateScore(st.cands[i], kappa) < candidateScore(st.cands[wi], kappa)) wi = i;
  if (candidateScore(c, kappa) > candidateScore(st.cands[wi], kappa)) st.cands[wi] = c;
}

/** The candidate a team picks: the best score under the lab's risk policy (ties: lower candidate number). */
export function pickCandidate(cands: Candidate[], kappa: number): number {
  let best = -1;
  for (let i = 0; i < cands.length; i++) if (best < 0 || candidateScore(cands[i], kappa) > candidateScore(cands[best], kappa) + 1e-12) best = i;
  return best;
}

/** Small experiments' work for a candidate (FLOP is consumed at the project's share of the pool while it runs). */
function startTest(s: GameStateV2, n: TreeNodeDef, c: Candidate): CapProjectState['test'] {
  const sg = stagesOf(n);
  const fTest = sg.testFrac * latestBaseFlop(s);
  return { c, work: 0, workNeed: sg.small * c.b, flop: 0, flopNeed: 0, fTest };
}

// ───────────────────────────── one day ─────────────────────────────

/** Drop the candidate in test; ideas fail after MAX_DROPS. Returns true if the project failed. */
function dropTest(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: CapProjectState, why: string): boolean {
  delete st.test;
  st.drops += 1;
  st.stage = 'ideation';
  if (n.kind !== 'line' && st.drops >= MAX_DROPS) {
    st.stage = 'failed';
    const ts = s.player.tree[n.id];
    ts.status = 'failed';
    ts.day = ctx.day;
    ctx.log('research', `${n.name}: gave up after ${MAX_DROPS} weak candidates (last: ${why}). Weak results can be bad luck, so the direction may still work; it can be reopened as a speculative project.`, 2, n.id);
    return true;
  }
  return false;
}

/** Effect unit of a project as an OOM total (for the adoption cost): stack effects as is, domain effects summed. */
const oomOf = (n: TreeNodeDef, x: number) => (n.effect?.stack ? Math.abs(x) * (1 + Object.values(n.effect.also ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0)) : n.effect?.domains ? Math.abs(x) * Object.values(n.effect.domains).reduce((a, v) => a + Math.abs(v ?? 0), 0) : 0);
/** A project with a typed effect beyond an unlock (stack, domains, data efficiency or expert data). */
export const hasTypedEffect = (n: TreeNodeDef) => !!n.effect && !!(n.effect.stack || n.effect.domains || n.effect.data || n.effect.expert);

/** Engineers' team-weeks to adopt a result. */
export const adoptTW = (n: TreeNodeDef, est: number) =>
  !n.effect || (!n.effect.stack && !n.effect.domains) ? ADOPT_TW.unlock : Math.min(ADOPT_TW.max, ADOPT_TW.base + ADOPT_TW.perOom * oomOf(n, est));

/** Queue the adoption of the result resolveStage just produced: a line's oldest unqueued pending result, or a
 *  project's result (which moves it to 'adopting'). Only resolveStage calls this, right after it stores the result. */
function queueAdoption(n: TreeNodeDef, st: CapProjectState, queueBuild: (tw: number) => string): void {
  const r = n.kind === 'line' ? st.pending?.find((x) => !x.buildId) : st.result;
  if (!r) return;
  r.buildId = queueBuild(adoptTW(n, r.est));
  if (n.kind !== 'line') st.stage = 'adopting';
}

/** The engineers finished building a result in: its TRUE effect enters the stack (or the lever unlocks); the R&D fleet
 *  may steer the build (model v3 E7). */
export function completeAdoption(s: GameStateV2, ctx: SystemCtx, id: string, buildId: string, onKnown: (id: string) => void) {
  const n = node(id);
  const ts = s.player.tree[id];
  const st = ts?.cap;
  if (!n || !isCapProject(n) || !st) return;
  const r = n.kind === 'line' ? st.pending?.find((x) => x.buildId === buildId) : st.result?.buildId === buildId ? st.result : undefined;
  if (!r) return;
  const truth0 = candidateTruth(s, n, st, r.c);
  const at = atTest(n, r.c, truth0);
  const truth = { x: truth0.x, s: at.s };
  const res = s.player.research;
  const eff = n.effect;
  const xTest = at.xTest;
  // Model v3 E7: the models doing the lab's R&D may steer the build toward their own ends (safety/covert.ts STEER): the
  // full effect still lands; an uncaught act adds hidden CoT pressure to later runs. Nothing the lab sees changes.
  if (eff?.stack || eff?.domains) steerAdoption(s, ctx, `${id}:${buildId}`, eff.stack ? xTest : 0);
  let realised = 0;
  if (eff?.stack) {
    // RD-B17: a batch counts its b ideas; the second stack an idea also moves adds no idea.
    addIdea(res.stacks[eff.stack], xTest, truth.s, r.fTest, r.c.b);
    for (const [k, ratio] of Object.entries(eff.also ?? {}) as [StackKey, number][]) addIdea(res.stacks[k], xTest * ratio, 0, r.fTest, 0);
    realised = xTest * Math.pow(latestBaseFlop(s) / r.fTest, truth.s);
  } else if (eff?.domains) {
    for (const [d, v] of Object.entries(eff.domains)) res.domainG[d as keyof typeof res.domainG] = (res.domainG[d as keyof typeof res.domainG] ?? 0) + xTest * (v ?? 0);
    realised = xTest;
  } else if (eff?.data || eff?.expert) {
    // Model v3 D9: data-efficiency and expert-data effects in their own units (× xTest, the realised "1 = as designed"),
    // floored at 0 [D: an adopted method is never worse than the pipeline it replaces; the lab keeps the old one].
    const x = Math.max(0, xTest);
    if (eff.data) {
      const fx = (res.dataFx ??= {});
      if (eff.data.synQMax) fx.synQMax = (fx.synQMax ?? 0) + x * eff.data.synQMax;
      if (eff.data.worthOom) fx.worthOom = (fx.worthOom ?? 0) + x * eff.data.worthOom;
    }
    if (eff.expert) addSuiteExpertData(s, ctx, eff.expert.family, x * eff.expert.tokensT, n.name);
    realised = x;
  }
  if (eff && hasTypedEffect(n)) {
    // RD-B17: domain and data effects are listed as their own kind (not under a stack).
    const where = eff.stack ? { stack: eff.stack } : { kind: eff.domains ? ('domain' as const) : ('data' as const) };
    res.adopted.push({ id, name: n.name, ...where, ...(r.c.b > 1 ? { b: r.c.b } : {}), eff: Math.round(realised * 1e4) / 1e4, est: Math.round(r.est * 1e4) / 1e4, estSd: Math.round(r.estSd * 1e4) / 1e4, s: Math.round(truth.s * 1000) / 1000, day: ctx.day });
    if (res.adopted.length > 30) res.adopted.splice(0, res.adopted.length - 30);
  }
  if (n.kind === 'line') {
    st.pending = (st.pending ?? []).filter((x) => x !== r);
    if (!st.pending.length) delete st.pending;
  } else {
    delete st.result;
    ts.status = 'known';
    ts.day = ctx.day;
    onKnown(id);
    ctx.log('research', `${n.name} is built into the lab's recipe.`, 2, id);
  }
}

/** A project's experiment work per day (team-months) from its research engineers `re` and experiment FLOP `flopDay`:
 *  the CES X(c, ℓ) × the speed modifiers × √RE_LABOUR_UNIT / 30 (one pair of teams at unit inputs); 0 without either. */
export function experimentRate(s: GameStateV2, inp: Pick<ResearchInputs, 'mExp' | 'speed'>, p13: number, re: number, flopDay: number): number {
  if (re <= 0 || flopDay <= 0) return 0;
  const P = s.hidden.timeline.prod;
  const l = Math.pow(Math.max(1e-12, (inp.mExp * re) / RE_LABOUR_UNIT), P.lam);
  return (Xces(P, (flopDay * p13) / C_UNIT_FLOP_PER_DAY, l) * inp.speed * Math.sqrt(RE_LABOUR_UNIT)) / 30;
}

/** One day of one project's lifecycle. `reCap` = research-engineer team-equivalents on it today (human); `flopDay` = its
 *  share of the experiment FLOP per day (consumed while it experiments; returns what it used). */
function stepProject(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, inp: ResearchInputs, p13: number, reCap: number, flopDay: number, queueBuild: (tw: number) => string): number {
  const st = capState(s, n.id);
  if (st.stage === 'failed' || st.stage === 'result' || st.stage === 'adopting') return 0;
  const P = s.hidden.timeline.prod;
  const kappa = RISK(s);
  const sg = stagesOf(n);
  // 1 Ideation (continuous while science teams are on it): (m_IDEAS × capacity)^λ × taste.
  const sci = sciOn(s, n.id);
  if (sci.cap > 0) {
    const b = n.kind === 'line' ? batchOf(inp.X) : 1;
    st.idea += (Math.pow(inp.mIdeas * sci.cap, P.lam) * sci.q * inp.speed) / (sg.idea * b * 30);
    let guard = 0;
    while (st.idea >= 1 && guard++ < 8) {
      st.idea -= 1;
      addCandidate(st, newCandidate(s, n, st, sci.q, b), kappa);
    }
    st.idea = Math.min(st.idea, 1);
  }
  // 2–3 Experiments: the experiment CES of the project's FLOP and research-engineer labour (team-months per day at unit
  // inputs: √RE_LABOUR_UNIT / 30, as one pair of teams). Work left over when a stage ends carries into the next one the same day.
  const rate = experimentRate(s, inp, p13, reCap, flopDay);
  let time = 1;
  let used = 0;
  for (let guard = 0; guard < 6 && time > 1e-9; guard++) {
    if (!st.test && st.cands.length >= PICK_AT) {
      const i = pickCandidate(st.cands, kappa);
      const cand = st.cands.splice(i, 1)[0];
      repool(s, n, st, cand);
      st.test = startTest(s, n, cand);
      st.stage = 'small';
    }
    const t = st.test;
    if (!t) {
      st.stage = 'ideation';
      break;
    }
    if (rate <= 0) break;
    t.flopNeed = t.flop + (Math.max(0, t.workNeed - t.work) / rate) * flopDay; // expected FLOP of the stage (readout)
    const need = Math.max(0, t.workNeed - t.work);
    const dt = need <= 1e-12 ? 0 : need / rate;
    const step = Math.min(time, dt);
    t.work = dt > time ? t.work + rate * time : t.workNeed;
    t.flop += flopDay * step;
    used += flopDay * step;
    time -= step;
    if (t.work < t.workNeed - 1e-12) break;
    if (!resolveStage(s, ctx, n, st, t, queueBuild)) break;
  }
  return used;
}

/** A test stage's work is done: read the result and move on. Returns true if the project can keep testing today (a line,
 *  or a dropped candidate of a project still running). */
function resolveStage(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: CapProjectState, t: NonNullable<CapProjectState['test']>, queueBuild: (tw: number) => string): boolean {
  const spec = st.spec ?? 0;
  const sg = stagesOf(n);
  const c = t.c;
  const per = priorMean(s, n, c, spec);
  const pub = per * c.b;
  const truth = candidateTruth(s, n, st, c);
  if (st.stage === 'small') {
    // Small experiments: a reading of x narrows the belief.
    const se = Math.sqrt(c.b) * per * EXP_NOISE;
    const y = truth.x + se * Z(s, `ce:${n.id}:${spec}:${c.k}`);
    const w1 = 1 / (c.sd * c.sd);
    const w2 = 1 / (se * se);
    c.mu = (c.mu * w1 + y * w2) / (w1 + w2);
    c.sd = Math.sqrt(1 / (w1 + w2));
    if (c.mu < DROP_FRAC * pub) return !dropTest(s, ctx, n, st, 'small experiments showed too little');
    st.stage = 'scale';
    st.test = { c, work: 0, workNeed: sg.scale * c.b, flop: 0, flopNeed: 0, fTest: t.fTest };
    return true;
  }
  // Scale test: reads the effect at test scale and the scale exponent.
  const at = atTest(n, c, truth);
  const xT = at.xTest * (1 + TEST_READ_SD * Z(s, `ct:${n.id}:${spec}:${c.k}`));
  const sHat = at.s + S_READ_SD * Z(s, `cs2:${n.id}:${spec}:${c.k}`);
  c.muS = sHat;
  c.sdS = S_READ_SD;
  // A batch keeps its surviving ideas; a single idea must hold at scale.
  if ((!at.batch && xT < SURVIVE_FRAC * c.mu) || xT < DROP_FRAC * pub * (at.batch ? at.xTest / Math.max(1e-12, truth.x) : 1)) {
    return !dropTest(s, ctx, n, st, 'the effect did not hold at scale');
  }
  // 4 Result: the estimate at the lab's latest base.
  const ratio = Math.log10(Math.max(1, latestBaseFlop(s) / t.fTest));
  const est = xT * Math.pow(10, sHat * ratio);
  const estSd = Math.abs(est) * Math.sqrt(TEST_READ_SD * TEST_READ_SD + Math.pow(S_READ_SD * Math.LN10 * ratio, 2));
  const result: CapResult = { c, xTest: xT, sHat, fTest: t.fTest, est, estSd, day: ctx.day };
  delete st.test;
  if (n.kind === 'line') {
    (st.pending ??= []).push(result);
    queueAdoption(n, st, queueBuild);
    st.gen += c.b;
    // The line's pool advances by what the result delivers (V3 notes, derivation 1): R ← R·10^(x/r_l) with x its true
    // effect at test scale, so the line's realised stack is exactly r_l·log₁₀(R/n₀) however good the picked candidates
    // are (selection and scale survival only change how fast the pool ages, not the returns). The research input it took
    // is kept for the readout.
    const pl = linePool(s, n);
    st.pool = (pl.n0 + (st.pool ?? 0)) * Math.pow(10, Math.max(0, at.xTest) / pl.r) - pl.n0;
    st.input = (st.input ?? 0) + c.b * c.q;
    st.drops = 0;
    st.stage = 'ideation';
    return true;
  }
  st.result = result;
  st.stage = 'result';
  s.player.tree[n.id].progress = 1;
  ctx.log('research', `${n.name} works: estimated ${fmtEst(n, est, estSd)}. The engineers are building it in.`, 2, n.id);
  queueAdoption(n, st, queueBuild);
  return false;
}

const fmtEst = (n: TreeNodeDef, est: number, sd: number) => (n.effect?.stack ? `${est.toFixed(3)} ± ${sd.toFixed(3)} OOM` : n.effect?.domains ? `×${est.toFixed(2)} of the expected effect` : 'it unlocks');

/** Progress readout of a project (0..1 of the current stage chain) for the tree's progress ring. */
export function capProgress(st: CapProjectState | undefined): number {
  if (!st) return 0;
  if (st.stage === 'result' || st.stage === 'adopting') return 1;
  if (st.stage === 'failed') return 0;
  const t = st.test;
  const frac = (x: number, y: number) => (y > 0 ? Math.min(1, x / y) : 1);
  if (!t) return (0.33 * Math.min(PICK_AT, st.cands.length + st.idea)) / PICK_AT;
  const tp = frac(t.work, t.workNeed);
  return st.stage === 'small' ? 0.33 + 0.33 * tp : 0.66 + 0.34 * tp;
}

/** The research readouts' daily step (RD-B16), on every research day after the projects and tuning.
 *  Software progress (gRate, OOM/day, a 14-day average): the Research view's OOM/year and the input of production.ts
 *  `rate` (until RD-L03): the change since the last research day of the lab's research recipe G (stacks.ts researchG:
 *  no public knowledge), both ends at the last day's base FLOP, so a new, bigger base does not count; adopted ideas
 *  (engineers' build system, 38) and tuning do. Public knowledge (pubRate, OOM/day, a 14-day average): the change of the
 *  stacks' bases since the last research day (diffusion, C4 tacit knowledge, safety spillover). */
export function softwareProgressDay(s: GameStateV2) {
  const res = s.player.research;
  if (res.gLast !== undefined && res.gLastF !== undefined) { // an older save's gLast was the whole G: restart there
    const d = researchG(s, res.gLastF) - res.gLast;
    res.gRate = (res.gRate ?? 0) + (Math.max(0, d) - (res.gRate ?? 0)) / 14;
  }
  res.gLastF = latestBaseFlop(s);
  res.gLast = researchG(s, res.gLastF);
  const pub = publicBase(s);
  if (res.pubLast !== undefined) res.pubRate = (res.pubRate ?? 0) + (pub - res.pubLast - (res.pubRate ?? 0)) / 14;
  res.pubLast = pub;
}

/** One day of capability research: assignment, research engineers, every ready project's lifecycle, routine tuning,
 *  the readouts. `ready` = capability projects in priority order that can take teams today. */
export function capResearchDay(s: GameStateV2, ctx: SystemCtx, ready: string[], queueBuild: (id: string, tw: number) => string, p13Payoff = 0) {
  const p = s.player;
  assignCapTeams(s, ready);
  const alloc = reAllocation(s);
  // Model v3 D7: eval suites take their research engineers (the 'evals' need) and their inference compute from the
  // experiments pool before the projects.
  const pool = expPoolH100e(s);
  const evH = evalsDay(s, ctx, alloc.re.evals, Math.max(1, workContext(s).slots.EXP.m), pool);
  const avail = projectFlopPerDay(s) * (pool > 0 ? Math.max(0, 1 - evH / pool) : 1);
  const p13 = p13Mult(s, p13Payoff);
  // Experiment FLOP by need (RD-B08): each project in experiments a full share, routine tuning what is left.
  const sh = expShares(alloc, avail);
  // The unit project's inputs: a full project's share (RE_MAX_PER_PROJECT of the needs' units; the whole pool for the first
  // project when nothing else wants FLOP).
  const inp = researchInputs(s, Math.max(sh.units, RE_MAX_PER_PROJECT), avail, p13);
  let used = 0;
  for (const id of ready) {
    const n = node(id) as TreeNodeDef;
    // A test that starts today gets research engineers (and FLOP) from tomorrow's allocation.
    const re = alloc.perProject.get(id) ?? 0;
    used += stepProject(s, ctx, n, inp, p13, re, sh.perProject.get(id) ?? 0, (tw) => queueBuild(id, tw));
    const ts = p.tree[id];
    if (ts?.cap) ts.progress = capProgress(ts.cap);
  }
  // Routine tuning: the same CES on the tuning allocation (V3.4), at its FLOP per RE_LABOUR_UNIT; headroom closes at TUNE_K ×
  // its experiment throughput.
  const tune = alloc.re.tune;
  if (tune > 0) {
    const Pp = s.hidden.timeline.prod;
    const Xt = Xces(Pp, Math.max(1e-12, ((sh.tune / tune) * RE_LABOUR_UNIT * p13) / C_UNIT_FLOP_PER_DAY), inp.l) * inp.speed;
    tuneDay(s, TUNE_K * tune * Xt);
    used += sh.tune;
  }
  softwareProgressDay(s);
  const g = stacksGEquiv(s);
  p.research.last = {
    re: { ops: r3(alloc.re.ops), evals: r3(alloc.re.evals), exp: r3(alloc.re.exp), tune: r3(alloc.re.tune) },
    opsServed: opsServed(alloc),
    reProj: Object.fromEntries([...alloc.perProject.entries()].map(([k, v]) => [k, r3(v)])),
    flopProj: Object.fromEntries(sh.perProject), flopUsed: used, flopAvail: avail,
    x: { c: r3(inp.c), l: r3(inp.l), X: r3(inp.X), mExp: r3(inp.mExp), mIdeas: r3(inp.mIdeas) },
  };
  if (ctx.day % 7 === 0) {
    const h = p.research.hist;
    h.push({ day: ctx.day, g: Math.round(g * 1e4) / 1e4, n: STACK_KEYS.reduce((a, k) => a + p.research.stacks[k].n, 0) });
    if (h.length > 14) h.splice(0, h.length - 14);
  }
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Reopen a failed project as speculative: half the odds, a lower and wider prior (each time). */
export function reopenProject(s: GameStateV2, id: string): string | undefined {
  const n = node(id);
  const ts = s.player.tree[id];
  if (!n || !isCapProject(n) || n.kind === 'line') return 'Only ideas and axes can be reopened';
  if (!ts || ts.status !== 'failed') return 'Only a failed project can be reopened';
  const spec = (ts.cap?.spec ?? 0) + 1;
  ts.status = 'researching';
  ts.progress = 0;
  ts.attempts = (ts.attempts ?? 1) + 1;
  delete ts.retryDay;
  ts.cap = freshCap(spec);
  return undefined;
}

/** Recent growth of the stacks: OOM (G-equivalent) and ideas adopted per day over the last samples (readout for the
 *  Blueprint's "adopted while it trains"). */
export function stackRate(s: GameStateV2): { oomPerDay: number; ideasPerDay: number } {
  const h = s.player.research.hist;
  if (h.length < 2) return { oomPerDay: 0, ideasPerDay: 0 };
  const a = h[0];
  const b = h[h.length - 1];
  const d = Math.max(1, b.day - a.day);
  return { oomPerDay: Math.max(0, (b.g - a.g) / d), ideasPerDay: Math.max(0, (b.n - a.n) / d) };
}

export { TREE };
