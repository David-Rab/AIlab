# actors-data inventory notes (prefix `acd`, `balance/params/actors-data.ts`)

Files: `src/data/actors.ts`, `src/data/world.ts`, `src/data/v2/{rivalModel,blocs,agents}.ts`. 250 entries (`PARAMS_ACTORS_DATA`): 208 per-preset and exported entries, 2 non-exported named constants (inline refs on the declaration), 40 notable inline literals. Preset bundles (GOV, PUBLIC, CHINA, LAB_ARCHETYPES, BASELINES) are built by a helper from value tables written in the file, so the lint still compares each value with the live data.

## Questions

| id | question | evidence |
|---|---|---|
| Q-actors-data-1 | The file header says "Source: research/07-actors.md (weights = \"Realistic\" draw probabilities)". I read it as sourcing the weights only, so the trait values of GOV, PUBLIC and CHINA presets (accel, security, reg, transactional, hawk, natThreshold, lag, pollSensitivity, shock, halfLife, jobs, xrisk, benefit, mobilization, centralize, theft, taiwan, treaty, openSource, China hawk) are `unclear` (136 entries). Does "Actor personality presets. Source: research/07" source the trait values too (then `sourced`), or are they design values (then `designer`/`untagged`)? China weights cite research/10 ("supersedes 07"), also weights only. | actors.ts:1, 31 |
| Q-actors-data-2 | Same for LAB_ARCHETYPES: the header names "Actor personality presets"; lab archetypes (weight, safety, openness, lobby, computeMult, gapYears) have no tag, so all are `unclear` (leader row `untagged`). Is the header meant to cover them? | actors.ts:1, 47-55 |
| Q-actors-data-3 | world.ts preset comments ("Audit #1/#8/#9/#22 ...") sit above a one-line `build(...)` call. I treated each as covering every field of that line (`sourced`, pointer research/11-engine-audit.md), except authors2026 `cs` and `G` ("fitted to AC p50 2029.16, AC->ASI 4.56 y": `fitted`, script unnamed) and slow `sarSpeed` ("SAR anchor lowered": `untagged`). For ai2027 only g0 and pEx are named. Right reading, or should unnamed fields be `unclear`? | world.ts:157, 161, 167, 174 |
| Q-actors-data-4 | CL_POOL_SHARE and CL_DAYS are tagged "[D: stand-in, the player's rule at aggregate level]". Registered `stand-in` (same rule as safety-data Q-safety-data-2). Confirm, or `designer`? | rivalModel.ts:25-30 |
| Q-actors-data-5 | BLOCS: the header cites "research/08 §1.16 clout/approval", so `clout` and `approval` are `sourced`. `cloutNov26` (a second clout column, presumably a Nov 2026 update) has no comment at all, so `untagged`. Where do the cloutNov26 values come from, and does the §1.16 pointer cover them? | blocs.ts:1, 68, 71-100 |
| Q-actors-data-6 | Layer of player defaults: DEFAULT_CAP_SHARES, TRUST_EST_DEFAULT, MONITOR_STD_POOL_SHARE, SAFETY_AGENT_DEFAULT_SHARE are defaults of the player's own settings (also what a bot starts from). Registered `policy`, actor `player`. SAFETY_AGENT_MAX_SHARE (a limit on that setting) is `world`. Also unsure whether rival timing constants (BASE_RUN_DAYS, BASE_POOL_SHARE, CL_*, POST_DAYS) and the preset `weight` fields (which personality a world draws) are `world` or `policy`; registered `world`. | agents.ts:158-171; rivalModel.ts:17-35 |
| Q-actors-data-7 | BASELINES `reality` has desc "Calibrated to measured data through 2026 (METR horizons, polls, multi-lab frontier)" and `classic` "start state from the scenario and its supplements". These are UI strings, not code comments, so I did not use them as evidence and every start-state value is `untagged` (valuation is `designer`: "[design: AI 2027 gives no valuation]"). Should the desc text count as a source statement? | world.ts:268, 278 |

## Skipped

| coverage line | reason |
|---|---|
| src/data/v2/agents.ts:28 AGENT_USE_DEF | display strings plus a structural takeover ordinal (order 1-3) |
| src/data/v2/agents.ts:79 RISK_WATCH_EST | badge threshold on a readout only (departments/agents.ts:272), UI |
| src/data/v2/agents.ts:80 RISK_UNSEEN_CLARITY | badge threshold on a readout only (departments/agents.ts:272, safety/view.ts:102), UI |
| src/data/v2/blocs.ts:8 POLICIES | pure id map (policy id to research P-number) |
| src/data/world.ts:24 MILESTONES | display strings and index ids (canon dates are strings) |
| src/data/world.ts:124 Z90 | mathematical constant (normal 90th-percentile z) |
| src/data/world.ts:151 WORK_MONTH_MIN | unit conversion (167 h work-month in minutes) |
| src/data/world.ts:288 AIFM_YEARS | axis labels of the AIFM tables (years 2025-2032) |

