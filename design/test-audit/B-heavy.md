# B-heavy: audit of the expensive multi-seed / simulation suites (scripts/v2)

Read-only audit, 2026-11-28, worktree AI27-testaudit (master 7ce0ad7e). Nothing was run.

**Cost basis.** There is no timing log (the only .simcache/last-run.json files are single-script quick runs). Costs are counted from the code:
game-days x per-day cost. design/bal/HANDOFF-PERF.md gives about 13.5 ms per bot game-day; I use ~12 ms per bot game-day and ~4 ms per
idle-player day. Treat every figure as +/-40%. "CPU-min" = CPU minutes in test:full (shards add up to the same CPU; wall is lower).
Run lengths to SC/ASI are assumed from design/bal/SCENARIOS.md (fast SC ~2027-28, central ~2030-32, slow later). Seed counts and day
horizons are exact (read from the loops).

**simcache facts that matter for sharing.** `cached(name, key, files, compute)` hashes the src tree + the caller's `files` + `name` + key.
Every script passes its own file and its own `name`, so two scripts never hit each other's entry, even for an identical game. Sharing
needs one helper module (like safety-emu.ts) that plays the game with all observers and is listed in `files`.

## 1. Per-script tables

### calib.ts (quick SMOKE, cal `--cal`, full sharded 6)
| Check group | # | Importance | Cost (full) | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| T1 median over 20 CAL_SEEDS x 3 presets (milestones A1..ASI vs golden days) | **0 real checks** | none | 3 presets x 20 seeds of stub RefBot: tl-fast and tl-central to ASI, tl-slow to SC: about 20 x (1.3k + 2.7k + 3.3k) = ~146k game-days = **~24 CPU-min**, the biggest item in test:full | `lib.calGolden()` returns `days: {}` for every preset, so `medianChecks` hits `want === undefined -> return` for every milestone and emits no check. It only prints a table. The 57 non-2027 seeds exist only to print. KNOWN entries 'T1 ... A1/A2' match no printed label; run.ts mode label 'T1 T1L T4' names the deleted T1L | **DELETE** the 19-seed loop (guard it: run only when golden days exist). Date calibration now lives in the bal workstream (design/bal/HANDOFF-CALIBRATION.md, calscan.ts) |
| seed-2027 reads: G path to Nov 2026 (tl-central), METR h50 doubling (tl-central), start research-speed M (x3 presets), R5 queue delay <= 3 d (x3) | 8 | medium (sourced anchors); R5 minor | one run per preset to ASI/SC (7.3k game-days, ~1.5 CPU-min) | every read is at day 1, <= day 490 or day 549 | **SLIM**: stop at day ~600. Saves ~1.3 |
| T1 integrated (3 presets, real finance, to ASI/SC) | 3 (R5 only) | minor | ~7.3k game-days, ~1.5 CPU-min | R5 already checked on the stub runs; rest is INFO | **SLIM** to 700 days or DELETE. Saves ~1.3 |
| T2 AI labour at SC (stub, tl-central seed 2027) | 1 | minor (bounds 0.05M-50M FTE cannot realistically fail) | re-plays a prefix of the T1 seed-2027 game, ~1.8k game-days = 0.4 | duplicate sim | **REWRITE** as a read in the T1 observer, or delete. Saves 0.4 |
| T3 China lead (stub) | 0 (INFO) | none | 540 days = 0.1 | binding T3 is in directorEndings.ts | **DELETE** |
| T4 rival gaps 3-9 months | 1 + INFO over 40 seeds | minor | ~2 s | duplicates directorEndings T4 (200 seeds) | KEEP the seed check, DELETE the 40-seed loop |
| `--fit-lines`, V3_SD, V3_ASI env | - | tooling | - | calibration tooling inside a test script | MOVE to calscan.ts |

~13 PASS lines in full, none from the medians. ~28 CPU-min -> ~1 after slimming. **Saves ~26 CPU-min.** The `cal` tier then has
nothing binding; drop it or keep it only for when golden days return.

