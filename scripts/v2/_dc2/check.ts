// DC-2 check: world waits (design/DATACENTERS.md §4, DC-TASKS [D-1]..[D-3]). Pure functions, no engine run needed
// except for the state-reading wrappers (a fresh game is enough).
// Run alone: npx tsx scripts/v2/_dc2/check.ts
import { defaultSetupV2, newGame, outsideGW, pendingGW, refWaitQ, waitBreakdown, waitQ, worldWaitQ, type QueueSite } from '../../../src/engine/v2';

let fails = 0;
const near = (got: number, want: number, what: string, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol; if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${got} (want ${want})`);
};
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

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
const s = newGame(defaultSetupV2());
for (const src of ['grid', 'gas', 'rent'] as const) {
  const b = waitBreakdown(s, src);
  console.log(`     ${src}: wait ${b.waitQ.toFixed(3)} q, ref ${b.refQ}, you ${b.youGW} GW [${b.you.map((x) => `${x.name} ${x.gw}`).join(', ')}], others ${b.othersGW.toFixed(1)} GW, rate ${b.rateGWPerYear.toFixed(1)} GW/yr, +1 GW = ${b.perGWQ.toFixed(4)} q`);
  near(b.waitQ, worldWaitQ(s, src), `${src}: breakdown wait = worldWaitQ`);
  near(b.waitQ, b.refQ + b.youGW * b.perGWQ, `${src}: wait = ref + youGW x perGWQ`);
  near(b.othersGW * 4 / b.rateGWPerYear, b.refQ, `${src}: outside GW x 4 / rate = ref wait`);
}
check(Math.abs(waitBreakdown(s, 'grid').refQ - 19) < 1e-9, 'game start (2025-07-01) reads grid 19 q');

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
