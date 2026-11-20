// Finance & compute autopilot for bots (V2-SPEC §7.4 "reference compute and finance (one cloud partner, leases as
// needed)"; §7.2 F7/F8). Owner: WS3. WS4's refBot / capex2xBot / mixedBot call `financeAutopilot` from `act()`.
//
// The autopilot only uses the public action catalog (engine `act`), like a player would. It tracks
// `mult × refTotal(t)` online compute: chips 2–3 quarters ahead, sites ~6 quarters ahead (leased while a lessor will
// fund them, FIN1), colocation and one-year neocloud capacity for near-term gaps; it raises equity when its cash
// projection runs short, on the milestone it is surest to hit (FIN2), and borrows on the credit line when short.
import { SITE_PATHS } from '../../../data/v2/deals';
import { isDivision } from '../../../data/v2/starts';
import { act } from '../core/loop';
import { dayOfQuarter } from '../core/time';
import { siteCapacityH } from '../compute/power';
import { cloudPricePerYear, refTotalAt } from '../compute/market';
import type { GameStateV2 } from '../types';
import { BC_WARN, criticsAvailable, criticsOusterShift } from './board';
import { leaseRate } from './capex';
import { debtHeadroom } from './debt';
import { canRaise, DOWN_ROUND_RUNWAY_Q, lastPostMoney, raiseCeiling } from './equity';
import { qOf } from './ledger';
import { MILESTONES, PITCH, promiseDeadline, trendOf } from './promises';
import { runwayOf } from './runway';
import type { MilestoneType, Pitch } from '../types';

export interface AutopilotOpts {
  /** Multiple of the reference compute path to track (1 = RefBot, 2 = capex2x). */
  mult: number;
  /** Take one strategic hyperscaler deal (Q1 2026). */
  strategic: boolean;
  /** Lease new sites (financing lease, while the rating allows); use colocation and neocloud rentals for near-term
   *  gaps. */
  offBalance: boolean;
  /** Stop new capex when runway < 4 quarters (prudent bots). */
  guard: boolean;
  /** Accept a strategic rescue in distress. */
  rescue: boolean;
  /** Start the recapitalisation (legacy preset) when E02 would fire (Q4 2025). */
  recap: boolean;
  /** Runway guard (quarters) for new sites when `guard` is on (default GUARD_Q); chips use guardQ − 1 (FIN1). */
  guardQ?: number;
  /** Raise equity only while runway is below this many quarters (default RAISE_BELOW_Q). */
  raiseBelowQ?: number;
  /** Runway floor (quarters) the one-year bridge rental may not push below (default BRIDGE_FLOOR_Q). */
  bridgeFloorQ?: number;
  /** Fraction of the target path to track (follower starts, R9; default 1). */
  scale?: number;
}

/** Follower starts (R9: spinout, challenger, big-tech division): start from their own compute, aim to close on the
 *  reference path over FOLLOWER_RAMP_D days, and keep two more quarters of runway than the leader-start policy (a
 *  smaller company cannot carry the leader's commitments). The leader start's options are unchanged. */
export const FOLLOWER_RAMP_D = 730;
export function followerOpts(s: GameStateV2, o: AutopilotOpts): AutopilotOpts {
  if ((s.setup.start ?? 'leader') === 'leader') return o;
  const r0 = refTotalAt(s, 0);
  const own0 = Number(s.flags['plan:own0'] ?? (s.flags['plan:own0'] = s.player.computeOnline));
  const phi0 = Math.min(1, own0 / Math.max(1, r0));
  const scale = phi0 + (1 - phi0) * Math.min(1, s.time.day / FOLLOWER_RAMP_D);
  return { ...o, scale, guardQ: (o.guardQ ?? GUARD_Q) + 2, bridgeFloorQ: (o.bridgeFloorQ ?? BRIDGE_FLOOR_Q) + 2 };
}
export const REF_AUTOPILOT: AutopilotOpts = { mult: 1, strategic: true, offBalance: true, guard: true, rescue: true, recap: true };
export const CAPEX2X_AUTOPILOT: AutopilotOpts = { mult: 2, strategic: true, offBalance: true, guard: false, rescue: false, recap: true };
/** Race-only bot (§7.4 "2× reference capex"): doubles the build-out but manages capital like a CEO who wants to keep
 *  the company — a thin 3-quarter guard and rescue capital when cornered [D, M4]. */
