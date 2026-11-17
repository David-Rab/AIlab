# Jank audit (2026-11-17)

Branch `jank-audit` from master 8e20a5a (tycoon restructure R1–R10). No game code changed.

**Yardstick.** STRUCTURE §1 rules R1–R11 and the good-ui standard (hierarchy, visuals, terse text, tooltips,
cause → effect, controls). Jank = strange, obscure, annoying, not shown, not controllable, overwhelming, broken.
Known issues from PROGRESS (Enterprise $0 late, idle science teams in bots, +495% diffusion line, product-card
truncation, unwinnable follower starts) are included only where the *presentation* is the problem.

**Method.**
1. **UI, every screen and tab**, headless Edge (1680×1000), 10 states: leader day 0 / 200 / 400 / 900, challenger,
   big tech and spinout day 0 and day 400. 278 panel shots plus a scrolled shot wherever the panel scrolls
   (`scripts/v2/_audit_shots.mjs`; extra fixtures from `_audit_fx.ts`: leader day 200 with the fixtures.ts method,
   follower day 0, big tech day 400 with RefBot).
2. **Verbs as a player** (`_audit_play.mjs`, `_audit_order.mjs`): new leader game through Setup; open a node card,
   assign a team, hire, change a monitor (preview), edit a live product (preview + apply), toggle the upgrade policy,
   start a base run, order chips, build a site, rent cloud, raise; 17 tooltips; then 209 in-game days at speed 4.
   From the day-400 fixture: 220 more days at speed 4 with pause-on-decision (`_audit_play2.mjs`).
3. **Tooltip coverage**: on 15 screens (day 400) every visible leaf element containing a digit (sampled to ≤ 40 per
   screen) was hovered; a `.tip` must open.
4. **Mechanisms** (`_audit_mech.ts`): 4 starts × passive / mixed / ref (+ race on leader) × 3 seeds to day 1,100,
   weekly samples of measured L, internal model vs best ready model, idle stocks, build queue, product revenue, cash,
   Watch items, decisions. Raw output in Appendix A.
5. **Every screenshot looked at** against good-ui.

Screenshots: `design/ux/audit-2026-11/` named `<start>-d<day>-<screen>[-<tab>][-scrolled|-<state>].png`
(`all-*` = start and setup screens, `*-tip-*` = tooltips, `leader-play-*` = the in-app run).

---

## Summary: top 10 by impact

| # | Id | Issue (one line) |
|---|---|---|
| 1 | R1 | Science teams sit idle by default: at day 0 the leader has 8 of 10 capability science teams idle, and "Auto-assign idle teams" does nothing because it only takes queued projects and the queue starts empty. Idle in 55–63% of weeks even for the scripted bots, 90% for big tech, 100% for a passive player. The only signal is a nav badge. |
| 2 | M1 | Measured capability of an unchanged model jumps ±0.5 L every 30 days, because Auto-evaluate re-rolls `measuredL = Lg + N(0, 0.2)`. The top-strip capability, the race chart, Safety's chart, understanding and the upgrade policy all inherit this noise (a fixed model gives 9–12 weekly "regressions" per game). This breaks R9. |
| 3 | P1 | Engineers never bind: the build queue was empty in 100% of sampled weeks in every start and bot. Run setup takes 0.4 team-weeks, against 20–78 team-weeks per week of capacity. Hiring engineers is pure payroll ("+1.0 build" buys nothing visible), which breaks R8. |
| 4 | PR1 | Serving compute is starved at the start and idle later. On day 0, Enterprise is "cut by Auto" (988K H100e short) and a Watch alarm is up. Later, more than 25% of the serving pool sits idle in 63% of passive-leader weeks, 52–59% of challenger weeks and 93–100% of big-tech weeks. Serving is a manual % of compute, and spare serving has no default use (R5). |
| 5 | B1/B2 | Blueprint card table is broken. The "change" column squeezes text into one-word lines that overlap ("new / base / run", "engineering / build, no / training"), and the five effect columns show only "ref" or dots, so you can't compare cards (STRUCTURE §4.3). |
| 6 | M3 | There is no policy to keep internal agents on your best model. A passive leader runs Atlas-1.0 internally for 3 years while a better Atlas-1.1 is ready (36% of weeks; big tech 47%). The product upgrade policy is off by default. |
| 7 | F1 | "Why cash moved · 30 d" really covers about 17 days. The cause ledger is a 40-entry ring buffer filled by daily revenue and opex lines, so on day 400 revenue shows +$2.2B against about $3.8B for 30 days. The numbers don't add up. |
| 8 | O1 | Only about 34% of numbers have a tooltip (116 of 338 sampled on 15 screens). Zero on the Research-speed card, Compute › Split and Overview; 1 of 15 on Risk; 5 of 37 on Blueprint. |
| 9 | C1 | Order / Build / Rent commit in one click with no runway preview. Three default clicks at day 0 took runway from "8q+ healthy" to "4.0q tight" and created "1.3M H100e arrive with no racks", which was only warned after the fact. The cost chips "−$3.5B −$8.1B" are unlabelled. |
| 10 | RL1 | Relations is a wall: an 11-row counterparty table whose Favors and Dependence columns read 0 / 0 everywhere, a government block of codes ("reg −81", "G-SEC Briefings", "De-escalation D0"), 19 blocs and a 40-button action catalogue marked "▲T ▲C", with Retire (which ends the game) among them. |

**Counts:** 0 Blocker · 19 Major · 29 Minor · 15 Polish (63 findings).

---

## Catalogue

Columns: id · severity · category · screen/system · what the player sees · why it's jank · proposed fix · effort ·
screenshot (in `design/ux/audit-2026-11/`).

