# Calibration scenarios: decisions

Designer decisions, 2026-11-25. Evidence base: [B6-PREP.md](B6-PREP.md).

## The grid
- **Shared history, to late 2026 (the present).** It must hold in every cell, including one shared start state. It covers measured data only: METR horizon levels, chip output growth, 2026 hyperscaler capex, lab revenue curves, measured safety-paper effects, and so on.
- **Three timelines.** Each bundles capabilities, takeoff and compute:
  - **fast**: anchored to AI 2027;
  - **central**: anchored to the AI Futures authors' 2026 model run;
  - **slow**: anchored to a sourced sceptic view (source still to be found; today's `slow` preset is unsourced).

  Each timeline has dated checkpoints with bands from its source: horizon length, compute, and the SC/SAR/SIAR/ASI dates.
- **Alignment is a difficulty setting** with five levels: beginner, easy, normal, hard, impossible. Three are tested first (proposed: easy, normal, hard). It crosses all three timelines, giving 3 × 3 = 9 cells to start.
  - History safety effects hold at every level.
  - The levels differ in the unknowns: the latent shift and the threshold.
  - Each level is calibrated by a gameplay band, the strongest bot's win rate, which the designer sets per level.
- **Fixed at one middle-of-the-road setting, minimal effort:** China/geopolitics, government/public posture and adoption/diffusion. Rivals stay as they are.

## Principles
- **World calibration uses the realistic leader lab** (the frontier the sources describe), not RefBot.
- **Difficulty is measured with the strongest bot found** (the scan, then a search).
- **Outcomes stay emergent:** a missed checkpoint means a missing or mis-tuned sourced mechanism, never a forcing rule.
- **Start small, expand later.**

## Open technical point
The game starts mid-2025, so about 1.4 years of every game is history. The timelines must agree until late 2026. Either a timeline's parameters take effect only after the present, or they are chosen so every timeline passes through the same 2025–26 checkpoints. Today the presets already diverge in 2026 (e.g. `slow` uses a 7-month horizon doubling against the measured ~4.2). The spec draft (SC1) says which parameters this affects.

## Next
- **SC1 (draft for designer review):** the checkpoint spec. Shared history targets with sources; per-timeline checkpoints with bands; the middle settings for China and adoption; candidate sceptic sources; the parameters that set each alignment level; and the open technical point above.

## Designer decisions, round 2 (2026-11-25)
- **All timelines share the 2025–26 path and diverge only after 2026.** Every 2026 value that came from a forecast (AI 2027) is replaced by measured data.
- **Middle settings accepted:** China `fastfollower`, government `dealmaker`, public `anxious`, adoption (econ) `ai2027`.
- **Leaning, not yet decided:**
  - fast = the AI 2027 preset;
  - central = the AI Futures authors' all-things-considered view (superhuman coder about 2030–2032);
  - slow = AI 2040.
- **Lead's notes on the leaning:**
  - AI 2040 ("Plan A", AI Futures Project) is a *recommendation* scenario. Its superintelligence date of 2040 comes from decisive US/China government action; the authors say it would have arrived about 2030 without that action. As a slow *timeline* it would bake a policy outcome into world physics.
  - Proposal: generate all three timelines from the public AI Futures Model (github AI-Futures-Project/aifm-public; used before at commit 1c40ecdb) with documented settings:
    - fast = Daniel's configuration;
    - central = Eli's configuration (or settings that land in the all-things-considered 2030–32 range);
    - slow = sceptic settings (pure-exponential horizon trend and low returns, from the published ranges).

    Use AI 2040's dates as a comparison only.

## Designer decisions, round 3 (2026-11-25)
- **AI 2040 is set aside:** its delay is policy, not technical slowness.
- **All three timelines come from the AI Futures Model**, tuned so the superhuman/automated coder median lands around **2027 (fast), 2031 (central) and 2034 (slow)**. Final choices come after the designer sees the distributions.
- **Next:** run the model (aifm-public, newest commit) after the RefBot scan finishes; extract the distributions per timeline; show them on the dashboard's Scenarios tab.

## Designer decision, round 4 (2026-11-25): scope down alignment
- Alignment is treated as nearly independent of the capability timeline (apart from AI-assisted alignment, which the game models through its own mechanisms). **For now, calibration uses one fixed alignment difficulty: central, leaning hard.**
- **Lead's choice for that setting:**
  - latent shift **-0.4**, halfway between today's medium (0) and hard (-0.8);
  - loss-of-control threshold **fixed at 0.4**, not drawn, so it adds no noise.

  It is a designer setting, not a sourced value, and is easy to change.
- **The calibration grid is 3 timelines × 1 alignment setting.** The five difficulty levels come back later as a difficulty-setting task.

## Designer clarification (2026-11-25): bots
- **A bot's only goal is to win within the given world.** It never slows itself or avoids research to match a calibration target.
- **The world is calibrated against the realistic leader lab (non-player actors), never against a bot.** RefBot loses its calibration role and becomes the starting point for the strong-bot search.

## Designer decisions, round 5 (2026-11-25): timelines as percentiles of one forecast
- **Use Eli's published beliefs, unchanged:** the AIFM config `sampling_config_q2_eli.yaml` at commit 1c40ecdb, no tweaks.
- **Run 3,000 samples.** Timelines are the 25th, 50th and 75th percentiles of the automated-coder date: **fast = p25, central = p50, slow = p75**.
  - Each timeline is the cluster of runs whose AC date falls within ±5 percentile points of its percentile (p20–30, p45–55, p70–80; about 300 runs each).
  - The cluster's own medians and quartiles of every quantity are the benchmarks.
- **Only medians and quartiles are used,** not tails.
- **Fewer failed runs:** find out why samples fail or time out, and fix what's fixable (timeouts, worker load). Report the rest.
- **Dashboard time axis extends to 2060.**
- This replaces the round-3 tuned configs (Daniel/Eli tweaks); those runs stay on disk for reference.

## Round 6 (2026-11-25): designer questions and lead proposals
- **The game has no time cap:** it plays until an ending, so slow-world years to ~2040+ are played and their benchmarks matter.
- **AIFM inputs are fixed author projections:** human researchers, inference, experiment, training, all-AI-company and world compute. They don't react to model strength.
- **Designer:** calibration exists to make the *player's* outcomes realistic. NPCs (China, rivals, government) don't matter for now; they stay at the middle settings.
- **Lead proposal (pending designer OK):** calibrate the world with a **sourced realistic-lab reference policy running on the player's own mechanics** (RefBot rebuilt with sourced choices), not against the NPC leader lab, whose internals differ. The strong bot (plays to win) measures difficulty.
- **Pending designer choice:** how to split the 3,000 Eli runs into scenarios. Options: by coder date, by SAR date, or a coder × takeoff matrix. A comparison view is being built (SC9).

## Round 7 (2026-11-25): designer notes
- **The strong bot will likely be weaker than an average human player.** So the gap between the strong bot and the realistic-lab policy is a *lower bound* on a human's advantage, and the allowed gap must be small; otherwise humans face no challenge. A big gap means exploits, fixed in mechanisms.
- **Stage 1 (forced runs) is especially important:** the game has a built-in runaway loop (compute → research → better models → more money and better research → more compute) that is delicate.
- **Distributions matter, not just averages.**
- **Lead plan for Stage 1:**
  - first open-loop: inputs fed from the AIFM projections;
  - then close the loops one at a time, measuring each loop's gain (how much a perturbation compounds);
  - compare the game's *sampled* distributions with the AIFM groups by quantiles.

## Round 8 (2026-11-25): split chosen
- **Timelines = the SAR-date split of Eli's 3,000 unchanged AIFM runs:** fast = SAR percentiles 20–30, central = 45–55, slow = 70–80.
- **Group medians (AC / SAR / ASI):** fast 2027.9 / 2028.4 / 2029.8; central 2029.7 / 2030.6 / 2033.2; slow 2034.8 / 2037.6 / 2046.5.
- The coder × takeoff matrix stays on the dashboard for later variant worlds.
