# Back-of-envelope feasibility map B: finance, compute, market, outside world

Map for design/estimates/BRIEF.md. My share of balance/targets.ts: "finance and compute" (l. 272), "outside world"
(l. 581), and in "calibration report rows without an earlier entry" (l. 1059) every finance / revenue / market / serving
/ users / energy / labour / sites / outside-world id. Left to map A: T1.golden.milestones, GPATH.anchorDeviation,
M.startReadout, T2.labour.SCband (AI research labour, a capability quantity), CAST.*, S5.halfStaffDeepensLag,
F5.evalAwarenessStart. Read only: no script was run and no engine code was executed. I read the fixtures as JSON only.
Paths are relative to the repo. `newGame` means `newGame(defaultSetupV2({seed: 2027, world: 'tl-central', …}))`, i.e.
the start tables, with no tick.

## Summary

- **81 targets: 15 YES, 28 PARTIAL, 38 NO.** NO is mostly the honest answer here. Most finance rows are bot-policy
  outcomes (rounds, deals, distress shares, board confidence). Most 2026–27 world rows are Bass-diffusion stocks
  (adoption, workers, seats, reach, unemployment pool) integrated along a path. They belong in the played-game
  calibration report.
- The YES rows are the start state (day-0 readouts on `newGame`) and the pure market and site formulas (spot rental,
  opposition odds, schedule, dilution cap, doubt shock). Several of them are already estimates in all but name:
  calreport/market.ts C1/C5/A8 and calreport/finance.ts F5.spot run no game.
- **Blockers worth extracting (small, pure, no mechanism change):**
  1. `sectorValueOf(R, L, hype, y10, bust)` out of story.ts:122. It unlocks the valuation and multiple rows on the
     reference revenue path.
  2. `kWPerH100eAt(q)`. The ×0.944 a quarter is inline in sites.ts:442 and duplicated in market.ts:96
     expectedCloudPrice. It unlocks power and compute-plan cost.
  3. Export the pipeline arrivals and supply step `arrive` / `supplyNow` from compute/market.ts, for the
     pre-ordered production quarters.
  4. `friendTarget(...)` out of sectors.ts:374 and `acceptTarget(...)` out of worldfx/control.ts:201, the two
     inline equilibrium targets.
- **The 5 estimates to build first:**
  1. The money-loop pair. Revenue path vs the compute plan cost on the reference path, i.e. `refRevenueRun` vs
     `refTotal × cloudPricePerYear`. Plus `runwayOf` on the start state. It decides where the collapse comes from (§
     Money loop).
  2. Revenue at reference capability in a world at the sourced 2026 stocks (F7.revenue2026, F11.revenue2027). This
     splits the revenue gap into parameters vs dynamics.
  3. The start revenue split by product (F11.startRunRate / A8.leaderRevenue / A8.chatRevenueShare / C1). All are
     out of band today (OPEN.md row 35). It is millisecond-cheap and parameter-only.
  4. The capex identity F7.capex2026: the 2026→27 increase in `refTotal` × the expected list price, plus site capex.
  5. The hire-rate date W.hireRate10 from `hireRateOf` on the reference cover path. The 18-day lag makes it nearly
     pure, and it is the only labour date that is estimable.

## Money loop: can BoE show whether the RefBot collapse is parameters or dynamics?

Yes, mostly. The chain runs along the reference path. The numbers below are my hand arithmetic from the engine
constants, for orientation only. The real estimate must call the functions.

