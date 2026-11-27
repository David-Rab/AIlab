# N12 result: the NPC clean-up

Task N12 of NPC-TASKS.md, branch `npc-n12` (off `npc` 938b08ef). Spec: NPC-LABS.md §12. No heavy tests were run (designer's session rule).
SCHEMA_REV 113 -> 114 and `MIN_SCHEMA_REV` = `SCHEMA_REV`: the whole migration chain in core/save.ts is deleted (no save below 114 loads; the chain
could not reach 113 anyway). Moves calibration: no, except the items under "Behaviour that changed" below.

## Deleted

- **Old NPC capability:** `actors/rivalModel.ts` (819 lines: recipe, base runs, versions, continual learning, idea adoption, research
  aggregate, `initRivalPhys`, `startDistillEquilibrium`, `recordToolShips`, `toolNewInGame`, ...) and `data/v2/rivalModel.ts`.
  Survivors live in the new `npc/model.ts` (`setModelG`, `baseParams`, `fptOfSimpleModel`, `npcServeOom`, `npcDecodeU`, `npcServeFpt`);
  `labReferenceSplit` / `growLabStaff` moved to `npc/lab.ts`; `RIVAL_TPP`, `SERVE_RATE0` to `data/v2/npcLabs.ts`.
  `production.ts`: `rivalResearch`, `effLab` (and the China calibration scale), the rival branch of `computeProduction`; `rivalSpeedMult`;
  `RIVAL_IDEA_IDS` / `P24_RIVAL_IDEA`; `FORCING.pinResearchMix` / `noIdeaAdoption`; `chinaEfficiency` (three world types, `world.ts`) and the
  China presets' `efficiency` field; `chinaGapFormulaMonths` / `GAP_ALGO_OFFSET` (a display/T3 formula of the old China model).
- **`RivalLab.phys` and every adapter (N2b1 table):** `rivalRunFlop` = the largest internal model's training FLOP; `distillationLeak` reads the
  internal model's parameters; theft's stolen copy is set by `setModelG` from FLOP/size/G (no base, no recipe parts); `recipeOf` -> `npc.rec`;
  serving by `npc/model.ts` (one value per day for every lab: `npcServeOom(day)`), so `rivalServe*` are gone. `RivalBase`, `RivalPhys` types gone.
- **Rival safety:** `rivalTraitStep`, `effSafety`, `rivalSignals`, `labPosture`, `growthMult` (TraitEnv), the `rhetoricGap` draw and posture fields
  `rhetoricGap`, `rlIntensity`, `prefIntensity` (SafetyPosture now has 6 values), `sharedTechniquePool` (state, A4 / C3 / publish-finding writes, the A4 preview
  "alignment +0.03" line), `labModelHazards` + `RIVAL_SITE`, `traitsTrue` / `uModes` on `SimpleModel` (theft copies, lineup students, constructors) and the
  `latent:` flags (`LATENT_P`, `LATENT_ERA_OOM`). `labMisalignment` now returns `npc.m` for NPC labs.
- **Leader special cases:** `LEADER_ID`, `initialLeaderLab`, `initialRival`, `LEADER_LAB_NAME` / `LEADER_MODEL_FAMILY` / `RIVAL_NAMES_V2` /
  `RIVAL_MODEL_FAMILIES`, `LEADER_MAX_BINDINGNESS`, the leader posture row of the old archetype table, the T1L rows (calib.ts, calscan.ts,
  balance/targets.draft.ts).
- **Dead state:** `RivalLab.archetype` (replaced by `npc.kind`; `RIVAL_GOV`, `KIND_POWER` (epilogue), `AFFILIATE_KIND`, `FIN` and the posture / clause tables are
  re-keyed by kind; `LAB_ARCHETYPES` and the sampled-rival draws in `world/hidden.ts` deleted), `meters` (`poachAggression`, `lobbyStance`, `openness`),
  `visible.frameworkVersion` (headline now counts `ws4.goalposts`), `visible.indexGrade`, `nextBaseDay`, `rival:*` trust stocks (and the C1 / C3 / C4 / E16 trust effects and their preview lines),
  `hidden.actorPresets.rivals`, the empty `intelSystem` (and its registry line), `PUBLIC_NOISE`, `releaseCadenceDays` (per kind), per-lab `headcount`,
  glossary `npcAppetite`, `SCRUTINY_WINDOW_DAYS`, `RELEASE_LAG`, `BASE_MONTHS`, the stale "day the others get it" tool text (`toolRivalsView` now reports have / of and the 120 d build time).
- **Poach aggression (decision):** E16 fires from an active NPC lab whose race response is above 0.7 (leader 0.8, racer 0.9); the RiskMap talent-poaching edge is drawn
  for labs with race response above 0.5, its width the race response (`raceResponseOf`, npc/lab.ts). C4 no longer raises the poached lab's aggression.
- **Scripts:** deleted `rivals.ts`, `lagdays.ts`, `leadreaders.ts`, `_cp4/lead.ts`, `_rfp6/check.ts` (they test the old research path / intel model / recipe leak
  functions). Fixed to the new fields: `hygiene.ts` (leader-lab checks and the paired leader-lab perf test removed), `ws4.ts` (E2 names, intel loops, T3 formula-gap check removed;
  rival ASI scenarios set `npc.m`), `finance.ts` (FIN5b pool / raise / distress-by-cash / bankruptcy-by-cash blocks removed; IP access check uses `ipAccessDays`; archetype -> kind),
  `research.ts` (RD-B16 China-recipe check removed), `lint-tradeoffs.ts` (B40 recipe-lead block removed), `serving.ts`, `milestonepred.ts`, `npcMarket.ts`, `npcData.ts`, `signals.ts`,
  `control.ts` (four rival/China ending forcers removed; `npcEndings.ts` covers them), `danger.ts`, `calib.ts`, `calscan.ts`, `lib.ts`, `starts.ts`, `uitest.mjs` (picker ids, leader-lab blocks).
- **Registry:** 190 entries of deleted constants removed (acd, act, cap, fin, mkt, saf, sfe), `act.RIVAL_DISTILL_LAG_DAYS` / `LINEUP_MAX` / `acd.RIVAL_TPP` / `SERVE_RATE0` re-pointed, three
  targets (R9, R5, R8: checks of the deleted rivals.ts) removed, the pre-existing double-match anchor `sfe.traits.playerMods.constitution` fixed. **Registered (new, `act.npc.*`):**
  DAYS_PER_MONTH, CHINA_PLAN_GROWTH, SLOPE_FLOOR_PER_YEAR, SLOPE_WINDOW_YEARS, STAFF_PER_H100E, RELEASE_CADENCE_DAYS, RACE_MONTHS, SAFETY_CUTS_M, H0_PER_YEAR, SAFETY_CUTS_INCIDENTS, SEV_SPAN,
  SEV_LEVEL_TOP, FOCUS_OFFSET_OOM, TOOL_FOCUS_MIN, THEFT_INTEGRATION_DAYS, TREATY_CLOCK_RATE, JOINT_EVAL_STEP, SPILL_DAYS, TRACK2_DAYS (kinds as in the code's own tags).

## Behaviour that changed (all small; none is a mechanism the designer asked for)

1. `rivalRunFlop` (public scrutiny of the player's runs): the old "recent base within 365 d, else any" rule is the largest internal model's FLOP (NPC internal FLOP tracks compute daily).
2. Rival trust and poach aggression are gone as state: C1's "+5 trust with rivals", C3's trust / maverick antitrust-trust split, C4's "-10 trust, +20 aggression", and E16 Sue's trust cost no longer exist
   (nothing read the stocks). C3 keeps the racer-kind "antitrust: safety cartel" scrutiny.
3. The world RNG stream: `sampleHidden` no longer draws the four sampled rivals (archetype pick + noisy postures) or 9 posture fields for China (6 now); later draws of the 'world' stream (the late edge
   weights) take different values for a given seed. Same distributions; no mechanism changes. **Revert is possible (keep dummy draws) if the lead wants seed-for-seed continuity.**
4. A4 no longer previews "alignment +0.03 (shared technique pool)": the pool only ever lowered rivals' trait drift.

## Not deleted, and why

- `RivalLab.distilling`: not dead. It is the lineup pipeline (a release's students go on sale 5 months later, npc/market.ts).
- `pressureDays` and `pressure`: goalposts (`goalpostsQ`, the Index grade) and `worldfx/control.ts` still read them.
- `RivalIntel.knownIncidents`, `RivalFinance.cash/raised/poolQ` (display / exit payback text), `parentFunded` (says which labs the bust cannot reach).
- `tools.ts` `LabArchetype` / `toolsAtStart` / `shipped` (data keyed by the old archetype names; `npcData.ts` checks the cast's start tools against it).
- Stale comments naming `actors/rivalModel.ts` in older files (data/v2/research.ts, serving.ts, models/research.ts, workfit.ts, ces.ts, types.ts); text only.
- Stale expectations I could not judge without a run: ws4.ts T3 "China mean lead 150-200 d" and T4 "3-9 months" (the cast puts China at 198 d, 6.5 months, and the upstart / open-weights at up to 9.6 months;
  balance/targets.ts T3 / T4 carry the same numbers). Spec §13 checks 2 and 6 want the new bands.

## Checks run

`npx tsc --noEmit -p .` clean; `npx tsc --noEmit -p scripts/v2/tsconfig.json`: only the pre-existing `tastecurve.ts` unused `tasteSigma`; `npm run registry:lint`: 0 errors; `npm run build` ok.
npcData, npcReference, npcSetup, npcPublic, npcRisk, npcEndings, npcShocks, npcMoney2, npcMisalignment: all pass.
`git grep` of the done-when pattern over `src` returns nothing.

## For the lead (not run; needs the designer's approval)

- Fixtures (stale: SCHEMA_REV 114, and the cast): `npx tsx scripts/v2/fixtures.ts --write` (a game run; heavy). Until then every script loading `scripts/v2/fixtures/*.json` (control, products, finance, ws4, danger, ...) throws OLD_SAVE_MESSAGE.
- A whole-game pass after the fixtures: `npx tsx scripts/v2/calib.ts --smoke`, `hygiene.ts --no-perf` (determinism, stream isolation, save round trip), `ws4.ts`, `finance.ts`, `serving.ts`, `npcLabs.ts`, `npcMarket.ts`, `lint-tradeoffs.ts`.
- `scripts/v2/uitest.mjs` (`npm run test:ui`): edited blind (picker ids, the leader-lab sections removed); needs one run.
- `balance/targets.ts` T3 / T4 values against NPC-LABS §13 (see above).
