// Recipe stacks (model v3 V2: design/MODEL-V3.md §5.5, design/archive/V3-BUILD.md V2.1, V2.6, V2.7). Owner: WS1.
//
// The lab's recipe efficiency is a set of stacks built from adopted ideas, not a know-how number:
//   pre     pretraining efficiency e_pre (OOM of effective compute; paradigm-tier ideas make it a function of the run's
//           FLOP: an idea measured at F_test adds x·(1 + κ·log₁₀(F/F_test)), κ ≤ KAPPA_MAX; every other idea adds x at
//           any F; SCALE-DIAG M1, Gundlach et al. 2025)
//   rlMid   RL compute efficiency (OOM; moves the RL curve's midpoint C_mid)
//   rlCeil  RL ceiling (OOM added to the curve's asymptote A)
//   train   training throughput (OOM of model FLOP per chip-day: MFU × goodput), capped (TRAIN_CAP)
//   serve   serving efficiency (OOM of serving throughput: decode utilisation up to 0.15, then less FLOP per token of
//           new versions; serveSplit, model v3 D10)
// e_stack = base (the start recipe; fixed after day 0) + Σ adopted effects. An adopted idea adds its full true effect at
// build-in (RD-E03, DD-12: no headroom, no routine tuning).
// Ideas are kept in scale buckets (κ on a K_STEP grid), so the state stays small however many ideas a takeoff adopts.
//
// F1 (design/bal/NPC-FIX.md): know-how from outside (rule A diffusion, C4 tacit knowledge) is not added to the stacks. It
// is the DIFFUSED level D (research.diffused), and the player's EFFECTIVE recipe is max(own, D) at RECIPE_F, where own
// (ownKnowhowG) is the recipe of the stacks alone: the pretraining stack carries diffusedLift = max(0, D − own) on top of
// its own value at every run FLOP (ePreAt), so every reader of the recipe (playerRecipeG, models' ePre at training,
// stacksGEquiv) sees the max, and once own research passes D the lift is 0 (no double count). researchG stays the own part.
// D and own are on one know-how scale, recipe G at RECIPE_F in OOM over the leader's day-0 recipe; npc/shocks.ts knowhowAt
// places the NPC labs on it. Model v3 F3 removed the know-how readout `player.pa` that stood for it in progress-years.
import { FLOP_RL_REF, RL_BUDGET } from '../../../data/v2/runDesign';
import { K_STEP, TRAIN_CAP } from '../../../data/v2/research';
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

/** Value of a stack at run FLOP F (OOM): base + Σ adopted x_i·(1 + κ_i·log₁₀(F/F_test,i)). */
export const stackAt = (st: StackState, F = FLOP_RL_REF): number => st.base + adoptedAt(st, F);
/** Adopted total at run FLOP F, excluding the base (OOM). */
export function adoptedAt(st: StackState, F = FLOP_RL_REF): number {
  let v = 0;
  const l = lg(F);
  for (const b of st.buckets) v += b.t === undefined ? b.a * Math.pow(10, b.s * l) : Math.max(Math.min(0, b.a), b.a + b.s * (b.a * l - b.t));
  return v;
}

/** Pretraining efficiency for a run of `flop` FLOP (OOM over the start recipe E_START): the own stack plus the diffused
 *  know-how in effect (diffusedLift, F1). */
export const ePreAt = (s: GameStateV2, flop: number) => stackAt(stacksOf(s).pre, flop) + diffusedLift(s);
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

/** Add an adopted idea's true effect to a stack: `x` at test FLOP `fTest`, relative scale slope `kappa` per OOM of run
 *  FLOP (0 for a scale-invariant idea and every stack but pretraining), all of it at build-in (RD-E03). `count` = the ideas it holds, added to the stack's ideas adopted (a line's batch
 *  b; 0 for the second stack one idea also moves, RD-B17). */