### fixtures.ts (+ fixtures/, golden/) (quick, full)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| 900-day RefBot stub game; challenger and spinout 400-day integrated games; "plain JSON", "round-trips", "equals committed file" | ~15 | minor (equality diff is a regeneration reminder; other tests read the committed files) | 900 + 2x400 = 1.7k game-days = ~0.4 CPU-min | The equality check fails after almost any engine change (fixtures were regenerated in 4 of the last ~6 commits: "Fixtures regenerated", W8b-3, W11b...). Churn, not behaviour. golden/ref-trace.json is read by ref-trace.ts, not here | **SLIM**: keep plain-JSON + round-trip + schemaRev on one small state; drop the equality diff and the 3 sims from test:full; regenerate in `--write` (or have test:full regenerate instead of fail). Saves ~0.4 and the false failures |

### hygiene.ts (quick `--no-perf --smoke`, full `--no-perf` sharded 3, perf `--perf-only`)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| 1 registry table (id/owner/cadence/order) | 47 | minor change-detector | 0 | hand-copied registry; every new system edits it | **REWRITE** as invariants (unique order, valid cadence) |
| 2 newGame validity x 10 setups | ~85 | core-ish, cheap | 10 newGame | - | KEEP |
| 3 determinism (2 x 1500 idle days) | 2 | core | ~3k idle days ~0.2 | N=1500 more than needed | SLIM N to 600. Saves 0.1 |
| 3b(a) selector sweep on deep-frozen fixtures | 1 | medium | cheap | fixture-dependent | KEEP |
| 3b(b) lockstep read-purity: 3 seeds (2,4,11) x 730 days x 2 games, stateHash every day | 1 | medium | 4.4k bot-days + 2.2k hashes of a ~1 MB state = **~1.3 CPU-min** | seeds are an anecdote from an already-fixed bug; one yes/no paying for 3 games | **SLIM** to seed 4, 400 days (smoke uses 240). Saves ~0.9 |
| 3b(c) process history (fresh child process) | 2 | medium | node child start ~10 s | - | KEEP |
| 4 stream isolation: 6 logged 400-day idle games | 12 | medium | 2.4k idle days ~0.3 | 400 days | SLIM to 150. Saves 0.2 |
| 5 save round trip / schema refusal | 5 | core | 60 days | - | KEEP |
| 6 cadences, 730 days | 1 | medium | 730 idle days | `cadencesDue` is imported; math needs no ticks | REWRITE (loop + 90-day tick). Saves 0.1 |
| 7 causes | 3 | minor, cheap | 0 | - | KEEP |
| 8 performance (wall time) | 2 | minor | perf tier only | wall-time on shared machine | KEEP in perf only |

~3 CPU-min -> ~1.3 (**saves ~1.6**). OPEN.md says hygiene timed out at 590 s on a shared machine with no FAIL printed; by count it is
~3 CPU-min, so that was load, not a hang.

