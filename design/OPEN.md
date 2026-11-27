# Open items ("for later")

The one list of everything noted for later and not yet done, across workstreams. Consolidated 2026-11-27 from the
task files, handoffs, build logs and memory. One line per item, with the place that has the detail.

Kinds: **Decide** = needs the designer · **Check** = may already be fixed, verify before acting · **Bug** = known
wrong · **Later** = planned, deliberately not now · **Parked** = small, deliberate, do when convenient.

When an item is done or dropped, delete its line here. New "for later" items go here, not into task files or memory.

## Cross-cutting

| Item | Kind | Detail |
|---|---|---|
| TRAINING › Runs: restore the per-run training-share −/+ (designer 2026-11-27; 001865c2 made it read-only with a link) | Later (small UI task) | memory ai27-datacenter-redesign; archive/RD-AUDIT/UI-BUILD.md |
| ws4 E1 "no AI 2027 canon" failed on ai2027-world Agent-N names; that world preset is gone — does the check still fail? | Check | archive/MARKET-CP.md |
| 2026-11-17 tycoon-era deferrals: R1 auto-pick from open projects, P2, P4, M3 best-model policy, M6, PR1 shortfall policy, O3, start-type presentation (ST1/ST2), follower catch-up. Most predate the v3 and R&D rebuilds; triage which still mean anything | Check | archive/JANK-AUDIT.md; archive/PROGRESS.md R9; memory ai27-tycoon-direction |

## Balance and calibration

Owner: the balance session. Its live list is [bal/RECAP-2026-11-27.md](bal/RECAP-2026-11-27.md) §2–3; summarised here.
Rule from 2026-11-27: parameters only, mechanism changes are parked unless they block calibration.

