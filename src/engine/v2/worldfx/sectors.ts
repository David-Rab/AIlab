// Outside world: sectors × regions, jobs, control, techs, robots (V2-SPEC §3.11; research/16 Part 1). Owner: WS5.
//
// Per tick, per region r and sector s (research/16 §1A.2, implemented as written; fractions 0..1):
//   1 Le_d   = min(L_d, L_AGENCY + 2) (cognitive), PHYS capped by robots — world model m* = share-weighted mix (mix.ts)
//   2 F      = Σ_d w_s,d·σ((Le_d − 8 − θ_s)/1.2)
//   3 K      = σ(ln(Wage·W0 / P_cost)/0.7)   P_cost = effective AI cost per human-hour incl. review [D]
//   4 A*     = F·K·(1 − R)                   R = R0·frictionScale + policy + incidents − certification
//   5 A     += (p + q'·A/A*)(A* − A)/365·DiffMult;  A* < A → decays at 0.5/yr
//   6 α      = 0.25 + (α_max − 0.25)·σ((L_AGENCY − 8)/1.5);  D = α·A
//   7 E      = E0·(1 − D)(1 + η·CR) ≥ floor;   CR = A·(1 − P_cost/(Wage·W0))
//   8 Hire   = 1 − 1.5·ΔF (ΔF vs the pre-LLM profile) → youth (22–25) employment, youth unemployment
//   9 Pool  += layoffs beyond 1.5%/month attrition; −= Pool·r_re; exit 0.25/yr (×3 with UBI); U = U_base + Pool/LF
import {
  AGENT0_PROFILE, ECON, PRE_LLM_LEVEL, REGIONS, REGION_SCALE, SECTORS, SECTOR_IDS, U_BASE, US_EMPLOYMENT,
  type SectorDef,
} from '../../../data/v2/sectors';
import { WORLD_TECHS } from '../../../data/v2/techs';
import type {
  ControlDomainId, ControlState, DomainId, EngineSystem, GameStateV2, LabId, MacroState, RegionId, SectorId,
  SectorState, SystemCtx, WorldEconomy, WorldFxState, WorldTechState,
} from '../types';
import { initialControl, updateControl } from './control';
import { fireHeadlines } from './headlines';
import { paidDeployments, sectorLevel, worldMix, type WorldMix } from './mix';
import { econOf, policyState, sigmoid, clamp01, clampR, type PolicyState } from './policy';
import { ROBOT, advanceRobots } from './robots';
import { advanceTechs, worldTechEffects } from './techtree';

export { REGIONS };

/** Regional employment base E0 (persons). */
export const E0of = (def: SectorDef, r: RegionId) => US_EMPLOYMENT * (def.empPct / 100) * REGION_SCALE[r].emp;
/** Labor force by region (employment / (1 − U_base)). */
export const laborForce = (r: RegionId) => (US_EMPLOYMENT * REGION_SCALE[r].emp) / (1 - U_BASE[r] / 100);

/** Feasibility F from effective domain levels. */
export function feasibility(def: SectorDef, le: Record<DomainId, number>): number {
  let F = 0;
  for (const [d, w] of TASK_ENTRIES[def.id]) F += w * sigmoid((le[d] - ECON.fMid - def.theta) / ECON.fSpread);
  return F;
}
const TASK_ENTRIES = Object.fromEntries(SECTORS.map((d) => [d.id, Object.entries(d.tasks) as [DomainId, number][]])) as Record<SectorId, [DomainId, number][]>;

/** Effective AI cost per human-hour-equivalent ($) at sector level L and market price index (review overhead
 *  included; GDPval-anchored at L 5, halving per 1.5 levels) [D]. */
export const aiCostPerHour = (L: number, price: number) => ECON.W0 * ECON.costShare5 * price * Math.pow(2, -(L - 5) / ECON.costHalvingLevels);

export function costGate(def: SectorDef, r: RegionId, L: number, price: number): number {
  return sigmoid(Math.log((def.wage * REGION_SCALE[r].wage * ECON.W0) / aiCostPerHour(L, price)) / ECON.kSpread);
}

