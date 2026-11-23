// UB-2b check (npx tsx scripts/v2/_ub2b/check.ts): the run forecast (runs.ts runForecast; the run card, skillGains, the
// launch preview) reads the lab's believed recipe and the measured build of the model a run starts from, never the true
// recipe or builds.
// 1. Truth not read: on the day-400 fixture and on a copy with the hidden recipe and build values rewritten (the true
//    know-how buckets and the ideas' true effects, every version's true G / levels / build, every base's true
//    pretraining part, the runs' true launch recipes), the forecasts of several plans are the same.
// 2. Honest band: over fixture launches (several plans from day 400 and from later days), the run's forecast frozen at
//    launch (run.forecast) against the measured level of the model it made once its evals finish: the share inside
//    ±1 sd and ±1.64 sd (90%) is reported.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx, tick } from '../../../src/engine/v2/core/loop';

import { check, finish, FIXTURE_DIR } from '../lib';
import { baseFromParams, postFromParams, RUN_PARAM_DEFAULTS } from '../../../src/engine/v2/models/actions';
import { forecastBand, launchRun, runForecast } from '../../../src/engine/v2/models/runs';
import { skillGains } from '../../../src/engine/v2/models/rdReadouts';
import { runCard, runBand } from '../../../src/engine/v2';
import { ACTION_BY_ID } from '../../../src/engine/v2/core/registry';
import type { GameStateV2, LaunchRunParams, ModelVersion } from '../../../src/engine/v2/types';

const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const f3 = (x: number | undefined) => (x === undefined ? '—' : x.toFixed(3));

/** Rewrite the hidden recipe and build values (observations made, eval records and beliefs stay). A base's physical
 *  part (gPre − ePre: FLOP, shape, tokens, data) is a fact, so its true pretraining part moves with its recipe part. */
function rewriteHidden(s: GameStateV2) {
  for (const k of ['pre', 'rlMid', 'rlCeil'] as const) for (const b of s.player.research.stacks[k].buckets) b.a *= 2.5;
  for (const a of s.player.research.adopted) a.eff *= 3;
  for (const v of s.player.models.versions) {
    v.G += 0.8;
    v.Lg += 1.3;
    for (const d of Object.keys(v.domains) as (keyof typeof v.domains)[]) v.domains[d] = v.domains[d] * 0.7 + 1.1;
    if (v.build) {
      v.build.gPre += 0.8; v.build.dg += 0.3; v.build.eRL += 0.4; v.build.aRL = (v.build.aRL ?? 0) + 0.2; v.build.dgRL += 0.5;
      for (const d of Object.keys(v.build.dgRLd) as (keyof typeof v.build.dgRLd)[]) v.build.dgRLd[d] = (v.build.dgRLd[d] ?? 0) + 0.5;
    }
  }
  for (const b of s.player.models.bases) { b.gPre += 0.8; b.ePre += 0.8; }
  for (const r of s.player.models.runs) {
    const rec = r.recipe as Record<string, unknown> | undefined;
    if (!rec) continue;
    for (const k of ['pre', 'rlMid', 'rlCeil']) if (typeof rec[k] === 'number') rec[k] = (rec[k] as number) + 0.5;
  }
}

const plans = (s: GameStateV2): Record<string, LaunchRunParams> => {
  const B = s.player.models.bases;
  const last = B[B.length - 1];
  const prev = B[B.length - 2] ?? last;
  const post = postFromParams(RUN_PARAM_DEFAULTS as never, s);
  const heavy = postFromParams({ ...RUN_PARAM_DEFAULTS, rlBudget: 'heavy' } as never, s);
  const measuredFull = s.player.models.versions.filter((v) => v.variant === 'full' && v.evals.measuredL !== undefined && v.status !== 'retired' && v.status !== 'rolledBack');
  const t = measuredFull[measuredFull.length - 1];
  return {
    newBase: { kind: 'base', base: baseFromParams(RUN_PARAM_DEFAULTS as never), poolShare: 0.6 },
    postLast: { kind: 'post', baseId: last.id, post, poolShare: 0.2 },
    heavyLast: { kind: 'post', baseId: last.id, post: heavy, poolShare: 0.6 },
    postPrev: { kind: 'post', baseId: prev.id, post, poolShare: 0.2 },
    ...(t ? {
      amplify: { kind: 'post', baseId: t.baseId, teacherVersionId: t.id, grader: 'teacher', post, poolShare: 0.3 },
      distil: { kind: 'distill', teacherVersionId: t.id, poolShare: 0.1 },
    } as Record<string, LaunchRunParams> : {}),
  };
};

function readouts(s: GameStateV2) {
  const ps = plans(s);
  const pv = ACTION_BY_ID.get('launchPost')?.preview(s, { baseId: ps.postLast.baseId! });
  return {
    forecasts: Object.fromEntries(Object.entries(ps).map(([k, p]) => [k, runForecast(s, p)])),
    gains: Object.fromEntries(Object.entries(ps).map(([k, p]) => [k, skillGains(s, p)])),
    cards: Object.fromEntries(Object.entries(ps).map(([k, p]) => { const c = runCard(s, p); return [k, { band: c.band, domains: c.domains, ref: c.forecastRef, sd: c.forecastSd }]; })),
    preview: pv?.gains.find((l) => l.currency === 'progress'),
  };
}

