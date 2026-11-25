# B0 scout: how constants, sources, fits and targets are organised today

Branch `bal`, read-only scan. Counts are rough: "numlits" = numeric literals with a decimal point or 2+ digits, outside comment lines, from a grep heuristic (single-digit integers are missed, comment-only numbers are skipped). Treat as an order of magnitude. There is **no `tests/` directory**; all checks are scripts in `scripts/v2/`. `src/ui/` was not scanned (unsure whether it holds balance constants).

## 1. Where constants live

Whole `src/` = about 71k lines; `src/data` + `src/engine` about 55k lines.

**Data tables, `src/data/` (about 5.9k lines, about 4.3k numlits).** Mostly flat `export const` records or tables of per-entity records.

| File | lines | numlits | Shape |
|---|---|---|---|
| `data/v2/glossary.ts` | 668 | 1215 | prose with digits; not constants (but numbers quoted in text must match) |
| `data/v2/sectors.ts` | 184 | 260 | per-sector records, `ECON_PRESETS` (:89) |
| `data/world.ts` | 322 | 200 | v1 "audited" integrator and world presets (`AIFM_WORLD` :289) |
| `data/v2/techniques.ts` | 84 | 169 | per-technique records |
| `data/v2/agendas.ts` | 199 | 163 | per-agenda records (about 25) + `METHOD_TESTED_OOM` with `src` strings (:150-160) |
| `data/v2/deals.ts` | 191 | 153 | deal templates, debt sizing (:89) |
| `data/actors.ts` | 57 | 137 | `GOV_PRESETS`, `PUBLIC_PRESETS`, `CHINA_PRESETS` (:7,:19,:34) |
| `data/v2/tree.ts` | 310 | 121 | tech tree: `TREE` array (:136), `EFFORT_TM` (:100), `FITTED_EFFORT_TM` (:115) |
| `data/v2/calibration.ts` | 97 | 119 | flat consts + `START_STATE` per preset (:38), `PROD_PRESETS` (:54), `GOLDEN_EXPECTED` (:89), `GOLDEN_SAMPLED` (:95), `GOLDEN_TOL` (:97) |
| `data/v2/edges.ts` | 97 | 115 | about 30 causal edges with `wBar`, `grade`, `cite` |
| `data/v2/workTypes.ts` | 320 | 92 | work types, skill tests, horizon constants, `V3_CAL` per preset (:311); ~110 lines of refit-log comment (:200-310) |
| `data/v2/runDesign.ts` | 243 | 87 | training-run design (RL budget, hazard filter) |
| `data/v2/tools.ts`, `danger.ts`, `postures.ts`, `limits.ts`, `serving.ts` | 325/292/27/54/284 | 76/76/72/70/68 | per-tool, per-danger, per-posture records; `serving.ts` has the cost chain |
| the remaining 25 data/v2 files | 30-170 each | under 65 each | small tables (`benchmarks`, `umodes`, `techs`, `research`, `starts`, `teams`, `blocs`, `market`, ...) |

**Engine, `src/engine/v2/`** (rough numlits per directory): `actors` 880, `safety` 680, `finance` 560, `worldfx` 460, `models` 300, `core` 190, `compute` 170, `events` 170, `endings` 130, `bots` 105, `departments` 90, `production` 70, `security` 44, `world` 27. Engine constants are mostly inline in formulas (not in tables), with these exceptions: top-of-file `const`s, small records (`WS4_TUNING`, `DIFFICULTY_SCALE`), and the tables below.
- Densest engine files: `safety/traits.ts` 1499 lines / ~173 numlits; `actors/{actions,rivals,gov,china,intel}.ts` 94-139 each; `finance/actions.ts` 114; `worldfx/macro.ts` 93; `safety/actions.ts` 84; `compute/market.ts` 82; `worldfx/sectors.ts` 71; `finance/board.ts` 66.
- `engine/v2/types.ts` (2600 lines, ~26 numlits) is types only.
- `engine/v2/events/catalog/*.ts` hold event records (about 170 numlits); `engine/v2/bots/ref.ts` (770 lines, ~63) holds RefBot constants such as `REF_IDEA_TEAMS = 3` (per BALANCE.md; line ref there is ref.ts:95).

