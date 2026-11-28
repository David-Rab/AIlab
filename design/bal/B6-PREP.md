# B6 prep: what the game is calibrated against

Facts and options for the designer's discussion. No decisions. Sources: `balance/targets.ts` (152 targets, loaded and counted by id), `balance/params/*.ts` (1823 params), `src/data/world.ts`, `src/data/v2/{calibration,workTypes}.ts`, `src/engine/v2/world/hidden.ts`, research notes. Nothing under `src/`, `balance/`, `scripts/` was changed; no game was run.

Classification rule used: the date of the compared quantity decides; where a 2026-dated value is quoted from the AI 2027 scenario rather than measured, it is **future-scenario, marked †** (the source is a forecast, even though the date is past). Judgement calls are marked "unsure".

## 1. History vs future targets

| Class | Count | Notes |
|---|---|---|
| history | 32 | 11 pinned to `ai2027`, 1 to `authors2026`, 20 unspecified (run on the default preset) |
| future-scenario | 70 | T1 21, T1L 13, GOLD 17 (the same golden dates measured three ways, 51); 19 others |
| response | 16 | direction or size of an effect (shocks, inoculation, anti-scheming, China after theft) |
| gameplay | 15 | 7 bot win/loss rows, 5 START (difficulty, catch-up), S4 safe recipe, S5 margin, F8 no-distress |
| structural | 19 | knot table, elasticities, build-queue, canary, cognitive-only ceiling, startM (RS.*), tree durations |
| **total** | **152** | |

Per-preset split of the 70 future targets: `ai2027` 21, `authors2026` 14, `fast` 13, `slow` 5, `sampled` 1, preset-free 16. Every dated milestone target belongs to exactly one preset's golden path: the future side today is "one dated path per preset", not a band.

### 1a. History targets (32)

| id | statement (short) | source | date of the measurement |
|---|---|---|---|
| GPATH.ai2027.2026 | best model's G path 1.1-1.3 G/yr vs 5 frontier anchors | calib.ts frontier anchors (CAL2) | 2025-08-15 to 2026-10-15 |
| METR.h50.doubling | 50% horizon doubles every 4.2 mo (3.2-5.2) | METR TH1.1; research/20:50 | 2023-2026 |
| STACK.pretrainRate.ai2027 | pretraining stack 0.48 OOM/yr, +-30% | Ho et al.; research/20:33 | trend to 2024 |
| GOLD.authors2026.h80 | 80% horizon ~186 min | AIFM present horizon, research/03:203 | 2026.27 (Aug 2026 run, horizon of an early Mythos Preview) |
| T4.rival.gaps | rivals 0-11 months behind | CAST-2025 | Jul 2025 start |
| CAST.china.startLead, CAST.china.trailMean | China 6.5-8 months behind at the start; mean trail 90-270 d | npc/CAST-2025.md; real Nov 2026 6.5 mo, research/10:279 | Jul 2025 start |
| F1.production2026 | ~25M H100e produced | Epoch, research/15:445 | 2026 (Q2 2026 6.33M/q, research/15:27) |
| F6.supplierMargin | supplier margin 70-75% | Nvidia 72-75%, research/15:450 | Q4 2025 to Q4 2027 (straddles; 2027 half is a forecast) |
| F7.revenue2026 | $36-67B (AI 2027 $45B; Anthropic CY2026 $53-56B) | research/22:228-262 | 2026 (9M 2026 $33.2B measured; Q4 estimated; unsure) |
| F9.fc1.start, F9.fc1.late2026 | private marks $0.45-0.75T at start, $2.2-3.3T late 2026 | research/15 marks | Jul 2025, Oct 2026 to Jan 2027 |
| F9.fc2.leaderMultiple | leader valued 20-37x run-rate | research/15:455 C11 [P][D] | 2025-26 rounds (unsure: tag [P][D]) |
| F9.dilution, F9.dilutionCap | round dilution 5-8%, anchored <=14%, IPO 5% | research/15:456 C12 [P][S] | 2025-26 rounds |
| F10.sitesBlockedDelayed, F10.siteBuild | 5-10% sites blocked, 8 quarters to live | research/15:458-459 C14, C15 | undated 2025-26 |
| F11.startRunRate | run-rate $12B | V2-SPEC §7.2 F11 | Jul 2025 |
| W4.aggregateU, W4.youthExposed, W4.firmAdoption | reality baseline: U ~0, exposed youth 19% below, 17-20% firms | BTOS 17.7 to 19.8% (research/22 row 1f); V2-SPEC §7.3 W4 | Nov 2026 / May 2026 |
| A2a.hoursOfUse2026, hoursSaved2026, workers2026, savedPerHour | 6.3% hours, 2.2% saved, 40% workers, 0.35 h/h | Bick/Blandin/Deming RPS, research/22:28-31 | Q2 2026 |
| A2b.paidShare2026 | paid share of AI users ~5-6% | research/22 row 2e | 2026 |
| F2.sabotageAfterHacking, MO.anchor.sabotage (deleted 2026-11-28, H) | sabotage on 12% of runs after learned hacking | MacDiarmid 2025 | 2025 |
| F5.evalAwareness2026, F5.afComplianceGap2026 | eval awareness 20-50%, AF gap 0-15% | research/05 §1.4, §1.7 | late 2026 |
| DANGER.start.actRate, .common, .rareActs | 0.4-3 incident acts/lab-year; sabotage/scheming ~0 | research/05 §1.1-1.10 | 2025 |

