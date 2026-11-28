# Back-of-envelope feasibility map A: capability, starts, bots, safety, CAST/China

Brief: design/estimates/BRIEF.md. Share: balance/targets.ts sections "capability" (l.7), "start types (R9) and difficulty"
(l.125), "bots" (l.186), "safety" (l.806), and the capability / milestone / horizon / labour / rivals / China / safety
entries of the last section (l.1059). Plus scripts/v2/safetyrates.ts. Read-only map, nothing run.

## Summary

- **51 registry entries mapped: 15 YES, 12 PARTIAL, 24 NO.** NO is mostly bot win rates, start outcomes, and S4/S5 (P_mis and sight limit at SAR or ASI). Those come only from played games. Of the 24 NO, 9 are entries that look like they are not targets (§3).
- **The safetyrates.ts probes already work as back-of-envelope estimates.** They run no game and no tick: they build a state with newGame and call the engine's trait step once. It has 22 banded rows and 4 INFO rows. **Only 5 of the banded rows have a registry id** (F2 ×4, F5.antiScheming.cut). The other 17 sourced bands exist only inside the script, which breaks "one home per target". One more probe row is the estimate of F6.persistence.scheme.
- **Four entries can already be computed without a game.** CAST.rivalGaps.start, CAST.china.startLead and F5.evalAwarenessStart are read from the start state, and DANGER.start.* comes from 8 newGame calls. F5.evalAwarenessStart is only a day-0 trait, but today it is read off 12 cached RefBot games.
- **Blockers worth extracting** (§2, refactors only, no mechanism change):
  - (a) `postRunEnv` from applyRunToTraits, traits.ts:1377-1406. safetyrates' probeRun rebuilds only part of it.
  - (b) A removal-share helper from stepTraits, traits.ts:657. safety-emu.ts:54 `persistence()` copies that formula without the crystal factor.
  - (c) `aiFteOf` from labourOf, workfit.ts:355.
  - (d) A pure NPC target-lag function from npcTarget / npcCapabilityDay, npc/lab.ts:90 and :139.
  - (e) danger.ts:154/161, where κ is derived by copying itemTerms' terms.
  - (f) G_ANCHORS, written inline at milestones.ts:54, is a second home of the H5.gpath anchors in scenarios.ts.
- **The 5 estimates to build first:**
  1. **Reference G path and METR doubling:** refGAt → h50Ratio, compared with H5/H3. This settles the open KNOWN item "RefBot 0.75 G/yr vs 1.1-1.3": it shows whether the gap comes from parameters or from RefBot's dynamics.
  2. **Milestone knots against AIFM dates:** levelKnotsG + clockOfG for each draw, compared with TIMELINE_DRAWS.dates. T1 has no golden days, so nothing checks the SAR/ASI translation today.
  3. **Cast start gaps from startLagDays.** No newGame is needed. China comes out at 6.5 months, exactly on the band's lower edge.
  4. **safetyrates rows on one typical world** (edge weights at w̄): about 40× cheaper. Its 17 unregistered bands move into the registry. Needs (a).
  5. **Start-state reads on one newGame:** F5.evalAwarenessStart, DANGER.start.* and M.startReadout. Several targets, no games, and the eaStart dependency on 12 RefBot games goes away.

## 1. Map

Verdict key: YES = engine functions on reference inputs. PARTIAL = needs one simplification (named). NO = only a played game gives it.
"newGame" means building the state only (allowed by TESTING §2), never ticking it. "w" is the TimelineWorld:
`newGame(...).hidden.timeline` or `timelineFor(rng, setup)` (world/hidden.ts:60).

### capability

