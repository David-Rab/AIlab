# inputs.md — adversarial verification

Repo at ea624ae. Probes I ran (read-only, in this folder): probe2.ts (re-run, reproduces the auditor's table exactly), verify_inp02.ts (per-project experiment *rate* as stepProject computes it, baseline vs +1/+3 RE teams, plus a 60-day twin run), verify_inp13.ts (engineer hire preview vs real build capacity; safety pool sum at extreme settings), verify_mixcurve.ts (mix chart peak vs Auto).

INP-01 · CONFIRMED · high · xAtMix (production.ts:119-134) scales only the EXP slot's AI (AI0 = ex.AI, :175) while eng/capFrontier compute is split.agents × capShare (workfit.ts:244-245); Auto sits at f=0.99/0.983, and build capacity at day 600 is 350 vs 755 at 50/50 (re-run). The mix chart's M curve is almost flat (2.91 at f=0.02 to 3.29 at f=0.98), so Auto gives up 53% of build capacity for a few % of M. Fix (b) is sound.

INP-02 · PARTLY · high · The mechanism is right: tune demand is Infinity (research.ts:382), FLOP is split per RE head (:736) and tuneDay has no floor (stacks.ts:126-129). Two details are wrong. (1) The "×0.77–0.84" is FLOP, not speed: through the CES, a saturated project's rate falls ×0.91–0.95 with +3 teams (×0.97 with +1). (2) "Hiring slows capability projects" holds only while every experimenting project already has RE_PER_PROJECT. At days 300/450/600 the 75% share cap binds, so extra REs reach the last project and the summed project rate *rises* (×1.02–1.11). Saturated projects still lose 3–7%. In a 60-day twin run from day 300, summed progress was 5.54 vs 4.75 (+3 RE), but RefBot diverges between the twins. The fix is sound, but it must also drop or soften the 75% exp share (see INP-V01).

INP-03 · CONFIRMED · high · tree.ts:186/210 (M×√cap for non-line, non-cap nodes), gov.ts:57, capability.ts:325, teamActions.ts:29-31, actions.ts:334 and agentActions.ts:237 all read prodCache.M or its elasticities. M is a unit-project proxy (production.ts:98-115) with no m_IDEAS and no per-project RE/FLOP split. Glossary rdmult (glossary.ts:7) lists only two parts.

INP-04 · CONFIRMED · medium · The rate path is at production.ts:193-195. The limits conversion is in core/limitsView.ts:50-53 (path given as production/; the file is core/). Company.tsx:160-172 shows ×rel "vs leader day 0" and ×M "from AI" side by side.

INP-05 · CONFIRMED · medium · φ = min(1, capShare/0.15) and needs only split.agents>0 and a frontier model (workfit.ts:328-330), so it is independent of H100e. Safety φ = t (workfit.ts:406). φ=1.00 at every checkpoint.

INP-06 · CONFIRMED · medium · m_IDEAS enters ideation (research.ts:603) and sdAI/φ enter taste (workfit.ts:325-330). The readout parts list only agents=X/Xh and taste (production.ts:196). Largely a duplicate of INP-03 and INP-05.

INP-07 · CONFIRMED · medium (not high) · Spare serving is added only to capRoutine (workfit.ts:245), defaults on (init.ts:261), is left out of agentSplitShare and so out of monitor need and fleets (agents.ts:74-77, 93-95), but is counted by covert.ts:191. LENT_RECOVERY=0.5 (revenue.ts:210, 644). Severity: spareServingToResearch was 0 at every RefBot checkpoint, so it bites only when products under-use serving.

INP-08 · CONFIRMED · low · Idle training goes to experiments only under policy 'research' (research.ts:412, production.ts:153). The default is 'data' (data.ts:399). It is one quantity read in two places, not a mismatch.

INP-09 · CONFIRMED · medium · P05 ×1.3 and P20 ×(1+0.1·payoff) apply in useLabour to every slot, safety included (workfit.ts:248-250). P20's payoff is pool/2e6 H100e and P13 runs on RSCH from 6.5 to 8.5 (tree.ts:594-596). The node text says "Agent throughput" (paradigms.ts:18, 33).

INP-10 · PARTLY · medium · internalFx does apply every built feature to internal agents (serving.ts:206-213). But it is filtered by the work types each feature lists (fxOn/inScope, serving.ts:195-198), not "every work type". It is also disclosed: the glossary featScaffold/featHorizon (glossary.ts:563-564) and the Products features tip (Products.tsx:543) say scaffolds and horizon extenders "also help your internal agents". What is missing is a per-feature delta, not the disclosure.

INP-11 · CONFIRMED · medium · agentVersion falls back to routine (agents.ts:43-50). setInternalAgent rewrites or creates the internal deployment (deployments.ts:141-153), and its controlLayer gates control for all uses (oversight.ts:136). The header is stale (agents.ts:3-6).

INP-12 · CONFIRMED · medium · aiShareByRole gives eng = aEng coverage (teams.ts:405-408), while the Agents lane gives eng = 1−wH (agentActions.ts:175). Sci = Φ(sdAI) and safety = fleet aiShare.

INP-13 · CONFIRMED · high · Strong science gets dTau = e^{σ·0}−1 = 0 (teamActions.ts:35-36). The engineer preview shows +1 t-wk/wk, against a real gain of +2.3/+5.3/+11.3 at days 30/300/600 (verify_inp13). Safety shows "+heads safety staff" (:26). The RE row overlaps INP-02 and INP-03.

INP-14 · PARTLY · medium · The duplication is real: tauH/STAR_HIRE (teams.ts:107-108) vs starTaste/STAR_TASTE (workfit.ts:199). The chip claims "quality" (Company.tsx:287) and safety teamTaste has no star factor (lineProjects.ts:157, not :155). But "neither matches what research uses" is wrong. Stars only rise through the gated action (teams.ts:398; gate actions.ts:331 at tasteHire ≥ 1.5), so stars ≤ 10 and both give 1 + 0.05·stars. starTaste is capped by the gate.

INP-15 · CONFIRMED · high · The two allocators are as tabled. autoAssign() calls only autoAssignDept('saf') although its comment says "both departments" (tree.ts:437-440). The capability planner runs every day regardless (research.ts:334).

INP-16 · CONFIRMED · medium · The heads/CAPACITY_UNIT×quality×specialty formula appears 5 times (workfit.ts:365, research.ts:162, tree.ts:172, agendas.ts:59, lineProjects.ts:154). RE_UNIT=2 (workTypes.ts:135) and RE_PER_PROJECT=2 (data research.ts:122, not :253) are separate. There is no "team-equivalent" glossary entry.

INP-17 · CONFIRMED · medium · RE_OPS (data research.ts:125) copies UPKEEP's run constants (build.ts:68). Note: the engineers' run upkeep also scales by √engScale(flop) (build.ts:100), so the two pools charge differently shaped amounts, not identical ones. Eval inference comes out of the experiments pool (research.ts:728-730).

INP-18 · CONFIRMED (reproduced) · medium · linePoolH100e clamps only the lines (lineProjects.ts:225-229). The monitors' coverage uses the full budget (agents.ts:126-133) and the safety agents get pool × share (workfit.ts:244). With budget 100%, 'same' monitors on all four uses and safety agents at 60%, the safety pool runs 140%/144%/160% at days 30/300/600 (verify_inp13). At budget 50% coverage need was <50% of the pool, so the auditor's exact example does not oversubscribe in this run. Investigations' computeShare never draws H100e; it only enters caseRate as a factor (investigations.ts:130). The safety view's compute breakdown (safety/view.ts:218-232) has no UI reader. The fix is sound.

INP-19 · CONFIRMED · medium · The split is on Compute›Split (Compute.tsx:731), the agents split on Company›Agents, and the safety claims on the Safety/Agents panels. Compute.tsx:4 is stale.

INP-20 · CONFIRMED · medium · buildKnots runs in hidden.ts:46. knotAt is read only by the v2 branches (production.ts:271, 289, 442) and identity.ts. Fix incomplete: hRef, refTotal and frontierFlop are also live imports from knots.ts (rivals.ts:27, ref.ts:36, runs.ts:22, rivalModel.ts:37), so they have to move as well.

INP-21 · CONFIRMED · low · Manual is [0.02, 0.98] (split.ts:58, comment :55 "the same range"), Auto searches [0.01, 0.99] (production.ts:428-429), and the chart plots 0.02–0.98 (readout.ts:35).

INP-22 · CONFIRMED · low · researchMods (workfit.ts:256-266); lineSpeed copies siloing and ASIC (lineProjects.ts:201-207); treaty 0.65 again in rivalResearch (production.ts:389).

INP-23 · CONFIRMED · low · speedOfCopy is min(50, 60·3600/4e4) = 5.4, all constants (workTypes.ts:120-124). SPEED_CAP and PROD_SPEED_CAP are both 50. S8 reads copies/3e5 (safety/traits.ts:208-209, 1188), so the constant rescales a safety signal.

INP-24 · CONFIRMED · low · The headers are stale as listed (build.ts:3-4 "1/(1 − A_eng), capped"; teams.ts:10-12; agents.ts:4-6; Compute.tsx:4). Duplicates the INP-20 cleanup.

INP-25 · PARTLY · medium · The fixed −0.05 security line is real (agentActions.ts:246) and the action preview has no build delta. But the Agents edit popover (Agents.tsx:90-97) does show build capacity before→after when editing the eng lane, AI taste for frontier, and the monitor pool share and cost. The gap is narrower than claimed: build is not shown when the *routine/frontier* lane's compute change re-normalises the eng share (withAgentChange, agentActions.ts:51-57), and m_IDEAS is never shown.

## Missed by the auditor

INP-V01 · medium · The 75% exp share (DEFAULT_RE_ALLOC, data research.ts:129) gives a project in experiments zero research engineers while tuning keeps REs. At day 600, seven projects are experimenting, 12 of 16 REs are on experiments (the cap), and the seventh (P05) gets RE 0, so its rate is 0, while 3.94 REs tune (reAllocation research.ts:393-397; verify_inp02 "P05:0→0.152"). At day 300 the sixth project gets 0.5. The auditor's fix (drop RE_PER_PROJECT) leaves this starvation in place unless the share cap goes too.

INP-V02 · low · The research-mix chart plots M = X/Xh·taste (readout.ts:28-36), but Auto maximises X (production.ts:424-440). The curve's peak is not the Auto point (day 600: peak f=0.96, Auto 0.983). The curve is nearly flat (M ±6% over 0.02–0.98), so the chart tells the player the mix barely matters while build capacity and m_IDEAS swing ×2 (INP-01). The glossary researchMix says "The chart shows research speed for every mix".

INP-V03 · low · The Auto-assign preview counts idle *capability* scientists as "idle, put to work" (treeActions.ts:196, idleTeams(s) with no dept at tree.ts:350), but the toggle only places safety teams (tree.ts:438-440). Related to INP-15.

Duplicates/overlaps: INP-06 overlaps INP-03 and INP-05; INP-13's RE row overlaps INP-02 and INP-03; INP-25 overlaps INP-01 and INP-03; INP-24 overlaps INP-20; INP-12's Φ(sdAI) overlaps INP-05.

Counts: CONFIRMED 21, PARTLY 4 (INP-02, 10, 14, 25), WRONG 0, UNSURE 0; 3 missed (INP-V01–V03).
