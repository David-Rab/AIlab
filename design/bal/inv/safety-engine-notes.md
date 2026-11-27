# safety-engine inventory notes (prefix `sfe`, `balance/params/safety-engine.ts`)

Files: `src/engine/v2/safety/*` (43 files) and `src/engine/v2/security/*` (2 files). 119 entries: 82 for named constants (they cover 76 coverage lines; 6 of those are non-exported, registered as inline refs on the `const` line), 37 notable inline literals (under the cap of 40). Safety data tables in `src/data/v2` are in `safety-data.ts` and are not repeated.

Kinds: designer 43, untagged 46, sourced 16, fitted 7, unclear 4, derived 2, stand-in 1. Layer: 118 world, 1 policy (`CASE_COMPUTE_SHARE`).

## Questions

| id | question | evidence |
|---|---|---|
| Q-safety-engine-1 | The code uses tags that are not in the brief's table: `[S]` (safeguards.ts), `[R]` (Hubinger, Schoen), `[A]` (a grade letter on `OC_DETECT_TRAIN`), `[proxy]` (`LOCKDOWN_COLLUSION_MULT`, `CASE_WORK`). I read a tag that cites a paper or report as `sourced`, `[proxy, low]` plus "stand-in" as `stand-in`, and `[A]` as grade `A`. Right? | safeguards.ts:21-36; traits.ts:699; investigations.ts:133-137 |
| Q-safety-engine-2 | Pointers in prose ("[R20 F1]", "Betley et al. [P]") often back the mechanism, not the number. I did not call a value sourced on that alone when the value has its own tag (`[D]`, `[fit]`) or when the pointer clearly backs something else (`COT_S4`, `S6_NARROW_HARMFUL` are `unclear`; `S7_RL` and `K_S7` are `fitted` although the same comment cites Schoen 2025 [R]; `AF_GATE_*` and `HEAL_K` are `designer`). Is that the intended reading? | traits.ts:266-270, 289-302, 304-305, 559-566 |
| Q-safety-engine-3 | Action magnitudes sit inline in `ActionDef` closures in actions.ts, with the preview repeating the engine's number as text (Pledge credibility +8, trust +4, break cost 15/20; Publish credibility +2, talent +1, shared know-how +0.02/+0.04; Disclose, Framework override, Respond). I registered the Pledge and Publish effects inline and skipped the ActionDefs. The preview and apply copies can drift: should these move to a data table before the registry is used for tuning (same as Q-actors-engine-4)? | actions.ts:478-510, 440-470; findings.ts:463-466 |
| Q-safety-engine-4 | `THETA_PRIOR` hard-codes a copy of the world's doom-threshold prior ("data/world.ts: 0.40; U(0.30, 0.50)"). Other duplicated literals: `ω_post` 0.6 (OMEGA_KIND.post) appears as `/ 0.6` in `hackSaturation`, `stepTraits`, `0.6 / 42` in the stream and 0.6 in the rival env; the crystallisation 0.3 is in umodes.ts:73 and traits.ts:618; the P11 0.2 is in `hackTargetOf` and `postSignals`; the Mis weights are repeated in `misalignmentSd` (traits.ts:656); the 0.05 case compute share is in `CASE_COMPUTE_SHARE` and investigations.ts:124. A tuner that changes one copy will break the others. Extract first? | lossRisk.ts:41; traits.ts:141, 407, 618, 656, 1350, 1413; umodes.ts:73 |
| Q-safety-engine-5 | `CONTROL_SETTINGS` rows are tagged `[S]` (Greenblatt, Ctrl-Z) but the resample row also carries `[D]` for how Ctrl-Z attack success maps onto "acts slipping past" (safety0 0.42, safety 0.93, deferShare 0.05). I made `safety0` and `safety` `unclear` and `usefulness` and `deferShare` `sourced`. The rows carry a `src` string each. Should the table be split per row (defer10, defer20 sourced; resample designer-mapped)? | safeguards.ts:21-27 |
| Q-safety-engine-6 | `S6_NARROW_HARMFUL` (0, "lead decision" AF2, with a Betley [P] argument) and `COT_S4` (0.8 / 1.0, comment cites Baker [R20 F1] for the rule, not the values) are `unclear`: a decision tag and a source on the same value, or a source that does not back the value. | traits.ts:290-305 |
| Q-safety-engine-7 | Every `[fit]` in traits.ts names no script and no target id: `K_GAO`, `S7_RL`, `K_S7`, `K_S5G`, `SAFETY_PRETRAIN_AI_CUT`, `S8_FTE_REF` are `fitted` with script `unnamed`, targets `[]` (they fit "V1's design table"; scripts/v2/signals.ts reproduces it but is not named as the fit). Only `K_LH` names a script (scripts/v2/safetyrates.ts). `K_S3` is tagged `[fit]` but is computed in code, so I registered it `derived`; `S8_FTE_REF` is tagged `[fit]` but described as an arithmetic conversion (7.1M FTE). Should these be `fitted`, `derived`, or a V1-table-anchor target? | traits.ts:68, 113-115, 258-259, 268, 308-314, 338 |
| Q-safety-engine-8 | Layer for constants that set only what the player believes (`SD_MAX`, `UNKNOWN_RANGE`, `VAL_W`, `EA_PROJ`, `UNFOUND_YEARS`, `RED_FLAG`, `PREDICT_SD_FLOOR`, `ALIGN_EVAL_N`, `EVAL_SIGMA_FLOOR`): they shape readouts and the framework's belief rule, not the hidden world. I registered them `world` (no actor is choosing). Right, or is there a "belief" layer? | detection.ts:24-30; sightLimit.ts:30-38; lossRisk.ts:39 |
| Q-safety-engine-9 | `OC_VIS` is `[D, solved for the F6 band]` and `AF_GATE_G0/G1` are `[D on sourced points]`: tuned to an outcome band, but tagged designer. I followed the tag (`designer`, source pointers in notes). Treat as fitted? | traits.ts:559-566, 689-695 |