### safety.ts (+ safety-emu.ts) (quick SMOKE, full sharded 6, deep sharded 6)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| S1 agenda efficacy draws (1000 worlds) | 2 | medium (the distribution is the test) | ~1 s | - | KEEP |
| S2 retrain-against masks (40 seeds x 3) | 2 | medium | 120 newGame ~6 s | formula range check; 8 seeds enough | SLIM to 8. Saves ~5 s |
| S3 BB penalty + 4000 draws | 3 | medium | ~0 | - | KEEP |
| S4 RefBot P_mis at ASI in [0.40, 0.80]: 40 games seeds 500-539 to ASI | 1 (+ jsonOk) | **core** (headline alignment calibration) | 40 x ~1.4k = 56k game-days = **~11 CPU-min** | band 0.4 wide; 20 worlds gives se ~0.07 | **SLIM** to 20 seeds. Saves ~5.6 |
| S4 Safe-only recipe P_mis <= 0.25: 40 games to ASI | 1 | medium-core | 56k game-days = **~11 CPU-min** | one-sided bound | **SLIM** to 16 seeds. Saves ~6.5 |
| S4 "plain JSON through ASI" | 1 | minor | free | - | KEEP |
| S5 INFO row; S5 neuralese mechanism (reads base SAR states) | 1 | medium | free | - | KEEP |
| S5 Mixed bot sight limit above RefBot's: 20 games to SAR | 1 | medium | 20k game-days ~4 CPU-min | one inequality of two means | SLIM to 10. Saves ~2 |
| S5 deep: half staff, 20 games to SAR | 1 | medium | ~4 CPU-min (deep) | paired on seeds 500-519 | KEEP in deep |
| S5 deep: sabotage on/off at Trusted 100%, 2 x 80 games to SAR, 2 checks | 2 | medium, rare event | 160k game-days = **~32 CPU-min (deep only)** | the script's own comment: sabotage touches ~0.25 rigged tools and 0.6 sandbagged results a game; 20 pairs were noise, 40 left +/-0.7 se. Sampling a rare event to confirm a sign | **REWRITE as constructed case**: day-900 fixture, force the covert rate (kappa x 1000 as control.ts does), 300 days, both arms, assert direction. Saves ~32 (deep) |
| S6 FALSE finding rate (5 x 1500 fireFinding); B3; SAFMECH | 10 | medium | ~1 s | Monte-Carlo of a formula | KEEP |

21 checks in full (+3 deep). ~26 CPU-min in full (script est 1000 s) -> ~12. **Saves ~14 full, ~32 deep.**

### danger.ts (quick, full): KEEP
~30 constructed unit checks of the danger formula; only sim is the 8-seed start-rate table (8 newGame). ~5 s. Importance medium. run.ts est 60 s is high.

### sabotage.ts (quick, full): KEEP, SLIM loops
32 checks, constructed from day900.json, plus statistical loops: fireFinding x 3000 per arm, 400 steering trials, **20000 daily `rollFleetCovert`** compared with a summed formula (tolerance 4 sigma). Importance medium. Cost by structure ~10-25 s (not measured). SLIM the 20000-day loop to 3000 and the 3000-trial loops to 600 (still binding at 4 sigma). Saves ~10 s.

### footholds.ts (quick, full): KEEP, SLIM
34 constructed checks. One 20000-day `rollFleetCovert` loop for "footholds appear" (2000 days gives the same kinds) plus `suspicionTrial` loops. Importance medium. ~10-20 s. SLIM 20000 -> 2000. Saves ~5-10 s.

### control.ts (quick, full): KEEP, REWRITE two items
31 checks. `N = 4000` hash draws for "unnoticed escape P = C"; `N = 20000` loop of `toleranceNoiseOf(seed)` reproducing a logistic (closed form: compare the CDF at a few points); endings reachable from forced states (up to 40 seeds x 3 ticks, breaks at first hit, cheap). Importance medium-core. ~10-20 s. SLIM 20000 -> 2000, 4000 -> 1000. Saves ~5 s.

### safetyrates.ts (full only, sharded 4)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| ~28 banded rows F1/F2/F3/F5/F6 from 40 probe worlds (one post-training run each, no game) | ~28 | core-medium (each is a sourced band: METR, MacDiarmid, Schoen) | 40 x ~0.3 s = ~12 s | 40 worlds for medians of near-deterministic quantities | KEEP (20 worlds would do; saves 6 s) |
| 12 RefBot games to ASI (seeds 500-511) feeding F5 (EA/AF at 2026-12-31: needs ~day 600) and F1/F6 per-post-run rows | ~6 rows + INFO | medium | 12 x ~1.4k = 17k game-days = **~3.4 CPU-min** | **Same game as safety.ts S4 REF seeds 500-511** (same bot, setup, alignment, endings skipped); different cache names, so played twice | **SHARE**: record these observations inside safety-emu.ts `play()` for REF. Saves ~3.4 |

