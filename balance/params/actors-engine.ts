// B3 inventory: actors engine (src/engine/v2/actors/*): rivals, China, government, public, intel, relations, rival model.
// Prefix `act`. Named constants first (exports, then non-exported ones as inline refs: an export ref needs an export),
// then notable inline literals (the last block, capped at 40; the rest are listed in design/bal/inv/actors-engine-notes.md).
import { defineParams } from '../schema';

const RIVALS = 'src/engine/v2/actors/rivals.ts';
const RMODEL = 'src/engine/v2/npc/market.ts';
const CHINA = 'src/engine/v2/actors/china.ts';
const GOV = 'src/engine/v2/actors/gov.ts';
const PUBLIC = 'src/engine/v2/actors/public.ts';
const INTEL = 'src/engine/v2/actors/intel.ts';
const REL = 'src/engine/v2/actors/relations.ts';
const BLOCS = 'src/engine/v2/actors/blocs.ts';
const RB = 'src/engine/v2/actors/researchBodies.ts';
const IDX = 'src/engine/v2/actors/index.ts';
const TUNING = 'src/engine/v2/actors/tuning.ts';

export const PARAMS_ACTORS_ENGINE = defineParams([
  // ───────────────────────── named constants: exported ─────────────────────────
  // FIN: one entry per field family (archetype table; the per-archetype values differ in meaning of size, not of field).
  {
    id: 'act.FIN.cash',
    ref: { kind: 'export', module: RIVALS, symbol: 'FIN', path: ['*', 'cash'] },
    unit: 'USD B', area: 'actors', layer: 'world', actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; rivals.ts:43-52 "Start finance by archetype" (only `raised` carries [R21, approx.]; leader row cites STRUCTURE §4.8)',
    notes: 'Start cash per archetype (safety, bigtech, maverick, openweights, upstart, leader).',
  },
  {
    id: 'act.FIN.revenueRun',
    ref: { kind: 'export', module: RIVALS, symbol: 'FIN', path: ['*', 'revenueRun'] },
    unit: 'USD B/yr', area: 'actors', layer: 'world', actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; rivals.ts:47-52',
    notes: 'Start revenue run-rate per archetype; leader row cites "STRUCTURE §4.8 table" (rivals.ts:52).',
  },
  {
    id: 'act.FIN.valuation',
    ref: { kind: 'export', module: RIVALS, symbol: 'FIN', path: ['*', 'valuation'] },
    unit: 'USD B', area: 'actors', layer: 'world', actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; rivals.ts:43-45 "`valuation` > 0 marks a private lab (FIN5b: marked from the story split at the start)"',
    notes: '0 = not a private lab (parent-funded or open).',
  },
  {
    id: 'act.FIN.raised',
    ref: { kind: 'export', module: RIVALS, symbol: 'FIN', path: ['*', 'raised'] },
    unit: 'USD B', area: 'actors', layer: 'world', actor: 'rivals', kind: 'sourced',
    evidence: 'rivals.ts:44-45 "`raised` = equity its investors had put in by mid-2025 (Anthropic ≈ $15B, xAI ≈ $22B, SSI $3B, OpenAI ≈ $60B ...) [R21, approx.]"',
    source: 'R21 (approximate, as stated in rivals.ts:45)',
  },
  {
    id: 'act.RIVAL_REVENUE_TRACK',
    ref: { kind: 'export', module: RIVALS, symbol: 'RIVAL_REVENUE_TRACK' },
    value: 0.5,
    unit: 'fraction per quarter', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'rivals.ts:469 "Share of the gap to market revenue a rival closes each quarter [D, M4]."',
  },
  {
    id: 'act.WS4_TUNING.leakK',
    ref: { kind: 'export', module: TUNING, symbol: 'WS4_TUNING', path: ['leakK'] },
    value: 0.0003,
    unit: 'per spy per day', area: 'actors', layer: 'world', actor: 'china', kind: 'fitted',
    evidence: 'tuning.ts:4-9 "Secrets-leak coefficient per spy ... [fit, T3] M2 step 5: 1e-5 → 3e-4"',
    fit: { targets: [], script: 'unnamed' },
    notes: 'T3: lead stays 150-200 d until the theft (R11 #16c); no script named in the comment.',
  },
  {
    id: 'act.WS4_TUNING.distillK',
    ref: { kind: 'export', module: TUNING, symbol: 'WS4_TUNING', path: ['distillK'] },
    value: 0.00006,
    unit: 'per day', area: 'actors', layer: 'world', actor: 'china', kind: 'fitted',
    evidence: 'tuning.ts:10 "Distillation: daily share of the gap to the best US public model China recovers at access 60. [fit, T3]"',
    fit: { targets: [], script: 'unnamed' },
    notes: 'T3 (China lead / gap behaviour); no script named in the comment.',
  },
  {
    id: 'act.WS4_TUNING.theftMinRung',
    ref: { kind: 'export', module: TUNING, symbol: 'WS4_TUNING', path: ['theftMinRung'] },
    value: 2,
    unit: 'rung', area: 'actors', layer: 'policy', actor: 'china', kind: 'designer',
    evidence: 'tuning.ts:11-13 "China attempts weight theft only from this posture rung (R10 §1.4 rung 2 ...). [D] deviation from §3.6"',
  },
  {
    id: 'act.RUNG_TRUST',
    ref: { kind: 'export', module: REL, symbol: 'RUNG_TRUST' },
    value: [0, 25, 45, 65, 80],
    unit: 'trust points', area: 'actors', layer: 'world', kind: 'designer', source: 'V2-SPEC §3.9.1',
    evidence: 'no tag; relations.ts:23 "Access-rung trust thresholds (rungs 1..4) (§3.9.1)."',
    notes: 'A8c: spec states 25 / 45 / 65 / 80 for rungs 1..4. Index = access rung 0..4.',
  },
  {
    id: 'act.RIVAL_DISTILL_LAG_DAYS',
    ref: { kind: 'export', module: RMODEL, symbol: 'RIVAL_DISTILL_LAG_DAYS' },
    value: 152,
    unit: 'days', area: 'actors', layer: 'world', actor: 'rivals', kind: 'stand-in',
    evidence: 'npc/market.ts (was rivalModel.ts:817-819) "RD-P02 [D]: days from a release to its distilled students on sale ... a stated stand-in for the distill run\'s length and the release work (DD-18)"',
    notes: 'Haiku 4.5 matched Sonnet 4 five months after it (design/V3-TASKS.md TIERS2).',
  },
  {
    id: 'act.RIVAL_LINEUP_MAX',
    ref: { kind: 'export', module: RMODEL, symbol: 'RIVAL_LINEUP_MAX' },
    value: 6,
    unit: 'models', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'designer',
    evidence: 'npc/market.ts (was rivalModel.ts:822-824) "RD-P02 [D]: the most models a rival lineup keeps besides its public model ... pricing pages list 4–6 current text models"',
    range: { lo: 4, hi: 6, from: 'rivalModel.ts:823-824 "the labs\' pricing pages list 4–6 current text models"' },
  },

  // ───────────────────────── named constants: not exported (inline refs on the declaration) ─────────────────────────
  {
    id: 'act.MISUSE_FROM_OOM',
    ref: { kind: 'inline', file: RIVALS, anchor: 'const MISUSE_FROM_OOM = 1.0;' },
    value: 1,
    unit: 'OOM above V0', area: 'actors', layer: 'world', actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; rivals.ts:63-64 "RD-L05: rival misuse hazard grows from MISUSE_FROM_OOM above V0 ..."',
  },
  {
    id: 'act.MISUSE_PER_OOM',
    ref: { kind: 'inline', file: RIVALS, anchor: 'const MISUSE_PER_OOM = 2e-4;' },
    value: 0.0002,
    unit: 'hazard per OOM per day', area: 'actors', layer: 'world', actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; rivals.ts:63-64 "... at MISUSE_PER_OOM per OOM per day (was 1e-4 per display level from L 7 ...)"',
  },
  {
    id: 'act.MISUSE_SHOCK_DAYS',
    ref: { kind: 'inline', file: GOV, anchor: 'const MISUSE_SHOCK_DAYS = 180;' },
    value: 180,
    unit: 'days', area: 'actors', layer: 'world', actor: 'gov', kind: 'designer',
    evidence: 'gov.ts:248 "Days a severity-5 misuse incident (player via WS2\'s stamp, or a rival) keeps the economy in shock [D]."',
  },
  {
    // Flattened [lo, hi] pairs in key order conditional, allAdopt, unconditional, override, state.
    id: 'act.PRIOR_BAND',
    ref: { kind: 'inline', file: INTEL, anchor: 'const PRIOR_BAND: Record<string, [number, number]> = {' },
    value: [0.08, 0.45, 0.12, 0.5, 0.15, 0.6, 0.2, 0.7, 0.15, 0.65],
    unit: 'misalignment (0..1)', area: 'actors', layer: 'world', actor: 'player', kind: 'untagged',
    evidence: 'no tag; intel.ts:24 "Prior misalignment band by visible clause type (research/17 §1.6.4: the framework is the main observable)."',
    notes: 'readout (A10). Flattened lo,hi pairs in key order conditional, allAdopt, unconditional, override, state.',
  },
  {
    id: 'act.GOV_SCORE',
    ref: { kind: 'inline', file: IDX, anchor: 'const GOV_SCORE: Record<string, number> = {' },
    value: [0.65, 0.75, 0.6, 0.3, 0.45],
    unit: 'score 0..1', area: 'actors', layer: 'world', actor: 'player', kind: 'designer', source: 'index.ts:21 (R9)',
    evidence: 'index.ts:21 "// R9 parent: a corporate division with a responsibility council but no independent safety board (GDM: C−) [D]." sits above the table but names only the `parent` entry',
    notes: 'A9: the [D] comment above the table covers all five boards. Key order legacyNonprofit, nonprofitPBC, pbcTrust, founder, parent.',
  },

  // ───────────────────────── notable inline literals (40) ─────────────────────────
  // china.ts
  {
    id: 'act.china.deepCentComputeShare',
    ref: { kind: 'inline', file: CHINA, anchor: '(0.4 + 0.5 * Math.min(1, m.centralization / 75))' },
    value: [0.4, 0.5, 75],
    unit: 'fraction', area: 'actors', layer: 'world', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:23-25 "China\'s accessible compute × its AGI share (AI 2027 compute forecast: 40% → 90% as the collective centralizes, research/11 #16)"',
    source: 'research/11 #16 (AI 2027 compute forecast)',
    notes: 'AGI share = 0.4 + 0.5 min(1, centralization/75): 40% rising to 90%. The R&D share 0.6 on the same line is untagged (overflow).',
  },
  {
    id: 'act.china.computeGrowth',
    ref: { kind: 'inline', file: CHINA, anchor: 'const g = Math.pow(2, 1 / 365) - 1;' },
    value: 2,
    unit: 'x per year', area: 'actors', layer: 'world', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:140 "Compute ≈ ×2/yr (IFP), slower under strict export policy; centralization pools it for DeepCent (R11 #16b)."',
    source: 'IFP (named in china.ts:140); R11 #16b',
  },
  {
    id: 'act.china.exportPolicyComputeFactor',
    ref: { kind: 'inline', file: CHINA, anchor: "s.market.exportPolicy === 'strict' ? 0.8 : s.market.exportPolicy === 'open' ? 1.1 : 1" },
    value: [0.8, 1.1],
    unit: 'multiplier on compute growth', area: 'actors', layer: 'world', actor: 'china', kind: 'untagged',
    evidence: 'no tag; china.ts:142 (strict 0.8, open 1.1)',
  },
  {
    id: 'act.china.theftIntentTarget',
    ref: { kind: 'inline', file: CHINA, anchor: '20 * pp.theft + (c.rung >= 2 ? 10 : 0) + (c.rung >= 4 ? 30 : 0)' },
    value: [20, 10, 30],
    unit: 'meter 0..100', area: 'actors', layer: 'policy', actor: 'china', kind: 'untagged',
    evidence: 'no tag; china.ts:156 (base 20 × preset theft, +10 at rung 2, +30 at rung 4)',
  },
  {
    id: 'act.china.ladderClimbDays',
    ref: { kind: 'inline', file: CHINA, anchor: 'if (c.holdDays[k] >= 14) {' },
    value: 14,
    unit: 'days', area: 'actors', layer: 'policy', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:164 "Posture ladder (research/10 §1.4): climb after 14 d, descend after 60 d false (rungs 5–6 sticky)."',
    source: 'research/10 §1.4',
  },
  {
    id: 'act.china.ladderDescendDays',
    ref: { kind: 'inline', file: CHINA, anchor: 'if (c.holdDays[kd] >= 60) {' },
    value: 60,
    unit: 'days', area: 'actors', layer: 'policy', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:164 "Posture ladder (research/10 §1.4): climb after 14 d, descend after 60 d false (rungs 5–6 sticky)."',
    source: 'research/10 §1.4',
  },
  {
    id: 'act.china.deescalationDays',
    ref: { kind: 'inline', file: CHINA, anchor: 'if (c.holdDays[kk] >= 30) {' },
    value: 30,
    unit: 'days', area: 'actors', layer: 'policy', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:200 "De-escalation track D1–D5 (research/10 §1.4), climbed when conditions hold."',
    source: 'research/10 §1.4',
    notes: 'Hold days per de-escalation step; the 30 itself is not stated in the comment.',
  },
  {
    id: 'act.china.centralizationRoll',
    ref: { kind: 'inline', file: CHINA, anchor: 'usGapMonths(s) > 9 && widening && s.flags.seenMilestone1 !== undefined && r.chance(0.5 * pp.centralize)' },
    value: [9, 0.5],
    unit: 'months; probability per quarter', area: 'actors', layer: 'policy', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:270 "Centralization (R7): gap > 9 months and widening for 90+ days, player past the first agent milestone."',
    source: 'R7 (as cited in china.ts:270)',
    notes: 'The 0.5 roll probability is not stated in the comment.',
  },
  {
    id: 'act.china.taiwanLadderHazard',
    ref: { kind: 'inline', file: CHINA, anchor: '(c.rung >= 5 ? 0.15 : 0), 0, 0.5)' },
    value: [0.15, 0.5],
    unit: 'probability per quarter', area: 'actors', layer: 'world', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:288-290 "disruption roll (quarterly) = WS3\'s R15 hazard ... plus the ladder (research/10 R9, rung 5)"',
    source: 'research/10 R9 (rung 5)',
    notes: '+0.15 added at China rung >= 5; 0.5 caps the quarterly probability.',
  },
  {
    id: 'act.china.reweightBargainer',
    ref: { kind: 'inline', file: CHINA, anchor: "mul('bargainer', 2.5)" },
    value: 2.5,
    unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china', kind: 'sourced',
    evidence: 'china.ts:232 "Quarterly preset re-weighting (research/10 §1.2 drift rules)."',
    source: 'research/10 §1.2',
    notes: 'One of several reweight multipliers (nationalizer 1.3, gambler 1.15, fastfollower 0.85, selfreliant 1.3, diffuser 1.5).',
  },
  // gov.ts
  {
    id: 'act.gov.aiPriorityTarget',
    ref: { kind: 'inline', file: GOV, anchor: '55 + 14 * Math.max(0, seenOom) + 10 * detectedThefts(s)' },
    value: [55, 14, 10],
    unit: 'meter 0..100', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:113 (base 55, +14 per seen OOM, +10 per detected theft)',
  },
  {
    id: 'act.gov.securityDemandTarget',
    ref: { kind: 'inline', file: GOV, anchor: '15 + 18 * Math.max(0, seenOom - 0.25) + 15 * detectedThefts(s) + 5 * g.rungChn + (seesSC ? 20 : 0)' },
    value: [15, 18, 0.25, 15, 5, 20],
    unit: 'meter 0..100', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:115-117 "Security demand: rises with seen capability, thefts and the China ladder"',
  },
  {
    id: 'act.gov.secLadderHold',
    ref: { kind: 'inline', file: GOV, anchor: 'Math.max(7, Math.round(pre.lag * 0.7))' },
    value: [7, 0.7],
    unit: 'days', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:143 (hold days = max(7, 0.7 x the preset lag))',
  },
  {
    id: 'act.gov.secRung1Priority',
    ref: { kind: 'inline', file: GOV, anchor: 'govSeesMilestone(s, 1) && g.aiPriority > 60' },
    value: 60,
    unit: 'meter', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:137 "RD-L05: Reliable agent (was seenL ≥ 6.5)"',
  },
  {
    id: 'act.gov.chnRung1Thresholds',
    ref: { kind: 'inline', file: GOV, anchor: 'chinaLead < 120 || g.hawkishness > 60' },
    value: [120, 60],
    unit: 'days; meter', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:162 (G-CHN rung 1: estimated China lead under 120 d or hawkishness above 60)',
  },
  {
    id: 'act.gov.federalLicensingChance',
    ref: { kind: 'inline', file: GOV, anchor: 'if (!veto && r.chance(0.3)) {' },
    value: 0.3,
    unit: 'probability per month', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:218-222 "Federal licensing: Congress activism ≥ 70 and positive pressure → floor fight; presidential veto unless ..."',
  },
  {
    id: 'act.gov.regStanceTarget',
    ref: { kind: 'inline', file: GOV, anchor: 'const target = clamp(-60 + 0.3 * net * pre.reg, -100, 100);' },
    value: [-60, 0.3],
    unit: 'meter -100..100', area: 'actors', layer: 'policy', actor: 'gov', kind: 'untagged',
    evidence: 'no tag; gov.ts:228 "Reg stance follows net bloc pressure on evals/licensing vs preemption."',
  },
  {
    id: 'act.gov.paymentsTrigger',
    ref: { kind: 'inline', file: GOV, anchor: 'p.jobAnxiety > 85 || dU > 2' },
    value: [85, 2],
    unit: 'meter; points of unemployment', area: 'actors', layer: 'policy', actor: 'gov', kind: 'sourced',
    evidence: 'gov.ts:272 "R07: JobAnxiety > 85 or an unemployment shock > 2 pts → COVID-style payments"',
    source: 'R07 (as cited in gov.ts:272)',
  },
  {
    id: 'act.gov.paymentsSize',
    ref: { kind: 'inline', file: GOV, anchor: 'clamp(0.5 * (s.world.unemployment.US - 4.3), 1, 5)' },
    value: [0.5, 4.3, 1, 5],
    unit: '% of GDP', area: 'actors', layer: 'world', actor: 'gov', kind: 'designer',
    evidence: 'gov.ts:272-273 "size [D] 0.5% of GDP per point of unemployment above 4.3%, 1–5% (CARES-scale at the top)"',
    range: { lo: 1, hi: 5, from: 'gov.ts:273 "1–5% (CARES-scale at the top)"' },
  },
  {
    id: 'act.gov.ubiAfterDays',
    ref: { kind: 'inline', file: GOV, anchor: "day - flagNumOr(s, 'ws4:transfersSince', day) >= 182" },
    value: 182,
    unit: 'days', area: 'actors', layer: 'policy', actor: 'gov', kind: 'designer',
    evidence: 'gov.ts:288-289 "payments for 6 months [D] with anxiety still > 85 → UBI. Sticky [D]"',
  },
  {
    id: 'act.gov.outputShocks',
    ref: { kind: 'inline', file: GOV, anchor: '(w.taiwanDisrupted ? 0.03 : 0) + (s.china.rung >= 6 ? 0.05 : 0) + (sev5 ? 0.02 : 0)' },
    value: [0.03, 0.05, 0.02],
    unit: 'growth penalty per year', area: 'actors', layer: 'world', kind: 'designer',
    evidence: 'gov.ts:344-345 "Output shock, growth penalty per year [D]: Taiwan chip disruption 3%; China kinetic (rung 6) 5%; a severity-5 misuse incident ... 2%."',
  },
  // public.ts
  {
    id: 'act.public.concernBaseline',
    ref: { kind: 'inline', file: PUBLIC, anchor: '50 + milestones + 0.5 * Math.max(0, s.world.unemployment.US - 4.3)' },
    value: [50, 0.5],
    unit: 'meter 0..100', area: 'actors', layer: 'world', actor: 'public', kind: 'untagged',
    evidence: 'no tag; public.ts:35 "Concern drifts to a baseline that ratchets up +1 per player milestone (sticky), plus incidents and risk techs."',
  },
  {
    id: 'act.public.rung4Chance',
    ref: { kind: 'inline', file: PUBLIC, anchor: "(p.rung + 1 !== 4 || ctx.rng('actors').chance(0.02))" },
    value: 0.02,
    unit: 'probability per day', area: 'actors', layer: 'policy', actor: 'public', kind: 'untagged',
    evidence: 'no tag; public.ts:67 (radical-fringe violence rung 4 needs a 2% daily roll once its condition holds)',
  },
  {
    id: 'act.public.leakConcern',
    ref: { kind: 'inline', file: PUBLIC, anchor: "ctx.bump('pub.concern', 15 * mult, 'leak', 'misalignment memo');" },
    value: 15,
    unit: 'concern points', area: 'actors', layer: 'world', actor: 'public', kind: 'sourced',
    evidence: 'public.ts:80 "P-LEAK rule (research/07): misalignment memo leaks."',
    source: 'research/07 (P-LEAK rule)',
    notes: 'Approval -20 on the next lines is the same rule.',
  },
  // rivals.ts
  {
    id: 'act.rivals.goalpostsChance',
    ref: { kind: 'inline', file: RIVALS, anchor: 'postureOf(s, r.core.id).raceRelaxation * 0.3' },
    value: 0.3,
    unit: 'probability per quarter, x raceRelaxation', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'sourced',
    evidence: 'rivals.ts:497 "Quarterly moving-goalposts roll (research/17 §1.6.5 #3): pressure > 0.6 for 90 d → P = raceRelaxation·0.3."',
    source: 'research/17 §1.6.5 #3',
    notes: 'The 0.6 pressure and 90 d persistence are in overflow.',
  },
  {
    id: 'act.rivals.misuseHazardFactors',
    ref: { kind: 'inline', file: RIVALS, anchor: '* (dep.openWeights ? 1 : 0.5) * (1 - 0.3) * (1 - 0.6 * p.safetyInvestment)' },
    value: [0.5, 0.3, 0.6],
    unit: 'multipliers', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'rivals.ts:393-395 "a misuse hazard like the player\'s (standard safeguards) [D: usage 0.5, mitigation from eval rigor and safety investment]"',
    notes: 'Usage 0.5 unless open weights; fixed 30% safeguard; evalRigor cuts up to 60%.',
  },
  {
    id: 'act.rivals.incidentVisibility',
    ref: { kind: 'inline', file: RIVALS, anchor: 'clamp(p.disclosureRate + 0.5 * p.externalAccess + 0.1, 0, 1) * (sev >= 4 ? 1 : 0.6)' },
    value: [0.5, 0.1, 0.6],
    unit: 'probability', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'sourced',
    evidence: 'rivals.ts:395-396 "visibility = disclosure + 0.5·access + leak, statutory floor (research/17 §1.6.5 #4)"',
    source: 'research/17 §1.6.5 #4',
  },
  {
    id: 'act.rivals.statutoryVisibilityFloor',
    ref: { kind: 'inline', file: RIVALS, anchor: '(s.gov.statutes.sb53 || s.gov.statutes.raise) && sev >= 3 ? 0.6 : 0' },
    value: 0.6,
    unit: 'probability', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'sourced',
    evidence: 'rivals.ts:395-396 "statutory floor (research/17 §1.6.5 #4)"',
    source: 'research/17 §1.6.5 #4',
  },
  {
    id: 'act.rivals.revenueGrowthNoMarket',
    ref: { kind: 'inline', file: RIVALS, anchor: 'f.revenueRun *= 1.2 + 0.1 * clamp(-lead / 180, -1, 1);' },
    value: [1.2, 0.1, 180],
    unit: 'x per quarter', area: 'actors', layer: 'world', actor: 'rivals', kind: 'untagged',
    evidence: 'no tag; rivals.ts:485 "Labs without a priced public model keep the archetype growth rule."',
  },
  {
    id: 'act.rivals.chinaSafetyInvestment',
    ref: { kind: 'inline', file: RIVALS, anchor: 'safetyInvestment: 0.1 + (0.4 * s.china.meters.safetyConcern) / 100' },
    value: [0.1, 0.4],
    unit: 'fraction', area: 'actors', layer: 'policy', actor: 'china', kind: 'designer', source: 'V2-SPEC §3.10.4', notes: 'A8c: spec states safetyInvestment 0.10 + 0.4 x safetyConcern / 100.',
    evidence: 'no tag; rivals.ts:183-184 "China\'s safety investment follows its safety concern (§3.10.4)."',
  },
  // intel.ts, relations.ts, blocs.ts, researchBodies.ts
  {
    id: 'act.relations.trustLossFactor',
    ref: { kind: 'inline', file: REL, anchor: 'base * 3 * (1 + T / 100)' },
    value: 3,
    unit: 'multiplier', area: 'actors', layer: 'world', actor: 'player', kind: 'designer', source: 'V2-SPEC §3.9.1', notes: 'A8c: spec states loss = base x 3 x (1 + T/100).',
    evidence: 'no tag; relations.ts:17 "Trust gain/loss asymmetry (§3.9.1): gain base·(1 − T/100); loss base·3·(1 + T/100)."',
  },
  {
    id: 'act.relations.scrutinyHalfLife',
    ref: { kind: 'inline', file: REL, anchor: 'const ds = -rel.scrutiny * (Math.LN2 / 90);' },
    value: 90,
    unit: 'days', area: 'actors', layer: 'world', actor: 'player', kind: 'untagged',
    evidence: 'no tag; relations.ts:41 "Daily relation upkeep: scrutiny half-life 90 d"',
  },
  {
    id: 'act.blocs.coalitionMultiplier',
    ref: { kind: 'inline', file: BLOCS, anchor: '(co.has(b.id) ? 1.25 : 1)' },
    value: 1.25,
    unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public', kind: 'designer',
    evidence: 'blocs.ts:32 "Net pressure for (+) / against (−) a policy through a channel, ≈ −100..+100 [D scale]. Coalitions ×1.25."',
  },
  {
    id: 'act.researchBodies.discoveryBaseline',
    ref: { kind: 'inline', file: RB, anchor: '0.05 * s.researchBodies.evalGov.publishPressure + 0.02' },
    value: [0.05, 0.02],
    unit: 'probability', area: 'actors', layer: 'world', actor: 'public', kind: 'untagged',
    evidence: 'no tag; researchBodies.ts:23 "staff and press baseline" (cover-up discovery odds, §3.9.3 rule 1)',
  },
  // ───────────────────────── NPC labs (N2b-1 .. N8b; design/npc/NPC-LABS.md): parameters named in the N*-RESULT.md notes ─────────────────────────
  {
    id: 'act.npc.DAYS_PER_MONTH', ref: { kind: 'export', module: 'src/engine/v2/npc/lab.ts', symbol: 'DAYS_PER_MONTH' }, value: 30.4,
    unit: 'days', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/lab.ts "Days per month for the cast lags in months [D]"', source: 'design/npc/N2b1-RESULT.md',
  },
  {
    id: 'act.npc.CHINA_PLAN_GROWTH', ref: { kind: 'export', module: 'src/engine/v2/npc/lab.ts', symbol: 'CHINA_PLAN_GROWTH' }, value: 2,
    unit: 'x per year', area: 'actors', layer: 'world', actor: 'china', kind: 'derived', evidence: 'npc/lab.ts "the growth of China compute meter without export policy, x2 a year (actors/china.ts chinaDaily, IFP)"', notes: 'copy of the China compute meter rate',
  },
  {
    id: 'act.npc.SLOPE_FLOOR_PER_YEAR', ref: { kind: 'export', module: 'src/engine/v2/npc/lab.ts', symbol: 'SLOPE_FLOOR_PER_YEAR' }, value: 0.01,
    unit: 'OOM/yr', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/lab.ts "Floor of the reference slope the shortfall converts at [D]"',
  },
  {
    id: 'act.npc.SLOPE_WINDOW_YEARS', ref: { kind: 'export', module: 'src/engine/v2/npc/lab.ts', symbol: 'SLOPE_WINDOW_YEARS' }, value: 0.1,
    unit: 'years', area: 'actors', layer: 'world', actor: 'rivals', kind: 'derived', evidence: 'npc/lab.ts "Window of the reference slope: one grid step of the series (timelineSeries.ts SERIES_STEP)"',
  },
  {
    id: 'act.npc.STAFF_PER_H100E', ref: { kind: 'export', module: 'src/engine/v2/npc/lab.ts', symbol: 'STAFF_PER_H100E' }, value: 2050 / 1e6,
    unit: 'capabilities staff per H100e', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/lab.ts "the leader day-0 2,050 capabilities staff per 1e6 H100e [D: one typical ratio]"',
  },
  {
    id: 'act.npc.RELEASE_CADENCE_DAYS', ref: { kind: 'export', module: 'src/data/v2/npcLabs.ts', symbol: 'RELEASE_CADENCE_DAYS' }, value: 119,
    unit: 'days', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npcLabs.ts "ONE typical public-flagship interval for every kind (designer)"',
  },
  {
    id: 'act.npc.RACE_MONTHS', ref: { kind: 'export', module: 'src/engine/v2/npc/risk.ts', symbol: 'RACE_MONTHS' }, value: 3,
    unit: 'months', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'designer', evidence: 'npc/risk.ts "[D, spec 4]": race pressure = clamp(1 - months to the nearest competitor / 3, 0, 1)', source: 'design/npc/NPC-LABS.md §4',
  },
  {
    id: 'act.npc.SAFETY_CUTS_M', ref: { kind: 'export', module: 'src/engine/v2/npc/risk.ts', symbol: 'SAFETY_CUTS_M' }, value: 0.5,
    unit: 'fraction', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/risk.ts "[D, spec 4]": m = M_world(G) x (1 - 0.5 x safety x (1 - race response x p))', source: 'design/npc/NPC-LABS.md §4',
  },
  {
    id: 'act.npc.H0_PER_YEAR', ref: { kind: 'export', module: 'src/engine/v2/npc/risk.ts', symbol: 'H0_PER_YEAR' }, value: 0.05,
    unit: 'incidents per lab-year at G(V0)', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/risk.ts "[D, MISALIGNMENT.md 5]"', source: 'design/npc/MISALIGNMENT.md §5', notes: 'flagged for calibration in N2b2-RESULT.md (realised 0.031 per lab-year)',
  },
  {
    id: 'act.npc.SAFETY_CUTS_INCIDENTS', ref: { kind: 'export', module: 'src/engine/v2/npc/risk.ts', symbol: 'SAFETY_CUTS_INCIDENTS' }, value: 0.8,
    unit: 'fraction', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/risk.ts "[D, spec 7]"', source: 'design/npc/NPC-LABS.md §7',
  },
  {
    id: 'act.npc.SEV_SPAN', ref: { kind: 'export', module: 'src/engine/v2/npc/risk.ts', symbol: 'SEV_SPAN' }, value: 3,
    unit: 'severity levels', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/risk.ts generic row severity 1 + 3 x level/15 [D]',
  },
  {
    id: 'act.npc.SEV_LEVEL_TOP', ref: { kind: 'export', module: 'src/engine/v2/npc/risk.ts', symbol: 'SEV_LEVEL_TOP' }, value: 15,
    unit: 'display levels', area: 'actors', layer: 'world', actor: 'rivals', kind: 'derived', evidence: 'npc/risk.ts: the top of the display level scale', notes: 'copy of the level scale top (15)',
  },
  {
    id: 'act.npc.FOCUS_OFFSET_OOM', ref: { kind: 'export', module: RMODEL, symbol: 'FOCUS_OFFSET_OOM' }, value: 1,
    unit: 'OOM per unit of focus weight', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/market.ts "[D: one rule; a lab whose focus were all one domain is 1 OOM ahead of its G there]"',
  },
  {
    id: 'act.npc.TOOL_FOCUS_MIN', ref: { kind: 'export', module: RMODEL, symbol: 'TOOL_FOCUS_MIN' }, value: 0.3,
    unit: 'focus weight', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'designer', evidence: 'npc/market.ts: a tool is in a kind focus at weight >= 0.3 [D]',
  },
  {
    id: 'act.npc.THEFT_INTEGRATION_DAYS', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'THEFT_INTEGRATION_DAYS' }, value: 60,
    unit: 'days', area: 'actors', layer: 'world', actor: 'china', kind: 'sourced', source: 'AI 2027 scenario (China ends about two months behind after stealing the weights)', evidence: 'npc/shocks.ts "[P: AI 2027 China ends ~2 months behind after stealing]"',
  },
  {
    id: 'act.npc.TREATY_CLOCK_RATE', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'TREATY_CLOCK_RATE' }, value: 0.65,
    unit: 'x reference clock speed', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'untagged', evidence: 'npc/shocks.ts: the reference clock under a verified treaty (the old rivals treaty research factor 0.65)',
  },
  {
    id: 'act.npc.JOINT_EVAL_STEP', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'JOINT_EVAL_STEP' }, value: 0.05,
    unit: 'safety emphasis', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'designer', evidence: 'npc/shocks.ts "the step of the posture evalRigor today, C3 [D]"',
  },
  {
    id: 'act.npc.SPILL_DAYS', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'SPILL_DAYS' }, value: 7,
    unit: 'days of lag', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/shocks.ts "[D: 0.024 OOM at ~1.2 OOM/yr]"',
  },
  {
    id: 'act.npc.TRACK2_DAYS', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'TRACK2_DAYS' }, value: 2,
    unit: 'days of lag', area: 'actors', layer: 'world', actor: 'china', kind: 'designer', evidence: 'npc/shocks.ts "[D: old 1% of ~200 d]"',
  },
]);
