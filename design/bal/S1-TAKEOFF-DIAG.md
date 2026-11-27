# S1 takeoff diagnosis: why forced runs blow up after SC

Diagnosis only, 2026-11-26, branch `bal`. No change under `src/` or to committed `scripts/`. Probe: `.scratch/takeoff-probe.ts` (uses `installForced('aifm')`, policy `refwide`, as `balrun --forced aifm`). Logs: `.scratch/takeoff-ai2027-<seed>-<tag>.csv` (every 5 days from SC-120 to ASI+15; one game takes 20-55 s). Analysis scripts: `.scratch/an1.mjs`, `an2.mjs`, `aifm-res*.mjs` (the last read AIFM `rollouts.jsonl` only; no AIFM code was run).

## 1. Short answer
- Capability is not exploding through labour or the experiment CES. Those brakes work. It explodes through **AI research taste**, which multiplies research input per idea, has no ceiling, and rises exponentially with the model's G.
- The feedback gain is above 1. Taste alone gives gain 1.2 and all channels give 1.7-2.3, against a median of 0.8 in the AIFM. A gain above 1 means finite-time divergence.
- At gain 1.7-2.3 the AIFM itself has SAR to SIAR 0.12-0.36 y and SIAR to ASI 0.03-0.12 y. The game's 0.04-0.22 and 0.02-0.07 are what the AIFM does at that gain. The game's gain is set about 2-3x too high, and nothing caps the divergence. Rival labs add to it in some seeds (seed 1).

## 2. Probe summary
Seeds: ai2027 seed 1 (SC 647, ASI 707), seed 9 (SC 697, SIAR=ASI 1252), seed 10 (SC 701, ASI 1348). **Seed 10, not 9, is the slowest ai2027 game (ASI day 1348)**; seed 9 has ASI 1252, as named in the brief. I probed both. Each growth row runs from the first row (SC-117 to SC-120 days) to the ASI row.

| Factor (`col`) | seed 1 start | seed 1 ASI | log10 growth | seed 9 start | seed 9 ASI | log10 growth |
|---|---|---|---|---|---|---|
| model G (`G`) | 29.57 | 35.0 (43.9 at +8 d) | +5.4 | 29.33 | 34.7 (42.2 at +13 d) | +5.4 |
| recipe stack G-equiv (`gStack`) | 1.08 | 7.8 (21.9 at +13 d) | +6.7 OOM | 0.96 | 17.8 | +16.8 OOM |
| research speed `labSpeedRel` (`spd`) | 6.5 | 293 | +1.65 | 7.4 | 3502 | +2.67 |
| **AI taste multiplier** (`Tai`) | 1.04 | 42.8 (14429 at +10 d) | **+1.61** | 1.06 | 33.7 | **+1.50** |
| AI taste, SD above median (`sdAI`) | 0.0 | 10.1 (25.3 at +10 d) | | 0.19 | 9.4 | |
| experiment CES output X (`xX`) | 5.3 | 17.5 | +0.52 | 5.2 | 72.9 | +1.15 |
| AI labour multiplier, experiments (`mExp`) | 9.2 | 810 | +1.94 | 7.7 | 13930 | +3.26 |
| AI labour multiplier, ideas (`mIdeas`) | 2.1 | 634 | +2.47 | 2.2 | 11840 | +3.73 |
| coverage `a` (`eCov`) | 0.70 | 1.00 | | 0.66 | 1.00 | |
| compute / staff | 6.4e6 / 3080 | 1.1e7 / 3470 | +0.24 / +0.05 | 7.5e6 / 3180 | 5.3e7 / 4530 | +0.85 / +0.15 |

