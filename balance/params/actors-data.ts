// B3 inventory: actors data (src/data/world.ts v1 integrator and world presets and baselines,
// src/data/v2/{rivalModel,agents}.ts). Prefix `acd`. The actor engine (src/engine/v2/actors/*) is in actors-engine.ts;
// this file holds only the data tables the engine reads. (The gov, public and China presets went with W1d.)
// BASELINES is one entry per preset and field, built from the value table below. The values are written out here (not read from the
// game) so the lint can compare them with the live data.
import { defineParams, type Param } from '../schema';

const WORLD = 'src/data/world.ts';
const RIVM = 'src/data/v2/npcLabs.ts';
const AGENTS = 'src/data/v2/agents.ts';

type Field = {
  name: string; unit?: string; area: Param['area']; layer: Param['layer']; actor?: Param['actor'];
  kind?: Param['kind']; evidence?: string; source?: string; notes?: string;
};

// ───────────────────────── world.ts: BASELINES ─────────────────────────
const BL_EVID = 'no tag; world.ts:246-260 (the Baseline.start field comments carry units only)';
const BL_FIELDS: Field[] = [
  { name: 'cash', unit: 'USD B', area: 'finance', layer: 'world', actor: 'player', kind: 'untagged', evidence: BL_EVID },
  { name: 'revenueRun', unit: 'USD B/yr', area: 'finance', layer: 'world', actor: 'player', kind: 'untagged', evidence: BL_EVID },
  { name: 'valuation', unit: 'USD B', area: 'finance', layer: 'world', actor: 'player', kind: 'designer', evidence: 'world.ts:249 "valuation: number; // $B [design: AI 2027 gives no valuation]"' },
  { name: 'compute', unit: 'H100e', area: 'market', layer: 'world', actor: 'player', kind: 'untagged', evidence: BL_EVID },
  { name: 'globalCompute', unit: 'H100e', area: 'market', layer: 'world', kind: 'untagged', evidence: BL_EVID },
  { name: 'staff', unit: 'people', area: 'research', layer: 'world', actor: 'player', kind: 'untagged', evidence: BL_EVID },
  { name: 'chinaShare', area: 'actors', layer: 'world', actor: 'china', kind: 'untagged', evidence: BL_EVID, notes: 'China share of world compute (name only; no unit comment).' },
  { name: 'chinaGapOom', unit: 'OOM', area: 'actors', layer: 'world', actor: 'china', kind: 'untagged',
    evidence: 'no tag; world.ts:254 "China\'s start gap in OOM of G under the player\'s V0 (was 0.6 progress-years)"' },
  { name: 'securityLevel', area: 'security', layer: 'world', actor: 'player', kind: 'untagged', evidence: BL_EVID },
];
function baselineParams(): Param[] {
  const rows: { id: string; v: number[] }[] = [
    { id: 'classic', v: [40, 12, 610, 1.2e6, 13e6, 2500, 0.12, 0.72, 2.4] },
    { id: 'reality', v: [45, 13, 300, 1.0e6, 14e6, 3000, 0.13, 0.72, 2.4] },
  ];
  const out: Param[] = [];
  rows.forEach((r, index) => BL_FIELDS.forEach((f, i) => {
    const e: Param = {
      id: `acd.BASELINES.${r.id}.${f.name}`,
      ref: { kind: 'export', module: WORLD, symbol: 'BASELINES', path: [index, 'start', f.name] },
      value: r.v[i], area: f.area, layer: f.layer, kind: f.kind!, evidence: f.evidence!, perPreset: true,
    };
    if (f.actor) e.actor = f.actor;
    if (f.unit) e.unit = f.unit;
    if (f.notes) e.notes = f.notes;
    out.push(e);
  }));
  return out;
}

// ───────────────────────── world.ts: v1 world presets (inline) ─────────────────────────
// makeWorld passes the one timeline world's numbers (the authors2026 table the three timeline worlds share) inline to build() (see Inline overflow
// in design/bal/inv/actors-data-notes.md). One entry per preset and field for the integrator's main parameters.
const AUDIT8 = 'world.ts:161 "Audit #8 / §5.3: AIFM sampling_config(_q2_eli).yaml medians; cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y."';
const note1 = 'Covered by the audit comment directly above the one-line build() (CLASSIFY A9).';

