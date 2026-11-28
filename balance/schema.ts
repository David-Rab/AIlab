// Balance registry schema (design/bal/REGISTRY-DESIGN.md §3 and §4). Registries point at game constants; they never
// replace them. scripts/v2/registry-lint.ts keeps them in sync with the game.
//
// One home per sourced number (design/TESTING.md §0; balance session 2026-11-28):
//   balance/scenarios.ts  the sourced values: history and per-timeline checkpoints, each with its source.
//   balance/targets.ts    bands, tolerances and how they are measured. A target whose band comes from a sourced value
//                         names its checkpoint (`checkpoint`) and holds no copy of the number (no `value`); its band is
//                         the checkpoint's numbers plus the target's own `slack` / `slackRel`.
// The reference runs one way only: a target names its checkpoint; a checkpoint never names a target (a reader that wants
// the reverse link, e.g. the dashboard, computes it). The one resolver is bandOf (scripts/v2/calreport/types.ts).
// scripts/v2/registry-lint.ts and scenarios-lint.ts enforce this.

export type JsonValue = number | string | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type Area =
  | 'capability' | 'research' | 'safety' | 'security' | 'market' | 'finance' | 'worldfx' | 'actors' | 'bots' | 'core';

/** A named export of a module, optionally a path into it. `'*'` in the path means every element or key at that level. */
export type ExportRef = { kind: 'export'; module: string; symbol: string; path?: (string | number)[] };
/** A literal written inline in a formula; `anchor` is an exact code snippet that occurs once in `file`. */
export type InlineRef = { kind: 'inline'; file: string; anchor: string };

export interface Param {
  id: string;              // stable, e.g. 'cap.V3_CAL.ai2027.gSC'
  ref: ExportRef | InlineRef;
  value?: JsonValue; // snapshot; the lint compares it with the live value. Required unless path contains '*' (a field family)
  unit?: string;           // 'OOM', 'days', 'USD/yr', 'fraction', ...
  area: Area;
  layer: 'world' | 'policy';  // world = how the world works; policy = how an actor (bot, rival, China, gov) chooses
  actor?: 'player' | 'rivals' | 'leader' | 'china' | 'gov' | 'public' | 'model' | 'all'; // whose behaviour or state this number describes; 'model' = the AI model as an agent (e.g. scheming). Omit for world-wide physics such as capability thresholds
  kind: 'sourced' | 'derived' | 'fitted' | 'designer' | 'stand-in' | 'untagged' | 'unclear';
  evidence: string;        // the tag or comment that justifies `kind`, quoted short, with file:line
  source?: string;         // citation or research note ref (research/CAL-world-sources.md#..., paper)
  grade?: 'A' | 'B' | 'C'; // only if the code or note states one (edges.ts style)
  range?: { lo: number; hi: number; from: string }; // only if a source or comment states it; `from` says where
  fit?: { targets: string[]; script: string };       // kind 'fitted' only
  perPreset?: boolean;     // differs by world preset
  notes?: string;          // one line max
}

export interface Target {
  id: string;              // e.g. 'T1.ai2027.SC', 'METR.h50.doubling'
  statement: string;       // plain words: what must be true
  type: 'point' | 'interval' | 'rate' | 'trajectory' | 'response' | 'ordering' | 'invariant' | 'distribution';
  metric: string;          // how it is measured: script + function or check label, statistic (median of N seeds, p10/p90, ...)
  presets?: string[];
  policy?: 'ref' | 'leader-lab' | 'mixed' | 'race' | 'safe' | 'any' | 'best';  // whose play is measured
  /** The band, for a target with no sourced value of its own (a design rule, an invariant, a tolerance). Omitted when
   *  `checkpoint` is set: then the numbers and the unit come from the checkpoint (one home per sourced number). */
  value?: { p50?: number; lo?: number; hi?: number; unit?: string };
  /** The scenario checkpoint(s) in balance/scenarios.ts (CHECKPOINTS) that hold this target's sourced value. Several ids
   *  (same unit) give the hull of their values (and bands): a target that spans several dated readings. */
  checkpoint?: string | string[];
  /** Which numbers of a single checkpoint form the band: its source band lo..hi ('band', the default when it has one)
   *  or its central value only ('value': then the band is value ± the slack). */
  use?: 'band' | 'value';
  tolerance?: string;      // as implemented today (e.g. GOLDEN_TOL ±0.08 y), in words
  /** Numeric tolerance the calibration report applies (same unit as the band): a number is added outside lo/hi, or ±
   *  around p50 when lo/hi are absent; a pair [below, above] widens each side by its own amount. */
  slack?: number | [number, number];
  slackRel?: number;       // tolerance as a fraction of the central value (± around p50; only with no lo/hi), e.g. 0.3 for ±30%
  source: string;          // as stated today
  grade?: 'A' | 'B' | 'C'; // stated grade only
  role: 'fit' | 'holdout' | 'invariant' | 'info' | 'unassigned';  // inventories write 'unassigned' unless code states the role
  fits?: string[];         // param ids this target is used to fit, if any
  tier?: 'commit' | 'cal' | 'nightly';
  checkLabels: string[];   // existing check() labels that implement it, for traceability
  known?: string;          // KNOWN deviation text, if any
  audit?: { verdict: 'keep' | 'upgrade' | 'demote' | 'replace'; why: string };  // filled by lead + designer, not inventories
}

/** Identity helpers so registry files are type-checked. */
export const defineParams = (p: Param[]): Param[] => p;
export const defineTargets = (t: Target[]): Target[] => t;
