# 15 - Compute supply and lab finance: game-ready spec and real data

Research date: 2026-11-13. Scope: REDESIGN.md §7 (D7) and playtest points 5 ("35% compute cap") and 6 ("money never binds").

**Tags**
- **[P]**: primary document fetched (filing, earnings release, government doc, company newsroom).
- **[P-tx]**: third-party transcript of an earnings call.
- **[P-snip]**: a primary URL, read only through a search snippet.
- **[Epoch]**: Epoch AI data or analysis.
- **[SA]**: SemiAnalysis.
- **[S]**: secondary summary of a primary filing.
- **[U]**: news only, unverified.
- **[mem]**: recalled primary figure not re-fetched this session (unverified).
- **[AI27]**: AI 2027 supplement (see research/02).
- **[D]**: my derivation or fit.
- **[Design]**: a game-design choice with no empirical anchor.

Units: $B, H100e (H100-equivalent, Epoch/AI27 convention), GW of *facility* power unless stated as IT power, quarter = 1 tick.

---

# PART 1 - GAME-READY SPEC

## 1.0 Design goals and what the data says

1. **Supply is elastic but lagged.**
   - Global AI chip production grew 2.5x a year from 2024 to 2026: 0.83M to 6.33M H100e per quarter. Growth is decelerating: about 6x a year in 2023, 2.8x y/y by Q2 2025 and 2.2x by Q2 2026 [Epoch].
   - Packaging (CoWoS) responds in about 4 quarters and roughly doubled each year in 2024 and 2025.
   - HBM is contracted 4-6 quarters ahead. New fabs take 8-12 quarters to build plus 4-8 to ramp [P].
   - TSMC capex lagged the demand shock by about 2 years: flat at ~$30B in 2023-24, $40.9B in 2025, $60-64B in 2026.
2. **Power is a separate, slower constraint.**
   - Chips arrive in 2-4 quarters. A building takes 4-14 quarters. A new grid connection takes 12-24 quarters (median 61 months for projects that reached operation in 2025 [P-snip]).
   - Gas-turbine slots are booked into 2029-2032 [P].
   - In 2026 the binding constraint for hyperscalers was *power/space delivery*, not money. Microsoft's capex miss was attributed to late third-party capacity [P].
3. **Money binds for labs, not hyperscalers.**
   - A frontier lab's equity capacity is roughly 2.5-3x its revenue run-rate per year, and about 5-8% of valuation per round (up to 14% with a strategic anchor).
   - The largest annual raises observed are about $110-130B per lab, in 2026.
   - Everything beyond that comes with strings: compute-for-equity, vendor financing, SPVs and leases, debt at SOFR+400-550bp.
4. **Governance shapes who gives money.** SoftBank cut its $30B OpenAI tranche to $10B unless the recapitalization closed by end-2025 [P]. The Anthropic LTBT phased in its board control by funding milestones [P].

## 1.1 Quarterly tick order (both systems)

```
1  Exogenous: rates path, macro shock rolls, Taiwan/geo rolls, export-control state
2  Hype H and investor pool A update                      (§1.4)
3  Suppliers: capacity pipelines arrive; new expansions ordered from backlog signal  (§1.2)
4  Supply S_t = min(components) x geo factor
5  All actors submit chip orders (qty, prepay, LTA flag) and cloud/lease requests
6  Market: list price P_t, rationing, spot rental price r_t  (§1.2)
7  Deliveries land in inventory -> install into sites with free MW -> online compute  (§1.3)
8  Site projects progress (permits, power, construction); roll delays/blocks
9  Finance: revenue in, opex/commitments/interest out; raises/debt draws close  (§1.5-1.7)
10 Covenant + runway check -> distress state machine  (§1.8)
11 Board update: composition, confidence, pending approvals  (§1.6)
```

## 1.2 Global chip market

### State (global)
| Var | Meaning | Start (Q4 2026) | Source |
|---|---|---|---|
| `K_pkg` | Advanced-packaging capacity (CoWoS-class), in H100e/q | 8.0M | [D] from Epoch 6.33M H100e/q in Q2 2026 at 2.2x/yr, with packaging "limiting customers' growth" (TSMC, Jul 2026) |
| `K_hbm` | HBM capacity, in H100e/q | 8.5M | [D] HBM sold out through 2026-27 but not named as *the* binding limit |
| `K_wafer` | Leading-edge wafer capacity *available to AI*, in H100e/q | 12M | [D] AI27: AI share of N5/N3 ≤3% in 2023, max ~40% by 2027. Wafers bind around 2028 |
| `pipe_i[k]` | Capacity under construction for component i, arriving in k quarters | see L_i | — |
| `c_t` | Base production cost per H100e (chip + server, ex-facility) | $4.0K | [D] from P_list / μ |
| `μ` | Supplier markup multiple | 3.8 | [P] Nvidia gross margin 72-75%, so price ≈ 3.6-4x cost of goods |
| `P_t` | List price per H100e (server installed, ex-facility) | $15K | [D] Epoch: $21.2B of servers per GW of IT power, at ~1.43M H100e/GW (0.7 kW/H100e, AI27) |
| `r_t` | Spot/1-yr rental, $/H100e-hour | $1.6 | [D] H100 1-yr contract $2.35/h in Mar 2026 [SA], deflated by the H100e content of newer chips |
| `geo_TW` | Share of supply routed through Taiwan fabs and packaging | 0.93 | [D]: all Nvidia, TPU, Trainium and AMD accelerators are fabbed at TSMC; Arizona N3 starts 2H27 [P] |

### Supply
```
S_t = min(K_pkg, K_hbm, K_wafer) * (1 - geo_TW * disrupt_TW_t) * (1 - disrupt_KR_t * 0.9 * hbm_dependency)
```
- Show the binding component in the UI: "Global supply bound by: packaging".
- `disrupt_*` ∈ [0,1] (§1.2.5).

### Capacity expansion (lagged, demand-driven)
Each component i has a lag `L_i` (quarters from decision to output), a maximum annual growth `gmax_i`, and a floor `gmin_i`.

Backlog signal, smoothed by an EWMA so one hot quarter doesn't trigger a fab:
```
B_t = EWMA_0.5( (orders_unfilled_t + firm_LTA_next4q_t / 4) / S_t )
```

Each quarter, each supplier orders new capacity to arrive at t+L_i:
```
g_ann_i = clamp( g0_i + β_i * (B_t - 1), gmin_i, gmax_i )
Δ_i     = K_i(t+L_i, already piped) * (g_ann_i^(1/4) - 1)
```
- **Cumulative-demand memory.** Suppliers trust sustained demand. Use `β_i_eff = β_i * min(1, CumOrders_8q / CumOrders_8q_ref)`, which reproduces TSMC's 2-year capex lag [P]. After a bust, β_eff collapses and capacity already in the pipe still lands, producing a glut.
- **Fast lever (wafers only).** Node conversion (e.g. N5 tools to N3) adds up to +10% K_wafer with L = 3, once per 4 quarters [P].

| Component | L_i (q) | g0 | β | gmin | gmax (/yr) | Calibration |
|---|---|---|---|---|---|---|
| Packaging (CoWoS) | 4 | 1.3 | 1.5 | 1.0 | 2.5 | "More than double" in 2024 and again in 2025 [U]. 2026 "racing to triple" against ~80%/yr demand growth [P-tx] |
| HBM | 6 (new line); 12 (new fab) | 1.3 | 1.0 | 1.0 | 2.0 | Micron 2026 HBM fully booked by Dec 2025, most of 2027 by Sep 2026 [U]. SK hynix LTAs cover more than half of 2027-28 [U]. Micron ID1 slipped to mid-2027; NY fab breaks ground 2026 with output by 2030 [P-tx] |
| Leading-edge wafer (AI share) | 12 build + 4 ramp (output ramps linearly over the ramp) | 1.15 | 0.5 | 1.0 | 1.35 | Wei: "2-3 years to build a new fab… another 1-2 years to ramp"; 2026 capex adds ~0 to 2026 output [P]. AI27: wafer growth ~1.25x/yr after 2027 |

**Target.** With default rival demand, global production should be ~25M H100e in 2026, 45-60M in 2027 (AI27: 60M) and ~1.6-1.7x/yr after 2028 (AI27 extension) [AI27][Epoch].

### Price

**List price.** Sticky, contract-based, and updated once per quarter:
```
floor_t = μ * c_t           ;  c_t falls 8%/q  (performance per $ +40%/yr; Epoch measured +49%/yr spend-weighted 2023-25)
P_t     = floor_t * (1 + π_t)
π_t     = clamp( π_{t-1} + 0.5 * ((D_t / S_t) - 1) - 0.25 * π_{t-1}, -0.25, 1.5 )
```
- `D_t` is the sum of all orders for delivery this quarter.
- Glut gives π < 0: suppliers discount down to 0.75 × floor.

