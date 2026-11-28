# G5 report: safety, safety-emu, safetyrates, sabotage, footholds, control, danger

## Failing checks
| script | check | class | action | OPEN.md row |
|---|---|---|---|---|
| control | E15 (day900): believed control unchanged by hidden truth (readout oversight differed at 1e-9) | TEST-BUG | The perturbed copy took one more `controlStep` than the original, and `controlStep` grows footholds once control is low, so oversight moved. Per-perturbation readouts are bit-identical (checked each of the 6 perturbations alone, and all together). Both arms now take the same step. Not a leak. | none |
| safety | all 16 passed (quick) | - | - | - |

products M2 (also in quick-fails) is not in this group.

## Cost (CPU-s measured wall on a shared machine, one process; before = brief's numbers)
| script | before quick | after quick | full before -> after |
|---|---|---|---|
| safety | 521 | ~30 wall (smoke: S1-S3, constructed sabotage, SAFMECH; 3 games x 40 days) | 40 REF + 40 SAFE to ASI + 20 Mixed to SAR (~26 CPU-min cold) -> 20 REF + 16 SAFE to ASI + 10 Mixed to SAR (~13 CPU-min cold, ~0 warm): NOT RUN, over 3 CPU-min |
| safetyrates | - | - | 12 own games (3.4 CPU-min) -> 0 extra: reads safety S4's cached games (refGame) |
| sabotage | 65 | ~23 | same |
| footholds | 34 | ~18 | same |
| control | 31/1 fail | ~26, all pass | same |
| danger | 16 | ~12 | same |

Seed arithmetic for S4/S5 is in the comment at the top of safety.ts. The per-world sd (~0.31) is B-heavy's estimate, NOT re-measured (a 20-game run is > 3 CPU-min). It should be checked at the first full run (the INFO line prints range and mean; compute sd from the cache).

## What changed
- safety-emu.ts: `refGame(seed, maxDay)` = RefBot tl-central/medium to ASI with both observers (Outcome for S4, the per-version rates record for safetyrates), cached under one name/key with `files = [safety-emu.ts]`. safety.ts and safetyrates.ts both call it; the RefBot seeds 500-511 are the same game in both. `play()` gained `observe` and `maxDay`; `sarRead` exported; REF_TRUSTED and the `sabotage` kappa parameter removed.
- safety.ts: SMOKE plays one 40-day game per bot (checks: JSON-safe, P_mis a probability; bands stay SMOKE lines) and runs the neuralese check on the day-900 fixture. S2 40 -> 8 worlds. Deep S5 sabotage (2 x 80 games, 32 CPU-min) replaced by two constructed checks that run in quick and full: (a) SAFSAB kappa x1 vs x0, 300 fireFinding each: rigged tools and sandbagged results only with the act on (27 / 39 vs 0 / 0), honest tools in both arms; (b) a rigged tool (falseValidated) halves what its family reads of the trait it covers, believed U unchanged, true U lower (13.3 -> 8.75). Deep keeps only half staff (20 games to SAR): the deep tier is NOT empty.
- Why not a day-900 played pair: 300 ticks cost 28 s per arm at day 900 and showed zero effect (no trusted-to-AI safety work there; true U 0 in both arms).
- sabotage/footholds: the 20000-day `rollFleetCovert` loops saw 3-5 acts (rare event; 600 days would see none). Forced the odds (BACKDOOR/HIDCOMP kappa x 1000, 600 days: 173 uncaught acts); footholds' escape loop took 2074 days, now EXFIL kappa x 1000 (3 days). Both restore kappa in finally.
- control: N=20000 tolerance-noise loop kept (pure function, ms; tolerance 0.01 needs it).
- Cost headers added to all scripts.

## For the lead
- run.ts: safety quick budget 550 -> ~40; sabotage quick 70 -> 30; footholds 40 -> 25; control 30 -> 30; safety full shards can drop (est ~13 CPU-min cold, mostly cached); deep keeps `safety` for half staff only (~4 CPU-min), its label "S5 mechanisms" is now "half staff".
- safetyrates should run after safety in the full tier (or share the prefill) so the 12 games are cache hits.
- safety-emu.ts imports simcache (cached) directly; fine, but if refGame should live in lib/simcache-adjacent code say so.
## Questions
- The SMOKE days (40) make a smoke that only proves the games run; confirm that is the intended bar.
- control quick stays ~25 s (ending setups use ~7 newGame + ticks); not cut further, over the 20 s target.
