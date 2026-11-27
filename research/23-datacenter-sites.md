# 23 - Data-centre sites: power paths, world-driven waits, speed-up levers (sourced)

Replaces research/15 §1.3 (site/power model). Model being sourced (designer-approved, not redesigned here):
`time_to_live = permits + max(construction, power)`; paths = colocation/lease, brownfield, new grid, dedicated gas, nuclear RESTART; waits follow world state; no GW cap; money buys speed; opposition blocks/delays.

Tags: [P] primary (official data, filings, papers, Epoch, national labs). [I] industry/broker report (CBRE, C&W, WoodMac, GridLab via IRP/CPCN data) - good but not official. [SA] SemiAnalysis analyst (secondary). [U] press/secondhand only, unverified. [D] derived by me (arithmetic shown). [Design] proposed game value, not data. Research pass 2026-11-27, ~45 min budget.

---

## 0. Proposed game numbers (summary; derivations below)

| Path | Power wait 2023 → 2026 (from commitment) | Size per site | Extra capex per GW IT (lab pays) | Power price vs grid tariff | Opposition |
|---|---|---|---|---|---|
| Colocation / lease | 0-2 q if space exists; else prelease a hall under construction: 4-10 q | 0.05-1 GW per lease (deals of 0.2-0.4 GW common) | 0 (rent $140-185/kW-month ≈ 15-19%/yr of facility capex) | Pass-through + rent | Landlord's problem (counterparty risk) |
| Brownfield (existing interconnect) | 4-8 q (no new queue; rights transfer) [Design] | 0.3-4.5 GW (retired-plant sites) | Facility only; maybe re-powering | 1.0x | Low-medium |
| New grid interconnection | ~12 q (2023) → 16-28 q (2025-26) in tight regions; driver = queue / energisations per year | 0.3-1 GW typical, up to ~1-2 GW | Utility upgrades $0.05-0.3B/GW [U]; minimum-bill / take-or-pay tariffs | 1.0x (8.1¢ 2024, 8.6¢ 2025) + capacity-price adder | Medium (ratepayer anger) |
| Dedicated gas (on-site or plant for the site) | Small aero/recip: 4-8 q (2023) → 6-12 q (2026). Heavy-duty CCGT: ~12 q (2023) → 16-24 q (2026; slots 2029-32) | 0.2-5 GW (real: 0.36, 1.4, 2.3, 4.5, 5.2 GW) | $2.4-3.3B on-site (incl. ~1.5x overbuild); CCGT $2.0B+ | ~1.0-1.3x [D] | Highest (air permits, health) |
| Nuclear restart | 12-16 q; FINITE: 3 US units total, ~2.25 GW | 0.6-0.84 GW | ~$1.9-3.1B/GW (restart cost; often paid via PPA premium) | ~1.3x (≈$110-115/MWh) [U] | Low-medium (lawsuits failed) |

Core world-state drivers (one per wait): grid wait ← large-load queue / energisation rate per region; gas wait ← OEM (backlog + reservations) / OEM output per year; colocation availability ← unleased capacity under construction; transformers ← lead time (folded into construction); opposition ← count of active groups / anti-AI public.

---

## 1. Per-path tables

### 1.1 Colocation / lease

