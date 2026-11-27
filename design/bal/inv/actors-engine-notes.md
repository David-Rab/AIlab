# actors-engine inventory notes (prefix `act`, `balance/params/actors-engine.ts`)

Files: `src/engine/v2/actors/*` (15 files). 68 entries: 17 exported named constants, 11 non-exported named constants (inline refs on the declaration), 40 notable inline literals.

## Questions

| id | question | evidence |
|---|---|---|
| Q-actors-engine-1 | Is base-model cadence (`BASE_MONTHS`) and release lag (`RELEASE_LAG`) rival policy (when they act) or world pace? Registered `BASE_MONTHS` as world and `RELEASE_LAG` as policy. | rivals.ts:56-58; both set when a rival ships, but base cadence also sets capability pace |
| Q-actors-engine-2 | `GOV_SCORE` is `unclear`: the `[D]` comment above names only the `parent` entry (GDM: C-); do the other four board presets carry the tag? | index.ts:21-22 |
| Q-actors-engine-3 | 11 named constants are not exported (`LATENT_ERA_OOM`, `MISUSE_FROM_OOM`, `MISUSE_PER_OOM`, `LATENT_P`, `SD_AI_MAX`, `RECIPE_RATE_MAX`, `LEADER_DAY0_TRAIN`, `MISUSE_SHOCK_DAYS`, `ASSUMED_LAG`, `PRIOR_BAND`, `GOV_SCORE`). An export ref cannot reach them, so they are inline refs on the declaration line and `coverage.txt` will keep listing them. Export them (separate refactor) or accept? | rivals.ts:62-67, rivalModel.ts:71-72,709, gov.ts:249, intel.ts:22-25, index.ts:22 |
| Q-actors-engine-4 | `RELATION_ACTIONS` (player relation actions A1-F3) holds almost every actor-effect magnitude (trust, credibility, bloc, cash deltas) and every cooldown inline in `preview`/`apply` closures; `def()` drops `cooldown`/`once`, so no path reaches them. Needs a data table before the registry can point at them. Its header says "All magnitudes are [D] calibrations" (a file header, so not used as a tag). | actions.ts:2, 38-56, 89-526 |
| Q-actors-engine-5 | `WS4_TUNING.leakK`/`distillK` are `[fit, T3]` but no script is named and no T3 target id exists in `targets.ts` (fit.script `unnamed`, targets `[]`). `GAP_ALGO_OFFSET` is `[fit]` to the T3 start lead, same gap. | tuning.ts:4-10, china.ts:102 |
| Q-actors-engine-6 | Spec-section pointers ("§3.10.3", "§3.9.1") are treated as untagged, not sourced (design spec, not research). Right call? Affects `RELEASE_LAG`, `LATENT_P`, `RUNG_TRUST`, race-pressure /6, trust-loss x3. | rivals.ts:55,59; relations.ts:17,23 |
| Q-actors-engine-7 | `RIVAL_IDEA_IDS` is a string-id list (a rival research list, policy) registered with path `['*']` and no value; fine for the schema? | rivalModel.ts:493 |

## Skipped

| coverage line | reason |
|---|---|
| src/engine/v2/actors/actions.ts:89 RELATION_ACTIONS | function-bearing records; magnitudes inline in closures (Q-actors-engine-4) |
| src/engine/v2/actors/china.ts:262 geoQSystem | system descriptor (order/cadence), not balance |
| src/engine/v2/actors/commitments.ts:98 PREDICATES | table of predicate functions, no numeric field |
| src/engine/v2/actors/index.ts:15 LETTERS | display grade-letter bands |
| src/engine/v2/actors/index.ts:68 indexSystem | system descriptor |
| src/engine/v2/actors/intel.ts:69 intelSystem | system descriptor |
| src/engine/v2/actors/intel.ts:171 RISK_LEVERS | UI what-if step sizes for the risk readout, no effect on the sim |
| src/engine/v2/actors/public.ts:27 ELECTIONS | real calendar dates (strings) |
| src/engine/v2/actors/relations.ts:120 actorsDailySystem | system descriptor |
| src/engine/v2/actors/rivals.ts:515 rivalsChinaSystem | system descriptor |

All other 21 coverage lines are registered (11 of them as inline refs, Q-actors-engine-3).

## Inline overflow

Registered inline literals are capped at 40. Notable ones left out:

- china.ts:26 R&D share 0.6 of DeepCent compute; china.ts:36 staff cap 1500 / saf 60; china.ts:38-41 start meters (computeAbs 1.5e6, chipSelfSufficiency 30, distillationAccess 60, taiwanTension 40, ...); china.ts:63 start finance cash 30; china.ts:65 lead estimate x0.8, sd 75
- china.ts:110 gap formula 10.8 and (1 - 0.5 DA/60); china.ts:117-118 distillTarget 60, 0.85, 0.85, 0.75
- china.ts:154-159 meter drift rates (chip self-sufficiency 5/yr x1.3, distillation 0.004, theft 0.01, safety concern 0.002, Taiwan 0.003); china.ts:167-175 ladder conditions (gap 6/3/12, distillation 50, centralization 50, taiwan 1.9)
- china.ts:240-255 reweight multipliers (nationalizer 1.3, gambler 1.15, fastfollower 0.85, selfreliant 1.3, diffuser 1.5, chip 70) and the 0.45 switch threshold; china.ts:302,307 Taiwan/Korea shock ranges
- gov.ts:112-132 awareness, hawkishness, nationalization, activism and state-reg drift rates and targets; gov.ts:137-141,162-165 G-SEC/G-CHN rung conditions (securityDemand 70, concern 65, hawkishness 80, lead 60)
- gov.ts:147 aiPriority floor 85 at rung 2; gov.ts:152,154 DPA/nationalization thresholds (trust 60/20, natThreshold +-10/20); gov.ts:195-197 trust +1.5/-1 monthly
- gov.ts:214-215 preemption suit (stateRegPressure 50, 90-180 d); gov.ts:220 activism >= 70; gov.ts:231 stance drift 0.1
- gov.ts:270-342 policy-flag on/off thresholds (jobAnxiety 75/65, human-in-loop concern 75/55, multi-vendor 0.5/0.3, advisors trust 50/30, SEZ 75/55/50/70, FDA 70/-20, AV ban, companion 10/15, school 70/55)
- public.ts:36-52 other opinion drifts and targets (jobAnxiety 65+4x, xrisk 40, salience half-life 60, approval -5, nimby 70/50, activism 0.5/0.4/1.5); public.ts:59-65 activism ladder thresholds (30, 55, 70, salience 10/15); public.ts:73 descent 60 d; public.ts:84-86 leak approval -20, rally +5/-5
- rivals.ts:82 start lead months mapping (3 + 6(g-0.1), clamp 3-9); rivals.ts:90 staff 2500 x computeMult; rivals.ts:98 compute share 0.06 +-; rivals.ts:107,155 nextBaseDay ranges
- rivals.ts:305 pressure > 0.6 persistence; rivals.ts:338 base month jitter 0.8-1.2; rivals.ts:370 release catch-up lag+56; rivals.ts:381 openness cap 40 at gap < 90
- rivals.ts:403,406 incident chance cap 0.5, misuse severity 3-5; rivals.ts:492-493 cash scaling 0.25-1 and chip order 1.2; rivals.ts:501-510 goalposts 90 d, bindingness -0.1, mobilization +5
- intel.ts:51-65 intel smoothing (0.6/0.4), noise 0.5 sd, evidence weights, band narrowing; intel.ts:128-160 belief-side risk formulas (UI readout)
- relations.ts:25-30 initial trust stocks and access-rung drop 30 d; relations.ts:83-96 cover-up penalties (trust -6, cred -15, scrutiny 15, approval -8); relations.ts:112 crunch 1.3; relations.ts:124 talent pull 0.002
- blocs.ts:14 pressure 0.3/0.7; blocs.ts:24-25 channel multipliers (1.3, 0.6, 0.8, 0.9); blocs.ts:43-48 mobilization floor 15, half-life 45 d, feed gains
- researchBodies.ts:13-14 evaluator capacity 2/3 and publishPressure 0.3/0.6; researchBodies.ts:25-27,53 discovery odds 0.3/0.15/0.05, report delays 14-30 d / 30-60 d, noise 0.2
- commitments.ts:206-211 statutory fines (-0.003, -0.001), trust -4, cred -5; commitments.ts:172,189 break scrutiny 8 / amend cred -8
- actions.ts:60 dealmaker x1.6; actions.ts:69 open-release 0.3; actions.ts:71 poach 3% / min 5; plus every action preview/apply magnitude (Q-actors-engine-4)
- index.ts:30 Index scale 4.3; index.ts:35-60 grade weights; index.ts:83-85 bloc effects (g-2) x 4/3/3
- rivalModel.ts:598 start base FLOP floor 1e24; rivalModel.ts:283 serve rShare fallback 0.15; rivalModel.ts:293,296 bisection bounds/steps (guards)
