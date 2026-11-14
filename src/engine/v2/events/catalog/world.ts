// Event catalog: world decisions (V2-SPEC §4.2: E15). Owner: WS4 (content shared with WS5).
import type { EventDefV2 } from '../../types';
import { bloc, cash } from '../../actors/fx';
import { signCommitment } from '../../actors/commitments';
import { L, P, ch, ev } from '../kit';

export const WORLD_EVENTS: EventDefV2[] = [
  ev({
    id: 'E15', title: 'Mass protest', icon: 'public', crisis: false, cooldown: 180, deadlineDays: 21, defaultChoice: 2,
    when: (s) => s.pub.rung >= 2 && {},
    text: (s) => `${s.pub.rung >= 3 ? 'Hundreds of thousands' : 'Tens of thousands'} march against AI labs over jobs and power bills. Your name is on the signs.`,
    choices: [
      ch('Jobs pledge', ['community', 'spend'], P([L('cash', 0.5), L('freedom', 1, 'community pledge binds')], [L('approval', 5)]), (s, ctx) => {
        cash(ctx, -0.5, 'E15 community and jobs pledge');
        ctx.bump('pub.approval', 5, 'E15 pledge');
        s.player.policies.communityBenefits = true;
        signCommitment(s, ctx, 'communityPledge', 'Pay our own power and grid costs', 'communityPledge', {}, ['bloc:ratepayers', 'states'], { trust: 5, credibility: 8 });
        bloc(s, ctx, 'labor', 4, -10, 'E15');
      }),
      ch('Transition fund', ['community', 'spend'], P([L('cash', 10, 'per year')], [L('approval', 8, 'bloc:labor'), L('approval', 3)]), (s, ctx) => {
        s.player.policies.transitionFund = Math.max(s.player.policies.transitionFund, 10);
        ctx.bump('pub.jobAnxiety', -5, 'E15 transition fund');
        ctx.bump('pub.approval', 3, 'E15 transition fund');
        bloc(s, ctx, 'labor', 8, -15, 'E15');
      }),
      ch('Ignore', ['decline'], P([L('approval', 4), L('compute', 5, 'site permits at risk')], [L('cash', 0, 'no spend')]), (s, ctx) => {
        ctx.bump('pub.approval', -4, 'E15 ignored protests');
        ctx.bump('pub.dcNimby', 5, 'E15 ignored protests');
        bloc(s, ctx, 'labor', -3, 10, 'E15');
        bloc(s, ctx, 'ratepayers', -3, 10, 'E15');
      }),
    ],
  }),
];
