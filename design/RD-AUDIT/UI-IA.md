# R&D UI: information architecture (RD-UI1..7, SR-25..30)

Input for Phase 9. Designer's positions override generic guidance: **clear information first**; the UI does not mirror
the engine; player language only; one home per datum; LAB = allocation only; one RESEARCH portfolio for capability and
safety; SAFETY grouped by acts. Levels per the good-ui skill: **L0** always visible (≤ 7), **L1** 2–4 overview visuals
per tab, **L2** panels / cards by click, **L3** tooltips and Codex by hover.

**Basis** (every datum states one): **Fact** = known to the lab exactly (owned, spent, counted). **Measured** = from
evals or observation, with a band. **Believed** = an estimate built from evidence, with a range. **Estimate** = a
forecast or intel about others, with a range. **Truth is never shown** outside the end screen.

`provisional` = SAFETY / PRODUCTS rows whose engine work is still in progress (SR-17..24, Phase 7); names and readers
may change.

---

## 0. L0 (shell, all tabs)

| # | Item | Shows | Basis | Click |
|---|---|---|---|---|
| 1 | Clock | pause, speeds, date, act | Fact | — |
| 2 | **Loss-of-control risk** (hero) | `9% (3–24%)`, "if it could act now"; small beside it: `Sight L 9.1 · Frontier L 9.6` | Believed; Measured (frontier) | SAFETY › Risks |
| 3 | Cash · runway | cash, runway gauge | Fact | Finance |
| 4 | Lead · nearest | `+42 d vs Leader` | Estimate (intel) | Overview lead track |
| 5 | Nav | 7 R&D tabs + Overview, Finance, World, Relations, Codex; badges: LAB idle, RESEARCH finished / failed, TRAINING run done, SAFETY new incident / framework hold | Fact | the tab |
| 6 | Queue | decisions + one alert channel | Fact | the cause's home |

Removed from L0 for R&D: research speed, compute online, the L-vs-U race as hero, catastrophe-risk gauge (replaced by 2).

---

## 1. The seven tabs: questions and first-glance visuals

### COMPUTE (RD-UI1): datacentres, chips, buying

| Questions | L1 visual that answers it |
|---|---|
| How much compute do I have now, and in 6 / 12 / 24 months? | **Capacity forecast**: stacked area of H100e online (owned / rented) with ordered and building as dashed bands; rivals' estimated compute as tick marks on the right edge |
| What stops me growing faster: chips, power, racks, cash? | **Bottleneck verdict row**: 3–4 chips (`Power: 2 sites waiting on grid`, `Chips: vendor fill 60%`, `Idle chips: 4k (no racks)`), each links to its fix |
| What does this order / site give me, when, at what cost? | **Order pipeline timeline**: deliveries and site stages on a time axis; every buy action shows before → after on the forecast |
| What does compute cost me? | L2 (Orders / Market tabs); cost per H100e in the order card tooltip |

L2 tabs: Sites · Orders · Market. COMPUTE never shows how compute is *used* (LAB).

### LAB (RD-UI2): workforce and compute allocation only

| Questions | L1 visual |
|---|---|
| Where does my compute go, and is any of it idle? | **Compute allocation bar**: one flat bar, one segment per use (Training runs, Data generation, Research experiments, Research agents, Engineering agents, Safety research, Safeguards, Products, **Idle** hatched); presets (Balanced / Race / Safety); drag to set; each segment's tooltip: what it is starved of or wastes |
| Who is working on what, and who is idle? | **Workforce needs board**: one column per role (Scientists, Research engineers, Safety research engineers, Engineers); in each, a stacked bar of needs in the player's order (`gets / needs`), **Idle** at the end; short needs in amber |
| What is short: people or compute? | Same board: each need row has a `short: people` / `short: compute` tag; LAB badge on the nav |
| What will hiring X / moving Y% do? | Hire and drag previews: before → after on the receiving need (e.g. `Run operations 70% → 100%`, `Research speed ×3.1 → ×3.4`), computed on a copy |
| What are my AI staff doing, on which model, and is it watched? | **AI staff tiles**: one per package (Engineering, Research experiments, Research ideas, Safety experiments, Safety ideas): model, copies, AI share of the job, compute; a link chip to its safeguards on SAFETY |
| What runs automatically, and why? | **Policies row**: Auto-split idle compute, safety engineers' order, each with its objective and its cost in one line ("moves idle to Research experiments: +2% speed") |

