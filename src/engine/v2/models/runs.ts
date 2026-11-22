// Training runs and continual learning (V2-SPEC §3.3.1, §3.1.3–3.1.4; model v3 V1: design/MODEL-V3.md §3–§4). Owner:
// WS1 (continual shared with WS2).
//
// Models are built from physical quantities (models/effective.ts): a base run is N_active parameters × tokens
// (FLOP = 6ND), a post-training run is RL FLOP (a share of the base's FLOP) on the RL curve, a distillation run trains a
// student of N_s parameters on teacher outputs, a continue run adds pretraining FLOP to a base. Duration is work ÷
// capacity: flopDone += share · trainingPool · Φ · goodput (× MFU_RL for RL) per day, and a run completes when its FLOP is
// done (no minimum lengths, no restart roll: interruptions are the goodput). Cash for environments/data is committed at
// launch. R5: a run trains only once the engineers have built its setup (departments/build.ts); running runs share the
// pool in proportion to their pool shares, and training compute no run uses flows to research experiments or data.
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { PLAYER_MODEL_FAMILY } from '../../../data/v2/names';
import {
  CONTINUE_SHARE, FLOP_RL_REF, DISTILL_TPP, E_START, GOODPUT, IDA_RL_SHARE, MFU_RL_FACTOR, PARAM_RANGE, RL_BUDGET, RL_FAMILY_IDS,
  STREAM_LAG_DAYS, STREAM_POOL_SHARE, STUDENT_DEFAULT, TPP_FREE_MAX, TPP_RANGE, sizeScrutiny,
} from '../../../data/v2/runDesign';
import { buildEtas, buildWaitNew, engScale, queueBuild, runSetupTW, runWaiting } from '../departments/build';
import { TRAIT_IDS } from '../../../data/v2/traits';
import { clamp } from '../../rng';
import { decimalYear } from '../core/time';
import { playerDraw, type DataDraw } from '../production/data';
import { frontierFlop } from '../production/ces';
import { tcoPerH100eYear } from '../production/production';
import { consumeRunPenalty } from '../safety/responses';
import { applyBaseToLineage, applyIdaCycle, applyRunToTraits, baseSignals, postSignals, runSignals } from '../safety/traits';
import { suiteExploitMap, suiteFidMap, suiteOf, suiteRlWeights } from './suites';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import type {
  BaseDesign, BaseModel, Day, DomainId, EngineSystem, GameStateV2, ModelVersion, PostDesign, RLFamily, RunKind, RunPrediction, SystemCtx,
  RunRecipe, ToolFamily, TraitBelief, TraitId, TrainingRun, VersionBuild,
} from '../types';
import { adopted } from './paradigms';
import { optionLocked } from './tree';
import type { DomainMap } from './effective';
import { releaseEvals } from './evals';
import { addOff, addSig, baseEffect, clampSignals, monitorabilityClass, postEffect, type Off } from './design';
import { domainsOf, finishBuild, gOfDomain, levelOfG, refreshLevels } from './capability';
import { ePreAt, gEquivOf, rlCeilNow, rlMidNow, serveFlopOomOf, serveNow, trainNow } from './stacks';
import { stackRate } from './research';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import {
  continueGPre, daysFor, distillFlop, distillGap, fDataEff, flopOfDesign, gPreOf, rlGains, rlWeights, fptOfDesign,
  servingFlop, type FamilyMap, type GPreParts, type RlGains,
} from './effective';
import { internalVersion, uniqueVersionName, versionById } from './labs';
import { measuredSd } from './benchmarks';
import { bookCash } from '../finance/ledger';
import { poolsOf } from '../compute/power';
import { ws4r } from '../actors/state';

export interface LaunchRunParams {
  kind: RunKind;
  baseId?: string;
  teacherVersionId?: string;
  base?: BaseDesign;
  post?: PostDesign;
  /** Share of the training pool (0..1). Default RUN_POOL_DEFAULT (IDA 0.3). */
  poolShare?: number;
  /** Iterated distillation & amplification cycle (P18): one more RL budget (IDA_RL_SHARE × the base's FLOP) on the
   *  teacher at today's RL recipe. */
  ida?: boolean;
  /** Distillation: student active parameters (default STUDENT_DEFAULT × the teacher's). */
  studentParams?: number;
}

/** Default pool share per run kind (RD-B01: the Blueprint reads these too). */
export const RUN_POOL_DEFAULT: Readonly<Record<RunKind, number>> = { base: 0.6, post: 0.2, distill: 0.1, continue: 0.3 };
/** Share of the training pool a run can take (LIMITS: one range for the engine and the run designer slider). */
export const POOL_SHARE_RANGE: readonly [number, number] = [0.02, 1];

/** FLOP per day of the player's whole training pool = WS3 pools (computeOnline × split.training) × Φ (Φ contains MFU 0.4
 *  [R20 A4]) × the systems stack's training throughput (model v3 V2: MFU and goodput ideas, OOM; P16 AI kernels,
 *  elastic training). */
export function trainingFlopPerDay(s: GameStateV2): number {
  return poolsOf(s).training * PHI_FLOP_PER_H100E_DAY * Math.pow(10, trainNow(s));
}
/** Goodput (share of wall time spent training): 0.90 [R20 A4, incl. 2024 fault tolerance, now ★]. Goodput ideas raise
 *  the systems stack's training throughput instead (trainingFlopPerDay). */
export const goodputOf = (_s: GameStateV2) => GOODPUT;
/** Model FLOP a run of `kind` completes per day per unit of pool share: the pool's FLOP × goodput, × MFU_RL for RL
 *  (post-training, amplification) runs whose rollouts are inference [R20 A4, C1]. */
export function runFlopPerShareDay(s: GameStateV2, r: Pick<TrainingRun, 'kind'>): number {
  return trainingFlopPerDay(s) * goodputOf(s) * (r.kind === 'post' ? MFU_RL_FACTOR : 1);
}

/** Serve-cost multiplier for new post-trained versions: 10^(−the serving stack's FLOP part) (model v3 V2: Inference
 *  efficiency line, P16 AI kernels; quantization and speculative decoding are ★, part of the reference). D10: the stack's
 *  first 0.33 OOM raise the lab's decode utilisation for every model it serves instead (stacks.ts serveSplit). */
export function serveTechMult(s: GameStateV2): number {
  return Math.pow(10, -serveFlopOomOf(serveNow(s)));
}


