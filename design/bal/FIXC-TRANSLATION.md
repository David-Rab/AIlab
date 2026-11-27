# Fix C: AIFM group parameters translated into game settings

Read-and-compute only (2026-11-26). Machine-readable values: `balance/scans/fixC-translation.json`. Scripts: `aifm-runs/scripts/fixc_extract.py` (streams the rollouts, one line at a time), `fixc_analyze.py` (group join), `fixc_report.py` (table + JSON).

## Groups (reproduced exactly)
3,000 runs, 109 failed (infeasible draws) excluded, 2,891 pooled. SAR-date percentiles over the pool (never reached = infinity): p20 2028.10, p30 2028.71, p45 2030.04, p55 2031.24, p70 2035.29, p80 2041.16. Groups: fast n=290, central n=289, slow n=290, the same n and cut dates as `out/eli_split_sar/clusters_summary.json`. Parameters come from the rollout lines (equal to `samples.jsonl`); every translated value is computed **per run, then the group median** (a median of derived values is not the derived value of a median, e.g. for gSC).

## 1. Per-group statistics (p25 / p50 / p75)
| quantity | fast (SAR p20-30) | central (p45-55) | slow (p70-80) | all 2,891 |
|---|---|---|---|---|
| SAR date | 2028.23 / 2028.38 / 2028.57 | 2030.30 / 2030.57 / 2030.89 | 2036.22 / 2037.58 / 2039.27 | 2028.33 / 2030.35 / 2036.11 |
| AC date | 2027.55 / 2027.94 / 2028.21 | 2028.93 / 2029.72 / 2030.22 | 2031.10 / 2034.82 / 2036.92 | 2027.62 / 2029.02 / 2032.41 |
| present doubling time (yr) | 0.24 / 0.333 / 0.487 | 0.264 / 0.348 / 0.51 | 0.28 / 0.417 / 0.584 | 0.253 / 0.366 / 0.535 |
| doubling difficulty d | 0.845 / 0.9 / 0.956 | 0.864 / 0.91 / 0.961 | 0.876 / 0.926 / 0.977 | 0.862 / 0.913 / 0.968 |
| taste slope (SD / progress-yr) | 1.73 / 2.64 / 3.97 | 1.54 / 2.48 / 3.76 | 1.06 / 1.64 / 2.93 | 1.36 / 2.33 / 3.98 |
| anchor progress rate (OOM/yr) | 1.29 / 1.75 / 2.36 | 1.14 / 1.51 / 2.15 | 1.14 / 1.48 / 2.05 | 1.18 / 1.58 / 2.27 |
| taste slope (SD / OOM) | 0.899 / 1.5 / 2.43 | 0.904 / 1.61 / 2.97 | 0.583 / 1.11 / 2.05 | 0.765 / 1.42 / 2.65 |
| dBM = 3.09 / (SD per OOM) | 1.27 / 2.06 / 3.44 | 1.04 / 1.92 / 3.42 | 1.51 / 2.79 / 5.3 | 1.17 / 2.18 / 4.04 |
| taste at AC (SD) | -0.588 / 0.744 / 2.04 | -1.12 / 0.31 / 1.59 | -1.54 / -0.18 / 1.83 | -1.11 / 0.468 / 2.04 |
| taste at AI2027-SC (SD) | 1.29 / 3.58 / 7.85 | 0.639 / 2.43 / 5.72 | -1.09 / 0.782 / 3.36 | 0 / 2.33 / 5.75 |
| r_software (calibrated) | 2.14 / 3.45 / 5.65 | 1.73 / 2.88 / 5.03 | 1.63 / 2.86 / 5.31 | 1.78 / 3.11 / 5.5 |
| median-to-top taste multiplier | 2.43 / 4.09 / 7.32 | 2.7 / 3.89 / 7.25 | 2.52 / 3.82 / 7.12 | 2.5 / 3.99 / 7.07 |
| taste limit | 4.08 / 7.52 / 15.5 | 3.83 / 7.64 / 17 | 3.75 / 7.71 / 16.6 | 3.75 / 7.49 / 16.3 |
| parallel penalty | 0.368 / 0.508 / 0.655 | 0.386 / 0.507 / 0.631 | 0.381 / 0.51 / 0.661 | 0.36 / 0.497 / 0.638 |
| rho coding labor (set -5, -2, -1) | -5 / -2 / -1 | -2 / -2 / -2 | -5 / -2 / -2 | -5 / -2 / -2 |
| inf labor asymptote | 6.9 / 20.3 / 68.8 | 5.11 / 18 / 70.3 | 5.02 / 14.2 / 51.8 | 4.94 / 16.2 / 61.3 |
| inf compute asymptote | 121 / 722 / 4,400 | 166 / 1,220 / 8,300 | 150 / 1,010 / 6,600 | 138 / 1,010 / 6,500 |
| inv compute anchor exp cap | 2.05 / 2.65 / 3.63 | 2.08 / 2.85 / 3.86 | 2.1 / 2.79 / 3.99 | 2.11 / 2.8 / 3.87 |
| serial uplift now | 1.25 / 1.75 / 3.03 | 1.21 / 1.56 / 2.79 | 1.21 / 1.55 / 2.42 | 1.24 / 1.64 / 2.75 |
| excess uplift doubling (months) | 2.98 / 4.81 / 8.09 | 3.89 / 6.45 / 10.6 | 4.84 / 9.05 / 14.1 | 3.67 / 6.7 / 12.2 |
| OOM from game V0 to AC (date route) | 2.97 / 4.53 / 6.38 | 4.22 / 6.03 / 8.16 | 6.68 / 9.56 / 13.7 | 3.63 / 6.08 / 10.6 |
| same, by V0's 40.6-min horizon | 3.11 / 4.85 / 6.87 | 4.39 / 6.27 / 8.59 | 6.88 / 10.1 / 13.8 | 3.8 / 6.42 / 11.2 |
| OOM from V0 to AI2027-SC (date route) | 4.15 / 6.71 / 10.3 | 5.39 / 7.76 / 12.4 | 7.24 / 10.6 / 15.4 | 5.19 / 8.09 / 13.7 |
| AC horizon requirement (log10 min) | 5.77 / 7.51 / 9.24 | 5.47 / 7.08 / 8.69 | 5.78 / 7.37 / 9.02 | 5.72 / 7.29 / 8.93 |