const PRESET_INLINE: Param[] = [
  // ai2027 (world.ts:158)
  // authors2026 (world.ts:162)
  { id: 'acd.world.authors2026.hSCmin', ref: { kind: 'inline', file: WORLD, anchor: 'hSCmin: 125 * 12 *' }, value: 125, unit: 'work-years (x12 x WORK_MONTH_MIN minutes)',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true,
    notes: 'The superhuman-coder horizon; g0 is derived from it (world.ts:142).' },
  { id: 'acd.world.authors2026.T', ref: { kind: 'inline', file: WORLD, anchor: 'T: 4.5,' }, value: 4.5, unit: 'months per doubling',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true, notes: note1 },
  { id: 'acd.world.authors2026.decay', ref: { kind: 'inline', file: WORLD, anchor: 'decay: 0.08, hSCmin: 125' }, value: 0.08, unit: 'fraction',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true, notes: note1 },
  { id: 'acd.world.authors2026.cs', ref: { kind: 'inline', file: WORLD, anchor: 'cs: 17,' }, value: 17, unit: 'months',
    area: 'capability', layer: 'world', kind: 'fitted', evidence: AUDIT8, perPreset: true,
    fit: { targets: [], script: 'unnamed' }, notes: 'Named in the comment: "cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y".' },
  { id: 'acd.world.authors2026.pEx', ref: { kind: 'inline', file: WORLD, anchor: 'pEx: 0.1, sEx: 2' }, value: 0.1,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true, notes: note1 },
  { id: 'acd.world.authors2026.sEx', ref: { kind: 'inline', file: WORLD, anchor: 'sEx: 2, G: [1.52' }, value: 2,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true, notes: note1 },
  { id: 'acd.world.authors2026.G', ref: { kind: 'inline', file: WORLD, anchor: 'G: [1.52, 101, 1340]' }, value: [1.52, 101, 1340], unit: 'human-only research-years per gap (SC-SAR, SAR-SIAR, SIAR-ASI)',
    area: 'capability', layer: 'world', kind: 'fitted', evidence: AUDIT8, perPreset: true,
    fit: { targets: [], script: 'unnamed' }, notes: 'Named in the comment: "cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y".' },
  // fast (world.ts:168)
  // slow (world.ts:175)
];

