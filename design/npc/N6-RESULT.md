# N6 result: the NPC shocks

Task N6 of NPC-TASKS.md, branch `npc-n6` (off `npc`). Spec: NPC-LABS.md §4 lag rule, §5 shocks. Moves calibration: yes.
New `src/engine/v2/npc/shocks.ts`: one small function per shock on the lab's lag d (days behind the reference), one shared
helper `pullDays` (move part of the way toward a position; position = (reference year - clockOfG(G)) x 365.25, via
npc/lab.ts clockOfGAt). A pull never worsens a lag; d then relaxes by the lag rule. Previews call the same `...Moves`/`...Days`
functions the actions apply.

## Shocks, triggers, values

| Shock | Function | Trigger / preview now calls it | Amount |
|---|---|---|---|
| Theft | `theft(s, stolenG)` | security/theft.ts executeTheft (player and rival victims) | China's d = min(d, victim position + **THEFT_INTEGRATION_DAYS = 60 d** [P: AI 2027 China ends ~2 months behind after stealing]) |
| Publish (A4) | `publishMoves` / `publish` | A4 apply and preview | every lab behind the player's best model: RECIPE_LEAK_SHARE.publish (0.05) of the way |
| Open weights | `openWeightsMoves` / `openWeights` | `openWeightsReleased` (C6, the player's open deployments, any lab's open release); C6 preview | every other lab behind the released model: 0.3 of the way; only above the open frontier |
| Absorb | `absorb(buyer, seller)` | finance/rivalFinance.ts exitRival | buyer d = min(buyer, seller), adds the seller's compute. E22 / E32: the buyer is the player, who has no lag, and they never used the adapter: unchanged |
| IP access | `ipAccessDays` / `ipAccess` | labDaily (was finance/deals.ts ipAccessDaily, deleted) | per running deal, ipCloseYr / 365 (10% a year) of the way to the player's licensed model, daily |
| Poach in (C4) | `poachInDays` / `poachIn` | C4 apply; C4 preview gets a "falls back" line | rival d rises by tacit share (0.5 x heads moved / staff) x the days it leads the player (zero if behind) [D: the days the player gains, taken from it] |
| Let go (E16) | `letGoDays` / `letGo` | E16 apply and preview | rival d falls by the tacit share x the days it trails the player |
| Joint evals (C3) | `jointEvals` | C3 apply | partner's safety emphasis + JOINT_EVAL_STEP 0.05 [D], stored as `npc.pers` override and in the posture delta postureOf reads |
| Treaty | `treatyClockDay`, `refYear` | npcCapabilityDay (once a day) | the reference year every lab reads loses (1 - 0.65) d per day while gov.treaty is 'verified' (flag `npc:clockLost`) |
| Safety spillover | `spillMoves` / `spill` | safety/findings.ts publishFinding (SPILL) | every active lab's d falls SPILL_DAYS = 7 d [D: 0.024 OOM at ~1.2 OOM/yr], not past the player |
| Track-2 (E1) | `track2Moves` / `track2` | E1 apply and preview | China's d falls TRACK2_DAYS = 2 d [D: old 1% of ~200 d], not past the player |
| China secrets leak | `secretsLeak(s, share)` | security.ts daily; `secretsLeakDaily` is now the channel strength k x spies x clamp(3.5 - ssl, 0, 2) (no gap factor) | China moves that share of the gap to the player's position a day |
| China distillation | `distillDays` / `distill`; `distillDaysPerYear` | labDaily on China's release days; productOps distillDaysPerYear (products preview) | pull toward the best live player product by DISTILL_S x access x fit; days a year = one pull a release |

## Removed

`addRivalKnowledge` (rivalModel.ts), `npcHoldG` (lab.ts), `ipAccessDaily` (deals.ts), `publishLeakG`, `poachLeakG`,
`openAbsorbG`, `releaseRecG` (rivals.ts), `openWeightsReleased`'s recipe argument. Absorption no longer moves the buyer's lag
through the recipe adapter (Tarnwick's 76 -> 48 d jump goes: it takes the seller's d only if better).

## Adapters that remain (N2b-1 table)

`npcPhys` / `phys` (N12), `npc.rec` and `recG` / `recipeOf` (diffusion rule A readers for the player, `publicRecipes`: N4; the
shocks no longer read recipes), `postureOf` via `hidden.rivalPostures` + `postureDelta` (N2b-2; joint evals writes both), `archetype`,
`parentFunded`, chip-order and production fallbacks, staff, traits step, `nextBaseDay`, worlds without a draw. Left unused by
the game and compiled: `recipeLeakG`, `tacitLeakG` (still used for the player's side of C4), `labRecipeG`. Stale and not touched
(outside the file list): productOps `releaseOpen` preview's rival line (old rule B percent; China's line is still right: 30% of the gap),
scripts/v2 finance.ts / leadreaders.ts / rivals.ts reading removed functions (not in the tsc project; N12).

## Tests

`npx tsc --noEmit -p .`: clean. `npx tsx scripts/v2/npcShocks.ts` (direct calls on a day-0 state, no simulation): all pass.
Each shock's amount, A4 / E1 previews equal the applied moves, treaty clock 100 d -> 35 d lost.
Longer tests I would want (the designer to approve): a 900-day game for the China lag shape (check 6.5-8 months in Nov 2026) with
theft, secrets leak and open-weights channels live; a treaty game to see the labs' lag under the slowed clock; the absorb path in
a game with a private lab failing (Tarnwick's lag).

## Notes

- Treaty applies to the slope too (refSlopePerDay reads refYear), so shortfall days convert on the slowed clock.
- The player is not slowed by the treaty here (its own treaty rate is production.ts's, unchanged).
- Distillation of China is now a pull per release (before: rule B at post-training, which the NPC tick no longer runs).
