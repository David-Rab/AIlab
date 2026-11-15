// Event catalog: rival decisions (V2-SPEC §4.2: E32). Owner: WS4. Subjects are ACTIVE rivals only (E2);
// comparisons use the player's best INTERNAL version (E3).
import { activeRivals } from '../../models/labs';
import type { EventDefV2 } from '../../types';
import { cash, morale, scrutiny } from '../../actors/fx';
import { deactivateRival, leadBetween, postureOf } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { L, P, activeLab, ch, ev, labName } from '../kit';

export const RIVALS_EVENTS: EventDefV2[] = [
  ev({
    id: 'E32', title: 'Merger offer', icon: 'rival', crisis: false, cooldown: 365, deadlineDays: 30, defaultChoice: 1,
    when: (s) => {
      const r = activeRivals(s).find((x) => leadBetween(s, 'player', x.core.id) > 270 && x.meters.cooperation > 40);
      return r ? { lab: r.core.id } : false;
    },
    text: (s, d) => {
      const r = activeLab(s, d.lab);
      return `${labName(s, d.lab)} is ${r?.finance.distress ? 'running out of money' : 'falling behind'} and open to being acquired. Antitrust regulators will look closely.`;
    },
    choices: [
      ch('Acquire', ['race', 'acquire'], () => ({ costs: [L('cash', 5), L('scrutiny', 20, 'antitrust')], gains: [L('talent', 3, '70% of their staff')], exposure: [L('morale', -3, 'culture blend')] }), (s, ctx, d) => {
        const r = typeof d.lab === 'string' ? activeLab(s, d.lab) : undefined;
        if (!r) return;
        cash(s, ctx, -Math.max(2, Math.min(10, r.finance.valuation * 0.5 || 5)), 'E32 acquisition', r.core.name);
        ws4(s).absorbedCompute += r.core.computeOnline;
        s.player.staff.cap += Math.round(r.core.staff.cap * 0.7);
        s.player.staff.saf += Math.round(r.core.staff.saf * 0.7);
        scrutiny(ctx, 20, 'E32 antitrust');
        ctx.bump('relations.talentPull', 3, 'E32 acquisition');
        // Culture: their posture blends into morale (safety labs lift safety morale, mavericks lower it).
        const p = postureOf(s, r.core.id);
        ctx.bump('morale.safety', (p.safetyInvestment - 0.4) * 10, 'E32 culture blend');
        morale(ctx, -3, 'E32 integration');
        deactivateRival(s, ctx, r.core.id, 'merged', 'player');
      }),
      ch('Decline', ['decline'], P([L('leadDays', 30, 'it may go to Big Tech')], [L('cash', 0)]), () => {}),
    ],
  }),
];