**Spot / short-term rental.** Volatile:
```
r_t = r_base_t * (D_t / S_t)^0.8 ,   r_base_t = (annualized owned TCO_t * 1.6) / 8760
```
- Calibration: H100 rental fell from $7-10/h (2023, D/S ≈ 3) to $1.70/h (1-yr, Oct 2025) [U][SA].
- It then rose 40% to $2.35/h (Mar 2026) when demand outran supply (D/S ≈ 1.5 gives 1.38x) [SA].

**Rationing when D > S.** Each buyer gets `S * w_i q_i / Σ w_j q_j`, with:
```
w_i = 1 + 0.5*LTA_i + 0.5*prepay_frac_i + 0.5*strategic_tie_i + 0.3*track_record_i
```
- `LTA` = long-term agreement signed at least 4 quarters earlier.
- `strategic_tie` = the supplier holds your equity or you hold its warrants (Nvidia, AMD deals).
- Unfilled orders roll forward and stay in the backlog signal B.

### Player chip actions
| Action | Cash | Delivery | Notes |
|---|---|---|---|
| Spot order | 100% on delivery at P_t × (1 + 0.5π_t) | Next quarter if allocated, else roll | Weight w = 1 |
| Standard order | 30% deposit, 70% on delivery, at P_t | 2 quarters | Nvidia supply/capacity obligations reach 2-3 fiscal years out ($279B in Jul 2026) [P] |
| Long-term agreement (LTA), 4-12 quarters | Prices fixed at P_t × 0.95; take-or-pay | Scheduled | Becomes a *commitment* in the finance ledger. Raises w from 4 quarters on |
| Funding a supplier's expansion | Pay $X now | Adds capacity to that component's pipeline | Reserved share of it for you. Costs about $1.0B per +100k H100e/q of packaging [Design]. Lets the player "grow the pie" (TSMC/Micron LTAs with prepayments [U]) |
| Cloud contract (rent) | Opex at 1.6 × owned TCO per H100e-year, take-or-pay over 1-5 years | 1-2 quarters, no MW needed | Capacity comes from neocloud/hyperscaler pools, which compete in the same chip market |
| Spot rental | r_t × hours | Immediate, capped at 10% of global rental pool | For emergencies |

**Owned TCO per H100e-year** [D]:
- Capex (P + facility share) ÷ 4-year life
- plus power (0.7 kW × 8,760 h × $0.083)
- plus O&M at 3% of capex
- plus cost of capital × capex

At Q4 2026 this is about $8-9K, against AI27's derived ~$7.5K for 2026. Cloud ≈ $13-14K.

### Geopolitics in the chip market
- **Taiwan quarantine/blockade.**
  - Base probability 0.25% per quarter [Design]. Multiply by `(1 + 4 * USChinaTension)` and by `(1 + 2 * AIRaceSalience)`; cap at 3% per quarter.
  - Effect: `disrupt_TW` = 0.8-1.0 for 4-12 quarters. List price π jumps to the cap. Spot follows D/S.
  - Chips in transit (one quarter of deliveries) are lost.
  - `geo_TW` falls linearly: 0.93 (2026) → 0.85 (2028) → 0.75 (2030) [D]. Basis: Arizona Fab 2 N3 in 2H27, Fab 3 N2 by end-decade, the first US packaging fab started 2026 [P], and SIA's projection of US advanced-logic share at 28% by 2032 [P].
  - Player can pre-buy "non-Taiwan allocation" at +30% price; supply of it = (1 - geo_TW) × S.
- **Korea (HBM).** 0.1% per quarter [Design]. `disrupt_KR` hits K_hbm only.
- **Export controls.** China's share of global supply = `x_CN` and is policy-set:

  | Policy state | x_CN | Effective performance factor | Real anchor |
  |---|---|---|---|
  | Strict (H20 licensing) | 0-2% | 0.3 | Nvidia China data-center revenue near 0 by Q2 FY27 [P]; H20 license requirement from 9 Apr 2025 with a $4.5B charge [P] |
  | Case-by-case H200 | ≤8% | 0.6 | BIS 15 Jan 2026 (91 FR 1684), license review moved to case-by-case [P] |
  | Open | Market share | 1.0 | Pre-Oct 2022 |

  - Add domestic Chinese supply (Huawei/Cambricon) at about 3-4% of global compute sold in Q2 2026 [Epoch], growing per research/10.
  - Smuggling leak: 0.5-2% of S [Design].

## 1.3 Power and datacenters

Chips are useless until **installed** in a **site** with free MW. Delivered but uninstalled chips sit in inventory: they depreciate at 6%/q and produce no compute.

```
MW_needed = H100e_online * kW_per_H100e(t)       // facility kW, includes cooling (PUE)
kW_per_H100e(t) = 0.70 * 0.944^(q since Q4 2026)  // 1.26x/yr efficiency; AI27 0.70 kW (2026) -> 0.55 (2027)
install lag = 1 quarter (CoreWeave ~3 months; Epoch: sale-to-operation 1-2 quarters)
```

### Site projects
A site has: power path, capacity MW, construction lag, cost, status (`permitting → power → building → live`), and a risk profile.

| Power path | Lead time (q) | Max size | Facility capex | Power cost | Risk | Anchors |
|---|---|---|---|---|---|---|
| Lease / colocation from a neocloud or hyperscaler | 1-3 | Limited by global lease pool | 0 (pay lease ≈ 12%/yr of $11.4B/GW) | Pass-through | Counterparty | Microsoft leases not yet commenced: $92.7B (Jun 2025) [U] → $364.6B (Sep 2026) [P-snip] |
| Brownfield / existing interconnect | 4-8 | 0.3-1 GW | $11.4B/GW IT | Grid tariff 8.3¢/kWh | Low | Epoch cost model [Epoch] |
| On-site gas (behind the meter) | 6-12 with aero/recip units; 16-24 with new heavy-duty turbines | 0.5-2.5 GW | +$1.5-2.5B/GW for generation [Design, unverified] | ~1.3× grid | Permits, emissions | GE Vernova taking reservations for 2031-32 delivery [U]; backlog plus reservations 122 GW, ~5 GW shipped/q [P]. Stargate sites "rely on on-site gas" [Epoch] |
| New grid interconnection | 12-24 (draw from a triangular distribution, mode 16) | 1-5 GW | $11.4B/GW + utility upgrades | Grid | Queue, capacity prices | LBNL: median 61 months request-to-operation in 2025 [P-snip]. ERCOT large-load queue 63 GW (end-2024) → ~474 GW (Jul 2026) [P-snip] |
| Nuclear restart or uprate | 12-20 | 0.4-1 GW | High | Low | Regulatory | [Design] (no data gathered) |

**Construction lag** once power is assured:

| Build speed | Lag | Anchors |
|---|---|---|
| Default | 8 quarters | Epoch: construction start to 1 GW takes 1.0-3.6 years, median about 2 [Epoch] |
| "Crash build" | 4 quarters, at +35% facility capex and +20% block risk | xAI: Colossus 2 to ~1 GW in ~12 months; Colossus 1 in 122 days [Epoch] |
| Normal hyperscaler | 12-14 quarters | Microsoft Fayetteville 3.0 years; Fairwater 3.6 years [Epoch] |

**Equipment gate.** Each GW needs transformers from a global pool. Lead time 8-10 quarters, from an average of 120-128 weeks [P-snip][U]. A player can pre-order transformers or turbines years ahead: deposit 20%, with the slot transferable or sellable [Design].

**Local opposition.** Each site rolls once at the permitting stage:
```
p_block = 0.05 + 0.10 * AntiAIPublic + 0.05 * [gas] + 0.05 * [crash build]
p_delay = 0.20 + 0.20 * AntiAIPublic        // delay 1-3 quarters
```
- Calibration: Data Center Watch counted $64B blocked or delayed in May 2024-Mar 2025 ($18B blocked, $46B delayed) [P]. In Q2 2026 alone it counted ≥45 projects worth ~$68B [P].
- Ties to research/07 public meters.
- Mitigation actions: a community benefits package (+cost, −p_block), siting in friendly states, and power self-supply with a "pay your own way" pledge.

**Global power pool (US).** New AI-usable grid capacity for large loads is about 2.0 GW/q in 2026, growing 1.25x/yr [D]. Basis: AI27 US AI power 7 → 50 GW over 2024-27; Epoch puts the US at ~5 GW now and 20-30 GW by late 2027.
- All actors' grid projects draw from this pool by queue position.
- If the pool is exhausted, a project's power date slips one quarter.
- PJM's 2027/28 and 2028/29 capacity auctions cleared at the cap: $333 and $325/MW-day, 6.6-6.8 GW short [P-snip]. Model this as **regional capacity price** `κ_region` that adds 0-15% to power opex when tight.

