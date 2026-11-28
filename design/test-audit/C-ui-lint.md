# C: uitest + lints + package.json scripts (read-only audit, 2026-11-28)

Nothing was run. All numbers come from reading code and run.ts. The wall-time split is an estimate from the code, not a profile.

## 1. scripts/v2/uitest.mjs (2589 lines, about 292 ok() sites, about 730 checks, 82 screenshots)

How it boots: ONE browser, ONE page, serial, for the whole file. It loads saved state 9 times through `window.ai27v2.importJson(...)` of fixtures in scripts/v2/fixtures (day400.json x4 at L1616/2166/2233/2391, day900.json x4 at L1776/2402/2468/2553, start-*-day400.json in a loop at 2444). It never simulates to day 400/900 in the browser. Day 1 is a real new game started through the setup screen (Game B, tutorial off), clicked through with real FF to run completion.
`npm run test:ui` = `npm run build` (tsc --noEmit then a full vite singlefile build) and then the test. The build is redone every time even if dist is fresh. run.ts starts it first in `full` so its wall time overlaps the sims (about 6 min wall, about 40 s CPU).

Waits: no waitForFunction or waitForSelector anywhere. 222 fixed `wait(ms)` sleeps (literal sum about 47 s, but many sit inside loops over panels/tabs/limits so the real total is far larger), plus polling loops (alert wait up to 10 s). `check()` adds a 120 ms settle after every action, `nav()` 100 ms, `tabTo` 80 ms. Tooltip checks hover then sleep 450 to 900 ms. Real-time sections: speed 3 with wait(1500)+wait(1200), a speed-4 run from the day-400 fixture.

Case grouping (section banners):
- Start and setup (L95-141), about 40 cheap picker clicks.
- Time controls (L142-246): real-time speed, tooltips, coach cards.
- Game B (L247-807): every panel and action on a fresh day-1 game; many one-click "button changes state" checks.
- B1, B2, B3, B4, D6, D4, E12, D8, E11 check functions (L808-1613), each called as `xCheck('day 1' | 'day 400' | 'day 900')` (L1564-1583, 1724-1794): 9 functions x 3 days = 27 large blocks. This is the biggest repetition.
- Game C day-400 fixture (L1614-2403): `coverage()` screenshot + IA scan over EVERY panel and tab at day 400 (L1720) and again at day 900 (L1817); J1 rendered tooltip coverage; FIN*, J2, F6*, E6, E11 and others.
- R9 start fixtures (L2404-2455), R10 limits hover sweep (one nav + hover per registry limit, L2456-2554), end screen (L2555-).

Same thing at several days (candidates to run once, at day 400): B1 product cards, B3 World sectors (also one screenshot per day), B4, D4, E12, the term/tooltip parts of B2/D6/D8. Only B2 (locked vs unlocked rows), D6 (complete vs preview), D8 (depth), E11 (planted) really differ by state. `coverage()` and the IA scan run twice (day 400 and 900).

Names after old task ids: nearly every case (UB-5, UB-A, UB-6, UB-F, L0, DC-9, MK-7, MK-13, M12/M13, FIN1-6, J1/J2, E6/E11/E12, F6c/F6e, D4/D6/D8, R9/R10, RD-*). The Products, Models, Safety and Finance blocks are the ones that went stale; the Overview/hub/top-strip checks (UB-5, UB-A) are the newest.

