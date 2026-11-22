// EngineApi read selectors (V2-SPEC §2.1 "Selectors are the only path for the UI"). Owner: WS1 (re-exports owners').
//
// UI code imports from here (or src/engine/v2/index.ts) only. Selectors return what the PLAYER knows: measured
// levels, beliefs, intel. `selectHidden` is for the end screen only (scripts/v2/lint-hidden.ts enforces this).
import { bestLg, internalVersion, measuredLOf, PLAYER_ID } from '../models/labs';
import { misalignment, predictBeliefs, runHack, runOmega, type Signals } from '../safety/traits';
import { detectionAt, understanding } from '../safety/understanding';
import { levelOfOom, oomOfLevel } from '../safety/oversight';
import { strengthBelieved } from '../safety/techniques';
import { planRun, type LaunchRunParams } from '../models/runs';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { leadDays } from '../actors/intel';
import type { DecisionSnapshot, GameStateV2, HiddenWorld, SignalId, TraitId } from '../types';

export { production, responseCurves, RESPONSE_SCALES } from '../production/readout';
export type { ResponseCurves } from '../production/readout';
export { allocOf, SPLIT_LABEL } from '../departments/split';
// WS1 model / department selectors and helpers for the UI (visible data only).
export { adoptedDuring, idleTrainingShare, planRun, poolAllocation, POOL_SHARE_RANGE, RUN_POOL_DEFAULT, runEtaDays, runStall, serveTechMult, shareIfLaunched, streamShare, trainingFlopPerDay } from '../models/runs';
export type { BaseLimits } from '../models/runs';
export { buildEtas, buildPerDay, buildRates, buildWaitNew, featureInUse, featureUpkeepTW, LAUNCH_TW, pendingLaunch, pendingPack, productUpkeepTW, runSetupTW, runWaiting, SECTOR_PACK_TW, upkeepLines, upkeepSplit, UPKEEP } from '../departments/build';
export type { UpkeepLine } from '../departments/build';
export { PARAM_RANGE, PARAM_SNAPS, REF_TPP, RL_BUDGET, STREAM_POOL_SHARE, STUDENT_DEFAULT, TPP_FREE_MAX, TPP_RANGE, TPP_SNAPS } from '../../../data/v2/runDesign';
export { fOver, flopOfDesign, paramsForFlop, servingFlop, tppLabel } from '../models/effective';
export { goodputOf, paramsOfVersion, runFlopPerShareDay } from '../models/runs';
export type { LaunchRunParams, RunPlan } from '../models/runs';
export { PARADIGM_BY_ID } from '../models/paradigms';
export { capEta, effortClassOf, effortOfNode, isCapProject, stagesOf } from '../models/research';
export { assignBlock, effortOf, idleTeams, isProject, missingNeeds, nextLineProject, nodeDept, nodeKnown, nodeOdds, nodeStatus, optionLocked, payoffOf, projectCapacity, projectEta, projectRate, projectReady, projectTeams, PRIORITY_W, researchSpeed, teamGain as projectTeamGain, teamsOn, treeCounts } from '../models/tree';
export type { NodeStatus } from '../models/tree';
export { benchName, benchGen, measuredSd } from '../models/benchmarks';
export { evalDaysFor, evalDaysEstimate, evalCost, evalDepthView, evalMeasureView, evalPolicyView, evalQueueView, gateDepth, policyDepth } from '../models/evals';
export type { EvalCost, EvalDepthRow, EvalMeasureRow, EvalTaskView } from '../models/evals';
export { deployGate, effortLock, CHANNEL_VARIANTS, distillationAccess } from '../models/deployments';
export { bestMeasuredL, internalVersion, measuredLOf, versionById } from '../models/labs';
export { MILESTONE_NAMES } from '../models/capability';
export { presetSplit, shareRefAt, SPLIT_KEYS, SPLIT_PRESETS } from '../departments/split';
export { teamGain } from '../departments/teamActions';
export { aiShareByRole, buildCapacity, fillWeeks, laneWeights, fullTeamPayroll, keyOf, payrollOf, playerH, queuedOfKey, teamLabel, teamPayroll, teamsOfKey, weeklyHireCap } from '../departments/teams';
export { RUN_PARAM_DEFAULTS, baseFromParams, postFromParams } from '../models/actions';
export { understanding, understandingBand } from '../safety/understanding';
export { leadDays, riskLevers, riskSources, RISK_LEVERS } from '../actors/intel';
export { raiseCeiling } from '../finance/equity';
// WS2 safety-panel selectors (beliefs, posteriors, incidents as the player sees them). `safetyTruth` is END SCREEN ONLY.
export { beliefView, findingRows, incidentRows, lineBadges, lineRows, riskFamilies, safetyTruth, safetyUtilisation, safetyView, techniqueRows, traitGraph, uModeCards, upkeepView } from '../safety/view';
export type { FindingRow, LineRow, SafetyUtilisation, TechniqueRow } from '../safety/view';
export { footholdView } from '../safety/footholdDetection';
export { controlView } from '../safety/control';
export { believedInternalOversight } from '../safety/believedOversight';
export type { FootholdRow } from '../safety/footholdDetection';
export { lineMult, lineResultsPerYear, posteriorBand, promisingIdle, safetyRe } from '../safety/agendas';
export { familySeenTo } from '../safety/understanding';
export { basePressure, plannedPressure, postPressure, signalPushes, storedBaseRows, successorPullView, versionPressure } from '../safety/pressureView';
export type { FamilyId, ImitationView, PressureRow, PushTarget, RunPressure, SuccessorPartView, SuccessorPullView } from '../safety/pressureView';
export { INV_FTE, INV_MAX_DAYS } from '../safety/investigations';
export { safetyAgentVersion, safetyFleet, trustedShare } from '../safety/agents';
export { lineLabour } from '../safety/lineProjects';
// R7 internal agent packages (Company › Agents at work).
export { agentVersion, monitorBudget, monitoredUses, monitorVersion, riskBadges, usesOf } from '../departments/agents';
export type { RiskBadge } from '../departments/agents';
export { agentChangeBlock, agentsView, MONITOR_BUDGET_STEP, monitorAt, previewAgentChange, previewTrusted, withAgentChange } from '../departments/agentActions';
export type { AgentChange, AgentLane, AgentPreview, AgentsView } from '../departments/agentActions';
// WS5 world readouts (observables only).
export { automationShare, dowYtd, firmAdoption, remoteWorkAutomation, unemploymentChange12m, workUse, youthExposedEmployment } from '../worldfx/readouts';
// B3: the World panel's sector view (output-only).
export { sectorsView } from '../worldfx/sectorView';
export type { RegionWorkRead, SectorProviderRead, SectorRead } from '../worldfx/sectorView';
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
 *  in `levels`, the level at which the overseen model reaches the tool's half-strength point (model v3 E6: oHalf OOM
 *  above the start model, as a level; undefined when it does not decay or lies beyond L 15), and the current measured
 *  level. */
