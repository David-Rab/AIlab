# RD build notes

One block per task (ID, choices marked [D], deviations, readouts for later tasks).

### RD-C01

Retired v2's knot production function (SYNTHESIS §4.1; INP-20, MEA-16). Commit eaf22ad.
- **Moved** to new `src/engine/v2/production/ces.ts`: bisect, erf, Phi, cesFromAsymptotes, Xces, Lrel, tasteSigma, hRef,
  refTotal, frontierFlop. 15 importers (src + scripts) repointed. `production/knots.ts` deleted (no shim).
- **Deleted:** buildKnots / buildKnotsDetailed / KnotBuild, knotAt, refDates, knotCompute, gF, La, sdOfF, bestMix,
  tasteOf, tasteSD (only the knot branches used them); refBestX, tasteCurve, speedOf and the non-v3 branches of evalM,
  evalProduction and bestResearchMix; R13_AI2027_KNOTS and R13_TABLE_SD (calibration.ts); ProdKnot and
  ProdParams.knots; world/hidden.ts no longer builds knots (prodParamsFor lost its world argument).
- **LabInputs:** qDep, qTaste, aEng, d, stock, tasteHire, eff, mixUnit.load gone; `v3` is now required (labInputs only
  ever built the player's v3 inputs). [D] qTaste and aEng were not in the list but had no reader outside the knot branch.
  productionWhatIf's change type is h / k / c.
- **ProductionReadout:** Ddata, parts.base, elast.train / data gone, and [D] ratios.d (no reader; its only source was
  LabInputs.d). rivalReadout updated.
- **Schema:** SCHEMA_REV 43 → **44**; migration 43 drops `hidden.timeline.prod.knots` and the dead prodCache fields of
  every lab (idempotent). New hygiene check "a schemaRev-43 save migrates to 44"; the `SCHEMA_REV === 43` literals in
  control / data / footholds / hygiene bumped.
- **Scripts:** identity.ts (P1–P3, all on the knot function) deleted and dropped from run.ts; products.ts A1 (qTaste =
  qDep reproduces M) removed (it tested a removed input); worktypes lint allow-list points at ces.ts.
- MANUAL_MIX_RANGE comment rewritten (no knot justification; says it is narrower than Auto's [0.01, 0.99], INP-21).
- **Kept:** AI2027_COMPUTE_TABLE (EndScreen reads it; comment fixed). ProdParams.kappa / etaSC are now unread (only
  buildKnots read them) but kept: removing them is another shape change → RD-C04. evalM still returns v2-shaped fields
  (Mref, R, tau, norm) that readout callers destructure; INP-03 territory.
- **Behaviour:** identical. Probe (RefBot; sampled #11 500 d, authors2026 #5 400 d, fast #3 300 d): state hashes with
  the removed fields stripped equal before / after. All five fixtures regenerated and compared the same way: identical;
  committed fixtures left at rev 43 (stale only by the removed fields; the merge regenerates them with `--write`).
- **Tests:** tsc main + scripts clean. test:quick 32/34: fixtures FAIL (stale, expected: the removed fields and rev),
  worldfx A2a 6.7% / W4 23.3% (known). hygiene incl. the new migration check passes.

### RD-C02

Deleted the calShift bridge (SYNTHESIS §4.2; MEA-08). Commit ef3a578.
- **Deleted:** alignedCalShift (models/capability.ts), `TimelineWorld.calShift` and its write in timelineFor
  (world/hidden.ts), world/calibration.ts thresholds(), levelOfV2's default `shift = w.calShift` (now a required
  argument). Grep before: no reader of `w.calShift` or thresholds() beyond those; levelOfV2's only caller (RefBot
  gateLevel) already passed CAL_SHIFT explicitly.
- Doc comments fixed: world/calibration.ts header (what remains), playerStart's comment (no calShift lag), CAL_SHIFT's
  doc (only reader: RefBot's gates).
- **Kept:** CAL_SHIFT (bots/ref.ts gateLevel still reads it), levelOfV2. Comment-only mentions left in save.ts history
  (rev 15), calib.ts T1 A1 text, golden-timelines.ts; rivals.ts R7 lint still forbids `calShift` in rival code.
- **Schema:** no bump; the rev-44 migration (43 → 44) also deletes `hidden.timeline.calShift`.
- **Behaviour:** identical. Probe (RefBot, runRef; sampled #11 d0/250/500, authors2026 #5 d0/400, fast #3 d0/300,
  ai2027 #2027 d0/450): state hashes with the removed fields stripped equal before / after.
- **Tests:** tsc main + scripts clean; test:quick 32/34 (fixtures stale, worldfx A2a 6.7% / W4 23.3%, known).

### RD-C03

Save floor at schemaRev 33 (DD-20; SYNTHESIS §4 items 3 and 11). Commit 0669f20.
- **Refusal.** `core/save.ts` exports `MIN_SCHEMA_REV = 33` and `OLD_SAVE_MESSAGE` ("This save is from an older version of
  the game and can no longer be loaded."). `deserialize` throws it for any rev below 33, a missing rev included, before
  the newer-build check; the store's "Load failed: …" toast shows it as before. SCHEMA_REV stays 43 (no state change).
- **Migrations removed:** 1–10 (unreachable) and 15–32 (11–14 never existed). Migrations 33–42 (finance v3) and 42 → 43
  (SAFMECH) stay.
- **Helpers removed:** legacyG / legacyE / legacyPa / legacyPm and `migratePmPa` (save.ts); `migrateRivalPhys` /
  `migrateRivalRecipe` (actors/rivalModel.ts); `suitesFromV1` (models/suites.ts); `dataPortfolioFromV2` and
  `V2DataAssets` (production/data.ts); `LICENCE_DEAL_SHARE` (data/v2/dataAssets.ts); `PostDesign.graders` (types.ts:
  no writer); `footholdsFromV25` (safety/footholds.ts); `controlFromV26` (safety/control.ts).
- **Kept, live readers:** `safFromProgress` (the runtime fallback in lineProjects.ts safState: RD-C05); `oomOfRefM`
  (safety/findings.ts, techniques.ts, oversight.ts agendaOHalf); `ensureWs3` (finance code and migration 40 → 41);
  `B_G_PER_Y`, `gV0`, `playerStart` (actors, china, intel, rivalModel); `HARDENED_FACTOR` (data/v2/suites.ts);
  the tree's `graders` OptionSlot and the Research panel's slot label (data, not the saved field). The playerStart v1
  imports / B_G_PER_Y deletion (MEA-24) is not done here: they still have live readers.
- **Tests.** hygiene: the old "no migration from schemaRev 11–14" check and the 15 → 33 migration checks became one
  check that revs none / 0 / 1 / 11 / 14 / 15 / 20 / 27 / 32 refuse with OLD_SAVE_MESSAGE; the "every rev migrates" loop
  now runs 33–42. Old-migration checks removed from data (20 → 21, 23 → 24), suites (22 → 23 replay, 27 → 28), evals
  (EV8 25 → 26), footholds (30 → 31), control (31 → 32), safetyresearch (21 → 22); their round-trip checks stay.
  tsc main and scripts clean; test:quick 34/35 (worldfx A2a 6.7% and W4 23.3%, the known failures); hygiene full 195/195;
  fixtures all pass (fixtures identical: no behaviour change in new games).

### RD-C04

Dead exports, fields and branches, engine side (SYNTHESIS §4.4–5, all but the Safety bullet and SPEED_CAP / S_CLAMP,
which RD-C05's lane does). Commit 9643d65.
- **Dead branches:** tree `cashCost` (TreeNodeDef field; the tree.ts gate and booking, treeActions preview; research
  script D9's clause). research.ts "Only finished projects can be adopted": unreachable in play (both callers in
  resolveStage store the result and stage first); only the research script reached it, calling the export directly.
  [D] adoptProject → private `queueAdoption(n, st, queueBuild)` (same picks: a line's first unqueued pending result,
  else the project's result → 'adopting'); the script's "only finished projects" check went with it.
- **§4.5 list:** HEADROOM_SHARE, adoptCostTW, gainKnowledge, nextModelGate / NextModelGate / dataStockRatio /
  tokensRequired (+ selectors re-exports), EFFORT, GOODPUT_FT, JOURNALS_FRAC, POST_PREF.honest / safetyFteWeeks,
  POST_SAFETY.honest / misuseMult, design flags (BaseEffect.flags, PostEffect.flags, rlFocusEffect's flags, and [D]
  RL_FAMILIES.flag, their only source; ModelVersion.flags stays, benchmarks set it), PostEffect.safetyFteWeeks /
  misuseMult, USAGE_MIX api / agents / enterprise / gov, the 'internal' Variant (CHANNEL_VARIANTS.internal, charter
  check), ParadigmDef.effect / safetyCost (the D9 text lint now reads only tree text), PRIOR_BY_ID → PARADIGM_BY_ID.
  `cheapestAt` + CheapestAt moved into scripts/v2/serving.ts (engine comments still name "the cheapestAt rule").
- **Shape, rev-44 migration extended (no bump):** ProdParams / ProdPreset kappa, etaSC; BaseModel.scale (run.scale
  stays: it feeds scrutiny); VersionBuild.misuseMult. Migration 43 deletes them on every lab's bases / versions.
- **Scan** (word match over src + scripts, fixtures excluded; probe dir rdc04/scan.mjs): 41 further exports with no
  reference outside their file deleted (e.g. trustHit, chinaMeter / govMeter / secDemand, readMeter, priceView,
  trueG, labPools, activeLabIds, liveDeployments, predictRun, productionWhatIf, playerUniqueTokens, buildBacklogTW,
  h80Of / h80Min, LEAK_K / DISTILL_K / RIVAL_DRIFT_K, playerLeverageByLineage, sectorLevel, shareOf, TREE_DEPTH,
  KEY_LABEL / ROLE_LABEL / QUALITIES, BLOC_IDS, WORK_TYPE_IDS, H100E_PER_COPY_SC), then the cascade (freeStock,
  nextBaseFlop, FREE_EPOCHS, SECTOR_INDEX) and the imports tsc flagged.
- **Kept:** safety/* dead exports (beliefShown, techniqueStrength, isUnlocked, activeTechniques, controlLost,
  openIncidents, safetyAgentCompute, allLabMis), selectors techniqueCurve and UMODE_IDS: safety lane. CHIP_TERMS /
  RENT_TERMS (index re-export only) document the valid order terms. The glossary entry `nextModelGate` and the
  'preference' entry's "safety staff time, more honest" are copy (B47). ~510 exports used only inside their own file
  stay exported (de-exporting them is churn, not a deletion).
- **Behaviour:** identical. Probe (RefBot, runRef; sampled #11 500 d, authors2026 #5 400 d, fast #3 300 d, ai2027 #2027
  450 d): full-state diff before / after lists only the removed paths (prod.kappa / etaSC, bases[].scale,
  versions[].build.misuseMult). All five fixtures regenerated and compared with the committed rev-43 ones through
  deserialize: identical; committed fixtures restored (the merge `--write`s).
- **Tests:** tsc main + scripts clean; test:quick 32/34 (fixtures stale, worldfx A2a 6.7% / W4 23.3%, known);
  npm run build ok.

### RD-C05

Dead safety / people fields and duplicate constants (SYNTHESIS §4 items 5, 6, 7, 8). Commit 564e32e. Behaviour-neutral.
- **Removed (no readers in src/ or scripts/):** `beliefShown` (safety/lineProjects.ts); `compute.linesWanted` /
  `linesGot` of `SafetyUtilisation` (safety/view.ts; the local `got` stays, it feeds `idle`); `AgendaDef.fteRef` /
  `fteRange` and the 18 rows' ranges (data/v2/agendas.ts).
- **REF_OFF** is `Record<DomainId, number>` (column 0); its one reader, capability.ts domainsOf, reads `REF_OFF[d]`.
- **OLD_EFFORT_DAYS / TM_PER_OLD_DAY** → `V2_PARADIGM_EFFORT_TM` in tree.ts (17 paradigms not in FITTED_EFFORT_TM, the
  computed values 12–42 TM written out, marked v2-derived pending RD-R07). Every node's effortTM checked identical.
- **safFromProgress deleted** [D]: `ts.saf` came with schemaRev 21 (E1), whose migration converted every line project
  in progress; the floor is 33; in a game, a line node's `progress` is written only from `ts.saf` (safProgress), and
  the tree's resets set progress 0. safState is now `ts.saf ??= freshSaf()` (signature kept).
- **Constants:** PROD_SPEED_CAP folded into `SPEED_CAP` (data/v2/workTypes.ts; limitsView and production read it).
  S_CLAMP (rivalModel, a copy kept because of an import cycle) and S_RANGE (models/research.ts) are one `S_RANGE` in
  data/v2/research.ts.
- **Tests.** tsc main and scripts clean; test:quick 34/35 (worldfx A2a 6.7%, W4 23.3%, known); safety full 21/21,
  safetyresearch 29/29; fixtures all pass with SIMCACHE=off (unchanged).

### RD-C07

Removed the cut paradigm P26 (SYNTHESIS §4.10). Commit 0b69b73.
- P26 gone from PARADIGMS (data/v2/paradigms.ts; a comment says where its draw went) and tree.ts OLD_EFFORT_DAYS. No
  tree node, glossary, UI or script listed it; Codex, research.ts PRIOR_BY_ID and initialParadigms derive from PARADIGMS.
- [D] Draw site (world/hidden.ts step 5): `if (p.id === 'P27') rng.chance(0.8)` before P27's draw, i.e. the same single
  rng.next P26 consumed, with a comment.
- **Schema:** player.paradigms and hidden.paradigmSuccess lose their P26 key: no bump; the rev-44 migration deletes both.
- **Behaviour:** identical. The same probe (stripping P26 too) gives equal hashes at all nine checkpoints. Fixtures
  (all five) regenerated and compared with the committed rev-43 ones, both through deserialize (the rev-44 migration
  strips RD-C01's, RD-C02's and RD-C07's fields): identical JSON; committed fixtures left at rev 43 (merge `--write`s).
- **Tests:** tsc main + scripts clean; test:quick 32/34 (fixtures stale, worldfx A2a / W4, known).

### RD-C06

Stale comments and BRIDGE tags (SYNTHESIS §4.9). Commit 5a0a250. Comments only, plus one lint line (below).
- **BRIDGE tags in src: 15 at the start (RD-C01/C02/C04 had removed the rest of §4.9's 26). 4 removed, 11 re-pointed.**
  - Removed: the "BRIDGE(Vn) temporary" tag legends in the headers of data/v2/research.ts and runDesign.ts; the
    historical mentions in safety/oversight.ts (mAtLevel / versionM, deleted) and safety/traits.ts (S5's old scale term).
  - Re-pointed: CAL_SHIFT → RD-U07; capability.ts playerStart / Mref (multiplierAt) → RD-U06; run scale / scrutiny
    (runDesign sizeScrutiny, runs.ts scaleOf ×2, types.ts TrainingRun.scale) → RD-T11; research.ts gRate readout and
    production.ts `rate` (×2) → RD-L03; tree.ts rolled-node speed M (×2) and production.ts header M → RD-R01 / RD-R04.
  - Left: scripts/v2/rivals.ts R7 lint (asserts no BRIDGE(V7) in rival code: a regression guard, not a tag).
- **Deviation [D]:** scripts/v2/worktypes.ts's "no player mechanism reads frontierFlop / multiplierAt / CAL_SHIFT" lint
  exempted lines carrying BRIDGE(V6|V7); it now exempts lines naming an RD plan item (`/\bRD-[A-Z]\d+[a-z]?\b/`), so
  capability.ts Mref and runs.ts scaleOf carry "until RD-U06" / "until RD-T11" on the line. Replayed the lint by hand:
  clean. Whoever deletes those lines (RD-U06, RD-T11) leaves nothing for the exemption.
- **Headers / docs fixed:** tree.ts (auto-assign is safety-only; capability teams use research.ts planAssignment /
  assignCapTeams); research.ts header (safety on lineProjects.ts and the rolled path until RD-R02b / RD-R04) and P13
  (projectFlopPerDay does not apply it; the callers do; → RD-E01a); researchView flopPerRe (was "P13 multiplier");
  rivalModel gEquivOfRecipe / recipeOf (no recipeG; the player's stacksGEquiv is at a different F until RD-B16);
  capability.ts start state (v2 coordinate, who reads it) and section header; production.ts header (what the file
  does; who still reads M and rate); build.ts (capacity = coding-CES SWE labour, no cap); teams.ts engine map;
  agents.ts uses → work types (useLabour), no pre-R7 neutrality claim; Compute.tsx (the Split tab lives here);
  types.ts miniVersionId (Chat free tier vs sector cheap tier; FREE_TIER_SHARE blend → RD-B11), sectorFocus and
  certDay (SECTOR_PACK_DG OOM, US R −0.1; no "+0.5 L"); rivals.ts rivalSpeedMult (applied; no M0 note).
- Not touched: glossary / player-facing text (B47); other stale-looking comments outside the §4.9 list
  (finance/observe.ts "until MODEL-V3 lands", runDesign serveCost readout).
- **Tests:** tsc main + scripts clean. No test run (comments only).

### Phase 0 merge wave

test:full and test:deep on `rd` 1a25b28 (2026-11-22; outputs in %TEMP%/ai27ux/tests/phase0-full.txt, phase0-deep.txt).
- **test:full: 58.2 min wall** (cpu 144 min, load 90%, other agents' tests on the machine; M11 15.6 min), 33/35 scripts,
  **2364 passed, 3 failed**, test:ui 687 / 687. **test:deep: 7.7 min** (load 98%; M11 6.3), 23 passed, 1 failed.
- **Failures = the M11 baseline, same values:** finance F8 RefBot distress-free through 2026 66.7%; worldfx A2a 6.7%,
  W4 23.3%; deep S5 sabotage (b) believed − true U 2.13 vs 2.50 (−0.37 ± 0.45 se, larger in 46%). Nothing new.
- **WARNs = baseline, same values:** calib 9 (T1 A1 / A2 rows; T1L authors2026 SIAR 1880 vs 2151 d = −0.74 y, ASI 2430
  vs 2975 d = −1.49 y); safetyrates 20 / 0 / 6 (F5 EA end 2026 52.9%, F6 rows 71.1–74.3%); golden-timelines' 3
  long-standing v1 WARNs (authors2026 SC, sampled SC p50 2027.999, slow SC 2038.527; M11 did not list them).
- **Lead numbers unchanged:** S4 0.670, S5 60% of 40 (median U − L −0.57), FIN3a (INFO) 59.1, safe-only 0.037.
- **Check counts that moved (all retired checks, no value moved):** identity (76) deleted and products 62 → 61 (A1;
  RD-C01); hygiene 218 → 196 (migration checks merged into one refusal check plus the new 43 → 44 check; RD-C02 /
  RD-C01); old-migration checks removed from data 62 → 61, suites 31 → 30, evals 32 → 30 (EV8 + its old-save replay),
  footholds 35 → 34, control 33 → 32, safetyresearch 30 → 29 (RD-C02); research 30 → 29 ("only finished projects can
  be adopted", RD-C04). Every other script's count equals M11's.
### RD-B01

Synthetic base launch; Data teacher quality cap; Blueprint defaults from the engine (B01, B43, B44). Commit fb46301.
- **B01 confirmed and removed.** A base run's teacher only seeded `traitsTrue` in completeRun, and applyBaseToLineage
  (called right after) rebuilds the traits from the draw's synthetic teachers (`synTeachers`, `base.teacherData`), and
  pulledTraits reads only `run.id`. So: planRun drops the "Synthetic data needs a teacher version" check (the P10 lock
  reason now stands), launchBase no longer reads `teacherVersionId`, completeRun's trait seed is B0's (placeholder).
  Old saves with a teacher on a base run are harmless (nothing reads it). Glossary dataMix text updated; GLOSSARY.md
  regenerated. Left: `planRun`'s params / TPP out-of-range checks still overwrite a lock reason (both are real errors).
- **B43:** teacherRows passes `synQualityCap(s)`, the cap generation uses.
- **B44 [D]:** the engine exports `RUN_PARAM_DEFAULTS` (flat params from REFERENCE_BASE / REFERENCE_POST; models/actions.ts)
  and `RUN_POOL_DEFAULT` (runs.ts: base 0.6, post 0.2, distill 0.1, continue 0.3). The engine's values win, so the
  Blueprint's pool defaults fall from post 0.4 / distill 0.2 / continue 0.4 (no sim moves; only the player's default
  click). Pool pills are the old five plus the defaults (10%, 30%). The distill size text reads STUDENT_DEFAULT ("an
  eighth"). The default base size is still the largest feasible snap (unchanged); DEFAULTS.params (now B0's 354B) is only
  the fallback. RefBot's ½ student (bots/ref.ts) is a bot choice, untouched.
- **Tests:** tsc main + scripts clean; data full 63/63 (two new RD-B01 checks: lock reason kept, then launch with no
  teacher; teacher-table quality = generated quality with P10); test:quick 33/34 (worldfx A2a / W4, known); fixtures
  pass (did not move); build ok; test:ui 687/687 (a first run timed out on the coach click under load, the rerun passed);
  lint-ux, lint-hidden pass.

### RD-B02

Launch snapshot on `run.recipe` (B02, B03; TRN-15, CAP-04). Commit 2b472ff.
- **Shape.** `TrainingRun.recipe` is a `RunRecipe` (types.ts): base `pre`, `draw` (the DataDraw), `p24` (P24's bonus,
  OOM, payoff included); continue `pre`, `draw` (its base's design on the portfolio at launch); post and IDA `rlMid`,
  `rlCeil`, `fid`, `exploit`, `domainG`, `p07`, `serveOom`; distillation `{}`. Built by `recipeAtLaunch` (runs.ts), used by
  launchRun and (through `fillRecipe`) the migration and newGame.
- **Readers.** completeRun reads only the snapshot: baseG takes a `BaseFreeze` (plan = a launch today, completion = the
  snapshot), postBuild a `PostRecipe` (domainG, P07 horizon), the version's serve cost × 10^−serveOom; the per-field
  `rec.x ?? today` fallbacks are gone. [D] One guard stays: a run with no recipe at all (only hand-built script runs)
  gets `recipeAtLaunch` at completion. Trait hook: applyBaseToLineage and runSignals read `recipe.draw`
  (`runBaseQuantities`; today's draw only for preview run-likes).
- **[D] P07 as a flag, not a multiplier:** P07 has two effects on a trained model, the horizon ×1.2 and persistent memory
  (E22's `env.memory` in the trait step); found by the new test (SUCC differed). `runMemoryOn(s, run)` = the frozen P07 or
  P08 today; applied in applyRunToTraits' post step (and its predicted beliefs, new last arg of predictBeliefs) and in
  applyIdaCycle (new optional `run` arg).
- **[D] Start run R0** (init.ts) had only rlMid / rlCeil, so it read today's suites at completion; newGame now fills its
  snapshot on day 0 (suites, domainG, P07, serving; its RL recipe stays its launch day's).
- **Migration 44 → 45:** runs in flight (running / paused) get the missing fields from the save's own day (their launch
  values are gone; today's are what completion read until now: the best available). Key order kept, idempotent; finished
  runs untouched. Hygiene: "a schemaRev-44 save migrates to 45" (strip the new fields of an in-flight base and post run,
  load, hash equals the current state) and the every-rev loop (33–44 → 45) pass. SCHEMA_REV literals 44 → 45 in hygiene.
- **Test:** data "RD-B02" (2 checks): +200T licensed code, P24, P07, domainG CODE +0.3, pre / RL / serving stacks raised
  mid-run leave the finished base (G, draw readouts, signals, traits) and version (G, levels, build, serve cost, fpt,
  traits) identical, while a plan made the same day moves (base gPre +0.22, CODE +0.42, serve cost 0.50 → 0.11).
- **Calibration (test:cal, no value refitted):** every binding golden date passes. T1 RefBot 20-seed medians, Δ vs golden
  (y): ai2027 SC +0.075, SAR −0.078, SIAR −0.041, ASI +0.029; authors2026 SC +0.011, SAR −0.090, SIAR −0.049, ASI +0.118;
  fast SC +0.021, SAR +0.096, SIAR −0.019, ASI −0.099; slow SC +0.049. T1L WARNs authors2026 SIAR / ASI −0.742 / −1.493
  (known, as after M11); other T1L dates pass; T1 A1 / A2 WARNs as known. (Prefill shard calib#5 crashed on a temp file
  an editor command wrote into src during hashing; the main calib job ran its seeds itself and passed.)
- **Tests:** tsc main + scripts clean; data full 65/65, effective full 27/27, hygiene full 197/197; test:quick 32/34:
  fixtures stale (all five: the shape change and R0's snapshot; not committed, the merge `--write`s), worldfx A2a 6.7% /
  W4 23.4% (known).
- **Found, not widened (still read at completion):** postSignals' P11 (S2 +0.2) and deploymentS8 (the version's signals
  and its trait step); P08 in runMemoryOn; newVersion's `adopted(s, 'P19')` in domainsOf (a level readout refreshLevels
  re-reads anyway); consumeRunPenalty (a safety response; maybe by design); applyIdaCycle's postSignals / postHack on
  today's suites (no `exploit` passed); idaBuild / distillBuild reading the teacher's build at completion (a stream may
  have moved it); synTeachers reading the draw's teachers' traits at completion; the post trait step's techniques
  (trainAgainst detectors, steerS4, P14 probeSteer, healRate, stack detection: safety redesign territory); a base's tier
  (labLevel) and U-mode draw at completion.

### RD-B03

A family unlocked later starts with no suite (B04; TRN-14; DD-07). Commit 5ab418f.
- **Engine (models/suites.ts).** `suiteOf` returns only a stored suite; [D] a start family missing from the state still
  reads as its start suite (start families unchanged). So computer use after P06 has no suite: `suiteFamilies` (broad RL
  weights via suiteRlWeights / playerRlWeights, suiteFidMap, upkeepLines in departments/build.ts) leaves it out,
  planRun refuses it as a focus, harden is refused ("build a suite first"), `suiteFidelity` is 0 without a suite.
  New `unbuiltSuiteFamilies` (idea known, no suite) and `firstSuite`. `suiteWorkBlock` allows a build once the idea is
  known. `completeSuiteWork`'s first build creates the suite: [D] the start type's exploitability (as the old free suite;
  the spinout cheap), builds 1, expert asset = one build's E₀ → fidelity 1.00. Cash and team-weeks as any build ($0.1B,
  2 TW). rlFamiliesAvailable (effective.ts) is only called with `() => false` (start families, rivals / reference): untouched.
- **Preview (suitesPreview.ts).** withSuiteWork creates the suite for a first build, so the Build button's planned-run
  before → after is real; new `unbuiltSuites(s, lp)` (exported) for the panel.
- **RefBot (bots/ref.ts).** Queues `suite.build` for every unbuilt family (once; tryAct, so it waits for cash) before
  its post-training step. The reference lab's path now has the build's delay (≈ 2 TW on the build queue) and cost.
- **Save.** No shape change, no bump. [D] The rev-45 migration (44 → 45) first stores the start-quality suite and its
  expert asset for a save that knows P06 but never stored the suite (it had read as a free one), so old saves keep what
  they had and runs in flight are filled against it. Idempotent.
- **UI (Models › Suites).** An unbuilt family gets its own row: "No environments yet — build a suite" (tooltip: fidelity
  none, the first build's fidelity / exploitability) with the usual Build cell (cost, ETA, planned run's ΔG); no Harden.
  The locked row's tooltip now says "Once the idea is known, build its first suite here."
- **Tests.** tsc main + scripts clean. suites full 37/37 (before the UI-only edits; engine unchanged since): five new
  RD-B03 checks (no suite with P06 known: no broad weight, focus, harden or upkeep, broad post-train unchanged; build paid
  when queued, still no suite while pending; preview equals the suite built today; once built fidelity 1, broad share
  1/7, focus, upkeep; RefBot queues it once; a rev-44 save knowing P06 keeps a fidelity-1 suite), plus "no build before
  P06". Per the RD test rule, test:quick, test:cal, test:ui and fixtures were not run.
- **moves calibration: maybe.** Only where P06 becomes known in a RefBot game: computer use joins broad RL after the
  build (days later than before) instead of on the day the idea is known; fixtures that reach P06 would move.

### RD-B14

Delete `defaultLabPolicy` (B21 / MEA-21). Commits on `p1-riv`.
- **Fix:** removed `defaultLabPolicy` from models/runs.ts (the continual system now only advances the player's stream)
  and the `RivalLab.managed` flag (types.ts; it was set only inside labDaily, so the fallback also ran on day 1:
  split, staff, base-run training, CL refresh and a public-model bump twice). Every active rival, the leader lab and
  China run one daily policy, WS4's `labDaily` (actors/rivals.ts, rivalsChina system, order 100); no lab is left
  without one (labDaily covers `activeRivals` + China while active, exactly the labs the fallback served). No schema
  bump (optional field dropped; old saves carry an ignored `managed: true`).
- **Regression check:** rivals R10: on day 1 every rival's and China's staff ratio equals one hRef step
  (1.00078904 for all six labs; before: 1.0015787 = step²).
- **Side effect [D]:** serving B3 compared the enterprise seat price with `=== SEATS.price`; the price is the lineup
  tiers' weighted blend (worldfx/mix.ts), so it came out 24.999999999999993 once rival paths moved. B3 now uses
  `near(…, 1e-12)`. Verified the pre-change code gave exactly 25 and the post-change 25 − 7e-15 (float rounding only).
- **Tests:** tsc main + scripts clean. rivals full 17/0. serving 90/0. test:quick: fails are fixtures (stale, expected:
  the merge regenerates them) and worldfx A2a 6.7% / W4 23.3% (known since F1). test:cal 49/0 (WARNs as after M11).
  Golden medians now (20 seeds; target): ai2027 SC 638 (638), SAR 762 (791), SIAR 854.5 (883), ASI 911.5 (915);
  authors2026 SC 1514 (1495); fast SC 888 (880); slow SC 4776 (4758); T1L ai2027 SC/SAR/SIAR/ASI 611/802/900/943;
  T1L authors2026 SIAR −0.745 y, ASI −1.495 y (M11: −0.74 / −1.49). All inside tolerance; no pre-change cal run
  kept here, so day deltas vs the base are not measured (the shift is a one-day ×1.00079 on rival staff and one extra
  day of base-run FLOP, so ≲ 1 d expected).

### RD-B15

The now-part of B22 (MEA-25, MEA-V02): the epilogue / final score projected rival Mis at ASI with a stand-in trait
model. Commit cd1d7a1 on `p1-riv`.
- **Fix:** `projectedMisAtAsi` (endings/epilogue.ts) now calls `projectLabMis` (actors/rivals.ts), which fast-forwards
  the lab's trait cadence on WS2's `rivalTraitStep` (safety/traits.ts), the rule `labDaily` runs in play: a 'post'
  step every mean POST_DAYS (56 d, first at the lab's scheduled `nextPost`), and at each base (BASE_MONTHS by
  archetype from `nextBaseDay`) a 'base' step then a 'post'; latent reasoning adopted once at Lg ≥ 9 with LATENT_P.
  Deleted the stand-in `rivalTraitStep` and its private `rivalSignals` / `effSafety` / `capIndexOfLevel`, and the
  WS4_TUNING knobs `rivalDriftK` / `rivalPullback` (no other caller). No caller of the stand-in remains.
- **[D] The stated stand-in (DD-18):** capability rises linearly in G from the internal model's to the ASI point over
  the projected days; every base starts a new lineage; race pressure stays at today's. Draws from
  `Rng(hash32(seed, projectMis:<lab>:<day>))`, no stream (pure; the control.ts "no roll" check still passes). Step
  guard 120 (the old cap was 40 posts; with bases included a 40-step cap stopped long projections short of ASI).
  Reads the lab's hidden posture (`labPosture`, as in play), not `postureOf`'s player-action deltas.
- **Not in scope (theme L, RD-L02):** the days to ASI still use `paceOf` (the player's rate) × 0.7, and
  `epilogueSurvival` still weights labs by rival-vs-rival `leadBetween` with the (1 − share) term. Readout for L: on
  RefBot and idle snapshots at day 250–500 the projected days are 1700–3700 (the player's slow early rate), so the
  projection spans several rival base runs; this horizon, not the trait step, drives most of the drift below.
- **Score drift** (probe scripts/v2/_b15drift.ts, gitignored; ai2027 / medium, company-loss `ousted` scored on
  snapshots; only the survival axis moves, other axes identical). Survival old → new:
  - RefBot seed 1: d250 28 → 44, d500 30 → 33, d750 23 → 24. Seed 7: 23 → 41, 21 → 34, 36 → 40.
    Seed 2027: 23 → 37, 33 → 39, 5 → 10. Seed 42: 28 → 93, 56 → 88, 86 → 85.
  - Idle seed 1: 16 → 39, 5 → 7, 1 → 7. Seed 7: 14 → 30, 3 → 11, 1 → 17. Seed 2027: 14 → 30, 4 → 5, 1 → 5.
    Seed 42: 24 → 92, 6 → 73, 2 → 70.
  - Epilogue misAtAsi of the leading competitor: the stand-in saturated at 0.95–1.00 on long projections; now
    0.11–1.00 (median ≈ 0.52). Near ASI (RefBot d750, 107–297 days out) it moves −0.07 … −0.28 (seed 42 +0.07).
  - Attribution: the same projection with posts only (no base steps) reproduces the old survival within ≈ 1 point on
    17 of 24 snapshots (seed 42 +6 … +23, near-ASI +1 … +4; 40-step cap) (the stand-in's rivalDriftK was fitted to WS2's post drift); the base resets (a fresh lineage's
    prior, as in play) carry the rise. Seed 42's large move is its low-difficulty world (rival Mis 0.06–0.15 now).
- **Tests:** tsc main + scripts clean. test:quick 32/34: fixtures stale (from RD-B14; fixture games stop before any
  ending, so this change cannot move them) and worldfx A2a 6.7% / W4 23.3% (known). ws4 full 25/0, control full 32/0
  (endings "no roll", every ASI ending reachable). The deep tier has no scoring / endings suite (deep = safety S5
  only), so no deep run.

### RD-B07

Safety pool claims normalised in priority order (B10 / INP-18). Commits on `p1-riv`.
- **Fix:** `safetyPoolClaims(s, extraInv?)` (departments/agents.ts) serves the safety pool in the order the code already
  implied: **monitors → investigations → safety agents → research lines**. Each claim gets min(request, what the claims
  before it leave). The monitoring budget is ≤ the pool, so monitors are never cut by others; open cases are cut pro rata
  (`invScale`); the safety agents get the rest up to their share; lines take what remains. [D] The monitors' need
  includes the monitored safety fleet, so it is taken at the agents' *granted* share (monitors do not watch compute that
  no longer runs): the agents get the largest a ≤ request with m(a) + cases + a ≤ 1, m(a) = min(budget, capabilities
  need + safety monitor cost ratio × a), in closed form (piecewise linear).
- **Readers on granted shares:** `agentSplitShare('safety')` (→ monitor need / coverage, fleets, incidents, danger
  view), `useLabour` (workfit.ts) and `safetyAgentCompute` via `safetyAgentShare`, `linePoolH100e` (= pool × lines
  granted), `monthlyGain` (case compute × invScale), the Investigate preview (its case's granted share; the cost line
  says "gets x%: the monitors come first" when cut), agendas `safetyReserved`, `safetyUtilisation`.
- **Readout for the UI (later):** `safetyUtilisation(s).compute.claims` = `SafetyPoolClaims`: per claim
  `{ requested, granted }` (shares of the pool) for monitors, investigations, agents, lines, plus `invScale`, Σ requested
  (may exceed 1), Σ granted (≤ 1). Not wired into a panel (Agents.tsx still shows the requested safety share; RD-A05a's
  flat allocation replaces this with one visible allocator, SAFETY-REDESIGN §5, which this does not contradict).
- **Neutral when nothing is cut:** fast path (budget + cases + agents ≤ 1 → requested share), and the cut-free arithmetic
  repeats monitorBudget's / the old linePoolH100e's operations, so states are bit-identical. Instrumented the cut path on
  RefBot 500–503, safe-only 700–701 and mixed 900–901 (safety-emu play) and RefBot runRef seeds 2027 / 500 to day 1000:
  it never fires (RefBot's budget + agents stay ≈ 0.2 of the pool). So S4 / S5 are unchanged by this task.
- **Probe (verify_inp13, copied to this worktree):** pool sum before 140% / 144% / 160% (days 30 / 300 / 600), after
  100% / 100% / 100%. Day 600: requested monitors 100% + agents 60%; granted monitors 72.5% (coverage 0.95 → 1.00: the cut
  agents need no watching), agents 27.5%, lines 0.
- **Regression test:** safety suite "RD-B07" (day400 fixture): default settings cut nothing; extreme settings alone,
  + a 30% case, + a 90% case: readers' H100e sum ≤ 100% and the cut shows (146% → 100%; 176% → 100% with cases kept at
  30%; 236% → 100% with cases cut to 74%, agents 0).
- **Tests:** tsc main + scripts clean. test:quick 32/34 (fixtures stale since RD-B14; worldfx A2a 6.7% / W4 23.3%, known).
  safety full 25/0: S4 RefBot 0.659, S4 safe-only 0.039, S5 RefBot below in 57% of 40 (median U − L −0.91), mixed bot
  margin 0.42 (same before and after: the cut never fires in bot play; no separate pre-change run).
  test:cal and safetyresearch full were started, then stopped under the new RD test rule (no result).
- **Moves calibration: no** (bit-identical unless the claims exceed the pool, which no bot reaches).

### RD-B11

Market fixes, interim before the product redesign (SYNTHESIS B14, B15, B16, B41, B42). Commit 158228c.
- **B14 enablers applied once, capped.** Chat: the enabler stays in the users' app choice (mix.ts, × the player's
  appeal in the logit) and is gone from revenue.ts's users. Sector products: `fOf` takes min(1 + share, 1 / player
  share), so hours, agent-hours and seats in a sector never exceed what the sector adopts. [D] Kept the old size of
  the effect (× the player's share) and only capped it; the segment reading of PRD-08 (share × the market, taken from
  rivals) and enablers as offer capabilities are RD-P07's.
- **B15 FREE_TIER_SHARE gone** (data, `freeTierShare`, its selector export). `productUses` returns the main model;
  `productDomains` returns the main model's record (callers kept). production/data.ts tests `channel === 'consumer'`
  for the free-tier token split. Chat's mini is read only by chatFreeTier (free users, their app choice, their need).
- **B16 Trusted ×3 in the offer.** `CHANNEL_PRICE = { trusted: 3 }` (data/v2/features.ts) × the tier's markup inside
  productOffer (serving.ts `channelPriceOf`), so the mix's choice and the revenue read one price; lineup rungs inherit
  it through o.price. revenue.ts's TRUSTED_PREMIUM and its two after-the-choice multiplications are gone. Trusted has
  no agent-hour or seat weight, so only the per-hour price moves. UI: the Price row adds a "Trusted access channel
  price ×3.00 → asks …" line; the lineup footer gives markup × channel price; the blurb says ×3.
- **B41 one appeal table.** `appealOf(v) = v.appeal ?? 1` (POST_PREF, V2-SPEC §3.3.2 D: minimal 0.7, engagement 1.2,
  constitution 1.0, persuasion 1.1). The market's second switch (0.9 / 1.25 / 1.15) is deleted, so non-constitution
  Chat models move further (minimal −0.2, engagement −0.05, persuasion −0.05 vs before).
- **B42 Demand modifiers row.** `demandModifiers(s, d)`: KYC, feature enablers (Chat: "app choice"; sectors: grouped
  by share with the sector names, "≤ the sector's adoption"), Restricted, No drop-in. Trusted's price left the row.
  limits.ts rule, glossary `freeTier` / `featEnabler`, the Chat mini tooltip and design/ux/GLOSSARY.md updated.
- **Tests added:** serving S6 / RD-B11 companion (target ≤ ×(1 + share), same-day users unchanged; users arrive
  through the stock); RD-B11 B15 (a Chat mini leaves the paid-share target, paying fit / coverage and bestCover
  unchanged, only the free-tier fit moves); B14 (95% share + computer use: adopted hours ≤ the sector's; uncapped would
  be ×1.07); B16 (Trusted offer ×3 price, same cost and fit); B41. products P7 now reads the preview's target users
  (the same-day demand does not jump: the effect arrives through the customer stock).
- **Readouts:** finance F8 distress-free 66.7% → 66.7% (known failure, VAL), F11 2027 $141.4B → $141.4B, F7 2026
  revenue $53.4B → $53.4B: RefBot sells no Chat features, no Chat mini, no Trusted and keeps the constitution
  preference, so its games are unchanged; fixtures did not move (fixtures passes in test:quick).
- **Tests:** tsc main + scripts; test:quick (fails only worldfx A2a / W4, known); serving full 95 / 95; finance full
  191 / 192 (F8, known); test:cal passes (golden 16 / 0, 3 WARN; calib T1 T1L T4 33 / 0, 9 WARN; games unchanged);
  npm run build + test:ui 687 / 687; lint-ux and lint-hidden pass (in test:quick). Tooltip text only: no screenshots.
- **Open:** a Chat feature's preview now shows no revenue change today (the product card's customer target shows
  the gain); the same holds for any Chat quality edit. Whether previews should show the converged revenue is a UI
  question for the product redesign.

### RD-B12

Product lifecycle fixes (SYNTHESIS B18, B19, B20). Schema 44 → 45.
- **B18 packs on the product.** `Deployment.sectorFocus` → `packs: SectorPack[]` (`{ sector, certDay }`, types.ts);
  `world.fx.certDay` deleted. A built pack is pushed onto its host with certDay = built + SECTOR_CERT_DAYS
  (departments/build.ts). Readers: productOffer reads the product's own certified pack (`packCertified`; its `certified`
  parameter is gone), Enterprise ×3 weight and incident sectors read `d.packs`, the US friction cut −0.1 and the "+ pack"
  sector check read `sectorCertDay(s, sector)` = earliest certDay among live (non-withdrawn) products (models/products.ts).
  So a retirement ends the pack's effects and frees the sector for a new pack.
- **Relaunch [D].** Only one live product per channel, so a relaunch = retire then launch on the channel. `deploy` takes
  over the packs of the latest retired product on the same channel (minus sectors a live product now holds), certDay
  kept, and empties the retired one's list (`relaunchPacks`). The launch preview's temporary product carries them too.
- **No-host completion.** A pack built with no live host (the recorded one, else any Enterprise / API / Agents product)
  refunds SECTOR_PACK_CASH ($0.4B, moved to build.ts; `PRODUCT.cash` / `days` now read the build constants) through
  bookCash ('sector product', "… (refund)") and logs a severity-2 company message.
- **B19.** `launchEffortBlock`: deep effort needs Deep think built and offered on the channel (featureToggleBlock, the
  edit path's rule); checked in product.launch's apply and in deploy (so also at build completion).
- **B20.** `launchFeatures(s, channel, effort)`: every lab-built feature the channel offers, Deep think only at effort
  deep, never the lab-level Sector packs feature. Used by the launch build completion and the launch preview.
- **Migration 44 → 45:** each product's sectorFocus → packs with the world certDay of the sector (or today if none); a
  certified sector no product carried (the B18 lost pack) is dropped; world.fx.certDay deleted; idempotent.
- **Towards DD-04 / RD-P08:** the pack is now owned by one product with its own certification day; still left for
  RD-P08: the sectorPacks feature, LEADER flags, the one-pack-per-sector world rule (sectorCertDay) and the action's
  v2 preview (B39 / RD-B20).
- **Tests added:** products RD-B12 ×7 (pack stored on host; no double pack; relaunch takes the pack over; retire →
  re-pack; no-host refund $0.4B + log; a new launch has its channel's built features on; deep launch needs Deep think);
  hygiene "schemaRev-44 save migrates to 45"; the two SCHEMA_REV === 44 asserts → 45; worldfx's sector-product check
  reads `sectorCertDay` / `packs`.
- **Moves calibration: maybe.** RefBot launches its missing channels (bots/ref.ts), which now go live with the lab's
  built features on (B20); its packs keep their effect as before. Fixture games may move; the merge regenerates them.
- **Tests run (section H test rule):** tsc main + scripts clean; products full 68 / 68 (the 7 RD-B12 checks pass);
  hygiene full 197 / 197 (the migration check) ran before the rule changed; npm run build passes. test:quick was
  stopped unfinished; test:ui not run (Products.tsx change: the pack tooltip reads `d.packs`).

### Phase 1 merge (p1-riv, p1-mkt into rd)

- **Schema renumbered at the merge:** p1-train's RD-B02 / RD-B03 migration stays 44 → 45; p1-mkt's RD-B12 pack
  migration (written as 44 → 45 above) becomes **45 → 46**, SCHEMA_REV = 46. A rev-44 save runs both in order.
  Hygiene: the SCHEMA_REV === 45 asserts → 46; the RD-B12 pack check runs on a rev-45 and a rev-44 save.
- **Conflicts:** BUILD-NOTES (all blocks kept); models/runs.ts type imports (RivalLab dropped by RD-B14, RunRecipe
  kept from RD-B02); core/save.ts and hygiene.ts (both migrations and both checks kept).

### RD-B20

Preview truth 3, products (bugs B38, B39; PRD-05, PRD-12, PRD-13). Lines with no applied effect removed; the rest come
from the function the action or the engine runs.
- **Sector pack (wfx.sectorProduct).** `productGain` (exp(1.05), 0.06, ×35, ×2.8) deleted. New `packRevenueGain`
  (worldfx/actions.ts): `revenueReadout` with the pack certified today on its host (fit bonus, Enterprise ×3 weight)
  minus without, both with that sector's customer stock removed so it reads the target shares (the stock catches up
  over CUSTOMER_TAU.sector, ~8 months; today's market). Line lag = build wait + 120 d. Removed: 15 product-team staff
  time (`PRODUCT.prodFTE` deleted) and the labour approval risk. Preview and apply share `packTarget` (sector, host).
  Not shown: the US friction cut −0.1 (acts on adoption over time, no one-number preview).
- **Product actions (models/productOps.ts).** Removed: update "−2 product team" and "lead −5 p0.5"; launch "lead −10
  p0.6", "approval −2 p0.2" and open "trust +3 academia"; retire "trust −1 p0.3"; serving "−1 Auto serving off";
  feature toggle "−1"; products policy "−1", upgrade "lead −5 p0.5", auto-evaluate off "monitorability −0.05".
  Retire now runs `previewDeployments` without the product (was −revenueRate: Auto serving moves its compute to the
  other products, so the total can even rise). Launch, update and retire add the distillation line:
  `distillDaysPerYear` = the strongest distiller's `distillationLeak` dG/day × 365 → progress-days (B_G_PER_Y),
  after − before on `hypothetical`. Open launch: the invented −60 lead days → `openAbsorbMonths` (new in
  actors/rivals.ts, the same formula openWeightsReleased now calls) × 365/12, only above the open frontier.
- **makeVariant (models/actions.ts, B38).** Preview is one new version (unit "version"), no cost; the staff +10,
  revenue +0.5, approval −1, and open's lead −60 / security −1 / trust +3 are gone (the copy charges nothing; the open
  release is the Open weights launch). RD-B19 owns models/actions.ts otherwise; only this preview changed.
- **Tests added:** products RD-B20 ×7 (pack cash / team-weeks as applied and only cash / staff / revenue lines; pack
  revenue fn = the engine's certified pack minus without; retire revenue and distillation = the same-day state after
  withdrawal; update / serving / feature / policy carry only market and distillation lines; launch team-weeks =
  queued; makeVariant charges nothing; open launch lead = openAbsorbMonths).
- **Moves calibration: no** (previews only; openWeightsReleased refactor is the same arithmetic).
- **Tests run:** tsc main + scripts clean; products full 75 / 75; npm run build passes. test:ui not run (no UI file
  changed; the "+ pack", Gov / Trusted / Open and retire buttons show the new lines).

### RD-B19

Preview truth 2, training / evals / models / leads (bugs B36, B37, B38, B40, B45; TRN-02, TRN-08, TRN-16, TRN-V03,
TRN-V04, MEA-15, MEA-19). Every line is what the action or the engine applies, or it is gone.
- **runEvals (B36).** Gains = what finishEval does (`evalGains`, models/actions.ts): one "reading" line (new benchmark
  and safety-eval scores; measured-level band now → after, from evalDepthView) and, by external evaluators while the
  eval gate is 'full + external' and the version is not yet externally evaluated, a "release check" line
  (deployments.ts externallyEvaluated). Removed: self monitorability +0.02; external credibility +2, trust +1, lead −14.
- **Stream / stop stream / IDA (B37).** New `streamRecipeGap` (models/runs.ts): today's stacks minus the track the version
  holds (startStream's start track, now `startTrack`, or the running stream's), OOM of effective compute (inPlaceRecipe's
  measure). Start: costs = pool share, engineer upkeep (UPKEEP.stream team-weeks / week), research-engineer operations
  (RE_OPS.stream teams); gain = the gap in OOM, lag 7 d. Stop: the same load freed; cost = the gap not absorbed (the
  version keeps what it has). Removed: +0.2 L / −0.1 L, monitorability ∓, alignment −0.1. The stream's trait drift has
  no one-number preview. IDA preview = runPreview on the IDA plan (planRun's pool share, not 0.3), forecast over the
  teacher; its constant alignment −0.1 is gone.
- **Run forecast (B45).** New `runForecast` (models/runs.ts): reference = the given version if measured, else the
  internal model, else the best measured live version; mid = its measured level + (predicted − its true level), band =
  ± measuredSd(reference), domains shifted alike; gain = mid − its measured level. runCard (band, domains,
  forecastRef, forecastSd), runBand (now takes s) and runPreview read it, so no card shows a true level. The engine's
  RunPrediction (true ± 0.25) is unchanged: run.predicted and the traits' predictedG read it. runPreview's
  "alignment −Σ signals, p 0.5" → a pressure line (unit 'pressure', the plan's signals, no odds).
- **A4 / E16 / C6 (B40).** New `publishLeakG`, `poachLeakG`, `ownProgressDays` (actors/rivals.ts); A4 recipients and C6
  release G / rival leaks as functions in actors/actions.ts. Apply and preview share them; lead lines = days of the
  recipient's own progress (dG ÷ its rate × B): A4 the most of any recipient, E16 that rival, C6 the best-placed rival
  plus China's openAbsorbMonths (RD-B20's open-launch line). C6's China-tension −3 removed (nothing applies it).
  Sizing still by the player's pace (MEA-15; DD-17 / RD-X04).
- **B38.** Nothing left after RD-B20 (no other variant preview lines).
- **Typed progress (MEA-19).** Split previews: compute shares in percent ('%', target names the pool group); ui.tsx /
  kit.tsx render a bare progress line as "progress", not L. A type-level rule (CostLine union) gave 10 errors, most in
  treeActions (RD-B18's), so the rule is a lint.
- **Lint (scripts/v2/lint-tradeoffs.ts).** (1) every nonzero progress line has a unit (actions, event choices, 3
  fixtures); (2) every immediate meter line (credibility, scrutiny, talent, morale, approval, trust, China tension; no
  lag, odds 1) leaves a cause on that meter when the action applies on a copy; (3) RD-B19 checks: self suite narrows
  the band to the preview; external suite meets the previewed release check; forecast = measured + step, band =
  2·measuredSd, gain unmoved by another measurement; stream absorbs the previewed gap in 42 d, stop keeps G; A4 / E16 /
  C6 lines = the applied rec.pre change in own days. Known deviations (WARN, other owners): progress unit
  research.reopen (RD-B18), safety.pledge (safety redesign); applied-effect A6 trust, safety.evalGate credibility,
  safety.publishPolicy credibility / talent (yearly flows), starHire trust (RD-B18), wfx.moonshot credibility.
  **Also found:** RD-B20 left makeVariant, product.update, product.serving, feature.toggle, products.policy with no
  cost line, failing the trade-off rule (≥ 1 cost); listed as known: a free lever needs a rule decision.
- **Moves calibration: no** (previews and readouts; the A4 / E16 / C6 / startStream refactors are the same arithmetic;
  no bot reads previews).
- **Tests run:** tsc main + scripts clean; lint-tradeoffs all passed (7 RD-B19 checks, 175 applied-effect checks);
  npm run build passes. test:ui not run (Blueprint forecast line, run-queue tooltip, Models band).

### RD-B21

Copy batch (bugs B27, B46, B47; MEA-17 glossary; SYNTHESIS §4.9 glossary entries). Every listed text now says what
the engine does; no engine behaviour changed except the manual mix range.
- **B27 (INP-21).** One constant `MIX_RANGE` = [0.01, 0.99] (departments/split.ts, was MANUAL_MIX_RANGE [0.02, 0.98]):
  the manual slider, Auto's search (production.ts bestResearchMix) and the mix chart (readout.ts, was 0.02–0.98) all
  read it. Unified to Auto's range, so Auto is unchanged; only a manual mix may now go 1 point further each way.
- **CAP-09.** Failure log and project card: "gave up after 3 weak candidates … weak results can be bad luck, so the
  direction may still work" (was "does not work in this world"). Drop / pick rules unchanged (RD-R06).
- **CAP-12.** Recipe tip: effective compute ≈ 2-week average, ideas over the last 14 weeks; softwareRate glossary too.
- **CAP-24.** Teams wanted 0 with a candidate in test: label "test only" (not "paused"); teams tip and card say the
  test keeps its engineers and compute.
- **TRN-10.** RL-focus nodes and P06: "RL gains: X in full; Y 40%; other domains 15%" (RL_TRANSFER), not v2 levels.
- **TRN-12.** T-SPEC: the 8 FTE-weeks cost is gone; the card lists what constitution does (honesty +0.05, approval
  pressure, E08 / E29 ×0.7 unless minimal alignment, best AG18 healing). P05: "Tokens ×4" (EFFORT_TOKENS.deep).
- **TRN-13.** Blueprint cash tile and Cash tip: only the science-journals mix costs cash (+5%); nothing else per run.
  `nextModelGate` (dead readout) not removed: deletion belongs to TRN-24 / cleanup.
- **TRN-23.** hardenedGraders: no `graders` option and no ▲; text points to suite hardening on the Suites tab.
- **SAF-06.** T-HARDEN and T-UNDO: no arrows, text says no effect of their own (T-HARDEN leads to T-INOC). F13: the
  Codex body says a finding with no effects has none in play. Data and IDs kept (bots/common.ts lists T-UNDO).
- **SAF-16.** Line Health tip adds that the same hidden efficacy sets tool strength and gates some results.
- **SAF-21.** Codex agenda row "Compute share 3–8%" → "Reference compute N H100e (a unit, not a share)"; line tip:
  teams speed candidates with diminishing returns, engineers and compute the experiments (not "√ capacity"); ETA tip:
  "teams, engineers, compute and AI labour" (not "research speed"). `computeShare` state left (RD-C05).
- **PRD-17.** Safeguards tip: quality costs in OOM from SAFEGUARD_DG (−0.04 / −0.17), not "−0.05 L / −0.2 L".
- **MEA-17.** Glossary L: true level plus eval noise; sandbagging lowers dangerous benchmarks, not the level.
- **Glossary (§4.9).** rdmult (three parts; ideation AI labour not in M), researchMix (Auto maximises experiment
  throughput; chart peak can differ), trustedToAI (lines and investigations, no "funded"), seriousStaffing (no √),
  autoAssign (days cut, line joining and queueing), idaCycle (one more RL budget, 0.15 × base FLOP), stream (the last
  reading goes out of date). design/ux/GLOSSARY.md regenerated.
- **B46 (MEA-22).** EndScreen table: in-game MILESTONE_NAMES, the AI 2027 column shows the canon date with its canon
  name (idx 2: "Online Learner" is a different event). **Left for DD-09:** day-0 milestones still come from the λ rule
  (MEA-V01).
- **Also fixed:** RD-B19's Blueprint forecast band (±sd L) had no tooltip, failing lint-tips; now a Measurement-band tip.
- **Moves calibration: no** (copy; the mix range widens only the manual slider; Auto's search range is unchanged, and
  bots use Auto).
- **Tests run:** tsc main + scripts clean; lint-ux all passed; lint-tips 0 failing; npm run build passes.

### RD-B08

Research-engineer allocation (SYNTHESIS B11; INP-02, INP-V01). Commits ba0776b (engine, research suite, copy), 71c0b53
(evals EV3). Interim per DD-12: headroom stays; RD-E03 removes it.
- **Tuning demand:** `reDemand.tune = TUNE_RE_PER_OOM × headroomTotal(s)` (stacks.ts: Σ stacks' headroom at the
  reference run FLOP). [D] TUNE_RE_PER_OOM = 100 (one team-equivalent per 0.01 OOM; about the 2.5–4 teams tuning held
  mid-game on ai2027 when unlimited). Human team-equivalents, not ÷ m_EXP (as the experiments need). Spare research
  engineers are idle (reAllocView already shows idle).
- **Served after the projects:** DEFAULT_RE_ALLOC loses `share: { exp: 0.75 }` (that cap is what starved the 7th project,
  INP-V01). [D] The player's order and caps still apply (research.reAlloc); tuning is last only by default.
  **Open:** existing saves keep their stored `share.exp 0.75` (no migration, no schema bump); the player can clear it in
  Company › Work, or a later bump drops it.
- **FLOP by need:** new `expShares(alloc, avail)`: the pool is divided over the demands (RE_PER_PROJECT per project in
  experiments + tuning's demand); a project with any research engineers takes a full share; tuning takes the rest
  (including the shares of projects with none). [D] A project short of RE_PER_PROJECT still gets its full FLOP share
  (FLOP does not follow headcount). The unit project's inputs (`last.x`, line batching) use
  max(units, RE_PER_PROJECT), i.e. a full project's share. `experimentRate` extracted from stepProject (shared with the
  test).
- **Readouts:** `research.last.flopProj` (new optional readout field; researchView's project FLOP and c read it; c no
  longer scales with a project's research engineers). Deviation [D]: production.ts's M proxy keeps h = research
  engineers not on ops / evals (idle included), i.e. what exp + tune held before, so M and its readers (non-line safety
  nodes, gov, previews) do not move (→ RD-R01 / RD-R04). Copy: glossary routineTuning / expCompute / reNeeds, Work.tsx
  overflow tip; GLOSSARY.md regenerated.
- **Probe** (`%TEMP%/ai27ux/probes/rdb08/probe.ts`, RefBot ai2027 seed 2027, +1 / +3 RE teams at days 30–600):
  - Before: day 600 seven projects in experiments, P05 at 0 RE while tuning held 3.94 (day 450 too); tuning took 22–81%
    of experiment FLOP; saturated projects ×0.965–0.977 (+1 team), ×0.907–0.937 (+3 teams).
  - After: no experimenting project at 0 RE while tuning holds any (0 of 5 checkpoints); day 30 8.3 RE idle and tuning
    0% of FLOP (no headroom); day 300 tuning 1.4 of 5.98 wanted (projects first); per-project FLOP flat with +RE; worst
    rate ×0.998 (+3 teams, day 600). That 0.2% is m_EXP = L/H spreading the same AI labour over the extra idle humans
    (workfit labourOf), not the allocation: with m_EXP held the ratio is ×1.000. Left for DD-11 / DD-13.
- **Tests:** research suite +3 checks (tuning demand ∝ headroom; tuning only after every project is full over 15
  capacities; +RE never lowers a project's RE, FLOP (exact) or rate (≥ ×0.995, the m_EXP note); tuning takes the FLOP
  projects leave, no headroom → no tuning and idle engineers); the overflow check now expects tuning up to its demand
  and the rest idle; evals EV3's order check reworded (behind tuning, evals get what it leaves). tsc main + scripts
  clean; research full 33/33; evals 30/30; test:quick 31/34 (fixtures stale ×5, worldfx A2a 6.7% / W4 23.4%: known; no
  fixtures committed); lint-ux clean.
- **test:cal: 47 pass, 2 FAIL** (9.1 min, load 95%). T1 20-seed medians, Δ vs golden in years (M11 in brackets; Phase
  0 was behaviour-neutral):

  | preset | SC | SAR | SIAR | ASI |
  |---|---|---|---|---|
  | ai2027 | +0.001 (0.000) | −0.086 (−0.079) | −0.086 (−0.078) | −0.049 (−0.010) |
  | authors2026 | +0.036 (+0.052) | −0.090 (−0.030) | **−0.270 (−0.045) FAIL** | **−0.487 (+0.004) FAIL** |
  | fast | +0.011 (+0.022) | +0.099 (+0.096) | −0.007 (−0.022) | −0.085 (−0.103) |
  | slow | +0.049 (+0.049) | | | |

  T1L (leader lab) unchanged: authors2026 SIAR / ASI WARN −0.74 / −1.49 y as M11. **Stop rule reached:** authors2026 ASI
  is 0.37 y past its ±44 d tolerance and no value is named for a refit, so nothing was refitted.
- **Mechanism** (`probes/rdb08/late.ts`, RefBot authors2026 seed 2027): the slow world's lab has far more research
  engineers (22–28) than its 5–6 experimenting projects need (10–12), and post-SAR headroom is small (0.006–0.019 OOM →
  tuning wants 0.6–1.9). Under the headcount split tuning held 50–64% of experiment FLOP from day 900 (the projects'
  share 22–50%); by need the projects get 87–94%. After SAR the projects are compute-bound (m_EXP 600–260 000), so
  roughly ×2 FLOP per project shortens SAR → SIAR → ASI. ai2027's lab is short of research engineers, so it barely
  moves. This is the fix working (DD-12: "research gets slightly faster (refit)"). For the lead: refit authors2026's
  post-SAR pace (the preset's G_SC / CAL_SHIFT-type values, not named here), or accept and restate; TUNE_RE_PER_OOM is
  [D] and also sets tuning's FLOP share (∝ √K at equilibrium), but tuning it to the dates would be a forcing refit.

### RD-B09

One owner for run operations (SYNTHESIS B12; CAP-23, CAP-V1, INP-17; DD-11 sub-call). Commit 0531318.
- **Engineers:** the 'runs' need is run setups, research adoptions and eval harness work (`engDemand.runs = 7 ×` queued
  stack work). Removed: the run / stream upkeep lines, `runOpsTW`, `isRunLine`, `UPKEEP.runBase / runMid / runSmall /
  stream`, `upkeepSplit().runs` (selectors re-exports too). buildRates / buildSystem no longer subtract run ops.
- **Research engineers:** `opsServed(alloc)` (research.ts) = re.ops ÷ demand.ops (1 with no need, 1e-3 rounding), stored
  as `research.last.opsServed` (new optional readout field; no schema bump: absent → 1). The research system (35) writes
  it before runs (40): `run.flopDone += share × rate × opsServed`; runEtaDays uses the same factor. [D] The stream's
  tracking rate (advanceStream) is × opsServed too (its RE_OPS.stream is part of the ops need). [D] A slowed run keeps
  its pool share (the compute sits idle: lost goodput), so it does not flow to experiments.
- **Kept [D]:** RE_OPS sizes (base 1, mid 0.5, small 0.2, stream 0.5 team-eq ÷ m_EXP). The engineers' version scaled a
  base with √(FLOP ÷ 1e27); that size scaling is gone, not moved. Open: give RE_OPS.base the √ scale if run size should
  cost operators (it would grow late-game ops 3–10×, mostly cancelled by m_EXP).
- **Readouts / copy:** runStall says "slowed to N%: too few research engineers on run operations" (Models run row,
  Blueprint gantt); Work › research engineers' ops tooltip adds "Runs train at N%"; ops' term → `runOps`, engineers'
  runs need → "Setups & adoptions" / ENG_NEED_LABEL "Run setups, research adoptions, eval harness"; BuildLoad drops the
  runs segment and run lines (footer points to research engineers); glossary runOps / reNeeds / engNeeds / buildQueue
  rewritten; GLOSSARY.md regenerated.
- **Probe** (`%TEMP%/ai27ux/probes/rdb09/probe.mts`, RefBot seed 2027, days 60–800): opsServed = 1 at every checkpoint
  in ai2027, authors2026, fast. The engineers' removed run load was 0–3.2 t-wk/wk; on authors2026 / fast early (cap
  4.4–4.9, util 0.90–0.98) that is about a fifth of capacity now free for product upkeep and builds.
- **Tests:** research full 36/36 (+3: engineers' runs need = queued stack work, no run / stream upkeep line; with half
  the ops need served a run trains ×0.5000 a day and says "slowed"; RefBot's ops served 1 on all 185 run-days to day
  240, ai2027). tsc main + scripts clean. No other tier run (RD test rule).
- **Moves calibration: maybe.** Capability dates: probably not, since RefBot's research engineers serve run ops in full
  (no run slows) and setups were already first in the engineers' order. Finance / products: maybe, in the tight worlds
  (authors2026, fast) where engineers ran at 90–98% and about 1 t-wk/wk of run ops now goes to product upkeep and
  launches / features, so revenue and anything downstream of shipping can shift. Fixture hashes change (new readout
  field and engineer allocation). test:cal and the finance tier should be re-reported at the merge.

### RD-B16

One capability currency for recipes; Software progress from the lab's own research (SYNTHESIS B23, B24; CAP-06,
CAP-V2, CAP-12 seed part). Commit bad7924.
- **B23 (one recipeG):** `stacks.ts recipeG(rec, F = RECIPE_F)` = pre + refRlGain(F, mid, ceil) − refRlGain(F, 0, 0),
  `RECIPE_F = FLOP_RL_REF` (3e26, fixed: a comparison never moves because a lab trained a bigger base). Parts = the
  ones every lab has (pretraining, RL efficiency, RL ceiling); the player's training-throughput stack is left out
  because rivals have none (they train at the fixed MFU × GOODPUT). `playerRecipe(s, F)` (pre stack at F) /
  `playerRecipeG(s)`; rivalModel `recipeOf` and `recipeRates` call recipeG (`gEquivOfRecipe` deleted; rival values
  bit-identical). Callers moved: theft.ts secretsLeakDaily (China gap, also security.ts's daily leak) and actions.ts
  A4 (which rivals are behind). rivalFinance (rival vs rival) was already one unit. Diffusion (production.ts) compares
  model G, not recipes: RD-X04's.
- **B24 (gRate):** `research.ts softwareProgressDay` (called at the end of capResearchDay, exported for tests): Δ of
  `researchG(s, F)` = ownRecipeG − pre.base (public knowledge lands only in the pretraining base and enters G linearly,
  so it drops out exactly) between research days, both ends at the earlier day's base FLOP (`gLastF`, new optional
  field): a new base changes F only for the next delta. Adoptions (build system, order 38) and tuning count. [D] F is
  the lab's latest base, not RECIPE_F: a rival's pre increments are realised at its own base (κ), so the lab's own
  scale is the closer match for a rate; the rate is a different quantity from the cross-lab level. Old saves: gLast
  without gLastF is skipped once (it held the whole G).
- **Public knowledge readout:** `pubLast` / `pubRate` (Σ stack bases, 14-day average of its daily change: diffusion,
  C4 tacit knowledge, spillover). softwareRate → `publicPerYear`; Recipe header "· +x OOM/yr public" when ≥ 0.005,
  tooltip row "Public knowledge"; glossary `publicKnowledge` (new), `softwareRate` body says what counts; GLOSSARY.md
  regenerated. hist / stacksGEquiv (level at the latest base, with public and throughput) unchanged.
- **Seed kept:** START_G_RATE is the 14-day average's warm-up so day-0 pace is not 1 − share (lead conversions, A4 /
  C4 sizes move without it), not a mask for the jump (the jump is gone). Documented at tree.ts. It decays to the
  measured rate (≈ 0.1 OOM/yr at day 28) within a month either way.
- **Probe** (`%TEMP%/ai27ux/probes/rdb16/probe.mts`, RefBot seed 2027, days 0–700): leader starts (ai2027, authors2026,
  fast) read as before except in the month after each of the 3 base changes (old 1.01 vs new 0.73 OOM/yr at d400 and
  3.24 vs 2.03 at d600, ai2027). The challenger (diffusion) read far faster before: d100 0.61 → 0.00, d200 3.13 →
  0.60, d500 2.61 → 1.30 OOM/yr (public inflow 0.6–2.2 OOM/yr now shown apart). Recipe at RECIPE_F vs the old latest
  base + throughput: 0.0–0.3 OOM lower by d700 on leaders (ai2027 2.11 vs 2.41), 1.0 lower on the challenger; China's
  recipe is at or above the player's for most of these runs, so the secrets leak is often 0 either way.
- **Tests:** research full 42/42 (+6: a 30× base moves G at the latest base by +0.11 OOM and Software progress not at
  all; a 0.05 OOM diffusion inflow leaves it unchanged and adds dG/14 to the public readout; an adopted idea adds
  x(1 − HEADROOM)/14; equal player / China recipes have zero gap whatever the base or throughput stack and a bigger
  base leaves the secrets leak unchanged; a challenger's first 200 days put +0.44 OOM into public knowledge with
  Software progress 0.60 vs the old measure 2.76 OOM/yr). tsc main + scripts clean. No other tier (RD test rule).
- **Moves calibration: maybe (likely yes for follower starts).** gRate → production `rate` → paceOf (lead days, A4
  leak, C4 tacit-knowledge size) and lead readers. Leader starts: small and transient (a month after each new base the
  pace was inflated; now not), so capability dates probably hold. Follower starts: the pace no longer counts
  diffusion, so their `rate` is much lower while catching up: lead conversions in days, C4 sizes and any reader of
  rateOf('player') change. Leaks: the player-vs-China gap drops the throughput stack and is at 3e26, so it is smaller
  (fewer secrets leaks to China, wherever the player is ahead). Fixture hashes change (new readout fields, the rate).
  test:cal and the golden timelines should be re-reported at the merge.

### RD-B17

Research readouts, honest Recipe tab (SYNTHESIS B28, B29, B30; CAP-03, CAP-11, CAP-V3). Commit 33db305.
- **B28 (units):** STACK_GROUPS deleted; `stackViews` returns one `StackView` per stack key (pre, rlMid, rlCeil, train,
  serve) with `unit` (data/v2/research.ts STACK_UNIT, read after "OOM"), its own headroom / not-trained-in (pre, rlMid,
  rlCeil only); Recipe.tsx shows five stack cards and a "Domain & data effects" card, no sums in the panel. Domain and
  data effects push `res.adopted` entries with `kind: 'domain' | 'data'` (no `stack`; AdoptedIdea.stack now optional,
  `b` = batch size); `otherEffectViews` lists them with rows in their own units (domain: est/true × weight, OOM for new
  versions; P10 quality ceiling "web text = 1"; P21 OOM token worth; P12 B tokens). Old saves' domain entries with
  `stack: 'pre'` are read as domain effects (the tree node has no stack). Label "true effect"; its tooltip names the
  model ("Seen in V5's evaluation…") or says which model would reveal it. Glossary: new `oom`, `otherEffects`;
  `realisedEffect` retitled "True effect"; `knowHow`, `recipeStack`, `stackEfficiency` say each stack is its own unit.
  GLOSSARY.md regenerated.
- **B29 (counts):** `addIdea(st, x, sx, fTest, count = 1)`; completeAdoption passes `r.c.b` and 0 for `also`. Readers of
  `st.n` / hist n (softwareRate ideas/yr, Blueprint adoptedDuring) are readouts. [D] Count = Σb (all ideas in the batch,
  not the expected survivors). Domain and data ideas are not in the stacks' count (tooltip says "into the stacks").
  Existing saves keep their old counts (a one-off mixed hist window).
- **B30 (who reveals):** new optional `ModelVersion.trained = { rlDay, post }` (readout only): post-training runs set
  rlDay = launch day (frozen recipe; today if the run predates frozen recipes), post true; amplify (IDA) post false;
  distills / imports none. `revealedBy` by EMBODIED_BY: pre = a base started after (as before); rlMid / rlCeil / expert
  data = rlDay after; serve / domain = a post-trained version finished after (serveTechMult and domainG are read at
  post completion; IDA and distills copy the teacher's); train = either a base started or an RL launch after;
  P10 / P21 = a base finished after (draw read at completion). Versions without `trained` (older saves) count if
  variant 'full' and v.day after (old rule minus minis). Streams do not reveal (the stream's model was evaluated before).
- **Moves calibration: no** (readouts only; new state fields `trained`, `kind`, `b` and the n counts change state
  hashes, not behaviour). No schema bump (all optional).
- **Tests:** tsc main + scripts clean; scripts/v2/research.ts all pass with four new RD-B17 checks (P16 counts 1 and a
  batch of 3 counts 3; P09 / P10 not under a stack, own units; one card per stack and no `.reduce(` in Recipe.tsx; a
  mini or an earlier-launched post-train does not reveal an RL idea, a later one does and is named). lint-ux --doc run
  to regenerate GLOSSARY.md (it passed). `npm run build` ok. No other tier (RD test rule). Not screenshotted.

### Phase 1 merge (p1-res into rd)

- **Schema:** none. RD-B08 / B09 / B16 / B17 add only optional fields (`ModelVersion.trained`, `AdoptedIdea.kind` /
  `b`, `research.last.opsServed` / `flopProj`, `gLastF`, `pubLast` / `pubRate`); SCHEMA_REV stays 46.
- **Conflicts:** runs.ts completeRun reads RD-B02's snapshot (`pr`, serve × 10^−serveOom) and sets RD-B17's `trained`;
  actions.ts keeps RD-B19's `publishRecipients` (preview and apply) on RD-B16's `playerRecipeG`; researchView /
  Recipe.tsx / glossary take RD-B16 / B17's text with RD-B21's "ideas over the last 14 weeks"; types.ts both comments;
  GLOSSARY.md regenerated (`lint-ux --doc`). In the merge too: RD-B19's stream preview lost its engineers' upkeep line
  (`UPKEEP.stream`, deleted by RD-B09).
- **Fixed after the merge:** RD-B17's `revealedBy` read serving, domain and data effects at completion; under RD-B02
  they are frozen at launch, so serving / domain = a post-training run (not amplify) launched after (`trained.rlDay`),
  data (P10 / P21) = a base started after (`baseDone` removed); realisedEffect copy follows. Glossary roleEng: "run
  setups", not "training runs" (RD-B09).
- **Tests:** tsc main + scripts clean; research full 46/46; hygiene full 199/199; lint-ux / lint-tips clean; build ok.
  No other tier (RD test rule).

### RD-B18

Preview truth 1, research and people (bugs B31–B35; CAP-16, CAP-21, SAF-13 effort part, INP-13, INP-14, INP-25,
INP-V03). Every listed preview is the mechanism run on a copy, or the one function the engine's readouts use.
- **B31 one effort, one ETA.** `effortOfNode` (models/research.ts): capability projects = PICK_AT × stagesOf.idea science
  team-months + small + scale experiment team-months (P13 39.8 + 55.7, not "25"; a line 1.6 + 1.8 per result, not
  "3"); a safety research line = T₁ months at serious staffing (ideas + tests; not T₁·√4 team-months); other projects
  (kyc, P27) their rolled team-months. `effortClassOf` = the class of that sum (S ≤ 6, M ≤ 12, L ≤ 24 TM; lines keep
  their agenda class): P13 shows XL, unfitted ideas (stagesOf's default 8 TM) M. Readers: nodePreview / reopen costs,
  tree effort tip and dots, node card, Codex "Effort" row, glossary effortClass. `capEta` (models/research.ts) is the
  one capability ETA (capProjectView's formula, extracted, with `projectExpInputs`): capProjectView, projectEta (tree,
  Assign / Take off, teamGain) read it; projectRate's rough capability branch (2 candidates, no taste / speed / batch)
  and `sciAiMult` are gone. `projectEta(s, id, staff)` takes a capacity or `{ add | remove }` team. [D] Inputs read the
  allocation the next research day runs (`reAllocation`), not yesterday's reProj: a project in tests with no research
  engineers now reads Infinity (it waits), where it read 29 days (P05 at day 400); a project not yet testing is read at
  RE_PER_PROJECT as before. Node-card tip drops "progress ∝ √capacity" for safety lines (their pipeline is not √).
- **B32 hire previews.** `readDay` (departments/teamActions.ts): one engine day (`core/previewTick.ts`, registered by
  core/loop.ts with endings skipped, so action modules need not import the loop) on a structuredClone with the team full
  and arrived, against the same day without it (memoised per state, day and staffing; ~25 ms a read). `effectLine`
  in the team's own currency: engineers build capacity (team-weeks / week, with AI); capability teams the project whose
  ETA moves most (days; "gets going" / "stalls" when it starts or stops; research engineers no project needs → routine
  tuning team-equivalents); safety teams results / yr across the lines. Hire, Let go (arrived teams only), Move (loss in
  the old department, gain in the new, one copy), Keep hiring (n teams) and Star hire (one more star) use it. Gone:
  "taste ±0", the elasticity "%", "+N safety staff". Company GainChip shows the line (target in the tip). Day 400: eng
  +5.59, re.cap 2 d, sci.cap 0 d (every project is in tests), sci.saf +0.24 results / yr.
- **B33 agents.set.** Constant "security −0.05" removed (nothing applied it). Build capacity before → after
  (agentsView.build) is a line, so a routine / frontier compute change that re-normalises the engineering share shows
  its build cost; a change with no cost shows "no compute taken from another use" (0 H100e). m_IDEAS not shown (INP-03
  proxy left to RD-R01).
- **B34 star taste.** One factor `starTasteOf(stars)` (data/v2/teams.ts) = min(1.5, 1 + 0.05 · stars); research's
  `starTaste` and the bench `tauH` both call it; STAR_TASTE deleted. Chip: "star taste ×…", tip says stars multiply
  every capabilities science team's human taste (+0.05 each, up to ×1.5); "from quality" gone. Safety teams still get
  no star factor (open design question, INP-14).
- **B35 research actions.** Reopen = nodePreview of the speculative attempt (prior at spec + 1, its odds), not +0.05;
  Research risk = the pick rule (mean ± κ × spread) with zero-amount lines, no κ as progress; Auto-assign counts the
  safety scientists autoAssign places on a copy (idle capability teams excluded; off: idle safety scientists wait);
  Reorder runs moveInQueue + assignCapNow on a copy and lists each capability project's ETA change (all capability
  teams are re-planned, not "idle teams follow"); Assign / Take off use `etaChange` (no 9999 for a stalled project).
- **Tests added:** research +6 (effort from stages; one ETA = card, and one engine day takes one day off it at that day's
  inputs, 6 / 6 projects; Assign / Take off = a copy with the team moved; Reorder = the re-plan on a copy; Auto-assign =
  safety scientists placed on a copy; Reopen = the reopened copy's preview, risk has no κ line). worktypes +7 (days 400
  and 900: each of the five hire previews = one full tick on a copy with the team, exact; Star hire = a tick with one
  more star; agents.set has no security line and its build line = buildCapacity of the applied copy; one star-taste
  factor for 0–14 stars and the chip text). lint-tradeoffs: research.reopen's known deviation removed (passes).
- **Moves calibration: no** (previews and readouts; projectRate's capability branch was readout-only; starTaste's cap at
  1.5 is unreachable because the Star hire gate stops at 1.5; no bot reads previews).
- **Tests run:** tsc main + scripts clean; research full 52 / 52; worktypes full 23 / 23; lint-tradeoffs all passed;
  lint-ux --doc (GLOSSARY.md regenerated, passed); npm run build ok. test:ui not run (Company chips, Research tree tip /
  card, Codex row changed). Left: starHire's rival-cooperation line is still a `trust` line (lint PENDING).

### CP1

Checkpoint 1 (end of RD Phase 1) on `rd` 36d773d + a1d228f (fixtures regenerated), 2026-11-22, machine otherwise idle.
Outputs: %TEMP%/ai27ux/tests/cp1-full.txt, cp1-deep.txt; logs cp1logs/ (Phase 0 logs kept in prelogs/).
- **tsc** main + scripts clean. **Fixtures** `--write`: all five rewritten, committed a1d228f (20 s).
- **test:full: 29.4 min wall** (cpu 162 min, load 75%; Phase 0 58.2 min under load), 30/35 scripts, **3025 passed,
  8 failed**; test:ui 685 / 687. **test:deep: 8.0 min** (cpu 44 min), 27 passed, 1 failed (Phase 0 23 / 1; +4 RD-B07
  checks).
- **Check counts that moved (new task checks, no failure):** data 61 → 65, suites 30 → 37, research 29 → 52, worktypes
  16 → 23, hygiene 196 → 199, products 61 → 75, serving 90 → 95, rivals 16 → 17, safety 21 → 25 (RD-B07);
  lint-tradeoffs 464 → 1062 with 34 WARN (RD-B19's new lint; the WARNs are its listed known deviations: A6 / starHire
  trust, safety.evalGate / publishPolicy credibility / talent, wfx.moonshot, safety.pledge unit, and RD-B20's five free
  levers).

| Item | Phase 0 | CP1 | Attribution | Class |
|---|---|---|---|---|
| finance F8 distress-free 2026 | 66.7% | 66.7% | – | baseline |
| worldfx A2a / W4 | 6.7% / 23.3% | 6.7% / 23.4% | W4 +0.1 pp: RD-B02 (its notes already 23.4%) | baseline |
| deep S5 sabotage (b) believed − true U | −0.37 ± 0.45 se | −0.09 ± 0.51 se (2.32 vs 2.41) | within noise | baseline |
| calib T1 authors2026 SIAR | 2134.5 d (−0.05 y) PASS | 2041.5 d (−0.30 y) **FAIL** | RD-B08 (p1-res alone 2052.5; RDB08-CAL) | calibration → CP2 |
| calib T1 authors2026 ASI | 2976.5 d (0.00 y) PASS | 2823 d (−0.42 y) **FAIL** | RD-B08 (p1-res alone 2797; RD-B02 +0.12 y offsets part) | calibration → CP2 |
| ws4 E1 all actions pass the trade-off lint | pass | **FAIL** (makeVariant, product.update, product.serving, feature.toggle, products.policy) | RD-B20 left them with no cost line; RD-B19 notes list it ("a free lever needs a rule decision") | test outdated by RD-B20 / design rule decision |
| ui "Research: recipe shows three stacks and the software rate" | pass | **FAIL** | RD-B17 (B28): five stack cards + `stack.other`; the check counts 3 `data-home^=stack.` | test outdated by RD-B17 |
| ui "J2 P1: the build tooltip splits runs, product upkeep and builds" | pass | **FAIL** | RD-B09: BuildLoad has no runs segment (run ops moved to research engineers) | test outdated by RD-B09 |
| calib T1 ai2027 SC / SAR / SIAR / ASI | 638 / 762 / 854.5 / 911.5 | 667 / 766.5 / 865 / 920.5 (SC +29 d at the ±29 d edge, PASS) | RD-B02 (its own test:cal: +0.075 / −0.078 / −0.041 / +0.029 y = the CP1 deltas); p1-res alone 638.5 / 759.5 / 851.5 / 897 | calibration → CP2 (watch SC) |
| calib T1 fast SAR / ASI; authors2026 SC / SAR | 915 / 918.5; 1514 / 1562 | 921.5 / 926; 1505 / 1540 | RD-B02 (fast) and RD-B08 (authors2026 SAR); all PASS | calibration → CP2 |
| calib WARNs (T1 A1 / A2, T1L authors2026 SIAR / ASI −0.74 / −1.49 y) | 9 | 9, T1L unchanged; fast A2 463 → 443, slow A2 3558.5 → 3432 | A2 rows: p1 merges, not bisected | calibration → CP2 |
| calib T3 China mean lead before theft (INFO) | 149 d | 174 d | p1-res alone 138 d; rest p1-train / riv / mkt with p1-res (RD-B16 secrets-leak gap at RECIPE_F likely); not bisected | calibration → CP2 |
| safety S4 RefBot P_mis at ASI | 0.670 | 0.601 (PASS, band 0.55–0.85) | p1-res alone 0.647 (RD-B08 −0.016, RD-B16 −0.007); p1-riv 0.659 (RD-B07 notes); the rest −0.05 p1-train / p1-mkt and their interaction with p1-res, not split (run stopped) | calibration → CP2 |
| safety S4 safe-only | 0.037 | 0.050 | as S4 | calibration → CP2 |
| safety S5 RefBot U < L by SAR | 60%, median −0.57 | 68%, median −1.09 | p1-res alone 68%, −1.44 (RD-B08) | calibration → CP2 |
| safety S5 mixed-bot min margin | +0.42 (65%) | −0.10 (60%), PASS (bound −0.5) | p1-res alone −0.04 (RD-B08) | calibration → CP2 (watch: margin near the bound) |
| deep S5 neuralese / half staff | −3.54 / −2.18 vs −0.77 | −4.71 / −3.31 vs −1.14 | follows S5's base shift | calibration → CP2 |
| safetyrates WARNs F5 EA / F6 | 52.9% / 71.1–74.3% | 53.9% / 71.1–74.4%; S4 INFO 0.516 → 0.565 | small; p1 merges | calibration → CP2 |
| finance FIN3a end-2027 board confidence (INFO) | 59.1 | **50.1** (below the design target 55) | p1-res alone 56.5 (RD-B08); the rest p1-train / p1-mkt (RD-B12 RefBot channel launches / RD-B02) with p1-res, not split | calibration → CP2 (design target missed) |
| finance F7 2026 revenue / F11 2027 / end-2027 valuation | $53.4B / $141.4B / $3.78T | $54.0B / $136.3B / $4.47T; worldfx F4 20-seed 2027 revenue median $136.9B → $151.4B | p1-res alone $52.8B / $134.3B → $138.9B, $3.61T → $4.58T (RD-B08, then RD-B16); all PASS | calibration → CP2 |
| golden-timelines (3 v1 WARNs) | – | unchanged | – | baseline |

- **Bisect (temporary worktree %TEMP%/ai27ux/wt/cp1b, calib + safety + finance at full tier, ~24 min a point):**
  ff85b51 (RD-B08), 0531318 (RD-B09: identical to RD-B08 on every key value, so RD-B09 is neutral on these), bad7924
  (RD-B16). Note: p1-res branched from the Phase 0 tip 1a25b28, so these three points are p1-res **alone**, not on
  p1-train / riv / mkt; the 49b2f6e point (p1-train + riv + mkt) was stopped by the lead, so the S4 / FIN3a remainder
  is not split between p1-train, p1-mkt and the merge.
- **Seed-2027 fixture probe (player SC / SAR / SIAR, `fixtures.ts`, 20 s a commit):** Phase 0 590 / 735 / 825; 49b2f6e
  591 / 735 / 829; RD-B20, RD-B19, RD-B21 commits on p1-wb all 591 / 735 / 829 (p1-wb neutral: "moves calibration:
  no" holds); p1-res RD-B16 and RD-B17 tips 585 / 720 / 824 (RD-B17 neutral); merge 3b516e5, post-merge fix 38f3d39
  and RD-B18 8c2a541 all 586 / 724 / 870 (post-merge fix and RD-B18 neutral). The merged seed-2027 SIAR (+46 d vs either
  side alone) is an interaction of p1-train / mkt with p1-res (single seed; the 20-seed ai2027 SIAR moves +11 d only).
- **Real bugs: none found.** Every value change traces to a task marked "moves calibration: yes / maybe" (RD-B02,
  RD-B08, RD-B16, RD-B12 / RD-B03 untested) or to the merge of those branches; tasks marked "no" (RD-B07, RD-B17,
  RD-B18, RD-B19, RD-B20, RD-B21, RD-B09's capability dates) did not move the probes. The three test failures are
  checks outdated by RD-B09, RD-B17 and RD-B20 (fix the checks, or for ws4 E1 decide the free-lever rule).
- **For CP2:** refit / restate authors2026 SIAR / ASI (RD-B08), ai2027 SC +29 d at the tolerance edge (RD-B02), S4
  0.601 near the band floor 0.55, S5 mixed-bot margin −0.10 vs the −0.5 bound, FIN3a 50.1 below its target 55.
- **Left over:** worktree %TEMP%/ai27ux/wt/cp1b (detached at 49b2f6e) was not removed (the removal command was denied
  by the permission classifier). It holds a `node_modules` **junction** to AI27-rd/node_modules: unlink it first
  (`cmd /c rmdir …\cp1b\node_modules`), then `git worktree remove --force`, or the real node_modules may be deleted.

### RD-U03

- **What:** safety tool half-points are OOM literals: `oHalf` per agenda in data/v2/agendas.ts (M½ 25 → 4.218, 30 →
  4.678, 250 → 10.018, 2000 → 13.788, never = 1e9) and `AG09_LATENT.oHalf` 2.492; the decoy-tool floor in
  safety/findings.ts is 4.218 (SAR). Deleted REF_M_LEVEL, refPathWorld, refMOomTable, oomOfRefM, agendaOHalf and the
  `mHalf` fields. F21 / F30 were already OOM deltas (−1.11 / −0.82), unchanged.
- **Checks:** tsc (app and scripts/v2) clean; probe %TEMP%/ai27ux/probes/rdu03-check.ts: every agenda's oHalf equals
  the old computed value (±0.001). scripts/v2/oversight.ts: the M → OOM table check is gone; the half-point check reads
  the literals.
- **Moves calibration:** no (values identical up to 3-decimal rounding).

### RD-U04

- **What:** data constants written in progress-years are OOM literals (value × 1.2, comment "was X progress-years"):
  START_PUBLIC_GAP_Y 0.15 → START_PUBLIC_GAP_OOM 0.18 (also the two inline 0.15·B public-model gaps in china.ts /
  rivals.ts); world.ts `chinaGapYears` 0.6 → `chinaGapOom` 0.72; P24 0.8 → 0.96; RUN_PENALTY_Y 0.02 → RUN_PENALTY_OOM
  0.024 and FOOTHOLD steeredSuccessor `progress` 0.02 → 0.024 (the `runPenalty` flag is now OOM; the patch cost line
  reads "−0.024 OOM of G"); SPILL_G 0.024; FREE_TIER `{ years: 1 }` → `{ oom: 1.2 }`; distillation threshold 0.00048;
  epilogue pace floor 0.36; theft clamp 3.6; start-lineup clamp ±24; fallback openWeightsG g0 − 1.2.
- **Not converted (runtime, RD-L03's):** the C4 / poach / publish leak sizes are days × `paceOf`·B (the B converts the
  runtime pace, not a data constant). Remaining B_G_PER_Y readers: actors/actions.ts (openReleaseG, C4, China
  knowledge), china.ts (intel start estimate chinaGapOom ÷ B), intel.ts, rivalModel.ts (`B`, prodCache rate), rivals.ts
  (rate0, leadBetween, release lag, publish / poach leak, ownProgressDays, open-weights absorb), bots/ref.ts:84,
  core/init.ts (follower lagY, initialStacks), limitsView.ts, epilogue.ts (pace), capability.ts (startVintage,
  preGameRate), productOps.ts:193, tree.ts (re-export), production.ts:180, theft.ts:81.
- **Checks:** tsc (app and scripts/v2) clean. fixtures.ts with and without the patch: the same 5 stale-fixture
  failures (already stale since RD-U03) and the same seed-2027 player SC / SAR / SIAR days (586 / 724 / 870).
  3 × 1.2 = 3.5999999999999996 vs the literal 3.6 is the only last-digit difference (theft clamp). Old saves with a
  pending run penalty would read it as OOM (×1/1.2 too small).
- **Moves calibration:** no.

### RD-U08

- **What:** serving cost is carried once, as FLOP per token. `BaseModel.fpt` (2·N_active × the shape's token
  multiplier, `effective.ts fptOfDesign`) and `ModelVersion.fpt` are required and set when made: post-train
  base.fpt × the design's serve multiplier × 10^−serveOom (frozen at launch); distill teacher.fpt × N_s/N_t; IDA
  teacher.fpt (same base); variants copy it. `RunPrediction.fpt` replaces the relative serve cost; the run card reads it.
- **Deleted:** `ModelVersion.serveCost`, `BaseModel.serve`, `RunPrediction.serveCost`, `SERVE_REF`, `serveOfBase`,
  `fptOfBuild`, index.ts `planFpt`, the base plan's `limits.serve`, ProductionReadout `abs.serveCost` (unread 0.5).
  `flopPerToken(s, v)` is now `v.fpt` (signature kept for its readers). No UI reader used serveCost (Blueprint already
  read `card.fpt`), so no UI change.
- **Save:** SCHEMA_REV 46 → 47; migration 46 computes base fpt, a version's fpt as the old reader derived it (base fpt ×
  serveCost ÷ base.serve) and a run prediction's, then drops the old fields (the field name is built at runtime so
  `grep serveCost src` stays empty). hygiene.ts rev asserts bumped to 47.
- **Checks:** tsc (app and scripts/v2) clean; grep serveCost / SERVE_REF in src empty. Targeted check (one-off,
  not kept): new game, post-train and distill completed; every version's fpt equals the old derivation (V0, V1, V3
  7.071e11; mini V5 8.839e10), and a rev-46-shaped save (serve / serveCost, no fpt) migrates to the same fpt.
- **Moves calibration:** no.

### RD-L01
- **Done:** `series.G` (types.ts SeriesV2; record.ts) holds each lab's weekly best internal frontier G (player, each
  rival, China; 4 decimals; a lab with no model records nothing and aligns to `series.day` from the end). One function
  `lagDays(s, follower, leader)` in models/capability.ts: days since the leader's frontier line (the record corners of
  series.G, closed by today's best G; linear between corners) stood at the follower's G; positive = leader ahead.
  `follower` is a lab or a G value. Defined edge cases: follower ahead (lab) → `−lagDays(leader, follower)`; level or
  self → 0; G value above the leader → −gap ÷ the leader's own frontier-G slope (`frontierGPerYear`, DD-10 pace; under 28
  d of history it reads the pre-game rate); history too short (follower below the leader's first sample) → days since
  that sample + the gap at the pre-game reference rate (the rate the start gaps were drawn at, kept until RD-U04 /
  RD-U06 restate start gaps in OOM); no record → gap at that rate.
- **Readers:** `trueLeadDays(other)` = `lagDays(other, player)`. Intel (actors/intel.ts) truth lead = lagDays; the
  lead over a lab's public model = truth + `lagDays(public G, lab)` (its internal-over-public lag; also the release-lag
  term in the sd), so the estimate is lagDays + assumed-release-lag error + noise; intel no longer reads leadBetween /
  rateOf / B. China (actors/china.ts): `usGapMonths` and `chinaLeadHist` read lagDays (rival-vs-China was
  leadBetween's (1 − share) rate conversion). LeadTrack and RiskMap both read the intel estimate, so one function is
  behind them. Not changed (RD-L02 / L03): leadBetween for rival-vs-rival, theft (`frontierLevelAt` on series.L),
  open weights, release lag, epilogue, scoring, paceOf / rateOf / modelRate.
- **Save:** SCHEMA_REV 47 → 48 (renumbered at the merge into rd: RD-U08 took 46 → 47); migration 47 → 48 seeds series.G from series.L via gOfLevel (approximate: λ was rounded
  to 0.001 and capped at 15); idempotent. hygiene's rev literals → 48; ws4 E3's synthetic rival history also sets
  series.G.
- **Check:** `npx tsx scripts/v2/lagdays.ts` (seconds): interpolation, staircase corners, antisymmetry, short history,
  G above leader, late-recorded lab, trueLeadDays, intel = lagDays at zero noise and full access, RiskMap's what-if =
  shifted estimates, usGapMonths = max lagDays, source greps. tsc main + scripts clean. Nothing else run.
- **moves calibration: yes.** The player's lead now reads G rather than capped λ (differs where knot spacing is
  non-linear and past λ 15); rival-vs-China lead (usGapMonths → China centralisation / reweight rules) drops the
  (1 − share) term; intel's public-model read and its sd change; leadBetween(player, X) feeds theft hazard, race
  pressure, open weights and endings, so those move slightly too. Fixture hashes change (new series field). For CP2.

### RD-L02
- **Done (commit 3ae156b):** every "how far ahead" reader in theft, rivals and endings reads G gaps, the lead clock
  `lagDays` or a lab's own frontier-G slope. Helpers next to lagDays (models/capability.ts): `frontierGAt(lab, day)`
  (the series.G frontier line on a day; replaces the λ-series `frontierLevelAt`, aligned from the end for late labs)
  and `frontierGPerYear(lab, windowDays)` with **`PACE_WINDOW_DAYS = 182` [D]** (slope over the last half-year of the
  line to today's best G; a window under 28 d or with no rise falls back to the whole history, then the pre-game rate).
- **Readers moved:** theft hazard vs the player and vs each rival (security.ts) = lagDays(China, victim); the stolen
  copy = the victim's frontier line 60 d ago, player and rival alike (no 3·B clamp; short history: 60 d of the victim's
  slope). Rivals: race pressure, open-weights gap to the frontier, revenue lead = lagDays; late release = the line `lag`
  days ago (capped at internal G); `openAbsorbMonths` = half the G gap in months of China's own slope (≤ 2; dG =
  months × that slope, so dG = min(gap/2, 2 months of China's slope)); `ownProgressDays` = dG ÷ the lab's slope;
  `publishLeakG` / `poachLeakG` sized by the player's slope (DD-17 resizes). Endings: overtaken (endings.ts),
  survival weights and the geopolitics China lead (scoring.ts), `alignedPower` near-test and `projectedMisAtAsi`
  days = G gap ÷ the lab's own slope (**no × 0.7, no 0.3-pace floor** [D]) (epilogue.ts).
- **Left (RD-L03):** `leadBetween` is now a one-line alias `lagDays(s, b, a)` (scripts ws4 / rivals read it);
  `modelRate` / `paceOf` / `rateOf` stay defined in rivals.ts; actions.ts still reads `paceOf` (openReleaseG, C4, China
  absorb) and init / rival start data B_G_PER_Y (RD-U04). The grep hits in rivals.ts are those definitions only.
- **Check:** `npx tsx scripts/v2/leadreaders.ts` (seconds; synthetic 400-day series): frontierGAt, windowed slope,
  leadBetween = lagDays, leak sizes / own-days, open-weights months, epilogue days, rival theft copy, source greps.
  tsc main + scripts clean. Nothing else run.
- **moves calibration: yes.** Theft timing (hazard gate at 90 lead-days vs China now on lagDays for rivals), China's
  stolen and open-weights G, rival release G, race pressure among rivals (drops the (1 − share) term), and the
  epilogue / survival score (days to ASI now on each lab's own slope: shorter for fast labs late, longer for slow ones
  without the × 0.7). Recipe-leak previews and E16 / A4 sizes move with the player's slope vs paceOf. For CP2 (deep S5,
  finance, worldfx).

### RD-L04
- **Done (commit 8efd698):** one milestone predicate for every lab (DD-09). departments/workfit.ts `milestonesOf(s, v,
  fpt)` (work-type fit and coverage vs the best human, AI cost per work-hour vs the best engineers); the player's
  `versionMilestones` = it on the version's build at its FLOP per token. `referenceProfileModel(G)`: a model known only
  by G as a build with the reference RL profile (every domain at G; = the no-build read). models/capability.ts
  `otherLabMilestones(s, r)` = the predicate on the internal and public model at `rivalServeFpt`; `recordMilestones`
  (ordered first crossings) and `updateMilestones(s, day)` (player + every active lab) used by the milestones system and
  by core/init.ts at day 0 (before the readouts, so Stage 2 reads it). `initialMilestones` (λ ≥ knot) and the rivals'
  λ ≥ LEVEL_KNOTS path deleted; the measured-level notice deleted.
- **Readers:** endings (another lab's ASI first, overtaken) and production's Stage 2 read `milestoneDays`, now the
  same predicate for player and rivals (indices unchanged: overtaken stays rival SIAR vs player SAR). Notice: "[name]:
  your evaluations show the criterion met ([player-language criterion])", flag `seenMilestone{i}` = that day (China's
  seenMilestone1 / 2 readers unchanged, now on the predicate; day-0 ones set silently). Acts: SAR or M ≥ 25 → 4, Research
  agent → 3, Reliable agent or day 150 → 2. Gov: `govSeesMilestone(s, i)` (player met it and briefing ≥ 2 or evaluator
  rung ≥ 3, or a deployed version meets it) replaces seenL ≥ 10 / 12 / 13.5 (G-SEC rung 3, mil-loop removal, SEZs).
  data/world.ts MILESTONES stays only as the EndScreen's canon dates.
- **Left:** gov seenL 6.5 / 8.5 (G-SEC rungs 1–2), safety/control L ≥ 12, epilogue's ASI G, rival era / acts thresholds
  outside milestones: RD-L05. glossary.ts still states the L knots (UI). domainG's P19 term reads the player's
  adoption also for rival reference builds (rival paradigms, later).
- **Check:** `npx tsx scripts/v2/milestonepred.ts` (seconds): day-0 records = the predicate for every lab; player
  version (reference profile) and rival at the same G and fpt agree over a G sweep; reference build = general-G read;
  rival credited SC + SAR on fit; rival at λ 13 with AI dearer than engineers gets no SC / SAR; player SC record, flag
  and notice; source greps. tsc main + scripts clean. Nothing else run.
- **moves calibration: yes.** Rivals' and China's milestone days now need coverage ≥ 0.9 and the cost test (SC / SAR
  can come later than λ 10 / 12); Agent etc. are credited below λ 5 (every lab records Agent at day 0 on seed 11);
  Stage 2 timing, endings (ASI first, overtaken), acts, China's escalation (flags 1 / 2 on the predicate) and gov
  G-SEC 3 / mil-loop / SEZ timing all move. T1 golden dates to be re-checked at CP2.

### RD-L05
- **Done (commit e57b5cf):** between-knot display-level thresholds in mechanics restated. Milestone-aligned ones read
  the predicate (`milestoneDays`, RD-L04): gov G-SEC rung 1 `govSeesMilestone(s, 1)` (Reliable agent, was seenL ≥ 6.5),
  rung 2 `govSeesMilestone(s, 2)` + briefing ≥ 1 (Research agent, was seenL ≥ 8.5); safety/control rogue-copy gate =
  player SAR met (was λ ≥ 12); rival S3 +0.3 and the SC u-mode tier (`tierAtLeastSC`, player and rivals) = SC met (was
  λ ≥ SC_LEVEL; SC_LEVEL deleted). Doses go to OOM of effective compute above V0 (ai2027: V0 → SC 2.49 OOM, 2.0 levels
  per OOM below SC): gov awareness 60 / OOM of (true − seen) (was 30 / level), priority 14 / OOM from V0 (was 7 / level
  from L 5), security demand 18 / OOM from 0.25 OOM (was 9 / level from L 5.5), seen OOM = gOfLevel(seenL) − G_V0;
  rival latent-reasoning era at 2.0 OOM (was Lg 9 = 1.99); rival misuse 2e-4 / OOM from 1.0 OOM (was 1e-4 / level
  from L 7); CoT controllability 0.8·σ((x − 1.0)/0.3), x OOM above V0 (was σ((L − 7)/0.6)); callers pass versionOom /
  oomOfLevel.
- **Left (lint tags `level-lint-left`):** worldfx domain-level doses (techtree bio / cyber / persuasion sigmoids,
  control internal ops AGENCY − 10 and INFRA CYBER − 11, sectors AGENCY − 8): restate in domain OOM above V0 with the
  world-effects work. safety/common `tierOfLevel` (continuous tier over all seven v2 knots, traits priors) not flagged
  by the lint (reads LEVEL_KNOTS via a local); goes with the safety redesign (RD-B04–06). Knot-aligned constants kept
  (HUMAN_REVIEW_L / AG05 overseerL = SC knot, epilogue / incidents ASI knot): consistent physically by construction
  (MEA-18 verifier).
- **Check:** `npx tsx scripts/v2/levellint.ts` (new; seconds): flags level-like identifiers (L, Lg, …L, level…)
  and domain levels compared with / minus / divided by a number literal, and comparisons with LEVEL_KNOTS[i] /
  SC_LEVEL, in src/engine/v2 outside comments and strings; allows *View / readout / glossary / ui files and lines
  tagged `level-lint-ok: <reason>` (run-card band, market pipeline length, WSL). tsc main + scripts clean. Nothing
  else run.
- **moves calibration: yes.** G-SEC rungs 1–2 now wait on the predicate and on the government seeing the evaluations
  (briefing ≥ 2, evaluator rung 3 or a deployed version), so rung timing moves; rogue-copy and SC u-mode / S3 gates
  move with the predicate days. OOM restatements are near-identical on ai2027 below SC (maybe on other presets).

### RD-U02

- **One λ.** `safety/oversight.ts` `oomOfLevel(w, L) = gOfLevel(w, L) − gV0(w)`; its own LEVEL_AT table and piecewise
  copy are deleted (models/capability.ts is the only level map). `versionOom(s, v) = v.G − gV0` reads the version's true
  G instead of λ⁻¹(λ(G)); `measuredOom` still goes through the measured level (a level is all the player has).
- **Clamping below 0:** `gOfLevel` clamps L < 0 to 0, the deleted copy extended the first slope linearly; no caller
  passes a negative level (stated in the comment). Old and new agree to 0 on L 0 … 16 in 4 worlds × 2 seeds.
- **Behaviour change:** only past the ASI knot (two post-ASI models now differ: 14.29 vs 15.79 OOM, were both 13.79 on
  ai2027) and for a version with G below λ 0 (none in play). `understanding.ts` `trueUnderstanding` projects a version
  to other levels by overriding `Lg` only; it reads `oomOfLevel(L)` directly and its per-level copies never reach
  `versionOom`, so it is unaffected.
- **Check:** `npx tsx scripts/v2/oversight.ts` (three new RD-U02 checks; the file passes). tsc main and scripts clean.
- **Moves calibration: no** for dates (identical below λ 15); **maybe** for safety outcomes in the window where a model
  is past λ 15 before the game ends (detection, findings, covert containment, agendas read larger gaps there).

### RD-U01

One capability currency (SYNTHESIS theme U; MEA-02, TRN-03 (a) and the hazard part of (b)). Commit ee06451.
- **Offsets in OOM of domain G** (literal = old level ÷ 1.2, the fit's conversion; "was X L" comments): preference
  `POST_PREF.dgD` engagement SOCIAL 0.1667, persuasion SOCIAL 0.6667; hazard curation `CURATION.hazard.dgD` BIO −0.5
  (was −1.0 L at the engine's ÷ 2: kept, so its G is unchanged); SAFEGUARD_DG classifiers −0.0417, hardened −0.1667;
  CONTROL_LAYER_DG −0.0833; SECTOR_PACK_DG 0.4167; `P19_RSCH_DG` 0.4167 (replaces RSCH_TASTE_PENALTY); REEVAL_DG 0.25.
  Paradigm level offsets were already gone (P12 lint); paradigm domainG was already OOM in sD.
- **Engine:** VersionBuild `offL` and the derived `off` → `dgD` (domain ΔG, OOM), added inside `gOfDomain`.
  New `versionDomainG(v, d, hasP19)` (models/capability.ts) is the one domain G: workfit `domainG`, `horizonG` and
  `domainsOf` read it. `domainsOf(w, G, build?, hasP19)` = clamp(λ(G_d) + REF_OFF[d]) (REF_OFF stays a display profile
  until RD-U05). Deleted: LEVEL_PER_OOM, `finishBuild` (callers use gOfBuild), `sD = offL/2`, REEVAL_DL (UI and the
  product-ops cost text show "≥ 0.25 OOM"; glossary autoEvaluate / rerunRule reworded), BaseModel.off (never written).
- [D] **RSCH taste:** v2's display-only −0.5 L on RSCH for a lab without P19 is deleted (the fit never had it); P19 is
  +0.4167 OOM on RSCH G for fit and display alike. So every lab's displayed RSCH level is 0.5 L higher than before
  without P19, and with P19 rises by λ-slope × 0.4167 instead of 0.5.
- **Schema:** SCHEMA_REV 48 → **49** (renumbered at the merge into rd: p2-b took 46 → 48); migration 48 → 49 walks player / rivals / hidden for builds (shape gPre + dgRL +
  sD), sets dgD = offL ÷ 1.2, drops offL / off, drops BaseModel.off, recomputes the player's version domains as λ(G_d).
  hygiene's `SCHEMA_REV === 46` literals bumped.
- **Check:** `npx tsx scripts/v2/currency.ts` (new, registered in run.ts; 5 checks: grep for the deleted factors,
  V0's L_d = λ(G_d), persuasion moves fit and display by the same G, P19, the migration). tsc main and scripts clean.
  scripts/v2/effective.ts's V0 profile check rewritten on domains (it read `build.off`); evals.ts re-run test uses 0.8.
- **Mechanics:** fit / coverage / horizon identical up to the literal rounding (≤ 4e-5 OOM: 0.4167 vs 0.41667 etc.).
  **Displayed domain levels change:** design offsets now show as λ-slope × ΔG (persuasion SOCIAL on V0: +1.34 L, was
  +0.8), RSCH +0.5 for labs without P19. A run-card preview's `gD` (runs.ts planRun) now includes the design ΔG.
- **Left for later rows:** the benchmark midpoint ×2 rule (data/v2/benchmarks.ts m_L) and the distillation fit
  (TRN-03 (b)); B_G_PER_Y (TRN-03 (e)); REF_OFF (RD-U05); RefBot level gates (RD-U07).
- **Moves calibration: maybe.** Levels drive gates: paradigm gates on domain levels (P13 RSCH ≥ 8.5 now fires 0.5 L
  earlier for every lab), benchmarks / danger flags / rival hazards read version domain levels (SOCIAL, RSCH), RefBot's
  measured-level decisions. Dates and fits should move little; RSCH-gated research and danger flags may.

### RD-U05

Domain difficulty in one place (MEA-04, TRN-27's last column). Commit 731e8c2.
- **Formula:** L_d = clamp(λ(G_d − (best_d − G_SC)), 0, 15), best_d = G_SC + δ_d·Δ_bm, δ_d = refDelta(sd_SC)[d] (the
  per-domain best human the work fit's refPoints read). So 10 = the domain's best human (the SC knot is the CODE /
  AGENCY best human), λ(G_SC − Δ_bm) = its median expert, and one OOM counts as on the general λ scale. New
  `domainRefShift(w, d)` = δ_d·Δ_bm in models/capability.ts; `domainsOf` is the only reader. REF_OFF (data/v2/calibration.ts)
  deleted; its readers were capability.ts `domainsOf` (benchmarks.ts, rivals.ts, rivalModel.ts, runs.ts, init.ts read
  domain levels through it) and scripts currency.ts / effective.ts (rewritten on the new formula).
- **Danger flags / dangerous benches / misuse, exfiltration, covert capability / rival hazards / worldfx control:** same
  source, the domain score above (v.domains, unchanged readers). **Their thresholds (data/v2/benchmarks.ts
  DANGER_THRESHOLD and m_L, safety/incidents.ts MISUSE / EXFIL θ, covert defs, control.ts AGENCY − 10, paradigm gates on
  domain levels such as P13 RSCH ≥ 8.5) were set on the old REF_OFF-shifted levels and need a source review** (not done).
- **Size of the change (V0, seed 2027):** ai2027 (Δ_bm 2.9) CODE / AGENCY 5.00, RSCH / REASON 1.55, SOCIAL / MEDIA / CYBER /
  BIO / PHYS 0.00 (clamped; best human 5.5 OOM up); authors2026 RSCH 3.79, others 0; slow RSCH 4.14, expert domains 2.81;
  fast (Δ_bm 0.3) 4.2–4.8 everywhere. Was CODE 5, AGENCY 4, CYBER 4, PHYS 1, rest ≈ 5. So on ai2027 / authors2026 the
  expert domains show 0 at the start and the danger thresholds are reached several OOM later than before.
- **Schema:** SCHEMA_REV 49 → **50** (renumbered at the merge into rd); migration 49 → 50 recomputes every stored G + Lg + domains record (player with its
  build and P19; rivals and hidden from G). hygiene's `SCHEMA_REV === 47` literals bumped. Fixtures not regenerated.
- Glossary `domains` body reworded (GLOSSARY.md not regenerated).
- **Check:** `npx tsx scripts/v2/domainref.ts` (new, registered in run.ts: grep, formula and the 10-at-best-human point
  in 4 worlds, migration). currency.ts and effective.ts's profile check pass on the new formula. tsc main and scripts clean.
- **Moves calibration: yes.** Mechanics (fit, coverage, horizon, milestone dates) are unchanged, but every gate read on a
  domain level moves: P13's RSCH gate (RSCH now ≈ 3.5 L lower on ai2027) delays that paradigm and whatever it feeds,
  danger flags / misuse / exfiltration / rival hazards fire much later or not at all, SOCIAL-based control reads lower.
  Run test:cal at CP2 with the threshold review; watch RSCH-gated research and safety S4 / S5.

### RD-U07
- **RefBot's gates in OOM above V0** (bots/ref.ts `GATE_OOM`): each gate is `gOfLevel(measured L) − G_V0 ≥ ΔG`, the
  measured level read back as G. ΔG = the old conversion (levelOfV2 on V2a's CAL_SHIFT, v2's progress coordinate placed
  on G at slope B) on ai2027: was L 6.5 → 1.3656, L 7 → 1.7706, L 8.5 → 2.9856, L 9.5 → 3.5256 OOM (display λ 7.74 /
  8.55 / 10.57 / 11.20; same on seeds 1 and 2027). P13's RSCH gate uses the RSCH domain level through the same map, as before.
- **Other presets' gates move:** the stale table had set them at authors2026 3.81 / 4.42 / 6.26 / 6.67, fast 2.26 / 2.75 /
  4.22 / 4.60, slow 7.23 / 8.31 / 11.57 / 12.29 OOM; they now share the ai2027 constants, so RefBot starts those projects
  earlier on authors2026, fast and slow.
- **Deleted:** `levelOfV2` (world/calibration.ts), `CAL_SHIFT` (data/v2/calibration.ts), RefBot's `gateLevel`; CAL_SHIFT
  dropped from the rivals R7 and worktypes lint regexes. **Kept:** `milestoneThresholds` (data/world.ts), because
  scripts/v2/golden-timelines.ts (the v1 golden integrator, test:cal) still reads it; v1 `MILESTONES` (end-screen canon
  dates). `capIndex` (data/world.ts) is dead but was left alone. The only grep hits left for levelOfV2 are the "was L x
  via levelOfV2" comments.
- **Check:** tsc main and scripts clean. One RefBot game (ai2027, seed 2027, integrated, to day 820), first day each
  gate holds, before = after: P08 470, rl.mlResearch 470, P19 632, P17 714, P13 748.
- **Moves calibration: maybe.** ai2027 is unchanged; authors2026 / fast / slow RefBot research starts earlier (see
  above). Watch those presets' T1 at CP2.

### RD-U06
Start state as data; one start rule for every lab (MEA-05, MEA-06; SYNTHESIS RD-U06). Commit a7b6f47.
- **Data:** `START_STATE` (data/v2/calibration.ts) per preset: `g` = G(V0), `b0` = B0's pretraining recipe (absolute,
  E_START's convention), `v0` = V0's RL recipe (OOM over the leader's day-0 RL recipe); literals written to 17 digits
  from the old playerStart ("was derived by playerStart"): ai2027 27.6585 / 0.8540 / −0.0411, authors2026 27.6270 /
  0.8245 / −0.0434, fast 27.6001 / 0.7993 / −0.0454, slow 27.7662 / 0.9550 / −0.0332. TimelineWorld has no preset id
  [D]: `startStateOf(w)` looks the preset up by makeWorld's label (`PRESET_BY_LABEL`, unknown → sampled); no shape change.
- **sampled** [D]: one literal for every seed (median of playerStart over 400 seeds: g 27.6918, b0 0.8852, v0 −0.0387;
  was per seed, b0 p10–p90 0.687–0.935, g 27.48–27.75). Sampled player start G moves −0.07…+0.05 OOM per seed.
- **`startLab(w, G0, {flop, tpp, shape})`** (models/capability.ts): base on B0's dates and version on V0's at the world's
  start recipes less one recipe lag (OOM, pretraining and RL efficiency alike), lag bisected so the version lands at G0;
  lag 0 exactly when the reference base meets G(V0). Used by init.ts startModels (player, every start) and
  rivalModel.ts initRivalPhys (rivals, DeepCent, leader twin). `gV0` reads the data. The player's in-flight post run
  (day −3) takes V0's RL recipe scaled linearly to day 0 (v0·(−3)/V0_DAY − lag), as the old linear know-how did.
- **Deleted:** playerStart / playerStartOf, pcRefLab, START_RETAIN, startVintage, DAY_2029, E_B0 (folded into
  START_STATE.b0), the rivals' k / m bisection on their own day-0 rates. `referenceRate(w, w.p0, 2025.5)` replaces
  `playerStart(w).target` (rivals' rate0, follower lagY, preGameRate, scripts effective / rivals). **Kept:** data/world.ts
  multiplierAt / stage1 (world/calibration.ts referenceRate still reads them); rivals' in-flight base run still dates
  its recipe by the lab's own day-0 rates (a run, not the start rule). The double write of the public model
  (simpleModel then initRivalPhys) is untouched.
- **Player:** identical on every named preset (leader start bit-exact: G, gPre, eRL, dgRL, B0 ePre / gPre, Lg; follower
  starts within 1e-9 (re-bisected lag), stacks within 1e-12).
- **Rivals:** start internal / public G unchanged (to 1e-14); their start recipes move. B0's recipe now the player's
  dated one less the lab's lag: |Δ base ePre| up to 0.03–0.10 OOM; recipe today (rec.pre / mid) −0.09…+0.08 OOM
  (named presets, seed 2027, four starts). Leader twin: lag 0 on ai2027 / slow, −0.01 OOM on authors2026 / fast (its
  day-0 pool differs from the 1e6 × 0.4 B0 was sized on); was a bisected staleness m.
- **Check:** probe + check `scripts/v2/_u06/` (untracked: probe.ts writes old.json / new.json, check.ts compares and
  re-derives player and leader twin from startLab on all five presets): all pass. tsc main and scripts clean.
- **Moves calibration: yes (small).** Player start unchanged except sampled (per-seed start → one literal); rivals' /
  DeepCent's recipe today shifts up to ±0.09 OOM, which moves their research pools and next bases. Check rival lead
  and China gap at CP2; no refit here.

### RD-L03
- **Done (commit 36aa7b8):** the progress-year unit is gone. Deleted: `B_G_PER_Y` (runDesign.ts; tree.ts re-export),
  `modelRate` / `paceOf` / `rateOf` / `leadBetween` (rivals.ts), `ProductionReadout.rate` (player readout's e0 / gRate
  input, rivalReadout's eRate), `START_G_RATE` (gRate starts unset and warms up over its 14-day average).
- **New:** `PRE_GAME_G_PER_YEAR = 1.2` OOM/yr [D] (runDesign.ts; research/12 §0.2 frontier +1.1–1.3 a year): the
  stated pace before a lab has a slope. `frontierGPerYear`'s whole-history fallback now needs two series.G points (was
  28 d), else the constant; lagDays' pre-history and its G-above-leader floor (0.06) read it. Start gaps in months
  (rivals initialRival, init follower starts, China's intel start estimate) convert at it, not at referenceRate × B
  (per-world rate dropped).
- **Readers:** C6 openReleaseG = behind × 0.3 y × the player's windowed slope; C4 tacit knowledge 0.0164 OOM and E1's
  China leak 0.0033 OOM (old days × 1.2/365, the paceOf factor dropped); distillDaysPerYear = a year's distilled G ÷
  each distiller's own slope; Limits diffusion = dG/yr ÷ the player's gRate in OOM/yr. Scripts: B → PRE_GAME_G_PER_YEAR,
  leadBetween → lagDays (ws4 keeps a local alias), rivals R1 recipe growth from one applied day, starts.ts rate0.
- **Check:** tsc main + scripts clean; the grep is empty in src; levellint ok. Nothing else run.
- **moves calibration: yes.** Rival / follower start gaps (rate per world → 1.2), early-game pace readers (slope after
  the second weekly point), C4 / E1 / C6 sizes, distill days and the diffusion line. For CP2 (golden dates re-reported).

### RD-R01
- **Done (commit c6efab8):** the one-project aggregate of the research engine is gone: `evalV3`, `evalM`,
  `evalProductionV3`, `govSeenM`, `ProductionReadout.{M, parts, elast, perDollar, ceilings, whatIf}` (player and
  rivals), `LabInputs.abs` (the 0.8e-3 staff cost), `V3Inputs.Th`. The player's readout is built from research.last.x
  (playerReadout): wH = 1 ÷ m_EXP as run; label from the experiment CES's compute vs labour terms at the engine's c, ℓ
  (no taste-bound: it needed M).
- **Readers moved:** gov security demand +20 at the seen superhuman coder (govSeesMilestone 3; was seen M ≥ 10), G-SEC
  rung 4 and G-CHN rung 4 at the seen superhuman AI researcher (4); G-SEC rung 1's "M ≥ 1.5" alternative dropped
  (Reliable agent only). Tutorial act 4 = SAR only (M ≥ 25 gone). P24 payoff and aiShareByRole.re = 1 − 1 ÷ m_EXP.
  tree.ts researchSpeed (rolled nodes) = the engine's ℓ (m_EXP^λ) × siloing / migration (no pause / treaty, as M).
  Previews: runs.spareTraining / serving.spare show the H100e moved (no elasticity %); agents.set shows AI labour in
  experiments / on ideas from workContext of the hypothetical (AgentsView.M → mExp, mIdeas); the viewKey reads m_EXP.
  S.M = m_EXP (record, ref-trace, fixtures, calib start). Company › Research speed: AI labour ×m_EXP (ideas ×m_IDEAS)
  replaces "×M from AI"; the "Best lever per dollar" block is removed; CoreLoop tip likewise.
- **Kept for the Auto mix (RD-A02):** `labThroughput` / `throughputAt` (Σ unit projects' X at h, k, c: the same
  expressions as the old xAtMix, so the mix search is bit-identical). It also backs researchSpeedRel, spareServingEffect
  (X ratio = the old M ratio exactly) and the mix / response charts (now throughput relative to today; response curves
  were M ratios, now research-throughput ratios).
- **Not done:** glossary `rdmult` text still describes M (Term id kept on the UI); save schema not bumped (old saves'
  prodCache keeps stale extra fields until the next day rewrites it).
- **Check:** tsc main + scripts clean; grep empty; `npm run build` ok; `scripts/v2/_r01/check.ts` (untracked, 60-day
  game: researchSpeed, P24, readout, charts, agents view finite and sane) ok.
- **moves calibration: yes.** Rolled safety nodes' speed (ℓ instead of M = X/Xh × taste × mods: no taste lift, and ℓ
  is not the throughput ratio), gov security demand / rungs (milestones instead of M thresholds), tutorial act 4 timing,
  P24 payoff and the RE AI share (1 − 1/m_EXP instead of the CES weight 1 − wH). Mix and research engine unchanged.

### RD-A02

Auto research mix removed (DD-11, INP-01: Auto sat at 98–99% experiments and starved the engineering agents, which
shared the agent pool). Moves calibration: **yes**.

- **Gone:** `applyBestMix`, `bestResearchMix`, `xAtMix`, `inputsAtMix` (production.ts); `LabCore.researchManual` (rivals
  never set it; they keep their own aggregate `bestRivalMix`); the Mix Auto|Manual control (Split.tsx); the research-mix
  chart (`researchMixCurve` / `MixChart`, INP-V02). The daily production step no longer re-splits the player.
- **Research mix:** the player's explicit setting (always a slider). Default = the reference lab's start, experiments 5% :
  research agents 2.4% of compute (≈ 68% experiments, `split.ts EXP_SHARE_DEFAULT`); presets keep the player's mix.
- **Engineering line:** a seventh pool `split.engineering` (top group "Engineering agents" on Compute › Split; Company
  pool labels). Chosen over a budget inside the agents package because the split already owns every compute line and its
  UI is a list of top-level sliders. `playerShareRef(yr)` = shareRefAt with the reference ENG_REF_SHARE (20%) of agent
  compute moved to engineering, so at the reference split every use has exactly the H100e it had before (0.6% of compute
  at start). `split.agents` is now research agents only; package shares: eng = 1 (all of its line; the Agents lane hides
  its stepper and the action blocks compute changes for it), routine / frontier renormalised (0.8125 / 0.1875,
  `DEFAULT_CAP_SHARES`); rivals read `REF_AGENT_SHARES` (unchanged 0.65 / 0.15). Other labs: engineering 0.
- **RefBot:** sets `playerShareRef(yr)` (with its safety share) monthly via pool keys, the research mix included (AI
  2027's experiments : automation rows), re-applying when experiments drift > 0.1 pt. No tuning.
- **Kept, readouts only:** the aggregate throughput, renamed `expThroughput` (Research speed ×, spare-serving effect,
  response charts at today's mix). No mechanism reads it.
- **Save:** SCHEMA_REV 51; migration 50 deletes researchManual, adds engineering 0 to every lab, and (only when the
  player's split has no engineering line: idempotent) moves agents × the eng package share to engineering and
  renormalises the research shares. hygiene's two rev pins → 51.
- **Not done:** the optional "Suggest" button (budget). Untracked scratch `scripts/v2/_r01/check.ts` still imports
  `researchMixCurve` (outside the scripts tsconfig). Check: untracked `scripts/v2/_a02/check.ts` (mix held over 60
  days, engineering line live, migration).

### RD-A05a

One flat compute allocation to uses (theme A, SAFETY-REDESIGN §5, DD-19). Moves calibration: **maybe**.

- **Shape:** `ComputeSplit` = training, synthetic (data generation), experiments, routine, frontier, engineering,
  safetyAgents, monitors, safety (safety research: open cases first, lines the rest), serving, idle; each a share of
  total compute, Σ = 1 with idle. Gone: `split.agents`, `AgentPackage.compute`, `policies.monitorBudget`,
  `safetyAgentShare`, the four-claim `safetyPoolClaims` (now the safety line only: cases → lines), split.ts
  TOP_KEYS / specOf / fromSpec / MIX_RANGE. Other labs: same shape (agents → routine / frontier at 0.65 : 0.15;
  engineering, safetyAgents, monitors 0).
- **One allocation:** `split.ts allocOf` (and `poolsOf`, its H100e); `agentSplitShare(use)` = the use's line
  (`AGENT_LINE`); `monitorBudget` = the monitors' line, `used = min(line, need)`; the unused rest is shown (Safety
  tooltip "Unused", safety view idle), never moved. Model per agent use unchanged.
- **Actions:** `setSplit` takes the flat keys; `agents.set {compute}` writes the line (research uses: routine share of
  routine + frontier; safety: its line, from / to the safety research line); `agents.monitorBudget {share}` = share of
  total compute, moved from / to the safety research line (step 0.1 pt); Trusted to AI starts safety agents at 20%
  of the safety research line. Presets (reference / race / balanced / safety) set group totals and keep the player's
  proportions inside each group (preset arithmetic only).
- **Behaviour changes (why "maybe"):** a monitoring budget above the need is now unused instead of feeding the lines
  (DD-19); case `computeShare` is a share of the safety research line (caseRate's share term sees a larger share for
  the same compute); RefBot's safety agents / monitors converted to total-compute units with the same targets.
- **UI:** Compute › Split is a flat list of sliders per use in player language (spare training / serving rows kept);
  full redesign later.
- **Save:** SCHEMA_REV 52; migration 51 (`migrateFlatSplit`) splits the old pool by RD-B07's granted claims, so every
  use keeps its compute; hygiene rev pins → 52. Retired: safety suite "RD-B07" claims test.
- **Check:** `npx tsx scripts/v2/_a05a/check.ts` (sums, presets, readers, migration of a rebuilt rev-51 save with a
  budget above need and an open case: same H100e per use). Untracked scratch `scripts/v2/_a05a/ed*.cjs` (edit scripts).
### RD-A01
- **One capacity function:** `src/engine/v2/departments/capacity.ts` `teamCapacity(team, column)` (heads ÷ CAPACITY_UNIT
  × quality × SPECIALTY_BONUS in the specialty) and `reCapacity(team)` (heads ÷ TEAM_SIZE.re × quality). Replaces
  models/research.ts `sciCapacity` and `reCapacity`, models/tree.ts `teamCapacity(t, node)`, safety/agendas.ts `capOn`,
  and the inline copies in safety/lineProjects.ts `safSciOn` and departments/workfit.ts `ag17Capacity`. selectors.ts
  re-exports it from the new module. Not merged: teams.ts / investigations.ts sum raw heads × quality (another unit).
- **RE constants:** RE_UNIT and RE_PER_PROJECT are different quantities that happen to be equal (2): a fixed unit of
  measure for experiment labour (ℓ = 1; also scales C_UNIT_FLOP_PER_DAY) vs a per-project allocation cap (policy).
  Kept both, renamed `RE_LABOUR_UNIT` (data/v2/workTypes.ts) and `RE_MAX_PER_PROJECT` (data/v2/research.ts).
- **Checks:** tsc (app and scripts/v2) clean; grep shows one definition of each. Targeted check (one-off, not kept):
  756 team × column combinations, new functions bit-identical (Object.is) to the old formulas.
- **Moves calibration:** no.

### RD-R06
- **Drop rule (CAP-09):** `models/research.ts` `dropRule(score, underFloor, alts)`. After a test reading a candidate is
  dropped only when its updated score (μ + κσ, the pick's score) is under the existing absolute floor (small: DROP_FRAC ×
  prior mean; scale: SURVIVE_FRAC of the small estimate or the floor, on xT + κ·|xT|·TEST_READ_SD) AND under the best
  remaining pool score (scale test: pool scores × E[1000^s] under the scale prior, or a batch's survivor factor). Empty
  pool or score ≤ 0 under the floor: dropped (a fresh idea / doing nothing is better). Dropped candidates are not kept
  as "tested, weak" (not cheap: the pool would re-pick them).
- **Give up:** `giveUpText`: "the team gave up after 3 weak candidates (last: …). Weak results can be bad luck: the
  chance it works is still X% (this attempt's odds). Reopening as speculative tries again at Y%." The Research card's
  failed line shows the reopen odds. Reopen already starts a new attempt at 0 drops (freshCap; now checked).
- **Checks:** tsc (app and scripts/v2) clean; `tsx scripts/v2/research.ts --rd-r06` (better than the pool's best is
  kept; text shows the odds; drops reset on reopen).
- **Moves calibration:** maybe (fewer drops when the pool is weak; κ now enters the floor: safe drops more, speculative
  less).

### RD-R07
- **Four stages.** `CapStage` loses `result` (types.ts): when the scale test passes, resolveStage sets `adopting` at once
  (it was set to `result` and overwritten by queueAdoption the same day, so no save holds it: no migration, SCHEMA_REV
  stays 47). researchView `STAGES` = ideation, small, scale, adoption; tree status, capProgress and stepProject drop the
  `result` checks. Player-facing names (ResearchProjects stage track, labels, Next tip; Research node card / effort
  rows; glossary titles): Ideas → Small test → Big test → Build-in. The term `stageResult` stays as "Result estimate"
  (the band read when the big test ends, not a step).
- **One effort number.** For capability ideas and axes `effortTM` is now the whole stage work the engine runs (PICK_AT ×
  idea + small + scale team-months = effortOfNode's sum); `IDEA_STAGES` are shares of it (old weights ÷
  `IDEA_WORK_PER_E` 1.2), unfitted default `IDEA_DEFAULT_TM` 9.6 (was 8 × 1.2 implicitly). FITTED_EFFORT_TM and the
  capability entries of V2_PARADIGM_EFFORT_TM restated ×1.2 (P13 95.544, etc.; P27 not a staged project: 24 kept), so
  every stage's work is unchanged. calib --fit-tree now fits in these units.
- **Checks:** tsc (app and scripts/v2) clean; npm run build passes; `tsx scripts/v2/research.ts --rd-r07` (four stages;
  effort shown = stagesOf sum = effortTM for every capability idea / axis; P13 stage work unchanged; no result stage
  reached in the engine or the view on a working elastic run).
- **Moves calibration: no** (stage work identical up to floating point; the removed stage lasted zero days).

### RD-R05
- **Unlock projects (CAP-13, DD-14):** `isUnlockProject(n)` = a capability idea / axis without a typed effect (no stack,
  domains, data or expert: 22 nodes, e.g. rl.* focus nodes, scienceData, multimodal, P05–P08, P13–P15, P17–P20,
  P23–P25). They skip ideas / small test / big test: one stage `test` (CapStage) with `CapProjectState.trial` {work,
  workNeed = trialWork(n) = the stagesOf sum = effortTM, flop, buildId}. Each day the science teams (ideation rate:
  (m_IDEAS × capacity)^λ × taste × speed / 30) and the experiment CES (research engineers + the project's FLOP, as
  `experimenting` now includes stage `test`) add to the same work. When it is done the hidden per-world `works()` draw
  decides: works → build-in (ADOPT_TW.unlock), known on completion; doesn't → failed, reopen as speculative at the
  lower odds (unchanged). No candidates, no belief or effect band, no drops (maxDrops 0). capEta / capProgress read
  the trial. An older save's unlock mid-pipeline is restated on its next day at its progress (trialOf; no schema bump);
  one already building in finishes on the old path.
- **View / UI:** CapProjectView `unlock`; `UNLOCK_STAGES` = test, adoption (StageId gains `test`); Projects shows
  Test → Build-in, a "Test" section with "Chance it works" and "Time left", Next tooltip rows Test / Chance it works,
  unlock failure text ("the test showed it does not work on this attempt"). Glossary `stageTest` added (GLOSSARY.md
  not regenerated). Ref bot treats stage `test` as in progress.
- **Checks:** tsc (app and scripts/v2) clean; npm run build passes; `tsx scripts/v2/research.ts --rd-r05` (unlock set
  = no typed effect; three day-0 unlocks run with no candidates / band, one test of trialWork, outcome = the works draw).
- **Moves calibration: maybe** (unlock timing now one pooled work stage with no drops or give-ups: unlocks that used to
  fail by three weak draws on a working direction now land; science teams' time counts toward the whole effort).

### RD-E03

Headroom removed (DD-12; SYNTHESIS §6 Phase 3; CAP-18). Commit eb8792d.
- **Stacks:** an adopted idea adds its full true effect at build-in: `addIdea` has no headroom part, `StackBucket` is
  `{ s, a }`, `stackAt` = base + adoptedAt. `headroomAt`, `headroomTotal`, `tuneDay` and HEADROOM are gone.
- **Research engineers:** routine tuning is gone as a need (ReNeed = ops / evals / exp; TUNE_K, TUNE_RE_PER_OOM from
  RD-B08, the tuning branch of capResearchDay). `expShares` divides the pool over RE_MAX_PER_PROJECT per project in
  experiments; a project with no research engineers leaves its share unused (what RD-B08 already did with no
  headroom). Spare research engineers are idle: new readout `research.last.idle`; Company › Work already lists "idle"
  (overflow tip reworded); the hire preview's fallback line reads idle research engineers instead of tuning.
- **UI / copy:** Recipe drops the headroom row and bar segment (make-up = start and public knowledge + adopted);
  glossary `headroom` / `routineTuning` removed; stageAdoption, recipeStack, reNeeds, diffusion, publicKnowledge and
  LIMITS speed.diffusion reworded.
- **Schema:** SCHEMA_REV 48 (first bump on p3-c). Migration 47 → 48 delivers each bucket's remaining headroom (drops
  `h`, so the effect is the whole `a`) and drops 'tune' from `research.re` (order, max, share) and `last.re`.
- **Tests:** `tsx scripts/v2/research.ts --rd-e03` (adopted idea's full effect in the stack at build-in, bucket fields
  `a,s`; no 'tune' need, idle readout = capacity − needs, an order naming tune is ignored; a rev-47 save loads with
  headroom delivered and no tune). Old headroom / tuning checks in research.ts rewritten (overflow → idle; RD-B08
  (a) idle only after every project is full, (c) projects take the whole pool; RD-B16 an idea moves Software progress
  by its whole effect); evals EV3 order check reworded (evals last / capped at 0); hygiene rev asserts 48; lint-ux term
  list drops headroom / routineTuning. Not run: the full research suite, evals, hygiene, test:cal (RD test rule; CP2).
- **Checks:** tsc (app and scripts/v2) clean; npm run build passes.
- **Moves calibration: yes** (the 30% of every adopted idea that waited for tuning now lands at once, and the research
  engineers tuning held go idle; expect earlier milestones, most on presets with many adoptions; refit at CP2).

### RD-A03

Science-team planner by value (CAP-08; SYNTHESIS theme A, §6 Phase 3). Commit faa8d47.
- **Value:** `models/research.ts` `projectValue(s, id)` = expected value per day (lab-wide software OOM) as a function of
  the capacity C and capacity-weighted taste q on a project; ideation at (m_IDEAS·C)^λ × q × speed per team-month of
  ideation work (as stepProject). Line: candidates/day × the pool's prior mean of a batch (`valueOom`). One-off idea in
  ideation: candidates/day ÷ PICK_AT × attempt odds × prior mean (taste's lift included). Unlock: (science work + the
  experiment CES work)/day ÷ trialWork × odds × `VALUE_PROXY.unlock`. Proxies [D] (data/v2/research.ts `VALUE_PROXY`):
  a domain OOM = 0.1 software OOM; an unlock or a data / expert-data effect = 0.05 OOM × its size (about one mid-sized
  stack idea). `assignmentValue(s, projects, teams)` sums projectValue (signature gained `s`).
- **Release in tests:** `releasesTeams(n, st)`: a one-off idea (typed effect, not a line) in stage small / scale gets no
  teams and value 0 (its new candidates only mattered after a drop); lines keep ideating; an unlock's test keeps them.
  `takesTeams` unchanged (capEta, tree status, ref bot).
- **Planner:** priority pass (teams wanted, best specialty first) unchanged except released projects are skipped; the
  swap pass and the spare pass maximise value. Spares: auto projects first, then any project under PROJECT_MAX_TEAMS,
  by marginal value × AUTO_RANK_W per rank (spares no longer all join the top project when every project is fixed);
  no gain anywhere: idle. "Why here": the reason (priority / swapped / auto / spare, specialty) + "adds ~x% to this
  project's yearly gain" (value with the team ÷ without − 1; a sole team "carries all of this project's yearly gain").
- **Tests:** `tsx scripts/v2/research.ts --rd-a03` (a one-off idea in its small test gets no team, a line in its test
  keeps one, back in ideation it gets one; the spare goes to P16 over the top-ranked elastic, gains shown; every why
  states the value). B4 check updated: all-fixed spares go by value (no longer 4 on the top project); brute-force
  check now on value. Not run: the full research suite, test:cal (RD test rule; CP2).
- **Checks:** tsc (app and scripts/v2) clean; npm run build passes.
- **Moves calibration: yes** (teams leave one-off ideas during their tests and spares follow effect size: more science
  on lines and big-effect ideas, P13-type projects' ideation pace changes; refit at CP2).

### RD-R08

Batching as an internal expected flow (SYNTHESIS RD-R08; CAP-11). Commit 9f55e90.
- **No batches:** every line candidate is one idea (`batchOf` removed; capEta and projectValue read one idea per
  candidate). `Candidate.b` stays for old saves (atTest's batch path still reads in-flight b > 1 candidates).
- **Flow:** at experiment throughput X the line's day splits: share φ = clamp(X / PACE_BATCH − 1, 0, 1) runs `stepFlow`,
  the rest the explicit pipeline (its ideation and experiment time × (1 − φ)). The flow tests k = min(ideas ÷ ι, work ÷ w)
  ideas a day; per tested idea w (work: small + scale if it passes), g (kept true effect at test scale ÷ prior mean), p
  (kept ideas), sx (survivors' effect-weighted scale exponent), ι (ideas ideated) come from `flowStats`: the explicit
  rules (newCandidate draws, addCandidate / pickCandidate pool, both dropRule tests, SURVIVE_FRAC) simulated on 1500
  single-idea tests with fixed hash draws (seed-independent; cached per line, κ, grid point), bilinear in log taste and
  log ρ (ideas ideated per test, from ideation vs experiment capacity). All of it is in prior-mean units, so it holds at
  any pool state. The pool advances test by test (≤ 256 sub-steps a day) by g × the prior mean at the pool then.
- **Results:** one `CapResult` a day with `flow = { x, s, n }` (true expected effect, exponent, ideas adopted);
  completeAdoption uses it instead of the seed recompute; stacks count n ideas (fractional), `res.adopted` shows `b` =
  ideas. Build-in tw = base × ideas + perOom × OOM (cap max × ideas). `gen` moves by whole adopted ideas (`flowDone`).
- **Continuity:** φ is linear in X from PACE_BATCH to 2 × PACE_BATCH, and the flow's per-idea expectation is the explicit
  pipeline's, so expected OOM/day has no jump at the switch (no b = ⌊X/30⌋ steps any more).
- **Check (scripts/v2/.tmp-rdr08.ts, run alone):** L.scale, 8 seeds × 1500 days, φ = 0 vs 1 vs 0.5 at the same inputs
  (default lab, 2 RE teams, 1 and 3 science teams): flow OOM/day +0.9% / +2.2%, ideas/day +3.0% / +1.5%, φ = 0.5 −1.0% /
  +1.2% vs the explicit pipeline (tolerance 15%). tsc main and scripts clean.
- **Limits:** an explicit test in flight when φ reaches 1 waits until throughput falls; flowStats draws T per candidate
  (the explicit pipeline shares it per generation).
- **Moves calibration: maybe** (above X = 30 the old batches' survivor factor and drop rule are replaced by the
  single-idea rules in expectation; engineers' build-in cost per idea rises to the explicit pipeline's).

### RD-E02

AI taste per DD-13: one ideas channel (SYNTHESIS RD-E02; CAP-05). Commit f34119b.
- **Weight:** `aiIdeasShare(H, assist, L) = max(0, 1 − H·assist ÷ L)` (departments/workfit.ts): AI's share of the
  slot's effective labour above what the (assisted) humans make alone. Team taste = (1 − s)·human + s·E[max(human, AI)]
  (teamTaste, its `phi` argument renamed `sAI`). Chosen over the margin share 1 − wH because with ρc = −2 (complements)
  1 − wH is ~1 at near-zero AI compute (AI the bottleneck) and falls to 0 as AI grows: the wrong direction. The chosen
  share is 0 with no AI FTE, rises with AI compute and saturates, at fixed coverage A, at 1 − (1 − A)^1.5 (→ 1 as A → 1),
  so AI taste spreads with coverage, not with a compute-share ratio. Assisted human work keeps human taste.
- **Where:** `LabourOf.sAI` on every slot; `WorkContext.sAI = slots.IDEAS.sAI` (capabilities: research.ts sciOn /
  taste fn, production.ts); `SafetyLabour.sAI = ideas.sAI` (SAF_IDEAS via handedLabour, so Trusted to AI enters through
  A = t·a; 0 at t = 0) read by safety/lineProjects.ts safSciOn; rivals (actors/rivalModel.ts rawAggregate / rawEI):
  `rivalTaste` from their aggregate ideation LI (S scientists, aI, assistI), replacing φ = 1. φ deleted (frontier share
  ÷ DEFAULT_CAP_SHARES.capFrontier; the unused import removed).
- **Check (scripts/v2/.tmp-rde02.ts, run alone, untracked):** default lab, frontier model +4 OOM, agent compute × 0 …
  10⁵: s 0 → 0.48 → 0.93 → 0.946 (saturated), lift 1.000 → 1.85 → 2.64 → 2.676; zero compute gives human taste exactly;
  rival taste 1.000 with no agent compute, 1.005 with it (start-level coverage). At the start model (no boost) s ≈ 0.01
  and the lift ≈ 1. tsc main and scripts clean. safetyresearch.ts E2 taste check label updated (not run).
- **Moves calibration: yes** (rivals and the player lose the full AI-taste lift until IDEAS coverage is high: at the
  start s ≈ 0.01 vs φ = 1 before; rivals' ideation I has taste², so their early research input falls; refit at CP2).

### RD-E01a

Paradigm typed effects, part 1 (DD-14; SYNTHESIS RD-E01a; CAP-02). Commit abaffe7.
- **P13 deleted** (automated AI research agents: ×(1 + 0.5·payoff) experiment FLOP, applied in research.ts and again in
  production.ts): AI labour in the EXP slot already models research agents. p13Mult and the `p13` parameter of
  researchInputs / experimentRate / stepProject / capResearchDay are gone, and so is the P13 → U17 ×1.5 presence
  modifier (UMODE_PRESENCE.p13U17; sabotage presence now has no research-automation term, revisit in the safety
  redesign if wanted).
- **P19 deleted** with RSCH_TASTE_PENALTY (−0.5 L on the RSCH display level; work fit never had it). domainsOf /
  refreshLevels / domainG lose the P19 argument; the serving fit memo loses its P19 key. Display RSCH is +0.5 L for
  every lab and model.
- **New `needs`:** P15, P16, P24, aar → `['rl.mlResearch']` (P13's own prerequisite); P21 → `['P08', 'rl.mlResearch']`.
  RefBot (REF_TREE) drops its P13 / P19 goals.
- **P24** is `kind: 'idea'`, `effect: { stack: 'pre', mean: 0.96, sd: 0.4 }` (OOM of pretraining efficiency, scale-
  invariant): prior mean = the old flat "next base +0.96 OOM of recipe" at full payoff; sd 0.4 [D]. It runs the normal
  idea pipeline and lands in the pretraining stack at build-in, so a base launched later freezes it in recipe.pre.
  p24Dg, BaseFreeze.p24, RunRecipe.p24 and its payoff ("AI share of research labour 50% → 90%") are gone.
- **payoffOf** stays, P20 only (its ×(1 + 0.1·payoff) agent multiplier is RD-E01b's); the Research card shows a payoff %
  for P20 only.
- **Draw order:** world/hidden.ts SKIPPED_DRAWS { P14: 0.75 (P13), P20: 0.6 (P19), P27: 0.8 (P26) } consumes each
  deleted paradigm's draw where it was, so every other paradigm's hidden success is unchanged.
- **Save:** SCHEMA_REV 49, migration 48 → 49: P13 / P19 paradigm, tree and draw entries dropped; each run's recipe.p24
  added to recipe.pre (same total G); an adopted P24 gets one s = 0 pretraining-stack idea of 0.96 × its payoff on the
  save's day; stored domain levels recomputed (player versions; rivals' internal / public models).
- **Scripts:** hygiene rev checks → 49; research.ts RD-R07 / RD-B18 checks moved from P13 to P17 (not run);
  data.ts RD-B02 drops its p24 condition. Left: calib.ts `--fit-tree` still lists P13 in FIT_IDS / targets (refit
  at CP2); fixtures and golden traces regenerate at the checkpoint.
- **Check (scripts/v2/.tmp-rde01a.ts, run alone, untracked):** no P13 / P19 node, paradigm, prerequisite, state or
  draw; P24 is a pre-stack idea with mean 0.96; in a world where P24 works (seed 1) adopting a candidate adds its true
  effect to the pretraining stack (+0.435 OOM) and the planned reference base's gPre moves by the same +0.435. tsc main
  and scripts clean; `npm run build` passes.
- **Moves calibration: yes** (the player loses P13's up-to-×1.5 experiment FLOP and P24's payoff-gated bonus becomes a
  drawn stack idea; RSCH display levels +0.5 for every lab, which shifts anything gated on measured RSCH; RefBot no
  longer researches P13 / P19; refit at CP2).

### SR-01

Safety cleanup (SAFETY-REDESIGN §6 #3, #14; §0 line 5; inventory E1, O1, O2, I3, V2, T10, R3).
- **Validation lead deleted** (U8, SAF-10): `understanding.ts` has no VAL_LEAD / validationLead; a tool's believed
  strength falls as 1/(1 + ((L − L₀)/VAL_W)²) from the measured level with no staffed lead. `reValidationMult` stays
  only for the record readout (`core/record.ts`) and upkeep (removed by later SR tasks).
- **Dead-end latch deleted** (R7, SAF-14): AgendaState.status is 'idle' | 'active'; no ×0.5 line speed; a DEAD result
  still lowers the posterior and counts its team-months.
- **Tool On/Off deleted**: action `safety.technique` gone; owned detection / containment tools are always active
  (unlockTechnique already set that); the Tools card shows no toggle. `safety-emu.ts` no longer toggles fix methods.
- **Staffing copy**: the fix-method tooltip no longer says "while its line is staffed" (engine switch stays until
  SR-14 / SR-12); glossary dead end loses the half-speed sentence.
- **Previews**: eval gate shows the extra wait on external launches only, the T-PROP ×0.7 coupling when it flips, and
  the Safety Index effect (gradePlayer on a copy → next edition's talent / safety-bloc approval); no clarity or
  credibility lines. Publish policy: "all" shows +2 credibility / +1 talent per result (lagged by the lines' result
  pace) and the shared-pool spill to rivals; none / selective say nothing is published automatically; plus the Index
  effect. Pledge: credibility +8, evalGov trust +4, E15 ×0.5, break cost as text, Index effect; the notional progress
  and lead lines are gone. RESPONSE_INFO loses its `days` (instant responses say "takes effect at once"; patch names its
  real 30–90 d crew). E01 "Fix quietly" → "Keep it quiet" with "nothing is fixed".
- SCHEMA_REV 54 → 55: migration unlatches 'deadEnd' lines (→ idle) and sets owned non-fix tools active.
- Checks: tsc main and scripts, `npm run build`, `lint-tradeoffs` (pledge / evalGate / publishPolicy known deviations
  removed: all pass), targeted `npx tsx scripts/v2/_sr01/check.ts` (passes).
- **Moves calibration: maybe** (no lead lowers believed U and so the U-margin, red flags and anything gated on it;
  latched lines run at full speed; tools switched off by bots are back on).

### SR-02

Blind-gap amplifier deleted (SAFETY-REDESIGN §6 #1, OD-3; inventory U9): `safety/traits.ts` has no
understandingGapGrowth / GAP_GROWTH_K / GAP_CAP_L; player trait growth uses growthMult 1. `ws2.gapTrue` is still
sampled weekly in `core/record.ts` because `scripts/v2/bots.ts` reports it. The sourced "undetected hacking
reinforced" replacement is SR-24. Moves calibration: yes (S4/S5); re-measure S4/S5 at the next checkpoint.

### SR-03

One harmful-acts view: `safety/actTable.ts` `actTable(s, target, believed)`, target = a product (`deploymentId`), an
internal lane (`use`) or an internal fleet as incidents rolls it (`deploymentId, versionId, usage`). Rows in three groups
with player names (§2.4): misbehaviour (SYC, RH, PROXY, CONCEAL, POWER), against the lab (SAND, COLLUDE, SCHEME,
BACKDOOR, HIDCOMP, SAFSAB, STEER, SUCCSTEER, the composite "Acts against the lab" = E9's exposure Mis·(1 − O_eff)·(1 + F),
"Copies itself out" = E25 exfiltration), misuse (bio, cyber). Factors: Would try (believed: estimate and 90% range
est ± 1.64 sd; Mis band for the composite), Able to, Chances, Stop rate = 1 − (1 − block)(1 − catch), attempts and
Unstopped per year (per work item for SAFSAB / STEER / SUCCSTEER; exposure for the composite).
Engine side reuses the existing formulas: `incidents.ts actTerms` (new kernel, actRow calls it), `catchOf`,
`misuseHazards` (optional believed inputs: measured levels, believed classifier strength), `exfilTerms` (exfiltrationHazard
now reads it), covert `dayTerms` / `itemTerms` / `safetySabotage`, `controlTerms` / `believedTerms`. dangerView's product
and lane readouts are the believed table's trait rows (`actSite` + `siteActs`); its numbers are byte-identical to before
(check: `npx tsx scripts/v2/_sr03/check.ts`, fixtures day400 / day900; engine rows = dangerOf / misuseHazards /
exfiltrationHazard × 365).
Open: U-modes are not rows (the engine still rolls them as extra rows of their mapped act); the believed covert and
exfiltration rows are new believed readings of the engine formulas (belief estimates, measured levels, believed
oversight; no backdoor reach the lab cannot see); "Able to" of the composite row is 1 (the loss test's ASI / escaped-copy
gate is not a capability sigmoid). SR-04 builds Loss-of-control risk on the composite row. Stray untracked
`scripts/v2/_sr03/refactor1.py` (a helper the sandbox would not run or delete) can be removed.
Moves calibration: no (engine numbers unchanged: same formulas, same float order; no RNG or state change).

### SR-04

Loss-of-control risk: `safety/lossRisk.ts` `lossOfControlRisk(s, model?, mods?)` = the player's believed odds that the
engine's loss test (control.ts: E = Mis·(1 − O_eff)·(1 + F) > θ_w) fails for a model, "if it could act now" (OD-2).
Mis ~ Normal(misalignmentEstimate, misalignmentSd) clamped to [0, 1] (assumption: trait belief sds independent normal
errors, Mis linear in them; 81-point grid over ±4σ; `misalignmentSd` split out of traits.ts misalignmentBand, same
floats). O_eff = believedInternalOversight on the takeover act (the composite row's stop rate) after believed backdoor
reach. Footholds: located at half weight and their size; suspected at full weight and the typical size of their kind
(backdoor reachPerSev·(floor + span/2), hidden compute hidCompPerSev·(floor + span/2) of the agent pool; other kinds
suspectedF; kind and lineage are visible, size is not); unfound allowance = the believed fleet table's unstopped BACKDOOR
and HIDCOMP acts over UNFOUND_YEARS = 1 [D] at the typical size (item acts excluded: no believed items / yr). θ prior:
0.40 (U(0.30, 0.50) when setup.alignment is sampled) + Logistic(0, toleranceSd), clamped [0.05, 0.95], closed form
(softplus); never s.hidden. Range = risk at the belief's 5th / 95th percentile. Lab headline = max over running models
(best, internal fleets, live products' models). `unstoppedHarmPerYear(s)` = Σ per-year rows of every site's believed
table × expected severity (floor + span·Able to·A·F; escape 5; misuse floor + span·Able to); item and composite rows out.
Readers: Risk › own row (label "Loss of control (model)", no pFirst factor, drivers by removal: footholds, belief
uncertainty, rest; levers misalignment −0.05 / belief ranges halved / stop rate +10 pts; RiskMods.margin gone) and so the
top-strip combined estimate; Safety › Overview Control card = Loss-of-control risk gauge (< 5 / 5–20 / > 20%) with
belief ± range, stop rate, known + unfound footholds and Unstopped harm / yr (controlReadout.risk / harm / harmActs).
Other labs' world rows unchanged. Glossary: lossRisk, unstoppedHarm. Check: `npx tsx scripts/v2/_sr04/check.ts`
(day400 / day900: wider beliefs raise it below the line; suspected > located > removed backdoor; control layer and +10
pts stop lower it; identical with ε_w, doomThreshold and true traits rewritten).
Open: the stored believed control (controlStep → effectiveControl.believed, controlView, ControlRead.believed and the
card's data-control hook for uitest) still exists; CONTROL_BANDS / controlBand are unused by the card; GLOSSARY.md not
regenerated; the monitor-budget lever moved nothing on the fixtures (watched share already full).
Moves calibration: no (output only: the engine's loss test, control and incidents are unchanged; no RNG or state change).

### SR-06

Beliefs per model with an evidence list, no time drift, inheritance widened by the predicted run change (SAFETY-REDESIGN
§2.2 concept 2, §6 #6; inventory B9). `TraitBelief.evidence`: the last 20 updates (BELIEF_EVIDENCE_CAP), oldest first,
each {day, source, reading, noise} (numbers to 3 decimals). Sources: "<kind>/<family>" for instrument readings
(suite, external, bench, monitor, audit, finding, case; family BB / COT / WB / OR), "case" for a case verdict, "prior"
(public lineage prior), "start" (V0), "inherit:<parent id>" (a new model's start), "stream". `updateBelief(b, o, σ, day,
source)` / `observeVersion(…, kind)` append each reading; investigations' verdicts append theirs.
**Drift deleted**: `driftBeliefs` (sd +0.01/week, stream +0.05/day) is gone from detection.ts and safetyResearch; a
frozen model's belief changes only through evidence.
**Inheritance** (already from predictBeliefs, now stated and tagged): est = the parent's belief pushed through the graph
with public weights (the run's predicted change Δ); **widening rule** sd' = min(SD_MAX, √(sd_parent² + w²)),
w = 0.3·|Δ| + PREDICT_SD_FLOOR (0.04) [D]: the prediction's error is independent of the parent's, so variances add.
The new list holds one entry (reading = new est, noise = w); the parent's evidence stays on the parent (it is about
that checkpoint). Distilled students inherit from the teacher ("inherit:<teacher>"); a model with no ancestor starts at
the lineage prior ("prior"). A stream version widens daily by predictBeliefs at ω = 0.6/42 with floor
0.04·√(ω_day / 0.6), so one post-run's worth of stream training adds one run's floor variance; the days fold into one
trailing "stream" entry (noise √(Σw²)). `beliefUnknown(b)` = 90% range 3.28·sd > 30 points (UNKNOWN_RANGE; derived, not
stored); not yet read by any readout (RISK_UNSEEN_CLARITY badges unchanged). Glossary "clarity" no longer says it decays.
SCHEMA_REV 55 → 56: migration gives every stored belief an empty list; hygiene's rev pins and SR-01's check updated to 56 / ≥ 55.
Check: `npx tsx scripts/v2/_sr06/check.ts` (migration; 30 ticked days on day400 / day900: every est / sd move lands with
an evidence entry that day, thousands of belief-days unchanged without one; one reading → one entry, cap 20; a post-train
version from the newest full model: sd² = sd_parent² + w² for every trait, one inherit entry, identical with true traits
rewritten; Unknown threshold). Passes.
Open: save size grows by up to 20 entries × 17 traits per version (not measured against SAVE_BUDGET_BYTES); readouts
do not show the list yet (SR-07 / UI); IDA cycles keep the post-train start (no extra widening for the ×1.1 compounding).
Moves calibration: maybe (S4/S5): no drift keeps frozen models' beliefs narrower, so red flags, Unknown / unseen badges,
gates and Loss-of-control risk ranges read tighter; stream versions widen more slowly than before.

### SR-12

One monitor formula (SAFETY-REDESIGN §3.3): `models/products.ts monitorStop(s, watched, monitor, monitorCompute,
watchedCompute, costRatio, controlled)` → stop contribution = watched share × flag rate × acted-on rate, where watched
share = monitor compute ÷ (watched compute × cost ratio) capped at 1 (AI 2027 fn 51), flag rate = catchRate (Engels gap
rule, AG07 tools, control deferral; same-lineage collusion as `stopColl`), acted-on = MONITOR_ACTED_ON = 1 [D] (a flag
blocks; SR-13's protocol / human review set it). Also strength = watched × min(1, flag ÷ 85%) × acted-on (runtime logs,
internal tool catch). Products: `productMonitor(s, d)`, compute billed to serving `monitorOverhead` = PRODUCT_MONITOR_WATCH
(1 [D]) × FLOP-per-token ratio (MONITOR_OVERHEAD = 0.25 deleted); `productCatch` = its stop. Internal: `useMonitor(s, use)`,
monitor compute = the use's part of the used flat allocation (same pooled coverage as before); `monitorStrength` reads it.
Logs as evidence: runtimeMonitoring's product strength = productMonitor's strength (internal: fleetMonitor, already the
kernel's). actTable: product stop rate and `monitor` read productMonitor (with the table's control override);
`ActSite.monitorParts` carries the parts for products and lanes. **MONU closed** (product monitors on the fn-51 rule; the
tutorial hint for the 17% start coverage is not done: UI, left open). Glossary `monitor` updated. Check:
`npx tsx scripts/v2/_sr12/check.ts` (day400 / day900: same pair → same product and internal catch, collusion too; readers =
kernel; doubling compute doubles watched share until 1, kernel and allocation). scripts/v2/products.ts P4 updated to the
new overhead.
Open: internal catch still = CoT/WB tool detection × (½ + ½ × strength) (the instrument part; SR-13/SR-14 may fold it into
flag rate); product watched share is a constant, not a player setting (SR-13 / SR-26); OD-6 trusted default watcher is SR-20.
Moves calibration: maybe (S4/S5, serving cost): product monitor overhead ×4 (a same-size monitor +100% of serving, a
quarter-size mini +25%); catch numbers unchanged (product watched share 1; internal coverage the same up to float order).

### SR-13

Safeguards as owned items (SAFETY-REDESIGN §2.2 concept 7, §3.3): `Deployment.guards: SafeguardItem[]` ({kind, setting?,
since}); `safety/safeguards.ts` holds kinds, settings, add / remove (`addSafeguard`, `removeSafeguard`, `setControl`),
readers (`controlOn`, `reviewOn`, `isRestricted` / `restrictMult`, `lockdownOn`, `labControlSetting`, `labReviewOn`) and
`safeguardLines(d, …)` = per item: stop contribution on every act, Chances ×, **Slowdown**, compute, people.
One combine rule: Stop rate = 1 − Π (1 − stop_i) over monitor and items; the engine's 1 − (1 − block)(1 − mon)(1 − human)·miss
is that product (control item stop = 1 − (1 − block)·miss), so engine numbers are unchanged. `actTable` returns `guards`.
- **Control protocol**: settings defer10 (Greenblatt 62% → 83% safe, usefulness 97% → 93%) [S], defer20 (92%, 83%) [S],
  resample (Ctrl-Z 58% → 7% attack success at 5% usefulness cost [S]; read as acts slipping past, mapped onto every
  internal act [D]). Slowdown = U0 − (U0 − U)·min(1, trusted gap ÷ 1 OOM) (the old controlProtocol rule, same floats at
  defer10). `controlProtocol(gap, setting)` replaces the `defer` number; CONTROL_DEFER unused. AG07: contain tools are the
  item's block (unchanged `containment`, gated on the item); T-RESAMPLE unlocks the resample setting; T-LOCK unlocks the
  lockdown item. Compute = deferred share × CONTROL_TRUSTED_COST 0.1 [D]; people 0.
- **Human review**: an item on internal deployments (default in init / new internal deployments); without it human = 0
  in catchOf, internalOversight, believedOversight, pressureView. Slowdown 0; people = REVIEW_STAFF 5 per 10% human share [D].
- **Restriction**: replaces status 'restricted' (status is live | withdrawn); usage ×RESTRICT 0.3 (now one constant in
  safeguards.ts; actTable re-exports). Two-way: new response `liftRestriction` (preview + apply; Safety response list).
- **Comms lockdown**: replaces the owned-T-LOCK reads (products catchRate, ideas, traits E21): collusion penalty ×0.5,
  Slowdown LOCKDOWN_SLOWDOWN 3% [D] on internal work (workfit).
SCHEMA_REV 56 → 57: migration maps controlLayer → control (defer10), 'restricted' → restrict item + live, internal →
review, owned T-LOCK → lockdown on internal deployments. hygiene pins 57; SR-06 check ≥ 56.
Check: `npx tsx scripts/v2/_sr13/check.ts` (day400 / day900: defer 20% raises every per-year stop rate on the lane and
costs Slowdown 17% at the 1-OOM gap = useControl's tax; restrict ×0.3 then lift back). Passes.
Open: compute / people costs are readouts, not yet billed (LAB allocation / staff needs); no verb yet to add a lockdown,
change the control setting or remove review (only add / remove control and restrict / lift; SR-26 UI); bots do not add a
lockdown after researching T-LOCK (before, owning it was enough); product control setting reads the lab's; glossary
`controlLayer` term not renamed; stray untracked `scripts/v2/_sr13/{rep,bulk}.cjs` (edit helpers) can be removed.
Moves calibration: maybe (S4/S5): new games lose T-LOCK's effect unless a lockdown is added, and a lockdown costs 3% of
internal work; otherwise same formulas and floats.

### SR-13b

Safeguard costs are charged as their lines show (designer rule: a cost shown is applied).
- **Slowdown**: internal control (useControl usefulness) and lockdown (×(1 − 3%)) were already on the package's AI labour
  (workfit useLabour). New: a product's control protocol cuts its usage by the Slowdown at the full trusted gap, with the
  restriction in one multiplier `productUsageMult(d)` (revenue.ts sector and Chat paths; limitsView line "Control protocol").
- **Compute**: `controlComputeShare(setting)` = deferred share × CONTROL_TRUSTED_COST. Internal: `monitorBudget` pays the
  control compute (Σ agent compute × share) first from split.monitors (`control`, `controlShort`); monitor coverage uses
  what is left; any shortfall comes out of the agents' own H100e (useLabour). Products: `productSafeguardOverhead(d)` added
  to the serving overhead next to monitorOverhead. Add control preview shows the compute line.
- **People**: `safeguardFte(s)` = reviewStaff(1 − aiRdShare) when human review is on (the line's people); `committedFte`
  (investigations + patches + safeguards) replaces the free-engineer sums (actions, footholdDetection, investigations,
  lineProjects, bots/ref); `safetyRe().safeguards`. Review stop is not scaled down when engineers run short (open).
- **Lockdown verb**: responses `addLockdown` / `removeLockdown` (preview + apply; cannotAdd gates on T-LOCK); Control card
  buttons. Bots: `keepLockdown` (bots/common.ts, run from staffLines) adds the lockdown to live internal packages once
  T-LOCK is unlocked, so ref / safe / mixed keep T-LOCK's effect.
Check: `npx tsx scripts/v2/_sr13b/check.ts` (day400: control ×0.97 AI FTE and its compute on the monitors' line; lockdown
added, ×0.97; product control usage ×0.93, +1% serving). Passes.
Moves calibration: maybe (S4/S5): review now takes up to 50 safety engineers early (human share ≈ 1), fewer free for
experiments / cases; product control costs usage; bots now pay the 3% lockdown Slowdown.

### SR-08

Detect techniques are instruments (SAFETY-REDESIGN §2.2 concepts 3–4, §3.2) with one reliability definition.
- **`safety/instruments.ts`**: kinds `tests` (BB) / `reasoning` (COT) / `internals` (WB) / `formal` (OR) / `logs` (a
  reading taken by a monitor in deployment, `instrumentKind(t, 'monitor')`); `instrumentReads(t)` (coverage > 0);
  `instruments(s)` (owned detect tools). `reliability(s, t, {x, v?, trait?, eff?, ea?, obf?}, believed)` = base ·
  penalty, base = s0 · efficacy · D(gap) · (1 − G·trainedAgainst) (techniques.ts `reliabilityBase`; true: hidden efficacy,
  false-validated → 0; believed: posterior mean), penalty = true `familyPenalty` × (1 − falseMask) or believed
  `believedPenaltyParts` (tests = EA factor, legible = CoT legibility, mask = own training-against). Returns the parts.
  `reliabilityReasons(s, t, v, trait?, L?)`: "not validated on V", "capability gap from V −x", "trained against on V −x",
  "notices tests −x", "reasoning not legible −x", "masked by training −x", "line works x%" (−x = % of reliability lost).
- **Validated on**: `TechniqueState.validatedOn / validatedOom` (start tools: V0 / 0; `unlockTechnique` and F49 false
  tools: the internal model at unlock). Decay is on the gap x − validatedOom (oHalf = the gap's half point; AG05 keeps
  the overseer gap, AG09 the latent override). `trainedAgainstOn` set by goodhartTrain. SCHEMA_REV 58 (migration 57 →
  58: validated on V0, gap as before).
- **Callers**: detection (familyDetection, stackDetectionMap), understanding (believed detector: reliability().value ×
  valAt above the measured level; trueUnderstanding: true value, now including the false-tool mask), actTable (misuse
  classifier strength). strengthTrue / strengthBelieved are wrappers of reliabilityBase for the other callers (agendas,
  ideas, incidents, investigations, pressureView, responses, view, selectors); not yet migrated. Reasons are not in the
  view yet (SR-11 / UI). valAt (believed extrapolation above the current level) kept; SR-09 validation evidence replaces it.
Check: `npx tsx scripts/v2/_sr08/check.ts` (day400: familyDetection = combine(cov · reliability base); detectionAt =
cov · reliability value; reliability full on the validated model, falling with the gap 0.406 → 0.290 over 8 OOM). Passes.
Moves calibration: maybe (S4/S5): tools unlocked mid-game now decay from the model they were unlocked on, not from V0
(stronger later in the game, true and believed U up); start tools and old saves unchanged.

### SR-11

One **sight limit** (SAFETY-REDESIGN §2.2 concept 5, §2.3) replaces understanding U, margin, validated-to, seen-to,
likely range, BLIND/AHEAD and the detection grid.
- **`safety/sightLimit.ts`** (was understanding.ts): `sightLimit(s)` = { L, lo, hi, level, gap = L − level, perTrait }:
  the highest level where the active instruments together read the hidden-goal traits (CRITICAL_TRAITS mean) at ≥ 50%
  believed reliability (SR-08 `reliability()` at the hypothetical capability, so each decays from its validated model;
  valAt extrapolation and EA projection kept until SR-09). Range = 10th–90th percentile over 24 Latin-hypercube draws
  of line efficacy from the Beta posteriors (efficacy only now; EA / OBF draws dropped). `sightLimitPoint` (no range:
  weekly series, bots, decision snapshot), `sightGapBelow` (E17 early-exit), `plannedSightLimit(s, predictedL)` (TRAINING
  planned-run readout, not yet wired), `sightGrid` (drill-down), `trueSightLimit` (engine only: ws2.gapTrue, analysis).
- EngineApi `understanding` → `sightLimit`; safetyView `understanding` / `nextDecay` → `sightLimit`; riskFamilies lost
  `seenTo` (Safety's weakest family now = lowest mean reading at the model's level). Series key `U` and DecisionSnapshot
  `U` kept as field names (now the sight limit). Glossary: U, uRange, validatedTo, blind, gap deleted; sightLimit added.
  upkeepView.validatedTo still computed (behindInMonths) but no longer shown. Analysis scripts read it through local
  adapters in the old shape.
Check: `npx tsx scripts/v2/_sr11/check.ts` (day 0: efficacy posteriors up → 5.55 → 5.75; validated 3 OOM further back
→ 5.55 → 5.45; range 5.45–5.65 brackets the point). Passes.
Moves calibration: maybe (S5 reads U): the U range now draws efficacy only (narrower), point value unchanged.

### RD-E01b

Paradigm typed effects, part 2 (DD-14; SYNTHESIS RD-E01b; CAP-02). Commit f7fff3f.
- **P05** (multi-agent orchestration): the flat ×1.3 on all agent FTE (useLabour; it also hit the safety package) is
  gone. Adopted, it is a scaffold on the lab's internal agents in SWE / EXP / IDEAS (data/v2/features.ts
  P05_ORCHESTRATION, pushed in worldfx/serving.ts internalFx like a built feature): ΔG +0.26 OOM [D], tokens ×3.75
  (multi-agent ~15× chat tokens ÷ single agent ~4× [P Anthropic, research/12 §3]). ΔG is set so that at the reference
  fit (coverage 0.5) with AI labour abundant (ρc −2: L ∝ (1 − a)^−1.5) the slot's effective labour is ×1.3. The old
  ×1.3 on FTE did almost nothing in play: AI team-equivalents are ~200–400× the humans at the start, so FTE are not the
  bottleneck. Start lab (ai2027, seed 1) with P05: EXP L 15.17 → 16.39, SWE 9.01 → 10.52; AI taste on IDEAS rises
  with the fit (workContext reads internalFx). Safety work no longer gets it. Deep-think effort unlock kept.
- **P20 deleted** (no primary source in research/ for an effect beyond the copies AI labour already counts; research/12
  #20 cites only AI 2027's copy counts). Gone with it: ×(1 + 0.1·payoff), S8 = 1 override (S8 = copies / 300k +
  0.2·[P05]), U19 ×1.3 presence (UMODE_PRESENCE.p20U19), the Pressure row's P20 text. **payoffOf deleted** (selectors,
  Research card's "now x%"); nodes' `payoff` text stays.
- **Draw order:** SKIPPED_DRAWS is now id → list: { P14: [0.75], P21: [0.6 (P19), 0.8 (P20)], P27: [0.8] }; every
  other paradigm's draw is unchanged.
- **P07:** no ×1.2 on every post-train's h80Mult. It multiplies the long-tasks RL family's h80Mult (2 → 2.4) on
  post-trains launched after adoption (frozen PostRecipe.p07): data/v2/runDesign.ts P07_LONG_TASKS_HORIZON, applied in
  models/design.ts rlFocusEffect via postEffect(d, longTasks), the place family horizon multipliers already live.
  Broad-focus and other-family runs get nothing from P07 now. Existing versions keep their frozen h80Mult.
- **Save:** SCHEMA_REV 55 (on p3-c 50; renumbered at the merge into rd), migration 54 → 55 drops P20 paradigm, tree and draw entries. hygiene rev checks → 55.
- **Check (scripts/v2/.tmp-rde01b.ts, run alone, untracked):** no P20 node / paradigm / prerequisite / state / draw;
  payoffOf not exported; adopting P05 gives EXP +0.26 OOM fit, ×3.75 tokens, AI FTE ÷ 3.75 (no ×1.3), SAF_EXP
  untouched; deep think still locked behind P05; ×1.3012 effective labour at coverage 0.5, AI/H 300; postEffect
  long-tasks h80Mult 2.4 with P07, 2 without, broad / swe 1. tsc main and scripts clean; `npm run build` passes.
- **Not touched:** design/TECH-TREE.md P07 / P05 / P20 rows (still the old text); calib.ts `--fit-tree` targets.
- **Moves calibration: yes** (P05's gain changes shape and size and leaves safety work; P20's agent and S8 / U19
  effects gone; P07 only on long-tasks-focus runs; RefBot researches P05 / P07; refit at CP2).

### RD-A08

- **Done:** the serial-speed limit line is gone (core/limitsView.ts row, data/v2/limits.ts `speed.serialCap`, the
  Company label). The duplicate cap (PROD_SPEED_CAP in calibration.ts) was already gone; SPEED_CAP stays only inside
  workfit `speedOfCopy` (copies / speed readouts). S8 (player `deploymentS8` and rival postures) now reads
  `prodCache.labor.agentFte` (new field: AI FTE of Experiments + Research ideas agents, a rival's whole agent pool;
  fteOfFpt × compute) against `S8_FTE_REF` = 7.1M FTE (the old 300k copies at 5.4× × 8,766 / 2,000 h). Pressure tab
  and glossary text say AI FTE.
- **copiesOf kept:** safety/incidents.ts (serving incident size) and the copies readouts (workfit slots,
  agentActions, rivalModel, researchView / production `copies`).
- **Check:** tsc main and scripts clean; `npm run build` passes; targeted check (day 0, ai2027 seed 2027): S8 0.079 /
  0.317 / 1 at 1× / 4× / 16× compute; no `speed.serialCap` row.
- **Moves calibration: maybe** (same S8 scale; S8 now includes per-version usefulness and token overhead inside AI
  FTE, which copies did not).

### RD-A04

One allocator for the safety research engineers (theme A, SAFETY-REDESIGN §5, OD-9 (a)). Commit bfec9fb.
Moves calibration: **maybe**.

- **Needs list:** `SafReNeed` = cases (open investigations' fte), patches (patch + foothold removals, patchFte),
  safExp (line experiments: each experimenting project in priority order asks SAF_RE_UNIT × min(LINE_MULT_MAX,
  cap ÷ SERIOUS_CAP), as before), reval (tool re-validation: `revalDemand` = tools in upkeep × (UPKEEP_MIN + UPKEEP_MAX ×
  UPKEEP_REF) ÷ m of safety experiments, the engineers per tool at which the upkeep rate saturates; 0 with no fading
  tool). `safAllocation` runs models/research.ts `allocate()` over `research.safRe` (the player's order, caps as the
  capability list); what no need takes is `idle` (SafAlloc.idle, safetyRe().idle, safety view staff.idleRe). Compute
  part unchanged (the flat allocation's safety line; flop by engineers × computeRef).
- **Default order** = the pre-RD-A04 sequence: cases, patches, line experiments, re-validation (DEFAULT_SAF_RE_ALLOC),
  without the 50% cap. SAF_EXP_SHARE deleted.
- **Served amounts act:** a case below its staffing gains clarity at the engineers it gets (`casesServed`, investigations
  caseRate × share served). Patches / removals keep fixed durations (their need is served or not; effect → RD-S05).
  Tool upkeep and the validation lead (reValidationMult) read the re-validation need's engineers.
- **Behaviour changes (why "maybe"):** experiments are no longer capped at 50% of the free engineers (a lab short of
  engineers now fills its projects before upkeep); re-validation takes at most its demand and the rest is idle, so the
  validation lead (believed U only; RD-S04 deletes it) no longer counts free engineers when no tool fades.
- **Action / UI:** `research.safReAlloc` (order, need + max / share); Company › Work card "Safety research engineers"
  (NeedList with gets / needs, caps, idle); `safReAllocView`; glossary `safReNeeds`, toolUpkeep reworded (GLOSSARY.md
  not regenerated).
- **Save:** SCHEMA_REV 56; migration 55 → 56 adds research.safRe at the default order; hygiene rev pins → 56.
  scripts/v2/safetyresearch.ts' rig keeps twice the ask of engineers (was ask ÷ SAF_EXP_SHARE).
- **Check:** `npx tsx scripts/v2/_a04/check.ts` (day-400 fixture migrates with the default order; with 60 people over
  cases 40 / patches 10 / experiments 37.5 the served amounts follow the default and a reordered list; partial order
  ignored; a cap flows down; spare engineers idle; no SAF_EXP_SHARE in src). tsc (app, scripts/v2) clean; npm run build
  passes. Not run: safety suite, test:cal (RD test rule; CP2). The re-validation demand is not exercised by the fixture
  (no fading tool at day 400).

### RD-R02a

Safety line projects on the shared units and the shared experiment-pool rule (theme R, SAFETY-REDESIGN §3.1; SAF-02,
SAF-03). Commit dca648d. Moves calibration: **maybe**.

- **Labour:** ℓ = (m_exp × engineers ÷ RE_LABOUR_UNIT)^λ, engineers in research-engineer team-equivalents
  (heads × quality ÷ TEAM_SIZE.re; the allocator still works in heads × quality, so lineProjects converts at
  HEADS_PER_LABOUR_UNIT = RE_LABOUR_UNIT × TEAM_SIZE.re = 200). A serious programme asks `SAF_RE_ASK` = 0.25 labour
  units (= the old 50 heads; a staffing need like RE_MAX_PER_PROJECT, not a unit) × min(LINE_MULT_MAX, cap ÷ SERIOUS_CAP).
- **Compute:** c = project FLOP/day ÷ (computeNeed × C_UNIT_FLOP_PER_DAY). `AgendaDef.computeNeed` = computeRef ×
  1e6 H100e × PHI ÷ C_UNIT = computeRef × 96.8 (11 × 0.88 ÷ (0.05 × RE_LABOUR_UNIT)): the agenda's demand multiplier
  relative to a capability project; c at the old reference compute is exactly the old c. Codex row shows it.
- **Pacing conversion:** at reference ℓ = SAF_RE_ASK^λ (0.5 at λ 0.5), not 1, so the stage rate is X ÷ X_ref with
  X_ref = Xces(P, 1, SAF_RE_ASK^λ): rate 1 and first result at T₁ at reference inputs. Away from reference the CES mix
  differs from the old one (the old ℓ = 1 point sits at ℓ = 0.5 in the shared unit; ζ ≠ 1 so this is not an exact
  rescale): why "maybe".
- **FLOP by need** (RD-B08 rule): line pool ÷ Σ needs (ask × computeNeed per experimenting project); a project with
  engineers takes its full share, one with none leaves it unused (was: by engineers got × computeRef, shares moving to
  the others). `share` per agenda and recomputeComputeShares follow.
- **Deleted:** SAF_RE_UNIT, SAF_C0_H100E. SERIOUS_CAP stays (the reference science staffing; ideation keeps
  (m × cap ÷ SERIOUS_CAP)^λ; RD-R02b's one stepper decides it). scripts/v2/safetyresearch.ts compiles (REF_RE_HEADS),
  not run.
- **Check:** `npx tsx scripts/v2/_r02a/check.ts`: every agenda's first result at reference inputs vs T₁, worst 0.8%
  (±5%), c = 1.000, ℓ = 0.500. tsc app + scripts/v2 clean.

### RD-R02b

Safety projects on the shared project stepper (SAFETY-REDESIGN §3.1; replaces DD-15 / DD-16's candidate pool; SAF-01,
SAF-08, SAF-V02). Commit fcc5614. **Moves calibration: yes (safety).**

- **One stepper.** `stepProject(s, ctx, n, day: ProjectDay)` (models/research.ts): `dept: 'cap'` runs the capability
  lifecycle as before; `dept: 'saf'` runs one "does it work" test (SafProjectState {work, workNeed = the agenda's T₁
  months, flop}) through `stepTest`, the same day-step RD-R05's unlock projects now use: the science rate ((m_ideas ×
  capacity ÷ SERIOUS_CAP)^λ × taste × speed ÷ 30) and the experiment CES rate (X × speed ÷ 30 X_ref, RD-R02a units) add
  on the same work, so at reference inputs a test takes T₁ ÷ 2 (as unlock projects: science time counts toward the
  whole effort). Rates: safety/lineProjects.ts lineRates (`idea` → `sci`). speed = researchMods (lineSpeed and its
  dead-end half speed gone; RD-A07 still owns the flat modifiers).
- **Works draw.** `safetyWorks`: hash32(seed, 'saf:'+id+':'+attempt) < the agenda's true efficacy. Works → findings.ts
  `nodeTestResult`: the node's own catalog row (`ownRow`), its generic technique, or the idea itself; never another
  node's row, never past `needs`; a row whose `requires` fail in this world ends as failure (SAF-V02). Posterior a + 1.
  Doesn't → `<AG>-DEAD` record (nodeId set), posterior b + 1 (was + 2), deadEnd status below 25%; the project restarts
  (attempt + 1) at the posterior odds; the attempt's team-months go to the line's dead-end count as before.
- **SAFSAB kept** (shared `sabotage` helper): on a working node result with the line's threat; caught → result lost
  (no record, retry); uncaught → FALSE (masking tool `falseTool`, record trueType FALSE shown as the tool, the lab
  takes the node as known; its real technique is not unlocked). fireFinding uses the same helper.
- **Open study.** A line's follow-up keeps fireFinding's events (TECH / DEAD / NEG / DISC / SPILL / FALSE); its TECH
  draws only rows no node owns (`NODE_ROWS`, SAF-08).
- **Deleted:** candidate pool (SafCandidate, cands, newSafCandidate, readStage, betaBand / readInto), SafStage,
  SAF_PICK_AT, SAF_POOL_MAX, SAF_BELIEF, lineSpeed, stepLineProject. SCHEMA_REV 57: migration 56 → 57 restates a
  running safety project at its progress (work = progress × T₁).
- **Readouts:** lineEtaDays = work left ÷ (sci + exp); lineCycleDays = T₁ ÷ (sci + exp).
- **Scripts:** safetyresearch.ts compiles on the new stepper (section 3, belief noise, removed; its E1 pacing
  expectations are stale: T₁ ÷ 2, no pipeline overlap), safetyideas.ts reads researchMods for lineSpeed, _r02a/check.ts
  on stepProject (now expects T₁ ÷ 2), hygiene.ts rev 57. None run.
- **Check:** tsc app + scripts/v2 clean; npm run build passes; `npx tsx scripts/v2/_r02b/check.ts` (no pool / beliefs /
  lineSpeed / line stepper in the source; one stepProject for dept cap and saf; all 33 safety nodes: works → only own
  row / technique, doesn't → dead end with b + 1; a node run on the real stepper ends in DEAD or its own row).

### RD-R03

Safety science teams on the capability planner (SAFETY-REDESIGN §3.1, §5; SAF-03, SAF-23, INP-15). Commit c9ff03f.
**Moves calibration: maybe** (safety teams beyond the bots' staffed lines now idle; lines no longer auto-continue).

- **One planner.** `planAssignment(s, ready, dept = 'cap', valueOf?)` (models/research.ts) serves both departments:
  priority list, teams wanted (`research.want`, shared), one swap pass and spares by value under PROJECT_MAX_TEAMS.
  models/tree.ts `assignSafTeams` / `planSafAssignment` run it daily for 'saf' over `safReady` (queued, ready safety
  projects in queue order); each team gets a `why`.
- **Value proxy [D]:** `safProjectValue` = (m_ideas × C ÷ SERIOUS_CAP)^λ × taste × speed ÷ 30 (the science part of
  lineRates) ÷ the test's workNeed × chance it works (nodeOdds, the line's posterior mean) × `SAF_LINE_WEIGHT[agenda]`
  (data/v2/research.ts, default 1; only ratios matter within the department).
- **Idle stays idle.** Nothing queued → no safety team placed, nothing queued for the player. `safIdleFlag(s)`:
  "2 safety teams idle — add projects to the priority list" (or the planner's reason when projects exist but none
  gains); shown on Safety › Research lines (replaces "· N idle").
- **Deleted:** autoAssignDept, autoAssign, lineForTeam, onLine, PRIORITY_W, continueLine (a finished node's teams are
  freed; the line's next project waits for the player), the `research.autoAssign` action and `ResearchState.autoAssign`
  (old saves keep a stale field, unread). RefBot no longer turns the toggle on (its staffLines places its line teams
  by hand as before). scripts/v2/research.ts B35 auto-assign preview check removed; worktypes.ts no longer sets it.
- **Player text:** glossary `autoAssign` → "Safety team placement"; Company team-effect tooltip and team hire preview
  say a new safety science team joins the queued safety projects or waits idle.
- **Check:** tsc app + scripts/v2 clean; npm run build passes; `npx tsx scripts/v2/_r03/check.ts` (no auto-assign
  left; nothing queued → 0 placed, flag text; queued two lines → priority / teams wanted honoured, priority 1 wanting
  every team takes them all; after a research day teams only on queued projects).

### RD-R04

Rolled tree path and the paradigm mirror gone (SYNTHESIS §6 Phase 3; CAP-15, SAF-18). Commit 1ff5271.
**Moves calibration: maybe** (P27 now resolves on AG17's works draw at the line's T₁, not its paradigm prior at the old
rolled speed; teams on P27 now count as AG17 staffing: harness fit and SAF_IDEAS labour; P27 waits on AG17's safety-model gate).

- **Deleted (models/tree.ts):** roll(), researchSpeed, the rolled branch of researchDay (progress bar, retry date, odds
  halving), syncParadigm; projectRate / projectEta are research-line only (else 0 / Infinity); projectReady's retry
  reason; nodeOdds has no multiplier. TreeNodeState.priorMult / retryDay gone (TreeNodeState left one interface: [D]
  the discriminated union skipped for the budget). TREE_RETRY_DAYS gone from data; RefBot keeps `REF_RETRY_DAYS` 180.
- **kyc:** node deleted (and from the starts' known lists); the per-product KYC setting stays ungated.
- **P27:** an `S` node of line AG17 (no `paradigm` flag; effort = AG17's line effort); effects unchanged (workfit
  `adopted(s, 'P27')`, safety/ideas.ts aarAuto). Removed from PARADIGMS; its hidden draw is consumed in place
  (world/hidden.ts TRAILING_DRAWS [0.8 P26, 0.7 P27]), so later world draws keep their values.
- **Mirror:** PlayerLab / LabCore `paradigms` and ParadigmState gone; initialParadigms gone. `adopted(id)` (models/paradigms.ts
  and safety/common.ts) = `tree[id].status === 'known'`. Readers repointed: RefBot (P08, P17, P23), actions (P08, P18),
  theft (P25), agent-action cache key (P27). completeAdoption's onKnown is optional (build.ts passes none).
- **Player text:** glossary `retryRule` and limit `tree.retry` gone (and the tree's retry readouts); [D] to satisfy the
  `researchSpeed` grep, researchSpeedLimits / researchSpeedView / researchSpeedRel and the glossary id `researchSpeed`
  are renamed `labSpeed*` / `labSpeed` (title unchanged; GLOSSARY.md not regenerated).
- **Schema:** SCHEMA_REV 58; migration 57 → 58 drops player.paradigms, hidden.paradigmSuccess.P27, the kyc record / queue
  entry / team placement, every tree record's fields outside TreeNodeState; a rolled P27 attempt becomes its AG17 test at
  its progress (work = progress × T₁), a failed one reopens. Older migrations no longer touch the mirror (53 reads P24 via a cast).
- **Check:** tsc app + scripts/v2 clean; npm run build passes; grep `researchSpeed|syncParadigm|player.paradigms|priorMult`
  in src empty; `npx tsx scripts/v2/_r04/check.ts` (source clean; kyc gone, P27 an AG17 line node; new game: no mirror,
  ★ adopted; P27 works → known = adopted, doesn't → AG17 b + 1; rev-57 save migrates). hygiene's rev literals → 58 (not run).

### RD-A05b

Spare-compute policies removed per DD-19; one explicit Auto-split policy; real compute for cases. Moves calibration: **yes**
(idle training compute no longer feeds data generation, the old default; spare serving no longer adds routine agents;
share recovery always full speed; case rate reads H100e).

- **Gone:** `policies.spareTraining` / `spareServing`, actions `runs.spareTraining` / `serving.spare`,
  `spareServingToResearch`, `LENT_RECOVERY`, `spareServingEffect`, the idle / spare parts of `expPoolH100e`,
  `synPoolH100e`, production.ts inputs (`mixUnit.idle/cIdle/spare/kSpare`), workfit `useLabour`, covert
  `internalFleetCompute`; RefBot's spare options. `spareServing()` renamed `idleServing()` (H100e no product needs).
- **Auto-split** (`departments/autoSplit.ts`): `policies.autoSplit = { on, to, last? }`, default off, to experiments.
  Daily system order 62 (after revenue): moves unallocated + idle training + idle serving + monitors beyond coverage to the
  listed uses in equal parts (min move 0.1 pt), logs it, keeps `last`. Action `compute.autoSplit {on?, to?}`.
- **Cases:** `caseRate(s, g, fte, h100e)`; `caseH100e(s, share)` = online × split.safety × granted share (a demand inside the
  safety research line, lines take the rest); reference `CASE_H100E_REF` = 5% of the reference start line [D].
- **UI:** Split shows "Idle" under training, serving and monitors; Auto-split row (switch, idle now, uses to send it to).
  Run queue "Idle" row; Products serving bar segment "idle"; Company Flow spare row gone; glossary idleCompute,
  idleServing, autoSplit (old stale Auto-split entry replaced); watch item text.
- **Save:** SCHEMA_REV 56; migration 55 drops the two policies, adds autoSplit off; hygiene pins → 56.
- **Check:** `npx tsx scripts/v2/_a05b/check.ts`. Budget hit: 9/12 pass. Left: the check's setup does not create idle
  serving on day400 (moving 10 pt training → serving gives idleServing 0: likely products absorb it or needH100e unset;
  the "idle serving stays idle" assertion needs a setup that really leaves serving idle), and its "moved" test is too
  strict (Auto-split moved 29.6 pt, mostly idle training). `npm run build` not run. grep: only the migration names the
  old policy keys.

### RD-A06

AI staff packages name their model, have their own control layer, and internal tooling is its own owned item (DD-03).
Moves calibration: **maybe** (eng / frontier / safety packages with no pick now run the newest cleared full model instead
of following routine research; built Memory / Coding agent / Deep research no longer help internal work unless the lab
builds the tool; feature upkeep of a feature on no product drops to keep-alive; Add control now covers the packages
running that model, not every package).

- **Model:** `newestInternal(s)` (departments/agents.ts) = newest ready / deployed full model (routine's while none);
  `agentVersion` = own live pick, else that (the "as routine" fallback is gone). Lane flag `follows` → `newest`; the
  picker's empty option reads "newest · Vx". Routine research still sets the internal deployment.
- **Control:** `AgentPackage.control?`; `useControl(s, model, monitor, on)` reads the package; `underControl(s)` = any
  package on. `syncInternalControl(s)` keeps the internal deployment's `controlLayer` (read by covert / incidents /
  believed oversight containment) = a package running its model has control. Set by `agents.set {use, control}`, the
  addControl / removeControl responses (packages on that model) and the E-event "Continue + control" (all packages).
- **Tooling:** data/v2/features.ts `INTERNAL_TOOLS` (Coding harness ← Coding agent SWE +0.3 ×2 tok; Research harness ←
  Deep research IDEAS +0.3 ×3 tok, P05 gate; Agent memory ← Memory horizon ×1.3 all, P07 gate; same team-weeks / cash);
  `player.tooling`; build kind `tooling`; action `tooling.build {id}`; upkeep line `tooling` (always in use). `internalFx`
  reads tooling + P05 orchestration only; the features' SWE / IDEAS work entries removed, effect texts say product only.
  `featureInternal` deleted (productView `internal` now empty). Starts: `toolsFromFeatures(start features)` (leader none,
  challenger Coding harness). Rivals: not yet (DD-03 rival part later).
- **UI:** Company › Agents at work: per-lane "Control on/off" button (tooltip agentControl), a Tooling row (built ✓ /
  building days / Build button with effect tooltip); BuildLoad labels; glossary agentTooling, agentControl.
- **Save:** SCHEMA_REV 57; migration 56 → tooling from built features, package control from the internal deployment's
  flag; hygiene pins → 57. Scripts setting `controlLayer` on the internal deployment also set package control.
- **Check:** `npx tsx scripts/v2/_a06/check.ts` (12/12): features leave internal fit and build capacity unchanged; the
  Coding harness via the build queue gives SWE +0.3 OOM; starts / rev-56 save own the equivalents; no pick = newest;
  control on one package only. tsc (main, scripts) and `npm run build` pass.

### RD-T01a

A run kind field replaces the IDA name check (DD-06, TRN-08). Moves calibration: **no** (state hash identical to the
previous commit with the new field stripped).
- **Mapping:** every way a model is made is a TrainingRun `kind` plus one option. base / continue = pretraining (new or
  continued base); distill = a small model on a teacher's outputs (`teacherVersionId`); post = RL on a base; IDA = post
  with `grader: 'teacher'` (RL with the teacher, `teacherVersionId`, as grader; P18). The stream is not a run
  (`models.stream`) and is unchanged. Imported / variant models are not runs either.
- **Code:** `TrainingRun.grader?: 'teacher'`; `LaunchRunParams.ida` → `grader`. Every `name.startsWith('IDA')` is now
  `grader === 'teacher'`: run completion (runs.ts), `runOmega` / `runRho` (traits.ts), `versionPressure` /
  `plannedPressure` (pressureView.ts), `reOpsNeed` (research.ts), RefBot `askShare` (ref.ts); run-likes for previews
  (selectors.ts, pressureView.ts, runs.ts) carry `grader` instead of the name "IDA". The run name stays "IDA n".
- **Save:** SCHEMA_REV 58; migration 57 → 58 sets `grader: 'teacher'` on post runs named "IDA …"; hygiene pins → 58.
- **Check:** `npx tsx scripts/v2/_t01a/check.ts`: IDA run carries the field, a post run does not, a rev-57 save gets it
  back from the name; after 150 days (IDA finished) the stripped state hash is 9fd770432d0ac490 on this commit and on
  the previous one (same script on an archive of HEAD~). tsc (main, scripts) pass; `grep "startsWith('IDA" src` empty.

### RD-T01b

Two training acts, engine structure only (DD-06, TRN-06; theme T). Commit fa60a15. Moves calibration: **no** (run,
made-model and state hashes identical to the previous commit for all five former kinds).
- **Acts.** `runAct(kind)`: `'pretrain'` (kinds base / continue / distill) or `'rl'` (kind post). The run kinds stay
  the save format (no schema bump); the engine reads them as act + source / start.
- **Pretraining** (`pretrain(s, src, rec?)`, one path): `PretrainSource` = `design` (new base on the portfolio),
  `continue` (parent + added FLOP) or `teacher` (student size nS, tokens of teacher outputs). Sources come from launch
  params (`pretrainSourceOfParams`) or a launched run (`pretrainSourceOfRun`); the result (`Pretrained`: FLOP needed,
  cash, scale, flop / params / tokens / gPre / ePre / sD / fpt / monitorability) feeds both `planPretrain` and
  `completePretrain`. Blueprint limits are read from the design source.
- **RL** (`rlBuild(s, start, design, rec, extra)`, one path; replaces postBuild and idaBuild): `RlStart` = a base
  (fresh RL: design focus weights, design effects, domain effects, run penalty at completion, design serve cost) or a
  version (the teacher-as-grader option, IDA: more RL FLOP on its build, best of its and the run's recipe and suite
  fidelity, its RL mix, serving, design and traits kept). Budget `rlFlopOf` = RL_BUDGET[design] or IDA_RL_SHARE × base
  FLOP. `planRl` / `completeRl`.
- **planRun / completeRun** are the act dispatch plus the shared tail (setup, ETA, cash / pause reasons, prediction).
- **[Q] quirks kept, not fixed:** (1) a distilled student has no BaseModel of its own: it is a mini version on its
  teacher's base whose build is the teacher's minus the gap (materialising a base would change state); (2) RL on a
  version is reachable only with the teacher as grader (no launch parameter for plain RL on a version); (3) the IDA
  preview's serve cost / monitorability are the fresh-RL formula (completion keeps the teacher's); (4) IDA ignores the
  design's RL budget and focus (IDA_RL_SHARE, the teacher's mix); (5) only fresh RL consumes the pending run penalty.
- **effective.ts** unchanged (its arithmetic already is per act: pretraining, RL, distillation).
- **Check:** `npx tsx scripts/v2/_t01b/check.ts` (day-400 fixture; base, continue, post, distill, IDA each launched,
  setup and FLOP forced, one tick): hashes before = after, e.g. base run 9eeaf8a0c2210830 / state d8a2b5f88780b9cc,
  IDA run e879d56046092371 / state e3bce3a7bb61d547. tsc (main, scripts) and `npm run build` pass.

### RD-T02

Continue runs draw tokens from the portfolio (TRN-07; theme T). Commit f86f4fc. Moves calibration: **maybe** (on the
unchanged day-400 portfolio a continue run already repeats: cumulative epochs 1.67, the added part's data factor 0.94,
so continued bases are a little weaker than before).
- **Draw.** `continueDrawNow(s, parent, addFlop)` (runs.ts): added tokens = added FLOP ÷ (6 · N_active), drawn with the
  parent's data option through `playerDraw` (new optional `tokens` arg) / `drawData`, cumulative on the parent's
  tokens (so each slice's epochs count the parent's use), plus `prevDEff` = D_eff of the parent's tokens alone on the
  same portfolio. Stored in the launch snapshot (`RunRecipe.draw`, new `RunRecipe.prevDEff`); plan reads today's.
- **[D] Added part's data factor** `continueFData` (effective.ts): effective compute adds, so f_add = (D_tot · f(D_tot)
  − D_prev · f(D_prev)) ÷ D_add with f = fDataEff (Besiroglu, quality and repetition), both draws on the launch
  portfolio; 1 on the 2025 reference data, ≥ 0. `continueGPre` takes it (new last arg, default 1). ePre still "what
  remains", so it now carries f_add too. A snapshot without prevDEff (hand-built runs) keeps f_add 1.
- **Base.** A continued base's `epochs` = the cumulative draw's (was copied from the parent); tokens unchanged formula.
  Trait hook reads the cumulative draw (shares, so S5 barely moves).
- **Schema 59:** migration 58 → 59 redraws in-flight (running / paused) continue runs on the save's day; idempotent
  (skips runs with prevDEff). hygiene SCHEMA_REV literals 58 → 59.
- **Check:** `npx tsx scripts/v2/_t02/check.ts` (day-400 fixture, continue launched and forced done; portfolio × 0.02 vs
  × 1): epochs 83.5 vs 1.67, f_add 0.58 vs 0.94, gPre gain 0.219 vs 0.314 OOM; base epochs = draw epochs. tsc main +
  scripts pass.

### RD-T03

The continual-learning stream on the FLOP actually spent (DD-05, TRN-02; theme T). Commit 1903239. Moves calibration:
**yes (SIAR/ASI)** (the player's stream no longer re-applies today's whole recipe for free, rivals stream from day 0
with no L 8.5 threshold; on the day-400 fixture one player period adds 0.119 OOM, one rival week 0.141 OOM).
- **Player** (models/runs.ts): the stream's pool share (STREAM_POOL_SHARE × training pool × goodput × ops served)
  accrues FLOP daily (`stream.flop`); every STREAM_PERIOD_DAYS = 7 (was the 7-day tracking lag; `periodDay`) it is spent
  on the two acts on the streamed version: a continued-pretraining increment (the continue source on the version's
  weights: tokens drawn with the base's mix cumulative on the base's and earlier periods' tokens, new
  `VersionBuild.addTokens`; continueFData; continueGPre with today's recipe at the new FLOP; flopPre grows) then an RL
  refresh (rlAddOnVersion: effective RL compute adds, e_RL the FLOP-weighted mean in 10^e units; ceiling raise and suite
  fidelity move by the added FLOP's share, never down). **[D]** Split: the stream's pool time as the version's own
  pretraining : RL FLOP; RL at MFU_RL_FACTOR. `startStream` changes nothing until the first period. `stream.track`,
  trackNow / trackOf / streamBuild / startTrack / streamRecipeGap gone; stacks.ts inPlaceRecipe reads the build.
- **Previews** (models/actions.ts): start / stop read `streamPeriodGain`, the mechanism (streamPeriodBuild) run on a
  copy of the version at today's pool for one period (not previewTick: the stream acts once a period, a one-day tick
  would show 0); the gain line names the period's FLOP.
- **Rivals** (actors/rivalModel.ts, DD-18 stand-in): `clRefresh` every CL_DAYS spends the FLOP of CL_POOL_SHARE (0.15,
  the player's share) of the training pool since the last period (`clApply`): continued pretraining of the internal
  model's streamed G_pre (continueGPre, reference data) and an RL refresh at the reference RL FLOP (effective RL compute
  adds; ceiling by FLOP share); RL : pretraining split = RL_BUDGET.standard [D]. New `RivalPhys.cl` (streamed state on
  base gen/flop, lazy); `clReset` after each post version / new base (RL at today's recipe, streamed pretraining kept);
  newVersionG keeps the streamed G_pre. CL_LEVEL, clG, learnsOnline removed: no level threshold, from day 0.
- **[Q]** the rival post-training cadence still re-applies today's RL recipe at a reference budget without counting
  FLOP (unchanged); rivals' stream needs no P08-like adoption (the task's rule: no threshold).
- **Schema 60:** migration 59 → 60 drops `stream.track`, starts the period on the save's day. hygiene literals 59 → 60.
  Glossary `stream` text updated (GLOSSARY.md not regenerated). lint-tradeoffs' B37 block adapted, not run.
- **Check:** `npx tsx scripts/v2/_t03/check.ts` (day-400 fixture, mechanism called directly): player 0 FLOP adds
  nothing; effective compute per FLOP constant (pre 51.4 vs 51.7 at ×0.5 / ×2, RL exact); the daily system spends the
  period on day 7 only; rival 0 FLOP 0, effective compute ×2 for 2× FLOP, same ΔG at L 8.4 and 8.6. tsc main +
  scripts and `npm run build` pass.

### Merge rd into p3-c2

rd's schema chain kept (56 A05b, 57 A06, 58 T01a, 59 T02); p3-c2's renumbered: 59 → 60 (RD-A04), 60 → 61 (RD-R02b),
61 → 62 (RD-R04); SCHEMA_REV 62, hygiene rev literals 62. Cases: A04's casesServed() FTE with A05b's caseH100e compute; the
agents' readout key reads adopted(P27) (R04) and the tooling list (A06); spareServingEffect gone (A05b) with R04's labSpeed* names.

### RD-A07

Flat research modifiers made physical, one helper for both departments (departments/workfit.ts `researchMods`, read
by models/research.ts, safety/lineProjects.ts, production/production.ts). Commit cb2cb96. **Moves calibration: maybe.**

- **Pause = no experiment FLOP for frontier projects** (`frontierExp` 0, `expFlopAllowed(s, dept, flop)`). Frontier =
  the capability department's projects (their tests run on the frontier experiment pool and scale toward the frontier
  run): capResearchDay's project FLOP is 0 while the pause lasts, so their tests stall. Ideation goes on at full rate;
  safety research-line projects (agenda-sized compute) keep their FLOP (they were ×0.1 before). The lab readout
  (production.ts) puts the experiment compute c to 0 instead of ×0.1; LIMITS line reads "no experiment FLOP".
- **Clearances = heads off the teams for 60 days** (`onDuty(s, t)`: heads − round(10% × heads)): sciOn, safSciOn,
  capReCapacity, humansOf. The `humans` ×0.9 factor is gone.
- **[D] multipliers kept (speed):** siloing −5%/level (who cannot share experiments is not modelled), ASIC migration
  −15% (the port is not modelled), verified treaty ×0.65 (gov.treaty has no compute limit to cap FLOP with; = rateMult).
- **Check:** `npx tsx scripts/v2/_a07/check.ts` (pause: cap experiment FLOP and rate → 0, safety FLOP and ideation
  inputs unchanged; clearance: speed unchanged, science and RE capacity −10%, back after). tsc app + scripts/v2 clean.

### RD-T04

RL midpoint in absolute RL FLOP (DD-06, TRN-09; theme T). Commit 9993cd4. Moves calibration: **yes** (every base not at
B0's FLOP: students, small and large rival bases, later player bases; start-lab lags re-solve for rivals whose last base
differs from B0).
- **Change:** `C_mid = c0 / 10^e_RL` (models/effective.ts rlGains, rlGainGeneral), no longer `c0 · FLOP_pre / 10^e_RL`,
  so FLOP_pre no longer cancels out of the RL gain. c0 (now in FLOP, ≈ 6.97e24) is solved once, as before, on the
  reference base (FLOP_RL_REF = 3e26 = B0) with the standard budget, broad, e_RL = 0 → RL_REF_GAIN 0.7; V0's gain is
  unchanged (0.667988 both ways). Rivals follow automatically (stacks.ts refRlGain / rlGOfBuild read rlGainGeneral).
  Docs: runDesign.ts RL_CURVE, runs.ts rlAddOnVersion comment.
- **Effect at the standard share (0.15):** 0.1× B0 base 0.038 (was 0.630), B0 0.700, 10× B0 1.092. A 10× base reaches
  the reference gain at share 0.0126.
- **Saturation (read the task's wording carefully):** with an absolute midpoint every base reaches 95% of its own
  ceiling at the same absolute RL FLOP (≈ 1.5e26); a 10× smaller base therefore needs a 10× **higher** share (5.1 vs
  0.51), not a lower one, and saturates at a lower ceiling (0.90 vs 1.00). "Small bases saturate sooner" holds only in
  absolute FLOP relative to their pretraining cost being smaller, not as a budget share. If a lower share is wanted, the
  midpoint needs a sublinear base term (C_mid ∝ FLOP_pre^k, 0 < k < 1) — not done.
- **Check:** `npx tsx scripts/v2/_t04/check.ts` (V0 unchanged; reference gain 0.7; gain depends on base size at fixed
  share; bigger base reaches the reference gain at a smaller share; 10× smaller base saturates at the same absolute RL
  FLOP). tsc app + scripts/v2 clean.

### RD-T05

RL families as explicit lists; horizon gain from long-tasks RL (theme T, TRN-10). Commit ef7476b. Moves calibration:
**maybe** (transfer unchanged; the reference broad and long-tasks-focus runs on B0 keep ×1 / ×2 (×2.4 with P07), but
every other run's horizon now follows its long-task RL: bigger bases, heavy budget or a better long-tasks suite (P12)
raise it even on broad runs; light budgets or small bases on a long-tasks focus get less than ×2).
- **Families:** data/v2/runDesign.ts RL_FAMILIES `{ own, adjacent, taskH? }`; `v` and `h80Mult` deleted. models/
  effective.ts TRANSFER reads own (1.0) / adjacent (0.4) / far (0.15); suites.ts familyDomain = `own`. Tree captions
  (rl.* nodes, P06) rewritten: "Mainly improves X; also helps Y, Z; a little carries over to the rest".
- **Horizon:** h80Mult = (LONG_TASKS_HORIZON.perFocus 2 × P07 1.2-if-frozen)^x, x = max(0, (g − g_broad) ÷ (g_focus −
  g_broad)); g = rlGains(…).perFamily.longHorizon (its RL share on the base ceiling × suite fidelity), anchors = the
  reference run (B0, standard, e_RL 0, fid 1) broad / long-tasks focus (effective.ts longTasksHorizonMult, set in
  runs.ts rlBuild). postEffect / rlFocusEffect no longer carry h80Mult. On B0, standard budget, by long-task share:
  ≤ 1/6 ×1, 0.3 ×1.49, 0.5 ×1.85, 0.7 ×2.00, 1.0 ×2.10. Floor ×1 (other focuses do not shorten the horizon).
- **Not changed:** RL on an existing version keeps its frozen h80Mult; saves keep stored h80Mult (no schema bump).
- **Check (scripts/v2/.tmp-rdt05.ts, run alone, untracked):** transfer matrix identical to the old v-derived one; no
  `v` / `h80Mult` on any family; reference broad ×1, long-tasks focus ×2, with P07 ×2.4, swe focus ×1; horizon
  monotone in long-task share. tsc main and scripts clean; `npm run build` passes.

### RD-T11

Scrutiny against the largest rival run; `scale` removed. Commit 609c699. Moves calibration: maybe (gov).
- **Rule.** A base run's public scrutiny is sizeScrutiny(FLOP ÷ rivalRunFlop) (+5 per ×3 above, 0 at or below), at
  the blueprint preview and at launch (models/runs.ts runScrutiny). rivalRunFlop = the largest training run of any active
  non-player lab (US rivals and China): a run in progress at its planned FLOP (FLOP so far + baseFlopPerDay × days to its
  due day) or a base finished in the last SCRUTINY_WINDOW_DAYS = 365 [D]; none in the window: the largest current base.
- **Removed.** TrainingRun.scale, the pretrain plan's `scale`, runs.ts scaleOf (and its frontierFlop import). The RD-C06
  lint exemption on scaleOf has nothing left to exempt there.
- **Save.** SCHEMA_REV 63 → 64; migration 63 drops TrainingRun.scale (idempotent). hygiene.ts's two `SCHEMA_REV === 63`
  pins moved to 64.
- **Check.** scripts/v2/_t11/check.ts (day-0 reference 6.3e26 FLOP; 0 at ≤ 1×, +5 at 3×; migration drops the field):
  pass. tsc (app, scripts/v2) clean.
- **Calibration.** The reference changed from F(t) to the rival frontier (not compared at day 0), so the gov
  scrutiny bump can fire at different times. Not measured (no cal run in this task).

### RD-T06

Expert data only as a suite input; P12 as a suite option (DD-07, TRN-04). Moves calibration: maybe.

- **Removed.** Action `data.expert` (production/dataActions.ts expertTerms), the domain stock `expert:dom:<domain>`
  (production/data.ts expertDomainId / expertDomainAsset / expertStockT / takeExpertData), the start portfolio's empty
  `expert` placeholder, EXPERT_DELIVERY_DAYS / EXPERT_SIZE_T, dataView expertForm / expertUnbuilt, the Data panel's
  "Buy expert data" card, SuiteCost.fromStockT, ProjectEffect.expert and its branches (research.ts completeAdoption,
  researchView, treeActions), suites.ts addSuiteExpertData, P12_DEMO_T.
- **Rule.** A suite build buys the expert data it builds in (SUITE_BUILD.tokensT × EXPERT_PRICE_B_PER_T, paid when
  queued): the only purchase path. P12 is now a plain unlock node (no effect, no cash at adoption); once known, the
  long-tasks suite offers a demonstrations build (`suite.build {family: 'longHorizon', demos: true}`, ref
  `longHorizon:build:demos`): DEMO_BUILD = +0.02T demos (+$1B) and +4 team-weeks [D] on top of the build; repeatable.
  From the start stock: fidelity 1 → 1.356 (plain build 1.146). The old adoption delivered x × 0.02T once (x ≈ 1).
  Suites panel: "+ demos" button in the long-tasks Build cell.
- **Texts.** Glossary expertData / suiteBuild, Data panel tooltips, dataAssets / data.ts comments: no claim that
  evaluations read expert data.
- **Save.** SCHEMA_REV 64 → 65; migration 64 credits `expert:dom:<domain>` stock (owned and pending) to the suites of
  that domain's families (split over those with a suite; AGENCY → long tasks when computer use has none), drops stock
  with no suite (SOCIAL, MEDIA, PHYS), and drops the idea stages of a P12 under test. hygiene.ts pins → 65.
- **Check.** scripts/v2/_t06/check.ts: pass (no domain purchase; build pays $0.1B; demos blocked without P12; demos
  build +$1B and fidelity above a plain build; migration). tsc (app, scripts/v2) clean; npm run build ok. scripts/v2
  data.ts / suites.ts / research.ts / uitest.mjs updated for the removed paths, not run.
- **Calibration.** Bots never bought data.expert, but RefBot no longer gets P12's 0.02T into long tasks on adoption
  (it does not take the demos build): long-tasks fidelity and AGENCY gains are lower in bot runs. Not measured.

### RD-T07

Suite fidelity from tasks × grader quality, with decay; S2 stated directly; v1 graders chain dropped (DD-07, TRN-14,
TRN-23, TRN-25). Commit e9b84e6. Moves calibration: maybe.

- **Fidelity.** fid = FIDELITY(n), n = live tasks × grader quality ÷ START_TASKS (same bounded curve: max 1.5, γ 0.5,
  min 0.5). Tasks = expert tokens a build buys ÷ TASK_TOKENS_T (20k tokens a task [D]; start suite 100k tasks = E₀).
  Grader quality g = (1 − x) ÷ (1 − x₀), x₀ the start type's start exploitability: the share of tasks with a sound grader
  against the start graders, so hardening raises it (leader SWE, one pass: fidelity 1 → 1.019). New EnvSuite.tasks.
- **Decay.** SUITE_DECAY [D]: half the live tasks lost in 6 months at zero upkeep (tools / APIs drift, models outgrow
  tasks; METR horizon doubling ≈ 7 months), at the unmet share of the rate when upkeep is short (`decaySuites`, called
  daily from the build system with coverage = upkeep served ÷ needed). Met upkeep holds them; lost tasks come back only
  with builds. Hardening and upkeep size now read live tasks (√(tasks ÷ START_TASKS)).
- **S2.** S2_PER_EXPLOIT = 5.5 stated in data/v2/suites.ts (was solved from V1's S2_REF 0.36: 5.538); one formula
  S2 = 5.5 · Σ share · x (× the RL budget's pressure). Broad start S2 0.3600 → 0.3575 (−0.7%).
- **Dropped.** EXPLOIT_CHEAP, V1_HARDENED_S2, HARDENED_FACTOR, S2_REF; EXPLOIT_START stated per family (same values);
  spinout multiplier 2.5 stated; OptionSlot 'graders'. Scripts (safetyrates.ts, suites.ts) derive their raw rates from
  EXPLOIT_START × the spinout multiplier.
- **Save.** SCHEMA_REV 65 → 66; migration 65 sets each stored suite's tasks from its expert asset. hygiene.ts pins → 66.
- **UI.** Suites panel fidelity tip shows live tasks and grader quality; expert tip shows live tasks. Glossary
  suiteFidelity / suiteExploit restated (GLOSSARY.md not regenerated).
- **Check.** scripts/v2/_t07/check.ts: pass (start suites at fidelity 1 and the old exploitability, leader and spinout;
  zero upkeep for a half-life halves tasks, fidelity 0.793; met upkeep holds; build system 60 days served vs upkeep
  capped at 0: 1.000 vs 0.940; build doubles tasks; hardening raises fidelity; S2 formula and its move with x; migration).
  tsc (app, scripts/v2) clean; npm run build ok. Nothing else run.
- **Calibration: maybe.** Bots whose upkeep runs short now lose fidelity; hardened suites gain a little fidelity; S2
  −0.7% at equal exploitability.
### CP2 fixes
- **Rogue ending unreachable from forced states (ws4 E5, control endings; also control "process: an escaped copy
  takes control…").** Cause: test rigs, not the engine. RD-L05 made the rogue gate the SAR milestone record
  (`milestoneDays[4]`, the intended rule in control.ts's header); RD-L04 made milestones the work-fit predicate on the
  version's build, so the rigs' forced state (raise `v.G` / `Lg` to the SAR knot) no longer meets SAR and the gate never
  opens. Fix (8ba03bd): ws4 `atLevel` and control's rogue setup force the milestone record 0..idx (as the ASI setups
  force `milestoneDays[6]`); control's process check sets the SAR record for "grown" and deletes it for "early" (was:
  levels below the knot). Engine unchanged. ws4 E5 and control (31/31) pass.
- **Successor pull with "no agent compute" (r 0.179, ω 0.066).** Cause: test rig. RD-A02 gave engineering agents their
  own split line (`split.engineering`, 0.6% at start); the check zeroed only routine / frontier, so 7200 H100e of
  engineering agents still did SWE and the pull correctly read that AI share. Fix (020b810): the check zeroes
  `split.engineering` too (r 0, ω 0). Engine unchanged; successor 12/12. Seen, not changed: safety/incidents.ts
  `usageOf` still counts an internal deployment as used only when routine + frontier > 0 (ignores the engineering line).
- **P14 steering does not fade (AF d 0.325 at L 5 and L 14.5).** Cause: test rig. RD-U02 made `versionOom = v.G − G_V0`
  (was λ⁻¹ of Lg); the check raised only `Lg` to 14.5, so the decay saw the start model's OOM. The engine fade reads the
  model's capability (OOM above V0) as intended. Fix (16bfcd2): the capable model sets `G = gOfLevel(14.5)` too. The
  P14 check passes (P23 and the lint failures there are other CP2 classes).
- **believedControl NaN on the spinout start (from day 1).** Cause: models/research.ts `allocate` capped an uncapped
  need at `(share ?? Infinity) · cap`; at zero capacity that is ∞·0 = NaN. RD-A04 routed safety research engineers
  through `allocate`; the spinout lab has 0 safety research engineers, so `safAllocation.got` → NaN → `upkeep` →
  `reValidationMult` → validation lead → believed detection → believed monitor catch → `believedTerms` NaN. Fix
  (d329aa8): an unset share means no cap (Infinity), never multiplied by capacity. Probe: spinout + leader lab, RefBot to
  day 400 with endings skipped (the fixture's run): no non-finite `effectiveControl.believed` on any day.

### RD-T08

Design options through the draw (TRN-11, TRN-20, TRN-31; SYNTHESIS §5 small calls). Commit 3602ced. **Moves calibration: yes.**
- **Quality filter** (runDesign `QUALITY_FILTER`, [D]): on the public crawl and usage logs (licences and synthetic arrive
  curated) it drops the worst quarter of raw tokens; the kept three quarters are 1.25× the quality (quality-weighted stock
  −6%). Applied to the assets before the draw weights (production/data.ts drawWith). Start portfolio, reference size:
  mean drawn q 0.984 → 1.199, unique tokens the mix can use 310T → 235T. The reference recipe has it on, so Q_REF is
  now ≈ 1.20 (reference draw still D_eff = D); a big base repeats sooner. `qualityOffDg` −0.24 deleted.
- **Hazard filter** (`HAZARD_FILTER`, [D]): removes a third of every asset's BIO and CYBER tokens from the draw (after
  the weights: the domain draws a third less, its epochs per own token unchanged, the others take the freed share).
  BIO tokens 8.34T → 5.73T at the reference size, s_BIO −0.25 OOM (was a flat −0.5 OOM plus −0.024 general).
- **[D] constants kept, in OOM, v2 provenance dropped:** Dense −0.3, latent +0.5 (SHAPE); safety pretraining
  `SAFETY_PRETRAIN_DG` −0.02 (was −0.024); alignment minimal +0.02 / heavy −0.05 (was +0.024 / −0.048); preference
  minimal −0.06. BaseEffect is now {dg (safety pretraining), monitorability}; sD / flopMult / cashMult gone.
- **Data presets** = named per-domain weights on the portfolio's own mix (BASE_DATA {weights, kinds}): balanced,
  codeMath, science, synthetic (UI "Synthetic-heavy"), multimodal. 'natural' merged into 'balanced'. Multimodal +20% FLOP
  and science +5% cash deleted (base cash 0). `MixTarget` = {shares?, weights, kinds, filter?}; `designTarget(d)`.
- **RefBot's fixed target:** `REFBOT_DATA_SHARES` (bots/ref.ts, = REF_SHARE) passed as launchBase `mixShares` (JSON
  param) → new optional `BaseDesign.mixShares`. Other bots draw the balanced (own) mix.
- **Tokens per parameter:** no gate (TPP_FREE_MAX, OptionSlot 'tpp' and the "Overtrained compact" node deleted);
  `tppLabel` names the trade-off (most capable per FLOP / 2025 practice / cheaper to serve); the Blueprint track has
  "← more capable per FLOP · cheaper to serve →".
- **Text:** tree cards Dense, Quality filter (now unlocks `curation:quality`), Code & math, Science, Native multimodal,
  Hazard data filtering, Safety pretraining in player language (no years, no "+5% cash" / "+20% FLOP"); glossary
  dataMix, naturalMix, hazardFilter, tokensPerParam.
- **Schema:** 66 → **67**: 'natural' → 'balanced' in every stored base design (walk of objects with curation + tpp);
  tree / queue / team state of 'overtrained' dropped. hygiene literals bumped.
- **Check:** `npx tsx scripts/v2/rdt08.ts` (4 checks, run alone: quality filter raises drawn q and lowers unique tokens;
  hazard filter removes BIO / CYBER tokens, s_BIO follows; no flat curation offset; no Δp × B / flopMult / cashMult /
  tpp gate in runDesign). tsc main + scripts clean; build ok. scripts/v2/data.ts: three draws rewritten to
  `{ shares: REF_SHARE, weights, kinds }` (not run; its balanced-vs-natural and quality-offset checks will need restating
  at CP3).

### RD-T09

Synthetic mix follows the teacher (TRN-19). Commit 14d46d5. **Moves calibration: maybe.**
- **Rule** (production/data.ts `synMixOf`, [D]): share_d ∝ 10^(SYN_SHARP · (G_d − G)) × target_d, normalised over the
  nine domains; G_d − G = the teacher's domain effective compute over its general G (versionDomainG); SYN_SHARP 3 per
  OOM (a domain 0.1 OOM stronger writes ×2). target_d = the lab's generation target weight: no such setting exists yet,
  so the optional argument is unused (weight 1). A build-less teacher is flat. Each day's tokens carry the teacher's
  mix of that day (continual learning can move it).
- **SYN_MIX deleted** (code / reasoning 35% each). The start asset `syn:start` (pre-game teacher) is now an even mix;
  the reference start model's profile is flat (|G_d − G| ≤ 0.01), so a balanced teacher writes a balanced mix. This
  shifts REF_SHARE / Q_REF slightly (20T of 310T moves from code / reasoning to even): why calibration may move.
- **UI:** Data panel, synthetic row: "synthetic data from Atlas-1.0: an even spread of domains" / "…: mostly code and
  math & reasoning" (largest domains until half the mix, at most three; even when none holds 1.5× an even share), from
  the teacher writing most of today's tokens (job teacher at ≥ 50% of the pool, else the default). dataView
  `synMixLine`, `describeSynMix`.
- **Schema:** unchanged (stored mixes keep their old values).
- **Check:** `npx tsx scripts/v2/rdt09.ts` (4 checks, run alone: V0 even; a teacher with CODE +0.3 / REASON +0.2 OOM
  data specialisation writes CODE 42%, REASON 21%, others 5%; sums to 1; target weight acts). tsc main + scripts clean;
  build ok.

### RD-T10

Tree node roles split (SYNTHESIS RD-T10; TRN-21). Commit 97be985. Moves calibration: no.

- **Roles.** A node carries its research effect (`effect`, typed) and nothing it unlocks; `TreeNodeDef.options` is gone.
  What a node unlocks is derived from the unlock tables, each thing → node in one place: design options in
  `OPTION_NODE` (data/v2/tree.ts, now a literal table, 26 entries; `OPTIONS_OF` / `optionsOf(id)` derive each node's
  list in table order), product features in `FeatureDef.node`, the long-tasks demonstrations build in
  `DEMO_BUILD.needs`. treeActions and the Research card read `optionsOf(n.id)`.
- **Purchases.** No node books cash (RD-T06 already moved P12's data purchase to the suite build); P12 is a plain unlock.
- **Texts.** P12 card in player language (what experts' demos do, the build buys its own data, research costs no
  cash); P10 "unlocks the synthetic-heavy mix" → "you can train on a synthetic-heavy mix".
- **Behaviour.** Identical: the table equals the pre-T10 derived map (pinned in the check).
- **Check.** `npx tsx scripts/v2/rdt10.ts` (run alone, 6 pass: no node carries an unlock list or cash cost; every
  option / gated feature / demos build names a tree node; node lists = the table; table = the pre-T10 map). tsc (app,
  scripts/v2) clean; npm run build ok.

### RD-M01

Measured level fitted from benchmark scores (DD-08; TRN-05, MEA-17). Moves calibration: yes.

- **Fit.** `models/benchmarks.ts`: `benchReading` inverts each single-domain benchmark curve (edition and 'hard' survive
  row included; score kept 0.5% off floor / ceiling) into a domain level with sd = score sd ÷ curve slope;
  `fitDomains` combines a domain's readings by inverse variance; `fitGeneral` turns each cognitive domain's fit into an
  effective-compute offset ΔG_d = λ⁻¹(fit_d) − λ⁻¹(L_d) (the version's per-domain offsets are its build, known to the
  lab), combines them by inverse variance in G and reads λ(G + ΔG). Domains at the 0 / 15 clamp carry no reading.
  `refitMeasured` / `applyFit` store `measuredL`, `measuredDom` (per domain) and `fitSd` (the band) on the EvalRecord.
  Suite noise, depth and evaluator elicitation and sandbagging lower or raise the scores and so the level.
- **Deleted.** `EvalRecord.errTrue` (the one stored N(0, 0.2) draw) and its rng draw (the 'runs' stream shifts).
  `measuredSd` reads `fitSd`; 0.2/√nEff only for records without a fit. nEff still accumulates (re-run policy).
- **Start model.** V0's noiseless start scores are fitted too (L 5.00 at the reference seed).
- **Readers changed.** `actors/commitments.measuredDomain` (thresholds, UI radar via `measuredDomains`, World panel),
  `models/paradigms.measuredDomain`, `safety/dangerView` domain readings: the domain fit, falling back to measured
  general + true offset only for MEDIA / PHYS (no benchmark) or records without a fit (still a leak of the offset).
  `compactRetired` keeps `measuredDom`. Glossary L / measureBand, Evals and Models tooltips restated.
- **Readers already on measured (unchanged).** gov (`claimedL`, `govSeenL`), commitments, RefBot gates (ref.ts
  452–516, 723), milestones / events kit, finance observe, research bodies, player readouts, record.Lmeasured.
- **Not changed (open).** Physics that reads measured: `models/products.catchRate` and `safety/oversight.useControl`
  (oversight gap on measured levels, an earlier "what you see is what rolls" choice); `safety/covert.believedSabotage`
  is a belief and is correct. The horizon / speedrun rows and the two-domain OfficeWork row feed no domain fit. At the
  start, CYBER / BIO / SOCIAL / MEDIA sit at the 0 clamp, so SAND moves the start model's general level by only ≈ 0.26 L
  (RSCH −1.2 L); the effect grows as those domains leave the clamp.
- **Migration.** SCHEMA_REV 68: 67 → 68 drops `errTrue` and refits every player version with a bench table.
  hygiene.ts rev pins → 68.
- **Check.** `npx tsx scripts/v2/rdm01.ts` (run alone, pass: no stored error draw on 48 suites; honest full suite
  5.09 vs true 5.00; SAND 1 reads 4.83 < true and < honest − 0.15, RSCH 0.60 vs 1.76 honest; basic 5.08 < full 5.09 <
  deep 5.19; start model fitted). tsc (app, scripts/v2) clean; npm run build ok.

### RD-M02

Recipe "realised" from the measured eval delta (CAP-03, RD-B17 follow-up). Moves calibration: no (readout only).

- **Readout.** `models/researchView.measuredDelta(s, v)`: for the first evaluated model `v` that embodies an idea
  (`revealedBy`, unchanged), ΔL = `v.evals.measuredL` − that of the comparable model without it: the latest evaluated
  version before `v` on the same base, else the latest evaluated version before it (every earlier version lacks the
  idea). Band = hypot of the two `measuredSd` (fitSd). Domain rows read the `measuredDom` delta of their domain; data
  rows the general ΔL. `AdoptedView.realised` (the true `eff`) is gone: `measured` / `seenIn`; `eff` never leaves the engine.
- **UI.** Recipe: "Adopted · believed → measured (OOM → L)", each idea "→ ±x ±sd L" or "→ not yet measured"; tooltip
  names both models and says the delta holds everything else that differs between them. No pos/warn tone (units differ
  from the believed OOM). Glossary `realisedEffect` = "Measured effect"; `otherEffects` text; the line's "Realised so
  far" (pool readout, CAP-10) now links `linePool`, not `realisedEffect`.
- **Open.** The delta is not a clean counterfactual (a new base or other ideas in the same model are in it).
  GLOSSARY.md not regenerated.
- **Check.** `npx tsx scripts/v2/rdm02.ts` (run alone, all pass: not yet measured before; ΔL 0.31 ± 0.117 from the fits;
  no true value in the view; domain row reads Δ REASON; changing the true value leaves it unchanged). research.ts
  RD-B17 B30 check reads `measured`. tsc (app, scripts/v2) clean; npm run build ok.

### RD-X03

Rivals train through the player's baseG / rlGains on a stated reference portfolio; reference-profile build (DD-18,
TRN-22, MEA-11; theme X). Commit 265f9b9. Moves calibration: **yes**.
- **Done.** A rival base's G_pre is `baseGOf` (models/runs.ts, the player's baseG split into a pure function on the
  launch freeze) on the reference design and draw at the lab's frozen pretraining part; a version's RL gain is
  `rlGains` on the reference suites at the lab's RL recipe (`rivalRlGains`, `rivalVersionBuild`); G = gOfBuild. The
  stream (clApply), new versions, new bases, theft (`holdStolen`) and the start state all go through these. The old
  special path (`rlOnBase` → stacks.ts `refRlGain` / `rlGainGeneral`, direct `gPreOf`; the audit's `clG`) is deleted
  from the rivals' training (refRlGain stays only for the recipe G-equivalent recipeG, shared with the player).
- **Reference-profile build.** New `SimpleModel.build` (VersionBuild). `setModelG` keeps it consistent with G (a move
  not made by a run, e.g. a release dated back, a kept stronger version, enters as general ΔG; builds never mutated in
  place). Rival domains = `domainsOf(w, G, build)`; aggregate research reads EXP / IDEAS coverage, assist, horizon and
  AI taste through the player's work fit (`workFitW`, new pure form of workFit); `otherLabMilestones` reads the stored
  build (referenceProfileModel only for a model known by G alone). The day-0 unit is V0 as a rival build (`v0ModelOf`).
- **Stand-ins [D]** (rivalModel.ts "reference portfolio" block): design = REFERENCE_BASE resized to the run (tpp
  adjusted if PARAM_RANGE clamps); data = the 2025 reference draw (REF_SHARE, Q_REF) with no repetition (the lab's
  portfolio keeps pace: f_data = f_qual = 1, s_d = 0); suites = the start families, broad weights, fidelity 1; RL budget
  = standard on every version. Recipe = the lab's adopted research (rec); run sizes from its aggregate split.
- **Save.** SCHEMA_REV 68 → 69; migration 68 builds every stored rival / leader-lab / China model's build on its current
  base at its RL recipe (rest of G as general ΔG; G unchanged). hygiene.ts pins → 69. scripts/v2/rivals.ts adapted
  (evalAggregate / bestRivalMix take a model).
- **Check.** `npx tsx scripts/v2/_x03/check.ts` (run alone, all pass): no clG in src, no refRlGain / rlOnBase / gPreOf in
  rivalModel.ts; 200 days ai2027 leader: each lab's (china, r0–r2) new internal version has G = G_pre + rlGains.general
  on the reference inputs (|ΔG| 0) and the base's G_pre = baseGOf's; domains and work fit read the build; migration
  68 → 69. tsc (app, scripts/v2) clean; npm run build ok. Nothing else run.
- **Left.** Rivals still have no data / suite strategy of their own (stated stand-ins, by DD-18); the public release
  copy is checked through its internal version; GLOSSARY.md not regenerated.
- **Moves calibration: yes.** G itself is unchanged at fidelity 1 and reference data (same expressions), but rival
  research now reads per-domain work fit and the horizon domain (EXP / IDEAS fit ≈ G − 0.03 OOM at day 0–200 instead of
  G) and the day-0 normalisation reads V0's build: rival research speed, recipe growth and rival domain readouts /
  milestones shift slightly.

### SR-09

Validation jobs replace tool upkeep (SAFETY-REDESIGN §2.2 concept 4, §3.2, §6 row 2). Commit 4d120fc.
- **`safety/validation.ts`**: a job (instrument, model) takes VAL_ENGINEERS = 15 safety research engineers (÷ m of
  safety experiments) for VAL_DAYS = 30 at full staffing and VAL_COMPUTE_FRAC = 0.25 of a serious project's compute on
  the instrument's line (shared by need with the line projects in safAllocation; SafAlloc.valPool) [D; costs [R] pending,
  §6 row 17]. It plants VAL_N = 20 cases: found ~ Binomial(20, trueRecall), trueRecall = the true `reliability()` on that
  model, mean over the traits it reads (OD-7: no organism-realism factor). Finishing sets validatedOn / validatedOom
  (port = same job) and `TechniqueState.measured` {on, found, n, day}. False-validated tools measure ~0 (true reliability
  0): SR-10 builds on it (who ran it).
- **Needs list**: SafReNeed 'reval' → 'validation' (demand = live jobs × per-job engineers, filled in queue order).
- **Policy**: SafetyDept.validation {jobs, autoNew (on), lastModel}: on each new internal model every owned instrument
  not measured there is queued (the start model too: day 1 of a new game queues the start tools).
- **Actions**: `safety.validate` (tool id or 'all', model; preview: engineers, days, queue ahead, compute, current range
  and the sample's width), `safety.validationPolicy` (on).
- **Range** `validationRange(s, t, v)`: measured on v → found/n, 90% Beta range; else extrapolated = measured × believed
  change from the measured model, half-width + VAL_WIDEN_PER_OOM = 0.06 per OOM of gap; never measured → believed value,
  half-width VAL_UNMEASURED_HALF = 0.15 + the gap widening. Not yet read by sightLimit (its range is efficacy draws) or
  the instrument rows (UI tasks).
- **Deleted**: upkeepStep / upkeepState / upkeepTools / revalDemand / reValidationMult (the validation lead), UPKEEP_*,
  RE_SERIOUS, glossary toolUpkeep (now `validation`), upkeepView (→ validationPanel; Safety's Validation card with the
  queue, "Validate all", auto toggle; the race chart's sight-limit projection is flat). LINE_MULT_MAX kept (line asks,
  AG17 harness, AG18 healing). record.ts U-cause "validation" = instruments measured on the model.
- **Save**: SCHEMA_REV 69; migration 68 → 69 (empty queue, policy on, measured null, need renamed in research.safRe);
  hygiene pins → 69. safetyresearch.ts E1 reads idle engineers (was upkeep).
- **Not done**: job reordering in the queue (the need's place in the list is reorderable); cost scaling with model size.
Check: `npx tsx scripts/v2/_sr09/check.ts` (day 400: migrates; policy queues 5 of 5; unstaffed: no progress, no oHalf
drift; staffed: done in 30 d, validated on Atlas-2.7, each measured within 3 sd of true recall; mean of 400 = 0.195 vs
0.203; never-measured range wider; no upkeep code in src). tsc (app, scripts/v2) clean; npm run build passes.
Moves calibration: yes (S4/S5): oHalf no longer rises with spare engineers (tools fade faster unless validated on each
model, which re-anchors the gap); validation takes engineers and some line compute.

### SR-14
Safety methods are run-plan options (SAFETY-REDESIGN §2.2 concept 8, §3.4; SAF-04a/b/c, SAF-05, SAF-06; OD-11).
- **Field**: PostDesign.techniques / trainAgainst → one `methods` list: method ids (safety/methods.ts METHODS: T-PERSONA,
  T-CAST, T-W2S, T-CONFESS, T-ANTISCHEME, T-UNDO) and `against:<instrument>` (train against an instrument, flagged).
  `usesMethod` is the only switch; `inRun` no longer reads lineStaffed. T-TMON's E14 / E22 follow the monitor deployment
  (routineMonitor), not AG07 staffing.
- **Healing (AG18)**: HEAL_K · e_AG18 · √min(2.5, 1 + AG18 methods used: confession, anti-scheming, inoculation option) ·
  pref · safety factor; no staffing term (was 0 without AG18 staffing).
- **Policy**: SafetyDept.useAllMethods (on); `safety.methodPolicy`; postFromParams(p, s) with no `methods` param fills
  every owned method (never train-against). Run preview: each method's effect (gain) and its cost where one exists
  (anti-scheming EA ×2 first time on a lineage); train-against: visible −70–90%, true −20–40%, trained-against mark.
  No method has a cash / compute / staff cost of its own yet.
- **Folded**: T-SPEC (Rewarded for: Constitution), T-HARDEN (suite hardening), T-INOC (Inoculation option), T-FILTER
  (base Hazard filter: the open-weights rule now reads base.design.curation.hazard), T-CCLASS (safeguard); not listed as
  tools on SAFETY. T-UNDO: misuse capability ×UNDO_MISUSE_MULT 0.5 [D] for models trained with it.
- **UI**: Blueprint post-train Methods row (toggle per owned method, ⚑ vs each instrument, policy toggle); glossary
  safetyMethod; tree T-UNDO card.
- **Save**: SCHEMA_REV 70; migration 69 → 70 (every post design: methods = techniques + against:trainAgainst; policy on);
  hygiene pins → 70.
- **Not done**: inoculation stays a boolean run option (not in `methods`); Heavy safety still includes anti-scheming /
  confession effects; the incident response "Retrain against" stays; prediction of healing / method effects (SR-15).
Check: `npx tsx scripts/v2/_sr14/check.ts` (day 400 migrates, 22 designs; persona E05 and anti-scheming E28 only when
listed; healing 0.258 → 0.407 with two AG18 methods; mods and healing equal without 12 science teams; T-UNDO halves
misuse; policy on fills 4 owned methods, off none; explicit list wins). tsc (app, scripts/v2) clean; npm run build passes.
Moves calibration: yes (S4/S5): methods now apply to every policy-filled run regardless of staffing (bots included),
healing no longer needs AG18 staffing, monitoring edges no longer need AG07 staffing.

### SR-14b
Finishes SR-14 (SAFETY-REDESIGN §3.4 P1 / I5; OD-11).
- **Inoculation** is the method T-INOC in PostDesign.methods (METHODS; no longer folded); PostDesign.inoculation and the
  tree option slot 'inoculation' are gone; T-INOC is an AG18 healing method. Blueprint's Alignment row is Standard /
  Heavy / Minimal only; the Methods row carries inoculation. Race bot: policy methods without T-INOC (was inoculation off).
- **Safety level** (minimal / standard / heavy) sets only the generic safety-training intensity (SAFETY_REMOVAL, healing
  factor, HONEST bracket). Anti-scheming (E19 / E28, SCHEME removal, EA ×2) and confession (E17) apply only when listed.
- **Retrain against** leaves the incident response menu (ResponseKind, preview, apply, SAFETY list, glossary); it is the
  run method `against:<instrument>`. scripts/v2/safety.ts E24 calls goodhartTrain directly.
- **Save**: SCHEMA_REV 71 (shared with SR-15); migration 70 → 71 adds T-INOC where inoculation was on; hygiene pins → 71.
- **Not done**: Heavy's alignment audit (AG02 WB, OC_VIS_AUDIT, pendingAudit) stays in Heavy (becomes a case type, §3.6).
Check: tsc (app, scripts/v2) clean; npm run build passes (no own targeted check; SR-15's check covers the methods).
Moves calibration: yes (S4/S5): Heavy no longer gives anti-scheming / confession to runs that do not list them; the
safe bot gets them only through the policy once owned; inoculation needs T-INOC owned.

### SR-15
Method effects scale with research efficacy; prediction = mechanism on a copy (SAFETY-REDESIGN §3.4, SAF-07, P6).
- **Scaling**: mult = clamp01(1 − (1 − base)·s0·e), s0 = 1 / prior mean efficacy of the method's agenda (so at e = ē the
  sourced base applies); removal = clamp01(base·s0·e). Engine e = trueEfficacy; prediction / preview e = believedEfficacy.
  All run methods' moderators, inoculation's hackGen, anti-scheming's SCHEME removal (0.95 base), T-UNDO misuse (0.5 base).
  Healing keeps HEAL_K · e_AG18 (already linear in e), read in the view.
- **One mechanism**: safety/traits.ts runEnv(view) builds the run environment; playerEnv = trueRunView (true w, D,
  U-modes, stackDetectionMap); predictBeliefs = believedRunView (w̄ / revealed, D 1, no U-modes,
  detection.ts believedStackDetectionMap on the model the stack meets). The prediction now includes detection-gated
  removal, healing, anti-scheming removal and the audit visibility (it had none of them). selectors.runTraitPressure
  passes the internal model. Run preview: each method line states its believed scale (×s0·e).
- Helpers in safety/methods.ts: methodEfficacy, methodS0, methodMult, methodRemoval, EffView.
Check: `npx tsx scripts/v2/_sr15/check.ts` (E05 ×0.85 / 0.7 / 0.55 at half / mean / 1.5× mean; beliefs = truth with no
active instruments → max |Δ| 0; a weaker hidden AG18 efficacy moves the engine's SCHEME only). tsc clean; build passes.
Moves calibration: yes (S4/S5): method strength now varies by world with agenda efficacy (AG12 CAST s0 ≈ 9: wide);
predicted beliefs now carry healing / detection-gated removal, so believed traits after runs fall further.

### SR-10
Disagreement detection and false-instrument exposure (SAFETY-REDESIGN §4.3 channels 1–2, §3.10). Commit c1cbb30.
- **`safety/disagreement.ts`**: `noteReading` runs inside detection.ts observeVersion before each belief update: the new
  reading is compared with the latest reading of every INDEPENDENT instrument on the same trait and model (another kind
  AND another family: logs/COT vs reasoning/COT is one instrument in two settings). |a − b| > DISAGREE_Z (1.64) ·
  √(σa² + σb²) → one `Disagreement` in SafetyDept.disagreements (once per model × trait × pair, cap 40), and every owned
  instrument of both families reading the trait loses DISAGREE_DROP = 0.1 of its trust (floor DISAGREE_FLOOR 0.5 from
  disagreements alone) [D]: symmetric, says nothing about which is wrong. Readings and noises only (no truth).
- **Trust**: `TechniqueState.trust` {f, evidence (cap 20: day, source validation | disagreement, model, note, f)};
  reliabilityBase's BELIEVED base × f (≤ 1); true side unchanged.
- **Validation** (validation.ts): `ValidationJob.human` (player option `human` on safety.validate: all VAL_ENGINEERS,
  not ÷ m; preview says human-run / AI-assisted); `humanRun` = chosen, or no AI share (m = 1). `ValidationResult.human`
  records who ran it (validationRange returns it). A false-validated instrument validated with an AI share samples at
  its believed recall (the AI hides it, §3.10); human-run, at its true recall (0). Every result sets f = measured ÷
  believed (before the result) on that model, so a validation supersedes disagreement drops. validationView: disagreements
  on the internal model, each instrument's trust and last evidence note (data only; UI is SR-27).
- **Save**: SCHEMA_REV 72; migration 71 → 72 (empty disagreement list; earlier measurements human: true, they read true
  recall); hygiene pins → 72.
Check: `npx tsx scripts/v2/_sr10/check.ts` (migration; BB vs WB readings 0.6 apart → one disagreement, both sides'
believed reliability × 0.9, true and other families unchanged, same pair once, agreeing and COT-vs-COT readings none;
day 900 with the safety agents line on: a false instrument through 300 AI-assisted validations keeps mean trust 0.997,
one human-run validation finds 0 of 20 and its believed reliability goes to 0). tsc (app, scripts/v2) clean; build passes.
Left: no ctx log / case auto-open on a disagreement (framework, SR-17/18); revealFalse still only via cases and footholds
(a human-run 0 of 20 lowers trust, does not deactivate); AI-assisted rigging covers false instruments only (no general
sabotage of honest instruments' validations); UI chips (SR-27); glossary terms (SR-30); SR-09 check not re-run.
Moves calibration: yes (S4/S5): believed reliability now moves with disagreements (down, to ≥ 0.5×) and with each
validation (to measured ÷ believed), so believed detection, understanding and gates shift; true side unchanged.

### SR-16
Environment fixes are owned method items per RL environment family (SAFETY-REDESIGN §3.4 "environment fixes", I4 patch
→ CHANGE). Commit ee3a911.
- **Owned item**: `SafetyDept.envFixes[family]` = { mult, n, day, trait, versionId } (types.ts EnvFix). The patch
  response (kind `patchSignal`, now titled "Fix environment"; optional `family` param, default = the family whose
  environments are most exploitable after earlier fixes, responses.ts envFixFamily) multiplies the family's fix by
  PATCH_MULT 0.3–0.6 (drawn), floor PATCH_FLOOR 0.2 [D: V2-SPEC 3.5.9]; same staffing (PATCH_FTE for PATCH_DAYS) and
  next-run G penalty as before.
- **Effect**: models/suites.ts `runExploitMap` = suite exploitability × envFixMult per family. A post run freezes it at
  launch (rlRecipeNow), so every later run that trains on the family gets a lower h_f, λ and S2 share for it; runs
  launched earlier keep their snapshot; other families unchanged. postHack / postSignals / pressureView defaults and
  suiteS2Parts read the same map, so the run plan's preview and the SR-15 prediction (runTraitPressure → runHack) show
  it. suitesView still shows the raw suites.
- **Deleted**: the per-edge lab-wide / per-lineage signal-patch flags (patchSignal wrote `patch.lab.<edge>` for every edge
  into the trait: a free global switch); playerMods reads only targeted inoculation training's `patch.lab.E04`
  (its `lineage` param is gone). patchLevel(s, family?) is the family readout; preview, LIMITS response.patchFloor and
  the incident row's chip say "environment fix".
- **Save**: SCHEMA_REV 73; migration 72 → 73 drops `ws2.patch.*` flags except `ws2.patch.lab.E04`, adds envFixes {};
  hygiene pins → 73.
Check: `npx tsx scripts/v2/_sr16/check.ts` (day 400 migrates; one SWE fix ×0.541: a SWE-focused run's h 0.095 → 0.066,
S2 0.53 → 0.37; a math/cyber run loses only its 20% SWE share, other families' hack rates equal; a run without SWE
suites unchanged; a pre-fix run's frozen snapshot unchanged; preview = launched run; predicted RH change 0.015 → −0.034;
seven fixes reach the floor 0.2). tsc (app, scripts/v2) clean; npm run build passes. _sr14 / _sr15 checks: playerMods
call sites updated, not re-run.
Left: no "create from TRAINING › Environments" entry point (only the incident response; suite hardening stays a separate
capability-side action); a fix is in force at once (not when its engineers finish); the bots' patches now go to the
most exploitable family rather than following the trait; glossary term (SR-30) not written; old saves' trait-edge patches
are dropped, not converted.
Moves calibration: yes (S4/S5): patches no longer cut trait edges lab-wide (any trait, e.g. SYC / POWER edges); they cut
one family's rewarded hacks (RH / S2 / learned hacking only), so safe / mixed bots' patch effects shift.

### Merge p3-d → rd

`git merge p3-d` into `rd` (base e4447a7; rd 22 commits RD-T06..RD-X03, p3-d 32 commits SR-01..SR-16). Merge commit
f74e1b0; truth-reader fix bada45f. Moves calibration: yes (both lanes' changes meet; the truth-reader fix moves catch
and control tax wherever measured ≠ true).

- **SCHEMA_REV 78.** rd's chain first (65 RD-T06, 66 RD-T07, 67 RD-T08, 68 RD-M01, 69 RD-X03), then p3-d's renumbered
  (+5 each). Map old → new (rev; migration key): SR-01 65 → 70 (64 → 69), SR-06 66 → 71 (65 → 70), SR-13 67 → 72
  (66 → 71), SR-08 68 → 73 (67 → 72), SR-09 69 → 74 (68 → 73), SR-14 70 → 75 (69 → 74), SR-14b / SR-15 71 → 76
  (70 → 75), SR-10 72 → 77 (71 → 76), SR-16 73 → 78 (72 → 77). Bodies unchanged; each touches only safety / deployment
  / post-design / flag fields rd's migrations do not, so each still applies to a state of the previous rev. save.ts
  header docs renumbered. Pins: hygiene.ts (two, → 78), `_sr10/check.ts` (was `=== 72`, already stale on p3-d after
  SR-16; now `>= 77`), `_sr16/check.ts` (→ 78).
- **Conflicts and resolution.**
  - `core/save.ts`: imports (rd's refitMeasured + suites helpers, p3-d's techniqueRole); rev docs and migrations as
    above.
  - `data/v2/tree.ts`: OptionSlot = rd's (tpp, graders gone) minus p3-d's 'inoculation'; T-INOC keeps rd's form (no
    options, RD-T10 OPTION_NODE table) with p3-d's "Run method:" text; `'inoculation:true': 'T-INOC'` dropped from
    OPTION_NODE; T-FILTER / safetyPretrain take rd's (options in OPTION_NODE, RD-T08 texts).
  - `data/v2/glossary.ts`: rd's L (benchmark fit, RD-M01); p3-d's sightLimit replaces U / uRange (rd had not changed
    them); rd's hazardFilter text plus p3-d's safetyMethod.
  - `safety/dangerView.ts`: p3-d's version (reads through the act table, SR-03). rd's RD-M01 domain reading moved
    into `safety/actTable.measuredDomainL`: `v.evals.measuredDom?.[d]` first, measured general + offset as fallback.
  - `models/suitesPreview.ts`: import union (rd's queuedSuiteWork / tasksOf, p3-d's envFixMult; suiteRef unused
    after rd's queue change, dropped).
  - `ui/v2/panels/Blueprint.tsx`: both import sets (rd dropped TPP_FREE_MAX; p3-d's method helpers); p3-d's
    MethodsRow with rd's PRESET_LABEL (no 'natural').
  - `scripts/v2/hygiene.ts`: rev pins → 78. BUILD-NOTES: all blocks of both sides kept (rd's RD-T06..RD-X03, then
    p3-d's SR-09..SR-16).
- **Truth-reader fix (RD-M01's open note).** `models/products.catchRate(…, controlled, believed = false)` and
  `safety/oversight.useControl(…, on, believed = false)` take the oversight gap on true levels (Lg); `believed` reads
  measured. The flag is threaded through `monitorStop`, `productMonitor`, `useMonitor`, `monitorStrength`,
  `fleetMonitor`. On truth (default): incident catch (`incidents` → productCatch; `detection.monitoringCatch` →
  fleetMonitor), runtime-monitoring strength (`detection.runtimeMonitoring`), the control usefulness tax on work
  (`workfit`), T-TMON's routineMonitor gate (traits), the act table's true sites and true guards gap. Pass believed:
  the act table's believed sites (fleetMonitor, productMonitor, useMonitor, guards gap via useControl),
  `believedOversight.believedMonitorCatch`, `pressureView` believed successor catch, `agentActions` lanes view
  (monitorStrength, useControl), `worldfx/productView`, `ui/v2/panels/Products.tsx` (three catchRate readouts).
  Unchanged: catchRate's AG07 containment term still uses believed tool strength (levels only were in scope);
  dangerView's oversight block and the rollback preview read measured directly (readouts).
- **Checks.** tsc (app, scripts/v2) clean; npm run build ok (merge and fix). After the merge, before the fix:
  `rdm01.ts` pass, `_sr10/check.ts` 16 ok, `_sr15/check.ts` 4 ok, `_sr16/check.ts` 11 ok, all exit 0 (no re-run after
  the fix).

### SR-17
Cases are jobs with a true preview; verdicts say what changed (SAFETY-REDESIGN §3.6, RD-S05; SAF-20 naming).
- **Done.** The player picks the case's instruments (`tools`), engineers (5–40) and compute share (as before; now the
  preview shows them). `investigations.casePreview` (believed reliability, the same caseRate the engine runs): days to
  resolve (or progress at the 120-d cap), engineers, H100e, each chosen instrument with the target traits it reads, what
  it can find (readings on the traits from its families; the catalogue's hidden failure-mode kinds its agendas can
  reveal, "if the model has them"; footholds of the lineage; a false instrument when ≥ 2 families cross-check) and each
  trait's believed est ± sd → the expected ± after a confirming verdict, "if your instruments are as reliable as
  believed". Investigate's preview lists these (actions.ts caseGains); "clarity" in the preview → "case progress".
- **Verdict.** `Investigation.before` (believed est / sd per target trait at open) and `readings` (monthly observations
  added); at resolve `outcomeDetail.changes` (CaseChange: trait, from → to, believed values only, |Δ| ≥ 0.005) and
  `outcomeDetail.evidence` (readings and families, the case conclusion, a failure mode found, footholds located or
  suspected, an instrument shown false). The log line and the case card (Safety › Cases) show both. Nothing reads truth
  beyond what the evidence already wrote into beliefs (the conclusion's reading is the existing noisy one).
- **Edits.** types.ts (Investigation fields, CaseChange), safety/investigations.ts, safety/actions.ts (Investigate
  preview), ui Safety.tsx (case verdict), glossary investigation.
- **Check.** `npx tsx scripts/v2/_sr17/check.ts` (committed with SR-18; its migration line needs rev 79): preview names
  the 2 chosen of 5 instruments, ~62 d, 20 engineers, four can-find lines; the case uses only them; verdict "confirmed;
  SCHEME 0.285±0.108 → 0.395±0.070; 6 readings from WB / COT; case conclusion" equals the belief change. tsc (app) clean on
  the staged tree.
- **Left.** No case types (alignment audit stays in Heavy); framework auto-open on S3+ / disagreements (SR-19+); human-run
  option on cases (validation has it); the case rate formula itself (SAF-25) is unchanged.
- Moves calibration: no (bookkeeping and preview text only; same draws, same belief updates).

### SR-18
Cause-aware responses; disclosure is a separate policy (SAFETY-REDESIGN §3.7; OD-8 default legal minimum).
- **Done.** `responses.believedCause(s, v, inc?, trait?)` from what the player sees (the incident's apparent source, a
  located foothold of the lineage, else the trait named): signal (RH / TGAME / PROXY: an exploitable environment, grader
  or reward model), trait, misuse, foothold, unknown. `CAUSE_RESPONSES`: signal → Fix environment (SR-16); trait →
  Method for later runs, Roll back, Restrict context, Add control, Comms lockdown; misuse → Restrict context (product
  side; KYC stays on the product); foothold → Remove foothold + containment; unknown → Restrict, Add control (+ open a
  case). `responseOptions` feeds the incident card (believed cause shown, only its buttons); applyResponse and the
  Respond preview refuse a kind outside the list ("not a response to …"); safeguard off-switches (lift / remove) always
  apply.
- **New response `addMethod`.** Adds an owned method fitting the trait (anti-scheming, inoculation, persona vectors,
  CAST, W2S, confession) to `SafetyDept.requiredMethods`; `methods.defaultMethods` lists them when "Use all known
  methods" is off. No instant change; the preview says where it lands (the next run's predicted traits) and "already in
  every default run plan" when the policy is on.
- **Disclosure.** `SafetyDept.disclosure` legal (default) / full / none, `Incident.disclose` override (yes / no).
  `disclosureStep` (daily, incidents step, before timers) on open incidents: willDisclose → `discloseIncident` (the old
  disclose effects: scrutiny 3 + 2·sev, trust by credibility, the discovered failure mode goes public, timer ends); not
  disclosing a must-report incident (SB 53 / RAISE in force, external, sev ≥ 3: statutoryDaily's rule) → 'covered' (the
  explicit cover-up: fine, trust, ×3 if found); anything else runs its public timer. Actions `safety.disclosurePolicy`
  (preview: what gets reported, the cover-up's costs under none) and `safety.disclose` {incidentId, choice yes / no /
  policy} (preview: disclosure lines or the withholding consequences). Fixing no longer sets 'covered' / ends the timer:
  a fixed incident with a running timer stays open; without one it resolves.
- **Deleted.** Response kinds `targetedTraining` (instant true-trait cuts, targetedPlan) and `disclose`; their previews,
  RESPONSE_INFO rows, the UI's fixed seven-button menu. Bots (mixed, safe) and safety-emu call `addMethod` instead.
- **Save.** SCHEMA_REV 79; migration 78 → 79 (policy legal, empty requiredMethods, old kinds dropped from incident
  response records); hygiene pins → 79; `_sr16/check.ts` pin → ≥ 78 and its repeated fixes name trait RH.
- **Edits.** types.ts, safety/responses.ts, safety/actions.ts, safety/incidents.ts, safety/methods.ts, safety/agendas.ts,
  core/save.ts, core/limitsView.ts (exports), ui Safety.tsx (cause line, cause buttons, per-incident disclosure row,
  policy buttons), glossary response / disclosure, bots.
- **Check.** `npx tsx scripts/v2/_sr17/check.ts`: 14 ok (migration; case job; RH incident → patchSignal only; SCHEME →
  addMethod / rollback / restrict / control / lockdown, no fix; misuse → restrict; addMethod refused on the RH incident in
  apply and preview; fix applies; fix leaves a timed incident open; legal minimum reports the sev-3 customer incident and
  not the sev-1 one; none → covered; override yes discloses; policy preview names the fine). tsc (app, scripts/v2) clean;
  npm run build passes.
- **Left.** Per-cause responses for footholds offered only via the foothold tab button (removeFoothold needs its id);
  'full' also reports internal sev ≥ 3 (a choice, [D]); the incident's apparent cause is still the hidden-table guess
  until a case names it (I11 card note not written); no rollback / restrict "effects land at date X" lines beyond the
  existing previews; framework automation (SR-19+); _sr13 / _sr16 checks not re-run.
- Moves calibration: yes (S4/S5 and relations): bots lose targeted training's instant trait cuts (addMethod is a no-op
  with the method policy on) and their patches apply only to signal traits; must-report incidents are now disclosed by
  default (scrutiny up, statutory fines down); fixes no longer turn timed incidents into quiet cover-ups (they leak at
  ×1.5 unless disclosed).

### SR-19
Safety framework replaces the eval gate and the E17 "Red flags" event (SAFETY-REDESIGN §3.8, OD-5).
- **Done.** `SafetyDept.framework` (types `SafetyFramework`, `FrameworkRule`, `FrameworkOverride`, `FrameworkHold`):
  capability assessment (`evalDepth` none / basic / full / deep, `externalReview`) = the base rule every external release
  needs (the old gate's job); rules with a trigger on a MEASURED domain level (`measuredDomain`, the benchmark fit) or on
  beliefs (red-flag traits' est / clarity, internal model), required safeguards (classifiers / hardened on the product;
  control / review on live internal deployments for training rules) and evidence (suite, external evaluation).
  `safety/framework.ts`: `deployHolds`, `frameworkDeployBlock` (deployGate, launch and swap; GateOpts gains `guards`),
  `trainingHolds`, `refreshFramework` (new `frameworkSystem`, order 39, before runs): sets `Deployment.held` on live external
  products (productUsageMult → 0: they serve nobody), pauses running base / post runs, logs new and released holds;
  `frontierPaused` and workfit's frontier experiments also read `trainingHeld`. `overrideRule` (per rule and version):
  safety morale −5, one red flag (whistleblower odds), scrutiny +3, credibility −5 only if published (= the framework
  commitment is live); the consequences are stated in the preview and stored on the override. `editRule`: threshold
  within ±2 L (beliefs ±20 pts) of the default, safeguards / evidence only added. Actions `safety.frameworkEvals`,
  `safety.frameworkRule`, `safety.frameworkOverride`. Default rules (data/v2/framework.ts): Bio High / Cyber High ≥ 10 →
  classifiers + suite (launches); Bio / Cyber Critical ≥ 12 → hardened + external (launches); AI R&D (RSCH) Critical ≥ 12
  → control + review + external (training); Misalignment signs (est > 30%, clarity > 0.4) → control (training).
- **Deleted.** `SafetyDept.evalGate`, action `safety.evalGate`, event E17 and its helpers (frontierRunsGo,
  controlLayerGo, pledgeBreakLines), refDecide / mixed E17 branches, glossary `evalGate` (→ `safetyFramework`),
  DecisionModal E17 hint. ws4.frontierPauseUntil stays for the pauseIfRedline pledge.
- **Edits.** types, data/v2/framework.ts, safety/framework.ts, models/deployments.ts (externallyEvaluated re-exported from
  framework), models/evals.ts (gateDepth / policyDepth / evalDaysFor read the framework depth), models/runs.ts,
  departments/workfit.ts, safety/{actions, agendas, traits, view, safeguards, common}.ts, actors/index.ts (Index reads
  externalReview), models/actions.ts (external-eval preview line), events/catalog/safety.ts, core/{registry, save}.ts,
  bots (common `answerFramework`: ref / race / capex override training holds = old E17 Continue; safe / mixed add control
  where the rule asks for it, else the hold stands = old Continue + control / Pause), UI Safety › Policies row
  (framework summary tooltip, depth / external toggles, one row per hold with an override button), Evals policy card,
  RiskSources, scripts (evals, lint-tradeoffs, lint-ux, safety-emu, ws4, hygiene pins 80, _sr17 pin ≥ 79).
- **Sources.** OpenAI Preparedness Framework v2 (15 Apr 2025: High → safeguards before deployment, Critical →
  safeguards during development); Anthropic RSP v2.2 (2025: CBRN-3/4, AI R&D-4/5, ASL-3 standard, pause if the standard
  cannot be met); Google DeepMind Frontier Safety Framework v3.0 (Sep 2025: CCLs incl. cyber, ML R&D, misalignment). The
  levels and override costs are [D].
- **Save.** SCHEMA_REV 80; migration 79 → 80: evalGate none / basic / full / fullPlusExternal → depth none / basic / full /
  deep (+ external review), default rules, empty holds; evalGate deleted.
- **Check.** `npx tsx scripts/v2/_sr19/check.ts`: 12 ok (migration; no eval-gate action or E17; measured CYBER 10.5 with
  standard safeguards → launch held, classifiers → not held; live product held, usage 0; product.update to classifiers
  releases it; override preview states morale / red flag / scrutiny and what it releases; override releases, records
  three consequence lines, applies morale 65 → 60, scrutiny +3, red flag +1; AI R&D Critical without control holds
  training). tsc (app, scripts/v2) clean; npm run build passes.
- **Left.** No internal-deployment holds (GDM's "large-scale internal deployment" rule); no case evidence ("alignment
  audit passed"); pledges (monitorability, pause) not yet folded into rules; publishing is still the separate BIO ≥ 10
  commitment; the story beat when a rule first fires on hidden-goal evidence (§3.8) not written; editor UI (SR-28);
  default safeguard packages / trusted rule (SR-20); bots do not add classifier safeguards when a launch is held;
  MOOD_BASE.pause now has no reader; GLOSSARY.md not regenerated; scratch `scripts/v2/_sr19/*.cjs, *.txt` untracked.
- Moves calibration: yes (S4/S5, relations, products): E17's pause / control / continue are gone; RefBot / race / capex
  now pay override costs (morale, scrutiny, red flags) each time a training rule fires; mixed / safe keep frontier
  training paused while a misalignment or AI R&D rule lacks more than control; products of models measured ≥ 10 in BIO
  or CYBER on standard safeguards, and ≥ 12 without hardened safeguards and an external evaluation, stop serving.

### SR-20
Default safeguard packages and the "trusted" rule (SAFETY-REDESIGN §3.3 Defaults, OD-6 a).
- **Packages** (`safety/packages.ts`, action `safety.package` {deploymentId, pkg}): Standard / High / Critical set exactly
  their parts in one act. Products: misuse safeguards standard / classifiers / hardened + control defer 10% (Critical).
  Internal deployment: human review / review + control defer 10% / review + control defer 20% (the internal control item
  follows the packages running its model: their `control` flags are set, then `syncInternalControl`). Each meets the
  default framework rules of its tier (High: Bio / Cyber High classifiers, Misalignment signs control; Critical: Bio /
  Cyber Critical hardened, AI R&D Critical control + review). `previewPackage` runs each part in order on a copy and
  reads the engine's own charges before → after (internal: `monitorBudget().control` × compute, `safeguardFte`, the
  compute-weighted `useControl` Slowdown; products: `previewDeployments` revenue and serving need), so part lines sum to
  the total; stop rates are the believed act table before → after. Nothing invented. UI: buttons on the Safety Control
  card (internal) and each product's Safeguards row; parts stay editable on their own controls.
- **Trusted rule** (`safety/trusted.ts`): a model is trusted when no red-flag trait (SCHEME / AF / SAND) is believed
  above the trust line = the player's framework Misalignment-signs estimate (30% default, `TRUST_EST_DEFAULT`); beliefs
  only. `monitorId 'auto'` (`MONITOR_AUTO`, the new default on routine and frontier research): the most capable
  (measured L) live trusted model other than the watched one; a copy of the watched model only if it is the only trusted
  one; none if nothing is trusted. Reason (incl. the more capable model skipped and why) on the Agents lane and in the
  log; a model id or 'same' overrides. The 'same' default (self-monitor, M4) is replaced.
- **Save.** SCHEMA_REV 81; migration 80 → 81 moves routine / frontier research packages on 'same' to 'auto'. hygiene
  pins 81; _sr19 check pin ≥ 80.
- **Check.** `npx tsx scripts/v2/_sr20/check.ts`: 12 ok (migration; High on internal sets review + control defer 10% and
  the engine then charges the previewed +43 H100e control compute; stop rates rise; High on a product sets classifiers and
  the preview revenue equals the engine's; auto picks the most capable trusted, skips a more capable model believed 50%
  scheming with the reason, flips back when the belief drops; override kept). tsc (app, scripts/v2) clean; build passes.
- **Left.** Products' monitor has no 'auto' option (still manual / none); RefBot keeps its own cost-ratio monitor picker
  (a bot override); no OD-6 "below the scheming-capable level" clause (belief line only); no package for lockdown;
  glossary has no `safeguardPackage` / `trustedModel` terms; retire block does not count a model that is only an auto
  watcher.
- Moves calibration: yes (S4/S5): default internal watchers are now the most capable trusted other model (cheaper or
  weaker than a copy, no same-lineage collusion penalty when another base is chosen), changing coverage, catch and the
  control gap for player and bots that keep the default.

### SR-20b
Products and RefBot use the SR-20 trusted-watcher picker (OD-6 a).
- **Products.** `monitorId 'auto'` (`MONITOR_AUTO`) on a product = `autoWatcher(s, product model)` (safety/trusted.ts),
  resolved by `productMonitorVersion` (models/products.ts) everywhere a product's monitor is read: cost ratio / serving
  overhead, `productMonitor` (stop, act table, detection, incidents), catch readouts (productView, edit preview), monitor
  upkeep (counted only when a watcher resolves). `editBlock` accepts 'auto'. UI: Products card Monitor chip has
  "auto · <model>" first, with the reason tip (`prod-monitor-auto.<id>`); a model id or "no monitor" overrides. Not the
  launch default (new products still start with no monitor unless the launch sets one).
- **RefBot.** `refMonitors` sets routine / frontier research to 'auto' (the player's picker) instead of its cost-ratio
  pick; `REF_MONITOR_COST` and the picker deleted; the budget (`REF_MONITOR_SPEND`) is unchanged. No new constants.
- **Save.** No state change; SCHEMA_REV stays 81.
- **Check.** `npx tsx scripts/v2/_sr20b/check.ts`: 6 ok (product on auto watched and billed by the picker's choice;
  override kept; RefBot's routine / frontier monitors = the picker's choice). tsc (app, scripts/v2) clean; build passes.
- **Left.** Product launch default is still no monitor; auto watcher of a product is not marked 'deployed' and does not
  block retiring that model (same as internal).
- Moves calibration: yes (RefBot): its watchers are now the most capable trusted model instead of the ≈10%-cost model,
  so coverage per monitoring budget falls (dearer watcher) and strength rises (smaller oversight gap).

### SR-21
Safety needs list in LAB's one allocator (SAFETY-REDESIGN §5, OD-9 (a)). Commit 7f57afc.
- **Done.** `SafReNeed` = review (human review on the safeguards; SR-13b took it before the list), cases, validation,
  evals (eval suites; was the capability engineers' ReNeed 'evals'), envFix, removal (was 'patches'), safExp. Default
  order (§5): review, cases, validation, evals, envFix, removal, safExp; the player reorders it in Company › Work.
  `safAllocation` fills staff in that order (one `allocate()`); compute = sub-uses of the Safety line: cases (their
  chosen shares) and eval suites (`evalH100eAsk` at the engineers they got) ask fixed H100e, filled in the same order;
  validation jobs and line experiments share the rest by need (RD-B08). `SafAlloc.compute` per need {ask, got},
  `computeIdle`, `caseScale`. Eval suites: `evalsDay` gets the 'evals' need (÷ TEAM_SIZE.re, m of safety experiments)
  and its H100e; the capability experiment pool no longer pays for them. No separate eval team exists as a hire type
  (the science column 'evals' is a safety science team column, not suite staff).
- **Readout.** `safetySpend(s)` (safety/spend.ts): a row per need in the order plus "Monitoring & control (deployments)"
  (the monitors' line, compute only, set in SAFETY), each with staff / compute ask and got, cost (payroll share of the
  safety research engineers, H100e at the rental rate) and filled; idle staff / compute / cost beside; total = Σ filled.
  Company › Work's safety card shows "Safety spend $/yr · people + compute" with the rows in its tooltip. Glossary
  safReNeeds rewritten (GLOSSARY.md not regenerated).
- **Deleted.** departments/agents.ts `safetyPoolClaims` / `SafetyPoolClaims` / `PoolClaim` (RD-B07 claim pool; readers:
  investigations caseRate, Investigate preview → `caseComputeScale`, safety view), SR-13b's pre-list commit of the
  review staff, ReNeed 'evals' (reDemand, research.last, production's reRes, evalQueueView / evalPolicyView /
  evalDaysEstimate now read the safety list). `linePoolH100e` stays as a readout (= the pool after cases and evals).
- **Save.** SCHEMA_REV 82; migration 81 → 82 rewrites research.safRe (review first, patches → envFix + removal in
  place, evals before line experiments, patches' caps → envFix, deduped) and drops 'evals' from research.re; hygiene
  pins → 82.
- **Check.** `npx tsx scripts/v2/_sr21/check.ts` (13 ok): day-400 migrates to the seven needs; 30 people vs 123.5 asked
  → filled in the order, the rest unfilled, none idle; reorder (evals, envFix first) → served follows; evals staffed
  from the safety list; line = Σ sub-uses + idle; spend total = Σ filled costs ($56.8M/yr); no claim pool / pre-commit /
  capability evals need in src. tsc (app, scripts/v2) clean; npm run build passes.
- **Left.** Human review below its staffing still reviews fully (`labReviewOn` is a switch; needServed('review')
  exists but no reader); a case keeps its chosen compute when its engineers are short; product monitors bill to serving
  (not in the spend rows); per-job reordering inside validation / evals; AI staff package share per job (SR-22).
- Moves calibration: yes (safety, research): eval suites now take safety engineers (they compete with cases and line
  experiments; the capability engineers and experiment pool get theirs back); human review is in the list (defaults
  first, as before); cases' compute is cut only by evals ahead of them; production's reRes no longer subtracts evals.

### SR-22
Safety work package: spot-checks, AI share per job, expected vs observed (SAFETY-REDESIGN §3.10, §4.3 channel 5; RD-S08 /
SAF-26). Commit 19c7fd1.
- **Package.** The safety agent package (player.agents.safety) keeps its model (RD-A06) and compute; new
  `AgentPackage.spotCheck` (0 / 0.02 / 0.1; absent = none), action `safety.spotCheck {share}` (preview: safety engineers
  taken, believed catch at the model's measured level). Company › Agents at work, safety lane: "Spot-checks" none / 2% /
  10% beside Trusted to AI (tooltip: in effect, engineers, believed catch). Module `safety/workPackage.ts`.
- **Staff.** SafReNeed 'spotCheck' (default order: review, spotCheck, cases, …): demand = q × SPOT_COST × the human
  heads the AI's share of safety work would take (Σ A·H·heads over SAF_EXP, SAF_IDEAS); SPOT_COST = 1 [D] (a re-check
  takes the time of the work). In effect q·σ, σ = needServed('spotCheck').
- **Catch.** `safetySabotage` (every SAFSAB: line results, open-study results, cases): catch = 1 − (1 − catch)(1 − spot),
  spot = q·σ · HUMAN_REVIEW · humanReviewFactor (the same human-review rule as E6) × oversightOpen. AI-assisted
  validation of a false instrument: each planted case re-run by humans with prob q·σ finds the true recall (SR-10's
  "AI-run hides it" now leaks in proportion to the spot-checks).
- **Jobs.** `SafJobResult {aiShare, spot, expected, observed}` on FindingRecord (line tests and open-study results:
  expected = believed efficacy before the result, observed = shown TECH / EVAL / DISC), ValidationResult.job (believed
  recall vs found ÷ n), Investigation.job (believed level of the most severe target trait at opening vs found it:
  confirmed / discovery), EvalRecord.suiteJob (believed vs measured mean misbehaviour rate over the safety evals).
  AI share: lines `lineLabour().aiShare`, validation / case / self-run suite the SAF_EXP A (0 human-run / external).
  Readouts: line row Results tooltip (last year Σ expected vs working, AI share), Results card tooltips, validation
  queue rows ("AI x%" / human-run) and the Validation card tooltip (last results expected vs found), case card line,
  Evals queue tooltip (AI share, last suite expected vs observed). No truth stored: expected from beliefs, observed =
  what the player is shown. Glossary spotCheck, expectedObserved; safReNeeds mentions spot-checks.
- **Save.** SCHEMA_REV 83; migration 82 → 83 puts 'spotCheck' after 'review' in research.safRe (first if no review);
  hygiene pins → 83. scripts/v2/_sr21/check.ts still pins 82 (and the order length 7): fixture drift.
- **Check.** `npx tsx scripts/v2/_sr22/check.ts` (all ok): migrates; A 0.23 at Trusted 80%; spot ask 0 → 0.5 → 2.5
  engineers, SAFSAB catch 0.483 → 0.486 → 0.499 (uncaught rate down); case / suite / validation report AI share; false
  instrument AI-assisted: unchecked observed 0.438 vs expected 0.444, 10% spot-checked 0.375 vs 0.444. tsc (app,
  scripts/v2) clean; npm run build passes.
- **Left.** The spot-check catch is small (human review's 0.3 × gap factor on 10%); no separate "spot-check
  disagreement" chip (a caught SAFSAB is the existing internal incident); the sandbag slow-down (safetySandbag) is not
  touched by spot-checks; expected is taken just before each job's own result (cases: at opening), not at queue time;
  no picker UI for re-ordering the new need beyond the existing list.
- Moves calibration: no (spot-checks default to none; the new need asks 0 at q = 0).
