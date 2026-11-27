# Audit: how capability and progress are measured and compared (MEASURES)

Scope: capability units (G, domain G, λ(G), knots, LEVEL_PER_OOM, oomOfLevel, levelOfV2/CAL_SHIFT, B_G_PER_Y), rates
and paces, measured vs true level, milestones, start state, rivals/China as R&D actors, diffusion/leaks/spillover, lead
readouts. Read-only; all paths are relative to `C:\Users\david\Documents\projects\AI27`.

Probes I ran: two scratch scripts outside the repo, run with `npx tsx` (`newGame(defaultSetupV2({world, alignment:'medium', seed:2027}))`).
Day-0 values I measured:

| preset | G_V0 | λ knots G (V0, SC, SAR, SIAR, ASI) | λ slope L/OOM per segment | world.calShift (aligned) | CAL_SHIFT table (RefBot) | paceOf → G/yr in lead conversions |
|---|---|---|---|---|---|---|
| ai2027 | 27.66 | 27.66 30.15 31.88 37.68 41.45 | 2.01 / 1.16 / 0.26 / 0.40 | +0.624 | −0.463 | 1.192 → 1.43 |
| authors2026 | 27.63 | 27.63 33.45 34.86 44.16 50.21 | 0.86 / 1.41 / 0.16 / 0.25 | +0.257 | −0.618 | 1.092 → 1.31 |
| fast | 27.60 | 27.60 31.18 31.33 31.93 32.32 | 1.40 / **12.96** / 2.50 / 3.85 | +0.536 | −0.473 | 1.092 → 1.31 |
| slow | 27.77 | 27.77 35.58 36.92 40.12 42.20 | 0.64 / 1.49 / 0.47 / 0.72 | +2.536 | −1.5 | 1.192 → 1.43 |

On day 0 the player's `prodCache.rate` is 0.692 on every preset (START_G_RATE 0.83 OOM/yr ÷ 1.2). Rivals' rates are
0.29–1.06.

---

### MEA-01 Four different milestone definitions, and the race endings compare two of them
- Test(s): 3, 4, design
- What: "Superhuman coder", "ASI" and the other milestones mean different things depending on who is measured:
  (a) **Player** `milestoneDays`: work-type statements. Agent = SWE coverage ≥ 0.1, Reliable = SWE coverage ≥ 0.5, Research agent = EXP coverage ≥ 0.5, SC = SWE fit ≥ best human with coverage ≥ 0.9 and AI cost below human cost, and so on.
  (b) **Rivals, China, leader lab**: their λ(best G) crosses LEVEL_KNOTS[i] (5, 6.5, 8.5, 10, 12, 13.5, 15).
  (c) **Player notification** (`seenMilestone{i}` flags): the player's *measured* level crosses the same knots. China's escalation and gov policy read these flags.
  (d) The v1 `MILESTONES` / `milestoneThresholds` in progress-years. These are still read by `alignedCalShift`, `levelOfV2` and the EndScreen.
  λ has knots only at V0/SC/SAR/SIAR/ASI (capability.ts:48). So the rival thresholds 6.5 and 8.5 are arbitrary points on the straight V0→SC line in OOM. They have no counterpart in SWE or EXP coverage. V0 sits exactly on L 5, so every lab at L ≥ 5 is credited with "Agent" on day 0 (init.ts:82-89).
  The decisive comparisons mix (a) and (b):
  - "Another lab's ASI first" tests `r.core.milestoneDays[6]` (a λ crossing) against `s.player.milestoneDays[6]` (every cognitive work type 2·Δ_bm past the best human).
  - "Overtaken" tests a rival's SIAR (λ ≥ 13.5) against the player's SAR (work-type).
  - The Stage-2 switch in `modelRate` reads `milestoneDays[3]`, which is a different predicate for player and rivals.
- Evidence: departments/workfit.ts:414-427; models/capability.ts:283-313 (rivals: 311-312), 315-323 (notifications); core/init.ts:82-89; endings/endings.ts:112-130; actors/china.ts:159,165,233,266 (seenMilestone1/2); data/world.ts:24-32; ui/v2/end/EndScreen.tsx:124-126; actors/rivals.ts:196 (stage from milestoneDays[3]).
- Player sees:
  - The Research view's milestone criteria (coverage, fit vs best human, cost; researchView.ts:380-406). This is the work-type definition.
  - A log line "Superhuman coder: measured level 10.0" from the level definition, which can fire on a different day from the work-type milestone.
  - The glossary says milestones are L 6.5/8.5/10/12/13.5/15 (glossary.ts:19).
  - The EndScreen lists the v1 names next to canon dates.
- Fix: redesign. Use one predicate for every lab. Rivals can run `versionMilestones` on their aggregate model: workFit already falls back to general G when there is no build, and cost per work-hour is available from fpt. Drop the level-knot crossings (b) and the measured-level milestone flags (c). If notifications are wanted, make them "your evals show criterion X met". Drop LEVEL_KNOTS[1..2] as thresholds.
- Severity: high · Effort: M

