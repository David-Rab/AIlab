// Training runs and continual learning (V2-SPEC §3.3.1, §3.1.3–3.1.4; model v3 V1: design/MODEL-V3.md §3–§4). Owner:
// WS1 (continual shared with WS2).
//
// Two acts (RD-T01b, DD-06; see "the two acts" below): pretraining makes a base (new, continued, or a distilled
// student on a teacher's outputs), RL makes a version (on a base, or on a version with the teacher as grader).
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
  CONTINUE_SHARE, FLOP_RL_REF, DISTILL_TPP, E_START, GOODPUT, IDA_RL_SHARE, MFU_RL_FACTOR, P07_LONG_TASKS_HORIZON, PARAM_RANGE, RL_BUDGET, RL_FAMILY_IDS,
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
import { domainsOf, gOfBuild, gOfDomain, levelOfG, refreshLevels } from './capability';
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
  /** RL with the teacher (teacherVersionId) as grader: the iterated distillation & amplification cycle (P18), one more
   *  RL budget (IDA_RL_SHARE × the base's FLOP) on the teacher at today's RL recipe (RD-T01a: TrainingRun.grader). */
  grader?: 'teacher';
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
  return trainingFlopPerDay(s) * goodputOf(s) * (runAct(r.kind) === 'rl' ? MFU_RL_FACTOR : 1);
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
  if (runAct(run.kind) === 'rl') return postRecipeNow(s);
  return {}; // a student learns from its teacher's outputs: nothing to freeze
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

/** The reference post-train a new base would get (standard budget, broad, today's RL recipe): predicts a base's model. */
function referencePostOn(s: GameStateV2, gPre: number, flop: number, sD: Off): VersionBuild {
  const rlW = playerRlWeights(s, 'broad');
  const rec = rlRecipeNow(s);
  const rl = rlGains(flop, RL_BUDGET.standard * flop, rlW, rec.rlMid, rec.rlCeil, rec.fid);
  return {
    gPre, flopPre: flop, rlFlop: RL_BUDGET.standard * flop, rlW, eRL: rec.rlMid, aRL: rec.rlCeil, rlFid: { ...rec.fid }, dgRL: rl.general, dgRLd: rl.perDomain, dg: 0, sD: withDomainG(s.player.research.domainG, sD),
    dgD: {}, h80Mult: 1, signals: {},
  };
}

