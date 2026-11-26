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

## Designer decisions (2026-11-25)
1. **Force the player's lab:** yes.
2. **Default-off engine hooks**, proven by fingerprint: yes.
3. **Fixed Stage 1 policy** = RefBot's current settings plus the research ideas real labs plausibly pursue: yes.

## Designer decision (2026-11-26): takeoff fixes A, B, C approved
From [S1-TAKEOFF-DIAG.md](S1-TAKEOFF-DIAG.md):
- **A.** A ceiling on AI research taste, as in the AIFM (m2b^(1+limit)).
- **B.** Idea generation goes through the experiment-compute bottleneck (or is capped).
- **C.** Feedback settings (r, dBM, taste spread) are scenario-specific, fitted per timeline to the AIFM group's takeoff gaps.

D (release lumps) waits until after A–C. E (rival distillation) waits for the NPC calibration. These are mechanism changes: behaviour changes on purpose, and the fingerprint baseline is re-recorded after each one.
- **Revision (designer, 2026-11-26, corrected):** fix B is replaced. The game keeps its structure: taste reaches research through ideation, a more tangible concept for the player, and labour and compute run the experiments. Ideation gets no compute requirement. **Requirement: the game's taste and ideation together must have the same effect on research progress as the AIFM's taste multiplier**, across the capability range (today → SC → takeoff). **Check:** a component-level curve comparison: at each capability level, the AIFM aggregate taste multiplier vs the game's combined taste-through-ideation multiplier on research rate. The AIFM curve saturates toward its ceiling (fix A), so the combined game curve must too. If ideation adds its own compounding, calibrate the ideation side until the curves match (part of fix C).

## Designer decision (2026-11-26): taste as a human/AI mixture (fix B, final)
1. **Taste sets idea quality only (option A).** The ideation rate (how many candidates) no longer includes taste. Quantity comes from scientists and AI help on ideas.
2. **Idea quality comes from a mixture:** a share P of idea labour from humans (the team's human taste distribution) and 1−P from AI (the AI's taste distribution, under the fix A ceiling), weighted by labour share. This replaces the E[max(human, AI)] "free filter".
   - Early-game AI adds mostly mediocre candidates. It helps through more candidates and picking the best, not through taste.
3. **Judging noise when picking is set by the same mixture.**
4. **Calibration:** the combined research effect must still match the AIFM taste band. Selection and labour strength are tuned in fix C.

Player focus: the player's research pipeline (`models/research.ts`) is the target. Shared helpers keep one formula everywhere for consistency.

## Designer decisions (2026-11-26)
- **Safety research is mechanically the same as capabilities research.** It applies the same taste rule, and ideally uses the same code so the two can't drift.
- **Unlock projects stay as they are:** taste is inert for them.
- **Then fix C.**

## Fix C method (designer, 2026-11-26)
Take each timeline's game settings from **its own AIFM group's median parameter draws**, translated into game terms. Fit only what doesn't translate cleanly, and keep fitted values within the AIFM ranges. This is the preferred method in general, wherever possible.

## Designer decisions (2026-11-26), after FIXC-PRESC
- **Diminishing returns for idea projects:** tree projects and safety projects follow the same law as the lines, ideally through shared code. Within a project, new ideas get harder and harder.
- **Initial software-progress rate per timeline,** from the AIFM groups. Open point (lead): it must not break the shared 2025–26 path; see the note below.
- **Experiment compute:** an agent is checking absolute vs share, the AIFM discount exponent, and real-lab splits (EXPCOMPUTE.md).
- **Hiring: no harness-only forcing ("harness only things are dangerous").** The game's hiring mechanics should become a market: faster hiring possible, salaries rising for everyone at the marginal wage, quality of available hires falling as the pool depletes. Until then, the staff mismatch against the AIFM's L_HUMAN path is a known deviation in Stage 1.

Lead note on the software rate: the AIFM groups start at different rates (1.11 / 1.05 / 0.74 OOM/yr), yet all match the measured METR horizon, because the AIFM's horizon law varies per run. The game's horizon is a fixed function of G, so a lower software rate before late 2026 would put slow's 2026 horizon below the measured value. Proposal: apply the per-timeline rate from late 2026 onward.
