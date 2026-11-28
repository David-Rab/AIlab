# B5 consolidated questions (for the lead to rule on)

Merged from the Questions sections of `design/bal/inv/*-notes.md` (98 rows) and `balance/questions.md` (2 rows; Q-B2-1 is already answered by the lead: `derived`). Every question id appears in one item (an "also" marks a cross-reference).
Entry counts come from `balance/params/*.ts`: 1822 entries (604 designer, 491 untagged, 389 sourced, 176 unclear, 75 derived, 65 fitted, 22 stand-in). They grep the `evidence` strings, so they are approximate (a tag quoted in other words is missed).

## A. Tag-interpretation rulings

**A1. File-header "Source:" line or header statement: does it cover the values below it?** [Q-actors-data-1, -2, -5, -7; Q-capability-5; Q-safety-data-6, -7]
- Files: `src/data/actors.ts:1` ("Source: research/07-actors.md (weights = "Realistic" draw probabilities)"), `benchmarks.ts:1-2`, `paradigms.ts:1`, `blocs.ts:1`, `postures.ts:1-2`, `agendas.ts:2`, `techniques.ts:3-4`, and the `desc` strings of `world.ts` BASELINES (UI text, not comments).
- Affects: 136 `unclear` entries (actors.ts: gov 40, public 30, China 36, lab archetypes 30); 5 `untagged` (benchmarks 4, paradigms 1); `BLOCS.cloutNov26` (untagged); 9 postures entries (7 sourced, 2 designer) and 7 agendas/techniques `designer` entries that already rest on a header reading.
- Evidence, `research/07-actors.md` checked: it gives the trait values, not only the weights.
  - Gov, lines 70-74, "Param tweaks": Dealmaker "accel 1.5, transactional 1.6, reg 0.4, security 0.8, hawk 0.8, nat_threshold 85, lag 20" = `actors.ts:9` exactly. Hawk, Regulator, Populist, Absentee also match. Fields a row does not list (e.g. Hawk `transactional` 1) are baseline 1.
  - Public, lines 159-163: Anxious "shock 1.0, decay half-life 120 d, jobs 1.2, xrisk 1.0, benefit 0.7, mobilization 0.8" = code exactly. Backlash lists only jobs 1.6 and mobilization 1.5; the code also sets shock 1.1, halfLife 150, xrisk 0.9, benefit 0.6 (not in 07).
  - Labs, lines 219-223: Safety "safety 80, openness 15, lobby +60" matches. Big Tech says "compute x1.5", code `computeMult` 1.3. Open-Weights lobby -40 and Upstart safety 55 / openness 20 / lobby 0 are not in 07.
  - China, lines 277-281: 07 has 5 presets and Nationalizer "centralize x1.5, theft 1.5"; the code has 6 (adds Diffuser) and 1.6 / 1.6, which is `research/10-china.md:54` ("centralize 1.6, theft 1.6"). The `actors.ts:31` comment cites research/10 for the weights only.
  - `cloutNov26`: `research/08-policy-ecosystem.md:13` ("what changed ... between mid-2025 and Nov 2026 (this is why the blocs have two starting columns)") documents why the column exists; whether section 1.16 (line 664) gives the numbers is unchecked.
- Options: (a) the header covers every value: `sourced` (136 entries, but about a quarter of the fields are not in 07/10); (b) verify field by field against the quoted rows: `sourced` where equal, `designer` where the code adds or changes a number (a one-off script, no judgement needed; recommended); (c) a header never counts: `untagged` for all 136.
- Wave 1 already counts header statements that name fields ("every numeric parameter is a [D] value"); (b) applies the same test to "Source:" lines.

