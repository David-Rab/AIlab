// Production-function parameters and knot generation (V2-SPEC §3.2.4; research/13 §1.4, §1.9). Owner: WS1.
import type { ProdKnot, ProdParams, TimelineWorld } from '../types';

function bisect(f: (x: number) => number, lo: number, hi: number, iters = 200): number {
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

/** CES params from asymptotes (AIFM ces_functions.py l.351-441, normalised form; research/13 §1.9). */
export function cesFromAsymptotes(La: number, Ca: number, slow10: number) {
  const rho = bisect((r) => Math.pow(La, r) + Math.pow(Ca, r) - 1, -50, -1e-9);
  const u = Math.pow(La, rho);
  const v = Math.pow(Ca, rho);
  const zeta = Math.log((Math.pow(1 / slow10, rho) - v) / u) / (rho * Math.log(0.1));
  return { rho, u, v, zeta };
}

/**
 * Build the knot table for a preset (§3.2.4).
 * TODO(WS1, M1): implement steps 1–5 (reference trajectory, Stage-1 grid, Stage-2 knots, validation, P2 check).
 * M0 returns [] — the placeholder production system does not use knots.
 */
export function buildKnots(_w: TimelineWorld, _P: Omit<ProdParams, 'knots'>): ProdKnot[] {
  return [];
}
