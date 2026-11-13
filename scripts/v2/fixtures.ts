// Fixture GameStates for UI and unit work (V2-SPEC §8.4 M0 gate). Owner: WS1.
// Runs the real loop (stub systems + the M0 placeholder progress) on the ai2027 preset and saves day 0 / 400 / 900
// to scripts/v2/fixtures/. Also checks the placeholder reproduces the golden ai2027 milestone days.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { serialize } from '../../src/engine/v2/core/save';
import type { MilestoneIdx } from '../../src/engine/v2/types';
import { FIXTURE_DIR, GOLDEN_PATH, check, finish, runTo, validateJson } from './lib';

export const FIXTURE_SETUP = defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', companyName: 'OpenBrain' });
export const FIXTURE_DAYS = [0, 400, 900] as const;

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as { presets: { ai2027: { days: Record<string, number> } } };
const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'];

mkdirSync(FIXTURE_DIR, { recursive: true });
const s = newGame(FIXTURE_SETUP);
for (const day of FIXTURE_DAYS) {
  runTo(s, day);
  const errs = validateJson(s);
  check(errs.length === 0, `fixture day ${day} is plain JSON`, errs.slice(0, 3).join('; '));
  const json = serialize(s);
  const file = join(FIXTURE_DIR, `day${day}.json`);
  writeFileSync(file, json);
  console.log(`      wrote ${file} (${(json.length / 1024).toFixed(0)} KB, measured L ${s.player.models.versions[0].evals.measuredL})`);
}

// Placeholder progress must preserve the audited timeline: player milestone days = golden days (±1 d).
const g = golden.presets.ai2027.days;
NAMES.forEach((n, i) => {
  const want = g[n];
  const got = s.player.milestoneDays[i as MilestoneIdx];
  if (want === undefined || want > s.time.day) return;
  check(got !== undefined && Math.abs(got - want) <= 1, `player ${n} on golden day`, `got ${got} want ${want}`);
});
finish('fixtures');
