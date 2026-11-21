// Buying chips and renting compute (FINANCE-V3 §5; V2-SPEC §3.8; research/15 §1.2). Owner: WS3.
//
// One way to buy chips (term × firmness) and one way to rent (term × firm/cancellable). Every price follows the
// expected market path (compute/market.ts): a firm contract pays that path × (1 − firm discount) quarter by quarter
// (one ledger entry per quarter), so it is a bet on the path, and gets priority in a shortage. Cancellable cloud is
// spot-indexed × 1.15 with a quarter's notice.
import { firmDiscount, FIRM_TERMS, MARKET } from '../../../data/v2/deals';
import { dateOf, dayOfDate, dayOfQuarter } from '../core/time';
import type { BaselineId, ChipOrder, CloudContract, GameStateV2, Money, SystemCtx } from '../types';
import { addLedger, qOf, yearStats, bookCash } from '../finance/ledger';
import { cancellablePricePerYear, expectedCloudPrice, expectedListPrice, spotPrice } from './market';
import { supplierTerms } from '../finance/story';

/** Standard order of 1.0M H100e at $23K, 30% deposit paid, delivered Q4 2025 / Q1 2026 (§3.7.2). */
export function initialOrders(baseline: BaselineId): ChipOrder[] {
  const k = baseline === 'reality' ? 0.85 : 1;
  const half = 0.5e6 * k;
  const deposit = (0.3 * half * 23e3) / 1e9;
  return [
    { id: 'O1', lab: 'player', qty: half, kind: 'standard', price: 23, deposit, dueQ: 1, prepayFrac: 0.3, nonTW: false, delivered: 0 },
    { id: 'O2', lab: 'player', qty: half, kind: 'standard', price: 23, deposit, dueQ: 2, prepayFrac: 0.3, nonTW: false, delivered: 0 },
  ];
}

/** Cloud 0.7M H100e at $13K/yr to mid-2028, non-cancellable (§3.7.2). Its payments are ledger entry L-cloud0. */
export function initialCloud(baseline: BaselineId, startDate: string): CloudContract[] {
  const k = baseline === 'reality' ? 0.85 : 1;
  const h = 0.7e6 * k;
  return [{ id: 'C1', provider: 'Northwind Cloud', h100e: h, costPerYear: (h * 13e3) / 1e9, startDay: -365, endDay: dayOfDate(startDate, '2028-07-01'), cancellableNoticeQ: null }];
}

// ───────────────────────────── Buy chips ─────────────────────────────

/** Chip terms: 0 = spot (next quarter, spot price), 1 = one batch (two quarters), 4–16 = a tranche every quarter for
 *  that many quarters (take-or-pay). */
export const CHIP_TERMS = [0, 1, 4, 8, 12, 16] as const;
export const TRANCHE_Q = { min: 4, max: 16 };

export interface ChipQuote {
  kind: ChipOrder['kind'];
  /** Price per H100e ($K): the delivery quarter's (spot: today's spot price), the first tranche's for tranches. */
  price: number;
  /** Tranche prices ($K) per quarter, on the expected path × (1 − discount). */
  prices?: number[];
  /** Cash due now (deposit; tranches: the prepaid part of the first delivery, FIN5a), $B. */
  now: Money;
  /** Balance due on delivery ($B; tranches: the first quarter's payment less what was prepaid). */
  later: Money;
  /** Share of the (first) delivery paid now: a batch's deposit (at least the supplier's terms, FIN5a), a supply
   *  contract's prepaid first delivery; 0 for spot. */
  prepay: number;
  /** Every payment over the contract ($B). */
  total: Money;
  /** Quarter index of the (first) delivery and the number of tranches. */
  dueQ: number;
  quarters: number;
  discount: number;
  firm: boolean;
}

/** Quote for buying `qty` H100e (per tranche for tranche terms) on `term` (spec §5). Single batches are priced at the
 *  expected list price at delivery; tranches at the expected path × (1 − firm discount). Non-Taiwan supply +30%.
 *  `priceMult` scales the path for a partner's supply (FIN4a): its discount for the commitment, custom chips' cost.
 *  Supplier terms follow your equity access (spec §5, FIN5a, finance/story.ts supplierTerms): a batch's deposit is at
 *  least their share (30% for a lab investors fund easily, up to 100%), and a supply contract (partner supply too)
 *  prepays their premium on its first delivery. */