## Skipped

| coverage line | reason |
|---|---|
| src/engine/v2/safety/actions.ts:115 INVESTIGATE | ActionDef (functions); no sim number (Q-safety-engine-3) |
| src/engine/v2/safety/actions.ts:169 CLOSE_CASE | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:331 RESPOND | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:378 DISCLOSURE_POLICY | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:402 DISCLOSE | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:421 PUBLISH | ActionDef; effects registered inline in findings.ts (sfe.findings.publishCredibility, sharedPoolGain) |
| src/engine/v2/safety/actions.ts:440 POLICY | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:475 PLEDGE | ActionDef; effects registered inline (sfe.actions.pledgeCredibility, pledgeBreakCost) |
| src/engine/v2/safety/actions.ts:525 FRAMEWORK_EVALS | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:578 FRAMEWORK_RULE | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:601 FRAMEWORK_OVERRIDE | ActionDef; consequences come from framework.ts |
| src/engine/v2/safety/actions.ts:632 SAFEGUARD_PACKAGE | ActionDef; numbers from packages.ts |
| src/engine/v2/safety/actions.ts:665 CONTROL_SETTING_IDS | pure id list |
| src/engine/v2/safety/actions.ts:667 CONTROL_SETTING | ActionDef; numbers from safeguards.ts |
| src/engine/v2/safety/actions.ts:713 VALIDATE | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:757 VALIDATION_POLICY | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:789 SPOT_CHECK | ActionDef; preview text only |
| src/engine/v2/safety/actions.ts:821 METHOD_POLICY | ActionDef; preview text only |
| src/engine/v2/safety/actTable.ts:41 YEAR | calendar conversion |
| src/engine/v2/safety/actTable.ts:47 Z90 | statistical constant (1.64) |
| src/engine/v2/safety/agendas.ts:180 safetyResearchSystem | system descriptor |
| src/engine/v2/safety/alignmentEvals.ts:22 EVAL_Z | statistical constant (1.645) |
| src/engine/v2/safety/dangerView.ts:200 CONTROL_BANDS | display bands only ("these are not its threshold") |
| src/engine/v2/safety/detection.ts:27 BELIEF_EVIDENCE_CAP | storage cap on the evidence list |
| src/engine/v2/safety/findings.ts:37 WB_AGENDAS | agenda id list |
| src/engine/v2/safety/findings.ts:38 CROSS_CHECK | agenda id list |
| src/engine/v2/safety/footholdDetection.ts:261 UNIT | unit label strings |
| src/engine/v2/safety/ideas.ts:85 NO_AI_OVERSIGHT | null-object default (A 0, mult 1) |
| src/engine/v2/safety/incidents.ts:453 incidentsSystem | system descriptor |
| src/engine/v2/safety/lossRisk.ts:43 Z90 | statistical constant |
| src/engine/v2/safety/lossRisk.ts:44 GRID | integration grid size |
| src/engine/v2/safety/methods.ts:148 METHODS | id and effect text table; numbers in METHOD_MULT and literals |
| src/engine/v2/safety/oversight.ts:102 NO_CONTROL | null-object default |
| src/engine/v2/safety/packages.ts:32 MISUSE_RANK | ordinal rank of safeguard levels |
| src/engine/v2/safety/packages.ts:221 frameworkSystem | system descriptor |
| src/engine/v2/safety/readoutsIncidents.ts:22 Z90 | statistical constant |
| src/engine/v2/safety/readoutsModel.ts:19 Z90 | statistical constant |
| src/engine/v2/safety/responses.ts:22 RESPONSE_INFO | UI titles and notes (text) |
| src/engine/v2/safety/responses.ts:128 METHOD_TRAITS | trait id lists per method |
| src/engine/v2/safety/safetyReadouts.ts:22 Z90 | statistical constant |
| src/engine/v2/safety/sightLimit.ts:131 BELIEF_DRAWS | sample count of a readout draw |
| src/engine/v2/safety/sightLimit.ts:132 SIGHT_RANGE_Q | readout range quantiles (10% / 90%), display |
| src/engine/v2/safety/spend.ts:37 HOURS_PER_YEAR | unit conversion |
| src/engine/v2/safety/traits.ts:1462 traitsDailySystem | system descriptor |
| src/engine/v2/security/security.ts:57 securitySystem | system descriptor |

