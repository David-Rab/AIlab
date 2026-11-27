# models chunk inventory notes (B3, prefix `mod`, `balance/params/models.ts`)

Files: `src/engine/v2/models/*` (27 files) and `src/engine/v2/compute/*` (5 files). 66 entries: 21 export refs, 45 inline refs (7 of them are the declarations of non-exported named constants, 38 are notable inline literals). Both folders are almost all logic; nearly every balance number they use is imported from `src/data/v2` (other chunks), so the inline count is low. All entries are `layer: 'world'`: nothing in these files is an actor's choice rule. Area is `market` for the chip market, power, sites, orders and serving defaults, `capability` for levels, benchmarks, run defaults and RL, `research` for idea taste and belief noise, `safety` and `security` for catch rate, suites, KYC and security readouts.

## Questions

| id | question | evidence |
|---|---|---|
| Q-models-1 | `[R15 Design]` (the tag on `KOREA_HAZARD_Q` and `taiwanHazardQ`): a designer value anchored on R15, or an R15-sourced value? I registered `designer`, as for `[D from <source>]`. | market.ts:190, :196 |
| Q-models-2 | `V2_DOMAIN_OFF` (CYBER -1, PHYS -4) feeds every world gate that is written as a v2 level (gOfV2Level), but its doc says "A unit, not a parameter" and the numbers come from the deleted v2 `REF_OFF`. Is it a tunable? Registered `untagged`. | capability.ts:204-206 |
| Q-models-3 | `RL_C0` is tagged `[fit]` ("solved once so the reference post-training run ... gains RL_REF_GAIN") but is computed in code by bisection at load. The rules point to `fitted` (tag) and `derived` (computed in code). Registered `derived`, with the tag in notes. Should it be `fitted`, with `RL_REF_GAIN` as the fit target? | effective.ts:162-167 |
| Q-models-4 | The same number is written in several places with no shared constant, so a rebalance has to change all of them: kW per H100e step 0.944 (forecast.ts `KW_STEP`, sites.ts, market.ts `expectedCloudPrice`), power price 0.083 and O&M 3% (market.ts `tcoPerYear` against `POWER_PRICE` and `OM_RATE` in deals.ts), facility $10B per GW (market.ts against `FACILITY_PER_GW`), the weight-security rise 0.006 (labReadouts.ts against security.ts), the theft rule (labReadouts.ts `believedTheftChance` against actors/intel.ts `pTheft`). Registered each copy it owns once. Extract named constants first? | market.ts:66-67, :65; forecast.ts:10; sites.ts:277; labReadouts.ts:11, :17 |
| Q-models-5 | `researchView.milestoneViews` hard-codes the first three milestone coverage thresholds (0.1, 0.5, 0.5) while the doc says the real predicate is `departments/workfit.ts milestonesOf`. Are these the same numbers (a mirror) or a second definition? Not registered (see overflow). | researchView.ts:506-508; capability.ts:420-422 |
| Q-models-6 | `KYC_REFUSE` is `[P-analogue, low confidence]` from an Ofcom drop in UK site visitors (24-31%). Registered `sourced`, with the quoted range as `range`. Is an analogue with a stated low confidence still `sourced`? | deployments.ts:30-34 |

## Skipped

Every `balance/coverage.txt` line in these files that is not registered:

| coverage line | reason |
|---|---|
| compute/forecast.ts:155 computeHistQSystem | system descriptor (order, cadence) |
| compute/market.ts:516 marketQSystem | system descriptor |
| compute/power.ts:72 computeOnlineSystem | system descriptor |
| compute/sites.ts:270 sitesQSystem | system descriptor |
| models/actions.ts:176 RUN_ACTIONS | action definitions (code); numbers live in data |
| models/actions.ts:369 DEPARTMENT_ACTIONS | action definitions (code) |
| models/capability.ts:364 MILESTONE_CRITERIA | player-language prose |
| models/capability.ts:422 milestonesSystem | system descriptor |
| models/evals.ts:83 RANK | queue-order enum (release, order, policy) |
| models/productOps.ts:184 productsSystem | system descriptor |
| models/productOps.ts:240 PRODUCT_ACTIONS | action definitions (code) |
| models/rdReadouts.ts:18 Z90 | z-score 1.64 for a display band |
| models/research.ts:898-901 FLOW_Q, FLOW_RHO, FLOW_N, FLOW_WARM | grid points and sample count of the expected-flow simulation (numerical, not balance) |
| models/runs.ts:979 runsSystem, :1115 continualSystem | system descriptors |
| models/stacks.ts:125 refRlMemo | memo cache |
| models/tree.ts:451 researchSystem | system descriptor |
| models/treeActions.ts:147 TREE_ACTIONS | action definitions (code) |

Registered beyond the checklist: `RL_C0` (effective.ts) and `RIVAL_GROWTH_Q` (market.ts). `fOver.curvature` stays in `capability.ts`.

## Inline overflow

Notable literals not registered (the 40-entry cap was not reached; these were judged readout, mirror or numerical):

- compute/market.ts:235 `s.player.computeOnline / 5e6` (track weight saturation of the rationing weight)
- compute/orders.ts:26-28 `initialCloud` 0.7e6 H100e at $13K a year; `initialOrders` `prepayFrac: 0.3` and `price: 23` (orders.ts:20-21)
- compute/market.ts:46 initial `backlog: 1.5`, `geoTW: 0.93`, `exoDemandQ: 2.2e6` in `initialMarket` (start table)
- compute/sites.ts:195 `1 + Math.floor(rng.float() * 3)` (permit delay 1-3 quarters); :100 `Math.max(50, ...)` minimum site size 50 MW; :16-20 the four starting sites (MW, capex, stage dates)
- compute/sites.ts:164 transformer lead 8-10 quarters is `transformerLeadQ: 9` in power.ts:11
- models/researchView.ts:506-508 milestone coverage thresholds 0.1, 0.5, 0.5 (Q-models-5)
- models/labReadouts.ts:17 `believedTheftChance` 0.05, 3.5, 0.15, /300 (mirror of actors/intel.ts pTheft); :40 `spend * 1.05`
- models/capability.ts:347 minimum 28 days of history for a windowed pace; :436 acts keyed to day 150 (acts are flavour only)
- models/runs.ts:362 `forecastBand` z 1.64; :760-761 run-card prediction band ±0.25 (readout); :501 finite-difference step 0.01
- models/design.ts:58 monitorability class thresholds 0.85, 0.5, 0.15 (run-card label)
- models/research.ts:1254-1256 progress-ring stage weights 0.33, 0.66 (UI)
- models/productOps.ts:384 default serving share 0.2 in a preview (UI default)
- models/benchmarks.ts:109, :117 finite-difference steps 0.1 and 0.05 (numerical)
