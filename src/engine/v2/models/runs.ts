// Training runs and continual learning (V2-SPEC §3.3.1, §3.1.3–3.1.4). Owner: WS1 (continual shared with WS2).
//
// Duration: flopDone += poolShare · trainingPool · Φ per day; a run completes when flopDone ≥ flopNeeded AND
// minDays have elapsed. Cash for environments/data/journals is committed at launch.
import { KAPPA, PHI_FLOP_PER_H100E_DAY, POST_PA_AT } from '../../../data/v2/calibration';
import { PLAYER_MODEL_FAMILY } from '../../../data/v2/names';
import {
  BASE_MAX_DAYS, BASE_SCALE, CONTINUE_KAPPA, DISTILL_DAYS, DISTILL_F, ENV_BUDGET_FRAC, POST_DAYS,
  POST_FLOP_F, STREAM_LAG_DAYS, STREAM_POOL_SHARE,
} from '../../../data/v2/runDesign';
import { TRAIT_IDS } from '../../../data/v2/traits';
import { clamp } from '../../rng';
import { decimalYear } from '../core/time';
import { normalizeSplit, shareRefAt } from '../departments/split';
import { dataWallPenalty, effectiveStock, tokensRequired } from '../production/data';
import { frontierFlop, hRef } from '../production/knots';
import { tcoPerH100eYear } from '../production/production';
import { consumeRunPenalty } from '../safety/responses';
import { applyBaseToLineage, applyIdaCycle, applyRunToTraits, runSignals } from '../safety/traits';
import type {
  BaseDesign, BaseModel, Day, EngineSystem, GameStateV2, ModelVersion, PostDesign, RivalLab, RunKind, RunPrediction, SystemCtx,
  ToolFamily, TraitBelief, TraitId, TrainingRun, VersionBuild,
} from '../types';
import { advanceParadigms, adopted, paradigmOff } from './paradigms';
import { evalDaysFor, runEvalSuite } from './benchmarks';
import { addOff, addSig, baseEffect, clampSignals, monitorabilityClass, postEffect, type Off } from './design';
import { domainsOf, levelOf, pcContinue, pcOfBase, pmOfBuild, refreshLevels, simpleFrontierPm } from './capability';
import { DISTILL_PM_PENALTY, DISTILL_SERVE_FACTOR } from './distill';
import { versionById } from './labs';
import { bookCash } from '../finance/ledger';
import { poolsOf } from '../compute/power';
import { ws4r } from '../actors/state';

export interface LaunchRunParams {
  kind: RunKind;
  baseId?: string;
  teacherVersionId?: string;
  base?: BaseDesign;
  post?: PostDesign;
  /** Share of the training pool (0..1). Default: base 0.6, post 0.2, distill/continue 0.1. */
  poolShare?: number;
  /** Iterated distillation & amplification cycle (P18): +0.25 y on the teacher over 21 d at 30% of the pool. */
  ida?: boolean;
}

const POOL_DEFAULT: Record<RunKind, number> = { base: 0.6, post: 0.2, distill: 0.1, continue: 0.3 };
/** Share of the training pool a run can take (LIMITS: one range for the engine and the run designer slider). */
export const POOL_SHARE_RANGE: readonly [number, number] = [0.1, 1];

/** FLOP per day of the player's whole training pool = WS3 pools (computeOnline × split.training) × Φ (P16: × 1.15). */
export function trainingFlopPerDay(s: GameStateV2): number {
  const phi = PHI_FLOP_PER_H100E_DAY * (adopted(s, 'P16') ? 1.15 : 1);
  return poolsOf(s).training * phi;
}

/** Frontier (base/post) runs are paused until this day by WS4 (E17 Pause & investigate, pause pledges). */
export const frontierPaused = (s: GameStateV2, day: Day = s.time.day) => ws4r(s).frontierPauseUntil > day;

/** Why a running run makes no progress today, or undefined (run queue readout). */
export function runStall(s: GameStateV2, r: TrainingRun): string | undefined {
  if (r.status !== 'running') return undefined;
  if (r.holdUntil !== undefined && r.holdUntil > s.time.day) return 'loss spike: restarting';
  if (trainingFlopPerDay(s) <= 0) return 'paused: no training compute';
  return undefined;
}

