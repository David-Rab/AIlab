// B3 inventory: actors data (src/data/actors.ts presets, src/data/world.ts v1 integrator and world presets and
// baselines, src/data/v2/{rivalModel,blocs,agents}.ts). Prefix `acd`. The actor engine (src/engine/v2/actors/*) is in
// actors-engine.ts; this file holds only the data tables the engine reads.
// Per-preset bundles (GOV_PRESETS, PUBLIC_PRESETS, CHINA_PRESETS, LAB_ARCHETYPES, BASELINES) are one entry per preset
// and field, built by `presetParams` from the value tables below. The values are written out here (not read from the
// game) so the lint can compare them with the live data.
import { defineParams, type Param } from '../schema';

const ACT = 'src/data/actors.ts';
const WORLD = 'src/data/world.ts';
const RIVM = 'src/data/v2/npcLabs.ts';
const BLOCS = 'src/data/v2/blocs.ts';
const AGENTS = 'src/data/v2/agents.ts';

type Field = {
  name: string; unit?: string; area: Param['area']; layer: Param['layer']; actor?: Param['actor'];
  kind?: Param['kind']; evidence?: string; source?: string; notes?: string;
};
type Preset = { id: string; values: (number | number[])[]; skip?: string[] };

/** One entry per preset and field. `fields[i]` describes `preset.values[i]`; `index` is the preset's array index. A field
 *  with no `kind` takes it from `override` (the research-row tables below); a preset or field the override leaves alone
 *  keeps the field's own kind and evidence. */
