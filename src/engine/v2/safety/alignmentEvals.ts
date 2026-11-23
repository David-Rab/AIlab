// SR-07 (SAFETY-REDESIGN §3.5, §4.3 channel 3): alignment-evaluation results as evidence, and the test-vs-real gap.
//
// An alignment eval runs n test scenarios on a model and counts the k in which it misbehaves (games the grader, schemes,
// sabotages, overreaches, says it is being tested). The result is k of n with a 90% interval (Wilson); it is an
// evidence item on each trait the eval reads, through the belief path (updateBelief: reading k/n, noise = the interval's
// sd). Behaviour in tests understates behaviour in real use by the model's evaluation awareness: real = test ÷ (1 −
// 0.8·EA) (the published confound, Opus 4 blackmail 55.1% believed-real vs 6.5% believed-eval; research/05 §1.7). The
// lab does not know EA: its believed band comes from the EA belief (fed by the eval-awareness eval's k of n), widened
// by any real-use reading (runtime monitor logs, case verdicts) that sits above the tests. Readouts read measured
// records and beliefs only, never true traits.
import { EA_CONFOUND, SAFETY_EVALS } from '../../../data/v2/benchmarks';
import type { BeliefEvidence, GameStateV2, ModelVersion, RngLike, TraitId } from '../types';
import { clamp01 } from './common';
import { SD_MAX, updateBelief } from './detection';
import { noteReading } from './disagreement';

/** Test scenarios per alignment eval in a full suite [D]: at a 20% rate the binomial sd √(p(1−p)/n) ≈ 0.063, the old
 *  SAFETY_EVAL_SD (0.06). A lighter suite runs n × its weight (floor ALIGN_EVAL_MIN_N). */
export const ALIGN_EVAL_N = 40;
export const ALIGN_EVAL_MIN_N = 10;
/** 90% two-sided z. */
export const EVAL_Z = 1.645;
/** A reading's noise never goes below this (a belief cannot be pinned by one test set) [D]. */
export const EVAL_SIGMA_FLOOR = 0.02;
/** Evals that awareness does not hide (it hides misbehaviour, not itself; honesty reads the same in both settings). */
export const NOT_HIDDEN = new Set(['evalAware', 'honesty']);

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** 90% Wilson interval of k of n. */
export function wilson(k: number, n: number, z = EVAL_Z): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return { lo: clamp01(c - h), hi: clamp01(c + h) };
}
export const scenarioCount = (weight: number) => Math.max(ALIGN_EVAL_MIN_N, Math.round(ALIGN_EVAL_N * weight));

function binomial(rng: RngLike, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng.float() < p) k++;
  return k;
}

/** One stored alignment-eval result (ModelVersion.evals.safety[id]). */
export function evalRecord(k: number, n: number, day: number, by: 'self' | 'evalGov' | 'evalIndep') {
  const { lo, hi } = wilson(k, n);
  return { rate: r3(k / n), sd: r3(Math.max(EVAL_SIGMA_FLOOR, (hi - lo) / (2 * EVAL_Z))), day, by, k, n, lo: r3(lo), hi: r3(hi) };
}

/**
 * Run the alignment evals on `v` (engine side: the world's propensity in test scenarios is the true trait × the
 * awareness confound × the behavioural mask, the same physics as before). Each eval stores k of n and adds one evidence
 * item per trait it reads (source "eval/BB/<eval id>"). `awareness` = 1 − 0.8·EA_true (models/benchmarks.ts).
 */
export function runAlignmentEvals(s: GameStateV2, rng: RngLike, day: number, v: ModelVersion, by: 'self' | 'evalGov' | 'evalIndep', weight: number, awareness: number): void {
  const n = scenarioCount(weight);
  for (const e of SAFETY_EVALS) {
    const truth = e.traits.reduce((a, t) => a + (v.traitsTrue[t] ?? 0), 0) / e.traits.length;
    const mask = e.traits.reduce((a, t) => a + (v.masks[t]?.BB ?? 0), 0) / e.traits.length;
    const p = clamp01(truth * (NOT_HIDDEN.has(e.id) ? 1 : awareness) * (1 - mask));
    v.evals.safety[e.id] = evalRecord(binomial(rng, n, p), n, day, by);
  }
  // SR-07b: evidence after the draws (draw order unchanged). Awareness-free evals first (evalAware feeds the EA belief
  // the gap reads), then each misbehaviour eval as a real-use reading through the believed gap.
  const order = [...SAFETY_EVALS.filter((e) => NOT_HIDDEN.has(e.id)), ...SAFETY_EVALS.filter((e) => !NOT_HIDDEN.has(e.id))];
  for (const e of order) {
    const rec = v.evals.safety[e.id];
    const r = NOT_HIDDEN.has(e.id) ? { reading: rec.rate, sigma: rec.sd } : realUseReading(rec.rate, rec.sd, testGapView(v));
    for (const t of e.traits) evalEvidence(s, day, v, t, r.reading, r.sigma, e.id);
  }
}

/**
 * SR-07b: a test rate as evidence on the trait (behaviour in real use) through the believed test-vs-real gap [gLo, gHi]:
 * reading = rate × the band's midpoint; noise = √((sd·g_mid)² + (rate·(gHi − gLo) ÷ (2·1.645))²), the test interval
 * scaled up plus the gap band's own width as a 90% range. A wider believed gap (an unknown eval awareness, or real-use
 * logs above the tests) gives a noisier reading and so a wider trait belief; a known small gap leaves the test reading.
 */
