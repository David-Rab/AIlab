# G7: the UI test (uitest.mjs), 2026-11-28, branch ta-ui

## Flags (scripts/v2/uitest.mjs)
- `--only a,b`: run only groups whose name contains a (case-insensitive). Groups: start, gameB, B1, B2, B3, B4, D4, D6, D8, E11, E12, day400, day900, sweep, speed4, r9, r10, end. Setup (boot, day-1 game, fixture imports) always runs, so a filtered run costs about 8 s plus the group.
- `--shots`: save screenshots (default none; a failing check saves `scripts/v2/shots/fail-N.png`).
- `--no-build`: never build. By default `dist/` is rebuilt only when older than `src/` or `index.html`. `npm run test:ui` = `node scripts/v2/uitest.mjs`; `npm run test:ui:nobuild` = `--no-build`.
- `--gaps`: print the 30 longest waits between named checks (coarse profile). Group timings print at the end of every run.
- `KNOWN` / `KNOWN_LIMITS` in uitest.mjs print WARN with the OPEN.md text (like lib.ts KNOWN).

## Wall time and counts (3 whole runs, all `--no-build`)
| run | wall | pass | warn (known) | fail |
|---|---|---|---|---|
| baseline | 402 s | 711 | 0 | 19 |
| mid | 327 s | 585 | 4 | 2 (a flaky FF check, the E12 term check; both fixed after) |
| final | 331 s | 599 | 4 | 0 |

Build: 4 s when stale, 0 when fresh. **The 2.5 min target is not met (331 s).** Where the 331 s goes (filtered runs): Game B 110 s (52 s of it the "click every enabled action in every panel" loop: 95 clicks; 13 of them in Lab > People take about 1.2 s each, with or without Playwright's actionability checks, so that is the app's own handler time), the 27 day-N check blocks about 95 s, the day-900 block 45 s, R10 27 s, the IA/coverage sweep 24 s, start and time controls 20 s, R9 + end + speed4 20 s. Further cuts need either dropping the click-everything loop or making Lab > People actions fast.

