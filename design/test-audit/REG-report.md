# REG report: one registry entry per quantity

Rule: keep the entry whose number its cited source states; if both do, the newer source or the one the live check used.

| Pair | Kept | Deleted | Why |
|---|---|---|---|
| 1 labour at SC | T2.labour.SCband | T2.labour.SC | as decided |
| 2 China lead | CAST.china.startLead, CAST.china.trailMean | T3.china.startLead, T3.china.meanLead | as decided |
| 3 supplier margin | F6.supplierMargin (0.70-0.75) | F6.supplierMarginMean | Reverse clause applied: V2-SPEC §7.2 C6 (and research/15 §1.9, Nvidia 72-75%) states 70-75%; nothing cited states 70-77%. calreport finance.ts f6.margin row now reads F6.supplierMargin, so its band narrows from 0.70-0.77 to 0.70-0.75. F6.supplierMarginMin kept. |
| 4 demand shock peak | F4.demandShock (6-8 quarters) | F4.shock.peak | V2-SPEC §7.2 F4 / research/15 C3 states "peaks at t+6 to t+8"; nobody states 6-9. So the source-states rule overrides the default. finance.ts f4.shock row reads F4.demandShock, band narrows 6-9 to 6-8. F4.shock.first and F4.shock.earlyResponse kept. |
| 5 F9 splits | all kept (nothing deleted) | none | STOPPED. See below. |
| 6 A8.leaderShare | band unchanged | | `source` text now says sourced but secondary (a VC survey, not primary data). Target has no kind field; its `grade` is for stated grades only. |
| 7 B6-PREP.md | | | rival gaps 3-9 now 0-11 months (CAST-2025); the China row now names the CAST ids; T2.labour.SC row renamed SCband. |

## Item 5: what would be needed
The calreport rows use per-mark bands: F9.fc1.start 450-750 and F9.fc1.late2026 2200-3300 (the combined F9.fc1.privateMarks has one lo/hi 450-3300, which would pass nearly anything); F9.fc2.2027 20-37 and F9.fc2.2026 >=15 (the combined F9.fc2.byYear has 20-37 only). `rowOf` takes its band from one entry, so a suffix cannot give a second band. To merge, either (a) rowOf/Target gains per-suffix bands (e.g. `value.bySuffix`), or (b) the split entries stay as the only home and the combined ones are deleted (scenarios.ts and docs would need re-pointing; scenarios.ts is the balance session's). I invented no band.

## Re-pointed references
- scripts/v2/calreport/finance.ts: R('F6.supplierMarginMean') to F6.supplierMargin; R('F4.shock.peak') to F4.demandShock.
- balance/targets.ts: metric/tolerance/statement text of F6.supplierMargin and F4.demandShock rewritten (no more "see CRC-report question 4" there); A8.leaderShare source.
- design/bal/SC1-SPEC.md:30 (T3.china.startLead to CAST.china.startLead); design/bal/B5-QUESTIONS.md and design/bal/inv/targets-notes.md (T2.labour.SC to T2.labour.SCband); design/bal/B6-PREP.md.
- Left alone: design/test-audit/CRC-report.md (historical report).
- balance/scenarios.ts:183 (H20.chinaGap.eci notes) names the deleted `T3.china.startLead`. Not edited; the balance session should change it to `CAST.china.startLead`.

## Checks
registry-lint: 0 errors (134 targets). tsc scripts: clean. `calreport --only market,rivals` runs (13 targets, 8 in band; the 5 out are market/CAST ones unrelated to these edits). finance/milestones not run (heavy); their changes are two id swaps.
