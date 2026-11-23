// SR-03: dump dangerView's believed act numbers on the day-400 / day-900 fixtures (run once BEFORE the refactor; the
// check compares the act table against this file). Run alone: npx tsx scripts/v2/_sr03/baseline.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { dangerView } from '../../../src/engine/v2/safety/dangerView';
import { FIXTURE_DIR, HERE } from '../lib';

const out: Record<string, unknown> = {};
for (const fx of ['day400.json', 'day900.json']) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));
  out[fx] = dangerView(s);
}
writeFileSync(join(HERE, '_sr03', 'baseline.json'), JSON.stringify(out));
console.log('wrote baseline');
