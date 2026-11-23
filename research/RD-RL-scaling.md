# RD-RL-scaling: how the RL gain should scale (2026-11-23)

What this feeds: `RL_CURVE` / `RL_C0` / `rlCeiling` (src/data/v2/runDesign.ts, src/engine/v2/models/effective.ts),
RD-T04 (absolute midpoint), CP3c (frontier 1.69 G/yr against 1.1–1.3; the RL gain goes 0.67 → 1.01 → 1.16 across three bases, which is
≈ 0.5 of the 0.85 G excess).

Tags: [P] primary paper / official post, with numbers. [A] analysis of primary data with a stated method (Epoch, Ord).
[D] my arithmetic on [P]/[A] numbers. [G] game proposal.

## 0. Bottom line

| Finding | Strength |
|---|---|
| In pretraining-equivalent terms, RL gives **≈ 0.25–0.5 OOM of effective compute per OOM of RL FLOP** (central 0.33) over the ~4–6 OOM range observed 2024–25 | medium: one chain of conversions (o1 chart → inference → pretraining), checked against Epoch CEG |
| The game's curve has **0.87 G per OOM of RL FLOP** at the reference point: B = 1.8 was taken from Khatri's fits, where y is a **pass rate**, not OOM of effective compute | units error, high confidence |
| Early reasoning models at ~1% RL share already had a CEG of ≈ 10× (≈ 1 OOM, about half of it from test-time thinking). The game's curve gives **0.02 G** at ρ = 0.01 | contradicts the current curve |
| A bigger base gets more out of RL (higher asymptote, better sample efficiency), but nobody has measured this in effective-compute units. Per-sample efficiency **saturates above ~15–30B params**, well below frontier size | medium (Tan 2025, Khatri 2025, R1) |
| No capability ceiling has been measured in effective-compute units. The binding limit is **cost**: past RL ≈ pretraining, each 10× of RL adds ×5.5 to total training cost | high (Ord), data thin |
| RL share of training compute: ≲ 1% (2024) → 5–20% (R1, Jan 2025) → > 10% (DeepSeek-V3.2) → ≈ 100% (Grok 4, Jul 2025) | [P] for each point |
| **Recommendation:** a broad curve in G units (A ≈ 2, B ≈ 0.33), midpoint ∝ FLOP_pre^0.5 (a fixed number of RL episodes, not fixed FLOP). That gives **≈ 1.18 G per OOM of training FLOP at a fixed recipe** (now ≈ 1.6) | [G] |

## 1. Q1: RL gain against RL compute, in pretraining-equivalent terms

