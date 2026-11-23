# R&D mockups, set A (PRODUCTS, Overview, RESEARCH › Discoveries): where every number comes from

Same fixture and rules as `DATA.md`: the day-400 RefBot fixture `scripts/v2/fixtures/day400.json`. `_data-a.ts` calls the
player-facing view functions and writes `data400a.json` (`npx tsx design/ux/mockups/rd/_data-a.ts`). `_probe-a.ts` reads
the discovery sizes and times to finish. Render: `node render.mjs products products:drawer overview overview:tip
discoveries discoveries:drawer`.

Basis: F = fact, M = measured, B = belief, B·fc = forecast, B·intel = intel. **NEW** = the engine has no player-facing
readout for it yet.

## PRODUCTS (`products.png`, `products-drawer.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Revenue per product | Enterprise $13.7B · Chat $11.7B · API $6.5B /yr; sum $31.9B | `worldfx/productView.ts:productReadouts` `revenue` | F |
| Revenue trend | peak $34.6B (day 364) → $33.0B now (▼ 5%) | `s.series.revenue` (all revenue, weekly) | F |
| Served / not served | all served (unserved $0 on every product) | `productReadouts` `unserved` = demand − revenue | F |
| Limited by | quality, all three | `productReadouts` `bound` | B |
| "rivals' models win buyers" / "users mostly stay" | — | from `cust.target` vs `cust.stock` (below) | B·fc |
| Serving compute: spare | 233k of 1.01M H100e idle | `worldfx/revenue.ts:idleServing`, `servingPool` (number lives on LAB) | F |
| Policies 2 on | Serve the most profitable first (on), Auto-make smaller sizes (on), upgrade to newest (off) | `player.policies.servingAuto`, `autoCheapTier`, `upgradeToNewest` | F |
| Lineup: models, hours sold, price per hour | API: Atlas-2.8 75% $1.21 · Atlas-2.8-mini 25% $0.21; Enterprise: 73% $1.61 · 27% $0.21; 4 more sell 0% | `productReadouts` `lineup[]` (`share`, `price`) | F |
| Lineup skill bars | measured capability: Atlas-2.8 6.9 · 2.8-mini 5.18 · 1.0-nano 1.1 (bar only, no number) | `version.evals.measuredL` | M |
| Chat lineup | paying users: Atlas-2.8, $22 a month; free tier: Atlas-1.0-nano; 5 more unused | `deployment.versionId`, `freeTierVersion`, `read.price` | F |
| Tools on each product, where they help | Memory: all work, tasks ×1.3 longer · Research mode: Science, Finance, Legal, skill ×2 compute, ×3 cost per task · Coding harness: Software & IT, ×2, ×2 cost · Computer use: Admin, Finance, Legal, Government, +13% of tasks · Voice & vision: Chat appeal ×1.07 / Media +13% of tasks | `deployment.features`; `productView.ts:featureView` lines | F / B |
| Customers: share now → target, time | Enterprise / API 29% → 16% in ~2 yr (784 d); Chat 36% → 35% (15 d) | `productReadouts` `cust.stock`, `cust.target`, `cust.days` | F now; B·fc target |
| Best rival | DeepCent 30% (Enterprise, API) · xLab 17% (Chat) | `productReadouts` `rival` | B·intel |
| Seats, hours, users | 23.4M seats · 5.4B h/yr (Enterprise); 6.8B h/yr (API); 605M weekly users, 7.3% pay (Chat) | `read.econ.seats`, `read.hours`, `read.users`, `econ.paidShare` | F |
| Sector certification | none yet; certifiable: Finance, Healthcare, Government, Military | `deployment.adaptations` (empty); `models/adaptations.ts:CERT_SECTORS` | F |
| Price | Standard · Enterprise / API 2.5× serving cost | `deployment.price`, `read.markup` | F |
| Thinking effort | Max; Deep locked (needs Coordinating copies, failed) | `deployment.effort`; tree node P05 | F |
| Agents: ready to launch | Atlas-2.8 works ~22 h alone (needs 4 h); engineers 77% spare; ~1 wk of engineering | `models/products.ts:measuredHorizonH`; LAB engineer spare (DATA.md); launch 4 team-weeks ÷ ~3.9 spare teams | M / F |

