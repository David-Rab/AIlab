// Bottleneck readout selector (V2-SPEC §3.2.5, §6.4). Owner: WS1.
import { neutralReadout } from './placeholder';
import { computeProduction } from './production';
import { bestPm } from '../models/labs';
import type { GameStateV2, LabId, ProductionReadout } from '../types';

/** EngineApi.production: the lab's latest readout (cached by the daily production system). */
export function production(s: GameStateV2, lab: LabId): ProductionReadout {
  return computeProduction(s, lab) ?? neutralReadout(s.hidden.timeline, bestPm(s, lab), 1);
}

/** "Next model" mini-bar (§3.2.5). TODO(WS1, M1). */
export interface NextModelGate { trainingDays: number; dataRatio: number; mwFree: number; cashShare: number; binding: 'training' | 'data' | 'power' | 'cash' }
export function nextModelGate(_s: GameStateV2): NextModelGate {
  return { trainingDays: 0, dataRatio: 1, mwFree: 0, cashShare: 0, binding: 'training' };
}
