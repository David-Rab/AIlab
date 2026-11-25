# Stage 1 scout: forced runs of the capability engine against AIFM inputs

Scout notes, 2026-11-25, branch `bal` (contains master cd352aa). Read-only: no game code changed. Paths are relative to the repo root. "AIFM" = `C:\Users\david\Documents\projects\aifm-runs` (commit 1c40ecdb).
Measurements below were taken with a scratch script outside the repo (`%TEMP%\s1probe\probe.mts`), preset `authors2026`, seed 2027, leader lab, passive player.

## 1. The capability engine: inputs, state, can it run headless?

**Answer: yes, with no engine change.** `tick(s, { skip: [...] })` (`src/engine/v2/core/loop.ts:82`, `schedule` at :22) skips any system by id. The simulated **leader lab** (`setup.leaderLab`, `actors/rivals.ts:124`) already runs on prescribed inputs. Four systems are enough: `clock`, `production`, `milestones`, `rivalsChina` (registry `core/registry.ts:56-95`).

Measured: those four give the same milestone days as running 30 other systems (SC day 1597, ASI 1702) and take about 1.0 s for 4.7 simulated years, against 23 s for a full tick (`skip: ['endings']`).

**The chain, per day** (leader lab; the player's version of it is in 4):
| Step | Function (file:line) | What it reads |
|---|---|---|
| Compute | `rivals.ts:297` sets `core.computeOnline = refTotal(w, year)` (`production/ces.ts:76`; `refCapCompute` `src/data/world.ts:317`) | total H100e, a calendar path |
| Split by use | `labReferenceSplit` `actors/rivalModel.ts:554` → `shareRefAt` `departments/split.ts:51` (table `SHARE_REF`, `data/v2/calibration.ts:73`) | shares: training, experiments, routine/frontier agents, synthetic, serving |
| Human staff | `growLabStaff` `rivalModel.ts:564` (`staff.cap *= hRef(t)/hRef(t-1d)`; `hRef` `ces.ts:71` = 2050 + 49.2/month) | capabilities headcount |
| Research mix | `rivalResearch` `production/production.ts:266`; `bestRivalMix` `rivalModel.ts:399` re-splits experiments vs agents every day to the best share | not fixed: the lab optimises it |
| Research speed rs | `evalRival` :309 → `evalAggregate` :389 → `rawAggregate`: experiment CES `Xces` (`ces.ts`) with c = experiment FLOP per research engineer, ℓ = effective labour (humans + AI FTE from the internal model's coverage, `labConstOf` :371, `workFitW` `workfit.ts:110`), times AI taste; ideation I; `rs = min(E, I)` | h (staff), k (agent compute), c (experiment compute), internal model G |
| Recipe growth | `recipeRates` :451 (AIFM software law `a·rs·10^(-S/r)` per recipe part pre/mid/ceil) → `advanceRecipe` :474 | rs, returns `w.v3.r` |
| Training | `trainDay` :577 / `baseFlopPerDay` :572: FLOP into the base run from `computeOnline × split.training × 0.6` | training pool |
| New models | `labDaily` `rivals.ts:286`: base release (`BASE_MONTHS.leader = 9`, :58, `finishRun` `rivalModel.ts:714`), post-training every 6-10 weeks (`newVersionBuild` :743); G = `gOfBuild` (`capability.ts:161`) = gPre + dgRL + dg | recipe, base FLOP |
| Ideas | `adoptRivalIdeas` :521 (P05, P08, P09, P11, P16, P22, P24) at rs | `paradigmSuccess` draws (`world/hidden.ts:99`) |
| Level, horizon | `levelOfG` `models/capability.ts:43`; `h50Of` :244 = 203 min × 4.2^(G−G_V0) (`data/v2/workTypes.ts:143-147`); h80 = h50/5 (:147) | G |
| Milestones | `milestonesSystem` `capability.ts:422` → `otherLabMilestones` :378 → `milestonesOf` `workfit.ts:485` | model build, FLOP/token |

**State to record** (all plain fields, no hook needed): `L.internal.G`, `L.publicModel.G`, `L.phys.rec` {pre, mid, ceil} (software-efficiency analogue), `L.phys.pool`, `L.core.milestoneDays[0..6]`, `L.core.computeOnline`, `L.core.staff.cap`, `L.core.split`. rs, rsHuman and M are not stored for non-player labs: recompute with exported `evalRival(s, L, f, C, eff, mods)` (`rivalModel.ts:309`) from state, a pure read.

**Capability is discrete.** G of the leader's model changes only at releases (base every ~9 months, post-training every 6-10 weeks), not continuously like the AIFM's effective compute. Compare via the recipe (`phys.rec`) and base-run FLOP, or sample the internal G and expect steps.

**Isolation caveat.** Other labs couple in through diffusion (rule A recipe gain `diffusion.ts:40`, rule B distillation). Adding `geoQ` or the market systems (`computeHistQ, marketQ, sitesQ`) to the four moves seed-2027 SC from day 1597 to 1514 / 1589; all quarterly systems together give 1365. The full tick gave 1407, with recipe pre 10.6 vs 1.9 at 2029.5. For a clean forced run, drop rivals and China after `newGame` (`s.rivals = [leader]`, `s.china.lab.core.status = 'defeated'`): SC day 1554. I did not bisect which mechanism (probably China/rival public recipes feeding rules A/B) makes the full tick differ.

## 2. Existing forced-run machinery

| Machinery | Prescribes | Leaves to | Notes |
|---|---|---|---|
| `scripts/v2/lib.ts:65` `refComputeStub` (order 21) + `refGame`:91 + `runRef`:99 (T1) | player and non-leader labs' `computeOnline = refTotal(w, yr)` daily; infinite cash (`cash = 1e6`) | RefBot (`bots/ref.ts:307` `refPlay`): split (`playerShareRef`, :323), hiring to `hRef(t + lead)` (:333), base every 9 months, post-train every 6 weeks, tree projects (REF_TREE), releases, serving, safety share | closest to "player's own mechanics" but a bot decides design and the player's research is the stochastic project lifecycle (`models/research.ts`) |
| `calib.ts` T1/T1L, `calscan.ts` t1/t1l (`:46-52`) | golden days from `scripts/v2/golden/timelines.json`; 20 seeds (`calseeds.ts`); `V3_CAL` set per point | n/a | fits `gSC, dBM, sdSC` (`workTypes.ts:311`) per preset; results cached (`simcache.ts`). `--smoke` ran in 43 s (2 cache hits). In `calib.ts` the names `refTotal`, `shareRef`, `H_ref` appear only via these helpers |
| **T1L leader lab** (`calib.ts:162-172` `runT1L`; `calscan.ts:46-52`) | compute = refTotal (`rivals.ts:297`), split = shareRef, staff = hRef, taste 1, efficiency 1; no bot, player passive | only the research mix (`bestRivalMix`), base cadence (`BASE_MONTHS`, rng range 0.8-1.2 `rivals.ts:338`), idea order | **closest to a clean forced run**: no decisions, no finance, no products. 1 s per run with 4 systems |
| v1 integrator: `src/data/world.ts` (`multiplierAt`:62, `laborSlowdown`:82, `computePace`:87, `horizonAt`:101) and `scripts/v2/golden-timelines.ts` `integrate`; `world/calibration.ts:19` `referenceRate` | everything: AI 2027 time-horizon + takeoff maths (Eli Apr 2025), cf = 1 | nothing | milliseconds per run; not the v2 mechanics and not the AIFM structure (a progress coordinate p, no compute-by-use) |

The `aifm` flag (`world.ts:163,169`: presets `authors2026`, `fast` only) makes `refCapCompute` follow AIFM `total_ai_company_H100e` through 2032 (`world.ts:289-290`, table of 8 years). After 2032 it extrapolates the last ratio (300e6/183e6 = 1.64x/yr) whereas the CSV grows 1.47x/yr (2032 2.98e8 → 2045 4.5e10): the game path would be about 4x too high by 2045. `ai2027`, `sampled`, `slow` use 3.4x/yr to 2028 then 1.6x/yr (`world.ts:317-322`).

## 3. Mapping AIFM → game

AIFM files: `inputs/input_data.csv` (yearly, 2017-2200); outputs per run in `rollouts.jsonl`, summarised by `scripts/extract.py` (series 2025-2045 yearly).

| AIFM quantity | Game quantity | Unit / conversion | Where meaning differs |
|---|---|---|---|
| `total_ai_company_H100e` | `core.computeOnline` of the leader = `refTotal` (`ces.ts:76`) | H100e, same unit (2025.5: 0.96e6 both) | `authors2026`/`fast` already read it to 2032. Game `refCapCompute` = 0.68 × total |
| `experiment_H100e` | experiment pool = `computeOnline × split.experiments` (`poolsOf` `compute/power.ts:40`) | H100e. Game 2025.5 pool = 0.05 × 0.96e6 = 48k; AIFM 2025.0 = 325k (63% of total) | **unresolved**: AIFM column is 63% of total, game's experiments share 5-6% (`SHARE_REF`). Units or definition differ; use growth relative to a reference date, not absolutes |
| `inference_H100e` | research agents pool = `routine + frontier` shares (`split.ts:51`; `AGENT_EXP`/`AGENT_IDEAS` split `rivalModel.ts:56-58`) | H100e. AIFM 2025.0 = 25.8k (5% of total); game 3-4% | same caveat; `kAg` converts to AI FTE via FLOP per token (`fteOfFpt`, `rivalAgentFpt` :266) |
| `training_H100e` | training pool = `computeOnline × split.training` (base run uses 60% of it, `BASE_POOL_SHARE`) | H100e running the frontier run (a rate). AIFM 2025.0 = 35k (7%); game 40% of total | **differs a lot**; AIFM's cumulative effective compute integrates this rate in FLOP/yr; the game realises it as discrete base runs of `flop = Σ baseFlopPerDay` |
| `L_HUMAN` | `core.staff.cap` (capabilities heads) → H = cap × `RE_PER_HEAD`, S = cap × `SCI_PER_HEAD` (`rivalModel.ts:61,64`) | AIFM "input units" 1037 (2025) → 2594 → 5447 (x2.5, x2.1/yr). Game 2050 + 49.2/month (x1.29/yr) | **differs**: AIFM labour grows 2-3x faster; set `staff.cap` = 2050 × L_HUMAN(t)/L_HUMAN(2025.5) to compare |
| `world_H100e` | `globalCompute` (`world.ts:305`) used by `worldfx/macro.ts:48` and markets | H100e | no effect on capability (China share, prices only); the leader's research ignores it |
| Horizon h80 (METR 80%, minutes) | `h50Of(w, model)/5` (`capability.ts:244`, `workTypes.ts:147`) | game h50 = 203 min at G_V0 × 4.2 per OOM of G (CODE/AGENCY domain G) | AIFM: h80 anchored 186 min at 2026.27, doubling time with difficulty growth d (super/subexponential). Game: **pure exponential in G, fixed 4.2x/OOM**; h80 = h50/5. extract.py's h50 = h80 × 5.08 |
| Effective compute (OOM, `effective_compute`) | G of the version (`gOfBuild`), recipe `phys.rec`, recipeG (`stacks.ts`) | both log10 FLOP-equivalents. AIFM normalised to 0 at 2025.13 with cumulative training FLOP 10^26.54; game G_V0 = 27.63-27.77 (`START_STATE`, `calibration.ts:38`) | compare increments (G − G_V0 vs EC − EC(2025.13)). Game G is stepwise (releases) and includes RL gain and domain terms |
| Progress multiplier (`ai_sw_progress_mult_ref_present_day`) | no single equivalent. Closest: `rs / rsHuman` from `evalAggregate` (research speed with AI vs humans only, `rivalModel.ts:297-307`); player's `labSpeedRel` (`production.ts:169`) | AIFM: AI software R&D speed-up at **present-day resources**. Game rs is relative to the leader's **day-0 lab**, with that day's compute and staff | **differs** (research/11 #13 style): rs includes compute and staff growth; `rs/rsHuman` is closest to "AI speed-up at current resources". The game has no aggregate M since RD-R01 (`production.ts:5-10`) |
| `serial_coding_labor_multipliers` | AI labour multiplier on experiments `m_EXP` = 1/`wH` (`rivalReadout`), coverage `a` (`workFitW`) | | related, not identical |
| AC (automated coder) | none exact. | | game SC ≈ AIFM **AI2027-SC** (AC + about 0.5 y); `workTypes.ts:300-309` ("SC = AC + 0.52"). Game SC (`workfit.ts:494`): SWE fit ≥ best human, coverage ≥ 0.9, cheaper than humans |
| SAR | `milestoneDays[4]`: SC and EXP and IDEAS fit ≥ best human (`workfit.ts:495`) | day index | AIFM SAR is defined on experiment-selection skill and 1% compute |
| SIAR | `[5]`: SAR and IDEAS ≥ best + 2Δ_bm (:496) | | AIFM SIAR: gap to top researcher 2x the top-median gap |
| ASI | `[6]`: SIAR and every cognitive work type ≥ best + 2Δ_bm (:497, `ASI_EXTRA` 1.3 gaps) | | AIFM ASI similar in spirit; TED-AI has no game counterpart |

`extract.py` series: `horizon80_minutes`, `horizon50_minutes` (derived), `progress_multiplier`, `coding_labor_multiplier`, `effective_compute_ooms`, `input_*`, 2025-2045 yearly, quantiles p10-p90; milestones AC, SAR, SIAR, TED-AI, ASI (+ gaps). It does not extract AI2027-SC; read `milestones["AI2027-SC"]` from `rollouts.jsonl` (name seen in research/11 #8) if needed.

## 4. Feedback loops (each with where to cut)

Leader lab = loops 4.1-4.4 and 4.8 only. Loops 4.5-4.7 exist only for the player (finance and products) and are already cut by the T1 compute stub.

| # | Loop | Chain | Cut for open loop | Gain set by |
|---|---|---|---|---|
| 4.1 | compute → research → recipe → G | `labDaily` :297 → `rivalResearch` `production.ts:266` → `evalAggregate` `rivalModel.ts:389` → `recipeRates` :451 → `advanceRecipe` :474 → `newVersionBuild` :743 → `setModelG` | open by design (compute and staff are prescribed). Software feedback inside it: `10^(-S/r)` diminishing returns | `w.v3.r` (`V3_CAL`, `workTypes.ts:311`), `PRE_RATE0` 0.48 (`data/v2/rivalModel.ts:16`), recipe-part `a, kappa, rShare` (`recipeParts` `rivalModel.ts:115`), CES `rho, zeta, u, v, lam, rc` (`ces.ts:34`, `ProdPreset` `calibration.ts:53`: La, Ca, slow10, m2b) |
| 4.2 | capability → research speed (AI R&D automation) | `rivalWorkModel` :277 (internal model G + P05 scaffold) → `labConstOf` :371 → `workFitW` `workfit.ts:110` (coverage a, assist, sdAI) → `effLabour` :163 / `teamTaste` :183 → E and I in `rawAggregate` | pin the model the research reads: override `rivalWorkModel` with a prescribed G(t) (hook), or force a = 0 (humans only) for the no-AI baseline; `rsHuman` is already computed beside rs | `gSC`, `dBM`, `sdSC` (`V3_CAL`), `COVER`, `MILESTONE_COVER`, `S_WIN`, `ASSIST` (`workTypes.ts:131-139`), `m2b`, `lam` |
| 4.3 | research → serving efficiency → more AI FTE per compute | `serveRate` :286 (research speed grows the serving stack) → `rivalServeFpt` :263 → `rivalAgentFpt` :266 → `fteOfFpt` → `aiFte` in `rawAggregate` | pin `phys.serve` | `SERVE_RATE0`, `serveRShare` (`L.infer` line), `tokEff`, `U_DECODE` |
| 4.4 | research → ideas → recipe, stream | `adoptRivalIdeas` :521 (P24 pretraining +x, P16 FLOP x10^x, P05 scaffold ΔG, P08 continual learning `clApply` :756) | skip `adoptRivalIdeas` (or set all `ideas.done` = 0) | `effortTM` of the nodes (`data/v2/tree.ts`), node `effect.mean/sd`, `paradigmSuccess` priors (`data/v2/paradigms.ts`), `RIVAL_IDEA_TM_PER_YEAR` :497 |
| 4.5 | capability → product quality → revenue (player) | `revenueSystem` `worldfx/revenue.ts:1114` → `applyRevenue` :1121 (demand by product tier, price vs rivals) → `opexSystem` `finance/cashflow.ts:44` (`revenueRun`, cash) | prescribe `revenueRun`, or run with the T1 stub (cash = 1e6) | `revenue.ts` price/demand tables, `sectors.ts`, hype |
| 4.6 | revenue/valuation → investment/capex → compute | `capitalQSystem` `finance/investors.ts:152` (hype, investor pool, rounds, valuation `story.ts:219`) → `financeAutopilot` `finance/plan.ts:134` (target `mult × refTotal(t)`, chips 2-3 quarters ahead, sites ~6) → `marketQSystem` `compute/market.ts:516` orders → `computeOnlineOf` `compute/power.ts:34` | `refComputeStub` (`lib.ts:65`) sets compute directly. Note the autopilot's target is the reference path, so compute is endogenous only through cash limits, the bot's `mult`, and chip supply (`globalRefQ`, `exoRefQ` `market.ts:106-130`) | `REF_AUTOPILOT.mult` (`plan.ts:62`), financing terms, `FIRM_TERMS`, supplier capacity |
| 4.7 | capability → talent / hiring | player: `hiringSystem` `departments/teams.ts:284` (weekly; RefBot hires to `hRef(t + lead)`, `ref.ts:333`); non-player labs: `growLabStaff` `rivalModel.ts:564` follows `hRef` | **no capability → hiring link exists** in the leader lab or RefBot; the AIFM `L_HUMAN` is also exogenous. Player's hiring depends on cash only (payroll `cashflow.ts:75`) | `H_REF_BASE`, `H_REF_PER_MONTH` (`calibration.ts:59-60`) |
| 4.8 | cross-lab diffusion | `recipeDiffusionPerDay` `production/diffusion.ts:40` (rule A, `DIFFUSION_TAU_DAYS`), rule B distillation in `labDaily` :324 (`distillLift`) | isolate the leader (rivals and China removed); measured to shift SC by 0.1-0.5 y (§1) | `DIFFUSION_TAU_DAYS`, `DISTILL_S`, `DISTILL_FIT` (`calibration.ts`) |
| 4.9 | others that compound | security/theft and China catching up (`security.ts`, `china.ts`), government/treaty slowdown `rivalSpeedMult` (`rivals.ts`, treaty x0.65 `production.ts:278`), safety pauses (`ws4:agentsOffUntil`) | skipped systems = off | out of Stage 1 scope |

## 5. Uncertain parameters in the game's `sampled` world

- `sampleHidden` (`world/hidden.ts:121`) → `timelineFor` :60 → `makeWorld` default branch (`src/data/world.ts:181-220`, Eli Apr-2025 distributions) and `prodParamsFor` :41.
- **What the v2 capability engine actually reads from those draws:** `prod.La = 1 + lognormal80(1, 200)` (`hidden.ts:42`) is the only one. The v1 draws (T, cs, hSC months, delay, pEx, sEx, takeoff gaps G1-G3, `computeElasticity` U(0.35, 0.7), `neuraleseBoost` U(1.15, 1.5)) are drawn but unread by v2: a grep of `src/engine/v2` finds no reader except `aifm` and `computeGrowth` through `refCapCompute`/`macro.ts:48`. `v3 = {...V3_CAL.sampled}` (`workTypes.ts:319`) = ai2027's `{gSC 30.15, dBM 1.8, r 4, sdSC 0.5}`, **fixed, no draw**. `m2b`, `rc`, `lam`, `Ca`, `slow10` are fixed (`PROD_DEFAULT`, `calibration.ts:53`).
- Other capability-relevant draws: `paradigmSuccess` (Bernoulli per paradigm, `hidden.ts:99-104`; decides whether P05/P08/P16/P24... exist in that world) and idea size (`rivalIdeaTruth` `rivalModel.ts:509`, hash of seed); safety latents and tolerance noise (not capability).
- **So the game's sampled capability spread is narrow** (La, paradigm luck, per-lab randomness in release timing). The AIFM's spread comes from ~25 sampled parameters (`sampling_config.yaml`: `ac_time_horizon_minutes`, `present_horizon`, `present_doubling_time`, `doubling_difficulty_growth_factor`, `rho_coding_labor`, `inf_labor_asymptote` ↔ `La`, `inf_compute_asymptote` ↔ `Ca`, `parallel_penalty` ↔ `lam`, `serial_uplift_at_reference_date`, `excess_uplift_doubling_time`, `ai_research_taste_at_coding_automation_anchor_sd` ↔ `sdSC`, `ai_research_taste_slope` ↔ 3.09/`dBM`, `median_to_top_taste_multiplier` ↔ `m2b`, `software_progress_rate_at_reference_year` ↔ `r`/`PRE_RATE0`, `taste_limit`, `ted_ai_m2b`). Horizon parameters (AC horizon requirement, doubling time, difficulty growth) have no game counterpart: the game has one fixed 4.2x/OOM slope and `gSC` instead.
- Consequence: comparing the game's `sampled` distribution with AIFM quantiles needs a **new sampler** over `(gSC, dBM, r, sdSC, La, Ca, slow10, m2b, lam, rc, H50_PER_OOM)` that maps each AIFM draw to these, for example by fitting `gSC` per draw to that draw's AC date. This is a design question for the designer, not a mechanical step.

## 6. Proposed `scripts/v2/forced.ts`

**Idea:** the T1L leader lab, four systems, prescribed series, no bot, N samples in parallel.

1. **Load** `input_data.csv`; interpolate log-linearly in time (as `world.ts:logInterp`). Build index series relative to 2025.5: c(t) = experiment_H100e(t)/(2025.5 value), same for inference, training, L_HUMAN, total.
2. **Setup:** `newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed, tutorial: false, leaderLab: true }))`; apply sampled parameters by `Object.assign(V3_CAL[preset], {...})` before `newGame` (as `calscan.ts:46-52` does; one parameter set per worker process, or reset between games) and by overwriting `s.hidden.timeline.prod` for La/Ca/m2b. Keep only the leader: `s.rivals = [leader]`, China `status = 'defeated'`.
3. **Per day:** `tick(s, { extraSystems: [forcedInputs], skip: ALL_BUT(['clock','production','milestones','rivalsChina']) })`. `forcedInputs` is an `EngineSystem` (like `refComputeStub`, `lib.ts:65`) at **order 101** (after `labDaily` at 100, before tomorrow's production at 30) that writes the leader's `core.computeOnline = total(t)`, `core.split` from the CSV shares (experiments = exp/total, routine+frontier = inference/total, training = training/total, remainder to synthetic/serving), `core.staff.cap = 2050 × L_HUMAN(t)/L_HUMAN(2025.5)`.
4. **Record** weekly: year, `L.internal.G`, `h50Of/5` (h80), `levelOfG`, `phys.rec` + recipeG, `evalRival` → rs, rsHuman, rs/rsHuman, aiFte, `core.milestoneDays`. Write JSONL per run. Stop at ASI (or 2045, or a day cap).
5. **Compare** with `extract.py` series at the same yearly dates; milestone gaps SC→SAR→SIAR→ASI vs AIFM AI2027-SC→SAR→SIAR→ASI.
6. **N samples:** a worker pool like `calscan.ts:60-67` (spawn `node --import tsx forced.ts --shard k/n`), results cached with `simcache.ts`. Sampler per §5 (needs a design choice). Quantiles p10/p25/p50/p75/p90 per series and per milestone with never-reached counted as infinity (as `extract.py`).
7. **Loop-closing mode (Stage 2):** drop the forced input one at a time: (a) let `bestRivalMix` run (default) vs pinned; (b) release the compute path to the player's finance (full tick + `refPlay`, cash finite); (c) release staff. Perturb and measure the response (e.g. +10% compute at one date → change of milestone dates).

**Speed:** about 0.5-1.5 s per 4.7 simulated years with four systems (measured), so roughly 3-8 s for 2025-2045 including `newGame`. 1000 samples on 8 workers: about 10-20 min. A full tick is 15-20x slower (about 23 s per 4.7 years; `worldDaily` and `revenue`/`products` add 15-20 s each on their own).

**Engine hooks needed** (every one must default to the current behaviour):
| Hook | Why | Where | Normal-game impact |
|---|---|---|---|
| Pin the research mix (skip `bestRivalMix`, keep the split's experiments : agents) | "research allocation fixed"; the stub would otherwise be re-split every day | `production.ts:274-275`: `if (apply && res > 0 && !s.flags['forced:mix'])` | none when the flag is unset |
| Override `rivalWorkModel` / internal G for the research (loop 4.2 cut) | measure automation gain | `rivalModel.ts:277` | none when unset |
| Skip `adoptRivalIdeas` / diffusion (loops 4.4, 4.8) | isolate loops | `production.ts:286`, `production.ts:329` | none when unset |
| Optional: series override for `refTotal` and `hRef` | not needed if the order-101 stub overwrites state; needed only for the player/RefBot path (`ref.ts:333`, `market.ts:101`) | `ces.ts:71,76` | none when no override set |

The stub, the sampler (`V3_CAL`, `prod`) and the recorder need no engine change. Existing `paramOverride.ts` / `balance/params/*.ts` (about 1,150 registry params, `capability.ts` 342) can set other constants per process (`--set` in `balrun.ts`).

## 7. Risks and unknowns
- **Unit mismatch of compute by use (§3):** AIFM `experiment_H100e` is 63% of total in 2025, the game's experiments pool 5%. Feeding absolutes would change the day-0 research speed by an order of magnitude; use ratios to a reference date and decide separately how to set the day-0 level. Needs the AIFM authors' definition (`docs/input-series-provenance.md` covers training only).
- **The game's capability variance is small** (§5): `sampled` varies only La and paradigm luck, so a quantile comparison with the AIFM's 25-parameter spread is meaningless without a new sampler; the mapping (especially horizon parameters, which the game lacks) is a design choice.
- **Full tick and four-system tick give different leader trajectories** (seed 2027 authors2026: SC day 1407 vs 1597, ASI 1476 vs 1702) through cross-lab diffusion and other labs' systems; I located the market and `geoQ` groups but did not bisect further. Decide which world the "forced" run represents before comparing to AIFM.
- **Milestone definitions differ** (game SC ≈ AIFM AI2027-SC, not AC; no TED-AI) and the game's `authors2026` preset is known to miss on SAR/SIAR/ASI (`workTypes.ts:296-307`): compare shapes and gaps, not only SC.
- **Game post-2032 compute extrapolation** for `aifm` presets is about 4x above the CSV by 2045 (`world.ts:289-322`), and the game's SHARE_REF table freezes after 2027.875 (`calibration.ts:73-80`): both must be overridden for runs that go past 2032.
- **Horizon law differs:** game h50 is exactly exponential in G (4.2x per OOM, no difficulty growth), AIFM h80 has superexponential/subexponential doubling. A forced run will match horizon only if G tracks AIFM's effective compute; otherwise the shapes differ by construction.
