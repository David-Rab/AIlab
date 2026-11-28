# Test cleanup tasks (lead's task file; resume from here)

Branch `testaudit` (worktree AI27-testaudit) collects all work; each task gets its own worktree/branch from it and the
lead merges back. Designer go-ahead for phases 1–3 on 2026-11-28. Rules: design/TESTING.md. **No heavy runs (> ~3
CPU-min, run.ts with > 1 worker, test:full/ui/cal/deep) without asking the designer.** At most 3 agents at a time;
agents run one test process at a time.

Not ours (until bal merged): `directorEndings.ts`,
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
| G7 | uitest.mjs (19 failures; sleeps → waits; day repeats; build skip). Designer: up to 3 whole-uitest runs allowed | merged 777acf9a (19 → 0 fail + 4 KNOWN; 402 → 331 s; 4 questions in G7-report) |
| G3 | serving, products, money | merged cda4d1f9 (quick 484 → ~40 CPU-s; re-applied orphan rigs of e839141; 2 design questions in G3-report) |
| G4 | finance, worldfx | merged 6f33da9d (quick 13 CPU-min → ~1.7; full est. finance 7, worldfx 3.7 CPU-min, not yet run) |
| G2 | research, safetyresearch, safetyideas, evals, worktypes | merged 5fe73d74 (20 fail → 0 + 2 KNOWN; quick 586 → ~97 CPU-s) |
| G5 | safety (S4/S5), safetyrates, sabotage, footholds, control, danger | merged fa40f327 (safety smoke 521 → ~30 s; full ~26 → ~13 CPU-min cold; deep ~36 → ~4) |
| G1 | suites, signals, successor, data, effective, oversight | merged 9a684123 (14 fail → 0 + 1 KNOWN; each ≤ 12 s) |
| G6 | calib remainder, fixtures, lint-structure, levellint, labourinit, rdm01b, milestonepred | merged 47f5412a (all green or KNOWN; calib full = 3 games ≈ 4–5 CPU-min, central: budget 300) |
| G8 | directorEndings, npcShocks | merged ac9dc9ce (dE quick 197 → ~13 s, full ~67 s; npcShocks quick ~14 s) |
| G9 | idle (constructed cases, no bot games), hygiene (cheap contract checks) | merged 7902d978 (idle ~4 CPU-min → 11 s, constructed; hygiene 340 → ~33 s; lost: multi-year read-purity — add a light sweep at a few snapshots of the full sanity game) |

Note: master merged into testaudit 3b233ae8 (bal NPC fixes, schema 127). It brought new untiered tests diffusion.ts, leadread.ts, srefcheck.ts: the P1a orphan guard must list them (add to G6).

OPEN.md rows proposed by groups: collect from design/test-audit/G*-report.md at the end (lead adds them in one commit).

## Calibration out of the tests (designer 2026-11-28: "tests check things work, not calibration"; no game in quick)

Rule: design/TESTING.md §0. Report: scripts/v2/calreport.ts (balance tool; skeleton committed). Balance session told.
Full run of 12:03 stopped (moot). After CR-A/CR-B/G9: lead edits run.ts (drop cal/deep tiers, calib job, shards;
sanity.ts full-only; no played games in quick), then quick (ask) and full (ask), then merge to master (ask).

| id | what | state |
|---|---|---|
| CR-A | milestones (calib.ts → calreport, delete calib.ts), rivals (one band per quantity), safety S4/S5 + safetyrates games; paired safety direction check; new sanity.ts (full) | merged 29a43acc (sanity found the integrated RefBot economy collapse → OPEN.md Balance) |
| CR-B | world (worldfx bands), finance (played-game targets), market (serving sourced start numbers) | merged 7d17068e |

Guards to finish after the merges: lint-known (every KNOWN value names an existing OPEN.md section: "OPEN.md § <Section>: …"; several today say "§ Bugs", which does not exist) — lead, after CR-A/CR-B/G9.

## One home per target (designer 2026-11-28: "we dont want lots of different numbers in different places")

The home is balance/targets.ts (TARGETS, 92 targets; balance session's file). CR-A/CR-B copied bands into calreport/ as
literals: undo that. CR-C (after CR-A): calreport rows reference a target id and read band/unit/source from TARGETS;
checkLabels/metric re-pointed to the report; registry-lint checks every row's id exists and no band literal in
calreport/; missing targets proposed to the balance session (asked 2026-11-28, also about targets.draft.ts).
Then: back-of-envelope estimates (designer's idea): read-only feasibility map first (which targets are computable from
engine functions on the reference path, no game); built on the same ids.
| tiers | run.ts quick/full/perf only (cal, deep gone), calib job gone, sanity in full, default 4 workers | done 29a43acc |
| CR-C | calreport rows read bands from balance/targets.ts by id; new targets added; registry-lint checks ids + no literals; sanity: bounds from registry, day 2200, KNOWN, light read-purity | running (ta-crc) |
| L1 | lint-known: every KNOWN value = "OPEN.md § <existing section>: <row phrase>"; fix existing texts | running (ta-l1) |
| then | send CR-C's new target ids to the balance session; quick (ask), full (ask), merge to master (ask); back-of-envelope feasibility map | — |
