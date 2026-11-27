# Experiment compute: game against the AIFM and real labs (player's lab, diagnosis only)

2026-11-26, branch `bal`. No change under `src/` or committed scripts; probes in `.scratch/` (`expc-tab.mjs`, `expc-game.mjs`, `expc-aifm.py`, `expc-aifm2.py`, `expc-marg.ts`). Game rows = medians of the 4 forced games per timeline in `.scratch/presc-tl-*.jsonl` (fixC-step1's `series` has no pools; these are the same forced aifm / refwide / authors2026 runs; 2028.5 fast n = 1). AIFM = `inputs/input_data.csv`, log-interpolated as the game does. FLOP/day = H100e x 3.46e19 (the game's PHI).

## 1. Absolute experiment compute
| date | game exp pool (H100e) | share | game FLOP/day | AIFM `experiment_H100e` | share | AIFM FLOP/day | game / AIFM |
|---|---|---|---|---|---|---|---|
| 2025.5 | 49,024 | 5.1% | 1.7e24 | 539,696 | 56.1% | 1.9e25 | 0.09 |
| 2026.5 | 213,023 | 6.1% | 7.4e24 | 1,752,055 | 50.0% | 6.1e25 | 0.12 |
| 2027.5 | 2,943,530 | 24.2% | 1.0e26 | 6,082,828 | 50.0% | 2.1e26 | 0.48 |
| 2028.5 | 12,620,900 | 35.7% | 4.4e26 | 17,666,918 | 50.0% | 6.1e26 | 0.71 |
- Total compute is identical (forced): 0.96M / 3.5M / 12.2M / 35.3M H100e, same in all three timelines. Experiment compute grows x4.3 / x60 / x257 in the game from 2025.5; x3.2 / x11.3 / x32.7 in the AIFM.
- The game never exceeds the AIFM in absolute terms: it starts 11x lower and closes the gap only by raising its share seven-fold (5.1% -> 35.7%). The ramp is the whole difference.
- Game FLOP/day is nominal; the engine also multiplies it by 10^trainNow (the hardware-efficiency stack).

### Category map at 2025.5 (share of total company compute)
| AIFM column | share | game pools | share |
|---|---|---|---|
| `experiment_H100e` | 56.1% | experiments 5.1% + synthetic data 21.3% + the non-frontier-run part of training (~34 of 40.6) | ~60% |
| `training_H100e` ("instantaneous H100e on the frontier run", `docs/input-series-provenance.md`) | 6.9% | the base run (the game books the whole `training` pool to it) | 40.6% |
| `inference_H100e` (AI labour in R&D) | 5.0% | routine + frontier + engineering agents | 3.1% |
| remainder of `total_ai_company_H100e` (no column) | ~32% | serving 29.5% + safety / monitors 0.4% | ~30% |
- The AIFM's own "total R&D" is training + inference + experiment = 68%; the remainder is customer serving.
- **The 5% start is not apples-to-apples.** The AIFM's experiment line is all R&D that is not the final run (ablations, de-risking, unreleased runs, synthetic data, RL tuning). The game's `SHARE_REF` is AI 2027's usage table (research/02 §1.3), whose "Research experiments" row (4-5%) is narrow: training 40%, synthetic 20% and research automation are separate rows. Game R&D in total (training + synthetic + experiments + agents) is ~70%, as in the AIFM (56 + 7 + 5 = 68%) and Epoch (§3). Only the labels differ: the game files ~34 points of de-risk / experimental runs under "training".
- The training pool does double duty: it sets the base-run FLOP (`frontierFlop` = 0.8 x training share x total x 91 d), and that matches the AIFM's hardware term within 0.15 OOM (FIXC-PRESC §4) despite the 6x larger share. So the research CES sees none of those ~34 points while the base run sees all of them.

## 2. Diminishing returns and marginal value
| | AIFM (`progress_rate.py:27-135`, `ces_functions.py:410-470`) | game (`ces.ts` Xces; `research.ts` experiment stage) |
|---|---|---|
| form | [alpha C^(zeta rho) + (1-alpha) L^rho]^(1/rho) x taste | [u c^(zeta rho) + v l^rho]^(1/rho) x taste, per project, summed over projects |
| discount exponent | `experiment_compute_exponent` zeta, median 0.655 (80%: 0.38-1.08) | zeta from `cesFromAsymptotes`: fast 0.643 / central 0.673 / slow 0.649 (default 0.671) |
| rho | root of La^rho + Ca^rho = 1: -0.155 (80%: -0.32 to -0.10) | same equation: -0.152 / -0.148 / -0.156 |
| weight | alpha fitted at present day so the compute share there = La^rho | u = La^rho = 0.63-0.66 at c = l = 1 (same by construction) |
| anchors | La 15, Ca 1001, slow10 2.8 (medians; sampled per rollout) | authors2026 La 15, Ca 1000, slow10 2.8; `tl-*` sets carry per-timeline draws |
| labour | serial coding labour = humans (x7 by 2028.5 on the prescribed path) x AI, ^ parallel penalty 0.5 | l = (AI multiplier m_EXP)^lam per project (lam 0.51); humans enter as the number of projects (staff x2.1 by 2028.5) |
- **The game has the AIFM discount exponent; alpha and rho are equivalent.** My reconstruction reproduces the rollouts' `experiment_capacity` to 1.000 on all 60 samples.
- d log(research rate) / d log(experiment compute), labour fixed = zeta x compute share of the CES:

| date | AIFM fast / central / slow (median; 80% band) | game fast / central / slow (at the engine's c, l) |
|---|---|---|
| 2025.5 | 0.37 / 0.44 / 0.55 (0.23-0.83) | 0.384 / 0.414 / 0.406 (c = 4.7, l = 1.0) |
| 2026.5 | 0.38 / 0.43 / 0.54 | 0.392 / 0.422 / 0.413 |
| 2027.5 | 0.42 / 0.47 / 0.52 | 0.368 / 0.373 / 0.365 (c = 61-129) |
| 2028.5 | 0.51 / 0.48 / 0.51 | 0.366 / 0.362 / 0.326 (c = 520-1300) |
- Engine check (`.scratch/expc-marg.ts`, `labSpeedRel` at day 3, experiments pool x1.1 / x2 / x4 taken from training): 0.43 / 0.42 / 0.42. **The game's marginal value is not higher: equal at the start, 0.1-0.15 lower by 2028.5** (the AIFM's labour grows with compute and keeps the compute share; the game's does not). Only the experiment stage uses it (ideation needs no compute), so the whole pipeline's elasticity is lower still.
- What differs is the value per point of share: d log R / d share = elasticity / share. At 5% that is 0.41 / 0.051 = 8.0 per unit share; at the AIFM's 56%, 0.44 / 0.56 = 0.8. The ramp to 24.2% by 2027.5 alone is 4.7^0.41 = x1.9 research rate, the same size as the x1.4-1.8 resource excess in FIXC-PRESC §3. Its cost is 5-20 points of a pool that sets only the base-run FLOP.

## 3. Real labs (primary: Epoch AI, from company reports; spend, not FLOP)
- Epoch, "How much does OpenAI spend on R&D compute", https://epoch.ai/data-insights/openai-compute-spend : OpenAI 2024, cloud spend (from The Information / NYT reports; "should not be considered completely reliable"). R&D compute $5.0B: GPT-4.5 final run $0.40B, other released models $0.08B, other R&D (basic research, derisking runs, unreleased models) $4.5B. Inference $1.8B. Of ~$6.8B: R&D 74%, inference 26%, other R&D ~66%, final runs of released models ~7%.
- Epoch (Denain, Wu), "Final training runs account for a minority of R&D compute spending", 23 Mar 2026, https://epoch.ai/gradient-updates/r-and-d-vs-training-compute : final runs are 9.6% of R&D at OpenAI (2024), 22.6% at MiniMax ($141M R&D), 12.3% at Z.ai ($216M). The rest "went to scaling experiments, synthetic data generation, basic research, or other R&D workloads", unreleased models included. Three data points; R&D jobs run at lower utilisation than training.
- Already in the notes: research/12 §0.1, research/09 (lead-lab R&D about 70% of compute, AIFP). AI 2027's table (research/02 §1.3) has experiments 4-5% in 2025 rising to 35% by Q4 2027, training 40%, synthetic 20%; it predates Epoch's finding and is the game's source.
- Reading: about 66% of a real lab's compute is non-final-run R&D (experiments, de-risking, synthetic, unreleased runs) and ~7-10% is the final run. The AIFM's 50-56% matches. The game's 41% "training" plus 5% experiments mislabels most of that.

## Conclusion
- **Likely cause: a start too low, a definition mismatch inherited from AI 2027's usage table.** Excluded: a missing discount (zeta 0.64-0.67 is in Xces), rho / alpha (same asymptote equations), the marginal value (0.41 against 0.44) and units (same H100e, same total). With the game's experiment pool 11x below the AIFM's, any bot that finds a research CES with elasticity 0.4 will move compute in (8.0 per unit share against 0.8), and the ramp (share x7, research x1.9-2.2) is the artefact. The AIFM's flat 50-56% is not an optimum; it is a fixed input, and the real-lab split is near it.
- Proposals (not applied):
  1. Re-split `SHARE_REF` at 2025.5 to the AIFM / Epoch shape: experiments ~35% (AIFM 56% less the 21% the game keeps as synthetic data), training ~11% (the final run; AIFM 7%, Epoch 7-10% of spend), synthetic 21%, agents 3%, serving ~28%, safety 2%. Experiment pool then ~340k H100e at 2025.5 against the AIFM's 540k. Later rows should hold the AIFM's ~50% (synthetic included) instead of AI 2027's rise to 35% on a 5% start.
  2. `frontierFlop` uses the training share, so a smaller pool lowers the base run: re-anchor it (the 1e27 mid-2025 anchor, or ~0.4 x total as the run's sustained budget) and re-check G = 27.627 and the hardware term (FIXC-PRESC §4).
  3. Keep the CES unchanged. No cap on bots' experiment share is needed once the start sits near the reference.
  4. The 0.1-0.15 lower game elasticity by 2028.5 is labour not growing (staff x2.1 against x7.2), FIXC-PRESC item 4.
