# Worlds: setup axes and the hidden world

Gap analysis of the new-game settings against the designer's goal: worlds the player can pick by axis (capabilities, safety, economy, China, rivals, government, population), different start dates, any actor. Read at master cd352aa. **[V]** = verified in code, **[J]** = my judgement.

## 1. What each setting actually does

| Setting (Setup.tsx) | What the label promises | What the engine does [V] | Mismatches and dead parts [V] |
|---|---|---|---|
| **Start as** (4 types) | Company, difficulty tag, start values | Sets lag, teams, cash, compute, board, and adds the leader lab (starts.ts:68-169, init.ts:141-251) | Spinout and Big-tech are both tagged "Impossible", Challenger "Hard", Leader "Easy" (starts.ts:70,88,110,131). It is the only setting with a difficulty label. |
| **Baseline** Classic / Reality | Tooltip: "Start state from 2025-26 reporting". Data desc: "Calibrated to measured data through 2026 (METR horizons, polls, multi-lab frontier)" (world.ts:276-279) | Start numbers (world.ts:271/281), leader roster, compute and finance (init.ts:162,226,247-251), chip stock 13M/14M (market.ts:55), public meters (public.ts:16), revenue plan (plan.ts:316), robot cap (robots.ts:95). Rival start gap ×0.3 under Reality (rivals.ts:81). | It does **not** touch METR horizons or the timeline (`_baseline` is unused in makeWorld, world.ts:153). Cash, revenue, valuation and staff matter only for the Leader start. Start date is the same for both (2025-07-01). |
| **World** (5) | AI 2027 / Authors' 2026 / Fast / Skeptic / Unknown ("drawn at random; revealed at the end") | v2 reads only `prod`, `v3`, `chinaEfficiency`, `doomThreshold` and `label` from the timeline, plus `aifm` and `computeGrowth` through refCapCompute and globalCompute. Per preset: V3_CAL G_SC, Δ_bm, r, sd_SC (workTypes.ts:311-320); Authors' gets La 15 / slow10 2.8 / m2b 3.7 (calibration.ts:54); `aifm` (Authors', Fast) switches the leader-lab compute path to AIFM's (world.ts:317-318, used by rivals.ts:146,297). | **Unknown = AI 2027 plus one random number.** V3_CAL.sampled copies ai2027 (workTypes.ts:319). The only real draw is La ~ 1+LN80(1,200) (hidden.ts:42). The ~20 v1 Lifland draws in makeWorld (world.ts:182-224) are never read: h0, hSC, T, growth, decay, g0, cs, pEx, sEx, G, p0 and computeElasticity have no v2 readers (grep). `computeGrowth` feeds only the datacentre power-share readout (macro.ts:48). `neuraleseBoost` and `sarSpeed` are dead. `chinaEfficiency` is 1 in every world. The player's believed production uses the World choice (believed.ts:27), so the World is public knowledge, except La under Unknown. |
| **Alignment difficulty** Unknown / Easy / Medium / Hard | No tooltips | The six latents are always N(0,1). Easy/Hard shift benignGeneralization by +0.8/−0.8 and schemingDefault the other way (hidden.ts:85-87). That carries into difficultyMult (clamped 0.6-1.65, hidden.ts:88), agenda efficacy, edge weights and U-mode propensity. Hard also makes the "survive" benchmark harder (benchmarks.ts:56,123,165). Under Unknown, doomThreshold ~ U(0.3, 0.5); otherwise it is 0.4 (world.ts:228). The risk readout prior follows the same rule (lossRisk.ts:68). | Unknown and Medium differ only in the threshold spread, so "Unknown" is barely more unknown than Medium. Easy is still random (latents N(±0.8,1)). The v1 `alignDifficulty` (world.ts:227) is read nowhere in the engine. EndScreen uses it only as a glossary key (EndScreen.tsx:626). Tolerance noise, method scale and organism realism are seed hashes that no setting moves (hidden.ts:142). |
| **Economy** Unknown / Normal / Fast diffusion / Gated | Normal "Standard diffusion frictions"; Gated "Strong frictions: law, trust, integration" | ECON_PRESETS (sectors.ts:89-93): normal diffMult 0.4, friction ×1.5 (slowest); ai2027 1.0/1.0; gate 1.5/0.6, robot floor 0.25 y (fastest). Unknown draws 35/45/20 (hidden.ts:119). | **The labels are backwards.** "Normal" is Normal Technology, the slow high-friction world. "Gated" is Epoch's GATE explosive world, the fastest (research/16 l.26). Default: econ follows World only for ai2027 (init.ts:67). |
| **Government** (5 + Realistic) | Personality | accel, security, reg, hawk, natThreshold, lag read (gov.ts:23,113-154,230). Ids hard-coded in rules (actions.ts:60,205; gov.ts:214,221,265). | `transactional` and `pollSensitivity` have 0 readers. |
| **Public** (5 + Realistic) | Personality | halfLife, jobs, xrisk, mobilization read (public.ts:36-52) | `shock` and `benefit` unread (the `.benefit` hits are tech effects). |
| **China** (6 + Realistic) | A fixed personality | Picks the start weights: 0.4 × prior + 0.6 on the pick (china.ts:75). The weights drift in play (china.ts:257). Blended params feed theft, treaty, taiwan, hawk, centralize (china.ts:156-297). | Picking "Centralized Sprint" gives about a 64% blend, not that China. `openSource` is blended but never read. `efficiency` is 1 for all. |
| **Rivals** (5 + Realistic) and **Rival labs** 3/4 | One archetype for all rivals | Archetype sets compute ×, gap, staff, finance, tools, lobby, openness, release cadence (rivals.ts:79-112,249-291). Realistic adds ±0.15 posture noise (hidden.ts:128). | A fixed archetype makes every rival the same lab. The count excludes the leader lab, which non-leader starts add (init.ts:290), so Challenger plays 5 US labs. |
| **Governance** (Leader only) | Board type | initialBoard / initialFinance (init.ts:247-248) | For other starts the start sets it. This is company type, not world. |
| **Storyteller** | Pacing | Director limits and multiplier (director.ts:79-92) | Paces events only; not a world. (The count of 13 events was not re-verified.) |
| **Tutorial, name, seed** | Options | | Not world settings. |

## 2. The designer's axes against current coverage

| Axis | Covered by | State [V] | What it should be as a world parameter [J], with source ranges |
|---|---|---|---|
| **Capabilities** (how hard SC/ASI is; returns to research) | World | Point presets only. Unknown varies only La. | G_SC, r, Δ_bm, sd_SC, La sampled from AIFM/Lifland distributions: research/03 §1.4-1.5 (15 presets and a "Surprise me" mixture), research/20, research/13 §1.4, workTypes.ts:290-310 notes. |
| **Compute growth** | Bundled in World (`aifm` flag) | No separate axis. Fab and market growth are fixed (market.ts:106). | Global stock growth 1.8-2.5×/yr and the leader path (AI 2027 3.4×/yr vs AIFM schedule): research/02 §1.1, research/15, world.ts:305-322. Independent of capabilities in the sources: the AIFM vs AI 2027 compute schedules differ while taste and returns are separate parameters. |
| **Safety** | Alignment | Two latents shifted. The threshold is random only under Unknown. | Latent means (λ1-λ6), doom threshold, method scale, organism realism: research/04, 05, 14, CAL-safety-sources, RD-SR24. |
| **Economy** | Economy | Works, but the labels are inverted | Normal Tech / AI 2027 / GATE: research/16 §4.6, research/22, RD-X04r. |
| **China** | China + Baseline (chinaShare, gap) | Works as a soft prior | Presets and weights: research/10 §1.2 (supersedes 07). |
| **Rivals** | Rivals, count, Baseline gap scale | Uniform or random | Mix of archetypes: research/07 §1.3, research/18 §0. |
| **Government** | Government | 6/8 fields live | research/07 §1.1, research/08. |
| **Population** | Public + Baseline meters | 4/6 fields live | research/07 §1.2, research/09. |
| **Start date / era** | Baseline (a state set, not a date); Nov 2026 is "to come" | Classic mixes "what the scenario assumed" with "start numbers" | One sourced state per date: Classic = Apr 2025 text; Reality = 2025-26 data; Nov 2026 targets exist (research/16 l.433, research/18 ECI to Nov 2026). |
| **Company type** | Start + Governance | Works | research/18. |
| **Difficulty** | Only the Start tag | World harshness is unlabelled | See §3. |

Duplications [V]: the rival frontier gap is set by Baseline (×0.3) and Rivals (gapYears). China's starting position is set by Baseline (chinaGapOom 0.72 in both) and the China preset. Missing: an independent compute-growth axis, a real capabilities draw, post-ASI parameters, start dates.

## 3. Consolidation proposal [J]

**One screen: Scenario, then Start, then (optional) Custom.**

| Scenario | Capabilities | Compute | Safety | Economy | China | Rivals / Gov / Public | Era |
|---|---|---|---|---|---|---|---|
| **AI 2027** | ai2027 | AI 2027 3.4×/yr | sampled | AI 2027 | Centralized Sprint | Realistic / Hawk / Realistic | Classic (Jul 2025) |
| **Authors' 2026** | authors2026 | AIFM | sampled | sampled | Realistic | Realistic | Reality |
| **Fast takeoff** | fast | AIFM | sampled | GATE | Realistic | Realistic | Reality |
| **Skeptic** | slow | AI 2027 slow (1.8×) | sampled | Normal Tech | Realistic | Realistic | Reality |
| **Unknown** | family drawn by research/03 §1.5 mixture, params drawn | drawn | drawn | drawn | Realistic | Realistic | Reality |

- **Custom** opens one row per axis. Each row offers "As scenario", "Unknown" (drawn, revealed at the end) or named values with sourced tooltips. Every axis should have a real "Unknown", including capabilities.
- **Cut:** the v1 timeline fields with no reader, `alignDifficulty`, and the dead preset fields (or wire each to a sourced mechanism). Medium alignment becomes "Unknown" with a centred prior, or Unknown samples the shift.
- **Merge:** Baseline into the era/start date of the scenario. Rival count into Rivals, shown as the total of US labs including the leader lab. Governance into Start (Leader picks a board as a start option).
- **Move:** Storyteller and Tutorial go to Options, since they are not world settings. Rename the Economy values to Slow (Normal Technology) / Reference (AI 2027) / Explosive (GATE).
- **Difficulty:** keep two separate things. Start = your position (the Easy-to-Impossible tag). Scenario = how unforgiving the world is. Show a readout derived from the axis values (timeline speed, alignment, China hawkishness) rather than setting a difficulty number, so outcomes stay emergent. Do not tune the world to hit a difficulty.
- **Other actors and start dates:** the world (era plus axis values) is independent of who you play. Role picks the actor (lab CEO, government, China, the AI); start type picks a variant inside the role. A start date is a sourced state snapshot plus the history the sampler must condition on (research/03 §1.5: reject draws inconsistent with the observed horizons). Playing past ASI needs the capabilities axis to carry takeoff and post-ASI parameters (G2/G3 or AIFM ASI timing), which today are drawn and discarded.

## 4. Designer questions

1. Should the World be public knowledge (as now, via believed production), or should named scenarios be "what the world believes" with the true parameters drawn near them?
2. Should "Unknown" capabilities draw from the full Lifland/AIFM distributions, including slow and never-SC tails (research/03 #14)? That needs the slow-horizon mechanism the Skeptic stand-in lacks (workTypes.ts:315).
3. Should compute growth be its own axis, separate from capabilities?
4. Should picking an actor preset fix that actor (as the label implies), or stay a 60/40 prior that drifts, as China does now?
5. Should a fixed Rivals pick make all rivals identical, or set a mix?
6. Is the Baseline a start date (Apr 2025 text vs 2025-26 data), and is Nov 2026 the next start to build?
7. Should difficulty be shown for scenarios at all, or only for starts?
8. Should dead preset fields (transactional, pollSensitivity, shock, benefit, openSource) be cut or wired to mechanisms?
