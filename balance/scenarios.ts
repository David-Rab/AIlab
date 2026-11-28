// Calibration scenarios (design/bal/SCENARIOS.md): shared history to late 2026, three timelines, alignment levels.
// One machine-readable home for the sourced values (history and per-timeline checkpoints): balance/targets.ts holds the
// bands, tolerances and measurement, and a target names its checkpoint here instead of repeating the number (balance/schema.ts).
// The dashboard and the calibration tooling both read this file. The numbers come from design/bal/SC1-SPEC.md; every checkpoint carries its source.

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
  id: string;                         // its own id (H<n>.*, <timeline>.*, <level>.*); a target in balance/targets.ts names it (Target.checkpoint), never the other way
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
  lo?: number; hi?: number;           // band, only when the source gives one (bandFrom = 'source'); for a distribution, p25 and p75
  p10?: number; p90?: number;         // outer band of a distribution (needs lo/hi: p10 <= lo, hi <= p90); a percentile that is not reached is left out
  neverBy2100?: number;               // distribution of a date: the share of samples (0 to 1) that do not reach it by 2100; the percentiles count them as later
  series?: 'speedup' | 'effCompute' | 'trainCompute'; // which chart a dated 'other' timeline value belongs to
  phase?: number;                     // timeline checkpoint measured relative to the group's own AC (the game's SC) at AC + phase years, instead of at a date (R3.2); then date is unset
  unit: string;                       // 'min', 'H100e', 'USD B', 'year', 'years', 'fraction', ...
  bandFrom: 'source' | 'none' | 'designer';
  source: string;                     // citation in words
  sourceRef: string;                  // file:line in this repo, or a URL
  status: 'sourced' | 'unsure' | 'proposed' | 'blank';
  notes?: string;
}

export const TIMELINES: Timeline[] = [
  {
    id: 'fast',
    name: 'Fast',
    sourceModel: "AI Futures Model (aifm-public 1c40ecdb), Eli's config unchanged; 3,000 runs split by SAR date: the runs in percentiles 20-30 (290 runs)",
    summary: 'AI that codes better than any human arrives around the end of 2027 (median), AI that does AI research better than any human in spring 2028, and superintelligence in late 2029 (median). The tail is long: one run in four has superintelligence only after 2034.',
  },
  {
    id: 'central',
    name: 'Central',
    sourceModel: "AI Futures Model (aifm-public 1c40ecdb), Eli's config unchanged; 3,000 runs split by SAR date: the runs in percentiles 45-55 (289 runs)",
    summary: 'AI that codes better than any human arrives around late 2029 (median), AI that does AI research better than any human in mid-2030, and superintelligence around 2033 (median). One run in twenty has no superintelligence by 2100.',
  },
  {
    id: 'slow',
    name: 'Slow',
    sourceModel: "AI Futures Model (aifm-public 1c40ecdb), Eli's config unchanged; 3,000 runs split by SAR date: the runs in percentiles 70-80 (290 runs)",
    summary: 'AI that codes better than any human arrives around late 2034 (median), AI that does AI research better than any human in 2037, and superintelligence around 2046 (median). About one run in six has no superintelligence by 2100.',
  },
];

// Levels differ in the unknowns only (latent shift, loss-of-control threshold). winBand is left to the designer.
const levelParams = (shift: number | null, threshold: number | null, fixed: boolean): AlignmentLevel['params'] => [
  { id: 'cap.hidden.alignmentShift', value: shift },
  { id: 'doomThreshold', value: threshold },
  { id: 'cap.hidden.difficultyExponent', value: fixed ? 0.35 : null },
  { id: 'cap.DIFFICULTY_RANGE', value: fixed ? '[0.6, 1.65]' : null },
  { id: 'core.DIFFICULTY_SCALE', value: fixed ? 1 : null },
  { id: 'saf.CONTROL.toleranceSd', value: fixed ? 0.06 : null },
];
const FIXED_NOTE = 'The last four params are the same at every level today (SC1 §6).';
const LEVEL_NOTE = 'doomThreshold has no registry id yet (inline, src/data/world.ts:228); the sampled setup draws it from U(0.3, 0.5). saf.AGENDAS.* are moved by the latents and carry no level value. alignDifficulty (0.55 / 1 / 1.7 for easy / medium / hard) is not read by the current engine.';
const BLANK_LEVEL = 'Not yet chosen: SC1 §6 leaves shift and threshold blank.';

export const ALIGNMENT_LEVELS: AlignmentLevel[] = [
  { id: 'beginner', name: 'Beginner', tested: false, params: levelParams(null, null, false), notes: `${BLANK_LEVEL} ${LEVEL_NOTE}` },
  { id: 'easy', name: 'Easy', tested: true, params: levelParams(0.8, 0.4, true), notes: `Shift +0.8 and threshold 0.4 are today's values (hidden.ts:85-87, world.ts:228), no source. ${FIXED_NOTE} ${LEVEL_NOTE}` },
  { id: 'normal', name: 'Normal', tested: true, params: levelParams(0, 0.4, true), notes: `Shift 0 and threshold 0.4 are today's medium values (hidden.ts:85-87, world.ts:228), no source. ${FIXED_NOTE} ${LEVEL_NOTE}` },
  { id: 'hard', name: 'Hard', tested: true, params: levelParams(-0.8, 0.4, true), notes: `Shift -0.8 and threshold 0.4 are today's values (hidden.ts:85-87, world.ts:228), no source. ${FIXED_NOTE} ${LEVEL_NOTE}` },
  { id: 'impossible', name: 'Impossible', tested: false, params: levelParams(null, null, false), notes: `${BLANK_LEVEL} ${LEVEL_NOTE}` },
];

// ───────────── builders (data only; one call = one checkpoint) ─────────────
// Dates are decimal years: a month is read at mid-month, a quarter at its middle, a whole year at mid-year (x.5), an
// "end of year" at x.99; where SC1 gives a decimal (2026.27 for Apr 2026) that is used. Money in USD B, compute in H100e, horizons in minutes.
type Extra = Partial<Checkpoint>;
const hist = (id: string, quantity: Checkpoint['quantity'], label: string, date: number, unit: string, source: string, sourceRef: string, x: Extra = {}): Checkpoint =>
  ({ id, layer: 'history', quantity, label, date, unit, bandFrom: 'none', source, sourceRef, status: 'sourced', ...x });
const tl = (timeline: TimelineId, id: string, quantity: Checkpoint['quantity'], label: string, unit: string, source: string, sourceRef: string, x: Extra = {}): Checkpoint =>
  ({ id: `${timeline}.${id}`, layer: 'timeline', timeline, quantity, label, unit, bandFrom: 'none', source, sourceRef, status: 'sourced', ...x });
const al = (align: AlignLevel, id: string, label: string, source: string, sourceRef: string, x: Extra = {}): Checkpoint =>
  ({ id: `${align}.${id}`, layer: 'alignment', align, quantity: 'other', label, unit: 'fraction', bandFrom: 'none', source, sourceRef, status: 'sourced', ...x });

