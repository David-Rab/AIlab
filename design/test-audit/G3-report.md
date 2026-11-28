# G3 report: serving.ts, products.ts, money.ts (branch ta-g3)

Measured with process CPU (user+sys of one node process). Before = quick-run baseline.

| Script | Before (quick) | After quick | After full | Result |
|---|---|---|---|---|
| serving | 210 CPU-s, 78 pass / 14 fail | 15 (`--smoke`) | 49 | 4 WARN (KNOWN), 0 FAIL |
| products | 120 CPU-s, 60 / 8 | 10 | 10 | all pass |
| money | 154 CPU-s, 24 / 0 | 15 | 15 | all pass |

Note: run.ts does not pass `--smoke` to serving in quick; without it serving's D2 plays 300 RefBot days (49 CPU-s). See proposals.

## Finding: the MK-CP restatements were lost

Commit e839141 ("MK-CP: serving and products rigs restated to the market redesign") is in no branch. It already held the
fixes for serving S3 (day 400/900), B6, B7 (day 400/900), D3 (day 1/400), RD-B11 B16 and products P6. I re-applied it
(`git apply --3way`, clean) and then did the rest. That cleared 9 of the 14 serving fails and 1 of 8 products fails.

## serving.ts: every failing check

| Check | Class | Action | OPEN.md row |
|---|---|---|---|
| S3 day 400 / 900 | TEST-BUG | rig offer built as mix.ts builds it (labToolOpts), from e839141 | none |
| B6 | TEST-BUG | day-400 Enterprise with Agent mode (MK-11 gate), from e839141 | none |
| B7 day 400 / 900 | TEST-BUG | same rig fix | none |
| D3 day 1 / 400 | TEST-BUG | MK-6 agent prices and the player's MK-5c tier mix, 1e-9 relative, from e839141 | none |
| RD-B11 B16 | STALE-PIN | Trusted's x3 is gone; now "Vetted offer = Enterprise offer" | none |
| S6 internal agents | TEST-BUG | RD-A06: a product tool no longer acts on internal agents; the check now uses the internal tool `codingHarness` (s.player.tooling) and also checks the product tool does not touch them | none |
| D5 day 900 | TEST-BUG | no cell of the day-900 fixture binds the ceiling (D1 and the D2 run show 0/42 cells bound), so the lifted-vs-bound comparison saw nothing. Binding case constructed: every cell's ceiling fill set to 0.5 (revenue.ts:508/552 multiplies the player's agent k by `ac.fill`) | none |
| C1 700M weekly users | CAL-TARGET | start users 620M vs the sourced ~700M +-10% (ChatGPT Jul 2025, NBER w34255). Left as is, in KNOWN | "Re-derive ~100 quick-test expectations": serving C1 |
| A7 free message 0.24 Wh | CAL-TARGET | split from the "free users served" check (which passes). 0.02 Wh vs Google's measured 0.24 Wh (arXiv 2508.15734) within x3: since RD-P02 the free tier is the cheapest lineup model. In KNOWN | same row: serving A7 |
| A8 revenue $12-15B, Chat 60-75% | CAL-TARGET | split from the mechanism part (US share, ROW/US hours, which passes). $15.59B and Chat 49% (MARKET-CP (c) had 15.32B / 59%). In KNOWN | same row: serving A8 |
| B3 seat revenue = seats x price x 12 | BUG | known from MARKET-CP (b)1: `a.seatPrice = o.seat` at src/engine/v2/worldfx/revenue.ts:575 is the last (sector, region) cell's price, not the average. In KNOWN | Bug: "seat price readout is the last cell's, not the average (revenue.ts:575); fix: seatDemand x 1e9 / (seats x 12), as seatCost is already computed on the line below (l. 696)" |

Other changes: A1-A5/V1/V3 price-of-fixed-capability series now read snapshots of the fixtures (day 0, 400, 900) of the same
seed-2027 central RefBot game instead of playing 580 days (the decomposition is an identity on any two snapshots; the decline
per year is read over 2.46 y instead of 1.5 y, still inside x6-x900; no sourced band changed). D2 starts from the day-900
fixture (30 RefBot days in quick, to day 1200 in full) and the tl-fast world is dropped (the ceiling invariant is world
independent). One game is built once and cloned (day 0, day 3, day 20); horizons of S4, C1, C2, C5, S6 and V3 cut to 5-15 days with the
expectations scaled by the same time constants (C1 reach threshold 0.03 -> 0.008, C2 reads 1-exp(-t/tau)). V4's 30-day run
dropped (it only reads pure functions of the state). S7 lint kept here (cheap, no sim); it is a candidate for lint-structure.
The x6-x900 band is the sourced Cottier et al. range (kept).

