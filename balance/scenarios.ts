// Calibration scenarios (design/bal/SCENARIOS.md): shared history to late 2026, three timelines, alignment levels.
// One machine-readable home for the checkpoints. The dashboard and the calibration tooling both read this file.
// The numbers come from design/bal/SC1-SPEC.md; every checkpoint carries its source.

export type TimelineId = 'fast' | 'central' | 'slow';
export type AlignLevel = 'beginner' | 'easy' | 'normal' | 'hard' | 'impossible';
export type Milestone = 'SC' | 'SAR' | 'SIAR' | 'ASI';

export interface Timeline {
  id: TimelineId;
  name: string;          // player-facing, e.g. 'Fast (AI 2027)'
  sourceModel: string;   // e.g. 'AI 2027 (Kokotajlo et al. 2025)'
  summary: string;       // one or two sentences in plain words
}

export interface AlignmentLevel {
  id: AlignLevel;
  name: string;
  tested: boolean;       // among the first three calibrated
  params: { id: string; value: number | string | null }[];  // registry ids that set the level; null = not yet chosen
  winBand?: { lo: number; hi: number };                     // the strong bot's win-rate band; set by the designer only
  notes?: string;
}

export interface Checkpoint {
  id: string;                         // reuse a balance/targets.ts id when one exists
  layer: 'history' | 'timeline' | 'alignment';
  timeline?: TimelineId;              // required when layer = 'timeline'
  align?: AlignLevel;                 // required when layer = 'alignment'
  quantity: 'horizon50' | 'horizon80' | 'worldCompute' | 'milestone' | 'interval' | 'revenue' | 'capex' | 'price'
    | 'adoption' | 'safetyEffect' | 'chinaGap' | 'other';
  label: string;                      // plain words
  date?: number;                      // decimal year the value refers to
  milestone?: Milestone;              // quantity 'milestone' (value = decimal year) or 'interval' (from -> milestone, in years)
  from?: Milestone;                   // quantity 'interval'
  value?: number;                     // central value
  lo?: number; hi?: number;           // band, only when the source gives one (bandFrom = 'source')
  unit: string;                       // 'min', 'H100e', 'USD B', 'year', 'years', 'fraction', ...
  bandFrom: 'source' | 'none' | 'designer';
  source: string;                     // citation in words
  sourceRef: string;                  // file:line in this repo, or a URL
  targetId?: string;                  // existing target in balance/targets.ts
  status: 'sourced' | 'unsure' | 'proposed' | 'blank';
  notes?: string;
}

export const TIMELINES: Timeline[] = [];
export const ALIGNMENT_LEVELS: AlignmentLevel[] = [];
export const CHECKPOINTS: Checkpoint[] = [];
