# DC-7 Player bot on the three sources

## Changed (`src/engine/v2/finance/plan.ts`)
- **Site choice.** For each chunk of the MW gap, two candidates (grid, gas) of `mw = min(maxMW, max(500, gap))`. For each,
  `siteChoice` starts with crash, rush and fast-track on and community on, reads `leverEffects`, drops any lever whose
  `savesQ` is not above 0 (given the others as set), and re-judges until stable (at most 3 passes). The candidate with
  the smaller `siteLiveInQ` wins; a tie goes to grid. Pay as before (lease while the rating allows, else cash).
- **Rent.** `rentQ = siteLiveInQ(rent)`; when the target minus cloud minus the MW expected live at `q + rentQ`
  (`mwBy`, planned sites included) is short by more than 0.05M H100e, rent `min(1000, need)` MW if at least 100 MW. Still
  gated on `offBalance` (as the old lease step was). No pool cap, no transformer pre-order.
- **`mwBy` (judgement, outside the 205-232 region):** pending sites were counted live at `stageEndDay + buildQ x 91`,
  which is wrong once power waits exist (a power-stage site's `stageEndDay` is when construction starts, a rent site's
  is go-live). Now `siteLiveQ` (forecast.ts) gives the planned go-live quarter. The rent step uses `includePlanned = true`
  (its horizon is now the rent wait, 4 q, not 2 q); chips and bridge still use `false` (firm racks only).

## Check (`scripts/v2/_dc7/check.ts`, all ok, about 2 min)
refBot, seed 1, to 2027-07-01 (day 730): 9 sites built, sources gas and rent; all within [100 MW, cap], rent without
levers. Every gas site had crash + rush + fast-track + community; grid never won (a rushed grid site waits ~15 q for
power against gas rush's 4 q).

| site | source | GW | committed | live |
|---|---|---|---|---|
| S5-0 | gas | 5.00 | Q3 25 | Q1 27 |
| S6-0 | rent | 0.19 | Q3 25 | Q3 26 |
| S7-92 | gas | 3.37 | Q4 25 | Q1 27 |
| S8-92 | rent | 0.16 | Q4 25 | Q4 26 |
| S9-274 | gas | 1.66 | Q2 26 | Q3 27 (delayed) |
| S10-365 | gas | 0.81 | Q3 26 | Q1 28 |
| S11-457 | gas | 0.86 | Q4 26 | Q1 28 |
| S12-549 | gas | 0.87 | Q1 27 | Q2 28 |
| S13-639 | gas | 0.94 | Q2 27 | Q4 28 |

## Notes for the lead
- Moves calibration: yes. The opening build is 8.4 GW of gas at about $205B of capex in the first two quarters (the
  horizon gap at day 0 is large and gas now caps at 5 GW per site with a 4 q wait). Rent halls of 0.16-0.19 GW appear
  in the first quarters. Not tuned (spec: no bot-competence tuning).
- Rent waits were 4 q at the start; a rent site is committed only while `offBalance`.
