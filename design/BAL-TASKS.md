# Balance system: task file

Branch `bal`, worktree `C:\Users\david\Documents\projects\AI27-bal`, started 2026-11-25 from master cd352aa.
Background: `../AI27-vision/design/vision/BALANCE.md` and `HANDOFF-BOTS.md` (uncommitted, branch `vision`).

## Scope (designer, 2026-11-25)
- No game-mechanics changes. Registries are metadata; any refactor must reproduce same-seed results exactly.
- Bots and balance tooling in scope. Refits only with designer approval. Rivals: registry tags only; behaviour changes are proposals.

## Working style (experiment)
- Lead: Opus 5.5 (main session): design, briefs, review. Workers: Sonnet 5.5, effort high or medium, never low.
- Small contexts: run and analysis are separate agents; results go to files; reports of about 15 lines.
- Outputs land in `design/bal/` unless a task says otherwise.

## Tasks

| ID | Task | Model / effort | Status | Output |
|---|---|---|---|---|
| B0 | Scout: how constants and targets are organised today | Sonnet high | done | design/bal/B0-SCOUT.md |
| B1 | Registry schema design | Opus (lead) | approved 2026-11-25 | design/bal/REGISTRY-DESIGN.md |
| B2 | Schema + lint + worked examples | Sonnet medium | done, committed 82ff69b | balance/, scripts/v2/registry-lint.ts |
| B3 wave 1 | Inventories: capability, safety-data, market, finance, actors-engine | Sonnet high | done, committed 26474a8 | balance/params/<chunk>.ts, design/bal/inv/<chunk>-notes.md |
| B3 wave 2 | Inventories: models (mod: engine/v2/models, compute), safety-engine (sfe: engine/v2/safety, security), worldfx (wfx), actors-data (acd: data/actors.ts, data/world.ts, data/v2/{rivalModel,blocs,agents}), core (core: engine/v2/{core,departments,endings,events,bots}) | Sonnet high | done, committed 50a69e7 | same |
| B4 | Target inventory | Sonnet high | done, committed 26474a8 | balance/targets.ts |
| B5a | Consolidate ~100 inventory questions into rulings | Sonnet high | done | design/bal/B5-QUESTIONS.md |
| B5b | Lead rulings (balance/CLASSIFY.md), applied by 3 agents (B5c-e) | lead + Sonnet | done | balance/params/*.ts |
| B6 | Target discussion with designer | lead + designer | after B5b | |

Shared brief for all B3 agents: design/bal/INVENTORY-BRIEF.md.

Designer note (2026-11-25): the current calibration targets are probably neither enough nor the right ones. What we calibrate against gets its own discussion (B6). The target inventory only records what exists.

## Experiment log
One row per delegated task: first-pass result (accepted / rework / redo), wall time, notes.

| ID | Result | Time | Notes |
|---|---|---|---|
| B5a consolidate | accepted | 7 min, 129k | 100 questions into 53 items; checked research/07 field by field unprompted; excellent. Left 3 temp files (rm denied). |
| B5c actors-data rulings | accepted | 9 min, 188k | unclear 136 to 4; field-by-field against research/07 and 10. |
| B5d cap/market/finance rulings | accepted | 8 min, 168k | unclear 27 to 8. |
| B5e six files rulings | accepted | 10 min, 202k | unclear 13 to 0; flagged its own judgement calls. |
| B3 actors-data | accepted, lead fixed 2 type errors | 6 min, 137k | 250 entries; 136 unclear from one ambiguous header. Reported typecheck clean for its file, but it had 2 errors (a missing optional and an unused param); the lead fixed them. |
| B3 worldfx | accepted | 6 min, 140k | 80 entries; found values duplicated across files. |
| B3 models | accepted | 7 min, 183k | 66 entries (folder is mostly logic). |
| B3 core/bots | accepted | 10 min, 222k | 160 entries, 88 bot-policy. Found bot comments disagreeing with constants. |
| B3 safety-engine | accepted | 12 min, 264k | 119 entries; found duplicated values and unknown tags [S] [R] [A] [proxy]. |
| B3 actors-engine | accepted | 7 min, 201k | 68 entries; good evidence quotes. Raised the inline-coverage and closure-held magnitudes (RELATION_ACTIONS) issues. |
| B3 safety-data | accepted | 8 min, 180k | 201 entries. Raised the `[C]` tag and header-statement questions (now rulings in the brief). |
| B3 finance | accepted | 11 min, 235k | 190 entries. Found a comment/code mismatch (PROMISE_RESULT +10/-15 vs 30/-30) and duplicated runway thresholds. |
| B3 market | accepted | 12 min, 216k | 346 entries. Found the start difficulty thresholds exist only in a comment. |
| B3 capability | accepted | 12 min, 243k | 342 entries. Ran a full lint once, which rewrote the shared coverage checklist mid-wave (rule added to the brief). Wrote scratch scripts outside the worktree (C:Usersdavidp_tmp). |
| B4 targets | accepted | 12 min, 229k | 152 targets; all 52 CAL2 rows. 16 good questions (coded bands differ from stated targets). Its rm of 3 temp files was denied; left uncommitted for the designer. |
| B2 | accepted, two small lead fixes | 3 min, 73k tokens | All checks pass, self-test catches 5 planted errors. Lead fixes: example params set `actor: 'model'` on world physics (the lead's schema didn't define `actor`; comment added); P05 is `derived`, not `fitted` (the lead's brief was wrong; the agent flagged it). |
| B0 | accepted first pass | 4 min, 97k tokens | All 7 questions answered with file:line; flagged its own uncertainties (src/ui unscanned, _xxx dirs, heuristic counts). No rework. |

## Parked designer decisions (2026-11-25: "prefer not to decide on these now"; don't re-ask unprompted)
- Possible game bugs, comment vs code: B5-QUESTIONS §B (9 items).
- End-screen score provenance: §F6.
- Refactors (one home per duplicated number §C; effect sizes out of closures §D2/D3).
- Target questions §E: these go to B6.
- Six uncommitted temp files left by agents whose deletes were denied (listed in git status).
