# CP4 test checkpoint (full, deep and UI tests before the merge to master)

Branch `cp4-fix` (from rd 3f3ac9a), run in worktree AI27-cp2 detached at ea54385 (cp4-fix after its fixture commits),
2026-11-24. Outputs: %TEMP%/ai27ux/tests/cp4-full.txt, cp4-full-calib.txt, cp4-deep.txt; logs cp4logs/ (copied from
AI27-cp2/.simcache/logs before the deep run overwrote safety.log; the deep safety log is cp4logs/safety-deep.log).
Classified from the logs, BUILD-NOTES and the parked lists; two probes at most per trace, no bisects.

## What ran

1. `fixtures.ts --write` at rd 3f3ac9a (eea1847), then again after the lead fix (ea54385: the lead estimate feeds bot /
   gov / finance choices, so day 400 / 900 and both start fixtures moved; canary unchanged).
2. `run.ts --tier full --workers 10` (incl. test:ui) on ea54385. The runner was stopped by the shell's 60-min limit with
   every job done but `calib` (its last three prefill shards); `--only calib` then ran on the same commit (cache hits
   for the finished shards). Wall ≈ 60 + 20 min under load (the deep prefill overlapped the calib job).
3. `run.ts --tier deep --workers 6` on ea54385: wall 30.2 min.
4. The CP4 commits after ea54385 touch scripts only (one-off `_xxx` checks, which no tier runs, and the research /
   worktypes / ws4 rigs, re-run alone after the fix), so the tier results stand for cp4-fix's tip for src.

## Totals

- tsc main + scripts/v2: clean.
- **test:full: 14/37 jobs ok, 2979 passed, 84 failed** (scripts 2290 / 71, test:ui 689 / 13). Two scripts crashed in
  the run on deleted UI files (research.ts reading panels/Recipe.tsx, worktypes.ts reading panels/Company.tsx): rig
  fix 5ba98f3; re-run alone research 51 / 2 (the two CP3 (a) rows), worktypes 23 / 0. Counts above use the re-runs.
- **test:deep: 21 passed, 2 failed** (S4 as in full; S5 M11 sabotage overconfidence).
- **test:ui: 689 passed, 13 failed** (UB-F: 688 / 14, the same list).
- Classes over the 84 full + 1 deep-only failure: **(a) 60, (b) 12, (c) 8, (d) 5.** 60 + 12 + 8 + 5 = 85.
- After CP4's own rig fix (ws4 C1, 88bece4) ws4 is 22 / 2: 82 full failures remain on cp4-fix's tip.

## (a) Same as CAL2 / known parked item (60)

Parked lists: REVIEW-FIXES "For the rivals session", "Calibration closed" leftovers, "For a dedicated safety session";
CP3.md (a); UB-F's pre-existing UI failures (BUILD-NOTES UB-F "Check"); master V3-TASKS SABREAD.

| Rows | Count | List |
|---|---|---|
| calib T1L ai2027 ×4, authors2026 SC / SAR, fast SAR, slow SC (576 / 745 / 794 / 815; 1462 / 1475; 931; 2614: identical to CAL2) | 8 | rivals session |
| calib T1 authors2026 SAR / SIAR / ASI (1520.5 / 1614 / 1666.5; CAL2 1521.5 / 1711.5 / 1753.5) | 3 | calibration closed (post-SC shape, rival diffusion) |
| fixtures canary SIAR not reached by day 900 | 1 | CAL2 (a) |
| ws4 T3 start lead 220 d, gap after theft 86–99 d; rivals R5, R8 | 4 | rivals session |
| evals EV9 34 / 33 d | 1 | CAL2 (a), designer timing item |
| safety S4 P_mis 0.356 (CAL2 0.377; band 0.40–0.80), full and deep | 1 (also fails in deep; counted once) | safety session (item 3) |
| deep S5 M11: targeted sabotage makes the lab overconfident, −0.64 ± 0.35 se (believed − true U −1.86 vs −1.22) | 1 (deep) | master V3-TASKS SABREAD (known, no tuning) |
| finance F7 $0.94T, F9 FC1 late 2026 $2.09T, F9 FC2 2026 18.6× vs 21.3× | 3 | calibration closed (serving-bound revenue, rivals) |
| hygiene: registry unlisted (safetyFramework, autoSplit); newGame leaderLab ×5 | 6 | CP3 (a); UB-2b "same FAILs as rd 306d4c4" |
| lint-structure "Safety research engineers by need" | 1 | CP3 (a) |
| domainref REF_OFF grep (comments in danger.ts, capability.ts) | 1 | UB-1 note: pre-existing |
| research dud direction 0 drops; assignment 91.5% | 2 | CP3 (a) |
| safetyideas P23 | 1 | CP3 (a) |
| safetyresearch E1 ×3 (worst 50.0%, 0.500 T₁, 45 / 45 d), E2 m_exp no √M | 4 | CP3 (a) |
| suites S2 0.3575, followers 0.357 / 0.357 / 0.894, RL pressure 0.180 / 0.466 | 3 | CP3 (b), values unchanged |
| signals reference post-train S2 0.357, distilled student AF | 2 | CP3 (b), values unchanged |
| products M2 coverage = budget, A5 less engineering compute (13281.9 → 13281.9), C2c tooltip upkeep | 3 | CP3 (a) |
| serving S6 scaffold on internal agents (27.658 → 27.658), A7 day 1 free message 0.02 Wh | 2 | CP3 (a) |
| UI: Products locked tools; Investigations open a case + its card; D8 policy row ×3 days + evalGate term; E11 Remove preview ×2; FIN4a; IA safetyHeader / frameworkHold homes; F6c Retire; F6e targeted training | 13 | UB-F pre-existing list |

