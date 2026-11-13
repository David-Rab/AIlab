// Trait causal graph dynamics and misalignment index (V2-SPEC §3.5.4). Owner: WS2.
import type { EngineSystem, GameStateV2, ModelVersion, SystemCtx, TrainingRun, TraitVector, UModeId } from '../types';
import { UMODES } from '../../../data/v2/umodes';

const SPECULATIVE = new Set(UMODES.filter((u) => u.kind === 'speculative').map((u) => u.id));

/**
 * WS2 hook called by WS1 runs.ts when a run completes (§3.5.4 update rule): applies signals S1–S8 through the
 * edges to the new version's traitsTrue and masks. TODO(WS2, M1).
 */
export function applyRunToTraits(_s: GameStateV2, _ctx: SystemCtx, _run: TrainingRun, _version: ModelVersion): void {}

/** Misalignment index Mis (hidden), §3.5.4. */
export function misalignment(t: TraitVector, uModes: readonly UModeId[] = []): number {
  const spec = uModes.filter((u) => SPECULATIVE.has(u)).length;
  const m = 0.25 * t.SCHEME + 0.15 * t.AF + 0.15 * t.POWER + 0.15 * t.SUCC + 0.1 * t.COLLUDE + 0.1 * t.SAND
    + 0.05 * t.TGAME + 0.05 * t.OBF + 0.05 * spec - 0.1 * (t.HONEST - 0.5) - 0.1 * (t.CORRIG - 0.5);
  return Math.min(1, Math.max(0, m));
}

/** Misalignment estimate from the player's beliefs (visible). */
export function misalignmentEstimate(v: ModelVersion): number {
  const est = Object.fromEntries(Object.entries(v.beliefs).map(([k, b]) => [k, b.est])) as TraitVector;
  return misalignment(est);
}

/** traitsDaily (75, daily): deployment-driven signals (S8, memory), mask decay. TODO(WS2, M1). */
export const traitsDailySystem: EngineSystem = {
  id: 'traitsDaily', owner: 'WS2', cadence: 'daily', order: 75,
  run() {},
};
