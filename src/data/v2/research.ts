// Research projects (model v3 V2: design/MODEL-V3.md §5, §8; design/V3-BUILD.md "V2"; design/TECH-TREE.md §6). Owner: WS1.
// Constants of the capability-project lifecycle (models/research.ts), the recipe stacks (models/stacks.ts) and the broad
// allocations of research engineers and engineers. Tags: [R20 xx] research/20, [D] design value, [fit] fitted by the
// calibration harness (scripts/v2/calib.ts --fit-lines), BRIDGE(Vn) temporary (V3-BUILD "Bridges").
import type { Allocation, EngNeed, ReNeed, RiskPolicy, StackKey } from '../../engine/v2/types';

// ───────────────────────────── lifecycle ─────────────────────────────

/** A team picks a candidate to test once it has this many (more ideation = more to pick from) [D]. */
export const PICK_AT = 2;
/** Candidates kept per project; beyond it, ideation replaces the weakest when it finds a better one [D]. */
export const POOL_MAX = 4;
/** Small experiments run at 1/SMALL_TO_TEST of the scale test's FLOP per run [D: R20 B5 "de-risking at ≥ 1/100 of the
 *  target"; small-scale ablations at ≤ 1e19-ish FLOP, Gundlach]. A candidate's small-scale effect x is x·1000^s at test
 *  scale, so a quarter of small-scale wins survive when s ~ N(−0.3, 0.3) (s ≥ −0.1) [R20 B5]. */
export const SMALL_TO_TEST = 1000;
/** Small experiments' total FLOP as a share of the scale test's (many runs at 1/1000 of it) [D]. */
export const SMALL_FLOP_SHARE = 0.1;
/** At the scale test a candidate survives if its effect at test scale is at least this share of its small-scale
 *  estimate (R20 B5 "survives at scale") [D]. */
export const SURVIVE_FRAC = 0.5;
/** Small experiments drop a candidate whose posterior mean is below this share of the project's prior mean [D]. */
export const DROP_FRAC = 0.3;
/** An idea or axis fails after this many dropped candidates (lines never fail: they keep ideating) [D]. */
export const MAX_DROPS = 3;
/** Measurement noise: a small-experiment reading (sd × the prior mean × √batch), the scale test's reading of the effect
 *  (relative sd) and of the scale exponent (absolute sd) [D]. */
export const EXP_NOISE = 0.25;
export const TEST_READ_SD = 0.05;
export const S_READ_SD = 0.03;
/** Ideation belief noise: sd = BELIEF_NOISE × prior mean × √batch × (0.5 + novelty) / taste² [D, R20 B5: "taste narrows
 *  the noise"; MODEL-V3 §8: taste enters twice]. */
export const BELIEF_NOISE = 0.5;
/** Candidate truth around the project's hidden mean T: mean × (CAND.mean0 + CAND.meanNov·novelty) × taste factor, sd ×
 *  (CAND.sd0 + CAND.sdNov·novelty): novel candidates are bigger on average and much less certain [D]. */
export const CAND = { mean0: 0.75, meanNov: 0.5, sd0: 0.15, sdNov: 0.6 };
/** Taste raises the candidate mean: × (1 + TASTE_MEAN·(q − 1)), q = capacity-weighted team quality (Strong 1, Elite
 *  1.25, Solid 0.8) [D, MODEL-V3 §8]. */
export const TASTE_MEAN = 0.5;
/** A direction that does not work in this world: candidates are noise around 0 with this sd × the prior mean [D]. */
export const DUD_SD = 0.1;
/** Hidden per-world, per-generation draw of a project's mean: prior × lognormal(sd) [D]. */
export const PROJECT_SD = 0.25;
/** Risk policy: κ in the score μ + κσ a team maximises when it picks a candidate [D, V3-BUILD V2.4]. */
export const RISK_KAPPA: Record<RiskPolicy, number> = { safe: -0.5, balanced: 0, speculative: 0.5 };
/** Reopening a failed project as speculative: odds × 0.5, prior mean × 0.7, candidate spread × 1.5 per reopen [D]. */
export const SPECULATIVE = { odds: 0.5, mean: 0.7, spread: 1.5 };
/** Lines batch ideas once the research pace exceeds this: a candidate then carries b = ⌊pace / PACE_BATCH⌋ ideas (its
 *  work, FLOP and effect × b), so a takeoff does not need thousands of daily events [D: performance; the expected OOM per
 *  day is unchanged]. A batch counts as one generation. */
export const PACE_BATCH = 30;

// ───────────────────────────── diminishing returns (lines) ─────────────────────────────

/** Line generation n's prior mean μ_n = μ₁·(1 + (n − 1)/n₀)^(−β), β < 1 so the sum diverges (progress never stops, it
 *  gets harder) [fit: research/13 §2.2 r; research/20 B4]. The research pace already carries AI 2027's "ideas get
 *  harder" along the reference path (research/13 §2.5), so β fits small (design/V3-BUILD.md V2 notes). */
