// Calibration report (design/TESTING.md §0): every sourced outcome target of the game in one place, with its source,
// its band and the value the current code gives. A balance tool, NOT a test: it never gates a merge, and nothing in
// run.ts runs it. The balance session runs it at its checkpoints. Heavy (plays bot games to ASI, cached through
// simcache): ask the designer before running it on the shared machine.
//
//   npx tsx scripts/v2/calreport.ts [--only <area>,<area>] [--json <file>]
//
// Each area module under scripts/v2/calreport/ exports `area` (its name) and `targets()`, which plays or reads what it
// needs and returns its rows. A target is out of band when `ok` is false; the report prints every row and a count, and
// always exits 0.
import { writeFileSync } from 'node:fs';
import type { Target } from './calreport/types';
import * as milestones from './calreport/milestones';
import * as safety from './calreport/safety';
import * as world from './calreport/world';
import * as finance from './calreport/finance';
import * as market from './calreport/market';
import * as rivals from './calreport/rivals';

const AREAS: { area: string; targets: () => Target[] }[] = [milestones, safety, world, finance, market, rivals];

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const only = opt('only')?.split(',').map((x) => x.trim());
const rows: (Target & { area: string })[] = [];
for (const a of AREAS) {
  if (only && !only.includes(a.area)) continue;
  const t0 = performance.now();
  const ts = a.targets();
  console.log(`\n${a.area} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  for (const t of ts) {
    rows.push({ ...t, area: a.area });
    console.log(`  ${t.ok ? 'in  ' : 'OUT '} ${t.label}  — ${t.value}  (band ${t.band}; ${t.source})`);
  }
}
const out = rows.filter((r) => !r.ok);
console.log(`\n${rows.length} targets, ${rows.length - out.length} in band, ${out.length} out${out.length ? `: ${out.map((r) => r.id).join(', ')}` : ''}`);
const json = opt('json');
if (json) writeFileSync(json, JSON.stringify({ date: new Date().toISOString(), rows }, null, 2));
