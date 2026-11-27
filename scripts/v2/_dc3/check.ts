// DC-3 check: site lifecycle on the new sources (design/DATACENTERS.md §3, DC-TASKS [D-4]..[D-7], the DC-3 worked
// example). Runs only the quarterly site step (sitesQ) on a fresh game, so no other system moves the numbers.
// Run alone: npx tsx scripts/v2/_dc3/check.ts
import { defaultSetupV2, newGame, pendingGW, worldWaitQ } from '../../../src/engine/v2';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../../../src/engine/v2/core/time';
import { newSite, oppositionLevel, oppositionOdds, siteCapex, siteLiveInQ, sitePowerQ, siteSchedule, sitesQSystem, type SiteOpts } from '../../../src/engine/v2/compute/sites';
import { siteBars, siteLiveQ } from '../../../src/engine/v2/compute/forecast';
import { powerAndOMPerYear } from '../../../src/engine/v2/compute/power';
import type { GameStateV2, Site } from '../../../src/engine/v2/types';

let fails = 0;
const near = (got: number, want: number, what: string, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol; if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${+got.toFixed(4)} (want ${+want.toFixed(4)})`);
};
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

const fresh = (seed = 1) => {
  const s = newGame(defaultSetupV2({ seed }));
  s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
  s.pub.dcNimby = 0; // no opposition rolls fire
  return s;
};
const qOfDay = (s: GameStateV2, d: number) => quarterIndex(s.time.startDate, d);
/** Run sitesQ at the start of each quarter up to and including quarter `toQ`; `each` sees the state after each run. */
function tickTo(s: GameStateV2, toQ: number, each?: (q: number) => void) {
  const ctx = makeCtx(s);
  for (let q = qOfDay(s, s.time.day) + 1; q <= toQ; q++) {
    s.time.day = dayOfQuarter(s.time.startDate, q);
    sitesQSystem.run(s, ctx);
    each?.(q);
  }
}

// ── Worked example ──
const s = fresh();
const ctx = makeCtx(s);
const q0 = qOfDay(s, s.time.day);
check(q0 === 4, 'commit quarter is Q3 26 (index 4)', `q ${q0}`);
const redRiver = s.player.sites.find((x) => x.id === 'S4')!;
console.log(`     start waits: grid ${worldWaitQ(s, 'grid').toFixed(3)} q (Red River ${redRiver.mw / 1000} GW, ${redRiver.stage}), gas ${worldWaitQ(s, 'gas').toFixed(3)} q, rent ${worldWaitQ(s, 'rent').toFixed(3)} q`);

const gasO: SiteOpts = { path: 'gas', mw: 1000, rush: true, community: true };
near(sitePowerQ(s, gasO), 4, 'gas rush powerQ');
near(siteLiveInQ(s, gasO), 12, 'gas rush live in (2 + max(10, 4))');
near(siteCapex(gasO), 18.9, 'gas rush + community capex (14 + 3 + 0.9 + 1.0)', 1e-9);
const gas = newSite(s, ctx, gasO);
near(gas.capexPaid, 0.945, 'gas paid now (5%)', 1e-9);
check(gas.stage === 'permitting' && qOfDay(s, gas.stageEndDay) === 6, 'gas permits end Q1 27 (index 6)', `${gas.stage} → q ${qOfDay(s, gas.stageEndDay)}`);
check(siteLiveQ(s, gas)?.q === 16, 'forecast: gas live Q3 29 (index 16)', `q ${siteLiveQ(s, gas)?.q}`);

const gridRate = 30 * Math.pow(1.1, 2026 + 7 / 12 + 4 / 365 - 2026);
const gridW = worldWaitQ(s, 'grid');
near(gridW, 20 + (pendingGW(s.player.sites, 'grid', s.time.day) * 4) / gridRate, 'grid wait = 20 + pending × 4 / rate', 1e-9);
console.log(`     grid pending ${pendingGW(s.player.sites, 'grid', s.time.day)} GW, rate ${gridRate.toFixed(2)} GW/yr, wait ${gridW.toFixed(3)} q`);
const gridO: SiteOpts = { path: 'grid', mw: 1000, rush: true };
near(sitePowerQ(s, gridO), 15, 'grid rush powerQ round(W × 0.75)');
near(siteLiveInQ(s, gridO), 16, 'grid rush live in (1 + 15)');
const grid = newSite(s, ctx, gridO);
check(siteLiveQ(s, grid)?.q === 20, 'forecast: grid live Q3 30 (index 20)', `q ${siteLiveQ(s, grid)?.q}`);
const gridPowerQ = grid.ws3.powerQ;

// Fixed wait: 20 GW more grid after the first grid site
const newGridBefore = sitePowerQ(s, { path: 'grid', mw: 1000 });
for (let i = 0; i < 20; i++) newSite(s, ctx, { path: 'grid', mw: 1000, name: `Filler ${i + 1}` });
const newGridAfter = sitePowerQ(s, { path: 'grid', mw: 1000 });
check(newGridAfter - newGridBefore >= 2, 'a new grid site waits ≥ 2 q longer after +20 GW', `${newGridBefore} → ${newGridAfter} q`);
check(grid.ws3.powerQ === gridPowerQ, 'the first grid site keeps its powerQ', `${grid.ws3.powerQ}`);

const rentO: SiteOpts = { path: 'rent', mw: 1000 };
near(siteLiveInQ(s, rentO), 4, 'rent live in');
const rent = newSite(s, ctx, rentO);
const rentLedger = s.player.finance.ledger.find((e) => e.id === `L-rent-${rent.id}`);
check(!!rentLedger && rentLedger.payee === 'Data-centre rent', 'rent ledger entry', rentLedger?.payee ?? 'missing');
near(rentLedger?.perQuarter ?? 0, 0.45, 'rent per quarter ($B)');
check(rentLedger?.startDay === dayOfQuarter(s.time.startDate, 8), 'rent starts at go-live Q3 27 (index 8)', `q ${qOfDay(s, rentLedger?.startDay ?? 0)}`);
near(rent.capexPaid, 0.05 * 4, 'rent paid now (5% of the $4B network)');
check(siteSchedule(s, gasO).etaQ === 12 && siteSchedule(s, gasO).buildQ === 10, 'siteSchedule gas: eta 12, build 10');

// Tick quarterly and follow the three sites
const stages: Record<string, string[]> = { gas: [], grid: [], rent: [] };
const gasPays: number[] = [];
let lastPaid = gas.capexPaid;
tickTo(s, 22, (q) => {
  stages.gas.push(`${q}:${gas.stage}`); stages.grid.push(`${q}:${grid.stage}`); stages.rent.push(`${q}:${rent.stage}`);
  const d = gas.capexPaid - lastPaid;
  if (d > 1e-12) gasPays.push(+d.toFixed(6));
  lastPaid = gas.capexPaid;
  if (q === 6) check(gas.stage === 'building', 'gas building from Q1 27 (power 4 < construction 10)', gas.stage);
  if (q === 5) check(grid.stage === 'power' && qOfDay(s, grid.stageEndDay) === 10, 'grid: permits end Q4 26, power stage until Q1 28 (index 10)', `${grid.stage} → q ${qOfDay(s, grid.stageEndDay)}`);
  if (q === 10) check(grid.stage === 'building' && qOfDay(s, grid.stageEndDay) === 20, 'grid building Q1 28 → Q3 30', `${grid.stage} → q ${qOfDay(s, grid.stageEndDay)}`);
  if (q === 8) check(rent.stage === 'live', 'rent live Q3 27', rent.stage);
  if (q === 16) check(gas.stage === 'live', 'gas live Q3 29', gas.stage);
  if (q === 20) check(grid.stage === 'live', 'grid live Q3 30', grid.stage);
});
console.log(`     gas stages: ${stages.gas.join(' ')}`);
console.log(`     grid stages: ${stages.grid.join(' ')}`);
console.log(`     gas construction payments: ${gasPays.join(', ')}`);
check(gasPays.length === 10 && gasPays.every((x) => Math.abs(x - gasPays[0]) < 1e-6), 'gas: 10 equal construction payments', `${gasPays.length}`);
near(gas.capexPaid, 18.9, 'gas capexPaid at go-live', 1e-9);
check(grid.ws3.liveAt === dayOfQuarter(s.time.startDate, 20), 'grid liveAt unchanged by the later 20 GW (Q3 30)', `q ${qOfDay(s, grid.ws3.liveAt ?? 0)}`);
near(grid.capexPaid, grid.capex, 'grid capexPaid at go-live', 1e-9);
near(rent.capexPaid, rent.capex, 'rent capexPaid at go-live', 1e-9);
check(s.power.waitHist.grid.length === 18 && s.power.waitHist.gas.length === 18 && s.power.waitHist.rent.length === 18, 'waitHist: one value per sitesQ run', `${s.power.waitHist.grid.length}`);
console.log(`     waitHist grid: ${s.power.waitHist.grid.slice(0, 8).join(' ')} …`);

// siteBars for the grid site, planned at commitment and as built
{
  const t = fresh();
  const c = makeCtx(t);
  const g = newSite(t, c, gridO);
  const b0 = siteBars(t, g);
  console.log(`     grid bars at commitment: ${JSON.stringify(b0)}`);
  check(!!b0 && b0.liveQ === 20 && b0.permits?.[1] === 5 && b0.power?.[1] === 20 && b0.construction?.[0] === 10, 'siteBars at commitment: permits → Q4 26, power → Q3 30, construction from Q1 28');
  tickTo(t, 6);
  const b1 = siteBars(t, g);
  check(!!b1 && b1.liveQ === 20 && b1.firm && b1.power?.[0] === 5 && b1.construction?.[0] === 10, 'siteBars after the roll match', JSON.stringify(b1));
}

// Fast-track grid: no permits, the roll at commitment
{
  const t = fresh();
  const c = makeCtx(t);
  const ft = newSite(t, c, { path: 'grid', mw: 500, fastTrack: true });
  check(ft.ws3.rolled && (ft.stage === 'power' || ft.stage === 'building'), 'fast-track grid rolls at commitment', ft.stage);
  check(siteLiveQ(t, ft)?.q === q0 + Math.max(8, ft.ws3.powerQ), 'fast-track live = now + max(8, power)', `q ${siteLiveQ(t, ft)?.q}, powerQ ${ft.ws3.powerQ}`);
}

// Opposition odds [D-6]
{
  const t = fresh();
  t.pub.dcNimby = 45;
  const o = (path: Site['path'], crash = false, community = false) => oppositionOdds(t, { path, crash, communityPackage: community });
  near(o('grid').block, 0.045, 'grid block at mood 0.9'); near(o('grid').delay, 0.18, 'grid delay at mood 0.9');
  near(o('gas').block, 0.09, 'gas block at mood 0.9'); near(o('gas').delay, 0.27, 'gas delay at mood 0.9');
  near(o('gas', true, true).block, 0.0675, 'gas crash + community block');
  near(o('rent').block + o('rent').delay, 0, 'rent has no opposition');
  t.pub.dcNimby = 100;
  near(o('gas', true).block, 0.3, 'gas crash block at mood 2'); near(o('gas', true).delay, 0.6, 'gas crash delay at mood 2 (≤ 0.9 − block)');
  check(oppositionLevel(0.03) === 'low' && oppositionLevel(0.05) === 'medium' && oppositionLevel(0.1) === 'high', 'opposition levels');
}

// Block: blocked sites leave the queue and keep what was paid as spent
{
  const t = fresh(7);
  t.pub.dcNimby = 100;
  const c = makeCtx(t);
  const sites: Site[] = [];
  for (let i = 0; i < 40; i++) sites.push(newSite(t, c, { path: 'grid', mw: 500, crash: true, name: `B${i}` }));
  const paid0 = sites.map((x) => x.capexPaid);
  tickTo(t, 5);
  const blocked = sites.filter((x) => x.stage === 'blocked');
  const delayed = sites.filter((x) => x.stage === 'permitting');
  console.log(`     40 crash grid sites at mood 2 (block 15%, delay 45%): ${blocked.length} blocked, ${delayed.length} delayed`);
  check(blocked.length > 0, 'some sites blocked');
  const inQueue = pendingGW(t.player.sites.filter((x) => sites.includes(x)), 'grid', t.time.day);
  near(inQueue, (sites.length - blocked.length) * 0.5, 'blocked sites leave pendingGW');
  tickTo(t, 8);
  check(blocked.every((x) => x.stage === 'blocked' && Math.abs(x.capexPaid - paid0[sites.indexOf(x)]) < 1e-12), 'blocked sites keep capexPaid as spent (no refund, no more payments)');
}

// Running cost: gas power at 0.5× grid, no κ
{
  const t = fresh();
  const live = t.player.sites.filter((x) => x.stage === 'live');
  const before = powerAndOMPerYear(t);
  for (const x of live) x.path = 'gas';
  const after = powerAndOMPerYear(t);
  check(after < before, 'gas sites cost less to run than grid', `${before.toFixed(3)} → ${after.toFixed(3)} $B/yr`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
