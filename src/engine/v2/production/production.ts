// Production function and know-how growth (V2-SPEC §3.1.2, §3.2; research/13 Part 1). Owner: WS1.
//
//   Lrel = [(1−A)^(1−ρc)·h^ρc + A^(1−ρc)·(R·k)^ρc]^(1/ρc)      (A ≥ 1 ⇒ R·k)
//   ℓ = Lrel^λ;  X = [u·c^(ζρ) + v·ℓ^ρ]^(1/ρ);  Tref = M_ref(q)/X(1, ℓ_ref(q));  τ = 1 + (τ_h − 1)(1 − Φ(sdAI))
//   norm = X(1, ℓ_ref(q)) / X*(q, yr)
//   M = Tref·τ·X·norm·eff·mods
//   Stage 1: dpa/dt = share·laborSlowdown(M, yr);  Stage 2: dpa/dt = M;  × pause × treaty
//
// q is the v1 progress coordinate (world.ts): q_dep = pm(internal agent) + δ_rsch + calShift.
// Tref keeps research/13's meaning (the taste curve). X*(q, yr) is the experiment capacity of a reference lab (h = 1, reference research compute = experiments + agents
// shares of shareRef(yr)) that splits its research compute between experiments and agents in the best way. So a lab
// with reference resources and the best research mix has M = multiplierAt(w, q) exactly (acceptance test P1): the
// reference lab optimises its mix, the AI 2027 usage table fixes only how much compute goes to research in total.
// Synthetic data is a training input (data stock and the data wall on bases, data.ts), not a research input.
import { playerH } from '../departments/teams';
import { laborSlowdown, multiplierAt, stage1 } from '../../../data/world';
import { CHINA_CAL, H100E_PER_COPY_SC, PROD_SPEED_CAP, REF_TECH } from '../../../data/v2/calibration';
import { CHINA_PRESETS } from '../../../data/actors';
import { decimalYear } from '../core/time';
import { shareRefAt } from '../departments/split';
import { CHINA_ID, PLAYER_ID, internalVersion, labCore, otherLabs } from '../models/labs';
import { deltaRsch } from '../models/capability';
import { paradigmLoad } from '../models/paradigms';
import { asV1World } from '../world/calibration';
import { poolsOf } from '../compute/power';
import { rivalSpeedMult } from '../actors/rivals';
import { ws4r } from '../actors/state';
import { syntheticAccrual, dataStockRatio } from './data';
import { Lrel, Phi, Xces, bestMix, hRef, knotAt, refTotal, tasteSD } from './knots';
import type { EngineSystem, GameStateV2, LabId, ModelVersion, ProdParams, ProductionReadout, TimelineWorld } from '../types';

/** Inputs of one lab's production function for one day (ratios vs the dated reference path, §3.2.1). */
export interface LabInputs {
  /** v1-coordinate progress of the internally deployed model incl. δ_rsch (q_dep = p_dep + calShift). */
  qDep: number;
  yr: number;
  h: number; k: number; c: number; d: number;
  /** c and k this lab would have with all of its research compute (experiments + agents) on experiments / on agents;
   *  C = that research compute (H100e), load = paradigm share of the experiment pool, off = agents switched off. */
  mixUnit: { c: number; k: number; C: number; load: number; off: boolean };
  /** min(1, S_eff / N_req(F(t))) — data-stock adequacy (§3.2.2). */
  stock: number;
  tasteHire: number;
  /** eff_lab (China efficiency; 1 for US labs). */
  eff: number;
  /** Other multipliers (siloing, sabotage hooks). */
  mods: number;
  /** pauseMult × treatyMult on the rate (§3.1.2). */
  rateMult: number;
  /** Absolute values for the labour and per-dollar readouts. */
  abs: { H: number; Cagents: number; Cexp: number; serveCost: number; tcoPerYr: number; staffCostPerYr: number };
}

type P = ProdParams;

