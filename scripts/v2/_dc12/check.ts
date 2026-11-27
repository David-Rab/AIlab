// DC-12 check: construction time and building cost scale with size; rushed gas counts in the turbine backlog
// (design/DATACENTERS.md 5b, DC-TASKS DC-12). Run alone: npx tsx scripts/v2/_dc12/check.ts
import { actionView, act, defaultSetupV2, newGame } from '../../../src/engine/v2';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../../../src/engine/v2/core/time';
import { newSite, siteBuildQ, siteCapex, sitesQSystem } from '../../../src/engine/v2/compute/sites';
import { pendingGW } from '../../../src/engine/v2/compute/waits';
import type { GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const near = (got: number, want: number, what: string, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol; if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${+got.toFixed(4)} (want ${+want.toFixed(4)})`);
};
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

const fresh = () => {
  const s = newGame(defaultSetupV2({ seed: 1 }));
  s.time.day = dayOfDate(s.time.startDate, '2026-08-05'); // Q3 26
  s.pub.dcNimby = 0; // no opposition rolls
  return s;
};

// 1. Construction quarters by size, normal / crash (grid and gas have the same 8 q reference).
const Q: [number, number, number][] = [[100, 4, 2], [300, 6, 3], [500, 6, 3], [1000, 8, 4], [2500, 11, 5], [5000, 13, 6]];
for (const path of ['grid', 'gas'] as const) {
  for (const [mw, n, c] of Q) {
    near(siteBuildQ({ path, mw }), n, `${path} ${mw} MW construction q`);
    near(siteBuildQ({ path, mw, crash: true }), c, `${path} ${mw} MW construction q, crash`);
  }
}
near(siteBuildQ({ path: 'rent', mw: 1000 }), 0, 'rent needs no construction');
near(siteBuildQ({ path: 'rent', mw: 1000, crash: true }), 0, 'rent ignores crash');

// 2. Capex by size (building scaled; turbines, upgrades, rush, community not).
near(siteCapex({ path: 'gas', mw: 1000, rush: true, community: true }), 18.9, 'gas 1 GW rush + community capex');
near(siteCapex({ path: 'gas', mw: 5000 }), 5 * (14 * Math.pow(5, -0.1) + 3), 'gas 5 GW no levers capex', 0.01);
near(siteCapex({ path: 'gas', mw: 5000 }), 74.59, 'gas 5 GW no levers capex vs spec', 0.01);
near(siteCapex({ path: 'grid', mw: 100 }), 0.1 * (14 * Math.pow(0.1, -0.1) + 0.2), 'grid 0.1 GW no levers capex', 0.001);
near(siteCapex({ path: 'grid', mw: 100 }), 1.7825, 'grid 0.1 GW capex vs spec', 0.001);
near(siteCapex({ path: 'gas', mw: 5000, crash: true }), 95.45, 'gas 5 GW crash capex', 0.01);
near(siteCapex({ path: 'gas', mw: 5000, fastTrack: true }) - siteCapex({ path: 'gas', mw: 5000 }), 5 * 0.05 * 14 * Math.pow(5, -0.1), 'fast-track = 5% of the scaled building', 1e-9);
near(siteCapex({ path: 'gas', mw: 5000, rush: true }) - siteCapex({ path: 'gas', mw: 5000 }), 5 * 0.3 * 3, 'rush is unscaled (30% of the turbines)', 1e-9);
near(siteCapex({ path: 'rent', mw: 5000 }), 5 * 4, 'rent network fit-out is unscaled', 1e-9);

// 3. Preview = effect, sweep: gas and grid at 0.1, 1, 5 GW (grid caps at 1 GW: 0.1, 0.5, 1) x crash on/off.
let cases = 0, bad = 0;
for (const path of ['grid', 'gas'] as const) {
  for (const mw of path === 'grid' ? [100, 500, 1000] : [100, 1000, 5000]) {
    for (const crash of [false, true]) {
      const p = { path, mw, crash, pay: 'cash' };
      const s = fresh();
      const q0 = quarterIndex(s.time.startDate, s.time.day);
      const v = actionView(s, 'cmp.newSite', p);
      const capexPrev = -v.costs[0].amount;
      const lagQ = v.gains[0].lagDays! / 91;
      const err = act(s, 'cmp.newSite', p);
      const x = s.player.sites[s.player.sites.length - 1];
      let live = -1;
      const ctx = makeCtx(s);
      for (let q = q0 + 1; q <= q0 + 80 && live < 0; q++) {
        s.time.day = dayOfQuarter(s.time.startDate, q);
        sitesQSystem.run(s, ctx);
        if (x.stage === 'live') live = q;
      }
      const ok = !err && Math.abs(capexPrev - x.capex) < 1e-9 && live - q0 === lagQ && x.mw === mw && x.ws3.buildQ === siteBuildQ({ path, mw, crash });
      cases++;
      if (!ok) { bad++; fails++; console.log(`FAIL ${path} ${mw} MW crash ${crash}: preview capex ${capexPrev} vs ${x?.capex}, lag ${lagQ} q vs live ${live - q0} q, buildQ ${x?.ws3.buildQ}, err ${err}`); }
    }
  }
}
check(bad === 0, `preview capex and live quarter equal the created site's in all ${cases} cases`, `${bad} bad`);

// 4. A rushed gas site counts in the turbine backlog until its power is ready.
{
  const s = fresh();
  const ctx = makeCtx(s);
  const before = pendingGW(s.player.sites, 'gas', s.time.day);
  const site = newSite(s, ctx, { path: 'gas', mw: 2000, rush: true });
  near(pendingGW(s.player.sites, 'gas', s.time.day) - before, 2, 'rushed 2 GW gas site is in the backlog', 1e-9);
  check(site.ws3.rush === true, 'the site is rushed');
}

console.log(fails === 0 ? '\nall ok' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