function presetParams(prefix: string, module: string, symbol: string, fields: Field[], presets: Preset[], override?: (preset: string, f: Field) => Partial<Field> | undefined): Param[] {
  const out: Param[] = [];
  presets.forEach((p, index) => {
    fields.forEach((f0, i) => {
      if (p.skip?.includes(f0.name)) return;
      const f = { ...f0, ...(override?.(p.id, f0) ?? {}) };
      if (!f.kind || !f.evidence) throw new Error(`${prefix}.${symbol}.${p.id}.${f.name}: no kind or evidence`);
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

// Research-row checks (CLASSIFY A1). For each preset the research row is quoted once; every field is then one of:
//   true          the row states this number: sourced
//   { s: note }   sourced, with a note on how the row states it
//   string        designer: the row does not list the field, or lists a different number (the string says which)
//   { q: note }   unclear: CLASSIFY does not settle it (see the notes file)
//   null          the field keeps its own kind and evidence
// research/07-actors.md:18 says "A preset is a set of multipliers on a common parameter schema"; it does not say that
// fields a row leaves out are baseline, so an unlisted field is a designer value.
type Cell = true | string | { s: string } | { q: string } | null;
type Row = { name: string; file: string; line: number; text: string; weight: string; cells: Record<string, Cell> };
const R07 = 'research/07-actors.md';
const R10 = 'research/10-china.md';
const N07 = 'not in research/07';
const N10 = 'not in research/10';

function rowOverride(rows: Record<string, Row>) {
  return (id: string, f: Field): Partial<Field> | undefined => {
    const r = rows[id];
    if (!r) return undefined;
    if (!(f.name in r.cells)) throw new Error(`${id}.${f.name}: no cell`);
    const c = r.cells[f.name];
    if (c === null) return undefined;
    const where = `${r.file}:${r.line} ${r.name}`;
    const quoted = f.name === 'weight' ? `${where} "Realistic weight ${r.weight}"` : `${where} "${r.text}"`;
    const join = (n?: string) => [f.notes?.replace(/\.$/, ''), n].filter(Boolean).join('; ') || undefined;
    const source = `${r.file}:${r.line}`;
    if (c === true) return { kind: 'sourced', evidence: quoted, source };
    if (typeof c === 'string') return { kind: 'designer', evidence: quoted, notes: join(c) };
    if ('s' in c) return { kind: 'sourced', evidence: quoted, source, notes: join(c.s) };
    return { kind: 'unclear', evidence: quoted, notes: join(c.q) };
  };
}

// ───────────────────────── actors.ts: GOV_PRESETS ─────────────────────────
const GOV_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'gov',
    notes: 'Probability a sampled world draws this government personality; the five weights sum to 100.' },
  { name: 'accel', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov' },
  { name: 'security', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov' },
  { name: 'reg', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov' },
  { name: 'transactional', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov' },
  { name: 'hawk', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov' },
  { name: 'natThreshold', area: 'actors', layer: 'policy', actor: 'gov', notes: 'Nationalization index above which the government escalates (gov.ts:141, :152, :154)' },
  { name: 'lag', unit: 'days', area: 'actors', layer: 'policy', actor: 'gov', notes: 'Hold time before a security rung (gov.ts:143, 0.7 x lag, floor 7 days)' },
  { name: 'pollSensitivity', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'gov' },
];
const GOV_VALUES: Preset[] = [
  { id: 'dealmaker', values: [45, 1.5, 0.8, 0.4, 1.6, 0.8, 85, 20, 1] },
  { id: 'hawk', values: [25, 1.1, 1.6, 0.7, 1, 1.6, 60, 10, 1] },
  { id: 'populist', values: [13, 1, 1, 1.2, 1.2, 1.1, 70, 15, 2] },
  { id: 'regulator', values: [12, 0.8, 1.2, 1.6, 0.6, 0.9, 70, 25, 1.2] },
  { id: 'absentee', values: [5, 0.6, 0.6, 0.6, 1, 0.6, 90, 45, 0.6] },
];
const GOV_ROWS: Record<string, Row> = {
  dealmaker: { name: 'Dealmaker', file: R07, line: 70, weight: '45%', text: 'accel 1.5, transactional 1.6, reg 0.4, security 0.8, hawk 0.8, nat_threshold 85, lag 20',
    cells: { weight: true, accel: true, security: true, reg: true, transactional: true, hawk: true, natThreshold: true, lag: true, pollSensitivity: N07 } },
  hawk: { name: 'Security Hawk', file: R07, line: 71, weight: '25%', text: 'security 1.6, hawk 1.6, accel 1.1, reg 0.7, nat_threshold 60, lag 10',
    cells: { weight: true, accel: true, security: true, reg: true, transactional: N07, hawk: true, natThreshold: true, lag: true, pollSensitivity: N07 } },
  populist: { name: 'Populist', file: R07, line: 73, weight: '13%', text: 'reg 1.2 (only when Public.Concern > 60), accel 1.0, transactional 1.2, poll_sensitivity 2.0, lag 15',
    cells: { weight: true, accel: true, security: N07, reg: { s: 'research/07 conditions it on Public.Concern > 60; the preset field carries no condition' }, transactional: true, hawk: N07, natThreshold: N07, lag: true, pollSensitivity: true } },
  regulator: { name: 'Cautious Regulator', file: R07, line: 72, weight: '12%', text: 'reg 1.6, accel 0.8, security 1.2, hawk 0.9, transactional 0.6, nat_threshold 70, lag 25',
    cells: { weight: true, accel: true, security: true, reg: true, transactional: true, hawk: true, natThreshold: true, lag: true, pollSensitivity: N07 } },
  absentee: { name: 'Absentee', file: R07, line: 74, weight: '5%', text: 'all biases 0.6, lag 45, nat_threshold 90',
    cells: { weight: true, accel: { s: 'accel_bias, "all biases 0.6"' }, security: { s: 'security_bias, "all biases 0.6"' }, reg: { s: 'reg_bias, "all biases 0.6"' },
      transactional: N07, hawk: { s: 'hawk_bias, "all biases 0.6"' }, natThreshold: true, lag: true, pollSensitivity: 'not in research/07; poll_sensitivity is not one of the *_bias params that "all biases 0.6" names' } },
};

// ───────────────────────── actors.ts: PUBLIC_PRESETS ─────────────────────────
const PUB_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'public',
    notes: 'Probability a sampled world draws this public mood; the five weights sum to 100.' },
  { name: 'shock', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public' },
  { name: 'halfLife', unit: 'days', area: 'actors', layer: 'world', actor: 'public', notes: 'Concern decays toward base with ln2 / halfLife per day (public.ts:37)' },
  { name: 'jobs', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public' },
  { name: 'xrisk', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public' },
  { name: 'benefit', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public' },
  { name: 'mobilization', unit: 'multiplier', area: 'actors', layer: 'world', actor: 'public' },
];
const PUB_VALUES: Preset[] = [
  { id: 'anxious', values: [50, 1, 120, 1.2, 1, 0.7, 0.8] },
  { id: 'backlash', values: [22, 1.1, 150, 1.6, 0.9, 0.6, 1.5] },
  { id: 'optimist', values: [10, 0.7, 45, 0.8, 0.7, 1.6, 0.5] },
  { id: 'doomer', values: [10, 1.3, 140, 1, 1.8, 0.7, 1.2] },
  { id: 'distracted', values: [8, 0.6, 60, 0.8, 0.7, 0.8, 0.4] },
];
const PUB_ROWS: Record<string, Row> = {
  anxious: { name: 'Anxious Majority', file: R07, line: 159, weight: '50%', text: 'shock 1.0, decay half-life 120 d, jobs 1.2, xrisk 1.0, benefit 0.7, mobilization 0.8',
    cells: { weight: true, shock: true, halfLife: true, jobs: true, xrisk: true, benefit: true, mobilization: true } },
  backlash: { name: 'Populist Backlash', file: R07, line: 160, weight: '22%', text: 'jobs 1.6, mobilization 1.5, DC_NIMBY growth ×2, OB_Approval drift −0.05/day while OB is in the news',
    cells: { weight: true, shock: N07, halfLife: N07, jobs: true, xrisk: N07, benefit: N07, mobilization: true } },
  optimist: { name: 'Tech Optimist', file: R07, line: 161, weight: '10%', text: 'benefit 1.6, decay half-life 45 d, shock 0.7, mobilization 0.5',
    cells: { weight: true, shock: true, halfLife: true, jobs: N07, xrisk: N07, benefit: true, mobilization: true } },
  doomer: { name: 'Doomer Wave', file: R07, line: 162, weight: '10%', text: 'xrisk 1.8, shock 1.3, mobilization 1.2',
    cells: { weight: true, shock: true, halfLife: N07, jobs: N07, xrisk: true, benefit: N07, mobilization: true } },
  distracted: { name: 'Distracted', file: R07, line: 163, weight: '8%', text: 'shock 0.6, salience cap 8, mobilization 0.4',
    cells: { weight: true, shock: true, halfLife: N07, jobs: N07, xrisk: N07, benefit: N07, mobilization: true } },
};

// ───────────────────────── actors.ts: CHINA_PRESETS ─────────────────────────
// The preset names in research/10 differ from the code's (Fast Follower = fastfollower, Open-Source Diffuser = diffuser,
// Self-Reliance Fortress = selfreliant, Centralized Sprint = nationalizer, Hawkish Gambler = gambler (a sub-roll of the
// Sprint), Cautious Stabilizer = bargainer). The `hawk` field is an absolute Hawk_vs_Dove score; research/10 gives
// offsets from a start of 45 ("45 [D]", research/10-china.md:39).
const CN_FIELDS: Field[] = [
  { name: 'weight', unit: 'percent (draw probability)', area: 'actors', layer: 'world', actor: 'china',
    notes: 'Probability a sampled world draws this China posture; the six weights sum to 100.' },
  { name: 'centralize', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china' },
  { name: 'theft', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china' },
  { name: 'taiwan', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china' },
  { name: 'treaty', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china' },
  { name: 'openSource', unit: 'multiplier', area: 'actors', layer: 'policy', actor: 'china' },
  { name: 'hawk', area: 'actors', layer: 'policy', actor: 'china', notes: 'Hawkishness score, 30-80' },
];
const CN_VALUES: Preset[] = [
  { id: 'fastfollower', values: [35, 0.5, 0.7, 0.8, 1, 1.3, 40] },
  { id: 'diffuser', values: [20, 0.6, 0.8, 0.7, 1.2, 1.8, 35] },
  { id: 'selfreliant', values: [20, 1, 0.9, 0.6, 1, 1, 45] },
  { id: 'nationalizer', values: [10, 1.6, 1.6, 1.3, 0.7, 0.3, 65] },
  { id: 'gambler', values: [5, 1.6, 1.6, 2, 0.4, 0.3, 80] },
  { id: 'bargainer', values: [10, 1, 0.8, 0.6, 1.8, 0.9, 30] },
];
const GAMBLER_Q = 'the row gives only taiwan 2.0 and treaty 0.4; the Gambler is a sub-roll of the Centralized Sprint, but CLASSIFY does not say whether a sub-roll inherits the parent row (Q-actors-data-8)';
const CN_ROWS: Record<string, Row> = {
  fastfollower: { name: 'Fast Follower', file: R10, line: 51, weight: '35%', text: 'centralize 0.5, distill 1.5, open 1.3, theft 0.7, taiwan 0.8, treaty 1.0, cost_efficiency +25%',
    cells: { weight: true, centralize: true, theft: true, taiwan: true, treaty: true, openSource: { s: 'research/10 names it "open"' }, hawk: N10 } },
  diffuser: { name: 'Open-Source Diffuser', file: R10, line: 52, weight: '20%', text: 'open 1.8, norms_diplo +20, global_share_bonus, theft 0.8, taiwan 0.7',
    cells: { weight: true, centralize: N10, theft: true, taiwan: true, treaty: 'not in research/10 (the row has norms_diplo +20, no treaty)', openSource: { s: 'research/10 names it "open"' }, hawk: N10 } },
  selfreliant: { name: 'Self-Reliance Fortress', file: R10, line: 53, weight: '20%', text: 'self_reliance 1.8, domestic_fab ×1.5, US_chip_uptake 0.3, smuggling 0.8, taiwan 0.6, centralize 1.0',
    cells: { weight: true, centralize: true, theft: N10, taiwan: true, treaty: N10, openSource: N10, hawk: N10 } },
  nationalizer: { name: 'Centralized Sprint', file: R10, line: 54, weight: '15% (sub-roll: 1 in 3 is the Hawkish Gambler tail ... about 5% overall)',
    text: 'centralize 1.6, theft 1.6, open → 0.3 after rung 3, taiwan 1.3, treaty 0.7 (offers only from weakness), hawk +20',
    cells: { weight: { s: '15% less the Gambler tail of 1 in 3 (about 5% overall) = 10' }, centralize: true, theft: true, taiwan: true, treaty: true,
      openSource: 'research/10 says "open → 0.3 after rung 3"; the preset field holds 0.3 with no rung condition',
      hawk: { q: 'research/10 gives hawk +20 and a start of 45 [D]; 65 is 45 + 20, a sum of two research numbers that the text does not state (Q-actors-data-9)' } } },
  gambler: { name: 'Hawkish Gambler', file: R10, line: 54, weight: '15% (sub-roll: 1 in 3 is the Hawkish Gambler tail, taiwan 2.0, treaty 0.4, about 5% overall)',
    text: 'sub-roll: 1 in 3 is the Hawkish Gambler tail, taiwan 2.0, treaty 0.4, about 5% overall',
    cells: { weight: true, centralize: { q: GAMBLER_Q }, theft: { q: GAMBLER_Q }, taiwan: true, treaty: true, openSource: { q: GAMBLER_Q },
      hawk: 'research/07-actors.md:281 says Taiwan Gambler "hawk +30" (75 from a start of 45); the code has 80' } },
  bargainer: { name: 'Cautious Stabilizer', file: R10, line: 55, weight: '10%', text: 'treaty 1.8, verification +25, safety +25, taiwan 0.6, theft 0.8',
    cells: { weight: true, centralize: N10, theft: true, taiwan: true, treaty: true, openSource: N10, hawk: N10 } },
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
  // ───────────────────────── actors.ts: presets (per preset and field) ─────────────────────────
  ...presetParams('acd', ACT, 'GOV_PRESETS', GOV_FIELDS, GOV_VALUES, rowOverride(GOV_ROWS)),
  ...presetParams('acd', ACT, 'PUBLIC_PRESETS', PUB_FIELDS, PUB_VALUES, rowOverride(PUB_ROWS)),
  ...presetParams('acd', ACT, 'CHINA_PRESETS', CN_FIELDS, CN_VALUES, rowOverride(CN_ROWS)),

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

  // ───────────────────────── v2/blocs.ts ─────────────────────────
  // BLOCS records carry no per-record source; the file header (blocs.ts:1-4) cites research/08 for clout/approval and the agenda codes.
  {
    id: 'acd.BLOCS.clout', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'clout'] },
    area: 'actors', layer: 'world', actor: 'public', kind: 'designer',
    evidence: 'blocs.ts:1 "Interest blocs (V2-SPEC §3.10.2; research/08 §1.16 clout/approval, ...)"; research/08-policy-ecosystem.md:664-690 table "Clout Jul-25", all rows equal; line 690 "All clout and approval numbers are [D] calibrations."',
    source: 'research/08-policy-ecosystem.md §1.16 (table, Clout Jul-25)', notes: 'The cited table states every value, and tags them [D] (CLASSIFY A2: [D] plus a research pointer).',
  },
  {
    id: 'acd.BLOCS.cloutNov26', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'cloutNov26'] },
    area: 'actors', layer: 'world', actor: 'public', kind: 'designer',
    evidence: 'blocs.ts:1 header cites research/08 §1.16 "clout/approval"; research/08-policy-ecosystem.md:664-690 table "Clout Nov-26" (all rows equal), "All clout and approval numbers are [D] calibrations." and "Calibration logic for the Nov 2026 column"',
    source: 'research/08-policy-ecosystem.md §1.16 (table, Clout Nov-26)', notes: 'The second starting column (research/08:13); the cited table states every value, tagged [D] (CLASSIFY A2).',
  },
  {
    id: 'acd.BLOCS.approval', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'approval'] },
    area: 'actors', layer: 'world', actor: 'public', kind: 'designer',
    evidence: 'blocs.ts:1 "Interest blocs (V2-SPEC §3.10.2; research/08 §1.16 clout/approval, ...)"; research/08-policy-ecosystem.md:664-690 table "Default Approval_OB", all rows equal; line 690 "All clout and approval numbers are [D] calibrations."',
    source: 'research/08-policy-ecosystem.md §1.16 (table, Default Approval_OB)', notes: 'The cited table states every value, and tags them [D] (CLASSIFY A2).',
  },
  {
    id: 'acd.BLOCS.agenda', ref: { kind: 'export', module: BLOCS, symbol: 'BLOCS', path: ['*', 'agenda', '*'] },
    unit: 'weight -3..+3', area: 'actors', layer: 'world', actor: 'public', kind: 'designer',
    evidence: 'blocs.ts:3-4 "Agenda weights −3..+3 per policy id, converted from research/08 Part 3 codes: \\"++\\" = +3, \\"+\\" = +1, \\"−\\" = −1, \\"−−\\" = −3 [conversion D]."',
    source: 'research/08-policy-ecosystem.md Part 3 (support/oppose codes)',
    notes: 'Designer conversion of the Part 3 support/oppose codes; one weight per bloc and policy id.',
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
