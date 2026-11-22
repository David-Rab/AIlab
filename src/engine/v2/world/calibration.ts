// Timeline calibration helpers wrapping src/data/world.ts (unchanged, audited). Owner: WS1.
// What remains: the v1-world cast, v2's level map on an explicitly shifted threshold set (RefBot's pacing gates only)
// and the unshifted reference multiplier / integrator rate.
import { milestoneThresholds, multiplierAt, laborSlowdown, computePace, stage1 } from '../../../data/world';
import type { World } from '../../types';
import type { TimelineWorld } from '../types';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';

/** world.ts takes the v1 `World` type; TimelineWorld is a structural superset. */
export const asV1World = (w: TimelineWorld): World => w;

/** v2's level map at a point q of v2's progress coordinate, on the milestone thresholds shifted by `shift` for i ≥ 1:
 *  only RefBot's pacing gates read it (on V2a's CAL_SHIFT, bots/ref.ts gateLevel), at v2-coordinate points converted
 *  from G there. No lab's capability is in this coordinate (model v3 F3). */
export function levelOfV2(w: TimelineWorld, q: number, shift: number): number {
  const th = milestoneThresholds(asV1World(w)).map((t, i) => (i === 0 ? t : t - shift));
  if (q < th[0]) {
    const slope = (LEVEL_KNOTS[1] - LEVEL_KNOTS[0]) / Math.max(1e-9, th[1] - th[0]);
    return Math.max(0, LEVEL_KNOTS[0] + slope * (q - th[0]));
  }
  let ci = 6;
  for (let i = 0; i < th.length - 1; i++) if (q < th[i + 1]) { ci = i + Math.max(0, (q - th[i]) / Math.max(1e-9, th[i + 1] - th[i])); break; }
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