const m = (millions: number) => Math.round(millions * 1_000_000); // millions to units, avoids float noise
const SC1 = 'design/bal/SC1-SPEC.md';
/** The 15th of a month as a decimal year, in the game's convention (src/engine/v2/core/time.ts decimalYearOf): exact, so a reader can turn it back into the day. */
const d15 = (year: number, month: number) => year + (month - 1) / 12 + 14 / 365;

// ───────────── shared history (SC1 §1): holds in every cell ─────────────
const HISTORY: Checkpoint[] = [
  // H1 METR 50% doubling time
  hist('H1.metr.h50.doubling', 'other', 'METR 50% horizon doubling time, 2023-26', 2026.99, 'months', 'METR TH1.1 (129 d since 2023 [104,158]; 88.6 d since 2024)', 'research/20:50; research/03:276',
    { value: 4.2, lo: 3.4, hi: 5.2, bandFrom: 'source', notes: 'Band is the METR interval since 2023. METR also gives 6.2 months all-time. Date is the end of the 2023-26 span.' }),
  // H2 METR 80% horizon of the frontier
  hist('H2.metr.h80.2025-04', 'horizon80', 'METR 80% horizon of the frontier, Apr 2025', 2025.27, 'min', 'METR TH1.1', 'research/09:59; research/03:262-274', { value: 30, notes: 'Game tolerance +-15% (targets.ts:109).' }),
  hist('H2.metr.h80.2025-12', 'horizon80', 'METR 80% horizon of the frontier, Dec 2025 (GPT-5.2)', 2025.96, 'min', 'METR TH1.1', 'research/09:59; research/03:262-274',
    { value: 66, status: 'unsure', notes: 'Source conflict: 32 min (AI Futures model anchor, research/03:203) vs 66 min (GPT-5.2, research/09:59, research/03:269). SC1 uses 66.' }),
  hist('H2.metr.h80.2026-04', 'horizon80', 'METR 80% horizon of the frontier, Apr 2026', 2026.27, 'min', 'METR TH1.1 (95% CI [97, 399])', 'research/09:59; research/03:262-274',
    { value: 186, lo: 97, hi: 399, bandFrom: 'source', notes: 'Game tolerance +-15% (targets.ts:109). Today only the v1 integrator is tested against it, on authors2026.' }),
  // H3 METR 50% horizon
  hist('H3.metr.h50.2025-08', 'horizon50', 'METR 50% horizon, Aug 2025', 2025.62, 'min', 'METR TH1.1 (95% CI as listed)', 'research/03:262-274',
    { value: 203, lo: 113, hi: 406, bandFrom: 'source', notes: 'The game start V0 is 203 min (H50_V0_MIN, workTypes.ts:143).' }),
  hist('H3.metr.h50.2025-12', 'horizon50', 'METR 50% horizon, Dec 2025', 2025.96, 'min', 'METR TH1.1 (5.9 h)', 'research/09:59', { value: 354, notes: '5.9 h written as minutes.' }),
  hist('H3.metr.h50.2026-02', 'horizon50', 'METR 50% horizon, Feb 2026', 2026.13, 'min', 'METR TH1.1 (95% CI as listed)', 'research/03:262-274', { value: 719, lo: 317, hi: 3634, bandFrom: 'source' }),
  hist('H3.metr.h50.2026-04', 'horizon50', 'METR 50% horizon, Apr 2026', 2026.27, 'min', 'METR TH1.1 (95% CI as listed)', 'research/03:262-274',
    { value: 1045, lo: 509, hi: 3304, bandFrom: 'source', notes: 'METR: horizons over 16 h are unreliable.' }),
  // H4 p80 / p50 ratio
  hist('H4.metr.h80over50', 'other', 'The 80% horizon as a fraction of the 50% horizon', 2026.99, 'fraction', 'METR; workTypes.ts', 'research/20:51; workTypes.ts:147',
    { value: 0.2, lo: 0.1, hi: 0.25, bandFrom: 'source', notes: 'Written 1/5, band 1/4 to 1/10. Span 2025-26, date is its end.' }),
  // H5 frontier effective-compute path G
  hist('H5.gpath.2025-08', 'other', 'Frontier effective-compute path G, 15 Aug 2025', d15(2025, 8), 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 28.0, notes: 'The five H5.gpath anchors are the one home of these values: calreport/milestones.ts (GPATH.anchorDeviation, its own +-0.2 G tolerance) and calibscore.ts read them here. Anchor dates from calib.ts:291.' }),
  hist('H5.gpath.2025-11', 'other', 'Frontier effective-compute path G, 15 Nov 2025', d15(2025, 11), 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 28.4 }),
  hist('H5.gpath.2026-02', 'other', 'Frontier effective-compute path G, 15 Feb 2026', d15(2026, 2), 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 28.7 }),
  hist('H5.gpath.2026-04', 'other', 'Frontier effective-compute path G, 15 Apr 2026', d15(2026, 4), 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 29.0 }),
  hist('H5.gpath.2026-10', 'other', 'Frontier effective-compute path G, 15 Oct 2026', d15(2026, 10), 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 29.4 }),
  hist('H5.gpath.slope', 'other', 'Growth of the frontier effective-compute path G per year, 2025-26', 2026.79, 'G per year', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { lo: 1.1, hi: 1.3, bandFrom: 'source', notes: 'A range with no central value. The game prints this slope but does not check it.' }),
  // H6 pretraining stack growth
  hist('H6.pretrainRate', 'other', 'Pretraining stack growth, to 2024', 2024.99, 'OOM per year', 'Ho et al.', 'research/20:33 B1 (targets.ts:209)', { value: 0.48 }),
  // H7 global chip output
  hist('H7.chipOutput.2024', 'other', 'Global AI chip output per quarter, 2024', 2024.5, 'H100e per quarter', 'Epoch AI', 'research/15:27', { value: m(0.83), notes: '0.83M. SC1 gives the year, not the quarter; date is mid-2024. F1.production2026 (25M) is a level, not this.' }),
  hist('H7.chipOutput.2026-Q2', 'other', 'Global AI chip output per quarter, Q2 2026', 2026.37, 'H100e per quarter', 'Epoch AI', 'research/15:27', { value: m(6.33), notes: '6.33M.' }),
  hist('H7.productionGrowth', 'other', 'Growth of global chip output per year, 2024 to Q2 2026', 2026.37, 'x per year', 'Epoch AI', 'research/15:27', { value: 2.5 }),
  hist('H7.yoy.2025-Q2', 'other', 'Year-on-year growth of chip output, Q2 2025', 2025.37, 'x', 'Epoch AI', 'research/15:27', { value: 2.8 }),
  hist('H7.yoy.2026-Q2', 'other', 'Year-on-year growth of chip output, Q2 2026', 2026.37, 'x', 'Epoch AI', 'research/15:27', { value: 2.2 }),
  // H8 world AI compute stock
  hist('H8.worldCompute.2025-07', 'worldCompute', 'World AI compute stock, Jul 2025', 2025.5, 'H100e', 'Epoch AI', 'research/09:43, :72-74',
    { value: m(9), status: 'unsure', notes: 'Source conflict: ~9M measured Jul 2025 vs the game starts of 13M (`classic`) and 14M (`reality`) (world.ts:269, :279).' }),
  hist('H8.worldCompute.2026-01', 'worldCompute', 'World AI compute stock, Jan 2026', 2026.04, 'H100e', 'Epoch AI', 'research/09:43, :72-74', { value: m(15), notes: 'Source reads ">15M": a lower bound.' }),
  hist('H8.worldCompute.2026-end', 'worldCompute', 'World AI compute stock, end of 2026', 2026.99, 'H100e', 'Epoch AI', 'research/09:43, :72-74',
    { value: m(40), lo: m(35), hi: m(46), bandFrom: 'source', notes: 'F3.installedStock compares the game with itself and is not this target.' }),
  hist('H8.stockGrowth', 'other', 'Growth of the world AI compute stock per year since 2022', 2026.04, 'x per year', 'Epoch AI (CI 2.7-4.1)', 'research/09:43, :72-74',
    { value: 3.3, lo: 2.7, hi: 4.1, bandFrom: 'source', notes: 'SC1 gives "since 2022" with no date; date is Jan 2026, the same reading as the stock above.' }),
  // H9 leading-lab compute
  hist('H9.leaderCompute.2024-end', 'other', 'Leading lab (OpenAI) compute, end of 2024', 2024.99, 'H100e', 'Epoch AI', 'research/09:42, :73', { value: 386_000 }),
  hist('H9.leaderCompute.2025-end', 'other', 'Leading lab (OpenAI) compute, end of 2025', 2025.99, 'H100e', 'Epoch AI (90% CI 1.25-2.19M)', 'research/09:42, :73', { value: m(1.74), lo: m(1.25), hi: m(2.19), bandFrom: 'source' }),
  hist('H9.leaderGrowth', 'other', 'Growth of leading-lab compute per year', 2025.99, 'x per year', 'Epoch AI', 'research/09:42, :73', { value: 3.5, notes: 'Written "~3.5x/yr".' }),
  // H10 hyperscaler capex
  hist('H10.capex.five', 'capex', 'Capex of the five hyperscalers, 2026', 2026.5, 'USD B', 'Company filings', 'research/15:454, :555-565; research/09:44', { lo: 810, hi: 835, bandFrom: 'source', notes: 'A range with no central value. Game tolerance +-15%. F7.capex2026 is the AI 2027 lab figure ($200B), a forecast.' }),
  hist('H10.capex.big4', 'capex', 'Capex of the big four hyperscalers, 2026', 2026.5, 'USD B', 'Company filings', 'research/15:454, :555-565; research/09:44', { lo: 700, hi: 725, bandFrom: 'source', notes: 'A range with no central value.' }),
  // H11 Anthropic revenue
  hist('H11.revenue.q3-2025', 'revenue', 'Anthropic revenue in Q3 2025', 2025.62, 'USD B', 'Anthropic S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 1.4, notes: 'Per quarter. Target F7.revenue2026 is a different quantity (a $36-67B level).' }),
  hist('H11.revenue.q3-2026', 'revenue', 'Anthropic revenue in Q3 2026', 2026.62, 'USD B', 'Anthropic S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 17.0, notes: 'Per quarter.' }),
  hist('H11.runRate.2026-02', 'revenue', 'Anthropic run-rate revenue, Feb 2026', 2026.13, 'USD B', 'Anthropic posts and S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 14, notes: 'Annualised.' }),
  hist('H11.runRate.2026-05', 'revenue', 'Anthropic run-rate revenue, May 2026', 2026.37, 'USD B', 'Anthropic posts and S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 47, notes: 'Annualised. SC1 reads ">47B": a lower bound.' }),
  hist('H11.runRate.2026-10', 'revenue', 'Anthropic run-rate revenue, Oct 2026', 2026.79, 'USD B', 'Anthropic posts and S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 81, notes: 'Annualised. F11.startRunRate ($12B) is the Jul 2025 start, a different date.' }),
  hist('H11.revenue.fy2025', 'revenue', 'Anthropic revenue, full year 2025', 2025.5, 'USD B', 'Anthropic S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 4.585, notes: 'Whole year, read at mid-year.' }),
  hist('H11.revenue.9m2026', 'revenue', 'Anthropic revenue, first nine months of 2026', 2026.75, 'USD B', 'Anthropic S-1', 'research/22:23-61 rows 4a-4c, :228-262', { value: 33.2, notes: 'Cumulative to the end of Q3 2026.' }),
  // H12 prices
  hist('H12.priceDecline', 'price', 'Fall in price at fixed capability per year, 2025-26', 2026.99, 'x per year', 'Cottier 2025; DeepSeek', 'research/20:48-49', { value: 10, lo: 9, hi: 900, bandFrom: 'source', notes: 'Written "x9 to x900/yr".' }),
  hist('H12.apiMargin', 'other', 'API gross margin, 2025-26', 2026.99, 'fraction', 'Cottier 2025; DeepSeek', 'research/20:48-49', { value: 0.6, lo: 0.4, hi: 0.85, bandFrom: 'source' }),
  // H13 private lab marks
  hist('H13.privateMarks.2025-07', 'other', 'Total value of the private labs, Jul 2025', 2025.5, 'USD B', 'Lab valuations (research/15 §2.9)', 'research/15 §2.9 (target F9.fc1.start)', { lo: 450, hi: 750, bandFrom: 'source', notes: 'A range ($0.45-0.75T) with no central value.' }),
  hist('H13.privateMarks.2026-late', 'other', 'Total value of the private labs, Oct 2026 to Jan 2027', 2026.99, 'USD B', 'Lab valuations (research/15 §2.9)', 'research/15 §2.9 (target F9.fc1.late2026)', { lo: 2200, hi: 3300, bandFrom: 'source', notes: 'A range ($2.2-3.3T) with no central value. The window runs to Jan 2027; date is capped at the end of 2026.' }),
  // H14-H19 safety effects
  hist('H14.inoculation.mis', 'safetyEffect', 'Inoculation prompting cuts misalignment caused by reward hacking', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1182-1206', { lo: 0.75, hi: 0.9, bandFrom: 'source', notes: 'A range (75-90%) with no central value.' }),
  hist('H14.inoculation.af', 'safetyEffect', 'Inoculation prompting cuts alignment faking', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1182-1206', { lo: 0.75, hi: 0.9, bandFrom: 'source', notes: 'A range (75-90%) with no central value.' }),
  hist('H14.inoculation.sabotage', 'safetyEffect', 'Inoculation prompting cuts sabotage', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1182-1206', { lo: 0.75, hi: 0.95, bandFrom: 'source', notes: 'A range (75-95%) with no central value.' }),
  hist('H15.antiScheming.cut', 'safetyEffect', 'Anti-scheming training cuts covert actions', 2025.5, 'fraction', 'Schoen 2025', 'targets.ts:1218', { lo: 0.9, hi: 0.98, bandFrom: 'source', notes: 'A range (90-98%) with no central value. o3 13% to 0.4%; o4-mini 8.7% to 0.3%.' }),
  hist('H16.sabotageAfterHacking', 'safetyEffect', 'Share of safety-research runs with sabotage after learned hacking', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1170', { value: 0.12 }),
  hist('H17.persistence.scheme', 'safetyEffect', 'Safety training leaves a scheming behaviour in place', 2025.5, 'fraction', 'Hubinger 2024; research/20 F6', 'targets.ts:1258', { lo: 0.8, hi: 1.0, bandFrom: 'source', notes: 'A range (80-100%) with no central value. Span 2024-26, read at mid-2025.' }),
  hist('H18.evalAwareness2026', 'safetyEffect', 'Share of tests the model says it notices, late 2026', 2026.87, 'fraction', 'research/05 §1.7', 'targets.ts:1230', { lo: 0.2, hi: 0.5, bandFrom: 'source', notes: 'A range (20-50%) with no central value.' }),
  hist('H18.afComplianceGap2026', 'safetyEffect', 'Gap in compliance when the model thinks it is watched, late 2026', 2026.87, 'fraction', 'research/05 §1.4', 'targets.ts:1244', { lo: 0, hi: 0.15, bandFrom: 'source', notes: 'A range (0-15%) with no central value.' }),
  hist('H19.actRate', 'other', 'Incident acts per lab-year, 2025', 2025.5, 'acts per lab-year', 'research/05 §1.1-1.2', 'targets.ts:1295', { value: 1.2, lo: 0.4, hi: 3, bandFrom: 'source', notes: 'Written "~1.2".' }),
  // H20 China gap
  hist('H20.chinaGap.eci', 'chinaGap', 'Best Chinese model behind the US frontier, Nov 2026 (capability index)', 2026.87, 'months', 'IFP Oct 2026; CAISI May 2026', 'research/10:27, :135, :279', { value: 6.5, lo: 6.5, hi: 8, bandFrom: 'source', notes: 'Band 6.5-8 covers all three readings. CAST.china.startLead applies this band at the game start (Jul 2025): the cast sets the start gap of China from these readings (design/npc/CAST-2025.md, China gap check).' }),
  hist('H20.chinaGap.horizon', 'chinaGap', 'Best Chinese model behind the US frontier, Nov 2026 (task horizon)', 2026.87, 'months', 'IFP Oct 2026', 'research/10:27, :135, :279', { value: 6.6, notes: 'Inside the band 6.5-8 months given on the capability-index checkpoint.' }),
  hist('H20.chinaGap.caisi', 'chinaGap', 'Best Chinese model behind the US frontier, Nov 2026 (CAISI)', 2026.87, 'months', 'CAISI May 2026', 'research/10:27, :135, :279', { value: 8, notes: 'Inside the band 6.5-8 months given on the capability-index checkpoint.' }),
  // H21-H25 adoption and labour
  hist('H21.workers', 'adoption', 'Share of US workers using AI at work, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { lo: 0.39, hi: 0.41, bandFrom: 'source', notes: 'A range (39-41%) with no central value.' }),
  hist('H21.hoursSaved', 'adoption', 'Share of US work hours saved by AI, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { value: 0.022 }),
  hist('H21.savedPerHour', 'adoption', 'Hours saved per hour of AI use, Q2 2026', 2026.37, 'hours per hour', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { value: 0.35 }),
  hist('H22.firmAdoption.2026-01', 'adoption', 'US firms using AI, Jan 2026', 2026.04, 'fraction', 'Census BTOS', 'research/22 row 1f (targets.ts:1067)', { value: 0.177 }),
  hist('H22.firmAdoption.2026-05', 'adoption', 'US firms using AI, May 2026', 2026.37, 'fraction', 'Census BTOS', 'research/22 row 1f (targets.ts:1067)', { value: 0.198 }),
  hist('H23.paidShare2026', 'adoption', 'Paid share of AI users, 2026', 2026.5, 'fraction', 'research/22 row 2e (50M subscribers of 900M weekly users)', 'research/22 row 2e (targets.ts:1029)', { value: 0.056, notes: 'Written "~5.6%".' }),
  hist('H24.chatgptWAU.2025-07', 'adoption', 'ChatGPT weekly active users, Jul 2025', 2025.5, 'users', 'NBER w34255; OpenAI', 'research/22:23-61 row 2c', { value: m(700) }),
  hist('H24.chatgptWAU.2026-02', 'adoption', 'ChatGPT weekly active users, Feb 2026', 2026.13, 'users', 'NBER w34255; OpenAI', 'research/22:23-61 row 2c', { value: m(900), notes: 'Source reads ">900M": a lower bound.' }),
  hist('H24.copilotSeats.2026-01', 'adoption', 'Microsoft 365 Copilot paid seats, Jan 2026', 2026.04, 'seats', 'Microsoft earnings', 'research/22:23-61 row 4e', { value: m(15) }),
  hist('H24.copilotSeats.2026-07', 'adoption', 'Microsoft 365 Copilot paid seats, Jul 2026', 2026.54, 'seats', 'Microsoft earnings', 'research/22:23-61 row 4e', { value: m(30), notes: 'Source reads "30M+": a lower bound.' }),
  hist('H24.devDaily.2025', 'adoption', 'Developers using AI daily, 2025', 2025.5, 'fraction', 'Stack Overflow Developer Survey', 'research/22:23-61 row 6a', { value: 0.506 }),
  hist('H24.devDaily.2026', 'adoption', 'Developers using AI daily, 2026', 2026.5, 'fraction', 'Stack Overflow Developer Survey', 'research/22:23-61 row 6a', { value: 0.73 }),
  hist('H24.hoursAssisted.2024-Q3', 'adoption', 'Share of US work hours assisted by AI, Q3 2024', 2024.62, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.041, notes: 'The quarters for the four values come from research/22 row 1b (Q3 2024, Q4 2025, Q2 2026, Q3 2026).' }),
  hist('H24.hoursAssisted.2025-Q4', 'adoption', 'Share of US work hours assisted by AI, Q4 2025', 2025.87, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.056 }),
  hist('H24.hoursAssisted.2026-Q2', 'adoption', 'Share of US work hours assisted by AI, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.063, notes: 'The H21 survey quarter (Q2 2026); its one home.' }),
  hist('H24.hoursAssisted.2026-Q3', 'adoption', 'Share of US work hours assisted by AI, Q3 2026', 2026.62, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.053 }),
  hist('H25.aggregateU', 'other', 'Aggregate unemployment effect of AI, Nov 2026', 2026.87, 'percentage points', 'Stanford "Canaries"', 'research/09:53; targets.ts:1041-1054', { value: 0, notes: 'Written "~0".' }),
  hist('H25.youthExposed', 'other', 'Exposed workers aged 22-25 versus the no-AI path, Nov 2026', 2026.87, 'fraction vs counterfactual', 'Stanford "Canaries"', 'research/09:53; targets.ts:1041-1054', { value: -0.19, notes: '19% below the counterfactual.' }),
  // H26 R&D uplift
  hist('H26.uplift.metr', 'other', 'AI uplift to AI R&D pace, Oct 2026 (METR estimate for Anthropic)', 2026.79, 'x', 'METR', 'research/09:45', { value: 2, lo: 1.3, hi: 3, bandFrom: 'source', notes: 'Written "~2x". RS.<preset>.startM is the v1 multiplier at the start, a different quantity.' }),
  hist('H26.uplift.attributable', 'other', 'AI-attributable uplift to AI R&D pace, Oct 2026', 2026.79, 'x', 'METR', 'research/09:45', { value: 1.7, notes: 'Written "~1.7x".' }),
  hist('H26.uplift.anthropicCoding', 'other', 'Coding uplift inside Anthropic, Oct 2026', 2026.79, 'x', 'Anthropic internal', 'research/09:45', { value: 2 }),
];

// ───────────── timelines = the SAR-date split of 3,000 AI Futures Model runs (aifm-public 1c40ecdb, Eli's config unchanged) ─────────────
// Designer's choice (design/bal/SCENARIOS.md, round 8): fast = runs whose SAR date is in percentiles 20-30 of all runs, central = 45-55, slow = 70-80.
// Extracted by aifm-runs/scripts/extract.py (cluster mode, --cluster-key SAR) into aifm-runs/out/eli_split_sar/{fast,central,slow}.json.
// Every row is [p10, p25, p50, p75, p90]; null = that percentile is not reached (more samples never reach the milestone
// than the tail holds, never-reached runs counting as later than all others). Years are decimal years; the series are read at 1 January of the year.
type Q5 = [number, number, number, number | null, number | null];
const AIFM_YEARS = [2027, 2028, 2030, 2032, 2035];
// Frontier training compute, an input of the model (not sampled in the public configs): the same in every timeline.
const AIFM_TRAIN: Record<number, number> = { 2027: 479640, 2028: 1512000, 2030: 7518000, 2032: 20877209, 2035: 79888790 };
interface AifmRun {
  n: number; pool: number; rollouts: number;  // runs in this group / usable runs pooled / runs asked for (the rest failed: infeasible draws)
  sarRange: [number, number];                // the SAR dates (years) that bound the group: its 'SAR percentile' window
  milestones: Record<'AC' | 'SAR' | 'SIAR' | 'TED-AI' | 'ASI', { q: Q5; by2100: number; never: number }>; // by2100 / never: share of the group's runs not reached by 2100 / never in the run (to 2200)
  gaps: Record<'AC->SAR' | 'SAR->SIAR' | 'SIAR->ASI' | 'AC->ASI', { q: Q5; n: number }>;               // years, over the runs that reach both ends
  series: Record<'h80' | 'h50' | 'speedup' | 'effCompute', Record<number, Q5>>;
}
const AIFM_RUN: Record<TimelineId, AifmRun> = {
  fast: {
    n: 290, pool: 2891, rollouts: 3000,
    sarRange: [2028.10, 2028.71],
    milestones: {
      AC: { q: [2027.13, 2027.55, 2027.94, 2028.21, 2028.41], by2100: 0.0, never: 0.0 },
      SAR: { q: [2028.16, 2028.23, 2028.38, 2028.57, 2028.66], by2100: 0.0, never: 0.0 },
      SIAR: { q: [2028.51, 2028.69, 2029.05, 2030.08, 2032.39], by2100: 0.00345, never: 0.00345 },
      'TED-AI': { q: [2028.41, 2028.62, 2028.95, 2029.9, 2036.27], by2100: 0.0103, never: 0.0069 },
      ASI: { q: [2028.61, 2028.87, 2029.81, 2033.99, 2050.09], by2100: 0.0207, never: 0.0172 },
    },
    gaps: {
      'AC->SAR': { q: [0, 0.13, 0.44, 0.81, 1.27], n: 290 },
      'SAR->SIAR': { q: [0.11, 0.3, 0.65, 1.53, 3.59], n: 289 },
      'SIAR->ASI': { q: [0.03, 0.12, 0.59, 3.09, 12.05], n: 285 },
      'AC->ASI': { q: [0.41, 0.76, 2.13, 5.85, 18.42], n: 285 },
    },
    series: {
      h80: {
        2027: [407, 570, 1050, 2610, 124000],
        2028: [1590, 5590, 114000, 2.78e33, 2.38e51],
        2030: [968000, 8.84e22, 6.2e50, 4.72e77, 3.72e121],
        2032: [26200000, 5.43e31, 4.79e52, 9.28e82, 3.08e139],
        2035: [939000000, 9.07e34, 4.7e54, 1.45e89, 5.26e149],
      },
      h50: {
        2027: [2070, 2900, 5320, 13200, 628000],
        2028: [8080, 28400, 579000, 1.41e34, 1.21e52],
        2030: [4920000, 4.49e23, 3.15e51, 2.4e78, 1.89e122],
        2032: [133000000, 2.76e32, 2.43e53, 4.71e83, 1.56e140],
        2035: [4770000000, 4.61e35, 2.39e55, 7.35e89, 2.67e150],
      },
      speedup: {
        2027: [1.09, 1.21, 1.5, 2.06, 2.72],
        2028: [1.85, 2.64, 4.69, 9.36, 22.2],
        2030: [24.9, 125, 1560, 247000, 27100000000],
        2032: [57.9, 310, 5280, 1030000, 190000000000],
        2035: [92.5, 593, 12700, 2540000, 1280000000000],
      },
      effCompute: {
        2027: [28.21, 28.64, 29.33, 30.32, 31.81],
        2028: [29.34, 30.12, 31.37, 33.47, 36.48],
        2030: [32.85, 36.18, 43.89, 59.34, 91.82],
        2032: [34.96, 39.27, 49.27, 67.16, 101.29],
        2035: [36.78, 41.94, 52.97, 72.34, 112.25],
      },
    },
  },
  central: {
    n: 289, pool: 2891, rollouts: 3000,
    sarRange: [2030.04, 2031.24],
    milestones: {
      AC: { q: [2028.01, 2028.93, 2029.72, 2030.22, 2030.6], by2100: 0.0, never: 0.0 },
      SAR: { q: [2030.11, 2030.3, 2030.57, 2030.89, 2031.11], by2100: 0.0, never: 0.0 },
      SIAR: { q: [2030.7, 2031.11, 2031.93, 2033.86, 2038.3], by2100: 0.0, never: 0.0 },
      'TED-AI': { q: [2030.51, 2030.92, 2031.51, 2033.24, 2040.33], by2100: 0.0208, never: 0.0208 },
      ASI: { q: [2030.79, 2031.38, 2033.18, 2038.85, 2057], by2100: 0.0484, never: 0.0311 },
    },
    gaps: {
      'AC->SAR': { q: [0.02, 0.32, 0.86, 1.59, 2.6], n: 289 },
      'SAR->SIAR': { q: [0.17, 0.5, 1.32, 3.29, 7.69], n: 289 },
      'SIAR->ASI': { q: [0.03, 0.18, 0.91, 3.85, 13.14], n: 280 },
      'AC->ASI': { q: [0.5, 1.37, 3.59, 7.9, 22.91], n: 280 },
    },
    series: {
      h80: {
        2027: [370, 519, 875, 1770, 5900],
        2028: [1010, 2720, 19600, 1250000, 1.03e44],
        2030: [9160, 130000, 2570000000000000.0, 1.59e58, 1.22e86],
        2032: [145000, 5710000000, 2.8e49, 8.76e79, 2.83e111],
        2035: [7420000, 248000000000000, 5.77e54, 1.06e87, 1.68e131],
      },
      h50: {
        2027: [1880, 2640, 4450, 8990, 30000],
        2028: [5130, 13800, 99600, 6370000, 5.23e44],
        2030: [46500, 658000, 1.31e16, 8.05e58, 6.21e86],
        2032: [739000, 29000000000, 1.42e50, 4.45e80, 1.44e112],
        2035: [37700000, 1260000000000000.0, 2.93e55, 5.37e87, 8.56e131],
      },
      speedup: {
        2027: [1.06, 1.12, 1.24, 1.5, 1.93],
        2028: [1.15, 1.29, 1.59, 2.18, 3.62],
        2030: [2.09, 2.95, 5.52, 14.3, 37.6],
        2032: [12.3, 55.4, 437, 10500, 10400000],
        2035: [31, 185, 2430, 658000, 5590000000],
      },
      effCompute: {
        2027: [28.11, 28.4, 29, 29.98, 31.59],
        2028: [29.05, 29.52, 30.57, 32.31, 34.88],
        2030: [30.71, 31.67, 33.57, 37.35, 42.9],
        2032: [32.51, 34.78, 40.31, 54.01, 80.14],
        2035: [34.99, 38.31, 46.55, 64.63, 94.08],
      },
    },
  },
  slow: {
    n: 290, pool: 2891, rollouts: 3000,
    sarRange: [2035.29, 2041.16],
    milestones: {
      AC: { q: [2028.62, 2031.1, 2034.82, 2036.92, 2038.71], by2100: 0.0, never: 0.0 },
      SAR: { q: [2035.64, 2036.22, 2037.58, 2039.27, 2040.07], by2100: 0.0, never: 0.0 },
      SIAR: { q: [2037.51, 2038.98, 2041.82, 2050.17, 2064.64], by2100: 0.031, never: 0.0138 },
      'TED-AI': { q: [2036.99, 2038.51, 2041.02, 2048.69, 2078.71], by2100: 0.0655, never: 0.0414 },
      ASI: { q: [2038.53, 2040.55, 2046.5, 2073.47, null], by2100: 0.172, never: 0.107 },
    },
    gaps: {
      'AC->SAR': { q: [0.02, 0.56, 2.27, 6.55, 8.79], n: 290 },
      'SAR->SIAR': { q: [0.55, 1.21, 4, 12.05, 25.05], n: 286 },
      'SIAR->ASI': { q: [0.11, 0.61, 2.85, 13.27, 36.73], n: 259 },
      'AC->ASI': { q: [0.93, 3.12, 9.82, 27.72, 56.18], n: 259 },
    },
    series: {
      h80: {
        2027: [354, 451, 663, 1400, 4810],
        2028: [901, 1520, 5980, 140000, 6.79e40],
        2030: [4420, 16600, 6480000, 4.76e48, 7.61e67],
        2032: [16200, 110000, 424000000000, 5.88e59, 1.41e78],
        2035: [66500, 1870000, 4.16e39, 2.81e67, 4.33e97],
      },
      h50: {
        2027: [1800, 2290, 3370, 7120, 24500],
        2028: [4580, 7740, 30400, 712000, 3.45e41],
        2030: [22400, 84300, 32900000, 2.42e49, 3.87e68],
        2032: [82300, 561000, 2160000000000, 2.99e60, 7.18e78],
        2035: [338000, 9490000, 2.12e40, 1.43e68, 2.2e98],
      },
      speedup: {
        2027: [1.03, 1.08, 1.19, 1.46, 1.99],
        2028: [1.06, 1.15, 1.37, 1.81, 2.62],
        2030: [1.14, 1.3, 1.78, 2.93, 6.37],
        2032: [1.26, 1.51, 2.22, 4.93, 11.7],
        2035: [1.62, 2.36, 4.82, 13.8, 34.8],
      },
      effCompute: {
        2027: [28.14, 28.42, 28.94, 29.87, 31.57],
        2028: [29.05, 29.55, 30.4, 32, 35.05],
        2030: [30.6, 31.48, 32.95, 35.78, 41.39],
        2032: [31.66, 32.84, 34.85, 38.7, 46.08],
        2035: [33.17, 34.61, 37.48, 42.72, 52.19],
      },
    },
  },
};

// By phase (R3.2): the same three series read at AC + tau for EVERY run of the group (tau in years; the model's AC is read as our SC), then
// the percentiles over the runs. Per run, not the date-aligned percentiles above: a run whose AC falls early and one whose AC falls late
// are put on the same phase axis, which a date-aligned percentile cannot do. Source: aifm-runs rollouts (the same 869 runs of the three
// SAR-split groups), extracted by scripts/v2/aifm_phase.py (log-linear interpolation of speed-up and horizon in time, linear for effective
// compute). Every row is [p10, p25, p50, p75, p90]; n = runs whose time axis reaches AC + tau.
type PhaseRow = { n: number; speedup: Q5; h80: Q5; effCompute: Q5 };
const AIFM_PHASES = [-1, 0, 0.5, 1, 2];
const AIFM_PHASE: Record<TimelineId, Record<number, PhaseRow>> = {
  fast: {
    '-1': { n: 290, speedup: [1.05, 1.13, 1.36, 1.85, 2.62], h80: [145, 295, 673, 2250, 30800], effCompute: [27.6, 28.19, 29.13, 30.41, 31.9] },
    0: { n: 290, speedup: [1.73, 2.17, 3.97, 8.9, 22.1], h80: [847, 2420, 47600, 2.63e+23, 5.41e+46], effCompute: [28.84, 29.63, 31.2, 33.16, 35.9] },
    0.5: { n: 290, speedup: [3.12, 6.25, 21.8, 312, 281000], h80: [2910, 19200, 3.44e+24, 1.25e+52, 1.05e+73], effCompute: [29.57, 30.7, 33.34, 39.77, 55.93] },
    1: { n: 290, speedup: [5.52, 17.8, 151, 9110, 164000000], h80: [15000, 885000, 1.48e+37, 2.63e+56, 3.44e+86], effCompute: [30.41, 32.25, 37, 49.43, 71.22] },
    2: { n: 290, speedup: [21.6, 84.1, 866, 129000, 6330000000], h80: [207000, 640000000000, 1.66e+48, 1.06e+75, 9.55e+113], effCompute: [31.96, 35.34, 43.17, 58.6, 90.77] },
  },
  central: {
    '-1': { n: 289, speedup: [1.17, 1.35, 1.72, 2.38, 4.09], h80: [616, 2580, 44300, 5.13e+30, 1.02e+55], effCompute: [28.82, 29.74, 31.14, 32.85, 36.89] },
    0: { n: 289, speedup: [1.74, 2.29, 3.86, 7, 19.2], h80: [3320, 19900, 34500000, 1.39e+41, 4.41e+66], effCompute: [29.85, 30.87, 32.68, 34.84, 40.85] },
    0.5: { n: 289, speedup: [2.37, 3.79, 9.7, 53.2, 1460], h80: [7120, 122000, 262000000000000000, 6.32e+59, 6.13e+85], effCompute: [30.37, 31.6, 33.8, 38.06, 51.45] },
    1: { n: 289, speedup: [3.3, 6.57, 26.9, 307, 659000], h80: [13500, 1770000, 4.92e+39, 9.15e+69, 7.31e+90], effCompute: [30.91, 32.34, 35.18, 43.39, 65.06] },
    2: { n: 289, speedup: [6.9, 24.2, 145, 4330, 3920000], h80: [65900, 567000000, 1.97e+46, 6.4e+77, 4e+106], effCompute: [31.98, 34.12, 38.6, 49.34, 77.47] },
  },
  slow: {
    '-1': { n: 290, speedup: [1.26, 1.61, 2.46, 4.68, 10], h80: [1880, 39900, 62600000, 3.35e+54, 2.95e+77], effCompute: [29.95, 32.44, 35.3, 39.31, 47.03] },
    0: { n: 290, speedup: [1.64, 2.49, 4.18, 9.41, 23.3], h80: [7810, 250000, 571000000000, 6.95e+59, 3.91e+83], effCompute: [31.18, 33.34, 36.21, 40.41, 48.39] },
    0.5: { n: 290, speedup: [1.92, 3.49, 7.04, 19.2, 106], h80: [15000, 600000, 5.26e+22, 8.08e+62, 1.94e+93], effCompute: [31.8, 33.84, 36.91, 42.39, 53.1] },
    1: { n: 290, speedup: [2.21, 4.64, 10.8, 49.9, 918], h80: [21400, 1550000, 2.58e+39, 2.07e+67, 1.56e+100], effCompute: [32.19, 34.41, 37.77, 44.36, 57.33] },
    2: { n: 290, speedup: [2.64, 6.88, 23.7, 218, 24400], h80: [65400, 17700000, 8.76e+44, 6.02e+71, 1.42e+107], effCompute: [32.94, 35.5, 38.85, 48.09, 63.83] },
  },
};

const AIFM_MAX_MIN = 1e7; // horizons above this (about 83 work-years) are the model's post-takeoff blow-up: not shown
const PCT: Record<TimelineId, string> = { fast: '20-30', central: '45-55', slow: '70-80' };
const aifmSource = (t: TimelineId) => `AI Futures Model, aifm-public 1c40ecdb, Eli's config unchanged (sha256 e9bc58a1…), 3000 runs, SAR-split group ${t} (SAR percentile ${PCT[t]})`;
const aifmRef = (t: TimelineId) => `aifm-runs/out/eli_split_sar/${t}.json`;
const yr = (v: number | null) => (v === null ? 'n/a' : v.toFixed(2));
const pc = (f: number) => `${+(f * 100).toPrecision(2)}%`;

function aifmTimeline(t: TimelineId): Checkpoint[] {
  const run = AIFM_RUN[t], src = aifmSource(t), ref = aifmRef(t), out: Checkpoint[] = [];
  const ran = `${run.n} runs in this group (SAR dates ${run.sarRange[0].toFixed(2)} to ${run.sarRange[1].toFixed(2)}); ${run.pool} usable runs pooled of ${run.rollouts}, the rest are infeasible draws the model cannot run and are left out.`;
  // A distribution row: value = p50, band = p25 to p75, outer band = p10 to p90. A percentile that is null (or above `cap`) is left out.
  const dist = (q: Q5, cap = Infinity): Extra => {
    const k = (v: number | null) => (v !== null && v <= cap ? v : undefined);
    return { value: q[2], lo: k(q[1]), hi: k(q[3]), p10: k(q[0]), p90: k(q[4]), bandFrom: 'source' };
  };
  const MS: [Milestone | 'TED-AI', 'AC' | 'SAR' | 'SIAR' | 'TED-AI' | 'ASI', string][] = [
    ['SC', 'AC', 'AI that codes better than any human (SC)'], ['SAR', 'SAR', 'AI that does AI research better than any human (SAR)'],
    ['SIAR', 'SIAR', 'Superintelligent AI researcher (SIAR)'], ['TED-AI', 'TED-AI', 'Top-human-expert-dominating AI (TED-AI)'], ['ASI', 'ASI', 'Artificial superintelligence (ASI)'],
  ];
  for (const [mine, theirs, label] of MS) {
    const d = run.milestones[theirs], q = d.q;
    const tail = `p10 ${yr(q[0])}, p90 ${q[4] !== null ? yr(q[4]) : 'not reached (more than 10% of samples never get there)'}. ${pc(d.by2100)} of samples do not reach it by 2100 (${pc(d.never)} never, to 2200); the percentiles count those as later than every sample that does.`;
    const note = mine === 'SC' ? `The model's AC (all coding) is read as our SC. ${tail} ${ran}`
      : mine === 'TED-AI' ? `The model's TED-AI has no counterpart among the game's four milestones. It often comes before SIAR (the gap from SIAR to TED-AI is usually negative). ${tail}`
        : tail;
    out.push(tl(t, mine, mine === 'TED-AI' ? 'other' : 'milestone', label, 'year', src, ref,
      { ...(mine === 'TED-AI' ? {} : { milestone: mine }), ...dist(q), neverBy2100: d.by2100, notes: note }));
  }
  const GAPS: [Milestone, Milestone, 'AC->SAR' | 'SAR->SIAR' | 'SIAR->ASI', string][] = [
    ['SC', 'SAR', 'AC->SAR', 'Time from SC to SAR'], ['SAR', 'SIAR', 'SAR->SIAR', 'Time from SAR to SIAR'], ['SIAR', 'ASI', 'SIAR->ASI', 'Time from SIAR to ASI'],
  ];
  for (const [from, to, key, label] of GAPS) {
    const g = run.gaps[key], q = g.q;
    out.push(tl(t, `interval.${from}-${to}`, 'interval', label, 'years', src, ref,
      { from, milestone: to, ...dist(q),
        notes: `Median of the per-sample gaps, over the ${g.n} samples that reach both milestones; it is not the difference of the two median dates. p10 ${q[0]}, p90 ${q[4]}.${from === 'SC' ? " The start is the model's AC." : ''}` }));
  }
  for (const y of AIFM_YEARS) {
    const date = y, when = `At 1 January ${y}.`;
    const h = (key: 'h80' | 'h50') => {
      const q = run.series[key][y];
      if (q[2] > AIFM_MAX_MIN) return; // the median itself is in the blow-up: no checkpoint
      const cut = q.some((v) => v !== null && v > AIFM_MAX_MIN) ? " Percentiles above 1e7 minutes are left out: after takeoff the model's horizon explodes to absurd lengths." : '';
      const eighty = key === 'h80';
      out.push(tl(t, `${eighty ? 'horizon80' : 'horizon50'}.${y}`, eighty ? 'horizon80' : 'horizon50',
        `AI task length (${eighty ? '80' : '50'}% success), ${y}`, 'min', src, ref,
        { date, ...dist(q, AIFM_MAX_MIN),
          notes: eighty ? `${when} Modelled: the model's horizon is the METR 80% horizon.${cut}`
            : `${when} Derived, not modelled: the 80% horizon times 5.08, the median ratio of the METR 50% to 80% horizons (the model tracks only the 80% horizon).${cut}` }));
    };
    h('h80'); h('h50');
    out.push(tl(t, `speedup.${y}`, 'other', `AI research speed-up, ${y}`, 'x', src, ref,
      { date, ...dist(run.series.speedup[y]), series: 'speedup',
        notes: `${when} The model's AI software R&D progress multiplier (1 = no help from AI) at present-day resources. After takeoff the model's value runs to absurd sizes (above about 1e6): read the upper percentiles as off the scale.` }));
    out.push(tl(t, `effCompute.${y}`, 'other', `Effective compute, ${y}`, 'OOM', src, ref,
      { date, ...dist(run.series.effCompute[y]), series: 'effCompute',
        notes: `${when} log10 of cumulative effective compute in FLOP (hardware and software efficiency together; software efficiency is 0 at 2025.13). After takeoff the upper percentiles run far beyond anything physical.` }));
    out.push(tl(t, `trainCompute.${y}`, 'other', `Frontier training compute, ${y}`, 'H100e', src, ref,
      { date, value: AIFM_TRAIN[y], series: 'trainCompute',
        notes: `${when} A model input, not an output: the public configs fix it, so it is the same in all three timelines and has no band. The model's inference compute is about 0.71 times this and its experiment compute about 7.1 times.` }));
  }
  // by phase: the series at AC + tau (id <timeline>.phase.<series>.<tau>)
  for (const tau of AIFM_PHASES) {
    const row = AIFM_PHASE[t][tau];
    const sign = tau > 0 ? '+' : '', when = `At the model's AC ${sign}${tau} years, per run (the game's SC is compared with the model's AC).`;
    const at = tau === 0 ? 'at SC' : `at SC ${sign}${tau} y`;
    const base = { phase: tau, notes: `${when} Percentiles over the ${row.n} runs of this group, each read at its own AC + ${tau} years (scripts/v2/aifm_phase.py).` };
    out.push(tl(t, `phase.speedup.${sign}${tau}`, 'other', `AI research speed-up, ${at}`, 'x', src, 'scripts/v2/aifm_phase.py (aifm-runs rollouts)',
      { ...base, ...dist(row.speedup), series: 'speedup', notes: `${base.notes} The model's AI software R&D progress multiplier at present-day resources (compare the game's matched speed-up spdM, not labSpeedRel).` }));
    if (row.h80[2] <= AIFM_MAX_MIN) out.push(tl(t, `phase.horizon80.${sign}${tau}`, 'horizon80', `AI task length (80% success), ${at}`, 'min', src, 'scripts/v2/aifm_phase.py (aifm-runs rollouts)',
      { ...base, ...dist(row.h80, AIFM_MAX_MIN), notes: `${base.notes} Percentiles above 1e7 minutes are left out (the model's horizon explodes after takeoff).` }));
    out.push(tl(t, `phase.effCompute.${sign}${tau}`, 'other', `Effective compute, ${at}`, 'OOM', src, 'scripts/v2/aifm_phase.py (aifm-runs rollouts)',
      { ...base, ...dist(row.effCompute), series: 'effCompute', notes: `${base.notes} log10 of cumulative effective compute in FLOP.` }));
  }
  return out;
}
const FAST = aifmTimeline('fast'), CENTRAL = aifmTimeline('central'), SLOW = aifmTimeline('slow');

// ───────────── alignment levels (SC1 §6) ─────────────
const LABEL_REF = 'src/data/v2/starts.ts:33 (StartDef.difficulty comment)';
const LABEL_NOTE = 'Existing start-difficulty label band for the strongest bot win rate, offered as a starting point; the designer sets the real per-level band (winBand).';
const ALIGNMENT: Checkpoint[] = [
  al('beginner', 'winRate', 'Strongest-bot win rate at the Beginner level', 'none', `${SC1}:172`, { status: 'blank', notes: 'No existing label band; the designer sets it.' }),
  al('easy', 'winRate', 'Strongest-bot win rate at the Easy level', 'Start difficulty label "Easy" (30% or more)', LABEL_REF, { lo: 0.3, bandFrom: 'source', status: 'proposed', notes: LABEL_NOTE }),
  al('normal', 'winRate', 'Strongest-bot win rate at the Normal level', 'Start difficulty label "Medium" (10-30%)', LABEL_REF, { lo: 0.1, hi: 0.3, bandFrom: 'source', status: 'proposed', notes: LABEL_NOTE }),
  al('hard', 'winRate', 'Strongest-bot win rate at the Hard level', 'Start difficulty label "Hard" (1-10%)', LABEL_REF, { lo: 0.01, hi: 0.1, bandFrom: 'source', status: 'proposed', notes: LABEL_NOTE }),
  al('impossible', 'winRate', 'Strongest-bot win rate at the Impossible level', 'Start difficulty label "Impossible" (under 1%)', LABEL_REF, { hi: 0.01, bandFrom: 'source', status: 'proposed', notes: LABEL_NOTE }),
];

export const CHECKPOINTS: Checkpoint[] = [...HISTORY, ...FAST, ...CENTRAL, ...SLOW, ...ALIGNMENT];
