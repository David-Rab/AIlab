# Compute tab redesign

Status: built (Nov 2026). Mockup: `mockups/08-compute.png` (source `mockups/compute.html`); the built tab differs where noted below. Scope: the Compute panel and the
idle-chip warning. Out of scope: the opening chip order, Lone Pine, Act 1 unlocks, and what the warning's fix points to.

## Audit (current tab, day 0 / 120 / 200 / 400 / 900)

| Element | Problem | Fix |
|---|---|---|
| Whole tab | Six cards of equal weight at first glance: site timeline, grid KVs, new-site form, chip market, cloud, order form, deliveries. Nothing says what matters. | One verdict strip, one chart, three actions. The rest moves to tabs. |
| Idle chips | The count lives in Company › Flow. On Compute, "MW used / cap" reads 600 / 600 **in green** while 752K chips sit dark. | An idle verdict on Compute, red, with the date it clears. |
| Stock and flow | Sites (timeline), orders (deliveries) and cloud (list) are three separate views on three different axes. You can't see when chips and racks meet. | A single forecast chart: capacity line against fleet bars over a shared quarter axis. |
| "Idle · no power" | Counts chips in transit (one-quarter install lag) as unpowered. Fires on every large delivery, even with free racks. | Split into **Installing** (fits in free racks) and **Idle** (no rack space). Warn only on Idle. |
| Sliders | Site MW 100–5,000, chip qty 0.05–5M, cloud qty, LTA length: continuous values with no sense of scale. | Named tiers (below). LTA and cloud terms become 1 / 2 / 3 yr and 1 / 3 / 5 yr. |
| Raw numbers | kW per H100e `0.83`, Taiwan risk `0.36`, grid pool `587 MW` at first glance. | Demoted to the Sites / Market tabs, each with a tooltip. |
| Empty states | "No chips on order" deliveries card fills half the screen late game. | The card is gone at L1; the chart carries it. |

## Sizes

Data centres and chips use separate scales. Industry vocabulary: an AI **data hall** is ~50–100 MW (Stargate Abilene's
first phase: 206 MW over two halls), a flagship **building** 100–300 MW, a **campus** several buildings up to ~1 GW (the
largest live sites in late 2026 are ~1 GW, Epoch AI data centers hub), and announced **multi-gigawatt campuses** reach
5 GW. "Mega" and "giga" are not standard size terms. Chip purchases are quoted as GPU counts, never named tiers.

| Data centre | MW | Largest power source that reaches it |
|---|---|---|
| Hall | 100 | any |
| Building | 300 | any |
| Campus | 1,000 | Colo, Brownfield, Nuclear top out here |
| Large campus | 2,500 | Gas tops out here |
| Multi-GW campus | 5,000 | Grid only |

Chip orders and cloud contracts: fixed **100K · 250K · 500K · 1M · 2.5M H100e**. Each tile shows the rack power that
batch needs at today's kW per H100e (e.g. 500K ≈ 414 MW in Jan 2026), which ties chips to data-centre sizes without
naming them after buildings. LTA terms 1 / 2 / 3 yr; cloud terms 1 / 3 / 5 yr. Unavailable sizes are greyed out with the
reason in the tooltip.

## Built differences from the mockup

- The chart shows up to 4 recorded past quarters (end-of-quarter snapshots kept by `computeHistQ`, dimmed), the
  current quarter and 10 planned quarters. Events past the horizon (a site going live, a cloud contract ending) are
  listed at the top right.
- The y-axis always fits the tallest value, including a new multi-GW site, so nothing runs off the top.
- The second verdict also covers chips that will arrive with no racks (peak and the quarter it clears).
- Site stage "building" is shown as "construction" so it doesn't clash with the Building size.

## Information architecture

One home per datum. `→` = link to the home, never a copy.

| Datum | Level | Home | Elsewhere |
|---|---|---|---|
| Idle chips (no rack space), clear date | L1 | Compute › Overview verdict | Company › Flow stub → link; Overview watch alert → Compute |
| Empty racks ahead (size, from when) | L1 | Compute › Overview verdict | — |
| Vendor fill, binding component | L1 | Compute › Overview verdict | detail → Market tab |
| Capacity and fleet forecast (capacity, running, cloud, installing, idle, planned) | L1 | Compute › Overview chart | — |
| Per-quarter breakdown, site and order events | L3 | chart tooltip | — |
| Order chips / Build data centre / Rent cloud (tier, cost, ETA, risk) | L1 | Compute › Overview action cards | — |
| Order type, non-Taiwan, LTA term; crash build, community deal, SPV; cancellable cloud, spot rental | L2 | "Options" fold-out in each action card | — |
| Compute online (now), split by pool | L1 | Company › Flow | Compute header → "Compute split" link |
| Sites: stage, ETA, block/delay odds, capex paid, chips installed | L2 | Compute › Sites (build timeline, click a row for detail) | chart events → link |
| Community deal on a permitting site | L2 | Compute › Sites row | — |
| Grid pool, transformers, transformer lead time, kW per H100e | L2 | Compute › Sites footer | — |
| Open orders by quarter, delivered / ordered | L2 | Compute › Orders (deliveries) | — |
| Cloud contracts, end dates, cost | L2 | Compute › Orders | Finance ledger → link |
| Component supply, supply vs demand, prices (list / spot / rental sparklines), allocation weight, export policy, Taiwan risk, fund a supplier | L2 | Compute › Market | — |
| Every term above | L3 | glossary tooltip | — |

Tab badge: **Sites** gets a warning dot while chips are idle or a site is at risk of being blocked.

## Engine changes needed

- `chipFit(s)`: split delivered inventory into `installing` (fits free MW in live sites) and `idle` (does not).
  The watch alert and the Company › Flow stub use `idle` only. The alert keeps pointing at the Compute tab.
- `computeForecast(s, quarters)`: a read-only projection per quarter of owned rack capacity (live sites, plus planned
  sites at their expected live quarter, at the projected kW per H100e), cloud in force, owned chips (installed + inventory +
  open orders at full fill, one-quarter install lag), running = min(chips, racks) + cloud. Uses only what the player
  can see: no block rolls, no hidden state. Uncertain sites (still permitting) are drawn dashed with their odds in the tooltip.
- `tierMW` / `tierChips` helpers for the tile values.

## Glossary additions

`poweredCapacity`, `emptyRacks`, `installing`, `vendorFill`, `siteTier` (with Hall / Facility / Campus / Mega / Giga),
`colo`, `brownfield`, `gasPower`, `gridPower`, `nuclearPower`. Existing: `idleChips`, `listPrice`, `cloudContract`,
`lta`, `communityPackage`, `crashBuild`, `spv`, `transformers`, `gridPool`, `kwPerH100e`.