AC anchor mix per group (uplift-solved / time-horizon / revenue): fast 180/63/47, central 154/68/67, slow 165/53/72. "OOM from V0" = AIFM `progress` at the milestone minus `progress` at 2025.445 (V0's date, CAL2-T); `effective_compute` gives identical differences.

## 2. Translation table
Fast / central / slow = group medians of the per-run translation. G(V0) for gSC is the preset's `START_STATE.g` (27.600 / 27.627 / 27.766, `calibration.ts:38-42`); the OOM above V0 is the group quantity (4.53 / 6.03 / 9.56).

| game setting | AIFM parameter(s) | formula (source) | meaning matches? | fast / central / slow |
|---|---|---|---|---|
| `gSC` | OOM of effective compute from V0 to AC (run output `progress`) | G(V0) + progress(AC) - progress(2025.445), `workTypes.ts:304-308` (CAL2-T), `CAL-world-sources.md` section 4; SC read as AC | approximately: same unit (OOM of effective compute) and same law of use, but AIFM's V0 horizon differs by run (30-64 min) and the SC=AC reading is a choice (see 3) | **32.13 / 33.66 / 37.33** |
| `gSC` alt, SC = AI2027-SC (about AC + 0.4-0.5 y) | same, at the `AI2027-SC` milestone | same formula at AI2027-SC (CAL2-T committed this) | approximately; breaks the milestone order in fast (see 3) | 34.31 / 35.39 / 38.33 |
| `sdSC` | `ai_research_taste_at_coding_automation_anchor_sd` | 1:1, taste at AC (`CAL-world-sources.md` section 3) | yes, at AC (the run's own series gives 0.744 / 0.310 / -0.094) | **0.74 / 0.31 / -0.18** |
| `sdSC` alt | run's `ai_research_taste_sd` at AI2027-SC | CAL2-T (2.94 on Eli's medians) | approximately; fast 3.58 exceeds `TOP_SD` 3.09 | 3.58 / 2.43 / 0.78 |
| `dBM` | `ai_research_taste_slope`, `anchor_progress_rate` | TOP_SD / (slope / rate), `workTypes.ts:300-303`; per run | yes (slope is SD per progress-year, converted to per OOM by the present-day rate) | **2.06 / 1.92 / 2.79** |
| `r` | `r_software` (calibrated per run, `results.r_software`) | SE = r log10(RS), `_impl.py:1079` vs game `research.ts:105` lineRate | approximately: same law; AIFM's research stock RS is its own CES of compute and coding labour, the game's is team-months and FLOP | **3.45 / 2.88 / 2.86** |
| `tasteLimit` | `taste_limit` | 1:1, `workTypes.ts:310-314` | yes | **7.52 / 7.64 / 7.71** |
| `m2b` | `median_to_top_taste_multiplier` | 1:1, `research/13` section 1.4 | yes | **4.09 / 3.89 / 3.82** |
| `lam` | `parallel_penalty` | 1:1 | yes | **0.508 / 0.507 / 0.510** |
| `rc` | `rho_coding_labor` | 1:1; discrete draw {-5: 25%, -2: 50%, -1: 25%} | yes; the median is the mode | **-2 / -2 / -2** |
| `La` | `inf_labor_asymptote` | 1:1 (authors2026 uses 15, ai2027 100 [D]) | yes | **20.3 / 18.0 / 14.2** |
| `Ca`, `slow10` (same block, not asked) | `inf_compute_asymptote`, `inv_compute_anchor_exp_cap` | 1:1 | yes | Ca 722 / 1,216 / 1,014; slow10 2.65 / 2.85 / 2.79 |
| start state `g, b0, v0` | none (observed history) | not group-dependent | n/a | unchanged; AIFM progress multiplier at 2025.5 is 1.064 / 1.056 / 1.068, near the V3.7 start-M sources 1.01-1.25 |

Existing values for comparison: gSC 31.25 / 34.09 / 38.3; dBM 0.6 / 2.17 / 1.6; r 4 / 3.19 / 4; sdSC 0 / 2.94 / 0.5; tasteLimit 16 / 8 / 8; m2b 3.25 / 3.7 / 3.25; La 100 / 15 / 100 (fast, authors2026, slow presets).

## 3. Choices the designer must make
1. **What the game's SC is.** `balance/scenarios.ts:393` reads the model's AC as SC and the targets are AC dates; `STAGE1-DESIGN.md` mismatch 2 and CAL2-T read SC as AI2027-SC (AC + 0.37 / 0.55 / 0.45 y in the groups). The table's bold values use AC. Reasons: (a) it matches the scenario targets; (b) sdSC is then a plain parameter; (c) AI2027-SC comes after SAR in 146 of the 272 fast runs that reach it (118 of 272 central, 72 of 271 slow), so its taste (fast median 3.58 SD) is above `TOP_SD`, and the game's structure (`refDelta`: domains sit 1 - sdSC/TOP_SD gaps above SC) cannot hold SC after SAR. Using AI2027-SC would also move SC about 0.4-0.5 y after the AC target.
2. **gSC by the horizon law does not separate the groups.** AC's horizon requirement through h80 = 40.6 min x 4.2^(G - G_V0) gives 9.5 / 8.8 / 9.2 OOM above V0 (G_SC about 37.1 / 36.4 / 37.0), the same for all groups, and only 622 of 2,891 runs anchor AC on the horizon (the rest by uplift or revenue). AIFM's horizon is superexponential (d below 1), so the same progress buys far more horizon late: the median AIFM h80 at AC is 4.8e4 / 3.4e7 / 5.7e11 min; the game's fixed 4.2 per OOM at the translated gSC gives h80 of 2.7e4 / 2.3e5 / 3.7e7 min. Fast agrees within 2x; central and slow fall about 150x and 1.5e4x short (the "horizon law" mismatch of STAGE1-DESIGN, a mechanism question, not a parameter).

## 4. Settings that need fitting (no translation)
- **Takeoff gaps SC -> SAR -> SIAR -> ASI.** The AIFM sets them with `excess_uplift_doubling_time` (4.8 / 6.5 / 9.1 months: the strongest group gradient), the experiment-compute bottleneck (`inf_labor_asymptote`, `inf_compute_asymptote`, `inv_compute_anchor_exp_cap`) and taste (CAL2-T's counterfactuals, `BUILD-NOTES.md:5029`). The game has no uplift-doubling setting; AI labour emerges from capability. Fit r within 2.1-5.7 (fast IQR), 1.7-5.0 (central), 1.6-5.3 (slow) and dBM within 1.3-3.4 / 1.0-3.4 / 1.5-5.3, and La within 6.9-69 / 5.1-70 / 5.0-52 (IQRs), if the gaps need it. `taste_limit` and `m2b` barely differ between groups (IQR 4-17 and 2.4-7.3).
- **Horizon growth** (`present_doubling_time` 0.33 / 0.35 / 0.42 yr, `d` 0.90 / 0.91 / 0.93, `gap_years` 0.51 / 0.65 / 0.66): no game setting; fixed 4.2 per OOM (about 0.33 OOM per doubling). The AIFM's own implied value is 3.0 / 3.5 / 3.1 per OOM at the median (IQR about 2-7), so the constant is near the middle; the superexponential acceleration is missing.
- **gSC** is translated, but the game's SC date also depends on the game's own research speed (RefBot's run, compute), which the AIFM progress rate does not carry; if the fit moves it, stay inside the IQR: 3.0-6.4 / 4.2-8.2 / 6.7-13.7 OOM above V0 (G_SC 30.6-34.0 / 31.8-35.8 / 34.4-41.5).
- **Rival / world compute path, uplift now** (`serial_uplift_at_reference_date` 1.75 / 1.56 / 1.55): no group-specific game setting; start state stays shared.

## 5. Sanity: ordering
As expected for fast < central < slow: AC and SAR dates; taste at AC (0.74 > 0.31 > -0.18, slow's taste is lower); taste slope in SD per progress-year (2.64 / 2.48 / 1.64) and per OOM (1.50 / 1.61 / 1.11); excess uplift doubling (4.8 / 6.5 / 9.1 months); OOM to AC (4.5 / 6.0 / 9.6); `La` (20.3 / 18.0 / 14.2); present doubling time (0.33 / 0.35 / 0.42 yr); `d` (0.90 / 0.91 / 0.93).

Surprises:
- **r is not monotone:** fast 3.45 but central 2.88 and slow 2.86 (equal). The AIFM slow group is not a low-returns world; the game's slow r of 4 is above even the fast value, and Forethought's 4.0 is the source of that, not the AIFM group.
- **dBM is not monotone:** slow is the highest (2.79) because its taste slope is lowest; central is below fast (1.92 vs 2.06). The existing fast value 0.6 (Daniel's p10 slope) is far below the group's p25 of 1.27.
- **Taste at AC is the same distribution family everywhere** (IQR 2.6-3.4 SD wide in every group): the group differences are about 1 SD against that spread, so group medians say little about any single run.
- **tasteLimit, m2b, lam, rc, slow10 are flat across groups** (no group signal); they are the same world parameters in every timeline. `Ca` is not monotone (722 / 1,216 / 1,014).
- **gSC is the dominant separator:** 4.5 vs 9.6 OOM, so slow is a different compute requirement, not just a slower taste. Part of this is mechanical: the split is on the SAR date, so slow groups mix late AC with a long AC to SAR gap (median 0.44 / 0.86 / 2.27 y).
- **The fast value of gSC (32.13) is 0.9 OOM above today's 31.25**, and slow (37.33) is 1.0 below today's stand-in 38.3; central (33.66) is 0.43 below 34.09 (that value is one run on Eli's median parameters, read at AI2027-SC, 34.09 vs this group's 35.39 at the same milestone).
- Failed runs (109) are excluded; their parameters (extreme infeasible draws, `scripts/failure_params.py`) are not in any group.

## 6. R2.3: per-timeline horizon law and research pace (2026-11-26)

Values: `balance/scans/fixC-translation-v2.json`; sets file `balance/scans/fixC-r23-sets.json` (applied to authors2026 like `fixC-step1.json`; the variant with the unfitted law is `fixC-r23-sets-faithful.json`). Source statistics re-streamed from the same three rollouts (scratch `r23_extract.py`, `r23_analyze.py`): progress, 80% horizon and `software_efficiency` at the METR dates, per run, then the group median.

**Mechanism** (defaults reproduce the old game; fingerprint pair identical, state hashes included). `V3_CAL[preset]` carries three new numbers (`workTypes.ts` V3Cal): `h50PerOOM` (4.2), `h50Accel` (0), `pace` (1). `models/capability.ts` `h50Growth`/`h50Ratio` replace the constant factor in `h50Of`, `workfit.ts` measuredLabour and `safety/traits.ts` policyOf. With `h50Accel` = 0 the law is `4.2^x` bit for bit; with A > 0 it is the AIFM law `h50 = 203 x (1 - A x / T)^(ln2 / ln(1 - A))`, x = G - G(V0), T = ln2 / ln(h50PerOOM) OOM, the base floored at `H50_BASE_FLOOR` (0.02, the law's pole). Why this form: the AIFM horizon is superexponential (A = 1 - d is 0.07-0.10), so a constant per OOM cannot follow a group from 2025 to AC (the AC requirement is 10^7.1-10^7.5 minutes), and "constant plus acceleration" is exactly this family with two numbers. `pace` multiplies `researchMods.speed` (`workfit.ts`), the rate of every science and experiment team of both departments; it is stored in the world only when it is not 1.

**Per timeline (fast / central / slow):**
| | fast | central | slow | source |
|---|---|---|---|---|
| A = 1 - d | 0.1003 | 0.0900 | 0.0744 | AIFM `doubling_difficulty_growth_factor`, per-run median |
| doubling length at V0, OOM (faithful, re-anchored from the horizon date) | 0.770 (2.46 per OOM) | 0.668 (2.82) | 0.723 (2.61) | `present_doubling_time x anchor_progress_rate` + A x OOM(V0 to 2026.27), median |
| doubling length at V0, OOM (**used**, fitted) | 0.496 (4.05 per OOM) | 0.495 (4.06) | 0.495 (4.06) | one number per timeline fitted to the 2026.27 band, A fixed |
| `pace` | 3.75 | 3.2 | 3.1 | fitted: game software 2025.5-2026.5 on the AIFM median |
| AIFM software OOM, 2025.5-2026.5 (median of 290) | 1.119 | 0.932 | 0.889 | `software_efficiency`; the 20-sample figures of FIXC-PRESC (1.08 / 1.05 / 0.73) were a subsample |
| game software OOM, same year (median of 4 seeds) | 1.14 | 0.90 | 0.97 | continuous stack (`stacksGEquiv`) |
| median `ac_time_horizon_minutes` (log10) | 7.511 | 7.084 | 7.366 | AIFM parameter, per-run median |
| `gSC` (law above, G(V0) 27.627 + OOM to 5 x requirement) | 31.949 | 32.139 | 32.762 | |
| `gSC` with the faithful law | 34.337 | 33.718 | 35.131 | |
| `gSC` of section 2 (progress route) | 32.133 | 33.66 | 37.327 | |

**Why the law is fitted and not the faithful translation.** The game's player lab releases only +0.53 / +0.65 / +0.71 OOM of G by 2025.96 / 2026.13 / 2026.27 (median of seeds 1-4; AIFM effective compute +0.77 / 1.05 / 1.29): releases are lumpy, the player's own base runs are 3.6x smaller after R2.2, and the year-1 G does not respond to `pace` (released G +0.87 at 2026.5 for pace 1 to 5). Through the faithful law (about 2.5-2.8 per OOM at V0) the game's h50 is 326-351 / 363-398 / 382-423 min at those dates against the band low 509 at 2026.27 (fails by 17-25%). The old constant 4.2 gives 562 there. Fitting the V0 doubling length to put 2026.27 about 10% above the low edge gives 4.05-4.06 per OOM in every timeline (inside the AIFM per-OOM IQR, 2-7). Median game h50 (min) at the METR dates 2025.62 / 2025.96 / 2026.13 / 2026.27: fast 203 / 432 / 516 / 567, central 203 / 431 / 514 / 563, slow 203 / 429 / 509 / 557 against 203 [113, 406], 354 (no band; the AIFM's own series gives 523-582), 719 [317, 3634], 1045 [509, 3304]: all inside their bands. Seed 2027 alone releases later (G +0.27 at 2026.13, +0.40 at 2026.27) and fails the 2026.27 band at any per-OOM value inside the AIFM range (it would need about 10 per OOM).

**Forced runs (4 seeds, `--forced aifm --policy refwide --world authors2026`, `--sc-shift 0`), SC date against the AIFM AC median (2027.94 / 2029.72 / 2034.82):**
| run | fast | central | slow |
|---|---|---|---|
| fitted law, pace as above (`r23h`) | 2027.19 (score -2.3) | 2027.41 (-3.6) | 2027.65 (-2.5) |
| faithful law, same pace (`r23`) | 2028.01 (+0.2) | 2027.97 (-2.7) | 2028.50 (-2.2) |
| faithful law, pace 1 (`r23p1`) | 2029.19 (+3.8) | 2028.85 (-1.4) | 2029.72 (-1.8) |

SC is almost independent of `gSC` (1.4 OOM of gSC moves it by months) and set by the pace: matching the AIFM's year-1 software rate needs pace 3-4, after which the game's year-2 software is 2.9 OOM/yr against the AIFM's 1.0-1.4 (no diminishing returns on idea projects, R2.4), and the takeoff starts in 2027. The slow timeline cannot reach 2034 at any pace tried. The three forced series are not a pass for SC; the residual belongs to C2 after R2.4.

## 7. R3.1: per-game joint draws (2026-11-26)

The group medians above are replaced, for the new worlds `tl-fast` / `tl-central` / `tl-slow`, by **one whole AIFM run per game**. `aifm-runs/scripts/fixc_draws.py` (group split reproduced exactly: n 290 / 289 / 290, same cut dates) translates every run with the section 2 formulas, and `fixc_draws_ts.py` writes `src/data/v2/timelineDraws.ts` (generated; header names the AIFM commit, Eli config sha256, rollouts and scripts). Per run: gSC (G(V0) of the timeline's preset + progress to AC, SC read as AC), sdSC, dBM, r, tasteLimit, m2b, lam, rc, La, Ca, slow10, and stockAgeYears (research stock / research effort at 2025.5, per run: median 1.38 / 1.36 / 1.39 years; the round-2 sets used 1.43 / 1.32 / 1.19 from a 20-run subsample), plus the run's AIFM AC / SAR / ASI dates. Group medians of the per-run values reproduce the section 2 table. Only sdSC is outside the game's range (above TOP_SD 3.09 = the best human: 29 / 26 / 27 runs, clamped to TOP_SD); the CES parameters are finite for all 869 runs.
The world is authors2026's (compute table, start state, horizon law at the default 4.2 per OOM, pace 1: section 6's fitted law is not used). The index is `hash32(seed, 'world:aifmRun') mod n` (`world/hidden.ts` `aifmDrawOf`; no named stream moves), stored in `hidden.timeline.aifmRun` and in the balrun GameRecord (`aifmRun`, `aifmDraw`). The player's belief about the production function (`PROD_PRESETS['tl-*']`) is the group median, the world is the drawn run's.

## 8. R3.3: the coverage law before the superhuman coder, from the AIFM automation schedule (2026-11-27)

**The two laws.** AIFM (`progress_model/automation_model.py` `get_automation_fraction`; anchors in `_impl.py` `_solve_uplift_anchored_automation_model` / `_derive_automation_schedule`): the fraction of coding tasks AI does, a logistic of `progress` (OOM of effective compute), `A(p) = min(1, L / (1 + exp(-k (p - x0))))`. L = `automation_logistic_asymptote` (sampled, median 1.09); k and x0 are solved per run, from the uplift now and the excess-uplift doubling time (`uplift-solved`, 154-180 runs per group) or from the lower anchor and `progress_at_aa` (`time-horizon`, `revenue`); A reaches 1 before AC. Recovered exactly from each run's own `results.automation_fraction` against `results.progress` (max error 1e-13, 863 of 869 runs; 6 are step schedules). Game (`workfit.ts coverage`, `workTypes.ts COVER`): `a_w = sigma((F_w - theta_w)/s) x p(H_w | h50)`, `theta_w = F*_w - s ln(top/(1-top)) + kappa_v (0.9 - v_w)`, `s` 0.8 OOM, `top` 0.95, F*_SWE = gSC. Same object, same role (the `a` of the coding CES), same unit (OOM of effective compute).

**Where they diverge (medians of the runs, A against OOM below AC; game = the old constants):**
| OOM below AC | -5 | -4 | -3 | -2 | -1 |
|---|---|---|---|---|---|
| AIFM fast / central / slow | .15 / .41 / .79 | .28 / .58 / .86 | .48 / .73 / .92 | .71 / .86 / .96 | .90 / .95 / .98 |
| game, s 0.8, top 0.95 | .04 | .11 | .31 | .61 | .84 |
The run's scale 1/k is median 1.19 / 1.63 / 2.46 OOM (IQR 0.58-2.5 / 0.92-3.3 / 1.4-5.3) against the game's 0.8, and the AIFM midpoint sits further below AC in slower runs (median -1.9 / -3.3 / -6.2 OOM; the game's -2.36). The horizon term p(H) is not in the AIFM schedule (it enters the AIFM only through the AC anchor, `time-horizon` mode) and is left as is: at 2027 it is 0.9-1.0 for SWE (H 2 h) and about 0.6-0.8 for EXP (H 8 h). The per-work-type shifts (kappa_v, the research domains' reference above SC) have no AIFM counterpart either: the AIFM has one fraction, of coding.

**The translation (per run, in `fixc_draws.py` `automation_fit`, `fixc_draws_ts.py` `coverage_settings`):** `covS = 1/k`, clamped to [0.2, 10] OOM (29 / 25 / 45 runs of 290 / 289 / 290 clamped; 1/k reaches 750 in flat schedules); `covTop` = the logistic part at the best human's fit = `sigma(-(x0 + ln L / k - dAC) / covS)`, i.e. the run's own midpoint (the asymptote L is absorbed into the midpoint: identical at low A, within a few points at high A), floored at the game's 0.95 and capped at 0.999 (A is 1 at AC in every run, so the SC predicate, coverage >= 0.9 at the best human's fit, keeps holding). Medians: covS 1.18 / 1.63 / 2.41 (fast / central / slow), covTop 0.95 in 70-75% of runs (p75 0.976-0.99). Against each run's own A over -6..0 OOM below AC the game form has a mean error of 0.05 / 0.04 / 0.04 (median over runs; the old constants 0.23 / 0.28 / 0.49); at the AIFM's own progress at 2026.5 / 2027 / 2027.5 the game form's median is 0.72 / 0.86 / 0.93 (fast), 0.61 / 0.74 / 0.84 (central), 0.54 / 0.66 / 0.74 (slow) against the runs' 0.52 / 0.80 / 0.95, 0.47 / 0.64 / 0.79, 0.44 / 0.59 / 0.69 (about 0.1-0.14 high; the 0.95 floor).

**Game side.** `V3Cal.covS` / `covTop` (optional; `TimelineWorld.v3`), read by `workfit.ts thetaOf` and `coverage` as `w.v3.covS ?? COVER.s`, `w.v3.covTop ?? COVER.top`. Every other world has neither and is unchanged (bot fingerprint identical). Columns 12 and 13 of `timelineDraws.ts` (old columns, runs and dates byte-identical); registry entries `cap.TIMELINE_DRAWS.covS` / `covTop`, kind `sourced`. The sector coverage (`serving.ts`, expert work outside the lab) keeps COVER.s. The slope applies to every work type of the world (SWE, EXP, IDEAS, SAF_*), as COVER.s did.

**Check (`balance/runs/r33check`, forced aifm, reflines, tl-fast / tl-central / tl-slow, 3 seeds each; scratch `.scratch/r33-cov.ts` recomputes the coverage on the games' G and h50 series; medians of 3 games, each against the AIFM run it drew).**
| | game EXP coverage new (old law) | game SWE coverage new | AIFM A (same runs) | game spdM (AIFM 2026.5 / 2027 / 2027.5 central: 1.1 / 1.2-1.5 / -) | game SC - run's AC (y) |
|---|---|---|---|---|---|
| fast 2026.5 / 2027 / 2027.5 | .08 (.22) / .42 (.51) / .93 (.88) | .33 / .84 / .96 | .62 / .75 / .88 | 1.01 / 1.29 / 3.6 | -0.30 (SC 2027.42) |
| central 2026.5 / 2027 / 2027.5 | .38 (.005) / .73 (.03) / .77 (.12) | .60 / .80 / .83 | .60 / .65 / .69 | .88 / .56 / .30 | -0.10 (SC 2028.84) |
| slow 2026.5 / 2027 / 2027.5 | .27 (.00) / .43 (.00) / .57 (.00) | .50 / .62 / .71 | .75 / .85 / .96 | 1.00 / .96 / .79 | -0.51 (SC 2031.39) |
The coverage follows the schedule (central and slow SWE within 0.2 of the runs' A, where the old law gave 0.03-0.37 and 0.00). The game's G at these dates is 0.1-0.5 OOM behind the AIFM progress (G above V0 at 2027: 1.7 / 1.8 / 1.9 against the runs' 1.9 / 2.6 / 2.8), which is the pace question of section 6, not the coverage law. **spdM does not rise in central and slow, it falls below 1 (0.56 and 0.30 in central at 2027 and 2027.5): coverage rose but the matched labour did not.** Hypothesis, not tested here: the labour CES (`effLabour`, rho_c = -2, complements) with no optimal-frontier choice: when the AI team-equivalents are not well above the humans', a coverage a makes L < H (L > H needs AI > about 0.6 H at a = 0.7), while the AIFM's optimal CES picks the automated range (`get_crit_index`) so that automation never lowers its labour. fast, where the agents are larger relative to the staff, does rise (1.29, 3.6).
