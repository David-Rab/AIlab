// B3 inventory: actors data (src/data/actors.ts presets, src/data/world.ts v1 integrator and world presets and
// baselines, src/data/v2/{rivalModel,blocs,agents}.ts). Prefix `acd`. The actor engine (src/engine/v2/actors/*) is in
// actors-engine.ts; this file holds only the data tables the engine reads.
// Per-preset bundles (GOV_PRESETS, PUBLIC_PRESETS, CHINA_PRESETS, LAB_ARCHETYPES, BASELINES) are one entry per preset
// and field, built by `presetParams` from the value tables below. The values are written out here (not read from the
// game) so the lint can compare them with the live data.
import { defineParams, type Param } from '../schema';

const ACT = 'src/data/actors.ts';
const WORLD = 'src/data/world.ts';
const RIVM = 'src/data/v2/rivalModel.ts';
const BLOCS = 'src/data/v2/blocs.ts';
const AGENTS = 'src/data/v2/agents.ts';

type Field = {
  name: string; unit?: string; area: Param['area']; layer: Param['layer']; actor?: Param['actor'];
  kind: Param['kind']; evidence: string; source?: string; notes?: string;
};
type Preset = { id: string; values: (number | number[])[]; skip?: string[] };

/** One entry per preset and field. `fields[i]` describes `preset.values[i]`; `index` is the preset's array index. */
function presetParams(prefix: string, module: string, symbol: string, fields: Field[], presets: Preset[], override?: (preset: string, f: Field) => Partial<Field> | undefined): Param[] {
  const out: Param[] = [];
  presets.forEach((p, index) => {
    fields.forEach((f0, i) => {
      if (p.skip?.includes(f0.name)) return;
      const f = { ...f0, ...(override?.(p.id, f0) ?? {}) };
      const e: Param = {
        id: `${prefix}.${symbol}.${p.id}.${f.name}`,
        ref: { kind: 'export', module, symbol, path: [index, f.name] },
        value: p.values[i],
        area: f.area, layer: f.layer, actor: f.actor, kind: f.kind,
        evidence: f.evidence,
        perPreset: true,
      };
      if (f.unit) e.unit = f.unit;
      if (f.source) e.source = f.source;
      if (f.notes) e.notes = f.notes;
      out.push(e);
    });
  });
  return out;
}

// ───────────────────────── actors.ts: GOV_PRESETS ─────────────────────────
const GOV_UNCLEAR = 'actors.ts:1 "Source: research/07-actors.md (weights = \\"Realistic\\" draw probabilities)" names the weights only; the trait values (rows actors.ts:9-13) carry no tag of their own';
const GOV_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'gov', kind: 'sourced',
    evidence: 'actors.ts:1 "Source: research/07-actors.md (weights = \\"Realistic\\" draw probabilities)"', source: 'research/07-actors.md',
    notes: 'Probability a sampled world draws this government personality; the five weights sum to 100.' },
  { name: 'accel', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'security', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'reg', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'transactional', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'hawk', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'natThreshold', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR,
    notes: 'Nationalization index above which the government escalates (gov.ts:141, :152, :154); Q-actors-data-1' },
  { name: 'lag', unit: 'days', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR,
    notes: 'Hold time before a security rung (gov.ts:143, 0.7 x lag, floor 7 days); Q-actors-data-1' },
  { name: 'pollSensitivity', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov', kind: 'unclear', evidence: GOV_UNCLEAR, notes: 'Q-actors-data-1' },
];
const GOV_VALUES: Preset[] = [
  { id: 'dealmaker', values: [45, 1.5, 0.8, 0.4, 1.6, 0.8, 85, 20, 1] },
  { id: 'hawk', values: [25, 1.1, 1.6, 0.7, 1, 1.6, 60, 10, 1] },
  { id: 'populist', values: [13, 1, 1, 1.2, 1.2, 1.1, 70, 15, 2] },
  { id: 'regulator', values: [12, 0.8, 1.2, 1.6, 0.6, 0.9, 70, 25, 1.2] },
  { id: 'absentee', values: [5, 0.6, 0.6, 0.6, 1, 0.6, 90, 45, 0.6] },
];

