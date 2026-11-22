# Verification of training.md (master ea624ae, 2026-11-22)

Method: read every cited site and searched for other readers and writers. Probe: `probe_trn.mts` in this folder, run with `npx tsx` from the repo root. It printed λ knots per world, planRun for a synthetic base with and without a teacher, and planRun before and after adding 200T of licensed data.

Tally: 30 CONFIRMED, 2 PARTLY (TRN-03, TRN-16), 0 WRONG, 0 UNSURE.

---

TRN-01 · CONFIRMED · high · Reproduced. The probe with P10 known and no teacher returns "Synthetic data needs a teacher version", and with a teacher it returns no reason. The check at runs.ts:317 uses plain `=`, so it also overwrites the "Needs …" lock reason (the probe without P10 returns the teacher message). Blueprint `toLP` (Blueprint.tsx:108-110) sends no teacher for a base run; only the raw `launchBase` action passes one (actions.ts:76-77). Once a base is built, the teacher affects nothing: `applyBaseToLineage` overwrites `traitsTrue` from `synTeachers(s, q.draw)` (traits.ts:977-981). The fix is sound.

TRN-02 · CONFIRMED · medium (auditor: high) · The mechanics match: `gPre = base.gPre − base.ePre + tr.pre` (runs.ts:664), today's `suiteFidMap` (runs.ts:665), and previews hard-coded at actions.ts:201-211. Two details are left out. The stream also costs engineer upkeep (build.ts:114, `UPKEEP.stream`) and research-engineer ops (research.ts:354), so it is not only the 15% pool share. And it is the deliberate "AI 2027 online learner": rivals use the same free recipe re-application through `clG = max(base.gPre, baseGPre(flop, tpp, rec.pre)) + RL` (rivalModel.ts:160). Fixing only the player's version would break player/rival parity (see TRN-V01). The previews are clearly wrong.

TRN-03 · PARTLY · medium (auditor: high) · All the conversion sites exist as cited (workTypes.ts:66 LEVEL_PER_OOM; evals.ts:76; design.ts:39 `/2`; benchmarks.ts:1 m_L rule; oversight.ts:28 `oomOfLevel`; calibration.ts:20 `levelOfV2`; B_G_PER_Y at runs.ts:95/582/644). The numbers are off. The probe gives G(V0) ≈ 27.6-27.8, not 28.0, and V0→SC slopes of 2.01 (ai2027), 0.86 (authors2026) and 0.64 (slow) L/OOM, not 2.3 / 0.92 / 0.66. The point stands. Note that `oomOfLevel` is an exact inverse of λ relative to V0, so it is a duplicate, not a disagreeing rate.

TRN-04 · CONFIRMED · medium (auditor: high) · Verified as described:
- The empty `expert` asset (data.ts:47) is removed at init.ts:159.
- Each suite owns an `expert:<family>` asset (suites.ts:48-55).
- Expert data bought by domain is stored as `expert:dom:<domain>` (data.ts:313-317).
- `familyDomain` maps both computerUse and longHorizon to AGENCY; no family maps to SOCIAL, MEDIA or PHYS.
- models/evals.ts never reads expert data, though the preview says "(evaluations, D7)" (dataActions.ts:159).
- P12 books $1B on adoption (research.ts:571 → suites.ts `addSuiteExpertData`).
It is a design muddle, not a breakage, so medium.

TRN-05 · CONFIRMED · high · `measuredL = Lg + errTrue/√nEff` (benchmarks.ts:109), and `measuredDomain` adds the true domain offset (commitments.ts:26-29). Depth elicitation (data/v2/evals.ts:47-49) and evalIndep's +0.3 (`ELICITATION`, data/v2/benchmarks.ts:48, not evals.ts) only reach the benchmark scores. One nuance on "decoration": the score rows do have consumers. The horizon score feeds products (products.ts:136). The danger flags feed china.ts:159, intel.ts:129 and endings.ts:66. Any non-self score counts toward `externallyEvaluated` (deployments.ts:32).

TRN-06 · CONFIRMED · medium (auditor: high) · The four plan branches (runs.ts:312-391) and the 4+IDA completion branches (runs.ts:518-588) are as described. This is a design critique with effort L and no bug, so medium.

TRN-07 · CONFIRMED · medium · `continueGPre` (effective.ts:97) has no data term. On completion the parent is spread with `tokens + flop/6N`, and its `epochs` and `sD` are copied without a draw (runs.ts:543-548). `scale` is summed (runs.ts:546). The fix is sound.

