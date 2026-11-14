// Player finance state and the commitment ledger (V2-SPEC §3.7.2, §3.7.6; research/15 §1.8). Owner: WS3.
import { dayOfDate, quarterIndex } from '../core/time';
import type { BaselineId, CashFlowKind, Commitment$, Day, FinanceState, GameStateV2, GovernancePresetId, Money, SystemCtx } from '../types';
import { valuationMark } from './equity';
import { defaultFinanceWS3, yearStats } from './ext';

/** Player finance at Jul 2025 (§3.7.2). Reality scales commitments by 0.85. */
export function initialFinance(baseline: BaselineId, governance: GovernancePresetId, startDate: string): FinanceState {
  const reality = baseline === 'reality';
  const k = reality ? 0.85 : 1;
  const revenueHistory = reality ? [4.5, 6.5, 9, 11] : [4.5, 6, 8, 10];
  const revenueRun = reality ? 13 : 12;
  const narrative = reality ? 1.2 : 1.5;
  const g = revenueRun / revenueHistory[0]; // R / R(t−4) ≈ 2.7 [D]
  const cloudEnd = dayOfDate(startDate, '2028-07-01');
  const ledger: Commitment$[] = [
    // Cloud 0.7M H100e at $13K/yr, non-cancellable to mid-2028 (§3.7.2): $2.275B per quarter.
    { id: 'L-cloud0', payee: 'Northwind Cloud', kind: 'cloud', perQuarter: 2.275 * k, endDay: cloudEnd, cancellableNoticeQ: null, penalty: 0 },
    // S1 Abilene North is colocation: 0.3 GW at ~$1.2B per GW-year (R15 lease ≈ 12%/yr of $10B/GW) [D].
    { id: 'L-lease-S1', payee: 'Colocation lease', kind: 'lease', perQuarter: (0.3 * 1.2) / 4, endDay: dayOfDate(startDate, '2029-07-01'), cancellableNoticeQ: null, penalty: 0 },
  ];
  const cash = reality ? 45 : 40;
  const f: FinanceState = {
    cash,
    revenueRun,
    revenueHistory,
    valuation: valuationMark(Math.max(g, 2.7), revenueRun, 1, narrative, 1),
    ownership: { founder: 0.3, mission: 0.26, fin: 0.17, strat: { 'Northwind Cloud': 0.27 }, public: 0 },
    raisedLast4q: 0,
    rounds: [],
    // Legacy preset: SoftBank-style $30B growth tranche conditional on the recapitalisation (cut to $10B if refused) [R15 §1.6].
    tranches: governance === 'legacyNonprofit'
      ? [{ amount: 30, dueDay: dayOfDate(startDate, '2026-01-01'), condition: 'recapitalisation', deadline: dayOfDate(startDate, '2026-12-31'), source: 'Growth round (conditional)' }]
      : [],
    debts: [{ id: 'D-revolver', kind: 'revolver', principal: 4, drawn: 0, spreadBp: 200, maturityDay: dayOfDate(startDate, '2030-07-01'), covenant: 'liquidity' }],
    ledger,
    rating: 'BB',
    runwayQ: 8,
    state: 'healthy',
    narrative,
    // The legacy Northwind stake (Microsoft-like, ~27%): observer seat, no exclusivity after the 2025 renegotiation [R15].
    deals: [{ id: 'DL-northwind0', template: 'hyperscalerEquity', partner: 'Northwind Cloud', day: -2000, strings: { observer: true, ipRights: true } }],
    ws3: defaultFinanceWS3(cash),
  };
  f.ws3.revenuePlan = revenueRun;
  f.ws3.chipBook = 0.5e6 * k * 25e-6; // 0.5M owned H100e at ~$25K (Epoch 2025 price) [R15 §2.1]
  return f;
}

/** Live ledger entries. */
export const liveLedger = (s: GameStateV2) => s.player.finance.ledger.filter((c) => c.endDay > s.time.day);