| Item | Value | Source / date |
|---|---|---|
| Primary-market supply (N. America) | 10,903 MW, +33.7% y/y | [I] CBRE NA Data Center Trends H1 2026 https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026 |
| Vacancy | 1.4% (H1 2026), 1.6% (H1 2025): record lows | [I] same |
| Under construction | 7,481 MW record (prior peak 6,350 MW H2 2024) | [I] same |
| Preleased share of under-construction | 80.4% (H1 2026) vs 74.3% (H1 2025) | [I] same (via Data Center Frontier) |
| Unleased capacity under construction | <1,500 MW ≈ 6 months of demand | [I] same |
| Rents | N. Virginia 10 MW+: $160-185/kW-month; Silicon Valley $200-275; 10 MW+ asking rent +6.7% (CBRE) or +9.7% (DCF) in H1 2026; 250-500 kW forecast >$215 | [I] CBRE H1 2026 + Midyear Outlook 2026 |
| Wholesale AI campus lease (neocloud) | Applied Digital-CoreWeave 400 MW, ~$11B over ~15 yr take-or-pay → $1.83M/MW-yr ≈ **$153/kW-month** [D] | [P] Applied Digital press releases 2025 (via GlobeNewswire); arithmetic [D] |
| Wholesale lease (IG hyperscaler) | Polaris Forge 2: 200 MW, ~$5B, ~15 yr → $1.67M/MW-yr ≈ **$139/kW-month** [D] | [P] Applied Digital PR Oct 2025; [D] |
| Hand-over time | New halls are preleased 2-3 yr before completion; first 50 MW of PF1 ready ~5 months after May 2025 lease (building already under way) | [P] PNNL-38441 (2025) developer quote; [P] Applied Digital RFS PR 27 Oct 2025 |
| Absorption | JLL: record 25 GW N. America H1 2026 (different method from CBRE; do not mix) | [I/U] JLL newsroom 2026 |

Game reading: the lease pool is the unleased under-construction stock (~1.5 GW in 2026, ~6 months of demand) plus what neoclouds will build to order (prelease, 4-10 q). Rent ≈ 15-19%/yr of Epoch facility capex, not 12%.

### 1.2 Brownfield (existing interconnect / repurposed site)

| Item | Value | Source |
|---|---|---|
| Mechanism | Reuse existing interconnection rights: e.g. Constellation asked FERC to move capacity-injection rights from Eddystone to Crane (2026); PJM fast-tracked Crane's interconnection, pulling restart 2028→2027 | [U] ANS / WNN Apr 2026; Constellation statements |
| Largest example | Homer City PA (former 1.9 GW coal plant): 4.4-4.5 GW new gas, 7 turbines; >$10B for power + site readiness | [U] Data Center Frontier / The Register 2025 |
| Federal push | EO 14318 directs use of brownfield and Superfund sites | [P] EO 14318, 23 Jul 2025 https://www.govinfo.gov/content/pkg/FR-2025-07-28/html/2025-14212.htm |
| Generation-queue time avoided | Gen interconnection median 61 months request→COD (2025 cohort) vs 36 (2015) - this is what reusing rights skips | [P] LBNL Queued Up 2026 |
| Wait | No load-side dataset found. Keep 4-8 q [Design] | gap |

### 1.3 New grid interconnection (load side)

| Item | Value | Source / date |
|---|---|---|
| Pre-boom | Developer: "could get access to electricity almost anywhere in the country within a year" a few years ago | [P] PNNL-38441 (2025), quoting Giacobone 2025 |
| Dominion (N. Va.) | Typical 3-4 yr for >100 MW → +1-3 yr, up to 7 yr (Aug 2024) | [U] Bloomberg 29 Aug 2024 (Dominion statement) |
| Dominion pipeline | >50 GW in contracting incl. 10.4 GW under ESAs (Q1 2026) → >53 GW / ~12 GW (Q2 2026) → 54.9 GW / >12 GW (Q3 2026) | [P] Dominion earnings calls 2026 (transcripts via Fool.com) |
| CBRE timelines | 2023: power constraints add 2-4 yr, up to 6; 2024: ≥2.5 yr minimum for ≥30 MW in top 22 markets; 2026: "10+ yr" procurement in some markets | [I] CBRE reports 2023-2026 (secondary summaries) |
| JLL | Average US grid-connection wait 4 yr (2025) | [U] |
| PNNL | Upgrades + interconnection 5-7+ yr; transmission 5-10 yr; DCs built in 6-12 months | [P] PNNL-38441, 2025 https://www.pnnl.gov/main/publications/external/technical_reports/PNNL-38441.pdf |
| ERCOT large-load queue (>75 MW) | 63 GW (end-2024) → 181 GW for 2030 (Jul 2025) → 233 GW (Dec 2025) → 410 GW (Mar 2026) → 438 GW (Jun 2026) → ~474 GW (Jul 2026) | [P] ERCOT board / Senate materials 2025-26 |
| ERCOT energisations | 4.6 GW energised + 2.1 GW approved (30 Jul 2025); ~3.9 GW expected to energise in Q4 2026 | [P] ERCOT (via S&P, Jun 2026 board update) |
| Other queues | Oncor >180 GW (May 2026); Georgia Power >15 GW committed (Apr 2026); AEP Ohio 35 GW requests mid-2024, 68% without land control | [P] LBNL Speed to Power webinar 9 Jul 2026; [SA] for AEP |
| Speculation filters | ERCOT $14k study deposit >75 MW; Texas SB6 (2025): ≥$100k study fee, site control, disclose duplicate requests | [P] PNNL-38441 |
| Grid tariff | EIA industrial 8.13¢/kWh (2024), 8.62¢ (2025) | [P] EIA Electricity Explained / EPM |
| Sizes | Largest live grid sites ~0.6-1.0 GW (New Carlisle 1,037 MW, Fairwater Atlanta 636 MW) | [P] Epoch data-centers hub, Nov 2026 (in research/15 §2.6) |
| Network upgrade cost | Appalachian Power $264M lines+substations for Google Botetourt; Microsoft ~$40M for a 115 kV substation (WY); 345 kV substation $50-120M | [U] Cardinal News Sep 2026; cost guides |

