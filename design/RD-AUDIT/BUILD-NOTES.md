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