/** Frontier (base/post) runs are paused until this day by WS4 (E17 Pause & investigate, pause pledges). */
export const frontierPaused = (s: GameStateV2, day: Day = s.time.day) => ws4r(s).frontierPauseUntil > day;

/** RD-B09 (DD-11): share of the run-operations need the research engineers served today (models/research.ts
 *  opsServed, written by the research system before runs advance; 1 in older saves). Running runs and the
 *  continual-learning stream advance at this share: short of operators, failures and restarts wait (lost goodput). */
export const runOpsServed = (s: GameStateV2) => s.player.research.last?.opsServed ?? 1;

/** Why a running run makes no or slowed progress today, or undefined (run queue readout). */
export function runStall(s: GameStateV2, r: TrainingRun): string | undefined {
  if (r.status !== 'running') return undefined;
  if (runWaiting(r)) return 'waiting for engineers';
  if (trainingFlopPerDay(s) <= 0) return 'paused: no training compute';
  const ops = runOpsServed(s);
  if (ops < 0.995) return `slowed to ${Math.round(ops * 100)}%: too few research engineers on run operations`;
  return undefined;
}

/** Share of the training pool the continual-learning stream takes (0 without a stream). */
export const streamShare = (s: GameStateV2) => (s.player.models.stream ? STREAM_POOL_SHARE : 0);

/** Runs that train today: running, set up, FLOP not yet done. */
const trainingRuns = (s: GameStateV2) => s.player.models.runs.filter((r) => r.status === 'running' && !runWaiting(r) && r.flopDone < r.flopNeeded);

/** Effective pool shares of the runs that train today (R5: proportional). Each run gets its pool share; when they ask
 *  for more than the pool left by the stream, all are scaled down by the same factor. */
export function poolAllocation(s: GameStateV2): Map<string, number> {
  const running = trainingRuns(s);
  const avail = 1 - streamShare(s);
  const sum = running.reduce((a, r) => a + r.poolShare, 0);
  const k = sum > avail ? avail / sum : 1;
  return new Map(running.map((r) => [r.id, r.poolShare * k] as const));
}

/** Share of the training pool no run or stream uses today: it runs research experiments or data generation (R5). */
export function idleTrainingShare(s: GameStateV2): number {
  let used = streamShare(s);
  for (const r of trainingRuns(s)) used += r.poolShare;
  return Math.max(0, 1 - used);
}

/** The share a new run asking `share` would get today, next to the runs that train now. */
export function shareIfLaunched(s: GameStateV2, share: number): number {
  const avail = 1 - streamShare(s);
  const sum = trainingRuns(s).reduce((a, r) => a + r.poolShare, 0) + share;
  return sum > avail ? (share * avail) / sum : share;
}

/** Days until a running run finishes at today's pool and its actual share (run queue ETA): the wait for its setup,
 *  then FLOP left ÷ rate (× today's run operations served, RD-B09). Infinity with no training compute. */
export function runEtaDays(s: GameStateV2, r: TrainingRun, alloc = poolAllocation(s)): number {
  const waiting = runWaiting(r);
  const share = alloc.get(r.id) ?? (waiting ? shareIfLaunched(s, r.poolShare) : r.poolShare);
  const wait = waiting ? (buildEtas(s).etas.get(r.setupId ?? '') ?? 0) : 0;
  const left = Math.max(0, r.flopNeeded - r.flopDone);
  return wait + Math.ceil(daysFor(left, share * runFlopPerShareDay(s, r) * runOpsServed(s)));
}

/** Ideas the lab is likely to adopt while a run of `days` trains, at the recent rate (count and OOM G-equivalent): what
 *  the base will not embody (V3-BUILD V2.7: replaces "behind at finish" in progress-months). */
export function adoptedDuring(s: GameStateV2, days: number): { ideas: number; oom: number } {
  const r = stackRate(s);
  return { ideas: Math.round(r.ideasPerDay * days), oom: r.oomPerDay * days };
}

/** Compute-cost equivalent ($B) of `flop` at today's TCO. */
function flopCost(s: GameStateV2, flop: number): number {
  return (flop / PHI_FLOP_PER_H100E_DAY / 365) * tcoPerH100eYear(s, decimalYear(s));
}

/** Horizon extender (MODEL-V3 §7.2, typed: × h50 of versions trained after adoption). Long context + memory (P07) ×1.2
 *  [D]: research/12 #7 proposed ×1.5 [G, no primary source]; CL-Bench 2026 finds dedicated memory systems not yet beating
 *  in-context learning [P, research/12 §2], so a smaller multi-day-continuity effect. (Long-horizon human demos, P12,
 *  act through the long-tasks suite's expert data since model v3 D9, not as a horizon multiplier.) */
export const P07_HORIZON = 1.2;
/** A run's scale vs the reference frontier run F(t), read only for public scrutiny (engineering uses the physical FLOP
 *  since model v3 V3, departments/build.ts engScale; S5 the base's G and drawn data since model v3 E3). Until RD-T11
 *  (SYNTHESIS §6 Phase 6) measures scrutiny against the largest rival run. */
export const scaleOf = (s: GameStateV2, flop: number) => flop / frontierFlop(s.hidden.timeline, decimalYear(s)); // until RD-T11

/** Limits of a base run (blueprint size card). All exact readouts of what the engine will do. */
export interface BaseLimits {
  params: number;
  tpp: number;
  tokens: number;
  /** Wall time at today's training pool and the share the run would get today (days, incl. the setup wait). */
  wallDays: number;
  /** Ideas likely adopted while it trains, which the base will not embody (count and OOM at the recent rate). */
  behind: { ideas: number; oom: number };
  /** Unique tokens this mix can use (the draw's uMix), epochs of the most-repeated slice and the effective-compute
   *  factor of the repetition (≤ 1); the effective-compute factor of the drawn tokens' quality vs the 2025 reference draw
   *  (model v3 D11; > 1 better, < 1 worse); the draw itself and the base's domain specialisation (data mix + curation, OOM). */
  tokensUnique: number;
  epochs: number;
  fData: number;
  fQual: number;
  draw: DataDraw;
  sD: Off;
  /** Serving FLOP per token (2·N_active). */
  servingFlop: number;
  /** Compute-equivalent cost of the run's FLOP at today's TCO ($B; the pool is already paid for). */
  computeCost: number;
  /** Public scrutiny of a run above the frontier. */
  scrutiny: number;
  /** Pretraining effective compute and its parts (OOM); gain over the lab's best base (OOM). */
  gPre: GPreParts;
  gGain: number;
}