/** Effective pool shares of running runs this day. When the runs ask for more than the pool left by the stream,
 *  base and continue runs keep their share first and the other runs are scaled down [D: pretraining has priority]. */
export function poolAllocation(s: GameStateV2): Map<string, number> {
  const running = s.player.models.runs.filter((r) => r.status === 'running' && !(r.holdUntil !== undefined && r.holdUntil > s.time.day));
  const avail = 1 - (s.player.models.stream ? STREAM_POOL_SHARE : 0);
  const pre = running.filter((r) => r.kind === 'base' || r.kind === 'continue');
  const rest = running.filter((r) => r.kind !== 'base' && r.kind !== 'continue');
  const sumPre = pre.reduce((a, r) => a + r.poolShare, 0);
  const kPre = sumPre > avail ? avail / sumPre : 1;
  const left = Math.max(0, avail - sumPre * kPre);
  const sumRest = rest.reduce((a, r) => a + r.poolShare, 0);
  const kRest = sumRest > left ? left / sumRest : 1;
  return new Map([...pre.map((r) => [r.id, r.poolShare * kPre] as const), ...rest.map((r) => [r.id, r.poolShare * kRest] as const)]);
}

/** Compute-cost equivalent ($B) of `flop` at today's TCO. */
function flopCost(s: GameStateV2, flop: number): number {
  return (flop / PHI_FLOP_PER_H100E_DAY / 365) * tcoPerH100eYear(s, decimalYear(s));
}

export interface RunPlan {
  flopNeeded: number;
  minDays: number;
  cashCost: number;
  etaDays: number;
  poolShare: number;
  prediction: RunPrediction;
  reason?: string;
}

