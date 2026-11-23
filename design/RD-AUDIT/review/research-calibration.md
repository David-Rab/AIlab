# Review: research, rivals, measurement, calibration and UI-IA (post-compaction work on `rd`)

Reviewer scope: RD-X03, RD-M01 / M01b / M02, RD-UI0a, UI-IA.md, CP3b–CP3k (calibration and CP3 fixes in my area), the
RD-RL-scaling research, the CP3 test rewrite, the DECISIONS commits, and the merge resolutions a17a087 / f815123 /
2b90b3d / c16af11. Read-only. I did not run anything. Judged against SESSION-HEAD (verbatim designer), DECISIONS,
SYNTHESIS, CP3.md. I checked the designer's CP3 choices against the raw transcript's AskUserQuestion answers.

## 1. Overall verdict

Most of the post-compaction engine work in this area does what the plan asked, and much of it is good. RD-X03 puts
rivals on the player's functions with stated stand-ins. RD-M01 fits the measured level from benchmark scores, and
sandbagging now fools the reading. CP3c fixes three real bugs. CP3g-1 rests on a real research file and corrects a units
error (Khatri's B is fitted to pass rates). CP3g-2 implements the option the designer picked. CHINA_CAL is gone. There is
no sign of a forcing rule or a target-chasing per-lab constant being added.

The problems are fewer but real:
- A per-lab research-efficiency factor for China survives under another name (`chinaEfficiency` 0.7). The designer chose
  the China compute anchor after being told China had "equal recipe efficiency", which the code contradicts.
- LEADER_CAL was zeroed, not deleted.
- The measured level ignores every suite except the latest.
- RD-M02's per-idea "measured effect" is a whole-model delta in a different unit, which makes the designer's
  "numbers without meaning" complaint worse.
- One preview test was rewritten into a tautology.
- The lead answered UI-IA OQ-5 itself and built it.
- The slow preset's r was re-interpreted to 4.0 without asking the designer.

UI-IA follows the designer's positions in structure. It has one factual error (it labels know-how totals, which are hidden
truth, as "Fact") and a few unapproved additions.

## 2. Per task

