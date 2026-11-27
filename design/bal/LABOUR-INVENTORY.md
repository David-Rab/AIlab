# Labour inventory (2026-11-27)

Read-only sweep for the labour round. Sources searched: design/**.md on master, AI27-vision/design, the lead's memory files, `src/` comments, and the designer's own messages in the session transcripts (extracted by script, user turns only).

Conventions
- **Known** = already covered by the three known items (hiring-market notes, optimal task split = deferred item 8, player-staff harness exception).
- Transcript = file name in `C:\Users\david\.claude\projects\C--Users-david-Documents-projects-AI27\`, with the message date/time (UTC). Short ids: 211b3230-b277-43d9-baed-394abf8e5aec, 0093e237-5cfc-42c7-b106-64531c22511a, 3bf5909c-34b6-4435-b888-b8ef9e2651c4, f685e39f-844d-4c39-a5fb-6fc72a426d75, 17ea4801-fded-477b-888c-f8c129d4e7b0, cfabf8d8-ab90-4ac1-92e5-2bf1cf877899, 95361da8-1edc-407d-9905-af8fde289bbe, 706882b4-d62c-4a29-9048-46937a651a8e (all `.jsonl`).
- Status: decided / deferred / open / parked / implemented.

---

## A. Research engineers and experiment work (the item the designer recalls)

**A1. Research engineers are pooled across projects, not capped per project (PF-1). STATUS: decided, NEVER BUILT. Probably the thing recalled.**
- Summary: today each project in experiments takes at most `RE_MAX_PER_PROJECT` = 2 human research-engineer teams; the need is projects x 2 and is not divided by the AI multiplier m. So better AI agents cannot let fewer teams run more experiments, and a project that gets no teams does not progress at all. Fix agreed 2026-11-24: one pool of effective labour (m x human teams, after run operations and evals) shared by all projects in experiments, split by the player's priority order; the need shown as a total (projects x 2 / m); experiment compute follows the same rule; the safety side (`SAF_RE_ASK`, per-programme ask) gets the same change; readouts on the Lab screen (PF-3).
- Quote (designer): "this seems wrong, good enough agents should allow fewer teams to manage more experiments, no? why are teams allocated to specific projects, and not just all research projects have a total need for research engineers?" Then: "splitting by priority and include safety."
- Context quote (designer, same turn before): "research engineers do research experiments. i see it say for example 15 of 26. does having more agents (of high quality) help with this?"
- Source: 0093e237-...jsonl, 2026-11-24 10:54, 10:57 and 11:03 (assistant proposal at 10:58, task list PF-1 to PF-3 announced at 11:05). The task file `design/RD-AUDIT/PLAYTEST-FIXES.md` on branch `rd` was "still an uncommitted file in the `rd` worktree" (11:10 reply) and was never moved to master; the `rd` worktree folder `C:\Users\david\Documents\projects\AI27-rd` is now empty and no commit mentions PF-1 (`git log --all --grep=PF-1` is empty). Still true on master: `src/data/v2/research.ts:186` (`RE_MAX_PER_PROJECT = 2`), `src/engine/v2/models/research.ts:647-651` (`reDemand`: exp = projects x RE_MAX_PER_PROJECT, not divided by m) and `:658-672` (`reAllocation` hands out at most 2 per project). Safety: `src/data/v2/agendas.ts:112` (`SAF_RE_ASK = 0.25`, "as capability's RE_MAX_PER_PROJECT, not a unit").
- Also raised then (assistant, 2026-11-24 10:55, not answered by the designer): "Under this model, AI can never run a project on its own; humans set how many projects run in parallel, even near-superhuman AI. ... Do you want me to note this as an open R&D item". The pooling fix (A1) is the answer to it; no separate decision was recorded.
- Known: no. New to the labour round.

**A2. The per-project cap makes extra human staff inert in calibration. STATUS: open (diagnosed, not acted on).**
- Summary: forced runs raise human staff along the AIFM L_HUMAN path, but the game's experiment labour sees staff only as "the number of projects"; extra heads do nothing. The staff x2.1 (game) vs x7.2 (AIFM) by 2028.5 shows up as lower experiment-compute elasticity.
- Quote: none (diagnostic). SHAPE-DIAG: "the game's engineers per project are capped (RE_MAX_PER_PROJECT = 2), so extra heads do nothing (counterfactual staff growth frozen at 2026.5: y2 central 2.69 against 2.77, noise)". EXPCOMPUTE: "humans enter as the number of projects (staff x2.1 by 2028.5)".
- Source: design/bal/SHAPE-DIAG.md:34; design/bal/EXPCOMPUTE.md:35 and :60; design/bal/FIXC-PRESC.md:37 and :59 item 4 ("The staff lag ... is a separate setting; raising it would speed the game further, so item 2 comes first").
- Known: no (consequence of A1; the harness exception forces headcount but cannot make it matter while the cap holds).

**A3. Original design of research-engineer work (2026-11-18). STATUS: partly implemented, partly superseded.**
- Summary: research engineers execute the experiments of scientists' projects, run trainings and evals; teams and RE allocated in broad strokes by priority, "important not to have player micromanage"; routine tuning with headroom refilled by adopted ideas.
- Quote (designer): "research engieers and engineering teams are also assigned to task in broad strokes - how much is allocated to various needs, with priority that controls where the extras flow to when unused." And: "i think some routine tuning from research engineers whose headroom refills from adopting new big ideas is good."
- Quote (designer, earlier same day): "the experiments are then excuted by the research engineers i think? they require compute and teams (and agents that augment/replace)."
- Source: f685e39f-...jsonl, 2026-11-18 18:17 and 18:39; design/MODEL-V3.md:278-279, :302, :387. Implemented: needs with priority order (`DEFAULT_RE_ALLOC`, `src/data/v2/research.ts:191-193`). Superseded: routine tuning and headroom were deleted in the R&D audit (decision 12 in design/RD-AUDIT/SESSION-HEAD.md:1307-1308; design/RD-AUDIT/BUILD-NOTES.md:1293-1297). Spare RE are now shown as idle (`research.last.idle`). The unaddressed part is that the cap in A1 reintroduced per-project micromanagement-like limits.
- Known: no.

**A4. What are research engineers for? (2026-11-17). STATUS: implemented.**
- Quote (designer): "what are research engineers needed for? what do they actually produce? did you answer this from the code?"
- Source: cfabf8d8-...jsonl, 2026-11-17 12:27. Outcome: run operations moved to research engineers (RD-B09, design/RD-AUDIT/BUILD-NOTES.md:620-631, `RE_OPS` at `src/data/v2/research.ts:187-190`); engineers keep setups/upkeep/builds.
- Known: no.

**A5. Hiring research engineers could slow capability projects; auto research mix halved build capacity. STATUS: implemented (fixed in RD-B08/E03).**
- Source: design/RD-AUDIT/SESSION-HEAD.md:1190, :1285-1287; design/RD-AUDIT/BUILD-NOTES.md:566-580 (flop by need, "more research engineers never take FLOP from a project").
- Known: no.

**A6. `RE_LABOUR_UNIT` and `RE_MAX_PER_PROJECT` are linked literals (both 2); `RE_UNIT`/`RE_PER_PROJECT` duplicated. STATUS: parked.**
- Source: design/bal/B5-QUESTIONS.md:82 (C11); design/RD-AUDIT/inputs.verified.md:35 (INP-16: the heads x quality x specialty formula appears 5 times, no "team-equivalent" glossary entry). Part of the parked "one home per duplicated number" refactors (memory ai27-balance-deferred item 9).
- Known: no. Becomes live if A1 is built.

---

## B. Hiring market, pools and wages

**B1. Hiring market design notes. STATUS: deferred then decided in the labour round. Known.**
- Summary: one global pool per kind (engineer, research engineer, researcher), maybe per ability level; most outside AI firms at the start; inflow from graduates (and other fields for researchers); outflow by hiring; wages rise with demand and depleted supply; everyone paid the marginal wage.
- Quote (designer): "pool of potential relevant global labor, at the start most of it is outside the AI companies even (in other companies or academia or goverment or whatever), with a certain inflow rate ... and outflow based on hiring. ... wage will be set by some simple standard mechanism, so that it goes up as demand increases and supply depleats"
- Source: 3bf5909c-...jsonl, 2026-11-26 10:05; design/BAL-TASKS.md:101-105; design/bal/HANDOFF-CALIBRATION.md:37; design/bal/STAGE1-DESIGN.md:76; memory ai27-balance-deferred item 1.

**B2. Market saturation as the reason hiring cannot be forced. STATUS: decided (principle). Known.**
- Quote (designer): "should the game's hiring mechanics change? so it can be faster, but also saturate the market (growing salary costs - everyone gets the marginal, not just the new ones), and the market gets worse (all the good people are already hired). harness only would mean we calibrate it, but the player never has an option for such a thing. harness only things are dangerous."
- Source: 3bf5909c-...jsonl, 2026-11-26 09:56; memory no-harness-only-mechanics.md.

**B3. Player-staff harness exception. STATUS: decided, in force. Known.**
- Source: design/BAL-TASKS.md:105, :110 (R2.1); design/bal/HANDOFF-CALIBRATION.md:22; code `src/engine/v2/core/forcing.ts:20-29` (`playerStaffExact`), `src/engine/v2/departments/teams.ts:222`, `scripts/v2/forcedInputs.ts:48`. To be retired when forced runs hire through the market (B4 answer 7).

**B4. Hiring-market answers, 2026-11-27. STATUS: decided (not yet built). Partly new.**
- Quote (designer, all seven): "1. i think in principle the player and rival labs and china draw from the pools, but for now we will have a very very simplifed placeholder for the rivals and china. the full things will be done in the rival session. 2. gradual 3. do we need quality tiers? ... 4. yes, but only through hiring less with no extra rule 5. yes, also offer premium pay 6. starting state should be sourced 7. yes"
- Meaning: (1) player, rivals, China draw from pools; rivals/China get a very simple placeholder, full version in the rival session; (2) wages reprice gradually, not instantly; (3) tier question (see B5); (4) automation feeds the market only through labs hiring less; (5) the player can offer premium pay to hire faster/poach; (6) starting staff and pool sizes sourced from 2025 headcounts; (7) forced runs hire through the market (retires B3).
- Source: 211b3230-...jsonl, 2026-11-27 08:57 (lead's questions at 08:27); design/BAL-TASKS.md:192 on branch `bal` (not on master yet).
- Known: no for answers 1-2 and 4-7 beyond the base notes; the notes themselves are known.

**B5. Quality tiers removed; "star" becomes a fourth kind. STATUS: decided (recorded 2026-11-27 on `bal`). New.**
- Summary: Solid/Strong/Elite tiers (0.8x/1x/1.25x output at 0.8x/1x/1.6x cost) removed for all kinds including scientists; the star is one person who only adds research taste, scarce, expensive, individually visible. Today's star hire (+0.05 on tau_h) is replaced. Researcher taste is the one quality difference that matters.
- Quote (designer): "do we need quality tiers? do they add much to game play even, or just add a bit more micromanagment and hassle to the player?" (the decision itself is the lead's recommendation, then recorded as decided)
- Source: 211b3230-...jsonl, 2026-11-27 08:57 and the lead's answer 08:58; design/BAL-TASKS.md:196-197 on `bal` (commit 08f23602). Code today: `src/data/v2/teams.ts:14-20` (QUALITY), `starTasteOf` in `departments/workfit.ts`.
- Known: no.

**B6. Starting staff too small for upkeep on the central timeline. STATUS: open (fixed by B4 answer 6).**
- Summary: day-1 build capacity 4.36 vs standing upkeep 5.73, so builds (eval-suite work) wait for engineers; starting staff sized for the old world (AI did ~28% of engineering at the start vs ~6% on the forecast's 2025 numbers).
- Source: 211b3230-...jsonl, 2026-11-27 08:19 (lead's merge note) and 08:27 (item 6). No designer quote.
- Known: no (a consequence found on merge).

**B7. Game staff lag the AIFM headcount path (x2.1 vs x7.2 by 2028.5). STATUS: open, parked behind other fixes.**
- Source: design/bal/FIXC-PRESC.md:37 and :59 (item 4); EXPCOMPUTE.md:60. RefBot hires toward `hRef` (`ces.ts:74`) and lags it; the hiring market (B4) is the intended fix; see A2 for why it matters little today.
- Known: no.

**B8. Current hiring mechanics (facts, for context). STATUS: implemented; stand-ins flagged [D].**
- Whole teams: engineers 150 (one shared pool), research engineers 100 (capabilities or safety), scientists 40 (tree-column specialty); weekly hires per lane `HIRING_BASE` (cap 15, saf 8) x talent pull x morale factor; 12%/yr attrition; fixed pay per head ($0.7M / 0.8M / 1.0M capabilities; 0.7 / 0.65 / 0.8 safety); one candidate offer a week, kept 4 weeks. No pool, no wage movement, no competition.
- Source: `src/engine/v2/departments/teams.ts:1-14`; `src/data/v2/teams.ts:14-35, 46`; lead's summary 211b3230-...jsonl 2026-11-27 08:27.
- Known: partly (hiring market notes).

**B9. `ECON.hireSlope` 1.2 "once-fitted stand-in". STATUS: parked; not lab labour.**
- It is the economy's youth/programmer hiring index (adoption side), not lab staffing. Listed so it is not mistaken for B1. Source: `src/data/v2/sectors.ts:128-133`; design/bal/B5-QUESTIONS.md:112 (F4); design/RD-AUDIT/DECISIONS.md:98.

---

## C. Staff kinds, teams, quality

**C1. Three roles and "agents automate engineers first, then research engineers, then scientists". STATUS: decided (2026-11-16), implemented.**
- Source: memory ai27-tycoon-direction.md ("Three roles (user unsure if too complex)"); 17ea4801-...jsonl, 2026-11-16 15:59: "i'm not happy with our departments, staff, teams, teach points. currently i want contradictory things, which means i am confused at what i am looking for."
- Known: no.

**C2. Team cards of ~50 people with visible composition (manager, team leads, devs, architects, research engineers...). STATUS: parked ("only if not overcomplicate").**
- Quote (designer): "i think hire team cards of ~50 people ... maybe 'showing' what a team looks like: 1 manager, N team leads, M software devs, K architects, L research engineers, researchers ... maybe not - only if not overcomplicate the game."
- Source: 17ea4801-...jsonl, 2026-11-16 15:39. Today teams are 150 / 100 / 40 (`src/data/v2/teams.ts`), no composition shown.
- Known: no.

**C3. No micromanagement of team assignment. STATUS: decided, implemented (auto-assign, priority order).**
- Quote (designer): "allocating teams to projects and tasks should be totally automated - the player just decides how many teams work on a task and a priority ranking. the game then auto-assigns teams most efficiently ... can't have it be too suboptimal"
- Source: f685e39f-...jsonl, 2026-11-18 18:39; design/JANK-AUDIT.md:385 (R2 auto-assign); memory ai27-model-v3-direction.md. A1 is where this principle is currently violated for research engineers.
- Known: no.

**C4. Scientists/taste: taste as a human/AI mixture. STATUS: implemented (fix B).**
- Quote (designer): "in my head taste is more like a distribution that affects how good ideas are, and then if we have P% of the labor from human with some taste level, and (1-P)% of the labor from AI with a different taste level, we can compute the shared distribution of taste that affects how good ideas are."
- Source: 3bf5909c-...jsonl, 2026-11-26 05:38 (agreed 05:42); design/bal/STAGE1-DESIGN.md:53-60. Ideation gets no compute requirement ("i don't want to add compute need for ideation", 05:04).
- Known: no.

**C5. Taste effects for unlock and safety projects. STATUS: deferred.**
- Quote (designer): "in future we will probably want to change the unlock and safety projects, so taste will affect them, but not now."
- Source: 3bf5909c-...jsonl, 2026-11-26 06:37; design/BAL-TASKS.md:99-100; design/bal/SAFETY-UNIFY.md; memory ai27-balance-deferred item 2.
- Known: no.

**C6. Engineers with nothing to build (idle cost). STATUS: implemented (build queue).** Source: design/JANK-AUDIT.md:59 (P1) and :386; `src/engine/v2/departments/build.ts`. Starting shortage is B6.

**C7. Safety staff reference split 90 RE + 50 scientists; moving RE safety to capabilities costs morale; talent pull/morale drive hire rate. STATUS: implemented, all [D]/[Design] stand-ins.** Source: `src/data/v2/teams.ts:12, 32, 43`. Folded into the hiring market rebuild; no separate decision.

---

## D. AI vs human task split, coverage, AI staff allocation

**D1. Optimal human/AI task split (deferred item 8). STATUS: deferred, then APPROVED in the labour round. Known.**
- Summary: today AI takes every AI-capable task (`Lrel`, rho_c = -2, `src/engine/v2/production/ces.ts:53-58`), so with few AI copies higher coverage lowers labour (matched speed-up below 1 in central/slow). Fix: AI takes the output-maximising share up to A (L = h + ai while AI is scarce), humans on uncovered tasks once AI could fill them; one rule for all slots; replaces the build stopgap ("never below the humans alone", `src/engine/v2/departments/build.ts:5`).
- Quote (designer): "at any point in the game we have for a given task some amount of human labor and some amount of AI labor of a certain ability. the game doesn't autamatically just do the best it can with them?" Deferred: "lets add it to the deferred things, and prepare for wrap up". Approved: "using labor - i accept the propostion."
- Source: 3bf5909c-...jsonl, 2026-11-27 04:50 and 04:52; 211b3230-...jsonl, 2026-11-27 08:57; design/BAL-TASKS.md:164, :170, :191; memory ai27-balance-deferred item 8.

**D2. UI must show what AI can cover, what it does now, and what more compute / more human labour would add. STATUS: decided (requirement), not built.**
- Quote (designer): "we will need to make sure to be clear about showing the player what the AI *can* potentially cover, and what it is doing now, and what more compute and more human labor would do."
- Source: 211b3230-...jsonl, 2026-11-27 08:57. Related existing UI: the ranked "Best moves" list (design/RD-AUDIT/UI-IA.md Q6; design/RD-AUDIT/UI-BUILD.md:20; `src/ui/v2/panels/Lab.tsx`, `Portfolio.tsx`) and the AI-share line per role; the marginal "one more team / more compute" numbers per work kind are new.
- Known: no (extends item 8).

**D3. Seeing and controlling agents per department/team (which model, what it costs, used or idle). STATUS: implemented in the R&D redesign (LAB > AI staff & needs).**
- Quotes (designer): "how do i see what my safety and security staff and compute and agents are doing - if thye are being used or idle?" (95361da8-..., 2026-11-15 08:22); "we need to think how to control and visualize the usage of agents inside the company - in all kinds of teams, and which each department uses (so we can have a cheap model for coding, a strong dangerous model for capabilities research ...). so that he should see what he gets and pays." (17ea4801-..., 2026-11-16 17:41).
- Source: design/RD-AUDIT/DECISIONS.md:180-185. Known: no.

**D4. Coverage before SC from the AIFM automation schedule (R3.3). STATUS: implemented.** Source: design/bal/FIXC-TRANSLATION.md:117-138; design/bal/HANDOFF-CALIBRATION.md:58. Residual: the game's experiment coverage is a little lower than the AIFM's in fast (0.53 vs 0.61 at +1 OOM) and SWE coverage a little higher (0.75 vs 0.6) (.scratch/LABOUR-MULT-CHECK.md). Status of residual: open, small, no decision. Known: partly (coverage law done; item 8 is the open one).

**D5. AI labour multiplier "takes off too fast" (M3). STATUS: resolved; it was P24, not labour.** The labour multiplier is at or below the AIFM's at equal effective compute (0.4-1.0x); the 2027-28 jump is the P24 line entering with a fresh pool (about 96% in the central check game). Option A approved (P24 draws on the pretraining stock). Source: .scratch/LABOUR-MULT-CHECK.md; .scratch/RATE-DECOMP.md; design/BAL-TASKS.md:187-188, :195 (on `bal`). Known: no.

**D6. Hard-coded milestone coverage in `researchView.milestoneViews` (0.1 / 0.5 / 0.5). STATUS: parked (comment/code mismatch list).** Source: design/bal/B5-QUESTIONS.md:68 (B9). Known: no.

**D7. Safety work handed to AI (Trusted to AI) uses the same labour CES; sandbagging/false-result risk; `humanReview` by safety research engineers. STATUS: implemented.** Source: design/RD-AUDIT/SESSION-HEAD.md:463, :574; design/ux/GLOSSARY.md:246, :557. Gets the same task-split rule via item 8 ("one rule for all slots"). Known: no.

---

## E. Rivals, China and bots on labour

**E1. Rivals' and China's labour draw from the same pools; full version belongs to the rival session. STATUS: deferred.**
- Quote (designer, 2026-11-27): "i think in principle the player and rival labs and china draw from the pools, but for now we will have a very very simplifed placeholder for the rivals and china. the full things will be done in the rival session." Also (706882b4-..., 2026-11-27 08:39): "another session is working on the AI labor task split fixes, i dont see why they are relveant to us here."
- Source: 211b3230-...jsonl 08:57; 706882b4-...jsonl 08:39; design/vision/MEDIUM.md:57 (NPC lab attribute "Talent pull and poaching"; `src/engine/v2/models/actions.ts:60-71` poach 3% / min 5). Known: no (answer 1 of B4).

**E2. Bot staffing policy numbers are unsourced (team counts, ideaTeams, hiringLead). STATUS: deferred to Stage 2 (realistic-lab policy).** Source: design/vision/HANDOFF-BOTS.md:29; design/bal/BOTS-RESULTS.md:75, :113; memory ai27-balance-deferred item 5. Known: no.

---

## Notes for the lead

- The only item matching "research engineers do experiment work" is A1 (plus its roots in A3). It is a decided, unbuilt change; its task file was lost with the uncommitted `rd` worktree file, but the transcript at 0093e237 2026-11-24 10:55-11:05 has the full proposal. It is not in the BAL-TASKS, handoff or memory deferred lists.
- A1 interacts with D1 (the optimal task split changes m, which A1 divides the RE need by), with A2/B7 (extra headcount is inert until the cap goes) and with B4 (a hiring market is pointless for research engineers while headcount beyond 2 per project does nothing).
- No designer words exist on: wages beyond the marginal-wage note, morale/attrition changes, scientist specialty, or a research-engineer-vs-engineer boundary beyond A3/A4.