Scientists are placed by the RESEARCH priority list (see OQ-2); LAB shows their headcount, hiring and idle count only.

### RESEARCH (RD-UI3): one portfolio, discoveries, know-how

| Questions | L1 visual |
|---|---|
| What is my lab researching, in what order, and when does each finish? | **Portfolio board**: one priority list for capability and safety; each row = project, line, chance it works, a 4-step stage track (Ideas · Small test · Big test · Build-in; unlocks: Test · Build-in), ETA, teams, payoff in its own unit |
| Why is my research slow? | **Research speed** (`×3.1 vs your day-1 lab`, sparkline) with a **what-binds bar**: compute / research engineers / scientists / ideas quality, the binding one highlighted, best lever as a Go link (to LAB) |
| What does this project give me if it works, and how likely is that? | Row payoff chip (`+0.12 OOM pretraining` or `new instrument: internals`) and `chance 40%`; hover → band and source |
| Is my know-how ahead of the public and rivals, and is it in my models yet? | **Know-how chart**: five bars (Pretraining efficiency, RL compute efficiency, RL ceiling, Training throughput, Serving efficiency), each split into public / yours adopted / built into your newest model / measured in evals |
| What can I unlock next? | **Discoveries tree** (own L2 tab): known, in progress, open, locked (with "needs …") |
| Is safety research keeping up? | Safety rows sit in the same board, tagged by output (see / stop / fix / meta); `expected vs observed results / yr` per safety line on hover |

L2 tabs: Portfolio · Discoveries · Know-how.

### TRAINING (RD-UI4): the next run, data, environments, runs

| Questions | L1 visual |
|---|---|
| What will this run give me? | **Prediction card**: predicted level before → after with band, domain gains, the planned run's sight limit vs its level, traits it pushes (methods ticked), serving cost |
| What does it cost and how long? | Same card: FLOP, days at the current training allocation (link to LAB), cash, run-operations engineers needed |
| What do I choose? | **Run plan in two acts**: Pretraining (new / continue / distil from a teacher) → RL (focus, budget, environments, methods); every option chip shows its effect in its own unit |
| What limits it: data, environments, compute? | **Limits strip** above Launch: data repetition, suite quality, training share; each with a Go link |
| What is training now and when does it finish? | **Runs timeline**: running and queued runs (and the continual-learning stream as a scheduled run) with ETA and stall reason |
| Is my data / are my environments good enough? | L2 tabs Data and Environments: data portfolio by domain; suite quality per family |

What you launch is what you get: the launched run's card freezes the snapshot (recipe, data drawn, methods).

### MODELS (RD-UI5): what you own and how good it is

| Questions | L1 visual |
|---|---|
| What models do I own, and what does each do (internal work, which products)? | **Lineage tree**: every real model (full, distilled, older), size, role chips (internal / product tiers), retired greyed |
| How capable is each, and how sure am I? | **Model card**: measured level `L 7.3 ± 0.2 from your evals` and a **domain bar per domain** with two reference ticks (median expert, best human, UI-NOTES) |
| Which milestones has it met? | Milestone ladder on the card: criteria met / not met (work-type thresholds), date met |
| How does it compare with rivals' known models? | Rival best public model as a reference tick on the domain bars (Estimate) |
| What does it cost to run? | Serving cost per hour of work on the card |

L2 tabs: Lineage · Card · Evals (suites run, depth, queue, policy).

### PRODUCTS (RD-UI6, provisional)

| Questions | L1 visual |
|---|---|
| Which products earn what, and why? | **Revenue by product** bars, each with a "why" breakdown (customers × hours × price, binding cause: quality / price / capacity / demand) |
| Which of my models does each customer use, and why? | **Lineup strip** per product: the models in its tiers, share of hours each serves, cost per hour |
| Can I serve the demand? | **Demand vs capacity** per product (serving allocation link to LAB) |
| Am I priced right against rivals? | Price vs best rival product on the product card |

### SAFETY (RD-UI7, SR-25..28, provisional)

