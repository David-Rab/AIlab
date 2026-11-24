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
  CONTINUE_SHARE, DISTILL_TPP, E_START, GOODPUT, IDA_RL_SHARE, MFU_RL_FACTOR, P07_LONG_TASKS_HORIZON, PARAM_RANGE, RL_BUDGET, RL_FAMILY_IDS,
  STREAM_PERIOD_DAYS, STREAM_POOL_SHARE, STUDENT_DEFAULT, TPP_RANGE, sizeScrutiny, SCRUTINY_WINDOW_DAYS,
} from '../../../data/v2/runDesign';
import { buildEtas, buildWaitNew, engScale, queueBuild, runSetupTW, runWaiting } from '../departments/build';
import { TRAIT_IDS } from '../../../data/v2/traits';
import { clamp } from '../../rng';
import { decimalYear } from '../core/time';
import { playerDraw, type DataDraw } from '../production/data';
import { tcoPerH100eYear } from '../production/production';
import { consumeRunPenalty, pendingRunPenalty } from '../safety/responses';
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
import { policyDepth, releaseEvals } from './evals';
import { EVAL_DEPTHS } from '../../../data/v2/evals';
import { ELICITATION } from '../../../data/v2/benchmarks';
import { trainingHeld } from '../safety/framework';
import { addSig, baseEffect, clampSignals, monitorabilityClass, postEffect, type Off } from './design';
import { domainsOf, gOfBuild, gOfDomain, gOfLevel, levelOfG, refreshLevels } from './capability';
import { distillLift } from '../production/diffusion';
import { ePreAt, playerRecipeG, rlCeilNow, rlMidNow, serveFlopOomOf, serveNow, trainNow } from './stacks';
import { stackRate } from './research';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import {
  continueFData, continueGPre, daysFor, distillFlop, distillGap, fDataEff, flopOfDesign, gPreOf, longTasksHorizonMult, rlGains, rlWeights, fptOfDesign,
  servingFlop, type FamilyMap, type GPreParts, type RlGains,
} from './effective';
import { internalVersion, otherLabs, uniqueVersionName, versionById } from './labs';
import { baseFlopPerDay } from '../actors/rivalModel';
import { measuredSd } from './benchmarks';
import { bookCash } from '../finance/ledger';
import { poolsOf } from '../compute/power';

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


/** Frontier (base/post) runs are paused while the Safety framework holds frontier training (SR-19, safety/framework.ts;
 *  refreshed daily before runs). RF-S2: the pause pledge's dated pause is gone (it is the framework's misalignment rule). */
export const frontierPaused = (s: GameStateV2) => trainingHeld(s);

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

/** UB-5c (DECISIONS "Lend idle training compute"): H100e of idle training compute lent to research experiments
 *  while the policy is on (off by default). Read fresh from the runs that train now, so it returns the moment a run
 *  trains; the training pool itself is never reduced, so a run always draws its full share. */
export function lentTrainingH100e(s: GameStateV2): number {
  return s.player.policies.lendTraining ? idleTrainingShare(s) * poolsOf(s).training : 0;
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

/** RD-T11: the largest non-player training run in progress (at its planned FLOP) or finished in the last
 *  SCRUTINY_WINDOW_DAYS (active labs, China included). None in the window: the largest current base of any lab. */
export function rivalRunFlop(s: GameStateV2): number {
  const day = s.time.day;
  let best = 0;
  let any = 0;
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active') continue;
    const ph = r.phys;
    any = Math.max(any, ph.base.flop);
    if (day - ph.base.day <= SCRUTINY_WINDOW_DAYS) best = Math.max(best, ph.base.flop);
    if (ph.run) best = Math.max(best, ph.run.flop + baseFlopPerDay(r) * Math.max(0, r.nextBaseDay - day));
  }
  return best > 0 ? best : any;
}
/** Public scrutiny of a base run of `flop` (RD-T11): its FLOP over the largest rival run. */
export const runScrutiny = (s: GameStateV2, flop: number) => {
  const ref = rivalRunFlop(s);
  return ref > 0 ? sizeScrutiny(flop / ref) : 0;
};

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
export type BaseFreeze = { pre: number; draw: DataDraw };
const baseFreezeNow = (s: GameStateV2, d: BaseDesign): BaseFreeze => ({ pre: ePreAt(s, flopOfDesign(d)), draw: playerDraw(s, d) });
/** A base's pretraining G for the player: recipe E_START + the frozen pretraining stack, the frozen draw (model v3 D3:
 *  repetition per slice → f_data; the drawn mix → s_d,data, plus the curation's domain offsets). `fz`
 *  defaults to a launch today (plan); completion passes the run's snapshot (RD-B02). */
