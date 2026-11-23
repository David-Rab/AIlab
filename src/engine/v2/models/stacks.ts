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
// e_stack = base (the start recipe and public knowledge) + Σ adopted effects. An adopted idea adds its full true effect
// at build-in (RD-E03, DD-12: no headroom, no routine tuning).
// Ideas are kept in scale buckets (s on a S_STEP grid), so the state stays small however many ideas a takeoff adopts.
//
// The lab's recipe compared with another lab's (secrets leaks, publish-research leaks) is recipeG at the common reference
// FLOP RECIPE_F, on the parts every lab has (pretraining, RL efficiency, RL ceiling; RD-B16): playerRecipeG for the
// player, actors/rivalModel.ts recipeOf for a rival's aggregate recipe. Model v3 F3 removed the know-how readout
// `player.pa` that stood for it in progress-years.
import { FLOP_RL_REF, RL_BUDGET } from '../../../data/v2/runDesign';
import { S_STEP, TRAIN_CAP } from '../../../data/v2/research';
import { SERVE_FLOP_MAX, U_DECODE, U_DECODE_MAX } from '../../../data/v2/workTypes';
import type { GameStateV2, ModelVersion, StackKey, StackState, SystemCtx } from '../types';
import { rlFamiliesAvailable, rlGainGeneral, rlWeights } from './effective';

export const STACK_KEYS: StackKey[] = ['pre', 'rlMid', 'rlCeil', 'train', 'serve'];

/** Start stacks: the leader's day-0 recipe is 0 in every stack; a follower starts `lag` OOM lower in the pretraining
 *  and RL-efficiency stacks (its start lag as V1 solved it). */
export function initialStacks(lag = 0): Record<StackKey, StackState> {
  const mk = (base: number): StackState => ({ base, buckets: [], n: 0, est: 0, estVar: 0 });
  return { pre: mk(-lag), rlMid: mk(-lag), rlCeil: mk(0), train: mk(0), serve: mk(0) };
}

const stacksOf = (s: GameStateV2) => s.player.research.stacks;
const lg = (F: number) => Math.log10(Math.max(1, F));

/** RF-R5: add an adopted result's believed estimate ± sd to a stack's believed total (readouts; never the true effect). */
export function addBelief(st: StackState, est: number, sd: number) {
  st.est = Math.round((st.est + est) * 1e4) / 1e4;
  st.estVar = Math.round((st.estVar + sd * sd) * 1e8) / 1e8;
}

/** Value of a stack at run FLOP F (OOM): base + Σ adopted · 10^(s·log₁₀F). */
export const stackAt = (st: StackState, F = FLOP_RL_REF): number => st.base + adoptedAt(st, F);
/** Adopted total at run FLOP F, excluding the base (OOM). */
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
 *  stacks), all of it at build-in (RD-E03). `count` = the ideas it holds, added to the stack's ideas adopted (a line's batch
 *  b; 0 for the second stack one idea also moves, RD-B17). */
export function addIdea(st: StackState, x: number, sx: number, fTest: number, count = 1) {
  const sr = Math.round(sx / S_STEP) * S_STEP;
  const coef = x * Math.pow(10, -sr * lg(fTest));
  let b = st.buckets.find((y) => Math.abs(y.s - sr) < S_STEP / 2);
  if (!b) {
    b = { s: Math.round(sr * 1000) / 1000, a: 0 };
    st.buckets.push(b);
    st.buckets.sort((p, q) => p.s - q.s);
  }
  b.a += coef;
  st.n += count;
}

/** Public knowledge (diffusion from a leader, tacit knowledge, safety spillover): scale-invariant. */
export function addPublic(st: StackState, oom: number) {
  st.base += oom;
}


// ───────────────────────────── G-equivalent of the recipe ─────────────────────────────

const REF_W_CACHE: { w?: ReturnType<typeof rlWeights> } = {};
const refW = () => (REF_W_CACHE.w ??= rlWeights('broad', rlFamiliesAvailable(() => false)));

/** RL gain of the reference post-training run (standard budget, broad) on a base of `flop` with RL recipe (mid, ceil). */
const refRlMemo = { m: new Map<number, Map<number, Map<number, number>>>(), n: 0 };
export function refRlGain(flop: number, mid: number, ceil: number): number {
  // P4: memoised on exactly its inputs (pure: the rest are module constants no harness changes). A rival's recipe today
  // is yesterday's one-day step (actors/rivalModel.ts recipeRates asks for both), so most calls repeat.
  let a = refRlMemo.m.get(flop);
  if (!a) refRlMemo.m.set(flop, (a = new Map()));
  let b = a.get(mid);
  if (!b) a.set(mid, (b = new Map()));
  let g = b.get(ceil);
  if (g === undefined) {
    if (refRlMemo.n++ > 4096) {
      refRlMemo.m.clear();
      refRlMemo.n = 0;
    }
    g = rlGainGeneral(flop, RL_BUDGET.standard * flop, refW(), mid, ceil);
    b.set(ceil, g);
  }
  return g;
}

/** The lab's latest base FLOP (the scale the readouts evaluate scale-dependent ideas at). */
export function latestBaseFlop(s: GameStateV2): number {
  const b = s.player.models.bases;
  return b.length ? b[b.length - 1].flop : FLOP_RL_REF;
}