| Questions (SAFETY-REDESIGN Q1–Q6) | L1 visual |
|---|---|
| Q2 What could it do, what stops it, how bad is the rest? | **Header**: selected model's Loss-of-control risk, **Unstopped harm / yr** (by severity), sight limit vs its level, the framework's current hold; **Risks table** grouped by act (Misbehaviour · Against the lab · Misuse by people): Would try · Able to · Chances · Stop rate · Unstopped / yr |
| Q1 What do I believe this model is like, how sure? | Model tab: four family bars (best guess + range), "Unknown" chips |
| Q3 How far can I trust my instruments on it? | Instruments tab: reliability per instrument on the selected model (solid = validated, dashed = extrapolated), warning chips |
| Q4 / Q5 How do I learn more, fix or contain it, and at what cost? | Safeguards tab (edit with before → after on the act table and headline); Incidents & cases tab (cards with cause-aware responses) |
| Q6 Is safety capacity keeping up? | **Capacity strip** (read-only, bottom): safety jobs waiting by need, weeks to clear, idle, safety spend; links to LAB |

Model picker default: riskiest running model. Research projects live in RESEARCH; methods are ticked in TRAINING;
allocation is set in LAB.

---

## 2. IA map: every R&D datum

Lvl = level of its home. Reads = the engine value the UI reads (selector or state). M/B = Fact / Measured / Believed /
Estimate.

### COMPUTE

| Datum (player name) | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Compute online (H100e), owned vs rented | COMPUTE › forecast | L1 | hover: by site / contract | compute/forecast.ts, sites | Fact |
| Capacity forecast (ordered, building) | COMPUTE › forecast | L1 | hover a month: deliveries | compute/forecast.ts | Estimate (vendor fill risk) |
| Rivals' compute | COMPUTE › forecast ticks | L3 | hover: intel range | rival lab state + intel noise | Estimate |
| Idle chips (no racks), empty racks ahead | COMPUTE › verdicts | L1 | click → Sites | compute/sites.ts | Fact |
| Vendor fill, chip prices, export policy | COMPUTE › Market | L2 | hover: why | compute/market.ts | Fact / Estimate |
| Orders, cloud contracts | COMPUTE › Orders | L2 | card | compute/orders.ts | Fact |
| Sites: stage, MW, ETA, power source | COMPUTE › Sites | L2 | card → risks | compute/sites.ts, power.ts | Fact / Estimate (ETA) |

### LAB

| Datum | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Compute allocation by use, incl. Idle | LAB › allocation bar | L1 | hover a segment: H100e, what it feeds, starved / wasted | `player.split`, SPLIT_LABEL, `idleTrainingShare`, `idleServing` | Fact |
| Allocation presets | LAB › allocation bar | L1 | hover: what changes | SPLIT_PRESETS, presetSplit | Fact |
| Auto-split idle compute (on, target, last move) | LAB › Policies | L2 | hover: last move log | `policies.autoSplit` | Fact |
| Safety research compute by sub-use (projects, validations, cases, evals) | LAB › allocation bar (Safety research segment) | L3 | tooltip breakdown | `safetyPoolClaims`, `caseH100e` | Fact |
| Safeguards compute (sum) | LAB › allocation bar | L1 | tooltip: per deployment → SAFETY | safety/safeguards `controlComputeShare`, monitor H100e (provisional) | Fact |
| Headcount by role, quality, hiring queue, payroll | LAB › Workforce | L2 | hover: teams list | `player.teams`, hiring state | Fact |
| Research engineers' needs (Run operations, Evaluations, Project experiments) gets / needs, idle | LAB › needs board | L1 | hover a need: which runs / projects | `reAllocView`, `research.last.idle` | Fact |
| Safety research engineers' needs (Open cases, Validation jobs, Removals, Safety experiments) in player order, idle | LAB › needs board | L1 | hover: jobs behind the need | `safReAllocView`, SafAlloc.idle | Fact (provisional labels, SR §5) |
| Engineers' needs (Run setups & build-ins, Product upkeep, Builds) and build capacity (team-weeks / wk), human vs AI | LAB › needs board | L1 | hover: build queue items, each links to its home | `engAllocView`, `buildSplit` | Fact |
| Science teams: count placed, idle | LAB › needs board (Scientists column) | L1 | idle chip → RESEARCH (why idle) | `idleTeams`, `safIdleFlag` | Fact |
| AI staff package: model, copies, speed, compute, AI share of the job | LAB › AI staff tiles | L1 | hover: per-job AI share, cost per work-hour | departments/agents `agentVersion`, `agentCompute`; workfit `copiesOf`, `speedOfCopy`, `aiIdeasShare` | Fact (model choice) / Measured (AI share: from measured fit) |
| Internal tooling (Coding harness, Research harness, Agent memory) | LAB › AI staff tiles | L2 | hover: effect, build cost | `player.tooling`, INTERNAL_TOOLS | Fact |
| Hire / move previews | LAB › controls | L3 | — | the mechanism on a copy (theme V) | Estimate |
| Safety spend $ / yr | LAB › Workforce footer | L2 | tooltip: by line | payroll + compute cost | Fact |

