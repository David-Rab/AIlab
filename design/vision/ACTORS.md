# Actors: inventory, cleanup, gap to the vision

Scope: every non-player actor in `src/engine/v2` and `src/data/actors.ts` at master cd352aa. "Verified" means read in the code. "Judgement" is marked.

## 1. Inventory

| Actor | State | Decision rule | Does to world/player | Player can do to it | Presets |
|---|---|---|---|---|---|
| US rival labs (`actors/rivals.ts`, `rivalModel.ts`, `finance/rivalFinance.ts`) | Lab core, base/recipe/models, posture (hidden), 4 meters, simple finance | One fixed reference policy per day: reference split, staff growth, training (`rivals.ts:293-299`); base every 9-15 mo, post every 6-10 wk, release lag by archetype (`rivals.ts:56-58`) | Capability race, open weights, incidents, ASI/overtaken endings, merger offer E32 | C3 joint evals, C4 poach, E16 suit, acquire, recipe leaks | Archetype table (`actors.ts:47-56`) + posture table (`postures.ts:5-15`) |
| Leader lab (`rivals.ts:129-166`) | As rivals, compute pinned to the reference path | Same, at reference inputs | Sets the AI 2027 pace on non-leader starts | As rivals | Fixed `leader` row |
| China / DeepCent (`actors/china.ts`, `security/theft.ts`) | 16 meters, posture rung 0-6, de-escalation 0-5, preset weights; DeepCent runs `labDaily` | Meters drift to formula targets; ladders with 14/60/30-day holds (`china.ts:167-221`); quarterly preset re-weighting (`china.ts:233-259`) | Distillation, theft (player and rivals, `theft.ts:88,116`), Taiwan shock, war ending, treaty | C1, C2, E1-E3, security spend, KYC | 6 presets, blended (`china.ts:83-93`) |
| US government (`actors/gov.ts`) | 8 meters, G-SEC 0-5, G-CHN 0-4, statutes, policy flags | Sees only claims/leaks/evals/briefings (`gov.ts:47-54`); ladders with holds; monthly suits, licensing, vetoes, 14 policy flags (`gov.ts:257-349`) | E12/E20/E22 decisions, nationalisation, export policy, UBI, SEZs, bans | B1-B7, briefing level, trust | 5 presets |
| Public (`actors/public.ts`) | 10 meters, activism rung 0-5 | Drift to targets; ladder (`public.ts:57-78`) | Feeds gov, blocs, approval | Indirect only (community benefits, disclosures) | 5 presets |
| Interest blocs (`actors/blocs.ts`) | clout, mobilization, approval per bloc | Mobilization floor fed by public meters (`blocs.ts:44-62`) | Policy pressure on gov (`blocs.ts:32-41`) | Indirect | None (data table) |
| Research bodies (`actors/researchBodies.ts`) | evalGov, evalIndep queues; academia | Weekly: test the player's versions within capacity (`researchBodies.ts:32-73`) | Eval reports, E29, credibility, Safety Index (`actors/index.ts`) | A1, A2, D1, D2 | None |
| Capital markets (`finance/investors.ts`, `story.ts`) | Investor pool, hype, bubble | Story-based valuation | Raises, marks, rival exits | Rounds, promises | Not in actor presets |
| Chip market (`compute/market.ts`) | Supply, prices, export policy, Taiwan/Korea shocks | Clearing + hazards | Prices, rationing | Orders | Baseline only |
| The model (`safety/covert.ts`, `footholds.ts`, `control.ts`) | Hidden traits, footholds, escaped copies | No choices: attempts = κ·D·C·O (`covert.ts:7`); copy growth by formula (`control.ts` header) | Sabotage, steering, backdoors, hidden compute, escape, rogue ending | Whole safety system | Hidden world draws |

Asymmetries (verified):
- Rivals make no choices. They cannot raise prices, pick products, change safety, or respond to the player except through race pressure.
- Gov watches only the player. Seen level, claims, thefts and briefings are the player's (`gov.ts:36-66,113-117`). A rival reaching SC does not move gov.
- Public concern ratchets +1 per player milestone only (`public.ts:34-36`).
- China's ladder and re-weighting read the player's own evaluation flags `seenMilestone1/2` (`china.ts:166,172,240,273`, set in `models/capability.ts:428`). Gov is never allowed to see truth, but China sees the player's private evals. Judgement: inconsistent, and player-centric.
- Covert acts and footholds exist only for the player's lab (`footholds.ts:33`). Rivals get trait steps and an incident hazard (`rivals.ts:396-417`).
- No allies (EU, UK, Gulf) as actors. The EU code is a player toggle (`actions.ts:256`); the Gulf is only a theft modifier (`theft.ts:24-28`).