## products.ts: every failing check

| Check | Class | Action |
|---|---|---|
| P6 short of serving | STALE-PIN | equal cut share was cost-plus pricing (removed by MK-6); now free users first, seats served, per-hour work cut by revenue per H100e (from e839141) |
| P7 the engineers build it (60 d) | TEST-BUG + question | at the leader start product upkeep (4.54 team-weeks/week) exceeds build capacity (4.37) and upkeep is served before builds (build.alloc order runs, upkeep, builds), so nothing queued is ever built. The test now sets `build.engAlloc` order to builds first (a player action). Question below |
| P7 switched on for Chat | TEST-BUG | preview replaced the whole tool list (`features: ['companion']`) and so dropped Chat's three start tools (RF-P1); now `[...c.features, 'companion']`; threshold x1.01 -> x1.001 (the enabler is worth +0.75% of users at the target) |
| M2 monitor coverage | STALE-PIN | RD-A05a: the monitors' line is a share of total compute, and SR-13b takes the control protocol's compute out of it first; the expectation is restated from `monitorBudget` |
| A5 less engineering compute | TEST-BUG | `agents.set` refuses a compute change for 'eng' (RD-A05a: own line on Lab); now moves compute on split.engineering to routine and reads `agentsView`. Observation: cutting engineering compute 100x at day 900 lowers build capacity by 0.2% only (human-bound), so the lever is nearly inert there |
| A6 no monitors | STALE-PIN | `used` includes the control protocol's reserve (SR-13b); now monitor part = 0 and used = the control line |
| RD-B12 relaunch / new launch | TEST-BUG | same starved build queue as P7; builds first |

Cost: P5's up-to-30000-roll incident loop (87 s) replaced by a rigged rng (every hazard fires, every catch succeeds): one run
per case shows a monitored incident stays internal with no timer, an unmonitored one is public; the catch rate is read from
`catchOf` (> 0.5 on every act). The 45-day auto-evaluate run (a running eval suite costs ~1 CPU-s a day) is replaced by
constructing a 30-day-old suite and calling `autoEvaluate` (fresh: nothing queued; overdue: one; policy off: none).
One game built once and cloned; P3/P9/RD-B12/RD-B20/C2 use the day-3 clone.

## money.ts

All 24 checks passed before, so no fail to classify. Re-verified against finance v3: every flow in `a.flows` still occurs
(financing, compute, revenue, commitments, payroll, opex, security, transitionFund, world, training). Found one dead check:
"one cash charge per paid training run" was 0 == 0 (`plan.cashCost` is always 0 since the data licences are paid at signing,
runs.ts:585-617, 717-721, 802), deleted. Security spend and the transition fund were only exercised if a bot set them; both
are now set on at the start of each case and the checks require months >= 2 and expected > 0. 3 x 730 days replaced by RefBot
100 days (fresh game) + SafeBot 70 days (day-400 fixture): the invariant is per day and per flow, and all flows occur.

## Proposed run.ts / lib.ts changes
- run.ts: serving `args: { quick: SMOKE }, mode: { quick: 'SMOKE' }` like worldfx; budgets serving quick 220 -> 25, full 660 -> 90;
  products quick 120 -> 20, full 360 -> 30; money quick 160 -> 25, full 480 -> 30.
- lib.ts: a `cloneGame(setup)` helper (build once, structuredClone) would replace the local DAY0/fresh in serving and products.

## Questions for the designer
1. Leader start: product upkeep (4.54 t-wk/wk, 0.5 + 4 sqrt(revenue/$10B) per product) is more than the engineers' build
   capacity (4.37) and is served before builds, so the player cannot build a feature or launch a product until the allocation is
   changed. Intended? (RefBot builds anyway because it reorders?) Not a test question: tests now work around it.
2. D1/D2/D5: the agent-work demand ceiling never binds in the central RefBot game up to day 1200 (worst hours/ceiling 0.73). Its
   mechanism is covered only by D4 (the function) and the constructed D5; nothing exercises it in a simulation.
3. serving E-series / A5 lineups, REACH etc. still pass; nothing else open.
