// Mockup data v4: TRAINING › Runs, launch-time forecast vs measured result, from the CURRENT engine on the day-400 fixture
// (the fixture predates run.forecast, UB-2b). Run from the worktree root:
//   npx tsx design/ux/mockups/rd/_data-b-runs.ts  → design/ux/mockups/rd/data400-b-runs.json
// A: launch the default Next run (base, as _data2 builds it) via act('launchBase'), step 1 day, read the run queue.
// B: from the fixture again, launch a post-train on Atlas-3 (+ a distil), step day by day until the results are measured.
// Player-visible only: run.forecast (believed), evals.measuredL / measuredSd, evalQueueView. Never s.hidden / v.G / v.Lg.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { act, tick } from '../../../../src/engine/v2/core/loop';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import { RUN_PARAM_DEFAULTS, RUN_POOL_DEFAULT, PARAM_SNAPS, REF_TPP, baseFromParams, runCard, postFromParams, dateOf, fmtDate, measuredSd, evalQueueView, runBand, controlReadout, labSpeedView, idleTrainingShare, poolsOf } from '../../../../src/engine/v2';
import type { GameStateV2, LaunchRunParams, TrainingRun } from '../../../../src/engine/v2';
import { runStall, runEtaDays, runForecast, forecastBand, poolAllocation, trainingFlopPerDay } from '../../../../src/engine/v2/models/runs';
import { runWaiting } from '../../../../src/engine/v2/departments/build';
import { nearestRival, runwayLive } from '../../../../src/ui/v2/shell/selectors';

const FILE = process.argv[2] ?? 'day400.json';
const load = () => deserialize(readFileSync(join(FIXTURE_DIR, FILE), 'utf8')) as GameStateV2;
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x === Infinity ? 'Infinity' : 'NaN');
const clean = (o: unknown): unknown => {
  if (typeof o === 'number') return r3(o);
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && typeof v !== 'function').map(([k, v]) => [k, clean(v)]));
  return o;
};
const Z90 = 1.64;
type Params = Record<string, string | number | boolean>;
const DEFAULTS: Params = { ...RUN_PARAM_DEFAULTS };
const date = (s: GameStateV2, d: number) => fmtDate(dateOf(s, d));
const vName = (s: GameStateV2, id?: string) => s.player.models.versions.find((v) => v.id === id)?.name;

/** Default base size (_data2: largest snap whose wall time ≤ 182 d). */
function defaultParams(s: GameStateV2): number {
  const snaps = PARAM_SNAPS as readonly number[];
  for (let i = snaps.length - 1; i >= 0; i--) {
    try {
      const lp: LaunchRunParams = { kind: 'base', poolShare: RUN_POOL_DEFAULT.base, base: baseFromParams({ ...DEFAULTS, params: snaps[i], tpp: REF_TPP } as never) };
      const c = runCard(s, lp);
      if ((c.limits?.wallDays ?? c.etaDays) <= 182) return snaps[i];
    } catch { /* next */ }
  }
  return snaps[0];
}

/** Run-queue row: player-visible fields only. */
function runRow(s: GameStateV2, r: TrainingRun) {
  const eta = r.status === 'running' ? runEtaDays(s, r) : undefined;
  return {
    id: r.id, name: r.name, kind: r.kind, status: r.status, launched: date(s, r.startDay),
    stage: r.status !== 'running' ? r.status : runWaiting(r) ? 'setup (waiting for engineers)' : 'training',
    progress: r.flopNeeded > 0 ? r.flopDone / r.flopNeeded : 0, flopNeeded: r.flopNeeded, poolShare: r.poolShare,
    etaDays: eta, etaDate: eta !== undefined && Number.isFinite(eta) ? date(s, s.time.day + eta) : undefined,
    forecast: r.forecast ? { ...r.forecast, band90: runBand(s, r) } : null, stall: runStall(s, r) ?? null,
    base: s.player.models.bases.find((b) => b.id === r.baseId)?.name, teacher: vName(s, r.teacherVersionId),
  };
}
const evalRows = (s: GameStateV2) => evalQueueView(s).map((e) => ({
  name: e.name, depth: e.depth, by: e.by, why: e.why, progress: e.progress, etaDays: e.etaDays,
  finish: Number.isFinite(e.etaDays) ? date(s, s.time.day + e.etaDays) : undefined, waiting: e.waiting, binds: e.binds,
}));