Derived wait rule [D/Design]: ERCOT queue 474 GW vs ~4-16 GW/yr energised ⇒ queue is mostly speculative; a firm request waits for transmission (5-10 yr) unless it takes a flexible lane. Game: `grid_wait_q(region,t) = base(t) * f(queue_firm / energise_rate)`, with base ≈ 12 q in 2023, 16-20 q in 2025, 20-28 q in tight regions 2026; forward: PJM/ERCOT reforms (batch studies, expedited tracks) and transmission builds bring it down only after ~2028 [Design].

### 1.4 Dedicated gas (on-site BTM or plant built for the site)

| Item | Value | Source / date |
|---|---|---|
| On-site tech, all-in capex / lead time | Aeroderivative $1,700-2,000/kW, 18-36 mo (~12 small); IGT $1,500-1,800/kW, 12-36 mo (<12 used); recips $1,700-2,000/kW, 15-24 mo; Bloom SOFC $3,000-4,000/kW, installs in weeks | [SA] "How AI labs are solving the power crisis" 2025 |
| Utility CCGT capex | 2026-27 COD projects $1,116-1,427/kW; recent projects routinely ≥$2,000/kW; cost rises with COD year | [I] GridLab/EFG "Increasing gas turbine costs" Sep 2025 (from IRP/CPCN filings) https://gridlab.org/wp-content/uploads/2025/09/GridLab_Gas-Turbine-Costs-Report-1.pdf |
| Public assumptions (lag reality) | EIA AEO2025 CC $1,176-1,330/kW; S&L 1x1 CC $921/kW (2023$); realised EIA 2023 CC $898/kW, CT $562; 2024 CT $841 | [P] EIA capital cost AEO2025; EIA generator costs |
| Overbuild for on-site | 1.4-1.5x for peak PUE + 10-17% redundancy; Vantage Shackelford 1.4 GW IT on 2.3 GW VoltaGrid (64% overbuild) | [SA] |
| Capex per GW IT | $1.7-2.0k/kW × 1.4-1.64 ⇒ **$2.4-3.3B per GW IT** [D]; Homer City >$10B / 4.4 GW ≈ $2.3B/GW (incl. site) [U][D] | |
| Real sizes | Crusoe Abilene 360 MW nameplate (10 turbines); xAI Memphis 15 SMT-130 permitted ≈247 MW, Southaven 41 turbines; Meta/Williams Socrates 306 MW; Oracle-VoltaGrid 2.3 GW; Homer City 4.4-4.5 GW; Entergy-for-Meta Louisiana 2.26 GW → >5.2 GW (7 CCGTs, Meta pays full cost of service) | [SA]; [U] TechCrunch Jul 2025; [U] Power Mag, S&P 2025-26 |
| Market scale | 46 DCs planning own power, 56 GW (Cleanview) / ~90 GW across 59 projects (Oct 2026); gas ≈75-80% | [U] Cleanview; Earthjustice Oct 2026 |
| US gas pipeline | >700 new gas plants, 260 GW in queues, +270% since 2022 | [P] LBNL "Integrating AI data centers with the grid" Jul 2026 |
| Power cost | Lazard 2025 unsubsidised CCGT $48-109/MWh, peaker $149-251/MWh (low capacity factor). On-site simple-cycle at ~85% CF ≈ capex $27-32 + fuel ~$30-40 + O&M ~$10 ⇒ ~$70-110/MWh ≈ **1.0-1.3x grid** [D; gas price $3-4/MMBtu assumed, not fetched] | [I] Lazard LCOE+ Jun 2025 |
| Permits | Major source >100 t/yr ⇒ Title V/PSD (GW-scale hits it in hours of operation); xAI Memphis: applied Jan 2025 → permit Jun/Jul 2025 (~5-6 months), after running unpermitted; EPA (Jan 2026) guidance: temporary turbines need permits too [U] | [P] Epoch "What you need to know about AI data centers"; [U] SELC, TechCrunch |

