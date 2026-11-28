# Test cleanup tasks (lead's task file; resume from here)

Branch `testaudit` (worktree AI27-testaudit) collects all work; each task gets its own worktree/branch from it and the
lead merges back. Designer go-ahead for phases 1–3 on 2026-11-28. Rules: design/TESTING.md. **No heavy runs (> ~3
CPU-min, run.ts with > 1 worker, test:full/ui/cal/deep) without asking the designer.** At most 3 agents at a time;
agents run one test process at a time.

Not ours: `idle.ts`, `hygiene.ts` (branch `speed` has rewritten them, and also drops the `rivals` job); `directorEndings.ts`,
`npcShocks.ts` (branch `bal` edits them: only trivial edits there, merged last). Calibration targets belong to the
balance session; mechanism fixes are parked (designer 11-27): real bugs go to OPEN.md, not fixed.

Unanswered (kept as is): `botfingerprint.ts`, `ref-trace.ts`, `aifm_phase.py`, untracked `_sabtmp/` in the main checkout;
`test:cal` kept as a tier but with nothing binding until golden days exist.

| id | phase | what | model | state |
|---|---|---|---|---|
| P1a | 1 | runner: tsc fix, rivals job, per-job CPU budgets + WARN, orphan guard, add the untiered tests, lib output format, package.json aliases | Sonnet high | merged ef0d3c2f |
| P1b | 1 | scratch: remove tracked `scripts/v2/_*` dirs (keep _mk6, _w1b until re-pointed), re-point evidence strings, .gitignore | Sonnet medium | merged 4f7a55ca |
| P1c | 1 | junk inside scripts: removal greps, currency/domainref → effective, rdt10, naming migration, calib T1 guard + INFO loops | Sonnet high | merged bed143e4 (T2 "AI labour at SC" check went with the T2 block: G6 to restore it from the existing T1 game) |
| P2/3 groups | 2+3 | per script group: classify every failing check (stale pin → re-derive/delete; calibration target → mark + OPEN.md; bug → OPEN.md + KNOWN), then cut cost to budget | Sonnet high | after P1 |
| — | end | one test:full + test:ui (ask the designer first), merge to master | lead | — |

## Phase 2+3 groups (one agent per group does both: classify failing checks, then cut cost)

| id | scripts | state |
|---|---|---|
| G7 | uitest.mjs (19 failures; sleeps → waits; day repeats; build skip). Designer: up to 3 whole-uitest runs allowed | running |
| G3 | serving, products, money | running (ta-g3) |
| G4 | finance, worldfx | merged 6f33da9d (quick 13 CPU-min → ~1.7; full est. finance 7, worldfx 3.7 CPU-min, not yet run) |
| G2 | research, safetyresearch, safetyideas, evals, worktypes | after P1 |
| G5 | safety (S4/S5), safetyrates, sabotage, footholds, control, danger | running (ta-g5) |
| G1 | suites, signals, successor, data, effective, oversight | after P1 |
| G6 | calib remainder, fixtures, lint-structure, levellint, labourinit, rdm01b, milestonepred | after P1 |
| later | idle, hygiene (after speed merges), directorEndings, npcShocks (after bal merges) | — |

Note: master merged into testaudit 3b233ae8 (bal NPC fixes, schema 127). It brought new untiered tests diffusion.ts, leadread.ts, srefcheck.ts: the P1a orphan guard must list them (add to G6).

OPEN.md rows proposed by groups: collect from design/test-audit/G*-report.md at the end (lead adds them in one commit).
