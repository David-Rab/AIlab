# CRC report: one home per target (calibration report reads bands from the registry)

Branch ta-crc, 2026-11-28. Rule (designer, 2026-11-28): "we don't want lots of different numbers in different places saying different things." Every sourced band is written once, in `balance/targets.ts`; `scripts/v2/calreport/*.ts` and `sanity.ts` read it by id.

## What changed

- `calreport/types.ts`: `rowOf(id, valueText, measured, suffix?)`. Looks the id up in TARGETS (throws if unknown), takes statement, band text, unit, source (and `known`) from the entry, and decides `ok` from its `lo`/`hi`/`p50` plus `slack`. `measured` is a number, an array (every element in band, empty fails) or a boolean (ordering / invariant / direction targets; the module computes it, band text = the entry's `tolerance`). A target with role `info` is never out of band. Row id = registry id (+ `@suffix`, e.g. `@tl-central`). Every module builds rows only through it (about 105 rows).
- `balance/schema.ts`: new optional `Target.slack` (numeric tolerance in the entry's unit: added outside lo/hi, or ± around p50). Used for the four date targets (0.2519 y = ±92 d) and rival gaps (0.05 month).
- `balance/targets.ts`: 49 new entries (below), about 50 existing entries re-pointed (metric names the `calreport/<area>.ts` row; `checkLabels` emptied because the old check labels no longer exist), `T4.rival.gaps` removed. Rival gaps at start are one band, `CAST.rivalGaps.start`, 0–11 months (CAST-2025); the "band conflict" text in rivals.ts is gone.
- `registry-lint.ts`: three new rules (below), self-tests added.
- `sanity.ts` + `safety-emu.ts`: see below.

Commits: 2667b2df (registry), 9a4e4c7f (calreport), d6a397b2 (lint), 28c2d9c5 (sanity).

## New target ids (for the balance session)

Source text is verbatim from the moved check. Role `unassigned` for all. `GPATH.anchorDeviation` carries `known` (RefBot 0.75 G/yr vs 1.1–1.3).

| id | band | source |
|---|---|---|
| T1.golden.milestones | median within calTol(preset, milestone) of the golden day; the golden days are data (lib.ts), empty for the timeline worlds days (golden day of the preset, lib.ts calGolden) | V2-SPEC §7.1 T1; model v3 F4 (median over CAL_SEEDS); lib.ts calGolden |
| GPATH.anchorDeviation | ≤ 0.2 G | research/12 §0.2 frontier anchors (best public model); MODEL-V3 §13; OPEN.md § Balance: frontier G path to 2026 (RefBot 0.75 G/yr vs research/12 1.1–1.3) |
| M.startReadout | ≤ 0.1 abs deviation of M | CAL2-T (DECISIONS "Calibration decisions after CAL1 refits" item 3): src/data/world.ts multiplierAt at p0 (ai2027 1.25, authors2026 1.10, fast 1.15, slow 1.01) |
| T2.labour.SCband | 500000 to 50000000 median-FTE | research/13 §1.9: AI 2027 Agent-3 ≈ 200k copies at 30×, ≈ 5M median-FTE on ≈ 0.5M H100e |
| CAST.rivalGaps.start | 0 to 11 months | npc/CAST-2025.md §1 (0 for the leader and its peer, up to 9.5 months behind the public frontier for Meta; public-lag band ±1.5 months), NPC-LABS §13; the balance session chose this band over the old calib T4 3-9 months (2026-11-28); OPEN.md § Balance: rival gaps at start (actors/rivals.ts archetype ranges) |
| CAST.china.startLead | 6.5 to 8 months (30.4 d) | design/bal/SC1-SPEC.md:30; npc/CAST-2025.md "China gap check": IFP 6.5, CAISI ~8, Epoch mean 7 |
| CAST.china.trailMean | 90 to 270 days (3-9 months) | the cast span, npc/CAST-2025.md; design/bal/SC1-SPEC.md |
| CAST.china.behindShare | ≥ 0.95 share of days | the cast span, npc/CAST-2025.md; OPEN.md § Balance: China trails the US frontier (with no theft China's lag closes: secrets leak, open weights) |
| C1.chatUsers | 630000000 to 770000000 weekly users | NBER w34255 (ChatGPT, Jul 2025) |
| C5.paidShareTarget | 0.05 to 0.06 fraction | research/22 §2 |
| A7.freeMessageWh | 0.08 to 0.72 Wh per message | arXiv 2508.15734 (Google, Gemini Apps median prompt) |
| A8.leaderShare | 0.25 to 0.45 share of sector spend | Menlo Ventures, Jul and Dec 2025 (OpenAI 0.25, Anthropic 0.45 of sector spend) |
| A8.usBuyerShare | 0.4 to 0.72 share of sector spend | research/22 (Anthropic US billing share 72% [UNVERIFIED]); Anthropic Economic Index (ROW / US hours ≈ 3.6) |
| A8.hoursRatio | 3 to 4.2 ratio | Anthropic Economic Index (ROW / US hours ≈ 3.6) |
| A8.leaderRevenue | 12 to 15 USD billion a year | research/22 §4 |
| A8.chatRevenueShare | 0.6 to 0.75 share of revenue | research/22 §4 |
| A3.priceDecline | 6 to 900 x per year | research/20 D3; Cottier et al. 2025 (Epoch AI): price-for-fixed-capability declines of x9 to x900 a year, GPT-4-level GPQA ≈ x40/yr; research/12 §0.6 conservative x5-10/yr |
| A2a.agencyRise | ≥ 0.05 hours saved per hour of use | research/22 §1 |
| A2a.agencyDirection | later above earlier direction | research/22 §1 |
| A2a.firmsBelowWorkers | ≥ 0.1 fraction (workers minus firms) | research/22 §1 (BTOS vs RPS) |
| A2b.usReach | 0.45 to 0.65 fraction of adults | research/22 §2 (RPS Nov 2025) |
| A2b.rowBelowUs | ROW < US direction | research/22 §2 (RPS Nov 2025) |
| A2c.seats.jan2026 | 20000000 to 45000000 seats | research/22 §4e–4g |
| A2c.seats.jul2026 | 35000000 to 75000000 seats | research/22 §4e–4g |
| A2c.tokenGrowth2026 | 4.6 to 20 x per year | research/22 §3, §7 (rows 3a–3b); M10 lead decision after MKT: Google first-party API tokens 7B → 32B a minute Q3 2025 → Q3 2026 (x4.6); Google all surfaces 480T a month (May 2025) → > 1.3 quadrillion (Oct 2025), "> 20x in a year"; OpenAI enterprise reasoning tokens per organisation x320 in 12 months to Nov 2025 (an upper outlier) |
| A2c.agentHoursRising | strictly rising across the three marks direction | research/22 §3, §7 (rows 3a–3b) |
| HEADLINES.distinct | ≥ 10 distinct headlines | worldfx/headlines.ts (reference path) |
| HEADLINES.oneShotOnce | each one-shot at most once boolean | worldfx/headlines.ts (reference path) |
| F6.supplierMarginMean | 0.7 to 0.77 fraction | V2-SPEC §7.2 F6 (C6); R15 §1.9 |
| F6.supplierMarginMin | ≥ 0.65 fraction | V2-SPEC §7.2 F6 (C6); R15 §1.9 |
| F4.shock.first | 4 to 6 quarters after the shock | V2-SPEC §7.2 F4 (C3) |
| F4.shock.peak | 6 to 9 quarters after the shock | V2-SPEC §7.2 F4 (C3) |
| F4.shock.earlyResponse | ≤ 0.005 growth difference | V2-SPEC §7.2 F4 (C3) |
| F9.fc1.start | 450 to 750 USD billion | research/15 §2.9; R21 A8 (OpenAI $300B Mar 2025 [P], Anthropic $61.5B Mar 2025 [P], xAI–X $113B, SSI $32B, TML $12B [R21 A8, U] ≈ $0.52T; ≈ $0.64T with Anthropic's Sep 2025 $183B) |
| F9.fc1.late2026 | 2200 to 3300 USD billion | research/15 §2.9 (OpenAI $1.25T [U], Anthropic's IPO ≈ $1.26-1.40T, others ≈ $0.1T, + xAI $250B if counted; in SpaceX since Feb 2026) [R15 §2.9] |
| F9.fc2.2027 | 20 to 37 x run-rate revenue | research/15 §2.9 (FC2) |
| F9.fc2.2026 | ≥ 15 x run-rate revenue | research/15 §2.9 (FC2) |
| FIN2.roundsPerYear | 1 to 4 rounds per year | design/FINANCE-V3.md §2 (it raised at the ceiling every quarter before FIN2) |
| FIN3a.boardConfidence | ≥ 40 board confidence | design/FINANCE-V3.md §7.3; lead decision after FINREF 2026-11-21 (≥ 55 is a design target, not a source; since M10 the RefBot plays AI 2027's small safety share, which lowers the board: only a collapse is out of band) |
| FIN3b.committeeShare | ≤ 0.5 share of PBC weeks | design/FINANCE-V3.md §7.5 |
| FIN4a.dealShare | ≥ 0.8 share of seeds | design/FINANCE-V3.md §6 |
| FIN4a.dealShape | every deal boolean | design/FINANCE-V3.md §6 |
| FIN4b.dealStrings | every deal; every seed boolean | design/FINANCE-V3.md §6.1 |
| FIN5a.equity2025H2 | 5 to 45 USD billion | OpenAI raised $40B in 2025, $122B in 2026 |
| FIN5a.equity2026 | 50 to 150 USD billion | OpenAI raised $40B in 2025, $122B in 2026 |
| FIN5b.fc6 | ≥ 0.75 share of private rivals | research/15 §2.9; R21 (FC6) |
| FIN5c.divisionBot | no day outside healthy; 3 goals judged; budget = plan x budgetFactor(confidence) boolean | design/FINANCE-V3.md §13 |
| S5.halfStaffDeepensLag | mean U − L lower, believed and true direction | S5R (design/archive/V3-BUILD.md "S5R"): emergent, not forced; AI 2027 Apr 2027: "far from a full understanding" with a small safety team |
| F5.evalAwarenessStart | 0.1 to 0.3 fraction | verbalised EA 10–30% (2025); Sonnet 4.5 ~13%; Apollo 11.7% |

Rows that reuse existing ids (band not touched): R5.buildQueue.stub/integrated, METR.h50.doubling, F1, F2, F3, F5.spot*, F7.*, F8.*, F9.fc2.leaderMultiple / slowerLowerMultiple / trailingRivals, F9.dilution, F11.*, W.* (dates now compared as a decimal year with `slack`), A2a.*, A2b.paidShare2026, W4.*, S4.*, S5.mixedVsRef.sightLimit, F5.evalAwareness2026, F5.afComplianceGap2026, F6.persistence.scheme.

## Re-pointed entries (metric now names the report row)

R5.buildQueue.stub/integrated, GPATH.ai2027.2026 (slope printed only), METR.h50.doubling, F1.production2026, F2.production2027, F3.installedStock, F5.spotDemandShock, F5.spotGlut, F7.revenue2026 / capex2026 / compute2026 / power2026 / valuation2026, F8.fundingMix / refNoDistress / noRescueDistress / capex2xDistress, F9.fc2.leaderMultiple / slowerLowerMultiple / trailingRivals, F9.dilution, F11.startRunRate, F11.revenue2027, W.youthSoft2026, W.aggregateU2026, W.hireRate10, W.aiFriend2027, W.remote25, W.unemployment12m, W.govAccept85, A2a.hoursOfUse2026 / hoursSaved2026 / workers2026 / savedPerHour, A2b.paidShare2026, W4.aggregateU / youthExposed / firmAdoption, S4.refBot.pMis, S4.safeRecipe.pMis, S5.mixedVsRef.sightLimit, F5.evalAwareness2026, F5.afComplianceGap2026, F6.persistence.scheme.

Entries whose check was deleted with no report row (metric now says so, nothing else changed): STACK.pretrainRate.ai2027 (calib --fit-lines), T3.china.afterTheft, T3.china.gapFormula (directorEndings T3), T3.china.stubLead, S5.refBot.belowL, S5.mixed.marginHolds (INFO lines dropped), T-tree.durations (calib --fit-tree). Entries with a band conflict (questions 2–4): T2.labour.SC, T3.china.startLead, T3.china.meanLead, F4.demandShock, F6.supplierMargin, F9.fc1.privateMarks, F9.fc2.byYear.

## Lint rules (registry-lint.ts, run by `npm run registry:lint`)

1. Every id passed to `rowOf` (or a module's local wrappers `R`, `band`, `dateCheck`, or sanity's `times10`) exists in TARGETS. Each file must contain at least one such call.
2. No numeric band literal in `scripts/v2/calreport/*.ts` or `sanity.ts`: after blanking comments and string/template text, any comparison `< <= > >=` against a number other than 0 or 1 (`x >= 0.4`, `3 < x`) is an error. A line may opt out with a trailing `// band-lint: ok <why>` for a measurement definition that is not a sourced band (years scanned, "growth x2.5" class, event thresholds, seed numbering). 24 such annotations today, each with a reason.
3. No hand-made rows: `ok:` inside an object literal in those files is an error (rows come from `rowOf`).
4. `--self-test` covers: unknown id, band literal in both orders, hand-made row, and a clean source (comments, strings, opt-out).

The existing cross-checks run unchanged (139 targets, no duplicate ids).

Not caught by the heuristic (data tables, so nobody thinks they are covered): `G_ANCHORS` in milestones.ts (the five research/12 anchors, the measurement input of GPATH.anchorDeviation); `mA(R) = 37 * (R/5)^-0.28` in finance.ts (Anthropic's multiple curve, the reference of F9.fc2.trailingRivals); `calGolden()` days (lib.ts data, empty for the timeline worlds).

## sanity.ts

- Game: `refGame(2027, 2200, [400, 1200, 2000])` (RefBot, integrated finance, tl-central, medium, endings skipped, capped at day 2200, about mid-2031). New cache key (maxDay + sweep days), so it no longer shares the calreport safety games (those run to ASI).
- Revenue bounds derived: `times10('F7.revenue2026')` = $3.6–670B, `times10('F11.revenue2027')` = $9.8–1820B (÷10 of lo, ×10 of hi of the registry entries; a little wider than the old $4.5–560B and $14–1400B because the entries carry the ±20% / ±30% tolerance).
- Checks: JSON valid at day 1/400/1200/end; milestones reached are in order (at least one); SC reached in [2026, 2032) (KNOWN); P_mis strictly in (0,1) at the end; revenue 2026 and 2027 within ×10 (2027 KNOWN); cash > −$10,000B; valuation finite and positive; NPC labs' G finite and rising; new: light readout sweep (`readSweep(s, true)`, 1748 calls) on the live state at days 400, 1200, 2000, state hash identical before and after (`SanityRec.sweep`, recorded by safety-emu's observer).
- KNOWN (WARN, text `OPEN.md § Balance and calibration: Integrated RefBot economy collapses (sanity.ts)`): "SC is reached before 2032 (tl-central)" (no SC in 2200 days; milestones stop at A2, day 1115) and "player revenue 2027 within ..." ($3.4B vs ≥ $9.8B). Revenue 2026 ($7.1B) is inside the ×10 bound. Result: all passed, 2 WARN.
- Cost, one cold run: 102 s wall (target ≤ 300). Warm cache about 0.
- Sanity-only bounds (not sourced bands) are named constants at the top of sanity.ts: horizon 2200, sweep days, SC from 2026 and before 2032, cash > −$10,000B.

## Verification

- tsc passes (`scripts/v2/tsconfig.json` and `-p .`); `npm run registry:lint` 0 errors and `--self-test` passes (it rewrote the untracked balance/coverage.txt).
- calreport with `CALREPORT_SEEDS=1`: world (24 s), finance (73 s), market and rivals (full, 49 s), milestones (tl-central only, 163 s). Every row prints its band and source from the registry; in/out decisions equal the old literals except where noted in the questions. The safety module was not run (RefBot games to ASI, several CPU-min per seed cold, over the 3 CPU-min limit); its ids are covered by the lint and tsc and it uses the same `rowOf` path. Its rate rows are now `F5.evalAwarenessStart`, `F5.evalAwareness2026`, `F5.afComplianceGap2026`, `F6.persistence.scheme`.
- Row ids changed everywhere (old `safety.refPmisAtAsi`, `world.rev.2026` … are now registry ids). Nothing in the repo referenced the old row ids except CRA-report.md.

## Questions (same quantity, different numbers in two entries: not decided here)

1. Rival gaps: done as instructed (`CAST.rivalGaps.start` 0–11 months, `T4.rival.gaps` deleted). Prose in design/bal/B6-PREP.md still says 3–9 months.
2. T2 labour at SC: the moved check was 0.5M–50M FTE (`T2.labour.SCband`); the old entry `T2.labour.SC` says lo 5e4, hi 5e7 ("checked 5e4-5e7"). Which is right?
3. China lead: `CAST.china.startLead` 6.5–8 months and `CAST.china.trailMean` 90–270 d (what directorEndings T3 last checked) vs the old `T3.china.startLead` and `T3.china.meanLead` 150–200 d (R11 #16, "about six months"). The 150–200 d entries describe checks that no longer exist.
4. Stated band differs from the coded band the report uses: `F6.supplierMargin` 0.70–0.75 vs `F6.supplierMarginMean` 0.70–0.77 (+ min 0.65); `F4.demandShock` peak 6–8 quarters vs `F4.shock.peak` 6–9; `F9.fc1.privateMarks` (one combined 450–3300) vs `F9.fc1.start` / `F9.fc1.late2026`; `F9.fc2.byYear` (combined) vs `F9.fc2.2027` / `F9.fc2.2026`. The old entries are kept (scenarios.ts and docs reference F9.fc1.privateMarks); the balance session should merge or delete them.
5. The four date targets hold p50 2027.5 / 2027.75 / 2027.96 with ±0.2519 y; the old check was ±92 d around an exact ISO date (at most 1.5 days off).
6. `A8.leaderShare` (Menlo): a sourced band or a design band? (CRB question 1, still open.)
7. `F9.fc2.trailingRivals` is now the ratio median(trailing) / median(leader multiple) compared to ≤ 1; the old check was a strict `<`.
8. Rows out of band today are not touched by this task (F7 rows, G path 0.70 G vs 0.2, METR 9.4 months vs 3.2–5.2, China behind share 69.5%, ...): calibration for the balance session.
