// Fixture GameStates for UI and unit work (V2-SPEC §8.4 M0 gate). Owner: WS1.
// Runs the real loop with RefBot on the ai2027 preset (stub compute tracking refTotal and a stub cash floor until
// WS3/WS5 land) and saves day 0 / 400 / 900 to scripts/v2/fixtures/. Also checks the player's milestone days stay
// on the golden ai2027 timeline within the §7.1 tolerances.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_TOL } from '../../src/data/v2/calibration';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { engine } from '../../src/engine/v2';
import { refBot } from '../../src/engine/v2/bots/ref';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { internalVersion } from '../../src/engine/v2/models/labs';
import type { MilestoneIdx } from '../../src/engine/v2/types';
import { FIXTURE_DIR, GOLDEN_PATH, cashFloorStub, check, finish, runRef, validateJson } from './lib';

export const FIXTURE_SETUP = defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', companyName: 'OpenBrain' });
export const FIXTURE_DAYS = [0, 400, 900] as const;

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as { presets: { ai2027: { days: Record<string, number> } } };
const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'];

mkdirSync(FIXTURE_DIR, { recursive: true });
const s = newGame(FIXTURE_SETUP);
for (const day of FIXTURE_DAYS) {
  runRef(s, day, undefined, { extraSystems: [cashFloorStub] });
  const errs = validateJson(s);
  check(errs.length === 0, `fixture day ${day} is plain JSON`, errs.slice(0, 3).join('; '));
  const json = serialize(s);
  const file = join(FIXTURE_DIR, `day${day}.json`);
  writeFileSync(file, json);
  const v = internalVersion(s);
  console.log(`      wrote ${file} (${(json.length / 1024).toFixed(0)} KB, internal ${v?.name}, measured L ${v?.evals.measuredL}, M ${s.player.prodCache?.M.toFixed(2)})`);
}

// The live engine must stay on the audited timeline: player milestone days within §7.1 tolerances of golden.
const g = golden.presets.ai2027.days;
NAMES.forEach((n, i) => {
  const want = g[n];
  if (i < 3 || want === undefined || want > s.time.day) return;
  const got = s.player.milestoneDays[i as MilestoneIdx];
  const tol = (i === 3 ? GOLDEN_TOL.SC : GOLDEN_TOL.after) * 365;
  check(got !== undefined && Math.abs(got - want) <= tol, `player ${n} on the golden timeline`, `got ${got} want ${want} ±${Math.round(tol)} d`);
});
// R9: day-400 fixtures for the challenger and spinout starts (RefBot with real finance and compute; endings skipped so
// the fixture exists whatever the run's fate). Written as start-<type>-day400.json.
for (const start of ['challenger', 'spinout'] as const) {
  const t = newGame(defaultSetupV2({ ...FIXTURE_SETUP, start, leaderLab: true }));
  while (t.time.day < 400) {
    for (const p of [...t.events.pending]) if (resolve(t, p.instance, refBot.decide(t, p))) resolve(t, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    refBot.act(t, engine);
    tick(t, { skip: ['endings'] });
  }
  const errs = validateJson(t);
  check(errs.length === 0 && t.setup.start === start && t.setup.leaderLab, `fixture ${start} day 400 is plain JSON with the leader lab`, errs.slice(0, 3).join('; '));
  const back = deserialize(serialize(t));
  check(stateHash(back) === stateHash(t), `fixture ${start} day 400 round-trips`);
  const file = join(FIXTURE_DIR, `start-${start}-day400.json`);
  writeFileSync(file, serialize(t));
  const v = internalVersion(t);
  console.log(`      wrote ${file} (internal ${v?.name}, measured L ${v?.evals.measuredL}, cash ${t.player.finance.cash.toFixed(1)}, ending skipped)`);
}
finish('fixtures');
