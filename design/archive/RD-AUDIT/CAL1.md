# CAL1 calibration run (after review fixes and sourcing)

Worktree AI27-cp2, detached at rd 48b4b8e (Merge branch 'cal-saf' into rd), 2026-11-23. No source edits.
This is the closing run before refits: after the RF lanes (BUILD-NOTES "Merge RF lanes"), RF-S13 / S13b / S13c, RF-S14
and the CAL-P / CAL-W / CAL-S sourcing. One run of each; classified from the logs and BUILD-NOTES only (no bisects, no
probes). Logs: AI27-cp2/.simcache/logs/. Compared against CP3.md (e749ca2) and, where it gives a newer number, HANDOFF.md
§1 (after the CP3c–CP3k refits).

## What ran

1. `fixtures.ts --write`: regenerated day0, day400, day900, start-challenger-day400, start-spinout-day400 (13 s). Files
   written; 4 PASS / 4 FAIL (see below). The regenerated fixtures were used by every later script (sabotage, finance,
   ws4, ... read them).
2. `npm run test:cal` (golden-timelines + calib T1 / T1L / T4 over CAL_SEEDS; 10 workers): 1/2 scripts ok, 31 passed,
   18 failed; wall 10.3 min (cpu 81 min).
3. `run.ts --tier full --no-ui --workers 10 --only safety,safetyrates,sabotage,danger,finance,worldfx,ws4,rivals,evals`
   (all seeds; S5's deep mechanism checks not run): 2/9 ok (danger, safetyrates), 349 passed, 44 failed; wall 12.1 min
   (cpu 121 min).

Not run (out of the brief): UI, deep tier, products / serving (C1 Chat WAU, A7, A8 market targets), hygiene, lints,
data / suites / signals / research / safetyresearch / oversight / control / safetyideas.

## Totals

- **66 failing checks**: calib 18, fixtures 4, finance 22, worldfx 8, sabotage 4, ws4 4, safety 3, rivals 2, evals 1.
- Classes: **(a) same as CP3 / known open 22, (b) calibration moved 15, (c) outdated test 5, (d) suspected real bug 24**
  (23 of the 24 are one bug: rival `phys.clDay` set to `undefined`). 22 + 15 + 5 + 24 = 66.
- Wall time of the session's runs: 13 s + 10.3 min + 12.1 min ≈ 23 min.

## Calibration targets

### Timelines and presets (T1: RefBot median over 20 CAL_SEEDS; T1L: leader lab, 5 seeds; days from start, day 0 = 2025.5)

| Target | CP3 | now | want | |
|---|---|---|---|---|
| ai2027 SC / SAR / SIAR / ASI | 499 / 615 / 791.5 / 867.5 | 616 / 788 / 900 / 949 | 638 ±29 / 791 / 883 / 915 ±44 | **pass ×4** |
| authors2026 SC / SAR / SIAR / ASI | 1236.5 / 1303.5 / 1722.5 / 2106 | 1585 / 1893 / 1981.5 / 2020 | 1495 / 1573 / 2151 / 2975 | fail ×4 (SC, SAR now late; SIAR, ASI still early) |
| fast SC / SAR / SIAR / ASI | 671 / 685.5 / 702.5 / 709.5 | 884.5 / 944 / 980.5 / 1007 | 880 / 880 / 925 / 956 | SC pass; SAR, SIAR, ASI fail (late 64 / 56 / 51 d) |
| slow SC | 2919.5 | 2466 (2032.25) | golden 4758 (2038.5); sourced 2034–2035 (≈ 3100–3470) | fail (early vs both) |
| T1L ai2027 SC / SAR / SIAR / ASI | 467 / 642 / 775 / 838 | 576 / 745 / 794 / 815 | 638 / 791 / 883 / 915 | fail ×4 (early, gap halved) |
| T1L authors2026 SC / SAR | 1242 / 1339 | 1654 / 1759 | 1495 / 1573 | fail ×2 (now late); SIAR / ASI 1829 / 1857 WARN (known) |
| T1L fast SC / SAR / SIAR / ASI | 719 / 731 / 731 / 737 | 925 / 954 / 968 / 982 | 880 / 880 / 925 / 956 | SC, SAR fail; SIAR, ASI pass |
| T1L slow SC | 1820 | 2235 | 4758 | fail |
| Frontier G path to 2026 | worst 0.76 G | 0.17 G (1.34 G/yr) | ±0.2 G | **pass** |
| METR h50 doubling | 2.4 mo | 4.2 mo | 4.2 ±1 | **pass** |
| Start research speed M (ai2027) | 1.379 | 1.202 | 1 ±0.1 | fail (= HANDOFF 1.20; other presets 1.00–1.05) |
| T4 rival gaps at start | pass | 3.3–5.0 mo (40 seeds 3.1–8.4) | 3–9 | pass |
| Fixture canary, seed 2027 SC / SAR / SIAR | 522 / 690 / 851 | 622 / 858 / — | 638 / 791 / 883 | SIAR not reached by day 900 (fail); SC, SAR INFO |

### Finance / market / world (finance, worldfx; products / serving not run)

| Target | CP3 | now | want | |
|---|---|---|---|---|
| F6 supplier margin (mean) | 77.4% | 76.5% (min 74.2%) | 70–75% | pass (check passes) |
| F7 end-2026 valuation | $0.97T | $1.26T | $1–3T | **pass** |
| F7 2026 revenue | pass | $53.7B | $45–56B ±20% | pass |
| F9 FC2 slower growth lower multiple (2026) | 31.9× vs 23.5× | 20.8× vs 21.0× | slower < faster | **pass** |
| F11 2027 revenue | $79.0B | $101.5B (worldfx $102.8B) | ~$140B ±30% | **pass** (near the low edge) |
| FIN6a aggressive pitch, next mark under post | fail | pass | falls back | **pass** |
| HireRate_SOFT ≤ 10% | 2026-07-10 | 2027-02-10 (4/20 in window) | Jul 2027 ±3 mo | fail (early) |
| 25% of remote work by AI | 2027-03-04 | 2027-07-28 | Oct 2027 ±3 mo | **pass** |
| U +1 pp over 12 months | 2027-04-13 | 2027-10-31 | Oct 2027 ±3 mo | **pass** |
| GOV T1 Accept ≥ 0.85 | pass (2027-12-02) | never (7/20 in window) | Dec 2027 ±3 mo | **fail (new)** |
| Equity 2026 | +46.2% | +34.6% | +30 ±10 | **pass** |
| AI-friend share Jul 2027 | 3.0% | 3.0% | 10 ±3 | fail |
| A2a hours of AI use, mid-2026 | 7.7% | 6.9% | 5–6.5% | fail |
| A2a hours saved, mid-2026 | 3.4% | 2.7% | ≈ 2.2% | fail |
| A2b paid share through 2026 | 5.2 → 9.9% | 5.3 → 7.1% | 4–9% | **pass** |
| W4 aggregate unemployment Nov 2026 | 0.21 pp | 0.20 pp | ≈ 0 | fail |
| W4 22–25-year-olds vs counterfactual | −33.8% | −21.3% | −19 ±5 | **pass** |
| W4 firm adoption | 29.5% | 24.3% | 17–20 ±2 | fail |
| W2 Normal Technology TFP over a decade | +53.9% | +17.3% | +0.5–1% | fail (17× the band) |

### Safety (safety, safetyrates, sabotage, danger, evals)

| Target | CP3 | after refits (HANDOFF) | now | want | |
|---|---|---|---|---|---|
| S4 RefBot / medium P_mis at ASI | 0.090 | 0.487 | **0.344** | 0.55–0.85 | fail (moved back down) |
| S4 safe recipe P_mis at ASI | pass | — | 0.055 | ≤ 0.25 | pass |
| S5 RefBot U below L by SAR | 20% | 18% | 23% of 40 (median U − L +0.34) | ≥ 50% | fail |
| S5 Mixed-bot min margin, holds | −3.96, 25% | — | −5.00, 35% | median holds | fail |
| F2 sabotage after learned hacking | 0.9% | pass (12.9%) | 14.3% | 6–20% | **pass** |
| F2 inoculation cuts Mis / AF / sabotage | 90.2 / 90.8 / 95.4% | pass | 85.9 / 85.5 / 92.9% | 75–90 / 75–90 / 75–95 | **pass** |
| F5 anti-scheming cut | 99.4% | pass | 93.2% | 90–98% | **pass** |
| MO anchor (sabotage.ts) | 1.0% | 12.0% (CP3f) | **15.3%** (C 0.480) | 12% | fail (overshoots) |
| STEER / SUCCSTEER κ anchor | 1.0% | 12.0% | 15.3% | 12% | fail (same cause) |
| danger start: SYC and RH common | SYC 0.00, RH 0.10 | pass | SYC 0.15, RH 0.10 | common | **pass** |
| EV9 first release suites | 30 / 33 d | pass (then reverted) | 34 / 33 d | ≈ 14 d | fail (RF-S6 revert, expected) |
| F6 persistence through a safety run | WARN 64% | WARN | WARN 64.4% | ≥ 80% | WARN (known) |

### China (ws4, rivals)

| Target | CP3 | after refits (HANDOFF) | now | want | |
|---|---|---|---|---|---|
| T3 China lead at start | 220 d | 220 d | 220 d (all 8 seeds) | 150–200 d | fail |
| T3 mean lead until theft | 3 d | 197 d | 196 d | 150–200 d | **pass** |
| T3 gap after a theft | 9–31 d | 83–98 d | 85–97 d | ≈ 60 d | fail |
| R9 China lead in the first weeks | −143 / −223 d | — | pass | start gap + days since | pass |
| R10 gap formula vs simulated start lead | — | — | −1.3 to −0.4 mo | ±2 mo | pass |

## (a) Same as CP3 / known open (22)

- calib: V3.7 start M 1.202 (HANDOFF 1.20); T1 fast SAR (HANDOFF "fast misses SAR"); T1 slow SC and T1L slow SC (known:
  the 2038.5 golden is the v1 integrator's, the sourced 2034–2035 is not the check's target; slow is early against both);
  T1L ai2027 SC / SAR / SIAR / ASI (×4; still early, by about half of CP3's gap). 8.
- evals EV9 34 / 33 d: RF-S6 reverted 8aae8b7 and said EV9 would fail again (30 / 33 d). 1.
- safety S5 RefBot 23% and S5 Mixed-bot margin −5.00 / holds 35% (HANDOFF open). 2.
- worldfx HireRate_SOFT (now 2027-02, still early), AI-friend 3.0%, A2a use 6.9%, A2a saved 2.7%, W4 aggregate 0.20 pp,
  W4 firm adoption 24.3%, W2 TFP 17.3% (all closer than CP3 except AI-friend). 7.
- ws4 T3 start lead 220 d (fixed `chinaGapOom` start gap) and gap after theft 85–97 d (HANDOFF 83–98: timing artefact of
  the theft day against the player's base cycle). 2.
- rivals R5 leader day-0 rates (pre 0.480, mid 0.030, ceil 0.046 OOM/yr; unchanged) and R8 follower staleness (r0 now
  close, −0.339 vs −0.334; r2 −0.336 vs −0.095, r3 −0.401 vs −0.175, China off). Rivals out of scope. 2.

## (b) Calibration moved (15)

- **authors2026 T1 SC / SAR / SIAR / ASI (4) and T1L SC / SAR (2): CAL-W** (`sdSC` 2.15 → 0.5, `dBM` 4.65 → 2.17,
  "moves strongly"; `gSC` 33.45 kept as a stand-in pending one AIFM run). SC / SAR went from early to late, SIAR / ASI
  stay early: the SAR → ASI stretch is 0.35 y against the golden's 3.8 y. Refit `gSC` (and see T1L's known deviation).
- **fast T1 SIAR / ASI (2) and T1L fast SC / SAR (2):** fast's own knobs are unchanged (CAL-W kept them); candidates
  from the "moves calibration: yes" lines are RF-S6 (EV9 revert: release-eval timing), RF-S13 (control protocol on
  internal work from day 0, 7% Slowdown) then CAL-S (misalignment rule only from CYBER ≥ θ_SCHEME 5, so control arrives
  later), RF-S9 (hack saturation). All of fast is now 50–75 d late after SC, where CP3 was 200 d early.
- **fixtures canary SIAR undefined (1):** seed 2027's SAR is day 858 (golden 791), so SIAR falls past the day-900 fixture.
  Single seed; the T1 median passes. Same timeline shift.
- **safety S4 P_mis 0.344 (1):** down from 0.487 after CP3h / CP3i. Candidates: CAL-S (misalignment rule later; Critical L
  12 → 10), RF-S9 (one hack-saturation rule on the player's runs), RF-S7 (length grading gap revert), RF-S13 / RF-S14
  (belief side only, "maybe").
- **sabotage MO anchor 15.3% and STEER / SUCCSTEER κ (2):** CP3f fixed both at 12.0%; now 15.3% with C 0.480 (the
  organism's capability term). F2 sabotage (same organism family, safetyrates) is 14.3%, inside 6–20%. Candidates:
  RF-S9 / RF-S7 or a domain-level change in the RF-R lane (RF-R2 measured level; RD-U05 offsets moved C before). Not
  bisected.
- **worldfx GOV T1 Accept ≥ 0.85 never (1):** passed at CP3 (2027-12-02); now 7 of 20 seeds in the window, median never.
  The timeline is ~0.3 y later than at CP3 (ai2027 back on the golden), and CAL-P (KYC_REFUSE 0.1 → 0.25, CERT_DAYS
  120 → 240) and CAL-S (framework thresholds) move what the public sees; not separable from the logs.
- Also moved, now **passing** (not counted): ai2027 T1 ×4, fast SC, frontier G path, h50, F7 valuation, F9 FC2, F11,
  FIN6a, equity, remote work, U +1 pp, A2b, W4 youth, F2 ×4, F5 anti-scheming, SYC, T3 mean lead, R1, R6, R9.

## (c) Outdated test (5)

- **ws4 C1 ×2 (CAL-S):** "the framework blocks the candidate that breaks it" now reads `Held by your Safety framework
  ("Biological: Critical"): Atlas-2.8 measures BIO 10.5 ≥ 10; needs an external evaluation`, and "the same launch with
  classifiers passes" fails. CAL-S moved Critical from L 12 to 10, so the rig's candidate is now Critical, where
  classifiers are not enough (RF-S13b: only evidence still holds). The rig should pick a candidate between High (6.4)
  and Critical (10), or expect the external-evaluation hold.
- **sabotage "control layer raises oversight" (1, RF-S13 + regenerated fixtures):** oversight 0.860 → 0.860, uncaught
  1.6% → 1.6%. The rig turns control on over the day-400 fixture; the regenerated fixture already has the framework's
  control applied to internal deployments (RF-S13 auto-apply once the version measures CYBER ≥ 5), so the "off" arm is
  already on. Verify; the rig should switch control off for its baseline.
- **finance FIN3c ×2 (merger vote on runway; founder confidence cost):** "poor 5/5 … runway 8.0 q" (CP3: poor 1/5, 0.7 q)
  and "founder: 3/4, confidence 25 → 25". No finance source changed since CP3 (`git diff e749ca2 48b4b8e -- src` touches
  no finance file); the rig's "spend the last cash" case no longer leaves the lab short, presumably because revenue rose
  (F11 2027 $79B → $101.5B) and CAL-P cut CERT_CASH. A state-dependent rig premise; verify, then pin the poor case's cash
  after the deal directly. Borderline (d) if the vote reads a runway that ignores the deal's obligations.

## (d) Suspected real bug (24 checks, 2 causes)

1. **Rival `phys.clDay = undefined` breaks the plain-JSON state invariant (23 checks):** fixtures "day 400 / challenger
   day 400 / spinout day 400 is plain JSON" (3) and finance "action fin.* / cmp.* applies and the game runs on (plain
   JSON)" (20): `s.rivals[i].phys.clDay is undefined`. Cause: `src/engine/v2/actors/rivalModel.ts:790`
   `r.phys.clDay = undefined;` in `clRefresh` (CP3c, commit 01012a0: no stream before P08 adoption). Should be
   `delete r.phys.clDay` (the field is optional, `types.ts:2025`). The regenerated fixtures were written with it anyway
   (JSON drops the key, so the files themselves are fine).
2. **sabotage "backdoors and hidden compute: daily attempts at the formula's rate" (1):** 7 caught + 60 uncaught over
   20000 days vs 23.5 expected (CP3: 3 + 31 vs 28.7). The rig rolls `rollFleetCovert` on the regenerated day-400
   fixture and compares with `fleetCovertTerms` taken before the loop; ×2.9 the formula is far outside 4√n. Either the
   roll and the terms disagree, or the rolled days change the state (footholds / framework parts) the formula was read
   from. New with this run; verify.

## Notes for the refit

- Timelines: ai2027 is on target; authors2026 needs `gSC` (CAL-W left it a stand-in) with the new sd / Δ_bm, and its
  SAR → ASI stretch is far too short in both T1 and T1L; fast is now late after SC on T1 and late on T1L SC / SAR;
  slow needs a target decision (sourced 2034–2035 vs the golden 2038.5) before any fit; start M 1.20.
- Safety: S4 fell back to 0.344; MO / κ anchors overshoot to 15.3% (F2 still in band); S5 unchanged.
- World: GOV Accept is the one new miss; W2 still 17× its band.
- China: unchanged from HANDOFF (start lead 220 d, after-theft 85–97 d).
- Fix the `clDay` line before the next full run: it accounts for 23 of the 66 failures.
