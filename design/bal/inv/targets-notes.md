# Target registry notes (balance/targets.ts)

Record of what exists on branch `bal` today. No judgement. IDs: `T1.<preset>.<ms>`, `T1L.<preset>.<ms>`, `GOLD.<preset>.<ms>` (v1 integrator vs GOLDEN_EXPECTED), `RS.<preset>.startM`, `F*` / `W*` / `A2*` (finance and world), `S*` / `F2` / `F5` / `F6` / `MO` / `DANGER` / `EV9` (safety), `T3` / `T4` / `R5` / `R8` / `R9` (China and rivals), `START.*`, `BOT.*`.

## Questions

| id | question | evidence |
|---|---|---|
| Q-T-1 | Which is the authors2026 target: GOLDEN_EXPECTED (SC 2029.68, SAR 2029.89, SIAR 2031.48, ASI 2033.73) or the golden JSON days T1 checks against (1495 / 1573 / 2151 / 2975 = 2029.59 / 2029.80 / 2031.39 / 2033.64)? T1 registers the JSON days (as implemented); GOLD.* registers the sourced years. | `calib.ts` medianChecks reads `calGolden()` (JSON days); `golden-timelines.ts:25` KNOWN "authors2026 SC ... a constant ≈0.09 y early" |
| Q-T-2 | `T1.*` (RefBot vs golden days) and `GOLD.*` (integrator vs GOLDEN_EXPECTED) are two measurements of one set of dates. Keep both targets, or one target with two checks? | `golden-timelines.ts:82-100` and `calib.ts` medianChecks |
| Q-T-3 | `T1.slow.A2` is day 4272 (golden JSON, 2037.19), later than the restated slow SC (3289, 2034.5). A1/A2 are `info` (WARN via KNOWN); is a slow A2 after SC meaningful? | `golden/timelines.json` slow days; `lib.ts` calGolden restates only SC |
| Q-T-4 | Several coded bands differ from the stated target: F6 stated 70-75%, coded mean 0.70-0.77 and min ≥ 0.65; F7 revenue stated $45B ±20% (36-54), coded 36-67 (to include $53-56B); F9 FC1 stated ≈ $0.5-0.65T / $2.5-3T, coded 450-750B / 2200-3300B; F4 stated t+4 and peak t+6..t+8, coded first rise t+4..t+6, peak t+6..t+9. Which does the registry call the target? Registered: value as stated, tolerance as coded. | `finance.ts` lines 159, 193, 225, 262; V2-SPEC §7.2 |
| Q-T-5 | `S5.refBot.belowL` (≥ 50% of worlds, CAL2 "fail") is INFO-only in code since the designer's 2026-11-23 decision (option c: "a design reading of AI 2027's text, not a sourced number, swings ±6 pp"). Registered `info`, no check label. | `safety.ts:191-194` |
| Q-T-6 | `W.remote25` and `W.unemployment12m` (CAL2 "fail (new): never, 0/20") are INFO-only in code (CAL3-I: AI 2027 scenario projections, not measurements). Registered `info`, no check label. | `worldfx.ts:200-208` |
| Q-T-7 | `T2.labour.SCband`: V2-SPEC T2 states ≈ 200k copies at ~30x (±30%); the check is one order of magnitude either side and its comment calls it "a sanity check ..., not a fit target". Registered with the coded band. | `calib.ts:517-528`, V2-SPEC §7.1 |
| Q-T-8 | Bot criteria (`BOT.*`) are printed MET/MISS lines, not `check()` calls; `bots.ts` is not in the `run.ts` job table and its comment says "informational until M2 integration". Registered without check labels. Keep as targets? | `bots.ts:~176-202`, B0-SCOUT §5 |
| Q-T-9 | `START.difficultyLabel` is a hand-set label (StartDef.difficulty) justified by a comment; no check compares it with bot win rates. Registered as an invariant with no label. | `src/data/v2/starts.ts:20-24`; `scripts/v2/starts.ts:113` prints the label only |
| Q-T-10 | `safetyrates.ts` has 18 more banded rows not in CAL2 (listed under Not registered). Register them all? | `safetyrates.ts:262-345` |
| Q-T-11 | `R5.leader.day0Rates` and `R8.follower.staleness` (CAL2 "fail ×2", target "—") compare the code with itself (PRE_RATE0, its own recipe growth), not with a source number. Target or structural check? | `rivals.ts:167-219`; CAL2 row "R5 leader day-0 rates / R8" |
| Q-T-12 | `F8.refNoDistress` ("stays out of distress through 2026 in ≥ 75% of seeds") has no figure in V2-SPEC §7.2; the 75% comes from the check alone. | `finance.ts:238` |
| Q-T-13 | T3 has two readings: `ws4.ts` binds (8 seeds, real RefBot play); `calib.ts` prints an INFO value on the stub compute path (registered as `T3.china.stubLead`, role `info`). One target or two? | `calib.ts:~548-551` comment "the binding T3 is the integrated one in scripts/v2/ws4.ts" |
| Q-T-14 | The `T-tree.durations` question (Q-B2-2, one target for all projects) is unchanged; the entry is kept as written. | `balance/questions.md` |
| Q-T-15 | `smokeCheck()` rows (most F-series, T3 mean, S4, S5 Mixed) fail like `check()` in a full run but print SMOKE under `--smoke`; the registry does not record which mode binds. | `lib.ts:115-119` |
| Q-T-16 | `EV9.releaseSuites` reads 34 / 33 d against about 14 d in CAL2 ("RF-S6 revert, known; CAL-S2 kept it as a real timing miss for the designer"), yet `evals.ts` has no KNOWN entry for it. | CAL2.md safety table; `evals.ts:279` |

