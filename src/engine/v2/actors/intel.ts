// Intel: rival and China lead estimates and misalignment bands; risk-source view (V2-SPEC §3.10.3, §6.6). Owner: WS4.
// leadDays/riskSources are EngineApi selectors: built from intel and BELIEFS, never from truth.
import { activeRivals } from '../models/labs';
import type { EngineSystem, GameStateV2, LabId, RiskSource } from '../types';

/** EngineApi.leadDays: player's estimate of its lead over `other` (positive = player ahead), vs its best INTERNAL
 *  model (v1 bug fix). */
export function leadDays(s: GameStateV2, other: LabId): { est: number; sd: number } {
  const r = other === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === other);
  if (!r) return { est: 0, sd: 0 };
  return { est: r.intel.leadDaysEst, sd: r.intel.leadDaysSd };
}

/** EngineApi.riskSources. M0 PLACEHOLDER rows with flat bands; TODO(WS4 + WS2, M2): drivers from beliefs/intel. */
export function riskSources(s: GameStateV2): RiskSource[] {
  const row = (id: string, label: string, kind: RiskSource['kind']): RiskSource => ({ id, label, kind, estimate: 0.02, band: [0, 0.05], drivers: [] });
  return [
    row('own', s.player.name, 'ownModel'),
    ...activeRivals(s).map((r) => row(`rival:${r.core.id}`, r.core.name, 'rival')),
    row('china', s.china.lab.core.name, 'china'),
    row('misuse', 'Misuse', 'misuse'),
    row('theft', 'Theft', 'theft'),
    row('rogue', 'Rogue copies', 'rogue'),
    row('war', 'War', 'war'),
  ];
}

/** intel (210, weekly): rival/China lead posteriors vs the player's internal frontier. TODO(WS4, M1). */
export const intelSystem: EngineSystem = {
  id: 'intel', owner: 'WS4', cadence: 'weekly', order: 210,
  run() {},
};
