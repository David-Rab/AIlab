// Event catalog: government decisions (V2-SPEC §4.2: E12, E20, E22; E29 cut, spec §8.2). Owner: WS4.
// The executive-trust, favour and scrutiny effects went with the relation stocks (W1c); W5/W7 redo them.
import { activeRivals } from '../../models/labs';
import type { EventDefV2 } from '../../types';
import { morale, natPressure } from '../../actors/fx';
import { deactivateRival } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { changeHeads } from '../../departments/teams';
import { L, P, ch, ev, requestOnly } from '../kit';
import { forceLines, mergerVote, obligationLines, rivalObligations, sumObligations, takeOnObligations, voteBlock } from '../../finance/acquire';
import { voteGate } from '../../finance/board';
import type { GameStateV2 } from '../../types';

/** E22: what the consolidation brings (FIN3c): every active rival's obligations, half its capabilities staff. */
const dpaObligations = (s: GameStateV2) => sumObligations(activeRivals(s).map(rivalObligations));
const dpaStaff = (s: GameStateV2) => activeRivals(s).reduce((a, r) => a + Math.round(r.core.staff.cap * 0.5), 0);
const dpaVote = (s: GameStateV2) => mergerVote(s, `folding ${activeRivals(s).length} labs into the company under the DPA`, 'the absorbed labs', dpaObligations(s), 0, 0);


export const GOV_EVENTS: EventDefV2[] = [
  ev({
    id: 'E12', title: 'Clearances', icon: 'gov', crisis: false, deadlineDays: 30, defaultChoice: 2,
    when: requestOnly,
    text: () => 'Washington now requires security clearances for frontier work. 5–15% of your staff — foreign nationals and some safety researchers — would be sidelined for 60 days.',
    choices: [
      ch('Comply', ['comply', 'gov'], P([L('morale', 10), L('progress', 8, 'research speed for 60 d', { unit: '%' })], [L('security', 0.3)]), (s, ctx) => {
        s.player.security.clearances = true;
        s.player.security.target = Math.min(5, s.player.security.target + 0.3);
        s.player.security.wsl = Math.min(5, s.player.security.wsl + 0.3);
        s.flags['ws4:sidelinedUntil'] = ctx.day + 60;
        morale(ctx, -10, 'E12 clearances');
      }),
      ch('Negotiate', ['balanced', 'gov'], P([L('morale', 5)], [L('security', 0.15)]), (s, ctx) => {
        s.player.security.clearances = true;
        s.player.security.target = Math.min(5, s.player.security.target + 0.15);
        s.flags['ws4:sidelinedUntil'] = ctx.day + 30;
        morale(ctx, -5, 'E12 clearances (negotiated)');
      }),
      ch('Resist', ['resist', 'decline'], P([L('freedom', 10, 'nationalisation +10')], [L('morale', 3)]), (_s, ctx) => {
        natPressure(ctx, 10, 'E12 resisted clearances');
        morale(ctx, 3, 'E12 resisted clearances');
      }),
    ],
  }),
  ev({
    id: 'E20', title: 'Oversight committee', icon: 'gov', crisis: true, deadlineDays: 14, defaultChoice: 2,
    when: requestOnly,
    text: () => 'The government proposes a joint [[oversight]] committee: officials and your executives vote on major decisions.',
    choices: [
      ch('Accept', ['comply', 'gov', 'safety'], P([L('freedom', 15, 'committee votes on major decisions')], [L('approval', 5)]), (s, ctx) => {
        s.gov.oversight = true;
        ctx.bump('pub.approval', 5, 'E20 accepted oversight');
        natPressure(ctx, -15, 'E20 accepted oversight');
      }),
      ch('Negotiate', ['balanced', 'gov'], P([L('freedom', 8, 'smaller committee')]), (s, ctx) => {
        s.gov.oversight = true;
        s.flags['ws4:smallCommittee'] = true;
        natPressure(ctx, -8, 'E20 negotiated oversight');
      }),
      ch('Refuse', ['resist', 'decline'], P([L('freedom', 25, 'nationalisation +25')], [L('boardConf', 3)]), (_s, ctx) => {
        natPressure(ctx, 25, 'E20 refused oversight');
      }),
    ],
  }),
  ev({
    id: 'E22', title: 'DPA consolidation', icon: 'gov', crisis: true, deadlineDays: 14, defaultChoice: 1,
    when: requestOnly,
    text: (s) => `The government offers to use the Defense Production Act to fold ${activeRivals(s).map((r) => r.core.name).join(', ') || 'trailing labs'} into your company.`,
    choices: [
      // FIN3c (FINANCE-V3 §9): the absorbed labs' obligations follow E32's rule (each private lab's contracts and debt are
      // yours; parent-funded labs bring none). Accepting is your choice, so it is a merger the board votes on (on the
      // company after the deal), like E32; no price is paid. Declining needs no vote.
      ch('Accept', ['race', 'gov', 'comply'], (s) => {
        const o = dpaObligations(s);
        return { costs: [L('freedom', 15, 'government-held lab'), ...forceLines([dpaVote(s)])], gains: [L('staffTime', dpaStaff(s), 'half of the rival labs\' capabilities staff'), L('leadDays', 90)], exposure: obligationLines(s, o) };
      }, (s, ctx) => {
        const no = voteGate(ctx, dpaVote(s), true);
        if (no) {
          ctx.log('finance', `The consolidation did not go through: ${no}.`, 2);
          return;
        }
        const w = ws4(s);
        w.dpaAccepted = true;
        for (const r of activeRivals(s)) {
          w.absorbedCompute += r.core.computeOnline;
          changeHeads(s, 'cap', Math.round(r.core.staff.cap * 0.5));
          takeOnObligations(s, ctx, r.core.name, rivalObligations(r));
          deactivateRival(s, ctx, r.core.id, 'merged', 'player');
        }
        s.gov.rungSec = 5;
      }, (s) => voteBlock([dpaVote(s)]) ?? true, dpaVote),
      ch('Decline', ['decline'], P([], [L('freedom', 5)]), () => {}),
    ],
  }),
];
