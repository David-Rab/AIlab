// Back-of-envelope estimates (design/TESTING.md §0; skill good-tests): the engine's own pure functions and parameters,
// evaluated on sourced reference inputs (reference curves, start tables, a fixture read as a state), compared to the
// registry target (balance/targets.ts) by id. NO games, NO bots, NO ticks: the whole run takes about a second.
//
//   npx tsx scripts/v2/estimates.ts [--only <area>,<area>]
//
// Each area module under scripts/v2/estimates/ exports `area` and `estimates()`, which returns rows made with `estOf`
// (estimates/types.ts). A row out of its band is calibration (the balance session's), so it prints WARN and never fails.
// The run fails only on a code bug: a NaN or infinite estimate, or an absurd miss (more than ×10 outside the band).
// Guards: what it estimates — whether parameters land roughly where the sources say, between balance checkpoints;
// cost — no sim, ≈ 1 s; tier — quick and full (informational, fails only on NaN / ×10).
import { check, finish } from './lib';
import type { Estimate } from './estimates/types';
import * as capability from './estimates/capability';
import * as start from './estimates/start';
import * as money from './estimates/money';
import * as market from './estimates/market';
import * as world from './estimates/world';
import * as safety from './estimates/safety';

const AREAS: { area: string; estimates: () => Estimate[] }[] = [capability, start, money, market, world, safety];

const argv = process.argv.slice(2);
const i = argv.indexOf('--only');
const only = i >= 0 ? argv[i + 1]?.split(',').map((x) => x.trim()) : undefined;
let n = 0;
let out = 0;
for (const a of AREAS) {
  if (only && !only.includes(a.area)) continue;
  const t0 = performance.now();
  const rows = a.estimates();
  console.log(`\n${a.area} (${(performance.now() - t0).toFixed(0)} ms)`);
  for (const r of rows) {
    n++;
    if (!r.ok) out++;
    console.log(`${r.ok ? 'in  ' : 'WARN'}  ${r.label}  — estimate ${r.value} (band ${r.band}; ${r.source})${r.chain ? `\n      chain: ${r.chain}` : ''}`);
    check(!r.absurd, `${r.id}: the estimate is finite and within ×10 of its band`, r.absurd ? `${r.value} vs ${r.band}` : '');
  }
}
console.log(`\n${n} estimates, ${n - out} in band, ${out} out of band (calibration: the balance session's)`);
finish('estimates');