// ───────────────────────── actors.ts: PUBLIC_PRESETS ─────────────────────────
const PUB_UNCLEAR = 'actors.ts:1 "Source: research/07-actors.md (weights = \\"Realistic\\" draw probabilities)" names the weights only; the trait values (rows actors.ts:21-25) carry no tag of their own';
const PUB_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'public', kind: 'sourced',
    evidence: 'actors.ts:1 "Source: research/07-actors.md (weights = \\"Realistic\\" draw probabilities)"', source: 'research/07-actors.md',
    notes: 'Probability a sampled world draws this public mood; the five weights sum to 100.' },
  { name: 'shock', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public', kind: 'unclear', evidence: PUB_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'halfLife', unit: 'days', area: 'actors', layer: 'world', actor: 'public', kind: 'unclear', evidence: PUB_UNCLEAR,
    notes: 'Concern decays toward base with ln2 / halfLife per day (public.ts:37); Q-actors-data-1' },
  { name: 'jobs', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public', kind: 'unclear', evidence: PUB_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'xrisk', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public', kind: 'unclear', evidence: PUB_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'benefit', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public', kind: 'unclear', evidence: PUB_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'mobilization', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public', kind: 'unclear', evidence: PUB_UNCLEAR, notes: 'Q-actors-data-1' },
];
const PUB_VALUES: Preset[] = [
  { id: 'anxious', values: [50, 1, 120, 1.2, 1, 0.7, 0.8] },
  { id: 'backlash', values: [22, 1.1, 150, 1.6, 0.9, 0.6, 1.5] },
  { id: 'optimist', values: [10, 0.7, 45, 0.8, 0.7, 1.6, 0.5] },
  { id: 'doomer', values: [10, 1.3, 140, 1, 1.8, 0.7, 1.2] },
  { id: 'distracted', values: [8, 0.6, 60, 0.8, 0.7, 0.8, 0.4] },
];

// ───────────────────────── actors.ts: CHINA_PRESETS ─────────────────────────
const CN_UNCLEAR = 'actors.ts:31 "Weights from research/10-china.md ... which supersedes 07" names the weights only; the trait values (rows actors.ts:36-41) carry no tag of their own';
const CN_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'china', kind: 'sourced',
    evidence: 'actors.ts:31 "Weights from research/10-china.md (China deep dive, incl. Chinese-language sources), which supersedes 07."', source: 'research/10-china.md',
    notes: 'Probability a sampled world draws this China posture; the six weights sum to 100.' },
  { name: 'centralize', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china', kind: 'unclear', evidence: CN_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'theft', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china', kind: 'unclear', evidence: CN_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'taiwan', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china', kind: 'unclear', evidence: CN_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'treaty', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china', kind: 'unclear', evidence: CN_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'openSource', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china', kind: 'unclear', evidence: CN_UNCLEAR, notes: 'Q-actors-data-1' },
  { name: 'efficiency', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'china', kind: 'designer',
    evidence: 'actors.ts:32-34 "efficiency: 1 for every preset (CAL-W: AI 2027 gives DeepCent no research efficiency separable from compute; the Fast Follower 1.1 / Diffuser 1.05 flavours were [D] with no source; designer CP3k: equal recipe efficiency)"',
    notes: 'Designer CP3k plus research pointer CAL-W (research/CAL-world-sources.md, as world.ts:220-221 cites it); 1 in every preset.' },
  { name: 'hawk', area: 'actors', layer: 'policy', actor: 'china', kind: 'unclear', evidence: CN_UNCLEAR, notes: 'Hawkishness score, 30-80 (Q-actors-data-1)' },
];
const CN_VALUES: Preset[] = [
  { id: 'fastfollower', values: [35, 0.5, 0.7, 0.8, 1, 1.3, 1, 40] },
  { id: 'diffuser', values: [20, 0.6, 0.8, 0.7, 1.2, 1.8, 1, 35] },
  { id: 'selfreliant', values: [20, 1, 0.9, 0.6, 1, 1, 1, 45] },
  { id: 'nationalizer', values: [10, 1.6, 1.6, 1.3, 0.7, 0.3, 1, 65] },
  { id: 'gambler', values: [5, 1.6, 1.6, 2, 0.4, 0.3, 1, 80] },
  { id: 'bargainer', values: [10, 1, 0.8, 0.6, 1.8, 0.9, 1, 30] },
];

