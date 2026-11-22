// Model v3 D7 evaluations as work (MODEL-V3 §10; src/engine/v2/models/evals.ts, src/data/v2/evals.ts). Owner: WS1.
//   EV1 deeper suites cost more work and compute; EV2 and measure with lower error (the drawn-once error shrinks by the
//   suites' weights); EV3 no fixed days: more research engineers on evals finish a suite faster; EV4 evals draw their
//   compute from the experiments pool (not serving), as far as the pool goes; EV5 the standing policy queues suites
//   (release gate at its depth, re-runs when a model changed or on the cadence, off = none); EV6 a version waits in
//   evaluation until its suite's work is done, and the gate 'none' releases it at once; EV7 independent evaluators keep
//   their extra elicitation (and work with their own staff); EV9 the reference lab's eval cost is
//   modest (a few % of its research engineers at most, a sliver of its experiment compute).
import { BENCHMARKS, ELICITATION } from '../../src/data/v2/benchmarks';
import { EVAL_DEPTHS, REEVAL_DAYS, REEVAL_DG } from '../../src/data/v2/evals';
import { inPlaceRecipe } from '../../src/engine/v2/models/stacks';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx, tick } from '../../src/engine/v2/core/loop';
import { StreamRng } from '../../src/engine/v2/core/rng';
import { poolsOf } from '../../src/engine/v2/compute/power';
import { MEASURE_SD, measureBench, measuredSd, runEvalSuite } from '../../src/engine/v2/models/benchmarks';
import {
  evalCost, evalDaysEstimate, evalsDay, openEval, policyModels, queueEval,
} from '../../src/engine/v2/models/evals';
import { capReCapacity, expPoolH100e } from '../../src/engine/v2/models/research';
import type { EvalTask, GameStateV2, ModelVersion } from '../../src/engine/v2/types';
import { check, finish, refGame, runRef } from './lib';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';

const previewOf = (s: GameStateV2, id: string, p: Record<string, string | number | boolean>) => ACTION_BY_ID.get(id)!.preview(s, p);

const game = (seed = 2027) => newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const run = (s: GameStateV2, n: number) => {
  for (let i = 0; i < n; i++) tick(s, { skip: ['endings'] });
};
const v0 = (s: GameStateV2) => s.player.models.versions[0];
const r2 = (x: number) => Math.round(x * 100) / 100;
/** Days until `done(s)` (at most `max`). */
function daysUntil(s: GameStateV2, done: (s: GameStateV2) => boolean, max = 400): number {
  for (let d = 0; d < max; d++) {
    if (done(s)) return d;
    run(s, 1);
  }
  return Infinity;
}

// ───────── EV1 cost by depth ─────────
{
  const s = game();
  const v = v0(s);
  const [b, f, d] = (['basic', 'full', 'deep'] as const).map((k) => evalCost(s, v, k));
  check(b.reTW < f.reTW && f.reTW < d.reTW && b.engTW < f.engTW && f.engTW < d.engTW && b.h100eDays < f.h100eDays && f.h100eDays < d.h100eDays,
    'EV1 deeper suites cost more research-engineer work, engineer work and compute',
    `RE team-weeks ${r2(b.reTW)} / ${r2(f.reTW)} / ${r2(d.reTW)}, eng ${b.engTW} / ${f.engTW} / ${d.engTW}, H100e-days ${Math.round(b.h100eDays)} / ${Math.round(f.h100eDays)} / ${Math.round(d.h100eDays)}`);
  // Compute scales with the evaluated model's FLOP per token.
  const big = { ...v, fpt: (v.fpt ?? 2e12) * 3 };
  check(Math.abs(evalCost(s, big, 'full').h100eDays / f.h100eDays - 3) < 1e-9, 'EV1 eval compute is tokens × the evaluated model\'s FLOP per token (×3 FLOP/token → ×3 H100e-days)');
  // research/20 §G: ≈$0.5k per model-benchmark for agentic suites (HAL, API prices); the full suite at $2/H100e-hour.
  const perBench = (f.h100eDays * 24 * 2) / (BENCHMARKS.length + 6);
  check(perBench > 100 && perBench < 1000, 'EV1 a full suite on the start model costs ≈ HAL\'s $0.5k per model-benchmark (research/20 §G)', `$${Math.round(perBench)} per benchmark at $2/H100e-hour`);
}

