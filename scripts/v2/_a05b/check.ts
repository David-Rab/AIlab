// RD-A05b targeted check: idle serving / training compute stays idle unless Auto-split is on; with it on the idle share
// moves to the listed use and is logged; a rev-55 save loses the spare policies. Run alone: npx tsx scripts/v2/_a05b/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { poolsOf } from '../../../src/engine/v2/compute/power';
import { idleServing } from '../../../src/engine/v2/worldfx/revenue';
import { expPoolH100e } from '../../../src/engine/v2/models/research';
import { synPoolH100e } from '../../../src/engine/v2/production/data';
import { internalFleetCompute } from '../../../src/engine/v2/safety/covert';
import { idleShares } from '../../../src/engine/v2/departments/autoSplit';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const s = deserialize(raw);
check(!s.player.policies.autoSplit.on && !('spareTraining' in s.player.policies) && !('spareServing' in s.player.policies), 'migrated policies: no spare policies, Auto-split off');
// Give serving far more than the products need: idle serving compute.
const sp = { ...s.player.split };
const dx = Math.min(sp.training, 0.1);
act(s, 'setSplit', { ...sp, training: sp.training - dx, serving: sp.serving + dx });
for (let d = 0; d < 3; d++) tick(s, { skip: ['endings'] });
const split0 = { ...s.player.split };
const idle0 = idleServing(s);
check(idle0 > 1000, 'idle serving compute exists', `${idle0.toFixed(0)} H100e`);
for (let d = 0; d < 5; d++) tick(s, { skip: ['endings'] });
check(JSON.stringify(s.player.split) === JSON.stringify(split0), 'Auto-split off: the allocation does not move');
check(idleServing(s) > 1000, 'Auto-split off: idle serving stays idle on the serving line', `${idleServing(s).toFixed(0)} H100e`);
const pools = poolsOf(s);
check(near(expPoolH100e(s), pools.experiments), 'experiments get only their own line (no idle training)');
check(near(synPoolH100e(s), pools.synthetic), 'data generation gets only its own line (no idle training)');
check(near(internalFleetCompute(s), pools.routine + pools.frontier), 'research agents get only their own lines (no idle serving)');

// Auto-split on, to experiments: the idle shares move there, logged.
const e0 = s.player.split.experiments;
const idle = idleShares(s);
const err = act(s, 'compute.autoSplit', { on: true, to: 'experiments' });
check(!err && s.player.policies.autoSplit.on, 'Auto-split turns on', err ?? '');
const logs0 = s.log.length;
tick(s, { skip: ['endings'] });
const moved = s.player.policies.autoSplit.last?.share ?? 0;
check(moved > 0.001 && s.player.split.experiments > e0 + 0.5 * idle.total && s.player.split.serving < split0.serving, 'Auto-split on: idle compute moves to experiments', `moved ${(moved * 100).toFixed(2)}%, experiments ${(e0 * 100).toFixed(2)}% → ${(s.player.split.experiments * 100).toFixed(2)}%`);
check(s.log.slice(logs0).some((l) => /Auto-split moved/.test(l.text)), 'Auto-split logs the move');
const serv1 = s.player.split.serving;
act(s, 'compute.autoSplit', { on: false });
for (let d = 0; d < 3; d++) tick(s, { skip: ['endings'] });
check(s.player.split.serving === serv1, 'Auto-split off again: nothing moves');

// A rev-55 save with the old policies loads without them.
const old = JSON.parse(serialize(s));
old.schemaRev = 55;
delete old.player.policies.autoSplit;
Object.assign(old.player.policies, { spareTraining: 'data', spareServing: 'research' });
const m = deserialize(JSON.stringify(old));
check(!('spareTraining' in m.player.policies) && !('spareServing' in m.player.policies) && m.player.policies.autoSplit?.on === false, 'migration 55 → 56');

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