| # | Source | Number | How directly it maps to "OOM of effective compute per OOM of RL FLOP" |
|---|---|---|---|
| 1 | OpenAI, *Learning to reason with LLMs* (Sep 2024) [P] (chart, no FLOP axis), read by Ord, *How Well Does RL Scale?* (Oct 2025) [A] | o1 AIME: 100× RL train compute takes 33% → 66%; 100× inference takes 20% → 80%. The RL slope is "almost exactly half" the inference slope: "10x scaling of RL ... same boost as 3x scaling of inference" | One OOM of RL ≈ 0.5 OOM of inference (in log-x terms, on AIME) |
| 2 | Villalobos & Atkinson, Epoch (2023) [A] (already in R20 C3) | ~1 OOM of training compute trades for ~1–2 OOM of inference | 0.5–1 OOM of pretraining per OOM of inference |
| 3 | Ord (Oct 2025) [A] | Assumes 1,000× inference ≈ 100× training, so "1,000,000x scale-up of total RL compute" ≈ one GPT-level step (≈ 100× pretraining) | **0.33 OOM of pretraining per OOM of RL** |
| — | [D] combining 1 and 2 | 0.5 × (0.5–1) | **0.25–0.5 per OOM of RL, central 0.33** |
| 4 | OpenAI, *Introducing o3 and o4-mini* (Apr 2025) [P] | "pushed an additional order of magnitude in both training compute and inference-time reasoning"; "more compute = better performance" | o1 → o3 ≈ +1 OOM of RL. Ord reads the o3 chart as AIME 26% → 88% over 4 OOM of RL |
| 5 | Ord [A], from OpenAI's token-vs-score charts | GPT-5 ≈ 10× o3's RL ("o3 requires about 3x as many tokens to match GPT-5") | Inferred, not disclosed |
| 6 | Epoch, *Quantifying the algorithmic improvement from reasoning models* (2025) [A] | CEG o1 vs GPT-4o on GPQA ≈ **9×**; Claude 3.5 → 3.7 Sonnet 1–100×, central ≈ **10×**; "on the order of a 10x" for early reasoning models. Training and test-time thinking contribute "roughly equally" | Pretraining-equivalent, measured directly. ≈ 0.5 OOM from reasoning **training** at RL ≲ 1–20% of pretraining |
| 7 | Davidson et al. 2023, arXiv 2312.07413 [P] | Post-training enhancements: CEG mostly > 5×, some > 20×, at < 1% of training cost | Earlier non-RL post-training; a reference for the size of gains |
| 8 | Khatri et al. 2025, arXiv 2510.13786 (ScaleRL) [P] | `R − R0 = (A − R0)/(1 + (C_mid/C)^B)`. 8B dense: A 0.61–0.655, B 1.56–1.92, C_mid 2,542 GPU-h. Scout 17B×16 MoE: A 0.710, B 1.65, C_mid 4,242 GPU-h (Table 1) | **y is the pass rate on an in-distribution held-out set**, not effective compute. B is not transferable to ΔG in OOM |
| 9 | Tan et al. 2025, arXiv 2509.25300 (Qwen2.5 0.5–72B, math RL) [P] | `log L = −k(N)·log C + E(N)`, k(N) = K_max/(1 + N0/N), K_max 0.13–0.16, N0 13–28B | Power law in compute (log-linear, no hard ceiling in range). In loss units |
| 10 | DeepSeek-V3.2, arXiv 2512.02556 [P] | "consistent performance improvements correlating with extended RL training budget" | Qualitative |

**Read [D].** A sigmoid in pass rate with B ≈ 1.8 is what a log-linear gain in effective compute looks like once it passes
through a benchmark's own sigmoid (Epoch's CEG method fits benchmark score as a sigmoid in log pretraining compute too).
So the steepness belongs to the benchmark, not to effective compute. In effective-compute units the data look roughly
log-linear: ~0.33 per OOM over ≥ 4 OOM (o1 → o3: 4 OOM, 26% → 88% AIME, all on one AIME sigmoid).

**The game's curve against these numbers [D]** (`node` on A/(1 + (C_mid/C)^B), reference ρ = 0.15 on B0 → 0.70):

| ρ = RL ÷ pretrain FLOP | 0.01 | 0.03 | 0.15 | 0.4 | 1 | slope at ref (G per OOM of RL) |
|---|---|---|---|---|---|---|
| current (A 1, B 1.8) | **0.02** | 0.11 | 0.70 | 0.93 | 0.99 | **0.87** |
| proposed (A 2, B 0.33) | 0.36 | 0.48 | 0.70 | 0.85 | 1.00 | 0.35 |
| source check | ≈ 0.5 (Epoch CEG o1, training half) | — | — | — | ≈ 1–1.3 (Ord: 1e6× ≈ 2 OOM; Epoch up to 100×) | 0.25–0.5 |

## 2. Q2: does a bigger base get more from the same RL share?

