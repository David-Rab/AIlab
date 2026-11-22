# Audit: capability research (R&D)

Scope: src/engine/v2/models/{research,tree,treeActions,stacks,paradigms,researchView}.ts, src/data/v2/{research,tree,paradigms,techs}.ts, departments/workfit.ts (taste, AI labour), production/{knots,production}.ts, the recipe freeze in models/runs.ts, actors/rivalModel.ts recipeRates. UI: src/ui/v2/panels/{Research,ResearchProjects,Recipe,ResearchCharts}.tsx.
Read-only audit; every claim cites file:line in the checkout at commit ea624ae. "Unsure" is marked where I did not verify a claim.

Summary: 25 entries. 4 high, 10 medium, 11 low (CAP-25 is the short re-check of the already-known items).

---

### CAP-01 Two research models for the player: the per-project engine and an aggregate "readout" that also drives real choices
- Test(s): 3, 4, 6
- What: Capability research really runs per project in models/research.ts: ideation, tests and FLOP per project. Alongside it, production/production.ts evaluates the player's research a second time, as one "unit project" (evalV3). That second model is more than a readout. It sets the player's experiments/agents compute split every day, and its M and `rate` feed safety rolled nodes, government, the tutorial acts and lead conversions. The two models disagree on inputs. The mix search counts only Experiments AI labour (EXP). It ignores that the same agent pool also powers research ideas (capFrontier) and engineering (eng). Taste is weighted by heads over all capability scientists, while the engine weights it by capacity per project. So the "Research speed" number and the mix chart the player is shown are not the speed their projects run at.
- Evidence: production.ts:96-115 evalV3 (one unit project, M = X/Xh × Tai/Th × mods). production.ts:454-464 applyBestMix rewrites core.split.experiments/agents unless researchManual, called daily from advanceLab (475). production.ts:173 `AI0: ... ex.AI` (EXP slot only), whereas workfit.ts:245 shows the agents pool split three ways (eng / capRoutine / capFrontier). production.ts:160-171 taste weighted by `t.heads` over all cap sci teams, against research.ts:174-189 sciOn (capacity × quality × specialty, per project). Consumers of the aggregate: tree.ts:186 researchSpeed (rolled nodes); gov.ts:57 govSeenM; capability.ts:325 tutorial act; rivals.ts:200 paceOf (rate → lead days); tree.ts:597 P24 payoff reads prodCache.labor.wH; researchView.ts:426-436 researchSpeedView; ResearchCharts.tsx MixChart/ResponseCharts via readout.ts:28,51.
- Player sees: Company › Flow "Research speed ×M", its decomposition and the mix/response charts. None of them is what Research › Projects runs at, and the Auto mix follows the aggregate.
- Fix: merge. Keep one research function, the per-project step. Derive the readout from what the engine did (candidates/day, test work/day, OOM/day of the stacks, as already logged in research.last). Either drop the auto mix (the player sets the split) or have it evaluate the real daily step, including the IDEAS and SWE uses of the agent pool. Move the M consumers (gov, tutorial, pace, P24) to the measured software rate.
- Severity: high · Effort: L

### CAP-02 Paradigm "axis" effects are flat multipliers hard-coded in their consumers, untouched by the research result
- Test(s): 1, 2, 3, 4, 5
- What: Most paradigm nodes have no `effect`, so they become kind 'axis'. They run the full candidate lifecycle, and the effect size drawn and estimated in that lifecycle is then thrown away. What the paradigm actually does is a constant somewhere else, gated by `adopted()`:
  - P13 multiplies experiment FLOP by (1 + 0.5·payoff), with the payoff taken from the measured RSCH display level (6.5 → 8.5). This duplicates the AI-labour mechanism, because "automated AI research agents" are already the EXP-slot copies.
  - P05 multiplies all agent FTE by 1.3, including the safety package. P20 multiplies it by 1 + 0.1·payoff.
  - P24 adds +0.8 progress-years × B × payoff, where the payoff reads the production readout's human labour share.
  - P19's whole effect is to undo v2's −0.5 L RSCH "taste penalty".
  - Rivals have no paradigms at all, so none of these advantages exist on their side.
