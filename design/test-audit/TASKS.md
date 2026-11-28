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
| P1a | 1 | runner: tsc fix, rivals job, per-job CPU budgets + WARN, orphan guard, add the untiered tests, lib output format, package.json aliases | Sonnet high | todo |
| P1b | 1 | scratch: remove tracked `scripts/v2/_*` dirs (keep _mk6, _w1b until re-pointed), re-point evidence strings, .gitignore | Sonnet medium | todo |
| P1c | 1 | junk inside scripts: removal greps, currency/domainref → effective, rdt10, naming migration, calib T1 guard + INFO loops | Sonnet high | todo |
| P2/3 groups | 2+3 | per script group: classify every failing check (stale pin → re-derive/delete; calibration target → mark + OPEN.md; bug → OPEN.md + KNOWN), then cut cost to budget | Sonnet high | after P1 |
| — | end | one test:full + test:ui (ask the designer first), merge to master | lead | — |