**Drawer (Enterprise › Customers):**
- Sector shares now → target: Admin 33% → 15% · Software & IT 37% → 19% · Finance 37% → 21% · Retail & services 31% → 12%, from `cust.movers` (the four largest gaps).
- "Buyers switch over ~8 months" is `cust.taus[0].days` = 237 d.
- Shared with API: both read the same sector segment (`segmentShares`).
- Sold in a year: task-hours 2.2B, agent-hours 3.2B, 23.4M seats at $25, serving cost $3.0B, margin 60%. Sources: `econ.adoptedHours`, `agentHours`, `seats`, `seatPrice`, `read.runCost`, `read.margin`.
- Certify for Finance: 4 engineer team-weeks (~1 wk at current spare), 240 days, $4M, friction cut for this product's Finance buyers. Source: `ADAPT_TW`, `CERT_DAYS`, `CERT_CASH`, `CERT_FRICTION_CUT`.
- "×1.5 pretraining know-how waiting" links to the Know-how value (DATA.md).

**NEW for PRODUCTS:**
- Revenue per product over time: only the total has a series.
- Customers per product: today API and Enterprise share one sector segment, so they show the same share.
- Rival share and price per sector, and the price of the best rival's model for sector products: Chat only (`econ.going`).
- A preview of what each fix in the drawer would do to share (new model in the lineup, certification).
- A reason string for "Limited by" (today it is a single word).

**Layout call:** customers (share now → target) is shown on each card at L1, not only in L2. It is the visible effect
of "Limited by quality", and without it the strip's verdict has no "why".

## Overview (`overview.png`, `overview-tip.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Compute: Growing | online 3.64M → 3.80M H100e over the last 3 weeks | `s.series.compute` | F |
| Lab: Idle compute, training share unused | Training 39.6% all idle | `departments/autoSplit.ts:idleShares` (DATA.md) | F |
| Research: Limited by compute, scientists all busy | compute-bound; 10 teams on 6 programmes, 0 idle | `engine.production().label`; `teams.ts` | B / F |
| Training: No run queued, know-how is waiting | no running or queued run; ×1.5 waiting | runs list; Know-how (DATA.md) | F / B |
| Models: Atlas-2.10 testing, in use Atlas-2.8 | `status: evaluating` / `deployed` | `player.models.versions` | F |
| Products: Limited by quality | all three products | `productReadouts.bound` | B |
| Finance: Healthy, revenue covers costs | runway capped at 8+ quarters; revenue $32.7B/yr above costs | `selectors.ts:runwayLive` | F / B·fc |
| Safety: Staff short | safety research engineers short 10 people | `researchView.ts:safReAllocView` | F |
| World: DeepCent riskiest | top world-risk source DeepCent 9.5% (0.3–18.7%) | `engine.riskSources` (number lives on World) | B·intel |
| Lead lanes, best guess | Meridian 154 d ahead · Gemini Labs 72 ahead · DeepCent 52 ahead · xLab 83 behind · Anthropos 272 behind | `actors/intel.ts:leadDays` `est` (negative = they lead) | B·intel |
| Likely range | best guess ± 1.64 × sd (sd 46 · 61 · 65 · 64 · 48 d) | `leadDays` `sd` | B·intel |
| Tooltip: intel report date | Aug 4, 2026 | `rival.intel.lastReportDay` 399 | F |

**Where risk lives (the old Company & world › Risk screen):**
- Your own models' loss-of-control risk has one home: SAFETY (gauge), with the small L0 item linking there. The old
  Risk screen's "Loss of control (Atlas-2.8)" row is removed.
- World risk (rival labs, China, war, theft, rogue copies, misuse) moves to the World screen, per UI-IA §0. Overview
  shows only its verdict on the World box and a link from each lead lane ("Risk from their models").
- The combined catastrophe gauge stays deleted.

**NEW for Overview:**
- A lead history per lab (trend arrows): the engine keeps only today's estimate.
- Lead as a low–high range: the engine has an sd; the mockup shows ± 1.64 sd.
- Rivals' released models measured by your evals (the tooltip link; also MODELS Q2).
- Verdict words for each hub box: derived here, no engine readout.