## 2. Existing annotation conventions

All in comments; none machine-readable. Counts across `src/**/*.ts` (lines matching):
- `[D]` design value: about 481 lines in 104 files.
- `Source:`/`source:` about 168 in 29 files; `fitted`/`[fit]` about 64 in 27 files; `stand-in` about 46 in 17 files; `sourced` about 30 in 8 files; `[R20 xx]`/`[R16]` pointers to `research/NN-*.md`; `[V]`, `[P-r]`, `[Design]` also appear.
- Tag legends are declared per file header, e.g. `src/data/v2/serving.ts:3`: `// Tags: [R20 xx] research/20, [R16] research/16, [D] design value, [fit] fitted by the calibration harness.`; `data/v2/sectors.ts:4` (adds `[V]` verified primary number); `data/v2/calibration.ts:2`: `[fit] values are fitted by WS1 acceptance tests (scripts/v2/calib.ts, M1) and hard-coded here.`; `engine/v2/actors/tuning.ts:1`: `[fit]/[D] balance knobs`.

Typical examples:
1. `src/data/v2/tree.ts:99` `/** Standard-team-months at M = 1 per effort class, for new (non-paradigm) nodes [D]. */` then `EFFORT_TM = { S: 3, M: 8, L: 25, XL: 50 }`.
2. `src/data/v2/agendas.ts:158` `'T-W2S': { oom: -1.2, src: 'Burns et al. 2023 arXiv 2312.09390: GPT-4 student (≈ 2e25 FLOP, Epoch)' }` (source as a data field).
3. `src/data/v2/edges.ts:26` `{ id: 'E02', ..., wBar: 0.7, grade: 'A', cite: 'METR 2025: o3 hacks 1-2%, ~30% on RE-Bench', ... }` (source and evidence grade as data fields; `GRADE_SIGMA` turns grade into noise).
4. `src/data/v2/workTypes.ts:313-320` `// slow gSC 38.3: a STATED STAND-IN (DECISIONS "Calibration decisions after CAL1 refits" item 7): the top of its source range ...`.
5. `src/engine/v2/actors/tuning.ts:4` `/** Secrets-leak coefficient per spy ... [fit, T3] M2 step 5: 1e-5 → 3e-4. ... */ leakK: 0.0003`.
6. `src/engine/v2/world/hidden.ts:20` `/** Balance knob #1 (§7.4): global scale on difficultyMult [D]. M4: 1.4 ... hurt the mixed bot ... */ DIFFICULTY_SCALE = 1`.

Observations: a constant's tag is often in a block comment above a group, not per constant; the same constant can carry a long history (refit logs of 20-100 lines, `workTypes.ts:200-310`). Only `edges.ts` (`grade`, `cite`) and `agendas.ts` (`src`) have per-record structured provenance. Sources sit in `research/NN-*.md` (22 numbered notes plus `CAL-products-sources.md`, `CAL-safety-sources.md`, `CAL-world-sources.md`, `MARKET-sources.md`, `RD-*.md`) with value/source/quote/confidence per number (e.g. `research/CAL-world-sources.md:1-10`), and in `design/RD-AUDIT/DECISIONS.md`, `BUILD-NOTES.md`.

## 3. Existing registry-like structures

