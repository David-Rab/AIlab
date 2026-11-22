// Timeline calibration helpers wrapping src/data/world.ts (unchanged, audited). Owner: WS1.
// What remains: the v1-world cast and the unshifted reference multiplier / integrator rate (RD-U07 removed v2's
// level map, which only RefBot's pacing gates read; they are OOM constants in bots/ref.ts).
import { multiplierAt, laborSlowdown, computePace, stage1 } from '../../../data/world';
import type { World } from '../../types';
import type { TimelineWorld } from '../types';

/** world.ts takes the v1 `World` type; TimelineWorld is a structural superset. */
export const asV1World = (w: TimelineWorld): World => w;

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
