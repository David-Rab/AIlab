# Registry design (B1)

Status: draft for designer approval, 2026-11-25. Built on [B0-SCOUT.md](B0-SCOUT.md).

## 1. Purpose

Two machine-readable registries that the balance tooling reads, so balancing can be re-run automatically after game changes:
- **Parameter registry**: what each number is, where it comes from, how far it may move, and who may move it.
- **Target registry**: what the game is checked against, how strong the evidence is, and whether a target may be used for fitting.

The standard this follows is the parameter table of the ODD protocol for agent-based models (Grimm et al.), plus the fit / held-out split from simulation calibration.

## 2. Hard rules

- **The game is not touched.** The registries live in a new top-level `balance/` folder, outside `src/`. They *point at* constants and never replace them. Game behaviour and the simulation cache (which hashes `src/`) are unchanged.
- **A lint keeps the registries honest.** `scripts/v2/registry-lint.ts`:
  - resolves every entry's reference;
  - checks that the recorded value equals the live value;
  - checks that each fitted parameter names a target that exists;
  - reports coverage: named constants in `src/data` and `src/engine` that have no entry.

  This is what makes the system maintainable. After a game change, the lint lists what's new, changed or gone.
- **Agents don't invent provenance.** A kind or range comes from evidence in the code or docs (a comment tag, a cited source, a research note). With no evidence, it is `untagged`. Unclear cases go to a question list for the lead and the designer.

## 3. Parameter entry

```ts
interface Param {
  id: string;              // stable, e.g. 'cap.V3_CAL.ai2027.gSC'
  ref: ExportRef | InlineRef;
  value?: number | number[] | string; // snapshot; the lint compares it with the live value. Required unless path contains '*' (a field family)
  unit?: string;           // 'OOM', 'days', 'USD/yr', 'fraction', ...
  area: Area;              // 'capability' | 'research' | 'safety' | 'security' | 'market' | 'finance' | 'worldfx' | 'actors' | 'bots' | 'core'
  layer: 'world' | 'policy';  // world = how the world works; policy = how an actor (bot, rival, China, gov) chooses
  actor?: 'player' | 'rivals' | 'leader' | 'china' | 'gov' | 'public' | 'model' | 'all';
  kind: 'sourced' | 'derived' | 'fitted' | 'designer' | 'stand-in' | 'untagged' | 'unclear';
  evidence: string;        // the tag or comment that justifies `kind`, quoted short, with file:line
  source?: string;         // citation or research note ref (research/CAL-world-sources.md#..., paper)
  grade?: 'A' | 'B' | 'C'; // only if the code or note states one (edges.ts style)
  range?: { lo: number; hi: number; from: string }; // only if a source or comment states it; `from` says where
  fit?: { targets: string[]; script: string };       // kind 'fitted' only
  perPreset?: boolean;     // differs by world preset
  notes?: string;          // one line max
}
type ExportRef = { kind: 'export'; module: string; symbol: string; path?: (string | number)[] };
type InlineRef = { kind: 'inline'; file: string; anchor: string };  // anchor = exact code snippet, located by search
```

- **Granularity.**
  - One entry per named scalar.
  - For tables of records (the tech tree, agendas, sectors, deals), one entry per *field family*, e.g. `safety.agendas[*].oom`. Its `evidence` notes where per-record sources live (e.g. "each record has `src`").
  - Records with no per-record source get one entry per record only when they differ in provenance.
- **Inline literals.** About 12k numbers sit inline in engine formulas, and most are structure, not balance (0, 1, 365, unit conversions). Inventories register only *notable* inline literals as `InlineRef`: coefficients, thresholds, rates, caps and probabilities that a designer could plausibly tune. Each one is a candidate for later extraction to a named constant (a separate, proven-identical refactor, not in this phase).
- **Excluded:** glossary prose, UI layout numbers, unit conversions, and test fixtures.
- **Bot policy choices** (RefBot's research list, cadence, shares, thresholds; the mixed bot's thresholds) are `layer: 'policy'`. This list later becomes the single policy settings object of HANDOFF-BOTS A1.

## 4. Target entry

```ts
interface Target {
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
```

Scope: calibration and balance targets only. These are the CAL2 table, `GOLDEN_*`, the T1–T4 targets in `calib.ts`/`ws4.ts`/`rivals.ts`, the §7.4 bot criteria, the start-label rule, and the S/F/W/FC series. The roughly 1,000 structural and unit `check()` calls are tests, not targets, and stay as they are.

## 5. Files

```
balance/
  schema.ts            types above + small helpers
  params/<area>.ts     export const PARAMS_<AREA>: Param[]
  targets.ts           export const TARGETS: Target[]
  questions.md         open classification questions from inventories (id, question, evidence)
scripts/v2/registry-lint.ts   resolve refs, compare values, cross-check fit links, coverage report
```

`tsconfig.json` gets `"balance"` added to `include`, so `npm run typecheck` covers it. That is the only change outside the new files.

## 6. Tasks after approval

| ID | Task | Effort | Done when |
|---|---|---|---|
| B2 | `balance/schema.ts` + `registry-lint.ts` + one worked example per ref kind (5–10 entries in `params/capability.ts`, 2 targets) | Sonnet medium | typecheck passes; lint resolves the examples and catches a deliberately wrong value in a throwaway test |
| B3.1–B3.10 | Parameter inventory per B0 chunk (chunks 1–9, 8 split in two) | Sonnet high | its `params/<area>.ts` lints clean; questions appended; report lists counts by kind |
| B4 | Target inventory (B0 chunk 10) | Sonnet high | `targets.ts` lints clean; every CAL2 row and §7.4 criterion present |
| B5 | Review: kind counts, untagged list, questions | lead | summary to designer |
| B6 | Target discussion with the designer: what we calibrate against. The current targets are probably neither enough nor the right ones (designer, 2026-11-25), so this covers new targets as well as keep / upgrade / demote / replace and fit vs held-out for the existing ones | lead + designer | agreed target list; `audit` filled; new targets added as entries |

Inventories run about 5 at a time. Each is read-only on `src/` and writes only its own registry file, so they never conflict.

After B6, the next phase builds on the registries: the bots runner in parallel processes, one policy settings object (from the `policy` entries), the sensitivity scan, calibration against reference policies with fit / held-out targets, and the difficulty ladder.