| Source | Finding | Maps to |
|---|---|---|
| Khatri 2025 [P] | Scout MoE has "much higher asymptotic RL performance" than the 8B, and beats it "using only 1/6 of its RL training compute". C_mid 4,242 vs 2,542 GPU-h (×1.67) for ≈ ×2.1 active params per token | Higher ceiling with size (pass rate). Midpoint in GPU-hours grows **sublinearly** in cost per token (≈ N_active^0.7) [D, rough: MoE GPU efficiency differs] |
| Tan 2025 [P] | Larger models "consistently exhibit higher learning efficiency"; "Beyond 32B, the increase in k_C(N) diminishes, leading to efficiency saturation"; at equal compute 32B at first beats 72B (more steps) | Per-sample efficiency rises with N but **saturates at N0 ≈ 13–28B**. Frontier bases (hundreds of B) sit on the flat part |
| DeepSeek-R1, arXiv 2501.12948 §4.1 [P] | Qwen2.5-32B-Zero (> 10K RL steps) ≈ QwQ-32B-Preview, AIME 47.0, against the distilled 32B at 72.6: small models on large-scale RL "require enormous computational power and may not even achieve the performance of distillation" | Small bases gain less from RL. In pass rate, not effective compute |
| Yue et al. 2025 [P] (R20 C2) | At large k, the base model's pass@k beats the RL model's; RLVR "does not elicit fundamentally new reasoning patterns" | The ceiling is set by the base (relative ceiling) |
| Epoch CEG [A] | ≈ 10× for o1 on GPT-4o and for Claude 3.7; no trend with base size reported | Gives no size trend |

**Answer.** In pass-rate units a bigger base gains more from the same RL share, and its ceiling is higher. In
effective-compute units nobody has measured it. One mechanism has a physical basis [D]: an RL midpoint fixed in
**episodes** (samples), not in FLOP. A rollout costs ≈ 2·N_active·L FLOP, so at fixed share ρ the episode count is
∝ ρ·6ND/(2NL) = 3ρD/L. Under Chinchilla D ∝ FLOP_pre^0.5, so a 10× base gets ≈ 3.2× more episodes at the same share.
That is a midpoint ∝ FLOP_pre^0.5, between RD-T04's absolute midpoint (k = 0) and a midpoint relative to the base (k = 1).
Tan's saturation above ~30B says frontier bases get no extra per-episode efficiency on top of that. Khatri's Scout point
(midpoint ∝ ≈ N^0.7 in GPU-hours) is in the same direction.

## 3. Q3: is the RL multiplier bounded?

| Source | Ceiling evidence |
|---|---|
| Khatri [P] | A pass-rate asymptote per recipe (0.61–0.71). Size, generation length and batch raise it. Not in effective compute |
| Tan [P] | Power law in loss, no asymptote in the 0.5–72B range |
| Epoch CEG [A] | Observed 1–100×, central 10× (training + test-time). Note: very large CEGs imply hypothetical pretraining |
| Davidson 2023 [P] | Post-training enhancements 5–30×, a few higher |
| Ord [A] | No capability cap stated. A **cost** cap: by Oct 2025 a ~10^6× RL scale-up has cost "≤2x the total training cost"; the next 10^6× "would require 1,000,000x the total training cost". He calls one more 10× past GPT-5 "the end of the line for cheap RL-scaling" |
| Grok 4, x.ai/news/grok-4 [P] | RL "at pretraining scale", "over an order of magnitude more compute than had been used previously" |

