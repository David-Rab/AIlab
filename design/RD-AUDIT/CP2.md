# CP2 test checkpoint

Worktree AI27-cp2, detached at becec5b (Merge p3-c2: RD-A04, R02a, R02b, R03, R04, A07), 2026-11-23.
Output: cp2-full.txt; logs in AI27-cp2/.simcache/logs/. No UI test (`--no-ui`), no deep tier. Fixtures NOT regenerated.
Classified by reading the logs and BUILD-NOTES only. No bisecting, no extra runs.

## Totals

- tsc main + scripts/v2: clean.
- test:full (no UI): **16/36 scripts ok, 2276 passed, 82 failed**, wall 16.2 min (cpu 108 min, load 87%).
  CP1 was 30/35 ok, 3025 passed / 8 failed. CP1's total includes ui's 687 checks, so the non-UI comparison is
  2340 / 6 then vs 2276 / 82 now.
- Check counts that moved: hygiene 199 → 191 run (the script crashes, see (c)); oversight 29 → 31; lint-tradeoffs 1062 /
  34 WARN → 1076 / 19 WARN; new scripts currency (5) and domainref (6) pass; successor 12 → 12 (1 fail);
  safetyideas 39 → 39; safety 25 → 21.

## (a) Same as CP1 (3)

| Check | CP1 | CP2 |
|---|---|---|
| finance F8 RefBot out of distress through 2026 | 66.7% | 33.3% (same check, worse) |
| worldfx A2a US hours of AI use ≈ 6% | 6.7% | 7.0% |
| worldfx W4 firm adoption 17–20% | 23.4% | 26.2% |

calib T1 authors2026 SIAR / ASI were in CP1 as well. They are listed under (b) because their values moved
(2041.5 → 2071.5, 2823 → 2700.5).
golden-timelines 3 WARN: unchanged.

## (b) Calibration / timeline value moved (48)

Likely tasks (from the "moves calibration" notes): timelines go to RD-E03 (tuning lands at once: earlier milestones),
RD-E02 (AI-taste lift lost: slower), RD-E01a/b (P13 / P05 / P24 / P07 changes), RD-A03, RD-R05, RD-R08, RD-A05b (no
spare compute into data / agents), RD-L04 (milestone predicate: coverage ≥ 0.9 and the cost test) and RD-L01 / L03.
Safety goes to RD-R02b (yes, safety), RD-R01, RD-U05 (domain levels lower, so danger and RSCH gates fire later),
RD-A04, RD-R03 (safety teams idle with nothing queued) and RD-R04. Finance and world goes to RD-A05b / A05a / A06
(compute and agents) and the timeline shift.

### calib (22)
| Check | CP1 | CP2 | Likely |
|---|---|---|---|
| V3.7 research speed M ≈ 1 at start (leader, ai2027) | pass | M 1.379 | RD-E01a (RSCH +0.5), RD-E03 / RD-A02 mix |
| T1 ai2027 SAR | 766.5 | 844.0 (want 791) | E02 / A05b / L04 (later) |
| T1 ai2027 SIAR | 865 | 977.0 (want 883) | same |
| T1 ai2027 ASI | 920.5 | 1033.5 (want 915) | same |
| T1 authors2026 SC | 1505 | 1433.0 (want 1495) | E03 / R05 (earlier), U07 |
| T1 authors2026 SIAR | 2041.5 FAIL | 2071.5 (want 2151) | RD-B08 (CP1), plus the Phase 2/3 tasks |
| T1 authors2026 ASI | 2823 FAIL | 2700.5 (want 2975) | same |
| T1 fast SC | pass | 849.5 (want 880) | E03 / U07 |
| T1 fast SIAR | pass | 881.0 (want 925) | same |
| T1 fast ASI | 926 | 895.0 (want 956) | same |
| T1 slow SC | pass | 4720.0 (want 4758) | U07 |
| T1L ai2027 SC / SAR / SIAR / ASI | WARN / pass | 429 / 633 / 781 / 837 (want 638 / 791 / 883 / 915) | L04 / L01 (lead-lab median moves far earlier) |
| T1L authors2026 SC / SAR | pass | 908 / 992 (want 1495 / 1573) | U07 (authors2026 RefBot research starts earlier), L04 |
| T1L fast SC / SAR / SIAR / ASI | pass | 564 / 606 / 613 / 613 (want 880 / 880 / 925 / 956) | same |
| T1L slow SC | pass | 1251 (want 4758) | same. A 9.5-year miss, so check whether this is a T1L definition change from L04 rather than calibration. |

