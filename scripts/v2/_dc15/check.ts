// DC-15 check: a leased campus starts one financing lease per building, when that building goes live (DATACENTERS 5b,
// DC-15). Run alone: npx tsx scripts/v2/_dc15/check.ts   (PROBE=1 prints the single-site numbers to hard-code)
import { defaultSetupV2, newGame } from '../../../src/engine/v2';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { dayOfQuarter, quarterIndex } from '../../../src/engine/v2/core/time';
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { newSite, siteCapex, siteSchedule, sitesQSystem, type SiteOpts } from '../../../src/engine/v2/compute/sites';
import { crf, payOptions, siteLeaseId } from '../../../src/engine/v2/finance/capex';
import { payOptionsPV } from '../../../src/engine/v2/finance/pv';
import { yearStats } from '../../../src/engine/v2/finance/ledger';
import { CAPEX_LEASE } from '../../../src/data/v2/deals';
import type { GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const rel = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const RATE = 0.09;

const fresh = () => {
  const s = newGame(defaultSetupV2({ seed: 1 }));
  s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
  s.pub.dcNimby = 0; // no opposition rolls
  s.player.finance.rating = 'BB'; // lessor at 9%
  return s;
};

/** Preview of the lease option (what the build card shows), then build the leased site and step it to its last
 *  building; returns both. */
function run(o: SiteOpts) {
  const s: GameStateV2 = fresh();
  const q0 = quarterIndex(s.time.startDate, s.time.day);
  const capex = siteCapex(o);
  const sch = siteSchedule(s, o);
  const opts = payOptions(s, capex, 'site', sch);
  const lease = opts.find((x) => x.id === 'lease')!;
  const pv = payOptionsPV(s, opts, { site: sch });
  let principal = -yearStats(s).spvFinanced; // what the lessor paid in all (the year tally, summed over the steps)
  const site = newSite(s, makeCtx(s), { ...o, pay: 'lease', leaseRate: RATE });
  principal += yearStats(s).spvFinanced;
  const ctx = makeCtx(s);
  for (let q = q0 + 1; q <= q0 + 60 && site.stage !== 'blocked'; q++) {
    s.time.day = dayOfQuarter(s.time.startDate, q);
    const before = yearStats(s).spvFinanced;
    sitesQSystem.run(s, ctx);
    principal += yearStats(s).spvFinanced - before;
    if (site.stage === 'live' && s.time.day > site.ws3.liveDays![site.ws3.liveDays!.length - 1]) break;
  }
  const ledger = s.player.finance.ledger.filter((c) => c.kind === 'finLease' && (c.contract ?? c.id) === siteLeaseId(site.id));
  return { s, q0, site, capex, lease, pv, ledger, sch, principal };
}

// PV of the booked leases, discounted to the commitment day on the preview's convention (quarter offsets, annuity of 60 quarters).
const bookedLeasePV = (s: GameStateV2, q0: number, ledger: ReturnType<typeof run>['ledger']) => {
  let pv = 0;
  for (const c of ledger) {
    const q = quarterIndex(s.time.startDate, c.startDay ?? 0) - q0;
    for (let j = 0; j < CAPEX_LEASE.years.site * 4; j++) pv += c.perQuarter * Math.pow(1 + RATE, -(q + j) / 4);
  }
  return pv;
};

// 1. A leased gas 5 x 1 GW campus: five leases, one per building, each starting on its live day.
if (!process.env.PROBE) {
  const o: SiteOpts = { path: 'gas', mw: 1000, buildings: 5 };
  const { s, q0, site, capex, lease, pv, ledger, principal } = run(o);
  const days = site.ws3.liveDays!;
  const years = CAPEX_LEASE.years.site;
  check(ledger.length === 5, 'five finLease entries for a 5-building campus', `${ledger.length}`);
  check(ledger.every((c, k) => c.id === `${siteLeaseId(site.id)}-b${k}` && c.startDay === days[k] && c.endDay === days[k] + years * 365), 'ids -b0..-b4, each starts on its building\'s live day and runs 15 y', ledger.map((c) => `${c.id.slice(-3)}@${c.startDay}`).join(' '));
  const by = site.ws3.lease!.byBuilding!;
  check(by.length === 5 && ledger.every((c, k) => rel(c.perQuarter * 4, by[k] * crf(RATE, years))), 'per-year amount of each lease = funded_k x CRF(9%, 15 y)', by.map((x) => x.toFixed(3)).join(' '));
  const total = by.reduce((a, b) => a + b, 0);
  check(rel(total, site.ws3.lease!.funded) && total >= capex * CAPEX_LEASE.siteShare - 1e-9 && rel(site.spvFunded * capex, capex * CAPEX_LEASE.siteShare), 'sum of funded_k = total lessor funding (>= 80% of capex plus interest)', `${total.toFixed(3)} of ${capex.toFixed(3)} capex`);
  check(rel(principal, capex * CAPEX_LEASE.siteShare) && by.every((x, k) => x > principal / 5 * 0.99), 'the lessor paid 80% of capex in all; each building funded about a fifth (plus its own interest)', `paid ${principal.toFixed(3)}`);
  check(by[0] < by[4] && by.every((x, k) => k === 0 || x >= by[k - 1] - 1e-9), 'later buildings carry more interest (they wait longer)', '');
  const booked = ledger.reduce((a, c) => a + c.perQuarter * 4, 0);
  check(rel(booked, lease.perYear), 'preview lease per year = booked ledger sum', `${lease.perYear.toFixed(4)} vs ${booked.toFixed(4)}`);
  check(rel(booked * years + capex * (1 - CAPEX_LEASE.siteShare), lease.total), 'preview lease total = booked payments + your 20%', `${lease.total.toFixed(4)}`);
  const f = pv.pv.cash! / capex; // cash PV of 1 of capex, the preview's cash-schedule factor
  const leasePV = pv.pv.lease! - capex * (1 - CAPEX_LEASE.siteShare) * f;
  check(rel(leasePV, bookedLeasePV(s, q0, ledger)), 'preview lease PV = PV of the booked ledger', `${leasePV.toFixed(4)} vs ${bookedLeasePV(s, q0, ledger).toFixed(4)}`);
}

// 1b. Power-bound grid campus (all three buildings live in the same quarter): three entries on the same day, preview = ledger.
if (!process.env.PROBE) {
  const { ledger, lease, site } = run({ path: 'grid', mw: 300, buildings: 3 });
  const booked = ledger.reduce((a, c) => a + c.perQuarter * 4, 0);
  check(ledger.length === 3 && ledger.every((c) => c.startDay === site.ws3.liveDays![0]) && rel(booked, lease.perYear), 'grid 3 x 300 MW: three leases on the same day, preview = ledger', `${booked.toFixed(4)} vs ${lease.perYear.toFixed(4)}`);
}

// 2. A leased single 1 GW site: exactly what it was before DC-15 (values computed on the DC-13 base commit).
{
  const o: SiteOpts = { path: 'gas', mw: 1000 };
  const { site, lease, pv, ledger, capex } = run(o);
  const l = ledger[0];
  if (process.env.PROBE) console.log(JSON.stringify({ capex, id: l?.id, perQuarter: l?.perQuarter, startDay: l?.startDay, endDay: l?.endDay, funded: site.ws3.lease!.funded, total: lease.total, perYear: lease.perYear, now: lease.now, pvLease: pv.pv.lease, pvCash: pv.pv.cash, n: ledger.length }, null, 1));
  const W = { capex: 17, perQuarter: 0.4792961399241214, startDay: 1461, endDay: 6936, funded: 15.453827398240671, total: 32.15776839544727, perYear: 1.9171845596964847, now: 3.3999999999999995, pvLease: 15.580499915866033, pvCash: 14.916487775795622 };
  check(ledger.length === 1 && l.id === siteLeaseId(site.id), 'single building: one entry, today\'s id', l?.id);
  const got = { capex, perQuarter: l.perQuarter, startDay: l.startDay, endDay: l.endDay, funded: site.ws3.lease!.funded, total: lease.total, perYear: lease.perYear, now: lease.now, pvLease: pv.pv.lease, pvCash: pv.pv.cash } as Record<string, number>;
  for (const k of Object.keys(W) as (keyof typeof W)[]) check(Math.abs(got[k] - W[k]) <= 1e-9 * Math.max(1, Math.abs(W[k])), `single 1 GW leased: ${k} unchanged`, `${got[k]} want ${W[k]}`);
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
