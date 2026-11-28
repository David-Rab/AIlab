# CRA report: calibration move, part A (milestones, rivals, safety, sanity)

Branch ta-cra, 2026-11-28. Rule: design/TESTING.md §0 (tests check that things work; calibration is not a test).

## What moved where

| From | To | Notes |
|---|---|---|
| calib.ts (T1 median, G path, METR h50, M at start, T2, R5) | calreport/milestones.ts | Games, seeds, simcache and every band/source kept. T1 reports "no golden days yet" (ok, skipped) while lib.ts `calGolden()` is empty; with golden days it computes the per-milestone median over `CAL_SEEDS` and the integrated R5 game. calib.ts deleted. |
| calib.ts T4 (3–9 months) + directorEndings T4 (0–11 months) | calreport/rivals.ts `rivals.gapAtStart` | One target. Band kept: CAST-2025 0–11 months (sourced). The 3–9 band is printed in the source text as "band conflict, balance session to decide". |
| directorEndings T3 (China lead at start 6.5–8 months; mean trail 90–270 d; behind on ≥ 95% of days) | calreport/rivals.ts `rivals.chinaLeadAtStart`, `chinaTrailMean`, `chinaBehindShare` | directorEndings keeps E1–E5 and C1 only. |
| safety.ts S4 (RefBot P_mis in [0.40, 0.80] with the CAL2-S source, safe-only ≤ 0.25), S5 (Mixed sight limit above RefBot, half-staff deep check) | calreport/safety.ts | Games: RefBot 500…, safe 700…, Mixed 900…, half-staff 500…. |
| safetyrates.ts RefBot rows (F5 EA start / 2026, AF compliance gap 2026, F6 persistence per post run) | calreport/safety.ts `safety.rates.*` | The INFO-only RefBot rows (F1 hack rate per run, EA/AF at ASI, gate per version, trajectory, S4 mean) were dropped, not moved: no band, no sourced target. |
| (new) | safety.ts paired direction check; sanity.ts | See below. |

Env overrides: `CALREPORT_SEEDS=n` caps every seed list in a module (milestones: first n of `CAL_SEEDS` for the median once golden days exist; rivals: gap seeds 40, China games 3; safety: 20 / 12 / 16 / 10 / 20), `CALREPORT_PRESETS=tl-central,…` (milestones, default all three).

## What was deleted

- scripts/v2/calib.ts, including its `--fit-lines` mode. Comments in src/data that mention `calib.ts --fit-lines / --fit-tree / --fit-v3` are now stale; left as they are.
- safety.ts: the played S4/S5 games and their prefill, the S5 INFO lines (RefBot U < L share, Mixed margin), the "state stays JSON and P_mis is a probability" check (now in sanity.ts), the deep tier.
- safetyrates.ts: the 12 RefBot games and rows; the script is now probes only (40 worlds, ~17 s). Its remaining probe rows still carry sourced bands (F2, F5, F6, F3: MacDiarmid, Schoen, Hubinger); by TESTING.md §0 those are calibration too. Left as the task said; see questions.
- directorEndings.ts: T3, T4 and their imports.

## run.ts changes wanted (not edited)

- Remove the `calib` job (line 73), the `cal` tier text that mentions calib, and the `calib` mention in the long-suites comment.
- `safety`: drop `deep` (args, mode, shards, budget) and `shards` (no `--prefill` any more); budget quick/full about 40 CPU-s (measured about 22 s with the new direction check).
- `safetyrates`: drop `after: ['safety']`; budget full 120 → 30.
- `directorEndings`: budget full 150 → 60 (full measured 57 s wall including E2 on 93 seeds).
- Add `{ id: 'sanity', script: 'sanity.ts', budget: { full: 700 }, ...S(['full'], 900) }` (cost below).
- The `deep` tier has nothing left in it (half-staff moved to the report).
- sanity.ts asserts, so the run.ts orphan guard needs that job line.

## Paired direction check (safety.ts)

Same world and seed, day-400 fixture, RefBot's `refAct` for 120 days under the reference allocation vs a safety-heavy one (`safetyShare` 0.4, `safStaffShare` 0.4, heavy safety post-training, faithful CoT). Check: Mis and P_mis of the newest version are lower under safety-heavy. Measured (Mis of the newest version, reference vs heavy): 60 d 0.128 vs 0.121; 90 d 0.134 vs 0.121; 120 d 0.136 vs 0.079; 150 d 0.136 vs 0.032; 240 d 0.091 vs 0.026. Cost about 10 CPU-s (2 × 120 days). Two things to know. (1) The released model (`bestPlayerVersion`) flips with release timing (at 150 d it read 0.087 vs 0.121, the wrong way), so the newest (internal) version is read. (2) From the day-900 fixture there is no consistent direction over 90–150 days (0.150 vs 0.147 at 90 d, 0.135 vs 0.148 at 150 d), so day 400 is used; I did not lengthen it. I also changed the S5 neuralese mechanism check (constructed on the day-900 fixture): believed U − L falls (−2.41 → −7.31) but true U − L stays equal (−7.22, the true sight limit is already at its floor), so the true side is checked "not higher". It was a smokeCheck before, so it never failed.

