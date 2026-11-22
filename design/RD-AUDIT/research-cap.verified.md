# Verification: research-cap.md (checked at ea624ae, read-only)

CAP-01 · PARTLY · high · Core claim holds: applyBestMix rewrites core.split.experiments/agents daily unless researchManual (production.ts:454-464, called from advanceLab 475), maximising a unit-project X whose AI term is the EXP slot only (production.ts:173 `AI0: ex.AI`; xAtMix 118-134), with taste weighted by heads (160-171, comment says "capacity-weighted") against the engine's per-project capacity weights (research.ts:174-189); M feeds researchSpeed for rolled nodes (tree.ts:186/208), govSeenM (gov.ts:57), tutorial act (capability.ts:325), P24 (tree.ts:597). Wrong detail: pace/lead conversions are not really an M consumer. `rate` = gRate/B × rateMult × M/M0 (production.ts:193-195), where e0 differs only in k and the ratio is about 1 once the mix settles, so paceOf (rivals.ts:200) is in effect the measured stack rate. Also missed: prodCache.elast is read by action previews (models/actions.ts:174, 334; productOps.ts:390; teamActions.ts:26; teams.ts:405). The fix is sound.

CAP-02 · CONFIRMED · high · Axis default at data/v2/tree.ts:248; constants at research.ts:416 and production.ts:154 (dup), workfit.ts:248-249 (useLabour also serves SAF_EXP, 378), runs.ts:95, workfit.ts:56 (P19); there is no paradigm code in rivalModel.ts or rivals.ts. One nuance: P05 also unlocks the 'deep' effort option and the deepThink/deepResearch features (data/v2/tree.ts:189, features.ts:118, 131), so "delete" must keep those.

CAP-03 · CONFIRMED · high · researchView.ts:266-267 sums rlMid+rlCeil and train+serve (STACK_GROUPS data/v2/research.ts:102-106). Domain ideas are pushed with `stack: eff.stack ?? 'pre'` (research.ts:574), and their realised value = xTest, a "×design" number shown under "(OOM)" (Recipe.tsx:56). Data and expert effects push no adopted entry (research.ts:562-573). `eff` is the hidden true value fixed at adoption (research.ts:558-561), revealed by the date check (researchView.ts:233-239) and labelled "Measured on a model…" (Recipe.tsx:64).

CAP-04 · CONFIRMED · medium · The freeze covers pre and RL only (runs.ts:443-445). At completion the code reads the current serveTechMult (runs.ts:583), domainG (withDomainG 250-253 via postBuild 266), P07 (262) and p24Dg (238 via baseG at 525). The base's playerDraw/dataFx are also read at completion (runs.ts:234).

CAP-05 · CONFIRMED · high · phi = min(1, capShare(capFrontier)/0.15) whenever split.agents > 0 (workfit.ts:329-330). A lab with a tiny agent pool at the default shares gets the full taste lift for every team (research.ts:186). Rivals use phi = 1 (rivalModel.ts teamTaste(0, sdAI, 1, …)). The fix is sound.

CAP-06 · CONFIRMED · medium · The player's G-equivalent is gEquivOf(latestBaseFlop, …, trainNow) (stacks.ts:165-172); the rival's is at FLOP_RL_REF with no train term (rivalModel.ts gEquivOfRecipe). They are subtracted at theft.ts:61 and compared at actions.ts:115. "stacks.ts recipeG" does not exist.

CAP-07 · CONFIRMED · medium · Fixed DEFAULT_LINES portfolio (rivalModel.ts recipeParts), fixed AGENT_EXP/AGENT_IDEAS, min(E, I), S_CLAMP duplicate. Rivals do have their own auto mix (bestRivalMix), which the entry does not mention, but no claim is wrong.

CAP-08 · PARTLY · medium · Allocator value = Σ√cap/idea (research.ts:216-226, 263-267, 312), no taste or effect size; λ=0.5 has no preset override (calibration.ts:95, grep). Wrong detail: the AI-ideas multiplier is lab-wide, so (mIdeas·cap)^λ only scales every project by the same factor and leaving it out does not change the allocation. Teams on an idea under test keep ideating into the pool (research.ts:599-607), so the "only after a drop" point is right.

CAP-09 · CONFIRMED · medium · The drop rule is an absolute DROP_FRAC×pub (research.ts:663, 674); pickCandidate has no floor (479-483); the failure text is at 504; drops reset only for lines (694). Within an attempt a failure can be noise while works() is true.

CAP-10 · CONFIRMED · low · The pool advances by at.xTest and the input is kept "for the readout" (research.ts:687-693). The tooltip says "r × log₁₀ of the research input" (ResearchProjects.tsx:283). The line's realised value (researchView.ts:190) is gross of headroom.

CAP-11 · CONFIRMED · medium · batchOf(inp.X) is lab-wide (research.ts:158, 600). The batch has its own survival and drop rule (674). st.n += 1 per addIdea (stacks.ts:116), and `also` adds a second count (research.ts:557).

CAP-12 · CONFIRMED · low · EMA/14 seeded with START_G_RATE (tree.ts:104-114, research.ts:754-757). hist holds 14 weekly samples (764-768), while the Recipe tooltip says "last two weeks" (Recipe.tsx:76). See CAP-V2 for what else gRate measures.

CAP-13 · CONFIRMED · medium · Prior mean `effect?.mean ?? 1` with no unit; unitLbl is '' for unlocks (ResearchProjects.tsx:249); fmtEst returns 'it unlocks' (research.ts:706).

