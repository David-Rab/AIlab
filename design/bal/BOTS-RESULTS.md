# RefBot bot-settings scan A1: results

Run `balance/runs/refbot-a1`: 78 one-at-a-time settings plus `base`, each on the same 10 seeds (ai2027 / medium / leader start). Every number is a paired difference against `base` on the same seed. Day 0 = 2025-07-01; year = 2025.5 + day/365.25. Per-set statistics: `balance/scans/refbot-a1-effects.json`. "Win" is the game's verdict, so it includes rival-aligned endings (2 of base's 7 wins).

## Headline

- **Base RefBot**: 7 wins in 10, but only 5 seeds reach ASI at all (all 5 aligned). On the other 5 the game ends first: rival takeover 1, rival aligned 2, contested 1, ousted 1. Median SC 2027.24 (day 637), SAR 2027.81 (day 843), ASI 2028.13 (day 962, on the 5 seeds that reach it).
- **Win rate has no demonstrated headroom.** The best sets reach 9 wins (baseDays-down, keepMinis-down, upgradeMargin-down, releaseEvery-up), but across the 55 non-inert settings the win count is 6.3 +/- 1.7 (min 1, max 9) and base's 7 is already above that mean. The only win-rate effect that passes an exact test is a loss: baseEvery-up, -60pp (6 lost, 0 gained, p = 0.031).
- **Speed has real headroom, from research ideas RefBot never picks.** Appending the rivals' research ideas (`research-rivals-all`) brings SAR forward 83 days (0.23 yr, CI -120..-7, 8 of 10 seeds earlier), SIAR 100 days and ASI 182 days (0.5 yr; only 4 seeds comparable, CI -279..-7). It also reaches ASI on 9 seeds against 5 (9 gained or faster, 1 slower, p = 0.02). The price: SC is 42 days later (CI -2..+56). Single ideas help less: P24 SAR -53 d (CI -109..-14), P16 SAR -16 d (8 earlier, 0 later, p = 0.008), P22 ASI on 9 seeds.
- **The settings that matter are the base-model schedule**: `baseEvery`, `baseDays`, `basePoolShare` (SC moves 30-108 days on all 10 seeds, exact p <= 0.008) and, less clearly, `postEvery`, `splitCadence`, `upgradeMargin`. 14 sets did nothing at all (list below).
- **Trade-off, not a free lunch.** The SC-fastest set (basePoolShare-up, SC -33 d, earlier on all 10 seeds) is the worst for winning (1/10, ASI on 1 seed). The best for aligned ASI (baseDays-down: ASI on 10/10, 9 wins) has SC 78 days later. Research-rivals-all is better on wins (+10pp, not distinguishable from 0) and on SAR/ASI but worse on SC. No set is clearly better on all of SC, ASI and wins.

## Top 15 sets

Ordered by the smallest exact sign-test p across four tests (win, SC, SAR, ASI reached); ties by win effect. Intervals are 95% bootstrap over the 10 paired seeds. SC/SAR/ASI = median paired difference in days (negative = earlier). ASI days use only seeds where both runs reached ASI (n shown). "ASI seeds" = seeds reaching ASI, base -> set.

