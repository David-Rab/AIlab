// Macro indicators: GDP, unemployment, wages, Gini, Dow, AI-capex share (V2-SPEC §3.11.2; research/16 §4). Owner: WS5.
import type { EngineSystem } from '../types';

/** macro (310, monthly). TODO(WS5, M1). */
export const macroSystem: EngineSystem = {
  id: 'macro', owner: 'WS5', cadence: 'monthly', order: 310,
  run() {},
};
