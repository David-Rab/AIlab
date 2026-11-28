# G2 report (branch ta-g2): research, safetyresearch, safetyideas, evals, worktypes

Wall times (one process, includes ~3 s tsx start; cpu = wall here). Before = quick numbers from the brief.

| script | before (pass/fail, cpu s) | after (quick, --smoke) | after (full) |
|---|---|---|---|
| safetyresearch | 17/9, 53 | all pass, ~18 | same |
| safetyideas | 35/4, 9 | all pass, ~10 | same |
| evals | 27/1, 135 | all pass, ~21 (no RefBot year) | ~22 (adds the 365-d RefBot year, 1 WARN) |
| worktypes | 16/5, 299 | all pass, ~21 | ~63 (adds the 4-year L.data line run) |
| research | 52/1, 90 | all pass, ~25-27 | same (over the 20 s goal: one 220-d lifecycle game with a per-day view read, 3 s risk-policy game) |

tsc scripts: no new errors (scripts/v2/tsconfig.json). One commit per script.

## safetyresearch
| check | class | action |
|---|---|---|
| E1 first result after T1 (+-2%), every line | BUG/question | KNOWN. stepTest adds the science and experiment rates (each 1/30 at reference), so the first result is ~0.44-0.5 T1; agendas.ts:89-106 documents T1. design/bal/SAFETY-UNIFY.md:37 already noted it. Replaced by a check that the stepper equals T1/(sci+exp) (2 lines walked, all lines by formula). |
| E1 pipeline result every (small+val) T1 | STALE-PIN | deleted (no stages since RD-R02b: one test) |
| E1 readouts ETA = T1, cycle 0.8 T1 | STALE-PIN | rewritten: ETA = days to first result, cycle = ETA, second result at 2x |
| E1 compute-bound vs labour-bound | STALE-PIN | cut 1.1 replaced by a ratio (CES near Cobb-Douglas) |
| E1 project in experiments takes SAF_RE_ASK idle engineers | TEST-BUG | L6 pool: takes at least the ask, all from idle one for one |
| E2 copies grow m_exp, no sqrt(M) cap | TEST-BUG | m saturates at the coverage once agents outnumber humans (Amdahl); now tested with scarce copies (1e-5 to 1e-4 of the pool) and saturation |
| E2 low-coverage adds little / sabotage weight small (2 checks) | STALE-PIN | start model SAF_EXP coverage is 17% now (6% before); merged into one check bounded by coverage and by a third of a covering model's share |
| E2 AI taste lifts scientists' taste | TEST-BUG | sd_AI = 3.09 (fit - median)/dBM is -15 SD at +6 OOM; taste rises only past the human median (+20 OOM: +17 SD). Now checks the sign both ways |
Cost: base game per seed cloned, 36 seeds (was 150) for the result-type odds (gap 61% vs 92% >> binomial spread ~7 pts), line tests walked on 2 lines.

## safetyideas
| check | class | action |
|---|---|---|
| P14 fade with capability (<0.6x) | STALE-PIN | direction + <0.9x (observed 0.76x) |
| P15 A > 0.1 | STALE-PIN | A = 0.026 at the day-400 fixture; now A > 0 plus the exact cash identity |
| P23 CoT penalty at L12 | TEST-BUG | version needs G (RD-U02: versionOom reads G, not Lg) |
| F44 raises m_ideas / m_exp x2 | TEST-BUG + STALE-PIN | fixture has no safety scientists on a line (SAF_IDEAS humans = 0), staffed one; the x2 factor dropped (observed 1.04 to 1.19) |
Removed: the lint block (no flat factor, ideas read only in their mechanism, RefBot researches none, only RefBot hands work to AI) and the findings.ts source regex. One-off/hygiene (TESTING s4). If wanted forever they belong in a lint-* script.