| Task | Verdict | Reason |
|---|---|---|
| RD-X03 (265f9b9) | **KEEP** | Rivals use baseGOf / rlGains / workFitW on a stated [D] reference portfolio, and the clG / rlOnBase special path is gone. This matches DD-18 as amended. Minor: `setModelG` stuffs any G not made by a run into the build's general `dg`. |
| RD-M01 (9fc7b5c) + bada45f | **FIX** | Implements DD-08 (scores, then inverse-variance fit, with elicitation and sandbagging flowing through), and physics reads the truth again. But the fit uses only the latest suite's table (finding 4), and the general fit is anchored on the true G / domain levels. |
| RD-M01b (bbecdca, e9bacf9) | **KEEP** | Sourced MMMU / EmbodiedBench rows remove the MEDIA / PHYS truth fallback. The fix commit honestly reverts a flag set "only to satisfy a wrong check spec". Low: the PHYS mL mapping ignores PHYS's −4 level offset, so displayed scores won't match the cited anchors. |
| RD-M02 (f86ac56) | **FIX** | It removes a real truth leak (good). The replacement readout is misleading (finding 5). |
| RD-UI0a (a7f4b80) | **KEEP, confirm** | It removes the hidden-parameter read from What binds. But it answers an open designer question (OQ-5) by lead fiat, and it also switched the *research speed* readout to the prior (finding 7). Not a SYNTHESIS task. |
| UI-IA.md (92b515d) | **KEEP as draft, FIX** | Tabs follow [32]. It is organised by player questions (the [30] revision the designer accepted), uses player vocabulary, and keeps truth hidden. Fix the know-how basis error, move internal tooling out of LAB, and add the missing open questions (finding 8). |
| CP3b (5 commits) | **KEEP** (low value) | Rig and lint fixes. c7fce8e makes migrations idempotent that the planned save break (Z01) will delete: wasted effort, harmless. 9595f54 moves a monotone λ conversion out of the UI only to satisfy lint-hidden; harmless. |
| CP3 outdated tests (5c94900) | **KEEP, one restore** | The rewrites follow mechanism changes (T08 filter, P01a lineups, SR-12/13, X02 lines). A few lower bounds were loosened (e.g. RD-B11 `mine > 0.95·sectorH` became `mine > 0`). The EV2 "deeper suites measure better" property was deleted instead of restated on fitSd. |
| CP3d (6 commits in scope) | **KEEP, except 016a173: FIX** | The disclosure / override / moonshot previews now match what apply does. 016a173 turns the runEvals band check into a tautology (finding 6). |
| CP3c (01012a0, 69c3396) | **KEEP** | Three real bugs: the horizon multiplier double-counted the RL gain; the rival stream was free from day 0 against DD-05 (a); the day-0 release leaked the live recipe. |
| CP3e (6c6aafe) | **KEEP** (cleanup) | Investigation probe plus notes, no engine change. It answered a non-issue: a stale calscan reading. |
| research RD-RL-scaling (d21ded2) | **KEEP** | Tagged sources and an explicit [D] chain; it found a real units error. Caveat: the slope B = 0.33 rests on secondary analysis (Ord's essay, Epoch [A]), not primary papers, and kMid is openly "the knob for the fixed-recipe slope". |
| CP3g-1 (e6d8e80) | **KEEP** | Implements option (c) as written. It is a sourced mechanism correction, not a fit (c0 is solved to keep V0, as before). Lead decision, recorded in DECISIONS. |
| CP3g-2 (8cff98c) | **KEEP** | Matches the designer's AskUserQuestion choice "Start in equilibrium" and its description word for word: recipe gap capped at Δ* = (g_L − g_i)·τ, the residual goes into the start base's own G_pre, no diffusion. |
| CP3g (93916ca) | **FIX** | LEADER_CAL is set to 0 everywhere but is still exported, still read (actors/rivals.ts:163) and still documented as a fit knob. Delete it. |
| CP3k (11b6846) | **FIX** | The 0.35-of-stock start-compute bug fix, the start cadence and CHINA_CAL's deletion are good. But China's research still runs at `chinaEfficiency × preset.efficiency` ≈ 0.7 (finding 1). `startDistillEquilibrium` extends the designer's equilibrium decision to rule B without asking (lead). |
| CP3j (d31ecaf) | **KEEP ai2027 / fast; designer call on slow** | ai2027 and fast move toward sourced medians (sd_SC 0.5 / 0, Δ_bm inside the AIFM range), which is good. The slow preset's r 1.2 → 4.0 "units fix" is a lead re-reading of Forethought (finding 3). |
| DECISIONS commits (16c8288, 91d455e, ad64bff) | **KEEP, amend** | The three "(designer)" items are real AskUserQuestion answers. The China entry records "equal recipe efficiency", which the code does not do. |
| Merges a17a087 / f815123 / 2b90b3d / c16af11 | **KEEP** | The a17a087 rivalModel resolution correctly combines X03 builds with X02 domain offsets / P05 lift (`rivalWorkModel`) and rule B on the stream (`max(G0 + dG, own + lift)`). The others touch BUILD-NOTES only. |

## 3. Findings, by importance

### F1 (high): China keeps an unsourced per-lab research-efficiency factor, and the designer was told it didn't

**Evidence:**
- `src/engine/v2/production/production.ts:186-188`: `effLab` = `hidden.timeline.chinaEfficiency × CHINA_PRESETS[preset].efficiency`.
- `src/data/world.ts:147`: `chinaEfficiency: 0.7` on the presets.
- `src/data/world.ts:220`: `rng.range(0.6, 0.9)` on `sampled`, justified as "AI 2027: DeepCent at ~half OB's pace with
  half its compute". Half the pace on half the compute implies an efficiency of about 1, not 0.7.
- `research/10-china.md:270` cites CAISI that DeepSeek is *more* cost-efficient.
- It is applied to DeepCent's research rate at production.ts:215 and actors/china.ts:76.
- CP3k's AskUserQuestion option, which the designer picked, read: "Keep China's main lab at about 1/3 of the US leader's
  compute ... **equal recipe efficiency** with diffusion". DECISIONS.md records the same.

**Why it matters:**
- This is the same kind of per-lab efficiency constant that SYNTHESIS root cause 4 and DD-18 ("no per-lab fudge factors")
  set out to remove. CHINA_CAL was deleted, but the per-lab scale survives one layer down.
- The designer's choice was made on an inaccurate description.

**Fix:**
- Set effLab to 1 (equal efficiency, as described to the designer), re-run T3 once and report the result.
- Or bring the designer a sourced efficiency number (that was option 2 in the same question).
- Fold the preset `efficiency` field in the same way. It is a strategy flavour [D] with no source.

### F2 (high): LEADER_CAL moved to zero, not removed

**Evidence:**
- `src/data/v2/calibration.ts:5-38` still defines `LEADER_CAL: Record<WorldPresetId, number>` with a 30-line fit history,
  every value set to 0.
- `actors/rivals.ts:163` still applies `10^LEADER_CAL`.
- `types.ts:2018` and `production.ts:200` still describe it as "[fit]".

**Why it matters:**
- The SYNTHESIS exit criterion was that the fits are gone. A zeroed per-lab knob invites the next refit to use it again.

**Fix:** delete the constant, its import and its comments; pass `eff = 1`.

### F3 (medium-high): slow preset r 1.2 → 4.0 is a lead re-interpretation that erases the preset's identity

**Evidence:**
- `src/data/v2/workTypes.ts` V3_CAL comment and `slow: { …, r: 4 }`.
- BUILD-NOTES "CP3j preset refit": "the fix makes slow faster, not slower: SC 3062 → 2409 d".
- `research/13-production-function.md:477` says these r values "are not comparable … the game does not use r directly".

**Why it matters:**
- The argument (Forethought r_cog = λα/β, so 1/β = 1.2/0.3 = 4) is coherent, and it was not done to hit a target; it moves
  slow further from its target. But it makes slow's returns identical to ai2027's and fast's.
- The "slow / Forethought" world is now distinguished only by G_SC.
- That is a design-level change to a scenario, made without the designer, and the research file's own caveat was not
  addressed.

**Fix:**
- Ask the designer whether the slow preset should stay the Forethought low-returns world.
- If yes, re-derive it from Forethought's own model (their p, r_cog and ceiling) rather than through AIFM's β.
- Update research/13 §2.2 either way.

### F4 (medium): the measured level forgets earlier suites

**Evidence:**
- `src/engine/v2/models/benchmarks.ts:168-195`: each suite overwrites `v.evals.bench[b.id]`, then `refitMeasured` fits
  that table alone.
- `nEff` still accumulates "(the re-run policy reads it)", but it no longer has anything to do with precision.
- `expectedFitSd` (CP3d) bakes in "fitted from that suite's table alone".

**Why it matters:**
- Repeated suites never narrow the band. A basic suite after a deep one makes the reading *worse*.
- The re-run policy optimises a number that no longer means anything.
- The earlier mechanism (precision accumulating with suites) was a sensible property, and its tests (EV2) were deleted
  rather than restated.
- Second, smaller point: `fitGeneral` computes measured G = true G + mean(λ⁻¹(fit_d) − λ⁻¹(true L_d)). It is anchored on
  the true build, including true idea effects. That amounts to truth plus benchmark error, a mild leak of the true domain
  profile.

**Fix:**
- Pool all readings on the current benchmark edition per version by inverse variance. Drop readings from retired
  editions, as checkSaturation already does.
- Make the band shrink with suites, and restore EV2's monotone-precision check on fitSd.
- Optionally anchor domain offsets on the lab's *believed* build (estimates, not true effects).

### F5 (medium): RD-M02's "measured effect" per idea is a model-to-model delta in a different unit

**Evidence:**
- `src/engine/v2/models/researchView.ts` `measuredDelta`: the first evaluated model that embodies the idea minus the
  previous evaluated model.
- `src/ui/v2/panels/Recipe.tsx`: "believed +x OOM → measured +y ±z L".

**Why it matters:**
- Every idea first embodied by the same model shows the same delta.
- The delta includes the base change, the RL budget and everything else. The tooltip admits "Everything else that
  differs … is in it too".
- The units are mixed (OOM → L).
- This is exactly the [30] complaint: "+0.0058 ±0.0011 OOM → next model. A player can't tell whether that is good." It
  meets the task's literal done criterion ("label says measured, and it is") but not the designer's information-first
  rule.

**Fix:**
- Show the measured delta once per *model* (MODELS card, or Know-how's "measured in V5": predicted gain from the recipe
  vs the measured gain), in one unit.
- Per idea, show only the believed band, plus "in a model since V5".
- Fold this into RD-UI3 / RD-UI5 rather than more engine work.

### F6 (medium): a preview-vs-effect test was rewritten into a tautology

**Evidence:**
- `scripts/v2/lint-tradeoffs.ts` (016a173). The old check was "finished suite band within 25% of the previewed ±". The
  new check is `row.bandAfter == expectedFitSd(...)` (the preview equals the function that computes the preview) and
  `measuredSd(v) == v.evals.fitSd` (the band equals itself).

**Why it matters:** the designer's rules are "previews match effects" and "never fake things to satisfy a lint / test".
This rewrite no longer tests the mechanism.

**Fix:** compare the preview with the realised fitSd over several seeds (mean within a tolerance), or keep the 25% band
and let it fail as information.

### F7 (medium): RD-UI0a answered an open designer question and also changed an observable into a prior

**Evidence:**
- UI-IA §5 lists OQ-5 as a question *for the designer*. The lead decided it ("lead, UI-IA OQ-5" in DECISIONS) and built
  a7f4b80 the same day. It is not a SYNTHESIS task.
- The change also routed `labSpeedRel` and `readout.ts` through `believedWorld`, so "Research speed" is now computed
  from the published prior, not from what the lab actually did.
- Meanwhile `capEta` still uses the true La (BUILD-NOTES "Left").

**Why it matters:**
- The lab can observe its own realised experiment throughput. Only the counterfactual readouts (What binds, the +10%
  elasticities, response curves) need a belief.
- On `sampled` worlds the speed readout and the ETAs now disagree.
- For the fixed presets, the belief equals the truth anyway.

**Fix:**
- Keep the believed elasticities and labels.
- Restore research speed from observed progress, and make capEta use observed progress (already a HANDOFF item).
- Have the designer confirm OQ-5.

### F8 (medium): UI-IA errors and unapproved additions

1. **Know-how totals labelled "Fact".**
   - Evidence: §2 RESEARCH "Know-how per area: public, adopted, …: Fact (adopted)", reading `stackViews`.
   - Problem: the stacks hold the *true* effects of adopted ideas ([5]: "the true effect enters the stack, not your
     estimate"). This contradicts UI-IA's own "Truth is never shown".
   - The same leak exists in `researchView.ts:294 stackViews` today.
   - Fix: show adopted know-how as the sum of believed estimates (with a band) until measured.
2. **Internal tooling placed in LAB.**
   - Evidence: "Internal tooling (Coding harness, …) … build cost" is placed in LAB.
   - Problem: [31]/[32] say LAB = allocation only, and DD-03 puts AI-staff boosts "on the research side" as owned
     things.
   - Fix: move it to RESEARCH, or to a build list, with a link from the AI staff tile.
3. **L0 shell redesigned without approval.**
   - Evidence: research speed and compute online are removed from L0, and Loss-of-control risk becomes the shell hero
     for every tab.
   - Problem: OD-1 made it the SAFETY headline, not the global hero.
   - Fix: make it a question for the designer.
4. **Names drift from the [30] proposal the designer reacted to.**
   - "Run plan" was "Next run" in [32].
   - The know-how areas are named "RL ceiling" and "Training throughput", where [30] had "RL environments" and "Training
     efficiency".
   - "Sight L 9.1" on L0 is jargon.
5. **Basis "Measured (what the engine did that day)" for research speed** conflicts with what RD-UI0a built (believed).
6. **Missing open questions** (the 8 asked are mostly naming / placement and are fine):
   - (a) May adopted know-how totals be shown before a model measures them (item 1)?
   - (b) Per-idea vs per-model measured effect (F5).
   - (c) How rivals' capability is shown: intel estimate vs their public evals.
   - (d) Whether the global L0 hero is the risk gauge (item 3).
   - (e) OQ-5 should be marked as decided by the lead, pending the designer.

### F9 (low-medium): the day-0 state is now built from three stacked residual absorbers

**Evidence:**
- startLab solves a recipe lag.
- CP3g-2 caps it and puts the rest into the base's G_pre.
- CP3k `startDistillEquilibrium` subtracts rule B's lift from G_pre again and adds it to the builds' `dg`.
- setModelG pushes any other mismatch into `dg`.

**Why it matters:**
- Each step is defensible, and the designer chose the first.
- But day-0 rival capability is now "whatever is left after three solves", and the extension to rule B was not asked.
- It is hard to explain to the player, and hard to audit.

**Fix:** document one start-state function with its inputs (observed day-0 G per lab, compute, the two diffusion rules)
in one place. Ask the designer whether rule B's equilibrium belongs under the same decision.

### F10 (low): effort spent on things that will be deleted or that only satisfy lints

- c7fce8e (idempotent migrations 42–95) before the Z01 save break that deletes them.
- 9595f54 (moving a harmless λ conversion out of the UI for lint-hidden).
- CP3e (an investigation that found nothing).
- About 2,100 new BUILD-NOTES lines.
- About 40 committed `scripts/v2/_*` probe folders (also pre-compaction) to clean up.

This fits the designer's "tunnel visioned on unimportant stuff", but it is cheap to keep. Don't extend it.

### F11 (low): RL-scaling sources

- The headline slope (0.33 G per OOM of RL) is an [A]/[D] chain through Ord's essay and Epoch; there is no primary paper
  for it.
- A0 = 2.0 is "top of Epoch's range".
- kMid = 0.5 is physically argued (an episode count under Chinchilla), but the file says it is the slope knob.
- Acceptable as stated stand-ins. Record the ranges (B 0.25–0.5, kMid 0.35–0.7) next to the constants, and do not refit
  kMid to hit the G/yr anchor.

## 4. Lead decisions that need the designer (yes / no)

1. **CP3g-1 RL gain form:** A 2, B 0.33, midpoint ∝ FLOP_pre^0.5, about 1.18 G per OOM of training FLOP. (Recorded as
   lead.)
2. **OQ-5 / RD-UI0a:** "What binds" reads the published prior. Also: research speed computed from the prior rather than
   observed (F7).
3. **Slow preset r 1.2 → 4.0** (Forethought units re-reading; slow then has the same r as ai2027) (F3).
4. **China research efficiency:** remove `chinaEfficiency` / preset efficiency (equal efficiency, as described in the
   CP3k question), or source it (F1).
5. **Start distillation equilibrium (CP3k):** extends "start in equilibrium" to diffusion rule B.
6. **fast preset at sd_SC 0 and Δ_bm 0.6** (the floor of the range); authors2026 kept at sd_SC 2.15 (the 74th
   percentile) pending a refit.
7. **RD-M01 design:** fit from the latest suite only, vs pooled across suites (F4). Domain offsets anchored on the true
   build.
8. **RD-M02 readout:** per-idea model delta, vs a per-model measured gain (F5).
9. **RD-M01b:** MEDIA measured by an understanding benchmark (MMMU), not generation; PHYS slope a stand-in.
10. **UI-IA:**
    - Loss-of-control risk as the global L0 hero.
    - Research speed and compute online removed from L0.
    - Internal tooling placed in LAB.
    - Its 8 OQ recommendations (none answered).
11. **(Safety area, listed for completeness, reviewed elsewhere):**
    - EV9: evals before validation jobs.
    - CP3i's smoothstep width k = 2 OOM and q ~ U[0, 1] hidden draw, under the designer-approved "uncertain at scale".

## 5. Not checked in the time

- CP3f / CP3h / CP3i safety internals beyond the DECISIONS text (other reviewer).
- Products P5 (excluded).
- Whether RefBot and gov consumers all read measured levels: only gov.ts was spot-checked.
- Rival intel readouts.
- Each rewritten check in products / worldfx / safety scripts line by line: I sampled data, rivals, serving, oversight,
  evals, ws4 and lint-tradeoffs.
- The numerical claims in the CP3 BUILD-NOTES (T1 medians, T3 197 d): not reproduced, by instruction.
- The source papers behind RD-RL-scaling and RD-MEDIA-PHYS-bench: read as cited, not fetched.
- The PHYS / MEDIA benchmark-curve consistency with the game's domain offsets: noted, not computed.
