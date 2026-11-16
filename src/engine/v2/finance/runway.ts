// Runway and the distress state machine (V2-SPEC §3.7.6; research/15 §1.8). Owner: WS3.
//
// Runway is read off a quarter-by-quarter cash projection (the rolling cash forecast a capex-heavy company runs),
// not cash ÷ net burn: that ratio explodes near break-even and smears lumpy payments over a sliding window.
// Each known payment sits in the quarter it falls due:
// - continuous: revenue at today's run rate (held flat: no uncontracted growth), payroll and operations, ledger
//   contracts between their start and end, spot rentals to their end;
// - at quarter starts (when the quarterly systems pay them): chip balances on delivery, site capex on its build
//   schedule, unconditional equity tranches, debt maturities that cannot roll.
// Runway = quarters until projected liquidity (cash + undrawn revolver) falls below a minimum operating cash of one
// month of running costs, capped at the horizon.
import { payrollOf } from '../departments/teams';
import { powerAndOMPerYear } from '../compute/power';
import { dayOfQuarter } from '../core/time';
import type { Day, FinanceState, GameStateV2, Money } from '../types';
import { interestPerYear } from './debt';
import { ledgerPaying, qOf } from './ledger';

/** Healthy ≥ 6q, Tight 3–6q, Distress < 3q (or covenant breach), Insolvent if cash < 0 after all options. */
export function runwayState(runwayQ: number, covenantBreach = false, cash = 1): FinanceState['state'] {
  if (cash < 0) return 'insolvent';
  if (covenantBreach || runwayQ < 3) return 'distress';
  if (runwayQ < 6) return 'tight';
  return 'healthy';
}

/** Projection horizon: the rest of this quarter plus 8 full quarters. Runway reads RUNWAY_CAP ("8q+") when cash
 *  lasts past it. */
export const PROJECTION_Q = 8;
export const RUNWAY_CAP = PROJECTION_Q;

/** Non-ledger running costs $B/yr held flat in the projection: payroll, security spend, transition fund, power & O&M,
 *  interest, revenue share. (Spot rentals are projected to their end.) */
export function operatingCostsPerYear(s: GameStateV2): Money {
  const p = s.player;
  const share = p.finance.deals.reduce((a, d) => a + (d.strings.revenueShare ?? 0), 0) * p.finance.revenueRun;
  return payrollOf(p) + p.security.spendRate + p.policies.transitionFund + powerAndOMPerYear(s) + interestPerYear(s) + share;
}

export type CashPart = 'revenue' | 'operating' | 'commitments' | 'chips' | 'sites' | 'funding' | 'debt';
/** A projected flow, signed (+ in, − out): a constant rate over [from, to) or a lump on `day`. */
type Flow = { part: CashPart; perDay: Money; from: Day; to: Day } | { part: CashPart; amount: Money; day: Day };

export interface CashPoint { day: Day; cash: Money; liquidity: Money }

export interface Runway {
  /** Quarters until projected liquidity < `floor`; RUNWAY_CAP if it lasts the horizon. */
  q: number;
  /** Liquidity now: cash + undrawn revolver (frozen in distress). */
  liquidity: Money;
  /** Net operating outflow per quarter (excludes funding and debt), averaged over the next 4 quarters (positive = burning). */
  burnQ: Money;
  /** The same 4-quarter average by part (positive = outflow, so revenue is negative). */
  parts: Record<CashPart, Money>;
  /** Projected cash and liquidity today, at each quarter start (before and after that quarter's lumps) and at the horizon. */
  path: CashPoint[];
  /** Lowest projected liquidity on the path. */
  low: CashPoint;
  /** Minimum operating cash: one month of running costs. */
  floor: Money;
  /** Day projected liquidity first falls below `floor`, if within the horizon. */
  zeroDay?: Day;
}