The 19 known failures (from OPEN.md; code not debugged, this is only a lean):
| failing check | lean |
|---|---|
| Products: locked tools name their idea, plus B2 day 1/400/900 tools-editor rows (4 failures, one cause) | likely REAL BUG: row text shows `agentMode:` with no idea |
| D8 day 1/400/900 policy row cost per suite (3) | STALE CHECK: row now shows RE and engineer team-weeks, check expects H100e-days |
| D8 every evals term has a tooltip (`evalGate`) | likely REAL BUG: missing glossary entry, cheap |
| D6 day 1 expansion and hardening match their preview (2: 99% vs 114%, 18% vs 12%) | likely REAL BUG: preview-truth violation, high value |
| E12 day 400 trait best guess and range (15 of 17 rows read) | STALE CHECK (two rows read differently) |
| E11 day 400 and 900 Remove preview vs effect (2) | REAL BUG: preview omits the AI-staff-off for 3 days, preview-truth |
| FIN3c stock payment dilution and obligations | STALE CHECK |
| E6 control protocol grid cell and slowdown | STALE CHECK |
| IA one home per datum (`safetyHeader`, `frameworkHold` on five Safety screens) | STALE CHECK or a leftover data-home on shared headers, low importance |
| F6c Retire version preview and F6e Targeted training preview (2, dPen 0) | likely REAL BUG or stale fixture; preview-truth |
| R10 limits shown where they bind (`research.rePerProject`, `response.hardenFloor`) | STALE CHECK (registry lists limits no longer on those screens) or a missing readout |
Lean tally: about 11 real bugs (tools-editor 4, evalGate 1, D6 2, E11 2, F6 2), about 8 stale checks (D8 policy 3, E12, FIN3c, E6, IA, R10). The preview-truth failures (D6, E11, F6) are central. lint-tradeoffs does not cover those screens (below), so uitest is their only guard today. Fix them in the game, not in the test.

Where the roughly 6 min goes (estimate): the page is mostly waiting. Build 0.5-1.5 min; the 27 x-Check blocks 1.5-2.5 min (hover sleeps of 450-900 ms dominate); two coverage sweeps with screenshots about 1 min; R10 limits sweep 0.5-1 min; Game B per-button checks with 120 ms settles 0.5-1 min; real-time sections about 0.3 min.

What would cut it (largest first):
1. Run B1/B3/B4/D4/E12 wording checks once (day 400); keep the day split only for B2/D6/D8/E11. Removes about 40% of the large blocks.
2. Replace fixed sleeps by condition waits (`waitForFunction` on the expected DOM or `.tip`); the 450-900 ms hover sleeps first. Could halve the sleep total.
3. Make screenshots opt-in (`--shots`); keep the IA scans.
4. Skip the build when dist is fresh (`test:ui:fast` = `node scripts/v2/uitest.mjs`). The quick path never runs UI today anyway.
5. Split the file into 3 processes (setup + Game B, day-400 fixture, day-900 fixture), 3 workers, about 2.5 min with no content cut.
6. A small quick UI tier: only central checks (preview-truth, page errors, one home per datum, tooltip coverage, boot and a few clicks); the task-id screen wording checks stay in full only.
Importance: preview-truth, page errors, IA and tooltip coverage = core; per-screen row wording = minor; Game B "click changes state" = medium to minor.
Verdict: SLIM (items 1-5), fix the lean-bug failures in the game, fix or delete the stale checks.

## 2. Lint scripts

All of lint-hidden, lint-ux, lint-tradeoffs and lint-structure are run.ts jobs in quick and full (est 10 s each, mostly node+tsx startup). lint-tips is imported by lint-ux (`tipSites`), so it is covered, not dead. levellint, registry-lint and scenarios-lint are in no run.ts tier.

