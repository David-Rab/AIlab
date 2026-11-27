# Data-centre mockup (COMPUTE › Sites): notes

Files: `build.png` (default), `build-tips.png` (grid-wait tooltip locked, opposition tooltip open), `build.html` +
`build.js` + `data.js` (source), `render.mjs` (copy of `market/render.mjs`). Render from this folder:
`node render.mjs build build:tips`. `current.png` / `current-overview.png` are the app's own Sites and Overview tabs
(uitest shots, day 400, Nov 15 build: the shell has changed since, the cards have not). Today the build card sits on
Overview; the mockup moves it to Sites, next to the sites it creates.

State: Jul 5, 2026 (Q3 26), L0 shell = the market mockup's day-369 values. Waits today: grid 20 q, turbines 10 q
(schedule 9 q + the player's own gas sites), rent 4 q. 0.74 kW per H100e ⇒ 1.35M H100e per GW.

## Numbers (DATACENTERS.md §2–5, 1 GW, Q3 26)

| Source | Live | Upfront | Running /yr |
|---|---|---|---|
| Rent | 4 q ⇒ Q3 27 | $4.0B network | $1.8B rent + $0.75B power ≈ $2.6B |
| Grid | 1 + max(8, 20) = 21 q ⇒ Q4 31 | $14B + $0.2B = $14.2B | 8.6¢ × 8.76 TWh ≈ $0.75B |
| Gas | 2 + max(8, 10) = 12 q ⇒ Q3 29 | $14B + $3B = $17.0B | 0.5 × grid ≈ $0.4B |
| Gas as selected (rush power + community package) | 2 + max(8, 4) = 10 q ⇒ Q1 29 | $17.0B + $0.9B + $1.0B = $18.9B | $0.4B |

Lever savings are marginal on the current selection: crash −4 q (construction then no longer binds: max(4, 4)),
rush −2 q, fast-track −1 q. Opposition odds are illustrative [design]: gas 10% base × 1.2 public mood = 12% block,
× 0.5 package = 6%; delay 30%. Sites: Lone Pine 2.5 GW gas committed Q4 25 (9 q turbines ⇒ Q3 28); Mesa Verde 1 GW
gas committed Q2 26 (permits to Q4 26 ⇒ Q1 29); Red River 1 GW grid committed Q3 25 at 18 q ⇒ Q2 30, build starts
Q2 28; Ashburn Hall 200 MW rent, Q1 26 + 4 q.

## IA map (one home per datum)

| Datum | Home | Level |
|---|---|---|
| Live power, in use by chips | Sites card, left summary | L1 |
| Power coming, by date (incl. at-risk and "if built") | Sites step chart | L1 |
| Per site: size, stage, live date, construction ‖ power bars | Site row | L1 |
| Pending opposition odds of a site, package button | Site row (permits stage only) | L1; breakdown L3 |
| Site detail (capex paid, chips installed, pay terms) | Site row tooltip | L3 |
| Size options, H100e each holds | Build card, size tiles | L2 |
| Today's wait per source | Build card, power tile (big number + bar) | L2; why = L3 tooltip |
| Size cap, upfront, running, opposition level per source | Power tile (best in row green) | L2 |
| Queue, connections/yr, 2023→26 wait trend, own effect | Wait tooltip | L3 |
| Lever price and saving | Lever row | L2 |
| New site timeline, live date, other sources' live dates (ghosts) | Preview | L2 |
| Upfront, running, H100e held, block/delay odds | Preview totals | L2; odds breakdown L3 |
| Payment options (unchanged) | "Pay with" collapsed row | L2 → existing tiles |

Removed from the tab: grid pool, spare transformers, transformer lead time, pre-order button.

## Glossary terms needed

Sites, live power, coming, permits, construction, power (stage), opposition, hall being built, waiting for grid,
turbines, rent wait, grid wait, turbine wait, firm queue, connections per year, upfront, running, crash construction,
rush power, fast-track permits, community package, public against data centres, H100e (exists).

## Design questions raised

1. Lever savings interact (crash saves 0 q on plain gas, 4 q once rush power is on). The card shows marginal savings
   given the other choices; confirm that over fixed "−N q" labels.
2. Community package price: DATACENTERS.md says both "≈ 9% of building" ($1.26B/GW) and "$1M per MW" ($1.0B/GW). Mockup
   uses $1.0B.
3. Turbine wait 2026: §2 says ~10 q, the §4 schedule 9 q. Mockup shows 10 q (schedule + the player's own gas sites).
4. Does rush power on gas start the turbine clock at commit or after permits? Mockup: after permits (turbines ready
   Q1 28, a year before construction ends), so construction "sets the date".
5. What is lost if a site is blocked at the end of permits (package paid upfront? turbine deposit?). Tooltip says
   "money spent so far ≈ $1.0B".