/** G-equivalent of a recipe over the leader's day-0 recipe (OOM): pretraining efficiency + what the RL recipe adds to the
 *  reference post-training run + training throughput, at base FLOP `flop`. */
export const gEquivOf = (flop: number, pre: number, mid: number, ceil: number, train = 0) =>
  pre + refRlGain(flop, mid, ceil) - refRlGain(flop, 0, 0) + train;

/** A lab's recipe in the stack units every lab has (OOM over the leader's day-0 recipe): pretraining efficiency, RL
 *  efficiency (rlMid), RL ceiling (rlCeil). A rival's aggregate recipe (RivalPhys.rec) has this shape. */
export interface Recipe { pre: number; mid: number; ceil: number }
/** The common reference FLOP at which labs' recipes are compared (RD-B16): FLOP_RL_REF, the reference RL run's base
 *  (3e26, a 2025 frontier base). Fixed, so a comparison never moves because one lab trained a bigger base. */
export const RECIPE_F = FLOP_RL_REF;
/** RD-B16: the one G-equivalent of any lab's recipe (OOM): pretraining + what its RL recipe adds to the reference
 *  post-training run on a base of `F` FLOP. The player's (playerRecipeG) and a rival's (actors/rivalModel.ts recipeOf)
 *  both go through it at RECIPE_F for every player-vs-rival comparison. Training throughput is not a part: rivals have
 *  no such stack (they train at the fixed MFU × GOODPUT), so counting it would compare different parts. */
export const recipeG = (rec: Recipe, F = RECIPE_F) => gEquivOf(F, rec.pre, rec.mid, rec.ceil);
/** The player's recipe with its pretraining stack evaluated at run FLOP `F` (scale-dependent ideas at F). */
export const playerRecipe = (s: GameStateV2, F = RECIPE_F): Recipe => ({ pre: ePreAt(s, F), mid: rlMidNow(s), ceil: rlCeilNow(s) });
/** The player's recipe G at the common reference FLOP: the counterpart of a rival's recipeOf (secrets leaks, A4). */
export const playerRecipeG = (s: GameStateV2) => recipeG(playerRecipe(s, RECIPE_F), RECIPE_F);
/** The player's own recipe G at run FLOP `F`, training throughput included (OOM). */
export const ownRecipeG = (s: GameStateV2, F: number) => recipeG(playerRecipe(s, F), F) + trainNow(s);
/** RD-B16: the part of the player's recipe G at run FLOP `F` its own research made (OOM): ownRecipeG without the
 *  pretraining stack's base, where all public knowledge lands (addPublic; it enters G linearly, so this removes it
 *  exactly; the other bases hold only the fixed start lag). Software progress is its change between research days with
 *  F held at the earlier day's base (models/research.ts capResearchDay). */
export const researchG = (s: GameStateV2, F: number) => ownRecipeG(s, F) - stacksOf(s).pre.base;

/** G-equivalent of the lab's stacks today, at its latest base (OOM; training throughput and public knowledge included):
 *  the level the weekly recipe history samples. Not for comparisons with other labs (playerRecipeG) nor for the rate
 *  (it jumps when a bigger base is trained). */
export function stacksGEquiv(s: GameStateV2): number {
  return ownRecipeG(s, latestBaseFlop(s));
}

/** Public knowledge in the lab's recipe (OOM): Σ of the stacks' bases (the start lag plus every diffusion, tacit
 *  knowledge and spillover inflow, addPublic). The public-knowledge readout is its daily change (RD-B16). */
export const publicBase = (s: GameStateV2) => STACK_KEYS.reduce((a, k) => a + stacksOf(s)[k].base, 0);

/** The recipe a version embodies, as its G-equivalent (OOM, gEquivOf at its build's FLOP): the
 *  recipe it was trained with (its base's pretraining recipe, its own RL recipe); RD-T03: once the stream continued its
 *  pretraining, the pretraining recipe its build now embodies (what remains of its G_pre past its base's physical part
 *  at its FLOP, as a continued base's ePre). Known to the lab (the stacks it adopted), so the auto-evaluate policy reads
 *  it to see whether a version changed in place since its last suite (model v3 F6: it read the true level before).
 *  Only the stream changes a version in place (models/runs.ts applyStreamPeriod). */
export function inPlaceRecipe(s: GameStateV2, v: ModelVersion): number {
  const base = s.player.models.bases.find((b) => b.id === v.baseId);
  const b = v.build;
  const F = b?.flopPre ?? base?.flop ?? FLOP_RL_REF;
  const pre = base && b?.addTokens !== undefined ? b.gPre - (base.gPre - base.ePre) - Math.log10(F / base.flop) : (base?.ePre ?? 0);
  return gEquivOf(F, pre, b?.eRL ?? 0, b?.aRL ?? 0);
}

/** Knowledge that arrives from outside (diffusion, tacit knowledge, safety spillover), dG OOM of effective compute: added
 *  to the pretraining stack as public ideas and the cause recorded (model v3 F3: the amounts are the old
 *  progress-years × B). */
export function addKnowledge(s: GameStateV2, ctx: Pick<SystemCtx, 'cause'> | undefined, dG: number, source: string, detail?: string) {
  if (!Number.isFinite(dG) || dG === 0) return;
  addPublic(stacksOf(s).pre, dG);
  ctx?.cause('player.recipe', dG, source, detail);
}
