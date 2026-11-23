// Benchmark scores, eval suites, saturation and successors, eval-awareness confound (V2-SPEC §3.3.4). Owner: WS1.
import { jobAiShare, jobRecord } from '../safety/workPackage';
import {
  BENCHMARKS, BENCH_NOISE_SD, DANGER_THRESHOLD, EA_CONFOUND, ELICITATION, SAFETY_EVALS, SAND_GAP, SUCCESSOR_STEP,
  type BenchmarkDef,
} from '../../../data/v2/benchmarks';
import { EVAL_DEPTHS, FULL_ROLLOUTS } from '../../../data/v2/evals';
import { COGNITIVE } from '../../../data/v2/runDesign';
import { runAlignmentEvals } from '../safety/alignmentEvals';
import type { DomainId, EvalDepth, EvalRecord, GameStateV2, ModelVersion, RngLike, SystemCtx, TimelineWorld } from '../types';
import { gOfLevel, h50Of, levelOfG } from './capability';
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

/** RD-M01: a reading's score is kept off the floor and ceiling by this share of the span before it is inverted (a score
 *  at the floor or ceiling says only "below" or "above"; its weight there is tiny anyway). */
const P_EDGE = 0.005;
/** RD-M01: the smallest score sd (points) a reading is weighted with (the stored sd is rounded to 0.1). */
const MIN_SCORE_SD = 0.5;

/** RD-M01: the domain level a benchmark score reads (benchScore inverted at no elicitation and no gap) and its sd in L
 *  (score sd ÷ the curve's slope at that score). Special rows (horizon, speedrun) and multi-domain rows read none. */
export function benchReading(b: BenchmarkDef, score: number, sd: number, gen = 0, hard = false): { L: number; sd: number } | undefined {
  if (b.special || Array.isArray(b.domain)) return undefined;
  const span = b.ceil - b.floor;
  const p = Math.min(1 - P_EDGE, Math.max(P_EDGE, (score - b.floor) / span));
  const mL = (hard && b.mLHard !== undefined ? b.mLHard : b.mL) + gen * SUCCESSOR_STEP;
  return { L: mL + Math.log(p / (1 - p)) / b.kL, sd: Math.max(sd, MIN_SCORE_SD) / (span * b.kL * p * (1 - p)) };
}

/** RD-M01 (DD-08): per-domain levels fitted from a bench table. A domain's benchmark readings combine by inverse
 *  variance. Elicitation and sandbagging lower the scores, so they lower the fit. `genOf`: the edition each score was
 *  taken on; `hard`: alignment 'hard'. Since RD-M01b every domain has a single-domain row (MEDIA: MMMU, PHYS: EmbodiedBench). */
export function fitDomains(bench: EvalRecord['bench'], genOf: (id: string) => number, hard = false): { dom: Partial<Record<DomainId, number>>; sd: Partial<Record<DomainId, number>> } {
  const acc: Partial<Record<DomainId, { w: number; wl: number }>> = {};
  for (const b of BENCHMARKS) {
    const r = bench[b.id];
    const x = r && benchReading(b, r.score, r.sd, genOf(b.id), hard && b.id === 'survive');
    if (!x) continue;
    const a = (acc[b.domain as DomainId] ??= { w: 0, wl: 0 });
    const w = 1 / (x.sd * x.sd);
    a.w += w;
    a.wl += w * x.L;
  }
  const dom: Partial<Record<DomainId, number>> = {};
  const sd: Partial<Record<DomainId, number>> = {};
  for (const [d, a] of Object.entries(acc) as [DomainId, { w: number; wl: number }][]) {
    dom[d] = a.wl / a.w;
    sd[d] = 1 / Math.sqrt(a.w);
  }
  return { dom, sd };
}

/** RD-M01: the general level the domain fits imply. A version's domain levels are λ of its effective compute plus its
 *  per-domain offsets (its build, known to the lab), so each cognitive domain's fit reads an effective-compute offset
 *  ΔG_d = λ⁻¹(fit_d) − λ⁻¹(L_d); the offsets combine by inverse variance (in G) and the general level is λ(G + ΔG).
 *  Domains at the 0 / 15 clamp carry no reading. Undefined when no cognitive domain reads. */