Reading the table:
- `mExp` grows 90 to 1800 times, yet X grows only 3 to 14 times. The 14 in seed 9 is mostly compute (7x). The CES makes labour a poor substitute for compute (ρ = -0.122, `PROD_DEFAULT` `calibration.ts:53`). Regression of log10 X on model G, controlling for compute: **0.02-0.06 per OOM**, with a compute coefficient of 1.0-1.2.
- `Tai` grows 30-40 times (and 14000 times by +10 d in seed 1). Regression of log10 Tai on the ideas fit: **0.289, 0.302, 0.290 per OOM** (seeds 1, 9, 10). Analytic: ln(m2b)/(dBM·ln10) = ln 3.25 / (1.8 × 2.3026) = 0.284.
- `mIdeas` has no CES brake. It enters ideation only through (mIdeas·cap)^λ.
- Per-day G increment (seed 1): recipe stack 0.006/d (day 535), 0.03/d at SC, 0.1-0.2/d at SAR-SIAR (36-70 OOM/yr), 0.9/d (day 710), 1.8/d (day 720).
- Model G moves in steps (seed 1: +1.78 on day 665, +8.2 on day 710). Seed 10 holds G at 35.09 for 240 days while the recipe stack gains +10 OOM, then releases +5.8.
- Not the compute, staff or definition of speed. `spd` divided by the compute ratio gives 1.0 (SC-120), 1.35-1.8 (SC), 2.6-5.7 (SAR), 24-72 (SIAR). The "4-7x the AIFM at 2027" is almost all compute growth (x7 by 2027 is in `spd`; the AIFM reports its multiplier at present-day resources).
- Cross-lab coupling speeds some seeds but does not create the blow-up. With rivals removed and diffusion off (`ISOLATE=1 NODIFF=1`; SC moves later by 50-180 d), SC to ASI took: seed 2 119 d (was 129), seed 3 175 d (118), seed 10 648 d (647), seed 9 742 d (555), **seed 1 1570 d (60)**. Seeds 2 and 3 still go taste 1 -> 5900 in the last 30 days and reach ASI within 4-6 months. In seed 1 the rival labs' public recipe runs ahead of the player's (11 vs 6 OOM at day 700) and the player's build gets `dg` +2.9 in one release (day 710; `runs.ts:933` adds `distillLift`, rule B; I did not confirm the source). Rule A off alone does not slow seed 1 (SC to ASI 101 d) or seed 10 (ASI 1451, was 1348), so the seed-1 effect is rivals' presence or rule B, unresolved. Rivals use the same taste maths (`rivalModel.ts`).

## 3. Loop gain
Chain: model G -> ideas fit -> `sdAI` = 3.09·(fit - med)/dBM (`workfit.ts:123`) -> taste q = exp(ln(m2b)/3.09 · sdAI) (`teamTaste` :183) -> research input per idea (`lineRate` `research.ts:101`, ideation rate `research.ts:1104`) -> line pool M -> stack S = r_l·log10(M/n0) -> next model's G.
Let ε = d log10(input rate)/dG and r_eff = dS/d log10 M. Then dG/dt ∝ 10^((ε - 1/r_eff)·G), so the loop diverges in finite time when **Γ = ε·r_eff > 1**. The AIFM computes the same quantity as `m_over_beta` (`_impl.py:1793-1804`, "m/β > 1 means superexponential growth from taste alone"; m = taste SD per OOM × log10 f, β = 1/r_software).

| Quantity | Game (measured from the probes) | AIFM (150-400 central-config draws) |
|---|---|---|
| ε from taste | 0.29/OOM (analytic 0.284) | m = 0.265 median (p10 0.083, p90 1.05) |
| r_eff | 4.1 (pretraining lines 1.02 × r=4, `tree.ts:142-145`); regression gStack vs log10 ΣM gives 5.0-6.5 (RL lines and public base included) | r_software 3.3 median (1.1-8.9) |
| Γ, taste only | **1.14-1.2** | **0.80 median** (p10 0.22, p90 3.2); 43% of draws above 1 |
| ε, whole input rate | 0.26 (seed 1, short window), 0.46 (seed 9), 0.41 (seed 10); the rest comes from ideation (log10 mIdeas rises 0.23-0.74 per OOM; CES-free) and X (0.02-0.06) | n/a (the AIFM labour term is CES-bounded) |
| **Γ, all channels** | **1.7-2.3** | |

Predicted blow-up time at SAR: rate 0.1 OOM/day, exponent ln10·(0.41 - 0.244) = 0.38 per OOM, so t* = 1/(0.38 × 0.1) = 26 d. Seed 1 took 43 d from SAR to ASI.

AIFM gaps by m/β (SAR-to-SIAR / SIAR-to-ASI medians, years; 358 draws): 0-0.5: 8.0 / 4.7; 0.5-1: 1.5 / 2.0; 1-1.5: 0.64 / 0.71; 1.5-3: 0.36 / 0.12; above 3: 0.16 / 0.03. The game's 0.04-0.22 / 0.02-0.07 matches the top bins. AIFM central: SAR to SIAR 1.32 y, SIAR to ASI 0.91 y (`s1compare.json`).