### RESEARCH

| Datum | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Research speed (× day-1 lab) and trend | RESEARCH › header | L1 | hover: experiments rate × ideas rate, modifiers | `labSpeedView` (.rel, mExp, mIdeas, mods) | Measured (what the engine did that day) |
| What binds (compute / engineers / scientists / ideas) | RESEARCH › header bar | L1 | hover: elasticities as "+10% compute → +x%"; Go → LAB | `capProjectView.bound`, eC / eL (see OQ-5: reads hidden production parameters) | Believed (after OQ-5) |
| Portfolio rows: priority, line, stage, stage progress, ETA | RESEARCH › Portfolio | L1 | click row → project card | `capPriorityList`, `capProjectView` (.stage, .stageFrac, .eta, .etaParts); safety `lineRows`, `lineEtaDays` | Fact / Estimate (ETA) |
| Teams on a project, teams wanted, why this team | RESEARCH › project card | L2 | hover team: why | `capProjectView.teams[].why`, `research.want` | Fact |
| Chance it works | RESEARCH › row | L1 | hover: prior, attempts so far | `nodeOdds` (cap: `attemptOdds` prior; safety: line posterior mean) | Believed |
| Payoff if it works (OOM on a know-how area, domain, unlock, safety output) | RESEARCH › row chip | L1 | hover: band, source | treeActions effect preview; `capProjectView.belief` (mu ± sd) | Believed |
| Candidates in test, dropped, failed | RESEARCH › project card | L2 | hover: belief band | `capProjectView.cands / drops / belief` | Believed |
| Research inputs on a project (engineers, experiment compute) | RESEARCH › project card | L3 | tooltip | `capProjectView.re / flopDay` | Fact |
| Line: ideas get harder, next idea's expected size, ideas found | RESEARCH › line card | L2 | hover | `capProjectView.line` (.harder, .nextPrior, .gen, .pending) | Believed |
| Safety line: expected vs observed results / yr | RESEARCH › line card | L2 | hover: results list | `lineRows` (SR-29) | Believed vs Fact (provisional) |
| Discoveries tree: status, needs | RESEARCH › Discoveries | L2 | hover node: effect, needs; click → project | `nodeStatus`, `missingNeeds`, `treeCounts` | Fact |
| Know-how per area: public, adopted, in newest model, measured | RESEARCH › Know-how | L1 | hover: ideas adopted, date, measured Δ | `stackViews`, `publicBase`, `measuredDelta` | Fact (adopted) / Measured (Δ) |
| Know-how growth (ideas / yr, public growth) | RESEARCH › Know-how | L2 | sparkline | `softwareRate`, `pubRate` | Fact |
| Other effects (domain & data effects) | RESEARCH › Know-how | L2 | list | `otherEffectViews` | Fact |
| Publish policy | RESEARCH › Know-how footer | L2 | hover: what leaks | publishPolicy (provisional) | Fact |

### TRAINING