**Facility cost per GW of IT power** (Epoch, 14 May 2026) [Epoch]:

| Item | Cost |
|---|---|
| Servers | $21.2B |
| Network | $4.9B |
| Facility | $11.4B |
| Land and utility works | $0.33B |
| **Total** | **$37.9B** |

Power at 8.34¢/kWh is $0.59B/yr. Game rule: facility $11.4B per GW of IT power (≈$10B per GW of facility power) and a life of 14 years [Epoch].

## 1.4 Investor appetite pool

There is a global pool of equity money willing to go into frontier-AI *labs* each quarter (private rounds plus IPOs). Hyperscalers fund themselves from operating cash flow and bonds and are outside this pool.

```
A_t (annualized, $B) = κ * R_sector_t * H_t * M_t * W_t
  κ        = 4.0                         // [D] fit: 2024 ~$30B on ~$4.5B sector run-rate (κH≈6.7); 2025 ~$75B on ~$20B (≈3.8); 2026 ~$350B+ on ~$90B avg (≈4)
  R_sector = sum of private frontier-lab revenue run-rates (exclude hyperscaler in-house labs)
  H_t      = hype, mean 1, range [0.3, 2.5]
  M_t      = exp(-0.12 * (y10_t - 4.5))  // 10y Treasury; Nov 2026 y10 = 4.98% -> M = 0.94
  W_t      = 1 + 0.5*[IPO window open]   // first IPOs unlock a one-time public pool (SpaceX $86B, Anthropic ~$56-62B, 2026)
```

**Hype dynamics:**
```
H_{t+1} = 1 + 0.85 (H_t - 1)
          + 0.15 * frontier_surprise_t         // benchmark/capability jump vs. expectation (-1..+2)
          + 0.10 * (g_sector_t - 3) / 3        // sector revenue growth multiple vs. 3x/yr norm
          - Σ shocks_t
```

**Shocks:**

| Event | ΔH | Half-life | Anchor |
|---|---|---|---|
| Cheap rival or open model ("DeepSeek moment") | −0.15 to −0.25 | 1 quarter | Nvidia −17% (≈ −$589B) on 27 Jan 2025 [mem]. OpenAI's $40B round still signed 31 Mar 2025 [P], so the effect is short-lived |
| Financing-doubt selloff | −0.15 to −0.3 | 2 quarters | 5 Nov 2026: Nasdaq −4 to −5.5%, Nvidia about −9% [U]. OpenAI's new round reportedly first-closed at $1.25T against a $1.5T ask [U] |
| Major AI incident (public harm) | −0.1 to −0.4 | 2-3 quarters | [Design]. Scale by severity (research/07) |
| Sector bust | −0.6 | 4 quarters | [Design]. See bubble risk |
| Rate shock (y10 +100bp) | via M: −11% pool | — | [D] duration-style |

**Bubble risk (endogenous).** The sector can become over-extended:
```
X_t   = (sector compute commitments due next 4q + sector capex) / R_sector
p_bust = 0.005 + 0.02 * max(0, X_t - 3)     per quarter, cap 0.12
```
In 2026, labs' forward compute commitments run at roughly 5-10x revenue: Anthropic disclosed ~$637B of commitments against ~$46-65B run-rate [S], and OpenAI claimed ~$1.4T over 8 years [mem]. This gives p ≈ 5-10%/q, consistent with the Nov 2026 selloff.

**Lab share of the pool:**
```
share_i = (V_i^0.5 * momentum_i * gov_i) / Σ_j (...)
  momentum_i = clamp(R_i / R_i(t-4), 0.5, 8)^0.5
  gov_i      = governance attractiveness (§1.6)
```
Unused appetite carries over at 50% per quarter.

## 1.5 Valuation and equity raises

**Valuation** (post-money, before the round):
```
V_i = m_i * R_i
m_i = 22 * (g_i / 5)^0.4 * (R_i / $20B)^-0.15 * H_t * N_i * M_t
  g_i = clamp(R_i / R_i(t-4), 0.5, 8)
  N_i = lab narrative premium [0.6, 2.2]: leader/brand/users; OpenAI-like ~1.5-2.0, Anthropic-like ~1.0
```

Fit against Anthropic rounds [P] [D]:

| Round | Run-rate | Fitted multiple | Actual multiple |
|---|---|---|---|
| Series F | $5B | 35.7x | 37x |
| Series G | $14B | 29x | 27x |
| Series H | $47B (g capped at 8) | 23x | 20.5x |

OpenAI Nov 2026, at about $1.25T on $50-70B: N ≈ 1.1-1.3 [U].

**Raise ceiling.** Taken as the minimum of four limits:
```
Raise_max = min(
   share_i * A_t * 1.0,                       // what the pool will give you this quarter
   d_max * V_post,                            // dilution tolerance per round
   k_Y(R_i) * R_i - Raised_last_4q,           // annual cap vs revenue
   ask )
  d_max = 0.08 (financial investors); 0.14 with a strategic anchor taking >= 40% of the round; 0.05 for an IPO
  k_Y(R) = 5 * (R / $10B)^-0.4                // R=$10B -> 5.0x ; R=$50B -> 2.6x ; R=$150B -> 1.7x
```

Calibration against real raises [P][S][D]:

| Lab, period | Round dilution | Raised vs run-rate |
|---|---|---|
| Anthropic E/F/G/H | 5.7% / 7.1% / 7.9% / 6.7% | — |
| xAI Series E | ~8.7% [U] | — |
| OpenAI SoftBank round (2025) | ~13% | — |
| OpenAI Mar 2026 round | ~14.3% | ~5x run-rate, but $110B of $122B from Amazon, Nvidia and SoftBank |
| Anthropic IPO | ~4-5% | — |
| Anthropic 2026 total | — | ≈ $155B on $47-65B ≈ 2.5-3x |
| OpenAI 2026 total | — | ≈ $133B on ~$40-60B ≈ 2.5-3x |

**Closing mechanics.**
- A round takes 1 quarter to close. Minimum gap between priced rounds: 1 quarter.
- Asking above Raise_max is allowed: valuation is discounted by `0.5 * (ask / Raise_max - 1)` and the round closes with probability `exp(-(ask / Raise_max - 1))`.
- Headline ≠ cash. Large rounds arrive in tranches: 40-60% at close, the rest on conditions such as IPO, milestone, governance change or GW deployed.
  - Anthropic Series H was $65B headline, but the S-1 shows $45.7B of H-1 cash in May-Jun [S].
  - Amazon's $50B in OpenAI was $15B up front and $35B conditional [U].
  - SoftBank's $30B tranche was conditional on the recapitalization [P].
- Conditional tranches are lost if their condition fails by the deadline.

**Down round** (V_new < V_last):
- Board confidence −15.
- Staff retention −5% of senior researchers (research/07 talent).
- Anti-dilution: prior investors receive extra shares equal to 20% of the value gap [Design].

**Dilution bookkeeping.** Track `own_founder`, `own_mission` (trust or foundation), `own_fin` (financial investors), `own_strat[k]` (each strategic) and `own_public`. A new round issues `Raise / V_post` of the company pro-rata from all holders.

## 1.6 Governance and board

**Presets** (choose at setup; changing later is a 4-6 quarter project):

| Preset | Real analog | Board control | Safety lever | Effect on capital | Override path |
|---|---|---|---|---|---|
| Nonprofit-controlled PBC | OpenAI after 28 Oct 2025 | Foundation appoints and removes all PBC directors. At least 2 nonprofit directors must be off the PBC board within 1 year [P] | Nonprofit Safety and Security Committee can **halt releases** [P]. AG gets advance notice of governance changes [P] | gov = 0.9 | Requires AG review (a full recapitalization took ~4 quarters, 9 Oct 2024 → 28 Oct 2025) [P] |
| Legacy capped-profit nonprofit | OpenAI 2019-2025 | Nonprofit board can fire the CEO | Very strong but brittle: in Nov 2023 the CEO was fired and reinstated within about 5 days under employee and investor pressure [mem] | gov = 0.6. Big rounds come conditional on restructuring (SoftBank: $30B → $10B if not recapitalized by end-2025 [P]) | Employee revolt event |
| PBC + Long-Term Benefit Trust | Anthropic | Class T elects 4 of 7 directors (phased in by time and by $5-6B raised) [P]. After IPO, founders' Class F holds 50.1% of votes; public Class A is capped at 49.9% [S] | Trust gets 5-day notice before transfer of control of a "capability-threshold model", new debt or liens, sale of ≥50% of votes, or bankruptcy [P] | gov = 1.0 | Change requires 75% of the board plus a 75-85% stockholder supermajority [P]. Strategics hold non-voting Class N, capped (Amazon 12%, Google 14.99%) [S] |
| Founder-controlled corp | xAI (in SpaceX), Meta | Founder | None formal | gov = 1.1 for growth investors, 0.8 for "responsible" money | — |

