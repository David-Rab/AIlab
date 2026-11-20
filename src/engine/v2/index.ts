// Public entry point of the v2 engine: the EngineApi object plus selectors. UI (WS6/WS7) and bots import from here.
import type { EngineApi } from './types';
import { newGame } from './core/init';
import { act, resolve, tick } from './core/loop';
import { leadDays, production, raiseCeiling, riskSources, understanding } from './core/selectors';

export const engine: EngineApi = {
  newGame,
  tick,
  act(s, actionId, params) {
    const err = act(s, actionId, params);
    if (err) throw new Error(err);
  },
  resolve(s, instance, choice) {
    const err = resolve(s, instance, choice);
    if (err) throw new Error(err);
  },
  production,
  understanding,
  riskSources,
  leadDays,
  raiseCeiling: (s) => raiseCeiling(s),
};

export { defaultSetupV2, newGame } from './core/init';
export { act, resolve, tick } from './core/loop';
export * from './core/selectors';
export { serialize, deserialize, stateHash, AUTOSAVE_KEY, SLOT_KEYS, V1_SAVE_KEY, SCHEMA_REV } from './core/save';
export type * from './types';

// ───────────── M3 UI selectors (WS6/WS7; read-only, additive) ─────────────
// The UI may only read the visible world. These wrap engine modules so src/ui/v2 never imports internals.
import type { ActionDef, CostLine, EventDefV2, GameStateV2, ModelVersion, DomainId } from './types';
import { ACTIONS as REG_ACTIONS, ACTION_BY_ID as REG_ACTION_BY_ID, EVENTS as REG_EVENTS, EVENT_BY_ID as REG_EVENT_BY_ID } from './core/registry';
import { planRun as planRunUI, type LaunchRunParams as LaunchRunParamsUI } from './models/runs';
import { measuredDomain } from './actors/commitments';
import { DOMAIN_IDS } from '../../data/v2/calibration';
import { SHAPE } from '../../data/v2/runDesign';
import { flopPerToken } from './departments/workfit';
import { versionById } from './models/labs';

export const ACTION_DEFS: readonly ActionDef[] = REG_ACTIONS;
export const EVENT_DEFS: readonly EventDefV2[] = REG_EVENTS;
export const actionDef = (id: string): ActionDef | undefined => REG_ACTION_BY_ID.get(id);
export const eventDef = (id: string): EventDefV2 | undefined => REG_EVENT_BY_ID.get(id);

export interface ActionView { id: string; title: string; ok: true | string; costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] }
/** Availability plus cost/gain/exposure preview of an action with `params` (never throws). */
export function actionView(s: GameStateV2, id: string, params: Record<string, number | string | boolean> = {}): ActionView {
  const a = REG_ACTION_BY_ID.get(id);
  if (!a) return { id, title: id, ok: 'unknown action', costs: [], gains: [], exposure: [] };
  let ok: true | string;
  try {
    const r = a.available(s);
    ok = r === true ? true : typeof r === 'string' ? r : 'Unavailable';
  } catch (e) {
    ok = e instanceof Error ? e.message : 'Unavailable';
  }
  try {
    return { id, title: a.title, ok, ...a.preview(s, params) };
  } catch {
    return { id, title: a.title, ok, costs: [], gains: [], exposure: [] };
  }
}

/** Preview of a decision choice (never throws). */
export function choiceView(s: GameStateV2, eventId: string, choice: number): Omit<ActionView, 'id'> {
  const c = REG_EVENT_BY_ID.get(eventId)?.choices[choice];
  if (!c) return { title: '?', ok: 'unknown', costs: [], gains: [], exposure: [] };
  let ok: true | string = true;
  try {
    const r = c.available?.(s) ?? true;
    ok = r === true ? true : typeof r === 'string' ? r : 'Unavailable';
  } catch {
    ok = 'Unavailable';
  }
  try {
    return { title: c.label, ok, ...c.preview(s) };
  } catch {
    return { title: c.label, ok, costs: [], gains: [], exposure: [] };
  }
}