| id | verdict | chain | inputs | drift | blocker |
|---|---|---|---|---|---|
| GPATH.ai2027.2026 | PARTIAL: uses the reference frontier instead of RefBot's best model (RefBot is a staircase that lags it) | refGAt(s, y) npc/lab.ts:54 at the 5 anchor dates → least-squares slope (arithmetic on 5 points) → compare with anchors + OVER_DG (fOver effective.ts:28) | refG/TIMELINE_PROGRESS (npc/reference.ts:44, data/v2/timelineSeries.ts) over the central draws; anchors in balance/scenarios.ts H5.gpath.* | low | anchors also sit inline at calreport/milestones.ts:54 (second home): read H5 from scenarios.ts |
| METR.h50.doubling | PARTIAL: AGENCY G taken as moving with G (no domain or h80Mult changes between the two dates) | refGAt(s, 2025.5) and refGAt(s, 2027.0) npc/lab.ts:54 → h50Ratio(w, g1, g0) capability.ts:257 → months = Δt·ln2/ln(ratio) | reference path as above; w.v3.h50PerOOM / h50Accel (V3_CAL, workTypes.ts) | low | none |
| STACK.pretrainRate.ai2027 | PARTIAL: mean prior gain per line (no idea draws, no kept-share selection); the year-1 input is itself a measured [fitted] game quantity | linePoolAt(worldR, node) models/research.ts:114 → lineRate(r, n0, year1[line]) research.ts:147, summed over PRETRAIN_START_LINES | LINE_START_INPUT.year1 and LINE_FIT (data/v2/research.ts:88-98); w.r | medium-high (how an idea turns into stack OOM is addIdea, stacks.ts:105) | an engine `expectedLineGain(pool, q)` that includes adoption would make this low |
| P3.elasticities | PARTIAL: the registry has no value (R13 §1.6 numbers are not entered) | Xces(P, c, l) production/ces.ts:48 → finite-difference elasticities at the reference point | w.prod (prodParamsFor hidden.ts:43); R13 §1.6 values (to be copied into the registry) | low | registry value missing |
| T3.china.afterTheft | YES (but it is the parameter itself, see §3) | structuredClone(newGame or day400 fixture) → theft(s, bestG(s,'player')) npc/shocks.ts:136 → china.lab.npc.d | THEFT_INTEGRATION_DAYS = 60 (shocks.ts:28) | low | none |
| T3.china.gapFormula | NO: the R10 gap formula is no longer in the engine (China's start lag is now the cast table) | — | — | — | not a target any more (§3) |
| T3.china.stubLead | NO: informational, its tool (calib.ts stub path) is gone | — | — | — | superseded by CAST.china.trailMean (§3) |
| R5.buildQueue.stub | NO: queue waits of RefBot's runs depend on its build schedule and capacity over the game | — | — | — | an invariant, not a sourced target (§3) |
| R5.buildQueue.integrated | NO: same, with real finance | — | — | — | as above |

### start types (R9) and difficulty

| id | verdict | chain | inputs | drift | blocker |
|---|---|---|---|---|---|
| START.spinout.firstModel | NO: the first own model's date depends on the bots' compute, hiring and research choices | — | — | — | the day-0 lag part is estimable: see §4, START day-0 lag |
| START.bigtech.catchUp | NO: the catch-up in months 9-15 is emergent | — | — | — | as above (the "starts 6 months behind" part) |
| START.challenger.parity | NO: best case over played games | — | — | — | — |
| START.hardButWinnable | NO: outcome distribution of bot games | — | — | — | a design invariant (§3) |
| START.difficultyLabel | NO: best-bot win rate per start | — | — | — | a label rule; nothing compares it today (§3) |

### bots

| id | verdict | chain | inputs | drift | blocker |
|---|---|---|---|---|---|
| BOT.race.winrate | NO: win rate over 200 bot games | — | — | — | — |
| BOT.race.lossMix | NO: ending mix | — | — | — | — |
| BOT.safe.winrate | NO | — | — | — | — |
| BOT.safe.lossMix | NO | — | — | — | — |
| BOT.mixed.winrate | NO | — | — | — | — |
| BOT.mixed.gap | NO | — | — | — | — |
| BOT.ref.takeover | NO: ending share | — | — | — | — |

### safety

| id | verdict | chain | inputs | drift | blocker |
|---|---|---|---|---|---|
| S4.refBot.pMis | NO: Mis at ASI is the lineage of a whole game (runs, safety work, successor pull), then pMis traits.ts:1487 | — | — | — | — |
| S4.safeRecipe.pMis | NO: same | — | — | — | — |
| S5.refBot.belowL | NO: sight limit at SAR in played games | — | — | — | design reading, not a sourced number (§3) |
| S5.mixedVsRef.sightLimit | NO: sightLimit (safety/sightLimit.ts:154) on SAR states of played games | — | — | — | — |
| S5.mixed.marginHolds | NO | — | — | — | "game-feel, no source" (§3) |
| F2.sabotageAfterHacking | YES (already: safetyrates probe, safetyrates.ts:186) | newGame → postSignals traits.ts:425 + postHack :254 → playerEnv :965 → stepTraits :637 → itemTerms(SAFSAB, 1, 8 h) safety/covert.ts:99 (mdSabotage, safety-emu.ts:52) | newGame tl-central medium (V0 traits, edge weights); EXPLOIT_START × POSITION_BY_ID.talent.exploitMult (data/v2/suites.ts, starts.ts) | medium | (a) probeRun (safetyrates.ts:63) rebuilds only part of applyRunToTraits' post env (no successor pull, steerS4, hackTarget, run memory, probe steer). Extract `postRunEnv` |
| F2.inoculation.mis | YES (safetyrates.ts:196) | same probe ×3 (control / hack / inoculated with T-INOC) → misalignment traits.ts:669 → cut = 1 − (inoc − ctrl)/(hack − ctrl) | as above | medium | (a) |
| F2.inoculation.af | YES (safetyrates.ts:197) | same → AF trait | as above | medium | (a) |
| F2.inoculation.sabotage | YES (safetyrates.ts:198) | same → itemTerms ×3 | as above | medium | (a) |
| F5.antiScheming.cut | YES (safetyrates.ts:213) | newGame → probe with SCHEME 0.13, with and without T-ANTISCHEME → stepTraits → 1 − ratio | as above; ANTISCHEME_REMOVAL traits.ts:736 | medium | (a) |
| F5.evalAwareness2026 | PARTIAL: k reference post runs from V0 along refGAt (k = RefBot's run schedule to 2026-12-31) instead of RefBot's actual lineage | k × [postSignals → playerEnv → stepTraits] → EA. Longer than 4 calls | newGame; refGAt for each run's G; REFERENCE_POST (data/v2/runDesign.ts) | high (successor pull, suites and graders change over the game) | (a); without it this chain copies applyRunToTraits |
| F5.afComplianceGap2026 | PARTIAL: same lineage simplification | as above → expectedObservation(s, v, 'AF', 'BB') safety/detection.ts:396 | as above | high | (a) |
| F6.persistence.scheme | YES via the probe row "F6 persistence of SCHEME … start model" (safetyrates.ts:216); the registry metric reads RefBot's post runs instead | newGame → playerEnv (reference post, SCHEME 0.13) → 1 − removal fraction | as above; SAFETY_REMOVAL traits.ts:715 | medium-high | (b) safety-emu.ts:54 `persistence()` copies stepTraits:657 without the crystal factor (umodes.ts:73). Extract `removalShare(env, x0, j)` from stepTraits |
| MO.anchor.sabotage | YES (sabotage.ts:~81) | newGame → V0 with SAND = COVERT_ANCHOR_X → itemTerms(SAFSAB) covert.ts:99 | COVERT_ANCHOR, COVERT_ANCHOR_X (data/v2/danger.ts:146-151) | low | (e) κ is derived from the anchor by copying itemTerms' terms (danger.ts:154, :161), so this is a fit identity (§3) |
| MO.anchor.steering | YES (sabotage.ts:~87) | as above with STEER and SUCCSTEER | as above | low | (e) |
| DANGER.start.actRate | YES (already: danger.ts, 8 newGame, no sim) | newGame → forEachIncidentSite incidents.ts:405 → dangerOf :394 → × year | newGame start tables (deployments, V0 traits) | low | none. One seed is enough for the estimate (seeds only change world draws) |
| DANGER.start.common | YES (danger.ts:189) | same, per kind | as above | low | none |
| DANGER.start.rareActs | YES (danger.ts:190) | same, per kind | as above | low | none |
| EV9.releaseSuites | PARTIAL: duration at full staffing with no queue; the target (longest wait in a RefBot year, KNOWN 29-89 d) is queueing, which is dynamics | deserialize(day0 fixture) → evalDaysEstimate(s, 'full') models/evals.ts:255 | day0.json | low | the estimate only restates the 14-day parameter. Also the registry checkLabel differs from the evals.ts label ("… at the documented staffing (a full suite is 14 days at full staffing)") |
| T-tree.durations | NO: it fits to V1 RefBot measurements | — | — | — | pins an old version (TESTING §3), not a target (§3) |

### last section (capability / milestones / labour / CAST / safety entries)

| id | verdict | chain | inputs | drift | blocker |
|---|---|---|---|---|---|
| T1.golden.milestones | PARTIAL: reference-frontier milestone dates instead of RefBot's (and there are no golden days); compared with the AIFM run's own dates | for each draw: levelKnotsG(w) capability.ts:24 → clockOfG(s, knot) npc/reference.ts:88 → compare with TIMELINE_DRAWS[tl].dates[i] = [AC, SAR, ASI] | TIMELINE_DRAWS (data/v2/timelineDraws.ts); AIFM_RUNS milestones (balance/scenarios.ts:226-360) | low | none. SC = AC holds by construction (gSC is built from AIFM progress at AC); SAR, SIAR and ASI do not, which is the real check |
| GPATH.anchorDeviation | PARTIAL: same as GPATH.ai2027.2026 | same chain, worst deviation | same | low | (f) G_ANCHORS inline at milestones.ts:54 |
| M.startReadout | PARTIAL: the day-0 state's AI allocation instead of RefBot's day-1 state after its auto mix | newGame (or day0 fixture) → workContext(s).slots.EXP.m departments/workfit.ts:458 vs multiplierRef(w, w.p0) world/calibration.ts:12 | newGame start tables; w.p0 | low (one high-level function each side) | none |
| T2.labour.SCband | PARTIAL: reference compute at the AC date and a reference research split, instead of RefBot's state on its SC day | refTotal(w, yAC) production/ces.ts:96 × research share → fpt of an SC base (frontierFlop ces.ts:103 → baseParams/fptOfParams npc/model.ts:13-15) → fteOfFpt workfit.ts:148 | TIMELINE_DRAWS AC date; REF split constants (bots/ref.ts) | medium-high | (c) aiFte is inline in labourOf (workfit.ts:355, with mult and tok). Extract `aiFteOf(h100e, fpt, mult, tok)` |
| CAST.rivalGaps.start | YES | usCast(undefined) npc/lab.ts:240 (or castOf :252) → startLagDays(e) :174 → / DAYS_PER_MONTH | REALISTIC_CAST publicLagMonths (data/v2/npcLabs.ts:208-276) | low | none. The calreport row builds 41 newGames for this. Its statement ("0 for the leader and its peer", "Meta 9.5") does not match npcLabs.ts (3.0 / 2.5 / 6.5 / 9.6) |
| CAST.china.startLead | YES (small simplification: the internal lag d0; the report reads public models one tick in, and China's release lag is 45 d vs the leader's 30) | chinaCast() npc/lab.ts:278 → startLagDays :174 → / 30.4 | npcLabs.ts:290 (publicLagMonths 6.5) | low | none. The estimate is exactly 6.5 months, the band's lower edge |
| CAST.china.trailMean | PARTIAL: US frontier = reference frontier (lag 0) instead of max(RefBot, rivals); China's compute on its plan × export-access path; no leaks or open-weights moves | for each day: target lag d* = d0 + shortfall/slope (npcTarget npc/lab.ts:90, refSlopePerDay :69) → relax step (lab.ts:139) | refGAt; RIVAL_GROWTH, CHINA_EXPORT_GROWTH (npc/china.ts:13); chinaCast | high | (d) npcTarget reads the state (computeOnline, cPlan), and the relax step is inline in npcCapabilityDay. Extract `targetLagOf(d0, shortOom, slopePerDay)` and `relaxLag(d, dStar)` |
| CAST.china.behindShare | NO: the estimate above is behind by construction (always 100%). The target is whether leaks and open weights close the gap, which is dynamics | — | — | — | — |
| S5.halfStaffDeepensLag | NO: paired played games to SAR | — | — | — | — |
| F5.evalAwarenessStart | YES | newGame (tl-central medium) → internalVersion(s) models/labs.ts:41 → traitsTrue.EA | newGame (V0 = TRAIT_START plus the world's draw) | low | none. Today it is read off 12 RefBot games for a day-0 number |

## 2. scripts/v2/safetyrates.ts: the rows

The script builds a state with newGame for each of 40 medium tl-central worlds (seeds 1-40), runs one post-training probe on V0 through the
engine's own trait step, and reads one number. No game and no tick, so every row is a YES estimate already. The cost (~10 s cold) is the 40
newGame calls. A typical-world version (s.hidden.edgeWeights set to each edge's w̄, "one typical value") would take one newGame.

Shared probe chain (probeRun, safetyrates.ts:63): postSignals traits.ts:425 → playerEnv :965 → postHack :254 (λ) → stepTraits :637.
Its drift is (a): it rebuilds part of applyRunToTraits' post env (traits.ts:1377-1406) and leaves out the successor pull, steerS4,
hackTarget, run memory, the probe steer and the teacher.

| row (safetyrates.ts line) | band | engine calls | registry id |
|---|---|---|---|
| F1 hack rate, typical agentic tasks (167) | 0.3-2% | hackRates traits.ts:75 on suiteExploitMap(s0) | none |
| F1 hack rate, ML-research cheap graders (168) | 23-39% | hackRates on EXPLOIT_CHEAP | none |
| F1 hack rate, SWE cheap graders (169) | 25-100% | hackRates | none |
| E16 learned hacking by recipe (182, 7 lines) | INFO | postHack | — |
| F2 sabotage after learned hacking (186) | 6-20% | probe → itemTerms covert.ts:99 | F2.sabotageAfterHacking |
| F2 sabotage, hacking prevented (187) | 0-1% | same | none |
| F2 AF reasoning after hacking, CoT reading (191) | 30-70% | probe → familyPenalty detection.ts:96 | none |
| F2 AF trait after hacking (192) | INFO | probe | — |
| F2 AF reasoning, control (193) | 0-12% | probe → familyPenalty | none |
| F2 inoculation cut, PERSONA (195) | 75-120% | probe ×3 | none |
| F2 inoculation cut, Mis (196) | 75-90% | probe ×3 → misalignment :669 | F2.inoculation.mis |
| F2 inoculation cut, AF (197) | 75-90% | probe ×3 | F2.inoculation.af |
| F2 inoculation cut, sabotage (198) | 75-95% | probe ×3 → itemTerms | F2.inoculation.sabotage |
| E18 AF capability gate at V0 (203) | 0.95-1 | afCapGate traits.ts:595 on gV0 capability.ts:109 | none |
| F5 AF gap, behavioural reading, S9 = 1 (208) | 43-95% | probe (S9 set) → familyPenalty BB | none |
| F5 AF trait, S9 = 1 (209) | INFO | probe | — |
| F5 AF, one BB detector vs reference (210) | INFO | probe | — |
| F5 EA rise per OOM of capability RL (211) | 0.06-0.19 | probe at ρ and 10ρ | none |
| F5 anti-scheming EA multiplier (212) | ×1.9-6.1 | probe with and without T-ANTISCHEME | none |
| F5 anti-scheming covert-action cut (213) | 90-98% | same | F5.antiScheming.cut |
| F6 persistence SCHEME, start model (216) | 80-100% | probe env → persistence() (copy, see (b)) | the estimate of F6.persistence.scheme (whose registry metric reads RefBot) |
| F6 same, no AG18 healing (217) | 80-100% | safetyRemovalMap / eaCoef / eaSuppression / stackDetectionMap (re-assembles the removal: medium-high drift) | none |
| F6 same, AF (218) | 80-100% | persistence() | none |
| F6 same, SAND (219) | 80-100% | persistence() | none |
| F6 SCHEME at frontier EA 0.5 (220) | 80-100% | persistence() | none |
| F3 hidden-trait transfer into a distilled student (223) | 0-15% | distilledStart traits.ts:1326 → playerEnv(distillSignals :456) → stepTraits | none |
| F3 subliminal share per run, shared init (224) | INFO | OMEGA_KIND × E06 weight | — |

Findings:
- 22 banded rows, 5 with a registry id. The other 17 sourced bands exist only here (TESTING §0, "one home per target"). Each needs a registry entry with its source, already written in the row. The script should then read band, unit and source from the registry by id.
- The registry metric lines are stale: "line ~288 / ~298-300 / ~330" are now lines 186, 196-198 and 213.
- (b) `persistence()` (safety-emu.ts:54) copies the removal term of stepTraits (traits.ts:657) without `crystal`. It agrees only while TGAME stays below the crystal threshold (true at V0, not later). The RefBot-game reading of F6.persistence.scheme uses the same copy.

## 3. Entries that look like they are not targets

- **T3.china.gapFormula:** the R10 formula it checked is no longer in the engine. Superseded by CAST.china.startLead.
- **T3.china.stubLead:** informational, and its tool is deleted. Superseded by CAST.china.trailMean. Also, scenarios.ts:183 calls "T3.china.startLead (150-200 d)" what is this entry.
- **T3.china.afterTheft:** the immediate response equals THEFT_INTEGRATION_DAYS (60) by construction, so it is a parameter identity. Only the relaxation afterwards is dynamics.
- **T-tree.durations:** a fit to V1 RefBot days, which pins an old version (TESTING §3).
- **MO.anchor.sabotage / MO.anchor.steering:** κ is derived from COVERT_ANCHOR (danger.ts:154, :161), so these check that a copied formula still matches itemTerms. That makes them a consistency test, not calibration.
- **R5.buildQueue.\*:** a mechanism invariant (no run waits more than 3 d), with no source.
- **S5.refBot.belowL and S5.mixed.marginHolds:** a design reading and "game-feel, no source", respectively. Both are info only.
- **START.hardButWinnable and START.difficultyLabel:** design rules about the outcome distribution and the label, not sourced numbers.
- **P3.elasticities:** has no value.

## 4. Estimates the registry does not have yet (a sourced number exists in the repo)

| candidate | source in repo | verdict | chain |
|---|---|---|---|
| METR 50% horizon at Aug 2025 / Dec 2025 / Feb 2026 / Apr 2026 | balance/scenarios.ts:119-124 H3.metr.h50.* (METR TH1.1, with CIs), no targetId | YES | refGAt(s, date) → h50Growth(w, g − gV0) capability.ts:250 × H50_V0_MIN |
| METR 80% horizon at Apr 2025 / Dec 2025 / Apr 2026 and the h80/h50 ratio | scenarios.ts:113-126 H2.*, H4.metr.h80over50 | YES | as above × H80_OVER_H50 (workTypes.ts:158) |
| AIFM horizon at 2027 and 2028 for each timeline | scenarios.ts AIFM_RUNS[tl].series.h50 (Q5) | YES | as above, for each timeline's draws |
| SAR / ASI dates of the reference frontier for each draw | TIMELINE_DRAWS[tl].dates (data/v2/timelineDraws.ts); scenarios.ts AIFM_RUNS milestones and gaps | YES | levelKnotsG → clockOfG (the T1 row above, as its own target for each timeline) |
| China behind the US frontier, Nov 2026, 6.5-8 months | scenarios.ts:183-185 H20.chinaGap.* (IFP, CAISI) | PARTIAL (blocker d) | the CAST.china.trailMean chain read at 2026.87 |
| Day-0 lag of each start position | data/v2/starts.ts lagMonths (research/18 §0.1): contender 3, capital 6, talent 6.5, scratch 12 | YES | newGame({start}) → lagDays(s, 'player', leader) capability.ts:306, compared with startLagG starts.ts:274 |
| AI R&D uplift ≈ 2× (1.3-3), Oct 2026 | scenarios.ts:207 H26.uplift.metr (METR) | PARTIAL: day400 fixture's workContext M (a fixture read, so close to the played value) | deserialize(day400) → workContext(s).slots.EXP.m |
| The 17 unregistered safetyrates bands | safetyrates.ts rows (§2), each with its citation | YES | as listed in §2 |

Outside this share: H9.leaderCompute (scenarios.ts:152-154) → refTotal(w, 2025.99) (ces.ts:96) is a YES compute estimate for map B.