| Datum | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Run plan options (act, source, size, data mix, RL focus / budget, environments, methods) | TRAINING › Run plan | L1 | hover each chip: effect in its unit | `planRun`, `runAct`, design data | Fact |
| Predicted level after the run, band, domain gains | TRAINING › Prediction card | L1 | hover: parts (pretraining, RL, know-how) | `runForecast`, `planRun` prediction | Estimate |
| Planned run's sight limit vs its predicted level | TRAINING › Prediction card | L1 | → SAFETY › Instruments | `plannedSightLimit` | Believed (provisional) |
| Traits this run pushes (per family), methods' predicted change | TRAINING › Prediction card | L2 | hover: per method | pressureView `plannedPressure`, `methodLines` | Believed (provisional) |
| Run cost: FLOP, days, cash, run-op engineers | TRAINING › Prediction card | L1 | hover: training share link → LAB | `planRun`, `shareIfLaunched`, `runEtaDays` | Estimate |
| Limits: data repetition, suite quality, training share | TRAINING › limits strip | L1 | Go → Data / Environments / LAB | `planRun` limits | Fact |
| Runs in progress / queued, ETA, stall reason | TRAINING › Runs | L1 | click → frozen launch snapshot | `player.runs`, `runStall`, `runOpsServed` | Fact |
| Continual-learning stream (FLOP, gain per period) | TRAINING › Runs (scheduled row) | L2 | hover | `streamFlopPerDay`, `streamPeriodGain` | Fact / Estimate |
| Data portfolio: tokens by domain, sources, licences, synthetic jobs | TRAINING › Data | L2 | hover: repetition, quality | `dataPortfolioView`, `drawByDomain`, `teacherRows` | Fact |
| Environment suites: quality (tasks × grader), exploitability, upkeep, expert data | TRAINING › Environments | L2 | hover: decay, next build | `suitesView`, `fidelityOfSuite`, `suiteExploitMap` | Fact / Believed (exploitability) |

### MODELS

| Datum | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Owned models, lineage, size, role (internal / product tiers), retired | MODELS › Lineage | L1 | click → card | `player.versions`, bases | Fact |
| Measured level ± band | MODELS › card | L1 | hover: suites, depth, elicitation | `EvalRecord.measuredL`, `fitSd`, `measuredLOf` | Measured |
| Measured domain levels vs median expert / best human | MODELS › card | L1 | hover a domain: benchmarks behind it | `EvalRecord.measuredDom`; workfit `refPoints` (see OQ-6; MEDIA / PHYS fall back to a true offset: leak) | Measured |
| Benchmark scores | MODELS › card (more) | L2 | hover: score sd | evals bench table | Measured |
| Milestones met (work-type criteria), date | MODELS › card | L1 | hover: each criterion | `versionMilestones`, `milestoneViews` | Measured |
| Work types: time horizon, AI vs best human per hour | MODELS › card | L2 | hover | `workTypeViews`, `h50Of` | Measured |
| Serving cost per work-hour, active parameters | MODELS › card | L2 | hover: FLOP per token | `costPerWorkHour`, `flopPerToken` | Fact |
| Monitorability | MODELS › card | L2 | → SAFETY › Instruments | version monitorability | Believed |
| Rival best public model | MODELS › card reference tick | L3 | hover: intel range | rival labs (public versions) | Estimate |
| Evals: suites run, depth, cadence, queue, policy, cost | MODELS › Evals | L2 | hover | `evalQueueView`, `evalDepthView`, `evalMeasureView`, `evalPolicyView` | Fact |

### PRODUCTS (provisional)

| Datum | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Revenue per product, binding cause | PRODUCTS › revenue | L1 | hover: customers × hours × price | worldfx/productView `productReadouts` | Fact |
| Lineup: models in tiers, share of hours, cost per hour | PRODUCTS › product card | L1 | → MODELS card | product lineup (DD-01) | Fact |
| Demand vs serving capacity | PRODUCTS › product card | L1 | serving segment → LAB | `productReadouts` | Fact / Estimate (demand) |
| Price, rival best product price | PRODUCTS › product card | L2 | hover | `goingPrice`, bestRivalProduct | Fact / Estimate |
| Product tools (features), sector certification | PRODUCTS › product card | L2 | hover: effect inside the offer | `featureView` | Fact |
| Usage policy, KYC, disclosure | PRODUCTS › product card | L2 | hover | product settings | Fact |

### SAFETY (provisional)

