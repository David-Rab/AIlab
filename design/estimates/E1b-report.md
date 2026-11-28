# E1b: money and market estimates (scripts/v2/estimates/money.ts, market.ts)

Run: `node --import tsx scripts/v2/estimates.ts --only money,market` (≈ 1.3 s, 18 rows, fails only on NaN / ×10). No tick, no bot;
one `newGame` per state (3 in all). A row out of its band is calibration (the balance session's), so it prints WARN.

## The revenue diagnostic (F7.revenue2026, suffix `demand`)

Chain (7 steps, longer than 5 on purpose): `newGame` → `setSourced2026Stocks` (field writes steered by the `workUse` / `workBilling`
readouts: US workers 0.40, hours of use 6.3%, 50M seats outside China, US reach 0.50, paid share 5.5%) → `putLabsAtReference`
(`refGAt`, `refTotal`, `cPlanQ`, `setNpcModel`; the best US lab at G_ref(2026.5), the others at their start lags; the player's products
withdrawn) → `worldMix` → `labMarketRevenue` per lab. Demand side: serving capacity is not applied.

Result at mid-2026: lead lab **$36.6B/yr**, all labs together **$63.4B/yr** (lanternworks 11.4, tarnwick 36.6, zorvane 8.7,
wolderfield 1.7, China 5.0). Sourced: $45B (AI 2027) to $53-56B (Anthropic); band 36-67.

What it implies, cautiously: the engine's own demand, price and share maths, given reference capability and sourced 2026 stocks,
gives revenue of the sourced order (the lead lab at the low edge of the band, the market total inside it), not the ≈ $8B of the
fixtures. In the fixtures at day 400 the player's demand ($8.0B) is also far below its serving capacity ($76B), so the
shortfall is on the demand side. Taken together this points to dynamics (the player's model lagging the frontier, its share,
the stocks not reaching their sourced values) rather than the price and value parameters. Not settled by this estimate:
(a) the player is removed, so its share path is not tested; (b) customer stocks start at the logit targets (no switching lag)
and the Nash price stocks start at the seed markup; (c) the lead lab is the NPC with the smallest start lag, not a model built by
the player; (d) ROW and China stocks are the start values scaled by the US factors. A confirmation needs the played game or a
fixture read as a state with the player's model at reference G (map A's "model at G" export).

## Rows built (id, estimate, band, in / out)

| id | estimate | band | |
|---|---|---|---|
| F7.revenue2026 (curve) | $45B (mean of `refRevenueRun` over 2026) | 36-67 | in (by construction) |
| F11.revenue2027 (curve) | $158B | 98-182 | in (by construction) |
| F7.compute2026 | $49B/yr (reference compute × expected cloud price, quarter by quarter) | 25-60 | in. The all-rented upper bound; revenue $45B is a little under it, owned TCO is lower, so the loop closes only with owned compute |
| F7.capex2026 | $469B if chips ordered in 2026 are the compute delivered a year on (12.9M H100e: chips $265B + sites $204B); $154B if booked at delivery in 2026 (4.3M) | 150-250 | out / in. The row depends on the convention; the first is MAP-B's definition |
| F7.revenue2026 (demand) | lead lab $36.6B, all labs $63.4B | 36-67 | in (edge) |
| C1.chatUsers | 620M | 630-770M | out (just) |
| F11.startRunRate | $15.5B/yr (day 0) | 9-16.5 | in |
| A8.leaderRevenue | $15.5B/yr (day 0; the metric reads day 1) | 12-15 | out (just). Same quantity as F11.startRunRate |
| A8.chatRevenueShare | 49% (Chat $7.6B) | 60-75% | out |
| A8.leaderShare | 0.396 | 0.25-0.45 | in |
| A8.usBuyerShare | 0.43 | 0.40-0.72 | in (edge) |
| A8.hoursRatio | 3.50 | 3-4.2 | in |
| C5.paidShareTarget | 4.68% (the start model's own paid target) | 5-6% | out |
| A2b.rowBelowUs | ROW 0.41 < US 0.48 | ordering | in |
| A2a.savedPerHour | 0.337 | 0.30-0.40 | in |
| F5.spotDemandShock | +38.3% | 35-45% | in |
| F9.fc1.start | $423B | 450-750 | out |
| W.hireRate10 | 2028.72 (labs at the reference frontier, mix F → `hireRateOf`) | 2027.5 ± 0.25 | out (≈ 1.2 years late) |

Start runway (`runwayOf(newGame)`; no registry row, printed by the money area): liquidity $44.0B, net burn $6.4B a quarter, runway 8 q
(the cap), operating costs $5.9B a year.

Reading across the loop: the sourced revenue curve and the reference compute at the engine's prices are roughly consistent (revenue $45B
vs compute $49B all rented); the start revenue split is Chat-light (49% against 60-75%) and the start paid share target low (4.7%
against 5-6%), both parameter-only and fixable in one place.

## Rows skipped, and why

- F11.revenue2027 (demand): no sourced 2027 stocks to set; extrapolating them makes the estimate weak. Only the curve row is built.
- W.hireRate10 uses the best provider mix F, not a share-weighted cover of one lab, and ignores the 18-day lag (bisection assumes F
  is monotone in the year).
- F9.dilution, F9.dilutionCap, F9.doubtShock, F10.*: mechanism identities or stale registry values (map B § Not targets), not estimates.
- F7.power2026, F7.valuation2026, F9.fc2.*, F9.fc1.late2026: need extractions (see below).
- F1/F2.production, F6.supplierMargin: need `arrive` / `supplyNow` or an `expectedCost` export.
- Everything stock-driven (adoption, workers, seats, unemployment) stays in the played-game report.

## Needs extraction (not done; no src edits)

1. `sectorValueOf(R, L, hype, y10, bust)` out of finance/story.ts (valuation and multiple rows).
2. `kWPerH100eAt(q)` (the ×0.944 a quarter is inline in compute/sites.ts:442 and duplicated in compute/market.ts expectedCloudPrice).
   The capex row uses the start kW per H100e instead, so its MW and site capex run slightly high.
3. `arrive` / `supplyNow` from compute/market.ts (production rows).
4. `friendTarget` (worldfx/sectors.ts) and `acceptTarget` (worldfx/control.ts).
5. A constructor for a world at given stocks (here a scripts-side field writer) and a player model at a given G.

## Registry entries wanted (balance/targets.ts, not edited here)

- Start runway: liquidity ≈ $44B, 8 q+ (source: the start table; sourced from `data/v2/starts.ts` frontier position). No sourced runway band exists.
- Reference money loop closes (INFO): revenue ≥ reference compute cost at owned TCO, mid-2026 and end-2027 (sources: refRevenueRun R11 #14 / AI 2027 table; refCapCompute).
- Serving capacity covers the reference demand (INFO): `refTotal × shareRefAt(y).serving` against the need H100e at the sourced 2026 stocks (Epoch-sourced SHARE_REF).
- Stale ids to fix by the registry owner: F9.dilutionCap (code 8% / 5%, registry says 14% anchored), F10.sitesBlockedDelayed and F10.siteBuild (code pins 9% / 27% and 7 q).