/** Plan (and validate) a run without launching it: FLOP, wall time, cash and the run-card prediction (§3.3.2). */
export function planRun(s: GameStateV2, p: LaunchRunParams, rollDays = (lo: number, hi: number) => (lo + hi) / 2): RunPlan {
  const w = s.hidden.timeline;
  const yr = decimalYear(s);
  const F = frontierFlop(w, yr);
  const m = s.player.models;
  const poolShare = clamp(p.poolShare ?? (p.ida ? 0.3 : POOL_DEFAULT[p.kind]), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
  const flopDay = Math.max(1, trainingFlopPerDay(s) * poolShare);
  let flopNeeded = 0;
  let minDays = 0;
  let cash = 0;
  let reason: string | undefined;
  let pmPred = s.player.pa;
  let off: Off = {};
  let signals = {};
  let serve = 0.5;
  let mon = 0.9;
  const base = p.baseId ? m.bases.find((b) => b.id === p.baseId) : undefined;
  const teacher = versionById(s, p.teacherVersionId);
  if (p.kind === 'base') {
    const d = p.base;
    if (!d) return failPlan('No design');
    if (d.shape === 'latent' && !adopted(s, 'P17')) reason = 'Needs neuralese (P17)';
    if (d.data === 'synthetic' && !teacher) reason = 'Synthetic data needs a teacher version';
    if (d.scale === 'continue') reason = 'Use a continue run';
    const be = baseEffect(d);
    flopNeeded = BASE_SCALE[d.scale].F * F * be.flopMult;
    minDays = BASE_SCALE[d.scale].minDays;
    cash = flopCost(s, flopNeeded) * be.cashMult + d.licensedShare * 1.0 * Math.sqrt(BASE_SCALE[d.scale].F); // licensed data [D]
    if (flopNeeded / flopDay > BASE_MAX_DAYS) reason = `Training pool too small (>${BASE_MAX_DAYS} d)`;
    const pc = pcOfBase(w, s.time.day, flopNeeded, s.player.scDay);
    pmPred = s.player.pa + pc + be.dp + baseDataWall(s, d, flopNeeded) + (adopted(s, 'P24') ? 0.8 : 0);
    off = be.domains;
    signals = be.signals;
    serve = be.serve;
    mon = be.monitorability;
  } else if (p.kind === 'post') {
    if (!base) return failPlan('Pick a base');
    const d = p.post;
    if (!d) return failPlan('No design');
    if (d.cot === 'faithful' && !adopted(s, 'P23')) reason = 'Needs faithful-CoT architecture (P23)';
    if (d.cot === 'latent' && base.design.shape !== 'latent') reason = 'Latent CoT needs a latent base';
    if (base.design.shape === 'latent' && d.cot !== 'latent') reason = 'A latent base forces latent CoT';
    if (d.rlFocus !== 'broad' && d.rlFocus.includes('computerUse') && !adopted(s, 'P06')) reason = 'Needs computer use (P06)';
    if (d.rlFocus !== 'broad' && d.rlFocus.length > 2) reason = 'Pick at most 2 RL families';
    const pe = postEffect(d);
    if (p.ida) {
      if (!teacher) return failPlan('Pick a version to amplify');
      flopNeeded = 0.3 * 21 * trainingFlopPerDay(s);
      minDays = 21;
      pmPred = teacher.pm + 0.25;
    } else {
      flopNeeded = POST_FLOP_F[d.rlIntensity] * F;
      const [lo, hi] = POST_DAYS[d.rlIntensity];
      minDays = Math.round(rollDays(lo, hi) + rollDays(pe.extraDays[0], pe.extraDays[1]));
      const paPost = s.player.pa + (POST_PA_AT === 'end' ? ((s.player.prodCache?.rate ?? 1) * minDays) / 365 : 0);
      pmPred = base.paAtStart + KAPPA.post * (paPost - base.paAtStart) + base.pc + (base.dp ?? 0) + pe.dp;
    }
    if (d.rlIntensity === 'heavyHardened' && !adopted(s, 'P15')) cash += ENV_BUDGET_FRAC * flopCost(s, flopNeeded);
    else if (d.rlIntensity === 'heavyHardened') cash += 0.1 * flopCost(s, flopNeeded); // P15: hardened graders at the cheap price
    off = addOff(base.off ?? {}, pe.domains);
    signals = addSig(base.signals ?? {}, pe.signals);
    serve = (base.serve ?? 0.5) * pe.serve * (adopted(s, 'P16') ? 0.75 : 1);
    mon = Math.min(base.monitorability ?? 1, pe.monitorability);
  } else if (p.kind === 'distill') {
    if (!teacher) return failPlan('Pick a teacher version');
    flopNeeded = DISTILL_F * F;
    minDays = DISTILL_DAYS;
    pmPred = teacher.pm - DISTILL_PM_PENALTY;
    off = teacher.build?.off ?? {};
    serve = teacher.serveCost * DISTILL_SERVE_FACTOR;
    mon = teacher.monitorability;
  } else {
    if (!base) return failPlan('Pick a base');
    flopNeeded = BASE_SCALE.continue.F * F;
    minDays = BASE_SCALE.continue.minDays;
    pmPred = base.paAtStart + CONTINUE_KAPPA * (s.player.pa - base.paAtStart) + base.pc + pcContinue(w, s.time.day, flopNeeded, base.flop) + (base.dp ?? 0);
    off = base.off ?? {};
    serve = base.serve ?? 0.5;
    mon = base.monitorability ?? 1;
  }
  const etaDays = Math.max(minDays, Math.ceil(flopNeeded / flopDay));
  if (cash > s.player.finance.cash) reason ??= 'Not enough cash';
  if ((p.kind === 'base' || p.kind === 'post') && frontierPaused(s)) reason ??= 'Frontier runs are paused';
  const Lg = levelOf(w, pmPred);
  const doms = domainsOf(w, pmPred, addOff(off, paradigmOff(s)), adopted(s, 'P19'));
  // Run-card ▲ arrows are WS2's runSignals (the signals applyRunToTraits will actually apply); the design table's
  // signals are only a fallback when WS2 returns nothing for this kind.
  const ws2Signals = runSignals(s, { kind: p.kind, ...(p.base ? { base: p.base } : {}), ...(p.post ? { post: p.post } : {}) } as TrainingRun);
  const prediction: RunPrediction = {
    Lg: [Lg - 0.25, Lg + 0.25],
    domains: Object.fromEntries(Object.entries(doms).map(([k, v]) => [k, [v - 0.25, v + 0.25]])) as RunPrediction['domains'],
    signals: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, ...clampSignals(Object.values(ws2Signals).some((x) => x > 0) ? ws2Signals : signals) },
    etaDays, serveCost: serve, monitorability: monitorabilityClass(mon),
  };
  return { flopNeeded, minDays, cashCost: cash, etaDays, poolShare, prediction, reason };

  function failPlan(why: string): RunPlan {
    const zero = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0 };
    return { flopNeeded: 0, minDays: 0, cashCost: 0, etaDays: 0, poolShare, reason: why, prediction: { Lg: [0, 0], domains: {} as RunPrediction['domains'], signals: zero, etaDays: 0, serveCost: 0.5, monitorability: 'high' } };
  }
}