Sum 8 + 3 + 1 + 4 + 1 + 1 + 1 + 3 + 6 + 1 + 1 + 2 + 1 + 4 + 3 + 2 + 3 + 2 + 13 = 59 full + 1 deep = 60.

## (b) Calibration moved (12)

| Check | CAL2 / CP3 | CP4 | Likely source |
|---|---|---|---|
| calib T1 ai2027 ASI (20-seed median) | 942 (pass) | **868.5** (want 915 ±44); SC 622 / SAR 784.5 unchanged, SIAR 886 → 847.5 | the post-SAR stretch shortened: HOLD (82bcbe2, framework hold stops new frontier training only) or UB-1 (expert-domain levels feed the framework's Bio / Cyber rules); not separated |
| fixtures canary seed 2027 SAR | 858 | 879 (791 ±44, 2× edge 879) | UB-1 merge (trace (a)) |
| finance FIN3b PBC weeks with a model held | — | 52% (≤ 50%) | framework hold rules (HOLD, RF-S13) |
| oversight decay: oHalf at the SAR level | pass at CP3 | oHalf 4.218 ≈ L12.09 | CAL2-T level knots (sd_SC 2.94) |
| successor pull grows with automation | pass | start ω 0.049, day 400 0.041, day 900 0.234 | fixtures (play since CAL2) |
| data draw: balanced keeps the reference shares, natural specialises in code | pass after CP3 | natural SOCIAL −0.50 … CODE +0.10 | UB-1 domain references (natural draw reads domain levels) |
| suites building fidelity (math 1 → 1.146); RD-B03 computer use suite (broad share 14.3%, ΔG 0.695 → 0.697) | pass | fail | fixtures / RF-P1 tools; verify |
| products P7 companion target users 662M → 652M; A6 no monitors | pass | fail | CAL2-X adoption, RF-S13 package (monitors applied by the framework) |
| serving S5 Logistics 0.098 vs Software 0.081; B7 day-900 per-hour billing cost-plus | pass | fail | CAL2-X / CAL3-A adoption and prices |

## (c) Outdated test (8)

- **ws4 C1 ×2 (CAL2 (c)): fixed, 88bece4.** The rig's candidate is Bio Critical (10.5), where classifiers do not suffice.
  Restated: at Critical the launch is held naming the rule and its external evaluation; midway between High and
  Critical the launch passes with the classifiers the framework adds itself (RF-S13b, models/deployments.ts deployGate).
  ws4 now 22 / 2 (T3 ×2, rivals).
- **products P1 leader start "no features", P7 "a feature whose idea is unknown cannot be built" (Voice & vision is
  built), C2b Voice & vision on the API opens Media work, C2c the leader start carries no feature upkeep (4): RF-P1**
  seeds every lab's day-0 tools from what it shipped by 2025-07-01, so the leader starts with Memory, Computer use and
  Voice & vision. Not fixed (budget): each rig needs a feature the start does not own.
- **products RD-B20 sector adaptation preview (1): RF-P3** (certification lifts friction, not a gate). Probable;
  not verified.
- **control "recovery: stronger oversight raises control" (1):** O_eff 0.856 → 0.968 (+0.11, the check wants +0.2):
  the regenerated day-400 fixture already has the control layer on the research-agent package (seen in _a06), so the
  rig starts near the ceiling. Not fixed.

Also fixed (rig crashes, not counted as checks): research.ts / worktypes.ts read panels/Recipe.tsx and Company.tsx,
deleted by UB-8 / UB-5; they now read KnowHow.tsx and Lab.tsx + LabTabs.tsx (5ba98f3).

## (d) Suspected real bug (5)

1. **control "process: control is lost at ASI exactly when exposure crosses θ_w" and "ASI: a misaligned model under
   strong oversight … without the oversight control is lost" (2):** E reads 0.111 at both 0.9·θ_w and 1.1·θ_w (θ_w
   0.245) and 0.077 / 0.017 in the other: the rig's exposure setting no longer reaches the ending's exposure. Either
   the rig sets a field the ending stopped reading (UB-2 / sight limit) or the ending reads a different exposure; new
   since CP3 (control was 31 / 1).
