# 11 — Engine audit against the AI 2027 / AI Futures Model primary sources

Audit date: 2026-11-11. Scope: `src/data/world.ts`, `src/engine/sim.ts`, `src/engine/init.ts`, `src/engine/types.ts`, `scripts/simtest.ts`. Nothing under `src/` was edited.

**Method**
- I read the authors' code directly from fresh clones in a temp directory. The clones are `uvafan/timelines-takeoff-ai-2027` at commit `2085376a` (2025-12-10) and `AI-Futures-Project/aifm-public` at commit `1c40ecdb` (2026-09-09).
- I ported their timelines and takeoff simulations line-for-line to Node and ran them. The port reproduces their published numbers. For the buggy formula, Eli's time-horizon Monte Carlo gives p10 2025.83 / p50 2027.61 / p90 2039.91; the page states "2027 (2025 to 2039)". The patched formula gives a p50 of 2028.37, which matches the stated "about a 9 month impact". The takeoff Monte Carlo gives SC→SAR p50 0.34 y and p90 0.95 y; the page states 0.3 y and 0.95 y.
- I ran our engine headless with scratch scripts in `/tmp`, at the reference compute path and with the `simtest` race bot.
- I read the AI 2027 web supplements through a fetch tool that summarizes the page; I asked it for verbatim quotes. These are tagged **[W]**. Code and data files I read raw are tagged **[C]**. My own arithmetic and fits are tagged **[D]**.

---

## 1. Summary verdict

The engine's core equations are faithful to the AI 2027 time-horizon and takeoff code:
- the lognormal fitted to an 80% CI;
- doubling work for exponential, superexponential and subexponential growth;
- the patched multiplier interpolation `1 + p·(s/p)^f`;
- the 50/50 software/compute blend;
- the zero-inflated SC→SAR gap, `x³/100 − x` and `x2·(x2/x)^E − x2`;
- geometric interpolation of the multiplier between milestones.

For `sampled`, the parameter distributions match Eli's configuration exactly.

The problems are in **calibration and in what the engine leaves out**, not in the core math:

1. **The `ai2027` preset does not reproduce the scenario.** At reference compute, SC arrives in **Nov 2026**, not Mar 2027. SAR, SIAR and ASI each land 3–4 months early. Agent-2 arrives Sep 2026 instead of Jan 2027. The cause is that Stage 1 is too short (base0 = 23.9 when it needs to be ≈ 32.4). The neuralese boost then double-counts a breakthrough the scenario already includes.
2. **The `simtest` harness misreports milestone dates.** The race bot takes the first event choice, which for `redFlags` is a rollback. `rollback()` lowers `model.milestone` but leaves `p` above the threshold, so the milestone is immediately re-crossed and `milestoneDays[i]` is overwritten. For seed 1000, the harness printed `SC:2027-05` although SC was actually reached on 2026-11-17. Any calibration done by reading `simtest` output is suspect.
3. **The `authors2026` preset is off on takeoff and several inputs:**
   - Its ASI is about 3 years later than the AIFM's.
   - It uses decay 0.03 where the AIFM median is d = 0.92, i.e. decay 0.08.
   - It does not anchor to the METR horizon the AIFM uses (186 min at 2026.27); ours gives 106 min there.
   - It uses compute growth 2.0×/yr where the AIFM's own input series grows about 2.5×/yr through 2028.
4. **The `fast` preset is mislabelled and too fast:**
   - It reaches SC in May 2027, about 7 months before Daniel's Aug-2026 AC median (2027.9).
   - Its takeoff takes 16 days, far faster than AI 2027's own 10th percentile of about 0.2 years. Summing per-phase 10th percentiles is not the 10th percentile of the total.
5. **Stage 1 has no compute or labor slowdowns.** The AI 2027 code halves the compute rate and transforms the software rate from 2029. Ours does not, which pulls in the long tail: the `sampled` SC p90 is 2037 versus 2044 for the authors' (patched) code on the same distributions.
6. **Smaller issues:**
   - The copula correlation is 0.49 instead of 0.7.
   - Stage 2 starts at 1+sEx (median 8.75) instead of the takeoff model's fixed 5, so SC→SAR runs about 40% fast.
   - Revenue in late 2027 overshoots AI 2027 by about 5×.
   - China closes on OpenBrain too fast: about 2 months behind in mid-2026 versus the scenario's "about six months".
   - Default play runs below the reference compute path (compute factor 0.7–0.9).
   - The talent factor double-counts labor growth.

Every number marked "fix" below cites its primary source, or is labelled [D] with the fitting method.

---

## 2. Discrepancy table

Impact means effect on gameplay and calibration. H = changes milestone dates by more than 3 months or misleads calibration; M = noticeable; L = cosmetic or edge case.

