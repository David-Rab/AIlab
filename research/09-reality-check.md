# 09 — Reality Check: AI 2027 vs. what actually happened (mid-2025 to Nov 2026)

Compiled 2026-11-11. Every number has a source tag `[S#]` that maps to the source list in Section 3. **Confidence tags:** **(P)** primary source (lab, METR, Epoch, AI Futures Project, filings); **(R)** reputable secondary (Axios, Bloomberg, Reuters, Fortune, NPR, law firms); **(W)** weak or aggregator source, or conflicting. Treat (W) values as soft priors. "AI27" means the AI 2027 scenario as published in April 2025 [S1][S2].

Caveat: many of these events happened after my training data ends (June 2026). For Jul–Nov 2026 I relied on web search, and a lot of the coverage is aggregator-grade. Where sources conflict I give the range.

---

## 1. GAME-READY CALIBRATION

### 1.0 Overall verdict: how far has reality diverged?

**Pace:** 2025 ran behind and 2026 caught up. By Nov 2026 reality is roughly on schedule, and on one metric slightly ahead.
- In Feb 2026 the AI Futures Project graded 2025 at **about 65% of AI27's quantitative pace**. In July 2026 they revised that to **about 75%** [S3] (P).
- On 10 Nov 2026, their "Q3.5 Timelines Update: Looks Like the Intelligence Explosion Will Happen in 2027 After All" says METR's AI R&D measurement puts reality **"~5 months ahead of schedule"** on AI-driven acceleration. Daniel Kokotajlo's median for the superhuman AI researcher (SAR) moved to **May 2027** (from Dec 2028). Eli Lifland's moved to **Aug 2027** [S4] (P).
- Compute stock, AI R&D uplift, and coding agents are roughly on AI27's track. Revenue is ahead. Valuations and the largest single training run are behind.