### MEA-02 The level↔OOM conversions disagree with λ(G) by up to 10×
- Test(s): 2, 4
- What: The display level is λ(G), a piecewise-linear map whose slope depends on the preset and the segment. My probe found 0.64 to 13 levels per OOM. Yet level offsets (preference, paradigm offsets, curation, the RSCH taste penalty) enter the mechanics at a fixed `LEVEL_PER_OOM = 1.2`, labelled "V2's conversion". They enter the display at 1 level per level.
  - A "+0.5 L" design offset adds exactly 0.5 to the displayed domain level and 0.42 OOM to work fit. On the λ slope, 0.42 OOM is ≈0.84 L on ai2027 before SC and ≈5.4 L on fast between SC and SAR. So the displayed level and what the model can do diverge.
  - A third factor exists: hazard curation converts its level offset to data specialisation at 2 L per OOM (`sD = offL/2`).
  - P19 removes a −0.5 L display penalty but adds +0.5/1.2 OOM to fit. The comment admits the two are different.
  - REEVAL_DG = 0.3 L / 1.2 is also stated through the 1.2 factor.
- Evidence: data/v2/workTypes.ts:65-66; departments/workfit.ts:53-58; models/capability.ts:114-126, 128-139, 147-150; models/design.ts:39; data/v2/runDesign.ts:165 (hazard off BIO −1.0); data/v2/evals.ts:74-77; my probe's slope table above.
- Player sees: domain levels and benchmark scores move by the level offset. Fits and coverage move by a different amount, and the gap changes with preset and era. Nothing explains this.
- Fix: merge. State every design, paradigm and curation offset in OOM of domain G (the capability currency) and derive the displayed domain level from λ(G_d) alone. Delete LEVEL_PER_OOM, `offL` and `off`, and `sD = offL/2`.
- Severity: high · Effort: M

### MEA-03 The progress-years round trip: about 40 call sites, carrying v2's (1 − share) compute term
- Test(s): 2, 4, 5
- What: Known; refined here. Every gap↔days conversion goes G → "v2 progress-years" → G through `B_G_PER_Y = 1.2`. `modelRate` builds the rate as `prodCache.rate + (1 − share)` before Stage 2, else `prodCache.rate`.
  - `prodCache.rate` is itself OOM/yr ÷ 1.2: the player's `gRate/B × rateMult × M/M0` (production.ts:195), and the rivals' `eRate/B` (rivalModel.ts:375).
  - So the lead pace in OOM/yr = recipe growth + 0.5 or 0.6 OOM/yr. That constant stands in for compute scaling. It is identical for a lab whose compute is flat and a lab whose compute grows 3.4×/yr. It disappears at the lab's SC day (definition (a) or (b), MEA-01) even though compute keeps growing.
  - I counted about 41 non-comment B_G_PER_Y lines in 20 files: rivals.ts (7), runs.ts (4), capability.ts (4), actions.ts (4), save.ts (3), init.ts (3), rivalModel.ts (3), theft.ts (2), epilogue.ts (2), ref.ts (2), china.ts (2), and one each in serving.ts, security.ts, responses.ts, findings.ts, safety/actions.ts, production.ts, company.ts, limitsView.ts, intel.ts.
  - Many are data stated in progress-years: START_PUBLIC_GAP_Y 0.15, chinaGapYears 0.6, P24's 0.8 y, RUN_PENALTY_Y 0.02, SPILL 0.02, FREE_TIER.years 1, the distillation threshold 0.0004, the leak "days of pace" sizes.
- Evidence: data/v2/runDesign.ts:12-17; actors/rivals.ts:193-206, 218; production/production.ts:193-195; actors/rivalModel.ts:371-375; models/tree.ts:104-113 (START_G_RATE).
- Player sees: lead days (via intel), the "yr of progress" line on safety patches (safety/actions.ts:151), and the diffusion "recipe ×N your own rate" (limitsView.ts:51-54).
- Fix: remove. State all such data in OOM. Give every lab one `gPerYear` readout: the slope of its own frontier-G history (MEA-07). Delete `B_G_PER_Y`, `modelRate`, `paceOf`, `rateOf` and `prodCache.rate`.
- Severity: high · Effort: L

