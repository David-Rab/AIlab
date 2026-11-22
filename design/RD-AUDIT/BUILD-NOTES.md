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