### finance.ts (quick SMOKE, full sharded 3; ~140 checks, 1870 lines)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| F1/F3/F6 market: RefBot seed 1 to end-2028 (1280 days) | 3 | medium | ~0.25 CPU-min | seed 1's end-2027 run in the 12-seed set is a prefix | SLIM: read seed 1's end-2027 record from the long run. Saves 0.2 |
| F4/F5 demand shocks (4 idle 16-quarter games) | 2 | medium (market response shape) | ~0.4 | - | KEEP |
| F2/F7/F8/F9/F11 on 12 RefBot seeds to end-2027 (912 days) | ~12 | core-medium (finance/market calibration to sourced numbers) | 11k game-days = ~2.2 CPU-min | 12 seeds for medians is reasonable (8 would do, saves 0.7) | KEEP |
| F8 bare variant (12 seeds to Q1 2027) and capex2x (12 seeds to end-2027): "distress in >= 80% of seeds" | 2 | medium | 18.6k game-days = **~3.7 CPU-min** | a near-deterministic bad-strategy outcome counted over 12 seeds | **SLIM** to 6 seeds each. Saves ~1.9 |
| F10 sites: 400 rushed gas sites ticked 5 years; blocked 9% +/- 3pp, delayed 27% +/- 5pp, median build 7 q | 2 | minor-medium (reads data constants through a 400-sample Monte-Carlo) | 1825 days with 400 sites ~0.7 | `oppositionOdds` is imported | **REWRITE as constructed**: assert `oppositionOdds` = 0.09 / 0.27 and run 3 sites through the stage machine. Saves ~0.7 |
| F11 revenue consumption (`revenueRun === 12`; 2027 revenue band) | 2 | minor (duplicate) | 120 ticks | same start value and revenue bands are checked in worldfx.ts | **DELETE one copy** (keep the 12-seed medians) |
| FIN1..FIN6a (~100 checks): constructed from `fixtures/day400.json` + a few mid-length sims (200/300/400/550 days, a site wait up to 2190 days) | ~100 | core-medium (finance v3 mechanics) | ~0.5-1 CPU-min | depends on day400.json (stale on every schema change); FIN4r waits up to 2190 days for one yes/no | KEEP; replace the 2190-day wait with a `siteSchedule` call |
| FIN3a RefBot end-2027 board confidence | 1 (INFO unless < 40) | minor | free | swings +/-9 per its own comment | KEEP |

~6-8 CPU-min (script est 250 s). **Saves ~3.**

### worldfx.ts (+ worldfx-refplay.ts) (quick SMOKE, full sharded 4)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| Classic RefBot seed 2027 to 2028-04-01 (1005 days), 9 marks: F11 revenue, W4/A2a/A2b/A2c anchors (RPS, BTOS, R22) | ~28 | core (outside-world calibration to measured data) | ~0.2 CPU-min | - | KEEP |
| Date checks: median over 20 seeds (19 extra RefBot games to 2028-04-01): HireRate_SOFT <= 10% Jul 2027, GOV accept >= 0.85 Dec 2027 binding; 2 INFO | 2 binding | medium | 19 x 1005 = 19k game-days = **~3.8 CPU-min** | 20 seeds for two median-in-window checks; the 2 INFO checks need the same sims; 8 seeds still gives median se ~30 d | **SLIM** to 8 seeds (2027 + 1..7), or move the 20-seed version to `cal`. Saves ~2.3 |
| W4 game: tl-central seed 2027 to 2026-11-02 | 3 | medium | 490 days = 0.1 | **identical game to the classic run**, which already records `at['2026-11-01']` and `at['2026-07-01']`; cached under another key | **DELETE** the second game; read `c.at`. Saves 0.1 |
| tl-fast game to 2026-11-02 | 0 (INFO) | none | 0.1 | INFO only (and a prefill shard) | **DELETE** |
| Leverage / actions (30 + 365 + 60 ticks, day900 fixture) | 6 | medium | ~450 idle days | - | KEEP |
| worldfx-refplay.ts | - | - | - | its header says the probe "is no longer used"; only `refGame()` (3 lines) is imported | **DELETE** the stub system, keep `refGame` |

