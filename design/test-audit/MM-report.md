# MM: merge of master (4cbc0578, corp, schema 128) into ta-mm (testaudit)

## Conflicts and how each was resolved
- scripts/v2/_a06, _endview (2), _p07, _t06, _t07, _x03 (modify/delete): kept deleted (scratch is git-ignored).
- run.ts: testaudit's run.ts kept; added jobs corp (12 CPU-s), partners (15), distribution (10), from one measured run each (7-9 s wall). master's `rivals` job has no script on this branch and stays out. Orphan guard: 0 orphans.
- finance.ts (12 hunks): testaudit's structure kept (played-game parts live in calreport/finance.ts). Master's content applied: imports (charter/deals/observe/control), the C2 `shape()` helper, `withLabs` helper restored, exclusivity check (exclusiveBlocker, then the competitor dropped, then `roomy`), IP-access check (lead-scaled bump, DLip deal), mission-body IP check, FIN4r H2 `dMax(false)`, FIN5b rival governance via `appealOf(RIVAL_CHARTER)`.
- calreport/finance.ts (ports of corp's changes to checks that moved there): `missionPowers(s)` replaces `board.safetyCommitteeVeto`; round dilution no longer filters `anchor` (field gone); `start:` to `labKind:`; FIN3b wording "mission body"; FIN4b RefBot deal no longer requires exclusivity (corp: exclusivity is only offered while a competitor could offer something). Band values: none changed in balance/targets.ts. The two criteria text/logic changes above (fin3b.committee, fin4b.deal) are in the local `t()` rows, not registry bands.
- directorEndings.ts: testaudit's constructed form; E1 stays the invariant (unique, E-numbered, non-empty), so it covers E33; corp's E22 text length (<= 220) check came in with the clean merge.
- data.ts, suites.ts, products.ts, idle.ts, effective.ts, fixtures.ts, hygiene.ts, research.ts: testaudit's version, with master's renames applied (`start:` to `labKind:`, challenger/spinout to safety/breakaway, `positionOf`, `LabKindId`, `POSITION_BY_ID.talent.exploitMult` instead of the removed START_EXPLOIT_MULT). fixtures.ts check mode now reads day0/400/900 plus start-safety/start-breakaway day400 (master's regenerated files) and checks `setup.labKind`. hygiene took master's one-line causes check (`delta === -5`). research.ts: master's RD-B16 played-game readout stays removed (testaudit moved it out).
- sites.ts, uitest.mjs: no textual conflict; master's sites INFO and rewritten UI cases are in (uitest syntax-checked only; not run).

## Per-script results (one run each, quick form)
data, effective, fixtures, hygiene --no-perf, idle, products, research, suites, directorEndings, corp, partners, distribution, sites, lint-known, registry-lint: all pass. finance --smoke: all pass after the fixes below (28 s wall). tsc main and scripts: clean. `run.ts --tier quick --list`: no orphans.
hygiene without `--no-perf` fails 2 perf checks (tick 14.4 ms/day, worst quarter 58 ms); that is the perf tier on a loaded machine, as designed, not a regression.

## Failures found in finance.ts after merge, classified
All STALE/TEST-BUG against corp's own changes (master's finance.ts carries the same stale lines; its session evidently did not run these):
1. FIN4a leader start Northwind: legacy deal now carries `revenueShare 0.2` (C7c), expectation re-derived to `{ revenueShare: LEGACY_NORTHWIND.revenueShare }` (STALE).
2. FIN4a custom chips: firm discount is `sp.firmDiscount` (10% at 6 y), not a literal 5%; the deal books six yearly contracts, not one order (reserved pool n0 + 6). Re-derived from the supply object (STALE).
3. FIN4b IP access: `partnerCosts(a)[0]` is now the legacy Northwind row; look up the Azimuth row (TEST-BUG).
4. FIN5c day 0: `carryIn` pinned to 4; the capital-heavy position's cash is now $20B (OPEN.md § Balance row "big-tech division start cash"). Now reads `positionOf(s).cash` (no number pinned).
5. FIN4r H2: kept testaudit's `w < 0.05` (a $0.1B round at $95B pre is 1.2% of the typical round).
No BUG, no new KNOWN, no proposed OPEN.md row.

## Questions
- None blocking. Note for the lead: master's own finance.ts fails checks 1-4 above, so master as merged has red there until this branch lands.
- uitest was not run (heavy; the lead runs test:ui). Played-game F-targets in calreport/finance.ts were not run.
