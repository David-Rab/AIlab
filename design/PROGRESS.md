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
| **Tycoon restructure merged to master** | Done (2026-11-17): R1–R10 merged; typecheck and `npm run build` clean. Next: full jank audit | a82b5e8 |
| **J1 jank batch 1** | Done (2026-11-17, branch `jank-audit`, not merged): M1/M2 measured level and U, F1 cash causes, B1–B4, PR2–PR8, F2–F5, C1–C4, O1 (89.8% rendered tooltip coverage, lint), RL1/RL2 and the UI-only Minor/Polish list; slow calibration refit; all §7.4 criteria MET (40 seeds). J2 next: group A + engine Minor/Polish | jank-audit |
| **J2 jank batch 2** | Done (2026-11-18, branch `j2`, not merged): R2 spread auto-assign, P1 engineering load (runs → upkeep → builds; launches and sector packs on the queue), PR1 spare serving → research agents (RefBot headroom), AG1 same-lineage monitor collusion, RK1 risk lever what-ifs, R7 AI science on projects; tree efforts refit to master durations; schemaRev 11; all §7.4 criteria MET (200 seeds); open: safety S5 −0.95 and finance F2 44.9M | j2 |
| **R0 Tycoon restructure: design** | Done (2026-11-16): STRUCTURE.md, TECH-TREE.md, LIMITS.md, research/18–19, mockups-v3. Approved by the user | 168ef39 (branch `game-structure`, worktree `../AI27-structure`) |
| **R1 Restructure: baseline, bugs, scaffolding** | Done (2026-11-16): B1–B5, LIMITS removals, setup/meta fields, ref-trace tool, schemaRev 4; all §7.4 bot criteria MET (200 seeds) | "R1: commitment scope, …" on `game-structure` |
| **R3 Restructure: teams and roles** | Done (2026-11-16): fixed-size teams in three roles, h from capabilities research engineers, τ_h from science quality + stars, keep-hiring policy, offers, Company › People teams + hiring cards, schemaRev 5; no CAL_SHIFT refit; all §7.4 bot criteria MET (40 seeds) | "R3: teams and roles, …" on `game-structure` |
| **R2 Restructure: leader lab in the world** | Done (2026-11-16): simulated AI 2027 leader "Polaris AI" behind `setup.leaderLab` (default off), T1L passes with LEADER_CAL, `--fit-leader`; flag off identical (ref-trace, bots); no schemaRev change | "R2: leader lab …" on `game-structure` |
| **R4 Restructure: tech tree and capability projects** | Done (2026-11-17): 93-node shared tree, science teams on projects (√ capacity, ×1.5 specialty, absolute M), per-world rolls and retries, design-option locks, auto-assign, Research panel, schemaRev 6; fitted efforts; CAL_SHIFT refit (authors2026, fast, slow) and LEADER_CAL refit; all §7.4 bot criteria MET (200 seeds); one new worldfx failure (GOV accept) documented | "R4: tech tree …" on `game-structure` |
| **R5 Restructure: build queue and blueprint** | Done (2026-11-17): free base size (×¼…×8; minDays, S5, restart, serve ∝ √size as functions of size; BASE_MAX_DAYS gone), staleness and data readouts, proportional pool allocation, spare training compute → experiments (policy; RefBot → data), engineers' build queue with run setups, Blueprint panel, run queue share/ETA, schemaRev 7; ref-trace identical to R4, no refit; all §7.4 bot criteria MET (40 seeds) | "R5: build queue …" on `game-structure` |
| **R6 Restructure: products and live edit** | Done (2026-11-17): deployments become products (kind, price tier, mini free tier, monitor, features), live product.update with before → after preview (next tick, D7), launch/retire, features built once by engineers and switched on per product, Auto serving split (most $ per H100e first, cut recorded and shown), monitors (catch rate, D7 overhead, incident hook), auto-evaluate replaces the 30-day eval expiry, Agents time-horizon gate, upgrade-to-newest policy, Products panel, schemaRev 8; RefBot staleness fix (worldfx GOV accept passes again); spare training default → data; one calibration line (serve-cost exponent 0.5 → 0.3); all §7.4 bot criteria MET (200 seeds; safe win 1.0%) | "R6: products …" on `game-structure` |
| **R7 Restructure: internal agent packages and monitors** | Done (2026-11-17): four internal uses (engineering, routine research, frontier research, safety research), each model + optional monitor + compute; internalAgent → routine research, safety agent model/share → the safety package, monitoringShare → per-use monitors (standard package = today's 20% of the safety pool), per-agenda/case AI labour → one Trusted-to-AI policy (B3 gate, 50% cap until P27); evalM optional qTaste (frontier model's taste), k nets the engineering share, engineering agents set A_eng; Company › Agents at work lanes with before → after preview, shared package chips on Products, compute split moved to Compute › Split, Safety links; schemaRev 9; ref-trace identical to R6, no refit; all §7.4 bot criteria MET (40 seeds) | "R7: internal agent packages …" on `game-structure` |
| **R8 Restructure: safety on the tree** | Done (2026-11-17): safety nodes are projects for safety science teams (completion = one result from `fireFinding`, efficacy-driven type draw unchanged; a working result unlocks the node, other results restart it; follow-up project per line), funding levels / hazard / refresh projects removed, effort = T₁ at serious staffing (SERIOUS_CAP 4 team-capacity), line health from the Beta posterior, dead-end team-months and "promising lines idle", tool upkeep and validation lead from safety research engineers (no ×8 ceiling), investigations staffed by safety RE (5–40, 120 d shown), option locks from safety ideas, four risk-family aggregates, Safety panel (Overview / Research lines / Investigations / Trait graph / Incidents) replaces Safety lab, schemaRev 10 with migration; safety hiring lane 3 → 8/wk; all §7.4 bot criteria MET (200 seeds); bot-policy variance share 63% (below M4's 66%) | "R8: safety on the tree …" on `game-structure` |
| **R9 Restructure: start types** | Done (2026-11-17): data/v2/starts.ts (four starts: teams, known nodes, products, features, cash, compute, board, lag, modifiers, labels), buildPlayer(start) with model lag, spinout imported V0 (D6), big-tech parent budget (finance/parent.ts) with equity/deals/debt unavailable and no insolvency, `parent` board, leader lab per start (D1), knowledge diffusion from the leader lab (K 2.0, follower starts only), Setup start picker, big-tech Finance variant, bots --start with a follower plan, safe bot answers red flags; all §7.4 criteria MET (200 seeds), bot-policy variance share 73%; catch-up targets not met; labels lowered to the data (challenger Hard, big tech and spinout Impossible) | "R9: start types …" on `game-structure` |
| **R10 Restructure: UI completion and structure tests** | Done (2026-11-17): top strip revenue chip (users in its tooltip; Finance links to it) and "tools validated to" in the race tooltip; Overview "Your company" core-loop diagram (a verdict per system, links to homes); codex Structure (core loop, simulated-from-outside note, verb set) and Limits categories; 24-limit registry `data/v2/limits.ts` shown where each binds (`Limit`, `data-limit`, checked by uitest); research-speed limit lines (frontier methods you lack, serial cap, serve-cost clamp, pause, knowledge diffusion); `system` / `verb` tags required on every engine system and action (lint-structure); idle test (idle.ts) with idle serving compute in Watch; 23 new glossary terms; dead code removed; no engine behaviour change (ref-trace 0 deviation vs R9); all §7.4 criteria MET (200 seeds). Follower starts accepted as is (user decision 2026-11-17: measured labels kept, catch-up deferred) | "R10: UI completion …" on `game-structure` |
| **V0 Model v3: spec and calibration research** | Done (2026-11-18): design/MODEL-V3.md (physical-quantity rebuild of models, research, products, safety; AI 2027 as calibration only), research/20 (primary-source numbers). Approved by the user; build V1–V7 next, serial, branch `model-v3`, worktree ../AI27-model3 | (this commit) |
| **V1 Model v3: capability core** | Done (2026-11-18, branch `model-v3`, not merged): models from physical quantities (G = log₁₀ FLOP + recipe + shape + overtraining + repetition; RL curve; distillation and continue laws), no minimum lengths or restart roll, no F(t) sizes, no κ, no era table; bridges pm = Φ(G), e_stack from pa, serveCost, run scale, simple-lab credit; Blueprint in parameters × tokens; schemaRev 12. CAL_SHIFT and LEADER_CAL refit (all presets within ±0.06 y of golden over SC…last). Open: 4 new test failures (worldfx GOV T1 accept −6 d outside its window, W2 TFP 1.4%; ws4 T3 band 70–289 d, T3 post-theft lag); see "V1 Capability core" below | e4f10c3, 8763e8e, 9f871ae, (docs) |
| **V2a Model v3: research as ideas (engine)** | Done with open calibration failures (2026-11-19, branch `model-v3`, not merged): capability projects (lines, ideas, axes) with a lifecycle (ideation → small experiments → scale test → result → engineers' adoption), hidden per-world candidate truths, beliefs, taste, risk policy; recipe stacks (pretraining, RL efficiency + ceiling, training throughput, serving) with scale buckets and headroom replace the know-how bridge; pa is a readout; scientists by priority + teams wanted + swap pass; research engineers and engineers by needs with caps and overflow; content pass in TECH-TREE §6; schemaRev 13. **Stop condition hit (not forced):** authors2026 SAR −0.13 / SIAR −0.12 / ASI +0.38 y after refit; slow fits only with CAL_SHIFT 0.291 → −1.5. See "V2a Research as ideas" below | 34ad054, 881f64c, 6121e94, (docs) |
| **V3 Model v3: work types, AI labour, research speed, milestones** | Done (2026-11-19, branch `model-v3`, not merged; V3b follow-up the same day): work types with fit in effective compute, METR horizon on G, coverage, GDPval assist; physical AI labour in the AI Futures coding CES; research per project at the experiment CES of real FLOP and labour; lines as pools with returns r; team taste on the AIFM distribution; work-type milestones with per-preset G_SC, Δ_bm and (V3b) AIFM's AI taste at AC; display level λ(G) rebuilt on the work-type reference points for every lab (rivals aligned through a derived calShift); frontier G path on research/12's anchors (1.31 G/yr); build capacity = effective SWE labour; M a readout; lint; schemaRev 15 (V3b). **All four presets within the golden tolerances; T1L within tolerance after a LEADER_CAL refit.** Open: finance F7/F8 revenue (V4), see "V3" below | 1d365d6, b7e2591, 9840361, (V3b) |
| **V2b Model v3: research, recipe, allocations and AI labour (UI)** | Done (2026-11-19, branch `model-v3`, not merged): Research gets Projects (priority list: stage track ideation → small → scale → result → adoption, teams wanted, risk policy, drag/▲▼, add/remove/reopen; project card with belief band, odds, c/ℓ and what binds, line pool, teams and why), Recipe (stacks, headroom, not trained in, adopted ideas believed → realised) and Tree tabs; Company gets Work (effective labour per work type with fit vs median/best human, coverage, needs with caps/order/overflow, build capacity split, milestone criteria) and a rebuilt research-speed card; know-how bar, team picker, queue card, v2 ratios and the frontier-methods / serving-cost limits removed; 38 new and 31 rewritten glossary terms. Mockups design/ux/mockups-v3/v3-v2b-*. `npm run build` clean, `npm run test:ui` 257/257; `test:v2` only the known V3b failures (hygiene perf, safety S5 mixed, finance F2/F7/F8, worldfx GOV T1/W2, ws4 T3). Notes: design/V3-BUILD.md "V2b notes" | 0473815, ae38557, a9919cd, 58783d4, (docs) |
| **V4a Model v3: serving, products, sectors on work types (engine)** | Done with the finance stop condition reported (2026-11-19, branch `model-v3`, not merged): V4.0 default capability priority list for every start and immediate team placement; one cost chain (FLOP per token × tokens per hour of use ÷ utilisation × rental), prices = markup over own cost (budget/standard/premium margins 0.4/0.6/0.75) bounded by value, rivals and China at their own cost (FLOP per token from G, BRIDGE(V7)); customer stocks per segment (consumers 3 weeks, sectors a quarter, gov 0.75 y); sectors and consumer chat as work types on V3's coverage function, physical cost gate; typed features (enabler / horizon / scaffold / effort) for products and internal agents; revenue M^0.3, serveCost reads, price capture and the abstract cost curve removed; schemaRev 16. **Golden T1 in tolerance; W2 and W4 pass; finance F7/F8/F11 fail (2026 revenue $22B vs $45B, 2027 $18B vs $140B): cost-plus prices on the adoption the sector targets need give a ≈ $60B world market in 2026 — lead decision needed (V3-BUILD "V4 notes")** | 76e7c88, f5eed05, d1306ca, (docs) |
| **A2a Model v3: hours of use and value per hour** | Done (2026-11-19, branch `model-v3`, not merged): hours of AI use = firm task adoption A (unchanged, BTOS-fitted) + workers' assisted use h·(W − A), W a new Bass stock of workers using AI at work (research/22 §1, RPS by industry); hours saved per hour of use α_use + (1 − α_use)·g_aug with α_use = α·A/U; schemaRev 17. US hours of use 1.0% → 5.4% (Jul 2025), ≈1.95% → 6.3% (Jul 2026), 3.1% → 7.4% (end 2026); 2024 back-cast 3.9% (RPS 4.1%); saved per hour at start 0.49 → 0.34. World market CY2026 $85B → $197B, leader 2026 $22.8B → $32.4B (reported, not targeted). worldfx U +1 pp and equity 2026 now pass; W2, W4, hiring pass; GOV T1 and F7/F11 known fails; calib, golden, serving pass. Notes: V3-BUILD "A2a notes" | (this series) |
| **A2b Model v3: consumer demand from measured anchors** | Done with one new borderline fail reported (2026-11-19, branch `model-v3`, not merged): weekly reach per region (US start 0.46, ROW × 0.85, Bass toward 0.9·(0.5 + 0.5·best consumer-chat coverage)) and paid share per provider (τ 8 weeks toward (0.04 + 0.1·coverage) × going price ÷ price) as stocks; subscribers × price × 12 is the consumer line, independent of work hours; price = markup × cost capped at the willingness to pay ($22); free users 7.5k/1.5k tokens a day (was 1.3k/0.3k), served last; non-work share 0.7 recorded; schemaRev 18. World subscribers Feb 2026 58M → 100M (paid share 6.3–6.7%), consumer spend $8.4B → $12.8B; 2026 leader (DeepCent) 58–82M subscribers at $7–8 plans; player Chat 2026 revenue $1.1B → $1.0B (capacity-bound, as before); free need ÷ pool mid-2026 2.8% → 15.6%. Golden, T1, serving, products, identity, worktypes, research, effective pass; worldfx U +1 pp 2027-12-30 → 2028-01-22 (band edge; explained in notes); GOV T1, F7/F11, hygiene perf, ws4 T3 known; finance F7 2026 median $33.2B → $30.7B, F11 2027 $34.2B → $27.1B (same checks failing). Notes: V3-BUILD "A2b notes" | (this series) |
| **A2c Model v3: paid plans vs free use, agent work** | Done with the revenue band missed and reported (2026-11-20, branch `model-v3`, not merged): hours of use split into adopted A-hours (billed per hour, cost-plus), seated hours (paid seats σ·W·E, a stock at q 1.5/yr toward the seat cost gate, $25 list), unseated hours (free/bundled/in-house: unbilled, on consumer apps); agent-hours k = a·λ·gate per supervising hour (λ = 1/(c/h80 + ρ(1 − a) + m)), billed per hour, sold via API/Agents (× p(4 h task))/Enterprise; assisted hour 30k/8k tokens (was 100k/15k, 200k/40k); seats served before per-hour work; schemaRev 19. Seats ex-CN 28M Jan 2026, 44M mid-2026; tokens/day 70T → 26T at start, ×4.5 over 2026; player start need 3.35M → 1.44M vs 348k pool (start fleet realistic; residual is the 1T-active model on all traffic). CY2026 non-China revenue $100.9B → $72.3B (band $100–130B missed, not forced), leader $34.2B = 47%. Golden, T1, serving (new B1–B7), products, identity, worktypes, research, effective pass; finance F2 and F8 now pass; worldfx equity 2026 now fails (stochastic capital bust, finance-owned), U +1 pp 2028-01-22 → 01-02, GOV T1 known. Notes: V3-BUILD "A2c notes" | (this series) |
| **B1 Model v3: product card serving economics** | Done (2026-11-20, branch `model-v3`, not merged): each product card shows Price (per hour of use, Chat per subscriber-month; cost vs margin bar, $22 cap tick, value-cap limit chip when it binds; tier as markup in the tooltip), Sources (per-hour work / agent-hours / paid seats; Chat: weekly users · paying and paid share → target) and Served (need in serve order, cut hatched; paid vs free, seats vs work; hours asked vs servable). 14 new glossary terms, stale price/effort/free-tier/M^0.3 text removed; readout-only `adoptedDemand`/`agentDemand` and `ProductRead.econ`. tsc, build, lint-ux, products pass; test:ui 265/0 with B1 checks at day 1/400/900. Notes: V3-BUILD "B1 notes" | (this series) |
| **B2 Model v3: customers as a stock, typed features** | Done (2026-11-20, branch `model-v3`, not merged): the product card's Customers block (replaces Share and the revenue ÷ ARPU customers row) shows the customer stock vs its logit target share (bar + tick, "13% → 7%"), Chat users → users at target, the speed ("moves in weeks/months/quarters") and days to target; the edit preview shows target share before → after. Feature rows show type chips (enabler, horizon, scaffold, effort), the typed effect with units for this product, internal-agent use, cash; locked rows name the idea; tooltips add team-weeks, upkeep, on here, gate, risk. Output-only `ProductRead.cust`, `featureView`; 7 new glossary terms, stale "+0.5 L" feature text removed. tsc, build, lint-ux, products, serving pass; test:ui 285/0 with B2 checks at day 1/400/900. Notes: V3-BUILD "B2 notes" | (this series) |
| **B3 Model v3: World › Sectors (demand and serving economics)** | Done (2026-11-20, branch `model-v3`, not merged): World gets tabs Sectors / Jobs & control. Sectors: region strip (workers using AI, hours of use, hours saved per hour, paid seats, agent-hours), sector heatmap (hours of use / automated A / your share), and a sector card: W, U (survey anchor diamond, RPS) vs A → A*, saved per hour and wage; F, K, 1 − R with the binding one; hours by payer, agent-hours, paid seat share → target; providers' share → target, coverage, cost of an AI work-hour (price ÷ hours saved + review) vs wage; work type in a tooltip; link to Products. Output-only `sectorsView`, survey anchor data; 8 new glossary terms, 4 rewritten. tsc, build, lint-ux pass; test:ui 325/0 with B3 checks at day 1/400/900. Notes: V3-BUILD "B3 notes" | (this series) |
| **B4 Model v3: UI leftovers** | Done (2026-11-20, branch `model-v3`, not merged): revenue tooltip and Core loop show real customers (Chat weekly users · paying, paid seats, else share → target; revenue ÷ ARPU gone); Blueprint and Models show serving as FLOP per token and cost per hour of use (`serveCost` glossary gone; lint-ux check 4 forbids removed v2 concepts in glossary, limits and UI text); Products launch card and serving split beside the cards (≤ 3 products), project card under the priority list, Jobs under the sector heatmap, Work tightened; Auto teams wanted (ResearchState.wantAuto, schemaRev 20, spare teams by priority and fit) and keyboard reorder (Alt+↑/↓, labelled ▲▼); capability research log entries open Research › Projects. test:ui 376/0; hygiene only the known perf fails. Notes: V3-BUILD "B4 notes" | (this series) |
| **C2 Model v3: feature data and upkeep** | Done (2026-11-20, branch `model-v3`, not merged): Voice & vision offered on Chat and the API (its Media enabler acts there), Deep research off Chat (its scaffold cannot act on chat); test C2a: every feature acts on each product it is offered on, every typed effect somewhere; feature upkeep on the engineers' upkeep need: ½ build team-weeks a year in use, a tenth while off everywhere, always in use if it helps the internal agents (Memory 0.115, Computer use 0.154, Companion 0.038 t-wk/wk); shown in the build-load tooltip and the feature tooltip. No state change, no schema bump. Gate green; test:ui 376/0. Notes: V3-BUILD "C2 notes" | (this series) |
| **P2 Model v3: daily-tick performance** | Done (2026-11-20, branch `model-v3`, not merged): no behaviour change (state hashes every 50 days on 4 runs identical; fixtures byte-identical to pre-P2). World mix without per-call closures / holey arrays, fit cache for build-less models, revenue reuses the mix's player offers, macro and rival finance stop recomputing the mix, U only while E17 can fire and per-level tool strengths, incremental swap pass in team assignment. Same session: leader-lab game 1357 → 1108 µs/day (revenue 454 → 308, director 98 → 63, macro 33 → 2, geoQ 15 → 4), RefBot 1690 → 1338; hygiene perf passes on a quiet machine, the leader-lab daily average still exceeds 1.5 ms under load (rest is CES/pow math, needs behaviour changes). `scripts/v2/profile.ts` added. Notes: V3-BUILD "P2 notes" | (this series) |
| **A3 Model v3: price of a fixed capability** | Done (2026-11-20, branch `model-v3`, not merged). The old ×3.4/yr series priced the rivals' reference-design bridge, which has no distillation. `worldfx/serving.ts cheapestAt` returns the cheapest model the lab could serve at a level G: one of its versions, or a student distilled under the game's R1 rule (δ = 0.19 + 0.92·log₁₀ ratio) to hold G exactly; A1 checks `planRun` gives that student the same gap. The serving test's fixed-capability price now falls ×18.9/yr (parameters ×10.55 × rental ×1.79; serving stack, utilisation, margin and tokens per task ×1.00; seeds and presets ×15–21), inside ×6–×30 (R20 D3 ×10). Readout only: revenue, golden dates and RefBot's costs are unchanged. The market's cheapest offer at V0's level still falls only ×2.3/yr, because nobody sells a level-holding mini (F1 rivals, F5 RefBot). The serving stack is 0 in the reference run (no sourced rate; data task). No schema bump. Notes: V3-BUILD "A3 notes" | (this series) |
| **A4 Model v3: demand ceiling on agent work** | Done (2026-11-20, branch `model-v3`, not merged). AI work in a sector and region (adopted task-hours + agent-hours) now stops at its work demand E0·2000·(1 + η·CR), with research/16's η and CR = 1 − (buyer's cost of AI work ÷ wage). Spend on that work stops at the same hours × the wage. `worldfx/use.ts agentCeilingOf` shares `costReduction` / `demandExpansion` with `employmentTarget`. Agent-hours fill the room pro rata (the mix's `agentCeiling.fill`; the player's products are held to the room the other providers leave). The excess is not bought: no revenue and no serving need, so it becomes spare serving. Day-900 fixture: agent-hours 695B → 534B, 11.97 → 9.21 per supervising hour, demand-side agent spend $31.3T → $23.7T, 14 of 42 cells bound. ai2027 takeoff, day 1200: 7,083B → 2,629B agent-hours, 33.0 → 12.3 per supervising hour, $64.4T → $23.7T. Agent spend ≤ wage bill × X in every cell (worst 0.95). Unchanged: everything below the ceiling (byte-identical to day 400), player revenue, 2026 revenue ($34.2B), golden dates and gate results. Remaining spend comes from rival prices above the wage (BRIDGE(V7) → F1). No schema bump. Notes: V3-BUILD "A4 notes" | (this series) |
| **A5 Model v3: cheap tiers (demand by the capability a task needs)** | Done (2026-11-20, branch `model-v3`, not merged). Sector buyers choose per band of task difficulty (V3's coverage read as the share of tasks a model does alone; 8 bands over the coverable range) by logit on surplus V·x − p with scale μ = cheapest adequate price ÷ ε, plus V4's 4/OOM quality term (exactly the old logit at equal prices with every offer adequate); access is a share of buyers. Lineups: rivals and China sell a student per band edge (cheapestAt sized on coverage, BRIDGE(V7) sizes), the player its products' models and the API's mini (the fixed 30% blend retired); `launchDistill holdVersionId` / Blueprint "hold X's level" sizes a cheap tier; RefBot option `cheapTier` (off until F5). Chat users choose by quality alone. Price customers pay for V0's capability (US Software, hardest band V0 does whole) ×7.0/yr (rental ×2.15, margin ×1.14, models bought ×2.86; on providers' own models ×2.3); students take 100% of that band and 39% of world adopted hours by Feb 2027. CY2026 player $34.2B → $33.5B, world sector spend $176B → $124B, non-China labs $72B → $58B (leader 47% → 58%); 2027 $40.7B → $36.5B. T1 identical except authors2026 (merger offer path): Δ_bm 4.606 → 4.5 refit. New: W2 0.56% → 0.494% (band 0.5–1, at the edge); hygiene perf (mix 0.4 → 1.3 ms). No schema bump. Notes: V3-BUILD "A5 notes" | (this series) |
| **D1 Model v3: data portfolio** | Done (2026-11-20, branch `v3-d3`, merged in M1). `PlayerLab.dataPortfolio` (public crawl of one shared finite 300T web stock, licensed, usage from consumer products, synthetic by teacher with q from teacher G, expert) replaces `dataAssets`; U = Σ q·T feeds every base plan; start U 310T exactly as before; golden dates unchanged; schemaRev 21. Notes: V3-BUILD "D1 notes" | e703c7b |
| **D3 Model v3: the base draws its data mix from the portfolio** | Done (2026-11-20, branch `v3-d3`, merged in M1). Per (asset × domain) slice draw with per-slice Muennighoff repetition, s_d,data = 1.5·log₁₀(share ÷ reference share) capped ±1.3 OOM; the five presets are mix targets from the 2025 reference shares (lead: kept; natural mix stays a target for D4); V1 data offsets retired; no schema bump. Notes: V3-BUILD "D3 notes" | 07414e9 |
| **E1 Model v3: safety research lines on the project mechanism** | Done (2026-11-20, branch `v3-e1`, merged in M1). Line projects run ideation → small experiments → frontier validation with the capability experiment CES (lab compute and safety engineers), first result at 1.0 T₁ at reference; hidden efficacy, dead ends, beliefs; schemaRev 22 after M1 (was 21). S5 mixed now passes, S5 RefBot fails (accepted → E2/E10); slow T1 knife edge (G_SC refit in M1, F4). Notes: V3-BUILD "E1 notes" | 24d19ff |
| **M1 Model v3: merge D1/D3 and E1 onto A5** | Done (2026-11-20, branch `model-v3`). Conflicts in package.json and save.ts only; schemaRev chain 20 → 21 (D1) → 22 (E1), hygiene checks both; fixtures kept at schemaRev 16 (migrate through every step). Refits: slow G_SC 35.447 → 35.474 (SC −0.753 → +0.049 y); authors2026 G_SC 33.62 → 33.632, Δ_bm 4.5 → 4.6 (SIAR −0.225 → −0.027, ASI −0.356 → +0.041 y); calib all pass. Gate: test:ui 381; worldfx / finance / ws4 the A5 set (finance F2 43.2M is from A5, identical on 09391a7); safety S5 RefBot fails (accepted), S4 RefBot P_mis 0.530 newly fails (band 0.55–0.85; from E1: the D merge alone on A5 gives 0.706; same cause as S5, for the lead); hygiene perf only. Notes: V3-BUILD "M1 merge notes" | (merge commits) |

## V4a Serving, products, sectors on work types (2026-11-19, branch `model-v3`, worktree ../AI27-model3)

Brief: design/V3-BUILD.md "V4" (choices, deviations, calibration and the stop-condition diagnosis in its "V4 notes").
Code: data/v2/serving.ts, worldfx/serving.ts (new); worldfx/mix.ts, revenue.ts rewritten; sectors.ts, productView.ts,
features (typed), products.ts, workfit.ts (internal feature effects), limitsView.ts (`price.valueCap`), research default
list (V4.0); schemaRev 16 with a 15 → 16 migration. Test scripts/v2/serving.ts (new, in `test:v2`).

**Calibration.** Golden T1 (stub) unchanged within tolerance for all presets (ai2027 SC 0.000, SAR +0.022, SIAR −0.041,
ASI −0.030; authors2026 −0.005 / +0.016 / +0.044 / +0.085; fast −0.003 / +0.096 / −0.019 / −0.096; slow −0.079); T1L
unchanged. No calibration value refitted: SECTOR_REF.mid 0.47 (= v2's level-7.35 point) kept; new [D] values listed in
the V4 notes. Sector side: W2 TFP 0.2% → 0.56% (pass), W4 pass (U +0.00 pp, youth −16.3%, firms 20.5%), hiring 2027.53,
friend 9.7%, remote work 25% 2027.95 (pass); U +1 pp 2028-01-05 (just outside), GOV T1 Accept 2027-09-09 (known).
Revenue: Jul 2025 run-rate $14.2B (pass); **F7 2026 $22.4B (12 seeds; V3b $27.5B), worldfx 2026 $22.8B (V3b $42.3B), F11
2027 $18.2B / $19.1B (V3b $102B / $133B), valuation $0.19T (V3b $0.35T), F8 50% (V3b 58%), capex $138B (V3b $152B),
equity 2026 −18%** — the stop condition: cost-plus prices on the adoption the sector targets need give a ≈ $60B world
market in 2026; the lead decides between retargeting, a value-based price option or a sourced usage term (V4 notes).
Price sanity (INFO): API $13.3/M FLOP-bearing tokens mid-2025 → $4.8 early 2027; a fixed capability ×3.6/yr cheaper
(R20 D3 ≈ ×10/yr, range ×9–×900).

**Tests (final run).** Pass: tsc, golden-timelines, identity, effective (calendar-bug test now holds the recipe stacks
fixed: a new game runs its default lines), research, worktypes (lint now BRIDGE(V6|V7) only), calib, fixtures
(regenerated), lint-hidden, lint-ux, lint-tradeoffs, lint-structure, products (P3 tier index, P4 FLOP-per-token monitor,
P6 pro-rata paid work / free users last: updated to the new rules), serving (new), money, idle; `npm run build` clean;
`npm run test:ui` 257/257. Fail:
- finance F7 revenue, capex, valuation; F8 distress; F11 2027 (the stop condition above); F2 now passes (46.8M);
- worldfx F7/F11 2026 and 2027 revenue, equity 2026, U +1 pp (2028-01-05), GOV T1 (known);
- safety S5 mixed −1.09 (known; V3b −1.25);
- ws4 T3 band and after-theft (known, V7);
- hygiene "performance" daily average 4.0 ms (leader lab 7.3 ms) and worst quarter ticks: the V3b code measures 2.3 ms on
  the same passive game on this machine today (1.16 earlier); same-state cost +15% (mix ≈ 0.7 ms, revenue ≈ 0.2 ms), the
  passive game +20–30% (V4.0 research, distress path).

**Bots (`bots.ts --seeds 40`).** Win / mixed / loss: race 0 / 7.5 / 92.5%, safe 0 / 0 / 100%, mixed 22.5 / 7.5 / 70%,
capex2x 0 / 2.5 / 97.5%, ref 10 / 5 / 85%. §7.4: race win MET, race losses MET (51% takeover, 22% company loss), safe win
≤ 5% MET (V3b 10%), safe losses MISS (48% overtaken; 52.5% ousted), mixed MISS (22.5%; V3b 40%), passive takeover-type
MISS (30%). Company losses (ousted) rose with the lower revenue.

## V3 Work types, AI labour, research speed, milestones (2026-11-19, branch `model-v3`, worktree ../AI27-model3)

Brief: design/V3-BUILD.md "V3" (derivations, choices and the calibration diagnosis in its "V3 notes"). Code:
data/v2/workTypes.ts, departments/workfit.ts, models/research.ts (project CES, pools), production/production.ts (the
player's readout; rivals keep the v2 function, BRIDGE(V7)). Tests: scripts/v2/worktypes.ts (new, in `test:v2`, with the
lint). Tools: `calib.ts --fit-v3 [preset]` (G_SC by bisection on SC per Δ_bm, Δ_bm by grid + golden section),
`--fit-lines` (LINE_FIT.mu to Ho et al.'s 0.48 OOM/yr).

**Calibration (T1, RefBot on the stub, seed 2027; Δ vs golden in years, SC, SAR, SIAR, ASI).**

| Preset | V2a (CAL_SHIFT) | V3 (G_SC, Δ_bm, r) | Within tolerance |
|---|---|---|---|
| ai2027 | −0.463: +0.036, −0.068, −0.082, −0.060 | 31.394, 1.933, 4: 0.000, −0.052, −0.041, +0.016 | yes |
| authors2026 | −0.618: −0.036, −0.132, −0.121, +0.384 | 33.5, 3.142, 3.19: 0.000, **+0.551**, +0.005, **−0.378** | **no** (SAR by 0.43 y, ASI by 0.26 y) |
| fast | −0.473: −0.066, −0.066, −0.011, +0.016 | 32.663, 0.347, 4: −0.003, +0.096, +0.008, −0.066 | yes |
| slow | −1.5: SC +0.019 | 35.505, (1.6), 1.2: SC −0.074 | yes (no CAL_SHIFT; slow's G_SC is one number on the same axis) |

LINE_FIT.mu 0.58 → 0.69. CAL_SHIFT, LEADER_CAL unchanged (rivals and display); T1L unchanged (ai2027 SC −0.044 … ASI
+0.068, authors2026 −0.038 … +0.058, fast −0.038 … +0.055, slow −0.003). Integrated RefBot (informational): ai2027 SC
−0.151, SAR −0.055, SIAR −0.068, ASI +0.011; fast −0.047 … −0.082; authors2026 SC +0.008, SAR +1.24, SIAR +0.62, ASI −0.005;
slow no SC by 2041 (as V1/V2a).

**V3.7 checks.** Pretraining stack in the first year: ai2027 0.47 OOM/yr (Ho 0.48 ± 30%: pass; authors2026 0.41, fast 0.41,
slow 0.32). Research speed at start: M 1.01 (pass), ×1.23 the leader's day-0 research speed after the auto mix moves
compute to experiments. **METR h50 doubling 3.0 months 2025.5–2027.0 (miss, 4.2 ± 1):** RefBot's G grows ≈ 1.7 OOM/yr in
the window and Long context + memory (P07, day 66) multiplies the horizon ×1.5; 3.4 months without P07. T2 (now a sanity
check vs AI 2027): 7k research copies at 5.4× on 71k H100e = 0.18M FTE at SC, ×28 below AI 2027's
≈ 5M median-FTE (the check accepts 0.05–50M: pass); the physical count charges 240k FLOP-bearing tokens per work-hour.

**Why the stop condition is reported, not forced.** authors2026's golden gaps (AI 2027 integrator on AIFM's 1.5 / 101 /
1,340 human-years) need a short SC → SAR and long SAR → SIAR → ASI; in the work-type model the three gaps are fixed
fractions of Δ_bm. Probes with AIFM's own "AI taste at AC" per preset (sd_SC, 0.5 SD here) bracket a fit at Δ_bm ≈ 3.7,
sd_SC ≈ 1.7 (V3 notes), a third per-preset value the brief does not allow.

**Tests (final run).** Pass: tsc, golden-timelines, identity, effective, research, worktypes (new), fixtures (regenerated),
lint-hidden, lint-ux, lint-tradeoffs, lint-structure, products, money, idle, worldfx GOV T1 Accept (failed in V1/V2a);
`npm run build` clean; `npm run test:ui` 234/234 (the day-900 fixture no longer has a capacity-bound product, so the
uitest sets one for the share-erosion limit, as it does for the other conditional limits). Fail:
- calib: T1 authors2026 SAR, ASI; V3.7 METR doubling (above);
- hygiene "performance: daily tick average" 2.13 ms and "(leader lab)" 2.31 ms vs 1.5 (V2a 1.07 / 2.30 ms): the passive
  seed-9 game of the no-leader run is no longer ousted on day 731 (V2a ended it there, so later days ticked free);
  at equal days with endings skipped V3 costs 1,060 µs/day vs V2a's 1,026 (+3%); worst quarter tick 5.1 ms (V2a 8.2, pass);
- safety S5 "without refresh U falls below L by SAR" (new: median U − L at SAR +0.72, V2a −0.91) and S5 mixed (known;
  −1.62 vs −1.23): the display level λ(G) = levelOf(Φ(G)) no longer puts the player's work-type milestones at v2's levels (ai2027 reference recipe:
  SC 9.3, SAR 10.5, SIAR 12.0, ASI 12.3 instead of 10 / 12 / 13.5 / 15), so level-based safety targets see a lower L at SAR (V6 owns safety; the display level should be rebuilt on the
  work-type reference points);
- finance F2 global production 2027 44.6M vs 45M (known), worldfx W2 TFP 1.4% (known, V4), ws4 T3 band 31–381 d (known,
  V7).

**Bots (`bots.ts --seeds 40`, reported).** Win / mixed / loss: race 0 / 2.5 / 97.5%, safe 42.5 / 5 / 52.5%, mixed 75 / 7.5 /
17.5%, capex2x 0 / 0 / 100% (insolvent), ref 22.5 / 35 / 42.5%. §7.4: race win ≤ 5% MET; race losses MISS (82% takeover,
8% company loss); **safe win ≤ 5% MISS (42.5%)**; safe losses MISS (43%); mixed ≥ 30% and ≥ 25 pp MET (75%, 32.5 pp);
passive takeover-type MISS (40%). Safety outcomes moved with the same level shift as S5.

### V3b follow-up (2026-11-19, lead-session decisions; design/V3-BUILD.md "V3b")

Changes: AIFM's AI taste at AC (sd_SC) as the third per-preset value (fitted 1.8 SD for authors2026, 0.5 elsewhere) and
the global ASI gap 1.7 → 1.3 best-to-median gaps (AIFM ASI 12–15 SD); λ(G) piecewise linear through V0 (L 5) and the
reference recipe's SC / SAR / SIAR / ASI (L 10 / 12 / 13.5 / 15), every lab's level = λ(Φ⁻¹(pm)), calShift derived per
world so rivals' SC threshold sits at Φ(G_SC) (credit keeps their q path); M readers through the display level
(bridgeQ); frontier G: new runs start from E_START 1.19 (B0 + Ho's rate × its age; v2's start solution had put the leader
0.53 OOM ahead of B0), RL line effects ÷ 3–7 (L.env 0.006, L.rlalg 0.015) and rShare pretraining 0.8 / RL 0.2,
LINE_FIT.mu 0.645, P07 a typed horizon extender ×1.2 [D] (was an unsourced ×1.5); RefBot's pacing gates read v2's level
scale; challenger start 4 engineering teams (was 3) [D]; LEADER_CAL and CHINA_CAL refit.

**Calibration (T1, RefBot on the stub, seed 2027; Δ in years: SC, SAR, SIAR, ASI).**

| Preset | V3 (G_SC, Δ_bm) | V3b (G_SC, Δ_bm, sd_SC) | Within tolerance |
|---|---|---|---|
| ai2027 | 31.394, 1.933: 0.000, −0.052, −0.041, +0.016 | 30.497, 2.2, 0.5: 0.000, +0.022, −0.041, −0.030 | yes |
| authors2026 | 33.5, 3.142: 0.000, **+0.551**, +0.005, **−0.378** | 33.62, 4.606, 1.8: −0.008, +0.016, −0.041, −0.030 | yes (fragile: ±0.005 OOM in G_SC moves SIAR/ASI by up to 0.4 y) |
| fast | 32.663, 0.347: −0.003, +0.096, +0.008, −0.066 | 31.593, 0.17, 0.5: −0.003, +0.096, −0.019, −0.096 | yes |
| slow | 35.505: SC −0.074 | 35.447: SC −0.079 | yes |

T1L (LEADER_CAL 0.256 / 0.096 / 0.134 / 0.314): all SC … ASI within tolerance (worst ai2027 ASI +0.066). T4 rival gaps at
start 3.1–4.7 months (40 seeds 96% in 3–9). Checks: frontier G path 1.31 G/yr, worst anchor 0.14 G (pass; new check);
METR doubling 4.4 months (pass; V3 3.0); pretraining stack 0.49 OOM/yr; M at start 1.04 (pass); T2 0.12M AI FTE at SC.
Integrated RefBot: ai2027 SC −0.118 … ASI −0.052; authors2026 SC +0.42 … ASI +0.40.

**Tests (final run).** Pass: calib (all), tsc, golden-timelines, identity, effective, research, worktypes (with the start
engineering check), fixtures, lints, products, money, idle; `npm run build`; `npm run test:ui` 234/234. Fail:
- finance F7 2026 revenue $27.5B vs $45B ± 20%, valuation $0.35T vs $1–3T, F8 58% out of distress vs ≥ 75% (new: the
  frontier now grows at research/12's rate and the revenue model, BRIDGE(V4), was tuned to the faster path; V4); F2
  45.0M (known);
- safety S5 mixed −1.25 (known; V2a −1.23); S5 "without refresh" now passes (−1.51);
- worldfx GOV T1 Accept 2027-09-08 (known from V1/V2a), W2 TFP 0.2% (now below the 0.5–1% band; V4);
- ws4 T3 band 26–371 d (known, V7), T3 after a theft 28–53 d vs ≈ 60 (as in V1);
- hygiene "performance: daily tick average" 1.86–2.27 ms and "(leader lab)" 1.96–2.64 ms vs 1.5 over two runs (machine
  load varies; one run also had the leader-lab worst quarter tick 9.0 ms vs 8); V2a 1.07 / 2.30. At equal days with
  endings skipped V3b costs 1,047 µs/day vs V2a's 1,026; V2a's passive seed-9 game ended (ousted) on day 731.

**Bots (40 seeds).** Win / mixed / loss: race 0 / 2.5 / 97.5%, safe 10 / 5 / 85%, mixed 40 / 7.5 / 52.5%, capex2x 0 / 0
/ 100%, ref 5 / 17.5 / 77.5%. §7.4: race win MET, race losses MET (54% takeover, 26% company loss), **safe win ≤ 5% MISS
(10%; V3 42.5%, V2a 7.5%)**, safe losses ≥ 50% overtaken MISS (35%; ousted 55%), mixed MET (40%, 30 pp), passive
takeover-type MET (60%).

## V2a Research as ideas (2026-11-19, branch `model-v3`, worktree ../AI27-model3)

Brief: design/V3-BUILD.md "V2" (choices and deviations in its "V2 notes"); content: design/TECH-TREE.md §6. Code:
models/research.ts (lifecycle, assignment, research engineers), models/stacks.ts (stacks, headroom, pa readout),
data/v2/research.ts; tests scripts/v2/research.ts (in `test:v2`); calibration tools `calib.ts --fit-tree` (V1 attempt
durations), `--fit-lines` (stacks vs the V1 know-how path, scripts/v2/golden/v1-bridge.json).

**Calibration (T1, RefBot on the stub, seed 2027; Δ vs golden in years).** LINE_FIT.mu = 0.58 (bridge fits per preset:
ai2027 0.54–0.60, fast 0.62–0.64, authors2026 0.58–0.63, slow 0.42–0.48 depending on the RefBot policy tried), β = 0.03,
n₀ = 1,000 ideas; paradigm efforts refitted to V1's durations (`--fit-tree ai2027`).

| Preset | V1 (CAL_SHIFT): SC, SAR, SIAR, ASI | V2a after refit (CAL_SHIFT): SC, SAR, SIAR, ASI | Within tolerance |
|---|---|---|---|
| ai2027 | −0.36: −0.027, −0.022, +0.003, +0.025 | −0.463: +0.036, −0.068, −0.082, −0.060 | yes |
| authors2026 | −0.633: +0.030, +0.033, −0.011, +0.025 | −0.618: −0.036, **−0.132, −0.121, +0.384** | **no** (SAR, SIAR by 1–4 days; ASI by 0.26 y) |
| fast | −0.557: −0.016, −0.016, +0.049, +0.058 | −0.473: −0.066, −0.066, −0.011, +0.016 | yes |
| slow | 0.291: SC +0.052 | **−1.5**: SC +0.019 | yes, but CAL_SHIFT moved 1.8 progress-years |

T1L leader lab: LEADER_CAL ai2027 0.057 → 0.021, authors2026 0.052 → 0.046, fast −0.036 → −0.001, slow 0.043 → 0.039; all
SC…last within tolerance. T2 copies Mar 2027 168k, speed 29.8× (pass). T4 unchanged. Integrated RefBot (informational):
ai2027 SC −0.05 … ASI −0.03; fast +0.21 … +0.33; authors2026 SC +2.2 (V1 +0.78); slow no SC by 2041 (V1 none either).

**V2.8 check (pretraining stack, RefBot):** ai2027 0.43 OOM/yr in the first year (Ho et al. 0.48 ± 30%: pass), 0.67
OOM/yr from the start to SC (includes the AI speed-up of 2027: research pace 1.3 → 4.7); all stacks (G-equivalent) 0.90
OOM/yr in the first year (ECI all-in ≈ 0.78), 1.28 to SC. fast 0.38 / 0.61, authors2026 0.36 / 0.58, slow 0.30 / 0.39.

**Why the stop condition is reported, not forced.** The stacks track V1's bridge before SC (log-ratio within ±0.13 on
ai2027 / fast / authors2026), but the shapes differ where V1's bridge had no structure:
- authors2026's four-year takeoff (SAR → ASI) runs 3–5% less efficient per unit of research pace than the bridge (the
  research pipeline's lag, the small β, headroom), and the production function's feedback turns that into +0.38 y at ASI
  while SAR/SIAR land slightly early; a higher μ₁ fixes ASI but pushes ai2027's takeoff out of tolerance (μ₁ 0.62:
  ai2027 SAR −0.13, SIAR −0.16).
- slow's 13 pre-SC years at low pace give ~25% more stack per unit of pace than ai2027 (fit-lines μ₁ 0.42–0.48 vs
  0.54–0.60), so its CAL_SHIFT absorbs ~1.8 progress-years. Not traced to a single cause: the scale-dependent ideas'
  growth with run FLOP is not it (s = 0 leaves the gap), and normalising capacity by H_ref closed most of the earlier
  5-year gap; RefBot's split between paradigm projects and lines (few paradigms queued for years in slow) is the
  remaining suspect.
Both point at V3 (project-level CES replacing the M bridge, explicit labour and compute per project) rather than at line
parameters.

**Tests (final run).** Pass: golden-timelines, identity, effective, research (new, 25 checks), fixtures (regenerated),
lint-hidden, lint-ux, lint-tradeoffs, lint-structure, products, money, idle, ws4 "T3 after a theft ≈ 60 d" (failed in V1);
`npm run build` clean; `npm run test:ui` 234/234. Fail:
- calib T1 authors2026 SAR, SIAR, ASI (above);
- hygiene "performance (leader lab): daily tick average" 2.3 ms vs 1.5 (it failed in this worktree's V1 baseline too:
  2.6–2.8 ms; the tick without the leader lab passes);
- safety S5 (known; median min margin −1.23, V1 −0.68);
- finance F2 global production 2027 44.7M H100e vs the 45M floor (known on master; V1 passed it at 46.7M);
- worldfx GOV T1 Accept 2027-09-12 (V1 2027-09-04) and W2 TFP 1.4% (V1 1.4%): V4 owns them;
- ws4 T3 band 39–313 d (V1 70–289): V7 owns it.

**Bots (`bots.ts --seeds 40`, reported, not required).** Win / mixed / loss: race 2.5 / 5 / 92.5%, safe 7.5 / 2.5 /
90%, mixed 40 / 5 / 55%, capex2x 0 / 0 / 100% (97.5% insolvent), ref 22.5 / 5 / 72.5%. §7.4: race win ≤ 5% MET, race losses
MET, **safe win ≤ 5% MISS (7.5%, as V1)**, **safe losses ≥ 50% overtaken/other-ASI-first MISS (47%; V1 MET)**, mixed ≥ 30%
and ≥ 25 pp above both extremes MET (40%, 32.5 pp), passive takeover-type ≥ 50% MET (60%).

## V1 Capability core (2026-11-18, branch `model-v3`, worktree ../AI27-model3)

Brief: design/V3-BUILD.md "V1" (choices and deviations in its "V1 notes"). Code: models/effective.ts (pure
arithmetic, tested by scripts/v2/effective.ts, now in `test:v2`), bridges in models/capability.ts, data in
data/v2/runDesign.ts.

**Calibration (T1, RefBot on the stub, seed 2027; Δ vs golden in years, SC … last).** "Before refit" is the v3 engine at
the v2 CAL_SHIFT (measured during the build; fast and slow not measured at their old values).

| Preset | v2 baseline (CAL_SHIFT) | v3 at v2 CAL_SHIFT | v3 after refit (CAL_SHIFT) |
|---|---|---|---|
| ai2027 | 0.080: SC +0.008, SAR −0.011, SIAR +0.016, ASI +0.049 | SC ≈ −0.61 (2026.63) | −0.36: SC −0.027, SAR −0.022, SIAR +0.003, ASI +0.025 |
| authors2026 | 0.030: SC −0.016, SAR −0.003, SIAR −0.025, ASI +0.011 | SC −1.09, ASI −1.40 (before the RL-ceiling fix) | −0.633: SC +0.030, SAR +0.033, SIAR −0.011, ASI +0.025 |
| fast | 0.075: SC −0.044, SAR −0.044, SIAR −0.019, ASI −0.011 | — | −0.557: SC −0.016, SAR −0.016, SIAR +0.049, ASI +0.058 |
| slow | −0.127: SC +0.008 | — | 0.291: SC +0.052 |

T1L leader lab (LEADER_CAL v2 → v3): ai2027 0.083 → 0.057, authors2026 0.068 → 0.052, fast 0.053 → −0.036, slow
0.041 → 0.043; all SC…last within tolerance. T2 copies Mar 2027 178k (±30% of 200k), speed 31×. T4 rival gaps at start
unchanged (3.3, 4.6, 4.2, 5.0 months). T3 China mean lead 170 d (ws4, 150–200 d).

Why CAL_SHIFT moved: V0 is pinned (pm(V0) = the reference start), but under v3 rules it sits below the reference lab's
later steady state (its RL is at 0.67 of a ≈ 1.0 OOM ceiling that later runs reach; v2 credited it with 0.28 y of
post-training retention), so RefBot runs 0.4–0.85 progress-years above v2's pm path once it trains its first base. The
refit absorbs that as a level offset (q = pm + calShift, so M is unchanged). Slow moves the other way: its compute grows
1.6×/yr after 2028, which v2's calendar compute term (0.5 then 0.25 y/y for a 1F run whatever its FLOP) over-credited.
Simple labs (rivals, China, leader) get the same offset (CAL_SHIFT_V2 − CAL_SHIFT, BRIDGE(V7)), which brings LEADER_CAL
back to within 0.06 of v2. Two mechanisms were found and fixed on the way: the RL ceiling keyed on G_pre ran away in
takeoffs (authors2026 ASI −0.38 y after refit; now keyed on the base's FLOP), and capIndexV2 was flat on [A0, A0 −
calShift] for negative calShift (now interpolates on thresholds(w)).

**Tests (`npm run test:v2` steps, final run).** Pass: golden-timelines, identity, effective (new), calib, fixtures,
hygiene (incl. the perf budget), lint-hidden, lint-ux, lint-tradeoffs, lint-structure, finance (all, incl. F2, which
failed on master), products, money, idle; `npm run build` clean; `npm run test:ui` 234/234. Fail:
- safety S5 (known; median min margin −0.68, baseline −0.95);
- worldfx "Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85" at 2027-09-04 (window opens 2027-09-10; baseline 2027-11-10);
- worldfx W2 "Normal Technology, Agent-1-level models: TFP +0.5–1%/decade" 1.4% (baseline 0.9%): direct effect of V1.3
  — at the frozen A1 level the era table had SOCIAL/MEDIA −1 L, REASON/BIO −0.5; the constant 2025 profile has them at 0,
  so more sector work automates. V4 (sectors fed by work types) owns it;
- ws4 T3 "lead stays within 75–275 d" 70–289 and "after a theft China is ≈ 60 d behind" (23–60 d): without post-training
  retrofit the player's level line is flat between bases and steps up by ≈ 1.5 L when a base lands (e.g. 6.81 → 8.26 on
  day 462), so "the player's level 60 days ago" is often today's level. V7 (rivals in G) owns it.