- Evidence: data/v2/tree.ts:248 `kind ??= n.effect ? 'idea' : 'axis'`. research.ts:416 p13Mult, repeated inline at production.ts:154 (a duplicate). tree.ts:593-598 payoffOf (levels and a readout). workfit.ts:248-249 (P05, P20; useLabour is also used for SAF_EXP at 240, 378). runs.ts:93-95 p24Dg in progress-years. workfit.ts:56 with calibration.ts:148 RSCH_TASTE_PENALTY = −0.5 and capability.ts:135 (the penalty exists only to be removed by P19). runs.ts:164 P07_HORIZON ×1.2 (this one at least has a written [D]/[P] rationale). No paradigm code in actors/rivalModel.ts or actors/rivals.ts (grep). Comments carry no [D]/[P]/[R] tags for P05, P13, P20, P24.
- Player sees: node card text ("Experiment throughput up to ×1.5", "agent research throughput ×1.3") and a payoff % for P13/P20/P24 (Research.tsx:268). Nothing in the work-type or recipe readouts says which part of a number comes from these multipliers.
- Fix: give each one a typed `effect` that scales with the result's x, in a physical unit, or delete it. P13: remove, since AI labour already models research agents, or make it a coverage/fit shift on EXP. P05/P20: a typed AI-labour effect with a source, applied to capabilities only unless meant otherwise. P19: delete together with the RSCH penalty. P24: a base-design option with a real mechanism. Mirror whatever survives into the rival aggregate.
- Severity: high · Effort: M

### CAP-03 Recipe tab adds quantities in different units, files domain effects under pretraining, and hides data effects
- Test(s): 6, design
- What:
  - Each Recipe card's headline sums its parts. The RL card therefore adds "OOM of RL compute efficiency" (a C_mid shift) to "OOM added to the RL asymptote". The Systems card adds training throughput to serving efficiency. These are different units.
  - An adopted domain-effect idea (P09, P11, P22) is recorded with stack 'pre'. It shows in the Pretraining card as an OOM value, although its unit is "×design" and it never touches the pretraining stack.
  - Its "realised" value only appears after a new base is trained, although the effect applies at the next post-training.
  - Data and expert-data results (P10, P12, P21) get no adopted entry, so they never appear on Recipe.
  - "Realised" is not a measurement. It is the hidden true value, computed at adoption at the then-latest base, and revealed once a calendar condition holds. The UI says "Measured on a model trained after it was adopted".
- Evidence: researchView.ts:266 `now: parts.reduce((a, x) => a + x.now, 0)` and gap summed at 267. research.ts:574-575 `stack: eff.stack ?? 'pre'` for domain effects. research.ts:558-561 realised is computed at adoption. researchView.ts:233-239 evaluatedAfter for 'pre' requires a new base. runs.ts:250-253, 266 apply domainG in postBuild. research.ts:562-573: the data/expert branch pushes no `adopted` entry. Recipe.tsx:28-31, 56.
- Player sees: misleading totals ("RL +x OOM over the start recipe"), a REASON idea listed as a pretraining OOM, and a "realised" figure presented as measured.
- Fix: show each stack in its own unit, with one G-equivalent headline (stacksGEquiv already exists). Add a "Domain and data effects" list in their own units. Derive "realised" from the evaluated model (the eval delta it caused), or call it "true effect (revealed)".
- Severity: high · Effort: M

### CAP-04 The recipe freeze at run launch only covers some effects
- Test(s): 3, design
- What: A run freezes the pretraining stack (base, continue) or the RL stack and suites (post) when it is launched. Several other research effects are read when the run completes instead: adopted domain effects, the serving stack's FLOP part, P07's horizon multiplier and P24's base bonus. An idea adopted while a run trains therefore reaches that run for some effect kinds and not for others. This contradicts "for versions trained after adoption".
- Evidence: runs.ts:443-447 freeze (pre / RL only). runs.ts:574-579 completeRun post path: postBuild(... rec ...), but `serveCost: ... * serveTechMult(s)` is read now. runs.ts:250-253, 266 withDomainG reads research.domainG now. runs.ts:262 adopted(s,'P07') now. runs.ts:238 p24Dg(s) inside baseG, called at completion (runs.ts:525). Fallbacks `rec.rlMid ?? rlMidNow(s)` (runs.ts:570, 574) remain for runs without a recipe (old saves).
- Player sees: Recipe's "Not trained in" gap and the Blueprint's "adopted while it trains" (runs.ts:150) suggest a clean launch-time snapshot. It is not one.
- Fix: snapshot every typed effect (stacks, domainG, dataFx, serve FLOP part, P07/P24 or their replacements) into run.recipe at launch. Read only the snapshot at completion. Drop the fallbacks with a save migration.
- Severity: medium · Effort: S

