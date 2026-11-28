// C4 Poach: hire a team from a rival lab, with its tacit know-how (labour market; research/17 §1.4). Owner: WS4.
// Every preview shows what apply() does (§2.7 preview truth, lint-tradeoffs).
import type { ActionDef, GameStateV2, RivalLab } from '../types';
import { activeRivals, bestG } from '../models/labs';
import { playerRecipeG, raiseDiffused } from '../models/stacks';
import * as shock from '../npc/shocks';
import { cash, L, morale, pv } from '../actors/fx';
import { ownProgressDays } from '../actors/rivals';
import { simpleAction, strParam, type ActionParams } from '../core/actionDef';
import { changeHeads, headsMoved } from './teams';

/** C4's poached heads (3% of the rival's capabilities staff, at least 5). */
const poachHeads = (r: RivalLab) => Math.max(5, Math.round(r.core.staff.cap * 0.03));
/** RD-X04b / F2: C4's tacit knowledge (OOM on the player's effective recipe; it raises the diffused level D, not own): the
 *  tacit share of the gap to the internal know-how of the rival they left (npc/shocks.ts tacitKnowhowGain). */
const c4TacitG = (s: GameStateV2, r: RivalLab) => shock.tacitKnowhowGain(s, r, poachHeads(r));

/** Default poach target: the active rival closest behind (or ahead of) the player. */
function poachTarget(s: GameStateV2, p: ActionParams) {
  const want = strParam(p, 'lab', '');
  const act = activeRivals(s);
  return act.find((r) => r.core.id === want) ?? [...act].sort((a, b) => Math.abs(bestG(s, 'player') - bestG(s, a.core.id)) - Math.abs(bestG(s, 'player') - bestG(s, b.core.id)))[0];
}

export const POACH: ActionDef = simpleAction({
  id: 'C4', verb: 'hire', system: 'people', title: 'Poach', cooldown: 180,
  available: (s) => (activeRivals(s).length ? true : 'No active rivals'),
  preview: (s, p) => {
    const r = poachTarget(s, p);
    return pv([L('cash', 0.5)], [L('leadDays', r ? Math.round(ownProgressDays(s, 'player', c4TacitG(s, r))) : 0, r ? `days of your own progress: tacit recipe from ${r.core.name}` : undefined), L('leadDays', r ? Math.round(shock.poachInDays(s, r, headsMoved(s.player, 'cap', poachHeads(r)))) : 0, r ? `days ${r.core.name} falls back (its heads carry the same share)` : undefined)], [L('cash', -0.5, 'trade-secret suit', { probability: 0.2 }), L('morale', -3, 'culture dilution')]);
  },
  apply(s, ctx, p) {
    const r = poachTarget(s, p);
    if (!r) return;
    cash(s, ctx, -0.5, 'C4 poaching', r.core.name);
    const n = poachHeads(r);
    // RD-X04b / F2: tacit knowledge (c4TacitG, sized before the heads move) raises the diffused level D to the effective
    // recipe plus the gain, so the recipe rises by exactly the gain (no double count with own research).
    const tacit = c4TacitG(s, r);
    // Staff arrive as whole teams (changeHeads rounds). The poach-in shock (npc/shocks.ts, one rule for every route) by the
    // heads that moved, sized before the rival's staff drops; the preview reads the same count (headsMoved).
    const moved = changeHeads(s, 'cap', n);
    shock.poachIn(s, r, moved);
    r.core.staff.cap = Math.max(0, r.core.staff.cap - moved);
    if (tacit > 0) raiseDiffused(s, ctx, playerRecipeG(s) + tacit, 'C4 tacit knowledge', r.core.name);
    morale(ctx, -3, 'culture dilution', r.core.name);
    if (ctx.rng('actors').chance(0.2)) cash(s, ctx, -0.5, 'trade-secret suit', r.core.name);
  },
});
