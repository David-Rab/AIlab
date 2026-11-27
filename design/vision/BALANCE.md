# Balance: bot competence, targets, and what to calibrate against

Scope: the medium-term "better balance" item. Read from code at cd352aa (`vision` = master). **[F]** = fact verified in code or docs; **[J]** = my judgement.

## 1. Where bot competence leaks into balance

Two layers, and both read a hand-written bot.

| Constant / measure | Fitted against | Depends on unsourced bot choices? |
|---|---|---|
| `V3_CAL.gSC` (ai2027, fast), `dBM`/`sdSC` history (src/data/v2/workTypes.ts:311-321) | T1: RefBot median SC/SAR/SIAR/ASI over 20 seeds (scripts/v2/calscan.ts header) | **Yes [F].** The refit log (workTypes.ts:200-310) shows refits caused purely by RefBot behaviour changes: "F5 refit (RefBot's 'compete' release policy changes its run, eval and research-engineer load…)", "F5 cheap tier… ai2027 SC +0.074 y", M11 "RefBot's API cheap-tier distil and its evals are gone, so its run cadence and draws moved". F4: "11 of 20 seeds wait for the B4 release on day 700 because P08… comes late or fails", which is a property of the bot's fixed plan. |
| `gSC` authors2026 | AIFM run, CAL2-T (workTypes.ts:300-310) | **No [F].** Sourced, not fitted. That makes its failing SAR/SIAR/ASI (design/RD-AUDIT/CAL2.md:40) real information. |
| `gSC` slow = 38.3 | stated stand-in (workTypes.ts:316-318) | Partly (it's set so RefBot's SC lands in 2034-35). |
| `FITTED_EFFORT_TM` P05/P07/P08/P17 (src/data/v2/tree.ts:115) | "the rate RefBot's early projects fit to" (tree.ts:103) | **Yes [F].** Research cost is fitted to RefBot's staffing (`REF_IDEA_TEAMS = 3`, bots/ref.ts:95). |
| `DIFFICULTY_SCALE = 1` (src/engine/v2/world/hidden.ts:20-22) | "1.4 hurt the mixed bot… 1.2 pushed RefBot past S4" | **Yes [F].** Both reasons are bot outcomes. |
| S4 "RefBot P_mis 0.40–0.80" (CAL2.md:84) | RefBot's safety play | **Yes [F].** |
| §7.4 criteria (design/V2-SPEC.md:2233-2240) | race / safe / mixed bots | **Yes [F].** "Mixed ≥ 30%" pins the game's difficulty to a heuristic bot. |
| Knobs 3, 4, 6 (rival aggressiveness, China efficiency, investor κ; V2-SPEC.md:2242-2248) | tuned until the bots pass | **Yes [F].** It also conflicts with "never a forcing rule" [J]. |
| Start labels (src/data/v2/starts.ts:20-24) | best of 5 fixed bots | **Yes [F].** Big tech and spinout are "Impossible" at 0/200 (PROGRESS.md ~:740). The bots only have small follower tweaks (ref.ts:105-107, common.ts `sizedTarget`), so [J] this probably measures the bots, not the starts. |
| T1 compute, split, headcount | refTotal stub, shareRef, H_ref | No, sourced [F] (ref.ts:4-5; calscan "reference compute stub"). |

**What a skilled player sees if the reference bot is weak [J].** When a fitted threshold (gSC, effort TM) absorbs bot weakness, the world is easier than it should be by exactly the bot's mistakes.
- A player who researches what RefBot never touches reaches SC before 2027.24. That includes P24 (≈ +1 OOM, tree.ts:156), P09, P11, P16, P21, P18 and P10.
- So does a player who sizes runs better or reopens failed ideas at once rather than after 180 days (ref.ts:54: "the player can reopen at once").
- Rivals are only partly tied to RefBot's choices. They take the reference split, base cadence, run share and tokens per parameter (rivalModel.ts:32, data/v2/rivalModel.ts:19-24). But they research their own list, `RIVAL_IDEA_IDS = P05, P08, P09, P11, P16, P22, P24`, cheapest first (rivalModel.ts:493-500). **There is direct evidence of the gap [F]:** the simulated leader lab (T1L) reaches SC on day 576, while RefBot (T1) reaches it on day 623 against a target of 638 (CAL2.md:39,43). The aggregate lab on the same inputs beats RefBot by about 2 months, and every T1L row fails "early".

## 2. How competent are the bots? (all judgement, from reading)

**RefBot (src/engine/v2/bots/ref.ts)**
- Fixed research list `REF_TREE` (P07, P05, P08, rl.mlResearch, P17; :79-85), gated on v2 display levels (`GATE_OOM` :68-73). It never researches P24, P09, P11, P16, P18, P21 or P10, even though the rivals adopt several of these.
- Fixed run design: a base every 270 days (:100), 121 days on 60% of the pool (:105, :406), a post-train every 42 days on 50% (:114, :433), students at half size (:110). The run size never responds to the marginal value of compute.
- Research lines use fixed weights (`DEFAULT_LINES`, data/v2/research.ts:16-17), with one saturation rule for RL (:383-389).
- Release rule: keep a fixed 0.3 OOM lead (:556). It sells only Chat, API and Enterprise (:119; never Vetted, Government or Trusted). The cheap tier is off by default (:470).
- A failed idea waits 180 days before it is reopened (:54).
- Reasonable as a *replay* of a sourced lab. Not a strong player.