// ───────────────────────── actors.ts: LAB_ARCHETYPES ─────────────────────────
const LAB_UNCLEAR = 'actors.ts:1 "Source: research/07-actors.md (weights = \\"Realistic\\" draw probabilities)" is the file header for "Actor personality presets"; the lab archetype rows (actors.ts:49-54) carry no tag of their own';
const LAB_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'rivals', kind: 'unclear', evidence: LAB_UNCLEAR,
    notes: 'Probability a rival draws this archetype; the five sampled weights sum to 100. Q-actors-data-2' },
  { name: 'safety', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'unclear', evidence: LAB_UNCLEAR, notes: 'Q-actors-data-2' },
  { name: 'openness', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'unclear', evidence: LAB_UNCLEAR, notes: 'Q-actors-data-2' },
  { name: 'lobby', area: 'actors', layer: 'policy', actor: 'rivals', kind: 'unclear', evidence: LAB_UNCLEAR, notes: 'Lobbying stance, -70..60; Q-actors-data-2' },
  { name: 'computeMult', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'rivals', kind: 'unclear', evidence: LAB_UNCLEAR, notes: 'Q-actors-data-2' },
  { name: 'gapYears', unit: 'years', area: 'actors', layer: 'world', actor: 'rivals', kind: 'unclear', evidence: LAB_UNCLEAR,
    notes: 'Array order = low, high (start gap range behind the leader); Q-actors-data-2' },
];
const LAB_VALUES: Preset[] = [
  { id: 'safety', values: [25, 80, 15, 60, 0.8, [0.15, 0.45]] },
  { id: 'bigtech', values: [30, 50, 30, -20, 1.3, [0.1, 0.4]] },
  { id: 'maverick', values: [20, 20, 50, -70, 1, [0.2, 0.5]] },
  { id: 'openweights', values: [15, 30, 85, -40, 0.7, [0.35, 0.7]] },
  { id: 'upstart', values: [10, 55, 20, 0, 0.3, [0.5, 1.1]] },
  // The leader row (actors.ts:50-53 comment): never sampled; computeMult and gapYears are "unused", so not registered.
  { id: 'leader', values: [0, 35, 25, -30, 1, [0, 0]], skip: ['computeMult', 'gapYears'] },
];
const LEADER_NOTE = 'actors.ts:50-52 "The AI 2027 leading lab (BUILD-PLAN R2): never sampled (weight 0); ... at reference inputs"; no tag on the value';

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
  { name: 'approval', area: 'actors', layer: 'world', actor: 'public', kind: 'untagged', evidence: BL_EVID },
  { name: 'concern', area: 'actors', layer: 'world', actor: 'public', kind: 'untagged', evidence: BL_EVID },
  { name: 'jobAnxiety', area: 'actors', layer: 'world', actor: 'public', kind: 'untagged', evidence: BL_EVID },
  { name: 'xrisk', area: 'actors', layer: 'world', actor: 'public', kind: 'untagged', evidence: BL_EVID },
  { name: 'securityLevel', area: 'security', layer: 'world', actor: 'player', kind: 'untagged', evidence: BL_EVID },
];
function baselineParams(): Param[] {
  const rows: { id: string; v: number[] }[] = [
    { id: 'classic', v: [40, 12, 610, 1.2e6, 13e6, 2500, 0.12, 0.72, -25, 50, 65, 40, 2.4] },
    { id: 'reality', v: [45, 13, 300, 1.0e6, 14e6, 3000, 0.13, 0.72, -5, 50, 71, 43, 2.4] },
  ];
  const out: Param[] = [];
  rows.forEach((r, index) => BL_FIELDS.forEach((f, i) => {
    const e: Param = {
      id: `acd.BASELINES.${r.id}.${f.name}`,
      ref: { kind: 'export', module: WORLD, symbol: 'BASELINES', path: [index, 'start', f.name] },
      value: r.v[i], area: f.area, layer: f.layer, kind: f.kind, evidence: f.evidence, perPreset: true,
    };
    if (f.actor) e.actor = f.actor;
    if (f.unit) e.unit = f.unit;
    if (f.notes) e.notes = f.notes;
    out.push(e);
  }));
  return out;
}

