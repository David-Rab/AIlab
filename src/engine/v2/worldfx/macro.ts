// Macro indicators: GDP, unemployment feedback, wages, labor share, Gini, Dow, AI-capex share, AI-owner share
// (V2-SPEC §3.11.2; research/16 §4). Owner: WS5.
//
// GDP_r = trend_r·X_r (+ SEZ output in the US).
//   trend grows at g_base (US 1.8% CBO-type, CN ≈4%, ROW 2.8%) + g_capex + g_tech − g_shock;
//   g_capex = 0.5·Δ(AI capex)/GDP per year, net of a 0.65 import leak (St. Louis Fed / FEDS Note [V]);
//   X = CES(C, P), σ by preset (ρ = (σ−1)/σ), weights ½/½: C = 1 + 2·LS0·Σ v·A·CS·(1 − w_PHYS)·boost,
//       P = 1 + 2·LS0·Σ v·A·CS·w_PHYS·boost + new robots / physical labor; small gains → Hulten TFP = LS0·Σ v·A·CS.
//   Without W17 cognitive automation never lifts X above 2.2 (R16 §7 test 3); below Σ v·A = 0.5 the AI-driven
//   growth rate is capped at 0.6·Σ v·A (GATE statements, R16 §4.3).
//   SEZ output grows at ln2/T_dbl once SEZs open (explosive regime needs W17 or Σ v·A ≥ 0.5; else ≤ 30%/yr).
// Dow = Dow0·(Earnings/E0)·(PE/PE0), PE = 20·(1 + 0.6·Hype − 0.8·Fear) [R16 §4.5].
import { ECON, REGIONS, SECTORS, U_BASE } from '../../../data/v2/sectors';
import { globalCompute } from '../../../data/world';
import { asV1World } from '../world/calibration';
import type { EngineSystem, GameStateV2, RegionId, SystemCtx } from '../types';
import { bestPublicOf, worldMix } from './mix';
import { econOf, policyState, clampR } from './policy';
import { automationShare } from './readouts';
import { worldTechEffects } from './techtree';

export const G_BASE: Record<RegionId, number> = { US: 0.018, CN: 0.04, ROW: 0.028 };
/** Share of global AI capex spent in each region [D]. */
const CAPEX_SHARE: Record<RegionId, number> = { US: 0.7, CN: 0.12, ROW: 0.18 };
const IMPORT_LEAK = 0.65;
const DOW0 = 44000;
const GDP0: Record<RegionId, number> = { US: 30000, CN: 19000, ROW: 60000 };
/** Hype index weights: per doubling of AI-lab revenue, per level of the best public model [D, fit]. */
export const HYPE = { rev: 0.2, level: 0.06 };

/** Global AI capex ($B/yr) from the chip market (WS3 state): supply × list price × 1.5 for datacentre, power and
 *  networking (AI 2027: ≈$400B global AI datacentre spend in 2025 [A27 R02]). */
export function aiCapex(s: GameStateV2): number {
  return (s.market.supplyQ * 4 * s.market.listPrice * 1e3 * 1.5) / 1e9;
}

/** Total AI-lab revenue run-rate ($B/yr): player + rivals + DeepCent. */
export function aiRevenue(s: GameStateV2): number {
  let x = s.player.finance.revenueRun;
  for (const r of s.rivals) if (r.core.status === 'active') x += r.finance.revenueRun;
  return x + s.china.lab.finance.revenueRun;
}

/** Share of US electricity capacity used by AI datacentres (H31; AI 2027 late 2026 ≈2.5%). */
export function dcPowerShare(s: GameStateV2): number {
  const w = s.hidden.timeline;
  const H = globalCompute(asV1World(w), 13e6, s.time.day / 365);
  return (H * 0.6 * s.power.kWPerH100e * 1.3) / 1e6 / 1340; // 60% in the US, PUE 1.3, 1,340 GW capacity
}

