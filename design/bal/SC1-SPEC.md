# SC1: calibration checkpoint spec (draft for designer review)

Draft, 2026-11-25. Follows [SCENARIOS.md](SCENARIOS.md); evidence base [B6-PREP.md](B6-PREP.md). Gathers sourced numbers only; no game change, no game run. Every number carries a source (`file:line` or URL). "unsure" = judgement call or a source conflict. "no band in source" = the source gives a point or a story, not a range; any tolerance quoted is the game's own (`GOLDEN_TOL` SC +-0.08 y, after-SC +-0.12 y, calibration.ts:97), not the source's.
Type: point / rate / trajectory / response. "Target today": Y = id exists in `balance/targets.ts`; N = new id; P = exists but pinned to one preset or to a different quantity.
Game start is 2025-07-01 (`GOLD_DAYS` days count from it, targets.ts:36-41); "the present" is late 2026.

## 1. Shared history (to late 2026): must hold in every cell

| id | quantity | date | value | band | source (file:line; original) | target today | type |
|---|---|---|---|---|---|---|---|
| H1 `METR.h50.doubling` | METR 50% horizon doubling time | 2023-26 | 4.2 mo | 3.2-5.2 (3.4-5.2; 6.2 all-time) | research/20:50; METR TH1.1 (research/03:276: 129 d since 2023 [104,158]; 88.6 d since 2024) | P (ai2027 RefBot only, targets.ts:196) | rate |
| H2 `METR.h80.level` | METR 80% horizon of the frontier | Apr 2025 / Dec 2025 / Apr 2026 | 30 / 66 / 186 min | Apr 2026 95% CI [97, 399]; Dec 2025 GPT-5.2 66; game tolerance +-15% (targets.ts:109) | research/09:59 (METR TH1.1); table research/03:262-274 | P (`GOLD.authors2026.h80`, v1 integrator only) | point x3 |
| H3 `METR.h50.level` | METR 50% horizon | Aug 2025 / Feb 2026 / Apr 2026 | 203 [113,406] / 719 [317,3634] / 1045 [509,3304] min | 95% CIs as listed; METR: ">16 h unreliable" | research/03:262-274; V0 = 203 at `H50_V0_MIN` workTypes.ts:143. Dec 2025 5.9 h: research/09:59 | N | point x3 |
| H4 `METR.h80over50` | p80/p50 ratio | 2025-26 | 1/5 | 1/4 to 1/10 | research/20:51; workTypes.ts:147 | N | point |
| H5 `GPATH.ai2027.2026` | frontier effective-compute path G | 2025-08-15 to 2026-10-15 | 28.0, 28.4, 28.7, 29.0, 29.4; 1.1-1.3 G/yr | +-0.2 G per anchor | research/12 §0.2 via calib.ts:285-291 (targets.ts:183) | P (ai2027 only) | trajectory |
| H6 `STACK.pretrainRate` | pretraining stack growth | to 2024 | 0.48 OOM/yr | +-30% | Ho et al.; research/20:33 B1 (targets.ts:209) | P (ai2027 only) | rate |
| H7 `F1.productionGrowth` | global chip output (H100e) | 2024 to Q2 2026 | 0.83M to 6.33M per quarter: 2.5x/yr; 2.8x y/y Q2 2025; 2.2x Q2 2026 | no band in source | research/15:27 (Epoch) | N (F1.production2026 = 25M [20,30M] is a level, targets.ts:552) | rate |
| H8 `F1.worldCompute` | world AI compute stock (H100e) | Jul 2025 / Jan 2026 / end-2026 | ~9M / >15M / ~40M | end-2026 35-46M; stock 3.3x/yr since 2022 (CI 2.7-4.1) | research/09:43, :72-74 (Epoch) | N (F3.installedStock compares the game with itself, targets.ts:576) | trajectory |
| H9 `F1.leaderCompute` | leading-lab compute (OpenAI) | end-2024 / end-2025 | 386K / 1.74M; growth ~3.5x/yr | end-2025 90% CI 1.25-2.19M | research/09:42, :73 (Epoch) | N | trajectory |
| H10 `F7.hyperscalerCapex` | 5 hyperscalers' capex | 2026 | $810-835B (big-4 $700-725B) | +-15% | research/15:454, :555-565 (company filings); research/09:44 | N (F7.capex2026 is the AI 2027 lab figure $200B, a forecast, targets.ts:648) | point |
| H11 `F7.revenueCurve` | Anthropic revenue / run-rate | Q3 2025 to Q3 2026; Feb, May, Oct 2026 | $1.4B to $17.0B per quarter; run-rate $14B, >$47B, $81B; FY2025 $4.585B; 9M 2026 $33.2B | no band in source | research/22:23-61 rows 4a-4c, :228-262 (Anthropic S-1) | P (F7.revenue2026 $36-67B level; F11.startRunRate $12B, targets.ts:636, :860) | trajectory |
| H12 `P.priceDecline` | price decline at fixed capability; API gross margin | 2025-26 | x10/yr; margin 0.6 | x9 to x900/yr; 0.4-0.85 | research/20:48-49 (Cottier 2025; DeepSeek) | N | rate |
| H13 `F9.valuations` | private lab marks | Jul 2025; Oct 2026-Jan 2027 | $0.45-0.75T; $2.2-3.3T | as stated | research/15 §2.9 (targets.ts:744) | Y `F9.fc1.privateMarks` | trajectory |
| H14 `F2.inoculation.*` | inoculation prompting cuts hack-induced misalignment / alignment faking / sabotage | 2025 | cut 75-90% / 75-90% / 75-95% | as stated | MacDiarmid 2025 (targets.ts:1182-1206) | Y | response |
| H15 `F5.antiScheming.cut` | anti-scheming training cuts covert actions | 2025 | 90-98% (o3 13% to 0.4%; o4-mini 8.7% to 0.3%) | as stated | Schoen 2025 (targets.ts:1218) | Y | response |
| H16 `F2.sabotageAfterHacking` | sabotage on safety-research runs after learned hacking | 2025 | 12% | 6-20% | MacDiarmid 2025 (targets.ts:1170) | Y | point |
| H17 `F6.persistence.scheme` | safety training leaves a SCHEME behaviour | 2024-26 | persists 80-100% | as stated | Hubinger 2024; research/20 F6 (targets.ts:1258) | Y | response |
| H18 `F5.evalAwareness2026`, `F5.afComplianceGap2026` | verbalised eval awareness; AF compliance gap | late 2026 | 20-50%; 0-15% | as stated | research/05 §1.7, §1.4 (targets.ts:1230, :1244) | Y | point |
| H19 `DANGER.start.actRate` | incident acts per lab-year | 2025 | ~1.2 | 0.4-3 | research/05 §1.1-1.2 (targets.ts:1295) | Y | point |
| H20 `T3.china.gap2026` | best Chinese model behind US frontier | Nov 2026 | ~6.5 mo (ECI), 6.6 (horizon); CAISI 8 mo | 6.5-8 | research/10:27, :135, :279 (IFP Oct 2026; CAISI May 2026) | P (CAST.china.startLead is the Jul 2025 start lead, a different date) | point |
| H21 `A2a.*` | US AI use at work | Q2 2026 | 6.3% of hours; 39-41% of workers; 2.2% hours saved; 0.35 h saved per h | 5-6.5%; 35-45%; 1.7-2.7%; 0.3-0.4 | research/22:23-31 (Bick, Blandin, Deming RPS) (targets.ts:981-1017) | Y | point |
| H22 `W4.firmAdoption` | US firms using AI | Jan to May 2026 | 17.7% to 19.8% | 15-22% | research/22 row 1f (BTOS, Census) (targets.ts:1067) | Y | point |
| H23 `A2b.paidShare2026` | paid share of AI users | 2026 | ~5.6% | 4-9% | research/22 row 2e (targets.ts:1029) | Y | trajectory |
| H24 `A2.usageGrowth` | usage growth | 2025 to 2026 | ChatGPT WAU 700M (Jul 2025) to >900M (Feb 2026); M365 Copilot seats 15M to 30M+; devs using AI daily 50.6% to 73%; hours assisted 4.1, 5.6, 6.3, 5.3% (Q3'24 to Q3'26) | no band in source | research/22:23-61 rows 2c, 4e, 6a, 1b; :354-360 | N (A2a pins only the 6.3%) | trajectory |
| H25 `W4.labour` | aggregate unemployment effect; exposed youth 22-25 | Nov 2026 | ~0; 19% below counterfactual | +-0.15 pp; +-5 pts | research/09:53 (Stanford "Canaries"); targets.ts:1041-1054 | Y | point |
| H26 `RS.uplift2026` | AI R&D uplift | Oct 2026 | ~2x pace (METR est. for Anthropic), ~1.7x AI-attributable; Anthropic internal 2x coding uplift | METR 1.3-3x | research/09:45 | P (`RS.<p>.startM` is the v1 M at the start, targets.ts:170) | point |

