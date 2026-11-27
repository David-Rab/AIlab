# Vision gap analysis: extended time period

Scope: what it takes to start earlier than Jul 2025 and to keep playing past superintelligence (ASI). Code read at `vision` = master `cd352aa`. No runs. **[V]** = verified in code; **[J]** = my judgement; **[to verify]** = source named from memory.

## 1. Date- and era-anchored inventory

Class: **a** = data that only needs earlier-era values; **b** = a mechanism that breaks or makes no sense at small scale, pre-LLM or post-ASI; **c** = fine as it is.

| Where | What it anchors [V] | Class |
|---|---|---|
| core/time.ts:5, core/init.ts:277 | `START_DATE = '2025-07-01'`, a constant. `startDate` is stored in the state (types.ts:167) and most code reads `s.time.startDate` | a |
| models/capability.ts:100 | `yearOfDay` reads the constant, not `s.time.startDate` | b (small: wrong for any other start) |
| data/world.ts:264 BASELINES | cash, revenue, valuation, compute, staff, China gap, opinion at Jul 2025 | a |
| data/world.ts:288–290 AIFM tables | world and leader H100e for 2025–2032; `logInterp` extrapolates both ways | a (back) / b (forward) |
| data/world.ts:317 refCapCompute | 0.68M H100e × 3.4^t, then 1.6×/yr forever; negative t back-casts at 3.4×/yr (2015 → about 3 H100e, which is absurd) | a / b |
| data/world.ts:82–88 laborSlowdown, computePace | "from 2029" switches (AI 2027 code). Now read only by the calibration path (world/calibration.ts:22), not by play | c |
| data/v2/calibration.ts:64, :73 | AI2027_COMPUTE_TABLE and SHARE_REF (compute split), 2025.5–2027.875, held flat outside (departments/split.ts:48) | a |
| data/v2/calibration.ts:22–45 | B0_DAY, V0_DAY, START_STATE `g ≈ 27.66` OOM (G of V0, Aug-2025 anchor) | a |
| data/v2/workTypes.ts:312 | gSC 30.15 (ai2027): SC is 2.5 OOM above the start | c (a fact of the world) |
| models/capability.ts:44 levelOfG | Level 5 = V0; below V0 it extrapolates linearly and **floors at 0**; capped at 15 | b (both ends) |
| data/v2/workTypes.ts:143 | METR h50 = 203 min at V0, ×4.2 per OOM | a |
| data/v2/benchmarks.ts:20–44 | 2024–25 suites (SWE-bench, GPQA, HLE, OSWorld, GDPval…) | a (pre-2023 needs ImageNet/GLUE/MMLU-era rows) |
| data/v2/paradigms.ts:12–15 | Reasoning RL, agentic environments, test-time compute, distillation: prior 1, already known | b for ≤2023 (they must become research) |
| data/v2/tools.ts:302 TOOL_START_CUTOFF | which rival tools exist at start, by real ship date | a (the rule already takes a cutoff) |
| data/v2/features.ts:33 PRODUCT_ORDER | Chat, API, Enterprise, Vetted products | b for ≤2019 (no LLM market) |
| data/v2/starts.ts:70–131 | four starts, analogues "mid-2025" | a |
| data/v2/starts.ts:164 PARENT_BUDGET | year0 $16B, Alphabet capex 2024–26 path | a |
| data/v2/teams.ts:61 START_TEAMS | ~2,500-staff leader | a |
| finance/ledger.ts:13–45, compute/sites.ts:11–20, compute/orders.ts:14–29, core/starts.ts:45–51 | named contracts and sites with fixed 2026–2030 end dates | a |
| finance/plan.ts:316 refRevenueRun | $12B × 3.5^t, then 1.8×/yr forever (bots, tests) | a / b |
| finance/investors.ts:182, finance/equity.ts:103 | IPO window opens at 2026.5 if hype ≥ 0.9 | b (date gate) |
| finance/actions.ts:444, plan.ts:145, :186 | recapitalisation (E02) and hyperscaler deal at `day >= 92` (Q4 2025) | b (event pinned to day) |
| actors/gov.ts:179–190 | SB 53 on 2026-01-01, RAISE 2027-01-01, Congress flips 2027-01-03 | b (scripted history) |
| actors/public.ts:27 | elections: only Nov 2026 and Nov 2028 | b (stops in 2029) |
| actors/china.ts:30, :49 | China at Jul 2025, 0.72 OOM behind; `shareRefAt(2025.5)` | a |
| compute/market.ts:19–27, :105 globalRefQ | chip price at Q3 2025; production 2.2× → 1.95× → **1.5×/yr forever** | a / b |
| compute/market.ts:200 geoTWAt | Taiwan share by year, flat 0.75 after 2030 | a |
| compute/sites.ts:277 | kW per H100e × 0.944 a quarter, **no floor**; grid pool × 1.25/yr forever | b (forward) |
| security/security.ts:22, core/limitsView.ts:61 | weight-security floor 2.2 + 0.55·min(yr − 2025, 2); negative before 2025 | a (needs a clamp) |
| workfit.ts:152, production.ts:245 | serving price 14,000 × 0.8^(yr − 2025.5) fallback | a |
| production/ces.ts:68–82 | reference headcount 2050 + 49.2/month; frontier run ≈ 1e27 FLOP Jul 2025 | a |
| worldfx/sectors.ts:149, :219; data/v2/sectors.ts:162 | world at Jul 2025, Dow 44,000; `PRE_LLM_LEVEL = 3` already exists | a |
| worldfx/robots.ts:84 | SEZ doubling clamp of 2 weeks "before 2035" | b (date gate) |
| endings/endings.ts:136 | hard stop at 2051.0 ("The long road") | b |
| endings/view.ts:66 | end-screen scale "5 = Jul-2025 agent … 15 = superintelligence" | a |
| data/glossary.ts:9–12 | text with 2025 numbers ("~1.15x today", "Mar 2027") | a |

