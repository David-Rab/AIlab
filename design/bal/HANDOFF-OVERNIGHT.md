# Overnight calibration: Stage 1 and Stage 2 (handoff, written 2026-11-27)

You are a fresh session running UNATTENDED overnight. The designer will read your report in the morning. Read this whole file first, then `design/bal/HANDOFF-CALIBRATION.md` §1 (principles), §5 (tools) and §7 (hazards). Don't read more than you need.

## 0. The designer's instructions (binding; quoted)

- "My goal is to finally get the calibration roughly in line with the timelines, not fussing around with small stuff, or getting sidetracked."
- "Unless super crucial, I won't want mechanism changes; they take a long time. We can park them for later."
- The designer wants you to work independently "without doing stupid stuff, going crazy or breaking things… no mechanism changes, just tuning parameters, not doing stupid agent stuff like being overly goal-oriented and no common sense."

So: **"roughly in line" is the bar, not exact.** A miss you can't fix with the allowed knobs is a finding for the morning report, never a reason to change the game.

## 1. Hard rules (never break these)

1. **Branch.** Work on branch `cal` in a new worktree `C:\Users\david\Documents\projects\AI27-cal`, created from master: `git worktree add ../AI27-cal -b cal master`, then `npm ci` there (no node_modules junctions). **Never** commit to, merge into or push master; never touch the main checkout `C:\Users\david\Documents\projects\AI27` except to read. Never `git stash`, `reset --hard`, `checkout` another branch in a shared worktree, or `worktree remove`.
2. **No mechanism changes.** You may NOT edit game logic in `src/engine/**` or `src/ui/**`, add rules, change formulas, or change any test, target or scenario (`balance/targets.ts`, `balance/scenarios.ts`, `scripts/v2/*` checks) to make a number pass. Allowed edits are only:
   - registry/data VALUES listed as knobs in §3 and §4, within their ranges (edit the constant in `src/data/**` and its registry entry's evidence note in `balance/params/**`, in one commit per change);
   - the realistic-lab BOT policy (§4.1): new files in `src/engine/v2/bots/` and its registration, nothing else in the engine;
   - harness/tooling in `scripts/v2/` (e.g. a run mode that forces compute but leaves money live), never a harness rule a player couldn't do, except the explicitly forced calibration inputs that Stage 1 already uses;
   - docs in `design/bal/`.
   If something you need isn't on this list: write it in the report (§6) and stop that line of work.
3. **Ranges are walls.** Never widen a range, invent a range, or pick a value outside it. A knob at the end of its range is a finding.
4. **One change at a time,** one commit each, message stating the knob, old → new value and the run that justified it. Every change must be revertible on its own.
5. **Stop conditions** (stop THAT step, write it in the report, go to the next step if it doesn't depend on it; if it does, stop for the night):
   - a run fails or crashes twice, or a game errors;
   - a result looks absurd (e.g. SC before 2026, ASI never on fast, cash negative with unlimited cash, a value NaN): suspect a bug, don't tune around it;
   - a miss needs a mechanism change or a knob outside §3/§4;
   - two knobs pull against each other (fixing one timeline breaks another): stop, report both;
   - the run budget of a step (below) is spent.
6. **Machine etiquette.** Before any heavy run: `ListAgents` and check CPU (`tasklist | grep -c node`); if another session is running heavy tests, wait (Monitor until-loop, 10-min checks) instead of stacking. Only kill processes you started (find their PID in your run's `running.lock`); never kill other sessions' processes. `--workers` ≤ 8. Background commands stop at 2 h: split long runs; `balrun` resumes from its cache.
7. **Context and agents.** You (Opus) are the lead: decide, brief, verify, report. Use subagents (Sonnet 5.5 high; never low) for runs and analysis with tight briefs (memory `subagents`). A run and its analysis are separate agents; results go to files; reports ≤15 lines. Verify key numbers yourself before acting on them.
8. **Parked items stay parked.** Don't work on anything in `design/bal/RECAP-2026-11-27.md` §2 or memory `ai27-balance-deferred`. If you hit one, cite it and move on.

## 2. State at handoff

- Master contains: the labour round (`design/bal/LABOUR-ROUND.md`, sources `LABOUR-SOURCES.md`), the data-centre redesign (`design/dc/`, calibration items in `design/dc/CALIBRATION-NOTE.md`), the NPC headline labs (merged by the NPC session before you start; read its notes only if a run points there), and the override tooling for P24 and the SIAR→ASI gap.
- Last measurement: M3 (`balance/runs/M3`, before the labour round): fast fit (12/17 within band), central 10/18, slow 6/18; the cause of earliness (P24's fresh pool) is fixed since. Paired analysis method: `.scratch/m3paired.py` on bal (copy it if needed; it uses the aifm-runs venv with `python -I`).
- Recap of the day: `design/bal/RECAP-2026-11-27.md`.

## 3. Stage 1: the player's research engine against the timelines (forced inputs)

Forced runs: the AIFM's compute and staff path go in (staff are hired through the market by targets + premium, as a player could), cash is unlimited. Question: given the source's inputs, do the milestones land where each game's own drawn AIFM run puts them?

**Step 1.1, M4 (1 run).** `npx tsx scripts/v2/balrun.ts --name M4 --forced aifm --policy reflines --world tl-fast,tl-central,tl-slow --seeds 12 --workers 8` (about 1.5–2 h alone; split if needed), then `npx tsx scripts/v2/s1compare.ts M4`, then the paired residuals (game − its drawn run, per milestone and interval, median and IQR per timeline), then `npm run bal:dash -- --runs M3,M4`.

**Done when (Stage 1 bar):** per timeline, the median paired residual of SC, SAR and ASI is within ±0.5 y for fast and central and ±1 y for slow, and the SC→SAR and SAR→ASI medians are within the drawn runs' own IQR. If M4 meets it, Stage 1 is done: no fitting.

**Step 1.2, fit (only if 1.1 misses; at most 3 runs).** Allowed knobs, nothing else:

| Knob (override id) | Default | Range | What it moves |
|---|---|---|---|
| `cap.TREE.P24.mean` | 0.12 | 0.03–0.12 | P24's per-idea strength (hand-fitted to an old lump; no source) |
| `cap.TREE.P24.rShare` | 0.3 | 0.1–0.3 | P24's share of returns |
| `cap.ASI_EXTRA_GAPS` | 1.3 | 0.9–1.85 (AIFM 12–15 SD) | the SIAR→ASI gap only |

(Check the exact ids with `npx tsx scripts/v2/paramOverride.ts --census --ids`.) Per-game draw values (SC threshold gSC, r, dBM, La, Ca, …) are source draws: **never** change them. Procedure: a sweep on tl-central only, 12 seeds, 3 values of the one knob that matches the miss (games early before SC → P24 mean; ASI too early/late after SIAR → ASI gaps), via `--sets` (one cell per value); pick the value closest to the bar; one confirming run on all three timelines. If the confirming run misses the bar, report and stop Stage 1 (don't keep sweeping).

**Commit** the chosen value(s) in the data file + registry note; regenerate nothing else.

## 4. Stage 2: the full coupled game (money pays for compute and staff)

Nothing forced: the lab earns, raises, buys compute (data centres), hires at market wages. Question: does a lab that behaves like a real one end up with roughly the AIFM's compute and staff paths, and so roughly its timelines?

**Step 2.1, the realistic-lab policy (design, then bot code).** Write `design/bal/REALISTIC-LAB.md` (≤150 lines): how a real frontier lab 2023–26 behaves, as rules the bot follows: share of revenue + raised money spent on compute, how compute is acquired (rent / build) and lead times, headcount growth per kind (the AIFM staff path is the reference), experiment vs training compute share (existing split matching real labs), release cadence, when it raises and how much. **Primary sources only** (filings, official data, papers; memory `primary-sources`); reuse `design/bal/LABOUR-SOURCES.md` and `design/dc/`. Anything unsourced: use the existing reference bot's behaviour and mark it `[unsourced]`. Then build it as a new bot policy (`--policy realistic`) in `src/engine/v2/bots/`, using only actions a player has. Test: a 1-seed game on tl-central completes, and the policy log shows it buying compute, hiring and raising. Budget: one design pass, one build task, one fix pass.

**Step 2.2, close the loops one at a time** (each 1 run: 12 seeds, tl-central first; all three timelines only for the last):
- (a) money live, compute still forced (add the harness mode if missing: tooling only). Check: the lab can afford the forced path (cash never forced negative / no emergency), payroll and compute shares of spending within sourced ranges, the shared 2023–26 history checks (`balance/scenarios.ts` H-series: revenue, compute, headcount, valuation) in band.
- (b) compute bought through data centres, staff hired by the policy. Check: the lab's compute per year within ±0.3 OOM (×2) of the AIFM path to 2030; staff within ±30% of the path.
- (c) everything live, all three timelines. Check: milestone medians within ±1 y (fast, central) and ±2 y (slow) of the timelines.

**Step 2.3, fit (only what misses; at most 2 sweeps + 1 confirm per loop).** Allowed knobs: registry entries (`balance/params/finance.ts`, `market.ts`, `actors-*` excluded, data-centre entries) whose `kind` is `fitted` or `stand-in`, within their recorded range, or ×0.5–×2 of today's value if none is recorded; `sourced` values only inside their recorded source range. **Never** `designer` values: list a designer value you think is the cause in the report. First write the candidate knob list (id, kind, value, range, what it moves) to the report before any sweep. Policy parameters of the realistic bot may be adjusted only within the ranges written in REALISTIC-LAB.md from its sources.

## 5. How to decide (common sense)

- Fix the biggest miss first; one knob per miss; prefer the knob that moves the miss and little else.
- If a result is far off (more than 2× the bar), first check the run is right (forced inputs on, the right worlds, seeds, the override recorded in config.json) before fitting.
- Distributions, not just medians: note the spread; don't tune the median while the spread is absurd.
- "Roughly in line" is enough. Stop when a step meets its bar; don't polish.
- If unsure whether something counts as a mechanism change: it does. Report it.

## 6. The morning report

Keep `design/bal/OVERNIGHT-REPORT.md` updated as you go (commit it after each step), plain English, short:
1. Headline: where each timeline lands now vs the forecast (a small table), and whether each stage met its bar.
2. What ran (run names, games, wall time).
3. Every change: knob, old → new, why (the run), commit hash.
4. Findings: misses you couldn't fix with the allowed knobs, absurd results, suspected bugs, mechanism changes you'd suggest (no code), designer values you think matter.
5. What's next.
Build the dashboard with all runs (`npm run bal:dash -- --runs M3,M4,...`) and say which tab and run to open. Also update the "Plan after M3" status in `design/BAL-TASKS.md` and the memory `ai27-bot-tooling-handoff` (one line).

## 7. Run budget for the night

Stage 1: at most 1 + 3 + 1 runs. Stage 2: 1 policy build, then at most 3 loops × (1 + 2 + 1) runs. If the night runs out, stop cleanly at a step boundary with the report current. Better to finish Stage 1 well and Stage 2 (a) cleanly than to rush everything.