/** The CES automation factor X for a region (bounded). */
export function automationFactor(s: GameStateV2, r: RegionId): { X: number; tfp: number; cog: number; phys: number } {
  const econ = econOf(s);
  const Lag = bestPublicOf(s).AGENCY;
  const boost = 1 + (3 * Math.max(0, Lag - 10)) / 5;
  let cog = 0;
  let phys = 0;
  let vsum = 0;
  for (const def of SECTORS) {
    const st = s.world.sectors[r][def.id];
    const v = def.empPct * def.wage;
    vsum += v;
    const g = v * st.A * (0.3 + 0.5 * st.alpha) * boost;
    const wp = def.tasks.PHYS ?? 0;
    cog += g * (1 - wp);
    phys += g * wp;
  }
  cog /= vsum;
  phys /= vsum;
  const robots = r === 'US' ? Math.max(0, s.world.robots.stockHWE * s.world.fx.robotUS - 1.5e6 * 0.08) / 60e6 : 0;
  const C = 1 + 2 * ECON.LS0 * cog;
  const P = 1 + 2 * ECON.LS0 * phys + robots;
  const rho = (econ.sigma - 1) / econ.sigma;
  let X = Math.pow(0.5 * Math.pow(C, rho) + 0.5 * Math.pow(P, rho), 1 / rho);
  if (s.world.techs.W17?.discoveredDay === undefined) X = Math.min(X, 2.2);
  // Hulten TFP of task automation alone (no robot stock): LS0·Σ v·A·CS (the Acemoglu comparison, R16 §4.2).
  return { X, tfp: ECON.LS0 * (cog + phys), cog, phys };
}

/** AI task-automation TFP level (Hulten, excludes robots and SEZs) for a region. */
export const automationTfp = (s: GameStateV2, r: RegionId = 'US') => automationFactor(s, r).tfp;

/** Labor share LS = LS0·[1 − Σ v·D·(1 − ψ)] for a region. */
export function laborShareOf(s: GameStateV2, r: RegionId): number {
  let x = 0;
  let v = 0;
  for (const def of SECTORS) {
    const st = s.world.sectors[r][def.id];
    const w = def.empPct * def.wage;
    x += w * st.alpha * st.A;
    v += w;
  }
  return ECON.LS0 * (1 - (x / v) * (1 - ECON.psi));
}

function fearTarget(s: GameStateV2): number {
  let f = 0;
  for (const inc of s.player.safety.incidents) if (inc.severity >= 3 && inc.exposure === 'public' && s.time.day - inc.day < 90) f += 0.15;
  f += 0.3 * clampR((s.china.meters.taiwanTension - 60) / 40, 0, 1);
  if (s.capital.busted) f += 0.4;
  f += 0.04 * s.pub.rung;
  return clampR(f, 0, 1);
}

