# CAL-W: primary sources for the WORLD / PRESETS stand-in numbers

Calibration step 1 (source) and 2 (apply) for the world-preset numbers, branch `cal-world`. Each number: value, source
(URL and quote or table), mapping to game units, confidence. Only primary sources: the AI 2027 scenario and its
supplements, the AI Futures Model's published code and configs, the Forethought paper. No refit was run here; every
change "moves calibration" and is for the next step's scans.

Source code read: AI Futures Model (AIFM), https://github.com/AI-Futures-Project/aifm-public, commit `1c40ecd`
(2026-09-09), `config/sampling_config*.yaml`, `progress_model/config.py`, `progress_model/_impl.py`,
`tests/golden_data/default_milestones.json`, `default_trajectory.json`.

## 1. China research efficiency (`chinaEfficiency`, CHINA_PRESETS `efficiency`)

**Value:** 1 (was 0.7 on the presets, U(0.6, 0.9) on `sampled`; preset flavours 1.1 Fast Follower, 1.05 Diffuser, else 1).

**Source:** AI 2027 scenario, https://ai-2027.com/ (the scenario's own text). Every DeepCent statement that compares
research speed names compute as the cause; none gives a research efficiency at equal compute:

- Mid 2026: "Chip export controls and lack of government support have left China under-resourced compared to the
  West." DeepCent's researchers "do very impressive work with limited compute"; "they are about six months behind the
  best OpenBrain models". "China is falling behind on AI algorithms due to their weaker models" (a consequence of weaker
  AI R&D automation, which the engine models through the models themselves, not a per-lab factor).
- Aug 2027: "they have only 10% of the world's compute, against OpenBrain's 20%"; "they are still only going at half
  the pace of OpenBrain, mainly due to the compute deficit"; "their AIs give a 10x research progress multiplier".

AI 2027 compute forecast, https://ai-2027.com/research/compute-forecast: compute shares only (China ≈ 12% of world
compute; "the China AGI development share goes from 2% to 12%"). No statement on DeepCent's algorithmic or research
efficiency separate from compute.

**Mapping:** "half the pace … mainly due to the compute deficit" on half OpenBrain's compute leaves no separable
efficiency below 1 (the old comment "half OB's pace with half its compute" implies about 1, not 0.7). "Mainly" allows a
residual, but the text gives no number for it. The designer's CP3k decision (equal recipe efficiency with diffusion)
applies: 1 on every preset; the sampled draw is removed (so `sampled` worlds' later draws shift by one RNG step).

**Confidence:** high that the source gives nothing separable; the residual in "mainly" is unquantified.

## 2. Slow preset r (V3_CAL `slow.r`)

**Value:** 4.0 kept (CP3j's 1.2 → 4.0 is the right unit conversion, not a units error).

**Source:** Davidson & Houlden, "How quick and big would a software intelligence explosion be?", Forethought (2025),
https://www.forethought.org/research/how-quick-and-big-would-a-software-intelligence-explosion-be:

- Model: Ṡ = a·R^λ·S^(1−β), R = (bL)^α (cC)^(1−α), L = dS; "After ASARA is deployed, the compute used for AI R&D
  remains constant over time."
- r_cog := λα/β, p := λα; r_cog: "When (cumulative) cognitive research inputs double, how many times does software
  double?"
- "Overall, our median estimate of rcog is 1.2." "We use a log-uniform distribution with the bounds 3X higher and lower
  (0.4 to 3.6)." Derived from Epoch's ≈ 1.4 with adjustments (up for capability gains and post-training, down for
  slower compute growth, fixed hardware and worsening returns).
- "We use λ=0.6"; "the share of software progress that's attributable to cognitive labour is 0.5"; p 0.3, log-uniform
  0.15–0.6. "Our median estimates of p and rcog correspond to α=0.5, λ=0.6, β=0.25."
- Ceiling: software "6-16 OOMs from effective limits"; "each time software doubles we subtract some constant k from
  rcog" so r_cog reaches 0 at the ceiling.

**Mapping:** the game's line law is AIFM's SE = r·log₁₀ RS (models/research.ts lineRate), where RS is cumulative research
input (experiment CES of compute and λ-penalised labour). In Forethought's law the same quantity is the cumulative
penalised input R^λ, and software doubles 1/β times per doubling of it. So game r = 1/β = 1/0.25 = **4.0** at
Forethought's stated medians (range at p = 0.3: r_cog 0.4–3.6 → 1.33–12). Forethought's λ also penalises compute, the
game's λ only labour (a second-order difference while compute is held fixed, Forethought's own setting).

