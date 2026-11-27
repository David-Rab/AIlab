# Inventory notes: capability chunk (prefix `cap`)

Registry file: `balance/params/capability.ts` (8 worked examples kept, 334 entries added; 342 total; 14 inline).
Counts by kind: designer 155, sourced 67, untagged 58, derived 34, fitted 13, stand-in 6, unclear 9. Layer: world 332, policy 10.

## Questions

| id | question | evidence |
|---|---|---|
| Q-capability-1 | Where do the verifiability values `v` of WORK_TYPES (0.9 / 0.7 / 0.3 / 0.5 / 0.2 / 0.4) come from? Sourced from R20 E3, or design values? Registered `unclear`. | workTypes.ts:29 tags only "H and weights D"; :21 cites R20 E3 for what `v` does, not for the numbers |
| Q-capability-2 | V3_CAL.fast.dBM 0.6: fitted (CP3j, "Δ_bm 0.75 fails") or sourced ("0.6 its floor" of the AIFM range)? Registered `fitted`. | workTypes.ts:282-285 |
| Q-capability-3 | PROJECT_MAX_TEAMS (6): world rule or planner policy? Registered `world`; RE_MAX_PER_PROJECT is called "a policy number" and registered `policy`. | research.ts:131 vs :145-146 |
| Q-capability-4 | Several values are tagged both `[D]` and "sourced" (EXPLOIT_START, EXPERT_START_T, EXPERT_PRICE_B_PER_T "[D, sourced per family / unit]"; P10_SYN_Q_RAISE has "Sources:" and "Size [D]"). Registered `unclear`. Which kind should they carry? | suites.ts:12, :34; dataAssets.ts:78-85 |
| Q-capability-5 | Do file-header pointers count as tags? Benchmarks header says rows are "research/12 §0.5 converted to L units" (mL, kL), the paradigms header names "research/12 §0.7" for the priors; I registered both as `untagged` because the rows carry no tag. Are they `sourced`? | benchmarks.ts:1-2; paradigms.ts:1 |
| Q-capability-6 | MMMU (mL -0.2, kL 0.5) and EmbodiedBench (mL 4.9) rows are tagged `[D]` (RD-M01b) but described as a fit to anchors ("fit m_G 25.4, k_G 1.0"). `fitted`, `designer` or `derived`? Registered `unclear`. | benchmarks.ts:39-49 |
| Q-capability-7 | V3_CAL.slow.dBM 1.6 has no refit entry or source of its own; the doc comment tags Δ_bm "[fit]" for the whole group. Fitted, or just carried from a default? Registered `unclear`. | workTypes.ts:202-204, :318 |
| Q-capability-8 | V3_CAL.sampled.* are literal copies of ai2027's (comment: "`sampled` uses ai2027's"). Registered `derived`, but the code does not compute them; a tuner could change one without the other. Should the registry tie them? | workTypes.ts:209, :319 |
| Q-capability-9 | RL_FAMILIES taskH for swe / mlResearch / longHorizon (2 / 8 / 40) are literal copies of WORK_TYPES H (comment says so); RE_LABOUR_UNIT and RE_MAX_PER_PROJECT are both 2 by hand; B0_PARAMS and FLOP_RL_REF both hold 3e26; E_START 1.19 is a literal for "START_STATE.b0 + 0.48 x 256 d". Linked values that tooling would have to move together. | runDesign.ts:211-213, :21-23, :56, :90; workTypes.ts:189-190; research.ts:145-147 |
| Q-capability-10 | `unit` of H50_PER_OOM (4.2) is not stated: the comment says "Horizon per OOM of effective compute (METR 4.2-month doubling ...)". Is it doublings-per-OOM, a horizon multiplier, or months? | workTypes.ts:144-145 |

## Skipped

Every line of `balance/coverage.txt` in this chunk's files that is not registered as an export entry. (Note: I ran `npm run registry:lint -- --coverage` once and it regenerated `balance/coverage.txt` in the worktree; the file is untracked. Lines already registered by anyone had dropped out of it. The original lines for my files are all accounted for below or registered.)

| coverage line | reason |
|---|---|
| actions.ts:5 RELATION_ACTION_META | ids and titles only (enum) |
| calibration.ts:47 PRESET_BY_LABEL | label to id map (enum) |
| calibration.ts:64 AI2027_COMPUTE_TABLE | display only (end screen); no engine reader per its comment |
| calibration.ts:89 GOLDEN_EXPECTED | target (B4) |
| calibration.ts:95 GOLDEN_SAMPLED | target (B4) |
| calibration.ts:97 GOLDEN_TOL | target (B4) |
| naming.ts:14 RUNG_THEMES | glossary prose (word lists) |
| naming.ts:65 RUNG_EDGES | naming display only (picks a rung word from the measured level) |
| naming.ts:78 TIER_EDGES | naming display only (size-band words) |
| research.ts:86 IDEA_W | not exported; registered inline as `cap.research.IDEA_W` |
| runDesign.ts:45 PARAM_SNAPS | UI snap points ("The engine takes any value in the ranges") |
| runDesign.ts:47 TPP_SNAPS | UI snap points |
| runDesign.ts:101 RL_FAMILY_NEEDS | id map (family to paradigm id) |
| runDesign.ts:130 REFERENCE_BASE | built from B0_PARAMS / REF_TPP (both registered) and ids |
| runDesign.ts:243 SIGNAL_IDS | pure ids |
| tree.ts:106 V2_PARADIGM_EFFORT_TM | not exported; registered inline as `cap.tree.V2_PARADIGM_EFFORT_TM` |
| tree.ts:288 OPTION_NODE | id map (option to node) |
| workTypes.ts:108 SKILL_MARK_STANDINS | z values are NaN placeholders, computed at runtime (models/capability.ts skillMarks) |
| hidden.ts:71 SKIPPED_DRAWS | draw-order compatibility with deleted paradigms, not a game parameter |
| hidden.ts:72 TRAILING_DRAWS | same |

Also registered with no coverage line (not caught by the checker): TRAIN_CAP, B0_PARAMS, DIFFICULTY_RANGE, TREE field families, hidden.ts inline literals. Files with nothing to register: `engine/v2/world/calibration.ts` (functions only), `names.ts` (strings), `aftermath.ts` (end-screen prose, no numbers).

## Inline overflow

Cap is 40; 13 inline entries used, so nothing is over the cap. Candidates looked at and left out on purpose:
- src/data/v2/tree.ts:256 `classOfTM` thresholds 6 / 12 / 24 team-months: effort class labels for display (the engine reads effortTM).
- src/data/v2/runDesign.ts:143 `sizeScrutiny` base `5` is registered; the `3` in `Math.log(3)` is the same "per x3" and is not separate.
- src/data/v2/features.ts:97 `enablerNeed` share / (1 + share): structural formula, no free constant.
- src/data/v2/workTypes.ts:195 `C_UNIT_FLOP_PER_DAY` expression (1e6, 0.05, 11, 0.88): same numbers as DAY0_REF (registered), computed.
