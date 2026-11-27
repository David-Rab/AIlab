// Market chunk (B3): serving, sectors, market, tools, deals, starts, teams (data) and engine/v2/production.
// Entries are built with small helpers (`one`, `grp`) so evidence is written once per group; each expands to a plain Param
// (one per named scalar / key, see design/bal/REGISTRY-DESIGN.md §3).
import { defineParams, type Param } from '../schema';

type Meta = Omit<Param, 'id' | 'ref' | 'value' | 'unit'>;
type Leaf = [value: number | number[] | string, unit?: string, extra?: Partial<Param>];
type Val = number | number[] | string;

/** One entry: `module` is the file under src/, `path` into the export (empty for the whole export). */
const one = (module: string, symbol: string, path: (string | number)[], value: Val | undefined, unit: string | undefined, meta: Meta): Param => ({
  id: ['mkt', symbol, ...path.map(String)].join('.'),
  ref: path.length ? { kind: 'export', module, symbol, path } : { kind: 'export', module, symbol },
  ...(value === undefined ? {} : { value }),
  ...(unit === undefined ? {} : { unit }),
  ...meta,
});
/** Several leaves of one object that share their evidence (a leaf may override any field in its third slot). */
const grp = (module: string, symbol: string, path: (string | number)[], leaves: Record<string, Leaf>, meta: Meta): Param[] =>
  Object.entries(leaves).map(([k, [v, u, extra]]) => one(module, symbol, [...path, k], v, u, { ...meta, ...extra }));
const inline = (id: string, file: string, anchor: string, value: number | undefined, unit: string | undefined, meta: Meta): Param => ({
  id, ref: { kind: 'inline', file, anchor }, ...(value === undefined ? {} : { value }), ...(unit === undefined ? {} : { unit }), ...meta,
});

const W = { area: 'market', layer: 'world' } as const;
const WFX = { area: 'worldfx', layer: 'world' } as const;
const SV = 'src/data/v2/serving.ts';

