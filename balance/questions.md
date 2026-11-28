# Open classification questions

Questions from registry inventories for the lead and the designer. One row per question.

| id | question | evidence |
|---|---|---|
| Q-B2-1 | `FITTED_EFFORT_TM.P05` is not fitted by `--fit-tree` itself: P05 fails in the fit world and takes the fitted ones' mean ratio (x0.6). Register as `fitted` (done, as instructed) or `derived`? | `src/data/v2/tree.ts:111-112` "P05 (it fails in the fit world) takes the fitted ones' mean ratio (×0.6)" |
| Q-B2-2 | `T-tree.durations` (deleted 2026-11-28, H) target values live in `V1_DAYS` (V1 RefBot attempt durations per preset), not in a `GOLDEN_*` table. The registry holds it as one target with no p50; should each preset/project get its own target? | `scripts/v2/calib.ts:174-179` |

## Answers (lead)
- Q-B2-1: `derived` (changed in params/capability.ts).
- Q-B2-2: keep one target for now; B6 (target discussion with the designer) decides.

Inventory agents write their questions to `design/bal/inv/<chunk>-questions.md`, not here; the lead merges them.
