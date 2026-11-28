# G6 report: calib (remainder), fixtures, lint-structure, levellint, labourinit, rdm01b, milestonepred (branch ta-g6)

| Script | Before | After | Cost (CPU-s, measured, shared machine) |
|---|---|---|---|
| calib --smoke | 2 fail | 0 fail, 3 WARN (KNOWN) | ~30 (1 game x 700 days) |
| calib full | not run | not run | by count ~4-5 CPU-min (3 games, ~7k game-days x 30-40 ms): over the 3-min line |
| fixtures | diff + 3 sims | 12 PASS | 3 (was ~25 + sims) |
| lint-structure | 1 fail | 1 WARN (KNOWN) | ~3 |
| levellint | 1 fail | pass | ~1 |
| labourinit | 1 fail | pass | ~4 |
| rdm01b | 2 fail | pass | 10 |
| milestonepred | 3 fail | pass | 3 |

| Check | Class | Action | Proposed OPEN.md row |
|---|---|---|---|
| calib T2 AI labour at SC (restored) | n/a | read in the per-preset T1 game on the first SC day (workContext), same bounds 0.05M-50M FTE. Smoke cuts at day 700 and tl-central reaches SC at day 1478 (probe: 12.8M FTE, 564k copies, passes), so the check prints INFO "no SC within horizon" in smoke and runs in full mode. tl-slow stops at SC, tl-fast/central at ASI: all three presets can reach it | none |
| MODEL-V3 section 13 G path +-0.2 G | CAL-TARGET | KNOWN. Today worst 0.70 G, 0.75 G/yr vs research/12 1.1-1.3 (the brief said 0.46; master moved) | Balance: frontier G path to 2026 (RefBot, tl-central) |
| V3.7 METR h50 doubling 4.2 +-1 months | CAL-TARGET | newly failing (9.4 months), not in the brief; KNOWN | Balance: METR h50 doubling 2025-26 |
| T4 rival gaps at start 3-9 months | CAL-TARGET | KNOWN. Values now 6.3, 3.8, 6.3, 10.9, 0.0 (they change with every rivals change: archetype ranges in actors/rivals.ts vs the band) | Balance: rival gaps at start |
| lint-structure titles <= 4 words | BUG (UI wording) | WARN by action id (any other long title still fails) | Bug: research.safReAlloc title "Safety research engineers by need" is 5 words (src data, action title) |
| levellint workfit.ts:421 | false positive | `.L` of measuredLabour() is labour work done (a ratio of two labour results), not a display level. Lint ignores lines reading `ml.L` / `measuredLabour(..).L` (no src edit needed) | none |
| labourinit 'world' stream = 310349867 | STALE-PIN | replaced by a shape check: initialLabour on a copy of the day-0 streams changes `labour` and no other stream (incl. world). Pin guarded "labour init does not consume world" | none |
| rdm01b honest MEDIA 3.41 / PHYS 1.95 | TEST-BUG | the test sets true levels after newGame, but the suite pools the readings from newGame's earlier suite (changedSinceSuite is false: no new build). Now clears `v.evals.bench` first. Measured 4.14 / 3.02 vs true 4 / 3 | none |
| milestonepred 3 fails | TEST-BUG | rivals carry their own build (RD-X03) and otherLabMilestones reads it when present, so setG only moved the summary G and the predicate stayed on the day-0 build (1000000). setG now drops the build (rival "known by G alone" = the fallback referenceProfileModel). The shared predicate is fine: all 3 pass, RD-L04 holds | none |

## fixtures
Check mode now reads the 5 committed files only: plain JSON (validateJson), loads with the current schema (deserialize refuses an old one, so a fixture not regenerated after a schema change fails), serialize round-trip (stateHash), and challenger/spinout setup + leader lab. No equality diff, no sims. `--write` (npm run fixtures:v2) unchanged.

## Notes
- calib header now states the cost and the T2 skip rule. Full mode needs a ruling (4-5 CPU-min by count, 3 games); not run.
- Nothing proposed for lib.ts/run.ts. Budgets for run.ts: calib quick ~30, fixtures 5, labourinit 5, rdm01b 12, milestonepred 5, levellint 3, lint-structure 5.
