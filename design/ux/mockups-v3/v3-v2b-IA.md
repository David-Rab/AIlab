# V2b: research projects, recipe, work and AI labour (IA note)

Files: `v3-v2b-research.html` (render: `node design/ux/mockups-v3/render-v2b.mjs`), `v3-v2b-research.png` (Research ›
Projects), `v3-v2b-recipe.png` (Research › Recipe), `v3-v2b-work.png` (Company › Work). Data: the day-400 fixture. Brief:
design/archive/V3-BUILD.md "V2b UI". The mockup is the layout sketch; the build is the reference (the user reviews both together).

## What the player steers (MODEL-V3 §14)
Research: the order of the capability projects (drag or ▲▼), teams wanted per project (0 … 6, "max"), the lab-wide risk
policy, add a project, reopen a failed one as speculative. Company › Work: research engineers' and engineers' needs in
priority order with an optional cap per need (a team count or a share). The game does the rest (candidates, stages,
team assignment with a "why" per team, research engineers and FLOP per project, adoption by engineers).

## Screens and first glance (L1)
- **Research › Projects** (default tab): the priority list (one row per capability project: rank, name, kind, stage
  track ideation → small experiments → scale test → result → adoption, teams wanted, what binds it, next result) and the
  selected project's card (L2: stage track with labels, belief band vs the next prior, odds, inputs c and ℓ with what
  binds, pool for lines, teams and why). Risk policy and "+ Add project" sit on the list header (controls next to what
  they change).
- **Research › Recipe**: one card per stack group (pretraining, RL, serving & systems): stack efficiency now, what the
  internal model embodies and the gap not trained in, headroom left for routine tuning, the adopted ideas (believed band
  → realised value once a model trained after it is evaluated). Header: the software rate (OOM/yr, ideas/yr).
- **Research › Tree**: the existing tree (discovery map); the node card adds a project to the list, removes it or reopens
  it. No team picker any more (the game assigns teams).
- **Company › Work** (new tab): one card per role / work type (engineers · software engineering, research engineers ·
  experiments & runs, scientists · research ideas & taste): effective labour (hero number, ×m with AI, humans vs what AI
  adds), the model's fit on a shared axis against the median expert and the best human, coverage against the 90%
  milestone mark, and "where it goes" (needs in priority order with caps and overflow). Below: the milestone ladder with
  the distance to each criterion on the closest live model. Safety experiments: one line, used by the safety agents
  (link to Safety).
- **Company › Flow › Research speed** (rebuilt): research speed vs the leader lab's day 0 (hero), the AI R&D multiplier
  M and its parts (AI labour, AI taste), what binds a unit project (compute- or labour-bound, c and ℓ), the three levers
  (+10% experiment compute, research engineers, research agents) and the limits (pause, diffusion, serial speed).

## Datum → level → home

| Datum | Level | Home | Elsewhere |
|---|---|---|---|
| Project order, teams wanted, risk policy | L1 control | Research › Projects list | Tree node card: add / remove only |
| Project stage and progress in the stage | L1 | Projects row (track) | Tree node: unlabeled progress ring |
| Belief band, scale behaviour, odds, drops | L2 | Project card | Row: odds chip for ideas only |
| Project inputs (RE, FLOP/day, c, ℓ, X, binds) | L2 (binds L1) | Project card | Row: binds chip |
| Line pool (realised OOM, ideas harder ×, next prior, input) | L2 | Project card | Row sub-line: ideas and realised OOM |
| Why each science team is where it is | L2/L3 | Project card team list; idle teams in the list footer | Company › Agents & teams: team cards link to Research |
| Stack efficiency, headroom, gap not trained in | L1 | Research › Recipe | Blueprint "behind at finish" (its own datum: during a run) |
| Adopted ideas: believed → realised | L2 | Recipe card list | Alerts (results) |
| Software rate (OOM/yr, ideas/yr) | L1 | Recipe header | — |
| Research speed, M and parts, binds, levers | L1 | Company › Flow | Research header and Agents: link chips |
| Effective labour per work type, ×m, humans vs AI | L1 | Company › Work role cards | Agents lanes: compute and copies only (package controls) |
| Build capacity (= effective software labour) and its split | L1 | Company › Work, engineers card | Teams pile, Products, Models: link chips |
| Fit vs median/best human, coverage, horizon, success at H, win rate, assist, copies, speed, AI FTE, humans' share | L1 (fit, coverage) / L3 (rest) | Work role card and its tooltips | — |
| Needs, caps, order, overflow (RE and engineers) | L1 control | Work role card "where it goes" | Research header: link chip |
| Milestone criteria distances | L1 | Company › Work milestones | Top strip: milestone marks only |

## Removed (v2 concepts)
Know-how bar and "+N months not trained in" (now the recipe gap in OOM), "× frontier" / "× the leader's labour" ratios,
"Frontier methods" and "Serve-cost benefit" speed limits, the 1 − (1 − A)² AI-share text, the ×10 build cap, research
speed "as a multiple of a 2025 lab with no AI help" (now: vs the leader lab's day 0, and M = vs the same lab without AI).

## Glossary terms (new or rewritten)
stage (ideation, small experiments, scale test, result, adoption), belief band, scale behaviour, project kind (line,
idea, axis), pool / ideas get harder, next prior, realised effect, priority list, teams wanted, risk policy, reopen as
speculative, recipe stack, stack efficiency, headroom, routine tuning, not trained in, software rate, experiment compute
c, experiment labour ℓ, compute- / labour-bound (project), work type, fit, median expert, best human, coverage, success
at task length, win rate, assist, effective labour, humans' share, AI FTE, research speed (vs leader day 0), AI R&D
multiplier, needs and caps, overflow, milestone criteria.
