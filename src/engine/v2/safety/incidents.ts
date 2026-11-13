// Incidents: hazards, detection, public timers, exfiltration (V2-SPEC §3.5.10). Owner: WS2.
import type { EngineSystem, GameStateV2, Incident } from '../types';

/** Open (unresolved) incidents of the player, for WS4 events and WS5 headlines. */
export function openIncidents(s: GameStateV2): Incident[] {
  return s.player.safety.incidents.filter((i) => i.status === 'open' || i.status === 'investigating');
}

/** Daily exfiltration hazard for the player's internal fleet (§3.5.10). TODO(WS2, M1). */
export function exfiltrationHazard(_s: GameStateV2): number {
  return 0;
}

/** incidents (80, daily): hazard per deployment × trait/U-mode; detection and exposure timers; misuse. TODO(WS2). */
export const incidentsSystem: EngineSystem = {
  id: 'incidents', owner: 'WS2', cadence: 'daily', order: 80,
  run() {},
};