export interface RunPlan {
  flopNeeded: number;
  cashCost: number;
  etaDays: number;
  poolShare: number;
  /** Share of the pool the run would actually get today (proportional allocation). */
  effShare: number;
  /** Engineers' work to set the run up (team-weeks) and days until it is built at today's queue and capacity. */
  setupTW: number;
  setupDays: number;
  prediction: RunPrediction;
  /** Predicted general effective compute of the resulting model (for a base: after a standard post-train) and the
   *  RL gains (post, amplification) or distillation gap (OOM). */
  g: { G: number; gD?: Partial<Record<DomainId, number>>; rl?: RlGains; gap?: number };
  limits?: BaseLimits;
  reason?: string;
}

/** Family weights of an RL budget for the player today (broad = every family with an environment suite, model v3 D5). */
export function playerRlWeights(s: GameStateV2, focus: PostDesign['rlFocus']): FamilyMap {
  return suiteRlWeights(s, focus);
}

/** What a base run freezes at launch (RD-B02): the pretraining stack at its FLOP (P24, an idea in that stack since
 *  RD-E01a, included) and the data it draws from the portfolio. */
type BaseFreeze = { pre: number; draw: DataDraw };
const baseFreezeNow = (s: GameStateV2, d: BaseDesign): BaseFreeze => ({ pre: ePreAt(s, flopOfDesign(d)), draw: playerDraw(s, d) });
/** A base's pretraining G for the player: recipe E_START + the frozen pretraining stack, the frozen draw (model v3 D3:
 *  repetition per slice → f_data; the drawn mix → s_d,data, plus the curation's domain offsets). `fz`
 *  defaults to a launch today (plan); completion passes the run's snapshot (RD-B02). */
function baseG(s: GameStateV2, d: BaseDesign, fz: BaseFreeze = baseFreezeNow(s, d)): { parts: GPreParts; flop: number; tokens: number; epochs: number; fD: number; fQ: number; U: number; sD: Off; draw: DataDraw } {
  const be = baseEffect(d);
  const tokens = d.params * d.tpp;
  const flop = flopOfDesign(d);
  const draw = fz.draw;
  // Model v3 D11: the data term is the Besiroglu fraction of D_eff (quality × repetition) vs D, split for the readouts
  // into quality (D_qual = Σ q·D ÷ Q_REF, no repetition) and repetition (the rest, ≤ 1); the two parts sum exactly.
  const fAll = fDataEff(d.params, tokens, draw.dEff);
  const fQ = fDataEff(d.params, tokens, draw.dQual);
  const fD = Math.min(1, fAll / fQ);
  const parts = gPreOf({ flop, tpp: d.tpp, recipe: E_START + fz.pre, shape: d.shape, fData: fD, fQual: fQ, designDg: be.dg });
  return { parts, flop, tokens, epochs: draw.epochs, fD, fQ, U: draw.uMix, sD: addOff(draw.sD, be.sD), draw };
}

/** The RL recipe a post-training run launched today freezes: the RL stack's efficiency and ceiling, and (model v3 D5)
 *  the environment suites' fidelity and exploitability per family. */
export interface RlRecipe { rlMid: number; rlCeil: number; fid?: FamilyMap; exploit?: FamilyMap }
export const rlRecipeNow = (s: GameStateV2): RlRecipe => ({ rlMid: rlMidNow(s), rlCeil: rlCeilNow(s), fid: suiteFidMap(s), exploit: suiteExploitMap(s) });
/** Everything a post-training run freezes at launch (RD-B02): the RL recipe, adopted ideas' domain effects, P07 (its
 *  horizon multiplier here, its persistent memory in the trait hook) and the serving stack's FLOP part. */
export interface PostRecipe extends RlRecipe { domainG: Partial<Record<DomainId, number>>; p07: boolean; serveOom: number }
export const postRecipeNow = (s: GameStateV2): PostRecipe => ({
  ...rlRecipeNow(s), domainG: { ...s.player.research.domainG }, p07: adopted(s, 'P07'), serveOom: serveFlopOomOf(serveNow(s)),
});
/** A run's launch snapshot (TrainingRun.recipe, RD-B02): launchRun and the rev-45 save migration build it. */
export function recipeAtLaunch(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'base' | 'baseId' | 'flopNeeded'>): RunRecipe {
  if (run.kind === 'base') return run.base ? baseFreezeNow(s, run.base) : {};
  if (run.kind === 'continue') {
    const parent = s.player.models.bases.find((b) => b.id === run.baseId);
    return parent ? { pre: ePreAt(s, parent.flop + run.flopNeeded), draw: playerDraw(s, parent.design) } : {};
  }
  if (run.kind === 'post') return postRecipeNow(s);
  return {};
}
/** Fill the fields a run's snapshot lacks with today's values, keeping those it has (and their key order): the start
 *  run R0 at newGame (its RL recipe is its launch day's) and runs in flight in a rev-44 save (migration 44 → 45). */