## 2. Cleanup list (all verified by grep)

Dead or unread parameters and meters:

| Item | Where | Status |
|---|---|---|
| Gov `transactional`, `pollSensitivity` | `actors.ts:5` | Never read |
| Public `shock`, `benefit` | `actors.ts:17` | Never read |
| China `openSource` | `actors.ts:29`, summed at `china.ts:84` | Never used |
| China `efficiency` | `actors.ts:35-40` | All 1; still threaded through `china.ts:78,108`, `production.ts:252` |
| Lab `safety` | `actors.ts:45` | Never read; staff use posture (`rivals.ts:90-92`) |
| Lab `computeMult`, `gapYears` on `leader` | `actors.ts:53-55` | Declared unused |
| `scale` posture | `postures.ts:7` | No archetype |
| China meters `computeShare`, `stateSteering`, `econLeverage`, `intelCapability` | `china.ts:38-40` | Init only |
| China `domesticFab` | bumped `china.ts:284` | Never read |
| China `hawkDove` | `china.ts:161` | Overwritten daily, so B2's +5 (`actions.ts:191`) is lost next day; read only by the glossary, which promises it "rises with US labs' defense work" |
| China `normsDiplomacy` | starts 65 (`china.ts:40`), gate is >50 (`china.ts:205`), no drift | D1 hinges on the talks flag alone unless the player lowers it |
| Rival `lobbyStance`, `cooperation` | `rivals.ts:112`; written `actions.ts:308,330,355`, `models/actions.ts:449` | Never read |
| Rival `poachAggression` | read once, `events/catalog/company.ts:25` (>60) | Only upstart (70) qualifies at start; maverick's 60 fails the strict test |
| `rival:*` trust | written `actions.ts:331,357`, `company.ts:50` | No reader found; access cannot climb (no `accessCap`, `relations.ts:55`) |
| `bloc:*` trust | `blocs.ts:59-60` | Overwritten daily from approval, so any trust change is lost |
| Academia `pipeline`, `publishLagDays` | `researchBodies.ts:12` | Never read; "publish what they learn" (`:71`) not built |

Misplaced or inconsistent:
- Public ladder hold counter is stored in `s.gov.holdDays` (`public.ts:73`).
- Copyright suits and rival finance run inside China's `geoQ` system (`china.ts:314-325`).
- `actors/index.ts` is the Safety Index, not a barrel module.
- The veto rule is written twice (`gov.ts:221`, `gov.ts:265`). Preset ids are hard-coded in rules (`gov.ts:221,265`, `china.ts:209`, `rivals.ts:112,380`), not parameters.
- The years-since-2025 formula is written two ways: `day/365+0.5` (`gov.ts:196`) and `decimalYear-2025` (`security.ts:63`).
- China preset blending dilutes extremes. Judgement, from my own calculation: at start a drawn Gambler blends to taiwan ≈ 1.53, so its rung-5 shortcut `pp.taiwan >= 1.9` (`china.ts:173`) cannot fire until re-weighting concentrates it.

Preset descriptions vs engine:

| Preset | Promise | Engine |
|---|---|---|
| Dealmaker | "Trades policy for deals" | `transactional` unread; no deal mechanic |
| Populist | "Follows the polls. Turns on Big Tech when approval falls" | `pollSensitivity` unread; gov never reads `pub.approval`; only the veto lifts at concern >70 |
| Absentee | "Reacts late, then overreacts" | Late: yes (lag 45, `gov.ts:143`). Overreaction: none |
| Anxious Majority | "Concern ratchets up with each incident" | Ratchet is per player milestone, same for every preset; `shock` unread |
| Tech Optimist | "Benefits dominate" | `benefit` unread; only fast decay |
| Distracted | "Moves only on huge events" | No threshold; just smaller multipliers |
| Fast Follower | "at a fraction of the cost" | No China cost model; efficiency 1 |
| Open-Source Diffuser | "Wins the Global South, pushes norms at the UN" | `openSource` unread; no Global South |
| Self-Reliance | "avoids military risk until chip parity" | Chip self-sufficiency drifts the same for every preset (`china.ts:154`); no parity gate |
| Safety Rival | "lobbies for regulation" | `lobbyStance` unread |