/** Data-wall Δp of a base (§3.3.2): −0.25·ln(N_req/S_eff) capped −0.5; none for synthetic/multimodal or with P10. */
function baseDataWall(s: GameStateV2, d: BaseDesign, flop: number): number {
  if (d.data === 'synthetic' || d.data === 'multimodal' || adopted(s, 'P10')) return 0;
  return dataWallPenalty(effectiveStock(s), tokensRequired(flop, d.shape === 'overtrained'));
}

/** Run card prediction (§3.3.2 "Run card"). */
export function predictRun(s: GameStateV2, p: LaunchRunParams): RunPrediction {
  return planRun(s, p).prediction;
}

/** Launch a run (commits cash, §3.3.1). Returns the run or a reason string. */
export function launchRun(s: GameStateV2, ctx: SystemCtx, p: LaunchRunParams): TrainingRun | string {
  const rng = ctx.rng('runs');
  const plan = planRun(s, p, (lo, hi) => rng.range(lo, hi));
  if (plan.reason) return plan.reason;
  const m = s.player.models;
  const n = m.nextName++;
  const kindName = p.ida ? 'IDA' : p.kind;
  const base = p.baseId ? m.bases.find((b) => b.id === p.baseId) : undefined;
  const be = p.kind === 'base' && p.base ? baseEffect(p.base) : undefined;
  const pe = p.post ? postEffect(p.post) : undefined;
  let signals = be ? be.signals : pe ? addSig(base?.signals ?? {}, pe.signals) : {};
  if (p.kind === 'distill') signals = versionById(s, p.teacherVersionId)?.build?.signals ?? {};
  const run: TrainingRun = {
    id: `R${n}`, kind: p.kind, name: `${kindName} ${n}`, startDay: s.time.day,
    flopNeeded: plan.flopNeeded, flopDone: 0, minDays: plan.minDays, poolShare: plan.poolShare, cashCost: plan.cashCost,
    predicted: plan.prediction, status: 'running', restarts: 0, paAtStart: s.player.pa, signals: clampSignals(signals),
  };
  if (p.baseId) run.baseId = p.baseId;
  if (p.teacherVersionId) run.teacherVersionId = p.teacherVersionId;
  if (p.base) run.base = { ...p.base, curation: { ...p.base.curation } };
  if (p.post) run.post = { ...p.post, rlFocus: Array.isArray(p.post.rlFocus) ? [...p.post.rlFocus] : 'broad', techniques: [...p.post.techniques], trainAgainst: [...p.post.trainAgainst] };
  if (p.ida) run.name = `IDA ${n}`;
  run.signals = clampSignals(run.base || run.post || run.kind === 'distill' ? runSignals(s, run) : signals);
  m.runs.push(run);
  if (plan.cashCost > 0) bookCash(s, ctx, -plan.cashCost, 'training', 'training run', run.name);
  if (p.kind === 'base' && p.base?.scale === 'stretch') ctx.bump('relations.scrutiny', 5, 'stretch base run', run.name); // §3.4.3
  ctx.log('research', `Run launched: ${run.name} (ETA ${plan.etaDays} d).`, 1, run.id);
  return run;
}

// ───────────────────────────── completion ─────────────────────────────

