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

## M2 step 5 status (2026-11-14, updated at each checkpoint)

Checkpoints: bf93f24 (5a tick speed, hygiene), 0987ced (5b lead metric, theft, China), c0594e5 (5c S1, safety),
25ad13c (5d releases/serving, rivals release, worldfx).

| Script | Status |
|---|---|
| tsc (app + scripts/v2) | green |
| golden-timelines, identity, fixtures, lint-hidden, lint-tradeoffs, money | green |
| hygiene | green (idle daily tick ≈ 0.85 ms avg, worst quarter tick < 8 ms) |
| safety | green (≈ 11 min: S4/S5 play many full games) |
| worldfx | green (≈ 2 min) |
| ws4 | green (≈ 3 min) |
| calib | T1 slow SC refit (calShift slow −0.165 → −0.197), re-running |
| finance | failing: F7 2026 capex (median $127B, want ≥ 150), F7 end-2026 valuation (median $0.74T, want ≥ 1T), F8 distress-free share (67%, want ≥ 75%); F10 test fixed (director off), not yet re-run |

Earlier history: at HEAD f8ff4c9 calib, hygiene and ws4 failed and safety/finance/worldfx timed out. The integration
agent stopped twice (network error, session limit); its WIP was snapshotted to `refs/wip/m2-step5-1` (9d73814).

## Leftover worktrees

`.claude/worktrees/agent-*`: the original workstream worktrees. Their branches are fully merged and can be removed once M2 is committed.

## Working rules (learned)

- **Concurrency:** run at most 1-2 agents at once.
- **Model choice:** Opus for all work, including every agent, at medium or high effort (user instruction). Manage usage by limiting concurrency, not by switching models.
- **Commit often:** agents commit at each green checkpoint; otherwise snapshot WIP to `refs/wip/*`.
- **Logging:** update this log at every milestone.
