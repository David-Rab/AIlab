# Data-centre redesign: what it moves (for the calibration effort)

Branch `dc`, design `design/DATACENTERS.md`, sources `research/23-datacenter-sites.md`. The redesign did no calibration
work on purpose (designer, 2026-11-27): calibration belongs to the general calibration effort. This note lists every
change that can move timelines, compute, money or balance, old → new, so calibration knows where to look. Per the
standing rule, a missed target points at a mis-tuned sourced mechanism, never a forcing rule.

## Compute timing (biggest movers)

| Change | Old | New | Where |
|---|---|---|---|
| Leader start: Red River | 2 GW grid, live ≈ 2028 | 1 GW grid, live Q4 2029 (construction from Q4 2027) | `initialSites` |
| Leader start: Lone Pine | 1.2 GW gas, one building | 4 × 300 MW gas campus, same total, cost, live date | `initialSites` |
| Live date | permits + power beyond overlap + 8 q; random power draw | permits + max(construction, power); wait fixed at commit | `sites.ts` |
| Construction time | 8 q (crash 4 q) at any size | 9.5 q × (building GW)^0.4: 100 MW 4 q, 300 MW 6 q, 1 GW 10 q; crash × 0.5 | `siteBuildQ` |
| Campuses | one site = one block of MW | 1 / 3 / 5 identical buildings, one per quarter, phased go-live | `newSite`, `siteLiveMW` |
| Building size | any MW up to the source cap | ≤ 1 GW per building (hard rule); campus total ≤ source cap | `siteFit`, action |
| Power sources | lease / brownfield / gas / grid / nuclear | rent / grid / gas | `SOURCES` |
| Grid wait (reference) | random 12–24 q draw + grid pool (labs 35% of 1.5 GW/q, whole site in one quarter) | world wait 12 → 20 q (2023–26), 20 / 17 / 13 / 10 q (2027–30) + 4 × your queued GW ÷ 30 GW/yr | `waits.ts`, `WAIT_REF` |
| Turbine wait | gas power draw 6–12 q | world wait 4 → 9 q (2023–26), easing to 6 q by 2030; rushed gas counts in the backlog | `waits.ts` |
| Rent | lease pool 0.6 GW/q ×1.4/yr, 1–3 q fit-out | rent wait 1 → 4 q; halls 6 GW/yr in 2026 ×1.3/yr | `waits.ts` |
| Transformers | 9 q gate unless pre-ordered (3 GW start stock) | gone (folded into construction) | — |
| Speed-ups | crash only | crash (×0.5 construction, +35% building, odds ×1.5), rush power (grid wait ×0.75 +$0.3B/GW; gas used turbines 4 q +30% turbines), fast-track (−1 q permits, +5% building), community package | `LEVERS` |

## Money

| Change | Old | New |
|---|---|---|
| Building cost | $14B/GW facility+network (grid +0.5, gas +2, nuclear +4) | $14B/GW building; grid +$0.2B, gas +$3B turbines per GW |
| Size economy | none | none; repeating a design: −10% (3 buildings), −15% (5) |
| Rent | $1.2B per GW-year (start colo too) | $1.8B per GW-year (start rent sites too; leader S1 rent +50%) |
| Power price | grid 1×, gas 1.3×, nuclear 0.8×, × (1 + κ 5–15% capacity price) | grid 1×, gas 0.57× (fuel + O&M), no κ (bills ≈ −5% at start) |
| Community package | 3% of capex | $1B per GW of the campus |
| Chip inventory | book value −6%/q while stored | no decay (O&M on chip book slightly higher) |
| Capex schedule | 5% at start, rest over building quarters | 5% of the campus at commit; each building's rest over its own construction |
| Financing lease | one lease at go-live | one lease per building at that building's go-live; runway projects per building |
| Leader Red River capex | $29B | $14.2B |

## Opposition

Block / delay odds per source (grid 5% / 20%, gas 10% / 30%; rent none) × public mood (`pub.dcNimby` ÷ 50, ≈ 0.9 at a
2025 start, ≈ 1.2 at day 400), crash × 1.5, community package block × 0.5; one roll per site (campus). Was:
5% + 10%·anti + 5% gas + 5% crash.

## Bots

The player bot (`finance/plan.ts`) now picks grid or gas campuses (building tier × 1/3/5) with every useful speed-up,
earliest first building wins; rent halls snap to a tier. In seed 1 to mid-2027 it committed ≈ $300B of gas campuses
(8 of 9 sites campuses; grid never chosen while gas is faster). Bot competence and spend size are calibration items.

## Open sourced-parameter questions

- Rush power and fast-track prices, crash premium, community-package effect on block odds, per-source opposition odds:
  design values (no per-project rates in the data).
- Grid wait 2027–30 easing and turbine-wait easing: design values (reforms, OEM expansion).
- Rivals have no sites; they count in the waits only through the outside-world reference path.
