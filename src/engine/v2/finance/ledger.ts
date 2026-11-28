// Player finance state and the commitment ledger (V2-SPEC §3.7.2, §3.7.6; research/15 §1.8). Owner: WS3.
import { dateOfDay, dayOfDate, dayOfQuarter, quarterIndex } from '../core/time';
import type { CashFlowKind, Commitment$, Day, FinanceState, GameStateV2, Money, SystemCtx } from '../types';
import { defaultFinanceWS3, yearStats } from './ext';
import { LEGACY_NORTHWIND, RENT } from '../../../data/v2/deals';
import { START_CREDIBILITY } from './promises';
import { START_BY_ID } from '../../../data/v2/starts';

/** Player finance at Jul 2025 (§3.7.2): the leader start's row (data/v2/starts.ts). */
export function initialFinance(startDate: string): FinanceState {
  const { cash, revenueRun, revenueHistory, ownership: o, charter } = START_BY_ID.leader;
  const cloudEnd = dayOfDate(startDate, '2028-07-01');
  const ledger: Commitment$[] = [
    // Cloud 0.7M H100e at $13K/yr, non-cancellable to mid-2028 (§3.7.2): $2.275B per quarter.
    { id: 'L-cloud0', payee: 'Northwind Cloud', kind: 'cloud', perQuarter: 2.275, endDay: cloudEnd, cancellableNoticeQ: null, penalty: 0 },
    // S1 Abilene North is a rented hall: 0.3 GW at the rent price (DC-TASKS [D-12]).
    { id: 'L-rent-S1', payee: 'Data-centre rent', kind: 'lease', perQuarter: (0.3 * RENT.perGWYear) / 4, endDay: dayOfDate(startDate, '2029-07-01'), cancellableNoticeQ: null, penalty: 0 },
  ];
  const f: FinanceState = {
    cash,
    revenueRun,
    revenueHistory: [...revenueHistory],
    valuation: 0, // FIN5a: marked from the story split once the rivals exist (startStory in newGame)
    ownership: { founder: o.founder, mission: o.mission ?? 0, fin: o.fin, strat: { ...(o.strat ?? {}) }, public: 0 },
    credibility: START_CREDIBILITY.leader,
    promises: [],
    rounds: [],
    // A profit cap: SoftBank-style $30B growth tranche conditional on lifting it (cut to $10B if refused) [R15 §1.6].
    tranches: charter.profitCap
      ? [{ amount: 30, dueDay: dayOfDate(startDate, '2026-01-01'), condition: 'recapitalisation', deadline: dayOfDate(startDate, '2026-12-31'), source: 'Growth round (conditional)' }]
      : [],
    debts: [{ id: 'D-revolver', kind: 'revolver', principal: 4, drawn: 0, spreadBp: 200, maturityDay: dayOfDate(startDate, '2030-07-01'), covenant: 'liquidity' }],
    ledger,
    rating: 'BB',
    runwayQ: 8,
    state: 'healthy',
    // The legacy Northwind stake (Microsoft-like, ~27%), a holder from before the start: no exclusivity after the 2025
    // renegotiation [R15], no board seat (Microsoft gave up its observer seat in Jul 2024 [R21 B3]); its cloud contract is
    // L-cloud0. Above the 15% hyperscaler cap, so Northwind sells no more equity (FIN4a). C7c: its running string is a
    // share of all revenue to LEGACY_NORTHWIND.until (data/v2/deals.ts).
    deals: [{ id: 'DL-northwind0', partner: 'Northwind Cloud', kind: 'hyperscaler', day: -2000, equityNow: 0, equityLater: 0, strings: { revenueShare: LEGACY_NORTHWIND.revenueShare }, until: dayOfDate(startDate, LEGACY_NORTHWIND.until), legacy: true }],
    ws3: defaultFinanceWS3(cash),
  };
  f.ws3.chipBook = 0.5e6 * 25e-6; // 0.5M owned H100e at ~$25K (Epoch 2025 price) [R15 §2.1]
  return f;
}

/** Live ledger entries (paying now, or signed and starting later). */
export const liveLedger = (s: GameStateV2) => s.player.finance.ledger.filter((c) => c.endDay > s.time.day);

