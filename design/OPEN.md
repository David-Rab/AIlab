# Open items ("for later")

The one list of everything noted for later and not yet done, across workstreams. Consolidated 2026-11-27 from the
task files, handoffs, build logs and memory. One line per item, with the place that has the detail.

Kinds: **Decide** = needs the designer · **Check** = may already be fixed, verify before acting · **Bug** = known
wrong · **Later** = planned, deliberately not now · **Parked** = small, deliberate, do when convenient.

When an item is done or dropped, delete its line here. New "for later" items go here, not into task files or memory.

## Cross-cutting

| Item | Kind | Detail |
|---|---|---|
| Engine speed-up: merge or drop `bal-perf` / `perf-p1..p5` (tick ≈ 3.7–4.1 ms vs a 1.5 ms budget; P2/P3/P5 fingerprint-identical) | Decide | design/bal/HANDOFF-PERF.md |
| TRAINING › Runs share control: restore per-run −/+ (data-centre memory) or keep it read-only with a link (001865c2) | Decide | memory ai27-datacenter-redesign; archive/RD-AUDIT/UI-BUILD.md |
| ai2027 "Agent-N" model names vs the no-AI-2027-canon rule | Decide | archive/MARKET-CP.md |
| Economy shape (outside-world session, parked by the designer 2026-11-28): with no player, AI does 32–44% of US work by the end but US unemployment ends at ~6% (youth 24–30%) and AI revenue is only 2.5–5% of GDP. Check re-employment (sectors.ts openJobs, displaced pool), the automation measure and the AI share of income | Later | design/world/WORLD-TASKS.md (obs-quiet, obs-built); design/world/SESSION-HEAD.md §14 |
| Plans A–D gaps after the outside-world build: AI Futures plan B (US sabotage of China: an "offensive options" beat at stage 3+) and plan A's handoff (a lift condition for the treaty cap). Parked by the refocus | Later | design/world/PLANS.md §5 |
| AI 2027 canon left in player-visible content: China lab "DeepCent", default company "OpenBrain", milestone `Agent-N` names and canon dates, the end screen's AI 2027 reference line and glossary term, the v1 glossary. Parked from the outside-world session (2026-11-27) | Later | design/world/OUTSIDE-WORLD.md §15; design/world/SESSION-HEAD.md §10 |
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
| Foothold removal crews sized for 100-head teams | Decide | RECAP §2.2 |
| Review staffing 5 → 2.5 per 10% reviewed (lead's change) | Decide | RECAP §2.3 |
| P24's permanent extra returns (rShare 0.3) have no AIFM counterpart | Check (M4) | RECAP §2.4 |
| AI efficiency across tasks (AIFM: cheaper on easy tasks; game: flat) | Check (M4) | RECAP §2.5; LABOUR-ROUND §12 Q1 |
| Successor-pull checks fail on master (pull grows with automation; steering act) — no owner | Bug | RECAP §2.7 |
| Taste effects for unlock and safety projects; full safety candidate lifecycle (~700 lines) | Later (parked mechanism) | bal/SAFETY-UNIFY.md |
| Release lumps (fix D) | Check (M4) | RECAP §2 |
| Small-model size ceiling (M3), with the SCALE-DIAG S1–S4 settings | Decide | bal/SCALE-DIAG.md §5 |
| Per-timeline horizon law (built, unused) | Decide | bal/FIXC-TRANSLATION.md §6 |
| Idea diminishing returns within a project (R2.4 option D) | Later (parked mechanism) | BAL-TASKS.md; bal/STAGE1-DESIGN.md |
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
| Does a seller's own model set the scale its other models face? | Decide | MARKET.md |
| Vetted "Usage terms" link and an explicit Chat free-tier picker are not on the screen | Later | MARKET.md |
| 2027 revenue $73B vs ≈ $140B sourced (F11) | Check (after M4) | bal/B6-PREP.md |
| Sector value per $ of revenue rises in the game, falls in the sources (VAL) | Check | archive/V3-TASKS.md |

## Safety

From the R&D review's "dedicated safety session" list (archive/RD-AUDIT/REVIEW-FIXES.md) and the v3 tasks.

| Item | Kind | Detail |
|---|---|---|
| Over-confident beliefs | Later | archive/RD-AUDIT/REVIEW-FIXES.md |
| S5 option (a) | Decide | archive/RD-AUDIT/REVIEW-FIXES.md |
| S4 re-judge; the S4 band 0.55–0.85 has no source | Decide | archive/RD-AUDIT/REVIEW-FIXES.md; archive/PROGRESS.md |
| Safety programmes sit idle after a finished project | Bug | archive/RD-AUDIT/REVIEW-FIXES.md |
| Monitor stop rate vs SR-12 | Check (a93a01ec may have fixed it) | archive/RD-AUDIT/REVIEW-FIXES.md |
| Sandbagged discoveries should read "nothing found" (SABREAD) | Check | archive/V3-TASKS.md |

## UI

From the R&D UI phase follow-ups (archive/RD-AUDIT/UI-BUILD.md) unless noted.

| Item | Kind | Detail |
|---|---|---|
| Evals tab still shows raw levels (OQ-6) | Check | UI-BUILD |
| Three SAFETY › Cases limits missing (uitest R10) | Check | UI-BUILD |
| SAFETY › Safeguards as the one home for monitors, safeguard level, KYC | Check | UI-BUILD |
| Overview race "YOU · Atlas-2.10": which model should the lead use | Decide | UI-BUILD |
| Star Hire preview says "no project moves today" for a lasting taste gain | Bug | bal/RECAP-2026-11-27.md §2.6 |
| Skipped readouts: revenue history per product, rival price per sector, win-back previews, licence sellers, spy estimate | Later | UI-BUILD |
| SL1–SL5 labels dropped (mapping not sourced) | Parked | UI-BUILD |
| Codex says "rivals are simplified" (decided 2026-11-16) | Check | archive/LIMITS.md |
| Onboarding: goals rail, coach cards, quarter recap (never built; still wanted?) | Decide | archive/ux/PLAN.md U4.4 |
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
