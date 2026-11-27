# Handoff: bot tooling (phase A1)

This is the start point for the session that builds the bot tooling. Written on 2026-11-25, at the end of the vision session.

## Read first

1. [MEDIUM.md](MEDIUM.md): the medium-term plan. Bot tooling is phase **A1** of Stage A, and runs alongside the A0 cleanup.
2. [BALANCE.md](BALANCE.md): why the work is needed, and what it found. §2 covers bot competence, §3 methods and costs, §5 the targets audit, §6 the first step.
3. The README.md in this folder, for context only.

These notes live in the worktree `C:\Users\david\Documents\projects\AI27-vision` on branch `vision`, and are **not committed**. Code work goes in a new worktree from `master`, for example `git worktree add ../AI27-bots -b bots master` followed by `npm ci`.

## Why (the designer's words, 2026-11-24)

- "How do you know the bot isn't playing stupid? Then it would need to make the game much easier to compensate for his stupidness."
- "We also need to make sure that we balance against good stuff, that really force us into shape, and not dead numbers."

What the analysis found:
- **The world's constants are fitted to RefBot.** The ai2027 and fast `gSC` values and the research costs for P05/P07/P08/P17 (tree.ts:103,115) are fitted to its dates. The `V3_CAL` refit log (workTypes.ts:200-310) shows refits caused only by changes in RefBot's behaviour.
- **Difficulty rests on hand-written heuristics.** The difficulty labels, the §7.4 criteria and the S4 band all come from the hand-written mixed bot.
- **The bot is probably weak.**
  - The world's own simulated leader lab reaches Superhuman Coder on day 576; RefBot needs 623 (CAL2.md:39,43).
  - RefBot's research list is fixed (ref.ts:79-85). It never researches P24, P09, P11 or P16, which the rivals adopt.
  - Its run sizes and cadence are fixed, and a failed idea waits 180 days before it is retried.

## Scope of A1

1. **Workers in `scripts/v2/bots.ts`.** It runs in one process today. Reuse the worker pool and cache from `calscan.ts`. Use paired seeds (common random numbers) so policies are compared on the same worlds. Measure games per minute. *Estimate: 0.5 day.*
2. **One policy parameter object.** Gather RefBot's and the mixed bot's unsourced choices into one typed object: research list, run cadence and pool shares, student size, release lead, products sold, cheap tier, retry delay, mixed bot thresholds, team counts, lottery line. Defaults must reproduce today's play exactly; check it with a same-seed run. Tag every choice **sourced** or **[D]**. That tagging is the reference-policy audit (BALANCE.md §6 step 4). *Estimate: 2–3 days.*
3. **Perturbation scan (method A).** For each [D] choice, run both directions on about 40 paired seeds. Report the change in win rate, the SC/SAR/ASI dates and P_mis at ASI. *About 1,200 games, roughly 15–20 minutes on 10 workers.*
4. **One-lever headroom check.** Run RefBot plus P24/P09/P11 research, and measure how much earlier SC arrives.
5. **Report**, in a new `design/vision/BOTS-RESULTS.md`: which choices matter, how flat the landscape is, the headroom, and whether a policy search (method B) is worth building.

**Not in A1:**
- Refitting any constant.
- Changing difficulty labels or criteria.
- The policy search (method B). That comes only if the scan shows the landscape isn't flat.
- Any change to the lab model. Phase A2 will replace the special leader lab and the rival archetypes with one table of lab kinds, so keep the tooling independent of those internals.

## Rules (from the designer's standing instructions)

- **Cut the work into small single-concern tasks.**
- **Subagents** run on Opus: high effort for judgement, medium for routine. Give each a time budget and stop it if it overruns. No open-ended bisects.
- **Tests:** tsc plus the task's own test per task. Heavy runs only at the end of the phase.
- **Failing is information:** never fake results.
- **Outcomes stay emergent:** never add a forcing rule.

## Open designer questions that this work informs (ask with the results, not before)

- How many months earlier than the AI 2027 lab may a top player reach SC?
- Should RefBot research what real labs plausibly would, with a refit?
- Should difficulty come from a searched best policy, accepting overnight runs?
