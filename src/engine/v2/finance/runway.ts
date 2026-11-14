// Runway and the distress state machine (V2-SPEC §3.7.6; research/15 §1.8). Owner: WS3.
import { payrollPerYear } from '../departments/staffing';
import { powerAndOMPerYear } from '../compute/power';
import type { FinanceState, GameStateV2, Money } from '../types';
import { interestPerYear } from './debt';
import { commitmentsPerYear, orderBalances } from './ledger';

/** Healthy ≥ 6q, Tight 3–6q, Distress < 3q (or covenant breach), Insolvent if cash < 0 after all options. */
export function runwayState(runwayQ: number, covenantBreach = false, cash = 1): FinanceState['state'] {
  if (cash < 0) return 'insolvent';
  if (covenantBreach || runwayQ < 3) return 'distress';
  if (runwayQ < 6) return 'tight';
  return 'healthy';
}

/** Quarters of runway at a given net quarterly burn (positive = burning). */
export function runwayQuarters(cash: number, burnPerQ: number): number {
  return burnPerQ <= 0 ? 99 : Math.max(0, Math.min(99, cash / burnPerQ));
}

/** Non-ledger operating costs $B/yr: payroll, security spend, transition fund, power & O&M, interest, spot rentals,
 *  revenue share. */
export function operatingCostsPerYear(s: GameStateV2): Money {
  const p = s.player;
  const rentals = (p.finance.ws3?.rentals ?? []).reduce((a, r) => a + (r.endDay > s.time.day ? r.perYear : 0), 0);
  const share = p.finance.deals.reduce((a, d) => a + (d.strings.revenueShare ?? 0), 0) * p.finance.revenueRun;
  return payrollPerYear(p.staff) + p.security.spendRate + p.policies.transitionFund + powerAndOMPerYear(s) + interestPerYear(s) + rentals + share;
}

/** Site capex (player share) falling due in the next 4 quarters ($B). */
export function siteCapexNext4q(s: GameStateV2): Money {
  let sum = 0;
  for (const x of s.player.sites) {
    if (x.stage !== 'building' && x.stage !== 'power' && x.stage !== 'permitting') continue;
    const left = (x.capex - x.capexPaid) * (1 - x.spvFunded);
    const qTo = Math.max(0, (x.stageEndDay - s.time.day) / 91);
    if (x.stage === 'building') sum += left * Math.min(1, 4 / Math.max(1, qTo));
    else sum += left * Math.max(0, Math.min(1, (4 - qTo) / Math.max(1, x.ws3?.buildQ ?? 8))); // building starts in qTo quarters
  }
  return sum;
}

export interface Runway { q: number; liquidity: Money; burnQ: Money; parts: Record<string, Money> }

/**
 * Runway_q = (Cash + undrawn revolver + firm tranches due in 2q) / (Burn_ex_commitments + commitments_next4q/4
 *            + chip balances and site capex due in 4q /4 − revenue/4)   (R15 §1.8).
 */
export function runwayOf(s: GameStateV2): Runway {
  const f = s.player.finance;
  const rv = f.debts.find((d) => d.kind === 'revolver');
  const frozen = f.state === 'distress' || f.state === 'insolvent'; // a committed facility survives a 'closed' rating
  const undrawn = rv && !frozen ? Math.max(0, rv.principal - rv.drawn) : 0;
  const horizon = s.time.day + 182;
  const tranches = f.tranches.reduce((a, t) => a + (t.dueDay <= horizon && !t.condition ? t.amount : 0), 0);
  const liquidity = f.cash + undrawn + tranches;
  const parts = {
    operating: operatingCostsPerYear(s) / 4,
    commitments: commitmentsPerYear(s) / 4,
    chips: orderBalances(s, 4) / 4,
    sites: siteCapexNext4q(s) / 4,
    revenue: -f.revenueRun / 4,
  };
  const burnQ = parts.operating + parts.commitments + parts.chips + parts.sites + parts.revenue;
  return { q: runwayQuarters(liquidity, burnQ), liquidity, burnQ, parts };
}