const blankBeliefs = (src?: ModelVersion): Record<TraitId, TraitBelief> => {
  const out = {} as Record<TraitId, TraitBelief>;
  for (const t of TRAIT_IDS) {
    const b = src?.beliefs[t];
    out[t] = b ? { est: b.est, sd: Math.min(0.35, b.sd + 0.05), clarity: Math.max(0, 1 - Math.min(0.35, b.sd + 0.05) / 0.35) } : { est: 0.2, sd: 0.3, clarity: 1 - 0.3 / 0.35 };
  }
  return out;
};
const copyMasks = (src?: ModelVersion) => {
  const out = {} as Record<TraitId, Partial<Record<ToolFamily, number>>>;
  for (const t of TRAIT_IDS) out[t] = { ...(src?.masks[t] ?? {}) };
  return out;
};

/** Latest non-retired version on a base (the natural parent of a new post-train). */
function latestOnBase(s: GameStateV2, baseId: string): ModelVersion | undefined {
  let v: ModelVersion | undefined;
  for (const x of s.player.models.versions) if (x.baseId === baseId && x.variant === 'full' && (!v || x.day >= v.day)) v = x;
  return v;
}

function versionName(s: GameStateV2, baseId: string, suffix = ''): string {
  const b = s.player.models.bases.find((x) => x.id === baseId);
  const nOn = s.player.models.versions.filter((v) => v.baseId === baseId).length;
  return `${b?.name ?? PLAYER_MODEL_FAMILY}.${nOn}${suffix}`;
}

function newVersion(s: GameStateV2, run: TrainingRun, base: BaseModel, build: VersionBuild, parent: ModelVersion | undefined, extra: Partial<ModelVersion>): ModelVersion {
  const w = s.hidden.timeline;
  const pm = pmOfBuild(build);
  const v: ModelVersion = {
    id: `V${s.player.models.nextName++}`, name: versionName(s, base.id), baseId: base.id, day: s.time.day,
    variant: 'full', design: run.post ? { ...run.post } : { ...(parent?.design ?? { pref: 'constitution', rlFocus: 'broad', rlIntensity: 'heavyHardened', inoculation: false, cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [] }) },
    pm, Lg: levelOf(w, pm), domains: domainsOf(w, pm, build.off, adopted(s, 'P19')),
    traitsTrue: { ...(parent?.traitsTrue ?? base.traitsTrue) }, masks: copyMasks(parent), uModes: [...base.uModes],
    monitorability: 0.9, serveCost: base.serve ?? 0.5, evals: { bench: {}, safety: {} }, beliefs: blankBeliefs(parent ?? versionById(s, s.player.models.internalAgent)),
    status: 'evaluating', flags: {}, build, ...extra,
  };
  if (parent) v.parentVersionId = parent.id;
  return v;
}

