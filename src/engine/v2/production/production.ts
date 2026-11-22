// Production readouts, the rivals' daily research step, knowledge diffusion to the player and the daily data accruals
// (production system). Owner: WS1.
//
// The player (model v3 V3: design/V3-BUILD.md V3.4): research speed comes from each project's explicit compute and
// labour (models/research.ts, the AI Futures experiment CES at project level) and AI labour per work type
// (departments/workfit.ts). For the player this file builds only the READOUT in the v2 shape (ProductionReadout) from the
// same mechanics (and the Auto research mix, applyBestMix): M = the research speed of the lab ÷ the same lab with no AI
// labour (AIFM's AI R&D multiplier, research/13 §2.8) at today's resources, its decomposition, elasticities, what-ifs and
// ceilings, and `rate` = the stacks' recent growth in progress-years. M is still read by gov, the record, the tutorial
// act (models/capability.ts) and the rolled safety nodes (models/tree.ts researchSpeed), until RD-R01 / RD-R04 (SYNTHESIS
// §6 Phase 3); `rate` by the lead readers until RD-L03 (Phase 2).
// Its inputs are in fixed physical units (the leader lab's day-0 inputs = 1): h research engineers on research, k agent
// compute, c experiment compute.
//
// Rivals, China and the leader lab (model v3 F1): the same experiment CES at aggregate level with their own models' AI
// labour; their recipe grows with the world's returns r (actors/rivalModel.ts). This file advances it daily
// (rivalResearch). v2's knot production function is gone (RD-C01); the shared CES maths is in ces.ts.
import { CHINA_CAL, K_DIFFUSION, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { B_G_PER_Y } from '../../../data/v2/runDesign';
import { C_UNIT_FLOP_PER_DAY, DAY0_REF, RE_UNIT } from '../../../data/v2/workTypes';
import { CHINA_PRESETS } from '../../../data/actors';
import { decimalYear } from '../core/time';
import { CHINA_ID, LEADER_ID, PLAYER_ID, bestG, labCore, otherLabs, rivalLab } from '../models/labs';
import { advanceRecipe, bestRivalMix, evalRival, gOfSimple, recipeRates, rivalAgentFpt, rivalReadout, serveRate } from '../actors/rivalModel';
import { addKnowledge, trainNow } from '../models/stacks';
import { poolsOf } from '../compute/power';
import { rivalSpeedMult } from '../actors/rivals';
import { deliverData, syntheticAccrual, usageAccrual } from './data';
import { spareServingToResearch } from '../worldfx/revenue';
import { Phi, Xces } from './ces';
import { effLabour, qualityZ, researchMods, resetWorkContext, speedOfCopy, starTaste, teamTaste, workContext } from '../departments/workfit';
import { capReCapacity, reAllocation } from '../models/research';
import { idleTrainingShare } from '../models/runs';
import { adopted } from '../models/paradigms';
import { payoffOf } from '../models/tree';
import type { EngineSystem, GameStateV2, LabId, ProductionReadout, RivalLab, TimelineWorld } from '../types';

/** The player's research inputs (model v3 V3) as of today: what the readout needs to re-evaluate research speed at other
 *  h, k, c. Absent for the other labs. */
export interface V3Inputs {
  /** Today's h and k (the ratios the what-ifs scale from). */
  h0: number; k0: number;
  /** Research engineers on research (experiments + tuning) and all capabilities research engineers (team-eq). */
  reRes0: number; H0: number;
  /** AI labour in experiments at today's agent compute (team-eq), coverage, assist. */
  AI0: number; a: number; assist: number;
  /** Experiment FLOP efficiency per H100e-day of the pool vs 3.46e19 FLOP (training throughput stack × P13). */
  flopEff: number;
  /** Capacity-weighted taste of the capabilities science teams with and without AI (research input per idea). */
  Tai: number; Th: number;
  /** Speed modifiers inside M (siloing, migrations) and on the rate (pause, treaty). */
  mods: number; rateMult: number;
  /** Readout pieces of the work-type layer. */
  sdAI: number; aEng: number; copies: number; speed: number; aiFte: number;
  /** Software progress of the stacks, OOM per year (smoothed). */
  gRate: number;
  /** The lab has reached its superhuman coder (stage 2 for the readers of `stage`). */
  stage2: boolean;
}

/** Inputs of the player's production readout for one day: h, k, c in fixed physical units (the leader lab's day-0
 *  research engineers on research, agent compute, experiment FLOP = 1). The other labs have none (rivalResearch). */
export interface LabInputs {
  yr: number;
  h: number; k: number; c: number;
  /** c and k this lab would have with all of its research compute (experiments + agents) on experiments / on agents;
   *  C = that research compute (H100e), off = agents switched off. idle = training compute no run uses (H100e, R5) and
   *  spare = serving compute no product needs (H100e, J2 PR1), in c and k units as cIdle and kSpare. */
  mixUnit: { c: number; k: number; C: number; off: boolean; idle?: number; cIdle?: number; spare?: number; kSpare?: number };
  mods: number;
  rateMult: number;
  abs: { H: number; Cagents: number; Cexp: number; serveCost: number; tcoPerYr: number; staffCostPerYr: number };
  /** Model v3 V3: the player's work-type research inputs. */
  v3: V3Inputs;
}

// ───────────────────────────── the player's research-speed readout (model v3 V3) ─────────────────────────────

interface V3Eval { M: number; X: number; Xh: number; l: number; L: number; H: number; AI: number; cbar: number; wH: number; units: number }

/** Research speed of the player at inputs (h, k, c): a unit project's X(c̄, ℓ) with AI labour (and assist) over the same
 *  lab with humans only (ℓ = 1), × the taste lift, × modifiers. */
function evalV3(w: TimelineWorld, inp: LabInputs): V3Eval {
  const v = inp.v3 as V3Inputs;
  const Pp = w.prod;
  const hs = inp.h / Math.max(1e-12, v.h0);
  const reRes = v.reRes0 * hs;
  const H = Math.max(1e-9, v.H0 * hs);
  const AI = v.AI0 * (inp.k / Math.max(1e-12, v.k0));
  const units = Math.max(1e-9, reRes / RE_UNIT);
  const cbar = Math.max(1e-12, (inp.c * DAY0_REF.flop * v.flopEff) / units / C_UNIT_FLOP_PER_DAY);
  const L = effLabour(Pp, v.a, H, AI, v.assist);
  const l = Math.pow(Math.max(1e-12, L / H), Pp.lam);
  const X = Xces(Pp, cbar, l);
  const Xh = Xces(Pp, cbar, 1);
  const hh = H * v.assist;
  const wH = v.a >= 1 - 1e-12 ? 0 : v.a <= 1e-9 ? 1 : (Math.pow(1 - v.a, 1 - Pp.rc) * Math.pow(hh, Pp.rc)) / Math.pow(L, Pp.rc);
  const M = (X / Xh) * (v.Tai / Math.max(1e-12, v.Th)) * v.mods;
  return { M, X, Xh, l, L, H, AI, cbar, wH, units };
}

/** evalV3(w, inputsAtMix(inp, f)).X without the rest of the evaluation or the input copies (P2: the mix search calls
 *  it 26 times a day). Same expressions as evalV3 and inputsAtMix, so the same value. */
function xAtMix(w: TimelineWorld, inp: LabInputs, f: number): number {
  const v = inp.v3 as V3Inputs;
  const u = inp.mixUnit;
  const c = f * u.c + (u.cIdle ?? 0);
  const k = (1 - f) * u.k + (u.kSpare ?? 0);
  const Pp = w.prod;
  const hs = inp.h / Math.max(1e-12, v.h0);
  const reRes = v.reRes0 * hs;
  const H = Math.max(1e-9, v.H0 * hs);
  const AI = v.AI0 * (k / Math.max(1e-12, v.k0));
  const units = Math.max(1e-9, reRes / RE_UNIT);
  const cbar = Math.max(1e-12, (c * DAY0_REF.flop * v.flopEff) / units / C_UNIT_FLOP_PER_DAY);
  const L = effLabour(Pp, v.a, H, AI, v.assist);
  const l = Math.pow(Math.max(1e-12, L / H), Pp.lam);
  return Xces(Pp, cbar, l);
}

/** The player's inputs today (model v3 V3). */
function playerInputs(s: GameStateV2, day: number): LabInputs {
  const p = s.player;
  const w = s.hidden.timeline;
  const yr = decimalYear(s, day);
  const wc = workContext(s);
  const ex = wc.slots.EXP;
  const pools = poolsOf(s);
  const mod = researchMods(s);
  const off = Number(s.flags['ws4:agentsOffUntil'] ?? -1) > day;
  const alloc = reAllocation(s);
  const reRes = alloc.re.exp + alloc.re.tune;
  const Cag = off ? 0 : pools.agents;
  const spare = off ? 0 : spareServingToResearch(s);
  const idle = p.policies.spareTraining !== 'data' ? idleTrainingShare(s) * pools.training : 0;
  const flopEff = Math.pow(10, trainNow(s)) * (adopted(s, 'P13') ? 1 + 0.5 * payoffOf(s, 'P13') : 1);
  const kUnit = 1 / DAY0_REF.agents;
  const cUnit = PHI_FLOP_PER_H100E_DAY / DAY0_REF.flop;
  const k = (Cag + spare) * kUnit;
  const c = (pools.experiments + idle) * cUnit;
  const h = reRes / DAY0_REF.re;
  // Taste: capacity-weighted over the capabilities science teams (a Strong team without AI = 1).
  const m2b = w.prod.m2b;
  const star = starTaste(s);
  let cap = 0;
  let tai = 0;
  let th = 0;
  for (const t of p.teams) {
    if (t.role !== 'sci' || t.dept !== 'cap') continue;
    cap += t.heads;
    tai += t.heads * teamTaste(qualityZ(t.quality), wc.sdAI, wc.phi, m2b, star);
    th += t.heads * teamTaste(qualityZ(t.quality), wc.sdAI, 0, m2b, star);
  }
  const v3: V3Inputs = {
    h0: h, k0: k, reRes0: reRes, H0: Math.max(1e-9, capReCapacity(s) * mod.humans), AI0: Cag + spare > 0 ? ex.AI : 0, a: ex.fit.a, assist: ex.fit.assist,
    flopEff, Tai: cap > 0 ? tai / cap : 1, Th: cap > 0 ? th / cap : 1, mods: mod.speed / mod.rateMult, rateMult: mod.rateMult,
    sdAI: wc.sdAI, aEng: wc.slots.SWE.fit.a, copies: ex.copies + wc.slots.IDEAS.copies, speed: ex.copies > 0 ? speedOfCopy() : 0, aiFte: ex.aiFte,
    gRate: (p.research.gRate ?? 0) * 365, stage2: p.milestoneDays[3] !== undefined,
  };
  const Cres = pools.experiments + pools.agents;
  return {
    yr, h, k, c, mods: v3.mods, rateMult: mod.rateMult,
    mixUnit: { c: Cres * cUnit, k: off ? 0 : Cres * kUnit, C: Cres, off, idle, cIdle: idle * cUnit, ...(spare > 0 ? { spare, kSpare: spare * kUnit } : {}) },
    abs: { H: capReCapacity(s) * 100, Cagents: Cag + spare, Cexp: pools.experiments + idle, serveCost: 0.5, tcoPerYr: tcoPerH100eYear(s, yr), staffCostPerYr: 0.8e-3 },
    v3,
  };
}

/** The player's production readout from V3 inputs (same shape as the v2 readout). */
function evalProductionV3(w: TimelineWorld, inp: LabInputs, detail: boolean): ProductionReadout {
  const Pp = w.prod;
  const v = inp.v3 as V3Inputs;
  const e = evalV3(w, inp);
  const stage: 1 | 2 = v.stage2 ? 2 : 1;
  // `rate` (progress-years per year, for the lead readers until RD-L03): the stacks' recent growth ÷ B, at these inputs.
  const e0 = evalV3(w, { ...inp, h: v.h0, k: v.k0 });
  const rate = (v.gRate / B_G_PER_Y) * v.rateMult * (e.M / Math.max(1e-12, e0.M));
  const parts = { agents: e.X / e.Xh, taste: v.Tai / Math.max(1e-12, v.Th), other: v.mods };
  const cT = Pp.u * Math.pow(e.cbar, Pp.zeta * Pp.rho);
  const lT = Pp.v * Math.pow(e.l, Pp.rho);
  const sC = cT / (cT + lT);
  const sL = 1 - sC;
  const elast = {
    exp: Pp.zeta * sC, humans: Pp.lam * sL * e.wH, agents: Pp.lam * sL * (1 - e.wH),
    taste: 1 - Phi(v.sdAI),
  };
  const costExp = Math.max(1e-6, inp.abs.Cexp * inp.abs.tcoPerYr);
  const costHum = Math.max(1e-6, inp.abs.H * inp.abs.staffCostPerYr);
  const costAg = Math.max(1e-6, inp.abs.Cagents * inp.abs.tcoPerYr);
  const perDollar = { exp: elast.exp / costExp, humans: elast.humans / costHum, agents: elast.agents / costAg };
  // What-ifs and ceilings: research speed (M × the human-only CES at those inputs) relative to today's.
  const rs = (x: V3Eval) => x.M * x.Xh * x.units;
  const rs0 = rs(e);
  const at = (o: Partial<Pick<LabInputs, 'h' | 'k' | 'c'>>) => rs(evalV3(w, { ...inp, ...o })) / Math.max(1e-12, rs0);
  const BIG = 1e9;
  const ceilings = detail ? { humans: at({ h: inp.h * BIG }), agents: at({ k: inp.k * BIG }), exp: at({ c: inp.c * BIG }) } : { humans: 1, agents: 1, exp: 1 };
  const whatIf = detail
    ? { humans2: at({ h: inp.h * 2 }), agents2: at({ k: inp.k * 2 }), agents01: at({ k: inp.k * 0.1 }), exp2: at({ c: inp.c * 2 }), exp05: at({ c: inp.c * 0.5 }) }
    : { humans2: 1, agents2: 1, agents01: 1, exp2: 1, exp05: 1 };
  let binding: ProductionReadout['binding'] = 'experiments';
  if (perDollar.humans > perDollar.exp && perDollar.humans >= perDollar.agents) binding = 'humans';
  else if (perDollar.agents > perDollar.exp && perDollar.agents > perDollar.humans) binding = 'agents';
  const tasteShare = Math.log(Math.max(1, parts.taste)) / Math.log(Math.max(1.0001, e.M));
  if (tasteShare > 0.6 && e.M >= 25) binding = 'taste';
  let label: ProductionReadout['label'] = elast.humans + elast.agents > elast.exp ? 'labor-bound' : 'compute-bound';
  if (e.M >= 25 && tasteShare > 0.6) label = 'taste-bound';
  else if (label === 'labor-bound' && e.wH > 0.5) label = 'human-bound';
  return {
    M: e.M, rate, stage, parts, elast, perDollar, ceilings, binding, label,
    labor: { A: v.a, aiFTE: v.aiFte, copies: v.copies, speed: v.speed, wH: e.wH, aEng: v.aEng },
    ratios: { h: inp.h, k: inp.k, c: inp.c },
    whatIf, sdAI: v.sdAI,
  };
}

/** The player's research speed relative to the leader lab's day-0 research (model v3 V3 readout): Σ over unit projects
 *  of X × taste × modifiers, ÷ the leader's day-0 value (≈ 1 at the start). */
export function researchSpeedRel(s: GameStateV2): number {
  const inp = labInputs(s, PLAYER_ID);
  if (!inp) return 1;
  const e = evalV3(s.hidden.timeline, inp);
  return (e.X * e.units * inp.v3.Tai * inp.v3.mods * inp.v3.rateMult) / (DAY0_REF.re / RE_UNIT);
}

/** M and its pieces for a set of inputs (the player's work-type research speed). Pure. */
export function evalM(w: TimelineWorld, inp: LabInputs) {
  const e = evalV3(w, inp);
  return { M: e.M, Mref: e.M, A: inp.v3.a, R: 0, Tref: inp.v3.Tai, tau: 1, sdAI: inp.v3.sdAI, L: e.L, l: e.l, X: e.X, ai: e.AI, norm: 1 };
}

/** Full production readout (§3.2.5). Pure function of the world and inputs. `detail` = false skips the ceilings and
 *  what-ifs (reported as 1 = no change). */
export function evalProduction(w: TimelineWorld, inp: LabInputs, detail = true): ProductionReadout {
  return evalProductionV3(w, inp, detail);
}

// ───────────────────────────── inputs from state ─────────────────────────────

/** Annual TCO of one H100e ($B/yr): market rental when WS3 sets it, else R11's 14k·0.8^t [D]. */
export function tcoPerH100eYear(s: GameStateV2, yr: number): number {
  const r = s.market.rental;
  return r > 0 ? (r * 8760) / 1e9 : (14e3 * Math.pow(0.8, yr - 2025.5)) / 1e9;
}

/** eff_lab: 1 for the player and US rivals; China = chinaEfficiency × preset.efficiency × CHINA_CAL.effScale [fit]. */
export function effLab(s: GameStateV2, lab: LabId): number {
  if (lab !== CHINA_ID) return 1;
  return s.hidden.timeline.chinaEfficiency * (CHINA_PRESETS.find((p) => p.id === s.china.preset) ?? CHINA_PRESETS[0]).efficiency * CHINA_CAL.effScale;
}

/** Build the player's production inputs from state on day `day` (default today; model v3 V3). The other labs have none
 *  since model v3 F1: their research is rivalResearch below. */
export function labInputs(s: GameStateV2, lab: LabId, day = s.time.day): LabInputs | undefined {
  if (lab !== PLAYER_ID || !labCore(s, lab)) return undefined;
  return playerInputs(s, day);
}

/** A non-player lab's research today (model v3 F1, actors/rivalModel.ts): the best experiments/agents mix of its research
 *  compute (re-split unless set by hand), research speed through the aggregate CES with its internal model's AI labour,
 *  its efficiency (the leader's LEADER_CAL, China's effLab) and modifiers (a binding leader, a verified treaty), and the
 *  recipe growth that gives. `apply` re-splits the mix and advances the recipe by a day. */
export function rivalResearch(s: GameStateV2, r: RivalLab, apply: boolean): ProductionReadout {
  const w = s.hidden.timeline;
  const core = r.core;
  const G = gOfSimple(w, r.internal);
  const fpt = rivalAgentFpt(r);
  const res = core.split.experiments + core.split.agents;
  const C = core.computeOnline * res;
  let f = res > 0 ? core.split.experiments / res : 0.5;
  if (apply && !core.researchManual && res > 0) {
    f = bestRivalMix(w, G, fpt, core.staff.cap, C);
    core.split.experiments = res * f;
    core.split.agents = res * (1 - f);
  }
  const treaty = s.gov.treaty === 'verified' ? 0.65 : 1;
  const x = evalRival(s, r, f, C, (r.phys?.eff ?? 1) * effLab(s, core.id), rivalSpeedMult(s, core.id) * treaty);
  const rates = recipeRates(w, r.phys, x.rs);
  if (apply) {
    advanceRecipe(r, rates, 1 / 365);
    // D10: the serving stack at aggregate level (the Inference-efficiency line's returns), from the same research speed.
    if (r.phys) r.phys.serve = (r.phys.serve ?? 0) + serveRate(s, r, x.rs) / 365;
  }
  const eRate = rates.g;
  const pools = poolsOf(s, core.id);
  return rivalReadout(x, eRate, core.milestoneDays[3] !== undefined, { h: (x.units * RE_UNIT) / DAY0_REF.re, k: pools.agents / DAY0_REF.agents, c: x.c });
}

/** Spare serving compute lent to research agents (J2 PR1) and what it adds to research speed today (M with it ÷ M
 *  without − 1; the research-speed breakdown). */
export function spareServingEffect(s: GameStateV2): { h100e: number; dM: number } {
  const inp = labInputs(s, PLAYER_ID);
  const ks = inp?.mixUnit.kSpare ?? 0;
  if (!inp || ks <= 0) return { h100e: 0, dM: 0 };
  const w = s.hidden.timeline;
  return { h100e: inp.mixUnit.spare ?? 0, dM: evalM(w, inp).M / Math.max(1e-12, evalM(w, { ...inp, k: Math.max(1e-12, inp.k - ks) }).M) - 1 };
}

/** Production readout for a lab, computed from current state (§3.2.2/§3.2.5; the other labs' from rivalResearch). */
export function computeProduction(s: GameStateV2, lab: LabId): ProductionReadout | undefined {
  if (lab !== PLAYER_ID) {
    const r = rivalLab(s, lab);
    return r ? rivalResearch(s, r, false) : undefined;
  }
  const inp = labInputs(s, lab);
  return inp ? evalProduction(s.hidden.timeline, inp) : undefined;
}

/** Best experiments share of a lab's research compute (experiments + agents) for its current inputs: the player's by
 *  golden-section search on its experiment throughput (model v3 V3). */
export function bestResearchMix(s: GameStateV2, inp: LabInputs): number {
  const w = s.hidden.timeline;
  const f = (x: number) => xAtMix(w, inp, x);
  const g = (Math.sqrt(5) - 1) / 2;
  let lo = 0.01;
  let hi = 0.99;
  let x1 = hi - g * (hi - lo);
  let x2 = lo + g * (hi - lo);
  let f1 = f(x1);
  let f2 = f(x2);
  for (let i = 0; i < 24; i++) {
    if (f1 < f2) { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = f(x2); }
    else { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = f(x1); }
  }
  return (lo + hi) / 2;
}

/** Inputs with the research compute re-split at experiments share f (same total). */
export function inputsAtMix(inp: LabInputs, f: number): LabInputs {
  const u = inp.mixUnit;
  return { ...inp, c: f * u.c + (u.cIdle ?? 0), k: (1 - f) * u.k + (u.kSpare ?? 0), abs: { ...inp.abs, Cexp: f * u.C + (u.idle ?? 0), Cagents: u.off ? 0 : (1 - f) * u.C + (u.spare ?? 0) } };
}

/** Re-split a lab's research share between experiments and agents in the best way (auto mix; the player can switch
 *  to a manual mix). Keeps experiments + agents unchanged. Returns the inputs at the new mix (or `inp` unchanged). */
export function applyBestMix(s: GameStateV2, lab: LabId, day = s.time.day, inp = labInputs(s, lab, day)): LabInputs | undefined {
  const core = labCore(s, lab);
  if (!core || !inp || core.researchManual) return inp;
  const r = core.split.experiments + core.split.agents;
  if (r <= 0) return inp;
  const f = bestResearchMix(s, inp);
  core.split.experiments = r * f;
  core.split.agents = r * (1 - f);
  if (lab === PLAYER_ID) resetWorkContext(s); // the agent compute changed: today's AI labour follows it
  return inputsAtMix(inp, f);
}

/** One lab's day: the player's readout at day−1 inputs (its research runs in models/research.ts; the readout is cached
 *  here); a non-player lab's research advances its recipe (rivalResearch). */
export function advanceLab(s: GameStateV2, lab: LabId): ProductionReadout | undefined {
  const core = labCore(s, lab);
  if (!core || core.status !== 'active') return undefined;
  if (lab !== PLAYER_ID) {
    const r = rivalLab(s, lab);
    return r ? (core.prodCache = rivalResearch(s, r, true)) : undefined;
  }
  const inp = applyBestMix(s, lab, s.time.day - 1);
  if (!inp) return undefined;
  const r = evalProduction(s.hidden.timeline, inp, true);
  core.prodCache = r;
  return r;
}

/** Knowledge diffusion to the player (R9; data/v2/calibration.ts K_DIFFUSION): K × (the frontier leader lab's public
 *  model's G − the player's best model's G) OOM per year while positive. */
export function diffusionPerDay(s: GameStateV2): { dG: number; from?: string } {
  const L = s.rivals.find((r) => r.core.id === LEADER_ID);
  const pub = L && L.core.status === 'active' ? L.publicModel?.G : undefined;
  const own = bestG(s, PLAYER_ID);
  if (pub === undefined || !Number.isFinite(own)) return { dG: 0 };
  const gap = pub - own;
  return gap > 0 ? { dG: (K_DIFFUSION * gap) / 365, from: L!.core.name } : { dG: 0 };
}

/** production (30, daily): readouts for the player, rivals and China; rivals' and China's know-how grows (§3.2). */
export const productionSystem: EngineSystem = {
  id: 'production', owner: 'WS1', cadence: 'daily', order: 30, system: 'research',
  run(s, ctx) {
    const r = advanceLab(s, PLAYER_ID);
    if (r) {
      const dif = diffusionPerDay(s);
      if (dif.dG > 0) addKnowledge(s, ctx, dif.dG, 'knowledge diffusion', dif.from);
      ctx.memo.set('WS1:production:player', r);
      deliverData(s, ctx);
      syntheticAccrual(s);
      usageAccrual(s);
    }
    for (const lab of otherLabs(s)) {
      const rr = advanceLab(s, lab.core.id);
      if (rr) ctx.memo.set(`WS1:production:${lab.core.id}`, rr);
    }
  },
};