// ───────── EV2 measurement error by depth ─────────
{
  // The error is drawn once (N(0, 0.2) at weight 1) and shrinks as 1/√(Σ weights): RMS error of one suite of each depth
  // over many versions.
  const rms: Record<string, number> = {};
  const sds: Record<string, number> = {};
  for (const depth of ['basic', 'full', 'deep'] as const) {
    let se = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const s = game(100 + i);
      const v = v0(s);
      v.evals = { bench: {}, safety: {} };
      const ctx = makeCtx(s);
      runEvalSuite(s, ctx, v.id, 'self', depth);
      se += ((v.evals.measuredL ?? 0) - v.Lg) ** 2;
      sds[depth] = measuredSd(v);
      if (i === 0) sds[depth + 'Bench'] = v.evals.bench.patch?.sd ?? 0;
    }
    rms[depth] = Math.sqrt(se / N);
  }
  check(rms.basic > rms.full && rms.full > rms.deep, 'EV2 deeper suites measure the level with lower error (RMS over 300 versions)',
    `basic ${rms.basic.toFixed(3)}, full ${rms.full.toFixed(3)}, deep ${rms.deep.toFixed(3)} L (bands ${sds.basic.toFixed(2)} / ${sds.full.toFixed(2)} / ${sds.deep.toFixed(2)})`);
  check(Math.abs(rms.full - MEASURE_SD) < 0.03, 'EV2 a full suite keeps v2\'s measured-level error (0.2 L)', rms.full.toFixed(3));
  check(sds.basicBench > sds.fullBench && sds.fullBench > sds.deepBench, 'EV2 benchmark scores are noisier on shallower suites', `PatchBench sd ${sds.basicBench} / ${sds.fullBench} / ${sds.deepBench} points`);
  // Drawn once, shrinking with suites: an unchanged model's reading moves monotonically toward the truth.
  const s = game(7);
  const v = v0(s);
  v.evals = { bench: {}, safety: {} };
  const ctx = makeCtx(s);
  const errs: number[] = [];
  for (const depth of ['basic', 'full', 'deep', 'full'] as const) {
    runEvalSuite(s, ctx, v.id, 'self', depth);
    errs.push(Math.abs((v.evals.measuredL ?? 0) - v.Lg));
  }
  const mono = errs.every((e, i) => i === 0 || e <= errs[i - 1] + 0.006);
  check(mono && v.evals.nEff !== undefined && Math.abs(v.evals.nEff - 6.2) < 1e-9, 'EV2 the error is drawn once and shrinks with each suite by its weight (basic 0.2 + full 1 + deep 4 + full 1 = 6.2)',
    `|error| ${errs.map((e) => e.toFixed(3)).join(' → ')}, nEff ${v.evals.nEff}`);
}

