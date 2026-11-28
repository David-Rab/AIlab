// Models chunk (B3): src/engine/v2/models/* and src/engine/v2/compute/* (prefix `mod`). These files are almost all logic: nearly
// every balance number they use lives in src/data/v2 (other chunks), so this file holds the few named constants plus the
// notable inline literals. Helpers `ex`/`inl` expand to plain Param records.
import { defineParams, type Param } from '../schema';

type Meta = Omit<Param, 'id' | 'ref' | 'value' | 'unit'>;
type Val = number | number[] | string | boolean;

/** One export entry (`path` empty for the whole export). */
const ex = (module: string, symbol: string, path: (string | number)[], value: Val | undefined, unit: string | undefined, meta: Meta): Param => ({
  id: ['mod', symbol, ...path.map(String)].join('.'),
  ref: path.length ? { kind: 'export', module, symbol, path } : { kind: 'export', module, symbol },
  ...(value === undefined ? {} : { value }),
  ...(unit === undefined ? {} : { unit }),
  ...meta,
});
/** One inline entry: `anchor` is a code snippet that occurs once in `file`. */
const inl = (id: string, file: string, anchor: string, value: Val | undefined, unit: string | undefined, meta: Meta): Param => ({
  id, ref: { kind: 'inline', file, anchor },
  ...(value === undefined ? {} : { value }),
  ...(unit === undefined ? {} : { unit }),
  ...meta,
});

const MK = { area: 'market', layer: 'world' } as const;
const CAP = { area: 'capability', layer: 'world' } as const;
const RES = { area: 'research', layer: 'world' } as const;
const SAF = { area: 'safety', layer: 'world' } as const;
const SEC = { area: 'security', layer: 'world' } as const;

const R15 = 'research/15 §1.2 ("R15")';

// ---------- src/engine/v2/compute/forecast.ts, power.ts, sites.ts, orders.ts ----------
const CF = 'src/engine/v2/compute/forecast.ts';
const CS = 'src/engine/v2/compute/sites.ts';
const CO = 'src/engine/v2/compute/orders.ts';
const CM = 'src/engine/v2/compute/market.ts';

const COMPUTE_SITES: Param[] = [
  inl('mod.forecast.KW_STEP', CF, 'const KW_STEP = 0.944', 0.944, 'x per quarter', { ...MK, kind: 'sourced', source: 'research/15 §1.2 ("R15")',
    evidence: 'no tag; forecast.ts:9 "kW per H100e falls ×0.944 each quarter (sitesQ)"',
    notes: 'A7: copy of mod.sites.kwStep (0.944; also in sitesQ and expectedCloudPrice).' }),
  inl('mod.sites.kwStep', CS, 'pw.kWPerH100e *= 0.944', 0.944, 'x per quarter', { ...MK, kind: 'sourced',
    evidence: 'sites.ts:277 "1.26×/yr efficiency: 0.93 → 0.70 at Q4 2026 [R15, AI27]"', source: R15 }),

  ex(CO, 'CHIP_TERMS', [], [0, 1, 4, 8, 12, 16], 'quarters', { ...MK, kind: 'untagged',
    evidence: 'no tag; orders.ts:34-35 "Chip terms: 0 = spot (next quarter, spot price), 1 = one batch (two quarters), 4–16 = a tranche every quarter"',
    notes: 'Offered contract lengths on the Buy chips card.' }),
  ex(CO, 'TRANCHE_Q', ['min'], 4, 'quarters', { ...MK, kind: 'untagged', evidence: 'no tag; orders.ts:37 (same doc as CHIP_TERMS)' }),
  ex(CO, 'TRANCHE_Q', ['max'], 16, 'quarters', { ...MK, kind: 'untagged', evidence: 'no tag; orders.ts:37 (same doc as CHIP_TERMS)' }),
  ex(CO, 'RENT_TERMS', [], [1, 4, 8, 16], 'quarters', { ...MK, kind: 'untagged',
    evidence: 'no tag; orders.ts:133 "Rent terms in quarters: 1 = a one-quarter spot rental; 4–20 = a contract starting next quarter."' }),
  ex(CO, 'RENT_Q_MAX', [], 20, 'quarters', { ...MK, kind: 'untagged', evidence: 'no tag; orders.ts:133-135 (same doc as RENT_TERMS)' }),
];