| # | set | wins (diff pp [CI]; gained/lost) | SC days [CI] | SAR days [CI] | ASI days | ASI seeds | endings changed | min p (test) |
|---|---|---|---|---|---|---|---|---|
| 1 | baseEvery-up | 1/10 (-60pp [-90,-30]; +0/-6) | +108 [52,123] | +67 [37,126] | -152 (n=1) | 5->1 | 5 | 0.002 SAR |
| 2 | basePoolShare-up | 1/10 (-60pp [-100,-20]; +1/-7) | -33 [-37,-22] | +1 [-10,25] | - (n=0) | 5->1 | 6 | 0.002 SC |
| 3 | baseDays-down | 9/10 (+20pp [-20,60]; +3/-1) | +78 [58,139] | +11 [-1,62] | -3 (n=5) | 5->10 | 5 | 0.002 SC |
| 4 | basePoolShare-down | 7/10 (0pp [-40,40]; +2/-2) | +100 [79,173] | +25 [4,93] | +13 (n=5) | 5->8 | 4 | 0.002 SC |
| 5 | research-P16 | 7/10 (0pp [-30,30]; +1/-1) | -4 [-24,3] | -16 [-23,-1] | -11 (n=4) | 5->7 | 5 | 0.008 SAR |
| 6 | research-P11 | 7/10 (0pp [-40,40]; +2/-2) | +5 [1,14] | -8 [-35,0] | 0 (n=5) | 5->7 | 4 | 0.008 SC |
| 7 | research-P22 | 7/10 (0pp [-40,40]; +2/-2) | +6 [0,14] | 0 [-11,7] | -14 (n=5) | 5->9 | 5 | 0.008 ASIreach |
| 8 | upgradeMargin-down | 9/10 (+20pp [0,50]; +2/-0) | 0 [0,0] | 0 [0,0] | -7 (n=5) | 5->8 | 3 | 0.016 ASIreach |
| 9 | splitCadence-up | 5/10 (-20pp [-50,0]; +0/-2) | 0 [-1,0] | -2 [-9,-1] | +6 (n=3) | 5->4 | 4 | 0.021 SAR |
| 10 | research-rivals-all | 8/10 (+10pp [-30,50]; +3/-2) | +42 [-2,56] | -83 [-120,-7] | -182 (n=4) | 5->9 | 6 | 0.021 ASIreach |
| 11 | postEvery-up | 8/10 (+10pp [-20,40]; +2/-1) | +8 [-6,12] | -15 [-32,-8] | -13 (n=5) | 5->8 | 5 | 0.021 SAR |
| 12 | research-P24 | 6/10 (-10pp [-50,30]; +2/-3) | +3 [0,3] | -53 [-109,-14] | -67 (n=4) | 5->8 | 7 | 0.039 SAR |
| 13 | research-P09 | 7/10 (0pp [-40,40]; +2/-2) | +3 [-3,13] | -15 [-35,0] | -18 (n=4) | 5->7 | 6 | 0.070 SAR |
| 14 | rlSaturation-down | 7/10 (0pp [-30,30]; +1/-1) | 0 [0,0] | -7 [-14,0] | -14 (n=5) | 5->7 | 2 | 0.070 SAR |
| 15 | postEvery-down | 4/10 (-30pp [-70,10]; +1/-4) | 0 [-14,1] | +37 [5,74] | -90 (n=2) | 5->3 | 5 | 0.109 SAR |

Ranked by win-rate effect alone: baseEvery-up -60pp [-90,-30] (p 0.031); basePoolShare-up -60pp [-100,-20] (p 0.07); student-down -40pp [-70,-10] (p 0.125, 4 lost 0 gained); miniMinDays-up -30pp [-60,0]; postEvery-down -30pp [-70,10]. All the large win effects are losses. Ranked by days to ASI (n >= 3 pairs): research-rivals-all -182 [-279,-7]; research-P24 -67 [-147,7]; baseEvery-down -21 [-334,1] (n=3); research-P09 -18 [-21,7]; hiringLead-down -14 [-28,0]. baseEvery-up shows ASI -152 days from a single comparable seed (ignore).

## Research sets (appended to RefBot's list P07, P05, P08, rl.mlResearch, P17)

Base: 7 wins, ASI on 5 seeds. Days are paired medians against base (negative = earlier).

| idea | wins | ASI seeds | SC [CI] | SAR [CI] | SIAR | ASI (n) | endings changed |
|---|---|---|---|---|---|---|---|
| P24 | 6/10 | 8 (aligned 7) | +3 [0,3] | -53 [-109,-14] | -56 | -67 (n=4) | 7 |
| P09 | 7/10 | 7 (aligned 7) | +3 [-3,13] | -15 [-35,0] | -21 | -18 (n=4) | 6 |
| P11 | 7/10 | 7 (aligned 7) | +5 [1,14] | -8 [-35,0] | -4 | 0 (n=5) | 4 |
| P16 | 7/10 | 7 (aligned 7) | -4 [-24,3] | -16 [-23,-1] | -8 | -11 (n=4) | 5 |
| P18 | 6/10 | 6 (aligned 6) | 0 [-1,9] | 0 [-8,1] | 0 | +7 (n=4) | 5 |
| P21 | 7/10 | 6 (aligned 6) | 0 [0,4] | 0 [-7,4] | 0 | -4 (n=4) | 3 |
| P10 | 7/10 | 7 (aligned 7) | +1 [0,11] | -1 [-15,1] | -4 | -7 (n=4) | 5 |
| P22 | 7/10 | 9 (aligned 8) | +6 [0,14] | 0 [-11,7] | -7 | -14 (n=5) | 5 |
| rivals-all | 8/10 | 9 (aligned 9) | +42 [-2,56] | -83 [-120,-7] | -100 | -182 (n=4) | 6 |

Reading: no research set wins more games (6-8 of 10, inside the noise band). They shift timing. The ideas rivals adopt (P24, P09, P16, P22, and all together) pull SAR and/or ASI earlier; none brings SC forward by more than a few days, and several push it a little later (compute goes off the main line). The three ideas rivals do not adopt (P18, P21, P10) show nothing. As a group the 9 research sets reach ASI on 7.3 seeds on average, against 5.5 +/- 1.8 for the settings, and 6 of 9 have an earlier SAR median. That group signal is stronger than any single set. The `research-P18-P21-P10` set proposed in refbot-a.md was not run.

## By field (down / up; retryDays: down / up / zero)