**A2. `[D from P]`, `[D from R22]`, `[Design]`, `[R15 Design]`, `[D]` plus a research pointer: designer or sourced?** [Q-market-1; Q-models-1]
- Counts: 36 entries carry `[D from ..]`, `[Design]` or `[R15 Design]`: 29 designer, 4 sourced (`fin.equity.antiDilution`, `mkt.PARTNER_TERMS.asic.*`, `mkt.DEBT_TERMS.revolver.spreadBp`), 1 unclear, 1 untagged, 1 derived, so wave 1 is applied unevenly. A further 60 `designer` entries have `[D]` plus a research pointer in the evidence.
- Evidence for the "anchored" reading: `research/20-model-v3-calibration.md:582-583` ("Game-ready E3 [G]. Each work type has a verifiability v_w ...") is a design proposal, after "No primary source estimates a single verifiability elasticity" (line 580). A pointer to a research note can therefore point at a designer's proposal.
- Options: (a) always `designer`, pointer in `notes` (wave 1; fix the 6 outliers); (b) new `kind: 'anchored'` for a designer value chosen from a named source (schema change); (c) `sourced` when the value is the cited number, `designer` when it is a mapping or choice.

**A3. Two tags on one value (`[D]` plus fit or plus a source), now `unclear`.** [Q-capability-4, -7; Q-finance-1, -3, -4, -6; Q-worldfx-1, -2]
- Affects the 40 `unclear` entries outside actors.ts (29 contain `[D`, 13 contain "fit").
- Options: (a) the tag nearest the number wins; (b) `[D, fit]` is `fitted` only if a script or target is named, else `designer`; `[D, sourced]` follows A2; (c) keep `unclear` and let the designer rule the 40 one by one.

**A4. `[fit]`, `[C]`, "calibrated" with no script or target named.** [Q-safety-data-1, -5; Q-actors-engine-5; Q-safety-engine-7]
- Affects 65 `fitted` entries: 51 have script `unnamed`, 59 have `targets: []`. `[C]` (danger.ts, 13 entries) was read as `fitted` in wave 1. T3 has no target id in `targets.ts`.
- Options: (a) accept `fitted/unnamed`; B6 links targets later; (b) `fitted` needs a named script, otherwise `designer` plus a note (about 51 entries move); (c) add the missing target ids first (T3, V1 design table, E5 reference run), then link.

**A5. Tagged `[D]` (or untagged) but described as tuned to an outcome.** [Q-worldfx-6; Q-safety-engine-9; Q-safety-data-3; Q-finance-11; Q-core-4; Q-capability-6]
- Affects about 20 `designer` entries whose evidence says tuned, calibrated, solved or "integrated RefBot play" (heuristic count), plus `SERIOUS_CAP` (untagged) and MMMU/EmbodiedBench (unclear).
- Options: (a) follow the tag (`designer`; wave 1 "follow the comment"); (b) the described procedure wins: `fitted`; (c) `designer` plus a flag "tuned on <target>" so a fit can be linked later.

**A6. Tags missing from the brief's table: `[S]`, `[R]`, `[A]`, `[proxy]`, `[P-analogue]`, `[spec]`.** [Q-safety-engine-1; Q-market-4]
- Counts: `[S]` 10 entries (8 sourced, 2 unclear = `sfe.CONTROL_SETTINGS.safety0/safety`); `[R]` 2 plus 4 Hubinger/Schoen citations (all sourced); `[A]` 1 (`sfe.OC_DETECT_TRAIN`, sourced, grade A); `[proxy]` 7 (4 designer `[D: proxy ..]`, 1 stand-in, 2 sourced); `[P-analogue]` 5 (all sourced); `[spec]` 2 (untagged: `mkt.REGION_SCALE.ROW.*`).
- Agents' reading: a tag that cites a paper is `sourced`; `[proxy, low]` plus "stand-in" is `stand-in`; `[A]` is the grade letter; `[spec]` is not a tag.
- Options: (a) confirm and add them to the brief; (b) `[proxy]` and `[P-analogue]` are `stand-in` (an analogy, not the number itself; moves up to 7 sourced); (c) `[spec]` = pointer to V2-SPEC = `untagged` (see A8).

