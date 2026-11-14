# v2 build progress log

Single source of truth for where the build stands. Update at every milestone or interruption.
**On "resume": read this file and run `git status` / `git log` before doing anything.**

## Milestones

| Milestone | Status | Commits |
|---|---|---|
| Research (12-17) and spec | Done | research/12-17, design/V2-SPEC.md, design/v2-interfaces.ts |
| M0 contract | Done | 7eeddc7 |
| M1 workstreams WS1-WS5 | Done, merged | 98b4399 (WS1), 3005c2c (WS2), 623cf51 (WS3), 551bf96 (WS5), ea01d6d (WS4) |
| M2 step 2: state extensions folded into types.ts | Done | 3a42f84 |
| M2 step 3: single finance ledger | Done | fc2ae9f |
| M2 step 4: cross-workstream wiring | Done | 98c20cf, 0d0b808, c067c50, f8ff4c9 |
| M2 step 5: whole `npm run test:v2` green, tick performance, bot table | Done (3 finance targets deferred to M4) | bf93f24, 0987ced, c0594e5, 25ad13c, f50c4c0, 3f4c9fe |
| M3 UI shell and panels (WS6, WS7) | Not started | |
| M4 calibration and balance (bot criteria) | In progress: company loss fixed, F7/F8 and T1 met, 3/5 binding bot criteria | see M4 status |
| M5 polish, tutorial, codex, v1 removal | Not started | |

## M4 status (2026-11-14): checkpoint 1 — company loss fixed, finance targets met, bot criteria 3/5

