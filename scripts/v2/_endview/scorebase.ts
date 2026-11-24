// Before/after check for the scoring refactor: prints scoreEnding for every ending id × power on both fixtures.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { scoreEnding } from '../../../src/engine/v2/endings/scoring';
import { ENDING_TEXT } from '../../../src/engine/v2/endings/endings';
import { FIXTURE_DIR } from '../lib';
const POW = ['treaty', 'committee', 'democratic', 'corporate', 'government', 'multipolar', 'beijing', 'none'] as const;
const out: string[] = [];
for (const f of ['day400', 'day900', 'start-challenger-day400', 'start-spinout-day400']) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, `${f}.json`), 'utf8'));
  for (const id of Object.keys(ENDING_TEXT) as (keyof typeof ENDING_TEXT)[]) for (const p of POW) out.push(`${f} ${id} ${p} ${JSON.stringify(scoreEnding(s, id, p))}`);
}
console.log(out.join('\n'));