## The 19 failures
| case | class | action | proposed OPEN.md row |
|---|---|---|---|
| Products: locked tools name their idea | TEST-BUG | the leader start has every tool built, so no locked row existed. The test now builds the case (Computer use unbuilt, P06 unknown) and checks the row says "needs <idea>" | none |
| B2 day 1/400/900 tools-editor rows | BUG (one row) | The only bad row is Agent mode: no type chip, no effect line (`fx: []`; its effect is the 2 h horizon gate, shown only in its tooltip). Split into its own check "B2 day *: Agent mode shows what it does", KNOWN (WARN); the other 5 rows are still checked | Products tools editor: the Agent mode row has no type chip and no effect line (data/v2/tools.ts agentMode fx is empty; productView.featureView returns no kinds or short). Bug, Products |
| D8 day 1/400/900 policy row | STALE | the row was reworded: "Before release", "Re-test when ... every N days", "per round: research-engineer team-weeks, engineer team-weeks, H100e-days" (ui/v2/panels/Evals.tsx). Regexes re-derived from the rendered row | none |
| D8 every evals term has a tooltip (`evalGate`) | STALE | no `evalGate` term exists in the glossary; the release gate is the `safetyFramework` term. Term list updated | none |
| D6 day 1 finished expansion / hardening match preview | TEST-BUG | at day 1 the preview says "never at current rates": the work cannot finish in the 40 days stepped, and the suite decays (tasks 100000 to 96385) while it waits, so 99% vs 114% is the unfinished suite. Day 1 no longer waits for completion (day 400 does, and passes: the preview is truthful) | none |
| E12 day 400 trait best guess (15 of 17) | TEST-BUG | tiny beliefs render with "<" or decimals; the regex took integers only. Widened | none |
| E11 day 400/900 Remove preview vs effect | TEST-BUG | the preview line reads "3 compute days with AI staff off"; the regex said "internal agents off", so the parsed off-days were NaN. The effect equals the preview (off 3 d) | none |
| FIN3c stock payment dilution and obligations | STALE | the "antitrust scrutiny" cost went with the relations cluster (W1c, 7c7a7e3d). Dilution (the stake only on the stock choice) and the obligations are still checked | none |
| E6 control protocol slowdown | STALE | slowdown = AI labour lost to deferral; it is 0% when the monitor is as capable as the watched model (oversight.ts controlProtocol, MODEL-V3 section 11.6), which is the day-400 fixture (day 900 shows 7%). The check now requires a percent | none |
| IA one home per datum | TEST-BUG (question 1) | `safetyHeader` and `frameworkHold` are the Safety panel header, shown on every tab. The sweep now counts a home that sits on every tab of its panel as one home (the panel's) | none |
| F6c Retire version preview | TEST-BUG (+ small BUG) | the picker ignored MK-13 lineups, and the engine (correctly) refused a version in a lineup. The picker now excludes lineup versions. Side finding: the preview says ok:true for that version while the act refuses | Retire version preview says ok for a version in a live lineup (actionView retireVersion ok:true; the act refuses "Monitors a live product or is in its lineup"). Bug (small), Models |
| F6e Targeted training preview | STALE (deleted mechanism) | Targeted training and Disclose were deleted by SR-18 (f5b145e0); responses now follow the believed cause. Replaced by what still holds: no response preview carries a unitless alignment line, over the current kinds | none |
| R10 limits `research.rePerProject`, `response.hardenFloor` | BUG (2) | registry limits with no readout: the RE base need shows on Lab > Work, not Research > Projects (the limits.ts home is stale, or the readout is missing); `hardenLevel()` in safety/responses.ts is unused by the UI. Both KNOWN; the other 23 limits are still checked | (1) limit research.rePerProject: no data-limit readout on its home Research > Projects. (2) limit response.hardenFloor: no "diminishing fixes" readout on Safety > Cases (hardenLevel unused). Bug, Research and Safety |

Tally: 5 STALE (D8 policy, evalGate, FIN3c, E6, F6e), 7 TEST-BUG (locked tools, D6, E12, E11, IA, F6c picker and the E11 repeat), 4 BUG rows (Agent mode, Retire preview ok, two limits). The audit's lean of "about 11 real bugs" was wrong for D6, E11 and F6: those were stale or test faults. No preview-truth violation was confirmed (D6 and E11 previews match their effects).

## Removed repeats (112 checks)
- B1, B3, B4, D4, E12 at day 1 and day 900: wording, tooltip and click-changes-state checks that read the same code on every day. Kept at day 400 (E12 also at 900: the `successorPull` term only appears once a successor is steered).
- B2 day 900 (day 1 and 400 kept), E11 day 900 (the planted Remove check at 400 is the same code).
- Kept at all days: D6 (families locked or unlocked, complete or not), D8 (depth basic/full/deep), B2 day 1 and 400, E11 day 1 and 400.
- The IA sweep and `coverage()` ran at day 400 and day 900; now once, at day 900 (more tabs unlocked). The J1 coverage text says so.
- Fixed sleeps: `check()` polls for the change (up to its settle) instead of sleeping; `nav` and `tabTo` wait for `[data-panel]` and `.tab2.on`; 50 hover sleeps of 250-900 ms became `tipUp()` (270 ms = the tooltip's OPEN_MS, then the `.tip`); lineup popovers wait for `lu-pop`; the real-time clock check waits for the day to change.

## Also found
- "A decision is pending" was flaky under faster pacing (FF stops on laws too); it now retries FF up to 6 times.
- Lab > People actions (starHire, teams.release, teams.move) take about 1.2 s each in the browser.

## Open questions
1. IA: is a header shown on every tab of a panel (Safety header, framework hold) one home (what I assumed)? design/ux/IA.md section 4 should say so either way.
2. Agent mode row: what should it show (a "gate" chip with the 2 h horizon, or the `agentGateH` text as its effect line)? Design call; the test is KNOWN until then.
3. Is a 1.2 s Lab > People click a bug worth an OPEN.md row (performance), or accepted?
4. 2.5 min: accept about 5.5 min, or shrink the "click every action button" loop (52 s) to a representative subset?
