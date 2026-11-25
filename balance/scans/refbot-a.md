# RefBot scan A: one-at-a-time sensitivity of RefBot's hand-chosen settings

File: `balance/scans/refbot-a.json` (a `balrun --sets` array; 69 sets, each changes one registry param `bots.ref.*`; `base` is added by balrun). Values are what `applyOverrides` replaces the plain field with (game constants in `DEFAULT_REF`, `src/engine/v2/bots/settings.ts`).

Rules used: continuous values x0.5 / x1.5; whole-day values rounded to whole days; small integers -1/+1 (1-2 -> x0.5/x2); shares stay in 0..1 (clamped up-values are flagged); `retryDays-0` added (the player can reopen at once).

Dry check: every one of the 69 sets was applied with `applyOverrides` in its own fresh process and resolved (live value read back changed). Smoke: `balrun --policy ref --world ai2027 --align medium --start leader --seeds 2 --sets` (2 sets + base): 6/6 games ran, overrides present in each non-base record (`overrides`, `overrideSet`).

## Sets (69, 34 fields)

| set | registry id | base | new | kind | note |
|---|---|---|---|---|---|
| retryDays-down | bots.ref.REF_RETRY_DAYS | 180 | 90 | untagged |  |
| retryDays-up | bots.ref.REF_RETRY_DAYS | 180 | 270 | untagged |  |
| retryDays-0 | bots.ref.REF_RETRY_DAYS | 180 | 0 | untagged | player can reopen at once |
| ideaTeams-down | bots.ref.REF_IDEA_TEAMS | 3 | 2 | designer |  |
| ideaTeams-up | bots.ref.REF_IDEA_TEAMS | 3 | 4 | designer |  |
| baseEvery-down | bots.ref.BASE_EVERY | 270 | 135 | untagged |  |
| baseEvery-up | bots.ref.BASE_EVERY | 270 | 405 | untagged |  |
| baseDays-down | bots.ref.REF_BASE_DAYS | 121 | 61 | untagged |  |
| baseDays-up | bots.ref.REF_BASE_DAYS | 121 | 182 | untagged |  |
| student-down | bots.ref.REF_STUDENT | 0.5 | 0.25 | designer |  |
| student-up | bots.ref.REF_STUDENT | 0.5 | 0.75 | designer |  |
| postEvery-down | bots.ref.POST_EVERY | 42 | 21 | untagged |  |
| postEvery-up | bots.ref.POST_EVERY | 42 | 63 | untagged |  |
| safetySciTeams-down | bots.ref.REF_SAFETY_SCI_TEAMS | 4 | 3 | untagged |  |
| safetySciTeams-up | bots.ref.REF_SAFETY_SCI_TEAMS | 4 | 5 | untagged |  |
| alignShare2025-down | bots.ref.REF_ALIGN_SHARE.2025 | 0.04 | 0.02 | sourced | sourced |
| alignShare2025-up | bots.ref.REF_ALIGN_SHARE.2025 | 0.04 | 0.06 | sourced | sourced |
| alignShare2026-down | bots.ref.REF_ALIGN_SHARE.2026 | 0.03 | 0.015 | sourced | sourced |
| alignShare2026-up | bots.ref.REF_ALIGN_SHARE.2026 | 0.03 | 0.045 | sourced | sourced |
| safetyShareFloor-down | bots.ref.refSafetyShare.floor | 0.2 | 0.1 | untagged |  |
| safetyShareFloor-up | bots.ref.refSafetyShare.floor | 0.2 | 0.3 | untagged |  |
| safetyAgentsTolerance-down | bots.ref.refSafetyAgents.tolerance | 0.1 | 0.05 | untagged |  |
| safetyAgentsTolerance-up | bots.ref.refSafetyAgents.tolerance | 0.1 | 0.15 | untagged |  |
| monitorSpend-down | bots.ref.REF_MONITOR_SPEND | 0.05 | 0.025 | sourced | sourced |
| monitorSpend-up | bots.ref.REF_MONITOR_SPEND | 0.05 | 0.075 | sourced | sourced |
| monitorCost-down | bots.ref.REF_MONITOR_COST | 0.1 | 0.05 | sourced | sourced |
| monitorCost-up | bots.ref.REF_MONITOR_COST | 0.1 | 0.15 | sourced | sourced |
| monitorShareCap-down | bots.ref.refMonitors.shareCap | 0.8 | 0.4 | untagged | up clamped to 1 (x1.5 = 1.2 is illegal) |
| monitorShareCap-up | bots.ref.refMonitors.shareCap | 0.8 | 1 | untagged | up clamped to 1 (x1.5 = 1.2 is illegal) |
| monitorTolerance-down | bots.ref.refMonitors.tolerance | 0.1 | 0.05 | untagged |  |
| monitorTolerance-up | bots.ref.refMonitors.tolerance | 0.1 | 0.15 | untagged |  |
| splitCadence-down | bots.ref.refPlay.splitCadence | 30 | 15 | untagged |  |
| splitCadence-up | bots.ref.refPlay.splitCadence | 30 | 45 | untagged |  |
| hiringLead-down | bots.ref.refPlay.hiringLead | 0.12 | 0.06 | untagged |  |
| hiringLead-up | bots.ref.refPlay.hiringLead | 0.12 | 0.18 | untagged |  |
| rlSaturation-down | bots.ref.refPlay.rlSaturation | 0.95 | 0.475 | designer | up clamped to 1 (x1.5 = 1.425 is illegal) |
| rlSaturation-up | bots.ref.refPlay.rlSaturation | 0.95 | 1 | designer | up clamped to 1 (x1.5 = 1.425 is illegal) |
| basePoolShare-down | bots.ref.refPlay.basePoolShare | 0.6 | 0.3 | untagged | coupled with baseDays: a run of baseDays at this share |
| basePoolShare-up | bots.ref.refPlay.basePoolShare | 0.6 | 0.9 | untagged | coupled with baseDays: a run of baseDays at this share |
| postPoolShare-down | bots.ref.refPlay.postPoolShare | 0.5 | 0.25 | untagged |  |
| postPoolShare-up | bots.ref.refPlay.postPoolShare | 0.5 | 0.75 | untagged |  |
| enterpriseMargin-down | bots.ref.refPlay.enterpriseMargin | 0.25 | 0.125 | untagged |  |
| enterpriseMargin-up | bots.ref.refPlay.enterpriseMargin | 0.25 | 0.375 | untagged |  |
| keepFull-down | bots.ref.refPlay.keepFull | 4 | 3 | untagged |  |
| keepFull-up | bots.ref.refPlay.keepFull | 4 | 5 | untagged |  |
| keepMinis-down | bots.ref.refPlay.keepMinis | 2 | 1 | untagged |  |
| keepMinis-up | bots.ref.refPlay.keepMinis | 2 | 4 | untagged |  |
| holdMargin-down | bots.ref.leadStudent.holdMargin | 0.05 | 0.025 | untagged |  |
| holdMargin-up | bots.ref.leadStudent.holdMargin | 0.05 | 0.075 | untagged |  |
| upgradeMargin-down | bots.ref.competeRelease.upgradeMargin | 0.01 | 0.005 | untagged |  |
| upgradeMargin-up | bots.ref.competeRelease.upgradeMargin | 0.01 | 0.015 | untagged |  |
| releaseLead-down | bots.ref.RELEASE_LEAD | 0.3 | 0.15 | designer |  |
| releaseLead-up | bots.ref.RELEASE_LEAD | 0.3 | 0.45 | designer |  |
| releaseRefresh-down | bots.ref.RELEASE_REFRESH | 0.1 | 0.05 | designer |  |
| releaseRefresh-up | bots.ref.RELEASE_REFRESH | 0.1 | 0.15 | designer |  |
| releaseCheaper-down | bots.ref.RELEASE_CHEAPER | 0.8 | 0.4 | designer | up clamped to 1 (ratio; x1.5 would replace by a dearer version) |
| releaseCheaper-up | bots.ref.RELEASE_CHEAPER | 0.8 | 1 | designer | up clamped to 1 (ratio; x1.5 would replace by a dearer version) |
| releaseEvery-down | bots.ref.RELEASE_EVERY | 7 | 4 | untagged |  |
| releaseEvery-up | bots.ref.RELEASE_EVERY | 7 | 11 | untagged |  |
| miniMinDays-down | bots.ref.MINI_MIN_DAYS | 30 | 15 | designer |  |
| miniMinDays-up | bots.ref.MINI_MIN_DAYS | 30 | 45 | designer |  |
| trustOversight-down | bots.ref.TRUST_OVERSIGHT | [0.4,0.8] | [0.2,0.4] | designer | both thresholds scaled; up second value clamped to 1 |
| trustOversight-up | bots.ref.TRUST_OVERSIGHT | [0.4,0.8] | [0.6,1] | designer | both thresholds scaled; up second value clamped to 1 |
| trustSabMax-down | bots.ref.TRUST_SAB_MAX | 0.1 | 0.05 | designer |  |
| trustSabMax-up | bots.ref.TRUST_SAB_MAX | 0.1 | 0.15 | designer |  |
| trustStep-down | bots.ref.refTrusted.step | 0.1 | 0.05 | untagged |  |
| trustStep-up | bots.ref.refTrusted.step | 0.1 | 0.15 | untagged |  |
| footholdCaseFte-down | bots.ref.FOOTHOLD_CASE_FTE | 15 | 8 | designer |  |
| footholdCaseFte-up | bots.ref.FOOTHOLD_CASE_FTE | 15 | 23 | designer |  |