export function alphaOf(def: SectorDef, Lagency: number): number {
  return 0.25 + (def.alphaMax - 0.25) * sigmoid((Lagency - 8) / 1.5);
}

/** Pre-LLM (late 2022) feasibility per sector: hiring baseline for ΔF. */
/** Consumer SOCIAL level at which the AI-friend share is half its ceiling (research/16 §2.1) [D]. M2: 7 → 6.5 on
 *  integrated RefBot play, whose consumer channel serves distilled minis (SOCIAL ≈ 0.5 L below the WS5 probe's
 *  "internal − 0.5 L" public model). */
const FRIEND_SOCIAL_MID = 6.5;

const F_PRE: Record<SectorId, number> = (() => {
  const le = {} as Record<DomainId, number>;
  for (const k of Object.keys(AGENT0_PROFILE) as DomainId[]) le[k] = k === 'PHYS' ? 0 : PRE_LLM_LEVEL;
  return Object.fromEntries(SECTORS.map((d) => [d.id, feasibility(d, le)])) as Record<SectorId, number>;
})();

export const hireRateOf = (sid: SectorId, F: number) => clamp01(1 - ECON.hireSlope * Math.max(0, F - F_PRE[sid]));

/** Friction R_s for a region (research/16 §1A.2 step 4). */
export function frictionOf(s: GameStateV2, r: RegionId, def: SectorDef, pol: PolicyState): number {
  let R = def.R0 * econOf(s).frictionScale * REGION_SCALE[r].R;
  const id = def.id;
  if (r === 'US') {
    if (pol.licensing && (id === 'LEGAL' || id === 'HEALTH' || id === 'FIN')) R += 0.1;
    if (pol.avBan && id === 'LOG') R += 0.3;
    if (pol.schoolBan && id === 'EDU') R += 0.3;
    if (pol.armsRace && id === 'MIL') R -= 0.3;
    if (pol.sez && (id === 'MFG' || id === 'LOG' || id === 'ENGY')) R *= 0.3;
    const c = s.world.fx.certDay[id];
    if (c !== undefined && c <= s.time.day) R -= 0.1;
  }
  if (r === 'ROW' && pol.euCode) R += 0.03;
  R += s.world.fx.incidentR[id] ?? 0;
  return clampR(R, 0, 0.95);
}

function sectorState(def: SectorDef, r: RegionId, le: Record<DomainId, number>, L: number, A: number, R: number): SectorState {
  const F = feasibility(def, le);
  const K = costGate(def, r, L, 1);
  const Astar = F * K * (1 - R);
  const alpha = alphaOf(def, le.AGENCY);
  const E0 = E0of(def, r);
  const E = employmentTarget(def, r, E0, alpha * A, A, L, 1);
  return { F, K, R, Astar, A, alpha, E, E0, hireRate: hireRateOf(def.id, F), binding: bindingOf(F, K, R, A, Astar) };
}

/** E = E0·(1 − D)(1 + η·CR), floored (R16 §1A.2 step 7). */
export function employmentTarget(def: SectorDef, r: RegionId, E0: number, D: number, A: number, L: number, price: number): number {
  const wageH = def.wage * REGION_SCALE[r].wage * ECON.W0;
  const CR = A * Math.max(0, 1 - aiCostPerHour(L, price) / wageH);
  return Math.max(def.floor * E0, E0 * (1 - D) * (1 + def.eta * CR));
}

/** The binding constraint shown in the World panel. */
export function bindingOf(F: number, K: number, R: number, A: number, Astar: number): SectorState['binding'] {
  if (Astar > 0.02 && A < 0.8 * Astar) return 'diffusion';
  const m = Math.min(F, K, 1 - R);
  return m === F ? 'capability' : m === K ? 'cost' : 'friction';
}

/** World at Jul 2025 (start values from research/16; derived values use the R16 Agent-0 profile until the first
 *  tick recomputes them from the actual deployed models). Fractions are 0..1. */
