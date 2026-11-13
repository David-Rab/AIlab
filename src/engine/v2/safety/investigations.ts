// Investigations (V2-SPEC §3.5.8). Owner: WS2.
import type { GameStateV2, Investigation, SystemCtx } from '../types';

/** Open a case. TODO(WS2, M1). */
export function openInvestigation(_s: GameStateV2, _ctx: SystemCtx, _target: Investigation['target'], _fte: number): Investigation | string {
  return 'Investigations arrive in M1';
}