### People

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| P1 | Major | Strange | Company › Agents & teams | "×5 shared pool · build 50.0 team-wk/wk · queue **empty**"; at day 900, 7 engineering teams (1.1K people) paid while AI does 100% of engineering. Offers still sell "+1.3 build". | The build queue was empty in 100% of weekly samples in every start and bot (Appendix A). Run setup costs 0.40 t-wk ("built within a day") and a feature 2–6 t-wk. Engineers are a cost with no effect, which breaks R8 (no return) and R5 (silent waste). | Make build demand real (run ops scale with size and count, features and harnesses take weeks, upkeep per live product), or show "engineers idle N%" as an idle stock with a let-go hint. Show what "+1.0 build" buys. | M | leader-d400-company-people, leader-d900-company-people |
| P2 | Major | Not shown | Company › teams | 12 science cards read "Pretraining · 40 people"; you can't tell which are on a project and which are idle. | One home for assignment is Research, but the team card should show its state (R3 readouts). | Project chip or "idle" tag on each science card; click goes to the project. | S | leader-d400-company-people |
| P3 | Minor | Obscure | Company › teams | Unlabelled quality dots (●●○), "labour h 1.01", "taste ×1.00", "build 50.0 team-wk/wk", "17 wk · until 6 d" on offers. | Jargon on the surface; offer and science-card hovers open no tooltip. | Words or icons with tooltips (Solid / Strong / Elite; ramp time; offer expiry). | S | leader-d0-tip-offer, leader-d0-tip-scicard |
| P4 | Minor | Annoying | Hiring policy | Keep-hiring keeps adding science teams that then sit idle (day 400 → 621 passive: idle 0 → 16). | R5: the policy creates idle stock with no prompt. | Don't fill science targets while teams are idle, or flag the target amber with the count. | S | leader-d621-overview-run |
| P5 | Polish | Obscure | Team picker | 8 identical rows "Pretraining team ●●○ idle". | You can't tell teams apart. | Team names or numbers; sort by bonus. | S | leader-d0-research-teampicker |

### Research

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| R1 | Major | Not controllable | Research, policy | Day 0: "2 · 10 science teams · 8 idle" with Auto-assign **on** and the queue "Empty". After 209 days of play, still 8 idle. | Auto-assign takes only queued projects, so the default policy does nothing (R5, R6). Idle in 55–63% of weeks for bots, 90% for big tech, 100% passive. The alert is a nav badge only (no Watch item by design). | When the queue is empty, auto-assign picks the best open project in the team's specialty (shown with "auto" tag), or seed a default queue. Add a one-click "fill idle teams" next to the count. | M | leader-d0-research, leader-play-d200-research, spinout-d0-research |
| R2 | Major | Strange | Research › Active projects | Day 400: 10 of 12 teams stacked on "Continual learning" (√ capacity), 2 projects with one team each, queue empty. When it finishes, all 10 go idle at once. | A policy that wastes capacity (diminishing returns) and causes idle waves. | Spread across the N best projects. Show the marginal ETA gain of each extra team in the picker (it already shows "→ 57 d"). | M | leader-d400-research-scrolled |
| R3 | Minor | Obscure | Tree nodes | Each node: two to three tiny icons + "B S · 95%", "T M · 60%", "L XL · 70%". | Layer and effort letters are codes. The legend covers only some of them. 7 of 35 numbers on the screen have a tooltip. | Icons for layer and effort with tooltips; odds as the only number. | S | leader-d400-research |
| R4 | Minor | Broken | Tree | "needs Automated A…", "Iterated distillation & amplificat" spills past its card, "retry Oct 24, 20…", the DEPTH-4 column cut at the right edge with "+1" stubs. | Truncation and overflow. | Wider nodes or two-line names; horizontal scroll indicator. | S | leader-d400-research, leader-d0-research |
| R5 | Polish | Obscure | Active projects | "odds: Promising" for safety and "odds: 70%" for capability; ETA "7.6 mo" next to "76 d". | Two meanings under one label; mixed units. | "health" for safety lines; one unit. | S | leader-d400-research-scrolled |

