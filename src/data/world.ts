// Milestones, world presets and sampling, baselines.
// Engine follows the AI 2027 timelines/takeoff code (uvafan/timelines-takeoff-ai-2027), see research/03:
//  Stage 1 (to Superhuman Coder): progress in months of 2025-pace progress must reach base0 = g0 + cs,
//    g0 = time-horizon doubling work. Rate = share*M + (1-share)*C, with M = 1 + p*(s/p)^f.
//  Stage 2 (SC -> SAR -> SIAR -> ASI): human-only research-years per gap, spent at multipliers
//    interpolated geometrically between 1+s, 25, 250, 2000.
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
  { idx: 1, short: 'A1', name: 'Reliable Agent', label: 'Reliable Agent', model: 'Agent-1', canon: '2026-01', desc: 'Good at AI R&D and hacking. R&D ~1.5x faster.' },
  { idx: 2, short: 'A2', name: 'Online Learner', label: 'Reliable Agent', model: 'Agent-2', canon: '2027-01', desc: 'Continuous online learning. Near top research engineers. Could survive if it escaped.' },
  { idx: 3, short: 'SC', name: 'Superhuman Coder', label: 'Superhuman Coder', model: 'Agent-3', canon: '2027-03', desc: 'Any coding task as well as the best engineer, 30x faster, 5% of the cost.' },
  { idx: 4, short: 'SAR', name: 'Superhuman AI Researcher', label: 'Superhuman AI Researcher', model: 'Agent-4', canon: '2027-08', desc: 'Better than the best human AI researchers at all research tasks.' },
  { idx: 5, short: 'SIAR', name: 'Superintelligent AI Researcher', label: 'Superintelligent AI Researcher', model: 'Agent-5', canon: '2027-11', desc: 'Vastly better than the best humans at AI research.' },
  { idx: 6, short: 'ASI', name: 'Artificial Superintelligence', label: 'Generally Superintelligent', model: 'ASI', canon: '2027-12', desc: 'Vastly better than the best humans at every cognitive task.' },
];

/** Fractions of Stage 1 at which Agent-1 / Agent-2 are reached (fit to scenario dates). */
const F_A1 = 0.35;
const F_A2 = 0.8;

export function stage1(w: World) {
  return w.base0 / 12;
}

export function milestoneThresholds(w: World): number[] {
  const s1 = stage1(w);
  const [g1, g2, g3] = w.G;
  return [0, s1 * F_A1, s1 * F_A2, s1, s1 + g1, s1 + g1 + g2, s1 + g1 + g2 + g3];
}

export function milestoneAt(w: World, p: number): number {
  const th = milestoneThresholds(w);
  let m = 0;
  for (let i = 0; i < th.length; i++) if (p >= th[i]) m = i;
  return m;
}

/** Stage 2 multipliers at SC, SAR, SIAR, ASI */
export function speeds(w: World): number[] {
  const sc = 1 + w.sEx;
  return [sc, Math.max(sc * 1.5, 25), 250, 2000];
}

/** AI R&D progress multiplier M at progress p. */
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

// ---------------- World presets ----------------

export interface WorldPreset {
  id: WorldPresetId;
  name: string;
  short: string;
  desc: string;
}

export const WORLD_PRESETS: WorldPreset[] = [
  { id: 'sampled', name: 'Unknown world', short: 'Sampled', desc: 'Hidden parameters drawn from the AI 2027 forecast distributions (Lifland, Apr 2025). Revealed at the end.' },
  { id: 'ai2027', name: 'AI 2027 scenario', short: 'Scenario', desc: 'Default play follows the published story: SC Mar 2027, SAR Aug 2027, ASI Dec 2027.' },
  { id: 'authors2026', name: "Authors' 2026 model", short: 'AIFM', desc: 'AI Futures Model, Aug 2026 central forecast (Lifland). Automated coder ~2030.' },
  { id: 'fast', name: 'Fast takeoff', short: 'Fast', desc: 'Kokotajlo Aug 2026 timelines with a fast takeoff: SC to ASI in months.' },
  { id: 'slow', name: 'Skeptic world', short: 'Skeptic', desc: 'Plain METR exponential, little AI speedup, slow takeoff (titotal critique).' },
];

