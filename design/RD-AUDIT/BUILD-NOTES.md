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
