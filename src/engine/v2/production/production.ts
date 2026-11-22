// Production readouts, the rivals' daily research step, knowledge diffusion to the player and the daily data accruals
// (production system). Owner: WS1.
//
// The player (model v3 V3: design/V3-BUILD.md V3.4): research speed comes from each project's explicit compute and
// labour (models/research.ts, the AI Futures experiment CES at project level) and AI labour per work type
// (departments/workfit.ts). For the player this file builds only the READOUT (ProductionReadout: label, labour, ratios)
// from what that engine did on its last day (research.last). RD-R01: no aggregate AI R&D multiplier M or elasticities
// (evalV3 is gone); gov, the tutorial, P24, the rolled safety nodes, previews and the record read the engine's measured
// quantities or milestones. RD-A02: the Auto research mix is gone (DD-11); the experiments / agents split is the
// player's own setting, and no mechanism reads the aggregate experiment throughput (expThroughput: readouts only).
// Its inputs are in fixed physical units (the leader lab's day-0 inputs = 1): h research engineers on research, k agent
// compute, c experiment compute.
//
// Rivals, China and the leader lab (model v3 F1): the same experiment CES at aggregate level with their own models' AI
// labour; their recipe grows with the world's returns r (actors/rivalModel.ts). This file advances it daily
// (rivalResearch). v2's knot production function is gone (RD-C01); the shared CES maths is in ces.ts.
import { CHINA_CAL, K_DIFFUSION, PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { C_UNIT_FLOP_PER_DAY, DAY0_REF, RE_LABOUR_UNIT } from '../../../data/v2/workTypes';
import { CHINA_PRESETS } from '../../../data/actors';
import { decimalYear } from '../core/time';
import { CHINA_ID, LEADER_ID, PLAYER_ID, bestG, labCore, otherLabs, rivalLab } from '../models/labs';
import { advanceRecipe, bestRivalMix, evalRival, gOfSimple, recipeRates, rivalAgentFpt, rivalReadout, serveRate } from '../actors/rivalModel';
import { addKnowledge, trainNow } from '../models/stacks';
import { poolsOf } from '../compute/power';
import { withResearchAgents } from '../departments/split';
import { rivalSpeedMult } from '../actors/rivals';
import { deliverData, syntheticAccrual, usageAccrual } from './data';
import { spareServingToResearch } from '../worldfx/revenue';
import { Xces } from './ces';
import { effLabour, qualityZ, researchMods, speedOfCopy, starTaste, teamTaste, workContext } from '../departments/workfit';
import { capReCapacity, reAllocation } from '../models/research';
import { idleTrainingShare } from '../models/runs';
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
  /** Experiment FLOP efficiency per H100e-day of the pool vs 3.46e19 FLOP (the training throughput stack). */
  flopEff: number;
  /** Capacity-weighted taste of the capabilities science teams with AI (research input per idea). */
  Tai: number;
  /** Speed modifiers inside M (siloing, migrations) and on the rate (pause, treaty). */
  mods: number; rateMult: number;
  /** Readout pieces of the work-type layer. */
  sdAI: number; aEng: number; copies: number; speed: number; aiFte: number; agentFte: number;
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
  /** Model v3 V3: the player's work-type research inputs. */
  v3: V3Inputs;
}

// ───────────────────────────── the player's experiment throughput (readouts only) ─────────────────────────────

/** RD-R01: the one aggregate piece left, the lab's experiment throughput at inputs (h, k, c): X(c̄, ℓ) of a unit project
 *  and the number of unit projects. READOUTS ONLY since RD-A02 (no mechanism, no Auto mix): the response charts
 *  (readout.ts), labSpeedRel and spareServingEffect. */
function throughputAt(w: TimelineWorld, inp: LabInputs, c: number, k: number, h: number): { X: number; units: number } {
  const v = inp.v3 as V3Inputs;
  const Pp = w.prod;
  const hs = h / Math.max(1e-12, v.h0);
  const reRes = v.reRes0 * hs;
  const H = Math.max(1e-9, v.H0 * hs);
  const AI = v.AI0 * (k / Math.max(1e-12, v.k0));
  const units = Math.max(1e-9, reRes / RE_LABOUR_UNIT);
  const cbar = Math.max(1e-12, (c * DAY0_REF.flop * v.flopEff) / units / C_UNIT_FLOP_PER_DAY);
  const L = effLabour(Pp, v.a, H, AI, v.assist);
  const l = Math.pow(Math.max(1e-12, L / H), Pp.lam);
  return { X: Xces(Pp, cbar, l), units };
}

