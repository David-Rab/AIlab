# N4 result: what NPC labs sell

Task N4 of NPC-TASKS.md, branch `npc-n4` (off `npc`). Spec: NPC-LABS.md §6. Moves calibration: yes. No save-shape change.

## What changed

- **New `src/engine/v2/npc/market.ts`**: lineup (the existing distillation rule, moved unchanged from actors/rivalModel.ts:
  `distillStudents`, `seedRivalLineup`, `rivalLineupStep`, `RIVAL_DISTILL_LAG_DAYS`, `RIVAL_LINEUP_MAX`), serving, domains, tools.
  `rivalToolStep` is replaced (same name); the old history-plus-`TOOL_LAG_DAYS` path is gone for NPCs. `toolNewInGame` and
  `recordToolShips` stay in rivalModel.ts (they read the player's side; productView.ts still shows a "day the others get it" from
  TOOL_LAG_DAYS, now stale: N12/UI).
- `npc/lab.ts`: `setNpcModel` takes the kind and passes its domain offsets; `npcPhys` sets serving. `actors/rivals.ts`: import line only.
  `initRivalPhys` (dead, N12) no longer seeds a lineup. `data/v2/tools.ts`: new optional field `npcHorizonMin`.

## The rules (all [D] unless sourced)

1. **Lineup**: as before. Students of each release at the lineup sizes, on sale 5 months later; the previous public model stays on
   sale as a tier; tiers dominated on G and FLOP per token leave; at most 6.
2. **Serving**: one value for all labs, `npcServeOom(day) = SERVE_RATE0 (0.2 OOM/yr) × day / 365.25`. Both the rivals' and the
   player's serving stacks start at exactly 0 (`initialStacks`), so there is no non-zero start value to copy; 0.2/yr is the rate
   today's rivals' own research moved it at (research share 1). At day 0 it is 0 (as the player's), 0.49 OOM at day 900. Serving
   FLOP per token from model size as before (`rivalServeFpt`).
3. **Domains**: public (and internal) model domain levels = its G + `FOCUS_OFFSET_OOM (1.0) × Σ_sector weight × sector's task share in
   the domain` per domain (the sector task mix of data/v2/sectors.ts). The offsets sum to 1 OOM across the nine domains; a kind
   focused on software gets about +0.3 on CODE. One rule, one constant.
4. **Tools**: at the start, the cast's tools. After that a tool ships when (a) h50Of(public model) ≥ `npcHorizonMin` (coding 60,
   computerUse 20, research 11, agentMode `AGENT_TASK_HOURS × 60` = 120; the others none), (b) the tool is in the kind's focus
   (focus weight ≥ 0.3: Σ sector weights over the tool's sectors, or for a sector-less tool Σ channel weights over its products),
   (c) after `npcBuildDays = 7 × buildTW / 1 team-week a week` (one 150-head engineering team; coding 12 TW = 84 days). The day
   all of (a) and (b) first hold is kept in `state.flags['npcTool:<lab>:<tool>']` (no new state shape).
5. **Prices**: unchanged (the seller rule in mix.ts).

## Checks (scripts/v2/npcMarket.ts; npcLabs.ts still passes)

- Coding: with the public model's G set just below / above the 60 min crossing (h50 55.8 -> 64.5 min), no lab has it below; the four
  labs with coding in focus gain it on exactly crossing day + 84; Wolderfield (focus MEDIA/SOFT .2/OFFICE/EDU/SERV: weight 0.2) never does.
- Requirements live on the tool data; domain offsets equal the kind's focus; serving non-zero; every release puts the new model's
  students into distillation; every lab ends with 5-6 tiers.

## Reported, not targeted: share of total AI revenue (tl-central, challenger start, 900-day run, bot-free)

Share = lab `finance.revenueRun` over the sum of all labs and the player's.

| lab | day 180 | day 540 |
|---|---|---|
| Marenth (leader kind) | 48.7% ($12.8B) | 64.7% ($26.9B) |
| Lanternworks (safety) | 10.6% | 4.2% |
| Tarnwick (bigtech) | 23.7% | 14.9% |
| Zorvane (racer) | 2.7% | 3.1% |
| Wolderfield (open weights) | 1.6% | 0.7% |
| Pellory (upstart) | 5.6% | 9.0% |
| Xuanmu Lab (China) | 3.8% | 2.4% |
| player (idle, no actions) | 3.3% ($0.9B) | 1.0% ($0.4B) |
| total | $26.4B/yr | $41.5B/yr |

## Things to know (for calibration)

- **Tool dump in the first 110 days**: with "none" requirements and 84-day builds, every in-focus tool a cast lab lacked ships in
  the first ~4 months (Companion day 29, Agent mode 57, Back-office / Memory / Voice day 85 ...). That is the rule applied to a
  cast whose start tools are what the lab had public; if it moves the market too early, the lever is a build-start gate or the
  start tool list, not this rule.
- Pellory (upstart, no public model at the start) gets tools only after its first release (day 86): research and Agent mode day
  142 (its public model is the leader's G a lag behind).
- The leader kind holds most of the revenue and rises; Pellory rises at the cost of Lanternworks and Tarnwick. Not fitted.
- productView.ts's "day the others get a new tool" (TOOL_LAG_DAYS) is now stale for NPCs.
- New constants for the registry: FOCUS_OFFSET_OOM 1, TOOL_FOCUS_MIN 0.3, NPC_BUILD_TW_PER_WEEK 1, `npcHorizonMin` per tool.
