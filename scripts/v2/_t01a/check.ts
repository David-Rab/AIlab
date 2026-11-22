// RD-T01a targeted check: an IDA cycle is a post run with grader 'teacher' (no name check); a regular post run has no
// grader; a schemaRev-57 save gets the field from the run's name; the run's play (hash with the new field stripped) is
// printed so the same script on the previous commit shows identical behaviour.
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
const p18 = s.player.paradigms.P18;
if (p18) p18.status = 'adopted';
else (s.player.paradigms as Record<string, unknown>).P18 = { status: 'adopted' };
const n0 = s.player.models.runs.length;
const e1 = act(s, 'idaCycle', {});
const e2 = act(s, 'launchPost', {});
check(!e1 && !e2, 'IDA and post runs launch', `${e1 ?? ''} ${e2 ?? ''}`);
const [ida, post] = s.player.models.runs.slice(n0);
check(ida?.kind === 'post' && ida.grader === 'teacher' && !!ida.teacherVersionId && ida.name.startsWith('IDA'), 'IDA run: post, grader teacher, teacher id, name IDA n', ida?.name);
check(!!post && post.kind === 'post' && post.grader === undefined, 'regular post run: no grader');

// Migration 57 → 58: the field comes back from the name.
const old = JSON.parse(serialize(s)) as GameStateV2;
old.schemaRev = 57;
for (const r of old.player.models.runs) delete r.grader;
const mig = deserialize(JSON.stringify(old));
const graders = (g: GameStateV2) => g.player.models.runs.map((r) => r.grader ?? '-').join(',');
check(graders(mig) === graders(s), 'schemaRev-57 save migrates: grader from the name', graders(mig));

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