## sanity.ts

One game: `refGame(2027)` of safety-emu.ts (RefBot with integrated finance, tl-central, medium, endings skipped, to ASI), cached under the key `refbot-asi-game` {seed, world, alignment, maxDay}. refGame's record now also carries a `SanityRec` (milestones, validateJson snapshots at day 1/400/1200/end, calendar-year revenue, min cash, valuation range, rivals' G every 180 days). The horizon is now `GAME_DAYS` = 16 years; it was 1600 days, which stopped tl-central before SAR (tl-central ASI is at about day 3300 on the stub game).

| Check | Bound | Why |
|---|---|---|
| JSON | no NaN/Infinity/undefined at 4 snapshots | any numeric bug |
| Milestones | SC ≤ SAR ≤ SIAR ≤ ASI all reached; SC in 2026–2040 | order and a plausible century; the timelines are 2027–2036 |
| P_mis | 0 < P_mis < 1 at ASI | 0 or 1 means a degenerate draw |
| Revenue | 2026 in $4.5–560B, 2027 in $14–1,400B | ×10 of worldfx's sourced $45–56B and about $140B |
| Cash | min > −$10,000B | −$10T is a bug, not an overdraft |
| Valuation | finite and > 0 throughout | |
| NPC labs | every rival active at the end: G finite, end > start | |

**The current code fails three of them, and I think that is a real finding rather than tuning.** Seed 2027, integrated RefBot, on this branch (master bef09906): revenue run-rate falls from $15B (day 100) to $6.5B (day 200), $3.3B (day 800), $0.8B (day 1400); finance state "distress" from day 200 and "insolvent" by day 1400; valuation $28–276B; no SC within 16 years (milestones stop at A2, day 1115); revenue 2026 $7.1B (inside ×10), 2027 $3.4B (outside); min cash −$491B. The stub-finance game (calreport milestones, tl-central) reaches SC 2029.55 and ASI 2034.34, so the research chain is fine; the integrated economy is not. The calreport safety rows from the same bot (seed 500) show the same: no ASI, P_mis 0.005 read at the horizon. I did not dig further (not my scope). Either RefBot's integrated play is broken by a recent merge, or the market/revenue model collapses for a lab that follows the reference plan.

Cost: cold 661 s wall (the game ran to the 5840-day horizon because ASI never came). A game that reaches ASI at about day 3300 should be around 5–6 CPU-min. Warm: about 0. Over the 3 CPU-min target; see questions.

## Measured time (one process each, wall seconds)

| Run | Time |
|---|---|
| safety.ts --smoke (new) | 22 s |
| directorEndings --smoke / full | 26 s / 57 s |
| safetyrates.ts | 17 s |
| calreport milestones (CALREPORT_PRESETS=tl-central CALREPORT_SEEDS=1) | 126 s (one stub-finance game to ASI) |
| calreport rivals (CALREPORT_SEEDS=1) | 25 s |
| calreport safety (CALREPORT_SEEDS=1) | 1,373 s (4 integrated games, each to the 16-year horizon; over the 3-min target) |
| sanity.ts, cold | 661 s |

First one-seed calreport readings: milestones out of band on the G path (worst 0.70 G, 0.75 G/yr vs 1.1–1.3) and the METR doubling (9.4 months vs 4.2 ± 1), both known deviations; rivals out on China behind the US frontier (69.5% of days, one seed; known); safety out on the P_mis band, Mixed above RefBot and F6 persistence, all read from games that never reached ASI, so not meaningful until the integrated RefBot works.

## Questions

1. The integrated RefBot goes insolvent with revenue collapsing (above). Is RefBot meant to play the integrated economy? Until it does, calreport safety and sanity cannot read ASI. Who owns it?
2. Sanity horizon: with a working game ASI is at about day 3300 (5–6 CPU-min cold). Cap the game (e.g. day 2200 as briefed, dropping the SAR/SIAR/ASI order check but keeping SC and the order of whatever is reached), or accept about 6 CPU-min in the full tier (cached after the first run)?
3. Are the cash bound −$10,000B and the ×10 revenue bands the right idea of "absurd"?
4. safetyrates' probe rows have sourced bands (MacDiarmid, Schoen, Hubinger): keep them as mechanism tests, or move them to the report too?
5. Rival-gap band conflict (CAST-2025 0–11 months vs V2-SPEC 3–9 months): the report prints 0–11; the 3–9 requirement would fail it (the fixture seed gives gaps down to 0.00). Which one does the balance session want?
6. CALREPORT_SEEDS defaults: the safety module at its default counts is over 100 CPU-min cold at the corrected horizon (20 + 16 games to ASI, 30 to SAR). Reduce them? (S4's arithmetic wants 20 worlds for se 0.07.)
