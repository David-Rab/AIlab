// Fixture GameStates for UI and unit work (V2-SPEC §8.4 M0 gate). Owner: WS1.
// Runs the real loop with RefBot on the ai2027 preset (stub compute tracking refTotal and a stub cash floor until
// WS3/WS5 land) and saves day 0 / 400 / 900 to scripts/v2/fixtures/. Also checks the player's milestone days stay
// on the golden ai2027 timeline within the §7.1 tolerances.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_TOL } from '../../src/data/v2/calibration';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { serialize } from '../../src/engine/v2/core/save';
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
finish('fixtures');