## evals
EV9 failure: RefBot release suites wait 29-89 d vs the documented "full 14 d at full staffing" (evals.ts:254) and the ready-date preview (14-24 d at fixtures). Not a sourced target; likely a staffing/queue question (human review takes half the 50 safety engineers) or preview != effect. KNOWN, proposed OPEN row below. The "v2: 14 days fixed" label was a stale pin.
Cost: the real cost was EV2 (900 newGame in a loop whose result fed no check, 78 s): replaced by 3 suites on clones of one game. EV9 quick = day-400/900 fixtures (eval share of research engineers and of the pool) plus day-0 estimates 7/14 d; the 365-day RefBot year runs only without --smoke (about 5 s).

## worktypes
| check | class | action |
|---|---|---|
| coverage lo < 0.3 at G_SC-3 OOM, h50 203 | STALE-PIN | coverage there is horizon-limited (0.59); now 10 OOM below with a long horizon < 0.05 |
| returns: doublings add r_l log10 2 | TEST-BUG | integer R steps vs n0 = 8 gave 1-3% error; steps of 0.1 give 0.5% |
| milestones: RefBot reaches SC to ASI in order | STALE-PIN/dup | deleted (calib T1 and the constructed sweep above it cover it; the game was up to 1825 d) |
| taste: Strong team without AI = 1 | TEST-BUG | called with AI share 1 (start model AI taste ~0); now AI share 0 |
| lint: no player mechanism reads the reference path | TEST-BUG (allow-list) | Rule source: MODEL-V3.md:530 "outside the calibration harness and the rivals' defaults". npc/ is the rivals' successor (labReferenceSplit, growLabStaff); worldfx/revenue.ts reads shareRefAt only in sellerCaps for non-player sellers (MK-8, design/archive/MARKET-CP.md:68 flagged it as needing an allow-list entry). Allowed: npc/ and shareRefAt in worldfx/revenue.ts only. Not a BUG. |
Cost: the 2920-d engine line experiment cut to 4 years (1460 d; slope 0.140 vs r 0.142 still holds) and full-only; no RefBot game.

## research
Failure: "a dud direction fails after 3 dropped candidates": TEST-BUG, P05 is an unlock project (RD-R05); it fails at the works draw. Constructed (test handed all its work, one tick) instead of a 600-d wait.
Other changes: `--rd-r07/e03/r05/a03` run-alone blocks never ran in the suite; they now run (R07 no-result check folded into the lifecycle game; R05 two projects with the test handed almost all its work, was 3 x 900 d; E03 bucket fields now a,s,t after SCALE-DIAG, was a STALE pin that only showed once run). Three RefBot games (240/300/200 d) replaced by the day-400 fixture (B16) and 40 ticks from it (B09 ops served); the 200-d challenger run fed a console line only: deleted. mk() clones a cached base game per seed (assignment brute force built 60 games). Not done: the text-regex checks and source-grep lints (A-unit s4) left in place; they pass.

## Proposed OPEN.md rows
- Bug | Safety line pacing: lineProjects stepTest adds sci + exp rates (each 1/30 of T1 months/day at reference) so the first result at reference inputs comes at T1/2, agendas.ts:89-106 documents T1 (designer: which is right; check `E1 reference inputs ... first result after T1` is KNOWN in safetyresearch.ts).
- Question | RefBot release suites wait 29-89 d in a year (evals EV9, KNOWN in evals.ts) while the preview says 14-24 d: staffing/queue by design or preview != effect (models/evals.ts evalDaysEstimate vs release queue).
- Fixture | day-400 fixture has no safety scientist on a line (safetyideas F44 had to staff one): is RefBot supposed to staff lines at day 400?

## Proposed run.ts / lib.ts
- Budgets: safetyresearch 20, safetyideas 12, evals 25 (full 30), worktypes 25 (full 70), research 30. None needs a lib change. A shared `cloneGame(setup)` in lib.ts would replace the local BASE/mk caches here (research, safetyresearch).
- Reference-path lint (worktypes) should live in a lint-* script once one exists (forever rule).

## Questions
- Pacing (above): contract or stepper?
- Keep the research.ts source-grep lints and wording regexes (they pass, cannot regress), or delete per TESTING s4?
