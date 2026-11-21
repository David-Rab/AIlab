// Rivals, China and the simulated leader lab in effective compute (model v3 F1: design/MODEL-V3.md §12, §13;
// design/notes/F1.md). Owner: WS1 (capability) / WS4 (behaviour). Data: src/data/v2/rivalModel.ts.
//
// A non-player lab is the player's model at aggregate level, without ideas or a blueprint:
//   recipe     three parts in the player's stack units (model v3 F2): pretraining efficiency e_pre, RL efficiency (rlMid)
//              and RL ceiling (rlCeil). Each part p is a research pool with its lines' returns r_p = Σ rShare × r (the
//              player's line pools, research.ts linePool, at aggregate level): dS_p/dt = a_p · RS/RS₀ · 10^(−S_p/r_p) at
//              test scale. Pretraining results are realised at the run's FLOP: e_pre gains κ_pre·dS_pre, κ_pre the
//              reference lines' scale factor (F_base/F_test)^s on their survivors (recipeParts); the RL parts enter G through
//              the reference RL run (stacks.ts refRlGain), which saturates as the player's does. Start rates: the
//              pretraining part realises PRE_RATE0 at the leader's day-0 inputs, the RL parts the same input by their
//              shares. What leaks, diffusion and events give the lab enters the pretraining part as public knowledge
//              (addRivalKnowledge, OOM; the player's addKnowledge).
//   research   RS = X(c̄, ℓ)·units·taste·eff·mods ÷ the leader's day-0 value: the player's experiment CES at aggregate
//              level (production.ts evalV3) — experiment compute per unit of research engineers, effective labour from the
//              lab's own internal model on Experiments (coverage, AI FTE from its compute and FLOP per token, the coding
//              CES), AI taste from its fit on Research ideas (workfit.ts teamTaste)
//   training   one base run after another on BASE_POOL_SHARE of the training pool for BASE_RUN_DAYS, released on the
//              archetype cadence (rivals.ts BASE_MONTHS): G_pre = log₁₀(FLOP) + E_START + e_pre at launch + the shape
//              terms (effective.ts gPreOf); N_active = √(FLOP/(6·tpp)), FLOP per token 2·N_active
//   versions   post-training every 6–10 weeks: G = G_pre + the reference RL run's gain on the base at today's RL recipe;
//              from the Research-agent level the internal model re-applies today's whole recipe weekly (continual
//              learning, as the player's P08 stream)
// Nothing here reads a calendar path, pm or pm thresholds, CAL_SHIFT, the v2 knots or the rivals' old FLOP bridge.
import { BASE_POOL_SHARE, BASE_RUN_DAYS, CL_DAYS, CL_LEVEL, PRE_RATE0, RIVAL_TPP, SERVE_RATE0, START_PUBLIC_GAP_Y } from '../../../data/v2/rivalModel';
import { DEFAULT_LINES, LINE_STAGES, SMALL_TO_TEST, SURVIVE_FRAC } from '../../../data/v2/research';
import { TREE_BY_ID } from '../../../data/v2/tree';
import { B_G_PER_Y, E_START, FLOP_RL_REF, GOODPUT, PARAM_RANGE, B0_PARAMS, REFERENCE_BASE, REF_TPP, SHAPE } from '../../../data/v2/runDesign';
import { B0_DAY, B0_START_DAY, H_REF_BASE, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { C_UNIT_FLOP_PER_DAY, DAY0_REF, H50_PER_OOM, H50_V0_MIN, RE_UNIT, WORK_TYPES } from '../../../data/v2/workTypes';
import { clamp } from '../../rng';
import { domainsOf, gV0, levelOfG } from '../models/capability';
import { flopOfDesign, gPreOf, paramsForFlop } from '../models/effective';
import { decodeUtilOf, refRlGain, serveFlopOomOf } from '../models/stacks';
import { agentFptEq, assistOf, copiesOf, coverage, effLabour, fteOfFpt, sdAIOf, speedOfCopy, teamTaste, winRate } from '../departments/workfit';
import { tokEff } from '../worldfx/serving';
import { Xces, hRef } from '../production/knots';
import { normalizeSplit, shareRefAt } from '../departments/split';
import { decimalYear } from '../core/time';
import { DEFAULT_CAP_SHARES } from '../../../data/v2/agents';
import type { GameStateV2, ProductionReadout, RivalBase, RivalLab, RivalPhys, SimpleModel, TimelineWorld } from '../types';

const B = B_G_PER_Y;
/** Research-engineer team-equivalents on research per capabilities head: the leader's day-0 9.68 team-equivalents on
 *  experiments and tuning (DAY0_REF.re) over its 2,050 capabilities staff (H_REF_BASE) [D: fixed day-0 ratio]. */
export const RE_PER_HEAD = DAY0_REF.re / H_REF_BASE;
/** Science team-equivalents per capabilities head: the leader start's 320 Strong capability scientists (8 team-eq of
 *  WORK_TYPES.IDEAS.heads) over 2,050 [D: fixed day-0 ratio, data/v2/starts.ts]. */
export const SCI_PER_HEAD = 8 / H_REF_BASE;
/** Shares of a lab's agent pool on Experiments and on Research ideas: the player's default agent shares (routine 0.65,
 *  frontier 0.15; engineering 0.2 does not enter research here) [D, data/v2/agents.ts DEFAULT_CAP_SHARES]. */
const AGENT_EXP = DEFAULT_CAP_SHARES.capRoutine;
/** Numerical guards past superintelligence (the law is explosive: AIFM's software singularity): AI taste counts up to 30
 *  SD (AI 2027's ASI is 14.5 SD, research/13 §1.5) and the recipe grows at most 36 OOM a year (0.1 a day; RefBot's
 *  fastest measured takeoff is 30–40 OOM/yr, ai2027 stub) [D]. Neither binds before ASI on the presets. */
const SD_AI_MAX = 30;
const RECIPE_RATE_MAX = 36.5;
const AGENT_IDEAS = DEFAULT_CAP_SHARES.capFrontier;

// ───────────────────────────── recipe and models ─────────────────────────────

export type RivalRecipe = RivalPhys['rec'];
type Part = keyof RivalRecipe;
const PARTS: Part[] = ['pre', 'mid', 'ceil'];
const PART_STACK = { pre: 'pre', mid: 'rlMid', ceil: 'rlCeil' } as const;

/** Range of a line candidate's scale exponent (models/research.ts S_RANGE, repeated: research.ts reaches this module
 *  through the capability chain). */
const S_CLAMP: readonly [number, number] = [-0.6, 0.25];
/** Scale factor of a line's results (model v3 F2, design/V3-BUILD.md, F2 notes): a result is measured at the scale test (F_test =
 *  LINE_STAGES.testFrac of the base) and enters the stack at the base's FLOP, ×(1/testFrac)^s. A single candidate
 *  survives the scale test iff its effect there keeps SURVIVE_FRAC of the small-scale one (1000^s ≥ SURVIVE_FRAC), and
 *  the line's pool advances by the test-scale effect ∝ 1000^s, so κ_l = E[1000^s·(1/testFrac)^s; s ≥ s*] ÷
 *  E[1000^s; s ≥ s*] over the line's scale prior N(μ, σ) clamped to S_CLAMP (Scaling recipes 1.507, Data 1.175,
 *  Optimizer 2.099; s ≡ 0: 1). Not fitted. */
export function lineScaleFactor(mu: number, sd: number): number {
  const up = 1 / LINE_STAGES.testFrac;
  if (sd <= 0) return Math.pow(up, Math.max(S_CLAMP[0], Math.min(S_CLAMP[1], mu)));
  const sStar = Math.log10(SURVIVE_FRAC) / Math.log10(SMALL_TO_TEST);
  let num = 0;
  let den = 0;
  const N = 4001;
  for (let i = 0; i < N; i++) {
    const z = -8 + (16 * i) / (N - 1);
    const sx = Math.max(S_CLAMP[0], Math.min(S_CLAMP[1], mu + sd * z));
    if (sx < sStar) continue;
    const wt = Math.exp((-z * z) / 2) * Math.pow(SMALL_TO_TEST, sx);
    num += wt * Math.pow(up, sx);
    den += wt;
  }
  return den > 0 ? num / den : 1;
}
/** A recipe part from the reference portfolio (the lines every start runs, data/v2/research.ts DEFAULT_LINES): its share
 *  w of the returns (Σ rShare of its lines: pretraining 0.8, RL efficiency 0.08, RL ceiling 0.12; r_p = w·r), its scale
 *  factor κ (rShare-weighted κ_l: pretraining ≈ 1.58, the RL parts 1) and its test-scale start rate a at the leader's
 *  day-0 inputs (OOM/yr): the pretraining part realises PRE_RATE0 (a_pre = PRE_RATE0 / κ_pre) and every part's start
 *  progress is its rShare of the whole (rShare = the line's share of the lab's start software progress, V3b), a_p =
 *  a_pre·w_p / w_pre. */
export interface RecipePart { w: number; kappa: number; a: number }
let partsMemo: Record<Part, RecipePart> | undefined;
export function recipeParts(): Record<Part, RecipePart> {
  if (partsMemo) return partsMemo;
  const acc = { pre: { w: 0, k: 0 }, mid: { w: 0, k: 0 }, ceil: { w: 0, k: 0 } };
  for (const { id } of DEFAULT_LINES) {
    const e = TREE_BY_ID[id]?.effect;
    const part = PARTS.find((p) => PART_STACK[p] === e?.stack);
    if (!e || !part) continue;
    const sh = e.rShare ?? 0;
    acc[part].w += sh;
    acc[part].k += sh * lineScaleFactor(e.s?.[0] ?? 0, e.s?.[1] ?? 0);
  }
  const kPre = acc.pre.k / Math.max(1e-12, acc.pre.w);
  const aPre = PRE_RATE0 / kPre;
  const mk = (p: Part): RecipePart => ({ w: acc[p].w, kappa: acc[p].k / Math.max(1e-12, acc[p].w), a: (aPre * acc[p].w) / acc.pre.w });
  return (partsMemo = { pre: mk('pre'), mid: mk('mid'), ceil: mk('ceil') });
}

/** RL gain of the reference post-training run on a base of `flop` at RL recipe (mid, ceil): the player's RL curve
 *  (stacks.ts refRlGain); the zero recipe memoised. */
const rlMemo = new Map<number, number>();
export function rlOnBase(flop: number, mid = 0, ceil = 0): number {
  if (mid !== 0 || ceil !== 0) return refRlGain(flop, mid, ceil);
  let x = rlMemo.get(flop);
  if (x === undefined) {
    x = refRlGain(flop, 0, 0);
    if (rlMemo.size > 2000) rlMemo.clear();
    rlMemo.set(flop, x);
  }
  return x;
}
/** G-equivalent of a recipe over the leader's day-0 recipe (OOM): pretraining + what its RL recipe adds to the reference
 *  RL run, at the reference base FLOP (stacks.ts gEquivOf; the know-how readout's unit). */
export const gEquivOfRecipe = (rec: RivalRecipe) => rec.pre + rlOnBase(FLOP_RL_REF, rec.mid, rec.ceil) - rlOnBase(FLOP_RL_REF);
/** The lab's recipe as a G-equivalent e (OOM over the leader's day-0 recipe): the unit the leaks, diffusion and events
 *  compare and move recipes in (the player's is stacks.ts recipeG). */
export const recipeOf = (_s: GameStateV2, r: Pick<RivalLab, 'phys'>) => gEquivOfRecipe(r.phys.rec);
/** Knowledge from outside the lab (distillation of others' models, secrets leaks, open weights, events, safety
 *  spillover; model v3 F3) enters the pretraining part as public knowledge: dG OOM, scale-invariant and outside the
 *  research pool (the player's addKnowledge into the stack base). F2 bridged these writers through the know-how readout
 *  (each progress-year moved the recipe by B OOM); F3 writes the same amounts in OOM. */
export function addRivalKnowledge(r: Pick<RivalLab, 'phys'>, dG: number) {
  if (dG !== 0 && Number.isFinite(dG)) r.phys.rec.pre += dG;
}

/** G_pre of a rival base: training FLOP, tokens per parameter, pretraining recipe at launch (MoE, no repetition). */
export const baseGPre = (flop: number, tpp: number, ePre: number) =>
  gPreOf({ flop, tpp, recipe: E_START + ePre, shape: 'moe', fData: 1, designDg: 0 }).total;
/** Active parameters of a compute-optimal-ish base of `flop` at `tpp` tokens per parameter. */
export const baseParams = (flop: number, tpp = RIVAL_TPP) => clamp(paramsForFlop(flop, tpp), PARAM_RANGE[0], PARAM_RANGE[1]);
/** A finished base. */
export function makeBase(gen: number, day: number, flop: number, ePre: number, tpp = RIVAL_TPP): RivalBase {
  return { gen, day, flop, params: baseParams(flop, tpp), tpp, gPre: baseGPre(flop, tpp, ePre), ePre };
}
/** G of a version post-trained on `base` at RL recipe (mid, ceil). */
export const versionG = (base: RivalBase, mid: number, ceil: number) => base.gPre + rlOnBase(base.flop, mid, ceil);
/** G of a version on `base` at recipe `rec` (post-training embodies today's RL recipe, not its pretraining part). */
export const postG = (base: RivalBase, rec: RivalRecipe) => versionG(base, rec.mid, rec.ceil);
/** G of the continual learner on `base` at recipe `rec`: today's whole recipe re-applied to the base's physical part
 *  (the player's P08 stream semantics, V1 notes), never below the base's own G_pre (a stolen base keeps what it had). */
export const clG = (base: RivalBase, rec: RivalRecipe) => Math.max(base.gPre, baseGPre(base.flop, base.tpp, rec.pre)) + rlOnBase(base.flop, rec.mid, rec.ceil);
/** Serving FLOP per token of a base: 2·N_active × the MoE token multiplier. */
export const fptOfBase = (b: Pick<RivalBase, 'params'>) => 2 * b.params * SHAPE.moe.tokenMult;

/** General effective compute of a SimpleModel. */
export const gOfSimple = (_w: TimelineWorld, m: Pick<SimpleModel, 'G'>) => m.G;
/** FLOP per token of a SimpleModel (its own design; B0's when it has none). */
export const fptOfSimpleModel = (m: Pick<SimpleModel, 'fpt' | 'params'>) => m.fpt ?? 2 * (m.params ?? B0_PARAMS) * SHAPE.moe.tokenMult;
/** Set a SimpleModel's G and its readouts (level λ(G), domain levels) and its design from `base`; D10: with the
 *  base's G_pre, the RL part of G (rlG = G − G_pre − the reference RL gain on the base, ≥ 0), which sets the model's
 *  reasoning tokens (worldfx/serving.ts tokEff). A model set from G alone (a release copy) keeps its rlG. */
export function setModelG(w: TimelineWorld, m: SimpleModel, G: number, base?: Pick<RivalBase, 'flop' | 'params'> & Partial<Pick<RivalBase, 'gPre'>>) {
  m.G = G;
  m.Lg = levelOfG(w, G);
  m.domains = domainsOf(w, G);
  if (base) {
    m.flop = base.flop;
    m.params = base.params;
    m.fpt = fptOfBase(base);
    if (base.gPre !== undefined) m.rlG = rlGOnBase(G, base as Pick<RivalBase, 'flop' | 'gPre'>);
  }
}
/** D10: the RL part of a model's G on `base` (OOM over the leader's day-0 recipe, ≥ 0). */
export const rlGOnBase = (G: number, base: Pick<RivalBase, 'flop' | 'gPre'>) => Math.max(0, G - base.gPre - rlOnBase(base.flop));

// ───────────────────────────── serving (model v3 D10) ─────────────────────────────

/** A lab's serving efficiency (OOM; RivalPhys.serve). */
export const rivalServe = (r: Pick<RivalLab, 'phys'>) => r.phys?.serve ?? 0;
/** A lab's decode utilisation (its serving stack's first 0.33 OOM, models/stacks.ts serveSplit). */
export const rivalDecodeU = (r: Pick<RivalLab, 'phys'>) => decodeUtilOf(rivalServe(r));
/** FLOP per token a lab serves model `m` at: its design's × 10^(−the serving stack's FLOP part). Applied when serving,
 *  for all its models: a lab has no blueprint, so the aggregate stack is its fleet's [D]. */
export const rivalServeFpt = (r: Pick<RivalLab, 'phys'>, m: Pick<SimpleModel, 'fpt' | 'params'>) => fptOfSimpleModel(m) * Math.pow(10, -serveFlopOomOf(rivalServe(r)));
/** The equivalent FLOP per token of a lab's internal agents on its internal model (FLOP, reasoning tokens, utilisation:
 *  departments/workfit.ts agentFptEq), what its aggregate research reads. */
export const rivalAgentFpt = (r: Pick<RivalLab, 'phys' | 'internal'>) => agentFptEq(rivalServeFpt(r, r.internal), tokEff(r.internal), rivalDecodeU(r));
/** Returns of the serving stack: the Inference-efficiency line's share of the world's r (research.ts linePool). */
const serveRShare = () => TREE_BY_ID['L.infer']?.effect?.rShare ?? 0.15;
/** Serving-stack growth of lab `r` today (OOM per year) at research speed `rs`: the recipe law with the line's returns,
 *  SERVE_RATE0 · rs · 10^(−serve / r_s) (as recipeRate). */
export const serveRate = (s: GameStateV2, r: RivalLab, rs: number) =>
  Math.min(RECIPE_RATE_MAX, SERVE_RATE0 * rs * Math.pow(10, -rivalServe(r) / Math.max(1e-6, serveRShare() * s.hidden.timeline.v3.r)));
/** The best model of a non-player lab (internal or public), in G. */
export function bestGOf(w: TimelineWorld, r: RivalLab): number {
  return Math.max(gOfSimple(w, r.internal), r.publicModel ? gOfSimple(w, r.publicModel) : -Infinity);
}
/** Display level λ(G) of a lab's best model (milestones, MODEL-V3 §2.2: one map for every lab). */
export const bestLevelOf = (w: TimelineWorld, r: RivalLab) => levelOfG(w, bestGOf(w, r));

// ───────────────────────────── research (aggregate) ─────────────────────────────

export interface RivalResearch {
  /** Research input rate vs the leader's day-0 lab (1 there): the binding one of experiments (E) and ideation (I), each
   *  ÷ its day-0 value; the same with humans only (the readout's M = rs ÷ rsHuman). */
  rs: number; rsHuman: number; E: number; I: number;
  /** Experiment CES pieces: c̄, ℓ, X, X with humans only, units of research engineers. */
  c: number; l: number; X: number; Xh: number; units: number;
  /** AI labour on Experiments (coverage, AI FTE) and on Research ideas (labour multiplier), copies; human share of the
   *  experiment margin; AI taste (SD) and the scientists' taste with it. */
  a: number; aiFte: number; mIdeas: number; copies: number; wH: number; sdAI: number; taste: number;
}
/** Research of lab `r` with experiment share `f` of its research compute `C` (H100e), its internal model doing the AI
 *  work. `eff` = the lab's research-efficiency multiplier, `mods` the speed modifiers. */
export function evalRival(s: GameStateV2, r: Pick<RivalLab, 'internal' | 'core' | 'phys'>, f: number, C: number, eff: number, mods: number): RivalResearch {
  const w = s.hidden.timeline;
  return evalAggregate(w, gOfSimple(w, r.internal), rivalAgentFpt(r), r.core.staff.cap, f, C, eff, mods);
}

/** Raw aggregate research of a lab (before the day-0 normalisation), MODEL-V3 §5 at aggregate level:
 *   experiments  E = X(c̄, ℓ)·units·T — the project CES (research.ts stepProject) on research engineers' units with the
 *                experiment compute per unit, effective labour from the model's coverage of Experiments and AI FTE;
 *   ideation     I = L_IDEAS^λ·T² — the scientists' ideation (stepProject: (m_IDEAS·capacity)^λ·taste candidates, each
 *                bringing research input taste: "taste enters twice", MODEL-V3 §8), AI labour on Research ideas.
 *  A line's candidates come from both stages in turn, so the slower one sets the rate (rivalResearch takes the min). */
function rawAggregate(w: TimelineWorld, G: number, fpt: number, staffCap: number, f: number, C: number) {
  const P = w.prod;
  const k = labConst(w, G, fpt, staffCap);
  const { H, S, units } = k;
  const cExp = Math.max(0, f) * C;
  const kAg = Math.max(0, 1 - f) * C;
  const c = Math.max(1e-12, (cExp * PHI_FLOP_PER_H100E_DAY) / units / C_UNIT_FLOP_PER_DAY);
  // Experiments: the routine-research share of the agent pool.
  const aiFte = kAg * AGENT_EXP * k.fte;
  const L = effLabour(P, k.a, H, aiFte / WORK_TYPES.EXP.heads, k.assist);
  const l = Math.pow(Math.max(1e-12, L / H), P.lam);
  const X = Xces(P, c, l);
  const Xh = Xces(P, c, 1);
  const a = k.a;
  const wH = a >= 1 - 1e-12 ? 0 : a <= 1e-9 ? 1 : (Math.pow(1 - a, 1 - P.rc) * Math.pow(H * k.assist, P.rc)) / Math.pow(L, P.rc);
  // Ideation: the frontier-research share of the agent pool on Research ideas; AI taste lifts the scientists'.
  const LI = effLabour(P, k.aI, S, (kAg * AGENT_IDEAS * k.fte) / WORK_TYPES.IDEAS.heads, k.assistI);
  const taste = kAg > 0 ? k.taste : 1;
  return {
    E: X * units * taste, Eh: Xh * units, I: Math.pow(LI, P.lam) * taste * taste, Ih: Math.pow(S, P.lam),
    c, l, X, Xh, units, a, aiFte, mIdeas: LI / S, copies: copiesOf(kAg, fpt), wH, sdAI: k.sdAI, taste,
  };
}
/** P4: rawAggregate's E and I alone (what the mix search reads), by the same expressions, without the readout parts. */
function rawEI(w: TimelineWorld, G: number, fpt: number, staffCap: number, f: number, C: number): { E: number; I: number } {
  const P = w.prod;
  const k = labConst(w, G, fpt, staffCap);
  const { H, S, units } = k;
  const cExp = Math.max(0, f) * C;
  const kAg = Math.max(0, 1 - f) * C;
  const c = Math.max(1e-12, (cExp * PHI_FLOP_PER_H100E_DAY) / units / C_UNIT_FLOP_PER_DAY);
  const aiFte = kAg * AGENT_EXP * k.fte;
  const L = effLabour(P, k.a, H, aiFte / WORK_TYPES.EXP.heads, k.assist);
  const l = Math.pow(Math.max(1e-12, L / H), P.lam);
  const X = Xces(P, c, l);
  const LI = effLabour(P, k.aI, S, (kAg * AGENT_IDEAS * k.fte) / WORK_TYPES.IDEAS.heads, k.assistI);
  const taste = kAg > 0 ? k.taste : 1;
  return { E: X * units * taste, I: Math.pow(LI, P.lam) * taste * taste };
}
/** The parts of the aggregate that do not depend on the research mix (one entry memoised: the mix search asks 26 times). */
let constMemo: { w: TimelineWorld; G: number; fpt: number; staff: number; x: ReturnType<typeof labConstOf> } | undefined;
function labConst(w: TimelineWorld, G: number, fpt: number, staff: number) {
  const m = constMemo;
  if (m && m.w === w && m.G === G && m.fpt === fpt && m.staff === staff) return m.x;
  const x = labConstOf(w, G, fpt, staff);
  constMemo = { w, G, fpt, staff, x };
  return x;
}
function labConstOf(w: TimelineWorld, G: number, fpt: number, staffCap: number) {
  const H = Math.max(1e-6, staffCap * RE_PER_HEAD);
  const S = Math.max(1e-6, staffCap * SCI_PER_HEAD);
  const h50 = H50_V0_MIN * Math.pow(H50_PER_OOM, G - gV0(w));
  const sdAI = Math.min(SD_AI_MAX, sdAIOf(w, G));
  return {
    H, S, units: H / RE_UNIT, fte: fteOfFpt(fpt),
    a: coverage(w, 'EXP', G, h50), assist: assistOf(winRate(w, 'EXP', G)),
    aI: coverage(w, 'IDEAS', G, h50), assistI: assistOf(winRate(w, 'IDEAS', G)),
    sdAI, taste: teamTaste(0, sdAI, 1, w.prod.m2b),
  };
}
/** The aggregate research function on its inputs (model G and FLOP per token, capabilities staff, research compute and
 *  its experiment share f), normalised to the leader lab's day-0 lab, × efficiency and modifiers. */
export function evalAggregate(w: TimelineWorld, G: number, fpt: number, staffCap: number, f: number, C: number, eff: number, mods: number): RivalResearch {
  const x = rawAggregate(w, G, fpt, staffCap, f, C);
  const z = day0Of(w);
  const k = eff * mods;
  const E = (x.E / z.E) * k;
  const I = (x.I / z.I) * k;
  return { ...x, E, I, rs: Math.min(E, I), rsHuman: Math.min((x.Eh / z.E) * k, (x.Ih / z.I) * k) };
}

/** Best experiments share of the research compute (golden section on research speed), as the player's auto mix. */
export function bestRivalMix(w: TimelineWorld, G: number, fpt: number, staffCap: number, C: number): number {
  const fx = (x: number) => {
    const r = rawEI(w, G, fpt, staffCap, x, C);
    const z = day0Of(w);
    return Math.min(r.E / z.E, r.I / z.I);
  };
  const g = (Math.sqrt(5) - 1) / 2;
  let lo = 0.01;
  let hi = 0.99;
  let x1 = hi - g * (hi - lo);
  let x2 = lo + g * (hi - lo);
  let f1 = fx(x1);
  let f2 = fx(x2);
  // 16 steps: the share to ±0.001 (P2-style budget; the player's search takes 24).
  for (let i = 0; i < 16; i++) {
    if (f1 < f2) { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = fx(x2); }
    else { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = fx(x1); }
  }
  return (lo + hi) / 2;
}

/** The leader lab's day-0 lab (V0 on B0, 2,050 capabilities staff, the day-0 experiment and agent compute DAY0_REF at the
 *  day-0 mix): its raw experiment and ideation rates, the unit of rs. The recipe grows at RECIPE_RATE0 there. */
const day0Memo = new WeakMap<TimelineWorld, { E: number; I: number }>();
function day0Of(w: TimelineWorld): { E: number; I: number } {
  const hit = day0Memo.get(w);
  if (hit) return hit;
  const cExp = DAY0_REF.flop / PHI_FLOP_PER_H100E_DAY;
  const C = cExp + DAY0_REF.agents;
  const x = rawAggregate(w, gV0(w), 2 * B0_PARAMS * SHAPE.moe.tokenMult, H_REF_BASE, cExp / C, C);
  const out = { E: x.E, I: x.I };
  day0Memo.set(w, out);
  return out;
}

/** Growth of a recipe today (per year) at research speed `rs`: each part's pool grows a_p·rs·10^(−S_p/(w_p·r)) at test
 *  scale (AIFM's software law on the part's returns, the player's line pools); the pretraining part realises ×κ_pre
 *  (at most RECIPE_RATE_MAX), the RL parts as is. `g` = the G-equivalent's growth (OOM/yr; the RL parts through the
 *  reference RL run, so it saturates). */
export interface RecipeRates { pool: RivalRecipe; rec: RivalRecipe; g: number }
export function recipeRates(w: TimelineWorld, ph: Pick<RivalPhys, 'rec' | 'pool'>, rs: number): RecipeRates {
  const P = recipeParts();
  const r = w.v3.r;
  const grow = (p: Part) => P[p].a * Math.max(0, rs) * Math.pow(10, -ph.pool[p] / Math.max(1e-9, P[p].w * r));
  const pre = Math.min(RECIPE_RATE_MAX, P.pre.kappa * grow('pre'));
  const pool = { pre: pre / P.pre.kappa, mid: Math.min(RECIPE_RATE_MAX, grow('mid')), ceil: Math.min(RECIPE_RATE_MAX, grow('ceil')) };
  const rec = { pre, mid: pool.mid * P.mid.kappa, ceil: pool.ceil * P.ceil.kappa };
  const h = 1 / 365;
  const at = (k: number) => gEquivOfRecipe({ pre: ph.rec.pre + k * rec.pre, mid: ph.rec.mid + k * rec.mid, ceil: ph.rec.ceil + k * rec.ceil });
  return { pool, rec, g: (at(h) - at(0)) / h };
}
/** G-equivalent recipe growth of lab `r` today (OOM per year) at research speed `rs`. */
export const recipeRate = (s: GameStateV2, r: Pick<RivalLab, 'phys'>, rs: number) => recipeRates(s.hidden.timeline, r.phys, rs).g;
/** Advance lab `r`'s recipe by `dt` years at research speed `rs`. */
export function advanceRecipe(r: Pick<RivalLab, 'phys'>, x: RecipeRates, dt: number) {
  const ph = r.phys;
  for (const p of PARTS) {
    ph.pool[p] += x.pool[p] * dt;
    ph.rec[p] += x.rec[p] * dt;
  }
}

/** A ProductionReadout for a non-player lab from its aggregate research (the lead readers' `rate` = recipe growth in
 *  progress-years a year, as the player's readout; M = research speed with AI ÷ without). */
export function rivalReadout(x: RivalResearch, eRate: number, stage2: boolean, ratios: ProductionReadout['ratios']): ProductionReadout {
  const M = x.rs / Math.max(1e-12, x.rsHuman);
  const one = { humans2: 1, agents2: 1, agents01: 1, exp2: 1, exp05: 1 };
  return {
    M, rate: eRate / B, stage: stage2 ? 2 : 1,
    parts: { base: 1, agents: x.X / Math.max(1e-12, x.Xh), taste: x.taste, other: M / Math.max(1e-12, (x.X / Math.max(1e-12, x.Xh)) * x.taste) },
    elast: { exp: 0, humans: 0, agents: 0, taste: 0, train: 0, data: 0 }, perDollar: { exp: 0, humans: 0, agents: 0 },
    ceilings: { humans: 1, agents: 1, exp: 1 }, binding: 'experiments', label: x.wH > 0.5 ? 'human-bound' : 'compute-bound',
    labor: { A: x.a, aiFTE: x.aiFte, copies: x.copies, speed: x.copies > 0 ? speedOfCopy() : 0, wH: x.wH },
    ratios, Ddata: 1, whatIf: one, sdAI: x.sdAI,
  };
}

// ───────────────────────────── default policy (the rivals' defaults may read the reference path, MODEL-V3 §13) ─────────────────────────────

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

// ───────────────────────────── training ─────────────────────────────

/** Training FLOP a day of a lab's base run: BASE_POOL_SHARE of its training pool at the reference MFU and goodput. */
export const baseFlopPerDay = (r: Pick<RivalLab, 'core'>) => r.core.computeOnline * r.core.split.training * BASE_POOL_SHARE * PHI_FLOP_PER_H100E_DAY * GOODPUT;

/** One day of the lab's base run: launch it BASE_RUN_DAYS before the base is due (recipe frozen at launch), add a day of
 *  FLOP. */
export function trainDay(_s: GameStateV2, r: RivalLab, day: number) {
  const ph = r.phys;
  if (!ph.run && day >= r.nextBaseDay - BASE_RUN_DAYS) ph.run = { day, flop: 0, ePre: ph.rec.pre };
  if (ph.run) ph.run.flop += baseFlopPerDay(r);
}

// ───────────────────────────── start state ─────────────────────────────

/** Physical start state of a non-player lab whose start internal model sits at its G (rivals.ts initialRival,
 *  initialLeaderLab, china.ts initialChina). Its last base is the reference start base B0 (≈ 354B active × 400 tokens per
 *  parameter, 3e26 FLOP: research/12 §0.3's 2025 frontier) scaled by the lab's training pool over the leader's day-0 pool
 *  (1e6 H100e × 40%), trained on B0's dates (launched day B0_START_DAY, finished B0_DAY), so its recipe is that many days
 *  of the lab's own recipe growth staler than today's (`effRun`: the run-time efficiency multiplier, effLab for China;
 *  undefined for the leader lab); the internal version was post-trained on its own day. A follower starts `k` behind in
 *  the pretraining and RL-efficiency parts (as the player's follower stacks, stacks.ts initialStacks) and k back on
 *  those research pools; k is solved so that version is the start model. The leader lab (B0 itself, V0) starts at k = 0,
 *  the leader's day-0 recipe, with B0's vintage solved so its start version is V0. The public model: the same base,
 *  publicGapY progress-years lower; the run toward the next base is already under way. */
export function initRivalPhys(w: TimelineWorld, r: RivalLab, eff = 1, publicGapY = START_PUBLIC_GAP_Y, effRun?: number) {
  const pool = r.core.computeOnline * r.core.split.training;
  const flop0 = Math.max(1e24, START_BASE_FLOP * (pool / LEADER_DAY0_TRAIN));
  const G0 = r.internal.G;
  // Staleness of the start base's and start version's recipes: the days since their launch × the lab's own day-0 growth
  // of each part (model v3 F2; the pools are fresh at the start, so the rates do not depend on k). F1 used the leader's
  // rate for every lab, which made a slow follower's start base too stale and its first new base too good (DeepCent above
  // V0 on day 75: ws4 T3 −103 d).
  let rs = 1;
  if (effRun !== undefined) {
    const fpt = fptOfBase({ params: baseParams(flop0, REF_TPP) });
    const res = r.core.split.experiments + r.core.split.agents;
    const C = r.core.computeOnline * res;
    const f = bestRivalMix(w, G0, fpt, r.core.staff.cap, C);
    rs = evalAggregate(w, G0, fpt, r.core.staff.cap, f, C, eff * effRun, 1).rs;
  }
  const P = recipeParts();
  const dPost = Math.max(0, -r.internal.day) / 365;
  const dPre = -B0_START_DAY / 365;
  // A lab k behind sits k back on the same research pools (it has done less research: its next ideas come easier, as on
  // F1's one-part law), so its start rates depend on k: solved together (a few fixed-point steps).
  const poolAt = (k: number) => ({ pre: k / P.pre.kappa, mid: k / P.mid.kappa, ceil: 0 });
  const ratesAt = (k: number) => recipeRates(w, { rec: { pre: k, mid: k, ceil: 0 }, pool: poolAt(k) }, rs).rec;
  // The start version at lag k and staleness multiplier m (m = 1: the days since launch × today's rates).
  const at = (k: number, v: RivalRecipe, m: number) => versionG(makeBase(1, B0_DAY, flop0, k - m * v.pre * dPre, REF_TPP), k - m * v.mid * dPost, -m * v.ceil * dPost);
  const bisect = (f: (x: number) => number, lo: number, hi: number) => {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let k = 0;
  let m = 1;
  let v = ratesAt(0);
  if (effRun === undefined && at(0, v, 0) >= G0) {
    // The leader lab is the reference lab on B0 itself: its recipe today is the leader's day-0 recipe (k = 0, the zero of
    // the recipe) and B0's vintage is what makes its start version V0 (the pre-game growth over B0's age, solved).
    m = bisect((x) => G0 - at(0, v, x), 0, 20);
  } else {
    for (let i = 0; i < 5; i++) {
      v = ratesAt(k);
      const vi = v;
      k = bisect((x) => at(x, vi, 1) - G0, -8, 6);
    }
  }
  const base = makeBase(1, B0_DAY, flop0, k - m * v.pre * dPre, REF_TPP);
  r.phys = { base, eff, serve: 0, rec: { pre: k, mid: k, ceil: 0 }, pool: poolAt(k) };
  setModelG(w, r.internal, versionG(base, k - m * v.mid * dPost, -m * v.ceil * dPost), base);
  if (r.publicModel) setModelG(w, r.publicModel, gOfSimple(w, r.internal) - publicGapY * B, base);
  const start = r.nextBaseDay - BASE_RUN_DAYS;
  if (start < 0) r.phys.run = { day: start, flop: -start * baseFlopPerDay(r), ePre: k + (m * v.pre * start) / 365 };
}
/** The reference start base's FLOP (B0) and the leader's day-0 training pool (DAY0_REF's 1e6 H100e × the 2025 training
 *  share 0.4) it was sized on. */
const START_BASE_FLOP = flopOfDesign(REFERENCE_BASE);
const LEADER_DAY0_TRAIN = 1e6 * 0.4;

/** Physical state for a lab from a save before rev 27 (core/save.ts): its recipe e (OOM, all in the pretraining part,
 *  fresh pools; the save migration converts its old know-how), a base sized by its training pool under which its
 *  internal model (at G) sits (G_pre = G − RL gain), its models' designs from that base (the public model at gPub). */
export function migrateRivalPhys(w: TimelineWorld, r: RivalLab, e: number, G: number, gPub: number | undefined, eff = 1) {
  const flop = Math.max(1e24, r.core.computeOnline * r.core.split.training * BASE_POOL_SHARE * PHI_FLOP_PER_H100E_DAY * GOODPUT * BASE_RUN_DAYS);
  const b = makeBase(1, r.internal.day, flop, e);
  b.gPre = G - rlOnBase(flop);
  r.phys = { base: b, eff, serve: 0, rec: { pre: e, mid: 0, ceil: 0 }, pool: { pre: 0, mid: 0, ceil: 0 } };
  setModelG(w, r.internal, G, b);
  if (r.publicModel && gPub !== undefined) setModelG(w, r.publicModel, gPub, b);
}
/** rev 29 → 30 (model v3 F2): a lab's one-number recipe e (OOM; the save migration converts its old know-how) becomes the
 *  pretraining part (the RL parts at the leader's day-0 recipe, fresh pools). */
export function migrateRivalRecipe(r: RivalLab, e: number) {
  if (r.phys.rec) return;
  r.phys.rec = { pre: e, mid: 0, ceil: 0 };
  r.phys.pool = { pre: 0, mid: 0, ceil: 0 };
}

// ───────────────────────────── versions (WS4's cadence calls these) ─────────────────────────────

/** The base the lab's run produced today (undefined without a run): FLOP so far, recipe frozen at launch. */
export function finishRun(r: RivalLab, day: number): RivalBase | undefined {
  const run = r.phys.run;
  delete r.phys.run;
  if (!run || run.flop <= 0) return undefined;
  return makeBase(r.phys.base.gen + 1, day, run.flop, run.ePre);
}

/** Continual learning: is the lab's internal model past the Research-agent level? */
export const learnsOnline = (w: TimelineWorld, r: RivalLab) => levelOfG(w, gOfSimple(w, r.internal)) >= CL_LEVEL;
/** G of a new version on `base` today (a post-training run; the continual learner's refresh once it learns online). */
export function newVersionG(s: GameStateV2, r: RivalLab, base: RivalBase): number {
  return learnsOnline(s.hidden.timeline, r) ? clG(base, r.phys.rec) : postG(base, r.phys.rec);
}
/** Weekly continual-learning refresh of the internal model in place (never down). Returns true if it moved. */
export function clRefresh(s: GameStateV2, r: RivalLab, day: number): boolean {
  const w = s.hidden.timeline;
  if (!learnsOnline(w, r) || day - (r.phys.clDay ?? -1e9) < CL_DAYS) return false;
  r.phys.clDay = day;
  const G = clG(r.phys.base, r.phys.rec);
  if (G <= gOfSimple(w, r.internal) + 1e-12) return false;
  setModelG(w, r.internal, G, r.phys.base);
  return true;
}