| Structure | Where | Holds | Read by |
|---|---|---|---|
| `V3_CAL: Record<WorldPresetId,{gSC,dBM,r,sdSC}>` | `data/v2/workTypes.ts:310-320` | per-preset fitted/sourced capability thresholds (ai2027 30.15, authors2026 34.09 sourced from AIFM run, fast 31.25, slow 38.3 stand-in) | `world/hidden.ts:5` import, `scripts/v2/calib.ts`, `calscan.ts` (which mutates it at run time, `calscan.ts:42`) |
| `FITTED_EFFORT_TM` | `data/v2/tree.ts:115` (plus `V2_PARADIGM_EFFORT_TM` :109, `EFFORT_TM` :100) | research effort (team-months) for P05/P07/P08/P17/rl.mlResearch, fitted to RefBot | `models/research.ts:281`, `models/tree.ts:140` via `n.effortTM` |
| `GOLDEN_EXPECTED`, `GOLDEN_SAMPLED`, `GOLDEN_TOL` | `data/v2/calibration.ts:89,95,97` | per-preset milestone target dates (SC/SAR/SIAR/ASI, research speed M, h80); sampled-world p10/p50/p90; tolerances SC ±0.08 y, after ±0.12 y | `scripts/v2/lib.ts:20,35`, `golden-timelines.ts:13` |
| `START_STATE` / `PROD_PRESETS` / `PROD_DEFAULT` | `data/v2/calibration.ts:38,54,53` | per-preset start state (g, b0, v0) and production-function parameters | `models/capability.ts:105`, `world/hidden.ts` |
| `WS4_TUNING` | `engine/v2/actors/tuning.ts:3` | 3 China knobs (`leakK`, `distillK`, `theftMinRung`), mutable "so calibration scripts can sweep them" | `security/theft.ts:10` |
| `DIFFICULTY_SCALE`, `DIFFICULTY_RANGE` | `engine/v2/world/hidden.ts:22,25` | spec §7.4 balance knob #1 | `world/hidden.ts` |
| World presets | `data/actors.ts:7,19,34` (gov, public, China), `data/world.ts` (`makeWorld`), `data/v2/sectors.ts:89` (`ECON_PRESETS`), `departments/split.ts:134` (`SPLIT_PRESETS`) | per-preset parameter bundles | `world/hidden.ts:3-12`, actor modules |
| Start definitions | `data/v2/starts.ts` (`StartDef`, difficulty label from bot win rates, :20-24) | per-start teams, products, finance | `core/init.ts` |
| Source-carrying records | `data/v2/edges.ts` (`grade`,`cite`), `agendas.ts` (`METHOD_TESTED_OOM[].src`) | per-record provenance | `world/hidden.ts` |
| `KNOWN: Record<label,string>` | `scripts/v2/lib.ts:121` | documented deviations: a failing check with a listed label prints WARN with a reason; filled in `calib.ts:274`, `golden-timelines.ts:24`, `lint-tradeoffs.ts:81`, `safetyrates.ts:357` | `lib.ts check()` |
| `CAL_SEEDS` | `scripts/v2/calseeds.ts:6` | fixed seed set: 2027 plus 1-19 (20 seeds) | `calib.ts`, `calscan.ts` |

There is no single "knobs list". The spec's balance knobs (V2-SPEC §7.4, knobs 1-6 at about :2242-2248) are prose; knob 1 is `DIFFICULTY_SCALE`, knobs 3, 4, 6 map to rival aggressiveness, China efficiency (`CHINA_PRESETS.efficiency`), investor kappa (in finance), unsure of exact constants.

## 4. Fitted constants