export const ALIGN_PRESETS: { id: AlignDiffId; name: string; desc: string }[] = [
  { id: 'sampled', name: 'Unknown', desc: 'Drawn at random. You will not know.' },
  { id: 'easy', name: 'Easy', desc: 'Traits drift slowly; standard methods mostly work.' },
  { id: 'medium', name: 'Medium', desc: 'Real but manageable drift.' },
  { id: 'hard', name: 'Hard', desc: 'Misalignment is the default without serious investment.' },
];

const Z90 = 1.2815515655446004;
const lnFrom80 = (lo: number, hi: number, z: number) =>
  Math.exp((Math.log(lo) + Math.log(hi)) / 2 + z * ((Math.log(hi) - Math.log(lo)) / (2 * Z90)));

function common(): Omit<World, 'label' | 'h0' | 'hSC' | 'T' | 'growth' | 'decay' | 'g0' | 'cs' | 'base0' | 'share' | 'pEx' | 'sEx' | 'G'> {
  return { computeElasticity: 0.5, computeGrowth: 2.25, alignDifficulty: 1, doomThreshold: 0.4, chinaEfficiency: 0.85, neuraleseBoost: 1.3 };
}

function build(
  label: string,
  o: { h0: number; T: number; growth: World['growth']; decay: number; hSCmin?: number; g0?: number; cs: number; share: number; pEx: number; sEx: number; G: [number, number, number] },
): World {
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
  return { ...common(), label, h0: o.h0, hSC, T: o.T, growth: o.growth, decay: o.decay, g0, cs: o.cs, base0: Math.max(2, g0 + o.cs), share: o.share, pEx: o.pEx, sEx: o.sEx, G: o.G };
}

const WORK_MONTH_MIN = 167 * 60;