export const RACE_AUTOPILOT: AutopilotOpts = { mult: 2, strategic: true, offBalance: true, guard: true, rescue: true, recap: true, guardQ: 3 };

/** Quarters ahead the autopilot plans site MW for [fit: F7 2026 capex]. */
export const SITE_HORIZON_Q = 9;
/** Prudent bots stop new sites below this runway (quarters) [D]; 4.0 → 4.5 in FIN1 (path-priced chips and cloud left
 *  the reference bot at the 3-quarter distress edge). */
export const GUARD_Q = 4.5;
/** Guarded bots never let a one-year bridge rental take runway below this (quarters) [D, M4]. */
export const BRIDGE_FLOOR_Q = 1.5;
/** Prudent bots sign the strategic deal if runway after it stays above this (quarters) [D, M4]. */
export const DEAL_GUARD_Q = 2.0;
/** Chip orders (short-lived, resellable) use a looser guard [D]. */
export const GUARD_CHIPS_Q = 3.5;
/** FIN2 raise policy [D]: raise only when the cash projection shows less than RAISE_BELOW_Q quarters (a quarter before
 *  the board's "tight" line at 6), then at the ceiling (sizing rounds to the projected hole left the bot short when it
 *  committed the next site: the projection holds revenue flat and knows no future capex). Before FIN2 the bot raised
 *  every quarter at the ceiling. */