// ───────────────────────── world.ts: v1 world presets (inline) ─────────────────────────
// makeWorld's four named presets pass their numbers inline to build(); the sampled world draws them (see Inline overflow
// in design/bal/inv/actors-data-notes.md). One entry per preset and field for the integrator's main parameters.
const AUDIT1 = 'world.ts:157 "Audit #1: g0 28.5, pEx 0.25 reproduce 1.5x Jan 2026, 3x Dec 2026, SC 2027-03-31, SAR end-Aug, ASI Dec 31 2027."';
const AUDIT8 = 'world.ts:161 "Audit #8 / §5.3: AIFM sampling_config(_q2_eli).yaml medians; cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y."';
const AUDIT9 = 'world.ts:167 "Audit #9 / §5.4: Daniel Aug-2026 (AC p50 2027.92) + AI 2027 p10 takeoff (SC->ASI ~0.21 y)."';
const AUDIT22 = 'world.ts:174 "Audit #22 / §5.5: METR 7-month exponential; AI 2027 median h_SC and cs; SAR anchor lowered to avoid a 1.6->25 jump."';
const SRC_RES11 = 'research/11-engine-audit.md (audit #1, world.ts:157; header world.ts:2-3 "audited against the primary sources in research/11-engine-audit.md")';
const note1 = 'The comment sits above the one-line preset and is read as covering all of its fields (Q-actors-data-3).';