export function fillRecipe(s: GameStateV2, run: TrainingRun): void {
  const rec = (run.recipe ??= {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(recipeAtLaunch(s, run))) if (rec[k] === undefined) rec[k] = v;
}
/** RL weights of a run on the suites it froze (their families), else on the lab's suites today. */
const recipeWeights = (s: GameStateV2, focus: PostDesign['rlFocus'], rec: RlRecipe) =>
  rec.fid ? rlWeights(focus, RL_FAMILY_IDS.filter((f) => rec.fid![f] !== undefined)) : playerRlWeights(s, focus);
/** Domain effects of adopted ideas (OOM, model v3 V2) added to a build's domain specialisation. */
function withDomainG(domainG: Partial<Record<DomainId, number>>, sD: Off): DomainMap {
  const out: DomainMap = { ...sD };
  for (const [d, v] of Object.entries(domainG) as [DomainId, number][]) out[d] = (out[d] ?? 0) + v;
  return out;
}

/** Post-training build on `base` with design `d` at the frozen recipe `rec` (no penalty, no paradigm offsets). */
function postBuild(s: GameStateV2, base: BaseModel, d: PostDesign, rec: PostRecipe, rlFlop: number): VersionBuild {
  const pe = postEffect(d);
  const rlW = recipeWeights(s, d.rlFocus, rec);
  const fid = rec.fid ?? suiteFidMap(s);
  const rl = rlGains(base.flop, rlFlop, rlW, rec.rlMid, rec.rlCeil, fid);
  const h80Mult = pe.h80Mult * (rec.p07 ? P07_HORIZON : 1);
  // The version's signals are the engine's (model v3 E3): its base's and this run's, from their quantities.
  const sig = addSig(base.signals ?? {}, postSignals(s, d, rec.exploit, { rho: rlFlop / Math.max(1, base.flop) }));
  return {
    gPre: base.gPre, flopPre: base.flop, rlFlop, rlW, eRL: rec.rlMid, aRL: rec.rlCeil, rlFid: { ...fid }, dgRL: rl.general, dgRLd: rl.perDomain, dg: pe.dg, sD: withDomainG(rec.domainG, base.sD ?? {}),
    offL: addOff(base.off ?? {}, pe.offL), off: {}, h80Mult,
    signals: clampSignals(sig),
  };
}

/** The reference post-train a new base would get (standard budget, broad, today's RL recipe): predicts a base's model. */
function referencePostOn(s: GameStateV2, gPre: number, flop: number, sD: Off): VersionBuild {
  const rlW = playerRlWeights(s, 'broad');
  const rec = rlRecipeNow(s);
  const rl = rlGains(flop, RL_BUDGET.standard * flop, rlW, rec.rlMid, rec.rlCeil, rec.fid);
  return {
    gPre, flopPre: flop, rlFlop: RL_BUDGET.standard * flop, rlW, eRL: rec.rlMid, aRL: rec.rlCeil, rlFid: { ...rec.fid }, dgRL: rl.general, dgRLd: rl.perDomain, dg: 0, sD: withDomainG(s.player.research.domainG, sD),
    offL: {}, off: {}, h80Mult: 1, signals: {},
  };
}

/** Distilled build: the teacher's build with the distillation gap δ (never above the teacher). */
function distillBuild(t: ModelVersion, gap: number): VersionBuild {
  const tb = t.build ?? fallbackBuild(t);
  return { ...tb, dg: tb.dg - gap, sD: { ...tb.sD }, offL: { ...tb.offL }, off: { ...tb.off }, dgRLd: { ...tb.dgRLd }, rlW: { ...tb.rlW }, signals: { ...tb.signals } };
}

/** Active parameters of a version: its own (a distilled student's) or its base's. */
export const paramsOfVersion = (s: GameStateV2, v: ModelVersion) => v.params ?? s.player.models.bases.find((x) => x.id === v.baseId)?.params ?? 1e12;

/** RD-B19 (B45): what the lab can forecast of a run's level, on the measured scale. The engine's prediction is the true
 *  outcome (hidden; the traits' AF gate reads it); the lab knows only the step its recipe and FLOP make over a model it
 *  has measured. So the forecast is that reference's measured level plus the step, its band the reference's evaluation
 *  band (±1 SD, measuredSd), the domains shifted the same way, and `gain` = forecast − the reference's measured level
 *  (like with like). Reference: `ref` if measured, else the internal model, else the best measured live version.
 *  Undefined when that reference is unmeasured or the plan has no prediction. Readout only. */
export interface RunForecast { mid: number; band: [number, number]; sd: number; gain: number; refId: string; refName: string; domains: Record<DomainId, [number, number]> }
export function runForecast(s: GameStateV2, pred: Pick<RunPrediction, 'Lg' | 'domains'>, ref?: ModelVersion): RunForecast | undefined {
  const measured = (v: ModelVersion | undefined) => (v && v.evals.measuredL !== undefined ? v : undefined);
  let r = measured(ref) ?? measured(internalVersion(s));
  if (!r) {
    for (const v of s.player.models.versions) {
      if (v.status === 'retired' || v.status === 'rolledBack' || v.evals.measuredL === undefined) continue;
      if (!r || v.evals.measuredL > (r.evals.measuredL ?? -Infinity)) r = v;
    }
  }
  if (!r || r.evals.measuredL === undefined || !(pred.Lg[1] > 0)) return undefined;
  const shift = r.evals.measuredL - r.Lg;
  const mid = (pred.Lg[0] + pred.Lg[1]) / 2 + shift;
  const sd = measuredSd(r);
  const domains = Object.fromEntries(Object.entries(pred.domains).map(([d, b]) => {
    const m = (b[0] + b[1]) / 2 + shift;
    return [d, [m - sd, m + sd]];
  })) as Record<DomainId, [number, number]>;
  return { mid, band: [mid - sd, mid + sd], sd, gain: mid - r.evals.measuredL, refId: r.id, refName: r.name, domains };
}

/** Plan (and validate) a run without launching it: FLOP, wall time, cash, G and the run-card prediction. */
export function planRun(s: GameStateV2, p: LaunchRunParams): RunPlan {
  const w = s.hidden.timeline;
  const m = s.player.models;
  const poolShare = clamp(p.poolShare ?? (p.ida ? 0.3 : RUN_POOL_DEFAULT[p.kind]), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
  const effShare = shareIfLaunched(s, poolShare);
  const rate = Math.max(1, runFlopPerShareDay(s, { kind: p.kind }) * effShare);
  let limits: BaseLimits | undefined;
  let flopNeeded = 0;
  let cash = 0;
  let reason: string | undefined;
  let build: VersionBuild | undefined;
  let rlOut: RlGains | undefined;
  let gap: number | undefined;
  let signals = {};
  let fpt = 0;
  let mon = 0.9;
  let scale = 1;
  const base = p.baseId ? m.bases.find((b) => b.id === p.baseId) : undefined;
  const teacher = versionById(s, p.teacherVersionId);
  if (p.kind === 'base') {
    const d = p.base;
    if (!d) return failPlan('No design');
    reason = optionLocked(s, 'shape', d.shape) ?? optionLocked(s, 'data', d.data) ?? (d.curation.hazard ? optionLocked(s, 'curation', 'hazard') : undefined)
      ?? (d.curation.safetyPretrain ? optionLocked(s, 'curation', 'safetyPretrain') : undefined) ?? (d.tpp > TPP_FREE_MAX + 1e-9 ? optionLocked(s, 'tpp', 'over') : undefined);
    if (!(d.params >= PARAM_RANGE[0] && d.params <= PARAM_RANGE[1])) reason = 'Active parameters out of range';
    if (!(d.tpp >= TPP_RANGE[0] && d.tpp <= TPP_RANGE[1])) reason = 'Tokens per parameter out of range';
    const bg = baseG(s, d);
    const be = baseEffect(d);
    flopNeeded = bg.flop * be.flopMult;
    scale = scaleOf(s, flopNeeded);
    cash = flopCost(s, flopNeeded) * be.cashMult; // F6: no per-run licensed-data cost (D1/D2: licences are data assets on Models › Data)
    build = referencePostOn(s, bg.parts.total, bg.flop, bg.sD);
    signals = baseSignals(d, { gPre: bg.parts.total, draw: bg.draw });
    fpt = fptOfDesign(d.params, d.shape);
    mon = be.monitorability;
    const setupDays = buildWaitNew(s, runSetupTW('base', engScale(flopNeeded)), 'runSetup');
    const wallDays = setupDays + Math.ceil(daysFor(flopNeeded, rate));
    const best = Math.max(-Infinity, ...m.bases.map((b) => b.gPre));
    limits = {
      params: d.params, tpp: d.tpp, tokens: bg.tokens, wallDays, behind: adoptedDuring(s, wallDays), tokensUnique: bg.U, epochs: bg.epochs, fData: bg.fD, fQual: bg.fQ, draw: bg.draw, sD: bg.sD,
      servingFlop: servingFlop(d.params), computeCost: flopCost(s, flopNeeded), scrutiny: sizeScrutiny(scale), gPre: bg.parts,
      gGain: Number.isFinite(best) ? bg.parts.total - best : 0,
    };
  } else if (p.kind === 'post') {
    if (!base) return failPlan('Pick a base');
    const d = p.post;
    if (!d) return failPlan('No design');
    // Model v3 D5: a family with no environment suite cannot be focused (checked first: no environments, no RL).
    if (d.rlFocus !== 'broad') for (const f of d.rlFocus) if (!suiteOf(s, f)) reason ??= `No ${RL_FAMILY_LABEL[f]} environment suite yet`;
    reason ??= optionLocked(s, 'pref', d.pref) ?? (d.cot !== 'latent' ? optionLocked(s, 'cot', d.cot) : undefined)
      ?? (d.inoculation ? optionLocked(s, 'inoculation', true) : undefined);
    if (d.rlFocus !== 'broad') for (const f of d.rlFocus) reason ??= optionLocked(s, 'rlFocus', f);
    if (d.cot === 'latent' && base.design.shape !== 'latent') reason = 'Latent CoT needs a latent base';
    if (base.design.shape === 'latent' && d.cot !== 'latent') reason = 'A latent base forces latent CoT';
    if (d.rlFocus !== 'broad' && d.rlFocus.length > 2) reason = 'Pick at most 2 RL families';
    const pe = postEffect(d);
    if (p.ida) {
      if (!teacher) return failPlan('Pick a version to amplify');
      flopNeeded = IDA_RL_SHARE * base.flop;
      build = idaBuild(s, teacher, flopNeeded, rlRecipeNow(s));
    } else {
      flopNeeded = RL_BUDGET[d.rlBudget] * base.flop;
      build = postBuild(s, base, d, postRecipeNow(s), flopNeeded);
    }
    rlOut = rlGains(build.flopPre, build.rlFlop, build.rlW, build.eRL, build.aRL ?? 0, build.rlFid);
    // Model v3 D5: no per-run grader cash any more; the suites are assets (built and hardened on the build queue).
    fpt = base.fpt * pe.serve * serveTechMult(s);
    mon = Math.min(base.monitorability ?? 1, pe.monitorability);
  } else if (p.kind === 'distill') {
    if (!teacher) return failPlan('Pick a teacher version');
    // D6: an imported open-weight model is not yours to sell until you post-train it (a distilled mini would be).
    if (teacher.variant === 'imported') reason = 'An imported model must be post-trained before it can teach a mini';
    const nT = paramsOfVersion(s, teacher);
    const nS = clamp(p.studentParams ?? nT * STUDENT_DEFAULT, PARAM_RANGE[0], nT);
    const tokens = DISTILL_TPP * nS;
    flopNeeded = distillFlop(nT, nS, tokens);
    gap = distillGap(nT, nS, tokens);
    build = distillBuild(teacher, gap);
    fpt = teacher.fpt * (nS / nT);
    mon = teacher.monitorability;
  } else {
    if (!base) return failPlan('Pick a base');
    flopNeeded = CONTINUE_SHARE * base.flop;
    scale = scaleOf(s, flopNeeded);
    const g = continueGPre(base.gPre, flopNeeded, E_START + ePreAt(s, base.flop + flopNeeded), base.design.shape);
    build = referencePostOn(s, g, base.flop + flopNeeded, base.sD ?? {});
    fpt = base.fpt;
    mon = base.monitorability ?? 1;
  }
  const setupTW = runSetupTW(p.kind, engScale(flopNeeded), p.ida);
  const setupDays = buildWaitNew(s, setupTW, 'runSetup');
  const etaDays = limits ? limits.wallDays : setupDays + Math.ceil(daysFor(flopNeeded, rate));
  if (cash > s.player.finance.cash) reason ??= 'Not enough cash';
  if ((p.kind === 'base' || p.kind === 'post') && frontierPaused(s)) reason ??= 'Frontier runs are paused';
  const gPred = finishBuild(w, build);
  const Lg = levelOfG(w, gPred);
  const doms = domainsOf(w, gPred, build.off);
  // Run-card ▲ arrows are WS2's runSignals from the run's quantities (model v3 E3): what applyRunToTraits will apply.
  const ws2Signals = p.kind === 'base' ? signals
    : runSignals(s, { kind: p.kind, name: p.ida ? 'IDA' : p.kind, flopNeeded, ...(p.baseId ? { baseId: p.baseId } : {}), ...(p.post ? { post: p.post } : {}) } as TrainingRun);
  const prediction: RunPrediction = {
    Lg: [Lg - 0.25, Lg + 0.25],
    domains: Object.fromEntries(Object.entries(doms).map(([k, v]) => [k, [v - 0.25, v + 0.25]])) as RunPrediction['domains'],
    signals: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, S9: 0, ...clampSignals(ws2Signals) },
    etaDays, fpt, monitorability: monitorabilityClass(mon),
  };
  const G = build.gPre + build.dgRL + build.dg;
  const gD = Object.fromEntries(DOMAIN_IDS.map((d) => [d, gOfDomain(build as VersionBuild, d)])) as Partial<Record<DomainId, number>>;
  return { flopNeeded, cashCost: cash, etaDays, poolShare, effShare, setupTW, setupDays, prediction, g: { G, gD, ...(rlOut ? { rl: rlOut } : {}), ...(gap !== undefined ? { gap } : {}) }, reason, ...(limits ? { limits } : {}) };

  function failPlan(why: string): RunPlan {
    const zero = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, S9: 0 };
    return { flopNeeded: 0, cashCost: 0, etaDays: 0, poolShare, effShare, setupTW: 0, setupDays: 0, reason: why, g: { G: 0 }, prediction: { Lg: [0, 0], domains: {} as RunPrediction['domains'], signals: zero, etaDays: 0, fpt: 0, monitorability: 'high' } };
  }
}