2. **serving D3 day 1 and day 400 (2):** "below the ceiling nothing changes": 45 of 210 provider offers differ from the
   A2c rule with 0 cells bound. Possibly RF-P5 (one nest per provider) changed the offer set the rule is compared on.
3. **sabotage SAFMECH readout (1):** "readouts use the labour without the hidden sandbag": seen multiplier 1.147 vs
   actual 11357.7 (the check wants seen = the unsabotaged run's seen and seen > actual). The seen value no longer
   follows the experiment multiplier at all: likely RF-R4 / UB-2 (research speed from observed progress) changed what
   the readout reads, which may make this an outdated rig; verify.

## Traces

**(a) Golden canary seed 2027 SAR / SIAR after the UB merges.** Two probes (`fixtures.ts`, SIMCACHE=off) at bfa46a9
(just before the UB-1 merge) and ef5757c (the UB-1 merge): SC / SAR / SIAR 622 / 858 / 893 → **641 / 879 / not by day
900**. So the move comes with UB-1 (the per-domain measurement scale). The suspected cause is ruled out: milestone
detection does not read measured or test-scale levels. `updateMilestones` (models/capability.ts) calls the one work-fit
predicate `milestonesOf` (departments/workfit.ts) on each version's true build (fit vs the whole-job `refDelta` best
human, coverage, cost), which UB-1 left unchanged. The move is indirect. UB-1 gives the expert domains (BIO, CYBER,
SOCIAL, MEDIA) non-zero true `v.domains`, and every reader of those moves with them: framework Bio / Cyber High checks,
danger flags, misuse / exfiltration θ, rival hazards, eval scores (UB-1 "What moves"). That changes the player's holds and
play. UB-1's "moves calibration: no" rested on a worldfx smoke run. The 20-seed T1 SC / SAR are unchanged (622 /
784.5); T1 ASI moved (b). Not a bug. Calibration moved: (b) for SAR; SIAR was already missing at CAL2.