### CAP-05 AI research taste depends on a compute-share ratio, not on how much AI is working
- Test(s): 1, 2, 6
- What: AI taste lifts every capability science team's taste to E[max(human, AI)] with a weight φ. φ is the frontier-research agents' share of the agent pool divided by its default share (0.15), capped at 1. Any nonzero compute on capFrontier at the default share gives the full lift to every team, whatever the absolute amount of compute or number of copies. Halving the share halves the lift even if total compute grew tenfold. Rivals always use φ = 1. Taste reaches 30-200 per the code's own comments, so this lever dominates and has no physical quantity behind it.
- Evidence: workfit.ts:327-330 `phi = on && fv ? Math.min(1, capShare(s,'capFrontier') / DEFAULT_CAP_SHARES.capFrontier) : 0`. data/v2/agents.ts:35 capFrontier 0.15. research.ts:186 teamTaste(..., wc.sdAI, wc.phi, ...). rivalModel.ts:292 teamTaste(0, sdAI, 1, m2b). data/v2/research.ts:42-44 mentions AI taste 30-200.
- Player sees: "Team taste ×N" in the project card's belief tooltip (ResearchProjects.tsx:264). Nothing shows that it hinges on a share ratio.
- Fix: make cover a quantity, e.g. φ = AI ideas FTE ÷ (AI ideas FTE + human science FTE), or per idea reviewed by the model, using the IDEAS slot's aiFte, which is already computed. Use the same rule for rivals. Show φ and its source in the taste tooltip.
- Severity: high · Effort: S

### CAP-06 Player and rival recipes are compared in different units
- Test(s): 4, 3
- What: The player's recipe G-equivalent is evaluated at its latest base FLOP and includes the training-throughput stack. A rival's is evaluated at the fixed FLOP_RL_REF and has no throughput part. Theft gaps and leak checks subtract one from the other.
- Evidence: stacks.ts:165-172 gEquivOf(F = latestBaseFlop, ..., train = trainNow). rivalModel.ts:133 gEquivOfRecipe at FLOP_RL_REF with no train term. Compared at security/theft.ts:61 and actors/actions.ts:114-115. rivalModel.ts:135 cites "stacks.ts recipeG", which does not exist.
- Player sees: nothing directly. The comparison steers theft value and leaks.
- Fix: one recipeG(recipe, F) used for both, at a common reference FLOP, with the same parts.
- Severity: medium · Effort: S

### CAP-07 The rivals' aggregate research mirrors only part of the player's model
- Test(s): 4, design
- What: Rival recipes grow by the same pool law, but on a fixed portfolio. That portfolio is DEFAULT_LINES' rShares with all lines always staffed. It has no L.latent, no ideas, axes or paradigms, no headroom or tuning, no training-throughput stack, fixed agent shares (0.65 / 0.15), full AI-taste cover, and a Leontief min(E, I). The player gets the per-line choices, CAP-02's multipliers and CAP-05's φ. Rivals get none of these. A scale constant is copied by hand.
- Evidence: rivalModel.ts:101-116 recipeParts from DEFAULT_LINES. rivalModel.ts:50-58 AGENT_EXP/AGENT_IDEAS fixed. rivalModel.ts:292 φ = 1. rivalModel.ts:303 `rs: Math.min(E, I)`. rivalModel.ts:347-357 recipeRates (pre/mid/ceil only). rivalModel.ts:67-69 S_CLAMP duplicates research.ts:117 S_RANGE.
- Player sees: nothing. The lead and intel numbers come out of it.
- Fix: extract the line-rate law into one shared function (rate of a pool given research input). Have the player's lines and the rival parts call it. Add the stacks and effects the player can get, or remove them from the player (see CAP-02).
- Severity: medium · Effort: M