/** The lab's total experiment throughput (Σ unit projects' X) at inputs, other inputs as in `inp` (readouts only). */
export function expThroughput(w: TimelineWorld, inp: LabInputs, o: Partial<Pick<LabInputs, 'h' | 'k' | 'c'>> = {}): number {
  const t = throughputAt(w, inp, o.c ?? inp.c, o.k ?? inp.k, o.h ?? inp.h);
  return t.X * t.units;
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
  // Research engineers not on run operations or evals (idle ones too): what experiments + tuning held before RD-B08
  // gave tuning a finite demand, so this lab-level proxy and its readers do not move (M goes with RD-R01 / RD-R04).
  const reRes = Math.max(0, alloc.total - alloc.re.ops - alloc.re.evals);
  const Cag = off ? 0 : (pools.routine + pools.frontier);
  const spare = off ? 0 : spareServingToResearch(s);
  const idle = p.policies.spareTraining !== 'data' ? idleTrainingShare(s) * pools.training : 0;
  const flopEff = Math.pow(10, trainNow(s));
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
  for (const t of p.teams) {
    if (t.role !== 'sci' || t.dept !== 'cap') continue;
    cap += t.heads;
    tai += t.heads * teamTaste(qualityZ(t.quality), wc.sdAI, wc.sAI, m2b, star);
  }
  const v3: V3Inputs = {
    h0: h, k0: k, reRes0: reRes, H0: Math.max(1e-9, capReCapacity(s) * mod.humans), AI0: Cag + spare > 0 ? ex.AI : 0, a: ex.fit.a, assist: ex.fit.assist,
    flopEff, Tai: cap > 0 ? tai / cap : 1, mods: mod.speed / mod.rateMult, rateMult: mod.rateMult,
    sdAI: wc.sdAI, aEng: wc.slots.SWE.fit.a, copies: ex.copies + wc.slots.IDEAS.copies, speed: ex.copies > 0 ? speedOfCopy() : 0, aiFte: ex.aiFte,
    agentFte: ex.aiFte + wc.slots.IDEAS.aiFte,
    stage2: p.milestoneDays[3] !== undefined,
  };
  const Cres = pools.experiments + (pools.routine + pools.frontier);
  return {
    yr, h, k, c, mods: v3.mods, rateMult: mod.rateMult,
    mixUnit: { c: Cres * cUnit, k: off ? 0 : Cres * kUnit, C: Cres, off, idle, cIdle: idle * cUnit, ...(spare > 0 ? { spare, kSpare: spare * kUnit } : {}) },
    v3,
  };
}

/** The player's readout from what the research engine did on its last day (RD-R01; research.last.x: the unit project's
 *  experiment compute c, labour ℓ and the AI labour multiplier in experiments m_EXP). wH = the human share of experiment
 *  labour as run (1 ÷ m_EXP); the label compares the experiment CES's compute and labour terms at the engine's c and ℓ
 *  (λ × the labour share vs ζ × the compute share). */
function playerReadout(s: GameStateV2, inp: LabInputs): ProductionReadout {
  const Pp = s.hidden.timeline.prod;
  const v = inp.v3;
  const x = s.player.research.last?.x;
  const wH = 1 / Math.max(1, x?.mExp ?? 1);
  let label: ProductionReadout['label'] = 'compute-bound';
  if (x && x.c > 0) {
    const cT = Pp.u * Math.pow(x.c, Pp.zeta * Pp.rho);
    const lT = Pp.v * Math.pow(Math.max(1e-12, x.l), Pp.rho);
    const sC = cT / (cT + lT);
    if (Pp.lam * (1 - sC) > Pp.zeta * sC) label = wH > 0.5 ? 'human-bound' : 'labor-bound';
  }
  const binding: ProductionReadout['binding'] = label === 'compute-bound' ? 'experiments' : label === 'human-bound' ? 'humans' : 'agents';
  return {
    stage: v.stage2 ? 2 : 1, binding, label,
    labor: { A: v.a, aiFTE: v.aiFte, copies: v.copies, speed: v.speed, wH, aEng: v.aEng, agentFte: v.agentFte },
    ratios: { h: inp.h, k: inp.k, c: inp.c },
    sdAI: v.sdAI,
  };
}

