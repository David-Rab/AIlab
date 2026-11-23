// Probe for set-A mockups: rival intel and series. npx tsx design/ux/mockups/rd/_probe-a.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s: any = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const r = s.rivals.find((x: any) => x.core.name === 'Meridian');
console.log(Object.keys(r), Object.keys(r.core));
console.log(JSON.stringify(r.core).slice(0, 900));
console.log('pub', JSON.stringify(r.models ?? r.publicModels ?? r.releases ?? null).slice(0, 600));
console.log('rev', JSON.stringify(s.series.revenue), JSON.stringify(s.series.day));