### safety, safetyrates, sabotage, danger, control (8)
| Check | CP1 | CP2 | Likely |
|---|---|---|---|
| safety S4 RefBot P_mis at ASI ∈ [0.55, 0.85] | 0.601 | 0.381 | R02b / R01 / U05 / R03 |
| safety S5 U below L by SAR ≥ 50% | 68%, median −1.09 | 13%, median +0.64 | R02b / A04 / R03 |
| safetyrates F2 sabotage after learned hacking 6–20% | pass | 1.0% | U05 (SAND / SCHEME levels), R02b |
| sabotage anchor MO 12% | pass | 1.0% (C 0.031, O 0.800) | same as F2 |
| sabotage anchor STEER / SUCCSTEER κ | pass | 1.0%, κ 0.397 vs SAFSAB 1.361 | same |
| danger start: SYC and RH common | pass | SYC 0.01, RH 0.16 | U05 (domain levels drive danger flags) |
| control process: escaped copy exposure ≤ θ_w | pass | 0.334 vs 0.245 | U05 / L05 |
| safetyideas P23 CoT family at L 12 | pass | visible 0.875, faithful 0.966 | U05 / R01 (could also be (d)) |

### finance (6, F8 is in (a))
F7 2026 revenue $54.0B → $34.6B; F7 2026 capex → $145.9B (want $200B ±25%); F7 end-2026 valuation $4.47T (2027) / pass →
$0.53T (want $1–3T); F9 FC1 late-2026 marks $1.93T (want $2.5–3T); F9 FC2 slower-growth multiple 23.5× vs 23.6× (2027
34.3× vs 31.8×); F11 2027 revenue $136.3B → $86.1B. Likely: A05b / A06 (internal agents and features no longer
help internal work; spare serving gone), and the timeline shift.

### worldfx (7, A2a / W4 firm in (a))
F7/F11 2026 revenue $35.9B; HireRate_SOFT ≤ 10% median 2026-12-22 (want Jul 2027 ±3 mo); AI-friend share 3.0% (want 10 ±3);
25% remote work by AI 2027-06-07 (3/20 in window); GOV T1 Accept ≥ 0.85 never; A2a hours saved 2.9% (want 2.2%); W4
22–25-year-olds −25.3% (want −19 ±5). Likely: the timeline shift and A05b / A06.

### ws4 / rivals, China and rival cadence (5)
| Check | CP1 | CP2 | Likely |
|---|---|---|---|
| ws4 T3 China lead at start 150–200 d | pass | 220 on all 8 seeds | RD-L03 (follower start gaps at 1.2), U06, L01 |
| ws4 T3 China mean lead until theft 150–200 d | 174 d (INFO in calib) | 38 d | L02 (theft hazard on lagDays), L03 |
| rivals R2 bases on a 9–15-month cadence | pass | 1–2 bases in two years (versions fine) | E02 / E03 / L03 (rival research pace) |
| rivals R8 follower start base staleness | pass | ePre off (r2 −0.352 vs −0.110 wanted, r3 −0.404 vs −0.177) | L03 / U06. Could also be (d): the check's "want" may still use the old per-world rate. |
| rivals R9 China first-weeks lead | pass | day 1 220 d (gap 219), then −41 / −75 d at days 30 / 60 | L03 / L02. The negative values look odd: watch. |

## (c) Crash, error or looks broken (8 failing checks + 1 crash)

1. **hygiene crashes:** `TypeError: Cannot set properties of undefined (setting 'base')` at
   `scripts/v2/hygiene.ts:474:14` (`pc.parts.base = 1;`). The script aborts and about 8 checks never run (199 → 191).
   This is probably a test rig reading a production-cost `parts` shape that a Phase 2/3 task changed, so it may really
   be (d). It is a crash either way.
2. **fixtures:** `fixture spinout day 400 is plain JSON with the leader lab — s.player.safety.effectiveControl.believed = NaN`.
   A NaN in live state: R02b / A04 / A06 package-control (believed-control) paths.