/** X* of the reference lab with the best research mix at (q, yr); memoised per world (a few distinct keys a day). */
const xOptMemo = new WeakMap<ProdParams, Map<string, number>>();
export function refBestX(Pp: P, A: number, R: number, q: number, yr: number): number {
  let m = xOptMemo.get(Pp);
  if (!m) xOptMemo.set(Pp, (m = new Map()));
  const key = `${q.toFixed(5)}|${yr.toFixed(4)}`;
  let x = m.get(key);
  if (x === undefined) {
    const sh = shareRefAt(yr);
    const r = sh.experiments + sh.agents;
    x = bestMix(Pp, A, R, 1, r / sh.experiments, r / sh.agents).X;
    if (m.size > 4000) m.clear();
    m.set(key, x);
  }
  return x;
}

/** M and its pieces for a set of inputs. Pure. */
export function evalM(w: TimelineWorld, inp: Pick<LabInputs, 'qDep' | 'yr' | 'h' | 'k' | 'c' | 'tasteHire' | 'eff' | 'mods'>) {
  const Pp: P = w.prod;
  const q = inp.qDep;
  const Mref = multiplierAt(asV1World(w), q);
  const kn = knotAt(Pp.knots, q);
  const lRef = Math.pow(Lrel(Pp, kn.A, 1, kn.R), Pp.lam);
  const Xref = Xces(Pp, 1, lRef);
  const Tref = Mref / Xref;
  const norm = Xref / refBestX(Pp, kn.A, kn.R, q, inp.yr);
  const ai = kn.R * inp.k;
  const L = Lrel(Pp, kn.A, inp.h, ai);
  const l = Math.pow(L, Pp.lam);
  const X = Xces(Pp, inp.c, l);
  const sdAI = inp.tasteHire !== 1 ? tasteSD(Tref, Pp.m2b) : 0;
  const tau = inp.tasteHire !== 1 ? 1 + (inp.tasteHire - 1) * (1 - Phi(sdAI)) : 1;
  const M = Tref * tau * X * norm * inp.eff * inp.mods;
  return { M, Mref, A: kn.A, R: kn.R, Tref, tau, sdAI, L, l, X, ai, norm };
}

const speedOf = (M: number) => Math.min(PROD_SPEED_CAP, 8 + 10.8 * Math.log2(Math.max(1, M))); // R11 #23

/** Full production readout (§3.2.5). Pure function of the world and inputs. `detail` = false skips the ceilings and
 *  what-ifs (8 extra evaluations of M; reported as 1 = no change): the daily readouts of non-player labs, which the
 *  engine reads only for M, rate and stage (the production selector recomputes them in full on request). */
