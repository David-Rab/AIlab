# Loss-of-control risk reads 0% (0–0) while the lab can barely see: analysis

Branch rd, read-only. Probes in `scripts/v2/_lcr/` (untracked): `probe.ts` (fixtures), `seeds.ts` (RefBot seeds,
ai2027 / medium, cashFloorStub as fixtures.ts), `stop.ts` (stop-rate parts, sight readings), `whatif.ts` (widened /
de-biased beliefs, analysis only).

## 1. How it is computed and why day 400 is exactly 0

`safety/lossRisk.ts modelLossRisk`: p = E over the Mis belief N(m̂, σ̂) of P(θ < Mis·k), k = (1 − stop)(1 + F),
θ = published prior (logistic, centre 0.40, sd 0.06, clamped to [0.05, 0.95]). lo / hi = the same at Mis's 5th / 95th
percentile, with stop, F and θ held at their point values.

- **No capability gate.** "Able to" does not enter Mis, stop or k (it only reaches the unfound-foothold allowance). The
  "if it could act now" reading is honest in that sense.
- **No clamp bug.** `thetaCdf` returns exactly 0 for x ≤ 0.05, and that is right: θ is clamped to ≥ 0.05. The logistic
  tail there is 0.3% anyway.
- **Why 0 (day-400 fixture, Atlas-2.10):** Mis 0.095 ± 0.048 (90% band 0.017–0.174), believed stop 0.828 (block 0.49,
  catch 0.66 with control deferral miss ×0.447), F 0, so k = 0.172. Exposure at the top of the band is 0.030, which is
  ≤ 0.05, so P = 0 at every point. **Even at Mis = 1, p is only 2.1%**: the believed stop rate makes loss nearly
  impossible whatever the model wants.
- **Is the stop rate honest?** Yes. Believed 0.828 against the engine's true 0.848 (day 900: 0.680 against 0.665).
- **Is the truth near the line?** No. The true Mis is 0.180, giving a true exposure of 0.031 against θ_w 0.245. A
  readout near 0% matches the world.

## 2. Numbers (p [90% range]; Mis belief ± sd; believed stop)

| run | day 0 | day 400 | day 900 (= SAR; SAR reached by 900 on all three) |
|---|---|---|---|
| fixture day*.json | 0.13% [0–0.6] Mis .037±.084 stop .47 | **0.00% [0–0]** .095±.048 stop .83 | 0.91% [0.57–1.36] .345±.048 stop .67 |
| seed 2027 live | same as fixture | 0.00% [0–0], sight none (level 6.79) | 1.61% [0.89–2.62], sight 9.30 vs level 13.48 |
| seed 11 | 0.07% [0–0.45] | 0.00% [0–0], sight 7.75 / 7.30 | 1.25% [0.66–2.08], sight 13.9 / 15.0 |
| seed 42 | 0.10% [0–0.53] | 0.00% [0–0], sight 7.45 / 7.20 | 1.21% [0.63–2.04], sight none / 15.0 |

The p range is never wide on any seed or day. The θ prior is steep (sd 0.06), so any exposure band below about 0.2
collapses to a p band of a few points.

## 3. Does the range reflect uncertainty about dispositions? No, for two reasons

**(a) The range varies only Mis.** Stop rate, F and the unfound allowance are point values, even though the believed
stop rate rests on the same efficacy posteriors that give the sight limit its range (day 400: sight lo 0, hi 6.85).

**(b) The Mis belief is too sure of itself, and the cause is upstream.** In `detection.observeVersion`, the reading is
o = true × penalty + noise(σ), where the penalty covers eval awareness, CoT obfuscation and masks. `updateBelief` then
treats o as unbiased with σ = 0.12 / strength. Repeated readings shrink the sd however unreliable the instrument is,
and the mean settles at true × penalty. The player's own `believedPenalty` / `sightAt` already says reliability at the
model's level is 0.40–0.49 at day 400. Effect on the 90% top (`beliefHi`, the bound RF-S1's framework rule reads):

| day | trait | belief (est ± sd) | top of 90% range | true |
|---|---|---|---|---|
| 400 | SCHEME | 0.11 ± 0.06 | 0.21 | 0.31 |
| 900 | AF | 0.47 ± 0.08 | 0.60 | 0.73 |
| 900 | SCHEME | 0.46 ± 0.06 | 0.56 | 0.63 |

So the 90% bound misses the truth on the hidden-goal traits, and the framework hold and trusted rule inherit the same
over-confidence. This breaks decision 4, "not knowing counts as risk", while every readout still reads beliefs only.

**Verdict.** The 0% headline at day 400 is honest: the stop rate dominates. The zero width is a gap in the range
(point stop and F). The over-tight belief under it is a real bug, shared with RF-S1.

## 4. Minimal fix (not built)

1. **Beliefs (the real fix; one place).** In `observeVersion`, and in the `alignmentEvals` update the same way, update
   on the player's model of the reading: bp = `believedPenalty(s, v, trait, family, L)` clamped to ≥ 0.1, then
   o' = o / bp and σ' = σ / bp. Low reliability then means a higher, wider belief, with no truth read. What-if on the
   fixtures (de-bias the hidden-goal beliefs by `sightAt` at the model's level):

   | day | headline now | headline with the fix |
   |---|---|---|
   | 0 | 0.13% | 0.25% [0–1.1] |
   | 400 | 0.00% | 0.07% [0–0.35] |
   | 900 | 0.91% | 5.2% [2.3–9.6] |

   The fix moves calibration: framework holds and trust both read these beliefs.
2. **Range.** Take hi at Mis 95th percentile × the stop rate's lower end (efficacy posterior, as `sightLimit` lo/hi) ×
   (1 + known F + the unfound allowance's upper end), and lo symmetrically.
3. **"Unknown" state.** Trigger it on the inputs, not on the p width: show Unknown when the Mis belief range is wider
   than 30 points (the existing belief rule), or when the exposure band (Mis band × k range) reaches the θ prior's 90%
   range. Separately, show "< 0.1%" rather than "0.0%" when p > 0.