### 1.5 Nuclear restart (only)

| Unit | Size | Commitment → power | Cost | Buyer / price | Source |
|---|---|---|---|---|---|
| Palisades (MI), Holtec | ~800 MW (777 MWe) | Closed May 2022; DOE loan closed Sep 2024; fuel load 30 Aug 2026; target restart late 2026 (slipped from end-2025 and Feb 2026) ⇒ ~3.5-4 yr | DOE loan guarantee up to $1.52B (≥$1,900/kW) | Wolverine/Hoosier co-ops PPA (contract supply by Mar 2027) | [P] DOE LPO Palisades page; Holtec HH-41.03 (Mar 2026); [U] ANS Jul 2026 |
| Crane / TMI-1 (PA), Constellation | 835 MW | Microsoft 20-yr PPA Sep 2024 → target 2027 (from 2028, after PJM early interconnection); NRC draft EA/FONSI Jun 2026, final decision 2027 ⇒ ~3 yr | ~$1.6B [U] ≈ $1,900/kW [D]; DOE loan $1B (Nov 2025) | Microsoft; price undisclosed, est. ≥$112-115/MWh [U Jefferies/Reuters] | [P] DOE EDF Crane page; NRC CCEC page |
| Duane Arnold (IA), NextEra | 615 MW | Google 25-yr PPA Oct 2025 → Q4 2028-Q1 2029 ⇒ ~3-3.3 yr | DOE loan $1.9B (≥$3,100/kW) [U]; cost undisclosed | Google covers restart + production costs | [P] NextEra PR 27 Oct 2025; [U] Utility Dive |

- Finite list: these are the only three credible US restarts; ~2.25 GW total. All committed by Oct 2025. Game: a scarce, auctioned asset, available 2023-2025, then gone.
- Price vs grid: ~$112-115 vs 8.6¢ ⇒ ~1.3x. Existing-plant comparison (not a restart): Talen-AWS Susquehanna 1.92 GW to 2042, ~$18B ⇒ ~$65-75/MWh [D], after FERC rejected the behind-the-meter expansion (Nov 2024, Apr 2025) and the deal moved front-of-meter (Jun 2025) [U WNN/ANS].
- Opposition: environmental-group suit against Palisades dismissed (Jul 2026) [U ANS].

---

## 2. World-driven waits (time series + drivers)

