# Stage 1: forced runs of the player's lab mechanics

Status: lead design for designer review, 2026-11-25. Evidence: [S1-SCOUT.md](S1-SCOUT.md). Decisions: [SCENARIOS.md](SCENARIOS.md).

## Goal
Check whether the game's capability mechanics, fed the same inputs as the AI Futures Model (AIFM), produce the AIFM's outputs in each timeline: horizon, research speed-up, effective compute and milestone dates. There are no bots and no player choices yet. The economy is cut out (compute is prescribed), so the runaway loop can't hide errors. The loops are then closed one at a time, and each loop's gain is measured.

## What is forced
- **The player's lab, not the NPC leader lab.** Calibration exists for the player's experience. The scout found the NPC leader lab uses a different, simpler research path (`rivalModel.ts` `evalRival`), so the harness runs the **player's** lab:
  - compute stubbed like T1 (`scripts/v2/lib.ts:65` `refComputeStub`: cash unlimited, compute = a prescribed path);
  - a **fixed allocation policy**, with no decisions: a fixed research list, fixed run cadence and fixed compute shares. It starts as RefBot's current settings plus the research ideas real labs plausibly pursue (scan pass 1). Stage 2 replaces it with the sourced realistic-lab policy.
- **NPC labs:** passive, at middle settings.
- **Inputs from the AIFM projection** (`aifm-runs/repo/inputs/input_data.csv`):
  - total AI-company compute: same unit as the game's `refTotal`; both are 0.96e6 H100e at 2025.5;
  - human researchers: matched as growth relative to 2025.5, since the absolute definitions differ.
- **Units:** the AIFM's compute-by-use shares don't match the game's pools (experiments 63% vs 5%). Compare growth relative to a reference date, never raw splits. Keep the game's own split.

## Steps
| ID | Step | Output |
|---|---|---|
| S1.1 | **Harness `scripts/v2/forced.ts`:** the player's lab with prescribed inputs; records yearly G, h50/h80, research speed-up (`labSpeedRel`), effective compute and milestone days. Runs N seeds × 3 timelines, in parallel. | records like balrun's, plus series |
| S1.2 | **Open-loop comparison** against the SAR-split groups: medians and quartiles per checkpoint, in units of the group's middle half. Dashboard: "game, forced" lines overlaid on the Scenarios charts, plus a pass/miss grid. | where the mechanics match or miss |
| S1.3 | **Close the loops one at a time:** (a) capability → AI labour → research speed; (b) research → ideas → recipe; (c) cross-lab diffusion and distillation; then, in Stage 2, (d) revenue → investment → compute. For each loop, nudge its input by +10% and measure how much each output moves (the loop gain). | which loop drives the runaway, and how strongly |
| S1.4 | **Distributions:** the game's `sampled` world varies only 2 things, against about 25 parameters in the AIFM. Build a sampler that maps the AIFM's sampled parameters to the game's, and compare quantiles. Done after S1.2, which shows which parameters matter. | spread matches or not |

## Engine hooks
These are default-off flags with no effect on normal play, proven by the 24-game fingerprint:
- pin the research mix (`production.ts:274-275`);
- skip idea adoption and diffusion (`production.ts:286`, `:329`), for the isolated open-loop step only;
- series overrides for `refTotal` (compute path) and `hRef` (staff path).

## Mismatches already known (S1 will measure them; any fix is a designer decision)
1. **Horizon law:** the game's h50 = 203 min × 4.2^(G − G0), a fixed slope. The AIFM's horizon growth can speed up (superexponential). If the game can't follow the AIFM paths, that's a mechanism question.
2. **SC definition:** the game's SC corresponds to the AIFM's "AI 2027 SC", which is about the AC date + 0.5 years, not the AC date. Use that mapping in comparisons.
3. **Compute path after 2032** for the `aifm` presets extrapolates at 1.64×/yr against the CSV's 1.47×/yr, about 4× too high by 2045. `SHARE_REF` freezes after 2027.875. The harness prescribes compute, so Stage 1 isn't affected; the fix belongs in the scenario setup (Stage 2).
4. **No TED-AI** in the game. Skip it.

## Speed
About 3–8 s per run for 2025–2045. 1,000 runs on 8 workers take 10–20 minutes.