/** Is ledger entry `c` paying on `day`? */
export const ledgerPaying = (c: Commitment$, day: Day) => c.endDay > day && (c.startDay ?? -Infinity) <= day;

/** Quarter index (Q3 2025 = 0) of a day. */
export const qOf = (s: GameStateV2, day: Day = s.time.day) => quarterIndex(s.time.startDate, day);

const monthCache = new Map<string, Day[]>();
/** The three month-first days of quarter `q`: the ledger pays `perQuarter / 3` on each month's first day while an
 *  entry is paying (cashflow.ts monthly). */
export function monthFirsts(s: GameStateV2, q: number): Day[] {
  const key = `${s.time.startDate}:${q}`;
  let v = monthCache.get(key);
  if (!v) {
    const d0 = dayOfQuarter(s.time.startDate, q);
    const d = dateOfDay(s.time.startDate, d0);
    const len = (k: number) => Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k + 1, 1) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1)) / 864e5);
    v = [d0, d0 + len(0), d0 + len(0) + len(1)];
    monthCache.set(key, v);
  }
  return v;
}

/** Monthly payments (0–3) entry `c` makes in quarter `q`. */
export const monthsPaying = (s: GameStateV2, c: Commitment$, q: number) => monthFirsts(s, q).reduce((a, d) => a + (ledgerPaying(c, d) ? 1 : 0), 0);

/** Ledger payments falling due in quarter `quarter` (quarter index; Q3 2025 = 0); non-cancellable only if `firmOnly`.
 *  FIN4r: counted month by month (an entry pays a third of `perQuarter` on each month-first it is live), so an entry
 *  that starts or ends inside a quarter counts only the months it pays (it was counted in full in each quarter it
 *  touched). */
export function ledgerDue(s: GameStateV2, quarter: number, firmOnly = false): Money {
  if (quarter < qOf(s)) return 0;
  let sum = 0;
  for (const c of s.player.finance.ledger) {
    if (c.endDay <= s.time.day || (firmOnly && c.cancellableNoticeQ !== null)) continue;
    const n = monthsPaying(s, c, quarter);
    if (n > 0) sum += (c.perQuarter * n) / 3;
  }
  return sum;
}

/** Renegotiation terms (spec §8, R15: suppliers accept a 25–50% deferral for warrants) [D]: 35% of every firm
 *  contract's payments over the 4 quarters from the next quarter start, paid back at the contract's end. */
export const RENEGOTIATE = { defer: 0.35, quarters: 4, warrants: 0.02 } as const;

/** One contract's deferral: what is deferred and the quarter it is paid back in. */
export interface Deferral { contract: string; payee: string; deferred: Money; backQ: number }

/**
 * Defer `frac` of every firm contract's payments in the `quarters` quarters from the next quarter start (FIN4r, H1).
 * Each entry overlapping that window is split at the window's quarter starts (never stretched): the part before and
 * after pays as before, the part inside pays × (1 − frac). The sum deferred on a contract is added back as one firm
 * payment in the quarter after its last payment (same contract, payee and kind), so nothing is forgiven and no two
 * entries of a contract overlap. Total deferred = frac × Σ ledgerDue(q, firm) over the window. With `apply` false
 * nothing changes (the preview).
 */