**Root causes of the company-loss flood** (M2 table: ref 85% loss, mostly ousted/acquired; safe 97.5% ousted; race 75% insolvent):
- *Board confidence only fell.* No recovery term; a +20%/q revenue plan that lumpy launch-driven revenue missed most quarters; −2 BC per SPV site (12+ sites); uncapped incident piles; an ouster roll with no warning or counterplay.
- *The investor pool was ~⅓ of C8.* R_sector ≈ the player alone (rivals' revenue grew 2×/yr from $1B), and hype drifted to 0.7–0.8 because one quiet quarter read as a −1 surprise against a 0.5 L/q expectation.
- *Down rounds by accident.* A round priced at the next quarter's mark became a down round (−15 BC) whenever the mark dipped.
- *Bots played the money badly.* Every bot refused E02 (its default), so the $30B tranche was cut to $10B; bots raised into down marks, re-rescued every 30 days (acquired), the safe bot spent $8B on day 0 on paid relation actions, and an unbounded bridge once signed $75B/yr of cloud.
- *Engine bugs.* `preDeployTesting` bound forever after the first deployment swap, so any lab that signed A1 could never launch again (mixed and safe revenue flat, then ousted). `fullPlusExternal` could never pass (it checked `evals.bench`, which evaluators never write). Evaluators queued versions oldest-first. A base the training pool could not deliver in 150 days was never retried (the safe bot stalled at L 7, the race bot's stretch bases never launched).

**Changes** (spec §3.7.5, §4.2 E37 and §9 rows 21–25; all [D]):
- *Board.* BC drifts 10%/q back toward 60. The plan asks +15%/q and counts as missed only below 85%. Incident hits cap at −20/q. SPV guarantees cost −2 once per quarter. Slowness hits scale with the board's speed appetite.
- *Ouster.* A warning below 35 plus E37 "Board revolt" (new directors / capex freeze / rally staff / ignore). The vote needs a warning at least 60 days old. It is a seat-stance majority over the grievance (reckless / burning cash / slow). Staff reinstate the CEO once (morale > 70).
- *Finance.* Rivals' revenue tracks WS5 `labMarketRevenue`. Hype surprise is the 4-quarter pace against an adaptive expectation. Rounds are priced at the term sheet; a repriced down round is pulled unless runway < 4q. One rescue per year.
- *Safety.* Trait growth rises up to +50% while L > U (`GAP_GROWTH_K` 0.5).
- *WS5 refits for RefBot on golden.* `ACCEPT.mid` 10.0 → 9.5. Hiring adjusts with a 0.05-year lag (`HIRE_TAU`).
- *Bot competence (shared `financeDecide`, autopilot).* Restructure; no raise into a down mark; renegotiate → rescue (keeping control) → one down round per 180 d; sell chips before insolvency; bounded bridges; bases step down a scale. Race: 3q guard + rescue. Safe: 50% build-out, guard 6q, paid actions only with ≥ 5q runway, keeps release candidates' evals fresh. Mixed: reacts to the U-margin earlier (+3 points a month below +0.5).
- *Coordinator items.* Causal replay "level +44" was `series.Lmeasured` dropping to 0 on an agent switch (fixed). Risk-source rows summed to > 100% (first-to-ASI is now one distribution; misuse goes through the §5.1 #4 chain; theft is its catastrophe contribution). U ≈ 11 at day 55 is WS2's calibration: S5 binds it and still passes. It weakens the mixed heuristic early (see remaining issues).

**Results.**
- F7: 2026 capex median $169B; end-2026 valuation $1.17T; revenue $42B; 6.7 GW.
- F8: 92% of seeds distress-free; capex2x reaches distress 100% and insolvency 98.5% in bot play.
- T1 integrated (real finance), ai2027: SC −0.04 y, SAR −0.01, SIAR +0.04, ASI +0.08 (all within §7.1). authors2026 and slow go insolvent under the reference build-out (informational).
- S4: RefBot P_mis 0.76, safe 0.125.
- Hygiene: 1.13 ms daily, 3.2 ms worst quarter (it was 0.44 ms per tick at M2 because the passive game ended ousted at day 458; it now survives all 1,500 days).

Bot harness, 200 seeds:

| bot | win | mixed | loss | top endings |
|---|---|---|---|---|
| race | 13.0% | 4.0% | 83.0% | asiTakeover 42%, nationalized 15.5%, ousted 12.5%, asiAligned 11.5% |
| safe | 1.0% | 2.0% | 97.0% | overtaken 50.5%, ousted 46.5% |
| mixed | 26.0% | 3.0% | 71.0% | asiTakeover 38%, asiAligned 25.5%, nationalized 11%, ousted 10.5% |
| capex2x | 0% | 0.5% | 99.5% | insolvent 98.5% |
| ref | 20.5% | 5.0% | 74.5% | asiTakeover 38.5%, asiAligned 21%, nationalized 14%, ousted 11% |

§7.4 criteria status:
- MET: race losses ≥ 30% takeover and ≥ 20% company-loss (59% / 40%); safe win ≤ 5%; safe losses ≥ 50% overtaken or other-first (52%); passive takeover-type ≥ 50% (64%).
- MISS: race win ≤ 5% (13%); mixed ≥ 30% and ≥ 25 pp over both (26%, +13 pp).
- E5: 14/17 endings seen; war, acquired and retired are reachable only in the forced-state test.

**Remaining (next M4 step).**
- *Mis at ASI is driven by the world, not by play.* For the same seed, race, ref and mixed land within about 0.05 Mis of each other. Race's aligned wins are easy worlds (Mis < doomThreshold); mixed's losses are hard worlds. Neither the doom curve (shift −0.03…+0.06, slope 0.02–0.06) nor `DIFFICULTY_SCALE` separates the bots (checked offline on recorded Mis).
- *What it needs.* WS2 work so design and safety choices move Mis: removal of oversight-conditional traits, AG07/T-TMON moderators on POWER and COLLUDE, and the U level early (U ≈ 11 at the start keeps the mixed heuristic at 3% safety for a year).
- *Thin margins.* The worldfx HireRate (Apr 4 vs window from Apr 1) and W4 youth (−14.1% vs −14) pass only narrowly. Nationalized (11–15%) is now the largest non-AI loss.

## M2 step 5 status (2026-11-14): done

`npm run test:v2` green end to end in 795 s (all 13 scripts); `tsc`, `npm run build` and v1 `simtest ai2027 1 race` pass.
Hygiene tick: 998 µs daily average, 7.4 ms worst quarter (targets 1.5 / 8 ms). Slowest script: safety (~7–11 min,
100 full games).

Deferred to M4 (finance.ts KNOWN entries, documented there): F7 2026 capex $127B median (want ≥ 150), F7 end-2026
valuation $0.74T (last round's post-money), F8 8/12 seeds distress-free (want 9).

Bot harness (40 seeds per bot, Rising storyteller; endings live):

| bot | win | mixed | loss | median day | top endings |
|---|---|---|---|---|---|
| ref | 15.0% | 0% | 85.0% | 631 | ousted 47.5%, acquired 25%, asiAligned 15%, asiTakeover 12.5% |
| race | 0% | 0% | 100% | 215 | insolvent 75%, ousted 25% |
| safe | 0% | 0% | 100% | 366 | ousted 97.5%, insolvent 2.5% |
| mixed | 10.0% | 0% | 90.0% | 601 | ousted 45%, acquired 42.5%, asiAligned 10%, asiTakeover 2.5% |
| capex2x | 0% | 0% | 100% | 215 | insolvent 72.5%, ousted 27.5% |

All §7.4 criteria miss: company-loss endings (board ouster, insolvency, acquisition) dominate — the first M4 item.
Integrated T1 (calib info table, real finance): ai2027 SC +0.15 y, ASI +0.26 y vs golden.

## Leftover worktrees

`.claude/worktrees/agent-*`: the original workstream worktrees. Their branches are fully merged and can be removed once M2 is committed.

## Working rules (learned)

- **Concurrency:** run at most 1-2 agents at once.
- **Model choice:** Opus for all work, including every agent, at medium or high effort (user instruction). Manage usage by limiting concurrency, not by switching models.
- **Commit often:** agents commit at each green checkpoint; otherwise snapshot WIP to `refs/wip/*`.
- **Logging:** update this log at every milestone.
