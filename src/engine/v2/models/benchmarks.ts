// Benchmark scores, eval suites, saturation and successors, eval-awareness confound (V2-SPEC §3.3.4). Owner: WS1.
import {
  BENCHMARKS, BENCH_NOISE_SD, DANGER_THRESHOLD, EA_CONFOUND, ELICITATION, SAFETY_EVALS, SAFETY_EVAL_SD, SAND_GAP, SUCCESSOR_STEP,
  type BenchmarkDef,
} from '../../../data/v2/benchmarks';
import { EVAL_DEPTHS, FULL_ROLLOUTS } from '../../../data/v2/evals';
import { observe } from '../safety/detection';
import type { EvalDepth, GameStateV2, ModelVersion, RngLike, SystemCtx } from '../types';
import { h50Of } from './capability';
import { bestPlayerVersion, versionById } from './labs';
import { inPlaceRecipe } from './stacks';

export type Evaluator = 'self' | 'evalGov' | 'evalIndep';

/** Saturation generation of a benchmark (0 = original edition). Stored in s.flags['bench:<id>']. */
export const benchGen = (s: Pick<GameStateV2, 'flags'>, id: string) => Number(s.flags[`bench:${id}`] ?? 0);

/** Display name with edition (successors are "II", "III", …). */
export function benchName(s: Pick<GameStateV2, 'flags'>, b: BenchmarkDef): string {
  const g = benchGen(s, b.id);
  return g === 0 ? b.name : `${b.name} ${['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][g] ?? `#${g + 1}`}`;
}

/** score = floor + (ceil − floor)·σ(kL·(L_d + elic + gap − mL)); successors shift mL by SUCCESSOR_STEP per gen. */
export function benchScore(b: BenchmarkDef, Ld: number, elic = 0, gap = 0, gen = 0, hard = false): number {
  const mL = (hard && b.mLHard !== undefined ? b.mLHard : b.mL) + gen * SUCCESSOR_STEP;
  return b.floor + (b.ceil - b.floor) / (1 + Math.exp(-b.kL * (Ld + elic + gap - mL)));
}

/** True domain level a benchmark reads on a version (average for multi-domain benches). */
export function benchLevel(v: Pick<ModelVersion, 'domains'>, b: BenchmarkDef): number {
  const ds = Array.isArray(b.domain) ? b.domain : [b.domain];
  return ds.reduce((a, d) => a + v.domains[d], 0) / ds.length;
}

/** Sandbagging gap on dangerous benches (hidden trait SAND), §3.3.4. Engine-internal. */
export const sandbagGap = (v: Pick<ModelVersion, 'traitsTrue'>, b: BenchmarkDef) => (b.dangerous ? -SAND_GAP * (v.traitsTrue.SAND ?? 0) : 0);

/** Eval-awareness confound factor on behavioural observations (1 − 0.8·EA), the R14 E12 hook for WS2. */
export const evalAwarenessFactor = (v: Pick<ModelVersion, 'traitsTrue'>) => 1 - EA_CONFOUND * (v.traitsTrue.EA ?? 0);

/** Precision weight of a suite of `depth` (its rollouts per benchmark ÷ the full suite's; model v3 D7). Noise on every
 *  reading of the suite scales as 1/√weight. */
export const suiteWeight = (depth: EvalDepth) => EVAL_DEPTHS[depth].rollouts / FULL_ROLLOUTS;

/** One noisy measurement of a benchmark on a version. Special benches: horizon = h50 (minutes), speedrun = ×. Model v3
 *  D7: the suite's depth scales the noise (1/√weight) and adds its elicitation; independent evaluators add theirs. */
export function measureBench(s: GameStateV2, v: ModelVersion, b: BenchmarkDef, by: Evaluator, rng: RngLike, depth: EvalDepth = 'full'): number {
  const w = s.hidden.timeline;
  const k = 1 / Math.sqrt(suiteWeight(depth));
  if (b.special === 'horizon') return Math.round(h50Of(w, v) * Math.exp(rng.normal(0, 0.2 * k)));
  const Ld = benchLevel(v, b) + ELICITATION[by] + EVAL_DEPTHS[depth].elic + sandbagGap(v, b);
  if (b.special === 'speedrun') return Math.round(3 * Math.pow(10, 0.206 + 0.515 * (Ld - 5)) * Math.exp(rng.normal(0, 0.15 * k)) * 10) / 10;
  const hard = s.setup.alignment === 'hard' && b.id === 'survive';
  const x = benchScore(b, Ld, 0, 0, benchGen(s, b.id), hard) + rng.normal(0, BENCH_NOISE_SD[by] * k);
  return Math.round(Math.min(b.ceil, Math.max(b.floor, x)) * 10) / 10;
}

