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
//                   Drop rule (RD-R06, dropRule): a score (μ + κσ) under DROP_FRAC × the prior mean drops the candidate
//                   only if something left in the pool scores better; otherwise it goes on.
//   3 scale test    the same CES; it reads the effect at test scale (x·1000^s) and the scale exponent s. Below
//                   SURVIVE_FRAC of the small-scale estimate (or the floor): dropped, again only if the pool holds better.
//   4 result        the final estimate band at the lab's latest base. Ideas and axes: the team gives up after MAX_DROPS
//                   dropped candidates in one attempt (weak candidates can be noise, so the odds stand) and the project
//                   can be reopened as speculative (a new attempt, its drop count back at 0).
//   5 adoption      the engineers build it in (team-weeks ∝ effect); then the TRUE effect enters its stack (models/
//                   stacks.ts; all of it at once, RD-E03), an axis's lever unlocks, a domain effect applies.
// Unlock projects (RD-R05: ideas and axes without a typed effect) skip 1–4: one test ('test', stepTrial) of the project's
// stage work by its science teams and the experiment CES together, then the works() draw: build-in, or failed (reopen).
// Lines repeat. Each line is a pool with returns r (V3 notes, derivation 1): the result that brings research input q (its
// team's taste × the ideas it batches) to a pool at state R has prior mean r_l·log₁₀((R + q)/R), so the line's stack is
// r_l·log₁₀ of its cumulative research input (AI Futures' SE = r·log₁₀ RS).
// Experiment FLOP is real: the experiments pool (plus idle training compute, R5) is shared by the projects in experiments
// (a full share each that has research engineers, RD-B08), and consumed while they run.
//
// Allocation without micromanagement (V2.5): capability science teams go down the priority list (teams wanted per
// project, best specialty first; a one-off idea in its tests releases its teams), then one pass of pairwise swaps that
// raise the total expected value (RD-A03 projectValue: expected OOM per day), then each spare team where it adds the most
// value (auto projects first) under PROJECT_MAX_TEAMS. Research engineers serve needs in the player's order (run
// operations → project experiments by priority → routine tuning), with optional caps; overflow flows down.
import {
  BELIEF_NOISE, CAND, DROP_FRAC, DUD_SD, EXP_NOISE, IDEA_DEFAULT_TM, IDEA_STAGES, LINE_FIT, LINE_STAGES, MAX_DROPS, PACE_BATCH,
  AUTO_RANK_W, PICK_AT, POOL_MAX, PROJECT_MAX_TEAMS, PROJECT_SD, RE_OPS, RE_MAX_PER_PROJECT, RISK_KAPPA, SMALL_TO_TEST,
  SPECULATIVE, SURVIVE_FRAC, S_RANGE, S_READ_SD, TASTE_MEAN, TEST_READ_SD, ADOPT_TW, VALUE_PROXY,
} from '../../../data/v2/research';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { C_UNIT_FLOP_PER_DAY, RE_LABOUR_UNIT } from '../../../data/v2/workTypes';
import { EFFORT_TM, PROJECT_BY_ID, TREE, type EffortClass, type TreeNodeDef } from '../../../data/v2/tree';
import { AGENDA_BY_ID, SAF_STAGES } from '../../../data/v2/agendas';
import { COLUMN_DEPT } from '../../../data/v2/teams';
import { hash32 } from '../core/rng';
import { reCapacity, teamCapacity } from '../departments/capacity';
import type {
  AgendaId, Allocation, CapProjectState, CapResult, Candidate, GameStateV2, ReNeed, StackKey, SystemCtx, Team,
} from '../types';
import { poolsOf } from '../compute/power';
import { Phi, Xces } from '../production/ces';
import { qualityZ, researchMods, starTaste, teamTaste, workContext } from '../departments/workfit';
import { PARADIGM_BY_ID } from './paradigms';
import { idleTrainingShare } from './runs';
import { evalReDemand, evalsDay } from './evals';
import { addSuiteExpertData } from './suites';
import { addIdea, latestBaseFlop, publicBase, researchG, STACK_KEYS, trainNow, stacksGEquiv } from './stacks';
import { steerAdoption } from '../safety/covert';
import { trueEfficacy } from '../safety/common';

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
 *  measured at). Ideas and axes split their effortTM, the whole stage work (PICK_AT × idea + small + scale; RD-R07). */
