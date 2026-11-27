# Outside world: tasks

Spec: [OUTSIDE-WORLD.md](OUTSIDE-WORLD.md). Designer's words: [SESSION-HEAD.md](SESSION-HEAD.md). Inventory:
[INVENTORY.md](INVENTORY.md).

The base branch is `world` (worktree ../AI27-world). Each task gets its own branch and worktree from `world`, named
`w-<id>` in `../AI27-w-<id>`. The lead merges back into `world`.

## Designer's answers to spec §13 (2026-11-27)

| Question | Answer |
|---|---|
| Q1 attention rule | ok |
| Q2 support channel | yes, if not too complicated; otherwise drop |
| Q3 laws list | ok |
| Q4 hiring pull | one approval |
| Q5 evaluators and Index | fold, as drafted |

**Acceptance test (designer):** "a world without a player", run in each timeline, to see what happens. Built as
W10:
- The player is an observer: the weakest start, an idle policy, and player-only endings switched off for the run (a
  harness switch, since an observer can't play).
- Only world endings can end the run.
- Each timeline (fast, central, slow) is run with the middle alignment setting.

The output is a per-quarter world log covering:
- the frontier and milestones;
- the US stage and laws;
- concern and unemployment;
- China's tension and talks;
- Taiwan shocks;
- the ending.

An observer run checks the world-level half (S1, S3–S7). S2 (a leading player) is checked separately with RefBot.

## Scope (refocus, 2026-11-27; SESSION-HEAD §10)

Core: W1b–W1e, W1f, W2, W4–W7, W10. Ride-along: W1f setup. After the test: W14 plans check, W8 UI (minimal stub
before), W11 cleanup. Parked: W12. Rule: leave the code cleaner than we found it ([[leave-code-cleaner]]).

## Order

Tasks run one after another where they touch types.ts or core state. W9 runs in parallel from the start.

| # | Task | Model | Budget | Depends | Status |
|---|---|---|---|---|---|
| W1a | Move what geoQ hosts (NPC finance, copyright suits, Taiwan and Korea rolls) into their own systems; behaviour identical | Sonnet high | 45 min | — | done 0c17a262 |
| W9 | Primary sources for the calibration targets → SOURCES.md | Sonnet high | 60 min | — | done cf5ef02f |
| W1b | Economy: delete macro.ts, add the readouts (spec §4) | Sonnet high | 60 min | W1a | done e72ac062 |
| W1c | Quiet world, engine part 1: delete public, blocs, relations, research bodies, Safety Index, relation actions; neutral stand-ins (INVENTORY §3) | Opus high, reason (c): cross-cutting core state, about 40 files | 90 min | W1b | running |
| W1d | Quiet world, engine part 2: delete the gov and China actors (meters, ladders, presets, policy flags), keeping the China lab; the dated laws table; stand-ins | Sonnet high (W1c sets the pattern) | 75 min | W1c | |
| W1e | Quiet world: bots, UI stubs, glossary, tests and fixtures re-baselined | Sonnet high | 75 min | W1d | |
| W2 | Shared inputs module (spec §3) | Sonnet high | 45 min | W1e | |
| W3 | (folded into W1b) | | | | |
| W4 | Public (spec §5) | Sonnet high | 60 min | W2 | |
| W5 | US government (spec §6) plus the support channel if it is one factor on permitting | Opus high, reason (a): thresholds chosen while coding | 90 min | W4 | |
| W6 | China government (spec §7) | Sonnet high | 75 min | W5 | |
| W7 | Events and levers pass (spec §8) | Sonnet high | 60 min | W6 | |
| W10 | Observer runs × 3 timelines, plus the S1–S7 checks | Sonnet high (build), then the lead analyses | 60 min | W7 | |
| W8 | UI: one "Powers" home, World tab trimmed (skill good-ui) | Sonnet high | 90 min | W10 | |
| W1f | Setup cleanup (spec §14): delete baseline, economy presets, storyteller; move the lab start values into start types; Setup UI | Sonnet high | 60 min | W1d | |
| W11 | Cleanup: split ws4 to its owners, dead code, docs | Sonnet medium | 60 min | W8 | |
| W12 | PARKED (refocus): AI 2027 sweep beyond the outside world → design/OPEN.md. Kept: list the AI 2027-sourced lab parameters for `bal` at merge | — | — | merge | parked |
| W13 | Read the AI Futures plans A–D → PLANS.md, mapped onto the spec (§16) | Sonnet high | 60 min | — | done 8ed8cc37 |
| W14 | Plans A–D check after W10: can each plan happen? Add at most the treaty compute cap | lead | — | W10 | |

## Log

(one line per finished task: id, model, time, result, merged commit)
- W1a · Sonnet high · ~7 min · geoQ extras moved to geoShocksQ 441, copyrightQ 442, npcQ 443; fixtures identical · 0c17a262
- W9 · Sonnet high · ~9 min · SOURCES.md: BLS, BEA/CBO, Pew/Gallup, BIS steps, SB 53/RAISE/EU/SB 243, EO 14318, AI 2027 beats.
  Corrections: research/07's "67%" is 47% (Pew Mar 2026); the companion law restricts rather than bans; the RAISE
  chapter amendment is [unverified] · cf5ef02f
- W1b · Sonnet high · ~20 min · macro.ts → economy.ts (GDP growth = G_BASE + λ·Δautomation + techs − shock, λ 0.6; AI
  share of income). Unemployment is identical at days 0–900; US growth is +0.4 pt from G_BASE 0.022 (CBO). Inequality
  is out of scoring. SCHEMA_REV 117 · e72ac062. Lead fixed a param anchor and the hygiene system table · bd71dcf5.
  Moves calibration: yes (growth term), for `bal` at merge.
- W13 · Sonnet high · ~3 min · PLANS.md: Greenblatt A–E (Oct 2025) and AI Futures "AI 2040: Plan A" with A/B/C+/C/D/S
  (Jul 2026). Proposes 4 minimal additions; designer to decide. Quotes came through a summarising fetch; re-check before
  using them in game text · 8ed8cc37