export function initialWorld(labIds: LabId[]): WorldEconomy {
  const sectors = {} as Record<RegionId, Record<SectorId, SectorState>>;
  for (const r of REGIONS) {
    const row = {} as Record<SectorId, SectorState>;
    for (const def of SECTORS) {
      const le = { ...AGENT0_PROFILE };
      le.PHYS = 0; // robot-bound at start
      const L = sectorLevel(AGENT0_PROFILE, def.id, 0, { floor: 0, log: 0 });
      const R = clampR(def.R0 * REGION_SCALE[r].R, 0, 0.95);
      row[def.id] = sectorState(def, r, le, L, def.A0 * REGION_SCALE[r].A0, R);
    }
    sectors[r] = row;
  }
  const playerShare = 0.45;
  const others = labIds.filter((l) => l !== 'player');
  const shareRow = (): Record<LabId, number> => ({ player: playerShare, ...Object.fromEntries(others.map((l) => [l, (1 - playerShare) / Math.max(1, others.length)])) });
  const shares = {} as Record<SectorId, Record<LabId, number>>;
  for (const id of SECTOR_IDS) shares[id] = shareRow();
  const techs: Record<string, WorldTechState> = {};
  for (const t of WORLD_TECHS) {
    techs[t.id] = { prog: t.start, ramp: t.start >= 1 ? 1 : 0, exposure: 0 };
    if (t.start >= 1) techs[t.id].discoveredDay = 0;
  }
  // GDP 2025 ($B): US ≈ 30T, China ≈ 19T, rest of world ≈ 60T (GATE GWP $110T [V]).
  const macro = (gdp: number, g: number, gini: number): MacroState => ({ gdp, g, laborShare: ECON.LS0, wage: 1, gini, aiCapexShare: 0, energyPrice: 1 });
  const youthRel = {} as Record<SectorId, number>;
  const incidentR = {} as Record<SectorId, number>;
  for (const d of SECTORS) {
    youthRel[d.id] = d.youthExposed ? ECON.youthRel0 : 1;
    incidentR[d.id] = 0;
  }
  const fx: WorldFxState = {
    consumerReach: 0.4, // ≈39–40% of US adults use generative AI (Bick, Blandin, Deming) [V]
    capPenalty: { consumer: 0, sector: 0 },
    youthRel,
    incidentR,
    certDay: {},
    autoLevel: { US: 1, CN: 1, ROW: 1 },
    trend: { US: 30000, CN: 19000, ROW: 60000 },
    sezY: 0,
    hype: 0,
    fear: 0,
    earn0: 0,
    dowJan: 0,
    uHist: [U_BASE.US],
    aiCapexPrev: 0,
    aiRev0: 0,
    Lpub0: 0,
    layoffs30: 0,
    youthPrev: ECON.youthU0,
    sezDay: -1,
    humanoidProd: ROBOT.humanoid0,
    sezProd: 0,
    robotUS: ROBOT.usShare0,
    hl: {},
  };
  return {
    sectors,
    displacedPool: { US: 0, CN: 0, ROW: 0 },
    unemployment: { ...U_BASE },
    youthUnemployment: ECON.youthU0,
    control: initialControl(shareRow),
    infoShare: shareRow(),
    friendShare: 0.03, // ≈3% of adults [D, R16 N3a]
    techs,
    robots: { stockHWE: ROBOT.stock0, prodPerYear: ROBOT.conventional0, doublingYears: ROBOT.baseDoublingYears, sezOpen: false, sezShare: 0 },
    macro: { US: macro(30000, 0.02, ECON.gini0), CN: macro(19000, 0.045, 0.47), ROW: macro(60000, 0.028, 0.6) },
    dow: 44000, // Dow Jones ≈ 44,000 in Jul 2025
    aiOwnerShare: 0,
    intelligenceCurse: false,
    shares,
    fx,
  };
}

/** Player transition-fund + government training → Retrain (each $10B/yr +0.1, cap +0.5; R16 §1A.2 step 9). */
export function retrainOf(s: GameStateV2, pol: PolicyState): number {
  return Math.min(0.5, (0.1 * s.player.policies.transitionFund) / 10 + (pol.jobTraining ? 0.2 : 0));
}