export const PARAMS_ACTORS_DATA = defineParams([
  // ───────────────────────── world.ts ─────────────────────────
  ...baselineParams(),
  {
    // Non-exported constant: inline ref on the declaration line (an export ref needs an export).
    id: 'acd.world.AIFM_WORLD',
    ref: { kind: 'inline', file: WORLD, anchor: 'const AIFM_WORLD = [8.6e6, 22.4e6, 57.1e6, 135e6, 289e6, 537e6, 913e6, 1.51e9]' },
    value: [8.6e6, 22.4e6, 57.1e6, 135e6, 289e6, 537e6, 913e6, 1.51e9],
    unit: 'H100e',
    area: 'market', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:287 "AIFM inputs/input_data.csv (audit #18): world_H100e and total_ai_company_H100e (leading company), by year."',
    source: 'AIFM inputs/input_data.csv (audit #18)',
    notes: 'World AI compute by year 2025..2032 (AIFM_YEARS), log-interpolated for aifm presets; unexported.',
  },
  {
    id: 'acd.world.AIFM_LEADER',
    ref: { kind: 'inline', file: WORLD, anchor: 'const AIFM_LEADER = [0.516e6, 1.79e6, 6.85e6, 21.6e6, 57.8e6, 107e6, 183e6, 300e6]' },
    value: [0.516e6, 1.79e6, 6.85e6, 21.6e6, 57.8e6, 107e6, 183e6, 300e6],
    unit: 'H100e',
    area: 'market', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:287 "AIFM inputs/input_data.csv (audit #18): world_H100e and total_ai_company_H100e (leading company), by year."',
    source: 'AIFM inputs/input_data.csv (audit #18)',
    notes: 'Leading company compute by year 2025..2032; refCapCompute takes 68% of it; unexported.',
  },
  ...PRESET_INLINE,
  // refCapCompute / globalCompute / laborSlowdown / computePace (inline literals)
  {
    id: 'acd.world.refCap.rdShare', ref: { kind: 'inline', file: WORLD, anchor: 'return 0.68 * logInterp(AIFM_YEARS, AIFM_LEADER' }, value: 0.68, unit: 'fraction of leader compute',
    area: 'market', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:314-316 "Reference R&D compute path of the leading lab ... AI 2027: 3.4x/yr for the leader, R&D ≈ 68% (audit #11)."', source: 'research/11-engine-audit.md audit #11',
  },
  {
    id: 'acd.world.refCap.day0', ref: { kind: 'inline', file: WORLD, anchor: '0.68e6 * Math.pow(' }, value: 0.68e6, unit: 'H100e',
    area: 'market', layer: 'world', kind: 'untagged',
    evidence: 'no tag; world.ts:321 (the 68% R&D share of ~1e6 H100e is implied by the docstring, world.ts:316, but 0.68e6 is not stated)',
    notes: 'Day-0 R&D compute of the leader on the non-AIFM path; classic baseline lab compute is 1.2e6 (world.ts:271).',
  },
  {
    id: 'acd.world.refCap.growth', ref: { kind: 'inline', file: WORLD, anchor: 'Math.pow(3.4, pre)' }, value: 3.4, unit: 'x per year',
    area: 'market', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:315-316 "AI 2027: 3.4x/yr for the leader, R&D ≈ 68% (audit #11)."', source: 'research/11-engine-audit.md audit #11',
  },
  {
    id: 'acd.world.refCap.breakYears', ref: { kind: 'inline', file: WORLD, anchor: 'Math.min(years, 2.5)' }, value: 2.5, unit: 'years',
    area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; world.ts:319 (the docstring names the 3.4x/yr and 68% only)',
    notes: 'Years after Jul 2025 at which the leader\'s growth slows.',
  },
  {
    id: 'acd.world.refCap.postGrowth', ref: { kind: 'inline', file: WORLD, anchor: 'Math.pow(1.6, post)' }, value: 1.6, unit: 'x per year',
    area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; world.ts:321 (the docstring names the 3.4x/yr and 68% only)',
  },
  {
    id: 'acd.world.globalCompute.breakYears', ref: { kind: 'inline', file: WORLD, anchor: 'Math.min(years, 3.5)' }, value: 3.5, unit: 'years',
    area: 'market', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:307 "AI 2027 compute forecast: 2.25x/yr; slower after 2029 (audit #18)"', source: 'research/11-engine-audit.md audit #18',
    notes: '3.5 years after Jul 2025 = 2029.',
  },
  {
    id: 'acd.world.globalCompute.postCap', ref: { kind: 'inline', file: WORLD, anchor: 'Math.min(w.computeGrowth, 1.5)' }, value: 1.5, unit: 'x per year',
    area: 'market', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:307 "AI 2027 compute forecast: 2.25x/yr; slower after 2029 (audit #18)"', source: 'research/11-engine-audit.md audit #18',
    notes: 'Cap on the post-2029 growth rate; the comment names "slower" but not 1.5.',
  },
  {
    id: 'acd.world.laborSlowdown.year', ref: { kind: 'inline', file: WORLD, anchor: 'return year >= 2029 ? Math.sqrt(' }, value: 2029, unit: 'year',
    area: 'capability', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:81 "Post-2029 human-labor slowdown on the multiplier (AI 2027 code)."', source: 'AI 2027 code (uvafan/timelines-takeoff-ai-2027, world.ts:2)',
    notes: 'The same 2029 appears in computePace.',
  },
  {
    id: 'acd.world.computePace.factor', ref: { kind: 'inline', file: WORLD, anchor: 'return year >= 2029 ? 0.5 : 1;' }, value: 0.5, unit: 'fraction',
    area: 'capability', layer: 'world', kind: 'sourced',
    evidence: 'world.ts:86 "Compute-rate factor of the 2024 pace: halves from 2029 (AI 2027 code)."', source: 'AI 2027 code (uvafan/timelines-takeoff-ai-2027, world.ts:2)',
  },

  // ───────────────────────── v2/rivalModel.ts ─────────────────────────
  {
    id: 'acd.RIVAL_TPP', ref: { kind: 'export', module: RIVM, symbol: 'RIVAL_TPP' }, value: 400, unit: 'tokens per active parameter',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'derived',
    evidence: 'rivalModel.ts:21-24 "the reference design\'s (runDesign.ts REF_TPP, 400 since A6b) [R20 A1, D]"; `RIVAL_TPP = REF_TPP`',
    source: 'research/20 A1 (DeepSeek-V3 about 400 tokens per active parameter)',
    notes: 'Computed from REF_TPP (another file; cap.REF_TPP); the comment also tags [R20 A1, D].',
  },
  {
    id: 'acd.SERVE_RATE0', ref: { kind: 'export', module: RIVM, symbol: 'SERVE_RATE0' }, value: 0.2, unit: 'OOM/yr',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'fitted',
    evidence: 'rivalModel.ts:38-41 "what the reference lab\'s Inference-efficiency line adds in its first year (RefBot, ai2027, seed 2027; serving test V1) [fit]"',
    fit: { targets: [], script: 'unnamed' },
    notes: 'Fit to the reference lab\'s first-year inference-efficiency gain in the serving test V1; no script is named.',
  },

  // ───────────────────────── v2/agents.ts ─────────────────────────
  {
    id: 'acd.ENG_REF_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'ENG_REF_SHARE' }, value: 0.2, unit: 'fraction of agent compute',
    area: 'research', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'agents.ts:35-37 "Reference share of a lab\'s agent compute spent on engineering (coding for the build queue) [D]."',
    notes: 'Also the player\'s reference split (split.ts playerShareRef). Layer: Q-actors-data-10.',
  },
  {
    id: 'acd.REF_AGENT_SHARES', ref: { kind: 'export', module: AGENTS, symbol: 'REF_AGENT_SHARES' }, value: [0.2, 0.65, 0.15], unit: 'fraction of agent compute',
    area: 'research', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'agents.ts:39-40 "Reference shares of ALL of a lab\'s agent compute (the reference lab; mockups-v3 v3-company) [D]"',
    source: 'mockups-v3 v3-company',
    notes: 'Array order = eng, capRoutine, capFrontier; eng is ENG_REF_SHARE. Layer: Q-actors-data-10.',
  },
  {
    id: 'acd.DEFAULT_CAP_SHARES', ref: { kind: 'export', module: AGENTS, symbol: 'DEFAULT_CAP_SHARES' }, value: [1, 0.65 / (1 - 0.2), 0.15 / (1 - 0.2)], unit: 'share of the research agent pool',
    area: 'research', layer: 'policy', actor: 'player', kind: 'derived',
    evidence: 'agents.ts:42-43 "The player\'s default package shares: research uses as shares of the research agent pool (the reference shares net of engineering: 0.8125 / 0.1875)"; computed from REF_AGENT_SHARES and ENG_REF_SHARE',
    notes: 'Array order = eng, capRoutine, capFrontier; layer policy because it is the player\'s default setting (CLASSIFY A10).',
  },
  {
    id: 'acd.TRUST_EST_DEFAULT', ref: { kind: 'export', module: AGENTS, symbol: 'TRUST_EST_DEFAULT' }, value: 0.3, unit: 'probability',
    area: 'safety', layer: 'policy', actor: 'player', kind: 'designer',
    evidence: 'agents.ts:55-56 "SR-20: the trust line when the framework has no Misalignment-signs rule: upper end of believed SCHEME / AF / SAND ≤ 30% ... [D]."',
    source: 'SR-20; data/v2/framework.ts (default misalignment line)',
  },
  {
    id: 'acd.MONITOR_STD_POOL_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'MONITOR_STD_POOL_SHARE' }, value: 0.2, unit: 'fraction of the safety pool',
    area: 'safety', layer: 'policy', actor: 'player', kind: 'designer',
    evidence: 'agents.ts:58-59 "Default monitoring budget, as a share of the old safety pool ... the pre-R7 runtime-monitoring reserve (`monitoringShare`) [D]."',
    source: 'pre-R7 monitoringShare; RD-A05a',
  },
  {
    id: 'acd.SAFETY_AGENT_DEFAULT_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'SAFETY_AGENT_DEFAULT_SHARE' }, value: 0.2, unit: 'fraction of the safety pool',
    area: 'safety', layer: 'policy', actor: 'player', kind: 'designer',
    evidence: 'agents.ts:66 "Share of the safety pool the safety agents get when Trusted to AI is turned on with none running [D]."',
  },
  {
    id: 'acd.SAFETY_AGENT_MAX_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'SAFETY_AGENT_MAX_SHARE' }, value: 0.6, unit: 'fraction of the safety pool',
    area: 'safety', layer: 'world', actor: 'player', kind: 'untagged',
    evidence: 'no tag; agents.ts:68 (the comment above, agents.ts:63-65, describes the 0–100% policy and the removed 50% cap, not this value)',
    notes: 'Upper limit on the player\'s Trusted-to-AI share.',
  },
]);
