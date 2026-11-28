# Testing guidelines

Why this file exists: by 2026-11-28 `test:quick` took 13 min and 66 CPU-min, 83 checks failed in 21 of 36 scripts,
37 test scripts ran in no tier, `test:cal` checked nothing, and ~95 scratch folders were committed
(design/test-audit/TEST-AUDIT.md). Tests had become slow and untrustworthy, so nobody could read them. These rules
are how we stay out of that. They apply to every new or changed test, and to whoever reviews it.

## 1. Cost follows importance

- Every job in `scripts/v2/run.ts` declares a CPU budget. run.ts warns when a job goes over it. A job that grows over
  its budget is fixed or re-budgeted with a reason in the same change, never silently.
- Tier budgets: **quick ≤ 3 min wall / 15 CPU-min in total**, ≤ 20 CPU-s per job by default. **full ≤ 10 min wall.**
  A job may get a bigger budget only for central behaviour (calibration, safety outcome bands, finance end to end),
  and the reason is written next to the budget.
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
- Long bot games are for emergent, central behaviour only: milestone timing, outcome bands, money over years. They go
  through `simcache` keyed on the game (bot, seed, setup, horizon), not on the script name, so two suites that play
  the same game share it.

## 3. A check must be able to fail, and must mean something

- No vacuous passes. If a loop may see zero cases, require at least one. No bands so wide they can't fail. No `x == x`.
- **Mechanism tests check shape:** direction, monotonicity, identities, conservation, preview = effect. They don't
  pin a tuned number. A number belongs in a test only if it is a **sourced target**, and then it lives in the
  calibration suite (one home), with its source and tolerance.
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

- The machine is shared by parallel sessions. **Heavy runs are anything over ~3 CPU-min: test:full, test:deep,
  test:cal, test:ui, a multi-seed suite in full mode, or run.ts with workers. Ask the designer before starting one.**
  Only one heavy run at a time on the machine.
- Task agents run tsc, `test:quick --only <their jobs>` and their own script. Heavy runs happen only at checkpoints
  and merge waves (test-time policy).
- To measure a speed-up, count the work (sim-days × seeds, games) and time one coarse run. No profiles.
