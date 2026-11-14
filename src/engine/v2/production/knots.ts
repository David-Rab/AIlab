// Production-function parameters, reference paths and knot generation (V2-SPEC §3.2.1, §3.2.4; research/13 §1.4,
// §1.5, §1.9, §2.4). Owner: WS1.
//
// Coordinates: knots are placed in the v1 progress coordinate `q` of src/data/world.ts (milestoneThresholds,
// multiplierAt). A model's q = pm + calShift (§3.1.5). The production function is evaluated at q_dep.
import { AI2027_COMPUTE_TABLE, H_REF_BASE, H_REF_PER_MONTH, PHI_FLOP_PER_H100E_DAY, R13_TABLE_SD } from '../../../data/v2/calibration';
import { milestoneThresholds, multiplierAt, refCapCompute, speeds, stage1 } from '../../../data/world';
import { asV1World, referenceRate } from '../world/calibration';
import { shareRefAt } from '../departments/split';
import type { ProdKnot, ProdParams, TimelineWorld } from '../types';

// ───────────────────────────── maths ─────────────────────────────

export function bisect(f: (x: number) => number, lo: number, hi: number, iters = 200): number {
  let flo = f(lo);
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if ((fm < 0) === (flo < 0)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Error function (Abramowitz–Stegun 7.1.26, |ε| < 1.5e-7). */
export function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
/** Standard normal CDF Φ. */
export const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

/** CES params from asymptotes (AIFM ces_functions.py l.351-441, normalised form; research/13 §1.9). */
export function cesFromAsymptotes(La: number, Ca: number, slow10: number) {
  const rho = bisect((r) => Math.pow(La, r) + Math.pow(Ca, r) - 1, -50, -1e-9);
  const u = Math.pow(La, rho);
  const v = Math.pow(Ca, rho);
  const zeta = Math.log((Math.pow(1 / slow10, rho) - v) / u) / (rho * Math.log(0.1));
  return { rho, u, v, zeta };
}

type CesP = Pick<ProdParams, 'u' | 'v' | 'rho' | 'zeta' | 'rc' | 'lam'>;

/** Labour ceiling of the experiment CES: X(1, ℓ→∞) = u^(1/ρ) (= La). */
export const La = (P: CesP) => Math.pow(P.u, 1 / P.rho);

/** Experiment capacity X(c, ℓ) = [u·c^(ζρ) + v·ℓ^ρ]^(1/ρ) (research/13 §1.3). */
export function Xces(P: CesP, c: number, l: number): number {
  return Math.pow(P.u * Math.pow(c, P.zeta * P.rho) + P.v * Math.pow(l, P.rho), 1 / P.rho);
}

/** Parallel coding labour relative to H_ref: coding CES of humans h and AI labour ai (A ≥ 1 ⇒ ai). */
export function Lrel(P: CesP, A: number, h: number, ai: number): number {
  if (A >= 1 - 1e-12) return ai;
  if (A <= 0) return h;
  return Math.pow(Math.pow(1 - A, 1 - P.rc) * Math.pow(h, P.rc) + Math.pow(A, 1 - P.rc) * Math.pow(ai, P.rc), 1 / P.rc);
}

// ───────────────────────────── taste (research/13 §2.4; AIFM taste_distribution.py) ─────────────────────────────

const Z999 = 3.090232306167813; // 99.9th percentile z (AIFM TOP_RESEARCHER_SD)

/** σ of the lognormal human taste distribution (mean 1, 99.9th pct = m2b × median). */
export const tasteSigma = (m2b: number) => Math.log(m2b) / Z999;

/** Aggregate taste E[max(T, F_AI)] when AI taste sits `sd` human SDs above the median (research/13 §2.1). */
export function tasteOf(sd: number, m2b: number): number {
  const s = tasteSigma(m2b);
  const F = Math.exp(-0.5 * s * s + sd * s);
  return F * Phi(sd) + Phi(s - sd);
}

/** Inverse of tasteOf: AI taste in human SDs from aggregate taste T (≥ 1). */
export function tasteSD(T: number, m2b: number): number {
  if (T <= tasteOf(-6, m2b)) return -6;
  return bisect((x) => tasteOf(x, m2b) - T, -6, 40, 80);
}

// ───────────────────────────── reference paths (§3.1.1, §3.2.1) ─────────────────────────────

/** Months since the Jul 2025 start for a decimal year. */
const monthsOf = (yr: number) => (yr - 2025.5) * 12;

/** Reference capabilities headcount H_ref(t) = 2050 + 49.2·months (research/13 §1.2; R11 #12). */
export function hRef(yr: number): number {
  return Math.max(200, H_REF_BASE + H_REF_PER_MONTH * monthsOf(yr));
}

/** refTotal(t) = refCapCompute(w, t)/0.68: the leading lab's total compute on the reference path (H100e, §3.1.1). */
export function refTotal(w: TimelineWorld, yr: number): number {
  return refCapCompute(asV1World(w), yr - 2025.5) / 0.68;
}

/** F(t): reference frontier base-run size in FLOP = 0.8·shareRef.training·refTotal·Φ·91 (§3.1.1; ≈1e27 Jul 2025). */
export function frontierFlop(w: TimelineWorld, yr: number): number {
  return 0.8 * shareRefAt(yr).training * refTotal(w, yr) * PHI_FLOP_PER_H100E_DAY * 91;
}

/** gF(t) = refTotal(t + 1y)/refTotal(t) (§3.1.3). */
export function gF(w: TimelineWorld, yr: number): number {
  return refTotal(w, yr + 1) / refTotal(w, yr);
}

/** Reference total compute used for knot generation. For the AI 2027 family (non-AIFM presets) this is the AI 2027
 *  compute-forecast table that research/13 §1.5 was generated from (P2); AIFM presets use refTotal. */
export function knotCompute(w: TimelineWorld, yr: number): number {
  if (w.aifm) return refTotal(w, yr);
  const T = AI2027_COMPUTE_TABLE;
  if (yr <= T[0].year) return T[0].h100e * Math.pow(3.4, yr - T[0].year);
  for (let i = 0; i < T.length - 1; i++) {
    if (yr <= T[i + 1].year) {
      const f = (yr - T[i].year) / (T[i + 1].year - T[i].year);
      return T[i].h100e * Math.pow(T[i + 1].h100e / T[i].h100e, f);
    }
  }
  // Beyond the table: the last segment's growth (12M → 15M per quarter), as research/13 §1.5's SIAR/ASI knots imply.
  const a = T[T.length - 2];
  const b = T[T.length - 1];
  return b.h100e * Math.pow(b.h100e / a.h100e, (yr - b.year) / (b.year - a.year));
}

// ───────────────────────────── reference trajectory (§3.2.4 step 1) ─────────────────────────────

/** Decimal year at which the v1 reference integrator (cf = 1, human = 1) reaches each progress q in `qs` (sorted). */
export function refDates(w: TimelineWorld, qs: number[]): number[] {
  const out: number[] = [];
  let p = w.p0;
  let yr = 2025.5;
  const dt = 1 / 365;
  let i = 0;
  const r0 = Math.max(0.05, referenceRate(w, p, yr));
  for (; i < qs.length && qs[i] <= p; i++) out[i] = yr - (p - qs[i]) / r0; // at/before the start: extrapolate back
  for (let n = 0; n < 365 * 400 && i < qs.length; n++) {
    const r = referenceRate(w, p, yr);
    const p2 = p + r * dt;
    while (i < qs.length && qs[i] <= p2) {
      out[i] = yr + ((qs[i] - p) / Math.max(1e-12, p2 - p)) * dt;
      i++;
    }
    p = p2;
    yr += dt;
  }
  while (i < qs.length) out[i++] = yr;
  return out;
}

// ───────────────────────────── knots (§3.2.4) ─────────────────────────────

/** R13 §1.5 Stage-1 AI taste SD by f (ai2027 table; interpolated for every preset, §3.2.4 step 2). */
function sdOfF(f: number): number {
  const T = R13_TABLE_SD;
  if (f <= T[0][0]) return T[0][1];
  for (let i = 0; i < T.length - 1; i++) {
    if (f <= T[i + 1][0]) return T[i][1] + ((f - T[i][0]) / (T[i + 1][0] - T[i][0])) * (T[i + 1][1] - T[i][1]);
  }
  return T[T.length - 1][1];
}

export interface KnotBuild { knots: ProdKnot[]; ok: boolean; problems: string[]; /** Fallbacks taken (T_ref raised to absorb an unreachable labour target). */ notes: string[] }

/**
 * Build the knot table for a preset (§3.2.4). Knot p is in the v1 coordinate q.
 * Stage 1: f = 0 … 15/16 by 1/16; SC and Stage 2: milestone thresholds SC, SAR, SIAR, ASI and the midpoints.
 */
export function buildKnotsDetailed(w: TimelineWorld, P: Omit<ProdParams, 'knots'>): KnotBuild {
  const wv1 = asV1World(w);
  const s1 = stage1(wv1);
  const th = milestoneThresholds(wv1);
  const MSC = speeds(wv1)[0]; // M_ref at SC = 1 + sEx
  const qs1 = Array.from({ length: 16 }, (_, i) => (i / 16) * s1);
  const qs2: number[] = [];
  for (let i = 3; i <= 6; i++) {
    qs2.push(th[i]);
    if (i < 6) qs2.push((th[i] + th[i + 1]) / 2);
  }
  const qsAll = [...qs1, ...qs2];
  const order = qsAll.map((q, i) => [q, i] as const).sort((a, b) => a[0] - b[0]);
  const datesSorted = refDates(w, order.map((x) => x[0]));
  const dates: number[] = [];
  order.forEach(([, i], j) => (dates[i] = datesSorted[j]));

  const problems: string[] = [];
  const notes: string[] = [];
  const knots: ProdKnot[] = [];
  const cInf = (yr: number) => knotCompute(w, yr) * shareRefAt(yr).agents;
  const solveL = (Xt: number) => bisect((l) => Xces(P, 1, l) - Xt, 1e-6, 1e12, 200);
  let prevT = 1;
  qs1.forEach((q, i) => {
    const f = q / s1;
    const yr = dates[i];
    const Mref = multiplierAt(wv1, q);
    let Tref = Math.max(prevT, tasteOf(sdOfF(f), P.m2b));
    const eta = P.etaSC * Math.pow(Mref / MSC, P.kappa);
    const R = (eta * cInf(yr)) / hRef(yr);
    // Solve X(1, ℓ) = M_ref/T_ref for ℓ (X increasing in ℓ; X < La).
    const lTarget = Mref / Tref < La(P) ? solveL(Mref / Tref) : Infinity;
    // Lrel(A; h = 1, ai = R) rises on A ∈ [0, A*], A* = R/(1 + R) (first-order condition of the coding CES).
    const Astar = R / (1 + R);
    const lMin = Math.pow(Lrel(P, 0, 1, R), P.lam);
    const lMax = Math.pow(Lrel(P, Astar, 1, R), P.lam);
    let A: number;
    if (lTarget <= lMin) {
      A = 0;
      Tref = Mref / Xces(P, 1, lMin); // raise T_ref to absorb the difference (§3.2.4 step 2)
    } else if (lTarget >= lMax) {
      A = Astar;
      Tref = Mref / Xces(P, 1, lMax);
      notes.push(`f=${f.toFixed(3)}: A = A* (T_ref raised)`);
    } else A = bisect((a) => Math.pow(Lrel(P, a, 1, R), P.lam) - lTarget, 0, Astar, 200);
    prevT = Math.max(prevT, Tref);
    knots.push({ p: q, Mref, A, R, Tref, sdAI: tasteSD(Tref, P.m2b) });
  });
  qs2.forEach((q, j) => {
    const yr = dates[16 + j];
    const Mref = multiplierAt(wv1, q);
    const eta = P.etaSC * Math.pow(Mref / MSC, 0.75);
    let R = (eta * cInf(yr)) / hRef(yr);
    let Tref = Mref / Xces(P, 1, Math.pow(R, P.lam));
    if (Tref < prevT) {
      // T_ref would fall (labour outgrows M_ref, e.g. long slow-preset takeoffs): hold T_ref and cap the agent ratio
      // so that X(1, R^λ)·T_ref = M_ref. Keeps T_ref ≥ 1 and monotone (§3.2.4 step 4) without rejecting the preset.
      Tref = prevT;
      R = Math.pow(solveL(Mref / Tref), 1 / P.lam);
    }
    prevT = Tref;
    knots.push({ p: q, Mref, A: 1, R, Tref, sdAI: tasteSD(Tref, P.m2b) });
  });
  // Validation (§3.2.4 step 4; R13 §1.10 #2): T_ref ≥ 1 and monotone.
  for (let i = 0; i < knots.length; i++) {
    if (knots[i].Tref < 1 - 1e-6) problems.push(`T_ref < 1 at q=${knots[i].p.toFixed(3)} (${knots[i].Tref.toFixed(3)})`);
    if (i > 0 && knots[i].p > knots[i - 1].p && knots[i].Tref < knots[i - 1].Tref - 1e-6) problems.push(`T_ref non-monotone at q=${knots[i].p.toFixed(3)}`);
  }
  return { knots, ok: problems.length === 0, problems, notes };
}

/** Knot table for a preset (cached per world by the caller: stored in hidden.timeline.prod.knots). */
export function buildKnots(w: TimelineWorld, P: Omit<ProdParams, 'knots'>): ProdKnot[] {
  return buildKnotsDetailed(w, P).knots;
}

/** Interpolated calibration curves at progress q: A linear, R log-linear (research/13 §1.5). Clamped at the ends;
 *  beyond the last knot R keeps growing at the last segment's log slope. */
export function knotAt(knots: readonly ProdKnot[], q: number): { A: number; R: number } {
  const n = knots.length;
  if (n === 0) return { A: 0, R: 1 };
  if (q <= knots[0].p) return { A: knots[0].A, R: knots[0].R };
  for (let i = 0; i < n - 1; i++) {
    const a = knots[i];
    const b = knots[i + 1];
    if (q <= b.p) {
      const f = b.p > a.p ? (q - a.p) / (b.p - a.p) : 1;
      return { A: a.A + f * (b.A - a.A), R: Math.exp(Math.log(a.R) + f * (Math.log(b.R) - Math.log(a.R))) };
    }
  }
  const a = knots[n - 2];
  const b = knots[n - 1];
  const slope = b.p > a.p ? (Math.log(b.R) - Math.log(a.R)) / (b.p - a.p) : 0;
  return { A: b.A, R: Math.exp(Math.log(b.R) + Math.min(5, slope * (q - b.p))) };
}