/** Complete a run: create the base or version, call the WS2 trait hook, start the eval suite. */
function completeRun(s: GameStateV2, ctx: SystemCtx, run: TrainingRun) {
  const w = s.hidden.timeline;
  const m = s.player.models;
  run.status = 'done';
  const pOff = paradigmOff(s);
  if (run.kind === 'base' && run.base) {
    const be = baseEffect(run.base);
    const parent = run.teacherVersionId ? versionById(s, run.teacherVersionId) : undefined;
    const newLineage = true;
    const nb = m.bases.length + 1;
    const startDay = run.startDay;
    const dp = be.dp + baseDataWall(s, run.base, run.flopNeeded) + (adopted(s, 'P24') ? 0.8 : 0);
    const b: BaseModel = {
      id: `B${nb}`, name: `${PLAYER_MODEL_FAMILY}-${nb}`, day: s.time.day, startDay, flop: run.flopNeeded,
      paAtStart: run.paAtStart ?? s.player.pa, pc: pcOfBase(w, startDay, run.flopNeeded, s.player.scDay), design: run.base,
      dp, off: be.domains, serve: be.serve, monitorability: be.monitorability, signals: be.signals,
      lineage: newLineage ? `L-player-${nb}` : m.bases[m.bases.length - 1].lineage,
      traitsTrue: { ...(parent?.traitsTrue ?? m.bases[0].traitsTrue) },
      uModes: [],
    };
    m.bases.push(b);
    applyBaseToLineage(s, ctx, run, b); // WS2 hook: new lineage traits and U-modes (§3.4.4, §3.5.5)
    ctx.log('research', `Base model ${b.name} finished pretraining.`, 2, b.id);
    return;
  }
  if (run.kind === 'continue') {
    const parent = m.bases.find((b) => b.id === run.baseId);
    if (!parent) return;
    const nb = m.bases.length + 1;
    const b: BaseModel = {
      ...parent, id: `B${nb}`, name: `${parent.name}c`, day: s.time.day, startDay: run.startDay, flop: parent.flop + run.flopNeeded,
      paAtStart: parent.paAtStart + CONTINUE_KAPPA * ((run.paAtStart ?? s.player.pa) - parent.paAtStart),
      pc: parent.pc + pcContinue(w, run.startDay, run.flopNeeded, parent.flop), parentBaseId: parent.id,
      traitsTrue: { ...parent.traitsTrue }, uModes: [...parent.uModes], off: { ...(parent.off ?? {}) }, signals: { ...(parent.signals ?? {}) },
    };
    m.bases.push(b);
    applyBaseToLineage(s, ctx, run, b); // WS2 hook: continue runs step the lineage traits (ω 0.5)
    ctx.log('research', `Continued pretraining: ${b.name}.`, 1, b.id);
    return;
  }
  if (run.kind === 'distill') {
    const t = versionById(s, run.teacherVersionId);
    if (!t) return;
    const base = m.bases.find((b) => b.id === t.baseId) ?? m.bases[0];
    const tb = t.build ?? fallbackBuild(t);
    const build: VersionBuild = { ...tb, paBase: tb.paBase, paPost: tb.paPost, dp: tb.dp - DISTILL_PM_PENALTY, off: { ...tb.off }, signals: { ...tb.signals } };
    if (s.player.models.stream?.versionId === t.id) build.paPost = s.player.models.stream.paTrack ?? tb.paPost;
    const v = newVersion(s, run, base, build, t, { variant: 'mini', serveCost: t.serveCost * DISTILL_SERVE_FACTOR, monitorability: t.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1 });
    v.name = `${t.name}-mini`;
    m.versions.push(v);
    afterVersion(s, ctx, run, v);
    return;
  }
  // post (incl. IDA)
  const base = m.bases.find((b) => b.id === run.baseId);
  if (!base || !run.post) return;
  const pe = postEffect(run.post);
  const parent = latestOnBase(s, base.id) ?? versionById(s, run.teacherVersionId);
  if (run.name.startsWith('IDA')) {
    const t = versionById(s, run.teacherVersionId);
    if (!t) return;
    const tb = t.build ?? fallbackBuild(t);
    const build: VersionBuild = { ...tb, dp: tb.dp + 0.25, off: { ...tb.off }, signals: { ...tb.signals } };
    const v = newVersion(s, run, base, build, t, { serveCost: t.serveCost, monitorability: t.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1 });
    m.versions.push(v);
    afterVersion(s, ctx, run, v, t);
    return;
  }
  const paPost = POST_PA_AT === 'end' ? s.player.pa : (run.paAtStart ?? s.player.pa);
  const h80Mult = pe.h80Mult * (adopted(s, 'P07') ? 1.5 : 1) * (adopted(s, 'P12') ? 2 : 1);
  const build: VersionBuild = {
    paBase: base.paAtStart, paPost, kappa: KAPPA.post, pc: base.pc, dp: (base.dp ?? 0) + pe.dp - consumeRunPenalty(s),
    off: addOff(addOff(base.off ?? {}, pe.domains), pOff), h80Mult, misuseMult: pe.misuseMult,
    signals: clampSignals(addSig(base.signals ?? {}, pe.signals)),
  };
  const v = newVersion(s, run, base, build, parent, {
    serveCost: (base.serve ?? 0.5) * pe.serve * (adopted(s, 'P16') ? 0.75 : 1),
    monitorability: Math.min(base.monitorability ?? 1, pe.monitorability), appeal: pe.appeal,
  });
  m.versions.push(v);
  afterVersion(s, ctx, run, v);
}