| Datum | Home | Lvl | Drill-down | Reads | M/B |
|---|---|---|---|---|---|
| Loss-of-control risk, lab (max over running models) | L0 #2 | L0 | → SAFETY › Risks | `lossOfControlRisk` | Believed |
| Sight limit vs frontier level (lab) | L0 #2 (small) | L0 | → SAFETY › Instruments | `sightLimit`, `bestMeasuredL` | Believed / Measured |
| Loss-of-control risk of the selected model | SAFETY › header | L1 | hover: act-against-the-lab row × stop rate × footholds vs published survivable range | `modelLossRisk` | Believed |
| Unstopped harm / yr (by severity) | SAFETY › header | L1 | hover: top acts → Risks | `unstoppedHarmPerYear` | Believed |
| Framework hold (rule, model, override) | SAFETY › header | L1 | [why] → rule | framework (SR-19/20) | Fact |
| Act row: Would try · Able to · Chances · Stop rate · Unstopped / yr | SAFETY › Risks | L1 | hover factor: source, "what lowers it" before → after | `actTable`, `actSite` | Believed (Would try, Stop rate) / Measured (Able to) / Fact (Chances) |
| Footholds: suspected / located / removed, points of risk | SAFETY › Risks footer | L2 | card → open case | safety/footholds (known + expected unfound) | Believed |
| Trait beliefs per family and trait, Unknown chip | SAFETY › Model | L1 | trait → evidence list | `beliefView` | Believed |
| Instrument reliability on the model, validated-on, reasons | SAFETY › Instruments | L1 | reasons, validation history, disagreements | `instruments`, `reliability`, `validatedLabel`, `reliabilityReasons`, safety/disagreement | Measured (validated) / Believed (extrapolated) |
| Detection grid (trait × level) | SAFETY › Instruments (drill-down of sight limit) | L2 | hover cell | `sightGrid` | Believed |
| Validation jobs: queue, days left, who runs it | SAFETY › Instruments | L2 | engineers → LAB | `validationView`, `jobDaysLeft`, `humanRun` | Fact |
| Safeguards per deployment: stop rate per act, slowdown, compute, staff | SAFETY › Safeguards | L1 | edit with before → after | `safeguardLines`, `combineStop`, `totalSlowdown`, `reviewStaff` | Believed (stop rate) / Fact (cost) |
| Owned methods and their predicted effect | SAFETY › Safeguards (Methods list) | L2 | ticked in TRAINING | `ownedMethods`, `methodLines` | Believed |
| Incidents: severity, apparent cause, deadline, status, act row link | SAFETY › Incidents & cases | L1 | card → responses | `incidentRows` | Fact / Believed (cause) |
| Cases: question, progress, AI share, verdict | SAFETY › Incidents & cases | L2 | card | investigations | Fact |
| Capacity strip: jobs waiting, weeks to clear, idle, spend | SAFETY › bottom strip | L2 | links → LAB | `safReAllocView`, `safetyPoolClaims` | Fact (breakdown of LAB data, links only) |

**Never read by the UI** (truth): `trueSightLimit`, `trueLeadDays`, `safetyTruth`, `trueRecall`, hidden traits, agenda
efficacy, `hidden.*` world draws. Existing leaks to fix: `capProjectView` eC / eL read `s.hidden.timeline.prod`
(OQ-5); measured domain fallback for MEDIA / PHYS adds the true offset (RD-M01 open item).

---

## 3. Vocabulary (feeds RD-Z02)

One word per thing. **DEL** = delete the term from player text (glossary entry goes or is merged).