// ───────── EV3 no fixed days: research engineers on evals set the duration ─────────
{
  const days: number[] = [];
  const est: number[] = [];
  for (const cap of [0.03, 0.1]) {
    const s = game();
    // No training run in flight: no release suite joins the queue while the ordered one runs.
    s.player.models.runs = [];
    s.player.build.queue = [];
    // Evaluate the start model (deployed) on the player's order; cap the evals need to `cap` team-equivalents.
    act(s, 'research.reAlloc', { need: 'evals', max: cap });
    est.push(evalDaysEstimate(s, 'full'));
    const t = queueEval(s, v0(s), 'full', 'self', 'order') as EvalTask;
    days.push(daysUntil(s, () => !s.player.models.evals.some((x) => x.id === t.id)));
  }
  check(days[1] < days[0] && days[0] >= 2 * days[1], 'EV3 more research engineers on evals finish a suite faster (no fixed days)',
    `evals capped at 0.03 team-eq: ${days[0]} days (estimate ${est[0]}); 0.1 team-eq (the full suite's 10 staff): ${days[1]} days (estimate ${est[1]})`);
  check(days.every((d, i) => Math.abs(d - est[i]) <= 2), 'EV3 the ready-date estimate matches the work ÷ capacity', `${days.join(', ')} vs ${est.join(', ')}`);
  // With the evals need put last, the suite gets what the needs above leave (RD-E03: no routine tuning; the start has
  // research engineers to spare); with experiments taking every research engineer it gets nothing.
  const s = game();
  act(s, 'research.reAlloc', { order: 'ops,exp,evals' });
  const idleLast = evalDaysEstimate(s, 'full');
  act(s, 'research.reAlloc', { need: 'evals', max: 0 });
  const capped = evalDaysEstimate(s, 'full');
  check(capped === Infinity && Number.isFinite(idleLast), 'EV3 the player\'s order and caps apply: evals last get what the needs above leave; capped at 0, nothing',
    `${idleLast} days last in the order; ${capped} capped at 0`);
  // AI labour in experiments multiplies the research engineers' eval work: a deep suite with a ×2 multiplier.
  const deepDays = EVAL_DEPTHS.deep.staffWeeks / EVAL_DEPTHS.deep.staff * 7;
  check(Math.abs(evalDaysEstimate(game(), 'deep') - deepDays) <= deepDays * 0.25, 'EV3 a deep suite at full staffing takes ≈ its staff-weeks ÷ staff (3 weeks at the start)', `${evalDaysEstimate(game(), 'deep')} d vs ${deepDays.toFixed(0)}`);
}

// ───────── EV4 compute from the experiments pool ─────────
{
  const s = game();
  const ctx = makeCtx(s);
  const t = queueEval(s, v0(s), 'full', 'self', 'order') as EvalTask;
  // A tiny pool: progress goes only as far as the compute.
  const used = evalsDay(s, ctx, 1, 1, 1);
  check(Math.abs(used - 1) < 1e-9 && Math.abs(t.progress - 1 / t.h100eDays) < 1e-9, 'EV4 a suite advances only as far as the experiments pool\'s compute goes', `used ${used} H100e-days, progress ${t.progress.toExponential(2)} (1 ÷ ${Math.round(t.h100eDays)})`);
  // Twin games, one with a suite running: the projects get the experiments pool minus the eval's H100e-days; serving
  // is untouched.
  const a = game();
  const b = game();
  queueEval(b, v0(b), 'deep', 'self', 'order');
  const h0 = b.player.models.evalSpent.h100eDays;
  run(a, 1);
  run(b, 1);
  const pool = expPoolH100e(b); // today's pool (the auto mix moves compute on day 1)
  const ev = b.player.models.evalSpent.h100eDays - h0;
  const ratio = (b.player.research.last?.flopAvail ?? 0) / (a.player.research.last?.flopAvail ?? 1);
  check(ev > 0 && Math.abs(ratio - (1 - ev / pool)) < 1e-6 && poolsOf(a).serving === poolsOf(b).serving,
    'EV4 eval compute comes out of the experiments pool (projects get less), not serving',
    `eval ${ev.toFixed(1)} H100e-days of ${Math.round(pool)}: project FLOP ×${ratio.toFixed(6)}; serving ${Math.round(poolsOf(b).serving)} H100e in both`);
}

