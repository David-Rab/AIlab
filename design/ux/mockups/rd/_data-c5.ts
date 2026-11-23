// Control-protocol settings preview on Atlas-2.8's AI staff acts (believed parts, day 400). npx tsx design/ux/mockups/rd/_data-c5.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import type { GameStateV2 } from '../../../../src/engine/v2';
import { believedOversightParts } from '../../../../src/engine/v2/safety/believedOversight';
import { aiRdShare } from '../../../../src/engine/v2/safety/incidents';
import { controlTerms, controlComputeShare } from '../../../../src/engine/v2/safety/safeguards';
const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')) as GameStateV2;
const v = s.player.models.versions.find((x) => x.id === 'V27')!;
console.log('on', JSON.stringify(believedOversightParts(s, v, true, aiRdShare(s))));
console.log('off', JSON.stringify(believedOversightParts(s, v, false, aiRdShare(s), false)));
for (const k of ['defer10', 'defer20', 'resample'] as const) console.log(k, JSON.stringify(controlTerms(k, 0.005)), JSON.stringify(controlTerms(k, undefined)), controlComputeShare(k));