export const LINE_DECAY = { n0: 1000, beta: 0.03 };
/** Scale on every line's μ₁ [fit: the reference lab's stacks track the v2 know-how path, V2.8] (an object so the
 *  calibration harness can set it). */
export const LINE_FIT = { mu: 0.58 };

// ───────────────────────────── stage costs ─────────────────────────────

/** Stage work at research pace 1 (team-months of one standard team) and scale-test FLOP (share of the lab's latest base
 *  at pace 1) for lines [D, fit with LINE_MU_SCALE]. BRIDGE(V3): every stage's FLOP is divided by the research pace. The
 *  pace (the production function's software rate) already counts experiment compute through its CES, and in a takeoff
 *  AI taste, not more experiments, carries it (AI 2027); FLOP per idea at a fixed share would bind the reference lab's
 *  takeoff a second time. V3 replaces the pace with project-level CES on explicit compute and labour. */
export const LINE_STAGES = { idea: 0.8, small: 0.8, scale: 1.0, testFrac: 0.002 };
/** Ideas and axes: stage work from the v2 effort E (team-months): ideation E/4 per candidate, small experiments 0.28E,
 *  scale test 0.42E (with two research-engineer teams ≈ E in all, as the v2 project) and a scale test at 1% of the
 *  latest base [D]. */
export const IDEA_STAGES = { idea: 0.25, small: 0.28, scale: 0.42, testFrac: 0.01 };

// ───────────────────────────── stacks ─────────────────────────────

/** Share of an adopted idea's effect left as headroom for routine tuning (MODEL-V3 §5.5) [D]. */
export const HEADROOM = 0.3;
/** Routine tuning closes headroom at TUNE_K × research pace × research-engineer team-equivalents on tuning, per day, on
 *  what remains [D: ≈ 3 months with 3 teams at pace 1]. */
export const TUNE_K = 1 / 270;
/** Scale-exponent grid of the stack buckets (adopted ideas with s within half a step share a bucket) [D]. */
export const S_STEP = 0.02;
/** Training throughput cap: MFU 0.75 × goodput 0.97 over the start's 0.40 × 0.90 (OOM) [R20 A4: MFU 0.30–0.55 today;
 *  D above]. */
export const TRAIN_CAP = Math.log10((0.75 * 0.97) / (0.4 * 0.9));
export const STACK_LABEL: Record<StackKey, string> = {
  pre: 'Pretraining efficiency', rlMid: 'RL compute efficiency', rlCeil: 'RL ceiling', train: 'Training throughput', serve: 'Serving efficiency',
};
/** The three stacks of the readout and their parts. */
export const STACK_GROUPS: { id: 'pre' | 'rl' | 'sys'; name: string; keys: StackKey[] }[] = [
  { id: 'pre', name: 'Pretraining', keys: ['pre'] },
  { id: 'rl', name: 'RL', keys: ['rlMid', 'rlCeil'] },
  { id: 'sys', name: 'Serving & systems', keys: ['train', 'serve'] },
];

// ───────────────────────────── adoption (engineers) ─────────────────────────────

/** Engineers' work to build a result into the stack: base + per OOM of effect (team-weeks); unlocks a flat amount;
 *  capped [D]. */
export const ADOPT_TW = { base: 0.5, perOom: 2, unlock: 1, max: 8 };

// ───────────────────────────── allocation ─────────────────────────────

/** Most science teams one capability project takes ("max" teams wanted) [D: √capacity returns]. */
export const PROJECT_MAX_TEAMS = 6;
/** Research-engineer team-equivalents a project in experiments can use [D]. */
export const RE_PER_PROJECT = 2;
/** Research engineers that keep runs going (team-equivalents per running run) [D: mirrors the engineers' run upkeep;
 *  MODEL-V3 §3.3 "operations"]. */
export const RE_OPS = { base: 1, mid: 0.5, small: 0.2, stream: 0.5 };
/** BRIDGE(V3): share of capabilities research engineers on experiments + tuning in the reference allocation; h counts
 *  those, normalised by it, so h is unchanged at reference [fit: RefBot's average]. */
export const REF_RE_RESEARCH_SHARE = 0.88;
/** Default allocations: research engineers keep runs going first, then project experiments (at most 75% of them, so
 *  routine tuning always has some), then tuning; engineers as before J2 (runs, upkeep, builds) [D]. */
export const DEFAULT_RE_ALLOC: Allocation<ReNeed> = { order: ['ops', 'exp', 'tune'], max: {}, share: { exp: 0.75 } };
export const DEFAULT_ENG_ALLOC: Allocation<EngNeed> = { order: ['runs', 'upkeep', 'builds'], max: {}, share: {} };
export const RE_NEED_LABEL: Record<ReNeed, string> = { ops: 'Run operations', exp: 'Project experiments', tune: 'Routine tuning' };
export const ENG_NEED_LABEL: Record<EngNeed, string> = { runs: 'Runs (operations, setups, research adoptions)', upkeep: 'Product upkeep', builds: 'Builds (features, launches, sector packs)' };
