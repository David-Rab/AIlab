// Chip orders, cloud contracts, spot rentals, supplier funding (V2-SPEC §3.8 player chip actions; research/15 §1.2).
// Owner: WS3.
import { MARKET } from '../../../data/v2/deals';
import { dayOfDate, dayOfQuarter } from '../core/time';
import type { BaselineId, ChipOrder, CloudContract, GameStateV2, Money, SystemCtx } from '../types';
import { addLedger, qOf, yearStats, bookCash } from '../finance/ledger';
import { cloudPricePerYear, spotPrice } from './market';

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

export type OrderKind = ChipOrder['kind'];

/** Price per H100e ($K) for a new order of this kind, and the cash due now ($B). */
export function orderQuote(s: GameStateV2, kind: OrderKind, qty: number, nonTW = false): { price: number; now: Money; later: Money; dueQ: number } {
  const m = s.market;
  const mult = nonTW ? MARKET.nonTWPremium : 1;
  const q = qOf(s);
  if (kind === 'spot') {
    const price = spotPrice(m) * mult;
    return { price, now: 0, later: (qty * price) / 1e6, dueQ: q + 1 };
  }
  if (kind === 'lta') {
    const price = m.listPrice * MARKET.ltaDiscount * mult;
    return { price, now: 0, later: (qty * price) / 1e6, dueQ: q + 2 };
  }
  const price = m.listPrice * mult;
  return { price, now: (0.3 * qty * price) / 1e6, later: (0.7 * qty * price) / 1e6, dueQ: q + 2 };
}

/**
 * Place a player chip order (R15 table): spot (pay on delivery, next quarter), standard (30% deposit, 2 quarters),
 * LTA (`qty` per quarter for `quarters`, 0.95 × list, take-or-pay → ledger). Returns the order.
 */
export function placeOrder(s: GameStateV2, ctx: SystemCtx, kind: OrderKind, qty: number, opts: { quarters?: number; nonTW?: boolean; prepay?: number } = {}): ChipOrder {
  const quote = orderQuote(s, kind, qty, opts.nonTW);
  const q = qOf(s);
  const n = s.player.orders.length;
  if (kind === 'lta') {
    const quarters = Math.max(4, Math.min(12, Math.round(opts.quarters ?? 8)));
    const o: ChipOrder = { id: `LTA${q}-${s.time.day}-${n}`, lab: 'player', qty, kind, price: quote.price, deposit: 0, dueQ: quote.dueQ, ltaEndQ: quote.dueQ + quarters, prepayFrac: 0, nonTW: !!opts.nonTW, delivered: 0 };
    s.player.orders.push(o);
    addLedger(s, { payee: 'Chip LTA', kind: 'lta', perQuarter: (qty * quote.price) / 1e6, endDay: dayOfQuarter(s.time.startDate, quote.dueQ + quarters), cancellableNoticeQ: null, penalty: 0 });
    ctx.log('finance', `Signed a ${quarters}-quarter chip LTA: ${(qty / 1e6).toFixed(2)}M H100e per quarter at $${quote.price.toFixed(1)}K.`);
    return o;
  }
  const prepay = kind === 'standard' ? Math.max(0.3, Math.min(1, opts.prepay ?? 0.3)) : 0;
  const deposit = (prepay * qty * quote.price) / 1e6;
  const o: ChipOrder = { id: `O${s.time.day}-${n}`, lab: 'player', qty, kind, price: quote.price, deposit, dueQ: quote.dueQ, prepayFrac: prepay, nonTW: !!opts.nonTW, delivered: 0 };
  s.player.orders.push(o);
  if (deposit > 0) {
    bookCash(s, ctx, -deposit, 'compute', 'chip deposit', `${(qty / 1e6).toFixed(2)}M H100e`);
    yearStats(s).capexChips += deposit;
  }
  return o;
}

/** Cloud / neocloud contract: take-or-pay `years`, starts next quarter, no MW needed; price 1.6 × owned TCO (× mult).
 *  Cancellable contracts cost +15% and need 1 quarter's notice [D]. Adds a ledger entry. */
export function addCloud(s: GameStateV2, ctx: SystemCtx, h100e: number, years: number, provider: string, opts: { priceMult?: number; cancellable?: boolean; startQ?: number } = {}): CloudContract {
  const cancellable = !!opts.cancellable;
  const perH = cloudPricePerYear(s) * (opts.priceMult ?? 1) * (cancellable ? 1.15 : 1); // $K / H100e-yr
  const costPerYear = (h100e * perH) / 1e6;
  const startDay = dayOfQuarter(s.time.startDate, qOf(s) + (opts.startQ ?? 1));
  const endDay = startDay + Math.round(years * 365);
  const c: CloudContract = { id: `C${s.time.day}-${s.player.cloud.length}`, provider, h100e, costPerYear, startDay, endDay, cancellableNoticeQ: cancellable ? 1 : null };
  s.player.cloud.push(c);
  addLedger(s, { id: `L-${c.id}`, payee: provider, kind: 'cloud', perQuarter: costPerYear / 4, endDay, cancellableNoticeQ: cancellable ? 1 : null, penalty: 0 });
  // Capacity financed by the provider instead of your balance sheet (test F8): equivalent owned capex.
  yearStats(s).cloudFinanced += (h100e * (s.market.listPrice * (1 + MARKET.networkShare) + 10 * s.power.kWPerH100e)) / 1e6;
  ctx.log('finance', `${provider}: ${(h100e / 1e6).toFixed(2)}M H100e for ${years} y at $${perH.toFixed(1)}K/H100e-yr${cancellable ? ' (cancellable)' : ''}.`);
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

/** Fund a supplier's packaging expansion: $1.0B per +100k H100e/q, arriving in 4 quarters, reserved for you [R15]. */
export function fundSupplier(s: GameStateV2, ctx: SystemCtx, amount: Money): number {
  const perQ = (amount / 1.0) * 1e5;
  s.market.pipe.pkg[s.market.pipe.pkg.length - 1] += perQ;
  s.player.finance.ws3.reserved.push({ perQ: perQ * 0.8, fromQ: qOf(s) + 4, toQ: qOf(s) + 12 }); // 80% reserved for 2 years [D]
  bookCash(s, ctx, -amount, 'compute', 'supplier funding', `+${(perQ / 1e3).toFixed(0)}k H100e/q packaging`);
  yearStats(s).supplierFunding += amount;
  return perQ;
}