/** Launch through the normal action, capturing the full forecast (ref, band) the same call stores (runForecast). */
function launch(s: GameStateV2, actionId: string, kind: LaunchRunParams['kind'], q: Params, lp: LaunchRunParams) {
  const fc = runForecast(s, lp);
  const before = new Set(s.player.models.runs.map((r) => r.id));
  const err = act(s, actionId, q);
  const run = s.player.models.runs.find((r) => !before.has(r.id));
  const ref = fc ? s.player.models.versions.find((v) => v.id === fc.refId) : undefined;
  return {
    err, run, kind,
    launchForecast: fc ? {
      mid: fc.mid, sd: fc.sd, band90: fc.band, gain: fc.gain, sdParts: fc.sdParts, startModel: fc.startName,
      ref: { name: fc.refName, measuredL: ref?.evals.measuredL, measuredSd: ref ? measuredSd(ref) : undefined },
    } : null,
    stored: run?.forecast,
  };
}

// ───────── A ─────────
const A = (() => {
  const s = load();
  const day0 = s.time.day;
  const params = defaultParams(s);
  const lastBase = s.player.models.bases[s.player.models.bases.length - 1];
  const q: Params = { ...DEFAULTS, params, poolShare: RUN_POOL_DEFAULT.base, baseId: lastBase?.id ?? '', ...(lastBase?.design.shape === 'latent' ? { cot: 'latent' } : {}) };
  const lp: LaunchRunParams = { kind: 'base', poolShare: Number(q.poolShare), base: baseFromParams(q as never) };
  const L = launch(s, 'launchBase', 'base', q, lp);
  tick(s);
  return {
    fixtureDay: day0, fixtureDate: date(s, day0), afterDate: date(s, s.time.day), plan: { params, data: q.data, shape: q.shape, tpp: q.tpp, poolShare: q.poolShare },
    launchError: L.err, launchForecast: L.launchForecast, newRun: L.run ? runRow(s, L.run) : null,
    allRuns: s.player.models.runs.filter((r) => r.status === 'running').map((r) => runRow(s, r)), evalsInProgress: evalRows(s),
  };
})();