export function techniqueCurve(s: GameStateV2, id: string, levels: number[]): { strength: number[]; halfL: number | undefined; L: number } | undefined {
  const t = s.player.safety.techniques[id];
  if (!t) return undefined;
  const w = s.hidden.timeline;
  const L = measuredLOf(s, internalVersion(s)).L;
  let halfL: number | undefined;
  if (t.k > 0 && t.oHalf < 1e8 && t.agenda !== 'AG05' && t.oHalf < oomOfLevel(w, 15)) halfL = Math.round(levelOfOom(w, t.oHalf) * 100) / 100;
  return { strength: levels.map((l) => strengthBelieved(s, t, oomOfLevel(w, l))), halfL, L };
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
  const runLike = { kind: p.kind, name: p.ida ? 'IDA' : p.kind, flopNeeded: plan.flopNeeded, ...(p.baseId ? { baseId: p.baseId } : {}), ...(p.post ? { post: p.post } : {}) };
  const om = runOmega(s, runLike);
  const lh = runHack(s, runLike).lambda; // E16: learned hacking from the planned run's suites and RL budget
  const next = predictBeliefs(s, prior, plan.prediction.signals as Signals, om.growth, p.kind === 'post' ? p.post : undefined, base?.lineage ?? 'L-unknown', om.safety, undefined, lh, plan.g.G > 0 ? plan.g.G : undefined, p.kind === 'base' || p.kind === 'continue'); // E18: the AF gate at the planned model's G; E20: no E13 / E27 in pretraining
  const out: Partial<Record<TraitId, number>> = {};
  for (const t of Object.keys(next) as TraitId[]) out[t] = next[t].est - (prior[t]?.est ?? 0);
  return out;
}
export { WSL_TARGET_RANGE } from '../security/security';

// R6 products: readouts, live-edit previews and package helpers (visible data: measured levels, revenue).
export { productReadouts, previewDeployments, featureView, CONVERGED } from '../worldfx/productView';
export { studentToHold, tokEff, useHourCost } from '../worldfx/serving';
export { flopPerToken } from '../departments/workfit';
export type { ProductRead, ProductEcon, EditPreview, CustomerView, CustomerSeg, FeatureView, FeatureKind, FeatureLine, LineupRow } from '../worldfx/productView';
export { editBlock, editedProduct, previewEdit } from '../models/productOps';
export type { ProductChanges } from '../models/productOps';
export { activeFeatures, agentsGate, catchRate, collusionTrait, sameLineage, featureBuildBlock, featureToggleBlock, isProduct, measuredHorizonH, monitorOverhead } from '../models/products';
export { monitorCatchAt, type ControlReadout } from '../safety/oversight';
export { LENT_RECOVERY, servingPool, spareServing, spareServingToResearch } from '../worldfx/revenue';
export { spareServingEffect } from '../production/production';
// Model v3 V2b research UI: projects, recipe stacks, allocations, AI labour per work type, milestones, research speed.
export {
  STAGES, UNLOCK_STAGES, PROJECT_MAX_TEAMS, addableProjects, buildSplit, capPriorityList, capProjectView, engAllocView, milestoneViews,
  otherEffectViews, reAllocView, researchSpeedView, softwareRate, stackViews, workTypeViews,
} from '../models/researchView';
export type { AdoptedView, AllocView, CapProjectView, EffectRowView, MilestoneView, NeedView, OtherEffectView, ResearchSpeedView, StackView, StageId, WorkTypeView } from '../models/researchView';
// Model v3 E11: the player's danger readout per product and internal lane, and the control readout (beliefs only).
export { CONTROL_BANDS, controlBand, controlReadout, dangerView } from '../safety/dangerView';
export type { ControlBand, ControlRead, DangerActRead, DangerLever, DangerRead } from '../safety/dangerView';
export { ousterVote, ousterLive, ousterPassesBelow, OUSTER, OUSTER_BC, OUSTER_NOTICE_D, BC_WARN, BC_CLEAR, CRITICS, criticsAvailable, criticsSide, criticsSeat, trustVote } from '../finance/board'; // jank ST3 + FIN3b: board review, ouster vote, critics' seat
export { charterRights, charterHolds } from '../finance/charter'; // FIN3b: charter rights
export { teamCapacity } from '../departments/capacity';