// ---------- src/engine/v2/compute/market.ts ----------
const COMPUTE_MARKET: Param[] = [
  inl('mod.market.START_GROWTH', CM, 'const START_GROWTH: Record<Comp, number> = { pkg: 2.2, hbm: 2.0, wafer: 1.35 }', [2.2, 2.0, 1.35], 'x per year (packaging, HBM, wafer)', { ...MK, kind: 'designer',
    evidence: 'market.ts:17 "Pre-ordered capacity at the start: arrivals that keep each component on its recent growth path [D]."', notes: 'Array order = pkg, hbm, wafer.' }),
  ex(CM, 'C0', [], 6.0, 'USD K per H100e', { ...MK, kind: 'sourced',
    evidence: 'market.ts:19 "Base cost c_t at Q3 2025 ($K / H100e) and supplier markup μ (Nvidia GM 72–75%) [R15]."', source: R15 }),
  ex(CM, 'MU', [], 3.8, 'x (supplier markup)', { ...MK, kind: 'sourced',
    evidence: 'market.ts:19 "supplier markup μ (Nvidia GM 72–75%) [R15]."', source: R15 }),
  inl('mod.market.FWD_SHARE', CM, 'const FWD_SHARE = 0.95', 0.95, 'fraction', { ...MK, kind: 'fitted',
    evidence: 'market.ts:22 "Forward-booking share of the exogenous buyers\' next-4-quarter demand (LTAs, supply obligations) [fit]."',
    fit: { targets: [], script: 'unnamed' }, notes: 'Comment names no target or script.' }),
  inl('mod.market.EXO_ELASTICITY', CM, 'const EXO_ELASTICITY = 1.5', 1.5, 'elasticity', { ...MK, kind: 'designer',
    evidence: 'market.ts:24 "Exogenous demand price elasticity on (1+π) [D]."' }),
  ex(CM, 'KOREA_HAZARD_Q', [], 0.001, 'probability per quarter', { ...MK, kind: 'designer', source: 'research/15 §1.2 ("R15")',
    evidence: 'market.ts:196 "Korea HBM disruption probability 0.1%/q [R15 Design]."', notes: 'A2: [R15 Design] is designer with the pointer in source.' }),
  ex(CM, 'RIVAL_GROWTH_Q', [], Math.pow(2.25, 0.25) - 1, 'fraction per quarter', { ...MK, actor: 'rivals', kind: 'designer',
    evidence: 'market.ts:114-115 "Default (reference) demand per quarter of a non-player lab that WS4 does not manage [D]: fleet grows at the global pace (2.25×/yr, AI 2027 compute forecast)."',
    notes: 'The [D] is on the first of two stacked doc comments; value computed from 2.25 per year.' }),
  inl('mod.market.taiwanHazard', CM, 'Math.min(0.03, 0.0025 * (1 + 4 * TAIWAN_TENSION))', [0.03, 0.0025, 4], 'probability per quarter (cap, base, tension weight); × China (CHINAGOV.taiwanPerRung, taiwanCoercion)', { ...MK, kind: 'designer', source: 'research/15 §1.2 ("R15")',
    evidence: 'market.ts "Quarterly Taiwan quarantine probability: 0.25% × (1 + 4·tension), cap 3% [R15 Design]" (the salience term went in W6)', notes: 'A2: [R15 Design] is designer with the pointer in source.' }),
  inl('mod.market.geoTW', CM, 'if (year <= 2028) return 0.93 - (0.08 * (year - 2026)) / 2;', [0.93, 0.85, 0.75], 'fraction of supply (2026, 2028, 2030)', { ...MK, kind: 'sourced',
    evidence: 'market.ts:199 "geo_TW falls linearly 0.93 (2026) → 0.85 (2028) → 0.75 (2030) [R15]."', source: R15 }),
  inl('mod.market.premiumUpdate', CM, 'pi + 0.5 * (ds - 1) - 0.25 * pi', [0.5, 0.25], 'per quarter (demand response, mean reversion)', { ...MK, kind: 'sourced',
    evidence: 'market.ts:79 "π update [R15]: π\' = clamp(π + 0.5(D/S − 1) − 0.25π, −0.25, 1.5)."', source: R15, notes: 'Clamp bounds come from MARKET.premiumLo/Hi (data/v2/deals.ts).' }),
  inl('mod.market.powerPrice', CM, '(kW * 8760 * 0.083) / 1000', 0.083, 'USD per kWh', { ...MK, kind: 'sourced',
    evidence: 'market.ts:62 "Owned TCO per H100e-year ($K): chips+network over 4 y, facility over 14 y, power, O&M 3%, cost of capital [R15 §1.2]."', source: R15,
    notes: 'Same price as POWER_PRICE in data/v2/deals.ts, written again here.' }),
  inl('mod.market.omRate', CM, '0.03 * (chips + facility)', 0.03, 'fraction of capex per year', { ...MK, kind: 'sourced',
    evidence: 'market.ts:62 "... O&M 3% ... [R15 §1.2]."', source: R15, notes: 'Same rate as OM_RATE in data/v2/deals.ts, written again here.' }),
  inl('mod.market.facilityPerKW', CM, 'const facility = 10 * kW;', 10, 'USD K per kW', { ...MK, kind: 'sourced',
    evidence: 'market.ts:62-65 "facility over 14 y ... [R15 §1.2]"; :65 "$10B per GW facility = $10K per kW"', source: R15,
    notes: 'Tag sits on the TCO doc comment, not on the 10 itself; compare FACILITY_PER_GW in data/v2/deals.ts.' }),
  inl('mod.market.globalRefQ', CM, 'return 3.0e6 * Math.pow(2.2, a / 4) * Math.pow(1.95, b / 4) * Math.pow(1.5, c / 4);', [3.0e6, 2.2, 1.95, 1.5], 'H100e per quarter (start), x per year (to 2026, 2027, after)', { ...MK, kind: 'sourced',
    evidence: 'market.ts:104-107 "Reference global production per quarter (H100e): Epoch 2.2×/yr through 2026, ~1.95× in 2027 ... then 1.5×/yr [R15 §1.2 targets, R11 #18]."', source: 'R15 §1.2 targets (research/15); R11 #18 (research/11)' }),
  inl('mod.market.refTotalShare', CM, 'refCapCompute(asV1World(s.hidden.timeline), years) / 0.68', 0.68, 'fraction', { ...MK, kind: 'designer', source: 'V2-SPEC §3.1.1 (R11 #11)', notes: 'A8c: spec states refTotal = refCapCompute / 0.68.',
    evidence: 'no tag; market.ts:100 "Reference compute path of the leading lab (refTotal = refCapCompute / 0.68, §3.1.1)."' }),
  inl('mod.market.hypeDemand', CM, 'const hype = 0.85 + 0.15 * s.capital.hype', [0.85, 0.15], 'fraction (floor, hype weight)', { ...MK, kind: 'designer',
    evidence: 'market.ts:135 "demand scales (mildly) with hype [D]"' }),
  inl('mod.market.bustDemand', CM, 'recoverDay > s.time.day ? 0.6 : 1', 0.6, 'x demand', { ...MK, kind: 'designer', source: 'V2-SPEC §3.8', notes: 'A8c: spec states "in a bust, it drops 40%".',
    evidence: 'no tag; market.ts:136 "bust: −40% (§3.8)"' }),
  inl('mod.market.chinaSmuggling', CM, 'const toChina = S0 * (pol.xCN + 0.01)', 0.01, 'fraction of supply', { ...MK, actor: 'china', kind: 'sourced',
    evidence: 'market.ts:324 "China\'s policy-set share (licensed exports + ~1% smuggling) comes off the top [R15 export controls]."', source: R15 }),
  inl('mod.market.hbmDisruptHit', CM, 'const raw = Math.min(m.Kpkg, m.Khbm * (1 - m.disruptKR * 0.9), m.Kwafer);', 0.9, 'fraction of K_hbm lost at full disruption', { ...MK, kind: 'untagged',
    evidence: 'no tag; market.ts:240-241 (same 0.9 repeated in clearMarket hbmEff)' }),
  inl('mod.market.waferConversion', CM, 'm.pipe.wafer[2] += 0.1 * m.Kwafer;', 0.1, 'fraction of K_wafer', { ...MK, kind: 'sourced',
    evidence: 'market.ts:262 "Fast lever: wafer node conversion adds up to +10% K_wafer with L = 3, once per 4 quarters, when wafers bind [R15]."', source: R15 }),
  inl('mod.market.rivalOrderWeight', CM, "claims.push({ kind: 'lab', ref: r.core.id, qty, weight: 1.2, got: 0 });", 1.2, 'rationing weight', { ...MK, actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; market.ts:369 (default demand of rivals WS4 does not manage)' }),
  inl('mod.market.backlogSmoothing', CM, 'm.backlog = 0.5 * m.backlog + 0.5 *', 0.5, 'weight on previous backlog', { ...MK, kind: 'untagged',
    evidence: 'no tag; market.ts:439' }),
  inl('mod.market.startListPrice', CM, 'const listPrice = 23;', 23, 'USD K per H100e', { ...MK, kind: 'designer', source: 'V2-SPEC §3.8 start table',
    evidence: 'no tag; market.ts:27 "Market at Q3 2025 (§3.8 start table, back-cast from R15 Q4-2026 at ≈2.2×/yr)"', notes: 'A8c: the start table states P_t = $23K per H100e.' }),
];

// ---------- src/engine/v2/models ----------
const MD = 'src/engine/v2/models/';

const MODELS: Param[] = [
  // benchmarks.ts
  inl('mod.benchmarks.P_EDGE', MD + 'benchmarks.ts', 'const P_EDGE = 0.005', 0.005, 'fraction of span', { ...CAP, kind: 'untagged',
    evidence: 'no tag; benchmarks.ts:61-62 "RD-M01: a reading\'s score is kept off the floor and ceiling by this share of the span before it is inverted"' }),
  inl('mod.benchmarks.MIN_SCORE_SD', MD + 'benchmarks.ts', 'const MIN_SCORE_SD = 0.5', 0.5, 'score points', { ...CAP, kind: 'untagged',
    evidence: 'no tag; benchmarks.ts:64 "RD-M01: the smallest score sd (points) a reading is weighted with"' }),
  ex(MD + 'benchmarks.ts', 'MEASURE_SD', [], 0.2, 'L (level)', { ...CAP, kind: 'untagged',
    evidence: 'no tag; benchmarks.ts:135 "SD of a version\'s measured level when its suite gave no fit sd (old records): 0.2/√nEff."' }),
  inl('mod.benchmarks.speedrunCurve', MD + 'benchmarks.ts', '3 * Math.pow(10, 0.206 + 0.515 * (Ld - 5))', [3, 0.206, 0.515], 'x (scale, log10 intercept, log10 slope per level)', { ...CAP, kind: 'untagged',
    evidence: 'no tag; benchmarks.ts:55; doc :51 "speedrun = ×"', notes: 'Score curve of the special speedrun benchmark.' }),
  inl('mod.benchmarks.speedrunNoise', MD + 'benchmarks.ts', 'Math.exp(rng.normal(0, 0.15 * k))', 0.15, 'log-sd', { ...CAP, kind: 'untagged', evidence: 'no tag; benchmarks.ts:55' }),
  inl('mod.benchmarks.horizonNoise', MD + 'benchmarks.ts', 'Math.exp(rng.normal(0, 0.2 * k))', 0.2, 'log-sd', { ...CAP, kind: 'untagged', evidence: 'no tag; benchmarks.ts:53' }),

  // capability.ts
  inl('mod.capability.LEVEL_AT', MD + 'capability.ts', 'const LEVEL_AT = [LEVEL_KNOTS[0], LEVEL_KNOTS[3], LEVEL_KNOTS[4], LEVEL_KNOTS[5], LEVEL_KNOTS[6]]', [5, 10, 12, 13.5, 15], 'level L', { ...CAP, kind: 'derived',
    evidence: 'capability.ts:39 "Level knots (V0 L 5; SC 10, SAR 12, SIAR 13.5, ASI 15 = v2\'s LEVEL_KNOTS at those milestones)"; picked from LEVEL_KNOTS in code',
    notes: 'Array order = V0, SC, SAR, SIAR, ASI. LEVEL_KNOTS lives in data/v2/calibration.ts.' }),
  ex(MD + 'capability.ts', 'V2_DOMAIN_OFF', ['CYBER'], -1, 'level L', { ...CAP, kind: 'untagged',
    evidence: 'no tag; capability.ts:204-206 "CAL2-X: v2\'s level profile on the domains RD-U05 moved (REF_OFF, deleted in RD-U05) ... A unit, not a parameter."', notes: 'See Q-models-2.' }),
  ex(MD + 'capability.ts', 'V2_DOMAIN_OFF', ['PHYS'], -4, 'level L', { ...CAP, kind: 'untagged',
    evidence: 'no tag; capability.ts:204-206 (same doc as CYBER)', notes: 'See Q-models-2.' }),
  ex(MD + 'capability.ts', 'PACE_WINDOW_DAYS', [], 182, 'days', { ...CAP, kind: 'designer',
    evidence: 'capability.ts:331-332 "The window (days) over which the \'how fast\' readers take a lab\'s pace (RD-L02 [D]: half a year ...)"' }),
  inl('mod.capability.paceFloor', MD + 'capability.ts', 'Math.max(0.06, frontierGPerYear(s, leader))', 0.06, 'OOM per year', { ...CAP, kind: 'untagged',
    evidence: 'no tag; capability.ts:299', notes: 'Floor on the leader pace when converting a G gap to days of lag.' }),

  // deployments.ts
  ex(MD + 'deployments.ts', 'ANON_SHARE', [], [0.3, 0.5, 0, 0, 0, 1], 'fraction of usage', { ...MK, kind: 'stand-in',
    evidence: 'deployments.ts:20 "share of a channel\'s usage bought by unverified buyers ... the only usage a distiller can hide in [stand-in]"',
    notes: 'Array order = consumer, api, enterprise, vetted, internal, open.' }),
  ex(MD + 'deployments.ts', 'KYC_ANON_LEFT', [], [1, 0.1, 0.01, 0.001], 'fraction left at KYC level 0..3', { ...SAF, kind: 'designer', source: 'research/RD-X04r D2',
    evidence: 'deployments.ts:27-28 "each level verifies ten times more of the self-serve accounts [D, the access formula\'s tenfold cut per level, research/RD-X04r D2]"',
    notes: 'Pointer research/RD-X04r D2 kept in notes (rule: [D] plus a research pointer is designer).' }),
  ex(MD + 'deployments.ts', 'KYC_REFUSE', [], 0.25, 'fraction', { ...MK, kind: 'sourced',
    evidence: 'deployments.ts:30-34 "RD-P09, CAL-P: share of the anonymous buyers asked to verify who leave instead. 0.25 [P-analogue, low confidence]: Ofcom, Online Nation 2025 ..."',
    source: 'Ofcom, Online Nation 2025 (UK age checks, visitors fell 24-31%); research/CAL-products-sources.md K1', range: { lo: 0.24, hi: 0.31, from: 'deployments.ts:32 "unique visitors fell 24-31% in a month"' },
    notes: 'analogue (A6). An analogue, flagged "low confidence" in the comment; 0.25 sits at the low end of the quoted range.' }),
  ex(MD + 'deployments.ts', 'DEFAULT_SERVING', [], [0.4, 0.3, 0.15, 0.05, 0, 0], 'fraction of serving pool', { ...MK, kind: 'designer', layer: 'policy', actor: 'player',
    evidence: 'deployments.ts:47 "Default serving-pool reservation per channel [D]."', notes: 'Player default (A10). Array order = consumer, api, enterprise, vetted, internal, open.' }),
  inl('mod.deployments.distillAccess', MD + 'deployments.ts', 'lab === CHINA_ID ? 1 : 0.3', [1, 0.3], 'China access (its meter at the start value 60, /60; W1d), US-rival access 0..1', { ...SAF, actor: 'rivals', kind: 'designer', source: 'V2-SPEC §3.3.5',
    evidence: 'no tag; deployments.ts:213 "Distillation access of a receiving lab: China = distillationAccess/60; US rivals 0.3 (§3.3.5)."', notes: 'A8c: spec states distillationAccess/60 for China and 0.3 for rivals.' }),

  // labReadouts.ts
  ex(MD + 'labReadouts.ts', 'WSL_RISE_PER_DAY', [], 0.006, 'levels per day', { ...SEC, kind: 'untagged',
    evidence: 'no tag; labReadouts.ts:10 "How fast weight security climbs while funded (security/security.ts securitySystem: ≤ 0.006 a level a day)."',
    notes: 'readout. Readout copy of a rate set in security/security.ts; not read by the engine.' }),

  // effective.ts
  inl('mod.effective.rlCeilingFloor', MD + 'effective.ts', 'Math.max(0.1 * RL_CURVE.A0, RL_CURVE.A0 + RL_CURVE.a1', 0.1, 'x A0', { ...CAP, kind: 'designer', source: 'research/20 C1',
    evidence: 'effective.ts:148-150 "RL ceiling A (OOM) set by the base: A0 + a1·log₁₀(FLOP_pre ÷ FLOP_RL_REF), never below 0.1·A0 [D, R20 C1: the asymptote rises with base model size]"', notes: 'Pointer R20 C1 kept in notes.' }),
  ex(MD + 'effective.ts', 'RL_C0', [], 7.538112209178306e+25, 'FLOP', { ...CAP, kind: 'derived',
    evidence: 'effective.ts:162-166 "c0: the RL midpoint constant ... solved once so the reference post-training run ... gains RL_REF_GAIN on average over the cognitive domains [fit]"',
    notes: 'Solved at load by bisection from RL_REF_GAIN and RL_CURVE; the comment tags it [fit] but no script fits it. See Q-models-3.' }),

  // products.ts, suites.ts, suitesPreview.ts
  inl('mod.products.catchRate', MD + 'products.ts', 'Math.min(0.99, 1 - (1 - base) * (1 - 0.5 * control) * defer)', [0.99, 0.5], 'probability cap, weight of containment', { ...SAF, kind: 'untagged',
    evidence: 'no tag; products.ts:190', notes: 'Array order = cap on the catch rate, weight of the control layer.' }),
  inl('mod.suites.hardenCap', MD + 'suites.ts', 'Math.min(0.95, SUITE_HARDEN.cut * aiOversight(s).cutMult)', 0.95, 'fraction', { ...SAF, kind: 'untagged',
    evidence: 'no tag; suites.ts:143 (hardenCut cap; the 0.4 base cut is SUITE_HARDEN.cut in data)' }),
  inl('mod.suitesPreview.p11S2', MD + 'suitesPreview.ts', "adopted(s, 'P11') ? 0.2 : 0", 0.2, 'S2 pressure added', { ...SAF, kind: 'untagged',
    evidence: 'no tag; suitesPreview.ts:52 (doc :44 "p(ρ) (E3, Gao), + P11")' }),

  // runs.ts
  ex(MD + 'runs.ts', 'RUN_POOL_DEFAULT', [], [0.6, 0.2, 0.1, 0.3], 'share of training pool', { ...CAP, kind: 'untagged', layer: 'policy', actor: 'player',
    evidence: 'no tag; runs.ts:72 "Default pool share per run kind (RD-B01: the Blueprint reads these too)."', notes: 'Player default (A10). Array order = base, post, distill, continue.' }),
  ex(MD + 'runs.ts', 'POOL_SHARE_RANGE', [], [0.02, 1], 'share of training pool', { ...CAP, kind: 'untagged',
    evidence: 'no tag; runs.ts:74 "Share of the training pool a run can take (LIMITS: one range for the engine and the run designer slider)."', notes: 'Array order = lowest, highest.' }),
  inl('mod.runs.idaPoolShare', MD + 'runs.ts', "p.grader === 'teacher' ? 0.3 : RUN_POOL_DEFAULT[p.kind]", 0.3, 'share of training pool', { ...CAP, kind: 'untagged', layer: 'policy', actor: 'player', notes: 'Player default (A10).',
    evidence: 'no tag; runs.ts:741 (RunParams doc :63 "Default RUN_POOL_DEFAULT (IDA 0.3)")' }),
  inl('mod.runs.newVersionMonitorability', MD + 'runs.ts', 'monitorability: 0.9, fpt: base.fpt', 0.9, 'fraction (0..1)', { ...SAF, actor: 'model', kind: 'untagged',
    evidence: 'no tag; runs.ts:855 (starting monitorability of every new model version)' }),
  inl('mod.runs.blankBeliefPrior', MD + 'runs.ts', '{ est: 0.2, sd: 0.3, clarity: 1 - 0.3 / 0.35, evidence: [] }', [0.2, 0.3, 0.35], 'trait belief (estimate, sd, sd cap)', { ...SAF, kind: 'stand-in',
    evidence: 'runs.ts:829 "// placeholder: applyRunToTraits sets the beliefs"', notes: 'Array order = est, sd, sd cap (the 0.35 also caps inherited sd + 0.05).' }),

  // research.ts
  inl('mod.research.ideaTasteFloor', MD + 'research.ts', '1 + TASTE_MEAN * (1 - 1 / Math.max(0.2, q))', 0.2, 'taste T', { ...RES, kind: 'designer',
    evidence: 'research.ts:107 "Taste\'s lift on a one-off idea\'s mean: 1 + TASTE_MEAN·(1 − 1/T), ×0.9 for Solid teams, ×1.5 at most [D]."', notes: 'Floor on taste in the lift formula; TASTE_MEAN is in data/v2/research.ts.' }),
  inl('mod.research.beliefNoiseJitter', MD + 'research.ts', 'BELIEF_NOISE * (0.5 + nov) * Math.pow(SPECULATIVE.spread, spec)', 0.5, 'x (jitter offset, noise factor 0.5..1.5)', { ...RES, kind: 'untagged',
    evidence: 'no tag; research.ts:707-708 "Taste narrows the belief noise ÷ T [D; ...]" tags the ÷T, not the 0.5 + nov', notes: 'Same factor at research.ts:931 (flow simulation).' }),
];

export const PARAMS_MODELS = defineParams([...COMPUTE_SITES, ...COMPUTE_MARKET, ...MODELS]);