| Item | Kind | Detail |
|---|---|---|
| M4: the 36 M3 games on the full tree, read against M3 | Later (next) | RECAP §3.1; bal/LABOUR-ROUND.md §11 |
| Fit within source ranges what M4 leaves off (P24 strength; SC threshold only for a constant offset) | Later | RECAP §3.2 |
| Fold the data-centre calibration note into the scenario checks | Later | dc/CALIBRATION-NOTE.md |
| Re-derive ~100 quick-test expectations written for the old ai2027 world (+ ~20 UI failures); classify each | Later | RECAP §3.4 |
| Stage 2: sourced realistic-lab policy in the coupled game (money → compute, hiring at market wages; finance and payroll calibrated here) | Later | RECAP §3.5 |
| Stage 3: strong bot, gap to realistic, the five alignment difficulty levels, end-screen score weights (B5 §F6) | Later | RECAP §3.6; bal/SCENARIOS.md |
| Labour market vs NPC labs: one simple rule for NPC staff and poaching | Check | RECAP §2.1; likely settled by the NPC merge (archive/npc/MERGE-MASTER.md: background demand, one shock per direction, no NPC stars) |
| Foothold removal crews sized for 100-head teams | Parked (designer 11-27) | RECAP §2.2 |
| Review staffing 5 → 2.5 per 10% reviewed (lead's change) | Parked (designer 11-27) | RECAP §2.3 |
| P24's permanent extra returns (rShare 0.3) have no AIFM counterpart | Parked (designer 11-27; M4 shows if visible) | RECAP §2.4 |
| AI efficiency across tasks (AIFM: cheaper on easy tasks; game: flat) | Parked (designer 11-27; M4 measures the gap) | RECAP §2.5; LABOUR-ROUND §12 Q1 |
| Successor-pull checks fail on master (pull grows with automation; steering act) — no owner | Bug (parked 11-27) | RECAP §2.7 |
| Taste effects for unlock and safety projects; full safety candidate lifecycle (~700 lines) | Later (parked mechanism) | bal/SAFETY-UNIFY.md |
| Release lumps (fix D) | Check (M4) | RECAP §2 |
| Small-model size ceiling (M3), with the SCALE-DIAG S1–S4 settings | Parked (raise only if M4 shows it blocks calibration) | bal/SCALE-DIAG.md §5 |
| Per-timeline horizon law (built, unused) | Parked (raise only if M4 shows it blocks calibration) | bal/FIXC-TRANSLATION.md §6 |
| Idea diminishing returns within a project (R2.4 option D) | Parked (raise only if M4 shows it blocks calibration) | BAL-TASKS.md; bal/STAGE1-DESIGN.md |
| Registry housekeeping: 9 comment/code mismatches (§B), 12 duplicated constants (§C), closure-held effects (§D), target re-triage (§E), one-offs (§F); the B6 target discussion | Parked | bal/B5-QUESTIONS.md; bal/B6-PREP.md |

## NPC labs

Spec [npc/NPC-LABS.md](npc/NPC-LABS.md); build log archive/npc/NPC-TASKS.md (merged 98e690c).

| Item | Kind | Detail |
|---|---|---|
| N13 shape checks (spec §14) as a script and dashboard tab | Later | archive/npc/NPC-TASKS.md |
| Calibration comparisons: finance, serving, calib, ws4 T3/T4 | Later | archive/npc/NPC-TASKS.md (merge row) |
| Release lags are design values; source them from system cards | Later | npc/CAST-2025.md §9 |
| The market has no established-product effect (leader start chat users 610M vs ≈ 700M) | Later | archive/npc/NPC-TASKS.md |
| Premium-poaching setback size | Check | archive/npc/NPC-TASKS.md; archive/npc/MERGE-MASTER.md |
| Tool capability bars: questions 2–6 | Check (N4 may have settled them) | npc/TOOL-REQUIREMENTS.md; archive/npc/N4-RESULT.md |
| Rival distillation into the player (balance fix E) | Later | memory ai27-balance-deferred |
| NPC labs have no data-centre sites (count only through the outside-world waits) | Later | DATACENTERS.md; dc/CALIBRATION-NOTE.md |

## Data centres

Spec [DATACENTERS.md](DATACENTERS.md); calibration [dc/CALIBRATION-NOTE.md](dc/CALIBRATION-NOTE.md) (merged 47ee6fc6).

| Item | Kind | Detail |
|---|---|---|
| Bot competence and spend size (≈ $300B of gas campuses by mid-2027 in seed 1) | Later (calibration) | dc/CALIBRATION-NOTE.md "Bots" |
| Design values with no per-project data: rush power, fast-track price, crash premium, community package, opposition odds | Parked | dc/CALIBRATION-NOTE.md; research/23 §8 |
| Grid-wait and turbine-wait easing 2027–30 | Parked | dc/CALIBRATION-NOTE.md |

## Market and revenue

Spec [MARKET.md](MARKET.md); checkpoint report archive/MARKET-CP.md.

| Item | Kind | Detail |
|---|---|---|
| Seat price readout is the last sector × region cell's, not the average (`a.seatPrice = o.seat`, src/engine/v2/worldfx/revenue.ts:575, verified 2026-11-27) | Bug | archive/MARKET-CP.md (b)1 |
| Agent mode's row in Products › Add a tool shows no type and no effect | Check | archive/MARKET-CP.md (b)2 |
| μ elasticity has no source at market level | Later | MARKET.md |
| Does a seller's own model set the scale its other models face? (as built: yes, trade-off shown truthfully; MK-6d alternative withdrawn) | Later (revisit when the designer says) | MARKET.md |
| Vetted "Usage terms" link and an explicit Chat free-tier picker are not on the screen | Later | MARKET.md |
| 2027 revenue $73B vs ≈ $140B sourced (F11) | Check (after M4) | bal/B6-PREP.md |
| Sector value per $ of revenue rises in the game, falls in the sources (VAL) | Check | archive/V3-TASKS.md |

## Safety

All of these go to one **dedicated safety session, started when the designer says** (designer 2026-11-23 and 2026-11-27). Sources: archive/RD-AUDIT/REVIEW-FIXES.md and the v3 tasks.

| Item | Kind | Detail |
|---|---|---|
| Over-confident beliefs | Safety session | archive/RD-AUDIT/REVIEW-FIXES.md |
| S5 option (a): instruments get harder with capability (sourced) | Safety session | archive/RD-AUDIT/REVIEW-FIXES.md |
| S4 re-judge; the S4 band 0.55–0.85 has no source | Safety session | archive/RD-AUDIT/REVIEW-FIXES.md; archive/PROGRESS.md |
| Safety programmes stop after a finished project; teams idle for the rest of the game (day 900: 0 of 18 staffed) | Bug → safety session | archive/RD-AUDIT/REVIEW-FIXES.md |
| Monitor stop rate vs SR-12 (a93a01ec may have fixed it) | Safety session | archive/RD-AUDIT/REVIEW-FIXES.md |
| Sandbagged discoveries should read "nothing found" (SABREAD) | Safety session | archive/V3-TASKS.md |

## UI

From the R&D UI phase follow-ups (archive/RD-AUDIT/UI-BUILD.md) unless noted.

| Item | Kind | Detail |
|---|---|---|
| Evals tab still shows raw levels (OQ-6) | Check | UI-BUILD |
| Three SAFETY › Cases limits missing (uitest R10) | Check | UI-BUILD |
| SAFETY › Safeguards as the one home for monitors, safeguard level, KYC | Check | UI-BUILD |
| Overview race "YOU · Atlas-2.10": which model the lead is measured on (the NPC merge rebuilt lead measurement) | Check | UI-BUILD |
| Star Hire preview says "no project moves today" for a lasting taste gain | Bug | bal/RECAP-2026-11-27.md §2.6 |
| Skipped readouts: revenue history per product, rival price per sector, win-back previews, licence sellers, spy estimate | Later | UI-BUILD |
| SL1–SL5 labels dropped (mapping not sourced) | Parked | UI-BUILD |
| Codex says "rivals are simplified" (decided 2026-11-16) | Check | archive/LIMITS.md |
| Regenerate GLOSSARY.md (`lint-ux --doc`) after the data-centre and NPC merges | Parked | ux/GLOSSARY.md |

## Finance and model

| Item | Kind | Detail |
|---|---|---|
| Supplier terms follow your equity access (spec §5): not built | Later | FINANCE-V3.md §5; archive/FINANCE-BUILD.md |
| FIN4 partner guarantee | Later | archive/FINANCE-BUILD.md |
| Relations C6 "Open weights" has no trust-vote version | Check | archive/FINANCE-BUILD.md |
| Continual learning ("later idea") | Later | MODEL-V3.md §4.6 |
| Dead fields RD-C04 / C05 / C07 and the P26 placeholder | Check | archive/V3-TASKS.md |

## Future phases

| Item | Kind | Detail |
|---|---|---|
| Medium vision (build target): US labs only, 2023 start, first post-ASI stages, setup cleanup | Later | vision/MEDIUM.md |
| Far vision: play any actor, start 2015–2023, play past ASI, configurable worlds | Later | vision/README.md, ACTORS.md, TIME.md, WORLDS.md |
| Endings: post-ending play; a 2015–2025 prelude | Later | memory ai27-endings-direction |

## Housekeeping

| Item | Kind | Detail |
|---|---|---|
| ~100 one-off `scripts/v2/_*` check folders; some pin old save revisions and are likely dead | Parked | — |
| Untracked scratch in the main checkout: `scripts/v2/_sabtmp/`, `design/ux/mockups/_icons-compute.txt`, `_render-compute.html` | Parked | — |
| Leftover folders (not worktrees): AI27-npc (locked at removal), AI27-compute, AI27-rd, AI27-rf-s2, two `AI27-agent120-*.log` folders | Parked | — |
| Balance docs still link to `../AI27-vision/...` and to docs now in archive/; fix when that session ends | Parked | BAL-TASKS.md; bal/HANDOFF-CALIBRATION.md |
| Remove `lab-*`, `cal*` worktrees after the balance session; perf worktrees with the speed-up decision | Parked | scripts/tools/clean-worktrees.sh |