### Models and Blueprint

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| M1 | Major | Strange | Top strip, Overview race chart, Safety chart | The capability of an unchanged model moves up and down: passive leader Atlas-1.0 reads 4.75 → 5.76 → 4.75 over 3 years; the spinout's only model 3.25–3.77; the race chart shows dips (day 400: Jul 7.15 → Aug 6.85). | `products.ts:189` re-runs the suite every 30 days, and `benchmarks.ts:81` redraws `measuredL = Lg + N(0, 0.2)`. This breaks R9 ("never a fake regression from noise"). 9–12 weekly drops per game for a fixed model. | Measured L is an estimate that narrows with each eval (running mean with a band). It is monotone for a fixed model and never redrawn. | M | leader-d400-overview-scrolled, leader-d400-safety-overview |
| M2 | Major | Strange | Overview / Safety charts | Understanding spikes (day 900: 7.5 → 10.2 → 7.3 within weeks; 7 → 10.6 on "today"). U moves in lockstep with measured L (passive trace: U = L + 1.1 to 1.2 every week). | It looks broken (good-ui: spiky artefacts) and makes U read as a function of the noise. | Tie to the M1 fix; smooth tool-decay steps; show why U moved in the chart tooltip. | M | leader-d900-overview-scrolled, leader-d900-safety-overview |
| M3 | Major | Not controllable | Company › Agents, Products | The passive leader keeps Atlas-1.0 as the internal agent while Atlas-1.1 is ready (36% of weeks; big tech 47%). "Upgrade to newest cleared model" (products only) is off by default. | R5/R6: a better model sits unused with no prompt; internal packages have no policy. | One "Use best cleared model" policy for products and internal packages, on by default, with per-package overrides. Watch item when a better model is idle. | S | leader-d400-models, leader-d400-products |
| M4 | Minor | Strange | Models › Lineage | Atlas-2.5 (newer, L 6.9) is the internal model; Atlas-2.4 (L 7.2) is "ready" and unused. | Version numbers imply progress; nothing marks the best version. | "best" badge per variant; warn when a package is moved to a worse model. | S | leader-d400-models |
| M5 | Minor | Obscure | Models › Runs | "post 21 post", "post 23 post", "distill 17 distill", "base 19 base"; the Atlas-3 header has no row and no note. | Internal ids and doubled words; finished base not explained. | Name runs by their target ("Atlas-2.6 · post-train"); show "Atlas-3 base: done, needs post-training". | S | leader-d400-models-scrolled |
| M6 | Minor | Not controllable | Products › Agents | Day 0: "Launch Agents" disabled, "needs a measured time horizon (run the eval suite)" though Auto-evaluate is on. | Atlas-1.0's start evals have no horizon, so the product is blocked up to 30 days or until the player clicks Own evals (R7 chore). | Start evals include the horizon, or evaluate on launch. | S | leader-d0-products, leader-d0-tip-agentslaunch |
| M7 | Polish | Not controllable | Models (spinout) | "Distill a mini" enabled on the imported model; the engine refuses it ("must be post-trained first"). | A control that fails. | Disable with the reason in its tooltip. | S | spinout-d0-models |
| B1 | Major | Broken | Blueprint card table | Backbone, Training and Scaffold rows: the "change" column wraps text into one-word lines overlapping the cards ("new / base / run", "post- / train / on a / base", "engineering / build, no / training" over "effort · tools…"). Every start, every day. | Layout bug on the main design screen. | Fix the column width / move the row note into a tooltip. | S | leader-d400-blueprint, spinout-d0-blueprint |
| B2 | Major | Not shown | Blueprint card table | Columns CAPAB / TIME / CASH / SERVE / 4 risk icons show "ref" or "·" for every option. | STRUCTURE §4.3: every card shows its effect in five fields; now you learn effects only after picking (top tiles change). No trade-off is visible before commit. | Fill the cells with Δ vs reference (signed, coloured); tooltip with the source. | M | leader-d400-blueprint |
| B3 | Major | Strange | Blueprint (spinout, also big tech) | The spinout's default proposal is ×1 of today's frontier: wall time 4,855 d, ready Jan 1, 2039, timeline axis to 2036, "behin(d)" cut off at the right. | A default that can never finish; the first thing a spinout player sees is nonsense. | Default size = largest that finishes in about 6 months on your pool; infeasible sizes shown red with the reason. | S | spinout-d0-blueprint |
| B4 | Minor | Obscure | Blueprint | "3.7e27 FLOP", "9.2e26", "0.40 t-wk", "×0.5 with FT training" on the surface. | e-notation and abbreviations at L1. | Size as ×multiple only; FLOP in tooltip. | S | leader-d400-blueprint |