### 1b. Future-scenario targets (70)

| ids | which scenario or forecast |
|---|---|
| T1/T1L/GOLD `ai2027` SC, SAR, SIAR, ASI (+ A1, A2, M1.5/3/10/50) (18) | AI 2027 scenario dates (SC 2027.24 ... ASI 2028.0); A1 2026.07, M1.5 2026.07 and M3 2026.96 are dated before now and could be checked against reality † |
| T1/T1L/GOLD `authors2026` (14) | AI Futures Model, Eli medians (AC 2029.16; ASI ~2033.7; research/11:198-218) |
| T1/T1L/GOLD `fast` (13) | Daniel AC 2027.92 + AI 2027 p10 takeoff (research/11:220-233) |
| T1/T1L/GOLD `slow` (5) | AIFP Dec 2025 "pure exponential ... AC in 2034" (research/11:235-250; CAL-world-sources.md:130-148) |
| GOLD.sampled.SC | Eli Apr 2025 distributions, p10/p50/p90 2026.05/2028.37/2044 (research/11:168-196) |
| T2.labour.SCband | AI 2027 ~200k copies at ~30x at SC |
| F2.production2027 | 45-60M H100e in 2027 (research/15:446, AI27 + Epoch trend) |
| F9.fc2.2027, F9.fc2.2026 | multiple stays 20-37x in 2027 (2026 half is history; straddles) |
| F11.revenue2027 | AI 2027 $140B in 2027 |
| W.equity2026 (deleted 2026-11-28, H) †, W.aggregateU2026 † | AI 2027 "stock market up 30% in 2026", "aggregate U < +0.3 pp" (research/16:353, 424); dated 2026 but a forecast |
| W.hireRate10, W.aiFriend2027, W.remote25, W.unemployment12m, W.govAccept85 | AI 2027 scenario, Jul to Dec 2027 (research/16:461) |
| W2.normalTechTFP (deleted 2026-11-28, H) | Acemoglu 0.5-1% TFP/decade under the Normal Technology econ preset (research/16:314, 451) |
| S4.refBot.pMis | authors' credences 0.4-0.8 (scripts/v2/safety.ts:148-158) |
| S5.refBot.belowL (deleted 2026-11-28, H) | design reading of AI 2027 text, Apr 2027 |

† Also quoted from AI 2027 for 2026 but filed here, not under history: F7.capex2026, F7.compute2026, F7.power2026, F7.valuation2026 (research/15:451 "C7 [AI27]"), F8.fundingMix (derived from C7). They are 5 more † rows inside the 70.

