// DC-4 check: the build action's preview equals the site it makes, the lever effects, the community price
// (design/DATACENTERS.md section 5, DC-TASKS DC-4). Run alone: npx tsx scripts/v2/_dc4/check.ts
import { actionView, act, defaultSetupV2, newGame, leverEffects, oppositionOdds } from '../../../src/engine/v2';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../../../src/engine/v2/core/time';
import { siteLiveInQ, sitesQSystem, type SiteOpts } from '../../../src/engine/v2/compute/sites';
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
const qOfDay = (s: GameStateV2, d: number) => quarterIndex(s.time.startDate, d);

// 1. Preview = the site it makes: every source x every lever combination x two sizes (dcNimby 0: no rolls).
const PATHS = ['rent', 'grid', 'gas'] as const;
const LEV = ['crash', 'rush', 'fastTrack', 'community'] as const;
let cases = 0, bad = 0;
for (const path of PATHS) {
  for (const mw of path === 'grid' ? [300, 1000] : path === 'rent' ? [300, 1000] : [500, 2000]) {
    for (let m = 0; m < (path === 'rent' ? 2 : 16); m++) {
      const p: Record<string, number | string | boolean> = { path, mw, pay: 'cash' };
      LEV.forEach((k, i) => { p[k] = !!(m & (1 << i)); });
      const s = fresh();
      const q0 = qOfDay(s, s.time.day);
      const v = actionView(s, 'cmp.newSite', p);
      const capexPrev = path === 'rent' ? -v.costs[1].amount : -v.costs[0].amount;
      const lagQ = v.gains[0].lagDays! / 91;
      const err = act(s, 'cmp.newSite', p);
      const x = s.player.sites[s.player.sites.length - 1];
      let live = -1;
      const ctx = makeCtx(s);
      for (let q = q0 + 1; q <= q0 + 60 && live < 0; q++) {
        s.time.day = dayOfQuarter(s.time.startDate, q);
        sitesQSystem.run(s, ctx);
        if (x.stage === 'live') live = q;
      }
      const ok = !err && Math.abs(capexPrev - x.capex) < 1e-9 && live - q0 === lagQ && x.mw === mw
        && (path !== 'rent' || Math.abs(v.costs[0].amount + (mw / 1000) * 1.8) < 1e-9);
      cases++;
      if (!ok) { bad++; fails++; console.log(`FAIL ${path} ${mw} MW levers ${m}: preview capex ${capexPrev} vs ${x?.capex}, lag ${lagQ} q vs live ${live - q0} q, err ${err}`); }
    }
  }
}
check(bad === 0, `preview capex and live quarter equal the created site's in all ${cases} cases`, `${bad} bad`);

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
  const blk = v.exposure.find((x) => x.target.startsWith('blocked'))!, dl = v.exposure.find((x) => x.target.startsWith('delayed'))!;
  near(blk.probability!, 0.06, 'preview block probability (rounded to 2 places)');
  near(dl.probability!, 0.35, 'preview delay probability');
  const v2 = actionView(s, 'cmp.newSite', { ...p, crash: true });
  near(-v2.costs[0].amount, 18.9 + 4.9, 'with crash: preview capex = +4.9');
  near(v2.gains[0].lagDays!, 7 * 91, 'with crash: lag 7 q');
  const r = actionView(s, 'cmp.newSite', { path: 'rent', mw: 1000 });
  near(r.costs[0].amount, -1.8, 'rent 1 GW: rent per year (RENT.perGWYear)');
  check(/× 5/.test(r.costs[0].target), 'rent line says x 5', r.costs[0].target);
  const cap = (mw: number) => -actionView(s, 'cmp.newSite', { path: 'gas', mw, community: false }).costs[0].amount;
  near(cap(10), cap(100), 'size below 100 MW is clamped to 100');
}

// 3. Community action: $1B per GW, preview = effect.
{
  const s = fresh();
  act(s, 'cmp.newSite', { path: 'gas', mw: 1500, community: false });
  const x = s.player.sites[s.player.sites.length - 1];
  const before = x.capex;
  const v = actionView(s, 'cmp.community', { siteId: x.id });
  near(-v.costs[0].amount, 1.5, 'community preview on a 1.5 GW site');
  check(v.costs[0].target.includes('$1B per GW on 1 site'), 'community text', v.costs[0].target);
  check(act(s, 'cmp.community', { siteId: x.id }) === undefined, 'community applies');
  near(x.capex - before, 1.5, 'community apply adds $1B per GW to the site');
  check(x.communityPackage, 'site flagged');
}
{
  const s = fresh();
  act(s, 'cmp.newSite', { path: 'grid', mw: 600, community: false });
  act(s, 'cmp.newSite', { path: 'gas', mw: 2000, community: false });
  const permitting = s.player.sites.filter((x) => x.stage === 'permitting' && !x.communityPackage && !x.ws3.rolled && x.path !== 'rent');
  const v = actionView(s, 'cmp.community', {});
  const before = s.player.sites.reduce((a, x) => a + x.capex, 0);
  act(s, 'cmp.community', {});
  const delta = s.player.sites.reduce((a, x) => a + x.capex, 0) - before;
  near(-v.costs[0].amount, delta, `company-wide preview = capex added on ${permitting.length} sites`);
  near(delta, permitting.reduce((a, x) => a + x.mw / 1000, 0), 'and that is $1B per GW');
  check(v.costs[0].target.includes(`$1B per GW on ${permitting.length} sites`), 'text', v.costs[0].target);
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
