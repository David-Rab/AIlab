// Per-instrument reliability by hidden-goal trait on the picked model (believed), Scheming evidence list; day 400.
//   npx tsx design/ux/mockups/rd/_data-c3.ts → design/ux/mockups/rd/data400c-grid.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import type { GameStateV2, TraitId } from '../../../../src/engine/v2';
import { instruments, reliability, instrumentName } from '../../../../src/engine/v2/safety/instruments';
import { measuredOom } from '../../../../src/engine/v2/safety/oversight';
import { CRITICAL_TRAITS } from '../../../../src/data/v2/traits';
import { responseOptions } from '../../../../src/engine/v2/safety/responses';
const s = deserialize(readFileSync(join(FIXTURE_DIR, process.argv[2] ?? 'day400.json'), 'utf8')) as GameStateV2;
const out: Record<string, unknown> = {};
for (const id of ['V27', 'V31']) {
  const v = s.player.models.versions.find((x) => x.id === id)!;
  const x = measuredOom(s, v);
  out[v.name] = instruments(s).map((t) => ({ id: t.id, name: instrumentName(t), by: Object.fromEntries(CRITICAL_TRAITS.map((k) => { const r = reliability(s, t, { x, v, trait: k as TraitId }, true); return [k, { v: Math.round(r.value * 1000) / 1000, r }]; })) }));
}
const v27 = s.player.models.versions.find((x) => x.id === 'V27')!;
out.schemeEvidence = v27.beliefs.SCHEME.evidence;
out.post = (v27 as unknown as { post?: unknown }).post;
out.buildMethods = JSON.stringify(v27).match(/"methods":\[[^\]]*\]/g);
out.rhCause = responseOptions(s, v27, undefined, 'RH');
writeFileSync('design/ux/mockups/rd/data400c-grid.json', JSON.stringify(out, null, 1));
console.log('ok');
