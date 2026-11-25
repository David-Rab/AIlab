# Finance inventory notes (B3)

Registry: `balance/params/finance.ts`, `PARAMS_FINANCE`, 190 entries (40 inline). Files: `src/engine/v2/finance/*` (22). All files done.

## Questions

| id | question | evidence |
|---|---|---|
| Q-finance-1 | `SEAT_STANCE.founder`: header says "from R15 §1.6" and the same comment says "The founder/CEO seat votes the player's way [D]". Is the founder vector sourced (R15) or a designer value? Entry is `unclear`. | board.ts:21 |
| Q-finance-2 | `PROMISE_RESULT` comment says met +30 credibility and **+10** board, missed −30 / **−15**; the code holds `metBoard: 30, missBoard: -30`. Which is intended? The board part is then multiplied by the board's mood weight (mood.ts:34 says it reads `PROMISE_RESULT.metBoard / missBoard`). | promises.ts:32, :35; mood.ts:34-35 |
| Q-finance-3 | `RIVAL.multiple` (and `capGrowthRef`): one comment carries research pointers ("[R15 C11, FINANCE-V3 FC2]") **and** `[fit]`, and the 37x / x5 pair is stated for the group. Sourced or fitted? Both are `unclear`; `capGrowthExp` (0.4) is cleanly sourced (R15 §1.5). | rivalFinance.ts:28-33 |
| Q-finance-4 | `STORY.tau`: comment tag is "[D, fit]" and it says "Fitted to the start shares ... [R15 §2.9, R21 A8]". Designer or fitted? Entry is `unclear`. | story.ts:39-42 |
| Q-finance-5 | `STORY.ipoBump` has no tag of its own (only named inside the `pi` comment); `STORY.carry` (0.5) is named in the `pi` comment beside "[fit, R15]". Registered `ipoBump` untagged and `carry` fitted; confirm that the `pi` comment is meant to cover both. | story.ts:60-61, :69-70 |
| Q-finance-6 | IPO window opening year 2026.5 is tagged "[R15, D]" (both). Sourced or designer? The hype >= 0.9 gate and the 365-day close are in the same lines. Entry `unclear`. | investors.ts:181-186 |
| Q-finance-7 | Runway state thresholds (distress < 3 quarters, tight < 6) are written twice: `board.ts` `updateRunwayState` (inline `r.q < 3`, `r.q < 6`) and `runway.ts` `runwayState` (same numbers). Is `runwayState` used? If both are live, tuning one leaves the other behind. Both registered. | board.ts:220; runway.ts:25-30 |
| Q-finance-8 | Autopilot option objects (`REF_AUTOPILOT`, `CAPEX2X_AUTOPILOT`, `RACE_AUTOPILOT`) carry bot policy booleans (`strategic`, `offBalance`, `guard`, `rescue`, `recap`) that `Param.value` (number, number[], string) cannot hold, so only `mult` and `guardQ` are registered. Extend the schema or leave these to the bots registry? | plan.ts:62-66 |
| Q-finance-9 | `AutopilotOpts.guard` doc says "Stop new capex when runway < 4 quarters" but `GUARD_Q` is 4.5 (changed in FIN1) and chips use `GUARD_CHIPS_Q` 3.5. Stale comment only, or a second place where 4 lives? | plan.ts:34, :70 |
| Q-finance-10 | `LARGE_ROUND.min` ($20B, the size above which a round splits into two parts) has no tag and the [R15] cite covers only the half/half structure. Is the 20 sourced? Registered untagged. | equity.ts:124-127 |
| Q-finance-11 | `OUSTER.reluctance` is tagged [D, FIN3b] but described as "Calibrated on the bots (FIN3b notes: reluctance 1 ousted a third more)". A bot-calibrated designer value; registered `designer` with no fit link. Should it be `fitted` against a bot-behaviour target? | board.ts:252-257 |

## Skipped

Every coverage line in the finance files that is not registered:

| coverage line | reason |
|---|---|
| acquire.ts:30 NONE | derived zero-obligation default object (reads `ACQUIRE.termQ`) |
| actions.ts:86 raise, :124 ipo, :165 acceptRound, :187 pullRound, :197 downRound, :329 partner, :362 rescue, :397 draw, :422 repay, :438 recap, :466 critics, :489 refuseRecap, :542 buyChips, :595 rentCompute, :640 site, :680 community, :716 transformers, :735 renegotiate, :778 sell, :810 cancel | not exported action defs; their numbers are preview or effect literals (see Inline overflow) |
| actions.ts:395 COVENANT_OF | string map of covenant texts |
| board.ts:411 boardQSystem | engine system object, no tunable constants of its own |
| cashflow.ts:44 opexSystem, :75 payrollSystem | engine system objects |
| investors.ts:152 capitalQSystem | engine system object |
| mood.ts:53 MOOD_SOURCE_OF | string-to-enum mapping |
| promises.ts:54 KEEP_JUDGED | display count only ("Judged promises kept for display") |

Also not registered (fields, not coverage lines): `DIVISION.keep` (reviews kept for display), booleans of the autopilot option objects (Q-finance-8), `RUNWAY_CAP` (equals `PROJECTION_Q`).
Data tables read by finance but declared elsewhere (`PARTNER_TERMS`, `DEBT_SIZING`, `DEBT_TERMS`, `CAPEX_LEASE`, `GOV_FACTOR`, spreads) are not in this chunk.

## Inline overflow

Notable inline literals beyond the 40-entry cap:

- board.ts:199 financial-seat thresholds `[0.15, 0.3, 0.45]` of own_fin (R15)
- board.ts:292 grievance mix coefficients (0.5, 0.3, ...)
- equity.ts:32 fallback pool `0.3 * (poolAnnual / 4 + carry)`
- equity.ts:218 anti-dilution cap `Math.min(0.1, ...)`; equity.ts:251 and actions.ts:56 discount cap `Math.min(0.6, ...)`
- investors.ts:27 start `bubbleX: 2.0`, hype `1.0`
- investors.ts:80 surprise clamp `[-1, 2]`; :85 hype clamp `[0.3, 2.5]`; :177 sector-growth clamp `[0.5, 8]`
- investors.ts:182 IPO window needs hype >= 0.9; :186 window closes after 365 days
- investors.ts:201 bust spread decay `* 0.5` per quarter
- debt.ts:206 liquidity-cover cap 2; :209 operating-cash-flow score 2; :210 distress score 2
- actions.ts:233 down-round size `max(10, min(0.15 * V * 0.6, 3 * burnQ))`
- actions.ts:409 covenant-called exposure probability 0.05
- actions.ts:450, :458 recapitalisation costs (scrutiny +5, safety morale −3, board confidence +5)
- actions.ts:564 rationing probability 0.5; :651 colocation rent 1.2 $B per GW-year
- actions.ts:776 and plan.ts:167 chip resale = 1.5 years of spot rental
- ledger.ts:10-45 starting finance state: commitments x0.85 (reality), cash 40/45, run-rate 12/13, cloud $2.275B/quarter, lease $1.2B per GW-year, ownership 0.30/0.26/0.17/0.27, revolver $4B at 200bp, $30B growth tranche
- ext.ts:28-39 defaults: stock 13e6, leasePoolGW 0.6, playerShare 0.3, transformersGW 3, buildQ 8
- capex.ts:25 default B-rated lease rate 0.12; :32 default lease rate 0.09
- deals.ts:162 rescue cash `max(minCash, 2 * burn)`; :190-191 tranche GW offsets 0.5 and 1.5
- plan.ts:93 `Math.pow(0.944, qAhead)` per-quarter kW per H100e improvement (also :97, :106, :119)
- plan.ts:285 capability forecast `tr.now + 0.5 * tr.gain`; :300 down-round look-back 180 days
- promises.ts:141 aggressive pitch needs credibility >= 50; :212 "behind" needs a quarter of the year gone (0.25)
- rivalFinance.ts:60 rival credibility multipliers 0.9 / 0.7 (mirror CRED_RUNGS); :128 rival cash floor `spend / 2`
- observe.ts:84 supply horizon `q0 + 8` quarters
