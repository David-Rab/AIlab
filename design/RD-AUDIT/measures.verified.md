# MEASURES audit: verification

Verifier: read-only. Re-ran both auditor probes (`probe/knots.ts`, `probe/day1.ts`) from the repo root; outputs match the
auditor's table and day-1 numbers exactly. All paths relative to `src/`.

---

**MEA-01 · CONFIRMED · high** · Player milestones are work-type predicates (engine/v2/departments/workfit.ts:414-427, recorded at models/capability.ts:303-306), non-player labs record λ(best G) ≥ LEVEL_KNOTS[i] (capability.ts:308-313), and endings compare them directly (endings/endings.ts:112-130: rival `milestoneDays[6]` vs player `[6]`; rival `[5]` vs player `[4]`). Stage 2 for both comes from `milestoneDays[3]` (production.ts:176 player, :399 rivals). Minor detail: gov does not read the `seenMilestone` flags. It reads the measured level against the same knots (actors/gov.ts:46-53, 126-128, 293, 314), so it is the same definition (c). Not mentioned: the player's own record mixes definitions too. Its day-0 entries come from the λ rule (core/init.ts:242 `initialMilestones`), later ones from work types (see MEA-V01). The fix is sound.

**MEA-02 · CONFIRMED · medium (auditor: high)** · `domainG` adds `offL/LEVEL_PER_OOM` to fit (departments/workfit.ts:56), while `finishBuild`/`domainsOf` add `offL` 1:1 to the displayed level (capability.ts:118-120, 136). Hazard curation goes through `sD = offL/2` (models/design.ts:39). `REEVAL_DG = 0.3/1.2` (data/v2/evals.ts:77). Correction: the slope range is 0.16–12.96 L/OOM, not "0.64 to 13" (the auditor's own table has authors2026 SAR→SIAR 0.16). "Up to 10×" still holds (12.96/1.2 ≈ 10.8; 1.2/0.16 ≈ 7.5). Severity: the mechanics stay internally consistent in OOM, so the harm is a display/mechanics mismatch, not a wrong outcome. That makes it medium. The fix is sound. Overlaps MEA-04 and MEA-20.

**MEA-03 · CONFIRMED · high** · `modelRate = rate + (1 − share)` unless stage 2 (actors/rivals.ts:195-197). The player's `rate` is `gRate/B × rateMult × M/M0` (production.ts:195), rivals' is `eRate/B` (actors/rivalModel.ts:375). The probe shows `paceOf` 1.192 = 0.692 + 0.5 and 1.092 = 0.692 + 0.4. The term depends only on world share, never on the lab's compute. Unit slip: the term is +0.5/+0.4 progress-years a year, which is +0.6/+0.48 OOM/yr, not "0.5 or 0.6 OOM/yr". Count: I get 43 non-comment, non-import `B_G_PER_Y` lines in 21 files. Per-file counts differ slightly (rivals 6, rivalModel 1), but "about 40" is right. Scope note: `trueLeadDays` (player vs X) does not use `modelRate` except via the `preGameRate` fallback. The term hits rival-vs-rival `leadBetween`, intel, theft, release lag, open weights and the epilogue. The fix is sound. Overlaps MEA-07, MEA-23 and MEA-26.

**MEA-04 · CONFIRMED · medium** · Only `REF_OFF[d][0]` is read (capability.ts:136; data/v2/calibration.ts:133-135 says so), and it never enters `domainG`/`fitOf` (departments/workfit.ts:53-69). Fit difficulty lives only in `refDelta` (data/v2/workTypes.ts:59-63). Note: REF_OFF does matter mechanically through benchmarks, danger flags and rival hazards (models/benchmarks.ts:30-34). So "no mechanical effect on work" is accurate, but the claim does not extend to safety. The fix is sound, but the danger-flag benches need a replacement source.

**MEA-05 · CONFIRMED · medium** · `playerStartOf` uses v1 `multiplierAt`/`stage1`/`share`, `pcRefLab` and `START_RETAIN` 0.7 (capability.ts:159-188). The probe gives `startVintage(paBase)` = 1.2·(0.0678 − 0.5062) = −0.53 and `startVintage(paPost)` = −0.04 on ai2027. `gV0` reads both (capability.ts:101-110). The fix is sound. It shares its root with MEA-06, MEA-08 and MEA-24.

**MEA-06 · CONFIRMED · medium** · Rivals, China and the leader solve k (and m for the leader) from their own day-0 recipe rates (actors/rivalModel.ts:426-481). The public model is set at G − 0.15·B (actors/rivals.ts:82; actors/china.ts:49) and then overwritten (rivalModel.ts:478). The leader twin's B0 vintage (bisected m) is not the player's −0.53/−0.04. The fix is sound. Effectively a duplicate root of MEA-05.

**MEA-07 · CONFIRMED · high** · All seven definitions are in the cited code: `trueLeadDays` on `series.L` (capability.ts:229-279; record.ts:23-24 r3, capped λ), `leadBetween` gap/mean(rateOf)·B (rivals.ts:212-219), the intel blend (intel.ts:32-50), the China prior `0.6·365·0.8` (china.ts:52), the epilogue `max(0.3·B, pace)·0.7` (epilogue.ts:58-61), theft 60 d·rateOf with a 3·B clamp (theft.ts:88-93), open weights `min(2, gap/pace·12·0.5)` (rivals.ts:462), and release lag (rivals.ts:407). Missed reader: `epilogueSurvival` weights labs by rival-vs-rival `leadBetween` (endings/scoring.ts:29-30), so definition 2 reaches the score. Caveat: the "flat series past λ 15" point is nearly moot, because a non-player lab at λ 15 ends the game at once (rival ASI = λ ≥ 15). The fix is sound.

**MEA-08 · CONFIRMED · low** · `timeline.calShift = alignedCalShift` (world/hidden.ts:72) has no readers. `thresholds()` has no callers, and RefBot passes the `CAL_SHIFT` table explicitly (bots/ref.ts:75-80). The doc at capability.ts:41-43 is therefore wrong. The fix is sound.

**MEA-09 · CONFIRMED · low (auditor: medium)** · `oomOfLevel` copies LEVEL_AT and `gOfLevel` without the L ≥ 0 clamp (safety/oversight.ts:24-38 vs capability.ts:61-66). `versionOom` = `oomOfLevel(v.Lg)` (oversight.ts:86-88). Call count: about 22 `versionOom`/`measuredOom` uses and 57 for all converters including definitions, so "52" is about right. Severity: the post-ASI cap matters only in the narrow window where the player's λ ≥ 15 but the work-type ASI is unmet. Otherwise it is pure duplication, so low. The fix is sound.

**MEA-10 · PARTLY · low (auditor: medium)** · The mechanics are as described: REF_M_LEVEL goes through `refPathWorld` (ai2027) into OOM (safety/oversight.ts:44-83; data/v2/oversight.ts:53-61). But the resulting `oHalf` is a world-independent OOM constant applied to each world's real OOM (`versionOom`). That is already the "physical unit" behaviour the fix asks for. The real issue is provenance and bridge code (the per-process cache, M½ data), not a wrong decay in slow or fast worlds. The fix (freeze as OOM literals) is sound and cheap.

**MEA-11 · CONFIRMED · low** · `labConstOf` uses general G for EXP and IDEAS coverage, win rate, h50 and sdAI (actors/rivalModel.ts:283-294). Rival domains come from `domainsOf(w, G)` without offsets. The fix is sound.

**MEA-12 · CONFIRMED · medium** · `learnsOnline` is λ ≥ CL_LEVEL 8.5 (actors/rivalModel.ts:517). `clRefresh` has no cost (523-531), while the player pays `STREAM_POOL_SHARE` and needs P08 (models/actions.ts:199-205). RefBot opens P08 at `Lg(s, 7)` (bots/ref.ts:96). Note: 8.5 sits a fixed 70% of the way from V0 to SC in OOM on every preset, so it is proportional across presets, not arbitrary. The asymmetry is the real finding.

**MEA-13 · CONFIRMED · medium** · LEADER_CAL is {−0.15, 0.07, −0.01, 0.8} (data/v2/calibration.ts:57), and the CHINA_CAL refit history 2.4 → 3.2 → 1 → 1.5 is in the comments (calibration.ts:69-81). Applied via `effLab`/`evalRival` (production.ts:390). The fix is sound but L effort.

**MEA-14 · PARTLY · medium** · Diffusion runs only from `LEADER_ID`'s public model, into the player's pretraining stack (production.ts:487-494; stacks.ts:190-193). K was fitted to a lag target (calibration.ts:59-66). Wrong detail: "once a rival other than LEADER_ID is ahead, diffusion is zero". It continues from the leader lab whenever the leader's public G exceeds the player's best, whoever leads. It is zero only when the leader lab is behind the player or absent. The fix is sound.

**MEA-15 · CONFIRMED · medium** · A4 previews `leadDays 9` but applies `9/365·paceOf·B·0.3` to `rec.pre` (actors/actions.ts:109-115; rivalModel.ts:141-142). E16 previews 36 d (events/catalog/company.ts:36-42). C6 previews `60/behind` (actions.ts:343-350). Small errors: SPILL is a fixed 0.02·B gain to the *player* (safety/findings.ts:35), not paceOf-scaled. C4 is likewise a gain to the player (actions.ts:332), so not every listed item is "a leak to a rival". The fix is sound.

**MEA-16 · CONFIRMED · low** · `prodParamsFor` builds `buildKnots` for every world (world/hidden.ts:41-46). The only readers are the non-v3 branches tagged BRIDGE(V7) (production.ts:264-271, 289, 442). Exactly 26 `BRIDGE(` tags.

**MEA-17 · CONFIRMED · medium** · `measuredL = Lg + errTrue/√nEff`, one N(0, 0.2) draw (models/benchmarks.ts:102-109). The only writer is benchmarks.ts:109. `sandbagGap` enters only `measureBench` for dangerous benches (benchmarks.ts:37, 52). The glossary claims sandbagging biases L down (data/v2/glossary.ts:19). This is a phantom claim. Both fix options are valid. Deriving L from the benches is the better one, but it moves RefBot gates, gov `seenL` and acts.

**MEA-18 · PARTLY · medium** · The thresholds exist as cited (spot-checked rivals.ts:261/265/299/356/431, safety/detection.ts:32, safety/control.ts:167, safety/common.ts:23, capability.ts:326). But the argument "they sit at different physical capabilities per preset" is wrong for the knot-aligned thresholds (10/12/13.5/15). λ is anchored there to the reference recipe's work-type SC/SAR/SIAR/ASI points in every world, so those are consistent by construction. The between-knot ones (6.5, 7, 8.5, 9, L − 7, L − 8, Lg/10) are fixed fractions of the V0→SC OOM span and do vary physically. The slope range is again misquoted (0.16–13).

**MEA-19 · CONFIRMED · medium** · `progress` with no unit renders as "x.xx L" (ui/v2/kit.tsx:221; ui/v2/ui.tsx:117, 134, 142). The stream previews are constants +0.2 / −0.1 (models/actions.ts:203, 211), and the safety patch uses `unit: 'yr'` (safety/actions.ts:151). The fix is sound.

**MEA-20 · PARTLY · medium** · Every UI site exists (ui/v2/panels/chips.tsx:48 OOM/levels/Elo; Blueprint.tsx:458; setup/Setup.tsx:113; Overview/RiskMap lead ± d). But "twelve scales" is inflated. "Levels of gap" (7) is the L scale, "months behind" (12) is the lead-time scale in another unit, and "ideas" (11) is a count of research items, not a capability measure. About 9 distinct scales remain. The conclusion (L, G and fit unaligned) stands. The fix is sound.

**MEA-21 · CONFIRMED · low** · Probe re-run: `managed` is undefined after newGame. The day-1 staff ratio is 1.00157870 = hRef ratio² (1.00078904²), and the run FLOP accrues two days of training. `defaultLabPolicy` (models/runs.ts:637-646; continual order 45) runs before `labDaily` sets `managed = true` (actors/rivals.ts:341, order 100). `clRefresh` and the public bump are called but are no-ops on day 1 (pub G unchanged in the probe). Both fixes are sound. Deleting the default policy is cleaner, since nothing else relies on it (`clRefresh` is also called from rivals.ts:395).

**MEA-22 · CONFIRMED · low** · `MILESTONE_NAMES` (capability.ts:18) vs v1 `MILESTONES` names and canon dates (data/world.ts:24-32). The EndScreen comparison table uses the v1 names against the player's work-type days (ui/v2/end/EndScreen.tsx:122-126), while its summary JSON uses `MILESTONE_NAMES` (EndScreen.tsx:48). Idx 2 is not just a name clash: "Online Learner" (canon 2027-01) and "EXP coverage ≥ 0.5" are different events. Duplicate-adjacent to MEA-01.

**MEA-23 · PARTLY · low** · Wrong detail: rivals and player follower starts use the *same* conversion, months × `referenceRate(p0, 2025.5)` (·B) (actors/rivals.ts:75-78; core/init.ts:156). Only China differs: `chinaGapYears·B` with no rate (china.ts:27), and an intel prior of ×0.8 (china.ts:52). The fix is sound. Largely a duplicate of MEA-03 and MEA-07.

**MEA-24 · CONFIRMED · low** · `legacyG`/`legacyE` read `playerStart` and `B_G_PER_Y` (core/save.ts:121-124, 131-159). The fix is sound.

**MEA-25 · PARTLY · medium (auditor: low)** · The facts hold: the stand-in `rivalTraitStep` is marked STAND-IN (actors/rivals.ts:290-294) and used only by `projectedMisAtAsi` (endings/epilogue.ts:71), and the `rivalSpeedMult` comment is stale (rivals.ts:245; it is applied at production.ts:390, not 419-421). The auditor missed that `projectedMisAtAsi` feeds the scored `epilogueSurvival` (endings/scoring.ts:32), so the stand-in trait model, `paceOf` and the ×0.7 factor all move the final score. That makes it medium, and "Player sees: epilogue projections" understates it.

**MEA-26 · CONFIRMED · medium** · The rate notions are as listed (models/research.ts:756 14-day EMA; models/tree.ts:104 START_G_RATE; rivalModel.ts:346-375; rivals.ts:195-206; world/calibration.ts:41). The player's (EMA of realised stack growth) and rivals' (instantaneous `eRate`) are averaged in intel.ts:33 and rivals.ts:218. Duplicate root of MEA-03.

---

## Duplicates and clusters
- MEA-03 / 07 / 23 / 26: one root (progress-year rates and lead conversion). They should be fixed as one item.
- MEA-05 / 06 / 08 / 24: one root (the v2 start solution and its bridges).
- MEA-02 / 04 / 20: one root (L vs G vs fit).
- MEA-01 / 22 (and the knot-aligned part of 18): the milestone definition.

## Missed issues

**MEA-V01 · low** · The player's own `milestoneDays` mixes definitions. Day-0 entries come from `initialMilestones(w, G0)`, the λ ≥ knot rule (core/init.ts:242, 82-89). Every later entry comes from `labMilestones`, the work-type rule (capability.ts:303-306). The leader start therefore records "Agent" at day 0 by λ, and the EndScreen compares that against canon 2025-05.

**MEA-V02 · medium** · The final score reads two of the flagged conversions. `epilogueSurvival` weights each lab by `exp(−leadBetween(leader, id)/180)`, which uses gap/mean-rate between rivals (MEA-07 def. 2, including the (1 − share) term). It scores `projectedMisAtAsi`, which uses `paceOf`, the ×0.7 factor and the stand-in trait step (endings/scoring.ts:20-34). Neither MEA-07 nor MEA-25 says that these reach scoring.

**MEA-V03 · low** · The `sampled` world draws its own La (world/hidden.ts:43) but reuses ai2027's fitted constants: `CAL_SHIFT.sampled = −0.463` for RefBot gates and `LEADER_CAL.sampled = −0.15` for leader speed (data/v2/calibration.ts:26, 57). Fits made for one production function are applied to a randomly different one. This is selectable in Setup ("Unknown", ui/v2/setup/Setup.tsx:149).
