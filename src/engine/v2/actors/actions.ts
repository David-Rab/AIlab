// Brief officials (B7): how much the government sees of the lab's own evaluations (V2-SPEC §3.10.1; research/17 §1.4).
// Owner: WS4. The only action left of the relations catalog (W1c); W5 moves it to the US-government panel. The other
// kept levers moved to their owners: security/actions.ts, departments/poach.ts, models/openWeights.ts,
// safety/actions.ts (A1, A3, A6), worldfx/actions.ts (F3), endings/retire.ts.
// Every preview shows what apply() does (§2.7 preview truth, lint-tradeoffs).
import { clamp } from '../../rng';
import type { ActionDef } from '../types';
import { numParam, simpleAction } from '../core/actionDef';
import { L, pv } from './fx';

export const BRIEF_OFFICIALS: ActionDef = simpleAction({
  id: 'B7', verb: 'deal', system: 'relations', title: 'Brief officials',
  preview: (s, p) => {
    const lvl = clamp(Math.round(numParam(p, 'level', Math.min(3, s.player.policies.govBriefing + 1))), 0, 3);
    const up = lvl - s.player.policies.govBriefing;
    return up >= 0
      ? pv([L('security', 6 * Math.max(1, up), 'gov sees more → security demand'), L('freedom', Math.max(1, up) * 0.5)])
      : pv([], [L('freedom', 1)]);
  },
  apply(s, ctx, p) {
    const old = s.player.policies.govBriefing;
    const lvl = clamp(Math.round(numParam(p, 'level', Math.min(3, old + 1))), 0, 3) as 0 | 1 | 2 | 3;
    s.player.policies.govBriefing = lvl;
    if (lvl > old) {
      ctx.bump('gov.securityDemand', 3 * (lvl - old), 'B7 briefing');
      ctx.bump('gov.aiPriority', 3 * (lvl - old), 'B7 briefing');
    }
  },
});
