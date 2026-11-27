# Core inventory notes (B3, chunk `core`)

Registry file: `balance/params/core.ts` (`PARAMS_CORE`, 160 entries). Files: `src/engine/v2/{core,departments,endings,events,bots}/*`.
All `bots/*` entries are `area: 'bots'`, `layer: 'policy'`, `actor: 'player'` (88 entries; the bot policy settings list). Non-numeric choices (research lists, product lists, line plans) are string values on inline refs, because the lint compares an export's `value` with its live value and a `TreeGoal[]` or `LinePlan[]` cannot be compared.

## Questions

| id | question | evidence |
|---|---|---|
| Q-core-1 | Do the mixed and race bot headers or their constants describe the intended policy? Header says three safety research-engineering teams, the constant `MIXED_RE_TEAMS` is 5; header says a second team on AG08, AG18, AG02 only, `mixedLines` gives teams: 2 to all six lines (the lottery line and AG09, AG07 too); race header says "×3 bases", `RACE_PLAY.base.days` is 150 against RefBot's 121. Registered as the code has them, `untagged`. | mixed.ts:3 vs :18; mixed.ts:19-25 comment vs code; race.ts:3 vs :14 |
| Q-core-2 | `SAFE_AUTOPILOT`: the comment says it "plans 75% of" the reference build-out and "stops new capex below 5 quarters of runway [D, M4]", but the object has `mult: 0.5` and `guardQ: 6` (`bridgeFloorQ: 5`). Which is current? Registered as `designer` per the tag, with the mismatch in `notes`. | safe.ts:35-38 |
| Q-core-3 | `KW_PER_H` (0.93 kW per H100e): the one `[D]` closes a sentence covering both it and `SITE_HEADROOM` ("kW per H100e at the start (compute/power.ts initialPower) and site headroom for the owned fleet [D]"). `KW_PER_H` is also a copy of the power module's value. Registered `unclear`; `SITE_HEADROOM` as `designer`. | starts.ts:15-16 |
| Q-core-4 | `UPKEEP` product and monitor loads carry `[D] (J2 P1)` but the comment also says "J2 tuned it to v2's build capacity" and "Model v3 V3: ... upkeep × 0.4". Is it a designer value or fitted to a named target? Registered `designer`; no script or target named. | build.ts:66-71 |
| Q-core-5 | The end-screen score tables (`SURVIVAL_BASE`, `FREEDOM_BASE`, `FREEDOM_NONE`, `PROSPERITY_BASE`, `PROSPERITY_POWER`) and all term weights have no provenance at all, yet `verdictOf` feeds bot win rates (the start difficulty labels in `data/v2/starts.ts` are set from them). Should they be treated as designer judgement and tagged? All registered `untagged`. | scoring.ts:11-25, 126-130; starts.ts:20-23 (via market chunk Q-market-8) |
| Q-core-6 | Several bot constants state their value in the comment as derived from v2 runs (`REF_BASE_DAYS` = 91 × 0.8 / 0.6 = 121; `GATE_OOM` = v2 level conversion). I registered both as `derived`, but they are literals in code, not computed. Confirm that `derived` (not `untagged`) is the intended reading. | ref.ts:63-66, 101-104 |

## Skipped

Every `balance/coverage.txt` line in the chunk's files that is not registered:

| coverage line | reason |
|---|---|
| bots/common.ts:29 BOT_INTENTS | action-id mapping (pure ids), not a number |
| core/causes.ts:9 CAUSE_RING | ledger size cap (entries per key), memory budget |
| core/causes.ts:90 DAILY_KEYS | UI-only ledger aggregation cap |
| core/certainty.ts:15 UNKNOWN_RANGE_PTS | display-only (file header: no engine number depends on it) |
| core/certainty.ts:17 CHANCE_WIDTH_PTS | display-only certainty words |
| core/certainty.ts:18 SIZE_REL_WIDTH | display-only certainty words |
| core/clock.ts:9 clockSystem | system object; its literals are registered separately (Y10_*, sofrSpread) |
| core/hubView.ts:167 LIKELY_Z | display z for a 90% range |
| core/record.ts:98 LOG_CAP | log length cap, UI/history |
| core/record.ts:99 HEADLINE_CAP | headline list cap, UI/history |
| core/record.ts:101 recordSystem | system object, sampling only |
| core/registry.ts:56 SYSTEMS | system list (ids and orders) |
| core/save.ts:13 SCHEMA_REV | save format version |
| core/save.ts:15 MIN_SCHEMA_REV | save format version |
| core/save.ts:19 SLOT_KEYS | save slot ids |
| core/save.ts:22 SAVE_BUDGET_BYTES | save size budget |
| core/time.ts:6 DAY_MS | unit conversion |
| departments/agentActions.ts:255 AGENTS_SET | action definition, no tunable number |
| departments/agentActions.ts:309 AGENTS_TRUSTED | action definition (clamp 0..1 and 0.2 step are UI) |
| departments/agentActions.ts:340 MONITOR_BUDGET_STEP | UI slider step |
| departments/agentActions.ts:358 AGENTS_MONITOR_BUDGET | action definition |
| departments/agentActions.ts:410 TOOLING_BUILD | action definition |
| departments/autoSplit.ts:54 autoSplitSystem | system object, no literals beyond AUTO_SPLIT_MIN (registered) |
| departments/build.ts:268 buildSystem | system object |
| departments/build.ts:321 BUILD_ACTIONS | action definitions |
| departments/teamActions.ts:147 TEAM_ACTIONS | action definitions |
| departments/teams.ts:284 hiringSystem | system object; attrition and morale literals registered inline |
| endings/endings.ts:73 endingsSystem | system object; its probabilities and day counts registered inline |
| endings/replay.ts:9 METRICS | end-screen replay weights (scales for impact ranking, display only) |
| events/director.ts:74 directorSystem | system object; BASE_FIRE_P, MAX_PENDING, STORYTELLERS registered |

