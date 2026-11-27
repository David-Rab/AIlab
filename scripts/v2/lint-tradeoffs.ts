// Preview-truth lint (V2-SPEC §2.7): previews show what the engine applies; an action with no cost shows none. On 3
// canned states (the M0 fixtures), every ActionDef and ChoiceV2 preview renders without throwing; every 'progress' line
// carries its unit (a bare one read as levels, MEA-19); every immediate meter line (no delay, no odds) of an action is
// applied when the action runs on a copy; and the training / evals / leads previews equal what their mechanism does
// (runEvals, stream, run forecast). Owner: WS4 (seeded by WS1).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIONS, ACTION_BY_ID, EVENTS } from '../../src/engine/v2/core/registry';
import { deserialize } from '../../src/engine/v2/core/save';
import { act, makeCtx, tick } from '../../src/engine/v2/core/loop';
import { measuredSd } from '../../src/engine/v2/models/benchmarks';
import { evalDepthView, openEval } from '../../src/engine/v2/models/evals';
import { externallyEvaluated } from '../../src/engine/v2/models/deployments';
import { internalVersion } from '../../src/engine/v2/models/labs';
import { runForecast, streamPeriodGain } from '../../src/engine/v2/models/runs';
import { inPlaceRecipe } from '../../src/engine/v2/models/stacks';
import { STREAM_POOL_SHARE } from '../../src/data/v2/runDesign';
import type { CostLine, GameStateV2, SystemCtx } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const states: GameStateV2[] = [0, 400, 900].map((d) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8')));

type Pv = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };
const linesOf = (p: Pv) => [...p.costs, ...p.gains, ...p.exposure];
/** RD-B19: a 'progress' line names its unit (L, OOM, %, version, reading, …). */
const unitless = (p: Pv) => linesOf(p).filter((l) => l.currency === 'progress' && l.amount !== 0 && !l.unit);

let n = 0;
for (const a of ACTIONS) {
  for (const s of states) {
    n++;
    let why = '';
    let bare: CostLine[] = [];
    try {
      bare = unitless(a.preview(s, {}));
    } catch (e) {
      why = String(e);
    }
    check(!why, `action ${a.id} @day ${s.time.day}: preview renders`, why);
    if (!why) check(!bare.length, `action ${a.id} @day ${s.time.day}: every progress line has a unit`, JSON.stringify(bare));
  }
}
for (const e of EVENTS) {
  check(e.choices.length >= 2, `event ${e.id} has ≥ 2 choices`);
  e.choices.forEach((c, i) => {
    for (const s of states) {
      n++;
      let why = '';
      let bare: CostLine[] = [];
      try {
        bare = unitless(c.preview(s));
      } catch (err) {
        why = String(err);
      }
      check(!why, `event ${e.id} choice ${i} "${c.label}" @day ${s.time.day}: preview renders`, why);
      if (!why) check(!bare.length, `event ${e.id} choice ${i} @day ${s.time.day}: every progress line has a unit`, JSON.stringify(bare));
    }
  });
}

// ───────── RD-B19: no preview line without an applied effect ─────────
// The meters whose every change goes through ctx.bump / ctx.cause (actors/fx.ts): an immediate line (no lagDays, no condition, no odds
// below 1) in one of these currencies must leave a cause on that meter when the action runs on a copy.
const METER_KEY: Partial<Record<CostLine['currency'], (k: string) => boolean>> = {
  credibility: (k) => k === 'finance.credibility',
  approval: (k) => k === 'public.approval',
  trust: (k) => k === 'usgov.trust',
  morale: (k) => k.startsWith('morale'),
};
const appliedLabel = (id: string, cur: string, day: number) => `action ${id} @day ${day}: its ${cur} line is applied`;
const clone = (s: GameStateV2) => deserialize(JSON.stringify(s));
/** A context on `c` that records the meter keys it moves. */
function recordingCtx(c: GameStateV2, keys: string[]): SystemCtx {
  const ctx = makeCtx(c);
  const cause = ctx.cause.bind(ctx);
  const bump = ctx.bump.bind(ctx);
  ctx.cause = (k, d, src, det) => {
    if (d) keys.push(k);
    return cause(k, d, src, det);
  };
  ctx.bump = (k, d, src, det) => {
    if (d) keys.push(k);
    return bump(k, d, src, det);
  };
  return ctx;
}
let nApplied = 0;
for (const a of ACTIONS) {
  for (const s of states) {
    if (a.available(s) !== true) continue;
    let lines: CostLine[];
    try {
      lines = linesOf(a.preview(s, {}));
    } catch {
      continue;
    }
    const want = lines.filter((l) => l.amount !== 0 && !l.lagDays && !l.condition && (l.probability === undefined || l.probability >= 1) && METER_KEY[l.currency]);
    if (!want.length) continue;
    const c = clone(s);
    const keys: string[] = [];
    try {
      a.apply(c, recordingCtx(c, keys), {});
    } catch {
      continue; // the default request is refused: nothing applied, nothing to compare
    }
    for (const cur of new Set(want.map((l) => l.currency))) {
      nApplied++;
      check(keys.some(METER_KEY[cur]!), appliedLabel(a.id, cur, s.time.day), `moved: ${[...new Set(keys)].join(', ') || 'nothing'}`);
    }
  }
}