By kind of change: 68 numeric down/up sets (34 fields x 2) and 1 retry-zero set (`retryDays-0`) = 69. Of the 34 fields: 4 sourced (alignShare x2, monitorSpend, monitorCost) and the rest untagged or designer.

## Not expressible with the current overrides (listed, not worked around)

| item | why |
|---|---|
| **Research list** (`bots.ref.REF_TREE`, path `research.*`) | The registry path is a `*` family. A number would multiply every member (a string id is not a number); an array value is set into *every* member. Tested: `applyOverrides({REF_TREE: ['P07','P05','P24']})` leaves `DEFAULT_REF.research` as five copies of that array, which breaks the bot. Whole-array replacement needs a registry entry with path `['research']` (a plain array field). |
| `gateOom` (`bots.ref.GATE_OOM`) | Field is a record `{L65,L7,L85,L95}`; the registry entry is an array-valued path `['gateOom']`, and an override would replace the record with a number array (the bot reads `gateOom.L7`, so it would break). |
| `askShares` (`bots.ref.askShare`) | Same: record `{base,post,postTeacher,distill,other}`, registry value is an array. |
| `postsInFlight` (`bots.ref.refPlay.postsInFlight`) | Same: record `{leader, follower}`. (Leader value would be the only one active under `--start leader`.) |
| `lines` (`REF_LINES`, family) | Members are objects `{ag, teams, ideas}`; a numeric multiplier errors, and an array sets every member. Team counts per line are not reachable. |
| `researchGate` | Has no registry id (notes only under `REF_TREE`). |
| `autopilot` | No registry id (finance/plan.ts `REF_AUTOPILOT`). |

