// Event catalog: China decisions (design/world/OUTSIDE-WORLD.md §8.2: E10 Weights stolen, E23 Treaty). Owner: WS4.
// E10 is requested by a detected theft (security/theft.ts); E23 by world/chinagov.ts when talks reach restraint and
// Washington pays the player attention. Each default is the neutral choice.
import type { EventDefV2 } from '../../types';
import { morale, pv } from '../../actors/fx';
import { addCoverup, COVERUP_DISCOVERY_ODDS } from '../coverups';
import { approvalPush, approvalScaled } from '../../world/public';
import { CHINAGOV, provokeChina, resolveTreaty } from '../../world/chinagov';
import { L, P, ch, ev, requestOnly } from '../kit';

export const CHINA_EVENTS: EventDefV2[] = [
  ev({
    id: 'E10', title: 'Weights stolen', icon: 'china', crisis: true, deadlineDays: 7, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `Security confirms that the weights of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your best model'} were stolen, almost certainly by Chinese intelligence.`,
    choices: [
      // Going public: the public rallies a little; Beijing takes it as a provocation (world/chinagov.ts provokeChina).
      ch('Go public', ['hawk', 'disclose'], (s) => pv([], [L('approval', approvalScaled(s, CHINAGOV.goPublicApproval), 'the public rallies')]), (s, ctx) => {
        approvalPush(s, ctx, CHINAGOV.goPublicApproval, 'Went public about the weight theft');
        provokeChina(s, ctx.day);
      }),
      ch('Quiet hardening', ['quiet', 'security'], P([L('cash', 0.5, 'WSL target +1')], [L('security', 1)]), (s) => {
        const sec = s.player.security;
        sec.target = Math.min(5, sec.target + 1);
        sec.spendRate += 0.5;
        addCoverup(s, 'a weight theft', COVERUP_DISCOVERY_ODDS);
      }),
      ch('Purge insiders', ['security', 'hawk'], P([L('morale', 15)], [L('security', 0.5, 'spies ×0.3')]), (s, ctx) => {
        s.player.security.spyMult *= 0.3;
        s.player.security.purged = true;
        morale(ctx, -15, 'E10 purge');
      }),
    ],
  }),
  ev({
    id: 'E23', title: 'Treaty', icon: 'china', crisis: false, deadlineDays: 30, defaultChoice: 0,
    when: requestOnly,
    text: () => 'Washington and Beijing have a restraint pact on frontier AI within reach, and officials want your lab behind it. Backed, it can become a verified treaty that caps every lab’s AI R&D compute at its level on the day it is signed.',
    choices: [
      ch('Back it', ['comply', 'gov', 'safety'], P([], []), (s, ctx) => resolveTreaty(s, ctx, true)),
      ch('Oppose it', ['resist', 'decline'], P([], []), (s, ctx) => resolveTreaty(s, ctx, false)),
    ],
  }),
];