**A7. `derived` versus tags: computed in code, literal copies of computed values, `[D]`/`[fit]` on a derived value.** [Q-models-3; Q-safety-data-2, -9; Q-core-6; Q-capability-8; Q-actors-data-4]
- Counts: 75 `derived`; 22 of them also carry `[fit]`, `[D]`, `[C]` or are literal copies, not computed (`REF_BASE_DAYS` 121, `GATE_OOM`, `V3_CAL.sampled.*`); 13 `derived` and 11 `stand-in` entries carry `[D]`.
- Options: (a) `derived` only if the code computes it; a literal copy takes the kind of the original, with a `linked` note; (b) `derived` also for literals whose comment states the derivation (today); (c) the tag wins (`RL_C0` `fitted`, STEER/SUCCSTEER kappa `designer`) and `derived` only when untagged. This also settles `[D]` + stand-in / derived.

**A8. Which pointer counts as `sourced`: a prose pointer for the mechanism, a design-spec section, an analogue with low confidence.** [Q-safety-engine-2, -6; Q-actors-engine-6; Q-models-6]
- Affects `COT_S4`, `S6_NARROW_HARMFUL`, `S7_RL`, `K_S7`, `AF_GATE_*`, `HEAL_K`, `KYC_REFUSE` (about 9 entries) and entries that cite only V2-SPEC / STRUCTURE / MODEL-V3 / design sections (14 `untagged` name such a doc; up to 72 `untagged` mention a design pointer; e.g. `RELEASE_LAG`, `LATENT_P`, `RUNG_TRUST`).
- Options: (a) `sourced` only if the cited text states this number (agents' rule); (b) design-spec pointers stay `untagged` (agents' rule), written into the brief; (c) a spec section that records a designer decision counts as `designer`.

**A9. Group comment coverage: one comment above a table, record or one-line `build(...)` call.** [Q-actors-data-3; Q-actors-engine-2; Q-finance-5; Q-safety-data-4]
- Affects 31 `world.ts` preset entries (26 sourced, 2 fitted, 3 untagged; "Audit #1/#8/#9/#22" sits above a one-line call), `GOV_SCORE` (5 boards), `STORY.ipoBump` and `carry`, `edges.ts` E06 and E11.
- Options: (a) a comment covers every field of the construct directly below it unless a field is named otherwise; (b) only named fields, the rest `unclear`; (c) per-case ruling.

