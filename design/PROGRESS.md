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
| M3 UI shell and panels (WS6, WS7) | Done, merged (play with `?v2`); v2 uitest 88/88; full test:v2 green after merge | 5ff08b8..7e0ad07, merge 35b2609 |
| M4 calibration and balance (bot criteria) | Done: all §7.4 bot criteria met (200 seeds); choices now drive final misalignment | 514d877, cd0c7d6, 8eec058 |
| M5 UX redesign (IA, design system, panels) | Done: uitest 104/104, lint-ux green | 0af3dcd..babe8b2 |
| M5 polish, tutorial, codex, v1 removal | Onboarding and codex exist; v1 removed (2026-11-15), `npm run build` builds the current game | |
| **R0 Tycoon restructure: design** | Done (2026-11-16): STRUCTURE.md, TECH-TREE.md, LIMITS.md, research/18–19, mockups-v3. Approved by the user | 168ef39 (branch `game-structure`, worktree `../AI27-structure`) |
| **R1 Restructure: baseline, bugs, scaffolding** | Done (2026-11-16): B1–B5, LIMITS removals, setup/meta fields, ref-trace tool, schemaRev 4; all §7.4 bot criteria MET (200 seeds) | "R1: commitment scope, …" on `game-structure` |
| **R3 Restructure: teams and roles** | Done (2026-11-16): fixed-size teams in three roles, h from capabilities research engineers, τ_h from science quality + stars, keep-hiring policy, offers, Company › People teams + hiring cards, schemaRev 5; no CAL_SHIFT refit; all §7.4 bot criteria MET (40 seeds) | "R3: teams and roles, …" on `game-structure` |
| **R2 Restructure: leader lab in the world** | Done (2026-11-16): simulated AI 2027 leader "Polaris AI" behind `setup.leaderLab` (default off), T1L passes with LEADER_CAL, `--fit-leader`; flag off identical (ref-trace, bots); no schemaRev change | "R2: leader lab …" on `game-structure` |
| **R4 Restructure: tech tree and capability projects** | Done (2026-11-17): 93-node shared tree, science teams on projects (√ capacity, ×1.5 specialty, absolute M), per-world rolls and retries, design-option locks, auto-assign, Research panel, schemaRev 6; fitted efforts; CAL_SHIFT refit (authors2026, fast, slow) and LEADER_CAL refit; all §7.4 bot criteria MET (200 seeds); one new worldfx failure (GOV accept) documented | "R4: tech tree …" on `game-structure` |
| **R5–R10 Tycoon restructure: build** | Next: R5 … R10 serially (BUILD-PLAN parallelism note); milestones logged below. `gs-leader-lab` held no work beyond R1 and was not merged | |

## R4 Tech tree and capability projects (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R4, TECH-TREE.md, STRUCTURE §4.2–4.3, mockups-v3/v3-research*.

**Data `src/data/v2/tree.ts`.** 93 nodes of TECH-TREE §2 (pretraining 13, post-training 18, systems 22, alignment 11,
interpretability 10, evals & control 19; max depth 4): id, column, layer, needs, effort class, `effortTM`, odds (paradigm
prior or own odds), star, design options unlocked (`OPTION_NODE` slot:value → node), cash cost (P12 $1B), effect arrows
and card text. Paradigms keep their P-ids (P01–P04 are ★). Safety-column nodes carry their technique / agenda and are
read-only mirrors (known when the technique is unlocked; P27 stays a researchable paradigm). Product-feature nodes
(Coding agent, Voice & vision, Deep research) are `soon: 'products'` (not researchable until R6). `data/v2/paradigms.ts`
keeps id, name, prior (world-draw order unchanged) and display text; tiers, gates, effortDays and FTE constants are gone.