/** Run card for the run designer: the predicted band under UI-safe names (a prediction, not truth). */
export function runCard(s: GameStateV2, p: LaunchRunParamsUI) {
  const plan = planRunUI(s, p);
  const pr = plan.prediction;
  return {
    fpt: planFpt(s, p, pr.serveCost),
    band: pr.Lg, domains: pr.domains, signals: pr.signals, etaDays: plan.etaDays, serveCost: pr.serveCost, monitorability: pr.monitorability,
    flop: plan.flopNeeded, cash: plan.cashCost, poolShare: plan.poolShare, reason: plan.reason, g: plan.g,
    effShare: plan.effShare, setupTW: plan.setupTW, setupDays: plan.setupDays, limits: plan.limits,
  };
}

/** B4 (readout only): physical FLOP per token of the model a run would make (what fptOfBuild sets on the version):
 *  2 × active parameters × the shape's token multiplier × the serving efficiency relative to its base (post-train) or
 *  teacher (distillation). The relative serve cost is only the bridge between the two. */
function planFpt(s: GameStateV2, p: LaunchRunParamsUI, serve: number): number {
  const m = s.player.models;
  if (p.kind === 'base') return p.base ? 2 * p.base.params * SHAPE[p.base.shape].tokenMult : 0;
  if (p.kind === 'distill') {
    const t = versionById(s, p.teacherVersionId);
    return t && t.serveCost > 0 ? flopPerToken(s, t) * (serve / t.serveCost) : 0;
  }
  const b = p.baseId ? m.bases.find((x) => x.id === p.baseId) : undefined;
  if (!b) return 0;
  const rel = b.serve && b.serve > 0 ? serve / b.serve : 1;
  return 2 * b.params * SHAPE[b.design.shape].tokenMult * rel;
}

/** Predicted band of a launched run (run queue). */
export const runBand = (r: { predicted: { Lg: [number, number] } }): [number, number] => r.predicted.Lg;

/** Measured domain levels of a version (what the player's evals show). */
export function measuredDomains(v: ModelVersion): Record<DomainId, number> {
  return Object.fromEntries(DOMAIN_IDS.map((d) => [d, measuredDomain(v, d)])) as Record<DomainId, number>;
}

export { runwayOf, RUNWAY_CAP } from './finance/runway';
export { parentSchedule, parentYear, parentPaymentQ, DIVISION_REASON } from './finance/parent';
export { debtHeadroom, totalDebt, interestPerYear, debtRatePct } from './finance/debt';
export { dealMenu, dealPreview } from './finance/actions';
export { liveLedger, commitmentsPerYear, ledgerDue, qOf } from './finance/ledger';
export { orderQuote, spotRentalCap } from './compute/orders';
export { oppositionOdds, siteCapex, siteEtaQ } from './compute/sites';
export { chipFit, computeForecast, computeHistory, idleChips, siteLiveQ } from './compute/forecast';
export type { ChipFit, ForecastEvent, ForecastQ } from './compute/forecast';
export { ownedOnline, rentedOnline, poolsOf } from './compute/power';
export { spotPrice, cloudPricePerYear } from './compute/market';
export { liveCommitments, keptShare } from './actors/commitments';
export { leverageAll, leverageTier, playerLeverageByLineage, LEVERAGE_THRESHOLDS, CONTROL_DOMAINS } from './worldfx/control';
export { revenueReadout } from './worldfx/revenue';
export { techBlocker } from './worldfx/techtree';
export { canonicalKey } from './core/causes';
export { quarterIndex, dayOfQuarter, dayOfDate } from './core/time';
// End screen only (truth): the causal replay.
export { topDecisions } from './endings/replay';
export * from './core/limitsView';
// Model v3 D5: RL environment suites (readout and costs).
export { suitesView, suiteWorkCost, suiteWorkEffect, familyDomain, type SuiteRow } from './models/suites';
// Model v3 D6: the suites view (Models › Suites): previews of suite work on a planned post-train (output only).
export { suitePlanEffect, suiteS2Parts, suiteWorkPreview, suitePending, lockedSuiteFamilies, exploitFloor, type SuitePlanEffect, type SuiteWorkPreview } from './models/suitesPreview';
// Model v3 D4: the data view (Models › Data) and the Blueprint's drawn-mix row (output-only selectors).
export {
  dataPortfolioView, drawByDomain, expertForm, licenceForm, mixTargetOf, naturalMixView, synForm, teacherRows, usageLevels,
  type DataPortfolioView, type DomainMixRow, type DrawDomainRow, type ExpertForm, type LicenceForm, type PendingView, type SynForm, type TeacherRow, type UsageLevelRow,
} from './production/dataView';
export { REF_SHARE, type DataDelta, type DataDraw, type KindRow } from './production/data';
