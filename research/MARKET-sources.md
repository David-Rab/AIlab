# MARKET — sources for the market / pricing redesign

Source pass for the market model: 14 sectors × 3 regions, three buyer groups (small firms & developers → API,
large firms → Enterprise, vetted buyers → Vetted), multinomial-logit Nash–Bertrand prices
p = c + μ/(1 − S), and capacity-clearing prices. This file sources the model and does not redesign it.

Tags: **[P]** primary for the quantity; **[P-analogue]** primary for a related quantity; **[D]** designer stand-in;
**[U]** found only in press or secondary write-ups, primary not read (do not cite as primary). "(V)" = checked against
the official page this session; "(nc)" = date/URL not checked this session. Confidence is flagged as low where it is.

Reused and re-checked from earlier files: research/20-model-v3-calibration.md D3 (DeepSeek margin),
research/22-demand-anchors.md §4–5 (Anthropic S-1/FWP revenue and compute, Menlo, Ramp),
research/CAL-products-sources.md C1–C2 (FedRAMP timing and cost).

---

## 1. Firm-size split by sector

The shares were computed this session from the official files: Census SUSB 2022 xlsx and the Eurostat sbs_sc_ovw
SDMX extract.
- **US:** share of private employment in firms with **500+** employees = 1 − ("<500" row ÷ "Total" row). This is
  enterprise size, so a large firm's establishment counts as large even inside a small-firm industry.
- **EU:** share in firms with **250+** employees. The cutoffs differ, so the US and EU columns are not directly
  comparable.