### CAP-08 The science-team allocator maximises candidates per day, not value, and capacity is computed three times
- Test(s): 2, 4, design
- What: planAssignment's swap pass and the auto/spare pass maximise Σ √capacity ÷ ideation effort. That counts candidates per day at unit inputs. It ignores the size of the effect (an L.opt candidate and a P13 candidate weigh the same), the AI ideas multiplier, taste, and whether the project needs candidates at all. A one-off idea in its small or scale test keeps its teams (takesTeams), and their candidates only matter after a drop. The √ is hard-coded while the engine uses cap^λ; they match only because λ = 0.5 by default. The same capacity formula appears three times. A second allocator (safety autoAssign) is already known.
- Evidence: research.ts:215-226, 263-267, 312 (√cap / idea). research.ts:602 engine `Math.pow(inp.mIdeas * sci.cap, P.lam)`. research.ts:206 takesTeams includes 'small' and 'scale'. Capacity: research.ts:161 sciCapacity, tree.ts:171 teamCapacity and workfit.ts:365 ag17Capacity (inline copy). calibration.ts:95 lam 0.5. I did not check whether any preset overrides λ.
- Player sees: "Why here" strings ("a better fit for total progress", research.ts:291). "Progress" is never defined as candidates per day.
- Fix: value = expected OOM (or G-equivalent) per day from the project's prior and its stage. Use cap^λ × mIdeas × taste. Release teams from one-off ideas while they test, or give them a "keep ideating" priority. Use one capacity function.
- Severity: medium · Effort: M

### CAP-09 Candidate pool: drop rule and pick rule disagree, and failure blames the world for bad luck
- Test(s): design
- What: A candidate in test is dropped when its posterior falls below DROP_FRAC × the prior mean, an absolute threshold. The next pick comes from the untested pool by μ + κσ with no threshold. The pool can hold candidates whose beliefs are already below the posterior just discarded, and they get tested next. After MAX_DROPS drops, an idea "fails: the direction does not seem to work in this world", even when the hidden works() is true and the drops were noise. For ideas the drop counter never resets.
- Evidence: research.ts:662 (small), 674 (scale) drop tests; research.ts:479-483 pickCandidate (no floor); research.ts:494-507 dropTest and its log text; research.ts:694 resets drops for lines only; research.ts:108-114 works() is a separate hidden truth.
- Player sees: "3 candidates dropped: the direction does not work here" (research.ts:504, ResearchProjects.tsx:260). The cause may be the risk policy and noise rather than the world.
- Fix: treat a drop as "posterior below the best alternative's score" (or the floor applies to the pool too). Word failure as "gave up after 3 weak candidates" and show the odds still standing. Or fail only when the posterior that the direction works falls below a threshold.
- Severity: medium · Effort: S

### CAP-10 A line's "research input so far" is not what its pool is made of
- Test(s): 6, design
- What: A line's pool advances by the realised effect of each result (R ← R·10^(x/r)), not by research input. st.input (Σ b·q) is kept only for display. The project card shows it beside the tooltip "r × log₁₀ of the research input over the start", which is wrong for this code. "Realised" for a line is r·log₁₀(R/n₀) and includes headroom that tuning has not yet delivered, so it differs from the stack's value on Recipe.
- Evidence: research.ts:687-693 (pool update by at.xTest; input "kept for the readout"). researchView.ts:187-193 line view. ResearchProjects.tsx:286 tooltip text. stacks.ts:41 stack = adopted − headroom.
- Player sees: two numbers that look like the line's law but are not.
- Fix: show the pool in its own terms ("ideas X× harder than at the start" is already there). Drop "research input so far" or relabel it "taste-weighted ideas tested". Make "realised" match the stack (net of headroom) or label it gross.
- Severity: low · Effort: S

### CAP-11 Performance batching changes the mechanics and makes "ideas adopted" meaningless
- Test(s): 2, 3, design
- What: Once the unit-project throughput X passes 30, a line's candidate carries b = ⌊X/30⌋ ideas. A batch then follows different rules:
  - its scale test uses an expected survivor factor instead of a drawn exponent;
  - it is dropped by a different rule;
  - its noise scales with √b.
  b depends on the lab-wide unit X rather than the project's own rate. The stacks count a batch of b ideas as 1 adopted idea, while P16 counts as 2 because of its `also` stack. Recipe's "ideas adopted / yr" and the Blueprint's "N ideas adopted while it trains" therefore mean nothing during a takeoff.
