# Back-of-envelope estimates: tasks (lead's file; resume from here)

Designer go-ahead 2026-11-28 ("yes to all"): E1 runner + first set, E2 extractions, E3 safetyrates; registry/scenarios
homes with the balance session (it decided: scenarios.ts = sourced values, targets.ts = bands + how measured, by
reference; delete orphans + non-targets; add safetyrates' 17 bands; money entries → money session, OPEN.md row).
Maps: MAP-A.md, MAP-B.md. Rules: design/TESTING.md §0; skill good-tests.

| id | what | state |
|---|---|---|
| skeleton | scripts/v2/estimates.ts, estimates/types.ts (estOf), bandOf() in calreport/types.ts, quick/full job | done on boe |
| E1a | capability + start estimates (MAP-A first five minus safetyrates) | running (boe-e1a) |
| E1b | money + market estimates incl. the revenue-at-reference-capability diagnostic | running (boe-e1b) |
| H | homes: targets reference scenario checkpoints; overlaps; deletions; safetyrates' 17 entries; lints | running (boe-h, Opus) |
| E2 | extractions (MAP-A a–f, MAP-B list) + the two copied formulas (safety-emu persistence, danger κ) | after E1/H |
| E3 | safetyrates → estimates module, reading its new registry entries | after E2 (needs postRunEnv) |
| end | quick (ask), merge boe → master (ask), tell the balance + money sessions | — |