TRN-08 · CONFIRMED · medium · The IDA run is found with `run.name.startsWith('IDA')` (runs.ts:572); `TrainingRun` has no ida field. The alignment −0.1 is hard-coded (actions.ts:139) and the glossary still has v2 text (glossary.ts:335). One nuance: the preview's 0.3 pool share does match the engine's IDA default (runs.ts:296, and `idaCycle` passes no poolShare), so only the alignment line and the glossary disagree with the engine.

TRN-09 · CONFIRMED · medium · `cMid = RL_C0·flopPre/10^eRL` (effective.ts:194) and `rlFlop = RL_BUDGET·base.flop` (runs.ts:359), so FLOP_pre cancels. Base size enters only through `rlCeiling`'s a1 = 0.1 per OOM. The same holds for IDA (`IDA_RL_SHARE·base.flop`).

TRN-10 · CONFIRMED · medium · `RL_FAMILIES[f].v` is read only by TRANSFER (effective.ts:112: largest → same, others → adjacent) and `familyDomain`. The tree texts quote the numbers as gains (tree.ts:169-175). `h80Mult` ×2 is flat (design.ts:55, runs.ts:262). It multiplies h50 (capability.ts:155), and so h80 too.

TRN-11 · CONFIRMED · medium · Constants are as listed (runDesign.ts:38-44, 163-167, 172-192). The tree text "Δ −0.02 y" is at tree.ts:204-205.

TRN-12 · CONFIRMED · medium · A repo-wide grep finds no readers for:
- `safetyFteWeeks` (only set at design.ts:77);
- `honest`;
- `misuseMult` on the build;
- `pe.flags` / `be.flags`;
- `EFFORT`, `GOODPUT_FT`, `JOURNALS_FRAC`.
`EFFORT_TOKENS` (0.3/1/4) is the live table, while P05 says "Tokens ×10" (tree.ts:189) and T-SPEC says "8 safety FTE-weeks per run" (tree.ts:200).

TRN-13 · CONFIRMED · low (auditor: medium) · The cash tip is stale (Blueprint.tsx:569). `nextModelGate`'s cash line is `0.5 × compute cost` (readout.ts:80). The only other reference is the selectors re-export (selectors.ts:15); nothing in src/ui/v2 uses it. It is player-facing only through one stale tooltip. Duplicates TRN-24 (same dead readout) and TRN-12/20 (JOURNALS_FRAC / cashMult).

TRN-14 · CONFIRMED · medium · For a family unlocked later with no stored suite, `suiteOf` returns `startSuite` (suites.ts:56-60), and `suiteExpertT` falls back to `EXPERT_START_T`, so fidelity is 1. That suite is included in `suiteFamilies` (broad weights) and in upkeep (build.ts:126). `SUITE_BUILD.tokensT` is a fixed 0.002T for 2 TW (data/v2/suites.ts:57). No code makes fidelity decay. Unmet upkeep only delays other builds (build.ts header).

TRN-15 · CONFIRMED · medium · Reproduced. `completeRun` calls `baseG(s, d, rec.pre)` → `playerDraw` on today's portfolio (runs.ts:523, 230). In the probe, +200T of licensed data moved the plan from epochs 0.46 to 0.37 and gPre from 27.329 to 27.330. The third draw (`baseQuantitiesOf`, traits.ts:271) happens on the same day as completion, so it matches the second. Minor: Models › Bases shows no epochs at all (Models.tsx:51 shows size only); "Latest base epochs" on Data.tsx:215 is a hypothetical recompute.

TRN-16 · PARTLY · medium · The runEvals gains (monitorability, credibility, trust, leadDays at actions.ts:255-256) are never applied by `queueEval`/`finishEval` (evals.ts:165-171). The ±0.25 band is at runs.ts:395-396 and `runPreview` is at actions.ts:96-110. The finding misses that external evals have one real effect, which the preview omits: they satisfy the `externallyEvaluated` release gate (deployments.ts:31-32). "The true outcome is deterministic" is only nearly true: base runs re-draw data at completion (TRN-15), and post runs subtract `consumeRunPenalty` (runs.ts:582).

TRN-17 · CONFIRMED · medium · The player's milestones come from `labMilestones`, rivals' from λ crossing `LEVEL_KNOTS[i]`, and notices and acts from measuredL vs `LEVEL_KNOTS` (capability.ts:300-327). λ uses only knots 0, 3, 4, 5, 6 (capability.ts:48). `seenMilestone2` is also read by china.ts:159.

TRN-18 · CONFIRMED · low (auditor: medium) · `fptOfBuild` uses the `v.serveCost / b.serve` ratio (workfit.ts:137-142). production.ts:182 sets a constant `serveCost: 0.5`, and :339 divides it by 0.5 again, so it is a no-op. The player sees correct FLOP per token, so this is plumbing only.