- Evidence: data/v2/research.ts:59-62 PACE_BATCH "[D: performance]". research.ts:158, 601 batchOf(inp.X). research.ts:125-134 atTest batch path. research.ts:674 batch drop rule. stacks.ts:116 `st.n += 1` per addIdea. research.ts:556-557 `also` calls addIdea again. researchView.ts:275 and runs.ts:150-153 read n.
- Player sees: "(30 ideas)" on a belief, and ideas/yr counts.
- Fix: count Σ b in st.n (and skip `also`). Long term, run lines as an expected flow when b > 1, or batch only internally without changing drop or survival rules.
- Severity: medium · Effort: M

### CAP-12 Two "recent software rate" series, one seeded with a made-up start value
- Test(s): 4, 1, 5
- What:
  - gRate is a 14-day EMA of the stacks' G-equivalent. It is seeded at 0.83 OOM/yr "so the lead readers do not see a lab at rest".
  - hist samples g and n weekly and keeps 14 samples, about 14 weeks.
  - Recipe takes OOM/yr from gRate and ideas/yr from hist, and its tooltip says both cover the last two weeks.
  - Blueprint's "adopted while it trains" uses hist.
  - gRate feeds production's `rate` (BRIDGE(V7), progress-years ÷ B), which feeds paceOf and lead conversions. The seeded day-0 rate therefore stands in for research nobody did.
- Evidence: research.ts:754-757 (EMA, BRIDGE(V7)). research.ts:764-768 hist. research.ts:789-796 stackRate. tree.ts:104-114 START_G_RATE seed. researchView.ts:273-277 softwareRate. Recipe.tsx:72. production.ts:193-195 rate from gRate.
- Player sees: one "software progress" figure built from two windows.
- Fix: one series (hist, daily or weekly). Compute both rates from it with a stated window. Start at 0, or seed it from the start lab's real line rates in the first days.
- Severity: low · Effort: S

### CAP-13 Unlock projects simulate an effect size that does nothing
- Test(s): 1, design
- What: An axis without `effect` (rl.math, scienceData, multimodal, P05, P07, P08, P13, P14, P15, P18, P19, P20, P24, P25…) gets prior mean 1 in "no unit". It goes through belief noise, small experiments, a scale test and drop rules on that dimensionless x. If it succeeds, the x is ignored: either an option unlocks, or CAP-02's constant applies. What decides the outcome is the works() draw plus the time spent. Several of these (P14, P15, P25) are safety effects researched by capability scientists through this capability lifecycle.
- Evidence: research.ts:98 `(n.effect?.mean ?? 1)`. research.ts:516-517 adoptTW unlock flat. research.ts:706 fmtEst 'it unlocks'. researchView.ts:197 unit 'unlock'. ResearchProjects.tsx:249, 264 show "Effect at small scale ±" with an empty unit label. data/v2/tree.ts:180, 194, 197 (P14/P15/P25 in capability columns).
- Player sees: a belief band and "+1.02 ± 0.31" on an unlock project.
- Fix: for unlocks, run one experiment stage that resolves works / does not work (odds + effort), with no effect band. Or give them typed effects (CAP-02).
- Severity: medium · Effort: S

### CAP-14 The "Result" stage has zero length, a relic of manual adoption
- Test(s): 5
- What: Adoption is automatic. resolveStage calls adoptProject as soon as a result exists, so 'result' becomes 'adopting' on the same day. The five-step stage track still shows a Result step, and the error strings describe a manual adopt action that no longer exists.
- Evidence: research.ts:684-685 and 698-702 (adoptProject called immediately). research.ts:530 "Only finished projects can be adopted". build.ts:334 "A research result waits to be built in: drop the project instead". No `research.adopt` action exists (grep).
- Player sees: a Result step that is never current.
- Fix: four stages (ideation, small, scale, build-in), or make adoption a real decision. Remove the dead strings.
- Severity: low · Effort: S

### CAP-15 One node-state record holds three lifecycles, and the capability path writes the old one's fields
- Test(s): 3, 5
- What: TreeNodeState carries the rolled-node fields (progress, attempts, priorMult, retryDay), the safety-line fields (tm, saf) and the capability `cap`. The capability path writes the rolled fields:
  - attempts: 1 on first use;
  - attempts += 1 and retryDay deleted on reopen;
  - progress = 1 at a result;
  - a 0.33/0.33/0.34 progress heuristic for the tree ring and syncParadigm.
  There are also two odds paths: attemptOdds × 0.5^spec for capability projects and priorMult × 0.5 for rolled ones. The two first-attempt draws (works / roll) are already known.