function fallbackBuild(v: ModelVersion): VersionBuild {
  return { paBase: v.pm, paPost: v.pm, kappa: 0, pc: 0, dp: 0, off: {}, h80Mult: 1, misuseMult: 1, signals: {} };
}

/** WS2 trait hooks for a finished post/distill/IDA run (§3.5.4). An IDA cycle (P18) is WS2's applyIdaCycle on the
 *  teacher's traits (ω 0.4, misalignment × 1.1); applyRunToTraits still sets its masks, U-modes and beliefs. */
function afterVersion(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, v: ModelVersion, idaTeacher?: ModelVersion) {
  applyRunToTraits(s, ctx, run, v);
  if (idaTeacher) {
    v.traitsTrue = { ...idaTeacher.traitsTrue };
    applyIdaCycle(s, v);
  }
  ctx.log('research', `${v.name} finished training (evaluating).`, 2, v.id);
}

// ───────────────────────────── daily systems ─────────────────────────────

/** Promote evaluated versions: the eval suite completes `evalDaysFor(gate)` days after a version finishes. */
function promoteEvaluated(s: GameStateV2, ctx: SystemCtx) {
  const days = evalDaysFor(s);
  for (const v of s.player.models.versions) {
    if (v.status === 'evaluating' && ctx.day >= v.day + days) {
      runEvalSuite(s, ctx, v.id);
      v.status = 'ready';
    }
  }
}

/** runs (40, daily): add FLOP to running runs; on completion create base/version, call WS2 applyRunToTraits,
 *  queue the eval. Also advances paradigm projects (§3.3.3). */
export const runsSystem: EngineSystem = {
  id: 'runs', owner: 'WS1', cadence: 'daily', order: 40,
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    // WS4 pauses frontier runs (status 'paused'); they resume when the pause ends.
    if (!frontierPaused(s, ctx.day)) for (const r of s.player.models.runs) if (r.status === 'paused' && (r.kind === 'base' || r.kind === 'post')) r.status = 'running';
    const alloc = poolAllocation(s);
    const flopDay = trainingFlopPerDay(s);
    for (const run of s.player.models.runs) {
      if (run.status !== 'running') continue;
      const share = alloc.get(run.id) ?? 0;
      run.flopDone += share * flopDay;
      // Loss spikes (stretch / MoE): restart probability spread over the run's expected length (§3.3.1).
      const risk = run.base ? baseEffect(run.base).restart : 0;
      if (risk > 0 && run.restarts === 0 && (run.holdUntil === undefined || run.holdUntil <= ctx.day)) {
        const rng = ctx.rng('runs');
        if (rng.chance(risk / Math.max(30, run.minDays))) {
          run.restarts++;
          run.holdUntil = ctx.day + Math.round(rng.range(14, 28));
          run.flopDone *= 0.85;
          ctx.log('research', `Loss spike in ${run.name}: rolling back to a checkpoint.`, 2, run.id);
        }
      }
      if (run.flopDone >= run.flopNeeded && ctx.day - run.startDay >= run.minDays) completeRun(s, ctx, run);
    }
    promoteEvaluated(s, ctx);
    advanceParadigms(s, ctx);
    // Finished runs are kept for 120 days for the UI, then dropped (save budget).
    s.player.models.runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused' || ctx.day - r.startDay < 400);
  },
};

// ───────────────────────────── lab API for non-player labs (WS4 drives them) ─────────────────────────────

/** Reference split for a non-player lab: the shares track shareRef(t), keeping the lab's own safety share (WS4 sets
 *  it from posture). The research mix is re-split to the best one by the production system. */
export function labReferenceSplit(s: GameStateV2, r: RivalLab): void {
  const ref = shareRefAt(decimalYear(s));
  const keep = r.core.split.safety;
  const rest = 1 - ref.safety;
  const sp = { ...ref, safety: r.core.split.safety };
  for (const k of ['training', 'experiments', 'agents', 'synthetic', 'serving'] as const) sp[k] = (ref[k] / rest) * (1 - keep);
  r.core.split = normalizeSplit(sp);
}

