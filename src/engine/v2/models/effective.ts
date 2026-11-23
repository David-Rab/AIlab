// Effective compute (model v3 V1; design/MODEL-V3.md §2–§4, research/20 §A, §C). Owner: WS1.
//
// Capability currency G = log₁₀(effective compute) = log₁₀(FLOP) + recipe efficiency + shape + data effects, plus the
// post-training RL gain. Everything here is pure arithmetic on physical quantities (parameters, tokens, FLOP) and
// recipe OOMs, so it can be tested in isolation (scripts/v2/effective.ts). The display level λ(G) and the start
// state live in models/capability.ts.
import {
  COGNITIVE, DISTILL, DISTILL_TOKEN_SLOPE, DISTILL_TPP, LOSS_LAW, OPT_TPP, REF_TPP, REPEAT_R_STAR, RL_BUDGET, RL_CURVE,
  LONG_TASKS_HORIZON, RL_FAMILIES, RL_FAMILY_IDS, RL_FAMILY_NEEDS, RL_FOCUS_SHARE, RL_REF_GAIN, RL_TRANSFER, FLOP_RL_REF, SHAPE,
} from '../../../data/v2/runDesign';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import type { BaseDesign, DomainId, RLFamily } from '../types';

export type DomainMap = Partial<Record<DomainId, number>>;
export type FamilyMap = Partial<Record<RLFamily, number>>;

// ───────────────────────────── pretraining (§3.2) ─────────────────────────────

/** Training FLOP of a dense-equivalent run: 6 · N_active · D (Kaplan et al. 2020; R20 A1). */
export const trainFlop = (params: number, tokens: number) => 6 * params * tokens;
/** FLOP of a base design: D = tpp · N_active. */
export const flopOfDesign = (d: Pick<BaseDesign, 'params' | 'tpp'>) => trainFlop(d.params, d.params * d.tpp);
/** Active parameters of a run of `flop` FLOP at `tpp` tokens per parameter (inverse of flopOfDesign). */
export const paramsForFlop = (flop: number, tpp: number) => Math.sqrt(flop / (6 * tpp));

/** Overtraining: effective-compute fraction at r tokens per parameter, 10^(−0.2·log₁₀(r/20)²) [R20 A1, fit to the
 *  Besiroglu refit within ±0.02 over r = 20–2000]. 10× over → 0.6, 100× → 0.16. Symmetric below 20 (undertrained). */
export const fOver = (tpp: number) => Math.pow(10, -0.2 * Math.pow(Math.log10(Math.max(1e-9, tpp) / OPT_TPP), 2));

