// Research projects (model v3 V2: design/MODEL-V3.md §5, §8; design/V3-BUILD.md "V2"; design/TECH-TREE.md §6). Owner: WS1.
// Constants of the capability-project lifecycle (models/research.ts), the recipe stacks (models/stacks.ts) and the broad
// allocations of research engineers and engineers. Tags: [R20 xx] research/20, [D] design value, [fit] fitted by the
// calibration harness (scripts/v2/calib.ts --fit-lines).
import type { Allocation, EngNeed, ReNeed, RiskPolicy, SafReNeed, StackKey } from '../../engine/v2/types';

// ───────────────────────────── start priority list (model v3 V4.0) ─────────────────────────────

/** The capability research lines every start puts on its priority list, with their share of the capability science
 *  teams (teams wanted ≈ share × teams, at least 1) [D]: a 2025 frontier lab's standing portfolio (the lines RefBot runs:
 *  pretraining recipes carry the pretraining stack, Ho et al. ≈ 3×/yr; the RL lines the RL stack; D10: Inference
 *  efficiency the serving stack, weight 0.1 [D: a 2025 frontier lab keeps an inference-optimisation team beside its
 *  training research, about a tenth of its research teams; at RefBot's 7–9 line teams that is the one-team minimum]).
 *  Shown and editable on Research › Projects; before V4.0 a new game started with an empty list and idle capability
 *  scientists. */
export const DEFAULT_LINES: { id: string; w: number }[] = [
  { id: 'L.scale', w: 0.25 }, { id: 'L.env', w: 0.3 }, { id: 'L.data', w: 0.15 }, { id: 'L.opt', w: 0.1 }, { id: 'L.rlalg', w: 0.2 }, { id: 'L.infer', w: 0.1 },
];

// ───────────────────────────── lifecycle ─────────────────────────────

/** A team picks a candidate to test once it has this many (more ideation = more to pick from) [D]. */
export const PICK_AT = 2;
/** Candidates kept per project; beyond it, ideation replaces the weakest when it finds a better one [D]. */
export const POOL_MAX = 4;
/** Small experiments run at 1/SMALL_TO_TEST of the scale test's FLOP per run [D: R20 B5 "de-risking at ≥ 1/100 of the
 *  target"; small-scale ablations at ≤ 1e19-ish FLOP, Gundlach]. A candidate's small-scale effect x is x·1000^s at test
 *  scale, so a quarter of small-scale wins survive when s ~ N(−0.3, 0.3) (s ≥ −0.1) [R20 B5]. */
export const SMALL_TO_TEST = 1000;
/** Range of a candidate's small-to-test exponent s (x_test = x_small·1000^s: what survival and the scale test read)
 *  [D lower end: R20 B5; upper end R: Gundlach et al. 2025 arXiv 2511.21622: the LSTM-to-Transformer multiplier grows
 *  7.9x at 1e15 FLOP to 352x at 1.3e22, 2.83x in OOM over 7.1 OOM of compute, which as a power on the OOM effect is
 *  s = log10(2.83)/7.1 = 0.064, so no idea reads more than 0.065 per decade. Before M1 the cap was 0.25, the Transformer's
 *  ADDITIVE slope of the multiplier misread as an exponent; design/bal/SCALE-DIAG.md §4.2, S1]. (models/research.ts;
 *  actors/rivalModel.ts survivors.) Beyond the test scale the effect follows the additive slope KAPPA_MAX (below). */
export const S_RANGE: readonly [number, number] = [-0.6, 0.065];
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
/** Ideation belief noise: sd = BELIEF_NOISE × prior mean × √batch × (0.5 + novelty) / taste [D, R20 B5: "taste narrows
 *  the noise"; MODEL-V3 §8: taste enters twice; V3: ÷ taste, not taste², because AI taste reaches 30–200]. */
export const BELIEF_NOISE = 0.5;
/** Candidate truth around the project's hidden mean T (taste is in the prior: research input for lines, a lift for ideas): mean × (CAND.mean0 + CAND.meanNov·novelty), sd ×
 *  (CAND.sd0 + CAND.sdNov·novelty): novel candidates are bigger on average and much less certain [D]. */
export const CAND = { mean0: 0.75, meanNov: 0.5, sd0: 0.15, sdNov: 0.6 };
/** Taste raises a one-off idea's mean: × (1 + TASTE_MEAN·(1 − 1/T)), T = the team's taste (Strong without AI 1; ×0.9 Solid,
 *  ×1.16 Elite, at most ×1.5) [D, MODEL-V3 §8]. Lines take taste as research input in their pool instead (V3 notes). */
