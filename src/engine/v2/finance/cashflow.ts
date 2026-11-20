// Daily accruals and monthly payments (V2-SPEC §3.7.6; research/15 §1.8). Owner: WS3.
//
// Cash semantics (WS3 owns the cash ledger, `bookCash` in ledger.ts; every cash change goes through it): revenue is
// booked ONCE by WS5's revenue system (kind 'revenue'); WS3 derives the run-rate from deployment.revenueRate via
// `revenueOf` and never books revenue itself. WS3 pays everything else that recurs: power & O&M, spot rentals, interest
// (daily); payroll, security spend, transition fund, revenue share and ledger instalments (monthly); chip balances
// (on delivery, marketQ) and site capex (by stage, sitesQ). Security spend and the transition fund are charged ONLY
// here (WS4 keeps the security effects, WS5 the fund's effects on workers). Other workstreams book one-off costs
// through `bookCash` themselves (WS1 run cash at launch, WS4 action/event costs) and must not deduct the items above.
import { isDivision } from '../../../data/v2/starts';
import { payrollOf } from '../departments/teams';
import { powerAndOMPerYear } from '../compute/power';
import type { Commitment$, EngineSystem, GameStateV2, SystemCtx } from '../types';
import { drawDebt, interestPerYear, lineUndrawn } from './debt';
import { expireRepriced } from './equity';
import { ensureWs3, yearStats } from './ext';
import { bookCash, ledgerPaying } from './ledger';
import { deploymentRevenue } from './observe';
import { runwayOf } from './runway';

/** Insolvency grace: cash may sit below zero this many days (after the revolver) before the company fails [D]. */
export const INSOLVENCY_GRACE_DAYS = 30;

/** Cover negative cash with the credit line as arranged (not re-sized: that needs a borrowing decision); flag
 *  insolvency after the grace period. */
export function checkSolvency(s: GameStateV2, ctx: SystemCtx): void {
  const f = s.player.finance;
  if (f.cash < 0 && f.rating !== 'closed' && lineUndrawn(s) > 0) drawDebt(s, ctx, 'revolver', -f.cash + 0.5, { arrangedOnly: true });
  if (f.cash >= 0) {
    delete f.ws3.negativeSinceDay;
    return;
  }
  f.ws3.negativeSinceDay ??= s.time.day;
  // A division cannot go broke (R9): the parent carries the overdraft against its next payment.
  if (isDivision(s)) return;
  if (f.state !== 'insolvent' && s.time.day - f.ws3.negativeSinceDay >= INSOLVENCY_GRACE_DAYS) {
    f.state = 'insolvent';
    ctx.log('alert', `Insolvent: cash has been negative for ${INSOLVENCY_GRACE_DAYS} days with no options left.`, 5);
    ctx.headline('insolvent', `${s.player.name} runs out of money`);
  }
}

/** opex (130, daily): revenue run-rate (from WS5), power and O&M, spot rentals, interest; solvency check. */
export const opexSystem: EngineSystem = {
  id: 'opex', owner: 'WS3', cadence: 'daily', order: 130, system: 'finance',
  run(s, ctx) {
    ensureWs3(s);
    expireRepriced(s, ctx);
    const f = s.player.finance;
    const fx = f.ws3;
    const target = deploymentRevenue(s);
    if (target !== undefined) {
      const d = (target - f.revenueRun) / 30; // smoothed 30 d
      if (Math.abs(d) > 1e-6) ctx.bump('revenueRun', d, 'deployments');
    }
    const ys = yearStats(s);
    const power = powerAndOMPerYear(s) / 365;
    let rentals = 0;
    for (const r of fx.rentals) if (r.endDay > s.time.day) rentals += r.perYear / 365;
    const interest = interestPerYear(s) / 365;
    const cost = power + rentals + interest;
    if (cost > 0) bookCash(s, ctx, -cost, 'opex', 'opex', 'power, O&M, rentals, interest');
    ys.computeCosts += power + rentals;
    ys.interest += interest;
    fx.accQ.opCosts += cost;
    if (f.state === 'distress') ys.distressDays++;
    checkSolvency(s, ctx);
  },
};

const KIND_LABEL: Record<Commitment$['kind'], string> = { cloud: 'cloud contracts', lta: 'chip supply contracts', lease: 'colocation leases', finLease: 'financing leases', vendor: 'vendor notes', power: 'power contracts', acquired: 'acquired contracts' };

/** payroll (300, monthly): payroll, security spend, transition fund, revenue share, ledger instalments; expire
 *  finished contracts; refresh the runway readout. */
export const payrollSystem: EngineSystem = {
  id: 'payroll', owner: 'WS3', cadence: 'monthly', order: 300, system: 'finance',
  run(s, ctx) {
    ensureWs3(s);
    const p = s.player;
    const f = p.finance;
    const ys = yearStats(s);
    const payroll = payrollOf(p) / 12;
    bookCash(s, ctx, -payroll, 'payroll', 'payroll');
    ys.payroll += payroll;
    const security = p.security.spendRate / 12;
    const fund = p.policies.transitionFund / 12;
    if (security > 0) bookCash(s, ctx, -security, 'security', 'security spend', `WSL target ${p.security.target.toFixed(1)}`);
    if (fund > 0) bookCash(s, ctx, -fund, 'transitionFund', 'transition fund');
    const other = security + fund;
    const share = (f.deals.reduce((a, d) => a + (d.strings.revenueShare ?? 0), 0) * f.revenueRun) / 12;
    if (share > 0) bookCash(s, ctx, -share, 'opex', 'revenue share');
    ys.otherOpex += other + share;
    let total = payroll + other + share;
    const byKind: Partial<Record<Commitment$['kind'], number>> = {};
    for (const c of f.ledger) if (ledgerPaying(c, s.time.day)) byKind[c.kind] = (byKind[c.kind] ?? 0) + c.perQuarter / 3;
    for (const [k, amt] of Object.entries(byKind) as [Commitment$['kind'], number][]) {
      if (amt <= 0) continue;
      bookCash(s, ctx, -amt, 'commitments', KIND_LABEL[k]);
      total += amt;
      if (k === 'lta') ys.capexChips += amt;
      else if (k === 'vendor') ys.interest += amt;
      else ys.computeCosts += amt;
    }
    f.ws3.accQ.opCosts += total - (byKind.lta ?? 0);
    // Expire finished contracts.
    f.ledger = f.ledger.filter((c) => c.endDay > s.time.day);
    p.cloud = p.cloud.filter((c) => c.endDay > s.time.day);
    f.ws3.rentals = f.ws3.rentals.filter((r) => r.endDay > s.time.day);
    f.ws3.offers = f.ws3.offers.filter((o) => o.expiresDay > s.time.day);
    f.runwayQ = Math.round(runwayOf(s).q * 10) / 10;
    checkSolvency(s, ctx);
  },
};
