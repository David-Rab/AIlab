# Data-centre mockup (COMPUTE › Overview): notes

The mockup is the real app with the redesign injected, so everything it does not change is the app as it is.
`render.mjs` loads `dist/index.html` on the day-400 fixture (Aug 5, 2026), opens the build options row, injects
`build.js` and writes `build.png` / `build-tips.png` (1920 × 1080). `_shot.mjs` writes the untouched reference shots
`current-overview.png`, `current-orders.png`, `current.png` (old Sites tab). Previous approved round: `build-v3.png`,
`build-tips-v3.png`.

**Build the app the mockup sits on from commit 40883209** (the UI before the DC engine tasks): the branch's engine no
longer loads the day-400 fixture's old site paths (blank page). From the worktree root:
`mkdir -p design/ux/mockups/dc/_app && git archive 40883209 src index.html vite.config.ts tsconfig.json | tar -x -C design/ux/mockups/dc/_app`,
then in `_app`: `../../../../../node_modules/.bin/vite build --outDir ../../../../../dist --emptyOutDir`, then
`node design/ux/mockups/dc/render.mjs` from the root (node_modules = junction to the main checkout's; `_app` is scratch).

## What changes (designer, 2026-11-27)

Round 3 (approved):
- Tabs: Overview · Orders & market (Sites goes).
- Status strip, Capacity and fleet chart, Buy chips, Rent compute, top bar, nav, bottom bar: unchanged. Chart marker
  Red River 2.0 → 1.0 GW (grid sites cap at 1 GW); chart height trimmed to make room for the site rows.
- Build data centre, same place and style: power tiles Rent / Grid / Gas with the **expected live date**, delay band
  (+0–3q, opposition only; Rent has none) and size cap; wait, trend and queue ÷ connections in the tile tooltip.
  Preview: capex, racks for H100e, what sets the date, opposition odds and when decided. Options row: crash
  construction, rush power, fast-track permits, community package, each with saving and price. Pay-with tiles
  unchanged (values rescaled).
- Site rows under the chart: construction ‖ power bars, live date, stage, block odds + package button in permits.

Round 4, campuses (DATACENTERS.md §5b):
- **Size tiles = one building:** 100 MW · 300 MW · 1 GW, each with its construction time (4 / 6 / 10 q; values given
  the toggles, so crash halves them).
- **Buildings row** under the size tiles (hidden for Rent): 1 · 3 · 5, the repetition saving (−10% / −15%) and the
  campus total (5 × 1 GW = 5 GW). Combos over the chosen source's cap lock the button (tooltip: "Grid sites take up to
  1 GW"); as today, picking a power source whose cap the campus exceeds cuts the campus to fit, so the other source
  tiles stay clickable and show the date and size they would give (Grid: "Q4 31 · 1 × 1 GW", cap in amber).
- **Power tiles:** line 1 = live date, a first → last range for a campus ("Q3 29 → Q3 30"), one date when power binds
  and all go live together; line 2 = delay band · cap.
- **Preview:** capex with "repeat design saves $10.5B"; racks for +7.0M H100e (the campus total), 1.4M per building
  as each goes live; "construction sets the dates"; runway warns (8q+ → 6q).
- **Site rows:** one row per site. Size column = building blocks filling in (green = live) + campus total; live column
  = first → last range (one date when all go together); stage "4 of 5 live · 1 in construction"; one diamond per
  building on the track (filled = live, outlined = planned).
- **Tooltip (build-tips.png):** Buildings row (locked): what a campus is, a small schedule (permits, power ready,
  buildings 1–5 starting one per quarter, each live date and +1.4M), cost with the repeat-design saving, saving by
  count, what is shared (one permit, one opposition roll, one power connection), largest campus per source, the
  power-binds example (grid 3 × 300 MW all live Q4 31), what a block costs. Grid tile tooltip: the 1 GW cap and what
  choosing Grid does. The round-3 opposition tooltip is unchanged and not re-shown.

## Numbers (Q3 26; DATACENTERS.md §2–5b; waits today grid 20 q, turbines 9 q, rent 4 q)

Shown state: 1 GW buildings × 5, Gas, no speed-ups (the §5b worked example).

| Tile | Live | How |
|---|---|---|
| Rent | Q3 27 | one 1 GW hall, rent wait 4 q |
| Grid | Q4 31 · +0–3q | cut to 1 × 1 GW: 1 + max(20, 10) = 21 q |
| Gas | Q3 29 → Q3 30 · +0–3q | building k: 2 + max(9, 10 + k) = 12 … 16 q; power ready Q2 29, construction sets the dates |

Cost 5 × $14B × 0.85 + 5 × $3B turbines = $74.5B (saving 5 × 14 × 0.15 = $10.5B). Pay with: cash PV $66.0B,
lease $121.4B total, PV $70.8B (illustrative). Options given the shown state: crash −1 to −5 q (all buildings at 11 q),
+35% × $59.5B = $20.8B; rush power 0 q (construction binds), +30% × $15B = $4.5B; fast-track −1 q, 5% × $59.5B =
$3.0B; community package $1M/MW × 5 GW = $5.0B. Odds: block gas 10% × 1.2 public mood = 12%, delay 30%, one roll for
the campus, decided when permits end (Q1 27). Cash after commitment: 5% of the campus ⇒ $51.7B → $48.0B.

Sites = the fixture's four, translated, two of them as campuses:
- Abilene North rent 300 MW, Abilene South grid 300 MW: live.
- **Lone Pine**, gas campus 5 × 300 MW (was 1.2 GW live): power Q4 25, buildings live Q4 25 … Q4 26, 4 of 5 live today
  (1.2 GW, so racks live stays 1.8 GW).
- **Mesa Verde**, gas campus 3 × 300 MW committed Jul 2026, in permits to Q1 27; turbines 9 q bind ⇒ all three live
  Q2 29; block 12%, package $0.9B.
- Red River grid 1.0 GW: committed Q2 25 at 17 q, live Q4 29 (chart marker), construction from Q4 27.

## IA map

| Datum | Home | Level |
|---|---|---|
| Building size, construction time per size | Size tiles | L2 |
| Building count, repetition saving %, campus total GW | Buildings row | L2 |
| Campus schedule, cost breakdown, shared permit/roll/connection, cap per source | Buildings row tooltip | L3 |
| Expected live date (range for a campus, + delay band), cap / what fits | Power tile | L2 |
| Wait today, trend 2023→26, queue ÷ connections, upfront, power price, odds | Power tile tooltip | L3 |
| Capex, saving in $, campus H100e, what sets the dates, opposition odds | Preview lines | L2; odds breakdown L3 |
| Speed-ups: saving and price | Options row (collapsed by default) | L2 |
| Per site: buildings live (blocks), total GW, bars, building diamonds, live range, stage, pending odds + package | Site rows | L1 |
| Racks used / live | Sites header | L1 |

Glossary: rent / grid / gas (sources), grid wait, turbine wait, rent wait, firm queue, connections per year, permits,
construction, power, opposition, public against data centres, crash construction, rush power, fast-track permits,
community package, sites, **building** (one data-centre building of 100 MW, 300 MW or 1 GW), **buildings** / **campus**
(1, 3 or 5 identical buildings on one site: one permit, one opposition roll, one power connection; they go live one
per quarter), **repeat design** (the campus saving on building cost, −10% for 3, −15% for 5), **buildings live**
("4 of 5 live"). Retire: colo, brownfield, nuclear, grid pool, spare transformers, transformer lead time, hall /
large campus / multi-GW as size names.

## Open questions

1. Savings depend on each other (crash saves 0 q on plain gas, 4 q with rush power); tiles and options show values
   given the current toggles. On a campus a lever can save different amounts per building (crash: −1 q first,
   −5 q last); shown as a range.
2. Turbine clock: starts after permits (assumed).
3. What is lost on a block (package? turbine deposit?).
4. The chart's planned capacity still comes from today's engine; it will move once sites follow the new rules.
5. Over-cap source tiles: they cut the campus to fit when chosen (today's behaviour for size) rather than lock; the
   Buildings buttons lock instead. Alternative: lock the source tile until the player reduces the campus.
6. Campus H100e is "+7.0M" in the preview; the chart's planned bars should then step up building by building.