Columns: win difference in pp; seeds reaching ASI (base 5); median SC and SAR difference in days; seeds identical to base (of 10). "Both +" / "both -": down and up move wins the same way (10pp or more), which points to noise or a base off its optimum, not a dose-response. "Clear" and "suggestive" = smallest exact p <= 0.01 / < 0.05 in either direction.

| field | wins pp | ASI seeds | SC d | SAR d | identical | read |
|---|---|---|---|---|---|---|
| retryDays (dn/up/0) | 0 / -10 / -10 | 5 / 5 / 5 | 0 / 0 / 0 | 0 / 0 / 0 | 7 / 7 / 5 | noise |
| ideaTeams | +10 / +10 | 8 / 8 | 0 / 0 | 0 / 0 | 0 / 0 | noise (both +) |
| baseEvery | -10 / -60 | 5 / 1 | +16 / +108 | -6 / +67 | 0 / 0 | clear |
| baseDays | +20 / -10 | 10 / 6 | +78 / +1 | +11 / +9 | 0 / 0 | clear |
| student | -40 / -10 | 3 / 6 | 0 / 0 | 0 / 0 | 0 / 0 | noise (both -) |
| postEvery | -30 / +10 | 3 / 8 | 0 / +8 | +37 / -15 | 0 / 0 | suggestive |
| safetySciTeams | -20 / -10 | 5 / 5 | 0 / 0 | 0 / 0 | 0 / 1 | noise (both -) |
| alignShare2025 | 0 / -10 | 6 / 5 | 0 / 0 | 0 / 0 | 0 / 0 | noise |
| alignShare2026 | -10 / -20 | 5 / 5 | 0 / 0 | 0 / 0 | 0 / 0 | noise (both -) |
| safetyAgentsTolerance | -10 / -10 | 4 / 5 | 0 / 0 | 0 / 0 | 4 / 2 | noise (both -) |
| monitorSpend | 0 / +10 | 6 / 6 | 0 / 0 | -1 / 0 | 0 / 0 | noise |
| monitorCost | -10 / 0 | 4 / 5 | 0 / 0 | 0 / 0 | 6 / 6 | noise |
| monitorTolerance | +10 / 0 | 6 / 6 | 0 / 0 | 0 / 0 | 4 / 3 | noise |
| splitCadence | 0 / -20 | 9 / 4 | 0 / 0 | +1 / -2 | 0 / 0 | suggestive |
| hiringLead | +10 / 0 | 7 / 6 | 0 / 0 | 0 / 0 | 0 / 0 | noise |
| rlSaturation | 0 / 0 | 7 / 5 | 0 / 0 | -7 / 0 | 0 / 10 | noise |
| basePoolShare | 0 / -60 | 8 / 1 | +100 / -33 | +25 / +1 | 0 / 0 | clear |
| keepMinis | +20 / 0 | 8 / 5 | 0 / 0 | 0 / 0 | 7 / 10 | noise |
| holdMargin | 0 / +10 | 6 / 6 | 0 / 0 | 0 / 0 | 5 / 5 | noise |
| upgradeMargin | +20 / -20 | 8 / 4 | 0 / 0 | 0 / 0 | 1 / 2 | suggestive |
| releaseLead | 0 / -10 | 7 / 6 | 0 / 0 | 0 / 0 | 0 / 1 | noise |
| releaseRefresh | -10 / 0 | 4 / 6 | 0 / 0 | 0 / 0 | 2 / 2 | noise |
| releaseCheaper | -10 / -20 | 7 / 4 | 0 / 0 | 0 / 0 | 5 / 5 | noise (both -) |
| releaseEvery | -10 / +20 | 5 / 9 | 0 / 0 | 0 / 0 | 0 / 0 | noise |
| miniMinDays | -20 / -30 | 5 / 4 | 0 / 0 | 0 / 0 | 1 / 1 | noise (both -) |
| trustOversight | 0 / -20 | 5 / 4 | 0 / 0 | 0 / 0 | 6 / 1 | noise |
| trustSabMax | -10 / -10 | 4 / 4 | 0 / 0 | 0 / 0 | 4 / 6 | noise (both -) |
| trustStep | -10 / -10 | 4 / 4 | 0 / 0 | 0 / 0 | 5 / 6 | noise (both -) |

Not in the table: safetyShareFloor, monitorShareCap, postPoolShare, enterpriseMargin, keepFull, footholdCaseFte (identical to base in both directions).

Direction of the clear effects: baseDays-down and basePoolShare-down delay SC (78 and 100 days) but raise the seeds reaching ASI (5 -> 10 and 5 -> 8): fewer, longer base runs, then a faster path to ASI. basePoolShare-up and baseEvery-up go the other way and lose most games (1/10 each). baseEvery-down delays SC 16 days with no win change. postEvery-up moves SAR 15 days earlier and reaches ASI on 8 seeds; postEvery-down is the reverse (SAR +37, 3 seeds). I did not check the mechanisms.