export const TASTE_MEAN = 0.5;
/** A direction that does not work in this world: candidates are noise around 0 with this sd × the prior mean [D]. */
export const DUD_SD = 0.1;
/** Hidden per-world, per-generation draw of a project's mean: prior × lognormal(sd) [D]. */
export const PROJECT_SD = 0.25;
/** Risk policy: κ in the score μ + κσ a team maximises when it picks a candidate [D, V3-BUILD V2.4]. */
export const RISK_KAPPA: Record<RiskPolicy, number> = { safe: -0.5, balanced: 0, speculative: 0.5 };
/** Reopening a failed project as speculative: odds × 0.5, prior mean × 0.7, candidate spread × 1.5 per reopen [D]. */
export const SPECULATIVE = { odds: 0.5, mean: 0.7, spread: 1.5 };
/** RD-R08: lines run as an internal expected flow once the lab's experiment throughput X (unit project = 1) passes this:
 *  the flow's share of the line's day is φ = clamp(X / PACE_BATCH − 1, 0, 1) (0 at PACE_BATCH, 1 at twice it), the explicit
 *  candidate pipeline runs the rest, so a takeoff does not need thousands of daily events and nothing jumps at the switch
 *  [D: performance]. Every candidate is one idea; the flow applies the same per-idea drop and survival rules in
 *  expectation (models/research.ts flowStats). */
export const PACE_BATCH = 30;

// ───────────────────────────── diminishing returns (lines) ─────────────────────────────

/** Lines are pools with returns r (design/V3-BUILD.md V3 notes, derivation 1; models/research.ts linePool): a result
 *  bringing research input q to a pool at state R has prior mean r_l·log₁₀((R + q)/R), r_l = the line's rShare × the
 *  preset's r, the pool's start state n₀ from the first idea's mean μ₁ = effect.mean × LINE_FIT.mu. LINE_FIT.mu scales every
 *  line's start effect [fit: the reference lab's pretraining stack ≈ 0.48 OOM/yr in its first year, Ho et al., R20 B1;
 *  calib.ts --fit-lines] (an object so the calibration harness can set it). */
export const LINE_FIT = { mu: 0.645 };
/** Item A: each line's research input at the start of the game, in pool units (the pool's own measure: kept ideas × taste), and the
 *  measure the AIFM's initial research stock is taken against. A world with V3Cal.stockAgeYears > 0 starts the line's pool at
 *  stockAgeYears × (year1[line] ÷ yearOverStart) (models/research.ts linePool): the pool is that many years of the line's own
 *  start input, as the AIFM's initial stock RS(0) = E(0)/g_E is 1/g_E years of its start effort.
 *  year1: the pool a line gains in the first year of a lines-first reference lab (policy 'reflines', forced AIFM inputs, pace 1,
 *    the pre-A pools), mean of 3 timelines × 6 seeds. The input at day 0 itself is not measurable: the first idea of a line
 *    lands after about 75 days (ideation, small tests, scale test), and the input then grows with compute.
 *  yearOverStart: the AIFM's year-1 mean research effort over its effort at 2025.5, so the start input = year1 ÷ this
 *    (research_efforts in the AIFM Q2 Eli rollouts, 20 samples per group: medians 1.47 / 1.50 / 1.51 for fast / central / slow).
 *  A line absent from year1 (Recurrent architectures, opened by P17 later) keeps its n₀ from LINE_FIT.mu.
 *  [fitted: year1 from .scratch/ra-probe.ts runs r0; yearOverStart sourced] */
export const LINE_START_INPUT = {
  yearOverStart: 1.5,
  year1: { 'L.scale': 17.77, 'L.data': 11.59, 'L.opt': 3.35, 'L.env': 15.05, 'L.rlalg': 12.93, 'L.infer': 11.01 } as Record<string, number>,
};

// ───────────────────────────── stage costs ─────────────────────────────

/** Stage work at unit inputs (team-months of one standard team; a project's experiment CES X(c, ℓ) = 1 at the leader's
 *  day-0 inputs per project) and the scale test's scale (share of the lab's latest base the effect is measured at) for
 *  lines [D]. Experiment FLOP is consumed at the project's share of the pool while it experiments (V3.4: no FLOP need
 *  per stage, no ÷ pace). */
export const LINE_STAGES = { idea: 0.8, small: 0.8, scale: 1.0, testFrac: 0.002 };
/** Stage weights of ideas and axes from the v2 effort E: ideation E/4 per candidate, small experiments 0.28E, scale test
 *  0.42E (with two research-engineer teams ≈ E in all, as the v2 project) [D]. */