**A10. Layer: `world` or `policy`, and a possible `belief` layer.** [Q-actors-data-6; Q-actors-engine-1; Q-capability-3; Q-safety-data-8; Q-safety-engine-8; Q-worldfx-7]
- Affects 18 postures entries (`ARCHETYPE_POSTURES`, `CHINA_POSTURE_BASE`), 13 belief-only constants (`SD_MAX`, `UNKNOWN_RANGE`, `VAL_W`, `EA_PROJ`, ...), 11 control/`ACCEPT` entries, 12 rival-timing and player-default entries (`BASE_MONTHS` world, `RELEASE_LAG` policy, `DEFAULT_CAP_SHARES` policy), `PROJECT_MAX_TEAMS` vs `RE_MAX_PER_PROJECT`. 250 entries are `policy` today.
- Options: (a) `policy` only when an actor picks the number (bot plans, rival/China/gov decision thresholds, player defaults), everything else `world` (agents' working rule); (b) add `belief` for readout-only constants (schema change, 13 entries); (c) adoption behaviour (ACCEPT, control penetration) and rival cadence are `policy`.

## B. Code and comment disagree (possible game bugs)

- **B1.** `PROMISE_RESULT` (`src/engine/v2/finance/promises.ts:32` comment vs `:35` code): comment "met +30 x weight credibility, +10 x weight board; missed ... -30 / -15 x weight"; code `metBoard: 30, missBoard: -30` (credibility 30 / -30 agrees). `mood.ts:34-35` reads these. [Q-finance-2]
- **B2.** `SAFE_AUTOPILOT` (`bots/safe.ts:35-38`): comment "plans 75% of" the build-out and "stops new capex below 5 quarters of runway [D, M4]"; code `mult: 0.5`, `guardQ: 6` (`bridgeFloorQ: 5` may be the "5"). [Q-core-2]
- **B3.** `MIXED_RE_TEAMS` (`bots/mixed.ts:3` vs `:18`): header "three safety research-engineering teams"; code 5. [Q-core-1]
- **B4.** `mixedLines` (`mixed.ts:3`, `:19` comment vs `:22-25`): "a second on AG08, AG18, AG02" only; code gives `teams: 2` to all six lines (also AG09, AG07, the lottery line). [Q-core-1]
- **B5.** `RACE_PLAY.base.days` (`bots/race.ts:3` vs `:14`): header "x3 bases"; code `days: 150` against RefBot 121 (`ref.ts:63-66`). The header may mean three times as many bases, not the day count. [Q-core-1]
- **B6.** `AutopilotOpts.guard` doc (`finance/plan.ts:34`): "Stop new capex when runway < 4 quarters"; `GUARD_Q` is 4.5 (`:70`, changed in FIN1; chips `GUARD_CHIPS_Q` 3.5). Stale comment, or a second 4 elsewhere? [Q-finance-9]
- **B7.** `ROBOT.sezRampYears` (`worldfx/robots.ts:9` and `:26-27`): source text "rising to ~1M/month within about a year [A27]" and `sezRampPerYear` 10.8e6 ("-> 1M/month after a year") against `sezRampYears: 1.5`. The "~1.5 years" at `:10` is the T_dbl halving after W17, not the ramp. [Q-worldfx-3]
- **B8.** `edges.ts:37-38, 48-49`: comments above E06 and E11 are labelled "E10" (stale label); values read as E06 0.75, E11 0.2. Comment only. [Q-safety-data-4 also A9]
- **B9.** `researchView.milestoneViews` (`models/researchView.ts:506-508`) hard-codes coverage 0.1 / 0.5 / 0.5 for milestones 0-2; the real predicate is `departments/workfit.ts milestonesOf` (`MILESTONE_COVER` for the superhuman coder, 0.9 per `models/capability.ts:420`). Mirror or second definition: unverified. [Q-models-5]

## C. Duplicated values (no shared constant)

- **C1.** kW per H100e step 0.944: `forecast.ts:10` `KW_STEP`, `sites.ts:277`, `market.ts` `expectedCloudPrice`; the start value 0.93 `KW_PER_H` (`core/starts.ts:15-16`) copies the power module's `initialPower`. [Q-models-4, Q-core-3]
- **C2.** Power price 0.083 and O&M 3%: `market.ts:66-67` `tcoPerYear` vs `POWER_PRICE`, `OM_RATE` in `deals.ts`. [Q-models-4]
- **C3.** Facility $10B per GW: `market.ts:65` vs `FACILITY_PER_GW`. [Q-models-4]
- **C4.** Weight-security rise 0.006: `labReadouts.ts:11` vs `security.ts`; theft rule: `labReadouts.ts:17` `believedTheftChance` vs `actors/intel.ts` `pTheft`. [Q-models-4]
- **C5.** Regional baseline growth: `G_BASE` 0.018 / 0.04 / 0.028 (`macro.ts:23`) vs inline `gAI` (`sectors.ts:381`) vs start-state macro growth 0.02 / 0.045 / 0.028 (`sectors.ts:217`; two of the three numbers differ from `G_BASE`, so this may be drift, not a copy). [Q-worldfx-4]
- **C6.** Start GDP: `GDP0` (`macro.ts`) vs `macro(30000, ...)` (`sectors.ts:217`); Dow 44000: `DOW0` (`macro.ts:28`) vs `sectors.ts:218`. [Q-worldfx-4]
- **C7.** Runway thresholds (distress < 3 q, tight < 6 q): `board.ts:220` `updateRunwayState` vs `runway.ts:25-30` `runwayState` (is the second used?). [Q-finance-7]
- **C8.** Doom-threshold prior 0.40, U(0.30, 0.50): `lossRisk.ts:41` `THETA_PRIOR` vs `data/world.ts`. [Q-safety-engine-4]
- **C9.** omega_post 0.6: `OMEGA_KIND.post` vs `/ 0.6` in `traits.ts:141, 407, 1350`, `0.6 / 42` in the stream, the rival env (`:1413`); crystallisation 0.3: `umodes.ts:73` and `traits.ts:618`; P11 0.2: `hackTargetOf` and `postSignals`; Mis weights repeated in `misalignmentSd` (`traits.ts:656`); case compute share 0.05: `CASE_COMPUTE_SHARE` and `investigations.ts:124`. [Q-safety-engine-4]
- **C10.** `V3_CAL.sampled.*` are literal copies of ai2027's (`workTypes.ts:209, :319`); a tuner can change one without the other. [Q-capability-8]
- **C11.** Linked literals: `RL_FAMILIES` taskH 2 / 8 / 40 = `WORK_TYPES` H (`runDesign.ts:211-213` vs `workTypes.ts:189-190`); `RE_LABOUR_UNIT` = `RE_MAX_PER_PROJECT` = 2 (`research.ts:145-147`); `B0_PARAMS` = `FLOP_RL_REF` = 3e26 (`runDesign.ts:21-23, :56, :90`); `E_START` 1.19 = "START_STATE.b0 + 0.48 x 256 d". [Q-capability-9]
- **C12.** `REF_BASE_DAYS` 121 (= 91 x 0.8 / 0.6) and `GATE_OOM` are literals standing for v2-run results (`ref.ts:63-66, 101-104`). [Q-core-6; also A7]

## D. Structural obstacles (the registry cannot point at the number properly)

- **D1.** 11 non-exported constants (`LATENT_ERA_OOM`, `MISUSE_FROM_OOM`, `MISUSE_PER_OOM`, `LATENT_P`, `SD_AI_MAX`, `RECIPE_RATE_MAX`, `LEADER_DAY0_TRAIN`, `MISUSE_SHOCK_DAYS`, `ASSUMED_LAG`, `PRIOR_BAND`, `GOV_SCORE`): inline refs, still listed in `coverage.txt`. Export them (a refactor) or accept? [Q-actors-engine-3]
- **D2.** Action closures. `RELATION_ACTIONS` (`actors/actions.ts:89-526`, A1-F3; `def()` drops `cooldown` and `once`) holds nearly all actor-effect magnitudes and cooldowns, with 2 registry entries. Safety `ActionDef`s (`safety/actions.ts:440-510`): Pledge and Publish registered inline, Disclose / Framework override / Respond skipped. Previews repeat the engine numbers as text (Pledge credibility +8, trust +4, break cost 15 / 20; Publish +2, +1, +0.02 / +0.04; `findings.ts:463-466`), so the two copies can drift. Needs a data table first. [Q-actors-engine-4, Q-safety-engine-3]
- **D3.** `HEADLINES` effects (`headlines.ts:32-100`): `ctx.bump` amounts, `incidentR` +0.1, thresholds in `when` closures; 0 entries, too many for the inline cap. [Q-worldfx-5]
- **D4.** Provenance per record, one entry per field family: 208 entries use `path: ['*', ..]`. Worst: `PRODUCT_TOOLS` (12 records x 6 families, 8 entries; mixed `[P]`/`[D]`/`[D stand-in]`), `SECTORS[*].use` (survey vs `[D]`), `CONTROL_SETTINGS` (3 rows, `[S]` vs `[D]`; 4 entries), the 3 spread tables `RATING_SPREAD_BP` / `REVOLVER_SPREAD_BP` / `CHIP_LOAN_SPREAD_BP`. [Q-market-3, -7, -9; Q-safety-engine-5]
- **D5.** Values `Param.value` cannot hold: autopilot booleans (`strategic`, `offBalance`, `guard`, `rescue`, `recap`) in `REF_AUTOPILOT`, `CAPEX2X_AUTOPILOT`, `RACE_AUTOPILOT` (`plan.ts:62-66`; only `mult`, `guardQ` registered); `RIVAL_IDEA_IDS` (`rivalModel.ts:493`: a string list, path `['*']`, no value). [Q-finance-8, Q-actors-engine-7]
- **D6.** Numbers that exist only in a comment: difficulty win-rate thresholds (>= 30% Easy, 10-30% Medium, 1-10% Hard, < 1% Impossible; `starts.ts:20-23`). Make them constants before the ladder work? [Q-market-8]
- **D7.** Unit or role unclear: `H50_PER_OOM` 4.2 (`workTypes.ts:144-145`; doublings per OOM, a multiplier, or months?); `V2_DOMAIN_OFF` (CYBER -1, PHYS -4; `capability.ts:204-206`; "a unit, not a parameter", yet feeds every v2-level gate; registered `untagged`). [Q-capability-10, Q-models-2]

## E. Target questions (`targets-notes.md`, agent evidence kept)

- **E1. Which date is the authors2026 target.** `GOLDEN_EXPECTED` (SC 2029.68, SAR 2029.89, SIAR 2031.48, ASI 2033.73) or the golden-JSON days T1 checks (1495 / 1573 / 2151 / 2975 = 2029.59 / 2029.80 / 2031.39 / 2033.64)? T1 registers the JSON days (as implemented), `GOLD.*` the sourced years; `golden-timelines.ts:25` KNOWN says SC is "a constant ~0.09 y early". `T1.*` (RefBot vs golden days) and `GOLD.*` (integrator vs GOLDEN_EXPECTED) measure one set of dates: keep two targets or one target with two checks? [Q-T-1, Q-T-2]
- **E2. Slow A2 after SC.** `T1.slow.A2` is day 4272 (2037.19), later than the restated slow SC (3289, 2034.5); A1/A2 are `info` (WARN via KNOWN). Is that meaningful? `lib.ts calGolden` restates only SC. [Q-T-3]
- **E3. Coded bands differ from the stated target.** F6 stated 70-75%, coded mean 0.70-0.77 and min >= 0.65; F7 revenue stated $45B +-20% (36-54), coded 36-67 (to include $53-56B); F9 FC1 stated about $0.5-0.65T / $2.5-3T, coded 450-750B / 2200-3300B; F4 stated t+4 and peak t+6..t+8, coded first rise t+4..t+6 and peak t+6..t+9 (`finance.ts:159, 193, 225, 262`; V2-SPEC 7.2). Registered: value as stated, tolerance as coded. Which is the target? [Q-T-4]
- **E4. Targets with no stated figure, or a sanity band.** `F8.refNoDistress` 75% appears only in the check (`finance.ts:238`); `T2.labour.SCband` states about 200k copies at ~30x (+-30%) but the check is one order of magnitude either side, "a sanity check, not a fit target" (`calib.ts:517-528`); `safetyrates.ts:262-345` has 18 banded rows not in CAL2: register all? [Q-T-12, Q-T-7, Q-T-10]
- **E5. INFO-only checks.** `S5.refBot.belowL` (deleted 2026-11-28, H) (>= 50% of worlds, CAL2 "fail") has been INFO since the designer's 2026-11-23 option (c): "a design reading of AI 2027's text, not a sourced number, swings +-6 pp" (`safety.ts:191-194`). `W.remote25` and `W.unemployment12m` (CAL2 "fail (new): never, 0/20") are INFO because CAL3-I judged them scenario projections, not measurements (`worldfx.ts:200-208`). Registered `info`, no check label. Keep as targets? [Q-T-5, Q-T-6]
- **E6. Not real checks.** `BOT.*` criteria are printed MET/MISS lines, and `bots.ts` is not in the `run.ts` job table ("informational until M2 integration"). `START.difficultyLabel` (deleted 2026-11-28, H) is a hand-set label that no check compares with bot win rates (also D6). `R5.leader.day0Rates` and `R8.follower.staleness` (CAL2 "fail x2", target "-") compare the code with itself (`rivals.ts:167-219`). Target or structural check? [Q-T-8, Q-T-9, Q-T-11]
- **E7. One target or two.** T3: `ws4.ts` binds (8 seeds, real RefBot play), `calib.ts:~548` prints an INFO value on the stub path (`T3.china.stubLead` (deleted 2026-11-28, H)). `T-tree.durations` (deleted 2026-11-28, H): one target for all presets and projects (`calib.ts:174-179`, `V1_DAYS`); the lead's answer to Q-B2-2 is "keep one for now; B6 decides". [Q-T-13, Q-T-14 = Q-B2-2]
- **E8. Which mode binds.** `smokeCheck()` rows (most F-series, T3 mean, S4, S5 Mixed) fail like `check()` in a full run but print SMOKE under `--smoke`; the registry does not record the mode (`lib.ts:115-119`). [Q-T-15]
- **E9. A known miss with no KNOWN entry.** `EV9.releaseSuites` reads 34 / 33 d against about 14 d in CAL2 ("RF-S6 revert, known; CAL-S2 kept it as a real timing miss for the designer"), yet `evals.ts:279` has no KNOWN entry. [Q-T-16]

## F. One-off classification questions

- **F1. Verifiability `v`** (0.9 / 0.7 / 0.3 / 0.5 / 0.2 / 0.4) of `WORK_TYPES` (`workTypes.ts:29`) and `SECTOR_WORK` (`serving.ts:29-32`), both `unclear`. Proposed: `designer`, pointer in notes. Evidence: the values are research/20 "Game-ready E3 [G]" (line 583), a design proposal with "No primary source" (line 580); same numbers in both places. [Q-capability-1, Q-market-2]
- **F2.** `V3_CAL.fast.dBM` 0.6: `fitted` (CP3j, "delta_bm 0.75 fails") or `sourced` ("0.6 its floor" of the AIFM range)? Registered `fitted`. `V3_CAL.slow.dBM` 1.6 has no refit or source of its own (group tag `[fit]`): `fitted` or a carried default? Registered `unclear`. [Q-capability-2]
- **F3.** `PARTNER_TERMS.strings.ipCloseYr` 10% a year (`deals.ts:69-74`): the `[R21 B4]` cite follows the FTC quote about Microsoft's OpenAI rights, not the 10%. Registered `designer`; the agent gave no alternative. [Q-market-10]
- **F4.** `ECON.hireSlope` 1.2, "a once-fitted stand-in" (R16 wrote 1.5 "[D, no source]"): `fitted` or `stand-in`? `LARGE_SHARE.EDU` 0.871, `[P]` plus the designer's Education rule: `sourced`, `designer` or `derived`? Both `unclear`. [Q-market-5, Q-market-6]
- **F5.** `LARGE_ROUND.min` $20B (`equity.ts:124-127`) has no tag; the [R15] cite covers only the half/half split. Is the 20 sourced? Registered `untagged`. [Q-finance-10]
- **F6.** End-screen scores (`SURVIVAL_BASE`, `FREEDOM_BASE`, `FREEDOM_NONE`, `PROSPERITY_BASE`, `PROSPERITY_POWER`, all term weights; `scoring.ts:11-25, 126-130`) have no provenance, yet `verdictOf` feeds bot win rates and from them the start difficulty labels (`starts.ts:20-23`). Treat as designer judgement and tag? Registered `untagged`. [Q-core-5]

## Counts

A 10, B 9, C 12, D 7, E 9, F 6 = 53 items covering all 100 questions (Q-B2-1 is already answered).
