// Milestones, world presets and sampling, baselines.
// Engine follows the AI 2027 timelines/takeoff code (uvafan/timelines-takeoff-ai-2027); audited against the
// primary sources in research/11-engine-audit.md (numbers in comments refer to its discrepancy table).
//  Stage 1 (to Superhuman Coder): progress in months of 2024/25-pace progress must reach base0 = g0 + cs,
//    g0 = time-horizon doubling work. Rate = share*M + (1-share)*C, with M = 1 + p*(s/p)^f (patched form).
//    From 2029 compute rate halves and M -> sqrt(0.5M(M-0.5)) (simple_forecasting_timelines.py l.273-319).
//  Stage 2 (SC -> SAR -> SIAR -> ASI): human-only research-years per gap, spent at multipliers
//    interpolated geometrically between anchors (takeoff/params.yaml: 5, 25, 250, 2000).
// Game unit for progress `p`: years. Stage 1 occupies [0, base0/12]; each later unit = 1 human-only year.

import { Rng } from '../engine/rng';
import type { AlignDiffId, BaselineId, World, WorldPresetId } from '../engine/types';

export interface Milestone {
  idx: number;
  short: string;
  name: string;
  label: string; // AI 2027 dashboard "frontier label"
  model: string; // AI 2027 model name at this milestone
  canon: string; // canonical AI 2027 date
  desc: string;
}

export const MILESTONES: Milestone[] = [
  { idx: 0, short: 'A0', name: 'Agent-0', label: 'Unreliable Agent', model: 'Agent-0', canon: '2025-05', desc: 'Stumbling agents. Useful for coding, unreliable elsewhere.' },
  { idx: 1, short: 'A1', name: 'Reliable Agent', label: 'Reliable Agent', model: 'Agent-1', canon: '2026-01', desc: 'Good at AI R&D and hacking. Algorithmic progress 50% faster.' },
  { idx: 2, short: 'A2', name: 'Online Learner', label: 'Reliable Agent', model: 'Agent-2', canon: '2027-01', desc: 'Continuous online learning. Triples algorithmic progress. Could survive if it escaped.' },
  { idx: 3, short: 'SC', name: 'Superhuman Coder', label: 'Superhuman Coder', model: 'Agent-3', canon: '2027-03', desc: 'Any coding task as well as the best engineer, 30x faster, 5% of the cost.' },
  { idx: 4, short: 'SAR', name: 'Superhuman AI Researcher', label: 'Superhuman AI Researcher', model: 'Agent-4', canon: '2027-08', desc: 'Better than the best human AI researchers at all research tasks.' },
  { idx: 5, short: 'SIAR', name: 'Superintelligent AI Researcher', label: 'Superintelligent AI Researcher', model: 'Agent-5', canon: '2027-11', desc: 'Vastly better than the best humans at AI research.' },
  { idx: 6, short: 'ASI', name: 'Artificial Superintelligence', label: 'Generally Superintelligent', model: 'ASI', canon: '2027-12', desc: 'Vastly better than the best humans at every cognitive task.' },
];

export function stage1(w: World) {
  return w.base0 / 12;
}

/** Stage-1 fractions where M reaches 1.5x (Agent-1) and 3x (Agent-2), per the scenario (audit #2). */
function agentFractions(w: World): [number, number] {
  const span = Math.log(w.sEx / w.pEx);
  if (span <= 0) return [0.3, 0.75];
  const f1 = Math.min(0.5, Math.max(0.15, Math.log(0.5 / w.pEx) / span));
  const f2 = Math.min(0.9, Math.max(f1 + 0.2, Math.log(2 / w.pEx) / span));
  return [f1, f2];
}

export function milestoneThresholds(w: World): number[] {
  const s1 = stage1(w);
  const [g1, g2, g3] = w.G;
  const [f1, f2] = agentFractions(w);
  return [0, s1 * f1, s1 * f2, s1, s1 + g1, s1 + g1 + g2, s1 + g1 + g2 + g3];
}

/** Stage 2 multipliers at SC, SAR, SIAR, ASI. Starts at 1+sEx for continuity with Stage 1. */
export function speeds(w: World): number[] {
  const sc = 1 + w.sEx;
  const sar = w.sarSpeed ?? Math.max(25, sc);
  return [sc, sar, Math.max(250, sar), 2000];
}

