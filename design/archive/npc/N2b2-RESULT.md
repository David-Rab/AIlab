# N2b-2 result: NPC race pressure, misalignment m, incidents

Branch `npc-n2b2`. Code: `src/engine/v2/npc/risk.ts` (new), `actors/rivals.ts` (the replaced functions and the incident block of
`labDaily`), `types.ts` (`NpcLabState.m`, `.p`), `npc/lab.ts` (init of the two fields). Test: `scripts/v2/npcRisk.ts`.

## What changed
- **Race pressure** `racePressure(s, id)` = `npcRacePressure`: clamp(1 - months to the nearest competitor / 3, 0, 1). Competitors:
  every other active lab and the player, at their true best internal G; months = the gap on the reference clock (`clockOfGAt`),
  ahead or behind alike (past the run's end: the G gap at today's slope). Stored as `lab.pressure` and `npc.p` daily;
  `pressureDays` and `goalpostsQ` run on it unchanged (threshold 0.6 for 90 days).
- **m** daily on `npc.m`: `mWorld(G_internal) x (1 - 0.5 x safety x (1 - race response x p))`. Safety and race response come from
  `postureOf` (the kind's values, plus joint-evals deltas; China's safety follows its concern as before, race response 0).
  `rivalMis(r)` returns `npc.m`. `projectLabMis` (epilogue "reaches ASI") is now m at the ASI capability under today's p: no trait
  projection loop.
- **Incidents**: model incidents at `h0 x (m / M_world(G(V0))) x (1 - 0.8 x safety)` a year on one generic row, severity
  `drawSeverity` of `1 + 3 x level/15`; misuse row as before with safety emphasis where eval rigor stood; disclosure, the SB 53 /
  RAISE floor, `ws4.rivalIncidents`, China's safety-concern bump and the RNG streams ('rivals' / 'china') as before.
- **Removed**: the per-release `rivalTraitStep` call for NPC labs, `labModelHazards` in `labDaily`, the trait projection in
  `projectLabMis`.

## New parameters (not in the registry or task tables)
| Name | Value | Where | Tag |
|---|---|---|---|
| RACE_MONTHS | 3 | risk.ts | [D, spec 4] |
| SAFETY_CUTS_M | 0.5 | risk.ts | [D, spec 4] |
| H0_PER_YEAR | 0.05 | risk.ts | [D, MISALIGNMENT.md 5] |
| SAFETY_CUTS_INCIDENTS | 0.8 | risk.ts | [D, spec 7] |
| SEV_SPAN, SEV_LEVEL_TOP | 3, 15 | risk.ts (generic row severity 1 + 3 x level/15) | [D] |

## Still reading `traitsTrue` / `uModes` of NPC models
- `security/theft.ts` copies the victim's model (traits and U-modes) into China's stolen internal model; nothing reads the copy
  except as below. Harmless, remove with N6 (theft shock).
- `actors/rivalModel.ts` (lineup students copy the teacher's traits), `actors/rivals.ts` `simpleModel`/`drawUModes`/`latent:` flags
  (old constructors, `LATENT_P`), `npc/lab.ts` (`uModesOf`, `TRAIT_START` in model blanks): written, never read for NPC labs now.
- `safety/traits.ts` `rivalTraitStep`, `effSafety` and friends read `lab.pressure` but nothing calls them for NPC labs: dead until N12.
- No reader of an NPC model's traits remains in endings, intel, UI or incidents (they read m through `rivalMis`).
- `worldfx/control.ts` reads `r.pressure` (now the new p, 0 to 1 as before).

## Test (`npx tsx scripts/v2/npcRisk.ts`, tl-central, challenger, seed 7, 900 days)
All checks pass. p: 0 isolated; competitor 3 / 2 / 1.5 / 0.5 / 0.05 months behind gives 0.00 / 0.33 / 0.50 / 0.83 / 0.98; one month
ahead 0.67. m in [0, 1], rises with G (racer 0.057 at V0 to 0.101 at V0 + 5 OOM), safety-first kind never above the racer at equal
G and p, rises with p for the racer (0.089 to 0.093 at V0 + 3 OOM; the effect is small because M_world is small near V0), and
equal at p 0 and 1 for China (race response 0).

**Incident rate**: mean model-incident rate over the first 90 days = 0.031 per lab-year against h0 = 0.05 (factor 0.62; per lab
0.020 for the safety-first lab to 0.044 for the racer). Last 90 days 0.026 to 0.059. Disclosed incidents over 900 days: 0 (about
half an incident expected in total across 7 labs, then thinned by disclosure; misuse starts only at V0 + 1 OOM). So the
catastrophe path is much rarer than before: this is the spec's rate, flagged for calibration.

## Notes
- Mean p over the game is high for several labs (0.6 to 0.9: the cast sits within a few months of each other), so goalposts will
  fire often for high race-response kinds; it is the spec's rule and the cast's spacing, not tuned.