Notes. (a) Conflict on the Dec 2025 80% horizon: 32 min (AIFM anchor, research/03:203) vs 66 min (GPT-5.2, research/09:59, research/03:269); I use 66 (unsure). (b) Conflict on world compute: the game's starts are 13M (`classic`) / 14M (`reality`) (world.ts:269, :279) vs ~9M measured Jul 2025 (research/09:72). (c) The AI 2027 forecast values dated 2026 stay out of history: `F7.capex2026/compute2026/power2026/valuation2026`, `W.equity2026` (deleted 2026-11-28, H) (+30% forecast vs about +11-12% measured, research/09:52), `GOLD.ai2027.M1.5/M3`. Replace by the measured rows above if the designer agrees (Q5). (d) Rival gap: measured US frontier near-tie 0-2 mo (research/09:46) vs `T4.rival.gaps` 3-9 mo (R07); rivals "stay as they are" per SCENARIOS, so noted only.

## 2. Shared start state

All of these must become one measured start (SCENARIOS: one shared start state). Today they differ by preset:

| parameter | ai2027 | authors2026 | fast | slow | sampled | source | pinned by |
|---|---|---|---|---|---|---|---|
| `START_STATE.g` = G(V0) | 27.6585 | 27.6270 | 27.6001 | 27.7662 | 27.6918 | calibration.ts:38-44 | H3 (V0 = 203 min Aug 2025), H5 (G 28.0 anchor Aug 2025) |
| `START_STATE.b0` (B0 pretraining recipe, OOM) | 0.8540 | 0.8245 | 0.7993 | 0.9550 | 0.8852 | calibration.ts:38-44 | H6 |
| `START_STATE.v0` (V0 RL recipe, OOM) | -0.0411 | -0.0434 | -0.0454 | -0.0332 | -0.0387 | calibration.ts:38-44 | H6, H3 |
| `h0` (v1 horizon at start, min; read by v1 code only, see §4) | 22 | 38 | 26 | 38 | 15 | world.ts:158-175, :213 (unregistered) | H2 (30 min Apr 2025, 66 Dec 2025) |
| `RS.<p>.startM` (research-speed readout) | 1.25 | 1.10 | 1.15 | 1.01 | n/a | targets.ts:170 (v1 `multiplierAt`, `pEx` 0.25/0.1/0.15/0.01) | H26 (~1.7x measured Oct 2026; start value unsourced) |
| `PROD_PRESETS` (La, slow10, m2b) | 100, 2.5, 3.25 | 15, 2.8, 3.7 | default | default | La drawn 1+LN80[1,200] | calibration.ts:70-73; hidden.ts:49 | H1, H5 (research output sets G growth) |
| world compute growth / table | 2.25x/yr from 13M | AIFM table 8.6M (2025) to 22.4M (2026) | same | 1.8x/yr from 13M | 2.25x | world.ts:147-178, :289-290, :306-311 | H8 (40M, 35-46M end-2026) |
| `BASELINES` (default `classic`) | cash $40B, run-rate $12B, valuation $610B, compute 1.2M, global 13M | `reality`: $45B, $13B, $300B, 1.0M, 14M | | | | world.ts:264-282 | H10, H11, H13, H8 |

