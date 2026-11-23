// SR-16b targeted check (run alone: npx tsx scripts/v2/_sr16b/check.ts): an environment fix takes real time. Ordered
// (the patch response or safety.envFix from Training › Environments) it is a job on the 'envFix' need; the family's fix
// is in force only once the job's engineer-days are done; the preview's days match the days it takes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { applyResponse } from '../../../src/engine/v2/safety/responses';
import { envFixPreview, envFixRate, envFixStep } from '../../../src/engine/v2/safety/envFix';
import { SAFETY_ACTIONS } from '../../../src/engine/v2/safety/actions';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 96 && Array.isArray(s.player.safety.envFixJobs) && s.flags['ws2.patchUntil'] === undefined, 'migrates to 96: envFixJobs [], no patchUntil flag', `rev ${s.schemaRev}`);

const m0 = s.player.safety.envFixes?.swe?.mult ?? 1;
const pv = envFixPreview(s, 'swe');
const act = SAFETY_ACTIONS.find((a) => a.id === 'safety.envFix')!;
const lines = act.preview(s, { family: 'swe' });
check(pv.family === 'swe' && !pv.block && lines.costs.some((c) => /engineer-days/.test(c.target ?? '')), 'Environments preview: family, work, days at today\'s staffing', `work ${pv.work.join('–')} ed, ${pv.fte.toFixed(1)} eng, ${pv.days.join('–')} d`);
const ctx0 = makeCtx(s);
act.apply(s, ctx0, { family: 'swe' });
const job = s.player.safety.envFixJobs?.[0];
check(!!job && job.family === 'swe' && job.done === 0 && (s.player.safety.envFixes?.swe?.mult ?? 1) === m0, 'ordering queues a job; the fix is not in force yet', `work ${job?.work}`);
const again = applyResponse(s, ctx0, 'patchSignal', internalVersion(s)!.id, undefined, { trait: 'RH', family: 'swe' });
check(!!again && s.player.safety.envFixJobs!.length === 1, 'one fix per family at a time', again ?? '');

let doneDay = -1;
const start = s.time.day;
let early = false;
for (let d = 1; d <= 400 && doneDay < 0; d++) {
  s.time.day = start + d;
  const j = s.player.safety.envFixJobs?.[0];
  const ctx = makeCtx(s);
  envFixStep(s, ctx);
  const inForce = (s.player.safety.envFixes?.swe?.mult ?? 1) !== m0;
  if (inForce && j && j.done < j.work - 1e-9) early = true;
  if (inForce) doneDay = d;
}
const rate = envFixRate(s);
check(doneDay > 0 && !early && !s.player.safety.envFixJobs!.length, 'the fix comes into force only when its work is done; the job then ends', `done after ${doneDay} d (work ${job?.work} ed at ${pv.fte.toFixed(1)} eng/d)`);
check(doneDay >= pv.days[0] && doneDay <= pv.days[1], 'days taken within the preview\'s range', `${doneDay} in ${pv.days.join('–')}`);
const mult = s.player.safety.envFixes!.swe!.mult;
check(mult >= Math.max(0.2, m0 * 0.3) - 1e-3 && mult <= m0 * 0.6 + 1e-3, 'fix within the previewed range', `×${m0} → ×${mult}`);

// No engineers: the job waits.
const s2: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
applyResponse(s2, makeCtx(s2), 'patchSignal', internalVersion(s2)!.id, undefined, { trait: 'RH', family: 'swe' });
s2.player.research.safRe = { ...(s2.player.research.safRe ?? { order: [] }), max: { ...(s2.player.research.safRe?.max ?? {}), envFix: 0 } } as never;
for (let d = 1; d <= 200; d++) { s2.time.day++; envFixStep(s2, makeCtx(s2)); }
check(s2.player.safety.envFixJobs!.length === 1 && s2.player.safety.envFixJobs![0].done === 0, 'with no engineers on the need the fix waits (no time-based completion)', `rate ${rate.toFixed(1)}`);

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
