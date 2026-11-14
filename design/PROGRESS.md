# v2 build progress log

Single source of truth for where the build stands. Update at every milestone or interruption.
**On "resume": read this file and run `git status` / `git log` before doing anything.**

## Milestones

| Milestone | Status | Commits |
|---|---|---|
| Research (12-17) and spec | Done | research/12-17, design/V2-SPEC.md, design/v2-interfaces.ts |
| M0 contract | Done | 7eeddc7 |
| M1 workstreams WS1-WS5 | Done, merged | 98b4399 (WS1), 3005c2c (WS2), 623cf51 (WS3), 551bf96 (WS5), ea01d6d (WS4) |
| M2 step 2: state extensions folded into types.ts | Done | 3a42f84 |
| M2 step 3: single finance ledger | Done | fc2ae9f |
| M2 step 4: cross-workstream wiring | Done | 98c20cf, 0d0b808, c067c50, f8ff4c9 |
| M2 step 5: whole `npm run test:v2` green, tick performance, bot table | **In progress** | uncommitted; snapshots under `refs/wip/m2-step5-*` |
| M3 UI shell and panels (WS6, WS7) | Not started | |
| M4 calibration and balance (bot criteria) | Not started | |
| M5 polish, tutorial, codex, v1 removal | Not started | |

## M2 step 5 status (2026-11-14)

Failing at HEAD f8ff4c9:
- **calib:** T1 slow SC about 3 months early; two China-lead checks (the uncommitted work fixes the latter).
- **hygiene:**
  - stream isolation (safety, market);
  - cadences over 2 years;
  - tick about 1.5 ms per day.
- **ws4:**
  - E3 true lead;
  - E5 endings ousted and asiContested unreachable;
  - T3 China lead band, and the lead after a theft.
- **safety, finance, worldfx:** too slow (more than 10 minutes each).

The integration agent stopped twice:
1. on a network error (ECONNREFUSED);
2. on a session usage limit.

Its edits are in the working tree and were snapshotted to `refs/wip/m2-step5-1` (9d73814).

## Leftover worktrees

`.claude/worktrees/agent-*`: the original workstream worktrees. Their branches are fully merged and can be removed once M2 is committed.

## Working rules (learned)

- **Concurrency:** run at most 1-2 agents at once.
- **Model choice:** Opus for all work, including every agent, at medium or high effort (user instruction). Manage usage by limiting concurrency, not by switching models.
- **Commit often:** agents commit at each green checkpoint; otherwise snapshot WIP to `refs/wip/*`.
- **Logging:** update this log at every milestone.
