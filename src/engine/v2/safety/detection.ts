// Detection: observations, family penalties, belief updates, masks (V2-SPEC §3.5.6). Owner: WS2.
import type { GameStateV2, SystemCtx, ToolFamily, TraitBelief, TraitId } from '../types';

/** Gaussian belief update (§3.5.6): 1/sd'² = 1/sd² + 1/σ²; clarity = 1 − sd/0.35. */
export function updateBelief(b: TraitBelief, o: number, sigma: number, day: number): TraitBelief {
  const prec = 1 / (b.sd * b.sd) + 1 / (sigma * sigma);
  const sd = Math.sqrt(1 / prec);
  const est = sd * sd * (b.est / (b.sd * b.sd) + o / (sigma * sigma));
  return { est, sd, clarity: Math.max(0, 1 - sd / 0.35), lastObsDay: day };
}

/** One observation of a trait on a version through a tool family. TODO(WS2, M1). */
export function observe(_s: GameStateV2, _ctx: SystemCtx, _versionId: string, _trait: TraitId, _family: ToolFamily, _strength: number): number | undefined {
  return undefined;
}