const PRESET_INLINE: Param[] = [
  // ai2027 (world.ts:158)
  { id: 'acd.world.ai2027.g0', ref: { kind: 'inline', file: WORLD, anchor: 'g0: 28.5' }, value: 28.5, unit: 'months',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true,
    notes: 'Months of 2024/25-pace progress to superhuman-coder horizon (header world.ts:4); solves hSC.' },
  { id: 'acd.world.ai2027.T', ref: { kind: 'inline', file: WORLD, anchor: 'T: 4.74,' }, value: 4.74, unit: 'months per doubling',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true, notes: note1 },
  { id: 'acd.world.ai2027.decay', ref: { kind: 'inline', file: WORLD, anchor: 'decay: 0.1, g0: 28.5' }, value: 0.1, unit: 'fraction',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true, notes: note1 },
  { id: 'acd.world.ai2027.cs', ref: { kind: 'inline', file: WORLD, anchor: 'cs: 3.9,' }, value: 3.9, unit: 'months',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true, notes: note1 },
  { id: 'acd.world.ai2027.pEx', ref: { kind: 'inline', file: WORLD, anchor: 'pEx: 0.25,' }, value: 0.25,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true,
    notes: 'Stage-1 multiplier M = 1 + pEx*(sEx/pEx)^f (world.ts:66).' },
  { id: 'acd.world.ai2027.sEx', ref: { kind: 'inline', file: WORLD, anchor: 'sEx: 4, G: [4.19' }, value: 4,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true, notes: note1 },
  { id: 'acd.world.ai2027.G', ref: { kind: 'inline', file: WORLD, anchor: 'G: [4.19, 16, 49.5]' }, value: [4.19, 16, 49.5], unit: 'human-only research-years per gap (SC-SAR, SAR-SIAR, SIAR-ASI)',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT1, source: SRC_RES11, perPreset: true, notes: note1 },
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
    fit: { targets: [], script: 'unnamed' }, notes: 'Comment: "cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y".' },
  { id: 'acd.world.authors2026.pEx', ref: { kind: 'inline', file: WORLD, anchor: 'pEx: 0.1, sEx: 2' }, value: 0.1,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true, notes: note1 },
  { id: 'acd.world.authors2026.sEx', ref: { kind: 'inline', file: WORLD, anchor: 'sEx: 2, G: [1.52' }, value: 2,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT8, source: 'research/11-engine-audit.md audit #8 / §5.3 (AIFM sampling_config(_q2_eli).yaml medians)', perPreset: true, notes: note1 },
  { id: 'acd.world.authors2026.G', ref: { kind: 'inline', file: WORLD, anchor: 'G: [1.52, 101, 1340]' }, value: [1.52, 101, 1340], unit: 'human-only research-years per gap (SC-SAR, SAR-SIAR, SIAR-ASI)',
    area: 'capability', layer: 'world', kind: 'fitted', evidence: AUDIT8, perPreset: true,
    fit: { targets: [], script: 'unnamed' }, notes: 'Comment: "cs and G fitted to AC p50 2029.16, AC->ASI 4.56 y".' },
  // fast (world.ts:168)
  { id: 'acd.world.fast.hSCmin', ref: { kind: 'inline', file: WORLD, anchor: 'hSCmin: 12 * WORK_MONTH_MIN' }, value: 12, unit: 'work-months (x WORK_MONTH_MIN minutes)',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  { id: 'acd.world.fast.T', ref: { kind: 'inline', file: WORLD, anchor: 'T: 4.0,' }, value: 4, unit: 'months per doubling',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  { id: 'acd.world.fast.decay', ref: { kind: 'inline', file: WORLD, anchor: 'decay: 0.08, hSCmin: 12 * WORK' }, value: 0.08, unit: 'fraction',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  { id: 'acd.world.fast.cs', ref: { kind: 'inline', file: WORLD, anchor: 'cs: 10.3,' }, value: 10.3, unit: 'months',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  { id: 'acd.world.fast.pEx', ref: { kind: 'inline', file: WORLD, anchor: 'pEx: 0.15, sEx: 3' }, value: 0.15,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  { id: 'acd.world.fast.sEx', ref: { kind: 'inline', file: WORLD, anchor: 'sEx: 3, G: [0, 7.67' }, value: 3,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  { id: 'acd.world.fast.G', ref: { kind: 'inline', file: WORLD, anchor: 'G: [0, 7.67, 47.5]' }, value: [0, 7.67, 47.5], unit: 'human-only research-years per gap (SC-SAR, SAR-SIAR, SIAR-ASI)',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT9, source: 'research/11-engine-audit.md audit #9 / §5.4 (Daniel Aug-2026; AI 2027 p10 takeoff)', perPreset: true, notes: note1 },
  // slow (world.ts:175)
  { id: 'acd.world.slow.hSCmin', ref: { kind: 'inline', file: WORLD, anchor: 'hSCmin: 120 * WORK_MONTH_MIN' }, value: 120, unit: 'work-months (x WORK_MONTH_MIN minutes)',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5 (AI 2027 median h_SC)', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.T', ref: { kind: 'inline', file: WORLD, anchor: 'T: 7, growth: \'exp\'' }, value: 7, unit: 'months per doubling',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5 (METR 7-month exponential)', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.decay', ref: { kind: 'inline', file: WORLD, anchor: 'decay: 0, hSCmin: 120' }, value: 0, unit: 'fraction',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5 (METR 7-month exponential)', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.cs', ref: { kind: 'inline', file: WORLD, anchor: 'cs: 3.87,' }, value: 3.87, unit: 'months',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5 (AI 2027 median cs)', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.pEx', ref: { kind: 'inline', file: WORLD, anchor: 'pEx: 0.01, sEx: 0.6' }, value: 0.01,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.sEx', ref: { kind: 'inline', file: WORLD, anchor: 'sEx: 0.6, G: [10, 394' }, value: 0.6,
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.G', ref: { kind: 'inline', file: WORLD, anchor: 'G: [10, 394, 2000]' }, value: [10, 394, 2000], unit: 'human-only research-years per gap (SC-SAR, SAR-SIAR, SIAR-ASI)',
    area: 'capability', layer: 'world', kind: 'sourced', evidence: AUDIT22, source: 'research/11-engine-audit.md audit #22 / §5.5', perPreset: true, notes: note1 },
  { id: 'acd.world.slow.sarSpeed', ref: { kind: 'inline', file: WORLD, anchor: 'w.sarSpeed = 10;' }, value: 10, unit: 'x human-only speed at SAR',
    area: 'capability', layer: 'world', kind: 'untagged', evidence: 'no tag; world.ts:174 "SAR anchor lowered to avoid a 1.6->25 jump" (an adjustment, not a tag)', perPreset: true,
    notes: 'Otherwise sarSpeed = max(25, 1 + sEx) (world.ts:57).' },
  { id: 'acd.world.slow.computeGrowth', ref: { kind: 'inline', file: WORLD, anchor: 'w.computeGrowth = 1.8;' }, value: 1.8, unit: 'x per year',
    area: 'market', layer: 'world', kind: 'untagged', evidence: 'no tag; world.ts:178 (slow preset override; world.ts:174 audit comment names no compute value)', perPreset: true },
  { id: 'acd.world.slow.computeElasticity', ref: { kind: 'inline', file: WORLD, anchor: 'w.computeElasticity = 0.7;' }, value: 0.7, unit: 'exponent',
    area: 'capability', layer: 'world', kind: 'untagged', evidence: 'no tag; world.ts:178 (slow preset override)', perPreset: true,
    notes: 'The other presets keep the build() default 0.5 (world.ts:147).' },
];

export const PARAMS_ACTORS_DATA = defineParams([
  // ───────────────────────── actors.ts: presets (per preset and field) ─────────────────────────
  ...presetParams('acd', ACT, 'GOV_PRESETS', GOV_FIELDS, GOV_VALUES),
  ...presetParams('acd', ACT, 'PUBLIC_PRESETS', PUB_FIELDS, PUB_VALUES),
  ...presetParams('acd', ACT, 'CHINA_PRESETS', CN_FIELDS, CN_VALUES),
  ...presetParams('acd', ACT, 'LAB_ARCHETYPES', LAB_FIELDS, LAB_VALUES, (id) =>
    id === 'leader' ? { kind: 'untagged', evidence: `no tag; ${LEADER_NOTE}`, notes: 'Leader row; weight 0 means never sampled. computeMult and gapYears are unused there and not registered.' } : undefined),

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
    id: 'acd.PRE_RATE0', ref: { kind: 'export', module: RIVM, symbol: 'PRE_RATE0' }, value: 0.48, unit: 'OOM/yr',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'sourced',
    evidence: 'rivalModel.ts:12-16 "Ho et al.\'s ≈ 0.48 OOM/yr of pretraining progress (3×/yr, research/20 B1) [R20 B1]"', source: 'research/20 B1 (Ho et al.)',
    notes: 'Pretraining recipe growth of the leader lab\'s day-0 research inputs.',
  },
  {
    id: 'acd.BASE_RUN_DAYS', ref: { kind: 'export', module: RIVM, symbol: 'BASE_RUN_DAYS' }, value: 121, unit: 'days',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'rivalModel.ts:17-18 "A base run trains for this many days on this share of the lab\'s training pool: RefBot\'s sizing (bases that train in ≈ 121 days on 60% of its pool, V1 notes; v2\'s 1F run) [D]."',
  },
  {
    id: 'acd.BASE_POOL_SHARE', ref: { kind: 'export', module: RIVM, symbol: 'BASE_POOL_SHARE' }, value: 0.6, unit: 'fraction of training pool',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'rivalModel.ts:17-18 "...on this share of the lab\'s training pool: RefBot\'s sizing ... [D]." (one comment above both constants)',
  },
  {
    id: 'acd.RIVAL_TPP', ref: { kind: 'export', module: RIVM, symbol: 'RIVAL_TPP' }, value: 400, unit: 'tokens per active parameter',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'derived',
    evidence: 'rivalModel.ts:21-24 "the reference design\'s (runDesign.ts REF_TPP, 400 since A6b) [R20 A1, D]"; `RIVAL_TPP = REF_TPP`',
    notes: 'Computed from REF_TPP (another file); the comment also tags [R20 A1, D] (DeepSeek-V3 about 400 tokens per active parameter).',
  },
  {
    id: 'acd.CL_POOL_SHARE', ref: { kind: 'export', module: RIVM, symbol: 'CL_POOL_SHARE' }, value: 0.15, unit: 'fraction of training pool',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'stand-in',
    evidence: 'rivalModel.ts:25-30 "[D: stand-in, the player\'s rule at aggregate level]" (one comment above CL_POOL_SHARE and CL_DAYS)',
    notes: 'Equals the player\'s STREAM_POOL_SHARE. Q-actors-data-4',
  },
  {
    id: 'acd.CL_DAYS', ref: { kind: 'export', module: RIVM, symbol: 'CL_DAYS' }, value: 7, unit: 'days',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'stand-in',
    evidence: 'rivalModel.ts:25-30 "[D: stand-in, the player\'s rule at aggregate level]" (one comment above CL_POOL_SHARE and CL_DAYS)',
    notes: 'Q-actors-data-4',
  },
  {
    id: 'acd.POST_DAYS', ref: { kind: 'export', module: RIVM, symbol: 'POST_DAYS' }, value: [42, 70], unit: 'days',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'sourced',
    evidence: 'rivalModel.ts:33-34 "Post-training cadence (days between versions on one base): Anthropic shipped 8 frontier versions in 16 months (research/12 §0.1) [R12]."', source: 'research/12 §0.1',
    notes: 'Array order = low, high.',
  },
  {
    id: 'acd.START_PUBLIC_GAP_OOM', ref: { kind: 'export', module: RIVM, symbol: 'START_PUBLIC_GAP_OOM' }, value: 0.18, unit: 'OOM of G',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'rivalModel.ts:36 "Public start model: this many OOM of G under the internal one at day 0 (v2\'s start gap) [D]. Was 0.15 progress-years."',
  },
  {
    id: 'acd.SERVE_RATE0', ref: { kind: 'export', module: RIVM, symbol: 'SERVE_RATE0' }, value: 0.2, unit: 'OOM/yr',
    area: 'actors', layer: 'world', actor: 'rivals', kind: 'fitted',
    evidence: 'rivalModel.ts:38-41 "what the reference lab\'s Inference-efficiency line adds in its first year (RefBot, ai2027, seed 2027; serving test V1) [fit]"',
    fit: { targets: [], script: 'unnamed' },
    notes: 'Fit to the reference lab\'s first-year inference-efficiency gain in the serving test V1; no script is named.',
  },

  // ───────────────────────── v2/blocs.ts ─────────────────────────
  // BLOCS records carry no per-record source; the file header (blocs.ts:1-4) cites research/08 for clout/approval and the agenda codes.
  {
    id: 'acd.BLOCS.clout', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'clout'] },
    area: 'actors', layer: 'world', actor: 'public', kind: 'sourced',
    evidence: 'blocs.ts:1 "Interest blocs (V2-SPEC §3.10.2; research/08 §1.16 clout/approval, Part 3 support/oppose codes)"',
    source: 'research/08 §1.16 (clout/approval)', notes: 'Q-actors-data-5',
  },
  {
    id: 'acd.BLOCS.cloutNov26', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'cloutNov26'] },
    area: 'actors', layer: 'world', actor: 'public', kind: 'untagged',
    evidence: 'no tag; blocs.ts:68 field `cloutNov26` and rows blocs.ts:71-100 (the header cites research/08 §1.16 for "clout/approval" without naming this field)',
    notes: 'Q-actors-data-5',
  },
  {
    id: 'acd.BLOCS.approval', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'approval'] },
    area: 'actors', layer: 'world', actor: 'public', kind: 'sourced',
    evidence: 'blocs.ts:1 "Interest blocs (V2-SPEC §3.10.2; research/08 §1.16 clout/approval, Part 3 support/oppose codes)"',
    source: 'research/08 §1.16 (clout/approval)', notes: 'Q-actors-data-5',
  },
  {
    id: 'acd.BLOCS.agenda', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'agenda', '*'] },
    unit: 'weight -3..+3', area: 'actors', layer: 'world', actor: 'public', kind: 'designer',
    evidence: 'blocs.ts:3-4 "Agenda weights −3..+3 per policy id, converted from research/08 Part 3 codes: \\"++\\" = +3, \\"+\\" = +1, \\"−\\" = −1, \\"−−\\" = −3 [conversion D]."',
    notes: 'Designer conversion of research/08 Part 3 support/oppose codes; one weight per bloc and policy id.',
  },

  // ───────────────────────── v2/agents.ts ─────────────────────────
  {
    id: 'acd.ENG_REF_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'ENG_REF_SHARE' }, value: 0.2, unit: 'fraction of agent compute',
    area: 'research', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'agents.ts:138 "Reference share of a lab\'s agent compute spent on engineering (coding for the build queue) [D]."',
    notes: 'Also the player\'s reference split (split.ts playerShareRef).',
  },
  {
    id: 'acd.REF_AGENT_SHARES', ref: { kind: 'export', module: AGENTS, symbol: 'REF_AGENT_SHARES' }, value: [0.2, 0.65, 0.15], unit: 'fraction of agent compute',
    area: 'research', layer: 'world', actor: 'rivals', kind: 'designer',
    evidence: 'agents.ts:142-143 "Reference shares of ALL of a lab\'s agent compute (the reference lab; mockups-v3 v3-company) [D]"',
    notes: 'Array order = eng, capRoutine, capFrontier; eng is ENG_REF_SHARE.',
  },
  {
    id: 'acd.DEFAULT_CAP_SHARES', ref: { kind: 'export', module: AGENTS, symbol: 'DEFAULT_CAP_SHARES' }, value: [1, 0.65 / (1 - 0.2), 0.15 / (1 - 0.2)], unit: 'share of the research agent pool',
    area: 'research', layer: 'policy', actor: 'player', kind: 'derived',
    evidence: 'agents.ts:145-148 "The player\'s default package shares: research uses as shares of the research agent pool (the reference shares net of engineering: 0.8125 / 0.1875)"; computed from REF_AGENT_SHARES and ENG_REF_SHARE',
    notes: 'Array order = eng, capRoutine, capFrontier; layer policy because it is the player\'s default setting (Q-actors-data-6).',
  },
  {
    id: 'acd.TRUST_EST_DEFAULT', ref: { kind: 'export', module: AGENTS, symbol: 'TRUST_EST_DEFAULT' }, value: 0.3, unit: 'probability',
    area: 'safety', layer: 'policy', actor: 'player', kind: 'designer',
    evidence: 'agents.ts:158-159 "SR-20: the trust line when the framework has no Misalignment-signs rule: upper end of believed SCHEME / AF / SAND ≤ 30% ... [D]."',
    notes: 'Q-actors-data-6',
  },
  {
    id: 'acd.MONITOR_STD_POOL_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'MONITOR_STD_POOL_SHARE' }, value: 0.2, unit: 'fraction of the safety pool',
    area: 'safety', layer: 'policy', actor: 'player', kind: 'designer',
    evidence: 'agents.ts:161-162 "Default monitoring budget, as a share of the old safety pool ... the pre-R7 runtime-monitoring reserve (`monitoringShare`) [D]."',
    notes: 'Q-actors-data-6',
  },
  {
    id: 'acd.SAFETY_AGENT_DEFAULT_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'SAFETY_AGENT_DEFAULT_SHARE' }, value: 0.2, unit: 'fraction of the safety pool',
    area: 'safety', layer: 'policy', actor: 'player', kind: 'designer',
    evidence: 'agents.ts:169 "Share of the safety pool the safety agents get when Trusted to AI is turned on with none running [D]."',
    notes: 'Q-actors-data-6',
  },
  {
    id: 'acd.SAFETY_AGENT_MAX_SHARE', ref: { kind: 'export', module: AGENTS, symbol: 'SAFETY_AGENT_MAX_SHARE' }, value: 0.6, unit: 'fraction of the safety pool',
    area: 'safety', layer: 'world', actor: 'player', kind: 'untagged',
    evidence: 'no tag; agents.ts:171 (the comment above, agents.ts:166-168, describes the 0–100% policy and the removed 50% cap, not this value)',
    notes: 'Upper limit on the player\'s Trusted-to-AI share.',
  },
]);