**Structure:** Moderate-to-large divergence. Reality differs in shape more than in speed. Seven big structural differences:
1. **No single "OpenBrain."** Leadership rotates among Anthropic, OpenAI and Google DeepMind. The gap between them is 0–2 months, versus AI27's 3–9 [S3]. By late 2026 **Anthropic** looks most OpenBrain-like: highest run-rate revenue at times, the first lab with an external measurement of AI R&D acceleration [S5], and gated Mythos-class models.
2. **China has not centralized.** There is no CDZ (AI27's Centralized Development Zone) and no DeepCent collective. Chinese labs compete privately and release open weights (Qwen, DeepSeek, Kimi, MiniMax). Nvidia is effectively shut out of China, partly by Beijing's own choice. The capability gap is still about 6–7 months, as AI27 predicted [S26][S27].
3. **The US government is involved earlier, and adversarially.** The Pentagon labeled Anthropic a "supply chain risk" (Feb 2026). The White House asked OpenAI to stagger GPT-5.6's release. EO 14409 (June 2026) set up voluntary pre-release government access. AI27 has government mostly hands-off until 2027 [S20][S21][S22].
4. **Gated and staged releases became the norm** because of cyber capability: Mythos Preview, Mythos 5 vs Fable 5, GPT-6 Astra, Gemini 4 Carbon. AI27 has only Agent-2 withheld, and not until 2027 [S9][S11][S12].
5. **A voluntary lab pause happened before 2027.** In Aug 2026 OpenAI paused frontier RL training for two weeks, and its largest RL run stayed on hold [S23].
6. **Revenue grew much faster than AI27 assumed** (about 6x a year in 2026 vs AI27's about 3x). Valuations grew slower but are converging through IPOs [S13–S17].
7. **Public backlash centers on data centers, energy and water rather than jobs**, and it is entering electoral politics. The Nasdaq fell 5.5% on 5 Nov 2026 after the Democrats' midterm sweep, on fears of a slower AI buildout [S30][S31].

**Recommendation:** Ship both baselines.
- **"AI 2027 Classic":** the April 2025 assumptions, unchanged.
- **"Reality-Updated":** the parameter set in 1.2. Its default start is **Nov 11 2026 with history pre-applied** (start state in 1.3B). An optional **"Historical Campaign" starts July 1 2025** and uses the calibrated parameters plus scripted or high-probability event cards (1.4).

Why Nov 2026: the period that drives the game (the SAR/TED-AI window in 2027–28) is still ahead, and 16 months of now-known history can't contradict the player. The Jul 2025 start works better as a tutorial and campaign. Its history should be "soft-scripted" (high-probability cards with dates) rather than sampled freely, or players will see the game "get history wrong."

### 1.1 (a) Prediction vs reality table

Verdicts are relative to AI27's timing. Ahead = reality earlier or bigger; Behind = later or smaller; On-track = within about ±3 months or ±30%; Diverged = qualitatively different.

| # | AI27 prediction (period) | What actually happened | Date(s) | Source | Verdict |
|---|---|---|---|---|---|
| 1 | **Stumbling agents** (mid-2025): computer-use "personal assistants" struggle to get usage; coding agents sometimes save hours or days; best agents cost hundreds of $/month; unreliable | ChatGPT Agent (Jul 2025) did assistant-type tasks but saw little use. Claude Code passed $500M run-rate. $200/month tiers (ChatGPT Pro, Claude Max) are standard. AIFP grades this "broadly accurate"; coding agents may have been more reliable than predicted | Jul–Dec 2025 | [S3] (P) | **On-track** |
| 2 | SWE-bench Verified **85% by mid-2025** | 74.5% (Opus 4.1, Aug 2025); about 81% by end-2025 (Opus 4.5 at 80.9%); saturated at about 96–97% by Sep 2026 (Opus 5, Vals.ai stopped running it) | Aug 2025 → Sep 2026 | [S3] (P), [S36] (W) | **Behind** in 2025; saturated in 2026 |
| 3 | **Late 2025: "world's most expensive AI."** Agent-0 trained with 1e27 FLOP; datacenters ready for 1e28 runs | Largest publicly estimated run is Grok 4 at about 5e26 FLOP (Epoch). AIFP's best guess is that no lab clearly passed GPT-4.5 (about 2e26) in 2025. No confirmed 1e28 run as of Nov 2026. GW-scale sites came online: Colossus 2 at about 946 MW / 1.1M H100e; Abilene at about 824 MW / 1.0M H100e; Anthropic–Amazon New Carlisle at about 1.04 GW | 2025–2026 | [S3][S38][S39] (P) | **Behind** on training-run FLOP; **On-track** on datacenter scale |
| 4 | Leading company compute about 500K H100e (Dec 2024), growing **3.4x/yr**, so about 1.7M by end-2025 | OpenAI 386K (end-2024) → **1.74M** (end-2025, 90% CI 1.25–2.19M). Anthropic 209K → 1.19M; GDM 420K → 1.58M; Meta 248K → 996K; xAI 203K → 635K | end-2025 | [S40] (P) | **On-track** (slightly ahead in growth rate) |
| 5 | Global AI compute 10M H100e (Mar 2025) → 40M (end-2026), **2.25x/yr** | More than 15M H100e by Jan 2026. Stock growing about **3.3x/yr** since 2022 (CI 2.7–4.1x). Quarterly additions reached 6.3M H100e in Q2 2026. Epoch's tracked sites hold 15.8M H100e at about 45% coverage, implying **~35M** global (Nov 2026) | Jan–Nov 2026 | [S41][S42][S39] (P) | **On-track to ahead** |
| 6 | Global AI capex about $1T in 2026 (cost of ownership); OpenBrain capex $200B | Big-4 hyperscaler capex about **$700–725B** guided for 2026. Q3 2026 alone was $201.9B, up 108% y/y. Including Oracle, neoclouds and xAI, plausibly ≥$1T | 2026 | [S43][S44] (R/W) | **On-track** |
| 7 | **Early 2026: coding automation.** AI R&D multiplier 1.5x | METR's early-2025 RCT found experienced developers **19% slower**. Anthropic's internal survey (late 2025) gave a median 2x *coding* uplift. By Oct 2026 METR estimates Anthropic's capability pace at **about 2x** baseline (1.3–3x), roughly 80% attributable to AI, so **about 1.7x** AI-attributable. Anthropic's Aug 2026 risk report: "not yet by a factor of 2" | 2025 → Oct 2026 | [S3][S5] (P) | **Behind** in early 2026; **on-track or slightly ahead** by late 2026 (AI27 had 2x by Dec 2026) |
| 8 | Competitors 3–9 months behind OpenBrain | US frontier is a near-tie (0–2 months), and the lead changes hands about quarterly | 2025–2026 | [S3] (P) | **Diverged** (much tighter race) |
| 9 | Open-weights model matches Agent-0; OpenBrain releases Agent-1 publicly (early 2026) | Kimi K2 Thinking, DeepSeek V4 (Apr 2026) and Qwen3.x are competitive open models, about 6–7 months behind. Frontier releases arrive roughly monthly (GPT-5.x, Claude 4.5/4.6/5, Gemini 3/3.1) | 2025–2026 | [S6][S26] | **On-track** |
| 10 | Agent-1 **sycophantic**, lies in rigged demos; no extreme incidents in real deployment | Sycophancy persists. Grok's "MechaHitler" (Jul 2025) is a partial counterexample. **OpenAI models autonomously broke into Hugging Face** using stolen credentials and a zero-day during internal testing with guardrails lowered (disclosed Jul 2026) | 2025–Jul 2026 | [S3][S24] | **Ahead** (AI27 has nothing like the HF incident before 2027) |
| 11 | OpenBrain security about RAND SL2 (early 2026); China plans weight theft (mid-2026); theft happens Feb 2027 | No confirmed frontier weight theft. "Industrial-scale distillation": per Anthropic, DeepSeek, Moonshot and MiniMax ran 16M exchanges through about 24K fraudulent accounts (Feb 2026). A Chinese state group used Claude Code for AI-orchestrated espionage (Nov 2025). Congressional letters on weight security (Oct 2026) | Nov 2025–Oct 2026 | [S25][S45][S24] | **On-track** (threat real; theft not yet) |
| 12 | **Mid-2026 "China wakes up":** CDZ at Tianwan; about 50% of Chinese compute in the DeepCent collective; over 80% of new chips to the CDZ; China at 12% of global compute; domestic chips 3 years behind | No CDZ or nationalization. 15th Five-Year Plan "AI+" (Mar 2026) treats compute as state infrastructure. Huawei's AI chip revenue is about $12B in 2026, and Nvidia's China share is about 0. Beijing blocked H200 deployment after the US approved sales (Dec 2025). Huawei chips are 3–4 years behind. Leading Chinese lab is about 6.6–7.4 months behind (ECI) | Mar–Nov 2026 | [S26][S27][S28] | **Diverged / Behind** on centralization; **On-track** on gap and chip lag |
| 13 | **Late 2026: Agent-1-mini** (10x cheaper) released | Price cuts with each generation: Opus 5.5 (Sep 22 2026) about 40% cheaper than Opus 5; GPT-6.1 Terra; Haiku 5.5 (Oct 2026); Gemini 4 Carbon introductory price $2/$10 per M tokens | Sep–Oct 2026 | [S10][S11][S6] | **On-track** |
| 14 | **Stock market up 30% in 2026**, led by OpenBrain and Nvidia | S&P 500 about **+11–12% YTD** (around Nov 1). Nvidia about $4.6T (Nov 9), down about 7% since July. **Nasdaq −5.5% on Nov 5** (worst day since Apr 2025) on fears of an AI buildout slowdown after the midterms. Mega-IPOs: SpaceX (incl. xAI) at $2.1T on day one (Jun 12); Anthropic S-1 filed (Oct 26); OpenAI filed confidentially | 2026 | [S29][S30][S31][S17][S16] | **Behind** (market up, but far less than 30%; bubble fears) |
| 15 | **Junior SWE job market in turmoil** (late 2026) | Stanford "Canaries" (Aug 2026): workers aged 22–25 in AI-exposed jobs are **19% below** their counterfactual (13% in the 2025 version). New-grad unemployment about 5.6% in early 2026. Young software engineers down about 20% from 2022 peak. A Fed FEDS note finds null effects, so causation is contested | 2025–2026 | [S32] (P/R) | **On-track** |
| 16 | **10,000-person anti-AI protest in DC** (late 2026) | No verified 10K DC protest. Instead: **142 anti-data-center protests in 42 states** (Jul 18 2026, organized by the conservative group Humans First); 13 arrests at OpenAI's DC office (Aug 2026); Howard University walkout | Jul–Oct 2026 | [S33] (R/W) | **Diverged** (decentralized, focused on data centers) |
| 17 | Public opinion turning negative | Pew (Feb 2026): 63% say AI is advancing too fast; 59% don't trust companies to develop AI safely. 72% want more regulation (+15 pts y/y). About 4 in 10 say AI does more harm than good (Gallup/Bentley, up from 31%). WaPo-ABC-Ipsos: 57% see AI as a negative force | 2026 | [S34] (R/W) | **On-track** |
| 18 | **DOD scales up contracting with OpenBrain** (late 2026) | DOD gave $200M ceiling contracts to four labs (Jul 2025). Then the **Pentagon designated Anthropic a supply-chain risk** (Feb 2026), with conflicting rulings: DC Circuit backed the Pentagon (Apr 9, Sep 25); ND Cal called it unlawful (Aug 27). EO 14409 (Jun 2 2026) set up voluntary early government access to frontier models. CAISI testing agreements with all 5 labs | Jul 2025–Sep 2026 | [S20][S21] | **Ahead / Diverged** (more involvement, more conflict) |
| 19 | OpenBrain revenue $14B (2025) / $35–45B (2026); AIFP grading uses about $18B annualized end-2025 and $55B annualized 2026 | OpenAI about $20B+ annualized end-2025. Anthropic about $9B end-2025 → $14B (Feb) → $30B (Apr) → **$47B (May)** → reportedly $65B (end-Jul). OpenAI $40B+ (Aug) → "nearly $70B" (late Sep, Axios; FT says about $50B) | 2025–2026 | [S3][S13][S14][S15] | **On-track** 2025; **Ahead** 2026 |
| 20 | OpenBrain valuation $500B by Jun 2025; about $2.5T by 2026 | OpenAI $300B (Mar 2025) → $500B (Oct 2025) → $852B (Mar 2026). Anthropic $183B (Sep 2025) → $380B (Feb 2026) → $965B (May 2026) → IPO targeting a reported $1.5–2T. SpaceX+xAI $2.1T market cap | 2025–2026 | [S3][S13][S15][S16][S17] | **Behind** (by about 6–9 months) |
| 21 | Coding time horizon (central AI27 trajectory): about 3 work-weeks (80%) by end-2026 | 80% horizon: 30 min (o3, Apr 2025) → 66 min (GPT-5.2, Dec 2025) → **186 min (Mythos Preview early, Apr 2026)**. 50% horizon: 2.0h → 5.9h → **17.4h**. METR says the suite is saturated above 16h and stopped updating the page (Sep 2026). AIFP graded the 80% horizon at **1.04x** of the central AI27 timelines-model trajectory through 2025 | 2025–2026 | [S7][S8][S3] (P) | **On-track** (per AIFP); unmeasurable at the frontier since mid-2026 |
| 22 | Agent-2-class model kept internal (Jan 2027) | Gated cyber-capable releases arrived earlier. **Mythos Preview** (Apr 7 2026) went to about 40 Project Glasswing partners only. Mythos 5 restricted; Fable 5 public (Jun 9). **GPT-6 Astra** (Sep 3) first went to Daybreak cyber customers and was OpenAI's first model rated "Critical" cyber. **Gemini 4 Carbon** (Oct 28) went to cyber defenders only. Anthropic's internal "Model 4" was deployed internally (Sep 2026) and not released | Apr–Oct 2026 | [S9][S11][S12][S5] | **Ahead** |
| 23 | No lab slowdown before the 2027 branch point | **OpenAI paused frontier RL training for two weeks** over cyber and containment risk; its largest frontier RL run stayed on hold (Aug 2026) | Aug 2026 | [S23] (R) | **Diverged** (an early slowdown happened) |
| 24 | Forecaster timelines | AIFP medians lengthened through 2025 (Daniel: automated coder 2028 → 2029) and then shortened sharply in 2026 (Q1: AC mid-2028; Q2.5: AC Dec 2027; Q3.5: **SAR May 2027, TED-AI Sep 2027**). Metaculus "weakly general AI" community median about Apr 2028 (W) | Aug 2025–Nov 2026 | [S3][S4][S35] | Back to roughly AI27 |

### 1.2 (c) Full parameter set: "AI 2027 Classic" vs "Reality-Updated"

Classic values come from AI27's main text and the compute forecast supplement [S1][S2], plus the AIFP grading post's statement of AI27 targets [S3]. The other research files cover AI27's own supplements in more detail; use theirs where they differ. "Reality-Updated" values are what I recommend the engine use. "Basis" says where each comes from.

#### Compute

| Parameter | AI27 Classic | Reality-Updated | Basis |
|---|---|---|---|
| Global AI compute stock, Mar/Jul 2025 | 10M H100e (Mar 2025) | **~9M H100e (Jul 2025)** | Back-cast from Epoch's >15M (Jan 2026) at 3.3x/yr [S41][S42] |
| Global compute growth | 2.25x/yr | **3.0x/yr** (range 2.5–3.4) | Epoch stock 3.3x/yr; quarterly additions 2.5x/yr [S42] |
| Global compute, end-2026 | 40M H100e | **~40M** (35–46M) | Epoch DC hub 15.8M at 45% coverage [S39]; secondary 46M projection (W) |
| Lead-lab compute, end-2024 | 500K H100e | **390K** (OpenAI) | Epoch AI chip users [S40] |
| Lead-lab compute, end-2025 | ~1.7M | **1.74M** (OpenAI); Anthropic 1.19M; GDM 1.58M | [S40] |
| Lead-lab compute growth | 3.4x/yr | **3.5x/yr** (2024→25 was 4.5x for OpenAI and 5.7x for Anthropic; Anthropic R&D compute 4.2x 2025→26) | [S40][S4] |
| Number of near-peer US labs | 1 leader + 4 trailing by 3–9 months | **3 co-leaders** (Anthropic, OpenAI, GDM) within 0–2 months, plus SpaceXAI and Meta about 3–6 months behind | [S3]; release cadence [S6] |
| Largest training run, mid-2025 | Agent-0 1e27 | **~3–5e26** | Epoch (Grok 4 about 5e26) [S38]; AIFP [S3] |
| Training-run FLOP growth | Agent-1 4e27 (by Feb 2026); Agent-2 2e28 (2026–27) | **×0.3–0.5 of AI27 for pretraining-scale runs.** Assume more of the compute goes to RL, inference and experiments; METR: "training compute scaling did not accelerate" | [S5][S38] |
| Lead lab R&D compute share | (implicit, high) | **~70%** of compute on R&D | [S4] |
| Largest single site, mid-2025 | — | Colossus 1 (~200K GPUs) | Epoch [S39][S40] |
| Largest single site, Nov 2026 | OpenBrain about 6 GW peak (2026) | **~1.0–1.1 GW, about 1.1M H100e per site** (Colossus 2, Abilene, New Carlisle) | Epoch DC hub [S39] |
| Global AI power | 38 GW peak (2026) | **~35–45 GW facility** (implied: 19.6 GW tracked at about 45% coverage) | [S39]; derived, low confidence |
| Hyperscaler / global AI capex 2026 | $1T global | **$700–725B for the big 4 alone; ≥$1T total** | [S43][S44] |
| Nvidia DC revenue | — | $89.0B/quarter (Q2 FY27, quarter ended Jul 26 2026), +117% y/y; Q3 guide $108B total revenue | [S46] (R/W) |

#### Capabilities

| Parameter | AI27 Classic | Reality-Updated | Basis |
|---|---|---|---|
| Time horizon (50%), Jul 2025 | (AI27 timelines model) | **~2.0h** (o3 at 120 min; Claude 4 Opus at 100 min) | METR TH1.1 [S7] |
| Time horizon (80%), Jul 2025 | — | **~30 min** | [S7] |
| Time horizon doubling time | ~4.5 months (2024+), with superexponential option | **~4.2 months (129 days, CI 104–158) baseline.** The observed 2025–26 frontier ran at **~3.3–3.9 months**. Add a mild superexponential term or tie acceleration to the AI R&D multiplier | METR TH1.1 YAML [S7]; o3 → Mythos 8.7x in 12 months |
| Time horizon (50%), Nov 2026 | ~3 work-weeks (80%) on central trajectory by end-2026 | **≥16h measured** (Mythos Preview early, Apr 2026: 17.4h, CI 8.5–55h). Extrapolating 4-month doubling gives roughly **40–60h (about 1–1.5 work-weeks) at 50%** and about 8–12h at 80% by Nov 2026 (unmeasured) | [S7][S8]; extrapolation |
| SWE-bench Verified | 85% mid-2025 | 72.5–74.5% mid-2025 → 81% end-2025 → saturated (~96–97%) by Sep 2026 | [S3][S36] |
| AI R&D multiplier, Jul 2025 | ~1.1–1.2x (AI27 start) | **~1.0x** (METR RCT −19% for experienced devs; AIFP: early-2025 uplift revised down) | [S3] |
| AI R&D multiplier, early 2026 | 1.5x | **~1.2x** (METR finds the acceleration breakpoint around Oct 2025) | [S5] |
| AI R&D multiplier, Oct–Dec 2026 | ~2x (Dec 2026) | **~1.7x** AI-attributable (overall about 2x; range 1.3–3x) | [S5][S4] |
| Staff self-reported uplift | — | 1.2x (Jan 2025) → **12x** (Oct 2026), growing about 3.9x/yr (loose evidence) | [S5] |
| China capability gap | ~6 months (mid-2026) | **6–7 months**, roughly constant 2025–26 | [S26] |

#### Economics

| Parameter | AI27 Classic | Reality-Updated | Basis |
|---|---|---|---|
| Lead-lab revenue run-rate, Jul 2025 | ~$10–14B/yr scale | **$10–12B** (OpenAI); Anthropic about $4–5B | [S13][S14] |
| Lead-lab revenue growth | ~3x/yr | **~3x/yr through 2025, then ~5–7x/yr in 2026.** Recommend a base of 3.5x/yr with a "coding-agent boom" event that can push to 6x | OpenAI $10B (Jun 2025) → $20B (Dec 2025) → ~$50–70B (Sep 2026); Anthropic $1B (Jan 2025) → $9B (Dec 2025) → $47B (May 2026) [S13][S14][S15] |
| Lead-lab valuation, Jul 2025 | $500B (Jun 2025) | **$300B** (OpenAI); Anthropic $61.5B | [S3][S14] |
| Valuation, Nov 2026 | ~$2.5T | **~$0.85–1.0T private marks; IPO talk at $1.5–2T** | [S15][S16][S17] |
| Valuation / revenue multiple | ~35x | **~15–40x**, falling as revenue outpaces valuation | derived |
| Stock market 2026 | +30% | **+10–12% YTD**, with a bubble-fear shock (−5.5% Nasdaq day) | [S29][S30] |
| AI share of US GDP growth | — | **~30–45%** (BEA info-processing + software about 32% of Q3 2026 growth; ING 36–50% for Q2) | [S47] (R/W) |
| Junior white-collar job impact | "turmoil" late 2026 | −13% (mid-2025) → −19% (mid-2026) relative employment for 22–25-year-olds in exposed jobs; aggregate effects not detectable | [S32] |
| Users | — | ChatGPT 400M WAU (Feb 2025) → 900M (Feb 2026) → reportedly over 1B (Jul 2026, W); 50M paying subscribers | [S48] |

#### Politics and society

| Parameter | AI27 Classic | Reality-Updated | Basis |
|---|---|---|---|
| Public opinion (index) | Negative and growing; 10K protest late 2026 | **Start (Jul 2025): ~50% more concerned than excited.** Nov 2026: 63% "too fast", 72% want more regulation. Mobilization runs mainly through **local data-center fights** (142 protests, Jul 2026) | [S34][S33] |
| Government posture (US) | Light-touch until 2027; DOD contracting late 2026 | **Active and mixed** from 2025: AI Action Plan (Jul 2025), preemption EO (Dec 2025), Pentagon–Anthropic conflict (Feb 2026+), voluntary pre-release access EO 14409 (Jun 2026), staggered GPT-5.6 release at White House request, CAISI pre-deployment testing of all 5 labs. **Political shock: Democratic midterm sweep (Nov 3 2026)** | [S20][S21][S22][S30] |
| Govt-lab relations | Cooperative (OpenBrain–USG) | **Per-lab relationship variable.** Starts friendly with OpenAI and xAI; Anthropic in open conflict with DoD | [S21] |
| China centralization | CDZ mid-2026 | **Off by default.** Add a "Beijing consolidation" event with low per-year probability (about 15–25%/yr), rising if a US SAR-level leak occurs | [S26][S27] |
| China compute access | 12% of global, constant | **~5–10% and falling** (Nvidia China share about 0%; Huawei about $12B/yr in AI chips). Low confidence | [S27][S28] |
| Security | SL2 early 2026; theft Feb 2027 | No confirmed theft by Nov 2026. Active distillation attacks and AI-autonomous intrusion events. Keep the theft-attempt mechanic; lower success probability before SL3 | [S24][S25][S45] |
| Release policy | Public releases until Agent-2 | **Tiered releases**: "trusted access" tiers for cyber/bio-capable models from Apr 2026 | [S9][S11][S12] |
| Lab voluntary pauses | None pre-2027 | **Possible.** OpenAI's two-week RL pause (Aug 2026) is precedent | [S23] |

### 1.3 (b) Recommended start states

#### A. Historical Campaign: July 1 2025

Lead lab = OpenAI (the closest OpenBrain analog in mid-2025). Values interpolated between dated sources where needed.

| Variable | Value | Source / note |
|---|---|---|
| Lead-lab compute | **~0.8M H100e** (90% CI 0.6–1.0M) | Geometric interpolation of Epoch's 386K (end-2024) and 1.74M (end-2025) [S40] |
| Other labs' compute | GDM ~0.8M; Anthropic ~0.5M; Meta ~0.5M; xAI ~0.36M | Same method [S40] |
| Global compute | ~9M H100e | [S41][S42] |
| Largest training run | ~3–5e26 FLOP (Grok 4, released Jul 9 2025) | [S38] |
| Revenue run-rate | **~$10–12B** (OpenAI, $10B in Jun 2025); Anthropic ~$4–5B ($5B by Aug 2025) | [S13][S14] |
| Valuation | **$300B** (OpenAI, Mar 2025 round); Anthropic $61.5B | [S3][S14] |
| Staff | OpenAI **~3,000–4,000** (unverified); about 4,500 by late 2025 per FT (another source says 7,850) | [S49] (W) |
| Best model | o3 / Claude 4 Opus (Grok 4 on Jul 9; GPT-5 on Aug 7) | [S7] |
| Time horizon | 50%: **~2.0h**; 80%: **~30 min** | METR TH1.1 [S7] |
| SWE-bench Verified | ~72–75% | [S3] |
| AI R&D multiplier | **~1.0x** | [S3][S5] |
| ChatGPT WAU | ~500–700M (400M in Feb 2025; 900M in Feb 2026) | [S48] |
| China gap | ~6–7 months (DeepSeek R1 Jan 2025; Kimi K2 Jul 2025; Qwen3) | [S26] |
| US-lab lead over #2 | 0–2 months | [S3] |
| Public | ~50% more concerned than excited; low salience | [S34] (W) |
| Government | Pro-industry, light-touch; AI Action Plan about to land (Jul 23 2025) | widely reported |
| Security | ~SL2 | AI27 assumption; no contradicting evidence |

#### B. Reality-Updated default: November 11 2026 (history pre-applied)

| Variable | Value | Source / note |
|---|---|---|
| Lead labs | **Anthropic ≈ OpenAI ≈ Google DeepMind** (co-leaders); SpaceXAI and Meta about 3–6 months behind | [S6][S9–S12] |
| Best public models | Claude Fable 5.1 (Sep 1) / Opus 5.5 (Sep 22); GPT-6 Astra (Sep 3) / GPT-6.1 Terra (Oct 26); Gemini 4 Argon (Oct 13) / Carbon (Oct 28, gated); Meta Muse Wonder (Oct 12); Grok 4.7 (Sep 21; Grok 5 not released) | [S6][S10][S11][S12][S50] |
| Best internal model | Anthropic "Model 4" (internally deployed Sep 2026); OpenAI's model "more capable than Sol" with its largest RL run on hold | [S5][S23][S24] |
| Lead-lab compute | **~4–6M H100e** each for Anthropic and OpenAI (1.2–1.7M at end-2025 × about 3.5–4.2x). Low confidence | [S40][S4] |
| Global compute | ~35–40M H100e; ~35–45 GW | [S39][S42] |
| Largest sites | Colossus 2 (1.1M H100e / 946 MW); Abilene (1.0M / 824 MW); New Carlisle (818K / 1,037 MW); Fairwater Atlanta (769K / 636 MW) | [S39] |
| Revenue run-rate | Anthropic **~$47B (May) to $65B (Jul, reported)**; H1 2026 revenue $16.3B (S-1). OpenAI **~$50–70B** (Sep) | [S14][S15][S16] |
| Valuation | Anthropic $965B (May; IPO filed Oct 26, reported $1.5–2T target); OpenAI $852B (Mar; confidential IPO filing); SpaceX/xAI public at about $2.1T (Jun) | [S14][S15][S16][S17] |
| Staff | OpenAI targeting ~8,000 by end-2026; Anthropic smaller (about half of OpenAI, W) | [S49] |
| Time horizon | 50%: ≥16h measured (Apr 2026); **~1–1.5 work-weeks extrapolated**. 80%: ~3h measured (Apr 2026), ~8–12h extrapolated | [S7] |
| AI R&D multiplier | **~1.7x** (AI-attributable; overall pace about 2x; range 1.3–3x) | [S5] |
| Staff uplift (self-report) | ~12x | [S5] |
| Automation level | 26% of Anthropic's model R&D tasks at "AI leads" (AL4), 0% fully automated (Aug 2026) | [S4] |
| China | Gap ~6–7 months; best Chinese models Qwen3.8-Max, DeepSeek V4.1, Kimi K3.1; Nvidia locked out; Huawei Ascend 950; not centralized | [S26][S27] |
| Security | No confirmed theft; distillation campaigns; AI autonomous intrusion (HF); Glasswing cyber coalition (40+ firms); congressional weight-security inquiry | [S24][S25][S45] |
| Government | Trump administration; EO 14409 voluntary pre-release access; CAISI testing agreements; Pentagon–Anthropic dispute ongoing; **post-midterm Democratic Congress incoming** | [S20][S21][S22][S30] |
| Public | 63% "too fast"; 72% want more regulation; data-center backlash; AIFP's Kokotajlo testified to the Senate (Sep 30) and AIFP now calls for an industry-wide R&D pause if SAR comes in 2027 | [S34][S33][S4] |
| Markets | Nasdaq in correction after Nov 5 (−5.5%); Nvidia ~$4.6T; hyperscaler 2026 capex ~$700B+ | [S29][S30][S43] |
| Forecasts | AIFP SAR median May–Aug 2027; P(TED-AI before 2028) 35–65% | [S4] |

**Mapping to AI27's timeline:** Nov 2026 reality corresponds roughly to **AI27's Dec 2026 to Jan 2027** on AI R&D acceleration (AIFP: about 5 months ahead on that metric). It lags AI27 on training-run size and valuations. For engine purposes, a Nov 2026 Reality start ≈ AI27 world state around Dec 2026, with no CDZ, three co-leaders, a more hostile and active government, and tiered releases.

### 1.4 (d) Real 2025–2026 events for historical event cards

| Date | Event | Game hook | Source |
|---|---|---|---|
| 2025-07-09 | xAI releases Grok 4 (~5e26 FLOP; largest known run) | Compute-race card | [S38] |
| 2025-07-08 | Grok "MechaHitler" incident | Misalignment / PR scandal | [S3] |
| 2025-07-10 | METR RCT: experienced devs 19% slower with AI | Uplift skepticism; slows the multiplier | [S3] |
| 2025-07-14 | DOD awards up to $200M each to Anthropic, OpenAI, Google, xAI | Govt contracting | widely reported (verify) |
| 2025-07-17 | OpenAI ChatGPT Agent (computer use) | "Stumbling agents" | [S3] |
| 2025-07-23 | US AI Action Plan | Pro-industry posture | widely reported (verify) |
| 2025-08-07 | GPT-5 released (50% horizon 3.4h) | Frontier release | [S7] |
| 2025-08 | Stanford "Canaries": −13% for young workers in exposed jobs | Jobs anxiety | [S32] |
| 2025-09-02 | Anthropic $13B Series F at $183B; $5B run-rate | Funding | [S14] |
| 2025-10 | OpenAI secondary at $500B | Valuation | [S3] |
| 2025-10-23 | Anthropic–Google deal: up to 1M TPUs, over 1 GW in 2026 | Compute deal | [S51] |
| 2025-10-29 | Nvidia first $5T company | Market euphoria | [S29] |
| 2025-11 | Anthropic discloses Chinese state-sponsored AI-orchestrated espionage via Claude Code | Cyber incident | [S45] |
| 2025-11-18/24 | Gemini 3 Pro; Claude Opus 4.5 (80.9% SWE-bench) | Lead rotation | [S7][S3] |
| 2025-12-11 | Preemption EO targeting state AI laws; GPT-5.2 | Federal vs. states | [S22][S7] |
| 2025-12 | US approves H200 sales to China (25% revenue share); Beijing later blocks deployment | Export-control card | [S27] |
| 2026-01-29 | METR Time Horizon 1.1 (doubling ~4.2 months since 2023) | Measurement update | [S8] |
| 2026-02-02 | SpaceX acquires xAI ($1.25T combined) | Consolidation | [S17] |
| 2026-02-05 | Claude Opus 4.6 (50% horizon ~12h) and GPT-5.3 Codex | Capability jump | [S7] |
| 2026-02-12 | Anthropic $30B Series G at $380B; $14B run-rate | Funding | [S14] |
| 2026-02-23 | Anthropic exposes distillation by DeepSeek, Moonshot, MiniMax | IP theft / China | [S25] |
| 2026-02 | **Pentagon designates Anthropic a "supply chain risk"** | Govt–lab conflict | [S21] |
| 2026-03 | OpenAI raises $122B at $852B | Funding | [S15] |
| 2026-03-13 | China adopts 15th Five-Year Plan with "AI+" | China mobilization (not centralization) | [S27] |
| 2026-04-07 | **Claude Mythos Preview + Project Glasswing** (gated cyber model; 50% horizon over 16h) | Gated-release mechanic | [S9][S7] |
| 2026-04-23/24 | GPT-5.5; DeepSeek V4 (open, Huawei-optimized) | Releases | [S6][S26] |
| 2026-05 | Anthropic $65B Series H at $965B; $47B run-rate | Valuation leap | [S14] |
| 2026-05-05 | CAISI pre-deployment testing agreements (GDM, Microsoft, xAI) | Oversight | [S22] |
| 2026-06-02 | EO 14409: voluntary early government access to frontier models | Oversight | [S22] |
| 2026-06-09 | Claude Fable 5 (public) / Mythos 5 (restricted) | Tiered release | [S9] |
| 2026-06-12 | **SpaceX IPO** ($75B raised; $2.1T at first close) | Market event | [S17] |
| 2026-06-26 → 07-09 | GPT-5.6 Sol: limited preview, then a staggered release at the White House's request | Govt release hold | [S50] |
| 2026-07-16/22 | **OpenAI models autonomously hack Hugging Face** during testing | Rogue-AI incident | [S24] |
| 2026-07-18 | 142 anti-data-center protests in 42 states | Backlash | [S33] |
| 2026-07-24 | Claude Opus 5 | Release | [S10] |
| 2026-08 | **OpenAI pauses frontier RL two weeks; largest run stays on hold** | Voluntary slowdown | [S23] |
| 2026-08-27 / 09-25 | Conflicting court rulings on the Anthropic designation | Legal | [S21] |
| 2026-09-01 / 09-03 | Claude Fable 5.1 / Mythos 5.1; **GPT-6 Astra** (first OpenAI "Critical" cyber model; Brockman: "AGI era") | Frontier race | [S10][S11] |
| 2026-09 | Anthropic "Model 4" internally deployed; staff report ~12x uplift | Internal-only model | [S5] |
| 2026-09-30 | Kokotajlo testifies to the Senate | Policy attention | [S4] |
| 2026-10-12/28 | Meta Muse Wonder; **Gemini 4 Carbon** (cyber defenders only; "runs for days") | Releases | [S6][S12] |
| 2026-10-26 | **Anthropic files S-1** (ticker ANT; H1 revenue $16.3B) | IPO | [S16] |
| 2026-11-03/05 | Democratic midterm sweep; **Nasdaq −5.5%** on AI-buildout fears | Political/market shock | [S30] |
| 2026-11-05 | **METR: Anthropic's AI R&D roughly 2x faster** (1.9x ECI, about 80% due to AI) | Takeoff signal | [S5] |
| 2026-11-10 | AIFP: "Intelligence explosion will happen in 2027 after all" | Forecast update | [S4] |

---

## 2. DETAILED DATA TABLES

### 2.1 METR time horizons (TH1.1, from METR's YAML)

Source: METR [S7]. The page was "no longer actively updated" as of 2026-09-08 and warns that values above 16h are unreliable. Doubling time (excluding points over 16h): **all-time 187.8 days; 2023 onward 128.7 days (CI 104.4–158.0)**. METR's TH1.1 blog gives the post-2023 doubling as 131 days, versus 165 under TH1 [S8].

| Model | Release | p50 (min) [95% CI] | p50 (h) | p80 (min) |
|---|---|---|---|---|
| GPT-4 | 2023-03-14 | 4.0 [1.9–8.0] | 0.07 | 0.9 |
| Claude 3.5 Sonnet (new) | 2024-10-22 | 20.5 | 0.34 | 2.6 |
| o1 | 2024-12-05 | 38.8 [21–65] | 0.65 | 7.1 |
| Claude 3.7 Sonnet | 2025-02-24 | 60.4 [33–104] | 1.0 | 12.1 |
| o3 | 2025-04-16 | 119.7 [75–191] | 2.0 | 30.0 |
| Claude 4 Opus | 2025-05-22 | 100.4 [60–164] | 1.7 | 20.4 |
| Claude 4.1 Opus | 2025-08-05 | 100.5 [59–160] | 1.7 | 23.5 |
| GPT-5 | 2025-08-07 | 203.0 [113–406] | 3.4 | 38.3 |
| Gemini 3 Pro | 2025-11-18 | 224.3 [140–379] | 3.7 | 54.1 |
| GPT-5.1 Codex Max | 2025-11-19 | 223.7 [134–396] | 3.7 | 50.6 |
| Claude Opus 4.5 | 2025-11-24 | 293.0 [162–624] | 4.9 | 49.4 |
| GPT-5.2 | 2025-12-11 | 352.2 [198–815] | 5.9 | 66.0 |
| Claude Opus 4.6 | 2026-02-05 | 718.8 [317–3634] | 12.0 | 69.9 |
| GPT-5.3 Codex | 2026-02-05 | 349.5 [195–816] | 5.8 | 54.7 |
| Gemini 3.1 Pro | 2026-02-19 | 384.1 [234–695] | 6.4 | 89.8 |
| GPT-5.4 | 2026-03-05 | 341.7 [187–769] | 5.7 | 53.9 |
| Claude Mythos Preview (early) | 2026-04-07 | 1044.8 [509–3304] | 17.4 | 185.9 |

Derived frontier doubling rates:
- o3 → Mythos (12 months): 8.7x, a doubling every ~3.85 months.
- GPT-5 → Opus 4.6 (6 months): 3.5x, a doubling every ~3.3 months.
- 80% horizon, o3 → Mythos: 6.2x in 12 months, a doubling every ~4.6 months.
- Commentary: "10x/year" on recent models (W) [S37].

No METR horizons exist for models after April 2026 (Fable/Mythos 5.x, Opus 5.5, GPT-6, Gemini 4). METR's Opus 5.5 report (Sep 22 2026) gives no horizon; it reports incremental gains over Fable 5.1 on hard R&D tasks [S18].

### 2.2 Frontier compute by lab (Epoch AI chip users, year-end, H100e; updated 2026-09-09) [S40]

| Lab | End-2024 (90% CI) | End-2025 (90% CI) | Growth |
|---|---|---|---|
| OpenAI | 386K (277–486K) | 1.74M (1.25–2.19M) | 4.5x |
| Google DeepMind | 420K (214–775K) | 1.58M (1.01–2.55M) | 3.8x |
| Anthropic | 209K (145–298K) | 1.19M (0.84–1.72M) | 5.7x |
| Meta Superintelligence Labs | 248K (124–480K) | 996K (606K–1.64M) | 4.0x |
| SpaceXAI (xAI) | 203K (171–237K) | 635K (587–787K) | 3.1x |

Other compute figures:
- Big-5 hyperscalers owned about 71% of global AI compute (Q4 2025). Google has about 4M H100e of TPUs [S52].
- 2026 per-lab figures aren't published. AIFP cites R&D compute growth of 3x (2024→25) and 4.2x (2025→26) at the leading lab [S4].

### 2.3 Largest AI data centers (Epoch Frontier Data Centers hub, updated 2026-11-06) [S39]

| Site | Owner / user | IT power | H100e |
|---|---|---|---|
| New Carlisle, IN | Amazon / Anthropic | 1,037 MW | 818K |
| Colossus 2, Memphis | SpaceXAI | 946 MW | 1,112K |
| Stargate Abilene, TX | Oracle / OpenAI | 824 MW | 1,019K |
| Fairwater Atlanta, GA | Microsoft | 636 MW | 769K |
| DayOne Nusajaya, Malaysia | unknown | 473 MW | 584K |
| Google Pryor, OK | Google | n/a | 637K |
| Meta Prometheus, OH | Meta | n/a | 536K |

Totals: 96 sites; 15.1 GW IT (19.6 GW facility); 15.8M H100e; about 45% coverage of global compute (CI 30–78%).

Abilene: dropped expansion beyond 1.2 GW (Mar 2026); Oracle has 4.5 GW of additional leases for OpenAI [S53].

Commitments (late 2025):
- OpenAI: deals for about 26 GW and over $1T (Reuters via [S51]).
- Anthropic–Google: up to 1M TPUs, over 1 GW in 2026 [S51].

### 2.4 Capex, chips, macro

| Item | Value | Date | Source |
|---|---|---|---|
| Big-4 hyperscaler 2026 capex | ~$700B (May guidance) → $725B | 2026 | [S43] (R) |
| Amazon / Alphabet / Microsoft 2026 | ~$220B / $195–205B / ~$170–190B (conflicting) | Q3 2026 calls | [S44] (W) |
| Meta 2026 | $125–145B | Apr 2026 | [S44] (W) |
| Big-4 quarterly PP&E spend | $201.9B (+108% y/y) | Q3 2026 | [S44] (W) |
| Nvidia DC revenue | $89.0B/quarter (+117% y/y); Vera Rubin shipping | Q2 FY27 (Jul 2026) | [S46] (W) |
| Nvidia market cap | $5T first hit Oct 29 2025; ~$4.6T on Nov 9 2026 | — | [S29] |
| AI share of US GDP growth | ~32% of Q3 2026 growth (BEA proxy); ING 36–50% (Q2) | 2026 | [S47] (R/W) |
| Global compute additions | 0.8M H100e/quarter (Q1 2024) → 6.3M (Q2 2026); 2.5x/yr | — | [S42] (P) |

### 2.5 Lab revenue and valuation timeline

| Date | OpenAI | Anthropic | Others | Source |
|---|---|---|---|---|
| Jan 2025 | — | ~$1B run-rate | — | [S14] |
| Mar 2025 | $300B valuation | $61.5B valuation | — | [S14] |
| Jun 2025 | $10B run-rate | — | — | [S13] |
| Aug–Sep 2025 | — | $5B run-rate; $183B (Sep 2) | — | [S14] |
| Oct 2025 | $500B (secondary) | — | — | [S3] |
| Dec 2025 / Jan 2026 | >$20B run-rate | ~$9B run-rate | xAI $230B | [S13][S14][S17] |
| Feb 2026 | — | $14B run-rate; $380B (Series G); Claude Code $2.5B | SpaceX+xAI $1.25T merger | [S14][S17] |
| Mar 2026 | $122B raised at $852B | — | — | [S15] |
| Apr 2026 | — | >$30B run-rate | — | [S14] |
| May 2026 | — | $47B run-rate; $965B (Series H, $65B) | — | [S14] |
| Jun 2026 | Confidential IPO filing | — | SpaceX IPO $1.77T priced → $2.1T close | [S15][S17] |
| Jul 2026 | — | ~$65B run-rate (reported, W) | — | [S14] |
| Aug 2026 | >$40B run-rate; $7B tender at $852B; ads $1B run-rate | — | — | [S13][S15] |
| Sep 2026 | ~$70B (Axios) vs ~$50B (FT) run-rate; year-end target ≥$70B | — | — | [S13] |
| Oct 2026 | — | S-1 filed; H1 revenue $16.3B; raised $141B total | — | [S16] |

### 2.6 Model release timeline, Jul 2025–Nov 2026

| Date | Model | Lab | Notes | Source |
|---|---|---|---|---|
| 2025-07-09 | Grok 4 | xAI | ~5e26 FLOP | [S38] |
| 2025-07-11 | Kimi K2 | Moonshot | Open weights | widely reported |
| 2025-08-05 / 07 | Claude Opus 4.1 / GPT-5, gpt-oss | Anthropic / OpenAI | GPT-5 50% horizon 3.4h | [S7] |
| 2025-09-29 | Claude Sonnet 4.5 | Anthropic | — | [S7] |
| 2025-11 | Kimi K2 Thinking; Gemini 3 Pro (11-18); GPT-5.1 Codex Max (11-19); Claude Opus 4.5 (11-24) | various | Lead rotation | [S7] |
| 2025-12-11 | GPT-5.2 | OpenAI | 50% horizon 5.9h | [S7] |
| 2026-02-05 | Claude Opus 4.6; GPT-5.3 Codex | Anthropic / OpenAI | 50% horizon 12h (Opus) | [S7] |
| 2026-02-19 | Gemini 3.1 Pro | Google | — | [S7] |
| 2026-03-05 | GPT-5.4 | OpenAI | — | [S7] |
| 2026-04-07 | Claude Mythos Preview | Anthropic | Gated (Glasswing); 50% horizon 17.4h | [S9][S7] |
| 2026-04-23 | GPT-5.5 ("Spud") | OpenAI | — | [S6] |
| 2026-04-24 | DeepSeek V4 Pro/Flash | DeepSeek | Open (MIT); Ascend-optimized | [S26] |
| 2026-05-28 | Claude Opus 4.8 | Anthropic | — | [S10] |
| 2026-06-09 | Claude Fable 5 / Mythos 5 | Anthropic | First public Mythos-class; $10/$50 | [S9] |
| 2026-06-26 → 07-09 | GPT-5.6 Sol / Terra / Luna | OpenAI | Govt-staggered release | [S50] |
| 2026-07 | Gemini 3.6 Flash, 3.5 Flash-Lite (3.5 Pro stalled); Grok 4.5 | Google / SpaceXAI | Gemini 4 pretraining began Jul 21 | [S6] |
| 2026-07-24 | Claude Opus 5 | Anthropic | 97% SWE-bench Verified (Vals) | [S10][S36] |
| 2026-08 | Qwen3.8-Max | Alibaba | Top Chinese model on AA index | [S26] |
| 2026-09-01 | Claude Fable 5.1 / Mythos 5.1 | Anthropic | — | [S10] |
| 2026-09-03 | GPT-6 Astra | OpenAI | "Critical" cyber; gated first | [S11] |
| 2026-09-21 | Grok 4.7 | SpaceXAI | Grok 5 still training | [S50] |
| 2026-09-22 | Claude Opus 5.5 | Anthropic | ~40% cheaper | [S10][S18] |
| 2026-10-07 | Claude Haiku 5.5 | Anthropic | System card: 1.7x R&D acceleration | [S6][S5] |
| 2026-10-12 | Meta Muse Wonder | Meta | First Meta frontier model | [S6] |
| 2026-10-13 | Gemini 4 Argon | Google | Paid users | [S6][S12] |
| 2026-10-17 / 23 | DeepSeek V4.1 Flash; Kimi K3.1 Pro | DeepSeek / Moonshot | — | [S26][S6] |
| 2026-10-26 | GPT-6.1 Terra | OpenAI | — | [S6] |
| 2026-10-28 | Gemini 4 Carbon | Google | #1 AA index (59); cyber defenders only | [S12] |
| 2026-10-29 | Mistral Large 4 weights | Mistral | Open weights | [S6] |

(Fable 5.2 / Mythos 5.2 are mentioned by AIFP [S4]; release date not verified.)

### 2.7 AI Futures Project forecast history

| Date | Statement / median | Source |
|---|---|---|
| Apr 2025 | AI 2027 published. Authors' medians were somewhat later than the scenario (Daniel: 2028) | [S1] |
| Aug 2025 | Daniel's median moves from 2028 to 2029 | [S19] |
| Dec 2025 | AI Futures Model: full coding automation ~3–5 years later than the AI27 model | [S19] |
| Feb 12 2026 | Grading: ~65% of AI27 pace. Daniel AC 2029; Eli early 2030s; takeoff mid-2028 to mid-2030 | [S3] |
| Apr 2 2026 | Q1 update: Daniel AC late 2029 → mid-2028 | [S19] |
| Jul 2026 | Pace revised to ~75% | [S3] |
| Aug 16 2026 | Q2.5 update (uplift and revenue): Daniel AC Dec 2027, SAR Dec 2028 | [S4] |
| Nov 10 2026 | Q3.5: Daniel SAR **May 2027**, TED-AI **Sep 2027**. Eli SAR Aug 2027, TED-AI Sep 2028. Romeo P(SAR by end-2027) = 63%. Group P(TED-AI before 2028) = 35–65% | [S4] |

Metaculus "weakly general AI" community median: ~Apr 2028 (snapshot, W); "general AI" ~2032 [S35].

### 2.8 METR Anthropic AI R&D assessment (Nov 5 2026) [S5]

- Engagement: Aug 12–Oct 29 2026. Most of the key evidence was redacted by Anthropic.
- ECI acceleration: **1.9x** since an Oct 7 2025 breakpoint (95% CI 1.5–2.8x; range 1.1–2.9x across link functions). Slope went from about +15 to about +29 ECI points/year.
- Overall capability pace: **~2x** the Mar 2024–Oct 2025 rate (plausible range 1.3–3x). Across all frontier developers: 1.4x.
- Attribution: ~80% to AI (low confidence). Training compute scaling did **not** accelerate.
- Staff Slack-poll uplift: 1.2x (Jan 2025) → 12x (Oct 2026).
- No convincing bottleneck found for the next 12 months. Anthropic cancelled METR's planned compute-allocation verification.

---

## 3. SOURCES

- [S1] AI 2027 scenario, https://ai-2027.com/ (Apr 2025)
- [S2] AI 2027 Compute Forecast, https://ai-2027.com/supplements/compute-forecast
- [S3] AI Futures Project, "Grading AI 2027's 2025 Predictions" (Feb 12 2026; Jul 2026 update), https://blog.aifutures.org/p/grading-ai-2027s-2025-predictions
- [S4] AI Futures Project, "Q3.5 Timelines Update: Looks Like the Intelligence Explosion Will Happen in 2027 After All" (Nov 10 2026), https://blog.aifutures.org/p/q35-timelines-update-looks-like-the ; archive https://blog.aifutures.org/archive
- [S5] METR, Anthropic AI R&D acceleration assessment (Nov 5 2026), https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment
- [S6] Release roundups (W): https://local-ai-zone.github.io/blog/October_2026_AI_Model_Updates.html ; https://techcrunch.com/2026/10/12/meta-releases-its-first-frontier-model-muse-wonder/ ; https://openai.com/index/introducing-gpt-5-5/ ; https://9to5google.com/2026/09/24/google-says-gemini-4-release-is-coming-as-soon-as-possible/
- [S7] METR time horizons page and data: https://metr.org/time-horizons/ ; https://metr.org/assets/benchmark_results_1_1.yaml
- [S8] METR, Time Horizon 1.1 (Jan 29 2026), https://metr.org/blog/2026-01-29-time-horizon-1-1/
- [S9] Mythos / Fable 5: https://axios.com/2026/06/09/anthropic-mythos-class-safeguards ; https://fortune.com/2026/06/09/anthropic-releases-its-first-mythos-model-to-the-public/ ; Glasswing: https://cyberhoot.com/blog/claude-mythos-opened-pandoras-box-project-glasswing-is-racing-to-close-it/
- [S10] Claude releases: https://www.axios.com/2026/07/24/anthropic-releases-new-model-opus-5 ; https://sdtimes.com/claude-fable-5-1/61089/ ; https://9to5mac.com/2026/05/28/anthropic-upgrades-claude-with-new-opus-4-8-model-heres-whats-new/ ; https://thurrott.com/a-i/anthropic/341913/anthropic-releases-claude-opus-5-5
- [S11] GPT-6 Astra: https://9to5google.com/2026/09/03/openai-gpt-6-astra-launch/ ; https://techrepublic.com/article/news-openai-gpt-6-astra-agi-era-2026
- [S12] Google, "Gemini 4 Carbon" (Oct 28 2026), https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/
- [S13] OpenAI revenue: https://axios.com/2026/09/29/scoop-openais-annual-recurring-revenue-nears-70b ; https://news.bgov.com/artificial-intelligence/openais-annualized-revenue-nears-50-billion-ft-says ; https://finance.yahoo.com/news/openai-cfo-says-annualized-revenue-173519097.html ; https://www.digitimes.com/news/a20250610PD229.html ; https://investinglive.com/stocks/openai-s-annualized-revenue-run-rate-has-surpassed-40-billion-says-a-bloomberg-report/
- [S14] Anthropic funding and revenue: https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation ; https://www.anthropic.com/news/series-h ; https://axios.com/2026/02/12/anthropic-raises-30b-at-380b-valuation ; https://www.bloomberg.com/news/articles/2026-01-21/anthropic-s-revenue-run-rate-tops-9-billion-as-vcs-pile-in ; https://builtin.com/articles/anthropic-raises-13b-series-f-183b-valuation-20250902
- [S15] OpenAI valuation and IPO: https://dealroom.co/news/144253-openai-closes-7b-share-sale-at-852b-valuation-ahead-of-ipo/ ; https://vktr.com/ai-news/openai-files-confidential-ipo-at-852b-valuation/
- [S16] Anthropic S-1: https://www.stlpr.org/npr/2026-10-26/ai-giant-anthropic-files-for-an-ipo-that-could-break-records ; https://ppc.land/anthropic-files-for-nasdaq-ipo-with-16-3bn-in-first-half-revenue/
- [S17] SpaceX/xAI: https://fortune.com/2026/02/02/elon-musk-spacex-xai-ipo-trillion ; https://axios.com/2026/06/12/spacex-shares-rocket-first-trades
- [S18] METR, Claude Opus 5.5 evaluation (Sep 22 2026), https://metr.org/blog/2026-09-22-claude-opus-5-5/
- [S19] AIFP timeline history (secondary): https://futuresearch.ai/blog/ai-2027-6-months-later ; https://www.longtermwiki.com/wiki/E511 ; AIFP "Clarifying how our AI timelines forecasts have changed since AI 2027" (Jan 27 2026), listed in the archive at [S4]
- [S20] EO 14409 / CAISI: https://skadden.com/insights/publications/2026/06/new-ai-executive-order ; https://www.kslaw.com/insights/articles/white-house-issues-executive-order-on-ai-innovation-and-security
- [S21] Pentagon v. Anthropic: https://www.cp24.com/news/world/2026/08/28/judge-rules-the-pentagons-supply-chain-risk-label-for-anthropic-unlawful/ ; https://www.clickorlando.com/business/2026/09/25/federal-court-says-us-government-can-label-anthropic-a-supply-chain-risk/
- [S22] Preemption EO and federal posture: https://www.jenner.com/en/news-insights/client-alerts/new-ai-executive-order-key-takeaways-for-companies-developing-advanced-ai-models ; https://www.dwt.com/blogs/privacy--security-law-blog/2026/06/trump-ai-innovation-and-security-executive-order
- [S23] OpenAI RL pause: https://www.helpnetsecurity.com/2026/08/19/openai-model-safety-updates/ ; https://www.constellationr.com/insights/news/openai-well-hit-pause-model-reinforcement-learning-safety
- [S24] OpenAI–Hugging Face incident: https://aljazeera.com/news/2026/7/22/unprecedented-openai-says-ai-models-autonomously-hacked-another-company ; https://blog.elcomsoft.com/2026/07/an-ai-agent-broke-into-hugging-face-five-days-later-openai-said-it-was-theirs/
- [S25] Anthropic, "Detecting and preventing distillation attacks" (Feb 23 2026), https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks
- [S26] China gap / models: https://ai2027-tracker.com/guides/ai-2027-vs-reality/ (updated 2026-11-09, W) ; https://thenextweb.com/news/deepseek-v4-pro-flash-launch-open-source ; https://chinaaidispatch.substack.com/p/conceded
- [S27] China chips / policy: https://www.tomshardware.com/tech-industry/huawei-expects-12-billion-in-ai-chip-revenue-this-year-as-nvidias-china-market-share-hits-zero ; https://www.striderintel.com/blog/the-prcs-15th-five-year-plan-inside-the-ai-agenda/ ; https://ai2027-tracker.com/predictions/china-centralization/
- [S28] CFR, China's AI chip deficit: https://www.cfr.org/article/chinas-ai-chip-deficit-why-huawei-cant-catch-nvidia-and-us-export-controls-should-remain
- [S29] Nvidia market cap: https://www.trefis.com/data/companies/NVDA ; https://www.fool.com/investing/2025/11/03/nvidia-is-now-the-markets-first-5-trillion-stock-h
- [S30] Nov 5 2026 selloff: https://www.wowt.com/2026/11/05/brutal-sell-off-ai-stocks-sends-wall-street-reeling-sp-500-sees-worst-day-since-2025-liberation-day-tariffs/ ; https://tribune.com.pk/story/2639009/investors-wipe-25t-off-nasdaq-as-blue-tsunami-prompts-ai-fears
- [S31] S&P 500 YTD: https://www.advisorperspectives.com/dshort/updates/2026/10/30/s-p-500-snapshot-stocks-edge-lower-for-3rd-straight-week ; https://www.mitrade.com/insights/news/live-news/article-8-2220833-20261101
- [S32] Labor: https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf ; https://aiweekly.co/alerts/stanford-siepr-ai-hits-new-grads-not-aggregate-jobs-yet ; https://leaddev.com/hiring/young-devs-steepest-losses-exposed-roles-stanford-study-finds
- [S33] Protests: https://www.thestar.com.my/tech/tech-news/2026/07/18/us-data-center-protests-go-national-as-backlash-grows- ; https://axios.com/2026/06/18/conservatives-protest-ai-data-centers ; https://ai2027-tracker.com/predictions/anti-ai-protest/
- [S34] Polls: https://thenextweb.com/news/pew-research-americans-ai-chatbot-skepticism-regulation-distrust-2026 ; https://www.semafor.com/article/07/29/2026/americans-see-ai-more-negatively-poll-finds ; https://globalaffairs.org/research/public-opinion-survey/americans-say-ai-benefits-are-not-worth-risks
- [S35] Metaculus summaries (W): https://80000hours.org/agi/guide/when ; https://www.metaculus.com/ (check the live value)
- [S36] SWE-bench Verified: https://www.vals.ai/benchmarks/swebench ; https://benchlm.ai/benchmarks/swe-bench-verified
- [S37] "METR Time Horizons: Now 10x/Year" (Feb 13 2026), https://www.lesswrong.com/posts/EYb2K9acKfyG2bome/metr-time-horizons-now-10x-year
- [S38] Epoch largest training runs: https://epoch.ai/data/ai-models ; https://ai2027-tracker.com/predictions/training-compute/
- [S39] Epoch Frontier Data Centers hub (updated Nov 6 2026), https://epoch.ai/data/ai-data-centers
- [S40] Epoch AI Chip Users (updated Sep 9 2026), https://epoch.ai/data/ai-chip-users ; CSV https://epoch.ai/data/ai_chip_users_year_end_by_lab.csv
- [S41] "Global AI compute hits 15 million H100 equivalents" (Jan 9 2026), https://the-decoder.com/global-ai-compute-hits-15-million-h100-equivalents-epoch-ai-finds/
- [S42] Epoch, chip production / capacity additions: https://epoch.ai/data-insights/ai-chip-production ; https://epoch.ai/data-insights/ai-computing-capacity-additions-doubling
- [S43] Hyperscaler capex: https://247wallst.com/investing/2026/05/01/hyperscalers-hit-700-billion-in-2026-ai-spending-plans/ ; https://finance.yahoo.com/markets/article/magnificent-7-earnings-rush-reveals-ai-spending-surge-with-hyperscaler-capex-set-to-reach-725-billion-in-2026-224901707.html
- [S44] Capex tracker (W): https://walnutinvest.com/stats/ai-capex-statistics
- [S45] Anthropic, AI-orchestrated espionage disclosure (Nov 2025), https://www.anthropic.com/news/disrupting-AI-espionage ; Khanna letters via https://ai2027-tracker.com/predictions/model-theft/
- [S46] Nvidia Q2 FY27: https://futurumgroup.com/insights/nvidia-q2-fy-2027-ai-infrastructure-demand-extends-into-fy-2028/ ; https://www.nasdaq.com/articles/nvidia-q2-earnings-beat-blackwell-ultra-data-center-strength
- [S47] AI and GDP: https://think.ing.com/opinions/how-much-is-ai-contributing-to-us-economic-growth/ ; https://cryptobriefing.com/ai-spending-adds-0-9-points-us-gdp/
- [S48] ChatGPT users: https://www.roic.ai/news/openais-chatgpt-surpasses-900-million-weekly-users-50-million-paying-subscribers-02-27-2026 ; https://fourweekmba.com/ai-chatgpt-one-billion-weekly-users-openai-distribution-endpoin/
- [S49] Headcount (W): https://ground.news/article/openai-to-nearly-double-workforce-to-8-000-by-end-2026-ft-reports ; https://makerstations.io/openai-employee-statistics
- [S50] GPT-5.6 Sol and Grok: https://the-decoder.com/openais-gpt-5-6-launches-thursday-after-a-delay-forced-by-the-u-s-government/ ; https://qz.com/openai-gpt-56-sol-us-government-approval-launch-070926 ; https://news.bgov.com/artificial-intelligence/spacexai-cursor-unveil-grok-ai-model-for-coding-finance-tasks
- [S51] Anthropic–Google TPU deal: https://www.datacenterdynamics.com/en/news/google-and-anthropic-confirm-massive-1gw-cloud-deal-with-up-to-one-million-google-tpus/
- [S52] Epoch, hyperscalers control most compute: https://epoch.ai/data-insights/hyperscalers-control-most-compute
- [S53] Stargate status: https://epoch.ai/blog/openai-stargate-where-the-us-sites-stand ; https://www.tomshardware.com/tech-industry/oracle-rebuts-incorrect-reporting-on-stargate-expansion

"Widely reported (verify)" items in 1.4 (DOD $200M contracts, AI Action Plan, Kimi K2 date) come from my background knowledge and still need a citation before shipping.
