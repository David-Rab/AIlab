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