### Research sets that would be run once `research` is a plain array field

Prerequisites checked in `src/data/v2/tree.ts` (stars known at start: P01, P02, P03, P04, codeMath; the bot starts a project only when its needs are known, `missingNeeds`). Appended ideas carry no gate (start as soon as the needs are known). Base list: `P07, P05, P08, rl.mlResearch, P17`.

| set (proposed) | append to list | needs beyond the list | note |
|---|---|---|---|
| research-P24 | `P24` | rl.mlResearch (on list) | AI-designed successor, XL, 28.8 TM, pretrain efficiency +~1 OOM; in `RIVAL_IDEA_IDS` |
| research-P09 | `P09` | none | test-time training, M, 28.8 TM; rivals adopt |
| research-P11 | `rl.math`, `P11` | rl.math (not a star, not on the list: must be appended first) | self-play curricula, L, 43.2 TM; rivals adopt |
| research-P16 | `P16` | rl.mlResearch (on list) | AI kernels / HW co-design, M, 21.6 TM, training throughput; rivals adopt |
| research-P18 | `P18` | P05 (on list) | iterated distillation, L, 28.8 TM; not in rivals' list |
| research-P21 | `P21` | P08, rl.mlResearch (both on list) | brain-like sample efficiency, XL, 50.4 TM; not in rivals' list |
| research-P10 | `P10` | codeMath (star, known) | synthetic data flywheel, L, 28.8 TM; not in rivals' list |
| research-P22 | `multimodal`, `P22` | multimodal (not a star: append first) | robotics foundation, L, 43.2 TM; in `RIVAL_IDEA_IDS` |
| research-rivals-all | `P16, P09, P24, rl.math, P11, multimodal, P22` | as above | rivals' own order (cheapest effort first, id breaks ties; P05 and P08 already on the list) |

