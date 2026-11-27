# Data centres and power (redesign)

Status: approved by the designer 2026-11-27 (mockup design/ux/mockups/dc/build.png). Replaces the site/power model of V2-SPEC §3.8 and research/15 §1.3.
**Scope: sites and power only.** Financing (pay options, capex leases, debt), the chip market, cloud rental and
everything else stay as they are.
Data: research/23-datacenter-sites.md. Values marked **[design]** have no source and are ours to set.

## 1. What the system must show the player

Only the real decisions:
1. **Speed vs size vs cost.** Rent is fast, small and costly to run. Building is slow and cheap over time. Grid and gas trade wait, size, upfront cost and power price.
2. **Committing early under uncertainty.** Sites take 2–5 years: billions go in before demand and funding are known.
3. **Power is the bottleneck, and it tightens.** Grid queues and turbine backlogs grew from 2023 to 2026, and every lab's building adds to them.
4. **Local opposition.** Sites get blocked or delayed. Money lowers the risk.
5. **Matching chips to space.** Chips with no space earn nothing. Space with no chips is wasted capex.

Nothing else. No overlap, no hidden dice for the power wait, no grid pool, no transformer stock, no brownfield, no nuclear.

## 2. Power sources

Each source has an upfront cost **or** a higher power price, never both.

