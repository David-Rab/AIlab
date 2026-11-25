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
  lo?: number; hi?: number;           // band, only when the source gives one (bandFrom = 'source'); for a distribution, p25 and p75
  p10?: number; p90?: number;         // outer band of a distribution (needs lo/hi: p10 <= lo, hi <= p90); a percentile that is not reached is left out
  neverBy2100?: number;               // distribution of a date: the share of samples (0 to 1) that do not reach it by 2100; the percentiles count them as later
  series?: 'speedup' | 'effCompute' | 'trainCompute'; // which chart a dated 'other' timeline value belongs to
  unit: string;                       // 'min', 'H100e', 'USD B', 'year', 'years', 'fraction', ...
  bandFrom: 'source' | 'none' | 'designer';
  source: string;                     // citation in words
  sourceRef: string;                  // file:line in this repo, or a URL
  targetId?: string;                  // existing target in balance/targets.ts
  status: 'sourced' | 'unsure' | 'proposed' | 'blank';
  notes?: string;
}

export const TIMELINES: Timeline[] = [
  {
    id: 'fast',
    name: 'Fast (AI 2027)',
    sourceModel: "AI Futures Model (aifm-public 1c40ecdb), Daniel's published parameter ranges unchanged; 1,000 samples, 949 ran (aifm-runs/CONFIGS.md)",
    summary: 'AI that codes better than any human arrives in late 2027 (median), and superintelligence follows in about 2030 (median). The spread is wide: a quarter of the runs have superintelligence only after 2036.',
  },
  {
    id: 'central',
    name: 'Central (AI Futures model)',
    sourceModel: "AI Futures Model (aifm-public 1c40ecdb), Eli's parameter ranges with slower growth of today's AI coding uplift; 1,000 samples, 987 ran (aifm-runs/CONFIGS.md)",
    summary: 'AI that codes better than any human arrives around 2030 (median), and superintelligence follows about ten years later, around 2040 (median). The spread is wide: about one run in twelve has no such coder even by 2100.',
  },
  {
    id: 'slow',
    name: 'Slow (steady exponential)',
    sourceModel: "AI Futures Model (aifm-public 1c40ecdb), Daniel's ranges with a pure-exponential task-length trend and a longer task needed for the coder; 1,000 samples, 1,000 ran (aifm-runs/CONFIGS.md)",
    summary: 'The length of tasks AI can do keeps growing at a steady pace instead of speeding up, so AI that codes better than any human arrives around 2034 (median) and superintelligence around 2039 (median).',
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

// ───────────── shared history (SC1 §1): holds in every cell ─────────────
const HISTORY: Checkpoint[] = [
  // H1 METR 50% doubling time
  hist('H1.metr.h50.doubling', 'other', 'METR 50% horizon doubling time, 2023-26', 2026.99, 'months', 'METR TH1.1 (129 d since 2023 [104,158]; 88.6 d since 2024)', 'research/20:50; research/03:276',
    { value: 4.2, lo: 3.4, hi: 5.2, bandFrom: 'source', targetId: 'METR.h50.doubling', notes: 'Band is the METR interval since 2023. The game checks 3.2-5.2 (+-1 month) and today pins the target to the ai2027 RefBot only. METR also gives 6.2 months all-time. Date is the end of the 2023-26 span.' }),
  // H2 METR 80% horizon of the frontier
  hist('H2.metr.h80.2025-04', 'horizon80', 'METR 80% horizon of the frontier, Apr 2025', 2025.27, 'min', 'METR TH1.1', 'research/09:59; research/03:262-274', { value: 30, notes: 'Game tolerance +-15% (targets.ts:109).' }),
  hist('H2.metr.h80.2025-12', 'horizon80', 'METR 80% horizon of the frontier, Dec 2025 (GPT-5.2)', 2025.96, 'min', 'METR TH1.1', 'research/09:59; research/03:262-274',
    { value: 66, status: 'unsure', notes: 'Source conflict: 32 min (AI Futures model anchor, research/03:203) vs 66 min (GPT-5.2, research/09:59, research/03:269). SC1 uses 66.' }),
  hist('H2.metr.h80.2026-04', 'horizon80', 'METR 80% horizon of the frontier, Apr 2026', 2026.27, 'min', 'METR TH1.1 (95% CI [97, 399])', 'research/09:59; research/03:262-274',
    { value: 186, lo: 97, hi: 399, bandFrom: 'source', targetId: 'GOLD.authors2026.h80', notes: 'Game tolerance +-15% (targets.ts:109). Today only the v1 integrator is tested against it, on authors2026.' }),
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
  hist('H5.gpath.2025-08', 'other', 'Frontier effective-compute path G, 15 Aug 2025', 2025.62, 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 28.0, targetId: 'GPATH.ai2027.2026', notes: 'Game tolerance +-0.2 G per anchor. Anchor dates from calib.ts:291.' }),
  hist('H5.gpath.2025-11', 'other', 'Frontier effective-compute path G, 15 Nov 2025', 2025.87, 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 28.4, targetId: 'GPATH.ai2027.2026', notes: 'Game tolerance +-0.2 G per anchor.' }),
  hist('H5.gpath.2026-02', 'other', 'Frontier effective-compute path G, 15 Feb 2026', 2026.13, 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 28.7, targetId: 'GPATH.ai2027.2026', notes: 'Game tolerance +-0.2 G per anchor.' }),
  hist('H5.gpath.2026-04', 'other', 'Frontier effective-compute path G, 15 Apr 2026', 2026.29, 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 29.0, targetId: 'GPATH.ai2027.2026', notes: 'Game tolerance +-0.2 G per anchor.' }),
  hist('H5.gpath.2026-10', 'other', 'Frontier effective-compute path G, 15 Oct 2026', 2026.79, 'G', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { value: 29.4, targetId: 'GPATH.ai2027.2026', notes: 'Game tolerance +-0.2 G per anchor.' }),
  hist('H5.gpath.slope', 'other', 'Growth of the frontier effective-compute path G per year, 2025-26', 2026.79, 'G per year', 'AI 2027 frontier anchors (research/12 §0.2)', 'research/12 §0.2 via calib.ts:285-291', { lo: 1.1, hi: 1.3, bandFrom: 'source', targetId: 'GPATH.ai2027.2026', notes: 'A range with no central value. The game prints this slope but does not check it.' }),
  // H6 pretraining stack growth
  hist('H6.pretrainRate', 'other', 'Pretraining stack growth, to 2024', 2024.99, 'OOM per year', 'Ho et al.', 'research/20:33 B1 (targets.ts:209)', { value: 0.48, targetId: 'STACK.pretrainRate.ai2027', notes: 'Game tolerance +-30%. Target today is the ai2027 preset only.' }),
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
  hist('H13.privateMarks.2025-07', 'other', 'Total value of the private labs, Jul 2025', 2025.5, 'USD B', 'Lab valuations (research/15 §2.9)', 'research/15 §2.9 (targets.ts:744)', { lo: 450, hi: 750, bandFrom: 'source', targetId: 'F9.fc1.privateMarks', notes: 'A range ($0.45-0.75T) with no central value.' }),
  hist('H13.privateMarks.2026-late', 'other', 'Total value of the private labs, Oct 2026 to Jan 2027', 2026.99, 'USD B', 'Lab valuations (research/15 §2.9)', 'research/15 §2.9 (targets.ts:744)', { lo: 2200, hi: 3300, bandFrom: 'source', targetId: 'F9.fc1.privateMarks', notes: 'A range ($2.2-3.3T) with no central value. The window runs to Jan 2027; date is capped at the end of 2026.' }),
  // H14-H19 safety effects
  hist('H14.inoculation.mis', 'safetyEffect', 'Inoculation prompting cuts misalignment caused by reward hacking', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1182-1206', { lo: 0.75, hi: 0.9, bandFrom: 'source', targetId: 'F2.inoculation.mis', notes: 'A range (75-90%) with no central value.' }),
  hist('H14.inoculation.af', 'safetyEffect', 'Inoculation prompting cuts alignment faking', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1182-1206', { lo: 0.75, hi: 0.9, bandFrom: 'source', targetId: 'F2.inoculation.af', notes: 'A range (75-90%) with no central value.' }),
  hist('H14.inoculation.sabotage', 'safetyEffect', 'Inoculation prompting cuts sabotage', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1182-1206', { lo: 0.75, hi: 0.95, bandFrom: 'source', targetId: 'F2.inoculation.sabotage', notes: 'A range (75-95%) with no central value.' }),
  hist('H15.antiScheming.cut', 'safetyEffect', 'Anti-scheming training cuts covert actions', 2025.5, 'fraction', 'Schoen 2025', 'targets.ts:1218', { lo: 0.9, hi: 0.98, bandFrom: 'source', targetId: 'F5.antiScheming.cut', notes: 'A range (90-98%) with no central value. o3 13% to 0.4%; o4-mini 8.7% to 0.3%.' }),
  hist('H16.sabotageAfterHacking', 'safetyEffect', 'Share of safety-research runs with sabotage after learned hacking', 2025.5, 'fraction', 'MacDiarmid 2025', 'targets.ts:1170', { value: 0.12, targetId: 'F2.sabotageAfterHacking', notes: 'The game checks 6-20% (one setting, +-50%).' }),
  hist('H17.persistence.scheme', 'safetyEffect', 'Safety training leaves a scheming behaviour in place', 2025.5, 'fraction', 'Hubinger 2024; research/20 F6', 'targets.ts:1258', { lo: 0.8, hi: 1.0, bandFrom: 'source', targetId: 'F6.persistence.scheme', notes: 'A range (80-100%) with no central value. Span 2024-26, read at mid-2025.' }),
  hist('H18.evalAwareness2026', 'safetyEffect', 'Share of tests the model says it notices, late 2026', 2026.87, 'fraction', 'research/05 §1.7', 'targets.ts:1230', { lo: 0.2, hi: 0.5, bandFrom: 'source', targetId: 'F5.evalAwareness2026', notes: 'A range (20-50%) with no central value.' }),
  hist('H18.afComplianceGap2026', 'safetyEffect', 'Gap in compliance when the model thinks it is watched, late 2026', 2026.87, 'fraction', 'research/05 §1.4', 'targets.ts:1244', { lo: 0, hi: 0.15, bandFrom: 'source', targetId: 'F5.afComplianceGap2026', notes: 'A range (0-15%) with no central value.' }),
  hist('H19.actRate', 'other', 'Incident acts per lab-year, 2025', 2025.5, 'acts per lab-year', 'research/05 §1.1-1.2', 'targets.ts:1295', { value: 1.2, lo: 0.4, hi: 3, bandFrom: 'source', targetId: 'DANGER.start.actRate', notes: 'Written "~1.2".' }),
  // H20 China gap
  hist('H20.chinaGap.eci', 'chinaGap', 'Best Chinese model behind the US frontier, Nov 2026 (capability index)', 2026.87, 'months', 'IFP Oct 2026; CAISI May 2026', 'research/10:27, :135, :279', { value: 6.5, lo: 6.5, hi: 8, bandFrom: 'source', notes: 'Band 6.5-8 covers all three readings. T3.china.startLead (150-200 d) is the AI 2027 text for Jul 2025, a different date.' }),
  hist('H20.chinaGap.horizon', 'chinaGap', 'Best Chinese model behind the US frontier, Nov 2026 (task horizon)', 2026.87, 'months', 'IFP Oct 2026', 'research/10:27, :135, :279', { value: 6.6, notes: 'Inside the band 6.5-8 months given on the capability-index checkpoint.' }),
  hist('H20.chinaGap.caisi', 'chinaGap', 'Best Chinese model behind the US frontier, Nov 2026 (CAISI)', 2026.87, 'months', 'CAISI May 2026', 'research/10:27, :135, :279', { value: 8, notes: 'Inside the band 6.5-8 months given on the capability-index checkpoint.' }),
  // H21-H25 adoption and labour
  hist('H21.hoursOfUse', 'adoption', 'Share of US work hours assisted by AI, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { value: 0.063, targetId: 'A2a.hoursOfUse2026', notes: 'The game checks 5-6.5%.' }),
  hist('H21.workers', 'adoption', 'Share of US workers using AI at work, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { lo: 0.39, hi: 0.41, bandFrom: 'source', targetId: 'A2a.workers2026', notes: 'A range (39-41%) with no central value. The game checks 35-45%.' }),
  hist('H21.hoursSaved', 'adoption', 'Share of US work hours saved by AI, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { value: 0.022, targetId: 'A2a.hoursSaved2026', notes: 'The game checks 1.7-2.7%.' }),
  hist('H21.savedPerHour', 'adoption', 'Hours saved per hour of AI use, Q2 2026', 2026.37, 'hours per hour', 'Bick, Blandin, Deming RPS', 'research/22:23-31 (targets.ts:981-1017)', { value: 0.35, targetId: 'A2a.savedPerHour', notes: 'The game checks 0.3-0.4.' }),
  hist('H22.firmAdoption.2026-01', 'adoption', 'US firms using AI, Jan 2026', 2026.04, 'fraction', 'Census BTOS', 'research/22 row 1f (targets.ts:1067)', { value: 0.177, targetId: 'W4.firmAdoption', notes: 'The game checks 15-22%.' }),
  hist('H22.firmAdoption.2026-05', 'adoption', 'US firms using AI, May 2026', 2026.37, 'fraction', 'Census BTOS', 'research/22 row 1f (targets.ts:1067)', { value: 0.198, targetId: 'W4.firmAdoption', notes: 'The game checks 15-22%.' }),
  hist('H23.paidShare2026', 'adoption', 'Paid share of AI users, 2026', 2026.5, 'fraction', 'research/22 row 2e (50M subscribers of 900M weekly users)', 'research/22 row 2e (targets.ts:1029)', { value: 0.056, targetId: 'A2b.paidShare2026', notes: 'Written "~5.6%". The game checks 4-9% at both ends of 2026.' }),
  hist('H24.chatgptWAU.2025-07', 'adoption', 'ChatGPT weekly active users, Jul 2025', 2025.5, 'users', 'NBER w34255; OpenAI', 'research/22:23-61 row 2c', { value: m(700) }),
  hist('H24.chatgptWAU.2026-02', 'adoption', 'ChatGPT weekly active users, Feb 2026', 2026.13, 'users', 'NBER w34255; OpenAI', 'research/22:23-61 row 2c', { value: m(900), notes: 'Source reads ">900M": a lower bound.' }),
  hist('H24.copilotSeats.2026-01', 'adoption', 'Microsoft 365 Copilot paid seats, Jan 2026', 2026.04, 'seats', 'Microsoft earnings', 'research/22:23-61 row 4e', { value: m(15) }),
  hist('H24.copilotSeats.2026-07', 'adoption', 'Microsoft 365 Copilot paid seats, Jul 2026', 2026.54, 'seats', 'Microsoft earnings', 'research/22:23-61 row 4e', { value: m(30), notes: 'Source reads "30M+": a lower bound.' }),
  hist('H24.devDaily.2025', 'adoption', 'Developers using AI daily, 2025', 2025.5, 'fraction', 'Stack Overflow Developer Survey', 'research/22:23-61 row 6a', { value: 0.506 }),
  hist('H24.devDaily.2026', 'adoption', 'Developers using AI daily, 2026', 2026.5, 'fraction', 'Stack Overflow Developer Survey', 'research/22:23-61 row 6a', { value: 0.73 }),
  hist('H24.hoursAssisted.2024-Q3', 'adoption', 'Share of US work hours assisted by AI, Q3 2024', 2024.62, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.041, notes: 'The quarters for the four values come from research/22 row 1b (Q3 2024, Q4 2025, Q2 2026, Q3 2026).' }),
  hist('H24.hoursAssisted.2025-Q4', 'adoption', 'Share of US work hours assisted by AI, Q4 2025', 2025.87, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.056 }),
  hist('H24.hoursAssisted.2026-Q2', 'adoption', 'Share of US work hours assisted by AI, Q2 2026', 2026.37, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.063, notes: 'The same figure as H21 hours of use.' }),
  hist('H24.hoursAssisted.2026-Q3', 'adoption', 'Share of US work hours assisted by AI, Q3 2026', 2026.62, 'fraction', 'Bick, Blandin, Deming RPS', 'research/22:23-61 row 1b; :354-360', { value: 0.053 }),
  hist('H25.aggregateU', 'other', 'Aggregate unemployment effect of AI, Nov 2026', 2026.87, 'percentage points', 'Stanford "Canaries"', 'research/09:53; targets.ts:1041-1054', { value: 0, targetId: 'W4.aggregateU', notes: 'Written "~0". The game checks +-0.15 pp.' }),
  hist('H25.youthExposed', 'other', 'Exposed workers aged 22-25 versus the no-AI path, Nov 2026', 2026.87, 'fraction vs counterfactual', 'Stanford "Canaries"', 'research/09:53; targets.ts:1041-1054', { value: -0.19, targetId: 'W4.youthExposed', notes: '19% below the counterfactual. The game checks +-5 points; the target stores the ratio 0.81.' }),
  // H26 R&D uplift
  hist('H26.uplift.metr', 'other', 'AI uplift to AI R&D pace, Oct 2026 (METR estimate for Anthropic)', 2026.79, 'x', 'METR', 'research/09:45', { value: 2, lo: 1.3, hi: 3, bandFrom: 'source', notes: 'Written "~2x". RS.<preset>.startM is the v1 multiplier at the start, a different quantity.' }),
  hist('H26.uplift.attributable', 'other', 'AI-attributable uplift to AI R&D pace, Oct 2026', 2026.79, 'x', 'METR', 'research/09:45', { value: 1.7, notes: 'Written "~1.7x".' }),
  hist('H26.uplift.anthropicCoding', 'other', 'Coding uplift inside Anthropic, Oct 2026', 2026.79, 'x', 'Anthropic internal', 'research/09:45', { value: 2 }),
];

// ───────────── timelines = the AI Futures Model (aifm-public 1c40ecdb), three configurations, 1,000 samples each ─────────────
// Extracted by aifm-runs/scripts/extract.py into aifm-runs/out/{fast,central,slow}.json (settings: aifm-runs/CONFIGS.md).
// Every row is [p10, p25, p50, p75, p90]; null = that percentile is not reached (more samples never reach the milestone
// than the tail holds). Years are decimal years; the series are read at 1 January of the year.
type Q5 = [number, number, number, number | null, number | null];
interface AifmRun {
  ok: number; requested: number;   // samples that ran / were asked for (failed or timed-out samples are dropped by the extractor)
  milestones: Record<'AC' | 'SAR' | 'SIAR' | 'TED-AI' | 'ASI', { q: Q5; by2100: number; never: number }>; // by2100 / never: share of samples not reached by 2100 / never in the run (to 2200)
  gaps: Record<'AC->SAR' | 'SAR->SIAR' | 'SIAR->ASI' | 'AC->ASI', { q: Q5; n: number }>;               // years, over the samples that reach both ends
  series: Record<'h80' | 'h50' | 'speedup' | 'effCompute', Record<number, Q5>>;
}
const AIFM_YEARS = [2027, 2028, 2030, 2032, 2035];
// Frontier training compute, an input of the model (not sampled in the public configs): the same in every timeline.
const AIFM_TRAIN: Record<number, number> = { 2027: 479640, 2028: 1512000, 2030: 7518000, 2032: 20877209, 2035: 79888790 };
const AIFM_RUN: Record<TimelineId, AifmRun> = {
  fast: {
    ok: 949, requested: 1000,
    milestones: {
      AC: { q: [2026.92, 2027.27, 2027.89, 2028.97, 2031.6], by2100: 0.0105, never: 0.0095 },
      SAR: { q: [2027.21, 2027.79, 2028.82, 2030.93, 2035.7], by2100: 0.0148, never: 0.0116 },
      SIAR: { q: [2027.52, 2028.17, 2029.71, 2033.54, 2047.43], by2100: 0.0358, never: 0.0232 },
      'TED-AI': { q: [2027.43, 2028.05, 2029.37, 2033.13, 2045.93], by2100: 0.039, never: 0.0316 },
      ASI: { q: [2027.55, 2028.34, 2030.28, 2036.41, 2066.86], by2100: 0.0674, never: 0.0485 },
    },
    gaps: {
      'AC->SAR': { q: [0.01, 0.17, 0.54, 1.35, 3.81], n: 938 },
      'SAR->SIAR': { q: [0.08, 0.19, 0.6, 1.99, 7.67], n: 927 },
      'SIAR->ASI': { q: [0.01, 0.03, 0.2, 1.22, 6.9], n: 902 },
      'AC->ASI': { q: [0.22, 0.52, 1.43, 4.98, 15.33], n: 902 },
    },
    series: {
      h80: {
        2027: [530.0, 701.0, 1100.0, 2600.0, 10600.0],
        2028: [2520.0, 7690.0, 121000.0, 4.19e41, 9.94e63],
        2030: [95000.0, 38100000.0, 2.27e43, 2.68e70, 2.18e107],
        2032: [2860000.0, 1020000000000.0, 1.71e51, 5.47e79, 6.65e125],
        2035: [181000000.0, 3.2e20, 4.69e54, 8.51e88, 3.61e146],
      },
      h50: {
        2027: [2690.0, 3560.0, 5580.0, 13200.0, 53900.0],
        2028: [12800.0, 39100.0, 614000.0, 2.13e42, 5.05e64],
        2030: [483000.0, 194000000.0, 1.15e44, 1.36e71, 1.11e108],
        2032: [14500000.0, 5170000000000.0, 8.69e51, 2.78e80, 3.38e126],
        2035: [922000000.0, 1.63e21, 2.38e55, 4.32e89, 1.83e147],
      },
      speedup: {
        2027: [1.12, 1.23, 1.46, 2.04, 4.06],
        2028: [1.28, 1.62, 3.16, 50.3, 190000000.0],
        2030: [1.97, 5.85, 274.0, 8670000.0, 8.72e16],
        2032: [3.19, 32.3, 4360.0, 330000000.0, 1.29e19],
        2035: [8.71, 133.0, 24400.0, 4190000000.0, 3.33e20],
      },
      effCompute: {
        2027: [28.21, 28.51, 29.16, 30.44, 32.05],
        2028: [29.3, 29.98, 31.51, 36.09, 65.07],
        2030: [31.56, 33.52, 39.16, 60.91, 112.67],
        2032: [33.39, 36.47, 46.34, 71.7, 130.38],
        2035: [35.41, 39.84, 51.93, 80.27, 142.99],
      },
    },
  },
  central: {
    ok: 987, requested: 1000,
    milestones: {
      AC: { q: [2027.32, 2028.23, 2030.42, 2040.98, 2078.18], by2100: 0.0831, never: 0.0638 },
      SAR: { q: [2027.81, 2029.15, 2032.45, 2045.1, 2090.1], by2100: 0.0952, never: 0.0729 },
      SIAR: { q: [2028.34, 2030.14, 2036.1, 2057.28, null], by2100: 0.1398, never: 0.1033 },
      'TED-AI': { q: [2028.31, 2030.02, 2035.85, 2060.19, null], by2100: 0.154, never: 0.1196 },
      ASI: { q: [2028.66, 2030.88, 2040.35, 2075.67, null], by2100: 0.2067, never: 0.1672 },
    },
    gaps: {
      'AC->SAR': { q: [0.0, 0.17, 0.67, 2.17, 7.18], n: 915 },
      'SAR->SIAR': { q: [0.16, 0.36, 1.23, 4.75, 14.2], n: 885 },
      'SIAR->ASI': { q: [0.03, 0.12, 0.85, 4.17, 18.12], n: 822 },
      'AC->ASI': { q: [0.37, 0.9, 3.02, 10.65, 30.15], n: 822 },
    },
    series: {
      h80: {
        2027: [377.0, 496.0, 833.0, 2410.0, 23600.0],
        2028: [996.0, 2370.0, 14200.0, 3.33e26, 1.57e52],
        2030: [6110.0, 76100.0, 2070000000000000.0, 4.65e57, 3.91e82],
        2032: [25000.0, 2520000.0, 1.32e40, 9.8e66, 1.23e102],
        2035: [178000.0, 456000000.0, 1.62e46, 1.81e75, 5.35e112],
      },
      h50: {
        2027: [1910.0, 2520.0, 4230.0, 12200.0, 120000.0],
        2028: [5060.0, 12000.0, 72100.0, 1.69e27, 7.98e52],
        2030: [31000.0, 386000.0, 1.05e16, 2.36e58, 1.98e83],
        2032: [127000.0, 12800000.0, 6.68e40, 4.98e67, 6.26e102],
        2035: [904000.0, 2320000000.0, 8.23e46, 9.19e75, 2.72e113],
      },
      speedup: {
        2027: [1.02, 1.06, 1.18, 1.5, 2.15],
        2028: [1.04, 1.12, 1.42, 2.74, 25.1],
        2030: [1.07, 1.29, 2.68, 81.2, 198000.0],
        2032: [1.11, 1.47, 10.2, 1540.0, 18100000.0],
        2035: [1.16, 1.92, 52.5, 10700.0, 183000000.0],
      },
      effCompute: {
        2027: [28.18, 28.47, 29.08, 30.21, 31.65],
        2028: [29.15, 29.68, 30.8, 33.24, 37.81],
        2030: [30.94, 32.03, 34.59, 41.49, 59.96],
        2032: [32.27, 33.74, 38.02, 48.74, 72.6],
        2035: [33.79, 35.87, 41.97, 56.21, 85.66],
      },
    },
  },
  slow: {
    ok: 1000, requested: 1000,
    milestones: {
      AC: { q: [2027.81, 2029.51, 2033.78, 2043.16, 2064.06], by2100: 0.051, never: 0.031 },
      SAR: { q: [2028.42, 2030.56, 2035.46, 2047.63, 2072.69], by2100: 0.064, never: 0.038 },
      SIAR: { q: [2028.79, 2031.56, 2038.02, 2053.56, 2100.86], by2100: 0.102, never: 0.056 },
      'TED-AI': { q: [2028.72, 2031.17, 2036.99, 2053.02, 2098.55], by2100: 0.099, never: 0.063 },
      ASI: { q: [2028.93, 2032.04, 2039.38, 2060.16, 2140.77], by2100: 0.136, never: 0.091 },
    },
    gaps: {
      'AC->SAR': { q: [0.01, 0.23, 0.77, 2.22, 7.01], n: 962 },
      'SAR->SIAR': { q: [0.1, 0.29, 0.95, 3.12, 10.98], n: 944 },
      'SIAR->ASI': { q: [0.01, 0.04, 0.26, 1.69, 7.36], n: 909 },
      'AC->ASI': { q: [0.27, 0.7, 2.15, 7.25, 20.95], n: 909 },
    },
    series: {
      h80: {
        2027: [380.0, 487.0, 775.0, 1590.0, 4050.0],
        2028: [961.0, 1770.0, 5210.0, 35600.0, 796000.0],
        2030: [4730.0, 16600.0, 178000.0, 21800000.0, 1.19e22],
        2032: [14500.0, 96700.0, 2810000.0, 553000000000.0, 5.97e39],
        2035: [57000.0, 889000.0, 202000000.0, 1.55e21, 5.49e48],
      },
      h50: {
        2027: [1930.0, 2480.0, 3940.0, 8050.0, 20600.0],
        2028: [4880.0, 8980.0, 26500.0, 181000.0, 4040000.0],
        2030: [24000.0, 84400.0, 904000.0, 111000000.0, 6.06e22],
        2032: [73500.0, 491000.0, 14300000.0, 2810000000000.0, 3.03e40],
        2035: [290000.0, 4520000.0, 1030000000.0, 7.9e21, 2.79e49],
      },
      speedup: {
        2027: [1.08, 1.15, 1.31, 1.56, 2.09],
        2028: [1.12, 1.22, 1.45, 1.99, 4.19],
        2030: [1.19, 1.36, 1.81, 6.66, 644000.0],
        2032: [1.24, 1.5, 2.4, 382.0, 125000000000.0],
        2035: [1.3, 1.78, 8.26, 122000.0, 2240000000000000.0],
      },
      effCompute: {
        2027: [28.2, 28.49, 29.09, 30.23, 31.69],
        2028: [29.15, 29.67, 30.76, 32.92, 36.48],
        2030: [30.85, 31.79, 34.11, 39.08, 59.53],
        2032: [32.04, 33.48, 37.06, 45.52, 80.02],
        2035: [33.54, 35.65, 40.82, 58.33, 106.74],
      },
    },
  },
};

const AIFM_MAX_MIN = 1e7; // horizons above this (about 83 work-years) are the model's post-takeoff blow-up: not shown
const aifmSource = (t: TimelineId) => `AI Futures Model, aifm-public 1c40ecdb, 1000 samples, config ${t} (aifm-runs/CONFIGS.md)`;
const aifmRef = (t: TimelineId) => `aifm-runs/configs/${t}.yaml`;
const yr = (v: number | null) => (v === null ? 'n/a' : v.toFixed(2));
const pc = (f: number) => `${+(f * 100).toPrecision(2)}%`;

function aifmTimeline(t: TimelineId): Checkpoint[] {
  const run = AIFM_RUN[t], src = aifmSource(t), ref = aifmRef(t), out: Checkpoint[] = [];
  const ran = `${run.ok} of ${run.requested} samples ran; the rest failed or timed out and are dropped.`;
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
  return out;
}
const FAST = aifmTimeline('fast'), CENTRAL = aifmTimeline('central'), SLOW = aifmTimeline('slow');

// ───────────── alignment levels (SC1 §6) ─────────────
const LABEL_REF = 'targets.ts:453; starts.ts:20-24';
const LABEL_NOTE = 'Existing start-difficulty label band for the strongest bot win rate, offered as a starting point; the designer sets the real per-level band (winBand).';
const ALIGNMENT: Checkpoint[] = [
  al('beginner', 'winRate', 'Strongest-bot win rate at the Beginner level', 'none', `${SC1}:172`, { status: 'blank', notes: 'No existing label band; the designer sets it.' }),
  al('easy', 'winRate', 'Strongest-bot win rate at the Easy level', 'Start difficulty label "Easy" (30% or more)', LABEL_REF, { lo: 0.3, bandFrom: 'source', status: 'proposed', targetId: 'START.difficultyLabel', notes: LABEL_NOTE }),
  al('normal', 'winRate', 'Strongest-bot win rate at the Normal level', 'Start difficulty label "Medium" (10-30%)', LABEL_REF, { lo: 0.1, hi: 0.3, bandFrom: 'source', status: 'proposed', targetId: 'START.difficultyLabel', notes: LABEL_NOTE }),
  al('hard', 'winRate', 'Strongest-bot win rate at the Hard level', 'Start difficulty label "Hard" (1-10%)', LABEL_REF, { lo: 0.01, hi: 0.1, bandFrom: 'source', status: 'proposed', targetId: 'START.difficultyLabel', notes: LABEL_NOTE }),
  al('impossible', 'winRate', 'Strongest-bot win rate at the Impossible level', 'Start difficulty label "Impossible" (under 1%)', LABEL_REF, { hi: 0.01, bandFrom: 'source', status: 'proposed', targetId: 'START.difficultyLabel', notes: LABEL_NOTE }),
];

export const CHECKPOINTS: Checkpoint[] = [...HISTORY, ...FAST, ...CENTRAL, ...SLOW, ...ALIGNMENT];
