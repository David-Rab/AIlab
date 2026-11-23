// RF-S1 targeted check (run alone: npx tsx scripts/v2/_rfs1/check.ts).
//  1. the framework's Misalignment-signs rule reads the upper end of the 90% range: a low best guess with a wide range
//     triggers it, a low tight belief does not (no clarity gate);
//  2. the trusted rule reads the same upper end, and a model measured below the scheming act's capability level is
//     trusted whatever its beliefs (OD-6 capability clause); a never-measured wide-belief model is not trusted;
//  3. info: what the training rules ask on the day-0 / day-400 / day-900 fixtures (before the daily system: since RF-S13
//     the framework applies its package then, so only what it cannot meet stays held; scripts/v2/_rfs13).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { frameworkOf, ruleTriggered, trainingHolds } from '../../../src/engine/v2/safety/framework';
import { trustOf } from '../../../src/engine/v2/safety/trusted';
import { DANGER_ACTS } from '../../../src/data/v2/danger';
import type { GameStateV2, ModelVersion, TraitBelief } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (f: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
const setBel = (v: ModelVersion, est: number, sd: number) => { for (const tr of ['SCHEME', 'AF', 'SAND'] as const) v.beliefs[tr] = { est, sd, clarity: 0.9, evidence: [] } as TraitBelief; };

const s = load('day400.json');
const rule = frameworkOf(s).rules.find((r) => r.id === 'misalignment')!;
const v = s.player.models.versions.find((x) => x.evals.suiteDay !== undefined)!;
setBel(v, 0.1, 0.15);
check(!!ruleTriggered(rule, v), 'best guess 10% with sd 15 pts (top ≈ 35%) triggers the 30% rule', ruleTriggered(rule, v));
setBel(v, 0.1, 0.05);
check(!ruleTriggered(rule, v), 'best guess 10% with sd 5 pts (top ≈ 18%) does not');
setBel(v, 0.35, 0.02);
for (const tr of ['SCHEME', 'AF', 'SAND'] as const) v.beliefs[tr].clarity = 0.1;
check(!!ruleTriggered(rule, v), 'low clarity no longer exempts a model', ruleTriggered(rule, v));

// 2. trusted rule
const sch = DANGER_ACTS.SCHEME!;
const t = s.player.models.versions.find((x) => x.evals.suiteDay !== undefined)!;
setBel(t, 0.1, 0.05);
check(trustOf(s, t).trusted, 'tight low belief: trusted', trustOf(s, t).why);
setBel(t, 0.1, 0.15);
const md = t.evals.measuredDom ??= {} as NonNullable<typeof t.evals.measuredDom>;
md[sch.domain] = sch.theta + 1;
check(!trustOf(s, t).trusted, 'wide belief, measured above the scheming level: not trusted', trustOf(s, t).why);
md[sch.domain] = sch.theta - 1;
check(trustOf(s, t).trusted && trustOf(s, t).why.includes('below the level'), 'wide belief, measured below the scheming level: trusted (capability clause)', trustOf(s, t).why);
const saved = t.evals.suiteDay;
t.evals.suiteDay = undefined;
check(!trustOf(s, t).trusted && trustOf(s, t).why.includes('not measured'), 'never measured, wide belief: not trusted', trustOf(s, t).why);
t.evals.suiteDay = saved;

// 3. info
for (const f of ['day0.json', 'day400.json', 'day900.json']) {
  const x = load(f);
  const h = trainingHolds(x);
  console.log(`info ${f}: training holds ${h.length ? h.map((y) => `${y.ruleId} on ${y.versionId}: needs ${y.missing.join(', ')}`).join('; ') : 'none'}`);
  for (const m of x.player.models.versions.filter((y) => y.status === 'ready' || y.status === 'deployed')) console.log(`     ${trustOf(x, m).why}`);
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