Summary [J]: most anchors are **data** (class a) and the code mostly reads `s.time.startDate`, so moving the start is a data job. The real breaks are few: the capability scale's floor, the "already known" LLM paradigms and LLM products, date-pinned events and laws, and the forward growth rates with no physical limit.

## 2. Earlier start options

What the engine is [V]: capability is effective compute G (loss law, Besiroglu 2024; RL; data), research is a CES of compute and labour in units of "the leader lab at day 0 = 1" (production.ts:11), and research lines are pools with log returns (research.ts:70). These are physical and scale-free, so they should work at small scale once re-normalised. What is era-bound is the content on top.

The capability scale [J, from the knots]: in the ai2027 world there are 2 levels per OOM (V0 27.66 → SC 30.15 = levels 5 → 10). The level hits 0 about 2.5 OOM of effective compute below the Jul-2025 frontier, roughly the GPT-4 era (early 2023). So every start before about 2022 sits at level 0 on the display, and so does every model. The floor at 0 must go, or the scale needs a log tail below level 0.

| Start | World | What breaks | Data needed (all [to verify]) | Rough size [J] |
|---|---|---|---|---|
| **2023 (Jul)** post-ChatGPT | GPT-4 out, chat and API exist, agents do not, reasoning RL not yet discovered | Level ≈ 1; P01–P03 must be unknown research; agent labour ≈ 0 (fine, emergent); laws and events re-dated; benchmark rows to MMLU/HumanEval era | Epoch AI "Notable AI Models" (training FLOP) and GPU price-performance data; lab revenues and headcounts from filings; Nvidia 10-K data-centre revenue for the chip stock | **Medium**: mostly data plus making start paradigms researchable |
| **2020 (Jun)** GPT-3 | API beta only, no consumer product, compute ~10^4 GPUs | All of 2023 plus: level 0 floor; product market almost empty (API only); sector adoption ≈ 0 for years; the money story is investors and a parent, not revenue | Kaplan 2020 and Hoffmann 2022 scaling laws (the loss law already uses Besiroglu's refit), Epoch compute data, OpenAI–Microsoft 2019 deal terms | **Large**: needs a pre-product phase and a scale below 0 |
| **2017** transformers | Research labs, no products, funded by parents and donors | Products, market, sectors, revenue all idle for ~3–5 years; the game becomes research and fund-raising only | Vaswani 2017; Amodei & Hernandez 2018 "AI and Compute"; DeepMind/OpenAI 990s and Alphabet "Other Bets" filings | **Very large** |
| **2015** AlphaGo era | Deep RL and vision; language is not the path yet | All of 2017 plus: the tech tree assumes LLMs (pretraining/post-training columns, tokens, data pool); the path to transformers would have to be research | Silver 2016; Epoch compute data | **Very large**, new content tree |

**Recommendation [J]: 2023 is the cheapest credible earlier start.** It adds two years of real history that the engine already understands (scale-up, chat and API revenue, first agents) and turns today's "known at start" paradigms (reasoning RL, agentic environments, test-time compute) into the first real research decisions. The cost is mostly data: a second start-state table per world, earlier products and sectors, and the fixes below. 2020 is the next step only if a "pre-product" phase is wanted; it should not come before a below-0 capability tail.

Work needed for any earlier start [J]:
1. Replace each start table with a **dated start-state record** (BASELINES, START_STATE, compute tables, SHARE_REF, teams, ledger, sites, China, gov, public, sectors) chosen by start year.
2. Back-casts need **sourced history** instead of today's growth rates (refCapCompute at 3.4×/yr gives nonsense before 2022).
3. **Laws and events become conditions, not dates** (gov.ts:179–190, IPO at 2026.5, recap at day 92, elections). The designer rule "real laws keep real dates" (gov.ts:178) only works for a 2025 start. From an earlier start the law should come from the gov mechanism (bloc pressure, incidents), or the game is a history script.
4. **The capability scale needs a tail below 0** (or a re-based scale) so 2020–2023 models differ.
5. **Paradigms known at start become research** for the earlier start (paradigms.ts:12–15 priors stay; only the "known" flag moves).
6. Fix `yearOfDay` (capability.ts:100) to read the save's start date.

## 3. Later play and post-ASI

### Quantities that run away or saturate [V unless marked]

| Quantity | Behaviour | Problem |
|---|---|---|
| Global chip production (market.ts:105) | 1.5×/yr forever: about 2×10^11 H100e a quarter by 2050 [J, arithmetic] | No energy, wafer or materials limit |
| Leader reference compute (world.ts:317) | 1.6×/yr forever | Same; used by rivals and the leader twin |
| kW per H100e (sites.ts:277) | falls 1.26×/yr with no floor | Passes physical limits of FLOP per watt [J; Epoch's FLOP/W limit estimate to verify] |
| Grid pool (sites.ts:278) | 1.25×/yr forever | Never binds post-ASI |
| Robot SEZ doubling (robots.ts:84) | down to weeks; the 2-week clamp ends in 2035 | Explosive by design (R16); needs physical ceilings (land, energy, materials) |
| GDP (macro.ts:5–11) | explosive regime allowed with W17 | OK as a regime, but nothing then limits it |
| Display level (capability.ts:44) | capped at 15 = ASI | After ASI every model reads 15; progress becomes invisible |
| Benchmarks (benchmarks.ts) | logistic, all saturate by level ~12 (OpenProblems mL 11.6) | Nothing to measure after ASI |
| Research lines (research.ts:70) | log returns, never exhaust | c: good shape for the long run |
| Ideas and paradigms (tree.ts, paradigms.ts) | a finite list of one-off nodes | Exhausted by mid-game |
| Sectors, jobs (sectors.ts) | fractions 0–1 with Bass diffusion | c: saturate gracefully at full automation |
| Revenue, valuation | follow the market and the story, no ceiling found | b [J]: at full automation, revenue as a share of GDP has no stated bound; needs checking with the finance owner |
| China and gov ladders (china.ts rungs 0–6) | top rung 6 is war, which ends the game | Nothing above it |

### Systems with nothing to do after ASI [V / J]

- **Endings**: any lab's ASI ends the game (endings.ts:114–126). Milestones stop at index 6.
- **Scoring**: five axes computed once, at the end (scoring.ts:121). A continuing game has no running score.
- **Epilogue**: only a fast projection to the first ASI (epilogue.ts:143); no simulation after it.
- **Products and market**: buyers choose between lab products by skill and price; when AI does nearly all cognitive work, the market becomes "who owns the compute", not product design [J].
- **Safety**: built around catching misalignment before ASI; after ASI the question is control of a running superintelligence (the existing `asiControl`, `leverage`, control shares in worldfx/control.ts are the seed) [J].
- **Actors**: gov, China and public ladders describe a race to ASI; none has a post-ASI state.
- **World techs** (techs.ts W1–W29, incl. W17 factories, W18 nanotech, W29 space): the only post-ASI content that exists, and it is a finite list.

### What a continuing "changed world" needs [J]

1. **A world-state switch, not a stop**: the ending records the event (who, aligned or not, control shares) and the game goes on with changed rules for that world (nationalised lab, ruling ASI, war economy).
2. **Physical ceilings** on the runaway curves, each from a primary source: energy (world electricity and solar resource), chip fabrication (wafers, materials), FLOP per watt (Landauer and realistic limits), robot materials. With ceilings, growth becomes logistic by mechanism, not by a rule.
3. **A capability scale with no top**, or a second scale past ASI (for example by domain and by speed: Bostrom's speed / collective / quality superintelligence [to verify]); benchmarks replaced by real-world outcomes (science solved, sectors run, GDP share).
4. **Post-ASI goals** for the scoring axes read continuously (survival, freedom, prosperity, geopolitics already describe a post-ASI world).
5. **Actor states after ASI**: government with or without control, China's response, public under full automation.

**Recommended first step [J]:** before any continuation, add the physical ceilings to the forward curves (compute, power, efficiency, robots) and remove the 2035 and 2051 date gates. That is needed for a long game anyway, it is sourced work, and it shows where the economy settles. Then build one "changed world" continuation, the player's own aligned ASI, since control shares, leverage and world techs already exist.

## 4. Questions for the designer

1. Earlier start: is **2023** acceptable as the first earlier start, with 2020 and earlier left for later? Or is a pre-product era (2017–2020) a must?
2. From an earlier start, should real laws (SB 53, RAISE) and real events (recapitalisation, IPO window) still happen on their real dates, or only if the game's mechanisms produce them? (Real dates make a history script; mechanisms make them emergent.)
3. Earlier start: should the paradigms known in 2025 (reasoning RL, agents, test-time compute) be research the player can miss, so the player can be wrong about what works?
4. Capability display: extend the scale below 0 (2020 models at negative levels), or re-base it so the start is always level 5 whatever the year?
5. Post-ASI: which changed world continues first: your aligned ASI, a rival's aligned ASI, nationalised, or war?
6. Post-ASI: what is the player doing? Running a company, a state, or steering an ASI? This decides which systems carry on.
7. Is a hard calendar end still wanted (for example 2060 or 2100), or does a game end only by event?
8. Physical ceilings: accept logistic ceilings on compute, power and robots from primary sources, even though they change the 2030s results the current calibration targets?
