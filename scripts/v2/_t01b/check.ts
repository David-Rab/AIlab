// RD-T01b targeted check: each former run kind (base, continue, post, distill, IDA) on the day-400 fixture plans,
// launches and completes (setup forced ready, FLOP forced done, one tick); prints a hash of the plan, the run and the
// base / version it made, plus the whole state's hash. Same script on the previous commit = same hashes (behaviour kept).
// Run alone: npx tsx scripts/v2/_t01b/check.ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, stateHash } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { FIXTURE_DIR } from '../lib';

const h = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const cases: [string, string, Record<string, unknown>][] = [
  ['base', 'launchBase', {}], ['continue', 'launchContinue', {}], ['post', 'launchPost', {}],
  ['distill', 'launchDistill', {}], ['ida', 'idaCycle', {}],
];
let fails = 0;
for (const [label, id, p] of cases) {
  const s = deserialize(raw);
  s.player.finance.cash = Math.max(s.player.finance.cash, 50);
  const p18 = s.player.paradigms.P18;
  if (p18) p18.status = 'adopted';
  else (s.player.paradigms as Record<string, unknown>).P18 = { status: 'adopted' };
  const nB = s.player.models.bases.length;
  const nV = s.player.models.versions.length;
  const nR = s.player.models.runs.length;
  const err = act(s, id, p);
  if (err) { fails++; console.log(`FAIL ${label}: ${err}`); continue; }
  const run = s.player.models.runs[nR];
  const runAtLaunch = h(run);
  run.readyDay = s.time.day;
  run.flopDone = run.flopNeeded;
  tick(s);
  const made = [...s.player.models.bases.slice(nB), ...s.player.models.versions.slice(nV)];
  const ok = run.status === 'done' && made.length === 1;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(8)} ${run.kind}/${run.grader ?? '-'} run ${runAtLaunch} made ${made.map((m) => m.name).join(',')} ${h(made)} state ${stateHash(s)}`);
}
if (fails) { console.log(`${fails} failed`); process.exit(1); }
