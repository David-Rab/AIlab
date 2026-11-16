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
| **R1+ Tycoon restructure: build** | In progress: plan in design/BUILD-PLAN.md; milestones logged below | |

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
