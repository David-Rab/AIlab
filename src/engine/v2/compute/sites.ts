// Data-centre sites: permitting → power → building → live (V2-SPEC §3.8). Owner: WS3.
import { dayOfDate } from '../core/time';
import type { BaselineId, EngineSystem, Site } from '../types';

/** Player sites at Jul 2025 (§3.7.2): 2 live (0.6 GW, 0.5M H100e), S3 1.2 GW building, S4 2 GW permitting. */
export function initialSites(baseline: BaselineId, startDate: string): Site[] {
  const k = baseline === 'reality' ? 0.85 : 1;
  const base = { crash: false, communityPackage: false, spvFunded: 0 };
  return [
    { ...base, id: 'S1', name: 'Abilene North', region: 'US', path: 'lease', mw: 300, stage: 'live', stageEndDay: 0, capex: 0, capexPaid: 0, installed: 250000 * k },
    { ...base, id: 'S2', name: 'Abilene South', region: 'US', path: 'brownfield', mw: 300, stage: 'live', stageEndDay: 0, capex: 0, capexPaid: 0, installed: 250000 * k },
    { ...base, id: 'S3', name: 'Lone Pine', region: 'US', path: 'gas', mw: 1200, stage: 'building', stageEndDay: dayOfDate(startDate, '2026-04-01'), capex: 12 * k, capexPaid: 6 * k, installed: 0 },
    { ...base, id: 'S4', name: 'Red River', region: 'US', path: 'grid', mw: 2000, stage: 'permitting', stageEndDay: dayOfDate(startDate, '2026-07-01'), capex: 20 * k, capexPaid: 0, installed: 0 },
  ];
}

/** sitesQ (410, quarterly): permitting, power and build stage rolls; grid pool allocation. TODO(WS3, M1). */
export const sitesQSystem: EngineSystem = {
  id: 'sitesQ', owner: 'WS3', cadence: 'quarterly', order: 410,
  run() {},
};