/** Monthly macro update. */
export function runMacro(s: GameStateV2, ctx: SystemCtx): void {
  const W = s.world;
  const fx = W.fx;
  const pol = policyState(s);
  const eff = worldTechEffects(s);
  const capex = aiCapex(s);
  const aiRev = aiRevenue(s);
  const mix = worldMix(s, ctx);
  if (!fx.earn0) {
    // First macro tick: anchor the Dow and hype baselines.
    fx.aiRev0 = Math.max(1, aiRev);
    fx.Lpub0 = mix.bestPublicLg;
    fx.aiCapexPrev = capex;
  }
  const dCapexYr = (capex - fx.aiCapexPrev) * 12;
  const gShock = pol.gShock;

  for (const r of REGIONS) {
    const M = W.macro[r];
    const gdpPrev = M.gdp;
    const gCapex = r === 'US' || r === 'ROW' || r === 'CN' ? (0.5 * (1 - IMPORT_LEAK) * dCapexYr * CAPEX_SHARE[r]) / gdpPrev : 0;
    const gTrend = G_BASE[r] + Math.max(-0.02, gCapex) + eff.g - (r === 'US' ? gShock : 0);
    fx.trend[r] *= Math.exp(gTrend / 12);
    const { X } = automationFactor(s, r);
    const vA = automationShare(s, r);
    const Xprev = fx.autoLevel[r];
    fx.autoLevel[r] = Math.min(X, Xprev * Math.exp((0.6 * vA) / 12)); // AI-driven growth ≤ 0.6·Σ v·A per year (GATE)
    let gdp = fx.trend[r] * fx.autoLevel[r];
    if (r === 'US') {
      if (W.robots.sezOpen) {
        if (fx.sezY <= 0) fx.sezY = 0.005 * gdp;
        const explosive = W.techs.W17?.discoveredDay !== undefined || vA >= 0.5;
        const gSez = Math.min(Math.LN2 / Math.max(0.02, W.robots.doublingYears), explosive ? 50 : 0.3);
        fx.sezY *= Math.exp(gSez / 12);
      }
      gdp += fx.sezY;
      W.robots.sezShare = fx.sezY / gdp;
    }
    const gm = Math.log(gdp / gdpPrev) * 12;
    M.g = M.g + (gm - M.g) / 3; // 3-month smoothing of the annualised rate
    M.gdp = gdp;
    M.laborShare = laborShareOf(s, r);
    let emp = 0;
    let emp0 = 0;
    for (const def of SECTORS) {
      emp += W.sectors[r][def.id].E;
      emp0 += W.sectors[r][def.id].E0;
    }
    M.wage = (M.laborShare / ECON.LS0) * (gdp / GDP0[r]) / (emp / emp0);
    const transfers = r === 'US' ? pol.transfersPctGdp / 100 : 0;
    M.gini = (r === 'US' ? ECON.gini0 : r === 'CN' ? 0.47 : 0.6) + 0.6 * (ECON.LS0 - M.laborShare) + (0.3 * (W.unemployment[r] - U_BASE[r])) / 100 - 0.5 * transfers;
    M.aiCapexShare = (capex * CAPEX_SHARE[r]) / gdp;
    M.energyPrice = Math.max(0.3, 1 + 2 * Math.max(0, dcPowerShare(s) - 0.015) + eff.energy);
  }
  fx.aiCapexPrev = capex;

  // Distribution, Dow, intelligence curse (US).
  const US = W.macro.US;
  const Y = US.gdp;
  W.aiOwnerShare = (0.4 * aiRev + Y * (ECON.LS0 - US.laborShare) * 0.5 + 0.8 * fx.sezY) / Y;
  const govRev = 0.18 * Y;
  W.intelligenceCurse = (0.21 * 0.4 * aiRev + 0.3 * fx.sezY) / govRev > 0.5;

  // Hype: AI-lab revenue growth and public capability milestones [D, fitted to "+30% in 2026"].
  const hypeStar = clampR(HYPE.rev * Math.log2(Math.max(0.1, aiRev) / fx.aiRev0) + HYPE.level * (mix.bestPublicLg - fx.Lpub0), -0.5, 2.5);
  fx.hype += (hypeStar - fx.hype) * 0.35;
  fx.fear += (fearTarget(s) - fx.fear) * 0.4;
  const earnings = Y * (1 - US.laborShare) * 0.25 + 0.3 * aiRev;
  if (!fx.earn0) fx.earn0 = earnings;
  const PE = 20 * (1 + 0.6 * fx.hype - 0.8 * fx.fear);
  const dow = DOW0 * (earnings / fx.earn0) * (PE / 20);
  W.dow = Math.round(Math.max(1000, dow));
  const d = new Date(Date.parse(s.time.startDate + 'T00:00:00Z') + ctx.day * 86400000);
  if (d.getUTCMonth() === 0 || !fx.dowJan) fx.dowJan = W.dow;

  // Jobs → public anxiety (R16 §1A.2 step 11): +8 per pp of unemployment, +3 per pp of youth unemployment.
  const uPrev = fx.uHist[fx.uHist.length - 1] ?? U_BASE.US;
  const dAnx = 8 * (W.unemployment.US - uPrev) + 3 * (W.youthUnemployment - fx.youthPrev);
  if (Math.abs(dAnx) > 0.05) ctx.bump('pub.jobAnxiety', dAnx, 'world: jobs', `U ${W.unemployment.US.toFixed(1)}%`);
  fx.youthPrev = Math.round(W.youthUnemployment * 1000) / 1000;
  fx.uHist.push(Math.round(W.unemployment.US * 1000) / 1000);
  if (fx.uHist.length > 13) fx.uHist.splice(0, fx.uHist.length - 13);
}

/** macro (310, monthly). */
export const macroSystem: EngineSystem = {
  id: 'macro', owner: 'WS5', cadence: 'monthly', order: 310, system: 'world',
  run(s, ctx) {
    runMacro(s, ctx);
  },
};

/** AI-driven TFP level (X − 1) for the US: the Acemoglu comparison readout. */
export const aiTfp = (s: GameStateV2, r: RegionId = 'US') => s.world.fx.autoLevel[r] - 1;
