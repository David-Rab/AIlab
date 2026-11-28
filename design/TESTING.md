# Testing guidelines

Why this file exists: by 2026-11-28 `test:quick` took 13 min and 66 CPU-min, 83 checks failed in 21 of 36 scripts,
37 test scripts ran in no tier, `test:cal` checked nothing, and ~95 scratch folders were committed
(design/test-audit/TEST-AUDIT.md). Tests had become slow and untrustworthy, so nobody could read them. These rules
are how we stay out of that. They apply to every new or changed test, and to whoever reviews it.

## 0. Tests check that things work; calibration is not a test

A test answers "does the code do what it should, is anything broken". It is fast and deterministic and runs all the
time. Calibration answers "is the tuning right". It is slow and statistical, and it is the balance session's job, run
at its checkpoints. **If a check can fail because tuning is off rather than because code is broken, it is
calibration.** It lives in the calibration report (`scripts/v2/calreport.ts`, a balance tool, never a merge gate),
with its source and band, one home per target. It does not live in a test.

| Tier | Contents | When | Budget |
|---|---|---|---|
| quick | type-checks, lints, mechanism tests on constructed cases. **No played games.** | every task | ≤ 5 min wall at 2 workers, ≤ 12 CPU-min |
| full | quick + the UI test + a few played games (cached) checked against **wide sanity bounds** ("nothing is absurd": no NaN, milestones in order between 2026 and 2040, probabilities strictly inside 0..1, money within ×10 of the sourced range) | merge | ≤ 10 min wall, ≤ 18 CPU-min |
| perf | wall-time benchmarks | on demand, quiet machine | — |

A sanity bound must be loose enough that tuning can't break it, and tight enough that a real bug does.

**One home per target.** Every sourced band is written once, in `balance/targets.ts` (the target registry, the balance
session's file; `npm run registry:lint` checks it). The calibration report, the back-of-envelope estimates and the
dashboards refer to a target by its id and read band, unit and source from there. No band literal anywhere else. A
missing target is added to the registry with its source (paper, dataset or official figure), band, unit and
tolerance.

**Back-of-envelope estimates.** These are pure calculations: the engine's own functions and parameters evaluated on
sourced reference inputs (the reference curves, the start tables), compared to the registry target. **No games, no
bots, no ticks**, milliseconds in total. They call engine functions and never re-implement their maths; each chain is
2–4 calls, written in a comment. Out of band is a WARN for the balance session (calibration); only NaN, a wrong unit or
an absurd miss (×10) fails. They are the fast "is it roughly balanced" signal between balance checkpoints.

## 1. Cost follows importance

- Every job in `scripts/v2/run.ts` declares a CPU budget. run.ts warns when a job goes over it. A job that grows over
  its budget is fixed or re-budgeted with a reason in the same change, never silently.
- Default ≤ 20 CPU-s per job. A bigger budget needs a reason written next to it.
- Every test file starts with a header comment: what it guards, why that matters, what it costs (sim-days × seeds, or
  "no sim"), and its tier.

## 2. Constructed cases first

- **To test a mechanism, call it.** Build the state from `newGame` or a fixture (`scripts/v2/fixtures/`), set the
  inputs, call the function or a few ticks, and check the result. Build once and `structuredClone` per case (as
  sites.ts does). Don't call `newGame` again for each check.
- **Never simulate to get somewhere.** To get to day 500, set the state, don't run 500 days. To get a mid-game
  state, load day400/day900.
- **Never sample a rare event.** Set the odds (or force the roll) for the test, and check one case each way.
  Monte-Carlo only where the distribution itself is what is tested, and then use the fewest seeds that hold the band.
  Write the arithmetic down (band width vs spread).
- Played bot games appear only in full's sanity checks and in the calibration report. They go through `simcache` keyed
  on the game (bot, seed, setup, horizon), not on the script name, so two users of the same game share it.
- To test a direction ("more safety → less misalignment"), compare paired arms on the same world and seed. The world
  noise cancels, so one or two worlds over a short stretch from a fixture are enough.

## 3. A check must be able to fail, and must mean something

- No vacuous passes. If a loop may see zero cases, require at least one. No bands so wide they can't fail. No `x == x`.
- **Mechanism tests check shape:** direction, monotonicity, identities, conservation, preview = effect. They don't
  pin a tuned number. A sourced target belongs in the calibration report (§0), not in a test.
- No pins to an old version ("reproduces V1's 0.36"). When the design changes, the test changes in the same commit.

## 4. One-off checks don't stay in the suite

- A check that a removal or migration happened ("the old flag is gone", "table equals the pre-T10 map") runs once
  during the task. It does not get committed into a suite. If it should hold forever, it is a lint rule (in a
  `lint-*` script).
- Scratch files go in `scripts/v2/_*` (git-ignored, never committed) or `.scratch/`. Evidence for a fitted parameter
  points at a committed, non-scratch script.
- No save-migration tests (saves can break).

## 5. Every test runs, and red has an owner

- Every script that asserts uses `check` / `finish` from `scripts/v2/lib.ts` (PASS/FAIL lines) and is a job in
  run.ts. run.ts fails quick if an asserting script under `scripts/v2/` is in no tier.
- Who changes a mechanism updates or deletes the tests it breaks in the same change.
- Tests failing during development is fine. At merge, each red check is either fixed, deleted as stale (with the
  reason in the commit), or listed in design/OPEN.md with an owner. A known failure is registered in `KNOWN` (lib.ts)
  with that OPEN.md item, so the suite reads green-or-new.
- Fixtures are regenerated (`npm run fixtures:v2`) as part of an engine change. No test diffs whole fixtures.

## 6. UI tests

- Wait for conditions (a selector, a text), never fixed sleeps.
- Check a datum at one representative day unless the day matters to what is checked.
- Screenshots only on request or on failure. Don't rebuild when `dist/` is fresh.

## 7. Running tests: CPU etiquette

- The machine is shared by parallel sessions. **Heavy runs are anything over ~3 CPU-min: test:full, test:ui, the
  calibration report, or run.ts with several workers. Ask the designer before starting one.**
  Only one heavy run at a time on the machine.
- Task agents run tsc, `test:quick --only <their jobs>` and their own script. Heavy runs happen only at checkpoints
  and merge waves (test-time policy).
- To measure a speed-up, count the work (sim-days × seeds, games) and time one coarse run. No profiles.
