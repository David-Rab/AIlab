// Sites and power (design/DATACENTERS.md, DC-TASKS DC-1..DC-17): world waits, site lifecycle on rent / grid / gas, the
// build action's preview, start sites, campuses of 1 / 3 / 5 buildings, per-building financing leases, the numbers the
// build card shows, and the reference bot's sites (one decision round in quick, a five-quarter game in full). One suite (run.ts job `sites`). Owner: WS3.
//   npx tsx scripts/v2/sites.ts [--smoke]
import { CAMPUS, CAPEX_LEASE, RENT, SITE_MIN_MW, SITE_TIERS, SOURCES } from '../../src/data/v2/deals';
import { actionView, act, defaultSetupV2, engine, leverEffects, newGame, oppositionOdds, outsideGW, pendingGW, refWaitQ, waitBreakdown, waitQ, worldWaitQ, type QueueSite } from '../../src/engine/v2';
import { refBot } from '../../src/engine/v2/bots/ref';
import { rateGWPerYear } from '../../src/engine/v2/compute/waits';
import { chipFit, computeForecast, siteBars, siteBuildingLiveQs, siteBuildingsView, siteLiveQ } from '../../src/engine/v2/compute/forecast';
import { clearMarket } from '../../src/engine/v2/compute/market';
import { ownedOnline, powerAndOMPerYear, siteCapacityH } from '../../src/engine/v2/compute/power';
import {
  LOCAL_MOOD, campusMW, newSite, oppositionLevel, oppositionParts, siteBuildQ, siteBuildingLiveInQ, siteCapex, siteCapexParts, siteFit, siteLeasePerYear, siteLiveInQ, siteLiveMW,
  sitePowerQ, siteSchedule, sitesQSystem, type SiteOpts,
} from '../../src/engine/v2/compute/sites';
import { makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { dateOfDay, dayOfDate, dayOfQuarter, decimalYear, quarterIndex } from '../../src/engine/v2/core/time';
import { crf, payOptions, siteLeaseId } from '../../src/engine/v2/finance/capex';
import { yearStats } from '../../src/engine/v2/finance/ledger';
import { cashFlows } from '../../src/engine/v2/finance/runway';
import { payOptionsPV } from '../../src/engine/v2/finance/pv';
import type { GameStateV2, Site, LabKindId } from '../../src/engine/v2/types';
import { SMOKE, check, finish } from './lib';

const near = (got: number, want: number, what: string, tol = 1e-9) =>
  check(Math.abs(got - want) <= tol, what, `${+got.toFixed(4)} (want ${+want.toFixed(4)})`);

// Cost rule (CP1): a check costs in proportion to its importance. Minor rules are constructed cases: one site, a few
// quarters of sitesQSystem. A start game is built once per setup and cloned (a clone is ~10x cheaper than newGame).
// The sweeps (preview = effect over every source x size x buildings x lever) are cheap that way and run whole in both
// tiers. The one long sim, the reference bot's game, is full tier only; under --smoke (quick) the bot makes its first
// decision round on the start state. Every check stays binding in both.
const BASE = new Map<string, GameStateV2>();
function game(setup?: Parameters<typeof defaultSetupV2>[0]): GameStateV2 {
  const key = JSON.stringify(setup ?? {});
  let b = BASE.get(key);
  if (!b) { b = newGame(defaultSetupV2(setup)); BASE.set(key, b); }
  return structuredClone(b);
}

// ── DC-2: World waits (DATACENTERS §4, DC-TASKS [D-1]..[D-3]): pure functions and the state readers ──
{
  // No sites: the reference path
  for (const [y, w] of [[2023, 12], [2024, 16], [2025.5, 19], [2026, 20], [2030, 10], [2032, 10], [2021, 12]] as const) near(refWaitQ('grid', y), w, `grid wait ${y}`);
  near(refWaitQ('gas', 2025.5), 8.5, 'gas wait 2025.5'); near(refWaitQ('gas', 2026), 9, 'gas wait 2026');
  near(refWaitQ('rent', 2025.5), 3.5, 'rent wait 2025.5'); near(refWaitQ('rent', 2026), 4, 'rent wait 2026');
  near(outsideGW('grid', 2026), 150, 'outside grid GW 2026');

  // With yours
  near(waitQ('grid', 2026, 1), 20.13333333333333, 'grid +1 GW at 2026.0 (20.1333)', 1e-4);
  near(waitQ('gas', 2026, 5), 9.33333333333333, 'gas +5 GW at 2026.0 (9.3333)', 1e-4);
  near(waitQ('rent', 2026, 1), 4.66666666666667, 'rent +1 GW at 2026.0 (4.6667)', 1e-4);

  // pendingGW
  const site = (path: string, mw: number, stage: string, ws3: QueueSite['ws3'] = {}): QueueSite => ({ path, mw, stage, ws3 });
  near(pendingGW([site('gas', 1000, 'power', { rush: true })], 'gas', 100), 1, 'rushed gas site counts in the backlog (DATACENTERS §5b)');
  near(pendingGW([site('gas', 1000, 'power')], 'gas', 100), 1, 'unrushed gas site counts its GW');
  near(pendingGW([site('grid', 1000, 'building', { powerDay: 90 })], 'grid', 100), 0, 'grid site with powerDay <= day counts 0');
  near(pendingGW([site('grid', 1000, 'power', { powerDay: 300 })], 'grid', 100), 1, 'grid site with powerDay > day counts');
  near(pendingGW([site('grid', 1000, 'blocked')], 'grid', 100), 0, 'blocked site counts 0');
  near(pendingGW([site('rent', 500, 'building'), site('rent', 500, 'live'), site('rent', 200, 'blocked')], 'rent', 100), 0.5, 'rent: not-live sites count');
  near(pendingGW([site('grid', 1000, 'power'), site('gas', 2000, 'power')], 'grid', 100), 1, 'other sources do not mix');

  // State wrappers on a fresh game: the player's start sites feed the queues; breakdown agrees with worldWaitQ
  const s = game();
  for (const src of ['grid', 'gas', 'rent'] as const) {
    const b = waitBreakdown(s, src);
    console.log(`     ${src}: wait ${b.waitQ.toFixed(3)} q, ref ${b.refQ}, you ${b.youGW} GW [${b.you.map((x) => `${x.name} ${x.gw}`).join(', ')}], others ${b.othersGW.toFixed(1)} GW, rate ${b.rateGWPerYear.toFixed(1)} GW/yr, +1 GW = ${b.perGWQ.toFixed(4)} q`);
    near(b.waitQ, worldWaitQ(s, src), `${src}: breakdown wait = worldWaitQ`);
    near(b.waitQ, b.refQ + b.youGW * b.perGWQ, `${src}: wait = ref + youGW x perGWQ`);
    near(b.othersGW * 4 / b.rateGWPerYear, b.refQ, `${src}: outside GW x 4 / rate = ref wait`);
  }
  check(Math.abs(waitBreakdown(s, 'grid').refQ - 19) < 1e-9, 'game start (2025-07-01) reads grid 19 q');
}

// ── DC-3: Site lifecycle on the three sources (DATACENTERS §3, [D-4]..[D-7]): worked example, fixed waits, opposition, blocks ──
{
  const fresh = (seed = 1) => {
    const s = game({ seed });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = 0; // no opposition rolls fire
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
    LOCAL_MOOD.dcNimby = 45;
    const o = (path: Site['path'], crash = false, community = false) => oppositionOdds(t, { path, crash, communityPackage: community });
    near(o('grid').block, 0.045, 'grid block at mood 0.9'); near(o('grid').delay, 0.18, 'grid delay at mood 0.9');
    near(o('gas').block, 0.09, 'gas block at mood 0.9'); near(o('gas').delay, 0.27, 'gas delay at mood 0.9');
    near(o('gas', true, true).block, 0.0675, 'gas crash + community block');
    near(o('rent').block + o('rent').delay, 0, 'rent has no opposition');
    LOCAL_MOOD.dcNimby = 100;
    near(o('gas', true).block, 0.3, 'gas crash block at mood 2'); near(o('gas', true).delay, 0.6, 'gas crash delay at mood 2 (≤ 0.9 − block)');
    check(oppositionLevel(0.03) === 'low' && oppositionLevel(0.05) === 'medium' && oppositionLevel(0.1) === 'high', 'opposition levels');
  }

  // Block: blocked sites leave the queue and keep what was paid as spent
  {
    const t = fresh(7);
    LOCAL_MOOD.dcNimby = 100;
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
}

// ── DC-4: Build action: the preview equals the site it makes; lever effects; community package (DATACENTERS §5) ──
{
  const fresh = (nimby = 0) => {
    const s = game({ seed: 1 });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = nimby;
    return s;
  };
  const qOfDay = (s: GameStateV2, d: number) => quarterIndex(s.time.startDate, d);
  const tgt = (x: { target?: string }) => x.target ?? '';

  // 1. Preview = the site it makes: every source x building size x buildings (1 GW at most per building) x lever
  //    combination (dcNimby 0: no rolls). Refused combinations (campus over the source cap) create nothing.
  const PATHS = ['rent', 'grid', 'gas'] as const;
  const LEV = ['crash', 'rush', 'fastTrack', 'community'] as const;
  let cases = 0, bad = 0, refused = 0;
  for (const path of PATHS) {
    for (const mw of [300, 1000]) {
      for (const buildings of path === 'rent' ? [1] : [1, 3, 5]) {
        for (let m = 0; m < (path === 'rent' ? 2 : 16); m++) {
          const p: Record<string, number | string | boolean> = { path, mw, buildings, pay: 'cash' };
          LEV.forEach((k, i) => { p[k] = !!(m & (1 << i)); });
          const s = fresh();
          const q0 = qOfDay(s, s.time.day);
          const n0 = s.player.sites.length;
          const v = actionView(s, 'cmp.newSite', p);
          const err = act(s, 'cmp.newSite', p);
          if (mw * buildings > SOURCES[path].maxMW) {
            refused++;
            if (!(typeof err === 'string' && s.player.sites.length === n0)) { bad++; console.log(`FAIL ${path} ${buildings} x ${mw} MW should be refused`); }
            continue;
          }
          const capexPrev = path === 'rent' ? -v.costs[1].amount : -v.costs[0].amount;
          const lagQ = v.gains[0].lagDays! / 91;
          const x = s.player.sites[s.player.sites.length - 1];
          let live = -1;
          const ctx = makeCtx(s);
          for (let q = q0 + 1; q <= q0 + 60 && live < 0; q++) {
            s.time.day = dayOfQuarter(s.time.startDate, q);
            sitesQSystem.run(s, ctx);
            if (x.stage === 'live') live = q; // the first building
          }
          const ok = !err && Math.abs(capexPrev - x.capex) < 1e-9 && live - q0 === lagQ && x.mw === mw * buildings
            && (path !== 'rent' || Math.abs(v.costs[0].amount + (mw / 1000) * 1.8) < 1e-9);
          cases++;
          if (!ok) { bad++; console.log(`FAIL ${path} ${buildings} x ${mw} MW levers ${m}: preview capex ${capexPrev} vs ${x?.capex}, lag ${lagQ} q vs live ${live - q0} q, err ${err}`); }
        }
      }
    }
  }
  check(bad === 0, `preview capex and first live quarter equal the created site's in all ${cases} cases (${refused} refused)`, `${bad} bad`);

  // 2. Worked numbers (Q3 26, dcNimby 58.8, start state).
  {
    const s = fresh(58.8);
    const p = { path: 'gas', mw: 1000, rush: true, community: true, pay: 'cash' };
    const v = actionView(s, 'cmp.newSite', p);
    near(-v.costs[0].amount, 18.9, 'gas 1 GW rush + community: preview capex');
    near(v.costs[0].lagDays!, 1092, 'preview lag days (12 q)');
    near(v.gains[0].lagDays!, 1092, 'gain lag days');
    const o: SiteOpts = { path: 'gas', mw: 1000, rush: true, community: true };
    const e = leverEffects(s, o);
    near(e.crash!.savesQ, 5, 'crash saves (2 + max(5, 4) = 7 vs 12)');
    near(e.crash!.cost, 4.9, 'crash price');
    near(e.rush!.savesQ, 0, 'rush saves (12 without it: construction binds at 1 GW)');
    near(e.rush!.cost, 0.9, 'rush price (30% of 3 per GW)');
    near(e.fastTrack!.savesQ, 1, 'fast-track saves (1 + 10 = 11)');
    near(e.fastTrack!.cost, 0.7, 'fast-track price');
    near(e.community!.cost, 1.0, 'community price');
    near(e.community!.savesQ, 0, 'community saves');
    near(e.community!.blockMult!, 0.5, 'community block multiplier');
    check(e.rush!.on && e.community!.on && !e.crash!.on && !e.fastTrack!.on, 'on flags follow the toggles');
    near(siteLiveInQ(s, { ...o, crash: true }), 7, 'live in 7 q with crash');
    check(Object.keys(leverEffects(s, { path: 'rent', mw: 500 })).length === 0, 'rent has no levers');
    const od = oppositionOdds(s, { path: 'gas', crash: false, communityPackage: true });
    near(od.block, 0.1 * 1.176 * 0.5, 'block odds 0.10 x 1.176 x 0.5');
    near(od.delay, 0.3 * 1.176, 'delay odds 0.30 x 1.176');
    const blk = v.exposure.find((x) => tgt(x).startsWith('blocked'))!, dl = v.exposure.find((x) => tgt(x).startsWith('delayed'))!;
    near(blk.probability!, 0.06, 'preview block probability (rounded to 2 places)');
    near(dl.probability!, 0.35, 'preview delay probability');
    const v2 = actionView(s, 'cmp.newSite', { ...p, crash: true });
    near(-v2.costs[0].amount, 18.9 + 4.9, 'with crash: preview capex = +4.9');
    near(v2.gains[0].lagDays!, 7 * 91, 'with crash: lag 7 q');
    const r = actionView(s, 'cmp.newSite', { path: 'rent', mw: 1000 });
    near(r.costs[0].amount, -1.8, 'rent 1 GW: rent per year (RENT.perGWYear)');
    check(/× 5/.test(tgt(r.costs[0])), 'rent line says x 5', tgt(r.costs[0]));
    const cap = (mw: number) => -actionView(s, 'cmp.newSite', { path: 'gas', mw, community: false }).costs[0].amount;
    near(cap(10), cap(100), 'size below 100 MW is clamped to 100');
  }

  // 3. Community action: $1B per GW of the campus, preview = effect.
  {
    const s = fresh();
    act(s, 'cmp.newSite', { path: 'gas', mw: 1000, buildings: 3, community: false });
    const x = s.player.sites[s.player.sites.length - 1];
    const before = x.capex;
    const v = actionView(s, 'cmp.community', { siteId: x.id });
    near(-v.costs[0].amount, 3, 'community preview on a 3 x 1 GW campus');
    check(tgt(v.costs[0]).includes('$1B per GW on 1 site'), 'community text', tgt(v.costs[0]));
    check(act(s, 'cmp.community', { siteId: x.id }) === undefined, 'community applies');
    near(x.capex - before, 3, 'community apply adds $1B per GW to the site');
    check(x.communityPackage, 'site flagged');
  }
  {
    const s = fresh();
    act(s, 'cmp.newSite', { path: 'grid', mw: 300, buildings: 3, community: false });
    act(s, 'cmp.newSite', { path: 'gas', mw: 1000, buildings: 3, community: false });
    const permitting = s.player.sites.filter((x) => x.stage === 'permitting' && !x.communityPackage && !x.ws3.rolled && x.path !== 'rent');
    const v = actionView(s, 'cmp.community', {});
    const before = s.player.sites.reduce((a, x) => a + x.capex, 0);
    act(s, 'cmp.community', {});
    const delta = s.player.sites.reduce((a, x) => a + x.capex, 0) - before;
    near(-v.costs[0].amount, delta, `company-wide preview = capex added on ${permitting.length} sites`);
    near(delta, permitting.reduce((a, x) => a + x.mw / 1000, 0), 'and that is $1B per GW');
    check(tgt(v.costs[0]).includes(`$1B per GW on ${permitting.length} sites`), 'text', tgt(v.costs[0]));
  }
}

// ── DC-5: Start sites and start ledgers on rent / grid / gas ([D-10], [D-12]); no building above 1 GW ──
{
  for (const start of ['leader', 'safety', 'bigtech', 'breakaway'] as LabKindId[]) {
    const s = game({ seed: 1, labKind: start });
    const t0 = s.time.startDate;
    console.log(`-- ${start}`);
    for (const x of s.player.sites) {
      const lq = siteLiveQ(s, x);
      const liveDate = x.stage === 'live' ? new Date(dateOfDay(t0, x.ws3.liveDay ?? 0)).toISOString().slice(0, 10) : lq ? `q${lq.q}` : '-';
      console.log(`   ${x.id} ${x.name}: ${x.path} ${x.mw} MW ${x.stage}, live ${liveDate} (q ${lq?.q}), capex ${x.capex} paid ${x.capexPaid}`);
      check(['rent', 'grid', 'gas'].includes(x.path), `${x.id} source`, x.path);
      check(x.mw >= SITE_MIN_MW && x.mw <= SOURCES[x.path].maxMW, `${x.id} size within caps`, `${x.mw} MW, max ${SOURCES[x.path].maxMW}`);
      const bmw = x.ws3.buildingMW ?? x.mw;
      check(bmw <= SITE_TIERS[SITE_TIERS.length - 1].mw && (x.ws3.buildings ?? 1) * bmw === x.mw, `${x.id} no building above 1 GW`, `${x.ws3.buildings ?? 1} x ${bmw} MW`);
      if (x.stage === 'live') check(x.ws3.liveDay !== undefined && x.ws3.liveDay <= 0, `${x.id} live has liveDay`);
    }
    const rents = s.player.finance.ledger.filter(l => l.payee === 'Data-centre rent');
    const rentMW = s.player.sites.filter(x => x.path === 'rent').reduce((a, x) => a + x.mw, 0);
    near(rents.reduce((a, l) => a + l.perQuarter, 0), (rentMW / 1000) * RENT.perGWYear / 4, `${start} rent ledger = rent MW x price`);
    check(!s.player.finance.ledger.some(l => /lease-S|Colocation/.test(l.id + l.payee)), `${start} no old lease entries`);
    if (start === 'leader') {
      const [s1, s2, s3, s4] = s.player.sites;
      check(s1.path === 'rent' && s1.mw === 300 && s1.ws3.powerQ === 1, 'S1 rent 300');
      near(s2.capex, 4.26, 'S2 capex'); near(s3.capex, 12, 'S3 capex'); near(s3.capexPaid, 6, 'S3 paid');
      check(s3.path === 'gas' && s3.stage === 'building', 'S3 gas building');
      check(s3.mw === 1200 && s3.ws3.buildings === 4 && s3.ws3.buildingMW === 300 && s3.ws3.liveDays?.length === 4 && s3.ws3.liveDays.every((d) => d === s3.ws3.liveAt) && s3.ws3.liveAt === dayOfDate(s.time.startDate, '2026-04-01'), 'S3 Lone Pine is a 4 x 300 MW campus, 1.2 GW, all four buildings live together in Apr 2026');
      check(siteBuildQ({ path: 'gas', mw: 300 }) === s3.ws3.buildQ, 'S3 construction quarters = one 300 MW building', `${s3.ws3.buildQ} q`);
      {
        // Lone Pine to go-live: the remaining $6B in equal quarterly parts, as before, live as one 1.2 GW block in Apr 2026
        const g = game({ seed: 1 });
        const lp = g.player.sites[2], ctx = makeCtx(g);
        const pays: number[] = [];
        let liveMW = -1;
        for (let q = 1; q <= 4; q++) {
          g.time.day = dayOfQuarter(g.time.startDate, q);
          const before = lp.capexPaid;
          sitesQSystem.run(g, ctx);
          if (lp.capexPaid > before) pays.push(lp.capexPaid - before);
          if (liveMW < 0 && lp.stage === 'live') liveMW = siteLiveMW(lp, g.time.day);
        }
        check(pays.length === 2 && pays.every((p) => Math.abs(p - 3) < 1e-9) && Math.abs(lp.capexPaid - lp.capex) < 1e-9, 'S3 pays its remaining $6B in two equal quarters, as one building did', pays.map((p) => p.toFixed(3)).join(' '));
        check(lp.stage === 'live' && liveMW === 1200, 'S3 goes live in Apr 2026 with all 1.2 GW at once', `stage ${lp.stage}, live ${liveMW} MW`);
      }
      check(s4.path === 'grid' && s4.mw === 1000 && s4.stage === 'power' && s4.ws3.rolled && s4.ws3.powerQ === 17 && s4.ws3.buildQ === 8, 'S4 Red River 1 GW grid power stage, rolled, 17 q');
      near(s4.capexPaid, 0.05 * s4.capex, 'S4 paid 5%');
      const lq = siteLiveQ(s, s4)!;
      const idx = (2029 - 2025) * 4 + (4 - 3) ; // Q4 29 relative to Q3 25 = 17
      check(lq.q === idx && lq.firm, 'Red River live Q4 29', `q ${lq.q}, want ${idx}`);
      const y = decimalYear(s);
      near(worldWaitQ(s, 'grid'), 19 + 4 * 1 / rateGWPerYear('grid', y), 'grid wait at start = 19 + 4/rate', 1e-9);
      console.log(`   grid wait ${worldWaitQ(s, 'grid').toFixed(3)} q, gas ${worldWaitQ(s, 'gas').toFixed(3)}, rent ${worldWaitQ(s, 'rent').toFixed(3)}`);
      near(rents[0].perQuarter, 0.3 * 1.8 / 4, 'L-rent-S1 per quarter');
      check(rents[0].id === 'L-rent-S1', 'ledger id L-rent-S1');
    }
  }
}

// ── DC-6: Stored chips keep their book value (no 6% a quarter decay) ──
{
  const s = game();
  const fx = s.player.finance.ws3!;
  fx.inventory.ready = 1000;
  fx.inventory.transit = 0;
  fx.inventory.book = 1000;
  const ctx = makeCtx(s);
  for (let i = 1; i <= 4; i++) {
    clearMarket(s, ctx);
    const ok = fx.inventory.book === 1000;
    check(ok, `quarter ${i}: stored-chip book unchanged`, `${fx.inventory.book} (was 1000)`);
  }
}

// ── DC-7: Reference bot: its sites on the three sources, buildings and campuses ──
{
  const TIER_MAX = Math.max(...SITE_TIERS.map((t) => t.mw));


  // the build action clamps one building to the largest tile (1 GW): a 5 GW request is one 1 GW building
  {
    const g = game({ seed: 1 });
    const g0 = game({ seed: 1 });
    const before = g.player.sites.length;
    const err = act(g, 'cmp.newSite', { path: 'gas', mw: 5000, pay: 'cash' });
    const x = g.player.sites[g.player.sites.length - 1];
    check(err === undefined && g.player.sites.length === before + 1 && x.mw === TIER_MAX && (x.ws3.buildings ?? 1) === 1, 'cmp.newSite mw 5000 builds one 1 GW building', `mw ${x.mw}`);
    const g2 = game({ seed: 1 });
    act(g2, 'cmp.newSite', { path: 'gas', mw: 5000, buildings: 5, pay: 'cash' });
    const y = g2.player.sites[g2.player.sites.length - 1];
    check(y.mw === 5 * TIER_MAX && y.ws3.buildingMW === TIER_MAX, 'mw 5000 x 5 buildings = 5 x 1 GW', `mw ${y.mw}, building ${y.ws3.buildingMW}`);
    check(g.player.sites.slice(0, before).every((z, i) => z.mw === g0.player.sites[i].mw), 'start sites untouched');
  }

  const s = game({ seed: 1 });
  const end = dayOfDate(s.time.startDate, '2026-10-01'); // five quarters: it has built five sites by then
  const startIds = new Set(s.player.sites.map((x) => x.id));
  const qName = (q: number) => { const y = 2025 + Math.floor((q + 2) / 4); return `Q${((q + 2) % 4) + 1} ${String(y).slice(2)}`; }; // game starts Q3 2025 (q index 0)
  let guard = 0;
  if (SMOKE) refBot.act(s, engine); // quick: its first decision round on the start state (it builds three sites at once); the five-quarter game is the full tier
  while (!SMOKE && !s.ending && s.time.day < end && guard++ < 5000) {
    for (const p of [...s.events.pending]) {
      if (resolve(s, p.instance, refBot.decide(s, p))) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    refBot.act(s, engine);
    tick(s);
  }
  console.log(`ref bot, seed 1, ${SMOKE ? 'first decision round' : `ended ${s.ending ? 'early' : 'at day ' + s.time.day} (${qName(quarterIndex(s.time.startDate, s.time.day))})`}`);

  const built = s.player.sites.filter((x) => !startIds.has(x.id));
  console.log(`sites built: ${built.length}`);
  const nOf = (x: (typeof built)[number]) => x.ws3.buildings ?? 1;
  const bMW = (x: (typeof built)[number]) => x.ws3.buildingMW ?? x.mw / nOf(x);
  for (const x of built) {
    const lv = [x.crash && 'crash', x.ws3.rush && 'rush', x.ws3.fastTrack && 'fast-track', x.communityPackage && 'community'].filter(Boolean).join('+') || 'none';
    const l = siteBuildingLiveQs(s, x);
    const live = l ? (l.qs[0] === l.qs[l.qs.length - 1] ? qName(l.qs[0]) : `${qName(l.qs[0])} to ${qName(l.qs[l.qs.length - 1])}`) : 'blocked';
    const committed = quarterIndex(s.time.startDate, x.ws3.startDay);
    console.log(`  ${x.id} ${x.path.padEnd(4)} ${String(bMW(x)).padStart(4)} MW x ${nOf(x)} (${(x.mw / 1000).toFixed(2)} GW)  levers ${lv.padEnd(34)} committed ${qName(committed)}  live ${live}  stage ${x.stage}  capex ${x.capex.toFixed(1)}`);
  }
  check(built.length > 0, 'the bot built at least one site');
  if (!SMOKE) check(built.length >= 4, 'over five quarters the bot keeps building (four or more sites)', `${built.length}`);
  check(built.every((x) => (['rent', 'grid', 'gas'] as const).includes(x.path)), 'every source is rent, grid or gas');
  check(built.every((x) => x.mw >= SITE_MIN_MW - 1e-9 && x.mw <= SOURCES[x.path].maxMW + 1e-9), 'every size is within [100 MW, source cap]');
  check(built.every((x) => bMW(x) <= TIER_MAX + 1e-9), 'every building is at most 1 GW');
  check(built.every((x) => SITE_TIERS.some((t) => t.mw === bMW(x)) && (CAMPUS.counts as readonly number[]).includes(nOf(x)) && (x.path !== 'rent' || nOf(x) === 1)), 'every building is a tier size, in 1, 3 or 5 buildings (rent: one hall)');
  check(built.every((x) => x.path !== 'rent' || (!x.crash && !x.ws3.rush && !x.ws3.fastTrack && !x.communityPackage)), 'rent sites carry no levers');
  const campuses = built.filter((x) => nOf(x) > 1);
  console.log(`campuses (3 or 5 buildings): ${campuses.length} of ${built.length} sites; capex total ${built.reduce((a, x) => a + x.capex, 0).toFixed(1)} $B`);
  const sources = new Set(built.map((x) => x.path));
  console.log(`sources used: ${[...sources].join(', ')}`);
}

// ── DC-12: Construction time and cost by building size; a rushed gas site is in the turbine backlog (§5b) ──
{
  const fresh = () => {
    const s = game({ seed: 1 });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = 0; // no opposition rolls
    return s;
  };

  // 1. Construction quarters by size, normal / crash (grid and gas have the same 9.5 q reference).
  const Q: [number, number, number][] = [[100, 4, 2], [300, 6, 3], [500, 7, 4], [1000, 10, 5]];
  for (const path of ['grid', 'gas'] as const) {
    for (const [mw, n, c] of Q) {
      near(siteBuildQ({ path, mw }), n, `${path} ${mw} MW construction q`);
      near(siteBuildQ({ path, mw, crash: true }), c, `${path} ${mw} MW construction q, crash`);
    }
  }
  near(siteBuildQ({ path: 'rent', mw: 1000 }), 0, 'rent needs no construction');
  near(siteBuildQ({ path: 'rent', mw: 1000, crash: true }), 0, 'rent ignores crash');

  // 2. Capex by size: one building, no size economy since DC-13 (the saving is the campus repetition discount, DC-13 below).
  near(siteCapex({ path: 'gas', mw: 1000, rush: true, community: true }), 18.9, 'gas 1 GW rush + community capex');
  near(siteCapex({ path: 'gas', mw: 1000 }), 14 + 3, 'gas 1 GW no levers capex', 0.01);
  near(siteCapex({ path: 'grid', mw: 100 }), 0.1 * (14 + 0.2), 'grid 0.1 GW no levers capex', 0.001);
  near(siteCapex({ path: 'gas', mw: 1000, crash: true }), 14 + 3 + 0.35 * 14, 'gas 1 GW crash capex', 0.01);
  near(siteCapex({ path: 'gas', mw: 1000, fastTrack: true }) - siteCapex({ path: 'gas', mw: 1000 }), 0.05 * 14, 'fast-track = 5% of the building', 1e-9);
  near(siteCapex({ path: 'gas', mw: 1000, rush: true }) - siteCapex({ path: 'gas', mw: 1000 }), 0.3 * 3, 'rush is unscaled (30% of the turbines)', 1e-9);
  near(siteCapex({ path: 'rent', mw: 1000 }), 4, 'rent network fit-out is unscaled', 1e-9);

  // 3. (Preview = effect over the sizes x crash grid is the DC-13 sweep below, which now includes 100 / 300 / 500 / 1000 MW.)

  // 4. A rushed gas site counts in the turbine backlog until its power is ready.
  {
    const s = fresh();
    const ctx = makeCtx(s);
    const before = pendingGW(s.player.sites, 'gas', s.time.day);
    const site = newSite(s, ctx, { path: 'gas', mw: 1000, buildings: 3, rush: true });
    near(pendingGW(s.player.sites, 'gas', s.time.day) - before, 3, 'rushed 3 GW gas campus is in the backlog', 1e-9);
    check(site.ws3.rush === true, 'the site is rushed');
  }
}

// ── DC-13: Campuses of 1 / 3 / 5 buildings, phased go-live, repetition discount (§5b) ──
{
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

  const fresh = () => {
    const s = game({ seed: 1 });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = 0; // no opposition rolls
    return s;
  };
  const q0Of = (s: GameStateV2) => quarterIndex(s.time.startDate, s.time.day);

  /** Step sitesQ quarter by quarter until every building of `x` is live; the quarter (relative to q0) each building
   *  went live, read from siteLiveMW, and the capex paid per quarter. */
  function runSite(s: GameStateV2, x: Site, q0: number, onQ?: (q: number) => void) {
    const ctx = makeCtx(s);
    const n = x.ws3.buildings ?? 1, bmw = x.ws3.buildingMW ?? x.mw;
    const lives: number[] = [];
    const paid: number[] = [];
    for (let q = q0 + 1; q <= q0 + 80 && lives.length < n && x.stage !== 'blocked'; q++) {
      s.time.day = dayOfQuarter(s.time.startDate, q);
      const before = x.capexPaid;
      sitesQSystem.run(s, ctx);
      paid.push(x.capexPaid - before);
      const k = Math.round(siteLiveMW(x, s.time.day) / bmw);
      while (lives.length < k) lives.push(q - q0);
      onQ?.(q);
    }
    return { lives, paid };
  }

  // 1. Worked numbers (Q3 2026, grid wait 20, turbine wait 9, no levers unless stated).
  {
    const s = fresh();
    console.log(`     waits: grid ${worldWaitQ(s, 'grid').toFixed(2)} q, turbines ${worldWaitQ(s, 'gas').toFixed(2)} q`);
    const gas5: SiteOpts = { path: 'gas', mw: 1000, buildings: 5 };
    near(siteCapex(gas5), 74.5, 'gas 5 x 1 GW capex (5 x 14 x 0.85 + 5 x 3)');
    check(same(siteBuildingLiveInQ(s, gas5), [12, 13, 14, 15, 16]), 'gas 5 x 1 GW buildings live at +12..16 q', siteBuildingLiveInQ(s, gas5).join(', '));
    const gas1: SiteOpts = { path: 'gas', mw: 1000, buildings: 1 };
    near(siteCapex(gas1), 17, 'gas 1 x 1 GW capex');
    check(same(siteBuildingLiveInQ(s, gas1), [12]), 'gas 1 x 1 GW live at +12 q', siteBuildingLiveInQ(s, gas1).join(', '));
    const grid3: SiteOpts = { path: 'grid', mw: 300, buildings: 3 };
    near(siteCapex(grid3), 0.9 * 14 * 0.9 + 0.18, 'grid 3 x 300 MW capex (0.9 x 14 x 0.9 + 0.18 = 11.52)');
    check(same(siteBuildingLiveInQ(s, grid3), [21, 21, 21]), 'grid 3 x 300 MW all live at +21 q (power binds)', siteBuildingLiveInQ(s, grid3).join(', '));
    near(siteCapex({ path: 'gas', mw: 1000, rush: true, community: true }), 18.9, 'gas 1 GW rush + community, one building');
    near(siteCapex({ path: 'gas', mw: 1000, buildings: 5, crash: true }) - siteCapex(gas5), 5 * 0.35 * 14 * 0.85, 'crash = 35% of the discounted building');
    near(siteCapex({ path: 'gas', mw: 1000, buildings: 5, rush: true, community: true }) - siteCapex(gas5), 5 * (0.9 + 1), 'rush and community per GW, undiscounted');
    // refused: grid 5 x 300 MW = 1.5 GW > 1 GW
    const n0 = s.player.sites.length;
    const v = actionView(s, 'cmp.newSite', { path: 'grid', mw: 300, buildings: 5 });
    const err = act(s, 'cmp.newSite', { path: 'grid', mw: 300, buildings: 5 });
    check(typeof err === 'string' && s.player.sites.length === n0, 'grid 5 x 300 MW refused', String(err));
    check(v.gains.length === 0 && /cannot build/.test(v.costs[0]?.target ?? ''), 'its preview says why', v.costs[0]?.target);
    const e2 = act(s, 'cmp.newSite', { path: 'gas', mw: 1000, buildings: 2 });
    check(typeof e2 === 'string' && s.player.sites.length === n0, 'buildings 2 refused', String(e2));
    const fx = leverEffects(s, { ...gas5, rush: true });
    console.log(`     5 x 1 GW gas, rush on: crash saves ${fx.crash?.savesQ} q (first) / ${fx.crash?.savesLastQ} q (last), +$${fx.crash?.cost.toFixed(2)}B`);
  }

  // 2. Preview = effect sweep: source x building size x buildings x crash. Preview capex and per-building live quarters
  //    equal the created site's; refused combinations create nothing.
  {
    let cases = 0, bad = 0, refused = 0;
    for (const path of ['rent', 'grid', 'gas'] as const) for (const mw of [100, 300, 500, 1000]) for (const buildings of [1, 3, 5]) for (const crash of [false, true]) {
      if (path === 'rent' && (buildings > 1 || crash)) continue;
      const p = { path, mw, buildings, crash, pay: 'cash', community: false };
      const s = fresh();
      const q0 = q0Of(s);
      const v = actionView(s, 'cmp.newSite', p);
      const n0 = s.player.sites.length;
      const err = act(s, 'cmp.newSite', p);
      const total = mw * buildings;
      const cap = path === 'gas' ? 5000 : 1000;
      if (total > cap) {
        refused++;
        if (!(typeof err === 'string' && s.player.sites.length === n0 && v.gains.length === 0)) { bad++; console.log(`FAIL ${path} ${buildings} x ${mw} MW should be refused`); }
        continue;
      }
      const x = s.player.sites[s.player.sites.length - 1];
      const capexPrev = path === 'rent' ? -v.costs[1].amount : -v.costs[0].amount;
      const prevQ: number[] = [];
      for (const g of v.gains) { const k = Math.round((g.amount * s.power.kWPerH100e) / 1000 / mw); for (let i = 0; i < k; i++) prevQ.push(g.lagDays! / 91); }
      const paid0 = x.capexPaid;
      const { lives } = runSite(s, x, q0);
      const ok = !err && Math.abs(capexPrev - x.capex) < 1e-9 && same(prevQ, lives) && x.mw === total
        && Math.abs(x.capexPaid - x.capex) < 1e-6 && Math.abs(paid0 - 0.05 * x.capex) < 1e-9
        && (path === 'rent' || x.ws3.buildQ === siteBuildQ({ path, mw, crash }));
      cases++;
      if (!ok) { bad++; console.log(`FAIL ${path} ${buildings} x ${mw} MW crash ${crash}: capex ${capexPrev} vs ${x.capex}, live ${prevQ.join(',')} vs ${lives.join(',')}, paid ${x.capexPaid} of ${x.capex}, err ${err}`); }
    }
    check(bad === 0, `preview capex and every building's live quarter equal the created site's (${cases} built, ${refused} refused)`, `${bad} bad`);
  }

  // 3. A 5 x 1 GW gas campus: racks, installed chips, online compute and the power bill rise building by building;
  //    the forecast shows one 1 GW go-live per quarter; capex: 5% now, each building's 95% / 5 over its 10 quarters.
  {
    const s = fresh();
    const ctx = makeCtx(s);
    const q0 = q0Of(s);
    const x = newSite(s, ctx, { path: 'gas', mw: 1000, buildings: 5, community: false });
    const fc2 = computeForecast(s, 10);
    const evs = fc2.later.filter((l) => l.ev.kind === 'siteLive' && l.ev.name === x.name);
    check(evs.length === 5 && evs.every((l, i) => l.q === q0 + 12 + i && l.ev.kind === 'siteLive' && l.ev.mw === 1000),
      'forecast: five 1 GW go-lives at +12..16 q', evs.map((l) => `${l.q - q0}:${l.ev.kind === 'siteLive' ? l.ev.mw : 0}`).join(' '));
    near(x.capexPaid, 0.05 * 74.5, '5% of the campus paid at commitment');
    s.player.finance.ws3.inventory.ready = 1e9; // plenty of chips waiting for racks
    const rows: string[] = [];
    let rising = true, prevOnline = 0, prevMW = 0;
    const { lives, paid } = runSite(s, x, q0, (q) => {
      const mw = siteLiveMW(x, s.time.day);
      const online = ownedOnline(s);
      if (mw > prevMW) {
        const full = Math.abs(x.installed - siteCapacityH(s, mw)) < 1e-3;
        if (!(online > prevOnline && full)) rising = false;
        rows.push(`+${q - q0}: ${mw / 1000} GW live, ${(x.installed / 1e6).toFixed(2)}M H100e installed, online ${(online / 1e6).toFixed(2)}M, bill $${powerAndOMPerYear(s).toFixed(2)}B/yr, racks free ${chipFit(s).free.toFixed(0)}`);
        prevOnline = online; prevMW = mw;
      } else if (mw > 0 && Math.abs(x.installed - siteCapacityH(s, mw)) > 1e-3 && x.installed > siteCapacityH(s, mw)) rising = false;
    });
    for (const r of rows) console.log(`     ${r}`);
    check(same(lives, [12, 13, 14, 15, 16]), 'buildings live at +12..16 q in the engine', lives.join(', '));
    check(rising && rows.length === 5, 'racks, installed chips and online compute rise with each building');
    check(x.stage === 'live' && x.ws3.liveDay === dayOfQuarter(s.time.startDate, q0 + 12), 'site live from the first building');
    const share = (0.95 * 74.5) / 5 / 10;
    const p = paid.map((y) => +y.toFixed(4));
    console.log(`     payments by quarter: ${p.join(' ')}`);
    near(paid[1], share, 'first construction quarter pays one building\'s part (95% x 74.5 / 5 / 10)', 1e-9);
    near(paid[5], 5 * share, 'five buildings under construction pay five parts', 1e-9);
    near(x.capexPaid, 74.5, 'all capex paid by the last building', 1e-6);
  }
}

// ── DC-15: A leased campus starts one financing lease per building, when that building goes live ──
{
  const rel = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const RATE = 0.09;

  const fresh = () => {
    const s = game({ seed: 1 });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = 0; // no opposition rolls
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
  {
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
    check(rel(principal, capex * CAPEX_LEASE.siteShare) && by.every((x) => x > principal / 5 * 0.99), 'the lessor paid 80% of capex in all; each building funded about a fifth (plus its own interest)', `paid ${principal.toFixed(3)}`);
    check(by[0] < by[4] && by.every((x, k) => k === 0 || x >= by[k - 1] - 1e-9), 'later buildings carry more interest (they wait longer)', '');
    const booked = ledger.reduce((a, c) => a + c.perQuarter * 4, 0);
    check(rel(booked, lease.perYear), 'preview lease per year = booked ledger sum', `${lease.perYear.toFixed(4)} vs ${booked.toFixed(4)}`);
    check(rel(booked * years + capex * (1 - CAPEX_LEASE.siteShare), lease.total), 'preview lease total = booked payments + your 20%', `${lease.total.toFixed(4)}`);
    const f = pv.pv.cash! / capex; // cash PV of 1 of capex, the preview's cash-schedule factor
    const leasePV = pv.pv.lease! - capex * (1 - CAPEX_LEASE.siteShare) * f;
    check(rel(leasePV, bookedLeasePV(s, q0, ledger)), 'preview lease PV = PV of the booked ledger', `${leasePV.toFixed(4)} vs ${bookedLeasePV(s, q0, ledger).toFixed(4)}`);
  }

  // 1b. Power-bound grid campus (all three buildings live in the same quarter): three entries on the same day, preview = ledger.
  {
    const { ledger, lease, site } = run({ path: 'grid', mw: 300, buildings: 3 });
    const booked = ledger.reduce((a, c) => a + c.perQuarter * 4, 0);
    check(ledger.length === 3 && ledger.every((c) => c.startDay === site.ws3.liveDays![0]) && rel(booked, lease.perYear), 'grid 3 x 300 MW: three leases on the same day, preview = ledger', `${booked.toFixed(4)} vs ${lease.perYear.toFixed(4)}`);
  }

  // 2. A leased single 1 GW site: exactly what it was before DC-15 (values computed on the DC-13 base commit).
  {
    const o: SiteOpts = { path: 'gas', mw: 1000 };
    const { site, lease, pv, ledger, capex } = run(o);
    const l = ledger[0];
    const W = { capex: 17, perQuarter: 0.4792961399241214, startDay: 1461, endDay: 6936, funded: 15.453827398240671, total: 32.15776839544727, perYear: 1.9171845596964847, now: 3.3999999999999995, pvLease: 15.580499915866033, pvCash: 14.916487775795622 };
    check(ledger.length === 1 && l.id === siteLeaseId(site.id), 'single building: one entry, today\'s id', l?.id);
    const got = { capex, perQuarter: l.perQuarter, startDay: l.startDay, endDay: l.endDay, funded: site.ws3.lease!.funded, total: lease.total, perYear: lease.perYear, now: lease.now, pvLease: pv.pv.lease, pvCash: pv.pv.cash } as Record<string, number>;
    for (const k of Object.keys(W) as (keyof typeof W)[]) check(Math.abs(got[k] - W[k]) <= 1e-9 * Math.max(1, Math.abs(W[k])), `single 1 GW leased: ${k} unchanged`, `${got[k]} want ${W[k]}`);
  }
}

// ── DC-17: The numbers the build card and site rows show: capex parts, siteFit, opposition parts, buildings view ──
{
  const fresh = (nimby = 0) => {
    const s = game({ seed: 1 });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = nimby;
    return s;
  };
  const q0Of = (s: GameStateV2) => quarterIndex(s.time.startDate, s.time.day);

  /** The capex formula as it stood before DC-17 (per GW of the campus, summed in that order), kept here only to show
   *  the refactor changed nothing. */
  function capexBefore(o: SiteOpts): number {
    const rent = o.path === 'rent';
    const x = rent ? { ...o, crash: false, rush: false, fastTrack: false, community: false } : o;
    const src = SOURCES[o.path];
    const n = rent ? 1 : o.buildings ?? 1;
    const rush = x.rush ? (o.path === 'grid' ? 0.3 : o.path === 'gas' ? 0.3 * src.extraPerGW : 0) : 0;
    const building = rent ? src.upfrontPerGW : src.upfrontPerGW * (1 - (CAMPUS.discount[n as 1 | 3 | 5] ?? 0));
    const perGW = building + src.extraPerGW + (x.crash ? 0.35 * building : 0) + rush + (x.fastTrack ? 0.05 * building : 0) + (x.community ? 1 : 0);
    return ((o.mw * n) / 1000) * perGW;
  }

  // 1. Capex parts sum to siteCapex over the DC-13 sweep; the old formula gives the same number.
  {
    let cases = 0, bad = 0;
    for (const path of ['rent', 'grid', 'gas'] as const) for (const mw of [100, 300, 1000]) for (const buildings of [1, 3, 5] as const)
      for (const crash of [false, true]) for (const rush of [false, true]) for (const fastTrack of [false, true]) for (const community of [false, true]) {
        const o: SiteOpts = { path, mw, buildings, crash, rush, fastTrack, community };
        if (path === 'rent' && buildings > 1) continue;
        const p = siteCapexParts(o);
        const sum = p.building - p.repeatSaving + p.extra + p.crash + p.rush + p.fastTrack + p.community;
        cases++;
        if (Math.abs(sum - siteCapex(o)) > 1e-9 || siteCapex(o) !== p.total || Math.abs(siteCapex(o) - capexBefore(o)) > 1e-12 || p.repeatSaving < 0) {
          bad++; console.log(`FAIL ${JSON.stringify(o)}: parts ${sum} total ${p.total} before ${capexBefore(o)}`);
        }
      }
    check(bad === 0, `capex parts sum to siteCapex and equal the old formula (${cases} cases)`, `${bad} bad`);
    const g = siteCapexParts({ path: 'gas', mw: 1000, buildings: 5 });
    near(g.building, 70, '5b example: gas 5 x 1 GW building');
    near(g.repeatSaving, 10.5, '  repeat saving');
    near(g.extra, 15, '  extra (turbines)');
    near(g.total, 74.5, '  total');
    const r = siteCapexParts({ path: 'rent', mw: 300, crash: true, community: true });
    check(r.crash === 0 && r.community === 0 && r.repeatSaving === 0 && r.total === r.building + r.extra, 'rent: levers and saving are zero');
  }

  // 2. siteFit.
  {
    const f = (o: SiteOpts) => { const r = siteFit(o); return `${r.buildings} x ${r.mw}`; };
    check(f({ path: 'grid', mw: 300, buildings: 5 }) === '3 x 300', 'grid 5 x 300 MW -> 3 x 300 MW', f({ path: 'grid', mw: 300, buildings: 5 }));
    check(f({ path: 'grid', mw: 1000, buildings: 5 }) === '1 x 1000', 'grid 5 x 1 GW -> 1 x 1 GW', f({ path: 'grid', mw: 1000, buildings: 5 }));
    check(f({ path: 'gas', mw: 1000, buildings: 5 }) === '5 x 1000', 'gas 5 x 1 GW unchanged');
    check(f({ path: 'gas', mw: 300, buildings: 3 }) === '3 x 300', 'gas 3 x 300 MW unchanged');
    check(f({ path: 'rent', mw: 300, buildings: 5 }) === '1 x 300', 'rent is one building');
    check(f({ path: 'gas', mw: 20, buildings: 3 }) === '3 x 100', 'gas 3 x 20 MW -> 3 x 100 MW (minimum size)', f({ path: 'gas', mw: 20, buildings: 3 }));
    check(f({ path: 'gas', mw: 9000 }) === '1 x 5000', 'gas 9 GW building clamps to 5 GW');
  }

  // 3. newSite over the sweep builds what siteFit says, with the capex and live days the old clamp gave.
  {
    let cases = 0, bad = 0;
    for (const path of ['rent', 'grid', 'gas'] as const) for (const mw of [50, 100, 300, 1000, 2000]) for (const buildings of [1, 2, 3, 5] as const) for (const crash of [false, true]) {
      if (path === 'rent' && (buildings > 1 || crash)) continue;
      const s = fresh();
      const o: SiteOpts = { path, mw, buildings: buildings as 1 | 3 | 5, crash, rush: !crash, community: path !== 'rent' };
      // the old inline clamp, restated
      const cap = SOURCES[path].maxMW;
      const bmw = Math.max(100, Math.min(cap, mw));
      const n = path === 'rent' ? 1 : [5, 3, 1].find((c) => c <= buildings && c * bmw <= cap + 1e-9) ?? 1;
      const fitted: SiteOpts = { ...o, mw: bmw, buildings: n as 1 | 3 | 5 };
      const lives = siteBuildingLiveInQ(s, fitted);
      const x = newSite(s, makeCtx(s), o);
      cases++;
      const liveOk = path === 'rent' ? x.stageEndDay === dayOfQuarter(s.time.startDate, q0Of(s) + lives[0]) : true;
      if (x.mw !== bmw * n || (x.ws3.buildings ?? 1) !== n || (x.ws3.buildingMW ?? x.mw) !== bmw || Math.abs(x.capex - capexBefore(fitted)) > 1e-9 || !liveOk) {
        bad++; console.log(`FAIL ${path} ${buildings} x ${mw}: site ${x.mw} MW, ${x.ws3.buildings} buildings, capex ${x.capex} vs ${capexBefore(fitted)}`);
      }
    }
    check(bad === 0, `newSite builds siteFit's site with the old capex (${cases} cases)`, `${bad} bad`);
  }

  // 3b. Live days of a built campus: stepped to the end, building k live at the quarter siteBuildingLiveInQ says.
  {
    const s = fresh();
    const ctx = makeCtx(s);
    const q0 = q0Of(s);
    const o: SiteOpts = { path: 'grid', mw: 300, buildings: 5, crash: true }; // fitted to 3 x 300 MW
    const x = newSite(s, ctx, o);
    const want = siteBuildingLiveInQ(s, siteFit(o));
    const got: number[] = [];
    for (let q = q0 + 1; q <= q0 + 40 && got.length < 3; q++) {
      s.time.day = dayOfQuarter(s.time.startDate, q);
      sitesQSystem.run(s, ctx);
      while (got.length < Math.round(siteLiveMW(x, s.time.day) / 300)) got.push(q - q0);
    }
    check(got.join() === want.join(), 'grid 5 x 300 MW request: three buildings live when siteBuildingLiveInQ says', `${got.join(',')} vs ${want.join(',')}`);
  }

  // 4. Opposition parts = odds, with their factors.
  {
    let cases = 0, bad = 0;
    const s = fresh(); // the odds are a pure function of the mood: one state, the mood set per case
    for (const nimby of [0, 45, 60, 100]) for (const path of ['rent', 'grid', 'gas'] as const) for (const crash of [false, true]) for (const communityPackage of [false, true]) {
      LOCAL_MOOD.dcNimby = nimby;
      const site = { path, crash, communityPackage };
      const p = oppositionParts(s, site), o = oppositionOdds(s, site);
      cases++;
      let ok = p.block === o.block && p.delay === o.delay;
      if (path !== 'rent') {
        const b = Math.min(0.5, p.blockBase * p.mood * p.crashMult * p.communityMult);
        ok = ok && Math.abs(b - p.block) < 1e-12 && Math.abs(p.mood - nimby / 50) < 1e-12 && p.crashMult === (crash ? 1.5 : 1) && p.communityMult === (communityPackage ? 0.5 : 1)
          && p.delay <= 0.9 - p.block + 1e-12 && p.blockBase === SOURCES[path].blockBase && p.delayBase === SOURCES[path].delayBase;
      } else ok = ok && p.block === 0 && p.delay === 0;
      if (!ok) { bad++; console.log(`FAIL ${nimby} ${path} crash ${crash} community ${communityPackage}: ${JSON.stringify(p)}`); }
    }
    check(bad === 0, `oppositionParts block/delay = oppositionOdds, factors as spec (${cases} cases)`, `${bad} bad`);
    LOCAL_MOOD.dcNimby = 50;
    const re = oppositionParts(s, { path: 'gas', crash: true, communityPackage: true, ws3: { reactive: true } });
    check(re.delay === 0 && re.mood === 1 && re.crashMult === 1 && re.communityMult === 1 && re.block === re.blockBase && re.block > 0, 'reactive site: base 1 - unblock odds, factors 1', JSON.stringify(re));
    const hi = oppositionParts(fresh(100), { path: 'gas', crash: true, communityPackage: false });
    console.log(`     gas, crash, mood 2.0: block ${hi.block.toFixed(3)} (base ${hi.blockBase} x ${hi.mood} x ${hi.crashMult}), delay ${hi.delay.toFixed(3)}`);
  }

  // 5. siteBuildingsView on a 5 x 1 GW gas campus, quarter by quarter.
  {
    const s = fresh();
    const ctx = makeCtx(s);
    const q0 = q0Of(s);
    const x = newSite(s, ctx, { path: 'gas', mw: 1000, buildings: 5, community: false });
    const bmw = x.ws3.buildingMW as number;
    const buildQ = siteBuildQ({ path: 'gas', mw: 1000 });
    const liveQ = [12, 13, 14, 15, 16].map((d) => q0 + d);
    const rows: string[] = [];
    let ok = true, liveGo = true, prevLive = 0;
    for (let q = q0 + 1; q <= q0 + 20; q++) {
      s.time.day = dayOfQuarter(s.time.startDate, q);
      sitesQSystem.run(s, ctx);
      const v = siteBuildingsView(s, x);
      if (!v) { ok = false; break; }
      const wantLive = liveQ.filter((l) => l <= q).length;
      const wantBuilding = liveQ.filter((l) => l - buildQ <= q && q < l).length;
      if (v.of !== 5 || v.live !== wantLive || v.live * bmw !== siteLiveMW(x, s.time.day) || v.inConstruction !== wantBuilding
        || v.buildings.some((b, k) => b.liveQ !== liveQ[k] || b.buildFromQ !== liveQ[k] - buildQ || b.live !== (k < wantLive))) {
        ok = false; console.log(`FAIL +${q - q0}: live ${v.live} (want ${wantLive}), building ${v.inConstruction} (want ${wantBuilding}), ${v.buildings.map((b) => b.liveQ - q0).join(',')}`);
      }
      if (v.live < prevLive) liveGo = false;
      prevLive = v.live;
      if (q - q0 >= 11 || q - q0 <= 3) rows.push(`+${q - q0}: live ${v.live}, building ${v.inConstruction}`);
    }
    console.log(`     ${rows.join(' | ')}`);
    check(ok, 'view each quarter: live count x building MW = siteLiveMW, inConstruction and per-building quarters match the schedule');
    check(liveGo && prevLive === 5, 'live goes 0 -> 5 and never back', `end ${prevLive}`);
    // at commitment: permitting stage, nothing live
    const s2 = fresh();
    const y = newSite(s2, makeCtx(s2), { path: 'gas', mw: 1000, buildings: 5 });
    const v0 = siteBuildingsView(s2, y);
    check(!!v0 && v0.live === 0 && v0.of === 5 && v0.buildings.every((b, k) => b.buildFromQ === q0Of(s2) + 12 + k - buildQ && !b.live), 'at commitment: 0 live, 5 buildings, schedule from the plan', v0 ? `inConstruction ${v0.inConstruction}` : '');
    // rent, start sites, blocked
    const s3 = fresh();
    const starts = s3.player.sites.slice(0, 4).map((z) => siteBuildingsView(s3, z));
    const hall = newSite(s3, makeCtx(s3), { path: 'rent', mw: 300 });
    const vr = siteBuildingsView(s3, hall);
    check(!!vr && vr.of === 1 && vr.live === 0 && vr.inConstruction === 0 && vr.buildings[0].buildFromQ === undefined, 'rent hall: one building, no construction quarter');
    check(starts.every((v, i) => !!v && v.of === (s3.player.sites[i].ws3.buildings ?? 1) && v.live === (s3.player.sites[i].stage === 'live' ? v.of : 0)), 'start sites: their buildings, all live if the site is live', starts.map((v) => `${v?.live}/${v?.of}`).join(' '));
    const blk = newSite(s3, makeCtx(s3), { path: 'gas', mw: 300 });
    blk.stage = 'blocked';
    check(siteBuildingsView(s3, blk) === undefined, 'blocked site: undefined');
    check(campusMW({ path: 'gas', mw: 300, buildings: 3 }) === 900, 'sanity: campusMW');
  }
}

// ── DC-16: The runway projection starts one lease per building, from each building's live day ──
{
  const leaseFlows = (s: GameStateV2) => cashFlows(s).filter((x): x is Extract<ReturnType<typeof cashFlows>[number], { perDay: number }> => 'perDay' in x && x.part === 'commitments');
  const build = (o: SiteOpts) => {
    const s = game({ seed: 1 });
    s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
    LOCAL_MOOD.dcNimby = 0;
    s.player.finance.rating = 'BB';
    const before = leaseFlows(s).length;
    const site = newSite(s, makeCtx(s), { ...o, pay: 'lease', leaseRate: 0.09 });
    return { s, site, before, mine: () => leaseFlows(s).slice(before) };
  };
  // a leased single building: one lease flow, on all the lessor funds (5% now plus the rest), from the building's go-live
  {
    const { s, site, mine } = build({ path: 'gas', mw: 1000 });
    const f = mine();
    const L = site.ws3.lease!;
    const total = L.funded + (site.capex - site.capexPaid) * site.spvFunded;
    check(f.length === 1 && Math.abs(-f[0].perDay * 365 - siteLeasePerYear(site, total)) < 1e-9, 'runway: a leased single building has one lease flow on everything the lessor funds', `${f.length} flow(s)`);
    check(f[0].from > s.time.day, 'runway: that lease starts after today, at go-live', `day ${f[0].from} of ${s.time.day}`);
  }
  // a leased 5 x 1 GW campus: five lease flows, each on a fifth, summing to the same total; a power-bound grid campus: three on one day
  {
    const { s, site, mine } = build({ path: 'gas', mw: 1000, buildings: 5 });
    const f = mine();
    const L = site.ws3.lease!;
    const total = L.funded + (site.capex - site.capexPaid) * site.spvFunded;
    const sum = f.reduce((a, x) => a - x.perDay * 365, 0);
    check(f.length === 5 && Math.abs(sum - siteLeasePerYear(site, total)) < 1e-9, 'runway: a leased 5-building campus has five lease flows adding up to one lease on everything funded', `${f.length} flows, ${sum.toFixed(3)} a year`);
    const from = f.map((x) => x.from);
    const q = quarterIndex(s.time.startDate, s.time.day);
    check(from.every((d, k) => d === dayOfQuarter(s.time.startDate, q + 12 + k)), 'runway: they start on the live quarters of the buildings (+12 .. +16)', from.join(' '));
    // after the first two buildings are live (stage live, two leases booked): three flows left, from days 2..4 of liveDays
    const ctx = makeCtx(s);
    const q0 = quarterIndex(s.time.startDate, s.time.day);
    for (let q = q0 + 1; q <= q0 + 13; q++) { s.time.day = dayOfQuarter(s.time.startDate, q); sitesQSystem.run(s, ctx); }
    const g = leaseFlows(s).filter((x) => x.from > s.time.day);
    const days = site.ws3.liveDays!;
    check(site.stage === 'live' && L.booked === 2 && g.length === 3 && g.every((x, i) => x.from === days[2 + i]), 'runway: once two buildings are live, three lease flows remain, from the live days of buildings 3 to 5', `booked ${L.booked}, ${g.length} flows`);
  }
  {
    const { mine } = build({ path: 'grid', mw: 300, buildings: 3 });
    const f = mine();
    check(f.length === 3 && f.every((x) => x.from === f[0].from), 'runway: a power-bound grid campus (3 x 300 MW) has three flows on one day', f.map((x) => x.from).join(' '));
  }
}

finish('sites');
