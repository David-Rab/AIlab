// Run design → offsets, signals, predictions (V2-SPEC §3.3.2). Owner: WS1.
import type { BaseDesign, DomainId, GameStateV2, PostDesign, RunPrediction, SignalId } from '../types';

export interface DesignEffect { dp: number; domains: Partial<Record<DomainId, number>>; serve: number; monitorability: number; signals: Partial<Record<SignalId, number>> }

/** Offsets of a design relative to the reference recipe. TODO(WS1, M1): full §3.3.2 tables. */
export function designEffect(_base?: BaseDesign, _post?: PostDesign): DesignEffect {
  return { dp: 0, domains: {}, serve: 0.5, monitorability: 0.9, signals: {} };
}

/** Run card prediction (§3.3.2 "Run card"). TODO(WS1, M1). */
export function predictRun(_s: GameStateV2, _base?: BaseDesign, _post?: PostDesign): RunPrediction | undefined {
  return undefined;
}