- worldfx HireRate_SOFT, finance F2 and the hygiene perf budget (known failures on master) pass now.

**Bots (`bots.ts --seeds 40`, reported, not required in V1; V3 rebalances).** Win / mixed / loss: race 0 / 2.5 / 97.5%,
safe 7.5 / 5 / 87.5%, mixed 32.5 / 10 / 57.5%, capex2x 0 / 0 / 100%, ref 20 / 2.5 / 77.5%. §7.4: race win ≤ 5% MET, race
losses MET, **safe win ≤ 5% MISS (7.5%, 3 of 40 seeds)**, safe losses MET, mixed ≥ 30% and ≥ 25 pp above both extremes MET
(32.5%, 25.0 pp), passive takeover-type ≥ 50% MET (70%).

## J2 Jank batch 2 (2026-11-18, branch `j2`, worktree ../AI27-structure)

Per design/JANK-AUDIT.md "J2 scope" (user decision): R2, P1, PR1 (spare serving only), the engine halves of AG1 and
RK1, and the R7 deferral. Nothing from the "Not now" list. Per-item status: JANK-AUDIT.md "J2 status". schemaRev 11.

**User decisions at review (2026-11-18):**
- **Spare serving → research stays the player default**, although RefBot keeps its spare serving as headroom (its spare
  reaches 3–4× its agent pool in late 2025), so a player on the default researches faster than the reference world.
  Accepted as a real advantage for using spare compute.
