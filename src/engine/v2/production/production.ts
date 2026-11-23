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
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { recipeDiffusionPerDay } from './diffusion';
import { C_UNIT_FLOP_PER_DAY, DAY0_REF, RE_LABOUR_UNIT } from '../../../data/v2/workTypes';
import { CHINA_PRESETS } from '../../../data/actors';
import { decimalYear } from '../core/time';
import { CHINA_ID, PLAYER_ID, labCore, otherLabs, rivalLab } from '../models/labs';
import { addRivalKnowledge, adoptRivalIdeas, advanceRecipe, bestRivalMix, evalRival, recipeRates, rivalAgentFpt, rivalReadout, rivalWorkModel, serveRate } from '../actors/rivalModel';
import { addKnowledge, trainNow } from '../models/stacks';
import { lentTrainingH100e } from '../models/runs';
import { poolsOf } from '../compute/power';
import { withResearchAgents } from '../departments/split';
import { rivalSpeedMult } from '../actors/rivals';
import { deliverData, syntheticAccrual, usageAccrual } from './data';
import { Xces } from './ces';
import { believedProd, believedWorld, elasticitiesAt } from './believed';
import { believedTasteInputs, effLabour, measuredLabour, qualityZ, researchMods, speedOfCopy, starTaste, teamTaste, workContext } from '../departments/workfit';
import { capReCapacity, reAllocation } from '../models/research';
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
   *  C = that research compute (H100e), off = agents switched off. Idle compute is not research compute (DD-19). */
  mixUnit: { c: number; k: number; C: number; off: boolean };
  mods: number;
  rateMult: number;
  /** Model v3 V3: the player's work-type research inputs. */
  v3: V3Inputs;
}

// ───────────────────────────── the player's experiment throughput (readouts only) ─────────────────────────────

/** RD-R01: the one aggregate piece left, the lab's experiment throughput at inputs (h, k, c): X(c̄, ℓ) of a unit project
 *  and the number of unit projects. READOUTS ONLY since RD-A02 (no mechanism, no Auto mix): the response charts
 *  (readout.ts) and labSpeedRel. */
function throughputAt(w: TimelineWorld, inp: LabInputs, c: number, k: number, h: number): { X: number; units: number; l: number } {
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
  return { X: Xces(Pp, cbar, l), units, l };
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
  // Research engineers not on run operations (idle ones too; SR-21: evals are safety engineers' work now): what
  // experiments + tuning held before RD-B08 gave tuning a finite demand (M goes with RD-R01 / RD-R04).
  const reRes = Math.max(0, alloc.total - alloc.re.ops);
  const Cag = off ? 0 : (pools.routine + pools.frontier);
  const flopEff = Math.pow(10, trainNow(s));
  const kUnit = 1 / DAY0_REF.agents;
  const cUnit = PHI_FLOP_PER_H100E_DAY / DAY0_REF.flop;
  const k = Cag * kUnit;
  const c = (pools.experiments + lentTrainingH100e(s)) * cUnit * mod.frontierExp; // UB-5c: + lent idle training // RD-A07: a frontier pause = no experiment FLOP
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
    h0: h, k0: k, reRes0: reRes, H0: Math.max(1e-9, capReCapacity(s)), AI0: Cag > 0 ? ex.AI : 0, a: ex.fit.a, assist: ex.fit.assist,
    flopEff, Tai: cap > 0 ? tai / cap : 1, mods: mod.speed / mod.rateMult, rateMult: mod.rateMult,
    sdAI: wc.sdAI, aEng: wc.slots.SWE.fit.a, copies: ex.copies + wc.slots.IDEAS.copies, speed: ex.copies > 0 ? speedOfCopy() : 0, aiFte: ex.aiFte,
    agentFte: ex.aiFte + wc.slots.IDEAS.aiFte,
    stage2: p.milestoneDays[3] !== undefined,
  };
  const Cres = pools.experiments + (pools.routine + pools.frontier);
  return {
    yr, h, k, c, mods: v3.mods, rateMult: mod.rateMult,
    mixUnit: { c: Cres * cUnit, k: off ? 0 : Cres * kUnit, C: Cres, off },
    v3,
  };
}