function baseG(s: GameStateV2, d: BaseDesign, fz: BaseFreeze = baseFreezeNow(s, d)): BaseGOut {
  return baseGOf(d, fz);
}
export type BaseGOut = { parts: GPreParts; flop: number; tokens: number; epochs: number; fD: number; fQ: number; U: number; sD: Off; draw: DataDraw };
/** baseG on an explicit launch freeze (pure: the design and the frozen inputs only). RD-X03: a rival's base goes through
 *  this same function on its reference design and reference draw (actors/rivalModel.ts rivalBaseG). */
export function baseGOf(d: BaseDesign, fz: BaseFreeze): BaseGOut {
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
  return { parts, flop, tokens, epochs: draw.epochs, fD, fQ, U: draw.uMix, sD: { ...draw.sD }, draw };
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
/** A run's launch snapshot (TrainingRun.recipe, RD-B02): launchRun builds it. */
export function recipeAtLaunch(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'base' | 'baseId' | 'flopNeeded'>): RunRecipe {
  if (run.kind === 'base') return run.base ? baseFreezeNow(s, run.base) : {};
  if (run.kind === 'continue') {
    const parent = s.player.models.bases.find((b) => b.id === run.baseId);
    return parent ? { pre: ePreAt(s, parent.flop + run.flopNeeded), ...continueDrawNow(s, parent, run.flopNeeded) } : {};
  }
  if (runAct(run.kind) === 'rl') return postRecipeNow(s);
  return {}; // a student learns from its teacher's outputs: nothing to freeze
}
/** A continue run's data at launch (RD-T02, TRN-07): its added tokens (added FLOP ÷ 6·N_active) drawn from the portfolio
 *  on top of the parent's, with the parent's mix, through the same draw as a new base. The draw is cumulative (each
 *  slice's epochs count the parent's use too); `prevDEff` is the parent's tokens alone on the same portfolio. */
export function continueDrawNow(s: GameStateV2, parent: BaseModel, addFlop: number): { draw: DataDraw; prevDEff: number } {
  const add = Math.max(0, addFlop) / (6 * parent.params);
  return { draw: playerDraw(s, parent.design, parent.tokens + add), prevDEff: playerDraw(s, parent.design, parent.tokens).dEff };
}
/** Fill the fields a run's snapshot lacks with today's values, keeping those it has (and their key order): the start
 *  run R0 at newGame (its RL recipe is its launch day's). */
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

// ─────────────────── the lab's forecast of a run (RD-B19, UB-2b) ───────────────────

/** RD-B19 (B45), UB-2b: what the lab can forecast of a run's level, on the measured scale, from what it believes and
 *  has measured (never the engine's prediction, which is the true outcome the traits' AF gate reads). The planned run is
 *  computed by planRun on the lab's believed view (believedView): the pretraining and RL know-how areas are the believed
 *  values (start and public knowledge + Σ the adopted results' estimates, RF-R5), and every model it starts from has a
 *  measured build (its measured level as its effective compute; a base's pretraining part from the latest measured
 *  version post-trained on it, minus that version's RL gain at the believed RL recipe its run took). `mid` is the
 *  planned run's level; `sd` = √(believed ideas' sd² propagated to the level + the start model's measurement sd² + one
 *  evaluation band for the new model's own measurement, measuredSd of the reference); `band` and the domains' ranges are
 *  the 90% range, mid ± 1.64 sd (forecastBand). `gain` = mid − the reference's
 *  measured level (like with like). Reference: `ref` if measured, else the internal model, else the best measured live
 *  version. Undefined when no reference is measured or the plan has no prediction. Readout only. */
export interface RunForecast {
  mid: number; band: [number, number]; sd: number; gain: number; refId: string; refName: string; domains: Record<DomainId, [number, number]>;
  /** The parts of sd (levels): believed ideas, the start model's measurement, the new model's evaluation band. */
  sdParts: { ideas: number; start: number; eval: number };
  /** The measured model the run starts from (its measured build), if any. */
  startName?: string;
}
/** The forecast's 90% range: mid ± 1.64 sd (UB-2b; the run card, the run queue). */
export const forecastBand = (mid: number, sd: number): [number, number] => [mid - 1.64 * sd, mid + 1.64 * sd];
export function runForecast(s: GameStateV2, p: LaunchRunParams, ref?: ModelVersion): RunForecast | undefined {
  const r = forecastRef(s, ref);
  if (!r || r.evals.measuredL === undefined) return undefined;
  const fb = believedPrediction(s, p);
  if (!fb) return undefined;
  const sdEval = measuredSd(r);
  const sd = Math.hypot(fb.sdIdeas, fb.sdStart, sdEval);
  const domains = Object.fromEntries(Object.entries(fb.domains).map(([d, m]) => [d, forecastBand(m, sd)])) as Record<DomainId, [number, number]>;
  return {
    mid: fb.mid, band: forecastBand(fb.mid, sd), sd, gain: fb.mid - r.evals.measuredL, refId: r.id, refName: r.name, domains,
    sdParts: { ideas: fb.sdIdeas, start: fb.sdStart, eval: sdEval }, ...(fb.start ? { startName: fb.start.name } : {}),
  };
}
function forecastRef(s: GameStateV2, ref?: ModelVersion): ModelVersion | undefined {
  const measured = (v: ModelVersion | undefined) => (v && v.evals.measuredL !== undefined ? v : undefined);
  let r = measured(ref) ?? measured(internalVersion(s));
  if (!r) {
    for (const v of s.player.models.versions) {
      if (v.status === 'retired' || v.status === 'rolledBack' || v.evals.measuredL === undefined) continue;
      if (!r || v.evals.measuredL > (r.evals.measuredL ?? -Infinity)) r = v;
    }
  }
  return r;
}

/** The know-how areas the lab sees only through evals (believed: RF-R5 est); training and serving efficiency are
 *  measured directly as chip throughput (facts) and keep the engine's values. */
const BELIEVED_AREAS = ['pre', 'rlMid', 'rlCeil'] as const;
type BelievedArea = (typeof BELIEVED_AREAS)[number];
/** UB-2b: an area's believed value (OOM) after the results adopted up to `day` (today without one): start and public
 *  knowledge + Σ the estimates, less those adopted after `day` (UB-2 Waiting's rule; only the last 30 results are kept,
 *  so a long-ago day can read high). Scale-free: an estimate is taken at the lab's latest base when it came in. */
export function believedAreaAt(s: GameStateV2, k: BelievedArea, day?: Day): number {
  const st = s.player.research.stacks[k];
  const est = st.est ?? 0;
  let since = 0;
  if (day !== undefined) for (const a of s.player.research.adopted) if (a.stack === k && a.day > day) since += a.est;
  return st.base + est - Math.max(0, Math.min(est, since));
}

/** A version's RL part at the believed RL recipe its run took (its RL quantities are facts). A student took its
 *  teacher's. */
function believedRl(s: GameStateV2, v: ModelVersion, b: VersionBuild): Pick<VersionBuild, 'eRL' | 'aRL' | 'dgRL' | 'dgRLd'> {
  const src = v.variant === 'mini' ? (versionById(s, v.parentVersionId) ?? v) : v;
  const day = src.trained?.rlDay ?? src.day;
  const eRL = believedAreaAt(s, 'rlMid', day);
  const aRL = b.aRL !== undefined ? believedAreaAt(s, 'rlCeil', day) : 0;
  const rl = rlGains(b.flopPre, b.rlFlop, b.rlW, eRL, aRL, b.rlFid);
  return { eRL, aRL, dgRL: rl.general, dgRLd: rl.perDomain };
}
/** A base's measured build (UB-2b): its pretraining part as each measured full version post-trained on it reads it
 *  (that version's measured level as effective compute, minus its RL gain at its believed RL recipe and its design's
 *  effect; not a version the stream has continued), pooled by inverse measurement variance. `sd` = the pooled
 *  measurement sd (levels); `by` = the latest of those versions. Undefined when none is measured. */
interface BaseAnchor { gPre: number; sd: number; n: number; by: ModelVersion }
function baseAnchor(s: GameStateV2, b: BaseModel): BaseAnchor | undefined {
  const w = s.hidden.timeline; // the level scale only (public reference points)
  let sw = 0, sg = 0, n = 0;
  let by: ModelVersion | undefined;
  for (const v of s.player.models.versions) {
    if (v.baseId !== b.id || v.variant !== 'full' || !v.trained?.post || v.evals.measuredL === undefined || !v.build || v.build.addTokens) continue;
    const wt = 1 / Math.max(1e-6, measuredSd(v)) ** 2;
    sg += wt * (gOfLevel(w, v.evals.measuredL) - believedRl(s, v, v.build).dgRL - postEffect(v.design).dg);
    sw += wt;
    n++;
    if (!by || v.day >= by.day) by = v;
  }
  return by ? { gPre: sg / sw, sd: 1 / Math.sqrt(sw), n, by } : undefined;
}

interface BelievedView { sB: GameStateV2; anchor: Map<string, BaseAnchor | undefined> }
/** UB-2b: the lab's believed view of its models and know-how, for planRun (readouts only; the engine's runs keep the
 *  true recipe and builds). Areas: believed (above). A base: its measured build (baseAnchor), else its physical part
 *  (FLOP, shape, tokens and data: facts) + the believed pretraining recipe on its start day. A version: on its base's
 *  believed pretraining part, its RL part at its believed RL recipe, and the rest set so its effective compute is its
 *  measured level (unmeasured: the design's effect, a student's distillation gap). */
function believedView(s: GameStateV2): BelievedView {
  const w = s.hidden.timeline; // the level scale only (public reference points)
  const m = s.player.models;
  const anchor = new Map<string, BaseAnchor | undefined>();
  const gPreB = new Map<string, number>();
  const bases = m.bases.map((b) => {
    const a = baseAnchor(s, b);
    anchor.set(b.id, a);
    const phys = b.gPre - b.ePre; // FLOP, shape, tokens, data and design: facts (ePre is the recipe part)
    const g = a ? a.gPre : phys + E_START + believedAreaAt(s, 'pre', b.startDay ?? b.day);
    gPreB.set(b.id, g);
    return { ...b, gPre: g, ePre: g - phys };
  });
  const versions = m.versions.map((v) => {
    const b = v.build ?? fallbackBuild(v);
    const rl = believedRl(s, v, b);
    const gPre = gPreB.get(v.baseId) ?? (v.evals.measuredL !== undefined ? gOfLevel(w, v.evals.measuredL) - rl.dgRL : 0);
    let dg: number;
    if (v.evals.measuredL !== undefined) dg = gOfLevel(w, v.evals.measuredL) - gPre - rl.dgRL;
    else {
      dg = postEffect(v.design).dg;
      const t = v.variant === 'mini' ? versionById(s, v.parentVersionId) : undefined;
      if (t) { const nS = paramsOfVersion(s, v); dg -= distillGap(paramsOfVersion(s, t), nS, DISTILL_TPP * nS); }
    }
    return { ...v, build: { ...b, gPre, ...rl, dg } };
  });
  const st = s.player.research.stacks;
  const stacks = { ...st };
  for (const k of BELIEVED_AREAS) stacks[k] = { ...st[k], base: believedAreaAt(s, k), buckets: [] };
  const sB = { ...s, player: { ...s.player, models: { ...m, bases, versions }, research: { ...s.player.research, stacks } } } as GameStateV2;
  return { sB, anchor };
}
/** The same view with one area's believed value moved by `d` (OOM; the start models keep theirs). */
function bumped(v: BelievedView, k: BelievedArea, d: number): GameStateV2 {
  const r = v.sB.player.research;
  const stacks = { ...r.stacks, [k]: { ...r.stacks[k], base: r.stacks[k].base + d } };
  return { ...v.sB, player: { ...v.sB.player, research: { ...r, stacks } } } as GameStateV2;
}

/** UB-2b: the planned run's believed level and domains, the believed ideas' sd propagated to its level (each area's
 *  √Σ estSd², by the level's response to that area), and the measured start model with its measurement sd. */
function believedPrediction(s: GameStateV2, p: LaunchRunParams): { mid: number; domains: Record<DomainId, number>; sdIdeas: number; sdStart: number; start?: ModelVersion } | undefined {
  const view = believedView(s);
  const w = s.hidden.timeline; // the level scale only (public reference points)
  // What a post-training run's completion adds that planRun does not (completeRl): the lift from distilling the best
  // released teacher above it (RD-X04 rule B: rivals' public models, public) and, on fresh RL, the pending run penalty
  // (a removal the player ordered). In OOM of effective compute on the planned build's G. A new or continued base is
  // forecast through the post-training it would get, so it takes the lift too; a distilled student does not.
  const params = p.kind === 'base' ? p.base?.params : p.kind === 'distill' ? undefined : s.player.models.bases.find((b) => b.id === p.baseId)?.params;
  const extraOn = (G: number) => (params ? distillLift(s, 'player', G, params).dG - (p.kind === 'post' && p.grader !== 'teacher' ? pendingRunPenalty(s) : 0) : 0);
  const levelAt = (x: GameStateV2) => {
    const pl = planRun(x, p);
    const L = pl.prediction.Lg;
    if (!(L[1] > 0)) return undefined;
    const mid = (L[0] + L[1]) / 2;
    const dG = extraOn(pl.g.G);
    return { pl, dG, mid: dG ? levelOfG(w, gOfLevel(w, mid) + dG) : mid };
  };
  const midOf = (x: GameStateV2) => levelAt(x)?.mid;
  const at0 = levelAt(view.sB);
  if (!at0) return undefined;
  const { pl: plan, dG: dG0, mid: m0 } = at0;
  const D = 0.01;
  let v2 = 0;
  for (const k of BELIEVED_AREAS) {
    const sdK = Math.sqrt(s.player.research.stacks[k].estVar ?? 0);
    if (!(sdK > 0)) continue;
    const m1 = midOf(bumped(view, k, D));
    if (m1 !== undefined) v2 += (((m1 - m0) / D) * sdK) ** 2;
  }
  const domains = Object.fromEntries(Object.entries(plan.prediction.domains).map(([d, b]) => {
    const m = (b[0] + b[1]) / 2;
    return [d, dG0 && m > 0 && m < 15 ? clamp(levelOfG(w, gOfLevel(w, m) + dG0), 0, 15) : m];
  })) as Record<DomainId, number>;
  // The measured model the run starts from: a teacher (amplify, distil), else the base's anchor (RL, continue).
  const teacher = p.grader === 'teacher' || p.kind === 'distill' ? versionById(s, p.teacherVersionId) : undefined;
  const ba = p.kind !== 'base' && p.baseId ? view.anchor.get(p.baseId) : undefined;
  const start = teacher?.evals.measuredL !== undefined ? { v: teacher, sd: measuredSd(teacher) } : ba ? { v: ba.by, sd: ba.sd } : undefined;
  // With no measured start model the forecast is on the believed scale; the new model's first suite reads it through
  // that suite's elicitation (the standing policy's depth, self-run: known), as a measured start model's level already does.
  const elic = start ? 0 : EVAL_DEPTHS[policyDepth(s)].elic + ELICITATION.self;
  if (elic) for (const d of Object.keys(domains) as DomainId[]) domains[d] += elic;
  return { mid: m0 + elic, domains, sdIdeas: Math.sqrt(v2), sdStart: start?.sd ?? 0, ...(start ? { start: start.v } : {}) };
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
  flop: number;
  params: number;
  tokens: number;
  gPre: number;
  ePre: number;
  sD: Off;
  fpt: number;
  monitorability: number;
  /** Continued base (RD-T02): epochs of the most-repeated slice of the cumulative draw and the added part's data factor. */
  epochs?: number;
  fAdd?: number;
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
    const flopNeeded = bg.flop; // RD-T08: FLOP = 6·N·D whatever the tokens are; no data-option cash (licences are paid at signing)
    return {
      flopNeeded, cash: 0,
      flop: bg.flop, params: d.params, tokens: bg.tokens, gPre: bg.parts.total, ePre: bg.parts.recipe, sD: bg.sD,
      fpt: fptOfDesign(d.params, d.shape), monitorability: be.monitorability, signals: baseSignals(d, { gPre: bg.parts.total, draw: bg.draw }), bg,
    };
  }
  if (src.from === 'continue') {
    // Effective compute adds (continueGPre): only the added part embodies the pretraining stack at the new size.
    // RD-T02: the added tokens come from the portfolio (the launch snapshot's cumulative draw), so their repetition and
    // quality scale the added part's effective compute (a snapshot without prevDEff, a hand-built run: reference data).
    const b = src.parent;
    const flop = b.flop + src.addFlop;
    const addTokens = src.addFlop / (6 * b.params);
    const cd = rec?.draw ? { draw: rec.draw, prevDEff: rec.prevDEff } : continueDrawNow(s, b, src.addFlop);
    const fAdd = cd.prevDEff === undefined ? 1 : continueFData(b.params, b.tokens, addTokens, cd.draw.dEff, cd.prevDEff);
    const gPre = continueGPre(b.gPre, src.addFlop, E_START + (rec ? rec.pre! : ePreAt(s, flop)), b.design.shape, fAdd);
    // Physical part grows by the added FLOP; the recipe efficiency is what remains (it also carries the added part's
    // data factor; the stream's continued pretraining uses the same rule on a version, RD-T03).
    const ePre = gPre - (b.gPre - b.ePre) - Math.log10(flop / b.flop);
    return {
      flopNeeded: src.addFlop, cash: 0, flop, params: b.params, tokens: b.tokens + addTokens,
      gPre, ePre, sD: b.sD ?? {}, fpt: b.fpt, monitorability: b.monitorability ?? 1,
      ...(cd.prevDEff !== undefined ? { epochs: cd.draw.epochs, fAdd } : {}),
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
  const pe = postEffect(d);
  const rlW = recipeWeights(s, d.rlFocus, rec);
  const rl = rlGains(base.flop, extra, rlW, rec.rlMid, rec.rlCeil, now);
  // The version's signals are the engine's (model v3 E3): its base's and this run's, from their quantities.
  const sig = addSig(base.signals ?? {}, postSignals(s, d, rec.exploit, { rho: extra / Math.max(1, base.flop) }));
  return {
    gPre: base.gPre, flopPre: base.flop, rlFlop: extra, rlW, eRL: rec.rlMid, aRL: rec.rlCeil, rlFid: { ...now }, dgRL: rl.general, dgRLd: rl.perDomain, dg: pe.dg, sD: withDomainG(rec.domainG, base.sD ?? {}),
    // RD-T05: the horizon gain is the RL done on long tasks (its in-family gain); P07 (frozen at launch, RD-E01b)
    // multiplies it. Long-horizon human demos (P12) act through the long-tasks suite's fidelity (its RL ceiling).
    dgD: { ...pe.dgD }, h80Mult: longTasksHorizonMult(rl.perFamily.longHorizon ?? 0, rec.p07 ? P07_LONG_TASKS_HORIZON : 1, { flopPre: base.flop, rlFlop: extra, eRL: rec.rlMid, aRL: rec.rlCeil }),
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
      ?? (d.curation.safetyPretrain ? optionLocked(s, 'curation', 'safetyPretrain') : undefined);
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
      servingFlop: servingFlop(pre.params), computeCost: flopCost(s, pre.flopNeeded), scrutiny: runScrutiny(s, pre.flopNeeded), gPre: bg.parts,
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
  reason ??= optionLocked(s, 'pref', d.pref) ?? (d.cot !== 'latent' ? optionLocked(s, 'cot', d.cot) : undefined);
  if (d.rlFocus !== 'broad') for (const f of d.rlFocus) reason ??= optionLocked(s, 'rlFocus', f);
  if (d.cot === 'latent' && base.design.shape !== 'latent') reason = 'Latent CoT needs a latent base';
  if (base.design.shape === 'latent' && d.cot !== 'latent') reason = 'A latent base forces latent CoT';
  if (d.rlFocus !== 'broad' && d.rlFocus.length > 2) reason = 'Pick at most 2 environment families';
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
  // UB-4 (VOCAB §3 Training): run names in player words, never 'post 21' / 'IDA 21'.
  const kindName = p.grader === 'teacher' ? 'Amplify' : ({ base: 'Pretraining', post: 'Post-training', continue: 'Continued pretraining', distill: 'Distil' } as const)[p.kind];
  const run: TrainingRun = {
    id: `R${n}`, kind: p.kind, name: `${kindName} run ${n}`, startDay: s.time.day,
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
  // UB-2b: the lab's forecast as launched (readouts: the run queue's band; predicted vs measured once it is evaluated).
  const fc = runForecast(s, p);
  if (fc) run.forecast = { mid: Math.round(fc.mid * 1e3) / 1e3, sd: Math.round(fc.sd * 1e3) / 1e3 };
  if (p.post) run.post = { ...p.post, rlFocus: Array.isArray(p.post.rlFocus) ? [...p.post.rlFocus] : 'broad', methods: [...(p.post.methods ?? [])] };
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
  const scrutiny = p.kind === 'base' && p.base ? runScrutiny(s, plan.flopNeeded) : 0;
  if (scrutiny >= 0.5) ctx.bump('relations.scrutiny', Math.round(scrutiny * 10) / 10, 'base run above the largest rival run', run.name); // §3.4.3
  ctx.log('research', `Run launched: ${run.name} (ETA ${plan.etaDays} d).`, 1, run.id);
  return run;
}

// ───────────────────────────── completion ─────────────────────────────

const blankBeliefs = (src?: ModelVersion): Record<TraitId, TraitBelief> => {
  const out = {} as Record<TraitId, TraitBelief>;
  for (const t of TRAIT_IDS) {
    const b = src?.beliefs[t];
    out[t] = b ? { est: b.est, sd: Math.min(0.35, b.sd + 0.05), clarity: Math.max(0, 1 - Math.min(0.35, b.sd + 0.05) / 0.35), evidence: [] } : { est: 0.2, sd: 0.3, clarity: 1 - 0.3 / 0.35, evidence: [] }; // placeholder: applyRunToTraits sets the beliefs
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
    id: `V${s.player.models.nextName++}`, name: versionName(s, base.id), baseId: base.id, day: s.time.day, recG: playerRecipeG(s),
    variant: 'full', design: run.post ? { ...run.post } : { ...(parent?.design ?? { pref: 'constitution', rlFocus: 'broad', rlBudget: 'standard', cot: 'visible', safety: 'standard', methods: [] }) },
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
  run.endDay = s.time.day;
  // Launch always sets the snapshot; only a hand-built run (a script) lacks one.
  const rec = (run.recipe ??= recipeAtLaunch(s, run));
  if (runAct(run.kind) === 'pretrain') completePretrain(s, ctx, run, rec);
  else completeRl(s, ctx, run, rec as PostRecipe); // the snapshot is a PostRecipe (recipeAtLaunch)
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
    run.resultId = v.id;
    if (run.autoTier) v.autoTier = true; // RD-P01b: joins its teacher's lineups when ready (models/cheapTier.ts)
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
      gPre: pre.gPre, ePre: pre.ePre, parentBaseId: parent.id, ...(pre.epochs !== undefined ? { epochs: pre.epochs } : {}),
      traitsTrue: { ...parent.traitsTrue }, uModes: [...parent.uModes], sD: { ...pre.sD }, signals: { ...(parent.signals ?? {}) },
    };
  }
  m.bases.push(b);
  run.resultId = b.id;
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
  // RD-X04 rule B: the post-training distils the best released teacher above its own G (production/diffusion.ts).
  build.dg += distillLift(s, 'player', gOfBuild(build), base.params).dG;
  const rlDay = rlDayOf(s, run);
  if (start.on === 'version') {
    const t = start.version;
    const v = newVersion(s, run, base, build, t, { fpt: t.fpt, monitorability: t.monitorability, design: { ...t.design }, appeal: t.appeal ?? 1, trained: { rlDay, post: false } });
    m.versions.push(v);
    run.resultId = v.id;
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
  run.resultId = v.id;
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
    // The Safety framework pauses frontier runs (status 'paused'); they resume when its training hold ends.
    if (!frontierPaused(s)) for (const r of s.player.models.runs) if (r.status === 'paused' && (r.kind === 'base' || r.kind === 'post')) r.status = 'running';
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

// ───────────────────────────── continual-learning stream (P08) ─────────────────────────────
// RD-T03 (DD-05, TRN-02): the stream is a scheduled pair of the two acts on the FLOP it actually spends. Every
// STREAM_PERIOD_DAYS the streamed version gets a continued-pretraining increment (the pretraining act's "continue": the
// FLOP the stream's pool share delivered in the period, its tokens drawn from the portfolio, only the added part at
// today's pretraining recipe, continueGPre) followed by an RL refresh (the RL act on the version: the period's RL FLOP,
// only the added part at today's RL recipe and suites). No recipe is re-applied for free: 0 FLOP adds nothing.

/** Pool FLOP the stream delivers per day (before its pretraining / RL split): STREAM_POOL_SHARE of the training pool ×
 *  goodput × the run operations served (RD-B09). */
export const streamFlopPerDay = (s: GameStateV2) => STREAM_POOL_SHARE * trainingFlopPerDay(s) * goodputOf(s) * runOpsServed(s);

/** The period's pool FLOP split between the acts as the version's own pretraining : RL FLOP [D: the stream keeps the
 *  version's mix]; the RL part runs at MFU_RL_FACTOR (its rollouts are inference), as an RL run does. */
function streamSplit(b: VersionBuild, poolFlop: number): { pre: number; rl: number } {
  const rho = Math.max(0, b.rlFlop) / Math.max(1, b.flopPre);
  const q = rho / (1 + rho);
  return { pre: Math.max(0, poolFlop) * (1 - q), rl: Math.max(0, poolFlop) * q * MFU_RL_FACTOR };
}

/** The RL act on a version with only the added part at today's recipe: effective RL compute adds (the curve reads
 *  rlFlop · 10^eRL, absolute since RD-T04), so e_RL is the FLOP-weighted mean of its and today's in that unit; the ceiling raise and
 *  each family's suite fidelity move toward today's by the added FLOP's share, never down. `extra` 0 changes nothing. */
function rlAddOnVersion(s: GameStateV2, tb: VersionBuild, extra: number, rec: RlRecipe = rlRecipeNow(s)): VersionBuild {
  if (!(extra > 0)) return tb;
  const tot = tb.rlFlop + extra;
  const share = extra / tot;
  const eRL = Math.log10((tb.rlFlop * Math.pow(10, tb.eRL) + extra * Math.pow(10, rec.rlMid)) / tot);
  const a0 = tb.aRL ?? 0;
  const aRL = Math.max(a0, a0 + share * (rec.rlCeil - a0));
  const rlFid: FamilyMap = { ...tb.rlFid };
  for (const [f, v] of Object.entries(rec.fid ?? {}) as [RLFamily, number][]) {
    const o = rlFid[f] ?? 1;
    rlFid[f] = Math.max(o, o + share * (v - o));
  }
  const rl = rlGains(tb.flopPre, tot, tb.rlW, eRL, aRL, rlFid);
  return { ...tb, rlFlop: tot, eRL, aRL, rlFid, dgRL: rl.general, dgRLd: rl.perDomain };
}

/** One stream period on version `v` with `poolFlop` of pool FLOP: continued pretraining then the RL refresh (above).
 *  Returns the new build (the caller writes it). A version without a base of its own gets the RL part only. */
export function streamPeriodBuild(s: GameStateV2, v: ModelVersion, poolFlop: number): VersionBuild {
  const b = v.build ?? fallbackBuild(v);
  if (!(poolFlop > 0)) return b;
  const { pre, rl } = streamSplit(b, poolFlop);
  let nb: VersionBuild = b;
  const base = s.player.models.bases.find((x) => x.id === v.baseId);
  if (base && pre > 0) {
    // The pretraining act's continue source on the version's weights: tokens drawn with the base's mix, cumulative on
    // what the base and earlier stream periods used (RD-T02's draw), the added part at today's recipe at the new FLOP.
    const prevTok = base.tokens + (b.addTokens ?? 0);
    const add = pre / (6 * base.params);
    const tot = playerDraw(s, base.design, prevTok + add);
    const fAdd = continueFData(base.params, prevTok, add, tot.dEff, playerDraw(s, base.design, prevTok).dEff);
    const flopPre = b.flopPre + pre;
    nb = { ...b, gPre: continueGPre(b.gPre, pre, E_START + ePreAt(s, flopPre), base.design.shape, fAdd), flopPre, addTokens: prevTok + add - base.tokens };
  }
  return rlAddOnVersion(s, nb, rl);
}

/** Apply a stream period to `v` in place: its build moves, its G only up. */
function applyStreamPeriod(s: GameStateV2, v: ModelVersion, poolFlop: number) {
  const nb = streamPeriodBuild(s, v, poolFlop);
  v.build = nb;
  const G = gOfBuild(nb);
  if (G > v.G) {
    v.G = G;
    refreshLevels(s.hidden.timeline, v);
  }
}

/** Gain (OOM of G) and pool FLOP of the stream's next period on version `id` at today's pool: the mechanism run on a
 *  copy of the version (the start and stop previews read it). */
export function streamPeriodGain(s: GameStateV2, versionId: string): { dG: number; flop: number } {
  const v = versionById(s, versionId);
  if (!v) return { dG: 0, flop: 0 };
  const flop = streamFlopPerDay(s) * STREAM_PERIOD_DAYS;
  const nb = streamPeriodBuild(s, structuredClone(v), flop);
  return { dG: Math.max(0, gOfBuild(nb) - Math.max(v.G, gOfBuild(v.build ?? fallbackBuild(v)))), flop };
}

/** Stream (P08): FLOP accrues daily at the stream's pool share; every STREAM_PERIOD_DAYS the period's FLOP is spent on
 *  the two acts (applyStreamPeriod). WS2 adds trait drift via its own hook on `stream`. */
function advanceStream(s: GameStateV2, day: Day) {
  const st = s.player.models.stream;
  if (!st) return;
  const v = versionById(s, st.versionId);
  if (!v || v.status === 'retired' || v.status === 'rolledBack') {
    delete s.player.models.stream;
    return;
  }
  st.flop = (st.flop ?? 0) + streamFlopPerDay(s);
  st.periodDay ??= day;
  if (day - st.periodDay < STREAM_PERIOD_DAYS) return;
  applyStreamPeriod(s, v, st.flop);
  st.flop = 0;
  st.periodDay = day;
}

/** Start a continual-learning stream on a version (needs P08). Returns an error string or undefined. Nothing changes
 *  until the first period's FLOP is spent. */
export function startStream(s: GameStateV2, versionId: string, day: Day = s.time.day): string | undefined {
  if (!adopted(s, 'P08')) return 'Needs the discovery Continual learning';
  const v = versionById(s, versionId);
  if (!v || v.variant !== 'full') return 'Pick a full version';
  s.player.models.stream = { versionId, startedDay: day, lastAuditDay: day, periodDay: day, flop: 0 };
  return undefined;
}

/** continual (45, daily): the stream accrues and spends its FLOP. Rival and China labs run one daily policy, WS4's labDaily
 *  (actors/rivals.ts, order 100); the old WS1 default policy is gone (RD-B14: it doubled day-1 staff growth and training). */
export const continualSystem: EngineSystem = {
  id: 'continual', owner: 'WS1', cadence: 'daily', order: 45, system: 'models',
  run(s, ctx) {
    advanceStream(s, ctx.day);
  },
};

export type { DomainId, RLFamily };