## Possibly inert

14 sets are identical to base on every recorded field of every seed: safetyShareFloor-down/up, monitorShareCap-down/up, rlSaturation-up, postPoolShare-down/up, enterpriseMargin-down/up, keepFull-down/up, keepMinis-up, footholdCaseFte-down/up. The code does read all of these (ref.ts lines 167, 226, 376, 423, 513, 534, 732), so the override probably applied and the limit never bound here (keepFull both ways and keepMinis-up inert suggests the bot never holds more than 3 full / 2 mini versions). Not checked in a game. Near-inert: retryDays-down/up (7 seeds identical, 0 ending changes). Identical on 4-6 seeds with at most 2 ending changes: monitorCost, trustSabMax, trustStep, safetyAgentsTolerance-down, trustOversight-down, holdMargin.

## Noise: what 10 seeds can and cannot tell us

- The seed does most of the work. Across the 79 cells seeds 1, 2, 8 and 9 win in 23-37% of cells and seeds 2027, 3, 4, 5, 6, 7 win in 82-94%. A setting can only change the few seeds near the edge.
- Empirical noise floor: the 55 non-inert settings average 6.3 wins (sd 1.7) and ASI on 5.5 seeds (sd 1.8). A change of 1-2 wins or ASI seeds is not evidence. Base sits above that average, so paired win differences are biased about -7pp (many "-10pp" results are base being lucky).
- Smallest possible exact sign-test p on 10 pairs is 0.002, so a Bonferroni correction over 78 sets (0.0006) is out of reach. I ran 312 tests (win, SC, SAR, ASI reached per set). 8 reached p <= 0.01 and 15 reached p < 0.05; chance alone would give about 3 and 13 among the 256 non-inert tests (a little fewer, since the test is discrete). So up to a third of the "clear" flags could be false hits. The seven clear sets: baseEvery-up, baseDays-down, basePoolShare-down, basePoolShare-up (SC or SAR shifts on all 10 seeds), research-P11 (SC +5 d, trivial in size), research-P16 (SAR -16 d), research-P22 (ASI seeds 5 -> 9).
- Bootstrap intervals on 10 pairs are too narrow when only 1-3 seeds differ (student-down: interval excludes 0, exact p = 0.125). Trust the exact p.
- The ASI day shift rests on 3-5 seeds (only seeds where both runs reach ASI), and P(misalignment) at ASI is bimodal (about 0.005 or 0.99 by seed), so its median difference is not informative; no set shows a reliable change in it.
- One seed is 10pp of win rate. This scan cannot see win-rate effects smaller than about 30-40pp.

## Recommendation for the full scan (20 seeds x 2 worlds)

**Include (priority):**
1. Base-model schedule: `baseEvery`, `baseDays`, `basePoolShare`. Use 3-5 values each, not just x0.5 / x1.5: effects are large, the direction differs between SC and ASI, and they probably interact (refbot-a.md notes basePoolShare is coupled to baseDays).
2. Research list: `research-rivals-all`, P24, P16, P22, P09, P11 (with rl.math), the unrun P18+P21+P10 set, and a P24+P16+P09 combination. These are the only route to a faster RefBot found here.
3. `postEvery` (both), `splitCadence-up`, `upgradeMargin` (both), `releaseEvery-up`.
4. Coin-flip candidates that 20 seeds will settle: `student-down` (-40pp, 4 lost 0 gained), `ideaTeams` (both directions +10pp, ASI on 8 seeds), `keepMinis-down`, `miniMinDays` (both -20 to -30pp), `hiringLead-down`, `rlSaturation-down`.
5. Low priority, one pair each as controls: `alignShare2025/2026`, `safetySciTeams`, `monitorSpend`, `monitorTolerance`. No timing or win effect here, but they are the alignment levers (and the first two are sourced); the second world may show a P(misalignment) effect this leader start cannot.

**Drop (clearly irrelevant: no seed changed, or no ending change and no timing effect):** safetyShareFloor, monitorShareCap, postPoolShare, enterpriseMargin, keepFull, footholdCaseFte, keepMinis-up, rlSaturation-up, retryDays (all three), trustStep, trustSabMax, trustOversight-down, monitorCost, holdMargin, safetyAgentsTolerance. That is 28 of the 78 sets; the full scan falls from 2800 games (70 cells x 40) to about 2040 (51 cells x 40), or the same budget covers finer grids on the schedule fields and research combinations.

**Not covered by this scan** (listed in refbot-a.md): gateOom, askShares, postsInFlight, REF_LINES (team counts per line), researchGate, the follower-start fields. Given the research result, REF_LINES and researchGate are the next fields to make overridable.
