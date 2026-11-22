# Audit: training inputs and training (data, environment suites, run design, runs, evals)

Scope: src/engine/v2/production/{data,dataActions,dataView}.ts; models/{suites,runs,effective,capability,evals,benchmarks,actions,design}.ts; data/v2/{dataAssets,suites,runDesign,evals,benchmarks,calibration}.ts; UI panels Blueprint, Data, Suites, Evals, Models. I read the code only and did not run the game. Line numbers are from the master checkout on 2026-11-22.

Counts: 6 high, 16 medium, 10 low (32 entries).

---

### TRN-01 The "Synthetic" data mix can never be launched from the Blueprint
- Test(s): 5, 1
- What: `planRun` refuses a base whose data option is `synthetic` unless the run has a `teacherVersionId`. The Blueprint never sends a teacher for a base run, so the card is always refused, even after P10 unlocks it. The refusal also overwrites the "Needs P10" lock reason. The teacher is a v1 leftover: the draw already takes synthetic tokens from the portfolio, and those tokens carry their own teachers. The base run's teacher is used only to seed `traitsTrue`, and `applyBaseToLineage` overwrites that at once.
- Evidence: runs.ts:315-317 (lock reason, then `reason = 'Synthetic data needs a teacher version'`); Blueprint.tsx:108-110 (`toLP` base branch sets only `lp.base`); runs.ts:522, 529 (teacher → `traitsTrue` placeholder); safety/traits.ts:977-981 (traits rebuilt from the draw's synthetic teachers `synTeachers(s, q.draw)`); glossary.ts:286 ("Synthetic-heavy … needs a teacher").
- Player sees: an option card that P10 "unlocks" but that always fails with "Synthetic data needs a teacher version", and no teacher picker on a base run.
- Fix: remove. Drop `teacherVersionId` from base runs and the synthetic check. Teachers are already recorded per synthetic asset and in `base.teacherData`.
- Severity: high · Effort: S

### TRN-02 The continual-learning stream re-pretrains a base for free
- Test(s): 1, 2, 6
- What: Each day the stream rewrites the version's pretraining G as `base.gPre − base.ePre + today's pretraining recipe`. That is today's whole pretraining recipe applied to the full base, with no pretraining FLOP spent. It also re-applies today's RL recipe and today's suite fidelity. The cost is a flat 15% of the training pool whatever the base's size, and nothing counts FLOP against it. The action previews are hard-coded numbers that match no effect: start gives progress +0.2 at 30 d, monitorability −0.1 and alignment −0.1 at p 0.5; stop gives progress −0.1 and monitorability +0.05. `streamBuild` never touches monitorability.
- Evidence: runs.ts:662-668 (`gPre = base.gPre - base.ePre + tr.pre`), 672-692, 109 (`streamShare` flat), runDesign.ts:116-117 (`STREAM_POOL_SHARE 0.15`, `STREAM_LAG_DAYS 7`); actions.ts:201-211 (previews); glossary.ts:336 ("Evals go stale fast, so beliefs blur", v2 text).
- Player sees: "Continual learning" and "Stop stream" buttons with made-up previews, and a "Stream 15%" row in the run queue. G rises with no visible cause.
- Fix: make it real or remove it. As a mechanism: the stream is a continued-pretraining plus RL run whose FLOP is its pool share × days, gaining through `continueGPre` and the RL curve on the FLOP actually spent. Previews should come from that.
- Severity: high · Effort: M

### TRN-03 Six level↔OOM conversions that disagree with each other
- Test(s): 4, 5
- What: The one map is supposed to be λ(G), piecewise linear through the world's knots. Its slope between V0 (L 5, G ≈ 28.0) and SC (L 10, G_SC) is 5 ÷ (G_SC − 28). That is ≈ 2.3 L/OOM on ai2027, ≈ 0.92 on authors2026 and ≈ 0.66 on slow. Other code uses fixed rates beside it:
  (a) `LEVEL_PER_OOM = 1.2` converts level offsets to OOM for horizons and sets the re-eval threshold;
  (b) "ΔL = 2·ΔG" for the hazard filter (BIO −1.0 L ÷ 2), the benchmark midpoints (m_L = 5 + 2·(m_G − 28)) and the distillation fit;
  (c) `oomOfLevel` is a second copy of `gOfLevel` with its own copy of `LEVEL_AT`;
  (d) `levelOfV2` is v2's level map on the progress coordinate, still used by RefBot's gates;
  (e) `B_G_PER_Y = 1.2` OOM per v2 "progress-year" converts P24 (+0.8 y), the run penalty and the rival public-model lag (0.15 y).
  In one post design, Persuasion's SOCIAL +0.8 L and the hazard filter's BIO −1.0 L are converted at different rates.
- Evidence: capability.ts:48-64 (λ), 147-150 (`horizonG` ÷ LEVEL_PER_OOM); workTypes.ts:66, 220-225 (G_SC per world); data/v2/evals.ts:72-76 (`REEVAL_DG = REEVAL_DL / LEVEL_PER_OOM`); design.ts:39 (`/ 2`); data/v2/benchmarks.ts:1; runDesign.ts:95-99; safety/oversight.ts:20-41; world/calibration.ts:20-30; runDesign.ts:17; runs.ts:95, 582, 644.
- Player sees: run-card bands of ±0.25 L, preference offsets in L and OOM tooltips that do not convert into each other the same way in every world.
- Fix: merge. Keep λ(G) as the display map only. Every design offset, threshold and band lives in OOM (domain G). Delete LEVEL_PER_OOM, `oomOfLevel` and the ×2 rule. Retire `B_G_PER_Y` by restating its inputs in OOM.
- Severity: high · Effort: M

### TRN-04 Expert data is three assets, two units and four jobs
- Test(s): 3, 5, 6
- What: Expert data exists as:
  - an empty `expert` asset in `startPortfolio`, which init then deletes;
  - one `expert:<family>` asset per suite, whose token count *is* the suite's fidelity;
  - a bought stock `expert:dom:<domain>`, which suite builds draw from first.
  Purchases are by domain, but suites are by RL family. Computer use and Long tasks share the AGENCY stock, and SOCIAL, MEDIA and PHYS expert data feeds nothing. Several texts promise that evaluations use expert data, but `evals.ts` never reads it. P12 is a research project whose "effect" is a purchase: adopting it adds 0.02T to the long-tasks suite and books $1B automatically.
- Evidence: data.ts:47, 313-317, 347-356; init.ts:159; suites.ts:48-55, 66-72, 123-127, 183-192; research.ts:571; tree.ts:156 (P12); dataActions.ts:146-151, 159 ("evaluations, D7"); Data.tsx:72 ("RL environments and evaluations"); dataAssets.ts:124-132; models/evals.ts (no expert reference).
- Player sees: a "Buy expert data" form per domain (some domains do nothing), an "Expert" row in the data portfolio, and fidelity on Suites. The $1B charge appears when P12 is adopted.
- Fix: redesign. Expert data belongs only to suites. "Build suite" buys it, so delete `data.expert` and the domain stock. P12 becomes a suite build option, or a cheaper build for long tasks, not a tree project. Delete the evaluation claims.
- Severity: high · Effort: M

### TRN-05 The measured level ignores the benchmarks; benchmarks are decoration
- Test(s): 3, 6
- What: An eval suite computes 19 noisy benchmark scores, but they are never aggregated into anything. The measured level is `v.Lg + errTrue/√nEff`: the true general level plus one stored noise draw. Measured domains are that number plus the true domain offset, so the domain profile shows with no measurement error at all. Depth's elicitation (+0.15 / −0.2 L), independent evaluators' elicitation (+0.3) and sandbagging change only the benchmark rows and the danger flags, never the level the game and the player act on. Benchmark saturation reads only the player's models.
- Evidence: models/benchmarks.ts:48-57 (scores), 79-111 (`measuredL = Lg + errTrue/√nEff` at :109), 89 (flags), 114-126 (saturation on `bestPlayerVersion`); actors/commitments.ts:26-29 (`measuredDomain = measuredL + (domains[d] − Lg)`); data/v2/evals.ts:42-50 (`elic`).
- Player sees: a benchmark table on each model card, and an "L 7.3 ± 0.2" that does not come from it.
- Fix: make it real. Measured domain level = the inverse benchmark fit over that domain's benchmarks (elicitation and sandbagging included), and the general level = their mean. Or drop the per-benchmark scores and keep one noisy reading per domain.
- Severity: high · Effort: M

### TRN-06 Seven ways to make a model, each with its own rules
- Test(s): design, 3
- What: The player can make:
  - a base run (new lineage, today's pretraining recipe, data drawn);
  - a post-train (new version on a base, today's RL recipe, today's suites);
  - a continue run (a new base "B2c", 0.3 × FLOP, no data draw, see TRN-07);
  - a distilled mini (copies the teacher's whole build minus a gap);
  - an IDA cycle (a post-train on a teacher's build, see TRN-08);
  - a stream (in-place re-application of both recipes, see TRN-02);
  - imported and variant models.
  Each kind treats recipe, data, suites, traits and naming differently, and the code splits them by kind and by name string. Players cannot tell what a "base" is versus a "version", or why "continue" makes a base but "stream" changes a version.
- Evidence: runs.ts:293-408 (four plan branches), 515-589 (four completion branches plus IDA by name), 662-716; glossary.ts:259-262, 335-336.
- Player sees: four Blueprint tabs, plus "Amplify", "Continual learning" and "Make variant" buttons on the model card.
- Fix: redesign around two physical acts. Pretraining (new or continued) makes a base. RL on environments turns a base or a version into a new version. The stream is "RL and continued pretraining on a schedule", IDA is "RL with a teacher in the loop", and distillation is "pretrain a small base on a teacher's outputs". Each is a parameterisation of those two acts, not its own code path.
- Severity: high · Effort: L

### TRN-07 Continue runs train on data that does not exist
- Test(s): 1, 6
- What: A continue run adds 0.3 × the parent's FLOP through `continueGPre`. That formula has no data draw, no repetition, no overtraining penalty and no quality term. It does compute tokens (`parent.tokens + flop/(6N)`) but never checks them against the portfolio. Epochs and data specialisation are copied from the parent, and `scale` is added across runs.
- Evidence: effective.ts:95-98; runs.ts:374-381 (plan), 536-552 (completion); runDesign.ts:106 (`CONTINUE_SHARE`).
- Player sees: "0.3 × the base's FLOP with today's recipe" (Blueprint.tsx:426) and no data tile for continue runs.
- Fix: make it real. Draw the added tokens from the portfolio with the parent's mix, add them to the parent's per-slice epochs, and apply fData/fQual to the added part.
- Severity: medium · Effort: S

### TRN-08 IDA is a post-train recognised by its name
- Test(s): 3, 5, 2
- What: An "Amplify" run is `kind: 'post'` with `ida: true`, but completion finds it with `run.name.startsWith('IDA')`. It adds `IDA_RL_SHARE` (0.15 × base FLOP) of RL to the teacher's build, takes the maximum of the teacher's and today's suite fidelity, and copies the teacher's traits. The preview hard-codes 0.3 pool share and "alignment −0.1". The glossary still has the v2 effect ("+0.25 years of capability in 21 days on 30% of the pool").
- Evidence: runs.ts:572, 350-353, 412-423, 296 (`p.ida ? 0.3`); actions.ts:132-140; glossary.ts:335; runDesign.ts:108.
- Player sees: "Amplify (IDA)" button (Models.tsx:174) whose preview and glossary match neither each other nor the engine.
- Fix: merge into the post-train (TRN-06): "RL on version X" with an option for the teacher as grader. Give it a real run kind, or drop the flag.
- Severity: medium · Effort: S

### TRN-09 The RL budget is a three-row lookup table shown as FLOP
- Test(s): 2, design
- What: In `rlGains` the midpoint is `C_mid = c0·FLOP_pre/10^eRL`, and RL compute is `ρ·FLOP_pre`. FLOP_pre cancels, so the RL gain depends only on the budget tier (ρ = 0.03 / 0.15 / 0.4), the RL recipe and the transfer weights. Base size enters only through the ceiling, at +0.1 OOM per OOM of base. The RL FLOP the run card shows has no effect beyond what the tier already sets.
- Evidence: effective.ts:138-143, 190-199; runDesign.ts:73-81 (`RL_BUDGET`, `RL_CURVE`, `RL_REF_GAIN 0.7`).
- Player sees: "RL gain per domain … RL FLOP" tooltip (Blueprint.tsx:419) that suggests compute matters.
- Fix: make it real (C_mid in absolute FLOP or per environment task, so a small base saturates sooner) or be honest: show the budget as three tiers with their gains.
- Severity: medium · Effort: M

### TRN-10 RL family "domain values" are v2 level numbers whose size is ignored
- Test(s): 2, 5
- What: `RL_FAMILIES[f].v` (CODE 1.6, RSCH 0.8, …, "v2 levels") is used only to decide which domain is "same" (the largest) and which are "adjacent". The numbers themselves never enter the maths: transfer is 1.0 / 0.4 / 0.15. The research tree still advertises them as level gains ("CODE +1.6, RSCH +0.8, CYBER +0.6"; "REASON +1.2 per focus"). The long-tasks focus also gives a flat ×2 time horizon (`h80Mult`, which multiplies h50 too) whatever the RL compute, and P07 a flat ×1.2.
- Evidence: runDesign.ts:200-208; effective.ts:111-116; design.ts:48-58; capability.ts:154-155; runs.ts:164, 262; tree.ts:169-175.
- Player sees: tree cards and focus cards with level gains the engine does not apply.
- Fix: replace `v` with explicit lists of the family's own domain and its adjacent domains. Show the real per-domain gains from `rlGains`. Make the horizon gain come from the long-tasks suite's RL (task length), not a ×2.
- Severity: medium · Effort: S

### TRN-11 Design-option effects are flat v2 numbers
- Test(s): 2, 5
- What: Most run-design cards are constants converted from v2's progress-years ("v2's Δp × B"):
  - Dense −0.3 OOM; latent +0.5 OOM, serving ×0.4;
  - no quality filter −0.24 OOM; hazard filter −0.024 OOM and BIO −1.0 L; safety pretraining −0.024 OOM;
  - Minimal preference −0.06 OOM; Engagement SOCIAL +0.2 L; Persuasion SOCIAL +0.8 L;
  - Minimal alignment +0.024 OOM; Heavy −0.048 OOM;
  - Pressured CoT serving ×0.8.
  The quality and hazard filters could act through the data draw, which already exists. Instead they are fixed offsets on top of it. Tree cards still quote years ("Δ −0.02 y").
- Evidence: runDesign.ts:38-44 (SHAPE), 163-167 (CURATION), 172-177 (POST_PREF), 181-186 (POST_COT), 188-192 (POST_SAFETY); design.ts:27-44; tree.ts:143, 204-205.
- Player sees: per-card "Capability ±x OOM" chips in the Blueprint slot table.
- Fix: make it real where a mechanism exists. The quality filter raises the drawn tokens' q (and lowers U). The hazard filter removes BIO-hazard slices from the draw, so specialisation follows. Keep the rest as tagged [D] constants in OOM only, and rewrite the tree text.
- Severity: medium · Effort: M

### TRN-12 Dead design fields still make player-facing promises
- Test(s): 5, 1
- What: Fields that are computed or tabled but never read:
  - `POST_PREF.safetyFteWeeks`: T-SPEC promises "8 safety FTE-weeks per run", which is never charged;
  - `POST_PREF.honest` and `POST_SAFETY.honest`: honesty acts through traits.ts brackets instead;
  - `POST_SAFETY.misuseMult` (stored on the build, read nowhere);
  - design flags (`bioUplift`, `cyberOffense`, `persuasion`) from `postEffect` and `baseEffect`: version flags are set only by benchmark scores;
  - the whole `EFFORT` table (dL ±0.6, tokens 0.4/1/10), duplicated by serving.ts `EFFORT_TOKENS` (0.3/1/4); tree P05 still says "Tokens ×10";
  - `GOODPUT_FT` and `JOURNALS_FRAC`, unused.
- Evidence: runDesign.ts:172-177, 188-192, 212-214, 66, 219; design.ts:42, 69-78; runs.ts:267; serving.ts:125; tree.ts:189, 200; benchmarks.ts:89.
- Player sees: tree and card text for effects and costs that never happen.
- Fix: remove the fields and rewrite the tree text from what the engine does. If FTE-weeks per run are wanted, charge them on the safety allocation.
- Severity: medium · Effort: S

### TRN-13 Stale per-run cash: the "cash" tile and the next-model gate
- Test(s): 5, 1
- What: Since F6/D5, base and post runs cost no cash except the Science mix's `cashMult` 0.05. That duplicates the unused `JOURNALS_FRAC`. Yet:
  - the Blueprint's cash tip says "Data licences and RL environments paid when the run starts";
  - `nextModelGate` models a "cash" constraint as "0.5 × compute cost, env budget of a reference post", a cost that no longer exists;
  - `nextModelGate` is exported but shown nowhere in the UI.
- Evidence: runs.ts:324, 359; runDesign.ts:156-161; Blueprint.tsx:569; production/readout.ts:72-87; core/selectors.ts:15; glossary.ts:226.
- Player sees: the stale cash tooltip.
- Fix: remove `nextModelGate`, and rewrite the tip ("Science journals: +5% of compute cost; nothing else is paid per run").
- Severity: medium · Effort: S

### TRN-14 Suite fidelity is just a token count, and unlocked suites appear from nowhere
- Test(s): 1, 2, 6
- What: Fidelity is a function only of the expert tokens in the suite: `1.5 − 0.5·(E₀/E)^0.5`, a [D] curve. Every build adds the same 0.002T for 2 team-weeks whatever the suite's size. Fidelity never decays, and unmet upkeep has no effect on the suite. A family unlocked later (computer use after P06) gets a full start-quality suite from `suiteOf` the day the idea is known: fidelity 1 and hardened exploitability, never built and never paid for. It then counts in "broad" RL weights and in upkeep.
- Evidence: suites.ts:56-62 (`suiteOf` start suite), 68-76, 123-127, 196; data/v2/suites.ts:45-46, 57, 63, 74; build.ts:17-19, 125-126.
- Player sees: Suites tab rows with fidelity and exploitability. The computer-use row appears with fidelity 1.00.
- Fix: make it real. An unlocked family starts with no suite (fidelity 0, so no RL) until its first build. Fidelity comes from tasks × grader quality, and decays when upkeep is short.
- Severity: medium · Effort: M

### TRN-15 The recipe is frozen at launch, but the data is drawn at completion, three times
- Test(s): 6, 3
- What: A base run freezes its pretraining recipe at launch, but `completeRun` calls `baseG(s, d, rec.pre)`, which re-draws from *today's* portfolio. Licences delivered, synthetic tokens generated or usage data gathered during a 4-7 month run all change the result. Traits recompute the draw a third time (`baseQuantitiesOf`). The post-train prediction also uses today's suites, not the ones the run will see. The player is never told that data keeps counting after launch.
- Evidence: runs.ts:445-447 (frozen recipe), 519-531 (`baseG` at completion), 228-240; safety/traits.ts:966.
- Player sees: the Blueprint's epochs, fData and quality tiles at plan time, which can differ from the finished base (Models › Bases shows only `epochs`).
- Fix: freeze the draw at launch (store the `DataDraw` on the run) and read it at completion and in the trait hook.
- Severity: medium · Effort: S

### TRN-16 Action previews that do not match their effects (training and evals)
- Test(s): 2, 6
- What:
  - `runEvals`: self-evaluation promises monitorability +0.02. External evaluation promises credibility +2, trust +1 and leadDays −14. `queueEval` and `finishEval` apply none of these.
  - `runPreview` turns the sum of nine signals into "alignment −Σ" at probability 0.5.
  - The run prediction band is a fixed ±0.25 L, while the true outcome is deterministic and evaluation noise is 0.2/√n.
  - Stream and IDA previews: see TRN-02 and TRN-08.
- Evidence: actions.ts:96-110, 243-258; models/evals.ts:76-92, 165-171; runs.ts:394-399.
- Player sees: these previews on the eval and run buttons.
- Fix: make the previews read the effects: no gains for self-evals, real evaluator effects if WS4 adds them, signals shown as pressures, not alignment. Show the band as evaluation noise, or drop it.
- Severity: medium · Effort: S

### TRN-17 Two milestone systems for one player
- Test(s): 4, design
- What: The player's recorded milestones are work-type fits (`labMilestones`). The notices and act changes use the measured level crossing `LEVEL_KNOTS` (6.5, 8.5, 10, …), and the acts read L 6.5 / 8.5 / 12 or M ≥ 25. λ(G) is built on only knots 0, 3, 4, 5 and 6, so "Reliable agent" (6.5) and "Research agent" (8.5) are just points on the V0→SC line. Rivals' milestones are λ crossings of all seven knots.
- Evidence: capability.ts:48, 288-328; calibration.ts:130.
- Player sees: "Superhuman coder: measured level 10.0" notices that can disagree with the recorded milestone dates.
- Fix: merge. One definition per milestone (the work-type fit), used for the player, rivals, notices and acts. Drop knots 1 and 2, or define them by work types.
- Severity: medium · Effort: M

### TRN-18 serveCost and fpt describe the same thing
- Test(s): 4, 5
- What: `serveCost` (a 0.5-relative readout, `SERVE_REF`) still carries serving efficiency between bases, versions and minis: `fptOfBuild` derives FLOP per token from `v.serveCost / base.serve`, and minis get `serveCost × nS/nT`. The Blueprint's `planFpt` goes through the same ratio. production.ts still uses a constant `serveCost: 0.5` to scale H100e per agent copy.
- Evidence: effective.ts:100-105; runDesign.ts:110-113; runs.ts:327, 360, 372, 380, 561, 584; workfit.ts:131-142; index.ts:107-121; production.ts:182, 339; calibration.ts:83.
- Player sees: FLOP per token only (good), but the number is computed through the old ratio.
- Fix: merge. Store `fpt` on base and version directly (2·N_active × shape token multiplier × CoT multiplier × serving-stack factor), and delete `serveCost`, `serve`, `serveOfBase` and `SERVE_REF`.
- Severity: medium · Effort: M

### TRN-19 Synthetic data: [D] quality line, fixed mix, a UI bug and hidden trait inheritance
- Test(s): 2, 6
- What:
  - Quality is a straight line in the teacher's G: 0.5 at V0, +0.25 per OOM, capped at 1, or 1.5 with P10.
  - Every teacher writes the same fixed SYN_MIX (code and math), whatever its strengths.
  - Generation uses no staff, and the default teacher is silently the internal model.
  - The Data panel's teacher table calls `syntheticQuality(g, g0)` with the default cap of 1, so after P10 it understates quality. Generation itself uses `synQualityCap(s)`.
  - Teacher traits pass into the next base through `imitatedStart`. The player sees only a text line saying so.
- Evidence: dataAssets.ts:59-75; data.ts:370-422 (cap at :405); dataView.ts:129; dataActions.ts:96-108, 126; safety/traits.ts:976-979.
- Player sees: teacher rows with quality and tokens per H100e-day (wrong after P10), and the "carries traits" line.
- Fix: pass `synQualityCap(s)` in `teacherRows`. Make the synthetic mix the teacher's domain profile. Show a "teacher share" on the base card (`base.teacherData` already exists).
- Severity: medium · Effort: S

### TRN-20 Data-mix presets: tilts, flopMult and cashMult, with "balanced" pinned to 2025
- Test(s): 2, 3
- What: Presets are hand tilts (code ×3, math ×2, bio ×3, synthetic ×4, …). Multimodal costs a flat +20% FLOP and Science +5% cash. "Balanced" is pinned to the 2025 reference shares forever. The code says this is so that RefBot does not drift and move the golden dates, a calibration guard rather than a mechanism. Science also sets a meaningless `bioUplift: false` flag.
- Evidence: runDesign.ts:138-161 (guard reason at 143-145); data.ts:132-134, 239-243; design.ts:42.
- Player sees: six mix cards with domain effects. "Balanced" and "Natural" differ in ways that are hard to explain.
- Fix: redesign. Give the player per-domain weights (or a few named targets) on the draw. Drop flopMult (multimodal FLOP should follow from tokens) and cashMult (journals are a licence). Keep RefBot on its own fixed target in bot code.
- Severity: medium · Effort: M

### TRN-21 Research-tree nodes do three unrelated jobs
- Test(s): 3, design
- What: A tree node can:
  - unlock a run-design option (`OPTION_NODE`: STAR nodes such as `moe`, `qualityFilter` (= Balanced mix), `P01` visible CoT);
  - add a stack or data effect (P10 raises the synthetic ceiling *and* unlocks the synthetic mix; P21 raises token worth);
  - buy an asset (P12, $1B of expert data);
  - unlock an RL family *and* create its suite (P06).
  P24 adds a flat +0.8 progress-years of recipe to the next base.
- Evidence: tree.ts:142-175, 302; models/tree.ts:584-589; runs.ts:93-95; suites.ts:35, 58-62.
- Player sees: tree cards whose "unlocks" and "effects" are mixed together.
- Fix: split the roles. Ideas add stack effects. Option unlocks are a short "capabilities" list derived from ideas. Purchases are actions. P24 becomes a stack idea.
- Severity: medium · Effort: M

### TRN-22 Rivals train under a different model with no data, suites or evals
- Test(s): 4, design
- What: Non-player labs get G from `clG(base, recipe)` on a physical base. They have no data portfolio, no environment suites, no fidelity or exploitability and no eval noise, and their domains are `domainsOf(w, G)` with no training offsets. The player's data and suite strategy therefore has no counterpart in the competition, and the two training models can drift apart.
- Evidence: actors/rivalModel.ts:165-179, 410-414, 523-531; runs.ts:637-646.
- Player sees: rival levels that ignore everything the Data and Suites panels teach.
- Fix: run rivals through the same `baseG` and `rlGains` with a reference portfolio and suites (cheap: pure functions), or document that they are an aggregate stand-in.
- Severity: medium · Effort: M

### TRN-23 The "Hardened graders" node unlocks an option that no longer exists
- Test(s): 5
- What: The STAR node `hardenedGraders` unlocks option `graders:hardened` ("Reward hacking ×0.4 vs cheap graders"; cost "RL environment budget"). `PostDesign` no longer has a graders slot: suites replaced it, and `graders` survives only in the 22 → 23 save migration.
- Evidence: tree.ts:164; core/save.ts:395-406; suites.ts:198-203.
- Player sees: a tree node with a dead promise.
- Fix: remove the node, or repoint it to "hardening passes cut deeper".
- Severity: low · Effort: S

### TRN-24 A second data-wall model for readouts (compute-optimal, 4 free epochs)
- Test(s): 4, 5
- What: `tokensRequired` = 20·√(C/120), the compute-optimal tokens of research/13. `dataStockRatio` compares that with 4 × U. Real bases train at 400 tokens per parameter and pay a per-slice Muennighoff cost in the draw, so this readout understates the need by about √20 and uses a different repetition rule. It feeds only the unused `nextModelGate`.
- Evidence: data.ts:500-514; production/readout.ts:78, 84; runDesign.ts:57.
- Player sees: nothing (dead).
- Fix: remove.
- Severity: low · Effort: S

### TRN-25 Exploitability and S2 are calibrated through v1's graders table
- Test(s): 5
- What: `HARDENED_FACTOR = 0.6/1.5` (v1 graders multipliers). `S2_REF = 0.36` comes from v1's family table (0.2/0.6/0.4) × hardened 0.6. `S2_PER_EXPLOIT` is solved so the start suites reproduce it. The spinout's cheap graders are ×2.5, and `suitesFromV1` remains for migration.
- Evidence: data/v2/suites.ts:17-37; suites.ts:96-102, 198-203.
- Player sees: "% exploitable" and S2 on Suites, which are fine on their own.
- Fix: state S2 directly per unit of exploitable RL share [D], and drop the v1 chain.
- Severity: low · Effort: S

### TRN-26 The start state is still solved on v2's progress coordinate
- Test(s): 5
- What: G of V0, which anchors λ, the level knots, the synthetic quality line and the horizons, comes from `playerStart`. That function uses v2's `multiplierAt`, `stage1`, `pcRefLab` (with a 2029 halving), `START_RETAIN 0.7` and `startVintage` (pa → OOM at B_G_PER_Y), plus the fitted `E_B0`. `CAL_SHIFT` is still fitted and read by RefBot.
- Evidence: capability.ts:73-102, 159-188, 41-46; runDesign.ts:24-29; calibration.ts:5-26.
- Player sees: nothing directly.
- Fix: set G(V0) per world as a constant (≈ 28.0, the research/12 anchor) and B0's recipe directly, then delete the v2 solution, `startVintage` and `alignedCalShift` once RefBot's gates use G.
- Severity: low · Effort: L

### TRN-27 REF_OFF columns 1-6 are dead, and RSCH has a flat taste penalty
- Test(s): 5, 2
- What: Only column 0 of `REF_OFF` is read. The other six columns are v2's scripted era table, kept "for reference". RSCH takes a flat −0.5 L until P19 (in levels, bypassing G).
- Evidence: calibration.ts:133-148; capability.ts:131-139.
- Player sees: a RSCH jump at P19.
- Fix: reduce `REF_OFF` to one offset per domain, in OOM. Make P19 a domain-G effect like other ideas (`research.domainG`).
- Severity: low · Effort: S

### TRN-28 The `scale` field (BRIDGE V7)
- Test(s): 5
- What: `run.scale` and `base.scale` = FLOP ÷ the calendar frontier F(t). It feeds only public scrutiny and is summed across continue runs (parent.scale + run.scale).
- Evidence: runs.ts:165-167, 452, 463-464, 527, 546; runDesign.ts:133-136.
- Player sees: scrutiny exposure on big base runs.
- Fix: compute scrutiny from FLOP against the largest rival run actually trained, and drop `scale`.
- Severity: low · Effort: S

### TRN-29 Public web and usage-data leftovers
- Test(s): 5, 2
- What:
  - Crawl coverage is fixed at 0.9 for every start, and no action changes it. The 30T licensed start corpus at q 1 is chosen to "keep U = 310T", v2's stock.
  - The public stock is shared, but other labs neither deplete nor pollute it.
  - Usage mixes for api, agents, enterprise and gov are dead, because only consumer chats are eligible.
  - `dataPortfolioFromV2` and `LICENCE_DEAL_SHARE` survive only for migration.
- Evidence: dataAssets.ts:10-33, 115-121; data.ts:38-73.
- Player sees: "90% crawled", which never moves.
- Fix: drop the dead mixes, and either make crawl coverage an action (crawling compute) or show the crawl as a fixed shared stock.
- Severity: low · Effort: S

### TRN-30 Blueprint and engine defaults disagree
- Test(s): 4
- What:
  - Blueprint `DEFAULTS.params` is 1e12, while the engine's reference base is 354B active.
  - Pool defaults differ (UI: post 0.4, distill 0.2, continue 0.4; engine: 0.2, 0.1, 0.3).
  - The distill student picker says "half the teacher by default", but the engine default is 1/8 and the glossary says "an eighth". RefBot uses ½.
- Evidence: Blueprint.tsx:40-44, 260, 263; runs.ts:67; runDesign.ts:104, 122; glossary.ts:262; bots/ref.ts:124.
- Player sees: contradictory defaults.
- Fix: one set of defaults exported from the engine.
- Severity: low · Effort: S

### TRN-31 Tokens per parameter as a headline control
- Test(s): design
- What: The size card makes tokens per parameter a top-level control. The reason to overtrain is cheaper serving, which appears only as a FLOP-per-token tile. Anything above 400 is also gated behind the "Overtrained compact" node, although overtraining already costs G through `fOver`. Players do not know why they would move it.
- Evidence: runDesign.ts:45-61; effective.ts:26-28; runs.ts:316; tree.ts:152.
- Player sees: a TPP selector with "overtrained ×20" labels.
- Fix: present the choice as "serving cost vs capability" (two-axis picker, with tokens derived from it). Drop the node gate: the G cost already limits overtraining.
- Severity: low · Effort: M

### TRN-32 The recipe depends on run size through hidden headroom
- Test(s): 6
- What: The pretraining stack is evaluated at the run's FLOP: `stackAt(st, F) = base + Σ (adopted − headroom)·10^(s·log F)`. A bigger base therefore embodies a different recipe from a small one, by an amount the player never sees. The RL stacks are always evaluated at `FLOP_RL_REF`, so they do not scale.
- Evidence: models/stacks.ts:37-68; runs.ts:238, 445-446.
- Player sees: "Recipe +x OOM" in the G-gained tip, with no mention of size.
- Fix: show the scale-dependence on the size card ("recipe at this size"), or make every stack scale-free.
- Severity: low · Effort: S

---

## Simplest coherent model

Use one currency: effective compute G in OOM per domain. λ(G) is only a display map. Every input, offset and threshold is stated in OOM.

**Data.** The lab owns token stocks: its public crawl, licences, usage data and synthetic data. Each has a quality q and a domain mix. A base draws its tokens at launch with per-domain weights the player sets; quality and hazard filters change q and remove slices. The draw is frozen on the run. The loss law turns the drawn D_eff into G, with repetition per slice. Synthetic data costs compute, takes the teacher's domain profile and quality, and records its teachers for trait inheritance, which is shown on the base. Usage data accrues from products under the privacy policy.

**Environments.** One suite per RL family. A suite has tasks (built by engineers from bought expert data), grader quality (hardening) and upkeep. A family has no RL until its first suite is built. Fidelity = f(tasks, grader quality) and decays without upkeep. Exploitability sets reward-hacking pressure directly.

**Training.** There are two acts.
- Pretraining (new or continued) spends FLOP on drawn tokens at the run's frozen recipe and makes a base.
- RL spends FLOP on the suites at a midpoint measured in absolute FLOP (or tasks). That way size matters, small bases saturate and the curve is honest. RL makes a version from a base or a version.

Distillation is pretraining a small base on a teacher's outputs. IDA is RL with the teacher as grader. The stream is a scheduled small continued-pretraining plus RL run whose FLOP is the pool share actually spent. There are no name-based branches, no free recipe re-application and no per-kind rules.

**Evaluations.** A suite of benchmarks per domain costs staff, compute and engineer time. The measured domain level is fitted from the noisy benchmark scores (elicitation and sandbagging included), and the general level is their mean. That one reading drives milestones, notices, gates and the player's view. Rivals use the same pure functions with a reference portfolio and suites. Every preview reads the same functions the engine applies.