Response (16): T3.china.afterTheft (deleted 2026-11-28, H), F4, F5.spot x2, F8.noRescue, F8.capex2x, F9.fc2 x2 orderings, F9.doubtShock, F2.inoculation x3, F5.antiScheming.cut, F6.persistence.scheme, S5.mixedVsRef.sightLimit, W.youthSoft2026 (direction; its source is AI 2027 and is checkable now). Several response sizes also come from measured 2025 papers (MacDiarmid, Schoen, Hubinger): they are history-sourced responses.

## 2. Candidate scenario axes

Registered param counts come from `balance/params/*.ts`. "Unregistered" means an inline literal with no registry id.

### Axis A. Capability difficulty and horizon trend ("when does AI reach SC, how fast does the horizon grow")
- Registered (21): `acd.world.<p>.{g0|hSCmin, T, decay, cs}` (4 x 4 presets = 16) and `cap.V3_CAL.<p>.gSC` (5). Unregistered: `h0`, `share`, `growth`, the `sampled` draws (world.ts:197-213).
- Values: ai2027 g0 28.5, T 4.74, super, decay 0.1, cs 3.9, gSC 30.15. authors2026 hSC 125 work-yr, T 4.5, super, decay 0.08, cs 17, gSC 34.09. fast hSC 1 work-yr, T 4.0, decay 0.08, cs 10.3, gSC 31.25. slow hSC 120 work-mo, T 7 plain exponential, cs 3.87, gSC 38.3 (stand-in). sampled: lognormal draws, gSC 30.15.
- Range sources give:
  - G_SC 29.9-38.2 for the AI 2027 timelines forecast (Nikola p10 16 h to Eli p90 1,200 work-years): `src/data/v2/workTypes.ts:279-281`.
  - Daniel's AC horizon 1 work-year [0.05, 20] gives G_SC 31.1-35.3: `workTypes.ts:284`.
  - Eli's 125 work-year [0.1, 156,250], doubling 4.5 mo [2.2, 9.2], decay 0.92 [0.82, 1.02]: `research/03-timelines-takeoff.md:204-206`.
  - AI 2027 h_SC [1, 14400] months, T [2.5, 9] months, cs [0.5, 30]: `research/03-timelines-takeoff.md:149-155`.
  - Skeptic: METR 7-month doubling; AC "in 2034" with a pure exponential trend: `research/CAL-world-sources.md:130-148`.
- Present METR measurement (history): 32 min Dec 2025, 70 min Apr 2026, 186 min Aug 2026 (`research/03-timelines-takeoff.md:203`).

### Axis B. Takeoff speed (after SC: how fast do SAR, SIAR, ASI follow)
- Registered (28): `acd.world.<p>.{pEx, sEx, G}` (3 x 4 = 12, plus slow `sarSpeed` 1) and `cap.V3_CAL.<p>.{dBM, r, sdSC}` (15). Unregistered: `neuraleseBoost` (1.3, 1.4 fast, 1.15 slow, U(1.15, 1.5) sampled; research/11 table lists "no source"), `PROD_PRESETS` La/slow10/m2b for authors2026 (3 registered).
- Values: ai2027 G [4.19, 16, 49.5], dBM 1.8, r 4, sdSC 0.5. authors2026 G [1.52, 101, 1340], dBM 2.17, r 3.19, sdSC 2.94. fast G [0, 7.67, 47.5], dBM 0.6, sdSC 0. slow G [10, 394, 2000], pEx 0.01, sEx 0.6, dBM 1.6.
- Range sources give:
  - Taste at AC N(0.5, [-2.5, 3.5]) Eli, N(0, [-3, 3]) Daniel; taste slope 2.3 [0.8, 6.6]: `research/03-timelines-takeoff.md:219-220`.
  - Takeoff b median 1.21, P(b<1) 38%, AI 2027 implied 0.64-0.78: `research/03-timelines-takeoff.md:227`.
  - SC to SAR 0.3 y (p90 0.95), SAR to SIAR 0.3 [0.04, 56], SIAR to ASI 0.16 [0.01, >100]: `research/03-timelines-takeoff.md:195`.
  - r_cog median 1.2, log-uniform 0.4-3.6, game r 1.33-12 at p = 0.3: `research/CAL-world-sources.md:37-73`.
  - fast dBM 0.6 is Daniel's slope p90, "chosen for the preset's identity": `research/CAL-world-sources.md:109-128`.

