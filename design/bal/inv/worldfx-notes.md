# worldfx inventory notes

Registry file: `balance/params/worldfx.ts` (`PARAMS_WORLDFX`, 80 entries: 31 exported-symbol entries, 49 inline, of which 11 are non-exported named constants and 38 are notable inline literals).
Chunk files: `src/engine/v2/worldfx/*` (18 files). Sector data tables in `src/data/v2/sectors.ts` are in `market.ts` and not repeated.

## Questions

| id | question | evidence |
|---|---|---|
| Q-worldfx-1 | `HYPE.rev` / `HYPE.level` carry both `[D]` and fit tags. Designer values, or fitted to the "+30% in 2026" Dow target (T `W.equity2026`)? Registered `unclear`. | macro.ts:28-29 "Hype index weights ... [D, fit]"; macro.ts:173 "[D, fitted to \"+30% in 2026\"]". No fit script named. |
| Q-worldfx-2 | `ACCEPT.base/gain/spread/rate` are tagged "[D, fit §7.3]". Is "fit §7.3" a fit (to what, with which script) or a pointer to V2-SPEC §7.3? Only `mid` is explicitly refit (G1, target `W.govAccept85`); registered `fitted`, the other four `unclear`. | control.ts:21-30; design/notes/G1.md |
| Q-worldfx-3 | `ROBOT.sezRampYears` is 1.5 but the [A27] source text it sits under says the ramp reaches 1M/month "within about a year" (`sezRampPerYear` 10.8e6 is the one-year-ramp rate). Intended? | robots.ts:9 vs :26-27 |
| Q-worldfx-4 | The same real-world numbers are written in several places with no shared constant: regional baseline growth (G_BASE 0.018/0.04/0.028 vs sectors.ts:381 `gAI` inline; start-state macro growth 0.02/0.045/0.028 at sectors.ts:217), start GDP (GDP0 vs sectors.ts:217 `macro(30000, ...)`), Dow 44000 (DOW0 vs sectors.ts:218). A rebalancer that moves one will desync the others. Register as one linked parameter, or refactor to one constant? | macro.ts:23,27,28; sectors.ts:217-218, 381 |
| Q-worldfx-5 | `HEADLINES` effects (`ctx.bump` amounts, `incidentR` +0.1, thresholds in `when` closures) are balance-relevant inline numbers inside a record array; no export path reaches them, and they are too many for the inline cap. Is a registry entry wanted (and how: whole-table skip as now, or a refactor of `effect`/`when` numbers into data)? | headlines.ts:32-100 |
| Q-worldfx-6 | `FRIEND_SOCIAL_MID` is tagged `[D]` but the comment says it was moved 7 to 6.5 "on integrated RefBot play". Designer (as tagged) or fitted to bot play? Registered `designer`. | sectors.ts:82-85 |
| Q-worldfx-7 | All entries are `layer: 'world'`. The control penetration targets and `ACCEPT` describe how officials and firms adopt AI (arguably the `gov` actor's behaviour, hence `policy`), and mix.ts China access and the action previews similarly. Confirm `world` (they change what happens, not what an actor of the game chooses). No `actor` was set on the control entries. | control.ts:20-30, 185-193 |

## Skipped

| coverage line | reason |
|---|---|
| actions.ts:17 transitionFund | ActionDef; its effect numbers are registered inline (wfx.actions.transitionFund*) |
| actions.ts:91 moonshot | ActionDef; risk exposure registered inline (wfx.actions.moonshotRiskScrutiny); share cap/default in overflow |
| choice.ts:65 S | scratch buffer sizes |
| choice.ts:73 MAX_PARTIAL | enumeration loop guard |
| headlines.ts:32 HEADLINES | headline records; numbers in closures (Q-worldfx-5) |
| macro.ts:195 macroSystem | EngineSystem registration (order, cadence ids) |
| marketView.ts:32 SELLS_NOTHING | UI card threshold |
| marketView.ts:310 ZERO | zero-valued default record |
| mix.ts:78 BUYER_RUNG | structural ladder (channel to rung index), design of MK-5 not a tunable |
| policy.ts:9 POLICY_FLAGS | flag key strings (ids) |
| revenue.ts:1114 revenueSystem | EngineSystem registration |
| sectors.ts:329 worldDailySystem | EngineSystem registration |

Registered coverage lines: 24 of 36. `revenue.ts`, `use.ts`, `choice.ts`, `productBoard.ts`, `marketView.ts`, `sectorView.ts` hold almost no balance constants of their own: their numbers come from `data/v2/*` (ECON, SEATS, COVER, ASSIST, CUSTOMER_TAU, ...), registered by other chunks.

## Inline overflow

Notable literals beyond the 40-inline cap (the 38 used are in the registry):
- macro.ts:35-36 `dcPowerShare`: 60% of AI compute in the US, PUE 1.3, 1,340 GW US capacity (comment-stated, untagged)
- macro.ts:131 `Math.max(-0.02, gCapex)` capex growth floor
- macro.ts:140 SEZ starts at `0.005 * gdp`; :142 explosive SEZ cap 50/yr
- macro.ts:149 growth smoothing `/ 3` (3 months)
- macro.ts:160 Gini: CN 0.47, ROW 0.6, `0.6 * (LS0 - laborShare)`, `0.3 * (U - U_BASE)`, `0.5 * transfers`
- macro.ts:151 `M.energyPrice`: slope 2, threshold 0.015 of US power share
- macro.ts:169-171 `aiOwnerShare` weights 0.4 / 0.5 / 0.8; government revenue 0.18·GDP; curse 0.21·0.4, 0.3, threshold 0.5
- macro.ts:176 fear smoothing 0.4; :179 PE fear weight 0.8 and base 20 [R16 §4.5]; :180 earnings = 0.25·profit share + 0.3·AI revenue (`Y * (1 - US.laborShare) * 0.25 + 0.3 * aiRev`)
- macro.ts:187 youth unemployment anxiety +3 per pp
- macro.ts:94-102 `fearTarget`: 0.15 per public incident, 0.3 Taiwan, 0.4 bust, 0.04 per rung
- control.ts:189-192 other target terms: GOV +0.05/+0.01·briefing/+0.05, MIL +0.03/+0.15/0.35 vs 0.1, INFRA 0.5·ENGY + 0.25·SOFT + 0.2·CYBER
- control.ts:216 tier-adoption terms 0.25·pressure, +0.2 arms race, 0.2·REASON gate, -0.03; control.ts:219 persuasion weight 0.2 and Accept ceiling 0.98
- control.ts:82 persuasion W23 ramp 0.5
- control.ts:56-62 `initialControl` start P and tier mix (0.05/0.02/0.01/0.03; [0.75, 0.25, 0, 0]; accept 0.3)
- sectors.ts:106-110 policy frictions: licensing +0.1, AV ban +0.3, school ban +0.3, arms race -0.3; :263/:268 W decay 0.5; :312 open-jobs 0.6 and 5·nuEff·gAI; :308 mismatch 0.5
- sectors.ts:229 Retrain cap 0.5 and jobTraining +0.2; :343 incident friction +0.05, cap 0.5; :354 youth unemployment `30 * yu`; :382 friend share companion-ban 0.4; :383 friend rate 3/yr
- techtree.ts:41 ExpCap 0.3 weights; :125-126 defence reductions 0.5 (W06) and 0.3 (W24); :148/:157 approval 0.3/0.5 x benefit; :99 health lag compression 0.5·W05
- robots.ts:39 China/ROW robot share 0.55/0.45; :101 humanoid US share 0.15; :105 US share cap 0.95; :85 W17 halving 1.5 y, floor 2 weeks (2/52) before 2035, 0.04 y with W18
- mix.ts:314 China-lab access: other labs' models in China 0.6 open, 0.05 closed
- mix.ts:1354 `initPrices` iterations 8, damping 0.6 (solver)
- actions.ts:33-42 / :62-67 fund approval cap 5, trust cap 8/-12, jobAnxiety 0.5 x d cap 6, cut approval floor -5; :104 moonshot default share 0.03 and cap 0.3 (duplicated at :147); :113 revenue loss util floor 0.3; :129 China tension 3 at 0.3
- use.ts:24 base-use cap 0.95
- productBoard.ts / marketView.ts / productView.ts: card-direction thresholds 0.02, 0.005, 1.05 (UI)

Other notes
- `registry:lint -- --area worldfx` is 0 errors. `npm run typecheck` currently fails only on `balance/params/safety-engine.ts(77,1): error TS1005: ']' expected` (another agent's file in progress), not in worldfx.ts.
- Evidence line numbers were read from the `bal` worktree at the time of writing.
