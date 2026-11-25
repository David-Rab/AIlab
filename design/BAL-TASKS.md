# Balance system: task file

Branch `bal`, worktree `C:\Users\david\Documents\projects\AI27-bal`, started 2026-11-25 from master cd352aa.
Background: `../AI27-vision/design/vision/BALANCE.md` and `HANDOFF-BOTS.md` (uncommitted, branch `vision`).

## Scope (designer, 2026-11-25)
- No game-mechanics changes. Registries are metadata; any refactor must reproduce same-seed results exactly.
- Bots and balance tooling in scope. Refits only with designer approval. Rivals: registry tags only; behaviour changes are proposals.

## Working style (experiment)
- Lead: Opus 5.5 (main session): design, briefs, review. Workers: Sonnet 5.5, effort high or medium, never low.
- Small contexts: run and analysis are separate agents; results go to files; reports of about 15 lines.
- Outputs land in `design/bal/` unless a task says otherwise.

## Tasks

| ID | Task | Model / effort | Status | Output |
|---|---|---|---|---|
| B0 | Scout: how constants and targets are organised today | Sonnet high | done | design/bal/B0-SCOUT.md |
| B1 | Registry schema design | Opus (lead) | approved 2026-11-25 | design/bal/REGISTRY-DESIGN.md |
| B2 | Schema + lint + worked examples | Sonnet medium | running | balance/, scripts/v2/registry-lint.ts |
| B3.x, B4 | Inventories (params by area, targets) | Sonnet high | after B2 | balance/params/*.ts, balance/targets.ts |
| B5, B6 | Review; target discussion with designer | lead (+ designer) | after inventories | |

Designer note (2026-11-25): the current calibration targets are probably neither enough nor the right ones. What we calibrate against gets its own discussion (B6). The target inventory only records what exists.

## Experiment log
One row per delegated task: first-pass result (accepted / rework / redo), wall time, notes.

| ID | Result | Time | Notes |
|---|---|---|---|
| B0 | accepted first pass | 4 min, 97k tokens | All 7 questions answered with file:line; flagged its own uncertainties (src/ui unscanned, _xxx dirs, heuristic counts). No rework. |
