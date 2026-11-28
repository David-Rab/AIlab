# E2m: money and world extractions, and the estimates they unlock

Branch boe-e2m. Part 1 is refactor only. Part 2 adds `scripts/v2/estimates/world.ts` (area `world`, registered in `estimates.ts`)
and fixes the F7.capex2026 row in `estimates/money.ts`.

## Part 1: extractions (src/engine/v2)

| extraction | where | called by |
|---|---|---|
| `sectorValueOf(R, L, hype, y10, bust)` | finance/story.ts:136 | `sectorValue` (story.ts:131) |
| `kWPerH100eAt(kW, k)` = kW × 0.944^k | compute/power.ts:16 | `sitesQ` (sites.ts:442, k = 1) and `expectedCloudPrice` (market.ts:97) |
| `arrive`, `supplyNow` exported | compute/market.ts:283, :252 | `clearMarket` (unchanged) |
| `friendTarget(w, socialG, reachUS, companion)` | worldfx/sectors.ts:91 | `worldfx` system (sectors.ts, `friendStar`) |
| `acceptTarget(w, Lr, topPers)` | worldfx/control.ts:221 | `updateControl` (control.ts, `accStar`) |

Bit-identical on purpose: `pw.kWPerH100e = kWPerH100eAt(pw.kWPerH100e, 1)` is `kW × pow(0.944, 1)`, which is `kW × 0.944` exactly;
`sectorValueOf` keeps the multiplication order (`kappa × R^α × φ × (hype × M × bust)`); `friendTarget` keeps `… × reach × companion`
(companion = 1 with no law). Other inline 0.944 copies remain (finance/plan.ts:96, 261, 272, 285; compute/forecast.ts:9): not touched
(out of the task's scope, and plan.ts is near other sessions' work); they should call `kWPerH100eAt` later.

Identity proof: `node --import tsx scripts/v2/fixtures.ts --write` (70 s, one run, after all four extractions): "fixtures: all passed",
`git diff --stat scripts/v2/fixtures/` empty (no fixture file changed). tsc main and scripts/v2 pass.
Note: the kWPerH100eAt commit alone does not compile (market.ts's use of it is in the arrive/supplyNow commit); the four are one unit.

## Part 2: rows

`node --import tsx scripts/v2/estimates.ts`: all passed, 54 estimates, 35 in band, 19 out (WARN = calibration). The world area takes ~1.1 s.

| id | estimate | band | | what it suggests |
|---|---|---|---|---|
| F7.capex2026 (fixed) | $141B booked at delivery in 2026 (the registry's "capex incurred": chips $87B + sites $54B, 4.3M H100e). INFO: ordered a year ahead $396B (12.9M) | 150-250 | out (just) | kW now falls by quarter (kWPerH100eAt), so sites are cheaper than before ($54B vs $67B); the reference compute plan alone is a bit under the band |
| F7.power2026 | 4.5 GW (6.8M H100e × 0.66 kW) | 4-9 | in | the lower end: the reference holds 4.5 GW if every H100e were in own or rented sites |
| F1.production2026 | 24.5M. INFO: pre-ordered pipes fix 3.7, 4.4, 5.4, 6.4M for q1..4 vs reference 3.7, 4.4, 5.4, 6.6M | 20-30M | in | the start pipes sit on the reference path (the first four quarters match), so shortfalls come from later ordering |
| F2.production2027 | 51.2M | 45-60M | in | by construction (globalRefQ is the sourced path), not the cleared supply |
| F6.supplierMargin | 73.8% (min 73.7%) | 70-75% | in | the expected price path keeps the margin flat at ≈ 74%; a miss in a played game is the premium dynamics |
| F6.supplierMarginMin | 73.7% | ≥ 65% | in | as above |
| F7.valuation2026 | $1151B (sector $2802B × start share 41%, cap not binding) | 1000-3000 | in (edge) | the start share at the reference revenue gives the low edge of $1-3T |
| F9.fc1.late2026 | $1821B (Oct 2026 $1602B, Jan 2027 $2039B) | 2200-3300 | out | with the start shares, hype and rate and sector revenue on the reference curve the marks sum to $1.8T, not $2.5-3T |
| F9.fc2.leaderMultiple | 14.1x (8 marks 2026-27, growth x3.5) | 20-37 | out | S ~ R^0.7 against revenue on the x3.5 curve: the multiple falls below 20x at the sourced revenue |
| F9.fc2.2026 | 15.9x | ≥ 15 | in | |
| F9.fc2.2027 | 12.4x | 20-37 | out | multiple keeps falling in 2027 (STORY.alpha < 1, hype and L from the start state) |
| F9.fc2.slowerLowerMultiple | x1.2 growth: 16.7x vs x3.5: 21.5x | ordering | in | the story's momentum driver works in the right direction |
| W.aiFriend2027 | 9.3% (SOCIAL G 28.5, US reach target 0.66, companion factor 0.8) | 7-13% | in | the equilibrium target (stock lags ~4 months; reach is a target, an upper bound) is on the sourced 10% |
| W.govAccept85 | 2031.79: first year the acceptance target is ≥ 0.85 (target 0.30 in 2027, 0.59 in 2031) | 2027.96 ± 0.25 | out | a lower bound for the date. The reference labs' persuasion is ≈ 0 and GOV's REASON G low; the player briefing and vetted products are not applied, so it is the market-only path |

The valuation rows share a chain: R_sector = start sector revenue × the reference growth since day 0 (every private lab on the curve),
L = `publicFrontier` after `putLabsAtReference`, hype and y10 from the start state, shares from `storyNow(newGame)`, cap from `valueCap`.
Weak spots (all stated in the chain text): start shares fixed through 2027; hype stays at its start value, while STORY notes hype 1.15-1.35
in late 2026, which alone would lift every valuation row by 15-35% (and the two multiple rows out of band would move toward the band).
The valuation shortfall therefore reads as: the mood term (hype, rate), not the revenue path, is what the sourced $2.5-3T needs; for the
balance session to decide (not changed here).

## Still blocked

- F1/F2 quarters beyond the pipeline lead (q ≥ 4/6/16 by component) and F4.shock.*: supply depends on orders (dynamic).
- F9.fc2.trailingRivals: a normalised ratio over lab-marks (m_A); needs the metric's definition, skipped.
- F7.compute2026, F7.revenue2026 etc. unchanged from E1b. `expectedCost` export (F6) was not needed: the cost path is `cost × MARKET.costDeclineQ^k`.
- W.hireRate10: needs "fit and h50 of a model at G" (map A).
- Missing registry ids: none; no registry or balance file touched.
- A sourced late-2026 hype / rate path would make the valuation rows exact (STORY's notes quote hype only).