// ---------- src/data/v2/serving.ts ----------
const SERVING: Param[] = [
  one(SV, 'TOKENS', ['agentic'], [2e5, 4e4], 'tokens per work-hour (input, output)', { ...W, kind: 'sourced',
    evidence: 'serving.ts:11 "FLOP-bearing tokens per human work-hour of AI work (uncached input, output) [R20 D2]: agentic coding ≈ 2M input per hour, 90% cache reads"',
    source: 'research/20 D2', notes: 'Array order = input, output (uncached, FLOP-bearing).' }),
  one(SV, 'TOKENS', ['assisted'], [3e4, 8e3], 'tokens per work-hour (input, output)', { ...W, kind: 'designer',
    evidence: 'serving.ts:13-16 "the human-attended assisted hour ... = 30k/8k ... [D; R22 §3: chat is 3.75 messages per weekly-user-day ...]"',
    notes: 'Tagged [D] with R22 §3 as rationale; array order = input, output.', source: 'research/22 §3' }),
  one(SV, 'TOKENS', ['autonomous'], [3.75e5, 6.2e4], 'tokens per work-hour (input, output)', { ...W, kind: 'sourced',
    evidence: 'serving.ts:23-25 "a day-long agent task ≈ 30M input, 90% cache reads, and 0.5M output per 8 human-hours [R20 D2] → 375k uncached input and 62k output per work-hour"',
    source: 'research/20 D2', notes: 'Array order = input, output.' }),
  one(SV, 'SECTOR_WORK', ['*', 'H'], undefined, 'hours', { ...W, kind: 'designer',
    evidence: 'serving.ts:28-32 "a typical task length H (hours of a human\'s work), verifiability v ... and the token profile ... [D]"; records carry no per-record source',
    notes: 'Field family over 14 sectors.' }),
  one(SV, 'SECTOR_WORK', ['*', 'v'], undefined, 'fraction', { ...W, kind: 'designer',
    evidence: 'serving.ts:29-32 "verifiability v (R20 E3 classes: code with tests 0.9, ML experiments 0.7, design 0.5, ...) ... [D]"; the sentence cites R20 E3 and ends [D]',
    notes: 'same numbers as cap.WORK_TYPES.v', source: 'research/20-model-v3-calibration.md:583' }),
  one(SV, 'SEATS', ['start'], [0.12, 0.02, 0.045], 'fraction of workers', { ...W, kind: 'designer',
    evidence: 'serving.ts:67-71 "Start σ0 per region [D from R22 4e–4g]: ... US 0.12 (≈ 7M), ROW 0.045 (≈ 11M); CN 0.02 (no data ...)"',
    notes: 'Array order = US, CN, ROW. [D from R22]: see Q-market-1.', source: 'research/22 4e-4g' }),
  one(SV, 'SEATS', ['cap'], 27.5, 'USD per seat-month', { ...W, kind: 'sourced',
    evidence: 'serving.ts:74-77 "`cap` = what firms pay for business AI seats today: the median of the 2025 list prices in research/MARKET-sources.md §3 (... median $27.5) [P]"',
    source: 'research/MARKET-sources.md §3 (2025 business-seat list prices, median $27.5)' }),
  one(SV, 'SEATS', ['elasticity'], 1.63, 'elasticity', { ...W, kind: 'sourced',
    evidence: 'serving.ts:81-86 "ε = 1.63 [research/MARKET-sources.md §3, 3f′: the firm margin m ≥ 0.90 at the leader\'s S = 0.32, m = 1/(ε·(1 − S)) ...]"',
    source: 'research/MARKET-sources.md §3, 3f′' }),
  one(SV, 'SEATS', ['q'], 1.5, '1/yr', { ...W, kind: 'sourced',
    evidence: 'serving.ts:65-67 "q = 1.5/yr [R22 4e: M365 Copilot seats 15M → 30M Jan → Jul 2026, ×2 per half-year = 1.39/yr at σ ≪ σ*]"',
    source: 'research/22 4e (M365 Copilot seat growth)' }),
  one(SV, 'SEATS', ['down'], 0.5, '1/yr', { ...W, kind: 'untagged', evidence: 'no tag; serving.ts:92 "Decay toward a lower ceiling (per year), as A and W."' }),
  ...grp(SV, 'AGENT_WORK', [], { checkInH: [0.25, 'hours'], floorH: [0.02, 'hours'] }, { ...W, kind: 'designer',
    evidence: 'serving.ts:107 "Constants [D]: c = 15 min (write and hand off a task; no primary source), m = 0.02 h (λ ≤ 50)"' }),
  one(SV, 'CHAT_WORK', ['w'], [0.4, 0.4, 0.2], 'fraction', { ...W, kind: 'designer',
    evidence: 'serving.ts:116 "Consumer chat as a work type (MODEL-V3 §6.1): SOCIAL, REASON, MEDIA; minutes-long tasks [D]."', notes: 'Array order = SOCIAL, REASON, MEDIA.' }),
  one(SV, 'CHAT_WORK', ['H'], 0.05, 'hours', { ...W, kind: 'designer', evidence: 'serving.ts:116 "minutes-long tasks [D]"' }),
  one(SV, 'CHAT_WORK', ['v'], 0.5, 'fraction', { ...W, kind: 'untagged', evidence: 'no tag; serving.ts:117' }),
  one(SV, 'CHAT_WORK', ['theta'], 0, 'levels', { ...W, kind: 'untagged', evidence: 'no tag; serving.ts:117' }),
  one(SV, 'SECTOR_REF', ['mid'], 0.47, 'fraction of V0-to-SC span', { ...W, kind: 'fitted',
    evidence: 'serving.ts:121-122 "ECON.fMid, fitted to research/16\'s F_SOFT anchors: Agent-1 ≈ 0.25, Agent-3-mini ≈ 0.8), i.e. mid ≈ 0.47 of the V0 → SC span [fit]"',
    fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to research/16 F_SOFT anchors (Agent-1 ~0.25, Agent-3-mini ~0.8).' }),
  one(SV, 'SECTOR_REF', ['perTheta'], 0.2, 'fraction per level', { ...W, kind: 'untagged', evidence: 'no tag; serving.ts:124' }),
  one(SV, 'PRICE_TAU', [], 30 / 365, 'years', { ...W, kind: 'designer', evidence: 'serving.ts:129 "M moves toward its target with PRICE_TAU (years) [D: list prices change about monthly]"' }),
  one(SV, 'WIN_SHARE_FRACTION', [], 0.5, 'fraction', { ...W, kind: 'designer', evidence: 'serving.ts:130 "A product on the \'share\' stance prices at cost + WIN_SHARE_FRACTION × M [D]"' }),
  one(SV, 'SEED_MARKUP', [], [2.5, 1 / 0.6], 'cost multiplier', { ...W, kind: 'untagged',
    evidence: 'no tag; serving.ts:135-137 "at the old standard markup (margin 0.6) and DeepCent\'s old budget one (margin 0.4)"', notes: 'Array order = closed, china; only seeds a missing margin (old saves, new entrants).' }),
  one(SV, 'OPEN_PLAN_SHARE', [], 1.2 * 0.4, 'fraction of willingness to pay', { ...W, kind: 'derived',
    evidence: 'serving.ts:139-141 "(the old ×1.2-over-cost host against the old standard ×2.5: ×0.48 ...)"; computed as 1.2 * 0.4' }),
  one(SV, 'SAFEGUARD_DG', [], [0, 0, -0.0417, -0.1667], 'OOM', { ...W, kind: 'designer',
    evidence: 'serving.ts:143 "Safeguards and the AI-control layer cost fit, in OOM [D] (RD-U01: v2\'s level offsets restated in OOM)"', notes: 'Array order = minimal, standard, classifiers, hardened.' }),
  one(SV, 'CONTROL_LAYER_DG', [], -0.0833, 'OOM', { ...W, kind: 'designer', evidence: 'serving.ts:143-144 "control layer −0.0833 (was −0.1 L) [D]"' }),
  one(SV, 'SHARE_SLOPE_G', [], 4, 'per OOM', { ...W, kind: 'designer', evidence: 'serving.ts:149 "v2\'s 2.1 per level at ≈ 2 levels per OOM before SC [D]"' }),
  one(SV, 'PRICE_ELASTICITY', [], 0.3, 'elasticity', { ...W, kind: 'fitted',
    evidence: 'serving.ts:154-157 "[fit, research/MARKET-sources.md §3] ε = 0.3 puts the start leader\'s hours-weighted Nash–Bertrand margin at ≈ 0.81–0.83 (seeds 2027, 7, 42; scripts/v2/_mk6/check.ts) ... final calibration at MK-CP"',
    fit: { targets: [], script: 'scripts/v2/_mk6/check.ts' }, notes: 'Fitted so the start leader margin is ~0.81-0.83, inside the 0.8-0.9 evidence band (not a range for epsilon).' }),
  one(SV, 'MARKET_BANDS', [], 8, 'bands', { ...W, kind: 'designer', evidence: 'serving.ts:162 "[D: 8 bands; the share moves by ≤ 1/16 when one more band opens]"' }),
  one(SV, 'CUSTOMER_TAU', ['consumer'], 3 / 52, 'years', { ...W, kind: 'designer', evidence: 'serving.ts:166 "consumers switch in weeks; government and defence over contract cycles [D]"' }),
  one(SV, 'CUSTOMER_TAU', ['sector'], 0.65, 'years', { ...W, kind: 'designer', evidence: 'serving.ts:166 "A8: sector buyers 0.65 y [D from P]" (Menlo Ventures 2025 mid-year update)', notes: '[D from P]: see Q-market-1.', source: 'Menlo Ventures 2025 mid-year update' }),
  one(SV, 'CUSTOMER_TAU', ['gov'], 0.75, 'years', { ...W, kind: 'designer', evidence: 'serving.ts:166 "government and defence over contract cycles [D]"' }),
  one(SV, 'MULTI_HOMING', ['providers'], 2, 'providers per firm', { ...W, kind: 'designer', evidence: 'serving.ts:176 "`providers` 2 per firm [D from P]" (Menlo 2024, a16z 2025, Menlo Dec 2025)', notes: '[D from P]: see Q-market-1.', source: 'Menlo 2024; a16z 2025; Menlo Dec 2025' }),
  one(SV, 'MULTI_HOMING', ['tau'], 3, 'years', { ...W, kind: 'designer', evidence: 'serving.ts:192-193 "Time constant `tau` 3 y [D from P]" (Anthropic enterprise share 12% -> 24% -> 40%)', notes: '[D from P]: see Q-market-1.', source: 'Anthropic enterprise share 12% -> 24% -> 40%' }),
  one(SV, 'FREE_TIER', ['oom'], 1.2, 'OOM', { ...W, kind: 'untagged', evidence: 'no tag; serving.ts:208 "{ oom: 1.2 } // was 1 progress-year"', notes: 'Block comment above gives free-tier evidence [P] but does not tag this value.' }),
  one(SV, 'LINEUP', ['ratios'], [1 / Math.SQRT2 / 2, 1 / Math.SQRT2 / 4, 1 / 80], 'fraction of flagship active parameters', { ...W, kind: 'sourced',
    evidence: 'serving.ts:214-219 "The rungs are the geometric means of the two four-tier lineups on the labs\' pricing pages, Nov 2026 [P, fetched 2026-11-21]"',
    source: 'Anthropic pricing page (platform.claude.com/docs/en/about-claude/pricing) and OpenAI pricing page (developers.openai.com/api/docs/pricing), fetched 2026-11-21' }),
  one(SV, 'CONSUMER_MKT', ['adults'], [2.6e8, 0, 3.2e9], 'adults', { ...W, kind: 'designer',
    evidence: 'serving.ts:240-242 "Online adults [D]: US ≈ 262M adults (UN WPP 2024); rest of world ... ≈ 3.2B. Recalled, not fetched this session."', notes: 'Array order = US, CN, ROW.' }),
  one(SV, 'CONSUMER_MKT', ['nonWorkShare'], 0.7, 'fraction', { ...W, kind: 'sourced',
    evidence: 'serving.ts:243-245 "Non-work share of consumer chat use [R22 2a–2b: ChatGPT 73% of messages (Jun 2025), Claude.ai 54%; range 0.55–0.75]"',
    source: 'research/22 2a-2b', range: { lo: 0.55, hi: 0.75, from: 'serving.ts:243 "range 0.55–0.75"' } }),
  one(SV, 'CONSUMER_MKT', ['reach', 'startUS'], 0.46, 'fraction of online adults', { ...W, kind: 'designer', evidence: 'serving.ts:246 "US start 0.46 [D from R22 §2: RPS non-work genAI use ≈ 50% of US adults in Nov 2025"', notes: '[D from R22]: see Q-market-1.', source: 'research/22 §2' }),
  one(SV, 'CONSUMER_MKT', ['reach', 'startRow'], 0.548, 'fraction (x US start)', { ...W, kind: 'fitted',
    evidence: 'serving.ts:252-255 "ROW starts at `startRow` × the US start (A6b, P5) ... [fit: the leader\'s day-1 users]"', fit: { targets: [], script: 'unnamed' },
    notes: 'Fitted to the leader day-1 users (ChatGPT ~700M weekly, NBER w34255).' }),
  ...grp(SV, 'CONSUMER_MKT', ['reach'], { max: [0.9, 'fraction'], base: [0.5, 'fraction'], row: [0.85, 'fraction (x US)'], down: [0.2, '1/yr'] }, { ...W, kind: 'designer',
    evidence: 'serving.ts:247-251 "Target ceiling `max` 0.9 ... [D]; `base` 0.5 ... [D]. ROW at `row` × the US [D: ...] ... and 0.2/yr down [D]"' }),
  ...grp(SV, 'CONSUMER_MKT', ['reach'], { p: [1, '1/yr'], q: [2, '1/yr'] }, { ...W, kind: 'untagged', evidence: 'no tag; serving.ts:251 "p 1, q 2 (V4a\'s reach dynamics)"' }),
  ...grp(SV, 'CONSUMER_MKT', ['paid'], { p0: [0.04, 'fraction'], p1: [0.1, 'fraction'] }, { ...W, kind: 'fitted', fit: { targets: [], script: 'manual' },
    evidence: 'serving.ts:258-260 "p0 + p1·a = 5.4% for the start\'s frontier model (coverage 0.14) ... [R22 2e] ... rising to 14% at full coverage [D]" (two anchors fix p0 and p1)',
    notes: 'Solved by hand from the 5.4% (R22 2e) and 14% (D) anchors; p0 and p1 are a pair.' }),
  ...grp(SV, 'CONSUMER_MKT', ['paid'], { max: [0.5, 'fraction'], elasticity: [1, 'elasticity'], tau: [8 / 52, 'years'] }, { ...W, kind: 'designer',
    evidence: 'serving.ts:260-264 "capped at 0.5 [D] ... elasticity ε = 1 [D] ... τ ≈ 8 weeks [D: monthly billing ...]"' }),
  one(SV, 'CONSUMER_MKT', ['wtpMonth'], 22, 'USD per subscriber-month', { ...W, kind: 'sourced',
    evidence: 'serving.ts:267 "Willingness to pay ... [R22 §2 ARPU [X]: $8–20 plans plus a few $100–200 plans ≈ $20–25; mid 22]"',
    source: 'research/22 §2 ARPU', range: { lo: 20, hi: 25, from: 'serving.ts:267 "≈ $20–25"' } }),
  one(SV, 'CONSUMER_MKT', ['perDay', 'paid'], [3e4, 8e3], 'tokens per user-day (input, output)', { ...W, kind: 'sourced',
    evidence: 'serving.ts:270 "FLOP-bearing tokens per user-day [R20 D2, R22 §3]: a paying user ≈ 10 reasoning turns (30k uncached input, 8k output)"', source: 'research/20 D2; research/22 §3', notes: 'Array order = input, output.' }),
  one(SV, 'CONSUMER_MKT', ['perDay', 'free'], [7.5e3, 1.5e3], 'tokens per user-day (input, output)', { ...W, kind: 'sourced',
    evidence: 'serving.ts:271 "a free weekly user 3.75 messages a day [R22 2g] × ≈ 2k of prompt and context and 0.4k of answer ≈ 9k tokens"', source: 'research/20 D2; research/22 §3, 2g', notes: 'Array order = input, output.' }),
  one(SV, 'CONSUMER_MKT', ['messagesPerDay'], 3.75, 'messages per weekly user-day', { ...W, kind: 'sourced',
    evidence: 'serving.ts:271 "3.75 messages a day [R22 2g: 2,627M messages ÷ 700M WAU]"', source: 'research/22 2g' }),
];

// ---------- src/data/v2/sectors.ts ----------
const SE = 'src/data/v2/sectors.ts';
const R16 = 'research/16 §1A.1 (sector table)';
const sectorFam = (field: string, unit: string, meta: Partial<Meta> & Pick<Meta, 'kind' | 'evidence'>) => one(SE, 'SECTORS', ['*', field], undefined, unit, { ...W, ...meta });
const SECTORS: Param[] = [
  sectorFam('empPct', '% of US employment', { kind: 'sourced', evidence: 'sectors.ts:10 "Share of US employment (%), relative wage (avg 1). [R16, BLS CES ±2 pp]"; no per-record source', source: R16 + '; BLS CES' }),
  sectorFam('wage', 'relative to average (avg 1)', { kind: 'sourced', evidence: 'sectors.ts:10 "relative wage (avg 1). [R16, BLS CES ±2 pp]"; no per-record source', source: R16 + '; BLS CES' }),
  sectorFam('tasks', 'task weights per domain (rows sum to 1)', { kind: 'sourced', evidence: 'sectors.ts:12 "Task weights per domain (rows sum to 1). [R16]"; no per-record source', source: R16 }),
  sectorFam('theta', 'levels', { kind: 'sourced', evidence: 'sectors.ts:14 "θ difficulty offset, R0 friction, Bass p/q per year, α_max, η demand elasticity. [R16]"', source: R16 }),
  sectorFam('R0', 'fraction', { kind: 'sourced', evidence: 'sectors.ts:14 "R0 friction ... [R16]"', source: R16 }),
  sectorFam('p', '1/yr', { kind: 'sourced', evidence: 'sectors.ts:14 "Bass p/q per year ... [R16]"; research/16 table values "themselves [D] weights" (sectors.ts:3)', source: R16, notes: 'Scaled by ECON.bassFit.' }),
  sectorFam('q', '1/yr', { kind: 'sourced', evidence: 'sectors.ts:14 "Bass p/q per year ... [R16]"', source: R16, notes: 'Scaled by ECON.bassFit.' }),
  sectorFam('alphaMax', 'fraction', { kind: 'sourced', evidence: 'sectors.ts:14 "α_max ... [R16]"', source: R16 }),
  sectorFam('eta', 'elasticity', { kind: 'sourced', evidence: 'sectors.ts:14 "η demand elasticity. [R16]"', source: R16 }),
  sectorFam('A0', 'fraction of work-hours', { kind: 'fitted', evidence: 'sectors.ts:16-17 "Start task-adoption share A (0..1) at Jul 2025, US ... [fit] to Census BTOS firm use (research/16 §6, N2a)"', fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to Census BTOS firm use; A2a check kept it.' }),
  sectorFam('use', 'ratio to US average', { kind: 'unclear', evidence: 'sectors.ts:22-27 "from the RPS by industry (research/22 §1 ...); sectors the survey does not break out are [D]"; records mix both', notes: 'See Q-market-3.' }),
  sectorFam('floor', 'share of E0', { kind: 'sourced', evidence: 'sectors.ts:29 "Employment floor as a share of E0 (\'human-made\', legally required jobs). [R16 §1A.2 step 7]"', source: 'research/16 §1A.2 step 7' }),
  sectorFam('econWeight', 'multiplier', { kind: 'sourced', evidence: 'sectors.ts:35 "Private sector (enters the ECON control domain); FIN gets ×1.5 for algorithmic trading. [R16 §2.1]"', source: 'research/16 §2.1' }),
  sectorFam('robotBias', 'relative allocation', { kind: 'designer', evidence: 'sectors.ts:37 "Relative robot allocation per physical task (industrial robots sit mostly in manufacturing). [D]"' }),
  one(SE, 'US_EMPLOYMENT', [], 160e6, 'persons', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:62 "US employment base (persons): ≈159M nonfarm payroll + 1.24M active-duty military (BLS CES Oct 2026, DMDC). [V]"', source: 'BLS CES Oct 2026; DMDC' }),
  one(SE, 'REGION_SCALE', ['ROW', 'emp'], 6, 'x US employment', { ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:65 "ROW wage × 0.5, employment × 6 [spec]" ([spec] is not a tag in the legend)', notes: 'See Q-market-4.' }),
  one(SE, 'REGION_SCALE', ['ROW', 'wage'], 0.5, 'x US wage', { ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:65 "ROW wage × 0.5, employment × 6 [spec]"', notes: 'See Q-market-4.' }),
  one(SE, 'REGION_SCALE', ['CN', 'emp'], 4.6, 'x US employment', { ...W, kind: 'designer', evidence: 'sectors.ts:65-66 "CN ≈ 740M employed at 0.3 × US wage [D]"' }),
  one(SE, 'REGION_SCALE', ['CN', 'wage'], 0.3, 'x US wage', { ...W, kind: 'designer', evidence: 'sectors.ts:65-66 "CN ≈ 740M employed at 0.3 × US wage [D]"' }),
  one(SE, 'REGION_SCALE', ['ROW', 'A0'], 0.225, 'x US start adoption', { ...W, kind: 'designer', evidence: 'sectors.ts:69-70 "A8: ROW 0.225 = 0.6 × the paid-seat ratio of AI-using workers (SEATS.start ROW 0.045 ÷ US 0.12) [D]"', notes: 'Computed from SEATS.start but written as a literal; tagged [D].' }),
  one(SE, 'REGION_SCALE', ['CN', 'A0'], 0.6, 'x US start adoption', { ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:76 "CN keeps 0.6 (served by Chinese labs; no anchor)"' }),
  one(SE, 'REGION_SCALE', ['CN', 'use'], 0.6, 'x US worker use rate', { ...W, kind: 'unclear', evidence: 'sectors.ts:66-68 "CN and ROW workers use AI at 0.6 × the US rate ... A8 check: ... [P: Anthropic Economic Index, Sep 2025]"; the [P] backs a check, not the 0.6', notes: 'See Q-market-4.' }),
  one(SE, 'REGION_SCALE', ['ROW', 'use'], 0.6, 'x US worker use rate', { ...W, kind: 'unclear', evidence: 'sectors.ts:66-68 "CN and ROW workers use AI at 0.6 × the US rate ... [P: Anthropic Economic Index, Sep 2025]"', notes: 'See Q-market-4.' }),
  one(SE, 'REGION_SCALE', ['CN', 'R'], 0.85, 'x US friction', { ...W, kind: 'designer', evidence: 'sectors.ts:76-77 "`R` scales friction (CN state steering, EU AI Act in ROW) [D]"' }),
  one(SE, 'REGION_SCALE', ['ROW', 'R'], 1.1, 'x US friction', { ...W, kind: 'designer', evidence: 'sectors.ts:76-77 "`R` scales friction (CN state steering, EU AI Act in ROW) [D]"' }),
  one(SE, 'U_BASE', ['US'], 4.3, '% unemployment', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:84 "base unemployment by region (%). US 4.3% [R16 §1A.2]"', source: 'research/16 §1A.2' }),
  one(SE, 'U_BASE', ['CN'], 5.2, '% unemployment', { ...WFX, kind: 'untagged', evidence: 'no tag; sectors.ts:85' }),
  one(SE, 'U_BASE', ['ROW'], 5.5, '% unemployment', { ...WFX, kind: 'untagged', evidence: 'no tag; sectors.ts:85' }),
  ...(['normal', 'ai2027', 'gate'] as const).flatMap((preset) => {
    const v = { normal: [0.4, 1.5, 0.35, 2, 0.5], ai2027: [1.0, 1.0, 0.5, 1, 0.3], gate: [1.5, 0.6, 0.7, 0.25, 0.15] }[preset];
    const meta = { ...W, kind: 'sourced', perPreset: true, source: 'research/16 §4.6', evidence: 'sectors.ts:87 "World-economy presets (research/16 §4.6), hidden per world."' } as const;
    return [
      one(SE, 'ECON_PRESETS', [preset, 'diffMult'], v[0], 'multiplier', meta),
      one(SE, 'ECON_PRESETS', [preset, 'frictionScale'], v[1], 'multiplier', meta),
      one(SE, 'ECON_PRESETS', [preset, 'sigma'], v[2], 'dimensionless', meta),
      one(SE, 'ECON_PRESETS', [preset, 'robotFloorYears'], v[3], 'years', meta),
      one(SE, 'ECON_PRESETS', [preset, 'nu'], v[4], 'dimensionless', meta),
    ];
  }),
  one(SE, 'ECON', ['W0'], 35, 'USD per hour', { ...W, kind: 'designer', evidence: 'sectors.ts:97 "Average US wage per hour W0 ($), V2-SPEC §3.11.3 [D]."' }),
  one(SE, 'ECON', ['hours'], 2000, 'hours per worker-year', { ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:99 "Hours per worker-year."' }),
  one(SE, 'ECON', ['gAug'], 0.3, 'fraction', { ...W, kind: 'sourced', evidence: 'sectors.ts:101 "g_aug: productivity gain on augmented work (field RCT range 0.14–0.4). [R16]"', source: 'research/16', range: { lo: 0.14, hi: 0.4, from: 'sectors.ts:101 "field RCT range 0.14–0.4"' } }),
  one(SE, 'ECON', ['useW'], 0.37, 'fraction of workers', { ...W, kind: 'fitted', evidence: 'sectors.ts:108 "useW [fit to R22 1a]: 37% of US workers in Jul 2025"', fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to research/22 1a (Bick, Blandin & Deming RPS).' }),
  one(SE, 'ECON', ['useH'], 0.115, 'fraction of hours', { ...W, kind: 'fitted', evidence: 'sectors.ts:109-110 "useH [fit to R22 1b–1c]: ≈6% of US work-hours in mid-2026 ... ≈0.15 of a user\'s hours"', fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to research/22 1b-1c.' }),
  one(SE, 'ECON', ['fMid'], 7.35, 'levels', { ...W, kind: 'fitted', evidence: 'sectors.ts:115 "[fit] to the stated anchors: 7.35 / 1.1 → 0.26, 0.76, F_OFFICE 0.59"', fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to research/16 F_SOFT anchors; now sets only the robot-bound PHYS part and the start state.' }),
  one(SE, 'ECON', ['fSpread'], 1.1, 'levels', { ...W, kind: 'fitted', evidence: 'sectors.ts:115 "[fit] to the stated anchors: 7.35 / 1.1"', fit: { targets: [], script: 'unnamed' } }),
  one(SE, 'ECON', ['kSpread'], 0.7, 'dimensionless', { ...W, kind: 'sourced', evidence: 'sectors.ts:120 "Cost gate logistic spread. [R16]"', source: 'research/16' }),
  one(SE, 'ECON', ['attritionPerMonth'], 0.015, 'fraction per month', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:122 "Natural quits ≈ 1.5%/month absorb employment declines before layoffs. [R16]"', source: 'research/16' }),
  one(SE, 'ECON', ['LS0'], 0.56, 'fraction', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:124 "Labor share LS0 (BLS nonfarm business), supervision residual ψ. [R16 §1A.2 step 10]"', source: 'research/16 §1A.2 step 10; BLS nonfarm business' }),
  one(SE, 'ECON', ['psi'], 0.1, 'fraction', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:124 "supervision residual ψ. [R16 §1A.2 step 10]"', source: 'research/16 §1A.2 step 10' }),
  one(SE, 'ECON', ['gini0'], 0.48, 'Gini', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:126 "Income Gini (Census money income). [R16 §4.4]"', source: 'research/16 §4.4; Census money income' }),
  one(SE, 'ECON', ['hireSlope'], 1.2, 'per unit feasibility change', { ...WFX, kind: 'stand-in', evidence: 'sectors.ts:128-129 "R16 writes 1.5 [D, no source]. CAL2-X (decision 6): 1.2, a once-fitted stand-in"; probe scripts/v2/_cal2x/hire.ts', notes: 'Both fitted and stand-in; see Q-market-5.' }),
  one(SE, 'ECON', ['youthTau'], 2, 'years', { ...WFX, kind: 'designer', evidence: 'sectors.ts:134 "Youth (22–25) employment relaxes toward the hire rate with this time constant (years) [D]."' }),
  one(SE, 'ECON', ['youthRel0'], 0.87, 'fraction', { ...WFX, kind: 'sourced', evidence: 'sectors.ts:136 "Canaries: exposed 22–25-year-olds −13% vs counterfactual in 2025 (−19% by Aug 2026). [V, R16 N2a]"', source: 'research/16 N2a (Canaries)' }),
  one(SE, 'ECON', ['youthU0'], 8.0, '% unemployment', { ...WFX, kind: 'designer', evidence: 'sectors.ts:138 "US youth (22–25) unemployment base (%) [D]."' }),
  one(SE, 'ECON', ['firmK'], 19, 'dimensionless', { ...W, kind: 'fitted', evidence: 'sectors.ts:140-143 "CAL2-X refit with bassFit: k 10 → 19 puts the US employment-weighted readout at 19.8% on 3 May 2026 (Census BTOS ...)"', fit: { targets: [], script: 'unnamed' }, notes: 'A readout only; fitted to Census BTOS 19.8% (3 May 2026); sector shape is a stand-in.' }),
  one(SE, 'ECON', ['bassFit'], 0.33, 'multiplier on sector Bass p and q', { ...W, kind: 'fitted', evidence: 'sectors.ts:145-149 "CAL2-X: one factor on every sector\'s Bass p and q ... fitted to the measured firm-adoption growth ... Once-fitted [fit]."', fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to Census BTOS growth x1.42/yr (17.3% Dec 2025 -> 19.8% May 2026).' }),
  one(SE, 'ECON', ['mansfieldA'], 0.53, '1/yr per unit pi', { ...W, kind: 'sourced', evidence: 'sectors.ts:151-153 "CAL3-A: Mansfield\'s profitability slope of the imitation rate, a = 0.53 per year per unit of π (Mansfield 1961 ...) [P]"', source: 'Mansfield 1961 (12 innovations in 4 industries); Mansfield 1965 eq. 14' }),
  one(SE, 'ECON', ['mansfieldPiRef'], 1.65, 'pi (profitability ratio)', { ...W, kind: 'stand-in', evidence: 'sectors.ts:155-156 "Stand-in: the middle of the range in his sample figure (railroads, π 1.3–2.0); no measurement of AI\'s payout ratio exists."', range: { lo: 1.3, hi: 2.0, from: 'sectors.ts:156 "railroads, π 1.3–2.0" (Mansfield sample figure)' } }),
  one(SE, 'PRE_LLM_LEVEL', [], 3, 'levels', { ...W, kind: 'designer', evidence: 'sectors.ts:161 "Pre-LLM reference profile (late 2022) for the hiring baseline ΔF; R16 Agent-0 profile minus ~2 levels [D]."' }),
  one(SE, 'AGENT0_PROFILE', [], [5, 4.5, 5, 4, 5, 5, 4, 5, 1], 'levels', { ...W, kind: 'sourced', evidence: 'sectors.ts:163 "R16 §1 Agent-0 profile (mid 2025), used for start values before the first tick. [R16 table]"', source: 'research/16 §1 (Agent-0 profile table)', notes: 'Array order = CODE, RSCH, REASON, AGENCY, SOCIAL, MEDIA, CYBER, BIO, PHYS.' }),
];

// ---------- src/data/v2/market.ts ----------
const MK = 'src/data/v2/market.ts';
const keyed = (module: string, symbol: string, vals: Record<string, number>, unit: string, base: Meta, per: Record<string, Partial<Param>> = {}): Param[] =>
  Object.entries(vals).map(([k, v]) => one(module, symbol, [k], v, unit, { ...base, ...per[k] }));
const MARKET_BUYERS: Param[] = [
  ...keyed(MK, 'LARGE_SHARE', { SOFT: 0.595, OFFICE: 0.54, FIN: 0.687, LEGAL: 0.192, MEDIA: 0.429, SCI: 0.545, HEALTH: 0.563, EDU: 0.871, GOV: 1.0, MIL: 0.89, MFG: 0.591, LOG: 0.668, ENGY: 0.26, SERV: 0.467 }, 'fraction of private employment',
    { ...W, kind: 'sourced', source: 'research/MARKET-sources.md §1 (Census SUSB 2022, enterprise employment size, released 10 Apr 2025)', evidence: 'market.ts:14 "L_s: US share of private employment in firms with ≥ 500 employees ... [MARKET-sources §1; Census SUSB 2022]"' }, {
      SOFT: { evidence: 'market.ts:19 "[P] blend of NAICS 5112 software publishers 74.2%, 5182 data processing 65.7%, 5415 computer systems design 51.8%."' },
      OFFICE: { evidence: 'market.ts:21 "[P-analogue] the all-industries share (54.1%, rounded 54%)"' },
      FIN: { evidence: 'market.ts:24 "[P] blend of NAICS 52 finance & insurance 72.5% and 5412 accounting 47.6%."' },
      LEGAL: { evidence: 'market.ts:26 "[P] NAICS 5411 legal services 19.2%; in-house legal staff not captured."' },
      MEDIA: { evidence: 'market.ts:28 "[P] blend of 5418 advertising/PR 44.5%, 512 film, 515 broadcasting, 71 arts 36.3%."' },
      SCI: { evidence: 'market.ts:30 "[P] blend of 5417 scientific R&D 69.9% and 5413 architecture/engineering 45.7%."' },
      HEALTH: { evidence: 'market.ts:32 "[P] NAICS 62, private only (general hospitals 95.8%, physician offices 48.1%)."' },
      EDU: { kind: 'unclear', source: undefined, evidence: 'market.ts:34-36 "[P] + designer\'s Education rule (MARKET.md, 2026-11-24): ... L = public share 0.727 [§2 anchor 2b] + 0.273 × private large share 0.527 [§1] = 0.871."', notes: 'Both [P] and a designer rule; see Q-market-6.' },
      GOV: { kind: 'designer', source: undefined, evidence: 'market.ts:38-39 "[D] SUSB excludes government, so there is no value; 1.0 for completeness; unused"', notes: 'Unused (GOV is all public).' },
      MIL: { evidence: 'market.ts:41 "[P-analogue] NAICS 3364 aerospace as the defence-industry proxy ... ~89%. Unused: MIL is all public (p = 1)."', notes: 'Unused (MIL is all public).' },
      MFG: { evidence: 'market.ts:43 "[P] NAICS 31–33 manufacturing 59.1%."' },
      LOG: { evidence: 'market.ts:45 "[P] NAICS 48–49 transport & warehousing 66.8% ..."' },
      ENGY: { evidence: 'market.ts:47 "[P] blend of 22 utilities 81.2%, 23 construction 19.3% (86% of the jobs), 21 mining 52.6%."' },
      SERV: { evidence: 'market.ts:49 "[P] blend of 44–45 retail 65.8%, 72 accommodation & food 37.2%, 81 other services 15.0%."' },
    }),
  ...keyed(MK, 'PUBLIC_SHARE', { SOFT: 0, OFFICE: 0, FIN: 0, LEGAL: 0, MEDIA: 0, SCI: 0, HEALTH: 0.219, EDU: 0, GOV: 1, MIL: 1, MFG: 0, LOG: 0, ENGY: 0, SERV: 0 }, 'fraction of sector employment',
    { ...W, kind: 'designer', source: 'research/MARKET-sources.md §2 ([D on [P]], market.ts:53-54)', evidence: 'market.ts:53-54 "p_s: government-run share ... [D on [P]] ... Sectors without a primary anchor in MARKET-sources §2 are 0."', notes: 'Zero by default where no primary anchor.' }, {
      HEALTH: { kind: 'sourced', source: 'research/MARKET-sources.md §2 anchor 2c (BLS QCEW 2024, NAICS 622)', evidence: 'market.ts:57-58 "[P-analogue] government holds 21.9% of hospital jobs [BLS QCEW 2024, NAICS 622, §2 anchor 2c]"', notes: 'Hospitals stand in for the whole sector.' },
      EDU: { kind: 'designer', evidence: 'market.ts:60-61 "[D] designer\'s Education rule (MARKET.md, 2026-11-24): public schools ... buy like large firms ... so 0"' },
      GOV: { kind: 'sourced', source: 'by definition (government)', evidence: 'market.ts:63 "[P] by definition (government)."' },
      MIL: { kind: 'sourced', source: 'Military OneSource 2024; CRS IF11510, IF10548; MARKET-sources §2 anchors 2e, 2f', evidence: 'market.ts:65-66 "[P] military, DoD civilians and the defence industrial base all buy as vetted buyers"' },
    }),
  one(MK, 'REGULATED_FRACTION', [], [0.15, 0.15, 0.5, 0.25, 0.05, 0.35, 0.5, 0, 0, 0, 0.2, 0.25, 0.5, 0.03], 'fraction of large firms', { ...W, kind: 'designer',
    evidence: 'market.ts:71-72 "r_s: share of the sector\'s large firms that count as vetted buyers ... [D, designer estimate 2026-11-24, on the anchors of MARKET-sources §2 ...]"; each key also tagged [D] (market.ts:76-103)',
    notes: 'Array order = SOFT, OFFICE, FIN, LEGAL, MEDIA, SCI, HEALTH, EDU, GOV, MIL, MFG, LOG, ENGY, SERV. GOV, MIL, EDU are n/a (0).' }),
  one(MK, 'REGION_LARGE_SCALE', ['ROW'], 37.4 / 54.1, 'x US large-firm share', { ...W, kind: 'sourced', source: 'Eurostat sbs_sc_ovw 2022 (60.0M of 160.6M employees in 250+ firms) over Census SUSB 2022 54.1%', evidence: 'market.ts:109-110 "ROW: EU business economy share in 250+ firms 37.4% [P-analogue, Eurostat sbs_sc_ovw 2022 ...] → 37.4 / 54.1 ≈ 0.69"' }),
  one(MK, 'REGION_LARGE_SCALE', ['CN'], 20.6 / 54.1, 'x US large-firm share', { ...W, kind: 'sourced', source: 'NBS China Fourth Economic Census report no. 12 (SMEs 79.4%, end 2018) over Census SUSB 2022 54.1%', evidence: 'market.ts:111-112 "CN: large enterprises ≈ 20.6% of enterprise employment (SMEs 79.4%, end 2018) [P, NBS China Fourth Economic Census ...] → 20.6 / 54.1 ≈ 0.38"' }),
];

// ---------- src/data/v2/tools.ts ----------
const TL = 'src/data/v2/tools.ts';
const toolFam = (path: (string | number)[], unit: string, meta: Partial<Meta> & Pick<Meta, 'kind' | 'evidence'>) => one(TL, 'PRODUCT_TOOLS', ['*', ...path], undefined, unit, { ...W, ...meta });
const TOOLS: Param[] = [
  one(TL, 'AGENT_TASK_HOURS', [], 2, 'hours (measured 50% time horizon)', { ...W, kind: 'sourced', source: 'METR TH1.1 o3 120 min (metr.org/assets/benchmark_results_1_1.yaml); ChatGPT agent (Jul 2025) is o3-class; designer 2026-11-27', evidence: 'tools.ts:31-33 "2 h, the measured horizon of the model its analogue launched on [P]"' }),
  one(TL, 'CERT_DAYS', [], 240, 'days', { ...W, kind: 'sourced', source: 'research/CAL-products-sources.md C1 (OpenAI FedRAMP 20x Moderate 27 Apr 2026, ~8 months after the AI prioritisation opened Aug 2025; fedramp.gov/ai)',
    evidence: 'tools.ts:38-42 "240 [P, CAL-P]: OpenAI\'s ChatGPT Enterprise / API got FedRAMP 20x Moderate on 27 Apr 2026, about 8 months after ... Range 3-24 months"',
    range: { lo: 90, hi: 720, from: 'tools.ts:40 "Range 3-24 months" (read as 30-day months)' } }),
  one(TL, 'CERT_CASH', [], 0.004, 'USD B', { ...W, kind: 'sourced', source: 'GAO-24-106591 (providers\' FedRAMP costs $300,000 to $3.7 million, plus the agency\'s $69,000-400,000); research/CAL-products-sources.md C2',
    evidence: 'tools.ts:44-46 "Certification cost ($B) ... $4M [P, CAL-P]: GAO-24-106591: providers\' FedRAMP costs \'ranged from $300,000 to $3.7 million\' ... (the top of both)"' }),
  one(TL, 'CERT_FRICTION_CUT', [], 0.1, 'R_s friction', { ...W, kind: 'designer', evidence: 'tools.ts:48-49 "Friction cut a certification gives its product\'s buyers in the sector (US): R_s - 0.1 [D] (research/16 §1A.3 ...)"', source: 'research/16 §1A.3' }),
  one(TL, 'ADAPT_EQUIV_DG', [], 0.24, 'OOM', { ...W, kind: 'derived', evidence: 'tools.ts:103 "ADAPT_COVER 0.15 at the reference coverage 0.5 as ΔG: 0.8 × logit(0.575) = 0.242 (see the header)"; the header calls ADAPT_COVER [D stand-in]', notes: 'Rounded from 0.242; ADAPT_COVER 0.15 itself is not a code constant.' }),
  ...grp(TL, 'TOOL_UPKEEP', [], { yr: [0.5, 'x build team-weeks per year'], idle: [0.1, 'fraction of upkeep while built but off'] }, { ...W, kind: 'designer', evidence: 'tools.ts:294-295 "Model v3 C2 [D]: upkeep of a built tool in team-weeks per week: half its build team-weeks a year while in use, a tenth of that while built but off everywhere"' }),
  toolFam(['buildTW'], 'team-weeks', { kind: 'untagged', evidence: 'no tag on most records (tools.ts:110 etc.); defence and agentMode builds are "[D]" (tools.ts:181, 219)', notes: 'Provenance varies per record: see Q-market-7.' }),
  toolFam(['cash'], 'USD B', { kind: 'untagged', evidence: 'no tag on most records (tools.ts:110 etc.); defence and agentMode builds are "[D]" (tools.ts:181, 219)', notes: 'Provenance varies per record: see Q-market-7.' }),
  toolFam(['fx', '*', 'dG'], 'OOM', { kind: 'unclear', evidence: 'tools.ts:111-116 coding SOFT 0.3 "§5 [P], same model ... 0.3 sits inside 0.24–0.46", SCI 0.1 "[D]"; operations 0.3 "capped ... [D]"; backOffice/defence ADAPT_EQUIV_DG "[D]"; per-record comments carry the tag',
    notes: 'Records mix [P] and [D]; see Q-market-7.' }),
  toolFam(['fx', '*', 'tokens'], 'x tokens per work-hour', { kind: 'unclear', evidence: 'tools.ts:111-171 per-record comments: "Tokens ×1.5 [D]" (backOffice), "Tokens ×2 [D]" (clinical), "Tokens ×3 [D]" (operations); coding ×2 "kept"; research ×3 "kept"',
    notes: 'Records mix designer and untagged; see Q-market-7.' }),
  toolFam(['fx', '*', 'share'], 'fraction of sector work / chat appeal', { kind: 'unclear', evidence: 'tools.ts:195-200,231-232,263,280 creative 0.15 "[D stand-in]", 0.053 "[P growth, D attribution]"; computerUse 0.15 "[D stand-in ...]"; voiceVision 0.02 "[P base, D attribution]"; companion 0.025 "[P]"',
    notes: 'Records mix stand-in, sourced and designer; see Q-market-7.' }),
  toolFam(['fx', '*', 'mult'], 'x horizon', { kind: 'stand-in', evidence: 'tools.ts:246 "Today\'s Memory, kept: horizon ×1.3 [D stand-in, no measurement; research/CAL-products-sources.md T3]"', notes: 'Only the Memory tool has a horizon effect.' }),
  toolFam(['afford'], 'affordances (add)', { kind: 'unclear', evidence: 'tools.ts:218 agentMode "afford +0.3 [D]: the deleted Agents channel\'s CHANNEL_AFFORD 0.8 over API\'s 0.5"; computerUse "afford +0.25" (tools.ts:232) has no tag', notes: 'Two records; see Q-market-7.' }),
  toolFam(['hazard', 'SYC'], 'x sycophancy incident hazard', { kind: 'stand-in', evidence: 'tools.ts:281,284 "sycophancy ×1.5 [D stand-in: longer personal conversations]"', notes: 'Companion only.' }),
];

// ---------- src/data/v2/teams.ts and starts.ts ----------
const TM = 'src/data/v2/teams.ts';
const R = { area: 'research', layer: 'world' } as const;
const TEAMS: Param[] = [
  one(TM, 'TEAM_SIZE', [], [100, 50, 20], 'people per team (eng, re, sci)', { ...R, kind: 'designer', evidence: 'no tag; teams.ts:6-7 "Fixed team sizes (STRUCTURE §4.1 \'big, fixed sizes\')"; the file header "[D] unless marked [Design]" is a legend', notes: 'Array order = eng, re, sci. L15: was 150 / 100 / 40; the labour model keeps those as reference units (ENG_UNIT_HEADS, RE_UNIT_HEADS, CAPACITY_UNIT).', source: 'design/bal/LABOUR-SOURCES.md decision 3 (was STRUCTURE §4.1, about 150 / 100 / 40)' }),
  one(TM, 'REF_ROLE_SHARE', [], [0.3, 0.55, 0.15], 'fraction (eng, re, sci)', { ...R, kind: 'sourced', source: 'research/19 §1.1', evidence: 'teams.ts:9 "Reference split of capabilities staff (research/19 §1.1)."', notes: 'Array order = eng, re, sci.' }),
  one(TM, 'SAF_ROLE_SHARE', [], [90 / 140, 50 / 140], 'fraction (re, sci)', { ...R, kind: 'designer', evidence: 'teams.ts:12 "Reference split of safety staff: 90 research engineers + 50 scientists of 140 (research/19 §1.1) [Design]."', notes: 'Pointer to research/19 and [Design] together: see Q-market-1.', source: 'research/19 §1.1' }),
  one(TM, 'MOVE_SAFETY_MORALE', [], -5, 'morale points', { ...R, kind: 'designer', evidence: 'teams.ts:43 "Moving a research-engineering team from safety to capabilities costs safety morale (STRUCTURE §4.1) [Design]."', source: 'design/STRUCTURE.md §4.1' }),
  one(TM, 'START_TEAMS', ['classic'], [6, 21, 14, 1, 1], 'teams (eng, re.cap, sci.cap, re.saf, sci.saf)', { ...R, actor: 'player', kind: 'untagged', evidence: 'no tag; teams.ts:60-62 "Start teams (STRUCTURE §4.1 \'Frontier leader\': 4 · 11 + 1 · 8 + 2)."', notes: 'Baseline id, not a world preset. Array order = eng, re.cap, sci.cap, re.saf, sci.saf. L15: the sourced start (AIFM L_HUMAN 1,640 = 579 : 1,061 : 289, whole teams of 100 / 50 / 20).' }),
  one(TM, 'START_TEAMS', ['reality'], [6, 21, 14, 1, 1], 'teams (eng, re.cap, sci.cap, re.saf, sci.saf)', { ...R, actor: 'player', kind: 'untagged', evidence: 'no tag; teams.ts:60-63 "Reality scales the 2,450 capabilities staff."', notes: 'Array order = eng, re.cap, sci.cap, re.saf, sci.saf. L15: the same start as classic.' }),
];

const ST = 'src/data/v2/starts.ts';
const C = { area: 'core', layer: 'world', actor: 'player' } as const;
const startFam = (path: (string | number)[], unit: string | undefined, meta: Partial<Meta> & Pick<Meta, 'kind' | 'evidence'>) => one(ST, 'STARTS', ['*', ...path], undefined, unit, { ...C, ...meta });
const START_NOTE = 'Four records (spinout, challenger, bigtech, leader); the leader row is display only, its live values sit in teams.ts/finance/sites.';
const STARTS_P: Param[] = [
  startFam(['difficulty'], 'label (Easy/Medium/Hard/Impossible)', { kind: 'untagged',
    evidence: 'no tag; starts.ts:20-23 "Setup label ..., set from bot games (PROGRESS R9; bots.ts --start, 40 seeds × 5 bots): best bot\'s win rate ≥ 30% Easy, 10–30% Medium, 1–10% Hard, < 1% Impossible. R9 data: leader 48% (mixed), challenger 5% (race), big tech 0/200, spinout 0/200."',
    notes: 'A string label; the win-rate thresholds (30/10/1 %) are only in this comment, not code. See Q-market-8.' }),
  startFam(['teams'], 'teams per key (eng, re.cap, sci.cap, re.saf, sci.saf)', { kind: 'untagged', evidence: 'no tag; starts.ts:30 "Teams by key (STRUCTURE §4.1 start table; fixed sizes 150 / 100 / 40)"; challenger eng 4 is "[D]" (starts.ts:91)', notes: START_NOTE }),
  startFam(['cash'], 'USD B', { kind: 'untagged', evidence: 'no tag; starts.ts:48-49 "Cash on hand ($B)"', notes: START_NOTE }),
  startFam(['revenueRun'], 'USD B per year', { kind: 'untagged', evidence: 'no tag; starts.ts:48-50 "revenue run-rate ($B/yr)"', notes: START_NOTE }),
  startFam(['revenueHistory'], 'USD B per year (oldest first)', { kind: 'untagged', evidence: 'no tag; starts.ts:48-51 "the last four quarterly run-rates (oldest first)"', notes: START_NOTE }),
  startFam(['ownership', 'founder'], 'fraction', { kind: 'untagged', evidence: 'no tag; starts.ts:52-53 "Ownership split (founder, financial, strategic partner)."', notes: START_NOTE }),
  startFam(['ownership', 'fin'], 'fraction', { kind: 'untagged', evidence: 'no tag; starts.ts:52-53', notes: START_NOTE }),
  startFam(['owned'], 'H100e', { kind: 'untagged', evidence: 'no tag; starts.ts:54-55 "Compute owned (installed in live sites) ... H100e."', notes: START_NOTE }),
  startFam(['rented'], 'H100e', { kind: 'untagged', evidence: 'no tag; starts.ts:54-56 "rented (cloud contract), H100e."', notes: START_NOTE }),
  startFam(['lagMonths'], 'months', { kind: 'sourced', source: 'research/18 §0.1', evidence: 'starts.ts:59 "Months behind the leader on the capabilities index (research/18 §0.1): the start model\'s lag."', notes: START_NOTE }),
  startFam(['mods', 'talentPull'], 'talent pull', { kind: 'sourced', source: 'research/18 §6', evidence: 'starts.ts:63 "Modifiers (research/18 §6). talentPull: the anchor talent pull drifts to (leader 10)."', notes: START_NOTE }),
  startFam(['products', '*', 'servingShare'], 'fraction of serving pool', { kind: 'untagged', evidence: 'no tag; starts.ts:14 "channel, share of the serving pool"', notes: START_NOTE }),
  ...grp(ST, 'PARENT_BUDGET', [], { year0: [16, 'USD B in year 1'], fastGrowth: [1.75, 'x per year'], fastYears: [3, 'years'], slowGrowth: [1.3, 'x per year'] }, { area: 'finance', layer: 'world', actor: 'player', kind: 'designer',
    evidence: 'starts.ts:160-163 "Big-tech parent budget ($B per game year ...): $16B in year one (the leader\'s 2025 compute spend in the AI 2027 compute forecast), growing ... Alphabet 52.5 → 91.4 → ~180 in 2024–26 (≈ ×1.75/yr) for three years, then ×1.3/yr ... [D]."',
    notes: 'Tagged [D] though it cites the AI 2027 compute forecast and Alphabet capex.' }),
];

// ---------- src/data/v2/deals.ts ----------
const DL = 'src/data/v2/deals.ts';
const F = { area: 'finance', layer: 'world' } as const;
const R15 = (s: string) => `research/15 ${s}`;
const DEALS: Param[] = [
  // PARTNER_TERMS (deals.ts:41-69)
  one(DL, 'PARTNER_TERMS', ['hyperscaler', 'equityShareOfV'], 0.03, 'fraction of valuation', { ...F, kind: 'untagged', evidence: 'no tag; deals.ts:43-44 "Equity E = $5–15B per tranche at today\'s V" (3% is not itself tagged)' }),
  ...grp(DL, 'PARTNER_TERMS', ['hyperscaler'], { trancheMin: [5, 'USD B'], trancheMax: [15, 'USD B'], tranches: [3, 'tranches'] }, { ...F, kind: 'sourced', source: R15('§1.7'), evidence: 'deals.ts:43-44 "Equity E = $5–15B per tranche at today\'s V, 3 tranches (one now, two on GW conditions) [R15 §1.7]"' }),
  one(DL, 'PARTNER_TERMS', ['hyperscaler', 'stakeCap'], 0.15, 'fraction of company', { ...F, kind: 'sourced', source: 'research/21 B2 (CMA/FTC: Google ≤ 14% of Anthropic; R15 12–15%)', evidence: 'deals.ts:44-46 "non-voting and capped at 15% of the company per hyperscaler ... (CMA/FTC: Google ≤ 14% of Anthropic, R15 12–15%) [R21 B2]"' }),
  one(DL, 'PARTNER_TERMS', ['hyperscaler', 'commitMult'], 4, 'x equity', { ...F, kind: 'sourced', source: R15('(C = 4–12 × E over 5–10 y)'), range: { lo: 4, hi: 12, from: 'deals.ts:46 "C = 4–12 × E over 5–10 y [R15]"' }, evidence: 'deals.ts:46 "Commitment: cloud capacity worth 4 × E over 6 years at today\'s price (C = 4–12 × E over 5–10 y [R15])"' }),
  one(DL, 'PARTNER_TERMS', ['hyperscaler', 'years'], 6, 'years', { ...F, kind: 'sourced', source: R15('(C = 4–12 × E over 5–10 y)'), range: { lo: 5, hi: 10, from: 'deals.ts:46 "over 5–10 y [R15]"' }, evidence: 'deals.ts:46 "over 6 years ... (C = 4–12 × E over 5–10 y [R15])"' }),
  one(DL, 'PARTNER_TERMS', ['hyperscaler', 'discount'], 0.1, 'fraction', { ...F, kind: 'designer', evidence: 'deals.ts:47 "the partner takes 10% off for the commitment [D]"' }),
  one(DL, 'PARTNER_TERMS', ['hyperscaler', 'revenueShare'], 0.08, 'fraction of revenue', { ...F, kind: 'designer', evidence: 'deals.ts:47-48 "Revenue share 8% while it runs (all three cloud partnerships carry one [R21 B4]; size [D])"', notes: 'Existence of a share is sourced (R21 B4); the size is [D].' }),
  one(DL, 'PARTNER_TERMS', ['asic', 'costMult'], 0.45, 'x H100e list path', { ...F, kind: 'sourced', source: R15('Design (TPU v6e 5.9, Trainium2 4.4 perf/$, Epoch Q4 2025)'), evidence: 'deals.ts:50-52 "1 GW over 8 quarters at 45% of the H100e list path (perf/$ 2–5× an H100: TPU v6e 5.9, Trainium2 4.4, Epoch Q4 2025 [R15])"' }),
  ...grp(DL, 'PARTNER_TERMS', ['asic'], { quarters: [8, 'quarters'], gw: [1.0, 'GW'] }, { ...F, kind: 'untagged', evidence: 'no tag; deals.ts:50 "1 GW over 8 quarters"' }),
  ...grp(DL, 'PARTNER_TERMS', ['asic'], { migrationDays: [230, 'days'], researchMult: [0.85, 'x research'] }, { ...F, kind: 'designer', source: R15('Design'), evidence: 'deals.ts:52-53 "a separate supply pool ...; migration −15% research for ~2.5 quarters [R15 Design]"' }),
  one(DL, 'PARTNER_TERMS', ['chipVendor', 'perGW'], 10, 'USD B equity per GW', { ...F, kind: 'sourced', source: R15('§1.7 (Nvidia-OpenAI; AMD warrants vest by GW)'), evidence: 'deals.ts:55-56 "Chip vendor: $10B of equity per GW you deploy (Nvidia–OpenAI; AMD warrants vest by GW) [R15 §1.7]"' }),
  ...grp(DL, 'PARTNER_TERMS', ['chipVendor'], { gw: [2, 'GW'], quarters: [8, 'quarters'], discount: [0.05, 'fraction'] }, { ...F, kind: 'designer', evidence: 'deals.ts:56-58 "you buy 2 GW of its chips over 8 quarters at the path less the firm discount and 5% vendor discount [D]"' }),
  one(DL, 'PARTNER_TERMS', ['chipVendor', 'deadlineQ'], 12, 'quarters', { ...F, kind: 'untagged', evidence: 'no tag; deals.ts:58 "tranches by GW online within 12 quarters"' }),
  ...grp(DL, 'PARTNER_TERMS', ['sovereign'], { equityShareOfV: [0.025, 'fraction of valuation'], min: [5, 'USD B'], max: [25, 'USD B'] }, { ...F, kind: 'sourced', source: R15('(MGX, QIA, GIC in Stargate / OpenAI / Anthropic G / xAI E)'), evidence: 'deals.ts:60-61 "a passive cheque of 2.5% of V ($5–25B) (MGX, QIA, GIC in Stargate / OpenAI / Anthropic G / xAI E) [R15]"' }),
  ...grp(DL, 'PARTNER_TERMS', ['sovereign'], { scrutiny: [5, 'points'], congress: [-5, 'trust points'], securityDemand: [3, 'points'] }, { ...F, kind: 'designer', evidence: 'deals.ts:61-62 "political cost kept from v2: scrutiny +5, Congress trust −5, security demand +3 [D]"' }),
  ...grp(DL, 'PARTNER_TERMS', ['rescue'], { stake: [0.3, 'fraction'], minCash: [20, 'USD B'], maxShareOfV: [0.15, 'fraction of valuation'], seats: [2, 'board votes'], years: [6, 'years'] }, { ...F, kind: 'designer', evidence: 'deals.ts:64-67 "Rescue (distress only, spec §6.2): cash ≈ 2 quarters of burn, at least $20B, at most 15% of V; ... topped up to 30%, ... two votes ... 6 years like a hyperscaler deal [D]"' }),
  ...grp(DL, 'PARTNER_TERMS', ['strings'], { maxPartners: [3, 'partners'], exclusiveBump: [0.25, 'fraction of equity'], ipBump: [0.2, 'fraction of equity'], ipCloseYr: [0.1, 'fraction of lead per year'] }, { ...F, kind: 'designer',
    evidence: 'deals.ts:69-74 "at most 3 partners at once ... [D]. Optional strings for more money [D]: exclusivity ... +25% ...; IP access ... +20% ... closes ~10% a year of your capability lead ... [R21 B4]"', notes: 'ipCloseYr: the [R21 B4] cite follows the FTC bridge quote, not the 10%; see Q-market-10.' }),
  // DEBT_TERMS (deals.ts:74-82)
  one(DL, 'DEBT_TERMS', ['revolver', 'spreadBp'], 200, 'bp over SOFR', { ...F, kind: 'designer', source: R15('Design (SOFR+150–250)'), evidence: 'deals.ts:77 "revolver ... // SOFR+150–250 [R15 Design]"' }),
  one(DL, 'DEBT_TERMS', ['gpuTerm', 'spreadBp'], 475, 'bp over SOFR', { ...F, kind: 'sourced', source: R15('(CoreWeave DDTL SOFR+400–550)'), evidence: 'deals.ts:78 "gpuTerm ... // CoreWeave DDTL SOFR+400–550 [R15]"' }),
  one(DL, 'DEBT_TERMS', ['bond', 'spreadBp'], 150, 'bp over y10', { ...F, kind: 'sourced', source: R15('(Oracle 4.45–6.85%)'), evidence: 'deals.ts:79 "bond ... // Oracle 4.45–6.85% [R15]"' }),
  one(DL, 'DEBT_TERMS', ['assumed', 'spreadBp'], 450, 'bp over y10', { ...F, kind: 'designer', evidence: 'deals.ts:80-82 "FIN3c (spec §9): a bought lab\'s debt; its lenders re-price it ... and it runs 3 more years [D]."' }),
  one(DL, 'DEBT_TERMS', ['assumed', 'years'], 3, 'years', { ...F, kind: 'designer', evidence: 'deals.ts:80-82 "it runs 3 more years [D]"' }),
  ...(['revolver', 'gpuTerm', 'bond'] as const).map((k, i) => one(DL, 'DEBT_TERMS', [k, 'years'], [5, 4, 10][i], 'years', { ...F, kind: 'untagged', evidence: `no tag; deals.ts:${77 + i} (years field)` })),
  one(DL, 'RATING_SPREAD_BP', [], [125, 450, 750, 1200], 'bp over y10', { ...F, kind: 'designer', evidence: 'deals.ts:83 "Bond spread over y10 by rating (bp) [R15]; BB/B are SOFR-based in R15, mapped onto y10 here [D]."', notes: 'Array order = BBB, BB, B, closed. See Q-market-9.', source: 'research/15 [R15]; mapping to rating [D]' }),
  one(DL, 'REVOLVER_SPREAD_BP', [], [150, 200, 250, 350], 'bp over SOFR', { ...F, kind: 'designer', evidence: 'deals.ts:85 "Credit-line spread over SOFR by rating (bp): SOFR + 150–250 [R15 Design], wider when closed [D]."', notes: 'Array order = BBB, BB, B, closed. See Q-market-9.', source: 'research/15 [R15]; mapping to rating [D]' }),
  one(DL, 'CHIP_LOAN_SPREAD_BP', [], [400, 475, 550, 550], 'bp over SOFR', { ...F, kind: 'designer', evidence: 'deals.ts:87 "Chip-backed loan spread over SOFR by rating (bp): CoreWeave DDTL SOFR + 400, then + 550 [R15]; mapped by rating [D]."', notes: 'Array order = BBB, BB, B, closed. See Q-market-9.', source: 'research/15 [R15]; mapping to rating [D]' }),
  ...grp(DL, 'DEBT_SIZING', [], { lineShareOfV: [0.03, 'fraction of valuation'], lineCap: [15, 'USD B'] }, { ...F, kind: 'fitted', evidence: 'deals.ts:89-90 "Credit line ≈ 2–4% of valuation, cap $15B [fit: OpenAI $4B at $157B, Anthropic $15B at ~$380B+]"', fit: { targets: [], script: 'unnamed' }, notes: 'Fitted to OpenAI $4B at $157B and Anthropic $15B at ~$380B+.' }),
  one(DL, 'DEBT_SIZING', ['lineLiquidity'], 1 / 3, 'fraction of line', { ...F, kind: 'sourced', source: R15('(Anthropic $5B on $15B)'), evidence: 'deals.ts:90-91 "covenant: cash ≥ ⅓ of the line at quarter ends while drawn (Anthropic $5B on $15B [R15])"' }),
  one(DL, 'DEBT_SIZING', ['chipLTV'], 0.6, 'fraction of chip collateral', { ...F, kind: 'untagged', evidence: 'no tag; deals.ts:91-92 "Chip loan ≤ 60% of chip collateral"' }),
  one(DL, 'DEBT_SIZING', ['chipHaircut'], 0.7, 'x list price (used hardware)', { ...F, kind: 'designer', evidence: 'deals.ts:92-93 "installed and stocked chips at 70% of today\'s list price for used hardware [D]"' }),
  one(DL, 'DEBT_SIZING', ['chipSweep'], 1.2, 'collateral / loan', { ...F, kind: 'sourced', source: 'research/15', evidence: 'deals.ts:93 "cash sweep below 1.2× [R15]"' }),
  one(DL, 'DEBT_SIZING', ['bondOcfMult'], 3, 'x trailing operating cash flow', { ...F, kind: 'designer', evidence: 'deals.ts:93-94 "Bonds ≤ 3× trailing operating cash flow, only while it is positive [D]"' }),
  one(DL, 'CAPEX_LEASE', ['rate'], [0.07, 0.09, 0.12], 'fraction per year (BBB, BB, B)', { ...F, kind: 'designer', evidence: 'deals.ts:96-97 "r by rating (BBB 7% · BB 9% · B 12% [D]; none below B)"' }),
  one(DL, 'CAPEX_LEASE', ['years'], [15, 5], 'years (site, chips)', { ...F, kind: 'designer', evidence: 'deals.ts:97 "n = 15 y sites, 5 y chips [D]"' }),
  one(DL, 'CAPEX_LEASE', ['siteShare'], 0.8, 'fraction of capex', { ...F, kind: 'sourced', source: R15('(Meta–Blue Owl Hyperion 80/20)'), evidence: 'deals.ts:97-98 "A site lease funds 80% of capex (Meta–Blue Owl Hyperion 80/20 [R15])"' }),
  one(DL, 'CAPEX_LEASE', ['rvgShare'], 0.5, 'fraction of unamortised balance', { ...F, kind: 'designer', evidence: 'deals.ts:99-100 "Residual-value guarantee: 50% of the unamortised balance if you walk away [D]"' }),
  one(DL, 'CAPEX_LEASE', ['guaranteePremium'], 0.03, 'fraction per year (rate add-on)', { ...F, kind: 'designer', evidence: 'deals.ts:100-101 "at the B rate + 3 points [D]"' }),
  ...grp(DL, 'FIRM_TERMS', [], { discount2y: [0.05, 'fraction'], discount4y: [0.1, 'fraction'] }, { ...F, kind: 'designer', evidence: 'deals.ts:102-103 "5% for ≥ 2 years, 10% for ≥ 4 years [D]"' }),
  ...grp(DL, 'FIRM_TERMS', [], { cancellableMult: [1.15, 'x spot-indexed'], noticeQ: [1, 'quarters'] }, { ...F, kind: 'untagged', evidence: 'no tag; deals.ts:103 "Cancellable cloud = spot-indexed × 1.15 with 1 quarter\'s notice (kept)."' }),
  ...grp(DL, 'COMMUNITY', [], { upfront: [0.03, 'fraction of site capex'], blockMult: [0.5, 'x block odds'] }, { area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; deals.ts:106-107 "Upfront ≈ 3% of site capex halves the block odds (kept)."' }),
  ...grp(DL, 'COMMUNITY', [], { reactive: [0.15, 'fraction of capex'], reactiveDelayQ: [2, 'quarters'], unblockBase: [0.85, 'probability'], unblockPerAnti: [0.5, 'per unit local opposition'], unblockMin: [0.3, 'probability'] }, { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:107-109 "After a block (E27): ≈ 15% of capex and a 2-quarter permit delay; it unblocks with odds 0.85 − 0.5 × local opposition ..., at least 0.3 [D]."' }),
  // Sites and compute market
  one(DL, 'FACILITY_PER_GW', [], 10, 'USD B per GW facility', { area: 'market', layer: 'world', kind: 'sourced', source: R15('(Epoch, 14 May 2026)'), evidence: 'deals.ts:124 "Facility $11.4B/GW IT ≈ $10B/GW facility ... (Epoch, 14 May 2026) [R15]."' }),
  one(DL, 'NETWORK_PER_GW', [], 4, 'USD B per GW facility', { area: 'market', layer: 'world', kind: 'sourced', source: R15('(Epoch, 14 May 2026)'), evidence: 'deals.ts:124 "network $4.9B/GW IT ≈ $4B/GW facility (Epoch, 14 May 2026) [R15]."' }),
  ...(['permitQ', 'overlapQ', 'maxMW', 'capexPerGW', 'powerCostMult'] as const).map((f) => one(DL, 'SITE_PATHS', ['*', f], undefined, { permitQ: 'quarters', overlapQ: 'quarters', maxMW: 'MW', capexPerGW: 'USD B per GW facility', powerCostMult: 'x grid power cost' }[f], { area: 'market', layer: 'world', kind: 'sourced', source: R15('§1.3'),
    evidence: 'deals.ts:112 "Site power paths (R15 §1.3). Lead times in quarters; capex $B per GW of facility power."; gas/grid lines also cite [R15] (deals.ts:130,132); records carry no per-record source', notes: 'Field family over lease, brownfield, gas, grid, nuclear; capexPerGW is derived from FACILITY_PER_GW + NETWORK_PER_GW plus a per-path add.' })),
  one(DL, 'SITE_PATHS', ['*', 'powerQ'], undefined, 'quarters [lo, mode, hi]', { area: 'market', layer: 'world', kind: 'sourced', source: R15('§1.3'), evidence: 'deals.ts:112 "Site power paths (R15 §1.3)"; gas "6–12 q ... [R15]", grid "12–24 q (mode 16; LBNL median 61 months request-to-operation) [R15]"', notes: 'Field family; each record is a [lo, mode, hi] triple.' }),
  one(DL, 'SITE_TIERS', ['*', 'mw'], undefined, 'MW', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:140-142 "Data-centre sizes offered by the build card. Hall ≈ one ~100 MW AI hall ... multi-GW ≈ 5 GW announced campuses (Meta Hyperion) [D]."' }),
  one(DL, 'CHIP_TIERS', [], [100e3, 250e3, 500e3, 1e6, 2.5e6], 'H100e', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:148 "Fixed chip order and cloud sizes, H100e [D]."' }),
  one(DL, 'BUILD_Q', ['normal'], 8, 'quarters', { area: 'market', layer: 'world', kind: 'sourced', source: R15('(Epoch median ≈ 2 y)'), evidence: 'deals.ts:149-150 "Construction quarters: default 8 (Epoch median ≈ 2 y), crash 4 at +35% capex (xAI Colossus 2) [R15]."' }),
  one(DL, 'BUILD_Q', ['crash'], 4, 'quarters', { area: 'market', layer: 'world', kind: 'sourced', source: R15('(xAI Colossus 2)'), evidence: 'deals.ts:149-150 "crash 4 at +35% capex (xAI Colossus 2) [R15]"' }),
  one(DL, 'BUILD_Q', ['crashCapexMult'], 1.35, 'x capex', { area: 'market', layer: 'world', kind: 'sourced', source: R15('(xAI Colossus 2)'), evidence: 'deals.ts:149-150 "crash 4 at +35% capex (xAI Colossus 2) [R15]"' }),
  ...grp(DL, 'BUILD_Q', [], { communityCapexMult: [1.03, 'x capex'], leaseLo: [1, 'quarters'], leaseHi: [3, 'quarters'] }, { area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; deals.ts:151' }),
  one(DL, 'BUILD_Q', ['upfront'], 0.05, 'fraction of capex', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:150-151 "5% of capex is paid when a site starts ... (kept; named in FIN4r) [D]"' }),
  one(DL, 'LEASE', ['perGWYear'], 1.2, 'USD B per GW-year', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:152 "Lease ≈ 12%/yr of $10B per GW facility [R15]"' }),
  one(DL, 'LEASE', ['years'], 5, 'years', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:152 "5-year non-cancellable term [D]"' }),
  ...grp(DL, 'LEASE', [], { poolGWPerQ: [0.6, 'GW per quarter'], poolGrowth: [1.4, 'x per year'] }, { area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; deals.ts:153' }),
  one(DL, 'POWER_PRICE', [], 0.083, 'USD per kWh', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15 (8.3 cents grid tariff)', evidence: 'deals.ts:155 "Power price $/kWh (8.3¢ grid tariff, R15)"' }),
  one(DL, 'OM_RATE', [], 0.03, 'fraction of capex per year', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:155 "O&M 3% of capex per year [R15]"' }),
  one(DL, 'TRANSFORMER', ['depositShare'], 0.2, 'fraction', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15 (120–128 week lead)', evidence: 'deals.ts:158 "Transformers: 8–10 q lead (120–128 weeks); pre-order 20% deposit [R15]"' }),
  one(DL, 'TRANSFORMER', ['costPerGW'], 0.25, 'USD B per GW', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:158 "$0.25B per GW [D]"' }),
  ...(['L', 'g0', 'beta', 'gmin', 'gmax'] as const).map((f) => one(DL, 'COMPONENTS', ['*', f], undefined, { L: 'quarters', g0: 'growth per quarter', beta: 'elasticity', gmin: 'growth floor', gmax: 'growth cap' }[f], { area: 'market', layer: 'world', kind: 'sourced', source: R15('§1.2'), evidence: 'deals.ts:161 "Supplier components (R15 §1.2). L = quarters from decision to output."; records (pkg, hbm, wafer) carry no per-record source' })),
  one(DL, 'MARKET', ['costDeclineQ'], 0.92, 'x per quarter', { area: 'market', layer: 'world', kind: 'sourced', source: R15('(perf/$ +40%/yr; Epoch +49%/yr)'), evidence: 'deals.ts:167 "c_t falls 8%/q (perf/$ +40%/yr; Epoch +49%/yr) [R15]"' }),
  ...grp(DL, 'MARKET', [], { premiumLo: [-0.25, 'premium'], premiumHi: [1.5, 'premium'] }, { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:168 "π clamp [R15]"' }),
  one(DL, 'MARKET', ['spotElasticity'], 0.8, 'elasticity', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:169 "r = r_base·(D/S)^0.8 [R15]"' }),
  one(DL, 'MARKET', ['cloudMult'], 1.6, 'x owned TCO', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:170 "cloud / rental = 1.6× owned TCO [R15]"' }),
  ...grp(DL, 'MARKET', [], { chipLifeY: [4, 'years'], facilityLifeY: [14, 'years'], wacc: [0.08, 'fraction per year'] }, { area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; deals.ts:171' }),
  one(DL, 'MARKET', ['networkShare'], 0.23, 'fraction of GW-IT cost', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15 (Epoch: network $4.9B vs servers $21.2B per GW IT)', evidence: 'deals.ts:172 "network $4.9B vs servers $21.2B per GW IT (Epoch) [R15]"' }),
  ...grp(DL, 'MARKET', [], { nonTWPremium: [1.3, 'x'], spotPremiumShare: [0.5, 'fraction'] }, { area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; deals.ts:173' }),
  one(DL, 'MARKET', ['premiumReversionQ'], 0.75, 'x per quarter', { area: 'market', layer: 'world', kind: 'sourced', source: R15('§1.2'), evidence: 'deals.ts:174-175 "at D/S = 1 the premium update π\' = π − 0.25π decays by 0.75 a quarter [R15 §1.2]"' }),
  one(DL, 'MARKET', ['inventoryDecayQ'], 0.06, 'fraction per quarter', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:176 "idle chips lose 6%/q [R15]"' }),
  one(DL, 'MARKET', ['rationW'], [0.5, 0.5, 0.5, 0.3], 'rationing weight (firm, prepay, strategic, track)', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:177 "rationW ... // firm = take-or-pay order (was: LTA ≥ 4 q old) [R15]"', notes: 'Array order = firm, prepay, strategic, track.' }),
  one(DL, 'MARKET', ['exoWeight'], 1.6, 'x', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:178 "hyperscalers: LTAs + prepay + track record [D]"' }),
  one(DL, 'MARKET', ['spotRentalPoolShare'], 0.1, 'fraction of rental pool', { area: 'market', layer: 'world', kind: 'sourced', source: 'research/15', evidence: 'deals.ts:179 "spot rental ≤ 10% of the rental pool [R15]"' }),
  one(DL, 'MARKET', ['rentalPoolShare'], 0.15, 'fraction of global stock', { area: 'market', layer: 'world', kind: 'designer', evidence: 'deals.ts:180 "rental pool = 15% of global stock [D]"' }),
  ...(['xCN', 'perf'] as const).map((f) => one(DL, 'EXPORT_POLICY', ['*', f], undefined, f === 'xCN' ? "China's share of global supply" : 'performance factor', { area: 'market', layer: 'world', kind: 'sourced', source: R15('§1.2'), evidence: 'deals.ts:183 "Export-control states (R15 §1.2): China\'s share of global supply and the performance factor."', notes: 'Field family over strict, caseByCase, open.' })),
  one(DL, 'GOV_FACTOR', [], [0.6, 0.9, 1.0, 1.1, 0], 'investor attractiveness multiplier', { ...F, kind: 'sourced', source: R15('§1.6'), evidence: 'deals.ts:190 "Governance attractiveness to investors (R15 §1.6). A division (parent) takes no outside equity (R9)."', notes: 'Array order = legacyNonprofit, nonprofitPBC, pbcTrust, founder, parent.' }),
];

// ---------- src/engine/v2/production/* ----------
const PB = 'src/engine/v2/production/believed.ts';
const PD = 'src/engine/v2/production/diffusion.ts';
const PC = 'src/engine/v2/production/ces.ts';
const PP = 'src/engine/v2/production/production.ts';
const RS = { area: 'research', layer: 'world' } as const;
const PRODUCTION: Param[] = [
  one(PB, 'LA_PRIOR_P10', [], 2, 'dimensionless (infinite-labour asymptote)', { ...RS, kind: 'sourced', source: 'research/13 §1.4 (AIFM inf_labor_asymptote prior: 1 + LN, 80% interval [1, 200])', evidence: 'believed.ts:14 "AIFM inf_labor_asymptote prior: 1 + LN with 80% interval [1, 200] (research/13 §1.4 [C])."' }),
  one(PB, 'LA_PRIOR_P90', [], 201, 'dimensionless (infinite-labour asymptote)', { ...RS, kind: 'sourced', source: 'research/13 §1.4 (AIFM inf_labor_asymptote prior: 1 + LN, 80% interval [1, 200])', evidence: 'believed.ts:14 "AIFM inf_labor_asymptote prior: 1 + LN with 80% interval [1, 200] (research/13 §1.4 [C])."' }),
  inline('mkt.ces.Z999', PC, 'const Z999 = 3.090232306167813', 3.090232306167813, 'z-score', { ...RS, kind: 'sourced', source: 'AIFM TOP_RESEARCHER_SD (taste_distribution.py); research/13 §2.4', evidence: 'ces.ts:60 "99.9th percentile z (AIFM TOP_RESEARCHER_SD)"' }),
  one(PD, 'DISTILL_FULL_TOKENS', [], 1e11, 'tokens', { ...RS, kind: 'sourced', source: 'research/RD-X04r D4 (MiniMax campaign ≈ 13M exchanges ≈ 100B tokens; IFP S ≈ 0.5)', evidence: 'diffusion.ts:62-63 "[P-r, research/RD-X04r D4: MiniMax\'s campaign ≈ 13M exchanges ≈ 100B tokens, the scale behind IFP\'s S ≈ 0.5]"' }),
  one(PD, 'DISTILL_HARVEST_SHARE', [], 0.0015, 'fraction of anonymous usage', { ...RS, kind: 'stand-in', range: { lo: 3e-4, hi: 7e-3, from: 'diffusion.ts:66-69 "inside it (3e-4–7e-3)"' },
    evidence: 'diffusion.ts:65 "[D stand-in, CAL-P: no lab publishes the traffic its campaigns hid in. ... CAL2-X (decision 15): 0.01 sat above the top of that range; 0.0015, inside it"', notes: 'Chosen inside a bracket from two data points (research/CAL-products-sources.md D1).' }),
  one(PD, 'DISTILL_HARVEST_DAYS', [], 90, 'days', { ...RS, kind: 'stand-in', evidence: 'diffusion.ts:71-72 "[stand-in: a quarter, about a rival\'s post-training cadence]"' }),
  one(PD, 'RECIPE_LEAK_SHARE', ['publish'], 0.05, 'fraction of recipe gap', { ...RS, kind: 'designer', evidence: 'diffusion.ts:127 "A4 publish [D]: a paper discloses about one of the ~20 techniques that make up a recipe lead."' }),
  one(PD, 'RECIPE_LEAK_SHARE', ['openWeights'], 0.3, 'fraction of recipe gap', { ...RS, kind: 'designer', evidence: 'diffusion.ts:129 "C6 / any open-weights release [D]: weights reveal architecture, size and tokenizer, not the data mix or training code"' }),
  one(PD, 'RECIPE_LEAK_SHARE', ['track2'], 0.01, 'fraction of recipe gap', { ...RS, kind: 'designer', evidence: 'diffusion.ts:132 "E1 Track-2 dialogue [D]: a slip in a few conversations, a tenth of the AI 2027 SSL test bound"' }),
  one(PD, 'TACIT_FIRM_SHARE', [], 0.5, 'fraction of what movers carry', { ...RS, kind: 'sourced', source: 'research/RD-X04r §3C (S1)', evidence: 'diffusion.ts:136 "C4 poach / E16 let go [S1, research/RD-X04r §3C]: the share of what movers carry that is firm learning"' }),
  one(PD, 'THEFT_GAP_CLOSED', [], 2 / 3, 'fraction of model gap', { ...RS, kind: 'sourced', source: 'research/RD-X04r T5 (AI 2027: China 6 to 2 months behind on stealing Agent-2)', evidence: 'diffusion.ts:139-141 "Weight theft [P, research/RD-X04r T5]: ... the thief closes 4/6 of its model gap"' }),
  // Inline literals
  inline('mkt.production.tcoBase', PP, '(14e3 * Math.pow(0.8', 14e3, 'USD per H100e-year (mid-2025)', { ...RS, kind: 'designer', evidence: 'production.ts:242 "Annual TCO of one H100e ($B/yr): market rental when WS3 sets it, else R11\'s 14k·0.8^t [D]."' }),
  inline('mkt.production.tcoDecay', PP, 'Math.pow(0.8, yr - 2025.5)', 0.8, 'x per year', { ...RS, kind: 'designer', evidence: 'production.ts:242 "R11\'s 14k·0.8^t [D]."' }),
  inline('mkt.production.treatySpeed', PP, "s.gov.treaty === 'verified' ? 0.65 : 1", 0.65, 'x rival research speed under a verified treaty', { ...RS, actor: 'rivals', kind: 'untagged', evidence: 'no tag; production.ts:278 (rivalResearch: "modifiers (a binding leader, a verified treaty)")' }),
  inline('mkt.ces.refTotalShare', PC, 'refCapCompute(asV1World(w), yr - 2025.5) / 0.68', 0.68, 'share of leader compute on capabilities', { ...RS, kind: 'designer', source: 'design/V2-SPEC.md §3.1.1 (F(t), refTotal)', evidence: 'ces.ts:75 "refTotal(t) = refCapCompute(w, t)/0.68: the leading lab\'s total compute on the reference path (H100e, §3.1.1)"' }),
  inline('mkt.ces.frontierShare', PC, '0.8 * frontierRunShareAt(yr)', 0.8, 'fraction of training compute in the frontier base run', { ...RS, kind: 'designer', source: 'design/V2-SPEC.md §3.1.1 (F(t), refTotal)', evidence: 'ces.ts:80 "F(t) = 0.8·frontierRunShare·refTotal·Φ·91 (§3.1.1; ≈1e27 Jul 2025)"' }),
  inline('mkt.ces.frontierDays', PC, '* PHI_FLOP_PER_H100E_DAY * 91', 91, 'days of base-run training', { ...RS, kind: 'designer', source: 'design/V2-SPEC.md §3.1.1 (F(t), refTotal)', evidence: 'ces.ts:80 "F(t) = ...·Φ·91 (§3.1.1)"' }),
  inline('mkt.ces.hRefFloor', PC, 'Math.max(200, H_REF_BASE + H_REF_PER_MONTH', 200, 'heads', { ...RS, kind: 'untagged', evidence: 'no tag; ces.ts:72 "Reference capabilities headcount H_ref(t) = 2050 + 49.2·months (research/13 §1.2; R11 #12)" (floor 200 not described)' }),
  inline('mkt.diffusion.accessSlope', PD, '1 - 0.25 * Math.log10(DISTILL_FULL_TOKENS / D)', 0.25, 'access per tenfold cut of harvest', { ...RS, kind: 'sourced', source: 'research/RD-X04r §3B, D2', evidence: 'diffusion.ts:80-82 "Access to a served teacher (research/RD-X04r §3B, D2): ... D2\'s 1 − 0.25·log10(D_full / D)"' }),
  inline('mkt.diffusion.chinaAccessMeter', PD, 's.china.meters.distillationAccess / 60', 60, 'meter points for full access', { ...RS, actor: 'china', kind: 'untagged', evidence: 'no tag; diffusion.ts:83-86 "China reaches US APIs through its distillationAccess meter (/60, ≤ 1)"' }),
];

// ---------- src/data/v2/labourMarket.ts (L11) ----------
const LM = 'src/data/v2/labourMarket.ts';
const LAB = (src: string): Meta => ({ ...W, kind: 'sourced', source: src, evidence: 'see LABOUR-SOURCES.md §13' });
const LABOUR: Param[] = [
  ...grp(LM, 'P0', [], { eng: [1_687_890, 'persons'], re: [262_440, 'persons'], sci: [37_200, 'persons'] }, { ...LAB('BLS OEWS May 2025 (15-1252 eng, 15-2051 re, 15-1221 sci)'), evidence: 'labourMarket.ts "P0 ... [BLS OEWS May 2025 ...; LABOUR-SOURCES §13]"', notes: 'Confidence H eng/sci, M re; the mapping of occupations to kinds is the weak part.' }),
  ...grp(LM, 'INFLOW', [], { eng: [17_480, 'persons per year (net)'], re: [9_540, 'persons per year (net)'], sci: [840, 'persons per year (net)'] }, { ...LAB('BLS Employment Projections 2025-35, Table 1.10 (gross entrants less exits)'), evidence: 'labourMarket.ts "INFLOW ... [BLS Employment Projections 2025-35, Table 1.10 ...; LABOUR-SOURCES §13]"', notes: 'Confidence M; net of exits because the game has no exit flow from P.' }),
  ...grp(LM, 'W0', [], { eng: [0.86, 'USD M per head-year'], re: [0.98, 'USD M per head-year'], sci: [1.22, 'USD M per head-year'] }, { ...W, kind: 'designer', source: 'design/bal/LABOUR-SOURCES.md designer decision 5 (ladder 0.7:0.8:1.0 scaled to the S-1 mean of 1.15)', evidence: 'labourMarket.ts "W0 ... A pay ladder (designer decision 5) ... Level M, kind split [D]"', notes: 'Level sourced (Anthropic S-1 s5.5), the split across kinds [D] (research/19 s1.2 relatives).' }),
  one(LM, 'W_STAR0', [], 50, 'USD M per star-year', { ...W, kind: 'designer', evidence: 'labourMarket.ts "W_STAR0 ... [D] designer-set (decision 6: tens to hundreds of millions per year)"', source: 'design/bal/LABOUR-SOURCES.md designer decision 6', notes: 'Confidence L; the earlier 2.0 (LCA ceiling x S-1 loading) is retired.' }),
  one(LM, 'ETA', [], 2.2, 'shape of log-logistic reservation wages', { ...LAB('Bound, Khanna & Morales 2017 fn 34'), range: { lo: 1.96, hi: 2.48, from: 'LABOUR-SOURCES.md §13' }, evidence: 'labourMarket.ts "ETA ... [Bound, Khanna & Morales 2017 fn 34; 1.96-2.48]"', notes: 'Confidence M-L.' }),
  one(LM, 'EPS', [], 1.7, 'elasticity of hiring to the pay premium', { ...LAB('Sokolova & Sorensen 2018/21 Table 1, recruitment median / 2; ABM 2022'), range: { lo: 0.7, hi: 2.4, from: 'LABOUR-SOURCES.md §13' }, evidence: 'labourMarket.ts "EPS ... [Sokolova & Sorensen 2018/21 Table 1 ...; 0.7-2.4]"', notes: 'Confidence M-L.' }),
  one(LM, 'ALPHA', [], 0.35, 'unemployed-side matching elasticity', { ...LAB('Petrongolo & Pissarides 2001 p. 424 (total hires)'), range: { lo: 0.3, hi: 0.4, from: 'LABOUR-SOURCES.md §13' }, evidence: 'labourMarket.ts "ALPHA ... [Petrongolo & Pissarides 2001 p. 424; 0.3-0.4]"', notes: 'Confidence M-L.' }),
  one(LM, 'F0_PER_MONTH', [], 0.62, 'hires per opening per month', { ...LAB('BLS JOLTS 2025, Information sector; DFH 2013 check'), evidence: 'labourMarket.ts "F0_PER_MONTH ... [BLS JOLTS 2025, Information sector; DFH 2013 check; 7.4/yr]"', notes: 'Confidence M (L for labs); sets the matching scale mu in L12, a unit translation.' }),
  one(LM, 'SEPARATION', [], 0.156, 'per year', { ...LAB('BLS JOLTS 2025, Information quits'), evidence: 'labourMarket.ts "SEPARATION ... [BLS JOLTS 2025, Information quits; designer accepted 15.6%/yr]"', notes: 'Confidence L-M.' }),
  one(LM, 'PAY_RENEWAL_YEARS', [], 1, 'years (pay relaxes toward the offer at 1/T per year)', { ...W, kind: 'designer', evidence: 'labourMarket.ts "PAY_RENEWAL_YEARS ... [D] designer: gradual, annual renewal"', source: 'design/bal/LABOUR-ROUND.md §4.2 item 7 (open question Q2)', notes: 'Continuous relaxation: after one year the gap to the offer has closed by 1 - e^-1 = 63%.' }),
  one(LM, 'STAR_TOP_PERCENTILE', [], 0.999, 'quantile', { ...LAB('AIFM config.py:41 TOP_PERCENTILE'), evidence: 'labourMarket.ts "STAR_TOP_PERCENTILE ... [AIFM config.py:41 TOP_PERCENTILE = 0.999]"', notes: 'Confidence H; the star count 37 = (1 - this) x P0.sci is derived.' }),
  ...grp(LM, 'STAR_EMPLOYER0', [], { google: [0.24, 'share of stars'], openai: [0.2, 'share of stars'], meta: [0.12, 'share of stars'], microsoft: [0.04, 'share of stars'], outside: [0.32, 'share of stars'], china: [0.08, 'share of stars'] }, { ...LAB('Semantic Scholar top-25 cited NeurIPS/ICML/ICLR 2020-23, paper affiliations'), evidence: 'labourMarket.ts "STAR_EMPLOYER0 ... [Semantic Scholar top-25 cited NeurIPS/ICML/ICLR 2020-23 ...; LABOUR-SOURCES §13]"', notes: 'Confidence L; the player takes the openai share, rivals the next labs by rank (STAR_LAB_ORDER).' }),
  one(LM, 'BASE_TASTE_FLOOR', [], 0.05, 'taste (floor of the teams base taste b)', { ...W, kind: 'designer', evidence: 'labourMarket.ts "BASE_TASTE_FLOOR ... a numerical guard, not a tuned value"', source: 'design/BAL-TASKS.md (L17 fix: teams base taste set at start)' }),
  one(LM, 'STAR_POACH_COOPERATION', [], -20, 'cooperation points with the rival', { ...W, kind: 'designer', evidence: 'labourMarket.ts "STAR_POACH_COOPERATION ... [D] (today\x27s value, kept: the old star hire took -20 from the rivals)"', source: 'design/bal/LABOUR-ROUND.md §6.3' }),
  one(LM, 'PREMIUM_STEPS', [], [0, 0.1, 0.25, 0.5, 1], 'share above the market wage', { ...W, kind: 'designer', evidence: 'labourMarket.ts "PREMIUM_STEPS ... [D] (LABOUR-ROUND §4.1: 0 / +10 / +25 / +50 / +100%)"', source: 'design/bal/LABOUR-ROUND.md §4.1' }),
];

export const PARAMS_MARKET = defineParams([...SERVING, ...SECTORS, ...MARKET_BUYERS, ...TOOLS, ...TEAMS, ...STARTS_P, ...DEALS, ...PRODUCTION, ...LABOUR]);
