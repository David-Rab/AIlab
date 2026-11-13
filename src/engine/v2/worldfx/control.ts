// Control index and leverage (V2-SPEC §3.11.2; research/16 §2). Owner: WS5.
import type { GameStateV2, LabId } from '../types';

/** Leverage Lev_X = Σ_dom W_dom · Ctrl_dom · Share_X,dom. TODO(WS5, M1). */
export function leverage(_s: GameStateV2, _lab: LabId): number {
  return 0;
}
