// Worldfx chunk (B3): src/engine/v2/worldfx/* (economy, control, sectors, robots, techtree, actions, mix, serving, ...).
// Sector data tables (src/data/v2/sectors.ts) are registered in market.ts and not repeated here.
// Entries are built with two small helpers; each expands to a plain Param (one per named scalar / key).
import { defineParams, type Param } from '../schema';

type Meta = Omit<Param, 'id' | 'ref' | 'value' | 'unit'>;
type Val = number | number[] | string;
const WFX = 'src/engine/v2/worldfx/';
const W = { area: 'worldfx', layer: 'world' } as const;

/** An exported constant (or a key of one), `file` under src/engine/v2/worldfx/. */
const exp = (id: string, file: string, symbol: string, path: (string | number)[], value: Val, unit: string | undefined, meta: Meta): Param => ({
  id: `wfx.${id}`,
  ref: path.length ? { kind: 'export', module: `${WFX}${file}`, symbol, path } : { kind: 'export', module: `${WFX}${file}`, symbol },
  value,
  ...(unit === undefined ? {} : { unit }),
  ...meta,
});
/** A literal written inline (or a non-exported constant: anchor contains `const NAME`). */
const inl = (id: string, file: string, anchor: string, value: Val, unit: string | undefined, meta: Meta): Param => ({
  id: `wfx.${id}`,
  ref: { kind: 'inline', file: `${WFX}${file}`, anchor },
  value,
  ...(unit === undefined ? {} : { unit }),
  ...meta,
});

const ACCEPT_EV = 'control.ts:21-22 "T1 Accept = base + gain·σ(...) ... [D, fit §7.3]"';

