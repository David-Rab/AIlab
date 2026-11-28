// Back-of-envelope estimates: money (see scripts/v2/estimates.ts; design/estimates/MAP-A.md, MAP-B.md, E1b-report.md).
// The money loop on the reference path, no tick: the reference revenue curve (finance/plan.ts refRevenueRun) against the
// reference compute plan priced by the engine's own market (refTotal × the expected cloud price per quarter), the capex
// identity (the year's added reference compute at the expected chip price plus a campus's capex), and the start runway.
import { COMPONENTS, MARKET, SOURCES } from '../../../src/data/v2/deals';
import { expectedCloudPrice, expectedListPrice } from '../../../src/engine/v2/compute/market';
import { campusMW, siteCapex, siteFit } from '../../../src/engine/v2/compute/sites';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { refRevenueRun } from '../../../src/engine/v2/finance/plan';
import { operatingCostsPerYear, runwayOf } from '../../../src/engine/v2/finance/runway';
import { refTotal } from '../../../src/engine/v2/production/ces';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { estOf, type Estimate } from './types';

export const area = 'money';

const START = '2025-07-01';
/** Calendar year `cy`'s revenue ($B): the mean of the reference run-rate at its 12 month-middles. */
function yearRevenue(s: GameStateV2, cy: number): number {
  const a = dayOfDate(START, `${cy}-01-01`);
  const b = dayOfDate(START, `${cy + 1}-01-01`);
  let x = 0;
  for (let m = 0; m < 12; m++) x += refRevenueRun(s, a + ((m + 0.5) * (b - a)) / 12);
  return x / 12;
}
/** The four quarters of calendar year `cy`: quarter index k (0 = Q3 2025) and the clock year of the quarter's middle. */
const quartersOf = (cy: number) => [0, 1, 2, 3].map((j) => { const k = Math.round((cy - 2025.5) * 4) + j; return { k, yr: 2025.5 + (k + 0.5) / 4 }; });

export function estimates(): Estimate[] {
  const rows: Estimate[] = [];
  const s = newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));
  const w = s.hidden.timeline;

  // The money loop's two sides over 2026: revenue (the sourced reference curve) and compute (the reference plan at the
  // engine's expected cloud price: the all-rented upper bound; owned TCO is the lower bound).
  const rev26 = yearRevenue(s, 2026);
  const rev27 = yearRevenue(s, 2027);
  const compute = quartersOf(2026).reduce((a, q) => a + (refTotal(w, q.yr) * expectedCloudPrice(s, q.k)) / 1e6, 0) / 4;
  rows.push(estOf('F7.revenue2026', `$${rev26.toFixed(0)}B`, rev26, 'mean over 2026 of refRevenueRun(s, day) at 12 month-middles (the sourced curve itself: in band by construction)', 'curve'));
  rows.push(estOf('F11.revenue2027', `$${rev27.toFixed(0)}B`, rev27, 'mean over 2027 of refRevenueRun(s, day) at 12 month-middles (the sourced curve itself)', 'curve'));
  rows.push(estOf('F7.compute2026', `$${compute.toFixed(0)}B/yr (revenue $${rev26.toFixed(0)}B: the loop ${rev26 > compute ? 'closes' : 'does not close'})`, compute,
    'per quarter of 2026: refTotal(w, yr) × expectedCloudPrice(s, k), meaned; against refRevenueRun above'));

  // The capex identity: chips are ordered a package lead time (COMPONENTS.pkg.L quarters) before they are delivered, so
  // 2026's capex buys the compute added over the following year: each 2026 quarter's order is the reference compute added
  // L quarters later, at that quarter's expected chip price (with the network), plus a campus's capex per MW × the MW those
  // chips draw (the start kW per H100e: the efficiency gain is not applied, so the MW and its capex are slightly high).
  {
    const qs = quartersOf(2026);
    const capex = (lagQ: number) => {
      const added = qs.map((q) => refTotal(w, q.yr + lagQ / 4) - refTotal(w, q.yr + lagQ / 4 - 0.25));
      const chips = qs.reduce((a, q, i) => a + (added[i] * expectedListPrice(s.market, q.k) * (1 + MARKET.networkShare)) / 1e6, 0);
      const camp = siteFit({ path: 'gas', mw: SOURCES.gas.maxMW, buildings: 5 });
      const sites = (siteCapex(camp) / campusMW(camp)) * ((added.reduce((a, x) => a + x, 0) * s.power.kWPerH100e) / 1000);
      return { chips, sites, added: added.reduce((a, x) => a + x, 0) };
    };
    const ordered = capex(COMPONENTS.pkg.L);
    const delivered = capex(0);
    rows.push(estOf('F7.capex2026', `ordered for delivery a year on: chips $${ordered.chips.toFixed(0)}B + sites $${ordered.sites.toFixed(0)}B (${(ordered.added / 1e6).toFixed(1)}M H100e); if booked at delivery in 2026: $${(delivered.chips + delivered.sites).toFixed(0)}B (${(delivered.added / 1e6).toFixed(1)}M)`, ordered.chips + ordered.sites,
      'Σ per 2026 quarter (refTotal(w, yr + L/4) − refTotal(w, yr + L/4 − 0.25)), L = COMPONENTS.pkg.L, × expectedListPrice(m, k) × (1 + MARKET.networkShare); + siteCapex(siteFit gas campus) / campusMW × the MW (added × s.power.kWPerH100e); all owned; the lag is the order-to-delivery convention (the alternative is in the value)'));
  }

  // The start runway (no registry row: reported in E1b-report.md, "registry entries wanted").
  const rw = runwayOf(s);
  console.log(`  [start runway] liquidity $${rw.liquidity.toFixed(1)}B, net burn $${rw.burnQ.toFixed(1)}B/quarter, runway ${rw.q} q, operating costs $${operatingCostsPerYear(s).toFixed(1)}B/yr`);
  return rows;
}