export function fitGeneral(w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'domains'>, dom: Partial<Record<DomainId, number>>, sd: Partial<Record<DomainId, number>>): { L: number; sd: number } | undefined {
  let W = 0, WG = 0;
  for (const d of COGNITIVE) {
    const x = dom[d], e = sd[d], L = v.domains[d];
    if (x === undefined || e === undefined || !(L > 0 && L < 15)) continue;
    const slope = (gOfLevel(w, L + 0.1) - gOfLevel(w, L)) / 0.1; // OOM per L at the domain's level
    const wt = 1 / Math.max(1e-6, e * slope) ** 2;
    W += wt;
    WG += wt * (gOfLevel(w, Math.min(15, x)) - gOfLevel(w, L));
  }
  if (W <= 0) return undefined;
  const G = v.G + WG / W;
  const L = levelOfG(w, G);
  const sdL = (levelOfG(w, G + 0.05) - levelOfG(w, G - 0.05)) / 0.1 / Math.sqrt(W);
  return { L, sd: sdL };
}

/** RD-M01: fit a version's stored bench table into its measured level (general, per domain, sd). No-op without readings. */
export function refitMeasured(s: Pick<GameStateV2, 'flags' | 'setup' | 'hidden'>, v: ModelVersion): void {
  applyFit(s.hidden.timeline, v, (id) => benchGen(s, id), s.setup.alignment === 'hard');
}
/** RD-M01: store the fit of `v`'s bench table (editions `genOf`, `hard` survive row) as its measured level. */
export function applyFit(w: TimelineWorld, v: ModelVersion, genOf: (id: string) => number, hard: boolean): void {
  const f = fitDomains(v.evals.bench, genOf, hard);
  const g = fitGeneral(w, v, f.dom, f.sd);
  if (!g) return;
  v.evals.measuredL = Math.round(g.L * 100) / 100;
  v.evals.measuredDom = Object.fromEntries(Object.entries(f.dom).map(([d, x]) => [d, Math.round(Math.max(0, x) * 100) / 100]));
  v.evals.fitSd = Math.round(g.sd * 1000) / 1000;
}

/** SD of a version's measured level when its suite gave no fit sd (old records): 0.2/√nEff. */
export const MEASURE_SD = 0.2;
/** Band (±1 SD, L) of a version's measured level: the fit's sd (RD-M01); old records 0.2/√nEff. */
export const measuredSd = (v: Pick<ModelVersion, 'evals'>) => {
  if (v.evals.fitSd !== undefined) return v.evals.fitSd;
  const n = v.evals.nEff ?? v.evals.nSuites ?? 0;
  return MEASURE_SD / Math.sqrt(n > 0 ? n : 1);
};
/** RF-R2: inverse-variance pool of a benchmark's held reading (score ± sd, the current edition) and a new one. Score
 *  noise is additive on the score, so the pooled mean is the best estimate of the version's score on that edition and its
 *  sd shrinks with every reading. Stored to 0.1 point (score) and 0.01 (sd). */
export function poolReading(prev: { score: number; sd: number } | undefined, score: number, sd: number): { score: number; sd: number } {
  if (!prev) return { score, sd };
  const w0 = 1 / Math.max(1e-6, prev.sd) ** 2, w1 = 1 / Math.max(1e-6, sd) ** 2;
  return { score: Math.round(((w0 * prev.score + w1 * score) / (w0 + w1)) * 10) / 10, sd: Math.round((1 / Math.sqrt(w0 + w1)) * 100) / 100 };
}
/** RF-R2: the version changed in place (the continual-learning stream) since its last suite, so the readings it holds
 *  measured an earlier state of the model and the next suite starts a new pool. */
export const changedSinceSuite = (s: GameStateV2, v: ModelVersion) => v.evals.recipeAt !== undefined && Math.abs(inPlaceRecipe(s, v) - v.evals.recipeAt) > 1e-9;

/** CP3d (RD-M01), RF-R2: the band (±1 SD, L) a suite of `depth` by `by` is expected to leave: the fit of the lab's
 *  current readings (scores it already holds, never the truth), each pooled with one more reading at the new suite's
 *  noise (`alone`: that suite's readings alone, e.g. on a fresh version). The fitted sd depends on the scores the suite
 *  will draw, so this is the expectation at today's readings. Without readings: 0.2/√(nEff + weight). */
