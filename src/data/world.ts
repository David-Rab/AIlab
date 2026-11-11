// Milestones, baselines, world presets and sampling.
// Sources: research/01 (scenario), 02 (compute), 03 (timelines/takeoff), 07/09 (calibration).

import { Rng } from '../engine/rng';
import type { AlignDiffId, BaselineId, World, WorldPresetId } from '../engine/types';

export interface Milestone {
  idx: number;
  short: string;
  name: string;
  label: string; // AI 2027 dashboard "frontier label"
  model: string; // AI 2027 model name at this milestone
  /** Canonical AI 2027 date */
  canon: string;
  desc: string;
}

export const MILESTONES: Milestone[] = [
  { idx: 0, short: 'A0', name: 'Agent-0', label: 'Unreliable Agent', model: 'Agent-0', canon: '2025-05', desc: 'Stumbling agents. Useful for coding, unreliable elsewhere.' },
  { idx: 1, short: 'A1', name: 'Reliable Agent', label: 'Reliable Agent', model: 'Agent-1', canon: '2026-01', desc: 'Good at AI R&D and hacking. R&D ~1.5x faster.' },
  { idx: 2, short: 'A2', name: 'Online Learner', label: 'Reliable Agent', model: 'Agent-2', canon: '2027-01', desc: 'Continuous online learning. Near top research engineers. Could survive if it escaped.' },
  { idx: 3, short: 'SC', name: 'Superhuman Coder', label: 'Superhuman Coder', model: 'Agent-3', canon: '2027-03', desc: 'Does any coding task as well as the best engineer, far faster and cheaper.' },
  { idx: 4, short: 'SAR', name: 'Superhuman AI Researcher', label: 'Superhuman AI Researcher', model: 'Agent-4', canon: '2027-08', desc: 'Better than the best human AI researchers at all research tasks.' },
  { idx: 5, short: 'SIAR', name: 'Superintelligent AI Researcher', label: 'Superintelligent AI Researcher', model: 'Agent-5', canon: '2027-11', desc: 'Vastly better than humans at AI research.' },
  { idx: 6, short: 'ASI', name: 'Artificial Superintelligence', label: 'Generally Superintelligent', model: 'ASI', canon: '2027-12', desc: 'Vastly better than the best humans at every cognitive task.' },
];

/** Progress thresholds (human-only research-years) for each milestone, given world params. */
export function milestoneThresholds(w: World): number[] {
  const sc = w.pSC;
  return [0, sc * 0.22, sc * 0.72, sc, sc + w.gapSAR, sc + w.gapSAR + w.gapSIAR, sc + w.gapSAR + w.gapSIAR + w.gapASI];
}

export function milestoneAt(w: World, p: number): number {
  const th = milestoneThresholds(w);
  let m = 0;
  for (let i = 0; i < th.length; i++) if (p >= th[i]) m = i;
  return m;
}

/** R&D progress multiplier at progress p: log-linear interpolation between milestone anchors. */
export function multiplierAt(w: World, p: number): number {
  const th = milestoneThresholds(w);
  if (p <= 0) return w.mult[0];
  for (let i = 0; i < th.length - 1; i++) {
    if (p < th[i + 1]) {
      const t = (p - th[i]) / (th[i + 1] - th[i]);
      return Math.exp(Math.log(w.mult[i]) + t * (Math.log(w.mult[i + 1]) - Math.log(w.mult[i])));
    }
  }
  return w.mult[w.mult.length - 1];
}

/** Fractional capability index (0..6) for display and gating. */
export function capIndex(w: World, p: number): number {
  const th = milestoneThresholds(w);
  for (let i = 0; i < th.length - 1; i++) {
    if (p < th[i + 1]) return i + (p - th[i]) / (th[i + 1] - th[i]);
  }
  return 6;
}

// ---------------- World presets ----------------
// Anchors: AI27 scenario has SC Mar 2027, SAR Aug 2027, SIAR Nov 2027, ASI Dec 2027.
// Multipliers: SC ~5x, SAR ~25x, SIAR ~250x, ASI ~2000x (AI27 takeoff forecast); early anchors from the
// security forecast table (1.3x Dec 2025, 2x Dec 2026) and scenario (1.5x early 2026, 3x Jan 2027).

const BASE_MULT = [1.15, 1.5, 3, 5, 25, 250, 2000];

export interface WorldPreset {
  id: WorldPresetId;
  name: string;
  short: string;
  desc: string;
  available: boolean;
}

export const WORLD_PRESETS: WorldPreset[] = [
  { id: 'sampled', name: 'Unknown world', short: 'Sampled', desc: 'Hidden parameters drawn from AI 2027 forecast distributions. Revealed at the end.', available: true },
  { id: 'ai2027', name: 'AI 2027 scenario', short: 'Scenario', desc: 'Calibrated so the default path follows the published story: SC Mar 2027, ASI Dec 2027.', available: true },
  { id: 'authors2026', name: "Authors' 2026 update", short: 'Later', desc: 'Medians pushed later, per the authors\' 2025-26 updates: SC ~2029.', available: true },
  { id: 'fast', name: 'Fast takeoff', short: 'Fast', desc: 'Short timelines and explosive takeoff.', available: true },
  { id: 'slow', name: 'Skeptic world', short: 'Slow', desc: 'Long timelines, compute bottlenecks bite, takeoff is gradual.', available: true },
];

