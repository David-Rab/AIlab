# E2s + E3: safety extractions and the safetyrates estimates (branch boe-e2s)

## Part 1: extractions (refactors, behaviour bit-identical)

- **(a) `postRunEnv`** (src/engine/v2/safety/traits.ts, above applyRunToTraits, ~l.1349): the post-training environment of one
  run (true signals + the fleet's steered S4, ω, playerEnv, run memory, learned hacking lh, hackTarget, P14 steering, the IDA
  teacher). Pure, no rng. Returns `{ env, probe, sg, om, rhB, steer }`; applyRunToTraits calls it and keeps its belief
  prediction and Goodhart code. `runSignals` takes a `Pick<TrainingRun, ...>` so an estimate can pass a run-like.
- **(b) `removalShare(env, x0, j)`** (traits.ts ~l.636): the removal term of stepTraits incl. the crystal factor
  (`x0.TGAME > env.crystalAt ? 0.3 : 1`); stepTraits calls it.
  scripts/v2/safety-emu.ts `persistence(env, x0, t)` now = `1 - removalShare(env, x0, t)` (was the copy without crystal).
  **Did a result move because the copy was wrong?** Not by construction for any estimate or test: the copy and the engine
  differ only when the start TGAME exceeds the crystal threshold (0.5; 0.3 with U20), and no probe world or test asserts at that
  TGAME (V0 TGAME is far below). The RefBot-game reading (calreport safety.ts, F6.persistence.scheme) is the only user at later
  TGAME; I did not play a game (CPU rule), so it is unverified but can only move down in persistence for a crystallised parent.
- **(e) not done, and why.** There is no test that copies itemTerms' terms any more (sabotage.ts's anchor checks already call
  `itemTerms`; the MO.anchor targets were deleted by H). The copy is in src/data/v2/danger.ts (KAPPA_ITEM, KAPPA_RD: the 0.8 =
  8/(8+H_HALF) × CHANNEL_AFFORD.internal, and the sigmoid). I replaced the literal with the named constants (bit-identical), but
  balance/params/safety-data.ts registers that literal by text anchor (`saf.danger.kappaItem.autonomy8h`, `kappaRd.autonomy8h`),
  so registry-lint failed (2 errors). I reverted it (commit 2702508b). To do it, the balance session must move the two anchors;
  the data layer cannot call the engine (layer order), so the derivation can only use data constants.
- **Identity proof:** `node --import tsx scripts/v2/fixtures.ts --write` (63 s) after (a)+(b), then `git diff --stat scripts/v2/fixtures/`:
  empty. tsc main and scripts pass.

## Part 2: E3, scripts/v2/estimates/safety.ts

One typical world: `newGame` medium tl-central seed 1 with every edge weight at its wBar and difficultyMult 1 (the medians of
the latent draw; AG18 efficacy and the rest stay the seed-1 draw). Each arm is one `postRunEnv` (run-like: kind post, flopNeeded
= ρ × the base FLOP, the arm's design and suites) + one `stepTraits`. S9 arms set `env.signals.S9` on the env (no loop).
22 rows, all by `estOf` with registry ids, ~140 ms (all areas together ~1.7 s). Result: 13 in band, 9 WARN (calibration), none absurd.

| id | estimate | band | chain end |
|---|---|---|---|
| F1.hackRate.typical / mlCheap / sweCheap | 1.0% / 30% / 45% | in / in / in | hackRates |
| F2.sabotageAfterHacking | 16.2% | in (6-20) | itemTerms(SAFSAB) on the hack arm |
| F2.sabotageControl | 0.8% | in | same, control |
| F2.afReasoningAfterHacking / Control | 55.3% / 5.2% | in / in | AF x familyPenalty(AF, COT) |
| F2.inoculation.persona / mis / af / sabotage | 56% / 56% / 56% / 67% | WARN (band 75-120 / 75-90 / 75-90 / 75-95) | cut over control / hack / T-INOC |
| E18.afGateAtV0 | 0.997 | in | afCapGate(gV0) |
| F5.afGapOversightConditional | 73.5% | in | S9 = 1, BB reading |
| F5.eaRisePerOOM | 0.148 | in | EA(10 rho) - EA(rho) |
| F5.antiScheming.eaMultiplier | x2.00 | in | with / without T-ANTISCHEME |
| F5.antiScheming.cut | 63.5% | WARN (90-98) | 1 - SCHEME ratio |
| F6.persistence.schemeStart / noHealing / af / sand / frontierEA | 74.0 / 80.7 / 73.7 / 74.0 / 75.6% | WARN / in / WARN / WARN / WARN (>= 80) | 1 - removalShare |
| F3.distilledTransfer | 9.7% | in (0-15) | distilledStart -> stepTraits |

Differences from the old probe (the (a) drift, now closed): the estimate runs the real env (hackTarget, steering, run memory,
lineage first-time EA flag), so the inoculation cuts (56-67%) and the anti-scheming cut (63.5%: SCHEME 0.111 -> 0.040, the
untouched growth term is ~0.04) read lower than the registry's old probe-world medians suggested. These are WARNs for the balance session, not
verified against a 40-world median (the typical world is a point estimate: edge weights at w-bar).

## What safetyrates.ts keeps

A mechanism test on the same typical world (~8 s wall incl. load, <1 CPU-s of work): learned hacking raises RH, sabotage, AF, Mis;
T-INOC lowers them; anti-scheming lowers SCHEME and raises EA; 10x RL raises EA; AF rises with S9 (0 < 0.3 < 1); persistence in
0..1, rising with EA, higher without healing; a distilled student carries less AF than its teacher; crystallisation scales the
removal share by 0.3. 14 checks, no bands. Dropped: all 22 banded rows (now estimates), the INFO rows (E16 recipe table, AF trait
raw, 'AF one detector vs reference', F3 shared-init share), the 40-world cache. Its run.ts job: `budget {quick 10, full 10}`, tiers quick+full (was full only, 30 s).