| Game sector | NAICS mapping (US) | US share in 500+ firms (2022) | EU share in 250+ firms, NACE (2022) | Tag |
|---|---|---|---|---|
| SOFT | 5112 software publishers 74.2%; 5182 data processing 65.7%; 5415 computer systems design 51.8% | **59.5%** blend (3.57M jobs) | J62 39.2%, J63 33.1% | [P] |
| OFFICE | 56 Admin & support 71.3%, of which 5613 employment services 87.5% (59% of 56's jobs); 5611 + 5614 = 58.4% | **54%** recommended: the all-industries share, since clerical work sits in every industry. 56 alone: 71.3% | N 52.8%; N82 34.1% | [P-analogue] |
| FIN | 52 = 72.5% (5241 insurance carriers 93.6%, 5221 banks 72.7%, 5231 securities 84.1%); 5412 accounting 47.6% | **68.7%** blend of 52 and 5412 | K65 insurance 88.4% | [P] |
| LEGAL | 5411 legal services | **19.2%** (31.9% of payroll); in-house legal staff not captured | M69 legal + accounting 13.7% | [P] |
| MEDIA | 5418 advertising/PR 44.5%; 512 film; 515 broadcasting; 71 arts 36.3% | **42.9%** blend | J59 19.2%, J60 67.3%, M73 18.6%, R90 3.8% | [P] |
| SCI | 5417 scientific R&D 69.9%; 5413 architecture/engineering 45.7% | **54.5%** blend | M72 39.2%, M71 21.2% | [P] |
| HEALTH | 62 (6221 general hospitals 95.8%, 6211 physician offices 48.1%) | **56.3%** (private only) | Q86 39.9% (market units only) | [P] |
| EDU | 61 private only (6113 colleges 91.3%, 6111 private K-12 15.8%) | **52.7%** of private education | P85 18.1% (market part only) | [P] |
| GOV | Not in SUSB (government excluded) | n/a, all public | n/a | — |
| MIL | 3364 aerospace as the proxy (3345 instruments 75.0%) | **~89%** | not extracted | [P-analogue] |
| MFG | 31–33 | **59.1%** (65.2% of payroll) | C 48.3% | [P] |
| LOG | 48–49 (4811 scheduled air 97.5%, 4931 warehousing 88.1%, 4841 trucking 53.4%) | **66.8%** | H 45.9% | [P] |
| ENGY | 22 utilities 81.2%; 23 construction 19.3%; 21 mining 52.6% | **26.0%** blend (construction is 86% of the jobs) | D35 70.6%, F 12.5%, B 57.4% | [P] |
| SERV | 44–45 retail 65.8%; 72 accommodation & food 37.2%; 81 other services 15.0% | **46.7%** blend | G47 38.7%, I 14.7%, S96 4.9% | [P] |
| All industries | — | **54.1%** (61.3% of payroll; 30.6% in firms with 10,000+) | **37.4%** (EU business economy) | [P] |

**Other regions:**
- **China:** SMEs held "23300.4万人…占全部企业就业人员的比重为79.4%" (end 2018), so large enterprises hold about
  **20.6%** [P]. No per-sector split. China defines size by industry-specific thresholds, so this is not directly
  comparable.
- **Rest of world:** use the EU's 37.4% [P-analogue].

**AI adoption by firm size, US** (Census BTOS, Dec 2025–May 2026) [P] (research/22 §1):
- 250+ employees: 37% use AI.
- 100–249 employees: 32%.
- All firms: 17–20%.

**Sources:**
- Census SUSB 2022, "The Number of Firms and Establishments, Employment, Annual Payroll, and Receipts by Industry and
  Enterprise Employment Size: 2022" (released 10 Apr 2025).
  - https://www2.census.gov/programs-surveys/susb/tables/2022/us_naicssector_large_emplsize_2022.xlsx
  - https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_naics_detailedsizes_2022.xlsx
  - All-industries row: Total 135,748,407; <500 employees 62,250,556.
- Eurostat sbs_sc_ovw (EMP_NR, GE250 ÷ TOTAL, EU27_2020, 2022).
  - Business economy 160,603,286 employed, of which 60,000,000 in 250+ firms. Some cells are Eurostat estimates.
  - News release: "more than a third of the business labour force (37%)",
    https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20241025-1
- NBS China, Fourth Economic Census report no. 12, 17 Dec 2019,
  https://www.stats.gov.cn/xxgk/sjfb/zxfb2020/201912/t20191217_1767576.html

**Game mapping.**
- Large-firm share = the Enterprise buyer group. The rest = the API buyer group.
- US: use the column above. ROW: scale by 37.4 / 54.1 ≈ 0.69, or use the EU column where it exists [D]. China: scale by
  20.6 / 54.1 ≈ 0.38 [D].
- Legal (19%) and construction (19%) are mostly small-firm API markets. Finance, transport, defence and utilities are
  mostly Enterprise markets.
- SUSB is by industry, not occupation, so OFFICE and LEGAL are approximations.

## 2. Vetted buyers

No official estimate exists of the share of employment that counts as critical infrastructure.
- CISA lists 16 sectors with no workforce shares.
- Its Essential Critical Infrastructure Workforce guidance (v4.1) lists worker categories without percentages.

Most shares below are therefore [D] built on primary anchors.

**Anchors:**

| # | Value | Unit | Source | Tag |
|---|---|---|---|---|
| 2a | Government 23,332k jobs (federal 2,677k, state 5,479k, local 15,176k). Government excluding education and USPS: 11.9M = 7.5% of 159.3M nonfarm | jobs, Oct 2026 (preliminary, seasonally adjusted) | BLS CES Table B-1, https://www.bls.gov/news.release/empsit.t17.htm | [P] (re-check before final use) |
| 2b | 72.7% of education employment is public: government education 10,820k vs private educational services 4,053k | share | same | [P] |
| 2c | 21.9% of hospital jobs are government (federal 384,845; state 445,047; local 698,159; private 5,454,513). 95.8% of private general-hospital jobs are in 500+ firms | share | BLS QCEW 2024, NAICS 622, https://data.bls.gov/cew/data/api/2024/a/industry/622.csv ; SUSB | [P] |
| 2d | 20.3M state and local government employees, Mar 2025 | jobs | Census ASPEP Summary 2025, https://www.census.gov/content/dam/Census/library/publications/2025/econ/ASPEP%20Summary%20Report%202025.pdf | [P] |
| 2e | Active duty 1,267,738; Selected Reserve 754,403 (2024). DoD civilians 816,223 on board (FY2021) | people | Military OneSource 2024 Demographics, https://download.militaryonesource.mil/12038/MOS/Infographic/2024-demographics-total-dod-military-community.pdf ; CRS IF11510 Table 1 | [P] |
| 2f | Defence industrial base: "nearly 60,000 companies employing approximately 1.1 million individuals" | jobs, ~FY2020 | CRS IF10548, citing the DoD FY2020 Industrial Capabilities Report (the DoD file returned 403) | [P-analogue], low confidence, dated |
| 2g | 16 CISA sectors: Chemical; Commercial Facilities; Communications; Critical Manufacturing; Dams; DIB; Emergency Services; Energy; Financial Services; Food & Agriculture; Government Services & Facilities; Healthcare & Public Health; IT; Nuclear; Transportation Systems; Water | list | https://www.cisa.gov/topics/critical-infrastructure-security-and-resilience/critical-infrastructure-sectors | [P] |
| 2h | <2% of Anthropic revenue is from government | share | S-1/FWP, research/22 §4 | [P] |
| 2i | ≈8 months to FedRAMP 20x Moderate (OpenAI, Aug 2025 → 27 Apr 2026). Authorization cost $0.3–3.7M per provider. IL4/5 = FedRAMP High plus extra controls; Claude has it only via Bedrock GovCloud (May 2025) | time, cost | research/CAL-products-sources.md C1–C2 (GAO-24-106591 pp. 15–16) | [P] |
| 2j | Claude Gov 6 Jun 2025; OpenAI for Government 16 Jun 2025 (CDAO pilot ceiling $200M) | launch | https://www.anthropic.com/news/claude-gov-models-for-u-s-national-security-customers (V); https://openai.com/global-affairs/introducing-openai-for-government/ (V) | [P] |

**Proposed vetted share by sector (US):**

| Sector | Vetted share | Basis | Tag |
|---|---|---|---|
| SOFT | 0.15 | IT and Communications are CISA sectors. No figure for government IT buyers | [D] |
| OFFICE | 0.20 | Government excluding education is 7.5% of jobs (2a), plus clerical work in large regulated finance and health firms | [D] on [P] |
| FIN | 0.70 | 72.5% of finance jobs are in 500+ firms and all of finance is regulated. Financial Services is a CISA sector | [P-analogue] |
| LEGAL | 0.25 | 19.2% in 500+ firms, plus government legal and judicial staff (no split found) | [D] |
| MEDIA | 0.05 | No basis | [D] |
| SCI | 0.35 | 5417 R&D is 69.9% large (a mix of pharma and defence). No federal-lab share found | [D] |
| HEALTH | 0.55 | Hospitals are 31% of health-care jobs; government holds 22% of hospital jobs and private hospitals are 96% large. 62 overall is 56.3% large. Healthcare & Public Health is a CISA sector | [P-analogue] |
| EDU | 0.70 | 72.7% of education employment is public (2b) | [P] |
| GOV | 1.00 | By definition | [P] |
| MIL | 1.00 | Military, DoD civilians and the DIB (2e, 2f) | [P] |
| MFG | 0.20 | DIB ≈ 1.1M of 12.2M manufacturing jobs ≈ 9%, plus regulated pharma and chemicals. Critical Manufacturing, Chemical and Nuclear are CISA sectors | [D] on [P-analogue] |
| LOG | 0.40 | Transportation Systems is a CISA sector. 66.8% large; scheduled air is 97.5% large and FAA/TSA-regulated | [D] |
| ENGY | 0.15 | Utilities (~8% of the blend's jobs, 81% large, CISA) are fully vetted. Construction (86% of the blend) mostly is not | [D] on [P] |
| SERV | 0.03 | No basis | [D] |

**ROW and China:**
- Apply the same per-sector logic, scaling the large-firm-based parts by the large-firm ratio: ≈0.69 for ROW, ≈0.38 for
  China [D].
- China's public and state-owned share would raise its vetted shares, but no figure was found [D].

**Game mapping.**
- GOV and MIL are entirely vetted. EDU, FIN and HEALTH are mostly vetted.
- Getting access takes 3–24 months and about $4M (2i), gated by FedRAMP/IL. This matches the existing cert mechanic.
- Government was <2% of a leading lab's revenue in 2026 (2h). The vetted market is large on paper but slow to open.

---

## 3. Gross margins, price sensitivity, market shares

| # | Value | Unit | Basis | Source | Tag |
|---|---|---|---|---|---|
| 3a | 84.5 | % gross margin, theoretical | "If all tokens were billed at DeepSeek-R1's pricing, the total daily revenue would be $562,027, with a cost profit margin of 545%"; cost "$87,072" at "$2 per hour" per H800. 545% markup on cost → 1 − 1/6.45 = 84.5% margin | DeepSeek, "Day 6: One More Thing, DeepSeek-V3/R1 Inference System Overview", 1 Mar 2025, https://github.com/deepseek-ai/open-infra-index/blob/main/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md (re-fetched) | [P] (margin is [D from P]) |
| 3b | "substantially lower" | actual vs theoretical | Same post: V3 is priced far below R1; only part of the service is monetised (web and app are free); "Nighttime discounts are automatically applied during off-peak hours" | same | [P] |
| 3c | 57 | % of revenue | Anthropic 9M 2026: "Compute and infrastructure" $18,808M (an operating-expense line covering serving **and** training) vs revenue $33,242M. FY2025: $7,326M vs $4,585M (160%). No cost-of-revenue line in this document. Gives a floor: serving gross margin ≥ 43% in 9M 2026 | Anthropic, PBC, free-writing prospectus (Japanese offering), 12 Nov 2026, Section 2 "Company Overview", 1 "Trends in Key Financial Indicators", https://www.sec.gov/Archives/edgar/data/2130357/000162828026073045/anthropicpbc-fwpjapanamend.htm | [P] |
| 3d | 85.5 (9M 2026); ≈85 (H1 2026) vs ≈12–29 a year earlier | % gross margin | Secondary readings of the S-1/A cost-of-revenue line: $4,812M cost of revenue on $33,242M revenue (9M 2026); "$2.4B on $16.3B" (H1 2026). Reported S-1 wording: "substantially all of cost of revenue consists of compute and infrastructure costs associated with customer-serving workloads". The year-earlier figure differs between write-ups (12% vs 29.4%) | S-1 https://www.sec.gov/Archives/edgar/data/0002130357/000162828026067168/anthropicpbc-sx1.htm (14 MB, over the fetch limit; not read). Located via fourweekmba.com and webull.com write-ups | [U] — verify in the S-1/A before use |
| 3e | 12 | % adjusted operating margin, 9M 2026 | "9M 2026 adjusted operating income $4.1B" | research/22 §4 (S-1/FWP) | [P] |
| 3f | "just above one" | short-run price elasticity of LLM API demand | "preliminary short-run price elasticities just above one, suggesting limited scope for Jevons-Paradox effects" — OpenRouter + Microsoft Azure API data | Demirer, Fradkin, Tadelis & Peng, "The Emerging Market for Intelligence: Pricing, Supply, and Demand for LLMs", NBER WP 34608, Dec 2025, https://www.nber.org/papers/w34608 (abstract) | [P], abstract only |
| 3f′ | −1.11 (s.e. 0.22), preferred; −1.08 (0.19); −0.55 (0.09) | own-price elasticity of **one open-source model sold by one inference provider** (log daily tokens on log prompt price per M tokens), short run (daily) | Table 2, p. 37: OpenRouter, provider-model-day, N = 32,539, **open-source models only** ("since these exhibit within-model price variation", p. 35). Col. (1) date FE: −0.55 (0.09), "biased" by model quality. Col. (2) + model FE: −1.08 (0.19). Col. (3) + date×model and model×provider FE: −1.11 (0.22), "Identification now derives solely from variation within day and model" (p. 37); price variation from provider entry/exit and price changes by hosts of the same model (p. 35). Controls: log throughput, latency, context length. S.e. clustered by provider. Without the performance controls (Table OA-5, p. OA-5, N = 48,362): −0.48 (0.15), −1.07 (0.23), −1.02 (0.13). Caveat, fn. 19 p. 37: "some of the observed price sensitivity may reflect routing decisions made by OpenRouter rather than direct user choices". **No Azure elasticity, no cross-price elasticity, no closed-model or firm-level elasticity** in the paper | Demirer, Fradkin, Tadelis & Peng, long version dated 12 Dec 2025 (= NBER w34608), §7 pp. 34–38, https://andreyfradkin.com/assets/LLM_Demand_12_12_2025.pdf | [P] |
| 3f″ | none (direction only) | aggregate / market elasticity | §7.1 p. 35: "Model-provider level elasticities are larger in magnitude than the corresponding aggregate elasticity because they measure substitution across models and providers rather than solely between the outside option and the set of models and providers". p. 38: "Since aggregate demand elasticities are substantially smaller, we interpret our findings as going against the Jevons paradox in the short-run. This, however, does not preclude […] Jevons effects operating on longer-run horizons"; "year-over-year price declines result in substantially more LLM usage". No aggregate estimate is reported | same, pp. 35, 38 | [P] |
| 3f‴ | qualitative | substitution between models / labs at entry | Interrupted time series around launches, §8 pp. 38–44. OpenRouter: Claude 3.7 Sonnet's uptake is matched "nearly one-for-one" by Claude 3.5 Sonnet's decline with "minimal impact on other major models, such as GPT-4o and Gemini 2.0 Flash" (p. 40, Fig. 23); same for Claude 4 Sonnet (Fig. OA-16). Gemini 2.0 Flash, 2.5 Flash and Grok Code Fast 1 gain share with no visible decline in others: market expansion (pp. 41–42). Azure: after GPT-4o, "an immediate and steep decline in the share of customers using other popular models" (p. 42, Fig. 26a); after DeepSeek R1, no change in the top three Azure models (pp. 42–43). Multi-homing firms "spend nearly all of their consumption on a single model" (p. 34, Fig. 20). The JEP version (*JEP* 40(3), 2026, 23–46; preprint https://andreyfradkin.com/assets/jep_llm_preprint.pdf, full text searched) reports no elasticity | same | [P] (case studies, not causal estimates) |
| 3g | 0.05–0.07 | aggregate usage response (10% price cut → 0.5–0.7% more usage) | "a 10% decrease in price corresponds to only about a 0.5–0.7% increase in usage"; "demand is relatively price-inelastic". A near-flat cross-model log–log trend line, not a causal estimate | Aubakirova, Atallah, Clark, Summerville & Midha, "State of AI: An Empirical 100 Trillion Token Study with OpenRouter", arXiv 2601.10088, Jan 2026, §8.2, Fig. 27 | [P-analogue], low confidence (cross-section, not elasticity) |
| 3h | −0.78 | average own-price elasticity, nested logit | OpenRouter; "sensitive to the outside-good calibration" | Lisk, Glucksman thesis, NYU Stern, 2026, https://www.stern.nyu.edu/sites/default/files/2026-06/Glucksman_DavidLisk.pdf (password-protected PDF; figure from search excerpt) | [U], low confidence |
| 3i | Anthropic 32, OpenAI 25, Google 20, Meta 9, DeepSeek 1 | % of enterprise production LLM API **usage** (not spend), mid-2025 | Survey of 150 technical decision-makers, 30 Jun–10 Jul 2025, enterprises 5,000+ employees and startups ≥$5M raised, weighted by application scale. "LLM market share reflects the proportion of production AI usage, not spend." Open source 13% of workloads. Coding: Claude 42%, OpenAI 21% | Menlo Ventures, "2025 Mid-Year LLM Market Update", 31 Jul 2025, https://menlovc.com/perspective/2025-mid-year-llm-market-update/ | [P-analogue] (published survey by an Anthropic investor) |
| 3j | $8.4B (mid-2025) vs $3.5B (Nov 2024) | model API spend, annual | same survey | same | [P-analogue] |
| 3k | 66 / 23 / 11 | % of builders: upgraded within provider / no change / switched vendor | "Performance drives decisions"; buyers keep paying for the frontier model while prices fall ~10× a year | same | [P-analogue] |
| 3l | Anthropic 40, OpenAI 27, Google 21 | % enterprise LLM API share, end-2025 | Menlo, Dec 2025 | research/22 §5 | [P-analogue] |
| 3m | Anthropic 44.8 / OpenAI 40.6 (firms paying); 58.7 / 37.2 (token spend, week to 15 Nov 2026) | % | Ramp AI Index, card and bill-pay data, >85,000 US firms | research/22 §5 | [P] (for US card/bill spend) |
| 3n | Chinese open-weight ≈13 (peaks ≈30); open-weight ≈⅓ by late 2025; Anthropic >60 of programming tokens most of the year | % of OpenRouter tokens, Nov 2024–Nov 2025 | OpenRouter study §3, Fig. 20 | arXiv 2601.10088 | [P-analogue] (OpenRouter is developer-heavy) |
| 3o | ~90% | open-weight price discount vs closed at the same intelligence | "open-source models being 90% cheaper than comparable closed-source models" | NBER w34608 abstract | [P] |

**Backing out μ.** With p = c + μ/(1 − S), the margin is m = (p − c)/p = μ / ((1 − S)·p), so μ = m·(1 − S)·p.
In logit, μ = 1/α (α the price coefficient) and the firm-level elasticity is −α·p·(1 − S), so m = 1/|ε_firm|.
- Leader, mid-2025: S ≈ 0.32 (3i), so (1 − S) = 0.68.
- m = 0.6 (current code) gives μ ≈ 0.41·p, and |ε_firm| ≈ 1.7.
- m = 0.85 (3a, 3d) gives μ ≈ 0.58·p, and |ε_firm| ≈ 1.18.
- **What Demirer et al. measure (3f′, [P]).** The elasticity is for one model on one host, identified from price gaps
  between hosts of the **same** open-source model on OpenRouter, partly through OpenRouter's price-aware router. That is
  neither the game's |ε_firm| (a lab's own price, rivals fixed, other labs' models as substitutes) nor a market
  elasticity (total AI hours vs the price level). The paper estimates neither of those.
- **How it relates to |ε_firm| [D].** Hosts of one model are near-perfect substitutes. In a nested logit (nest = model,
  nesting parameter σ ∈ [0, 1)) a host's elasticity is αp·(1 − σ·s_j|g − (1 − σ)·s_j)/(1 − σ), which is ≥ αp·(1 − s_j)
  ≈ αp for any within-nest share s_j|g ≤ 1; a lab's firm elasticity is αp·(1 − S) ≤ αp. So, **if αp is comparable**
  (true when μ scales with price, as "μ as a multiple of price" assumes, i.e. utility in log price as in the code's
  price^−1 share weight; with a single absolute μ a frontier lab priced 5–15× an open host would be far more elastic),
  1.11 is an **upper bound** on |ε_firm| and the implied firm margin is a **lower bound** [D]: preferred −1.11 (Table 2
  col. 3) gives m ≥ 0.90, μ ≥ 0.90 × 0.68 ≈ 0.61·p; col. 2 (−1.08) gives m ≥ 0.93, μ ≥ 0.63·p. With one s.e. (0.22) the
  point estimate spans 0.89–1.33, i.e. m ≥ 0.75 and μ ≥ 0.51·p at the elastic end; the inelastic end (< 1) implies no
  finite Bertrand–Nash margin. Plain logit (σ = 0) with |ε_firm| = 1.11 gives the same numbers as equalities.
- **Substitution supports a low |ε_firm| (3f‴, [P], qualitative).** Claude launches cannibalised the previous Claude
  "nearly one-for-one" with "minimal impact" on GPT-4o or Gemini; firms put nearly all use on one model. In game terms:
  labs are strongly differentiated (high σ if nests are labs, or large μ in plain logit), so a lab's price cut wins few
  rivals' customers. The exception (GPT-4o on Azure pulling users off other models) is a new **better** model, a quality
  shift, not a price response.
- **Consistency.** Margin evidence (3a, 3c, 3d) gives μ ≈ 0.41–0.58·p (m 0.6–0.85). The paper's preferred number gives
  μ ≳ 0.61·p (m ≳ 0.90): just above the top of that range. It agrees with the unverified 85% (3d) and DeepSeek's
  theoretical 84.5% (3a) and does **not** support m = 0.6 — but within one s.e. it reaches m ≈ 0.75 (μ ≈ 0.51·p). Two
  reasons it may overstate the margin: it is short-run (daily; the authors expect larger long-run responses, p. 38), and
  |ε| near 1 sits at the edge of optimal pricing (|ε| ≤ 1 means raising price always pays), so it is a weak bound, not a
  margin estimate. One reason it may understate it: router-driven switching between identical hosts (fn. 19) is more
  price-sensitive than a buyer switching labs. The Lisk thesis (3h, [U]) gives |ε| ≈ 0.78, which no Bertrand–Nash
  margin can match.
- **μ for the game [D].** μ ≈ 0.55–0.6·p (m ≈ 0.8–0.9 at S = 0.32) is where the margins (3a, 3d) and the elasticity
  bound (3f′) overlap. μ ≈ 0.41·p (m = 0.6) is consistent with 3c's floor but not with 3f′.
- **Market elasticity.** The paper gives a direction only, no number: aggregate elasticities are "substantially smaller"
  than ≈ 1.1 in the short run, and long-run Jevons effects are not ruled out (3f″, [P], pp. 35, 38). 3g (0.05–0.07,
  cross-section) and 3k point the same way. These do not conflict with logit with an outside good.
- **Code note.** `PRICE_ELASTICITY = 1` in src/data/v2/serving.ts is the price exponent in the share logit (a seller's
  weight ∝ price^−1), i.e. a within-market substitution parameter, not a market elasticity. 3f′ (−1.11 between hosts of
  one model) is the closest evidence and is of the same order, but it is an upper bound for substitution between labs
  [D]. Nothing in the paper sets the sector-level demand response (ECON in sectors.ts) beyond "substantially below 1 in
  the short run".

**Game mapping.**
- Target a leader serving margin of about 0.6–0.85. Use 0.85 only if 3d is verified. Mid-2025 margins were lower (FY2025
  total compute was 160% of revenue, 3c; the year-earlier gross margin in 3d is 12–29%, [U]).
- S should be the firm's share in the buyer's market (business API usage), not of all tokens. Menlo's usage shares (3i)
  are the best mid-2025 basis. OpenRouter shares (3n) over-weight developers and open models.
- Fit μ in units of price per work-hour, not per token.

### 3p. Business AI seat list prices, 2025 (MK-9 seat cap)

List prices per user per month, USD, read 2026-11-24 from the vendors' own pages and announcements. Wayback snapshots of
the 2025 pricing pages could not be fetched, so each row gives a dated official statement valid during 2025.

| Seat | List price | Billing | Source | Tag |
|---|---|---|---|---|
| ChatGPT Team (renamed Business, Aug 2025) | $25 / $30 | annual / monthly | "ChatGPT Team costs $25/month per user when billed annually, or $30/month per user when billed monthly" (10 Jan 2024; 29 Aug 2025 update: renamed, "pricing did not change"), https://openai.com/index/introducing-chatgpt-team/ | [P] |
| ChatGPT Enterprise | not listed | annual | "contact sales", https://chatgpt.com/pricing | [P] (no price) |
| Claude Team | $30 | monthly | "available for $30 per user per month" (1 May 2024), https://claude.com/blog/team-plan-and-ios. Today's page (Nov 2026): standard seat $20 annual / $25 monthly, https://claude.com/pricing | [P] |
| Claude Enterprise | $20 + usage at API rates | annual | "US$20/seat/month, billed annually … Seat price + usage at API rates" (today's page; 2025 terms not read), https://claude.com/pricing | [P] (current, not 2025) |
| Microsoft 365 Copilot | $30 | annual | "$30 per user per month" (18 Jul 2023), https://blogs.microsoft.com/blog/2023/07/18/furthering-our-ai-ambitions-announcing-bing-chat-enterprise-and-microsoft-365-copilot-pricing/; enterprise page $30.00 user/month paid yearly, https://www.microsoft.com/en-us/copilot/pricing/enterprise. Copilot Business $21 from Dec 2025 (SMB, ≤ 300 users), https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/introducing-microsoft-365-copilot-business-empowering-small-and-medium-businesse/4469700 | [P] |
| Gemini Business add-on (Workspace) | $20 | annual | Business Standard + Gemini Business "previously paid $32 per user, per month" vs $12 without Gemini (16 Jan 2025; Gemini then bundled at +$2), https://workspace.google.com/blog/product-announcements/empowering-businesses-with-AI | [P] (difference of two stated prices) |
| GitHub Copilot Business / Enterprise | $19 / $39 | monthly | "$19 USD per granted seat per month", "$39 USD per granted seat per month", https://docs.github.com/en/copilot/get-started/plans | [P] |

**Seat cap for the game [D].** The median of the six priced seats (ChatGPT Team $25 annual, Claude Team $30, M365
Copilot $30, Gemini Business $20, GitHub Copilot Business $19 and Enterprise $39) is **$27.5** per seat-month
(data/v2/serving.ts SEATS.cap). Enterprise contracts are negotiated (no list price) and usage-based add-ons (Claude
Enterprise) are left out. The cap is what firms pay for a seat today, not a value: seat adoption still reads the going
seat price through its cost gate (serving.ts seatTarget).

---

## 4. Capacity pricing

### 4a. Theory

| # | Claim | Source | Tag |
|---|---|---|---|
| 4a1 | Capacity first, then Bertrand price competition: the unique equilibrium is the Cournot outcome. In the price stage, firms whose capacities are at or below their Cournot best responses both charge the market-clearing price P(k₁ + k₂) | Kreps & Scheinkman, "Quantity Precommitment and Bertrand Competition Yield Cournot Outcomes", *Bell Journal of Economics* 14(2):326–337, 1983, https://ideas.repec.org/a/rje/bellje/v14y1983iautumnp326-337.html | [P] (abstract read; the clearing-price step is the paper's standard result, full text not read) |
| 4a2 | The result needs **efficient rationing**. With proportional rationing it fails and equilibria are mixed | Davidson & Deneckere, "Long-run competition in capacity, short-run competition in price, and the Cournot model", *RAND Journal of Economics* 17(3):404–415, 1986 | [P] (from memory; not fetched this session) |
| 4a3 | Peak-load pricing: when capacity binds, the efficient price rises above running cost until demand fits capacity. Peak users pay the capacity cost | Steiner, "Peak Loads and Efficient Pricing", *Quarterly Journal of Economics* 71(4):585–610, 1957; Boiteux 1949 | [P] (from memory; not fetched) |

### 4b. Practice — official docs

| # | Value | Unit | What it shows | Source | Tag |
|---|---|---|---|---|---|
| 4b1 | ×0.5 off-peak (peak 01:00–04:00 and 06:00–10:00 UTC weekdays) | price multiplier | **Time-of-use price**: "Off-peak rates are half of the peak rates" (deepseek-v4-pro $1.98 off-peak vs $3.96 peak per M output tokens) | DeepSeek API docs, Models & Pricing, https://api-docs.deepseek.com/quick_start/pricing (V, Nov 2026) | [P] |
| 4b2 | ≈3 weeks (6–25 Feb 2025) | rationing at fixed price | DeepSeek suspended API top-ups, citing "current server resource constraints"; existing balances stayed usable. Prices unchanged | Official notice quoted by Reuters/Engadget/TechCrunch; notice not read | [U] (press-located) |
| 4b3 | ×0.5 | price, batch vs standard | Batch "reducing costs by 50 percent"; most batches finish in under 1 hour. Delay for a lower price | Anthropic, Batch processing, https://platform.claude.com/docs/en/build-with-claude/batch-processing (V) | [P] |
| 4b4 | Batch rates | flex price | OpenAI flex: "Tokens are priced at Batch API rates"; may return 429 when capacity is short ("You will not be charged"); slower. Being phased out (Nov 2026) | OpenAI, Flex processing, https://developers.openai.com/api/docs/guides/flex-processing (V) | [P] |
| 4b5 | ×2 | price, fast/priority vs standard | OpenAI "Priority processing", renamed Fast mode on 30 Jul 2026, "costs twice the Standard rate" (GPT-5.6 Sol $8/$40 vs $4/$20). Over the ramp limit, requests are "moved to standard speeds and billed at standard rates" | OpenAI, Priority processing, https://developers.openai.com/api/docs/guides/priority-processing (V) | [P] |
| 4b6 | ×2 (Opus 5.5 $8/$40 vs standard $4/$20) | price, fast mode | "up to 2.5x higher output tokens per second at premium pricing"; dedicated rate limit; over it, 429/529 errors, not a higher price | Anthropic, Fast mode, https://platform.claude.com/docs/en/build-with-claude/fast-mode (V); standard price from research/20 | [P] |
| 4b7 | 99.5% uptime target; 1/3/6/12-month commitment | priority capacity | Priority Tier "prioritizes requests in this tier over all other requests … minimize server overloaded errors". Committed tokens per minute; excess falls back to standard. Now "no longer available for purchase" | Anthropic, Service tiers, https://platform.claude.com/docs/en/api/service-tiers (V) | [P] |
| 4b8 | Start $500 / Build $1,000 / Scale $200,000 | monthly spend cap per tier | Quantity rationing by tier at a fixed price: per-tier RPM/ITPM/OTPM limits, ramp limits, 429 errors. Limits "ensure fair distribution of resources among users" | Anthropic, Rate limits, https://platform.claude.com/docs/en/api/rate-limits (V) | [P] |
| 4b9 | ×0.5 Flex and Batch; Priority PayGo at a premium (no multiplier given); Provisioned Throughput on 1-week to 1-year terms, 1-year 26% below 1-month | Google Vertex consumption options | Standard PayGo throttles (429) at high load; "Combining Provisioned Throughput and PayGo provides the highest assurance against resource exhaustion (429 errors)" | Google Cloud, Vertex AI consumption options, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/deploy/consumption-options (V) | [P] |
| 4b10 | staggered launch | rationing a new model | GPT-4.5 went to Pro first, Plus a week later: "we've been growing a lot and are out of GPUs" | Altman X post, 27 Feb 2025 (located via TechCrunch/Tom's Hardware; post not opened) | [U] |
| 4b11 | — | internal allocation | "we dynamically direct available compute between workloads based on where the marginal unit is expected to be most productive" | Anthropic FWP 12 Nov 2026, Section 2.3 "Business" (URL in 3c) | [P] |

**Verdict: the evidence mostly supports rationing at a fixed list price, not raising the price to clear.**
- No lab raised a model's list price in response to a shortage in the docs read. When capacity is short, list prices
  stay put and providers ration: 429/529 errors, tier and ramp limits, staggered rollouts, paused top-ups (4b2, 4b6,
  4b8, 4b10).
- Price does move in two ways, both set in advance rather than set to clear the market moment by moment:
  - **Price discrimination by priority**: about ×2 for priority/fast, ×0.5 for batch/flex/off-peak, and commitments for
    reserved capacity (4b1, 4b3–4b9).
  - **Peak/off-peak pricing**: DeepSeek's ×2 peak is the clearest "price to clear" example (4b1).
- Kreps–Scheinkman gives clearing prices in theory, but only under efficient rationing.

**Game mapping: designer's decision.** Ration at a fixed list price, with spillover.
- A product short of serving compute keeps its list price and serves only what its capacity allows.
- Unserved demand spills over to the next-best seller or to the outside option. This matches the 429/rate-limit
  behaviour in 4b2, 4b6, 4b8 and 4b10.
- Kreps–Scheinkman clearing prices (4a1) and the priority premiums (4b5–4b7) remain background only.

---

## 5. Harness / scaffold effects

Gathered by a sub-search this session. "Same model" rows hold the model fixed and change only the harness; read only
those as harness uplift. Every "(nc)" date needs checking against the official post before citing.

| Harness | Value | Unit | Basis | Source | Tag |
|---|---|---|---|---|---|
| Coding | 1.31 → 12.47 (×9.5) | % SWE-bench full | Same model (GPT-4 Turbo): RAG baseline vs SWE-agent | Yang et al. 2024, *SWE-agent*, arXiv 2405.15793, Table 1 | [P] |
| Coding | 2.67 → 11.00 → 18.00 | % SWE-bench Lite | Same model: RAG → shell-only agent → SWE-agent. The agent interface alone gives ×1.6 over a plain shell | same | [P] |
| Coding | 63.7 → 70.3 (Claude 3.7 Sonnet); 72.5 → 79.4 (Opus 4); 72.7 → 80.2 (Sonnet 4) | % SWE-bench Verified | Same model: standard vs high-compute / parallel scaffold | Anthropic launch posts, 24 Feb 2025 (https://www.anthropic.com/news/claude-3-7-sonnet), 22 May 2025 (https://www.anthropic.com/news/claude-4) | [P] |
| Coding | 33.2 | % SWE-bench Verified | GPT-4o with the best open scaffold (Agentless) | OpenAI, "Introducing SWE-bench Verified", 13 Aug 2024, https://openai.com/index/introducing-swe-bench-verified/ | [P] |
| Research agent | 0.6 → 1.9 (GPT-4o, same model, browsing); o1 9.9 vs Deep Research 51.5 | % BrowseComp | Same model for the first pair; the second pair changes the model | OpenAI, BrowseComp, 10 Apr 2025, https://openai.com/index/browsecomp/ (arXiv 2504.12516) | [P] / [P-analogue] |
| Research agent | 13.0 (o3-mini-high) vs 26.6 (Deep Research); GAIA 63.64 (prior best) → 67.36 | % HLE; % GAIA | Different models | OpenAI, "Introducing deep research", 2 Feb 2025, https://openai.com/index/introducing-deep-research/ | [P-analogue] |
| Back-office / support | 61.2 retail / 35.2 airline pass^1; pass^8 < 25 retail | % τ-bench | gpt-4o with native function calling, which "consistently outperforms text-formatted agent methods" (ReAct/Act numbers are only in a chart) | Yao et al. 2024, τ-bench, arXiv 2406.12045, Table 2 | [P] |
| Clinical | 78.6 → 81.9 (cost per case $7,850 → $4,735) → 85.5 (ensemble) | % diagnostic accuracy | Same model (o3): off-the-shelf vs the MAI-DxO orchestrator. +11 pp on average across models. Physicians 20% | Nori et al. (Microsoft AI), "Sequential Diagnosis with Language Models", arXiv 2506.22405, §4 | [P] |
| Ops planner | 0.6 (GPT-4 with tools); ×4.6 with an LLM-Modulo critic loop (GPT-4-Turbo) | % TravelPlanner final pass | Same model for the ×4.6 | Xie et al. 2024, arXiv 2402.01622; Gundawar et al. 2024, arXiv 2405.20625 | [P] |
| Defence & intel | — | — | No performance metric exists; see the shipped table | — | — |
| Memory | about −30% | accuracy loss across sustained interactions without memory design | Memory designs "greatly improve" recall; the abstract gives no figure | Wu et al. 2024, LongMemEval, arXiv 2410.10813 | [P-analogue] |
| Computer use | human 72.36; best model at launch 12.24 | % OSWorld | Benchmark launch | Xie et al. 2024, arXiv 2404.07972 | [P] |
| Computer use | 14.9 (Claude 3.5 Sonnet new); 38.1 (OpenAI CUA) | % OSWorld | Different models | Anthropic 22 Oct 2024 (https://www.anthropic.com/news/3-5-models-and-computer-use); OpenAI 23 Jan 2025 (https://openai.com/index/computer-using-agent/) | [P] |
| Computer use | 15.5 → 27.0 (15 steps), 26.0 → 34.5 (50 steps) | % OSWorld | Same model (Claude 3.7 Sonnet): bare vs the Agent S2 framework | Agashe et al. 2025, Agent S2, arXiv 2504.00906, Table 1 | [P] |
| Agent mode | SpreadsheetBench: o3 23.25 → agent 35.27; BrowseComp 68.9 vs 51.5 (Deep Research); HLE 41.6 | % | Different models | OpenAI, "Introducing ChatGPT agent", 17 Jul 2025, https://openai.com/index/introducing-chatgpt-agent/ | [P-analogue] |
| Creative studio | 2 → just over 7 | % of consumer ChatGPT messages, "Multimedia" (create image + analyze image + other media, Table 3), Jul 2024 → Jun 2025 | "large spike in April 2025 after ChatGPT released new image generation capabilities … the elevated level has persisted". Lowest good-to-bad interaction-quality ratio, 1.7 | Chatterji et al., "How People Use ChatGPT", NBER w34255, Sep 2025, https://www.nber.org/papers/w34255 | [P] |
| Creative studio | 10.3 | % of Claude.ai conversations mapped to Arts, Design, Entertainment, Sports & Media occupations | 2nd-largest category; 57% augmentation / 43% automation overall | Handa et al. (Anthropic), arXiv 2503.04761, 2025 | [P-analogue] |
| Creative studio | −40% time, +18% quality | professional writing (incl. marketers), n ≈ 450 | Text copywriting, not images | Noy & Zhang, *Science* 381:187–192, 2023, doi 10.1126/science.adh2586 | [P-analogue] |

**Shipped by July 2025** (V = checked against the official post; nc = not checked):

| Harness | OpenAI | Anthropic | Google | xAI | Meta | DeepSeek |
|---|---|---|---|---|---|---|
| Coding | Codex CLI 16 Apr 2025 (nc); Codex 16 May 2025 (nc) | Claude Code preview 24 Feb 2025 (V); GA 22 May 2025 (V) | Jules beta 20 May 2025 (nc); Gemini CLI 25 Jun 2025 (nc) | — | — | — |
| Research agent | Deep research 2 Feb 2025 (V) | Research 15 Apr 2025 (nc) | Deep Research 11 Dec 2024 (V) | DeepSearch Feb 2025 (nc) | — | — |
| Back-office / support | — | — | — | — | — | — |
| Clinical | — | — | AMIE research only | — | — | — |
| Ops planner | — | — | — | — | — | — |
| Defence & intel | OpenAI for Government 16 Jun 2025 (V); CDAO awards 14 Jul 2025 | Claude Gov 6 Jun 2025 (V) | CDAO award 14 Jul 2025 (nc) | xAI for Government 14 Jul 2025 (nc) | Llama for US national security 4 Nov 2024 (nc) | — |
| Memory | 13 Feb 2024; chat history 10 Apr 2025 (nc) | — (Aug 2025, nc) | past chats 13 Feb 2025 (nc) | Apr 2025 (nc, low confidence) | — | — |
| Computer use | Operator 23 Jan 2025 (V) | 22 Oct 2024 (V) | Mariner prototype 11 Dec 2024 (nc) | — | — | — |
| Voice & image input | Advanced Voice 24 Sep 2024 (nc) | Voice beta 27 May 2025 (nc) | Gemini Live 13 Aug 2024 (nc) | Feb 2025 (nc, low confidence) | Sep 2024 (nc, low confidence) | — |
| Agent mode | ChatGPT agent 17 Jul 2025 (V) | — | announced 20 May 2025, not shipped (nc) | — | — | — |
| Creative studio (image/video gen) | Sora 9 Dec 2024 (V); 4o image gen 25 Mar 2025 (V); DALL-E 3 Oct 2023 (nc) | — | Imagen 4 + Veo 3, 20 May 2025 (nc) | Aurora 9 Dec 2024 (V) | Imagine Dec 2023 (nc) | Janus-Pro open weights Jan 2025 (nc) |

Defence sources: https://openai.com/global-affairs/introducing-openai-for-government/ ,
https://www.anthropic.com/news/claude-gov-models-for-u-s-national-security-customers , CDAO release
https://www.ai.mil/News/PR-View/Article/4242822/ . Creative: https://openai.com/index/sora-is-here/ ,
https://openai.com/index/introducing-4o-image-generation/ , https://x.ai/news/grok-image-generation-release .

**Game mapping.**
- The same-model uplifts are large where the harness supplies actions the bare model lacks: coding ×1.6 over a shell
  (×9.5 over retrieval only), planning ×4.6, research browsing ×3 on a near-zero base. They are moderate where it adds
  checking or parallel attempts: +7–9 pp on SWE-bench, +3–11 pp clinical, +8–12 pp OSWorld.
- A multiplicative effect on the effective skill gap fits better than a flat bonus.
- By July 2025 the leader-type labs (OpenAI, Anthropic, Google) had shipped coding, research, computer use, voice,
  government offerings and, at OpenAI and Google, image/video generation.
- Nobody had a shipped back-office, clinical or operations-planner product. Those are fair "future" harnesses.

---

## Gaps and stand-ins

- **Vetted shares**: no official critical-infrastructure employment share exists, so most vetted shares are [D].
- **DIB 1.1M**: only via CRS, about FY2020; the DoD file returned 403. DoD civilians are from FY2021.
- **SUSB**: by industry, not occupation, so OFFICE and LEGAL are approximate.
- **Not found**:
  - Per-sector large-firm shares for China.
  - China's state-owned share of employment.
  - An OECD general-government employment share for ROW (*Government at a Glance* not read).
  - The public share of electric-utility employment.
- **EU coverage**: SBS covers market activity only, so EU public health and education are excluded.
- **Anthropic gross margin 85.5%** (3d) is from secondary readings of the S-1/A. The primary S-1 is over the fetch
  limit. Verified primary: total compute = 57% of revenue (9M 2026), so the serving margin is at least 43%.
- **No primary gross margin** for OpenAI, Google or Microsoft AI. Big-cloud segment margins were not fetched.
- **Elasticity**: the only causal estimate (w34608 Table 2, read in the long version) is a within-model, cross-host
  elasticity for open-source models on OpenRouter (3f′). **No source estimates a lab's (firm) own-price elasticity, a
  cross-price elasticity between labs, or a market elasticity**; the paper gives only a direction for the last (3f″) and
  qualitative entry case studies for substitution (3f‴). The OpenRouter 0.05–0.07 is a cross-section trend. The NYU
  thesis −0.78 is unread [U].
- **μ**: margins (3a/3c/3d) give μ ≈ 0.41–0.58·p; the w34608 elasticity, as an upper bound on |ε_firm|, gives
  μ ≳ 0.61·p (≳ 0.51·p at one s.e.). They overlap only at the top of the margin range (m ≈ 0.8–0.9). The bound rests on
  a [D] nested-logit argument and a short-run, router-mediated estimate.
- **Market shares, mid-2025**: Menlo is a vendor-adjacent usage survey. No primary spend shares by lab.
- **Capacity**: no lab raised a list price in response to a shortage. DeepSeek's top-up pause and the GPT-4.5 "out of
  GPUs" post are press-located; the primaries were not opened. Davidson & Deneckere 1986 and Steiner 1957 are cited
  from memory, not fetched.
- **Harness**: same-model HLE with vs without tools is not confirmed. τ-bench scaffold gains are only in a chart. There
  is no shipped-memory uplift benchmark. The image-generation-only share of ChatGPT messages is only in NBER Fig. 9. No
  primary productivity study of image or video generation. Every "(nc)" launch date is unchecked.