// ───────── EV5 the standing policy queues suites ─────────
{
  const s = game();
  // The start run's version: its release suite is queued at the gate's depth (full by default).
  const until = daysUntil(s, () => s.player.models.versions.some((v) => v.status === 'evaluating'), 300);
  const ev = s.player.models.versions.find((v) => v.status === 'evaluating') as ModelVersion;
  run(s, 1);
  const rel = ev && openEval(s, ev.id);
  check(!!rel && rel.why === 'release' && rel.depth === 'full', 'EV5 the release gate queues a suite at its depth for a finished version', `${ev?.name} after ${until} d: ${rel ? `${rel.depth} ${rel.why}` : 'none'}`);
  // Gate full + external evaluators → a deep suite.
  const g = game();
  act(g, 'safety.evalGate', { level: 'fullPlusExternal' });
  daysUntil(g, () => g.player.models.versions.some((v) => v.status === 'evaluating'), 300);
  run(g, 1);
  const gv = g.player.models.versions.find((v) => v.status === 'evaluating');
  check(!!gv && openEval(g, gv.id)?.depth === 'deep', 'EV5 gate full + external queues a deep suite', gv ? openEval(g, gv.id)?.depth ?? 'none' : 'no version');
  // Auto-evaluate re-runs a policy model on the cadence and when it changed in place; off: nothing.
  for (const [label, prep, want] of [
    ['cadence', (x: GameStateV2, v: ModelVersion) => { v.evals.suiteDay = x.time.day - REEVAL_DAYS; }, true],
    ['changed in place (the recipe the stream applied)', (x: GameStateV2, v: ModelVersion) => { v.evals.suiteDay = x.time.day - 5; v.evals.recipeAt = inPlaceRecipe(x, v) - REEVAL_DG - 0.01; }, true],
    ['recent and unchanged', (x: GameStateV2, v: ModelVersion) => { v.evals.suiteDay = x.time.day - 5; v.evals.recipeAt = inPlaceRecipe(x, v); }, false],
    ['true level moved, no known change (F6: no hidden-truth trigger)', (x: GameStateV2, v: ModelVersion) => { v.evals.suiteDay = x.time.day - 5; v.evals.recipeAt = inPlaceRecipe(x, v); v.G += 1; v.Lg += 0.8; }, false],
    ['policy off', (x: GameStateV2, v: ModelVersion) => { v.evals.suiteDay = x.time.day - REEVAL_DAYS; act(x, 'products.policy', { autoEvaluate: false }); }, false],
  ] as const) {
    const x = game();
    const pm = policyModels(x)[0];
    prep(x, pm);
    run(x, 1);
    const t = openEval(x, pm.id);
    check(!!t === want && (!t || t.why === 'policy'), `EV5 auto-evaluate: ${label} → ${want ? 'a re-run is queued' : 'no re-run'}`, t ? `${t.depth} ${t.why}` : 'none');
  }
  // Its cost is visible: the policy's preview shows what a re-run takes.
  const x = game();
  const pv = previewOf(x, 'products.policy', { autoEvaluate: true });
  const reLine = pv.costs.find((c) => c.currency === 'staffTime' && /re-run/.test(c.target ?? ''));
  const cLine = pv.costs.find((c) => c.currency === 'compute');
  check(!!reLine && reLine.amount > 0 && !!cLine && cLine.amount > 0, 'EV5 the auto-evaluate policy shows a re-run\'s cost (research engineers, compute)', `${reLine?.amount} ${reLine?.target}; ${cLine?.amount} ${cLine?.target}`);
}

// ───────── EV6 promotion waits for the eval ─────────
{
  const s = game();
  act(s, 'research.reAlloc', { need: 'evals', max: 0 });
  daysUntil(s, () => s.player.models.versions.some((v) => v.status === 'evaluating'), 300);
  const v = s.player.models.versions.find((x) => x.status === 'evaluating') as ModelVersion;
  run(s, 60);
  const t = openEval(s, v.id);
  check(v.status === 'evaluating' && !!t && t.progress === 0, 'EV6 with no research engineers on evals the version stays in evaluation (no fixed days)', `${v.name} ${v.status} after 60 d, progress ${t?.progress}`);
  act(s, 'research.reAlloc', { need: 'evals', max: -1 });
  const d = daysUntil(s, () => v.status !== 'evaluating', 60);
  check(v.status === 'ready' && (v.evals.suiteDay ?? -1) >= s.time.day - 1 && !openEval(s, v.id), 'EV6 once the suite\'s work is done the version is ready with its measurement', `${d} d after the cap lifted; suite day ${v.evals.suiteDay}, today ${s.time.day}`);
  // Gate none: released at once; auto-evaluate gives it a basic suite that blocks nothing.
  const g = game();
  act(g, 'safety.evalGate', { level: 'none' });
  daysUntil(g, () => g.player.models.versions.length > 1, 300);
  run(g, 1);
  const nv = g.player.models.versions[g.player.models.versions.length - 1];
  const nt = openEval(g, nv.id);
  check(nv.status !== 'evaluating' && !!nt && nt.depth === 'basic' && nt.why === 'policy', 'EV6 gate none: the version is ready at once; auto-evaluate queues a basic suite', `${nv.status}, ${nt ? `${nt.depth} ${nt.why}` : 'no suite'}`);
}