**Mixed bot (src/engine/v2/bots/mixed.ts), which sets the difficulty**
- Arbitrary thresholds: latent reasoning only if a posterior mean is above 0.6 (:35); safety compute moves by +3 / −1 points within 3–12% (:43); 12 science teams (:17); a "lottery" line chosen once on day 0 (:16, :52).
- Research and runs are RefBot's (`refPlay`, :70), so it inherits all the gaps above, and its finance is the reference autopilot (finance/plan.ts:62).
- Most events are answered by fixed labels (:97-104) and do not read the state. Exceptions: the E32 merger rule and the tag fallback.
- Race, safe and capex2x are deliberate caricatures (fine as extremes). For example, capex2x goes insolvent in 93.5% of games (PROGRESS.md ~:725), which makes it a poor probe of whether money binds.

## 3. Measuring and raising bot competence

**Runtime facts [F]:**
- A tick is 3.7–4.1 ms per game-day (PROGRESS.md:17).
- Bot games end around day 300–1450 (PROGRESS.md ~:722-727).
- `scripts/v2/bots.ts` runs in a single process (loop at :51-57, no workers). `calscan.ts` already has workers and a simulation cache (header).
- The machine has 12 logical cores.

**Estimate [J]:** about 4–6 s per game, i.e. ~12 games/min in one process or ~100/min on 10 workers. Win-rate noise: ±8 pp at 40 seeds and ±3.5 pp at 200 seeds. Always compare policies on the same seeds (paired), which cuts the noise a lot.