### Axis C. Compute growth (physical supply and the leader's path)
- Registered (13): `acd.world.{AIFM_WORLD, AIFM_LEADER}` (2), `refCap.*` (5), `globalCompute.{breakYears, postCap}` (2), `computePace.factor`, `laborSlowdown.year` (2), slow `computeGrowth` and `computeElasticity` (2). Unregistered: `computeGrowth` 2.25 / 2.5 (aifm presets) and the `aifm` flag, sampled `computeElasticity` U(0.35, 0.7) (world.ts:147-179, 218-219).
- Values: ai2027 and sampled 2.25x/yr to 2029, then 1.5x; leader path 3.4x/yr for 2.5 y then 1.6x. authors2026 and fast use the AIFM `world_H100e` table (8.6M in 2025 to 1.51B in 2032, `world.ts:289-290`; yearly ratio 2.6 falling to 1.65 by my arithmetic). slow 1.8 and elasticity 0.7.
- Range: research/11 §5.1 "2.25 to 2029.0, then 1.5"; research/15:446 "global production 45-60M in 2027" and research/15:101 "~1.6-1.7x/yr after 2028"; Epoch production 2.5x/yr 2024-26, decelerating to 2.2x by Q2 2026 (`research/15-compute-finance.md:27`). slow 1.8 has no source and contradicts research/11 #18 (`research/CAL-world-sources.md:150-156`). In v2 it feeds only the world compute (`engine/v2/worldfx/macro.ts:48`) and the leader's compute (`compute/market.ts:102`, `production/ces.ts:77`).

### Axis D. Alignment difficulty
- Registered (5): `cap.hidden.alignmentShift` 0.8, `cap.hidden.difficultyExponent` 0.35, `cap.DIFFICULTY_RANGE` [0.6, 1.65], `core.DIFFICULTY_SCALE` 1, `saf.CONTROL.toleranceSd` 0.06. Plus the agenda priors/loadings (`saf.AGENDAS.*`) that the latents move. Unregistered: `world.ts:227-228` (`alignDifficulty` 0.55 / 1 / 1.7 / LN80[0.5, 1.9]; `doomThreshold` 0.4, or U(0.3, 0.5) when sampled).
- How it works in v2: the selector (`easy|medium|hard|sampled`) shifts two latents by +-0.8 (`hidden.ts:85`); `doomThreshold` is 0.4 for easy/medium/hard and U(0.3, 0.5) only when sampled; `alignDifficulty` is drawn but not read by v2 (the glossary names it). So `medium` vs `sampled` differ only in the doom threshold; the default is `sampled` (`core/init.ts:67`).
- Range sources give: no source for the shift or the threshold (`research/14-safety-agendas.md:41-54`, "All numeric parameters are [D]", line 68). Outcome credences exist: Kokotajlo 70% doom, Larsen 75% misaligned successors, Alexander 20% + 30%, AI Goals Forecast 40-80% (`scripts/v2/safety.ts:148-158`), Carlsmith ~25% scheming (`research/14-safety-agendas.md:52`).

### Axis E. Adoption and diffusion (the "econ" preset)
- Registered (16): `mkt.ECON_PRESETS.{normal, ai2027, gate}.{diffMult, frictionScale, sigma, robotFloorYears, nu}` (15) and `cap.hidden.econWeights` [35, 45, 20].
- Values: normal diffMult 0.4, friction 1.5, sigma 0.35, robot floor 2 y, nu 0.5. ai2027 1.0 / 1.0 / 0.5 / 1 y / 0.3. gate 1.5 / 0.6 / 0.7 / 0.25 y / 0.15.
- Range: `research/16-world-effects.md:356-370`, a [D] table citing Narayanan & Kapoor ("diffusion occurs over decades"), Humlum-Vestergaard null results, GATE runs. Acemoglu TFP +0.7% per decade at ~5% of tasks automatable: `research/16-world-effects.md:314, 451`. Measured 2025-26 adoption (history): research/22:23-61.

