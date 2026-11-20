// Rivals, China and the simulated leader lab in effective compute (model v3 F1: design/MODEL-V3.md §12, §13;
// design/notes/F1.md). Owner: WS1 (capability) / WS4 (behaviour). Data: src/data/v2/rivalModel.ts.
//
// A non-player lab is the player's model at aggregate level, without ideas or a blueprint:
//   recipe     e (OOM over the leader's day-0 recipe; stored as core.pa = pa_ref + e/B, the player's know-how relation)
//              de/dt = RECIPE_RATE0 · RS/RS₀ · 10^(−e/r)  — AIFM's software law with the world's returns r: each OOM of
//              recipe needs 10^(1/r) more cumulative research input (the player's line pools, research.ts linePool)
//   research   RS = X(c̄, ℓ)·units·taste·eff·mods ÷ the leader's day-0 value: the player's experiment CES at aggregate
//              level (production.ts evalV3) — experiment compute per unit of research engineers, effective labour from the
//              lab's own internal model on Experiments (coverage, AI FTE from its compute and FLOP per token, the coding
//              CES), AI taste from its fit on Research ideas (workfit.ts teamTaste)
//   training   one base run after another on BASE_POOL_SHARE of the training pool for BASE_RUN_DAYS, released on the
//              archetype cadence (rivals.ts BASE_MONTHS): G_pre = log₁₀(FLOP) + E_START + (1 − RL_SHARE)·e at launch +
//              the shape terms (effective.ts gPreOf); N_active = √(FLOP/(6·tpp)), FLOP per token 2·N_active
//   versions   post-training every 6–10 weeks: G = G_pre + the reference RL gain on the base (the RL curve, stacks.ts
//              refRlGain) + RL_SHARE·e at launch; from the Research-agent level the internal model re-applies today's
//              recipe weekly (continual learning, as the player's P08 stream)
// Nothing here reads a calendar path, pm thresholds, CAL_SHIFT, the v2 knots or the rivals' old FLOP bridge.
import { BASE_POOL_SHARE, BASE_RUN_DAYS, CL_DAYS, CL_LEVEL, RECIPE_RATE0, RIVAL_TPP, RL_SHARE, START_PUBLIC_GAP_Y } from '../../../data/v2/rivalModel';
import { B_G_PER_Y, E_START, GOODPUT, PARAM_RANGE, B0_PARAMS, REFERENCE_BASE, REF_TPP, SHAPE } from '../../../data/v2/runDesign';
import { B0_DAY, B0_START_DAY, H_REF_BASE, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { C_UNIT_FLOP_PER_DAY, DAY0_REF, H50_PER_OOM, H50_V0_MIN, RE_UNIT, WORK_TYPES } from '../../../data/v2/workTypes';
import { clamp } from '../../rng';
import { domainsOf, gOfPm, gV0, levelOf, levelOfG, paRef, pmOfG } from '../models/capability';
import { flopOfDesign, gPreOf, paramsForFlop } from '../models/effective';
import { refRlGain } from '../models/stacks';
import { assistOf, copiesOf, coverage, effLabour, fteOfFpt, sdAIOf, speedOfCopy, teamTaste, winRate } from '../departments/workfit';
import { Xces, hRef } from '../production/knots';
import { normalizeSplit, shareRefAt } from '../departments/split';
import { decimalYear } from '../core/time';
import { DEFAULT_CAP_SHARES } from '../../../data/v2/agents';
import type { GameStateV2, ProductionReadout, RivalBase, RivalLab, SimpleModel, TimelineWorld } from '../types';

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

/** The lab's recipe efficiency e (OOM over the leader's day-0 recipe). */
export const recipeOf = (s: GameStateV2, r: RivalLab) => B * (r.core.pa - paRef(s.hidden.timeline));
/** Know-how pa of recipe e (the stored unit). */
export const paOfRecipe = (w: TimelineWorld, e: number) => paRef(w) + e / B;

/** G_pre of a rival base: training FLOP, tokens per parameter, pretraining recipe at launch (MoE, no repetition). */
export const baseGPre = (flop: number, tpp: number, ePre: number) =>
  gPreOf({ flop, tpp, recipe: E_START + ePre, shape: 'moe', fData: 1, designDg: 0 }).total;
/** Active parameters of a compute-optimal-ish base of `flop` at `tpp` tokens per parameter. */
export const baseParams = (flop: number, tpp = RIVAL_TPP) => clamp(paramsForFlop(flop, tpp), PARAM_RANGE[0], PARAM_RANGE[1]);
/** A finished base. */
export function makeBase(gen: number, day: number, flop: number, ePre: number, tpp = RIVAL_TPP): RivalBase {
  return { gen, day, flop, params: baseParams(flop, tpp), tpp, gPre: baseGPre(flop, tpp, ePre), ePre };
}
/** RL gain of the reference post-training run on a base (the player's RL curve at the reference recipe). */
const rlMemo = new Map<number, number>();
export function rlOnBase(flop: number): number {
  let x = rlMemo.get(flop);
  if (x === undefined) {
    x = refRlGain(flop, 0, 0);
    if (rlMemo.size > 2000) rlMemo.clear();
    rlMemo.set(flop, x);
  }
  return x;
}
/** G of a version post-trained on `base` with RL recipe share eRL (OOM). */
export const versionG = (base: RivalBase, eRL: number) => base.gPre + rlOnBase(base.flop) + eRL;
/** G of a version on `base` at recipe e (post-training embodies the RL share of today's recipe). */
export const postG = (base: RivalBase, e: number) => versionG(base, RL_SHARE * e);
/** G of the continual learner on `base` at recipe e: today's whole recipe re-applied to the base's physical part (the
 *  player's P08 stream semantics, V1 notes), never below the base's own G_pre (a stolen base keeps what it had). */
export const clG = (base: RivalBase, e: number) => Math.max(base.gPre, baseGPre(base.flop, base.tpp, (1 - RL_SHARE) * e)) + rlOnBase(base.flop) + RL_SHARE * e;
/** Serving FLOP per token of a base: 2·N_active × the MoE token multiplier. */
export const fptOfBase = (b: Pick<RivalBase, 'params'>) => 2 * b.params * SHAPE.moe.tokenMult;

/** General effective compute of a SimpleModel (G, or through the display bridge for a model built from pm alone). */
export const gOfSimple = (w: TimelineWorld, m: Pick<SimpleModel, 'G' | 'pm'>) => m.G ?? gOfPm(w, m.pm);
/** FLOP per token of a SimpleModel (its own design; B0's when it has none). */
export const fptOfSimpleModel = (m: Pick<SimpleModel, 'fpt' | 'params'>) => m.fpt ?? 2 * (m.params ?? B0_PARAMS) * SHAPE.moe.tokenMult;
/** Set a SimpleModel's G and its readouts (pm = Φ(G), level, domain levels) and its design from `base`. */
export function setModelG(w: TimelineWorld, m: SimpleModel, G: number, base?: Pick<RivalBase, 'flop' | 'params'>) {
  m.G = G;
  m.pm = pmOfG(w, G);
  m.Lg = levelOf(w, m.pm);
  m.domains = domainsOf(w, m.pm);
  if (base) {
    m.flop = base.flop;
    m.params = base.params;
    m.fpt = fptOfBase(base);
  }
}
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
export function evalRival(s: GameStateV2, r: Pick<RivalLab, 'internal' | 'core'>, f: number, C: number, eff: number, mods: number): RivalResearch {
  const w = s.hidden.timeline;
  return evalAggregate(w, gOfSimple(w, r.internal), fptOfSimpleModel(r.internal), r.core.staff.cap, f, C, eff, mods);
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
    const r = rawAggregate(w, G, fpt, staffCap, x, C);
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

/** Recipe growth of lab `r` today (OOM per year) at research speed `rs` (AIFM's software law with the world's r). */
export const recipeRate = (s: GameStateV2, r: RivalLab, rs: number) =>
  Math.min(RECIPE_RATE_MAX, RECIPE_RATE0 * rs * Math.pow(10, -recipeOf(s, r) / s.hidden.timeline.v3.r));

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
export function trainDay(s: GameStateV2, r: RivalLab, day: number) {
  const ph = r.phys;
  if (!ph.run && day >= r.nextBaseDay - BASE_RUN_DAYS) ph.run = { day, flop: 0, ePre: (1 - RL_SHARE) * recipeOf(s, r) };
  if (ph.run) ph.run.flop += baseFlopPerDay(r);
}

// ───────────────────────────── start state ─────────────────────────────

/** Physical start state of a non-player lab whose start internal model sits at its pm (rivals.ts initialRival,
 *  initialLeaderLab, china.ts initialChina). Its last base is the reference start base B0 (1T active × 50 tokens per
 *  parameter, 3e26 FLOP: research/12 §0.3's 2025 frontier) scaled by the lab's training pool over the leader's day-0 pool
 *  (1e6 H100e × 40%), trained on B0's dates (launched day B0_START_DAY, finished B0_DAY), so its recipe is that many days
 *  of the lab's own recipe growth staler than today's (`effRun`: the run-time efficiency multiplier, effLab for China;
 *  undefined for the leader lab, which grows at RECIPE_RATE0); the internal version was post-trained on its own day. The
 *  recipe e₀ today is solved so that version is the start model (G is linear in e). For the leader lab (B0 itself, V0)
 *  e₀ ≈ 0: the leader's day-0 recipe, the zero of e. The public model: the same base, publicGapY progress-years lower;
 *  the run toward the next base is already under way. */
export function initRivalPhys(w: TimelineWorld, r: RivalLab, eff = 1, publicGapY = START_PUBLIC_GAP_Y, effRun?: number) {
  const pool = r.core.computeOnline * r.core.split.training;
  const flop0 = Math.max(1e24, START_BASE_FLOP * (pool / LEADER_DAY0_TRAIN));
  const G0 = gOfPm(w, r.internal.pm);
  // Staleness of the start base's and start version's recipes: the days since their launch × the lab's own recipe
  // growth (model v3 F2). The leader lab (effRun undefined) is the reference lab on B0 itself, so it grows at
  // RECIPE_RATE0 and its e₀ is the leader's day-0 recipe; a follower grows at its own day-0 rate (its inputs and
  // efficiency through the aggregate research function), solved with e₀ (the rate falls as 10^(−e/r)). F1 used
  // RECIPE_RATE0 for every lab, which made a slow follower's start base too stale and its first new base too good:
  // DeepCent (≈ 0.34 OOM/yr) then trained a first base above V0 and briefly led the reference lab (ws4 T3, −103 d).
  const solve = (rate: number) => {
    const stalePre = (rate * -B0_START_DAY) / 365;
    const stalePost = (rate * Math.max(0, -r.internal.day)) / 365;
    const at = (e: number) => versionG(makeBase(1, B0_DAY, flop0, (1 - RL_SHARE) * (e - stalePre), REF_TPP), RL_SHARE * (e - stalePost));
    return { e0: G0 - at(0), stalePre, stalePost };
  };
  let x = solve(RECIPE_RATE0);
  let rate = RECIPE_RATE0;
  if (effRun !== undefined) {
    const fpt = fptOfBase({ params: baseParams(flop0, REF_TPP) });
    const res = r.core.split.experiments + r.core.split.agents;
    const C = r.core.computeOnline * res;
    const f = bestRivalMix(w, G0, fpt, r.core.staff.cap, C);
    const rs = evalAggregate(w, G0, fpt, r.core.staff.cap, f, C, eff * effRun, 1).rs;
    for (let i = 0; i < 4; i++) {
      rate = Math.min(RECIPE_RATE_MAX, RECIPE_RATE0 * rs * Math.pow(10, -x.e0 / w.v3.r));
      x = solve(rate);
    }
  }
  const { e0, stalePre, stalePost } = x;
  const base = makeBase(1, B0_DAY, flop0, (1 - RL_SHARE) * (e0 - stalePre), REF_TPP);
  r.core.pa = paOfRecipe(w, e0);
  r.phys = { base, eff };
  setModelG(w, r.internal, versionG(base, RL_SHARE * (e0 - stalePost)), base);
  if (r.publicModel) setModelG(w, r.publicModel, gOfSimple(w, r.internal) - publicGapY * B, base);
  const start = r.nextBaseDay - BASE_RUN_DAYS;
  if (start < 0) r.phys.run = { day: start, flop: -start * baseFlopPerDay(r), ePre: (1 - RL_SHARE) * (e0 + (rate * start) / 365) };
}
/** The reference start base's FLOP (B0) and the leader's day-0 training pool (DAY0_REF's 1e6 H100e × the 2025 training
 *  share 0.4) it was sized on. */
const START_BASE_FLOP = flopOfDesign(REFERENCE_BASE);
const LEADER_DAY0_TRAIN = 1e6 * 0.4;

/** Physical state for a lab from a save before rev 25: its recipe from its know-how, a base sized by its training pool
 *  under which its internal model sits (G_pre = G − RL gain − RL_SHARE·e), its models' designs from that base. */
export function migrateRivalPhys(w: TimelineWorld, r: RivalLab, eff = 1) {
  const e = B * (r.core.pa - paRef(w));
  const flop = Math.max(1e24, r.core.computeOnline * r.core.split.training * BASE_POOL_SHARE * PHI_FLOP_PER_H100E_DAY * GOODPUT * BASE_RUN_DAYS);
  const b = makeBase(1, r.internal.day, flop, (1 - RL_SHARE) * e);
  const G = gOfPm(w, r.internal.pm);
  b.gPre = G - rlOnBase(flop) - RL_SHARE * e;
  r.phys = { base: b, eff };
  setModelG(w, r.internal, G, b);
  if (r.publicModel) setModelG(w, r.publicModel, gOfPm(w, r.publicModel.pm), b);
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
  const e = recipeOf(s, r);
  return learnsOnline(s.hidden.timeline, r) ? clG(base, e) : postG(base, e);
}
/** Weekly continual-learning refresh of the internal model in place (never down). Returns true if it moved. */
export function clRefresh(s: GameStateV2, r: RivalLab, day: number): boolean {
  const w = s.hidden.timeline;
  if (!learnsOnline(w, r) || day - (r.phys.clDay ?? -1e9) < CL_DAYS) return false;
  r.phys.clDay = day;
  const G = clG(r.phys.base, recipeOf(s, r));
  if (G <= gOfSimple(w, r.internal) + 1e-12) return false;
  setModelG(w, r.internal, G, r.phys.base);
  return true;
}
