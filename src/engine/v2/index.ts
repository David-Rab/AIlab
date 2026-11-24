// Public entry point of the v2 engine: the EngineApi object plus selectors. UI (WS6/WS7) and bots import from here.
import type { EngineApi } from './types';
import { newGame } from './core/init';
import { act, resolve, tick } from './core/loop';
import { leadDays, production, raiseCeiling, riskSources, sightLimit } from './core/selectors';

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
  sightLimit,
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
import type { ActionDef, BoardVote, CostLine, EventDefV2, GameStateV2, ModelVersion, DomainId, TrainingRun } from './types';
import { ACTIONS as REG_ACTIONS, ACTION_BY_ID as REG_ACTION_BY_ID, EVENTS as REG_EVENTS, EVENT_BY_ID as REG_EVENT_BY_ID } from './core/registry';
import { forecastBand, planRun as planRunUI, runForecast, type LaunchRunParams as LaunchRunParamsUI } from './models/runs';
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
export function choiceView(s: GameStateV2, eventId: string, choice: number, data?: Record<string, number | string>): Omit<ActionView, 'id'> {
  const c = REG_EVENT_BY_ID.get(eventId)?.choices[choice];
  if (!c) return { title: '?', ok: 'unknown', costs: [], gains: [], exposure: [] };
  let ok: true | string = true;
  try {
    const r = c.available?.(s, data) ?? true;
    ok = r === true ? true : typeof r === 'string' ? r : 'Unavailable';
  } catch {
    ok = 'Unavailable';
  }
  try {
    return { title: c.label, ok, ...c.preview(s, data) };
  } catch {
    return { title: c.label, ok, costs: [], gains: [], exposure: [] };
  }
}

/** The board vote a decision choice needs (FIN3c: a merger), shown under the choice; undefined when it needs none. */
export function choiceVote(s: GameStateV2, eventId: string, choice: number, data?: Record<string, number | string>): BoardVote | undefined {
  const c = REG_EVENT_BY_ID.get(eventId)?.choices[choice];
  if (!c?.vote) return undefined;
  try {
    return c.vote(s, data);
  } catch {
    return undefined;
  }
}

/** Run card for the run designer under UI-safe names. RD-B19 (B45): band and domains are the lab's forecast (runForecast:
 *  UB-2b: the planned run on the believed recipe and the start model's measured build, its 90% range), never the engine's true outcome;
 *  [0, 0] when nothing is measured yet. */
export function runCard(s: GameStateV2, p: LaunchRunParamsUI) {
  const plan = planRunUI(s, p);
  const pr = plan.prediction;
  const fc = runForecast(s, p);
  return {
    fpt: pr.fpt,
    band: fc?.band ?? [0, 0] as [number, number], domains: fc?.domains ?? ({} as typeof pr.domains), forecastRef: fc?.refName, forecastSd: fc?.sd ?? 0, signals: pr.signals, etaDays: plan.etaDays, monitorability: pr.monitorability,
    flop: plan.flopNeeded, cash: plan.cashCost, poolShare: plan.poolShare, reason: plan.reason, g: plan.g,
    effShare: plan.effShare, setupTW: plan.setupTW, setupDays: plan.setupDays, limits: plan.limits,
  };
}

/** Forecast band of a launched run (run queue; UB-2b: the lab's forecast frozen at launch, runForecast, its 90% range; [0, 0] when
 *  nothing was measured then or the run predates it). */
export const runBand = (_s: GameStateV2, r: Pick<TrainingRun, 'forecast'>): [number, number] => (r.forecast ? forecastBand(r.forecast.mid, r.forecast.sd) : [0, 0]);

/** Measured domain levels of a version (what the player's evals show). UB-2: only the domains with a benchmark fit
 *  (the old fallback for a version not measured yet read its true domain offset): a missing domain is "not measured yet". */
export function measuredDomains(v: ModelVersion): Partial<Record<DomainId, number>> {
  const out: Partial<Record<DomainId, number>> = {};
  for (const d of DOMAIN_IDS) { const fit = v.evals.measuredDom?.[d]; if (fit !== undefined) out[d] = fit; }
  return out;
}