/** AI R&D progress multiplier M at progress p, before the post-2029 labor slowdown. */
export function multiplierAt(w: World, p: number): number {
  const s1 = stage1(w);
  if (p < s1) {
    const f = Math.max(0, p / s1);
    return 1 + w.pEx * Math.pow(w.sEx / w.pEx, f);
  }
  const sp = speeds(w);
  let start = s1;
  for (let k = 0; k < 3; k++) {
    const g = w.G[k];
    if (p < start + g || k === 2) {
      const f = g <= 0 ? 1 : Math.min(1, (p - start) / g);
      return sp[k] * Math.pow(sp[k + 1] / sp[k], f);
    }
    start += g;
  }
  return sp[3];
}

/** Post-2029 human-labor slowdown on the multiplier (AI 2027 code). */
export function laborSlowdown(m: number, year: number) {
  return year >= 2029 ? Math.sqrt(Math.max(0, 0.5 * m * (m - 0.5))) : m;
}

/** Compute-rate factor of the 2024 pace: halves from 2029 (AI 2027 code). */
export function computePace(year: number) {
  return year >= 2029 ? 0.5 : 1;
}

/** Fractional capability index 0..6 */
export function capIndex(w: World, p: number): number {
  const th = milestoneThresholds(w);
  for (let i = 0; i < th.length - 1; i++) {
    if (p < th[i + 1]) return i + Math.max(0, (p - th[i]) / Math.max(1e-9, th[i + 1] - th[i]));
  }
  return 6;
}

/** METR-style 80% time horizon of the best internal model, in minutes. */
export function horizonAt(w: World, p: number): number {
  const prog = p * 12; // months
  const nSC = Math.log2(w.hSC / w.h0);
  let n: number;
  if (prog >= w.g0) n = nSC;
  else if (w.growth === 'super') {
    const a = 1 - (prog * w.decay) / w.T;
    n = a <= 0 ? nSC : Math.log(a) / Math.log(1 - w.decay);
  } else if (w.growth === 'sub') n = Math.log(1 + (prog * w.decay) / w.T) / Math.log(1 + w.decay);
  else n = prog / w.T;
  n = Math.min(n, nSC);
  const s1 = stage1(w);
  const extra = p > s1 ? (p - s1) * 1.5 : 0; // cosmetic growth after SC
  return w.h0 * Math.pow(2, n + extra);
}

function doublingWork(T: number, n: number, growth: World['growth'], decay: number) {
  if (n <= 0) return 0;
  if (growth === 'exp' || decay <= 1e-6) return n * T;
  if (growth === 'super') return (T * (1 - Math.pow(1 - decay, n))) / decay;
  return (T * (Math.pow(1 + decay, n) - 1)) / decay;
}

const Z90 = 1.2815515655446004;
const lnFrom80 = (lo: number, hi: number, z: number) =>
  Math.exp((Math.log(lo) + Math.log(hi)) / 2 + z * ((Math.log(hi) - Math.log(lo)) / (2 * Z90)));

type BuildOpts = {
  h0: number; T: number; growth: World['growth']; decay: number; hSCmin?: number; g0?: number; cs: number;
  share: number; pEx: number; sEx: number; G: [number, number, number];
};

function build(label: string, o: BuildOpts): World {
  let hSC = o.hSCmin ?? 0;
  let g0 = o.g0 ?? 0;
  if (o.g0 !== undefined) {
    // Solve horizon needed from g0 (used to script the scenario preset)
    let n = 0;
    while (doublingWork(o.T, n, o.growth, o.decay) < o.g0 && n < 60) n += 0.01;
    hSC = o.h0 * Math.pow(2, n);
  } else {
    g0 = doublingWork(o.T, Math.log2(hSC / o.h0), o.growth, o.decay);
  }
  return {
    label, h0: o.h0, hSC, T: o.T, growth: o.growth, decay: o.decay, g0, cs: o.cs, base0: Math.max(2, g0 + o.cs),
    share: o.share, pEx: o.pEx, sEx: o.sEx, G: o.G, p0: 0, aifm: false,
    computeElasticity: 0.5, computeGrowth: 2.25, alignDifficulty: 1, doomThreshold: 0.4, chinaEfficiency: 0.7, neuraleseBoost: 1.3,
  };
}

const WORK_MONTH_MIN = 167 * 60;