- **Known failures accepted:** finance F2 (global chip production 2027 44.9M vs the 45M floor; master 46.7M) and safety
  S5 (median −0.95 vs −0.5; noisy — master also fails it on another 30 seeds). Together with the older hygiene absolute
  perf budget and worldfx HireRate_SOFT, these four are the known failures.

**Engine.**
- R2 `models/tree.ts autoAssignDept`: greedy over (team, ready queued project): an unstaffed project first (queue order,
  specialty first), else most ETA days cut × PRIORITY_W^rank (0.5). Respread of the policy's own teams when a project
  finishes or a ready project has no team while another has ≥ 2 policy teams. `Team.manual` (research.assign) and
  research-line teams are never moved (a first version that re-placed line teams scattered the mixed bot's lines;
  fixed). `teamGain` (days cut) for the picker.
- R7 deferral `sciAiMult`: capability-project capacity × 1/(1 − Φ(sdAI) × min(1, frontier share ÷ 15%)), max ×2 (×4
  was tried: same S5 result, larger refit). Applies in `projectRate` for capability nodes only.
- P1 `departments/build.ts`: daily order runs (ops + setups) → product upkeep (products + monitors) → builds; rates and a
  30-day utilisation in `build.last` / `build.util`. Run setups keep R5's sizes: ×4 setups (1.5 t-wk per size-1 base)
  moved stub:fast P08 by +100 d (the stub traces are sensitive to the run cadence), so the load comes from operations
  and upkeep. `product.launch` and `wfx.sectorProduct` queue build items (`PendingLaunch`, certification after the
  build); `build.cancel`. Features ×2 team-weeks. `agentPackageInputs`: engineering cover > 1 → A_eng = 1 − (1 − a)^cover
  (RefBot cover = 1 exactly: unchanged).
