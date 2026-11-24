# Market, customers and pricing (redesign, 2026-11-24)

Status: designer-agreed direction (conversation 2026-11-24), not built. Branch `market` (worktree `AI27-market`).
Sources: `research/MARKET-sources.md` (cited below as §n of that file). Replaces the playtest fixes PF-4..6 noted on rd.

## Why

Playtests of the day-296 and day-369 saves found five faults, all in the market model, none a tuning issue:

1. **Cost-plus prices.** A product charges its own serving cost × a tier markup. A cheaper-to-serve model lowers the
   price even with no rival near; Atlas-4.0-mini in Enterprise cut revenue $82B → $51B. Standard leaves money on the
   table when ahead (Premium alone: $82B → $115B).
2. **Own products swap buyers.** Same model on two products → buyers jump to the cheaper one (Trusted $39B → $6B when
   Enterprise got Atlas-3.0).
3. **Unserved demand vanishes** instead of going to the buyer's next choice.
4. **Trusted sells to every buyer** at ×3 with no safety package: the dominant strategy when compute-bound.
5. **API, Enterprise and Agents are near-identical sellers**; every sector product sells agent-hours, so Agents owns
   nothing.

## Decisions

| # | Decision |
|---|---|
| M1 | **Four products**: Chat (consumers), API (small firms and developers), Enterprise (large firms), Vetted (government, military, critical infrastructure, large regulated firms). Gov and Trusted merge into Vetted. |
| M2 | **Business buyers in three groups on a ladder.** Each sector-region's business buyers split into small firms, large firms and vetted buyers. A group can buy from its own rung and every rung below: vetted → Vetted, Enterprise, API; large → Enterprise, API; small → API. |
| M3 | **Chat is its own market**, not a rung: per-person plans, mostly free users, valued for personal use. Same pricing rule (M5) for its paid plan. |
| M4 | **Customers stay held by the lab**, the split between the player's products is recomputed daily, as now (designer: once moves make sense, slow per-product stocks only confuse). |
| M5 | **Prices set by competition.** Every seller (player and rivals) prices by the multi-product logit Nash–Bertrand rule: price = cost + μ ÷ (1 − S), S = the seller's total share of the buyers it reaches, across its products. The absolute margin per hour is the same on all of a seller's products, so the same model costs the same on every rung, and a cheaper model passes on its cost saving but keeps the margin. Price ≤ the buyer's value per hour, ≥ cost. |
| M6 | **Price stance** per product, two options: *Best profit* (M5) and *Win share* (a lower margin, a stated fraction of M5's). No price tiers, no exact price override. |
| M7 | **Capacity: rationing at the list price.** A product short of serving compute keeps its price and serves only what its compute allows; the buyers not served fall to their next choice in the same buyer choice (the player's other products or a rival or no AI). No scarcity premium, no capacity penalty stock. §4: labs ration at fixed list prices (rate limits, overload errors, tier caps, staggered rollouts); price premiums are set in advance (priority ×2, batch ×0.5), not to clear. A priority tier is left out unless playtests ask for it. |
| M8 | **Thinking effort removed** (lineup tiers already cover cost vs quality); effort fixed at today's default (max). Multi-agent orchestration (P05) keeps only its internal-research effect. |
| M9 | **Tools merge features, Agents and sector adaptations** (list below). A harness helps a few sectors and carries certification where a sector has one. |
| M10 | **Vetted and safety**: no built-in exemption; the player's safety framework decides what Vetted needs. Vetted counts as an external deployment for commitments. Usage terms (surveillance, autonomous weapons) are Vetted's. |
| M11 | **Rivals** use the same rules in their simplest form: M5 prices on their own cost, a serving capacity (their serving share of compute) with M7 rationing. |
| M12 | **Products screen leads with profit** (revenue − serving cost), then revenue, customers and compute. |
| M13 | **Lineup UI**: click a model in the lineup to swap it or remove it; an "add a model" row under the lineup. No dropdowns. |
| M14 | **Certification follows the harness**: a product is certified in a sector (where the sector has a certification) when it carries a harness covering that sector, after the certification time. Migration: existing certifications move to the harness that covers the sector on that product (Military → Vetted's Defence & intelligence suite). |
| M15 | **Mockup approved** (design/ux/mockups/market/products.png, lineup-swap.png, DATA.md): the card shows the product's average price per hour, prices per model in its tooltip; the business cards' second tile is "Work sold" (hours a year), Chat's is "Users"; the ladder (vetted buyers can also buy Enterprise and API) is in the buyer-group tooltip; model names as the game names them today. |

## The model

### Buyers (M2)

Per sector × region, the business buyers' hours split into three groups by employment (src/data/v2/market.ts):

- L_s the large-firm employment share (§1: US Census SUSB 2022, firms ≥ 500, private employment; rest of world ≈ 0.69 ×
  US, China ≈ 0.38 × US [D]); p_s the public (government-run) share, the same in every region (§2: GOV and MIL 1,
  Healthcare 0.219 = government's share of hospital jobs as a proxy for the sector, others 0); r_s the share of the
  sector's large firms that count as vetted (regulated, critical infrastructure, defence-adjacent) [D, designer
  estimate 2026-11-24].
- largeAll = L_s × regionScale × (1 − p_s), the private large firms,
- **vetted** = p_s + r_s × largeAll,
- **large** = (1 − r_s) × largeAll,
- **small** = 1 − vetted − large.

Vetted so scales with the region's large firms and never exceeds the public plus large-firm share.

| Sector | L_s (US) | p_s | r_s | small | large | vetted (US) |
|---|---|---|---|---|---|---|
| Software & IT | 0.595 | 0 | 0.15 | 0.405 | 0.506 | 0.089 |
| Admin, clerical, customer service | 0.54 | 0 | 0.15 | 0.460 | 0.459 | 0.081 |
| Finance | 0.687 | 0 | 0.5 | 0.313 | 0.344 | 0.344 |
| Legal | 0.192 | 0 | 0.25 | 0.808 | 0.144 | 0.048 |
| Creative, media, marketing | 0.429 | 0 | 0.05 | 0.571 | 0.408 | 0.021 |
| Science & engineering R&D | 0.545 | 0 | 0.35 | 0.455 | 0.354 | 0.191 |
| Healthcare | 0.563 | 0.219 | 0.5 | 0.341 | 0.220 | 0.439 |
| Education | 0.871 | 0 | 0 | 0.129 | 0.871 | 0 |
| Government admin | — | 1 | — | 0 | 0 | 1 |
| Military & defence | ~0.89 | 1 | — | 0 | 0 | 1 |
| Manufacturing | 0.591 | 0 | 0.2 | 0.409 | 0.473 | 0.118 |
| Transport, logistics | 0.668 | 0 | 0.25 | 0.332 | 0.501 | 0.167 |
| Energy, utilities, construction | 0.26 | 0 | 0.5 | 0.740 | 0.130 | 0.130 |
| Retail, hospitality, services | 0.467 | 0 | 0.03 | 0.533 | 0.453 | 0.014 |

Education (designer, 2026-11-24): public schools buy like large firms, not as vetted buyers. L_EDU = public share
0.727 + 0.273 × private large share 0.527 = 0.871 (§1–§2); p_EDU = r_EDU = 0, and L_EDU is not reduced by a public
share (largeAll = 0.871 × regionScale).

Each group runs today's buyer choice (worldfx/choice.ts: bands of task difficulty, surplus V·x − p, quality term,
brand × reach) over the offers it can reach: every rival's offer (rivals sell to every group: M11) and the player's
products on its rungs. The sector's totals (adoption, F, control shares) are the groups' sums, so automation and control
read the same quantities as today.

### Prices (M5, M6)

Per seller and product: p = c + M, M = μ ÷ (1 − S), capped at the value per hour and floored at cost; S = the seller's
share of the hours of the groups the product reaches. μ is calibrated so equilibrium margins match §3: margins of
0.6–0.85 at the leader's ≈ 0.32 share give μ ≈ 0.41–0.58 × price. Demirer et al. (long version, Table 2 p. 37: −1.11,
s.e. 0.22, one model on one host, short run) bound a lab's own-price elasticity from above, so margin ≥ ≈ 0.9 (≥ 0.75 at
one s.e.); the two overlap at margin ≈ 0.8–0.9, μ ≈ 0.55–0.6 × price: the starting value, settled at MK-CP. The
paper's case studies show labs strongly differentiated (new Claude models replaced older Claude, not GPT or Gemini;
multi-model firms put nearly all use on one). Prices move toward
the rule's target daily (a smoothed fixed point; the rule is solved for all sellers together). Win share: M × a stated
fraction [D, e.g. 0.5].