## Not registered

- **All 52 CAL2 table rows are registered** (T1 x4 presets, T1L x4, start M, G path, METR, T4, fixture canary, 19 finance and world rows, 14 safety rows, 6 China rows). The CAL2 WARN rows (A1 / A2) are registered as `info` T1 targets.
- `safetyrates.ts` banded rows outside CAL2 (Q-T-10), 18 rows: F1 hack rate x3 (HCAST-like 0.3-2%, ML research 23-39%, SWE scaffolds 25-100%); F2 sabotage control (< 1%), AF reasoning after hacking (30-70%), AF reasoning control (≤ 12%), inoculation PERSONA cut (75-120%); F5 eval awareness at start (10-30%), AF gap after an oversight-conditional run (43-95%), EA rise per OOM (0.06-0.19), anti-scheming EA multiplier (x1.9-6.1); E18 AF gate at V0 (0.95-1); F6 x5 further rows (safety training alone, AF, SAND, frontier EA, RefBot per run); F3 student transfer (0-15%). Reason: not in the CAL2 table or in the sources named for this task.
- Mechanism and structural checks near targets: FIN6a aggressive pitch end to end (CAL1 row, a mechanism test); F11 "run-rate follows WS5 revenue (30-day smoothing)"; worldfx A2a "hours saved per hour of use rise with agency" and "firm adoption below worker use"; S5 mechanism checks (neuralese, half staff, sabotage on / off); R10 "one lab policy a day"; ws4 C1 x2 (CAL2 class (c), outdated test rig); V2-SPEC P1 production identity; §7.5 engine hygiene (determinism, save size, performance).
- Printed distributions with no band: T4 over 40 and 200 seeds, T3 p10 / p90 and min / max, T1 spreads, GOLDEN_SAMPLED p10 and p90 (only p50 is checked; both are carried as `lo` / `hi` of `GOLD.sampled.SC`), the "V2.8 stacks" lines and the G slope 1.1-1.3 G/yr (carried as `lo` / `hi` of `GPATH.ai2027.2026`, not checked).
- INFO lines: W4 on authors2026, A2c intensity, non-China frontier revenue.

## Docs-only targets

