// Unknown-unknown failure modes: presence, effects, discovery (V2-SPEC §3.5.5). Owner: WS2.
import type { GameStateV2, SystemCtx, UModeId } from '../types';

/** Discover a U-mode (card, relabel incidents, E35). TODO(WS2, M1). */
export function discoverUMode(_s: GameStateV2, _ctx: SystemCtx, _u: UModeId): void {}
