// Recipe stacks (model v3 V2: design/MODEL-V3.md §5.5, design/V3-BUILD.md V2.1, V2.6, V2.7). Owner: WS1.
//
// The lab's recipe efficiency is a set of stacks built from adopted ideas, not a know-how number:
//   pre     pretraining efficiency e_pre (OOM of effective compute; scale-dependent ideas make it a function of the run's
//           FLOP: an idea measured at F_test adds x·(F/F_test)^s)
//   rlMid   RL compute efficiency (OOM; moves the RL curve's midpoint C_mid)
//   rlCeil  RL ceiling (OOM added to the curve's asymptote A)
//   train   training throughput (OOM of model FLOP per chip-day: MFU × goodput), capped (TRAIN_CAP)
//   serve   serving efficiency (OOM of serving throughput: decode utilisation up to 0.15, then less FLOP per token of
//           new versions; serveSplit, model v3 D10)
// e_stack = base (the start recipe and public knowledge) + Σ adopted effects − remaining headroom. An adopted idea adds
// its true effect; HEADROOM of it waits for routine tuning, which closes it at TUNE_K × tuning capacity × its experiment
// throughput per day (models/research.ts).
// Ideas are kept in scale buckets (s on a S_STEP grid), so the state stays small however many ideas a takeoff adopts.
//
// BRIDGE(V6,V7): `player.pa` is a read-only readout, pa = pa₀ + (G-equivalent of the stacks) / B, for the readers that
// still compare know-how (rivals' diffusion and theft, safety tiers, the limits view). Nothing reads the stacks from pa.
import { B_G_PER_Y, FLOP_RL_REF, RL_BUDGET } from '../../../data/v2/runDesign';
import { HEADROOM, S_STEP, TRAIN_CAP } from '../../../data/v2/research';
import { SERVE_FLOP_MAX, U_DECODE, U_DECODE_MAX } from '../../../data/v2/workTypes';
import type { GameStateV2, StackKey, StackState, SystemCtx, TimelineWorld } from '../types';
import { paRef } from './capability';
import { rlFamiliesAvailable, rlGains, rlWeights } from './effective';

export const STACK_KEYS: StackKey[] = ['pre', 'rlMid', 'rlCeil', 'train', 'serve'];

/** Start stacks: the leader's day-0 recipe is 0 in every stack; a follower starts `lag` OOM lower in the pretraining
 *  and RL-efficiency stacks (its start lag as V1 solved it). */
export function initialStacks(lag = 0): Record<StackKey, StackState> {
  const mk = (base: number): StackState => ({ base, buckets: [], n: 0 });
  return { pre: mk(-lag), rlMid: mk(-lag), rlCeil: mk(0), train: mk(0), serve: mk(0) };
}

const stacksOf = (s: GameStateV2) => s.player.research.stacks;
const lg = (F: number) => Math.log10(Math.max(1, F));

/** Value of a stack at run FLOP F (OOM): base + Σ (adopted − headroom) · 10^(s·log₁₀F). */
export function stackAt(st: StackState, F = FLOP_RL_REF): number {
  let v = st.base;
  const l = lg(F);
  for (const b of st.buckets) v += (b.a - b.h) * Math.pow(10, b.s * l);
  return v;
}
/** Remaining headroom of a stack at run FLOP F (OOM). */
export function headroomAt(st: StackState, F = FLOP_RL_REF): number {
  let v = 0;
  const l = lg(F);
  for (const b of st.buckets) v += b.h * Math.pow(10, b.s * l);
  return v;
}
/** Adopted total (before headroom) at run FLOP F, excluding the base (OOM). */
export function adoptedAt(st: StackState, F = FLOP_RL_REF): number {
  let v = 0;
  const l = lg(F);
  for (const b of st.buckets) v += b.a * Math.pow(10, b.s * l);
  return v;
}

