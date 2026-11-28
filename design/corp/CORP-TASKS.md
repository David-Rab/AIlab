# Corporate structure: tasks

Spec: [CORPORATE.md](CORPORATE.md). Audit: [DEALS-AUDIT.md](DEALS-AUDIT.md). Designer approved the spec 2026-11-28
("ok, ready to go").

The base branch is `corp` (worktree ../AI27-corp). Each task gets its own branch and worktree from `corp`, named
`corp-<id>` in `../AI27-corp-<id>`. The lead merges back into `corp`, sorts out SCHEMA_REV and regenerates fixtures.
Task agents never edit save.ts/SCHEMA_REV or fixtures: they report what needs changing. Tests failing mid-build are
information. Each task runs tsc plus its own targeted test; heavy runs happen only at the checkpoint (C9).

| ID | Task | Model | Budget | Depends | Status |
|---|---|---|---|---|---|
| C1 | Control model as a pure module: charter state, share classes, holdings and votes, emergent controller, `seatsOf`, label, rights, investor appeal; constructed-case test `scripts/v2/corp.ts`. No readers switched yet | Sonnet high | 60 min | — | done 9a351393 (3 min) |
| C2 | Replace presets with the charter: delete GovernancePresetId, `board.preset`, `safetyCommitteeVeto`, initialBoard, startBoard, syncFinancialSeats, the listing seat, the rescue's addSeat; board seats come from `seatsOf` (critics as stored extras); every preset reader goes through control.ts; big-tech start = Azimuth 100% voting; Setup's Governance picker removed (leader = mission + profit cap) | Opus high, reason (c): cross-cutting core state, ~30 files | 100 min | C1 | done 8d3a7655 (25 min) |
| C3 | What a controller changes: `ownerFunded` replaces isDivision/divisionBlock/noOuster; the ouster under every board; a company taking control mid-game becomes a parent (budget year 0 = last 4 quarters' spend, parent goals); 'acquired' removed; the "another lab in control" ending (a lab controller, or folded in by the controller's leading lab); every path that raises one holder's stake judged at the stake it reaches | Opus high, reason (c) | 100 min | C2 | running (corp-c3) |
| C4 | Government: the soft path (golden share = 2 gov directors + security approval; staff pooling beside the compute); the hard path (state control if the player leads, fold-in loss if behind); government goals and budget through the owner-budget rule | Sonnet high | 75 min | C3 | |
| C5 | Positions and lab kinds (engine): the five position rows with the scattered per-start knobs; the six lab kinds with charter and cap table; the companies cast (Northwind, Azimuth, Silica, the Meta-like parent) and who owns or backs each lab; the big-tech kind replaces Azimuth's in-house NPC lab | Sonnet high | 90 min | C2 | |
| C6 | Setup UI: lab-kind row, Custom (charter, cap-table preset, position), the live board and label preview, Rivals owner/backer pickers | Sonnet high | 75 min | C5 | |
| C7a | Partners, deal shape: equity for a dollar commitment (4×E), tranches on commitment spent, custom chips inside the commitment; strings that end with the deal and preview their cost; rescue priced by distress from the partner that values you most; remove Corvid, sovereigns, anchoring, `anchors`, "served first" (the 50%-vote part moved to C3) | Sonnet high | 120 min | C1 (parallel with C2) | done 33442196, aae5bb7e (25 min) |
| C7b | Partners act: one interest per partner (spend, nearness of its own lab, backing a rival), dependence, renewals at deal end, follow-on offers as actions; count running deals | Sonnet high | 75 min | C7a, C5 | |
| C7c | Distribution: the partner's channel adds API/enterprise reach and takes a cut of that channel only (replaces the 8% revenue share); the legacy Northwind stake's all-revenue share, projected | Opus high, reason (a): touches the products model, choices while coding | 100 min | C7a | running (corp-c7c) |
| C8 | UI: Board card header and "who controls you" row, owner budget and goals in the card, Partners card, previews (after-state board and controller), glossary in player words | Sonnet high | 90 min | C4, C7b | |
| C9 | Checkpoint: test:full; bot runs for difficulty labels per lab kind; the deal-balance check (offer script: no free money, no never-worth-it); target F8 re-judged | Sonnet high (runs) + lead (judgement) | 120 min | C1–C8 | |
| C10 | Cleanup (spec §9) | Sonnet medium | 45 min | C9 | |

## Notes
- 2026-11-28: C5 split. **C5a** (positions + lab kinds + minimal setup; Sonnet high, 120 min) is running in corp-c5a. **C5b** (the companies cast incl. the Meta-like parent, who owns or backs each lab, Create-rivals owner/backer data) comes after C5a.
- C2 choice (accepted): only the CEO's seat always votes yes; founder directors vote their lean on major decisions and always no on an ouster.
- C7a follow-ups for C7b: the Azimuth custom-chip commitment lands in 8 quarters (first year ≈ 4× the leader's revenue); spread it over the deal's 6 years like cloud. The bots' `exclusive: true` is silently dropped when it isn't on offer.
- Fixtures are stale since C1 (no `charter`, still `preset`/`seats`). Designer 2026-11-28: wait with the regeneration; it must not block development. Task tests use constructed states (newGame), not fixtures. Regenerate at the checkpoint (C9), with the designer's go. SCHEMA_REV bump at the merge to master.
- C7a left two untracked temp files in ../AI27-corp-c7a (scripts/v2/_c7atmp.ts, _c7adbg.ts); the delete was blocked by permissions. Harmless; they go when that worktree is removed.
