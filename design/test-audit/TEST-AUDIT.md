# Test audit (2026-11-28)

Scope: everything we run to check the game: `scripts/v2/run.ts` tiers, `test:ui`, the lints, package.json scripts,
the test scripts that no tier runs, and the `scripts/v2/_*` scratch dirs. Measured on master 7ce0ad7e in a clean
worktree (cold cache). Detail files in this folder: `A-unit.md` (18 unit-style scripts), `B-heavy.md` (13 simulation
suites), `C-ui-lint.md` (uitest + lints + package.json), `D-orphans.md` (scripts outside run.ts + `_*` dirs),
`quick-run.txt` / `quick-fails.txt` (the measured quick run), `orphans-result.txt` (the untiered tests' run).
The A–D files are code reads by Sonnet agents; their costs are estimates. Numbers in this file are measured unless
marked "est.".

## 1. State today

**`test:quick` is not quick**: 12.9 min wall, 66 CPU-min (6 workers, machine load 92%); the policy figure was ~4 min.
**14 of 36 scripts pass; 83 checks fail in 21 scripts**, and `tsc-scripts` fails:
- `research.ts:348`, `safetyresearch.ts:33,40` use `Team.quality`, which no longer exists; `npcShocks.ts:8` unused import.
- `rivals` job: `rivals.ts` was deleted in N12 (beb99955), run.ts still schedules it (always FAIL).

`test:cal` checks nothing: `calGolden()` (lib.ts:19) returns empty golden days for all three timelines (same on bal,
cal, world, speed), so calib's T1 median plays 20 seeds × 3 timelines to ASI and every binding check returns early;
only a table prints. Est. ~22 CPU-min of test:full and the longest single job.

**37 asserting test scripts are in no tier** (the NPC-labs, outside-world, labour, RD-M/T tests). Run once today:
31 pass, 6 fail — `labourinit` (1: world stream changed), `rdm01b` (2: MEDIA/PHYS measured vs true), `rdt10`
(table ≠ the pre-T10 map, a one-off migration check), `levellint` (1 hit: workfit.ts:421), `naming` (crashes on its
103→104 save migration section, which the saves-can-break rule forbids), `milestonepred` (one FAIL, then hung: killed
at 600 s; its brief said "seconds"). The 31 passing ones together take ~2.5 min wall on 6 workers.

UI: `uitest.mjs` 711 pass / 19 fail (OPEN.md § Broken tests, today). Agent lean: 11 real bugs (preview ≠ effect,
missing tooltip/idea), 8 stale checks.

## 2. Failing checks: what kind (first sort, from the FAIL lines; each needs a look before acting)

| Kind | Examples | Rough count |
|---|---|---|
| Exact pins to the old world/V1 numbers | suites "reproduces V1's S2 0.36" (0.3575), signals "V1's S5 0.28" (0.278), serving 700M Chat users (620M), evals "v2: 14 days", oversight "v2 M½ 25", successor pull 0.07 | ~20 |
| Calibration targets (owned by the balance session) | worldfx revenue $45–56B ($9.2B), youth jobs, AI-friend share; calib G path, T4 rival gaps; finance FIN5a equity raised | ~12 |
| "Nothing moves" (mechanism not reached, or test setup no longer reaches it) | suites hardening 18% → 18%, products A5 1403.7 → 1403.7, serving S6 27.627 → 27.627, B6 agent-hours 0 → 0, D5, finance FIN4b IP access 0 d/day, safetyresearch E2 m 11.3 → 11.3 | ~25 |
| Behaviour changed (real bug or stale expectation; needs reading) | finance FIN4a/4r/5b/6a, products P6/P7/M2/RD-B12, serving S3/B7/D3, safetyresearch E1 timing, control E15 | ~20 |
| Removal greps that now hit live code | domainref "no REF_OFF in src", worktypes "no mechanism reads shareRefAt …" (npc/lab.ts, worldfx/revenue.ts) | ~3 |
| Tooling | hygiene ledger key order, lint-structure 4-word title | 2 |

## 3. Junk and stale (remove)

- run.ts `rivals` job. package.json: `test:v2` (= test:full), `test:worldfx` (= `--only worldfx`); `bots:v2` is a
  200-seed tool, not a test (keep as tool, out of the test names).
- calib T1 19-seed loop while golden days are empty (guard: play only what binds); calib T2, T3 and the 40-seed T4 loop
  print INFO only.
- ~20 "old flag/name is gone" greps across data, suites, research, oversight, safetyideas, worktypes, serving,
  currency, domainref: one-time checks of finished removals; some walk all of src or read archived docs.
- `currency.ts`, `domainref.ts` (RD-U01/U05 one-offs): fold the 3–4 function checks into effective.ts, drop the jobs.
- `rdt10` (pre-T10 table equality), naming's save-migration section.
- `fixtures.ts` diff against the committed fixtures fails on every engine change and gets regenerated in most commits:
  keep the plain-JSON / round-trip checks, drop the diff and its 3 sims.
- worldfx: a duplicate tl-central game and an INFO-only tl-fast game. hygiene: a 47-line registry change-detector table.
- ~95 `scripts/v2/_*/` dirs, 133 tracked files, 2.9 MB (2.3 MB of PNGs in _dc9/_dc10a/_dc10b): one-off checks of
  finished tasks; only archive docs cite them. Keep `_mk6`, `_w1b` until balance/params/{market,worldfx}.ts re-point
  their `fit.script`; re-point the evidence strings in src that name _mk5/_mk5b/_mk12/_cal2x/_cals. Then
  `.gitignore` `scripts/v2/_*`. (Untracked `scripts/v2/_sabtmp/` in the main checkout: someone's probe; ask first.)
- To ask: `botfingerprint.ts`, `ref-trace.ts` (+ golden/ref-trace.json), `aifm_phase.py` look single-purpose.

## 4. Slow (measured CPU in quick; est. savings from B-heavy / A-unit)

Measured CPU in the quick tier (smoke modes included): finance 778 s (2 shards + script), safety SMOKE 521 s,
hygiene SMOKE 458 s, idle (1 seed!) 303 s, worktypes 299 s, serving 210 s, directorEndings SMOKE 197 s, money 154 s,
evals 135 s, worldfx SMOKE 130 s, products 120 s, fixtures 108 s, research 90 s. These 13 are ~58 of the 66 CPU-min.
Smoke modes that cost 3–13 CPU-min each are not smoke.

Main causes:
1. Long simulations for minor or local checks: worktypes ticks one line 2920 days and plays RefBot to ASI (order of
   milestones, already in calib); serving plays ~580 + 2 × 1200 + 200 days; research 3 × 900 + 2 × 400 + 600 days +
   three RefBot runs on one seed; money 3 × 730 days for one cash identity; evals 365 RefBot days for a lab-behaviour
   number; effective runs 500 days to set `time.day = 500`; idle 16 uncached games (and can pass vacuously).
2. Rare-event sampling (forbidden by the test policy): products' up-to-30000 incident rolls; safety S5 sabotage on/off
   160 games to SAR (deep; its own comment calls 20 pairs noise); finance F10 400 sites × 5 years for data constants;
   20000-iteration loops in sabotage/footholds/control.
3. More seeds than the check needs: safety S4 40 + 40 games to ASI (20 + 16 hold the band), worldfx 19 timing seeds,
   finance bare/capex2x 12 seeds each, directorEndings E2 1000 seeds / T3 8.
4. No sharing: none of the 18 unit-style scripts uses simcache; safetyrates' 12 games are safety S4's seeds 500–511 but
   are cached under another key; `newGame` rebuilt 8–12 times per script where sites.ts already builds once and
   `structuredClone`s.
5. uitest: 222 fixed sleeps, no condition waits; 9 check groups each repeated at day 1/400/900 (27 blocks); always a
   full tsc + vite build; screenshots always on. Est. 6 → ~2.5 min.

Est. total: ~55 of ~85 CPU-min of the heavy suites in test:full, most of the unit-style CPU, ~32 CPU-min of deep.

## 5. Proposed shape after the cleanup

| Tier | Contents | Target |
|---|---|---|
| quick (every task) | tsc main + scripts; lints (one process for the source-scan lints); every constructed/fixture test incl. the 31 untiered passing ones; no game longer than ~1 simulated year; no seed loops | ≤ 3 min wall, ≤ 15 CPU-min |
| full (merge gate) | quick + the slimmed sim suites (fewer seeds, shared cached games) + test:ui | ≤ 10 min wall |
| cal | only once the balance session has golden days; until then it is removed from the policy text | — |
| deep | gone if S5 becomes a constructed pair on the day-900 fixture | — |
| perf | unchanged (quiet machine) | — |

Each test states its runtime and why it is worth it (test-time policy, 2026-11-27).

## 6. Conflicts to plan around

Branches bal, cal and speed have unmerged edits in scripts/v2 (9, 5 and 4 files). Fixes to the same
scripts must be merged after them or rebased onto them. Calibration-target failures (§2 row 2) belong to the balance
session (calibration-not-mechanisms rule); "nothing moves" failures may be real mechanism bugs, and fixing those is a
mechanism change (parked unless crucial, rule of 2026-11-27): the test work can only classify them and report.
