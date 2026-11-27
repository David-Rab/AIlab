# Fix C screen: which parameters set the takeoff gaps and the SC date

Measurement only, 2026-11-26, branch `bal` (HEAD 46bc167, fixes A and B in). No change under `src/`. Sets: `balance/scans/fixC-screen.json` and `.md` (value and source of every set). Effects: `balance/scans/fixC-screen-effects.json` (per set, per preset and pooled). Scripts: `.scratch/fixc-an.mjs`. Runs: `balance/runs/fixC-screen`, `balance/runs/fixC-combo`.

## 1. What was run and what it cost
- Forced runs (`--forced aifm --policy refwide`), worlds `ai2027` and `authors2026`, align medium, start leader, seeds 2027, 1, 2, 3 (4 per preset). 8 workers.
- **Screen:** 18 sets plus base, 8 games each = 152 games. Estimate from the 177 s median: 19 x 8 x 177 / 8 = 56 min. **Actual 22 min** (6.5 games per minute; median game 63-85 s per set under 8-way load). No cut was needed.
- **Combo check (added, not in the brief):** 4 combined sets plus base, 40 games, 10 min. It tests whether the top parameters together can reach the targets.
- Time used in total: about 40 of 150 min.
- Each set moves one parameter in both presets together. Values are the AIFM p25 and p75 where the AIFM gives a distribution (all but gSC), else a stated step.

## 2. Parameters
| Parameter | Registry id | Status |
|---|---|---|
| returns r | `cap.V3_CAL.<preset>.r` | screened (x0.577 / x1.734, AIFM r_software p25/p75) |
| taste slope dBM | `cap.V3_CAL.<preset>.dBM` | screened (x0.574 / x1.743, Eli taste slope p75/p25) |
| taste spread m2b | `cap.PROD_DEFAULT.m2b` (ai2027), `cap.PROD_PRESETS.authors2026.m2b` | screened ((m2b-1) x0.499 / x2.005) |
| ideation exponent lam | `cap.PROD_DEFAULT.lam` | screened (0.359 / 0.641, Beta(3,3) quartiles) |
| taste ceiling | `cap.V3_CAL.<preset>.tasteLimit` | screened (3.86 / 16.6, lognormal ci80 [2,32]) |
| SC threshold gSC | `cap.V3_CAL.<preset>.gSC` | screened (-1 / +1 OOM; no AIFM range) |
| AI taste at SC, sdSC | `cap.V3_CAL.<preset>.sdSC` | screened (+-1.579 SD, AIFM anchor ci80 [-2.5,3.5] quartiles) |
| human/AI labour substitution rc (drives how fast `mIdeas` grows with AI coverage) | `cap.PROD_DEFAULT.rc` | screened (-5 / -1, AIFM rho_coding_labor choice) |
| experiment CES labour asymptote La | `cap.PROD_DEFAULT.La`, `cap.PROD_PRESETS.authors2026.La` | screened (x0.248 / x4.03 on La) |
- **Skipped:** none of the candidates was un-overridable. There is no separate "AI-ideation boost" parameter: `mIdeas` is `slots.IDEAS.m = L/H` from `effLabour` (workfit.ts:`labourOf`), set by rc, coverage (COVER.*), the compute for AI staff and lam. rc is its only free constant, so rc stands for it. Not screened: COVER.s/top, H50_PER_OOM, ASSIST (not named as loop-gain drivers).
- `sampled` and `fast`/`slow` presets were not run (brief: ai2027, authors2026).

## 3. Base (paired reference, medians of 4 seeds per preset)
| | SC day | SC year | SC>SAR | SAR>SIAR | SIAR>ASI | G at 2028 |
|---|---|---|---|---|---|---|
| ai2027 | 624 | 2027.2 | 74 d | 63 d | 25 d | 51.3 |
| authors2026 | 1147 | 2028.6 | 4 d | 49 d | 28 d | 32.0 |
- Targets (AIFM, SAR-split groups; `balance/scenarios.ts`), p50 with quartiles, in days: **fast** SAR>SIAR 237 (110-559), SIAR>ASI 215 (44-1129), SC (AC+0.5 y) 2028.44 (2028.05-2028.71); **central** 482 (183-1202), 332 (66-1406), SC 2030.22 (2029.43-2030.72); **slow** 1461 (442-4401), 1041 (223-4846), SC 2035.3.
- The game's gaps are 10-20x too short and its SC is 1.2 y (ai2027 vs fast) and 1.6 y (authors2026 vs central) too early. Gaps are quantised to 7 days (weekly ticks); a ratio between 0.8 and 1.25 is noise at n = 8.