/** Loss law L(N, D) = E + A/N^α + B/D^β (Besiroglu et al. 2024 [R20 A1]). */
export function lossOf(N: number, D: number): number {
  const { E, A, B, alpha, beta } = LOSS_LAW;
  return E + A / Math.pow(N, alpha) + B / Math.pow(D, beta);
}
/** Compute-optimal loss at compute C (minimum of the law along 6ND = C, closed form). */
export function optLoss(C: number): number {
  const { A, B, alpha, beta } = LOSS_LAW;
  const G = Math.pow((alpha * A) / (beta * B), 1 / (alpha + beta));
  const N = G * Math.pow(C / 6, beta / (alpha + beta));
  return lossOf(N, C / (6 * N));
}
/** log₁₀ of the compute a compute-optimal run needs to reach loss L (bisection; +∞ at or below the irreducible E). */
export function log10ComputeForLoss(L: number): number {
  if (L <= LOSS_LAW.E + 1e-12) return Infinity;
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (optLoss(Math.pow(10, mid)) > L) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Effective tokens from repeated data (Muennighoff et al. 2023 [R20 A3]): D_eff = U·(1 + R*·(1 − e^(−(ep−1)/R*)))
 *  with ep = D/U epochs; D itself while D ≤ U. */
export function effectiveTokens(D: number, U: number): number {
  if (U <= 0) return 0;
  if (D <= U) return D;
  const ep = D / U;
  return U * (1 + REPEAT_R_STAR * (1 - Math.exp(-(ep - 1) / REPEAT_R_STAR)));
}
/** Effective-compute fraction of data repetition: the compute-optimal compute matching L(N, D_eff) over the one
 *  matching L(N, D) (Besiroglu law), so repetition is valued in the same currency as everything else. Replaces v2's
 *  −0.25·ln data-wall penalty. 1 when the unique tokens cover the run. */
export function fData(N: number, D: number, U: number): number {
  if (D <= U) return 1;
  return fDataEff(N, D, effectiveTokens(D, U));
}
/** fData from a run's effective tokens directly (model v3 D3: the draw sums Muennighoff per slice of the portfolio):
 *  the compute-optimal compute matching L(N, D_eff) over the one matching L(N, D). Model v3 D11: D_eff also carries the
 *  drawn tokens' quality (production/data.ts drawData), so it can exceed D, and the fraction then exceeds 1 (better
 *  tokens at the same N are worth more compute). Exactly 1 when D_eff = D (to 1e-9). */
export function fDataEff(N: number, D: number, dEff: number): number {
  if (!(D > 0) || Math.abs(dEff / D - 1) < 1e-9) return 1;
  const a = log10ComputeForLoss(lossOf(N, Math.max(1, dEff)));
  const b = log10ComputeForLoss(lossOf(N, D));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.pow(10, a - b);
}

/** Breakdown of a base's pretraining G (OOM). `recipe` is the recipe efficiency at launch (E_START + e_stack); `data`
 *  the repetition of the drawn tokens (≤ 0, from fData) and `quality` their quality against the 2025 reference draw
 *  (model v3 D11, from fQual; 0 for the reference recipe at the start). */
export interface GPreParts { flop: number; recipe: number; shape: number; over: number; data: number; quality: number; design: number; total: number }
export function gPreOf(x: { flop: number; tpp: number; recipe: number; shape: BaseDesign['shape']; fData: number; fQual?: number; designDg: number }): GPreParts {
  const flop = Math.log10(Math.max(1, x.flop));
  const shape = SHAPE[x.shape].e;
  const over = Math.log10(fOver(x.tpp));
  const data = Math.log10(Math.max(1e-6, x.fData));
  const quality = Math.log10(Math.max(1e-6, x.fQual ?? 1));
  return { flop, recipe: x.recipe, shape, over, data, quality, design: x.designDg, total: flop + x.recipe + shape + over + data + quality + x.designDg };
}

/** Continued pretraining (§3.4): effective compute adds, G_new = log₁₀(10^G_old + FLOP_cont × f_add × 10^(recipe_now + shape)).
 *  Only the added part embodies today's recipe and its data (`fAdd`, continueFData: repetition and quality of the added
 *  tokens, RD-T02; 1 = reference data). No κ. */
export const continueGPre = (gOld: number, flopCont: number, recipeNow: number, shape: BaseDesign['shape'], fAdd = 1) =>
  Math.log10(Math.pow(10, gOld) + Math.max(0, flopCont) * Math.max(0, fAdd) * Math.pow(10, recipeNow + SHAPE[shape].e));
/** Data factor of a continue run's added tokens (RD-T02, TRN-07). Effective compute adds, so the added part is worth the
 *  from-scratch effective compute of the cumulative draw (N, D_prev + D_add, its D_eff) minus that of the parent's tokens
 *  on the same portfolio (D_prev, `prevDEff`), per added token: 1 when both draws are the 2025 reference data, below 1
 *  when the added tokens repeat slices the parent already used, above 1 for better data. Never below 0. */
export function continueFData(N: number, prevTokens: number, addTokens: number, dEffTot: number, prevDEff: number): number {
  if (!(addTokens > 0)) return 1;
  const tot = prevTokens + addTokens;
  const fTot = fDataEff(N, tot, dEffTot);
  const fPrev = prevTokens > 0 ? fDataEff(N, prevTokens, prevDEff) : 0;
  return Math.max(0, (tot * fTot - prevTokens * fPrev) / addTokens);
}

/** Serving FLOP per token of a base design (model v3 V4, RD-U08): 2·N_active × the shape's token multiplier; stored
 *  as BaseModel.fpt and, through the serving stack and the post-training design, ModelVersion.fpt. */
export const fptOfDesign = (params: number, shape: BaseDesign['shape']) => 2 * params * SHAPE[shape].tokenMult;
/** Serving FLOP per token: 2 · N_active [R20 D1]. */
export const servingFlop = (params: number) => 2 * params;

// ───────────────────────────── post-training (§4.2) ─────────────────────────────

/** Transfer T[family][domain]: the family's own domain 1.0, its adjacent domains 0.4, every other domain far 0.15
 *  [R20 C2] (data/v2/runDesign.ts RL_FAMILIES own / adjacent, RD-T05). */
export const TRANSFER: Record<RLFamily, Record<DomainId, number>> = Object.fromEntries(RL_FAMILY_IDS.map((f) => {
  const { own, adjacent } = RL_FAMILIES[f];
  const row = Object.fromEntries(DOMAIN_IDS.map((d) => [d, d === own ? RL_TRANSFER.same : adjacent.includes(d) ? RL_TRANSFER.adjacent : RL_TRANSFER.far]));
  return [f, row];
})) as Record<RLFamily, Record<DomainId, number>>;

/** Families any RL can use, given which paradigms are known (computer use needs P06's environments). */
export const rlFamiliesAvailable = (known: (id: string) => boolean): RLFamily[] =>
  RL_FAMILY_IDS.filter((f) => !RL_FAMILY_NEEDS[f] || known(RL_FAMILY_NEEDS[f] as string));

/** Family weights of the RL budget (sum 1): broad = equal over the available families; one or two focus families =
 *  RL_FOCUS_SHARE on them, the rest spread equally over the other available families [D]. */
export function rlWeights(focus: RLFamily[] | 'broad', available: RLFamily[]): FamilyMap {
  const out: FamilyMap = {};
  const fam = focus === 'broad' ? [] : focus.filter((f) => available.includes(f));
  if (!fam.length) {
    for (const f of available) out[f] = 1 / available.length;
    return out;
  }
  const rest = available.filter((f) => !fam.includes(f));
  const kFocus = rest.length ? RL_FOCUS_SHARE : 1;
  for (const f of fam) out[f] = kFocus / fam.length;
  for (const f of rest) out[f] = (1 - kFocus) / rest.length;
  return out;
}

/** RL ceiling A (OOM) set by the base: A0 + a1·log₁₀(FLOP_pre ÷ FLOP_RL_REF), never below 0.1·A0 [D, R20 C1: the
 *  asymptote rises with base model size]. Keyed on the base's physical size, not its whole G_pre: through the know-how
 *  bridge G_pre grows by hundreds of OOMs in a takeoff, and a ceiling on it ran away (design/V3-BUILD.md V1 notes). */
export const rlCeiling = (flopPre: number) => Math.max(0.1 * RL_CURVE.A0, RL_CURVE.A0 + RL_CURVE.a1 * Math.log10(Math.max(1, flopPre) / FLOP_RL_REF));
/** One sigmoid step: A / (1 + (C_mid/C)^B) (Khatri et al. 2025 [R20 C1]). */
const sig = (A: number, cMid: number, C: number) => (C <= 0 ? 0 : A / (1 + Math.pow(cMid / C, RL_CURVE.B)));

/** Transfer-weighted share of the RL budget reaching domain d: Σ_f w_f · T[f][d]. */
const reach = (w: FamilyMap, d: DomainId) => RL_FAMILY_IDS.reduce((a, f) => a + (w[f] ?? 0) * TRANSFER[f][d], 0);

/** The reference families at the start (everything but computer use) and the reference weights (broad). */
const START_FAMILIES = rlFamiliesAvailable(() => false);
const REF_W = rlWeights('broad', START_FAMILIES);

/** c0: the RL midpoint constant (RL FLOP on the reference base), C_mid = c0·(FLOP_pre ÷ FLOP_RL_REF)^kMid / 10^e_RL
 *  (CP3g; RD-T04 had kMid 0), solved
 *  once so the reference post-training run (standard budget, broad, e_RL = 0) on the reference base (FLOP_RL_REF, B0)
 *  gains RL_REF_GAIN on average over the cognitive domains [fit]: V0's gain is unchanged. Solved in units of
 *  FLOP_RL_REF, then scaled. */
export const RL_C0 = (() => {
  const rho = RL_BUDGET.standard;
  const mean = (c0: number) => COGNITIVE.reduce((a, d) => a + sig(RL_CURVE.A0, c0, rho * reach(REF_W, d)), 0) / COGNITIVE.length;
  let lo = 1e-6;
  let hi = 100;
  for (let i = 0; i < 100; i++) {
    const mid = Math.sqrt(lo * hi);
    if (mean(mid) > RL_REF_GAIN) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi) * FLOP_RL_REF;
})();

/** CP3g: the RL midpoint C_mid = c0·(FLOP_pre ÷ FLOP_RL_REF)^kMid / 10^e_RL, a fixed number of RL episodes
 *  (data/v2/runDesign.ts RL_CURVE; research/RD-RL-scaling.md §5 (c)). */
export const rlMidOf = (flopPre: number, eRL: number) =>
  (RL_C0 * Math.pow(Math.max(1, flopPre) / FLOP_RL_REF, RL_CURVE.kMid)) / Math.pow(10, eRL);

export interface RlGains { perDomain: Record<DomainId, number>; general: number; perFamily: FamilyMap; ceiling: number }
/** Fidelity-weighted ceiling factor of domain d: Σ_f w_f·T[f][d]·fid_f ÷ Σ_f w_f·T[f][d] (1 when every suite is at 1). */
const fidReach = (w: FamilyMap, d: DomainId, fid: FamilyMap) => {
  let num = 0;
  let den = 0;
  for (const f of RL_FAMILY_IDS) {
    const x = (w[f] ?? 0) * TRANSFER[f][d];
    if (x <= 0) continue;
    num += x * (fid[f] ?? 1);
    den += x;
  }
  return den > 0 ? num / den : 1;
};
/** RL gains of `rlFlop` RL FLOP split by `w` on a base of physical FLOP `flopPre`, with RL recipe
 *  efficiency `eRL` (OOM, the RL stack's efficiency: moves the midpoint) and ceiling raise `aRL` (OOM added to A: the RL
 *  stack's environments and rewards, model v3 V2): per domain, the transfer-weighted RL compute reaching it on the family
 *  curve; general = the mean over the cognitive domains; per family, the in-family gain (its own compute only). Bounded
 *  by the ceiling A + aRL and monotone in every input.
 *  Model v3 D5: `fid` = the environment suites' fidelity per family (absent = 1) scales each family's ceiling,
 *  A_f = fid_f · (A_base + aRL): the RL-ceiling stack is the lab-wide method for environments and rewards, a suite's
 *  fidelity how much of it that family's environments realise. A domain's ceiling is the transfer-weighted mean of the
 *  A_f reaching it (the same weights as its compute), so a better suite raises its own domain most and the others only
 *  through transfer, and the gain stays bounded by the best suite's ceiling. */
export function rlGains(flopPre: number, rlFlop: number, w: FamilyMap, eRL: number, aRL = 0, fid?: FamilyMap): RlGains {
  const A = Math.max(0, rlCeiling(flopPre) + aRL);
  const cMid = rlMidOf(flopPre, eRL);
  const perDomain = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) perDomain[d] = sig(fid ? A * fidReach(w, d, fid) : A, cMid, rlFlop * reach(w, d));
  const general = COGNITIVE.reduce((a, d) => a + perDomain[d], 0) / COGNITIVE.length;
  const perFamily: FamilyMap = {};
  for (const f of RL_FAMILY_IDS) if (w[f]) perFamily[f] = sig(A * (fid?.[f] ?? 1), cMid, rlFlop * (w[f] ?? 0));
  return { perDomain, general, perFamily, ceiling: A };
}
/** P4: rlGains(…).general without fidelity, computing only what it reads: the cognitive domains' gains, in the same order
 *  with the same expressions. The reach per domain is memoised per weight map (callers pass maps they never mutate: the
 *  reference weights). */
