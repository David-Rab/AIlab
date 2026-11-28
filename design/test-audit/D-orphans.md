# D: scripts/v2 files outside run.ts, and the underscore dirs

Read-only audit of master (worktree AI27-testaudit), 2026-11-28. Nothing was run, so "passes today" is unknown for every test below.
Costs are estimates from what each script does (constructed cases on fixtures = seconds; a 900-day game = 20-60 s).
A cheap import-existence check found no broken relative imports in scripts/v2/*.ts.

## Task A. Files not in run.ts (lints skipped)

### A1. Tests never added to run.ts (all assert and exit 1 on failure; all should join a tier)

| file | what | referenced by | last commit | verdict |
|---|---|---|---|---|
| npcData.ts | N2a: shape checks on NPC lab data tables | NPC-LABS spec | 2026-11-28 W6 | ADD quick, ~2 s |
| npcReference.ts | N1: reference frontier reader, 3 runs per timeline | NPC-LABS spec | 2026-11-28 reference series | ADD quick, ~10 s |
| npcShocks.ts | N6: shocks on a fresh state, previews equal effects | NPC-LABS spec | 2026-11-27 | ADD quick, ~3 s |
| npcEndings.ts | N5: endings read NPC lab m, direct calls | NPC-LABS spec | 2026-11-27 N5 | ADD quick, ~3 s |
| npcMoney2.ts | N8b: NPC money is display, few ticks | NPC-LABS spec | 2026-11-28 W11b | ADD quick, ~5 s |
| npcSetup.ts | N10: NPC cast setup, some ticks | NPC-LABS spec | 2026-11-27 | ADD quick, ~10 s |
| npcMarket.ts | N4: what NPC labs sell, ticks | NPC-LABS spec | 2026-11-27 | ADD quick or full, ~15 s |
| npcPublic.ts | N9: public view of an NPC lab, ticks | NPC-LABS spec | 2026-11-27 W1c | ADD full, ~20 s |
| npcLabs.ts | N2b-1: capability core, one 900-day tl-central game. Its name is also imported by npcData, npcRisk, npcSetup, serving.ts and src deals.ts (comment/shared use) | NPC-LABS spec | 2026-11-27 | ADD full, ~30-60 s |
| npcRisk.ts | N2b-2: race pressure, misalignment, incidents; 900-day game | NPC-LABS spec | 2026-11-28 W11b | ADD full, ~30-60 s |
| npcMisalignment.ts | N3: M_world(G) vs the probe values, 12 seeds x 4 worlds | NPC-LABS, MISALIGNMENT spec | 2026-11-27 N3 | ADD full (quick with --seeds 3), ~60 s |
| worldObserve.ts | W2: shared world inputs on fixtures (lib check/finish) | OUTSIDE-WORLD, WORLD-TASKS | 2026-11-28 W11b | ADD quick, ~5 s |
| worldPublic.ts | W4: the public, daily step on fixtures | same | 2026-11-28 | ADD quick, ~10 s |
| worldUsgov.ts | W5: US government on fixtures | same | 2026-11-28 W11b | ADD quick, ~10 s |
| worldChina.ts | W6: China government on fixtures | same | 2026-11-28 W11b | ADD quick, ~10 s |
| worldUiReadouts.ts | W8b-1: outside-world UI selectors finite and consistent | WORLD-TASKS | 2026-11-28 W8b-1 | ADD quick, ~5 s |
| labourinit.ts | L11: labour market start state | LABOUR-ROUND | 2026-11-27 | ADD quick, ~5 s |
| margins.ts | L2: labourMargins vs finite differences on day 0/400/900 fixtures (named in a src labourBar.tsx comment) | LABOUR-ROUND | 2026-11-27 L15 | ADD quick, ~10 s |
| optsplit.ts | L1: optimal human/AI task split (pure) | LABOUR-ROUND | 2026-11-27 | ADD quick, ~2 s |
| market.ts | L12: labour market weekly system | LABOUR-ROUND | 2026-11-27 W1c | ADD quick, ~10 s |
| poach.ts | L13/L14: premium pay, poaching, placeholder rivals | LABOUR-* docs | 2026-11-27 | ADD quick, ~10 s |
| startstaff.ts | L15: team sizes 100/50/20, sourced leader start | LABOUR-SOURCES | 2026-11-27 | ADD quick, ~5 s |
| stars.ts | L17: stars engine | OPEN.md, LABOUR-*, RECAP | 2026-11-27 | ADD quick, ~10 s |
| repool.ts | L5: pooled capability REs (verify it asserts: no PASS/FAIL string found) | LABOUR-ROUND | 2026-11-27 | ADD quick if it asserts, ~5 s |
| safpool.ts | L6: pooled safety REs (same caveat) | LABOUR-ROUND | 2026-11-27 | ADD quick if it asserts, ~5 s |
| linestart.ts | L4: mid-game research lines start from the pool (same caveat) | LABOUR-ROUND | 2026-11-27 | ADD quick, ~3 s |
| milestonepred.ts | RD-L04: one milestone predicate decides all labs; fresh games, "seconds" (same caveat) | design docs | 2026-11-27 W1d | ADD quick, ~5 s |
| naming.ts | Model naming: start names, RefBot game, theme change, 103 to 104 save migration. Migration section contradicts the saves-can-break policy | MODEL-NAMING | 2026-11-24 | ADD full, ~30 s, after deleting the migration check |
| rdm01.ts | RD-M01: measured level fitted from benchmarks | B0-SCOUT | 2026-11-27 | ADD quick, ~10 s |
| rdm01b.ts | RD-M01b: MEDIA/PHYS measured levels from benchmark rows | none | 2026-11-27 | ADD quick, ~10 s |
| rdm02.ts | RD-M02: know-how readouts never carry true effects | none | 2026-11-27 | ADD quick, ~10 s |
| rdt08.ts | RD-T08: quality/hazard filters act through data draw | B0-SCOUT | 2026-11-23 | ADD quick, ~3 s |
| rdt09.ts | RD-T09: synthetic data mix follows teacher | none | 2026-11-23 | ADD quick, ~3 s |
| rdt10.ts | RD-T10: option unlocks from one table | none | 2026-11-24 MK-11 | ADD quick, ~1 s |
| levellint.ts | RD-L05: no hard-coded display-level thresholds in src/engine/v2 (lint-style) | design docs | 2026-11-22 | ADD quick, ~2 s; hand to the lint agent |

Total if all added to quick: roughly 3-4 min CPU serial (about 1 min on 6 workers), plus about 3 min in full for the long ones. Most come from finished tasks (RD-*, L*, N*), but each tests a live mechanism, so deleting loses coverage. Run each once before adding, since none has run in a tier and a stale assertion is possible. Per the failing-is-fine policy a first failure is information.

The npc*.ts (N-series, merged 2026-11-27) and world*.ts (W2-W8b, merged 2026-11-28) files are exactly the unregistered tests of those two merges. They assert (check() plus exit code, or lib check/finish) and belong in tiers.

### A2. Tools, helpers and others (keep)

| file | kind | what | referenced by | last commit | verdict |
|---|---|---|---|---|---|
| balrun.ts | TOOL | balance runner | package.json bal:run; 12 docs | 2026-11-27 W10a | KEEP |
| baldash.ts | TOOL | balance dashboard | package.json bal:dash; 3 docs | 2026-11-27 | KEEP |
| baldash-live.ts | TOOL | live-server part of dashboard | baldash.ts | 2026-11-25 | KEEP |
| worlddash.ts | TOOL | outside-world dashboard | package.json world:dash; OUTSIDE-WORLD, WORLD-TASKS | 2026-11-28 | KEEP |
| bots.ts | TOOL + HELPER | bot CLI; imported by botfingerprint, safetyideas (a job), starts, src bots/settings | package.json bots:v2; 54 docs | 2026-11-27 | KEEP |
| botgame.ts | HELPER | plays a bot game | balrun, bots, startstaff, tastecurve | 2026-11-27 | KEEP |
| policies.ts | HELPER | 4 lines | balrun, botgame | 2026-11-26 | KEEP |
| matched.ts | HELPER | matched research speed-up spdM | balrun, botgame | 2026-11-27 | KEEP |
| forcedInputs.ts, overridePreload.ts, paramOverride.ts | HELPER | Stage-1 forced inputs and parameter overrides for balrun | balrun; HANDOFF-CALIBRATION, HANDOFF-PERF | 2026-11-25..27 | KEEP |
| observer.ts | HELPER | observer run mode | balrun; HANDOFF-BAL, OUTSIDE-WORLD | 2026-11-27 | KEEP |
| calseeds.ts | HELPER | seed lists | balrun, calib (job), calscan, worldfx (job) | 2026-11-27 | KEEP |
| calibscore.ts | HELPER | shared calibration scoring | s1compare, baldash | 2026-11-27 | KEEP |
| s1compare.ts | TOOL | Stage-1 comparison table | HANDOFF-CALIBRATION, FIXC docs | 2026-11-27 | KEEP |
| tastecurve.ts | TOOL | taste-curve report | baldash; HANDOFF-CALIBRATION | 2026-11-27 | KEEP |
| calscan.ts | TOOL | multi-seed calibration scan | 13 design docs | 2026-11-27 | KEEP |
| starts.ts | HELPER + TOOL | start types; imported by baldash, effective, finance, hygiene, products and more | many | 2026-11-27 | KEEP |
| safety-emu.ts | HELPER | real-engine bot play for safety.ts | safety.ts | 2026-11-27 | KEEP |
| worldfx-refplay.ts | HELPER | reference-play probe | worldfx.ts | 2026-11-27 | KEEP |
| readsweep.ts | HELPER | selector purity sweep | hygiene.ts | 2026-11-23 | KEEP |
| lint-tips.ts | HELPER | tooltip lint | lint-ux.ts | 2026-11-24 | KEEP |
| profile.ts | TOOL | daily-tick profiler | HANDOFF-PERF, B0-SCOUT | 2026-11-27 | KEEP |
| ref-trace.ts | TOOL | RefBot reference trace vs golden/ref-trace.json | B0-SCOUT | 2026-11-27 | KEEP, or delete with the golden file if no longer diffed (ask) |
| botfingerprint.ts | TOOL | proves a bot refactor changes nothing | 4 docs | 2026-11-27 | weak: one-purpose; DELETE if no bot refactor is planned (ask) |
| aifm_phase.py | TOOL | by-phase AIFM series from rollouts outside git | nothing | 2026-11-27 | KEEP only if the AIFM rollout data is still used (ask) |
| uitest.mjs | TEST | in tier full via test:ui | package.json | n/a | already covered |

No outright DELETE in Task A.

## Task B. Underscore directories

Total: 133 tracked files in 100 dirs under scripts/v2/_*/, about 2.9 MB. 2.28 MB of that is 8 PNGs in _dc9 (553 KB), _dc10a (880 KB) and _dc10b (848 KB). The rest is about 600 KB. Dir names are task ids (mk Market, sr safety/R&D rounds, rfs/rfp refactor steps, ub UI build, cal* calibration, cp checkpoints, dc data-centre). Nearly all are a single throwaway `check.ts` acceptance script for a finished task, not in run.ts and imported by nothing. Citing docs are in design/archive/**.

| group | dirs | tracked files | size | contents | referenced from non-archive files | verdict |
|---|---|---|---|---|---|---|
| single check.ts | _a04 _a05a _a05b _a06 _a07 _cal2s _cp3c _cp3i _mk1-4 _mk7-9 _mk10 _mk11 _p06 _p07 _p10 _p11 _r02a _r02b _r03 _r04 _rfp5 _rfs1-5, 7-14 _sci _sr01 _sr04 _sr06-10 _sr12-15 _sr17 _sr19 _sr20 _sr20b _sr22 _sr24b _t01a _t01b _t02-04 _t06 _t07 _ub2 _ub2b _ub3 _ub5c _ub9 _ui0a _x03 | about 85 | about 450 KB | one check.ts each | none | DELETE from git |
| cited as evidence | _mk5 (check.ts, dump.ts, ref-day369.json; 48 KB), _mk5b, _mk12 | 5 | about 61 KB | market-task checks | src/data and balance/params/market.ts evidence strings name _mk5/check.ts, _mk5b, _mk12 | DELETE, after rewording the citations |
| fit script | _mk6 (check.ts) | 1 | 13 KB | market fit script | balance/params/market.ts line 82 `fit.script: 'scripts/v2/_mk6/check.ts'` (three mentions) | KEEP until market.ts names a non-underscore fit script; then delete |
| fit script | _w1b (paths.ts, before.txt, after.txt) | 3 | 1.8 KB | worldfx fit script and before/after text | balance/params/worldfx.ts line 61 `fit.script: _w1b/paths.ts`; before.txt cited in src | KEEP paths.ts until re-pointed (or move it to scripts/v2/), delete the txt |
| cited in src | _cal2x (bass, hire, shift), _cals (fresh, medexp) | 5 | about 9 KB | calibration probes | src/data/v2 sectors.ts/serving.ts evidence strings cite _cal2x/hire.ts and _cals/medexp.ts | DELETE after rewording the two citations |
| calibration probes | _cal3a _cal3i _cals2 _calx _cp3e _cp3g _cp4 | about 18 | about 33 KB | opl, trace, intensity, bd, mixed, s4dist, sight0, v0, probe, gov, soc, p_meas* | none | DELETE |
| baselines | _sr03 (baseline.ts, baseline.json, check.ts) | 3 | 61 KB | baseline snapshot | none | DELETE |
| edit scripts | _sr11 (check.ts, edit1-6.cjs) | 7 | 23 KB | one-off code-edit scripts | none | DELETE |
| end-screen shots | _endview (endview.ts, scorebase.ts, shots.mjs) | 3 | 17 KB | screenshot tooling | none | DELETE |
| screenshots | _dc9, _dc10a, _dc10b (shot.mjs + PNGs) | 11 | 2.28 MB | DC UI screenshots | design/archive/dc/* only | DELETE (largest saving) |
| naming shot | _naming (shot.mjs) | 1 | 1.8 KB | screenshot script | MODEL-NAMING doc | DELETE |

Untracked scripts/v2/_sabtmp/ (in the main checkout only; probe1.ts, probe2.ts, probe3.ts): sabotage-task scratch, cited twice as "v2/_sabtmp" in text. Delete it. Also cited but not present: _obsq, _verify, _w1c.

.gitignore only has `scripts/v2/_*.ts`, which does not cover the `_*/` dirs, which is why they got committed. Suggest changing it to `scripts/v2/_*` after the deletions so new scratch stays untracked.

Citations to re-point before deleting: balance/params/market.ts (_mk6 fit script, _mk5 evidence), balance/params/worldfx.ts (_w1b), and evidence comments in src/data/v2/sectors.ts, serving.ts, src/engine/v2/models/capability.ts and worldfx/{economy,mix,productView}.ts.
