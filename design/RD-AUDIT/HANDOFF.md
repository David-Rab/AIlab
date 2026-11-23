# R&D redesign: handoff (2026-11-23)

The session that built this ran very long and was compacted once. Start from this file and the documents it names, not
from memory of that session.

## State

- **Integration branch `rd`** (worktree `AI27-rd`), HEAD `ad64bff`, SCHEMA_REV 97. tsc (app and scripts) is clean.
  **Master is untouched**, and other sessions share the main checkout `AI27`, so don't edit there.
- **Lanes:**
  - `p3-c2` (`AI27-p2-c`): products. Merged, closed.
  - `p3-d` (`AI27-p3-d`): safety. Merged; it equals `rd` plus **uncommitted, half-done CP3l edits** (7 files: slow compute
    path, golden / calib helpers). Finish or discard them; they are not reviewed.
- **Context compaction anchors.** The last commits before compaction were `rd` `97be985` (RD-T10), `p3-c2` `7e3d60c`
  (RD-P01b) and `p3-d` `5396152` (SR-14). Everything after them was built on summarised context: 148 commits on `rd`, 151
  source files. The designer does not trust that work, so check it against the documents below before relying on it.

## Binding documents (design/RD-AUDIT/)

| File | What it holds |
|---|---|
| DECISIONS.md | Every designer decision: DD-01..21 as amended, safety OD-1..11, CP3 decisions |
| SYNTHESIS.md | Audit, root causes, phases 0–9 with task rows |
| SAFETY-REDESIGN.md | Safety model and SR-01..30 |
| UI-IA.md | Per-tab questions, IA map, vocabulary (§3), 8 open questions (§5) |
| BUILD-NOTES.md | One block per task: what changed, "moves calibration", what is left |
| CP3.md | Checkpoint 3 run: failure classes, calibration targets missed |
| UI-NOTES.md | UI issues found during the engine work |

Done: Phases 0–7 and the safety engine (SR-01..24 and their b-rows), CP1–CP2, CP3 bug fixes and test cleanup. See
BUILD-NOTES for each task.

## What is left

### 1. Finish calibration (CP3)

Status after the last refits (BUILD-NOTES CP3c, CP3g, CP3j, CP3k, CP3f, CP3h, CP3i):

- **Passing now:**
  - frontier G path, h50 doubling, pretraining stack;
  - ai2027 milestones (T1);
  - rival gaps T4;
  - China mean lead T3 (197 d);
  - safety F2, MO, inoculation, anti-scheming, SYC, EV9.
- **Still off:**
  - **Finance / market / world:** full list in CP3.md "Calibration targets missed", not refitted. A refit (CP3m) was stopped
    before committing anything.
  - **Presets:**
    - authors2026 V3_CAL not refitted (sd_SC 2.15 vs sourced 0.5);
    - fast misses SAR;
    - slow is early against the sourced 2034–2035 (the old 2038.5 golden came from the v1 integrator, not a source), and
      its lab ignores the preset's compute growth: the uncommitted CP3l edits on `p3-d`;
    - start M 1.20 (target ≈ 1).
  - **Safety:**
    - S4 P_mis at ASI 0.487 (0.55–0.85); judge again after the presets settle;
    - S5 timing 18% (≥ 50%).
  - **China:**
    - start lead 220 d (150–200), set by the fixed `chinaGapOom` start gap;
    - gap after theft 83–98 d (≈ 60): mostly a timing artefact of the theft day against the player's base cycle.
- **Then:** one lean closing run (CP3 rule), classified like CP3.md.

### 2. Vocabulary, UI and save break (Phases 8–9)

- **Z02: one word per thing.**
  - Start from UI-IA.md §3.
  - The designer has not answered the 8 questions in UI-IA.md §5. OQ-5 ("What binds" reads beliefs) was decided by the
    lead and built (RD-UI0a).
- **Z01: save break.** MIN_SCHEMA_REV is 33.
- **Phase 9 screens:**
  - RD-UI1..7 (COMPUTE, LAB, RESEARCH, TRAINING, MODELS, PRODUCTS, SAFETY) and SR-25..30.
  - Process: audit the real app, then the IA map, then rendered mockups for the designer's approval, then build.
- **Known UI items:**
  - research ETA should come from observed progress (capEta uses the true La);
  - the control readout aiRdShare reads true levels;
  - the lint-ux tooltip check fails.

### 3. Merge to master

- CP4 first: the full, deep and UI tests.
- Master may have moved meanwhile, so renumber the SCHEMA_REV migrations onto master's chain.

### 4. Cleanup

- **Scratch files:** untracked files in the worktrees (`scripts/v2/.tmp-*`, `scripts/v2/_*` probe folders, `.tmp-*` dirs in
  `AI27-p2-c`), plus `C:\Users\david\Documents\projects\_mergetools` and `_cp3k_tmp`.
- **Worktrees to remove:** `AI27-rd-a`, `-rd-b`, `-p1-*`, `-p1-wb`, `-p2-a`, `-p2-b`, `AI27-p2-c`, `AI27-p3-d`, `AI27-cp2`
  (branches `cp2-fix` and `cp3-tests` are merged).
- **Temp worktree** `%TEMP%\ai27ux\wt\cp1b`: its node_modules is a junction to AI27-rd's. Run `cmd /c rmdir` on the
  junction first, then `git worktree remove --force`.
- **Orphaned `calscan` node workers** started from AI27-rd may still be running. Check Task Manager.
- **Scratch dir** `C:\Users\david\AppData\Local\Temp\ai27ux\`.

## How we work (designer's rules)

- **Clear information to the player** is paramount. Use player language only. Each datum has one home; every term gets
  a tooltip. The UI need not mirror the engine.
- **Outcomes are emergent.** A missed target means a missing or mis-tuned sourced mechanism. Never add a forcing rule, a
  per-lab fudge or an invented effect, and never satisfy a rule or lint by faking (no invented costs). Previews must be
  true.
- **Sources** are primary: papers, official docs, code.
- **Rivals** are simplified aggregates built properly: the same laws, stated stand-ins.
- **Tasks** are small and single-concern, each with a time budget. Check the elapsed time on every report, and stop
  overruns. No open-ended bisects.
- **Testing:** per task, run tsc and the task's own check. Heavy runs happen only at checkpoints. Failing tests are
  information, not a gate.
- **Subagents:** Opus. High effort for judgement work, medium for routine work.