export const RAISE_BELOW_Q = 7;
/** The bot pitches a milestone only if its own forecast clears the pitch's target by this margin [D]. */
export const PITCH_SAFETY = 1.1;
const years = (_s: GameStateV2, day: number) => day / 365;
/** Compute target (H100e) at `dayAhead` days from now. */
const target = (s: GameStateV2, o: AutopilotOpts, dayAhead: number) => {
  // "2× capex" doubles the build-out since the start, not the day-0 fleet.
  const r0 = refTotalAt(s, 0);
  return (o.scale ?? 1) * (r0 + o.mult * (refTotalAt(s, years(s, s.time.day + dayAhead)) - r0));
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
export function financeAutopilot(s: GameStateV2, o0: AutopilotOpts = REF_AUTOPILOT): void {
  const o = followerOpts(s, o0);
  const f = s.player.finance;
  const tryAct = (id: string, p: Record<string, number | string | boolean> = {}) => act(s, id, p) === undefined;
  // A round repriced into a down round (decided at once, whatever the day): a competent CEO takes it only when the
  // company needs the cash (runway under DOWN_ROUND_RUNWAY_Q), otherwise pulls it (the pre-R1 automatic rule, M4).
  if (f.ws3?.repricedRound && f.state !== 'insolvent') tryAct(runwayOf(s).q < DOWN_ROUND_RUNWAY_Q ? 'fin.acceptRepriced' : 'fin.pullRepriced');
  if (s.time.day % 30 !== 0 && !isQuarterStart(s)) return;
  if (f.state === 'insolvent') return;

  // Governance: start the recapitalisation when it becomes available (Q4 2025).
  if (o.recap && s.player.board.preset === 'legacyNonprofit' && f.ws3.recap.startDay === undefined && !f.ws3.recap.refused && s.time.day >= 92) tryAct('fin.recap');

  // Board (FIN3b, spec §7.5): below the board's warning line (35), give the critics a seat when it is available (once a
  // year) and it leaves more room above the ouster vote's passing line than before: +15 now, but the new director votes
  // the board's grievance for good (the preview shows both). (Replaces the E37 answers.)
  if (s.player.board.confidence < BC_WARN && criticsAvailable(s) === true) {
    const o = criticsOusterShift(s);
    if (o.marginAfter > o.marginBefore) tryAct('fin.critics');
  }

  // Distress (a competent CEO, M4): renegotiate first (warrants, once a year); if runway is still under 2 quarters,
  // a strategic rescue when allowed and it would not hand the partner control, else a down round.
  if (f.state === 'distress' || (f.state === 'tight' && runwayOf(s).q < 3.5)) {
    tryAct('fin.renegotiate');
    if (f.state === 'distress' && runwayOf(s).q < 2) {
      if (!(o.rescue && rescueKeepsControl(s) && tryAct('fin.rescue')) && !recentDownRound(s)) tryAct('fin.downRound');
    }
  }

  // Last resort before insolvency: sell owned chips to cover a quarter's shortfall (a CEO who keeps the company).
  // (A division cannot go broke: it never sells its compute, R9.)
  if (f.state === 'distress' && !isDivision(s) && f.cash < Math.max(1, 0.5 * runwayOf(s).burnQ)) {
    const perH = (s.market.rental * 8760 * 1.5) / 1e9; // fin.sellChips resale value per H100e ($B)
    const need = Math.max(1, runwayOf(s).burnQ) - f.cash;
    if (perH > 0 && need > 0) tryAct('fin.sellChips', { qty: Math.max(1e4, need / perH) });
  }

  // Equity when the cash projection runs short (FIN2), unless the mark is below the last round's post-money (a down
  // round) and runway does not force it; at the ceiling, on the milestone the CEO is surest to hit.
  const downMark = f.valuation < lastPostMoney(s);
  const rw0 = runwayOf(s);
  if (canRaise(s) === true && s.capital.ws3.playerPoolQ - s.capital.ws3.playerTakenQ > 1 && (!downMark || rw0.q < 4) && rw0.q < (o.raiseBelowQ ?? RAISE_BELOW_Q)) {
    const th = pickThesis(s, o);
    const ask = Math.floor(raiseCeiling(s, Number.POSITIVE_INFINITY, { priceMult: PITCH[th.pitch].price }).max * 10) / 10;
    if (ask >= 1) tryAct('fin.raise', { ask, type: th.type, pitch: th.pitch });
  }

  // One strategic hyperscaler deal (from Q4 2025, when the first offers arrive).
  if (o.strategic && s.time.day >= 92 && !f.deals.some((d) => d.template === 'hyperscalerEquity' && d.day >= 0)) {
    if (tryAct('fin.seekPartner', { template: 'hyperscalerEquity' })) {
      const offer = f.ws3.offers[f.ws3.offers.length - 1];
      const r = runwayOf(s);
      // Prudent bots sign only if runway stays above the chip guard after the commitment starts.
      const after = offer ? (r.liquidity + offer.equityNow) / Math.max(0.1, r.burnQ + offer.commitPerQ) : 0;
      // The partner's cloud capacity replaces compute the autopilot would otherwise buy, so the guard is looser here.
      if (offer && (!o.guard || after >= DEAL_GUARD_Q)) tryAct('fin.acceptDeal', { offerId: offer.id });
      else if (offer) tryAct('fin.declineDeal', { offerId: offer.id });
    }
  }

  const guardQ = o.guardQ ?? GUARD_Q;
  const guardChipsQ = guardQ - (GUARD_Q - GUARD_CHIPS_Q);
  const prudent = !o.guard || runwayOf(s).q >= guardQ;
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
      if (!tryAct('cmp.newSite', { path, mw, crash: true, pay: o.offBalance && leaseRate(s) !== undefined ? 'lease' : 'cash', community: true })) break;
      gap -= mw;
      if (o.guard && runwayOf(s).q < guardQ) break;
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
  if (!o.guard || runwayOf(s).q >= guardChipsQ) {
    const day3 = dayOfQuarter(s.time.startDate, q + 3);
    const capH = siteCapacityH(s, mwBy(s, day3, false)) / Math.pow(0.944, 3);
    const want = Math.min(capH, target(s, o, day3 - s.time.day) - baseCloudAt(s, day3));
    let gap = want - ownedPipeline(s);
    if (o.guard) {
      // Keep runway ≥ guardChipsQ: an order of $c (50% prepaid) adds 0.5c now and 0.5c/4 to quarterly burn.
      const r = runwayOf(s);
      gap = Math.min(gap, (Math.max(0, r.liquidity - guardChipsQ * Math.max(0, r.burnQ)) / (0.5 + 0.125 * guardChipsQ)) * 1e6 / s.market.listPrice);
    }
    if (gap > 0.05e6) tryAct('cmp.buyChips', { term: 1, qty: gap, prepay: 0.5 });
  }

  // Bridge: one-year cloud (or spot rental) for what owned chips and contracts will not cover next quarter.
  const day1 = dayOfQuarter(s.time.startDate, q + 1);
  const ownedNext = Math.min(siteCapacityH(s, mwBy(s, day1, false)) / 0.944, ownedBy(s, q + 1));
  let gap1 = target(s, o, day1 - s.time.day) - cloudAt(s, day1) - ownedNext;
  if (o.guard && gap1 > 0) {
    // Size the rental so runway stays ≥ bridgeFloorQ (M4: an unbounded bridge once signed $75B/yr of cloud).
    const r = runwayOf(s);
    const perQ = Math.max(0, r.liquidity / (o.bridgeFloorQ ?? BRIDGE_FLOOR_Q) - Math.max(0, r.burnQ));
    gap1 = Math.min(gap1, (perQ * 4 * 1e6) / Math.max(1, cloudPricePerYear(s)));
  }
  if (gap1 > 0.1e6 && (prudent || !o.guard)) {
    if (o.offBalance) tryAct('cmp.rentCompute', { h100e: gap1, term: 4, firm: true });
    else tryAct('cmp.rentCompute', { h100e: gap1, term: 1 });
  }

  // Liquidity: draw the revolver when cash is under one quarter of burn.
  const r = runwayOf(s);
  if (f.cash < Math.max(2, r.burnQ) && debtHeadroom(s, 'revolver').max > 0.5) tryAct('fin.drawDebt', { kind: 'revolver', amount: Math.max(2, r.burnQ) - f.cash });
}

/**
 * The milestone and pitch a sensible CEO raises on (FIN2): its own forecast at the deadline against each pitch's target
 * — scale from its compute plan (what it is building toward), adoption from the reference revenue path's growth
 * (consensus), capability at half its trend (releases are lumpy and unknowable). It never pitches aggressive: a round
 * priced 20% over the mark sets a bar the next round must clear or be a down round. A conservative pitch that would
 * price a down round is skipped. Base wins if it is sure of it, else conservative; if neither clears, base on its best
 * margin.
 */
export function pickThesis(s: GameStateV2, o: AutopilotOpts): { type: MilestoneType; pitch: Pitch } {
  const close = dayOfQuarter(s.time.startDate, qOf(s) + 1);
  const ahead = promiseDeadline(s, close) - s.time.day;
  const last = lastPostMoney(s);
  let best: { type: MilestoneType; pitch: Pitch; price: number; margin: number } | undefined;
  let fallback: { type: MilestoneType; margin: number } | undefined;
  for (const type of MILESTONES) {
    const tr = trendOf(s, type);
    if (tr.blocked || tr.gain <= 0) continue;
    const fc = type === 'scale' ? 0.95 * target(s, o, ahead)
      : type === 'adoption' ? tr.now * (0.9 * refRevenueRun(s, s.time.day + ahead)) / Math.max(0.1, refRevenueRun(s))
      : tr.now + 0.5 * tr.gain;
    const margin = (fc - tr.now) / tr.gain;
    if (!fallback || margin > fallback.margin) fallback = { type, margin };
    for (const pitch of ['base', 'conservative'] as const) {
      if (pitch === 'conservative' && last > 0 && s.player.finance.valuation * PITCH.conservative.price < last) continue;
      if (margin < PITCH[pitch].gain * PITCH_SAFETY) continue;
      const price = PITCH[pitch].price;
      if (!best || price > best.price || (price === best.price && margin > best.margin)) best = { type, pitch, price, margin };
      break;
    }
  }
  return best ? { type: best.type, pitch: best.pitch } : { type: fallback?.type ?? 'scale', pitch: 'base' };
}

/** A down round in the last 180 days (one per distress spell). */
const recentDownRound = (s: GameStateV2) => s.player.finance.rounds.some((r) => r.down && r.day > s.time.day - 180);

/** A rescue tops the partner up to DEAL_TERMS.rescue.stake plus the cash stake; keep the largest strategic holder at
 *  or below 45% so the company is not sold by accident. */
function rescueKeepsControl(s: GameStateV2): boolean {
  const strat = s.player.finance.ownership.strat;
  return Math.max(0, ...Object.values(strat)) + 0.1 <= 0.45;
}

function isQuarterStart(s: GameStateV2) {
  return dayOfQuarter(s.time.startDate, qOf(s)) === s.time.day;
}

/** Reference revenue run-rate ($B/yr) at a day: R11 #14 / AI27 table — $12B (Jul 2025), $45B (2026), ~$157B (2027),
 *  i.e. 12 × 3.5^years (classic; reality ×13/12). Used by tests and bots until WS5's revenue model is live. */
export function refRevenueRun(s: GameStateV2, day = s.time.day): number {
  return (s.setup.baseline === 'reality' ? 13 : 12) * Math.pow(3.5, Math.min(day, 913) / 365) * Math.pow(1.8, Math.max(0, day - 913) / 365);
}