Registered through inline anchors on the declaration (so they are covered, not skipped): `LOTTERY`, `MIXED_SCI_TEAMS`, `MIXED_RE_TEAMS`, `MIXED_PLAY`, `mixedBot`, `RACE_PLAY`, `raceBot`, `SAFE_LINES`, `SAFE_FLAG_EST`, `SAFE_PLAY`, `SAFE_AUTOPILOT`, `safeBot`, `capex2xBot`, `BOT_IDEAS`, `LEADER_CAP_STAFF`, the non-exported ref.ts constants, the clock and starts constants, and the five scoring tables.

## Inline overflow

Beyond the 40-entry cap for the non-bot files (37 inline literals used) or not worth an entry:

- bots/ref.ts:397 `?? -120` default for the last base day when no base exists
- bots/ref.ts: weekly and monthly day offsets (`day % 7 !== 3` safety agents, `!== 5` monitors, `!== 4` footholds, `day % 30 !== 20` trusted, `day % 30 === 15` housekeeping)
- bots/ref.ts:507 `cheapIds.slice(-4)` cheap-tier ids kept
- bots/ref.ts:196 `Math.max(1e-3, ...)` floor on the safety-agent compute want
- bots/ref.ts: follower roster grows one team per role a month (`cur + 1`, ref.ts:361)
- bots/safe.ts:77 `fund >= 1` and `finance.state !== 'distress'` transition-fund gates; safe.ts:74 `siloing < 1`
- bots/mixed.ts:77, 82 enterprise and action cadences (30, 15 days; offsets 7, 3); mixed.ts:92 `cash > 10`, the 0.5 trigger margin
- departments/teams.ts:99 `0.55` quality norm in playerH (teams.ts comment 98); teams.ts:337 layoff morale `Math.min(15, pct)`; teams.ts:107 star taste 0.05 per star, cap 1.5
- departments/workfit.ts:187 `Math.exp(-0.5 * s * s + sdAI * s)` (formula structure); workfit.ts:84 `0.9 - v` coverage pivot
- core/init.ts:320 `sharedTechniquePool: 0.1` and `g0 - 1.2` for `openWeightsG`; init.ts:177 V0 `monitorability: 0.9`; init.ts:172 belief `sd: 0.2`; init.ts:106-107 start run `poolShare: 0.5`, `etaDays: 7`, `start = -3`
- core/starts.ts:75 revolver `maturityDay: 365 * 5`, `runwayQ: 8`, ratings `'BBB'`/`'BB'`/`'B'`; starts.ts: two parent campuses (`n = parent ? 2 : 1`), `buildQ: parent ? 8 : 2`, lease and cloud end dates
- endings/epilogue.ts:21 `pMisOf` sigmoid width 0.06 (recorded only; nothing rolls it); epilogue.ts:35 `otherContain` 0.2; epilogue.ts:74 `< 90` days for "near" rivals; epilogue.ts:81-82 trust `< 40`, `keptShare >= 0.8`, `controlShare < 0.5`
- endings/scoring.ts:82 transition fund `>= 20` threshold for the UBI term
- events/director.ts: `0.5 * dir.tension + 0.25 * pending` tension decay; request expiry `day - r.day <= 60`; chaotic noise `normal(0, 0.3)` clamped 0.4-1.6 (described in `core.STORYTELLERS.mult`)
- events/catalog/*: effect deltas inside choice `preview` and `apply` functions (morale, talent, scrutiny, cash, trust, and so on), by event; `defaultChoice` indices and `crisis` flags. Only `deadlineDays` and `cooldown` are registered as field families.
