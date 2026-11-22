# R&D inputs audit: people, AI staff, compute allocation

Scope: src/engine/v2/departments/*, production/production.ts + knots.ts + readout.ts, compute/power.ts poolsOf, data/v2 teams/workTypes/agents/research, and how research consumes them (models/research.ts, safety/lineProjects.ts, models/evals.ts), plus UI Company/Work/Agents/Split/Compute.

Method: I read the code. I also ran one read-only probe outside the repo (`C:\Users\david\AppData\Local\Temp\ai27ux\audit\probe2.ts`: RefBot, ai2027, seed 2027, days 30/300/600). It changed no repo file. Its numbers appear below as "probe".

Probe results:

| day | RE teams total (ops / exp / tune) | projects in experiments | experiment FLOP to projects | Auto mix (experiments share) | build capacity at Auto vs 50/50 mix | per-project FLOP with +3 RE teams |
|---|---|---|---|---|---|---|
| 30 | 11 (0.72 / 2.0 / 8.28) | 1 | 19% | 0.990 | 9.25 vs 9.27 | ×0.774 |
| 300 | 14 (0.58 / 10.5 / 2.92) | 6 | 78% | 0.990 | 32.8 vs 35.6 | ×0.817 |
| 600 | 16 (0.06 / 12.0 / 3.94) | 7 | 75% | 0.983 | 350 vs 755 | ×0.842 |

φ was 1.00 throughout. The readout M fell a little (1.084→1.083, 3.287→3.279) when the 3 RE teams were added.

---

### INP-01 Auto research mix only counts experiment labour, and quietly starves engineering and frontier agents
- Test(s): 3, 6, design
- What: Every day, Auto re-splits the Research slice between "experiments" and "agents" to maximise one number: the experiment throughput X of a unit project. In that number, the agent side is only the routine-research (EXP) AI labour. The agents pool also pays for engineering agents (20%: build capacity for products, features, launches, run setups) and frontier agents (15%: AI labour on ideas, m_IDEAS). The optimiser ignores both, so moving the mix moves them blindly. In practice Auto sits at the clamp: 98–99% experiments, so agents get about 1% of research compute. In the probe at day 600, build capacity is 350 team-weeks/week under Auto against 755 at a 50/50 mix. The player is never told.
- Evidence: production.ts:119-134 (xAtMix: AI = AI0·k/k0, AI0 = EXP slot only), 424-440 (golden search in [0.01, 0.99]), 454-464 (applyBestMix writes split.experiments/agents daily), 475 (called every day in advanceLab). workfit.ts:245 (eng and capFrontier compute = split.agents × capShare, so they follow the mix). teams.ts:178-183 (build capacity from the SWE slot). research.ts:603 (ideation uses mIdeas, which is absent from xAtMix). Probe table above.
- Player sees: Split.tsx:114 says "The rest of the research pool runs AI research agents". Company.tsx:181 says "Auto puts research compute where it adds most speed … almost all of it goes to experiments". The glossary entry researchMix (glossary.ts:214) says "for your staff, model and compute". None of them mention build capacity or ideation.
- Fix: redesign. Either (a) take engineering agents out of the Research slice (they belong to an "engineering" budget next to the build queue), or (b) have Auto maximise the real objective (Σ project progress + build value) over every agent use. At minimum, show the build-capacity and ideation deltas on the mix chart and in the Auto tooltip.
- Severity: high · Effort: M

### INP-02 Hiring research engineers slows capability projects (routine tuning soaks up engineers and FLOP without limit)
- Test(s): 2, 6, design
- What: Capability research engineers fill needs in this order: ops → evals → experiments → tuning. Experiments get at most RE_PER_PROJECT = 2 team-equivalents per project and at most 75% of all REs. Tuning's demand is Infinity. Experiment FLOP is then split in proportion to RE team-equivalents. So every extra RE team past what the projects can take goes to tuning and pulls a pro-rata share of FLOP away from the projects, even when there is no headroom left to tune (tuneDay just multiplies the remaining headroom; nothing caps it). In the probe, +3 RE teams cut each project's FLOP to ×0.77–0.84. At day 30, tuning holds 8.3 of 11 RE teams and 81% of experiment FLOP while one project experiments.
- Evidence: data/v2/research.ts:253 (RE_PER_PROJECT), 260 (share exp 0.75, tune last). models/research.ts:381-383 (tune: Infinity), 387-404, 731-736 (flopPerRe = avail / (exp + tune)), 753-759 (tuning uses tune × flopPerRe). stacks.ts:126-129. Probe.
- Player sees: the hire chip and preview show "+x% research speed" (teamActions.ts:29-31, from the readout elasticity). Work.tsx:116 says "research engineers always overflow into routine tuning". Nothing shows that projects lose FLOP.
- Fix: make it real. Give tuning a demand proportional to the remaining headroom (and to its FLOP need). Leave unused REs idle and visible, or let them raise ℓ on the projects (drop the hard RE_PER_PROJECT and use diminishing returns instead). FLOP should go to projects by need, not by headcount.
- Severity: high · Effort: M

### INP-03 The "research speed" readout M is a lab-level proxy, yet it drives real progress and every hire, star and agent preview
- Test(s): 4, 5, 6
- What: Real capability research runs per project: ideation at (m_IDEAS·capacity)^λ × taste, experiments at X(c, ℓ) per project with the RE allocation. M is computed separately, from a "unit project" with lab-level inputs: (X/Xh) × (Tai/Th) × mods. It leaves out AI labour on ideas (m_IDEAS), the per-project RE caps and FLOP sharing (INP-02), and the evals' compute. The proxy is then used as if it were the mechanism:
  - (a) Safety nodes that are not lines progress at M × √capacity.
  - (b) Government security demand and tutorial acts read M.
  - (c) The hire, star, spare-serving and agent-package previews use M's elasticities.
  - (d) The "Best lever per dollar" panel uses M's elasticities with a hard-coded staff cost (0.8e-3 $B/person-yr) and serveCost 0.5.
  - (e) The "binding" and "label" thresholds (tasteShare > 0.6, M ≥ 25, wH > 0.5) are invented.
- Evidence:
  - production.ts:98-115 (evalV3), 140-185 (playerInputs: abs.staffCostPerYr 0.8e-3, serveCost 0.5), 196-225 (elast, perDollar, binding, label).
  - models/research.ts:600-620 (the real mechanism).
  - tree.ts:186 (researchSpeed = prodCache.M), 208, 547 (used as progress).
  - actors/gov.ts:57; models/capability.ts:325 (tutorial M ≥ 25).
  - teamActions.ts:26-31; models/actions.ts:174, 334; productOps.ts:390; agentActions.ts:79-84, 237.
  - The glossary entry rdmult (glossary.ts:7) says M has "two parts: AI labour in experiments and AI research taste" (ideas labour is missing).
- Player sees: Company › Research speed shows ×M "from AI" and its parts, plus the per-dollar levers. These do not match what the projects actually do.
- Fix: merge. Derive the readout from the actual day: Σ project progress, with what-ifs computed by re-running capResearchDay on a copy. Or drop the elasticities and show measured per-project rates. Move non-line safety nodes onto the safety mechanism.
- Severity: high · Effort: M

### INP-04 Two research-speed numbers, plus a progress-years `rate` (known, confirmed)
- Test(s): 4, 5
- What:
  - "Research speed ×rel vs leader day 0" (researchSpeedRel) and "×M from AI" both appear in the same card.
  - `rate` is gRate ÷ B_G_PER_Y × rateMult × M/M0. That is software progress converted back into v1 progress-years for the lead/leak readers.
  - limitsView then converts diffusion back again through `rate × B_G_PER_Y`.
- Evidence: production.ts:193-195 (rate), 236-241 (researchSpeedRel); limitsView.ts:52-53; Company.tsx ResearchSpeed (rel and M side by side).
- Player sees: two multipliers with different baselines in one card, and a "recipe ×(1 + add)" limit line computed through progress-years.
- Fix: keep one number: software progress (OOM/yr of the stacks), measured. Have the lead/leak readers read OOM directly and drop `rate`.
- Severity: medium · Effort: M

### INP-05 AI taste cover φ = frontier share ÷ 0.15 for capabilities, and = Trusted-to-AI for safety
- Test(s): 2, 3, design
- What: How much AI taste lifts a science team depends on the frontier-research share of the agents pool divided by its default (0.15), capped at 1. It does not depend on compute, copies or the work done. At the default share φ is already 1, so raising the share adds nothing to taste. Ten frontier copies at 15% of a tiny pool give the full lift. In the probe φ was 1.00 at every checkpoint. Safety uses a different definition: φ = Trusted-to-AI share t.
- Evidence: workfit.ts:330 (phi), data/v2/agents.ts:104 (DEFAULT_CAP_SHARES), workfit.ts:406 (safety phi = t), workfit.ts:187-195 (teamTaste uses φ as a mixing weight).
- Player sees: nothing explains φ. Agents.tsx shows the frontier lane's "AI share" as Φ(sdAI) (see INP-12).
- Fix: make it real. φ should be the share of a team's ideas that get AI review, which is AI FTE on ideas ÷ ideas to vet. In practice that is the IDEAS slot's coverage × handed share. Use one definition for both departments.
- Severity: medium · Effort: S

### INP-06 Frontier-research agents help through two separate channels (ideas labour and taste), and only one is shown
- Test(s): 3, 6
- What: capFrontier compute adds AI labour to the IDEAS slot (m_IDEAS multiplies ideation capacity). Separately, the same model's IDEAS fit gives sd_AI, which lifts taste through φ (INP-05). So one feature does two things through two formulas: more candidates and better candidates. M counts only the taste part (INP-03). Ideation labour shows only on Work › scientists.
- Evidence: workfit.ts:240-245 (IDEAS slot compute), 325-331 (sdAI, phi), research.ts:599-604 (Math.pow(inp.mIdeas·sci.cap, λ) × sci.q), production.ts:196 (parts: agents = EXP, taste).
- Player sees: the Agents lane "Frontier research · AI share = Φ(sdAI)". Work shows m_IDEAS.
- Fix: redesign as one channel. AI on ideas is labour at the IDEAS coverage, and taste is a property of who does the work: AI-done ideas carry AI taste, human-done ones human taste. Weight them by the labour shares from the same CES.
- Severity: medium · Effort: M

### INP-07 Spare serving compute silently becomes free, unmonitored routine-research agents (default on)
- Test(s): 1, 2, 6
- What: By default, serving compute that no product uses is added straight to the routine-research agents' H100e. It is not part of split.agents and not covered by capShare. It is also invisible to monitoring: monitor need, coverage and internal-fleet usage all use agentSplitShare, which leaves the spare out, so monitoring coverage is overstated. The covert-compute check, by contrast, does count it. The cost is a made-up flat LENT_RECOVERY = 0.5 (eroded market share recovers at half speed).
- Evidence: init.ts:261 (spareServing: 'research'). worldfx/revenue.ts:189-211 (spareServing, spareServingToResearch), 644 (LENT_RECOVERY). workfit.ts:245 (added to capRoutine only). agents.ts:74-77, 93-95, 126-133, 160-173 (monitor need and fleets use agentSplitShare, no spare). safety/covert.ts:191 (includes spare). production.ts:152, 157 (in k), 402-410.
- Player sees: Split › "Spare … unused" and "Lend to research +x% speed". Company shows "spare serving → agents +x%". The Agents lane compute (agentActions.ts:171) leaves it out while Work (labourOf h100e) includes it, so two different numbers.
- Fix: make it real or remove it. The cleanest is to remove the policy: unused serving shows as idle, and the player moves the split. If kept, count it in agentSplitShare so monitors and fleets see it, and replace LENT_RECOVERY with real pre-emption (products reclaim the compute when demand rises, which the code already claims to do).
- Severity: high · Effort: S

### INP-08 Spare training compute is a second silent routing, with a third accounting path
- Test(s): 3, 6
- What: Training compute that no run uses goes to synthetic data or to experiments, depending on a policy (default data). When it goes to experiments, it enters c in the readout as cIdle, outside the mix (knots.ts:67-70, production.ts:122, 153). The research engine counts it through a separate function (expPoolH100e).
- Evidence: runs.ts:125-129, research.ts:410-414, production.ts:153, 158, 181; Split.tsx SpareRow.
- Player sees: Split › Spare row with "+x% speed".
- Fix: merge into one "idle compute" readout in one place, or remove it (idle compute shows as idle).
- Severity: low · Effort: S

### INP-09 Flat AI-labour multipliers from tree nodes: P05 ×1.3, P20 ×(1 + 0.1·payoff) with a 2M-H100e threshold, P13 ×1.5 on experiment FLOP
- Test(s): 2, 6
- What:
  - P05 and P20 multiply AI FTE in every labour slot: engineering, routine, frontier and safety (useLabour). The node text says "agent research throughput".
  - P20's payoff is an absolute agents-pool size (2M H100e).
  - P13 multiplies experiment FLOP by up to 1.5, gated on measured RSCH between 6.5 and 8.5.
  - None of these has a mechanism behind it. They are numbers standing in for "better orchestration" and "AI does experiments".
- Evidence: workfit.ts:234-252; tree.ts:592-599 (payoffOf P13/P20/P24); research.ts:416; production.ts:154; paradigms.ts:18, 33; tree.ts:189, 195.
- Player sees: Research node text. The multiplier itself appears nowhere in Work or Agents.
- Fix: make them real (P05 raises effective horizon/coverage through a scaffold ΔG, the way features do; P13 is already covered by EXP coverage, so drop it), or at least show them as named rows in the Work labour tooltip.
- Severity: medium · Effort: S

### INP-10 Every built product feature also changes internal research labour, invisibly
- Test(s): 3, 6
- What: internalFx goes through all of s.player.features, the features built for products, and applies their scaffold ΔG, horizon multipliers and token cost to the internal agents on every work type. The token cost divides AI FTE (÷ ifx.tok). So building a product feature can speed up or slow down research and build capacity.
- Evidence: worldfx/serving.ts:206-213; workfit.ts:289-294 (fit with ifx, aiFte / ifx.tok), 328, 387-388.
- Player sees: nothing links a feature to research labour (Work shows only the resulting fit and FTE).
- Fix: make it visible, or make it a choice. Internal packages should pick their own scaffolds (an internal "feature" slot on each agent package), with a before → after preview.
- Severity: medium · Effort: M

### INP-11 The "routine research" model is three things at once: the default for every use, the internal deployment, and the control-layer host
- Test(s): 3, design
- What: agentVersion falls back to the routine model for eng, capFrontier and safety. Setting the routine model rewrites (or creates) an 'internal' deployment, and that deployment's controlLayer flag turns the control tax on for every internal use. The lab's "internal deployment" therefore stands in for all internal agents, though it is only one package. The doc header still describes it as "the production function's internal model (p_dep, A, R, ηmod) … qTaste in evalM".
- Evidence: agents.ts:3-14, 37-50; agentActions.ts:256-260; deployments.ts:141-153; oversight.ts:135-137, 172-177; workfit.ts:250.
- Player sees: in Agents.tsx:142-144, lanes say "as routine · Vx". The control layer is set elsewhere (on the deployment).
- Fix: redesign. Each use gets an explicit model (the default is a lab setting, "newest internal model"), and the control layer becomes a per-package option. Drop the internal deployment object, or make it a pure view.
- Severity: medium · Effort: M

### INP-12 Four different definitions of "AI share of the work"
- Test(s): 4, design
- What:
  - Engineers: 1 − wH (the agents' share of the labour margin) on the Agents lane, but SWE coverage a in the CoreLoop teams tooltip.
  - Routine research: 1 − wH.
  - Scientists: Φ(sd_AI), the share of human scientists that AI taste beats. That is not a share of work at all.
  - Safety: t × coverage.
  - The same label "AI share" sits on all four.
- Evidence: agentActions.ts:175; teams.ts:402-408 (aiShareByRole: eng = labor.aEng = coverage); production.ts:175, 228 (aEng = SWE fit.a); CoreLoop.tsx:61-67; Agents.tsx:24, 186.
- Player sees: "AI x%" for each role, with different meanings and two values for engineers.
- Fix: one definition everywhere: the share of the role's effective labour done by AI, (L − H·assist)/L, or coverage. Show taste separately.
- Severity: medium · Effort: S

### INP-13 Team-hire previews are wrong for three of five team kinds
- Test(s): 2, 6
- What:
  - Strong science team: shows "taste ±0". Gain = elast.taste × (e^{σz} − 1) × heads/sciHeads, and z = 0 for Strong. In reality a science team adds project capacity (ideation ∝ cap^λ, ×1.5 in its specialty). The comment "(0 for Strong: they matter for projects from R4)" is a leftover.
  - Engineers: shows human team-equivalents "before AI speed-up". The CES makes the real gain several times larger (probe: m_SWE 2.3–58).
  - Safety teams: the gain is "+N safety staff" (heads), which is not an effect.
  - Capability REs: uses M's elasticity, which INP-02 shows has the wrong sign for project speed once projects are full.
- Evidence: teamActions.ts:21-40; Company.tsx:220-223 (GainChip, "Strong teams leave it"); teams.ts:173-183.
- Player sees: hire chips and candidate cards. These are the main hiring UI.
- Fix: make it real. Compute each hire's effect with the before → after of the real mechanism (one tick of capResearchDay, buildCapacity and safAllocation on a copy with the team added) and show it in each team's own currency (project ETA, team-weeks per week, line cycle days).
- Severity: high · Effort: M

### INP-14 Star-hire taste is implemented twice, and the "taste ×" chip misdescribes it
- Test(s): 4, 5
- What:
  - tauH gives p.tasteHire = 1 + STAR_HIRE.dTaste·stars, capped at 1.5. It is shown in the UI and gates the star-hire action, but no research code reads it (player inputs pass tasteHire: 1).
  - The research code reads starTaste = 1 + STAR_TASTE·stars instead: a separate constant (also 0.05) with no cap.
  - The chip says "Lab-wide human taste from science-team quality and stars", but quality does not enter it.
  - Safety teamTaste is called without the star factor.
- Evidence: teams.ts:104-109, 137; data/v2/teams.ts:39; workTypes.ts:129-130; workfit.ts:199; production.ts:162, 180; research.ts:180; lineProjects.ts:155; Company.tsx:287-288; models/actions.ts:331, 334.
- Player sees: "taste ×1.05" and "Taste bench is full" at 1.5. Neither matches what research uses.
- Fix: merge into one constant and one function. Show per-team taste (quality × stars × AI) where it is used. Decide whether stars help safety.
- Severity: medium · Effort: S

### INP-15 Capabilities and safety run two parallel allocators for the same roles
- Test(s): 3, 4
- What: The same jobs (assign scientists, assign REs, share experiment FLOP, turn labour into stage rates) are written twice, with different rules and constants.

  | Job | Capabilities | Safety |
  |---|---|---|
  | RE allocation | allocate() over ops/evals/exp/tune; RE_PER_PROJECT = 2 team-eq per project; exp ≤ 75% | investigations/patches first; SAF_RE_UNIT = 50 heads × min(2.5, cap/SERIOUS_CAP); exp ≤ SAF_EXP_SHARE 50%; the rest is "upkeep" |
  | FLOP split | ∝ RE | ∝ RE × agenda computeRef, after monitors, agents and investigations |
  | Scientist assignment | planAssignment every day (teams wanted, swaps, auto, PROJECT_MAX_TEAMS 6, AUTO_RANK_W 0.8) | autoAssign. The "Auto-assign" toggle reaches only safety, although the comment says "both departments" |
  | Ideation | (m·cap)^λ | (m·cap/SERIOUS_CAP)^λ |
  | Compute unit | C_UNIT_FLOP_PER_DAY | SAF_C0_H100E × computeRef |
  | Speed mods | researchMods | lineSpeed (hand copy of siloing and ASIC, plus dead-end ×0.5) |

  Also, non-line safety nodes use a third path (M × √cap, INP-03).
- Evidence: research.ts:216-345, 359-404, 722-761; lineProjects.ts:201-209, 225-312; tree.ts:437-440, 503-547; data/v2/research.ts:248-260; agendas.ts:94, 105-125.
- Player sees: Work shows the capability RE needs and caps. Safety allocation appears on Safety › lines. They look and behave differently.
- Fix: merge into one allocator, with one need list per department (ops, investigations, project experiments, tuning/upkeep) and the same caps UI. One project stage engine, parameterised by department. One FLOP rule (by stated need).
- Severity: high · Effort: L

### INP-16 Unit soup: heads, team-equivalents, science units, "unit projects", and duplicate constants
- Test(s): 4, design
- What:
  - Engineers count in heads/150, research engineers in heads/100.
  - Science "capacity" is heads/40 × quality × 1.5 in the team's specialty. The same formula appears 5 times.
  - One unit of experiment labour is RE_UNIT = 2 team-eq (workTypes) and also RE_PER_PROJECT = 2 (research), defined separately.
  - Safety uses SAF_RE_UNIT = 50 heads and SERIOUS_CAP = 4 science units.
  - Investigations use FTE heads.
  - The readout uses h = reRes / (11 × 0.88) "leader day-0".
  - None of this is explained to the player. "Team-equivalent" has no glossary entry, and teamMonth (glossary.ts:70) assumes it.
- Evidence: workTypes.ts:31-35, 134-142; data/v2/research.ts:253; tree.ts:171-172; research.ts:161-164; workfit.ts:365; agendas.ts:59; lineProjects.ts:154; agendas.ts:94, 109.
- Player sees: "team-eq", "×c", "×ℓ", "team-weeks/week" and "capacity" in different panels.
- Fix: redesign around one unit, a person-month of work (or a standard team-month), the same for both departments. Merge RE_UNIT and RE_PER_PROJECT. Use a single teamCapacity() helper.
- Severity: medium · Effort: M

### INP-17 Run operations and evals are charged to two staff pools with copied constants
- Test(s): 4, 2
- What:
  - Each running training run costs engineers' upkeep: UPKEEP.runBase 1, runMid 0.5, runSmall 0.2, stream 0.5.
  - It also costs research engineers' RE_OPS: base 1, mid 0.5, small 0.2, stream 0.5. The constants are identical, with the comment "mirrors the engineers' run upkeep".
  - Eval suites cost an engineer harness build item, plus RE suite work, plus inference compute taken from the experiments pool. The mix optimiser and the M readout do not see that compute.
- Evidence: build.ts:72 (UPKEEP), 99 (runOpsTW), 43 (isStackWork 'eval'); data/v2/research.ts:256 (RE_OPS); research.ts:348-357; evals.ts:113-158; research.ts:728-730.
- Player sees: Work › Engineers "Runs" and Work › Research engineers "Run operations" are both filled by the same run.
- Fix: merge. Decide which role operates runs (engineers) and drop RE_OPS, or split one run-ops need between the two roles by work type. Show eval compute as its own line.
- Severity: medium · Effort: S

### INP-18 The safety pool can be oversubscribed: monitors, safety agents and investigations reserve shares without normalising
- Test(s): 1
- What: Inside the safety slice, four claims take their shares independently:
  - the monitoring budget's poolShare (policy up to 100%),
  - safety agents (up to 60%),
  - each investigation's computeShare,
  - lines (the rest).

  linePool clamps at 0, but monitors and agents keep their full H100e. With a 50% monitoring budget that coverage needs and agents at 60%, more than 100% of the pool runs. I inferred this from the code and did not run it.
- Evidence: agents.ts:126-138 (monitorBudget, monitorH100e), workfit.ts:244 (safety agents = pool × agents.safety.compute), lineProjects.ts:225-229 (max(0, 1 − reserved − inv)), agentActions.ts:51 (cap 0.6), data/v2/agents.ts:118-119.
- Player sees: separate sliders (monitoring budget, safety agents share, investigations) with no pool total.
- Fix: make it real. Run one allocation over the safety pool, in priority order with a visible total (as for REs), and scale claims down when they exceed it.
- Severity: medium · Effort: S

### INP-19 Compute pools are nested four levels deep, and the nesting is spread over three panels
- Test(s): 3, design
- What:
  - The top level is Training / Research / Serving / Safety (Compute › Split).
  - Training holds a data sub-slider and the spare-training policy.
  - Research holds the Auto/manual mix; the agents part is then split eng / routine / frontier on Company › Agents at work.
  - Serving has the spare-serving policy, which feeds routine agents.
  - Safety holds monitors, safety agents, investigations and lines (Agents and Safety panels).
  - Engineering agents, which serve products and builds, are paid from "Research". The Compute.tsx header still says the split lives in Company.
- Evidence: split.ts:1-8, 240-247, 291-312; data/v2/agents.ts:70-77, 99-104; Split.tsx:1-3, 114; Compute.tsx:4; Agents.tsx:174.
- Player sees: one slider per level on different pages. No single view of where each H100e goes.
- Fix: redesign as one flat allocation of compute to uses (training runs, data, experiments, each agent package, products, monitors, safety lines), with presets, shown as one stacked bar.
- Severity: medium · Effort: L

### INP-20 The v2 knot production function is still alive (known, confirmed), and knots.ts also holds live maths
- Test(s): 5
- What:
  - buildKnots runs on every new game (sampleHidden), although only scripts/v2/identity.ts uses the knots.
  - The v2 branches of evalM, evalProduction and bestResearchMix survive behind `if (inp.v3)`.
  - LabInputs keeps dead fields: qDep, stock, eff, tasteHire, d, mixUnit.load. ProductionReadout keeps Ddata: 1, elast.train/data = 0 and parts.base = 1.
  - MANUAL_MIX_RANGE is justified by the knot function ("needs both experiments and agents").
  - Live v3 code imports its core maths (Xces, Lrel, Phi, tasteSigma, bisect) from knots.ts, so the file cannot simply be deleted.
  - prodCache.M is read by government and the tutorial (INP-03).
- Evidence: world/hidden.ts:46; knots.ts:62-84, 192-290; production.ts:68-88, 180, 230, 243-349, 441-443; split.ts:283-286; scripts/v2/identity.ts:14, 52-54.
- Player sees: nothing directly. The cost is a code tax plus readouts shaped like v2 (INP-03, INP-04).
- Fix: remove. Move Xces, Lrel, Phi, tasteSigma and bisect to a small ces.ts. Delete knots and refBestX, the v2 branches and the dead LabInputs fields. Retire identity.ts, or keep it on a frozen copy.
- Severity: medium · Effort: M

### INP-21 The manual mix range and the Auto range differ, and the comment says they are the same
- Test(s): 4
- What: Manual allows [0.02, 0.98]. Auto searches [0.01, 0.99] and in practice sits at 0.99 (probe). The mix chart plots 0.02–0.98, so the Auto point lies off the chart. The comment says "the same range the Auto best-mix search covers".
- Evidence: split.ts:283-286; production.ts:429-430; knots.ts:72-73; readout.ts:34-35.
- Player sees: switching Auto → Manual moves the mix from 99% to 98%.
- Fix: one constant for both.
- Severity: low · Effort: S

### INP-22 Flat research-speed modifiers in researchMods, copied in lineSpeed and in rival code
- Test(s): 2, 4
- What: siloing −5% per level, ASIC migration ×0.85, pause ×0.1, verified treaty ×0.65, clearances sideline 10% of humans (×0.9 on every slot's humans), and an 'agentsOffUntil' flag that zeroes all agent compute. These are flat numbers with no mechanism. Siloing should raise coordination cost (for example, less sharing of FLOP between projects). The pause should stop experiment FLOP. The treaty factor is repeated in rivalResearch.
- Evidence: workfit.ts:254-266, 239, 280; lineProjects.ts:201-209; production.ts:389.
- Player sees: Company › Research speed limits (pause) and the "Siloing, migrations" row.
- Fix: make each real where cheap (pause = no experiment FLOP; sideline = heads actually removed for 60 days), and keep one helper for both departments.
- Severity: low · Effort: S

### INP-23 Serial speed, "copies × speed" and the serial-speed limit are readouts that change nothing
- Test(s): 5, 6
- What: speedOfCopy = min(50, 60 tok/s × 3600 / 40k) ≈ 5.4, a constant. AI FTE does not depend on it. It only divides FTE into "copies". The Limits line "serial speed 5× of 50×" can never bind or move. Two caps exist: SPEED_CAP in workTypes and PROD_SPEED_CAP in calibration. Copies feed safety pressure (S8), so a display-only constant drives a safety signal.
- Evidence: workfit.ts:158-161; workTypes.ts:122-124; calibration.ts:85; limitsView.ts:40-44; Work.tsx:136; traits.ts:208, 1188; pressureView.ts:98.
- Player sees: "Copies × speed" on Work, and a permanent non-binding limit line.
- Fix: remove the limit line and one of the two caps, or make serial speed matter (wall-clock-bound stages take longer when copies are slow).
- Severity: low · Effort: S

### INP-24 Stale headers and helpers describe removed mechanisms
- Test(s): 5
- What:
  - The build.ts header says capacity is "1/(1 − A_eng), capped". The code is an uncapped CES.
  - The teams.ts header says "h = RE_cap/(0.55·H_ref) … engineers → build capacity (readout until R5)".
  - playerH and REF_ROLE_SHARE exist only for the RE preview and the save migration.
  - The agents.ts header talks about p_dep, A, R, ηmod and qTaste in evalM.
  - The production.ts header still calls rate a BRIDGE.
  - The Compute.tsx header says the split lives in Company.
- Evidence: build.ts:3-4; teams.ts:10-12, 96-102; data/v2/teams.ts:9-10; agents.ts:4-6, 13-14; Compute.tsx:4.
- Player sees: no.
- Fix: rewrite the headers when INP-03 and INP-20 land, and delete playerH.
- Severity: low · Effort: S

### INP-25 The agent-package preview shows only research speed and monitor catch, plus a fixed made-up security cost
- Test(s): 2, 6
- What: Moving compute between engineering, routine and frontier agents changes build capacity, ideation labour and taste. The preview reports only ΔM (the proxy, INP-03) and Δcatch. Every change also adds a constant "security −0.05 (exposure)" line, whatever the change.
- Evidence: agentActions.ts:230-247 (line 246 is the fixed −0.05); agentsView carries `build` (188) but the preview does not report it.
- Player sees: "+x% research speed" when shifting compute from engineering, with no build-capacity cost.
- Fix: show the before → after of build capacity, m_IDEAS and taste. Drop the constant security line, or tie it to the change in internal compute or copies.
- Severity: medium · Effort: S

---

Counts: high 6 (INP-01, 02, 03, 07, 13, 15); medium 14 (INP-04, 05, 06, 09, 10, 11, 12, 14, 16, 17, 18, 19, 20, 25); low 5 (INP-08, 21, 22, 23, 24).

## Simplest coherent model

One allocation model with three kinds of input, the same for capabilities and safety.

**1. People.** Teams of one size per role, each with quality. Work is counted in one unit, the person-month. Each department has a need list in the player's order: run ops, investigations, project experiments by priority, tuning/upkeep, builds. Each need has a real demand that falls to zero when there is nothing to do; tuning's demand is proportional to the remaining headroom. Unused people show as idle. Scientists are placed by one planner (priority list plus teams wanted) for both departments.

**2. AI staff.** Explicit packages, one per use: engineering, experiments, ideas, safety experiments, safety ideas. Each has a chosen model, scaffolds, a monitor and an H100e amount. The AI labour of a package enters its role's coding CES at that work type's coverage. That gives one multiplier per role. Taste is a property of whoever does the ideas work: AI-done ideas use AI taste, weighted by the AI labour share. There is no φ and no flat ×1.3. Tree nodes act through fit, horizon or coverage.

**3. Compute.** One flat allocation of online H100e to uses, shown as one bar with presets: training runs, data, experiments, each agent package, monitors, products, safety lines. Nothing spare is rerouted silently. Idle compute is shown as idle. Experiment FLOP goes to projects by stated need.

There is no "Auto mix". If there is a helper, it is a suggestion that maximises the whole objective, all project progress plus build capacity, and shows what each option costs. Research speed is reported as what actually happened: per-project rates and the stacks' OOM/yr. Previews re-run one day of the real mechanism on a copy.