### Axis F. China and geopolitics
- Registered: 58 for China (`acd.CHINA_PRESETS.<6>.{weight, centralize, theft, taiwan, treaty, openSource, efficiency, hawk}` 48; `act.china.*` 10). Neighbours: gov presets 45, public presets 35, lab archetypes 34.
- Not tied to the world preset: gov, public, China, rivals all default to `realistic` (a weighted draw per game, `core/init.ts:69`). China weights 35/20/20/10/5/10 (`actors.ts:34-41`).
- Range: preset weights from "2023-26 behavior", lowered from 30% to 15% for AI 2027's China (`research/10-china.md:45-47`); gap formula 10.8 months per 10x compute, "about 6.5 months ... matches real Nov 2026" (`research/10-china.md:41-43`); `chinaEfficiency` 1 on every preset (`research/CAL-world-sources.md:12-35`).

### Axes the presets vary that are not on the designer's list
- **Start-state "history" that varies by preset**: `cap.START_STATE.<p>.{g, b0, v0}` (15, all derived): `g` 27.60 (fast) to 27.77 (slow). `RS.*.startM` targets 1.25 / 1.10 / 1.15 / 1.01. `h0` 22 / 38 / 26 / 38 / 15 (unregistered). `BASELINES.{classic, reality}` (26 params): cash $40 vs $45B, valuation $610B vs $300B, rival gap x0.3 under `reality` (`rivals.ts:81`).
- **Production-function returns**: `PROD_PRESETS.authors2026` La 15, slow10 2.8, m2b 3.7 vs default 100 / 2.5 / 3.25; sampled La = 1 + LN80[1, 200].

## 3. Presets placed on the axes

| axis | ai2027 | authors2026 | fast | slow | sampled |
|---|---|---|---|---|---|
| A horizon trend and SC threshold | T 4.74 super; gSC 30.15 | T 4.5 super; hSC 125 wy; gSC 34.09 | T 4.0; hSC 1 wy; gSC 31.25 | T 7 exp; gSC 38.3 | lognormal draws; gSC 30.15 |
| B takeoff | G [4.2, 16, 50], dBM 1.8 | G [1.5, 101, 1340], dBM 2.17 | G [0, 7.7, 47.5], dBM 0.6 | G [10, 394, 2000], dBM 1.6 | lognormal draws; dBM 1.8 |
| C compute growth | 2.25x/yr, leader 3.4x | AIFM table 2.5x | AIFM table 2.5x | 1.8x (unsourced) | 2.25x |
| D alignment | not varied (separate selector, default `sampled`) | same | same | same | same |
| E adoption (econ) | `ai2027` | drawn 35/45/20 | drawn 35/45/20 | drawn 35/45/20 | drawn 35/45/20 |
| F China, gov, public | not varied (`realistic` draws) | same | same | same | same |
| production returns | default | La 15, slow10 2.8, m2b 3.7 | default | default | La drawn |
| start history (G(V0), h0) | 27.66, 22 | 27.63, 38 | 27.60, 26 | 27.77, 38 | 27.69, 15 |

Mixed identities (several axes in one preset):
- `fast` = Daniel's timelines (axis A) + AI 2027 p10 takeoff (axis B) + the AIFM compute table (axis C) (`research/11-engine-audit.md:220-233`).
- `slow` = METR plain-exponential trend (A) + a sceptic takeoff, pEx 0.01 and sEx 0.6 (B) + compute 1.8 and elasticity 0.7 (C) + a different start G(V0) (history). Its SC date is reached through a stand-in G_SC 38.3 because "no mechanism carries" the slower trend (`workTypes.ts:315-317`).
- `authors2026` = Eli's timelines (A) + Eli's taste and slopes (B) + AIFM compute (C) + its own production returns.
- `ai2027` default also sets econ `ai2027`; other presets leave econ sampled. Alignment and China never follow the world preset.

## 4. Gaps