/** The player's research speed relative to the leader lab's day-0 research (the Research speed readout): the lab's
 *  experiment throughput × taste × modifiers, ÷ the leader's day-0 value (≈ 1 at the start). */
export function labSpeedRel(s: GameStateV2): number {
  const inp = labInputs(s, PLAYER_ID);
  if (!inp) return 1;
  return (expThroughput(s.hidden.timeline, inp) * inp.v3.Tai * inp.v3.mods * inp.v3.rateMult) / (DAY0_REF.re / RE_LABOUR_UNIT);
}

/** The player's production readout (§3.2.5) at inputs `inp`, from the research engine's last day. */
export function evalProduction(s: GameStateV2, inp: LabInputs): ProductionReadout {
  return playerReadout(s, inp);
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
 *  compute (the rivals' aggregate policy, actors/rivalModel.ts bestRivalMix), research speed through the aggregate CES with its internal model's AI labour,
 *  its efficiency (the leader's LEADER_CAL, China's effLab) and modifiers (a binding leader, a verified treaty), and the
 *  recipe growth that gives. `apply` re-splits the mix and advances the recipe by a day. */
export function rivalResearch(s: GameStateV2, r: RivalLab, apply: boolean): ProductionReadout {
  const w = s.hidden.timeline;
  const core = r.core;
  const G = gOfSimple(w, r.internal);
  const fpt = rivalAgentFpt(r);
  const res = core.split.experiments + (core.split.routine + core.split.frontier);
  const C = core.computeOnline * res;
  let f = res > 0 ? core.split.experiments / res : 0.5;
  if (apply && res > 0) {
    f = bestRivalMix(w, G, fpt, core.staff.cap, C);
    core.split = { ...withResearchAgents(core.split, res * (1 - f)), experiments: res * f };
  }
  const treaty = s.gov.treaty === 'verified' ? 0.65 : 1;
  const x = evalRival(s, r, f, C, (r.phys?.eff ?? 1) * effLab(s, core.id), rivalSpeedMult(s, core.id) * treaty);
  const rates = recipeRates(w, r.phys, x.rs);
  if (apply) {
    advanceRecipe(r, rates, 1 / 365);
    // D10: the serving stack at aggregate level (the Inference-efficiency line's returns), from the same research speed.
    if (r.phys) r.phys.serve = (r.phys.serve ?? 0) + serveRate(s, r, x.rs) / 365;
  }
  const pools = poolsOf(s, core.id);
  return rivalReadout(x, core.milestoneDays[3] !== undefined, { h: (x.units * RE_LABOUR_UNIT) / DAY0_REF.re, k: (pools.routine + pools.frontier) / DAY0_REF.agents, c: x.c });
}

/** Spare serving compute lent to research agents (J2 PR1) and what it adds to research speed today (experiment
 *  throughput with it ÷ without − 1; the research-speed breakdown). */
export function spareServingEffect(s: GameStateV2): { h100e: number; dM: number } {
  const inp = labInputs(s, PLAYER_ID);
  const ks = inp?.mixUnit.kSpare ?? 0;
  if (!inp || ks <= 0) return { h100e: 0, dM: 0 };
  const w = s.hidden.timeline;
  return { h100e: inp.mixUnit.spare ?? 0, dM: expThroughput(w, inp) / Math.max(1e-12, expThroughput(w, inp, { k: Math.max(1e-12, inp.k - ks) })) - 1 };
}

/** Production readout for a lab, computed from current state (§3.2.2/§3.2.5; the other labs' from rivalResearch). */
export function computeProduction(s: GameStateV2, lab: LabId): ProductionReadout | undefined {
  if (lab !== PLAYER_ID) {
    const r = rivalLab(s, lab);
    return r ? rivalResearch(s, r, false) : undefined;
  }
  const inp = labInputs(s, lab);
  return inp ? evalProduction(s, inp) : undefined;
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
  const inp = labInputs(s, lab, s.time.day - 1);
  if (!inp) return undefined;
  const r = evalProduction(s, inp);
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
