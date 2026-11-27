// C6 Open weights: release a model's weights below your best (research/17 §1.4; N6). Owner: WS4.
// Every preview shows what apply() does (§2.7 preview truth, lint-tradeoffs).
import type { ActionDef, GameStateV2 } from '../types';
import { bestG } from './labs';
import { frontierGPerYear, PACE_WINDOW_DAYS } from './capability';
import * as shock from '../npc/shocks';
import { L, pv } from '../actors/fx';
import { openWeightsReleased } from '../actors/rivals';
import { numParam, simpleAction } from '../core/actionDef';

/** The G of the weights (`behind` × 0.3 of a year of the player's own frontier-G slope below its best, RD-L03). N6: every lab
 *  behind that G moves RECIPE_LEAK_SHARE.openWeights of the way to it (npc/shocks.ts openWeightsMoves). */
const openReleaseG = (s: GameStateV2, behind: number) => bestG(s, 'player') - Math.max(1, behind) * 0.3 * frontierGPerYear(s, 'player', PACE_WINDOW_DAYS);
/** The most days of lag any of `moves` takes off its lab (the preview's lead line). */
const maxDays = (moves: shock.Move[]) => Math.round(Math.max(0, ...moves.map((x) => x.days)));

export const OPEN_WEIGHTS: ActionDef = simpleAction({
  id: 'C6', verb: 'launch', system: 'models', title: 'Open weights', cooldown: 180,
  // N6: the lead lines are what apply adds (npc/shocks.ts openWeightsMoves): days off the lag of the best-placed rival and of China;
  // none if the weights are not above the open frontier.
  preview: (s, p) => {
    const G = openReleaseG(s, numParam(p, 'behind', 1));
    const mv = shock.openWeightsMoves(s, 'player', G);
    const cn = Math.round(mv.find((x) => x.lab === s.china.lab)?.days ?? 0);
    return pv([L('leadDays', maxDays(mv.filter((x) => x.lab !== s.china.lab)), 'days the best-placed rival closes on you (at once)'), L('leadDays', cn, 'days China closes on you: it absorbs the weights')]);
  },
  apply(s, ctx, p) {
    const G = openReleaseG(s, numParam(p, 'behind', 1));
    openWeightsReleased(s, ctx, 'player', G); // N6: every lab behind the weights moves RECIPE_LEAK_SHARE.openWeights of the way to them
  },
});