const reachMemo = new WeakMap<FamilyMap, number[]>();
export function rlGainGeneral(flopPre: number, rlFlop: number, w: FamilyMap, eRL: number, aRL = 0): number {
  let rw = reachMemo.get(w);
  if (!rw) reachMemo.set(w, (rw = COGNITIVE.map((d) => reach(w, d))));
  const A = Math.max(0, rlCeiling(flopPre) + aRL);
  const cMid = rlMidOf(flopPre, eRL);
  let a = 0;
  for (let i = 0; i < rw.length; i++) a += sig(A, cMid, rlFlop * rw[i]);
  return a / COGNITIVE.length;
}

/** The RL inputs the horizon anchors are read at: the run's base FLOP, RL FLOP and RL recipe (efficiency, ceiling). */
export interface LongRefAt { flopPre: number; rlFlop: number; eRL: number; aRL?: number }
/** RD-T05, CP3c: the long-tasks family's in-family gain of a broad run and of a long-tasks focus at the run's own base,
 *  RL budget and RL recipe (fidelity 1): the two anchors of the horizon gain (data/v2/runDesign.ts LONG_TASKS_HORIZON).
 *  Without `at`: the reference run (B0, standard budget, e_RL 0). */
const LONG_FOCUS_W = rlWeights(['longHorizon'], START_FAMILIES);
function longRef(at?: LongRefAt): { broad: number; focus: number } {
  const F = at?.flopPre ?? FLOP_RL_REF;
  const rl = at?.rlFlop ?? RL_BUDGET.standard * FLOP_RL_REF;
  const g = (w: FamilyMap) => rlGains(F, rl, w, at?.eRL ?? 0, at?.aRL ?? 0).perFamily.longHorizon ?? 0;
  return { broad: g(REF_W), focus: g(LONG_FOCUS_W) };
}
/** Time-horizon multiplier from the RL done on long tasks (RD-T05): (perFocus × p07)^x, x = max(0, (gLong − g_broad) ÷
 *  (g_focus − g_broad)), gLong = rlGains(…).perFamily.longHorizon. ×1 for a broad run, ×perFocus (× P07) for a
 *  long-tasks focus, rising smoothly with the long-task share in between; a long-tasks suite above fidelity 1 (P12)
 *  raises it. CP3c: the anchors are read at the run's own base, RL budget and RL recipe (`at`), because h50Of already
 *  gives 4.2× per OOM of the version's AGENCY effective compute, which holds the RL gain of a bigger base, budget or RL
 *  recipe; anchored at B0's reference run, a broad post-train on a 3× base read ×2.5 on top (counted twice). */
