// Case preview on day 400 (Atlas-2.8, Scheming + Alignment faking), staff and compute for a case.
//   npx tsx design/ux/mockups/rd/_data-c4.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import type { GameStateV2, TraitId } from '../../../../src/engine/v2';
import { casePreview, defaultTools, caseReliability, caseDailyWork, INV_FTE } from '../../../../src/engine/v2/safety/investigations';
import { instruments } from '../../../../src/engine/v2/safety/instruments';
const s = deserialize(readFileSync(join(FIXTURE_DIR, process.argv[2] ?? 'day400.json'), 'utf8')) as GameStateV2;
const vid = process.argv[3] ?? 'V27';
const v = s.player.models.versions.find((x) => x.id === vid)!;
const traits = ['SCHEME'] as TraitId[];
const ids = defaultTools(s, traits);
const tools = instruments(s).filter((x) => ids.includes(x.id));
for (const fte of [5, 10, 20, 40]) {
  const rel = caseReliability(s, { id: 'x', target: { kind: 'trait', versionId: vid, trait: 'SCHEME' }, fte, computeShare: 0.02, tools: ids, startDay: s.time.day, progress: 0 } as never);
  const per = caseDailyWork(s, fte, 1000);
  const p = casePreview(s, v, traits, tools, fte, 0.02, per, rel);
  console.log(fte, JSON.stringify({ rel, per, days: p.days, h: p.h100e, ranges: p.ranges, inst: p.instruments.map((i) => i.name), can: p.canFind.map((c) => c.slice(0, 90)) }));
}
console.log(INV_FTE);
