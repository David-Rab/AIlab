// DC-17 check: the numbers the build card and site rows show (design/DATACENTERS.md 5b, DC-TASKS DC-17).
// Run alone: npx tsx scripts/v2/_dc17/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../../../src/engine/v2/core/time';
import { campusMW, newSite, oppositionOdds, oppositionParts, siteBuildQ, siteBuildingLiveInQ, siteCapex, siteCapexParts, siteFit, siteLiveMW, sitesQSystem, type SiteOpts } from '../../../src/engine/v2/compute/sites';
import { siteBuildingsView } from '../../../src/engine/v2/compute/forecast';
import { CAMPUS, SOURCES } from '../../../src/data/v2/deals';
import type { GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const near = (got: number, want: number, what: string, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol; if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${+got.toFixed(4)} (want ${+want.toFixed(4)})`);
};
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

const fresh = (nimby = 0) => {
  const s = newGame(defaultSetupV2({ seed: 1 }));
  s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
  s.pub.dcNimby = nimby;
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
  for (const nimby of [0, 45, 60, 100]) for (const path of ['rent', 'grid', 'gas'] as const) for (const crash of [false, true]) for (const communityPackage of [false, true]) {
    const s = fresh(nimby);
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
  const s = fresh(50);
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
  check(starts.every((v, i) => !!v && v.of === 1 && v.live === (s3.player.sites[i].stage === 'live' ? 1 : 0)), 'start sites: one building each, live as their stage', starts.map((v) => `${v?.live}/${v?.of}`).join(' '));
  const blk = newSite(s3, makeCtx(s3), { path: 'gas', mw: 300 });
  blk.stage = 'blocked';
  check(siteBuildingsView(s3, blk) === undefined, 'blocked site: undefined');
  check(campusMW({ path: 'gas', mw: 300, buildings: 3 }) === 900, 'sanity: campusMW');
}

console.log(fails === 0 ? '\nall ok' : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