export const PARAMS_WORLDFX = defineParams([
  // ---------------------------------------------------------------- macro.ts (named)
  exp('G_BASE', 'economy.ts', 'G_BASE', [], [0.022, 0.04, 0.028], '1/yr', {
    ...W, kind: 'sourced',
    evidence: 'economy.ts: "US = CBO potential (SOURCES §2); CN, ROW [D]"',
    source: 'CBO potential growth (design/world/SOURCES.md §2) for the US; CN and ROW are designer values',
    notes: 'Array order = US, CN, ROW. sectors.ts reads it for gAI.',
  }),
  exp('ECONOMY.lambda', 'economy.ts', 'ECONOMY', ['lambda'], 0.6, 'growth per unit annual change of the automation share', {
    ...W, kind: 'fitted', fit: { targets: [], script: 'scripts/v2/_w1b/paths.ts' },
    evidence: 'economy.ts: fitted to the previous model AI-driven growth at day 900 (before.txt / after.txt)',
  }),

  // ---------------------------------------------------------------- control.ts (named)
  exp('CONTROL_W', 'control.ts', 'CONTROL_W', [], [0.25, 0.2, 0.3, 0.25], 'weight', {
    ...W, kind: 'untagged',
    evidence: 'no tag; control.ts:3 "W: ECON .25, GOV .20, MIL .30, INFRA .25" under a header citing V2-SPEC §3.11.2; research/16 §2 for the file',
    notes: 'Array order = ECON, GOV, MIL, INFRA. Weight of each domain in a lab\'s leverage.',
  }),
  exp('TIER_W', 'control.ts', 'TIER_W', [], [0.1, 0.3, 0.6, 1], 'weight', {
    ...W, kind: 'untagged',
    evidence: 'no tag; control.ts:2 "weights T0 0.1, T1 0.3·Accept, T2 0.6, T3 1.0"; :18',
    notes: 'Array order = T0..T3. T1 is multiplied by Accept in ctrlOf.',
  }),
  exp('LEVERAGE_THRESHOLDS.entrenched', 'control.ts', 'LEVERAGE_THRESHOLDS', ['entrenched'], 0.15, 'leverage', {
    ...W, kind: 'designer', source: 'V2-SPEC §3.11.2', notes: 'A8c: the cited spec section states 0.15 / 0.35 / 0.6.', evidence: 'no tag; control.ts:5 "Lev ≥ 0.15 Entrenched"; :19',
  }),
  exp('LEVERAGE_THRESHOLDS.indispensable', 'control.ts', 'LEVERAGE_THRESHOLDS', ['indispensable'], 0.35, 'leverage', {
    ...W, kind: 'designer', source: 'V2-SPEC §3.11.2', notes: 'A8c: the cited spec section states 0.15 / 0.35 / 0.6.', evidence: 'no tag; control.ts:5 "≥ 0.35 Indispensable"; :19',
  }),
  exp('LEVERAGE_THRESHOLDS.decisive', 'control.ts', 'LEVERAGE_THRESHOLDS', ['decisive'], 0.6, 'leverage', {
    ...W, kind: 'designer', source: 'V2-SPEC §3.11.2', notes: 'A8c: the cited spec section states 0.15 / 0.35 / 0.6.', evidence: 'no tag; control.ts:5 "≥ 0.6 (+ robots > 10% of labor or W25) Decisive"; :19',
  }),
  inl('control.K_DOM', 'control.ts', 'const K_DOM: Record<ControlDomainId, number> = { ECON: 2, GOV: 1.5, MIL: 1, INFRA: 1.5 };', [2, 1.5, 1, 1.5], '1/yr', {
    ...W, kind: 'designer', evidence: 'control.ts:20 "{ ECON: 2, GOV: 1.5, MIL: 1, INFRA: 1.5 }; // per year [D]"',
    notes: 'Array order = ECON, GOV, MIL, INFRA. Penetration catch-up rate toward target.',
  }),
  exp('ACCEPT.base', 'control.ts', 'ACCEPT', ['base'], 0.3, 'fraction', { ...W, kind: 'designer', source: 'V2-SPEC §7.3', evidence: ACCEPT_EV, notes: 'A3: [D, fit §7.3] names a spec section, no script or target, so designer.' }),
  exp('ACCEPT.gain', 'control.ts', 'ACCEPT', ['gain'], 0.65, 'fraction', { ...W, kind: 'designer', source: 'V2-SPEC §7.3', evidence: ACCEPT_EV, notes: 'A3: [D, fit §7.3] names a spec section, no script or target, so designer.' }),
  exp('ACCEPT.mid', 'control.ts', 'ACCEPT', ['mid'], 11.5, 'display level', {
    ...W, kind: 'fitted',
    evidence: 'control.ts:23-30 "Model v3 G1 refit of `mid` ... 9.5 → 11.5: median 2027-08-18 → 2027-12-16 (design/archive/notes/G1.md)"',
    fit: { targets: ['W.govAccept85'], script: 'unnamed' },
    notes: 'Refit so the median first day of GOV T1 Accept >= 0.85 over the 20 CAL_SEEDS classic RefBot runs is 2027-12-15; before that it was [D, fit §7.3].',
  }),
  exp('ACCEPT.spread', 'control.ts', 'ACCEPT', ['spread'], 0.8, 'display levels', { ...W, kind: 'designer', source: 'V2-SPEC §7.3', evidence: ACCEPT_EV, notes: 'A3: [D, fit §7.3] names a spec section, no script or target, so designer.' }),
  exp('ACCEPT.rate', 'control.ts', 'ACCEPT', ['rate'], 6, '1/yr', { ...W, kind: 'designer', source: 'V2-SPEC §7.3', evidence: ACCEPT_EV, notes: 'Accept catch-up rate toward its target. A3: [D, fit §7.3], no script or target, so designer.' }),

  // ---------------------------------------------------------------- mix.ts / productView.ts / readouts.ts (named)
  exp('OPEN_MARKUP', 'mix.ts', 'OPEN_MARKUP', [], 1.2, 'x cost', {
    ...W, kind: 'designer', evidence: 'mix.ts:65 "Open weights are served by hosts near cost (×1.2) [D]."',
  }),
  exp('CONVERGED', 'productView.ts', 'CONVERGED', [], 0.005, 'fraction', {
    ...W, kind: 'designer', evidence: 'productView.ts:126 "The stock counts as at its target within half a percentage point ... [D]."',
    notes: 'readout: threshold for days-to-converge on the product card, not a world mechanic.',
  }),
  inl('productView.TAU_DAYS', 'productView.ts', 'const TAU_DAYS = { consumer: CUSTOMER_TAU.consumer * 365,', [21.0577, 237.25, 273.75], 'days', {
    ...W, kind: 'derived', evidence: 'productView.ts:167 "TAU_DAYS = { consumer: CUSTOMER_TAU.consumer * 365, ... }" (computed from CUSTOMER_TAU)',
    notes: 'Array order = consumer, sector, gov. Customer-stock time constants in days; CUSTOMER_TAU itself is registered in the market chunk.',
  }),
  exp('DEFENCE_TECHS.bio', 'readouts.ts', 'DEFENCE_TECHS', ['bio', 0, 1], 0.6, 'weight', {
    ...W, kind: 'designer',
    evidence: 'readouts.ts:210-211 "Weight of each defensive technology\'s impact ramp in the defence index [D]"',
    notes: 'W06 (antibiotics, antivirals) weight in the bio defence index.',
  }),
  exp('DEFENCE_TECHS.cyber', 'readouts.ts', 'DEFENCE_TECHS', ['cyber', 0, 1], 0.6, 'weight', {
    ...W, kind: 'designer',
    evidence: 'readouts.ts:210-211 "Weight of each defensive technology\'s impact ramp in the defence index [D]"',
    notes: 'W24 (autonomous cyber defense) weight in the cyber defence index.',
  }),

  // ---------------------------------------------------------------- robots.ts (named)
  exp('ROBOT.stock0', 'robots.ts', 'ROBOT', ['stock0'], 1.5e6, 'HWE', {
    ...W, kind: 'designer',
    evidence: 'robots.ts:3-4 "Industrial robots ≈ 0.3 HWE each [D]; ≈5M operational at end-2025 (IFR 2026 [V]) → ≈1.5M HWE"',
    source: 'IFR 2026 (about 5M operational industrial robots) x 0.3 HWE each [D]',
    notes: 'Literal; the comment derives it from a sourced robot count (IFR) times a designer 0.3 HWE factor, so the code adds a designer number (A1b).',
  }),
  exp('ROBOT.conventional0', 'robots.ts', 'ROBOT', ['conventional0'], 0.2e6, 'HWE/yr', {
    ...W, kind: 'sourced',
    evidence: 'robots.ts:5 "conventional production ≈ 0.2M HWE/yr (2025: 570k arms, 81k quadrupeds at 0.3 HWE) [F Epoch 2026]"',
    source: 'Epoch 2026 (570k arms, 81k quadrupeds in 2025), as named at robots.ts:5',
  }),
  exp('ROBOT.humanoid0', 'robots.ts', 'ROBOT', ['humanoid0'], 16e3, 'units/yr', {
    ...W, kind: 'sourced', evidence: 'robots.ts:7 "humanoids ≈16k/yr doubling every 6 months [F Epoch]"', source: 'Epoch (humanoid production), as named at robots.ts:7',
  }),
  exp('ROBOT.humanoidDoublingYears', 'robots.ts', 'ROBOT', ['humanoidDoublingYears'], 0.5, 'years', {
    ...W, kind: 'sourced', evidence: 'robots.ts:7 "humanoids ≈16k/yr doubling every 6 months [F Epoch]"', source: 'Epoch (humanoid production), as named at robots.ts:7',
  }),
  exp('ROBOT.baseDoublingYears', 'robots.ts', 'ROBOT', ['baseDoublingYears'], 6, 'years', {
    ...W, kind: 'sourced',
    evidence: 'robots.ts:5-6 "T_dbl 6 y (Davidson & Hadshar: the last stock doubling took ≈6 years [F])"',
    source: 'Davidson & Hadshar (robot stock doubling time), as named at robots.ts:6',
  }),
  exp('ROBOT.usShare0', 'robots.ts', 'ROBOT', ['usShare0'], 0.08, 'fraction', {
    ...W, kind: 'designer',
    evidence: 'robots.ts:23 "US share of installed industrial robots (IFR: ≈6–8% of installs) [D]"',
    range: { lo: 0.06, hi: 0.08, from: 'robots.ts:23 "IFR: ≈6–8% of installs"' },
  }),
  exp('ROBOT.depreciationYears', 'robots.ts', 'ROBOT', ['depreciationYears'], 15, 'years', {
    ...W, kind: 'untagged', evidence: 'no tag; robots.ts:24',
  }),
  exp('ROBOT.sezOpenRate', 'robots.ts', 'ROBOT', ['sezOpenRate'], 1.2e6, 'HWE/yr', {
    ...W, kind: 'sourced', evidence: 'robots.ts:9 "SEZ car-plant conversion: ≈100k/month on opening, rising to ≈1M/month within about a year [A27]"; :25 "(100k/month)"',
    source: 'AI 2027 (A27), as named at robots.ts:9',
  }),
  exp('ROBOT.sezRampPerYear', 'robots.ts', 'ROBOT', ['sezRampPerYear'], 10.8e6, 'HWE/yr per year', {
    ...W, kind: 'sourced', evidence: 'robots.ts:9 "...rising to ≈1M/month within about a year [A27]"; :26 "→ 1M/month after a year"',
    source: 'AI 2027 (A27), as named at robots.ts:9',
  }),
  exp('ROBOT.sezRampYears', 'robots.ts', 'ROBOT', ['sezRampYears'], 1.5, 'years', {
    ...W, kind: 'untagged', evidence: 'no tag; robots.ts:27 (the [A27] text at :9 says "about a year", the value is 1.5)',
    notes: 'See Q-worldfx-3.',
  }),

  // ---------------------------------------------------------------- sectors.ts (named)
  exp('ALPHA_MID_L', 'sectors.ts', 'ALPHA_MID_L', [], 8, 'display level', {
    ...W, kind: 'untagged',
    evidence: 'no tag; sectors.ts:61-63 "Midpoint and spread are v2\'s L 8 and 1.5 L converted through the one λ" (a restatement of an earlier v2 value, no source)',
    notes: 'Midpoint of the substitution alpha sigmoid on AGENCY G; also the L 8 reference of the q boost (sectors.ts:256).',
  }),
  exp('ALPHA_SPREAD_L', 'sectors.ts', 'ALPHA_SPREAD_L', [], 1.5, 'display levels', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:61-63 (same comment as ALPHA_MID_L)',
  }),
  inl('sectors.FRIEND_SOCIAL_MID', 'sectors.ts', 'const FRIEND_SOCIAL_MID = 6.5;', 6.5, 'display level', {
    ...W, kind: 'fitted', fit: { targets: [], script: 'manual' },
    evidence: 'sectors.ts:82-85 "Consumer SOCIAL level at which the AI-friend share is half its ceiling (research/16 §2.1) [D]. M2: 7 → 6.5 on integrated RefBot play"',
    notes: 'A5: comment "M2: 7 -> 6.5 on integrated RefBot play" (tuned to an outcome); tag was [D].',
  }),
  exp('HIRE_TAU', 'sectors.ts', 'HIRE_TAU', [], 0.05, 'years', {
    ...W, kind: 'designer', evidence: 'sectors.ts:88 "Hiring-rate adjustment time (years) [D, M4]."',
  }),
  inl('sectors.K_START', 'sectors.ts', 'const K_START = 0.8;', 0.8, 'fraction', {
    ...W, kind: 'designer', evidence: 'sectors.ts:118 "Start value of the cost gate and of the buyer\'s cost per AI work-hour (share of the wage), before the first tick [D]."',
  }),
  inl('sectors.PCOST_START', 'sectors.ts', 'const PCOST_START = 0.3;', 0.3, 'share of wage', {
    ...W, kind: 'designer', evidence: 'sectors.ts:118 "Start value of the cost gate and of the buyer\'s cost per AI work-hour (share of the wage), before the first tick [D]."',
  }),

  // ---------------------------------------------------------------- serving.ts / techtree.ts (named)
  inl('serving.CHAT_OFFER_TOKENS.input', 'serving.ts', 'const CHAT_OFFER_TOKENS: TokenProfile = { input: 3e3, output: 8e2 };', 3e3, 'tokens', {
    ...W, kind: 'untagged', evidence: 'no tag; serving.ts:285',
    notes: 'Token profile of one consumer-chat offer. Output field is wfx.serving.CHAT_OFFER_TOKENS.output (same anchor).',
  }),
  inl('serving.CHAT_OFFER_TOKENS.output', 'serving.ts', 'const CHAT_OFFER_TOKENS: TokenProfile = { input: 3e3, output: 8e2 };', 8e2, 'tokens', {
    ...W, kind: 'untagged', evidence: 'no tag; serving.ts:285',
  }),
  exp('MOONSHOT_K', 'techtree.ts', 'MOONSHOT_K', [], 10, 'x', {
    ...W, kind: 'designer', evidence: 'techtree.ts:24 "S_player = M_sci(internal)·share·MOONSHOT_K (10% of compute at internal L_sci 12 ≈ +6 S). [D]"',
  }),

  // ================================================================ notable inline literals (cap 40)
  // ---- macro.ts

  // ---- control.ts
  inl('control.internalOpsCoef', 'control.ts', "0.15 * levelGate(w, ivAg, 10, 1)", 0.15, 'INFRA penetration target', {
    ...W, kind: 'untagged', evidence: 'no tag; control.ts:175',
  }),
  inl('control.govAdviserTargetCoef', 'control.ts', "0.35 * v2LevelGate(w, 'REASON', govAdv, 12, 1)", 0.35, 'GOV penetration target', {
    ...W, kind: 'designer', evidence: 'control.ts:189 "Officials adopt superhuman advisers (AI 2027 Dec 2027: Cabinet talks to the model \\"for hours a day\\") [D]."',
  }),
  inl('control.tierMixRate', 'control.ts', 'c.tiers[k] += (tgt[k] - c.tiers[k]) * 2 * dt', 2, '1/yr', {
    ...W, kind: 'untagged', evidence: 'no tag; control.ts:218',
  }),
  inl('control.robotsHighShare', 'control.ts', 'const robotsHigh = s.world.robots.stockHWE * s.world.fx.robotUS > 0.1 * 170e6;', 0.1, 'share of labor (170M workers)', {
    ...W, kind: 'untagged', evidence: 'no tag; control.ts:5 header "robots > 10% of labor"; code :64',
  }),

  // ---- sectors.ts
  inl('sectors.qAgencyBoost', 'sectors.ts', '(1 + (0.15 / oomPerLevel(w, ALPHA_MID_L))', 0.15, 'q per AGENCY level above L 8', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:253 "v2\'s +0.15 per AGENCY level above 8, per OOM of AGENCY G above λ⁻¹(8)"',
  }),
  inl('sectors.decayRate', 'sectors.ts', 'else st.A -= 0.5 * (st.A - st.Astar) * dt;', 0.5, '1/yr', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:12 header "A* < A → decays at 0.5/yr"; code :263',
    notes: 'The worker-use stock W decays at the same 0.5 (sectors.ts:268).',
  }),
  inl('sectors.openJobsBase', 'sectors.ts', 'const openJobs = 0.4 * (1 - 0.6 * (Dw / Math.max(1, Ew)))', 0.4, 'open jobs per year', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:312',
    notes: 'The 0.6 (share of displaced workers that closes openings) and the 5 on nuEff·gAI are in the same expression.',
  }),
  inl('sectors.reemploymentRate', 'sectors.ts', 'const rRe = 2.0 * mismatch', 2.0, 'x', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:314',
    notes: 'Re-employment rate multiplier of the displaced pool.',
  }),
  inl('sectors.laborForceExit', 'sectors.ts', 'const exit = 0.25 * (pol.ubi', 0.25, '1/yr', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:315; header sectors.ts:23 "exit 0.25/yr (×3 with UBI)"',
  }),
  inl('sectors.retrainPer10B', 'sectors.ts', '(0.1 * s.player.policies.transitionFund) / 10', 0.1, 'Retrain per $10B/yr', {
    ...W, kind: 'sourced', evidence: 'sectors.ts:227 "Player transition-fund + government training → Retrain (each $10B/yr +0.1, cap +0.5; R16 §1A.2 step 9)"',
    source: 'research/16 §1A.2 step 9', notes: 'Cap 0.5 and jobTraining +0.2 are in the same expression.',
  }),
  inl('sectors.friendCeiling', 'sectors.ts', 'const friendStar = 0.03 + 0.18 * v2LevelGate(', 0.18, 'share of adults', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:382 (the start value 0.03 at :215 is "[D, R16 N3a]")',
    notes: 'AI-friend share ceiling above the 0.03 floor; sibling of the start value friendShare 0.03.',
  }),
  inl('sectors.friendShareStart', 'sectors.ts', 'friendShare: 0.03, // ≈3% of adults [D, R16 N3a]', 0.03, 'share of adults', {
    ...W, kind: 'designer', source: 'research/16 N3a', evidence: 'sectors.ts:215 "≈3% of adults [D, R16 N3a]"',
    notes: 'A2: [D, R16 N3a] is designer with the pointer in source. Also the floor of friendStar.',
  }),
  inl('sectors.sezFrictionCut', 'sectors.ts', "(id === 'MFG' || id === 'LOG' || id === 'ENGY')) R *= 0.3;", 0.3, 'x friction', {
    ...W, kind: 'untagged', evidence: 'no tag; sectors.ts:110; policy.ts:17 says "SEZ friction waiver"',
  }),

  // ---- techtree.ts
  inl('techtree.expCapBase', 'techtree.ts', 'Math.min(1, 0.4 + 0.3 * techRamp(s, \'W04\')', 0.4, 'fraction', {
    ...W, kind: 'untagged', evidence: 'no tag; techtree.ts:10 "ExpCap = min(1, 0.4 + 0.3·[W04 autonomous labs] + 0.3·RobotAvail_SCI)"; header cites R16 §3.1',
    notes: 'The two 0.3 weights are in the same expression.',
  }),
  inl('techtree.fastTrackLag', 'techtree.ts', 'if (pol.fdaFastTrack) lag *= 0.5;', 0.5, 'x lag', {
    ...W, kind: 'untagged', evidence: 'no tag; techtree.ts:98',
  }),
  inl('techtree.sezPhysicalLag', 'techtree.ts', 'lag *= 0.3;', 0.3, 'x lag', {
    ...W, kind: 'untagged', evidence: 'no tag; techtree.ts:101',
  }),
  inl('techtree.rampSteepness', 'techtree.ts', 'sigmoid(10 * (yrs / lag - 0.5))', 10, 'logistic steepness', {
    ...W, kind: 'untagged', evidence: 'no tag; techtree.ts:156; header :12 "Impact ramps as a logistic over Lag years after discovery"',
  }),
  inl('techtree.discoveryApproval', 'techtree.ts', "ctx.bump('pub.approval', 0.3 * t.effects.benefit,", 0.3, 'approval per unit benefit', {
    ...W, kind: 'untagged', evidence: 'no tag; techtree.ts:148 (a comment in actions.ts:114-115 restates it as "+0.3·benefit on discovery")',
    notes: 'Patients-reached approval 0.5 x benefit (techtree.ts:157) is the sibling.',
  }),

  // ---- robots.ts
  inl('robots.humanoidHweBase', 'robots.ts', 'const humanoidHWE = (s: GameStateV2) => 0.3 + 0.7 * techRamp', 0.3, 'HWE per humanoid', {
    ...W, kind: 'designer', evidence: 'robots.ts:51 "HWE value of a humanoid: limited before general robotics, a full worker after it [D]."',
    notes: 'Rises to 1.0 with the W16 ramp (the 0.7).',
  }),
  inl('robots.humanoidCapW16', 'robots.ts', 'techRamp(s, \'W16\') > 0.5 ? 10e6', 10e6, 'units/yr', {
    ...W, kind: 'sourced', evidence: 'robots.ts:94 "After general robotics the reducer cap lifts to ≈10M/yr (Epoch: 5–10M plausible by 2030)"',
    source: 'Epoch (humanoid production outlook), as named at robots.ts:94',
    range: { lo: 5e6, hi: 10e6, from: 'robots.ts:94 "Epoch: 5–10M plausible by 2030"' },
  }),
  inl('robots.humanoidCapReality', 'robots.ts', "s.setup.baseline === 'reality' ? 0.5e6", 0.5e6, 'units/yr', {
    ...W, kind: 'sourced', evidence: 'robots.ts:7-8 "reducers cap them at ≈500k/yr in Reality-Updated until W16 (general robotics) lifts it [F Epoch]"',
    source: 'Epoch (humanoid reducer supply), as named at robots.ts:7-8', perPreset: true,
  }),
  inl('robots.humanoidCapClassic', 'robots.ts', '0.5e6 : 3e6;', 3e6, 'units/yr', {
    ...W, kind: 'designer', evidence: 'robots.ts:8 "elsewhere 3M/yr (Epoch \\"1.5–3M clearly achievable\\") [D]"',
    range: { lo: 1.5e6, hi: 3e6, from: 'robots.ts:8 Epoch "1.5–3M clearly achievable"' }, perPreset: true,
  }),

  // ---- mix.ts / serving.ts / actions.ts
  inl('mix.brandApprovalSwing', 'mix.ts', '1 + 0.1 * Math.max(-1, Math.min(1, s.pub.approval / 50))', 0.1, 'brand multiplier swing', {
    ...W, actor: 'player', kind: 'designer', source: 'V2-SPEC §3.11.1', evidence: 'no tag; mix.ts:318 "±0.1 with approval (§3.11.1)" (a spec section pointer, not a source)',
    notes: 'A8c: spec §3.11.1 states "moves ±0.1 with approval". Approval 50 gives the full swing.',
  }),
  inl('mix.chinaOpenAccessUS', 'mix.ts', '(r === \'US\' ? 0.3 : 0.7)', 0.3, 'fraction of buyers who can use', {
    ...W, actor: 'china', kind: 'untagged', evidence: 'no tag; mix.ts:313',
    notes: 'Access to DeepCent open weights in the US (0.3) and ROW (0.7); closed models 0.05 US / 0.4 ROW; non-China labs in China 0.6 open / 0.05 closed (mix.ts:314).',
  }),
  inl('mix.chinaClosedAccessUS', 'mix.ts', 'r === \'US\' ? 0.05 : 0.4;', 0.05, 'fraction of buyers who can use', {
    ...W, actor: 'china', kind: 'untagged', evidence: 'no tag; mix.ts:313',
  }),
  inl('serving.preLlmLevelSpan', 'serving.ts', 'const g = g0 - 0.4 * (w.v3.gSC - g0);', 0.4, 'fraction of the V0 to SC span', {
    ...W, kind: 'untagged', evidence: 'no tag; serving.ts:127-128 "a model 2 display levels under V0 (0.4 of the V0 → SC span), the hiring baseline ΔF of research/16 step 8"',
  }),
  inl('serving.verifiabilityRef', 'serving.ts', 'COVER.kappaV * (0.9 - v)', 0.9, 'verifiability', {
    ...W, kind: 'untagged', evidence: 'no tag; serving.ts:112',
    notes: 'Reference verifiability in the sector coverage threshold; kappaV is data (market chunk).',
  }),
  inl('actions.transitionFundApproval', 'actions.ts', "ctx.bump('pub.approval', Math.min(5, d * 0.4), 'transition fund');", 0.4, 'approval per $B/yr', {
    ...W, actor: 'public', kind: 'untagged', evidence: 'no tag; actions.ts:62; doc comment :14-16 cites research/16 §1A.2 step 9 and research/07 for the fund, not these effects',
    notes: 'The preview (actions.ts:33) repeats the numbers; the 5 cap, the 0.5 jobAnxiety relief (:63) and labor trust 0.6 (:64) are siblings.',
  }),
  inl('actions.transitionFundLaborTrust', 'actions.ts', "ctx.bump('trust:bloc:labor', Math.min(8, d * 0.6), 'transition fund');", 0.6, 'trust per $B/yr', {
    ...W, actor: 'public', kind: 'untagged', evidence: 'no tag; actions.ts:64',
  }),
  inl('actions.moonshotRiskScrutiny', 'actions.ts', "{ currency: 'scrutiny', amount: 5, probability: 0.5, lagDays: 180 }", 5, 'scrutiny', {
    ...W, actor: 'player', kind: 'untagged', evidence: 'no tag; actions.ts:129 (dual-use exposure of a risk technology)',
    notes: 'Probability 0.5 and the China tension 3 at p 0.3 are siblings.',
  }),
]);