~4.5 CPU-min. **Saves ~2.5.**

### directorEndings.ts (quick SMOKE, full unsharded)
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| E1 catalog shape ("exactly the N kept events") | 3 | minor change-detector | 0 | edit on every event change | REWRITE as invariants |
| E2 fuzz: 1000 seeds, deserialise a ~1 MB fixture, deactivate rival subsets, text names no inactive lab | 1 | medium | 1000 deserialises + 1.9k ticks = ~1.5 CPU-min | masks are `seed % (2^k - 1)`: with 4-5 rivals only ~15-31 distinct subsets x 3 fixtures; 1000 seeds repeat them | **SLIM** to 100 seeds (smoke uses 60). Saves ~1.3 |
| E3 constructed | 3 | medium | 0 | - | KEEP |
| E4 pacing under crisis spam: 12 seeds x 300 days | 1 | medium | 3.6k idle days ~0.2 | - | SLIM to 4 seeds. Saves 0.1 |
| E5 every EndingId reachable (forced states, up to 300 seeds) | 1 | medium | ~0 | - | KEEP |
| T3 China lead: 8 seeds x 540 days RefBot; mean 90-270 d, >= 95% days behind, theft never widens | 4 | medium | 4.3k bot-days ~0.9 | one-sided bounds | **SLIM** to 3 seeds. Saves ~0.5 |
| T4 start gaps, 200 newGames | 2 | minor | ~10 s | duplicated in calib | SLIM to 40. Saves 8 s |
| C1 commitments / framework gate (fixture) | ~10 | medium | 0 | - | KEEP |

~3 CPU-min. **Saves ~2.**

### idle.ts (quick `--seeds 1`, full default 2 seeds), not cached
| Group | # | Importance | Cost | Waste / staleness | Verdict |
|---|---|---|---|---|---|
| "No stock idle >= 30 days without an alert": 2 starts x 4 bots (ref, mixed, safe, race) x 2 seeds x 1100 days | 1 | medium (R5 rule) | 16 games x 1100 = 17.6k bot-days + `idleStocks` per day = **~4 CPU-min**, no cache | **can pass vacuously** (`seen` is printed, never required > 0); the property is a function of (state -> idleStocks, watchItems) | **REWRITE as constructed**: for each of the 3 stock ids, put the state in that idle condition, call `watchItems`/`navBadges`. Saves ~4. If kept as sim: ref + safe, 1 seed, and require seen > 0 (saves ~3) |
| Idle training compute stays idle | 1 | minor | same games | `spareChecked` can be 0 | same, or one constructed state |
| IDLE_ALERT mapping complete | 1 | minor | 0 | - | KEEP |

## 2. Biggest savings in test:full (CPU-minutes, estimated)

| # | Item | Verdict | Saves |
|---|---|---|---|
| 1 | calib: 19-seed x 3-preset T1 median (emits no checks: golden days empty) | DELETE / guard | **~22-24** |
| 2 | safety S4: 40 REF + 40 SAFE games to ASI -> 20 + 16 | SLIM seeds | ~12 |
| 3 | idle.ts: 16 uncached bot games -> constructed case | REWRITE | ~4 |
| 4 | safetyrates 12 games = safety S4 seeds 500-511 | share one game | ~3.4 |
| 5 | calib: seed-2027 and integrated runs to ASI -> day 600/700; T2/T3 | SLIM | ~2.6 |
| 6 | worldfx: 19 timing seeds -> 7 | SLIM | ~2.3 |
| 7 | safety S5 Mixed 20 -> 10 games to SAR | SLIM | ~2 |
| 8 | finance: bare + capex2x 12 -> 6 seeds each | SLIM | ~1.9 |
| 9 | directorEndings: E2 1000 -> 100, T3 8 -> 3, E4, T4 | SLIM | ~2 |
| 10 | hygiene: lockstep read-purity 3 x 730 -> 1 x 400, sec 3/4/6 horizons | SLIM | ~1.6 |
| 11 | finance F10 400-site Monte-Carlo | REWRITE constructed | ~0.7 |
| 12 | worldfx duplicate tl-central game + INFO tl-fast | DELETE | ~0.2 |
| 13 | fixtures: no 3 sims, no equality failure | SLIM | ~0.4 |
| 14 | sabotage/footholds/control loop sizes | SLIM | ~0.5 |
|    | **Total in full** | | **~55 CPU-min** of an estimated ~80-90 in these 13 scripts |
| deep | safety S5 sabotage on/off, 160 games to SAR | REWRITE constructed | ~32 (deep only) |