Counterfactuals on seed 1 (probe overrides of `cap.V3_CAL.ai2027.{r,dBM}`, no code change), SC to ASI in days:

| Variant | Taste Γ (0.29 scaled by dBM, × r) | SC to ASI |
|---|---|---|
| baseline r 4, dBM 1.8 | 1.14 | 60 |
| r 2.4 | 0.68 | 103 |
| dBM 3.0 | 0.68 | 278 |
| dBM 4.5 | 0.46 | 548 |
| r 2.4, dBM 3.0 | 0.41 | 446 |
| r 2.0, dBM 4.5 | 0.23 | 1595 (4.4 y) |

Run time is monotone in Γ. The game needs a taste Γ of about 0.2-0.4 to reach AIFM-central gaps (1.3 y, 0.9 y). That is lower than the AIFM's 0.8 because the game also has the CES-free ideation channel.

## 4. Brake comparison
| AIFM brake (file:line) | Game equivalent (file:line) | Status | Values |
|---|---|---|---|
| Experiment-compute bottleneck: CES of compute^ece and coding labour, ρ<0 (`progress_rate.py:27,108`; ρ from asymptotes, `ces_functions.py:351`) | `Xces` `ces.ts:48`; `PROD_DEFAULT` `calibration.ts:53` | **Present, works** for experiments | game ρ -0.122 (La 100, Ca 1000, ζ 0.67); AIFM La 14 (p10-p90 2-165), Ca 1303, ρ about -0.155. Measured ε_X 0.02-0.06. La is 7x the AIFM median (weaker) |
| Same bottleneck applied to all research effort | Ideation `ideasFull` `research.ts:1104`: (mIdeas·cap)^λ × taste, no compute term | **Absent for ideas** | mIdeas reaches 600-12000. AIFM applies the CES to everything |
| Diminishing returns to software, SE = r·log10(RS/RS0) (`progress_rate.py:183,446`) | `lineRate` `research.ts:101`, `poolAfter` :103, `linePoolAt` :92 | **Present** | r 4 (`V3_CAL.ai2027`) vs AIFM 3.3 median. Pre lines total 1.02 r |
| Parallelisation penalty λ on labour (`ces_functions.py:157`, config `parallel_penalty` 0.5, `config.py:335`) | `researchInputs` `research.ts:689` (`l = mExp^λ`); ideation :1104 | **Present** | λ 0.5 vs AIFM 0.51 median (0.21-0.73) |
| Taste ceiling A = m2b^(1+taste_limit) (`taste_distribution.py:94,133`; limit 16 default, sampled median 7, p10 1.5, p90 44) | `teamTaste` `workfit.ts:183`, `sdAIOf` :123: lognormal, unbounded. `ideaTaste` `research.ts:108` caps at 1.5, but only for one-off idea means, not for lines or ideation | **Absent** | game Tai reaches 1.4e4 (seed 1). AIFM median A = 3.25^8 = 1.2e4 for the game's m2b; p10 would bind at 19 |
| Taste slope per OOM, SD ≈ 1.45 (p10 0.52, p90 5.2) (`config.py:93`) | 3.09/dBM = 1.72 SD per OOM of G | Present, a little steep | m 0.265 vs 0.29 |
| Taste enters as multiplier on CES output (`progress_rate.py:122`) | Enters as research input per idea (`lineRate` q) and as ideas per day | Present, similar; the unbounded part is the issue above | |
| Automation fraction saturates at 1 (`progress_rate.py:379`; logistic asymptote 1.1 clipped) | `coverage` `workfit.ts:86` -> 1 | Present | eCov 0.999 at SIAR |
| Cap on serial coding-labour multiplier (`max_serial_coding_labor_multiplier`, `config.py`) | none; mExp up to 1.6e4 | Absent; harmless for X, not for ideas | |
| Horizon with difficulty growth (0.92; doubling time lengthens) | `h50Of` pure exponential 4.2x/OOM (`workTypes.ts:145`) | Absent; coverage saturates anyway | h50 reaches 1e12 min |
| Progress = log of cumulative effective compute (`progress_rate.py:448`: d logE/dt = 10^(EC-logE)/ln10); taste and automation read this lagging stock | Taste reads the model's G, a level that steps at releases (`gOfBuild` `capability.ts:161`) | Different; the AIFM stock lags a spike, the game jumps | seed 1: +1.78 OOM in one release |
| Time to train new models to use software gains (the Q2.5 update) | Base every 9 months (`ref.ts:99`, `rivals.ts:58`); post-training 6-10 weeks | **Present in the game; not in the downloaded AIFM** (only a display metric `optimal_training_run_length`, `metrics_computation.py:573`) | The lag stores recipe and releases it in lumps (seed 10: 240 d flat, then +5.8). It delays but does not brake |
| Exogenous compute and labour paths | `FORCING` | Same | compute x11 by SC |

