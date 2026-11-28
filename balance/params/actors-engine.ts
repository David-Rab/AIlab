// B3 inventory: actors engine (src/engine/v2/actors/*): rivals, China, government, public, intel, rival model.
// Prefix `act`. Named constants first (exports, then non-exported ones as inline refs: an export ref needs an export),
// then notable inline literals (the last block, capped at 40; the rest are listed in design/bal/inv/actors-engine-notes.md).
import { defineParams, type Param } from '../schema';

const RIVALS = 'src/engine/v2/actors/rivals.ts';
const RMODEL = 'src/engine/v2/npc/market.ts';
const CHINA = 'src/engine/v2/npc/china.ts';
const ECONOMY = 'src/engine/v2/worldfx/economy.ts';
const INTEL = 'src/engine/v2/actors/intel.ts';
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
    id: 'act.RIVAL_DISTILL_LAG_DAYS',
    ref: { kind: 'export', module: RMODEL, symbol: 'RIVAL_DISTILL_LAG_DAYS' },
    value: 152,
    unit: 'days', area: 'actors', layer: 'world', actor: 'rivals', kind: 'stand-in',
    evidence: 'npc/market.ts (was rivalModel.ts:817-819) "RD-P02 [D]: days from a release to its distilled students on sale ... a stated stand-in for the distill run\'s length and the release work (DD-18)"',
    notes: 'Haiku 4.5 matched Sonnet 4 five months after it (design/archive/V3-TASKS.md TIERS2).',
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
    ref: { kind: 'export', module: ECONOMY, symbol: 'MISUSE_SHOCK_DAYS' },
    value: 180,
    unit: 'days', area: 'actors', layer: 'world', kind: 'designer',
    evidence: 'economy.ts (was gov.ts:248) "Days a severity-5 misuse incident (player via WS2\'s stamp, or a rival) keeps the economy in shock [D]."',
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

  // ───────────────────────── notable inline literals (40) ─────────────────────────
  // china.ts
  ...(['strict', 'caseByCase', 'open'] as const).map((k): Param => ({
    id: `act.china.CHINA_EXPORT_GROWTH.${k}`,
    ref: { kind: 'export', module: CHINA, symbol: 'CHINA_EXPORT_GROWTH', path: [k] },
    value: { strict: 0.8, caseByCase: 1, open: 1.1 }[k],
    unit: 'exponent on the common plan growth', area: 'actors', layer: 'world', actor: 'china', kind: 'designer',
    evidence: 'npc/china.ts CHINA_EXPORT_GROWTH "[repo]": the old China-compute rule\'s factors (strict 0.8, open 1.1 on its x2/yr growth, IFP)',
    notes: 'W6: China\'s chip access drifts off the common NPC plan (RIVAL_GROWTH) by RIVAL_GROWTH^(factor - 1) a year.',
  })),
  // economy.ts (moved from gov.ts in W1d; the China-war 5% went with the China actor)
  {
    id: 'act.gov.outputShocks',
    ref: { kind: 'export', module: ECONOMY, symbol: 'OUTPUT_SHOCK' },
    value: { taiwan: 0.03, misuse: 0.02 },
    unit: 'growth penalty per year', area: 'actors', layer: 'world', kind: 'designer',
    evidence: 'economy.ts OUTPUT_SHOCK (was gov.ts:344-345) "Output shock, growth penalty per year [D]: Taiwan chip disruption 3%; ... a severity-5 misuse incident ... 2%."',
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
    ref: { kind: 'inline', file: RIVALS, anchor: 'reportingLaw(s) && sev >= 3 ? 0.6 : 0' },
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
    ref: { kind: 'inline', file: RIVALS, anchor: 'safetyInvestment: 0.1 + (0.4 * chinaSafetyConcern(s)) / 100' },
    value: [0.1, 0.4],
    unit: 'fraction', area: 'actors', layer: 'policy', actor: 'china', kind: 'designer', source: 'V2-SPEC §3.10.4', notes: 'A8c: spec states safetyInvestment 0.10 + 0.4 x safetyConcern / 100.',
    evidence: 'no tag; rivals.ts:183-184 "China\'s safety investment follows its safety concern (§3.10.4)."',
  },
  // intel.ts
  // ───────────────────────── NPC labs (N2b-1 .. N8b; design/npc/NPC-LABS.md): parameters named in the N*-RESULT.md notes ─────────────────────────
  {
    id: 'act.npc.DAYS_PER_MONTH', ref: { kind: 'export', module: 'src/engine/v2/npc/lab.ts', symbol: 'DAYS_PER_MONTH' }, value: 30.4,
    unit: 'days', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/lab.ts "Days per month for the cast lags in months [D]"', source: 'design/archive/npc/N2b1-RESULT.md',
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
    id: 'act.npc.TOOL_FOCUS_MIN', ref: { kind: 'export', module: RMODEL, symbol: 'TOOL_FOCUS_MIN' }, value: 0.3,
    unit: 'focus weight', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'designer', evidence: 'npc/market.ts: a tool is in a kind focus at weight >= 0.3 [D]',
  },
  {
    id: 'act.npc.THEFT_INTEGRATION_DAYS', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'THEFT_INTEGRATION_DAYS' }, value: 60,
    unit: 'days', area: 'actors', layer: 'world', actor: 'china', kind: 'sourced', source: 'AI 2027 scenario (China ends about two months behind after stealing the weights)', evidence: 'npc/shocks.ts "[P: AI 2027 China ends ~2 months behind after stealing]"',
  },
  {
    id: 'act.npc.SPILL_DAYS', ref: { kind: 'export', module: 'src/engine/v2/npc/shocks.ts', symbol: 'SPILL_DAYS' }, value: 7,
    unit: 'days of lag', area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer', evidence: 'npc/shocks.ts "[D: 0.024 OOM at ~1.2 OOM/yr]"',
  },
]);
