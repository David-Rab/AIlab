# 21 - Frontier-lab financing mechanisms, 2014 to Nov 2026: catalogue and gap check

Research date: 2026-11-19. Scope: check that the finance redesign (design/FINANCE-V3.md) has not missed a financing
method or deal structure frontier labs actually used. Builds on research/15 (2024–26 rounds, hyperscaler and
chip-vendor deals, Stargate, Hyperion, CoreWeave loans, Oracle bonds, Anthropic S-1, OpenAI recapitalisation),
which is not repeated here; this pass adds early-era methods, unusual structures and 2026 items.

**Tags:** [P] primary fetched · [P-snip] primary seen only through a search snippet · [S] secondary summary of a
primary · [U] press only, unverified.

**Source notes:** openai.com refuses fetches, so OpenAI blog facts are [P-snip]. The FTC 6(b) report on AI
partnerships and the CMA's Google/Anthropic decision were read in full [P]: they are the best primary evidence on how
hyperscaler deals are structured. Many 2026 items exist only in press [U].

**User decisions on this report (2026-11-19)** are recorded in FINANCE-V3.md §0; §2–§3 below are the agent's
recommendations as delivered, not decisions.

## 1. Catalogue

### A. Founding-era and non-standard equity

| # | Mechanism | Who, when | How it worked | Funder underwrote / got | Strings | Source |
|---|---|---|---|---|---|---|
| A1 | Nonprofit donations | OpenAI 2015–19 | $1B pledged; actual gifts under $45M from Musk, over $90M from others | Mission, no return | Musk sought control or a Tesla merger | https://openai.com/index/openai-elon-musk/ [P-snip] |
| A2 | Capped-profit LP / profit-sharing units | OpenAI LP, Mar 2019 | Investors and staff hold profit-sharing interests, not equity; first-round return capped at 100×, caps negotiated per investor; excess to the nonprofit | Capped upside | Nonprofit board control; mission first | https://openai.com/index/openai-lp/ [P-snip] |
| A3 | Capped profit share to a strategic | Microsoft–OpenAI 2019–25 | Microsoft's profit allocation reportedly capped at $92B | Upside to $92B | — | FTC 6(b) §4.1 [P] https://www.ftc.gov/system/files/ftc_gov/pdf/p246201_aipartnerships6breport_redacted.pdf |
| A4 | Round conditional on restructuring (convertible with clawback) | OpenAI $6.6B, Oct 2024 | Converts only if the for-profit conversion completes within 2 years, else investors can ask for their money back (SoftBank 2025 $30B→$10B is the same pattern, research/15) | A governance change | Reportedly asked investors not to fund named rivals [U] | https://www.axios.com/2024/10/02/openai-new-funding-round-restructuring [U] |
| A5 | Mission warrant to the controlling nonprofit | OpenAI Foundation, Oct 2025 | Foundation holds 26% plus a warrant for more if the share price is above a set level (reported >10×) at 15 years | — | — | https://openai.com/our-structure [P-snip] |
| A6 | Mission-aligned angel / philanthropic early equity | Anthropic Series A $124M (May 2021); Series B $580M led by Bankman-Fried (Apr 2022) | Individuals, not VCs, before any product | Team, mission | — | https://www.anthropic.com/news/anthropic-raises-series-b-to-build-safe-reliable-ai [P-snip] |
| A7 | Crypto-sourced equity, then bankruptcy sale | FTX's ~8% Anthropic stake; the estate sold ~2/3 for $884M (Mar 2024: ATIC/Mubadala ~$500M, Jane Street, Fidelity) | A distressed holder's stake auctioned; no new cash to the lab | Secondary entry for a sovereign | Court approval | https://www.theblock.co/post/284480/ftx-to-sell-two-thirds-of-anthropic-stake-for-884-million-with-buyers-including-jane-street-and-funds-managed-by-fidelity [S] |
| A8 | Pre-product mega seed at high dilution | SSI $1B at $5B (Sep 2024, ~20%), ~$2B at $32B (Apr 2025); Thinking Machines $2B at ~$12B (2025, ~17%) | Pure team bet, no product or revenue | Talent | Founder control (TML super-voting, unverified) | https://www.computing.co.uk/news/2025/ai/alphabet-and-nvidia-back-sutskever-ssi [U] |
| A9 | Failed round plus founder exodus | Thinking Machines 2026: $50–60B ask collapsed, 3 co-founders back to OpenAI; now ~$5B at ≥$40B pre (Nov 2026) | Credibility collapse, down-sized round | — | — | https://letsdatascience.com/news/thinking-machines-lab-reportedly-nears-5-billion-round-at-40-fcc2bde1 [U] |
| A10 | Founder-controlled wrapper, outside money without votes, 5-year lock-up | DeepSeek first outside round ~$7.4B at >$50B (mid-2026); Liang put in ~$3B; investors enter through an LP he manages | Founder keeps control; partly talent retention | — | Possible state-fund vote (conflicting reports) | https://the-decoder.com/deepseek-takes-outside-money-for-the-first-time-at-a-50-billion-valuation/ [U] |
| A11 | Self-funding from a parent's other business | High-Flyer (quant fund) built DeepSeek's 10,000-A100 Fire-Flyer cluster | Parent profits buy compute | — | — | https://arxiv.org/abs/2408.14158 [P-snip] |
| A12 | Employee tender / secondary (no cash to the company) | OpenAI $6.6B of a $10B authorisation at $500B (Oct 2025); Anthropic $5–6B at $350B pre (Feb 2026), under-subscribed by staff before the IPO | Staff liquidity and retention; sets a mark; entry for investors | Eligibility (e.g. ≥1 y tenure) | https://news.crunchbase.com/ai/openai-valuation-secondary-share-sale-biggest-unicorn-spacex/ [U]; https://www.bloomberg.com/news/articles/2026-02-04/anthropic-plans-employee-tender-offer-at-350-billion-valuation [U] |