The calib deletion also shortens wall time most: its tl-slow shard is the longest single job.

## 3. Cross-script duplication

| Same game / check | Where | Action |
|---|---|---|
| RefBot, tl-central, medium, tutorial false, seeds 500-511 to ASI | safety.ts S4 (500-539) and safetyrates.ts (500-511); separate cache names and `files`, played twice | one `play()` with both observers in safety-emu.ts |
| RefBot, tl-central, seed 2027 | calib integrated (to ASI), worldfx classic (to 2028-04) | calib integrated redundant after slimming |
| RefBot, tl-central, seeds 1-19 | calib stub T1 (to ASI), worldfx timing (to 2028-04), finance runBot (seeds 1-12 to end-2027, default alignment/tutorial, refPlay + autopilot), directorEndings T3 (seeds 1-8, 540 days) | a shared reference-game record for finance + worldfx (quarter series, revenue, marks) would save ~12 games (~2.4 CPU-min more) but the setups must be unified (finance: sampled alignment, tutorial on) |
| R5 build queue <= 3 d | calib stub x3 presets, calib integrated x3 | keep one |
| T4 rival gaps | calib (40 seeds INFO) and directorEndings (200 seeds) | delete calib's loop |
| T3 China lead | calib (INFO, stub) and directorEndings (binding) | delete calib's |
| Revenue bands (2026 $45-56B +/-20%, 2027 ~$140B +/-30%, revenueRun 12 at start) | finance F7/F11 (12-seed medians), worldfx F11 (seed 2027 + median of 20) | keep one |
| day400/day900 fixtures | read by hygiene, safety, sabotage, footholds, control, finance FIN*, directorEndings, worldfx; regenerated in most schema-changing commits | one stale fixture breaks ~8 scripts; consider generating them at the start of test:full instead of committing and diffing |

## 4. Staleness and doubt (collected)

- calib.ts: golden days empty -> every T1 milestone check is a no-op; stale KNOWN labels; 'T1 T1L T4' label; T2 bounds cannot fail.
- fixtures.ts: equality check fails on any engine-output change (same family as OPEN.md "re-derive ~100 quick-test expectations").
- hygiene.ts: registry table duplicates the registry source.
- idle.ts: can pass with zero samples.
- worldfx-refplay.ts: header describes a probe system that is no longer used.
- finance.ts F10: tests data constants by Monte-Carlo.
- No check in this slice measures wall time in full (hygiene sec 8 is perf-only). Nothing is commented out. OPEN.md lists no known failure for these 13 scripts (its broken-test items are uitest.mjs plus the hygiene timeout).
- Not measured: all costs above. Verify with `last-run.json` from one full run before acting on the CPU-minute figures (the order of the ranking is robust; the absolute numbers are not).

## 5. Suggested order

1. calib.ts: skip the 20-seed T1 loop when `calGolden` has no days; cut remaining runs to day 600-700 (-26).
2. safety.ts: 20 REF + 16 SAFE + 10 MIXED seeds; replace the 160-game deep sabotage run with a constructed pair (-14 full, -32 deep).
3. idle.ts to a constructed case; safetyrates shares safety's S4 games.
4. Seed trims: worldfx timing 19 -> 7, finance variants 12 -> 6, directorEndings E2/T3/T4/E4, hygiene readpure.
5. fixtures.ts: stop failing on equality.