/** Amplified build (IDA, P18): the teacher's build with `extra` more RL FLOP at today's RL recipe (the gain comes from
 *  the RL curve; a saturated teacher gains little). */
function idaBuild(s: GameStateV2, t: ModelVersion, extra: number, rec: RlRecipe): VersionBuild {
  const tb = t.build ?? fallbackBuild(t);
  const eRL = Math.max(tb.eRL, rec.rlMid);
  const aRL = Math.max(tb.aRL ?? 0, rec.rlCeil);
  const rlFlop = tb.rlFlop + extra;
  // The extra RL runs on today's suites (model v3 D5): each family's best fidelity of the teacher's and today's.
  const now = rec.fid ?? suiteFidMap(s);
  const rlFid: FamilyMap = { ...tb.rlFid };
  for (const [f, v] of Object.entries(now) as [RLFamily, number][]) rlFid[f] = Math.max(rlFid[f] ?? 1, v);
  const rl = rlGains(tb.flopPre, rlFlop, tb.rlW, eRL, aRL, rlFid);
  return { ...tb, rlFlop, eRL, aRL, rlFid, dgRL: rl.general, dgRLd: rl.perDomain, sD: { ...tb.sD }, offL: { ...tb.offL }, off: {}, rlW: { ...tb.rlW }, signals: { ...tb.signals } };
}