export function longTasksHorizonMult(gLong: number, p07 = 1, at?: LongRefAt): number {
  const ref = longRef(at);
  const span = ref.focus - ref.broad;
  const x = span > 1e-9 ? Math.max(0, (gLong - ref.broad) / span) : 0;
  return Math.pow(LONG_TASKS_HORIZON.perFocus * p07, x);
}

/** Reference RL profile γ_d: the reference run's domain gain minus its general gain (OOM). Domain levels are read
 *  against it, so the reference recipe reproduces the 2025 domain profile (o_d, MODEL-V3 §2.3) and only training
 *  choices that differ from it specialise a model. */
export const REF_RL_PROFILE: Record<DomainId, number> = (() => {
  const g = rlGains(FLOP_RL_REF, RL_BUDGET.standard * FLOP_RL_REF, REF_W, 0);
  return Object.fromEntries(DOMAIN_IDS.map((d) => [d, g.perDomain[d] - g.general])) as Record<DomainId, number>;
})();

// ───────────────────────────── distillation (§4.5) ─────────────────────────────

/** Distillation gap δ (OOM, ≥ 0): DISTILL.a + DISTILL.b·log₁₀(N_teacher/N_student) (R1 distills through the benchmark
 *  sigmoid, R20 C4), plus DISTILL_TOKEN_SLOPE per OOM of tokens below DISTILL_TPP per student parameter. */