export function chipQuote(s: GameStateV2, term: number, qty: number, opts: { nonTW?: boolean; prepay?: number; firm?: boolean; priceMult?: number } = {}): ChipQuote {
  const m = s.market;
  const mult = (opts.nonTW ? MARKET.nonTWPremium : 1) * (opts.priceMult ?? 1);
  const q = qOf(s);
  if (term <= 0) {
    const price = spotPrice(m) * mult;
    const later = (qty * price) / 1e6;
    return { kind: 'spot', price, now: 0, later, total: later, dueQ: q + 1, quarters: 1, discount: 0, firm: false, prepay: 0 };
  }
  if (term === 1) {
    const price = expectedListPrice(m, 2) * mult;
    const min = supplierTerms(s).batch;
    const prepay = Math.max(min, Math.min(1, opts.prepay ?? min));
    const total = (qty * price) / 1e6;
    return { kind: 'standard', price, now: prepay * total, later: (1 - prepay) * total, total, dueQ: q + 2, quarters: 1, discount: 0, firm: !!opts.firm, prepay };
  }
  const quarters = Math.max(TRANCHE_Q.min, Math.min(TRANCHE_Q.max, Math.round(term)));
  const discount = firmDiscount(quarters);
  const prices = Array.from({ length: quarters }, (_, k) => expectedListPrice(m, 2 + k) * (1 - discount) * mult);
  const prepay = supplierTerms(s).firstDelivery;
  const first = (qty * prices[0]) / 1e6;
  return { kind: 'lta', price: prices[0], prices, now: prepay * first, later: (1 - prepay) * first, total: (qty * prices.reduce((a, b) => a + b, 0)) / 1e6, dueQ: q + 2, quarters, discount, firm: true, prepay };
}

/**
 * Place a player chip order (spec §5 Buy chips): spot (pay on delivery next quarter at the spot price), one batch
 * (30–100% deposit, delivery in 2 quarters; cancellable forfeiting the deposit unless firm), or tranches (`qty` every
 * quarter, take-or-pay through the ledger at the expected path). `pay` sets how the balance due on delivery is paid
 * (spot and batches: cash, lease at `leaseRate`, or chip loan).
 */
export function placeOrder(s: GameStateV2, ctx: SystemCtx, term: number, qty: number, opts: { nonTW?: boolean; prepay?: number; firm?: boolean; pay?: ChipOrder['pay']; leaseRate?: number; priceMult?: number; payee?: string } = {}): ChipOrder {
  const qt = chipQuote(s, term, qty, opts);
  const q = qOf(s);
  const n = s.player.orders.length;
  if (qt.kind === 'lta') {
    const id = `LTA${q}-${s.time.day}-${n}`;
    const o: ChipOrder = { id, lab: 'player', qty, kind: 'lta', price: qt.price, prices: qt.prices, deposit: qt.now, dueQ: qt.dueQ, ltaStartQ: qt.dueQ, ltaEndQ: qt.dueQ + qt.quarters, prepayFrac: 0, nonTW: !!opts.nonTW, delivered: 0, firm: true };
    s.player.orders.push(o);
    // One payment per tranche, in the tranche's quarter, at that quarter's price on the path; the first less what the
    // supplier's terms made you prepay now (FIN5a).
    qt.prices!.forEach((p, k) => addLedger(s, { id: `L-${id}-${k}`, contract: id, payee: opts.payee ?? 'Chip supply', kind: 'lta', perQuarter: (qty * p) / 1e6 - (k === 0 ? qt.now : 0), startDay: dayOfQuarter(s.time.startDate, qt.dueQ + k), endDay: dayOfQuarter(s.time.startDate, qt.dueQ + k + 1), cancellableNoticeQ: null, penalty: 0 }));
    if (qt.now > 0) {
      bookCash(s, ctx, -qt.now, 'compute', 'chip deposit', `prepaid ${Math.round(qt.prepay * 100)}% of the first tranche`);
      yearStats(s).capexChips += qt.now;
    }
    const first = dateOf(s, dayOfQuarter(s.time.startDate, qt.dueQ));
    ctx.log('finance', `Signed ${qt.quarters} quarters of ${opts.payee ? `${opts.payee} ` : ''}chip supply: ${(qty / 1e6).toFixed(2)}M H100e a quarter at $${qt.prices![0].toFixed(1)}K falling to $${qt.prices![qt.quarters - 1].toFixed(1)}K (${Math.round(qt.discount * 100)}% firm discount). First tranche in Q${Math.floor(first.getUTCMonth() / 3) + 1} ${first.getUTCFullYear()}.`);
    return o;
  }
  const prepay = qt.prepay;
  const pay = opts.pay ?? 'cash';
  const o: ChipOrder = {
    id: `O${s.time.day}-${n}`, lab: 'player', qty, kind: qt.kind, price: qt.price, deposit: qt.now, dueQ: qt.dueQ, prepayFrac: prepay, nonTW: !!opts.nonTW, delivered: 0,
    ...(qt.kind === 'standard' && opts.firm ? { firm: true } : {}),
    ...(pay !== 'cash' ? { pay } : {}), ...(pay === 'lease' && opts.leaseRate !== undefined ? { leaseRate: opts.leaseRate } : {}),
  };
  s.player.orders.push(o);
  if (qt.now > 0) {
    bookCash(s, ctx, -qt.now, 'compute', 'chip deposit', `${(qty / 1e6).toFixed(2)}M H100e`);
    yearStats(s).capexChips += qt.now;
  }
  return o;
}

// ───────────────────────────── Rent compute ─────────────────────────────

