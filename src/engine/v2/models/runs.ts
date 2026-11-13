// Training runs and continual learning (V2-SPEC §3.3.1, §3.1.3–3.1.4). Owner: WS1 (continual shared with WS2).
import { M0_PLACEHOLDER_PROGRESS, placeholderTrack } from '../production/placeholder';
import type { BaseDesign, EngineSystem, GameStateV2, PostDesign, RunKind, SystemCtx, TrainingRun } from '../types';

export interface LaunchRunParams {
  kind: RunKind;
  baseId?: string;
  teacherVersionId?: string;
  base?: BaseDesign;
  post?: PostDesign;
  poolShare: number;
}

/** Launch a run (commits cash, §3.3.1). TODO(WS1, M1). Returns the run or a reason string. */
export function launchRun(_s: GameStateV2, _ctx: SystemCtx, _p: LaunchRunParams): TrainingRun | string {
  return 'Runs arrive in M1';
}

/** runs (40, daily): add FLOP to running runs; on completion create base/version, call WS2 applyRunToTraits,
 *  queue the eval. TODO(WS1, M1). */
export const runsSystem: EngineSystem = {
  id: 'runs', owner: 'WS1', cadence: 'daily', order: 40,
  run() {},
};

/** continual (45, daily): stream versions track pa with a 7-day lag; trait drift 1/42 of a post run per day.
 *  M0: placeholder — every lab's frontier tracks pa directly. */
export const continualSystem: EngineSystem = {
  id: 'continual', owner: 'WS1', cadence: 'daily', order: 45,
  run(s) {
    if (M0_PLACEHOLDER_PROGRESS) placeholderTrack(s);
  },
};