- `P2.knotTable.ai2027` (V2-SPEC §7.1 P2: knot table within 2% of R13 §1.5): no check found.
- `P3.elasticities` (V2-SPEC §7.1 P3: elasticities within ±0.02 of R13 §1.6): no check found.
- Stated in the docs and partly implemented, so registered in the implemented form: T2 (±30% vs one order of magnitude, Q-T-7); §7.4 Passive "milestone dates per §7.1" (the T1 targets); §7.1 sampled p10 / p90 (carried in `GOLD.sampled.SC`, unchecked).
- CAL1.md and RDB08-CAL.md add no targets beyond CAL2. RDB08 states the fit acceptance for calscan ("worst |median| / tolerance ≤ 1", 20 seeds); this is the T1 check itself.
- Not recorded as targets (procedure, not outcomes): V2-SPEC §7.4 balance-knob order and "never touch calShift"; §7.1 "adjust κ_post 0.6-0.8 globally, never per preset".
- Dynamic check labels (built in code from a preset, milestone, band or seed count) were verified by their template, not by literal grep: `T1 / T1L <preset> <ms>`, `<preset> <ms>` (golden), the R5 build-queue labels, the `START` winnable labels, the fixture canary labels, `RS.*` labels, the safetyrates rows (`<row> ∈ [lo, hi]`), `MO.anchor.sabotage` (COVERT_ANCHOR_X = 0.44), `T3 China mean lead ... 8 seeds` (seed count 8 in a full run, 2 under `--smoke`), `W3 <econ>`.

## Fit links not made

| target | param description |
|---|---|
| `T1.authors2026.SC` | `cap.V3_CAL.authors2026.gSC`: registered `sourced` (AI Futures Model run, workTypes.ts:304), not fitted. |
| `T1.slow.SC` | `cap.V3_CAL.slow.gSC`: a stated stand-in (38.3), not fitted. |
| `T1.authors2026.SAR` / `SIAR` / `ASI` | RDB08-CAL.md and CAL2-T refit authors2026 `dBM` and `sdSC` to these, but those params are registered `sourced`. `cap.ASI_EXTRA_GAPS` ("[fit, global]"; RDB08 says fitted on authors2026's SIAR to ASI spacing) has `targets: []` in its param entry. |
| `T1.ai2027.*` | `cap.V3_CAL.ai2027.sdSC` is registered `derived` (SD_AT_SC), though calscan.ts:5 lists sd_SC among the fitted values. |
| `T1.*.A1`, `A2` | The G_SC and Δ_bm fits do not bind A1 / A2 (informational). |
| `GPATH.ai2027.2026` | No param is stated as fitted to the G path (the A6b overtraining shift is a decision, `cap.fOver.curvature`). |
| `T1L.*` | `LEADER_CAL` was fitted to T1L and is deleted (calib.ts:~279, RF-R1); no live param. |
| `F7.*`, `F9.*`, `W4.*`, `W.hireRate10`, `A2a.*` | CAL2-X fitted `bassFit` 0.33, `firmK` 19 and `hireSlope` 1.5 → 1.2 to the 2025-26 adoption rows (CAL2.md); sectors.ts says `useW`, `useH`, `fMid`, `fSpread` are "[fit to R22 ...]". Their param entries in `balance/params/market.ts` have `targets: []`. The code comments name source figures (BTOS, RPS), not a check, so no link was made. |
| `T3.*`, `T4.*`, `R5.*`, `R8.*`, `R9.*` | No param is stated as fitted to these (CHINA_CAL was deleted in CP3k). |

Links made: `T1.ai2027.SC` → `cap.V3_CAL.ai2027.gSC`; `T1.ai2027.SAR` / `SIAR` / `ASI` → `cap.V3_CAL.ai2027.dBM`; `T1.fast.SC` → `cap.V3_CAL.fast.gSC`; `T1.fast.SAR` / `SIAR` / `ASI` → `cap.V3_CAL.fast.dBM`; `STACK.pretrainRate.ai2027` → `cap.LINE_FIT.mu`; `T-tree.durations` → `cap.FITTED_EFFORT_TM.P05`. The param side of `T1.ai2027.SC` and `T-tree.durations` already pointed at these targets; the `dBM`, `fast.gSC` and `LINE_FIT.mu` entries have `fit.targets: []` and should list the targets above.
