// Present value of the capex payment options (FIN6b, display only; FINANCE-V3 §4). A lease changes timing, not cost:
// on undiscounted totals it always looks worse than cash, so the build and buy cards also show each option's payments
// discounted to today at one stated rate. Pure: reads the options payOptions() returns and the payment timing the
// engine uses (site build schedule, chip delivery); changes nothing.
import { BUILD_Q, CAPEX_LEASE, CHIP_LOAN_SPREAD_BP, DEBT_TERMS } from '../../../data/v2/deals';
import type { GameStateV2 } from '../types';
import { leaseRate, type PayOption, type SiteSchedule } from './capex';

/** The discount rate: the lessor's return at your rating (your cost of borrowing against the asset), or the chip-loan
 *  rate when no lessor funds you. `basis` says which, for the tooltip. */
export function discountRate(s: GameStateV2): { rate: number; basis: string } {
  const rating = s.player.finance.rating;
  const lr = leaseRate(s);
  if (lr !== undefined) return { rate: lr, basis: `the lessor's return at your rating ${rating}: what borrowing against this asset costs you` };
  return { rate: (s.capital.sofr + CHIP_LOAN_SPREAD_BP[rating] / 100) / 100, basis: `the chip-loan rate at rating ${rating} (no lessor funds you now)` };
}

/** Discount factor for a payment `q` quarters from now at annual rate `r`. */
const df = (r: number, q: number) => Math.pow(1 + r, -q / 4);
/** PV of `n` equal quarterly payments of `perQ`, the first `q0` quarters from now. */
const annuityQ = (r: number, perQ: number, n: number, q0: number) => {
  let a = 0;
  for (let j = 0; j < n; j++) a += perQ * df(r, q0 + j);
  return a;
};

/** When a site's own cash goes out, as the engine pays it (BUILD_Q.upfront at the start, the rest in equal parts over
 *  the building quarters ending at go-live; see constructionGrowth): PV of 1 of capex. */
function siteCashFactor(r: number, sch: SiteSchedule): number {
  const k0 = sch.firstNow ? 0 : 1;
  const n = sch.buildQ - k0;
  let build = 0;
  if (n <= 0) build = df(r, sch.etaQ);
  else for (let k = k0; k < sch.buildQ; k++) build += df(r, sch.etaQ - sch.buildQ + k) / n;
  return BUILD_Q.upfront + (1 - BUILD_Q.upfront) * build;
}

export interface PayPV { rate: number; basis: string; pv: Partial<Record<PayOption['id'], number>> }

/**
 * Present value of each payment option. Sites: pass the build schedule; your cash share follows it and lease payments
 * run quarterly from go-live. Chips: pass the quarters to delivery and the deposit paid now (in every option); the
 * balance is paid at delivery (cash), leased quarterly for 5 years from delivery, or part-borrowed with interest each
 * quarter and the principal repaid at the loan's maturity.
 */
export function payOptionsPV(s: GameStateV2, opts: PayOption[], timing: { site: SiteSchedule } | { chipsDelayQ: number; upfront: number }): PayPV {
  const { rate: r, basis } = discountRate(s);
  const pv: PayPV['pv'] = {};
  const cash = opts.find((o) => o.id === 'cash');
  if (!cash) return { rate: r, basis, pv };
  if ('site' in timing) {
    const f = siteCashFactor(r, timing.site);
    const amount = cash.total;
    for (const o of opts) {
      if (o.blocked) continue;
      if (o.id === 'cash') pv.cash = amount * f;
      else if (o.id === 'lease') pv.lease = (amount * (1 - CAPEX_LEASE.siteShare)) * f + annuityQ(r, o.perYear / 4, o.years * 4, timing.site.etaQ);
    }
    return { rate: r, basis, pv };
  }
  const D = Math.max(0, timing.chipsDelayQ);
  const dep = timing.upfront;
  const balance = cash.total - dep;
  for (const o of opts) {
    if (o.blocked) continue;
    if (o.id === 'cash') pv.cash = dep + balance * df(r, D);
    else if (o.id === 'lease') pv.lease = dep + annuityQ(r, o.perYear / 4, o.years * 4, D);
    else if (o.id === 'loan' && o.rate) {
      const loan = o.perYear / o.rate;
      const n = DEBT_TERMS.gpuTerm.years * 4;
      pv.loan = dep + (balance - loan) * df(r, D) + annuityQ(r, o.perYear / 4, n, D + 1) + loan * df(r, D + n);
    }
  }
  return { rate: r, basis, pv };
}