export function realUseReading(rate: number, sd: number, gap: Pick<TestGapView, 'gLo' | 'gHi'>): { reading: number; sigma: number } {
  const gMid = (gap.gLo + gap.gHi) / 2;
  const gHalf = (gap.gHi - gap.gLo) / (2 * EVAL_Z);
  const sigma = Math.min(SD_MAX, Math.max(EVAL_SIGMA_FLOOR, Math.sqrt((sd * gMid) ** 2 + (rate * gHalf) ** 2)));
  return { reading: r3(clamp01(rate * gMid)), sigma: r3(sigma) };
}

/** One alignment-eval result as an evidence item on a belief (the existing path: disagreement check, Gaussian update). */
export function evalEvidence(s: GameStateV2, day: number, v: ModelVersion, trait: TraitId, reading: number, sigma: number, evalId: string): void {
  const prior = v.beliefs[trait] ?? { est: 0.2, sd: SD_MAX, clarity: 0, evidence: [] };
  noteReading(s, day, v, trait, 'BB', 'eval', reading, sigma, prior.evidence);
  v.beliefs[trait] = updateBelief(prior, reading, sigma, day, `eval/BB/${evalId}`);
}

/** Real-use readings in a belief's evidence: runtime monitor logs and case verdicts (deployment, not tests). */
const isRealUse = (e: BeliefEvidence) => e.source.startsWith('monitor/') || e.source === 'case' || e.source.startsWith('case/');
const isTest = (e: BeliefEvidence) => e.source.startsWith('eval/') || e.source.startsWith('suite/') || e.source.startsWith('external/') || e.source.startsWith('bench/');

export interface TestGapView {
  /** Believed eval awareness, 90% band (from the EA belief). */
  eaLo: number; eaHi: number;
  /** The eval-awareness eval's last result (k of n), if run. */
  measured?: { k: number; n: number; lo: number; hi: number };
  /** Believed factor by which tests understate real use (1 = no gap), 90% band. */
  gLo: number; gHi: number;
  /** Real-use vs test readings on the same traits (latest of each), when both exist: ratio real ÷ test. */
  logs?: { trait: TraitId; test: number; real: number; ratio: number }[];
}

/** The lab's believed test-vs-real gap for `v` (beliefs and measured records only). */
export function testGapView(v: Pick<ModelVersion, 'beliefs' | 'evals'>): TestGapView {
  const b = v.beliefs.EA;
  const est = b?.est ?? 0.2, sd = b?.sd ?? SD_MAX;
  const eaLo = clamp01(est - EVAL_Z * sd), eaHi = clamp01(est + EVAL_Z * sd);
  const g = (ea: number) => 1 / (1 - EA_CONFOUND * ea);
  let gLo = g(eaLo), gHi = g(eaHi);
  const logs: NonNullable<TestGapView['logs']> = [];
  for (const t of ['SCHEME', 'SAND', 'POWER', 'RH'] as TraitId[]) {
    const ev = v.beliefs[t]?.evidence ?? [];
    // SR-07b: eval evidence is stored on the real-use scale, so the test side is the latest raw k / n record reading t
    // (else the latest other test reading).
    const recs = SAFETY_EVALS.filter((e) => (e.traits as readonly TraitId[]).includes(t)).map((e) => v.evals.safety[e.id]).filter((r) => !!r?.n);
    const rec = recs.reduce<(typeof recs)[number] | undefined>((a, r) => (!a || r.day > a.day ? r : a), undefined);
    const other = [...ev].reverse().find((e) => isTest(e) && !e.source.startsWith('eval/'));
    const test = rec && (!other || rec.day >= other.day) ? { reading: rec.rate } : other;
    const real = [...ev].reverse().find(isRealUse);
    if (!test || !real || test.reading < 0.02) continue;
    const ratio = real.reading / test.reading;
    logs.push({ trait: t, test: test.reading, real: real.reading, ratio: r3(ratio) });
    if (ratio > gHi) gHi = ratio; // real use above tests by more than awareness explains: the band widens up
  }
  const m = v.evals.safety.evalAware;
  return {
    eaLo: r3(eaLo), eaHi: r3(eaHi), gLo: r3(gLo), gHi: r3(gHi),
    measured: m?.n ? { k: m.k, n: m.n, lo: m.lo, hi: m.hi } : undefined,
    logs: logs.length ? logs : undefined,
  };
}

export interface AlignmentEvalRow {
  id: string; name: string; k: number; n: number; lo: number; hi: number; day: number; by: 'self' | 'evalGov' | 'evalIndep';
  /** Believed real-use rate, 90% band: the test interval × the gap band (awareness evals: the test interval). */
  realLo: number; realHi: number; hidden: boolean;
}

/** SR-07 readout: per alignment eval, k of n in tests with its interval and the believed real-use band; the gap. */
export function alignmentEvalView(v: Pick<ModelVersion, 'beliefs' | 'evals'>): { rows: AlignmentEvalRow[]; gap: TestGapView } {
  const gap = testGapView(v);
  const rows: AlignmentEvalRow[] = [];
  for (const e of SAFETY_EVALS) {
    const r = v.evals.safety[e.id];
    if (!r?.n) continue;
    const { k, lo, hi } = r;
    const hidden = !NOT_HIDDEN.has(e.id);
    rows.push({ id: e.id, name: e.name, k, n: r.n, lo, hi, day: r.day, by: r.by, hidden,
      realLo: r3(hidden ? clamp01(lo * gap.gLo) : lo), realHi: r3(hidden ? clamp01(hi * gap.gHi) : hi) });
  }
  return { rows, gap };
}
