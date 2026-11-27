# Data centres and power (redesign)

Status: draft for designer approval (2026-11-27). Replaces the site/power model of V2-SPEC §3.8 and research/15 §1.3.
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
| Power ready in | 1 q if free halls remain this quarter, else reserve a hall under construction: 4–10 q | **Grid wait** (world, §4): ~12 q in 2023 → ~20 q in 2026 | **Turbine wait** (world, §4): ~6 q in 2023 → ~10 q in 2026 |
| Permits | none | 1 q | 2 q (air permits) |
| Construction | none (the landlord builds) | 8 q | 8 q |
| Size per site | up to 1 GW, and what free halls are left | up to 1 GW | up to 5 GW |
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
- **Turbine wait** = 4 × (turbine backlog ÷ turbines delivered per year). Backlog = everyone's gas sites, labs and outside world. Output grows ~10–15%/yr to 2030 (GE Vernova, Siemens Energy filings). Calibrate: ~6 q in 2023, ~10 q in 2026 for small turbines.
- **Free halls** (rent): a pool of unleased halls each quarter, ~1.5 GW in 2026 (CBRE: < 1.5 GW unleased under construction), growing with the market; all buyers draw on it. When it is gone, renting means reserving a hall still being built (4–10 q).

No cap on how many GW a player can start. Building more lengthens your own and everyone's waits.

## 5. Paying to go faster

Chosen on the build card; each shows its price and the quarters it saves.

| Lever | What it does | Cost | Source |
|---|---|---|---|
| Crash construction | Construction 8 q → 4 q | +35% building cost, higher opposition odds | 4 q: xAI Colossus 2 (Epoch). Premium **[design]** |
| Rush power (grid) | Pay for the substation and lines yourself instead of waiting for the utility's schedule: grid wait − 25% **[design]** | +$0.3B per GW **[design, range $0.05–0.3B unverified]** | LBNL "Speed to Power" (2026) |
| Rush power (gas) | Buy used or refurbished turbines: turbine wait → 4 q | +30% turbine cost **[design]** | SemiAnalysis: used units in < 12 months |
| Fast-track permits | Permits − 1 q (gas 2 → 1) | ~1% of building cost **[design]** | Federal fast-track for > 100 MW sites (EO 14318) |
| Community package | Block odds × 0.5 | ≈ 9% of building cost ($1M per MW) | NY Community Investment Framework (Sep 2026). Effect on odds **[design]**: no data |

The community package rises from 3% to ~9% of the building cost (the sourced benchmark).

## 6. Removed

Overlap; random power-wait draw; grid pool and queue credit; transformer stock and pre-order button (cost folded into the building); brownfield; nuclear; 6% book-value loss on stored chips (chips in storage simply earn nothing).

## 7. Other systems this touches

- **Starting sites:** today's starts use brownfield (division start) and a 2 GW grid site. They become grid or gas sites within the new limits.
- **Bots** (finance/plan.ts) choose brownfield or gas: switch them to the three sources.
- **Outside-world demand** for grid connections, turbines and halls: a reference path calibrated to §4, like the chip market's outside buyers.
- **Rivals** have no sites today. They count in the waits only through outside-world demand **[design: or give rivals sites later]**.
- **Saves:** a migration for sites on removed paths.
- **Glossary:** rewrite the site, power-source, wait and lever terms.

## 8. Open values to set

Crash premium; rush-power effects and prices; fast-track price; community package effect; opposition odds per source (Data Center Watch gives dollars blocked, not a rate per project); gas running cost (needs a gas price); outside-world demand paths.