| Wait | 2023 | 2024 | 2025 | 2026 | Forward to ~2030 | Driver | Source |
|---|---|---|---|---|---|---|---|
| Grid (load) >100 MW, tight region | 3-4 yr typical (Dominion); CBRE +2-4 yr | up to 7 yr (Dominion); ≥2.5 yr min top 22 mkts | 4 yr avg [U]; 5-7+ yr (PNNL) | 10+ yr some markets (CBRE); ERCOT queue 474 GW | Reforms: batch studies (ERCOT), PJM expedited track, FERC large-load docket; transmission 5-10 yr | Firm queue ÷ energisation/transmission rate | §1.3 |
| Heavy-duty gas turbine slot | New CCGT COD ≈ 2027-28 [gap: no 2023 baseline found] | — | Siemens lead time ≥3 yr; new CCGT COD 2030-31 (IRPs); KU/LG&E paid $25M reservation for 2030 COD | Siemens booked out to FY2028, 2029-30 filling (Jun 2026); GE taking reservations for 2032 (Q3 2026) | Siemens: orders at current pace through 2030, possibly 2035; OEM capacity GE→24 GW/yr, Siemens ~20→30+ GW/yr by 2028-30, Cat 2.5x turbines by 2030 | OEM backlog+reservations ÷ output: GE 122 GW (64 firm + 58 SRA) vs ~20 GW/yr shipped ⇒ ~6 yr [D]; Siemens 104 GW (65+39) FY2026 | [P] GE Vernova 3Q26 8-K; [P] Siemens Energy FY2026; [I] GridLab 2025; [SA] |
| Small aero / recip / fuel cell | ~12 mo | — | 12-36 mo | 15-36 mo; fuel cells weeks | Bloom 2 GW/yr by end-2026; Boom 2 GW/yr by 2028 | Packaged-unit OEM output | [SA] |
| Large power transformer | ~50 wk (2021) → | 120 wk (avg 2024), large 80-210 wk | 128 wk power, 143-144 wk GSU (Q2 2025); 30% supply deficit | still constrained | "Marginal shortage" to 2030 (WoodMac) | GOES/copper, 80% imported, tariffs | [P] NIAC draft Jun 2024; [I] WoodMac Aug-Sep 2025 |
| Colocation vacancy | — | — | 1.6% | 1.4%; <1.5 GW unleased in construction | JLL: pricing momentum holds through 2030 | Hyperscaler/AI demand vs construction | [I] CBRE, JLL |
| Opposition (DCW) | — | $64B blocked/delayed May 2024-Mar 2025 ($18B blocked, $46B delayed) | ~$98B late Mar-Jun 2025 [U] | Q1: ≥75 projects ~$130B; Q2: ≥45 projects ~$68B; groups doubled since Q4 2025; 300+ state bills; moratorium bills in 14 states | — | Power/water/ratepayer costs | [P/I] datacenterwatch.org Q1, Q2 2026 |

Game formula suggestion [Design]: `turbine_wait_q = 4 * (OEM_backlog_GW + reservations_GW) / OEM_output_GW_per_yr`, where demand from all actors adds to the backlog and output grows ~10-15%/yr to 2030. Same shape for grid: `grid_wait_q = base + k * firm_queue_GW / energise_GW_per_yr`.

---

## 3. Speed-up levers (what money buys)

