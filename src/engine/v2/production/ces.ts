// The AI Futures experiment CES, the coding CES, taste σ and the reference paths (research/13 §1.2–§1.9, §2.4).
// Owner: WS1. Pure maths shared by the player's research (models/research.ts, departments/workfit.ts), the safety lines
// and the rivals' aggregate research (actors/rivalModel.ts). RD-C01: v2's knot production function (buildKnots, knotAt)
// that used to live beside it in knots.ts is gone.
import { H_REF_BASE, H_REF_PER_MONTH, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { refCapCompute } from '../../../data/world';
import { asV1World } from '../world/calibration';
import { FORCING } from '../core/forcing';
import { frontierRunShareAt } from '../departments/split';
import type { ProdParams, TimelineWorld } from '../types';

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

// ───────────────────────────── reference paths (§3.1.1, §3.2.1) ─────────────────────────────

/** Months since the Jul 2025 start for a decimal year. */
const monthsOf = (yr: number) => (yr - 2025.5) * 12;

/** Reference capabilities headcount H_ref(t) = 2050 + 49.2·months (research/13 §1.2; R11 #12). */
export function hRef(yr: number): number {
  // Calibration hook (core/forcing.ts): a prescribed headcount path, as a multiplier vs 2025.5. Unset in normal play.
  if (FORCING.staffPath !== undefined) return Math.max(200, H_REF_BASE * FORCING.staffPath(yr));
  return Math.max(200, H_REF_BASE + H_REF_PER_MONTH * monthsOf(yr));
}

/** refTotal(t) = refCapCompute(w, t)/0.68: the leading lab's total compute on the reference path (H100e, §3.1.1). */
export function refTotal(w: TimelineWorld, yr: number): number {
  // Calibration hook (core/forcing.ts): a prescribed total-compute path. Unset in normal play.
  if (FORCING.computePath !== undefined) return FORCING.computePath(yr);
  return refCapCompute(asV1World(w), yr - 2025.5) / 0.68;
}

/** F(t): reference frontier base-run size in FLOP = 0.8·frontierRunShare·refTotal·Φ·91 (§3.1.1; ≈1e27 Jul 2025). */
export function frontierFlop(w: TimelineWorld, yr: number): number {
  return 0.8 * frontierRunShareAt(yr) * refTotal(w, yr) * PHI_FLOP_PER_H100E_DAY * 91;
}