**Engine `models/tree.ts` (+ `treeActions.ts`).** `player.tree[id] {status researching|known|failed, progress, day,
attempts, priorMult, retryDay}` (sparse; locked/open/queued/active derived by `nodeStatus`) and `player.research {queue,
autoAssign}`. `researchSystem` (daily, order 35): progress/day = M · √capacity / (effortTM · 30), capacity = Σ heads/40 ×
quality × 1.5 in the specialty column (D3: M = the production readout's absolute M). Rolls: a paradigm's first attempt
uses `hidden.paradigmSuccess`; every other attempt (new nodes, and all retries) `hash32(seed, 'node:'+id[+':'+n])` vs
odds × ½ per failure; retry after 180 d. Success → known and `paradigms[id].status='adopted'` at once. Auto-assign policy
(default on): idle capabilities science teams join the top ready project in their specialty, else the least-staffed; a
ready project with no team takes one from the largest project (so RefBot's projects run side by side as the old 30-FTE
projects did). Safety scientists are not assignable (agendas until R8). `optionLocked(s, slot, value)` is used by
`planRun` (shape, data, curation, preference, RL focus families, RL intensity, CoT, inoculation) and `effortLock` (deep
effort); options of read-only safety nodes (hazard filter, safety pretraining, inoculation) stay open until R8. Removed:
tier/L gates, `paradigmGate`, `fundParadigm`, `adoptParadigm`, `paradigmLoad` and the FTE / experiment-share subtraction
from H and c. Without gates P13/P20/P24 pay off with what they need (`payoffOf`: P13 c ×(1 + 0.5·ramp of RSCH 6.5→8.5),
P20 with the agent pool / 2M, P24 +0.8 y × AI share of research labour 50→90%); Quantization ×0.8 and Speculative
decoding ×0.85 serve cost on new versions; Fault-tolerant training halves restart risk. Actions: `research.queue` (adds
missing researchable prerequisites first), `research.start` (top of the queue), `research.dequeue`, `research.move`,
`research.assign`, `research.unassign`, `research.autoAssign`. Known at start: ★ nodes, mirrored known techniques, and
(leader start, until R9's start data) the features the game already has (Agents product, Sector packs, KYC tiers).
`knowHow()` selector for the know-how bar. `SCHEMA_REV` 6, cheap migration 5 → 6 (adopted/succeeded → known, researching
→ queued with its progress, failed keeps retry date and odds); checked on the three rev-5 fixtures (load, 30 d RefBot,
plain JSON). Fixtures regenerated.

**Bots.** `REF_PARADIGMS` → `REF_TREE` (TreeGoal {id, when}) with the old gate pacing (P05/P07 day 0, P08 L ≥ 7, RL focus:
ML research L ≥ 6.5 (P13's new prerequisite), P13 L ≥ 6.5 and RSCH ≥ 8.5, P17 L ≥ 9.5, P19 L ≥ 8.5), queued when their
prerequisites are known, a failed one again from its retry date. Safe bot: REF_TREE − P17 + P23 (old gate: L ≥ 8.5 and an
AG09 technique; CoT monitor is known at start). Race and mixed unchanged apart from the goal type.

**Calibration.** `calib.ts --fit-tree [presets]` scales RefBot's node efforts until every attempt lasts its pre-R4
duration (damped; ai2027): **P05 7.43, P07 5.63, P08 30.14, P13 81.34, P17 40.5 team-months**; other paradigms = old
effortDays × 0.2; new nodes S/M/L/XL = 3/8/25/50. **CAL_SHIFT refit (logged in calibration.ts):** ai2027 0.08
(unchanged: +0.01 fits the stub trace better but moves the integrated one 14 d), authors2026 0.025 → 0.03, fast 0.105 →
0.075, slow −0.197 → −0.172. **LEADER_CAL refit** for those presets: authors2026 0.063 → 0.068, fast 0.085 → 0.053, slow
−0.029 → −0.004. T1, T1L, T2 (177k copies, 30.9×) pass; T1 SC Δ: ai2027 +0.003, authors2026 −0.044, fast −0.049,
slow −0.038 y.
- ref-trace vs R1: milestones stub ai2027 ≤ 7 d, integrated ≤ 4 d; fast SC +3 d (A1 −11, informational); slow SC −1 d
  (A1 −68, a step of the discrete runs); authors2026 SC +3 d but SIAR +19 / ASI +30 d (8-year horizon). Adoption days:
  integrated within 4 d; stub ai2027/authors2026 P07, P08, P13, P17 within 16 d **except P05**: the old retry drew from
  the 'runs' stream (succeeded at day 301 in the stub traces, failed in the integrated one); the per-world hash draw fails
  it on seed 2027 in every trace. fast P13 is now adopted (886) and slow P13 later: with absolute M (D3) late projects run
  faster in the fast world and slower in the slow one. Mean h +1.1–1.4% (paradigm FTE no longer subtracted; expected).
  Integrated revenue at day 822 +130% and cash +15%: a mini release lands at a different time.

**Gates.**
- `npm run typecheck`, `tsc -p scripts/v2`: clean. identity and golden-timelines unchanged and passing.
- test:v2 scripts individually: golden-timelines, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs (101
  actions), safety, finance, ws4, money pass; hygiene passes except the known absolute performance budget (machine under
  load; the leader lab's paired cost +6.6%). **worldfx: the known HireRate_SOFT failure (now 2027-01-07) plus one new
  failure, "Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85" at 2028-03-31 (base 2027-12-26).** Traced: in the worldfx reference
  play RefBot's enterprise channel ends up on the continual-learning stream version, whose rising level keeps the
  "served" level up, so the staleness rule stops distilling public minis after day ~870 and the government's model
  stalls. RefBot's release rule meets a different path; it was not changed here (that would tune the reference bot to a
  test). Left open for the user / R6 (products replace the swap logic).
- Performance (`_perf.ts`, seed 9, 1,500 days; baseline worktree at a4084e7 and R4 alternated 4 × 2 runs on a loaded
  machine): daily 2.35 ms (base) vs 2.34 ms (R4); worst quarter 20.3 vs 17.7 ms. No regression.
- `npm run test:ui`: 140/140 (new Research section: know-how bar, tree, node card, Start now, auto-assign, second idea
  queued, team picker assign, auto-assign toggle, reorder, Safety filter, minimap, drop; run designer overtrained locked
  behind its node; the deep-effort lock names the node). Screenshots 40–42 and day-400/900 research checked.
- **Bots, 200 seeds** (`--seeds 50 --from 0/50/100/150` merged with `--load`): all six §7.4 criteria MET.

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 3.5% | 7.0% | 89.5% | 815 | asiTakeover 60.5%, ousted 15%, nationalized 8.5% |
| safe | 0.0% | 3.0% | 97.0% | 1462 | overtaken 62.5%, ousted 33.5% |
| mixed | 50.5% | 6.5% | 43.0% | 1027 | asiAligned 51%, asiTakeover 12.5%, ousted 11.5%, nationalized 10.5% |
| capex2x | 1.5% | 0.5% | 98.0% | 304 | insolvent 93% |
| ref | 19.0% | 5.0% | 76.0% | 979 | asiTakeover 38%, asiAligned 19.5%, ousted 14% |

§7.4: race win 3.5%; race losses 73% takeover / 27% company-loss; safe win 0%; safe losses 65% other-first; mixed 50.5%,
+47 pp over both extremes; passive takeover-type 64%. Choices vs world (final Mis): bot policy 65%, world 21%, rest 14%.
E5 14/17.
- **Beelining** (scratch, 24 seeds each, RefBot's policy with other goals): P07 → P17 from day 0 gets neuralese at a
  median day 319 (RefBot 705) and SC at 558 vs 615; win 21% vs 17%, takeover 11/24 vs 10/24. Queuing every capability
  idea at once (P13, P19, P24, …) spreads the teams: SC 618, win 25% (noise at n = 24). A real strategy (≈ 2 months to
  SC for monitorability lost), not a dominating exploit.

**UI.** `panels/Research.tsx` + `research.css` per v3-research (good-ui pass): header know-how bar (home `knowHow`:
months not trained in, Train link) and a Research-speed link to Company; tree card (home `tree`): six lanes, columns =
depth from what you know (Known pills, Depth 1–3, "+N ›" deeper), All/Capability/Safety filter, legend, minimap (all 93
ideas; click toggles the whole tree), nodes with state icon, effect arrows, layer badge, effort·odds / needs / queue no.
/ progress / retry date / Safety line; edges measured from the DOM (amber dashed when a missing prerequisite matters
now); node card (effect, pays-off now, odds or research-line link, effort and ETA with breakdown, needs, unlocks with
Runs/Deploy links, Start now / Assign teams / Queue / Drop); team picker (bonus ×1.5/×1.0, ETA before → after, cost on
the project the team leaves, assign / take off); active-project cards (home `projects`: team chips, ×1.5, progress,
ETA, odds, idle count, auto-assign toggle) and the queue (home `queue`: wait reason, reorder, drop). Nav: Research
(badge = idle science teams); Models lost its paradigm section; Codex lists the tree. New glossary terms: techTree,
knowHow, trainedIn, depth, layer (+4 layers), effortClass, teamMonth, odds, researchLine, specialtyBonus,
diminishingReturns, projectQueue, autoAssign, retryRule; paradigm and roleSci rewritten.

**Deviations / deferred.**
- Retries of paradigm nodes use the per-world hash, not the 'runs' stream (deterministic; P05 is lost on seed 2027).
- Option locks from safety nodes and safety projects for safety scientists: R8. Product-feature nodes: R6. Each start's
  known nodes: R9 (`leaderKnown` marks the three the game already has).
- The worldfx GOV T1 Accept failure (above) is left open; ref-trace stub P05, fast/slow P13 adoption and the late
  authors2026 milestones are outside the ±14 d / ±10 d tolerances for the reasons above.
- Scratch scripts `scripts/v2/_r4*.ts` (gitignored) could not be deleted (permission). Baseline worktree left at
  `C:\tmp\r4\base` (detached a4084e7, `node_modules` junction): remove the junction with `rmdir` first, then
  `git worktree prune`.

**Notes for R5.** Engineers' build capacity should gate Scaffold-layer nodes (feature builds); `nodeKnown` /
`optionLocked` are the readers for blueprint slots. Fault-tolerant training already halves restart risk; the serve
multipliers (`serveTechMult`) belong in R5's serve ∝ √size formula. The worldfx release-cadence issue will move again
with R6's products.

## R2 Leader lab in the world (2026-11-16, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R2, STRUCTURE §4.8, decision D1.

**Engine.** `actors/rivals.ts initialLeaderLab` builds `LEADER_ID = 'rL'` (models/labs.ts), name **Polaris AI**, model
family Polaris (data/v2/names.ts), archetype `leader` (data/actors.ts, weight 0: never sampled; `pickWeighted` drops
weight-0 entries, which keeps the draw identical; the Setup rivals picker hides it and the company name may not take
it). Posture `ARCHETYPE_POSTURES.leader` (racer: safety 0.35, race relaxation 0.8, bindingness 0.2, Realistic noise,
then capped at `LEADER_MAX_BINDINGNESS` 0.3, so `rivalSpeedMult` never slows it; bindingness only ever falls).
`newGame` appends it after the sampled rivals only when `setup.leaderLab`, from `Rng(hash32(seed,'leaderLab'))`
(posture noise, U-modes, first base day); it writes its archetype/posture into `hidden`. Start: internal and public
model = player V0 pm, pa via `simpleStartPa`, staff.cap = hRef, saf from posture, compute = refTotal, split =
shareRefAt, tasteHire 1, finance $40B / $12B/yr / $300B. Daily (`labDaily`): computeOnline = refTotal (set at order 100
for the next day's production, which reads day − 1 inputs, so k = c = 1 exactly); release lag 30 d, base cadence 9
mo, latent-reasoning P 0.8. Quarterly: no chip orders; never distressed (cash floor like a parent-funded lab).
`compute/market.ts`: while the leader is active, `exoRefQ` no longer nets the reference lab's growth out (the leader
owns it; the player's orders are extra demand) and the leader is excluded from the rivals netting and the default
unmanaged-rival claims. It flows through relations (`rival:rL`), world labIds, series, the market mix, intel, index,
theft and endings via `s.rivals`. The ref-compute stub (scripts/v2/lib.ts) skips it.

**LEADER_CAL** (`data/v2/calibration.ts`, stored per lab as `core.lagCal` at newGame): an extra lag in progress
years added by `simpleLag(w, q, rate, extra = 0)` inside `simpleFrontierPm` and `simplePaFor` (not in
`simpleStartPa`, so the start model stays V0). A time lag (× rate) was tried first and rejected: post-SC it compounds
through the lab's own research feedback (0.046 y moved ASI by +0.35 y). Fitted by `calib.ts --fit-leader` (bisection
on SC, then a grid over the worst |Δ|/tolerance over SC…last): **ai2027 0.083, authors2026 0.063, fast 0.085,
slow −0.029, sampled = ai2027**. At 0 the leader hit SC 0.12–0.13 y early (fast A2→SC, its stream lag drops at A2)
and ran SC→ASI ~30 d slower than RefBot (no P05/P13/P17 adoption), so one constant trades SC against ASI.

**T1L** (calib.ts, leader on, passive player, endings skipped; SC and later bind, A1/A2 printed):

| preset | SC | SAR | SIAR | ASI |
|---|---|---|---|---|
| ai2027 | −0.044 | −0.008 | +0.033 | +0.068 |
| authors2026 | −0.038 | +0.008 | +0.038 | +0.055 |
| fast | −0.038 | −0.038 | +0.019 | +0.055 |
| slow | −0.003 | — | — | — |

**Gates.**
- Typecheck (app and scripts) clean. test:v2 scripts individually: golden-timelines, identity, calib (T1 unchanged,
  T1L pass), fixtures, lint-hidden, lint-ux, lint-tradeoffs, safety, finance, ws4, money pass. Known baseline
  failures unchanged: hygiene absolute perf budget; worldfx HireRate_SOFT (2027-03-21).
- Flag off identical: ref-trace output byte-identical to the run at bcfdb22 (same 6 pre-existing excesses); bots
  (40 seeds) give exactly R3's table; all six §7.4 criteria MET.
- Hygiene: two leader-on newGame setups (ai2027 default; authors2026 / 3 maverick rivals): plain JSON, 5/4 rivals,
  relation counterparties, leader appended last, start model = V0 = its reference frontier, compute = refTotal, staff
  = hRef, bindingness ≤ 0.3, and 'world' draws / hidden world / sampled rivals / China / player identical to the flag
  off. Save round trip with the leader (400 + 100 days) hash-equal.
- **Performance.** Flag off: no regression (separate processes alternated with a baseline worktree at bcfdb22 on a
  loaded machine: daily 2.88 ms base vs 2.91 ms R2, mean of 6). Leader on: its own cost, measured on one day-200 state
  ticked with and without it (paired, alternated), is **+8–12%** (≈ +250–300 µs/day: production +110, rivalsChina
  +70, revenue +40, worldDaily +20). Hygiene has a second performance case (leader on: absolute budget, plus this
  paired cost ≤ +20%; last run +11.8%). Whole-game comparisons overstate it (the passive player is overtaken and
  the game ends unless endings are skipped). Per-sector share caching in worldfx/mix.ts was not added: the mix grows
  by ~20 µs per provider and its inputs (approval → brand, robots → PHYS cap) change daily, so an exact cache would
  rarely hit; the cost is in the extra lab's best-mix search and labDaily.
- `npm run test:ui`: 126/126 (new: a leader-on game shows the Polaris AI race lane on Overview and the Relations row;
  screenshots 50/51 checked). The Overview lane tooltip calls it "The frontier leader".

**Notes for R4/R9.**
- D1: nothing forces `leaderLab` off for `start: 'leader'`; R9 must set it from the start type (on for spinout,
  challenger, big-tech; off for leader). T1L runs it with the leader start's player only as a passive bystander.
- With the leader on, a passive or slow player loses to `overtaken` (the leader reaches SAR first) and the leader
  earns market revenue the player would; R9 bots and difficulty labels must be run with the flag on.
- The leader carries reference tech implicitly (no paradigm/tree adoption). If R4 makes the tree change RefBot's
  speed, refit LEADER_CAL (`calib.ts --fit-leader`, ~10 min) together with CAL_SHIFT.
- If the leader's cost matters later (R10 budget), memoise its best research mix (inputs are reference) or move
  part of `labDaily` (hazards, pressure) to a slower cadence.

## R3 Teams and roles (2026-11-16, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R3, STRUCTURE §4.1, research/19 Part 1.

**State.** `PlayerLab.teams: Team[]` (`role` eng/re/sci, `dept` cap/saf, fixed `size` 150/100/40, fractional `heads`,
`quality` solid/strong/elite, `specialty?: Column` for science, `name?`, `projectId?` for R4), `stars`, and
`hiring: TeamHiring { targets: Record<TeamKey, n>; candidates; filling: Team[]; nextId }` with `TeamKey` =
eng · re.cap · sci.cap · re.saf · sci.saf. `staff.cap/saf` (all arrived heads by department) and the player's
`tasteHire` are derived by `syncTeams` after every roster change, so every existing reader works. Rivals and China
are untouched. New RNG stream `'company'` (owner WS1; hygiene table updated).

**Data `src/data/v2/teams.ts`.** Sizes; `REF_ROLE_SHARE` .30/.55/.15; safety split 90/50; `QUALITY` (output/cost:
solid 0.8/0.8, strong 1/1, elite 1.25/1.6); cost per person (cap 0.70/0.80/1.00, saf RE 0.65, sci 0.80);
`HIRING_BASE` per department lane (cap 15/wk, safety 3/wk, as before); start teams (classic 4 · 11+1 · 8+2 = 2,020
capabilities + 180 safety; reality 5 · 13+1 · 9+2); start specialties; offers (one a week, 4 weeks, ≤ 4).

**Engine `departments/teams.ts` (replaces staffing.ts, deleted).** Weekly `hiring` system (same id/order): attrition
off heads; one new offer from `'company'`; keep-hiring policy queues one standard Strong team per key while teams +
queued < N (never lays off); per lane the weekly hires go first to vacancies (in proportion to each gap), then to
queued teams by weight (heads to go + the key's unqueued deficit), leftovers in queue order; a team arrives when full.
FIFO filling was tried first: in a short lane it hired roles in equal team counts (34% RE instead of 55%) and the slow
preset's late h fell 5% below R1; the weighted fill fixed it. Player `H = Σ RE_cap heads × quality / 0.55` in
`labInputs` (so h = RE_cap/(0.55·H_ref); paradigm FTE and the E12 sideline still apply). `τ_h = 1 + Σ_capSci
heads·(q−1)/(0.15·H_ref) + 0.05·stars`, clamped 0.5–1.5 (exactly 1 for Strong teams, so identity holds). Payroll =
Σ heads × role cost × quality cost over teams and queued teams (`payrollOf`; cashflow, runway and Finance use it;
start $1.75B/yr vs $1.74B before). Readouts only: `buildCapacity` (eng heads/150 × quality × min(10, 1/(1−A_eng))),
`aiShareByRole` (A_eng = 1−(1−A)², RE 1−wH, sci Φ(sdAI)). Staff changes from events and actions (poaching, E16 let
go, E22 absorb, E32 acquire, down-round attrition) go through `changeHeads`: losses come off every team of the
department in proportion; gains fill vacancies, then form whole Strong teams in the reference split.

**Actions** (`departments/teamActions.ts`): `teams.hire` (an offer, or a standard team by key; queued ahead of
policy teams), `teams.release` (arrived or queued team; morale −1 per 1% of the department, max 15; lowers the
target), `teams.move` (RE team cap↔saf; safety→cap −5 safety morale; targets follow), `teams.target`. `hireTarget`
removed; `starHire` now adds a star. Registry verb tags updated. `teamGain` gives each preview's gain (build capacity,
research speed via h or taste, safety staff).

**RefBot** (D2): monthly targets `round(share·H_ref(yr+0.12)/size)` per role; the safe bot's safety staff share is
split 90/50 into RE/science teams.

**Save.** `SCHEMA_REV` 5. Migration 4 → 5 (cheap): headcounts plus the old pipeline become whole Strong teams in the
reference split (leftover people as vacancies), targets from the old headcount targets, stars from τ_h, `'company'`
stream seeded. Checked on the three rev-4 fixtures (load, tick 30 d). Fixtures regenerated at rev 5.

**UI** (Company › People; good-ui pass, screenshots checked). Teams card: payroll / morale / safety-morale chips
(homes `payroll`, `morale`, `moraleSafety`), engineer pile with build capacity, RE piles (capabilities with h,
safety) with Move / Let go, scientist cards per team (specialty icon, quality dots, people, let go), taste and Star,
AI share per role (home until R7's lanes), move-cost rule in the footer. Hiring card: talent pull, keep-hiring
steppers per key, filling queue with progress and ETA (cancel), offers with cost, ETA, expiry and a gain chip
(taste chips are red for Solid science teams). AI labour card kept (agent lanes are R7). New glossary terms: team,
roleEng, roleRE, roleSci, teamQuality, specialty, buildCapacity, keepHiring, hiringQueue, teamOffer, moveTeam;
payroll, researchTaste, headcount, weeklyHireCap rewritten; hiringTarget/hirePipeline dropped. New icons for roles,
columns and team verbs.

**Results.**
- `npm run typecheck`, `tsc -p scripts/v2`: clean. Identity and golden timelines unchanged and passing.
- test:v2 scripts individually: golden-timelines, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs,
  safety, finance (payroll), ws4, money pass. Known baseline failures unchanged: hygiene absolute perf budget,
  worldfx HireRate_SOFT (2027-03-21, same value).
- **Calibration:** T1 within tolerance on all presets with the existing CAL_SHIFT (no refit): SC 633 vs 634 (ai2027),
  1475 vs 1476 (authors2026), 858 vs 859 (fast).
- **ref-trace** vs the R1 reference: mean h +0.5% (ai2027 stub), −0.2% (authors2026), +0.5% (fast), −0.3% (slow),
  +0.4% (integrated); milestone days within 2 d (SC slow +2 d); runs and paradigm adoption 0 d; revenue/cash within
  1.2%. The tool now has a `mean h` category (±1%) and a monthly h tolerance of one team (10%): h steps by whole RE
  teams (start h₀ = 0.976, D2). Remaining monthly-series excesses are expected and not gates: pa after SC (absolute
  0.1 tolerance on values 20–1,500; worst 3.3 on 1,465), slow-preset k 6.7% and sdAI 0.12 in its last month.
- **Performance** (hygiene §8 loop, seed 9, 3 reps per run, baseline worktree at 737475e and R3 alternated twice on a
  loaded machine): daily tick 3.39 ms (R1) vs 3.49 ms (R3) mean, +3% (within noise); worst quarter 14.7 vs 13.4 ms.
- `npm run test:ui`: 124/124 (new: science cards per team, piles, keep-hiring +/−, policy covers the target after a
  week, offer hire, cancel, move with the safety-morale cost, let go; action loop 120 changed, 0 rejected).
- **Bots, 40 seeds:** all six §7.4 criteria MET.

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 2.5% | 7.5% | 90.0% | 806 | asiTakeover 55%, ousted 20%, nationalized 10% |
| safe | 2.5% | 0.0% | 97.5% | 1490 | overtaken 57.5%, ousted 40% |
| mixed | 52.5% | 5.0% | 42.5% | 1019 | asiAligned 52.5%, asiTakeover 12.5%, nationalized 10%, ousted 10% |
| capex2x | 2.5% | 0.0% | 97.5% | 304 | insolvent 92.5% |
| ref | 17.5% | 2.5% | 80.0% | 981 | asiTakeover 40%, asiAligned 17.5%, ousted 15% |

Choices vs world (final Mis): bot policy 66%, world 21%, rest 14%.

**Deviations / deferred.**
- `hiring.filling` is a list (one lane per department) rather than a single `filling?`; the policy hires standard
  Strong teams (offers are the player's way to buy Solid/Elite teams and specialties), so RefBot stays at τ_h = 1.
- RE team quality scales H (Elite RE ×1.25 labour); the plan only said `reCapHeads/0.55`.
- Safety science teams do not affect τ_h; scientists' headcount does nothing until R4 projects (UI says so in the
  taste tooltip and the role glossary).
- A temporary baseline worktree for the perf and uitest comparisons is left at
  `%TEMP%/r3perf/base` (detached 737475e) with a `node_modules` junction to this worktree: removing it was denied.
  Remove the junction with `rmdir` first (never a recursive delete), then `git worktree prune`.
- BUILD-PLAN.md's parallelism change in the working tree (user's) is left uncommitted.

**Notes for R4.** Science teams carry `specialty` and `projectId`; R4 sets progress from Σ size × quality (×1.5 on
match). Paradigm FTE is still subtracted from H (R4 removes it; expect h +~2–4% and a refit). `fillWeeks`,
`laneWeights`, `teamGain` are the UI helpers to reuse. The build-capacity readout is ready for R5.

## R1 Baseline, bugs, scaffolding (2026-11-16, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R1.

**Bugs (LIMITS B1–B5).**
- **B1/B2 commitments:** `actors/commitments.ts` gains `DEPLOY_SCOPE` (which predicates can block a launch, on which
  channels), `deployClause` (the clause a candidate breaks) and `commitmentDeployBlock`. `models/deployments.ts
  deployGate(s, v, channel, {safeguards, usagePolicy})` judges the candidate only against in-scope commitments; the
  reason reads `Blocked by "<title>": <clause>`. Out-of-scope commitments (pause pledge, incident reporting,
  whistleblower, community pledge) never block launches; `PREDICATES.noDeployAbove` checks the candidate when given
  `versionId`. A swap is judged with the live deployment's safeguards and usage policy; a new government deployment
  starts with the usage policy that live usage commitments require (`committedUsagePolicy`). Standing predicates
  (E30) are unchanged.
- **B3:** one AI-labour gate `safety/agents.ts aiLabourGate` (measured L ≥ AUTOMATE_MIN_L) used by Automate, Safety
  agents (a below-gate model is a locked option in the picker and rejected by the action), investigations
  (`openInvestigation` with AI labour) and the fleet itself (no AI FTE below the gate; the card says so).
- **B4:** `security.ts WSL_TARGET_RANGE = [2, 5]` used by SEC_TARGET and the Company › Security slider.
- **B5:** `deployments.ts effortLock`; "deep" is a locked option with its reason in the Deployments effort picker
  (`Seg` options take `locked`).

**LIMITS removals (no calibration change).**
- Company UI caps: the hiring target is a number field (no `max(200, 3× staff)`); top-level split and data-generation
  sliders go 0–100%. The manual research mix keeps 2–98%, now as one engine range `split.ts MANUAL_MIX_RANGE`
  (= the Auto best-mix search range; at 0% or 100% the production function gives NaN or M = 0), used by `fromSpec`
  and the slider.
- Pool share: `runs.ts POOL_SHARE_RANGE = [0.1, 1]` for the engine clamp (was 0.01) and the run designer slider.
- `split.ts setSplit` no longer rejects (2% training with runs, 3% serving with products). `runs.ts runStall`: the
  run queue shows "paused: no training compute"; products with no serving show capacity-bound (revenue readout, as
  before). The Split card warns before applying a zero training or serving share.
- `equity.ts`: a round repriced into a down round is no longer pulled (runway ≥ 4q) or closed (runway < 4q) silently.
  It becomes `finance.ws3.repricedRound` with an alert; the Finance raise card shows it with **Accept down round** /
  **Pull** (`fin.acceptRepriced`, `fin.pullRepriced`); undecided after 30 days it is pulled; no new raise meanwhile.
  Bots: the finance autopilot applies the old rule (accept if runway < 4q, else pull) on the same day.

**Scaffolding.** `SetupV2.start: 'spinout'|'challenger'|'bigtech'|'leader'` (default 'leader') and
`SetupV2.leaderLab` (default false); `newGame` fills them for older callers. Optional `EngineSystem.system`
(`StructureSystem`) and `ActionDef.verb` (`ActionVerb`) + `system`, filled from tables in `core/registry.ts` for 27 of
29 systems (security and index left) and the obvious actions (models, departments, safety, finance; relations,
security and most world actions left for R10). `SCHEMA_REV` 4: migration 3 → 4 sets `setup.start='leader'`,
`leaderLab=false`.

**Tooling.** `scripts/v2/ref-trace.ts`: `--write` records `scripts/v2/golden/ref-trace.json` (stub:ai2027,
stub:authors2026, stub:fast, stub:slow: refPlay + reference-compute stub, seed 2027, to the last golden milestone;
integrated:ai2027: full RefBot, real finance, to ASI). Per trace: run start/finish days, paradigm adoption days,
milestone days, monthly M, h, k, c, sdAI, pa, best L; quarterly revenue per channel, cash, U. Without `--write` it
diffs against the file with tolerances (milestones ±10 d, adoption ±14 d, runs ±7 d, M/k/c ±5%, h ±1%, sdAI ±0.1,
pa ±0.1, L ±0.15, revenue and cash ±10% (integrated only), U ±0.25; `--tol key=v,…`, `--only id,…`) and exits 1 on
any excess. About 60–90 s.
- **Before/after B1/B2:** recorded from a temporary worktree at 1be9dd6 (since removed) into `ref-trace-pre-r1.json`
  (left untracked in scripts/v2/golden/: deleting it was blocked by permissions) and after the bug fixes. The traces
  are **identical**: RefBot never meets a binding commitment on these seeds. With the LIMITS changes the diff is still
  zero on all five traces. `ref-trace.json` (recorded after B1–B5, before the LIMITS changes) is the reference for R3+.

**Tests.**
- `npm run typecheck` and `tsc -p scripts/v2` clean. New checks: ws4 C1 (B1/B2 scope and clause), safety B3, finance
  R1 repriced round (waits, no raise meanwhile, accept books a down round, pulled after 30 d).
- test:v2 scripts: golden-timelines, identity, calib, fixtures (regenerated, schemaRev 4), lint-hidden, lint-ux,
  lint-tradeoffs, safety, finance, ws4 and money all pass. **Known baseline failures (pre-existing at 1be9dd6):**
  hygiene performance (absolute 1.5 ms budget; machine load) and worldfx "Jul 2027 (±3 mo): HireRate_SOFT ≤ 10% —
  2027-03-21" (same value as at baseline; not touched).
- **Performance** (hygiene §8 loop, seed 9, 1,500 days; baseline and R1 alternated on the same loaded machine):
  daily tick 3.68 / 2.75 / 3.09 ms at 1be9dd6 vs 3.26 / 2.94 / 2.63 ms at R1 (mean 3.17 → 2.94); worst quarter
  13.3 → 13.5 ms (+1.5%, noise). No regression.
- `npm run test:ui`: 116/116 (new: hiring above the old cap, WSL range 2–5 and set at 2, zero-training split
  applies with a warning, run queue "paused: no training compute", deep effort locked with its reason). Screenshots
  checked (Deploy effort lock, Company people field).

**Bot baseline (200 seeds; `bots.ts --seeds 50 --from 0/50/100/150` merged with `--load`, same seeds as one run):**

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 3.0% | 8.5% | 88.5% | 818 | asiTakeover 56%, ousted 17%, nationalized 7.5%, chinaAligned 5%, chinaTakeover 5% |
| safe | 1.0% | 1.5% | 97.5% | 1462 | overtaken 62.5%, ousted 34.5%, chinaTakeover 1%, asiAligned 1% |
| mixed | 52.0% | 6.0% | 42.0% | 1040 | asiAligned 53.5%, asiTakeover 12.5%, ousted 12.5%, nationalized 9.5% |
| capex2x | 1.5% | 1.0% | 97.5% | 304 | insolvent 91.5%, asiTakeover 2.5%, ousted 2.5% |
| ref | 17.0% | 5.0% | 78.0% | 990 | asiTakeover 38.5%, asiAligned 17.5%, ousted 13%, chinaTakeover 10%, nationalized 9.5% |

§7.4: all six MET (race win 3.0%; race losses 72% takeover / 28% company-loss; safe win 1.0%; safe losses 64%
other-first; mixed win 52% and +49 pp over both extremes; passive takeover-type 66%). Choices vs world (final Mis):
bot policy 63%, world 23%, rest 14%. E5: 14/17 endings (war, acquired and retired only in the forced-state test).

**Deferred / for the next milestones.**
- Structure tags are partial; R10's lint-structure must fill security, index, relations and world actions.
- `PREDICATES.preDeployTesting`'s candidate branch is no longer used by deployGate (deployClause covers it); kept for
  callers that pass `versionId`.
- The serving-share range (engine 2–100%, UI 0–80%) is left for R6 (gone with the Auto serving split).
- Bot result JSON stays in the session temp dir, not committed.

## Cash projection, LTA fixes, event cut (2026-11-15, branch `cash-events`, worktree ../AI27-cash)

Per the user's decisions after a playtest ("LTA buys one quarter", "event spam", "flush at 15q, then 1q next quarter"):
- **Runway = cash projection** (`finance/runway.ts`): the rest of this quarter plus 8 quarters. Each known payment
  sits in the quarter it falls due: ledger between `startDay` and `endDay`, chip balances at delivery, site capex on
  its build schedule, unconditional tranches when they land, debt maturities only when the market is closed. Revenue
  is held flat at today's run rate. Runway = quarters until liquidity (cash + undrawn revolver) falls below minimum
  operating cash (one month of running costs), capped at `RUNWAY_CAP` = 8 ("8q+"). `burnQ`/`parts` are 4-quarter
  averages of the same flows; `path`, `low`, `floor`, `zeroDay` feed the top-strip tooltip and the Finance cash chart.
  The zones (distress < 3q, tight < 6q) are unchanged. The old ratio blew up near break-even (99 ↔ 3q in 30 days) and
  smeared lumps over a sliding 4-quarter window.
- **LTA bugs:** ledger entries now have `startDay`, so an LTA pays from its first tranche (it paid from signing: 10
  payments for 8 tranches). Cloud contracts pay from their start, colocation leases from handover. A finished LTA leaves
  the order book. Orders › Deliveries shows every future LTA tranche (it showed only the current one).
- **Events 37 → 15.** Dropped (a regular mechanism does it, or a nag): E02–E09, E11, E13–E15, E18, E21, E24, E26, E28,
  E31, E33–E36. Kept: E01, E10, E12, E16, E17, E19, E20, E22, E23, E25, E27, E29, E30, E32, E37. Requests now obey
  cooldowns (the leak fired ~2.3×/game "once"); `onceKey` makes E17 fire once per red flag; E16/E19/E37 cooldown 365.
  Side effects that used to go through dropped events: copyright suits settle automatically (china.ts), a Taiwan crisis
  is a headline, a whistleblower-channel report is handled internally (security.ts). E22/E32 previews no longer promise
  compute they never delivered. Bots: ~11 decisions/game (was ~51), about one per quarter.
- **Known:** bots size chip orders without the projection, so their runway swings (order → 1q → raise → 8q+) are real.

## Compute tab redesign (2026-11-15)

Per `design/ux/COMPUTE.md`: Overview (verdicts, capacity and fleet forecast, order chips / build data centre / rent
cloud with fixed sizes and folded options), Sites, Orders, Market tabs. Engine: `compute/forecast.ts` (`chipFit`,
`computeForecast`, `siteLiveQ`, `computeHistory`, quarterly `computeHistQ` snapshots in `finance.ws3.computeHist`); `idleChips` now counts only chips with no rack space (chips in the one-quarter install
lag are "installing"). Size tables `SITE_TIERS` / `CHIP_TIERS` in `data/v2/deals.ts`. The idle watch alert still opens the
Compute tab (user: no concrete fix action). Not touched by request: opening chip order, Lone Pine, Act 1 unlocks.
`npm run test:v2` and `uitest` (104/104) green.

## Compute split, staff and safety agents restructure (2026-11-15, branch `compute-split`, worktree ../AI27-split)

Per the user's decisions:
- **Staff:** only capabilities and safety. Security, product and ops staff are gone (nothing read them).
- **Compute split:** four top-level shares: Training (with a data-generation sub-share), Research
  (experiments + agents, Auto best mix by default or Manual), Serving, Safety. The security pool is dropped: AI 2027 has
  no such line, and its 1% went to synthetic data (serving pushed revenue and adoption past their targets). The 35% agents cap is removed.
- **Calibration:** a normalising factor X(1,ℓ_ref)/X* (taste curve unchanged) makes a reference lab with the *best* research mix hit multiplierAt
  (`refBestX`). All labs re-split experiments vs agents daily (`applyBestMix`). Synthetic data no longer multiplies the
  research rate; it is a training input (data stock and data wall).
- **Safety agents:** a fleet on a share of the safety pool, on a selectable model. AI labour scales with fleet AI FTE,
  capped by the old multiplier. Sabotage uses the safety model's traits. `safety.agents` action;
  `safetyUtilisation` selector.
- **UI:** Company › Compute split (four sliders, data sub-slider, mix Auto/Manual, mix chart, response curves); People
  (two roles; the "AI FTE · human FTE" bug is fixed); Safety › Agendas (department load, safety agents card with model
  picker, a per-agenda Automate that now passes its agenda).
- **Bug:** the AG17 threshold now uses AG17_MIN_L = 10 (separate from AUTOMATE_MIN_L = 8.5), both on the safety
  agent model.
- **Save schemaRev 3:** migration 2 → 3 moves the old security share into synthetic and drops the removed staff roles.
- **Tests (uncommitted):**
  - test:v2 suites all pass except the hygiene tick timing (2.0–2.3 ms vs 1.5). It is machine load: in the same session
    base af31d62 measured 1.37–1.59 ms and also failed once. A profile puts the new mix search at about 70 µs/day.
  - uitest 108/108. Its speed-4 alert check now runs from the day-400 fixture: the day-900 fixture's game ends within
    days.
  - bots (40 seeds): all six §7.4 criteria MET (base: 5/6 at 40 seeds), outcomes within noise.
- **Known shift:** with synthetic data out of the research rate, small labs lose their old d^0.15 handicap. China is
  slightly faster: T3 lead before theft is 83 d vs 88 d on base. In the fixture seed China reaches SC level with the
  player, and DeepCent leads by 49 d at day 900. Retune `CHINA_CAL.effScale` if that is too strong.

## Handoff for the next session (2026-11-15)

The session that built v2 ended here. Start new work from this section.

**State:**
- v2 is the only game: `npm run build` → `dist/index.html` (no `?v2` needed). v1 was removed 2026-11-15 (in git history before that date).
- Last playable snapshot: `play/ai27-v2-2026-11-15.html` (gitignored).
- `npm run test:v2` (about 15 min), `node scripts/v2/uitest.mjs` (after `npm run build`), `tsc` and the build all pass.

**Known open items:**
- **Hygiene tick timing** sometimes fails (2-3 ms per day vs a 1.5 ms target). It looks like machine load; re-measure on an idle machine.
- **UX gaps:**
  - an Understanding "why it moved" ledger;
  - linked-element highlight on hover;
  - signal overlay on the trait graph;
  - per-sector history and replay in World;
  - quarter-recap causes beyond cash;
  - price sparklines after a save import.
- **Deployments panel:** cannot edit a live deployment's price, safeguards or usage policy (no engine actions yet).
- **Balance margins are thin:**
  - race wins 4% vs a 5% cap;
  - S4 is near its ceiling.
- **Balance issues not yet fixed:**
  - RefBot insolvency in the slow and authors2026 worlds;
  - nationalization at 10-15% is the largest non-AI loss.
- **v1 removal (done 2026-11-15):** v1 engine, UI and scripts deleted. v2 still shares a small core outside `v2/` folders: `data/world.ts` (calibrated timeline maths), `data/actors.ts`, `data/glossary.ts` (base terms), `engine/rng.ts`, `engine/types.ts` (World types). The v1 stylesheets live on as `ui/v2/base.css` and `ui/v2/layout.css` (the start screen and shared controls use them).

**Housekeeping:**
- The merged agent branches `worktree-agent-*` and the `refs/wip/*` snapshots still exist; all of their content is on master. Deleting them was blocked by the permission settings. They are safe to delete: `git branch -D <name>`, `git update-ref -d refs/wip/<name>`.
- `.claude/worktrees/agent-a48574afd3ee0d110` is unregistered, but its folder was locked; delete it manually.
- `research/_scratch` (gitignored) and the scratch folders outside the repo can also be removed by hand:
  - `C:\Users\david\scratch_ai27`
  - `C:\Users\david\m4scratch`
  - `C:\Users\david\ai27-ux-scratch`
  - `C:\Users\david\scratch\ux`

## M5 UX status (2026-11-14)

The user approved the UX direction in `design/ux/`, with four binding rules:
- information hierarchy (a thin first glance);
- one home per datum;
- permanent areas hold top-level items only;
- a tooltip for every term.

**Step 1: information architecture** (0af3dcd).
- `design/ux/IA.md` defines the levels:
  - L0, 7 items: time, race, catastrophe risk, cash·runway gauge, nearest lead, nav, queue;
  - L1, the Overview: lead track, race history, Watch, plus Goals while the tutorial runs;
  - L2, panels;
  - L3, tooltips and the Codex.
- It also holds the datum→home table, the drill-down paths and the DOM markers (`data-home`, `data-ref`, `data-term`) that uitest checks.
- The right rail goes. Its blocks move to Company (research speed), Runs (next-model gates), Relations (obligations) and the Overview lead track.
- Mockup: `design/ux/mockups/01-main-v2.png`, with its source `main-v2.html`.

**Engine** (beeb0e0).
- B1: `measuredLOf` gives a lineage fallback while a version is in evaluation. The new `internalEval` selector returns the level and an evaluating flag.
- B6: E01 now names the version, the trait and the recipe cause.
- `scripts/v2/lint-ux.ts`, added to `test:v2`, checks:
  - an agent-switch regression;
  - glossary link resolution;
  - that every `Term` used in the UI resolves;
  - the required terms.

  `--doc` writes `design/ux/GLOSSARY.md`.
- The glossary now has 258 entries (202 new).

**Shell** (checkpoint 2).
- New modules: `fmt.ts`, `theme.ts` (validated palette), `icons.ts` (one icon per concept), `kit.tsx` and `kit.css`. The kit has Card, Tabs, Gauge, CauseChain, GoBtn, Ref, Pill, OptionTile, ActionCard with before→after bars, and KV.
- Store: `goto(panel, {tab, anchor})` pulses the target control; the quarter recap; `panel:` visit flags.
- Top strip (L0): race meter, risk gauge, cash with a live runway gauge and a "flips at review" tag, nearest lead, help and menu.
- Nav is grouped with badges.
- Bottom bar: ring timers, one alert chip and one headline.
- Overview (L1): lead track, race history, Watch (`shell/watch.ts`, 8 rules), Goals.
- Onboarding: coach spotlight, quarter recap and a help overlay.
- Decision modal: why-chain, ActionCards, lasting fixes, keys 1/2/3.
- Company panel (Flow · People · Split · Security) replaces Departments.
- The right rail is gone. `shell/RightRail.tsx` and `Ticker.tsx` remain unused; deleting them was blocked by permissions.
- **Known:** the fixture series predate B1, so their race history shows the old U dips.

**Panels** (1917b2b, 6c9f10f, 01ef15f, e3f1c9f, 00cf2b8, dc7634e, 3084338, ba34ba7).
- *Safety lab:* tabs Graph · Agendas · Tools · Incidents · Findings.
  - Graph: a layered pill graph with upstream highlight and an evidence card.
  - Side cards: a detection heat grid and the misalignment band.
  - Agendas use a single pip control per agenda.
  - Tools show strength-vs-level curves.
- *Run designer:*
  - OptionTiles carry effect glyphs from `runCard` and `runTraitPressure` sweeps.
  - Panels: level ruler, radar against the internal model, "what this recipe pushes", main path, a compare strip, and next-model gates as their home.
- *Finance:* vertical waterfall, cash history with projections, raise limits with an ask slider and pills, locked-in spending, board, ownership donut, debt tiles, deals.
- *Compute:* sites as a build timeline, order rows, deliveries.
- *Deploy:* demand vs capacity per channel.
- *Risk:* Sources (ranked bars) · Flows (the old map).
- *Models:* radar against the parent, headline benchmarks, actions in groups.
- *Relations:* header stats.
- *World:* fixes (F is feasibility; tiers; unemployment shown once).
- *Setup:* blocks a company name equal to a rival's.
- *New read-only selectors:* `detectionGrid`, `techniqueCurve`, `versionSignals`, `runTraitPressure`.
- *uitest:* 104/104. It now checks:
  - every tab;
  - the IA rules: one home per datum across screens, every term resolves, no raw floats;
  - coach, decision cards, Watch Go, lead track and hover shots.
- *Remaining gaps:*
  - Overlay of the next run's signals on the trait graph.
  - The radar does not circle dangerous capabilities.
  - B2 (U "why it moved" ledger) and B7 (sector/pool history) are not built. The race tooltip uses technique decay and masks instead.
  - Quarter-recap causes are cash only.
  - Prices sparks are empty after a fixture import.
  - Causal highlight (`.lit`) is not implemented.
  - The obsolete `RightRail.tsx`, `Ticker.tsx`, `RiskMap` overlay, `Departments.tsx` and `TraitGraph` remnants may still be on disk.
- *Tests (2026-11-14):*
  - Pass: `tsc`, build, uitest 104/104, v1 sim, and the whole `test:v2` chain (golden, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs, safety, finance, worldfx, ws4, money).
  - Fails: hygiene's timing checks only (3.0 ms daily against a 1.5 target). The pre-change commit 0b671ff measured 3.4 ms on the same machine in the same session, so this is machine load, not a regression.
  - The E01 text was shortened to the 220-character limit.

## M4 status (2026-11-14): checkpoint 2 — choices drive misalignment, all §7.4 bot criteria met

**Diagnosis (paired seeds, new harness diagnostic).** Race − mixed ΔMis ≈ 0. Mixed ended as misaligned as race because it spent longer drifting.
- *Critical traits saturated for every lab.* EA ratcheted to 1, which blinded behavioural removal. TGAME had no removal, and crystallisation at TGAME > 0.5 cut all removal ×0.3.
- *Run design missed the index.* It moved only SYC/RH/PERSONA/OBF, which barely enter Mis.
- *Fix techniques never entered a run.* `postFromParams` always set `techniques: []`.
- *U started ~6 levels above L* (day 55: U 10.9 vs L 5.2).
- *The world draw was wide.* Edge σ up to 1.2 and D unbounded.

**Changes** (spec §2.3, §3.5.4–3.5.9, §9 row 26; all [D]).
- *Equilibrium framing.* x* ≈ G/(G + R), with both terms set by play.
- *Removal sees what the stack sees.* Removal is gated by TRUE stack detection (`stackDetectionMap`). Agendas, techniques and refreshes therefore lower TRUE traits. Masks and decayed tools also cost healing, so masking stays a trap.
- *AG18 heals blind.* Generalising alignment training (H: e_AG18 × funding × constitution × safety level) works even when the stack cannot see.
- *Trait fixes.* EA relaxes 0.3 per post-run. TGAME is removed through detection only.
- *Persona edges.* E27–E29 (PERSONA → AF/SCHEME/POWER; MacDiarmid 2025, Betley 2025) let grader quality, RL intensity and inoculation reach Mis.
- *Fix techniques run.* An unlocked fix technique applies to every post-run while its agenda is staffed.
- *Lab-wide patches.* Signal patches apply to every later run (floor ×0.2).
- *Fleet inheritance.* A new base starts κ = 0.4·(1 − 1/M) of the way to the internal agent's traits, so it no longer resets a racer.
- *CoT penalty.* OBF enters the COT penalty.
- *U projection.* A validation lead by agenda funding and EA projected with capability. U now starts ≈ L + 1.7, and the mixed bot raises safety compute from about day 240.
- *Drift from the true gap.* L − U_true is sampled weekly into `ws2.gapTrue`. Believed U was optimistic out of ignorance.
- *Removal levels.* Standard 0.45 → 0.55 and heavy 0.75 → 0.8. HEAL_K 0.35.
- *World bounds.* Edge factor σ ×0.5, kept within [½, 2]. D within [0.6, 1.65]. DIFFICULTY_SCALE 1.2 was tried and reverted (it broke S4).
- *Harness.* `bots.ts` prints the choices-vs-world diagnostic: a two-way variance split of final true Mis (bot vs seed) on paired seeds, per-bot R² on λ1–λ6 + ln D, and paired bot differences. `--from` / `--load` split runs across processes.

**Choices vs world** (200 paired seeds; race, ref, mixed, safe):
- Variance share of final true Mis: bot policy 66%, world draw 22%, interaction and noise 13%. For Mis − doomThreshold: 64% / 23% / 13%.
- Paired race − mixed: +0.56 Mis (sd 0.17); race is higher in 100% of seeds.
- Mean Mis: race 0.77, ref 0.55, mixed 0.21, safe 0.10.
- Per-bot R² on world features: 0.23–0.37.

Bot harness, 200 seeds:

| bot | win | mixed | loss | top endings |
|---|---|---|---|---|
| race | 4.0% | 6.5% | 89.5% | asiTakeover 53.5%, nationalized 15.5%, ousted 11%, insolvent 3.5% |
| ref | 19.0% | 4.5% | 76.5% | asiTakeover 41.5%, asiAligned 20.5%, nationalized 14.5%, ousted 9.5% |
| mixed | 53.0% | 7.5% | 39.5% | asiAligned 54.5%, nationalized 10.5%, asiTakeover 10%, ousted 9.5% |
| safe | 1.0% | 1.5% | 97.5% | overtaken 53.5%, ousted 44.5% |
| capex2x | 0% | 1.0% | 99.0% | insolvent 98% |

§7.4: all six criteria MET.
- Race win ≤ 5%.
- Race losses: 66% takeover and 34% company-loss.
- Safe win ≤ 5%.
- Safe losses: 54% overtaken or other-ASI-first.
- Mixed: 53%, which is +49 pp over both extremes.
- Passive takeover-type: 68%.

Other tests:
- S4: RefBot P_mis 0.818 (window 0.55–0.85), safe recipe 0.003.
- S5: holds.
- F7, F8 and T1: unchanged and passing.

**Remaining.**
- *Thin margins.*
  - S4 RefBot P_mis is 0.818 against a ceiling of 0.85: raising D or growth pushes RefBot out.
  - Race win is 4.0% (≤ 5%). Its wins are easy worlds at the D floor, plus rival-aligned "wins".
  - Safe overtaken vs ousted is ~54/45.
  - F8 distress-free is at exactly 75%.
- *Hygiene daily tick.* 1.38–1.72 ms across runs on this machine; target 1.5. HEAD measured 1.49 under the same load, and the M4 additions cost ~30 µs/day. The bottleneck is pre-existing (worldfx mix and sectors).
- *Late-game blindness hits everyone.* The true gap at ASI is 5 (mixed) to 9 (race) levels, so the gap multiplier is capped for both. Careful play wins through low growth (clean signals, patches, AG18) and accumulated state, not by seeing at ASI.
- *Not done:* RefBot insolvency in slow/authors2026; nationalization (10–15%), still the largest non-AI loss.

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
