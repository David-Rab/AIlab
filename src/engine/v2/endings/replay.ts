// Causal replay: top-5 decisions by 90-day impact (V2-SPEC §5.4). Owner: WS4.
import type { DecisionRecord, GameStateV2 } from '../types';

/** TODO(WS4, M2). */
export function topDecisions(_s: GameStateV2, _n = 5): { decision: DecisionRecord; impact: number; caused: string }[] {
  return [];
}
