# Effective experiment compute, old vs new split (R2.2 spillover check, player's lab, diagnosis only)

2026-11-26, branch `bal`. No change under `src/`. Probe `.scratch/expc2-probe.ts` in two temporary worktrees (since removed): **old** = HEAD ae14862 with `git revert eb57655` (R2.2 undone, R2.1 harness staff exception kept, so only the split differs); **new** = HEAD ae14862. Forced aifm, refwide, authors2026, `tl-fast/central/slow` of `balance/scans/fixC-step1.json`, seeds 1 and 2 (6 games; 4 at 2028.5, the fast games end at SAR before it). Values are medians of the daily mean over the 91 days from each date (H100e, % of total compute).

## 1. How idle training compute reaches experiments (it is off by default)
- A run draws `poolShare` of the training pool (0.6 for every base run in these games, set by the bot; `RUN_POOL_DEFAULT` in `runs.ts`); the stream takes 0.15 (`STREAM_POOL_SHARE`, `runDesign.ts:124`). `idleTrainingShare` = 1 minus the shares of runs that train today and the stream (`runs.ts:136-140`). A run waiting for setup counts as idle; a finished run frees its share the same day.
- **It flows only if the policy `compute.lendTraining` is on** (`runs.ts:145-147`: `lendTraining ? idleTrainingShare x training pool : 0`). It is added to the experiments pool in `expPoolH100e` (`research.ts:677-679`) and in the research input `c` (`production.ts:116`); the training pool is never reduced, and the loan ends the moment a run trains. The policy is **off by default** (`init.ts:266` has no `lendTraining`; action `actions.ts:~404`, glossary `lendTraining`).
- The other route is Auto-split (`autoSplit.ts:21-50`, default off, `init.ts:266`): it moves idle shares permanently into the listed uses; lent compute is excluded from it.
- **`refwide` never turns either on** (no use of either in `scripts/v2` bots; confirmed at the end of a game: `lendTraining` undefined, `autoSplit.on` false). So in every measured game, and in a default player game, **effective experiment compute = the experiments pool**. The spill is a counterfactual column below. (Stale comment at `research.ts:671-672` says idle stays idle; line 678 adds the loan.)

## 2. Measured (median of 6 games)
| date | split | total H100e | experiments pool | idle training (not spilled) | training used (runs + stream) | effective as played | **if lent** (pool + idle) |
|---|---|---|---|---|---|---|---|
| 2025.5 | old | 1.13M | 58k (5.2%) | 134k (11.9%) | 324k (28.8%) | **5.2%** | 193k (17.1%) |
| 2025.5 | new | 1.13M | 395k (35.1%) | 0.7k (0.1%) | 124k (11.0%) | **35.1%** | 396k (35.1%) |
| 2026.5 | old | 4.14M | 301k (7.3%) | 1.16M (28.0%) | 472k (11.4%) | **7.3%** | 1.46M (35.3%) |
| 2026.5 | new | 4.14M | 1.46M (35.3%) | 277k (6.7%) | 170k (4.1%) | **35.3%** | 1.74M (42.0%) |
| 2027.5 | old | 14.0M | 3.86M (27.5%) | 2.75M (19.6%) | 549k (3.9%) | **27.5%** | 6.61M (47.1%) |
| 2027.5 | new | 14.0M | 5.01M (35.7%) | 1.80M (12.8%) | 354k (2.5%) | **35.7%** | 6.80M (48.5%) |
| 2028.5 | old | 39.9M | 14.26M (35.7%) | 1.91M (4.8%) | 6.28M (15.7%) | **35.7%** | 16.2M (40.5%) |
| 2028.5 | new | 39.9M | 14.26M (35.7%) | 1.94M (4.9%) | 6.24M (15.6%) | **35.7%** | 16.2M (40.6%) |
- Synthetic data pool (separate, ~21-24% in both splits) is not in these columns.
- In 2026-27 the training pool is mostly idle in both splits (the bot runs one base per ~270 days; runs hold 0.6 of the pool): 20-28% of all compute idle in the old split, 7-13% in the new. Nothing uses it unless lend is on.

