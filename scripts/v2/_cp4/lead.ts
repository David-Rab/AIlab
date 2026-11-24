// CP4 check (npx tsx scripts/v2/_cp4/lead.ts): the intel lead estimate (actors/intel.ts updateIntel) measures the
// player by its best MEASURED version, not by the best version by true G (which on the day-400 fixture is a version still
// in testing). Raising the true G of the in-testing version leaves every lab's weekly estimate unchanged (same rng);
// raising the measured version's G moves it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { updateIntel } from '../../../src/engine/v2/actors/intel';
import { activeRivals, bestMeasuredVersion, bestPlayerVersion } from '../../../src/engine/v2/models/labs';
import { check, finish, FIXTURE_DIR } from '../lib';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const labs = (s: GameStateV2) => [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
function estimates(s: GameStateV2): number[] {
  const ctx = makeCtx(s);
  return labs(s).map((r) => { updateIntel(s, ctx, r); return r.intel.leadDaysEst; });
}

const s0 = load();
const top = bestPlayerVersion(s0);
const meas = bestMeasuredVersion(s0);
check(!!top && !!meas && top.id !== meas.id && top.evals.measuredL === undefined,
  'premise: the best version by true G is still in testing (not the best measured one)', `${top?.name} vs ${meas?.name}`);

const base = estimates(load());
const s1 = load();
for (const v of s1.player.models.versions) if (v.id === top?.id) v.G += 0.5;
const testing = estimates(s1);
check(base.every((x, i) => x === testing[i]), 'the in-testing version\'s true G does not move the lead estimates',
  `${base.join(' / ')} vs ${testing.join(' / ')}`);

const s2 = load();
for (const v of s2.player.models.versions) if (v.id === meas?.id) v.G -= 0.3;
const lower = estimates(s2);
check(lower.every((x, i) => x < base[i]), 'a lower measured version lowers every lab\'s lead estimate',
  `${base.join(' / ')} vs ${lower.join(' / ')}`);
finish('cp4-lead');