export function expectedFitSd(s: GameStateV2, v: ModelVersion, by: Evaluator, depth: EvalDepth, alone = false): number {
  const w = suiteWeight(depth);
  const sd = Math.round(BENCH_NOISE_SD[by] * (1 / Math.sqrt(w)) * 10) / 10;
  const fresh = alone || changedSinceSuite(s, v);
  const bench: EvalRecord['bench'] = {};
  for (const [id, r] of Object.entries(v.evals.bench)) if (r) bench[id] = { ...r, sd: fresh ? sd : poolReading(r, r.score, sd).sd };
  const f = fitDomains(bench, (id) => benchGen(s, id), s.setup.alignment === 'hard');
  const g = fitGeneral(s.hidden.timeline, v, f.dom, f.sd);
  if (g) return Math.round(g.sd * 1000) / 1000;
  const n = fresh ? 0 : v.evals.nEff ?? v.evals.nSuites ?? 0;
  return MEASURE_SD / Math.sqrt(n + w);
}

/**
 * Run an eval suite on a version (model v3 D7: called when its task's work is done, models/evals.ts): capability
 * benchmarks (noisy, sandbagging-biased on dangerous ones), safety evals (traits through the eval-awareness confound and
 * BB masks), the measured level, flags. `depth` sets the noise of every reading (1/√weight) and the elicitation.
 *
 * Measured level (RD-M01, DD-08): fitted from the version's benchmark scores (fitDomains, fitGeneral), so the suites' noise,
 * their elicitation, the evaluator's and sandbagging all flow into it. RF-R2: each benchmark's reading pools every suite
 * on the current edition by inverse variance (poolReading; checkSaturation drops retired editions), so the band shrinks
 * with suites; nEff sums the pooled suites' weights. A version changed in place since its last suite starts a new pool.
 * Special rows (horizon, speedrun) keep the latest reading. Danger flags read the suite's own score. No stored error draw.
 */
export function runEvalSuite(s: GameStateV2, ctx: SystemCtx, versionId: string, by: Evaluator = 'self', depth: EvalDepth = 'full'): void {
  const v = versionById(s, versionId);
  if (!v) return;
  const rng = ctx.rng('runs');
  const day = ctx.day;
  const w = suiteWeight(depth);
  const k = 1 / Math.sqrt(w);
  const fresh = changedSinceSuite(s, v);
  if (fresh) v.evals.bench = {};
  for (const b of BENCHMARKS) {
    const score = measureBench(s, v, b, by, rng, depth);
    const sd = Math.round(BENCH_NOISE_SD[by] * k * 10) / 10;
    v.evals.bench[b.id] = { ...(b.special ? { score, sd } : poolReading(v.evals.bench[b.id], score, sd)), day, by };
    if (b.flag && !b.special && score > DANGER_THRESHOLD) v.flags[b.flag] = true;
  }
  const ea = evalAwarenessFactor(v);
  // SR-22: expected = the believed mean misbehaviour rate over the safety evals (beliefs before this suite's readings).
  const mean = (f: (e: (typeof SAFETY_EVALS)[number]) => number) => SAFETY_EVALS.length ? SAFETY_EVALS.reduce((a, e) => a + f(e), 0) / SAFETY_EVALS.length : 0;
  const job = jobRecord(s, by === 'self' ? jobAiShare(s, 'suite') : 0, mean((e) => e.traits.reduce((a, t) => a + (v.beliefs[t]?.est ?? 0), 0) / e.traits.length));
  // SR-07: alignment evals: k of n test scenarios each, one evidence item per trait read (safety/alignmentEvals.ts).
  runAlignmentEvals(s, rng, day, v, by, w, ea);
  v.evals.suiteDay = day;
  v.evals.suiteJob = { ...job, observed: Math.round(mean((e) => v.evals.safety[e.id]?.rate ?? 0) * 1000) / 1000 };
  const n = (v.evals.nSuites ?? 0) + 1;
  const nEff = (fresh ? 0 : v.evals.nEff ?? v.evals.nSuites ?? 0) + w;
  v.evals.nSuites = n;
  v.evals.nEff = Math.round(nEff * 1000) / 1000;
  v.evals.recipeAt = inPlaceRecipe(s, v);
  v.evals.depth = depth;
  refitMeasured(s, v);
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
