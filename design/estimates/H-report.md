# H: one home for every sourced number (report)

Branch boe-h, 2026-11-28. Rule (balance session): **balance/scenarios.ts holds the sourced values** (history and
per-timeline checkpoints); **balance/targets.ts holds bands, tolerances and how they are measured**; a target with a
sourced value names its checkpoint and does not repeat the number. Commits: H1 schema, H2 overlaps, H3 deletions,
H4 additions, H6 lints (H5 = leave alone, no commit).

## 1. Schema change (balance/schema.ts, scripts/v2/calreport/types.ts)

- `Target.checkpoint?: string | string[]` names the scenario checkpoint(s). Several ids (same unit) give the hull of
  their values and bands. Used once: W4.firmAdoption, BTOS Jan and May 2026.
- `Target.value` is now optional. It is omitted on a checkpoint target: numbers and unit come from the checkpoint.
- Tolerance on top of the checkpoint: `use: 'band' | 'value'` (the source band, the default when there is one, or the
  central value only), `slack` (a number as before, or a pair `[below, above]`), `slackRel` (± a fraction of the value).
- **One direction only.** A target names its checkpoint. `Checkpoint.targetId` is deleted, and scenarios-lint rejects
  it. The dashboard computes the reverse link (baldash-assets/scenarios.js `targetOfCp`) and shows resolved bands
  (baldash.ts). This is written in schema.ts, scenarios.ts, targets.ts and design/TESTING.md §0.
- The one resolver is `bandOfEntry(t)`, and `bandOf(id)` wraps it with the same signature and return shape as before.
  `rowOf`, `estOf` (through bandOf), sanity.ts `times10` (it read `t.value` directly before) and the dashboard all read
  it. Band text now shows a numeric slack on a lo..hi band as "(± s)".

## 2. Overlaps resolved (the target now names the checkpoint; the numbers are gone from targets.ts)

