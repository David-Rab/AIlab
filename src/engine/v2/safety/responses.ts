// Response menu per confirmed finding or incident (V2-SPEC §3.5.9). Owner: WS2.
import type { GameStateV2, ResponseKind, SystemCtx } from '../types';

/** Apply a response to a version (and optionally an incident). TODO(WS2, M1). */
export function applyResponse(_s: GameStateV2, _ctx: SystemCtx, _kind: ResponseKind, _versionId: string, _incidentId?: string): void {}
