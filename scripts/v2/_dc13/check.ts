// DC-13 check: campuses of 1 / 3 / 5 buildings, phased go-live, repetition discount (design/DATACENTERS.md 5b,
// DC-TASKS DC-13). Run alone: npx tsx scripts/v2/_dc13/check.ts
import { actionView, act, defaultSetupV2, newGame } from '../../../src/engine/v2';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../../../src/engine/v2/core/time';
import { leverEffects, newSite, siteBuildingLiveInQ, siteCapex, siteLiveMW, sitesQSystem, type SiteOpts } from '../../../src/engine/v2/compute/sites';
import { ownedOnline, powerAndOMPerYear, siteCapacityH } from '../../../src/engine/v2/compute/power';
import { chipFit, computeForecast } from '../../../src/engine/v2/compute/forecast';
import { worldWaitQ } from '../../../src/engine/v2/compute/waits';
import type { GameStateV2, Site } from '../../../src/engine/v2/types';

let fails = 0;
const near = (got: number, want: number, what: string, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol; if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${+got.toFixed(4)} (want ${+want.toFixed(4)})`);
};
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const fresh = () => {
  const s = newGame(defaultSetupV2({ seed: 1 }));
  s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
  s.pub.dcNimby = 0; // no opposition rolls
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
  for (const path of ['rent', 'grid', 'gas'] as const) for (const mw of [100, 300, 1000]) for (const buildings of [1, 3, 5]) for (const crash of [false, true]) {
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
      && Math.abs(x.capexPaid - x.capex) < 1e-6 && Math.abs(paid0 - 0.05 * x.capex) < 1e-9;
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

console.log(fails === 0 ? '\nall ok' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
