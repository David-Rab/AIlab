# fixC screen: override sets

Screen run `fixC-screen` (balance/scans/fixC-screen.json): 18 sets plus base, worlds ai2027 and authors2026, medium alignment, leader start, forced aifm, policy refwide, seeds 2027,1,2,3. Each set moves one parameter in both presets together (registry ids for ai2027 / authors2026 separately where the param is per preset). dn/up = the lower/higher value (for dBM and m2b, lower or higher means faster or slower takeoff respectively; see the effects file).

| set | param (registry id: ai2027 / authors2026) | base -> new | source |
|---|---|---|---|
| r-dn | V3_CAL.ai2027.r, V3_CAL.authors2026.r | 4 -> 2.307 ; 3.19 -> 1.84 | AIFM r_software draws (S1-TAKEOFF-DIAG s3: median 3.3, p10-p90 1.1-8.9), lognormal p25/p75 vs the median: x0.577 / x1.734 |
| r-up | V3_CAL.ai2027.r, V3_CAL.authors2026.r | 4 -> 6.934 ; 3.19 -> 5.53 | AIFM r_software draws (S1-TAKEOFF-DIAG s3: median 3.3, p10-p90 1.1-8.9), lognormal p25/p75 vs the median: x0.577 / x1.734 |
| dBM-dn | V3_CAL.ai2027.dBM, V3_CAL.authors2026.dBM | 1.8 -> 1.032 ; 2.17 -> 1.245 | Eli taste slope lognormal ci80 [0.8,6.6125] (q2_eli.yaml:110): slope p75/p25 gives dBM x0.574 / x1.743 |
| dBM-up | V3_CAL.ai2027.dBM, V3_CAL.authors2026.dBM | 1.8 -> 3.138 ; 2.17 -> 3.783 | Eli taste slope lognormal ci80 [0.8,6.6125] (q2_eli.yaml:110): slope p75/p25 gives dBM x0.574 / x1.743 |
| gSC-dn | V3_CAL.ai2027.gSC, V3_CAL.authors2026.gSC | 30.15 -> 29.15 ; 34.09 -> 33.09 | no AIFM range (derived from the AC date); +-1 OOM chosen (measured: SC moves -0.4 / +0.2 y (ai2027), -0.6 / +0.6 y (authors2026)) |
| gSC-up | V3_CAL.ai2027.gSC, V3_CAL.authors2026.gSC | 30.15 -> 31.15 ; 34.09 -> 35.09 | no AIFM range (derived from the AC date); +-1 OOM chosen (measured: SC moves -0.4 / +0.2 y (ai2027), -0.6 / +0.6 y (authors2026)) |
| sdSC-dn | V3_CAL.ai2027.sdSC, V3_CAL.authors2026.sdSC | 0.5 -> -1.079 ; 2.94 -> 1.361 | AIFM ai_research_taste_at_coding_automation_anchor_sd normal ci80 [-2.5,3.5] (sampling_config.yaml:175): p25/p75 = median -/+ 1.579 SD |
| sdSC-up | V3_CAL.ai2027.sdSC, V3_CAL.authors2026.sdSC | 0.5 -> 2.079 ; 2.94 -> 4.519 | AIFM ai_research_taste_at_coding_automation_anchor_sd normal ci80 [-2.5,3.5] (sampling_config.yaml:175): p25/p75 = median -/+ 1.579 SD |
| tasteLimit-dn | V3_CAL.ai2027.tasteLimit, V3_CAL.authors2026.tasteLimit | 8 -> 3.857 ; 8 -> 3.857 | AIFM taste_limit lognormal ci80 [2,32] (sampling_config.yaml:191): p25/p75 = 3.86 / 16.59 |
| tasteLimit-up | V3_CAL.ai2027.tasteLimit, V3_CAL.authors2026.tasteLimit | 8 -> 16.594 ; 8 -> 16.594 | AIFM taste_limit lognormal ci80 [2,32] (sampling_config.yaml:191): p25/p75 = 3.86 / 16.59 |
| m2b-dn | PROD_DEFAULT.m2b, PROD_PRESETS.authors2026.m2b | 3.25 -> 2.122 ; 3.7 -> 2.347 | Eli median_to_top_taste_multiplier shifted lognormal ci80 [0.8,11.25] shift 1 (q2_eli.yaml:117): (m2b-1) x0.499 / x2.005 |
| m2b-up | PROD_DEFAULT.m2b, PROD_PRESETS.authors2026.m2b | 3.25 -> 5.511 ; 3.7 -> 6.414 | Eli median_to_top_taste_multiplier shifted lognormal ci80 [0.8,11.25] shift 1 (q2_eli.yaml:117): (m2b-1) x0.499 / x2.005 |
| lam-dn | PROD_DEFAULT.lam | 0.5 -> 0.359 | AIFM parallel_penalty Beta(3,3) (sampling_config.yaml:88): p25/p75 = 0.359 / 0.641 |
| lam-up | PROD_DEFAULT.lam | 0.5 -> 0.641 | AIFM parallel_penalty Beta(3,3) (sampling_config.yaml:88): p25/p75 = 0.359 / 0.641 |
| rc-dn | PROD_DEFAULT.rc | -2 -> -5 | AIFM rho_coding_labor choice {-5,-2,-1} p {.25,.5,.25}: the two end values |
| rc-up | PROD_DEFAULT.rc | -2 -> -1 | AIFM rho_coding_labor choice {-5,-2,-1} p {.25,.5,.25}: the two end values |
| La-dn | PROD_DEFAULT.La, PROD_PRESETS.authors2026.La | 100 -> 24.8 ; 15 -> 3.72 | AIFM inf_labor_asymptote shifted lognormal ci80 [1,200] (sampling_config.yaml:76): (La-1) p25/p75 = x0.248 / x4.03 (applied to La) |
| La-up | PROD_DEFAULT.La, PROD_PRESETS.authors2026.La | 100 -> 403.2 ; 15 -> 60.48 | AIFM inf_labor_asymptote shifted lognormal ci80 [1,200] (sampling_config.yaml:76): (La-1) p25/p75 = x0.248 / x4.03 (applied to La) |

Combo run `fixC-combo` (balance/scans/fixC-combo.json), same cells: combo2-p25 = dBM x1.743 + r x0.577; combo3-p25 adds m2b (m2b-1) x0.499; combo4-p25 adds tasteLimit 3.857; combo4-p10 = dBM x2.875 (slope p10 0.8), r x0.333 (1.1/3.3), (m2b-1) x0.267, tasteLimit 2.0 (all at the AIFM p10 of the slow-takeoff side).