- PR1 `worldfx/revenue.ts spareServing` (pool − Σ min(served, need), 0 until every product was served once), policy
  `spareServing` research | headroom (`serving.spare`), `labInputs` adds it to agents outside the mix (`kSpare`,
  `bestMix` k0); share recovery × 0.5 when lent. `spareServingEffect` for the breakdown. idleStocks lists serving only
  under headroom.
- AG1 `models/products.ts catchRate`: `copy` (same base) and `collusion` (rate × (1 − 0.4), × (1 − 0.2) with T-LOCK active)
  for COLLUSION_TRAITS; used by product incident catches (`productCatch(s, d, trait)`) and internal ones
  (`monitorStrength.strengthColl`, `fleetMonitor(s, v, trait)`). Runtime-monitoring observations unchanged.
- RK1 `actors/intel.ts riskSources(s, mods)` + `RISK_LEVERS` + `riskLevers(s)` (one step per lever, pp change).

**Calibration.**
- PR1 measured on the reference path (ai2027, 6 seeds): RefBot's mean spare serving = 15% of its agent pool, up to 3–4×
  the pool in late 2025 (day 300–420). Lending it would be an unearned speed-up, so `refPlay` sets `headroom` for every
  scripted bot (as R5's spare training → data); the passive player gets the default (research).
- Tree efforts refit to **master's** attempt durations (scratch `_j2fit.ts`: all four stub traces + integrated ai2027,
  geometric mean, damped), not to calib `--fit-tree`'s pre-R4 targets (J1 already moved those: master's stub P08 lasts
  124 d, not 150). FITTED_EFFORT_TM: P05 7.43 → 7.72, P07 5.63 → 5.4, P08 30.14 → 33.62, P13 81.34 → 97.61, P17 40.5 →
  91.11, P19 (class 30) → 48.16, rl.mlResearch (3) → 3.39. P17's large step: under the spread it shares teams with P19
  and gets AI science at Φ ≈ 1.
- No CAL_SHIFT / LEADER_CAL refit needed: calib T1, T2, T1L pass; T1 SC Δ ai2027 +0.008, authors2026 −0.016, fast
  −0.044, slow +0.008 y. "Build queue never delays a RefBot run": worst wait 0 d in all four worlds.
- ref-trace vs master (0e547a7, C:/tmp/j2/ref-base.json): **milestones and paradigm adoption days within tolerance in
  all five traces.** Remaining excesses are downstream: monthly M/pa/sdAI at the end of the stub ai2027 trace (day 930,
  M +9.5%) and authors2026 (day 1770, k after a post-train finishing at a different day), quarterly U at day 914 in stub
  and integrated ai2027 (late tool set timing), enterprise revenue +15% in one quarter (day 549, which version it
  serves), stub:fast pa −0.23 at day 930.

**UI.** Company › Agents & teams: engineering pool load bar (runs / upkeep / builds / idle), "% busy", "upkeep behind",
tooltip with every upkeep line and queue item and its ETA (`BuildLoad.tsx`). Products: launch card "live in N d" +
cancel, launch button shows 4 t-wk, sector packs "N building", serving bar uses min(served, need) plus a spare segment.
Compute › Split: spare-serving row (policy home). Company › Flow: research-speed card shows spare serving's effect.
Research: picker "(−N d)", ETA tooltip AI science ×, auto-assign tooltip/label "Auto-spread teams". Agents: chips "catch
85% · 51% scheming", same-lineage tag. Risk › Sources: both tooltips list "What one step moves" with pp per lever.
Glossary: engAgents, runOps, productUpkeep, collusion, spareServing, aiScience, marginalGain, riskLever (+ rewrites).
STRUCTURE §4.1 and TECH-TREE §1.2 policy text updated.

**Gates.**
- typecheck and scripts tsc clean; identity, golden-timelines pass, golden unchanged; calib all pass (above).
- test:v2 individually: fixtures (regenerated, schemaRev 11), lint-hidden, lint-ux, lint-tradeoffs, lint-structure, ws4,
  products, money, idle pass; worldfx only the known HireRate_SOFT (sector-product check updated for the build queue);
  hygiene only the known absolute budget (leader lab daily 1,626 µs on an idle machine).
  **New failures: safety S5** (mixed bot median min U − L to SAR −0.95, threshold −0.5; master 0.09 on the same seeds)
  and **finance F2** (2027 chip production 44.9M vs ≥ 45M; master 46.7M).
  - S5: bisect on 20 seeds (scratch `_j2s5*.ts`): AG1, P1 and PR1 have no effect; without the spread −0.08, without AI
    science −0.25, both −0.68. Per seed the mixed bot adopts P13 15–30 d earlier than on master (it runs P13 alone,
    while the refit is on RefBot, whose P13 shares teams with P17), so L outruns U near P13. ×4 → ×2 cap and priority
    weight 0.8 → 0.5 did not move it. The S5 statistic is noisy (master on seeds 920–949: −0.57, fails too). Open.
  - F2: RefBot seed 1's cash in Q4 2026 is ~$5B lower (model-path knock-on), so it orders fewer chips; 2028 identical.
- Performance (`_perf.ts`, base worktree at 0e547a7 and j2 alternated, 12 runs each, idle machine): daily 1,792 µs (master)
  vs 1,886 µs (j2), +5%; worst quarter median ≈ 6.5 vs 7.0 ms (+8%, noisy). No regression > 10%.
- `npm run test:ui`: 232/232 (new J2 checks: build load bar and tooltip split, same-lineage catch chip, spare-serving policy home and switch, serving spare segment, launch on the build queue with its wait and cancel, risk lever what-ifs, team-picker days cut). Screenshots looked at: Company build load tooltip (day 900: 7 teams, 70 t-wk/wk, 48%
  busy; API upkeep 22 t-wk/wk), agent lanes (same-lineage tag, "51% scheming"), Compute › Split spare row, Products,
  Risk › Sources lever tooltip.
- **Bots, 200 seeds, leader start** (4 × 50 merged with `--load`): all six §7.4 criteria MET — race 1.5% win, 67%
  takeover / 32% company-loss; safe 2.0% win, 54% overtaken/other-first; mixed 48.5%, +46.5 pp; passive takeover-type
  70%; ref 19.5% win; capex2x 1.0%. Choices vs world: bot policy 76%, world 13%.
- Scripted bots, engineer utilisation / idle-science weeks (ai2027 medium, 6 seeds to day 1,100, `_j2m.ts`; before →
  after): ref 0% → 76% / 58% → 57%; race 0% → 76% / 55% → 55%; safe 0% → 41% / 70% → 68%; mixed 0% → 70% / 60% → 60%;
  capex2x 0% → 84% / 68% → 68%; passive 0% → 86% (99% in year 1: upkeep behind) / 100% → 100%. Run-setup waits p90 1 d
  everywhere. Idle science teams stay idle because nothing is queued (R1, not in scope).

**Notes / open.** S5 and F2 above. A permission check denied listing node processes with their command lines (used to
check for stray processes); not worked around. Scratch scripts `scripts/v2/_j2*.ts` untracked. Baseline worktree
C:\tmp\r4\base is now detached at 0e547a7.

## J1 Jank batch 1 (2026-11-17, branch `jank-audit`, worktree ../AI27-structure)

Per design/JANK-AUDIT.md triage: Major groups B (M1, M2) and C (B1–B3, PR2, F1, F2, C1, O1, RL1) and every UI-only
Minor/Polish finding. Per-finding status: JANK-AUDIT.md "J1 status". 11 Majors done; 41 of 44 Minor/Polish done; P4,
M6, O3 (and the engine halves of AG1, RK1) skipped to J2 as engine changes. Group A stays J2.

**Engine (approved changes).**
- M1 `models/benchmarks.ts runEvalSuite`: a version's measurement error e ~ N(0, 0.2) is drawn at its first suite (hidden
  `evals.errTrue`) and narrows as e/√n (`evals.nSuites`, `measuredSd`); start models are exact (16 suites). The normal is
  still drawn every suite, so the 'runs' stream is unchanged. An unchanged model's reading moves only toward its truth;
  "L drops" per game on a fixed model (passive leader, 3 seeds) 10.7 → 0; remaining drops are a different (new) version.
- M2 `core/record.ts`: weekly U drivers (internal model, measured level, tools, believed EA, re-validation) → cause key
  'U' when U moves ≥ 0.2 (race tooltip, Overview chart hover). U jumps that remain are real input changes (EA belief after
  an eval, a new tool).
- F1 `core/causes.ts`: `cash` entries merge per day and source (cap 600); other keys keep the 40-entry ring (board ouster
  odds read `board.confidence`). money.ts audit now counts increments of merged entries.
- Calibration: RefBot's paradigm gates read the best measured level; without the 30-day re-roll lottery they fire later
  (P08 +61 d, A2 +44 d on stub ai2027 seed 2027). Refit: CAL_SHIFT slow −0.172 → −0.127 (`--fit slow`), LEADER_CAL slow
  −0.004 → 0.041 (`--fit-leader slow`); other presets unchanged and passing.
- ref-trace vs 97eeba8 (C:/tmp/j1/ref-base.json): leader ai2027 traces move (stub: A2 +44 d, P08 +61 d, M −23% at day
  870; integrated: milestones within 5 d, P13 −23 d, revenue/cash/U shifts). Verified as M1 only: with the old re-roll
  formula restored temporarily the ai2027 stub and integrated traces are 0 deviation.

**UI.** Blueprint card lines with their own five-field effect, size defaults and long-run marking; one revenue definition
(strip 30-day average, cards and previews "now"); Finance tabs, division budget readout, raise before → after; compute
before → after (copy-of-state what-if, ~10 ms); Relations hierarchy; Watch-first alert list; and the Minor/Polish list.
Tooltips: Pill / KV / CauseBars default tooltips plus per-screen work. `Tip` marks its trigger `data-tip`.

**Tests added.** lint-ux "Numbers have a tooltip" (scripts/v2/lint-tips.ts, oxc parser from rolldown since TS 7 has no JS
API; 288/320 number sites tipped, 32 allow-listed with reasons, 0 failing). uitest: rendered coverage ≥ 85% over every
panel and tab at day 400 + 900 (89.8%), and J1 checks (B1, B2, F1, F2, F3, RL1, RL2, M4, M5, C1).

**Gates.**
- typecheck, scripts tsc clean; golden-timelines, identity pass, unchanged; calib all pass (T1, T2, T1L after the slow
  refit). Fixtures regenerated once (state now carries `nSuites` / `errTrue` and merged cash causes), then byte-stable.
- test:v2 individually: golden, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs, lint-structure, safety
  (S4 0.755 / 0.012, was 0.792 / 0.020: M1 on the reference path), finance, ws4, products, money, idle pass; hygiene only
  the absolute performance budget; worldfx only HireRate_SOFT (both known).
