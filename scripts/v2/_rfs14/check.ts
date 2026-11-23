// RF-S14 check (npx tsx scripts/v2/_rfs14/check.ts): validating a safety method is the instruments' validation job; its
// k of n narrows the lab's q range most at the validated model, widening back above it; the preview and predicted beliefs
// read the narrowed range; organism realism applies; hidden truth (q, r) is not read by the readouts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { Rng } from '../../../src/engine/rng';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { METHOD_SCALE, VAL_N } from '../../../src/data/v2/agendas';
import { methodLines, methodQRange, methodStrength, methodUntested, ownedMethods, plantedRemoval } from '../../../src/engine/v2/safety/methods';
import { canValidate, completeValidation, jobEngineers, queueValidation, validationDemand } from '../../../src/engine/v2/safety/validation';
import { measuredOom } from '../../../src/engine/v2/safety/oversight';
import { predictBeliefs, zeroSignals } from '../../../src/engine/v2/safety/traits';
import { SAFETY_ACTIONS } from '../../../src/engine/v2/safety/actions';
import { gV0 } from '../../../src/engine/v2/models/capability';
import type { GameStateV2, PostDesign, RngLike } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const f2 = (x: number) => x.toFixed(2);

const s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 102, 'day 400 migrates to 102');
const iv = internalVersion(s)!;
const xv = measuredOom(s, iv);
const owned = ownedMethods(s);
const id = owned.find((m) => methodUntested(m, xv) >= 0.99) ?? owned.find((m) => methodUntested(m, xv) > 0)!;
console.log(`     internal model ${iv.name} at +${f2(xv)} OOM; owned methods ${owned.join(', ')}; using ${id} (τ ${f2(methodUntested(id, xv))})`);
const within = owned.find((m) => methodUntested(m, xv) <= 0);
if (within) check(canValidate(s, within, iv.id) !== true, `a method within its tested scale is refused (${within})`, String(canValidate(s, within, iv.id)));
check(canValidate(s, id, iv.id) === true, 'an outgrown method can be validated on the internal model');

// Same job: queue → the 'validation' need's demand grows by one job's engineers.
const pv = SAFETY_ACTIONS.find((a) => a.id === 'safety.validate')!.preview(s, { tool: 'methods' });
console.log(`     validate methods preview: ${pv.gains[0]?.target}`);
check(pv.gains.length === 1 && pv.costs[0].amount > 0, 'validate methods preview: the same job cost, what it measures');
const d0 = validationDemand(s);
const job = queueValidation(s, id, iv.id, 'player', s.time.day);
check(typeof job !== 'string' && Math.abs(validationDemand(s) - d0 - jobEngineers(s)) < 1e-9, 'a method job is one validation job in the same need', `demand +${f2(validationDemand(s) - d0)}`);
check(canValidate(s, id, iv.id) !== true, 'a second job on it is refused (queued)');

const before = methodQRange(s, id, xv);
check(before.lo === METHOD_SCALE.lo && before.hi === METHOD_SCALE.hi, 'before: the stated range', `${f2(before.lo)}–${f2(before.hi)}`);
const g = iv.G;
const post = { ...(iv.design as PostDesign), methods: [id] };
const line0 = methodLines(s, post, undefined, g).gains[0]?.target ?? '';
const prior = iv.beliefs;
const ends0 = [methodStrength(s, id, g - gV0(s.hidden.timeline), 'believed', 'lo'), methodStrength(s, id, g - gV0(s.hidden.timeline), 'believed', 'hi')];
const pred0 = predictBeliefs(s, prior, zeroSignals(), 1, post, iv.lineage, 1, undefined, 0, g);

completeValidation(s, new Rng(7) as unknown as RngLike, s.time.day, job as Exclude<typeof job, string>);
const m = s.player.safety.techniques[id].measured!;
check(m.on === iv.id && m.n === VAL_N && m.found >= 0 && m.found <= VAL_N, 'the job records k of n planted cases removed', `${m.found} of ${m.n}`);
check(s.player.safety.techniques[id].trust === undefined, 'no instrument trust factor written for a method');

const at = methodQRange(s, id, xv);
const up1 = methodQRange(s, id, xv + 1);
const up2 = methodQRange(s, id, xv + METHOD_SCALE.k);
const w = (r: { lo: number; hi: number }) => r.hi - r.lo;
console.log(`     q range at +0: ${f2(at.lo)}–${f2(at.hi)}; +1 OOM: ${f2(up1.lo)}–${f2(up1.hi)}; +${METHOD_SCALE.k}: ${f2(up2.lo)}–${f2(up2.hi)} (true q ${f2(s.hidden.methodScale[id])})`);
check(w(at) < w(before) - 0.05, 'after: narrower at the validated model', `${f2(w(before))} → ${f2(w(at))}`);
check(w(up1) > w(at) && w(up1) < w(before), 'wider again above it', `+1 OOM ${f2(w(up1))}`);
check(Math.abs(up2.lo - METHOD_SCALE.lo) < 1e-9 && Math.abs(up2.hi - METHOD_SCALE.hi) < 1e-9, `back to the stated range at +${METHOD_SCALE.k} OOM`);

