// SR-09 targeted check (run alone: npx tsx scripts/v2/_sr09/check.ts): validation jobs replace tool upkeep.
//  1. the day-400 fixture migrates (empty queue, policy on, measured null, need 'validation');
//  2. the policy queues every owned instrument on the internal model; staffed jobs finish in VAL_DAYS and set
//     "validated on" + a measured reliability near the true recall (binomial sample of VAL_N);
//  3. no upkeep drift: oHalf is unchanged by the daily step; no upkeep code is left in src;
//  4. away from the measured model the believed range is wider.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { VAL_DAYS, VAL_N } from '../../../src/data/v2/agendas';
import { deserialize } from '../../../src/engine/v2/core/save';
import { Rng } from '../../../src/engine/rng';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { instruments } from '../../../src/engine/v2/safety/instruments';
import { versionOom } from '../../../src/engine/v2/safety/oversight';
import { completeValidation, jobEngineers, trueRecall, validationRange, validationStep } from '../../../src/engine/v2/safety/validation';
import type { GameStateV2, SystemCtx } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const s = load();
const v = internalVersion(s)!;
const val = s.player.safety.validation;
check(!!val && val.jobs.length === 0 && val.autoNew && Object.values(s.player.safety.techniques).every((t) => t.measured === null)
  && (s.player.research.safRe?.order ?? []).includes('validation') && !(s.player.research.safRe?.order as string[] ?? []).includes('reval'), 'migration: empty queue, policy on, measured null, need renamed');

const rng = new Rng(9);
const logs: string[] = [];
const ctx = (day: number) => ({ day, rng: () => rng, log: (_k: string, t: string) => logs.push(t) }) as unknown as SystemCtx;
const own = instruments(s);
const oHalf0 = own.map((t) => t.oHalf);
// Day 1: the policy queues every owned instrument on the internal model.
validationStep(s, ctx(s.time.day), 0);
check(s.player.safety.validation!.jobs.length === own.length && s.player.safety.validation!.jobs.every((j) => j.model === v.id && j.by === 'policy'), 'policy queues every owned instrument on the internal model', `${s.player.safety.validation!.jobs.length} of ${own.length}`);
// Unstaffed: no progress, no drift.
for (let d = 0; d < 30; d++) validationStep(s, ctx(s.time.day + d), 0);
check(s.player.safety.validation!.jobs.every((j) => j.progress === 0) && own.every((t, i) => t.oHalf === oHalf0[i]), 'unstaffed: no progress and no oHalf drift (upkeep gone)');
// Fully staffed: every job finishes in VAL_DAYS.
const full = jobEngineers(s) * own.length;
for (let d = 0; d < VAL_DAYS; d++) validationStep(s, ctx(s.time.day + 30 + d), full);
check(s.player.safety.validation!.jobs.length === 0 && own.every((t) => t.measured?.on === v.id && t.validatedOn === v.id && t.validatedOom === versionOom(s, v)), `staffed jobs finish in ${VAL_DAYS} d and set validated on ${v.name}`, logs.slice(-1)[0]);
check(own.every((t, i) => t.oHalf === oHalf0[i]), 'validation does not move oHalf');
for (const t of own) {
  const p = trueRecall(s, t, v);
  const m = t.measured!;
  const sd = Math.sqrt(Math.max(p * (1 - p), 0.01) / VAL_N);
  check(Math.abs(m.found / m.n - p) <= 3 * sd + 1e-9, `${t.id}: measured ${m.found}/${m.n} near true recall ${p.toFixed(3)}`);
}
// Many samples average to the true recall.
const t0 = own[0];
const p0 = trueRecall(s, t0, v);
let sum = 0;
const K = 400;
for (let i = 0; i < K; i++) { completeValidation(s, rng, s.time.day, { id: 'x', tool: t0.id, model: v.id, progress: 1, by: 'player', day: 0 }); sum += t0.measured!.found / t0.measured!.n; }
check(Math.abs(sum / K - p0) < 0.02, `measurements are unbiased: mean of ${K} = ${(sum / K).toFixed(3)} vs true ${p0.toFixed(3)}`);
// Range: measured on v; a hypothetical model 2 OOM further shows a wider, extrapolated range.
const r = validationRange(s, t0, v);
const far = { ...v, id: 'V-far', evals: { ...v.evals, measuredL: (v.evals.measuredL ?? 0) + 2 } };
s.player.models.versions.push(far as typeof v);
(far as { oom?: number }).oom = undefined;
const rf = validationRange(s, t0, far as typeof v);
check(r.basis === 'measured' && (rf.basis === 'extrapolated' ? rf.hi - rf.lo >= r.hi - r.lo - 1e-9 : true), `range: measured ${Math.round(r.lo * 100)}–${Math.round(r.hi * 100)}% · ${rf.basis} on a further model ${Math.round(rf.lo * 100)}–${Math.round(rf.hi * 100)}% (gap ${rf.gap.toFixed(2)})`);
const unmeasured = validationRange(load(), load().player.safety.techniques[t0.id], v);
check(unmeasured.basis === 'unmeasured' && unmeasured.hi - unmeasured.lo > r.hi - r.lo, `never measured: wider range ${Math.round(unmeasured.lo * 100)}–${Math.round(unmeasured.hi * 100)}%`);

// No upkeep code left in src.
const bad: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f) && /upkeepStep|upkeepState|upkeepTools|revalDemand|reValidationMult|UPKEEP_|toolUpkeep|RE_SERIOUS/.test(readFileSync(p, 'utf8'))) bad.push(p); } };
walk('src');
check(!bad.length, 'no tool-upkeep code in src', bad.join(', '));
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