**What this means for the preset:** the slow preset's world.ts sources (research/03 #12 slow takeoff, #13 titotal's METR
exponential, compute schedule as #7) give no r at all; Forethought's median is not a slow world (its median SIE is fast).
At Forethought's medians slow's returns equal ai2027's (4). A low-returns slow world would need Forethought's low tail
(r_cog 0.4–0.5 → r 1.3–1.7, its p10 0.50 → 1.66) or the ceiling mechanism, which is a designer choice, not a units fix.

**Confidence:** high on the conversion (the paper states β = 0.25); the preset's identity is a designer question.

## 3. authors2026 sd_SC, Δ_bm, G_SC (V3_CAL `authors2026`)

**Values:** sd_SC 2.15 → **0.5**; Δ_bm 4.65 → **2.17**; G_SC 33.45 **kept [D stand-in]**.

**Source:** AIFM code `config/sampling_config_q2_eli.yaml` (authors2026 = Eli's Q2 2026 columns; parent
`sampling_config.yaml`):

- `ai_research_taste_at_coding_automation_anchor_sd`: inherited from the parent, `dist: normal, ci80: [-2.5, 3.5]` →
  median 0.5. The web preset (`constants/parameters.ts`, `'eli-08-16-26'`) states the same: "0.5, // (-2.5 + 3.5) / 2".
- `ai_research_taste_slope`: `lognormal, ci80: [0.8, 6.6125]` (Eli's Q2 sheet) → median 2.3 SD per progress-year (the
  web preset still carries the parent's sqrt(0.7·6.3) = 2.1).
- `progress_model/_impl.py` `_convert_anchor_year_slopes`: "SDs per progress-year" → per OOM by dividing by the
  present-day progress rate; `tests/golden_data/default_milestones.json`: `anchor_progress_rate` 1.6185 OOM/yr.
- `constants/parameters.ts` Eli preset: "Solved-uplift mode: the automation schedule is solved from the uplift level
  and doubling time, so ac_time_horizon_minutes is carried along but has no effect on AC." The Q2 sampling config mixes
  AC anchors "uplift-solved 0.6 / time-horizon 0.2 / revenue 0.2".

**Mapping:** Δ_bm is the best-to-median gap (TOP_SD 3.09 SD) in OOM of effective compute: 3.09 / (2.3 / 1.618) = 2.17
(with CP3j's E = 1.2–1.56 OOM/yr instead of AIFM's own rate: 1.61–2.10; with the web preset's 2.1: 2.38). sd_SC maps
1:1 (both are AI research taste at the automated coder, SD).

G_SC: CP3j mapped Eli's 125 work-year AC horizon through the game's exponential horizon law (36.6 median). That mapping
does not hold here: AIFM's horizon trend is superexponential (`decaying doubling time`, factor 0.92) and Eli's AC is
anchored by uplift, not horizon. For Daniel the golden run shows the gap: AC at progress 37.75 OOM, the 41-min p80
horizon of the game's V0 at 33.97 (2025.5; 34.12 at 2025.6), so AC is 3.6–3.8 OOM above V0, while the horizon law puts
Daniel's 1 work-year at 5.6 OOM above V0. The sourced G_SC for Eli needs AIFM's progress at AC for Eli's medians, which
needs a run of the AIFM model (not done: running the downloaded code was not permitted in this session). Kept.

**Confidence:** high for sd_SC; medium for Δ_bm (the per-OOM rate is Daniel's golden run, the human-only/anchor rate is
input-driven and should be close for Eli, not verified); G_SC unsourced.

**Moves calibration:** strongly. CP3j: at sd_SC 0.5, (33.85, 5.0) put SC +0.7 y and SAR +2.1 y late; a lower Δ_bm moves
SAR / SIAR / ASI closer to SC. The next step refits G_SC (the one stand-in) and judges the milestone spacing.
