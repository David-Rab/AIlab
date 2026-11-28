# E1a report: capability and start estimates

Modules: scripts/v2/estimates/capability.ts, scripts/v2/estimates/start.ts. Run: `node --import tsx scripts/v2/estimates.ts --only capability,start`.
Timing: the areas take 0.8 s and 0.2 s. The whole command takes about 10 s wall on this machine, nearly all of it importing the engine and the
generated series tables (tsx cold start), not estimating. The 3 s limit holds for the estimates, not for process start. 23 rows, 15 in band, 8 WARN, no absurd.

Capability rows are computed per AIFM draw (every draw of the timeline: 289 / 290 / 290), by taking the one built newGame world and swapping in the
draw's own `v3` and `aifmRun` (what `timelineFor` does), then calling `refGAt` and the rest. Median over draws is the estimate; p10-p90 is in the text.

## Rows built

| id (suffix) | estimate | band | in / out |
|---|---|---|---|
| GPATH.ai2027.2026 (tl-central) | slope median 1.50 G/yr (p10-p90 0.91-3.07) | 1.1-1.3 | out |
| GPATH.ai2027.2026 (tl-fast) | 1.70 (0.99-3.18) | 1.1-1.3 | out |
| GPATH.ai2027.2026 (tl-slow) | 1.47 (0.94-3.03) | 1.1-1.3 | out |
| GPATH.anchorDeviation (tl-central / fast / slow) | worst anchor miss 0.55 / 0.79 / 0.65 G (p10 0.15-0.25, p90 2.6-2.8) | ≤ 0.2 | out |
| METR.h50.doubling (tl-central) | 3.8 months (1.9-6.4) | 3.2-5.2 | in |
| T1.golden.milestones (each timeline, SC) | AIFM date minus reference date: 0.00 y | ±0.08 y | in (by construction) |
| T1.golden.milestones (each timeline, SAR) | -0.00 y | ±0.12 y | in |
| T1.golden.milestones (central / fast / slow, ASI) | -0.04 / -0.04 / -0.16 y median; p10 -6 to -20 y, p90 +1 to +3 y | ±0.12 y | in, in, out (slow) |
| CAST.rivalGaps.start | 0.0, 3.0, 2.5, 6.5, 9.6, 3.0 months (Marenth, Lanternworks, Tarnwick, Zorvane, Wolderfield, Pellory) | 0-11 | in |
| CAST.china.startLead | 6.50 months | 6.5-8 | in (the lower edge exactly) |
| F5.evalAwarenessStart | 15.0% | 10-30% | in |
| M.startReadout | M 1.514 vs source 1.100, deviation 0.41 | ≤ 0.1 | out |
| DANGER.start.actRate | 0.58 acts per lab-year | 0.4-3 | in |
| DANGER.start.common | SYC 0.15, RH 0.10 | SYC > 0.1, RH > 0.05 | in |
| DANGER.start.rareActs | SAND 3e-5, COLLUDE 5e-6, SCHEME 3e-6, POWER 5e-4 | < 0.005 (POWER < 0.01) | in |

## What the out-of-band rows suggest (cautiously)