const canon = (x: unknown): string => JSON.stringify(x, (_k, v) => (typeof v === 'number' && Number.isFinite(v) && v !== 0 ? Number(v.toPrecision(9)) : v));
function diffs(a: unknown, b: unknown, path = ''): string[] {
  if (typeof a === 'number' && typeof b === 'number') return canon(a) === canon(b) ? [] : [`${path} ${a} vs ${b}`];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out: string[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diffs((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
    return out;
  }
  return canon(a) === canon(b) ? [] : [`${path} ${canon(a)} vs ${canon(b)}`];
}

// ── 1. truth not read ──
const A = load();
const Bw = load();
rewriteHidden(Bw);
const rA = readouts(A);
const rB = readouts(Bw);
for (const [k, fc] of Object.entries(rA.forecasts)) {
  console.log(`     ${k}: forecast ${f3(fc?.mid)} ± ${f3(fc?.sd)} (ideas ${f3(fc?.sdParts.ideas)}, start ${f3(fc?.sdParts.start)} ${fc?.startName ?? '—'}, eval ${f3(fc?.sdParts.eval)}); gain ${f3(fc?.gain)} over ${fc?.refName}`);
}
check(Object.values(rA.forecasts).every((f) => !!f && f.band[0] < f.mid && f.mid < f.band[1]), 'every plan has a forecast with a band');
for (const k of Object.keys(rA) as (keyof typeof rA)[]) {
  const a = canon(rA[k]);
  const b = canon(rB[k]);
  check(a === b, `${k}: unchanged when hidden recipe / build values are rewritten`, a === b ? '' : diffs(rA[k], rB[k]).slice(0, 6).join('; '));
}

// ── 2. band coverage over fixture launches ──
interface Case { name: string; mid: number; sd: number; got?: number; gotSd?: number; truth?: number }
const cases: Case[] = [];
/** Launch `p` on `s` (a copy), tick until the run's model is measured (a base: the default post-training on it, whose
 *  level the base's forecast is), and record forecast vs measured. */
function launchAndMeasure(name: string, s: GameStateV2, p: LaunchRunParams, maxDays: number) {
  const before = new Set(s.player.models.versions.map((v) => v.id));
  const beforeB = new Set(s.player.models.bases.map((b) => b.id));
  const run = launchRun(s, makeCtx(s), p);
  if (typeof run === 'string' || !run.forecast) { console.log(`     ${name}: not launched (${typeof run === 'string' ? run : 'no forecast'})`); return; }
  const c: Case = { name, mid: run.forecast.mid, sd: run.forecast.sd };
  check(canon(runBand(s, run)) === canon(forecastBand(run.forecast.mid, run.forecast.sd)), `${name}: run queue band is the launch forecast`);
  let follow = false;
  const end = s.time.day + maxDays;
  let made: ModelVersion | undefined;
  while (s.time.day < end) {
    tick(s, { skip: ['endings'] });
    if (p.kind === 'base' && !follow) {
      const nb = s.player.models.bases.find((b) => !beforeB.has(b.id));
      if (nb) {
        follow = true;
        const r2 = launchRun(s, makeCtx(s), { kind: 'post', baseId: nb.id, post: postFromParams(RUN_PARAM_DEFAULTS as never, s), poolShare: 0.6 });
        if (typeof r2 === 'string') { console.log(`     ${name}: follow-up post-training not launched (${r2})`); return; }
      }
      continue;
    }
    made = s.player.models.versions.find((v) => !before.has(v.id) && (p.kind === 'distill' ? v.variant === 'mini' : v.variant === 'full'));
    if (made?.evals.measuredL !== undefined) break;
  }
  if (made?.evals.measuredL !== undefined) { c.got = made.evals.measuredL; c.gotSd = made.evals.fitSd; c.truth = made.Lg; }
  cases.push(c);
}

const starts: { day: number; s: GameStateV2 }[] = [{ day: 400, s: load() }];
{
  const s = load();
  for (let i = 0; i < 45; i++) tick(s, { skip: ['endings'] });
  starts.push({ day: s.time.day, s: structuredClone(s) });
  for (let i = 0; i < 45; i++) tick(s, { skip: ['endings'] });
  starts.push({ day: s.time.day, s });
}
for (const st of starts) {
  for (const [k, p] of Object.entries(plans(st.s))) {
    const s = structuredClone(st.s);
    launchAndMeasure(`d${st.day} ${k}`, s, p, k === 'newBase' || k === 'heavyLast' ? 300 : 160);
  }
}
let in1 = 0, in90 = 0, n = 0;
for (const c of cases) {
  if (c.got === undefined) { console.log(`     ${c.name}: forecast ${f3(c.mid)} (sd ${f3(c.sd)}); not measured in time`); continue; }
  n++;
  const z = (c.got - c.mid) / c.sd;
  if (Math.abs(z) <= 1) in1++;
  if (Math.abs(z) <= 1.64) in90++;
  console.log(`     ${c.name}: forecast ${f3(c.mid)} (sd ${f3(c.sd)}) · measured ${f3(c.got)} (true ${f3(c.truth)}) · z ${z.toFixed(2)}`);
}
console.log(`     coverage: ${in90}/${n} inside the 90% range (the band shown), ${in1}/${n} inside ±1 sd`);
check(n >= 6, 'enough launches measured for the coverage rate', `${n}`);
check(n > 0 && in90 / n >= 0.5, 'the forecast band holds the measured result in most launches (90% range)', `${in90}/${n}`);
finish('ub2b');
