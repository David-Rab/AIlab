// UB-5c check: the "Lend idle training compute" policy. Run: npx tsx scripts/v2/_ub5c/check.ts [--hash]
// 1. Off: the day-400 fixture under RefBot for 60 days hashes the same as before the policy existed (`--hash` prints
//    the hash; the baseline was taken on rd a8b0ca1).
// 2. On, no training run: research experiments get the idle training compute (experiment FLOP = (experiments pool +
//    idle training) × throughput) and Training shows no idle.
// 3. On, a run launches and trains: the run's training FLOP per day equals the policy-off value the same day (full
//    share), and the lent compute shrinks by what the run uses.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { check, finish, FIXTURE_DIR, runRef } from '../lib';
import { idleTrainingShare, trainingFlopPerDay } from '../../../src/engine/v2/models/runs';
import { expPoolH100e } from '../../../src/engine/v2/models/research';
import { poolsOf } from '../../../src/engine/v2/compute/power';
import * as E from '../../../src/engine/v2';
import { RUN_PARAM_DEFAULTS } from '../../../src/engine/v2/models/actions';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const load = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')) as GameStateV2;
const hash = (s: GameStateV2) => createHash('sha256').update(serialize(s)).digest('hex').slice(0, 16);
const BASELINE = '7c7639d2088b2e4d';

const s0 = load();
runRef(s0, s0.time.day + 60);
const h = hash(s0);
if (process.argv.includes('--hash')) { console.log(h); process.exit(0); }
check(h === BASELINE, 'Policy off: day-400 fixture + RefBot 60 days hashes as on rd', `${h} vs ${BASELINE}`);

const lend = (E as unknown as { lentTrainingH100e?: (s: GameStateV2) => number }).lentTrainingH100e;
const s1 = load();
const idleH = idleTrainingShare(s1) * poolsOf(s1).training;
const expOff = expPoolH100e(s1);
(s1.player.policies as { lendTraining?: boolean }).lendTraining = true;
check(idleH > 1000, 'Fixture has idle training compute', `${Math.round(idleH)} H100e`);
check(Math.abs(expPoolH100e(s1) - (expOff + idleH)) < 1e-6 * idleH, 'On: research experiments get the idle training compute', `${Math.round(expOff)} + ${Math.round(idleH)} → ${Math.round(expPoolH100e(s1))}`);
check(!!lend && Math.abs(lend(s1) - idleH) < 1e-6, 'On: lent = idle training compute', String(lend?.(s1)));
check(E.idleShares(s1).training === 0, 'On: Training shows no idle (it is lent)', String(E.idleShares(s1).training));

// A run launches and trains: put it straight into training (setup done) and compare the same day, policy on vs off.
const s2 = load();
const act = (x: GameStateV2) => E.act(x, 'launchPost', { ...RUN_PARAM_DEFAULTS });
const sOn = load();
(sOn.player.policies as { lendTraining?: boolean }).lendTraining = true;
const rOff = act(s2);
const rOn = act(sOn);
check(rOff === rOn && !rOff, 'A run launches with the policy on and off', `${rOff} / ${rOn}`);
for (const x of [s2, sOn]) for (const r of x.player.models.runs) if (r.status === 'running') r.setupId = undefined;
check(trainingFlopPerDay(sOn) === trainingFlopPerDay(s2), 'On: the training pool is untouched (the run gets its full share)', `${trainingFlopPerDay(sOn)} vs ${trainingFlopPerDay(s2)}`);
const lentAfter = lend ? lend(sOn) : NaN;
const idleAfter = idleTrainingShare(sOn) * poolsOf(sOn).training;
check(Math.abs(lentAfter - idleAfter) < 1e-6 && lentAfter < idleH, 'On: the moment the run trains, the lent compute returns (only what it leaves idle stays lent)', `${Math.round(idleH)} → ${Math.round(lentAfter)}`);
finish('ub5c');