// ───────── B ─────────
const B = (() => {
  const t0 = Date.now();
  const s = load();
  const p = s.player;
  const atlas3 = p.models.bases.find((b) => b.name === 'Atlas-3') ?? p.models.bases[p.models.bases.length - 1];
  const qPost: Params = { ...DEFAULTS, poolShare: RUN_POOL_DEFAULT.post, baseId: atlas3.id, ...(atlas3.design.shape === 'latent' ? { cot: 'latent' } : {}) };
  // Same LaunchRunParams the action builds (actions.ts runParams) so the captured ref/band match the stored forecast.
  const lpPost: LaunchRunParams = runCardLP(s, 'post', qPost);
  const launches = [launch(s, 'launchPost', 'post', qPost, lpPost)];
  const qDist: Params = { poolShare: RUN_POOL_DEFAULT.distill };
  launches.push(launch(s, 'launchDistill', 'distill', qDist, runCardLP(s, 'distill', qDist)));
  const tracked = launches.filter((l) => l.run).map((l) => ({ ...l, runId: l.run!.id }));
  const known = new Set(p.models.versions.map((v) => v.id));
  const result = new Map<string, { versionId?: string; doneDay?: number; note?: string }>();
  const otherRuns = new Set<string>();
  const runsAt0 = new Set(p.models.runs.map((r) => r.id));
  const timeline: unknown[] = [];
  const CAP = 150;
  let days = 0;
  for (; days < CAP && !s.ending; days++) {
    const wasRunning = new Set(p.models.runs.filter((r) => r.status === 'running').map((r) => r.id));
    tick(s);
    for (const r of p.models.runs) if (!runsAt0.has(r.id)) otherRuns.add(r.id);
    const fresh = p.models.versions.filter((v) => !known.has(v.id));
    fresh.forEach((v) => known.add(v.id));
    const justDone = p.models.runs.filter((r) => wasRunning.has(r.id) && r.status !== 'running');
    for (const r of justDone) {
      // Its version: a new version made the day it finished (post on its base; distil a student of its teacher).
      const v = fresh.find((x) => (r.kind === 'post' ? x.baseId === r.baseId && x.variant === 'full' : r.kind === 'distill' ? x.parentVersionId === r.teacherVersionId || x.variant !== 'full' : true));
      result.set(r.id, { versionId: v?.id, doneDay: s.time.day, note: v ? undefined : `finished ${r.status}; no new version identified (${fresh.map((x) => x.name).join(', ') || 'none new'})` });
    }
    if (days % 10 === 0) timeline.push({ date: date(s, s.time.day), runs: tracked.map((t) => { const r = p.models.runs.find((x) => x.id === t.runId)!; return { name: r.name, status: r.status, progress: r.flopNeeded ? r.flopDone / r.flopNeeded : 0, stall: runStall(s, r) }; }) });
    const allMeasured = tracked.every((t) => { const res = result.get(t.runId); const v = p.models.versions.find((x) => x.id === res?.versionId); return res && (!res.versionId || v?.evals.measuredL !== undefined); });
    // Record first measured day per result.
    for (const t of tracked) { const res = result.get(t.runId) as { versionId?: string; measuredDay?: number } | undefined; const v = p.models.versions.find((x) => x.id === res?.versionId); if (res && v?.evals.measuredL !== undefined && res.measuredDay === undefined) res.measuredDay = s.time.day; }
    if (allMeasured) { days++; break; }
    if (Date.now() - t0 > 120_000) { days++; break; }
  }
  const pairs = tracked.map((t) => {
    const r = p.models.runs.find((x) => x.id === t.runId)!;
    const res = result.get(t.runId) as { versionId?: string; doneDay?: number; measuredDay?: number; note?: string } | undefined;
    const v = p.models.versions.find((x) => x.id === res?.versionId);
    const mL = v?.evals.measuredL;
    const msd = v && mL !== undefined ? measuredSd(v) : undefined;
    const fc = r.forecast;
    return {
      run: { name: r.name, kind: r.kind, status: r.status, launched: date(s, r.startDay), finished: res?.doneDay !== undefined ? date(s, res.doneDay) : undefined, base: p.models.bases.find((b) => b.id === r.baseId)?.name, teacher: vName(s, r.teacherVersionId) },
      forecastAtLaunch: t.launchForecast, storedForecast: fc ? { ...fc, band90: forecastBand(fc.mid, fc.sd) } : null,
      result: v ? {
        model: v.name, status: v.status, measuredL: mL, measuredSd: msd, range90: mL !== undefined && msd !== undefined ? [mL - Z90 * msd, mL + Z90 * msd] : undefined,
        measuredDate: res?.measuredDay !== undefined ? date(s, res.measuredDay) : undefined, nSuites: v.evals.nSuites,
      } : { note: res?.note ?? (r.status === 'running' ? `still running at cap: ${((r.flopDone / r.flopNeeded) * 100).toFixed(0)}%` : 'not identified') },
      error: fc && mL !== undefined ? { measuredMinusMid: mL - fc.mid, inSd: (mL - fc.mid) / fc.sd, inside90: Math.abs(mL - fc.mid) <= Z90 * fc.sd } : undefined,
      launchError: t.err,
    };
  });
  const untracked = launches.filter((l) => !l.run).map((l) => ({ kind: l.kind, launchError: l.err }));
  const others = [...otherRuns].filter((id) => !tracked.some((t) => t.runId === id)).map((id) => runRow(s, p.models.runs.find((r) => r.id === id)!));
  return { simDays: days, simSeconds: (Date.now() - t0) / 1000, endDate: date(s, s.time.day), pairs, notLaunched: untracked, otherRunsStarted: others, timeline, evalsAtEnd: evalRows(s) };
})();

