// Fixture GameStates for UI and unit work (V2-SPEC §8.4 M0 gate). Owner: WS1.
// Guards: the committed fixtures in scripts/v2/fixtures/ (day 0 / 400 / 900 of the tl-central RefBot game and the R9
// challenger and spinout day-400 starts, which the other tests and the UI test read) are plain JSON, load with the current
// schema (deserialize refuses an old one, so a fixture not regenerated after a schema change fails here) and round-trip
// through serialize. They are NOT diffed against a fresh run: fixtures are regenerated in most engine commits.
// Cost: check mode reads 5 files, no sim (a few CPU-s); --write plays 900 + 2 x 400 RefBot days (≈ 0.4 CPU-min). Tier: quick, full.
//   npx tsx scripts/v2/fixtures.ts           check the committed files; nothing is written.
//   npx tsx scripts/v2/fixtures.ts --write   regenerate the committed fixture files (then commit them): npm run fixtures:v2.
// The --write runs go through the simulation cache (simcache.ts), keyed on the code.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { engine } from '../../src/engine/v2';
import { refBot } from '../../src/engine/v2/bots/ref';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { internalVersion } from '../../src/engine/v2/models/labs';
import { FIXTURE_DIR, cashFloorStub, check, finish, runRef, validateJson } from './lib';
import { cached } from './simcache';

export const FIXTURE_SETUP = defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', companyName: 'OpenBrain' });
export const FIXTURE_DAYS = [0, 400, 900] as const;

const WRITE = process.argv.includes('--write');
const ME = fileURLToPath(import.meta.url);

if (!WRITE) {
  // Check mode: read the committed files only.
  const files = [...FIXTURE_DAYS.map((d) => ({ file: join(FIXTURE_DIR, `day${d}.json`), label: `fixture day ${d}`, start: undefined as string | undefined })),
    ...(['challenger', 'spinout'] as const).map((st) => ({ file: join(FIXTURE_DIR, `start-${st}-day400.json`), label: `fixture ${st} day 400`, start: st as string | undefined }))];
  for (const { file, label, start } of files) {
    let s;
    try { s = deserialize(readFileSync(file, 'utf8')); } catch (e) { check(false, `${label} loads`, `${(e as Error).message}: run npm run fixtures:v2 and commit the fixtures`); continue; }
    const errs = validateJson(s);
    check(errs.length === 0, `${label} is plain JSON`, errs.slice(0, 3).join('; '));
    check(stateHash(deserialize(serialize(s))) === stateHash(s), `${label} round-trips`);
    if (start) check(s.setup.start === start && s.rivals.length > 0, `${label} is the ${start} start with the leader lab`);
  }
  finish('fixtures');
}

interface Snap { day: number; json: string; errs: string[]; version?: string; measuredL?: number; M?: number }
const main = cached('fixtures-ref', { setup: FIXTURE_SETUP, days: FIXTURE_DAYS, extra: 'cashFloorStub' }, [ME], () => {
  const s = newGame(FIXTURE_SETUP);
  const snaps: Snap[] = [];
  for (const day of FIXTURE_DAYS) {
    runRef(s, day, undefined, { extraSystems: [cashFloorStub] });
    const v = internalVersion(s);
    snaps.push({ day, json: serialize(s), errs: validateJson(s), version: v?.name, measuredL: v?.evals.measuredL, M: s.player.research.last?.x?.mExp });
  }
  return { snaps, md: s.player.milestoneDays, day: s.time.day };
});

mkdirSync(FIXTURE_DIR, { recursive: true });
for (const sn of main.snaps) {
  const file = join(FIXTURE_DIR, `day${sn.day}.json`);
  writeFileSync(file, sn.json);
  console.log(`      wrote ${file} (${(sn.json.length / 1024).toFixed(0)} KB, internal ${sn.version}, measured L ${sn.measuredL}, M ${sn.M?.toFixed(2)})`);
}

// R9: day-400 fixtures for the challenger and spinout starts (RefBot with real finance and compute; endings skipped so
// the fixture exists whatever the run's fate). Written as start-<type>-day400.json.
for (const start of ['challenger', 'spinout'] as const) {
  const setup = defaultSetupV2({ ...FIXTURE_SETUP, start });
  const r = cached('fixtures-start', { setup, days: 400 }, [ME], () => {
    const t = newGame(setup);
    while (t.time.day < 400) {
      for (const p of [...t.events.pending]) if (resolve(t, p.instance, refBot.decide(t, p))) resolve(t, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      refBot.act(t, engine);
      tick(t, { skip: ['endings'] });
    }
    const back = deserialize(serialize(t));
    const v = internalVersion(t);
    return { json: serialize(t), errs: validateJson(t), start: t.setup.start, leaderLab: t.rivals.length > 0, roundTrip: stateHash(back) === stateHash(t), version: v?.name, measuredL: v?.evals.measuredL, cash: t.player.finance.cash };
  });
  const file = join(FIXTURE_DIR, `start-${start}-day400.json`);
  writeFileSync(file, r.json);
  console.log(`      wrote ${file} (internal ${r.version}, measured L ${r.measuredL}, cash ${r.cash.toFixed(1)}, ending skipped)`);
}
finish('fixtures');