- Performance (`_perf.ts` 2 runs × 3 alternations vs 97eeba8): daily mean 3,533 µs (base) vs 3,420 µs (J1), worst quarter
  13.1 vs 12.2 ms: no regression (absolute numbers higher than R10's on this machine today for both).
- `npm run test:ui` 222/222. Screenshots looked at: Blueprint (leader 400, spinout 0/400), Products, Finance (leader,
  big tech), Compute overview, Relations, Research, Safety overview, Company people, Overview.
- Bots, 40 seeds, leader start: all six §7.4 criteria MET (race 2.5% win, 61% takeover / 37% company-loss; safe 2.5% win,
  50% overtaken/other-first — on the line; mixed 50.0%, +47.5 pp; passive takeover-type 90%); bot-policy variance share 77%.

**Notes / open.** The spinout's post-train on its import takes ~10 years at the default (ST1, J2); the Blueprint now shows
it in red and opens on post-training. Safety chart dips that remain at day 400 are switches to a different internal
version (M3 territory, J2). Scratch scripts `scripts/v2/_j1*` untracked; baseline worktree C:\tmp\r4\base now at 97eeba8.

## R10 UI completion and structure tests (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R10, STRUCTURE §1 (R2, R3, R5, R11), §5, §8, LIMITS.md "Show" verdicts, mockups-v3 *-IA.md glossary lists.
**Decision (user, 2026-11-17): follower starts accepted as is for now.** The measured difficulty labels stay (leader Easy,
challenger Hard, big-tech division Impossible, spinout Impossible) and nothing in follower balance changes (start data, finance,
boards, diffusion, bot follower plans untouched). Follower catch-up is deferred; the options are in the R9 notes. Knowledge
diffusion from the leader lab stays and is visible in the research-speed breakdown (below). Recorded in STRUCTURE §4.8.

**Structure tags (lint-structure).** `EngineSystem.system` and `ActionDef.verb` + `system` are required in `types.ts`; every
literal carries its tag in its owner module (the R1 tables in `core/registry.ts` are gone). New tags: security, index → relations;
relations catalog (A1–A6 policy, B1/B4/B5/B7/C1/C3/D1/D2/E1–E3 deal, B3 hire, B6 respond, C2/F3 policy, C4 hire·people, C6
launch·models, D3 deal·models, F1 deal·world, SEC_* policy·relations, RETIRE respond·core); safety.publish respond, pledge and
technique policy; fin.recap / refuseRecap / cancelContract deal·finance, sellChips / communityPackage / preorderTransformers
deal·compute; wfx.transitionFund / moonshot deal·world. `scripts/v2/lint-structure.ts`: every system and action tagged, every §4
system covered, every R2 verb used, unique ids, titles ≤ 4 words; prints the system × verb table (102 actions, 32 systems).

**Limits (R11).** `src/data/v2/limits.ts`: 24 limits (id, title, rule, source, engine file, home screen). `ui.tsx Limit` renders the
live reading with a ⊘ mark (grey = not binding, amber / red = binding) and the rule + source as a tooltip, `data-limit=<id>`.
Engine readouts in `core/limitsView.ts` (pure selectors). Shown where they bind:
- Company › Flow, research speed card, "Limits" lines: **frontier methods you lack** (from 100 d after SC: × the M you lose to
  the reference lab's P13 / latent-base normalisation, counting only the methods you lack, with a link to the ideas), **serial
  speed** (n× of 50×, capped), **serve-cost benefit** (copies ×0.5–2.5), **pause** (×0.1, only while active), **knowledge
  diffusion** (+% of your know-how growth from the leader lab; follower starts only). R11 diffusion visibility done.
- Research node card: retry rule (if it fails: retry after 180 d at ½ odds; failed: date and odds). Models: run queue stream row
  (always shown: "takes 15% first when on"), model card "Research boost" (design offset, cap ±6 mo).
- Compute overview forms: order terms (LTA 4–12 q, deposit 30–100%), spot rental ("you'd get N of M"), site size (50 MW to
  the source's max, lease pool left). World: moonshot (from serving, max 30%).
- Products: share erosion on the share block when capacity-bound (−x%, max 75%), revenue-per-chip research-speed cap (run-cost
  tooltip), demand modifiers (binding tooltip). Company › Agents: Trusted to AI max. Company › Security: WSL floor (now / 2027).
- Safety: case card (5–40 people, 120 d max), incident public timer (SB 53 ≤ 15 d / RAISE ≤ 3 d named), diminishing patches
  (patched-to ×, floor ×0.2; `responses.ts patchLevel`). Finance board: public-incident hit at the next review (cap −20/q).
- Codex only: understanding-gap penalty cap (2.5 levels), rivals simplified, bound-leader slowdown.
Older `data-limit` attributes (Blueprint size tiles, raise limits) renamed `data-tile` / `data-cap`.

**Idle test (STRUCTURE §8, R5).** `core/limitsView.ts idleStocks`: stocks with no default use — dark chips, science teams with no
project, serving compute no product needs (> 25% of the pool and > 5K H100e). Default uses are not listed: spare training
compute → experiments / data, safety RE → upkeep and validation lead, agent compute, cash. Alerts: chips → Watch "idle" + Compute
badge; science teams → Research nav badge (they still add research taste, so no Watch nag; at day 0 the leader start has 8 with
nothing queued); serving → new Watch item "idleServing" (→ Compute › Split). `navBadges` moved to `shell/watch.ts` and
`runwayLive` / `catRisk` / `nearestRival` to `shell/selectors.ts` so node scripts can read the alert channel.
`scripts/v2/idle.ts`: ref / mixed / safe / race × leader / challenger × 2 seeds to day 1,100, weekly samples; every stock idle ≥ 30 d
has its alert; spare training compute runs experiments. Result: 2,083 samples, idle ≥ 30 d seen chips 137, science teams 1,174,
serving 613, no miss.

**UI.**
- Top strip (STRUCTURE §5 L0): new Revenue chip (home of `revenueRun`: run-rate, 3-month spark; tooltip per product with its
  customers, Chat's weekly users) between Cash and Lead; Finance's cash-flow card now links ("revenue · in the top strip").
  Race tooltip: "Tools validated to L x" row (U shown only). The runway flip tag moved under the cash value (it overlapped the
  gauge label).
- Overview: "Your company" card on top — the core loop of STRUCTURE §2 as a clickable diagram (`panels/CoreLoop.tsx`):
  Financing → Cash → Teams → Research → Models → Assurance → Products → Customers, Compute feeding Research / Models / Products,
  "customers pay" back to Cash, the takeoff loop with the AI share of each role. Each node shows a verdict colour and a short
  summary (runway state, teams · idle, projects active, best model · runs, ahead / blind, live · capacity-bound, top share · behind
  in N, chips powered); numbers in tooltips; click opens the home. No `data-home` on the loop.
- Codex: opens on a new **Structure** category (the core loop diagram, "Simulated from the outside" — rivals and the world are
  simplified, the bound-leader rule, the AI 2027 leader lab — and "One verb set" generated from the action tags) and a **Limits**
  category generated from the registry. Agenda entries reworded for R8 (serious staffing, line health; FTE row gone).
- Glossary: coreLoop, takeoffLoop, limit, diffusion, frontierMethods, designOffset, staleness, moe, nativeMultimodal,
  hardenedGraders, constitution, honestyTraining, antiScheming, detector, unseen, estimateBand, releaseClearance, agentTasks,
  bestRivalProduct, qualityBound, priceBound, autoSplit, verbSet; lint-ux requires 115 more restructure terms (all present).
  Products use qualityBound / priceBound terms on the binding chip.
- Fixed: the Agents launch card printed a raw time horizon (5756149384967488.0 h) — now `F.minutes`; uitest's raw-number check
  also catches 12+ digit runs. Nav descriptions for Overview and Codex.

**Dead code removed.** Deployments / RunDesigner / SafetyLab / staffing.ts were already gone. Removed now: `dataFactor` /
`dFactor` (LIMITS "synthetic-data floor: Remove if unused"), `TREE_PARADIGMS`, `lineHeads`, run-designer graph helpers
(`traitPushes`, `mainPath`, `signalDelta`), unused `ui.tsx` pieces (`ChoiceBtn`, `causeRows`, `Stack`, `sgn`, `Kpi`).

**Not done.** R7 deferral "frontier-research agent compute adds AI science capacity on tree projects": not calibration-neutral
at the reference without a tree-effort refit (RefBot runs 15% frontier compute, so any capacity term moves its project dates);
tree projects already speed up with research speed M, which counts frontier agents through k and taste. Left for the balance pass.

**Gates.**
- typecheck, scripts tsc: clean. identity, golden-timelines: pass, unchanged. calib: T1, T2, T1L pass. Fixtures byte-identical.
- **ref-trace vs R9** (recorded at 832747d into a temp file): every category 0 deviation on all five traces (stub ai2027,
  authors2026, fast, slow; integrated ai2027).
- test:v2 scripts individually: golden, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs, **lint-structure (new)**,
  safety (S4 0.792 / 0.020, S5 −0.14 / −0.08: identical to R9), finance, ws4, products, money, **idle (new)** pass; hygiene: only
  the performance budget (see perf); worldfx: only the known HireRate_SOFT.
- Performance (`_perf.ts`, seed 9, 1,500 d, passive player; the R9 worktree at 832747d and R10 alternated, 2 × 3 runs, idle
  machine): daily 1,993 µs (R9) vs 1,814 µs (R10), −9% (noise; no engine change); worst quarter 5.1–15.0 vs 4.4–12.3 ms. No
  regression. Hygiene run alone fails only the absolute daily budget (1,797 µs; leader lab 2,202 µs vs 1.5 ms); the leader-lab
  "+20% own cost" check failed once at +21% while four bot processes ran and passes on an idle machine.
- `npm run test:ui`: 212/212 (new R10 section: 24 limits found on their home screens or the codex Limits list with conditional
  state set — pause, a customer incident with a public timer, an open case, the challenger fixture for diffusion — every
  `data-limit` in the registry, codex structure diagram and simulated-world note, revenue chip is the only revenue home and its
  tooltip lists products and weekly users, race tooltip "validated to", Overview loop with nine systems and node → home click;
  IA scan clean; raw-number check now also catches 12+ digit runs). Screenshots checked at day 0 (tutorial), 400 and 900 and on
  the challenger / spinout fixtures: Overview loop, Company flow limits, Compute forms, Products, Models, Safety incidents,
  Finance, Codex, revenue hover.
- **Bots, 200 seeds, leader start** (four processes of 50, merged with `--load`): all six §7.4 criteria MET, table identical to R9
  (race 1.5% win, 71% takeover / 29% company-loss; safe 0.5%, 57% other-first; mixed 48.0%, +46.5 pp; capex2x 0.5%; ref 19.0%;
  passive takeover-type 74%). Choices vs world (final Mis): bot policy 73%, world 14%, rest 13%. E5 13/17.

**Remaining issues seen in screenshots (not fixed, outside R10 or balance):** Enterprise at day 900 earns $0 (Auto serves it
last at the lowest $ per H100e and the pool is short); Chat's model chip and some feature names truncate in narrow product cards;
the challenger's diffusion line reads "+495% know-how from Polaris AI" (diffusion dominates its own research at day 400 — R9
calibration, deferred with follower catch-up); bots leave science teams without projects for long stretches (Research badge).

**Notes for the jank audit.** `idle.ts` and `lint-structure.ts` are in test:v2. New limits go into `data/v2/limits.ts` with a
`Limit` where they bind; uitest fails until they show. Scratch scripts `scripts/v2/_r10*` are untracked / gitignored. The R9
baseline worktree `C:\tmp\r4\base` is now detached at 832747d.

## R9 Start types (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R9, STRUCTURE §4.8 / §4.1, research/18 §5–§6, decisions D1, D6.

**Data `src/data/v2/starts.ts`.** Four starts (one rule set, only the start state differs): teams by key per the
STRUCTURE §4.1 table with science specialties per analogues (challenger safety science = interpretability; spinout
science Elite), extra known nodes (research/18 §5, minus paradigm nodes and nodes whose prerequisites are unknown:
the leader start, the calibration anchor, researches those), live products and built features (challenger: Coding
agent on API; big tech: Voice & vision on Chat; spinout: none), cash, revenue and history, valuation premium, ownership,
compute owned / rented, board preset, model lag, D6 `imported` flag, modifiers (talent-pull anchor 30/20/0/10, star cost
×0.7/1/1.5/1, spinout patient investors: no revenue plan for 4 quarters), difficulty label, one-line character.
`PARENT_BUDGET`: $16B in year one, ×1.75/yr for three years (Alphabet capex path), then ×1.3/yr. The leader row is display
only: the leader start keeps today's initialisers. `tree.ts`: `leaderKnown` removed (its three nodes moved to the leader row).

**Engine.**
- `core/init.ts buildPlayer(start)`: lag like `initialRival` (pm − lag/12·referenceRate, the same shift on pa₀, the start
  base and the in-flight post run); spinout V0 = `Open-weight import` (variant `imported`, D6: internal use and
  post-training only; distilling it is refused), no run in flight, no products, 25K rented. Known safety nodes unlock their
  tools. Rivals, China and the leader lab are placed against the reference V0 (`playerStart(w).target`), not the lagged
  player; intel estimates start at −lag. `newGame`/`defaultSetupV2`: `leaderLab` follows the start unless set (D1); a
  non-leader start sets `setup.governance` to its board; talent pull starts at its anchor; no power-queue site.
- `core/starts.ts`: `startCompute` (owned in live sites — a colocation lease for the challenger, two parent campuses for
  big tech — rented as one cloud contract + ledger), `startFinance`, `startBoard` (challenger: 2nd financial seat + Azimuth
  observer). `departments/teams.ts startTeams(baseline, start)`.
- `finance/parent.ts` (big tech): quarterly payment from `capitalQ` (Q3 2025's is in the $4B + $4B start cash), schedule
  `parentSchedule`; revenue booked then transferred to the parent; runway projects the payments as funding; no valuation
  mark, no revolver, no insolvency (overdraft carried), `soldControl` off; `fin.raise / downRound / rescue / seekPartner /
  acceptDeal / drawDebt` unavailable with `DIVISION_REASON`. Board preset `parent` (Division head + Parent company ×2,
  stance [0.5, 1, 0.2, 0]); no ouster vote or telegraph (STRUCTURE: no parent-confidence mechanic). GOV_FACTOR 0, Index
  governance 0.45.
- Board "behind a rival" (−5/q) applies only past the start's own lag (a board that backed a follower expects it).
- **Knowledge diffusion (new, logged):** `production.ts diffusionPerDay`: while the simulated leader lab's public model is
  ahead of the player's best model, pa += K_DIFFUSION × gap / 365 (`calibration.ts` K_DIFFUSION = 2.0 [D, fit]). Without it
  a follower's lag grew without bound (rate ∝ compute^0.4 at a fraction of the leader's compute: big tech 7 → 25 months
  behind in two years). Only the leader lab diffuses: model-vs-model diffusion from any rival moved the leader start
  (RefBot's best version trails the simple rivals' frontier in 11–70% of days; ref-trace 32 failures) and know-how vs
  know-how is not comparable across labs (43 failures). The leader start has no leader lab: ref-trace, T1, T2 unchanged.

**Bots.** `bots.ts --start` (results carry `start`). Follower plan in `refPlay` / `financeAutopilot` (leader start
untouched): compute target ramps from the start's share of the reference to 1 over two years, two more quarters of runway
guard and bridge floor; hiring one team per role a month while runway ≥ 6 q; base sizes ×0.7/0.5/0.35/0.25 before ×0.1, up
to 200 days, at most 60% of the pool; one post run at a time; launch Chat/API/Enterprise when missing; a division never
sells chips. `sizedTarget`: safety-team plans scale with the company (spinout 12 → 2 teams). **Carried-over R8 gate:** the
safe bot now answers red flags on its internal model like the mixed bot (patch + targeted training, belief > 0.2, ten
traits) — it never did. Line priority (AG15 first: 0.150) and moving 3 RE teams to safety on day 0 (0.131) were tried at
40 seeds and did nothing; the response loop took the safe bot's mean Mis 0.126 → 0.033 (40 seeds).

**UI.** Setup: "Start as" picker (four cards: name, difficulty tag, one-line character; tooltip with cash, staff, compute,
lag, board, leader lab); choosing a start sets the leader lab and, for non-leader starts, replaces the Governance picker with
the start's board. Finance (big tech): Parent budget card (home `parentBudget`: 8 quarters as bars, this/next year,
the reason equity is unavailable) replaces Raise; Ownership, Markets, Debt and Deals hidden; revenue run-rate marked "(to
the parent)". Glossary: parentBudget, startType. Screenshots checked (setup, big-tech finance, spinout/challenger day 400).

**Gates.**
- typecheck, scripts tsc: clean. identity, golden-timelines: pass. calib: T1, T2 (179k, 31.4×), T1L pass. ref-trace vs R8
  (recorded at 577b851): all within tolerance, worst 0. Leader fixtures byte-identical.
- safety.ts: S4 RefBot 0.792, safe recipe 0.020; S5 −0.14 (53%) / −0.08 (65%) — identical to R8.
- test:v2 individually: golden, identity, calib, fixtures (+ start-challenger/spinout-day400), lint-hidden, lint-ux,
  lint-tradeoffs, safety, finance, ws4, products, money pass; hygiene: only the absolute perf budget (now incl. the
  leader-lab worst quarter 10.0 ms on a loaded machine); worldfx: only HireRate_SOFT (2027-02-07). Hygiene newGame covers
  all four starts (leader lab, teams, owned/rented, known nodes, features, products, board, lag, D6).
- Perf (`_perf.ts`, seed 9, 1,500 d, R8 worktree at 577b851 and R9 alternated, 2 × 3 runs): daily 3,303 µs (R8) vs
  3,123 µs (R9), −5%; worst quarter 7.3–14.8 vs 8.9–12.5 ms. No regression.
- `npm run test:ui`: 199/199 (new: four starts with labels, spinout sets leader lab + board, tooltip values, leader start
  keeps Governance; big tech division with Polaris, parent budget schedule, no raise/ownership, reason shown; spinout and
  challenger day-400 fixtures load; R9 IA scan on 11 screens clean).
- **Bots, 200 seeds, leader start:** all six §7.4 criteria MET; **choices vs world (final Mis): bot policy 73%** (R8 63%),
  world 14%, rest 13%. race/mixed/capex2x/ref identical to R8; safe win 0.5%, mixed 2.5%, mean Mis 0.032 (R8 0.177).

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 1.5% | 4.0% | 94.5% | 806 | asiTakeover 58.5%, ousted 16%, nationalized 10% |
| safe | 0.5% | 2.5% | 97.0% | 1449 | overtaken 55.5%, ousted 40.5% |
| mixed | 48.0% | 6.0% | 46.0% | 1027 | asiAligned 50%, asiTakeover 15%, ousted 14% |
| capex2x | 0.5% | 0.5% | 99.0% | 304 | insolvent 93.5% |
| ref | 19.0% | 5.0% | 76.0% | 981 | asiTakeover 40%, asiAligned 19.5%, ousted 14% |

**Per start (40 seeds × 5 bots, leader lab on) and difficulty labels.** Rule (logged in starts.ts): best bot's win rate
≥ 30% Easy, 10–30% Medium, 1–10% Hard, < 1% Impossible. The proposed labels (challenger/big tech Medium, spinout Hard)
were lowered to the data.

| start | label | best win | race | safe | mixed | capex2x | ref | main losses |
|---|---|---|---|---|---|---|---|---|
| leader | Easy | 48% (mixed) | 1.5% | 0.5% | 48% | 0.5% | 19% | (200 seeds, above) |
| challenger | **Hard** (was Medium) | 5% (race) | 5.0% | 0% | 2.5% | 0% | 0% | ousted 52–78%, overtaken 12–33%; capex2x insolvent day 31 |
| bigtech | **Impossible** (was Medium) | 0% | 0% | 0% | 0% | 0% | 0% | overtaken 82–100% |
| spinout | **Impossible** (was Hard) | 0% | 0% | 0% | 0% | 0% | 0% | overtaken ~50%, ousted ~45%; capex2x insolvent |

**Catch-up targets (`scripts/v2/starts.ts`, 10 seeds × mixed/race): all FAIL** (not in the test:v2 chain). Months behind
the leader lab, median at months 0/6/12/18/24: challenger race 4.1/8.4/2.8/6.5/8.5, mixed 4.1/8.5/10.1/5.7/9.4; big
tech race 7.2/5.5/6.4/12.3/18.2, mixed 7.2/8.6/8.0/13.9/19.9; spinout 7.7/13.6/19.5/25.4/31.3.
- big tech 6 → 3–5 in months 9–15: median 5.9 (race-bot games 4.0–4.7: in band; mixed 5.9–7.4).
- challenger parity in months 12–18: best 1.3 months (no game ≤ 0.5).
- spinout first own model: never (0/20) — 25K H100e cannot post-train a frontier-size import (post FLOP scales with the
  reference frontier) or train a base in time; it is ousted or overtaken.
- After the pre-takeoff catch-up, takeoff pulls the leader lab away (its compute is refTotal, which costs the reference
  lab $120B in 2026 and $330B in 2027; big tech's budget is $28B / $49B).

**Deviations / deferred.**
- Catch-up and winnability of follower starts are not met: needs a design decision (see notes). Labels follow the data.
- Not modelled from research/18 §6: big tech approval lag +30 d, own chips ×0.7, unspent cash returning to the parent,
  parent confidence / reorg (STRUCTURE: none); spinout "+1 science project slot"; challenger compute-for-equity verb.
- Leader start keeps its pre-R9 values (no P05/P06/P07 or CoT monitor known; no attrition ×1.2, talent pull 10) — it is the
  calibration anchor. Big-tech and challenger start with no chip orders or sites under construction.
- No `SCHEMA_REV` bump: no state shape changed (new union members `imported`, `parent` only).
- Scratch scripts `scripts/v2/_r9*.ts` are gitignored.

**Notes for R10.**
- Follower starts need a catch-up design before release: options (a) finance (big-tech budget or follower raises that can
  track the reference spend), (b) a stronger or broader diffusion (any lab ahead, with a deadband so the leader start
  stays neutral), (c) follower efficiency levers (cheaper post-training of imports, distillation of public models), (d)
  softer follower boards (challengers are mostly ousted for missed revenue plans as their models fall behind).
- `scripts/v2/starts.ts` and `bots.ts --start` are the checks to rerun; labels live in `data/v2/starts.ts`.
- Known: hygiene absolute perf (now also leader-lab worst quarter on a loaded machine), worldfx HireRate_SOFT.

## R8 Safety on the tree (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R8, STRUCTURE §4.5, TECH-TREE §1.3, §2.4–2.6, §4, mockups-v3 v3-safety* / v3-safety-IA.md.

**Types.** `AgendaState` = { computeShare, posterior, status, deadEndTM } (removed: fte, hazardAcc, refresh). `TreeNodeState.tm`
(team-months on the current attempt of a line project). `FindingRecord.nodeId`. `Investigation.fte` = safety research
engineers on the case. `TreeNodeDef.finding` / `followUp`.

**Data.** `data/v2/tree.ts`: research-line nodes (safety column, agenda, not a paradigm) get effort = T₁·√SERIOUS_CAP
team-months (class shown from it); `LINE_NODES` = one follow-up project per line (`line:AGxx`, not drawn on the tree);
`PROJECT_BY_ID`; aar → F44. `data/v2/agendas.ts`: funding levels and `mHalfCap` gone; `column` per line; `SERIOUS_CAP` 4,
`RE_SERIOUS` 100, upkeep `UPKEEP_D` 0.8 / `UPKEEP_DAYS` 90 / `UPKEEP_MIN` 15 / `UPKEEP_REF` 40 / `UPKEEP_MAX` 1.5.
`data/v2/teams.ts`: safety hiring lane `HIRING_BASE.saf` 3 → 8/wk (see Calibration).

**Engine.**
- `models/tree.ts`: the tree serves both departments (capability columns → capabilities scientists, safety columns incl.
  P27 and KYC → safety scientists; `nodeDept`, `assignBlock`). Line projects progress at `safety/agendas.ts lineRate` =
  √(capacity ÷ SERIOUS_CAP)/(30·T₁) × (C/C_ref)^0.3 × AIx (× ½ dead-end line, AAR ×3, P27), i.e. the pre-R8 hazard λ with
  FTE/FTE_ref → capacity/SERIOUS_CAP and no research speed. At progress 1 `resolveLine` calls `fireFinding(s, ctx, ag,
  nodeId)`: a TECH draw is the node's own catalog row (or its generic tool, or the idea itself for safety pretraining) if
  it can fire in this world (F05 still needs e > 0.7), else today's row order; any other result restarts the project, a
  DEAD adds the attempt's team-months to `deadEndTM`. A known node's teams move to the line's next open idea, else its
  follow-up (auto-assign on). Auto-assign per department; an idle safety team with nothing queued joins a line (unstaffed
  first, best estimate, specialty). `nodeOdds` of a line node = the line's posterior mean (health). The AG17 model gate
  (L ≥ 10) is a project readiness reason. `initialResearch(teams)` puts the start teams on T-CONFESS (alignment) and
  T-DECEPT (interp). Safety option locks (inoculation, hazard filter, safety pretraining) now apply (`optionLocked`).
- `safety/agendas.ts`: `lineCapacity` / `lineMult` (replaces fundingMult: validation of fix techniques "in run", E14/E22,
  AG18 healing), `recomputeComputeShares(s)` (requests m·computeRef), `lineRate`, `lineResultsPerYear`, `resultsPerYearAt`
  (Trusted-to-AI preview), `posteriorBand` (health), `promisingIdle`, `deadEndTotal`, `safetyRe` (RE heads → cases,
  patches, upkeep), `reValidationMult` (validation lead from free RE per line with tools, STRUCTURE §4.5), tool upkeep
  (`upkeepState`: tools with D(M_internal) < 0.8 share the free RE; M½ doubles every 90 d ÷ min(1.5, (RE per tool − 15)/40);
  no ceiling, need-driven). Removed: `setAgendaFunding`, `findingHazard`, `staffFactor`, refresh projects.
- Investigations draw 5–40 safety research engineers (`safetyReHeads`); the case card shows the clamp and the 120-day close.
- Fleet weight (Trusted to AI) counts science heads on lines + case engineers. Actions removed: `safety.fund`, `safety.cut`,
  `safety.refresh`; staffing is `research.assign` / `unassign` / auto-assign.
- `safety/view.ts`: `lineRows`, `lineBadges`, `riskFamilies` (worst belief ± band, clarity, case open, seen-to level),
  `upkeepView` (tools validated to, upkeep vs capability L/mo, behind-in), `safetyUtilisation` (sci on lines / RE on cases,
  patches, upkeep). `understanding.ts familySeenTo` (critical traits of a family when it has any).
- `SCHEMA_REV` 10; migration 9 → 10 drops funding/hazard/refresh and puts each idle safety science team on a line (most
  funded first). Checked on the three rev-9 fixtures (load, 30 d RefBot, round trip, plain JSON). Fixtures regenerated.
- hygiene: documented cross-WS hook `research` → `safety` stream (fireFinding).

**Bots.** `bots/common.ts staffLines(plan)` + `BOT_IDEAS` (ideas a bot's recipe uses first: inoculation, filtering,
pretraining, deception probe, honeypots, resampling). RefBot: hires two safety science teams (target 4) and keeps one on
each of AG18 (honesty, anti-scheming), AG02, AG08, AG07 in the pre-R8 catalog order, then follow-ups. Safe bot (and the
S4 safe recipe): target 23 science teams, every line one team (the five major first: AG18, AG08, AG02, AG07, AG09, the
recipe's set) then the five major doubled; tool
upkeep replaces its re-validation. Mixed: 12 science teams (AG02/08/18/09/07 + lottery, one then two each), 5 safety RE
teams, refresh calls gone. Bots drop design options whose safety idea is not known yet (`known()` in refPlay).

**Calibration (logged).**
- SERIOUS_CAP 4: a matching Strong team = 0.375 of serious, a non-matching one 0.25 (RefBot ≈ its pre-R8 Seed lines).
  Probes (20 seeds, S5): 6 → mixed min margin −0.7 (fail); 2–3 → RefBot U − L at SAR ≥ 0 (fail); 4 passes both.
- Safety hiring lane 3 → 8/wk. Mechanism: before R8 the 180 start safety staff funded six Serious agendas on day 0
  (mixed); with teams, research needs whole teams and only the lane adds them. At 3/wk mixed's median min margin to SAR
  was −2.2…−2.6 even with 12 teams; at 8/wk −0.08.
- Mixed bot: inoculation first on AG18 (it trains with inoculation, now locked until T-INOC) took the min margin from
  −2.2 to −1.4; 5 RE teams (upkeep + validation lead) to −0.6 (lane 6) / −0.08 (lane 8).
- Upkeep crew minimum (15 RE per fading tool) and RE-based validation lead: RefBot's one RE team keeps little up (S5
  "RefBot without refresh falls behind"); √-scaled upkeep without a minimum held RefBot's U at SAR above L.
- Not changed: CAL_SHIFT, LEADER_CAL, tree efforts of capability nodes, agenda T₁/efficacy/finding catalog.

**Gates.**
- `npm run typecheck`, scripts tsc: clean. identity, golden-timelines: pass, unchanged. calib: T1, T2 (179k copies,
  31.4×; R7 177k, 30.9×), T1L pass; build queue worst wait 0 d.
- safety.ts: S4 RefBot P_mis 0.792 (R7 0.815), safe recipe 0.020 (R7 0.002); S5 RefBot median U − L at SAR −0.14, below
  in 53% of worlds (R7 −1.49, 65%); S5 mixed median min margin −0.08, holds in 65% (R7 +0.51, 75%); S6, B3 pass. S5 passes
  with thin margins: the RefBot/mixed contrast in U is smaller than before (see notes).
- test:v2 scripts individually: golden, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs (102 actions),
  safety, finance, ws4, products, money pass; hygiene: only the known absolute performance budget; worldfx: only the known
  HireRate_SOFT.
- Performance (`_perf.ts`, seed 9, 1,500 days, passive player; the R7 worktree at a0f15dd and R8 alternated, 2 × 3 runs on a
  loaded machine): warm daily 1,994 µs (R7) vs 1,906 µs (R8), −4%; cold +2.5%; worst quarter 5.4–5.8 vs 4.5–7.8 ms. No
  regression > 10%.
- ref-trace vs R7 (recorded at a0f15dd into a temp file): integrated ai2027 milestones, adoption days, runs, M, h, k, c,
  sdAI, pa, L, revenue, cash within tolerance; only quarterly U differs (by design: research lines, RE-based validation
  lead, upkeep). Stub traces deviate through safety → capability couplings (spillover pa, sandbagging on measured L, run
  cadence): authors2026 A1 +49 d, P13 +18 d, M −44% at day 1,560; slow SC +11 d; ai2027 distill #8 end −99 d. T1, T1L and
  T2 still pass (no CAL_SHIFT / LEADER_CAL refit).
- `npm run test:ui`: 186/186 (new Safety section: overview verdict / race chart / 4 families / policies, D4 links, eval
  toggle, U tooltip "validated to" and per-family levels, research lines with health and teams, + team picker assigns,
  show all, tools list, case with 20 engineers and the 5–40 / 120 d card; Safety tabs). Screenshots checked (day 400/900
  overview, lines, cases; Research with safety projects).
- **Bots, 200 seeds** (four processes of 50 seeds, merged with `--load`; the safe bot re-run after its plan change): all
  six §7.4 criteria MET. **Choices vs world (final Mis): bot policy 63%, world 21%, rest 15%, below M4's 66%** (R1 63%,
  R4 65%, R6 65% at 200 seeds; R7 68% at 40). Mechanism: the safe bot is weaker early (its 23 teams arrive over two
  years through the hiring lane, where pre-R8 it funded every agenda on day 0): mean Mis safe 0.177, mixed 0.235, ref
  0.537, race 0.875; paired mixed − safe ΔMis only +0.057. Moving the safe bot's majors to its recipe's set (AG18, AG08,
  AG02, AG07, AG09) left it unchanged (0.178 → 0.177). E5 12/17.

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 1.5% | 4.0% | 94.5% | 806 | asiTakeover 58.5%, ousted 16%, nationalized 10% |
| safe | 1.5% | 3.5% | 95.0% | 1454 | overtaken 57%, ousted 38.5%, rivalAligned 2% |
| mixed | 48.0% | 6.0% | 46.0% | 1027 | asiAligned 50%, asiTakeover 15%, ousted 14%, nationalized 9% |
| capex2x | 0.5% | 0.5% | 99.0% | 304 | insolvent 93.5%, asiTakeover 4% |
| ref | 19.0% | 5.0% | 76.0% | 981 | asiTakeover 40%, asiAligned 19.5%, ousted 14%, nationalized 8.5% |

  §7.4: race losses 71% takeover / 29% company-loss; safe losses 59% other-first; mixed +46.5 pp over both extremes;
  passive takeover-type 74%.

**UI.** `panels/Safety.tsx` (+ safety.css `sf-*`) replaces `SafetyLab.tsx`. Overview: verdict banner (lags / barely ahead /
ahead, blind levels, trend, tools behind in N mo) with two cause → fix chains (weakest critical family → the detection
idea that covers it › Research; tool upkeep slow → safety RE teams › Company); capability vs understanding chart (6 mo
back, 4 ahead, blind hatching, projections, "U if <idea> works" from a hypothetical unlock, hover per week, U point
tooltip = per-family seen-to, tools validated to, upkeep vs capability per month); risk families (model tabs, est ± 90%
band, seen / unseen (clarity < 30%, as Company badges) / under investigation); policies (evaluate before release toggle +
external review, monitors and Trusted to AI as links to Company per D4, publish results, pledge). Research lines (home of
line health, teams, project progress + ETA to next result, results by type, dead-end team-months; + team picker; show
all; tool upkeep card with RE split and crew rule; results feed with publish; tools list with on/off). Investigations
(case cards with clarity, staffing 5–40, closes-by date; open a case with trait + engineers). Trait graph (graph,
detection grid, misalignment band, failure modes). Incidents. Tab badges: "N idle" (promising lines with no team), "N
team-mo lost", open cases, open incidents. Research: safety nodes are projects (odds = line health linking to Safety ›
Research lines; effort tooltip shows T₁ at serious staffing; team picker lists the node's department). Links into the
old Safety tabs (tools / agendas) now point to Research lines / Overview; RiskSources and decision levers updated.
Glossary: lineHealth, deadEnd, seriousStaffing, followUp, toolUpkeep, validatedTo, blind, caseStaffing; researchLine,
agenda, mHalf, refresh, safetyLoad, investigation rewritten.

**Deviations / deferred.**
- RefBot is ≈ but slightly above its pre-R8 Seed level on three lines (matching specialty, 0.375 of serious) and drops
  AG16 (the start funding's fifth line). It hires its two extra teams in the first months (lane 8/wk).
- Line projects do not use research speed M (as the pre-R8 hazard); P27 and KYC (no line) roll like capability nodes.
- Follow-up projects keep lines producing results after their ideas are known (generic upgrades, DISC, NEG as before).
- The passive start now runs two lines (AG02, AG18 at 0.375) instead of three Serious + two Seed: day-0 U 5.9 (R7 6.8).
- R7 deferral (frontier-research agent compute as AI science capacity on tree projects): not done; it touches capability
  calibration and was not cheap at the reference.
- Scratch scripts `scripts/v2/_r8*.ts` are gitignored; `scripts/v2/_r8shot.mjs` (Safety screenshots from a fixture) is
  untracked. The R7 baseline worktree `C:\tmp\r4\base` is now detached at a0f15dd (holds gitignored `_r8*.ts` copies).

**Notes for R9.**
- Start types should set safety teams and their start projects (`initialResearch(teams)` reads specialties via
  `START_SAFETY_PROJECTS`) and the safety RE count (upkeep crew minimum 15 per fading tool; validation lead from RE per
  line). A spinout with no safety RE has no tool upkeep and no validation lead.
- S5's RefBot/mixed contrast is thin (−0.14 / −0.08 vs thresholds 0 / −0.5); any change to start safety staffing or the
  safety lane moves it. Re-run `safety.ts` after start data.
- `nextLineProject` / `staffLines` / `BOT_IDEAS` are the hooks for bots playing other starts.

## R7 Internal agent packages and monitors (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R7 (D4, D7), STRUCTURE §4.1, §4.9, §9, mockups-v3 v3-company / v3-safety-IA.

**Types.** `player.agents: Record<'eng' | 'capRoutine' | 'capFrontier' | 'safety', { versionId?; monitorId?; compute }>`
(`AgentPackage`). Routine research always names its model (the old `models.internalAgent`); the other uses follow it when
`versionId` is absent. `monitorId`: absent = none, `'same'` = a copy of the watched model (follows swaps), or a version.
`compute`: engineering / routine / frontier are shares of the capabilities agent pool (`split.agents`, sum 1; default
0.20 / 0.65 / 0.15), safety a share of the safety pool (the old `agentShare`). `policies.trustedToAI` replaces
`AgendaState.aiLabour` and `Investigation.aiLabour`. Removed: `models.internalAgent`, `safety.monitoringShare`,
`safety.agentShare`, `safety.agentVersion`. `ProductionReadout.labor.aEng`.

**Data `src/data/v2/agents.ts`.** Use definitions (name, work, role, budget, misuse, takeover order), `ENG_REF_SHARE` 0.2
[D], default shares, `MONITOR_SAME`, `MONITOR_STD_POOL_SHARE` 0.2 (calibration), `TRUSTED_MAX` 0.5 / `TRUSTED_MAX_P27` 1,
`SAFETY_AGENT_DEFAULT_SHARE` 0.2, `RISK_FAMILIES` with badge thresholds (watch: an estimate ≥ 0.3; unseen: mean
clarity < 0.3).

**Engine.**
- `departments/agents.ts`: `agentVersion` / `monitorVersion` / `capShare` / `agentSplitShare`; `monitorBudget` (D7 need
  0.25 × monitor serve ÷ watched serve × the use's compute, priced against the standard package: a copy of the watched
  model on routine and frontier research at the reference split costs `MONITOR_STD_POOL_SHARE` of the safety pool;
  coverage < 1 only if monitors would need more than the whole pool); `monitorStrength` = coverage × min(1, catch ÷ 85%)
  (R6's `catchRate`: AG05 oversight gap + AG07 control tools; no gap = exactly 1); `internalFleets` (each distinct
  model running internal uses, usage = its share of internal agent compute); `fleetMonitor`, `routineMonitor`,
  `monitoredUses`, `usesOf`, `trustedMax`, `riskBadges`.
- `production.ts`: `evalM` takes optional `qTaste`; Tref is read at q_taste via `tasteCurve(w, q)` only when it differs
  from q_dep (identity/golden untouched). `agentPackageInputs`: k = Cag·ηmod·agentMult/(ref·sh.agents) with agentMult =
  research share ÷ (1 − s_engRef) × the compute-weighted ηmod of routine + frontier models relative to routine's (exactly
  1 at the reference split, frontier on routine's model); qTaste = the frontier model's q when it has its own model and
  compute; aEng = (1 − (1 − A(q_eng))²) × min(1, eng share ÷ s_engRef × ηmod_eng ÷ ηmod_routine); copies keep all three
  uses (T2). `buildCapacity` and `aiShareByRole` read `labor.aEng`.
- Monitors generalised: runtime monitoring (weekly) observes each internal fleet at its monitor strength^0.3 and product
  models at max(routine fleet's strength, their product monitor); internal incidents roll per fleet (usage = compute
  share; one fleet at usage 1 by default) and are caught with detection × (½ + ½ × fleet monitor strength); E14 needs
  the routine fleet's monitor ≥ 0.5; agendas get the safety pool after monitors, safety agents and investigations.
- Trusted to AI: `trustedShare(s)` = min(policy, cap) when the safety model passes the B3 gate, else 0; it drives the
  fleet weight, agenda AIx, `aar`/P27 multipliers, FALSE findings, investigation labour and corruption.
- Actions: `agents.set {use, versionId?, monitorId?, compute?}` (the two other capabilities shares rescale; routine
  research syncs the internal deployment; safety models need the B3 gate) and `agents.trusted {share}` (starts the safety
  agents at 20% of the safety pool if none run). Removed: `setInternalAgent`, `safety.automate`, `safety.agents`,
  `safety.monitoring`. `departments/agentActions.ts`: `agentsView` (per lane: model, L, monitor, catch, strength, gap,
  compute, share, copies × speed, AI share of the role, cost, monitor cost, risk; M, build, sdAI, safety AI FTE, totals),
  `previewAgentChange` / `previewTrusted` (shallow hypothetical state; what the next tick computes).
- Auto-evaluate covers every internal use's model. Rollback moves packages and monitors to the parent. Retire refuses a
  model that powers or monitors an internal use.
- `SCHEMA_REV` 9; cheap migration 8 → 9 (routine = old internal agent, safety package from agentVersion/agentShare,
  monitors 'same' on routine and frontier unless monitoringShare was ≤ 1%, Trusted to AI = the largest per-agenda/case
  share), checked on the three rev-8 fixtures (load, 30 d RefBot, round trip). Fixtures regenerated.

**Bots.** RefBot sets routine research to its newest model with `agents.set`; the other uses follow it and the default
monitors are on (the reference lab uses its newest model everywhere with a standard monitor). No bot used safety AI
labour before R7; none does now (the safe bot's optional older trusted safety model was not added).

**Calibration.** None. The first version paid monitors their raw D7 cost from the safety pool (≈ 0.2 × agent compute,
2–3× today's 20% reserve late in the game): agendas lost compute, stub:slow A1 moved −78 d and U drifted. Pricing
monitors against the standard package (`MONITOR_STD_POOL_SHARE`, BUILD-PLAN §3 (2) "standard monitor = today's
monitoring") made the default exactly today's.

**Gates.**
- `npm run typecheck`, `tsc -p scripts/v2`: clean. identity and golden-timelines unchanged and passing. calib: T1, T2
  (177k copies, 30.9×, as R6), T1L pass; no CAL_SHIFT/LEADER_CAL refit; build queue worst wait 0 d.
- **ref-trace vs R6** (recorded at a8141ac into a temp file): every category 0 deviation (milestones, adoption days, runs,
  M, h, k, c, sdAI, pa, L, U, revenue, cash) on all five traces.
- test:v2 scripts: golden-timelines, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs (105 actions),
  safety (S6 now on Trusted to AI; B3 on the policy), finance, ws4, **products (+ A1–A7 agent-package checks)**, money
  pass; hygiene: only the known absolute performance budget; worldfx: only the known HireRate_SOFT.
- Performance (`_perf.ts`, seed 9, 1,500 days, passive player; R6 worktree at a8141ac and R7 alternated 3 × 3 runs):
  daily 1,722 µs (R6) vs 1,797 µs (R7), +4.4% (warm runs +5.9%); worst quarter median 5.7 vs 5.4 ms. No regression > 10%.
- `npm run test:ui`: 177/177 (new: four lanes with model and monitor chips, AI share per capabilities role, 16 risk badges,
  monitor pick → before → after preview → Cancel keeps / Apply changes, compute + keeps shares summing to 1, Trusted to
  AI home and gate, same chips on Products, Safety summary links to Company, split tests on Compute › Split, flow pool
  click → Compute, day-900 frontier-model preview shows research speed falling). Screenshots checked (day 400 / 900
  lanes, preview popover, Safety tools summary, Compute › Split).
- **Bots, 40 seeds**: all six §7.4 criteria MET.

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 0.0% | 5.0% | 95.0% | 800 | asiTakeover 55%, ousted 17.5%, nationalized 15% |
| safe | 2.5% | 2.5% | 95.0% | 1504 | overtaken 62.5%, ousted 32.5% |
| mixed | 55.0% | 7.5% | 37.5% | 1069 | asiAligned 55%, ousted 12.5%, asiTakeover 10% |
| capex2x | 2.5% | 0.0% | 97.5% | 304 | insolvent 95% |
| ref | 25.0% | 0.0% | 75.0% | 970 | asiTakeover 35%, asiAligned 25%, nationalized 12.5% |

  §7.4: race losses 66% takeover / 34% company-loss; safe losses 63% other-first; mixed +52.5 pp over both extremes;
  passive takeover-type 50%. Choices vs world (final Mis): bot policy 68%, world 18%, rest 14%. E5 11/17.

**UI.** `panels/Agents.tsx` + `agents.css`: Company › "Agents & teams" tab (id `people`) opens with Agents at work (home
`agents`; Trusted to AI home `trustedToAI` on the safety lane): use with takeover order, model chip, monitor chip with
catch (tooltip: gap, coverage, strength rule), compute bar + H100e + CAP/SAF tag + copies × speed + −/+ 5% steppers (their
tooltips preview), AI share of the role's work (engineers / research engineers / scientists with AI taste SD; safety:
Trusted to AI stepper), cost/yr (agents + monitor), four risk-family badges (low / watch / unseen) with a legend; header
links to the research mix (Compute › Split) and research speed (Flow). A model or monitor pick opens the before → after
popover (research speed, AI share, build capacity or AI taste, copies, catch, monitors' share of safety, cost; Apply /
Cancel; "from <date>"). The Teams card lost its AI-share chips and the "AI labour" card (one home). `panels/chips.tsx`
(`PkgChip`, `CatchX`, `modelOptions`) is used by Products and Company. `panels/Split.tsx` (moved from Company) is
Compute › Split; every split link points there. Safety: the agents card and the monitoring slider are gone; the policy
card shows "Trusted to AI x% · model" and "monitors on N of 4 uses", linking to Company. Models: "Make internal agent"
became "used by …" + a link to Agents at work. Glossary: agentPackage, agentMonitor, trustedToAI, aiShareWork,
agentBudget; internalAgent, safetyAgents, automateSafety, runtimeMonitoring rewritten; P27 effect text.

**Deviations / deferred.**
- Monitor cost is D7-relative, anchored to today's 20% safety reserve (above), not raw D7 H100e.
- A monitored product model is observed at its own product monitor's strength too (new; neutral, no bot uses product
  monitors).
- Engineering coverage is relative to the reference split (share ÷ 0.2 × ηmod ratio), not per engineer.
- Frontier compute only counts in k and gates qTaste (0 compute = routine model's taste); no separate "AI science
  capacity on projects" yet.
- The research-mix Auto switch stays on Compute › Split (its home); the agents header links to it.
- Scratch scripts `scripts/v2/_r7*.ts` are gitignored. The R6 baseline worktree `C:\tmp\r4\base` is now detached at
  a8141ac (`node_modules` junction: remove it with `rmdir` first, then `git worktree prune`).

**Notes for R8.** Trusted to AI (`trustedShare`) and the safety package (`agents.safety`, `safetyFleet`) are the AI-labour
inputs for safety projects; `fleetMonitor` / `routineMonitor` and `riskBadges` are ready for the four risk-family
aggregates; `recomputeComputeShares(dept, split, safetyReserved(s))` is where agenda compute goes away. The safety lane
on Company is the home of the safety model; Safety's policy card only links.

## R6 Products and live edit (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R6 (D5, D7), STRUCTURE §4.4, §4.9, §9 (mockup review), mockups-v3/v3-products*.

**Types.** `Deployment` gains `kind` ('product' | 'internal' | 'open'), `price` ('budget' | 'standard' | 'premium'; `priceIndex`
is kept equal to the tier's index 0.7 / 1 / 1.4), `miniVersionId?` (mini free tier), `monitorId?`, `features[]`, and the
derived `needH100e` / `servedH100e` / `cutH100e` and `hist` (revenue at each 30-day mark, 12 kept). `player.features`
(built lab-wide). Policies `servingAuto` (on), `upgradeToNewest` (off), `autoEvaluate` (on).

**Data `src/data/v2/features.ts`.** Products by channel (name, customer noun and revenue per customer for the customer
readout, segment), price tiers, `FREE_TIER_SHARE` (Chat 60%, API 30% of use on the mini), `MONITOR_OVERHEAD` 0.25 (D7),
`MONITOR_CATCH_BASE` 0.85, `AGENT_TASK_HOURS` 4, `AUTO_EVAL_DAYS` 30, and eight features, each mapped to an existing term:
Memory (P07: Chat appeal ×1.1, AGENCY +0.3; successor incidents ×1.2), Deep think (P05: effort deep), Computer use (P06:
AGENCY +0.4; power-seeking incidents ×1.3), Voice & vision (appeal ×1.1, MEDIA +0.3), Deep research (REASON/RSCH +0.3,
serving ×1.1), Coding agent (Software & IT +0.5 L, the sector-product bonus; reward-hacking incidents ×1.2), Companion
mode (engagement node: appeal ×1.2; sycophancy ×1.5), Sector packs (today's sector products). D5: the leader start has
sector packs built (`LEADER_FEATURES`); every other feature is a gain when on. The three product-feature tree nodes lost
`soon` (researchable now).

**Engine.**
- `models/products.ts`: package effects every reader uses. `productDomains` (model blended with the free-tier mini by
  use, plus feature offsets; returns the model's own record when nothing changes it, so the reference configuration is
  bit-identical), `productAppeal`, `productServeMult`, `productBonusSectors`, `productHazardMult`, `monitorOverhead`
  (D7), `catchRate` (0.85 × 0.52^gap, gap = log4 of the M ratio at measured levels — the AG05 rule — then AG07
  containment tools at believed strength halve what slips through), `agentsGate` (measured h50 ≥ 4 h),
  `featureBuildBlock` / `featureToggleBlock`, `autoEvaluate`, `newestCleared`.
- `worldfx/mix.ts`, `revenue.ts`, `control.ts` read `productDomains` / appeal / bonus sectors. `revenue.ts`:
  `rphOf` (model rate blended with the mini by use, ÷ feature serve multiplier, ÷ (1 + monitor overhead)) and
  `servingSplit`: Auto needs demand ÷ rate, serves products in order of revenue per H100e, records the cut, and spreads
  spare pool by need; manual = hand-set shares (scaled if > 100%). The silent rescale is gone; `servingShare` is written
  daily from the split under Auto (incident usage reads it). `capacityOf(s, d, h)`.
- `worldfx/productView.ts`: per-product readouts (revenue, customers, share of segment spend vs the best rival product,
  binding cause, need / served / cut, run cost at the rental-equivalent TCO, monitor overhead, catch) and
  `previewDeployments` (recompute mix + revenue on a copy of the state: the preview is what the next tick computes).
- `models/productOps.ts`: actions `product.launch` (one live product per channel; Agents behind its horizon gate),
  `product.update` (model, mini, monitor, tier, safeguards, KYC, effort, features; live, same id and start day; deep
  think ⇔ the Deep think feature), `product.retire`, `product.serving` (hand-set share; turns Auto off), `feature.build`
  (cash + `queueBuild('feature')`; the build system adds it to `player.features` when done), `feature.toggle`,
  `products.policy`. New system `products` (155, daily, after endings): auto-evaluate and upgrade-to-newest at the
  close of the day (see Calibration for why it sits there).
- `deployments.ts`: `EVAL_MAX_AGE` removed (a version launches once evaluated at the gate depth); Agents gate; deploy
  sets kind/tier/features; `setServing` is per product only; versions used as a monitor or free tier cannot be retired.
- `safety/incidents.ts`: feature hazard multipliers; a product's monitor rolls its catch rate on model-behaviour incidents
  (not misuse): caught ones stay internal (no public timer or penalty). No monitor = no roll (the pre-R6 behaviour).
- Old actions `deploy`, `swapDeployment`, `setServing`, `withdraw` removed (verbs: launch / update / retire / policy).
  Watch: the stale-evals alert is gone; the capacity alert names what is cut.
- `SCHEMA_REV` 8; cheap migration 7 → 8 (kind, nearest tier, no features, leader features, policies; the save's
  spare-training choice kept), checked on the three rev-7 fixtures (load, 30 d RefBot, round trip). Fixtures regenerated.

**Bots.** RefBot: no weekly `setServing` (Auto), swaps via `product.update`, no 30-day `runEvals` (auto-evaluate policy);
the safe bot's 24-day mini re-evals are gone (suites no longer expire); the mixed bot's enterprise swap uses
`product.update` (still refused: Enterprise takes full models).

**Carried over.**
1. *worldfx GOV T1 Accept.* RefBot's mini staleness rule measured the public release against Chat, API **and
   Enterprise**; once Enterprise sat on the continual-learning stream (updated in place) "what the products serve" rose
   with the internal model and the 0.7-level trigger never fired, so minis came only every 182 days (from day ~720). The
   rule now measures the public release (Chat, API; `PUBLIC_CHANNELS`), as its comment always said. Pre-R4 traces show
   Enterprise on the stream too (days 660–840); the bug only bit when R4 moved the timing. GOV Accept ≥ 0.85: 2028-03-31
   (R5, fail) → **2028-03-01 (pass)**.
2. *Spare training default* → `'data'` for new games (matches the reference path). The choice moved to its home on
   Company › Compute split (Training: "Spare · N idle", the policy in use and the other option with its effect, e.g.
   "Use for experiments +x% speed"); the run queue keeps the spare share and links there.

**Calibration (one line).** The Auto split serves the most $ per H100e first. RefBot's R5 split (shares ∝ demand $) gave
the full model on Enterprise a third of the pool; Auto serves the minis (×2 revenue per H100e from their ¼ serve cost)
and cuts Enterprise. With `RPH_BASE` and the serve factor unchanged the reference lab's 2027 revenue rose to $216B
(target $140B ±30%). Refitting `RPH_BASE` alone (34K) put 2027 on target but cut 2025 revenue (no minis yet, Auto =
proportional), and RefBot's 2026 distress rate fell below F8 (33% vs ≥ 75%). The gain comes from the serve-cost factor,
so that is the refit: revenue serve factor (0.5 ÷ serve cost)^x, **x 0.5 → 0.3** (a [D] term, not part of R11 #14's
formula; start unchanged). Reference path: Jul 2025 $13.8B, 2026 $50.1B, 2027 $175.2B (R5: 13.8 / 50.7 / 172.5).
- Auto-evaluate placement: inside the runs system the eval's 'runs' draws moved after the bot's same-day launches,
  which re-drew measured-L noise and moved stub ai2027 A2 +33 d / P08 +50 d. At the close of the day (system 155) the
  suite runs where RefBot's pre-tick `runEvals` did, stamped with the same date: back to ≤ 1 d.

**Gates.**
- `npm run typecheck`, `tsc -p scripts/v2`: clean. identity and golden-timelines unchanged and passing. calib: T1, T2
  (177k copies, 30.9×), T1L pass; T1 SC Δ ai2027 +0.003, authors2026 −0.047, fast −0.044, slow +0.011 y; build queue
  worst wait 0 d.
- test:v2 scripts individually: golden-timelines, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs (107
  actions), safety, finance (all; F8 75%, as R5), ws4, **products (new, 40 checks)**, money pass; hygiene: only the known
  absolute performance budget; **worldfx: only the known HireRate_SOFT (2027-02-07); GOV T1 Accept passes; revenue
  targets pass with no rebaseline**.
- **ref-trace vs R5** (recorded at 1299436 into a temp file): milestones stub ai2027 ≤ 1 d, authors2026 ≤ 10 d (A2),
  fast ≤ 2 d, integrated ≤ 2 d; **stub slow SC +18 d** (13-year trace; +13 d of it is the staleness fix: extra minis take
  training-pool share — measured by reverting it). Adoption days ≤ 14 d (integrated P13 +14). Integrated quarterly
  cash ≤ 15.5% (one quarter, day 457). **Revenue per channel is outside ±10% by design**: Auto serves Chat/API (minis)
  first and cuts Enterprise, where R5's demand split left Chat capacity-bound and eroding (day 822 Chat $59.6B vs $9.8B);
  totals match (above).
- Performance (`_perf.ts`, seed 9, 1,500 days, passive player; R5 worktree at 1299436 and R6 alternated 3 × 3 runs):
  daily 1,644 µs (R5) vs 1,737 µs (R6), +5.7%; worst quarter 7.2 vs 6.4 ms. No regression > 10%.
- `npm run test:ui`: 166/166 (new Products section: cards per product, deep think locked with its reason, an edit opens
  the before → after preview with "stays live" and the date, Apply updates monitor + tier live with the same start day,
  catch rate on the card, Cancel, feature Build on the engineers' queue, locked features name their idea, serving bar,
  Override → manual share → Auto back on, upgrade policy, Agents horizon gate, Retire; spare training on the split;
  the action loop skips Retire). Screenshots (day-400 fixture: products, edit preview, capacity tooltip, split) checked.
- **Bots, 200 seeds** (`--seeds 50 --from 0/50/100/150` merged with `--load`): all six §7.4 criteria MET; **safe win 1.0%**
  (R5's 40-seed run sat on the 5% cap; R4's 200-seed run 0%).

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 2.5% | 5.5% | 92.0% | 808 | asiTakeover 55.5%, ousted 16.5%, nationalized 10% |
| safe | 1.0% | 2.5% | 96.5% | 1472 | overtaken 62.5%, ousted 34% |
| mixed | 50.0% | 8.0% | 42.0% | 1031 | asiAligned 51%, asiTakeover 12%, ousted 12%, nationalized 8.5% |
| capex2x | 2.0% | 0.5% | 97.5% | 304 | insolvent 94% |
| ref | 19.0% | 5.5% | 75.5% | 980 | asiTakeover 39.5%, asiAligned 19.5%, ousted 12.5%, nationalized 10.5% |

  §7.4: race losses 68% takeover / 30% company-loss; safe losses 64% other-first; mixed +47.5 pp over both extremes;
  passive takeover-type 64%. Choices vs world (final Mis): bot policy 65%, world 22%, rest 14%. E5 14/17.

**UI.** `panels/Products.tsx` + `products.css` replace `Deployments.tsx` / `deploy.css` (route `products`, nav
"Products"; good-ui pass). Per product card: package (model select with measured L, mini free-tier select on Chat/API,
monitor select with catch rate and its breakdown tooltip, run cost with monitor overhead), revenue hero with the
30-day trend and a line of the last months, customers, share of segment spend vs the best rival product, binding cause
with its best lever and gain (capacity → serving compute, price → cheaper tier, quality → a better cleared model; click
previews it), features (built → switch, building → ETA, buildable → cost + Build, locked → its idea, opens Research),
settings (tier, safeguards with usage policy in the tooltip, KYC on API/Agents, effort with deep think locked with its
reason, Retire). An edit opens the before → after popover (changes, customers, revenue, all products, share, catch,
binding, serving need, run cost; Apply / Cancel; "stays live", "from <date>"). Launch card (product picker; Agents shows
the time-horizon bar vs 4 h). Serving card (home `servingSplit`): bar by product with what Auto cuts as a dashed ghost,
Auto switch (off = per-product sliders), the Auto order with $ per H100e-yr, Budget link. Header: upgrade policy with
"N on an older model", auto-evaluate. New glossary terms: product, priceTier, freeTier, monitor, catchRate, runCost,
autoServing, servingCut, upgradePolicy, autoEvaluate, feature, sectorPack, timeHorizon, segmentShare, bindingCause,
revPerH100e; channel, priceIndex, effort, servingShare, capacityBound, evalGate, spareTraining rewritten. `Tip` takes a
`style`.

**Deviations / deferred.**
- Calibration line above (serve-cost exponent). Per-channel revenue no longer tracks R5 (Auto rule, user decision).
- stub:slow SC +18 d vs R5 (outside ±10 d) from the requested staleness fix.
- Monitors catch model-behaviour incidents, not misuse (safeguards cover misuse); default package = no monitor (exactly
  today's behaviour). R7 generalises monitors to internal uses (the same `catchRate`).
- Price on a product that is not the player's best candidate in a sector (e.g. API when Enterprise carries the level)
  changes revenue per H100e but not demand: a pre-existing property of the mix (one player candidate per sector).
- Customer counts are revenue ÷ a revenue per customer [D] (readout only).
- Scratch scripts `scripts/v2/_r6*.ts`, `scripts/v2/shots/_r6shot.mjs` are gitignored; the R5 baseline worktree is
  `C:\tmp\r4\base` (now detached at 1299436, `node_modules` junction): remove the junction with `rmdir` first, then
  `git worktree prune`.

**Notes for R7.** `catchRate(s, watched, monitor)` and `monitorOverhead` are ready for internal packages; the
`products` system (155) is the place for package policies. Product kind `internal` exists on the internal deployment.
Features with incident multipliers are the hook for R8's risk families. The Agents gate reads the measured horizon
bench (V0 has none until its first auto-eval at day ~10).

## R5 Build queue and blueprint (2026-11-17, branch `game-structure`, worktree ../AI27-structure)

Per design/BUILD-PLAN.md §2 R5, TECH-TREE §1.4–1.5, STRUCTURE §4.1/§4.3 (rules R5, R11), mockups-v3/v3-blueprint*.

**Size (data `runDesign.ts`, `design.ts`, `runs.ts`).** `BaseDesign.scale` → `size` (× F(t)). `BASE_SCALE` and
`BASE_MAX_DAYS` are gone; functions of size pass through the old scales (compact 0.1 / frontier 1 / stretch 3) and extend
log-linearly: `sizeMinDays` (42 / 90 / 120 d), `sizeS5` (−0.1 / 0 / +0.2; also in safety/traits baseSignals),
`sizeRestart` (0 / 0 / 0.1, ×0.5 with Fault-tolerant training), `sizeScrutiny` (+5 at ×3). Serving cost of a base =
shape's size-1 cost × √size (MoE ×1 = 0.5 exactly; dense 1.0, overtrained 0.3, latent 0.2); the efficiency ideas
(`serveTechMult`: quantization, speculative decoding, AI kernels) and the CoT factor multiply it on new versions.
`SIZE_RANGE` [0.1, 8], UI snap points ×¼…×8. `planRun` returns `limits` (wall time, `behindMonths` = know-how gained
during the run at today's rate, tokens needed ∝ √FLOP vs usable stock and the data-wall Δp, restart risk, serve cost,
compute-equivalent cost, scrutiny), `effShare` (the share the run would get today), `setupTW`/`setupDays`; ETAs
include the wait for engineers and use the effective share.

**Pools.** `poolAllocation` is proportional: runs that train get their pool share; if together they ask for more than
the pool after the stream (15%), all scale by one factor. Runs waiting for setup, restarting after a loss spike, or
with their FLOP done (only waiting for their minimum length) take no share. `idleTrainingShare` = what nothing uses.
`runs.setShare` changes a running run's share (run queue −/+); `POOL_SHARE_RANGE` lowered 0.1 → 0.02 (RefBot's
distills got 2–4% under the old priority rule). `runEtaDays` for the run queue.

**Spare training compute (R5 rule "nothing wasted silently").** New policy `player.policies.spareTraining`:
`'research'` (default: `labInputs` adds the idle training H100e to experiments, `c` and `abs.Cexp`; `bestMix` takes it as
a fixed offset `c0` so the auto mix accounts for it; response curves keep it fixed) or `'data'` (synthetic-token
accrual). Action `runs.spareTraining`; shown in the run queue. **RefBot uses `'data'`**: AI 2027's research compute is
fixed by its usage table (shareRef) and data never binds on the reference path, so its cadence gaps must not raise
experiments. Measured idle-to-research speed-up (RefBot stub with `spareTraining: 'research'`, seed 2027): SC −59 d
(ai2027), −145 d (authors2026), −60 d (fast), −213 d (slow); ASI −62 / −211 / −68 d. RefBot leaves ~7–10% of its
training pool idle (one post-train between launches; base runs while the stream runs, when it posts nothing). That is
far beyond a ±0.03 CAL_SHIFT refit, hence the policy. The start run R0 now asks the whole pool (it finishes its FLOP
within days and then frees it), so a new game has no idle compute at day 0 (T4 unchanged).

**Build queue (`departments/build.ts`).** `player.build {queue: BuildItem[], nextId}`; `BuildItem {id, kind
runSetup|feature|harness|safeguard, ref, needTW, doneTW, priority, day}`. `buildSystem` (daily, order 38): capacity =
`buildCapacity` (Σ eng heads/150 × quality × min(10, 1/(1−A_eng))) / 7 team-weeks a day, worked in priority order;
a finished setup sets `run.readyDay`. `launchRun` queues the setup (`runSetupTW`: base 0.4 × size^0.75, continue 0.25,
post 0.1, distill/IDA 0.05); a run trains only after it ("waiting for engineers" in `runStall`). Sized so RefBot's
setups finish within the day in every world (its 4 teams build 0.6 t-wk/day in the slow world, 3 in ai2027): a
3 t-wk base (first try) delayed RefBot runs 1–5 days and the post cadence cascaded (finish days off by up to 3
weeks). Action `build.first`. Setups of cancelled runs leave the queue. Loss-spike rolls start once a run trains.

**Bots.** `launchBase(size)`: RefBot ×1, race ×3; the old 150-day cap is now the bot's own rule (`BOT_MAX_BASE_DAYS`,
at the requested share), stepping ×3 → ×1 → ×0.1 as before. `syncPoolShares`: RefBot sets each running run's share to
what the pre-R5 priority rule gave it (base/continue first, the rest share what is left; shares under the 0.02 floor
raised and the others scaled), acting only when a share changes, so its effective shares equal R4's.

**Save.** `SCHEMA_REV` 7; cheap migration 6 → 7 (scale → size, empty build queue, spareTraining 'research'), checked on
the three rev-6 fixtures (load, 30 d RefBot, plain JSON). Fixtures regenerated.

**UI.** `panels/Blueprint.tsx` + `blueprint.css` replace `RunDesigner.tsx`/`runs.css` (route `blueprint`, nav
"Blueprint"; good-ui pass, screenshots checked): kind tabs; size card (home `runLimits`: ×N hero with FLOP, snap
track with FLOP per point, latest-base tick, ghost of the previous size; seven limit tiles — wall time, behind at
finish, data, cash, restart risk, serving cost, engineers — each with status border, bar, `old → new` after a size
change and a tooltip with breakdown and source); slot table (home `blueprintSlots`) grouped Backbone / Training /
Scaffold with "change = …" headers, the selected card, up to four alternatives (+N), locked cards naming their idea and
its progress (click → Research with the idea open), and per-row contribution vs the reference card (capability with a
domain tooltip, time, cash, serve ratio, four risk families with per-trait tooltips); predicted model card (ruler vs
the internal model, top domain chips, risk-family pressure); plan card (pool-share pills, "gets X% now", ready date,
Gantt with running runs as bars, setup wait, base → post → evals, know-how wedge, Start). The next-model gates bar and
the S1–S8 / trait-push card are gone (demoted to tooltips, per the IA note). Run queue (Models): actual share (asks /
gets), −/+ share, ETA date, stall reason, stream row, spare row with the policy switch. Company › People engineers:
build queue backlog and items in the capacity tooltip. New glossary: baseSize, frontierRun, wallTime, behindAtFinish,
dataTokens, restartRisk, faultTolerant, buildQueue, runSetup, teamWeek, poolShare, spareTraining, riskFamily,
blueprint; `scale` removed; baseRun, trainingPool rewritten.

**Gates.**
- `npm run typecheck`, `tsc -p scripts/v2`: clean. identity and golden-timelines unchanged and passing.
- **ref-trace vs the R4 reference** (recorded at 72e16c0 into a temp file): milestones and paradigm adoption days
  identical in all five traces; base/post finish days within 1 d (worst: stub:fast base +1 d; one post launched on the
  trace's last day is cut off); every other category within tolerance. `scripts/v2/golden/ref-trace.json` (R1) kept.
- calib: T1, T2, T1L, T3, T4 pass with **no refit** (T1 SC Δ unchanged: ai2027 +0.003, authors2026 −0.044, fast −0.049,
  slow −0.038 y). New check **"R5 build queue never delays a RefBot run > 3 d"**: worst wait 0 d in all four stub worlds
  and all four integrated runs.
- test:v2 scripts individually: golden-timelines, identity, calib, fixtures, lint-hidden, lint-ux, lint-tradeoffs,
  safety, finance, ws4, money pass; hygiene passes except the known absolute performance budget (system table gains
  `build`); worldfx: the two known failures only (HireRate_SOFT 2027-01-07, GOV T1 Accept 2028-03-31; unchanged).
- Performance (`_perf.ts`, seed 9, 1,500 days, passive player; R4 worktree at 72e16c0 and R5 alternated 4 × 3 runs on
  a loaded machine): daily 1,715 µs (R4) vs 1,766 µs (R5), +3%; worst quarter 7.4 vs 8.0 ms (+8%, noise-level). No
  regression > 10%.
- `npm run test:ui`: 153/153 (new Blueprint section: 7 limit tiles, layer groups, ×4 changes wall time with
  before → after tiles, ×4 serves at 2× (√size), tile tooltip states its rule, locked card names its idea and opens it
  in Research, architecture pick, pool-share pill, save; run queue actual share + ETA, − share, spare-training switch;
  Company build queue). Screenshots 43 and day-400/900 blueprint checked.
- **Bots, 40 seeds:** all six §7.4 criteria MET (safe win 5.0% sits exactly on the ≤ 5% cap).

| bot | win | mixed | loss | med. day | top endings |
|---|---|---|---|---|---|
| race | 0.0% | 7.5% | 92.5% | 804 | asiTakeover 57.5%, ousted 17.5%, nationalized 10% |
| safe | 5.0% | 0.0% | 95.0% | 1480 | overtaken 55%, ousted 37.5%, rivalAligned 5% |
| mixed | 55.0% | 5.0% | 40.0% | 1065 | asiAligned 55%, ousted 15%, asiTakeover 10%, nationalized 10% |
| capex2x | 2.5% | 0.0% | 97.5% | 304 | insolvent 95% |
| ref | 22.5% | 0.0% | 77.5% | 972 | asiTakeover 37.5%, asiAligned 22.5%, ousted 17.5% |

Choices vs world (final Mis): bot policy 70%, world 17%, rest 13%.

**Deviations / deferred.**
- Spare-training policy (not in the plan) with RefBot on 'data', instead of a CAL_SHIFT refit (see above). All bots use
  refPlay's 'data'; the player default is 'research' — a strong lever worth a balance look (it is equivalent to moving
  that compute into experiments with the split).
- Setup costs are small ([D], sized to stay non-binding for RefBot); R6's features are the real build load.
- The wall-time tile uses today's training pool, not the chip-delivery forecast (the IA note's resolved item); the
  tooltip says so.
- Blueprint's "planned package" line (R7) and Honesty/Anti-scheming alignment cards (R8 nodes) are not shown; the
  Alignment row keeps today's options (standard / heavy / minimal safety training, inoculation).
- Removing the scratch file `scripts/v2/_r5noidle.ts` was denied (gitignored, harmless). Scratch `scripts/v2/_r5*.ts` and
  `scripts/v2/shots/_r5*.mjs` are gitignored. The temp baseline worktree `C:\tmp\r4\base` now sits at 72e16c0
  (detached, `node_modules` junction): remove the junction with `rmdir` first, then `git worktree prune`.

**Notes for R6.** `queueBuild(s, kind, ref, needTW)` and `BuildItem.kind` 'feature' | 'harness' | 'safeguard' are ready
for feature builds (Scaffold-layer nodes); `buildEtas` gives per-item ETAs and `build.first` reorders. The blueprint's
Scaffold row links to Deploy (rename to Products). Serving cost now grows with √size: a ×3 race base serves at 0.87
(internal agents' ηmod falls), which R6's Auto serving split should account for. The worldfx GOV T1 Accept failure is
unchanged.

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