Seats (per-person licences, Enterprise and Vetted) and agent-hours (Agent mode) are priced by the same rule on their own
cost.

### Capacity (M7)

The Auto serving split stays (most revenue per H100e first). A product whose need exceeds its served compute serves the
hours it can; its unserved buyers re-run the choice without it (the next-best offer among those they reach, or no AI).
One pass, in serving order. The capacity-penalty stock (`capPenalty`, `PENALTY_MAX`) is deleted.

### Chat (M3)

Unchanged structure: users choose by quality × brand × access, the paid share is a stock, free users are served last.
Its plan price follows M5 on the paid users (share among paid plans), capped at willingness to pay ($22/month, today's
data), instead of the fixed WTP price.

## Tools (M9)

Harnesses (sector fit bonus, certification where the sector has one: FIN, HEALTH, GOV, MIL today):

| Tool | Analogue | Sectors | Products | Evidence (§5) | Shipped by Jul 2025 |
|---|---|---|---|---|---|
| Coding harness | Claude Code, Codex | Software; Science R&D | API, Enterprise, Vetted | ×1.6 over a plain shell (SWE-agent); +7–9 pp high-compute scaffolds | OpenAI, Anthropic, Google |
| Research agent | Deep research | Science R&D, Finance, Legal | API, Enterprise, Vetted | BrowseComp 0.6 → 1.9 | OpenAI, Anthropic, Google |
| Back-office agent | support / workflow agents | Admin & customer service, Finance, Legal, Government, Education | Enterprise, Vetted | [D] | none |
| Clinical assistant | scribes, decision support | Healthcare | Enterprise, Vetted | MAI-DxO +11 pp | none |
| Operations planner | scheduling, dispatch | Manufacturing, Logistics, Energy, Retail (cognitive part only) | Enterprise, Vetted | LLM-Modulo ×4.6 | none |
| Defence & intelligence suite | Claude Gov | Military, Government | Vetted | [D] | OpenAI, Anthropic, Google (gov offerings) |
| Creative studio | image / video generation | Creative, media, marketing; Chat appeal | Chat, API, Enterprise | multimedia 2% → 7% of ChatGPT messages | OpenAI, Google |

