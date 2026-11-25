# Balance tooling design (phase C)

Status: lead design, 2026-11-25. Tasks are in design/BAL-TASKS.md.

## Pieces
| ID | Piece | Depends on |
|---|---|---|
| C1 | `scripts/v2/balrun.ts`: parallel game runner writing one record per game | none |
| C2 | Bot settings object: RefBot and mixed-bot choices in one typed object; defaults reproduce today exactly | none (parallel with C1) |
| C3 | Parameter overrides in runs (`--set <param id>=<value>`), for object and table entries | C1 |
| C4 | `scripts/v2/baldash.ts`: static HTML dashboard from run records and the registries | C1's record format (below) |
| C5 | Sensitivity screening (one-at-a-time or Morris) over registry params | C1, C3 |
| C6 | Bot perturbation scan + headroom check (HANDOFF-BOTS A1 items 3–4) | C1, C2 |

## Run layout (git-ignored)
```
balance/runs/<name>/
  config.json      the exact CLI args, git commit, code hash, seed list, start time
  games.jsonl      one GameRecord per line, appended by workers as games finish
  progress.json    { done, total, gamesPerMin, startedAt, updatedAt } (rewritten every ~10 s)
  summary.json     written at the end: per-cell aggregates (below)
```
A long run is started in the background and returns at once. Nobody reads `games.jsonl` by eye: the summary and the dashboard are the readers.

## GameRecord (one line per game)
```ts
interface GameRecord {
  run: string; seed: number;
  world: string; alignment: string; start: string; policy: string;   // the cell
  overrides?: Record<string, number | string | boolean>;             // C3 --set values (registry ids)
  endDay: number; ending: string; verdict: 'win' | 'mixed' | 'loss';
  milestones: { SC?: number; SAR?: number; SIAR?: number; ASI?: number };  // game day, absent if not reached
  pMisAtEnd?: number; pMisAtASI?: number;
  revenueByYear?: number[];    // player annual revenue at day 365, 730, ...
  minCash?: number; insolvent?: boolean;
  rivalLeadAtSC?: number;      // days the best rival is ahead (+) or behind (-) at the player's SC
  chinaGapAtSC?: number;
  scores?: Record<string, number>;   // end-screen terms
  ms: number;                  // wall time of the game
}
```
Fields the engine doesn't expose easily are left out, not faked; list them in the task report.

## Summary cell
A cell is (world, alignment, start, policy, override set). For each cell:
- n;
- win/mixed/loss rates with a 95% Wilson interval;
- ending mix;
- p10/p50/p90 of each milestone day;
- p50 `pMisAtASI`;
- the insolvency rate.

## Seeds
- Paired seeds: every cell of a run uses the same seed list, so differences between cells aren't seed noise.
- Default list: `CAL_SEEDS` first, then 1001, 1002, … up to `--seeds N`.

## Scenarios
The world presets and alignment draws that exist today (ai2027, authors2026, fast, slow, sampled × medium/sampled) are the scenario cells for now. Scenario axes (alignment difficulty, capability ease, adoption speed, ...) are a designer topic (see B6 and the designer's framing in BAL-TASKS). The runner takes world and alignment as plain cell keys, so new axes slot in later without a format change.