// ───────── EV7 elicitation: depth and independent evaluators ─────────
{
  const s = game();
  const v = v0(s);
  const b = BENCHMARKS.find((x) => x.id === 'patchPro')!;
  const mean = (by: 'self' | 'evalIndep', depth: 'basic' | 'full' | 'deep') => {
    const rng = new StreamRng(s, 'runs');
    let a = 0;
    for (let i = 0; i < 400; i++) a += measureBench(s, v, b, by, rng, depth);
    return a / 400;
  };
  const self = mean('self', 'full');
  const indep = mean('evalIndep', 'full');
  const basic = mean('self', 'basic');
  const deep = mean('self', 'deep');
  check(ELICITATION.evalIndep > 0 && indep > self + 1, 'EV7 independent evaluators keep their extra elicitation (higher scores at the same depth)', `${b.name}: self ${self.toFixed(1)}, independent ${indep.toFixed(1)}`);
  check(basic < self && self < deep, 'EV7 deeper suites elicit more (basic < full < deep)', `${basic.toFixed(1)} / ${self.toFixed(1)} / ${deep.toFixed(1)}`);
  // An external suite works with the evaluator's own staff: no lab research engineers, the lab's compute and engineers.
  const x = game();
  const before = capReCapacity(x);
  const no = act(x, 'runEvals', { versionId: v0(x).id, by: 'evalIndep' });
  const t = openEval(x, v0(x).id, 'evalIndep');
  const d = daysUntil(x, () => !openEval(x, v0(x).id, 'evalIndep'), 120);
  const rec = v0(x).evals.bench.patch;
  check(!no && !!t && t.reTW === 0 && t.h100eDays > 0 && rec?.by === 'evalIndep' && capReCapacity(x) === before,
    'EV7 an independent suite runs on its own staff (no lab research engineers) and records its evaluator', `${no ?? 'queued'}, done in ${d} d, PatchBench by ${rec?.by}`);
}

// ───────── EV9 the reference lab's eval cost ─────────
{
  const s = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027 }));
  let re = 0;
  let cap = 0;
  let pool = 0;
  const releaseDays: number[] = [];
  const since = new Map<string, number>();
  for (let d = 1; d <= 365; d++) {
    runRef(s, d);
    re += s.player.research.last?.re.evals ?? 0;
    cap += capReCapacity(s);
    pool += expPoolH100e(s);
    for (const v of s.player.models.versions) {
      if (v.status === 'evaluating' && !since.has(v.id)) since.set(v.id, d);
      else if (v.status !== 'evaluating' && (since.get(v.id) ?? -1) >= 0) { releaseDays.push(d - (since.get(v.id) as number)); since.set(v.id, -1); }
    }
  }
  const sp = s.player.models.evalSpent;
  const reShare = re / cap;
  const cShare = sp.h100eDays / pool;
  check(reShare > 0 && reShare < 0.03, 'EV9 the reference lab spends a few % of its research engineers on evals at most (first year)',
    `${(reShare * 100).toFixed(2)}% (${sp.suites} suites, ${r2(sp.reTW)} RE team-weeks, ${r2(sp.engTW)} engineer team-weeks)`);
  check(cShare > 0 && cShare < 0.01, 'EV9 eval compute is a sliver of the experiments pool', `${(cShare * 100).toFixed(3)}% (${Math.round(sp.h100eDays)} H100e-days)`);
  check(releaseDays.length > 3 && Math.max(...releaseDays) <= 16, 'EV9 the reference lab\'s release suites take about two weeks or less (v2: 14 days fixed)', releaseDays.join(', '));
}

finish('evals');
