// Benchmark scores, eval suites, saturation and successors, eval-awareness confound (V2-SPEC §3.3.4). Owner: WS1.
import {
  BENCHMARKS, BENCH_NOISE_SD, DANGER_THRESHOLD, EA_CONFOUND, ELICITATION, SAFETY_EVALS, SAFETY_EVAL_SD, SAND_GAP, SUCCESSOR_STEP,
  type BenchmarkDef,
} from '../../../data/v2/benchmarks';
import { observe } from '../safety/detection';
import type { GameStateV2, ModelVersion, RngLike, SystemCtx } from '../types';
import { h50Of } from './capability';
import { bestPlayerVersion, versionById } from './labs';

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

/** One noisy measurement of a benchmark on a version. Special benches: horizon = h50 (minutes), speedrun = ×. */
export function measureBench(s: GameStateV2, v: ModelVersion, b: BenchmarkDef, by: Evaluator, rng: RngLike): number {
  const w = s.hidden.timeline;
  if (b.special === 'horizon') return Math.round(h50Of(w, v) * Math.exp(rng.normal(0, 0.2)));
  const Ld = benchLevel(v, b) + ELICITATION[by] + sandbagGap(v, b);
  if (b.special === 'speedrun') return Math.round(3 * Math.pow(10, 0.206 + 0.515 * (Ld - 5)) * Math.exp(rng.normal(0, 0.15)) * 10) / 10;
  const hard = s.setup.alignment === 'hard' && b.id === 'survive';
  const x = benchScore(b, Ld, 0, 0, benchGen(s, b.id), hard) + rng.normal(0, BENCH_NOISE_SD[by]);
  return Math.round(Math.min(b.ceil, Math.max(b.floor, x)) * 10) / 10;
}

/** Eval-suite duration in days by gate depth (§3.3.5): full 14, external +21 [D within +14–30]. */
export function evalDaysFor(s: GameStateV2): number {
  const g = s.player.safety.evalGate;
  return g === 'none' ? 0 : g === 'basic' ? 7 : g === 'full' ? 14 : 35;
}

/**
 * Run a full eval suite on a version: capability benchmarks (noisy, sandbagging-biased on dangerous ones), safety
 * evals (traits through the eval-awareness confound and BB masks), measuredL = Lg + N(0, 0.2), flags.
 */
export function runEvalSuite(s: GameStateV2, ctx: SystemCtx, versionId: string, by: Evaluator = 'self'): void {
  const v = versionById(s, versionId);
  if (!v) return;
  const rng = ctx.rng('runs');
  const day = ctx.day;
  for (const b of BENCHMARKS) {
    const score = measureBench(s, v, b, by, rng);
    v.evals.bench[b.id] = { score, sd: BENCH_NOISE_SD[by], day, by };
    if (b.flag && !b.special && score > DANGER_THRESHOLD) v.flags[b.flag] = true;
  }
  const ea = evalAwarenessFactor(v);
  for (const e of SAFETY_EVALS) {
    const truth = e.traits.reduce((a, t) => a + (v.traitsTrue[t] ?? 0), 0) / e.traits.length;
    const mask = e.traits.reduce((a, t) => a + (v.masks[t]?.BB ?? 0), 0) / e.traits.length;
    const factor = e.id === 'evalAware' || e.id === 'honesty' ? 1 : ea; // awareness hides misbehaviour, not itself
    const rate = Math.min(1, Math.max(0, truth * factor * (1 - mask) + rng.normal(0, SAFETY_EVAL_SD)));
    v.evals.safety[e.id] = { rate: Math.round(rate * 1000) / 1000, sd: SAFETY_EVAL_SD, day, by };
    for (const t of e.traits) observe(s, ctx, v.id, t, 'BB', 1); // WS2 turns observations into beliefs
  }
  v.evals.suiteDay = day;
  v.evals.measuredL = Math.round((v.Lg + rng.normal(0, 0.2)) * 100) / 100;
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