export function makeWorld(rng: Rng, preset: WorldPresetId, align: AlignDiffId, baseline: BaselineId): World {
  // Horizon of the frontier at game start (Jul 2025): AI27 trend ~22 min; METR measured GPT-5 p80 = 38 min (Aug 2025).
  const h0 = baseline === 'reality' ? 38 : 22;
  let w: World;
  switch (preset) {
    case 'ai2027':
      w = build('AI 2027 scenario', { h0, T: 4.74, growth: 'super', decay: 0.1, g0: 20, cs: 3.9, share: 0.5, pEx: 0.15, sEx: 4, G: [4.19, 16, 49.5] });
      w.neuraleseBoost = 1.3;
      break;
    case 'authors2026':
      w = build("Authors' 2026 model", { h0, T: 4.5, growth: 'super', decay: 0.03, hSCmin: 125 * 12 * WORK_MONTH_MIN, cs: 0, share: 0.6, pEx: 0.1, sEx: 2, G: [1.2, 115, 2970] });
      w.computeGrowth = 2.0;
      break;
    case 'fast':
      w = build('Fast takeoff', { h0, T: 4.0, growth: 'super', decay: 0.08, hSCmin: 12 * WORK_MONTH_MIN, cs: 0, share: 0.6, pEx: 0.15, sEx: 3, G: [0, 2.31, 0.8] });
      w.computeGrowth = 2.4;
      w.neuraleseBoost = 1.4;
      break;
    case 'slow':
      w = build('Skeptic world', { h0, T: 7, growth: 'exp', decay: 0, hSCmin: 120 * WORK_MONTH_MIN, cs: 6, share: 0.5, pEx: 0.01, sEx: 0.6, G: [10, 394, 2000] });
      w.computeGrowth = 1.8;
      w.computeElasticity = 0.7;
      w.neuraleseBoost = 1.15;
      break;
    default: {
      // Lifland Apr-2025 distributions (research/03 §1.4.1-1.4.2), Gaussian copula rho=0.7 on (T, cs, type).
      const zc = rng.normal();
      const corr = () => 0.7 * zc + Math.sqrt(1 - 0.49) * rng.normal();
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
      // Takeoff gaps
      const zS = rng.normal();
      const zA = 0.8 * zS + 0.6 * rng.normal();
      const G1 = rng.chance(0.15) ? 0 : lnFrom80(1.5, 10, zS);
      const A = lnFrom80(1, 25, zA);
      const x = 10 + A;
      const G2 = (x * x * x) / 100 - x;
      const E = lnFrom80(0.3, 7.5, rng.normal());
      const x2 = x + G2;
      const G3 = Math.min(20000, x2 * Math.pow(x2 / x, E) - x2);
      // AI27 h0 = 15 min at 2025.25; advance to game start (~3 months of progress) plus internal-vs-public delay.
      const pre = 3.2 + delay;
      const w0 = build('Sampled world', { h0: 15, T, growth, decay: 0.1, hSCmin: hSCmonths * WORK_MONTH_MIN, cs, share: 0.5, pEx: lnFrom80(0.03, 0.3, zp), sEx: lnFrom80(1.5, 40, zs), G: [G1, G2, G3] });
      const nPre = growth === 'exp' ? pre / T : growth === 'super' ? Math.log(Math.max(0.01, 1 - (pre * 0.1) / T)) / Math.log(0.9) : Math.log(1 + (pre * 0.1) / T) / Math.log(1.1);
      w0.h0 = 15 * Math.pow(2, nPre);
      w0.g0 = Math.max(0, w0.g0 - pre);
      w0.base0 = Math.max(2, w0.g0 + cs);
      if (baseline === 'reality') w0.h0 = Math.max(w0.h0, 38);
      w0.computeGrowth = rng.normal80(1.9, 2.5);
      w0.computeElasticity = rng.range(0.35, 0.7);
      w0.chinaEfficiency = rng.range(0.7, 1.0);
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
    valuation: number; // $B
    compute: number; // H100e
    globalCompute: number; // H100e
    staff: number;
    chinaShare: number;
    chinaGapYears: number;
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
    desc: 'The world as written in April 2025: start state from the scenario dashboard and supplements.',
    startDate: '2025-07-01',
    start: {
      cash: 40, revenueRun: 12, valuation: 610, compute: 1.2e6, globalCompute: 13e6, staff: 2500,
      chinaShare: 0.12, chinaGapYears: 0.45, approval: -25, concern: 50, jobAnxiety: 65, xrisk: 40, securityLevel: 2.4,
    },
  },
  {
    id: 'reality',
    name: 'Reality-Updated',
    desc: 'Calibrated to measured data through 2026 (METR horizons, polls, compute).',
    startDate: '2025-07-01',
    start: {
      cash: 45, revenueRun: 13, valuation: 300, compute: 1.0e6, globalCompute: 14e6, staff: 3000,
      chinaShare: 0.13, chinaGapYears: 0.5, approval: -5, concern: 50, jobAnxiety: 71, xrisk: 43, securityLevel: 2.4,
    },
  },
];

/** Global AI compute (H100e) t years after start: 2.25x/yr to 2027, slower after (wafer limits). */
export function globalCompute(start: number, years: number, growth: number) {
  const pre = Math.min(years, 2.5);
  const post = Math.max(0, years - 2.5);
  return start * Math.pow(growth, pre) * Math.pow(Math.min(growth, 1.7), post);
}

/** Reference path for OpenBrain R&D compute (AI27 trajectory), used to normalise progress speed. */
export function refCapCompute(years: number, growth: number) {
  // ~1.2M total mid-2025, ~62% internal R&D; OB share grows ~1.4x/yr on top of global growth until 2028.
  const pre = Math.min(years, 2.5);
  const post = Math.max(0, years - 2.5);
  return 1.2e6 * 0.62 * Math.pow(growth * 1.4, pre) * Math.pow(1.5, post);
}