/** All known future cash flows from today, by part. */
export function cashFlows(s: GameStateV2): Flow[] {
  const f = s.player.finance;
  const day = s.time.day;
  const start = s.time.startDate;
  const q0 = qOf(s);
  const nextQ = (d: Day) => dayOfQuarter(start, Math.max(q0 + 1, qOf(s, d) + (dayOfQuarter(start, qOf(s, d)) < d ? 1 : 0)));
  const far = dayOfQuarter(start, q0 + PROJECTION_Q + 2);
  const out: Flow[] = [
    { part: 'revenue', perDay: f.revenueRun / 365, from: day, to: far },
    { part: 'operating', perDay: -operatingCostsPerYear(s) / 365, from: day, to: far },
  ];
  for (const r of f.ws3?.rentals ?? []) if (r.endDay > day) out.push({ part: 'operating', perDay: -r.perYear / 365, from: day, to: r.endDay });
  for (const c of f.ledger) if (c.endDay > day) out.push({ part: 'commitments', perDay: -c.perQuarter / 91.25, from: Math.max(day, c.startDay ?? day), to: c.endDay });
  // Chip balances are paid on delivery, at the quarterly market clearing (a past-due order clears next quarter).
  for (const o of s.player.orders) {
    if (o.kind === 'lta') continue; // LTAs pay through the ledger
    const left = Math.max(0, o.qty - o.delivered);
    const share = o.kind === 'spot' ? 1 : 1 - o.prepayFrac;
    if (left > 1) out.push({ part: 'chips', amount: -(left * o.price * share) / 1e6, day: dayOfQuarter(start, Math.max(q0 + 1, o.dueQ)) });
  }
  // Site capex: the quarterly site step pays (capex left) / (quarters left) while building, the rest at go-live.
  // A site still permitting or waiting on power is assumed to start building when that stage ends.
  for (const x of s.player.sites) {
    if (x.stage !== 'building' && x.stage !== 'power' && x.stage !== 'permitting') continue;
    const own = 1 - x.spvFunded;
    let left = x.capex - x.capexPaid;
    if (left <= 1e-6 || own <= 0) continue;
    const buildFrom = x.stage === 'building' ? 0 : nextQ(Math.max(x.stageEndDay, day + 1));
    const end = x.stage === 'building' ? x.stageEndDay : dayOfQuarter(start, qOf(s, buildFrom) + (x.ws3?.buildQ ?? 8));
    for (let k = 1; k <= PROJECTION_Q + 1 && left > 1e-6; k++) {
      const D = dayOfQuarter(start, q0 + k);
      if (D < buildFrom) continue;
      const pay = end <= D ? left : left / Math.max(1, Math.round((end - D) / 91));
      left -= pay;
      out.push({ part: 'sites', amount: -pay * own, day: D });
    }
  }
  // Unconditional tranches land at the quarterly capital step on or after their due day.
  for (const t of f.tranches) if (!t.condition) out.push({ part: 'funding', amount: t.amount, day: nextQ(Math.max(t.dueDay, day + 1)) });
  // Debt rolls at maturity while the market is open; otherwise it is repaid from cash.
  if (f.rating === 'closed' || f.state === 'distress' || f.state === 'insolvent') {
    for (const d of f.debts) if (d.drawn > 0) out.push({ part: 'debt', amount: -d.drawn, day: nextQ(Math.max(d.maturityDay, day + 1)) });
  }
  return out;
}

/** Sum of flows in [a, b), per part. */
function flowsIn(flows: Flow[], a: Day, b: Day): Record<CashPart, Money> {
  const sum: Record<CashPart, Money> = { revenue: 0, operating: 0, commitments: 0, chips: 0, sites: 0, funding: 0, debt: 0 };
  for (const x of flows) {
    if ('day' in x) { if (x.day >= a && x.day < b) sum[x.part] += x.amount; }
    else sum[x.part] += x.perDay * Math.max(0, Math.min(b, x.to) - Math.max(a, x.from));
  }
  return sum;
}
const total = (r: Record<CashPart, Money>) => Object.values(r).reduce((a, v) => a + v, 0);

/** The cash projection and runway (R15 §1.8 zones on a projected path). */
export function runwayOf(s: GameStateV2): Runway {
  const f = s.player.finance;
  const day = s.time.day;
  const q0 = qOf(s);
  const rv = f.debts.find((d) => d.kind === 'revolver');
  const frozen = f.state === 'distress' || f.state === 'insolvent'; // a committed facility survives a 'closed' rating
  const undrawn = rv && !frozen ? Math.max(0, rv.principal - rv.drawn) : 0;
  const flows = cashFlows(s);
  // Minimum operating cash: one month of running costs (operations + contracts paying now). Runway counts to this
  // floor, not to $0, so a trough that grazes zero does not flip runway between "8q+" and a few quarters.
  const floor = (operatingCostsPerYear(s) + f.ledger.reduce((a, c) => a + (ledgerPaying(c, day) ? c.perQuarter * 4 : 0), 0)) / 12;

  // Walk the windows [today, next quarter start), then 8 full quarters. Lumps fall at a window's start.
  const bounds = [day, ...Array.from({ length: PROJECTION_Q + 1 }, (_, i) => dayOfQuarter(s.time.startDate, q0 + 1 + i))];
  let cash = f.cash;
  const pt = (d: Day): CashPoint => ({ day: d, cash, liquidity: cash + undrawn });
  const path: CashPoint[] = [pt(day)];
  let zeroDay: Day | undefined;
  for (let k = 0; k < bounds.length - 1; k++) {
    const a = bounds[k];
    const b = bounds[k + 1];
    let lump = 0;
    let rate = 0;
    for (const x of flows) {
      if ('day' in x) { if (x.day >= a && x.day < b) lump += x.amount; }
      else rate += x.perDay * Math.max(0, Math.min(b, x.to) - Math.max(a, x.from));
    }
    if (lump !== 0) {
      cash += lump;
      path.push(pt(a));
      if (zeroDay === undefined && cash + undrawn < floor) zeroDay = a;
    }
    if (zeroDay === undefined && rate < 0 && cash + undrawn + rate < floor) zeroDay = a + (Math.max(0, cash + undrawn - floor) / -rate) * (b - a);
    cash += rate;
    path.push(pt(b));
  }
  const low = path.reduce((m, p) => (p.liquidity < m.liquidity ? p : m), path[0]);
  const q = zeroDay === undefined ? RUNWAY_CAP : Math.max(0, Math.min(RUNWAY_CAP, (zeroDay - day) / 91.25));

  const year = flowsIn(flows, day, day + 365);
  const parts = Object.fromEntries(Object.entries(year).map(([k, v]) => [k, -v / 4])) as Record<CashPart, Money>;
  // Burn is operating: funding tranches and debt repayment are financing, shown as their own parts.
  return { q, liquidity: f.cash + undrawn, burnQ: -(total(year) - year.funding - year.debt) / 4, parts, path, low, floor, zeroDay };
}
