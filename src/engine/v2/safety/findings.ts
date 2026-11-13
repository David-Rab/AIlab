// Findings: type draw, content selection, FALSE findings, publishing (V2-SPEC §3.5.3). Owner: WS2.
import type { AgendaId, FindingRecord, GameStateV2, SystemCtx } from '../types';

/** Fire one finding for an agenda (type weights, catalog row, posterior update). TODO(WS2, M1). */
export function fireFinding(_s: GameStateV2, _ctx: SystemCtx, _agenda: AgendaId): FindingRecord | undefined {
  return undefined;
}

/** Publish a finding (§3.5.3 "Publishing"). TODO(WS2, M1). */
export function publishFinding(_s: GameStateV2, _ctx: SystemCtx, _findingId: string): void {}