**Board seats.** 5-9 seats, each with a stance vector: `speed` (accelerate capability and release), `fin` (financial prudence: dislikes debt and burn), `safety` (caution), `mission` (weight on charter purpose).

| Seat type | speed | fin | safety | mission | How gained |
|---|---|---|---|---|---|
| Founder/CEO | player | player | player | player | Fixed |
| Mission (trust/foundation) | −0.5 | +0.3 | +1.0 | +1.0 | Per preset |
| Financial investor | +1.0 | +0.6 | −0.2 | 0 | Founder-corp preset: 1 seat each time `own_fin` crosses 15/30/45% |
| Strategic (or observer) | +0.5 | 0 | 0 | 0, plus self-interest | Large strategic deals give an observer or seat. **Vetoes deals with that strategic's competitors** |
| Independent | 0 | +0.5 | +0.3 | +0.3 | Added at IPO (listing rules) |

**Major decisions** need board approval:

| Decision | Action vector |
|---|---|
| Pause or slow frontier training >1 quarter | (−1, 0, +1, +0.5) |
| Decline a top-3 revenue deployment | (−0.5, −0.5, +0.5, +0.3) |
| New debt >20% of annual revenue | (+0.3, −1, 0, 0) |
| Commitments >3x revenue | (+0.5, −1, 0, 0) |
| Equity raise >10% dilution | (+0.3, 0, 0, −0.2) |
| Releasing a model flagged by safety | (+1, +0.3, −1, −0.5) |
| Sale of control | (0, 0, 0, −1) |

```
support = Σ_seats vote_weight * (stance · action_vector)
P(approve) = sigmoid(support / 0.5)
```
- The safety committee or trust veto (presets 1-3) applies separately on release decisions.

**Board confidence** `BC` (0-100):
- +5 per quarter at or above revenue plan.
- −10 for a missed plan.
- −15 for a down round.
- −10 to −30 for an incident.
- −20 for a covenant breach.

**CEO ouster roll** when `BC < 25`: p = 0.15/q, × 2 under the legacy nonprofit preset. Ouster means game over, or an "ousted → reinstated" event chain if staff loyalty is >70 (Nov 2023 precedent).

**Risk-appetite drift.** As `own_fin + own_strat` rises, board speed-stance weight rises. This is the cost of dilution the player feels: each 10 points of outside ownership adds about +0.1 to the board's aggregate `speed` and `fin` [Design].

## 1.7 Strategic partnerships, vendor finance, debt

**Deal templates.** Rivals compete for the same partners; each partner can anchor at most one lab at a time, or two with friction.

| Template | You get | You give / strings | Real anchors |
|---|---|---|---|
| **Hyperscaler compute-for-equity** | Equity E = $5-15B per tranche at current V, as non-voting stock capped at 12-15%. Priority compute (w + 0.5) | Commitment C = 4-12 × E of partner cloud over 5-10 years (take-or-pay). "Primary training partner": train on the partner's ASIC. Possible revenue share and IP rights | Amazon→Anthropic: $8B (2024), then $5B plus up to $20B against a >$100B AWS commitment over 10 years, up to 5 GW [P]. Microsoft→OpenAI: ~27% stake, +$250B Azure commitment, IP rights to 2032, revenue share until an expert panel verifies AGI [P]. Microsoft $5B and Nvidia $10B against Anthropic's $30B Azure commitment [P]. Google→Anthropic: up to 1M TPUs, >1 GW in 2026 [P] |
| **Custom-ASIC path** (TPU, Trainium) | Performance per $ 2-5x an H100 at procurement cost (Epoch Q4 2025: TPU v6e 5.9, Trainium2 4.4, GB300 2.3; H100 = 1) [Epoch]. Separate supply pool | Migration: −15% research efficiency for 2-3 quarters [Design]. Locked to one vendor | Google 25% and Amazon 5% of compute sold in Q2 2026; Nvidia 63% [Epoch]. TPU shipments doubled q/q to ~2M H100e in Broadcom FQ3'26 [Epoch]. Rainier: ~500k Trainium2, built in <1 year [P] |
| **Chip-vendor equity** | Nvidia-style: vendor invests up to $10B per GW deployed of its chips [P-snip]. AMD-style: **you** receive vendor warrants (160M AMD shares vesting by GW and AMD share-price targets) [P] | Buy N GW of that vendor's systems | Nvidia's actual 2026 cash was $30B in OpenAI's March round [P-snip] |
| **Vendor financing** | Supplier lends to fund your rent to it (convertible notes) | Debt-like, converts at IPO, counts as a commitment | Broadcom up to $42B to fund Anthropic's TPU lease rent. Amazon $15B and Google $20B conditional note facilities [S] |
| **Sovereign / Gulf** | Large equity checks (MGX, QIA, GIC) | Build a site in-country (UAE "enhanced favorable treatment", 91 FR 43034 [P]). USG scrutiny −, weight-security risk +, China-hawk Congress − | MGX in Stargate, OpenAI's 2026 round, Anthropic Series G and xAI Series E [P] |
| **Project-finance SPV / JV** | Outside capital funds 80% of a site's cost | Lease of 4 years plus extensions. **Residual value guarantee** = contingent liability, called if you walk away | Meta–Blue Owl Hyperion: ~$27B, 80/20, 4-year lease plus 16-year residual value guarantee [P] |
| **Neocloud take-or-pay** | Compute in 1-2 quarters, no capex | Multi-year non-cancellable. Neocloud borrows against your contract | CoreWeave delayed-draw loans secured by an OpenAI contract at SOFR+400, then SOFR+550 a year later [P] |
| **Mega-JV ("Stargate")** | Partners fund the build | You share control of the sites | $500B over 4 years; SoftBank financial, OpenAI operational [P] |

**Debt instruments:**

| Instrument | Size limit | Rate | Covenants | Anchor |
|---|---|---|---|---|
| Revolver | ≤ min(0.33 × R, $15B) | SOFR + 150-250bp [Design] | Liquidity ≥ max($1B, 0.11 × R) at each quarter end | Anthropic $15B to 2031 with ≥$5B liquidity covenant [S]. OpenAI $4B (2024) [mem] |
| GPU-backed term loan | Loan-to-value 50-70% of chip book value | SOFR + 400-550bp | Collateral test: if chip value (falls with P_t and depreciation) < 1.2 × loan → cash sweep | CoreWeave DDTL 3.0 / 5.5 [P] |
| Corporate bonds (only R > $50B or public) | ≤ 1 × R | y10 + spread(rating) | Incurrence covenants | Oracle $18B (Sep 2025, 4.45-6.10%) and $25B (Feb 2026, up to 6.85%) [P] |

