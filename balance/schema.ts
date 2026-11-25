// Balance registry schema (design/bal/REGISTRY-DESIGN.md §3 and §4). Registries point at game constants; they never
// replace them. scripts/v2/registry-lint.ts keeps them in sync with the game.

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
  value: { p50?: number; lo?: number; hi?: number; unit?: string };
  tolerance?: string;      // as implemented today (e.g. GOLDEN_TOL ±0.08 y)
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