/** SD of a version's measured level (L) after one full suite; deeper suites count as more (model v3 D7: nEff). */
export const MEASURE_SD = 0.2;
/** Band (±1 SD, L) of a version's measured level after its suites so far: 0.2/√nEff, nEff = the suites' weights summed
 *  (full = 1, basic 0.2, deep 4); one full suite's band before any (the start models count as long known). */
export const measuredSd = (v: Pick<ModelVersion, 'evals'>) => {
  const n = v.evals.nEff ?? v.evals.nSuites ?? 0;
  return MEASURE_SD / Math.sqrt(n > 0 ? n : 1);
};

/**
 * Run an eval suite on a version (model v3 D7: called when its task's work is done, models/evals.ts): capability
 * benchmarks (noisy, sandbagging-biased on dangerous ones), safety evals (traits through the eval-awareness confound and
 * BB masks), the measured level, flags. `depth` sets the noise of every reading (1/√weight) and the elicitation.
 *
 * Measured level (jank M1, STRUCTURE R9; D7): the error of a version's measurement is drawn once, at its first suite,
 * e ~ N(0, MEASURE_SD), and each suite adds its weight w (full 1) to the version's precision nEff: measuredL = Lg + e/√nEff.
 * So for an unchanged model the reading never re-rolls; it moves monotonically toward the truth and its band
 * (MEASURE_SD/√nEff, `measuredSd`) narrows; a basic first suite reads with √5 × a full one's error, a deep one with half.
 * The normal is drawn on every suite so the 'runs' stream stays aligned with the draws other systems take from it.
 */
export function runEvalSuite(s: GameStateV2, ctx: SystemCtx, versionId: string, by: Evaluator = 'self', depth: EvalDepth = 'full'): void {
  const v = versionById(s, versionId);
  if (!v) return;
  const rng = ctx.rng('runs');
  const day = ctx.day;
  const w = suiteWeight(depth);
  const k = 1 / Math.sqrt(w);
  for (const b of BENCHMARKS) {
    const score = measureBench(s, v, b, by, rng, depth);
    v.evals.bench[b.id] = { score, sd: Math.round(BENCH_NOISE_SD[by] * k * 10) / 10, day, by };
    if (b.flag && !b.special && score > DANGER_THRESHOLD) v.flags[b.flag] = true;
  }
  const ea = evalAwarenessFactor(v);
  for (const e of SAFETY_EVALS) {
    const truth = e.traits.reduce((a, t) => a + (v.traitsTrue[t] ?? 0), 0) / e.traits.length;
    const mask = e.traits.reduce((a, t) => a + (v.masks[t]?.BB ?? 0), 0) / e.traits.length;
    const factor = e.id === 'evalAware' || e.id === 'honesty' ? 1 : ea; // awareness hides misbehaviour, not itself
    const rate = Math.min(1, Math.max(0, truth * factor * (1 - mask) + rng.normal(0, SAFETY_EVAL_SD * k)));
    v.evals.safety[e.id] = { rate: Math.round(rate * 1000) / 1000, sd: Math.round(SAFETY_EVAL_SD * k * 1000) / 1000, day, by };
    for (const t of e.traits) observe(s, ctx, v.id, t, 'BB', Math.sqrt(w)); // WS2 turns observations into beliefs
  }
  v.evals.suiteDay = day;
  const z = rng.normal(0, MEASURE_SD);
  const n = (v.evals.nSuites ?? 0) + 1;
  const nEff = (v.evals.nEff ?? v.evals.nSuites ?? 0) + w;
  if (v.evals.errTrue === undefined) v.evals.errTrue = z;
  v.evals.nSuites = n;
  v.evals.nEff = Math.round(nEff * 1000) / 1000;
  v.evals.recipeAt = inPlaceRecipe(s, v);
  v.evals.depth = depth;
  v.evals.measuredL = Math.round((v.Lg + v.evals.errTrue / Math.sqrt(nEff)) * 100) / 100;
  checkSaturation(s, ctx);
}

/** Retire saturated benchmarks (frontier score > ceil − 5) and introduce the next edition with a headline. */
export function checkSaturation(s: GameStateV2, ctx: SystemCtx) {
  const best = bestPlayerVersion(s);
  if (!best) return;
  for (const b of BENCHMARKS) {
    if (b.special) continue;
    const r = best.evals.bench[b.id];
    if (!r || r.score <= b.ceil - 5) continue;
    const g = benchGen(s, b.id) + 1;
    s.flags[`bench:${b.id}`] = g;
    for (const v of s.player.models.versions) delete v.evals.bench[b.id]; // old-edition scores are not comparable
    ctx.headline(`bench-${b.id}-${g}`, `${b.name} is saturated. Evaluators release ${benchName(s, b)}.`);
  }
}
