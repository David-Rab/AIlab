# Data-centre mockup (COMPUTE › Overview): notes

The mockup is today's real app with the redesign injected, so everything it does not change is the app as it is.
`render.mjs` loads the worktree build (`dist/index.html`) on the day-400 fixture (Aug 5, 2026), opens the build
options row, injects `build.js` and writes `build.png` / `build-tips.png` (1920 × 1080). `_shot.mjs` writes the
untouched reference shots `current-overview.png`, `current-orders.png`, `current.png` (old Sites tab). Run from the
worktree root: `node_modules/.bin/vite build && node design/ux/mockups/dc/render.mjs` (node_modules = junction to the
main checkout's).

## What changes (designer, 2026-11-27, round 3)

- Tabs: Overview · Orders & market (Sites goes).
- Status strip, Capacity and fleet chart, Buy chips, Rent compute, top bar, nav, bottom bar: unchanged. Chart marker
  Red River 2.0 → 1.0 GW (grid sites cap at 1 GW); chart height trimmed to make room for the site rows.
- Build data centre, same place and style:
  - Power tiles Rent / Grid / Gas show the **expected live date** for the chosen size and speed-ups, a delay band
    (+0–3q, opposition only; Rent has none) and the size cap. The wait, its 2023→26 trend and queue ÷ connections are
    in the tile tooltip.
  - Multi-GW unlocked (gas sites go to 5 GW); size limit chip 100 MW–5 GW.
  - Preview: capex, racks for +1.4M H100e, what sets the date (construction or power), opposition odds and when they
    are decided. The live date is on the tile only (one home).
  - Options row: crash construction, rush power, fast-track permits, community package, each with saving and price;
    company default kept. Pay-with tiles unchanged (values rescaled to the new cost).
- Site rows under the chart: construction ‖ power bars, live date, stage, block odds + package button in permits.
  Grid pool / spare transformers / transformer lead time / pre-order row removed.

## Numbers (Q3 26; DATACENTERS.md §2–5; waits today grid 20 q, turbines 9 q, rent 4 q)

Shown toggle state: Campus 1 GW, Gas, rush power + community package.

| Tile | Live | How |
|---|---|---|
| Rent | Q3 27 | rent wait 4 q |
| Grid | Q3 30 · +0–3q | 1 + max(8, 20 × 0.75 rush) = 16 q |
| Gas | Q1 29 · +0–3q | 2 + max(8, 4 used turbines) = 10 q; power ready Q1 28, construction sets the date |

Cost $14B + $3B turbines + $0.9B rush + $1.0B package = $18.9B. Savings given the shown state: crash −4 q, rush −1 q,
fast-track −1 q. Odds (illustrative): block gas 10% / grid 5%, × 1.2 public mood, × 0.5 package; delay gas 30%,
grid 20%, +1–3 q.

Sites = the fixture's four, translated (Abilene North colo → rent, Abilene South brownfield → grid, Lone Pine gas
1.2 GW live, Red River grid 2.0 → 1.0 GW: committed Q2 25 at 17 q, live Q4 29 as the chart marker says,
construction from Q4 27) plus **Mesa Verde**, 1 GW gas committed Jul 2026 (not in the fixture; added to show a site
in permits): permits to Q1 27, 9 q turbines ⇒ Q2 29, block 12% without package.

## Where the real app differs from the stale Nov-15 screenshot

Top bar: research speed, lead, cash · runway, loss-of-control risk (no capability/understanding bar, no
catastrophe gauge). Nav: Overview; R&D (Compute, Lab, Research, Training, Models, Products, Safety); Company & world
(Finance, Relations, World); Codex. Bottom bar: "1 to watch · 5 alerts" + event ticker. Header link "Compute
allocation". Cards: "Buy chips" (deposit / on-delivery / arrival / cash → runway lines, supplier terms) and "Rent
compute" (1 q · 1 yr · 2 yr · 4 yr terms, payment lines, spot cap). Build card already has Pay-with tiles, a cash →
runway line and limit chips.

## IA map

| Datum | Home | Level |
|---|---|---|
| Expected live date per source (+ delay band), size cap | Power tile | L2 |
| Wait today, trend 2023→26, queue ÷ connections, upfront, power price, odds | Power tile tooltip | L3 |
| Capex, H100e, what sets the date, opposition odds | Preview lines | L2; odds breakdown L3 |
| Speed-ups: saving and price | Options row (collapsed by default) | L2 |
| Per site: bars, live date, stage, pending block odds + package | Site rows | L1 |
| Racks used / live | Sites header | L1 |

Glossary: rent / grid / gas (sources), grid wait, turbine wait, rent wait, firm queue, connections per year, permits,
construction, power, opposition, public against data centres, crash construction, rush power, fast-track permits,
community package, sites. Retire: colo, brownfield, nuclear, grid pool, spare transformers, transformer lead time.

## Open questions

1. Savings depend on each other (crash saves 0 q on plain gas, 4 q with rush power); tiles and options show values
   given the current toggles.
2. Turbine clock: starts after permits (assumed).
3. What is lost on a block (package? turbine deposit?).
4. The chart's planned capacity still comes from today's engine; it will move once sites follow the new rules.
