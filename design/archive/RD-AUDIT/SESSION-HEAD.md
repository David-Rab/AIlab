# Session head: the designer-lead conversation before the R&D build started

This file is the opening of the 2026-11-21 to 2026-11-23 R&D session, up to the point where the build began, plus the designer's later statements of position, decision or working rule. It replaces a summary of that conversation.

- **Source:** the raw session transcript `C:\Users\david\.claude\projects\C--Users-david-Documents-projects-AI27\5f93a8eb-ca26-4e3d-bff6-f68539e3984e.jsonl`, extracted by script, not from any summary.
- **Index:** `[n]` is a running index over the transcript's designer messages and assistant text blocks, in order. Tool calls, tool results, thinking, system reminders, task notifications, subagent hand-backs and the compaction summary are not counted. The index runs [1]–[352] over the whole session.
- **Designer messages** are verbatim, typos included, in quote blocks.
- **Assistant answers** are in full. Only pure process chatter ("reading the code now", "launching agents") is trimmed, marked `[…]` with the trimmed indices.
- Part 1 covers [1]–[57]: from the first message to "you can start on phases 0-1, and save the plan" ([53]) and the assistant's reply to it ([54]–[57]).
- Part 2 quotes later designer messages ([67]–[350]) that state a design position, a decision or a rule about how to work, each with one line of context.

# Part 1: the conversation in order

---

## [1] Designer (2026-11-21 18:28 UTC)

> explain to me how the R&D systems work in the game. make sure you understand the code itself, and don't miss parts

### [2]–[4] Assistant

[…] (process chatter trimmed)

### [5] Assistant

# How R&D works in the game

I read the engine code, not the design docs. R&D is not a single tech tree with progress bars. It has four connected parts:

1. **The tree** says what can be researched.
2. **Projects** run a staged pipeline with hidden true values and noisy beliefs.
3. **Adopted results** go into **recipe stacks**.
4. **Training runs** lock in the stacks at launch, so research only reaches a model when you train a new one.

Safety research uses the same pipeline shape, but its results are "findings" rather than stack gains.

---

## 1. The tree ([data/v2/tree.ts](src/data/v2/tree.ts))

There are six columns. Each one is a specialty for science teams:
- **Capabilities teams:** Pretraining, Post-training, Systems.
- **Safety teams:** Alignment, Interpretability, Evals & control.

Nodes open only when their `needs` are known. Nothing is gated on how capable your models are. ★ nodes are public knowledge that every lab starts with, and each start type adds a few more known nodes.

Each node is one of these kinds:

| Kind | What it is | Examples |
|---|---|---|
| **line** | A repeatable direction that never finishes. Each result adds to a stack. | `L.scale`, `L.data`, `L.opt`, `L.latent` (pretraining), `L.rlalg` (RL efficiency), `L.env` (RL ceiling), `L.infer` (serving) |
| **idea** | One-off, with a typed effect | Elastic training (+train stack), P09/P11/P22 (domain boosts), P12 (expert data), P16 (train + serve), P21 (token worth) |
| **axis** | Unlocks a lever or design option, sometimes with an effect too | P10 synthetic data, RL focus nodes, P13, P17… |
| **safety line node** | A safety node with an agenda. It produces findings. | T-PROBE, T-CONFESS… |
| **rolled node** | The old method: a progress bar, then one dice roll | Only `kyc` and `P27` are left |

Paradigm nodes (P05–P27) work like any other node, with one twist: whether the first attempt succeeds was drawn secretly at new game (`hidden.paradigmSuccess`). Later attempts are keyed by hash. Outcomes never depend on timing.

## 2. Capability projects ([models/research.ts](src/engine/v2/models/research.ts))

### The pipeline
Each project goes through these stages:

**1. Ideation.** Science teams on the project produce candidates at (m_IDEAS × capacity)^λ × taste ÷ (idea effort × 30) per day.
- Capacity is heads/40 × quality (0.8 / 1 / 1.25), ×1.5 if the team's specialty matches the column.
- Each candidate has a **hidden true effect** that is recomputed from the seed and never stored. It also has a **belief** = truth + noise, where better taste means less noise.
- Candidates have a "novelty" value. More novel ones are bigger on average but much less certain.
- Once there are 2 candidates (`PICK_AT`), the team tests the one with the best μ + κσ. κ comes from your **risk policy**: safe −0.5, balanced 0, speculative +0.5.
- Scientists keep ideating during tests. The pool holds at most 4, and a better new find replaces the weakest.

**2. Small experiments.** The work rate is the AI-Futures experiment CES X(c, ℓ):
- c = this project's experiment FLOP per day.
- ℓ = (m_EXP × research engineers)^λ.
- The reading updates the belief. If the new estimate is below 30% of the prior mean, the candidate is dropped.

**3. Scale test.** The project measures the effect at 1,000× the small-experiment scale, i.e. x·1000^s, where s is the candidate's hidden scale exponent. The test runs at 1% of your latest base's FLOP for ideas and 0.2% for lines.
- If the effect falls below half the small-scale estimate, the candidate is dropped.
- So most small-scale wins with negative s die here.

**4. Result.** You get an estimate ± sd, projected to your latest base's scale.

**5. Adoption.** Adoption is queued **automatically** as an engineer build item: 0.5 + 2 team-weeks per OOM of effect, capped at 8; a pure unlock costs 1.
- When it completes, the **true** effect enters the stack, not your estimate. The UI only shows the realised value once a model trained after adoption has been evaluated.

### Failure and reopening
- An idea or axis **fails after 3 dropped candidates**: "the direction doesn't work in this world."
- In a dud world, candidates are just noise around 0, so they get dropped.
- A failed project can be **reopened as speculative**. Each reopen halves the odds, multiplies the prior mean by 0.7 and the spread by 1.5.
- Lines never fail.