/** The player's readout from what the research engine did on its last day (RD-R01; research.last.x: the unit project's
 *  experiment compute c, labour ℓ and the AI labour multiplier in experiments m_EXP). wH = the human share of experiment
 *  labour as run (1 ÷ m_EXP); the label compares the experiment CES's compute and labour terms at the engine's c and ℓ
 *  (λ × the labour share vs ζ × the compute share). */
function playerReadout(s: GameStateV2, inp: LabInputs): ProductionReadout {
  const v = inp.v3;
  const x = s.player.research.last?.x;
  const wH = 1 / Math.max(1, x?.mExp ?? 1);
  let label: ProductionReadout['label'] = 'compute-bound';
  if (x && x.c > 0) {
    // RD-UI0a: the label compares the BELIEVED elasticities (published prior, production/believed.ts), never the hidden draw.
    const e = elasticitiesAt(believedProd(s).mid, x.c, x.l);
    if (e.eL > e.eC) label = wH > 0.5 ? 'human-bound' : 'labor-bound';
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
 *  experiment throughput × taste × modifiers, ÷ the leader's day-0 value (≈ 1 at the start). RF-R4: the throughput is
 *  the believed CES at today's inputs scaled to the lab's observed throughput (observedScale), so the level is what the
 *  lab's experiments did, never a hidden parameter. */
export function labSpeedRel(s: GameStateV2): number {
  const raw = labInputs(s, PLAYER_ID);
  if (!raw) return 1;
  // UB-2: today's experiment coverage, assist and taste as the lab measures / believes them (believedInputs), and the
  // observed scale taken at that believed labour (so the level is still the observed throughput when today's compute
  // equals the last research day's).
  const inp = believedInputs(s, raw);
  const w = believedWorld(s);
  const t = throughputAt(w, inp, inp.c, inp.k, inp.h);
  const x = s.player.research.last?.x;
  const speed = researchMods(s).speed;
  const b = x && x.X > 0 && x.c > 0 && speed > 0 ? Xces(w.prod, x.c, t.l) * speed : 0;
  const k = b > 0 ? x!.X / b : 1;
  return (t.X * t.units * k * inp.v3.Tai * inp.v3.mods * inp.v3.rateMult) / (DAY0_REF.re / RE_LABOUR_UNIT);
}

/** UB-2: the player's research inputs with the parts the lab cannot observe directly read as it measures / believes
 *  them, for readouts (labSpeedRel, the response curves): experiment coverage and assist from the AI staff model's
 *  measured skills (departments/workfit.ts measuredLabour), team taste from the believed AI taste inputs. Physics keeps
 *  labInputs. */
export function believedInputs(s: GameStateV2, inp: LabInputs): LabInputs {
  if (!inp.v3) return inp;
  const wc = workContext(s);
  const ml = measuredLabour(s, wc.slots.EXP);
  const { sAI, sdAI, m2b } = believedTasteInputs(s);
  const star = starTaste(s);
  let cap = 0, tai = 0;
  for (const tm of s.player.teams) {
    if (tm.role !== 'sci' || tm.dept !== 'cap') continue;
    cap += tm.heads;
    tai += tm.heads * teamTaste(qualityZ(tm.quality), sdAI, sAI, m2b, star);
  }
  return { ...inp, v3: { ...inp.v3, a: ml.fit.a, assist: ml.fit.assist, Tai: cap > 0 ? tai / cap : 1 } };
}

/** UB-2: the part of Research speed the lab believes its AI staff give (×; 1 = none): research speed ÷ the speed with
 *  the same people, compute and ideas but no AI staff. Two parts, both from measured skills and believed parameters
 *  (departments/workfit.ts measuredLabour, production/believed.ts): experiments, the believed CES at the observed unit
 *  inputs with the experiment labour multiplier vs without (labour index 1); ideas, the capability teams' taste with AI's
 *  share of the ideas vs without. Readout only. */
export function aiStaffSpeedPart(s: GameStateV2): { total: number; experiments: number; ideas: number } {
  const x = s.player.research.last?.x;
  const P = believedProd(s).mid;
  const wc = workContext(s);
  let experiments = 1;
  if (x && x.c > 0 && wc.slots.EXP.aiFte > 0) {
    const m = measuredLabour(s, wc.slots.EXP).m;
    const x0 = Xces(P, x.c, 1);
    if (x0 > 0 && m > 0) experiments = Xces(P, x.c, Math.pow(Math.max(1, m), P.lam)) / x0;
  }
  let ideas = 1;
  const { sAI, sdAI } = believedTasteInputs(s);
  if (sAI > 0) {
    const star = starTaste(s);
    let w = 0, a = 0, h = 0;
    for (const tm of s.player.teams) {
      if (tm.role !== 'sci' || tm.dept !== 'cap') continue;
      w += tm.heads;
      a += tm.heads * teamTaste(qualityZ(tm.quality), sdAI, sAI, P.m2b, star);
      h += tm.heads * teamTaste(qualityZ(tm.quality), sdAI, 0, P.m2b, star);
    }
    if (w > 0 && h > 0) ideas = a / h;
  }
  return { total: experiments * ideas, experiments, ideas };
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

/** eff_lab: 1 for the player and US rivals; China = chinaEfficiency × preset.efficiency, both 1 since CAL-W (equal recipe
 *  efficiency, designer CP3k; AI 2027 gives none separable from compute). */
export function effLab(s: GameStateV2, lab: LabId): number {
  if (lab !== CHINA_ID) return 1;
  return s.hidden.timeline.chinaEfficiency * (CHINA_PRESETS.find((p) => p.id === s.china.preset) ?? CHINA_PRESETS[0]).efficiency;
}

/** Build the player's production inputs from state on day `day` (default today; model v3 V3). The other labs have none
 *  since model v3 F1: their research is rivalResearch below. */
export function labInputs(s: GameStateV2, lab: LabId, day = s.time.day): LabInputs | undefined {
  if (lab !== PLAYER_ID || !labCore(s, lab)) return undefined;
  return playerInputs(s, day);
}

/** A non-player lab's research today (model v3 F1, actors/rivalModel.ts): the best experiments/agents mix of its research
 *  compute (the rivals' aggregate policy, actors/rivalModel.ts bestRivalMix), research speed through the aggregate CES with its internal model's AI labour,
 *  its efficiency (China's effLab) and modifiers (a binding leader, a verified treaty), and the
 *  recipe growth that gives. `apply` re-splits the mix and advances the recipe by a day. */
export function rivalResearch(s: GameStateV2, r: RivalLab, apply: boolean): ProductionReadout {
  const w = s.hidden.timeline;
  const core = r.core;
  const G = rivalWorkModel(w, r); // RD-X03 model + RD-X02 P05 lift
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
    // RD-X02 (DD-14 rival part): the same research speed works through the paradigms' typed effects.
    if (r.phys) adoptRivalIdeas(s, r, x.rs);
  }
  const pools = poolsOf(s, core.id);
  return rivalReadout(x, core.milestoneDays[3] !== undefined, { h: (x.units * RE_LABOUR_UNIT) / DAY0_REF.re, k: (pools.routine + pools.frontier) / DAY0_REF.agents, c: x.c });
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

/** RD-X04 (DD-17): rule A for the player (limitsView's diffusion line reads it): production/diffusion.ts. */
export function diffusionPerDay(s: GameStateV2): { dG: number; from?: string } {
  return recipeDiffusionPerDay(s, PLAYER_ID);
}

/** production (30, daily): readouts for the player, rivals and China; every lab's recipe takes in public recipes above
 *  it (RD-X04 rule A, the same function for every lab); rivals' and China's know-how grows (§3.2). */
export const productionSystem: EngineSystem = {
  id: 'production', owner: 'WS1', cadence: 'daily', order: 30, system: 'research',
  run(s, ctx) {
    // Rule A sizes on yesterday's public recipes for every lab before any lab's step (no order effect between labs).
    const dif = [PLAYER_ID, ...otherLabs(s).map((x) => x.core.id)].map((id) => ({ id, d: recipeDiffusionPerDay(s, id) }));
    const r = advanceLab(s, PLAYER_ID);
    const pd = dif[0].d;
    if (pd.dG > 0) addKnowledge(s, ctx, pd.dG, 'knowledge diffusion', pd.from);
    for (const { id, d } of dif.slice(1)) {
      const lab = rivalLab(s, id);
      if (lab && d.dG > 0) addRivalKnowledge(lab, d.dG);
    }
    if (r) {
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