// ───────── RD-B19: training / evals / leads previews are their mechanism ─────────
const pvOf = (s: GameStateV2, id: string, p: Record<string, string | number | boolean> = {}): Pv => ACTION_BY_ID.get(id)!.preview(s, p);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const s4 = states[1];
const run = (s: GameStateV2, days: number) => {
  for (let i = 0; i < days; i++) tick(s, { skip: ['endings'] });
};
const iv = internalVersion(s4)!;
{
  // B36: a self suite gives a new reading and leaves the band previewed; no meter lines. RF-R3 (replaces CP3d's
  // tautology, which compared expectedFitSd with itself and fitSd with itself): the band previewed before the suite
  // (the order preview's "after") against the band the finished suite really leaves, on a live version with no open
  // suite, from the fixture and 1–3 days later (other days, other score draws): each within 25% of its preview.
  const ev = s4.player.models.versions.find((v) => (v.status === 'ready' || v.status === 'deployed') && !openEval(s4, v.id) && !openEval(s4, v.id, 'evalIndep'))!;
  const pv = pvOf(s4, 'runEvals', { versionId: ev.id, by: 'self', depth: 'full' });
  const pairs: { pre: number; got: number; done: boolean }[] = [];
  let e: string | undefined;
  for (const k of [0, 1, 2, 3]) {
    const c = clone(s4);
    run(c, k);
    const cv = c.player.models.versions.find((x) => x.id === ev.id)!;
    if (openEval(c, cv.id)) continue;
    const pre = evalDepthView(c, cv).find((r) => r.depth === 'full')!.bandAfter;
    const err = act(c, 'runEvals', { versionId: ev.id, by: 'self', depth: 'full' });
    if (k === 0) e = err;
    const day0 = c.time.day;
    for (let i = 0; i < 200 && (c.player.models.evals ?? []).some((t) => t.versionId === ev.id && t.why === 'order'); i++) run(c, 1);
    pairs.push({ pre, got: measuredSd(cv), done: (cv.evals.suiteDay ?? -1) > day0 });
  }
  check(!e && !pv.exposure.length && pv.gains.length === 1 && pv.gains[0].unit === 'reading' && pv.gains[0].currency === 'progress'
    && pairs.length >= 3 && pairs.every((x) => x.done && near(x.got, x.pre, 0.25 * x.pre)),
    'RD-B19 runEvals (self): one reading line, no meter gains or lead risk; the finished suite leaves the previewed ± (within 25%, 4 start days)',
    `${e ?? ''} ${JSON.stringify(pv.gains)} previewed → realised ${pairs.map((x) => `${x.pre.toFixed(3)} → ${x.got.toFixed(3)}${x.done ? '' : ' (not done)'}`).join(', ')}`);
  // External evaluators under the framework's external review: the release check is previewed and the finished suite meets it.
  const x = clone(s4);
  x.player.safety.framework.evalDepth = 'deep'; x.player.safety.framework.externalReview = true;
  const xv = x.player.models.versions.find((y) => y.id === ev.id)!;
  const before = externallyEvaluated(xv);
  const px = pvOf(x, 'runEvals', { versionId: ev.id, by: 'evalIndep', depth: 'full' });
  const ex = act(x, 'runEvals', { versionId: ev.id, by: 'evalIndep', depth: 'full' });
  for (let i = 0; i < 200 && (x.player.models.evals ?? []).some((t) => t.versionId === ev.id && t.by === 'evalIndep'); i++) run(x, 1);
  const hasCheck = px.gains.some((l) => l.unit === 'release check');
  check(!ex && hasCheck === !before && externallyEvaluated(xv) && !px.exposure.length && px.gains.every((l) => l.currency === 'progress'),
    'RD-B19 runEvals (external): the gate\'s external-evaluation check is previewed when unmet and met when the suite finishes; no credibility / trust / lead lines',
    `${ex ?? ''} before ${before} after ${externallyEvaluated(xv)} ${JSON.stringify(px.gains)}`);
}
{
  // B45 / UB-2b: the forecast is the planned run on the lab's believed view (believed recipe, the start model's measured
  // build); sd = √(ideas² + start measurement² + evaluation band²), band its 90% range; gain like with like.
  const lp = { kind: 'post' as const, baseId: iv.baseId, post: iv.design };
  const fc = runForecast(s4, lp);
  const ref = s4.player.models.versions.find((v) => v.id === fc?.refId);
  const start = s4.player.models.versions.find((v) => v.name === fc?.startName);
  const g = pvOf(s4, 'launchPost', { baseId: iv.baseId }).gains.find((l) => l.currency === 'progress');
  // Higher measurements of the base's versions move the forecast up with them (its measured build; at most 1:1, less
  // where the lift from a better released teacher shrinks); the gain stays like with like (no true level shows).
  const c = clone(s4);
  for (const v of c.player.models.versions) if (v.baseId === iv.baseId && v.evals.measuredL !== undefined) v.evals.measuredL += 0.3;
  const fc2 = runForecast(c, lp);
  const sdOk = !!fc && near(fc.sd, Math.hypot(fc.sdParts.ideas, fc.sdParts.start, fc.sdParts.eval), 1e-9) && !!ref && near(fc.sdParts.eval, measuredSd(ref), 1e-9);
  check(!!fc && !!ref && !!start && !!fc2 && sdOk && near(fc.band[1] - fc.band[0], 2 * 1.64 * fc.sd, 1e-9) && near(fc.gain, fc.mid - (ref.evals.measuredL ?? 0), 1e-9)
    && fc2.mid - fc.mid > 0.15 && fc2.mid - fc.mid <= 0.32 && g?.unit === 'L',
    'RD-B19 / UB-2b run forecast: believed plan on the start model\'s measured build, ± ideas, start and evaluation bands; the gain compares measured with measured',
    `mid ${fc?.mid} start ${fc?.startName} ref ${ref?.name} sd ${fc?.sd} (${JSON.stringify(fc?.sdParts)}) → mid ${fc2?.mid} line ${JSON.stringify(g)}`);
}
{
  // B37 / RD-T03: the stream's gain line is what a period's FLOP buys (the mechanism on a copy); costs as charged; stopping keeps the version.
  const c = clone(s4);
  c.player.tree.P08 = { status: 'known', progress: 1 };
  delete c.player.models.stream;
  const v = c.player.models.versions.find((x) => x.id === iv.id)!;
  const pv = pvOf(c, 'startStream', { versionId: v.id });
  const gap = pv.gains.find((l) => l.unit === 'OOM')?.amount ?? NaN;
  const r0 = inPlaceRecipe(c, v);
  const e = act(c, 'startStream', { versionId: v.id });
  run(c, 42);
  const absorbed = inPlaceRecipe(c, v) - r0;
  const share = pv.costs.find((l) => l.currency === 'compute')?.amount;
  const sp = pvOf(c, 'stopStream');
  const left = streamPeriodGain(c, v.id).dG;
  const G0 = v.G;
  const e2 = act(c, 'stopStream');
  check(!e && !e2 && share === STREAM_POOL_SHARE && !pv.exposure.length && !linesOf(pv).some((l) => l.currency === 'monitorability' || l.currency === 'alignment')
    && gap > 0 && absorbed > 0 && near(-(sp.costs[0]?.amount ?? NaN), Math.round(left * 1000) / 1000, 1e-9) && !c.player.models.stream && v.G === G0
    && !linesOf(sp).some((l) => l.currency === 'monitorability'),
    'RD-B19 / RD-T03 stream: the gain line is what a period of FLOP buys, costs as charged, no invented monitorability / alignment lines; stopping keeps the version',
    `${e ?? ''}${e2 ?? ''} gap ${gap} absorbed ${absorbed} stop ${JSON.stringify(sp.costs[0])} left ${left}`);
}

console.log(`lint-tradeoffs: ${ACTIONS.length} actions, ${EVENTS.length} events, ${n} previews checked, ${nApplied} applied-effect checks`);
finish('lint-tradeoffs');
