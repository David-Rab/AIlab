// Theft, secrets leak, insider leaks (V2-SPEC §3.6). Owner: WS4.
import type { GameStateV2 } from '../types';

/** P(successful theft in 2 months) = 1/(1 + 19·6^(d−a)) (R11 #24). */
export function theftP2mo(defence: number, attacker: number): number {
  return 1 / (1 + 19 * Math.pow(6, defence - attacker));
}

/** Daily theft hazard against the player. TODO(WS4, M1). */
export function theftHazardDaily(_s: GameStateV2): number {
  return 0;
}
