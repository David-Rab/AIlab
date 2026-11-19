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
import type { ActionDef, BoardVote, CostLine, EventDefV2, GameStateV2, ModelVersion, DomainId } from './types';
import { ACTIONS as REG_ACTIONS, ACTION_BY_ID as REG_ACTION_BY_ID, EVENTS as REG_EVENTS, EVENT_BY_ID as REG_EVENT_BY_ID } from './core/registry';
import { planRun as planRunUI, type LaunchRunParams as LaunchRunParamsUI } from './models/runs';
import { measuredDomain } from './actors/commitments';
import { DOMAIN_IDS } from '../../data/v2/calibration';

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
    band: pr.Lg, domains: pr.domains, signals: pr.signals, etaDays: plan.etaDays, serveCost: pr.serveCost, monitorability: pr.monitorability,
    flop: plan.flopNeeded, cash: plan.cashCost, poolShare: plan.poolShare, minDays: plan.minDays, reason: plan.reason,
    effShare: plan.effShare, setupTW: plan.setupTW, setupDays: plan.setupDays, limits: plan.limits,
  };
}

/** Predicted band of a launched run (run queue). */
export const runBand = (r: { predicted: { Lg: [number, number] } }): [number, number] => r.predicted.Lg;

/** Measured domain levels of a version (what the player's evals show). */
export function measuredDomains(v: ModelVersion): Record<DomainId, number> {
  return Object.fromEntries(DOMAIN_IDS.map((d) => [d, measuredDomain(v, d)])) as Record<DomainId, number>;
}

export { runwayOf, RUNWAY_CAP } from './finance/runway';
export { parentSchedule, parentYear, parentPaymentQ, DIVISION_REASON } from './finance/parent';
export { debtHeadroom, totalDebt, interestPerYear, debtRatePct, newDebtRatePct, ratingTerms, creditLineCapacity, chipCollateral, trailingOpCash, lineUndrawn } from './finance/debt';
export type { Headroom, RatingTerms } from './finance/debt';
export { payOptions, leaseRate, leaseAvailable, contingentLiabilities, siteRVG, leaseBalance } from './finance/capex';
export type { PayOption } from './finance/capex';
export { dealMenu, dealPreview } from './finance/actions';
export { liveLedger, commitmentsPerYear, ledgerDue, qOf } from './finance/ledger';
export { chipQuote, rentQuote, spotRentalCap, CHIP_TERMS, RENT_TERMS } from './compute/orders';
export { oppositionOdds, siteCapex, siteEtaQ, siteLeasePerYear, reactiveUnblockOdds } from './compute/sites';
export { chipFit, computeForecast, computeHistory, idleChips, siteLiveQ } from './compute/forecast';
export type { ChipFit, ForecastEvent, ForecastQ } from './compute/forecast';
export { ownedOnline, rentedOnline, poolsOf } from './compute/power';
export { spotPrice, cloudPricePerYear, expectedListPrice, expectedCloudPrice, cancellablePricePerYear } from './compute/market';
export { liveCommitments, keptShare } from './actors/commitments';
export { leverageAll, leverageTier, playerLeverageByLineage, LEVERAGE_THRESHOLDS, CONTROL_DOMAINS } from './worldfx/control';
export { revenueReadout } from './worldfx/revenue';
export { techBlocker } from './worldfx/techtree';
export { canonicalKey } from './core/causes';
export { quarterIndex, dayOfQuarter, dayOfDate } from './core/time';
// End screen only (truth): the causal replay.
export { topDecisions } from './endings/replay';
export * from './core/limitsView';
// FIN2: raises with a thesis, promises, credibility, the IPO, "What we owe".
export { whatWeOwe, COVENANT_NEAR } from './finance/owe';
export type { Owe, OweCovenant, OweContingent, OweTranche } from './finance/owe';
export { promiseStatus, trendOf, makeThesis, pitchAvailable, credRung, CRED_RUNGS, PITCH, PITCHES, MILESTONES, PROMISE_RESULT, fmtMetric, describeTarget, promiseDeadline, neededBy } from './finance/promises';
export type { PromiseStatus, Trend } from './finance/promises';
export { raiseQuote, raiseTerms } from './finance/actions';
export { canIpo, isListed, valuationNow, DUAL_CLASS_GOV } from './finance/equity';
// FIN3a: board votes on major decisions (seat by seat, no dice) and the board's mood sources.
export { boardVote, founderControl, MAJOR_DECISIONS, OBLIGATION_X_REVENUE, VOTE, BC_ANCHOR, BC_REVERT_Q } from './finance/board';
export { MOOD_SOURCES, MOOD_LABEL, MOOD_WEIGHTS, MOOD_BASE, MOOD_SOURCE_OF, moodWeight, INCIDENT_BC, INCIDENT_BC_CAP_Q } from './finance/mood';
export type { MoodSource } from './finance/mood';
/** The board vote an action needs with these params (FIN3a), or undefined (never throws). */
export function actionVote(s: GameStateV2, id: string, params: Record<string, number | string | boolean> = {}): BoardVote | undefined {
  const a = REG_ACTION_BY_ID.get(id);
  if (!a?.vote) return undefined;
  try {
    return a.vote(s, params);
  } catch {
    return undefined;
  }
}
