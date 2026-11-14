// Finance & compute autopilot for bots (V2-SPEC §7.4 "reference compute and finance (one cloud partner, SPVs as
// needed)"; §7.2 F7/F8). Owner: WS3. WS4's refBot / capex2xBot / mixedBot call `financeAutopilot` from `act()`.
//
// The autopilot only uses the public action catalog (engine `act`), like a player would. It tracks
// `mult × refTotal(t)` online compute: chips 2–3 quarters ahead, sites ~6 quarters ahead (SPV-funded), leases and
// neocloud capacity for near-term gaps; it raises equity every quarter at the ceiling and draws the revolver when short.
import { SITE_PATHS } from '../../../data/v2/deals';
import { act } from '../core/loop';
import { dayOfQuarter } from '../core/time';
import { siteCapacityH } from '../compute/power';
import { refTotalAt } from '../compute/market';
import type { GameStateV2 } from '../types';
import { debtHeadroom } from './debt';
import { canRaise } from './equity';
import { qOf } from './ledger';
import { runwayOf } from './runway';

export interface AutopilotOpts {
  /** Multiple of the reference compute path to track (1 = RefBot, 2 = capex2x). */
  mult: number;
  /** Take one strategic hyperscaler deal (Q1 2026). */
  strategic: boolean;
  /** SPV-fund new sites; use neocloud / leases for near-term gaps. */
  offBalance: boolean;
  /** Stop new capex when runway < 4 quarters (prudent bots). */
  guard: boolean;
  /** Accept a strategic rescue in distress. */
  rescue: boolean;
  /** Start the recapitalisation (legacy preset) when E02 would fire (Q4 2025). */
  recap: boolean;
}
export const REF_AUTOPILOT: AutopilotOpts = { mult: 1, strategic: true, offBalance: true, guard: true, rescue: true, recap: true };
export const CAPEX2X_AUTOPILOT: AutopilotOpts = { mult: 2, strategic: true, offBalance: true, guard: false, rescue: false, recap: true };

/** Quarters ahead the autopilot plans site MW for [fit: F7 2026 capex]. */
export const SITE_HORIZON_Q = 9;
/** Prudent bots stop new capex below this runway (quarters) [D]. */
export const GUARD_Q = 4.25;
/** Chip orders (short-lived, resellable) use a looser guard [D]. */
export const GUARD_CHIPS_Q = 3.5;
const years = (_s: GameStateV2, day: number) => day / 365;
/** Compute target (H100e) at `dayAhead` days from now. */
const target = (s: GameStateV2, o: AutopilotOpts, dayAhead: number) => {
  // "2× capex" doubles the build-out since the start, not the day-0 fleet.
  const r0 = refTotalAt(s, 0);
  return r0 + o.mult * (refTotalAt(s, years(s, s.time.day + dayAhead)) - r0);
};
const kWAt = (s: GameStateV2, qAhead: number) => s.power.kWPerH100e * Math.pow(0.944, qAhead);

/** Cloud H100e live at a future day. */
function cloudAt(s: GameStateV2, day: number) {
  return s.player.cloud.reduce((a, c) => a + (c.startDay <= day && c.endDay > day ? c.h100e : 0), 0);
}
/** Cloud from contracts longer than ~13 months (bridge rentals excluded) live at a future day. */
function baseCloudAt(s: GameStateV2, day: number) {
  return s.player.cloud.reduce((a, c) => a + (c.startDay <= day && c.endDay > day && c.endDay - c.startDay > 400 ? c.h100e : 0), 0);
}
/** Facility MW expected live by a future day (non-blocked sites whose stage ends before it; building/live only). */
function mwBy(s: GameStateV2, day: number, includePlanned = true) {
  let mw = 0;
  for (const x of s.player.sites) {
    if (x.stage === 'blocked') continue;
    if (x.stage === 'live') mw += x.mw;
    else if (x.stage === 'building' && x.stageEndDay <= day) mw += x.mw;
    else if (includePlanned && x.stage !== 'building') {
      const eta = x.stageEndDay + (x.ws3?.buildQ ?? 8) * 91;
      if (eta <= day) mw += x.mw;
    }
  }
  return mw;
}
/** Owned chips installed + in inventory + on order. */
function ownedPipeline(s: GameStateV2) {
  const installed = s.player.sites.reduce((a, x) => a + x.installed, 0);
  const inv = s.player.finance.ws3.inventory;
  const onOrder = s.player.orders.reduce((a, o) => a + Math.max(0, o.qty - o.delivered) * (o.kind === 'lta' ? Math.max(1, (o.ltaEndQ ?? o.dueQ) - o.dueQ) : 1), 0);
  return installed + inv.ready + inv.transit + onOrder;
}

