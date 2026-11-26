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