/** Distilled build: the teacher's build with the distillation gap δ (never above the teacher). */
function distillBuild(t: ModelVersion, gap: number): VersionBuild {
  const tb = t.build ?? fallbackBuild(t);
  return { ...tb, dg: tb.dg - gap, sD: { ...tb.sD }, dgD: { ...tb.dgD }, dgRLd: { ...tb.dgRLd }, rlW: { ...tb.rlW }, signals: { ...tb.signals } };
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

// ─────────────────── the two acts (RD-T01b, DD-06, TRN-06) ───────────────────
// Every run is one of two acts. PRETRAINING makes a base from tokens: a new base on the portfolio (kind 'base', its
// design), more tokens on an existing base (kind 'continue', added FLOP) or a small student on a teacher's outputs (kind
// 'distill', student size). RL makes a version from a base or a version: RL budget, focus and suites, optionally with
// the teacher as grader (kind 'post'; grader 'teacher' = the IDA cycle, P18, RL on the teacher's build). The run kinds
// stay the save format; the engine reads them as act + source through the helpers below.

/** The act a run kind belongs to. */
export type RunAct = 'pretrain' | 'rl';
export const runAct = (kind: RunKind): RunAct => (kind === 'post' ? 'rl' : 'pretrain');

/** Where a pretraining run's tokens come from: a design on the portfolio, `addFlop` more on a parent base, or a
 *  teacher's outputs (`tokens` of them) for a student of `nS` active parameters (the teacher has `nT`). */
type PretrainSource =
  | { from: 'design'; design: BaseDesign }
  | { from: 'continue'; parent: BaseModel; addFlop: number }
  | { from: 'teacher'; teacher: ModelVersion; nT: number; nS: number; tokens: number };

/** The source of a run being planned (a failure reason when it lacks one). */
function pretrainSourceOfParams(s: GameStateV2, p: LaunchRunParams): PretrainSource | string {
  if (p.kind === 'base') return p.base ? { from: 'design', design: p.base } : 'No design';
  if (p.kind === 'continue') {
    const parent = p.baseId ? s.player.models.bases.find((b) => b.id === p.baseId) : undefined;
    return parent ? { from: 'continue', parent, addFlop: CONTINUE_SHARE * parent.flop } : 'Pick a base';
  }
  const teacher = versionById(s, p.teacherVersionId);
  if (!teacher) return 'Pick a teacher version';
  const nT = paramsOfVersion(s, teacher);
  const nS = clamp(p.studentParams ?? nT * STUDENT_DEFAULT, PARAM_RANGE[0], nT);
  return { from: 'teacher', teacher, nT, nS, tokens: DISTILL_TPP * nS };
}
/** The source of a launched run (its frozen FLOP, student size and tokens), undefined when its parent is gone. */
function pretrainSourceOfRun(s: GameStateV2, run: TrainingRun): PretrainSource | undefined {
  if (run.kind === 'base') return run.base ? { from: 'design', design: run.base } : undefined;
  if (run.kind === 'continue') {
    const parent = s.player.models.bases.find((b) => b.id === run.baseId);
    return parent ? { from: 'continue', parent, addFlop: run.flopNeeded } : undefined;
  }
  const teacher = versionById(s, run.teacherVersionId);
  if (!teacher) return undefined;
  const nT = paramsOfVersion(s, teacher);
  const nS = run.studentParams ?? nT * STUDENT_DEFAULT;
  return { from: 'teacher', teacher, nT, nS, tokens: run.tokens ?? DISTILL_TPP * nS };
}

/** What pretraining makes: the FLOP it needs, cash and scale, and the base's quantities. A student (teacher source)
 *  is the teacher's build minus the distillation gap (`student`), sold as a mini version of the teacher's base. */
interface Pretrained {
  flopNeeded: number;
  cash: number;
  /** Scale vs the frontier run (public scrutiny); new and continued bases only. */
  scale?: number;
  flop: number;
  params: number;
  tokens: number;
  gPre: number;
  ePre: number;
  sD: Off;
  fpt: number;
  monitorability: number;
  /** New base: its design's signals and pretraining parts (readouts). */
  signals?: ReturnType<typeof baseSignals>;
  bg?: ReturnType<typeof baseG>;
  /** Student: the distillation gap (OOM) and its build. */
  gap?: number;
  student?: VersionBuild;
}
/** The pretraining act: one path for every source. `rec` is the run's launch snapshot (completion); a plan reads today. */
function pretrain(s: GameStateV2, src: PretrainSource, rec?: RunRecipe): Pretrained {
  if (src.from === 'design') {
    const d = src.design;
    const be = baseEffect(d);
    const bg = baseG(s, d, rec ? { pre: rec.pre!, draw: rec.draw! } : baseFreezeNow(s, d));
    const flopNeeded = bg.flop * be.flopMult;
    return {
      flopNeeded, cash: flopCost(s, flopNeeded) * be.cashMult, scale: scaleOf(s, flopNeeded), // F6: no per-run licensed-data cost (D1/D2)
      flop: bg.flop, params: d.params, tokens: bg.tokens, gPre: bg.parts.total, ePre: bg.parts.recipe, sD: bg.sD,
      fpt: fptOfDesign(d.params, d.shape), monitorability: be.monitorability, signals: baseSignals(d, { gPre: bg.parts.total, draw: bg.draw }), bg,
    };
  }
  if (src.from === 'continue') {
    // Effective compute adds (continueGPre): only the added part embodies the pretraining stack at the new size.
    const b = src.parent;
    const flop = b.flop + src.addFlop;
    const gPre = continueGPre(b.gPre, src.addFlop, E_START + (rec ? rec.pre! : ePreAt(s, flop)), b.design.shape);
    // Physical part grows by the added FLOP; the recipe efficiency is what remains (a stream re-applies today's).
    const ePre = gPre - (b.gPre - b.ePre) - Math.log10(flop / b.flop);
    return {
      flopNeeded: src.addFlop, cash: 0, scale: scaleOf(s, src.addFlop), flop, params: b.params, tokens: b.tokens + src.addFlop / (6 * b.params),
      gPre, ePre, sD: b.sD ?? {}, fpt: b.fpt, monitorability: b.monitorability ?? 1,
    };
  }
  const { teacher: t, nT, nS, tokens } = src;
  const gap = distillGap(nT, nS, tokens);
  const student = distillBuild(t, gap);
  const flop = distillFlop(nT, nS, tokens);
  return {
    flopNeeded: flop, cash: 0, flop, params: nS, tokens, gPre: student.gPre, ePre: 0, sD: student.sD,
    fpt: t.fpt * (nS / nT), monitorability: t.monitorability, gap, student,
  };
}

/** What RL starts from: a base (fresh RL: the post-training design's effects, domain effects and the run penalty
 *  apply) or a version (more RL on its build: its mix, design effects and signals kept). A version is the start when
 *  the teacher grades (IDA): RL on the teacher itself. */
type RlStart = { on: 'base'; base: BaseModel } | { on: 'version'; base: BaseModel; version: ModelVersion };
const rlStartOf = (base: BaseModel, grader: TrainingRun['grader'], teacher: ModelVersion | undefined): RlStart | undefined =>
  grader === 'teacher' ? (teacher ? { on: 'version', base, version: teacher } : undefined) : { on: 'base', base };
/** RL FLOP of a run: a share of its base's pretraining FLOP (the design's budget; IDA_RL_SHARE with the teacher grading). */
const rlFlopOf = (base: BaseModel, d: PostDesign, grader: TrainingRun['grader']) => (grader === 'teacher' ? IDA_RL_SHARE : RL_BUDGET[d.rlBudget]) * base.flop;

/** The RL act: `extra` RL FLOP on the start at the frozen recipe `rec` (no penalty here). The gain comes from the RL
 *  curve on the start's base FLOP; RL on a version adds to its RL FLOP and keeps the better of its recipe and today's
 *  (each family's fidelity the best of its suite then and the run's; a saturated version gains little). */
function rlBuild(s: GameStateV2, start: RlStart, d: PostDesign, rec: PostRecipe, extra: number): VersionBuild {
  const now = rec.fid ?? suiteFidMap(s);
  if (start.on === 'version') {
    const tb = start.version.build ?? fallbackBuild(start.version);
    const eRL = Math.max(tb.eRL, rec.rlMid);
    const aRL = Math.max(tb.aRL ?? 0, rec.rlCeil);
    const rlFlop = tb.rlFlop + extra;
    const rlFid: FamilyMap = { ...tb.rlFid };
    for (const [f, v] of Object.entries(now) as [RLFamily, number][]) rlFid[f] = Math.max(rlFid[f] ?? 1, v);
    const rl = rlGains(tb.flopPre, rlFlop, tb.rlW, eRL, aRL, rlFid);
    return { ...tb, rlFlop, eRL, aRL, rlFid, dgRL: rl.general, dgRLd: rl.perDomain, sD: { ...tb.sD }, dgD: { ...tb.dgD }, rlW: { ...tb.rlW }, signals: { ...tb.signals } };
  }
  const base = start.base;
  // RD-E01b: P07 (frozen at launch) multiplies the long-tasks RL family's horizon (data/v2/runDesign.ts). Long-horizon
  // human demos (P12) act through the long-tasks suite's expert data since model v3 D9, not as a horizon multiplier.
  const pe = postEffect(d, rec.p07 ? P07_LONG_TASKS_HORIZON : 1);
  const rlW = recipeWeights(s, d.rlFocus, rec);
  const rl = rlGains(base.flop, extra, rlW, rec.rlMid, rec.rlCeil, now);
  // The version's signals are the engine's (model v3 E3): its base's and this run's, from their quantities.
  const sig = addSig(base.signals ?? {}, postSignals(s, d, rec.exploit, { rho: extra / Math.max(1, base.flop) }));
  return {
    gPre: base.gPre, flopPre: base.flop, rlFlop: extra, rlW, eRL: rec.rlMid, aRL: rec.rlCeil, rlFid: { ...now }, dgRL: rl.general, dgRLd: rl.perDomain, dg: pe.dg, sD: withDomainG(rec.domainG, base.sD ?? {}),
    dgD: { ...pe.dgD }, h80Mult: pe.h80Mult,
    signals: clampSignals(sig),
  };
}

/** One act's plan: what planRun adds the shared costs, timing and prediction to. */
interface ActPlan { flopNeeded: number; cash: number; build: VersionBuild; fpt: number; mon: number; reason?: string; signals?: ReturnType<typeof baseSignals>; limits?: BaseLimits; rl?: RlGains; gap?: number }

function planPretrain(s: GameStateV2, p: LaunchRunParams, rate: number): ActPlan | string {
  const src = pretrainSourceOfParams(s, p);
  if (typeof src === 'string') return src;
  let reason: string | undefined;
  if (src.from === 'design') {
    const d = src.design;
    reason = optionLocked(s, 'shape', d.shape) ?? optionLocked(s, 'data', d.data) ?? (d.curation.hazard ? optionLocked(s, 'curation', 'hazard') : undefined)
      ?? (d.curation.safetyPretrain ? optionLocked(s, 'curation', 'safetyPretrain') : undefined) ?? (d.tpp > TPP_FREE_MAX + 1e-9 ? optionLocked(s, 'tpp', 'over') : undefined);
    if (!(d.params >= PARAM_RANGE[0] && d.params <= PARAM_RANGE[1])) reason = 'Active parameters out of range';
    if (!(d.tpp >= TPP_RANGE[0] && d.tpp <= TPP_RANGE[1])) reason = 'Tokens per parameter out of range';
  }
  // D6: an imported open-weight model is not yours to sell until you post-train it (a distilled mini would be).
  if (src.from === 'teacher' && src.teacher.variant === 'imported') reason = 'An imported model must be post-trained before it can teach a mini';
  const pre = pretrain(s, src);
  let limits: BaseLimits | undefined;
  if (pre.bg && src.from === 'design') {
    const bg = pre.bg;
    const setupDays = buildWaitNew(s, runSetupTW('base', engScale(pre.flopNeeded)), 'runSetup');
    const wallDays = setupDays + Math.ceil(daysFor(pre.flopNeeded, rate));
    const best = Math.max(-Infinity, ...s.player.models.bases.map((b) => b.gPre));
    limits = {
      params: pre.params, tpp: src.design.tpp, tokens: bg.tokens, wallDays, behind: adoptedDuring(s, wallDays), tokensUnique: bg.U, epochs: bg.epochs, fData: bg.fD, fQual: bg.fQ, draw: bg.draw, sD: bg.sD,
      servingFlop: servingFlop(pre.params), computeCost: flopCost(s, pre.flopNeeded), scrutiny: sizeScrutiny(pre.scale ?? 1), gPre: bg.parts,
      gGain: Number.isFinite(best) ? bg.parts.total - best : 0,
    };
  }
  // A base is predicted through the reference post-train it would get; a student is its own build.
  const build = pre.student ?? referencePostOn(s, pre.gPre, pre.flop, pre.sD);
  return {
    flopNeeded: pre.flopNeeded, cash: pre.cash, build, fpt: pre.fpt, mon: pre.monitorability, reason,
    ...(pre.signals ? { signals: pre.signals } : {}), ...(limits ? { limits } : {}), ...(pre.gap !== undefined ? { gap: pre.gap } : {}),
  };
}

function planRl(s: GameStateV2, p: LaunchRunParams): ActPlan | string {
  const base = p.baseId ? s.player.models.bases.find((b) => b.id === p.baseId) : undefined;
  if (!base) return 'Pick a base';
  const d = p.post;
  if (!d) return 'No design';
  const start = rlStartOf(base, p.grader, versionById(s, p.teacherVersionId));
  if (!start) return 'Pick a version to amplify';
  // Model v3 D5: a family with no environment suite cannot be focused (checked first: no environments, no RL).
  let reason: string | undefined;
  if (d.rlFocus !== 'broad') for (const f of d.rlFocus) if (!suiteOf(s, f)) reason ??= `No ${RL_FAMILY_LABEL[f]} environment suite yet`;
  reason ??= optionLocked(s, 'pref', d.pref) ?? (d.cot !== 'latent' ? optionLocked(s, 'cot', d.cot) : undefined)
    ?? (d.inoculation ? optionLocked(s, 'inoculation', true) : undefined);
  if (d.rlFocus !== 'broad') for (const f of d.rlFocus) reason ??= optionLocked(s, 'rlFocus', f);
  if (d.cot === 'latent' && base.design.shape !== 'latent') reason = 'Latent CoT needs a latent base';
  if (base.design.shape === 'latent' && d.cot !== 'latent') reason = 'A latent base forces latent CoT';
  if (d.rlFocus !== 'broad' && d.rlFocus.length > 2) reason = 'Pick at most 2 RL families';
  const flopNeeded = rlFlopOf(base, d, p.grader);
  const build = rlBuild(s, start, d, postRecipeNow(s), flopNeeded);
  const rl = rlGains(build.flopPre, build.rlFlop, build.rlW, build.eRL, build.aRL ?? 0, build.rlFid);
  // Model v3 D5: no per-run grader cash any more; the suites are assets (built and hardened on the build queue).
  // [Q] The preview's serve cost and monitorability are the fresh-RL ones also for RL on a version (completion keeps
  // the version's): kept from before RD-T01b.
  const pe = postEffect(d);
  return { flopNeeded, cash: 0, build, fpt: base.fpt * pe.serve * serveTechMult(s), mon: Math.min(base.monitorability ?? 1, pe.monitorability), reason, rl };
}

/** Plan (and validate) a run without launching it: FLOP, wall time, cash, G and the run-card prediction. */
export function planRun(s: GameStateV2, p: LaunchRunParams): RunPlan {
  const w = s.hidden.timeline;
  const poolShare = clamp(p.poolShare ?? (p.grader === 'teacher' ? 0.3 : RUN_POOL_DEFAULT[p.kind]), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
  const effShare = shareIfLaunched(s, poolShare);
  const rate = Math.max(1, runFlopPerShareDay(s, { kind: p.kind }) * effShare);
  const a = runAct(p.kind) === 'pretrain' ? planPretrain(s, p, rate) : planRl(s, p);
  if (typeof a === 'string') return failPlan(a);
  const { flopNeeded, cash, build, limits } = a;
  let reason = a.reason;
  const setupTW = runSetupTW(p.kind, engScale(flopNeeded), p.grader === 'teacher');
  const setupDays = buildWaitNew(s, setupTW, 'runSetup');
  const etaDays = limits ? limits.wallDays : setupDays + Math.ceil(daysFor(flopNeeded, rate));
  if (cash > s.player.finance.cash) reason ??= 'Not enough cash';
  if ((p.kind === 'base' || p.kind === 'post') && frontierPaused(s)) reason ??= 'Frontier runs are paused';
  const gPred = gOfBuild(build);
  const Lg = levelOfG(w, gPred);
  const doms = domainsOf(w, gPred, build);
  // Run-card ▲ arrows are WS2's runSignals from the run's quantities (model v3 E3): what applyRunToTraits will apply.
  const ws2Signals = a.signals
    ?? runSignals(s, { kind: p.kind, name: p.kind, ...(p.grader ? { grader: p.grader } : {}), flopNeeded, ...(p.baseId ? { baseId: p.baseId } : {}), ...(p.post ? { post: p.post } : {}) } as TrainingRun);
  const prediction: RunPrediction = {
    Lg: [Lg - 0.25, Lg + 0.25], // level-lint-ok: run-card prediction band (readout)
    domains: Object.fromEntries(Object.entries(doms).map(([k, v]) => [k, [v - 0.25, v + 0.25]])) as RunPrediction['domains'],
    signals: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, S9: 0, ...clampSignals(ws2Signals) },
    etaDays, fpt: a.fpt, monitorability: monitorabilityClass(a.mon),
  };
  const G = build.gPre + build.dgRL + build.dg;
  const gD = Object.fromEntries(DOMAIN_IDS.map((d) => [d, gOfDomain(build as VersionBuild, d)])) as Partial<Record<DomainId, number>>;
  return { flopNeeded, cashCost: cash, etaDays, poolShare, effShare, setupTW, setupDays, prediction, g: { G, gD, ...(a.rl ? { rl: a.rl } : {}), ...(a.gap !== undefined ? { gap: a.gap } : {}) }, reason, ...(limits ? { limits } : {}) };

  function failPlan(why: string): RunPlan {
    const zero = { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, S9: 0 };
    return { flopNeeded: 0, cashCost: 0, etaDays: 0, poolShare, effShare, setupTW: 0, setupDays: 0, reason: why, g: { G: 0 }, prediction: { Lg: [0, 0], domains: {} as RunPrediction['domains'], signals: zero, etaDays: 0, fpt: 0, monitorability: 'high' } };
  }
}

/** Launch a run (commits cash, §3.3.1). Returns the run or a reason string. */
export function launchRun(s: GameStateV2, ctx: SystemCtx, p: LaunchRunParams): TrainingRun | string {
  const plan = planRun(s, p);
  if (plan.reason) return plan.reason;
  const m = s.player.models;
  const n = m.nextName++;
  const kindName = p.grader === 'teacher' ? 'IDA' : p.kind;
  const run: TrainingRun = {
    id: `R${n}`, kind: p.kind, name: `${kindName} ${n}`, startDay: s.time.day,
    flopNeeded: plan.flopNeeded, flopDone: 0, poolShare: plan.poolShare, cashCost: plan.cashCost,
    predicted: plan.prediction, status: 'running', signals: { ...plan.prediction.signals },
  };
  if (p.baseId) run.baseId = p.baseId;
  if (p.teacherVersionId) run.teacherVersionId = p.teacherVersionId;
  if (p.grader) run.grader = p.grader;
  if (p.base) run.base = { ...p.base, curation: { ...p.base.curation } };
  // Model v3 V2 / RD-B02: everything the result depends on is frozen at launch (a base embodies the pretraining stack at
  // its FLOP, its draw and P24; a continue run the pretraining stack on its added part; a post-train the RL stack and
  // suites, domain effects, P07 and the serving stack). Completion and the trait hook read only this.
  run.recipe = recipeAtLaunch(s, run);
  if (p.post) run.post = { ...p.post, rlFocus: Array.isArray(p.post.rlFocus) ? [...p.post.rlFocus] : 'broad', techniques: [...p.post.techniques], trainAgainst: [...p.post.trainAgainst] };
  if (p.kind === 'base' || p.kind === 'continue') run.scale = scaleOf(s, plan.flopNeeded);
  if (p.kind === 'distill') {
    // The student's size and tokens (teacher outputs) are fixed at launch, as the plan read them.
    const src = pretrainSourceOfParams(s, p);
    if (typeof src !== 'string' && src.from === 'teacher') {
      run.studentParams = src.nS;
      run.tokens = src.tokens;
    }
  }
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
  const G = gOfBuild(build);
  const v: ModelVersion = {
    id: `V${s.player.models.nextName++}`, name: versionName(s, base.id), baseId: base.id, day: s.time.day,
    variant: 'full', design: run.post ? { ...run.post } : { ...(parent?.design ?? { pref: 'constitution', rlFocus: 'broad', rlBudget: 'standard', inoculation: false, cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [] }) },
    G, Lg: levelOfG(w, G), domains: domainsOf(w, G, build),
    traitsTrue: { ...(parent?.traitsTrue ?? base.traitsTrue) }, masks: copyMasks(parent), uModes: [...base.uModes],
    monitorability: 0.9, fpt: base.fpt, evals: { bench: {}, safety: {} }, beliefs: blankBeliefs(parent ?? versionById(s, s.player.agents.capRoutine.versionId)),
    status: 'evaluating', flags: {}, build, ...extra,
  };
  if (parent) v.parentVersionId = parent.id;
  return v;
}

/** Complete a run: its act makes the base or version, calls the WS2 trait hook and starts the eval suite. */
function completeRun(s: GameStateV2, ctx: SystemCtx, run: TrainingRun) {
  run.status = 'done';
  // Launch and the rev-45 save migration always set the snapshot; only a hand-built run (a script) lacks one.
  const rec = (run.recipe ??= recipeAtLaunch(s, run));
  if (runAct(run.kind) === 'pretrain') completePretrain(s, ctx, run, rec);
  else completeRl(s, ctx, run, rec as PostRecipe); // the snapshot is a PostRecipe (recipeAtLaunch, migration 44 → 45)
}

/** Pretraining finished: a new base (new lineage, or the parent's lineage continued), or the student as a mini
 *  version of its teacher's base (it keeps no BaseModel of its own: the student build is the teacher's minus the gap). */
function completePretrain(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, rec: RunRecipe) {
  const m = s.player.models;
  const src = pretrainSourceOfRun(s, run);
  if (!src) return;
  const pre = pretrain(s, src, rec);
  if (src.from === 'teacher') {
    const t = src.teacher;
    const base = m.bases.find((b) => b.id === t.baseId) ?? m.bases[0];
    const v = newVersion(s, run, base, pre.student!, t, { variant: 'mini', params: pre.params, fpt: pre.fpt, monitorability: pre.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1 });
    v.name = uniqueVersionName(s, `${t.name}-mini`);
    m.versions.push(v);
    afterVersion(s, ctx, run, v);
    return;
  }
  const nb = m.bases.length + 1;
  let b: BaseModel;
  if (src.from === 'design') {
    const d = src.design;
    b = {
      id: `B${nb}`, name: `${PLAYER_MODEL_FAMILY}-${nb}`, day: s.time.day, startDay: run.startDay, flop: pre.flop, params: pre.params, tokens: pre.tokens,
      gPre: pre.gPre, ePre: pre.ePre, design: d, sD: pre.sD, epochs: pre.bg!.epochs,
      fpt: pre.fpt, monitorability: pre.monitorability, signals: clampSignals(pre.signals!),
      lineage: `L-player-${nb}`, traitsTrue: { ...m.bases[0].traitsTrue }, uModes: [], // placeholder: applyBaseToLineage sets them from the draw's synthetic teachers
    };
  } else {
    const parent = src.parent;
    b = {
      ...parent, id: `B${nb}`, name: `${parent.name}c`, day: s.time.day, startDay: run.startDay, flop: pre.flop, tokens: pre.tokens,
      gPre: pre.gPre, ePre: pre.ePre, parentBaseId: parent.id,
      traitsTrue: { ...parent.traitsTrue }, uModes: [...parent.uModes], sD: { ...pre.sD }, signals: { ...(parent.signals ?? {}) },
    };
  }
  m.bases.push(b);
  applyBaseToLineage(s, ctx, run, b); // WS2 hook: new lineage traits and U-modes (§3.4.4, §3.5.5); continued: step the lineage (ω 0.5)
  if (src.from === 'design') ctx.log('research', `Base model ${b.name} finished pretraining.`, 2, b.id);
  else ctx.log('research', `Continued pretraining: ${b.name}.`, 1, b.id);
}

/** RL finished: a new version on its base. Fresh RL on a base pays any pending run penalty and takes the design's
 *  serve cost; RL on a version (the teacher grading) inherits that version's serving, design and traits. */
function completeRl(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, pr: PostRecipe) {
  const m = s.player.models;
  const base = m.bases.find((b) => b.id === run.baseId);
  if (!base || !run.post) return;
  const teacher = versionById(s, run.teacherVersionId);
  const start = rlStartOf(base, run.grader, teacher);
  if (!start) return;
  const build = rlBuild(s, start, run.post, pr, run.flopNeeded);
  const rlDay = rlDayOf(s, run);
  if (start.on === 'version') {
    const t = start.version;
    const v = newVersion(s, run, base, build, t, { fpt: t.fpt, monitorability: t.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1, trained: { rlDay, post: false } });
    m.versions.push(v);
    afterVersion(s, ctx, run, v, t);
    return;
  }
  const pe = postEffect(run.post);
  build.dg -= consumeRunPenalty(s);
  const v = newVersion(s, run, base, build, latestOnBase(s, base.id) ?? teacher, {
    fpt: base.fpt * pe.serve * Math.pow(10, -pr.serveOom),
    monitorability: Math.min(base.monitorability ?? 1, pe.monitorability), appeal: pe.appeal, trained: { rlDay, post: true },
  });
  m.versions.push(v);
  afterVersion(s, ctx, run, v);
}

/** RD-B17 (readout): the day a post-training or amplify run's RL recipe was taken: its launch (frozen recipe), or today
 *  for a run launched before recipes were frozen. */
const rlDayOf = (s: GameStateV2, run: TrainingRun) => (run.recipe?.rlMid !== undefined ? run.startDay : s.time.day);

/** Build of a version without one (legacy, an import): its G as the pretraining part, no RL detail. */
function fallbackBuild(v: ModelVersion): VersionBuild {
  return { gPre: v.G, flopPre: 1, rlFlop: 0, rlW: {}, eRL: 0, aRL: 0, dgRL: 0, dgRLd: {}, dg: 0, sD: {}, dgD: {}, h80Mult: 1, signals: {} };
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
  const G = gOfBuild(nb);
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
  const G = gOfBuild(nb);
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