## 4. Effects (pooled, 8 games; x = set median / base median; d = SC shift in days)
"dn" = the smaller value, "up" = the larger value. For dBM and m2b/r the slow-takeoff side is dBM up, r dn, m2b dn.
| Param | SC d (dn / up) | SAR>SIAR x (dn / up) | SIAR>ASI x (dn / up) | SAR>ASI x (dn / up) |
|---|---|---|---|---|
| **dBM** | +35 / -48 | 0.56 / **2.33** | 0.57 / **3.71** | 0.51 / **2.53** |
| **r** | +38 / -36 | **2.05** / 0.81 | **4.00** / 0.57 | **2.30** / 0.65 |
| **m2b** | +7 / 0 | **1.63** / 0.88 | **2.14** / 0.41 | **1.62** / 0.65 |
| lam | +85 / -80 | 1.50 / 0.81 | 1.43 / 1.43 | 1.30 / 0.88 |
| sdSC | +61 / -122 | 1.19 / 0.69 | 1.14 / 1.14 | 1.10 / 0.76 |
| La | +1 / -2 | 1.19 / 0.88 | 1.43 / 0.86 | 1.18 / 0.85 |
| tasteLimit | 0 / 0 | 1.04 / 1.00 | 1.43 / 0.57 | 1.00 / 0.85 |
| gSC | -190 / +170 | 0.81 / 0.94 | 1.14 / 1.14 | 0.81 / 0.90 |
| rc | +9 / -26 | 1.13 / 1.04 | 1.14 / 1.14 | 1.05 / 0.98 |
Per preset the picture is the same (see the effects JSON): authors2026 dBM up gives SAR>ASI x3.7, r dn x3.2; ai2027 x2.4 and x2.1. G at 2028 (ai2027 only, authors2026 is pre-takeoff at 32.0 in every set): r up +24, dBM dn +7, r dn -14, dBM up -13; the others move it by 2-15.

## 5. Ranking
**Takeoff gaps** (span |ln(up/dn)| of SAR>ASI; SIAR>ASI in brackets): 1. **dBM** 1.60 (1.87), 2. **r** 1.26 (1.95), 3. **m2b** 0.91 (1.66), 4. lam 0.39 (0.00), 5. sdSC 0.37, 6. La 0.33 (0.51), 7. tasteLimit 0.16 (0.92, only on SIAR>ASI), 8. gSC 0.10, 9. rc 0.07. The top three are well above the rest; below them most effects are near the noise level (ratios 0.8-1.25), except tasteLimit on SIAR>ASI.
**SC timing** (SC span in days, dn to up): 1. **gSC 359**, 2. **sdSC 183**, 3. **lam 164**, 4. dBM 82, 5. r 73, 6. rc 35; m2b, La and tasteLimit about 0. gSC does not move takeoff gaps. sdSC and lam move SC by a few months and the gaps little.

