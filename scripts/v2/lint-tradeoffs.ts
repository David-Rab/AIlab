// Preview-truth lint (V2-SPEC §2.7): previews show what the engine applies; an action with no cost shows none. On 3
// canned states (the M0 fixtures), every ActionDef and ChoiceV2 preview renders without throwing; every 'progress' line
// carries its unit (a bare one read as levels, MEA-19); every immediate meter line (no delay, no odds) of an action is
// applied when the action runs on a copy; and the training / evals / leads previews equal what their mechanism does
// (runEvals, stream, run forecast, A4 / E16 / C6). Owner: WS4 (seeded by WS1).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIONS, ACTION_BY_ID, EVENTS, EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { deserialize } from '../../src/engine/v2/core/save';
import { act, makeCtx, tick } from '../../src/engine/v2/core/loop';
import { expectedFitSd, measuredSd } from '../../src/engine/v2/models/benchmarks';
import { evalDepthView, openEval } from '../../src/engine/v2/models/evals';
import { externallyEvaluated } from '../../src/engine/v2/models/deployments';
import { activeRivals, internalVersion } from '../../src/engine/v2/models/labs';
import { planRun, runForecast, streamPeriodGain } from '../../src/engine/v2/models/runs';
import { inPlaceRecipe } from '../../src/engine/v2/models/stacks';
import { ownProgressDays, poachLeakG, publishLeakG } from '../../src/engine/v2/actors/rivals';
import { STREAM_POOL_SHARE } from '../../src/data/v2/runDesign';
import type { CostLine, GameStateV2, SystemCtx } from '../../src/engine/v2/types';
import { FIXTURE_DIR, KNOWN, check, finish } from './lib';

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
  credibility: (k) => k === 'relations.credibility',
  scrutiny: (k) => k === 'relations.scrutiny',
  talent: (k) => k === 'relations.talentPull',
  morale: (k) => k.startsWith('morale'),
  approval: (k) => k === 'pub.approval' || /^pub\.blocs\.[^.]+\.approval$/.test(k),
  trust: (k) => k.startsWith('trust:'),
  chinaTension: (k) => k.startsWith('china.meters.'),
};
const PENDING: Record<string, string> = {
  'A6 trust': 'the trust line names no counterparty and nothing applies it (relations previews; not RD-B19)',
  'starHire trust': 'applied to rivals\' cooperation directly, not as trust (people previews, RD-B18)',
};
const appliedLabel = (id: string, cur: string, day: number) => `action ${id} @day ${day}: its ${cur} line is applied`;
for (const [k, why] of Object.entries(PENDING)) {
  const [id, cur] = k.split(' ');
  for (const s of states) KNOWN[appliedLabel(id, cur, s.time.day)] = why;
}
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
  // B36: a self suite gives a new reading and leaves the band previewed; no meter lines. CP3d: the band is the fit of the
  // new suite's scores (RD-M01), so the preview is its expectation at today's readings (expectedFitSd); the finished suite's band is its own
  // fit (fitSd), which moves with the scores it drew (detail prints both). On a live version with no
  // open suite.
  const ev = s4.player.models.versions.find((v) => (v.status === 'ready' || v.status === 'deployed') && !openEval(s4, v.id) && !openEval(s4, v.id, 'evalIndep'))!;
  const pv = pvOf(s4, 'runEvals', { versionId: ev.id, by: 'self', depth: 'full' });
  const row = evalDepthView(s4, ev).find((r) => r.depth === 'full')!;
  const c = clone(s4);
  const e = act(c, 'runEvals', { versionId: ev.id, by: 'self', depth: 'full' });
  const day0 = c.time.day;
  for (let i = 0; i < 200 && (c.player.models.evals ?? []).some((t) => t.versionId === ev.id && t.why === 'order'); i++) run(c, 1);
  const v = c.player.models.versions.find((x) => x.id === ev.id)!;
  check(!e && !pv.exposure.length && pv.gains.length === 1 && pv.gains[0].unit === 'reading' && pv.gains[0].currency === 'progress'
    && (v.evals.suiteDay ?? -1) > day0 && near(row.bandAfter, expectedFitSd(s4, ev, 'self', 'full'), 1e-12) && v.evals.fitSd !== undefined && near(measuredSd(v), v.evals.fitSd, 1e-12),
    'RD-B19 runEvals (self): one reading line, no meter gains or lead risk; the previewed ± is the fitted band expected at the current readings and the finished suite band is its own fit',
    `${e ?? ''} ${JSON.stringify(pv.gains)} fitted sd ${measuredSd(v)}, expected ${row.bandAfter}`);
  // External evaluators under the framework's external review: the release check is previewed and the finished suite meets it.
  const x = clone(s4);
  x.player.safety.framework.evalDepth = 'deep'; x.player.safety.framework.externalReview = true;
  const xv = x.player.models.versions.find((y) => y.id === ev.id)!;
  const before = externallyEvaluated(x, xv);
  const px = pvOf(x, 'runEvals', { versionId: ev.id, by: 'evalIndep', depth: 'full' });
  const ex = act(x, 'runEvals', { versionId: ev.id, by: 'evalIndep', depth: 'full' });
  for (let i = 0; i < 200 && (x.player.models.evals ?? []).some((t) => t.versionId === ev.id && t.by === 'evalIndep'); i++) run(x, 1);
  const hasCheck = px.gains.some((l) => l.unit === 'release check');
  check(!ex && hasCheck === !before && externallyEvaluated(x, xv) && !px.exposure.length && px.gains.every((l) => l.currency === 'progress'),
    'RD-B19 runEvals (external): the gate\'s external-evaluation check is previewed when unmet and met when the suite finishes; no credibility / trust / lead lines',
    `${ex ?? ''} before ${before} after ${externallyEvaluated(x, xv)} ${JSON.stringify(px.gains)}`);
}
{
  // B45: the forecast is the reference's measured level plus the step; band = its evaluation band; gain like with like.
  const plan = planRun(s4, { kind: 'post', baseId: iv.baseId, post: iv.design });
  const fc = runForecast(s4, plan.prediction);
  const ref = s4.player.models.versions.find((v) => v.id === fc?.refId);
  const truthMid = (plan.prediction.Lg[0] + plan.prediction.Lg[1]) / 2;
  const g = pvOf(s4, 'launchPost', { baseId: iv.baseId }).gains.find((l) => l.currency === 'progress');
  // Another measurement on the reference moves the forecast with it and leaves the gain alone (no true level shows).
  const c = clone(s4);
  const cr = c.player.models.versions.find((v) => v.id === fc?.refId);
  if (cr) cr.evals.measuredL = (cr.evals.measuredL ?? 0) + 0.3;
  const fc2 = runForecast(c, plan.prediction);
  check(!!fc && !!ref && !!fc2 && near(fc.mid, truthMid + (ref.evals.measuredL ?? 0) - ref.Lg, 1e-9) && near(fc.band[1] - fc.band[0], 2 * measuredSd(ref), 1e-9)
    && near(fc2.mid - fc.mid, 0.3, 1e-9) && near(fc2.gain, fc.gain, 1e-9) && g?.unit === 'L',
    'RD-B19 run forecast: measured reference + the run\'s step, ± the reference\'s evaluation band; the gain compares measured with measured',
    `mid ${fc?.mid} ref ${ref?.name} sd ${ref ? measuredSd(ref) : NaN} gain ${fc?.gain} → ${fc2?.gain} line ${JSON.stringify(g)}`);
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
{
  // B40: the A4, E16 and C6 lead lines are the recipe their apply adds, in days of the recipient's own progress.
  const labs = (s: GameStateV2) => [...activeRivals(s), s.china.lab];
  const recs = (s: GameStateV2) => new Map(labs(s).map((r) => [r.core.id, r.phys.rec.pre] as const));
  const days = (pv: Pv) => pv.costs.filter((l) => l.currency === 'leadDays').map((l) => l.amount);
  const ownDays = (s: GameStateV2, before: Map<string, number>, id: string) => ownProgressDays(s, id, (recs(s).get(id) ?? 0) - (before.get(id) ?? 0));
  const cn = s4.china.lab.core.id;
  // A4
  const a = clone(s4);
  const pa = pvOf(a, 'A4');
  const ra = recs(a);
  const wantA = new Map(labs(a).map((r) => [r.core.id, publishLeakG(a, r.core.id)] as const));
  const ea = act(a, 'A4');
  const moved = labs(a).filter((r) => r.phys.rec.pre - (ra.get(r.core.id) ?? 0) > 0);
  const maxA = Math.round(Math.max(0, ...moved.map((r) => ownDays(a, ra, r.core.id))));
  check(!ea && moved.every((r) => near(r.phys.rec.pre - ra.get(r.core.id)!, wantA.get(r.core.id)!, 1e-9)) && near(days(pa)[0], maxA, 0.5),
    'RD-B19 A4: the lead line is the recipe publishing adds to the labs behind you, in their own days', `${ea ?? ''} preview ${days(pa)} applied ${maxA} labs ${moved.length}`);
  // E16 "Let go"
  const letGo = EVENT_BY_ID.get('E16')!.choices.find((ch) => ch.label === 'Let go')!;
  const b = clone(s4);
  const lab = activeRivals(b)[0].core.id;
  const pb = letGo.preview(b, { lab });
  const rb = recs(b);
  const wantB = poachLeakG(b, lab, Math.round(b.player.staff.cap * 0.03));
  letGo.apply(b, makeCtx(b), { lab });
  const dB = (recs(b).get(lab) ?? 0) - (rb.get(lab) ?? 0);
  check(near(dB, wantB, 1e-9) && near(days(pb)[0], Math.round(ownProgressDays(b, lab, dB)), 0.5),
    'RD-B19 E16 let go: the lead line is the recipe that rival takes, in its own days', `preview ${days(pb)} applied ${ownProgressDays(b, lab, dB)}`);
  // C6
  const o = clone(s4);
  const po = pvOf(o, 'C6', { behind: 1 });
  const ro = recs(o);
  const eo = act(o, 'C6', { behind: 1 });
  const maxR = Math.round(Math.max(0, ...activeRivals(o).map((r) => ownDays(o, ro, r.core.id))));
  check(!eo && days(po).length === 2 && near(days(po)[0], maxR, 0.5) && near(days(po)[1], ownDays(o, ro, cn), 1)
    && !linesOf(po).some((l) => l.currency === 'chinaTension'),
    'RD-B19 C6: the lead lines are the rivals\' recipe and China\'s absorbed progress as applied; no unapplied China-tension line',
    `${eo ?? ''} preview ${days(po)} rivals ${maxR} China ${ownDays(o, ro, cn)}`);
}

console.log(`lint-tradeoffs: ${ACTIONS.length} actions, ${EVENTS.length} events, ${n} previews checked, ${nApplied} applied-effect checks`);
finish('lint-tradeoffs');