/** Owned chips installed or installable by quarter `qq` (installed + inventory + orders delivered before qq). */
function ownedBy(s: GameStateV2, qq: number) {
  const installed = s.player.sites.reduce((a, x) => a + x.installed, 0);
  const inv = s.player.finance.ws3.inventory;
  const due = s.player.orders.reduce((a, o) => a + (o.dueQ < qq ? Math.max(0, o.qty - o.delivered) : 0), 0);
  return installed + inv.ready + inv.transit + due;
}

/** Run one autopilot step (call every day before the tick; acts on the 1st of each month). */
export function financeAutopilot(s: GameStateV2, o: AutopilotOpts = REF_AUTOPILOT): void {
  if (s.time.day % 30 !== 0 && !isQuarterStart(s)) return;
  const f = s.player.finance;
  if (f.state === 'insolvent') return;
  const tryAct = (id: string, p: Record<string, number | string | boolean> = {}) => act(s, id, p) === undefined;

  // Governance: start the recapitalisation when E02 fires (Q4 2025).
  if (o.recap && s.player.board.preset === 'legacyNonprofit' && f.ws3.recap.startDay === undefined && !f.ws3.recap.refused && s.time.day >= 92) tryAct('fin.recap');

  // Distress: rescue (if allowed), otherwise sell nothing and wait.
  if (f.state === 'distress') {
    if (o.rescue) tryAct('fin.rescue');
    tryAct('fin.renegotiate');
  }

  // Equity every quarter at the ceiling.
  if (canRaise(s) === true && s.capital.ws3.playerPoolQ - s.capital.ws3.playerTakenQ > 1) tryAct('fin.raise');

  // One strategic hyperscaler deal (from Q4 2025, when the first offers arrive).
  if (o.strategic && s.time.day >= 92 && !f.deals.some((d) => d.template === 'hyperscalerEquity' && d.day >= 0)) {
    if (tryAct('fin.seekPartner', { template: 'hyperscalerEquity' })) {
      const offer = f.ws3.offers[f.ws3.offers.length - 1];
      const r = runwayOf(s);
      // Prudent bots sign only if runway stays above the chip guard after the commitment starts.
      const after = offer ? (r.liquidity + offer.equityNow) / Math.max(0.1, r.burnQ + offer.commitPerQ) : 0;
      if (offer && (!o.guard || after >= GUARD_CHIPS_Q)) tryAct('fin.acceptDeal', { offerId: offer.id });
      else if (offer) tryAct('fin.declineDeal', { offerId: offer.id });
    }
  }

  const prudent = !o.guard || runwayOf(s).q >= GUARD_Q;
  const q = qOf(s);

  // Sites (quarterly): MW for the target SITE_HORIZON_Q quarters out, as crash builds (the reference path grows
  // 3.4×/yr, faster than normal 8-quarter builds can follow). Short bridge rentals are ignored when planning.
  if (prudent && isQuarterStart(s)) {
    const qa = SITE_HORIZON_Q;
    const day = dayOfQuarter(s.time.startDate, q + qa);
    const needMW = Math.max(0, (target(s, o, day - s.time.day) - baseCloudAt(s, day)) * kWAt(s, qa)) / 1000;
    let gap = needMW - mwBy(s, day);
    let n = 0;
    while (gap > 100 && n++ < 12) {
      // Brownfield crash builds while pre-ordered transformers last, else on-site gas (Stargate pattern, R15 §1.3).
      const path = s.power.ws3.transformersGW >= Math.min(1, gap / 1000) ? 'brownfield' : 'gas';
      const mw = Math.min(SITE_PATHS[path].maxMW, Math.max(500, gap), path === 'brownfield' ? s.power.ws3.transformersGW * 1000 : Infinity);
      if (!tryAct('cmp.newSite', { path, mw, crash: true, spv: o.offBalance, community: true })) break;
      gap -= mw;
      if (o.guard && runwayOf(s).q < GUARD_Q) break;
    }
    if (s.power.ws3.transformersGW < 2) tryAct('cmp.preorderTransformers', { gw: 3 });
  }

  // Leases (≤ 2 quarters) when MW will be short.
  const day2 = dayOfQuarter(s.time.startDate, q + 2);
  const shortMW = target(s, o, day2 - s.time.day) - baseCloudAt(s, day2) - siteCapacityH(s, mwBy(s, day2, false)) / Math.pow(0.944, 2);
  if (shortMW > 0.05e6 && prudent && o.offBalance) {
    const leaseMW = Math.min(s.market.ws3.leasePoolGW * 1000, (shortMW * kWAt(s, 2)) / 1000);
    if (leaseMW >= 100) tryAct('cmp.newSite', { path: 'lease', mw: leaseMW });
  }

  // Chips: fill MW expected 3 quarters out, up to the target net of long-term cloud.
  if (!o.guard || runwayOf(s).q >= GUARD_CHIPS_Q) {
    const day3 = dayOfQuarter(s.time.startDate, q + 3);
    const capH = siteCapacityH(s, mwBy(s, day3, false)) / Math.pow(0.944, 3);
    const want = Math.min(capH, target(s, o, day3 - s.time.day) - baseCloudAt(s, day3));
    let gap = want - ownedPipeline(s);
    if (o.guard) {
      // Keep runway ≥ GUARD_CHIPS_Q: an order of $c (50% prepaid) adds 0.5c now and 0.5c/4 to quarterly burn.
      const r = runwayOf(s);
      gap = Math.min(gap, (Math.max(0, r.liquidity - GUARD_CHIPS_Q * Math.max(0, r.burnQ)) / (0.5 + 0.125 * GUARD_CHIPS_Q)) * 1e6 / s.market.listPrice);
    }
    if (gap > 0.05e6) tryAct('cmp.orderStandard', { qty: gap, prepay: 0.5 });
  }

  // Bridge: one-year cloud (or spot rental) for what owned chips and contracts will not cover next quarter.
  const day1 = dayOfQuarter(s.time.startDate, q + 1);
  const ownedNext = Math.min(siteCapacityH(s, mwBy(s, day1, false)) / 0.944, ownedBy(s, q + 1));
  const gap1 = target(s, o, day1 - s.time.day) - cloudAt(s, day1) - ownedNext;
  if (gap1 > 0.1e6 && (prudent || !o.guard)) {
    if (o.offBalance) tryAct('cmp.cloudContract', { h100e: gap1, years: 1, provider: 'Vantage Neocloud' });
    else tryAct('cmp.spotRental', { h100e: gap1 });
  }

  // Liquidity: draw the revolver when cash is under one quarter of burn.
  const r = runwayOf(s);
  if (f.cash < Math.max(2, r.burnQ) && debtHeadroom(s, 'revolver').max > 0.5) tryAct('fin.drawDebt', { kind: 'revolver', amount: Math.max(2, r.burnQ) - f.cash });
}

function isQuarterStart(s: GameStateV2) {
  return dayOfQuarter(s.time.startDate, qOf(s)) === s.time.day;
}

/** Reference revenue run-rate ($B/yr) at a day: R11 #14 / AI27 table — $12B (Jul 2025), $45B (2026), ~$157B (2027),
 *  i.e. 12 × 3.5^years (classic; reality ×13/12). Used by tests and bots until WS5's revenue model is live. */
export function refRevenueRun(s: GameStateV2, day = s.time.day): number {
  return (s.setup.baseline === 'reality' ? 13 : 12) * Math.pow(3.5, Math.min(day, 913) / 365) * Math.pow(1.8, Math.max(0, day - 913) / 365);
}