/** Quarter index (Q3 2025 = 0) of a day. */
export const qOf = (s: GameStateV2, day: Day = s.time.day) => quarterIndex(s.time.startDate, day);

/** Ledger payments falling due in quarter `quarter` (quarter index; Q3 2025 = 0). */
export function ledgerDue(s: GameStateV2, quarter: number): Money {
  const qNow = qOf(s);
  let sum = 0;
  for (const c of s.player.finance.ledger) {
    if (c.endDay <= s.time.day) continue;
    if (qOf(s, c.endDay - 1) >= quarter && quarter >= qNow) sum += c.perQuarter;
  }
  return sum;
}

/** Annualised committed payments (ledger, live entries) $B/yr. Non-cancellable only if `firmOnly`. */
export function commitmentsPerYear(s: GameStateV2, firmOnly = false): Money {
  let sum = 0;
  for (const c of s.player.finance.ledger) if (c.endDay > s.time.day && (!firmOnly || c.cancellableNoticeQ === null)) sum += c.perQuarter * 4;
  return sum;
}

/** Remaining (undiscounted) ledger payments $B — "commitments" in the finance panel and the rating PV term. */
export function commitmentsRemaining(s: GameStateV2): Money {
  let sum = 0;
  for (const c of s.player.finance.ledger) if (c.endDay > s.time.day) sum += (c.perQuarter * (c.endDay - s.time.day)) / 91.25;
  return sum;
}

/** Outstanding chip-order balances due on delivery ($B), and those due within `quarters`. */
export function orderBalances(s: GameStateV2, quarters = 99): Money {
  const qNow = qOf(s);
  let sum = 0;
  for (const o of s.player.orders) {
    if (o.kind === 'lta') continue; // LTAs pay through the ledger
    if (o.dueQ - qNow > quarters) continue;
    const left = Math.max(0, o.qty - o.delivered);
    const share = o.kind === 'spot' ? 1 : 1 - o.prepayFrac;
    sum += (left * o.price * share) / 1e6;
  }
  return sum;
}

/** Add a ledger entry (returns it). */
export function addLedger(s: GameStateV2, e: Omit<Commitment$, 'id'> & { id?: string }): Commitment$ {
  const c: Commitment$ = { id: e.id ?? `L${s.time.day}-${s.player.finance.ledger.length}`, payee: e.payee, kind: e.kind, perQuarter: e.perQuarter, endDay: e.endDay, cancellableNoticeQ: e.cancellableNoticeQ, penalty: e.penalty };
  s.player.finance.ledger.push(c);
  return c;
}

export { yearStats };

/**
 * THE finance ledger entry point: every change to player cash, from any workstream, goes through here (M2 money-flow
 * audit). Applies `amount` to cash (cause key 'cash', `source`/`detail` shown in the "why" strip) and books it under
 * `kind` in this year's YearStats.flows. Revenue (kind 'revenue', booked once by WS5) also feeds WS3's revenue tallies.
 * Returns the amount applied.
 */
export function bookCash(s: GameStateV2, ctx: SystemCtx, amount: Money, kind: CashFlowKind, source: string, detail?: string): Money {
  if (!amount || !Number.isFinite(amount)) return 0;
  const applied = ctx.bump('cash', amount, source, detail);
  const ys = yearStats(s);
  const fl = (ys.flows ??= {});
  fl[kind] = (fl[kind] ?? 0) + applied;
  if (kind === 'revenue') {
    ys.revenue += applied;
    s.player.finance.ws3.accQ.revenue += applied;
  }
  return applied;
}

/** Σ of all ledger flows over every year (the audit compares it with Δcash). */
export function totalFlows(s: GameStateV2): Partial<Record<CashFlowKind, Money>> {
  const out: Partial<Record<CashFlowKind, Money>> = {};
  for (const ys of Object.values(s.player.finance.ws3.years)) for (const [k, v] of Object.entries(ys.flows ?? {})) out[k as CashFlowKind] = (out[k as CashFlowKind] ?? 0) + (v ?? 0);
  return out;
}
