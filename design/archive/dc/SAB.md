# SAB: why the successor-steering check finds 0 uncaught acts on dc

Verdict: **C (the check is fragile), with a small A component.** Not B: the engine mechanism is the same on both sides.

## What the check does
`scripts/v2/sabotage.ts` ~L300-333 loads `day400.json`, sets SUCC = 1 on every version, calls `steerSuccessor` for 300 runs (`R0..R299`), and then `.find`s a run with a steered part. It dereferences `hit.omega` unguarded. A steered part needs an *uncaught* act. The per-run uncaught rate is tiny: the attempts term (opportunity x disposition) times (1 - block) times (1 - catch).

## Evidence (probes in `scripts/v2/_sab/`)
Probe 1: same draws, the check's own terms, 300 runs, 3 slots (SWE/EXP/IDEAS). The run on master's fixture used master's code, because dc code refuses its schemaRev 112.

| | dc fixture (rev 113, econ ai2027) | master fixture (rev 112, econ sampled) |
|---|---|---|
| model in the slots | Agent-1-2.5 (V25), CODE 5.81 | Agent-1-2.5 (V27), CODE 6.09 |
| AI labour L vs human H (SWE) | 6.55 vs 5 | 7.34 vs 5 |
| share of work the AI does beyond humans (SWE / EXP / IDEAS) | 4.7% / 4.4% / 0.4% | 6.7% / 6.6% / 0.6% |
| oversight, block, catch | 0.894, 0.576, 0.75 | 0.889, 0.575, 0.75 |
| summed uncaught rate per run | 0.00256 | 0.00392 |
| expected uncaught acts in 300 runs | 0.77 | 1.18 |
| outcomes in the check's 300 runs (uncaught / caught / blocked) | 0 / 4 / 8 | 1 / 3 / 12 |

Probe 3: 200 other batches of 300 runs (different draw keys), same terms.
- dc fixture: mean 0.79 uncaught per batch, **43.5% of batches have none** (87/200).
- master fixture: mean 1.17 uncaught per batch, 32.5% of batches have none (65/200).

Both fixtures sit in a regime where the check needs about one rare event (rate roughly 1 in 250 runs). Master passes because `R0..R299` happens to contain one. A 1-in-3 failure chance on master is not a stable pass. The `up > 0` check before it fails on the same 0 (the log reads "0 parts raised"), and the line-333 crash comes after it.

## Why the fixtures differ (A, minor)
The master fixture has `econ: sampled`. The dc fixture has `econ: ai2027`. Master's own default went back to ai2027 in abeeeece ("new games default to econ ai2027 again") after that fixture was built, so master's fixture is stale against master's own default. The same lineage model, Agent-1-2.5, is about 0.28 lower in every domain on dc. The AI labour surplus over the 5 human SWE seats falls from 2.3 to 1.55 as a result, and the work share scales with that surplus. I did not separate "econ" from "site redesign" (rent/grid/gas campuses, liveDay and power-queue timing). That needs a regenerated master-code fixture with econ ai2027, and it would not change the verdict. The shift is 0.77 vs 1.18 expected acts, small against the Poisson spread.

## Not B
Nothing in the probes pointed at a changed safety mechanism. The oversight, block and catch terms are identical to three digits on both sides, and the 4-vs-3 caught and 8-vs-12 blocked counts are Poisson noise. I did not diff `src/engine/v2/safety` (probe 4 was unnecessary).

## Recommended fix (not applied)
1. Make the check robust to rare events. Either roll until a steered part exists (for example `for k < 20000`, keeping the existing `R${k}` keys; about 1 act per 300-400 runs, so roughly 400 runs on average), or raise N to 3000 so P(0) is about 0.05%. Put the mismatch accounting on the same N.
2. Guard `hit`: `check(!!hit, 'a steered pull exists in N runs')` first, and use `hit?.omega`, so a miss reads as a failed check and not a crash.
3. Optional: if the check should test the mechanism and not the base rate, lower the barrier for the test only (for example `setControl` so block is 0). That keeps the draws honest and raises the act rate about 2.4x.
4. Separately: regenerate master's `day400.json` (and the other fixtures) with econ ai2027, so master's checks run on the same economy the game now defaults to.

No engine bug found.