## 6. Can the targets be reached inside the AIFM ranges? (combo run, same 8 games per set)
Combining the top parameters at the slow side (medians in days; SAR>SIAR / SIAR>ASI):
| Set | ai2027 | authors2026 | SC shift |
|---|---|---|---|
| base | 63 / 25 | 49 / 28 | 0 |
| combo2-p25: dBM x1.743, r x0.577 | **240 / 290** | **484 / 627** | -1 d (pooled) |
| combo3-p25: + m2b | 307 / 423 | 609 / 740 | +27 |
| combo4-p25: + tasteLimit 3.86 | 327 / 471 | 659 / 747 | +27 |
| combo4-p10: p10 of all four (dBM x2.875, r x0.333, m2b-1 x0.267, limit 2) | 1723 / 1126 | 2140 / 1095 | +71 |
- **Takeoff gaps: yes.** Two parameters at their AIFM **quartiles** already give ai2027 240 / 290 d against the fast targets 237 / 215, and authors2026 484 / 627 d against central 482 / 332. SAR>SIAR hits both targets; SIAR>ASI overshoots a little (x1.3 fast, x1.9 central), so it needs less than the full m2b/r/dBM step, or a milder ceiling pair. The p10 set (all inside the AIFM's 80% range) gives 1723-2140 / 1100 d, past the slow targets (1461 / 1041), so a slow timeline is also reachable. The three together span the whole range from weeks to years.
- The response is **steeply nonlinear**: a x2.3 and x2 step each alone gives x2-4 on a gap, but together x10-x20. That is the loop gain crossing 1 (S1-TAKEOFF-DIAG s3: base Gamma 1.7-2.3; the combos pull it to about 1). So a fit has a sharp optimum; expect to tune with 2 knobs and a bisection, not a linear regression.
- **SC date: not reachable with these.** None of the takeoff parameters moves SC by more than 85 d. The SC gap to the targets is +440 d (ai2027 vs fast) and +580 d (authors2026 vs central). gSC gives about +85 d per OOM (ai2027) and +215 d per OOM (authors2026), with sdSC, lam adding +25 to +190 d. Reaching it by gSC alone needs well beyond the +-1 OOM tested (extrapolating the slopes: about +5 OOM for ai2027, about +2.5 OOM for authors2026; the response is not linear, so this is only an order of magnitude), and gSC has no AIFM range; it is a derived calibration constant, to be fitted directly to the SC date. The SC target is a separate fit step, done after the takeoff knobs, because dBM and r shift SC by up to +-85 d.
- Note ai2027 SC>SAR is 74 d at base and grows to 175-200 d under the combos (the slower AI-taste loop also delays SAR); authors2026 has SC = SAR in most seeds (gap 4 d).

## 7. Recommendation
Use **dBM, r and m2b** (in that order of leverage) for the takeoff gaps, and **gSC** (with sdSC if needed) for the SC date.
1. Fit dBM and r first, each per timeline inside its AIFM range (dBM from the taste-slope quartiles, 1.0-3.8; r 1.8-6.9). Two knobs at their quartiles reach the SAR>SIAR targets of fast and central.
2. Use m2b as the third knob, to balance the two gaps. It moves SIAR>ASI (x2.1 dn / x0.41 up) more than SAR>SIAR (x1.6 / x0.88). The targets have SIAR>ASI / SAR>SIAR = 0.9 (fast) and 0.7 (central); base is 0.4-0.6 and the combos with dBM+r give 1.2-1.3, i.e. SIAR>ASI overshoots. So pair dBM up and r dn with **m2b up** (shortens SIAR>ASI most). The combos tested m2b dn, which lengthens both; m2b up with dBM+r was not run.
3. Then refit gSC (and sdSC) on the SC date. The fit order: dBM/r/m2b on the gaps, gSC on SC, one more pass on dBM.
4. Leave lam, rc, La, tasteLimit at base: lam and sdSC are worth only SC months, La and rc are noise-sized, tasteLimit changes SIAR>ASI by x0.6-1.4 at most and only matters later.
5. Only values inside the AIFM 80% ranges were used, so the gaps need no mechanism change. The screen did not sample the AIFM parameter correlations (S1.4).

## 8. Caveats
- 4 seeds per preset and 7-day resolution: use the table for ranking and orders of magnitude, not for second digits. The paired per-seed numbers are in the JSON.
- Pairing is by (world, seed); the 2027 and seed 1 games of ai2027 hold most of the SC>SAR spread.
- The combos were not tuned. A fit run (several values on a grid, more seeds) is the next step.
- The mapping preset to timeline (ai2027 to fast, authors2026 to central) is by SC date, as in `s1compare`.
- G at 2028 should be compared with the AIFM effective compute (fast p50 31.4, central 30.6) only for authors2026 here: 32.0 is inside the central range; ai2027's 51 reflects takeoff already done by 2028 (combo2 brings it to 34).
