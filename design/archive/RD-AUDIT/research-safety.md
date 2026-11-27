# Audit: safety research and safety tools

Scope: src/engine/v2/safety/{lineProjects,agendas,findings,techniques,understanding,ideas,agents,latents,umodes,investigations,responses,detection,oversight}.ts, src/data/v2/{agendas,techniques,findings,safetyIdeas,oversight,tree}.ts, models/tree.ts (researchDay, autoAssign), compared with models/research.ts. UI: src/ui/v2/panels/Safety.tsx, ResearchProjects.tsx, Codex.tsx. Read-only. All paths are relative to the repo root C:\Users\david\Documents\projects\AI27.

## What the code actually does (short version, for orientation)

1. Each of the 18 agendas (AG01–AG18) has one hidden efficacy `e` (common.ts trueEfficacy) and a visible Beta "posterior" (agendas.ts:32).
2. A "line project" is any safety tree node with an `agenda`, plus one hidden "follow-up" node per agenda (data/v2/tree.ts:270-275). It runs ideation, then small experiments, then validation (lineProjects.ts:314-362). Each finished validation calls `fireFinding`, which draws a result type from `e` (findings.ts:230-237). Only a TECH result whose catalog row is the node's own row makes the node known. Every other result restarts the project.
3. The tools ("techniques") of an agenda get strength `s0 · e · D(x) · (1 − G·trainedAgainst)` (techniques.ts:22-25). Detect tools feed U and observations. Fix tools are used in post-training runs whenever their line has a team on it (traits.ts:629-633). Contain tools give containment.
4. Safety research engineers go to investigations and patches first, then experiments (capped at 50%), and the rest go to "upkeep" (lineProjects.ts:247-285). That upkeep pool is used twice: once to raise tool half-points and once as a "validation lead" in believed U (agendas.ts:155-193, understanding.ts:38-76).

---