export const ALIGN_PRESETS: { id: AlignDiffId; name: string; desc: string }[] = [
  { id: 'sampled', name: 'Unknown', desc: 'Drawn at random. You will not know.' },
  { id: 'easy', name: 'Easy', desc: 'Traits drift slowly; standard methods mostly work.' },
  { id: 'medium', name: 'Medium', desc: 'Real but manageable drift.' },
  { id: 'hard', name: 'Hard', desc: 'Misalignment is the default without serious investment.' },
];

export function makeWorld(rng: Rng, preset: WorldPresetId, align: AlignDiffId): World {
  let w: World;
  switch (preset) {
    case 'ai2027':
      w = { pSC: 3.3, gapSAR: 5, gapSIAR: 20, gapASI: 65, mult: [...BASE_MULT], computeElasticity: 0.5, computeGrowth: 2.25, alignDifficulty: 1, doomThreshold: 0.4, chinaEfficiency: 0.85, neuraleseBoost: 1.35, label: 'AI 2027 scenario' };
      break;
    case 'authors2026':
      w = { pSC: 6.5, gapSAR: 7, gapSIAR: 35, gapASI: 120, mult: [1.1, 1.35, 2.2, 4, 15, 120, 800], computeElasticity: 0.55, computeGrowth: 2.0, alignDifficulty: 1, doomThreshold: 0.4, chinaEfficiency: 0.85, neuraleseBoost: 1.3, label: "Authors' 2026 update" };
      break;
    case 'fast':
      w = { pSC: 2.4, gapSAR: 3, gapSIAR: 12, gapASI: 40, mult: [1.2, 1.7, 3.5, 6, 40, 400, 3000], computeElasticity: 0.4, computeGrowth: 2.4, alignDifficulty: 1, doomThreshold: 0.4, chinaEfficiency: 0.85, neuraleseBoost: 1.4, label: 'Fast takeoff' };
      break;
    case 'slow':
      w = { pSC: 11, gapSAR: 12, gapSIAR: 60, gapASI: 250, mult: [1.05, 1.2, 1.7, 2.5, 8, 40, 200], computeElasticity: 0.7, computeGrowth: 1.8, alignDifficulty: 1, doomThreshold: 0.4, chinaEfficiency: 0.8, neuraleseBoost: 1.2, label: 'Skeptic world' };
      break;
    default: {
      // Sampled: lognormal 80% CIs loosely following AI27 timelines + takeoff supplements.
      const scale = rng.lognormal80(0.6, 2.6); // timeline stretch vs scenario
      const speed = rng.lognormal80(0.5, 2.0); // takeoff multiplier scale
      w = {
        pSC: 3.3 * scale,
        gapSAR: rng.lognormal80(2, 12),
        gapSIAR: rng.lognormal80(8, 60),
        gapASI: rng.lognormal80(25, 220),
        mult: BASE_MULT.map((m, i) => (i < 2 ? m : Math.max(1.2, m * Math.pow(speed, i / 4)))),
        computeElasticity: rng.range(0.35, 0.7),
        computeGrowth: rng.normal80(1.9, 2.5),
        alignDifficulty: 1,
        doomThreshold: 0.4,
        chinaEfficiency: rng.range(0.7, 1.0),
        neuraleseBoost: rng.range(1.15, 1.5),
        label: 'Sampled world',
      };
    }
  }
  w.alignDifficulty =
    align === 'easy' ? 0.55 : align === 'medium' ? 1 : align === 'hard' ? 1.7 : rng.lognormal80(0.5, 1.9);
  w.doomThreshold = align === 'sampled' ? rng.range(0.3, 0.5) : 0.4;
  return w;
}

// ---------------- Baselines ----------------

export interface Baseline {
  id: BaselineId;
  name: string;
  desc: string;
  startDate: string;
  available: boolean;
  start: {
    cash: number; // $B
    revenueRun: number; // $B/yr
    valuation: number;
    compute: number; // H100e
    globalCompute: number; // H100e
    staff: number;
    chinaShare: number;
    chinaGapYears: number; // in progress units behind OB
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
    desc: 'The world as written in April 2025. Start state from the scenario and its supplements.',
    startDate: '2025-07-01',
    available: true,
    start: {
      cash: 40, revenueRun: 12, valuation: 610, compute: 1.2e6, globalCompute: 13e6, staff: 2500,
      chinaShare: 0.12, chinaGapYears: 0.6, approval: -25, concern: 50, jobAnxiety: 65, xrisk: 40, securityLevel: 2.4,
    },
  },
  {
    id: 'reality',
    name: 'Reality-Updated',
    desc: 'Calibrated to what actually happened through 2026.',
    startDate: '2025-07-01',
    available: true,
    start: {
      cash: 45, revenueRun: 13, valuation: 300, compute: 1.0e6, globalCompute: 14e6, staff: 3000,
      chinaShare: 0.13, chinaGapYears: 0.6, approval: -5, concern: 50, jobAnxiety: 71, xrisk: 43, securityLevel: 2.4,
    },
  },
];

/** AI27 reference path for OpenBrain capabilities compute (H100e), used to normalise progress speed. */
export function refCapCompute(yearsFromStart: number, growth: number) {
  // ~1.2M total in mid-2025, ~55% internal R&D use (training + synthetic + experiments + automation).
  return 1.2e6 * 0.62 * Math.pow(growth * 1.25, yearsFromStart);
}