export function evalProduction(w: TimelineWorld, inp: LabInputs, detail = true): ProductionReadout {
  const Pp = w.prod;
  const e = evalM(w, inp);
  const stage: 1 | 2 = inp.qDep >= stage1(asV1World(w)) ? 2 : 1;
  const rate = (stage === 1 ? w.share * laborSlowdown(e.M, inp.yr) : e.M) * inp.rateMult;

  // (a) decomposition — multiplies to M.
  const Xh = Xces(Pp, inp.c, Math.pow(Math.max(1e-9, inp.h), Pp.lam));
  // base carries the best-mix normalisation (a reference lab at its best mix has base·agents = X*/X*·… = M_ref/Tref).
  const parts = { base: Xh * e.norm, agents: e.X / Xh, taste: e.Tref * e.tau, other: inp.eff * inp.mods };

  // (b) elasticities ∂lnM/∂ln x (research/13 §1.6).
  const cT = Pp.u * Math.pow(inp.c, Pp.zeta * Pp.rho);
  const lT = Pp.v * Math.pow(e.l, Pp.rho);
  const sC = cT / (cT + lT);
  const sL = 1 - sC;
  const wH = e.A >= 1 - 1e-12 ? 0 : (Math.pow(1 - e.A, 1 - Pp.rc) * Math.pow(inp.h, Pp.rc)) / Math.pow(e.L, Pp.rc);
  const gF = refTotal(w, inp.yr + 1) / refTotal(w, inp.yr);
  const elast = {
    exp: Pp.zeta * sC,
    humans: Pp.lam * sL * wH,
    agents: Pp.lam * sL * (1 - wH),
    taste: inp.tasteHire < 1.5 ? 1 - Phi(e.sdAI || tasteSD(e.Tref, Pp.m2b)) : 0,
    train: stage === 1 ? (1 - w.share) / Math.log(gF) : 0,
    data: 0,
  };
  // Marginal % of M per $B/yr: elasticity / annual cost of the current input.
  const costExp = Math.max(1e-6, inp.abs.Cexp * inp.abs.tcoPerYr);
  const costHum = Math.max(1e-6, inp.abs.H * inp.abs.staffCostPerYr);
  const costAg = Math.max(1e-6, inp.abs.Cagents * inp.abs.tcoPerYr);
  const perDollar = { exp: elast.exp / costExp, humans: elast.humans / costHum, agents: elast.agents / costAg };

  const at = (o: Partial<Pick<LabInputs, 'h' | 'k' | 'c'>>) => evalM(w, { ...inp, ...o }).M / e.M;
  // "∞" = the input × 1e9, research/13 §1.9's convention (its §1.6 table: ∞ agents ×8.7 at SC).
  const BIG = 1e9;
  const ceilings = detail ? { humans: at({ h: inp.h * BIG }), agents: at({ k: inp.k * BIG }), exp: at({ c: inp.c * BIG }) } : { humans: 1, agents: 1, exp: 1 };
  const whatIf = detail
    ? { humans2: at({ h: inp.h * 2 }), agents2: at({ k: inp.k * 2 }), agents01: at({ k: inp.k * 0.1 }), exp2: at({ c: inp.c * 2 }), exp05: at({ c: inp.c * 0.5 }) }
    : { humans2: 1, agents2: 1, agents01: 1, exp2: 1, exp05: 1 };

  let binding: ProductionReadout['binding'] = 'experiments';
  const pd = perDollar;
  if (pd.humans > pd.exp && pd.humans >= pd.agents) binding = 'humans';
  else if (pd.agents > pd.exp && pd.agents > pd.humans) binding = 'agents';
  const lnM = Math.log(Math.max(1.0001, e.M));
  const tasteShare = Math.log(Math.max(1, parts.taste)) / lnM;
  if (tasteShare > 0.6 && e.Mref >= 25) binding = 'taste';
  let label: ProductionReadout['label'] = elast.humans + elast.agents > elast.exp ? 'labor-bound' : 'compute-bound';
  if (e.Mref >= 25 && tasteShare > 0.6) label = 'taste-bound';
  else if (label === 'labor-bound' && wH > 0.5) label = 'human-bound';

  const perCopy = H100E_PER_COPY_SC * (inp.abs.serveCost / 0.5);
  const copies = inp.abs.Cagents / Math.max(1e-6, perCopy);
  return {
    M: e.M, rate, stage, parts, elast, perDollar, ceilings, binding, label,
    labor: { A: e.A, aiFTE: e.ai * hRef(inp.yr), copies, speed: speedOf(e.M), wH },
    ratios: { h: inp.h, k: inp.k, c: inp.c, d: inp.d },
    Ddata: 1,
    whatIf,
    sdAI: e.sdAI || tasteSD(e.Tref, Pp.m2b),
  };
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

/** Version serve cost of a lab's internal model (player: internal agent version; others: reference 0.5). */
function internalServe(s: GameStateV2, lab: LabId): number {
  if (lab === PLAYER_ID) return internalVersion(s)?.serveCost ?? 0.5;
  return 0.5;
}

/** p_dep (progress units, shifted coordinate pm) of a lab's internally deployed model, δ_rsch included (§3.1.2). */
export function pDepOf(s: GameStateV2, lab: LabId): number {
  if (lab === PLAYER_ID) {
    const v = internalVersion(s);
    if (!v) return s.player.pa;
    return v.pm + deltaRsch(s.hidden.timeline, v);
  }
  const r = lab === CHINA_ID ? s.china.lab : s.rivals.find((x) => x.core.id === lab);
  return r ? r.internal.pm : 0;
}

/**
 * Technology the reference path already embodies after SC (AI 2027: Agent-3 runs automated research with neuralese
 * memory at SC). The player's agent and experiment ratios are measured against a reference lab that has automated
 * research agents (P13: experiment throughput ×1.5) and latent reasoning (P17 latent base: ηmod 2.5), ramped in
 * geometrically from REF_TECH.from to REF_TECH.to days after the lab's own SC day (the time research + a latent base
 * take under the reference cadence). RefBot adopts both, so its ratios stay ≈ 1 and the audited takeoff durations
 * hold; a lab that refuses falls behind (§9 #4, R11 "refusing costs speed"). Simple-model labs are assumed to carry
 * reference tech and are not normalised.
 */
export function referenceTech(scDay: number | undefined, day: number): { k: number; c: number } {
  if (scDay === undefined) return { k: 1, c: 1 };
  const f = Math.min(1, Math.max(0, (day - scDay - REF_TECH.from) / (REF_TECH.to - REF_TECH.from)));
  return { k: Math.pow(REF_TECH.k, f), c: Math.pow(REF_TECH.c, f) };
}

/** Build a lab's production inputs from state on day `day` (default today). */
export function labInputs(s: GameStateV2, lab: LabId, day = s.time.day): LabInputs | undefined {
  const core = labCore(s, lab);
  if (!core) return undefined;
  const w = s.hidden.timeline;
  const yr = decimalYear(s, day);
  const ref = refTotal(w, yr);
  const sh = shareRefAt(yr);
  const isPlayer = lab === PLAYER_ID;
  const serve = internalServe(s, lab);
  // ηmod = clamp(0.5 / serveCost, 0.5, 2.5); P05 orchestration × 1.3 (§3.3.3). controlTax 0.05 with AG07 control.
  let etaMod = Math.min(2.5, Math.max(0.5, 0.5 / serve));
  let controlTax = 0;
  let cMult = 1;
  let mods = 1;
  // Player: capabilities research engineers carry h (R3: h = RE_cap / (0.55·H_ref)); other labs: their capabilities staff.
  let H = isPlayer ? playerH(s.player) : core.staff.cap;
  if (isPlayer) {
    const par = s.player.paradigms;
    if (par.P05?.status === 'adopted') etaMod *= 1.3;
    if (par.P20?.status === 'adopted') etaMod *= 1.1; // agent societies [D]
    if (par.P13?.status === 'adopted') cMult = 1.5;
    if (s.player.deployments.some((d) => d.channel === 'internal' && d.status === 'live' && d.controlLayer)) controlTax = 0.05;
    mods *= 1 - 0.05 * s.player.security.siloing; // research speed −5% per silo level (§3.4.3)
    if (Number(s.flags['ws4:sidelinedUntil'] ?? -1) > day) H *= 0.9; // E12 clearances sideline 5–15% of staff for 60 d (§3.4.1)
    if ((s.player.finance.ws3.asicMigrationUntil ?? -1) > day) mods *= 0.85; // custom-ASIC migration: −15% research efficiency (§3.7.4)
  } else mods *= rivalSpeedMult(s, lab); // a binding leader slows itself (§3.10.3, WS4)
  // Paradigm projects tie up research FTE and a share of the experiment pool (§3.3.3).
  const load = isPlayer ? paradigmLoad(s) : { fte: 0, expShare: 0 };
  H = Math.max(1, H - load.fte);
  // Pools are WS3's: computeOnline × split (§3.4.2). Internal agents switched off (E25 shutdown & hunt) → no agent pool.
  const pools = poolsOf(s, lab);
  const agentsOff = isPlayer && Number(s.flags['ws4:agentsOffUntil'] ?? -1) > day;
  const Cag = agentsOff ? 0 : pools.agents;
  const Cexp = pools.experiments * (1 - load.expShare);
  const Csyn = pools.synthetic;
  const h = H / hRef(yr);
  const qDep = pDepOf(s, lab) + w.calShift;
  const rt = isPlayer ? referenceTech(core.scDay, day) : { k: 1, c: 1 };
  const k = (Cag * etaMod * (1 - controlTax)) / Math.max(1, ref * sh.agents * rt.k);
  const c = (cMult * Cexp) / Math.max(1, ref * sh.experiments * rt.c);
  const d = Csyn / Math.max(1, ref * sh.synthetic);
  const stock = isPlayer ? dataStockRatio(s, yr) : 1;
  const Cres = pools.experiments + pools.agents;
  const mixUnit = {
    c: (cMult * Cres * (1 - load.expShare)) / Math.max(1, ref * sh.experiments * rt.c),
    k: agentsOff ? 0 : (Cres * etaMod * (1 - controlTax)) / Math.max(1, ref * sh.agents * rt.k),
    C: Cres, load: load.expShare, off: agentsOff,
  };
  // pauseMult 0.1 during a voluntary or committee pause of frontier experiments (§3.1.2; WS4 frontierPauseUntil).
  const pause = isPlayer && (s.flags.paused || ws4r(s).frontierPauseUntil > day) ? 0.1 : 1;
  const treaty = s.gov.treaty === 'verified' ? 0.65 : 1;
  return {
    qDep, yr, h, k, c, d, mixUnit, stock,
    tasteHire: core.tasteHire, eff: effLab(s, lab), mods, rateMult: pause * treaty,
    abs: { H, Cagents: Cag, Cexp, serveCost: serve, tcoPerYr: tcoPerH100eYear(s, yr), staffCostPerYr: 0.8e-3 },
  };
}

/** Production readout for a lab, computed from current state (§3.2.2/§3.2.5). */
export function computeProduction(s: GameStateV2, lab: LabId): ProductionReadout | undefined {
  const inp = labInputs(s, lab);
  return inp ? evalProduction(s.hidden.timeline, inp) : undefined;
}

/** AI researcher-equivalents per H100e of agent inference running version `v` today: R(q_v)·ηmod·H_ref / C_agents,ref
 *  (the production function's own conversion, §3.2.1). Used for the safety agent fleet. */
export function aiFtePerH100e(s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build' | 'serveCost'>): number {
  const w = s.hidden.timeline;
  const yr = decimalYear(s);
  const q = v.pm + deltaRsch(w, v) + w.calShift;
  const kn = knotAt(w.prod.knots, q);
  const eta = Math.min(2.5, Math.max(0.5, 0.5 / v.serveCost));
  return (kn.R * eta * hRef(yr)) / Math.max(1, refTotal(w, yr) * shareRefAt(yr).agents);
}

/** Best experiments share of a lab's research compute (experiments + agents) for its current inputs. */
export function bestResearchMix(s: GameStateV2, inp: LabInputs): number {
  const Pp = s.hidden.timeline.prod;
  const kn = knotAt(Pp.knots, inp.qDep);
  return bestMix(Pp, kn.A, kn.R, inp.h, inp.mixUnit.c, inp.mixUnit.k).f;
}

/** Inputs with the research compute re-split at experiments share f (same total). */
export function inputsAtMix(inp: LabInputs, f: number): LabInputs {
  const u = inp.mixUnit;
  return { ...inp, c: f * u.c, k: (1 - f) * u.k, abs: { ...inp.abs, Cexp: f * u.C * (1 - u.load), Cagents: u.off ? 0 : (1 - f) * u.C } };
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
  return inputsAtMix(inp, f);
}

/** Advance one lab's know-how by one day: readout at day−1 inputs, then pa += rate/365 (§3.1.2). */
export function advanceLab(s: GameStateV2, lab: LabId): ProductionReadout | undefined {
  const core = labCore(s, lab);
  if (!core || core.status !== 'active') return undefined;
  const inp = applyBestMix(s, lab, s.time.day - 1);
  if (!inp) return undefined;
  const r = evalProduction(s.hidden.timeline, inp, lab === PLAYER_ID);
  core.prodCache = r;
  core.pa += r.rate / 365;
  return r;
}

/** production (30, daily): for player, rivals and China — readout, then pa += rate/365 (§3.2). Memoised readouts
 *  are cached on each lab (`prodCache`) and under ctx.memo 'WS1:production:<lab>'. */
export const productionSystem: EngineSystem = {
  id: 'production', owner: 'WS1', cadence: 'daily', order: 30,
  run(s, ctx) {
    const r = advanceLab(s, PLAYER_ID);
    if (r) {
      ctx.cause('player.pa', r.rate / 365, 'production', `M ${r.M.toFixed(2)}×, ${r.label}`);
      ctx.memo.set('WS1:production:player', r);
      syntheticAccrual(s);
    }
    for (const lab of otherLabs(s)) {
      const rr = advanceLab(s, lab.core.id);
      if (rr) ctx.memo.set(`WS1:production:${lab.core.id}`, rr);
    }
  },
};
