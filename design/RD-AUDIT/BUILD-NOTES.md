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