TRN-19 · CONFIRMED · medium · `teacherRows` calls `syntheticQuality(g, g0)` without the cap (dataView.ts:129). The only other call site, the generation path, passes `synQualityCap(s)` (data.ts:405), so the Data panel (Data.tsx:293) understates quality after P10. SYN_MIX is fixed (dataAssets.ts:73). The fix is sound.

TRN-20 · CONFIRMED · medium · As cited (runDesign.ts:138-161; guard reason in the doc comment; design.ts:42 `bioUplift: false`).

TRN-21 · CONFIRMED · medium · As cited. Also odd: the STAR "Quality filter" node unlocks the *Balanced data mix* (tree.ts:145), not the quality curation toggle.

TRN-22 · CONFIRMED · medium · Rivals use `clG`/`baseGPre`/`rlOnBase` and `domainsOf(w, G)` with no offsets (rivalModel.ts:146-174, 520-527). They have no portfolio or suites.

TRN-23 · CONFIRMED · low · `graders:hardened` (tree.ts:164) has no slot in PostDesign. `graders` survives as a legacy field (types.ts:498-500), and Research.tsx:33 still labels a "Graders" slot.

TRN-24 · CONFIRMED · low · 20·√(C/120) (data.ts:501) vs 400 TPP gives the ≈√20 factor, as claimed. Its only readers are `nextModelGate` and `dataStockRatio`, both dead. Duplicates TRN-13.

TRN-25 · CONFIRMED · low · data/v2/suites.ts:21-37 and suites.ts:96-102, 198-203.

TRN-26 · CONFIRMED · low · Not re-derived line by line. `alignedCalShift` / `playerStart` / B_G_PER_Y are used as cited (capability.ts:41-46).

TRN-27 · CONFIRMED · low · Only `REF_OFF[d][0]` is read (capability.ts:136). RSCH_TASTE_PENALTY applies until P19. workfit.ts:56 mirrors it in OOM via LEVEL_PER_OOM.

TRN-28 · CONFIRMED · low · `base.scale` has no reader. `run.scale` feeds scrutiny only for base runs (runs.ts:463), so a continue run's scale is computed and summed but never used.

TRN-29 · CONFIRMED · low · `USAGE_ELIGIBLE = { consumer: 1 }` (dataAssets.ts:115). Coverage is written only in the v2 migration (data.ts:63).

TRN-30 · CONFIRMED · low · UI DEFAULTS.params is 1e12 and the UI pool defaults are post 0.4, distill 0.2, continue 0.4 (Blueprint.tsx:40-43), against the engine's 0.2 / 0.1 / 0.3 (runs.ts:67). `toLP` always sends poolShare, so the UI values win. The distill tip says "half", but `toLP` sends no studentParams unless "hold" is chosen, so the engine's 1/8 applies. The tip is wrong about what happens.

TRN-31 · CONFIRMED · low · runs.ts:316 gates tpp > TPP_FREE_MAX behind `optionLocked('tpp','over')`; `fOver` already costs G.

TRN-32 · CONFIRMED · low · `stackAt(st, F)` scales by 10^(s·log F) (stacks.ts:37-43). The RL stacks use the default `FLOP_RL_REF`.

Duplicates and overlaps: TRN-13 = TRN-24 (dead `nextModelGate`); TRN-02 / 08 overlap TRN-16 (previews); TRN-04 overlaps TRN-21 (P12); TRN-12 / 13 / 20 overlap on JOURNALS_FRAC, cashMult and the bioUplift flag; TRN-23 overlaps TRN-25 (graders legacy).

---

## Missed

TRN-V01 · medium · Rivals' continual learning gets the same free pretraining re-application as the player's stream: `clG = max(base.gPre, baseGPre(base.flop, base.tpp, rec.pre)) + rlOnBase(…)` (rivalModel.ts:160), driven daily by `clRefresh` (runs.ts:642). The TRN-02 fix must change both, or the frontier pace calibration and player/rival parity drift.

TRN-V02 · low · The stream always replaces `v.build` but refreshes `v.G` and `v.domains` only when general G rises (runs.ts:686-690, 711-715). The domain RL gains from today's suites (`dgRLd`) reach readers that use the build (workfit `gOfDomain`), but not `v.domains`, the display, or `measuredDomain`. The two can disagree.

TRN-V03 · low · The runEvals preview omits the one real effect of an external eval, satisfying the `externallyEvaluated` deployment gate (deployments.ts:31-32), and lists three effects that do not happen (extends TRN-16).

TRN-V04 · low · The run-card preview gain (actions.ts:100-101) subtracts the current *measured* level from a prediction centred on the *true* outcome. The ±0.25 band around the true λ also lets a player who compares cards infer a model's true level without evaluating it.