| Current engine / UI term | Player word | Tooltip (one line) |
|---|---|---|
| R&D multiplier M, AI R&D multiplier, rdmult, labSpeed, "Research speed ×" | **Research speed** | How fast your lab turns compute and people into know-how, × your lab on day 1. |
| Experiment throughput X, expThroughput | DEL (tooltip part of Research speed: "experiment rate") | — |
| prodfn "Research production", researchMix, responseCurve | DEL | — |
| bottleneck, binding, bindingCause, computeBound / laborBound / humanBound / tasteBound | **What binds** (values: compute, engineers, scientists, ideas quality) | The input that would speed this up most per extra unit. |
| Compute split, pools, poolTraining / poolExperiments / poolAgents / poolServing / poolSafety / poolResearch | **Compute allocation**; each use by its name | How your online compute is divided between uses. |
| researchAgents, routine / frontier agents | **Research agents** | AI copies doing research experiments and ideas. |
| safetyAgents, automateSafety, trustedToAI, aiDoneShare, aiShareWork, aiRdShare | **AI share** (of a job) | Share of the job's effective work done by AI copies. |
| agentPackage "Agents at work" | **AI staff** | Your AI copies, grouped by job, each on a named model. |
| Idle compute, idleServing, Unallocated | **Idle** | Compute no use is drawing on; it costs money and does nothing. |
| capability level L, λ | **Level** (L) | A model's capability on a 0–15 scale; 10 = best human in the domain. |
| measureBand, estimateBand, beliefBand | **± band** (measured) / **range** (believed) | How far the true value may be from what you see. |
| Effective compute (G), OOM, gGain | **OOM** in tooltips only (see OQ-1) | Order of magnitude: ×10 effective compute. |
| Recipe, knowHow, recipeStack, stackEfficiency, stacks | **Know-how** (five **areas**) | What your lab knows about training and serving, built into new models. |
| Paradigm, axis, techTree | **Unlock**; tree = **Discoveries** | A one-off research result that opens a new option. |
| researchLine (capability pool), linePool "Ideas get harder" | **Line** (OQ-3) | A research direction that keeps producing ideas, each harder than the last. |
| idea, candidate | **Idea** (adopted); **candidate** (in test) | A candidate is an idea still being tested. |
| stageIdeation / stageSmall / stageScale / stageAdoption / stageTest | **Ideas · Small test · Big test · Build-in** (unlocks: **Test · Build-in**) | Where the project is. |
| stageResult "Result estimate" | DEL (stage removed) | — |
| odds, lineHealth, Health | **Chance it works** | Your current odds that this works, from the attempts so far. |
| deadEnd, seriousStaffing, followUp, retry | DEL (failed project = **Failed**) | — |
| finding, technique, tool, detector, toolFamily, umode | DEL in RESEARCH → **Result**; on SAFETY → **Instrument / Safeguard / Method** | — |
| agenda | **Safety line** (data name agenda) | A safety research direction with its own projects. |
| realisedEffect, measuredDelta | **Measured effect** | The change your evals saw in the first model built with it. |
| projectQueue | **Priority list** | Projects in order; teams go to the top first. |
| teamsWanted, teamsWantedAuto | **Teams wanted** | How many science teams this project should get. |
| teamMonth, teamWeek, person-month, team-equivalent | **team-weeks** (OQ-4) | One team working for one week. |
| buildCapacity | **Build capacity** (team-weeks / week) | How much engineering work your engineers and AI can do per week. |
| runOps | **Run operations** | Research engineers keeping training runs going; short = runs slow. |
| postTrain, baseRun, continueRun, distillRun, idaCycle | **Pretraining** (new / continue / distil) and **RL** (option: teacher grades) | The two ways to make a model. |
| blueprint, plannedRun | **Run plan** | The run you are designing. |
| nextModelGate | DEL | — |
| envSuite, suiteFidelity | **Environment**, **quality** | Tasks a model trains on in RL; quality = tasks × grader quality. |
| suiteExploit, rewardHackPressure (S2) | **Exploitability** | How easily models game this environment's grader. |
| dataTokens, dataPortfolio, dataWall | **Data**, **repetition** | Your training text; repetition = how often runs re-read it. |
| stream | **Continual learning** | A scheduled run that keeps your newest model learning. |
| evals, evalSuite, evalDepth | **Evals**, **depth** | Benchmarks run on a model; depth = how hard you try to draw out its best. |
| version, base, variant | **Model** (base in tooltip) | A trained model you own. |
| catchRate, monitorCoverage, effOversight, actOversight, rdOversight, oversightGap, effectiveControl, controlBand, tiers | **Stop rate** | Share of attempts at this act your safeguards stop. |
| controlLayer, agentControl, layer* | **Control protocol** (a safeguard) | Watching, deferring or resampling an AI's actions; costs slowdown. |
| controlTax | **Slowdown** | Useful work lost to a safeguard. |
| danger, disposition, misBand, dangerLine | **Would try** | Your belief of how often it would try this if unwatched. |
| actCapability | **Able to** | Its measured capability against this act's threshold. |
| opportunity | **Chances** | How many chances its deployment gives it a year. |
| catRisk, riskSource | **Loss-of-control risk** (own models) | Your believed chance a model could act against you with nothing able to stop it. |
| clarity, unseen | **range**; **Unknown** (range > 30 pts) | — |
| validation, refresh "Re-validate", halfStrength, Goodhart G | **Validation**, **Reliability** | Reliability = chance an instrument shows a trait that is present on this model. |
| trait graph, edge, moderator, trainingPressure, traitMovement ω, successorPull | DEL from screens (Codex only); TRAINING says **pushes** | — |
| investigation | **Case** | A time-boxed investigation of one question. |
| evalGate, pledge, releaseClearance, runtimeMonitoring | **Safety framework** rules | Your rules: thresholds → required safeguards and holds. |
| agentTooling | **Internal tooling** | Tools your AI staff use; built once, has upkeep. |
| autoSplit | **Auto-split idle compute** | Sends idle compute to the uses you pick, and logs it. |