- Evidence: types.ts:596-614. research.ts:197-203, 700, 708-718, 773-785. tree.ts:156-168 nodeOdds. tree.ts:445-450 roll vs research.ts:108-114 works. tree.ts:453-460 syncParadigm.
- Player sees: the tree ring (capProgress) and the project stage track (stageFrac) show different progress for the same project.
- Fix: a discriminated union per project kind. Use one odds function and one progress readout (the stage track). Delete the rolled path once kyc and P27 move (known).
- Severity: medium · Effort: M

### CAP-16 Effort and ETA are shown three ways, and none of them is what the engine runs
- Test(s): 4, 6
- What:
  - The tree node's effort tooltip shows the class value EFFORT_TM[S/M/L/XL], while the node actually uses the fitted effortTM. P13 is class L (25) but fitted to 79.62.
  - The research preview charges "science team-months = effortOf(n)". For lines that is EFFORT_TM.S = 3, though lines use LINE_STAGES (0.8 + 0.8 + 1.0 per idea). For ideas, only ideation (0.25E per candidate, at least 2 candidates) is science work. The small and scale stages are research-engineer CES work.
  - There are two ETA formulas for capability projects. The tree.ts:projectRate one assumes 2 candidates and no taste, speed or batch; the Assign / Take-off previews and teamGain use it. capProjectView has its own, which the Projects tab uses.
