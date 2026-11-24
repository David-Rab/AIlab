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
| M5 | **Prices set by competition.** Every seller (player and rivals) prices by the multi-product logit Nash–Bertrand rule: price = cost + μ ÷ (1 − S), S = the seller's total share of the buyers it reaches, across its products. **The margin is per model** (designer, 2026-11-24, MK-6b): each model's margin comes from the bands it wins and the competition there, so the same model costs the same on every rung, a cheaper model passes on its cost saving but keeps the margin where it wins, and small models selling easy tasks (low prices, more competition) carry low margins, as labs price them. Price ≤ the buyer's value per hour, ≥ cost. |
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

As built (MK-6, worldfx/mix.ts): per sector × region each closed seller i has one margin M_i ($ per adopted task-hour),
a stock moving to its target at PRICE_TAU = 30 days; every tier k of its products sells at min(value, c_k + f·M_i)
(f = 1 Best profit, WIN_SHARE_FRACTION = 0.5 Win share; open-weight hosts at 1.2 × cost). Target: the first-order
condition of one margin over all its groups g and bands b, M*_i = Σ q / Σ q·(1 − s)/μ_b with q = w_g·s_gb its hours
(one segment: μ ÷ (1 − s)), capped at the value. μ_b = p̄_b ÷ ε, p̄_b the band's hours-weighted price over all sellers:
the buyers' choice reads yesterday's p̄_b; the target reads p̄_b with every seller at its target (today's shares, solved
by iteration), the same μ at the fixed point, so margins follow costs at PRICE_TAU rather than ≈ 7× slower through the
μ → price → μ loop. Agent-hour price = c_ag × p/c of the tier (≤ wage); seat price = seat serving cost × p/c. ε =
PRICE_ELASTICITY = 1.4 puts the start leader's margin at ≈ 0.86–0.87. A new game starts at the fixed point; a save
from before MK-6 starts at today's cost-plus prices (M = 1.5 × the seller's main-model cost) and moves from there.

As built (MK-6b): the margin is per seller × model (a version id; the same model on several of the player's products
shares one) per sector × region, fx.priceM[r][sector][seller][model]. Target M*_k = Σ q_k / Σ q_k·(1 − s)/μ_b over the
groups and bands model k wins hours in (q_k its hours there; s the seller's total share, so it internalises
cannibalisation between its own models in a band). A model with no hours: the seller's hours-weighted margin per $ of
cost (Σ q_k·M*_k ÷ Σ q_k·c_k) × its own cost; with no stock yet, the same from the seller's stocked margins (Σ M ÷ Σ c),
else 1.5 × its own cost. Tier price = min(value, c_k + f·M_k), ≥ cost. Saves at schema 107 (107 → 108) copy the seller's one M to
each of its models. Finding: in US Software at the start the cheap tiers still win no band (serving.ts TIERS E7 fails):
with μ_b = p̄_b ÷ ε, a seller's cheap tier beats its own frontier model in a band only if SHARE_SLOPE_G·Δfit < (p_0 −
p_k)/μ_b, and with the frontier at its own FOC margin that is at most ≈ 1/(1 − s) + (c_0 − c_k)/μ_b ≈ 1.9 there, below
4 × 0.61 OOM = 2.4 for the mini even at cost. Cheap tiers win only where every seller's cheap tiers are adequate in the
easy band (then p̄_b and μ_b are low: US Services, rivals' minis 12–13% of their hours at M ≈ 0.24 vs 2.1–2.3).

As built (MK-6c, choice.ts `bandMu`): μ_b = c_min,b ÷ ε, c_min,b the lowest serving cost per adopted hour among every
serving provider's tiers in the region (all tiers, whatever a buyer group reaches: the market's μ) that do band b's
tasks adequately (coverage ≥ the band's upper edge, x_b = 1); where none does, the most adequate tier's cost (the
cheapest of those). The same μ in every buyer group's choice, in the MK-7 re-run and in the targets (nashTargets reads
the choice's μ). μ no longer depends on prices, so the band-price fixed point (the iteration, the Aitken step), the
SectorMix `bandPrice` readout and the stored yesterday's band prices `fx.bandP` are gone (save 108 → 109 drops it);
margins still move to their targets at PRICE_TAU, and a new game's initPrices is 8 rounds at 0.6 (≈ 0.1–0.2% off the
fixed point; newGame ≈ 0.2–0.3 s from ≈ 0.5–0.7 s). Since μ is now a cost scale, ε means the price response at the
cheapest adequate cost (own-price elasticity at the Nash margin = 1 ÷ margin): ε = 0.3 (from 1.4) puts the start
leader's hours-weighted margin at 0.81–0.83 (seeds 2027, 7, 42; rivals 0.62–0.69; DeepCent's open weights 0.17) and
start player revenue at $14–16B (MK-6b: $20–26B). Cheap tiers win the easy bands again: at day 20 the API's US Software
hours by tier are 0.81 / 0.09 / 0.09 / 0 (TIERS E7 passes). Finding: a cheap model that does every band collapses the
price scale for all sellers. On the day-369 save Atlas-4.0-mini (cost $0.11/h, adequate on all of US Software) lowers
c_min in bands 3–8 from $0.51–0.72 to $0.11, so margins there fall ≈ 5–7×: adding it to Enterprise now cuts profit
(30 days: revenue 112.3 → 80.5, profit 91.1 → 68.4; MK-6b 119.0 → 195.6, 97.8 → 183.4) though it frees ≈ 1.1M H100e
of need. Open for the designer (MK-CP): whether a seller's own model should set the scale its other models face.