### MEA-04 Domain difficulty is modelled twice, in two units
- Test(s): 4, 3
- What: A domain's displayed level is `λ(G_d) + REF_OFF[d][0]` (PHYS −4, AGENCY −1, CYBER −1, …) plus offsets. Benchmarks, danger flags and the `measuredL` noise run on that level.
  A domain's work fit uses `G_d` against human reference points shifted by `REF_DELTA[d]·Δ_bm` (refDelta). The 2025 profile REF_OFF col 0 does not enter the fit at all.
  λ is calibrated on the general reference-recipe G (SC/SAR/SIAR/ASI points of work types), so applying it to a single domain's G has no defined meaning.
  REF_OFF columns 1–6 (v2's era table) are unread (known; confirmed: only `REF_OFF[d][0]` is read, capability.ts:136).
- Evidence: data/v2/calibration.ts:133-146; models/capability.ts:116-139; data/v2/workTypes.ts:56-64; departments/workfit.ts:61-80; models/benchmarks.ts:25-34, 48-57.
- Player sees: per-domain levels and benchmark scores, from one system. Work-type fit, coverage and milestones, from the other. A PHYS level 4 below CODE has no mechanical effect on work.
- Fix: merge. Keep domain difficulty only as human reference points in OOM (REF_DELTA). Derive the displayed domain score from fit vs best human (or from coverage). Delete REF_OFF (all columns).
- Severity: medium · Effort: M

### MEA-05 The start state still comes from the v1/v2 start solution
- Test(s): 5, 2
- What: Known; refined here. `playerStart` uses:
  - the v1 multiplier `multiplierAt(p0)`, `stage1` and `share`;
  - a negative-time extrapolation of v2's calendar compute term (`pcRefLab`, pcB0 = −0.35 y);
  - v2's post-training retention 0.7 (`START_RETAIN`).

  It solves `pa0` so that "pm(V0) = p0". Its only outputs that matter are the start recipe vintages `startVintage(paBase)` and `startVintage(paPost)`. On ai2027 they are −0.53 OOM for the B0 pretraining recipe and −0.04 OOM for the V0 RL recipe; they vary by preset only through the v1 `share` and multiplier.
  `gV0` depends on them, `levelKnotsG[0]` depends on `gV0`, and the whole λ scale (and oversight OOM, h50, day-0 research normalisation) hangs off it. Follower starts move the same `pa` fields by a bisected k (init.ts:165-178). The start run's recipe also goes through it (init.ts:118).
  The comment block at capability.ts:161-164 still describes calShift and pm.
- Evidence: models/capability.ts:73-80, 84-102, 159-188; core/init.ts:113-140, 147-179; probe output `ps` above.
- Player sees: nothing directly; it sets V0's G and therefore every level.
- Fix: make it data. Two sourced constants: B0's recipe age (days × the reference pretraining rate PRE_RATE0, the same rule rivals use, MEA-06) and V0's RL recipe age. A follower lag is one OOM number. Delete `playerStart`, `pcRefLab`, `START_RETAIN` and the v1 imports in capability.ts.
- Severity: medium · Effort: M

### MEA-06 Player and rivals get their start recipes from two different mechanisms
- Test(s): 4, 3
- What:
  - The player's start recipe vintages come from the v2 start solution (MEA-05).
  - Rivals, China and the leader lab solve their own: days since B0 launch × their own day-0 recipe rates, from their aggregate research (rivalModel.ts:428-481). The lag k and, for the leader, a staleness multiplier m are bisected so that the version equals the drawn start G.

  So the "same B0 on the same dates" carries different recipe ages for the player and for the leader lab that is supposed to be its reference twin. For the player it also differs per preset only via v1 parameters. The public start model is set twice: `simpleModel(..., G − 0.15·B)` (rivals.ts:82, china.ts:49), then overwritten by `initRivalPhys` (rivalModel.ts:478).
- Evidence: actors/rivalModel.ts:418-481; actors/rivals.ts:70-112, 122-158; actors/china.ts:24-70; models/capability.ts:84-102.
- Player sees: nothing.
- Fix: merge. One `startLab(G0, inputs)` for every lab, including the player (the rival rule is the physical one).
- Severity: medium · Effort: M

### MEA-07 At least seven ways to measure "how far ahead", with different units and fallbacks
- Test(s): 4, 3
- What:
  1. `trueLeadDays`: player vs X. Reads the weekly series of λ(best G), rounded to 0.001 and capped at 15, via "corner" interpolation. Before the history is long enough it falls back to the pre-game reference rate `referenceRate(p0, 2025.5) × B` (v1 integrator).
  2. `leadBetween`: X vs Y. G gap ÷ mean(rateOf) × B (MEA-03).
  3. Intel estimate: a blend of `(1 − access)·(G gap to the public model ÷ mean rate − ASSUMED_LAG)` and `access·trueLead`, plus noise. China's start estimate is `chinaGapYears·365·0.8`, while its true start gap is 0.6 y × B ÷ pre-game rate ≈ 195 d (my calculation).
  4. `epilogue.projectedMisAtAsi`: (G at L 15 − G) ÷ max(0.36, paceOf·B) × 0.7.
  5. Theft: the copy is 60 d × the victim's `rateOf` behind, or for the player `frontierLevelAt(day − 60)`, clamped to 3·B.
  6. Open weights: China absorbs `min(2, gap ÷ paceOf·B × 6)` months × its own rate.
  7. Release lag: internal G − (lag − age) × rateOf × B.

  The λ cap at 15 means leads among post-ASI labs read from a flat series. The series stores λ rather than G, so the lead depends on the preset's knot spacing.
- Evidence: models/capability.ts:190-279; core/record.ts:23-24; actors/rivals.ts:208-219, 403-410, 453-466; actors/intel.ts:32-50; actors/china.ts:52; endings/epilogue.ts:56-61; security/theft.ts:83-94.
- Player sees: the LeadTrack and RiskMap "± d" lead (intel estimate, Overview.tsx:22-60, RiskMap.tsx:43-49) and the finance IP-access "days a year" (Finance.tsx:894). They do not see which definition is behind each number.
- Fix: merge. Record `series.G` per lab. Define one `lagDays(follower, leader) = today − first day leader's frontier G ≥ follower's G`; if the history is too short, use the leader's slope over the history it has. Intel reads it with noise. Release, theft and open weights use G gaps in OOM directly.
- Severity: high · Effort: M

### MEA-08 calShift: the world's value is computed and never read; RefBot reads a stale table
- Test(s): 1, 5
- What: Known; refined here.
  - `timelineFor` sets `timeline.calShift = alignedCalShift(timeline)`: +0.62 / +0.26 / +0.54 / +2.54 (my probe).
  - Nothing reads `w.calShift`. `thresholds()` has no callers, and `levelOfV2`'s default argument is never used.
  - RefBot's `gateLevel` passes the V2a `CAL_SHIFT` table (−0.463 / −0.618 / −0.473 / −1.5) instead.
  - The capability.ts:41-43 doc says the derived calShift lines up RefBot's gates. False: the gates use the table.
- Evidence: world/hidden.ts:66-72; world/calibration.ts:11-30; models/capability.ts:41-46; bots/ref.ts:60-100; data/v2/calibration.ts:5-26.
- Player sees: nothing.
- Fix: remove `alignedCalShift`, `TimelineWorld.calShift` and `thresholds`. Restate RefBot's gates as display levels or OOM constants: today they are just 5 numbers per preset. Then `levelOfV2`, `CAL_SHIFT` and `milestoneThresholds` can go.
- Severity: low · Effort: S

### MEA-09 oomOfLevel duplicates gOfLevel; safety reads G through a capped G→L→OOM round trip
- Test(s): 4
- What: Known; confirmed.
  - `oomOfLevel(L)` = `gOfLevel(L) − gV0` with a copied LEVEL_AT array. One difference: gOfLevel clamps L at 0 and oomOfLevel does not.
  - `versionOom(v)` = `oomOfLevel(v.Lg)` turns a version's G into λ and back. Because λ caps at 15, every model past ASI reads the same OOM in detection, findings, agendas, covert acts, footholds and ideas (52 call sites of the oversight converters). The true `v.G − gV0` is available.
  - `measuredOom` converts the measured *level* to OOM through the preset-dependent knots.
- Evidence: safety/oversight.ts:24-42, 85-93; models/capability.ts:48, 59-64; callers: safety/detection.ts:222,273,294,324, safety/findings.ts:226, safety/agendas.ts:177,204, safety/covert.ts:90, safety/ideas.ts:40, core/selectors.ts:134-135.
- Player sees: the oversight gap "X OOM (Y levels, ≈Z Elo)" (chips.tsx:42-48).
- Fix: merge. `versionOom = v.G − gV0`; `oomOfLevel` becomes `gOfLevel − gV0` (one function); delete the second LEVEL_AT.
- Severity: medium · Effort: S

### MEA-10 Safety half-points: v2's M½ converted through the ai2027 reference path for every preset
- Test(s): 5, 2
- What: Agenda and technique decay points are stated as v2 R&D-multiplier values M½. They are converted to OOM through REF_M_LEVEL ((M, L) pairs on the ai2027 reference) and a second ai2027 world built inside oversight.ts (`refPathWorld`). DECAY_KAPPA = 0.27 is fitted so v2's 1/(1+(M/M½)^k) keeps its half points. A slow or fast world therefore uses ai2027's OOM spacing for safety decay. The refPath cache had to be keyed on calibration values because it leaked state between games (comment at oversight.ts:45-49).
- Evidence: safety/oversight.ts:44-83; data/v2/oversight.ts:46-61; safety/findings.ts:23.
- Player sees: technique strength vs level curves (selectors.ts:134-135), and a "half at L x" readout derived through this.
- Fix: make real. Restate each agenda's half point in OOM above V0 in data, once. Delete REF_M_LEVEL, `refPathWorld`, `oomOfRefM` and OOM_PER_HALVING's v2 justification.
- Severity: medium · Effort: M

### MEA-11 Rivals' AI labour reads general G, and their domain profile is fixed
- Test(s): 4
- What:
  - The player's research AI labour uses per-domain fits: SWE/EXP/IDEAS from G_pre + data specialisation + per-domain RL − the reference RL profile + design, with the horizon from AGENCY or CODE G.
  - Rivals' aggregate research uses general G for EXP and IDEAS coverage, win rate, AI taste and h50 (rivalModel.ts:283-293).
  - Their displayed domains are always `Lg + REF_OFF[d][0]` (`setModelG` → `domainsOf(w, G)` with no offsets).

  At the reference recipe the two roughly agree. Rivals can never specialise, and RL focus or data mix can never matter for them. Their incidents (`labModelHazards`) read the fixed profile.
- Evidence: actors/rivalModel.ts:224-227, 283-293, 171-181; departments/workfit.ts:53-58 ("a rival's model reads its general G").
- Player sees: nothing; it shapes how fast rivals move.
- Fix: keep the aggregate model, but give rivals a reference-profile build so they go through the same `workFit`.
- Severity: low · Effort: M

### MEA-12 Rivals get continual learning for free at L 8.5; the player must research P08
- Test(s): 3, design
- What: `CL_LEVEL = 8.5` ("the Research-agent milestone, v2's simple-lab rule"). Every non-player lab whose internal λ reaches 8.5 re-applies its whole recipe weekly (`clG`), with no research, no compute share and no risk. The player gets the same mechanism only by adopting paradigm P08 and starting a stream that costs `STREAM_POOL_SHARE` of training compute. RefBot's gate opens P08 at "v2 level 7". The threshold is a display level, so in OOM it sits at a different point on each preset (λ slopes above).
- Evidence: data/v2/rivalModel.ts:25-29; actors/rivalModel.ts:516-531; actors/rivals.ts:394-395; models/actions.ts:199-206; bots/ref.ts:94-98.
- Player sees: nothing; rivals' versions improve weekly after L 8.5.
- Fix: make real. Rivals adopt continual learning by the same rule as the player at aggregate level (research progress on the P08 line, or a per-archetype adoption draw). Its compute cost should come out of their training pool.
- Severity: medium · Effort: S

### MEA-13 Leader and China efficiency multipliers are fitted in place of missing mechanisms
- Test(s): 2
- What:
  - The leader lab's research speed is ×10^LEADER_CAL: −0.15, 0.07, −0.01 and **0.80** (slow: ×6.3). This was refit about 10 times as other systems changed (calibration.ts:28-56).
  - China's efficiency is scaled by CHINA_CAL.effScale = 1.5 (refit 2.4 → 3.2 → 1 → 1.5).
  - The comments say why: the aggregate leader "has no idea projects", "takes off slower than RefBot after SC", and "runs SAR → ASI in 2.2 y where the golden takes 3.8 y". The multipliers stand in for the paradigm and idea channel that the player and RefBot have and the aggregate model lacks.
- Evidence: data/v2/calibration.ts:28-57, 69-81; actors/rivals.ts:156; production/production.ts:418-421.
- Player sees: nothing; it decides the pace of the reference rival and of China.
- Fix: make real. Add the missing aggregate channel, e.g. paradigm-adoption steps on the recipe parts' returns at λ thresholds that follow the player's tree; then refit to a single global constant or none.
- Severity: medium · Effort: L

### MEA-14 Knowledge diffusion: a fitted constant, one-way and only from one lab
- Test(s): 2, 3, 6
- What: The player's pretraining stack gains `K_DIFFUSION (2.0/yr) × (leader lab's public G − player's best G)`.
  - It only works when the AI 2027 leader lab exists. In the leader start, or once a rival other than LEADER_ID is ahead, diffusion is zero.
  - Rivals and China never diffuse from anyone. The comment calls distillation leaks "the symmetric term", but those run through a different mechanism (security.ts:95-106).
  - It compares model G with model G but writes into the recipe, so it takes effect only at the player's next base.
  - K was fitted so follower starts stay "3–5 months behind" (calibration.ts:59-66). That is a target-forcing rule against [Emergent outcomes].
- Evidence: production/production.ts:487-496, 501-505; data/v2/calibration.ts:59-66; core/limitsView.ts:48-55.
- Player sees: a "Knowledge diffusion: recipe ×N your own rate, from <leader>" limit line (limitsView.ts:54).
- Fix: redesign. Every lab (player, rivals, China) absorbs from *every* public or open model above it by one sourced rule (papers, staff moves, distillation of outputs), in the same recipe part. Drop the fit-to-lag K.
- Severity: medium · Effort: M

### MEA-15 Leak and transfer sizes are "N days × the player's pace", and previews do not match effects
- Test(s): 2, 6, design (previews match effects)
- What: Every hand-made knowledge transfer is sized as days × `paceOf(s)` (the *player's* pace) × B:
  - A4 publish: 9 d × 0.3 to every lab whose recipe is below the player's.
  - C4 poaching: 5 d.
  - E1 Track-2: 1 d to China.
  - E16 "let go": 0.1 y.
  - C6 open weights: G − behind·0.3·pace·B.
  - SPILL: 0.02·B.

  So a leak *to* a rival grows with how fast the *player* is improving, not with what was leaked. Previews:
  - A4 shows "+9 d lead leak". The effect is 0.3 × 9 d of recipe, and it is realised only at each lab's next base or continual-learning refresh.
  - E16 shows "36 d lead, that rival closes 0.1 y". The effect is likewise a recipe increment, not a model jump.
  - C6 shows `60/behind` days. The effect is 0.3 × the model gap into each rival's recipe.
- Evidence: actors/actions.ts:108-116, 325-333, 342-350, 388-395; events/catalog/company.ts:36-43; safety/findings.ts:33-35; actors/rivals.ts:453-466.
- Player sees: the lead-day previews above.
- Fix: make real. Size transfers by what is transferred (the source's recipe gap × an absorbed share) and compute the preview from the same function (a projected lag change at the recipient's next version).
- Severity: medium · Effort: S

### MEA-16 v2's knot production function is still built for every world
- Test(s): 5
- What: `prodParamsFor` builds v2's knot table (`buildKnots`, R13 tables, `referenceRate`, `multiplierAt`) for every world. The only readers are BRIDGE(V7) lines, which the comments describe as "identity test only (no lab reads it since F1)": evalM's non-v3 branch, `tasteCurve`, `evalProduction`'s non-v3 branch and `bestResearchMix`'s knot branch. There are 26 BRIDGE tags in src.
- Evidence: world/hidden.ts:41-47; production/production.ts:14-18, 263-345, 442; production/knots.ts:160-170, 267-280.
- Player sees: nothing.
- Fix: remove the non-v3 branches and `buildKnots` from world creation. Keep the identity test on a fixture if it still guards anything. Keep `Xces`, `hRef` and `refTotal`, which are live.
- Severity: low · Effort: M

### MEA-17 The measured level is truth plus one noise draw, not a reading of the evals (and the glossary says otherwise)
- Test(s): 1, 6
- What: `measuredL = Lg + errTrue/√nEff` (one N(0, 0.2) draw per version). Benchmark scores are drawn separately from domain levels and do not feed it. Sandbagging (`sandbagGap`) lowers only dangerous benchmarks and never touches the measured level. The glossary says the level is "as MEASURED by your evals (noisy; sandbagging biases it down)". That is a PHANTOM claim.
  Because many systems read the measured level (RefBot gates, gov `seenL`, the oversight gap, milestone notifications, the act thresholds), a sandbagging model is never under-read where it matters.
- Evidence: models/benchmarks.ts:36-37, 74-110; data/v2/glossary.ts:19.
- Player sees: "L x ± sd" on every model (Models.tsx:97-110), next to benchmark scores that are not its source.
- Fix: make real (derive the measured level from the suite's benchmark readings, so sandbagging and eval-awareness flow through), or fix the glossary.
- Severity: medium · Effort: S

### MEA-18 Hard-coded level thresholds scattered across systems: v2 era-table leftovers
- Test(s): 5, 2
- What: Many mechanisms switch at fixed display levels:
  - gov: `seenL` ≥ 6.5 / 8.5 / 10, slopes from L 5 and 5.5, `seenM` ≥ 1.5 / 10 (gov.ts:102-128, 293, 314);
  - rival latent reasoning "era" at Lg ≥ 9 (rivals.ts:356);
  - rival signals S3 at L ≥ 10 and S8 ramp (L − 8)/6 (rivals.ts:260-265);
  - capIndexOfLevel for S5 (rivals.ts:279-284);
  - rival misuse hazard ∝ Lg − 7 (rivals.ts:431);
  - trait-drift cap Lg/10 (rivals.ts:299);
  - detection sigmoid at L 7 (safety/detection.ts:32);
  - control at bestLg ≥ 12 (safety/control.ts:167);
  - HUMAN_REVIEW_L = AG05 overseerL = SC_LEVEL = 10 (data/v2/oversight.ts:39-45; safety/common.ts:23);
  - acts at measured L 6.5 / 8.5 / 12 or M ≥ 25 (capability.ts:326).

  λ's OOM spacing differs by preset (slopes 0.64–13 L/OOM), so these switches sit at different physical capabilities in each world. Most predate λ and were defined on v2's level map.
- Evidence: as listed.
- Player sees: policy changes and acts without a stated cause in their own units.
- Fix: make real or remove, one by one. Where a threshold means a milestone ("expert human = SC"), read the milestone predicate (MEA-01). Where it is a capability dose, state it in OOM or in work-type coverage.
- Severity: medium · Effort: M

### MEA-19 One "progress" currency, seven units; a bare line renders as levels
- Test(s): 6, design
- What: Preview lines with `currency: 'progress'` mean:
  - % research speed (teamActions.ts:31,37; agentActions.ts:238; models/actions.ts:176,334; finance/actions.ts:290);
  - "yr of progress (G −0.024)" (safety/actions.ts:151);
  - runs (events/catalog/safety.ts:27), days (safety.ts:198), version (models/actions.ts:235), % of a run (models/actions.ts:190);
  - with no unit, the UI renders it as "x.xx L" (kit.tsx:221; ui.tsx:117,134).

  The continual-learning previews are constants: "+0.2 L in 30 d" to start a stream and "−0.1 L" to stop one (models/actions.ts:203, 211). They are not computed from the stream mechanism.
- Evidence: as listed.
- Player sees: "progress" pills in different units, and fixed level gains for streams.
- Fix: split into typed currencies (`researchSpeed` %, `capability` in OOM or L, `runTime`). Compute the stream previews from `advanceStream`'s projected G.
- Severity: medium · Effort: S

### MEA-20 Player-facing capability scales: twelve
- Test(s): 6, design
- What: The UI shows capability or progress as:
  1. measured level L 0–15 ± band (Models, chips, Evals);
  2. effective compute G / OOM (Blueprint G gained, card ΔG, Data specialisation and quality, base G);
  3. work-type fit in OOM vs best human / median expert, plus coverage % and win rate (Research and Agents views);
  4. time horizon in minutes (h50, h80; horizon benchmark);
  5. benchmark scores (% with saturating editions);
  6. Elo (oversight-gap tip, chips.tsx:48);
  7. "levels" of gap (same tip);
  8. lead days ± sd (LeadTrack, RiskMap, Finance);
  9. research speed × / % and the AI R&D multiplier M;
  10. "yr of progress" (safety patch preview);
  11. ideas ("Behind at finish: N ideas · X OOM", Blueprint.tsx:458);
  12. months behind (Setup, Setup.tsx:113).

  L, G and fit describe the same model in three unaligned units (MEA-02, MEA-04).
- Evidence: as listed; data/v2/glossary.ts:19, 37, 264, 388, 526, 528.
- Player sees: all of the above.
- Fix: redesign the hierarchy (skill good-ui: one home per datum). G (OOM) is the capability currency. L is a display-only summary derived from G, never an input. Milestone progress is shown as work-type criteria. Lead is shown in days only. Drop Elo and "yr of progress" from the surface.
- Severity: medium · Effort: M

### MEA-21 The default lab policy runs on day 1 and doubles rivals' staff growth and training that day
- Test(s): 3, 5
- What: `defaultLabPolicy` (continual system, order 45) is meant for rivals not managed by WS4. `RivalLab.managed` is set only inside `labDaily` (order 100), never at newGame. So on day 1 every rival and China runs both policies: `growLabStaff` twice, `trainDay` twice, `labReferenceSplit` twice, `clRefresh`, and a public-model bump. My probe found the rival's staff ratio on day 1 = 1.0015787 = hRef ratio² (1.000789²). After day 1, `defaultLabPolicy` is dead code.
- Evidence: models/runs.ts:634-646, 718-725; actors/rivals.ts:341; probe.
- Player sees: nothing measurable.
- Fix: remove `defaultLabPolicy` (all labs are WS4-managed), or set `managed` at init.
- Severity: low · Effort: S

### MEA-22 Milestone names disagree
- Test(s): 4
- What: `MILESTONE_NAMES[2]` = "Research agent" (capability.ts:18; used in the log and the Research view), while v1 `MILESTONES[2]` = "Online Learner" / Agent-2 (data/world.ts:27). The EndScreen's AI 2027 comparison table labels the player's work-type milestone days with the v1 names and canon dates. Idx 0 is "Agent" vs "Agent-0 / Unreliable Agent".
- Evidence: models/capability.ts:18; data/world.ts:24-32; ui/v2/end/EndScreen.tsx:48, 124-126.
- Player sees: two names for the same row.
- Fix: one name table; the EndScreen maps canon dates by index only.
- Severity: low · Effort: S

### MEA-23 Start-gap conversions differ between rivals, China and the player
- Test(s): 4, 5
- What:
  - Rivals: a v1 archetype gap draw (`arch.gapYears`, v1 span [0.1, 1.1] y) is linearly remapped to 3–9 months, then converted to G at the v1 pre-game rate `referenceRate(p0, 2025.5) × B` (rivals.ts:74-78).
  - China: `chinaGapYears (0.6) × B` with no rate (china.ts:27). Its intel prior is `0.6 × 365 × 0.8` days (china.ts:52).
  - Player follower starts: `lagMonths/12 × referenceRate` (init.ts:156).
- Evidence: as listed; data/world.ts:261-286 (BASELINES chinaGapYears).
- Player sees: the starting lead estimates.
- Fix: state every start gap in OOM in data (or in months at one stated OOM/yr), with one conversion.
- Severity: low · Effort: S

### MEA-24 Save migrations keep the retired bridge alive
- Test(s): 5
- What: `legacyG` (pm → G) and `legacyE` (pa → recipe), `migratePmPa` and `migrateRivalPhys` / `migrateRivalRecipe` read `playerStart(w).target`, `.pa0` and `B_G_PER_Y`. They are one more reason the v2 start solution (MEA-05) and B (MEA-03) cannot be deleted.
- Evidence: core/save.ts:118-150; actors/rivalModel.ts:487-504.
- Player sees: nothing.
- Fix: drop pre-rev-33 save support (the file already refuses revs ≤ 14), or freeze the constants these migrations need as literals.
- Severity: low · Effort: S

### MEA-25 The epilogue projects rival misalignment with a stand-in trait model
- Test(s): 4
- What: `rivalTraitStep` in rivals.ts is marked "STAND-IN for WS2's trait graph". Rivals actually drift by `ws2RivalTraitStep` (safety/traits.ts). The stand-in is still used by `projectedMisAtAsi`, which also assumes capability rises linearly in L to 15, a "× 0.7" time factor and `paceOf`. The stale comment on `rivalSpeedMult` ("Not applied under the M0 placeholder progress") is wrong: it is applied (production.ts:419-421).
- Evidence: actors/rivals.ts:244-250, 289-313; endings/epilogue.ts:54-75.
- Player sees: the epilogue's "Mis at ASI" projections.
- Fix: project with the real trait step and the lab's own G slope; delete the stand-in.
- Severity: low · Effort: S

### MEA-26 About a dozen "rate / pace / speed" notions
- Test(s): 4, 6
- What:
  - `gRate`: OOM/day of the player's stack G-equivalent, a 14-day EMA seeded at 0.83/yr.
  - `prodCache.rate`: progress-y/yr; the player's is gRate/B × M ratio, rivals' eRate/B.
  - `modelRate` / `paceOf` / `rateOf`: rate + (1 − share).
  - `researchSpeedRel` and RivalResearch `rs`.
  - M: the AI R&D multiplier.
  - `recipeRate` / `recipeRates.g`: rivals' G-equivalent growth at the *reference* RL FLOP.
  - `serveRate`.
  - `referenceRate`: the v1 integrator.
  - `preGameRate` and `rate0`.
  - researchView `oomPerYear`.

  The player's and rivals' "rate" are built differently (EMA of realised stack growth vs instantaneous law at FLOP_RL_REF). Then they are averaged together in lead conversions (intel.ts:33, rivals.ts:218).
- Evidence: models/research.ts:754-757; models/tree.ts:104-113; production/production.ts:193-195, 240; actors/rivalModel.ts:342-375; actors/rivals.ts:193-206; world/calibration.ts:41-45; models/capability.ts:273-279; models/researchView.ts:276.
- Player sees: research speed ×, M, and "OOM a year" in the Research view. The lead numbers depend on the hidden ones.
- Fix: merge into two readouts per lab: research speed (input, relative to leader day 0) and frontier G slope (output, OOM/yr from history). Everything else derives from them.
- Severity: medium · Effort: M

---

## Counts
- high: 4 (MEA-01, 02, 03, 07)
- medium: 14 (MEA-04, 05, 06, 09, 10, 12, 13, 14, 15, 17, 18, 19, 20, 26)
- low: 8 (MEA-08, 11, 16, 21, 22, 23, 24, 25)

## Simplest coherent model
- **The unit:** every lab's capability is effective compute in OOM. That means a general G and a per-domain G_d (pretraining + data + RL profile + design, with every design, paradigm and curation offset stated in OOM).
- **Mechanics:** everything mechanical reads G or G_d: work fit against human reference points in OOM (the only home of domain difficulty), coverage, horizon, oversight gaps (G differences, no level round trip) and safety half-points (OOM in data).
- **The one conversion:** the player sees capability through λ(G). It is a display-only, monotone map anchored at the work-type reference points (V0, SC, SAR, SIAR, ASI). It is never an input to a mechanism and has no second copy (`oomOfLevel` = `gOfLevel − G_V0`).
- **Milestones:** one predicate, `versionMilestones` on fits, coverage and cost, for every lab.
- **Lead:** one function on recorded G histories: days since the leader's frontier G first reached the follower's G. Intel adds noise to it. There are no progress-years, no B, no (1 − share) and no v1 reference rate.
- **Rivals and China:** they stay aggregate but run the player's mechanisms. They use the same recipe parts and returns, the same research CES on their own model's work fit (a reference-profile build), and the same start rule (recipe age = days since launch × the rate the lab had). Continual learning comes by the same adoption route. One diffusion rule applies from every public model above a lab, to every lab. Leaks are sized by what leaks.
- **Start state:** two sourced data constants (B0's and V0's recipe age) plus each start's lag in OOM.
- **Calibration knobs:** only global constants, no per-lab efficiency fits (LEADER_CAL, CHINA_CAL, K_DIFFUSION) standing in for missing channels.