| target | checkpoint | tolerance | band change |
|---|---|---|---|
| GPATH.ai2027.2026 | H5.gpath.slope | none | none |
| METR.h50.doubling | H1.metr.h50.doubling | use 'value', ±1 month (not METR's 3.4–5.2 CI) | none |
| STACK.pretrainRate.ai2027 | H6.pretrainRate | slackRel 0.3 | none |
| F9.fc1.start / F9.fc1.late2026 | H13.privateMarks.2025-07 / .2026-late | none | p50 (a midpoint) dropped |
| F2.inoculation.mis/af/sabotage, F5.antiScheming.cut, F6.persistence.scheme, F5.evalAwareness2026, F5.afComplianceGap2026, DANGER.start.actRate | H14.*, H15, H17, H18.*, H19 | none | none |
| F2.sabotageAfterHacking | H16.sabotageAfterHacking | [0.06, 0.08] | none |
| A2a.hoursOfUse2026 | H24.hoursAssisted.2026-Q2 | [0.013, 0.002] | none |
| A2a.workers2026 / hoursSaved2026 / savedPerHour | H21.* | [0.04, 0.04] / 0.005 / 0.05 | none |
| A2b.paidShare2026 | H23.paidShare2026 | [0.016, 0.034] | none |
| W4.aggregateU | H25.aggregateU | 0.15 | none |
| W4.youthExposed | H25.youthExposed | 0.05 | measured as youthX − 1 (the checkpoint's unit), calreport/world.ts |
| W4.firmAdoption | H22.firmAdoption.2026-01 + .2026-05 (hull) | [0.02, 0.02] | **15–22% → 15.7–21.8%** (from the sourced 17.7/19.8, not the rounded 17–20) |
| C1.chatUsers | H24.chatgptWAU.2025-07 | slackRel 0.1 | none |
| A3.priceDecline | H12.priceDecline | [3, 0] (floor ×6) | none |
| CAST.china.startLead | H20.chinaGap.eci | none | none (its band is these IFP/CAISI readings, CAST-2025.md) |

Named in the brief:
- **G-path anchors.** calreport/milestones.ts `G_ANCHORS` now reads H5.gpath.*. The H5 dates are now exact (the 15th,
  in the game's decimalYearOf convention), so the anchor days are the same as the old table. Side effect: s1compare
  and the dashboard read the H5 game values at the exact dates. On M3 this moves the H5 history rows by ≤ 0.01 OOM, and
  every other row is identical.
- **H13 ↔ F9.fc1.\*:** done (table).
- **METR H2–H4** stay in scenarios.ts. No target exists for them, so nothing references them yet.
- **H20's note** now names CAST.china.startLead instead of the deleted T3.china.startLead.

Found by the scan (same number and same quantity): C1/H24 WAU, A3/H12, CAST/H20. One duplicate was inside
scenarios.ts: H21.hoursOfUse = H24.hoursAssisted.2026-Q2. H21.hoursOfUse is dropped. Checkpoint notes that repeated
target bands ("The game checks 15-22%") are removed. Borderline and left alone: C5.paidShareTarget 5–6% (a model
target share) vs H23 5.6%. Coincidences, not copies: A2c.seats.jan2026 30M vs Copilot seats 30M, plus the many shared
round fractions.

## 3. Deletions (16 targets: 132 → 116, then 133 after the additions)

W.equity2026, W2.normalTechTFP, W3.cognitiveOnlyCeiling, T3.china.gapFormula, T3.china.stubLead, T3.china.afterTheft,
T-tree.durations, MO.anchor.sabotage, MO.anchor.steering, R5.buildQueue.stub, R5.buildQueue.integrated,
S5.refBot.belowL, S5.mixed.marginHolds, START.hardButWinnable, START.difficultyLabel, P3.elasticities.

References fixed:
- calreport/milestones.ts loses both R5 rows, the build-wait watcher and the integrated RefBot game. That game existed
  only for R5.buildQueue.integrated, so the report plays one game fewer per golden preset.
- The five cap.FITTED_EFFORT_TM.* params lose their fit target. `fit.targets: []` and the script is marked deleted.
  Kind stays 'fitted'.
- The alignment win-rate checkpoints cite starts.ts:33 instead of the deleted target.
- The live notes in design/bal (B5-QUESTIONS, B6-PREP, SC1-SPEC, inv/targets-notes, inv/worldfx-notes) and
  balance/questions.md mark the ids "(deleted 2026-11-28, H)". design/test-audit/* and design/estimates/MAP-* are left
  as the record.

## 4. Additions: the 17 safetyrates.ts bands

New targets, with the row's metric, check label and source: F1.hackRate.{typical, mlCheap, sweCheap},
F2.sabotageControl, F2.afReasoningAfterHacking, F2.afReasoningControl, F2.inoculation.persona, E18.afGateAtV0,
F5.afGapOversightConditional, F5.eaRisePerOOM, F5.antiScheming.eaMultiplier,
F6.persistence.{schemeStart, noHealing, af, sand, frontierEA}, F3.distilledTransfer.

- New checkpoints carry the row's source verbatim: H16.sabotageControl, H27.hackRate.{hcast, reBench, sweCheap},
  H28.afReasoningAfterHacking, H29.afGapOversightConditional, H30.{eaRisePerOOM, antiScheming.eaMultiplier},
  H31.distilledTransfer.
- Existing checkpoints reused: PERSONA uses H14.inoculation.mis with [0, 0.3]. The five F6 rows use H17; its note
  says that band also covers AF and SAND.
- Two [D] bands have no sourced value of the same quantity (AF reasoning control ≤ 12%, AF gate at V0 ≥ 95%). There
  the target holds the band.
- Every resolved band equals its row's band. safetyrates.ts is unchanged.

## 5. Left alone (brief item 5)

F9.dilutionCap, F10.sitesBlockedDelayed, F10.siteBuild, F11.startRunRate vs A8.leaderRevenue.

## 6. Lint rules

- **registry-lint `checkpointLint`:**
  - A target that names a checkpoint holds no `value`.
  - Every id resolves, and bandOfEntry runs without error.
  - Several ids share one unit.
  - `use` is only allowed with one id, and 'value' needs a checkpoint value.
  - `slackRel` needs a central value with no lo/hi and no `slack`. Slack pairs are ≥ 0.
  - `use` and `slackRel` are only allowed on checkpoint targets.
  - A target with its own value must not repeat a history checkpoint's band (lo and hi) or central value (same unit,
    not 0 or 1). One listed coincidence is exempt, with its reason (`NOT_A_COPY`).
  - Six new self-test cases.
- **scenarios-lint:** no `targetId` on a checkpoint, and every `Target.checkpoint` exists.
- **Limit.** The copy detector is a guard, not a proof. Run on the pre-H registry, it flags 14 of the 25 overlaps; it
  misses those whose units are worded differently (e.g. OOM/yr vs OOM per year). Many targets still hold their own
  sourced bands with no checkpoint, e.g. F7.\*, A2c.\*, A8.\*, F5.evalAwarenessStart. Moving them all into scenarios.ts
  is the full form of the rule. It was not in this brief; it is open for the balance session.

## 7. Verification

- tsc main and scripts: pass.
- registry-lint: pass (1582 params, 133 targets, 0 errors), and `--self-test` passes.
- scenarios-lint: pass (203 checkpoints).
- `CALREPORT_SEEDS=1 calreport --only market,rivals`: runs (24 s, 13 rows, 8 in, 5 out: C1, A7, A8.leaderRevenue,
  A8.chatRevenueShare, CAST.china.behindShare; the bands are unchanged by H).
- `estimates.ts`: runs (0 estimates: its area modules are still empty).
- Dashboard: builds, with resolved bands and 35 checkpoint links.
- `s1compare.ts M3`: it reads only the stored games.jsonl (calibscore imports only time helpers; no games). I ran it on
  a git-ignored copy of AI27-bal's balance/runs/M3 inside this worktree, and it reads scenarios.ts fine. Compared with
  the stored M3 s1compare.json, every row is identical except the 13 H5 history rows (≤ 0.01 OOM, exact anchor dates).