## RESEARCH › Discoveries (`discoveries.png`, `discoveries-drawer.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Node states | 25 known · 29 can start · 1 researching · 1 failed · 25 locked | `models/tree.ts:nodeStatus`, `treeCounts` | F |
| Columns | Can start now (31: open, researching, failed) · One step away (19: every unmet need can start now) · Later (6) | from each node's `needs` and the states above | F |
| Known list per field | 2025 public practice plus your own known nodes | `nodeStatus = known` | F |
| Fields | Pretraining · Post-training · Systems · Alignment · Interpretability · Evals & control | node `column` | F |
| Effect per node | e.g. Neuralese recurrence ×3.2 effective compute (+0.5 OOM); Elastic training ×1.05 (+0.023 OOM); AI-designed kernels training ×1.15, serving ×1.33; Faithful reasoning ×0.5 (−0.29 OOM) | node `cap` / `saf` text and `effect`, OOM shown as × | B |
| Output tag | capability (purple stripe) · see / stop / fix / meta (safety) | node `fx`, `technique` role | F |
| Risk mark | nodes with a known downside (node `fx.saf` < 0 or a cost line) | node `fx`, `saf` text | B |
| Opens N | number of nodes that list it in `needs` | `TREE_CHILDREN` | F |
| Deception probe | researching, 50%, ~47 d | `tree[T-DECEPT].progress`; Portfolio card | F / B·fc |
| Coordinating copies | failed, retry at 24% | `nodeOdds(P05)` | B |

**Drawer (Neuralese recurrence):**
- Chance it works 70%: `nodeOdds(P17)`.
- Size very large: `effortClassOf` XL. Time to finish ~1.6 yr with 1 team, ~1.4 yr with 2: `projectEta(P17, 1)` 586 d and `projectEta(P17, 2)` 527 d.
- Needs Visible reasoning and Long context + memory, both known.
- Gives ×3.2 effective compute on a new base (`latent.e` 0.5 OOM, `data/v2/runDesign.ts`).
- Costs: reasoning readable 5% of the time (`monitorability 0.05`). Faithful reasoning keeps it at 98% for ×0.51 effective compute (−0.29 OOM), 75%, ~213 d with 1 team.
- Both are reasoning modes in the run plan (`runDesign.ts` reasoning modes), so a model has one of them.

**Display names** (engine name → shown; **NEW**, the glossary needs them):

| Engine | Shown |
|---|---|
| RL focus: math / SWE / ML research / long tasks / cyber / bio | Focus: Math / Code / AI research / Long tasks / Cyber / Bio (in the Post-training lane) |
| Faithful-CoT architecture | Faithful reasoning |
| Long-horizon human demos | Long-work demos |
| Interp-guided training | Probe-guided training |
| Iterated distillation & amplification | Distil-and-amplify loop |
| Brain-like sample efficiency | Brain-like learning |
| Multi-agent orchestration | Coordinating copies |
| AI kernels / HW co-design | AI-designed kernels |
| Formal verification at scale | Formal verification |
| SAE feature search | Sparse feature search |
| Dev-interp phase detector | Training-phase detector |
| Eval-awareness suppression | Eval-awareness damping |
| CoT monitor | Reasoning monitor |
| Monitorability suite | Reasoning-readability evals (as on Portfolio) |
| Auditing agents | AI auditors (as on Portfolio) |
| Mechanistic anomaly detection | Anomaly detection |
| Harm-probability guardrail | Harm guardrail |
| Automated alignment research / … at scale | AI alignment researchers / AI alignment at scale |
| Honesty & confession training | Honesty training |
| MoE | Mixture of experts |

**Left out of the tree:** the ongoing programmes (Scaling recipes, Data filtering & mixing, …): they live on Portfolio.
Recurrent architectures appears because a discovery opens it.

**NEW for Discoveries:**
- A one-line effect per node in player units (today the node text mixes OOM, codes and notes).
- Time to finish for a node nobody works on yet, at 1 and 2 teams (computed here with `projectEta`).