/** LaunchRunParams for a post / distil as actions.ts runParams builds them (for runForecast before act). */
function runCardLP(s: GameStateV2, kind: 'post' | 'distill', q: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind, poolShare: Number(q.poolShare) };
  if (kind === 'post') { lp.post = postFromParams(q as never, s); lp.baseId = String(q.baseId); if (q.cot) lp.post.cot = q.cot as never; }
  else lp.teacherVersionId = s.player.models.versions.filter((v) => v.variant === 'full' && v.status !== 'retired').slice(-1)[0]?.id;
  return lp;
}

// ───────── C: all three runs in one game, read the day after Atlas-3.0 is measured ─────────
const C = (() => {
  const t0 = Date.now();
  const s = load();
  const p = s.player;
  const notes: string[] = [];
  const atlas3 = p.models.bases.find((b) => b.name === 'Atlas-3')!;
  const params = defaultParams(s);
  const lastBase = p.models.bases[p.models.bases.length - 1];
  const qBase: Params = { ...DEFAULTS, params, poolShare: RUN_POOL_DEFAULT.base, baseId: lastBase?.id ?? '', ...(lastBase?.design.shape === 'latent' ? { cot: 'latent' } : {}) };
  const lpBase: LaunchRunParams = { kind: 'base', poolShare: Number(qBase.poolShare), base: baseFromParams(qBase as never) };
  const qPost: Params = { ...DEFAULTS, poolShare: RUN_POOL_DEFAULT.post, baseId: atlas3.id, ...(atlas3.design.shape === 'latent' ? { cot: 'latent' } : {}) };
  const qDist: Params = { poolShare: RUN_POOL_DEFAULT.distill };
  const launches = [
    launch(s, 'launchBase', 'base', qBase, lpBase),
    launch(s, 'launchPost', 'post', qPost, runCardLP(s, 'post', qPost)),
    launch(s, 'launchDistill', 'distill', qDist, runCardLP(s, 'distill', qDist)),
  ];
  launches.forEach((l) => { if (l.err || !l.run) notes.push(`${l.kind} not launched: ${l.err}`); });
  const fcByRun = new Map(launches.filter((l) => l.run).map((l) => [l.run!.id, l.launchForecast] as const));
  const known = new Set(p.models.versions.map((v) => v.id));
  const knownBases = new Set(p.models.bases.map((b) => b.id));
  const res = new Map<string, { endDay: number; versionId?: string; baseName?: string }>();
  const measuredDay = new Map<string, number>();
  let stopDay: number | undefined;
  for (let i = 0; i < 200 && !s.ending; i++) {
    const wasRunning = new Set(p.models.runs.filter((r) => r.status === 'running').map((r) => r.id));
    tick(s);
    const fresh = p.models.versions.filter((v) => !known.has(v.id)); fresh.forEach((v) => known.add(v.id));
    const freshB = p.models.bases.filter((b) => !knownBases.has(b.id)); freshB.forEach((b) => knownBases.add(b.id));
    for (const r of p.models.runs.filter((x) => wasRunning.has(x.id) && x.status !== 'running')) {
      const v = fresh.find((x) => (r.kind === 'post' ? x.baseId === r.baseId && x.variant === 'full' : r.kind === 'distill' ? x.parentVersionId === r.teacherVersionId || x.variant !== 'full' : false));
      res.set(r.id, { endDay: s.time.day, versionId: v?.id, baseName: r.kind === 'base' || r.kind === 'continue' ? freshB[0]?.name : undefined });
    }
    for (const v of p.models.versions) if (v.evals.measuredL !== undefined && !measuredDay.has(v.id)) measuredDay.set(v.id, s.time.day);
    const a30 = p.models.versions.find((v) => v.name === 'Atlas-3.0');
    if (stopDay === undefined && a30?.evals.measuredL !== undefined && measuredDay.get(a30.id) !== 400) stopDay = s.time.day + 1;
    if (stopDay !== undefined && s.time.day >= stopDay) break;
  }
  const runs = p.models.runs.map((r) => {
    const row = runRow(s, r);
    const fc = fcByRun.get(r.id);
    const rr = res.get(r.id);
    const v = p.models.versions.find((x) => x.id === rr?.versionId);
    const mL = v?.evals.measuredL, msd = v && mL !== undefined ? measuredSd(v) : undefined;
    return {
      ...row, launchedToday: fcByRun.has(r.id), ended: rr ? date(s, rr.endDay) : undefined,
      forecastRef: fc ? fc.ref : r.forecast ? 'stored forecast; ref not captured (launched before this script)' : undefined,
      result: v ? { model: v.name, measuredL: mL, measuredSd: msd, measuredDate: measuredDay.has(v.id) ? date(s, measuredDay.get(v.id)!) : undefined, errorInSd: r.forecast && mL !== undefined ? (mL - r.forecast.mid) / r.forecast.sd : undefined }
        : rr?.baseName ? { base: rr.baseName } : undefined,
    };
  });
  const rl = runwayLive(s), nr = nearestRival(s), sp = labSpeedView(s), cr = controlReadout(s);
  const from = s.time.day - 30;
  const alerts = s.log.filter((e) => e.day >= from && (e.severity ?? 1) >= 2);
  const byKind: Record<string, number> = {};
  for (const e of alerts) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  const pools = poolsOf(s);
  const alloc = poolAllocation(s);
  return {
    notes, simSeconds: (Date.now() - t0) / 1000, date: date(s, s.time.day), day: s.time.day, runs, evalsInProgress: evalRows(s),
    topBar: {
      researchSpeedRel: sp.rel, speedLabel: sp.label, lead: nr.nearest, cash: p.finance.cash, runwayQ: rl.rw.q, runwayState: rl.live, burnPerQ: rl.rw.burnQ,
      lossOfControlRisk: cr.risk ? { p: cr.risk.p, lo: cr.risk.lo, hi: cr.risk.hi, model: cr.risk.name } : null,
      alerts: { last30dSev2plus: alerts.length, byKind, pendingDecisions: s.events.pending.map((e) => ({ id: e.id, daysLeft: e.deadline - s.time.day })) },
    },
    trainingCompute: {
      trainingPoolH100e: pools.training, trainingPoolShareOfOnline: pools.training / Math.max(1e-9, p.computeOnline), flopPerDay: trainingFlopPerDay(s),
      idleShare: idleTrainingShare(s), idleH100e: idleTrainingShare(s) * pools.training,
      runShares: Object.fromEntries([...alloc].map(([id, sh]) => [p.models.runs.find((r) => r.id === id)?.name ?? id, sh])),
    },
  };
})();

const out = { _note: 'Player-visible only: run.forecast (runForecast at launch), evals.measuredL / measuredSd, evalQueueView. No s.hidden, no v.G / v.Lg.', A, B, C };
writeFileSync(join('design/ux/mockups/rd', 'data400-b-runs.json'), JSON.stringify(clean(out), null, 1));
console.log(JSON.stringify(clean({ A: { newRun: A.newRun, launchError: A.launchError, evals: A.evalsInProgress }, B: { simDays: B.simDays, simSeconds: B.simSeconds, pairs: B.pairs, notLaunched: B.notLaunched } }), null, 1));