| | Rent | Grid | Gas |
|---|---|---|---|
| What it is | A hall in a colocation or neocloud campus | A new connection from the utility | Your own turbines on site |
| Power ready in | **Rent wait** (world, §4): ~1 q in 2023 → ~4 q in 2026 | **Grid wait** (world, §4): ~12 q in 2023 → ~20 q in 2026 | **Turbine wait** (world, §4): ~4 q in 2023 → ~9 q in 2026 |
| Permits | none | 1 q | 2 q (air permits) |
| Construction | none (the landlord builds) | 9.5 q at 1 GW (10 q) | 9.5 q at 1 GW (10 q) |
| Size per site | up to 1 GW | up to 1 GW | up to 5 GW |
| Upfront cost per GW | network only ($4B) | building $14B + utility upgrades $0.2B | building $14B + turbines $3B |
| Running cost | rent ≈ $1.8B per GW-year (≈ $150/kW-month), 5-year lease, plus grid power | grid power 1.0× | fuel and upkeep ≈ 0.5× grid |
| Opposition | none (the landlord's problem) | medium | high |

Sources: rent $139–185/kW-month (CBRE H1 2026, Applied Digital leases); building $11.4B/GW IT facility + $4.9B network (Epoch, May 2026), kept as today's $10B + $4B per GW of facility power; turbines $1.7–2.0k/kW × 1.4–1.6 overbuild (SemiAnalysis) → $2.4–3.3B/GW; grid sites ≤ ~1 GW live today (Epoch hub); gas campuses 2.3–5.2 GW (Oracle-VoltaGrid, Homer City, Entergy for Meta); grid upgrades $0.05–0.3B/GW [unverified]; gas running cost from Lazard LCOE minus capex **[needs a gas-price source]**. Transformers and switchgear are part of the building cost and construction time.

Grid tariff: EIA industrial 8.1¢/kWh (2024), 8.6¢ (2025).

## 3. A site's life

```
Permits ──► Construction ─────────┐
            Power ───────────────►├──► Live ──► chips install (1 q)
```

- **Live date = permits + max(construction, power).** Power and construction run side by side.
- Construction is **timed to finish when power arrives**, so a grid site's building money is spent as late as possible. The player sees two bars and one live date.
- **Opposition roll** at the end of permits: blocked (money spent is lost) or delayed 1–3 q. Odds rise with the anti-data-centre public and are highest for gas. Shown as low / medium / high with exact odds in the tooltip.
- **The wait is fixed when you commit.** The build card shows today's wait; the site keeps that date (unless opposition delays it). No hidden roll later.

## 4. Waits that follow the world

One number per source, shown on the build card ("Grid wait today: 20 q").

- **Grid wait** = base × (firm queue ÷ connections per year). Queue = everyone's grid sites waiting, including labs and the outside world (hyperscalers, other industry). Calibrate: ~12 q in 2023, ~16–20 q in 2025, ~20 q in 2026 (Dominion, CBRE, PNNL-38441); reforms and new transmission ease it only after ~2028 **[design]**.
- **Turbine wait** = 4 × (turbine backlog ÷ turbines delivered per year). Backlog = everyone's gas sites, labs and outside world. Output grows ~10–15%/yr to 2030 (GE Vernova, Siemens Energy filings). Calibrate: ~4 q in 2023, ~9 q in 2026 for small turbines.
- **Rent wait** = time until a hall you can lease is ready: unleased halls on the market ÷ everyone's demand. Finished halls are almost all taken (vacancy 1.4%, CBRE H1 2026) and new ones are leased 2–3 years before completion (PNNL-38441), so in 2026 renting means waiting for a hall being built. Calibrate: ~1 q in 2023 **[design: no pre-2025 source]**, ~4 q in 2026 (< 1.5 GW unleased under construction ≈ 6 months of demand, CBRE).

Reference schedule (the waits when the player builds nothing; your and rivals' building pushes them up):

| Wait | 2023 | 2024 | 2025 | 2026 | 2027 | 2028 | 2029 | 2030 |
|---|---|---|---|---|---|---|---|---|
| Grid | 12 q | 16 q | 18 q | 20 q | 20 q | 20 q | 18 q | 16 q |
| Turbines | 4 q | 6 q | 8 q | 9 q | 9 q | 8 q | 7 q | 6 q |
| Rent | 1 q | 2 q | 3 q | 4 q | 4 q | 4 q | 4 q | 4 q |

Sources: grid 3–4 yr typical before 2024 → up to 7 yr (Dominion 2024), 5–7+ yr (PNNL 2025), 10+ yr in some markets (CBRE 2026), taken as a national middle; small turbines ~12 months (2023) → 12–36 (2025) → 15–36 (2026) (SemiAnalysis); rent as above. **Every 2027–30 value is [design]**: grid eases after reforms and new transmission (ERCOT batch studies, PJM expedited track), turbines ease as makers expand (GE → 24 GW/yr, Siemens → 30+ GW/yr by 2028–30), rent stays tight (JLL: tight through 2030).

No cap on how many GW a player can start. Building more lengthens your own and everyone's waits.

## 5. Paying to go faster

Chosen on the build card; each shows its price and the quarters it saves.

| Lever | What it does | Cost | Source |
|---|---|---|---|
| Crash construction | Construction time × 0.5 (1 GW: 10 q → 5 q) | +35% building cost, higher opposition odds | 1 GW in ~4 q: xAI Colossus 2 (Epoch). Premium **[design]** |
| Rush power (grid) | Pay for the substation and lines yourself instead of waiting for the utility's schedule: grid wait − 25% **[design]** | +$0.3B per GW **[design, range $0.05–0.3B unverified]** | LBNL "Speed to Power" (2026) |
| Rush power (gas) | Buy used or refurbished turbines: turbine wait → 4 q | +30% turbine cost **[design]** | SemiAnalysis: used units in < 12 months |
| Fast-track permits | Permits − 1 q (gas 2 → 1, grid 1 → 0) | 5% of building cost (~$0.7B per GW) **[design]** | Federal fast-track for > 100 MW sites (EO 14318) |
| Community package | Block odds × 0.5 | $1M per MW ($1B per GW, ≈ 7% of the building) | NY Community Investment Framework (Sep 2026). Effect on odds **[design]**: no data |

The community package rises from 3% to ~7% of the building cost ($1M per MW, the sourced benchmark).

## 5b. Size: construction time and economies of scale (designer, 2026-11-27)

- **Construction time grows sub-linearly with size:** 9.5 q × (GW)^0.4 (100 MW 4 q, 300 MW 6 q, 500 MW 7 q, 1 GW 10 q, 2.5 GW 14 q, 5 GW 18 q); crash construction halves it.
- **Building cost per GW falls with size:** building $14B per GW × (GW)^−0.05 (100 MW $15.7B/GW, 1 GW $14B, 5 GW $12.9B). Crash and fast-track prices are shares of this scaled building cost; turbines, utility upgrades, rush and the community package stay per GW.
- So many small sites are faster, one big campus is cheaper: 5 × 1 GW = $70B live in 10 q; 1 × 5 GW ≈ $64.5B live in 18 q (building only).
- **Rushed gas sites count in the turbine backlog** like any gas site (replaces [D-5]).
- Exponents are now sourced: time 0.4 from the Epoch timelines fit (research/23 §9); cost −0.05 is a design value at the top of what the data allow.

## 6. Removed

Overlap; random power-wait draw; grid pool and queue credit; transformer stock and pre-order button (cost folded into the building); brownfield; nuclear; 6% book-value loss on stored chips (chips in storage simply earn nothing).

## 7. Other systems this touches

- **Starting sites:** today's starts use brownfield (division start) and a 2 GW grid site. They become grid or gas sites within the new limits.
- **Bots** (finance/plan.ts) choose brownfield or gas: switch them to the three sources.
- **Outside-world demand** for grid connections, turbines and halls: a reference path calibrated to §4, like the chip market's outside buyers.
- **Rivals** have no sites today. They count in the waits only through outside-world demand **[design: or give rivals sites later]**.
- **Saves:** no migration; old saves may break (bump the schema rev).
- **Glossary:** rewrite the site, power-source, wait and lever terms.

## 8. Open values to set

Crash premium; rush-power effects and prices; fast-track price; community package effect; opposition odds per source (Data Center Watch gives dollars blocked, not a rate per project); gas running cost (needs a gas price); outside-world demand paths.
