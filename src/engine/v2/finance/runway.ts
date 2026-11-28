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
import { CAPEX_LEASE, DEBT_SIZING } from '../../../data/v2/deals';
import { siteLeasePerYear } from '../compute/sites';
import { crf } from './capex';
import { interestPerYear, lineUndrawn } from './debt';
import { revenueShareRate } from './ext';
import { ledgerPaying, qOf } from './ledger';
import { parentPaymentQ } from './parent';
import { ownerFunded } from './control';

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
  const share = revenueShareRate(s) * p.finance.revenueRun;
  return payrollOf(s) + p.security.spendRate + p.policies.transitionFund + powerAndOMPerYear(s) + interestPerYear(s) + share;
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
  const division = ownerFunded(s);
  const out: Flow[] = [
    // A division's revenue goes to the parent; its budget lands at each quarter start (finance/parent.ts, R9; later
    // years at the plan × today's budget factor, FIN5c). The parent's cover of an overspend at the review is not
    // projected: the projection shows the budget balance, below zero = over budget.
    { part: 'revenue', perDay: division ? 0 : f.revenueRun / 365, from: day, to: far },
    { part: 'operating', perDay: -operatingCostsPerYear(s) / 365, from: day, to: far },
  ];
  for (const r of f.ws3?.rentals ?? []) if (r.endDay > day) out.push({ part: 'operating', perDay: -r.perYear / 365, from: day, to: r.endDay });
  for (const c of f.ledger) if (c.endDay > day) out.push({ part: 'commitments', perDay: -c.perQuarter / 91.25, from: Math.max(day, c.startDay ?? day), to: c.endDay });
  // Chip balances are paid on delivery, at the quarterly market clearing (a past-due order clears next quarter).
  for (const o of s.player.orders) {
    if (o.kind === 'lta') continue; // LTAs pay through the ledger
    const left = Math.max(0, o.qty - o.delivered);
    const share = o.kind === 'spot' ? 1 : 1 - o.prepayFrac;
    if (left <= 1) continue;
    const due = dayOfQuarter(start, Math.max(q0 + 1, o.dueQ));
    const amount = (left * o.price * share) / 1e6;
    // A financing lease pays the balance for you, then you pay its lease from delivery; a chip loan lends up to 42%.
    if (o.pay === 'lease' && o.leaseRate !== undefined) out.push({ part: 'commitments', perDay: -(amount * crf(o.leaseRate, CAPEX_LEASE.years.chips)) / 365, from: due, to: due + CAPEX_LEASE.years.chips * 365 });
    else out.push({ part: 'chips', amount: -amount * (o.pay === 'loan' ? 1 - DEBT_SIZING.chipLTV * DEBT_SIZING.chipHaircut : 1), day: due });
  }
  // Site capex: the quarterly site step pays (capex left) / (quarters left) while building, the rest at go-live (a
  // campus: by its last building). A site still permitting or waiting on power is assumed to start building when that
  // stage ends; a campus with some buildings live is still building.
  for (const x of s.player.sites) {
    const days = x.ws3?.liveDays;
    const campusBuilding = x.stage === 'live' && !!days && days[days.length - 1] > day;
    if (x.stage !== 'building' && x.stage !== 'power' && x.stage !== 'permitting' && !campusBuilding) continue;
    const own = 1 - x.spvFunded;
    let left = x.capex - x.capexPaid;
    if (left <= 1e-6 || own <= 0) continue;
    const building = x.stage === 'building' || campusBuilding;
    const buildFrom = building ? 0 : nextQ(Math.max(x.stageEndDay, day + 1));
    const end = building ? (days ? days[days.length - 1] : x.stageEndDay) : dayOfQuarter(start, qOf(s, buildFrom) + (x.ws3?.buildQ ?? 8));
    // A leased site pays one lease per building, each from the day that building goes live, on what the lessor has
    // funded for it plus an equal share of what it will still fund for the buildings without a lease (DC-15). A
    // single building: one lease from go-live. A campus still permitting has no building days yet: building k at permits
    // end + max(power, construction + k) quarters, as schedule() will set them (compute/sites.ts).
    const L = x.ws3?.lease;
    if (L) {
      const n = L.byBuilding.length, open = n - L.booked;
      for (let k = L.booked; k < n; k++) {
        const from = n === 1 ? end : days ? days[k] : dayOfQuarter(start, qOf(s, buildFrom) + Math.max(x.ws3.powerQ, x.ws3.buildQ + k));
        out.push({ part: 'commitments', perDay: -siteLeasePerYear(x, L.byBuilding[k] + (left * x.spvFunded) / open) / 365, from: Math.max(day, from), to: far });
      }
    }
    for (let k = 1; k <= PROJECTION_Q + 1 && left > 1e-6; k++) {
      const D = dayOfQuarter(start, q0 + k);
      if (D < buildFrom) continue;
      const pay = end <= D ? left : left / Math.max(1, Math.round((end - D) / 91));
      left -= pay;
      out.push({ part: 'sites', amount: -pay * own, day: D });
    }
  }
  if (division) for (let k = 1; k <= PROJECTION_Q + 1; k++) out.push({ part: 'funding', amount: parentPaymentQ(s, q0 + k), day: dayOfQuarter(start, q0 + k) });
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
  // The arranged credit line counts (a committed facility survives a 'closed' rating); frozen in distress.
  const undrawn = lineUndrawn(s);
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
