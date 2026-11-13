// US government: meters, G-SEC / G-CHN ladders, statutes, nationalisation (V2-SPEC §3.10.1; research/07 §1.1). Owner: WS4.
import { GOV_PRESETS } from '../../../data/actors';
import type { GovActor } from '../types';

export const govPresetOf = (id: string) => GOV_PRESETS.find((p) => p.id === id) ?? GOV_PRESETS[0];

/** Government at Jul 2025 (v1 start values + v2 fields). Statutes switch on by date (SB 53: 2026-01-01). */
export function initialGov(presetId: string): GovActor {
  const p = govPresetOf(presetId);
  return {
    preset: p.id,
    aiPriority: 55, regStance: -60, securityDemand: 15, hawkishness: Math.round(50 * p.hawk),
    nationalization: 0, congressActivism: 20, stateRegPressure: 40, judicialCheck: 50,
    awareness: 30,
    congressControl: 'R',
    rungSec: 0, rungChn: 0,
    oversight: false, treaty: 'none',
    statutes: { sb53: false, raise: false, euCode: false, federalLicensing: false, preemption: false },
    holdDays: {},
    lastActionDay: {},
  };
}
