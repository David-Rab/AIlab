// Timeline calibration helpers wrapping src/data/world.ts (unchanged, audited). Owner: WS1.
// v2 code must use these wrappers (they apply calShift) rather than calling world.ts threshold functions directly.
import { milestoneThresholds, multiplierAt, laborSlowdown, computePace, stage1 } from '../../../data/world';
import type { World } from '../../types';
import type { TimelineWorld } from '../types';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { gOfPm, levelOfG } from '../models/capability';

/** world.ts takes the v1 `World` type; TimelineWorld is a structural superset. */
export const asV1World = (w: TimelineWorld): World => w;

/** Shifted milestone thresholds thr[i] = milestoneThresholds(w)[i] − calShift for i ≥ 1 (§3.1.5). */
export function thresholds(w: TimelineWorld): number[] {
  const th = milestoneThresholds(asV1World(w));
  return th.map((t, i) => (i === 0 ? t : t - w.calShift));
}

/** Fractional capability index 0..6 on the shifted thresholds (thresholds(w): A0 unshifted, A1… shifted by calShift).
 *  Model v3 V1: interpolates on that array directly. capIndex(p + calShift) on the unshifted ones jumped at A0 for
 *  calShift > 0 and stayed flat on [A0, A0 − calShift] for calShift < 0; above A1 the two are identical. */
export function capIndexV2(w: TimelineWorld, p: number): number {
  const th = thresholds(w);
  for (let i = 0; i < th.length - 1; i++) if (p < th[i + 1]) return i + Math.max(0, (p - th[i]) / Math.max(1e-9, th[i + 1] - th[i]));
  return 6;
}

/** General level Lg 0..15 of a lab's model at progress pm (every lab: the player's versions, rivals, China, the leader
 *  lab): model v3 V3b reads it through effective compute, λ(Φ⁻¹(pm)) (models/capability.ts levelOfG), so one level scale
 *  sits on the work-type reference points for all labs. */
export function levelOf(w: TimelineWorld, pm: number): number {
  return levelOfG(w, gOfPm(w, pm));
}

/** v2's level map on thresholds shifted by `shift` (default the world's calShift): the bridge readers (bridgeQ) and
 *  RefBot's pacing gates (on V2a's CAL_SHIFT, bots/ref.ts v2Level) read it; nothing else does. */
export function levelOfPmV2(w: TimelineWorld, pm: number, shift = w.calShift): number {
  const th = milestoneThresholds(asV1World(w)).map((t, i) => (i === 0 ? t : t - shift));
  if (pm < th[0]) {
    const slope = (LEVEL_KNOTS[1] - LEVEL_KNOTS[0]) / Math.max(1e-9, th[1] - th[0]);
    return Math.max(0, LEVEL_KNOTS[0] + slope * (pm - th[0]));
  }
  let ci = 6;
  for (let i = 0; i < th.length - 1; i++) if (pm < th[i + 1]) { ci = i + Math.max(0, (pm - th[i]) / Math.max(1e-9, th[i + 1] - th[i])); break; }
  const i = Math.min(5, Math.floor(ci));
  return LEVEL_KNOTS[i] + (LEVEL_KNOTS[i + 1] - LEVEL_KNOTS[i]) * Math.min(1, ci - i);
}

/** BRIDGE(V6): the v1-equivalent progress q of a model at progress pm for the readers that still look up AI 2027's
 *  M(q) (revenue per chip, safety's M of the overseen model): the v2 coordinate at the same display level, + calShift. The
 *  display level λ(G) sits on the work-type milestones (model v3 V3b), so a model at its SC reads AI 2027's M at SC (5×)
 *  whatever its pm; q = pm + calShift did that only while the player's pm path matched v2's. */
const bridgeMemo = new WeakMap<TimelineWorld, Map<number, number>>();
export function bridgeQ(w: TimelineWorld, pm: number): number {
  const L = Math.round(levelOf(w, pm) * 1e4) / 1e4;
  let m = bridgeMemo.get(w);
  if (!m) bridgeMemo.set(w, (m = new Map()));
  const hit = m.get(L);
  if (hit !== undefined) return hit;
  if (m.size > 5000) m.clear();
  const q = bridgeQOf(w, L);
  m.set(L, q);
  return q;
}
function bridgeQOf(w: TimelineWorld, L: number): number {
  const th = thresholds(w);
  let lo = th[0] - 10;
  let hi = th[th.length - 1] + 5;
  if (levelOfPmV2(w, hi) <= L) return hi + w.calShift;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (levelOfPmV2(w, mid) < L) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 + w.calShift;
}

/** Inverse of levelOf on [lo, hi]: the smallest pm there with levelOf(pm) ≥ L (bisection; levelOf is non-decreasing). */
export function pmOfLevel(w: TimelineWorld, L: number, lo: number, hi: number): number {
  if (levelOf(w, hi) <= L) return hi;
  if (levelOf(w, lo) >= L) return lo;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (levelOf(w, mid) >= L) hi = mid;
    else lo = mid;
  }
  return hi;
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