| # | Our code (file:function, current value/formula) | Their primary source (quote / formula, location) | Impact | Concrete fix |
|---|---|---|---|---|
| 1 | `world.ts:makeWorld` case `ai2027` (l.169): `g0: 20, cs: 3.9, pEx: 0.15, sEx: 4` → base0 = 23.9. At reference compute (cf = 1, human = 1): SC 2026.87, SAR 2027.29, SIAR 2027.54, ASI 2027.63 [D, `/tmp` run of our formulas]. The race bot also hits SC on 2026-11-17. | Scenario [W] (ai-2027.com): Early 2026, "making algorithmic progress 50% faster"; Jan 2027, "Agent-1 could double … Agent-2 can now triple it"; Mar 2027, "'only' 4x"; Jun 2027, "The AI R&D progress multiplier is now 10x"; Sep 2027, "about 50x". Takeoff supplement [W]: "we condition on SC being achieved in March 2027"; scenario dates SAR Aug 2027, SIAR Nov 2027, ASI Dec 2027. | **H** | `pEx: 0.25`, `g0: 28.5` (base0 32.4); keep `T 4.74, super, decay 0.1, cs 3.9, sEx 4, G [4.19,16,49.5]`. Result at reference [D]: M = 1.5× at 2026.07, 2× at 2026.57, 3× at 2026.96, 4× at 2027.14, SC 2027.244 (Mar 31), 10× at 2027.50, SAR/25× at 2027.66 (end Aug), 50× at 2027.80, SIAR 2027.92 (end Nov), ASI 2028.00 (Dec 31). Under the race bot's observed compute/talent path, SC ≈ 2027.28 [D]. |
| 2 | `world.ts` l.33–34: `F_A1 = 0.35`, `F_A2 = 0.8` (fraction of Stage 1 at which Agent-1/Agent-2 appear). With the current preset: A1 at M 1.47 (Feb 2026), A2 at M ≈ 3.1 but in **Sep 2026**. | Same scenario quotes: Agent-1 ↔ 1.5× (early 2026); Agent-2 ↔ 3× (Jan 2027). The scenario says Agent-1 finishes training in "Late 2025" and is released "Early 2026". | M | With fix #1: `F_A1 = 0.25`, `F_A2 = 0.75`. These are exactly the fractions where M = 1.5 and 3 when pEx = 0.25, sEx = 4. A more robust option is to define them per world by multiplier level: `fA1 = clamp(ln(0.5/pEx)/ln(sEx/pEx), 0.15, 0.5)`, `fA2 = clamp(ln(2/pEx)/ln(sEx/pEx), fA1+0.2, 0.9)`. |
| 3 | `events.ts:rollback` (l.235–247): `s.p -= s.p*0.08; s.model.milestone -= 1`. `sim.ts:checkMilestone` (l.174–186) then re-raises the milestone on the next tick and overwrites `milestoneDays[i]`. `simtest.ts` l.41 prints those overwritten days; its race bot picks choice 0 (= rollback) on `redFlags`. | n/a (engine bug). Seed 1000 under `ai2027`: true first crossings are A1 2026-02-14, A2 2026-09-24, SC 2026-11-17, SAR 2027-06-11, SIAR 2027-10-16, ASI 2027-11-24 [D, instrumented run]. `simtest` printed SC 2027-05. | **H** (calibration) | (a) In `checkMilestone`, only set `milestoneDays[i]` if it is undefined, so it records first crossings. (b) In `rollback`, set `s.p = Math.min(s.p*0.92, milestoneThresholds(w)[s.model.milestone] - 1e-6)` before decrementing, so the rollback actually loses the milestone. (c) In `simtest`, make "race" pick the racing option on `redFlags` (index 2), which is the AI 2027 race-ending choice. |
| 4 | `sim.ts:progressBreakdown` l.84: Stage 1 `rate = share*M*human + (1-share)*computeFactor`, with no time-dependent slowdown. A player tracking `refCapCompute` keeps cf = 1 forever. | `timelines/simple_params.yaml` l.6–7: `compute_decrease_date: 2029.0`, `human_alg_progress_decrease_date: 2029.0`. `simple_forecasting_timelines.py` l.273–275: `return 0.5 if t >= compute_decrease_date else 1.0`; l.315–319: `if time >= human_alg_progress_decrease_date: only_multiplier = v*0.5; only_additive = v-0.5; v = sqrt(only_multiplier*only_additive)`. Page [W]: "the rate of compute scaling is slowed by 2x beginning in 2029". The same rule is in B&G (`forecasting_timelines.py` l.162–165, 238–241). The May-2025 variant uses a schedule instead: `compute_schedule: [[2028,0.9],[2029,0.5],[2030,0.4],[2031,0.3]]`. | **M–H** (sampled tail, `slow`, `authors2026`) | In Stage 1 only: `const yr = decimalYear(s); const C = (yr >= 2029 ? 0.5 : 1) * computeFactor; let Ms = mult*human; if (yr >= 2029) Ms = Math.sqrt(0.5*Ms*(Ms-0.5)); rate = share*Ms + (1-share)*C;` Apply the same to `actorRate`. With this, `sampled` SC p90 moves from about 2037 to about 2044 (their patched code: p10 2026.05 / p50 2028.37 / p90 2044.14 [D, port]). Our current p10 2026.28 / p50 2028.34 / p90 2037.21 [D]. |
| 5 | `world.ts` l.189–193: one-factor copula `corr = 0.7*zc + sqrt(0.51)*n` for (T, cs, growth-type). That gives pairwise ρ = 0.49. | `simple_forecasting_timelines.py` l.35–43: `n_vars = 4`; `corr_matrix = np.full((n_vars,n_vars), correlation)` with `correlation = 0.7` (l.30), i.e. pairwise 0.7. | M | `const a = Math.sqrt(0.7), b = Math.sqrt(0.3); const corr = () => a*zc + b*rng.normal();`. The (pEx, sEx) pair at l.195–196 is already correct (ρ = 0.7). |
| 6 | `world.ts:speeds` l.54–57: Stage 2 starts at `1 + sEx` (sampled median 8.75, up to 41), and `SAR = max(1.5*sc, 25)`. Our sampled SC→SAR calendar p50 is 0.20 y, p90 0.88 y [D]. | `takeoff/params.yaml` l.23–27: `SC: 5, SAR: 25, SIAR: 250, ASI: 2000`, fixed and independent of the timelines draw. `forecasting_takeoff.py` l.150–182: `current_speedup = start_speed*(end_speed/start_speed)**progress_ratio`. Their code gives SC→SAR p50 0.34 y, p90 0.95 y [D, port]. There is no "1.5×SC" rule anywhere. | M | Keep the 1+sEx start for continuity, but stretch G1 so the calendar time matches a 5→25 phase: `G1eff = G1 * (25*s0*Math.log(25/s0)/(25-s0)) / (25*5*Math.log(5)/20)` for s0 < 25, with s0 = 1+sEx (×1.405 at the median). If s0 ≥ 25, use `SAR = s0` and `G1eff = G1*s0/(25*5*ln5/20)` (flat phase). Drop the `1.5*sc` rule. The simpler alternative is `speeds = [5,25,250,2000]` in Stage 2 for `sampled`, accepting a display discontinuity. |
| 7 | `world.ts` l.210: `G3 = min(20000, …)` human-years, which caps SIAR→ASI at about 33.7 calendar years. | `forecasting_takeoff.py` l.167: `MAX_CALENDAR_DAYS = 365 * 1000`, a cap on calendar time, not on human-years. Their SIAR→ASI p90 is therefore 1000 y; page [W]: "0.16 years (80% CI 0.01 to >100)". | L | Cosmetic within a 6-year game. Either keep the cap (document it as a game cap) or raise it to 1.2e6, the human-years equivalent of 1000 calendar years at 250→2000. |
| 8 | `world.ts` case `authors2026` (l.173): `T 4.5, decay 0.03, hSC 125 work-years, cs 0, share 0.6, pEx 0.1, sEx 2, G [1.2,115,2970], computeGrowth 2.0`; h0 = 22/38 at Jul 2025. Result at reference: SC 2029.71, SAR 2029.88, SIAR 2031.68, **ASI 2036.69**; horizon at 2026.27 = 106 min [D]. | AIFM `config/sampling_config.yaml` l.23–27: `ac_time_horizon_minutes ci80 [12000, 1.875e10]` (median 1.5e7 min = 125 work-years); l.50–61: `present_doubling_time ci80 [0.1833, 0.7667]` (median 4.5 mo); `doubling_difficulty_growth_factor: normal ci80 [0.82, 1.02]` (median **0.92**). `sampling_config_q2_eli.yaml` l.53–59: `horizon_reference_date 2026.269178`, `present_horizon 186.0`; l.40–43: anchor weights uplift 0.6 / horizon 0.2 / revenue 0.2. Results (`app/forecast/data/simulations/eli-08-16-26/milestone_pdfs_overlay_statistics.csv`): **AC p50 2029.1644**, AI2027-SC 2030.3430, SAR 2030.8272, SIAR 2033.6383, TED-AI 2033.4787, ASI 2036.8726. `ac_unconditional_time_until_statistics.csv`: AC→SC p50 0.4826, AC→SAR 0.7310, AC→SIAR 2.3082. Blog Q2.5 [W]: "Eli's model-based AC: p50 Mar 2029"; "Eli's [median AC-to-ASI gap] is 4.56 years". ATC (`atc_cdf.csv`): AC p50 2030.08, TED-AI 2032.49, ASI 2033.57. | **H** (preset) | `h0: 38` (fixed, not baseline-dependent; anchoring to 186 min at 2026.27 back-solves 36.5 min), `decay: 0.08`, `cs: 22` [D fit: stands in for the uplift anchor (60% weight) and the 30%-probability gap, which the lite engine lacks], `G: [1.52, 101, 1340]` [D, targets SC = AC + 0.52, SAR = AC + 0.73, SIAR = AC + 2.31, ASI = AC + 4.56]. Result [D]: SC 2029.68, SAR 2029.89, SIAR 2031.48, ASI 2033.73; horizon at 2026.27 = 186 min. `computeGrowth: 2.5` (see #18). Rewrite the description as "AIFM Aug 2026, Eli's model median (AC Mar 2029, ASI ≈ 2033.7)". |
| 9 | `world.ts` case `fast` (l.177): `T 4.0, decay 0.08, hSC 1 work-year, cs 0, pEx .15, sEx 3, G [0, 2.31, 0.8]`. Description says "Kokotajlo Aug 2026 timelines". Result: SC **2027.34**, ASI 2027.38 (SC→ASI = 16 days) [D]. | `sampling_config_q2_daniel.yaml`: `present_doubling_time ci80 [0.2117,0.5233]` (4.0 mo); `ac_time_horizon_minutes ci80 [6000, 2400000]` (median 120,000 min = 1 work-year). `sampling_config_daniel.yaml`: `include_gap: fixed "no gap"`. `daniel-08-16-26/milestone_pdfs_overlay_statistics.csv`: **AC p50 2027.9218**, AI2027-SC 2028.8479, SAR 2028.9254, ASI 2030.6335. ATC `atc_cdf.csv`: AC p50 2027.91, ASI 2029.24. Takeoff 10th percentile: G = [0, 2.31, 0.8] is A = 1 (p10 of [1,25]) and E = 0.3 (p10 of [0.3,7.5]) combined. The p10 of the *total* SC→ASI in their code is 0.200 y [D, port of `forecasting_takeoff.py`]. Page [W]: ASI 80% CI from "Jun 2027" (≈ 0.2 y after SC). | M–H (preset) | Anchor h0 to 186 min at 2026.27 (≈ 26 min at Jul 2025). `cs: 10.3` [D] gives SC 2027.91 (= Daniel's AC median); use `cs: 19.7` to target his model SC 2028.44 (AC + 0.52) instead. `G: [0, 7.67, 47.5]` gives SC→SAR 0, SAR→SIAR 0.12 y, SIAR→ASI 0.08 y; total 0.21 y ≈ AI 2027 p10 [D]. Relabel as "Daniel Aug-2026 timelines + AI 2027 10th-percentile takeoff". |
| 10 | `world.ts` l.170/178: `neuraleseBoost 1.3` (ai2027) / `1.4` (fast), applied as an extra multiplier once the player adopts neuralese (event fires at 0.9·Stage 1). The race bot adopts it, so its Stage 2 rate is ×1.3. | Scenario Mar 2027 [W]: the SC model Agent-3 is defined as "incorporating these breakthroughs" (neuralese recurrence + IDA), and its multiplier is "'only' 4x". The 5×/25× takeoff multipliers already include it. No primary source gives a separate neuralese speedup. | M | Calibrate the canonical path (adopt) to the scenario: `neuralese = adopted ? 1 : 1/boost` (refusing costs speed) instead of `adopted ? boost : 1`. Otherwise the `ai2027` preset runs about 30% fast after Agent-2. Label 1.3/1.4 as [D] design values. |
| 11 | `world.ts:refCapCompute` l.293–298: `0.744M * (2.25*1.4)^t` (3.15×/yr) to 2028, then 1.5×/yr. `init.ts` l.86–110: expansion 2 (3×/yr) with 6-month order lag. Race bot: cf = 1.00 (Aug 2025) → 0.80 (Sep 2026) → 0.70 (May 2027) [D trace]. | Compute forecast [W]: "The compound effect is a 3.4x/year increase in compute for the leading AI company." Average compute used: 1M (2025), 4M (2026), 7M/9M/12M/15M (Q1–Q4 2027). R&D share = training + internal = 68% (2025), 70% (2026), 77/78/79/83% (2027). That gives R&D compute ≈ 0.68M (2025.5), 2.8M (2026.5), 5.4/7.0/9.5/12.5M (2027 quarters) [D]. Ours: 0.74M, 2.34M, 4.75/6.0/7.6/9.6M. | M | (a) Set the reference to the AI 2027 path: `ref(t) = 0.68e6 * 3.4^t` up to 2028.0 (or interpolate the table above), then the post-2028 growth from #18. (b) Make default play track it: default `expansion: 2.4` (3.4×/yr) and an initial pipeline sized so compute reaches about 2.2M by Dec 2025. Calibrate presets at cf = 1 *and* check the race bot gives cf ≈ 1 (±10%). |
| 12 | `sim.ts:progressBreakdown` l.77: `talentFactor = ((staff*capSplit)/2050)^0.25`. With default hiring (+60/month) this rises to 1.10 by 2027 and multiplies M. | `simple_forecasting_timelines.py`: progress is measured in "months … at the 2024 rate" (page [W]: "Estimate the number of months needed to cross that gap at the 2024 rate of AI progress"). Human-labor growth is part of that baseline; the code adds nothing for it before 2029. | M | Normalise to a reference staff path: `talentFactor = ((staff*capSplit)/refStaff(t))^0.25` with `refStaff(t) = 2050 + 0.82*60*months`, so default play gives 1.0. |
| 13 | `sim.ts` l.76 and l.93: `computeFactor = (capCompute/ref)^ε` is a *level* ratio applied to a *rate*, so a 2× compute lead is a permanent +19% (Stage 1) or +41% (Stage 2) rate advantage. | AI 2027 code: the compute term is a progress rate relative to the 2024 *growth pace* (`compute_rate` = 1.0 / 0.5). In that framing a compute-level difference is a fixed effective-compute lead, not a rate difference. The AIFM uses `log10(training_H100e)` integrated as cumulative effective compute (`docs/input-series-provenance.md`). | M (design) | Optional, for faithfulness: `C = (1-share) * clamp(dln(capCompute)/dt ÷ ln(refGrowth(t)), 0, 2)` (smoothed over about 90 days), plus a one-off offset `p += (1-share)*log(cap/ref)/log(refGrowth)/12` when a lab's share jumps (theft, DPA). Otherwise document that this is intentional and that it makes rival/China gaps widen continuously. |
| 14 | `sim.ts:revenuePerH100eYear` l.190–193: `32000 * M_public^0.45` × product compute. Race bot revenue run-rate: $14B (Dec 2025), $44B (Nov 2026), $179B (Jul 2027), **$853B (Nov 2027)**; `simtest` end values $1.1–1.3T [D]. | Compute forecast §5 [W]: annual revenue $14B (2025), $45B (2026), $140B (2027). Scenario Key Metrics 2026 [W]: "OPENBRAIN REVENUE $35B (2026 ANNUAL)". External deployment share 30% (2025), 28% (2026), 20→13% (2027). Implied revenue per external H100e-year ≈ $47k (2025), $40k (2026), $75k (2027) [D]. | M | `40000 * Math.pow(Math.min(m, 8), 0.3)` gives $41.7k at M 1.15, $47.6k at 1.8, $55.7k at 3, and caps at $74.5k. With the 0.32 default product share, 2027 revenue comes out about $190B (in range of their $140–150B). Optionally have the scripted race path lower product compute toward 13% in late 2027, as in their table. |
| 15 | `sim.ts` l.247–249: valuation = `50*(rev/12)^-0.2` × hype. Comment: "AI27 dashboard: ~50x revenue at $12B …". `BASELINES` valuation 610 / 300. | Scenario page [W]: "The page gives no OpenBrain valuation or market cap." Only "The stock market has gone up 30% in 2026". The compute forecast has no valuation. | L | Remove the "AI27 dashboard" attribution; mark it as [D] design. No primary AI 2027 number exists. |
| 16 | `sim.ts:security` l.482–486 (`leak = 0.0006*spies*clamp(3.5-ssl,0,2)` of the gap per day), `chinaTick` l.526 (`chinaAI = world*share*(0.3+0.6*cent/100)*0.6`), `BASELINES.classic.chinaGapYears 0.45`. Race run: China lead 125 d (Jul 2025) → **65–75 d (mid-2026)** → 14–41 d after theft [D]. | Scenario [W]: Mid 2026, "they are about six months behind the best OpenBrain models"; Aug 2027, "They are two months behind"; Sep 2027, "DeepCent is just two months behind". Compute forecast [W]: "China's total compute share stays at around 13%, but now they dedicate 90% to AGI development as opposed to 40%"; scenario Mid 2026: "Almost 50% of China's AI-relevant compute" in the DeepCent collective; Feb 2027 "40% … in the CDZ". Security forecast [W]: "China is about six months behind the US until early 2027." | M | (a) `chinaGapYears: 0.6` (≈ 180 lead-days at start). (b) China AGI fraction `0.4 + 0.5*min(1, cent/75)` (40% → 90%), keeping the ×0.6 R&D share. (c) Secrets leak coefficient 0.0006 → about 0.00015 [D], to be tuned so the lead stays at 150–200 d until the theft and about 60 d after it. (d) After a theft, set `china.p = max(china.p, s.p - 60-days-of-progress)` instead of `s.p - 0.02`. |
| 17 | `sim.ts:securityTarget` l.454–461: base `2.2` plus allocation terms. Default allocation gives 2.26, so with no research the level drifts *down* from the start value 2.4. | Security forecast [W], OpenBrain WSL (continuous): Dec 2024 2.2, Dec 2025 2.7, Dec 2026 3.3, Apr 2027 3.8, Aug 2027 4.3, Dec 2027 5. SSL: 1.5, 2.0, 2.4, 3.3, 3.9, 5.0. "The US is not expected to make significant security changes [through 2026]" while WSL still rises 2.2 → 3.3. | L–M | Status-quo base: `lvl = 2.2 + 0.55*min(yearsSince2025.0, 2)`, reaching about 3.3 by end-2026; techs and allocation add on top. Start values (2.4 at Jul 2025) and the SSL offset (`ssl = wsl − 0.6`; their gaps are 0.7/0.7/0.9/0.5/0.4/0) are fine. |
| 18 | `world.ts:globalCompute` l.286–290: `start*growth^min(t,2.5) * min(growth,1.7)^(t-2.5)`. `authors2026` uses growth 2.0. | AI 2027 compute forecast [W]: 10M H100e "today" (Mar 2025) → 18M (2025) → 40M (2026) → 100M (end 2027), "2.25x per year". After 2027 it gives no figure; the timelines code halves the compute-progress rate from 2029 (≈ √2.25 = 1.5×/yr [D]). AIFM `inputs/input_data.csv` `world_H100e`: 8.6M (2025.0), 22.4M (2026), 57.1M (2027), 135M (2028), 289M (2029), 537M (2030), 913M (2031), 1.51B (2032). Leading company `total_ai_company_H100e`: 0.516M, 1.79M, 6.85M, 21.6M, 57.8M, 107M, 183M. | L–M | AI 2027 family (`ai2027`, `sampled`, `slow`): 2.25× to 2029.0, then 1.5×. AIFM family (`authors2026`, `fast`): interpolate log-linearly in the AIFM `world_H100e` column (≈ 2.5× to 2028, then 2.14, 1.86, 1.70, 1.65). Ours (13M at 2025.5 → 98.7M at 2028.0) already matches AI 2027 within 10% pre-2028. |
| 19 | `world.ts` l.211–217 (sampled): progress before game start is removed from g0, but the multiplier fraction `f` restarts at 0; if `pre > g0` the remainder is not taken from `cs`; `reality` raises h0 to 38 without shortening g0. | Code starts at `current_year = 2025.25` with `time = current_year - announcement_delay/12` (l.291, 300) and integrates from progress 0. | L | Store `p0 = pre/12` and start `s.p = p0` (Stage 1 unchanged, `f` continuous) instead of shrinking g0. If keeping the shift, subtract the overflow from cs. Under `reality`, either leave h0 at the sampled value or recompute g0 from the raised h0. |
| 20 | `world.ts:makeWorld` l.165: classic h0 = 22 min at Jul 2025. | `simple_params.yaml` l.5: `current_horizon: 15` at 2025.25 (public). With the median superexponential parameters the public horizon at 2025.5 is ≈ 23.6 min and the *internal* one (+1.22 mo delay) ≈ 28.6 min [D]. METR TH1.1 (`benchmark_results_1_1.yaml`): Claude 3.7 Sonnet p80 12.09 min; GPT-5 (2025-08-07) p80 38.31 [19.18, 70.09] min. | L | `s.p` is the internal frontier, so the classic h0 for presets that use `hSCmin` should be about 28. This only shifts display and those presets' g0 by about 1 month. The 38 min `reality` value is verified. |
| 21 | `WORLD_PRESETS.sampled.desc`: "drawn from the AI 2027 forecast distributions (Lifland, Apr 2025)". The engine uses the patched interpolation. | `simple_params.yaml` l.29–61: both `eli` (original, buggy) and `eli_patched_rd_speedup` are active. Page [W]: "there was a bug in our code such that it did not include the subtraction of 1, then addition of 1 … about a 9 month impact". Port: buggy p50 2027.61, patched 2028.37 [D]. | L | Description: "Lifland Apr 2025 distributions, with the Dec 2025 interpolation fix (median SC ≈ mid-2028; the published Apr-2025 run gave 2027)". Optionally add a `bugCompat` flag that uses `(1+p)*((1+s)/(1+p))^f`. |
| 22 | `world.ts` case `slow` (l.182): `T 7, exp, hSC 120 work-months, cs 6, pEx .01, sEx .6, G [10,394,2000]`. Description cites "titotal critique". SC 2034.57 [D]. | METR (arXiv 2503.14499; primary): 50% horizon "doubling approximately every 7 months" (2019–2025). AI 2027 Eli median h_SC = `sqrt(1*14400)` = 120 mo; cs median `sqrt(0.5*30)` = 3.87. SC→SAR p90 = 10 (`takeoff/params.yaml` l.17); G2 = 394 ⇔ AMR→SAR = 25 (p90 of `[1,25]`). AIFP Dec-2025 blog [W] (Daniel): "Pure exponential trend, keeping my other parameters fixed, gets to AC 5 years later, in 2034." titotal is a third-party critique (**secondary** under this audit's policy). | L | Values are defensible. `cs 6` and `G3 2000` have no source ([D]). With `cs: 3.87` SC is 2034.40. Add the 2029 slowdowns (#4). Cite the AIFP "2034" statement instead of titotal. Note that M jumps from 1.6 (SC) to the 25 SAR anchor; consider `SAR = 10` for this preset [D]. |
| 23 | `sim.ts:copiesOf / speedOf` l.322–329: late-2027 race run ≈ 1.0M copies at about 69× speed. | Scenario [W]: Mar 2027 "200,000 Agent-3 copies"; Jun 2027 "6% of their compute to run 250,000 Agent-3 copies"; Sep 2027 "300,000 copies … about 50x the thinking speed of humans". Compute forecast Q1–Q4 2027 copies 300K/400K/500K/600K. | L | Cap the M-term: `copies = rd*0.4*min(M,10)^0.3`; `speed = min(8 + 10.8*log2(M), 50)` until ASI. Mar 2027 already matches (~216k at about 33×). |
| 24 | `sim.ts:attackerLevel` l.468–471: `4 + (china.rung≥2) + 0.5*min(2, spies…)` → up to **6**. `theftP2mo = 1/(1+19*6^(d−a))`. | Security forecast [W]: WSLk = able to defend against OCk "with 95% probability" against attempts "specifically trying to steal frontier AI model weights in under 2 months". OC5 = "Operations by the world's most capable nation-states", which already includes insider access (OC3 and up includes "insider threats"). | L | The 5% at d = a matches the definition. The base 6 per level is [D]. Cap `a ≤ 5`. Fold spies in only as an effective-defence penalty when WSL < 3 (insider-threat tier), e.g. `d_eff = d − 0.3*min(1, spies/5)` if `d < 3`. |
| 25 | `init.ts` l.86: `allocation.security 0.04` of compute; `sim.ts:monthlyCosts` l.217 `security = alloc.security*computeCost*0.3`. | Compute forecast usage table [W] has no security compute line (Training / Internal workloads / External deployment / Monitoring). Alignment = 3–5% of "Total Internal" (≈ 1% of all compute) plus Monitoring 2–4%. | L | Fine as a game abstraction; label it [D]. The default `alignment 0.02` corresponds to their ≈ 3% (alignment share of internal + monitoring). |

---

## 3. Verified OK (matches the primary source)

| Item | Ours | Source |
|---|---|---|
| Lognormal from an 80% CI | `lnFrom80` uses μ = mean of logs, σ = Δln/(2·1.2816) | `simple_forecasting_timelines.py` l.14–28 (uses ±1.28); `forecasting_takeoff.py` l.16–31 (`norm.ppf`) |
| Doubling-work formulas | `doublingWork`: exp n·T; super T(1−(1−d)^n)/d; sub T((1+g)^n−1)/g | same file l.151–170 |
| Horizon display inverse | `horizonAt`: super `ln(1−prog·d/T)/ln(1−d)`; sub `ln(1+prog·g/T)/ln(1+g)`; flat at h_SC during cs | l.192–247 (mapping incl. "cost_speed period (horizon stays constant)") |
| Work-month = 167 h | `WORK_MONTH_MIN = 167*60` | l.121 `h_current = current_horizon / (60 * 167)`; README: "a work year is 2,000 hours" |
| Patched multiplier | `1 + pEx*(sEx/pEx)^f`, f = p/s1 | l.309–310 (`patch_rd_speedup`) |
| Software/compute blend | `share = 0.5` (sampled, ai2027) | l.324 `total_rate = (v_algorithmic + compute_rate) / 2`; page [W]: "in 2024 algorithmic progress represents half of AI progress" |
| Eli distributions (sampled) | h_SC [1,14400] mo; T [2.5,9]; cs [0.5,30]; delay [0.25,6]; pEx [0.03,0.3]; sEx [1.5,40]; P(super) 0.45; P(sub) 0.10; decay 0.10; sub growth 0.10 | `simple_params.yaml` l.29–44 |
| Growth-type direction in copula | low uniform → super (correlated with short T, small cs) | l.101–104 |
| (pEx, sEx) correlation 0.7 | yes | l.77–94 |
| h_SC and delay independent | yes | l.49–53, 70–74 |
| Delay direction | internal frontier ahead: we add delay to pre-start progress | l.300 `time = current_year - announcement_delay/12` |
| Takeoff gaps | G1: P(0) = 0.15 else LN[1.5,10]; A ~ LN[1,25] with ρ = 0.8 to G1; G2 = x³/100 − x; E ~ LN[0.3,7.5] independent; G3 = x2(x2/x)^E − x2 | `takeoff/params.yaml` l.4–17; `forecasting_takeoff.py` l.64–129. The 0.7 "time_gaps" correlation is effectively unused for derived gaps (l.82–136) — ours ignores it too (correct). |
| Stage 2 interpolation | geometric in progress fraction, `sp[k]*(sp[k+1]/sp[k])^f` | `forecasting_takeoff.py` l.169–176 |
| Multipliers 25/250/2000 | yes | `takeoff/params.yaml` l.23–27; page [W]: SC 5×, SAR 25×, SIAR 250×, ASI 2,000× |
| Takeoff = software-only, compute fixed after SC | our Stage 2 uses `mult × computeFactor`, and cf = 1 when on the reference path | page [W]: "The FLOPs used for experimentation, training, etc. are constant"; multiplier relative to a project "not allowed to use AIs to speed up algorithmic progress" |
| ai2027 takeoff G = [4.19, 16, 49.5] | gives SC→SAR 0.417 y, SAR→SIAR 0.25 y, SIAR→ASI 0.083 y | scenario dates SAR Aug, SIAR Nov, ASI Dec 2027 [W] (G values are [D] fits, correct) |
| T 4.74 in ai2027 | √(2.5·9) | median of `T_t_ci [2.5, 9]` |
| Global compute to 2027 | 13M at 2025.5, 19.5M at 2026.0, 43.9M at 2027.0, 98.7M at 2028.0 | compute forecast [W]: 10M (Mar 2025), 18M, 40M, 100M; "2.25x per year" |
| OB start compute ≈ 1.2M | Jul 2025 | compute forecast [W]: average 1M in 2025; "around 500k H100e" share "today" growing 3.4×/yr |
| Compute share cap 25% | `monthlyOrder` | scenario Aug 2027 [W]: "OpenBrain's 20%"; compute forecast "15-20% share … by the end of 2027" |
| Cost per H100e-year | `14000*0.8^t`: $14.0k (mid-2025), $11.2k (mid-2026), $9.0k (mid-2027) | compute forecast financials [W]: compute cost $16B / 1M avg (2025) = $16k; $40B / 4M = $10k; $100B / ≈10.75M = $9.3k. Within 15%. |
| Default compute split | capabilities 0.62 / product 0.32 / alignment 0.02 | compute forecast usage 2025 [W]: training + internal 68%, external 30%, monitoring 2% (+ alignment ≈ 1%) |
| China compute share | 0.12 (classic) | scenario Mid 2026 [W]: "about 12% of the world's AI-relevant compute"; compute forecast "around 13%" |
| Staff ≈ 2,500 → 3,000 | Jul 2025 → Mar 2026 | scenario Early 2026 [W]: "a fast-growing ~3,000 person tech company" |
| Spy rate | 0.5% of privileged staff, 1% under priority | security forecast [W]: "US baseline is about 0.5% of employees, rising to a peak of 1% in 2026" |
| Security change speed | ≤ 0.006/day ≈ 2.2 levels/yr | security forecast [W]: about 12 months for a top-priority effort to go from WSL3 to WSL5 |
| SSL ≈ WSL − 0.6 | yes | security forecast [W] gaps 0.7/0.7/0.9/0.5/0.4/0 |
| P(theft in 2 mo) = 5% at d = a | `theftP2mo(a,a) = 1/20` | WSL definition [W]: 95% defence against OC_k for 2-month attempts |
| Theft gating | milestone ≥ Agent-2 | scenario [W]: "China Steals Agent-2" (Feb 2027) |
| `reality` h0 38 min | yes | METR `benchmark_results_1_1.yaml`: `gpt_5_2025_08_07_inspect p80_horizon_length estimate 38.312431` |
| AIFM horizon requirement 125 wy | `125*12*WORK_MONTH_MIN` = 1.503e7 min | `sampling_config.yaml` l.23–27 ci80 [12000, 1.875e10] (median 1.5e7), 120,000 min per work-year |
| AIFM T (Eli 4.5 / Daniel 4.0) | yes | `sampling_config.yaml` l.50–54; `sampling_config_q2_daniel.yaml` `[0.2117, 0.5233]` |
| Milestone canon dates | SC 2027-03, SAR 2027-08, SIAR 2027-11, ASI 2027-12 | takeoff page [W], "Scenario date" column |

---

## 4. Unverifiable items (no primary source found)

| Our value | Where | Status |
|---|---|---|
| `computeElasticity` 0.5 (0.35–0.7 sampled), `computeFactor` clamps 0.15–4 | `world.ts:common`, `sim.ts` l.76 | Design [D]. Neither model has a compute-level elasticity on the rate (see #13). The AIFM's experiment-compute CES (`inv_compute_anchor_exp_cap` ci80 [0.7, 4.6], shifted) is the nearest analogue. |
| `computeGrowth` sampled `normal80(1.9, 2.5)` | `world.ts` l.219 | [D]. AI 2027 uses a 2.25 point value; the AIFM series is about 2.5. |
| Talent exponent 0.25, 2050-staff normaliser | `sim.ts` l.77 | [D]. The May-2025 AI 2027 variant uses `labor_power: 0.3` on a research-stock model (`timelines_may_2025_update/simple_params.yaml`). That is not the same construct, but 0.3 is a defensible exponent. |
| `share` 0.6 in authors2026/fast | `world.ts` | Not found verbatim in the primary sources I read (the Dec-2025 blog fetch returned no parameter table). research/03 cites "50% → 63%". Mark [unverified]. |
| pEx/sEx for the AIFM presets | `world.ts` | [D] calibration knobs. The AIFM's software-progress multiplier at AC is around 5–9× (AIR-5x lands at AC + 0.09 y, Eli unconditional) — derived from `ac_unconditional_time_until_statistics.csv`. |
| neuraleseBoost 1.15–1.5 | `world.ts` | No primary number (see #10). |
| Valuation multiple, start valuation 610/300, cash 40/45 | `sim.ts` l.247, `BASELINES` | No AI 2027 primary figure. Real-world OpenAI valuations come only from press (**secondary**). |
| Staff cost $0.6M/yr, 25% order deposit, PR spend | `sim.ts:monthlyCosts` | [D]; no primary source. |
| `reality` baseline globalCompute 14M, compute 1.0M, approval etc. | `BASELINES[1]` | I did not verify these against Epoch AI data pages in this audit. Epoch's "AI chip computing capacity" data hub would be the primary source to check. The AIFM's own `world_H100e` gives ≈ 13.9M at 2025.5 (log-interpolated), consistent with 14M. |
| Rival gap ranges, rival compute share 6% | `init.ts` l.57–72 | Scenario Late 2025 [W]: "We imagine the others to be 3–9 months behind OpenBrain." Our race run gives 50–100 days, at or below the low end. |
| `theftP2mo` base 6 per level; hazard × espionage/100 | `sim.ts` l.464–491 | [D]. Security forecast [W]: "The document does not give a number of attempts or a per-attempt success probability." |
| RAND RR-A2849-1 definitions | — | rand.org returned HTTP 403 to the fetcher. The OC1–OC5 descriptions above come from the AI 2027 security forecast's own summary of RAND. A copy of the PDF on a third-party host exists, but I did not use it (it is not a primary host). |
| Guesstimate / Google Sheets linked from the supplements | — | Not opened. The code configs gave every parameter needed. |
| AI goals forecast | — | Not engine-relevant to Stage 1/2; not audited here. |

---

## 5. Suggested replacement parameter tables

Every preset should be calibrated at reference compute (cf = 1, human = 1), with #3 (rollback / first-crossing) and #11 (default compute tracks the reference) fixed first. "Result" columns are from my reimplementation of our own engine's formulas [D].

### 5.1 `ai2027` — scripted AI 2027 scenario

| Param | Current | Proposed | Source |
|---|---|---|---|
| h0 (Jul 2025) | 22 | 22 (display only) | AI 2027 15 min @2025.25 (`simple_params.yaml` l.5), trended forward [D] |
| T | 4.74 | 4.74 | median of `T_t_ci [2.5, 9]` |
| growth / decay | super / 0.10 | super / 0.10 | `se_doubling_decay_fraction: 0.1` |
| g0 | 20 | **28.5** | [D] fit: SC = 2027-03-31 at cf = 1 |
| cs | 3.9 | 3.9 | median of `cost_speed_ci [0.5, 30]` = 3.87 |
| share | 0.5 | 0.5 | page: "half of AI progress" |
| pEx | 0.15 | **0.25** | [D] fit: M = 1.5× in Jan 2026 (scenario "50% faster", Early 2026) |
| sEx | 4 | 4 | takeoff `SC: 5` (scenario says "'only' 4x") |
| F_A1 / F_A2 | 0.35 / 0.8 | **0.25 / 0.75** | M = 1.5 / 3.0 (scenario Agent-1 / Agent-2) |
| G (human-years) | [4.19, 16, 49.5] | unchanged | [D] fit to SAR Aug / SIAR Nov / ASI Dec 2027 |
| speeds | [5, 25, 250, 2000] | unchanged | `takeoff/params.yaml` l.23–27 |
| neuralese | ×1.3 if adopted | ×1 if adopted, ÷1.3 if refused | #10 |
| computeGrowth | 2.25 to 2028, 1.7 after | 2.25 to 2029.0, then 1.5 | compute forecast; timelines code 2029 halving |
| **Result** | SC 2026.87, SAR 2027.29, SIAR 2027.54, ASI 2027.63 | SC 2027.24, SAR 2027.66, SIAR 2027.92, ASI 2028.00; 10× 2027.50, 50× 2027.80 | scenario: Mar / Aug / Nov / Dec 2027, 10× Jun, 50× Sep |

### 5.2 `sampled` — Eli Apr-2025 distributions (patched)

| Param | Current | Proposed | Source |
|---|---|---|---|
| h_SC (months) | LN[1, 14400] | same | `simple_params.yaml` l.33 |
| T (months) | LN[2.5, 9] | same | l.34 |
| cs (months) | LN[0.5, 30] | same | l.35 |
| delay (months) | LN[0.25, 6] | same | l.36 |
| pEx / sEx | LN[0.03, 0.3] / LN[1.5, 40], ρ 0.7 | same | l.37–38; code l.77–94 |
| P(super) / P(sub) | 0.45 / 0.10 | same | l.39–40 |
| decay / sub growth | 0.10 / 0.10 | same | l.43–44 |
| copula ρ (T, cs, type) | loading 0.7 (pairwise 0.49) | **loading √0.7 (pairwise 0.70)** | code l.35–43 |
| share | 0.5 | 0.5 | page |
| 2029 slowdowns | none | **compute ×0.5; M → √(0.5M(M−0.5))** | code l.273–275, 315–319 |
| Stage 2 start | 1 + sEx, SAR = max(1.5·sc, 25) | 1 + sEx with G1 stretched to a 5→25 duration (#6), SAR = max(25, 1 + sEx) | `takeoff/params.yaml` |
| Takeoff gap distributions | as code | same | `takeoff/params.yaml` l.4–17 |
| G3 cap | 20,000 human-years | 1.2e6 (≈ 1000 calendar years) or keep as a game cap | `forecasting_takeoff.py` l.167 |
| **Result** | SC p10/50/90 2026.28 / 2028.34 / 2037.21 | ≈ their patched 2026.05 / 2028.37 / 2044.14 | port [D] |

Optional variants, all from the same primary code:
- **Nikola.** These lines are commented out in `simple_params.yaml` l.62–77: `h_SC_ci [0.1, 24]`, `SC_prog_multiplier_ci [1.0, 20.0]`, `p_superexponential 0.4`. The page states the same thing as "1.5 months [16 hours, 4,000 hours]" and SC multiplier "5.5 (2.0 to 20.0)". Published result: SC 2027 (2025–2033).
- **Eli May-2025.** From `timelines_may_2025_update/simple_params.yaml`:
  - `initial_software_progress_share_ci [0.2, 0.85]`, sampled as normal and clipped to [0.1, 0.9] (code l.48–59);
  - `se_doubling_decay_fraction_ci [0.03, 0.3]`;
  - `superexponential_schedule_months [[0.0014,0.25],[0.045,0.40],[1,0.6],[120,0.8],[12000,0.85]]`;
  - `compute_schedule [[2028,0.9],[2029,0.5],[2030,0.4],[2031,0.3]]`;
  - `labor_growth_schedule [[2025,0.5],[2028,0.4],[2029,0.2],[2030,0.15],[2031,0.1]]`;
  - `labor_power 0.3`, `initial_research_stock 50`, `initial_labor_pool 1000`.
  - Published result: 2029 (2026–2052).

### 5.3 `authors2026` — AIFM Aug-2026, Eli's model

| Param | Current | Proposed | Source |
|---|---|---|---|
| h0 (Jul 2025) | 22 / 38 by baseline | **38, both baselines** (back-solve from 186 min @2026.269 gives 36.5) | `sampling_config_q2_eli.yaml` l.53–59; METR TH1.1 GPT-5 p80 38.3 |
| T | 4.5 | 4.5 | `sampling_config.yaml` l.50–52 (median 4.5 mo) |
| decay (= 1 − d) | 0.03 | **0.08** | `doubling_difficulty_growth_factor` ci80 [0.82, 1.02] → median 0.92 (l.55–61) |
| h_SC | 125 work-years | 125 work-years | l.23–27 |
| cs | 0 | **22** | [D] fit: SC = AC + 0.52 = 2029.68 (AC p50 2029.1644; AC→SC p50 0.4826–0.5217) |
| share | 0.6 | 0.6 | [unverified] |
| pEx / sEx | 0.1 / 2 | 0.1 / 2 (or AIFM-like speeds, below) | [D] |
| G | [1.2, 115, 2970] | **[1.52, 101, 1340]** | [D] fit to AC→SAR 0.73, AC→SIAR 2.31 (`ac_unconditional_time_until_statistics.csv`), AC→ASI 4.56 (Q2.5 blog) |
| computeGrowth | 2.0 | **2.5 to 2028, then the AIFM `world_H100e` table** | `inputs/input_data.csv` |
| **Result** | SC 2029.71, SAR 2029.88, SIAR 2031.68, ASI 2036.69; h80 @2026.27 = 106 min | SC 2029.68, SAR 2029.89, SIAR 2031.48, ASI 2033.73; h80 @2026.27 = 186 min | AIFM Eli model: AC 2029.16, ASI ≈ 2033.7; ATC ASI 2033.57 |

Optional higher-fidelity takeoff that keeps the AIFM's lower multipliers needs a per-preset `speeds` override (a new `World` field). Interpolating the medians in `ac_2030_time_until_statistics.csv` in log space gives [D]:
- **Multipliers:** M ≈ 9 at SC, 14 at SAR, 87 at SIAR, 300 at ASI. The relevant timings are AIR-5x at AC + 0.10, AIR-25x at + 1.24, AIR-250x at + 4.32 and AIR-2000x at + 14.2, against SC + 0.52, SAR + 0.83, SIAR + 2.91 and ASI + 5.2.
- **Settings:** speeds [9, 14, 87, 300], sEx 8, G [3.45, 63.4, 347], cs ≈ 37.6.
- **Result:** the same dates, with multipliers that match the AIFM's (25× is not reached until about 2031).

**ATC alternative.** Target Eli's ATC AC of 2030.08 instead, so SC ≈ 2030.58. Use cs ≈ 36.3 and keep G. Result: SC 2030.58, ASI 2035.27.

### 5.4 `fast` — Daniel Aug-2026 timelines + AI 2027 10th-percentile takeoff

| Param | Current | Proposed | Source |
|---|---|---|---|
| h0 (Jul 2025) | 22 / 38 | **26** (anchor 186 min @2026.269) | `sampling_config_q2_daniel.yaml` `present_horizon 186.0` |
| T | 4.0 | 4.0 | `present_doubling_time ci80 [0.2117, 0.5233]` |
| decay | 0.08 | 0.08 | base d median 0.92 (Daniel inherits) |
| h_SC | 1 work-year | 1 work-year | `ac_time_horizon_minutes ci80 [6000, 2400000]` |
| cs | 0 | **10.3** (SC = Daniel AC 2027.91) or **19.7** (SC = AC + 0.52 = 2028.44) | AC p50 2027.9218 (model), 2027.91 (ATC) |
| pEx / sEx | 0.15 / 3 | 0.15 / 3 | [D] |
| G | [0, 2.31, 0.8] | **[0, 7.67, 47.5]** | [D] targets total SC→ASI 0.21 y ≈ AI 2027 code p10 0.200 y |
| computeGrowth | 2.4 | 2.5 → AIFM table | `inputs/input_data.csv` |
| neuraleseBoost | 1.4 | per #10 | no source |
| **Result** | SC 2027.34, ASI 2027.38 | SC 2027.91, SIAR 2028.03, ASI 2028.12 | Daniel AC Nov/Dec 2027 |

### 5.5 `slow` — skeptic (METR exponential)

| Param | Current | Proposed | Source |
|---|---|---|---|
| h0 | 22 / 38 | 38 (METR TH1.1 GPT-5 p80) | METR yaml |
| T / growth | 7 / exp | 7 / exp | METR arXiv 2503.14499 "every seven months" |
| h_SC | 120 work-months | 120 | AI 2027 Eli median |
| cs | 6 | 3.87 (or keep 6 as [D]) | AI 2027 median |
| pEx / sEx | 0.01 / 0.6 | same ([D] skeptic; below the AI 2027 CI floor of sEx 1.5) | — |
| G | [10, 394, 2000] | [10, 394, 2000]; G3 is [D] | p90 SC→SAR; p90 AMR→SAR = 25 ⇒ 394 |
| SAR speed | max(2.4, 25) = 25 | 10 [D] (avoids a 1.6 → 25 jump) | — |
| slowdowns | none | add #4 | AI 2027 code |
| **Result** | SC 2034.57 (h0 22) / 2034.14 (h0 38) | ≈ 2034–2035 | AIFP Dec-2025 blog: "Pure exponential trend … AC … in 2034" |

---

## 6. Sources

**Primary — code and data, read raw**
- `uvafan/timelines-takeoff-ai-2027`, commit `2085376a` (2025-12-10). Files:
  - `timelines/simple_params.yaml`, `timelines/simple_forecasting_timelines.py`;
  - `timelines/forecasting_timelines.py`, `timelines/params.yaml`;
  - `timelines_may_2025_update/simple_params.yaml`, `timelines_may_2025_update/simple_forecasting_timelines.py`;
  - `takeoff/params.yaml`, `takeoff/params_for_all_medians.yaml`, `takeoff/forecasting_takeoff.py`;
  - `README.md`.
- `AI-Futures-Project/aifm-public`, commit `1c40ecdb` (2026-09-09). Files:
  - `config/sampling_config.yaml`, `config/sampling_config_q2_eli.yaml`, `config/sampling_config_q2_daniel.yaml`, `config/sampling_config_daniel.yaml`;
  - `inputs/input_data.csv`, `docs/input-series-provenance.md`;
  - `progress_model/README.md` (milestone table l.294–303);
  - `app/forecast/data/simulations/{eli,daniel,brendan}-08-16-26/{milestone_pdfs_overlay_statistics,atc_cdf,atc_takeoff_cdf,ac_unconditional_time_until_statistics,ac_2030_time_until_statistics}.csv`, plus the 12-29-25, 12-31-25, 01-26-26 and 04-02-26 runs.
- METR, `https://metr.org/assets/benchmark_results_1_1.yaml` (TH1.1 p50/p80 estimates, doubling times).

**Primary — AIFP web pages**, read through a summarizing fetch tool with verbatim-quote prompts [W]. Short quotes are verbatim; the tables were reproduced by the tool.
- https://ai-2027.com/ (scenario, Key Metrics 2026 panel)
- https://ai-2027.com/research/timelines-forecast
- https://ai-2027.com/research/takeoff-forecast
- https://ai-2027.com/research/compute-forecast
- https://ai-2027.com/research/security-forecast
- https://blog.aifutures.org/p/ai-futures-model-dec-2025-update
- https://blog.aifutures.org/p/q25-2026-timelines-update-uplift
- METR, "Measuring AI Ability to Complete Long Tasks", arXiv 2503.14499. I relied on its "7 months" doubling claim but did not refetch the paper this session.

**Not reachable**
- RAND RR-A2849-1 (rand.org returned 403). OC definitions were taken from the AI 2027 security forecast's restatement.

**Secondary (flagged; not relied on)**
- titotal's critique (cited in our `slow` description).
- Press figures for real-world valuations.
- research/03, research/02 and research/01 (our own notes; used for orientation only).

**Reproduction scripts [D]** (scratch, outside the project): `/tmp/ai27diag/their_tl.mjs` (timelines port), `their_to.mjs` (takeoff port), `ours_tl.ts` (our engine at reference), `fit2.mjs`–`fit5.mjs` (preset fits), `diag.ts` (race-bot trace).
