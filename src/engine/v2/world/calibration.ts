// Timeline calibration helpers wrapping src/data/world.ts (unchanged, audited). Owner: WS1.
// v2 code must use these wrappers (they apply calShift) rather than calling world.ts threshold functions directly.
import { capIndex, milestoneThresholds, multiplierAt, laborSlowdown, computePace, stage1 } from '../../../data/world';
import type { World } from '../../types';
import type { TimelineWorld } from '../types';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';

/** world.ts takes the v1 `World` type; TimelineWorld is a structural superset. */
export const asV1World = (w: TimelineWorld): World => w;

/** Shifted milestone thresholds thr[i] = milestoneThresholds(w)[i] − calShift for i ≥ 1 (§3.1.5). */
export function thresholds(w: TimelineWorld): number[] {
  const th = milestoneThresholds(asV1World(w));
  return th.map((t, i) => (i === 0 ? t : t - w.calShift));
}

/** Fractional capability index 0..6 on the shifted thresholds. */
export function capIndexV2(w: TimelineWorld, p: number): number {
  return capIndex(asV1World(w), p + w.calShift);
}

/** General level Lg 0..15 from progress (§3.1.5). Below Agent-0 extrapolates down at the first knot slope. */
export function levelOf(w: TimelineWorld, pm: number): number {
  const th = thresholds(w);
  if (pm < th[0]) {
    const slope = (LEVEL_KNOTS[1] - LEVEL_KNOTS[0]) / Math.max(1e-9, th[1] - th[0]);
    return Math.max(0, LEVEL_KNOTS[0] + slope * (pm - th[0]));
  }
  const ci = capIndexV2(w, pm);
  const i = Math.min(5, Math.floor(ci));
  return LEVEL_KNOTS[i] + (LEVEL_KNOTS[i + 1] - LEVEL_KNOTS[i]) * Math.min(1, ci - i);
}

/** Reference AI R&D multiplier at progress p (unshifted world.ts, §3.2.3 identity target). */
export function multiplierRef(w: TimelineWorld, p: number): number {
  return multiplierAt(asV1World(w), p);
}

/**
 * v1 continuous reference integrator rate (§3.2.4 step 1, §7.1 golden): at cf = 1 and human = 1,
 * Stage 1 dp/dt = share·laborSlowdown(M, yr) + (1 − share)·computePace(yr); Stage 2 dp/dt = M.
 */
export function referenceRate(w: TimelineWorld, p: number, year: number): number {
  const M = multiplierAt(asV1World(w), p);
  if (p < stage1(asV1World(w))) return w.share * laborSlowdown(M, year) + (1 - w.share) * computePace(year);
  return M;
}
