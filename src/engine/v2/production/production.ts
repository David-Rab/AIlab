// Production function and know-how growth (V2-SPEC §3.1.2, §3.2.2). Owner: WS1.
import { M0_PLACEHOLDER_PROGRESS, placeholderAdvance } from './placeholder';
import type { EngineSystem, GameStateV2, LabId, ProductionReadout } from '../types';

/** Inputs of one lab's production function for one day (ratios vs the dated reference path, §3.2.1). */
export interface LabInputs {
  pDep: number; // §3.1.2
  h: number; k: number; c: number; d: number;
  tasteHire: number;
  etaMod: number;
  controlTax: number;
  mods: number; // eff_lab · silo · other multipliers
}

/**
 * Production readout for a lab (§3.2.2/§3.2.5). TODO(WS1, M1): implement the R13 equations with knots.
 * M0: returns the cached placeholder readout.
 */
export function computeProduction(s: GameStateV2, lab: LabId): ProductionReadout | undefined {
  if (lab === 'player') return s.player.prodCache;
  if (lab === 'china') return s.china.lab.core.prodCache;
  return s.rivals.find((r) => r.core.id === lab)?.core.prodCache;
}

/** production (30, daily): for player, rivals and China — readout, then pa += rate/365 (§3.2). */
export const productionSystem: EngineSystem = {
  id: 'production', owner: 'WS1', cadence: 'daily', order: 30,
  run(s) {
    if (M0_PLACEHOLDER_PROGRESS) placeholderAdvance(s);
  },
};