/** Rent terms in quarters: 1 = a one-quarter spot rental; 4–20 = a contract starting next quarter. */
export const RENT_TERMS = [1, 4, 8, 16] as const;
export const RENT_Q_MAX = 20;

export interface RentQuote {
  /** $K per H100e-year by contract quarter (firm: expected path × (1 − discount); cancellable: today's spot-indexed). */
  perH: number[];
  /** Payment per quarter ($B) by contract quarter. */
  perQ: Money[];
  total: Money;
  discount: number;
  quarters: number;
}

/** Quote a cloud contract of `quarters` from next quarter (spec §5). `partnerDiscount`: a hyperscaler partner's cut
 *  for its take-or-pay commitment, on top of the firm discount (FIN4a, firm only). */
export function rentQuote(s: GameStateV2, h100e: number, quarters: number, firm: boolean, partnerDiscount = 0): RentQuote {
  const n = Math.max(1, Math.round(quarters)); // the Rent compute card caps its own terms at RENT_Q_MAX; a partner runs 6 years
  const discount = firm ? firmDiscount(n) : 0;
  const perH = Array.from({ length: n }, (_, k) => (firm ? expectedCloudPrice(s, 1 + k) * (1 - discount) * (1 - partnerDiscount) : cancellablePricePerYear(s)));
  const perQ = perH.map((p) => (h100e * p) / 1e6 / 4);
  return { perH, perQ, total: perQ.reduce((a, b) => a + b, 0), discount, quarters: n };
}

/**
 * Cloud contract for `quarters` starting next quarter, no MW needed. Firm: take-or-pay at the expected path × (1 −
 * firm discount), one ledger entry per quarter. Cancellable: spot-indexed × 1.15, re-priced each quarter, 1 quarter's
 * notice. `partnerDiscount`: a hyperscaler partner's cut off the firm price (FIN4a; firm only).
 */
export function addCloud(s: GameStateV2, ctx: SystemCtx, h100e: number, quarters: number, provider: string, opts: { firm?: boolean; startQ?: number; partnerDiscount?: number } = {}): CloudContract {
  const firm = opts.firm ?? true;
  const n = Math.max(1, Math.round(quarters));
  const q1 = qOf(s) + (opts.startQ ?? 1);
  const startDay = dayOfQuarter(s.time.startDate, q1);
  const endDay = dayOfQuarter(s.time.startDate, q1 + n);
  const id = `C${s.time.day}-${s.player.cloud.length}`;
  const notice = firm ? null : FIRM_TERMS.noticeQ;
  let first: Money;
  if (!firm) {
    first = (h100e * cancellablePricePerYear(s)) / 1e6 / 4;
    addLedger(s, { id: `L-${id}`, payee: provider, kind: 'cloud', perQuarter: first, startDay, endDay, cancellableNoticeQ: notice, penalty: 0 });
  } else {
    const qt = rentQuote(s, h100e, n, true, opts.partnerDiscount ?? 0);
    first = qt.perQ[0];
    qt.perQ.forEach((p, k) => addLedger(s, { id: `L-${id}-${k}`, contract: id, payee: provider, kind: 'cloud', perQuarter: p, startDay: dayOfQuarter(s.time.startDate, q1 + k), endDay: dayOfQuarter(s.time.startDate, q1 + k + 1), cancellableNoticeQ: null, penalty: 0 }));
  }
  const c: CloudContract = { id, provider, h100e, costPerYear: first * 4, startDay, endDay, cancellableNoticeQ: notice };
  s.player.cloud.push(c);
  // Capacity financed by the provider instead of your balance sheet (test F8): equivalent owned capex.
  yearStats(s).cloudFinanced += (h100e * (s.market.listPrice * (1 + MARKET.networkShare) + 10 * s.power.kWPerH100e)) / 1e6;
  ctx.log('finance', `${provider}: ${(h100e / 1e6).toFixed(2)}M H100e for ${n} quarters from $${((first * 4 * 1e6) / Math.max(1, h100e)).toFixed(1)}K/H100e-yr${firm ? '' : ' (cancellable, spot-indexed)'}.`);
  return c;
}

/** Spot rental cap: ≤ 10% of the global rental pool (15% of global stock) [R15 / D]. */
export const spotRentalCap = (s: GameStateV2) => MARKET.spotRentalPoolShare * MARKET.rentalPoolShare * s.market.ws3.stock;

/** Short-term spot rental for one quarter at r_t (paid daily as inference cloud usage). */
export function addSpotRental(s: GameStateV2, h100e: number): number {
  const used = s.player.finance.ws3.rentals.reduce((a, r) => a + (r.endDay > s.time.day ? r.h100e : 0), 0);
  const h = Math.max(0, Math.min(h100e, spotRentalCap(s) - used));
  if (h > 0) s.player.finance.ws3.rentals.push({ h100e: h, endDay: s.time.day + 91, perYear: (h * s.market.rental * 8760) / 1e9 });
  return h;
}