const IDEA_W = { idea: 0.25, small: 0.28, scale: 0.42 };
/** RD-R07: the whole stage work per unit of v2 effort E (PICK_AT candidates' ideation + small + scale test = 1.2). */
export const IDEA_WORK_PER_E = PICK_AT * IDEA_W.idea + IDEA_W.small + IDEA_W.scale;
/** Ideas and axes: each stage's share of the node's one effort number (effortTM = the whole stage work the engine runs,
 *  PICK_AT × idea + small + scale = 1) and the scale test at 1% of the latest base [D]. */
export const IDEA_STAGES = {
  idea: IDEA_W.idea / IDEA_WORK_PER_E, small: IDEA_W.small / IDEA_WORK_PER_E, scale: IDEA_W.scale / IDEA_WORK_PER_E, testFrac: 0.01,
};
/** An unfitted idea's or axis's effort (team-months, all stages): the v2 default E = 8, × IDEA_WORK_PER_E. */
export const IDEA_DEFAULT_TM = 8 * IDEA_WORK_PER_E;

// ───────────────────────────── stacks ─────────────────────────────

/** Grid of the stack buckets' relative scale slope κ (adopted ideas with κ within half a step share a bucket) [D]. */
export const K_STEP = 0.02;
/** Scale-dependence beyond the test scale (design/bal/SCALE-DIAG.md M1, designer 2026-11-26): an adopted idea of effect x
 *  at test FLOP F_test adds x·(1 + κ·log₁₀(F/F_test)) OOM at run FLOP F: linear in log F, so the lever neither grows
 *  with the stock nor turns convex in F. κ is the idea's relative slope per OOM of compute (δ = κ·x OOM per OOM).
 *  KAPPA_MAX is the strongest slope. [R: Gundlach et al. 2025 arXiv 2511.21622: the LSTM-to-Transformer compute-efficiency
 *  multiplier grows 7.9x (0.90 OOM) at 1e15 FLOP to 352x (2.55 OOM) at 1.3e22 FLOP: +0.23 OOM per OOM of compute on an
 *  effect of 0.9 OOM, κ = (2.55 − 0.90)/(7.1 × 0.90) = 0.259 per OOM; research/20-model-v3-calibration.md:254;
 *  design/bal/SCALE-DIAG.md §3.] */
export const KAPPA_MAX = (Math.log10(352) - Math.log10(7.9)) / (7.1 * Math.log10(7.9));
/** The paradigm tier draws κ = KAPPA_MAX × U(KAPPA_TIER) [D: Gundlach's two scale-dependent changes (the Transformer, κ 0.26;
 *  Kaplan-to-Chinchilla, 3.7x at 2023 compute, a rebalancing the run design models as tokens per parameter) are both
 *  strong; the tier's mean is 0.75 × KAPPA_MAX]. A node's `par` is the share of its ideas in the tier; every other idea is
 *  scale-invariant beyond the test scale (κ = 0) [R: Gundlach: "the scale-invariant innovations together account for 7.9x
 *  (21.7x if multiplied)", under 10x in all; 2 of about 20 identified innovations are scale-dependent, par ≈ 0.1;
 *  design/bal/SCALE-DIAG.md §3-4]. */
export const KAPPA_TIER: readonly [number, number] = [0.5, 1];
/** Expected κ of a node with a share `par` of its ideas in the paradigm tier. */
export const kappaMean = (par = 0) => par * KAPPA_MAX * (KAPPA_TIER[0] + KAPPA_TIER[1]) / 2;
/** The scale test's reading noise of κ (absolute, per OOM of compute) [D: S_READ_SD's size, 0.03 ≈ KAPPA_MAX/9]. */
export const K_READ_SD = 0.03;
/** Training throughput cap: MFU 0.75 × goodput 0.97 over the start's 0.40 × 0.90 (OOM) [R20 A4: MFU 0.30–0.55 today;
 *  D above]. */
export const TRAIN_CAP = Math.log10((0.75 * 0.97) / (0.4 * 0.9));
export const STACK_LABEL: Record<StackKey, string> = {
  pre: 'Pretraining recipe', rlMid: 'Post-training method', rlCeil: 'Post-training ceiling', train: 'Training efficiency', serve: 'Serving efficiency',
};
/** RD-B17: what each stack's OOM measure (the Recipe tab shows each stack in its own unit, never summed). Read after
 *  "OOM". */
export const STACK_UNIT: Record<StackKey, string> = {
  pre: 'of effective compute for new bases', rlMid: 'less RL compute for the same gain', rlCeil: 'higher RL ceiling',
  train: 'more model FLOP per chip-day', serve: 'more serving throughput',
};
/** RD-B17: the model that embodies an adopted idea, by where its effect lands (a realised value is revealed only by the
 *  evaluation of such a model). */
