// SR-24b targeted check (run alone: npx tsx scripts/v2/_sr24b/check.ts): sourced safety parameters.
//  1. organism realism: the per-world draw is inside [0.4, 1.0]; a migrated save gets its seed's draw; physics (the
//     planted recall a validation samples) uses it, the believed reliability range does not;
//  2. validation cost 120 engineer-days, VAL_N 20, collusion 0.4 / lockdown 0.5;
//  3. undetected hacking: RH saturates toward the run's hack share within one reference post-train (and 42 stream days)
//     and does not accumulate past it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { ORGANISM_REALISM, VAL_DAYS, VAL_ENGINEERS, VAL_N } from '../../../src/data/v2/agendas';
import { COPY_COLLUSION } from '../../../src/data/v2/features';
import { LOCKDOWN_COLLUSION_MULT } from '../../../src/engine/v2/safety/safeguards';
import { organismRealismOf } from '../../../src/engine/v2/world/hidden';
import { instruments } from '../../../src/engine/v2/safety/instruments';
import { plantedRecall, trueRecall, validationRange } from '../../../src/engine/v2/safety/validation';
import { playerEnv, stepTraits, zeroSignals } from '../../../src/engine/v2/safety/traits';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));

// 1. Realism draw.
const draws = Array.from({ length: 2000 }, (_, i) => organismRealismOf(i * 7919 + 1));
const lo = Math.min(...draws), hi = Math.max(...draws), mean = draws.reduce((a, b) => a + b, 0) / draws.length;
check(lo >= ORGANISM_REALISM.lo && hi <= ORGANISM_REALISM.hi && hi - lo > 0.55 && Math.abs(mean - 0.7) < 0.02, 'realism draws span U[0.4, 1.0]', `min ${lo.toFixed(3)} max ${hi.toFixed(3)} mean ${mean.toFixed(3)}`);
const s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 95, 'migrates to SCHEMA_REV (>= 95)');
check(s.hidden.organismRealism === organismRealismOf(s.setup.seed), 'migrated save gets its seed\'s draw', `r ${s.hidden.organismRealism.toFixed(3)}`);
const v = internalVersion(s)!;
const t = instruments(s)[0];
const real = trueRecall(s, t, v);
t.measured = { on: v.id, found: 14, n: 20, day: s.time.day, human: true };
const rBefore = validationRange(s, t, v);
const p1 = plantedRecall(s, real);
s.hidden.organismRealism = 0.4;
const p04 = plantedRecall(s, real);
s.hidden.organismRealism = 1.0;
const p10 = plantedRecall(s, real);
const rAfter = validationRange(s, t, v);
check(Math.abs(p10 - real) < 1e-9 && Math.abs(p04 - Math.min(1, real / 0.4)) < 1e-9 && p04 >= p1 && p1 >= p10, 'physics: planted recall = real ÷ r', `real ${real.toFixed(3)}; planted at r 0.4 / world / 1.0: ${p04.toFixed(3)} / ${p1.toFixed(3)} / ${p10.toFixed(3)}`);
check(JSON.stringify(rBefore) === JSON.stringify(rAfter) && Math.abs(rBefore.value - 0.49) < 1e-9 && rBefore.lo < 0.4 * 0.7 && rBefore.hi > 0.7, 'believed reliability: 14 of 20 planted → stated range only, never the draw', `${rBefore.basis} ${rBefore.value.toFixed(3)} [${rBefore.lo.toFixed(3)}, ${rBefore.hi.toFixed(3)}]`);

// 2. Constants as sourced.
check(VAL_ENGINEERS * VAL_DAYS === 120 && VAL_N === 20, 'validation 120 engineer-days, 20 planted', `${VAL_ENGINEERS} × ${VAL_DAYS}`);
check(COPY_COLLUSION === 0.4 && LOCKDOWN_COLLUSION_MULT === 0.5, 'collusion 0.4, lockdown × 0.5 kept');

// 3. Undetected hacking saturates within a run.
const x0 = { ...v.traitsTrue, RH: 0.01, SYC: 0 };
const sg = zeroSignals();
const lineage = 'L-check';
const run = (x: typeof x0, omega: number, target: number) => {
  const env = playerEnv(s, x, sg, omega, undefined, lineage, [], v);
  env.removal = {}; env.amp = {}; env.hackTarget = target;
  return stepTraits(x, env);
};
const target = 0.3;
const one = run(x0, 0.6, target);
const two = run(one, 0.6, target);
check(one.RH >= 0.99 * target - 0.01 && one.RH <= target + 0.01, 'one reference post-train reaches the hack share', `RH 0.01 → ${one.RH.toFixed(3)} (target ${target})`);
check(Math.abs(two.RH - one.RH) < 0.01, 'a second run does not accumulate past it', `${one.RH.toFixed(3)} → ${two.RH.toFixed(3)}`);
let xs = x0;
for (let d = 0; d < 42; d++) xs = run(xs, 0.6 / 42, target);
const after42 = xs.RH;
for (let d = 0; d < 84; d++) xs = run(xs, 0.6 / 42, target);
check(after42 >= 0.98 * target - 0.01 && xs.RH <= target + 0.01, '42 stream days saturate; 84 more stay at the share', `${after42.toFixed(3)} → ${xs.RH.toFixed(3)}`);
const low = run({ ...x0, RH: 0.5 }, 0.6, target);
check(low.RH <= 0.5 + 1e-9, 'RH above the share is not pushed up', `0.5 → ${low.RH.toFixed(3)}`);
const old = (() => { const env = playerEnv(s, x0, { ...sg, S2: 0.3 }, 0.6, undefined, lineage, [], v); env.removal = {}; env.amp = {}; return stepTraits(x0, env); })();
check(true, 'reference: E02 alone (no hackTarget) at S2 0.3', `RH 0.01 → ${old.RH.toFixed(3)}`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
