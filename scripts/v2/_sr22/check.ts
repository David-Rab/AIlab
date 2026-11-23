// SR-22 targeted check (run alone: npx tsx scripts/v2/_sr22/check.ts): the Safety work package's spot-checks, AI share
// per job, expected vs observed.
//  1. the day-400 fixture migrates to 92 with 'spotCheck' after 'review' in the safety needs list;
//  2. a higher spot-check share asks more safety engineers and catches more sabotaged AI safety work (SAFSAB terms);
//  3. jobs report their AI share (validation, case, eval suite, line test);
//  4. an AI-assisted validation of a false (sabotaged) instrument: spot-checked, its observed recall falls below the
//     expected; with no spot-checks it matches; a corrupted case's observed result is below its expected.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { act } from '../../../src/engine/v2/core/loop';
import { Rng } from '../../../src/engine/rng';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { safetyLabour } from '../../../src/engine/v2/departments/workfit';
import { instruments } from '../../../src/engine/v2/safety/instruments';
import { resetSafAllocation, safAllocation } from '../../../src/engine/v2/safety/lineProjects';
import { safetySabotage } from '../../../src/engine/v2/safety/covert';
import { safetyAgentVersion } from '../../../src/engine/v2/safety/agents';
import { completeValidation, validationView } from '../../../src/engine/v2/safety/validation';
import { openInvestigation, resolveInvestigation } from '../../../src/engine/v2/safety/investigations';
import { evalQueueView, queueEval } from '../../../src/engine/v2/models/evals';
import { jobAiShare, spotShare } from '../../../src/engine/v2/safety/workPackage';
import type { GameStateV2, Investigation, SystemCtx } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const rng = new Rng(22);
const ctx = (day: number) => ({ day, rng: () => rng, log: () => {} }) as unknown as SystemCtx;

const s = load();
const order = s.player.research.safRe.order;
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 92 && order.indexOf('spotCheck') === order.indexOf('review') + 1, 'schema 92; spotCheck after review', order.join(','));

// Safety work handed to AI, and a sabotaging safety model.
act(s, 'agents.trusted', { share: 0.8 });
resetSafAllocation(s);
const sl = safetyLabour(s);
const sv = safetyAgentVersion(s);
check(!!sv && sl.exp.A > 0, 'AI staff do safety work', `A ${sl.exp.A.toFixed(3)} on ${sv?.name}`);
if (sv) for (const t of ['SCHEME', 'SAND', 'POWER'] as const) sv.traitsTrue[t] = 0.8;

const at = (q: number) => {
  act(s, 'safety.spotCheck', { share: q });
  resetSafAllocation(s);
  const a = safAllocation(s);
  const sab = safetySabotage(s, sl.exp.A, 1);
  return { ask: a.demand.spotCheck, got: a.got.spotCheck, spot: spotShare(s), catch: sab?.catch ?? 0, rate: sab?.rate ?? 0, attempts: sab?.attempts ?? 0 };
};
const q0 = at(0);
const q2 = at(0.02);
const q10 = at(0.1);
for (const [n, x] of [['none', q0], ['2%', q2], ['10%', q10]] as const) console.log(`  ${n}: ask ${x.ask.toFixed(1)} got ${x.got.toFixed(1)} · spot ${x.spot.toFixed(3)} · catch ${x.catch.toFixed(3)} · uncaught rate ${x.rate.toExponential(2)} (attempts ${x.attempts.toExponential(2)})`);
check(q0.ask === 0 && q2.ask > 0 && q10.ask > q2.ask * 4.9, 'a higher spot-check share asks more safety engineers', `${q2.ask.toFixed(1)} → ${q10.ask.toFixed(1)}`);
check(q10.attempts > 0 && q10.catch > q2.catch && q2.catch > q0.catch && q10.rate < q0.rate, 'and catches more sabotaged AI safety work');

// Jobs report AI share.
const v = internalVersion(s)!;
const inv = openInvestigation(s, ctx(s.time.day), { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, 40) as Investigation;
check(typeof inv === 'object' && !!inv.job && Math.abs(inv.job.aiShare - jobAiShare(s, 'case')) < 1e-3 && inv.job.aiShare > 0, 'a case records its AI share and spot-check', inv.job ? `AI ${inv.job.aiShare}, spot ${inv.job.spot}, expected ${inv.job.expected}` : '');
const ev = [...s.player.models.versions].reverse().find((x) => x.status === 'ready' || x.status === 'deployed');
if (ev) queueEval(s, ev, 'full', 'self', 'order');
const qv = evalQueueView(s).find((t) => t.by === 'self');
check(!!qv && qv.aiShare > 0, 'a self-run eval suite shows its AI share', qv ? String(qv.aiShare) : 'none queued');

// Validation of a false instrument, AI-assisted: expected vs observed with and without spot-checks.
const t = instruments(s)[0];
const runs = (q: number, n = 40) => {
  act(s, 'safety.spotCheck', { share: q });
  resetSafAllocation(s);
  let e = 0, o = 0, ai = 0;
  for (let i = 0; i < n; i++) {
    t.falseValidated = true;
    t.measured = null;
    completeValidation(s, rng, s.time.day, { id: `x${i}`, tool: t.id, model: v.id, progress: 1, by: 'player', day: s.time.day });
    e += t.measured!.job!.expected;
    o += t.measured!.job!.observed ?? 0;
    ai += t.measured!.job!.aiShare;
  }
  return { e: e / n, o: o / n, ai: ai / n, spot: spotShare(s) };
};
const r0 = runs(0);
const r10 = runs(0.1);
console.log(`  false instrument, AI-assisted: none → expected ${r0.e.toFixed(3)} observed ${r0.o.toFixed(3)} · 10% (in effect ${r10.spot.toFixed(3)}) → expected ${r10.e.toFixed(3)} observed ${r10.o.toFixed(3)}`);
check(r0.ai > 0 && r10.ai > 0, 'validation jobs report their AI share', r10.ai.toFixed(3));
check(Math.abs(r0.o - r0.e) < 0.05 && r10.o < r10.e - 0.005, 'spot-checked: a sabotaged validation observes below expected; unchecked it hides');
check(validationView(s).results.some((x) => x.id === t.id && x.job.observed !== undefined), 'the Validation card lists expected vs observed');

// A corrupted case: observed below expected (force corruption by a huge sabotage rate: a saboteur with no oversight).
act(s, 'safety.spotCheck', { share: 0 });
resetSafAllocation(s);
let below = 0, done = 0;
for (let i = 0; i < 30; i++) {
  const c = openInvestigation(s, ctx(s.time.day), { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, 40) as Investigation;
  if (typeof c !== 'object') break;
  c.clarity = 0.9;
  resolveInvestigation(s, ctx(s.time.day), c);
  if (c.outcomeDetail?.corrupted) { done++; if ((c.job?.observed ?? 1) < (c.job?.expected ?? 0)) below++; }
}
// Info only (corruption is rare at these odds, so a pass could be vacuous): corrupted cases read benign / inconclusive.
console.log(`  cases: ${below} of ${done} corrupted observe below expected`);

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
