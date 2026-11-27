# Data-centre mockup (COMPUTE › Overview): notes

Files: `build.png` (default, speed-up options open), `build-tips.png` (Grid tile tooltip locked, opposition tooltip
open), `build.html` + `build.js` + `data.js` (source), `render.mjs` (copy of `market/render.mjs`). Render from this
folder: `node render.mjs build build:tips`. `current-overview.png` / `current.png` are the app's own Overview and Sites
tabs (UI-test screenshots, day 400, Nov 15: the shell has changed since, the cards have not).

Scope (designer, 2026-11-27): no Sites tab. Tabs become Overview · Orders · Market. Overview keeps the status strip,
the Capacity and fleet chart, Order chips and Rent cloud as they are (new numbers only). Build data centre keeps its
place and style; site rows move from the old Sites tab to under the chart. The grid pool, spare transformers,
transformer lead time and pre-order row are gone.

State: Jul 5, 2026 (Q3 26), L0 shell = the market mockup's day-369 values. Waits today: grid 20 q, turbines 9 q,
rent 4 q. 0.74 kW per H100e ⇒ 1.35M H100e per GW.

## Numbers (DATACENTERS.md §2–5, 1 GW, Q3 26)

| Source | Live | Upfront | Running /yr |
|---|---|---|---|
| Rent | 4 q ⇒ Q3 27 | $4.0B network | $1.8B rent + $0.75B power ≈ $2.6B |
| Grid | 1 + max(8, 20) = 21 q ⇒ Q4 31 | $14B + $0.2B = $14.2B | 8.6¢ × 8.76 TWh ≈ $0.75B |
| Gas | 2 + max(8, 9) = 11 q ⇒ Q2 29 | $14B + $3B = $17.0B | 0.5 × grid ≈ $0.4B |
| Gas as selected (rush power + community package) | 2 + max(8, 4) = 10 q ⇒ Q1 29 | $17.0B + $0.9B + $1.0B = $18.9B | $0.4B |

Speed-up savings shown are marginal on the current selection: crash −4 q (then max(4, 4)), rush power −1 q
(max(8, 9) → max(8, 4)), fast-track −1 q, community package block 12% → 6%. Opposition odds are illustrative:
gas 10% × 1.2 public mood = 12%, × 0.5 package = 6%; delay 30%. Pay-with tiles are today's component, values
illustrative.

Sites: Abilene North (rent 300 MW) and Abilene South (grid 300 MW) live = 0.60 GW; Ashburn Hall rent 200 MW, Q1 26
+ 4 q ⇒ Q1 27; Lone Pine gas 2.5 GW, committed Q4 25, permits to Q2 26 + 9 q turbines ⇒ Q3 28; Mesa Verde gas 1 GW,
committed Q2 26, permits to Q4 26 (opposition pending) ⇒ Q1 29; Red River grid 1 GW (was 2 GW; grid sites cap at 1),
committed Q3 25 at 18 q ⇒ Q2 30, construction from Q2 28. Chart: powered capacity = live GW × 1.35M (0.81M → 1.08M
Q1 27 → 4.46M Q3 28 → 5.81M Q1 29); chips on order exceed racks Q4 26–Q2 28 (idle, red), hence the status tile.

## IA map (one home per datum)

| Datum | Home | Level |
|---|---|---|
| Chips without racks, when | Status strip tile 2 | L1 |
| Powered capacity vs fleet, by quarter | Capacity and fleet chart | L1 |
| Per site: size, stage, live date, construction ‖ power bars | Sites rows under the chart | L1 |
| Racks used / live | Sites header bar | L1 |
| Pending block odds of a site + package button | Site row, permits stage only | L1; breakdown L3 |
| Site detail (capex paid, chips installed, pay terms) | Site row tooltip (as today) | L3 |
| Today's wait + size cap per source | Power tile | L2 |
| Upfront, power price, opposition level, wait trend, queue ÷ connections | Power tile tooltip | L3 |
| New site: cost, H100e, block/delay odds | Preview pills | L2; odds breakdown L3 |
| New site: live date and what sets it (construction or power) | Preview line | L2 |
| Speed-ups: price and saving | Options row (collapsed by default; open in build.png) | L2 |
| Payment options | Pay-with tiles (unchanged) | L2 |

## Glossary terms needed

Rent, grid, gas (power sources), rent wait, grid wait, turbine wait, firm queue, connections per year, upfront,
power price, opposition, public against data centres, permits, construction, power (stage), hall being built,
waiting for grid, crash construction, rush power, fast-track permits, community package, racks used, sites.
Retire: colo, brownfield, nuclear, grid pool, spare transformers, transformer lead time.

## Design questions raised

1. Speed-up savings depend on each other (crash saves 0 q on plain gas, 4 q once rush power is on). The options row
   shows the saving given the other choices.
2. Does the turbine wait start at commit or after permits? Mockup: after permits.
3. What is lost if a site is blocked (package paid upfront? turbine deposit?). Tooltip says "money spent so far".
4. The chips you have ordered outrun your racks from Q4 26 to Q2 28. Today only the status tile and the red bars show
   this; the build card does not say which source would close the gap in time (renting would by Q3 27).
