# safety-data inventory notes

Registry: `balance/params/safety-data.ts` (`PARAMS_SAFETY_DATA`, 201 entries). Files: `src/data/v2/{agendas,techniques,edges,danger,findings,limits,oversight,safetyIdeas,framework,postures,traits,umodes}.ts`.

## Questions

| id | question | evidence |
|---|---|---|
| Q-safety-data-1 | danger.ts tags values `[C]` ("calibrated against the reference run (design/notes/E5.md)"). The kind table has no `[C]` row. I registered every `[C]` value as `fitted` (script `unnamed`, targets `[]`). Is `[C]` = `fitted`? Affects DANGER_ACTS.kappa, UMODE_ACT.kappa, COPIES_REF, MISUSE kappa/theta, EXFIL theta/s, RIVAL_SITE.usage, COVERT_ACTS BACKDOOR/HIDCOMP kappa. | danger.ts:16 "[C] are calibrated against the reference run"; danger.ts:22-23 "[C]"; danger.ts:92, 98-99, 116-117, 120, 166 |
| Q-safety-data-2 | Constants carrying two non-conflicting tags: VAL_COMPUTE_FRAC `[D: ... kept as a stand-in]` registered as `stand-in`; OOM_PER_400_ELO `[D, derived from P]` registered as `derived`. Should `[D]` + stand-in, and `[D]` + derived, resolve this way or to `designer`? | agendas.ts:131-132; oversight.ts:11 |
| Q-safety-data-3 | SERIOUS_CAP is explained by a "[calibration: RefBot keeps one team on each of its four lines ...]" paragraph, not a `[fit]` or `[D]` tag. Registered `untagged`. SAF_RE_ASK is `[D, calibration]` and registered `designer`. Should either be `fitted`? | agendas.ts:87-96 (SERIOUS_CAP); agendas.ts:109 (SAF_RE_ASK) |
| Q-safety-data-4 | edges.ts comments above the E06 and E11 records are labelled "E10" (stale label) and say "research/20 F3" and "research/20 F5". I treated each as the comment for the record directly below it (E06 = 0.75 sourced, E11 = 0.2 sourced). Correct? | edges.ts:37-38 above E06; edges.ts:48-49 above E11 |
| Q-safety-data-5 | EXFIL.kappa (4e-4): the `[C]` sentence names only "θ = 10, s = 1", not κ. Registered `unclear`; theta and s registered `fitted`. Does `[C]` cover κ too (as in MISUSE, where κ is named)? | danger.ts:116-118 |
| Q-safety-data-6 | ARCHETYPE_POSTURES: the file header says only rlIntensity/prefIntensity are `[D]` "(not in R17's table)" and cites research/17 §1.6.4 for the posture table. I registered the other seven fields as `sourced` (research/17 §1.6.4) on that reading. The `leader` record is an AI 2027 racer lab, probably not in R17's table. Is the header a tag for the seven fields, and is `leader` sourced? | postures.ts:1-2, 12-14 |
| Q-safety-data-7 | The agendas.ts header says "Every numeric parameter is a research/14 [D] value" and the techniques.ts header says "s0 and coverage are [D]". These are statements about named fields, not tag legends, so I used them as `designer` evidence for AGENDAS prior/T1/k/G/auto/loadings and TECHNIQUES s0/coverage. If header statements are not allowed as tags, these become `untagged`. | agendas.ts:2; techniques.ts:3-4 |
| Q-safety-data-8 | Layer of rival and China safety postures (ARCHETYPE_POSTURES, CHINA_POSTURE_BASE): they feed both rival decisions and the traits of rival models (rlIntensity, prefIntensity). Registered `world`, actor `rivals` / `china`. Should some be `policy`? | postures.ts:1-2, 19 |
| Q-safety-data-9 | COVERT_ACTS STEER and SUCCSTEER kappa: the comment tags "κ of the R&D acts ... [D]" but the value is computed in code from COVERT_ANCHOR (KAPPA_RD). Registered `derived`. SAFSAB kappa (KAPPA_ITEM) is also computed and tagged `[C]` in the same block; registered `derived`. Which tag should win? | danger.ts:156-164, 166 |

## Skipped

Coverage lines for my files not registered (74 of 82 registered):

| line | reason |
|---|---|
| src/data/v2/agendas.ts:45 INF | sentinel 1e9 ("never decays"), structural |
| src/data/v2/agendas.ts:49 ROWS | not exported; its fields registered through AGENDAS |
| src/data/v2/agendas.ts:72 LINE_COLUMN | map of line id to tree column (ids, not numbers) |
| src/data/v2/agendas.ts:199 DISAGREE_CAP | storage cap on a kept-disagreements list (list size) |
| src/data/v2/edges.ts:88 EDGE_NOTES | UI prose with grade letters |
| src/data/v2/limits.ts:21 LIMITS | UI limit registry: prose rules, numbers live in the engine files they name |
| src/data/v2/traits.ts:16 TRAITS_V2 | ids, names, booleans, layer letters; no numbers |
| src/data/v2/traits.ts:66 SIGNALS | ids and player names |

Not matched by coverage but registered anyway (derived): METHOD_SCALE_BELIEVED, ORGANISM_REALISM_BELIEVED, OOM_PER_HALVING.
Non-numeric or id-only fields deliberately not registered: AGENDAS family/coverage/column ids, EDGES `from/to/grade/moderator/cite`, TECHNIQUES role/unlockedBy ids, UMODES `revealedBy/mapsTo`, `F44_AAR.agendas`, `CONTROL.trait`, `ARCHETYPE_CLAUSE`, `TRAIT_MEANING`, `TRAIT_ORDER`.

## Inline overflow

Inline entries registered: 5 (cap 40). Not registered, below the cap, noted for completeness:
- src/data/v2/danger.ts:157 and :164: the `4.5 - 5` in KAPPA_ITEM / KAPPA_RD (V0's RSCH level and theta = V0 + 0.5), duplicated rather than read from COVERT_ACTS.thetaV2 or V0_V2_LEVEL.
- src/data/v2/framework.ts:40: `Math.round(medianExpertL * 10) / 10` (rounding of the High level to 0.1 L, display precision).