export function distillGap(teacherParams: number, studentParams: number, tokens: number): number {
  const ratio = Math.max(1, teacherParams / Math.max(1, studentParams));
  const short = Math.max(0, Math.log10((DISTILL_TPP * studentParams) / Math.max(1, tokens)));
  return Math.max(0, DISTILL.a + DISTILL.b * Math.log10(ratio) + DISTILL_TOKEN_SLOPE * short);
}
/** Distillation FLOP: teacher inference on the tokens (2·N_teacher·D) plus student training (6·N_student·D) [R20 C4]. */
export const distillFlop = (teacherParams: number, studentParams: number, tokens: number) => 2 * teacherParams * tokens + 6 * studentParams * tokens;

// ───────────────────────────── durations (§3.3) ─────────────────────────────

/** Days to finish `flop` at `flopPerDay` (already net of share, utilisation and goodput). No minimum. */
export const daysFor = (flop: number, flopPerDay: number) => (flop <= 0 ? 0 : flopPerDay > 0 ? flop / flopPerDay : Infinity);

/** RD-T08 (TRN-31): the tokens-per-parameter choice by its trade-off: at or below 20 the most capable per training
 *  FLOP; below the 2025 practice (400) more capable per FLOP but dearer to serve; above it cheaper to serve but less
 *  capable per FLOP. */
export const tppLabel = (tpp: number) => (tpp <= OPT_TPP + 1e-9 ? 'most capable per FLOP' : tpp < REF_TPP - 1e-9 ? 'more capable per FLOP, dearer to serve'
  : tpp <= REF_TPP + 1e-9 ? '2025 practice' : 'cheaper to serve, less capable per FLOP');
export { REF_TPP };
