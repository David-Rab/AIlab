# Handoff: engine speed-up (separate session)

Written 2026-11-25 by the balance session (branch `bal`). The designer asked for this work to run in a **separate session**, branched from `bal`. When it is done, the designer tells the balance session to merge it back.

## Goal
Make a bot game faster **with identical results**. Today one game takes about 13.5 s (about 13.5 ms per game-day), and about 98% of that is the engine. On this laptop (i7-1355U, 2 performance + 8 efficiency cores) the balance runner manages about 10 games/min with 8 workers. Every balance scan and rebalance run scales with this number.

This is a **performance-only** change: no mechanics change, no rebalancing, and no change to any number a player could see.

## Setup
```
git worktree add ../AI27-perf -b bal-perf bal
cd ../AI27-perf && npm ci
```
Work only in that worktree. Never commit to `bal` or `master`.

## Proof of identical behaviour (required before every commit)
1. **Baseline first, on unchanged code.** `npx tsx scripts/v2/botfingerprint.ts` writes fingerprints of 24 games: ref and mixed bots × ai2027/medium and sampled/sampled × 6 seeds, each with end day, ending, verdict, milestones and a final-state hash. Save its output as the baseline, e.g. copy it to `.scratch/perf-baseline.json`. (`.scratch/` is git-ignored, so the `bal` session's copy is not in your worktree.) Read the script for where it writes.
2. **After each change:** rerun it. The output must be byte-identical to the baseline. Also:
   - run a few `balrun` games (`npx tsx scripts/v2/balrun.ts --name perfcheck --policy ref,mixed --world ai2027 --align medium --start leader --seeds 3 --no-cache`) and compare `games.jsonl` records before and after, ignoring `ms` and `run`;
   - run the existing fixture check (`scripts/v2/fixtures.ts`; read it for the compare mode) if it compares saved day-0/400/900 states.
3. Floating-point order matters. A cache that changes the order of additions can change results by 1 ulp and break the hash. Prefer memoising a whole computed value over restructuring arithmetic.

## Where the time goes (profile of one game: ref, ai2027, medium, leader, seed 7, 920 days)
Line numbers are by function name, because tsx source maps were lost in the profile. Re-profile with `node --cpu-prof` through tsx before you start.
1. **`relationsDaily`** (`src/engine/v2/.../relations.ts`, around :105) calls `revenueReadout(s, worldMix(s, ctx))` again, although `applyRevenue` already computed it in the same tick. About **15%** of the run. Idea: stash the readout in the tick context's memo and reuse it.
2. **Market choice**: `surplusChoice` (`choice.ts` :345, 11.3% self), `bandSharesFast` (:184, 5.4%), `packed` (:57, 1%). They are called via `rerunChoice` (`mix.ts` :1235) from `ration`/`divertOf` (`revenue.ts` :780, :720) for each cell and group (`revenue.ts` :854-855). About **23%** inclusive. Idea: cache rerun choices when inputs are unchanged.
3. **`computeMix`** (`mix.ts` :563): about **25%** inclusive, overlapping item 2. Its closures are 8.6% self; `stepPrices` 2%. Idea: recompute only sectors whose inputs changed.
4. **`revenueReadout`** (`revenue.ts` :437) and `offerOf`/`useFitOf` (`serving.ts` :288, :255): about 6%, repeated per tick.
5. **Safety:**
   - `sightLimit.ts` (`meanDet` is recomputed per call);
   - `reliability` (`instruments.ts`);
   - `reliabilityBase` (`techniques.ts`);
   - `lambda2Delta` (`common.ts`).

   About **14%** together. Idea: memoise per day.

Also measured: bot act/decide 6%, series recording 2.3%, GC 2.8%, tsx startup 1.1 s per worker. Bundling the engine with esbuild would cut startup, but it conflicts with the runner's override preload (`scripts/v2/overridePreload.ts` patches modules before they load). Don't bundle.

## Working rules (the designer's standing guidelines)
- **The lead session (Opus 5.5) designs, briefs and reviews.** Work is delegated to subagents on **Sonnet 5.5 at high or medium effort, never low**. Tasks must be tightly specified: exact files, a "done when" check, and stop-and-report instead of judgement calls.
- **Small single-concern tasks:** one hotspot per agent. Agents work in parallel only where their files don't overlap.
- **Time-box every agent;** check the elapsed time on each notification and stop overruns. No open-ended bisects.
- **Keep context small everywhere.**
  - Agents read line ranges, write results to files and report in about 15 lines.
  - Long runs are launched in the background and analysed by a fresh agent.
  - Nobody prints whole logs or profiles.
- **Failing is information.** Never fake a result, and never loosen the fingerprint check.
- Each agent: tsc (`npx tsc --noEmit -p .`) plus the fingerprint proof. No heavy test suites per task.
- Scratch files go in `.scratch/` (git-ignored). Agents can't delete files (`rm` is denied), so they should write scratch only there.

## Done when
- Each hotspot is either fixed (fingerprint identical) or reported as not fixable without changing results.
- A before/after table: one game alone (s), and games/min with 8 workers (`balrun --seeds 24 --workers 8 --no-cache`, ref, ai2027).
- Commits are on `bal-perf`. Tell the designer, who will ask the balance session to merge.
