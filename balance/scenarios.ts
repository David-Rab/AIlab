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

export const TIMELINES: Timeline[] = [
  {
    id: 'fast',
    name: 'Fast (AI 2027)',
    sourceModel: 'AI 2027 scenario and its timelines and takeoff forecasts (Kokotajlo et al. 2025)',
    summary: 'AI that codes better than any human arrives in early 2027, and superintelligence follows by the end of 2027. This is the pace the AI 2027 scenario describes.',
  },
  {
    id: 'central',
    name: 'Central (AI Futures model)',
    sourceModel: "AI Futures Model, authors' median run, Eli's median parameters 08/16/26 (AI Futures Project)",
    summary: 'AI that codes better than any human arrives around 2029 to 2030, and superintelligence follows about four years later, in the early 2030s.',
  },
  {
    id: 'slow',
    name: 'Slow (steady exponential)',
    sourceModel: 'AI Futures Project December 2025 model update (pure exponential horizon growth), with the METR 7-month doubling trend; later milestones not yet sourced',
    summary: 'The length of tasks AI can do keeps growing at a steady pace instead of speeding up, so AI that codes better than any human arrives around 2034. The dates after that are still to be sourced.',
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

// ───────────── fast = AI 2027 (SC1 §3a) ─────────────
const AI27 = 'AI 2027 scenario and takeoff forecast';
const FAST: Checkpoint[] = [
  tl('fast', 'horizon80.2026.27', 'horizon80', 'Internal 80% horizon, median superexponential trajectory, 2026.27', 'min', AI27, 'research/03:258',
    { date: 2026.27, value: 179, status: 'unsure', notes: 'Conflicts with ~3 work-weeks at end-2026 (7,200 min) if both are on one curve: 179 min at 2026.27 vs about 3 work-weeks at end-2026. The exponential branch is ~123 min.' }),
  tl('fast', 'horizon80.2026.27.exp', 'horizon80', 'Internal 80% horizon, exponential branch, 2026.27', 'min', AI27, 'research/03:258', { date: 2026.27, value: 123 }),
  tl('fast', 'horizon80.2026-end', 'horizon80', 'Task horizon (80%) on the central AI 2027 trajectory, end of 2026', 'min', AI27, 'research/09:59',
    { date: 2026.99, value: 7200, status: 'unsure', notes: 'SC1 gives "~3 work-weeks (80%)"; written here as 3 x 40 h x 60 min. Conflicts with 179 min at 2026.27 if both are on one curve. The AI Futures Project graded the measured horizon at 1.04x of the trajectory through 2025.' }),
  tl('fast', 'M.1.5x', 'other', 'AI R&D speed-up reaches 1.5x', 'x', AI27, 'research/03:236; targets.ts GOLD.ai2027.M1.5',
    { date: 2026.07, value: 1.5, targetId: 'GOLD.ai2027.M1.5', notes: 'Value is the multiplier, date is when the AI 2027 trajectory reaches it. An AI 2027 forecast dated 2026: SC1 §1 note (c) and Q5 ask whether to replace it by the measured H26.' }),
  tl('fast', 'M.3x', 'other', 'AI R&D speed-up reaches 3x', 'x', AI27, 'research/03:236; targets.ts GOLD.ai2027.M3',
    { date: 2026.96, value: 3, targetId: 'GOLD.ai2027.M3', notes: 'Value is the multiplier, date is when the AI 2027 trajectory reaches it. SC1 §1 note (c) and Q5 ask whether to replace it by the measured H26.' }),
  tl('fast', 'M.10x', 'other', 'AI R&D speed-up reaches 10x', 'x', AI27, 'research/03:236; targets.ts GOLD.ai2027.M10', { date: 2027.5, value: 10, targetId: 'GOLD.ai2027.M10', notes: 'Value is the multiplier, date is when the AI 2027 trajectory reaches it.' }),
  tl('fast', 'M.50x', 'other', 'AI R&D speed-up reaches 50x', 'x', AI27, 'research/03:236; targets.ts GOLD.ai2027.M50', { date: 2027.8, value: 50, targetId: 'GOLD.ai2027.M50', notes: 'Value is the multiplier, date is when the AI 2027 trajectory reaches it.' }),
  tl('fast', 'SC', 'milestone', 'AI that codes better than any human (SC)', 'year', AI27, 'research/11:149-166; targets.ts:20', { milestone: 'SC', value: 2027.24, targetId: 'GOLD.ai2027.SC', notes: 'Mar 2027, day 638. No band in source (forecast CI: Eli 2025-2039, Nikola 2025-2033). Also tested as T1.ai2027.SC and T1L.ai2027.SC.' }),
  tl('fast', 'SAR', 'milestone', 'AI that does AI research better than any human (SAR)', 'year', AI27, 'research/11:149-166; targets.ts:20', { milestone: 'SAR', value: 2027.66, targetId: 'GOLD.ai2027.SAR', notes: 'Aug 2027, day 791. Also tested as T1.ai2027.SAR and T1L.ai2027.SAR.' }),
  tl('fast', 'SIAR', 'milestone', 'Superintelligent AI researcher (SIAR)', 'year', AI27, 'research/11:149-166; targets.ts:20', { milestone: 'SIAR', value: 2027.92, targetId: 'GOLD.ai2027.SIAR', notes: 'Nov 2027, day 883. Also tested as T1.ai2027.SIAR and T1L.ai2027.SIAR.' }),
  tl('fast', 'ASI', 'milestone', 'Artificial superintelligence (ASI)', 'year', AI27, 'research/11:149-166; targets.ts:20', { milestone: 'ASI', value: 2028.0, targetId: 'GOLD.ai2027.ASI', notes: 'Dec 2027, day 915. Also tested as T1.ai2027.ASI and T1L.ai2027.ASI.' }),
  tl('fast', 'interval.SC-SAR', 'interval', 'Time from SC to SAR', 'years', AI27, `${SC1}:73 (derived from the four dates)`, { from: 'SC', milestone: 'SAR', value: 0.42 }),
  tl('fast', 'interval.SAR-SIAR', 'interval', 'Time from SAR to SIAR', 'years', AI27, `${SC1}:73 (derived from the four dates)`, { from: 'SAR', milestone: 'SIAR', value: 0.26 }),
  tl('fast', 'interval.SIAR-ASI', 'interval', 'Time from SIAR to ASI', 'years', AI27, `${SC1}:73 (derived from the four dates)`, { from: 'SIAR', milestone: 'ASI', value: 0.08 }),
  tl('fast', 'mult.SC', 'other', 'AI R&D speed-up at SC', 'x', AI27, 'research/03:188', { milestone: 'SC', value: 5, notes: 'Fixed in the source, no uncertainty modelled.' }),
  tl('fast', 'mult.SAR', 'other', 'AI R&D speed-up at SAR', 'x', AI27, 'research/03:188', { milestone: 'SAR', value: 25, notes: 'Fixed in the source, no uncertainty modelled.' }),
  tl('fast', 'mult.SIAR', 'other', 'AI R&D speed-up at SIAR', 'x', AI27, 'research/03:188', { milestone: 'SIAR', value: 250, notes: 'Fixed in the source, no uncertainty modelled.' }),
  tl('fast', 'mult.ASI', 'other', 'AI R&D speed-up at ASI', 'x', AI27, 'research/03:188', { milestone: 'ASI', value: 2000, notes: 'Fixed in the source, no uncertainty modelled.' }),
  tl('fast', 'worldCompute.growth-to-2029', 'other', 'World compute growth per year until 2029', 'x per year', AI27, 'research/11:149-166 (#18); research/09:43', { date: 2029.0, value: 2.25, notes: 'Holds until 2029.0.' }),
  tl('fast', 'worldCompute.growth-after-2029', 'other', 'World compute growth per year after 2029', 'x per year', AI27, 'research/11:149-166 (#18); research/09:43', { date: 2029.0, value: 1.5, notes: 'Holds from 2029.0.' }),
  tl('fast', 'worldCompute.2026-end', 'worldCompute', 'World compute, end of 2026', 'H100e', AI27, 'research/11:149-166 (#18); research/09:43', { date: 2026.99, value: m(40), notes: 'The same figure as H8.' }),
  tl('fast', 'labCompute.growth', 'other', 'Lab compute growth per year (OpenBrain)', 'x per year', AI27, 'calibration.ts:64-67 (AI2027_COMPUTE_TABLE); research/09:42', { value: 3.4 }),
  tl('fast', 'labCompute.2025.5', 'other', 'OpenBrain compute, mid-2025', 'H100e', AI27, 'calibration.ts:64-67 (AI2027_COMPUTE_TABLE); research/09:42', { date: 2025.5, value: m(1) }),
  tl('fast', 'labCompute.2026.5', 'other', 'OpenBrain compute, mid-2026', 'H100e', AI27, 'calibration.ts:64-67 (AI2027_COMPUTE_TABLE); research/09:42', { date: 2026.5, value: m(4) }),
  tl('fast', 'labCompute.2027-late', 'other', 'OpenBrain compute, late 2027', 'H100e', AI27, 'calibration.ts:64-67 (AI2027_COMPUTE_TABLE); research/09:42', { date: 2027.9, value: m(15), notes: 'SC1 gives "late 2027" with no month; date is an assumed late-2027 reading.' }),
  tl('fast', 'openbrain.revenue2026', 'revenue', 'OpenBrain revenue, 2026', 'USD B', AI27, 'targets.ts:636', { date: 2026.5, value: 45, targetId: 'F7.revenue2026', notes: 'The game codes 36-67 (a blend with Anthropic CY2026). A lab-level forecast.' }),
  tl('fast', 'openbrain.revenue2027', 'revenue', 'OpenBrain revenue, 2027', 'USD B', AI27, 'targets.ts:872', { date: 2027.5, value: 140, targetId: 'F11.revenue2027', notes: 'SC1 lists no coded band for 2027 (n/a).' }),
  tl('fast', 'openbrain.capex2026', 'capex', 'OpenBrain capex, 2026', 'USD B', AI27, 'targets.ts:648', { date: 2026.5, value: 200, targetId: 'F7.capex2026', notes: 'The game codes 150-250. SC1 lists "capex $200B" under OpenBrain 2026 / 2027; read as 2026.' }),
];

// ───────────── central = AI Futures authors' 2026 AIFM run (SC1 §3b) ─────────────
const AIFM = "AI Futures Model, Eli's median parameters (08/16/26)";
const AIFM_TABLE = 'world.ts:289-290 (AIFM input_data.csv)';
const CENTRAL: Checkpoint[] = [
  tl('central', 'horizon80.2026.27', 'horizon80', 'Present 80% horizon (anchor), 2026.27', 'min', AIFM, 'research/03:203; targets.ts:109', { date: 2026.27, value: 186, lo: 97, hi: 399, bandFrom: 'source', targetId: 'GOLD.authors2026.h80', notes: 'Band is the CI [97,399]; the game tolerance is +-15%. Today only the v1 integrator is tested against it.' }),
  tl('central', 'horizonForAC', 'other', 'Task horizon needed for AC (80%)', 'work-years', AIFM, 'research/03:206', { value: 125, lo: 0.1, hi: 156250, bandFrom: 'source', notes: 'Kept in work-years (the source unit) rather than converted to minutes.' }),
  tl('central', 'doublingTime', 'other', 'Horizon doubling time now', 'months', AIFM, 'research/03:204-205', { value: 4.5, lo: 2.2, hi: 9.2, bandFrom: 'source' }),
  tl('central', 'difficultyFactor', 'other', 'Difficulty factor d of the horizon trend', 'factor', AIFM, 'research/03:204-205', { value: 0.92, lo: 0.82, hi: 1.02, bandFrom: 'source' }),
  tl('central', 'horizon80.2027.0', 'horizon80', 'Horizon at 2027.0 (lite law, hand-computed)', 'min', AIFM, 'world.ts:101-114 with authors2026 values (hand-computed, SC1 §3b)', { date: 2027.0, value: 914, status: 'unsure', notes: 'Hand-computed from the lite law, not read from a dated AIFM run; needs one AIFM run.' }),
  tl('central', 'horizon80.2028.0', 'horizon80', 'Horizon at 2028.0 (lite law, hand-computed)', 'min', AIFM, 'world.ts:101-114 with authors2026 values (hand-computed, SC1 §3b)', { date: 2028.0, value: 20600, status: 'unsure', notes: 'Hand-computed from the lite law, not read from a dated AIFM run; needs one AIFM run.' }),
  tl('central', 'horizon80.2029.0', 'horizon80', 'Horizon at 2029.0 (lite law, hand-computed)', 'min', AIFM, 'world.ts:101-114 with authors2026 values (hand-computed, SC1 §3b)', { date: 2029.0, value: m(3.2), status: 'unsure', notes: 'Hand-computed from the lite law, not read from a dated AIFM run; needs one AIFM run.' }),
  ...([[2025, 8.6, 0.516], [2026, 22.4, 1.79], [2027, 57.1, 6.85], [2028, 135, 21.6], [2030, 537, 107], [2032, 1510, 300]] as [number, number, number][])
    .flatMap(([y, world, leader]) => [
      tl('central', `worldCompute.${y}`, 'worldCompute', `World compute, ${y}`, 'H100e', AIFM, AIFM_TABLE, { date: y, value: m(world), notes: 'Table year read at the start of the year (the table gives 57.1M at 2027.0 and 35.8M at 2026.5).' }),
      tl('central', `leaderCompute.${y}`, 'other', `Leading-lab compute, ${y}`, 'H100e', AIFM, 'world.ts:290', { date: y, value: m(leader) }),
    ]),
  tl('central', 'AC', 'other', 'AI that can do all coding (AC), model median', 'year', AIFM, 'research/11:211, :218; research/03:244',
    { value: 2029.16, lo: 2027.46, hi: 2070.79, bandFrom: 'source', status: 'unsure', notes: 'SC is AC + 0.52. Conflict: the model median is 2029.16, while the run gives p10 Jun 2027 / p50 Jan 2030 / p90 Oct 2070. Band is the run p10 to p90 (months read at mid-month).' }),
  tl('central', 'AC.eli', 'other', "AC, Eli's all-things-considered view", 'year', AIFM, 'research/11:211, :218; research/03:244; blog quote "10th percentile 2027.5, 50th 2032.5, 90th 2085"',
    { value: 2032.5, lo: 2027.5, hi: 2085, bandFrom: 'source', status: 'unsure', notes: 'Open designer question (Q2): the model-run median (AC 2029.16) or this view (p50 2030.08 to 2032.5).' }),
  tl('central', 'SC', 'milestone', 'AI that codes better than any human (SC)', 'year', AIFM, 'research/11:211', { milestone: 'SC', value: 2029.68, targetId: 'GOLD.authors2026.SC', notes: 'No band in source (game +-0.08 y). The v1 integrator (day 1495) gives 2029.59. Also tested as T1.authors2026.SC and T1L.authors2026.SC.' }),
  tl('central', 'SAR', 'milestone', 'AI that does AI research better than any human (SAR)', 'year', AIFM, 'research/11:211', { milestone: 'SAR', value: 2029.89, targetId: 'GOLD.authors2026.SAR', notes: 'Also tested as T1.authors2026.SAR and T1L.authors2026.SAR.' }),
  tl('central', 'SIAR', 'milestone', 'Superintelligent AI researcher (SIAR)', 'year', AIFM, 'research/11:211', { milestone: 'SIAR', value: 2031.48, targetId: 'GOLD.authors2026.SIAR', notes: 'Also tested as T1.authors2026.SIAR and T1L.authors2026.SIAR.' }),
  tl('central', 'ASI', 'milestone', 'Artificial superintelligence (ASI)', 'year', AIFM, 'research/11:211', { milestone: 'ASI', value: 2033.73, targetId: 'GOLD.authors2026.ASI', notes: 'Also tested as T1.authors2026.ASI and T1L.authors2026.ASI.' }),
  tl('central', 'interval.AC-SAR', 'other', 'Time from AC to SAR', 'years', AIFM, 'research/11:209; research/03:244', { value: 0.73, notes: 'AC is not one of the four milestones, so this is not an interval checkpoint. Eli: P(AC to ASI < 1 y) 30%, < 3 y 60%.' }),
  tl('central', 'interval.AC-SIAR', 'other', 'Time from AC to SIAR', 'years', AIFM, 'research/11:209; research/03:244', { value: 2.31, notes: 'AC is not one of the four milestones, so this is not an interval checkpoint.' }),
  tl('central', 'interval.AC-ASI', 'other', 'Time from AC to ASI', 'years', AIFM, 'research/11:209; research/03:244', { value: 4.56, notes: 'AC is not one of the four milestones, so this is not an interval checkpoint. Eli: P(AC to ASI < 1 y) 30%, < 3 y 60%.' }),
  tl('central', 'interval.SC-SAR', 'interval', 'Time from SC to SAR (AI 2027 takeoff forecast)', 'years', 'AI 2027 takeoff forecast, 80% CI', 'research/03:195', { from: 'SC', milestone: 'SAR', value: 0.3, hi: 0.95, bandFrom: 'source', notes: 'Only the p90 (0.95) is given. Differs from the 0.21 y between the model-run SC and SAR dates above.' }),
  tl('central', 'interval.SAR-SIAR', 'interval', 'Time from SAR to SIAR (AI 2027 takeoff forecast)', 'years', 'AI 2027 takeoff forecast, 80% CI', 'research/03:195', { from: 'SAR', milestone: 'SIAR', value: 0.3, lo: 0.04, hi: 56, bandFrom: 'source' }),
  tl('central', 'interval.SIAR-ASI', 'interval', 'Time from SIAR to ASI (AI 2027 takeoff forecast)', 'years', 'AI 2027 takeoff forecast, 80% CI', 'research/03:195', { from: 'SIAR', milestone: 'ASI', value: 0.16, lo: 0.01, bandFrom: 'source', notes: 'The CI upper end is open (">100").' }),
  tl('central', 'uplift', 'other', 'Serial coding uplift now', 'x', AIFM, 'research/03:209-211', { date: 2026.27, value: 1.7, lo: 0.1, hi: 4.9, bandFrom: 'source', notes: 'SC1 gives only "2026"; date is the 2026.27 anchor.' }),
  tl('central', 'uplift.doubling', 'other', 'Doubling time of the uplift above 1x', 'months', AIFM, 'research/03:209-211', { value: 6.5 }),
  tl('central', 'revenue.now', 'revenue', 'Lab revenue now', 'USD B', AIFM, 'research/03:209-211', { date: 2026.27, value: 47, notes: 'SC1 gives only "2026"; date is the 2026.27 anchor.' }),
  tl('central', 'revenue.growth', 'other', 'Lab revenue growth per year', 'x per year', AIFM, 'research/03:209-211', { value: 5, lo: 2, hi: 12.5, bandFrom: 'source' }),
];

// ───────────── slow = sourced sceptic (SC1 §3c) ─────────────
const SLOW_BLANK = 'No source gives this yet; needs one run of the public AI Futures model (SC1 §3c).';
const SLOW: Checkpoint[] = [
  tl('slow', 'SC', 'milestone', 'AI that codes better than any human (SC)', 'year', 'AI Futures Project, Dec 2025 model update (pure exponential)', 'https://blog.aifutures.org/p/ai-futures-model-dec-2025-update; targets.ts GOLD.slow.SC',
    { milestone: 'SC', value: 2034, status: 'unsure', targetId: 'GOLD.slow.SC', notes: 'The source gives AC (all coding) in 2034; SC1 reads "AC / SC" as one date. No band in source; the game range is 2034-2035 (target p50 2034.5).' }),
  tl('slow', 'doubling', 'other', 'Horizon doubling time (METR 2019-25 trend)', 'months', 'METR, Measuring AI Ability to Complete Long Tasks', 'https://arxiv.org/html/2503.14499v1; research/11:235-245', { value: 7, notes: 'History H1 (4.2 months) must still hold to late 2026.' }),
  tl('slow', 'horizon80.2026.27', 'horizon80', '80% horizon at 2026.27 under 7-month doubling', 'min', 'METR TH1.1 (history H2)', 'research/09:59', { date: 2026.27, value: 186, notes: 'Must still equal history H2 under a 7-month doubling.' }),
  tl('slow', 'horizon1month', 'other', 'Year the horizon reaches one month (167 work hours)', 'year', 'METR, Measuring AI Ability to Complete Long Tasks', 'https://arxiv.org/html/2503.14499v1',
    { lo: 2028.75, hi: 2031.25, bandFrom: 'source', status: 'unsure', notes: 'Range as quoted: "late 2028 to early 2031" (v1 text); another version may read mid-2028 to mid-2031 (2028.5 to 2031.5). Quarters read as 2028.75 and 2031.25. A range with no central value.' }),
  tl('slow', 'SAR', 'milestone', 'AI that does AI research better than any human (SAR)', 'year', 'none', `${SC1}:122`, { milestone: 'SAR', status: 'blank', notes: SLOW_BLANK }),
  tl('slow', 'SIAR', 'milestone', 'Superintelligent AI researcher (SIAR)', 'year', 'none', `${SC1}:122`, { milestone: 'SIAR', status: 'blank', notes: SLOW_BLANK }),
  tl('slow', 'ASI', 'milestone', 'Artificial superintelligence (ASI)', 'year', 'none', `${SC1}:122`, { milestone: 'ASI', status: 'blank', notes: SLOW_BLANK }),
  tl('slow', 'horizon.2027-29', 'horizon80', 'Horizon at 2027 to 2029', 'min', 'none', `${SC1}:114`, { status: 'blank', notes: SLOW_BLANK }),
  tl('slow', 'worldCompute.2026-end', 'worldCompute', 'World compute, end of 2026', 'H100e', 'Epoch AI (history H8)', 'research/09:43, :72-74', { date: 2026.99, lo: m(35), hi: m(46), bandFrom: 'source', notes: 'The history band (H8); a range with no central value in this row.' }),
  tl('slow', 'worldCompute.beyond', 'worldCompute', 'World compute after 2026', 'H100e', 'none', `${SC1}:123`, { status: 'blank', notes: SLOW_BLANK }),
  tl('slow', 'aifmRun', 'other', 'Run the public AI Futures model with an exponential setting (decay 0) to read AC, SAR, SIAR, ASI, the horizon and compute at dates', 'run', 'Proposal in SC1 §3c (the route used for the central run)', `${SC1}:114`, { status: 'proposed', notes: 'Awaiting the designer (SC1 Q3). Fills the blank slow rows above.' }),
];

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