export function deferFirm(s: GameStateV2, frac: number, quarters: number, apply: boolean): Deferral[] {
  const f = s.player.finance;
  const q1 = qOf(s) + 1;
  const d1 = dayOfQuarter(s.time.startDate, q1);
  const d5 = dayOfQuarter(s.time.startDate, q1 + quarters);
  const live = f.ledger.filter((c) => c.endDay > s.time.day && c.cancellableNoticeQ === null);
  const by = new Map<string, Deferral & { proto: Commitment$ }>();
  const added: Commitment$[] = [];
  for (const c of live) {
    let months = 0;
    for (let q = q1; q < q1 + quarters; q++) months += monthsPaying(s, c, q);
    const deferred = (frac * c.perQuarter * months) / 3;
    if (deferred <= 0) continue;
    if (apply) {
      // Tally what is deferred out of each year it would have been paid in (F7 reads costs incurred, not cash).
      for (let q = q1; q < q1 + quarters; q++) {
        const n = monthsPaying(s, c, q);
        if (!n) continue;
        const ys = yearStats(s, dayOfQuarter(s.time.startDate, q));
        const x = (frac * c.perQuarter * n) / 3;
        if (c.kind === 'lta') ys.deferredChips = (ys.deferredChips ?? 0) + x;
        else ys.deferredCompute = (ys.deferredCompute ?? 0) + x;
      }
    }
    const key = c.contract ?? c.id;
    const d = by.get(key) ?? { contract: key, payee: c.payee, deferred: 0, backQ: 0, proto: c };
    d.deferred += deferred;
    by.set(key, d);
    if (!apply) continue;
    const start = c.startDay ?? -Infinity;
    if (start < d1) added.push({ ...c, id: `${c.id}-a${s.time.day}`, endDay: d1, contract: key });
    if (c.endDay > d5) added.push({ ...c, id: `${c.id}-c${s.time.day}`, startDay: d5, contract: key });
    c.contract = key;
    c.startDay = Math.max(start, d1);
    c.endDay = Math.min(c.endDay, d5);
    c.perQuarter *= 1 - frac;
  }
  for (const d of by.values()) {
    // Paid back in the quarter after the contract's last payment.
    const end = Math.max(...live.filter((c) => (c.contract ?? c.id) === d.contract).map((c) => c.endDay), ...added.filter((c) => c.contract === d.contract).map((c) => c.endDay));
    d.backQ = qOf(s, end - 1) + 1;
    if (apply) {
      const p = d.proto;
      added.push({ id: `${d.contract}-deferred${s.time.day}`, contract: d.contract, payee: p.payee, kind: p.kind, perQuarter: d.deferred, startDay: dayOfQuarter(s.time.startDate, d.backQ), endDay: dayOfQuarter(s.time.startDate, d.backQ + 1), cancellableNoticeQ: null, penalty: 0, ...(p.rate !== undefined ? { rate: p.rate } : {}) });
    }
  }
  if (apply) f.ledger.push(...added);
  return [...by.values()].map(({ proto: _p, ...d }) => d);
}

/** Committed payments falling due over the next four quarters (this one included), $B/yr. Non-cancellable only if
 *  `firmOnly`. (Firm contracts priced on the expected path pay one ledger entry per quarter, so this sums the
 *  schedule, not the entries.) */
export function commitmentsPerYear(s: GameStateV2, firmOnly = false): Money {
  const q0 = qOf(s);
  let sum = 0;
  for (let k = 0; k < 4; k++) sum += ledgerDue(s, q0 + k, firmOnly);
  return sum;
}

/** Remaining (undiscounted) ledger payments $B — "commitments" in the finance panel and the rating PV term (firm only
 *  if `firmOnly`). */
export function commitmentsRemaining(s: GameStateV2, firmOnly = false): Money {
  let sum = 0;
  for (const c of s.player.finance.ledger) if (c.endDay > s.time.day && (!firmOnly || c.cancellableNoticeQ === null)) sum += (c.perQuarter * Math.max(0, c.endDay - Math.max(s.time.day, c.startDay ?? -Infinity))) / 91.25;
  return sum;
}

/** Record a payment to `payee` ($B): the running tally partner tranche conditions count (entries leave the ledger as they
 *  end, so the tally is kept as they pay). */
export function notePaid(s: GameStateV2, payee: string, amount: Money): void {
  const w = s.player.finance.ws3;
  const m = (w.paidTo ??= {});
  m[payee] = (m[payee] ?? 0) + amount;
}
/** Everything paid to `payee` so far ($B). */
export const paidTo = (s: GameStateV2, payee: string): Money => s.player.finance.ws3.paidTo?.[payee] ?? 0;

/** Add a ledger entry (returns it). */
export function addLedger(s: GameStateV2, e: Omit<Commitment$, 'id'> & { id?: string }): Commitment$ {
  const c: Commitment$ = { id: e.id ?? `L${s.time.day}-${s.player.finance.ledger.length}`, payee: e.payee, kind: e.kind, perQuarter: e.perQuarter, ...(e.startDay !== undefined ? { startDay: e.startDay } : {}), endDay: e.endDay, cancellableNoticeQ: e.cancellableNoticeQ, penalty: e.penalty, ...(e.contract ? { contract: e.contract } : {}), ...(e.rate !== undefined ? { rate: e.rate } : {}) };
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
