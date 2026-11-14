// World latents, player-modified λ2 (V2-SPEC §3.5.1). Owner: WS2.
// The six latents are hidden (drawn in world/hidden.ts). Visible proxies: agenda posteriors (agendas fail
// together), the monitorability metric (λ2), incidents and the trait graph's revealed edges.
import type { GameStateV2 } from '../types';
import { lambda2Delta } from './common';

export { lambda2Delta };

/** λ2_eff = λ2 − 2·[any version uses latent reasoning] − 0.5·[CoT-pressured runs > 2]. Engine only (hidden λ2). */
export function lambda2Eff(s: GameStateV2): number {
  return s.hidden.latents.cotLoadBearing + lambda2Delta(s);
}

/** COT monitors work only while reasoning stays load-bearing (§3.5.6: [λ2_eff > −1]). Engine only. */
export function cotAlive(s: GameStateV2): boolean {
  return lambda2Eff(s) > -1;
}