const line1 = methodLines(s, post, undefined, g).gains[0]?.target ?? '';
console.log(`     before: ${line0}\n     after:  ${line1}`);
check(/your validation on/.test(line1) && line1 !== line0, 'the run preview reads the narrowed range');
const pred1 = predictBeliefs(s, prior, zeroSignals(), 1, post, iv.lineage, 1, undefined, 0, g);
// predictBeliefs runs the mechanism at the ends of the lab's range ('lo' / 'hi'): those ends are the narrowed ones now.
const oG = g - gV0(s.hidden.timeline);
const ends = [methodStrength(s, id, oG, 'believed', 'lo'), methodStrength(s, id, oG, 'believed', 'hi')];
check(ends[0] > ends0[0] + 0.05 && ends[1] <= ends0[1] + 1e-12, 'predicted beliefs read the narrowed ends', `strength ${f2(ends0[0])}–${f2(ends0[1])} → ${f2(ends[0])}–${f2(ends[1])}`);
const dC = pred1.CONCEAL.est - pred0.CONCEAL.est;
check(pred1.CONCEAL.est !== pred0.CONCEAL.est, 'the prediction moves with the narrowed range (CONCEAL, the edge the method cuts)', `est ${dC.toExponential(2)}, sd ${f2(pred0.CONCEAL.sd)} → ${f2(pred1.CONCEAL.sd)}`);

// Truth not read: rewrite the hidden q and organism realism; readouts unchanged.
const q0 = s.hidden.methodScale[id], r0 = s.hidden.organismRealism;
s.hidden.methodScale[id] = q0 > 1 ? 0.1 : 1.9;
s.hidden.organismRealism = r0 > 0.7 ? 0.4 : 1.0;
const same = JSON.stringify(methodQRange(s, id, xv)) === JSON.stringify(at) && methodLines(s, post, undefined, g).gains[0]?.target === line1
  && JSON.stringify(predictBeliefs(s, prior, zeroSignals(), 1, post, iv.lineage, 1, undefined, 0, g)) === JSON.stringify(pred1);
check(same, 'range, preview and prediction unchanged with the hidden q and r rewritten');
s.hidden.methodScale[id] = q0; s.hidden.organismRealism = r0;

// Engine: the true share follows the true q at that model (and organism realism, the one rule).
const meanFound = (q: number, r: number) => {
  const t = load();
  t.hidden.methodScale[id] = q; t.hidden.organismRealism = r;
  const v = internalVersion(t)!;
  const rng = new Rng(11) as unknown as RngLike;
  let sum = 0;
  for (let i = 0; i < 200; i++) {
    t.player.safety.techniques[id].measured = null;
    completeValidation(t, rng, t.time.day, { id: 'x', tool: id, model: v.id, progress: 1, by: 'player', day: 0, human: true });
    sum += t.player.safety.techniques[id].measured!.found;
  }
  return { k: sum / 200, p: plantedRemoval(t, id, 'true', v.G - gV0(t.hidden.timeline)) };
};
const lo = meanFound(0.2, 1), hi = meanFound(1.8, 1), easy = meanFound(0.2, 0.4);
check(hi.k > lo.k + 1, 'a method that holds at scale removes more planted cases', `q 0.2: ${f2(lo.k)} of ${VAL_N} (true real share ${f2(lo.p)}); q 1.8: ${f2(hi.k)}`);
check(easy.k > lo.k, 'organism realism: planted cases are easier (r 0.4 removes more than r 1)', `${f2(easy.k)} vs ${f2(lo.k)}`);

// Coverage (info): across hidden q, how often the true q lies in the lab's range at the validated model.
let inside = 0;
const N = 100;
for (let i = 0; i < N; i++) {
  const t = load();
  const q = (METHOD_SCALE.hi * (i + 0.5)) / N;
  t.hidden.methodScale[id] = q;
  const v = internalVersion(t)!;
  completeValidation(t, new Rng(100 + i) as unknown as RngLike, t.time.day, { id: 'x', tool: id, model: v.id, progress: 1, by: 'player', day: 0, human: true });
  const r = methodQRange(t, id, measuredOom(t, v));
  if (q >= r.lo - 1e-9 && q <= r.hi + 1e-9) inside++;
}
console.log(`     info: true q inside the lab's range in ${inside} of ${N} worlds (believed efficacy ≠ true efficacy can shift it)`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