3. **fixtures:** `player SIAR within twice the golden tolerance (seed 2027 canary) — got undefined want 883 ±44 d`.
   The seed-2027 player has no SIAR date at all, where CP1 had 870. Either the canary horizon is too short for the later
   timeline (b), or the milestone is no longer recorded.
4. **ws4 E5:** `every EndingId is reachable (17 endings, forced states) — rogue`, and
   **control:** `endings: every ASI and rogue ending type still resolves from forced states (no roll) — missing rogue`.
   The rogue ending cannot be reached even from forced states. That looks like a broken path (L05 rogue-copy gate or
   A06 control), not calibration.
5. **safetyideas P14:** `steering fades with capability … AF d 0.325 (L 5) → 0.325 (L 14.5)`. No decay at all: the
   input looks disconnected, possibly the U05 / R01 level change.
6. **successor:** `no AI share of R&D (no agent compute): no pull, the new model starts from its own prior — r 0.179, ω 0.066`.
   There is pull with no agent compute, so something still feeds the AI share (A05b / A06 / A07?).
7. **research:** `assignment: within 5% of the brute-force optimum … worst 91.5% over 60 cases`. A planner-quality
   regression, probably RD-R03 (one planner for both departments).
8. **hygiene:** `save: the finance migrations 33 → 42 leave an already-migrated state unchanged (idempotent)`.
   Migration idempotence is broken, maybe by the 55 → 58 migrations.

## (d) Test expectations broken by an intentional change (23)

- **fixtures stale (5):** day0, day400, day900, challenger day400 and spinout day400 differ from the committed fixtures.
  These are expected after the many state-shape changes; regenerate with `fixtures.ts --write`.
- **safetyresearch (6):** E1 first result after T₁ (worst 50.0%), E1 cycle 0.500 T₁, E1 readouts 45 / 45 d, E1 doubling
  engineers ×1.00, E1 tool-upkeep engineers 0 → 0, E2 m_exp no √M cap. The rig assumes the old units. RD-R02a: ℓ at
  reference = 0.5. RD-R02b: one test, no ideate / steady cycle. RD-A04: the allocator gives engineers by need and
  upkeep only on fading tools.
- **products (4):** M2 coverage = budget (budget is now a total-compute share, and the excess is unused: RD-A05a).
  A5 less engineering compute gives more research agents: 42141 → 42141 (RD-A05b / A06). C2c Memory in use for internal
  agents (RD-A06: tooling is separate). C2c feature tooltip upkeep (RD-A06: keep-alive upkeep).
- **serving S6:** the scaffold applies to internal engineering agents, 27.660 → 27.660 (RD-A06: features no longer help
  internal work).
- **research:** `a dud direction fails after 3 dropped candidates — failed, drops 0` (RD-R05: unlocks have no drops).
- **rivals R6:** milestones are the λ knot days, but 79 / 241 / 433 / 633 vs 99 / 289 / 429 / 625 (RD-L04: milestones
  now need coverage and the cost test).
- **hygiene registry:** `autoSplit` is an unlisted system (RD-A05b added departments/autoSplit.ts without registering it).
- **hygiene save 42 → 43:** monitoring budget = the old 20% of the safety pool, got 0.004 (RD-A05a moved the monitoring
  budget to a share of total compute).
- **safetyideas lint:** no flat factor on agenda speed (F44 ×3, AG17 ×(1 + √m)). Either the grep pattern now matches
  the R02a/b stepper code, or a flat factor came back. Not read further.
- **lint-ux:** numbers without a tooltip: ResearchProjects.tsx:267 `F.pct(v.odds)` (R05 "Chance it works"),
  Split.tsx:61 / 93 (A05b Auto-split row), Work.tsx:204 `F.short(a.cap)` (A04 NeedList). New UI from those tasks.
- **lint-structure:** action title "Safety research engineers by need" (`research.safReAlloc`, RD-A04) is over 4 words.

Count check: (a) 3 + (b) 48 + (c) 8 + (d) 23 = 82 failing checks, plus the hygiene crash. Borderline items (P23, R8,
T1L slow, the hygiene TypeError, the safetyideas lint) could move between (b), (c) and (d).