**Rating** from score `z`:
```
z = 2*[op. cash flow > 0] + min(2, contracted_backlog / debt) - (Debt + PV(commitments)*0.3) / R - 2*[distress]
z >= 2     -> BBB  (y10 + 100-150bp)
1 <= z < 2 -> BB   (SOFR + 400-550bp)
0 <= z < 1 -> B    (SOFR + 650-850bp)
z < 0      -> market closed except rescue capital
```
- Spreads widen with the *sector* as well: add +100bp × max(0, X_t − 3)/3 (CoreWeave +150bp in a year; Oracle's 30-year coupon rose from 5.95% to 6.70% in 5 months) [P].
- Rates path: fed funds 3.75-4.00% after the +25bp hike on 17 Sep 2026; y10 4.98% (10 Nov 2026) [P]. Game: y10 random walk σ = 25bp/q, mean-reverting to 4.5%.

## 1.8 Cash flow, commitments, insolvency

**Quarterly cash flow:**
```
Cash' = Cash + Revenue - Payroll - InferenceCompute - CloudCommitments_due - Power&O&M
        - ChipPayments - SiteCapex - Interest - Principal - LeasePayments
        + EquityTranches + DebtDraws + VendorNotes
```

**Commitment ledger** (each entry: payee, $/q schedule, end date, cancellable notice in quarters, penalty):
- Anthropic's S-1 shows the structure: ~$637B of compute commitments, ~$431B of it minimum and ~$206B "up to" [S].
- By provider: Broadcom TPU leases $161B (non-cancellable); SpaceX/xAI GPUs up to $120.5B, **cancellable on 90 days' notice** [S].
- Mix cancellable and non-cancellable deliberately; it is a key player trade-off.

**Runway:**
```
Runway_q = (Cash + undrawn revolver + firm tranches due next 2q)
           / max(ε, Burn_ex_commitments + NonCancellableCommitments_next4q/4 - ContractedRevenue/4)
```

| State | Trigger | Effects | Player options |
|---|---|---|---|
| Healthy | Runway ≥ 6 | — | — |
| Tight | 3 ≤ Runway < 6 | Pool share ×0.8. Rating −1 notch. Board confidence −5/q | Cut capex, slow hiring, sell spot capacity |
| Distress | Runway < 3, **or** covenant breach | Revolver frozen. Spreads +300bp. Only rescue capital: down round at V × 0.5-0.7, strategic rescue, sale of compute. Talent attrition | (a) Down round. (b) **Strategic rescue**: a partner injects cash for control (seat majority, IP license, exclusivity; mirrors Microsoft-style IP rights). (c) Renegotiate commitments: suppliers accept 25-50% deferral for +warrants. (d) Sell or sublease chips at spot r_t. (e) Cancel cancellable contracts (pay notice) |
| Insolvent | Cash < 0 after all options | **Company loss** (game over), or acquisition by the rescuer, who takes your models; player continues as a "division" in a hard mode [Design] | — |

Rivals use the same rules, so a bust can bankrupt an over-committed rival. Its chips then flood the spot market (π < 0) and its staff become hireable.

## 1.9 Calibration targets (engine tests)

| # | Target | Value | Tolerance | Source |
|---|---|---|---|---|
| C1 | Global production 2026 | ~25M H100e (Q2 2026 6.33M/q) | ±20% | [Epoch][AI27] |
| C2 | Global production 2027, default demand | 45-60M H100e | — | [AI27] 60M; Epoch trend 2.2x |
| C3 | Lag: a +50% demand shock in quarter t raises supply growth from t+4 (packaging) and peaks at t+6 to t+8 | — | — | CoWoS doubled in 2024 after the 2023 shock [U]; TSMC capex lag ~2 years [P] |
| C4 | Spot price under D/S = 1.5 | +35-45% within 2 quarters | — | Oct 2025 → Mar 2026 H100: +40% [SA] |
| C5 | Spot price when supply overtakes demand for 6-8 quarters | −60 to −80% | — | H100 $7-10 → ~$1.70-2.35/h over 2023-25 [U][SA] |
| C6 | Supplier markup steady through booms | Implied gross margin 70-75% | — | Nvidia 72-75% [P] |
| C7 | AI27 OpenBrain 2026 | Revenue $45B, capex $200B, compute costs $40B/yr, 6 GW peak, valuation ~$1-3T | — | [AI27] |
| C8 | **Money binds for C7** | Equity ceiling for a $45B lab ≈ k_Y × R = 2.6 × 45 ≈ $120B/yr. Funding $200B capex + $40B compute + payroll therefore **requires** ≥1 strategic deal (~$40B) **and** ~$50-60B of SPV/lease/neocloud financing | The passive AI27 bot must reach C7 with exactly these defaults. A bot trying **2× AI27 capex** must hit Distress by 2027 unless it takes a rescue | [D] |
| C9 | Real 2026 lead lab | Anthropic: H1 revenue $16.3B; financing inflow $110.8B; operating cash flow +$3.9B; commitments ~$637B [S]. OpenAI: $122B round at $852B [P-snip] | Order of magnitude | [S][P-snip] |
| C10 | Hyperscaler capex 2026 (exogenous rivals' budget) | ~$810-835B, 5 firms | ±15% | [P] (table 2.4) |
| C11 | Valuation multiple | 20-37x run-rate at g = 5-10x; ~15-20x at g ≈ 2-3x | — | [P][D] |
| C12 | Round dilution | 5-8% typical; ≤14% with strategic anchor; IPO 4-5% | — | [P][S] |
| C13 | A financing-doubt shock | Cuts pool ~25% and new-round valuations 10-20% within 1-2 quarters | — | Nov 2026 [U] |
| C14 | Site timeline | Median 8 quarters, construction to live; grid path adds 12-24 quarters unless brownfield | — | [Epoch][P-snip] |
| C15 | Blocked or delayed sites | ~5-10% blocked; 20-40% delayed at neutral public sentiment | — | [P] Data Center Watch |

## 1.10 UI hooks (what makes it legible)
- **Supply panel:**
  - Global supply bar with its binding component.
  - List price and spot price with trend.
  - Your allocation share and the reason (LTA/prepay/strategic).
  - Backlog signal.
  - "Capacity coming online in Q+4 / Q+8".
- **Power panel:**
  - Sites on a map, each with stage, power path, ETA and a block/delay risk icon.
  - MW free vs chips in inventory ("2.1M H100e idle: no power").
- **Finance panel:**
  - Cash, runway and covenant headroom.
  - Raise ceiling broken into its four limits ("bound by: annual cap vs revenue").
  - Ownership pie.
  - Board seats with stance arrows.
  - Commitment waterfall by quarter (cancellable vs not).
  - Hype and rates gauges.
- **"Why did this change?"** on valuation (g, R, H, N, M terms) and on raise ceiling.

---

# PART 2 - DATA TABLES

## 2.1 Global AI compute production (Epoch, AI27)
| Item | Value | Date | Tag / URL |
|---|---|---|---|
| Compute added per quarter | 0.83M H100e (Q1 2024) → 6.33M (Q2 2026). Doubling every 9.1 months (90% CI 8.4-10.0), 2.5x/yr. About 6x/yr in 2023. Y/y growth 2.8x (Q2 2025) → 2.2x (Q2 2026). Cumulative stock 2.6x in the year to Q2 2026 vs 3.5x the year before | 29 Oct 2026 | [Epoch] https://epoch.ai/data-insights/ai-computing-capacity-additions-doubling |
| Global stock | ~20M H100e sold by end-2025; ~16M operational with a 1-quarter lag. Customs-based arrivals ~27.4M through Jun 2026. ~31.6M extrapolated to Sep 2026 | 2026 | [Epoch] https://epoch.ai/gradient-updates/frontier-labs-dont-use-most-ai-compute ; https://epoch.ai/data/ai-chip-sales |
| AI27 production | 2M / 5M / 11M / 25M / 60M H100e (2023-27). TCO per H100e $50K / 40K / 25K / 20K / 15K. Power per H100e 1.3 / 1.0 / 0.75 / 0.7 / 0.55 kW | Apr 2025 | [AI27] https://ai-2027.com/supplements/compute-forecast |
| Market share of compute sold, Q2 2026 | Nvidia 63%, Google 25%, Amazon 5%, AMD 4%, Huawei 3%, Cambricon <1% (Q4 2025: Nvidia 68%, Google 19%) | 21 Oct 2026 | [Epoch] https://epoch.ai/graphs/ai-chip-market-share-by-designer |
| TPU shipments (H100e per Broadcom fiscal quarter) | FQ1'25 0.33M → FQ2'26 0.96M → FQ3'26 1.97M (~800k chips, mostly v7 Ironwood). TPU v7 ~$13K per chip | 4 Nov 2026 | [Epoch] https://epoch.ai/data-insights/tpu-production-doubling |
| Performance per $ | Spend-weighted +49%/yr (2023-25): ~6%/yr until mid-2024, ~2x/yr with Blackwell. Q4 2025 relative to H100 = 1: GB200 1.76, GB300 2.33, TPU v6e 5.88, Trainium2 4.38 | Aug 2026 | [Epoch] https://epoch.ai/data-insights/chip-performance-per-dollar |
| Chip price assumptions | H100/H200 $30K (2023), $28K (2024), $26K (2025) | Aug 2026 | [Epoch] same URL |

## 2.2 TSMC
| Item | Value | Date | Tag / URL |
|---|---|---|---|
| Capex | ~$30.4B (2023), ~$29.8B (2024) [mem]; $40.9B (2025) [U]; 2023-25 total "$101B" [P] | — | https://investor.tsmc.com/japanese/encrypt/files/encrypt_file/reports/2026-04/3cef85204275f94fd111485cfdf4adb3c0263c45/TSMC%201Q26%20Transcript.pdf |
| 2026 capex guidance | $52-56B (Jan) → high end (Apr) → $60-64B (Jul, reiterated 15 Oct). Split: 70-80% advanced nodes, 10-20% packaging and other | 2026 | [P] 1Q26 transcript; [P-tx] https://www.fool.com/earnings/call-transcripts/2026/07/16/tsm-tsm-q2-2026-earnings-call-transcript/ ; https://www.itiger.com/news/1163623376 |
| Capex outlook | "Significantly higher" 2026-28. "In 2028 and 2029 we will significantly increase capex if AI demand continues" | 2026 | [P] 1Q26 transcript |
| AI accelerator revenue CAGR guidance | Mid-40s% → mid-to-high 50s% (2024-29, Jan 2026) → "toward higher 50s" (Apr 2026) | 2026 | [P] |
| HPC share of revenue | 58% (2025) → 61 / 66 / 68% (1Q-3Q 2026). 3Q26 revenue $46.7B, gross margin 66.4% | 2026 | [P][P-tx] https://www.crnasia.com/news/2026/components-and-peripherals/tsmc-third-quarter-revenue-tops-guidance-as-ceo-says-ai-dema |
| Node mix, 3Q26 | N2 8%, N3 33%, N5 28%. N2 in high-volume production 4Q25. N2 capacity to "more than double" in 2027 | Oct 2026 | [P-tx] |
| Fab build time | "Two to three years to build a new fab. No shortcuts. And another one to two years to ramp." 2026 capex adds ~0 to 2026 output | Apr 2026 | [P] 1Q26 transcript |
| N3 response | Broke practice to add N3 capacity: Tainan 1H27, Arizona Fab 2 2H27, Japan Fab 2 2028. Converting N5 tools to N3 | Apr 2026 | [P] |
| Arizona | Fab 1 in N4 volume production 4Q24 (construction began 2021 [mem]). Fab 3 broke ground Apr 2025. Fab 4 and the first packaging fab started 2026. $265B total plus $100B (Jul 2026) | 2026 | [P] https://www.tsmc.com/static/abouttsmcaz/index.htm |
| CoWoS | "More than double" in 2024 and again in 2025 [U] https://www.taiwannews.com.tw/en/news/5903663 . ~75k wafers/month in 2025 [U] https://www.trendforce.com/news/?p=30991 . Jul 2026: packaging "limiting my customers' growth" [P-tx] | — | — |
| Demand vs supply | "Demand is higher than supply"; 2027 expected "very tight" | Apr / Oct 2026 | [P] |

## 2.3 HBM and memory
| Item | Value | Date | Tag / URL |
|---|---|---|---|
| Micron HBM TAM (Dec 2024 view) | $16B (2024), >$30B (2025), >$100B by 2028-30 | Dec 2024 | [P-tx] https://statementdog.com/analysis/MU/earnings_calls/282584 |
| Micron HBM TAM (Dec 2025 view) | ~$35B (2025) → ~$100B (2028), ~40% CAGR | Dec 2025 | [P-tx] https://www.itiger.com/news/1193308110 |
| Micron sell-out | All of 2026 HBM agreed by Dec 2025. Most of 2027 agreed by Sep 2026 "with significant price increases". FY26 revenue $133.2B (+256%). LTAs cover >35% of revenue through 2030 | Sep-Oct 2026 | [U] https://www.trendforce.com/news/2026-10-01/news-micron-fy2026-revenue-surges-256-to-133-2b-locks-in-35-of-revenue-through-2030/ |
| Memory fab lead time | Idaho ID1 slipped to mid-2027. ID2 output 2028. New York broke ground 2026, output by 2030 (~4 years) | Dec 2025 | [P-tx] itiger URL above |
| SK hynix | Sold out through 2026 (Oct 2025). 3Q26 operating margin ~80%. LTAs with 14 customers cover more than half of 2027-28. "Effectively sold out through 2029" | Oct 2025 / Oct 2026 | [U] https://www.koreatimes.co.kr/business/tech-science/20251029/sk-hynix-q3-operating-profit-reaches-793-bil ; https://www.mt.co.kr/en/industry/2026/10/28/2026102809242617566 |
| Nvidia supply commitments "primarily memory" | See 2.4 | — | — |

## 2.4 Nvidia
| Item | Value | Date | Tag / URL |
|---|---|---|---|
| Data Center revenue ($B per quarter) | FY24: 4.3 / 10.3 / 14.5 / 18.4. FY25: 22.6 / 26.3 / 30.8 / 35.6. FY26: 39.1 / 41.1 / 51.2 / 62.3. FY27: ~75.2 / 89.0 (+117% y/y); Q3 guide total revenue $108B | — | Q2 FY27 [P] https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000073/q2fy27pr.htm ; Q1 FY26 [P] https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-first-quarter-fiscal-2026 ; others [mem/U] |
| Gross margin | 72.4% (Q2 FY26), 74.9% (Q1 FY27), 75.0% (Q2 FY27); 60.5% GAAP in Q1 FY26 because of the H20 charge | — | [P] |
| Supply and capacity obligations | $16.1B (Jan 2024) → $30.8B (Jan 2025) → $119B (Apr 2026) → **$279B** (Jul 2026): $92B rest of FY27, $87B FY28, $88B FY29, $6B FY30 | 2026 | [P] https://s201.q4cdn.com/141608511/files/doc_financials/2027/Q227/Q2FY27-CFO-Commentary.pdf ; https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm |
| Bookings claims | ~$500B Blackwell + Rubin through CY2026 (Oct 2025). "At least $1T" through 2027 (Mar 2026) | — | [U] https://finance.yahoo.com/news/nvidia-build-ai-supercomputers-us-191932227.html ; https://www.techradar.com/pro/we-expect-at-least-usd1-trillion-revenue-nvidia-ceo-predicts-huge-windfall-on-rubin-and-blackwell-chips-as-he-reveals-new-vera-cpu-and-server-racks |
| Revenue per GW | "$50-60B per GW" (Huang) [U]. Hopper ~$18B, GB ~$25B, Vera Rubin ~$40B (Aug 2026 call) [U] | — | https://www.webull.com/news/15497781742806016 |
| China | H20 license requirement from 9 Apr 2025: $4.5B charge, ~$8B lost revenue in Q2 FY26 [P]. Q2 FY27 outlook assumes no China data-center compute [P] | — | Q1 FY26 release; Q2 FY27 CFO commentary |

## 2.5 GPU rental prices
| Item | Value | Date | Tag / URL |
|---|---|---|---|
| H100 on-demand, 2023 | $7-10/h | 2023 | [U] https://www.silicondata.com/blog/h100-rental-price-over-time |
| H100 1-year contract | $1.70/h low (Oct 2025) → $2.35/h (Mar 2026), +40% | 2025-26 | [SA] https://gpu-index.semianalysis.com/ |
| H100 index | ~$2.53/h. On-demand range $1.38-11.01 (May 2026) | 2026 | [U] https://www.silicondata.com/products/silicon-index/h100 |

## 2.6 Power, grid, build times
| Item | Value | Date | Tag / URL |
|---|---|---|---|
| US datacenter electricity | 176 TWh (2023, 4.4%). 2028: 325-580 TWh (6.7-12%) | Dec 2024 | [P] https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers |
| Global datacenter electricity (IEA) | ~415 TWh (2024) → ~945 TWh (2030). ~20% of planned projects at risk of grid delay. Transmission takes 4-8 years | 2025 | [P] https://www.iea.org/reports/energy-and-ai/executive-summary |
| Epoch site tracker | 96 sites, 15.1 GW IT (~19.6 GW facility), ~15.8M H100e, ~44% of global AI compute. Largest: Anthropic-Amazon New Carlisle 1,037 MW; Colossus 2 946 MW; Abilene 824 MW; Fairwater Atlanta 636 MW | 6 Nov 2026 | [Epoch] https://epoch.ai/data/data-centers |
| Build speed (to 1 GW) | Colossus 2 ~1.0 year; New Carlisle 1.9; Abilene 2.1; Fayetteville 3.0; Fairwater 3.6; Ridgeland 3.6 | Nov 2025 | [Epoch] https://epoch.ai/data-insights/data-centers-buildout-speeds |
| Stargate sites | Abilene 1.2 GW (done Q4 2026). Shackelford 2.0, Doña Ana 2.2, Milam 1.2, Port Washington 1.3 and Saline 1.4 GW all due Q4 2028. >9 GW by 2029; on-site gas | Apr 2026 | [Epoch] https://epoch.ai/publications/openai-stargate-where-the-us-sites-stand |
| US AI power | ~5 GW now; 20-30 GW by late 2027 | Nov 2025 | [Epoch] https://epoch.ai/publications/what-you-need-to-know-about-ai-data-centers |
| Cost per GW of IT power | $37.9B: servers 21.2, network 4.9, facility 11.4, land and utility 0.33. Power $0.59B/yr at 8.34¢. Running cost $8.5B/yr (Epoch total). PUE 1.14; IT life 5 years; facility life 14 years | May 2026 | [Epoch] https://epoch.ai/data-insights/ai-datacenter-cost-breakdown |
| Interconnection queue | ~1,400 GW generation plus storage (end-2024). Median 61 months request-to-operation for 2025 projects (36 in 2015) | Jun 2026 | [P-snip] https://eta-publications.lbl.gov/sites/default/files/2026-06/queued_up_2026_edition.pdf |
| ERCOT large-load queue | 63 GW (end-2024) → ~226 GW (Nov 2025) → ~410 GW (Mar 2026) → ~474 GW (Jul 2026, ~90% datacenters). Batch study process from 2026 | Jul 2026 | [P-snip] https://www.ercot.com/files/docs/2026/07/29/ERCOT-Senate-July-29-Panel-1-Assessing-The-Grid.pdf |
| PJM capacity price | $28.92 (2024/25) → $269.92 (2025/26) [mem] → $333.44 at cap (2027/28, 6.6 GW short) → $325 at cap (2028/29, 6.8 GW short, uncapped $554.72) | 2025-26 | [P-snip] https://www.pjm.com/-/media/DotCom/markets-ops/rpm/rpm-auction-info/2028-2029/2028-2029-bra-results-report.pdf |
| DOE → FERC on large loads | Sec. 403 letter (23 Oct 2025). FERC show-cause orders to the RTOs (18 Jun 2026); no uniform rule | 2025-26 | [P-snip] https://www.energy.gov/sites/default/files/2025-10/403%20Large%20Loads%20Letter.pdf ; https://www.caiso.com/documents/jun-18-2026-order-instituting-proceeding-large-loads-and-co-located-loads-el26-71.pdf |
| GE Vernova gas turbines | Backlog plus slot reservations 122 GW (64 firm). ~5 GW shipped in Q3 2026. Reservations for 2031-32 [U] | Oct 2026 | [P] https://www.sec.gov/Archives/edgar/data/0001996810/000199681026000162/gevpressrelease3q26.htm |
| Large power transformers | ~50 weeks (2021) → 120 weeks (2024); large units 80-210 weeks | 2024 | [P-snip] https://cisa.gov/sites/default/files/2024-06/DRAFT_NIAC_Addressing%20the%20Critical%20Shortage%20of%20Power%20Transformers%20to%20Ensure%20Reliability%20of%20the%20U.S.%20Grid_Report_06052024_508c.pdf |
| Local opposition | $64B blocked or delayed (May 2024-Mar 2025). ≥45 projects / ~$68B in Q2 2026 alone; local moratoria spreading | 2025-26 | [P] https://www.datacenterwatch.org/report ; https://www.datacenterwatch.org/q2-2026 |

## 2.7 Hyperscaler capex ($B)
| Company | 2024 | 2025 | 2026 guidance (latest) | 2027 signal | Tag / URL |
|---|---|---|---|---|---|
| Alphabet | 52.5 | 91.4 | 195-205 (28 Oct 2026) | "Increase significantly" | [P] https://www.sec.gov/Archives/edgar/data/0001652044/000165204426000080/googexhibit991q32026.htm |
| Meta | 39.2 | 72.2 | 135-145 (21 Oct 2026) | "Invest aggressively" | [P] https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/default.aspx |
| Amazon | ~83 | ~131.8 | ~220 (29 Oct 2026) | "Meaningfully higher" | [P] https://aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report |
| Microsoft (calendar year, incl. finance leases) | — | — | ~170 (Q1 FY27: 45.2; Q2 guide >50). Short-lived assets (chips) ~2/3-3/4 of capex | FY27 grows, accelerating in H2 | [P] https://www.microsoft.com/en-us/investor/events/fy-2027/earnings-fy-2027-q1 |
| Oracle (fiscal years) | — | FY26 ~55.7 [U] | FY27 90-95; RPO $664B | — | [P] https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Q1-Results-Driven-by-Triple-Digit-Growth-in-Cloud-Infrastructure-Revenues/ |

The five sum to about **$810-835B** for 2026.

Microsoft's leases not yet commenced reached $364.6B (30 Sep 2026) [P-snip] https://www.sec.gov/Archives/edgar/data/789019/000119312526436133/msft-20260930.htm . From FY27 Microsoft's datacenter useful life moves to 25 years, so more leases are operating leases and reported capex understates spend [P].

## 2.8 Export controls
| Rule | Date | URL |
|---|---|---|
| Advanced computing and SME controls (87 FR 62186) | 13 Oct 2022 | https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor |
| Advanced computing update (88 FR 73458) | 25 Oct 2023 | https://www.federalregister.gov/documents/2023/10/25/2023-23055/implementation-of-additional-export-controls-certain-advanced-computing-items-supercomputer-and |
| FDPR additions and HBM controls (89 FR 96790) | 5 Dec 2024 | https://www.federalregister.gov/documents/2024/12/05/2024-28270/foreign-produced-direct-product-rule-additions-and-refinements-to-controls-for-advanced-computing |
| AI Diffusion framework (90 FR 4544) | 15 Jan 2025 | https://www.federalregister.gov/documents/2025/01/15/2025-00636/framework-for-artificial-intelligence-diffusion |
| Diffusion rule rescinded; Huawei Ascend guidance | 13 May 2025 | https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens |
| H200-class license review → case-by-case (91 FR 1684) | 15 Jan 2026 | https://www.federalregister.gov/documents/2026/01/15/2026-00789/revision-to-license-review-policy-for-advanced-computing-commodities |
| UAE enhanced favorable treatment (91 FR 43034) | 14 Jul 2026 | https://www.federalregister.gov/documents/2026/07/14/2026-14132/enhanced-favorable-treatment-for-the-united-arab-emirates-under-the-export-administration |
| Taiwan concentration | ~92% of sub-10nm capacity in Taiwan in 2019 [mem]. US advanced-logic share 0% (2022) → 28% (2032 projection) [P] | https://www.semiconductors.org/emerging-resilience-in-the-semiconductor-supply-chain/ |

## 2.9 Lab equity rounds
| Lab / round | Size | Post-money | Dilution | Run-rate at the time | Date | Tag / URL |
|---|---|---|---|---|---|---|
| OpenAI | $6.6B | $157B | 4.2% | ~$4B | Oct 2024 | [mem] |
| OpenAI (SoftBank-led) | Up to $40B; $30B conditional on recapitalization by end-2025, else $10B | $300B | ~13% | ~$10B | 31 Mar 2025 | [P] https://group.softbank/en/news/press/20250401 |
| OpenAI | $122B ($110B from Amazon $50B [$35B conditional], Nvidia $30B, SoftBank $30B) | $852B | 14.3% | ~$25B | 31 Mar 2026 | [P-snip] https://www.openai.com/index/accelerating-the-next-phase-ai/ ; [U] Bloomberg |
| OpenAI | $11B first close (target $20-30B; ask was $1.5T) | $1.25T | ~1-2% | ~$50-70B | Nov 2026 | [U] https://gvwire.com/2026/11/06/openai-secures-11-billion-funding-at-1-25-trillion-valuation-bloomberg-news-reports/ |
| Anthropic Series E | $3.5B | $61.5B | 5.7% | ~$1-2B | 3 Mar 2025 | [P] https://www.anthropic.com/news/anthropic-raises-series-e-at-usd61-5b-post-money-valuation |
| Anthropic Series F | $13B | $183B | 7.1% | >$5B | 2 Sep 2025 | [P] https://www.anthropic.com/news/anthropic-raises-series-f-at-usd183b-post-money-valuation |
| Anthropic Series G | $30B | $380B | 7.9% | $14B | 12 Feb 2026 | [P] https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation |
| Anthropic Series H | $65B (incl. $15B hyperscaler) | $965B | 6.7% | >$47B | 28 May 2026 | [P] https://www.anthropic.com/news/series-h |
| Anthropic IPO | 825M shares at $70-78; ~$56-62B primary | ~$1.26-1.40T [U] | ~4-5% | ~$46B+ (Q2 annualized) | Roadshow 10 Nov 2026 | [P] https://www.anthropic.com/news/roadshow-launch ; EDGAR CIK 2130357 |
| xAI Series E | $20B | ~$230B [U] | ~8.7% | — | 6 Jan 2026 | [P] https://x.ai/news/series-e |
| SpaceX-xAI merger | All-stock; xAI $250B, combined $1.25T | — | — | xAI 2025 revenue $3.2B, ~$14B burn [U] | Feb 2026 | [U] https://dfjgrowth.com/news/xai-joins-spacex-to-accelerate-humanitys-future/ |
| SpaceX IPO | $86.25B including greenshoe, largest ever (Aramco $29.4B [mem]) | ~$1.75T [U] | ~5% | — | Jun 2026 | [P] https://www.sec.gov/Archives/edgar/data/1181412/000162828026043288/spaceexplorationtechnologi.htm |

## 2.10 Anthropic S-1 financials (summarized [S])
Sources: https://kepler.ai/research/financial/s1-anthropic/ ; https://dealroom.co/news/info-1sghj5n-anthropics-s-1-takeaways-from-giant-compute-commitments-to-complex-lock/

| Item | 2023 | 2024 | 2025 | H1 2026 |
|---|---|---|---|---|
| Revenue | $41M | $386M | $4,585M | $16,286M (Q2 $11.56B) |
| Operating income | −$551M | −$2.98B | −$8.06B (adjusted −$4.9B) | −$693M (Q2 +$974M) |
| Operating cash flow | −$1.63B | −$5.69B | −$2.64B | +$3.93B |
| Compute and infrastructure | — | — | $7.3B (+190%) | 55% of revenue (201% in H1 2025) |
| Financing inflow | — | — | — | $110.8B |
| Cash + short-term investments at 30 Jun 2026 | — | — | — | $112.4B + $19.3B |

Commitments: ~$637B in total (~$431B minimum).
- Broadcom TPU leases: $161B, non-cancellable.
- Google Cloud: $114.5B.
- AWS: $110B.
- SpaceX/xAI GPUs: up to $120.5B, 90-day cancellable.
- Azure: $44.9B.
- Nscale: $44.6B.
- Lambda: $41.3B.

Debt: revolver $15B to 2031, with a ≥$5B liquidity covenant.

Strategic holdings: Amazon convertible notes ($6.2B principal, carried at $108.6B fair value). Amazon capped at 12% and Google at 14.99%, both in non-voting Class N.

## 2.11 Strategic, debt, governance (primary)
| Item | Value | Date | URL |
|---|---|---|---|
| Microsoft-OpenAI | ~27% stake (~$135B). +$250B Azure commitment. Microsoft loses its right of first refusal on compute. IP rights to 2032. Expert panel verifies AGI; revenue share continues until then | 28 Oct 2025 | [P] https://blogs.microsoft.com/blog/2025/10/28/the-next-chapter-of-the-microsoft-openai-partnership/ |
| Delaware AG conditions on OpenAI | Foundation appoints PBC directors. Safety committee at the nonprofit can halt releases. Safety decisions consider mission only | 28 Oct 2025 | [P] https://news.delaware.gov/2025/10/28/ag-jennings-completes-review-of-openai-recapitalization/ |
| Amazon-Anthropic | $8B total (Nov 2024). Then $5B plus up to $20B, against a >$100B AWS commitment over 10 years, up to 5 GW | 2024 / Apr 2026 | [P] https://www.anthropic.com/news/anthropic-amazon-trainium ; https://www.anthropic.com/news/anthropic-amazon-compute |
| Google-Anthropic | Up to 1M TPUs, >1 GW in 2026 | 23 Oct 2025 | [P] https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services |
| Microsoft/Nvidia-Anthropic | $30B Azure commitment; Nvidia up to $10B, Microsoft up to $5B | 18 Nov 2025 | [P] https://blogs.microsoft.com/blog/2025/11/18/microsoft-nvidia-and-anthropic-announce-strategic-partnerships/ |
| Nvidia-OpenAI letter of intent | ≥10 GW; up to $100B "progressively as each GW is deployed" | 22 Sep 2025 | [P-snip] https://investor.nvidia.com/news/press-release-details/2025/OpenAI-and-NVIDIA-Announce-Strategic-Partnership-to-Deploy-10-Gigawatts-of-NVIDIA-Systems/ |
| AMD-OpenAI | 6 GW; warrant for up to 160M AMD shares vesting by GW and price targets | 6 Oct 2025 | [P] https://newsroom.amd.com/news/amd-and-openai-announce-strategic-partnership-to-d/ |
| Stargate | $500B over 4 years; SoftBank, OpenAI, Oracle, MGX | 22 Jan 2025 | [P] https://group.softbank/en/news/press/20250122 |
| Oracle bonds | $18B at 4.45-6.10% (Sep 2025). $25B at up to 6.85%, plus a $20B at-the-market equity program (Feb 2026) | — | [P] https://www.sec.gov/Archives/edgar/data/1341439/000119312525220445/d31817d8k.htm ; https://www.sec.gov/Archives/edgar/data/1341439/000119312526037840/d23732d8k.htm |
| Meta-Blue Owl Hyperion | ~$27B, 80/20 JV; 4-year lease plus residual value guarantee | 21 Oct 2025 | [P] https://investor.atmeta.com/investor-news/press-release-details/2025/Meta-Announces-Joint-Venture-with-Funds-Managed-by-Blue-Owl-Capital-to-Develop-Hyperion-Data-Center/default.aspx |
| CoreWeave delayed-draw term loans | $2.6B at SOFR+4.00% secured by an OpenAI contract (Jul 2025). $2.6B at SOFR+5.50%, rated Ba2/BB+ (Aug 2026) | — | [P] https://www.sec.gov/Archives/edgar/data/1769628/000176962825000033/ddtl30pressrelease-ex991x6.htm ; https://www.sec.gov/Archives/edgar/data/1769628/000176962826000357/ex991pr.htm |
| Anthropic charter (Exhibit 3.1) | Class T: elects board seats on a phase-in; notice rights (capability-threshold model transfer, debt, bankruptcy); 75% board plus 75-85% stockholder supermajority to change | May 2026 | [P] https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/exhibit31-sx1.htm |
| LTBT design | Trust elects a board majority within 4 years; stockholder supermajority failsafe | Sep 2023 | [P] https://www.anthropic.com/news/the-long-term-benefit-trust |
| Fed policy | 5.25-5.50% (Jul 2023) → 4.25-4.50% (Dec 2024) → 3.50-3.75% (Dec 2025) → 3.75-4.00% (+25bp, 17 Sep 2026). Effective fed funds 3.88%, y10 4.98% (Nov 2026) | — | [P] https://www.federalreserve.gov/monetarypolicy/openmarket.htm ; https://www.federalreserve.gov/releases/h15/ |
| Nov 5 2026 selloff | Nasdaq −4 to −5.5%, S&P −4.4%, Nvidia ~−9%; doubts over AI capex financing and power | 5 Nov 2026 | [U] https://www.boston.com/news/national-news/2026/11/05/a-brutal-sell-off-for-ai-stocks-sends-wall-street-reeling-and-the-sp-500-tumbles-4-4/ |

## 2.12 What limits a lab's capital per year (synthesis)
1. **Revenue anchor.** Annual equity raised ≈ 2.5-3x run-rate at R ≈ $50B, and higher at small R. Anthropic per round: 2.6x (F), 2.1x (G), 1.4x (H), 1.3x (IPO) [P][D].
2. **Dilution tolerance.** 5-8% per round. Bigger rounds happen only with strategic anchors or forced conditions.
3. **Pool size.** Total frontier-lab equity was about $30B (2024), ~$75B (2025) and ~$350B+ (2026, including IPO windows) [D]. It tracks sector revenue × hype.
4. **Conditions.** Big money arrives in tranches tied to governance changes (OpenAI recapitalization), IPOs or AGI (Amazon), GW deployed (Nvidia, AMD), or compute milestones (Anthropic notes).
5. **Circularity.** Suppliers fund their customers: about 90% of OpenAI's 2026 round came from Amazon, Nvidia and SoftBank, and Broadcom funds Anthropic's TPU rent. This scales capital with *compute purchases*, not with investor appetite. It is the game's main "escape valve", priced in lock-in.
6. **Debt sits at infrastructure intermediaries,** not at the lab: CoreWeave, Oracle, Blue Owl SPVs. Its price rises with sector leverage (CoreWeave +150bp in a year; Oracle's 30-year coupon +75bp in 5 months).
7. **Macro gate.** Rate hikes (Sep 2026) and selloffs (Nov 2026) shrink valuations and round sizes within weeks.
8. **The absolute record** is ~$120B in a single private round and ~$86B in an IPO. The game should make $150B+ per year for one lab require stacking every channel.

## 2.13 Open gaps (not verified this session; search budget exhausted)
- Samsung HBM.
- Trainium run-rate and Trainium3 volumes.
- Broadcom forward AI guidance.
- TSMC N3/N2 wafer counts and official CoWoS wafers per month (TSMC does not disclose either).
- GB200 NVL72 rack price (~$3M [U]).
- The re-verified 92% Taiwan share.
- SoftBank financing constraints (Nvidia stake sale, margin loans).
- xAI debt terms ($5B notes, $12.5B GPU SPV [mem]).
- Oracle CDS.
- Total AI VC per year (PitchBook).
- Primary figures for DeepSeek-day market cap.
- OpenAI's 2024-25 revenue and burn (The Information [U]).
- Siemens Energy and Mitsubishi turbine backlogs.
- Behind-the-meter generation cost per GW.