---

## 4. Cross-tab links (a chip that jumps home, never a copy)

| Shown at | Link chip | Jumps to (home) |
|---|---|---|
| RESEARCH header, what-binds bar | `short: research engineers ▸` | LAB › needs board, that need |
| RESEARCH project card | `experiment compute ▸` | LAB › allocation, Research experiments segment |
| RESEARCH Know-how, "in newest model" | `measured in V5 ▸` | MODELS › card |
| RESEARCH safety row result | `new instrument ▸` | SAFETY › Instruments |
| TRAINING prediction cost | `training share ▸` | LAB › allocation, Training segment |
| TRAINING limits strip | `run operations short ▸` | LAB › needs board |
| TRAINING sight limit of planned run | `instruments ▸` | SAFETY › Instruments |
| TRAINING method chips | `owned methods ▸` | SAFETY › Safeguards, Methods |
| TRAINING run done | `new model ▸` | MODELS › card |
| MODELS card role chip | `serves Chat tier 2 ▸` | PRODUCTS › product card |
| MODELS card | `beliefs ▸` / `risk ▸` | SAFETY › Model / Risks (picker set to it) |
| MODELS Evals queue | `engineers ▸` | LAB › needs board, Evaluations |
| PRODUCTS demand vs capacity | `serving share ▸` | LAB › allocation, Products segment |
| PRODUCTS card | `safeguards ▸` | SAFETY › Safeguards (that deployment) |
| SAFETY act row Able to | `measured level ▸` | MODELS › card |
| SAFETY capacity strip | `jobs waiting ▸`, `safety spend ▸` | LAB › needs board / Workforce |
| SAFETY Incidents | `act row ▸` | SAFETY › Risks |
| LAB AI staff tile | `model ▸`, `safeguards ▸` | MODELS › card; SAFETY › Safeguards |
| LAB Scientists column | `idle: no projects ▸` | RESEARCH › Portfolio |
| LAB allocation total | `compute online ▸` | COMPUTE › forecast |
| COMPUTE verdict | `idle allocated compute ▸` | LAB (distinct from idle chips) |

---

## 5. Open questions for the designer

| # | Question | Rec. |
|---|---|---|
| OQ-1 | Unit for research payoffs and know-how: OOM, "× effective compute", or level L? | Show **level gain** where it lands on a model (`+0.3 L at your next base`), "×1.4 effective compute" on know-how; OOM only in tooltips. OOM is engine language |
| OQ-2 | Where are science teams placed: RESEARCH priority list or LAB? | **RESEARCH** (the priority list is the scientists' allocator); LAB shows count, hiring, idle with a link |
| OQ-3 | One portfolio holds capability "directions" and safety "lines": one word for both? | **Line** for both (DD-21 named them differently when they lived apart); tag by output (capability / see / stop / fix) |
| OQ-4 | One work unit: team-weeks, team-months or person-months? | **team-weeks** everywhere (builds, evals, suites, cases already use it); person-month only in Codex |
| OQ-5 | "What binds" reads the world's hidden production parameters. Allowed? | No: derive it from the lab's **published prior** on the elasticities (or the measured response of the last 30 days) and show it as believed |
| OQ-6 | Domain scale on MODELS (UI-NOTES: start reads 0 in five domains) | Bar per domain with **median-expert and best-human ticks**, the model's position between them; no raw 0–15 number at L1 |
| OQ-7 | Internal AI staff control: set in LAB (tile) or SAFETY (safeguard)? | **SAFETY › Safeguards**, as for products (one stop-rate formula); LAB tile shows a link chip |
| OQ-8 | Evals: home in MODELS (measurement) or TRAINING (after a run)? | **MODELS › Evals**: they measure models, not runs; TRAINING's run-done chip links there |