export function makeWorld(rng: Rng, preset: WorldPresetId, align: AlignDiffId, _baseline: BaselineId): World {
  let w: World;
  switch (preset) {
    case 'ai2027':
      // Audit #1: g0 28.5, pEx 0.25 reproduce 1.5x Jan 2026, 3x Dec 2026, SC 2027-03-31, SAR end-Aug, ASI Dec 31 2027.
      w = build('AI 2027 scenario', { h0: 22, T: 4.74, growth: 'super', decay: 0.1, g0: 28.5, cs: 3.9, share: 0.5, pEx: 0.25, sEx: 4, G: [4.19, 16, 49.5] });
      break;
    case 'authors2026':
      // Audit #8 / §5.3: AIFM sampling_config(_q2_eli).yaml medians; cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y.
      w = build("Authors' 2026 model", { h0: 38, T: 4.5, growth: 'super', decay: 0.08, hSCmin: 125 * 12 * WORK_MONTH_MIN, cs: 17, share: 0.6, pEx: 0.1, sEx: 2, G: [1.52, 101, 1340] });
      w.aifm = true;
      w.computeGrowth = 2.5;
      break;
    case 'fast':
      // Audit #9 / §5.4: Daniel Aug-2026 (AC p50 2027.92) + AI 2027 p10 takeoff (SC->ASI ~0.21 y).
      w = build('Fast takeoff', { h0: 26, T: 4.0, growth: 'super', decay: 0.08, hSCmin: 12 * WORK_MONTH_MIN, cs: 10.3, share: 0.6, pEx: 0.15, sEx: 3, G: [0, 7.67, 47.5] });
      w.aifm = true;
      w.computeGrowth = 2.5;
      w.neuraleseBoost = 1.4;
      break;
    case 'slow':
      // Audit #22 / §5.5: METR 7-month exponential; AI 2027 median h_SC and cs; SAR anchor lowered to avoid a 1.6->25 jump.
      w = build('Skeptic world', { h0: 38, T: 7, growth: 'exp', decay: 0, hSCmin: 120 * WORK_MONTH_MIN, cs: 3.87, share: 0.5, pEx: 0.01, sEx: 0.6, G: [10, 394, 2000] });
      w.sarSpeed = 10;
      w.computeGrowth = 1.8;
      w.computeElasticity = 0.7;
      w.neuraleseBoost = 1.15;
      break;
    default: {
      // Lifland Apr-2025 distributions (simple_params.yaml); Gaussian copula with pairwise rho 0.7 on (T, cs, type).
      const zc = rng.normal();
      const a = Math.sqrt(0.7);
      const b = Math.sqrt(0.3);
      const corr = () => a * zc + b * rng.normal();
      const zT = corr();
      const zcs = corr();
      const u = 0.5 * (1 + erf(corr() / Math.SQRT2));
      const growth: World['growth'] = u < 0.45 ? 'super' : u < 0.9 ? 'exp' : 'sub';
      const zp = rng.normal();
      const zs = 0.7 * zp + Math.sqrt(0.51) * rng.normal();
      const T = lnFrom80(2.5, 9, zT);
      const hSCmonths = lnFrom80(1, 14400, rng.normal());
      const cs = lnFrom80(0.5, 30, zcs);
      const delay = lnFrom80(0.25, 6, rng.normal());
      const pEx = lnFrom80(0.03, 0.3, zp);
      const sEx = lnFrom80(1.5, 40, zs);
      // Takeoff gaps (takeoff/params.yaml, forecasting_takeoff.py)
      const zS = rng.normal();
      const zA = 0.8 * zS + 0.6 * rng.normal();
      let G1 = rng.chance(0.15) ? 0 : lnFrom80(1.5, 10, zS);
      const A = lnFrom80(1, 25, zA);
      const x = 10 + A;
      const G2 = (x * x * x) / 100 - x;
      const E = lnFrom80(0.3, 7.5, rng.normal());
      const x2 = x + G2;
      const G3 = Math.min(20000, x2 * Math.pow(x2 / x, E) - x2); // game cap (source caps at 1000 calendar years)
      // Audit #6: our Stage 2 starts at 1+sEx; stretch G1 so calendar time matches their fixed 5->25 phase.
      const s0 = 1 + sEx;
      const ref = (25 * 5 * Math.log(5)) / 20;
      G1 = s0 < 25 ? (G1 * ((25 * s0 * Math.log(25 / s0)) / (25 - s0))) / ref : (G1 * s0) / ref;
      const w0 = build('Sampled world', { h0: 15, T, growth, decay: 0.1, hSCmin: hSCmonths * WORK_MONTH_MIN, cs, share: 0.5, pEx, sEx, G: [G1, G2, G3] });
      // Audit #19: their run starts at 2025.25 minus the internal-vs-public delay; we start at 2025.5 already advanced.
      w0.p0 = (3 + delay) / 12;
      // Condition on observed history: no superhuman coder existed at game start (Jul 2025).
      w0.base0 = Math.max(w0.base0, w0.p0 * 12 + 3);
      w0.computeGrowth = 2.25;
      w0.computeElasticity = rng.range(0.35, 0.7);
      w0.chinaEfficiency = rng.range(0.6, 0.9); // AI 2027: DeepCent at ~half OB's pace with half its compute
      w0.neuraleseBoost = rng.range(1.15, 1.5);
      w = w0;
    }
  }
  w.alignDifficulty = align === 'easy' ? 0.55 : align === 'medium' ? 1 : align === 'hard' ? 1.7 : rng.lognormal80(0.5, 1.9);
  w.doomThreshold = align === 'sampled' ? rng.range(0.3, 0.5) : 0.4;
  return w;
}

