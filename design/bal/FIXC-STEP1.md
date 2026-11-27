# Fix C step 1: translated settings on the forced harness, what is left to fit

2026-11-26, branch `bal`, no change under `src/`. Sets: `balance/scans/fixC-step1.json` (`tl-fast`, `tl-central`, `tl-slow`). Run `balance/runs/fixC-step1` (forced aifm, refwide, authors2026, medium, leader, 8 seeds, plus base: 32 games). Analysis: `scripts/v2/s1compare.ts fixC-step1 --map tl-fast=fast,tl-central=central,tl-slow=slow --sc-shift 0` and `.scratch/fixc-step1.mts` (the SC->SAR gap, which s1compare skips).

## 1. Sets and run
- All 11 translated settings resolve in `applyOverrides` (dry run) and move the live value. Per set: `cap.V3_CAL.authors2026.{gSC,sdSC,dBM,r,tasteLimit}`, `cap.PROD_PRESETS.authors2026.{m2b,La,slow10}`. `lam`, `rc` and `Ca` have no authors2026 entry, so they go through `cap.PROD_DEFAULT.{lam,rc,Ca}`; this is the same thing here, since the run holds only authors2026. Nothing was left at the preset. `Ca` and `slow10` are applied too (the CES asymptotes). All three sets use the same preset, so G(V0) (START_STATE) is the authors2026 one for fast too.
- Run: estimate 32 games x 1-3 min / 8 workers = 4-12 min. Actual: 4 min, then 7 workers died (Windows exit 3221225794, DLL init, after a duplicate launch); the rerun with 6 workers took the 10 missing games from the cache (2.3 min). All 32 games ran.
- **SC convention change in s1compare:** it used SC = AIFM AC + 0.5 y (S1-SCOUT). New option `--sc-shift <years>` (default 0.5, unchanged) and `--map set=timeline` (each set against its own timeline only). Here `--sc-shift 0` = FIXC-TRANSLATION's "SC = AC", matching the scenarios.ts SC targets (AC dates).

## 2. Per timeline, game median (n = 8) against target p50 [p25, p75]
| | SC date | SC>SAR (y) | SAR>SIAR (y) | SIAR>ASI (y) |
|---|---|---|---|---|
| **fast** game | 2027.69 | 0.38 | 0.20 | 0.11 |
| fast target | 2027.94 [2027.55, 2028.21] | 0.44 [0.13, 0.81] | 0.65 [0.30, 1.53] | 0.59 [0.12, 3.09] |
| fast score / ratio | -0.8 / inside IQR | inside IQR | -0.7 / x0.31 | -0.3 / x0.19 |
| **central** game | 2028.91 | 0.34 | 0.21 | 0.09 |
| central target | 2029.72 [2028.93, 2030.22] | 0.86 [0.32, 1.59] | 1.32 [0.50, 3.29] | 0.91 [0.18, 3.85] |
| central score / ratio | -1.3 / just below p25 | inside IQR | -0.8 / x0.16 | -0.5 / x0.09 |
| **slow** game | 2030.69 | 0.51 | 0.33 | 0.15 |
| slow target | 2034.82 [2031.10, 2036.92] | 2.27 [0.56, 6.55] | 4.00 [1.21, 12.05] | 2.85 [0.61, 13.27] |
| slow score / ratio | -1.4 / 0.4 y below p25 | below p25 | -0.7 / x0.08 | -0.4 / x0.05 |

The half-IQR score hides the gap errors: the target IQRs are wide on the long side, so a game 3-20x too short still scores -0.3 to -0.8. The ratio (game / target p50) is the honest figure. SAR date score: -1.6 / -4.1 / -4.0 (fast / central / slow), SIAR -1.0 / -1.7 / -1.8, ASI -0.5 / -0.9 / -0.9. Base (untranslated authors2026): SC 1104 d (2028.5), SAR 1114, ASI 1240 d.

## 3. Horizon growth h80(t)/h80(2025.5), log10, up to SC (score in half-IQR)
| year | fast: game / target [p25, p75] | central | slow |
|---|---|---|---|
| 2027 | 1.15 / 1.43 [1.17, 1.83], -0.9 | 1.12 / 1.35 [1.12, 1.66], -0.9 | 1.10 / 1.23 [1.06, 1.56], -0.5 |
| 2028 | 3.02 / 3.47 [2.16, -], no score (no p75) | 2.68 / 2.70 [1.84, 4.51], 0.0 | 2.68 / 2.19 [1.59, 3.56], +0.5 |
| 2030 | the game ends first | not scored (SC is 2028.9) | 4.97 / 5.22 [2.63, -], no score |
Horizon is the best-fit quantity: all scored rows are inside +-1, in every timeline, with the same early shortfall of 0.1-0.3 log10 in 2027.