All other 76 coverage lines in these files are registered (6 of them as inline refs on the `const` line: `SPILL_G`, `SAFEGUARD`, `HEAL_MAX`, `HEAL_PREF`, `HEAL_SAFETY`, `DISTILL_SUSTAINED_OOM`).

## Inline overflow

Registered inline literals: 37 of the cap of 40. Notable ones left out (file:line):

- incidents.ts:152 classifier boost 0.5 + 0.5·min(1, strength/0.4); incidents.ts:158 open-weights hazard-filter block 0.5; incidents.ts:274 unexplained U-mode catch x0.5
- incidents.ts:302-304 public penalty (approval -sev, concern +sev/2, scrutiny 2·sev, trust -0.5·sev·(1+T/100)); incidents.ts:389 cover-up penalty x3, incidents.ts:390 cover-up credibility -15, incidents.ts:395 leak penalty x1.5; incidents.ts:372 insider factor 0.95 / 0.9 in cover-up discovery
- incidents.ts:461 per-site daily incident probability cap 0.5; incidents.ts:494 exfiltration (1 + 4·SCHEME); incidents.ts:505-506 T-GATE x0.5
- detection.ts:32, 40 z 1.64 in belief range; detection.ts:137 default EA 0.15; detection.ts:398 monitor catch 0.5 + 0.5·fleet monitor (also believedOversight.ts:28)
- findings.ts:84 decayed tool below 0.5; findings.ts:100-102 clarity boost 0.35 and sigma 0.12/…; findings.ts:143 probe-collapse x0.2; findings.ts:166 tools sharpened x1.1; findings.ts:244-247 false tool coverage 0.6 / 0.5, s0 0.8, oHalf 4.218, k floor 0.5; findings.ts:411-413 repeats the DISC weights
- investigations.ts:251, 256 corruption outcome 0.5 and discovery odds 0.5·c (x1.5 for the incident's own U-mode); investigations.ts:267 inconclusive weights 0.5 / 0.05 / +0.5; investigations.ts:280-295 post-verdict belief updates (0.1(1-c)+0.02, 0.05+0.1(1-c), x·0.8, x0.7, floor 0.06)
- footholdDetection.ts:115 hidden-compute share resolution 0.5%
- control.ts:41 tolerance clamp [0.05, 0.95]; covert.ts:142 covert attempt cap 0.5; techniques.ts:142-143 trained-against mask 0.9 / 0.65 and CoT pressure x0.7
- traits.ts:320 deploymentS8 +0.2 for P05; traits.ts:407 S2 +0.2 for P11; traits.ts:618 crystallisation 0.3 in `stepTraits`; traits.ts:637 CORRIG coupling (-0.3 POWER, -0.3 AF, +0.15 CAST); traits.ts:675-677 basePrior (SA 0.3 + 0.07·tier, EA 0.15 + 0.05·tier, PERSONA 0.05 - 0.02 with safety pretraining)
- traits.ts:772-790 other playerMods moderators: broad RL E09 x0.7, T-PROP E01 x0.7 (traits.ts:772), T-HONEY E10 x0.7, T-TMON E14 and E22 x0.5, monitorability tax E15 x0.5
- traits.ts:947 prediction sd widening 0.3·|Δ|; traits.ts:973 default belief sd 0.8·SD_MAX, clarity 0.2; traits.ts:1311 CoT-pressured mask x0.7
- traits.ts:1387-1397 rivalSignals coefficients (0.9, 0.4, 0.5/0.3, 0.2 + 0.1·tier, 0.2 + 0.2·evalRigor); traits.ts:1413 rival env ω 0.6; traits.ts:1435-1437 rival removal (0.5 + eff, 0.8·(1 - 0.3·eff·pool), SCHEME 0.5·eff above eff 0.5, pool 0.3)
- traits.ts:1350 stream day ω 0.6/42; traits.ts:1387 China posture 0.1 + 0.4·safetyConcern/100
- security.ts:72 clearances x0.6; security.ts:73 ssl = wsl - 0.6; security.ts:82 rival WSL floor + 0.4·safetyInvestment; security.ts:85 rival theft hazard x0.5
- theft.ts:33 effective defence (wsl < 3: -0.3·min(1, spies/5); Gulf -0.3); theft.ts:46 daily hazard /61 days; theft.ts:61 secrets leak clamp(3.5 - ssl, 0, 2); theft.ts:98 detection chance 0.5 + 0.1(wsl-2) + 0.3·counterIntel; theft.ts:105 theftIntent -15 on success; theft.ts:118 rival theft report chance 0.5, gov.securityDemand +8
