// EngineApi read selectors (V2-SPEC §2.1 "Selectors are the only path for the UI"). Owner: WS1 (re-exports owners').
//
// UI code imports from here (or src/engine/v2/index.ts) only. Selectors return what the PLAYER knows: measured
// levels, beliefs, intel. `selectHidden` is for the end screen only (scripts/v2/lint-hidden.ts enforces this).
import { bestLg, bestPm, internalVersion, measuredLOf, PLAYER_ID } from '../models/labs';
import { misalignment } from '../safety/traits';
import { understanding } from '../safety/understanding';
import { leadDays } from '../actors/intel';
import type { DecisionSnapshot, GameStateV2, HiddenWorld } from '../types';

export { production, productionWhatIf, nextModelGate } from '../production/readout';
export type { NextModelGate } from '../production/readout';
// WS1 model / department selectors and helpers for the UI (visible data only).
export { planRun, predictRun } from '../models/runs';
export type { LaunchRunParams, RunPlan } from '../models/runs';
export { paradigmGate, PARADIGM_BY_ID } from '../models/paradigms';
export { benchName, benchGen, evalDaysFor } from '../models/benchmarks';
export { deployGate, liveDeployments, CHANNEL_VARIANTS, distillationAccess } from '../models/deployments';
export { bestMeasuredL, internalVersion, labPools, measuredLOf, versionById } from '../models/labs';
export { MILESTONE_NAMES } from '../models/capability';
export { presetSplit, shareRefAt, SPLIT_KEYS, SPLIT_PRESETS } from '../departments/split';
export { weeklyHireCap, payrollPerYear, inPipeline } from '../departments/staffing';
export { baseFromParams, postFromParams, payrollAtTarget } from '../models/actions';
export { understanding } from '../safety/understanding';
export { leadDays, riskSources } from '../actors/intel';
export { raiseCeiling } from '../finance/equity';
// WS2 safety-panel selectors (beliefs, posteriors, incidents as the player sees them). `safetyTruth` is END SCREEN ONLY.
export { agendaRows, beliefView, findingRows, incidentRows, safetyTruth, safetyView, techniqueRows, traitGraph, uModeCards } from '../safety/view';
export type { AgendaRow, FindingRow, TechniqueRow } from '../safety/view';
// WS5 world readouts (observables only).
export { automationShare, dowYtd, firmAdoption, remoteWorkAutomation, unemploymentChange12m, youthExposedEmployment } from '../worldfx/readouts';
export { causeStrip } from './causes';
export { activeRivals } from '../models/labs';
export { dateOf, decimalYear, fmtDate, fmtMonth } from './time';

/** Measured general level of the internal-agent version (what the player sees in the top strip). */
export function measuredL(s: GameStateV2): number {
  return measuredLOf(s, internalVersion(s)).L;
}

/** The internal agent's measured level and whether it is still in evaluation (shown with an "evaluating" marker). */
export function internalEval(s: GameStateV2): { L: number; evaluating: boolean; name?: string } {
  const v = internalVersion(s);
  return { ...measuredLOf(s, v), ...(v ? { name: v.name } : {}) };
}

/** END SCREEN ONLY. The hidden truth of this world. */
export function selectHidden(s: GameStateV2): HiddenWorld {
  return s.hidden;
}

/** Snapshot stored with each decision for the end-screen causal replay (§5.4). Mixes truth: engine use only. */
export function decisionSnapshot(s: GameStateV2): DecisionSnapshot {
  const v = internalVersion(s);
  const rivals = s.rivals.filter((r) => r.core.status === 'active');
  const leadRival = rivals.length ? Math.min(...rivals.map((r) => leadDays(s, r.core.id).est)) : 0;
  return {
    L: v?.evals.measuredL ?? bestLg(s, PLAYER_ID),
    U: understanding(s).U,
    cash: s.player.finance.cash,
    leadRival,
    leadChina: leadDays(s, 'china').est,
    trustGov: s.relations.stocks.exec.trust,
    approval: s.pub.approval,
    misTrue: v ? misalignment(v.traitsTrue, v.uModes) : 0,
  };
}

/** True frontier progress of a lab (hidden; for tests and end screen). */
export const truePm = (s: GameStateV2, lab: string) => bestPm(s, lab);