/** Pretraining efficiency for a run of `flop` FLOP (OOM over the start recipe E_START). */
export const ePreAt = (s: GameStateV2, flop: number) => stackAt(stacksOf(s).pre, flop);
/** RL compute efficiency (OOM; C_mid ÷ 10^this). */
export const rlMidNow = (s: GameStateV2) => stackAt(stacksOf(s).rlMid);
/** RL ceiling raise (OOM added to A). */
export const rlCeilNow = (s: GameStateV2) => stackAt(stacksOf(s).rlCeil);
/** Training throughput (OOM of model FLOP per chip-day over MFU 0.40 × goodput 0.90), capped at TRAIN_CAP. */
export const trainNow = (s: GameStateV2) => Math.min(TRAIN_CAP, stackAt(stacksOf(s).train));
/** Serving efficiency (OOM of serving throughput over the 2025 reference stack), ≥ 0. */
export const serveNow = (s: GameStateV2) => Math.max(0, stackAt(stacksOf(s).serve));

/** Model v3 D10: what a serving stack of `e` OOM buys, by mechanism (R20 D1). Its first SERVE_U_OOM = log₁₀(0.15/0.07)
 *  raise the lab's decode utilisation from 0.07 toward 0.15, the top of the measured range (speculative decoding,
 *  continuous batching, disaggregated prefill/decode, kernels: the fleet's serving software, for every model the lab
 *  serves at once); what lies beyond is a compute-equivalent factor on the FLOP per token of versions trained after it
 *  (quantisation below FP8, sparsity, kernels for the architecture: 10^(−flop), at most SERVE_FLOP_MAX = 1 OOM)
 *  [D: utilisation first because R20 D1 names it as where inference know-how goes; it is capped by memory bandwidth,
 *  so the rest must cut FLOP]. */
export const SERVE_U_OOM = Math.log10(U_DECODE_MAX / U_DECODE);
export function serveSplit(e: number): { u: number; flop: number } {
  const x = Math.max(0, e);
  return { u: Math.min(x, SERVE_U_OOM), flop: serveFlopOomOf(x) };
}
/** Decode utilisation of a serving stack of `e` OOM: 0.07 × 10^min(e, SERVE_U_OOM) (≤ 0.15). */
export const decodeUtilOf = (e: number) => U_DECODE * Math.pow(10, Math.min(Math.max(0, e), SERVE_U_OOM));
/** OOM less FLOP per token of new versions from a serving stack of `e` OOM (the part beyond the utilisation cap, at most
 *  SERVE_FLOP_MAX). */
export const serveFlopOomOf = (e: number) => Math.min(SERVE_FLOP_MAX, Math.max(0, e - SERVE_U_OOM));
/** The player's decode utilisation today (its serving stack). */
export const decodeUtilNow = (s: GameStateV2) => decodeUtilOf(serveNow(s));

/** Model v3 D10: G-equivalent of a version's RL recipe over the leader's day-0 recipe (OOM): what its RL efficiency and
 *  ceiling add to the reference post-training run on its base. Memoised per build (the build is replaced, not mutated,
 *  when a version is retrained; the memo checks its inputs anyway). */
const rlGMemo = new WeakMap<object, { e: number; a: number; f: number; g: number }>();
export function rlGOfBuild(b: { eRL: number; aRL?: number; flopPre: number }): number {
  const a = b.aRL ?? 0;
  const m = rlGMemo.get(b);
  if (m && m.e === b.eRL && m.a === a && m.f === b.flopPre) return m.g;
  const g = b.flopPre > 1 && (b.eRL !== 0 || a !== 0) ? refRlGain(b.flopPre, b.eRL, a) - refRlGain(b.flopPre, 0, 0) : 0;
  rlGMemo.set(b, { e: b.eRL, a, f: b.flopPre, g });
  return g;
}

/** Add an adopted idea's true effect to a stack: `x` at test FLOP `fTest`, scale exponent `sx` (0 for scale-invariant
 *  stacks). HEADROOM of it is headroom. */
