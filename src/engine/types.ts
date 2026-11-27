// Shared timeline types: the calibrated world model in data/world.ts (reused by v2, V2-SPEC §3.1).

/** R3.1: the per-game draw worlds (data/v2/timelineWorlds.ts): the authors2026 compute table with one AI Futures Model run's translated settings per game. */
export type TimelinePresetId = 'tl-fast' | 'tl-central' | 'tl-slow';
/** The world is one of the three timelines; the old named presets and the sampled world are removed. */
export type WorldPresetId = TimelinePresetId;
export type AlignDiffId = 'sampled' | 'easy' | 'medium' | 'hard';

/** Hidden world parameters, sampled at game start. */
export interface World {
  label: string;
  /** 80% time horizon at game start (minutes) and horizon needed for Superhuman Coder */
  h0: number;
  hSC: number;
  /** Horizon doubling time (months) and growth type */
  T: number;
  growth: 'super' | 'exp' | 'sub';
  decay: number;
  /** Months of 2025-pace progress for horizon growth (g0) + cost/speed gap (cs) = base0 */
  g0: number;
  cs: number;
  base0: number;
  /** Software share of progress, present and SC multiplier excess (M = 1 + p*(s/p)^f) */
  share: number;
  pEx: number;
  sEx: number;
  /** Human-only research-years SC->SAR, SAR->SIAR, SIAR->ASI */
  G: [number, number, number];
  /** Progress already made at game start (sampled worlds start mid-trajectory) */
  p0: number;
  /** Use AI Futures Model compute tables instead of AI 2027 growth rates */
  aifm: boolean;
  /** Override the SAR multiplier anchor (default max(25, 1+sEx)) */
  sarSpeed?: number;
  /** Elasticity of progress to capabilities compute relative to reference path */
  computeElasticity: number;
  /** Global compute growth per year */
  computeGrowth: number;
  /** Alignment difficulty multiplier on trait growth (0.5 easy .. 2 hard) */
  alignDifficulty: number;
  /** Threshold of hidden misalignment above which ASI goes wrong */
  doomThreshold: number;
  /** Neuralese speedup to progress if adopted */
  neuraleseBoost: number;
}