- Evidence: Research.tsx:85. data/v2/tree.ts:117 FITTED_EFFORT_TM (P13 79.62) and 250-254. treeActions.ts:70. tree.ts:152 effortOf. data/v2/research.ts:79, 83. tree.ts:196-206 against researchView.ts:158-171. treeActions.ts:166-188.
- Player sees: "about 25 team-months" on P13 and "3 science team-months" for a line, neither of which matches what happens.
- Fix: one effort readout from stagesOf (science and RE parts separately). One ETA function (capProjectView's), used by the previews.
- Severity: low · Effort: S

### CAP-17 Stale paradigm effect strings and a duplicate prior table
- Test(s): 5, 4
- What: ParadigmDef.effect and safetyCost are never displayed (no UI reads them). They contradict both the tree text and the engine:
  - P07 "h80 ×1.5" against 1.2;
  - P09 "+0.6 L REASON" against 0.3 OOM;
  - P11 "+0.8 / +0.4" against 0.66 / 0.33;
  - P16 "Serve ×0.75";
  - P17 "+0.4 y";
  - P18 "+0.25 y per 21-day cycle";
  - P22 "PHYS +2" against 1.65;
  - P24 "+0.8 y" against the tree's "+1 OOM".
  research.ts also builds its own PRIOR_BY_ID next to PARADIGM_BY_ID.
- Evidence: data/v2/paradigms.ts:18-42. data/v2/tree.ts:177-196. grep of src/ui finds no reads of `.effect` or `safetyCost` from paradigms. research.ts:56 against paradigms.ts:8. Already known: the player.paradigms mirror (tree.ts:453-460) and P26 kept for RNG order (data/v2/paradigms.ts:39-41, world/hidden.ts:102).
- Player sees: nothing, but these strings will mislead the next person who edits the file.
- Fix: delete `effect` and `safetyCost` from ParadigmDef, keeping id and prior. Use one prior lookup.
- Severity: low · Effort: S

### CAP-18 Headroom is a made-up withheld share, and tuning soaks up all spare research engineers
- Test(s): 2, design
- What: 30% of every adopted idea is withheld as "headroom" until routine tuning closes it (TUNE_K = 1/270). Both values are [D] with no mechanism or source. Tuning's demand is Infinity, so every research engineer and their share of experiment FLOP not taken by ops, evals or experiments flows into tuning, even when headroom is about 0. The allocation view then shows tuning as busy.
- Evidence: data/v2/research.ts:87-92. stacks.ts:105-117 addIdea headroom. stacks.ts:126-129 tuneDay. research.ts:382 `tune: Infinity`. research.ts:746-753.
- Player sees: headroom on Recipe and tuning on Company › Work. Nothing says the 30% is arbitrary or that tuning is idle work.
- Fix: source it, or remove headroom (ideas land at full effect). Alternatively make tuning demand proportional to the remaining headroom, so spare engineers show as idle.
- Severity: medium · Effort: S

### CAP-19 "Line", "idea" and "axis" each mean several things
- Test(s): design
- What:
  - "line" means three things: a capability pool (kind 'line', L.*); a safety research line (isLineNode = a safety node with an agenda, plus `line:AGxx` follow-ups); and a preview row (capLines / safLines in treeActions).
  - "idea" means four things: any tree node ("Unknown idea", "N of M ideas known"); kind 'idea'; a member of a batch ("30 ideas"); and a stack entry (st.n "ideas adopted").
  - "axis" is documented as "unlocks a lever", but in code it is the default for any non-safety node without an `effect` object, which bundles option unlocks with hard-coded multipliers.
- Evidence: data/v2/tree.ts:133-134 (capability LINE), 261 isLineNode (safety). treeActions.ts:35, 88. tree.ts:123, 243, 262, 602-605. data/v2/tree.ts:8-9, 248. research.ts:58-59. Glossary terms projectKind and linePool.
- Player sees: "Research lines" on Safety, and "line" on Research › Projects, with different mechanics.
- Fix: rename the capability pools (e.g. "directions" or "streams") or the safety ones ("agendas", their data name). Call tree nodes "nodes". Define axis = "unlocks an option" and move multiplier nodes to typed effects (CAP-02).
- Severity: low · Effort: S

### CAP-20 Stale comments and dead or duplicate exports
- Test(s): 5, 4
- What / Evidence:
  - research.ts:2 "Safety research lines keep their v2 path (models/tree.ts) until V6". They run in safety/lineProjects.ts (tree.ts:18-25).
  - research.ts:404-405 says "× P13's experiment efficiency"; P13 is not applied there.
  - researchView.ts:97 calls flopPerRe "The P13 multiplier", but it returns FLOP per research engineer.
  - rivalModel.ts:135 cites "stacks.ts recipeG", which does not exist.
  - The tree.ts:7-11, 437 auto-assign docs say "both departments"; the code covers safety only (already known).
  - Dead exports: HEADROOM_SHARE (research.ts:799), adoptCostTW (researchView.ts:445: no UI use, and a different formula from adoptTW at research.ts:516-517, which handles unlocks and domain sums), gainKnowledge (tree.ts:610, no callers).
  - The Limit text hard-codes "≤ 2 team-eq per project" (ResearchProjects.tsx:281) instead of RE_PER_PROJECT.
- Player sees: n/a.
- Fix: delete the dead exports and fix the comments.
- Severity: low · Effort: S

### CAP-21 Action previews quote made-up or wrong numbers
- Test(s): 2, 6
- What / Evidence:
  - research.reopen promises a gain of 0.05 "progress" (treeActions.ts:250), a magic number.
  - research.risk shows ±κ as a "progress" cost (treeActions.ts:235-237).
  - The research.autoAssign preview counts idle teams of both departments as "put to work" (196-198), but the policy moves only safety teams (tree.ts:438-440); capability teams are always placed by planAssignment.
  - research.move says "idle teams follow the new order" (156). All capability teams are re-planned, not only idle ones.
  - The nodePreview line gain is the per-idea effect at test scale with taste 1, not at the lab's base or the team's taste (treeActions.ts:40-43).
- Player sees: these previews in action tooltips.
- Fix: use the real quantities (odds and the expected effect at the latest base) and limit autoAssign's preview to safety.
- Severity: low · Effort: S

### CAP-22 Outside knowledge gives a free pretraining recipe sized by the model gap
- Test(s): 1, 2, 5
- What: Knowledge diffusion adds K × (the leader's public model G − the player's best model G) per year to the pretraining stack's base, scale-invariant and with no headroom. That G gap also includes compute, data and RL differences, so the player receives "recipe" for a gap that is not a recipe gap. C4 tacit knowledge is priced in progress-years × B (5 days of pace). The follower start lag is solved in progress-years against the v1 reference rate and written as a stack offset.
- Evidence: production.ts:482-491 diffusionPerDay and 500. stacks.ts:187-194 addKnowledge → addPublic(pre). actors/actions.ts:332. core/init.ts:156-178, 254 initialStacks(B × k). stacks.ts:27-31.
- Player sees: the stack base grows ("Start and public knowledge" in Recipe's make-up tooltip, Recipe.tsx:33), with no cause shown.
- Fix: size diffusion on the recipe gap (rival recipeG minus own, once CAP-06 is fixed), split by stack. Express C4 and the start lag in OOM.
- Severity: medium · Effort: M

### CAP-23 Run operations may be charged to two departments (unsure)
- Test(s): 4 (unsure)
- What: Running runs take research engineers (RE_OPS, the 'ops' need) and also engineers' "Runs (operations, setups, …)" need. This may be intended (MODEL-V3 §3.3); I did not check the engineers' side in departments/build.ts.
- Evidence: data/v2/research.ts:123-125, 131-132. research.ts:348-356.
- Player sees: run upkeep in both allocation views.
- Fix: confirm the design. If unintended, keep one.
- Severity: low · Effort: S

### CAP-24 A "paused" project (teams wanted 0) keeps experimenting
- Test(s): 6
- What: Teams wanted 0 removes the scientists. A candidate already in test still gets research engineers and FLOP, because the RE demand counts every queued project that has a test. The row shows "paused".
- Evidence: research.ts:373-376 and 382. ResearchProjects.tsx:108 label. ResearchProjects.tsx:81 tooltip "gets no science teams".
- Player sees: "paused" while the test progresses.
- Fix: label it "no ideation (test running)", or pause the test too.
- Severity: low · Effort: S

### CAP-25 Already-known items (confirmed)
- Test(s): 3, 4, 5
- Evidence:
  - The rolled tree path is only reachable by kyc (data/v2/tree.ts:228: a safety node with no agenda, no effect) and P27 (243: a paradigm in the evals column, so a safety department node and not isLineNode). The path is tree.ts:513-570.
  - The player.paradigms mirror is written by syncParadigm (tree.ts:453-460, 506, 524, 548, 562) and read by adopted() (paradigms.ts:22), and also read directly in bots/ref.ts:398-440 and models/actions.ts:122, 139, 200.
  - P26 is kept for RNG order (data/v2/paradigms.ts:39-41).
  - OLD_EFFORT_DAYS / TM_PER_OLD_DAY (data/v2/tree.ts:107-113), plus FITTED_EFFORT_TM fitted to V1 durations (114-117) and IDEA_STAGES "as the v2 project" (data/v2/research.ts:80-83).
  - Two allocators: planAssignment (research.ts:230) and autoAssignDept (tree.ts:388), with the stale doc at tree.ts:383-387 and 437.
  - cashCost: no node sets it, so the branches at tree.ts:254 and 523 and treeActions.ts:71 are dead.
  - LEVEL_PER_OOM in workfit.ts:55 (offL ÷ LEVEL_PER_OOM).
  - prodCache.M is read by researchSpeed (tree.ts:186). It also feeds gov, the tutorial and pace (CAP-01).
- Fix: as already planned. CAP-01 removes the last reason for prodCache.M.
- Severity: low · Effort: S–M

---

## Simplest coherent model

Every capability node is one of three things. A **direction** (today's line) is a pool with returns r: it turns research input (taste-weighted ideas) into OOM of one named stack at a falling rate. An **idea** is a one-off with a typed effect in a physical unit (a stack OOM, domain OOM, data efficiency or expert tokens). An **unlock** is odds plus effort and gives a design option, with no effect band.

Each day, one function turns the lab's inputs into project progress:
- science capacity^λ × the AI-ideas multiplier × taste gives candidates;
- the experiment CES on each project's research engineers and FLOP gives test work.

The same function, with fixed portfolio weights, drives the rivals. Its daily output (OOM/day by stack, candidates and tests per day) is the research-speed readout. No second model exists.

Taste's AI lift comes from AI-ideas FTE, not from a compute share. Allocation maximises expected OOM per day, not candidates per day. A candidate is dropped only when something in the pool looks better. Failure means "gave up", with the odds left standing.

A result lands at full effect once it is built in. If headroom is kept, it has a source and tuning demand follows it. A run freezes all typed effects at launch, and the recipe's realised value comes from evaluating the model that embodies it.

Paradigm multipliers either become typed effects scaled by the drawn result or are deleted, and whatever survives also applies to rivals. Recipe shows each stack in its own unit plus one G-equivalent headline, and domain and data effects in their own list. Player and rival recipes are compared through one recipeG function at one reference FLOP.

The rolled path, player.paradigms, the paradigm effect strings, OLD_EFFORT_DAYS, prodCache.M and the progress-year units all go.