## 3. Gap to the vision

**A common actor model.** Each actor needs four parts: state (meters plus owned things), observations (what it may see), an action set (named, with costs and previews, like the player's verbs), and a policy (a function from observations to actions). Today policy and physics share one daily function. For example, `govDaily` mixes statute dates, courts and elections (physics) with ladder climbs (choices). Judgement: the ladders are already the right shape. Each rung is a discrete action with a precondition, so it can become a player button without changing the NPC.

| Actor | What exists | Missing for player control |
|---|---|---|
| Rival / other company kinds | Same physics as the player; start types already let the player be leader, spinout, challenger or big tech | Rivals need a small real policy: product and price, safety budget, raise or merge. Non-lab company kinds (chip maker, cloud, app company) have no model at all |
| China | Meters, two ladders, DeepCent lab, theft and distillation | Rungs as actions with costs; a state budget (fabs, smuggling, intelligence); domestic economy and public; an observation model (today it reads player truth flags) |
| US government | Ladders, statutes, policy flags, belief-only view | Rungs and flags as actions; a budget and political capital (the dead `pollSensitivity` and `transactional` fit here); it must watch every lab, not only the player |
| The model (rogue mode) | Covert acts (SAFSAB, STEER, SUCCSTEER, BACKDOOR, HIDCOMP), five foothold kinds, exposure and control, escape, hunt, copy growth (`control.ts`) | The attempt rate is set by traits; a rogue player would choose acts and targets instead. Needed: an NPC lab that runs the oversight (today only the player has a safety department), a world map for escaped copies (compute, money, people), and play after escape (today `rogueCopy` ends the game, `endings.ts:106`) |
| Public, blocs | Meters | Fine as NPC-only. Judgement: no need to make them playable |

**Hard-wired to 2025-27 or AI 2027 (verified):**
- Fixed start date `2025-07-01` (`core/time.ts:5`). Start values are typed as Jul 2025 (`gov.ts:18-32`, `public.ts:13-24`, `china.ts:30-41`).
- Statutes and politics by calendar: SB 53, RAISE, a Congress flip on 2027-01-03 (`gov.ts:179-190`). Elections only in 2026 and 2028 (`public.ts:27`). The executive is always R (`blocs.ts:19`).
- `wslFloor` stops rising in 2027 (`security.ts:23`). `shareRefAt(2025.5)` at `china.ts:49` and `rivals.ts:93`.
- China's compute doubles every year forever (`china.ts:141`). The AI 2027 DeepCent share of 40-90% (`china.ts:26`). Centralisation is a single +50 jump (`china.ts:274`).
- Thresholds are measured in OOM above the player's start model V0 (`gov.ts:109`, `rivals.ts:62-66`). With an earlier start, V0 moves and every threshold moves with it.
- These all end the game: first ASI from any lab (`endings.ts:115-127`), war (`:93`), rogue (`:106`), nationalised, and the 2051 cap. No actor has post-ASI behaviour.

## 4. Options and recommendation

| Option | What | Size (judgement) |
|---|---|---|
| A. Cleanup | Each dead item in §2: wire it to a sourced mechanism or delete it and fix the description. Move misplaced code. Turn preset-id branches into parameters | ~8-12 small tasks |
| B. Actor seam | Split each actor into observe / decide / apply, with ladder rungs and flags as named actions. No behaviour change, checked by a same-seed run | ~1 task per actor, gov and China first |
| C. De-date | Move statutes, elections, party control and date curves into data tables keyed by date or capability, so other start years only need data | ~4-6 tasks |
| D. Field-aware NPCs | Gov, public and China react to the best lab and to all incidents, not only the player | Medium; changes balance, needs a checkpoint |

Recommendation: do A first, then B for the government and China. A is cheap and removes false promises. B is the seam that player-as-China and player-as-government need, and it makes D and C easier. Leave the rogue mode until a lab NPC has a safety policy.

**Designer questions:**
1. For each dead parameter: build the promised behaviour, or delete it and reword the description?
2. Should gov, public and China watch every lab (D), or stay player-centric? D is needed before the player can be anyone but a US lab.
3. Should China preset blending stay? It averages away the extreme presets.
4. Which playable actor comes next after the US lab: China, the government, or the model?
5. Post-ASI: does the first ASI become a phase change rather than an ending? This decides whether actors need a post-ASI policy now.
6. Rival `cooperation` and `lobbyStance`: give them a real effect, or remove them?