| Lever | What it buys | Cost | Evidence |
|---|---|---|---|
| Flexible / curtailable interconnection | Grid power in ≤90 days (SPP CHILL, approved Sep 2025) instead of years; agree to curtail in emergencies | Lost compute in curtailed hours (+ backup gen). Duke: 76 GW of US headroom at 0.25% avg annual curtailment, 98 GW at 0.5%, 126 GW at 1% | [P] PNNL-38441; [P] Duke Nicholas Inst. "Rethinking Load Growth" Feb 2025 |
| Bring-your-own-generation fast lane | PJM Expedited Interconnection Track for generation brought by large loads (board Jan 2026; FERC accepted, ~10 projects/round cap [U]) | Fund the plant | [P] PJM board letter 16 Jan 2026 |
| Self-funded network upgrades ("option to build") | Pay for the substation/lines yourself, skip utility build schedule | $0.05-0.3B/GW [U] | [P] LBNL Speed to Power Jul 2026 (solution S7.1) |
| Turbine slot reservation | Guaranteed delivery year | $25M for one turbine (KU/LG&E, 2030 COD) - non-trivial fee, converts to order | [I] GridLab citing KY PSC 2025-00045 testimony |
| Bridging power (mobile/aero/recips/fuel cells) | Power in months while waiting for grid; resale/backup later | $1.7-2.0k/kW (aero/recip), $3-4k/kW fuel cells; value: AI cloud revenue ~$10-12B/GW-yr ⇒ 200 MW six months early ≈ $1-1.2B | [SA] |
| Buy used/refurbished turbines | <12 months | Premium, small units | [SA] |
| Crash construction | Colossus 1 in 122 days; Colossus 2 to ~1 GW in ~1 yr vs median ~2 yr | No sourced premium (research/15's +35% is [Design]) | [P] Epoch build-speed insight |
| Federal fast-track | FAST-41 coverage for >100 MW or ≥$500M projects; brownfield/Superfund sites | Low; does not cover state/local air, water, zoning | [P] EO 14318 |
| Community benefit agreement | Lower opposition | NY benchmark ≥$1M/MW of local investment (Sep 2026) ⇒ ~$1B/GW ≈ 9% of facility capex, ~2.6% of all-in $37.9B/GW [D]; effect on block odds: no data | [P] NY Governor / ESD Community Investment Framework, 15 Sep 2026 |
| Take-or-pay / minimum-bill tariffs | Required to get in the utility queue (e.g. AEP Ohio-style 85% minimum demand) [U from memory, not re-verified] | Locks cash for 10-15 yr | [P] LBNL rate-design report 2026 (not read in detail) |

---

## 4. Permitting and opposition

| Item | Value | Source |
|---|---|---|
| Federal | EO 14318 (23 Jul 2025): FAST-41 for >100 MW AI load or ≥$500M; NEPA categorical exclusions; brownfields | [P] |
| Air (gas) | Title V/PSD major-source; xAI Memphis ~5-6 months app→permit (contested); Southaven permit Mar 2026; appeals continue | [P] Epoch; [U] SELC, E&E |
| Local | Zoning/rezoning is where blocks happen; state bills 300+ in 6 weeks of 2026 | [P/I] DCW Q1 2026 |
| Block/delay volume | see §2 row "Opposition"; opponents won (block or delay) 2 of 3 projects they protested (2025 report) [U NBC] | |
| Per-project probability | Not available as a rate. DCW counts $ not denominators. [D] rough: ~$200B disrupted in H1 2026 against ~$400-600B/yr US DC capex ⇒ ~20-35% of $ touched by opposition, mostly delays [D, capex denominator assumed] | gap |
| CBA practice | First public data-centre CBA Lancaster PA; FAS found 8 executed CBAs; terms are water caps, local hiring, funds; NJ guidance: roads, water/sewer mains | [I] FAS 2026 |

---

## 5. Transformers / switchgear (fold into construction)

| Item | Value | Source |
|---|---|---|
| Lead times | ~50 wk (2021) → 120 wk (2024), large 80-210 wk; Q2 2025: 128 wk power, 143-144 wk GSU; distribution 30 wk | [P] NIAC draft Jun 2024; [I] WoodMac 2025 |
| Supply | 2025 deficit 30% (power), 10% (distribution); ~80% of power transformers imported; GSU demand +274% 2019-25 | [I] WoodMac |
| Prices | Switchgear +60% Dec 2021 → early 2026 | [I] Cushman & Wakefield 2026 cost guide |
| Cost per GW | Power infrastructure = 21% of greenfield DC cost (C&W) ⇒ ~$3.7M/MW of $17.6M; 345 kV substation $50-120M for 0.3-1 GW ⇒ ~$50-150/kW [U/D] | [I] C&W 2026; cost guide |
| Game | Fold into construction: if construction would finish < transformer lead time (~10 q in 2025), construction time = max(build, ~8-11 q) unless ordered ahead [Design] | |

Facility capex cross-check: Epoch $11.4B/GW IT facility (May 2026) vs C&W all-in greenfield $17.6M/MW avg (range $8.9-23.3M), +21% since Q4 2024. C&W includes land, power infra, contingency; per facility-MW basis unclear. Keep Epoch for the model; note C&W as upper case.

---

## 6. Other real opportunities / trade-offs (short)

- **Flexibility is the cheapest speed lever**: accept curtailment ≈0.25-1% of hours ⇒ years faster grid (SPP CHILL, Duke headroom). Real trade, cheap in compute.
- **Overbuild tax on islanded gas**: off-grid sites need ~1.4-1.6x nameplate per IT MW; once grid arrives, turbines become backup/resale.
- **Existing-nuclear PPAs** (not restarts): Talen-AWS 1.92 GW, Constellation-Meta Clinton; front-of-meter structure avoids FERC co-location fights. Outside the designer's "restart only" scope; noted.
- **Speculative queue filing** is what real developers do (file in many places); utilities now charge deposits/fees ($14k ERCOT, ≥$100k SB6) and require site control.
- **Ratepayer politics**: PJM capacity price at cap ($333/MW-day 2027/28) feeds opposition; paying "full cost of service" (Meta-Entergy) is a real mitigation.

---

## 7. Differences from research/15 §1.3

1. **Gas max size 0.5-2.5 GW → 0.2-5 GW.** Real: Oracle-VoltaGrid 2.3 GW, Homer City 4.4-4.5 GW, Entergy-for-Meta >5.2 GW. Gas should not be capped below grid; grid sites are actually the smaller ones (≤~1 GW live today).
2. **Gas generation capex [Design] $1.5-2.5B/GW → $2.4-3.3B per GW IT** for on-site (incl. overbuild); CCGT ≥$2.0B/GW nameplate and rising with COD year.
3. **Gas wait is world state**: heavy-duty slots moved from ~2027-28 to 2029-32 delivery; small units 12-36 mo. Driver = OEM backlog/output (GE 122 GW vs ~20 GW/yr).
4. **Nuclear: "restart or uprate, 0.4-1 GW, 12-20 q, High capex" → restart only, 3 named units (0.615/0.8/0.835 GW), ~12-16 q, ~$1.9-3.1k/kW, ~1.3x grid price; finite and all taken by Oct 2025.**
5. **Grid wait was based on LBNL Queued Up (generation).** Replaced by load-side evidence: 3-4 yr (pre-2024) → up to 7 yr (Dominion 2024) → 5-7+ yr (PNNL 2025) → 10+ yr some markets (CBRE 2026). Queued Up's 61 months stays only as the time a brownfield/BYO-gen route avoids.
6. **New lever: flexible interconnection (≤90 days, curtailable).** Missing in research/15.
7. **Lease price 12%/yr of facility capex (~$114/kW-month) → $140-185/kW-month (~15-19%/yr)**; lease pool ≈ unleased under-construction stock (<1.5 GW in 2026).
8. **Transformers**: lead time 120-128 wk power, 143-144 wk GSU; folded into construction; switchgear +60%.
9. **Opposition intensity rose ~6x**: $64B over 10 months (2024-25) → $130B in Q1 2026 alone. CBA price anchor: NY ≥$1M/MW.
10. **Crash-build premium +35% and +20% block risk remain [Design]** - no source found.

## 8. Gaps / unverified

- No single dataset of load-side grid wait over time; series is stitched from utility statements and broker reports (several [U]). Best next step: ERCOT large-load status PDFs (energised GW per month), Dominion SCC filings, LBNL "Speed to Power" full report (site returned 403).
- 2023 baseline for heavy-duty turbine lead time not found.
- Crash-construction cost premium: no source.
- CBA effect on block/delay odds: no quantitative evidence.
- Per-project block/delay probability: DCW gives $ totals, no denominator.
- Brownfield wait: no data; [Design] 4-8 q kept.
- Palisades total restart cost; Crane cost $1.6B and PPA price (~$112-115/MWh) are press/analyst [U]; Duane Arnold $1.9B loan [U].
- Gas fuel price not fetched (assumed $3-4/MMBtu) in the on-site $/MWh derivation.
- GE Vernova $/kW pricing not disclosed (analysts note "softer pricing per kW" Q3 2026 from mix).
- C&W vs Epoch facility capex disagree (~$17.6M vs ~$11.4M per MW); basis unclear.
- SemiAnalysis on-site tech capex/lead times are analyst figures, not OEM filings.