export type EmbodiedBy = 'baseStart' | 'rl' | 'post' | 'baseOrRl';
export const EMBODIED_BY: Record<StackKey, EmbodiedBy> = { pre: 'baseStart', rlMid: 'rl', rlCeil: 'rl', train: 'baseOrRl', serve: 'post' };
/** Player text: which model trains it in ("… after it was adopted"). */
export const EMBODIED_TEXT: Record<EmbodiedBy, string> = {
  baseStart: 'a base run started', rl: 'a post-training run launched', post: 'a post-training run (not an amplify cycle) launched',
  baseOrRl: 'a base or post-training run started',
};

// ───────────────────────────── adoption (engineers) ─────────────────────────────

/** Engineers' work to build a result into the stack: base + per OOM of effect (team-weeks); unlocks a flat amount;
 *  capped [D]. */
export const ADOPT_TW = { base: 0.5, perOom: 2, unlock: 1, max: 8 };

// ───────────────────────────── allocation ─────────────────────────────

/** Most science teams one capability project takes ("max" teams wanted) [D: √capacity returns]. */
export const PROJECT_MAX_TEAMS = 6;
/** B4 "auto" teams wanted: a spare science team goes to the project (auto ones first) where it adds the most expected
 *  value per day (RD-A03, models/research.ts projectValue), weighted by this factor per rank down the list, so higher
 *  priority wins close calls [D]. */
export const AUTO_RANK_W = 0.8;
/** RD-A03: the science-team planner's value proxies, in lab-wide software OOM [D]. A domain OOM (one capability domain
 *  of new versions) counts `domainOom` of a software OOM; an unlock (no typed effect: an RL focus, option, feature) and
 *  a data effect count `unlock` OOM × the attempt's odds (about one mid-sized stack idea, 0.02–0.06 OOM). */
export const VALUE_PROXY = { domainOom: 0.1, unlock: 0.05 };
/** RD-R03: the safety planner's per-line weight [D] (value proxy = results per day × chance it works × weight; the
 *  safety department is planned on its own, so only ratios between lines matter). 1 for every line until a line's
 *  results are priced (SAFETY-REDESIGN §3.1); a line listed here counts that much more or less. */
export const SAF_LINE_WEIGHT: Partial<Record<string, number>> = {};
/** Most research-engineer team-equivalents one project in experiments takes (an allocation cap; a policy number, not
 *  the labour unit RE_LABOUR_UNIT, though both are 2 today) [D]. */
export const RE_MAX_PER_PROJECT = 2;
/** Research engineers that keep runs going (team-equivalents per running run) [D; MODEL-V3 §3.3 "operations", §5].
 *  RD-B09 (DD-11): the one owner of run operations (engineers build the setups only); a shortfall slows every running
 *  run and the stream to the share served (models/research.ts opsServed). */
export const RE_OPS = { base: 1, mid: 0.5, small: 0.2, stream: 0.5 };
/** Default allocations: research engineers keep runs going first, then project experiments (RE_MAX_PER_PROJECT each, no
 *  share cap: RD-B08); the rest are idle (RD-E03: no routine tuning);
 *  engineers as before J2 (run setups and adoptions, upkeep, builds) [D]. SR-21: eval suites are a safety engineers' need. */
export const DEFAULT_RE_ALLOC: Allocation<ReNeed> = { order: ['ops', 'exp'], max: {}, share: {} };
export const DEFAULT_ENG_ALLOC: Allocation<EngNeed> = { order: ['runs', 'upkeep', 'builds'], max: {}, share: {} };
/** SR-21 (SAFETY-REDESIGN §5): the safety research engineers' default order: human review on the safeguards (SR-13b took
 *  it before the list), SR-22 spot-checks of AI-done safety work, cases, validations and ports, pre-release eval suites, foothold removals, research
 *  experiments (RF-S8: environment fixes are hardening passes, the capability engineers' build queue). The player reorders it in LAB (OD-9). */
export const SAF_RE_NEEDS: SafReNeed[] = ['review', 'spotCheck', 'cases', 'validation', 'evals', 'removal', 'safExp'];
export const DEFAULT_SAF_RE_ALLOC: Allocation<SafReNeed> = { order: [...SAF_RE_NEEDS], max: {}, share: {} };
export const SAF_RE_NEED_LABEL: Record<SafReNeed, string> = {
  review: 'Human review (safeguards)', spotCheck: 'Spot-checks of AI safety work', cases: 'Open cases', validation: 'Validation jobs', evals: 'Eval suites',
  removal: 'Foothold removals', safExp: 'Line experiments',
};
export const RE_NEED_LABEL: Record<ReNeed, string> = { ops: 'Run operations', exp: 'Project experiments' };
export const ENG_NEED_LABEL: Record<EngNeed, string> = { runs: 'Run setups, research adoptions, eval harness', upkeep: 'Product upkeep', builds: 'Builds (tools, launches)' };