Hand-computed end-2026 world compute from the code (years = 1.5 from Jul 2025): `ai2027` 13M x 2.25^1.5 = 43.9M (inside 35-46M); `slow` 13M x 1.8^1.5 = 31.4M (below); AIFM table 57.1M at 2027.0 (above; 35.8M at 2026.5). Source: world.ts:305-311, :289-290 (unsure: my arithmetic).

## 3. Timelines: fast / central / slow

Existing presets: fast = `ai2027`; central = `authors2026`; slow = `slow` (unsourced today). The Daniel preset `fast` (AC 2027.91, AI 2027 p10 takeoff) is a separate preset and falls out of the grid unless kept (Q1).

### 3a. fast = AI 2027 (preset `ai2027`)
Source model: AI 2027 scenario + timelines/takeoff forecasts, https://ai-2027.com/research/timelines-forecast and /takeoff-forecast (research/03:236 row 1, §2.1-2.2).

| checkpoint | date | value | band | source | target today | type |
|---|---|---|---|---|---|---|
| internal 80% horizon, median superexp trajectory | 2026.27 | ~179 min (exp branch ~123) | no band in source | research/03:258 | N | point |
| 80% horizon, central AI 2027 trajectory | end-2026 | ~3 work-weeks (80%) | no band in source; AIFP graded measured horizon 1.04x of trajectory through 2025 | research/09:59 | N | point (unsure: conflicts with the 179 min at 2026.27 if on one curve) |
| R&D multiplier M | 2026.07 / 2026.96 / 2027.5 / 2027.8 | 1.5x / 3x / 10x / 50x | no band in source | research/03:236; targets.ts `GOLD.ai2027.M*` | Y (GOLD only) | point x4 |
| SC | 2027.24 (Mar 2027) | day 638 | no band in source (AI 2027 forecast CI Eli 2025-2039, Nikola 2025-2033, research/03:2.1 table) | research/11:149-166; targets.ts:20 | Y `T1/T1L/GOLD.ai2027.SC` | point |
| SAR | 2027.66 (Aug) | day 791 | no band in source | same | Y | point |
| SIAR | 2027.92 (Nov) | day 883 | no band in source | same | Y | point |
| ASI | 2028.00 (Dec) | day 915 | no band in source | same | Y | point |
| intervals SC to SAR to SIAR to ASI | | 0.42, 0.26, 0.08 y | derived from the four dates | | N | rate |
| multipliers at SC / SAR / SIAR / ASI | | 5x / 25x / 250x / 2000x | fixed, no uncertainty modelled | research/03:188 | N | point |
| world compute | 2029 then | 2.25x/yr to 2029.0, then 1.5x; 40M end-2026 | no band in source | research/11:149-166 (#18); research/09:43 | N (see H8) | trajectory |
| lab compute | | 3.4x/yr; OpenBrain 1M (2025.5), 4M (2026.5), 15M (late 2027) | no band in source | calibration.ts:64-67 (AI2027_COMPUTE_TABLE); research/09:42 | N | trajectory |
| OpenBrain 2026 / 2027 | | revenue $45B / $140B; capex $200B | coded 36-67 / n/a / 150-250 | targets.ts:636, :648, :872 | Y (lab-level forecasts) | point |

Params that set it today (B6-PREP §2-3): `acd.world.ai2027.{g0 28.5, T 4.74, decay 0.1, cs 3.9}`; `cap.V3_CAL.ai2027.{gSC 30.15, dBM 1.8, r 4, sdSC 0.5}`; `acd.world.ai2027.{pEx 0.25, sEx 4, G [4.19,16,49.5]}`; compute 2.25x and leader 3.4x then 1.6x (world.ts:317-322); `ai2027` econ preset by default (init.ts:68).

### 3b. central = AI Futures authors' 2026 AIFM run (preset `authors2026`)
Source model: AI Futures Model, "Eli's median parameters (08/16/26)", https://blog.aifutures.org/p/ai-futures-model-dec-2025-update and aifm-public run (research/03:244 row 9; research/11:198-218; workTypes.ts "CAL2-T").

| checkpoint | date | value | band | source | target today | type |
|---|---|---|---|---|---|---|
| present 80% horizon (anchor) | 2026.27 | 186 min | +-15% (game); CI [97,399] | research/03:203; targets.ts:109 | P (v1 integrator) | point |
| horizon needed for AC | at AC | 125 work-years (80%) | [0.1, 156,250] | research/03:206 | N | point |
| doubling time now; difficulty factor d | | 4.5 mo; 0.92 | [2.2, 9.2]; [0.82, 1.02] | research/03:204-205 | N | rate |
| horizon at 2027.0 / 2028.0 / 2029.0 | | ~914 / ~20,600 / ~3.2M min | none in source: lite law only | hand-computed from world.ts:101-114 with `authors2026` values (unsure: the notes hold no dated AIFM horizons; needs one AIFM run) | N | point x3 |
| world compute (H100e) | 2025 / 2026 / 2027 / 2028 / 2030 / 2032 | 8.6M / 22.4M / 57.1M / 135M / 537M / 1.51B | no band in source | world.ts:289-290 (AIFM `input_data.csv`) | N | trajectory |
| leader compute | same years | 0.516M / 1.79M / 6.85M / 21.6M / 107M / 300M | no band in source | world.ts:290 | N | trajectory |
| AC (anchor for SC = AC + 0.52) | 2029.16 (model median) | | AC p10 Jun 2027 / p50 Jan 2030 / p90 Oct 2070 (run); Eli ATC 2027.5 / 2032.5 / 2085 | research/11:211, :218; research/03:244; blog quote "10th percentile 2027.5, 50th 2032.5, 90th 2085" | N | point |
| SC | 2029.68 | day 1495 gives 2029.59 | no band in source (game +-0.08 y) | research/11:211 | Y `T1/T1L/GOLD.authors2026.SC` | point |
| SAR | 2029.89 | | no band in source | same | Y | point |
| SIAR | 2031.48 | | no band in source | same | Y | point |
| ASI | 2033.73 | | no band in source | same | Y | point |
| intervals AC to SAR / SIAR / ASI | | 0.73 / 2.31 / 4.56 y | Eli: P(AC to ASI < 1 y) 30%, < 3 y 60% | research/11:209; research/03:244 | N | rate |
| SC to SAR / SAR to SIAR / SIAR to ASI (AI 2027 takeoff) | | 0.3 y (p90 0.95) / 0.3 [0.04, 56] / 0.16 [0.01, >100] | 80% CIs as listed | research/03:195 | N | rate |
| serial coding uplift now; revenue now | 2026 | 1.7x (doubling of uplift-1: 6.5 mo); $47B | [0.1,4.9] ; 5x/yr [2,12.5] | research/03:209-211 | N | point |

Params today: `acd.world.authors2026.{hSCmin 125 wy, T 4.5, decay 0.08, cs 17}`; `cap.V3_CAL.authors2026.{gSC 34.09, dBM 2.17, r 3.19, sdSC 2.94}`; `acd.world.authors2026.{pEx 0.1, sEx 2, G [1.52,101,1340]}`; `acd.AIFM_WORLD`, `acd.AIFM_LEADER`; `PROD_PRESETS.authors2026` {La 15, slow10 2.8, m2b 3.7}; unregistered `h0` 38, `computeGrowth` 2.5, `aifm` flag. gSC 34.09 and sd_SC 2.94 are read from one AIFM run (workTypes.ts, CAL2-T); `cs` and `G` are fitted, not sourced (CAL-world-sources.md:150-156).

### 3c. slow = sourced sceptic: result of the source search

Today's `slow` preset (T 7 plain exponential, h_SC 120 work-months, `computeGrowth` 1.8, `computeElasticity` 0.7, gSC 38.3 stand-in) is unsourced in its compute and takeoff (CAL-world-sources.md:130-156; workTypes.ts "slow 38.3").

Sources found (primary, read for this spec):
1. AI Futures Project, Dec 2025 model update, https://blog.aifutures.org/p/ai-futures-model-dec-2025-update. Daniel: "Pure exponential trend, keeping my other parameters fixed, gets to AC 5 years later, in 2034." Same post: "even an exponential trend gets to AC in 2030" (4-month RL-era doubling, other parameters fixed); comparison section: "SC in Sep 2028 given exponential time horizon growth" (old AI 2027 model, Eli's parameters); new-model median SC Dec 2031 (paraphrase; unsure). This is the authors' own sensitivity run, not an outside sceptic. It matches the existing slow SC 2034-2035 target (targets.ts:20, `GOLD.slow.SC` range 2034-2035).
2. METR, "Measuring AI Ability to Complete Long Tasks", https://arxiv.org/html/2503.14499v1. Quotes: "frontier AI time horizon has been doubling approximately every seven months since 2019" and "though the trend may have accelerated in 2024"; "Naively extrapolating the trend in horizon length implies that AI will reach a time horizon of >1 month (167 work hours)" between late 2028 and early 2031 (v1 text; another version may read mid-2028 to mid-2031, unsure); "extrapolation is affected by both external validity concerns and future changes in the growth rate". Gives horizon dates, not SC/SAR/SIAR/ASI.
3. Epoch AI, Erdil, "The case for multi-decade AI timelines", https://epoch.ai/gradient-updates/the-case-for-multi-decade-ai-timelines (26 Apr 2025). Quotes: "my own median timelines of ~ 20 years until full automation of remote work"; "I would only give this outcome [within 10 years] around 30% chance." A different milestone (full remote-work automation), no SC/SAR dates.
4. Epoch AI, "Can AI scaling continue through 2030?", https://epoch.ai/blog/can-ai-scaling-continue-through-2030. Quotes: "training compute expanding at a rate of approximately 4x per year"; "training runs of 2e29 FLOP will likely be feasible by the end of this decade"; "between 2e28 to 2e30 FLOP will be possible by 2030". A compute bound, not a sceptic's slowdown.
5. titotal critique (secondary, via research/03:419): METR plain exponential SC 2031 (Nikola h_SC) / 2035 (Eli h_SC); "last gasp" logistic: "never". Not re-opened for this spec; blog critique, not an organisation page (unsure).

Verdict: no single source gives a dated SC/SAR/SIAR/ASI path for a sceptic. Usable now: SC (AC) 2034 (source 1), horizon dates from a 7-month doubling (source 2), the existing 2034-2035 band. Missing: SAR/SIAR/ASI, world compute, horizon at 2027-29. Proposed fix: one run of the public AIFM (`aifm-public`, the route CAL2-T used for `authors2026`, workTypes.ts) with the exponential setting (decay 0, Eli's and Daniel's parameters) to read AC, SAR, SIAR, ASI, horizon and compute at dates. Until that run, only these slow checkpoints are sourced:

| checkpoint | date | value | band | source | target today | type |
|---|---|---|---|---|---|---|
| AC / SC (pure exponential, Daniel) | 2034 | | no band in source (game: 2034-2035) | source 1; targets.ts `GOLD.slow.SC` | Y (P) | point |
| horizon doubling (METR 2019-25) | trend | 7 mo | no band in source | source 2; research/11:235-245 | N | rate |
| 80% horizon at 2026.27 under 7-mo doubling | 2026.27 | must still be 186 min (history H2) | | H2 | N | point |
| 1-month (167 h) horizon | late 2028 to early 2031 | | range as quoted | source 2 | N | point |
| SAR, SIAR, ASI | | none | none | none: needs AIFM run | N | n/a |
| world compute | end-2026 | 35-46M (history); beyond: none | | H8 | N | trajectory |

Params today (slow): `acd.world.slow.{hSCmin 120 work-mo, T 7, g0, cs 3.87}`; `acd.world.slow.{pEx 0.01, sEx 0.6, G [10,394,2000], sarSpeed 10}`; `cap.V3_CAL.slow.{gSC 38.3, dBM 1.6, r 4}`; unregistered `h0` 38, `computeGrowth` 1.8, `computeElasticity` 0.7, `neuraleseBoost` 1.15 (world.ts:175-179).

## 4. The open technical point: do timeline parameters alter 2025-26?

Answer from code. The live engine does not read the v1 horizon parameters. Horizon is emergent: `h50 = 203 min x 4.2^(G - G_V0)` (workTypes.ts:143-145; capability.ts:245), so the 2025-26 horizon path is the G path, set by compute and research output. The v1 fields (`h0`, `T`, `decay`, `growth`, `hSC`, `g0`, `cs`, `share`, `pEx`, `sEx`, `G`) are read only by `world.ts` functions (`horizonAt` :101, `stage1` :34, `milestoneThresholds` :47) and by `scripts/v2/golden-timelines.ts` and `engine/v2/world/calibration.ts` (grep over `src/engine`: no other reader). So "T and decay act from day 0" is true of the v1 integrator that the GOLD targets test, but not of the game the player runs.

| parameter | where read | acts in 2025-26? | needs "take effect after the present"? |
|---|---|---|---|
| `T`, `decay`, `growth`, `hSC`, `g0`, `cs`, `h0`, `share`, `pEx`, `sEx`, `G` (`acd.world.<p>.*`) | world.ts:101-114 `horizonAt`, :34-75; golden-timelines.ts only | not in v2 play; yes in the v1 integrator (`slow` T 7 vs measured 4.2 is a day-0 divergence there; hand-computed v1 horizon at 2026.27: authors2026 169, fast 142, slow 95 min vs 186 measured, unsure) | only if the GOLD/T1 integrator targets are kept; otherwise irrelevant |
| `cap.V3_CAL.<p>.gSC` (sets level knots V0 L5 to SC L10) | capability.ts:24-49 `levelKnotsG`, `levelOfG` | yes, from day 0: level per OOM between V0 and SC is 5/(gSC - gV0) = 2.0 for ai2027 (30.15), 0.47 for slow (38.3); every level-read quantity (domain scores, benchmarks, AI labour fit, danger) differs at the same G | yes: it changes 2025-26 levels; must be one history value until 2026.99, then diverge. Not the horizon (h50 ignores it) |
| `dBM`, `sdSC` | capability.ts:20-35, :53 (knots above SC, median-expert level); workfit.ts:348-392 | partly: the SC-to-ASI knots and `medianExpertLevel` = lambda(gSC - dBM) feed 2025-26 reads (safety framework High rule, skill marks) | mostly after 2026 (takeoff); the median-expert read acts from day 0 |
| `cap.V3_CAL.<p>.r` | research.ts:90 `linePool` | yes: returns to research set G growth from day 0 | yes (or one shared value to 2026.99) |
| `PROD_PRESETS` (La, slow10, m2b) | research.ts:185, :222, :367, :683 | yes, from day 0 | yes (authors2026 only differs today) |
| compute: `computeGrowth`, `aifm` table | world.ts:305-322; macro.ts:48; market.ts:102; ces.ts:77 | yes: world compute and leader compute from day 0 (hand-computed end-2026: ai2027 43.9M ok, slow 31.4M low, AIFM 57.1M high vs 35-46M) | yes: must pass through H8, H9 to 2026.99 |
| `START_STATE.{g,b0,v0}` | capability.ts:104-125 | yes, defines day 0 | no: one shared value |
| `neuraleseBoost`, `computeElasticity`, `alignDifficulty` | types only (no reader in `src/engine`) | no | not needed |

Summary: parameters that would need to take effect after the present (or be fixed to one shared value until 2026.99): `gSC`, `r`, `PROD_PRESETS`, compute path, and the start state. Parameters that matter only after 2026 anyway: `dBM` above SC, `G`/`pEx`/`sEx` takeoff (v1), `sdSC` beyond the median-expert read. Mechanism gap: no mechanism carries a slower horizon trend (workTypes.ts "slow 38.3" comment), so the slow cell today is a level stand-in, not a trend.

## 5. Fixed middle settings (China, government/public posture, adoption)

| axis | proposed preset | values | why it is the middle |
|---|---|---|---|
| China | `fastfollower` | weight 35 (highest), centralize 0.5, theft 0.7, taiwan 0.8, treaty 1, openSource 1.3, efficiency 1 (actors.ts:35) | highest-weight realistic draw (35/20/20/10/5/10, actors.ts:35-40); research/10:45-47 sets the weights from 2023-26 behaviour; matches the measured Nov 2026 picture: distillation, open weights, gap 6.5-8 mo (research/10:27, :279) |
| Government | `dealmaker` | weight 45 (highest), accel 1.5, security 0.8, reg 0.4, transactional 1.6, hawk 0.8 (actors.ts:8) | highest weight; matches 2025-26 observed behaviour: voluntary access (EO 14409), CAISI agreements, no licensing (research/09:56). Unsure: it is the accelerationist end by parameters; the parameter-centre is `populist` (accel 1, security 1, reg 1.2, weight 13) |
| Public | `anxious` | weight 50 (highest), shock 1, halfLife 120 d, jobs 1.2, xrisk 1, benefit 0.7, mobilization 0.8 (actors.ts:20) | highest weight; matches Pew Feb 2026: 63% say AI advances too fast, 72% want more regulation (research/09:55) |
| Adoption (econ) | `ai2027` | diffMult 1.0, frictionScale 1.0, sigma 0.5, robotFloorYears 1, nu 0.3 (sectors.ts:89-93) | the middle preset by diffMult (normal 0.4, ai2027 1.0, gate 1.5) and the highest weight (45 of 35/45/20, hidden.ts:118-120); already the default econ for the `ai2027` world (init.ts:68). History H21-H25 must hold at this setting (unsure: not run) |

Rivals stay as they are (`realistic`, init.ts:69).

## 6. Alignment levels

Levels: beginner, easy, normal, hard, impossible (first tested: easy, normal, hard). History safety effects (H14-H19) hold at every level; the levels differ in the unknowns only.

| parameter | id | current easy / medium (normal) / hard | source for value | would calibrate against |
|---|---|---|---|---|
| latent shift (benignGeneralization +s, schemingDefault -s) | `cap.hidden.alignmentShift` | +0.8 / 0 / -0.8 (hidden.ts:85-87) | no source (research/14:41-54, "all numeric parameters are [D]", :68) | gameplay band, strongest bot win rate |
| latent to difficulty map | `cap.hidden.difficultyExponent` 0.35; `cap.DIFFICULTY_RANGE` [0.6, 1.65]; `core.DIFFICULTY_SCALE` 1 | same at all levels (hidden.ts:88) | [D] | band |
| loss-of-control threshold | `doomThreshold` (inline, world.ts:228) | 0.4 / 0.4 / 0.4; `sampled`: U(0.3, 0.5) | no source | band; authors' credences below |
| tolerance noise | `saf.CONTROL.toleranceSd` | 0.06 at all levels (control.ts; hidden.ts:160) | [D] | band |
| `alignDifficulty` | inline world.ts:227 | 0.55 / 1 / 1.7; not read by v2 | none | none (dead) |
| agenda priors and loadings | `saf.AGENDAS.*` | latents move them | [D] | band |

Reference outcome credences (outcomes, not parameters): P_mis band 0.40-0.80 from Kokotajlo 70% doom, Larsen 75% misaligned successors, Alexander 20% + 30%, AI Goals Forecast 40-80% (scripts/v2/safety.ts:148-158; `S4.refBot.pMis`, targets.ts:1106); Carlsmith ~25% scheming (research/14:52). Existing difficulty-label bands for a start (win rate of the best bot): >=30% Easy, 10-30% Medium, 1-10% Hard, <1% Impossible (targets.ts:453; starts.ts:20-24).

| level | shift | threshold | gameplay band (strongest bot win rate), designer sets |
|---|---|---|---|
| beginner | | | |
| easy | +0.8 today | 0.4 today | |
| normal | 0 today | 0.4 today | |
| hard | -0.8 today | 0.4 today | |
| impossible | | | |

## 7. Questions for the designer

1. Is the fast timeline the existing `ai2027` preset, with the Daniel `fast` preset (AC 2027.91) dropped or kept as a fourth timeline?
2. For central, use the AIFM model-run median (AC 2029.16, ASI 2033.73) or Eli's all-things-considered AC (p50 2030.08 to 2032.5)?
3. For slow, accept Daniel's pure-exponential AIFM result (AC 2034) plus METR's 7-month extrapolation as the source, and authorise one public-AIFM run to fill SAR/SIAR/ASI, horizon and compute?
4. Do timelines pass through the same 2025-26 checkpoints (G-path and compute fixed, divergence only in `gSC`/takeoff after 2026.99) rather than switching parameters at the present?
5. Replace the AI 2027 forecast values dated 2026 (`F7.capex2026/compute2026/valuation2026`, `W.equity2026` (deleted 2026-11-28, H), `GOLD.ai2027.M1.5/M3`) with the measured rows H8, H10, H11, H26?
6. Are the middle settings (China `fastfollower`, gov `dealmaker` or parameter-centre `populist`, public `anxious`, econ `ai2027`) acceptable?