export function stagesOf(n: TreeNodeDef): { idea: number; small: number; scale: number; testFrac: number } {
  if (n.kind === 'line') return LINE_STAGES;
  const E = n.effortTM ?? IDEA_DEFAULT_TM;
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
    qw += c * teamTaste(qualityZ(t.quality), wc.sdAI, wc.sAI, m2b, star);
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
  const b = 1; // RD-R08: every candidate is one idea (the flow runs at the same rates)
  const speed = researchMods(s).speed;
  if (isUnlockProject(n)) {
    // RD-R05: one test, science teams and the experiment CES on the same work.
    const left = st?.trial ? Math.max(0, st.trial.workNeed - st.trial.work) : trialWork(n) * (1 - (st ? capProgress(st) : 0));
    const { X } = projectExpInputs(s, id);
    const rate = sciWorkRate(s, x?.mIdeas ?? 1, sci, speed) + (X > 0 ? (X * speed * Math.sqrt(RE_LABOUR_UNIT)) / 30 : 0);
    const experiments = rate > 0 ? left / rate : Infinity;
    return { ideation: 0, experiments, eta: experiments };
  }
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
    return { sci: SAF_STAGES.idea * T1, exp: (SAF_STAGES.small + SAF_STAGES.val) * T1, unit: 'months' };
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
export const takesTeams = (st: CapProjectState | undefined) => !st || st.stage === 'ideation' || st.stage === 'small' || st.stage === 'scale' || st.stage === 'test';

/** RD-R05 (CAP-13, DD-14): an unlock project (an idea or axis without a typed effect: RL focus nodes, options, features'
 *  nodes) runs one "does it work" test instead of the idea pipeline: no candidates, no effect band. */
export const isUnlockProject = (n: TreeNodeDef | undefined): boolean => !!n && isCapProject(n) && n.kind !== 'line' && !hasTypedEffect(n);
/** An unlock project's test work (team-months at unit inputs): the project's whole stage work (stagesOf, = effortTM). */
export const trialWork = (n: TreeNodeDef) => {
  const sg = stagesOf(n);
  return PICK_AT * sg.idea + sg.small + sg.scale;
};
/** Science teams' work per day on a project (team-months at unit inputs: (m_IDEAS × capacity)^λ × taste × speed / 30). */
const sciWorkRate = (s: GameStateV2, mIdeas: number, sci: { cap: number; q: number }, speed: number) =>
  sci.cap > 0 ? (Math.pow(Math.max(1e-12, mIdeas * sci.cap), s.hidden.timeline.prod.lam) * sci.q * speed) / 30 : 0;
/** An unlock project's test state, started (or restated from an older save's idea pipeline at its progress) on first use. */
function trialOf(n: TreeNodeDef, st: CapProjectState): NonNullable<CapProjectState['trial']> {
  if (!st.trial) {
    const W = trialWork(n);
    const done = st.stage === 'ideation' || st.stage === 'small' || st.stage === 'scale' ? capProgress(st) : 0;
    st.trial = { work: done * W, workNeed: W, flop: 0 };
    st.cands = [];
    st.idea = 0;
    delete st.test;
    st.stage = 'test';
  }
  return st.trial;
}

// ───────────────────────────── allocation: scientists (V2.5) ─────────────────────────────

/** B4: whether a project's teams wanted is "auto". */
export const wantIsAuto = (s: GameStateV2, id: string) => !!s.player.research.wantAuto?.includes(id);
/** Teams wanted for a project (default 1; an auto project asks for 1 in the first pass and takes spare teams after). */
export const teamsWanted = (s: GameStateV2, id: string) => Math.max(0, Math.min(PROJECT_MAX_TEAMS, Math.round(s.player.research.want[id] ?? 1)));

/** RD-A03 (CAP-08): a one-off idea (typed effect, not a line) in its small or big test releases its science teams: new
 *  candidates only matter after a drop, so the teams go elsewhere (lines keep ideating; an unlock's test uses them). */
export const releasesTeams = (n: TreeNodeDef | undefined, st: CapProjectState | undefined): boolean =>
  !!n && n.kind !== 'line' && !isUnlockProject(n) && (st?.stage === 'small' || st?.stage === 'scale');

/** Lab-wide inputs of the planner's value (read once per plan): m_IDEAS, research speed, the unit throughput X (a line's
 *  batch) and an unlock's experiment work per day (as capEta, from the research-engineer allocation). */
function valueEnv(s: GameStateV2) {
  const x = s.player.research.last?.x;
  const speed = researchMods(s).speed;
  let alloc: ReAllocation | undefined;
  return {
    mIdeas: Math.max(1e-12, x?.mIdeas ?? 1),
    speed,
    X: x?.X ?? 1,
    expRate: (id: string) => {
      alloc ??= reAllocation(s);
      const { X } = projectExpInputs(s, id, alloc);
      return X > 0 ? (X * speed * Math.sqrt(RE_LABOUR_UNIT)) / 30 : 0;
    },
  };
}

/** Each team's taste (as sciOn: E[max(human, AI)] on the AIFM taste distribution; 1 = a Strong team without AI). */
function tasteOf(s: GameStateV2): (t: Team) => number {
  const wc = workContext(s);
  const m2b = s.hidden.timeline.prod.m2b;
  const star = starTaste(s);
  return (t) => teamTaste(qualityZ(t.quality), wc.sdAI, wc.sAI, m2b, star);
}

/** A result's value in lab-wide software OOM: a stack effect's OOM (with its `also` stacks); a domain effect's OOM ×
 *  VALUE_PROXY.domainOom; a data / expert-data effect VALUE_PROXY.unlock × its size multiplier [D]. */
const valueOom = (n: TreeNodeDef, x: number) =>
  n.effect?.stack ? oomOf(n, x) : n.effect?.domains ? oomOf(n, x) * VALUE_PROXY.domainOom : Math.abs(x) * VALUE_PROXY.unlock;

/** RD-A03 (CAP-08): a project's term in the science-team planner, the expected value it delivers per day (lab-wide
 *  software OOM; VALUE_PROXY for domain, data and unlock effects [D]) as a function of the science capacity C on it and
 *  the teams' capacity-weighted taste q. Ideation runs at (m_IDEAS·C)^λ × q × speed per team-month of ideation work, as
 *  stepProject runs it:
 *  - a line: candidates per day × the pool's prior mean of a batch (each result is tested and adopted);
 *  - a one-off idea in ideation: candidates per day ÷ PICK_AT (one result per PICK_AT candidates) × the attempt's odds ×
 *    the prior mean (taste lifts it); in its small or big test 0 (releasesTeams);
 *  - an unlock: its share of the test work per day (science teams + the experiment CES) × odds × VALUE_PROXY.unlock.
 *  m_IDEAS and speed are lab-wide (they scale every term alike); they are in so that the value is in real units. */
export function projectValue(s: GameStateV2, id: string, env = valueEnv(s)): (cap: number, q: number) => number {
  const n = node(id);
  const st = s.player.tree[id]?.cap;
  if (!n || !isCapProject(n) || releasesTeams(n, st) || st?.stage === 'adopting' || st?.stage === 'failed') return () => 0;
  const lam = s.hidden.timeline.prod.lam;
  const work = (cap: number, q: number) => (cap > 0 ? (Math.pow(env.mIdeas * cap, lam) * q * env.speed) / 30 : 0);
  const spec = st?.spec ?? 0;
  const odds = attemptOdds(n, spec);
  if (isUnlockProject(n)) {
    const exp = env.expRate(id);
    const v = (odds * VALUE_PROXY.unlock) / trialWork(n);
    return (cap, q) => (work(cap, q) + exp) * v;
  }
  const sg = stagesOf(n);
  if (n.kind === 'line') {
    // RD-R08: one idea per candidate; the flow runs the same ideas in expectation.
    return (cap, q) => (cap > 0 ? (work(cap, q) / sg.idea) * valueOom(n, priorMean(s, n, { q })) : 0);
  }
  return (cap, q) => (cap > 0 ? (work(cap, q) / (sg.idea * PICK_AT)) * odds * valueOom(n, priorMean(s, n, { q }, spec)) : 0);
}

/** Value of an assignment: Σ over projects of projectValue at the capacity and taste the teams give it (expected OOM per
 *  day). */
export function assignmentValue(s: GameStateV2, projects: string[], teams: { t: Team; p: string | undefined }[]): number {
  const env = valueEnv(s);
  const taste = tasteOf(s);
  let v = 0;
  for (const id of projects) {
    const n = node(id);
    if (!n) continue;
    let cap = 0;
    let qw = 0;
    for (const x of teams) {
      if (x.p !== id) continue;
      const c = teamCapacity(x.t, n.column);
      cap += c;
      qw += c * taste(x.t);
    }
    v += projectValue(s, id, env)(cap, cap > 0 ? qw / cap : 1);
  }
  return v;
}

/** "adds ~x% to this project's yearly gain": what a team adds to its project's expected value (player language). */
function gainText(withT: number, without: number): string {
  if (without > 1e-15) {
    const x = withT / without - 1;
    return `adds ~${x < 0.01 ? '<1' : Math.round(100 * x)}% to this project's yearly gain`;
  }
  return withT > 0 ? "carries all of this project's yearly gain" : 'adds nothing to this project for now';
}

/** Deterministic assignment of capabilities science teams to the ready projects (in priority order). Returns the team
 *  → project map and why each team is there; teams placed by hand stay. Pure (does not mutate the state).
 *  RD-A03: the priority list and teams wanted are the player's controls; value (projectValue, expected OOM per day)
 *  decides the swaps and the spare teams. A one-off idea in its tests releases its teams (releasesTeams). */
export function planAssignment(s: GameStateV2, ready: string[]): Map<string, { p?: string; why: string }> {
  const out = new Map<string, { p?: string; why: string }>();
  const all = capSciTeams(s);
  const manual = all.filter((t) => t.manual && t.projectId && ready.includes(t.projectId));
  for (const t of manual) out.set(t.id, { p: t.projectId, why: 'Placed by hand' });
  const pool = all.filter((t) => !out.has(t.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const count = new Map<string, number>(ready.map((id) => [id, manual.filter((t) => t.projectId === id).length]));
  const released = new Set(ready.filter((id) => releasesTeams(node(id), s.player.tree[id]?.cap)));
  const left = [...pool];
  // Why each placed team is there (the value part is added at the end, on the final assignment).
  const kind = new Map<string, string>();
  // 1. Down the list: each project up to its teams wanted, best specialty match (then capacity) first.
  ready.forEach((id, rank) => {
    if (released.has(id)) return;
    const n = node(id) as TreeNodeDef;
    const auto = wantIsAuto(s, id);
    let need = (auto ? 1 : teamsWanted(s, id)) - (count.get(id) ?? 0);
    while (need > 0 && left.length) {
      left.sort((a, b) => teamCapacity(b, n.column) - teamCapacity(a, n.column) || (a.id < b.id ? -1 : 1));
      const t = left.shift() as Team;
      out.set(t.id, { p: id, why: '' });
      kind.set(t.id, `Priority ${rank + 1}: ${n.name} ${auto ? 'is on auto (first team)' : `wants ${teamsWanted(s, id)} team${teamsWanted(s, id) === 1 ? '' : 's'}`}`);
      count.set(id, (count.get(id) ?? 0) + 1);
      need--;
    }
  });
  // 2. One improvement pass: swap two teams on different projects when that raises the total expected value.
  //    Capacities and tastes are precomputed; each row's term is recomputed only for the two projects a swap touches
  //    (the same ordered sum), the total re-added in row order.
  const placed = pool.filter((t) => out.get(t.id)?.p);
  const ents = all.map((t) => out.get(t.id));
  const env = valueEnv(s);
  const tq = all.map(tasteOf(s));
  const capRows: { id: string; cap: number[]; f: (cap: number, q: number) => number }[] = [];
  for (const id of ready) {
    const n = node(id);
    if (n) capRows.push({ id, cap: all.map((t) => teamCapacity(t, n.column)), f: projectValue(s, id, env) });
  }
  const sums = (row: (typeof capRows)[number], skip = -1) => {
    let cap = 0;
    let qw = 0;
    for (let k = 0; k < ents.length; k++) if (k !== skip && ents[k]?.p === row.id) { cap += row.cap[k]; qw += row.cap[k] * tq[k]; }
    return { cap, q: cap > 0 ? qw / cap : 1 };
  };
  const term = (row: (typeof capRows)[number], skip = -1) => {
    const x = sums(row, skip);
    return row.f(x.cap, x.q);
  };
  const terms = capRows.map((r) => term(r));
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
      if (after > before * (1 + 1e-9)) {
        before = after;
        kind.set(placed[i].id, `Swapped onto ${node(a.p as string)?.name}: a better fit`);
        kind.set(placed[j].id, `Swapped onto ${node(b.p as string)?.name}: a better fit`);
      } else {
        b.p = a.p;
        a.p = pa;
        retouch(pa, pb);
      }
    }
  }
  // 3. Leftovers: each spare team where it adds the most expected value (× AUTO_RANK_W per rank), auto projects first,
  //    then any project under PROJECT_MAX_TEAMS; where none gains (every project full or released), idle.
  const rowOf = new Map(capRows.map((r) => [r.id, r]));
  for (const t of left) {
    const k = all.indexOf(t);
    let best: (typeof capRows)[number] | undefined;
    let bestGain = 0;
    for (const autosFirst of [true, false]) {
      for (const r of capRows) {
        if (wantIsAuto(s, r.id) !== autosFirst || released.has(r.id) || (count.get(r.id) ?? 0) >= PROJECT_MAX_TEAMS) continue;
        const x = sums(r);
        const c1 = x.cap + r.cap[k];
        const gain = (r.f(c1, c1 > 0 ? (x.cap * x.q + r.cap[k] * tq[k]) / c1 : 1) - r.f(x.cap, x.q)) * AUTO_RANK_W ** ready.indexOf(r.id);
        if (gain > bestGain) { best = r; bestGain = gain; }
      }
      if (best) break;
    }
    if (!best) {
      const full = ready.every((id) => released.has(id) || (count.get(id) ?? 0) >= PROJECT_MAX_TEAMS);
      out.set(t.id, { why: full ? 'Idle: every ready project has the most teams it can use or is in its tests' : 'Idle: no ready project gains from another team' });
      continue;
    }
    count.set(best.id, (count.get(best.id) ?? 0) + 1);
    const e = { p: best.id, why: '' };
    out.set(t.id, e);
    ents[k] = e;
    const name = node(best.id)?.name;
    const rank = ready.indexOf(best.id) + 1;
    kind.set(t.id, wantIsAuto(s, best.id) ? `Auto: ${name} (priority ${rank}) gains the most from it` : `Spare: every project has its teams wanted; ${name} (priority ${rank}) gains the most from it`);
  }
  // Why here, in player language: what the team adds to its project's expected yearly gain.
  for (let k = 0; k < all.length; k++) {
    const t = all[k];
    const e = ents[k];
    const pre = kind.get(t.id);
    if (!e?.p || pre === undefined) continue;
    const row = rowOf.get(e.p);
    const spec = t.specialty === node(e.p)?.column ? ' (its specialty)' : '';
    e.why = row ? `${pre}${spec}; ${gainText(term(row), term(row, k))}` : `${pre}${spec}`;
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
  return !!st && (!!st.test || st.stage === 'test');
});

/** Today's research-engineer demand per need (human team-equivalents) at the AI labour multiplier m on experiments: run
 *  operations ÷ m, the eval suites (model v3 D7, models/evals.ts), RE_MAX_PER_PROJECT per project in experiments. Every need
 *  is finite; spare research engineers are idle (RD-E03: no routine tuning). */
export function reDemand(s: GameStateV2, m = Math.max(1, workContext(s).slots.EXP.m)): Record<ReNeed, number> {
  return {
    ops: reOpsNeed(s) / m, evals: evalReDemand(s, m), exp: experimenting(s, s.player.research.queue).length * RE_MAX_PER_PROJECT,
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

/** Experiment FLOP by need (RD-B08), not by headcount: the pool is divided over RE_MAX_PER_PROJECT for each project in
 *  experiments. A project with research engineers takes its full share; a project with none leaves its share unused
 *  (RD-E03: no routine tuning to take it). So more research engineers never take FLOP from a project. units = the
 *  demands' team-equivalents the pool is divided over. */
export function expShares(alloc: ReAllocation, avail: number): { units: number; perProject: Map<string, number> } {
  const units = alloc.perProject.size * RE_MAX_PER_PROJECT;
  const per = units > 0 ? Math.max(0, avail) / units : 0;
  const perProject = new Map<string, number>();
  for (const [id, re] of alloc.perProject) perProject.set(id, re > 0 ? RE_MAX_PER_PROJECT * per : 0);
  return { units, perProject };
}

// ───────────────────────────── research inputs in physical units (V3.4) ─────────────────────────────

/** Experiment FLOP the lab's research can use per day: the experiments pool (and idle training compute unless the
 *  policy sends it to data, R5) at today's training throughput. */
export function projectFlopPerDay(s: GameStateV2): number {
  return expPoolH100e(s) * PHI_FLOP_PER_H100E_DAY * Math.pow(10, trainNow(s));
}
/** H100e of the experiments pool (and idle training compute unless the policy sends it to data) today. */
export function expPoolH100e(s: GameStateV2): number {
  const pools = poolsOf(s);
  const idle = s.player.policies.spareTraining !== 'data' ? idleTrainingShare(s) * pools.training : 0;
  return pools.experiments + idle;
}

/** The lab's research inputs today: labour multipliers (AI in experiments and in ideas), the speed modifiers (pauses,
 *  treaty, siloing, migrations), the experiment FLOP per RE_LABOUR_UNIT of `reRes` (capResearchDay passes the needs' units of
 *  expShares, so c is a full project's) and the X of a unit project. */
export interface ResearchInputs { mExp: number; mIdeas: number; speed: number; flopDay: number; reRes: number; c: number; l: number; X: number }
export function researchInputs(s: GameStateV2, reRes: number, flopDay = projectFlopPerDay(s)): ResearchInputs {
  const wc = workContext(s);
  const P = s.hidden.timeline.prod;
  const mExp = wc.slots.EXP.m;
  const mIdeas = wc.slots.IDEAS.m;
  const speed = researchMods(s).speed;
  const units = Math.max(1e-9, reRes / RE_LABOUR_UNIT);
  const c = flopDay / units / C_UNIT_FLOP_PER_DAY;
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

/** RD-R06 drop rule (CAP-09). After a test reading the candidate is dropped only when BOTH hold:
 *  (a) its updated score (μ + κσ, the score pickCandidate uses) is under the absolute floor (`underFloor`: DROP_FRAC × the
 *      prior mean after small experiments; SURVIVE_FRAC of the small-scale estimate or the floor after the scale test);
 *  (b) it is under the best remaining alternative in the pool (`alts`: the pool's scores, at the same scale).
 *  An empty pool counts as "a fresh idea is better" (a fresh idea's prior mean is above the floor), so (a) alone decides.
 *  Doing nothing is always an alternative: a score ≤ 0 under the floor is dropped whatever the pool holds.
 *  Otherwise the candidate goes on: a weak candidate that still beats everything left is never thrown away. A dropped
 *  candidate just goes (it is not kept as "tested, weak"). */
export function dropRule(score: number, underFloor: boolean, alts: number[]): boolean {
  if (!underFloor) return false;
  return score <= 0 || alts.length === 0 || score < Math.max(...alts);
}

/** Player text when the team gives up on an idea or axis: the drops, the last reason and the odds still standing (this
 *  attempt's odds; a reopen tries at `reopenOdds`). Weak readings can be noise, so it never says the direction fails. */
export function giveUpText(name: string, why: string, odds: number, reopenOdds: number): string {
  const pc = (x: number) => `${Math.round(x * 100)}%`;
  return `${name}: the team gave up after ${MAX_DROPS} weak candidates (last: ${why}). Weak results can be bad luck: the chance it works is still ${pc(odds)}. Reopening as speculative tries again at ${pc(reopenOdds)}.`;
}

/** Drop the candidate in test; the team gives up on an idea after MAX_DROPS in one attempt (reopenProject starts a new
 *  attempt at 0 drops). Returns true if the project failed. */
function dropTest(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: CapProjectState, why: string): boolean {
  delete st.test;
  st.drops += 1;
  st.stage = 'ideation';
  if (n.kind !== 'line' && st.drops >= MAX_DROPS) {
    st.stage = 'failed';
    const ts = s.player.tree[n.id];
    ts.status = 'failed';
    ts.day = ctx.day;
    const spec = st.spec ?? 0;
    ctx.log('research', giveUpText(n.name, why, attemptOdds(n, spec), attemptOdds(n, spec + 1)), 2, n.id);
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
  if (st.trial?.buildId === buildId) {
    // RD-R05: an unlock's build-in: the lever unlocks (no effect enters a stack).
    delete st.trial;
    ts.status = 'known';
    ts.day = ctx.day;
    onKnown(id);
    ctx.log('research', `${n.name} is built into the lab's recipe.`, 2, id);
    return;
  }
  const r = n.kind === 'line' ? st.pending?.find((x) => x.buildId === buildId) : st.result?.buildId === buildId ? st.result : undefined;
  if (!r) return;
  // RD-R08: a flow result carries its true (expected) effect; a candidate's is recomputed from the seed.
  const truth0 = r.flow ? { x: r.flow.x, s: r.flow.s } : candidateTruth(s, n, st, r.c);
  const at = r.flow ? { xTest: r.flow.x, s: r.flow.s, batch: false } : atTest(n, r.c, truth0);
  const truth = { x: truth0.x, s: at.s };
  const count = r.flow ? r.flow.n : r.c.b;
  const res = s.player.research;
  const eff = n.effect;
  const xTest = at.xTest;
  // Model v3 E7: the models doing the lab's R&D may steer the build toward their own ends (safety/covert.ts STEER): the
  // full effect still lands; an uncaught act adds hidden CoT pressure to later runs. Nothing the lab sees changes.
  if (eff?.stack || eff?.domains) steerAdoption(s, ctx, `${id}:${buildId}`, eff.stack ? xTest : 0);
  let realised = 0;
  if (eff?.stack) {
    // RD-B17: a batch counts its b ideas; the second stack an idea also moves adds no idea.
    addIdea(res.stacks[eff.stack], xTest, truth.s, r.fTest, count);
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
    res.adopted.push({ id, name: n.name, ...where, ...(count !== 1 ? { b: Math.round(count * 10) / 10 } : {}), eff: Math.round(realised * 1e4) / 1e4, est: Math.round(r.est * 1e4) / 1e4, estSd: Math.round(r.estSd * 1e4) / 1e4, s: Math.round(truth.s * 1000) / 1000, day: ctx.day });
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
export function experimentRate(s: GameStateV2, inp: Pick<ResearchInputs, 'mExp' | 'speed'>, re: number, flopDay: number): number {
  if (re <= 0 || flopDay <= 0) return 0;
  const P = s.hidden.timeline.prod;
  const l = Math.pow(Math.max(1e-12, (inp.mExp * re) / RE_LABOUR_UNIT), P.lam);
  return (Xces(P, flopDay / C_UNIT_FLOP_PER_DAY, l) * inp.speed * Math.sqrt(RE_LABOUR_UNIT)) / 30;
}

// ───────────────────────────── RD-R08: lines as an expected flow ─────────────────────────────

/** Share of a line's day run as the expected flow at experiment throughput X (0 below PACE_BATCH, 1 from twice it, linear
 *  between: the explicit pipeline and the flow share the day, so nothing jumps at the switch). */
export const flowShare = (X: number) => Math.max(0, Math.min(1, X / PACE_BATCH - 1));

/** Per tested idea under the explicit pipeline's rules, in units of the line's prior mean per idea (every draw of a line
 *  candidate scales with it): research-engineer work w (team-months at unit inputs: small + scale when it passes), kept
 *  true effect at test scale g, kept ideas p, the kept ideas' effect-weighted scale exponent sx, ideas ideated ι. */
export interface FlowStats { w: number; g: number; p: number; sx: number; iota: number }
const FLOW_Q = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
const FLOW_RHO = [1, 1.5, 2, 3, 4, 6, 8, 16];
const FLOW_N = 1500;
const FLOW_WARM = 30;
const flowCache = new Map<string, FlowStats>();

/** The explicit pipeline's rules (newCandidate, addCandidate, pickCandidate, resolveStage's two drop rules) run on FLOW_N
 *  tests of single ideas with fixed hash draws (seed-independent: the flow is the expectation, not a world's draw), at
 *  taste q, risk κ and ρ ideas ideated per test (ρ > 1: ideation outruns the tests, the pool fills and selection
 *  sharpens). Cached per line, κ and grid point. */
function flowSim(n: TreeNodeDef, kappa: number, q: number, rho: number): FlowStats {
  const key = `${n.id}|${kappa}|${q}|${rho}`;
  const hit = flowCache.get(key);
  if (hit) return hit;
  const sg = LINE_STAGES;
  const [sm, ssd] = n.effect?.s ?? [0, 0];
  const sdT = n.effect?.sd ?? PROJECT_SD;
  const la = Math.log(SMALL_TO_TEST);
  const scaleF = Math.exp(la * sm + (la * la * ssd * ssd) / 2);
  const uh = (k: string) => (hash32(0x52d08, `${key}:${k}`) + 0.5) / 4294967297;
  const zh = (k: string) => Math.sqrt(-2 * Math.log(uh(`${k}a`))) * Math.cos(2 * Math.PI * uh(`${k}b`));
  type C = { x: number; s: number; mu: number; sd: number };
  const score = (c: C) => c.mu + kappa * c.sd;
  const cands: C[] = [];
  let k = 0;
  let ideated = 0;
  const mk = () => {
    const i = k++;
    ideated++;
    const nov = uh(`n${i}`);
    const T = Math.exp(sdT * zh(`T${i}`) - (sdT * sdT) / 2);
    const x = T * (CAND.mean0 + CAND.meanNov * nov) + T * (CAND.sd0 + CAND.sdNov * nov) * zh(`x${i}`);
    const s = Math.max(S_RANGE[0], Math.min(S_RANGE[1], sm + ssd * zh(`s${i}`)));
    const sd = (BELIEF_NOISE * (0.5 + nov)) / Math.max(0.2, q);
    const c = { x, s, mu: x + sd * zh(`b${i}`), sd };
    if (cands.length < POOL_MAX) {
      cands.push(c);
      return;
    }
    let wi = 0;
    for (let j = 1; j < cands.length; j++) if (score(cands[j]) < score(cands[wi])) wi = j;
    if (score(c) > score(cands[wi])) cands[wi] = c;
  };
  let acc = 0;
  let w = 0;
  let g = 0;
  let p = 0;
  let sxw = 0;
  let id0 = 0;
  for (let t = 0; t < FLOW_N + FLOW_WARM; t++) {
    if (t === FLOW_WARM) id0 = ideated;
    const on = t >= FLOW_WARM;
    acc += rho;
    while (acc >= 1) {
      acc -= 1;
      mk();
    }
    while (cands.length < PICK_AT) mk();
    let bi = 0;
    for (let j = 1; j < cands.length; j++) if (score(cands[j]) > score(cands[bi]) + 1e-12) bi = j;
    const c = cands.splice(bi, 1)[0];
    const alts = cands.map(score);
    // Small experiments (resolveStage: the reading narrows the belief; drop rule against the floor and the pool).
    const se = EXP_NOISE;
    const y = c.x + se * zh(`e${t}`);
    const w1 = 1 / (c.sd * c.sd);
    const w2 = 1 / (se * se);
    c.mu = (c.mu * w1 + y * w2) / (w1 + w2);
    c.sd = Math.sqrt(1 / (w1 + w2));
    if (on) w += sg.small;
    const sc = score(c);
    if (dropRule(sc, sc < DROP_FRAC, alts)) continue;
    // Scale test (one idea: x·1000^s must hold SURVIVE_FRAC of the small-scale estimate; the pool compared at test scale).
    if (on) w += sg.scale;
    const xTest = c.x * Math.pow(SMALL_TO_TEST, c.s);
    const xT = xTest * (1 + TEST_READ_SD * zh(`r${t}`));
    const scT = xT + kappa * Math.abs(xT) * TEST_READ_SD;
    if (dropRule(scT, scT < SURVIVE_FRAC * c.mu || scT < DROP_FRAC, alts.map((a) => a * scaleF))) continue;
    if (!on) continue;
    g += xTest;
    p += 1;
    sxw += xTest * c.s;
  }
  const out = { w: w / FLOW_N, g: g / FLOW_N, p: p / FLOW_N, sx: g > 0 ? sxw / g : sm, iota: (ideated - id0) / FLOW_N };
  flowCache.set(key, out);
  return out;
}

/** Grid bracket of v on a sorted grid, in log space: the two points and the weight of the upper one (clamped). */
function bracket(grid: number[], v: number): [number, number, number] {
  if (v <= grid[0]) return [grid[0], grid[0], 0];
  const last = grid[grid.length - 1];
  if (v >= last) return [last, last, 0];
  let i = 0;
  while (grid[i + 1] < v) i++;
  return [grid[i], grid[i + 1], Math.log(v / grid[i]) / Math.log(grid[i + 1] / grid[i])];
}

/** FlowStats at taste q and ρ ideas per test, bilinear in log q and log ρ between grid points (continuous in both). */
export function flowStats(n: TreeNodeDef, kappa: number, q: number, rho: number): FlowStats {
  const [q0, q1, a] = bracket(FLOW_Q, q);
  const [r0, r1, b] = bracket(FLOW_RHO, Math.max(1, rho));
  const pts: [FlowStats, number][] = [
    [flowSim(n, kappa, q0, r0), (1 - a) * (1 - b)],
    [flowSim(n, kappa, q1, r0), a * (1 - b)],
    [flowSim(n, kappa, q0, r1), (1 - a) * b],
    [flowSim(n, kappa, q1, r1), a * b],
  ];
  const mix = (f: (x: FlowStats) => number) => pts.reduce((acc, [x, wt]) => acc + f(x) * wt, 0);
  const g = mix((x) => x.g);
  return { w: mix((x) => x.w), g, p: mix((x) => x.p), sx: g > 0 ? mix((x) => x.g * x.sx) / g : mix((x) => x.sx), iota: mix((x) => x.iota) };
}

/** One day of a line's expected flow (its share φ of the day): ideas ideated at φ × the science teams' rate, tested at
 *  φ × the experiment rate (tests per day k = min(ideas ÷ ι, work ÷ w)); the pool advances test by test (at most 256 steps
 *  a day, each of k/steps tests) by the expected kept effect g × the prior mean at the pool's state then, so the line's
 *  stack stays r_l·log₁₀(R/n₀). The day's result is queued for the engineers as one build (its true effect is the
 *  expectation; ideas adopted = k·p). Returns the FLOP used. */
function stepFlow(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: CapProjectState, phi: number, ideasFull: number, q: number, rate: number, flopDay: number, queueBuild: (tw: number) => string): number {
  const ideas = phi * ideasFull;
  const work = phi * rate;
  if (ideas <= 0 || work <= 0) return 0;
  const sg = stagesOf(n);
  const rho = Math.max(1, (ideas * (sg.small + sg.scale)) / work);
  const f = flowStats(n, RISK(s), q, rho);
  const k = Math.min(ideas / Math.max(1e-12, f.iota), work / Math.max(1e-12, f.w));
  if (k <= 0) return 0;
  const pl = linePool(s, n);
  let M = pl.n0 + (st.pool ?? 0);
  const steps = Math.min(256, Math.max(1, Math.ceil(k)));
  const j = k / steps;
  let x = 0;
  for (let i = 0; i < steps; i++) {
    const gain = j * f.g * pl.r * Math.log10((M + q) / M);
    x += gain;
    M *= Math.pow(10, Math.max(0, gain) / pl.r);
  }
  st.pool = M - pl.n0;
  st.input = (st.input ?? 0) + k * q;
  const kept = k * f.p;
  const before = Math.floor(st.flowDone ?? 0);
  st.flowDone = (st.flowDone ?? 0) + kept;
  st.gen += Math.floor(st.flowDone) - before;
  const fTest = sg.testFrac * latestBaseFlop(s);
  const ratio = Math.log10(Math.max(1, latestBaseFlop(s) / fTest));
  const est = x * Math.pow(10, f.sx * ratio);
  const c: Candidate = { k: 0, gen: st.gen, nov: 0, b: 1, q, mu: x, sd: 0, muS: f.sx, sdS: 0, at: st.pool };
  const result: CapResult = { c, xTest: x, sHat: f.sx, fTest, est, estSd: (Math.abs(est) * TEST_READ_SD) / Math.sqrt(Math.max(1, kept)), day: ctx.day, flow: { x, s: f.sx, n: kept } };
  (st.pending ??= []).push(result);
  // The engineers' build-in as the explicit pipeline pays it: a base per idea plus the effect's OOM (capped per idea).
  result.buildId = queueBuild(Math.min(ADOPT_TW.max * Math.max(1, kept), ADOPT_TW.base * kept + ADOPT_TW.perOom * oomOf(n, est)));
  return flopDay * phi * Math.min(1, (k * f.w) / work);
}

/** RD-R02b: one project day's department-specific inputs. Capability: the research inputs, the project's research-engineer
 *  team-equivalents `reCap` and experiment FLOP share `flopDay`, and the build queue. Safety (a node of a safety line, or a
 *  line's open study): the project's one test state, its work rates from the science teams and from the experiment CES
 *  (safety/lineProjects.ts lineRates, months of work per day), its FLOP per day, and the result handler (`works` = the
 *  draw from the agenda's hidden efficacy; undefined for an open study, whose result is an event). */
export type ProjectDay =
  | { dept: 'cap'; inp: ResearchInputs; reCap: number; flopDay: number; queueBuild: (tw: number) => string }
  | { dept: 'saf'; trial: ProjectTrial; sciRate: number; expRate: number; flopDay: number; onResult: (works: boolean | undefined) => void };
/** A one-question test's state: work done / needed and FLOP used (capability unlock projects, safety projects). */
export interface ProjectTrial { work: number; workNeed: number; flop: number }

/** RD-R02b: one day of a one-question test (RD-R05's unlock projects and every safety project). The science teams' and
 *  the experiment CES's work rates add up on the same work; returns the FLOP used and whether the work is done. */
function stepTest(tr: ProjectTrial, sciRate: number, expRate: number, flopDay: number): { used: number; done: boolean } {
  const rate = sciRate + expRate;
  if (rate <= 0) return { used: 0, done: false };
  const need = Math.max(0, tr.workNeed - tr.work);
  const step = Math.min(1, need / rate);
  tr.work = rate < need ? tr.work + rate : tr.workNeed;
  const used = expRate > 0 ? flopDay * step : 0;
  tr.flop += used;
  return { used, done: tr.work >= tr.workNeed - 1e-12 };
}

/** RD-R02b: does a safety node's test work on this attempt? A hidden per-world draw against the agenda's true efficacy
 *  (deterministic: hash32(seed, 'saf:'+id+':'+attempt)), never read by the views (they show the posterior). */
export function safetyWorks(s: GameStateV2, n: TreeNodeDef, attempt: number): boolean {
  if (!n.agenda) return false;
  return hash32(s.setup.seed, `saf:${n.id}:${attempt}`) / 4294967296 < trueEfficacy(s, n.agenda as AgendaId);
}

/** One day of one project's lifecycle, for both departments (RD-R02b). Capability: `reCap` = research-engineer
 *  team-equivalents on it today (human); `flopDay` = its share of the experiment FLOP per day (consumed while it
 *  experiments). Safety: one "does it work" test, as an unlock project; at its end the works draw (node projects) or the
 *  open study's event. Returns the FLOP used. */
export function stepProject(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, day: ProjectDay): number {
  if (day.dept === 'saf') {
    const r = stepTest(day.trial, day.sciRate, day.expRate, day.flopDay);
    if (r.done) day.onResult(n.followUp ? undefined : safetyWorks(s, n, s.player.tree[n.id]?.attempts ?? 1));
    return r.used;
  }
  const { inp, reCap, flopDay, queueBuild } = day;
  const st = capState(s, n.id);
  if (st.stage === 'failed' || st.stage === 'adopting') return 0;
  const P = s.hidden.timeline.prod;
  const kappa = RISK(s);
  const sg = stagesOf(n);
  const sci = sciOn(s, n.id);
  if (isUnlockProject(n)) return stepTrial(s, ctx, n, st, inp, sci, experimentRate(s, inp, reCap, flopDay), flopDay, queueBuild);
  // RD-R08: at high experiment throughput a line runs share φ of its day as the expected flow (stepFlow), the rest as the
  // explicit pipeline below (ideation and experiment time × (1 − φ)).
  const phi = n.kind === 'line' ? flowShare(inp.X) : 0;
  const ideasFull = sci.cap > 0 ? (Math.pow(inp.mIdeas * sci.cap, P.lam) * sci.q * inp.speed) / (sg.idea * 30) : 0;
  // 2–3 Experiments: the experiment CES of the project's FLOP and research-engineer labour (team-months per day at unit
  // inputs: √RE_LABOUR_UNIT / 30, as one pair of teams). Work left over when a stage ends carries into the next one the same day.
  const rate = experimentRate(s, inp, reCap, flopDay);
  let used = phi > 0 ? stepFlow(s, ctx, n, st, phi, ideasFull, sci.q, rate, flopDay, queueBuild) : 0;
  // 1 Ideation (continuous while science teams are on it): (m_IDEAS × capacity)^λ × taste.
  if (sci.cap > 0 && phi < 1) {
    st.idea += ideasFull * (1 - phi);
    let guard = 0;
    while (st.idea >= 1 && guard++ < 8) {
      st.idea -= 1;
      addCandidate(st, newCandidate(s, n, st, sci.q, 1), kappa);
    }
    st.idea = Math.min(st.idea, 1);
  }
  let time = 1 - phi;
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

/** RD-R05: one day of an unlock project's test. The science teams (at the ideation rate) and the experiment CES (research
 *  engineers and the project's FLOP) do the same work, the project's whole stage work; when it is done the hidden
 *  per-world draw `works()` decides: it works (the engineers build it in) or it fails (reopen at lower odds). Returns
 *  the FLOP used. */
function stepTrial(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: CapProjectState, inp: ResearchInputs, sci: { cap: number; q: number }, expRate: number, flopDay: number, queueBuild: (tw: number) => string): number {
  const tr = trialOf(n, st);
  const { used, done } = stepTest(tr, sciWorkRate(s, inp.mIdeas, sci, inp.speed), expRate, flopDay);
  if (!done) return used;
  const spec = st.spec ?? 0;
  const ts = s.player.tree[n.id];
  if (works(s, n, spec)) {
    tr.buildId = queueBuild(adoptTW(n, 0));
    st.stage = 'adopting';
    ts.progress = 1;
    ctx.log('research', `${n.name} works. The engineers are building it in.`, 2, n.id);
  } else {
    st.stage = 'failed';
    ts.status = 'failed';
    ts.day = ctx.day;
    const pc = (x: number) => `${Math.round(x * 100)}%`;
    ctx.log('research', `${n.name}: the test showed it does not work (this attempt's chance was ${pc(attemptOdds(n, spec))}). Reopening as speculative tries again at ${pc(attemptOdds(n, spec + 1))}.`, 2, n.id);
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
    const kappa = RISK(s);
    const score = candidateScore(c, kappa);
    if (dropRule(score, score < DROP_FRAC * pub, st.cands.map((o) => candidateScore(o, kappa)))) return !dropTest(s, ctx, n, st, 'small experiments showed too little');
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
  // A batch keeps its surviving ideas; a single idea must hold at scale (the floor). The pool's scores are compared at test
  // scale: × the expected scale factor (a batch: its survivor factor; one idea: E[1000^s] under the project's scale prior).
  const kappa = RISK(s);
  const [sMu, sSd] = n.effect?.s ?? [0, 0];
  const la = Math.log(SMALL_TO_TEST);
  const batchF = at.batch ? at.xTest / Math.max(1e-12, truth.x) : 1;
  const scaleF = at.batch ? batchF : Math.exp(la * sMu + (la * la * sSd * sSd) / 2);
  const scoreT = xT + kappa * Math.abs(xT) * TEST_READ_SD;
  const underT = (!at.batch && scoreT < SURVIVE_FRAC * c.mu) || scoreT < DROP_FRAC * pub * batchF;
  if (dropRule(scoreT, underT, st.cands.map((o) => candidateScore(o, kappa) * scaleF))) {
    return !dropTest(s, ctx, n, st, 'the effect did not hold at scale');
  }
  // The estimate at the lab's latest base (read when the scale test ends; the build-in starts the same day).
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
  st.stage = 'adopting'; // RD-R07: no zero-length result stage; the engineers' build-in starts at once
  s.player.tree[n.id].progress = 1;
  ctx.log('research', `${n.name} works: estimated ${fmtEst(n, est, estSd)}. The engineers are building it in.`, 2, n.id);
  queueAdoption(n, st, queueBuild);
  return false;
}

const fmtEst = (n: TreeNodeDef, est: number, sd: number) => (n.effect?.stack ? `${est.toFixed(3)} ± ${sd.toFixed(3)} OOM` : n.effect?.domains ? `×${est.toFixed(2)} of the expected effect` : 'it unlocks');

/** Progress readout of a project (0..1 of the current stage chain) for the tree's progress ring. */
export function capProgress(st: CapProjectState | undefined): number {
  if (!st) return 0;
  if (st.stage === 'adopting') return 1;
  if (st.stage === 'failed') return 0;
  if (st.stage === 'test') return st.trial && st.trial.workNeed > 0 ? Math.min(1, st.trial.work / st.trial.workNeed) : 0;
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

/** One day of capability research: assignment, research engineers, every ready project's lifecycle, the
 *  readouts. `ready` = capability projects in priority order that can take teams today. */
export function capResearchDay(s: GameStateV2, ctx: SystemCtx, ready: string[], queueBuild: (id: string, tw: number) => string) {
  const p = s.player;
  assignCapTeams(s, ready);
  const alloc = reAllocation(s);
  // Model v3 D7: eval suites take their research engineers (the 'evals' need) and their inference compute from the
  // experiments pool before the projects.
  const pool = expPoolH100e(s);
  const evH = evalsDay(s, ctx, alloc.re.evals, Math.max(1, workContext(s).slots.EXP.m), pool);
  const avail = projectFlopPerDay(s) * (pool > 0 ? Math.max(0, 1 - evH / pool) : 1);
  // Experiment FLOP by need (RD-B08): each project in experiments with research engineers a full share.
  const sh = expShares(alloc, avail);
  // The unit project's inputs: a full project's share (RE_MAX_PER_PROJECT of the needs' units; the whole pool for the first
  // project when nothing else wants FLOP).
  const inp = researchInputs(s, Math.max(sh.units, RE_MAX_PER_PROJECT), avail);
  let used = 0;
  for (const id of ready) {
    const n = node(id) as TreeNodeDef;
    // A test that starts today gets research engineers (and FLOP) from tomorrow's allocation.
    const re = alloc.perProject.get(id) ?? 0;
    used += stepProject(s, ctx, n, { dept: 'cap', inp, reCap: re, flopDay: sh.perProject.get(id) ?? 0, queueBuild: (tw) => queueBuild(id, tw) });
    const ts = p.tree[id];
    if (ts?.cap) ts.progress = capProgress(ts.cap);
  }
  softwareProgressDay(s);
  const g = stacksGEquiv(s);
  p.research.last = {
    re: { ops: r3(alloc.re.ops), evals: r3(alloc.re.evals), exp: r3(alloc.re.exp) },
    idle: r3(Math.max(0, alloc.total - alloc.re.ops - alloc.re.evals - alloc.re.exp)),
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
