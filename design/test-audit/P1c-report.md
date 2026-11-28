# P1c report (junk inside scripts)

Branch ta-p1c. Counts are PASS/FAIL lines of the script, before -> after (full runs, `node --import tsx scripts/v2/<x>.ts`). Every FAIL that existed before still exists after; only deleted checks vanished. tsc main: clean. tsc scripts: no new errors (remaining: npcShocks, research.ts:348, safetyresearch, tastecurve, worldChina, worldUiReadouts, all pre-existing).

## 1. Removal-only checks deleted
| script | removed | PASS/FAIL before -> after |
|---|---|---|
| data.ts | `D2: the old "License data" action (D3) is removed`; the src-walking `lint: no V1 data-option offsets left` (BASE_DATA dg/off/noWall, deltaRsch, "Research boost"); now-unused imports (readdirSync, statSync, BASE_DATA, ACTION_BY_ID) | 62/2 -> 60/2 |
| suites.ts | `P12: the old "time horizon x2, RSCH +0.4" flags are gone` (regex on models/runs.ts); unused HERE import | 28/9 -> 27/9 |
| research.ts | the src-walking `D9 lint: the old flags are gone` (P10_SYN_MULT, noRepeat, paradigmOff, P12_HORIZON, adopted(s,'P10'..), LATER(V5), old tooltip text). The typed-effects check right above it stays | 52/1 -> 51/1 |
| safetyideas.ts | `lint: the old flat effects are gone` (p14Goodhart, p15Cash, "cheap price" ...); `lint: no LATER(V6) markers left in design/archive/TECH-TREE.md` | 35/4 -> 33/4 |
| worktypes.ts | `RD-B18 the taste chip no longer claims quality enters it` (no "quality and stars" in Lab.tsx, no STAR_TASTE) | 16/5 -> 15/5 |
| domainref.ts | `grep: no REF_OFF in src` (was FAILING: matched danger.ts and capability.ts, so it was a name collision, not a regression) | gone with the file |
| currency.ts | `grep: no LEVEL_PER_OOM, offL ...` | gone with the file |

Not found as a separate "old flag" check, nothing deleted: research's other two (the recipe-never-reads-know-how lint is a live rule, see below; the RD-R06 / RD-B18 `!/.../` terms are parts of positive text checks), data's third (line 159 `!('tokensT' in pubA)` is a shape check of the live public-web design), safetyideas' other four (see lint candidates).

## 2. currency.ts and domainref.ts into effective.ts
Both files deleted (`git rm`), their two job lines removed from run.ts. Their non-grep checks (currency 3, domainref 3 worlds x 2) moved unchanged into two blocks at the end of effective.ts, same thresholds. effective: 26/1 -> 35/1 (+9 = 3 + 6). The one failure (`post-training: RL FLOP = rho x base FLOP; no minimum days`) was already failing. currency was 4/0, domainref 6/1 (the REF_OFF grep).
Overlap note: effective's own "start: reference recipe reproduces the reference-point domain profile" (line 87, tolerance 0.25 L) is looser than the moved exact checks; left alone.

## 3. rdt10.ts
Deleted. Before: 3 pass, 1 FAIL (the table-equals-pre-T10 check). References outside design/archive: design/test-audit/D-orphans.md:46 lists it as "ADD quick, ~1 s" (now stale), TASKS.md and TEST-AUDIT.md mention it as a deletion target. No doc cites it as a live test.

## 4. naming.ts
Save-migration section (103 -> 104: strip nm, deserialize, check names derived) deleted, header comment fixed. Before: crashed in the migration (14 pass, then exception); after: 14 pass, 0 fail, exit 0.

## 5. calib.ts
- `hasGolden(preset)` = calGolden() has days for it. Without: the 19 extra T1 seeds are not played (`seedsOf`), the integrated run is not played (prefill and the print loop filter on hasGolden), `medianChecks` is not called, and `INFO  T1 <preset>: no golden days yet (calGolden), T1 skipped` is printed. `medianChecks`, the seed set and the integrated block stay and come back automatically once calGolden has days. No threshold or target touched.
- Removed: t2Rec and the T2 INFO + check block (and its workfit import), t3Rec and the T3 INFO block, the 40-seed T4 INFO loop. Kept: the binding `T4 rival gaps ... (fixture seed)` check and the MODEL-V3 section 13 G-path check (both need the one SEED game, which is still played).
- The T2 line also had a check (`T2 AI labour at SC within an order of magnitude`), removed with its block as instructed; it was a sanity pin. Say if you want it back.
- Games per preset in full mode (from code): before = 1 SEED T1 + 19 other seeds + 1 integrated = 21 per preset (63 total), plus 1 T2 game, 1 T3 game (both tl-central), plus 40 refGame constructions for the T4 loop. After = 1 per preset (3 total) + the single T4 fixture refGame construction. Smoke: unchanged (1 game, tl-central); `--smoke` run takes 32 s, prints the INFO line, 2 failures (G-path 0.46 G, T4 fixture 2.3/1.8 months), both as before the change (not touched).

## Lint candidates (kept, they guard live design rules)
- worktypes.ts ~line 235 `lint: no player mechanism reads frontierFlop, hRef, refTotal, shareRefAt, knotAt or multiplierAt`: guards "no player mechanism reads the harness-only reference curves". Fails today (unchanged). Current hits are in npc/lab.ts and worldfx/revenue.ts (see the FAIL line in a run: `bad` list).
- worktypes.ts ~line 237 `lint: the work-type layer reads effective compute, not pm or the level bridge` (regex `.pm`, `levelOf`, `thresholds(` on departments/workfit.ts): guards "fit/coverage/milestones use effective compute"; `levelOf` still matches live names, so it can regress.
- oversight.ts ~line 207 `lint: no safety module reads M` (multiplierAt/multiplierRef/versionM/mAtLevel...): multiplierAt/multiplierRef still exist in world/calibration.ts, so this guards a live rule (safety must not read the research multiplier). Nothing deleted from oversight.
- serving.ts ~line 603 `S7 lint` (revenue/price/cost/sector files read no serveCost, multiplierRef, bridgeQ...): only multiplierRef is still defined; guards "market side reads no research-multiplier bridge". Nothing deleted from serving (baseline serving: 78 pass, 14 fail, untouched).
- research.ts ~line 667 `lint: e_stack never comes from the know-how readout` (eStack/recipeAt/player.pa): recipeAt still exists elsewhere; live rule.
- safetyideas.ts: `no flat factor on agenda speed` (lineRates body has no `ag ===`, flags, trusted, x2..9 factor), `P14, P15 and P27 are read only by their mechanism`, `RefBot researches none of the four`, `E14/F5 only RefBot sets Trusted to AI`: all live rules. Also the line ~231 regex that the false-result risk is wired to safetySabotage in findings.ts.
- data.ts / suites.ts: nothing left that is a live-rule lint.
A-unit.md counted "about 20" removal checks; 9 were removal-only and deleted (7 as separate checks plus the two greps inside the merged files); the rest are the candidates above.