export { runwayOf, RUNWAY_CAP } from './finance/runway';
export { parentSchedule, parentPaymentQ, divisionView, budgetFactor, budgetYearStart, DIVISION, DIVISION_REASON } from './finance/parent';
export type { DivisionView, ParentPayment } from './finance/parent';
export { debtHeadroom, totalDebt, interestPerYear, debtRatePct, newDebtRatePct, ratingTerms, creditLineCapacity, chipCollateral, trailingOpCash, lineUndrawn } from './finance/debt';
export type { Headroom, RatingTerms } from './finance/debt';
export { payOptions, leaseRate, leaseAvailable, leaseGuarantor, contingentLiabilities, siteRVG, leaseBalance } from './finance/capex';
export type { PayOption } from './finance/capex';
export { conditionWords, dealPreview } from './finance/actions';
export { affiliatedLab, anchorPartners, dealWith, partnerBlocker, partnerCosts, partnerOffers, partnersNow, partnerTerms, rescuePartner, SUPPLY_LABEL, supplyOptions, termsEquity } from './finance/deals';
export type { PartnerChoice } from './finance/deals';
export { leadEstimate } from './finance/observe';
export { liveLedger, commitmentsPerYear, ledgerDue, qOf } from './finance/ledger';
export { chipQuote, rentQuote, spotRentalCap, CHIP_TERMS, RENT_TERMS } from './compute/orders';
export { oppositionOdds, siteCapex, siteEtaQ, siteLeasePerYear, siteSchedule, reactiveUnblockOdds } from './compute/sites';
export { chipFit, computeForecast, computeHistory, idleChips, siteLiveQ } from './compute/forecast';
export type { ChipFit, ForecastEvent, ForecastQ } from './compute/forecast';
export { ownedOnline, rentedOnline, poolsOf } from './compute/power';
export { spotPrice, cloudPricePerYear, expectedListPrice, expectedCloudPrice, cancellablePricePerYear } from './compute/market';
export { liveCommitments, keptShare } from './actors/commitments';
export { leverageAll, leverageTier, LEVERAGE_THRESHOLDS, CONTROL_DOMAINS } from './worldfx/control';
export { revenueReadout } from './worldfx/revenue';
export { techBlocker, techBlockerAtLevels, techGateLevels } from './worldfx/techtree';
export { canonicalKey } from './core/causes';
export { quarterIndex, dayOfQuarter, dayOfDate } from './core/time';
// End screen only (truth): the causal replay.
export { topDecisions } from './endings/replay';
export * from './core/limitsView';
export * from './models/rdReadouts';
export * from './safety/safetyReadouts';
export * from './safety/readoutsModel';
export * from './safety/readoutsInstruments';
export * from './safety/readoutsSafeguards';
export * from './safety/readoutsIncidents';
export * from './core/certainty';
export { sightCurve } from './safety/sightLimit';
// Model v3 D5: RL environment suites (readout and costs).
export { suitesView, suiteWorkCost, suiteWorkEffect, familyDomain, demosAvailable, type SuiteRow } from './models/suites';
// Model v3 D6: the suites view (Models › Suites): previews of suite work on a planned post-train (output only).
export { suitePlanEffect, suiteS2Parts, suiteWorkPreview, suitePending, lockedSuiteFamilies, unbuiltSuites, exploitFloor, type SuitePlanEffect, type SuiteWorkPreview } from './models/suitesPreview';
// Model v3 D4: the data view (Models › Data) and the Blueprint's drawn-mix row (output-only selectors).
export {
  dataPortfolioView, drawByDomain, licenceForm, mixTargetOf, naturalMixView, synForm, teacherRows, usageLevels,
  type DataPortfolioView, type DomainMixRow, type DrawDomainRow, type LicenceForm, type PendingView, type SynForm, type TeacherRow, type UsageLevelRow,
} from './production/dataView';
export { REF_SHARE, type DataDelta, type DataDraw, type KindRow } from './production/data';
// FIN2: raises with a thesis, promises, credibility, the IPO, "What we owe".
export { whatWeOwe, COVENANT_NEAR } from './finance/owe';
export type { Owe, OweCovenant, OweContingent, OweTranche } from './finance/owe';
export { promiseStatus, trendOf, makeThesis, pitchAvailable, credRung, CRED_RUNGS, PITCH, PITCHES, MILESTONES, PROMISE_RESULT, fmtMetric, describeTarget, promiseDeadline, neededBy } from './finance/promises';
export type { PromiseStatus, Trend } from './finance/promises';
export { raiseQuote, raiseTerms } from './finance/actions';
export { canIpo, isListed, LARGE_ROUND, roundSplit } from './finance/equity';
// FIN5a: the story (sector value × share), the investor pool and supplier terms.
export { storyNow, sectorValue, STORY, SUPPLIER, DRIVERS, DUAL_CLASS_GOV, supplierTerms, poolAnnualOf } from './finance/story';
export type { StoryNow, LabStory, SectorValue, Driver, SupplierTerms } from './finance/story';
export { RIVAL, RIVAL_GOV, capMultiple, valueCap } from './finance/rivalFinance';
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
