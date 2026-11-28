# CRB report: calibration move, part B (world, finance, market)

Branch ta-crb. Rule: design/TESTING.md §0 (a check that fails because tuning is off is calibration, not a test).

## What moved where

| From | To | Rows |
|---|---|---|
| worldfx.ts (reference game, 5 timing seeds) | calreport/world.ts | F11 Jul 2025/2026/2027 revenue; youth employment late 2026; aggregate U; four date checks (2 info-only as before); AI-friend share; A2a/A2b/A2c (RPS, R22 seats, tokens a day ×4.6–20, paid share, reach); headlines count; W4 (U at Nov 2026, exposed 22–25 −19%, firm adoption). 24 rows. |
| finance.ts (full tier bot games and shock runs) | calreport/finance.ts | F1, F2, F3, F6; F4 and F5 (shock response, glut, spot +35–45%); F7 (revenue, capex, compute, GW, valuation); F8 (deal+financing, no distress, bare, capex2x); F9 FC1/FC2/FC2 growth/FC2 trailing/dilution; FIN2 rounds; FIN3a board; FIN3b committee; FIN4a/b deals; FIN5a equity raised (the FIN5a KNOWN row); FIN5b FC6; FIN6a FC2 by year; FIN5c mixed-bot division head. 30 rows. |
| serving.ts | calreport/market.ts (+ scripts/v2/cheapest.ts shared helper) | C1 700M users; C5 paid share 5–6%; A7 0.24 Wh; A8 leader share 0.25–0.45, US share 40–72% and hours ratio, day-1 revenue $12–15B / Chat 60–75%; A3 decline ×6–×900. 7 rows. |

The KNOWN entries for worldfx (×6), finance FIN5a and serving C1/A7/A8 are gone with their checks. KNOWN B3 (a real BUG) stays. products.ts had no sourced band (nothing moved).

## What stays as mechanism

- worldfx.ts: now constructed only: start run-rate = 12 (identity of the start), day-900 fixture plain-JSON, revenue writes revenueRate/demandBound on every external deployment (7 ticks from the fixture, was the end of a 915-day game), leverage in [0,1) with a tier (fixture), the two World actions. No seeds loop, no played game, `--smoke` no longer needed.
- finance.ts: all constructed FIN1..FIN6a checks. No played bot game left. Two longer idle-tick mechanism checks stay in full only (`!SMOKE`): FIN4r H1's year of ticks on day 400 (preview = cash paid) and the M3 6-year site-lease wait (marked TODO constructed from siteSchedule).
- serving.ts: reach/paid share dynamics, C5 monotonicity, A8 stock identity, multi-homing and REACH shape, ROW scale identity, A3 exact decomposition (INFO line of the decline), D1/D2 ceilings. D2 stays a short RefBot run from the day-900 fixture (30 days quick, 300 days full): it is an invariant, not a band.
- Constants checked against design values (F9 dilution cap, financing-doubt cut ~25%) stay: they test the shock/cap code on a constructed state.

## Seeds and env override

`CALREPORT_SEEDS=n`: world = n CAL_SEEDS seeds (default 5; seed 2027 first), finance = n RefBot seeds 1..4 (default 4) and min(n,6) distress seeds (default 4 distress seeds from n=4: [1..4]; the old default was 6, change if you want it back: it only costs ≈ 2 CPU-s each). market has no seeds.

## Measured (wall seconds, one process, CALREPORT_SEEDS=1, cache cold)

- calreport world: 42 s; finance: 114 s (1 RefBot seed 34 s + 3 shock runs + bare/capex2x + mixed bot); market: < 1 s. All three: 34 s with warm cache.
- worldfx.ts (new): 19 s wall (mostly tsx start-up). finance.ts --smoke: 58 s. serving.ts --smoke: 17 s. products.ts: 13 s.
- Default seeds, estimate by count: world 5 × 915 days × 45 ms ≈ 3.5 CPU-min; finance 4 seeds ≈ 2.3 + 1 + 0.2 + 0.6 ≈ 4 CPU-min. Both are over the 3-CPU-min heavy line: ask the designer before a default run.

## run.ts changes made / wanted

- Made: worldfx job `budget {quick 20, full 20}`, est 20, args/mode/shards removed (was quick 35, full 240, 2 shards). finance job: shards removed, budget `{quick 70, full 140}`, est 140 (was quick 90, full 420, 4 shards). serving unchanged (25/90; the full tier's D2 dominates). 
- Wanted: none beyond that; finance no longer needs `prefill` shards. If the full tier's finance (≈ 140 s) is still too slow, make the two full-only checks constructed.
- worldfx.ts and serving.ts still read `--smoke` through run.ts args for serving only; worldfx ignores it.

## Findings worth the designer's eye (the report runs show them, not new work)

- On this branch the RefBot reference game is far off its bands: 2026 revenue $6–7B (band 36–67), valuation $0.08T (band 1–3T), board confidence 10, start users 620M. These are the known CAL-TARGETs, but the size suggests the F1/F2 know-how-diffusion merge (bef09906 and before) moved the RefBot economy a lot: balance session should re-measure.
- FIN6a FC2 and F9 FC2 rows print NaN / "no year with both" with one seed (no high-growth marks): with n=1 those rows are meaningless, use ≥ 2 seeds.

## Questions

1. Is the A8 leader-share 0.25–0.45 (Menlo) a sourced band or a design band? I moved it as calibration either way.
2. FIN5c mixed-bot division head (550 days) was moved whole: its "never in distress" is an outcome, its budget-rule identity is already constructed in finance.ts above it. OK?
3. The headlines count (≥ 10 distinct on the reference path) moved to world.ts as a calibration row; a mechanism test of headline firing could be constructed later.