Known fitted by script (the script and target are named in comments; no machine link):
- `V3_CAL.{gSC,dBM,sdSC}` ai2027, fast, (sampled copies ai2027): fitted by `scripts/v2/calscan.ts t1 <preset> --gsc --dbm --sd` (`calscan.ts:3-11`) and first-guess `calib.ts --fit-v3` (`calib.ts:152`); target = RefBot median over `CAL_SEEDS` hitting `GOLDEN_EXPECTED` dates within `GOLDEN_TOL`. Refit history in `workTypes.ts:200-310`. authors2026 gSC/sdSC are **sourced** (AIFM run, CAL2-T, `workTypes.ts:300-310`); slow gSC 38.3 is a stated stand-in (`workTypes.ts:313-317`).
- `FITTED_EFFORT_TM` (P05, P07, P08, P17, rl.mlResearch): `calib.ts --fit-tree` (`calib.ts:174-207`), fitted so RefBot's project durations match V1 (`tree.ts:111-114`).
- LINE_FIT.mu (lines' start effect): `calib.ts --fit-lines` (`calib.ts:238-244`); constant location: unsure, not searched.
- `WS4_TUNING.leakK`, `distillK`: tagged `[fit, T3]` (`actors/tuning.ts:4-9`), target T3 China lead 150-200 d (`calib.ts` header).
- `START_STATE` g/b0/v0: median of `playerStart` over 400 seeds (`calibration.ts:36-37`), derived, not target-fitted.
- Other `[fit]` tags (about 64 lines): `data/v2/sectors.ts:109` (useH to R22), `serving.ts:122,255`, `deals.ts:89` (credit line), `rivalModel.ts:40`, `finance/story.ts` (5), `safety/traits.ts` (9), `models/researchView.ts` (4), `rivalFinance.ts`. The script behind each is mostly not named; unsure.
- `DIFFICULTY_SCALE = 1`: tuned by hand against bot outcomes (`hidden.ts:20-22`).
- `DISTILL_FIT` (`calibration.ts:16`) is fitted to published ratios (comment tag `[P-r]`), not by script.

## 5. Targets and checks

**Defined in code:** `GOLDEN_EXPECTED` (4 presets, `calibration.ts:89`), `GOLDEN_SAMPLED`, `GOLDEN_TOL`; `scripts/v2/golden/timelines.json` (v1 integrator output, `golden-timelines.ts`); `scripts/v2/fixtures/*.json` (day0/day400/day900 and start fixtures, regenerated by `fixtures.ts --write`); `lib.ts:28-38` `calGolden()/calTol()` (slow SC restated to 2034-2035 range, tolerance widened). **In docs:** `design/V2-SPEC.md` §7.1 (:2115, golden table), §7.2 finance (:2149), §7.3 outside world (:2165), §7.4 bot tests (:2188, pass criteria and knob order); `design/RD-AUDIT/CAL2.md:33-110` (results table of targets with CAL1/CAL2/target/verdict; also CAL1.md, RDB08-CAL.md); `research/CAL-*-sources.md`.

**Check structure** (`scripts/v2/lib.ts:112-131`): `check(ok, label, detail)` prints `PASS` / `FAIL` / `WARN` (WARN only if the label is in `KNOWN` with a reason); `smokeCheck()` prints `SMOKE` and never fails when `--smoke`; `finish(name)` sets exit code 1 on any failure. Tolerances are inline per check, or `GOLDEN_TOL`/`calTol`. Statistical targets use the median over `CAL_SEEDS` (20 seeds, `calseeds.ts:6`), seed 2027 informational; some use 5-200 seeds. No structured target record (id, source, strength, tolerance); the target is the check's label string.

**Approximate count:** about 1076 `check(...)` call sites across 50 scripts; heaviest: `finance.ts` 163, `serving.ts` 79, `products.ts` 68, `research.ts` 65, `data.ts` 63, `hygiene.ts` 47, `safetyideas.ts` 39, `suites.ts` 37, `footholds.ts` 34, `worldfx.ts` 32, `control.ts` 31. Many are structural or unit checks, not calibration targets. Calibration targets proper: CAL2.md table has about 35 rows (T1 per preset 4 milestones, T1L, research speed M x4, frontier G path, METR h50 doubling 4.2 mo, T4 rival gaps 3-9 mo, T3 China lead, finance F-series, worldfx W-series, safety S/F-series, China). Bot criteria: 4 in `bots.ts:179-202` (race win <=5%, safe win <=5%, mixed >=30% and +25 pp, passive takeover >=50% diagnostic).

**How run (package.json:6-20):** `test:quick|cal|full|deep|perf` = `tsx scripts/v2/run.ts --tier X` (`run.ts:1-22`, job table `run.ts:57-100` with per-script tiers, estimated seconds, `--prefill k/n` shards); `test:v2`/`test` = full; `test:ui` = build + `uitest.mjs`; `test:worldfx`; `bots:v2` = `bots.ts`; `fixtures:v2`. `bots.ts` is **not** in the `run.ts` job table (separate command only). `typecheck`/`build`. Output goes to `.simcache/logs/<id>.log` and `.simcache/last-run.json` (dir absent in this worktree).

## 6. Scripts (`scripts/v2/*.ts`, 15.4k lines; plus about 90 `_xxx/` task dirs, `fixtures/`, `golden/`, `shots/`)

Calibration/balance: `calib.ts` (T1-T4, R5 acceptance; `--fit-v3`, `--fit-tree`, `--fit-lines`, `--cal`, `--smoke`); `calscan.ts` (multi-seed grid scan of V3_CAL); `calseeds.ts` (seed set, median/quantile helpers); `golden-timelines.ts` (golden integrator vs `timelines.json`); `bots.ts` (bot harness, below); `lib.ts` (check/KNOWN/golden/ref game helpers, `refGame`, `runRef`, stubs); `simcache.ts` (sim cache); `run.ts` (tier runner); `ref-trace.ts` (RefBot trace fixture); `fixtures.ts` (day0/400/900 fixtures); `milestonepred.ts`, `lagdays.ts`, `leadreaders.ts`, `rivals.ts`, `starts.ts` (R9 start checks), `ws4.ts` (China/rivals T3, WS4 tuning), `worktypes.ts`, `effective.ts`, `signals.ts`.
Domain checks (each = one check suite): `finance.ts` (1983 lines, largest), `serving.ts`, `products.ts`, `research.ts`, `data.ts`, `hygiene.ts` (purity + perf), `safety.ts`, `safetyrates.ts`, `safetyideas.ts`, `safetyresearch.ts`, `safety-emu.ts`, `sabotage.ts`, `footholds.ts`, `control.ts`, `danger.ts`, `oversight.ts`, `evals.ts`, `suites.ts`, `successor.ts`, `money.ts`, `idle.ts`, `currency.ts`, `domainref.ts`, `naming.ts`, `worldfx.ts` (+ `worldfx-refplay.ts`), `levellint.ts`, `lint-hidden/-structure/-tips/-tradeoffs/-ux.ts`, `readsweep.ts`, `profile.ts`, `rdm01/01b/02.ts`, `rdt08/09/10.ts`. Other: `uitest.mjs` (headless browser).

**`calscan.ts` (91 lines).** Modes `t1` (RefBot on reference compute stub) and `t1l` (leader lab, passive player), per preset (`:25-30`). Builds a grid from `--gsc/--dbm/--sd` lists (default = committed `V3_CAL` value) x `CAL_SEEDS` (`:31-45,:51`). Worker pool (`:52-62`): the parent spawns N child node processes (`--workers`, default 6, `:57`) of itself with `--shard k/N`; each child plays jobs `i % N === k` (`:51-55`) and exits; the parent then re-reads every record via the cache and prints, per grid point, the median offset from the golden day per milestone, p10/p90, seeds within tolerance, worst |median|/tol with PASS/FAIL (`:64-91`). Child `play()` mutates `V3_CAL[preset]` in-process for the grid point (`:42`) and returns `milestoneDays`, wrapped in `cached('calscan-<mode>', {preset,gSC,dBM,sdSC,seed}, [ME], ...)` (`:41`).
**`simcache.ts` (222 lines).** `cached(name, key, files, compute)` (`:117`): key = sha256(code hash + name + stable JSON of key); `codeHash` (`:59`) hashes every `src/` file except `src/ui/**` and `main.tsx`, plus `lib.ts`, `simcache.ts`, the caller's `files`, `fixtures/**`, `golden/**`, `package-lock.json`, Node version; so any code change invalidates everything (no partial invalidation, `:9-12`). Records are JSON files in `.simcache/` (git-ignored); value round-trips JSON on a miss. `SIMCACHE=off|refresh|on` (`:16-18`); `pruneCache(days=3)` (`:183`); `prefill(runs)` (`:212`); hit/miss stats to stderr (`:108`). Consequence for registry work: a constants change in `src/` invalidates every cached run, so fits must be re-run after any constant edit.
**`bots.ts` (241 lines).** Bots in `ALL` (`:31`): `race`, `safe`, `mixed`, `capex2x`, `ref` (`engine/v2/bots/{race,safe,mixed,capex2x,ref}.ts`; `ref.ts` 770 lines is RefBot, `common.ts` shared helpers). Default 200 seeds per bot (`:30`) over 4 combos world x alignment: ai2027/medium, ai2027/sampled, sampled/medium, sampled/sampled (`:35-38`), `--start leader|challenger|bigtech|spinout`, Realistic actors, Rising storyteller. `playBot` (`:51-60`) loops: resolve pending events via `bot.decide`, `bot.act`, `tick(s)` until `s.ending` or 40000 guard. Sequential in one process (no worker pool; `--json out`/`--load` to merge shards). Reports win/mixed/loss, ending mix, §7.4 criteria MET/MISS (`:179-202`, informational, not a failing check), choices-vs-world variance decomposition, ending coverage (E5).

## 7. Proposed split for the inventory (about 8 chunks, roughly 450-900 numlits each)

Numlits are the heuristic above; chunks 3/4 and 8 are the biggest.

| # | Chunk | Files | ~numlits |
|---|---|---|---|
| 1 | Capability and research data | `data/v2/{workTypes,calibration,tree,research,runDesign,suites,dataAssets,benchmarks,evals,paradigms,techs,features,naming,names,aftermath,actions}.ts`, `engine/v2/world/{calibration,hidden}.ts` | 760 |
| 2 | Models and compute engine | `engine/v2/models/*` (27 files, 8.3k lines), `engine/v2/compute/*` | 470 |
| 3 | Safety data | `data/v2/{agendas,techniques,edges,danger,findings,limits,oversight,safetyIdeas,framework,postures,traits,umodes}.ts` | 870 |
| 4 | Safety and security engine | `engine/v2/safety/*` (43 files, 11.7k lines; `traits.ts` ~173 alone), `engine/v2/security/*` | 720 |
| 5 | Market and products data + production | `data/v2/{serving,sectors,market,tools,deals,starts,teams}.ts`, `engine/v2/production/*` | 740 |
| 6 | World effects engine | `engine/v2/worldfx/*` (18 files, 6.6k lines; `macro.ts` 93, `sectors.ts` 71) | 460 |
| 7 | Finance engine | `engine/v2/finance/*` (22 files, 5.2k lines; `actions.ts` 114, `board.ts` 66) | 560 |
| 8 | Actors (engine + data) | `engine/v2/actors/*` (15 files), `data/actors.ts`, `data/world.ts`, `data/v2/{rivalModel,blocs,agents}.ts` | 1,230 (split 8a engine actors ~880 / 8b data side ~350) |
| 9 | Game core, departments, endings, events, bots | `engine/v2/{core,departments,endings,events,bots}/*` (about 1.9k+2.5k+1.0k+0.8k+1.2k lines) | 530 |
| 10 | Targets and checks (separate from constants) | `scripts/v2/{calib,calscan,calseeds,golden-timelines,lib,bots,starts,ws4,rivals,fixtures}.ts` + the domain check scripts, `design/RD-AUDIT/CAL1/CAL2/RDB08-CAL.md`, V2-SPEC §7, `golden/*.json` | about 1,076 `check()` sites |

Notes for chunk assignment: `data/v2/glossary.ts` (1215 digit hits, prose) and `data/glossary.ts` should be excluded from the constant inventory but flagged as a place where numbers repeat. `engine/v2/types.ts` and `core/registry.ts` (34 numlits, event registry) are small. The `_xxx/` dirs under `scripts/v2/` are per-task scratch (about 90 dirs); not examined, unsure of their contents. `design/notes/*.md` (F4.md etc.) hold fit derivations referenced from comments.