- **G path (slope and anchor miss).** This answers the open KNOWN item "RefBot 0.75 G/yr vs 1.1-1.3". The reference frontier is not the cause of the
  gap: it runs at 1.5-1.7 G/yr in the median draw, above the band, so RefBot's 0.75 is below its own reference by about 2x. That points at RefBot's
  dynamics (a staircase of bases lagging the reference) rather than at a parameter. But the estimate is also off the band the other way, and the draws
  are very spread (p10 0.9, p90 3.1): the band is the original AI 2027 curve, and the draws are AIFM runs, whose early path is a different object.
  Whether the band should apply per draw or to the median is a design question, not for this report. The anchor-miss row is out for the same reason
  (the median draw is about 0.55 G off; p10 is 0.15, so some draws are inside).
  Caveat: the five anchors are shifted by the overtraining factor (fOver, from the report's rule) before comparing; a wrong shift would move all draws together.
- **METR doubling** is in band at 3.8 months; the reference does not explain any METR miss (the h50 law with its acceleration is on the right side).
  The estimate takes the AGENCY horizon as moving with G.
- **T1 milestones.** SC is by construction. SAR also matches to the day, so the translation of SAR is fine on the median. ASI matches at the median
  in fast and central but not in slow (-0.16 y), and the spread is huge in every timeline (p10 6-20 years early): AIFM's ASI date is a heavy-tail
  number (some runs reach it 2050+), and the reference frontier's knot is reached far earlier there. That looks like a parameter of the ASI knot
  (ASI_EXTRA.gaps / the 2·Δ_bm margin) in the tails, not a median problem. The band is the golden-day tolerance applied to a median.
- **M.startReadout** is 0.41 over. Two readings differ: the registry reads `research.last.x.mExp` at day 1 (after the auto mix, one tick), this
  estimate reads the EXP slot's m on the untouched day-0 state. The deviation may be a definition difference as much as a parameter. Not investigated further.

## Rows skipped (and why)

- **#4 safetyrates rows:** waits for the extraction (a), per the brief.
- **F5.evalAwareness2026, F5.afComplianceGap2026, F6.persistence.scheme, F2.\*, F5.antiScheming.cut:** need extraction (a) / (b).
- **STACK.pretrainRate.ai2027:** needs an engine `expectedLineGain(pool, q)` including adoption (medium-high drift); not built.
- **T2.labour.SCband:** needs extraction (c) `aiFteOf`.
- **CAST.china.trailMean, H20 China gap Nov 2026:** need extraction (d) (npcTarget / relax step as pure functions).
- **MO.anchor.\*:** fit identity (needs (e); not a target).
- **T3.china.afterTheft, EV9.releaseSuites:** restate a parameter (60 days; 14 days); not an estimate of anything.
- **P3.elasticities:** the registry has no value.
- **START.\*:** outcome of played games; only the day-0 lag is estimable and no registry id holds it (see below).
- **CAST.china.behindShare, S4/S5, BOT.\*, T-tree.durations, R5.\*, T3.china.gapFormula / stubLead:** no estimate exists (NO in MAP-A).

## Needs extraction (a row would have to copy a formula)

(a) `postRunEnv` from applyRunToTraits; (b) `removalShare` from stepTraits; (c) `aiFteOf` from labourOf; (d) pure `targetLagOf` / `relaxLag` from the NPC code;
(e) κ from COVERT_ANCHOR; (f) G_ANCHORS is still written inline at calreport/milestones.ts:54 (this module reads the H5.gpath anchors from balance/scenarios.ts
and applies fOver to them, so it has its own copy of the shift rule `fOver(REF_TPP)/fOver(50)`; one home would be better).

## Registry entries wanted (no id exists; the number is sourced in balance/scenarios.ts)

Each would let `estOf` build a row. Source and number are already in the scenarios file; the registry needs the id.

| wanted id | number | source |
|---|---|---|
| METR 50% horizon at Aug 2025, Dec 2025, Feb 2026, Apr 2026 (H3.metr.h50.\*) | 203 (113-406), 354, 719 (317-3634), 1045 (509-3304) min | METR TH1.1, research/03:262-274 |
| METR 80% horizon Apr 2025, Dec 2025, Apr 2026 and the h80 over h50 fraction (H2.\*, H4) | H2.metr.h80.2025-04 30 min, others in scenarios.ts; h80/h50 0.2 | METR; research/20:51; workTypes.ts:147 |
| AIFM h50 horizon at 2027 / 2028 per timeline | AIFM_RUNS[tl].series.h50 quantiles | AIFM run, scenarios.ts |
| SAR / ASI dates of each timeline as their own targets | AIFM_RUNS milestones quantiles | AIFM run |
| Day-0 lag of each start position | contender 3, capital 6, talent 6.5, scratch 12 months | research/18 §0.1, data/v2/starts.ts lagMonths (chain: newGame({start}) → lagDays(s, 'player', leader) vs startLagG) |
| China behind the US frontier, Nov 2026 | 6.5-8 months | IFP, CAISI (H20.chinaGap.\*); also needs extraction (d) |
| AI R&D uplift ~2x (1.3-3), Oct 2026 | 2 (1.3-3) | METR (H26.uplift.metr); a fixture read |
| the G slope as its own id | 1.1-1.3 G/yr | H5.gpath.slope; today GPATH.ai2027.2026 mixes the slope band with the anchor tolerance |
