// RD-T01a targeted check: an IDA cycle is a post run with grader 'teacher' (no name check); a regular post run has no
// grader. The run's play (hash with the new field stripped) is printed so the same script on the previous commit shows
// identical behaviour. (CP4: the rev-57 migration check is gone with the UB-3 save break.)
// Run alone: npx tsx scripts/v2/_t01a/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize, stateHash } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
s.player.finance.cash = Math.max(s.player.finance.cash, 50);
// CP4: discoveries are tree nodes since RD-R04 (known = adopted; no paradigms mirror).
s.player.tree.P18 = { ...(s.player.tree.P18 ?? { progress: 1 }), status: 'known' } as typeof s.player.tree.P18;
const n0 = s.player.models.runs.length;
const e1 = act(s, 'idaCycle', {});
const e2 = act(s, 'launchPost', {});
check(!e1 && !e2, 'IDA and post runs launch', `${e1 ?? ''} ${e2 ?? ''}`);
const [ida, post] = s.player.models.runs.slice(n0);
check(ida?.kind === 'post' && ida.grader === 'teacher' && !!ida.teacherVersionId && ida.name.startsWith('Amplify'), 'IDA run: post, grader teacher, teacher id, name Amplify run n (UB-4 vocabulary)', ida?.name);
check(!!post && post.kind === 'post' && post.grader === undefined, 'regular post run: no grader');


for (let d = 0; d < 150; d++) tick(s);
const done = s.player.models.runs.find((r) => r.id === ida?.id);
console.log(`IDA run ${done?.status}; versions: ${s.player.models.versions.map((x) => `${x.name} G ${x.G.toFixed(6)}`).join('; ')}`);
const strip = JSON.parse(serialize(s)) as GameStateV2;
for (const r of strip.player.models.runs) delete (r as { grader?: string }).grader;
strip.schemaRev = 0;
const tm = s.player.models.versions.at(-1)?.traitsTrue;
console.log(`last version traits: ${JSON.stringify(tm)}`);
console.log(`behaviour hash (grader and schemaRev stripped): ${stateHash(strip)}`);
if (fails) { console.log(`${fails} failed`); process.exit(1); }
