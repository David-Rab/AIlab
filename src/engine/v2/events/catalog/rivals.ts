// Event catalog: rival decisions (V2-SPEC §4.2: E31, E32). Owner: WS4. Subjects are ACTIVE rivals only (E2);
// comparisons use the player's best INTERNAL version (E3).
import { clamp } from '../../../rng';
import { activeRivals } from '../../models/labs';
import type { EventDefV2 } from '../../types';
import { bloc, cash, morale, regStance, rivalMeter, scrutiny, trust } from '../../actors/fx';
import { addPosture, deactivateRival, leadBetween, postureOf } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { L, P, activeLab, ch, ev, labName, requestOnly } from '../kit';

export const RIVALS_EVENTS: EventDefV2[] = [
  ev({
    id: 'E31', title: 'Rival incident', icon: 'rival', crisis: false, deadlineDays: 14, defaultChoice: 3,
    when: requestOnly,
    text: (s, d) => `${labName(s, d.lab)} disclosed a severity-${d.severity} model incident. How do you respond?`,
    choices: [
      ch('Offer joint eval', ['cooperate', 'safety'], P([L('scrutiny', 5, 'on both labs'), L('staffTime', 2)], [L('trust', 8, 'that rival'), L('alignment', 0.03, 'shared pool')]), (s, ctx, d) => {
        if (typeof d.lab !== 'string' || !activeLab(s, d.lab)) return;
        rivalMeter(s, ctx, d.lab, 'cooperation', 15, 'E31 joint eval');
        trust(s, ctx, `rival:${d.lab}`, 8, 'E31 joint eval');
        addPosture(s, d.lab, 'evalRigor', 0.05);
        s.knowledge.sharedTechniquePool = clamp(s.knowledge.sharedTechniquePool + 0.03, 0, 1);
        scrutiny(ctx, 5, 'E31 joint eval');
      }),
      ch('Exploit', ['race', 'compete'], P([L('trust', 20, 'that rival')], [L('approval', 3)]), (s, ctx, d) => {
        if (typeof d.lab !== 'string') return;
        ctx.bump('pub.approval', 3, 'E31 exploited rival incident');
        rivalMeter(s, ctx, d.lab, 'cooperation', -20, 'E31 exploited');
        trust(s, ctx, `rival:${d.lab}`, -8, 'E31 exploited');
      }),
      ch('Call for rules', ['safety', 'regulate'], P([L('approval', 6, 'bloc:accel'), L('scrutiny', 3, 'rules apply to you too')], [L('approval', 6, 'bloc:safety'), L('credibility', 1)]), (s, ctx) => {
        bloc(s, ctx, 'safety', 6, 5, 'E31 call for regulation');
        bloc(s, ctx, 'accel', -6, 0, 'E31 call for regulation');
        regStance(s, ctx, 6, 'E31 call for regulation');
      }),
      ch('Say nothing', ['decline'], P([L('credibility', 1)], [L('scrutiny', 0)]), (_s, ctx) => {
        ctx.bump('relations.credibility', -1, 'E31 silence');
      }),
    ],
  }),
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
      ch('Acquire', ['race', 'acquire'], () => ({ costs: [L('cash', 5), L('scrutiny', 20, 'antitrust')], gains: [L('compute', 20, '% more'), L('talent', 3)], exposure: [L('morale', -3, 'culture blend')] }), (s, ctx, d) => {
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