| step | chain | reference-path value |
|---|---|---|
| start revenue | `revenueReadout(newGame).total` (worldfx/revenue.ts:447) against the start table `POSITIONS.frontier.revenueRun` = 12 (data/v2/starts.ts:119) | the table is 12. The demand model's own day-1 figure is the A8 row, out of band today |
| revenue path | `refRevenueRun(s, day)` (finance/plan.ts:352) = 12 × 3.5^t, sourced (R11 #14, AI 2027 table) | CY2026 ≈ $45B, CY2027 ≈ $157B: both in band by construction |
| compute plan | `refTotal(w, yr)` (production/ces.ts:96) × `cloudPricePerYear` / `tcoPerYear(expectedListPrice(m,k), kW)` (compute/market.ts:66,91,95) | mid-2026 ≈ 4.0M H100e × ≈ $10K/yr cloud ≈ $41B/yr (≈ $25B owned). End-2027 ≈ 21M × ≈ $7K ≈ $145B/yr |
| payroll | `hRef(yr)` (production/ces.ts:89) × `marketWage(s, role)` (departments/market.ts:79); `payrollOf` on `newGame` for day 0 (departments/teams.ts:91) | small next to compute (≈ 2,700 caps heads mid-2026) |
| burn → runway | `operatingCostsPerYear(s)`, `runwayOf(s)` (finance/runway.ts:41,157) on `newGame` | start runway and burn are exact. Later quarters need a state |
| capex → equity needed | Δ`refTotal` 2026→27 × `expectedListPrice` × (1 + networkShare) + `siteCapex` (compute/sites.ts:162) | ≈ 16M H100e × ≈ $12K ≈ $200B: matches F7.capex2026 |
| equity available | `poolAnnualOf(s, S)` (finance/story.ts:244) with S from `sectorValue` at R = the reference sector revenue (blocker 1) | compare with FIN5a.equity2026 $50–150B |

On the reference path the loop closes. Mid-2026 revenue (≈ $47B run-rate) about covers cloud compute (≈ $41B).
By 2027 revenue is well ahead, and capex ≈ F7.capex2026. So the finance parameters are roughly consistent with each
other on sourced inputs.

The fixtures already point at the revenue side. They are the tl-central RefBot game with `refComputeStub` and
`cashFloorStub` (scripts/v2/lib.ts:52,68): compute is pinned to `refTotal` and cash never falls. Even so the player's
`revenueRun` falls from 12 (day 0) to 8.4 (day 400) to 2.6 (day 900). Meanwhile the world grows: US seat share
0.12 → 0.36 → 0.63, US reach 0.46 → 0.50 → 0.61. Rivals' revenue rises (one rival 8 → 6.4 → 20.8). The best player G
moves only 27.63 → 27.98 in 400 days. So the collapse happens with the money loop cut. It is a revenue-side problem:
either capability lag and lost share (dynamics) or demand and price parameters.

Estimate 2 separates the two:
- Take `newGame`. Set the world stocks to the sourced 2026 values in this registry (A2a, A2b, A2c, W4).
- Put the labs' models at reference capability: `setNpcModel(w, m, refGAt(s, y), refTotal(w, y), y)` (npc/lab.ts:112,54)
  for the leader NPC, or rivals at `npcG` (npc/lab.ts:98).
- Set player compute = `refTotal(w, y)`, whose serving part is `shareRefAt(y).serving` (departments/split.ts:51).
- Then read `labMarketRevenue(s, leader)` / `revenueReadout(s)` (revenue.ts:1135,447).

How to read the result:
- ≈ $45B: the engine's pricing and serving maths is fine and the game's gap is dynamics.
- ≈ $8B: parameters, i.e. prices, margins, value per hour, multi-homing shares.

## Table

Verdicts: YES = pure engine calls on reference inputs. PARTIAL = one named simplification. NO = only a played game
gives it.

### Finance and compute

| id | verdict | chain | inputs | drift risk | blocker |
|---|---|---|---|---|---|
| F1.production2026 | PARTIAL (only the reference path: supply following it is dynamics) | `globalRefQ(q)` q = 2..5 summed (compute/market.ts:113); pre-ordered quarters from `initialMarket()` pipes (market.ts:31) | sourced R15 / Epoch ×2.2 a year in `globalRefQ` | low | export `arrive`/`supplyNow` (market.ts, internal) to read the pipeline-fixed quarters (pkg L = 4) |
| F2.production2027 | PARTIAL (as F1) | `globalRefQ` q = 6..9 | as F1 | low | as F1 |
| F3.installedStock | NO | stock = shipped − retired along the quarterly clearing; ratio to `globalCompute` (data/world.ts:185) | | | the stock integrates the cleared supply, which depends on orders |
| F4.demandShock | NO | capacity investment responds to orders over quarters (`clearMarket`, market.ts:308) | | | dynamic response by definition. Keep as an idle constructed market run |
| F5.spotDemandShock | YES | `rentalBase(15, 0.7)` → `spotRental(rb, 1.5)/spotRental(rb, 1)` (market.ts:73,75) | constants | low | none. calreport/finance.ts:180 is already an estimate: move it there |
| F5.spotGlut | NO | rental path over 6–8 quarters of clearing | | | dynamic (premium update `nextPremium` iterated with supply) |
| F6.supplierMargin | PARTIAL (expected path, not cleared) | `expectedListPrice(m, k)` (market.ts:91) with `m = initialMarket()`, margin 1 − cost·0.92^k / list | `initialMarket`, `MARKET.costDeclineQ` | medium | `impliedMargin(m)` (market.ts:81) needs a market; an `expectedCost(m, k)` export avoids recomputing the cost path |
| F7.revenue2026 | PARTIAL (world stocks set to sourced 2026 values; labs at reference G) | `refGAt` → `setNpcModel` → `labMarketRevenue`/`revenueReadout` (npc/lab.ts:54,112; revenue.ts:1135,447) | registry A2a/A2b/A2c/W4 2026 values; `refTotal`; `newGame` | high (many state fields) | no constructor for "a world at given stocks". A scripts-side helper that only writes fields. No player ModelVersion at a given G: use the leader NPC |
| F7.capex2026 | PARTIAL (all of Δcompute owned) | Δ`refTotal` (ces.ts:96) × `expectedListPrice` × (1 + `MARKET.networkShare`) + `siteCapex(o)` (sites.ts:162) | AI 2027 compute in `refCapCompute` | medium | none. The owned vs rented split is the bot's choice (that part is NO) |
| F7.compute2026 | PARTIAL (all reference compute at cloud price, or owned TCO as the low bound) | `refTotal(w, y)` × `cloudPricePerYear(s)` / `tcoPerYear` (market.ts:77,66) over 2026 | `refTotal`; list price path `expectedListPrice` | medium | the kW path (blocker 2) |
| F7.power2026 | PARTIAL (all compute in own or rented sites) | `refTotal(w, 2027.0)` × kW per H100e at q = 6 | `initialPower()` (compute/power.ts:11) | medium | kW path inline (sites.ts:442 ×0.944/q, duplicated in market.ts:96): extract `kWPerH100eAt(q)` |
| F7.valuation2026 | PARTIAL (player share from `storyShares` on the start field) | `sectorValue` at R = the reference sector revenue → × the player share (story.ts:122,159,217) | `refRevenueRun`, start rivals' revenue scaled | medium | `sectorValue(s)` reads state: extract `sectorValueOf(R, L, hype, y10, bust)` |
| F8.fundingMix | NO | | | | bot's deal and financing choices |
| F8.refNoDistress | NO | | | | path outcome. The money-loop estimate (§ above) is its upstream signal |
| F8.noRescueDistress | NO (the start-runway estimate bounds it) | `runwayOf(newGame)` with commitments (runway.ts:157) gives the start runway only | `newGame` | low | distress timing is a path |
| F8.capex2xDistress | NO | | | | bot policy |
| F9.fc2.leaderMultiple | PARTIAL (growth ≥ 2.5 set, story shares at start) | `sectorValueOf` (blocker 1) × share / R at reference R and growth `growthOf` (story.ts:136) | `refRevenueRun` | medium | blocker 1 |
| F9.fc2.slowerLowerMultiple | PARTIAL (two constructed growth values, same date) | `storyShares` with momentum differing (story.ts:159) | as above | medium | a pure `storyShareOf(drivers)` would help. It is driver-normalised inline in `storyShares` |
| F9.fc2.trailingRivals | PARTIAL (rivals at the start revenue scale) | `storyNow(newGame)` labs: V/R per lab (story.ts:217) | `newGame` | low | none for the start. Later dates need a state |
| F9.dilution | YES | `raiseCeiling(newGame).parts.dilution` / `dMax(false)` (finance/equity.ts:25,18) | `newGame` | low | none. It is a mechanism identity (see § Not targets) |
| F9.dilutionCap | YES | `dMax(false)`, `dMax(true)` (equity.ts:18) | constants | low | registry value stale: code is 8% / 5%, registry says 14% anchored. See § Not targets |
| F9.doubtShock | YES | `applyShock(newGame, ctx, 'financingDoubt')` → pool ratio (finance/investors.ts:46) | `newGame` | low | none. It is a mechanism check already (scripts/v2/finance.ts:88) |
| F10.sitesBlockedDelayed | YES | `oppositionOdds(s, site)` (compute/sites.ts:62) on `newGame` at neutral sentiment | `newGame`, `COMMUNITY` | low | registry text stale: code pins 9% / 27% for one site (finance.ts:105) |
| F10.siteBuild | YES | `siteSchedule(s, o).buildQ` (sites.ts:198) for the typical site | `newGame` | low | registry says median 8 q, code checks 7 q for a rushed 500 MW gas site (finance.ts:107) |
| F11.startRunRate | YES | `revenueReadout(newGame).total` (revenue.ts:447) | `newGame` | low | none. The day-0 run-rate = 12 is a table identity. The Jul-31 figure is the demand model's |
| F11.revenue2027 | PARTIAL (as F7.revenue2026, 2027 stocks extrapolated from the sources) | as F7.revenue2026 | as F7.revenue2026. No sourced 2027 stocks: weak | high | as F7.revenue2026 |

### Outside world

| id | verdict | chain | inputs | drift risk | blocker |
|---|---|---|---|---|---|
| W.equity2026 | NO (no mechanism) | none: there is no equity index in src/ | | | orphaned. See § Not targets |
| W.youthSoft2026 | NO | youthRel relaxes to hireRate over `ECON.youthTau` (sectors.ts:~283) | | | stock with a slow lag |
| W.aggregateU2026 | NO | displaced pool ODE (sectors.ts:~295–318) | | | path-integrated |
| W.hireRate10 | PARTIAL (one provider at the reference frontier; 18-day lag ignored) | `refGAt(s, y)` → model fit/h50 (map A's G → h50 chain) → `sectorCover(w, 'SOFT', fit, h50)` (serving.ts:125) → `hireRateOf(s, 'SOFT', F)` (sectors.ts:94); first y with ≤ 0.10 | reference G path; `preLlmCover` | medium | needs a "fit and h50 of a model at G" export (map A). The mix's F is a share-weighted cover (mix.ts:1036), equal to the frontier's when every provider is near it |
| W.aiFriend2027 | PARTIAL (equilibrium target; lag ≈ 4 months) | friendStar = f(SOCIAL G, reach US) | reference G; reach US from A2b.usReach | medium | inline at sectors.ts:374: extract `friendTarget(w, socialG, reachUS, companion)` |
| W.remote25 | NO | `remoteWorkAutomation(s)` (readouts.ts:13) reads adoption stocks | | | stock-driven |
| W.unemployment12m | NO | displaced pool | | | path-integrated |
| W.govAccept85 | PARTIAL (equilibrium; `ACCEPT.rate` lag) | accStar = f(REASON G, top personality) | reference G | medium | inline at worldfx/control.ts:201: extract `acceptTarget(w, Lr, topPers)` |
| A2a.hoursOfUse2026 | NO | `workUse(s)` (readouts.ts:41) on Bass stocks A, W | | | Bass diffusion (sectors.ts:~245–256). The equilibrium is far from the stock (BTOS grows slowly) |
| A2a.hoursSaved2026 | NO | as above | | | as above |
| A2a.workers2026 | NO | as above | | | as above |
| A2a.savedPerHour | YES | `workUse(newGame).savedPerHour` (readouts.ts:41; `savedAt`, use.ts:42) | `newGame` | low | none |
| A2b.paidShare2026 | PARTIAL (start point YES; 2026 point via `paidShareTarget`, a target, not the stock) | `consumerUse(newGame)` (readouts.ts:68); `paidShareTarget(cover, price, going)` (serving.ts:546) | `newGame`; `CONSUMER_MKT` | low | none |
| W4.aggregateU | NO | as W.aggregateU2026 | | | |
| W4.youthExposed | NO | `youthExposedEmployment` (readouts.ts:187) on stocks | | | |
| W4.firmAdoption | NO | adoption stock A (Bass) | | | |
| W2.normalTechTFP | NO (no mechanism) | none: the Normal-technology and econ presets were deleted (fe28d849, "Setup cleanup") | | | orphaned |
| W3.cognitiveOnlyCeiling | NO (no reader) | `automationShare` (readouts.ts:199) exists, but the check is gone from scripts/v2/worldfx.ts | | | orphaned check label |

### Calibration-report rows (finance, market, world part)

| id | verdict | chain | inputs | drift risk | blocker |
|---|---|---|---|---|---|
| C1.chatUsers | YES | `revenueReadout(newGame).deps` consumer users (revenue.ts:447) | `newGame` (`CONSUMER_MKT.adults` × reach × share) | low | none. calreport/market.ts:38 is already an estimate |
| C5.paidShareTarget | YES | `paidShareTarget(cover, 22, 22)` (serving.ts:546) | the start model's cover, which should come from `chatFreeTier(newGame, chat)` (serving.ts:525), not the literal 0.14 | low | the metric's 0.14 is a literal: read it from the start model |
| A7.freeMessageWh | PARTIAL (on `newGame` instead of after 3 ticks) | `chatFreeTier` → `h100eHoursPer(fpt, CONSUMER_MKT.perDay.free, decodeUtilNow(s))` (serving.ts:525,49) | `newGame` | low | none, if `chatFreeTier` works on day 0. The 0.7 kW is a literal in the row: use `s.power.kWPerH100e` |
| A8.leaderShare | YES | `worldMix(newGame)` → `sectorSpendParts` × share (mix.ts:325; revenue.ts:265) | `newGame` | low | none |
| A8.usBuyerShare | YES | as above, US / (US + ROW) | `newGame` | low | none |
| A8.hoursRatio | YES | `sectorHours(s, r, sid)` (revenue.ts:258) | `newGame` | low | none |
| A8.leaderRevenue | PARTIAL (day 0 instead of after 1 tick) | `revenueReadout(newGame).total` | `newGame` | low | same quantity as F11.startRunRate (see duplicates) |
| A8.chatRevenueShare | PARTIAL (as A8.leaderRevenue) | `revenueReadout(newGame)` consumer / total | `newGame` | low | none |
| A3.priceDecline | PARTIAL (hardware path × a reference distillation path, no RefBot lineup) | `expectedListPrice(m, k)` × `h100eHoursPer(fpt(G_V0 student at refS))`; today `cheapestAt` on the day-900 fixture | `initialMarket`; `refS` (npc/reference.ts:55) | high | the decline mixes chips and the bot's lineup. A "cheapest fpt at fixed fit" engine function is missing (scripts/v2/cheapest.ts is scripts-side) |
| A2a.agencyRise | NO | stocks | | | |
| A2a.agencyDirection | PARTIAL (`alphaOf` at reference AGENCY G at two dates) | `alphaOf(w, def, gAgency)` (sectors.ts:69) → `savedAt` (use.ts:42) | reference G (map A) | low | the AGENCY domain G of a model at G (map A) |
| A2a.firmsBelowWorkers | NO | two stocks | | | |
| A2b.usReach | PARTIAL (equilibrium) | `reachTarget('US', bestCover)` (serving.ts:554), with bestCover = `sectorCover(w, 'CHAT', fit, h50)` at reference G | reference G | medium | the reach stock lags (Bass, sectors.ts:368). The target is an upper bound |
| A2b.rowBelowUs | YES | `reachTarget('ROW', c) < reachTarget('US', c)` at the same cover | constants | low | none (an ordering of the targets; holds for the stocks if they share p, q) |
| A2c.seats.jan2026 | NO | seat stock (sectors.ts:~262) | | | Bass toward `seatTarget` |
| A2c.seats.jul2026 | NO | as above | | | |
| A2c.tokenGrowth2026 | NO | product of stocks × intensity | | | |
| A2c.agentHoursRising | PARTIAL (one provider at the reference frontier) | `agentLeverage(a, h50)` (serving.ts:249) at reference h50 on three dates | reference h50 (map A) | low | none beyond map A's h50 |
| HEADLINES.distinct | NO | | | | played-game event. Not sourced (§ Not targets) |
| HEADLINES.oneShotOnce | NO | | | | invariant (§ Not targets) |
| F6.supplierMarginMin | PARTIAL (as F6.supplierMargin) | as F6 | | medium | as F6 |
| F4.shock.first | NO | | | | dynamic response |
| F4.shock.earlyResponse | PARTIAL (the pipeline-fixed quarters) | supply for k < L_pkg = 4 is fixed by the pipes, so the shock cannot change it | `COMPONENTS` (data/v2/deals.ts:205) | low | blocker 3 (`arrive`/`supplyNow`). Really a mechanism identity |
| F9.fc1.start | YES | `storyNow(newGame).labs` Σ valuation (story.ts:217) | `newGame` | low | none. calreport/finance.ts:235 already builds it without ticks |
| F9.fc1.late2026 | PARTIAL (labs' revenue at reference / sourced late-2026 values, start story shares) | `sectorValueOf` (blocker 1) → `storyShares` caps | `refRevenueRun`; R15 §2.9 rival revenues | medium | blocker 1 |
| F9.fc2.2027 | PARTIAL | as F9.fc2.leaderMultiple at 2027 R | | medium | blocker 1 |
| F9.fc2.2026 | PARTIAL | as above at 2026 R | | medium | blocker 1 |
| FIN2.roundsPerYear | NO | | | | bot's raise policy |
| FIN3a.boardConfidence | NO | | | | board mood accumulates over events |
| FIN3b.committeeShare | NO | | | | path |
| FIN4a.dealShare | NO | | | | bot choice |
| FIN4a.dealShape | NO | | | | invariant of the bot's deal (§ Not targets) |
| FIN4b.dealStrings | NO | | | | invariant (§ Not targets) |
| FIN5a.equity2025H2 | NO (the money-loop equity-needed estimate is its upstream) | | | | bot policy |
| FIN5a.equity2026 | NO (as above) | | | | |
| FIN5b.fc6 | NO | | | | rivals' cash path |
| FIN5c.divisionBot | NO | | | | bot invariant (§ Not targets) |

## Estimates the registry lacks (sourced numbers in the repo)

- **Reference money loop closes**, as an INFO row: `refRevenueRun` vs `refTotal × cloudPricePerYear` + payroll at
  `hRef`, mid-2026 and end-2027. Sources: refRevenueRun's R11 #14 / AI 2027 table (plan.ts:350) and the AI 2027
  compute in `refCapCompute`. No new band. It flags when the parameters stop being mutually consistent.
- **Serving capacity covers the reference demand:** `refTotal × shareRefAt(y).serving` (SHARE_REF, Epoch-sourced,
  data/v2/calibration.ts:74) against the need H100e that `revenueReadout` reports at the sourced 2026 stocks. There is
  no sourced band for the ratio. Report it with estimate 2, as INFO.

## Not targets, stale or duplicated

- **Orphaned:** W.equity2026, W2.normalTechTFP, W3.cognitiveOnlyCeiling. No mechanism or reader exists. Their check
  labels point at scripts/v2/worldfx.ts lines that are gone. There is no equity index in src/. The Normal-technology
  and econ presets were removed in fe28d849.
- **Stale values or labels:**
  - F9.dilutionCap: registry 14% anchored, code `dMax` 8% / 5% (equity.ts:18). The label at finance.ts:86 differs.
  - F10.sitesBlockedDelayed and F10.siteBuild: the checks now pin 9% / 27% and 7 q for one constructed site, with
    design odds [D-6] (finance.ts:105,107). The registry statements and labels describe the old shares. These are
    mechanism pins of designer values, not sourced bands.
- **Invariants or mechanism checks, not calibration targets:** F9.dilution, F9.doubtShock, F4.shock.earlyResponse,
  HEADLINES.oneShotOnce, FIN4a.dealShape, FIN4b.dealStrings, FIN5c.divisionBot.
- **Not sourced:** HEADLINES.distinct (source: the code). F8.refNoDistress (source: finance.ts:238).
  FIN3a.boardConfidence (a collapse guard by lead decision).
- **Duplicates (one home per target):**
  - F11.startRunRate (9–16.5) and A8.leaderRevenue (12–15): the same start revenue with two bands.
  - W.aggregateU2026 (< +0.3 pp, Dec) and W4.aggregateU (±0.15, Nov): the same quantity a month apart.
  - F9.fc2.leaderMultiple is pooled over the years of F9.fc2.2026 / F9.fc2.2027.
  - F7.revenue2026 is measured twice: calreport/finance.ts (seeds 1–4) and calreport/world.ts (seed 2027).
  - F6.supplierMargin and F6.supplierMarginMin are two statistics of one series (fine, but they share one source line).
- **Literals in metrics** that will drift: C5 (cover 0.14), A7 (0.7 kW).