/** One region's sector update. Returns US layoffs today. */
function updateRegion(s: GameStateV2, ctx: SystemCtx, r: RegionId, mix: WorldMix, pol: PolicyState): number {
  const econ = econOf(s);
  const dt = 1 / 365;
  const row = s.world.sectors[r];
  const eff = worldTechEffects(s);
  const playerIdx = mix.providers.findIndex((p) => p.key === 'player');
  const noDropIn = paidDeployments(s).some((d) => d.usagePolicy.noDropInReplacement);
  let layoffs = 0;
  let Dw = 0;
  let Ew = 0;
  for (const def of SECTORS) {
    const st = row[def.id];
    const m = mix.sec[r][def.id];
    const le = m.dom;
    let L = 0;
    for (const [d, w] of TASK_ENTRIES[def.id]) L += w * le[d];
    st.F = feasibility(def, le);
    st.K = costGate(def, r, L, m.price);
    st.R = frictionOf(s, r, def, pol);
    st.Astar = st.F * st.K * (1 - st.R);
    let q = def.q * (1 + 0.15 * Math.max(0, le.AGENCY - 8));
    if (def.id === 'SCI') q *= 1 + eff.sciQ;
    if (st.A < st.Astar) st.A += (def.p + (q * st.A) / Math.max(1e-6, st.Astar)) * (st.Astar - st.A) * dt * econ.diffMult;
    else st.A -= 0.5 * (st.A - st.Astar) * dt;
    st.A = clamp01(st.A);
    const a = alphaOf(def, le.AGENCY);
    const ps = playerIdx >= 0 ? m.share[playerIdx] : 0;
    st.alpha = noDropIn ? ps * Math.min(a, 0.5) + (1 - ps) * a : a;
    const D = st.alpha * st.A;
    const target = employmentTarget(def, r, st.E0, D, st.A, L, m.price);
    const dE = target - st.E;
    const attrition = (ECON.attritionPerMonth * 12 * dt) * st.E;
    if (-dE > attrition) layoffs += -dE - attrition;
    st.E = target;
    st.hireRate = hireRateOf(def.id, st.F);
    st.binding = bindingOf(st.F, st.K, st.R, st.A, st.Astar);
    Dw += D * st.E0;
    Ew += st.E0;
    if (r === 'US') {
      const fx = s.world.fx;
      fx.youthRel[def.id] += ((st.hireRate - fx.youthRel[def.id]) * dt) / ECON.youthTau;
    }
  }

  // Displaced pool and unemployment.
  const W = s.world;
  const LF = laborForce(r);
  let physE = 0;
  let allE = 0;
  for (const def of SECTORS) {
    const E = row[def.id].E;
    allE += E;
    physE += E * (def.tasks.PHYS ?? 0);
  }
  const mismatch = 1 - 0.5 * (physE / Math.max(1, allE));
  const Lag = mix.bestPublic.AGENCY;
  const nuEff = econ.nu * (1 - sigmoid((Lag - 10) / 1.5));
  const gAI = Math.max(0, W.macro[r].g - (r === 'US' ? 0.018 : r === 'CN' ? 0.04 : 0.028));
  const openJobs = 0.4 * (1 - 0.6 * (Dw / Math.max(1, Ew))) + 5 * nuEff * gAI;
  const retrain = r === 'US' ? retrainOf(s, pol) : 0;
  const rRe = 2.0 * mismatch * (1 + retrain) * openJobs;
  const exit = 0.25 * (pol.ubi && r === 'US' ? 3 : 1);
  const pool0 = W.displacedPool[r];
  const pool = Math.max(0, pool0 + layoffs - pool0 * (rRe + exit) * dt);
  W.displacedPool[r] = pool;
  const U = U_BASE[r] + (100 * pool) / LF;
  const dU = U - W.unemployment[r];
  if (r === 'US') {
    if (Math.abs(dU) >= 0.002) ctx.cause('world.unemployment.US', dU, dU > 0 ? 'AI displacement' : 're-employment');
  }
  W.unemployment[r] = U;
  return r === 'US' ? layoffs : 0;
}