General tools:

| Tool | Products | Effect |
|---|---|---|
| Agent mode | API, Enterprise, Vetted | sells autonomous agent-hours; gate: the model's time horizon ≥ the task length (today's Agents gate) |
| Computer use | API, Enterprise, Vetted | GUI-only tasks (today's enabler); OSWorld +8–12 pp |
| Memory | all four | horizon × 1.3 (today's) |
| Voice & vision | Chat | voice and image input; Chat appeal (designer, MK-11: Chat only) |
| Companion | Chat | Chat appeal, sycophancy risk (today's) |

Rivals have a tool if their lab had shipped it by July 2025, otherwise a lag after the player ships it (today's rule).
Effect sizes map onto today's scaffold / enabler forms (ΔG OOM, tokens ×, task share); the mapping is a build task.

## Removed

Price tiers (budget / standard / premium, `MARKUP`, `PRICE_TIERS`, `CHANNEL_PRICE`), thinking effort, the Agents, Gov
and Trusted channels, sector adaptations as a separate object (folded into harnesses), the capacity penalty, Trusted's
safety exemption. Rival `RIVAL_MARKUP` / `CHINA_MARKUP` (rivals use M5; China's lower prices come from its lower cost).

## Open items for the build

- Save break: four channels replace six; existing products map Gov / Trusted → Vetted, Agents → API with Agent mode.
- μ: start at ≈ 0.55–0.6 × price (MK-R1 done); settle at MK-CP. No source gives the market (total AI use) elasticity:
  the paper says only that it is "substantially smaller" short-run; the sector demand response stays as is.
- Win-share fraction [D].
- Vetted shares are [D] on primary anchors (§2); critical-infrastructure employment has no official figure.
- Which harness effect maps to which engine quantity (ΔG vs task share), per tool.
- Calibration checkpoint after the build (revenue path, margins, shares, adoption).

## Build tasks

Small, single-concern; each: time budget, tsc + its own check; heavy runs only at the checkpoint (MK-CP). Order is the
dependency order; tasks on one line of the same number can run in parallel.

| # | Task | Done when |
|---|---|---|
| MK-R1 | Read Demirer, Fradkin, Tadelis & Peng (NBER w34608) in full: firm vs market elasticity, level; fix μ's basis in research/MARKET-sources.md §3 | μ's source stated with table/page |
| MK-1 | **Channels**: `Channel` = consumer / api / enterprise / vetted (+ internal, open); PRODUCT_DEFS; save migration (Gov, Trusted → Vetted; Agents → API with Agent mode; a second product of the same channel kept as is) | old saves load; tsc |
| MK-2 | **Channel readers**: control.ts Gov effects → Vetted; commitments and framework treat Vetted as external, Trusted exemption gone (M10); ANON_SHARE, CHANNEL_AFFORD, KYC defaults for four channels; bots | tsc; products / safety checks restated |
| MK-3 | **Remove thinking effort** (M8): field, effortTokens / effortDG fixed at max, P05's effort unlock, UI | tsc; P05 still speeds internal research |
| MK-4 | **Buyer groups data**: data/v2/market.ts (L_s, p_s, r_s per sector, regional scaling, Education rule) with sources | values match MARKET.md table |
| MK-5 | **Buyer groups in the choice** (M2): mix.ts runs each sector-region's choice per group over the offers it reaches (ladder); sector totals = group sums; playerProdW per group | totals unchanged with all groups reaching every product (regression check); ladder respected |
| MK-6 | **Pricing rule** (M5, M6): Nash–Bertrand fixed point per group for all sellers (player and rivals), M = μ ÷ (1 − S), value cap, cost floor, smoothing; stance field (profit / share); seats and agent-hours by the same rule; delete MARKUP / PRICE_TIERS / CHANNEL_PRICE / RIVAL_MARKUP / CHINA_MARKUP | same model on two rungs has one price; cheaper model keeps the margin |
| MK-7 | **Rationing and spillover** (M7): served hours ≤ capacity at the list price; unserved buyers re-run the choice without the product; delete capPenalty | day-296 Enterprise → Atlas-3.0 case: no unserved demand vanishes |
| MK-8 | **Rival serving capacity** (M11): serving share of their compute, same rationing | rivals capacity-bound in a rig |
| MK-9 | **Chat plan price** by M5 among paid plans, ≤ WTP | Chat plan price moves with share |
| MK-10 | **Tools data** (M9): 12 tools replace FEATURES and sector adaptations; harness effects mapped to ΔG / task share / tokens with §5 sources; certification folded into harnesses (FIN, HEALTH, GOV, MIL); rival tool rule | tool table matches MARKET.md |
| MK-11 | **Tools engine**: Agent mode gates and sells agent-hours (only with it); harness fit and certification act per product; migration of built features / adaptations | agent-hours only on products with Agent mode |
| MK-12 | **Readouts and previews**: product view leads with profit (M12); edit previews true (same function as the tick), incl. buyers taken from own products and rationing; glossary terms | preview = next tick on the day-369 4.0-mini case |
| MK-13 | **Products screen** to the approved mockup: four products, stance switch, profit lead, tools; lineup click-to-swap / remove / add row (M13) | UI test + screenshot checked |
| MK-CP | **Checkpoint**: calibrate μ (margins 0.6–0.85 at mid-2025 shares) and the win-share fraction; replay the day-296 / day-369 cases; full tests | margins and shares in range; the five faults gone |