function erf(x: number) {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

// ---------------- Baselines ----------------

export interface Baseline {
  id: BaselineId;
  name: string;
  desc: string;
  startDate: string;
  start: {
    cash: number; // $B
    revenueRun: number; // $B/yr
    valuation: number; // $B [design: AI 2027 gives no valuation]
    compute: number; // H100e
    globalCompute: number; // H100e
    staff: number;
    chinaShare: number;
    /** China's start gap in OOM of G under the player's V0 (was 0.6 progress-years). */
    chinaGapOom: number;
    approval: number;
    concern: number;
    jobAnxiety: number;
    xrisk: number;
    securityLevel: number;
  };
}

export const BASELINES: Baseline[] = [
  {
    id: 'classic',
    name: 'AI 2027 Classic',
    desc: 'The world as written in April 2025: start state from the scenario and its supplements.',
    startDate: '2025-07-01',
    start: {
      cash: 40, revenueRun: 12, valuation: 610, compute: 1.2e6, globalCompute: 13e6, staff: 2500,
      chinaShare: 0.12, chinaGapOom: 0.72, approval: -25, concern: 50, jobAnxiety: 65, xrisk: 40, securityLevel: 2.4,
    },
  },
  {
    id: 'reality',
    name: 'Reality-Updated',
    desc: 'Calibrated to measured data through 2026 (METR horizons, polls, multi-lab frontier).',
    startDate: '2025-07-01',
    start: {
      cash: 45, revenueRun: 13, valuation: 300, compute: 1.0e6, globalCompute: 14e6, staff: 3000,
      chinaShare: 0.13, chinaGapOom: 0.72, approval: -5, concern: 50, jobAnxiety: 71, xrisk: 43, securityLevel: 2.4,
    },
  },
];

// AIFM inputs/input_data.csv (audit #18): world_H100e and total_ai_company_H100e (leading company), by year.
const AIFM_YEARS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];
const AIFM_WORLD = [8.6e6, 22.4e6, 57.1e6, 135e6, 289e6, 537e6, 913e6, 1.51e9];
const AIFM_LEADER = [0.516e6, 1.79e6, 6.85e6, 21.6e6, 57.8e6, 107e6, 183e6, 300e6];

function logInterp(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]) return ys[0] * Math.pow(ys[1] / ys[0], x - xs[0]);
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return Math.exp(Math.log(ys[i]) + t * (Math.log(ys[i + 1]) - Math.log(ys[i])));
    }
  }
  const n = xs.length - 1;
  return ys[n] * Math.pow(ys[n] / ys[n - 1], x - xs[n]);
}

/** Global AI compute (H100e) `years` after the Jul 2025 start. */
export function globalCompute(w: World, start: number, years: number) {
  if (w.aifm) return logInterp(AIFM_YEARS, AIFM_WORLD, 2025.5 + years);
  // AI 2027 compute forecast: 2.25x/yr; slower after 2029 (audit #18)
  const pre = Math.min(years, 3.5);
  const post = Math.max(0, years - 3.5);
  return start * Math.pow(w.computeGrowth, pre) * Math.pow(Math.min(w.computeGrowth, 1.5), post);
}

/**
 * Reference R&D compute path of the leading lab (H100e). Progress speed is normalised to it, so a player
 * tracking it reproduces the source medians. AI 2027: 3.4x/yr for the leader, R&D ≈ 68% (audit #11).
 */
export function refCapCompute(w: World, years: number) {
  if (w.aifm) return 0.68 * logInterp(AIFM_YEARS, AIFM_LEADER, 2025.5 + years);
  const pre = Math.min(years, 2.5);
  const post = Math.max(0, years - 2.5);
  return 0.68e6 * Math.pow(3.4, pre) * Math.pow(1.6, post);
}