### B. Hyperscaler and strategic structures (detail beyond research/15)

| # | Mechanism | Who, when | How it worked | Funder underwrote / got | Strings | Source |
|---|---|---|---|---|---|---|
| B1 | Investment recycled as cloud spend | Microsoft–OpenAI (2019, 2023); Amazon and Google–Anthropic | A large share of the investment must be spent on the investor's cloud. FTC: this cuts the provider's downside because the infrastructure "could be resold or used internally" if the lab fails | Cloud revenue; a capex floor | Committed spend (Anthropic–AWS ≥$4B over 5 y, Sep 2023); "exclusive cloud provider" (OpenAI 2019–25) | FTC 6(b) §4.3 [P] |
| B2 | Non-voting strategic stakes and convertible notes, no board seat | Google–Anthropic (side letter Oct 2022, revised Aug 2024); Amazon similar | Non-voting shares; notes convert only to non-voting stock; no board rights, only consultation rights other investors also hold; Anthropic deliberately multi-sources compute | Upside, distribution (Vertex), compute sales | Structured to avoid a "material influence" finding; CMA cleared Nov 2024 | CMA ME/7108/24 [P] https://assets.publishing.service.gov.uk/media/676959bae6ff7c8a1fde9d33/Full_text_decision__.pdf |
| B3 | Board observer seat dropped under antitrust pressure | Microsoft at OpenAI, Nov 2023 – Jul 2024 | Information rights and "stakeholder meetings" kept after the seat went | Information | — | FTC 6(b) §4.2 [P] |
| B4 | IP access, revenue share, parity clauses, embedded engineers | All three cloud-provider partnerships | Providers get revenue shares (incl. on the lab's first-party API) and access to model IP and research; parity terms stop the lab offering better models first-party than on the partner cloud | IP hedges the provider's own model effort ("bridge until our own model is competitive") | — | FTC 6(b) §4.1, §4.4 [P] |
| B5 | Tiny convertible from a hyperscaler | Microsoft–Mistral €15M, Feb 2024 | Converts at the next round to <1%; no special rights | Distribution on Azure | CMA cleared May 2024 | https://assets.publishing.service.gov.uk/media/664c6cfd993111924d9d389f/Full_text_decision.pdf [P-snip] |
| B6 | Cloud credits as part of the equity cheque | Alibaba–Moonshot $800M, just under half cloud credits; same pattern with Zhipu, MiniMax, 01.ai; Alibaba reportedly supplied ~20k Nvidia chips for Kimi K3 (2026) | Investment in kind | Cloud lock-in | — | https://news.futunn.com/post/42250963/alibaba-leverages-cloud-business-to-become-a-leading-ai-investor [U, FT-sourced] |
| B7 | Industrial strategic anchor | ASML ~€1.3B of Mistral's €1.7B Series C, Sep 2025 | Largest shareholder | European sovereignty; customer relationship | Board / strategic committee seat (unverified) | https://www.thestar.com.my/tech/tech-news/2025/09/08/exclusive-asml-becomes-mistral-ais-top-shareholder-after-leading-latest-funding-round-sources-say [U] |
| B8 | Investor as anchor customer | SoftBank ~$3B/y to deploy OpenAI across its group; 50/50 SB OpenAI Japan JV (Feb 2025) | Investor commits recurring spend | Distribution JV | Japan exclusivity | https://group.softbank/system/files/news/press/2025/20250203/20250203_0_en.pdf [P-snip] |
| B9 | Investor's own leverage funds the equity | SoftBank 2025–26: sold all Nvidia ($5.8B) and $9.2B of T-Mobile; Arm margin loan to $20B; $8.5B bridge; $40B unsecured bridge (Mar 2026); $10B margin loan on OpenAI shares; ~$11B bonds | Tranches depend on the anchor's balance sheet and share prices | — | Counterparty risk | https://siliconangle.com/2025/11/11/softbank-offloads-5-8b-stake-nvidia-free-cash-openai-investment/ [U]; https://www.mobileworldlive.com/softbank/softbank-bags-40b-bridge-loan-to-fund-openai-stake/ [U] |
| B10 | Supplier gives the customer equity | OpenAI got $350M of CoreWeave stock with an $11.9B contract (Mar 2025); same shape as AMD warrants (research/15) | Lab paid to commit | — | — | [U] |

### C. License-and-hire ("reverse acquihire") exits

| # | Mechanism | Who, when | How it worked | Funder underwrote / got | Strings | Source |
|---|---|---|---|---|---|---|
| C1 | Microsoft–Inflection | Mar 2024 | ~$620M non-exclusive licence + ~$30M legal-claims waiver; founders and most of ~70 staff hired; investors got 1.5× (first round) and 1.1× (the $1.3B 2023 round). CMA treated hiring a team with know-how as a merger and cleared it | Team + licence | Shell left behind | https://www.gov.uk/cma-cases/microsoft-slash-inflection-ai-inquiry [P-snip]; https://spyglass.org/microsoft-inflection-deal-terms/ [U] |
| C2 | Amazon–Adept | Jun 2024 | Founders to Amazon AGI; non-exclusive licence to models and data; Adept said frontier models would have needed "significant attention on fundraising" | Team + licence | Shell continues | https://geekwire.com/2024/amazon-hires-founders-from-well-funded-enterprise-ai-startup-adept-to-boost-tech-giants-agi-team [U] |
| C3 | Google–Character.ai | Aug 2024 | Non-exclusive licence (~$2.5–2.7B reported); Shazeer to DeepMind; company continues | Team + licence | Funds investor liquidity | https://techcrunch.com/2024/08/02/character-ai-ceo-noam-shazeer-returns-to-google/ [U] |
| C4 | Meta–Scale AI | Jun 2025 | $14.3B for 49% non-voting; CEO Wang to Meta; early VCs could sell half | Leader + data supplier | Non-voting, reportedly to avoid merger review | https://www.news4jax.com/business/2025/06/13/meta-invests-in-ai-firm-scale-and-recruits-its-ceo-for-superintelligence-team/ [U] |
| C5 | Nvidia–Groq | Dec 2025 | Non-exclusive licence (~$20B reported); founder and president to Nvidia; GroqCloud continues | — | — | https://groq.com/newsroom/groq-and-nvidia-enter-non-exclusive-inference-technology-licensing-agreement-to-accelerate-ai-inference-at-global-scale [P-snip] |

### D. Parent, affiliate and merger funding

| # | Mechanism | Who, when | How it worked | Strings | Source |
|---|---|---|---|---|---|
| D1 | Acquisition, then a funded division | Google buys DeepMind 2014 (~£400M) | — | Reportedly an ethics board | [U, not verified] |
| D2 | Intercompany loans and debt forgiveness | Alphabet waived ~£1.1B of DeepMind loans (2019); 2019 revenue £266M, mostly R&D services to group companies | Parent funds losses by loan, then waiver; the lab bills the group for research | Parent can stop | https://www.cnbc.com/2020/12/17/deepmind-lost-649-million-and-alphabet-waived-a-1point5-billion-debt-.html [S]; Companies House 07386350 [P-snip] |
| D3 | In-house lab funded by parent cash flow and bonds | Meta (with the Hyperion SPV, research/15) | Capex set by the parent, judged by its stock | — | research/15 |
| D4 | Founder's other companies invest | SpaceX ~$2B in xAI (2025 [U]); Tesla ~$2B of xAI Series E (Jan 2026) after shareholders rejected a non-binding $5B proposal | Related-party money | Minority-shareholder backlash | https://driveteslacanada.ca/news/tesla-announces-2-billion-investment-in-xai-heres-how-it-differs-from-the-shareholder-vote/ [U] |
| D5 | All-stock merger into a cash-flowing affiliate | xAI + X (Mar 2025: $80B / $33B); SpaceX + xAI (Feb 2026, research/15) | Combines burn with cash flow and an IPO path | — | [U] |
| D6 | Sub-scale lab merger, sovereign-led | Cohere + Aleph Alpha (Apr 2026, ~90/10); Schwarz Group leads Cohere's Series E (~C$7B target at C$35.7B, Oct 2026) | Scale by consolidation | Regulatory approval pending | https://lightreading.com/ai-machine-learning/cohere-wraps-initial-close-of-new-funding-round-to-fuel-sovereign-ai-efforts [U] |

### E. Lab-level debt (beyond research/15)

| # | Mechanism | Who, when | How it worked | Source |
|---|---|---|---|---|
| E1 | Undrawn revolver as a liquidity signal | OpenAI $4B, 9 banks, Oct 2024 | Undrawn at close; "liquidity >$10B" | https://openai.com/index/new-credit-facility-enhances-financial-flexibility [P-snip] |
| E2 | Secured high-yield notes and term loan B while cash-flow negative | xAI $5B (Jul 2025): secured notes ~12–12.5%, TLB SOFR+700, "best efforts" placement | Priced like distressed credit at a ~$200B valuation | https://finance.yahoo.com/news/musks-xai-raises-5-billion-014546355.html [U] |
| E3 | GPU SPV lease from an investor-affiliated vehicle | Valor SPV for xAI: ~$7.5B equity (Nvidia up to $2B) + $12.5B debt (Apollo, Diameter); ~5-year lease with purchase option | Off-balance-sheet chips; conflict: Valor also holds xAI equity | https://www.techrepublic.com/article/musks-xai-reveals-20b-ai-deal-that-changes-everything/ [U] |
| E4 | GPU-backed bank debt at a mid-size lab | Mistral $830M, 7 banks, Mar 2026; first debt, avoids dilution; funds 13,800 GB300s | — | https://news.bloomberglaw.com/tech-and-telecom-law/mistral-raises-830-million-to-house-nvidia-chips-in-data-center [U] |
| E5 | Little or no lab debt; commitments instead | OpenAI reportedly ~$0 debt and ~$665B of purchase commitments (Q1 2026); small BofA line Jul 2026 (conflicts with the 2024 revolver) | — | [U] |

### F. Government

| # | Mechanism | Who, when | Source |
|---|---|---|---|
| F1 | Defence contracts (OTA, ceiling awards): CDAO up to $200M each to Anthropic, OpenAI, Google, xAI over 2 years | Jul 2025 | https://www.theregister.com/2025/07/14/pentagon_ai [U] |
| F2 | Government as a customer risk: Anthropic designated a DoD "supply chain risk" (Feb–Mar 2026) after a usage-terms dispute; DC Circuit upheld it 2-1 (Sep 2026); N.D. Cal. ruled it unlawful | 2026 | https://www.nextgov.com/acquisition/2026/09/anthropic-lawsuit-supply-chain-risk/416255/ [U] |
| F3 | National compute grant to a lab as anchor tenant: Canada up to C$240M to Cohere for a C$725M CoreWeave-built site | Dec 2024, final Mar 2025 | https://www.canada.ca/en/innovation-science-economic-development/news/2025/03/government-of-canada-finalizes-investment-to-support-canadian-born-ai-leader-cohere.html [P-snip] |
| F4 | Lobbying for tax credits and loan guarantees: OpenAI letter to OSTP (27 Oct 2025) to extend the §48D credit to data centres and servers; loan-guarantee comments walked back | 2025 | https://techcrunch.com/2025/11/08/openai-asked-trump-administration-to-expand-chips-act-tax-credit-to-cover-data-centers/ [U] |
| F5 | Proposed government equity stake: OpenAI reportedly offered ~5% (donated shares) to a public wealth vehicle (Jun–Jul 2026), not concluded; precedent USG ~9.9% of Intel (2025) | 2026 | https://thenextweb.com/news/openai-5-percent-stake-trump-administration [U] |
| F6 | Chinese state funds and Hong Kong IPOs: the National AI Industry Investment Fund reportedly led Moonshot's >$3.5B round at $35B; Zhipu HK IPO (8 Jan 2026; retail tranche 1,159× oversubscribed; 11 cornerstones ~HK$3B) | 2026 | https://www2.yicaiglobal.com/news/zhipu-ai-soars-in-hong-kong-stock-market-debut-as-chinese-startup-becomes-worlds-first-llm-firm-to-go-public [U] |

### G. Distress and intermediaries

| # | Mechanism | Who, when | Source |
|---|---|---|---|
| G1 | Rescue with supplier debt forgiveness: Stability AI ~$80M from a new investor group; suppliers forgave ~$100M owed and ~$300M of future obligations; new CEO and chair | Jun 2024 | https://techcrunch.com/2024/06/25/stability-ai-lands-a-lifeline-from-sean-parker-greycroft [U] |
| G2 | Chip vendor backstops a neocloud's unsold capacity: Nvidia $6.3B order, must buy CoreWeave's residual unsold capacity to Apr 2032 | Sep 2025 | https://www.sec.gov/Archives/edgar/data/1769628/000176962825000047/crwv-20250909.htm [P-snip] |
| G3 | Developer-SPV "layer cake": Abilene (Crusoe/Blue Owl/Primary Digital JV ~$15B, JPMorgan ~$9.6B, 15-year Oracle lease); Vantage ~$38B bank debt, 4 y + 2×1 y, ~SOFR+250. Lab contract → Oracle lease → developer debt; the lab carries no debt | 2025 | https://commercialobserver.com/2025/01/j-p-morgan-chase-loan-texas-data-center-oracle/ [U] |

## 2. Gap check against the design shape (agent's recommendations)

| # | Covered? | Critical? |
|---|---|---|
| A1, A2, A5, A6, A7 | Presets / no | Omit: founding era or one-off; the game starts in 2025; A2's effect sits in the legacy capped-profit preset |
| A3 | Partly (revenue share) | Omit the cap number |
| A4 | Partly (conditional tranches) | Critical, cheap: a round conditional on a governance change (OpenAI 2024–25); add "governance change by date" as a tranche condition |
| A8 | No (dilution cap 5–8%) | Critical only if players can found a lab (seed rounds 17–44%) |
| A9 | Partly | Omit as a mechanism |
| A10, A11 | Founder preset | Omit (rivals) |
| A12 | No | Omittable unless talent reads equity value |
| B1 | Yes | Supports the pricing logic (resellable infrastructure caps the funder's downside) |
| B2, B3 | Partly | A constraint, not a decision: hyperscaler stakes are non-voting, capped, seatless because of CMA/FTC review |
| B4 | Partly | IP rights to the partner are a real cost: the partner learns and can compete; consider an "IP access" string |
| B5, B6, B7 | Yes | — |
| B8 | No | Omittable |
| B9 | No | Counterparty risk on uncalled tranches in a bust |
| B10 | Partly | Omit |
| C1–C5 | Partly | The real failure mode of sub-frontier labs is license-and-hire by big tech, not bankruptcy; right exit for simplified rivals; optional soft ending for the player |
| D1–D3 | Preset only | The big-tech division needs its own simple parent-budget rule |
| D4, D5, D6 | No | Omit |
| E1, E3, E4, E5 | Yes | E5 supports "debt sits with intermediaries" |
| E2 | Contradicts | Secured high-yield debt is available to cash-burning labs at junk prices |
| F1–F6 | No | Omit from finance (politics sphere at most) |
| G1 | Yes | Real precedent for renegotiate + rescue |
| G2, G3 | Yes | Omit internals |

## 3. Where the shape looked wrong (agent's findings)

1. "Bonds only with positive operating cash flow": secured high-yield debt was available to cash-burning labs (xAI, CoreWeave, Mistral). Rating does not follow valuation (xAI paid junk rates at ~$200B).
2. "One strategic partner": Anthropic and OpenAI stacked several; the CMA cites multi-sourcing as why no partner gained material influence.
3. Hyperscaler board seats were rare and antitrust-sensitive; real strings were non-voting capped stakes, information rights, exclusivity / ROFR / parity, revenue share, IP access.
4. Sovereign money was mostly passive cheques; in-country builds were separate infrastructure deals.
5. Most priced rounds carried no contractual milestones; contractual conditions were structural (governance, IPO, AGI, GW deployed).
6. IPO should be visible: 2026 had Anthropic (~$56–62B), SpaceX/xAI ($86B), Zhipu and MiniMax in Hong Kong; dual-class control (Anthropic Class F 50.1%).
7. The 5–8% dilution cap holds only for late-stage labs.

## Not verified this session
DeepMind's 2014 price and ethics-board terms; Inflection's $1.3B round; Microsoft's 2019/2023 credit share; xAI–X
merger terms; SpaceX's $2B into xAI; ASML's stake and seat; Thinking Machines super-voting; Character.ai licence
size; DeepSeek state-fund vote; the OpenAI–BofA 2026 line (conflicts with the 2024 $4B revolver); full FTC Table 2.
