# R&D vocabulary: one word per thing (RD-Z02)

The base for the language clean-up in the R&D UI phase. It covers what the player reads: panels, glossary tooltips
(`src/data/v2/glossary.ts`; GLOSSARY.md is generated from it by `scripts/v2/lint-ux.ts --doc`), view strings, previews
and log lines.

**Inputs:**
- SESSION-HEAD [26], [30] and [32];
- UI-IA §3 and §5;
- review/research-calibration F8.4;
- SAFETY-REDESIGN §2.2–2.3;
- the good-ui skill §3–4;
- the coordinator's relay of the designer's answers to OQ-1, OQ-3, OQ-4 and OQ-6 and the loss-of-control placement (below).

**Inventory size:**
- **~155 things** (the rows of §3), carrying **~330 distinct on-screen names**: about 120 for safety, 115 for research / training /
  models and 115 for lab / products / shell.
- The glossary has **550 entries**, about 300 of them R&D.

**Count notes:**
- Counts are approximate grep hits over `src/ui/v2/**`, the glossary and `*View.ts`. Identifiers are included, so
  treat them as size, not exact.
- Paths are relative to `src/`. Panels are under `ui/v2/panels/` unless a path says otherwise.

## Designer answers already given (applied below)

| Q | Answer | Where it lands here |
|---|---|---|
| OQ-1 | Show an effect where it lands: the change in the next model's skill bars. Know-how is shown as **× effective compute**. **OOM never** in player view | §1 units; §3 Know-how; §4 |
| OQ-3 | Not "line". Split research by kind: **programme** (ongoing, falling returns) and **project** (one-off, works or not), the same two words for capability and safety, tagged by output (capability / see / stop / fix) | §3 Research |
| OQ-4 | Main display = **time to finish with current staff + staff used**. **team-weeks** only in breakdown tooltips | §1; §3 Lab |
| OQ-6 | **Skill bars** between median-expert and best-human ticks, plus a superhuman mark. No raw 0–15 at L1 | §1; §3 Models |
| L0 | **Loss-of-control risk** = a small top-bar item that links to SAFETY. The full gauge is only on SAFETY | §3 Safety |

## 0. Rules

1. **Player words only.** No symbols (G, L, U, M, X, c, ℓ, λ, ω, κ, θ, τ, q, Σ, Δ). No code ids (pre, rlMid, P11, AG07,
   S2, SCHEME, V7, post 21, evalGov, codeMath, rolledBack). No "RL" (say post-training, DQ-5). No formulas and no scientific notation in any tooltip.
2. **One word per thing, everywhere**: label, tooltip, preview, log and Codex. The glossary **title must equal the
   on-screen label**. Today hovering "Research speed" opens "AI R&D multiplier M", and "Research compute mix" opens
   "Auto-split idle compute" (Company.tsx:176).
3. **One meaning per word.** §5 resolves today's collisions.
4. **Uncertainty is a range plus a word**: `+2% (1–4%)`, "likely", "fairly sure". Never "± SD" and never "80% band".
5. **Engine detail goes to a designer overlay** that players never see ([30] principle 7). This covers formulas,
   doc references ("MODEL-V3 §5", "research/20 C1"), "[D]" and "stand-in". Paper citations: DQ-2.

## 1. Units (one per quantity)

| Quantity | Show (L1 / L2) | Tooltip only | Never |
|---|---|---|---|
| Compute | H100e; % of online compute | H100e-days for a job | FLOP/day, `1.1e24/day`, "pool" |
| Staff time | **time to finish** with current staff + **staff used** (`3 RE teams`) | **team-weeks** (single spelling) | team-eq, t-wk, team-wk, team-wk/wk, team-mo, tm, person-month, "staff" as a unit (kit.tsx:223 renders team-weeks as "−12 staff": a bug) |
| Model capability (one domain) | **Skill bar** with median-expert / best-human / superhuman ticks | "level 9.1 (10 = best human)" | `L 9.1`, "Capab.", the bare 0–15 scale |
| Capability change | Ghost extension on the next model's skill bars | "+0.3 levels in coding" | ΔG, "G gained", "+0.12 OOM" |
| Know-how | **× effective compute vs Jul 2025** (per area: × its own quantity, e.g. "× serving per chip") | the idea list as "+1.3%" each | OOM, OOM/yr, "+0.0058 ±0.0011 OOM" |
| Research payoff | where it lands: "+1.5% effective compute" (know-how), "new instrument: internals" (safety), "unlocks Mixture of experts" | the range | `+0.12 OOM pretraining` |
| Speed / rate | ×N (research speed), /yr (results, acts) | | M, "vs leader day 0" (baseline per DQ-4) |
| Chance | % (`chance it works 40%`) | | odds, Beta, health |
| Belief | best guess % (low–high); **Unknown** if range > 30 pts | evidence list | est^1.5, sd, "Misalignment band" |
| Serving cost | $ per hour of work | $ per H100e-hour | FLOP/tok |
| Data | tokens (T), "re-read ×3" | quality-weighted tokens | U, q, Σ quality × tokens |
| Money | $ (`$0.67`, never `$0.67¢`) | | |

## 2. Remove from player view