### 4a. Axes with no sourced range
- Adoption: the econ table is tagged [D] in the research (`research/16-world-effects.md:356`) but 15 registry entries say `sourced` (the CLASSIFY.md rule says a note that tags [D] makes the entry `designer`). Only three points exist, no range per parameter.
- Alignment: no source for the +-0.8 shift or doomThreshold 0.3-0.5. Authors' credences (0.2-0.8) are outcomes, not parameters. `easy` and `hard` change only the latent shift; the threshold stays 0.4.
- China aggressiveness: weights are [D] (`research/10-china.md:45`); `centralize`, `theft`, `openSource` have `unclear` entries in the registry.
- Compute growth for `slow` (1.8) and elasticity 0.7: unsourced (`research/CAL-world-sources.md:150-156`). `neuraleseBoost` has "no source" for any preset (`research/11-engine-audit.md`, §5.4 table).
- Takeoff: a low-returns slow world needs a designer choice of Forethought's tail (`research/CAL-world-sources.md:67-73`); `authors2026` `cs` and `G` are fitted, not sourced.
- Inline per-preset literals not in the registry: `h0`, `share`, `growth`, `aifm`, `computeGrowth` 2.25/2.5, `neuraleseBoost`, the sampled `lnFrom80` ranges, `alignDifficulty`, `doomThreshold`.

### 4b. History numbers a research note holds but no target in `balance/targets.ts` checks
- METR horizon levels: 32 min Dec 2025, 70 min Apr 2026, 186 min Aug 2026 (`research/03-timelines-takeoff.md:203`). Only the doubling rate and an integrator row exist; the game's own horizon level is not a target.
- Chip production growth: "2.5x a year from 2024 to 2026: 0.83M to 6.33M H100e per quarter ... 2.8x y/y by Q2 2025 and 2.2x by Q2 2026" (`research/15-compute-finance.md:27`). F1 checks only the 2026 total.
- Hyperscaler capex 2026 "~$810-835B, 5 firms, +-15%" (`research/15-compute-finance.md:454`, C10): no target.
- Anthropic revenue path: Q3 2025 $1.4B to Q3 2026 $17.0B; run-rate $14B (Feb 2026), >$47B (May), $81B (Oct) (`research/22-demand-anchors.md:23-61`, rows 4a-4c; §4 at :228). Targets hold the 2026 total and the Jul 2025 start only, not the growth curve.
- Price decline for fixed capability "x10/yr (x9 to x900)", API gross margin 0.6 (0.4-0.85) (`research/20-model-v3-calibration.md:48-49`); RL/pretraining compute ratio 0.1-0.5 (`:40`); 80%/50% horizon ratio 1/5 (`:51`).
- Usage growth 2025 to 2026: developers using AI daily 50.6% to 73%, M365 Copilot seats 15M to 30M+, ChatGPT WAU 700M to 900M (`research/22-demand-anchors.md` rows 6a, 4e, 2c; "Growth 2025 to 2026" table at :354-360). US hours assisted went 4.1, 5.6, 6.3, 5.3% (row 1b): A2a pins 6.3% and does not constrain the later fall.
- China gap measured Nov 2026 ~6.5 months (`research/10-china.md:279`): T3 says 150-200 days (5-6.6 months): consistent, but T3's source is the AI 2027 text, not the measurement.
- History held only on one preset: 11 of 32 history targets are pinned to `ai2027` and none to `slow` or `fast`, although `slow` has T 7 vs the measured 4.2 months doubling. No target checks that every preset passes through the same 2025-26 history.

## 5. Open questions for the designer
1. Do 2026-dated values that came from the AI 2027 forecast (equity +30%, F7 capex/compute/power/valuation, A1 2026.07) get replaced by measured 2026 numbers, or dropped?
2. Should the start state (G(V0) 27.60-27.77, startM 1.01-1.25, h0 22-38, classic vs reality baseline) become one measured history shared by every preset?
3. Is "SC threshold plus horizon trend" (axis A) a separate axis from "takeoff speed" (axis B), so today's four named presets become points on a grid instead of bundles?
4. Is China (and gov/public posture) a scenario axis, or a per-game random setup option as it is now (`realistic` weights independent of the world preset)?
5. Should alignment difficulty be anchored to the authors' misalignment credences (0.2-0.8) or stay a designer scale on the doom threshold?
6. Do the future targets keep three copies of the golden dates (T1 RefBot, T1L leader lab, GOLD integrator: 51 of 70), or one measure per scenario plus bands?
