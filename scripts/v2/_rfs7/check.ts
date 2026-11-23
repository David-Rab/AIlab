// RF-S7 check (npx tsx scripts/v2/_rfs7/check.ts): CP3h(b)'s length grading gap is gone. A long-horizon policy far past
// its 40 h tasks meets its graders like any other family: the same missed share for the same suite exploitability.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { missedExploit, runTaskH, type Policy } from '../../../src/engine/v2/safety/traits';
import * as traits from '../../../src/engine/v2/safety/traits';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(!('lengthGapOom' in traits), 'lengthGapOom deleted');
for (const oom of [0, 3, 6]) {
  const policy: Policy = { oom, h50Min: 203 * Math.pow(4.2, oom) };
  const m = missedExploit(s, { longHorizon: 0.1, swe: 0.1 }, policy);
  check(Math.abs((m.longHorizon ?? 0) - (m.swe ?? 0)) < 1e-12, `policy +${oom} OOM: long-horizon missed share = SWE's`, `${m.longHorizon?.toFixed(4)} vs ${m.swe?.toFixed(4)}, long task ${runTaskH('longHorizon', policy).toFixed(0)} h`);
}
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