### Products

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| PR1 | Major | Not controllable | Products › Serving, Compute › Split | Day 0 leader: Chat 253K, API 95K capacity-bound, Enterprise 0 "cut by Auto" (+988K short), Watch "serving compute short". Challenger day 0 the same. Later: "demand below serving · 252K H100e spare" (day 400), spinout 7.2K of 25K idle from day 0, big tech idle 93–100% of weeks. | The serving pool is a manual % of compute; Auto only divides the pool. Spare serving has no default use (R5), and a shortfall has no policy (R6). Known "Enterprise $0" is one symptom. | Policy "serve demand": the pool tracks demand up to a cap, spare flows to research, shortfall shows the cost to cover it. | M | leader-d0-products, challenger-d0-products, leader-d400-overview, spinout-d0-overview |
| PR2 | Major | Obscure | Top strip, Products, previews | Day 0: strip "$12.0B/yr"; tooltip lists Chat / API / Enterprise at "$0.0B/yr" each; product cards "$0.0B"; the edit preview says "All products $14.9B/yr". Day 400: strip $46.5B, cards sum to $41.5B. | Three revenue definitions (30-day smoothed, instantaneous, projected) without labels. Numbers don't reconcile. | One definition per place, labelled ("30-day avg" vs "now"); seed product rates at start. | S | leader-d0-tip-revenue, leader-d0-products-edit-preview |
| PR3 | Minor | Obscure | Product cards | Model chip "Atlas ▾" (Chat and API actually run Atlas-2.2-mini, seen only on Risk › Flows); "Deep thi…", "Companion …"; serving bar labels "K", "C API", "API · capacity-bou…". | Truncation hides which model a product runs (known, now confirmed in 7 states). | Wider chip or model in the card header; abbreviations with tooltips. | S | leader-d400-products, leader-d900-products |
| PR4 | Minor | Broken | Product edit preview | The before → after popover overflows the card ("$9.8B/yr ▼" over API's SHARE) and hides the features. | Overlap. | Anchor the preview inside the card or as a side sheet. | S | leader-d0-products-edit-preview |
| PR5 | Minor | Strange | Binding chip | "capacity-bound → +0 H100e serving +$0M/yr" (challenger day 0), "quality-bound → Atlas-4.0 −$0M/yr" (day 900), Chat "quality-bound" with 84% share. | Advice with zero or negative gain. | Hide ≤ 0 suggestions; say what binds in words. | S | challenger-d0-products, leader-d900-products |
| PR6 | Minor | Not controllable | Products / Company › Security | KYC set on product cards (API 0–3) and again in Company › Security "KYC per channel". | Two homes for one control (good-ui one home). | Keep KYC on products; Security links there. | S | leader-d400-company-security |
| PR7 | Minor | Obscure | Products (spinout) | "Launch Chat" disabled: "Chat needs a full/mini model". | It doesn't say the fix (post-train the import, D6). | "Post-train the import to sell it → Blueprint". | S | spinout-d0-products |
| PR8 | Polish | Strange | Agents card | Time horizon "> 1000 yr / 4 h". | Silly value. | Cap the display ("> 1 yr"). | S | leader-d900-products |

### Agents (Company › Agents at work)

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| AG1 | Minor | Strange | Agents, monitors | Default monitor on routine and frontier research is "copy of Atlas-2.5 · catch 89%". | A model watching itself shows a high catch rate with no collusion caveat on the surface (STRUCTURE §4.9 risk). Verify the catch model. | Show "same model: collusion risk" on the chip and lower its catch accordingly. | S | leader-d400-company-people |
| AG2 | Minor | Obscure | Agents lanes | "17K CAP / 7.1K × 17" (copies × speed), "$160M" next to "$0.0B", four unlabeled risk icons per lane (legend at the bottom). | Codes and mixed units. | Tooltips; one money format; family names on hover. | S | leader-d400-company-people |
| AG3 | Minor | Not shown | Safety research lane | Model "as routine · Atlas-2.5" with 0 compute and "Trusted to AI 0% locked"; at day 900 every capabilities role is 100% AI while safety stays 0% with no prompt. | Looks active, does nothing. The gate isn't explained where it binds. | Show "off" state; name what unlocks the gate (the node) and its max. | S | leader-d900-company-people |

### Safety

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| S1 | Minor | Strange | Safety overview | Verdict "Understanding ahead of capability" while 2 of 4 families are "unseen (thin evidence)"; at day 900 all four bands are identical ±0.35. | The verdict ignores what you can't see. | Verdict includes family visibility ("ahead, but 2 families unseen"). | S | leader-d400-safety-overview, leader-d900-safety-overview |
| S2 | Minor | Obscure | Race tooltip day 0 | "Tools validated to L 12.1" while understanding is 6.4; "Trusted monitoring decayed 100%, CoT monitor decayed 100%" at day 0. | Contradictory readings on the main meter. | Explain "validated to" vs U; don't list decay at start. | S | leader-d0-tip-race |
| S3 | Minor | Obscure | Investigations | "in Atlas-2.5 with 15 engineers" next to "100 research engineers free". | "engineers" collides with the Engineer role. | "safety research engineers". | S | leader-d400-safety-cases |
| S4 | Polish | Overwhelming | Investigations, Incidents, Research lines | Two tabs are one line each on an empty page most of the game; Research lines uses a third of the screen. | Dead space; tabs with nothing. | Merge into one "Cases" tab, shown with a count; hide when empty. | S | leader-d400-safety-cases, leader-d400-safety-incidents |
| S5 | Polish | Obscure | Trait graph | S1–S8 signal names and a 9×10 heatmap of raw numbers. | L2 screen, but STRUCTURE §7 moved S1–S8 to tooltips. | Icons + tooltip for signals; heatmap colours only, numbers on hover. | S | leader-d400-safety-graph |

### Compute

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| C1 | Major | Not shown | Compute forms | Order, Build, Sign commit in one click. Three default clicks at day 0: cash $40B → $35.8B, runway "8q+ healthy" → "4.0q tight", and then "1.3M H100e arrive with no racks". | good-ui: every action shows its consequence before commit (cost in one currency, gain in another). Cost chips "−$3.5B −$8.1B" are unlabeled (deposit vs total). | Before → after for cash, runway and racks in each form; label the chips; warn about racks before ordering. | M | leader-d0-compute-after-order-build-sign |
| C2 | Minor | Obscure | Compute › Market | "Your order weight 1.35", "Taiwan risk 0.35" unitless; HBM "binding" while supply 6.4M > demand 4.8M. | Unexplained numbers; looks contradictory. | Units/words; explain binding (your share vs component). | S | leader-d400-compute-market |
| C3 | Minor | Obscure | Compute overview vs Sites | "Red River ≈ Q4 29" on the chart, "power → Oct 2027" on Sites. | Two dates, no milestone names. | Name the milestone ("powered", "live"). | S | leader-d400-compute-overview, leader-d400-compute-sites |
| C4 | Polish | Overwhelming | Sites, Orders, Market tabs | Each uses under 40% of the screen. | Dead space, extra clicks. | Fold into Overview sections. | M | leader-d400-compute-orders |

### Finance

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| F1 | Major | Broken | Finance › Why cash moved · 30 d | Day 400: Revenue ×18 +$2.2B, Opex ×18; Payroll, Cloud ×1 each. | `CauseLedger` keeps 40 entries per key; daily revenue and opex fill it, so revenue covers days 383–400 only (≈ 55% of 30 d). The title lies. | Aggregate cash causes per day and source, or keep 30 days for `cash`. | S | leader-d400-finance |
| F2 | Major | Strange | Finance (big tech), top strip | Day 0 cash flow: Revenue $0, Payroll −$1.1B, **Net burn −$1.1B**; the $4B parent payment is not a bar. Day 400: cash −$5.5B, "0.0q distress", loop "Cash · runway distress" for a division that "cannot go broke". Cash < 0 in ≈ 50% of weeks (mixed / ref). | False readout; the distress verdict has no consequence for this start. | Parent payment as an inflow bar; a division verdict ("over budget by $X; parent covers") instead of runway distress. | S | bigtech-d0-finance, bigtech-d400-overview |
| F3 | Minor | Overwhelming | Finance | First glance: 9 cards (cash flow, history, raise, locked-in, why cash moved, board, ownership, markets, debt, deals). | good-ui: 2–4 L1 visuals. | L1 = cash flow + history + raise; the rest in tabs. | M | leader-d400-finance, leader-d400-finance-scrolled |
| F4 | Polish | Broken | Finance | "Northwind Clou…" board seat; "100% of spend" overlaps "Payroll & ops" (big tech); Recapitalise / Refuse recap greyed for a division. | Truncation, overlap, dead controls. | Wrap; hide inapplicable controls. | S | leader-d400-finance-scrolled, bigtech-d0-finance |
| F5 | Polish | Obscure | Finance › Raise | Raise closes instantly ("Round closed: $5.1B") with no before → after for stake and runway on the button. | Consequence shown only as chips (stake −2.7%). | Inline before → after. | S | leader-d0-finance-raised |

### Relations

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| RL1 | Major | Overwhelming | Relations | 11-row counterparty table (Favors 0, Dependence 0 / 0 for all), government block of codes ("populist · AI priority 64 · reg −81", "G-SEC Briefings", "China rung Acquire", "De-escalation D0", "Theft intent · Taiwan 26 · 35"), 19 blocs, 40-button action catalogue with "▲T ▲C". | Fails first glance, terse text and hierarchy; dead columns. | L1 = the four header meters and "who matters now" (top 3 counterparties); catalogue behind verbs; drop zero columns until used. | L | leader-d400-relations, leader-d400-relations-scrolled |
| RL2 | Minor | Not controllable | Relations / Company / Risk | Security actions in three places (Company › Security, Relations › Security, Risk › Sources buttons); "Retire" (ends the game) as a plain catalogue button. | One home per control; a game-ending verb with no weight. | One home (Company › Security) with links; Retire in the menu with a confirm. | S | leader-d400-relations-scrolled, leader-d400-risk-sources |

### World and Risk

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| W1 | Polish | Obscure | World | A second "Technology tree" (world technologies) next to Research's tree; Moonshot button greyed beside its slider. | Name clash; unclear control. | Rename "World technologies"; say why Moonshot is off. | S | leader-d400-world |
| RK1 | Minor | Not shown | Risk › Sources | DeepCent 12.6%, xLab 11.1% (97 days behind), your models 1.5%; 1 of 15 numbers has a tooltip. | You can't see why a lab far behind is the second-biggest risk. | Breakdown tooltip per row (drivers, which lever moves it how much). | S | leader-d400-risk-sources |
| RK2 | Polish | Obscure | Risk › Flows | "lead +97d" under rival nodes. | Whose lead? | "you +97d ahead". | S | leader-d400-risk-flows |

### Overview and shell

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| O1 | Major | Not shown | All screens | About 34% of numbers open a tooltip (Appendix B). Zero: Research-speed card (338K, 40K, 1.77×, +3.9% levers), Compute › Split percentages, Overview. | good-ui 4: every number has a breakdown tooltip. | A lint "number without Tip" in lint-ux; fill the gaps screen by screen. | M | (Appendix B) |
| O2 | Minor | Overwhelming | Shell | Five alert surfaces: Watch, bottom alert chip, nav badges, headline ticker, flash. The alert list exists only as a hover tooltip, "right-click to clear" is hidden, and click jumps to a panel chosen by kind. | good-ui: one alert channel with severity; collapse duplicates. | Watch is the channel; the bottom chip opens it; badges mirror it. | M | leader-d621-tip-alerts |
| O3 | Minor | Annoying | Day 0 (all starts) | The first screen shows a problem the player didn't cause: Watch "serving compute short · 2 products capped" (leader), "7.2K H100e spare" (spinout), Research badge 8 / 11. | Bad first impression; fixed by PR1 / R1. | Start states balanced by the PR1 and R1 policies. | S | leader-d0-tutorial-firstscreen, spinout-d0-overview |
| O4 | Minor | Broken | How the race got here | Version labels overlap ("Atlas-3.0Atlas-3.2", "Atlas-4.0 Atlas-4.2" clipped); day 0 a large empty card ("starts after the first week"). | Overlap, dead space. | Label thinning; show the start point at day 0. | S | leader-d900-overview-scrolled, leader-d0-tutorial-firstscreen |
| O5 | Polish | Obscure | Codex, tooltips | "Source: design/STRUCTURE.md §2" (codex), "STRUCTURE §4.2" (know-how tooltip). | Developer references in player text. | Cite research sources or nothing. | S | leader-d400-codex, leader-d0-tip-bp-behind |
| O6 | Polish | Annoying | Nav | The nav tooltip opens over the panel header after every nav click (mouse rests on the button). | Covers the title. | Delay or place the tip to the right edge only. | S | (seen on first shot pass) |

### Events and alerts

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| E1 | Polish | Obscure | Merger offer (decision) | "Decline (default): −30 d lead · happens on its own in 30 d". | The cost of declining isn't explained (someone else buys them?). | One line: "Another lab buys Gemini Labs". | S | leader-d550-modal-decision |
| E2 | Polish | Annoying | Bottom bar | "New decision" flash text stays after the decision is resolved. | Stale message. | Clear on resolve. | S | leader-d621-tip-alerts |

Event frequency is fine (0 decisions in 209 days from day 0, 1 in 220 days from day 400, 3–13 per bot game); no event fired "too often".

### Start types

| Id | Sev | Cat | Screen | What the player sees | Why | Fix | Eff | Shot |
|---|---|---|---|---|---|---|---|---|
| ST1 | Major | Not shown | Spinout, day 0 | 29% of its 25K H100e sits in serving with no product; the training pool is 100% "Spare → data generation"; no product can launch; the default blueprint takes 13 years; Products and Customers are red forever. There is no viable first move on screen. | Accepted as unwinnable, but the screen gives no direction and wastes a third of compute by default (R5). | Start split with 0% serving; a "first move" hint (post-train the import at ×¼); feasible blueprint default (B3). | S | spinout-d0-overview, spinout-d0-products, spinout-d0-blueprint, spinout-d400-overview |
| ST2 | Major | Strange | Big tech | 11 of 12 science teams idle for the whole game (90% of weeks even for bots), serving spare in 93–100% of weeks, revenue decays to ≈ $0.1B/yr per product, cash negative half the time (F2). | The division's assets (people, compute, distribution) do nothing visible. | R1 + PR1 policies; F2 readout. | M | bigtech-d400-overview, bigtech-d0-finance |
| ST3 | Minor | Not shown | Challenger / leader board | 7 of 12 challenger and passive-leader games end "ousted" on exactly day 366, across passive, mixed and ref. | A cliff at the first annual review; the Watch shows "board confidence low" but not when the vote is or what it needs. | Top strip or Finance: "board review in N d: confidence X / needs Y". | S | spinout-d400-overview, challenger-d400-company-flow |
| ST4 | Minor | Obscure | Challenger research-speed limit | "Knowledge diffusion +495% know-how from Polaris AI". | Above 100% reads like a bug (known calibration issue). | Show as "×5.9 your own rate" or "+N months per month". | S | challenger-d400-company-flow |

---

## What works well (keep it)

- **Live product edit** with a before → after preview, "stays live", effective date, Apply / Cancel; the change applies
  in place (R4 met).
- **Agent package preview** (monitor change → catch, cost, research speed before → after).
- **Node card**: effect, odds, retry rule ("after 180 d at 48%"), effort in team-months, unlocks, Start now / Assign /
  Queue. The **team picker** shows the specialty bonus and the ETA change per team.
- **Decision modal** (Merger offer): two clear options with costs as chips and bars, default marked, timer, number
  keys, "Later".
- **Core-loop diagram** on Overview with one verdict per system and a jump to its home.
- **Watch** chains (cause → symptom → fix with a jump button) are the right shape for the alert channel.
- **Top strip** holds 7 L0 items; the race meter (capability vs understanding with "blind" hatch) reads well.
- **Limits** (⊘ marks with rule and source) appear where they bind.
- **Hygiene**: no raw floats, NaN or `undefined` in any of the 278 panel shots; no unresolved glossary terms; no console
  errors in any run.
- Compute capacity chart, cash-flow waterfall, Company flow Sankey and "Who is close" lanes are good L1 visuals.
- Big-tech parent budget card (schedule visible in advance, reason equity is off).
- Speed controls with keyboard hints and pause-on-decision worked (the run stopped on the merger offer).

## Not tested / limits of this audit

- **End screen**: no ending was reached in the UI runs (bot games reached endings in node only).
- **Incident and red-flag response flow** (investigate → respond) and **publishing a result**: no incident fired in
  the UI runs; only the empty states were seen.
- **Tutorial** beyond the first coach card; nested / locked tooltips (hold to lock) not exercised.
- **Star hire, let go, move team, retire product, open weights, distill, deals, debt** were not clicked (uitest covers
  most as "state changed"); their previews were not judged.
- Day-200 and day-400/900 leader fixtures come from RefBot with stub compute and a cash floor (`fixtures.ts`
  method), so leader Finance at those days shows idealised cash. Mechanism stats use 3 seeds per cell (indicative,
  not calibration-grade).
- Tooltip coverage is a heuristic (leaf elements with a digit, ≤ 40 per screen, 380 ms hover); a number whose label
  carries the tooltip counts as missing.
- A `rm` of the first screenshot batch was denied by the permission system; the second pass overwrote the same file
  names instead (no stale files remain).
- Screenshots total about 58 MB (313 PNGs); drop or thin them before merging if repo size matters.

---

## Appendix A: mechanism traces (3 seeds per cell, weekly samples to day 1,100 or the ending)

Share of weeks with each condition. *Engineers idle* = build queue empty. *Internal worse* = a cleared full model
measures ≥ 0.15 L above the internal model. *L drops* = weekly drops of the internal model's measured L > 0.05 per
game. *$0 product* = live product with revenue < $0.01B/yr.

| start / bot | sci idle | serving > 25% idle | engineers idle | internal worse | L drops / game | $0 product | cash < 0 | decisions / game | endings |
|---|---|---|---|---|---|---|---|---|---|
| leader / passive | 100% | 63% | 100% | 36% | 12 | 7% | 0% | 3.7 | running, ousted@366, running |
| leader / mixed | 63% | 20% | 100% | 8% | 5 | 18% | 0% | 8 | asiAligned, asiTakeover ×2 |
| leader / ref | 58% | 10% | 100% | 6% | 6.3 | 15% | 0% | 11 | asiTakeover ×3 |
| leader / race | 55% | 0% | 100% | 8% | 5 | 22% | 0% | 13.3 | asiTakeover ×3 |
| challenger / passive | 100% | 52% | 100% | 36% | 6.7 | 5% | 2% | 2.7 | insolvent, ousted@366 ×2 |
| challenger / mixed | 51% | 59% | 100% | 0% | 7.3 | 5% | 0% | 3.7 | ousted ×3 (2 at day 366) |
| challenger / ref | 46% | 54% | 100% | 0% | 6.3 | 6% | 0% | 5.3 | rivalTakeover, ousted@366 ×2 |
| bigtech / passive | 100% | 100% | 100% | 47% | 10 | 8% | 0% | 4 | overtaken ×3 |
| bigtech / mixed | 91% | 100% | 100% | 0% | 10 | 5% | 52% | 6.3 | overtaken ×3 |
| bigtech / ref | 90% | 93% | 100% | 0% | 10.7 | 1% | 47% | 6.7 | overtaken ×3 |
| spinout / passive | 100% | 94% | 100% | 0% | 9.3 | — | 3% | 2.3 | insolvent ×2, overtaken |
| spinout / mixed | 3% | 64% | 100% | 0% | 11.7 | — | 0% | 4.3 | overtaken ×3 |
| spinout / ref | 2% | 76% | 100% | 0% | 10 | 34% | 0% | 5.7 | ousted, overtaken ×2 |

Passive leader, seed 1 (every 8 weeks): internal model Atlas-1.0 throughout; measured L 5.14, 5.11, 5.46, 5.01, 5.22,
5.51, 5.06, 5.76, 5.11, 5.15; U = L + 1.1–1.2 every sample; revenue $15B → $3B/yr; spare serving 0 → 540K H100e; 8
science teams idle every sample. Spinout passive: one model, L 3.25–3.77, U = L + 0.55, 7,250 H100e spare serving
every sample.

Watch items over all sampled weeks (leader mixed): capped 311, runway 325, unseen 268, board 113, idleServing 84,
idle chips 39, incident 5. Big tech (all bots): idleServing 319–341, board 225–263.

## Appendix B: tooltip coverage (day 400 leader, sampled numbers that open a tooltip)

| Screen | Tipped | Untipped examples |
|---|---|---|
| Overview | 0 / 1 | — |
| Company › Flow | 0 / 6 | 338K, 40K, 1.77×, +3.9%, +1.0%, +0.9% |
| Company › Agents & teams | 15 / 31 | 102K, $953M/yr, 0 × 17, · 750, 5 now · 1 filling |
| Research | 7 / 35 | S · 95%, M · 90%, L · 80%, XL · 70% |
| Models | 7 / 29 | lineage rows Atlas-1.0 … Atlas-2.4 |
| Blueprint | 5 / 37 | ×1, 9.2e26, 1.8e27, 3.7e27, ×2 |
| Products | 26 / 38 | $4.8B, 30 d, KYC 0/1/2/3 |
| Safety › Overview | 4 / 17 | 0.9 levels ahead, +14 d per release, 2 of 4 uses |
| Safety › Research lines | 1 / 10 | 7.6 mo, 76 d, 100, Show all 18 |
| Compute › Overview | 10 / 23 | 937K, 100%, −$2.0B, +500K H100e |
| Compute › Split | 0 / 11 | 61%, 36%, 11%, 80%, 26%, 2% |
| Finance | 5 / 28 | $37.3B, $119B, $126B, +$2.2B, −$758M |
| Relations | 10 / 25 | 0 / 0, 0 (favors, dependence) |
| World | 25 / 32 | 20.3% ytd, 9.2% · 86% |
| Risk › Sources | 1 / 15 | 12.6%, 11.1%, 8.5%, axis ticks |
| **Total** | **116 / 338 (34%)** | |

Scripts (throwaway, untracked): `scripts/v2/_audit_fx.ts`, `_audit_shots.mjs`, `_audit_play.mjs`,
`_audit_play2.mjs`, `_audit_order.mjs`, `_audit_mech.ts`, `_audit_chk.ts`. Fixtures and logs in `C:\tmp\auditfx`.

---

## Triage (user, 2026-11-17)

**Fix now (batch J1):**
- Major group B — measurement noise: M1, M2.
- Major group C — broken / misleading screens: B1, B2, B3, PR2, F1, F2, C1, O1, RL1 (Relations: hierarchy cleanup, not a redesign).
- All Minor and Polish findings that are **UI-only** (no engine/mechanism change).

**Deferred (batch J2, later):**
- Major group A — idle resources and policies: P1, P2, R1, R2, M3, PR1, ST2 (and ST1 spinout presentation).
- Minor/Polish findings that need engine changes.

**Design decisions for J2:**
- **Engineers get real work:** build load that scales — run setup grows with model size; every product launch, feature, sector pack and product upkeep needs team-weeks; safety tooling in production needs crews — so too few engineers visibly slows shipping.
- **Spare serving compute flows to research agents by default** (shown, like spare training compute goes to data), calibration-checked so the reference path stays neutral.

---

## J1 status (2026-11-17, branch `jank-audit`)

Scope per the triage: Major groups B and C, and every Minor / Polish finding that is UI-only. Group A (P1, P2, R1, R2,
M3, PR1, ST2, ST1) is J2 by decision and not listed again below.

| Id | Status | What changed / why skipped |
|---|---|---|
| M1 | done | Engine: a version's measurement error is drawn once (first suite) and narrows as 1/√n; start models exact. No re-roll; an unchanged model moves only toward its truth. Model card / lineage show L ± band and suites run. |
| M2 | done | U no longer follows measurement noise (M1). Weekly U drivers recorded (new model, tools, believed eval awareness, re-validation); shown in the race tooltip and the Overview chart hover. |
| B1 | done | The layer note used a global `.rb` class (grid): renamed; one line again. |
| B2 | done | Every card is its own line with Δ capability / time / cash / serving / four risk families vs the slot's reference card (toggles: on vs off), signed and coloured, each with a tooltip. |
| B3 | done | Default size = ×1 if it finishes within 240 d, else the largest smaller snap that does; snaps over a year are red with their wall time; a lab with no feasible base opens on post-training. Gantt label no longer clipped. |
| B4 | done | No e-notation on the surface: snaps show wall time, FLOP in tooltips; "0.4 team-wk". |
| PR2 | done | One definition per place: top strip = 30-day average ("REVENUE · 30 D", tooltip lists each product now and the total now); product cards and edit previews = "now" (live readout, so day 0 no longer shows $0.0B). Glossary `revenueNow`. |
| F1 | done | Engine: the `cash` cause ledger merges entries per day and source (cap 600): "Why cash moved · 30 d" covers 30 days (Revenue ×31). |
| F2 | done | Division: parent budget is the inflow bar, net bar reads within / over budget, top strip shows "CASH · BUDGET … parent covers", no runway alarm in Watch, core loop or fast-forward stops, no "runway ends" note. |
| C1 | done | Order / Build / Rent show labelled payment lines (now, on delivery, capex, per year × n) and cash, runway and chips-without-racks before → after (the action applied to a copy of the game). |
| O1 | done | Rendered coverage 89.8% (day 400 + 900, every panel and tab; uitest asserts ≥ 85%); day-0 92%, challenger 91%, spinout 90%. lint-ux "Numbers have a tooltip": 288/320 number sites tipped, 32 allow-listed with reasons (lint-tips.ts). |
| RL1 | done | Who matters now (lowest trust first, top 4, show all), zero-only columns hidden, plain-language government and China rows, blocs top 5, catalogue behind a group picker with "trust ▲ · credibility ▼" words. |
| RL2 | done | Security actions only on Company › Security (Relations and Risk link there); Retire apart with a confirm. |
| P3 | done | Offers: payroll, "fills in N wk", "offer ends in N d" with tooltips; "labour ×1.01 of the leader's"; science cards open a tooltip. |
| P4 | skipped → J2 | Keep-hiring filling idle science targets is a policy change (engine). |
| P5 | done | Team picker numbers teams within a specialty ("Pretraining team #3") and the quality dots have a tooltip. |
| R3 | done | Layer as icon, effort as hourglass dots, both with tooltips; odds the only number. |
| R4 | done | Names and "needs" clip with ellipsis inside the node (tooltip has the full list); short retry dates; the tree shows its horizontal scrollbar. |
| R5 | done | Safety lines read "health", capability ideas "odds". |
| M4 | done | "best" badge per variant in the lineage; agent package preview warns when the new model measures below the old. |
| M5 | done | Runs named by target ("Atlas-2 · post-train", "Mini of Atlas-2.2", "New base · ×1"); a finished base with no version says "needs post-training". |
| M6 | skipped → J2 | Start evals with a horizon / evaluate on launch changes engine state. |
| M7 | done | Distill disabled on the imported model with the reason. |
| PR3 | done | Model chip on its own line (full name and L); free tier below. |
| PR4 | done | Edit preview fits the card (compact rows, scroll). |
| PR5 | done | No zero or negative levers; the binding chip says what binds in words. |
| PR6 | done | KYC only on products; Security links there. |
| PR7 | done | Launch reason names the fix (post-train the import in Blueprint) with a Blueprint link. |
| PR8 | done | Horizons past a work-year read "> 1 yr". |
| AG1 | done (UI) | "same model" tag with the collusion explanation; lowering its catch rate is an engine change → J2. |
| AG2 | done | "copies × speed" labelled and tipped, budget tag and lane order tipped, "$0" instead of "$0.0B". |
| AG3 | done | "off" tag on a lane with no compute; the Trusted-to-AI lock names its gate ("needs L ≥ 8.5", full rule in the tooltip). |
| S1 | done | Verdict counts unseen families ("Understanding ahead, but 2 of 4 risk families unseen", amber). |
| S2 | done | Race tooltip explains "validated to" vs U; fully faded tools are one line, not "decayed 100%". |
| S3 | done | "safety research engineers". |
| S4 | done | Investigations and Incidents are one "Cases" tab. |
| S5 | done | Signal nodes without S1–S8 codes; heatmap is colour with the number on hover (own level's column kept). |
| C2 | done | "×1.35 a new buyer's" order weight, "Made in Taiwan 35% of leading chips"; the scarcest component reads "tightest" unless demand reaches supply. |
| C3 | done | Milestones named: chart "… live ≈ Q4 29", Sites "power until Oct 2027 · live ≈ Q4 29". |
| C4 | done | Orders, cloud and the chip market share one "Orders & market" tab; Sites keeps the timeline. |
| F3 | done | Finance tabs: Cash (cash flow, history, raise, why cash moved) · Contracts · Board & owners · Debt & deals; links open the right tab. |
| F4 | done | Board names wrap, "% of spend" no longer overlaps, recap buttons only for the capped-profit nonprofit. |
| F5 | done | Raise shows cash and runway before → after (tooltip: stake sold, close date). |
| W1 | done | "World technologies"; Moonshot shows its disabled reason. |
| RK1 | done | Every risk figure opens drivers, band, why the source carries risk and its levers (lever magnitudes would need engine what-ifs). |
| RK2 | done | "you +97d ahead" / "you 30d behind". |
| O2 | done | The bottom chip opens one list: Watch (cause → fix, jump) first, then alerts, with a visible Clear. |
| O3 | skipped → J2 | Balanced start states come from the PR1 / R1 policies (engine). |
| O4 | done | Release labels thinned; day 0 shows the start point instead of an empty card. |
| O5 | done | Developer references (V2-SPEC, STRUCTURE, TECH-TREE, design/…) dropped from player sources; design values read "design choice". |
| O6 | done | Nav tooltips close on click and stay closed until the pointer leaves. |
| E1 | done | Merger default: "another lab buys them instead and takes their staff". |
| E2 | done | The "New decision" stop message clears when the decision is made. |
| ST3 | done | Board card and Watch: next review date, confidence vs the 25 line, ouster odds when a vote is live. |
| ST4 | done | Diffusion reads "know-how ×5.9 your own rate, from Polaris AI". |

**Counts:** 11 Major done (M1, M2, B1, B2, B3, PR2, F1, F2, C1, O1, RL1); 41 of 44 Minor/Polish done (AG1 UI part),
3 skipped to J2 (P4, M6, O3) plus the engine halves of AG1 and RK1.

## J2 scope (user, 2026-11-17)

In:
1. **R2:** science teams spread across the best few projects instead of piling onto one; auto-assign keeps taking
   **only queued projects** (no auto-pick from open projects).
2. **P1:** engineers **and their agents** get real work (build load that scales: run setup with model size, product
   launches, features, sector packs, product upkeep, safety tooling crews); too few engineers visibly slows shipping.
3. **PR1 (part):** spare serving compute flows to **research** by default (shown).
4. **AG1, RK1 (engine halves):** a model monitoring a copy of itself gets a lower catch rate (collusion); risk sources
   get engine what-ifs (how much each lever moves the risk).
5. **R7 deferral:** frontier-research agent compute adds AI science capacity on tree projects (efforts refit so the
   reference path holds).

Not now: R1 auto-pick from open projects, P2, P4, M3 best-model policy, M6, the PR1 shortfall policy, O3, ST1, ST2.
