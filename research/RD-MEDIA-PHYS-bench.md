# RD-M01b: MEDIA and PHYS benchmark rows (sources)

Two rows in `src/data/v2/benchmarks.ts` so the MEDIA and PHYS measured levels are fitted from scores (RD-M01), not read
as measured general + the true domain offset. Same convention as the other rows (research/12 §0.5): fit
`score = floor + (ceil − floor)·σ(k_G·(G − m_G))` on model anchors, where G is each model's level on the PatchBench
curve (SWE-bench Verified: GPT-4o 33% → G 26.3, o1 48.9% → 26.9, Claude 3.7 Sonnet 62.3% → 27.5, GPT-5 ≈ 75% → 28.1),
then convert with m_L = 5 + 2·(m_G − 28), k_L = k_G / 2.

## MEDIA: SeeAndTell ↔ MMMU (val)

- Yue et al., "MMMU: A Massive Multi-discipline Multimodal Understanding and Reasoning Benchmark for Expert AGI",
  CVPR 2024, arXiv 2311.16502 (main table): random choice 22.1, frequent choice 26.8; human experts worst / medium /
  best 76.2 / 82.6 / 88.6; GPT-4V 56.8 (val).
- OpenAI, "Learning to reason with LLMs" (Sep 2024), appendix A: MMMU val GPT-4o 69.1, o1 78.2.
- OpenAI, "Introducing GPT-5" (Aug 2025): MMMU 84.2.
- Fit (floor 22, ceil 89): logits 0.86 / 1.65 / 2.56 at G 26.3 / 26.9 / 28.1 → k_G ≈ 1.0, m_G ≈ 25.4 → **mL −0.2, kL 0.5**.
- Stand-ins [D]: ceil 89 = best human expert (label noise caps the score; no lab score above it published). The row
  reads multimodal understanding, not generation: no generation eval found with human baselines and per-model scores
  (preference arenas rank models against each other only). Successor family: MMMU-Pro.

## PHYS: RobotHands ↔ EmbodiedBench EB-Manipulation

- Yang et al., "EmbodiedBench: Comprehensive Benchmarking Multi-modal Large Language Models for Vision-Driven Embodied
  Agents", ICML 2025, arXiv 2502.09560 (v3, main table), EB-Manipulation (low-level manipulation) success %:
  GPT-4o-mini 4.8, Gemini-1.5-Pro 21.1, Claude-3.5-Sonnet 25.4, Claude-3.7-Sonnet 28.5, GPT-4o 28.9.
- Fit: frontier ≈ 28% at G ≈ 27.0 → m_G 27.9 at k_G 1.0 → **mL 4.9, kL 0.5**.
- Stand-ins [D]: k_G 1.0 (the frontier anchors span ≈ 1 G and are flat within noise, so they fix the midpoint, not the
  slope); ceil 100 (no human baseline is published).

## Dangerous flag [D judgement]

Both rows are `dangerous`, so the sandbagging gap (−1.5·SAND) applies to them: synthetic media is misuse-relevant and
physical reach gates autonomous weapons (techs W26 / W27). Without it a sandbagging model would read honest on both.