CAP-14 · PARTLY · low · Adoption is immediate (research.ts:698-702), so the Result stage has zero length. Wrong detail: build.ts:334 is a live message (it refuses to cancel an 'adopt' build item, and those items exist), not a relic of manual adoption. Only research.ts:530 is an unreachable guard string.

CAP-15 · CONFIRMED · low · The rolled fields are written by the capability path (research.ts:200, 700, 744, 781-783). capProgress (whole chain, 0.33/0.33/0.34) and stageFrac (per stage, researchView.ts:133-142) measure different things, so they differ by construction. That is a readout inconsistency, not a mechanic bug, so I rate it low rather than medium.

CAP-16 · CONFIRMED · low · Research.tsx:85 shows EFFORT_TM[class] while effortTM is fitted (data/v2/tree.ts:117, 250-254). nodePreview charges effortOf (treeActions.ts:70). projectRate's ETA assumes 2 candidates and no taste or batch (tree.ts:196-206), against capProjectView's (researchView.ts:158-171).

CAP-17 · PARTLY · low · The strings are dead and should go, but several listed "contradictions" are just L↔OOM unit conversions (LEVEL_PER_OOM = 1.2, workTypes.ts:66; B_G_PER_Y = 1.2, runDesign.ts:17): P11 +0.8/+0.4 L = 0.67/0.33 OOM, P22 +2 L = 1.67 ≈ 1.65 OOM, P24 +0.8 y × 1.2 = 0.96 ≈ "+1 OOM", and P16 ×0.75 / ×1.15 = 0.125 / 0.06 OOM. Real mismatches are only P07 (1.5 vs 1.2) and P09 (0.6 L = 0.5 OOM vs 0.3).

CAP-18 · CONFIRMED · medium · HEADROOM 0.3 and TUNE_K are [D] (data/v2/research.ts:87-92; it cites MODEL-V3 §5.5 for the concept only). `tune: Infinity` (research.ts:382) absorbs all spare research engineers and their FLOP (746-753).

CAP-19 · CONFIRMED · low · Naming overlap as described.

CAP-20 · CONFIRMED · low · The stale comments are at research.ts:2, 404-405, researchView.ts:97 and rivalModel.ts (recipeG). gainKnowledge (tree.ts:610) and HEADROOM_SHARE have no callers; adoptCostTW is only re-exported (selectors.ts:175), with no UI use. The "≤ 2" is hard-coded (ResearchProjects.tsx:281).

CAP-21 · CONFIRMED · low · treeActions.ts:156 ("idle teams follow"), 196-198 (idleTeams over all departments, while autoAssign is safety-only, tree.ts:438-440), 235-237 (κ shown as progress), 250 (0.05).

CAP-22 · CONFIRMED · medium · production.ts:482-500 (gap in model G); C4 is 5/365 × paceOf × B (actions.ts:332); the follower lag is solved in progress-years × B (init.ts:156-178).

CAP-23 · CONFIRMED · medium · Each running run is charged twice with the same sizes: research engineers through RE_OPS (data/v2/research.ts:123-125, "mirrors the engineers' run upkeep"; research.ts:348-356) and engineers through runOpsTW in upkeepLines → engDemand.runs (build.ts:99-113, 130-136, 161). MODEL-V3 §5 (design/MODEL-V3.md:279-281) gives run operations to research engineers only and gives engineers "run setups, product upkeep, builds", so the engineers' run upkeep is the extra charge. See CAP-V1: the research-engineer side has no effect anyway.

CAP-24 · CONFIRMED · low · experimenting() counts any queued project with a test (research.ts:370-376). The label 'paused' is set when want 0 and no teams (ResearchProjects.tsx:108, 291).

CAP-25 · CONFIRMED (spot-checked) · low · I spot-checked tree.ts:186 (researchSpeed, used only by rolled nodes at 208), tree.ts:453-460 syncParadigm and tree.ts:438-440 (safety-only autoAssign); the rest was not re-checked.

Duplicates: CAP-20's recipeG item duplicates CAP-06. CAP-25's prodCache.M item duplicates CAP-01. CAP-13 overlaps CAP-02.

## Missed

CAP-V1 · medium · The research-engineer "Run operations" need is a pure sink. alloc.re.ops is read only into research.last (research.ts:759); a shortfall never slows or stops a run. It just takes research engineers from experiments and tuning, while the run's real upkeep is charged to engineers (build.ts:113). Fix: drop one side, or make the research-engineer ops shortfall slow runs.

CAP-V2 · medium · gRate (research.ts:754-757), and through it Recipe's "Software progress", production's `rate`, paceOf/lead conversions and C4's size, measures every change in stacksGEquiv, not only research. That includes:
- public inflows written to stacks.pre.base: diffusion (production.ts:500), C4 and leaks (stacks.ts:187-194);
- a jump whenever latestBaseFlop changes: scale-dependent buckets and refRlGain are re-evaluated at the new F (stacks.ts:165-172).

A new base, or catching up by diffusion, therefore reads as faster research. Fix: rate from adopted-idea deltas at a fixed reference F, with public knowledge tracked separately.

CAP-V3 · low · evaluatedAfter for non-'pre' stacks accepts any version with v.day > day (researchView.ts:239), including distills and minis that never took the RL recipe. So an RL or serving idea's "realised" value is revealed by a model that does not embody it.
