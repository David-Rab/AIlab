// Understanding U and the race bars (V2-SPEC §3.5.7). Owner: WS2.
import { internalVersion } from '../models/labs';
import type { GameStateV2, TraitId } from '../types';

export interface UnderstandingReadout { U: number; margin: number; perTrait: Partial<Record<TraitId, number>> }

/**
 * EngineApi.understanding: U = largest L with mean critical-trait detection ≥ 0.5, from BELIEFS (never truth).
 * M0 PLACEHOLDER: U = measured L − 0.5 so the UI has a plausible bar. TODO(WS2, M1).
 */
export function understanding(s: GameStateV2): UnderstandingReadout {
  const L = internalVersion(s)?.evals.measuredL ?? 0;
  const U = Math.max(0, L - 0.5);
  return { U, margin: U - L, perTrait: {} };
}
