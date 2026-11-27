# CAL2 calibration run (after the round-2 refits)

Worktree AI27-cp2, detached at rd 0e72fed (CAL2: danger thresholds use the per-world v2-level conversion), 2026-11-23.
No source edits in the run. This is the closing run after the round-2 refits: BUILD-NOTES CAL-T, CAL-X, CAL-S2 (round 1)
and CAL2-T, CAL2-X, CAL2-S (round 2, DECISIONS "Calibration decisions after CAL1 refits"), plus CAL2-D (the danger act
thresholds read the per-world shift instead of the ai2027-only `U05_SHIFT`). Same method as CAL1.md: one run of each,
classified from the logs and BUILD-NOTES only (no bisects, no probes). Logs: AI27-cp2/.simcache/logs/cal2/.

## What ran

1. `fixtures.ts --write`: regenerated day0, day400, day900, start-challenger-day400, start-spinout-day400 (≈ 15 s).
   7 PASS / 1 FAIL. Committed on rd separately (2f32e35); every later script read them.
2. `npm run test:cal` (golden-timelines + calib T1 / T1L / T4 over CAL_SEEDS; 10 workers): 1/2 scripts ok, 41 passed,
   11 failed; wall 17.8 min (cpu 111 min).
3. `run.ts --tier full --no-ui --workers 10 --only safety,safetyrates,sabotage,danger,finance,worldfx,ws4,rivals,evals`
   (as CAL1; S5's deep mechanism checks not run): 3/9 ok (danger, safetyrates, sabotage), 378 passed, 14 failed; wall
   20.4 min (cpu 143 min).

Not run (as CAL1): UI, deep tier, products / serving, hygiene, lints, data / suites / signals / research /
safetyresearch / oversight / control / safetyideas.

## Totals

- **26 failing checks** (CAL1: 66): calib 11, fixtures 1, ws4 4, finance 3, worldfx 2, safety 2, rivals 2, evals 1.
- Classes: **(a) same as CAL1 11, (b) calibration moved 13, (c) outdated test 2, (d) suspected real bug 0.**
  11 + 13 + 2 + 0 = 26.
- Gone since CAL1: the rival `clDay` bug (23 checks; fixed in 399f212), sabotage ×4 (CAL-S2: anchors, backdoor
  expectation, control arm), FIN3c ×2 (now pass; the rig's premise is state-dependent, CAL1 (c)), GOV Accept, AI-friend,
  HireRate, A2a ×2, W4 aggregate / firm adoption, W2 (CAL-X / CAL2-X), T1 authors2026 SC, T1 fast ×3, T1 slow SC,
  T1L fast SC, start M (CAL-T / CAL2-T; target restated per preset).
- Wall time of the runs: 15 s + 17.8 min + 20.4 min ≈ 38 min (the safety prefill shards took 17–20 min each).

## Calibration targets

### Timelines and presets (T1: RefBot median over 20 CAL_SEEDS; T1L: leader lab, 5 seeds; days from 2025-07-01)

| Target | CAL1 | CAL2 | target | |
|---|---|---|---|---|
| T1 ai2027 SC / SAR / SIAR / ASI | 616 / 788 / 900 / 949 | 623 / 784.5 / 886 / 942 | 638 ±29 / 791 / 883 / 915 ±44 | **pass ×4** |
| T1 authors2026 SC / SAR / SIAR / ASI | 1585 / 1893 / 1981.5 / 2020 | 1518 / 1521.5 / 1711.5 / 1753.5 | 1495 / 1573 / 2151 / 2975 | SC pass; SAR −52 d, SIAR −440 d, ASI −1222 d fail |
| T1 fast SC / SAR / SIAR / ASI | 884.5 / 944 / 980.5 / 1007 | 860 / 909 / 947.5 / 993 | 880 / 880 / 925 / 956 | **pass ×4** |
| T1 slow SC | 2466 | 3124.5 (2034.05) | 2034–2035 (3289 ±212) | **pass** (target restated, CAL-T) |
| T1L ai2027 SC / SAR / SIAR / ASI | 576 / 745 / 794 / 815 | 576 / 745 / 794 / 815 | 638 / 791 / 883 / 915 | fail ×4: deferred (rivals session) |
| T1L authors2026 SC / SAR | 1654 / 1759 | 1462 / 1475 | 1495 / 1573 | fail ×2 (now early): deferred (rivals session); SIAR / ASI 1538 / 1573 WARN |
| T1L fast SC / SAR / SIAR / ASI | 925 / 954 / 968 / 982 | 891 / 931 / 939 / 952 | 880 / 880 / 925 / 956 | SAR fail (+51 d), others pass: deferred (rivals session) |
| T1L slow SC | 2235 | 2614 | 3289 ±212 | fail: deferred (rivals session) |
| Start research speed M (per preset, ± 0.1) | 1.202 (ai2027, target 1) | ai2027 1.202, authors2026 1.002, fast 1.058, slow 1.000 | 1.25 / 1.10 / 1.15 / 1.01 | **pass ×4** (authors2026 at the edge, 0.098) |
| Frontier G path to 2026 | 0.17 G | 0.17 G (1.34 G/yr) | ±0.2 G | pass |
| METR h50 doubling | 4.2 mo | 4.2 mo | 4.2 ±1 | pass |
| T4 rival gaps at start | 3.3–5.0 mo | 3.3 / 4.6 / 4.3 / 5.0 mo | 3–9 | pass |
| Fixture canary, seed 2027 SC / SAR / SIAR | 622 / 858 / — | 622 / 858 / — | 638 / 791 / 883 | SIAR not reached by day 900 (fail); SC, SAR INFO |

WARN rows (A1 / A2 milestones, not targets): ai2027 A1 151 / A2 444 (want 209 / 535); authors2026 1195 / 1242 (821 /
1345); fast A2 523 (809); slow 2689 / 2860 (1958 / 4272).

### Finance / market / world (finance, worldfx; products / serving not run)

| Target | CAL1 | CAL2 | target | |
|---|---|---|---|---|
| F6 supplier margin (mean) | 76.5% (min 74.2%) | 76.6% (min 74.2%) | 70–75% | pass (check passes) |
| F7 RefBot 2026 revenue | $53.7B | $47.5B (worldfx seed 2027 $46.2B) | $45–56B ±20% | pass |
| F7 RefBot end-2026 valuation | $1.26T | **$0.94T** | $1–3T | **fail (new)** |
| F9 FC1 private labs' marks, start / late 2026 | pass | $0.49T / **$2.08T** | ≈ $0.5–0.65T / $2.5–3T | **fail (new)** |
| F9 FC2 slower growth, lower multiple (2026) | 20.8× vs 21.0× | **18.6× (×2.5+) vs 21.8× (slower)** | slower < faster | **fail (new)**; 2027 32.5× vs 27.3× ordered |
| F9 FC2 leader multiple at high growth | pass | 20.5× | 20–37× | pass (at the low edge) |
| F11 2027 revenue | $101.5B (worldfx $102.8B) | $102.1B (worldfx $105.4B; 20 seeds median $104.5B) | ~$140B ±30% (≥ $98B) | pass |
| Equity 2026 | +34.6% | +29.1% | +30 ±10 | pass |
| HireRate_SOFT ≤ 10% | 2027-02-10 | 2027-07-10 (16/20 in window) | Jul 2027 ±3 mo | **pass** (CAL2-X hireSlope 1.2) |
| 25% of remote work by AI | 2027-07-28 | **never (0/20)** | Oct 2027 ±3 mo | **fail (new)** |
| U +1 pp over 12 months | 2027-10-31 | **never (0/20)** | Oct 2027 ±3 mo | **fail (new)** |
| GOV T1 Accept ≥ 0.85 | never (7/20) | 2028-01-26 (13/20) | Dec 2027 ±3 mo | **pass** (CAL-X, CAL2-X) |
| AI-friend share Jul 2027 | 3.0% | 8.1% | 10 ±3 | **pass** |
| A2a hours of AI use / saved, mid-2026 | 6.9% / 2.7% | 5.9% / 2.2% | 5–6.5% / ≈ 2.2% | **pass ×2** |
| A2b paid share through 2026 | 5.3 → 7.1% | 5.2 → 7.1% | 4–9% | pass |
| W4 aggregate U, Nov 2026 | +0.20 pp | +0.07 pp | ≈ 0 | **pass** |
| W4 22–25-year-olds vs counterfactual | −21.3% | −18.4% | −19 ±5 | pass |
| W4 firm adoption (Jul 2026 mark) | 24.3% | 20.9% | 17–20 ±2 | **pass** |
| W2 Normal Technology TFP / decade | +17.3% | +1.0% | +0.5–1% | **pass** |

### Safety (safety, safetyrates, sabotage, danger, evals)

| Target | CAL1 | CAL2-S run | CAL2 | target | |
|---|---|---|---|---|---|
| S4 RefBot / medium P_mis at ASI | 0.344 | 0.382 | **0.377** | 0.40–0.80 (was 0.55–0.85) | fail (−0.023) |
| S4 safe recipe | 0.055 | 0.066 | 0.051 | ≤ 0.25 | pass |
| S5 RefBot U below L by SAR | 23% (median +0.34) | 23% (+0.45) | **15%** (median +0.42; true 8%; SAFMECH range bottom below L 33%) | ≥ 50% | fail |
| S5 Mixed sight limit at SAR vs RefBot (restated) | — | 11.54 vs 10.53 | 11.59 vs 10.99 (medians 12.18 vs 11.97) | Mixed above | **pass** |
| S5 Mixed old row (INFO): median min margin / holds | −5.00 / 35% | −2.02 / 45% | −0.44 / 50% | — | INFO |
| F2 sabotage after learned hacking | 14.3% | 11.2% | 11.2% | 6–20% | pass |
| F2 inoculation cuts Mis / AF / sabotage | 85.9 / 85.5 / 92.9% | pass | 85.9 / 85.5 / 92.9% | 75–90 / 75–90 / 75–95 | pass |
| F5 anti-scheming cut | 93.2% | pass | 93.2% | 90–98% | pass |
| F5 EA 2026-12-31 | — | 46.6% | 46.7% | 20–50% | pass |
| MO anchor (sabotage.ts) | 15.3% | 12.0% | 12.0% | 12% | **pass** |
| STEER / SUCCSTEER κ anchor | 15.3% | 12.0% | 12.0% / 12.0% | 12% | **pass** |
| danger start: SYC and RH common (internal, per lab-year) | SYC 0.15, RH 0.10 | — | SYC 0.149, RH 0.105; 0.70 acts / lab-year | common; 0.4–3 | pass |
| EV9 first release suites | 34 / 33 d | not changed | 34 / 33 d | ≈ 14 d | fail (RF-S6 revert, known) |
| F6 persistence through a safety run | WARN 64.4% | WARN | WARN 64.4% (F5 AF gap 21.1% WARN) | ≥ 80% | WARN (known) |

### China (ws4, rivals)

| Target | CAL1 | CAL2 | target | |
|---|---|---|---|---|
| T3 China lead at start | 220 d | 220 d (all 8 seeds) | 150–200 d | fail: deferred (rivals session) |
| T3 mean lead until theft | 196 d | 196 d | 150–200 d | pass |
| T3 gap after a theft | 85–97 d | 86–99 d | ≈ 60 d | fail: deferred (rivals session) |
| R9 China lead in the first weeks | pass | day 1 220 d (gap 219 d) | start gap + days since | pass |
| R10 gap formula vs simulated start lead | −1.3 to −0.4 mo | −1.34 to −0.37 mo | ±2 mo | pass |
| R5 leader day-0 rates / R8 follower staleness | fail ×2 | fail ×2 (unchanged values) | — | deferred (rivals session) |

## (a) Same as CAL1 (11)

- calib T1L ai2027 SC / SAR / SIAR / ASI: identical values (576 / 745 / 794 / 815). Rivals deferred. 4.
- fixtures canary SIAR undefined: seed 2027 still SC 622 / SAR 858 (ai2027 unchanged since CAL1). 1.
- ws4 T3 start lead 220 d and gap after theft 86–99 d (HANDOFF / CAL1 known). Rivals deferred. 2.
- rivals R5 (pre 0.480, mid 0.030, ceil 0.046 OOM/yr) and R8 (r2 −0.336 vs −0.095, r3 −0.401 vs −0.175): identical
  values. Rivals deferred. 2.
- evals EV9 34 / 33 d (RF-S6 revert; CAL-S2 kept it as a real timing miss for the designer). 1.
- safety S5 RefBot below L by SAR: still failing, but **moved further from target, 23% → 15%** (median U − L +0.42; true
  U below true L 8%). CAL2-S's own run read 23% on rd 0397bd2 + CAL2-S, so the move came with the merge of the other
  round-2 lanes: S5 plays ai2027 (alignment medium), where CAL2-T changed nothing and CAL2-D moved only RSCH by 0.002
  levels, so the likely source is CAL2-X (adoption, revenue and products feed the lab's money and its safety spend).
  Not separated (no bisect). The S5 Mixed old row moved the same way (−2.02 / 45% → −0.44 / 50%). 1.

## (b) Calibration moved (13)

- **T1 authors2026 SAR / SIAR / ASI (3): CAL2-T** (AIFM run: G_SC 33.1 → 34.09, sd_SC 0.5 → 2.94). Identical to CAL2-T's
  own test:cal (SAR −0.148 y, tol 0.12; SIAR −1.29 y; ASI −3.42 y). SC now passes; SAR moved from late (+0.60 y) to
  just early; SIAR / ASI stay early. CAL2-T's diagnosis: after SAR, RefBot is held by its framework and its G follows a
  rival's aggregate takeoff through knowledge diffusion (rival mechanics deferred). Note: CAL2-T measured AIFM's own
  SAR → ASI on Eli's medians at 1.3–1.8 y, not the golden's 3.8 y, so the ASI target itself is the sampled-median
  golden, not the median-parameter run.
- **T1L authors2026 SC / SAR (2): CAL2-T** (same refit; the leader lab is now early, SC → SAR 13 d). Rivals deferred.
- **T1L fast SAR (1): CAL-T** (fast G_SC 31.35 → 31.25; SC / SIAR / ASI now pass, SAR +51 d vs tol 44). Rivals deferred.
- **T1L slow SC (1): CAL-T** (slow G_SC 35.575 → 38.3 and the target restated to 2034–2035; 2235 → 2614, −1.85 y).
  Rivals deferred.
- **finance F7 end-2026 valuation $0.94T, F9 FC1 late-2026 marks $2.08T, F9 FC2 2026 ordering (3): CAL2-X** (decision 5
  Bass fit `bassFit` 0.33 and `firmK` 19; decision 13 memory's chat appeal deleted; 15 DISTILL_HARVEST_SHARE 0.0015).
  RefBot's 2026 revenue $53.7B → $47.5B (worldfx $52.3B → $46.2B, CAL2-X's own before / after), i.e. lower and slower-
  growing 2026 revenue, which the story-based valuation reads; the 2026 FC2 pair flipped from 20.8× vs 21.0× (a 0.2×
  margin at CAL1) to 18.6× vs 21.8×. CAL2-X ran finance --smoke only (FIN3c ×2), not the full-tier F7 / F9 rows.
- **worldfx "25% of remote-work jobs done by AI" and "U +1 pp over 12 months" never (2): CAL2-X** (decision 5: Bass p /
  q × 0.33 on every sector; decision 6: hireSlope 1.5 → 1.2). Both passed at CAL1 (2027-07-28, 2027-10-31); now 0 of 20
  seeds reach them at all. CAL2-X fitted the factor to the 2025–26 BTOS growth and checked worldfx --smoke (seed 2027
  rows, which do not include these two 20-seed rows). The same factor slows adoption through the 2027 takeoff, so the
  measured 2025–26 pace and AI 2027's Oct 2027 labour targets now conflict: a refit / designer item (e.g. whether the
  fit should apply to the per-release step only, or the 2027 targets are scenario projections like F11's floor).
- **safety S4 P_mis 0.377 (1): CAL2-S** (target restated 0.40–0.80; graders at the median expert; framework High per
  world). CAL2-S's run 0.382; now 0.377 (−0.023 from the band; within one world flipping, se ≈ 0.07 per CAL2-S).

## (c) Outdated test (2)

- **ws4 C1 ×2** ("the framework blocks the candidate that breaks it" now reads `Held … ("Biological: Critical"):
  Atlas-2.8 measures BIO 10.5 ≥ 10; needs an external evaluation`; "the same launch with classifiers passes" fails).
  Unchanged since CAL1's (c): CAL-S moved Critical to L 10, the rig's candidate is Critical, where classifiers do not
  suffice. The rig should pick a candidate between High (6.4 on ai2027 since CAL2-S) and Critical (10), or expect the
  external-evaluation hold. Not fixed in any lane since.

## (d) Suspected real bug (0)

None found from the logs. The closest candidate is the two worldfx "never" rows (0 of 20 seeds, not merely late), filed
under (b) because both follow from CAL2-X's documented adoption and hire-slope changes; if the refit shows U never rising
1 pp in any 12 months even through the SEZ / explosive-growth phase (worldfx W17 at 2028-05-18, g 59%), that would be
worth a look as a mechanism gap rather than a tuning one.

## Notes for the next round

- Timelines: ai2027, fast, slow and every start M pass; authors2026 SAR / SIAR / ASI remain (post-SAR shape through
  rival diffusion). All T1L and China / rival rows are deferred to the rivals session.
- World / finance: the round-2 adoption fit fixed every 2025–26 world row but broke the 2027 labour rows (never) and
  pulled 2026 valuation / marks just under their bands (F7 $0.94T vs $1T; FC1 $2.08T vs $2.5T).
- Safety: anchors fixed in all four worlds (CAL2-D: MO / STEER / SUCCSTEER ≈ 12.0% on ai2027, authors2026, fast and
  slow); S4 just under the restated band; S5 RefBot moved down to 15%.
- Tests: ws4 C1 ×2 rig still outdated; EV9 still the designer's timing question.