`RIVAL_IDEA_IDS` = P05, P08, P09, P11, P16, P22, P24 (`src/engine/v2/actors/rivalModel.ts:493`). Also worth an extra set `research-P18-P21-P10` (the three not rivals' ideas). The tree has more ideas the rivals cannot adopt (P12, long-horizon demos; no needs, L, 43.2 TM): not proposed.

## Skipped fields (and why)

| field | registry id / kind | reason |
|---|---|---|
| `followerMaxBaseDays`, `followerGrowQ` | untagged | only used on follower starts; the scan runs `--start leader` (inert there). Add to a follower scan. |
| `miniEvery`, `miniGapL`, `staleMiniGapDays` | untagged | only read under release modes `mini`/`frontier` (stale rule); RefBot's release is `compete`, so these never fire. |
| `cheapMax` | designer | read only when `cheapTier` option is on; off by default (product lineups carry the cheap tiers). |
| `productChannels`, `publicChannels` | untagged | string lists on a family path: an override sets every member to the value, so a list cannot be replaced. The one clear alternative would be adding the `vetted` channel, which the override cannot express. |
| `monitored` | untagged | string list, family: not overridable. |
| `alignShare[*].year` | sourced | family (numeric multiplier would shift both anchor years by x0.5 / x1.5, a nonsense scan); the shares themselves are scanned. |
| `gateOom`, `askShares`, `postsInFlight`, `lines`, `researchGate`, `autopilot`, research list | see above | not expressible. |
| booleans | none | RefBot settings has no boolean fields (the release mode `compete` and `cheapTier` are play options, not settings). |
| group-sum shares | none found | `askShares` pool shares need not sum to 1 (they are per-run asks), but the record is not overridable anyway. |

## Cost estimate

Measured in the smoke run (`ref`, ai2027/medium, leader, 6 workers): a game takes about 18-22 s on one worker; each set's worker processes need roughly 40-45 s of startup (tsx load) before the first game, so a 6-game run took 68 s (5 games/min, not representative).

- Cells: 69 sets + `base` = 70. Games: 70 x 20 seeds x 2 worlds (ai2027/medium, sampled/sampled) = **2800 games**.
- At the 10 games/min planning rate: **about 280 min (4.7 h)**.
- From the measured game time with ~10 workers on this 12-core machine (about 25-30 games/min once warm) plus ~45 s startup per set (70 sets, sets run one after another): **about 2-2.5 h**. Sampled-world games may run longer than the ai2027 ones (not measured).
- Per world alone: 1400 games (140 min at 10/min). Running only the 34 "down" or "up" halves is 1400 games for both worlds.
- Research sets (9 proposed) would add 10 cells = 400 games (40 min at 10/min) once the research list is overridable.
