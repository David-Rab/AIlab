// EngineApi read selectors (V2-SPEC §2.1 "Selectors are the only path for the UI"). Owner: WS1 (re-exports owners').
//
// UI code imports from here (or src/engine/v2/index.ts) only. Selectors return what the PLAYER knows: measured
// levels, beliefs, intel. `selectHidden` is for the end screen only (scripts/v2/lint-hidden.ts enforces this).
import { bestLg, bestPm, internalVersion, measuredLOf, PLAYER_ID } from '../models/labs';
import { misalignment, predictBeliefs, type Signals } from '../safety/traits';
import { detectionAt, understanding } from '../safety/understanding';
import { mAtLevel } from '../safety/common';
import { strengthBelieved } from '../safety/techniques';
import { planRun, type LaunchRunParams } from '../models/runs';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { leadDays } from '../actors/intel';
import type { DecisionSnapshot, GameStateV2, HiddenWorld, SignalId, TraitId } from '../types';

export { production, productionWhatIf, nextModelGate, researchMixCurve, responseCurves, RESPONSE_SCALES } from '../production/readout';
export type { MixCurve, NextModelGate, ResponseCurves } from '../production/readout';
export { MANUAL_MIX_RANGE, specOf, topOf, TOP_KEYS } from '../departments/split';
export type { SplitSpec, TopKey, TopSplit } from '../departments/split';
// WS1 model / department selectors and helpers for the UI (visible data only).
export { idleTrainingShare, knowHowMonths, planRun, poolAllocation, predictRun, POOL_SHARE_RANGE, runEtaDays, runStall, serveTechMult, shareIfLaunched, streamShare, trainingFlopPerDay } from '../models/runs';
export type { BaseLimits } from '../models/runs';
export { buildBacklogTW, buildEtas, buildPerDay, runSetupTW, runWaiting } from '../departments/build';
export { SIZE_RANGE, SIZE_SNAPS, STREAM_POOL_SHARE, sizeMinDays } from '../../../data/v2/runDesign';
export type { LaunchRunParams, RunPlan } from '../models/runs';
export { PARADIGM_BY_ID } from '../models/paradigms';
export { assignBlock, effortOf, idleTeams, knowHow, isMirror, isProject, missingNeeds, nodeKnown, nodeOdds, nodeStatus, optionLocked, payoffOf, projectCapacity, projectEta, projectRate, projectReady, projectTeams, researchSpeed, teamCapacity, teamsOn, treeCounts } from '../models/tree';
export type { NodeStatus } from '../models/tree';
export { benchName, benchGen, evalDaysFor } from '../models/benchmarks';
export { deployGate, effortLock, liveDeployments, CHANNEL_VARIANTS, distillationAccess } from '../models/deployments';
export { bestMeasuredL, internalVersion, labPools, measuredLOf, versionById } from '../models/labs';
export { MILESTONE_NAMES } from '../models/capability';
export { presetSplit, shareRefAt, SPLIT_KEYS, SPLIT_PRESETS } from '../departments/split';
export { teamGain } from '../departments/teamActions';
export { aiShareByRole, BUILD_AI_CAP, buildCapacity, fillWeeks, laneWeights, fullTeamPayroll, keyOf, payrollOf, playerH, queuedOfKey, teamLabel, teamPayroll, teamsOfKey, weeklyHireCap } from '../departments/teams';
export { baseFromParams, postFromParams } from '../models/actions';
export { understanding } from '../safety/understanding';
export { leadDays, riskSources } from '../actors/intel';
export { raiseCeiling } from '../finance/equity';
// WS2 safety-panel selectors (beliefs, posteriors, incidents as the player sees them). `safetyTruth` is END SCREEN ONLY.
export { agendaRows, beliefView, findingRows, incidentRows, safetyTruth, safetyUtilisation, safetyView, techniqueRows, traitGraph, uModeCards } from '../safety/view';
export type { AgendaRow, FindingRow, SafetyUtilisation, TechniqueRow } from '../safety/view';
export { aiLabourGate, safetyAgentVersion, safetyFleet } from '../safety/agents';
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

// ───────── M5 UX read-only selectors (Safety lab, Run designer). Player-visible data only. ─────────

/** Detection-by-level heat grid (PLAN B4): believed detection of each critical trait on the internal model at
 *  levels around its measured level L (2·span + 1 columns centred on round(L), shifted to stay in 0…15). */
export function detectionGrid(s: GameStateV2, span = 4): { L: number; levels: number[]; rows: { trait: TraitId; det: number[] }[] } {
  const v = internalVersion(s);
  const L = measuredLOf(s, v).L;
  const c = Math.round(L);
  const levels: number[] = [];
  const lo = Math.max(0, Math.min(15 - 2 * span, c - span));
  for (let l = lo; l <= Math.min(15, lo + 2 * span); l++) levels.push(l);
  if (!v) return { L, levels, rows: CRITICAL_TRAITS.map((trait) => ({ trait, det: levels.map(() => 0) })) };
  return { L, levels, rows: CRITICAL_TRAITS.map((trait) => ({ trait, det: levels.map((l) => detectionAt(s, v, trait, l)) })) };
}

/** Believed strength of a technique against capability level (Tools tab small multiples): strength at each level
 *  in `levels`, the level at which the overseen model reaches the tool's M½, and the current measured level. */
export function techniqueCurve(s: GameStateV2, id: string, levels: number[]): { strength: number[]; mHalfL: number | undefined; L: number } | undefined {
  const t = s.player.safety.techniques[id];
  if (!t) return undefined;
  const w = s.hidden.timeline;
  const L = measuredLOf(s, internalVersion(s)).L;
  let mHalfL: number | undefined;
  if (t.k > 0 && t.mHalf < 1e8) for (let l = 0; l <= 15; l += 0.05) if (mAtLevel(w, l) >= t.mHalf) { mHalfL = Math.round(l * 100) / 100; break; }
  return { strength: levels.map((l) => strengthBelieved(s, t, mAtLevel(w, l))), mHalfL, L };
}

/** Training-signal pressure of the run(s) that built a version (the player's own recipe). */
export function versionSignals(s: GameStateV2, versionId?: string): Partial<Record<SignalId, number>> {
  const v = (versionId ? s.player.models.versions.find((x) => x.id === versionId) : undefined) ?? internalVersion(s);
  return { ...(v?.build?.signals ?? {}) };
}

/** Run trait pressure (PLAN B3): the beliefs the engine would predict for the run's version (public edge weights,
 *  player moderators, safety-training removal), relative to the internal model's current beliefs. Visible only. */
export function runTraitPressure(s: GameStateV2, p: LaunchRunParams): Partial<Record<TraitId, number>> {
  const v = internalVersion(s);
  const prior = v?.beliefs;
  if (!prior) return {};
  const plan = planRun(s, p);
  const base = p.baseId ? s.player.models.bases.find((b) => b.id === p.baseId) : undefined;
  const omega = p.kind === 'base' ? 1 : p.kind === 'continue' ? 0.5 : p.kind === 'distill' ? 0.4 : 0.6;
  const next = predictBeliefs(s, prior, plan.prediction.signals as Signals, omega, p.kind === 'post' ? p.post : undefined, base?.lineage ?? 'L-unknown');
  const out: Partial<Record<TraitId, number>> = {};
  for (const t of Object.keys(next) as TraitId[]) out[t] = next[t].est - (prior[t]?.est ?? 0);
  return out;
}
export { WSL_TARGET_RANGE } from '../security/security';