### Base runs (FLOP, share 0.6 of the training pool each)
| run start | old | new | new / old |
|---|---|---|---|
| d14 (2025.5) | 9.3e26 | 2.5e26 | 0.27 |
| d284 (2026.3) | 2.4e27 | 6.5e26 | 0.27 |
| d554 (2027.0) | 5.2e27 | 1.5e27 | 0.29 |
| d824 (2027.8) | 8.2-8.6e27 | 6.3-6.8e27 | ~0.78 |
| d1094 (2028.5) | 1.7e28 | 1.7e28 | 1.0 |
(The bot raises the training share in 2027-28, so the two splits converge by 2027.8.)

## 3. Comparison with the references
- **AIFM** `experiment_H100e` = 56.1% at 2025.5, 50% after (`input_data.csv`). Per EXPCOMPUTE.md it includes synthetic data, ablations, de-risking and RL tuning; the game files synthetic data (21.3%) separately. So the game target for experiments + synthetic is 56%: **new 35.1% + 21.1% = 56.2%**; old 5.2% + 21.3% = 26.5% (17.1 + 21.3 = 38% even with the spill). At 2027.5 (AIFM 50%): new 35.7 + 23.6 = 59%; old 27.5 + 23.7 = 51%.
- **Epoch** (OpenAI 2024): non-final R&D ~66% of spend, final runs 7-10%. New: experiments + synthetic 56% (+ idle to 2027) against 66%; final-run share 11% pool x 0.6 = 6.6% in use against 7-10%. Old: 40.6% x 0.6 = 24% on the frontier run, 3x Epoch.
- **AIFM `training_H100e`** (frontier run) = 6.9% of total. A run takes 0.6 of the pool, so the pool should be 6.9 / 0.6 = **11.5%**. New: 11%.
- **Real mid-2025 frontier runs** (research/09 line 79, research/12 §0.3 line 79): ~3-5e26 FLOP (Grok 4 ~5e26, GPT-4.5 ~2e26; AI 2027 text 3e26 pretraining, research/02:109). Game first base run: **old 9.3e26** (2-3x above reality, near AI 2027's 1e27 Agent-0 fiction), **new 2.5e26** (inside the 2e26-5e26 band, at its low end).

## 4. Recommendation: (a) keep R2.2
- **Not a double count.** The spill is off by default and never on in the harness, so the old split's effective experiments were 5.2% and 7.3% at 2025.5 and 2026.5, not 17% and 35%. Even with the spill on, the old split gave 17.1% at 2025.5, a third of the AIFM's 56% (with synthetic, 38%).
- **(b) fails:** old effective experiments (5.2%) are 11x below the AIFM; the old base run (9.3e26) is 2-3x above reality.
- **(c) is not needed.** The arithmetic gives the same pair as R2.2: reservation X = 6.9% (AIFM frontier run) / 0.6 (run share) = 11.5%, so 11%; experiments Y = 56% (AIFM) - 21% (synthetic kept separately) = 35%, so 35%. The base run lands at the low edge of the real band (2.5e26 vs 2-5e26); raising X to 15% would give ~3.4e26 but would take the 4 points from experiments (31%, effective + synthetic 52%, still within the AIFM's 50-56%). Optional, not required.
- **Caveat for later:** if the designer turns the lend on by default (or the bot uses it), the new split exceeds the AIFM: pool + synthetic + idle = 64% at 2026.5 and 72% at 2027.5 against 50%. Then lower Y or X so that pool + synthetic + expected idle ≈ 50-56%. As played today the spill is zero, so no change.
- Side finding: the idle training pool is 7-13% of all compute in 2026-27 in the new split (20-28% old), wasted unless lend or Auto-split is on. This is a bot/policy point (`refwide` ignores both policies), not a split point.