**Answer.** In effective-compute units no hard ceiling has been measured. The practical bound is that RL FLOP cannot
outgrow total training FLOP. With ~0.33 G per OOM, the gain at ρ ≈ 1 is ≈ 1–1.5 OOM (Ord's 10^6× ≈ 2 OOM counts from
a near-zero start). A ceiling A ≈ 2 OOM (≈ 100×, top of Epoch's range) keeps the curve log-linear across the
observed range, so it does not bind in practice. Per Yue, the ceiling should rise with the base's G, which a relative
form (gain added to G) already gives.

## 4. Q4: RL share of training compute, 2024–2026

| Model (date) | RL ÷ pretraining | Source | Map |
|---|---|---|---|
| o1 (Sep 2024) | ≈ 1% ("1.01x higher than the base-model") | Ord [A], an assumption, not disclosed | weak |
| Llama-Nemotron Ultra 253B (2025) | 140K H100-h ≈ 1–1.5e23 FLOP, "<1%" of the 4e25 base | Epoch, *How far can reasoning models scale?* [A] on NVIDIA's numbers | good |
| Phi-4-reasoning (2025) | < 1e20 FLOP, "<0.01%" | same [A] | good |
| DeepSeek-R1 (Jan 2025) | 147K H800-h (R1-Zero 198 h + R1 80 h on 512 GPUs, + 5K SFT) against V3's 2.788M H800-h = **≈ 5% in GPU-hours**. Erdil/Epoch: ≈ 6e23 FLOP, **≈ 20%** of V3 | Nature 2025 supplement [P] via the R1 paper; Epoch [A] | GPU-hours ≠ FLOP: RL MFU is lower (game MFU_RL_FACTOR 0.6), so the FLOP share is ≤ 5%. The estimates disagree ×4 |
| o3 (Apr 2025) | ≈ 10× o1's RL | OpenAI [P] | ratio only |
| MiniMax-M1 (Jun 2025) | RL 3 weeks on 512 H800 ($534,700) | MiniMax-M1 report [P] (R20 C1) | base cost not given |
| Grok 4 (Jul 2025) | **≈ 1** ("at pretraining scale") | xAI [P] | qualitative, direct |
| GPT-5 (Aug 2025) | ≈ 10× o3's RL | Ord [A], inferred from token charts | weak |
| DeepSeek-V3.2 (Dec 2025) | **> 10%** ("post-training computational budget exceeding 10% of the pre-training cost") | arXiv 2512.02556 §1, §4.1 [P] | direct, a lower bound |
| Anthropic (Jan 2025) | "$1M instead of $0.1M is enough to get huge gains"; labs scaling RL to "hundreds of millions and billions" | Amodei essay [P], read by Epoch as ≈ 1e26 FLOP [A] | qualitative |
| 2026 | No primary number found. Epoch (May 2025) expected reasoning compute to reach the frontier total "perhaps within a year", then grow at ~4–5×/yr | Epoch [A] | projection |

Growth: RL compute ≈ 10× every 3–5 months in 2024–25 (Epoch [A]), against ≈ 4–5×/yr for total training compute.
So the RL share climbed ≈ 2 OOM (0.01 → ~1) in ≈ 1.5 years and has to flatten from 2026.

## 5. Recommendation [G]

| Option | Form | G per OOM of training FLOP at fixed share (this curve) | Verdict |
|---|---|---|---|
| (a) Absolute midpoint (RD-T04, now) | C_mid = c0/10^e_RL | current B 1.8: ≈ **1.6** (0.70 → 1.00 → 1.08 at 1×, 3.2×, 8× B0). With B 0.33: 1.36 | Too steep. Treats RL samples as free to scale with the base, and B is in the wrong units |
| (b) Midpoint relative to the base | C_mid = c0·FLOP_pre/10^e_RL (k = 1) | 1.0 (+ a1 ceiling term) | Defensible. Ignores the evidence that bigger bases do better (Khatri, R1) |
| **(c) Episode midpoint, broad curve (recommended)** | ΔG = A/(1 + (C_mid/C_RL)^B), **A = 2.0**, **B = 0.33**, **C_mid = c0·(FLOP_pre/FLOP_RL_REF)^0.5/10^e_RL**, c0 solved as now (ρ 0.15 on B0 → 0.70; gives C_mid ≈ 6.5 × the reference RL FLOP, ≈ 2.9e26 before the reach factor) | **≈ 1.18** (0.70 → 0.79 → 0.86 → 1.07 at 1×, 3.2×, 8×, 100× B0) | Matches the slope (0.35/OOM of RL), the CEG at ρ 0.01 (0.36), ρ 1 (1.0), and gives a size effect from episode counts |
| (d) Plain log-linear | ΔG = s·log10(1 + C_RL/C0), s 0.33 | 1 + s = 1.33 with an absolute C0; 1 + s/2 with C0 ∝ FLOP_pre^0.5 | Same as (c) at low ρ; no cap. Fine if (c) is too fiddly |

Parameter notes for (c):
- **A = 2.0 OOM** (100×): Epoch's top CEG, Ord's "GPT-level". Drop `rlCeiling`'s a1 = 0.1, or keep it small. The base
  dependence now lives in the midpoint, and the gain is already added to the base's G (Yue's relative ceiling).
