# Fix C: is the game's pre-SC software progress faster than the AIFM's? (like-for-like check)

2026-11-26, branch `bal`, diagnosis only: no change under `src/` or committed scripts, nothing committed. Probes in `.scratch/`: `presc-probe.ts` (forced aifm, refwide, authors2026, the `tl-*` sets of `balance/scans/fixC-step1.json`; one row per quarter until SC+45 d; 12 games = seeds 2027, 1, 3, 5 per timeline; the SC days equal the fixC-step1 run), `pc-aifm.py` (streams the Eli rollouts one line at a time, 20 samples per SAR group, evenly spaced over the group's sorted ids), `pc-final.py`, `pc-an3.py`, `pc-fin2.py`, `pc-fin3.py` (analysis). Medians; n = 4 games and 20 AIFM samples per timeline, so +-0.2 OOM is noise.

## 1. Definitions used
- AIFM: `effective_compute` = `progress` + const. Hardware (HW) = log10 `training_H100e` growth (checked: EC - SE = 0.57 OOM/yr at 2026.5 = the input path); software (SE) = `software_efficiency`. All as growth from 2025.5. End of window = AC (the game's SC target is AC, `--sc-shift 0`).
- Game: G of the best released model minus G at 2025.5. HW = log10 FLOP of that model's base run (`build.flopPre`); SW = growth of G - HW (recipe stacks + design ideas + RL gain, everything that is not FLOP). G steps at releases; `gStack` is the continuous stack-equivalent.
- AI-caused speed-up. AIFM: `ai_sw_progress_mult_ref_present_day` (AI rate / human-only rate at present-day resources, no resource growth in it). Game: `aiStaffSpeedPart().total` (research speed / the speed with the same people, compute and ideas but no AI staff), read at actual compute. The game's `labSpeedRel` (spd) is AI x resources; resources only = spd / aiTot.

## 2. Decomposition, OOM from 2025.5 (rate = SW gain over the year)
| timeline | year | HW AIFM | SW AIFM | EC AIFM | rate | HW game | SW game | EC game | rate | game gStack |
|---|---|---|---|---|---|---|---|---|---|---|
| fast | 2026.5 | 0.57 | 1.08 | 1.66 | 1.08 | 0.49 | 0.64 | 1.13 | 0.64 | 0.42 |
| fast | 2027.5 | 1.08 | 2.28 | 3.36 | 1.20 | 1.28 | 2.05 | 3.32 | 1.41 | 2.35 |
| fast | at SC / AC | 1.05 | 3.61 | 4.66 | | 1.39 | 2.72 | 4.09 | | |
| central | 2026.5 | 0.56 | 1.05 | 1.61 | 1.05 | 0.52 | 0.67 | 1.19 | 0.67 | 0.60 |
| central | 2027.5 | 1.09 | 2.21 | 3.30 | 1.16 | 1.24 | 1.87 | 3.10 | 1.21 | 2.15 |
| central | 2028.5 | 1.58 | 3.41 | 4.99 | 1.20 | 1.61 | 3.37 | 5.02 | 1.49 | 2.92 |
| central | 2029.5 | 1.86 | 4.83 | 6.70 | 1.42 | 2.08 | 3.88 (n=1) | 5.96 | | 3.21 |
| central | at SC / AC | 1.84 | 4.59 | 6.43 | | 1.81 | 3.84 | 5.65 | | |
| slow | 2026.5 | 0.57 | 0.73 | 1.30 | 0.73 | 0.49 | 0.71 | 1.20 | 0.71 | 0.42 |
| slow | 2027.5 | 1.13 | 1.47 | 2.60 | 0.74 | 1.27 | 1.57 | 2.84 | 0.86 | 1.47 |
| slow | 2028.5 | 1.60 | 2.21 | 3.81 | 0.74 | 1.63 | **3.49** | 5.00 | **1.92** | 3.02 |
| slow | 2029.5 | 2.08 | 2.84 | 4.92 | 0.62 | 2.03 | **4.59** | 6.55 | 1.10 | 4.22 |
| slow | 2030.5 | 2.35 | 3.41 | 5.76 | 0.58 | 2.30 | **5.42** (n=2) | 7.72 | 0.82 | 4.34 |
| slow | at SC / AC | 2.96 | 4.66 | 7.62 | | 2.38 | 6.97 | 9.34 | | |
Game SC dates (median [range]): fast 2027.78 [2027.63, 2028.43], central 2028.89 [2028.50, 2029.51], slow 2030.86 [2030.17, 2031.73]. AIFM AC medians: 2027.74, 2029.74, 2034.80. AIFM rows after AC are not comparable (its takeoff); fast and central game rows stop at SC.

## 3. Speed-up per unit of inputs (2027.5 / 2028.5)
| timeline | AIFM AI-only `mult_ref` | game AI-only `aiTot` | AIFM effort E/E0 (AI + resources) | game spd/spd0 | game / AIFM | game no-AI (spd/aiTot) |
|---|---|---|---|---|---|---|
| fast | 2.15 / (24 after AC) | 1.19 / - | 7.5 / - | 10.3 / - | 1.37 | 8.7 / - |
| central | 1.37 / 1.69 | 1.03 / 1.55 | 5.4 / 16.0 | 9.95 / 27.9 | 1.83 / 1.75 | 9.6 / 17.4 |
| slow | 1.26 / 1.32 | 1.00 / 1.00 | 4.8 / 10.1 | 8.6 / 15.9 | 1.80 / 1.58 | 8.6 / 15.8 |
- The AI-caused part is not larger in the game: equal or smaller up to SC (slow at 2030.5: 1.15 against 1.64). The earlier "4.6x at 2027" is resources: the game's no-AI speed is 8.6-9.6x at 2027.5, with compute x12.6-13.4 and staff x1.8. So the S1-TAKEOFF-DIAG point holds for the AI part (a definition difference), but the resource part is not a definition: **the game's total research rate grows 1.4-1.8x faster than the AIFM's effort E/E0 (same 2025.5 normalisation).**
- Why: experiment compute. The AIFM's experiment_H100e is 50-56% of total compute at all dates (training 7%). The game's RefBot split starts experiments at 5.1% (49k H100e against AIFM 540-610k) and moves to 24% (2027.5) and 36% (2028.5) while training falls 41% -> 26% -> 20%. Experiment compute grows x60-72 by 2027.5 and x257 by 2028.5, against the AIFM x11.3 and x32.7 (6-8x faster). In absolute terms the game never exceeds the AIFM (12.6M at 2028.5 against 17.7-19.9M H100e): it ramps from a base 11x lower. The CES tames it: game X x3.8 / x14 (central, 2027.5 / 2028.5) against the AIFM `experiment_capacity` x5.4 / x16. The rest of the 1.6-1.8x is units: spd = X x units x taste, units follow staff (x1.8).
- Staff goes the other way: the prescribed L_HUMAN path is x2.2 / x4.2 / x7.2 by 2026.5 / 2027.5 / 2028.5; the game's capabilities staff is x1.33 / x1.79 / x2.12 (RefBot hires towards `hRef`, `ces.ts:74`, and lags it). The game has fewer people than prescribed.

## 4. Training-compute path (question 3)
- Total compute is the same input: forced `total_ai_company_H100e` (game x3.6 / x12.6 / x36.6 by 2026.5 / 2027.5 / 2028.5; CSV x3.7 / x12.3 / x34.4). The AIFM's `training_H100e` is a 7% slice (80k H100e at 2025.5, same growth 0.57 / 1.09 / 1.54 OOM); the game trains with 41% (392k H100e, 5x more), down to 20% by 2028.5.
- The hardware term in G (base-run FLOP) is within 0.15 OOM of the AIFM's at 2027.5 (1.24-1.28 against 1.08-1.13), within 0.03 at 2028.5 (1.61-1.63 against 1.58-1.60) and equal later (slow 2.03 / 2.30 against 2.08 / 2.35). **(c) is excluded: the training share does not put effective compute ahead.** Release timing makes the game lag at 2026.5 (0.49-0.52 against 0.56-0.57) and lead slightly at 2027.5.

## 5. Start state at 2025.5 (question 4)
- G = 27.627 in all three sets (one preset); growth only is compared.
- **The initial software rate differs by timeline in the AIFM and not in the game.** AIFM rate at 2025.5: 1.11 / 1.05 / 0.74 OOM/yr (fast / central / slow, `software_progress_rate_at_reference_year`). Game first-year SW: 0.64 / 0.67 / 0.71. The game starts about 0.4 OOM/yr slow in fast and central and matches only in slow. The translation carries no initial-rate setting (its 11 settings: gSC, sdSC, dBM, r, tasteLimit, m2b, La, slow10, lam, rc, Ca).
- Aligned: AI part at the start (mult_ref 1.05-1.07, automation fraction 0.18-0.26; game aiTot 1.00); `r` (AIFM group medians 3.45 / 2.88 / 2.86; set 3.452 / 2.885 / 2.864); parallel penalty 0.51 against lam 0.51.
- Where the game's software comes from: the lines follow the AIFM law exactly (S = r_l log10(1 + R/n0); the lines' expected stack equals the realised rlMid and rlCeil, e.g. 0.10-0.11 at 2027.5), but the pretraining stack is 2.0-2.2 OOM at 2027.5 against 0.47 from its lines, and 2.7-3.9 at 2028.5-2029.5: about 75% comes from adopted idea nodes (refwide pursues them), which add a fixed effect each and have no diminishing returns. Their pace follows the research rate, not r log10.

## 6. Conclusion
**Mixed: (a) for the AI-caused part, (b) for the resource part, and it shows in slow; (c) is excluded.**
- Pre-SC cumulative software OOM, game / AIFM at the same date: fast 2.05 / 2.28 (2027.5) and central 3.37 / 3.41 (2028.5): equal within noise (the game is 0.4 OOM/yr slow in year 1 and catches up in years 2-3). Slow 3.49 / 2.21 (2028.5), 4.59 / 2.84 (2029.5), 5.42 / 3.41 (2030.5): the game is ahead by +1.3, +1.8, +2.0 OOM, from 2027.5-2028.5 (year-3 rate 1.92 against 0.74 OOM/yr).
- Term: the research rate (resources), not line returns, training share or AI uplift. The game's research rate follows resource growth identically in all timelines (spd x8.6-10 by 2027.5, x16-28 by 2028.5) and software follows it. The AIFM slow timeline keeps software at 0.58-0.74 OOM/yr (its human-only rate falls to x0.42 by 2030.5 from diminishing returns on the research stock) while its effort grows x10 by 2028.5; the game has no equivalent brake on idea-driven progress, and starts the same in all three timelines (section 5).
- Central and fast are not early because software is faster (it equals the AIFM there). Central: the game reaches EC 6.03 (gSC 33.66) at about 2028.9; the AIFM's median EC passes 6.0 at about 2029.2 and 6.43 (the median EC at AC) at about 2029.6, so 0.3-0.8 y is threshold against date plus the year-1 start, small next to slow's 4 y.

## 7. Proposals (not applied)
1. Carry the AIFM's initial software rate per timeline (1.11 / 1.05 / 0.74 OOM/yr) into the game's start (line `mean` or first-year rate), so slow starts slower and fast/central stop starting 0.4 OOM/yr low. Check with this probe: year-1 SW should read 1.08 / 1.05 / 0.73.
2. Give idea nodes diminishing returns like the lines (cost per idea rising with the stack, or an r log10 ceiling on the pretraining stack), so software follows research input logarithmically in every timeline; slow's year-3 burst (1.92 OOM/yr) is the symptom.
3. Start the experiment-compute share nearer the AIFM's (game 5% against 50-56%) or hold it near constant, or normalise spd to the AIFM definition, so "research rate relative to 2025.5" compares with E/E0 without the x6-8 ramp. Bot and readout only, no mechanism.
4. The staff lag (x2.1 against x7.2 by 2028.5) is a separate setting; raising it would speed the game further, so item 2 comes first.

Caveats: 4 games per timeline and 20 AIFM samples (subsample r median 3.1 against the group's 2.88 in central, 4.2 against 3.45 in fast, so AIFM fast is a little high); G steps at releases (`gStack` is 0.1-0.3 OOM higher at 2027.5; it includes serving); slow rows at 2030.5 and 2031.5 have n = 2 and 1.