/** Launch a run (commits cash, §3.3.1). Returns the run or a reason string. */
export function launchRun(s: GameStateV2, ctx: SystemCtx, p: LaunchRunParams): TrainingRun | string {
  const plan = planRun(s, p);
  if (plan.reason) return plan.reason;
  const m = s.player.models;
  const n = m.nextName++;
  const kindName = p.ida ? 'IDA' : p.kind;
  const run: TrainingRun = {
    id: `R${n}`, kind: p.kind, name: `${kindName} ${n}`, startDay: s.time.day,
    flopNeeded: plan.flopNeeded, flopDone: 0, poolShare: plan.poolShare, cashCost: plan.cashCost,
    predicted: plan.prediction, status: 'running', signals: { ...plan.prediction.signals },
  };
  if (p.baseId) run.baseId = p.baseId;
  if (p.teacherVersionId) run.teacherVersionId = p.teacherVersionId;
  if (p.base) run.base = { ...p.base, curation: { ...p.base.curation } };
  // Model v3 V2 / RD-B02: everything the result depends on is frozen at launch (a base embodies the pretraining stack at
  // its FLOP, its draw and P24; a continue run the pretraining stack on its added part; a post-train the RL stack and
  // suites, domain effects, P07 and the serving stack). Completion and the trait hook read only this.
  run.recipe = recipeAtLaunch(s, run);
  if (p.post) run.post = { ...p.post, rlFocus: Array.isArray(p.post.rlFocus) ? [...p.post.rlFocus] : 'broad', techniques: [...p.post.techniques], trainAgainst: [...p.post.trainAgainst] };
  if (p.kind === 'base' || p.kind === 'continue') run.scale = scaleOf(s, plan.flopNeeded);
  if (p.kind === 'distill') {
    const t = versionById(s, p.teacherVersionId);
    const nT = t ? paramsOfVersion(s, t) : 1e12;
    run.studentParams = clamp(p.studentParams ?? nT * STUDENT_DEFAULT, PARAM_RANGE[0], nT);
    run.tokens = DISTILL_TPP * run.studentParams;
  }
  if (p.ida) run.name = `IDA ${n}`;
  m.runs.push(run);
  run.setupId = queueBuild(s, 'runSetup', run.id, plan.setupTW);
  if (plan.cashCost > 0) bookCash(s, ctx, -plan.cashCost, 'training', 'training run', run.name);
  const scrutiny = p.kind === 'base' && p.base ? sizeScrutiny(run.scale ?? 1) : 0;
  if (scrutiny >= 0.5) ctx.bump('relations.scrutiny', Math.round(scrutiny * 10) / 10, 'base run above the frontier', run.name); // §3.4.3
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
  return uniqueVersionName(s, `${b?.name ?? PLAYER_MODEL_FAMILY}.${nOn}${suffix}`);
}

function newVersion(s: GameStateV2, run: TrainingRun, base: BaseModel, build: VersionBuild, parent: ModelVersion | undefined, extra: Partial<ModelVersion>): ModelVersion {
  const w = s.hidden.timeline;
  const G = finishBuild(w, build);
  const v: ModelVersion = {
    id: `V${s.player.models.nextName++}`, name: versionName(s, base.id), baseId: base.id, day: s.time.day,
    variant: 'full', design: run.post ? { ...run.post } : { ...(parent?.design ?? { pref: 'constitution', rlFocus: 'broad', rlBudget: 'standard', inoculation: false, cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [] }) },
    G, Lg: levelOfG(w, G), domains: domainsOf(w, G, build.off),
    traitsTrue: { ...(parent?.traitsTrue ?? base.traitsTrue) }, masks: copyMasks(parent), uModes: [...base.uModes],
    monitorability: 0.9, fpt: base.fpt, evals: { bench: {}, safety: {} }, beliefs: blankBeliefs(parent ?? versionById(s, s.player.agents.capRoutine.versionId)),
    status: 'evaluating', flags: {}, build, ...extra,
  };
  if (parent) v.parentVersionId = parent.id;
  return v;
}