| script | what it checks | importance | cost driver | staleness | verdict |
|---|---|---|---|---|---|
| lint-hidden.ts (43 lines) | regex over src/ui/v2 (not end/) for reads of hidden truth (`hidden.`, `*True`, safetyTruth, footholds) | core (hidden-state rule) | file reads, about 1 s | looks current | KEEP |
| lint-ux.ts (189) | (1) AUDIT #1 regression: switching internal agent must not drop L; (2) glossary links, Term ids and required terms resolve; (3) calls lint-tips | medium | fixture deserialize + oxc parse of all UI files (few s) | check 1 is an old regression; header numbering is 1,3,2 | KEEP; SLIM: drop check 1 if no longer meaningful after the model rebuild |
| lint-tips.ts (131) | every JSX number site sits under a tooltip owner or is on the ALLOW list | medium | oxc parse of src/ui/v2 | overlaps uitest J1 rendered coverage and the `data-term-missing` IA scan | KEEP the static one; drop uitest J1 (or vice versa); one is enough for a minor rule |
| lint-tradeoffs.ts (203) | on 3 fixtures: every action/choice preview renders, progress lines carry units, immediate meter lines are applied when run on a copy, training/evals/leads previews equal mechanism | core (preview-truth) | 3 fixture loads, ticks and 200-iteration eval loops (L139, L153), maybe 10-30 s | does not cover the D6 suites, E11 Remove or F6 retire/targeted-training previews that uitest shows failing | KEEP; ADD those previews here (engine level, no browser) |
| lint-structure.ts (88) | every system has a STRUCTURE tag, no orphan system or dead verb, unique action ids, titles of 4 words or fewer, no readers of retired pm/pa | medium | registry import + src scan | rule 4 (pm/pa retired in F3) is a done migration guard | KEEP; rule 4 can go once nothing could reintroduce pm/pa |
| levellint.ts (89) | RD-L05: no hard-coded display-level thresholds in src/engine/v2 mechanics (`level-lint-left` tags are listed, not failed) | medium (design rule) | one regex scan, about 1 s | in neither run.ts nor package.json: nobody runs it | ADD to quick (verify it passes first) |
| registry-lint.ts (221) | balance registry balance/params/*.ts: refs resolve, targets exist, bounds; `--self-test` | medium for calibration, minor otherwise | imports the whole param tree, several s | package.json `registry:lint` only; belongs to the bal workstream | ADD to full (quick: `--self-test` only) |
| scenarios-lint.ts (99) | balance/scenarios.ts: unique ids, layer/timeline/align consistency, targetId exists, lo<=value<=hi, p10/p90 order, checkpoints per timeline | minor | import only, about 1 s | package.json only | ADD to quick |

Overlap: the "every term/number has a tooltip" rule is checked three ways (lint-tips static, lint-ux glossary, uitest J1 rendered coverage + data-term-missing IA scan). lint-hidden, lint-structure rule 4 and levellint are all pure source scans. Process startup dominates their cost (run.ts notes about 10 s per script under load), so merge lint-hidden + lint-structure + levellint (+ scenarios-lint) into one `lint-source` job.

## 3. package.json scripts

Gates: test:ui, test:quick, test:cal, test:full, test:deep, test:perf, test:v2 (alias of test:full), test (alias of test:v2). The two aliases are redundant; keep `test` and `test:full`.
Tools: dev, build, typecheck, bal:run, bal:dash, world:dash, fixtures:v2 (regenerates fixtures; its compare mode is the run.ts `fixtures` job, so this is correctly a tool), registry:lint, scenarios:lint.
Questionable:
- `test:worldfx` -> worldfx.ts exists and is a run.ts job; the alias is redundant with `run.ts --only worldfx` but not broken. Minor clutter (DELETE optional).
- `bots:v2` -> bots.ts exists (compiles via tsc-scripts) but is a 200-seed statistical harness in no run.ts tier; header predates model v3. Tool, probably stale: mark as a tool or DELETE if calib/directorEndings supersede it.
- No script points at a missing file.
- I did not audit the other 90 or so files in scripts/v2 (outside my slice).

## Verdict summary
- uitest.mjs: SLIM (de-triplicate day variants, condition waits, 3 processes, skip rebuild when fresh, shots opt-in); fix the about 11 lean-real-bug failures in the game; fix or drop the about 8 stale checks.
- lint-hidden, lint-structure: KEEP. lint-tradeoffs: KEEP + ADD previews. lint-ux/lint-tips: KEEP/SLIM. levellint, scenarios-lint: ADD to quick. registry-lint: ADD to full.
- package.json: bots:v2 and test:worldfx questionable; the rest fine.