### Capacity (M7)

The Auto serving split stays (most revenue per H100e first). A product whose need exceeds its served compute serves the
hours it can; its unserved buyers re-run the choice without it (the next-best offer among those they reach, or no AI).
One pass, in serving order. The capacity-penalty stock (`capPenalty`, `PENALTY_MAX`) is deleted.

As built (MK-7, worldfx/revenue.ts `ration`, mix.ts `rerunChoice`): every buyer of a short product is served the same
fraction (proportional rationing [D]) of its seats and of its per-hour work. Per sector × region and buyer group (its
hours there by w_g × the group's player share × the product's part) the group's choice is re-run without the product
and without every seller with no room left (the player's products without spare serving compute; MK-8: rivals via
`sellerRoom`, unlimited today); the turned-away hours go to the offers that gain, band by band (shares × Choice.tot, the
share of buyers with any offer they reach), the rest to no AI. A player product with spare compute takes hours into it
only (excess to the cell's other destinations, else no AI). Spilled hours are billed at the receiver's price per adopted
hour; rivals' part is kept in fx.spillRev and added to their market revenue. Chat: free users rate-limited (no share
loss); turned-away subscribers go to the other apps by user share. Customer stock: the player's target becomes
min(choice target, stock × (served + spare hours) ÷ asked hours), the released share to the sellers that took its
buyers. Readout: `turnedAway` (hours, subscribers, $ at list price, by destination) per product and in total, on
ProductRead for MK-13; limit `product.rationed` replaces `product.erosion`.

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
| MK-5b | **Player coverage by group** (MK-5 follow-up): the player's fit, coverage and G per sector (F, g, control) weighted by the player's hours per group and the product each group buys, not its best product everywhere (small buyers cannot use Enterprise's coverage); bandPaid per group | F and g on the day-369 save move only where groups differ |
| MK-5c | **Rest of the best-product readers** (MK-5b follow-up): the player's agent-hours per supervising hour (agentK from the offer's k, λ), the reach target (fBar) and bestPublic still read the best product / max G; weight agentK by what each group buys like MK-5b; decide whether reach and bestPublic should stay max (they describe the best offer on the market, likely correct) | agentK weighted; reach / bestPublic choice documented |
| MK-6 | **Pricing rule** (M5, M6): Nash–Bertrand fixed point per group for all sellers (player and rivals), M = μ ÷ (1 − S), value cap, cost floor, smoothing; stance field (profit / share); seats and agent-hours by the same rule; delete MARKUP / PRICE_TIERS / CHANNEL_PRICE / RIVAL_MARKUP / CHINA_MARKUP | same model on two rungs has one price; cheaper model keeps the margin |
| MK-7 | **Rationing and spillover** (M7): served hours ≤ capacity at the list price; unserved buyers re-run the choice without the product; delete capPenalty | day-296 Enterprise → Atlas-3.0 case: no unserved demand vanishes |
| MK-6b | **Margin per model** (M5 as revised): M per seller × model × sector × region from the first-order condition over the bands and groups that model wins (same harmonic form as MK-6), not one M per seller | cheap tiers win easy bands again (serving TIERS E7); same model one price across rungs; 4.0-mini case keeps profit |
| MK-6c | **Price sensitivity on cost** (designer, 2026-11-24): μ_b = the cost of the cheapest offer adequate for band b ÷ ε (was the band's average price, MK-6), so easy bands price like commodities and cheap tiers win them; hard bands keep the frontier's margin; no μ → price → μ loop | TIERS E7 passes; small models carry lower margins; same model one price |
| MK-8 | **Rival serving capacity** (M11): serving share of their compute, same rationing | rivals capacity-bound in a rig |
| MK-9 | **Per-person plans**: Chat plan price and Enterprise / Vetted **seat** price set competitively per person (share among paid plans / seats), capped at what people / firms pay today (Chat ≈ $22/month; seats: sourced list prices, ≈ $25–60/month), never below the plan's serving cost; replaces MK-6's seat = cost × p/c (≈ $6/month) and the interim CONSUMER_PLAN_FACTOR | plan and seat prices move with share; seat ≈ list price at the start |
| MK-10 | **Tools data** (M9): 12 tools replace FEATURES and sector adaptations; harness effects mapped to ΔG / task share / tokens with §5 sources; certification folded into harnesses (FIN, HEALTH, GOV, MIL); rival tool rule | tool table matches MARKET.md |
| MK-11 | **Tools engine**: Agent mode gates and sells agent-hours (only with it); harness fit and certification act per product; migration of built features / adaptations | agent-hours only on products with Agent mode |
| MK-12 | **Readouts and previews**: product view leads with profit (M12); edit previews true (same function as the tick), incl. buyers taken from own products and rationing; glossary terms | preview = next tick on the day-369 4.0-mini case |
| MK-13 | **Products screen** to the approved mockup: four products, stance switch, profit lead, tools; lineup click-to-swap / remove / add row (M13) | UI test + screenshot checked |
| MK-CP | **Checkpoint**: calibrate ε (margins 0.6–0.9 at mid-2025 shares) and the win-share fraction; start revenue back to the sourced $12–15B (MK-6 gave $20.9B at ε 1.4: ε ≈ 1.6 or the demand side); replay the day-296 / day-369 cases; full tests | margins and shares in range; the five faults gone |

## For the rivals session (found during the market build)

- MK-8: rivals use only ≈ 10–25 % of their serving capacity (start and day 369), so their capacity rarely binds; their
  own over-demand is reported (`sellerCaps.over`) but not rationed.
- MK-8: rival Chat demand is tiny (4–7K H100e at the start, ≈ 0 on day 369): rival chat user shares look low.
- MK-8: rivals serve at the reference serving share (`shareRefAt().serving`), not their own split.
- MK-11: rivals now carry their tools' effects (harness fit, tokens, horizon), which changes their strength.

## Decisions after MK-6c (designer, 2026-11-24)

- "Adding a cheaper model must keep profit" is **not** a requirement. A cheaper model of yours that does the same tasks
  cannibalises your own buyers, as in real markets; the old fault was cost-plus pricing losing money with no
  competition. Day-369 Atlas-4.0-mini case under MK-6c: −$16.8B/yr profit and ≈ 970K H100e of serving freed (worth about
  the same at the rental rate) — a real trade-off the preview shows truthfully. `_mk6` (c) and `_mk6b` (c) expectations
  that the mini keeps profit are to be restated at MK-CP as "preview = outcome", not "profit rises".
- MK-6d (excluding own models from the price-sensitivity anchor) and a separate review sweep: withdrawn.
- Remaining: MK-9 (re-merge), MK-5c, MK-13 (incl. how Win share's later buyer gain is shown), MK-CP. Judge later
  findings against the sourced targets and whether trade-offs are shown honestly, not against "a number went down".