| Method | What it tells you | Cost (10 workers) | Feasible now? |
|---|---|---|---|
| A. One-at-a-time perturbation of each unsourced choice (~15 choices × 2 directions × 40 paired seeds) | Which choices are clearly suboptimal; how flat the landscape is | ~1,200 games ≈ 12–20 min | Yes, once bots.ts gets workers (~0.5 day; reuse calscan's pool) |
| B. Parameterised policy + search (CMA-ES or random search, ~10–20 parameters, population 12 × 30 generations × 40 seeds) | A "best found" policy; difficulty measured against it | ~14k games ≈ 2–3 h; run overnight, not in CI | Needs a policy whose knobs live in one parameter object (~2–3 days) |
| C. Best-response checks: hold the best policy, then switch one lever to its extreme (e.g. everything into capabilities, never release, max safety) | Dominant strategies / exploits; whether race or safe beats the mixture | ~10 × 200 games ≈ 20 min | Yes, after B |
| D. Human playtest comparison | Whether people beat the searched policy (if they do, the search is weak or the UI exposes a lever the policy lacks) | Designer time | Yes; needs a run log and score export |

Missing infrastructure:
- Workers in bots.ts.
- A single policy-parameter interface.
- Common-random-number seed sets.
- A fast-forward mode with no UI or recording (record.ts runs weekly samples).

## 4. Principle proposal

**Two policies, two jobs.**
1. **Calibrate the world against the reference policy**, which models what real labs actually do. Every reference choice is sourced or marked [D]. This includes which paradigms labs pursue, run cadence, and release behaviour. The world's fitted constants (gSC and the like) should come from outside models (as CAL2-T did with AIFM) and not be fitted to a bot.
2. **Measure difficulty against the best policy found** (method B), never a hand-written heuristic. Labels: best-found win rate ≥ 30% Easy, and so on.
3. **The headroom (best minus reference) is a check in its own right.**
   - Real frontier labs are strong optimisers on capabilities. If the best policy reaches SC 2 years before the reference, then either the reference is unsourced or stupid, or a mechanism has an exploit.
   - Either way the fix is a sourced mechanism, never a per-lab fudge.
   - The headroom band itself (e.g. "a top player gains ≤ 6–9 months on capabilities") is a designer question.

**Generalising** [J]:
- **Other actors (China, US government, the model):** each actor gets (a) a reference policy, which is its sourced real behaviour and calibrates the world when it is AI-controlled, and (b) a searched best policy for when it is the player. Balance per actor means the best policy's win rate sits in the label band for that actor's own win condition. The AI-controlled version of every actor is the reference, never the best policy. The world is populated by realistic actors, not optimal ones.
- **China as player:** the win condition is its own (e.g. parity or lead, regime stability). Theft, compute and export controls are the axes.
- **The model as player (rogue mode):** the reference is the AI 2027 Agent-4 behaviour. The lab's detection and control are calibrated on sourced eval and control results (inoculation, anti-scheming cuts). Difficulty is how often a searched rogue policy beats the reference lab's safety. The same mechanisms run in both directions, so no special rules are needed.
- **Earlier starts (2015–2023):** history is measured data, the strongest calibration there is. A reference replay should reproduce GPT-2/3/4-era compute, dates and revenue. Fit on one era and test on the next.
- **Worlds:** calibrate each preset against its own source model; report distributions across seeds rather than one median.
- **Post-ASI:** invariants (bounded growth, no runaways, scores defined) plus a searched policy, so exploits that only appear late get found.

## 5. Are the targets good? Shape, not dead numbers

A target is a **dead number** if one fitted constant can hit it without the model being right. A target that **forces shape** pins rates, ratios, orderings or responses that many mechanisms must jointly get right.

| Target (source) | Shape or point? | Source strength | Over-fitted? | Verdict |
|---|---|---|---|---|
| T1 ai2027 SC date (GOLDEN_EXPECTED, calibration.ts:87-92) | Point | Medium (one scenario + its timelines forecast) | **Yes:** gSC is fitted to it | **Upgrade:** take gSC from AIFM / horizon law; keep the date as a held-out check |
| T1 SAR / SIAR / ASI | Intervals SC→ASI = takeoff shape | Medium | Partly (dBM / sdSC were fitted) | **Upgrade** to interval checks (SC→SAR, SAR→ASI) |
| authors2026 (CAL2-T) | Point, but constants sourced | Strong (AIFM run) | No | **Keep.** Its failures are the useful kind |
| slow SC 2034–35 | Point | Weak (stand-in) | Yes | Keep as WARN until a horizon-trend mechanism exists |
| Research speed M 1.5 / 3 / 10 / 50 (calibration.ts:88) | Trajectory | Medium | No | **Keep, extend** to a curve check |
| METR h50 doubling 4.2 mo (CAL2.md:49) | Rate | Strong (measured) | No | **Keep;** add the 2019–24 ~7-month segment as out-of-sample |
| Frontier G 1.34 G/yr (CAL2.md:48) | Rate | Strong | No | Keep |
| T3 China lead, gap after theft (CAL2.md:103-105) | Response to an intervention | Medium | No | **Keep** (a model for response tests) |
| F7 revenue 2026, valuation $1–3T (CAL2.md:61-62) | Points | Medium | Partly | **Upgrade** to growth rate (~3×/yr) and revenue-to-compute ratios |
| FC2 "slower growth → lower multiple" (CAL2.md:64) | Ordering / elasticity | Medium | No | Keep |
| W4 young workers −19%, firm adoption, AI-use hours (CAL2.md:73-77) | Points, measured | Strong | Mild | Keep; add their trend over time |
| HireRate ≤10%, 25% remote work, U +1 pp (CAL2.md:68-70) | Dates | Weak (scenario narrative) | — | **Demote** to INFO |
| F2 / F5 inoculation and anti-scheming cuts (CAL2.md:90-91) | Response | Strong (papers) | No | **Keep;** best type of test |
| S4 RefBot P_mis 0.40–0.80 | Point on a hidden quantity, bot-dependent | Weak | Drives DIFFICULTY_SCALE | **Replace** with a response curve: P_mis falls with safety spend, slope and cost sourced |
| §7.4 race / safe ≤5%, mixed ≥30% | Bot outcomes | Designer guess | Yes (knobs tuned to it) | **Replace** with best-found-policy bands + "no single-lever dominant strategy" |
| Difficulty labels | Best of 5 heuristics | — | — | **Replace** with searched policy per start |

**A better target set:**
1. **Held-out validation:** fit at most one constant per preset from an outside model, and check every other milestone.
2. **Trajectory checks:** horizon doubling, compute growth, revenue growth, lag curves.
3. **Response and elasticity tests:** sign and rough size for theft, export controls, safety spend, a 2× capex shock, a pause.
4. **Invariants**, run cheaply on every commit: no runaway, bounded post-ASI, monotone responses.
5. **Distributions across worlds:** p10/p50/p90 against the sampled source distribution (GOLDEN_SAMPLED, calibration.ts:93 is already this shape).
6. **Cross-era:** 2015–2025 as out-of-sample data once early starts exist.

Runtime split: invariants and response tests use ~20 seeds and short horizons; search runs overnight off the CI path.

## 6. Medium-term first step, and questions

**First step (~1 week) [J]:**
1. Add workers to bots.ts (0.5 day).
2. Run method A on RefBot and mixed: perturb every unsourced choice in ref.ts and mixed.ts and report win rate and SC date per choice (~1 day of runs).
3. Run a one-lever check: RefBot plus P24/P09/P11 research, to measure the headroom directly.
4. Write the reference-policy audit: every RefBot choice tagged sourced / [D].

Search (method B) comes after, and only if A shows the landscape isn't flat.

**Designer questions**
1. What should the headroom be: how much earlier may a top player reach SC than the AI 2027 lab (months)?
2. Should RefBot research what real labs plausibly pursue (rivals already adopt P24 and the others), with the calibration refit to that?
3. Should difficulty labels and the §7.4 criteria move from heuristic bots to a searched best policy, accepting overnight runs?
4. Should knobs 3, 4 and 6 (rival aggressiveness, China efficiency, investor κ) leave the balance list as non-sourced forcing knobs?
5. Should S4 (RefBot P_mis band) become a response-curve test?
6. Win conditions for China, the government and the model as player: whose definition, and should their scores share one scale?