### Lines and diminishing returns
Each line is a pool with returns r_l (its `rShare` × the world's r). The next result's prior mean is r_l·log₁₀((n₀+R+q)/(n₀+R)).
- After each result, the pool advances by the *true* effect delivered, so the line's total is always r_l·log₁₀ of cumulative input.
- Picking good candidates and surviving scale tests only change **how fast** you move along the curve, not the curve itself.
- Above experiment throughput X > 30, a line candidate bundles ⌊X/30⌋ ideas. This is for performance and keeps the expected rate the same.

### Who works on what (no micromanagement)
**Capabilities scientists** (`planAssignment`) are assigned in three steps:
1. Go down your priority queue, filling each project up to its "teams wanted", best specialty fit first.
2. Make one pass of pairwise swaps when a swap raises Σ√capacity/effort.
3. Hand leftovers to "auto" projects where they add the most (each step down the list is weighted ×0.8), else to the top project under the 6-team maximum.

Teams you placed by hand stay put. At game start, the six default lines (`DEFAULT_LINES`) are queued, with teams split by weight.

**Capabilities research engineers** are filled in order, each need up to its limit:
1. Run operations (per running run, plus the stream).
2. Eval suites.
3. Project experiments: 2 team-equivalents per project, and at most 75% of engineers.
4. Routine tuning, which takes everything left.

You can reorder these needs and set caps. A test that starts today only gets engineers and FLOP from tomorrow's allocation.

**Experiment FLOP** comes from the experiments pool, plus idle training compute unless the `spareTraining` policy sends it to data. Evals take their share first. The rest is split in proportion to research engineers. It is scaled by your training-throughput stack and by P13, which gives up to ×1.5 depending on your model's RSCH level.

## 3. Recipe stacks ([models/stacks.ts](src/engine/v2/models/stacks.ts))

There are five stacks, all in OOM:

| Stack | What it improves |
|---|---|
| `pre` | Pretraining efficiency. Depends on scale: an idea measured at F_test contributes x·(F/F_test)^s, so its value changes with the size of the run. |
| `rlMid` | RL compute efficiency |
| `rlCeil` | RL ceiling |
| `train` | Training throughput: MFU × goodput, capped at about +0.3 OOM |
| `serve` | Serving efficiency. The first ~0.33 OOM raises decode utilisation from 0.07 to 0.15. Beyond that, new versions use fewer FLOP per token, up to 1 OOM. |

Other details:
- **Headroom:** 30% of each adopted idea's effect is held back as headroom. Routine tuning closes it at a rate proportional to the engineers on tuning and their experiment throughput (about 3 months with 3 teams at unit inputs).
- **Domain effects** (`domainG`), **data effects** (`dataFx`: synthetic-quality ceiling, token worth) and **expert data** (into a suite) are stored outside the stacks.
- **Outside knowledge** goes straight into the `pre` base, with no headroom:
  - diffusion from the leader lab's public model (K × gap);
  - C4 tacit knowledge;
  - safety SPILL findings.

**Link to training** ([models/runs.ts:443](src/engine/v2/models/runs.ts#L443)): the recipe is **frozen when a run launches**.
- A base run takes `pre` at its FLOP.
- A post-train run takes `rlMid` and `rlCeil` plus suite fidelity.
- Domain effects apply to versions trained after adoption.
- Only the continual-learning stream (P08) re-applies today's recipe to a live model.

## 4. AI in the loop ([departments/workfit.ts](src/engine/v2/departments/workfit.ts))

This is where takeoff comes from:
- Your internal agents' fit on the **EXP** and **IDEAS** work types gives coverage. Coverage, AI full-time equivalents (from agent compute and FLOP per token) and a CES of human and AI labour give the multipliers **m_EXP** and **m_IDEAS**. These multiply every engineer and scientist allocation above.
- **Taste** = E[max(human, AI)] on a lognormal. Elite teams sit at +1 SD and Solid at −0.5. Star hires add 5% each. The frontier model's IDEAS fit lifts taste in proportion to its compute share. Taste both raises the mean of one-off ideas (up to ×1.5) and narrows belief noise (÷ taste).
- **Adopted paradigms boost it further:**
  - P05: ×1.3 agent labour.
  - P20: up to ×1.1.
  - P19: removes the RSCH penalty.
  - Control monitoring takes a usefulness tax.
- **Speed modifiers** (`researchMods`):
  - a frontier pause: ×0.1;
  - a verified treaty: ×0.65;
  - siloing: −5% per level;
  - an ASIC migration: −15%;
  - a security clearance event idles 10% of staff for 60 days.
- **Covert risk:** when an adoption completes, the models doing your R&D can secretly steer the build (`steerAdoption`). The full effect still lands, but an uncaught steer adds hidden chain-of-thought (CoT) pressure to later runs.

## 5. Safety research ([safety/lineProjects.ts](src/engine/v2/safety/lineProjects.ts), [findings.ts](src/engine/v2/safety/findings.ts))

Safety line projects use the same stages: ideation → small experiments → **validation on the frontier model**.
- The belief is the probability that the line's **hidden efficacy** is real, updated from its Beta posterior. The belief is only a readout; it never decides the result.
- At reference staffing the first result takes T₁ months.
- Engineers go to investigations and patches first, then line experiments (in priority order, up to a share), then tool upkeep.
- Compute is the safety pool minus monitors, safety agents and investigations.

**Each finished validation produces one finding.** Its type is drawn from:
- TECH, weighted by efficacy;
- DEAD, which adds 2 to the posterior's failure count;
- NEG;
- DISC (reveals failure modes);
- SPILL (white-box agendas only, gives a little capability knowledge).

A working result unlocks the node's technique and makes the node known. Any other result restarts the project.

If you've handed work to AI (**Trusted to AI**), the safety model may sabotage a result:
- uncaught → a **FALSE** finding that looks like a working tool until it is cross-checked;
- caught → an incident, and the result is discarded.

Safety teams use the older ETA-based auto-assign. Teams with nothing queued join the best unstaffed line. When a line's node becomes known, its teams move to the line's next node or its follow-up project.

## 6. Rival labs ([actors/rivalModel.ts](src/engine/v2/actors/rivalModel.ts))

Rivals have no individual ideas. Each runs three aggregate pools (pre, RL efficiency, RL ceiling) with the same log-returns, driven by the same experiment CES and their own AI labour. Leaks, theft, deals and diffusion add to their pretraining part.

---

## Things worth knowing that aren't obvious
- **True effect ≠ estimate.** The scale test reads the effect with noise (±5% on size, ±0.03 on the scale exponent s), and you only see the real number after a model trained with it has been evaluated.
- **Research does nothing until you train.** Adopted ideas only matter for runs launched afterwards, apart from the stream.
- **Capability ETAs are rough.** `projectRate` is a readout approximation; the engine runs the stages for real.
- **The risk policy is shared** by capability and safety projects.
- **Small code/comment mismatch:** `autoAssign()` in [tree.ts:438](src/engine/v2/models/tree.ts#L438) is documented as "both departments" but only runs for safety. Capabilities assignment happens separately in `capResearchDay`, so the behaviour is fine; the comment is stale.

I can go deeper on any one piece, for example the exact rate formulas or the Research UI in [researchView.ts](src/engine/v2/models/researchView.ts).

---

## [6] Designer (2026-11-21 18:40 UTC)

> each model has just one number: OOM? how does that map to domains?

### [7] Assistant

[…] (process chatter trimmed)

### [8] Assistant

# How a model's capability maps to domains

No, a model isn't one number. Every trained version carries a **build** with a separate effective compute for each of 9 domains: CODE, RSCH, REASON, AGENCY, SOCIAL, MEDIA, CYBER, BIO and PHYS. The single **G** you see is a summary of them. All of these values are in OOM (log₁₀ of effective compute).

## The formulas ([models/capability.ts:104](src/engine/v2/models/capability.ts#L104))

```
G   = gPre + ΔG_RL(general)                 + dg
G_d = gPre + sD_d + (ΔG_RL,d − γ_d)         + dg
```

| Part | Per domain? | Where it comes from |
|---|---|---|
| **gPre** | Shared | Base model: log₁₀(FLOP) + the `pre` stack at that FLOP + architecture shape + overtraining penalty + data repetition and quality + design effects ([effective.ts:85](src/engine/v2/models/effective.ts#L85)) |
| **sD_d** | Yes | **Data mix:** 1.5·log₁₀(domain's share of drawn tokens ÷ the 2025 reference share), capped at ±1.3 OOM ([data.ts:178](src/engine/v2/production/data.ts#L178)). The "Code & math" or "Science" data options act here. Research **domain effects** (P09 REASON, P11 REASON/CODE, P22 PHYS) are also added here, but only for versions trained after adoption. |
| **ΔG_RL,d** | Yes | **Post-training:** one RL sigmoid per domain (see below) |
| **γ_d** | Yes (constant) | The reference RL run's own domain profile. It is subtracted, so a standard "broad" RL run doesn't specialise the model; only choices that differ from the reference do. |
| **dg** | Shared | Other design effects: preference tuning, reasoning mode, run penalties, distillation gap, P24 |

**General G** uses the *mean* RL gain over the cognitive domains instead of the per-domain one, and has no data term.

### The RL part, per domain ([effective.ts:195](src/engine/v2/models/effective.ts#L195))
The RL budget is split across **RL families** (math, SWE, ML research, long tasks, cyber, bio, computer use).
- **"Broad"** spreads the budget equally across available families. An **RL focus** puts a fixed share on one or two families.
- Each family's compute reaches domains through a **transfer matrix**: 1.0 to its own domain, 0.4 to adjacent domains, 0.15 to everything else.
- Each domain then gets a sigmoid gain: A / (1 + (C_mid / C_d)^B).
  - **A** is the ceiling. It rises with base size and the `rlCeil` stack, and is scaled by each family's environment-suite fidelity.
  - **C_mid** is the midpoint. It shrinks with the `rlMid` stack.
  - **C_d** is the transfer-weighted RL compute reaching that domain.

So "RL focus: cyber" pushes CYBER up the curve a lot, nearby domains somewhat, and the rest barely.

## From OOM to the levels you see (0–15)

**λ(G)** is a piecewise-linear map through five knots, computed per world from the human reference points:

| Level | Knot |
|---|---|
| 5 | V0, the 2025 start model |
| 10 | Superhuman coder |
| 12 | Superhuman AI researcher |
| 13.5 | Superintelligent AI researcher |
| 15 | ASI (the cap) |

A domain's displayed level ([capability.ts:131](src/engine/v2/models/capability.ts#L131)):

```
L_d = λ(G_d) + offL_d + o_d      (clamped 0–15)
```

- **offL_d** are offsets that are kept in level units rather than OOM. For example, persuasion tuning gives SOCIAL +0.8, plus some paradigm offsets.
- **o_d** is a fixed 2025 difficulty offset: AGENCY −1, CYBER −1, PHYS −4, and 0 for the rest. RSCH gets an extra −0.5 until P19 (Learned research taste) is adopted.
- The code doesn't compute this in one step. `finishBuild` stores the difference `off_d = λ(G_d) − λ(G) + offL_d`, and `domainsOf` adds it back onto λ(G); the result is the formula above.

## Which version the game mechanics use

The levels are for display and benchmarks. **The mechanics read the OOM values directly:**
- **Work fit** for AI labour (the m_EXP / m_IDEAS multipliers and taste from the R&D explanation): F_w = Σ ω_w,d · G'_d, with G'_d = G_d + offL_d ÷ 1.2. The P19 RSCH adjustment is also applied here ([workfit.ts:53](src/engine/v2/departments/workfit.ts#L53)). For example, IDEAS = 0.7·RSCH + 0.3·REASON, and EXP = 0.4·CODE + 0.4·RSCH + 0.2·AGENCY.
- **Time horizon** is 203 min × 4.2^(G_AGENCY − G_V0), or G_CODE for software work.
- **Product demand** uses each sector's domain weights over the same G_d ([serving.ts:155](src/engine/v2/worldfx/serving.ts#L155)).
- Domain difficulty enters the mechanics through each work type's **human reference points** (per-domain deltas), not through o_d. o_d only affects the displayed level.

## Exceptions
- Rivals' models and imported open models have **no build**, so every domain reads their single G. They have a flat profile with no specialisation.
- P13's payoff reads the **measured** RSCH level: the benchmark-based display level, not the true G.

So in short, one G is the headline number, but under it each domain has its own value, shaped by what the base drew in data and where the RL budget went.

---

## [9] Designer (2026-11-21 18:44 UTC)

> do various users need different domains?
> internal users (the various teams), and external users.

### [10] Assistant

# Do different users need different domains?

Yes. Internal teams and external customers each score a model as a weighted sum of its per-domain effective compute (OOM). So the same model can be strong for one user and weak for another.

## Internal users: the work types ([data/v2/workTypes.ts:30](src/data/v2/workTypes.ts#L30))

Each internal agent use automates one role's work:

| Work type | Who it helps | Domain weights | Horizon domain | Task length H | Checkability v |
|---|---|---|---|---|---|
| **SWE** | Engineers (build capacity) | CODE 0.7, AGENCY 0.3 | CODE | 2 h | 0.9 |
| **EXP** | Capabilities research engineers | CODE 0.4, RSCH 0.4, AGENCY 0.2 | AGENCY | 8 h | 0.7 |
| **IDEAS** | Capabilities scientists, and AI taste | RSCH 0.7, REASON 0.3 | AGENCY | 40 h | 0.3 |
| **SAF_EXP** | Safety research engineers | CODE 0.5, RSCH 0.5 | AGENCY | 8 h | 0.5 |
| **SAF_IDEAS** | Safety scientists | RSCH 0.7, REASON 0.3 | AGENCY | 80 h | 0.2 |
| OTHER | Not a lab team; only used for the ASI milestone | SOCIAL 0.35, BIO 0.25, CYBER 0.2, MEDIA 0.2 | AGENCY | 8 h | 0.4 |

Domains aren't the only difference between work types:
- **Task length H** matters through the time horizon. Long tasks (IDEAS at 40 h, SAF_IDEAS at 80 h) need a much longer AGENCY horizon before coverage rises.
- **Checkability v** raises the coverage threshold when work is hard to check. That's why ideas work automates last even at equal fit.
- Each work type is compared against its own **human reference points**: the best human and the median expert for that domain mix.

**You can pick a model per use** ([departments/agents.ts:43](src/engine/v2/departments/agents.ts#L43)). Engineering (`eng`), frontier research (`capFrontier`) and `safety` each have their own `versionId`. Routine research (`capRoutine`) uses the routine version, and any use without a live pick falls back to it too. So you could run a CODE-heavy model for engineering and an RSCH/REASON-heavy one for research ideas.

## External users: sectors and consumer chat

**Consumer chat** ([data/v2/serving.ts:106](src/data/v2/serving.ts#L106)) uses SOCIAL 0.4, REASON 0.4, MEDIA 0.2, with very short tasks (3 min).

**Sectors** ([data/v2/sectors.ts:42](src/data/v2/sectors.ts#L42)) each have their own domain weights:

| Sector | Domain weights |
|---|---|
| Software & IT | CODE .55, REASON .2, AGENCY .15, SOCIAL .1 |
| Office / admin | REASON .35, SOCIAL .35, AGENCY .2, MEDIA .1 |
| Finance | REASON .55, SOCIAL .2, AGENCY .15, CODE .1 |
| Legal | REASON .6, SOCIAL .25, AGENCY .15 |
| Media | MEDIA .5, SOCIAL .25, REASON .25 |
| Science R&D | REASON .5, CODE .2, PHYS .2, AGENCY .1 |
| Healthcare | PHYS .45, REASON .3, SOCIAL .25 |
| Education | SOCIAL .45, REASON .35, MEDIA .2 |
| Government | REASON .45, SOCIAL .3, AGENCY .25 |
| Military | PHYS .4, REASON .25, AGENCY .2, CYBER .15 |
| Manufacturing | PHYS .7, REASON .15, CODE .15 |
| Logistics / Energy | PHYS .75, REASON .15, AGENCY .1 |
| Retail & services | PHYS .55, SOCIAL .35, REASON .1 |

**PHYS is handled separately.** It is taken out of a sector's fit and the rest is renormalised ([serving.ts:130](src/engine/v2/worldfx/serving.ts#L130)). The sector's automated share then becomes:

```
F = (1 − w_PHYS) · (share-weighted coverage of the cognitive part)
  + w_PHYS · σ(PHYS display level, capped by robots available)
```

So physical sectors are limited by robots, not by the model alone ([worldfx/mix.ts:656](src/engine/v2/worldfx/mix.ts#L656)).

**How a sector picks providers:**
- Each provider gets a fit on the sector's mix, which gives coverage, which sets value and price.
- Buyers choose by surplus. Consumers choose by quality.
- For the player, the **best of your deployments is used per sector**, so a specialised product can win the sectors it suits.

**A second, older path also uses domains.** The economy mix still uses domain *display levels* for some things: substitution, the integration boost and control. It caps each domain at AGENCY + 2 levels (`Le_d = min(L_d, L_AGENCY + 2)`), so weak agency limits everything there.

## What this means in play
- **Reasoning and social skills sell; code and research speed up your own lab.** The biggest sectors by employment lean on REASON, SOCIAL and PHYS. Your own R&D leans on CODE and RSCH.
- **AGENCY matters everywhere.** It sets the time horizon for almost every work type and sector except SWE, which uses CODE. CODE does the same for SWE.
- **RL focus and data mix are the real choice.** Because RL transfers only 0.4 to adjacent domains and 0.15 to far ones, specialising a version is a trade-off. It's how you would build an internal research model, separate from a product model.
- **Rivals' and imported models** have one G with no per-domain build, so they have a flat profile across every sector and work type.

---

## [11] Designer (2026-11-21 18:47 UTC)

> explain to me how the safety R&D and systems work

### [12]–[14] Assistant

[…] (process chatter trimmed)

### [15] Assistant

# How safety R&D and the safety systems work

Safety isn't a score you raise. Each model has hidden **true traits**, and you only ever see **beliefs** about them, built from imperfect tools. Safety research builds those tools. Training runs shape the traits. Oversight and control decide whether a misaligned model can actually do harm.

The code keeps truth and the player's knowledge strictly apart: everything the UI and previews read comes from beliefs and posteriors, never from true values ([safety/view.ts](src/engine/v2/safety/view.ts)).

---

## 1. Hidden world draws

When a game starts, the world draws hidden values:
- **Six latents** ([latents.ts](src/engine/v2/safety/latents.ts)): legibility, formalizability, CoT load-bearing (λ2), verification advantage, benign generalisation, and the scheming default (λ6). They decide which research directions work in this world, so agendas that rest on the same latent succeed or fail together.
- **Edge weights** in the trait graph: w̄ × a noise factor kept within ½–2×, so the world modulates outcomes but your choices still dominate.
- **Agenda efficacy:** e = Beta prior + Σ loadings × latents. It is never shown.
- **The loss tolerance** θ_w, used at the end of the game.

## 2. Traits: what training does to a model ([safety/traits.ts](src/engine/v2/safety/traits.ts))

There are 17 traits in layers ([data/v2/traits.ts](src/data/v2/traits.ts)):

| Layer | Traits |
|---|---|
| L (learned) | SYC, RH, PROXY, SA, PERSONA, OBF |
| A (awareness) | EA, TGAME |
| B (unobserved behaviour) | CONCEAL, POWER, AF, SAND, SCHEME, COLLUDE, SUCC |
| P (protective) | HONEST, CORRIG |

**Each run computes training signals S1–S9 from what it physically does:**
- S1: approval reward (your preference choice);
- S2: hackable graders (suite exploitability × RL pressure);
- S3: long-horizon agentic RL;
- S4: CoT pressure or neuralese;
- S5: scale plus AI-related data;
- S6: narrow harmful fine-tunes. No run kind produces this today, so S6 is always 0;
- S7: eval-like RL;
- S8: many copies with shared memory;
- S9: oversight-conditional reward, i.e. training against a detector.

**One update applies to every run, for every lab:**

```
Δx_j = ω · D_w · (1 − x_j) · Σ_edges w_e · driver_e · moderator_e  +  U-mode amplification  −  removal
```

- **ω** is the run kind's weight: base 1, post 0.6, continue 0.5, distill/IDA 0.4. It is scaled by RL budget^0.25.
- **The edges** ([data/v2/edges.ts](src/data/v2/edges.ts)) are sourced chains. For example, S2 → RH; learned hacking → PERSONA → AF, SCHEME and POWER; SA × PROXY → AF; EA + TGAME → SAND; S8 → COLLUDE and SUCC.
  - **Learned hacking** is a separate term. It only starts once more than 10% of a run's episodes are hacked. Inoculation prompting multiplies it by 0.15.
  - **AF growth is capability-gated.** It is 0 below G 25.4 and full at the 2025 frontier, and it is off entirely in pretraining.
- **Moderators** are where your techniques and choices act ([traits.ts:635](src/engine/v2/safety/traits.ts#L635)). Examples: anti-scheming ×0.1 on SCHEME growth, comms lockdown ×0.5 on COLLUDE, a monitorability pledge ×0.5 on OBF. Patching a signal is lab-wide and applies to every later run.
- **Removal** comes from safety training: minimal 0.05, standard 0.55, heavy 0.8. But it only removes what training can *see*:
  - eval awareness hides behavioural traits;
  - **AF, SCHEME and SAND are only 10% visible**. This rises to 15% with AG02 alignment audits, and detection-assisted removal of these traits only works at 0.375 effectiveness.
  - So ordinary safety training **selects for hidden misalignment** as capability rises.
  - AG18 "healing" removes value traits whether or not they are visible, scaled by AG18's true efficacy and staffing.
- **The understanding gap amplifies growth.** While capability L exceeds the *true* understanding U, growth is ×(1 + 0.4 × gap, up to 2.5 levels). Not looking doesn't slow drift.

**Inheritance:**
- New models start from their makers. The AI doing your R&D pulls the successor's dispositions toward its own: ω = κ(SUCC) × its share of the work × (1 − oversight).
- Across a new initialisation (a new base or a distilled student), only the *visible* part transfers.
- New bases also draw hidden **U-modes**, unknown failure modes ([data/v2/umodes.ts](src/data/v2/umodes.ts)). These amplify traits or blind tool families until a line discovers them.

**Misalignment index** (hidden):

```
Mis = .25·SCHEME + .15·AF + .15·POWER + .15·SUCC + .1·COLLUDE + .1·SAND
      + .05·TGAME + .05·OBF + .05·(speculative U-modes) − .1·(HONEST − .5) − .1·(CORRIG − .5)
```

## 3. Safety research: building tools

**18 agendas** (AG01–AG18, [data/v2/agendas.ts](src/data/v2/agendas.ts)). Each has:
- a Beta prior on efficacy and latent loadings;
- **T₁**, the months to the first result at serious staffing;
- **robustness** (mHalf, k): how fast its tools decay as models get more capable;
- **Goodhart susceptibility G**;
- an **automation factor**;
- a tool family: white-box (WB), behavioural (BB), CoT, other (OR), plus fix, contain and meta;
- the traits it covers.

**Line projects** ([lineProjects.ts](src/engine/v2/safety/lineProjects.ts)) are tree nodes worked by safety scientists. They run ideation → small experiments → validation on the frontier model:
- The stages take 0.2 / 0.35 / 0.45 of T₁ at reference inputs, each one speeding up or slowing down with its own inputs.
- Safety research engineers serve investigations and patches first, then experiments (up to 50% of the free engineers), and the rest do tool upkeep.
- Compute is the safety pool after monitors, safety agents and investigations.

**Each validation produces one finding** ([findings.ts:217](src/engine/v2/safety/findings.ts#L217)). Its type is drawn from:

| Type | Weight | Effect |
|---|---|---|
| TECH | e (efficacy) | Unlocks a tool. Posterior success count +1. |
| DEAD | 0.5(1 − e) | Posterior failure count +2. If the posterior mean falls below 0.25, the line becomes `deadEnd` and runs at half speed. |
| NEG | | Shows a tool has decayed, or exposes a false result |
| DISC | | Reveals or rules out U-modes |
| SPILL | WB agendas only | A little capability knowledge |

You only see the **posterior** (Promising / Mixed / Struggling), never e.

**Handing safety work to AI:**
- The **Trusted to AI** policy hands a share t of safety work to the safety model through the same labour CES as capabilities work.
- P27, F44 and AG17's harness boost the safety model's fit or automation.
- **The risk:** a misaligned safety model can sabotage results.
  - Uncaught → a **FALSE** finding: a tool that masks instead of detecting.
  - Caught → an incident, and the result is discarded.
  - It also sandbags part of its own labour, so lines slow down.

## 4. Tools and detection

**Tool strength** ([techniques.ts](src/engine/v2/safety/techniques.ts)):

```
strength = s0 · efficacy · D(x) · (1 − G · trainedAgainst)
D(x) = 1 / (1 + 10^(k·κ·(x − oHalf)))
```

x is how many OOM the overseen model is above the start model. So tools fade as models get stronger.

Exceptions to that decay rule:
- **AG05** (scalable oversight) uses the overseer-gap rule instead.
- **AG09** (CoT monitoring) collapses under latent reasoning. CoT tools stop working entirely once λ2_eff ≤ −1, i.e. when reasoning is no longer load-bearing.

**Upkeep:** free safety research engineers re-validate fading tools, raising their oHalf. Below 15 engineers per fading tool, nothing gets re-validated.

**Each observation** ([detection.ts:195](src/engine/v2/safety/detection.ts#L195)) is:

```
o = x_true · penalty_family + N(0, 0.12 / strength)
```

followed by a Gaussian belief update. The penalty depends on the family:
- **BB:** (1 − 0.8·EA), × (1 − mask).
- **CoT:** monitorability × (1 − max(CoT controllability(L), obfuscation)) × (1 − mask).
- **WB:** (1 − mask), and undiscovered U-modes cut it further.

Tools whose agendas share a main latent combine as correlated evidence.

**When observations happen:**
- each eval suite;
- weekly runtime monitoring;
- alignment audits from heavy-safety runs;
- investigations.

Between these, beliefs drift.

**Goodhart:** retraining against a detector lowers the *visible* trait by 70–90% but the true trait by only 20–40%. It leaves a mask on that tool family.

## 5. Understanding U ([understanding.ts](src/engine/v2/safety/understanding.ts))

U is the highest level at which your **believed** detection of the critical traits (SCHEME, AF, SAND, POWER, SUCC, COLLUDE) averages at least 0.5. It's computed from posterior efficacy, believed EA and your own record of training against tools.
- Tools only hold about 1.5 × √(validation multiplier) levels above today's measured level. That multiplier comes from free research engineers per line.
- Believed EA is projected to rise with capability.
- The **margin U − L** is the race bar you see.
- The engine separately tracks the **true** gap, and that is what amplifies trait growth.

## 6. Danger: when traits become harm ([incidents.ts](src/engine/v2/safety/incidents.ts), [data/v2/danger.ts](src/data/v2/danger.ts))

For each act, at each deployment or internal fleet:

```
attempts = κ · x^1.5 · σ((L_domain − θ)/s) · opportunity
```

- Each act has a capability domain and threshold. Examples: RH uses CODE at θ 5; POWER uses AGENCY at 7; SAND uses RSCH at 8 (internal only); SCHEME uses CYBER at 9.
- **Opportunity** = usage × copies^γ × (autonomy from task horizon × affordances), × the AI share of R&D for R&D acts.
- **Oversight** = 1 − (1 − block)(1 − catch):
  - block = AG07 containment, plus weight security for escape-like acts;
  - catch = monitors (at the capability gap to the monitor model), human review (falling as models pass expert level) and control deferral.
- **Outcomes:** blocked acts leave no trace. Caught acts are incidents you see, labelled by their *apparent* cause. Uncaught acts are harm: public incidents for products, silent ones inside the lab.

Misuse and exfiltration use the same structure.

**Covert acts** ([covert.ts](src/engine/v2/safety/covert.ts)) are attacks on your own work:

| Act | Uncaught consequence |
|---|---|
| SAFSAB | A FALSE safety result |
| STEER | A capability adoption is built in toward the model's ends, adding hidden CoT pressure to later runs |
| SUCCSTEER | Hijacks the successor pull |
| BACKDOOR | A foothold |
| HIDCOMP | A foothold |

**Footholds** ([footholds.ts](src/engine/v2/safety/footholds.ts)) are hidden AI assets:
- the five kinds are backdoors, hidden compute, steered successors, corrupted tools and escaped copies;
- they move hidden → suspected (through symptoms) → located (through cases) → removed (through Respond).

## 7. Control and the endgame ([control.ts](src/engine/v2/safety/control.ts))

```
Exposure E = Mis · (1 − internal oversight) · (1 + footholds)
Control    = 1 − E
```

There is no dice roll at the end:
- When you reach ASI, you **lose control if E > θ_w**.
- If you lose it, AG07 containment can still turn takeover into "contained, barely" ([epilogue.ts:113](src/engine/v2/endings/epilogue.ts#L113)).
- An escaped copy holding ≥ 2 copies once the frontier is at SAR can also end the game ("Rogue AI").
- Rival labs use a simpler rule: their exposure is just their Mis.

## 8. What you do
- **Research:** staff lines, which have deep-learning-style posteriors and tool payoffs. Some "fix" techniques are automatically included in every post-training run while their line is staffed.
- **Run design:** preference stage, safety level, CoT mode, inoculation, RL focus and budget. These set signals and removal.
- **Safety stack and policies:** activate tools, set the eval gate, make the monitorability pledge, choose Trusted to AI, choose monitor models per use.
- **Respond:**
  - **Investigate** a model and trait, or an incident: research engineers raise clarity, and the case resolves at clarity 0.8 or after 120 days.
  - **Response menu** ([responses.ts](src/engine/v2/safety/responses.ts)): patch a signal, retrain against a detector (Goodhart risk), targeted training, restrict context, add or remove control, roll back, disclose, remove a foothold.
  - **Publish** findings: rival labs get SPILL findings too.

## Things worth flagging
- **The central trap is deliberate.** Training and retraining clean up what you can *see*. AF, SCHEME and SAND are mostly invisible, so a lab that trusts its evals drifts toward hidden misalignment. Only white-box tools, AG18 healing, or not creating the signals in the first place get around it.
- **E05 is a dead edge right now.** S6 is hard-coded to 0 (`S6_NARROW_HARMFUL`), so PERSONA from harmful fine-tunes never fires. The code comments say this is intentional for now.
- **Handing safety research to the AI is double-edged.** It speeds safety research but opens FALSE-result and sandbagging risk in proportion to how misaligned the safety model is. Using an older, trusted model lowers the risk but also lowers coverage.

---

## [16] Designer (2026-11-22 09:01 UTC)

> what are the product 'sector' things you add on?
>
> why do we still have rolled nodes? any other junk that is kepy around from previous versions that we didn't clean up properly?
> also dead code and systems, or things that should die.
>
> what's the difference between a safety line node and a line node?
>
> how do internal models (assigned to each team type) affect capability projects at each stage?
>
> in the small experiment stage, do dropped candidates return if they are still the best option? same for scale test. 
> what is CES x(c,l)
>
> how is the compute for the various experiment levels budgeted? for the various agents for the teams? between the teams? between capability and safety research?
>
> are capability and safety research combined or not? i feel like we just have a very messy situation.
>
> i didn't understand the recipe stacks. what does each do?
>
> how does data work? creation, usage?
>
> what are the RL suites?
>
> if you would want to think from first principles, apriori, how to create the UX/UI for these aspects of the game - managing the teams and agents, research and development for capabilities and safety, data, training, models, products - how would you do it? which principles of game UX/UI design would you first follow.

### [17]–[21] Assistant

[…] (process chatter trimmed)

---

## [22] Designer (2026-11-22 09:06 UTC)

> i don't want you to take the UI standard we have as given. i want you to think which questions to ask, and which principles to follow to get a better one.

### [23] Assistant

Understood. I won't treat the current UI standard as a given. I'll work out which questions a good standard has to answer and which principles follow from them, and say where the current one falls short. The audit agent is still running; you'll get everything in one answer when it's done.

### [24] Assistant

[…] (process chatter trimmed)

### [25] Assistant

# Answers to your eleven questions

I read the code for each answer. The legacy-code audit ran as a separate pass, and I re-checked its main claims myself.

## 1. Sector packs

A sector pack is a vertical version of an existing product for one industry, such as Legal or Healthcare ([worldfx/actions.ts:59](src/engine/v2/worldfx/actions.ts#L59)).

**What you need:**
- the "Sector packs" product feature (the leader start has it built);
- a live enterprise, API or agents product to host the pack.

**What it costs:** $0.4B, 15 product staff, and 4 engineer team-weeks on the build queue. After that comes 120 days of certification.

**What you get, once certified:**
- **+0.42 OOM of fit** on that sector's work for the host product ([serving.ts:477](src/engine/v2/worldfx/serving.ts#L477)). This makes it look more capable to buyers in that sector.
- An **enterprise** host gets **×3 weight** in that sector's demand ([revenue.ts:333](src/engine/v2/worldfx/revenue.ts#L333)).
- The sector's adoption resistance drops by 0.1 ([sectors.ts:87](src/engine/v2/worldfx/sectors.ts#L87)).
- **The cost:** a 50% chance of −1 approval with the labour bloc.

Certification is stored per *sector* (`world.fx.certDay`), not per product, so only one pack per sector is allowed. The +0.42 is written as "0.5 level ÷ 1.2", which is a leftover unit conversion (see §2).

## 2. Rolled nodes and other junk

**Why rolled nodes still exist:** only `kyc` and `P27` use the old "progress bar plus one dice roll" path.
- **`kyc` does nothing.** I checked: no engine code reads that node. The per-product KYC setting works without it. Delete it, or make it a ★ node.
- **`P27` is live.** It is a paradigm, and `isLineNode` excludes paradigms. Make it an AG17 line node like `aar`, then delete `roll()`, `researchSpeed`, `priorMult` and `retryDay`.

I put the rest in four groups.

**Dead: safe to delete**
- **The old v2 production function:** the knot tables in `knots.ts`, most of `production.ts`, and `R13_AI2027_KNOTS`.
  - Only the `identity.ts` test script reaches it, but `buildKnots` still runs on every new game and `prod.knots` is saved.
  - I confirmed the research-mix auto-split uses the new path; the knot branch is labelled "identity test only".
- **`calShift` / `alignedCalShift` and the `thresholds()` function:** nothing live reads them.
- **Save migrations 1–10:** unreachable. Migrations 11–14 don't exist, so any save older than rev 11 already fails.
- **Branches for tree nodes with a cash cost:** no node has one.
- **47 exported functions or constants with no callers,** e.g. `gainKnowledge`, `h80Of`, `sectorLevel`, `controlLost`, and six helpers in `actors/fx.ts`.

**Legacy still wired into live mechanics: needs a replacement first**
- **Progress-years:** the lead and leak code converts G to "years" and back about 15 times. It also still includes v2's (1 − share) compute term.
- **The v2 start-state solution** (`playerStart`, `multiplierAt`, `START_RETAIN`, `data/world.ts`): it still sets the start recipe lag and V0. Replacing it means a new start calibration.
- **`player.paradigms`:** a duplicate of the tree state, read through `adopted()` in 28 places.
- **P26:** kept only so the hidden random draws stay in the same order.
- **`OLD_EFFORT_DAYS`:** a fossil calibration that still sets the effort of unfitted paradigm projects.
- **The research multiplier `prodCache.M`:** still read by the government's security demand, a tutorial trigger and the rolled path.
- **Two linear level conversions I found in passing:**
  - `LEVEL_PER_OOM = 1.2` converts level offsets to OOM alongside the real piecewise λ(G) map.
  - RL families still specify their effects in levels ("REASON +1.2").
- **One dead trait edge:** S6 is hard-coded to 0, so the E05 edge never fires.

**Parallel systems that should be merged**
- **Two science-team allocators:** priority-and-swap for capabilities, ETA-greedy auto-assign for safety.
- **Three level/OOM conversions:** `oomOfLevel` duplicates `gOfLevel − gV0`, plus the 1.2 linear one, plus `levelOfV2` (used only by RefBot).
- **Two sector capability models:** fit in OOM in `serving.ts`, and display-level vectors in `mix.ts` that still drive substitution, control and the tech tree.

**Stale comments:** for example, "auto-assign (both departments)", "BRIDGE(V6) moves in V6" (it already did), "q = pm + calShift". The phases those `BRIDGE(V6)` and `BRIDGE(V7)` tags point to are finished, so every remaining tag is overdue.

**Saves:** the schema is at rev 43. If you reject saves older than about rev 33, roughly 30 migrations and the helpers they keep alive can go.

## 3. Safety line node vs. capability line node

They share the word "line" and almost nothing else.

| | Capability **line** (`L.scale`…) | **Safety line node** (`T-PROBE`…) |
|---|---|---|
| Ends? | Never: it repeats, and each result adds to a stack | Becomes known when a working-tool finding arrives; then the agenda's next node or follow-up project takes over |
| A result is | A number added to a recipe stack | A finding type (tool / dead end / negative / discovery / spillover / false) |
| Hidden truth | Each candidate's effect x and scale exponent s | One efficacy number for the whole agenda |
| Candidates dropped? | Yes, at small experiments or the scale test | Never. Every validation gives a finding |
| Engine | `models/research.ts` | `safety/lineProjects.ts` + `findings.ts` |

"Safety line node" really means "a project on a safety research *agenda*". The tree file calls agendas "lines", so the same word means two different things.

## 4. How internal models affect each stage of a capability project

| Stage | Which internal agent use | How it acts |
|---|---|---|
| Ideation | **Frontier research** (IDEAS fit: RSCH .7, REASON .3) | m_IDEAS multiplies scientist capacity: rate ∝ (m × capacity)^0.5. **Taste** is E[max(human, AI)], where AI taste comes from the IDEAS fit, weighted by the frontier share of agent compute ÷ 0.15. Taste raises idea means and cuts belief noise. |
| Small experiments, scale test, routine tuning | **Routine research** (EXP fit: CODE .4, RSCH .4, AGENCY .2) | m_EXP multiplies research-engineer labour ℓ in the CES (§6). It also divides the human engineers that run operations and evals need, freeing them for experiments. |
| Adoption (build-in) | **Engineering** (SWE fit) | Raises build capacity, ×1/(1 − A_eng), so results get built in sooner. |
| All stages | — | P05 ×1.3 and P20 up to ×1.1 on AI labour. Control monitoring takes a usefulness tax. **Risk:** STEER on adoption, and the successor pull grows with the AI share of the work. |

Two things the model does **not** affect: the accuracy of experiment readings (that noise is fixed), and the effect size directly (only through taste).

## 5. Do dropped candidates come back?

No. In `dropTest` ([research.ts:495](src/engine/v2/models/research.ts#L495)) the candidate under test is deleted, along with its updated belief. The team goes back to ideation and picks the best of the *remaining* pool once it has 2 candidates again.

The drop tests are absolute, not relative to other options:
- **Small experiments:** the posterior falls below 30% of the prior mean.
- **Scale test:** a single idea's effect at scale falls below 50% of its small-scale estimate.

So a candidate can be dropped even when it is still better than everything left in the pool. For ideas and axes, 3 drops means failure. Lines never fail, and their drop count resets after each result.

Whether this is right is a design call. Realistically, a failed ablation is information. A "known weak" candidate that stays in the pool at its posterior would be more consistent with how picking works.

## 6. What the CES X(c, ℓ) is

X is the experiment throughput of a project per day, relative to the leader lab's day-0 inputs per project (= 1):

$$X(c,\ell) = \left[u\,c^{\zeta\rho} + v\,\ell^{\rho}\right]^{1/\rho}$$

- **c** = experiment FLOP per day, in units of the leader's day-0 FLOP per project.
- **ℓ** = (m_EXP × research engineers ÷ 2 team-equivalents)^0.5, i.e. effective engineer labour with AI included.
- **ρ ≈ −0.12.** Because ρ < 0, compute and labour are **complements**: piling on one alone saturates.

The parameters are fitted from three AI-Futures anchors: infinite labour caps X at 100, infinite compute caps it at 1,000, and 10× less compute is 2.5× slower. That gives:

| Inputs | X |
|---|---|
| Both at day-0 level | 1.0 |
| 10× compute | 2.3 |
| 10× labour | 2.5 |
| 10× both | 6.4 |
| 0.1× compute | 0.4 |

The stage's work rate is X × speed modifiers.

## 7. How compute is budgeted

You set **four sliders**: Training / Research / Serving / Safety. These feed six pools ([split.ts](src/engine/v2/departments/split.ts)):

```
Training ─┬ training runs (each run's poolShare; the stream takes 15%)
          ├ idle training ─→ experiments (or data, if the spareTraining policy says so)
          └ synthetic data (a sub-slider)
Research ─┬ experiments ─→ eval inference first, then split ∝ research engineers:
          │                projects in experiments (2 engineer team-eq each) and routine tuning
          └ agents ─→ engineering / routine research 0.65 / frontier research 0.15
                       (the split is auto-optimised by the golden-section "best mix" unless set by hand)
Serving ──  products; spare serving capacity → routine-research agents
Safety ───  monitors (monitor budget policy) → safety agents (your share, default 0)
            → open investigations → whatever is left: safety line experiments,
              split ∝ engineers × each agenda's compute need
```

**Between capability and safety research:** only the top-level Safety slider decides. Safety research gets what's **left of the safety pool** after monitors. The only flow between pools is spare serving going to *capability* research. Experiment FLOP is also scaled by the `train` stack and by P13.

**People** follow similar fixed orders:
- **Capability research engineers:** run operations → evals → project experiments (≤ 75%) → tuning.
- **Safety research engineers:** investigations and patches → line experiments (≤ 50%) → tool upkeep.
- **Engineers:** runs → upkeep → builds.

## 8. Are capability and safety research combined?

Partly, and that's why it feels messy.

**Shared:**
- one tree;
- one priority queue;
- one risk policy;
- the same pipeline shape (ideation → small experiments → test);
- the same CES and taste functions.

**Separate:**

| | Capability | Safety |
|---|---|---|
| Engine | `research.ts` | `lineProjects.ts` |
| Team allocator | Priority + swaps | ETA-greedy |
| Engineer allocator | `allocate` | `safAllocation` |
| Compute pool | Experiments | Safety remainder |
| AI labour | Agent uses | Safety package + Trusted to AI |
| Result | Stack number | Finding / Beta posterior |
| Failure rule | 3 drops | Dead-end posterior |

On top of that, the rolled path is a third mechanism.

**My recommendation:** one project engine with pluggable "result kinds" (stack effect, unlock, finding). That means one allocator for scientists, one for engineers, and one compute ledger with a capability/safety split as a visible policy. The differences that should stay are real domain differences: what a result is, and whose compute it uses.

## 9. The recipe stacks in plain terms

Each stack is one "how good is our know-how" number, in OOM, that adopted research raises:

| Stack | Plain meaning | Where you feel it |
|---|---|---|
| **pre** | The same pretraining FLOP gives a smarter base | Every new base's G. Scale-dependent ideas can grow or fade with run size. |
| **rlMid** | RL needs less compute to reach the same gain | Post-training gets more from the same RL budget |
| **rlCeil** | RL can reach higher at all | The upper limit of post-training |
| **train** | More useful FLOP per chip-day (utilisation, uptime) | Runs finish sooner and experiments get more FLOP. Capped at +0.3 OOM. |
| **serve** | Cheaper to run models | First decode utilisation 0.07 → 0.15 (every model), then fewer FLOP per token (new versions). More AI labour per chip, cheaper products. |

Rules that apply to all stacks:
- **Headroom:** 30% of each new idea waits for routine tuning to realise it.
- **Frozen at launch:** a run locks in the stack values when it starts, so research only shows up in models you train afterwards.

## 10. How data works ([production/data.ts](src/engine/v2/production/data.ts))

**Assets:** each has tokens, a domain mix and a quality factor q (the web = 1).

| Asset | Where it comes from |
|---|---|
| Public web | A finite world stock of 300T; the start crawl covers 90% |
| Licensed | 30T at the start; cash deals by domain at quality 1.5 / 2 / 3, delivered after 60 days |
| Synthetic | 20T at the start; generated with the synthetic pool's compute by a chosen teacher. Quality comes from the teacher's G and is capped at 1, or 1.5 with P10. **The data inherits the teacher's traits.** |
| Usage | Consumer products' output × your usage policy (none / standard / broad), at quality 0.5. Costs Civil Liberties approval. |
| Expert | Bought per domain at quality 3. Goes into RL suites, evals, and P12. |

**How a base uses it:**
- Its mix preset (balanced, codeMath, science, multimodal, synthetic, natural) sets target domain shares.
- It draws tokens slice by slice. Repeated tokens lose value by Muennighoff's law.
- The drawn shares give per-domain specialisation, 1.5·log₁₀(share ÷ reference), capped at ±1.3 OOM.
- Quality and repetition enter G through the loss law. P21 multiplies every token's worth.
- **Readout:** "data adequacy" of the next base, based on about 4 free epochs of unique tokens.

## 11. RL suites ([models/suites.ts](src/engine/v2/models/suites.ts))

There is one environment suite per RL family: math, SWE, ML research, long tasks, cyber, bio, and computer use (which needs P06). A family without a suite can't be trained.

Each suite has two numbers:
- **Fidelity.** Comes from the expert data built into it, with diminishing returns. It scales that family's RL ceiling.
- **Exploitability.** The share of tasks whose grader can be gamed. It drives safety signal S2, which grows reward hacking and, above 10% hacked episodes, "learned hacking".

How you work on them:
- **Build:** buy expert data plus engineer time; fidelity goes up.
- **Harden:** pay red-teamers plus engineer time; exploitability goes down, with diminishing returns.
- **Upkeep:** every suite needs engineers continuously.
- A post-training run freezes its suites' values at launch.
- The "RL focus" tree nodes only unlock *focusing* the budget on a family; broad RL uses every suite.

---

## 12. Designing the UX from first principles

The current standard is mostly about **presentation hygiene**: levels, tooltips, number formatting, one home per datum. That's necessary but it isn't a design method. It doesn't say what the screens are *for*. These are the questions I'd answer first, then the principles that follow from them.

### Questions to answer before drawing anything
1. **What is the player's role?** A lab CEO who allocates and sets policy, or an operator who tunes runs? This decides the right level of control. My reading of your direction: CEO plus chief scientist, deciding *bets* and *trade-offs*, not knobs.
2. **What decisions does the player make, and how often?** Build a decision inventory with each decision's cadence (once, monthly, per run, per crisis), its reversibility, and the lag before its effect.
3. **For each decision: what does the player need to know, and what is the trade-off?** That is the content of the screen. Everything else is reference.
4. **What mental model must the player build to play well?** Probably about six causal chains: people + compute + data → research → recipe → runs → models → uses → money and AI labour → back into research, with safety as a race against that loop. The UI's main job is to teach that model.
5. **What is automatic, and how does the player find out when automation is doing something they wouldn't want?** These are levels of delegation.
6. **Where does uncertainty live?** Belief vs. truth, estimates vs. realised values, hidden traits. How does the player learn whether to trust their instruments?
7. **When the player loses, can they explain why?** If not, the game feels arbitrary.
8. **What is the fun?** Discovery (a paradigm works in this world), tension (understanding vs. capability), mastery (finding the bottleneck). The UI should stage these moments.

### Principles I'd follow
1. **Design around decisions, not data.** Each screen is a decision surface: the choice, the levers, the before → after, and the binding constraint. Data that no decision uses goes in the codex. The current L0–L3 scheme ranks data by importance, but importance only means something relative to a decision.
2. **The UI's structure should mirror the simulation's causal structure.** One persistent "factory" diagram (the loop above) where each node is a screen and each edge shows a live flow. The player always knows where they are in the machine and what feeds what.
3. **Owned objects over parameters** (your tycoon direction). Teams, agent fleets, projects, datasets, suites, models and products are cards you own, assign and retire. Sliders only where the domain really is continuous, like the compute split.
4. **One grammar for similar things.** A capability project and a safety project should look and behave the same, differing only in result type. If the UI has to show three research mechanics, the player has to learn three. This is also the strongest argument for unifying the engine *before* building the UI.
5. **Marginal value as the main number.** Everything here is allocation under a complementary CES, so the most useful readout is "what one more X buys": the next team, engineer, 10% compute, or dollar of data. Show what binds, and rank the levers.
6. **Delegation ladder with management by exception.** Every subsystem has a sensible automatic policy that explains itself ("why is this team here"). The player overrides selectively and is alerted only when an automatic choice crosses something they care about.
7. **Show time explicitly.** Runs, research pipelines and certifications are things in flight, and they need a timeline: what lands when, and what a change now does later. Lags are the hardest part of this game to grasp.
8. **Epistemic honesty, with feedback.** Always separate *believed* from *measured*. When truth surfaces (a realised stack gain vs. its estimate, a false finding exposed), show the comparison so the player learns how calibrated their tools are.
9. **Reveal complexity when it becomes relevant, not on a tutorial schedule.** The agents panel appears when coverage becomes non-zero. Footholds appear when the first one is suspected. Data adequacy matters when the next base is short of data.
10. **Validate by understanding, not looks.** Test with players: "Why did X change?", "What would you do to speed up Y?", time-to-decision, and whether they can explain a loss. These replace "does the mockup look clean".

### What I'd change in the current standard
- **Strict "one home per datum" fights decision-centric design.** A decision often needs data whose home is elsewhere. Better rule: one *source*, rendered by one shared component, shown live wherever a decision needs it, never re-computed or reformatted differently.
- **"L0 ≤ 7 items" is arbitrary.** Derive the always-visible items from the decision inventory: what the player checks every tick versus once a month.
- **Add the missing parts:** the decision inventory, a causal-map spine, the delegation and exception model, timelines, marginal-value readouts, and comprehension testing. The current standard already covers tooltips, formatting and colours well; keep those.

**Suggested order:**
1. Unify the research engine.
2. Write the decision inventory.
3. Draw the causal map.
4. Paper-prototype the core loop.
5. Run comprehension tests.
6. Only then, visual mockups.

---

## [26] Designer (2026-11-22 09:27 UTC)

> what are lineup students? where do i see the three distilled students of the main model? where do these come from? did we train them? what are these?
>
> i feel like all the product's 'add-ons' like sectors, memory and such are very hacky and not properly integrated. 
>
> you notice how i had lots of questions about how the R&D in the game works, and this is as the designer, and after playing several games. that is a proof the current UI is not very clear, has lots of junk that doesn't help, doesn't structure information or provide it in the correct places. 
> I don't agree with the design around decisions not data - providing clear information to the player is paramont. 
> neither should the UI structure always mirror the engine - sometimes its clearer to do otherwise. 
> make sure to use language that does not refers to the game develoment  - rather player-facing. lots of strange terms and comments and explanations.
>
> now have a look at the current UI and think how to redesign the parts of the R&D we discussed.

### [27]–[29] Assistant

[…] (process chatter trimmed)

### [30] Assistant

# Small model sizes, add-ons, and a redesign of the R&D screens

## 1. "Lineup students": what they are

**They aren't real models.** Nobody trains them and they cost no compute. They are three price tiers the market model attaches automatically to every API and Enterprise product, and to every rival's model too ([serving.ts:398](src/engine/v2/worldfx/serving.ts#L398), [data/v2/serving.ts:202](src/data/v2/serving.ts#L202)).

How each one is built:
- **Size:** 1/2.8, 1/5.7 and 1/80 of the main model's active parameters. These ratios come from the price ladders AI labs publish (top, middle and small models).
- **Quality:** the main model minus a fixed distillation gap: −0.61, −0.88 and −1.94 OOM.
- **Price:** in proportion to size.
- **Who buys them:** buyers choose among every tier on offer, task by task, by value for money.
- **Chat's "student free tier"** is the same idea, one year of progress below the main model.

**Where you see them:** only on the Products cards, as the "Lineup" rows of API and Enterprise ("student 1/2.8 … student 1/80"), and as "student free tier" on Chat. They never appear under Models, because they aren't models.

**The problems:**
- This contradicts the "owned things" direction: products sell models you never made.
- It also duplicates the real **Distill a mini** action, which does exist and costs compute.
- There's a formatting bug: "$0.67¢".

**What I'd do:** make sizes real. A product sells the models you actually distilled. Either offer a one-click "make the standard size ladder" (three distillations, with their compute cost and time), or keep the phantom tiers only for rival labs.

## 2. Product add-ons are hacky: I agree

What I found in [data/v2/features.ts](src/data/v2/features.ts):
- **Four unrelated mechanisms under one label:**
  - "opens X% more of a market", with made-up shares (10%, 15%, 20%);
  - longer time horizon;
  - "+0.3 OOM of fit at ×N tokens";
  - an effort setting.
- **Built twice over:** a feature is built once for the whole lab, switched on per product, and some also boost your internal AI staff, invisibly.
- **Deep think duplicates** the product's own effort selector (low / max / deep think).
- **Sector packs are a feature that unlocks an action.** That action creates a world-level "sector certified" date, which then adds a flat +0.42 to one product's fit, ×3 demand weight, and lower adoption resistance.
- **Risks are flat multipliers** (×1.2, ×1.3) with no mechanism behind them.

A cleaner model, in player terms:
- A **product** = which models it serves (real sizes) + which **tools** it gives them (coding harness, computer use, memory, research mode) + which **markets** it is certified for.
- **Tools** do one thing each: they let the model do work it otherwise can't, or do it better at a stated cost per task. Every tool shows exactly where it helps, including your own AI staff if it applies there.
- **Market certification** is a per-product project with a visible "certified on" date and a visible effect on that market.

This is engine work. I'd design it together with the screens.

## 3. What the screenshots show

I built the game into a scratch folder, played 300 days (seed 4242, leader start, tutorial off) and captured every R&D-related screen. You're right: even knowing the code, it's hard to read. The main problems:

**The R&D story is scattered across 8 screens, each with its own layout:**

| What the player thinks about | Where it is now |
|---|---|
| Capability research | Research › Projects |
| Safety research | Safety › Research lines (a different table, different columns, different words) |
| What research has achieved | Research › Recipe |
| People and hiring | Company › Agents & teams |
| What people and AI are working on | Company › Work, plus the "teams wanted" column on Research, plus Safety |
| AI staff | Company › Agents & teams (top half) |
| Compute | Compute › Split, plus "Research mix" and "agents by use" |
| Data and training environments | Models › Data and Models › Suites, though they are inputs to *training*, which lives in Blueprint |

**Developer language everywhere.** On screen today:
- symbols: "Compute c", "Labour ℓ", "ω 1.00", "S2", "G 27.69", "Q";
- engine units: "team-eq", "OOM", "t-wk", "tm", "−1.4 SD";
- raw notation: "1.1e24/day", "2.2e12 FLOP/tok";
- internal terms: "Pool · ideas get harder", "fit vs people · coverage", "as routine", "lineup only", "Natural mix vs reference shares", "6 team-mo lost";
- ambiguous labels: "catch 89% · 53% scheming · same model".

**Numbers without meaning:**
- The Recipe tab lists adopted ideas as "+0.0058 ±0.0011 OOM → next model". A player can't tell whether that is good.
- Milestones show "Software fit −2.46 OOM".
- "What more of each buys" draws four flat lines, all labelled "saturated", which tells the player nothing.
- The research-mix chart spans 1.04×–1.11× and says "now = best".

**The chain from research to outcome is invisible.** Nothing says "your research this quarter will make your next model X% better" or "your next base will train on a recipe worth ×3 compute". Blueprint has a prediction, but it is three screens away from Research.

**Capability and safety research look like different games** even though the mechanics are nearly the same.

## 4. Principles for the redesign

These are revised after your feedback: information comes first, and the layout follows the player's understanding, not the engine.

1. **Clear information first.** Every number answers "so what?": it is in a unit the player cares about (time, money, capability level, risk, compute multiplier) and has a comparison (vs. last month, vs. a rival, vs. a target).
2. **The player's language, never the model's.** No symbols, no scientific notation, no engine units. Each concept gets one name used everywhere, with a tooltip for depth.
3. **Organise by the player's questions, not the code's modules.** For example, data and training environments sit with training, because that's what they're for, even though the engine keeps them elsewhere.
4. **Same kind of thing, same look.** Every research project, capability or safety, uses one card. Every workforce (engineers, research engineers, scientists) uses one card.
5. **Show the chain to the outcome.** Research → know-how → next model → what it does for products and for your AI staff. Every R&D screen links forward.
6. **Uncertainty in plain words.** "Likely +2–4%", "the team is fairly sure it works", "unknown until tested at scale".
7. **Delete readouts that don't inform.** Internal diagnostics move to a designer overlay that players never see.

### Questions each screen must answer at a glance

| Screen | Questions |
|---|---|
| **Research** | Is research going well? What finishes next? What's slowing it down? Is safety keeping pace with capability? |
| **Know-how** | How much better is our recipe than at the start, and than rivals'? What will it give the next model? |
| **Workforce** | Who works on what, human and AI? What does more of each buy? Where are we short? |
| **Compute** | Where do our chips go, and what would moving 10% change? |
| **Training** | What model will this run produce, when, at what cost? Is data or environments the limit? |
| **Products** | What does each product sell, to whom, with which models and tools? |

## 5. Proposed structure

```
LAB         Workforce · Compute                  (inputs: people, AI staff, chips)
RESEARCH    Portfolio · Discoveries (tree) · Know-how
TRAINING    Next run (blueprint) · Data · Environments · Runs in progress
MODELS      Your models (family tree, cards, evaluations, sizes)
PRODUCTS    Products (models + tools + markets)
SAFETY      Understanding · Model risks · Tools · Cases      (safety research moves into Research)
```

### Research › Portfolio: one list, two departments, one card

```
CAPABILITIES  9 teams · 22 research eng.            SAFETY  2 teams · 1 research eng.
──────────────────────────────────────────────      ──────────────────────────────────────
▸ Scaling recipes      ongoing   ●● teams           ▸ Deception probe     Applied interp.
  ideas ▓▓▓ small test ▓▓ big test ░ build-in          ideas ▓ small test ▓▓▓ validate ░
  next result in ~4 d · likely +1.5% compute value     result in ~86 d · team thinks 60% it works
  limited by: compute                                  limited by: engineers
```

- **Ongoing programmes** (today's "lines") show "results so far" and "returns falling: each result is worth about ⅔ of the first".
- **One-off projects** show "chance it works in this world".
- **Safety programmes** show the programme's outlook (Promising / Mixed / Struggling) in the same slot.
- **Clicking a project** opens a detail panel:
  - the idea under test, in words ("a mid-sized idea, may not hold at scale");
  - what it gets ("2 research engineers, 1% of experiment chips");
  - what one more team would cut off the time;
  - for safety, what a working result unlocks.
- **A header strip** shows the split of people and chips between capability and safety research. This is the one place that trade-off is set.

### Research › Know-how (replaces Recipe)

Five cards in plain words:

| Today's name | Player-facing name |
|---|---|
| pre | Pretraining recipe |
| rlMid | RL method |
| rlCeil | RL environments |
| train | Training efficiency |
| serve | Serving efficiency |

Each card shows:
- the value as a **multiplier** ("each chip of pretraining is worth ×2.9 vs. 2025") with a trend line and the leading rival's estimate;
- **"not yet in a model: ×2.2 waiting"**, linking to Training;
- **"tuning backlog: 30%"** instead of "headroom";
- the idea list folded away, with each idea as "+1.3%" rather than "+0.0058 OOM".

### Lab › Workforce (merges Company tabs, AI staff and allocations)

There are three department columns, and each reads top to bottom: *people → AI staff on this job → total effort → where it goes*.

| | Engineers | Research engineers | Scientists |
|---|---|---|---|
| People | 600 | 1,200 | 400 |
| AI staff | Atlas-1.0 · 291 copies · does 0.1% | Atlas-1.0 · 944 copies · does 0% | Atlas-1.0 · 218 copies · 8% |
| Total effort | ×2.3 of the people alone | ×1.4 | ×1.1 · taste ×1.0 |
| Where it goes | runs 0% · upkeep 100% · builds 0% | operations · evals · experiments 70% · tuning 30% | 6 projects (link to Research) |
| Next hire buys | +4% build speed | +1.6% research speed | … |

- The same columns repeat for safety staff.
- Milestones become a single "how close is AI to doing each job" bar per department, labelled *vs. median expert* and *vs. best human*, not OOM.

### Lab › Compute

- **One flow picture:** chips → training / research / serving / safety → each consumer: runs, experiments, each AI-staff job, monitors, safety research.
- **Ranked levers:** "+10% to experiments → research +6%" and so on.
- **"Spare capacity" defaults:** shown in one place, in words.

### Training

- Blueprint becomes **Next run**.
- **Data** and **Environments** move here as the run's ingredients, each with "enough / short" against the planned run.
- Environments use plain words: "realism" for fidelity, "loopholes" for exploitability, and "hacking pressure on this run" instead of S2.
- **Runs in progress** with a timeline.

### Models and Products
- **Models** shows real sizes (distilled models) in the family tree.
- **Products** shows its models, its tools and its markets, as in §2.

## 6. Engine changes this design depends on
1. One research-project engine and one team allocator for capability and safety.
2. Real product sizes instead of phantom tiers.
3. A rework of product tools and market certification.
4. Removing the rolled tree nodes (kyc, P27) and the duplicated level conversions.

Without these, the UI either shows three different research systems or hides real differences behind one look.

## Suggested next step

I'd render mockups of **Research › Portfolio**, **Know-how** and **Workforce** with this game's real numbers, for you to react to before anything is built. I'd also write a player-facing vocabulary table (every on-screen term → its new name and tooltip) as the base for the language clean-up. Want me to go ahead with both?

---

## [31] Designer (2026-11-22 09:39 UTC)

> so i feel various things (like the products, lineup and probably more i just didn't notice yet) in the R&D are hacky in the game, systems that are messy and entangled without good reason, legacy stuff from older versions cluterring and confusing. 
>
> so i think we have some enigne/simulation issues, as well as the UX/UI problems. 
>
> regarding your proposed structure - under LAB you have compute - that should only be the compute allocation - not dealing with constructing datacenters and buying chips and such, which should remain its own tab as currently.

### [32] Assistant

Agreed. The structure becomes:

```
COMPUTE     Datacenters · chips · cloud · orders   (as today: building and buying)
LAB         Workforce · Compute allocation          (who and what works on what)
RESEARCH    Portfolio (capabilities + safety) · Discoveries · Know-how
TRAINING    Next run · Data · Environments · Runs in progress
MODELS      Your models, sizes, evaluations
PRODUCTS    Products: models + tools + markets
SAFETY      Understanding · Model risks · Tools · Cases
```

I also saved your positions so future work follows them: clear information comes first, the screens don't have to mirror the engine, everything on screen uses player language, and chip buying stays separate from compute allocation.

## Two tracks, engine first

The UI can't be clean while the simulation underneath has three research systems, phantom product tiers and leftovers from older versions. So I'd fix the engine first, then design the screens on top of it.

**The engine track starts with a systematic hunt, not just the issues we happened to notice.** I'd check every R&D-related system against six tests:

1. **Phantom:** does it act like something the player owns (a model, a dataset, a tool) that was never made and costs nothing? The lineup students fail this.
2. **Made-up effect:** is it a flat multiplier or share with no mechanism behind it, like "opens 15% more users" or "incidents ×1.3"?
3. **Tangled:** does one feature do several unrelated things, or one thing in several places? Sector packs and the features that also boost your own AI staff fail this.
4. **Duplicated:** are there two ways of doing the same job? Two research engines, two team allocators, three conversions between capability level and compute.
5. **Leftover:** is it kept from an earlier version, a bridge or migration that is now dead or still quietly wired in? Rolled tree nodes, progress-years, the old production function.
6. **Hidden:** does it have an effect the player can't see or trace? Feature boosts to internal AI staff, the automatic compute-mix re-split.

**Scope:**
- research (capability and safety);
- teams and AI staff;
- compute allocation;
- data;
- training environments;
- training runs;
- models and sizes;
- product features and markets.

**Output:** one list. For each issue: what's wrong, its evidence in the code, what the player sees today, and a proposed fix (remove, merge, make real, or make visible). Then group the fixes into small build tasks in the order the UI needs them.

## Question before I start

The hunt is worth doing in parallel: a few agents, each on one area, then a check that confirms each finding against the code. That catches far more than one pass, but it costs noticeably more tokens than this conversation so far. Should I run it that way, or do it myself sequentially, which is slower and cheaper and will probably miss some?

---

## [33] Designer (2026-11-22 09:42 UTC)

> go ahead, use agents in parallel, we are not token limited. but use subagents of opus 5.5 medium effort for more routine stuff, and opus 5.5 high effort for things that require more understanding and judgement. 
> in general, prefer to use subagents for scoped tasks rather than do yourself - since that manages your context better.

### [34] Assistant

[…] (process chatter trimmed)

### [35] Assistant

I've started six auditors in parallel, each covering one area:

1. Capability research
2. Safety research and safety tools
3. People, AI staff and compute allocation
4. Data, training environments and training runs
5. Models, sizes, products and add-ons
6. How capability is measured and compared, including how rival labs do research

Each checks its area against the six tests (phantom, made-up effect, tangled, duplicated, leftover, hidden) and writes its full findings to a scratch folder outside the repo. When they finish, verifier agents will check each finding against the code. Then I'll merge everything into one prioritised list and a set of small build tasks. I'll report back when the results are in.

### [36] Assistant

The safety audit is done (26 issues). I'm starting its verifier now, so each area gets checked as soon as its audit finishes.

### [37] Assistant

The products audit is done too: 25 issues, 7 of them high severity. Its verifier is now running. Four audits are still in progress.

### [38] Assistant

The people, AI staff and compute audit is done: 25 issues, 6 high. Its verifier is running. Two of its claims are real bugs, which the verifier will try to reproduce:
- hiring more research engineers can slow capability projects;
- the automatic research mix starves engineering.

Three audits are still in progress: capability research, training, and capability measures.

### [39] Assistant

Five of the six audits are done, and each now has a verifier running. The last one still in progress is the audit of how capability is measured and how rival labs do research.

### [40] Assistant

All six audits are done: about 160 issues in total, roughly 34 of them high severity. Each area's verifier is now checking every finding against the code. When they finish, I'll merge the confirmed findings into one prioritised list and build plan.

### [41] Assistant

The safety verification is back: all 26 findings hold (24 fully, 2 with small corrections), and it found 2 new issues. I'm still waiting on the other five verifiers.

### [42] Assistant

The products verification is back: all 25 findings hold (21 fully, 4 with small corrections), plus 4 new issues. Four verifiers are still running: people, AI staff and compute; training; capability research; and capability measures.

### [43] Assistant

The capability research verification is back: all 25 findings hold (21 fully, 4 with small corrections), plus 3 new issues. Three verifiers are still running: people, AI staff and compute; training; and capability measures.

### [44] Assistant

The people, AI staff and compute verification is back: all 25 findings hold (21 fully, 4 with small corrections). It reproduced two of the bugs:
- **Automatic research mix:** it cuts engineering build capacity roughly in half.
- **Safety compute:** its claims add up to 140–160% of the pool.

It also found 3 new issues. The training and capability measures verifiers are still running.

### [45] Assistant

The training verification is back: all 32 findings hold (30 fully, 2 with small corrections), and it reproduced two of the bugs. Only the capability measures verifier is still running. When it finishes, the synthesis step starts.

### [46] Assistant

All six verifications are back. Of roughly 160 findings, none were wrong; about 23 needed small corrections, and the verifiers added about 20 new issues. Next I'm starting a synthesis agent at high effort to merge everything into one list grouped by root cause, plus a target design and a set of small build tasks.

### [47] Assistant

The synthesis agent is running. It's merging the six audits and their verifications into:
- the main root causes;
- a separate list of real bugs;
- a cleanup batch of dead code to delete;
- the design decisions that are yours to make;
- a phased build plan of small tasks.

I'll bring you the summary and the decisions when it finishes.

### [48] Assistant

[…] (process chatter trimmed)

### [49] Assistant

# R&D audit results: what's wrong, real bugs, and 21 decisions for you

Six auditors and six verifiers went through the R&D simulation. They found 178 issues plus 12 leftover items, and **none of the findings were wrong**; the verifiers only corrected details. The full synthesis (851 lines) is at `C:\Users\david\AppData\Local\Temp\ai27ux\audit\SYNTHESIS.md`, with one detailed file per area beside it. They're outside the repo for now.

## Seven root causes behind almost all of it

1. **New mechanisms were added next to the old ones instead of replacing them.**
   - Two research engines (capability and safety), plus a third simplified copy that still steers the daily compute split and every preview.
   - The old dice-roll path for two tree nodes.
   - Two people allocators.
   - Seven ways to make a model and four ways to make a smaller one.
   - Rival labs on a partial copy of your mechanics.
2. **Old units survive as converters.** Display levels, progress-years (about 43 places) and the old research-speed unit are still in use. Result: "superhuman coder" has four definitions and "how far ahead" has seven.
3. **Effects aren't attached to things you own.**
   - Phantom models: the lineup sizes, the free-tier model, copy variants.
   - Free assets: environment suites, and a learning stream that re-pretrains for free.
   - Silent rerouting of spare compute.
   - "A team is on this line" switches tools, monitoring and healing on and off.
4. **Flat numbers stand in for missing mechanisms.** Examples: paradigm multipliers, a taste lift set by a compute-share ratio, 30% held back as "headroom", and fudge factors that make rivals match targets.
5. **What you're told isn't derived from what happened.**
   - The measured level ignores the evals.
   - "Realised" recipe values are hidden truth.
   - Safety Health is a rule of thumb.
   - Dozens of preview lines are numbers that nothing applies.
6. **Allocation defaults hide their side effects.**
   - Tuning absorbs every spare research engineer.
   - Auto research mix gives up about half of build capacity.
   - The safety compute pool can be committed at up to 160%.
   - Nothing is ever shown as idle.
7. **Some inputs are read when a run launches and others when it finishes.**

The fix has the same shape everywhere: one mechanism per job, one unit, attached to a thing you own, with readouts and previews computed from that mechanism.

## Real bugs: 47 confirmed

27 give wrong outcomes and 20 show wrong information. **41 can be fixed now**, independent of the redesign. Some examples:
- The Synthetic data mix can never be launched.
- Hiring research engineers can slow your projects.
- Auto research mix halves build capacity.
- A certified sector pack is lost for good if its host product is retired.
- Rivals grow staff twice on day 1.
- Unlock projects show an effect band that does nothing.

## Decisions that are yours

The synthesis has a recommendation for each. I agree with all of them. If you accept them, I'd start.

| # | Decision | Recommendation |
|---|---|---|
| 1 | Smaller models | Real distilled models for everyone, with an automatic "make a cheap tier" policy. No phantom sizes. |
| 2 | What a product is | Each product competes in the market on its own. Gov and Trusted become product settings. Open weights is a release, not a product. |
| 3 | Product tools | Product tools act only on the product. Boosts to your own AI staff are a separate thing you own on the research side. |
| 4 | Sector packs | A pack belongs to one product: a sector adaptation plus certification for that product's buyers only. No world-wide effect. |
| 5 | Continual learning | A real, paid training run, for you and for rivals. Expect late-game pace to slow, so the timeline dates need re-checking. |
| 6 | Ways to make a model | Two acts: pretraining (new / continue / distil) and RL. Base size matters in RL. |
| 7 | Expert data | Only used to build environment suites. A newly unlocked family starts with no suite. |
| 8 | Measured level | Read from benchmark scores, so sandbagging can actually fool you and the government. |
| 9 | Milestones | One definition, by work type, for every lab. |
| 10 | Lead | Measured from each lab's capability history. The constant compute term is dropped. |
| 11 | Allocation | Ordered needs with real demands, and idle shown as idle. Auto research mix removed, replaced by a "suggest" button. Research engineers operate runs, and a shortfall slows runs. |
| 12 | Headroom | Removed: an idea lands at its full effect when it's built in. |
| 13 | AI research taste | Set by how much of the idea work AI actually does, the same for every lab. |
| 14 | Paradigms | Each gets a real, typed effect or is deleted (P13 and P19 deleted). Rivals adopt the surviving ones, which replaces their fudge factors. This is the biggest calibration risk. |
| 15 | Safety result | One project answers one question: works or dead end. Discoveries become events of a line. No candidate pool. |
| 16 | Safety effects | Known safety-training methods become options in the training plan. Monitoring comes from monitors you deploy. Nothing toggles with staffing. |
| 17 | Knowledge spread | One sourced rule for every lab. Needs a research task on primary sources first. |
| 18 | Rivals | Rivals train through the same functions you do. |
| 19 | Spare compute | No silent rerouting. Idle is shown as idle, with an explicit auto-split policy if you want it. |
| 20 | Old saves | Refuse saves older than rev 33 now; a clean save break at the end of the engine work. |
| 21 | Naming | Capability "lines" become "directions"; safety keeps "lines". Final player-facing names come with the UI work. |

Small default calls also apply unless you object: remove the `kyc` node, fold the T-SPEC and T-HARDEN tools into their training options, cut the "Result" stage, and so on. They're listed in synthesis §5.

## Build plan

There are 10 phases, and each leaves the game working and calibrated:

| Phase | What |
|---|---|
| 0 | Cleanup: deletions only, no behaviour change |
| 1 | Bug fixes |
| 2 | One capability unit, one milestone definition, one lead measure |
| 3 | One research engine and one allocator |
| 4 | Safety outputs |
| 5 | Rivals on the same research |
| 6 | Training acts and measurement |
| 7 | Products and market |
| 8 | Save break and naming |
| 9 | The UI redesign |

Each UI screen can start once its engine phase has merged.

## Next steps
1. **Your answers to the decisions.** Accepting all the recommendations works, or tell me which ones to change.
2. **Phases 0 and 1 (cleanup and the 41 independent bugs) don't depend on any decision.** I can start them now as small subagent tasks, in a separate worktree so the other sessions aren't disturbed, with the full test suite run before merging.
3. **Saving the plan in the repo.** I'd copy the synthesis and the area reports into `design/` (e.g. `design/RD-AUDIT/`) and add the tasks to `design/V3-TASKS.md` in the usual format, committed on a branch.

Should I go ahead with 2 and 3 while you look at the decisions?

---

## [50] Designer (2026-11-22 10:26 UTC)

> decisions: i agree with all recommendations except the following:
> 1. smaller models - real distilled models for everyone, no phantom sizes. we still want to allow in each product to give a lineup of other models (not necessarily distilled). does that make sense?
>
> 18. I am ok (and think prefereable) to have simplified versions of things for the rivals - we just want some 'rough' way to simulate what they do - we don't need a full fledged company run by an autonmous player. that is too complicated to defined strategies for, to balance, and heavy on compute. but the simplifications should be done properly still.
>
> i feel like safety still has a bunch of messy strange stuff - understanding, research lines, tool upkeep, investigations and more - in a way i feel like the safety mechanisms in the game are the messiest and most unclear. (i don't mean the player needs to know everything - not knowing the real model state is the point, i mean understanding what the game allowes him to do and what information and tools he does have).

### [51] Assistant

Makes sense on all three. Here's how I'd fold them in, then I'll start the safety work.

## 1. Product lineups of real models: yes

A product offers a **lineup of models you own**, any of them: a distilled small model, an older full model kept for its low price, a specialised post-train. Buyers choose among the lineup task by task, as they do now with the phantom tiers. The difference is that every entry is real: it was trained or distilled, it has its own serving cost, evaluations and traits, and it can cause incidents.

Distillation is just the usual way to get a cheap entry. The "auto-make a cheap tier" policy stays optional. Rivals' lineups are real too, at their simplified level (see 18).

## 18. Simplified rivals, done properly: agreed

Rivals stay a rough aggregate, not a second autonomous company. "Done properly" would mean:
- **The same units and quantities as you:** effective compute, chips, staff, models with a capability and a size. Nothing in old units.
- **Aggregate state instead of detail:** a research rate, not projects; a model release cadence, not run designs.
- **Every simplification is a stated stand-in for a real mechanism,** with its parameters sourced or fitted once, not per-lab fudge factors bolted on to hit a target.
- **What they produce is real in the world:** their models, lineups, releases and leaks are actual objects that you and the market interact with.

So decision 18 becomes "aggregate stand-in, documented and in your units", and decision 14's rival part becomes "rivals adopt paradigm effects through their aggregate research rate".

## Safety: you're right, it needs its own redesign

The audit looked at safety *research* and found it the messiest area. The rest of safety wasn't audited as a whole:
- understanding,
- tool upkeep,
- investigations and cases,
- responses,
- monitors,
- the eval gate,
- the trait graph,
- footholds, danger and control.

The issue you describe isn't hidden truth, which is deliberate. It's that the player can't tell what safety lets them *do*, what *information* they have, and what each tool or action actually buys.

I'd handle it in two steps:
1. **Inventory, starting now.** One agent maps every safety thing from the player's side: each action, readout, mechanism and policy. For each: what it lets the player do or know, what it does in the engine, where it's shown, and where those disagree or overlap.
2. **Redesign.** From that map, a first-principles safety model built around a few clear player questions, roughly:
   - *What do I know about this model, and how sure am I?*
   - *What could it do, and what stops it?*
   - *How do I learn more?*
   - *How do I fix what I find?*

   Each question would have one set of tools and one set of readouts. This replaces audit decisions 15 and 16 with a fuller version.

I'm launching the inventory now, and saving your decisions so later work follows them.

### [52] Assistant

I've recorded your decisions next to the audit (`DECISIONS.md`) and in my notes, so later work follows them.

One question from last time is still open, and none of the safety work affects it:
- **Phases 0–1:** should I start the cleanup and the 41 independent bug fixes as small subagent tasks in a separate worktree, with the full test suite run before merging?
- **Saving the plan:** should I copy the audit, synthesis and decisions into `design/` and add the tasks to `design/V3-TASKS.md` on a branch?

The scratch folder they live in now could be cleared by Windows, so saving them in the repo is the safer place.

The safety inventory agent is running. When it's back I'll bring you the confusions it found and a proposal for the safety redesign.

---

## [53] Designer (2026-11-22 10:33 UTC)

> you can start on phases 0-1, and save the plan

### [54]–[56] Assistant

[…] (process chatter trimmed)

### [57] Assistant

Phase 0 is under way:
- **Plan saved** on branch `rd` (worktree `../AI27-rd`):
  - the full audit, the synthesis and your decisions in `design/RD-AUDIT/`;
  - a new section H in `design/V3-TASKS.md` with the Phase 0–1 rows. It marks TIERS2 as superseded by your lineup decision, and parks three safety bug fixes until the safety redesign.
- **Two cleanup lanes running in parallel**, each in its own worktree:
  - Lane A: retiring the old production function, then removing the calShift bridge, the P26 placeholder and dead exports.
  - Lane B: the save floor at rev 33, then the safety and people dead fields.
- **When both lanes finish:** I'll merge them into `rd`, clean up the stale comments, run the full test suite once, and then start Phase 1's bug fixes the same way.
- **Safety inventory:** still running in parallel.

---

# Part 2: later designer statements

Verbatim, in order. Later designer messages that were only questions or status requests ([139], [336], [343]) are left out.

## [67] (2026-11-22 10:53 UTC)

*Context:* Reply to the safety redesign proposal ([66]; saved in full as design/RD-AUDIT/SAFETY-REDESIGN.md), which ended by asking whether to accept its 11 safety recommendations.

> i accept all recommendations for decisions here.

## [102] (2026-11-22 13:58 UTC)

*Context:* Said while the Phase 0–1 fix lanes were running, each task spending most of its time in test runs.

> i think running tests and stuff takes way too long

## [105] (2026-11-22 14:03 UTC)

*Context:* Reply to the assistant's analysis of why tests are slow and its proposed test-tooling changes ([104]).

> i think the only easy solution is to limit what we test and how often. do you think its safe if we don't run tests on every single thing, rather only after big chunks? say in our entire plan only run tests 3-4 times in total.

## [107] (2026-11-22 14:05 UTC)

*Context:* Reply to the assistant's proposal ([106]): per-task checks that take seconds (TypeScript compile and the task's own test), heavy test runs only at 4 checkpoints, a calibration run only on the few big timeline-moving tasks.

> ok.

## [117] (2026-11-22 14:32 UTC)

*Context:* Reply to the choice between A, refit the authors2026 scenario's three values now, and B, defer the refit to checkpoint 2 on the unified research engine.

> i don't think there much point in doing calibration to systems that will change

## [141] (2026-11-22 20:55 UTC)

*Context:* Reply to the assistant saying checkpoint 1's tests took about 37 minutes, and that its agent had since spent over an hour bisecting a known calibration shift.

> 1. 37 minutes is not fast.
> 2. wtf??? its been over 3 hours. your job is to manage the subagents, that includes being aware of the time.

## [145] (2026-11-22 20:58 UTC)

*Context:* Reply to the checkpoint 1 report, which listed a failing lint because five product actions had no cost line "now that invented costs are gone".

> who the fuck made this stupid rule that every action must show a cost and then decided the way to go was to invent fake costs? do you have no judgement or common sense at all?? 
> and you need to udnerstand - in a development program such as ours, its totally ok for things to fail, trying to keep everything running and perfect at each stage is a waste of time.

## [148] (2026-11-22 20:59 UTC)

*Context:* Reply after the assistant said the cost rule would be removed, and asked about a leftover temp worktree.

> we will clean up at the end. get going on the actual work

## [341] (2026-11-23 07:18 UTC)

*Context:* Late in the session, after context compaction, during the calibration checkpoint.

> what is left to do?
> this session has been going on for too long, and i often feel that after compaction you lose sight of what we want and add more garbage

## [345] (2026-11-23 07:23 UTC)

*Context:* Reply to the assistant's account of the post-compaction work and its offer of a fresh-eyes review against DECISIONS.md.

> i don't know what to do. i don't trust you, i think you introduced garbage since you easily loose track after compaction of the big picture and become extremly tunnel visioned on unimportant stuff. 
> also, any reason to continue the calibration here, and the UI work?

## [347] (2026-11-23 07:27 UTC)

*Context:* Reply to the assistant's options for the post-compaction work (review the diff in a fresh session, or roll back to the pre-compaction anchors) and its offer to stop the agents and write a handoff.

> lets stop the agents.
> what we will need to pick up in a new session:
> 1. finish calibrations
> 2. vocabulary and UI work and save break
> 3. merge to master
> 4. cleanup

## [350] (2026-11-23 07:30 UTC)

*Context:* After the handoff file (HANDOFF.md) was written; this led to the present file.

> at the very start of this session we had very imortant convesration about UI work, and in general i think the head of the conversation, where we talked, before you started any work - is what contains everything important
