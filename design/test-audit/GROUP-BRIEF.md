# Phase 2+3 group brief (shared by every group agent)

You own a few test scripts (your group, given in your prompt). For each one, do phase 3 first (make the failures mean
something), then phase 2 (make it cheap). Rules: design/TESTING.md, read it all. Audit detail for your scripts:
design/test-audit/A-unit.md (unit-style scripts) or B-heavy.md (simulation suites); today's failing lines:
design/test-audit/quick-fails.txt; measured quick-tier cost: the table at the end of design/test-audit/quick-run.txt.

## Isolation
Work and commit only in your worktree/branch. Never touch the main checkout C:/Users/david/Documents/projects/AI27 or
other worktrees. Don't stash/reset/checkout other branches. Don't edit src/ (engine/data/UI), run.ts, lib.ts,
simcache.ts, package.json, design/OPEN.md, fixtures, or scripts outside your group: put what you need from them in your
report. Exception: a shared helper you need in lib.ts → describe it in the report, keep a local copy for now.

## CPU (designer's rule)
The machine is shared. Run ONE test process at a time. You may run your scripts in `--smoke` mode or single sections
freely, and a full-mode run of one script if you expect it to take ≤ 3 CPU-min. Anything bigger (a full-mode multi-seed
suite, run.ts with > 1 worker, test:full/ui/cal/deep): stop and ask the lead, who asks the designer. To estimate cost,
count the work (games × seeds × simulated days; ≈ 12 ms per bot game-day) before running anything.

## Phase 3: every failing check gets a class and an action
- **STALE-PIN**: expects an old number/design ("reproduces V1's …", a tuned value from before a redesign). Re-derive
  the expectation from the current spec or source (cite it), turning a pin into a shape check where the number isn't
  sourced; or delete the check if what it guarded no longer exists.
- **TEST-BUG**: the check no longer reaches the mechanism (setup misses a new prerequisite, wrong field, the
  mechanism moved). Fix the test so it exercises the mechanism.
- **CAL-TARGET**: a sourced calibration target (revenue, adoption, milestone dates, equity). The balance session owns
  these: leave the check and threshold as they are, register it in the script's `KNOWN` (lib.ts:
  `KNOWN[label] = 'OPEN.md § Balance: <item>'`), and propose the OPEN.md row in your report.
- **BUG**: the game is wrong (preview ≠ effect, a lever that does nothing, an identity broken). Do NOT fix src/
  (mechanism changes are parked unless the designer says so). Register it in `KNOWN` with a short reason, and propose
  an OPEN.md row (Bug | what, with file:line of the cause if you found it).
- Not sure, or it needs a design judgement: write it as a question in the report. Don't guess.
Time-box each failing check to ~10 min of reading; if it isn't clear by then, classify it as a question.

## Phase 2: cost to budget
Target per script: quick ≤ 20 CPU-s unless it's a central multi-seed suite. In that case the quick form is a real
smoke (≤ 30 CPU-s) and the full form is ≤ 2 CPU-min unless you justify more.
Means: constructed cases instead of simulating to a date (set the state or load a fixture); build once +
`structuredClone`; no rare-event sampling (force the odds); seeds from the band arithmetic (write it in a comment); one
shared game instead of several on the same seed; cache long games via simcache `cached()` keyed on the game, not the
script. Don't weaken what a central check guards: if cutting seeds changes what a calibration check can detect, say so.
Remove vacuous checks (can't fail) and make loops that can see zero cases require ≥ 1. Every script ends with a header
comment: what it guards, cost (sim-days × seeds or "no sim"), tier.

## Done when
Every failing check of your scripts is classified and acted on. Each script's measured cpu (one coarse timed run, e.g.
`/usr/bin/time` or Date.now around it) is at or under target, or you explain why not. tsc scripts gives no new errors.
One commit per script. Report: design/test-audit/<group>-report.md with a table per script (check | class | action |
proposed OPEN.md row), cost before → after (cpu s, quick and full form), what you removed and why, proposed lib.ts/run.ts
changes, open questions. Reply to the lead with ~15 lines. Time budget: given in your prompt; at the budget, commit what
works and report.