- **B = 0.33**: slope at the reference A·B·ln10·σ(1 − σ) = 0.35 G per OOM of RL, inside 0.25–0.5. Not Khatri's 1.8.
- **k = 0.5** (midpoint exponent on FLOP_pre): a constant episode count under Chinchilla D ∝ FLOP^0.5. Range 0.35–0.7
  if Khatri's ≈ N^0.7 is used instead. k is the knob for the fixed-recipe slope: G/OOM ≈ 1 + 0.35·(1 − k).
- **e_RL** (RL recipe) still moves C_mid. Khatri: loss aggregation, normalisation and curriculum move B / C_mid; loss
  type, FP32 head, generation length and batch move A. ScaleRL vs older recipes: the 8B asymptote 0.52 → 0.61 from FP32
  logits alone.
- **Compute-optimal share** under (c) [D]: the marginal G per FLOP of RL equals that of pretraining at ρ ≈ 0.6 (35–40% of
  total). Under the current curve it is ≈ 0.37. Both sit in the observed 2025–26 range (0.1–1). A RefBot or rival rule
  "ρ rises to ~0.5" is consistent with that.

**What this does to CP3c [D].** Fixed-recipe G per OOM of training FLOP goes ≈ 1.6 → ≈ 1.18. With physical FLOP at ~0.63
OOM/yr (CP3c), that removes ≈ 0.25–0.3 G/yr of the RL-at-scale excess. Rule-A diffusion (the other ≈ 0.3) is a separate
issue. Caveats:
- The flatter curve gives more at low ρ. Light budgets (0.03) and small students rise: 0.11 → 0.48 on B0, and a 0.1×
  base at the standard share gets ≈ 0.54 instead of 0.04. Student and distillation calibration moves.
- The gain from rising share (ρ 0.03 → 0.4: +0.37 G instead of +0.82) becomes the main RL driver over 2024–26, as in the
  sources. Per Epoch it is algorithmic progress, already inside the 1.1–1.3 G/yr anchor.
- RD-T05's horizon anchors and RL_TRANSFER read the same curve, so they move too.

## Sources

- OpenAI (Sep 2024), Learning to reason with LLMs. https://openai.com/index/learning-to-reason-with-llms/
- OpenAI (Apr 2025), Introducing o3 and o4-mini. https://openai.com/index/introducing-o3-and-o4-mini/
- Ord, T. (Oct 2025), How Well Does RL Scale? https://www.tobyord.com/writing/how-well-does-rl-scale
- Epoch AI (You, J., May 2025), How far can reasoning models scale? https://epoch.ai/gradient-updates/how-far-can-reasoning-models-scale
- Epoch AI (2025), Quantifying the algorithmic improvement from reasoning models. https://epoch.ai/gradient-updates/quantifying-the-algorithmic-improvement-from-reasoning-models
- Davidson et al. (2023), AI capabilities can be significantly improved without expensive retraining. https://arxiv.org/abs/2312.07413
- Khatri et al. (Oct 2025), The Art of Scaling Reinforcement Learning Compute for LLMs. https://arxiv.org/abs/2510.13786 (Table 1, App. A.7, A.13)
- Tan et al. (2025), Scaling Behaviors of LLM RL Post-Training. https://arxiv.org/abs/2509.25300 (Table 6, §3.1)
- DeepSeek-AI (2025), DeepSeek-R1, https://arxiv.org/abs/2501.12948 (§4.1, Table 6); Nature 2025 supplement (GPU-hours)
- DeepSeek-AI (Dec 2025), DeepSeek-V3.2. https://arxiv.org/abs/2512.02556 (§1, §4.1)
- xAI (Jul 2025), Grok 4. https://x.ai/news/grok-4
- Villalobos & Atkinson (Epoch, 2023), Trading off compute in training and inference (via research/20 C3)
- Yue et al. (2025), Does RL really incentivize reasoning capacity beyond the base model? (via research/20 C2)

Not found: any primary measurement of the RL gain in effective-compute units across base sizes at a fixed RL share, and
any 2026 lab disclosure of RL share.
