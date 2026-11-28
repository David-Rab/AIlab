# Balance system: task file

Branch `bal`, worktree `C:\Users\david\Documents\projects\AI27-bal`, started 2026-11-25 from master cd352aa.
Background: `../AI27-vision/design/vision/BALANCE.md` and `HANDOFF-BOTS.md` (uncommitted, branch `vision`).

## Scope (designer, 2026-11-25)
- No game-mechanics changes. Registries are metadata; any refactor must reproduce same-seed results exactly.
- Bots and balance tooling in scope. Refits only with designer approval. Rivals: registry tags only; behaviour changes are proposals.

## Working style (experiment)
- Lead: Opus 5.5 (main session): design, briefs, review. Workers: Sonnet 5.5, effort high or medium, never low.
- Small contexts: run and analysis are separate agents; results go to files; reports of about 15 lines.
- Outputs land in `design/bal/` unless a task says otherwise.

## Tasks

| ID | Task | Model / effort | Status | Output |
|---|---|---|---|---|
| B0 | Scout: how constants and targets are organised today | Sonnet high | done | design/bal/B0-SCOUT.md |
| B1 | Registry schema design | Opus (lead) | approved 2026-11-25 | design/bal/REGISTRY-DESIGN.md |
| B2 | Schema + lint + worked examples | Sonnet medium | done, committed 82ff69b | balance/, scripts/v2/registry-lint.ts |
| B3 wave 1 | Inventories: capability, safety-data, market, finance, actors-engine | Sonnet high | done, committed 26474a8 | balance/params/<chunk>.ts, design/bal/inv/<chunk>-notes.md |
| B3 wave 2 | Inventories: models (mod: engine/v2/models, compute), safety-engine (sfe: engine/v2/safety, security), worldfx (wfx), actors-data (acd: data/actors.ts, data/world.ts, data/v2/{rivalModel,blocs,agents}), core (core: engine/v2/{core,departments,endings,events,bots}) | Sonnet high | done, committed 50a69e7 | same |
| B4 | Target inventory | Sonnet high | done, committed 26474a8 | balance/targets.ts |
| B5a | Consolidate ~100 inventory questions into rulings | Sonnet high | done | design/bal/B5-QUESTIONS.md |
| B5b | Lead rulings (balance/CLASSIFY.md), applied by 3 agents (B5c-e) | lead + Sonnet | done | balance/params/*.ts |
| B6 | Target discussion with designer | lead + designer | after B5b | |

Shared brief for all B3 agents: design/bal/INVENTORY-BRIEF.md.

Designer note (2026-11-25): the current calibration targets are probably neither enough nor the right ones. What we calibrate against gets its own discussion (B6). The target inventory only records what exists.

## Experiment log
One row per delegated task: first-pass result (accepted / rework / redo), wall time, notes.

| ID | Result | Time | Notes |
|---|---|---|---|
| C1 runner | accepted | 22 min, 96k | bots.ts output byte-identical after the loop move; dispatch via IPC; cache replay works. Perf under load: 70 s/game (needs a quiet measurement). |
| C2 bot settings | accepted | 27 min, 172k | 65 fields; fingerprints identical 24/24 (cmp); tsc clean. |
| C4 dashboard | accepted pending real-data check | 13 min, 165k | Followed the dataviz skill, validator run, screenshots read and 6 layout fixes made. Built on a fake run because the real one was not ready. |
| B5a consolidate | accepted | 7 min, 129k | 100 questions into 53 items; checked research/07 field by field unprompted; excellent. Left 3 temp files (rm denied). |
| B5c actors-data rulings | accepted | 9 min, 188k | unclear 136 to 4; field-by-field against research/07 and 10. |
| B5d cap/market/finance rulings | accepted | 8 min, 168k | unclear 27 to 8. |
| B5e six files rulings | accepted | 10 min, 202k | unclear 13 to 0; flagged its own judgement calls. |
| B3 actors-data | accepted, lead fixed 2 type errors | 6 min, 137k | 250 entries; 136 unclear from one ambiguous header. Reported typecheck clean for its file, but it had 2 errors (a missing optional and an unused param); the lead fixed them. |
| B3 worldfx | accepted | 6 min, 140k | 80 entries; found values duplicated across files. |
| B3 models | accepted | 7 min, 183k | 66 entries (folder is mostly logic). |
| B3 core/bots | accepted | 10 min, 222k | 160 entries, 88 bot-policy. Found bot comments disagreeing with constants. |
| B3 safety-engine | accepted | 12 min, 264k | 119 entries; found duplicated values and unknown tags [S] [R] [A] [proxy]. |
| B3 actors-engine | accepted | 7 min, 201k | 68 entries; good evidence quotes. Raised the inline-coverage and closure-held magnitudes (RELATION_ACTIONS) issues. |
| B3 safety-data | accepted | 8 min, 180k | 201 entries. Raised the `[C]` tag and header-statement questions (now rulings in the brief). |
| B3 finance | accepted | 11 min, 235k | 190 entries. Found a comment/code mismatch (PROMISE_RESULT +10/-15 vs 30/-30) and duplicated runway thresholds. |
| B3 market | accepted | 12 min, 216k | 346 entries. Found the start difficulty thresholds exist only in a comment. |
| B3 capability | accepted | 12 min, 243k | 342 entries. Ran a full lint once, which rewrote the shared coverage checklist mid-wave (rule added to the brief). Wrote scratch scripts outside the worktree (C:Usersdavidp_tmp). |
| B4 targets | accepted | 12 min, 229k | 152 targets; all 52 CAL2 rows. 16 good questions (coded bands differ from stated targets). Its rm of 3 temp files was denied; left uncommitted for the designer. |
| B2 | accepted, two small lead fixes | 3 min, 73k tokens | All checks pass, self-test catches 5 planted errors. Lead fixes: example params set `actor: 'model'` on world physics (the lead's schema didn't define `actor`; comment added); P05 is `derived`, not `fitted` (the lead's brief was wrong; the agent flagged it). |
| B0 | accepted first pass | 4 min, 97k tokens | All 7 questions answered with file:line; flagged its own uncertainties (src/ui unscanned, _xxx dirs, heuristic counts). No rework. |

## Parked designer decisions (2026-11-25: "prefer not to decide on these now"; don't re-ask unprompted)
- Possible game bugs, comment vs code: B5-QUESTIONS §B (9 items).
- End-screen score provenance: §F6.
- Refactors (one home per duplicated number §C; effect sizes out of closures §D2/D3).
- Target questions §E: these go to B6.
- Six uncommitted temp files left by agents whose deletes were denied (listed in git status).

## Phase C: tooling (design/bal/TOOLING-DESIGN.md), started 2026-11-25
| ID | Task | Model / effort | Status |
|---|---|---|---|
| C1 | balrun.ts parallel runner + shared game loop | Sonnet high | done 4f1edcf |
| C2 | Bot settings object (identical fingerprints) | Sonnet high | done 4f1edcf |
| C4 | baldash.ts static dashboard (dataviz standard) | Sonnet high | done 4f1edcf (built on fake data) |
| C3 | --set overrides for object/table params | Sonnet medium | after C1 |
| C5 | Sensitivity screening | Sonnet high | after C1+C3 |
| C6 | Bot perturbation scan + headroom | Sonnet high | after C1+C2 |

Designer framing (2026-11-25): real data exists only to 2026; the future is scenarios (hard alignment, slow adoption, easy capabilities), which act like setup choices. Balance must hold across scenarios. This is the core of B6.

## Engine speed-up: separate session (designer, 2026-11-25)
A different session does the engine speed-up on branch `bal-perf` (worktree ../AI27-perf), from design/bal/HANDOFF-PERF.md. When it's done the designer tells this session to merge it into `bal`. Don't do engine performance work here.

## C6 RefBot scan
- C6a: sets prepared, balance/scans/refbot-a.json (78 sets: 69 numeric/retry + 9 research-list), commit 1dc9588.
- C6b, first pass (designer's choice): run `refbot-a1`, ai2027/medium, leader, 10 seeds, 790 games, started 2026-11-25 in the background (log .scratch/refbot-a1.log). The full scan (20 seeds × ai2027 + sampled) runs after the bal-perf merge.
- C6b PAUSED by the designer (2026-11-25, to avoid competing with the bal-perf session). 228+ games are cached in .simcache; resume with the same command (replays the cache): `npx tsx scripts/v2/balrun.ts --name refbot-a1 --policy ref --world ai2027 --align medium --start leader --seeds 10 --sets balance/scans/refbot-a.json`. Note: any src/ change (e.g. the bal-perf merge) invalidates the cache.
- C6c: analysis by a fresh agent once the run finishes: paired differences per set against base (win rate, SC/SAR/ASI days, pMis), with intervals; the results write-up goes to design/bal/BOTS-RESULTS.md.
- 2026-11-25: the designer set the engine speed-up aside ("no easy speedup"); nothing to merge from bal-perf. The scan resumed (refbot-a1) from the cache.

## Timelines from the AI Futures Model (2026-11-25)
- Setup in ../aifm-runs (outside the repo; downloaded code run with python -I). Configs and trial log: aifm-runs/CONFIGS.md.
- Tuned (100-sample trials, seed 20261125), automated-coder p50:
  - fast = Daniel Q2 unchanged (published 2027.92);
  - central = Eli Q2 with excess_uplift_doubling_time [3.5, 37.5]: 2030.97;
  - slow = exponential horizon trend, AC horizon at Eli's row, present doubling at Eli's row: 2034.03.
- Full runs, 1000 samples each, sequential background jobs: fast started, then central, then slow. Then extract.py, then encode into balance/scenarios.ts, then the Scenarios tab.
- RefBot scan pass 1 results: design/bal/BOTS-RESULTS.md. Lead's recommendation: no full scan in the old world; use the findings as the strong-bot search space after the scenario worlds exist.
- Runner: workers now die with the parent; run lock added (commit after C3c).

## Future (designer, 2026-11-26)
Unlock projects and safety projects should later get taste effects (e.g. the full candidate lifecycle for safety, design/bal/SAFETY-UNIFY.md). Not now.

## Hiring market (future design, designer notes 2026-11-26)
- One global pool of relevant labour per kind (engineer, research engineer, researcher), possibly per ability level (the 3 levels). At the start most of it sits outside AI companies (other firms, academia, government).
- Inflow: new graduates, plus people from outside fields for researchers. Outflow: hiring.
- Wages follow a simple standard mechanism: they rise as demand grows and supply depletes, and everyone is paid at the marginal wage.
- **Until this exists:** the harness exception is in force. Forced runs set the player's headcount to the AIFM L_HUMAN path, clearly labelled as pending this model. It's a known deviation, not a mechanic.

## Round 2: changes before the next measurement (agreed 2026-11-26)
| # | Change | Kind | Status |
|---|---|---|---|
| R2.1 | Staff harness exception (forced runs only, labelled, pending hiring market) | harness | running |
| R2.2 | Starting compute re-split to real labs / AIFM (experiments ~35%, final training ~11%), start model unchanged | game data | running |
| R2.3 | Faithful horizon fix: horizon growth per OOM becomes a per-timeline setting, together with the per-timeline initial software pace, both from the AIFM groups. All timelines match the measured METR history; gSC re-derived from each group's required horizon. | mechanism + per-timeline data | after R2.1–2.2 |
| R2.4 | Diminishing returns for idea projects | mechanism | **D: not now** (one-off projects yield one result); re-diagnose after R2.3 |
| R2.5 | Measurement additions: the speed-up doubling-time metric in s1compare (game vs AIFM uplift doubling time) | tooling | with R2.3 |
| M2 | **Measure:** re-translate per-timeline settings (incl. R2.3), re-run step 1 on the forced harness, and compare with the timelines (SC, gaps, horizon, software pace, speed-up doubling) | measure | after all above |
| C2 | Fix C step 2: fit only the residual (takeoff via dBM / r / m2b within AIFM IQRs; SC via gSC if still needed) | fit | after M2 |

Deferred: hiring market; taste effects for unlock and safety projects; D (release lumps, re-check after C2); E (rival distillation, with NPC calibration); Stage 2 realistic-lab policy; Stage 3 strong bot.

## Designer notes (2026-11-26, after R2.2)
- **The game already sends idle training compute to experiments.** So the training pool is a *reservation* for runs, not average use. The R2.2 re-split (training 40→11%) may double-count, since effective experiment compute in the old split included the idle training spillover. **Check:** effective experiment compute (pool + idle training) in the old vs new split, against the AIFM (56%) and Epoch (about 66% non-final R&D); base-run sizes. Then decide whether to keep, adjust or revert R2.2.
- **R2.4 diminishing returns for ideas: within one project.** Successive ideas or results in the same project get harder and smaller, using the same law as lines (shared code).

## Decisions (2026-11-26)
- **R2.4 → option D:** one-off projects stay as they are (each produces exactly one result, so a within-project law has no effect). After R2.3, re-diagnose where any remaining slow-timeline excess software progress comes from (lines vs ideas) before choosing a mechanism. A within-project rule may return later for game feel.
- **R2.2 kept:** EXPCOMPUTE-2. The idle-training lend is a policy (off by default). Optional training 11→15% not applied.
- **Cleanup for the designer:** leftover folders `AI27-bal-oldsplit` and `AI27-bal-newsplit` hold node_modules junctions into AI27-bal. Remove the junction first (`cmd /c rmdir <dir>\node_modules`).

## Decisions after SHAPE-DIAG (designer, 2026-11-26)
- **A:** each line's starting pool (n0) comes from the AIFM initial research stock (pool age ≈ 1/g_E, about 1.2–1.4 years of start effort, per timeline). `pace` goes back to 1. **Do now.**
- **D:** a lines-first fixed policy for forced runs (staff the lines from day 0). It's a player-reachable policy, not a harness exception. **Do now.**
- **B:** P24 ("AI-designed successor") becomes a regular research line with ideas that add gradually under the line law, instead of a one-time fixed +1 OOM jump. **After A** (same code area).
- **C:** the scale lever needs proper calibration. The designer's play impression (2 games, low trust): early, scaling up improved models a lot with no visible limit; late, tiny models had great abilities. **Investigate and source first:** scaling laws, and whether algorithmic gains are scale-dependent.

## CONSOLIDATED: round 2 changes, then ONE measurement (2026-11-26)
This replaces the scattered round-2 notes above as the working list. No new investigations until M2 is done.

**Already in (committed):**
1. Fix A, taste ceiling. 2. Fix B, taste as a human/AI mixture (ideation rate without taste). 3. Safety research shares the research helpers.
4. Starting compute split (experiments 35%, final training 11%). 5. Staff harness exception (labelled).
6. Mechanism hooks with identical defaults: per-world horizon law, research pace.

**Finishing now:**
7. Line starting pools from the AIFM initial stock, per timeline; pace back to 1 (running).
8. Lines-first fixed policy `reflines` for forced runs (running).

**Then:**
9. P24 becomes a regular line (gradual ideas under the line law).
10. The scale-lever fix, from the SCALE-DIAG investigation (running; read-only). Designer decides the fix.

**Then ONE measurement (M2):** a forced run of all three timelines with 7–10. Report software pace years 1–2, history bands, SC date, takeoff gaps and the speed-up doubling (game vs AIFM) on the dashboard. Then decide the residual fit (fix C step 2).

**Not in round 2:** per-timeline horizon-law values (re-check in M2), idea diminishing returns (option D), and everything in the deferred memory list.
- **Item 10 decided (designer, 2026-11-26):** M1 (additive scale-dependence, Gundlach +0.23/OOM; strong scale-dependence only for rare paradigm-tier ideas) and M2 (remove L.scale's duplicate compute rebalancing) go into round 2. M3 (a size ceiling for small models and students via the loss law) is a separate design decision after M2.

## ROUND 3 (approved 2026-11-26), then ONE measurement (M3)
| # | Change | Type | Status |
|---|---|---|---|
| R3.1 | **Per-game joint parameter draws:** each game in a timeline draws one actual AIFM parameter set from that timeline's SAR group (~290), translated to game terms. New world presets `tl-fast` / `tl-central` / `tl-slow`; existing presets unchanged. | source-derived | done |
| R3.2 | **Matched speed-up definition:** a recorded game quantity at the AIFM's reference resources (2026.578), counting AI's contribution only. Scoring by phase (relative to SC/AC) as well as by date; dashboard and s1compare. | comparison | done |
| R3.3 | Pre-SC AI coverage from the AIFM automation-fraction path | source-derived | **done**; open: labour-CES problem (spdM falls), see HANDOFF-CALIBRATION §2 |
| M3 | One measurement with R3.1–R3.3, on the dashboard | measure | after |
Only if takeoff still runs short after M3: the untested mechanism suspects (the CES-free ideation channel, the experiment-share ramp) go to the designer.
- 2026-11-27: the labour-CES / optimal task-split fix is **deferred** by the designer (memory `ai27-balance-deferred`, item 8). Session wrapping up; next session starts from design/bal/HANDOFF-CALIBRATION.md.

## Plan after M3 (designer, 2026-11-27)
1. **M3** measurement (running, `balance/runs/M3`).
2. **Fit** what we have, as well as possible **without mechanism changes** (source-range parameters only: SC threshold, P24 line strength, takeoff residuals).
3. **Merge `bal` into master** (designer approved, after the fit).
4. Then **discuss the full list of relevant deferred mechanisms** (memory `ai27-balance-deferred`, incl. the labour task split) and work on them.
5. **While the mechanism work runs, the designer playtests master** (the merged fit) to judge whether balance improved the feel. So mechanism work goes on a branch off master and master stays stable and playable; playtest notes are judged against principles, not patched one by one.
   - **Merge scope (designer, 2026-11-27):** the new-game screen gets a **Timeline: fast / central / slow** choice (the per-game draw worlds; central default). The **old world presets are removed** (ai2027, authors2026, fast, slow, sampled), along with any code only they use. Old saves may break: no migrations.

## M3 result (2026-11-27)
- Run `balance/runs/M3` (36 forced games, 12 per timeline). Fast fits (12/17 within band); central 10/18, slow 6/18. Game tracks its draw (Spearman SC vs drawn AC 0.88) but runs early, more so for slower draws (median SC residual −0.25 / −1.07 / −2.36 y; ASI −0.86 / −2.17 / −9.71 y). Paired residuals: `.scratch/M3-paired.md`.
- Cause (`.scratch/M3-rate-diag.md`, `.scratch/M3-jump-diag.md`): not a translation error (ζ and the experiment-compute path match the draw exactly). The game's software rate is ~0.68× the draw's in 2026–27, then jumps 2–2.5× in 2027–28 when the game's **AI labour multipliers take off** (mIdeas 1→6, mExp 1.4→29 within a year). Open check: the AIFM draw's own labour multiplier at equal effective compute.
- Fit levers left are draw parameters (fitting them would be forcing) or blunt (P24 [D], ASI gaps); recommendation to the designer: skip the fit, merge, and take the **AI-labour mechanism** (with deferred item 8, the task split) into the deferred-mechanisms discussion. Awaiting the designer.

## Merged to master (2026-11-27)
- Designer chose **merge now, no fit** (P24 refit waits for the AI-labour mechanism work). Master fast-forwarded to `bal` at f3aa5d45.
- In the merge: Timeline picker (Fast/Central/Slow, default Central) replaces the old world presets (removed with their code, 68 registry entries and 58 targets; 25 targets re-pointed to tl-central); econ default `ai2027`; SCHEMA_REV 112, old saves refused.
- Checks: tsc and lints clean; the forced replay of M3 seed 2027 tl-central is identical (no change for tl-* worlds); the UI test plays setup → game → end → new game.
- Tests: test:quick has 97 failing checks (65 already failing on bal before the change; about +32 are expected values written for the old ai2027 world, mainly finance, safety ideas/research, worktypes, products, suites, rivals). UI: 20 fail (16 before); the 5 new ones are being classified (`.scratch/UI-NEW-FAILS.md`).
- Next: the designer playtests master; the lead brings the deferred-mechanisms list (incl. the AI-labour takeoff from M3 and item 8, the task split).

## After merge: point-1 checks (2026-11-27)
- `.scratch/LABOUR-MULT-CHECK.md`: the game's AI labour multiplier is at or BELOW the AIFM's at equal effective compute (0.4–1.0×); the AIFM uses an optimal split (`coding_labor_optimal_ces`), which supports deferred item 8.
- `.scratch/RATE-DECOMP.md`: the 2027–28 jump is **P24 (AI-designed successor) entering with a fresh pool** (n0 ≈ 1.85; no LINE_START_INPUT entry, by design "research just beginning"); ~96% of the jump in the central check game; the six start lines alone are flat like the draw (0.41 vs 0.34 OOM/yr). mIdeas contributes ~0 (the idea pool is already full). P24 has no AIFM counterpart: AI-driven research there acts only through the labour multiplier and taste, so P24 double-counts. Decision for the designer.

## Labour round: designer decisions (2026-11-27)
- **Using labour: the optimal task split is APPROVED** (item 8): AI and humans share covered tasks while AI is scarce (L = h + ai), humans move to uncovered tasks once AI could more than fill them (today's CES), one rule for all slots (replaces the build max(human, L) stopgap). **UI must show clearly:** what AI *can* cover, what it is doing now, and what more compute and more human labour would add.
- **Hiring market, designer's answers:** (1) player, rivals and China draw from the pools in principle; for now a *very* simplified placeholder for rivals/China (the full version belongs to the rival session); (2) wage repricing is gradual; (3) quality tiers: the designer questions whether they add gameplay (lead's answer pending); (4) automation feeds the market only through labs hiring less, no extra rule; (5) premium pay offered; (6) start state sourced; (7) forced runs hire through the market, retiring the harness exception.
- The designer wants the other deferred labour issues folded into this round (incl. "how research engineers do experiment work"): inventory in `.scratch/LABOUR-INVENTORY.md` (running).
- Open: P24 fresh-pool decision (options A/B/C; lead recommends A).
- **P24: option A approved** (start pool from the pretraining research stock like the other lines; no fresh-pool lump).
- **Quality tiers removed for ALL kinds, scientists included.** New 4th kind: the **star**, a single person who only adds research taste. Explicit, tangible, discrete, scarce and expensive (replaces today's star hire +0.05 τ_h).

## Labour round: APPROVED (designer, 2026-11-27): design/bal/LABOUR-ROUND.md
All of C1–C7 and every open-question recommendation are approved (Q3: stars at the AIFM size, named, lab-wide; Q6: L.latent gets the P24 rule).
| Task | Status | Branch / worktree |
|---|---|---|
| L10 sourcing | running | bal (docs only) |
| L1 split rule | running | lab-l1 / ../AI27-l1 |
| L4 P24 + L.latent pools | running | lab-l4 / ../AI27-l4 |
| L2, L3, L5–L9, L11–L19, CP, M4 | todo | order per LABOUR-ROUND §10 |
- L10 sourcing done (design/bal/LABOUR-SOURCES.md); designer's rulings on its judgement calls are at the end of that file (team sizes 100/50/20 with no partial teams, pay ladder, star pay $50M/yr [D], player's 7 stars, 15.6%/yr). L4 merged (P24 n0 ≈ 19, L.latent ≈ 20).
- Status 2026-11-27 (later): L1, L2, L4, L10 merged into bal. Running: L3 (lab-l3 in ../AI27-l1), L5 (lab-l5, ../AI27-l5, Opus (c)), L8 (lab-l8, ../AI27-l8). Next: L6, L7 after L5; L9 after L8; L11 after L8 (team sizes 100/50/20 and the pay ladder go into L11/L15).
- Status: L3, L5, L6, L8, L11 merged. Running: L7 (lab-l7, ../AI27-l5), L9 (lab-l9, ../AI27-l1), L12 (lab-l12, ../AI27-l8, Opus (c)). Note from L11: star taste uses each world's drawn m2b (per-timeline median ≈ 4, p90 ≈ 12; seed 1 drew 22), so a star's effect varies by world: about +1% idea quality at the median m2b, up to ~6% in high-m2b worlds. Source-faithful; report to the designer.
- L12 merged (market weekly system; payroll $1.75B → $2.18B/yr on day 1 from the pay ladder). L17 (stars) built; merging needs conflict work (agent on lab-l17).
- **Lead's translation fix (L17):** the start lab's mean human taste equals the AIFM's 1. In the AIFM the company's mean of 1 already includes its own top researchers, and the player starts with ~7 stars among ~320 scientists, so without a fix T_h at start was ≈1.5 in high-m2b worlds. Rule: a teams' base taste b is set once at start so that T_h(start) = 1; afterwards T_h = (S·b + ΣT_star)/(S + n). Stars hired or lost move it from there.
- Coordination: before the CP (test:quick/test:ui) and M4 (36-game balrun), message session ai27-94 (data-centre, branch dc), which is running its own full checkpoint, so heavy runs don't overlap.
- Status: L13/L14, L15, L17 (with the start-taste fix) merged into bal; day-1 payroll $2.31B/yr incl. 7 stars. Running: L16 (lab-l16, ../AI27-l8), L19 (lab-l19, ../AI27-l1). Then L18 (after L16), SCHEMA_REV bump + fixture regen, CP, M4 (coordinate with ai27-94).
- **Designer (2026-11-27): WAIT before starting the CP tests** (test:quick / test:ui) and M4, until the designer gives the go.
- All build tasks L1–L19 merged into bal, plus CP prep (SCHEMA_REV 113, MIN 113, fixtures regenerated). L19 smoke (seed 2027 central): the AIFM staff path is reachable through the market (within 2–4%, premium ≤ +50%, no miss); wages ×2 by 2028.
- **Open design issue (for the designer): queued teams can stall short of full.** Hires = c·V^0.65 fall as open seats V shrink, leavers keep re-opening vacancies, and vacancies are filled before the queue, so near the target a queued team sits ~6–10 seats short of full forever (`fillWeeks` correctly says "never"). Options: (A) a team arrives at ~90% full and hires are split between vacancies and the queue in proportion to their seats (lead's recommendation); (B) the queue fills before vacancies (bad: while growing, existing teams decay at 15.6%/yr); (C) teams start working as they fill (partial teams).
- Tests still on hold until the designer's go.
- **Designer: keep it simple → option C chosen.** No hiring queue: a new team appears at once with empty seats and works with whoever is in it (task on lab-noqueue, SCHEMA_REV 114).
- **Superseded by the designer (2026-11-27): teams are whole chunks.** Hires build toward the next full team; no vacancies, no queue, no player leavers. Morale keeps only its effect on hiring speed. Poaching = with a premium, a share 1 − (1+π)^−ε of your hires come from rivals (who shrink). Staff-moving events move whole teams. Task on lab-chunks (SCHEMA_REV 114). The sourced 15.6%/yr separation is no longer used for the player.
- Master moved (2026-11-27): the data-centre work (dc, 47ee6fc6) is on master; SCHEMA_REV 113 there; it moves calibration (design/dc/CALIBRATION-NOTE.md). **Merge master into bal after lab-chunks lands and BEFORE the CP/M4**, so M4 measures master + labour; renumber our SCHEMA_REV above master's.

## Labour round merged to master (2026-11-27): master = 6f1448b6
- Contents: L1–L19, teams as whole chunks (no vacancies/queue/leavers), master's data-centre work merged in, SCHEMA_REV 115.
- Regressions found at CP and fixed: eval suites unstaffed and investigations blocked (cause: start safety RE 100 → 50 with REVIEW_STAFF set for 100 → REVIEW_STAFF 5 → 2.5 [D, lead's change, designer to confirm]; needs claim by order via needRoom); the successor AI-share floor (labourSplit min 1e-12 → 0).
- CP results: UI 713 pass / 17 fail (20 before the round); quick-test failures otherwise expected-value shifts. Remaining vs master: none new in footholds/successor/safety.
- Open for the designer: FOOTHOLD.removal staff sizes 10/5/10/5 (src/data/v2/danger.ts:239) were set for 100-head teams; a 10-head removal can't be staffed at day 400 with the default need order. M4 was stopped (0.1 games/min under load); rerun alone later.

## Diffusion fix (designer, 2026-11-28)
- Found: since the NPC merge, `npcRecipe` (npc/lab.ts:118) counts a small lab's compute shortfall as recipe; the upstart Pellory (placeholder 30k H100e, 3-month lag) shows ~1.2 OOM above the leader player, and diffusion adds ~+1 OOM to the player's software in a year (central seed 2027: SC 2028.0; diffusion off 2028.8; pre-NPC 2028.5; AIFM 2029.95). Evidence AI27-cal/.scratch/diff/DIFF.md.
- **Decided design (simple):** what diffuses is software know-how, never compute. The public level = the best NPC lab's reference SOFTWARE level at its lag (+ release lag), with no compute term. A diffused level drifts toward it (gap / τ, sourced ~4 months, kept). **The player's effective recipe = the HIGHER of its own research level and the diffused level** (no double counting: diffusion stops counting once own research overtakes). **Show it in the know-how bars.**
- Fix the mechanism here; Pellory's numbers are left for later. An NPC-touchpoint audit is running first (AI27-cal/.scratch/npcaudit/).
- **NPC fixes: full scope approved (2026-11-28), spec design/bal/NPC-FIX.md.** Running: F0 (S_ref, fix-f0 in ../AI27-l1), F3–F6 (shocks, fix-f3 in ../AI27-l5), F7 (lead readouts, fix-f7 in ../AI27-l8). Next: F1/F1b/F2 (diffusion = max(own, diffused), know-how bars, tacit leak) after F0; F8 clean-up and OPEN.md; checkpoint; central remeasure.