/** Capabilities staff of a non-player lab grow with the reference headcount path (keeps h constant). */
export function growLabStaff(s: GameStateV2, r: RivalLab): void {
  const yr = decimalYear(s);
  r.core.staff.cap *= hRef(yr) / hRef(yr - 1 / 365);
}

/** The internal model of a non-player lab tracks its simple frontier (pa + scale term − reference release lag,
 *  simpleFrontierPm). WS4 calls this daily for the labs it manages; model identity, traits and releases are WS4's. */
export function trackLabFrontier(s: GameStateV2, r: RivalLab): void {
  const w = s.hidden.timeline;
  const target = simpleFrontierPm(s, r.core.id);
  const m = r.internal;
  if (target > m.pm) {
    m.pm = target;
    m.Lg = levelOf(w, m.pm);
    m.domains = domainsOf(w, m.pm);
  }
}

/** Default policy for non-player labs not managed by WS4: reference split, staff growth, frontier tracking, and the
 *  public model trailing by 0.15 y. */
function defaultLabPolicy(s: GameStateV2, r: RivalLab) {
  if (r.managed || r.core.status !== 'active') return;
  const w = s.hidden.timeline;
  labReferenceSplit(s, r);
  growLabStaff(s, r);
  trackLabFrontier(s, r);
  const m = r.internal;
  if (r.publicModel && m.pm - 0.15 > r.publicModel.pm) {
    const pub = r.publicModel;
    pub.pm = m.pm - 0.15;
    pub.Lg = levelOf(w, pub.pm);
    pub.domains = domainsOf(w, pub.pm);
  }
}

/** Stream (P08): the version's pm tracks pa with a 7-day lag (first-order), κ = 1 (§3.3.1). WS2 adds trait drift
 *  (1/42 of a post-train run per day) via its own hook on `stream`. */
function advanceStream(s: GameStateV2) {
  const st = s.player.models.stream;
  if (!st) return;
  const v = versionById(s, st.versionId);
  if (!v || v.status === 'retired' || v.status === 'rolledBack') {
    delete s.player.models.stream;
    return;
  }
  const b = v.build ?? fallbackBuild(v);
  const a = 1 - Math.exp(-1 / STREAM_LAG_DAYS);
  st.paTrack = (st.paTrack ?? b.paPost) + a * (s.player.pa - (st.paTrack ?? b.paPost));
  b.kappa = KAPPA.stream;
  b.paPost = st.paTrack;
  v.build = b;
  const pm = pmOfBuild(b);
  if (pm > v.pm) {
    v.pm = pm;
    refreshLevels(s.hidden.timeline, v, adopted(s, 'P19'));
  }
}

/** Start a continual-learning stream on a version (needs P08). Returns an error string or undefined. */
export function startStream(s: GameStateV2, versionId: string, day: Day = s.time.day): string | undefined {
  if (!adopted(s, 'P08')) return 'Needs continual learning (P08)';
  const v = versionById(s, versionId);
  if (!v || v.variant !== 'full') return 'Pick a full version';
  const b = v.build ?? fallbackBuild(v);
  // The stream continues from the version's current capability: paTrack starts where pm already is. Moving a running
  // stream onto a version (e.g. on a newer base) carries the know-how it already absorbed [D].
  const old = s.player.models.stream;
  const own = b.paBase + b.kappa * (b.paPost - b.paBase);
  const paTrack = old && old.versionId !== versionId ? Math.max(own, old.paTrack ?? own) : own;
  v.build = { ...b, kappa: KAPPA.stream, paBase: paTrack, paPost: paTrack };
  const pm = pmOfBuild(v.build);
  if (pm > v.pm) {
    v.pm = pm;
    refreshLevels(s.hidden.timeline, v, adopted(s, 'P19'));
  }
  s.player.models.stream = { versionId, startedDay: day, lastAuditDay: day, paTrack };
  return undefined;
}

/** continual (45, daily): stream versions track pa; default frontier tracking for unmanaged rival/China labs. */
export const continualSystem: EngineSystem = {
  id: 'continual', owner: 'WS1', cadence: 'daily', order: 45,
  run(s) {
    advanceStream(s);
    for (const r of [...s.rivals, s.china.lab]) defaultLabPolicy(s, r);
  },
};