export function addIdea(st: StackState, x: number, kappa: number, fTest: number, count = 1) {
  const kr = Math.round(Math.max(0, kappa) / K_STEP) * K_STEP;
  let b = st.buckets.find((y) => y.t !== undefined && Math.abs(y.s - kr) < K_STEP / 2);
  if (!b) {
    b = { s: Math.round(kr * 1000) / 1000, a: 0, t: 0 };
    st.buckets.push(b);
    st.buckets.sort((p, q) => p.s - q.s);
  }
  b.a += x;
  b.t = (b.t ?? 0) + x * lg(fTest);
  st.n += count;
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
 *  efficiency (rlMid), RL ceiling (rlCeil). An NPC lab's know-how is one number on recipeG's scale (npc/shocks.ts npcKnowhow). */
export interface Recipe { pre: number; mid: number; ceil: number }
/** The common reference FLOP at which labs' recipes are compared (RD-B16): FLOP_RL_REF, the reference RL run's base
 *  (3e26, a 2025 frontier base). Fixed, so a comparison never moves because one lab trained a bigger base. */
export const RECIPE_F = FLOP_RL_REF;
/** RD-B16: the one G-equivalent of any lab's recipe (OOM): pretraining + what its RL recipe adds to the reference
 *  post-training run on a base of `F` FLOP. The player's know-how (playerRecipeG, ownKnowhowG) is it at RECIPE_F, the
 *  scale every player-vs-NPC know-how comparison is on (npc/shocks.ts knowhowAt). Training throughput is not a part: it
 *  is how fast chips train, not what the lab knows about recipes. */
export const recipeG = (rec: Recipe, F = RECIPE_F) => gEquivOf(F, rec.pre, rec.mid, rec.ceil);
/** The player's EFFECTIVE recipe with its pretraining stack evaluated at run FLOP `F` (scale-dependent ideas at F; the
 *  diffused know-how in effect included, ePreAt). */
export const playerRecipe = (s: GameStateV2, F = RECIPE_F): Recipe => ({ pre: ePreAt(s, F), mid: rlMidNow(s), ceil: rlCeilNow(s) });
/** The player's EFFECTIVE recipe G at the common reference FLOP, max(own, D) (F1): what other labs see of it (the
 *  know-how shocks, npc/shocks.ts playerKnowhowPos) and what its versions stamp (recG). */
export const playerRecipeG = (s: GameStateV2) => recipeG(playerRecipe(s, RECIPE_F), RECIPE_F);

/** F1: the recipe G at RECIPE_F of stacks `st` alone (their bases plus adopted ideas; no diffused know-how). */
export const ownKnowhowOf = (st: Record<StackKey, StackState>) => recipeG({ pre: stackAt(st.pre, RECIPE_F), mid: stackAt(st.rlMid), ceil: stackAt(st.rlCeil) }, RECIPE_F);
/** F1: the player's OWN know-how: its recipe G at RECIPE_F from its stacks alone (its start and its own research; OOM over
 *  the leader's day-0 recipe). The scale the diffused level D and the NPC labs' know-how are on. */
export const ownKnowhowG = (s: GameStateV2) => ownKnowhowOf(stacksOf(s));
/** F1: the player's start recipe G at RECIPE_F: its stacks' bases, which never change after day 0 (the leader's solved
 *  start recipe ≈ 0, a follower its start lag lower). The anchor of the know-how scale (npc/shocks.ts knowhowAt). */
export const startRecipeG = (s: GameStateV2) => {
  const st = stacksOf(s);
  return recipeG({ pre: st.pre.base, mid: st.rlMid.base, ceil: st.rlCeil.base }, RECIPE_F);
};
/** F1: what the diffused level adds to the player's recipe now (OOM, ≥ 0): max(own, D) − own, so the recipe at RECIPE_F
 *  is max(own, D). Scale-invariant (added at every run FLOP). */
export const diffusedLift = (s: GameStateV2) => Math.max(0, s.player.research.diffused - ownKnowhowG(s));
/** F1/F2: raise the diffused level D to `D` (never lowers it). The effective recipe gains only what lifts max(own, D),
 *  and that gain is the cause recorded. Returns the gain (OOM). */
export function raiseDiffused(s: GameStateV2, ctx: Pick<SystemCtx, 'cause'> | undefined, D: number, source: string, detail?: string): number {
  const res = s.player.research;
  if (!Number.isFinite(D) || !(D > res.diffused)) return 0;
  const own = ownKnowhowG(s);
  const gain = Math.max(own, D) - Math.max(own, res.diffused);
  res.diffused = D;
  if (gain > 0) ctx?.cause('player.recipe', gain, source, detail);
  return gain;
}

/** The player's recipe G at run FLOP `F` from its stacks alone (no diffused know-how), training throughput included (OOM). */
export const ownRecipeG = (s: GameStateV2, F: number) => recipeG({ pre: stackAt(stacksOf(s).pre, F), mid: rlMidNow(s), ceil: rlCeilNow(s) }, F) + trainNow(s);
/** RD-B16: the part of the player's recipe G at run FLOP `F` its own research made (OOM): ownRecipeG without the
 *  pretraining stack's base (the start lag; the other bases hold the same fixed lag). No diffused know-how (F1).
 *  Software progress is its change between research days with F held at the earlier day's base (models/research.ts
 *  capResearchDay). */
export const researchG = (s: GameStateV2, F: number) => ownRecipeG(s, F) - stacksOf(s).pre.base;

/** G-equivalent of the lab's effective recipe today, at its latest base (OOM; training throughput and the diffused
 *  know-how in effect included): the level the weekly recipe history samples. Not for comparisons with other labs
 *  (playerRecipeG) nor for the rate (it jumps when a bigger base is trained). */
export function stacksGEquiv(s: GameStateV2): number {
  return ownRecipeG(s, latestBaseFlop(s)) + diffusedLift(s);
}

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

/** The lab's own finding that improves its pretraining recipe (safety spillover, SPILL): a scale-invariant own idea of
 *  `x` OOM in the pretraining stack, known exactly (believed = true; not counted as an adopted idea), the cause recorded.
 *  Own know-how, so part of own and of researchG, not of D (F1). */
export function addOwnInsight(s: GameStateV2, ctx: Pick<SystemCtx, 'cause'> | undefined, x: number, source: string, detail?: string) {
  if (!Number.isFinite(x) || x === 0) return;
  const pre = stacksOf(s).pre;
  addIdea(pre, x, 0, RECIPE_F, 0);
  addBelief(pre, x, 0);
  ctx?.cause('player.recipe', x, source, detail);
}
