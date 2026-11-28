// Fixture GameStates for UI and unit work (V2-SPEC §8.4 M0 gate). Owner: WS1.
// Runs the real loop with RefBot on the tl-central timeline (stub compute tracking refTotal and a stub cash floor until
// WS3/WS5 land) and builds day 0 / 400 / 900 (plus the R9 start fixtures).
//   npx tsx scripts/v2/fixtures.ts           compare: each fixture must equal the committed file in scripts/v2/fixtures/
//                                            (other tests and the UI test read those files); nothing is written.
//   npx tsx scripts/v2/fixtures.ts --write   regenerate the committed fixture files (then commit them).
// The runs go through the simulation cache (simcache.ts), keyed on the code.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
/** Write the fixture (--write) or compare it with the committed file. */
function emit(file: string, json: string, label: string) {
  if (WRITE) {
    writeFileSync(file, json);
    return;
  }
  const committed = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : undefined;
  check(committed === json, `${label} equals the committed ${file.replace(/\\/g, '/').split('/').slice(-3).join('/')}`, committed === undefined ? 'missing: run fixtures.ts --write' : committed === json ? '' : 'stale: run npx tsx scripts/v2/fixtures.ts --write and commit the fixtures');
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

if (WRITE) mkdirSync(FIXTURE_DIR, { recursive: true });
for (const sn of main.snaps) {
  const errs = sn.errs;
  check(errs.length === 0, `fixture day ${sn.day} is plain JSON`, errs.slice(0, 3).join('; '));
  const file = join(FIXTURE_DIR, `day${sn.day}.json`);
  emit(file, sn.json, `fixture day ${sn.day}`);
  console.log(`      ${WRITE ? 'wrote' : 'built'} ${file} (${(sn.json.length / 1024).toFixed(0)} KB, internal ${sn.version}, measured L ${sn.measuredL}, M ${sn.M?.toFixed(2)})`);
}

// R9: day-400 fixtures for the safety-first contender and talent breakaway lab kinds (RefBot with real finance and compute; endings skipped so
// the fixture exists whatever the run's fate). Written as start-<kind>-day400.json.
for (const start of ['safety', 'breakaway'] as const) {
  const setup = defaultSetupV2({ ...FIXTURE_SETUP, labKind: start });
  const r = cached('fixtures-start', { setup, days: 400 }, [ME], () => {
    const t = newGame(setup);
    while (t.time.day < 400) {
      for (const p of [...t.events.pending]) if (resolve(t, p.instance, refBot.decide(t, p))) resolve(t, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      refBot.act(t, engine);
      tick(t, { skip: ['endings'] });
    }
    const back = deserialize(serialize(t));
    const v = internalVersion(t);
    return { json: serialize(t), errs: validateJson(t), start: t.setup.labKind, hasRivals: t.rivals.length > 0, roundTrip: stateHash(back) === stateHash(t), version: v?.name, measuredL: v?.evals.measuredL, cash: t.player.finance.cash };
  });
  const errs = r.errs;
  check(errs.length === 0 && r.start === start && r.hasRivals, `fixture ${start} day 400 is plain JSON with the leader lab`, errs.slice(0, 3).join('; '));
  check(r.roundTrip, `fixture ${start} day 400 round-trips`);
  const file = join(FIXTURE_DIR, `start-${start}-day400.json`);
  emit(file, r.json, `fixture ${start} day 400`);
  console.log(`      ${WRITE ? 'wrote' : 'built'} ${file} (internal ${r.version}, measured L ${r.measuredL}, cash ${r.cash.toFixed(1)}, ending skipped)`);
}
finish('fixtures');