| Remove (where) | Replace with |
|---|---|
| **OOM**: ~77 UI, 49 glossary, 25 views | Units of §1. OOM only in the designer overlay (OQ-1) |
| **G**, "Effective compute (G)", "G gained", "Pretraining G", ΔG (Blueprint.tsx:441-471, Data.tsx:308, Suites.tsx:204, glossary `G`) | "Effective compute" (no letter); run gain shown as skill-bar ghosts |
| **L** prefix: "L 7.3 ± 0.21" (Models.tsx:98-132), "Sight limit L 9.1 (8.4–9.8)" (Safety.tsx:156, TopStrip.tsx:33, CoreLoop.tsx:78), "L x vs θ" (Danger.tsx:38) | Skill bar plus ticks. Sight limit = a tick on the same ruler: "1.2 levels short of Atlas-4" |
| **U**: "U, if {idea}" (Safety.tsx:270), "not in U" (Data.tsx) | "Sight limit if it works"; "unique tokens" |
| **c, ℓ, λ, X**: "Compute c", "Labour ℓ", "Experiment throughput X", "to the power λ" (ResearchProjects.tsx:288-295, Company.tsx:156-174) | "Experiment compute", "Research engineers", "What 10% more buys" |
| **M**: "AI R&D multiplier M" (glossary `rdmult`, the title shown on "Research speed") | Research speed; AI's part as "×1.4 from AI staff" in the tooltip |
| **ω, κ**: "Successor pull ω", "ω = κ × share × (1 − oversight)" (Safety.tsx:400-428), "Trait movement ω" (Pressure.tsx:89-94, glossary) | "Pushes" per risk family (TRAINING); successor steering is an act in the Risks table |
| **S1–S9** training signals, with two name sets (SIGNAL_LABEL Pressure.tsx:18-21 vs SIGNAL_SHORT TraitGraph.tsx:15-18), "S2" (Suites.tsx:96-136, 23 hits), "Hacking pressure S2" | One name set, no codes: "Hacking pressure", "Rater approval", … (§3 Training) |
| **S1–S5** incident severity pills (Safety.tsx:850): they clash with the S-codes | Words: Minor · Serious · Severe · Critical · Catastrophic |
| **team-eq** and the other staff-unit spellings (≈40 hits) | §1 staff time |
| **SD**: "−1.4 SD", "x SD" taste, "±1 SD band" (Agents.tsx:99, Company.tsx:280, Evals.tsx:219-287) | Taste "like a top-5% scientist"; eval noise as a range |
| **Sci notation**: "1.2e+25", "3.2e21", "1.2e−4" (Models.tsx:52,257, ResearchProjects.tsx:39) | Compute in H100e-days; drop effect sizes in favour of % |
| **Formulas** in tooltips: Exposure = mis × (1 − s) × (1 + F) (SafetyControl.tsx:49); Clarity √(people ÷ 15) (Safety.tsx:701); "Capacity = Σ team people ÷ 40 …" (Research.tsx:308); "Training FLOP = 6 × …" (Blueprint.tsx:384-511); distillation gap "0.19 + 0.92 × log₁₀" (Blueprint.tsx:424); "scrutiny: 3 + 2 × severity" (safety/actions.ts:355); "×(ρ ÷ 15%)^¼" (Pressure.tsx); "coding CES", "labour margin" (Work.tsx:140) | A one-line cause in words plus the breakdown numbers; formulas go to the designer overlay |
| **Code ids**: node ids "(P12)", "(P08)", "P11" (Suites.tsx:113-279, runs.ts:916); "AI-control tools (AG07)" (chips.tsx:50); run "post 21" / "IDA 21" (runs.ts:615,641; models/actions.ts:203); teacher "V7" (dataActions.ts:135); "codeMath", "moe", "rolledBack" (Models.tsx:51-131); trait ids "SCHEME" (investigations.ts:128, framework.ts:67, dangerView.ts:127); "incident {id}" (Safety.tsx:693); "INV-x", "fh-id" (logs); "evalGov" (safety/actions.ts:368, Models.tsx:161); "api launch" (build.ts:243); "(model v3 E8)" (responses.ts:29); domain codes CODE / RSCH / AGENCY on screen (Blueprint.tsx:420,817; Data.tsx:192,238) | The display name of the thing (model name, discovery name, trait name, domain name: Code, AI research, Math & reasoning, Long tasks, …) |
| **Doc refs** in tooltip footers: `playerSource` (ui.tsx:69) filters only some prefixes, so ≈ **400 footers** show "Source: MODEL-V3 §5; research/20 C1" (MODEL-V3 117, research/* ≈ 200, FINANCE-V3 59, SAFETY-REDESIGN 12) | Drop. Paper citations: DQ-2 |
| **Paper cites** in tooltips: "Villalobos et al. 2024", "Besiroglu et al. 2024", "Khatri et al. 2025" (25 in the glossary, 3 in Blueprint.tsx:391-640); "(Goodhart)"; "Wilson" interval (Evals.tsx:197) | DQ-2 |
| **Statute codes**: "RAISE ≤ 3 d / SB 53 ≤ 15 d" (Safety.tsx:854) | "Must report within 3 days (NY law)" |
| **Raw markup**: "[[leverage]]" (RiskMap.tsx:37) | Fix the Rich rendering |
| **Raw enums**: open / locked / queued / active / failed (Research.tsx:272-323); variant full / mini / imported; layer badges B/T/S/L; Effort S/M/L/XL; D / C / O / "overs." (Danger.tsx) | Words in §3 |
| **Stale nav and glossary text**: the Company nav says "compute split" (Nav.tsx:16); the glossary `split` / `poolAgents` / `researchMix` / `poolSafety` describe the old nested pools; Products says "Build capacity: Company › Agents & teams" (Products.tsx:764) | Rewrite to the current mechanism |

## 3. Things and their one word

Columns:
- **Thing**: what the term denotes.
- **Now**: today's names on screen, with count and refs.
- **Word**: the proposed one word or short phrase.
- **Tooltip**: one line, in player language.
- **Unit**: what number to show with it.

`DEL` = remove from player text.

### LAB: compute allocation

| Thing | Now (count · refs) | Word | Tooltip | Unit |
|---|---|---|---|---|
| The share control | Compute allocation (Split.tsx:98), Compute split (models/actions.ts:362, Company.tsx:95, Nav.tsx:16, glossary `split`), Split tab (~12 "Compute › Split"), POOLS (Company.tsx:81-423), Budget / CAP / SAF (Products.tsx:804, Agents.tsx:89-184), Research mix (dead, Company.tsx:176), "Compute pools" (glossary) | **Compute allocation** | How your online compute is divided between uses. Set here only. | % · H100e |
| Presets | Reference / Race / Balanced / Safety (Split.tsx:98, departments/split.ts:134) | **Default · Race · Balanced · Safety-first** | One-click allocations. | — |
| Training use | Training runs, Training pool, training pool share, Pool share (Blueprint.tsx:454; glossary has two "Training pool" entries) | **Training** | Compute your training runs draw on. | % · H100e |
| Data generation use | Data generation, Synthetic data, Generation pool | **Data generation** | Compute your models spend writing training data. | % |
| Experiments use | Research experiments, Experiments, Experiments pool | **Research experiments** | Compute for your teams' small and big tests. | % |
| AI staff uses | Routine / Frontier research agents, Research agents, Agents pool, Engineering agents, Safety research agents, safety agents (split.ts:26-27) | **AI staff: engineering / experiments / ideas / safety** | Compute your AI staff run on, by job. | % · copies |
| Monitor compute | Monitors, Monitoring budget, Monitor (safety pool), "Full coverage needs" | **Safeguards** | Compute spent watching AI actions; billed to what it protects. | % |
| Safety use | Safety research lines and cases, Safety pool, Safety (glossary: "safety agendas") | **Safety work** | Safety research, validations, cases and safety evals. | % with its sub-uses |
| Serving use | Products (serving), Serving, Serving compute / pool / share / need, "Pool x H100e" (Products.tsx:801-841) | **Products** | Compute that serves your customers. | % · H100e |
| Unused allocated compute | Idle, Unallocated, Idle compute, "Training no run uses", "Monitors beyond full coverage", Idle serving | **Idle** | Compute no use draws on: it costs money and does nothing. | % · H100e |
| Idle-compute policy | Auto-split idle compute, Auto-split, "Send it to" (autoSplit.ts:63) | **Auto-split idle compute** | Sends idle compute to the uses you pick, and logs it. | — |
| Response charts | "What more of each buys", "R&D speed at ×¼ … ×4", saturated, Experiments only / Agents only (ResearchCharts.tsx:14-58, Split.tsx:116) | **What 10% more buys** | Ranked: what moving 10% of compute to each use would change. | % change of the target |
| Zero-share warnings | "Running training runs pause: no training compute", "Every product goes capacity-bound" | keep, as a warning chip | — | — |

### LAB: workforce

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| Engineering role | Engineers, "shared pool" (Company.tsx:268) | **Engineers** | Build and run products, tools, run setups and evals. | people · teams |
| Research-engineering role | Research engineers, Research eng., RE (×32, e.g. "RE team-wk" Evals.tsx:215), research-engineering, "Safety RE teams" | **Research engineers** (never RE) | Run experiments and keep training runs going. | people · teams |
| Science role | Scientists, Science, science teams, Researchers (ResearchCharts.tsx:15), staff | **Scientists** | Choose and design research; their taste sets idea quality. | teams |
| Safety staff | safety researchers, safety engineers, Safety research engineers | **Safety scientists · Safety research engineers** | The same roles on safety. | teams |
| Team | Team, team | **Team** | A group of people who work together. | — |
| Team quality | Solid / Strong / Elite | keep | — | — |
| Open slots | Seats open (Company.tsx:245); clashes with "Paid seats" | **Open positions** | — | count |
| Engineering capacity | Build capacity, build, "team-wk/wk build", In use (30-day) (BuildLoad.tsx:62-78, Work.tsx:134) | **Build capacity** | How much engineering your engineers and AI staff do per week. | % in use · weeks of queue |
| Engineering queue | Builds, Build queue, "Setups & adoptions" vs "Run setups, research adoptions, eval harness" (Work.tsx:26 vs research.ts:167) | **Build queue** | One-off engineering jobs in order. | time to finish |
| Standing product work | Product upkeep, Upkeep, "(off: keep-alive)" (BuildLoad.tsx:34) | **Upkeep** | Engineering each live product or tool needs every week. | staff used |
| Research engineers on runs | Run operations, run ops, stream operations (models/actions.ts:169) | **Run operations** | Research engineers keeping runs going; short = runs slow down. | % covered |
| RE adoption work | tuning, "tuning backlog", headroom | **Tuning** | Fitting new ideas into the recipe before a run can use them. | % backlog |
| Needs list | "Where it goes · priority order", gets / needs, Short, Cap / no cap (Work.tsx:59-118) | **Needs** (gets / needs) | Jobs in priority order; staff go to the top first. | staff used · short in amber |
| Unused staff capacity | Overflow, "idle x team-eq" (Work.tsx:118-119) | **Spare** | Capacity no need takes. | staff |
| Teams with no project | "x idle", Science teams with no project (CoreLoop.tsx:63) | **Idle** | — | teams |
| Safety RE needs | Open cases, Patches & removals, Line experiments, Tool re-validation (Work.tsx:26) | **Cases · Validations · Safety evals · Environment fixes · Foothold removal · Research experiments** | SAFETY-REDESIGN §5 order. | staff used |
| Star hire | Star, star taste, Star hire | **Star hire** | — | taste |
| Hiring | Keep hiring to / Target / Filling / Offers / Ramp-up | keep (**Hiring target**) | — | people |
| Next hire | "+x build / results/yr / −x d / tuning" (Company.tsx:208-211) | **Next hire buys** ([30]) | — | % of the thing it speeds |

### LAB: AI staff

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| Internal AI workers | Agents at work (×14), Agent package, Internal agents, AI agents, AI staff (×2), agent instances, Agent copies, "Your agents now do research" (Onboarding.tsx:74) | **AI staff** (by **job**) | Copies of your models working inside your lab. | copies |
| Their jobs | Engineering / Routine research / Frontier research / Safety research (data/v2/agents.ts:29-32) | **Engineering · Experiments · Ideas · Safety** | — | — |
| Copies | Copies, Copies × speed, "N copies × 5", "× a human" | **Copies** | Parallel copies; speed in the tooltip. | count |
| Share of a job done by AI | AI share, AI share of the work, Work AI does, AI FTE, "AI adds ×m", Effective labour, AI labour (experiments / ideas), Humans' share of the margin (Agents.tsx:95-216, Work.tsx:134-155, CoreLoop.tsx:65-92) | **AI share** | Share of the job's work your AI staff do. | % |
| People plus AI | Effective labour, "×m with AI", With AI | **Total effort** ([30]) | The job's work, people and AI together. | × the people alone |
| Safety work allowed to AI | Trusted to AI (Agents.tsx:123-133), Automate safety (glossary) | **AI share allowed** | The most safety work you let AI staff do. | % |
| Human re-checks | Spot-checks, "Safety engineers it takes" | **Spot-checks** | Share of AI work a person re-checks. | % · staff |
| Research taste of a model | AI taste, Research taste "x SD" | **Research taste** | How good its research choices are. | vs your scientists ("like a top-5% scientist") |
| How close AI is to a job | Fit, Fit vs people, Win rate vs median expert, Assist, Coverage, Superhuman mark, 50% / 80% time horizon (Work.tsx:41-163) | **Skill at this job** (bar); **Can do alone** (%); **Time horizon** | Bar vs median expert and best human; share of the job's tasks it finishes unaided; task length it finishes half the time. | bar · % · hours |
| Internal tools | Tooling, Agent tooling, Build internal tool, Coding harness / Research harness / Agent memory | **Tools** (same items as product tools, §PRODUCTS) | — | build time · upkeep |
| Cost of AI work | AI cost per work-hour vs best engineer | **Cost per hour of work** | — | $/h |

### RESEARCH

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| The board | Projects, Priorities, Priority list (ResearchProjects.tsx:201; glossary :80) | **Portfolio**; order = **Priority list** | All your research, capability and safety, in priority order. | — |
| Ongoing direction | Line (~132), Research line (safety), agenda, pool, direction, "Pool · ideas get harder", Safety agenda (glossary) | **Programme** (OQ-3) | Ongoing research that keeps producing results, each worth less than the last. | results so far · next result ETA |
| One-off | Idea (project kind), Axis, unlock, paradigm, "with products" | **Project** (OQ-3) | One-off research that either works or doesn't. | chance it works · ETA |
| Output tag | (none) | **capability · see · stop · fix** (+ meta) | What a result gives: better models; instruments; safeguards; methods. | — |
| Thing under test | Candidate (×17), idea, "Next idea's prior" | **Idea** | A possible improvement your team is testing. | expected effect (range) |
| Outcome | Result, Next result, finding, Finding (glossary), technique, discovery; "working tool / weaker result / dead end / spillover" (Research.tsx:345) | **Result** | What a finished idea or project gave you. | in its own unit |
| Stages | Ideas / ideation, Small test, Big test / scale test, Build-in / Adoption / adopted; unlock projects: Test; "Result estimate" (stage removed) | **Ideas · Small test · Big test · Build-in**; projects: **Test · Build-in**; safety: **… · Validate** | Where the work is. | stage bar |
| Odds | Odds, Chance it works, Works in this world (~50) | **Chance it works** | Your current odds this works, from attempts so far. | % |
| Safety programme outlook | Health, Line health: Promising / Mixed / Struggling (Safety.tsx:528, Research.tsx:42) | **Outlook** | Whether this programme is likely to produce working results. | Promising / Mixed / Struggling |
| Falling returns | Ideas get harder, Pool, Line so far, Realised, "Returns r", "Harder ×N", Diminishing returns | **Returns falling** | Each new result is worth about ⅔ of the first. | ×, in words |
| Expected effect | Next prior, Belief band, Mean ± one SD, Novelty, Result estimate, Estimate at latest base, "+0.012 ± 0.004" | **Expected effect** | What the team expects, with how sure it is. | "+1.5% (0.5–3%)" · "fairly sure" |
| Scale behaviour | "grows (s +0.03 ± 0.02)", "Effect × (run ÷ test)^s" | **At scale**: grows / holds / shrinks | — | word |
| Failure | Dead end, Dead ends "team-mo lost", Serious staffing, Follow-up, Reopen as speculative | **Failed** · **Retry (lower odds)** | — | time lost (weeks) |
| Team target | Teams wanted, Auto, max, "0 (paused)" | **Teams wanted** | How many science teams this should get. | teams |
| Assignment reason | Why here, Why this team | **Why this team** | — | % gain |
| Idea choice | Risk policy: Safe / Balanced / Speculative | **Idea choice**: Safe / Balanced / Bold | Which ideas the team tries first. ("Risk" is kept for safety.) | — |
| Project size | Effort S/M/L/XL, dots, "small … very large", Team-month (Research.tsx:32-98) | **Size**: small … very large | — | time to finish with current staff |
| Where an idea takes effect | Layer Backbone / Training / Scaffold / Lab, badges B/T/S/L (Research.tsx:28-30, Blueprint.tsx:295-311) | **Takes effect**: new base model · next post-training · a build · at once | — | — |
| Speed of the whole lab | Research speed, R&D speed, R&D multiplier, AI R&D multiplier M, "×N vs leader day 0", labSpeed (Company.tsx:153-159, CoreLoop.tsx:73) | **Research speed** | How fast your lab turns compute and people into results. | × the leading lab, Jul 2025 (DQ-4); AI's part in the tooltip |
| Bottleneck | Binds, What binds, compute-bound / labour-bound / human-bound / taste-bound, "labor-bound" (US spelling, CoreLoop.tsx:73), Compute-bound (believed) | **Limited by**: compute · research engineers · scientists · idea quality | The input that would speed this up most. | — |
| Inputs | Inputs today, Research production (prodfn), Unit project compute c / labour ℓ, Experiment throughput X | DEL (shown as **Gets**: "2 research engineers, 1% of experiment compute") | — | staff · % |
| The tree | Tree, Tech tree, Paradigm, Discoveries | **Discoveries** | One-off results that open new options. | — |
| Node states | open / locked / queued / active / failed / known | **Known · Available · Locked (needs …) · Queued · Researching · Failed** | — | — |
| Field | Specialty / lane | **Field** (Pretraining, Post-training, Systems, Alignment, Interpretability, Evals & control) | — | — |

### RESEARCH: know-how

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| The whole | Recipe (tab, Research.tsx:357; glossary `knowHow` titled "Recipe"), Recipe stack, stack, Stack efficiency | **Know-how** (five **areas**) | What your lab knows about training and serving models; new models build it in. | × vs Jul 2025 |
| Area 1 | Pretraining efficiency (STACK_LABEL research.ts:105), "pretraining" (ResearchProjects.tsx:22), pre | **Pretraining recipe** ([30]) | How much each chip of pretraining is worth. | × effective compute |
| Area 2 | RL compute efficiency, RL efficiency, rlMid | **Post-training method** (DQ-1) | How much post-training compute a given gain takes. | × post-training compute |
| Area 3 | RL ceiling (also Suites.tsx:81,95, whose Term points to `rlBudget`), rlCeil | **Post-training ceiling** (DQ-1) | How far post-training can lift a model. | × of the ceiling |
| Area 4 | Training throughput (STACK_LABEL, Recipe.tsx, ResearchProjects.tsx:22), train | **Training efficiency** ([30]) | Useful training per chip-day. | × |
| Area 5 | Serving efficiency, "serving" | **Serving efficiency** | Work served per chip. | × |
| Not yet in a model | Not trained in, Behind at finish, "N ideas · x OOM" (Recipe.tsx:53, Blueprint.tsx:456) | **Waiting** ("×2.2 waiting") | Know-how your newest model doesn't have yet. | × |
| Starting / outside know-how | Start and public knowledge, Public knowledge, Knowledge diffusion | **Public know-how** | What every lab knows from published work. | × |
| Growth | Software progress, OOM/yr (Recipe.tsx:108) | **Know-how growth** | — | × per year |
| Adopted total | Adopted · believed | **Yours** (believed until measured; F8.1) | — | × with range |
| First measured | Measured in, Measured gain, realisedEffect | **Measured effect** | The change your evals saw in the first model built with it. | levels |
| Non-area effects | Domain & data effects, "OOM for new versions", "web text = 1" | **Domain effects** | — | skill-bar change |

### TRAINING

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| Run design | Blueprint (×29), Plan, Planned run (Suites.tsx:119), Run plan (UI-IA), reference design, "Blueprint base-1 saved" (log) | **Next run** ([32]) | The run you are designing. | — |
| Prediction | Predicted model, Forecast level, Forecast from X | **Prediction** | What this run should give you. | skill-bar ghosts (range) |
| Run kinds | Base run / Post-train / Distill / Continue; Post-training run, Continue-train run, Distill run, Continued pretraining, base / train / post / evals (Gantt), Amplify (IDA), IDA cycle | **Pretraining: new · continue · distil** → **Post-training** (DQ-5; no "RL" in player view) | The two stages of making a model. | — |
| Options | Card, slot, Reference, ref, reference card | **Option**; default = **Standard** | — | effect in its own unit |
| Option effect columns | Capab. (ΔG in OOM; but ΔL on hover, Blueprint.tsx:553 vs 770), Time, Cash, Serve, family icons | **Skill · Time · Cost · Serving cost · Risk** | — | as §1 |
| Model size | Size, Base size, active parameters × tokens per parameter, "400B × 20" | **Size** (parameters); tokens per parameter in the tooltip | — | B parameters |
| Limits | FLOP / Wall time / G gained / Data (epochs) / Cash / Serving (FLOP/tok) / Engineers (team-wk) tiles; G-gained rows log₁₀ FLOP, Overtraining, Curation … | **Limits**: Compute · Time · Data · Cash · Run operations | What holds this run back. | days · re-reads · $ |
| Compute share of the run | Pool share, asks → gets, training pool | **Training share** (link to LAB) | — | % · days |
| Setup | Run setup, Wait for engineers | **Setup** | Engineering before the run starts. | time to finish |
| Data | Data portfolio, Data (×4 senses), Unique tokens, U, Quality, q, "Σ quality × tokens", Drawn mix, "spec. OOM" | **Data**; **Re-reads** (repetition); **Quality** | Your training text, how often runs re-read it, and how good it is. | T tokens · ×re-read |
| Domain mix | Natural mix, Reference shares, Share, ref, Data mix, specialisation ±1.3 OOM | **Data mix** | — | % by domain |
| Data sources | Public web, Licensed, Usage, Synthetic, Expert | keep | — | T tokens |
| Synthetic data | Generate data, Generation job, Teacher, Teacher yield, best yield | **Generated data** (teacher = model name) | — | tokens · H100e-days |
| Training environments | Suites (tab), Environment suites, Environment suite (glossary), RL families, "RL environments" | **Environments** (by **family**) | Tasks and graders a model practises on in post-training. | — |
| Environment quality | Fidelity ×1.00, Suite fidelity | **Realism** ([30]) | How much of the post-training ceiling these environments let a model reach. | % |
| Graders' weakness | Exploitable %, Exploitability | **Loopholes** ([30]) | How easily a model games these graders. | % |
| Run's push to cheat | Reward-hacking pressure (S2), Hacking pressure S2, "max 1", P11 | **Hacking pressure** ([30]) | How strongly this run rewards gaming the graders. | low … high |
| Environment builds | Build out a suite, Harden / Hardening, "+ demos", "1.0 t-wk · $0.1B" | **Expand · Harden** | — | time to finish · $ |
| Training signals | two sets: Approval reward / Rater approval; Reward-hacking pressure / Hackable graders; Long agentic tasks / Long-horizon RL (player word drops "RL"); Reasoning pressure / CoT pressure; Situational data / Scale + AI data; Eval-like training / Evals in training; Copies & shared memory / Many copies; Monitored-only reward / Oversight-cond. reward | **Rater approval · Hacking pressure · Long tasks · Reasoning pressure · Self-knowledge data · Test-like training · Many copies · Reward only when watched** | What in this run pushes the model's tendencies. | low … high |
| What the run does to tendencies | Training pressure, Risk pressure, Trait movement ω, "ω 0.4" | **Pushes** (per risk family) | — | ↑ / ↓ points |
| Running | Runs in progress, Stream, Continual learning | **Runs** · **Continual learning** | — | ETA |
| Distillation | Distill, Student size, teacher, "Mini of X", student 1/6, Distillation gap | **Distil** (student / teacher); the smaller model is named by the naming spec | — | size · skill drop |

### MODELS

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| A trained thing | Base (~229), Version (~110), Variant full / mini / imported, model, Internal agent (glossary) | **Model**; **base model** only for pretraining output | A trained model you own. | — |
| States | evaluating / ready / deployed / retired / rolledBack | **Testing · Ready · In use · Retired · Rolled back** | — | — |
| Domain capability | Measured level, L 7.3 ± 0.21, Capability level L, level, Capability, Capab., Domains (codes) | **Skill** (per domain bar); overall = **Capability** | Measured by your evals, against median expert and best human. | bar ± range |
| Domains | CODE RSCH REASON AGENCY … (codes on screen) | **Code · AI research · Math & reasoning · Long tasks · Social · Media · Cyber · Bio · Physical** | — | — |
| Milestones | MILESTONE_NAMES (capability.ts:16) vs ruler "agent / research agent / superhuman coder" (Blueprint.tsx:791) vs ticks "SC / SAR / ASI" (TopStrip.tsx:100) | **MILESTONE_NAMES, full, everywhere** | — | met / not met + date |
| Evals | Evaluations, Evals, Eval suite, Eval depth, Assessment, Capability assessment (Evals.tsx:82) | **Evals**; **Depth** basic / full / deep | — | time to finish |
| Eval noise | Measurement band, ±1 SD band, Bench noise, Band after, Elicitation "L" | **Range** | How far the true skill may be from what you see. | ± range |
| Re-eval policy | Eval policy, Auto-evaluate, Re-run rule "every N d or Δ ≥ x OOM" | **Re-test when** | "every 30 days or after a big change" | days |
| Benchmarks | Benchmark, Score, sat, "measured by self" | **Benchmark** · **Maxed out** | — | % |
| Serving cost | "x FLOP/tok · $y/h", Cost per hour of use, $/H100e-hour | **Cost per hour of work** | — | $/h |

### PRODUCTS

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| Models a product sells | Lineup, Lineup model, Main model, "N tiers · M selling", tier, student 1/80, Free tier, Cheap tier | **Lineup** (entries = **models** by name); Chat's free slot = **Free tier** | The models this product offers; buyers pick per task. | share of hours · $/h |
| Policy for smaller sizes | Auto-make cheap tiers, cheap tiers | **Auto-make smaller sizes** | Distils standard smaller sizes, with their compute and time cost. | — |
| Price level | Price tier Budget / Standard / Premium, markup, channel price, "×1.4 → asks $x" | **Price**: Low / Standard / Premium | — | $ per hour |
| Thinking setting | Effort low / max / deep, Deep think, "tokens ×N · fit +x OOM" | **Thinking effort** | — | cost × · skill-bar change |
| Product add-on | Features, Product feature, add-on, enabler / horizon / scaffold, Task enabler, Horizon extender, tool | **Tool** (coding harness, computer use, memory, research mode) | Lets a model do work it otherwise can't, at a stated cost per task. | where it helps · cost |
| Market fitting | Sector adaptations, + sector, adaptation, scaffold, certification, certified | **Sector certification** (DQ-6) | A per-product project with a visible "certified on" date. | date · effect |
| Limit | capacity-bound / quality-bound / price-bound / demand-bound / no demand, Binding, Binding cause | **Limited by**: serving compute · quality · price · demand | — | — |
| Unmet demand | Served / Unserved / Cut / Cut by Auto | **Served · Unserved** | — | % |
| Serving order | Auto (serving), Auto rule, Auto serving, Serve order, "most $ per H100e first" | **Serve the most profitable first** | — | — |
| Customers | Customers, customer stock, Target share, Customer speed "τ 3 wk", "within x pp", Paid share, Weekly reach | **Customers · Market share target** | — | count · % · weeks to win |
| Revenue parts | Adopted task-hours, Agent-hours, Paid seats, Unseated use, Supervising hours, Agent leverage | **Hours of work sold · Seats** | — | hours · $ |
| Product "Agents" | Agents (product) vs internal "agents" | **Agents** = the product only | — | — |

### SAFETY (SAFETY-REDESIGN §2.2 words; the redesign's Would try / Able to / Chances are on no screen yet)

| Thing | Now | Word | Tooltip | Unit |
|---|---|---|---|---|
| Model tendency | trait names; Kind behaviour / awareness / disposition / protective | **Trait** | A tendency of one model, e.g. games tests. | % of chances |
| Trait groups | Risk families People-pleasing / Gaming / Deception / Power, "Outside the families" | **Risk family** | — | — |
| Your estimate | belief, est. ± band, 90% band, Misalignment band, Estimate ± band, Belief band | **Belief** = best guess (range) | Your estimate, built from evidence only. | % (low–high) |
| Evidence quality | Clarity, Mean clarity, "clarity under 30%", Unseen, unseen (×13), "tools see it", "unread / barely read", "Critical traits under-observed" | **Range**; **Unknown** (range > 30 pts) | — | pts |
| Reading tool | instruments (41), Tools (~100), Tool (result type), "New tool: X." (log), detector(s), Detector, Technique, Tool family, "A detection idea" | **Instrument** | An owned way of reading a model's traits. | reliability |
| How far you trust it | reliability, measured / extrapolated, Strength, "strength on today's model", Faded, Half strength, masked, Goodhart G | **Reliability** (reasons: "trained against on V5", "model notices tests") | Chance it shows a trait that is present, on this model. | % (range) · validated on … |
| Measuring reliability | Validation, Validation jobs, Validate all, Re-validate, planted cases | **Validate** | Plant the trait in a test copy and count how many it finds. | k of n · time to finish |
| Old upkeep | Tool upkeep (TraitGraph.tsx:254; "freed for tool upkeep", safety/actions.ts:174) | DEL | — | — |
| The race | Sight limit (18), Capability vs sight limit, "U, if …", "past it by", "gap widening", detection grid "% detected", "TOOLS SEE", sees / blind | **Sight limit** (a tick on the capability ruler) | The most capable model your instruments can still read for hidden goals. | levels short of / past your best model |
| Hidden-goal set | "hidden-goal traits" vs "critical traits" | **Hidden-goal traits** | — | — |
| Harmful act | Danger · {where}, harmful acts/yr, Danger (estimated), Danger flags | **Harmful act** | Something a model could do that hurts someone. | /yr |
| Act factors | Disposition / Capability / Opportunity / Oversight, headers D / C / O / overs., eye icon (Danger.tsx:37-74) | **Would try · Able to · Chances · Stop rate** | — | % · bar · /yr · % |
| Stopping | Stop rate, Oversight, Not caught by oversight, unwatched, Catch rate, "your tools catch it", Effective oversight, R&D oversight, Oversight of an act, Control (believed), Control band | **Stop rate** ("Oversight" = only the political committee) | Share of attempts at this act your safeguards stop. | % |
| What gets through | Unstopped harm, "Bad actions slipping through ×x" | **Unstopped harm** | — | /yr by severity |
| Headline | Loss-of-control risk, "Loss of control" (intel.ts:122), Catastrophe risk estimate (RiskSources.tsx:99-108) | **Loss-of-control risk**: small in the top bar, the gauge on SAFETY | Your believed chance a model you run could act against you with nothing able to stop it. | % (range), "if it could act now" |
| Stop measures | Safeguards, Monitor, Monitor (internal), Runtime monitoring, Control layer (on a package), Control protocol, Comms lockdown / Lift / Remove lockdown, restrictions, human review | **Safeguard**; kinds: **Monitor · Control protocol · Human review · Restriction · Lockdown** | — | stop rate · slowdown |
| Watched share | Monitoring coverage, watched, Coverage | **Watched share** | — | % |
| Watcher gap | Gap to its monitor "x OOM", Oversight gap, Gap above humans, self-watched, Same-lineage monitor | **Watcher gap** ("1.2 levels below"), **Watching itself** | — | levels |
| Cost of safeguards | Control tax, tax −x%, Slowdown | **Slowdown** | Useful work lost to a safeguard. | % |
| Training fix | Method, Safety method, fix (tag), "A training method", "Method for later runs", Use all known methods | **Method** | A training-time fix you tick in the next run. | predicted change (pts) |
| Observed act | Incidents, status open / investigating / disclosed / leaked / covered | **Incident** | — | severity words |
| Investigation | Cases (tab), Investigations (card), Investigation, Case staffing, Investigate, INV-x | **Case** | A time-boxed investigation of one question. | time to finish · verdict |
| Covert asset | Footholds, Foothold capacity, Unfound, kinds (Backdoor …) | **Foothold** | — | points of risk |
| Own rules | Safety framework, Release clearance, Monitorability pledge, eval gate, "Misalignment signs", "held / paused / stopped" | **Safety framework**; outputs **Hold** (one word in UI and log) | — | rule → hold |
| Safeguard bundle | Meet my framework, Safeguard package, Package | **Framework safeguards** | — | — |
| Misalignment score | Estimated misalignment, Misalignment (your belief) | DEL → **Would try** of the "act against the lab" row (SAFETY-REDESIGN §2.3) | — | — |
| Risk sources | Where risk comes from, Risk source, Drivers | keep (**Where risk comes from**) | — | pts |
| Successor steering | Successor pull ω, AI share of R&D, Trusted to AI | an **act** ("steers its successor") plus **AI share** | — | — |
| Unknown failure mode | Unknown failure mode, umode, "Discovery: X is a real failure mode" | **New failure mode** | — | — |
| Evidence map | Trait graph, Edge, Evidence grade A–D, Moderator, edge ids "E01 A" | Codex drill-down only; TRAINING shows **Pushes** | — | — |
| Test vs real | Alignment evals, Test vs real use, "tests may understate real use ×a–b" | **In tests · In real use** | — | % (range) |
| Sabotage check | Expected vs observed | **Expected vs observed** | — | results/yr |
| Severity scale | low / watch / elevated / high (TraitGraph.tsx:201) vs low / elevated / high (SafetyControl.tsx:23) | **low · elevated · high** | — | — |

## 4. Payoffs and uncertainty phrasing (for previews and log lines)

| Situation | Write | Not |
|---|---|---|
| Know-how result | "+1.5% pretraining (likely 0.5–3%)" | "+0.0058 ±0.0011 OOM → next model" |
| Effect on the next model | ghost bars plus "Code +0.3 levels" in the tooltip | "Software fit −2.46 OOM" |
| Project odds | "chance it works 40%" | "odds", "health", "Beta" |
| Staff time | "~12 days with 3 teams" | "1.0 t-wk", "6 team-mo lost" |
| Log lines | model and discovery **names** ("Run launched: Atlas-3 post-training") | "post 21", "(P08)", "V7", "SCHEME" |

## 5. One word, one meaning (collisions resolved)

| Word | Meanings today | Keep for | Others become |
|---|---|---|---|
| Idle | 6: unallocated compute; unused training / serving / monitor compute; chips with no racks; spare staff capacity; teams with no project; features off everywhere | compute or teams with nothing to do | chips with no racks → **Unracked**; staff → **Spare**; feature off → **Off (upkeep only)** |
| Pool | idea pool, compute pools, training pool, synthetic pool, shared engineer pool | — (DEL) | the use's name; "returns falling" |
| Line | capability direction, safety agenda, sub-line, "its own line" | — (DEL, OQ-3) | **Programme** / **Project** |
| Suite | environment suite and eval suite (both in MODELS) | — | **Environments** (TRAINING), **Evals** |
| Tool | instrument, method, product feature, internal tooling, "tools x" affordance | product and internal **Tool** | **Instrument**, **Method**, "access" |
| Strength | tool decay, case completeness, method efficacy, flow width | — | **Reliability**, case **progress**, **Expected effect**, flow **size** |
| Coverage | monitor budget share, instrument reach, AI can-do-alone | — | **Watched share**, "reads: traits", **Can do alone** |
| Oversight | act factor, R&D "not caught", rogue "outside oversight", committee | political **Oversight committee** | **Stop rate** |
| Control | layer, tax, research, old gauge, "control protocols" | the safeguard **Control protocol**; the **Loss-of-control risk** | **Slowdown**; research tag "stop" |
| Band | belief interval, eval ±SD, gauge zone | — | **Range** |
| Disposition | trait kind, act factor, graph framing | — | **Trait**, **Would try** |
| Base | base model, stack start, reference scale | **base model** | "start", "today" |
| Effort | project size, thinking effort | **Thinking effort** (products) | project **Size** |
| Tier | lineup entry, price level, autonomy level, Free tier | **Free tier** (Chat) | lineup **model**; **Price**; **Autonomy level** |
| Agents | the product, internal AI workers | the product **Agents** | **AI staff** |
| Auto | Auto-split, serving Auto, Auto-evaluate, Auto teams | each named by what it does | "Serve the most profitable first", "Re-test when" |
| Reference | reset button, default card, data shares, design | — | **Standard** / **Default** |
| Budget | split groups, price tier, parent budget | finance **Budget** | **Compute allocation**; **Price: Low** |
| Test | unlock stage, small / big test, eval scenarios | research stages | eval **In tests** |
| Binds | research bottleneck, eval-queue bottleneck | — | **Limited by**, **Waits for** |
| Software | work type and sector "Software & IT" | sector | work type **Software engineering** |
| Health | safety line posterior | — | **Outlook** |
| S1… | severity S1–S5, signals S1–S9, "SC" | — | words (§2) |

## 6. Designer decisions (decided 2026-11-23)

All seven recommendations accepted; DQ-1 changed by the designer (consistent with DQ-5: no "RL" in player view).

| # | Question | Decided |
|---|---|---|
| DQ-1 | Know-how area names ([30] "RL environments" clashed with TRAINING's owned environments) | **Pretraining recipe · Post-training method · Post-training ceiling · Training efficiency · Serving efficiency** |
| DQ-2 | Sources in player tooltips (≈ 400 internal doc-ref footers, ~28 paper cites) | Internal refs → designer overlay; real paper citations → a Codex "Based on" line only; none in tooltips |
| DQ-3 | Capability numbers outside L1 | "levels" as a relative unit in tooltips and L2 (deltas, sight limit "1.2 levels short", watcher gap), with "10 = best human"; never an "L" prefix; L1 = skill bars |
| DQ-4 | Research speed baseline | **× the leading lab, Jul 2025**; AI's part as "×1.4 from AI staff" in the tooltip; the name "multiplier" dropped |
| DQ-5 | The run's second stage | **Post-training** (covers RL, preference training, alignment, methods); "RL" not in player view (RL budget → **Post-training budget**, RL focus → **Post-training focus**) |
| DQ-6 | Sector or market | **Sector certification**; "sector" everywhere |
| DQ-7 | Programme / project look alike | Keep **programme / project** with an "ongoing" / "one-off" chip; revisit ("Track / Project") only if playtests confuse them |
