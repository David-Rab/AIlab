// Epilogue fast-sim for 'overtaken' and company-loss endings (V2-SPEC §5.1 #9, §5.2). Owner: WS4.
import type { EndingV2, GameStateV2 } from '../types';

/** Fast-simulate the leading competitor to ASI and resolve with its hidden traits. TODO(WS4, M2). */
export function runEpilogue(_s: GameStateV2): EndingV2['epilogue'] {
  return {};
}