## 4. Counts within +-1 half-IQR (scored checkpoints of the timeline)
| | all scored | milestones + gaps (6) | horizon | speed-up | eff. compute |
|---|---|---|---|---|---|
| fast | 13/17 | 5/6 | 1/1 | 3/5 | 4/5 |
| central | 8/18 | 3/6 | 2/2 | 1/5 | 2/5 |
| slow | 6/18 | 3/6 | 2/2 | 0/5 | 1/5 |
Total 27 of 53. The misses are the SAR and SIAR dates (-1.6 ... -4.1), SC in central and slow, and the research speed-up, which is 4 to 10 half-IQRs too high in all three (see 5).

## 5. What is left, and the step 2 fit plan
Sensitivities (FIXC-SCREEN section 4/6, authors2026, from other base values, so a start only): dBM x1.74 plus r x0.577 together raised SAR>SIAR x10 and SIAR>ASI x22 (one knob alone x2-4); SC moves +-85 d from them. gSC +-1 OOM moves SC about +-0.6 y (about 215 d per OOM; nonlinear); sdSC -122/+61 d over +-1.6 SD; lam +-80 d. m2b up shortens SIAR>ASI more than SAR>SIAR, which helps because the game's SIAR>ASI / SAR>SIAR is 0.4-0.55 against a target of 0.7-0.9 (but the dBM+r combos overshoot it, 1.2-1.3).
- **fast** (gaps x3 and x5 too short, SC 0.25 y early, inside the IQR): one mild knob, r 3.45 -> about 2.4 (x0.7) or dBM 2.06 -> about 2.7; both inside the AIFM IQR (r 2.14-5.65, dBM 1.27-3.44). SC: gSC +0.2 to +0.4 OOM at most (32.13 -> about 32.4; IQR 30.6-34.0), and fit it after the gaps, because the knobs also push SC later.
- **central** (gaps x6 and x11, SC 0.8 y early): dBM 1.92 -> about 3.0 and r 2.88 -> about 2.0, about 0.7 of the full screened step in log; both inside the IQR (dBM 1.04-3.42, r 1.73-5.03). m2b up (3.9 -> about 5.5; IQR 2.7-7.3) to keep SIAR>ASI in proportion. SC: gSC 33.66 -> 34.0-35.1 (+0.3 to +1.4 OOM; the top is at the IQR edge, 31.8-35.8); sdSC and lam are the reserve (+-0.2-0.3 y).
- **slow** (gaps x12 and x20, SC 4.1 y early, SAR 6 y early): needs the full step, dBM 2.79 -> about 4.9 and r 2.86 -> about 1.65, both at the edge of the IQR (dBM 1.51-5.3, r 1.63-5.31); m2b and tasteLimit are the extra room (m2b IQR 2.5-7.1, limit 3.75-16.6). SC: the target p25 (2031.1) needs only gSC +0.7 OOM; the target p50 (2034.8) needs about +4 y, which extrapolates to about +6 OOM (43 against an IQR top of 41.5), so the SC median is probably not reachable by gSC inside the IQR.
- **Not fixable by these knobs: the pre-SC research speed-up.** It is the same in all three timelines (log10 growth 0.66 in 2027 against 0.18 / 0.09 / 0.08 targets, 1.8 / 1.2 / 1.1 in 2028 against 0.67 / 0.20 / 0.14), and the game's effective compute runs 0.3-1.4 half-IQR ahead of the AIFM from 2027 (central 2030: +6.3). That is why central and slow reach SC too early whatever gSC says. Question for step 2: is the lab speed-up (labSpeedRel, includes AI and compute-per-researcher gains) the same quantity as the AIFM progress multiplier? If yes, a mechanism or a start-state item is open; if no, rescale the comparison. Decide this before fitting slow's SC through gSC alone.
- Nonlinearity: a sharp optimum (loop gain crossing 1), so fit with 2 knobs and a bisection on 8-16 seeds, not a regression. Resolution is 7 days and n = 8 (a ratio of 0.8-1.25 is noise).