/** worldDaily (110, daily): sector Bass diffusion, jobs, control penetration, tech progress, robots, headlines. */
export const worldDailySystem: EngineSystem = {
  id: 'worldDaily', owner: 'WS5', cadence: 'daily', order: 110,
  run(s, ctx) {
    const W = s.world;
    const fx = W.fx;
    const pol = policyState(s);
    const dt = 1 / 365;

    // Incidents in the wild raise friction in the affected sectors (+0.05 each, decays over a year).
    for (const id of SECTOR_IDS) fx.incidentR[id] = Math.max(0, fx.incidentR[id] * (1 - dt));
    for (const inc of s.player.safety.incidents) {
      if (inc.day !== ctx.day || inc.severity < 3 || inc.exposure === 'internal') continue;
      const dep = s.player.deployments.find((d) => d.id === inc.deploymentId);
      const secs = dep?.sectorFocus.length ? dep.sectorFocus : topPlayerSectors(s, 3);
      for (const id of secs) fx.incidentR[id] = Math.min(0.5, fx.incidentR[id] + 0.05);
    }

    const mix = worldMix(s, ctx);
    let layoffs = 0;
    for (const r of REGIONS) layoffs += updateRegion(s, ctx, r, mix, pol);
    fx.layoffs30 = fx.layoffs30 * (1 - 1 / 30) + layoffs;

    // Youth (22–25) unemployment, US.
    let yu = 0;
    for (const def of SECTORS) yu += (def.empPct / 100) * (1 - fx.youthRel[def.id]);
    W.youthUnemployment = ECON.youthU0 + 30 * yu;

    // US shares (lab keys) and INFO channel.
    const us = mix.sec.US;
    for (const id of SECTOR_IDS) {
      const row: Record<LabId, number> = {};
      mix.providers.forEach((p, i) => {
        if (us[id].share[i] > 0) row[p.key] = round4(us[id].share[i]);
      });
      W.shares[id] = row;
    }
    const cons = mix.consumer.US;
    const info: Record<LabId, number> = {};
    mix.providers.forEach((p, i) => {
      if (cons.share[i] > 0) info[p.key] = round4(cons.share[i]);
    });
    W.infoShare = info;

    // Consumer reach and AI-friend share (research/16 §2.1).
    const reachStar = 0.35 + 0.55 * sigmoid((cons.best - 6) / 1.2);
    if (fx.consumerReach < reachStar) fx.consumerReach += (1 + 2 * fx.consumerReach) * (reachStar - fx.consumerReach) * dt;
    else fx.consumerReach -= 0.2 * (fx.consumerReach - reachStar) * dt;
    const friendStar = 0.03 + 0.18 * sigmoid((cons.social - FRIEND_SOCIAL_MID) / 1) * fx.consumerReach * (pol.companionBan ? 0.4 : 1);
    W.friendShare += (friendStar - W.friendShare) * 3 * dt;

    // The player transition fund is charged only by WS3's payroll system (finance ledger); its effects on workers
    // (Retrain) are computed here (research/16 §1A.3).

    updateControl(s, ctx, mix, pol);
    advanceRobots(s, ctx);
    advanceTechs(s, ctx);
    fireHeadlines(s, ctx);
  },
};

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Sectors where the player's share × size is largest (US). */
export function topPlayerSectors(s: GameStateV2, n: number): SectorId[] {
  return [...SECTOR_IDS]
    .sort((a, b) => (s.world.shares[b].player ?? 0) * s.world.sectors.US[b].A * s.world.sectors.US[b].E0 - (s.world.shares[a].player ?? 0) * s.world.sectors.US[a].A * s.world.sectors.US[a].E0)
    .slice(0, n);
}


export { remoteWorkAutomation, firmAdoption, youthExposedEmployment, automationShare } from './readouts';
export type { ControlDomainId, ControlState };