/** Complete a run: create the base or version, call the WS2 trait hook, start the eval suite. */
function completeRun(s: GameStateV2, ctx: SystemCtx, run: TrainingRun) {
  const m = s.player.models;
  run.status = 'done';
  // Launch and the rev-45 save migration always set the snapshot; only a hand-built run (a script) lacks one.
  const rec = (run.recipe ??= recipeAtLaunch(s, run));
  if (run.kind === 'base' && run.base) {
    const d = run.base;
    const be = baseEffect(d);
    const nb = m.bases.length + 1;
    const bg = baseG(s, d, { pre: rec.pre!, draw: rec.draw! });
    const b: BaseModel = {
      id: `B${nb}`, name: `${PLAYER_MODEL_FAMILY}-${nb}`, day: s.time.day, startDay: run.startDay, flop: bg.flop, params: d.params, tokens: bg.tokens,
      gPre: bg.parts.total, ePre: bg.parts.recipe, design: d, sD: bg.sD, epochs: bg.epochs,
      fpt: fptOfDesign(d.params, d.shape), monitorability: be.monitorability, signals: clampSignals(baseSignals(d, { gPre: bg.parts.total, draw: bg.draw })),
      lineage: `L-player-${nb}`, traitsTrue: { ...m.bases[0].traitsTrue }, uModes: [], // placeholder: applyBaseToLineage sets them from the draw's synthetic teachers
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
    const flop = parent.flop + run.flopNeeded;
    const gPre = continueGPre(parent.gPre, run.flopNeeded, E_START + rec.pre!, parent.design.shape);
    // Physical part grows by the added FLOP; the recipe efficiency is what remains (a stream re-applies today's).
    const ePre = gPre - (parent.gPre - parent.ePre) - Math.log10(flop / parent.flop);
    const b: BaseModel = {
      ...parent, id: `B${nb}`, name: `${parent.name}c`, day: s.time.day, startDay: run.startDay, flop, tokens: parent.tokens + run.flopNeeded / (6 * parent.params),
      gPre, ePre, parentBaseId: parent.id,
      traitsTrue: { ...parent.traitsTrue }, uModes: [...parent.uModes], sD: { ...(parent.sD ?? {}) }, signals: { ...(parent.signals ?? {}) },
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
    const nT = paramsOfVersion(s, t);
    const nS = run.studentParams ?? nT * STUDENT_DEFAULT;
    const build = distillBuild(t, distillGap(nT, nS, run.tokens ?? DISTILL_TPP * nS));
    const v = newVersion(s, run, base, build, t, { variant: 'mini', params: nS, fpt: t.fpt * (nS / nT), monitorability: t.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1 });
    v.name = uniqueVersionName(s, `${t.name}-mini`);
    m.versions.push(v);
    afterVersion(s, ctx, run, v);
    return;
  }
  // post (incl. IDA): the snapshot is a PostRecipe (recipeAtLaunch, migration 44 → 45)
  const pr = rec as PostRecipe;
  const base = m.bases.find((b) => b.id === run.baseId);
  if (!base || !run.post) return;
  const pe = postEffect(run.post);
  const parent = latestOnBase(s, base.id) ?? versionById(s, run.teacherVersionId);
  if (run.name.startsWith('IDA')) {
    const t = versionById(s, run.teacherVersionId);
    if (!t) return;
    const build = idaBuild(s, t, run.flopNeeded, pr);
    const v = newVersion(s, run, base, build, t, { fpt: t.fpt, monitorability: t.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1, trained: { rlDay: rlDayOf(s, run), post: false } });
    m.versions.push(v);
    afterVersion(s, ctx, run, v, t);
    return;
  }
  const build = postBuild(s, base, run.post, pr, run.flopNeeded);
  build.dg -= consumeRunPenalty(s);
  const v = newVersion(s, run, base, build, parent, {
    fpt: base.fpt * pe.serve * Math.pow(10, -pr.serveOom),
    monitorability: Math.min(base.monitorability ?? 1, pe.monitorability), appeal: pe.appeal, trained: { rlDay: rlDayOf(s, run), post: true },
  });
  m.versions.push(v);
  afterVersion(s, ctx, run, v);
}

/** RD-B17 (readout): the day a post-training or amplify run's RL recipe was taken: its launch (frozen recipe), or today
 *  for a run launched before recipes were frozen. */
const rlDayOf = (s: GameStateV2, run: TrainingRun) => (run.recipe?.rlMid !== undefined ? run.startDay : s.time.day);

/** Build of a version without one (legacy, an import): its G as the pretraining part, no RL detail. */
function fallbackBuild(v: ModelVersion): VersionBuild {
  return { gPre: v.G, flopPre: 1, rlFlop: 0, rlW: {}, eRL: 0, aRL: 0, dgRL: 0, dgRLd: {}, dg: 0, sD: {}, offL: {}, off: { ...(v.build?.off ?? {}) }, h80Mult: 1, signals: {} };
}

/** WS2 trait hooks for a finished post/distill/IDA run (§3.5.4). An IDA cycle (P18) is WS2's applyIdaCycle on the
 *  teacher's traits (ω 0.4, misalignment × 1.1); applyRunToTraits still sets its masks, U-modes and beliefs. */
function afterVersion(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, v: ModelVersion, idaTeacher?: ModelVersion) {
  applyRunToTraits(s, ctx, run, v);
  if (idaTeacher) {
    v.traitsTrue = { ...idaTeacher.traitsTrue };
    applyIdaCycle(s, v, run);
  }
  ctx.log('research', `${v.name} finished training (evaluating).`, 2, v.id);
}

// ───────────────────────────── daily systems ─────────────────────────────


/** runs (40, daily): add FLOP to running runs (× the run operations served, RD-B09); on completion create base/version, call WS2 applyRunToTraits,
 *  queue the eval. (Paradigm projects moved to the research system, models/tree.ts, in R4.) */
export const runsSystem: EngineSystem = {
  id: 'runs', owner: 'WS1', cadence: 'daily', order: 40, system: 'models',
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    // WS4 pauses frontier runs (status 'paused'); they resume when the pause ends.
    if (!frontierPaused(s, ctx.day)) for (const r of s.player.models.runs) if (r.status === 'paused' && (r.kind === 'base' || r.kind === 'post')) r.status = 'running';
    const alloc = poolAllocation(s);
    const ops = runOpsServed(s);
    for (const run of s.player.models.runs) {
      if (run.status !== 'running') continue;
      const waiting = runWaiting(run);
      if (!waiting) run.flopDone += (alloc.get(run.id) ?? 0) * runFlopPerShareDay(s, run) * ops;
      if (!waiting && run.flopDone >= run.flopNeeded) completeRun(s, ctx, run);
    }
    // Model v3 D7: a finished version waits for its release eval suite (work, models/evals.ts), not fixed days.
    releaseEvals(s);
    // Finished runs are kept for 400 days for the UI, then dropped (save budget).
    s.player.models.runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused' || ctx.day - r.startDay < 400);
  },
};

type Track = { pre: number; rlMid: number; rlCeil: number };
/** The recipe a stream would absorb today: the pretraining stack at its base's FLOP and the RL stack. */
function trackNow(s: GameStateV2, v: ModelVersion): Track {
  const base = s.player.models.bases.find((x) => x.id === v.baseId);
  return { pre: E_START + ePreAt(s, base?.flop ?? v.build?.flopPre ?? 3e26), rlMid: rlMidNow(s), rlCeil: rlCeilNow(s) };
}
/** The recipe a version already embodies (its base's pretraining recipe and its own RL recipe). */
function trackOf(s: GameStateV2, v: ModelVersion, b: VersionBuild): Track {
  const base = s.player.models.bases.find((x) => x.id === v.baseId);
  return { pre: base?.ePre ?? E_START, rlMid: b.eRL, rlCeil: b.aRL ?? 0 };
}
/** A stream version's build at the tracked recipe: continual learning keeps applying today's pretraining and RL stacks
 *  to the deployed model in place (the AI 2027 online learner; model v3 V2: the stacks, not the know-how number). The
 *  physical part of its base (FLOP, shape, data) is unchanged. Its RL runs on the lab's suites today (model v3 D5). */
function streamBuild(s: GameStateV2, v: ModelVersion, b: VersionBuild, tr: Track): VersionBuild {
  const base = s.player.models.bases.find((x) => x.id === v.baseId);
  const gPre = base ? base.gPre - base.ePre + tr.pre : b.gPre;
  const rlFid = suiteFidMap(s);
  const rl = rlGains(b.flopPre, b.rlFlop, b.rlW, tr.rlMid, tr.rlCeil, rlFid);
  return { ...b, gPre, eRL: tr.rlMid, aRL: tr.rlCeil, rlFid, dgRL: rl.general, dgRLd: rl.perDomain };
}

/** Stream (P08): the version tracks the stacks with a 7-day lag (first-order; slower when run operations are short). WS2 adds trait drift (1/42 of a
 *  post-train run per day) via its own hook on `stream`. */
function advanceStream(s: GameStateV2) {
  const st = s.player.models.stream;
  if (!st) return;
  const v = versionById(s, st.versionId);
  if (!v || v.status === 'retired' || v.status === 'rolledBack') {
    delete s.player.models.stream;
    return;
  }
  const b = v.build ?? fallbackBuild(v);
  // RD-B09: the stream tracks at the run operations served (its research engineers are part of the ops need).
  const a = (1 - Math.exp(-1 / STREAM_LAG_DAYS)) * runOpsServed(s);
  const cur = st.track ?? trackOf(s, v, b);
  const now = trackNow(s, v);
  st.track = { pre: cur.pre + a * (now.pre - cur.pre), rlMid: cur.rlMid + a * (now.rlMid - cur.rlMid), rlCeil: cur.rlCeil + a * (now.rlCeil - cur.rlCeil) };
  const nb = streamBuild(s, v, b, st.track);
  const G = finishBuild(s.hidden.timeline, nb);
  v.build = nb;
  if (G > v.G) {
    v.G = G;
    refreshLevels(s.hidden.timeline, v);
  }
}

/** The track a stream started on `v` today begins from. The stream continues from the recipe the version already
 *  embodies; moving a running stream onto a version (e.g. on a newer base) carries the RL recipe it already absorbed,
 *  and the pretraining recipe re-applies at the new base [D]. */
function startTrack(s: GameStateV2, v: ModelVersion, b: VersionBuild): Track {
  const old = s.player.models.stream;
  const own = trackOf(s, v, b);
  return old && old.versionId !== v.id && old.track
    ? { pre: Math.max(own.pre, old.track.pre), rlMid: Math.max(own.rlMid, old.track.rlMid), rlCeil: Math.max(own.rlCeil, old.track.rlCeil) }
    : own;
}

/** RD-B19 (B37): recipe (OOM of effective compute, stacks.ts inPlaceRecipe's measure, known to the lab) a version on the
 *  stream has still to absorb: today's stacks (trackNow, what advanceStream closes in on with the STREAM_LAG_DAYS lag)
 *  minus the track it holds (the running stream's, or startStream's start track). At least 0: the stream never lowers
 *  a version. The start and stop previews read it. */
export function streamRecipeGap(s: GameStateV2, versionId: string): number {
  const v = versionById(s, versionId);
  if (!v) return 0;
  const b = v.build ?? fallbackBuild(v);
  const st = s.player.models.stream;
  const tr = st?.versionId === v.id && st.track ? st.track : startTrack(s, v, b);
  const now = trackNow(s, v);
  const F = v.build?.flopPre ?? s.player.models.bases.find((x) => x.id === v.baseId)?.flop ?? FLOP_RL_REF;
  return Math.max(0, gEquivOf(F, now.pre, now.rlMid, now.rlCeil) - gEquivOf(F, tr.pre, tr.rlMid, tr.rlCeil));
}

/** Start a continual-learning stream on a version (needs P08). Returns an error string or undefined. */
export function startStream(s: GameStateV2, versionId: string, day: Day = s.time.day): string | undefined {
  if (!adopted(s, 'P08')) return 'Needs continual learning (P08)';
  const v = versionById(s, versionId);
  if (!v || v.variant !== 'full') return 'Pick a full version';
  const b = v.build ?? fallbackBuild(v);
  const track = startTrack(s, v, b);
  const nb = streamBuild(s, v, b, track);
  const G = finishBuild(s.hidden.timeline, nb);
  v.build = nb;
  if (G > v.G) {
    v.G = G;
    refreshLevels(s.hidden.timeline, v);
  }
  s.player.models.stream = { versionId, startedDay: day, lastAuditDay: day, track };
  return undefined;
}

/** continual (45, daily): stream versions track the stacks. Rival and China labs run one daily policy, WS4's labDaily
 *  (actors/rivals.ts, order 100); the old WS1 default policy is gone (RD-B14: it doubled day-1 staff growth and training). */
export const continualSystem: EngineSystem = {
  id: 'continual', owner: 'WS1', cadence: 'daily', order: 45, system: 'models',
  run(s) {
    advanceStream(s);
  },
};

export type { DomainId, RLFamily };