## 5. Ranked causes
1. **Loop gain above 1, set at the AIFM's 85-90th percentile (Γ 1.7-2.3 vs median 0.8).** Evidence: §3 regression (ε 0.29 taste, 0.41-0.46 all channels, r_eff 4-6); the AIFM gap table; the counterfactuals (60 d to 1595 d as Γ falls). Two contributors:
   - taste Γ 1.2 vs 0.8 (r 4 and dBM 1.8 both a little hot);
   - the **ideation channel with no compute bottleneck** (`research.ts:1104`: mIdeas^0.5 × taste), worth roughly +0.12-0.17 ε.
2. **No taste ceiling, so the divergence never stops.** Evidence: Tai 14429 and sdAI 25 within 10 days of ASI in seed 1; G then non-finite. With Γ > 1 and nothing to cap it the solution reaches infinity in finite time. The AIFM's A is lognormal-bounded and the loop saturates. This is why G goes to infinity rather than only fast.
3. **Model G steps and the model-reads-itself timing.** Evidence: seed 1 G +1.78 (day 665) lifts sdAI 1.2 -> 4.4 and mIdeas x24 in one release; seed 9's SIAR and ASI are crossed by one +8 release. In the AIFM taste follows a continuous stock. This turns a smooth loop into a few big jumps and compresses SAR/SIAR/ASI to days.
4. Smaller: La 100 vs AIFM 14 (a weak X brake, but ε_X is only 0.05); linear-in-G horizon; the Q2.5 lag stores gains (not a cause of speed).

Smaller, seed-dependent: **rival labs (probably distillation, rule B) accelerate seed 1** from 1570 d to 60 d. Rivals run the same unbounded taste maths, so items 1-3 below fix them too.

Ruled out: the CES/labour channel (X ε 0.05), compute or staff growth (game speed per unit compute is close to the AIFM at SC: 1.0-1.8x), the "4-7x" speed difference (definition).

## 6. Proposed mechanism changes (for the designer; not implemented)
1. **Route idea throughput through the experiment bottleneck.** Cap or CES-limit `mIdeas` and the (mIdeas·cap)^λ ideation rate by experiment compute (same ρ and La as X), as the AIFM does for all research effort. Removes the 0.12-0.17 ε.
2. **Add a taste ceiling** A = m2b^(1+limit), limit sampled from the AIFM (median 7, p10-p90 1.5-44), applied in `teamTaste` / `sdAIOf`. Bounds q and ends the infinity.
3. **Re-anchor Γ:** choose (r, dBM, m2b) so the game's taste Γ = ε·r has the AIFM distribution (median 0.8, p10 0.22, p90 3.2). For r = 4 that is dBM about 2.6-3 (ε 0.17-0.2); and sample Γ per game instead of fixing r = 4, dBM = 1.8. The counterfactual table says the game needs about 0.2-0.4 to reproduce AIFM-central gaps once item 1 is not done, about 0.8 once it is.
4. **Smooth what the research reads:** give the lab a continuous recipe-level G for taste and coverage (a cumulative effective-compute stock with lag, as `progress_rate.py:448`), or cap the OOM a model release can add. Stops +1.8/+8 OOM steps.
5. Optional: AIFM-sampled La (median 14), difficulty-growth in `h50Of`.

Probe limits: three seeds probed in full (1, 9, 10), plus seeds 2, 3 for isolation; per-line n0 used 52-80 (from `linePoolAt`); r_eff from regression includes public-recipe base growth. The AIFM numbers are from `out/full_central` rollouts (first 150-400 draws), not a re-run.