Registered although not asked: `src/data/actors.ts:47 LAB_ARCHETYPES` (coverage line 4, in this chunk's files). LAB_ARCHETYPES leader row `computeMult` and `gapYears` are not registered (comment: "unused"). Not in coverage but registered: RIVAL_TPP (derived from REF_TPP).

## Inline overflow

The 40 inline entries are all in `src/data/world.ts`: per preset (ai2027, authors2026, fast, slow) g0 or hSCmin, T, decay, cs, pEx, sEx, G; slow sarSpeed, computeGrowth, computeElasticity; refCapCompute (0.68, 0.68e6, 3.4, 2.5, 1.6); globalCompute (3.5, 1.5); laborSlowdown 2029; computePace 0.5. Not registered (all `src/data/world.ts`; all unregistered values below are untagged unless the comment is quoted):

- world.ts:158, 162, 168, 175 `h0` per preset (22, 38, 26, 38) and `share` (0.5, 0.6, 0.6, 0.5), `growth` (string, 'super'/'exp')
- world.ts:147 `build()` defaults: `computeElasticity: 0.5`, `computeGrowth: 2.25`, `alignDifficulty: 1`, `doomThreshold: 0.4`, `chinaEfficiency: 1`, `neuraleseBoost: 1.3`
- world.ts:145 `base0: Math.max(2, ...)` floor 2; world.ts:139 loop step `n += 0.01`, guard 60 (loop guard, skip)
- world.ts:164, 170 `computeGrowth = 2.5` (authors2026, fast); world.ts:171 `neuraleseBoost = 1.4` (fast); world.ts:179 `neuraleseBoost = 1.15` (slow)
- world.ts:40-43 `agentFractions`: clamps 0.15, 0.5, 0.9, +0.2, fallback [0.3, 0.75] and the M anchors 0.5 and 2 (Agent-1 at 1.5x, Agent-2 at 3x; audit #2)
- world.ts:57-58 `speeds`: floor 25 for sarSpeed, 250 for SIAR, 2000 for ASI (header world.ts:7-8 "takeoff/params.yaml: 5, 25, 250, 2000")
- world.ts:113 horizon growth after SC `(p - s1) * 1.5` ("cosmetic growth after SC")
- world.ts:182-198 sampled-world distributions (header "Lifland Apr-2025 distributions (simple_params.yaml)"): copula rho 0.7 (a, b), growth-type cut points 0.45 / 0.9, 80% intervals T (2.5, 9), hSC months (1, 14400), cs (0.5, 30), delay (0.25, 6), pEx (0.03, 0.3), sEx (1.5, 40), zs mixing 0.7 / 0.51
- world.ts:199-208 takeoff gaps (takeoff/params.yaml, forecasting_takeoff.py): zA mix 0.8 / 0.6, G1 zero chance 0.15, 80% intervals G1 (1.5, 10), A (1, 25), E (0.3, 7.5), x = 10 + A, G2 `x^3 / 100 - x`, G3 game cap 20000, G1 stretch `ref = 25*5*ln5/20` and 25 (audit #6)
- world.ts:213 sampled `h0: 15`, `decay: 0.1`, `share: 0.5`; world.ts:215 `(3 + delay) / 12`; world.ts:217 `p0 * 12 + 3` (audit #19); world.ts:218 computeGrowth 2.25; world.ts:219 computeElasticity range (0.35, 0.7); world.ts:223 neuraleseBoost range (1.15, 1.5)
- world.ts:227-228 alignment: alignDifficulty easy 0.55, medium 1, hard 1.7, sampled lognormal80(0.5, 1.9); doomThreshold range (0.3, 0.5), default 0.4
- world.ts:233-235 erf (Abramowitz-Stegun constants, math)
- world.ts:309-310 globalCompute exponent split years (`years - 3.5`) is the registered 3.5; `refCapCompute` AIFM path x offset 2025.5 (start date; world.ts:306, 318)

Not in this chunk's coverage list but in the same files: v2 rivalModel/blocs/agents comments name no other numeric literals.

## B5 changes (CLASSIFY.md applied, 2026-11-25)

Kind counts, 250 entries: before sourced 54, unclear 136, designer 17, untagged 36, fitted 3, derived 2, stand-in 2; after sourced 134, designer 69, unclear 4, untagged 35, fitted 5, derived 3, stand-in 0.

**A1 (preset fields, checked one by one against research/07 lines 70-74, 159-163, 219-223 and research/10 lines 51-55).** 158 entries (excluding the leader row): 100 sourced, 54 designer, 4 unclear. Of the 136 that were unclear: 84 sourced, 48 designer, 4 unclear. The 16 gov, public and China weights were already sourced; the 5 lab weights are now sourced too (research/07 lists them), and the Gambler and Sprint China weights are checked against the sub-roll text. The helper `presetParams` now takes per-preset research rows (`rowOverride`): each field has an explicit cell and a missing cell throws, and the lint still compares every value with the live data.
- Fields a row does not list are `designer` ("not in research/07"). research/07-actors.md:18 says only "A preset is a set of multipliers on a common parameter schema"; it does not say that unlisted fields are baseline, so the baseline-1 reading was not applied.
- Code differs from the research number (designer, with "research/07 says X"): Big Tech `computeMult` 1.3 (07 says x1.5); lab `gapYears` for Safety, Big Tech, Open-Weights, Upstart (07 gives gaps in months: 2-6, 1-5, 4-9, 6-15; the code differs slightly); China Gambler `hawk` 80 (07:281 says +30, which is 75); Centralized Sprint `openSource` 0.3 (10 says "open -> 0.3 after rung 3"; the field has no rung condition).
- Absentee: "all biases 0.6" is read as the four *_bias params (accel, security, reg, hawk); `transactional` (1) and `pollSensitivity` (0.6) are not named, so they are designer.
- Populist `reg` 1.2 is sourced although research/07 conditions it on Public.Concern > 60 and the preset field carries no condition (noted in the entry).
- Centralized Sprint weight 10 is sourced: research/10 gives 15% with 1 in 3 the Gambler (about 5% overall).

**A9 (world.ts preset entries).** The comment above each one-line `build()` covers its fields; the `w.x = ...` statements after the call are outside it. Result: ai2027 `g0` and `pEx` moved sourced to fitted (script `manual`): the comment names them as the values that "reproduce" the scenario dates, and research/11-engine-audit.md:156,159 tags both "[D] fit". The other ai2027 fields stay sourced; authors2026 `cs` and `G` stay fitted (named); slow `sarSpeed`, `computeGrowth`, `computeElasticity` stay untagged (separate statements; `sarSpeed` is named in the comment but only as an adjustment).

**Other rows.**
- A7: `BASE_RUN_DAYS` is a literal copy of `bots.ref.REF_BASE_DAYS` (derived), so derived with the copy note. `CL_POOL_SHARE` copies `cap.STREAM_POOL_SHARE` (designer) and `CL_DAYS` copies `cap.STREAM_PERIOD_DAYS` (designer): stand-in to designer. The comment for `CL_DAYS` does not name `STREAM_PERIOD_DAYS`; "the player's rule at aggregate level" is read as covering it.
- A2: pointers moved into `source` for `BASE_RUN_DAYS`, `BASE_POOL_SHARE`, `RIVAL_TPP`, `REF_AGENT_SHARES`, `TRUST_EST_DEFAULT`, `MONITOR_STD_POOL_SHARE`, `BLOCS.agenda`, China `efficiency` (CAL-W).
- BLOCS `clout`, `cloutNov26`, `approval`: research/08-policy-ecosystem.md:664-690 states every value (checked all 15 rows: equal), but line 690 says "All clout and approval numbers are [D] calibrations", so designer with the table as source (was sourced, sourced, untagged). Flip to sourced if the lead reads "the cited text states this number" (A8a) as winning over the [D] tag.
- A10: no layer changed. Preset `weight` fields stay world; player defaults (`DEFAULT_CAP_SHARES`, `TRUST_EST_DEFAULT`, `MONITOR_STD_POOL_SHARE`, `SAFETY_AGENT_DEFAULT_SHARE`) stay policy; `SAFETY_AGENT_MAX_SHARE` and the rival timing constants stay world.
- Fixed stale line numbers in the `agents.ts` evidence strings (they pointed 100 lines past the end of the 80-line file; now :35-68).

## Open questions after B5

| id | question | evidence |
|---|---|---|
| Q-actors-data-7 | BASELINES `desc` strings ("Calibrated to measured data through 2026 ...") are UI text, not comments. CLASSIFY does not say whether a `desc` string counts as evidence; every start-state value stays `untagged` (valuation `designer`). | world.ts:268, 278 |
| Q-actors-data-8 | China Hawkish Gambler is a "sub-roll" of Centralized Sprint (research/10:54) and the row lists only taiwan 2.0 and treaty 0.4. Does it inherit the Sprint's centralize 1.6, theft 1.6 and open 0.3 (then sourced / sourced / designer, as the Sprint) or are unlisted fields designer? Left `unclear`: `gambler.centralize`, `.theft`, `.openSource`. | research/10-china.md:54 |
| Q-actors-data-9 | Centralized Sprint `hawk` 65 = start 45 [D] (research/10:39) + "hawk +20" (research/10:54). Is a sum of two research numbers `sourced`, `designer` (the 45 is [D]), or derived? Left `unclear`: `nationalizer.hawk`. | research/10-china.md:39, 54 |
| Q-actors-data-10 | `ENG_REF_SHARE` and `REF_AGENT_SHARES` are the reference agent-compute split of a lab (rivals read routine/frontier from it; the player's start split is built from it). World or policy (a rival's choice weights)? Left `world`. | agents.ts:35-41 |