export function addIdea(st: StackState, x: number, sx: number, fTest: number) {
  const sr = Math.round(sx / S_STEP) * S_STEP;
  const coef = x * Math.pow(10, -sr * lg(fTest));
  let b = st.buckets.find((y) => Math.abs(y.s - sr) < S_STEP / 2);
  if (!b) {
    b = { s: Math.round(sr * 1000) / 1000, a: 0, h: 0 };
    st.buckets.push(b);
    st.buckets.sort((p, q) => p.s - q.s);
  }
  b.a += coef;
  b.h += HEADROOM * coef;
  st.n += 1;
}

/** Public knowledge (diffusion from a leader, tacit knowledge, safety spillover): scale-invariant, no headroom. */
export function addPublic(st: StackState, oom: number) {
  st.base += oom;
}

/** One day of routine tuning: every stack's headroom shrinks by the factor exp(−k), k = TUNE_K × research-engineer
 *  team-equivalents on tuning × their experiment throughput (models/research.ts capResearchDay). */
export function tuneDay(s: GameStateV2, k: number) {
  const f = Math.exp(-Math.max(0, k));
  for (const k of STACK_KEYS) for (const b of stacksOf(s)[k].buckets) b.h *= f;
}

// ───────────────────────────── G-equivalent and the pa readout (BRIDGE(V6,V7)) ─────────────────────────────

const REF_W_CACHE: { w?: ReturnType<typeof rlWeights> } = {};
const refW = () => (REF_W_CACHE.w ??= rlWeights('broad', rlFamiliesAvailable(() => false)));

/** RL gain of the reference post-training run (standard budget, broad) on a base of `flop` with RL recipe (mid, ceil). */
export const refRlGain = (flop: number, mid: number, ceil: number) => rlGains(flop, RL_BUDGET.standard * flop, refW(), mid, ceil).general;

/** The lab's latest base FLOP (the scale the readouts evaluate scale-dependent ideas at). */
export function latestBaseFlop(s: GameStateV2): number {
  const b = s.player.models.bases;
  return b.length ? b[b.length - 1].flop : FLOP_RL_REF;
}

/** G-equivalent of a recipe over the leader's day-0 recipe (OOM): pretraining efficiency + what the RL recipe adds to the
 *  reference post-training run + training throughput, at base FLOP `flop`. */
export const gEquivOf = (flop: number, pre: number, mid: number, ceil: number, train = 0) =>
  pre + refRlGain(flop, mid, ceil) - refRlGain(flop, 0, 0) + train;

/** G-equivalent of the lab's stacks today, at its latest base (OOM). */
export function stacksGEquiv(s: GameStateV2): number {
  const F = latestBaseFlop(s);
  return gEquivOf(F, ePreAt(s, F), rlMidNow(s), rlCeilNow(s), trainNow(s));
}

/** BRIDGE(V6,V7): pa-equivalent of a G-equivalent recipe in world w. */
export const paOfGEquiv = (w: TimelineWorld, g: number) => paRef(w) + g / B_G_PER_Y;

/** BRIDGE(V6,V7): refresh the read-only know-how readout `player.pa` from the stacks. */
export function syncPa(s: GameStateV2) {
  s.player.pa = paOfGEquiv(s.hidden.timeline, stacksGEquiv(s));
}

/** Knowledge that arrives from outside (BRIDGE(V6,V7) units: progress-years of v2 know-how): added to the pretraining
 *  stack as public ideas (B OOM per year, no headroom), the readout synced and the cause recorded. */
export function addKnowledge(s: GameStateV2, ctx: Pick<SystemCtx, 'cause'> | undefined, years: number, source: string, detail?: string) {
  if (!Number.isFinite(years) || years === 0) return;
  const before = s.player.pa;
  addPublic(stacksOf(s).pre, years * B_G_PER_Y);
  syncPa(s);
  ctx?.cause('player.pa', s.player.pa - before, source, detail);
}
