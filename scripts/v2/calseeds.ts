// The fixed seed set of the multi-seed calibration (model v3 F4). Owner: WS1.
// T1 and T1L (calib.ts) bind on the MEDIAN over these seeds, per milestone; calscan.ts fits the per-preset values on the
// same set. One seed is not a calibration: research draws (hidden efficacy, dead ends) and the base cadence make RefBot's
// dates bimodal, so one-seed fits sat on knife edges (design/archive/notes/F4.md).
export const CAL_SEED = 2027;
export const CAL_SEEDS: number[] = [CAL_SEED, ...Array.from({ length: 19 }, (_, i) => i + 1)];

/** Median of n values (mean of the middle two when n is even); pass a milestone not reached as +∞. */
export function medianOf(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
/** p-quantile by linear interpolation (spread lines). */
export function quantOf(xs: number[], p: number): number {
  const a = [...xs].sort((x, y) => x - y);
  const i = p * (a.length - 1);
  const lo = Math.floor(i);
  return a[lo] + (a[Math.min(a.length - 1, lo + 1)] - a[lo]) * (i - lo);
}
