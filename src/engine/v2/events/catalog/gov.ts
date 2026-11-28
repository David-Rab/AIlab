// Event catalog: the US government's decisions (design/world/OUTSIDE-WORLD.md §8.2: E12 Clearances, E20 Oversight
// committee, E22 Consolidation). Owner: WS4. Each is requested by world/usgov.ts when its stage lands on the player
// (attention at least USGOV.attentionMin), once; the default is the neutral choice. Trust moves by the choice itself
// (not scaled by attention: the lab is in the room).
import type { EventDefV2, GameStateV2 } from '../../types';
import { morale } from '../../actors/fx';
import { L, P, ch, ev, requestOnly } from '../kit';
import { forceLines, mergerVote, sumObligations, voteBlock } from '../../finance/acquire';
import { voteGate } from '../../finance/board';
import { acceptDpa, dpaPoolPreview, dpaStaffPlan, trustPush, USGOV } from '../../world/usgov';

/** E22's board vote: pooling the American labs' compute and staff into the company (no contracts or debt come with it). */
const dpaVote = (s: GameStateV2) => mergerVote(s, 'pooling the American labs\' compute into the company under the Defense Production Act', 'the pooled labs', sumObligations([]), 0, 0);

export const GOV_EVENTS: EventDefV2[] = [
  ev({
    id: 'E12', title: 'Clearances', icon: 'gov', crisis: false, deadlineDays: 30, defaultChoice: 0,
    when: requestOnly,
    text: () => 'Washington now requires security clearances and embedded officials for frontier work. Some staff would be sidelined while they wait.',
    choices: [
      ch('Comply', ['comply', 'gov'], P([L('morale', -USGOV.clearMorale)], [L('security', USGOV.clearSecurity, 'security target'), L('trust', USGOV.clearTrust)]), (s, ctx) => {
        s.player.security.clearances = true;
        s.player.security.target = Math.min(5, s.player.security.target + USGOV.clearSecurity);
        morale(ctx, USGOV.clearMorale, 'E12 clearances');
        trustPush(s, ctx, USGOV.clearTrust, 'Complied with clearances', 1);
      }),
      ch('Resist', ['resist', 'decline'], P([L('trust', -USGOV.resistTrust)], [L('morale', USGOV.resistMorale)]), (s, ctx) => {
        morale(ctx, USGOV.resistMorale, 'E12 resisted clearances');
        trustPush(s, ctx, USGOV.resistTrust, 'Resisted clearances', 1);
      }),
    ],
  }),
  ev({
    id: 'E20', title: 'Oversight committee', icon: 'gov', crisis: true, deadlineDays: 14, defaultChoice: 0,
    when: requestOnly,
    text: () => `The government proposes a joint [[oversight]] committee of officials and your executives. Launches of a superhuman AI researcher would wait ${USGOV.reviewDays} days for its review.`,
    choices: [
      ch('Accept', ['comply', 'gov', 'safety'], P([L('leadDays', USGOV.reviewDays, 'each superhuman-researcher launch')], [L('trust', USGOV.oversightTrust)]), (s, ctx) => {
        s.usgov.oversight = true;
        trustPush(s, ctx, USGOV.oversightTrust, 'Accepted the oversight committee', 1);
      }),
      ch('Refuse', ['resist', 'decline'], P([L('trust', -USGOV.refuseTrust)]), (s, ctx) => {
        trustPush(s, ctx, USGOV.refuseTrust, 'Refused the oversight committee', 1);
      }),
    ],
  }),
  ev({
    id: 'E22', title: 'Consolidation (DPA)', icon: 'gov', crisis: true, deadlineDays: 14, defaultChoice: 1,
    when: requestOnly,
    text: () => `The government offers to use the Defense Production Act to pool the US labs into yours: ${Math.round(USGOV.dpaShare * 100)}% of each lab's compute and staff, and two government directors join your board, with security approval over threshold models.`,
    choices: [
      // Accepting is your choice, so the board votes on it (on the company after the deal), like a merger; no price is paid.
      ch('Accept', ['race', 'gov', 'comply'], (s) => ({
        costs: [L('freedom', 15, 'a government-held lab: 2 government directors join the board, with security approval over handing out capability-threshold models (no votes, you stay in control)'), ...forceLines([dpaVote(s)])],
        gains: [L('compute', dpaPoolPreview(s), 'the pooled compute, rent-free'), L('staffTime', dpaStaffPlan(s).heads, `staff: ${Object.values(dpaStaffPlan(s).teams).reduce((a, n) => a + (n ?? 0), 0)} whole teams from the American labs, in your current mix`, { unit: 'people' })],
        exposure: [],
      }), (s, ctx) => {
        const no = voteGate(ctx, dpaVote(s), true);
        if (no) {
          ctx.log('finance', `The consolidation did not go through: ${no}.`, 2);
          return;
        }
        acceptDpa(s, ctx);
      }, (s) => voteBlock([dpaVote(s)]) ?? true, dpaVote),
      ch('Decline', ['decline'], P([L('trust', -USGOV.declineTrust)]), (s, ctx) => {
        trustPush(s, ctx, USGOV.declineTrust, 'Declined consolidation', 1);
      }),
    ],
  }),
];