**(b) Measured level reading ~0.16 below true (UB-2b).** Probe 1 (`scripts/v2/_cp4/p_measbias.ts`, day-400 / day-900
fixtures): for every version whose records are on the current bench editions, refitting a **noiseless** bench table
with `applyFit` gives the true level to **0.00**, so the RD-M01 fit (logit inversion, inverse variance, λ map) has no
systematic offset. Adding sandbagging (−1.5·SAND on dangerous benches) gives −0.03 to −0.10. No basic suites were in
the records (the basic suite's −0.2 elicitation would add to it). Probe 2 (`_cp4/p_measmc.ts`, 300 noisy tables per
version with the engine's noise, clip and rounding): mean offsets −0.07 (Atlas-4.0), +0.10 (Atlas-3.5), +0.06
(Atlas-3.0), and taking the weights at the noiseless score changes little. Noise does not make the estimator biased low.
The stored readings are −0.05 to −0.40 below true (Atlas-4.0 −0.40, Atlas-3.5 −0.28), so the offset comes from what
entered the scores when they were measured: sandbagging with the traits of the time, elicitation by suite depth, and
possibly levels that changed after the measurement. It does not come from the fit. Not a clear bug and no small fix;
left as UB-2b's (a) (learn the offset from the predicted-vs-measured record).

## Fixes on cp4-fix

| sha | What |
|---|---|
| eea1847 | fixtures regenerated at rd 3f3ac9a |
| 2679a20 | lead estimate (actors/intel.ts) on the best **measured** version, not the best by true G (a version in testing); readout only, physics unchanged; check `_cp4/lead.ts` (the in-testing version's true G no longer moves the estimates; a lower measured version lowers them) |
| ea54385 | fixtures regenerated after the lead fix |
| 59087e2 | 14 one-off checks: migration parts deleted (`_a05a`, `_a05b`, `_a06`, `_p06`, `_p08`, `_r04`, `_rfs5`, `_sr01`, `_sr06`, `_t01a`, `_t06`, `_t07`, `_t11`, `_x03`); rev-103 pins dropped (`_rfs5`, `_rfs8`, `_rfs14`); drifted live parts restated (`_a06` control per package, `_p06` the old name as a word, `_rfs5` disagreements counted from the fixture's, `_sr01` eval gate part gone with SR-19, `_sr06` width incl. a method's range (RF-S14), `_t01a` P18 as a tree node and the Amplify name, `_rfs14` on day 900 where the method is outgrown, τ 1.00 vs 0.46 at day 400). No check deleted whole; all 16 pass |
| 5ba98f3 | research / worktypes rigs read the panels that replaced Recipe.tsx and Company.tsx (crashes) |
| 88bece4 | ws4 C1 rig restated (CAL2 (c)) |

## Left before merging rd to master

1. The 5 (d): control process / ASI exposure (2), serving D3 (2), sabotage SAFMECH readout (1). Each needs one look to
   tell an outdated rig from an engine change.
2. The 6 unfixed (c): products P1 / P7 / C2b / C2c (RF-P1 day-0 tools), RD-B20 (RF-P3), control recovery (fixture
   already under control).
3. HANDOFF §3: renumber SCHEMA_REV onto master's chain (rd is at 103 with MIN_SCHEMA_REV 103; master has its own
   revs since the branch point), regenerate fixtures after the merge, re-run test:full.
4. Designer / parked: T1 ai2027 ASI 868.5 (new (b), post-SAR shape); S4 0.356; T1L / China / rivals; finance F7 / FC1
   / FC2; EV9; the 13 UB-F UI failures.
5. Scratch left untracked in AI27-rf-s1 (could not be deleted from this session): scripts/v2/_cp4/p_rfs14.ts,
   scripts/v2/_rfs14/check900.tmp.ts.

## CP4b (follow-up on the 5 (d) and 6 (c), 2026-11-24)

Two probes at most per item; only the affected scripts re-run (control, serving, sabotage, products), tsc scripts/v2
clean. None of the five (d) is an engine bug: all are rigs that drifted from the engine, so they move to (c), fixed.

| Item | Cause | Outcome | sha |
|---|---|---|---|
| control process crossing θ_w, ASI weak oversight ((d) ×2) and recovery ((c) ×1) | the regenerated day-400 fixture has the control layer on D4 / capRoutine (O_eff 0.85 at L15), so `lab()` started under oversight: traits scaled to the cap reach only E 0.111 < θ_w 0.245, and strong oversight adds +0.11. Without the layer E is 0.281 | (c), fixed: `lab()` clears the control layer. The ASI determinism check then compares the ending with `resolveAsi` on the ticked state (the framework's package adds the control layer within the tick, packages.ts; E 0.054 after it) | ab34211 |
| serving D3 day 1 / day 400 ((d) ×2) | the rig built each provider's offer without `ud` / `tools`; since RF-P1 every lab has day-0 tools, which `offerOf` counts as coverage (mix.ts passes them): 45 of 210 differed | (c), fixed: offer built as mix.ts builds it; 0 differ | af02184 |
| sabotage SAFMECH readout ((d) ×1) | UB-2: readouts use believed production parameters and measured fits, and the rig's +6 OOM is in the true build only, so seen 1.147 vs actual 11357.7 with or without sabotage | (c), restated: the seen value ignores the sandbag (1.147 at sab 0 and .8) and actual ÷ seen falls with it (10789.7 → 9905.0) | b239c5c |
| products P1, P7 unknown idea, C2b, C2c leader start ((c) ×4) | RF-P1: the leader starts with Memory, Computer use, Voice & vision, Deep research, Coding agent built and on its products; Companion's idea is known, so no leader feature has an unknown idea | restated: P1 each product carries the start's tools for its channel, all built; P7 gate on the spinout start (Memory: "Needs the idea Long context + memory"); C2b Voice & vision added to the API without it (1.465 → 1.491); C2c the start's tools carry the in-use upkeep and nothing else | a80cb10 |
| products RD-B20 sector adaptation preview ((c) ×1) | not RF-P3: the rig hard-coded the old $0.4B certification; CAL-P (b83ce96) set CERT_CASH $4M | restated on CERT_CASH | a80cb10 |
| products C2c Memory in use when off everywhere, C2c tooltip upkeep (CP3 (a) rows, same block) | RD-A06: features no longer act on the internal agents (Agent memory is an internal tool), so Memory off everywhere is idle | restated with the block: in use on a product, keep-alive when off; tooltip = engine (0.115 / 0.012). One CP3 (a) row cleared | a80cb10 |

Re-runs: control all pass (was 3 fails); serving 4 fails (S5, B7 (b); S6, A7 (a)), D3 ×2 pass; sabotage all pass;
products 4 fails (P7 companion users, A6 (b); M2, A5 (a)), was 10.

Note: the sabotage rig's seen vs actual gap (×10⁴) is the rig's true-only +6 OOM, not play; a rig whose measured
level follows the build would test the symptom without the ratio, not needed for the claim.

After CP4b: (c) and (d) are empty. Still before the master merge: "Left before merging" items 3 (SCHEMA_REV onto
master's chain, fixtures, test:full) and 4 (designer / parked). Scratch untracked in AI27-rf-s1: scripts/v2/_cp4b/
(three probes; could not be deleted from this session) plus item 5's two files.