### SAF-01 Candidate beliefs and the "best candidate" pick have no effect
- Test(s): 1 (phantom), 5, 6
- What: A safety project's ideation makes "candidates". Each one carries a belief (mu, sd), a noisy reading of the line's efficacy that is narrowed by the small-experiment and validation readings. The test picks the candidate with the best mu + κ·sd, using κ from the capability risk policy. But all candidates of a line share the same truth (the agenda's `e`), and the result draw in `fireFinding` never reads the candidate. So which candidate is tested, its taste-dependent noise and the risk policy change nothing. The belief is not shown anywhere in the UI either. Of this machinery, only the ideation rate (a time gate) and SAF_POOL_MAX (it lets ideation overlap testing) have any effect.
- Evidence: lineProjects.ts:116-131 (newSafCandidate and readStage read `trueEfficacy(s, ag)`, which is per agenda); lineProjects.ts:319, 332-336 (κ pick); lineProjects.ts:17-19 ("the result's type never reads it"); findings.ts:224-237 (draw from `e` only); `beliefShown` (lineProjects.ts:134) has no caller in src/ui. A grep for `beliefShown|\.cands` outside lineProjects.ts finds nothing.
- Player sees: Nothing. The capability risk policy toggle (ResearchProjects.tsx:182-196) reads as if it also steers safety, but it does nothing there.
- Fix: Remove the candidate pool, the beliefs, SAF_BELIEF, SAF_PICK_AT and the κ pick. Keep ideation as one time stage. Or make it real: give each candidate its own hidden quality (as capability does in research.ts:138 candidateTruth) and let the result draw read it.
- Severity: high · Effort: S (remove) / M (make real)

### SAF-02 Safety projects run on a separate engine (known, confirmed)
- Test(s): 4
- What: Safety projects re-implement the capability lifecycle: their own stage shares, their own engineer unit, their own compute unit, their own Z/hash readings and their own stepper. They have no drop rules, no per-candidate truth and no adoption step.
- Evidence: lineProjects.ts:314-362 vs research.ts:592-707; SAF_STAGES/SAF_RE_UNIT/SAF_C0_H100E (data/v2/agendas.ts:353-363) vs IDEA_STAGES/RE_UNIT/C_UNIT_FLOP_PER_DAY (data/v2/research.ts, workTypes.ts); research.ts:2 still says "Safety research lines keep their v2 path (models/tree.ts) until V6" (stale).
- Player sees: Two project screens that look alike but behave differently. Safety rows show "Follow-up", health and dead ends; capability rows show stages, teams wanted and risk.
- Fix: Merge into one project engine (see the closing section).
- Severity: high · Effort: L

### SAF-03 Separate team and engineer allocation for safety; the player cannot steer engineers
- Test(s): 4, 6
- What: Safety science teams use the old J2 ETA-greedy `autoAssign`, which only runs for 'saf'; its comment says "both departments". Teams on a line are never re-spread. Capability uses `planAssignment` with teams wanted. Safety research engineers are not allocated by the player. Each experimenting project asks for SAF_RE_UNIT × min(2.5, science capacity ÷ 4), in queue order, and experiments may take at most SAF_EXP_SHARE = 50% of the free engineers. Capability has a player-ordered RE allocation with caps (DEFAULT_RE_ALLOC, research.ts:359-404).
- Evidence: models/tree.ts:388-440 (autoAssignDept; `autoAssign` calls only 'saf', line 438-440; lineTeam never respread, 395-405); lineProjects.ts:252-264 (engineer ask derived from science capacity); data/v2/agendas.ts:360 (SAF_EXP_SHARE 0.5 [D, calibration]).
- Player sees: An engineer bar split into cases / patches / experiments / upkeep (Safety.tsx:591-594), with no control over it. The tooltip states the fixed priority.
- Fix: Use one allocator for both departments. Science teams get teams wanted per project. Research engineers get one ordered needs list (cases, patches, project experiments by priority, tool upkeep) with caps, as capability's `allocate()` already does. Drop SAF_EXP_SHARE.
- Severity: high · Effort: M

### SAF-04 "Line staffed" switches on things that were never built
- Test(s): 1, 3, 6
- What: Whether any science team works on any project of a line is a boolean, and it drives effects that have nothing to do with research:
  (a) every unlocked fix tool of that agenda is applied in every post-training run;
  (b) T-TMON's monitoring effects on E14 and E22 count only while AG07 is staffed;
  (c) AG18 "healing" per post-run scales with √(AG18 science capacity);
  (d) AG17 science capacity gives the safety AI a +0.3·√cap OOM "harness" fit, live and with no stock.
  Taking a team off the line turns these off the next day. Putting one team on the follow-up turns them back on. Nothing is built, owned or paid for.
- Evidence: traits.ts:627-633 (inRun: `techniqueRole(t) === 'fix' && lineStaffed(s, t.agenda)`); traits.ts:663, 672 (`lineStaffed(s,'AG07')`); traits.ts:712-714 (healRate × √lineMultCapped AG18); workfit.ts:360-371, 386 (ag17Capacity → harness fit); agendas.ts:80 (lineStaffed = "the pre-R8 'funded'").
- Player sees: The tool tooltip says "A training method: used in every post-training run while its line is staffed" (Safety.tsx:644). Nothing explains (b)–(d). Heal is not in predictBeliefs (traits.ts:752-761), so the run preview does not show it.
- Fix: Split "research" from "operation". A known fix technique becomes a run-design option (an explicit checkbox with its cost). Monitoring depends on the monitor deployment and its compute, not on research staffing. Healing comes from the run's own safety-training choice and known techniques. The AG17 harness becomes a built asset (a project result) with upkeep, not a live function of headcount.
- Severity: high · Effort: M

### SAF-05 Run-level "techniques" and "train against" lists are always empty (dead wiring)
- Test(s): 5, 1
- What: `PostDesign.techniques` and `PostDesign.trainAgainst` are always `[]`. No action or UI fills them. Code that reads them is therefore dead:
  - T-FILTER's open-weights rule ("only the hazard filter survives fine-tuning"), the effect the T-FILTER node card promises.
  - The run-time CoT pressure and BB masks from training against a detector.
  - The explicit half of `inRun`.
- Evidence: models/actions.ts:68 (`techniques: [], trainAgainst: []`); core/init.ts:111; incidents.ts:122 (`v.design.techniques.includes('T-FILTER')`); traits.ts:295, 300, 1123; pressureView.ts:96-97; tree.ts node T-FILTER `saf: 'Survives fine-tuning (open weights)'` (data/v2/tree.ts:204).
- Player sees: The T-FILTER card promises protection for open weights that never happens.
- Fix: Read the hazard filter from the base (`base.design.curation.hazard`, as commitments.ts:41 already does) and delete `post.techniques`. Either expose train-against as a run option or delete `trainAgainst`; the `retrainAgainst` response already covers the effect.
- Severity: high · Effort: S

### SAF-06 Techniques and nodes with no engine effect
- Test(s): 1
- What:
  - T-SPEC, T-HARDEN and T-UNDO are fix techniques that no engine code reads. T-SPEC's effect lives in the `pref: constitution` option; T-HARDEN and T-UNDO have none.
  - T-UNDO's node card promises "BIO / CYBER −; Misuse removal".
  - F13 is a TECH result with `effects: []`.
  - `kyc` (known) is a rolled node with no odds (always succeeds) and no effect.
  - T-PERSONA's E05 ×0.7 acts on an edge whose signal S6 is hard-coded 0 (known), so that part is dead too.
- Evidence: A grep for `'T-SPEC'|'T-HARDEN'` in src/engine and src/ui finds nothing; `'T-UNDO'` appears only in bots/common.ts:85. data/v2/tree.ts:208 (T-UNDO card), 228 (kyc); data/v2/findings.ts:243 (F13); traits.ts:197, 266 (S6 = 0), 641-645 (T-PERSONA E05).
- Player sees: Tree nodes with effect text and ▲ arrows. Researching T-UNDO takes T₁ of an AG15 team and gives nothing.
- Fix: Give T-UNDO a misuse effect through misuseHazards (incidents.ts:116), or remove the node. Fold T-SPEC and T-HARDEN into their ★ options and stop listing them as tools. Give F13 an effect, or merge it into F14's path. Remove kyc or wire it.
- Severity: medium · Effort: S

### SAF-07 Fix-tool effects are flat edge multipliers, independent of tool strength
- Test(s): 2, 3
- What: Fix tools change true traits through fixed multipliers on trait-graph edges: T-PERSONA ×0.7, T-CAST ×0.7 on five edges, T-W2S ×0.8, T-CONFESS ×0.6, T-ANTISCHEME ×0.1. Their `s0`, the agenda's efficacy `e` and capability decay are ignored. So a "Struggling" AG18 line's anti-scheming training works as well as a "Promising" one's, and it never fades with capability. Detect tools, by contrast, scale with s0·e·D(x). Targeted training uses another fixed table (cut 0.35, 0.3; generic 0.35·e).
- Evidence: traits.ts:641-672 (playerMods); responses.ts:93-104 (targetedPlan); techniques.ts:22-25 (detect tools: s0·e·D).
- Player sees: Fix tools in the Tools list with a "Strength" value (Safety.tsx:644) that does not drive their effect.
- Fix: Scale each fix edge multiplier by the tool's strength, e.g. mult = 1 − (1 − base)·s0·e·D(x). Or stop showing a strength for fix tools.
- Severity: medium · Effort: M

### SAF-08 A node's project is not about that node: results land on other nodes and skip prerequisites
- Test(s): 3, design
- What: A node project produces random line results: dead end, negative, discovery, spillover, false. It completes only when a TECH result hits its own catalog row. If its row cannot fire (a `requires` test like e>0.7 fails), a TECH takes the line's first unfired row (`rows[0]`). That can be another node's row, so that node becomes known by side effect (nodeKnown counts any unlocked technique or fired finding), and the tree's `needs` are skipped. Follow-up projects do the same. Discoveries from F25 unlock T-INOC (an AG18 node) from an AG08 project.
- Evidence: findings.ts:271-305 (own row / generic / idea / `rows[0]` / genericPositive); findings.ts:56-61 (candidates do not check tree needs); models/tree.ts:120-129 (nodeKnown via technique or finding); data/v2/findings.ts:255 (F25 `unlock:T-INOC`); models/tree.ts:464-476 (resolveLine).
- Player sees: "Ideas known X of Y" jumps, and nodes turn known that were never worked on. The project ETA is the ETA to "a result", not to the node.
- Fix: Make one project mean one question. A node project ends in success (its own row) or failure (dead end, which feeds the posterior). Other result types become separate outcomes of the line's follow-up work, or of explicit "explore" projects. Respect `needs` when a result unlocks a technique.
- Severity: high · Effort: M

### SAF-09 Vocabulary: line / agenda / node / project / follow-up / result / finding / tool / technique
- Test(s): design
- What: One concept has several names, and several concepts share one name.
  - "Agenda" (code, Codex) and "research line" (UI) are the same thing.
  - A "line node" is a tree node with an agenda. P27 has an agenda but is a paradigm, not a line node.
  - A "follow-up" is a hidden per-agenda node that is never known.
  - "Finding" (code, catalog F01–F49) and "result" (UI) are the same thing. "Result" is also the stage name in capability projects.
  - "Technique" (code) and "tool" (UI) are the same thing, but "tool" also covers fix training methods.
  - "Posterior" (agenda Beta, shown as "Health") differs from the per-candidate belief (SAF-01) and from trait beliefs.
  - "Effort" on a safety node is T₁·√4 team-months, which no longer drives anything (SAF-13).
- Evidence: data/v2/tree.ts:15-20, 261, 270-275; agendas.ts:1-9; Safety.tsx:543-549 ("First result at serious staffing", "Estimated chance a project here gives a working tool").
- Player sees: A Research tree where safety nodes act differently from capability nodes, a Safety "Research lines" table, and a Codex "Agendas" list, all for overlapping things.
- Fix: Use one word per thing: Line (agenda), Project (a node or a line's open study), Result (finding), Tool (detect/contain), Method (fix). Drop "follow-up" as a hidden node and show it as the line's "open study" project.
- Severity: medium · Effort: S (copy) / M (model)

### SAF-10 One engineer pool counted twice: upkeep and "validation lead"; the lead moves only believed U
- Test(s): 4, 2, 6
- What: Engineers left after cases, patches and experiments do two things at once:
  (1) they raise fading tools' half-points (`upkeepStep`, which changes the truth);
  (2) the same count ÷ RE_SERIOUS (100) ÷ lines-with-tools gives `reValidationMult`, which sets a "validation lead" VAL_LEAD·√mult (1.5 levels) up to which believed detection stays at full strength.
  (2) is only in the believed detector. `trueUnderstanding` has no valAt term. So more upkeep engineers raise the U the player sees, but not the true gap that drives drift.
- Evidence: agendas.ts:155-160 (reValidationMult), 173-193 (upkeep); understanding.ts:35-45, 75, 113 (valAt in believed U only); understanding.ts:320-363 (true U, no lead). A grep for `validationLead` in src/ui finds nothing.
- Player sees: The U chart and "upkeep /mo" (Safety.tsx:288). The lead is not shown.
- Fix: Keep one mechanism. Tool half-points (oHalf) already model "validated up to"; let believed U read the believed oHalf and delete VAL_LEAD, VAL_W, RE_SERIOUS and reValidationMult.
- Severity: high · Effort: S

### SAF-11 Tool upkeep still uses v2 units and thresholds
- Test(s): 5, 2
- What: Upkeep is computed in "M½ doublings per day" and then converted with OOM_PER_HALVING. A tool needs upkeep below D = 0.8. Engineers per tool count only above a crew of 15, with UPKEEP_REF 40, UPKEEP_MAX 1.5 and 90 days per doubling. All are calibration [D] values that stand in for a mechanism. Upkeep effort is spread evenly over fading tools with no priority. AG05 can never be upkept; AG09 cannot be upkept under latent reasoning. LINE_MULT_MAX = 2.5 ("the old Major level") caps three different things: engineer asks, AG18 heal and the AG17 harness.
- Evidence: data/v2/agendas.ts:372-393; agendas.ts:162-193; lineProjects.ts:263; traits.ts:713; workfit.ts:371.
- Player sees: "Tools fading · crew too thin (x per tool, needs 15+)" (Safety.tsx:600-603). This is visible, but the 15 and 40 come from nowhere.
- Fix: Treat re-validation as a project on the shared engine: re-validating tool T on model V costs engineer-weeks ∝ the OOM gap, and finishing it sets oHalf to V's OOM plus margin. Or keep a flow in OOM per engineer-month with one sourced rate. Remove the M½ and Major/Seed vocabulary.
- Severity: medium · Effort: M

### SAF-12 Tool half-points are stored as v2 M½ and converted on a fixed ai2027 path
- Test(s): 5
- What: Agendas store `mHalf` (25, 250, 2000 = v2 research-multiplier values). The engine converts them to OOM through REF_M_LEVEL on a memoised ai2027 world (oomOfRefM), with DECAY_KAPPA picked "so the half points are the same as v2". The same applies to AG09_LATENT (M½ 5), the FALSE tool's oHalf `oomOfRefM(25)`, and F21/F30 "−1.11 / −0.82 OOM" (v2 ×0.5 / ×0.6). In non-ai2027 worlds the half-points are still ai2027's OOM values. That may be intended, but it is not stated as a physical unit.
- Evidence: data/v2/agendas.ts:266-271, 395-396; safety/oversight.ts:44-83; data/v2/oversight.ts:47-61; findings.ts:376; data/v2/findings.ts:251, 260.
- Player sees: Codex shows "Half strength … OOM above the 2025 model" (Codex.tsx:41), which is correct after conversion.
- Fix: Store oHalf in OOM directly in the agenda data (one column) and delete oomOfRefM, REF_M_LEVEL and refPath. Re-state F21/F30 as OOM.
- Severity: low · Effort: S

### SAF-13 Migration and old progress fields kept alive at runtime; node effort is display-only
- Test(s): 5
- What: `safFromProgress` (schemaRev 21→22) runs both in save.ts and lazily in `safState`, whenever a project has `progress > 0` and no `saf`. `ts.progress` is still written every day as a readout. Every safety node's effort is overwritten to T₁·√SERIOUS_CAP, a pre-E1 √capacity formula. The per-node effort classes in the data (T-INOC 'S', T-ANTISCHEME 'L', T-CAST 'XL') are discarded: all nodes of one agenda take the same time. `effortTM` no longer drives anything for line nodes.
- Evidence: lineProjects.ts:64-91, 361; core/save.ts:385-392; data/v2/tree.ts:256-266 (lineEffortTM, overwrite loop); data/v2/tree.ts:203, 209-210 (declared classes).
- Player sees: Effort class S/M/L/XL in Codex (Codex.tsx:46) that is the same for every node of a line and does not match the T₁-based ETA.
- Fix: Delete the runtime fallback (keep only the save migration). Either honour per-node effort (a multiplier on T₁) or stop declaring it.
- Severity: low · Effort: S

### SAF-14 "Dead end" is a one-way latch that halves a line's speed forever
- Test(s): 2, 6
- What: After a DEAD result, if the posterior mean is below 0.25, the line's status becomes 'deadEnd' and all its stages run at ×0.5 for the rest of the game. Nothing resets it, even if later TECH results raise the posterior.
- Evidence: findings.ts:313-314; agendas.ts:239 (status update skips deadEnd); lineProjects.ts:205.
- Player sees: The line row gets a 'dead' CSS class (Safety.tsx:541). The halving is not stated anywhere.
- Fix: Remove the speed penalty. The posterior already lowers the expected value, and the player can choose to drop the line. If kept, derive it from the posterior each day and show it.
- Severity: medium · Effort: S

### SAF-15 The "posterior" is not a posterior of the draw model
- Test(s): 2, design
- What: Result weights are TECH e, DEAD 0.5(1−e), NEG 0.3 (+0.3), DISC 0.15·present + 0.05·absent U-modes + 0.1·rows, and SPILL 0.1. The Beta update is TECH a+1, FALSE a+1, DEAD b+2, NEG b+1, and nothing for DISC and SPILL. A Beta(a, b) updated this way does not track `e` under these weights. NEG frequency has nothing to do with `e`, yet it counts against it. The DISC weight depends on hidden U-mode presence, so many discoveries say something about the models, not the line. The UI's "Estimated chance a project here gives a working tool" is therefore a heuristic.
- Evidence: findings.ts:230-237, 306, 313, 335, 385; agendas.ts:135-140 (posteriorBand label thresholds 0.55 / 0.3).
- Player sees: The Health pill and band (Safety.tsx:549-550).
- Fix: Reduce each result to a Bernoulli on `e` (work / doesn't). Update the Beta only on those. Make NEG, DISC and SPILL separate events that do not touch the Beta.
- Severity: medium · Effort: M

### SAF-16 One hidden number per agenda drives four different things
- Test(s): 3, 6
- What: Agenda efficacy `e` sets the chance of a working result, multiplies every tool's strength in that agenda, scales AG18 healing, gates catalog rows (`requires e>0.7`, AG01's U16/U22 reveal at e>0.8), and enters targeted training (0.35·e). The UI explains Health only as "the chance of a working tool". It does not say that a line's Health also weakens tools already in the stack.
- Evidence: techniques.ts:42-51; traits.ts:713; findings.ts:44-53, 70-71; responses.ts:103; Safety.tsx:549.
- Player sees: Health only as a chance of a working result.
- Fix: Keep a single latent (it is defensible: agendas "work or not"), but say so in the Health tooltip ("also scales the strength of this line's tools"). Or separate "does the approach work" (tool strength) from "how often a project pays off".
- Severity: medium · Effort: S

### SAF-17 AG17 keeps a v2 level gate the design says was removed
- Test(s): 5, design
- What: AG17 line projects cannot run unless the safety-agent model has measured level ≥ 10 (AG17_MIN_L). agents.ts says v2's special cases are gone ("no level gate (AUTOMATE_MIN_L; coverage gates it)"). AG17 also has two jobs: its science teams produce findings (F44, F45) and, at the same time, act as a live harness on the safety package (SAF-04d).
- Evidence: data/v2/agendas.ts:397-398; models/tree.ts:249, 352-358; agents.ts:131-132; workfit.ts:360-371.
- Player sees: "Needs a safety-research model at measured level ≥ 10" (projectReady reason); "Pays off with a safety model at level ≥ 10" (data/v2/tree.ts:239).
- Fix: Drop the gate, since coverage already scales the payoff. Turn the harness into a built result of the `aar` project.
- Severity: medium · Effort: S

### SAF-18 P27 and kyc still use the old rolled path with the BRIDGE research multiplier (known, confirmed)
- Test(s): 4, 5
- What: Safety-column nodes that are not line nodes (P27, which is a paradigm despite `agenda: 'AG17'`, and kyc) progress at `researchSpeed` = prodCache.M × √capacity ÷ (effort·30) and roll odds. This is the v2 BRIDGE(V6) mechanism. P27 teams do not count as AG17 staffing (isLineNode is false).
- Evidence: models/tree.ts:13-17, 185-186, 208, 547-561; data/v2/tree.ts:243 (P27 `agenda: 'AG17'`), 261 (isLineNode excludes paradigms).
- Player sees: The same tree card style, but a different pace and odds model.
- Fix: Run P27 on the shared project engine. Remove the rolled path and `researchSpeed`.
- Severity: medium · Effort: S

### SAF-19 Several meanings of "strength"
- Test(s): 4
- What:
  - `s0`: base strength.
  - strengthTrue and strengthBelieved: s0·e·D·Goodhart.
  - `decayAt` D: three rules (logistic, the AG05 Engels gap, AG09 latent).
  - `valAt`: validation lead, believed only.
  - The "strength" argument of observeVersion: combined detection, turned into σ = 0.12/strength.
  - The audit's `max(0.3, d)` floor.
  - revealTrait's strength of 2.4.
  - The FALSE tool's s0 0.8 with coverage 0.6.
  - genericPositive's s0 ×1.1.
  - T-CCLASS strength ÷ 0.4 in misuse.
  - Fix-tool "strength" that does nothing (SAF-07).
- Evidence: techniques.ts:14-51; understanding.ts:41-44; detection.ts:195-202; agendas.ts:208-213; findings.ts:120, 166, 373-377; incidents.ts:119-120.
- Player sees: One "Strength" number per tool (believed s0·e·D), which is not what most consumers use.
- Fix: Define one tool strength (s0·e·D(x)·Goodhart) and one observation rule (σ from strength). Delete the ad hoc floors and multipliers, or turn each into a named catalog effect.
- Severity: medium · Effort: M

### SAF-20 Several meanings of "clarity"
- Test(s): 4, 2
- What:
  - Trait belief clarity = 1 − sd/0.35 (detection.ts:23-28).
  - Investigation "clarity" is a separate 0..1 stock that resolves at 0.8 (investigations.ts:133-138).
  - Risk-family clarity is the mean of trait clarities, with an "unseen" threshold of 0.3 (view.ts:86-100).
  - Finding effects `clarity:T:x` pick σ so that sd shrinks by x·0.35, then pass strength 0.12/σ back into observeVersion, which turns it back into σ (findings.ts:91-104), a round trip.
  - Audits add "clarity ≈ +0.15".
- Evidence: as listed above.
- Player sees: "clarity" in several panels with different meanings.
- Fix: Rename the investigation stock to "case progress". Express finding effects as observations with a stated σ.
- Severity: medium · Effort: S

### SAF-21 Readouts, data fields and copy left over from v2
- Test(s): 5
- What:
  - `safetyUtilisation.linesWanted` = online × lineMult × computeRef, the v2 "what a funded line asks for". It does not match the E1 allocation, which shares out the whole pool, and no UI uses it.
  - `AgendaState.computeShare` is a daily copy of the allocation.
  - `fteRef` and `fteRange` are unused.
  - Codex shows "Compute share 3–8%" of lab compute, but the engine uses computeRef only as a weight and a unit against a fixed 1e6 H100e.
  - Glossary `trustedToAI` says "every funded agenda".
  - Line tooltip: "Results arrive faster with more teams (√ capacity)". The rate is capacity^λ, gated by engineers and compute.
  - ETA tooltip: "At today's teams and research speed" ("research speed" is v2's M).
- Evidence: view.ts:221-235; agendas.ts:102-108; data/v2/agendas.ts:279-285, 326; Codex.tsx:41; data/v2/glossary.ts:356; Safety.tsx:546, 562.
- Player sees: Wrong or stale explanations.
- Fix: Delete linesWanted, linesGot, computeShare state, fteRef and fteRange. Fix the copy.
- Severity: low · Effort: S

### SAF-22 Hard-coded agenda special cases spread across files
- Test(s): 3
- What: Agenda IDs are tested in many places:
  - AG05: Engels-gap decay, no upkeep.
  - AG09: latent override, no upkeep.
  - AG07: the only containment, and its staffing gates monitors.
  - AG02: white-box audits; AG02 and AG08 are the only cross-checks.
  - AG01: U16/U22 at e>0.8.
  - AG08: generic EVAL reveals edges.
  - AG17: level gate, harness.
  - AG18: heal.
  - F44: AG18, AG03 and AG16.
  - WB_AGENDAS.
  This behaviour cannot be found from the agenda data.
- Evidence: techniques.ts:30-37, 104; agendas.ts:165-166, 205; findings.ts:37-38, 70-71, 171-181; traits.ts:663, 672, 712, 723; data/v2/safetyIdeas.ts:296; models/tree.ts:249.
- Player sees: Codex agenda cards that do not mention these rules (Codex.tsx:41).
- Fix: Move the rules into agenda data fields (e.g. `decay: 'gap' | 'logistic'`, `crossCheck: true`, `contain: true`) read by generic code, and show them on the agenda card.
- Severity: medium · Effort: M

### SAF-23 Auto-assign quietly staffs unqueued lines, which turns on SAF-04 effects
- Test(s): 6, 3
- What: With auto-assign on, an idle safety team with nothing queued is put on a line by a hidden score: +10 if the line has no team, + 2·posterior mean, + 0.5 for specialty. The line's project is added to the queue. That staffs new lines, which puts their fix tools into every run and switches on AG07 monitoring and AG18 healing, without a player decision. Teams finishing a node also auto-continue to the line's next node or follow-up.
- Evidence: models/tree.ts:366-378, 428-434, 478-486, 542.
- Player sees: Teams appear on lines.
- Fix: Leave idle teams idle and flag them (the "idle" badge already exists, Safety.tsx:517). Or surface the rule in the auto-assign tooltip.
- Severity: medium · Effort: S

### SAF-24 Safety compute and engineer units differ from capability's
- Test(s): 4, 2
- What: Safety experiment compute is c = flop ÷ (computeRef × 1e6 H100e × Φ), and labour is ℓ = (m·RE ÷ 50)^λ. Capability uses C_UNIT and RE_UNIT. The safety pool after monitors, agents and cases is always fully handed to experimenting projects in proportion to engineers × computeRef, so line compute cannot be idle or capped. AI share of line work weights SAF_STAGES.idea (0.2) against experiments (0.8). That reuses stage time shares as a labour weight.
- Evidence: lineProjects.ts:224-229, 272-281, 301-306; data/v2/agendas.ts:357, 363; agents.ts:158-160.
- Player sees: "Compute share" per line (Safety.tsx:545).
- Fix: Use the same physical units and the same experiment-pool allocation as capability. The safety pool becomes a budget line in that one allocator.
- Severity: low · Effort: M

### SAF-25 Investigation rate is a made-up formula
- Test(s): 2
- What: Monthly case clarity = g·√(fte·m/15)·min(1.5, (computeShare/0.05)^0.2). The 15, 0.05, 0.2 and 1.5 have no source. Case compute is a free 5% default share of the safety pool, taken before lines.
- Evidence: investigations.ts:128-131, 101; lineProjects.ts:226-228.
- Player sees: "Clarity grows with √(people ÷ 15)" (Safety.tsx:683). This is visible, but arbitrary.
- Fix: Run cases as projects on the shared engine (an engineer-weeks need based on detection strength), or cite the source of the constants.
- Severity: low · Effort: M

### SAF-26 Sandbagging is deliberately left out of ETAs (design note)
- Test(s): 6 (by design)
- What: Readouts call lineLabour with truth=false, so a sabotaging safety model's slow-down shows up only as late results. This is intended as a "symptom", but the only signal is an ETA that keeps slipping, and there is no "expected vs actual" readout.
- Evidence: lineProjects.ts:178-181, 374, 388.
- Player sees: ETAs that are too short.
- Fix: Show "results per year: expected vs observed" on the line row, so the symptom can be read.
- Severity: low · Effort: S

---

## Counts
High 7 (SAF-01, 02, 03, 04, 05, 08, 10) · Medium 13 (SAF-06, 07, 09, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23) · Low 6 (SAF-12, 13, 21, 24, 25, 26).

## Simplest coherent model

Safety research should use the capability project engine (models/research.ts) as is. A safety project is a tree node (or a line's repeatable "open study") staffed by safety science teams through the same teams-wanted allocator. Safety research engineers and safety experiment compute go into the same ordered RE/compute allocator as a separate budget line (cases → patches → tool re-validation → project experiments, with caps). The lifecycle is the same: ideation → small experiments → frontier validation → result, in the same physical units.

Three things must stay different:

1. **Per-world truth.** Truth is the agenda efficacy `e`, shared by all projects of a line. A project's result is a Bernoulli "works / doesn't" on `e`, and the visible Beta updates only on those outcomes. Discoveries, negatives and spillovers are separate, explicitly modelled events of a line's open study, not draws mixed into the same roll.
2. **The output is a tool or method, not a stack OOM.** A detect or contain tool enters the stack. A fix method becomes a run-design option that the player ticks and pays for. Nothing depends on "a team is on the line".
3. **Tools fade with capability (oHalf in OOM).** Re-validating a tool on a newer model is itself a small engineer project that raises oHalf. Believed U reads believed tool strength and oHalf only: no separate validation lead, no M½ conversion, no dead-end latch.

Sabotage stays a property of the AI share of a project's work, as now. With this, "how R&D works" is one story for both departments. Safety differs only in what a result is and what the truth is drawn from.
