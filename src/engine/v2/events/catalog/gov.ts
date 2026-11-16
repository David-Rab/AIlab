// Event catalog: government decisions (V2-SPEC §4.2: E12, E20, E22, E29). Owner: WS4.
import { activeRivals, bestLg } from '../../models/labs';
import type { EventDefV2 } from '../../types';
import { cred, hasFavor, morale, natPressure, scrutiny, spendFavor, trust } from '../../actors/fx';
import { deactivateRival } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { changeHeads } from '../../departments/teams';
import { L, P, ch, ev, requestOnly } from '../kit';


export const GOV_EVENTS: EventDefV2[] = [
  ev({
    id: 'E12', title: 'Clearances', icon: 'gov', crisis: false, deadlineDays: 30, defaultChoice: 2,
    when: requestOnly,
    text: () => 'Washington now requires security clearances for frontier work. 5–15% of your staff — foreign nationals and some safety researchers — would be sidelined for 60 days.',
    choices: [
      ch('Comply', ['comply', 'gov'], P([L('morale', 10), L('progress', 8, '% speed for 60 d')], [L('trust', 10, 'exec'), L('security', 0.3)]), (s, ctx) => {
        s.player.security.clearances = true;
        s.player.security.target = Math.min(5, s.player.security.target + 0.3);
        s.player.security.wsl = Math.min(5, s.player.security.wsl + 0.3);
        s.flags['ws4:sidelinedUntil'] = ctx.day + 60;
        morale(ctx, -10, 'E12 clearances');
        trust(s, ctx, 'exec', 10, 'E12 complied');
      }),
      ch('Negotiate', ['balanced', 'gov'], (s) => ({ costs: [hasFavor(s, 'exec') ? L('trust', 0, 'spend an exec favor') : L('trust', 5, 'exec'), L('morale', 5)], gains: [L('security', 0.15), L('trust', 4, 'exec')], exposure: [] }), (s, ctx) => {
        if (!spendFavor(s, 'exec')) trust(s, ctx, 'exec', -5, 'E12 negotiation');
        s.player.security.clearances = true;
        s.player.security.target = Math.min(5, s.player.security.target + 0.15);
        s.flags['ws4:sidelinedUntil'] = ctx.day + 30;
        morale(ctx, -5, 'E12 clearances (negotiated)');
        trust(s, ctx, 'exec', 4, 'E12 negotiated');
      }),
      ch('Resist', ['resist', 'decline'], P([L('trust', 15, 'exec'), L('freedom', 10, 'nationalisation +10')], [L('morale', 3)]), (s, ctx) => {
        trust(s, ctx, 'exec', -15, 'E12 resisted clearances');
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
      ch('Accept', ['comply', 'gov', 'safety'], P([L('freedom', 15, 'committee votes on major decisions')], [L('trust', 10, 'exec'), L('approval', 5)]), (s, ctx) => {
        s.gov.oversight = true;
        trust(s, ctx, 'exec', 10, 'E20 accepted oversight');
        ctx.bump('pub.approval', 5, 'E20 accepted oversight');
        natPressure(ctx, -15, 'E20 accepted oversight');
      }),
      ch('Negotiate', ['balanced', 'gov'], (s) => ({ costs: [hasFavor(s, 'exec') ? L('trust', 0, 'spend favors') : L('trust', 6, 'exec'), L('freedom', 8, 'smaller committee')], gains: [L('trust', 4, 'exec')], exposure: [] }), (s, ctx) => {
        if (!spendFavor(s, 'exec')) trust(s, ctx, 'exec', -6, 'E20 negotiation');
        s.gov.oversight = true;
        s.flags['ws4:smallCommittee'] = true;
        natPressure(ctx, -8, 'E20 negotiated oversight');
      }),
      ch('Refuse', ['resist', 'decline'], P([L('freedom', 25, 'nationalisation +25'), L('trust', 10, 'exec')], [L('boardConf', 3)]), (s, ctx) => {
        natPressure(ctx, 25, 'E20 refused oversight');
        trust(s, ctx, 'exec', -10, 'E20 refused oversight');
      }),
    ],
  }),
  ev({
    id: 'E22', title: 'DPA consolidation', icon: 'gov', crisis: true, deadlineDays: 14, defaultChoice: 1,
    when: requestOnly,
    text: (s) => `The government offers to use the Defense Production Act to fold ${activeRivals(s).map((r) => r.core.name).join(', ') || 'trailing labs'} into your company.`,
    choices: [
      ch('Accept', ['race', 'gov', 'comply'], P([L('freedom', 15, 'government-held lab'), L('scrutiny', 10)], [L('talent', 5, 'half of rival capability staff'), L('leadDays', 90)]), (s, ctx) => {
        const w = ws4(s);
        w.dpaAccepted = true;
        for (const r of activeRivals(s)) {
          w.absorbedCompute += r.core.computeOnline;
          changeHeads(s, 'cap', Math.round(r.core.staff.cap * 0.5));
          deactivateRival(s, ctx, r.core.id, 'merged', 'player');
        }
        s.gov.rungSec = 5;
        scrutiny(ctx, 10, 'E22 consolidation');
      }),
      ch('Decline', ['decline'], P([L('trust', 10, 'exec')], [L('freedom', 5)]), (s, ctx) => {
        trust(s, ctx, 'exec', -10, 'E22 declined consolidation');
      }),
    ],
  }),
  ev({
    id: 'E29', title: 'Evaluator contradicts', icon: 'gov', crisis: false, deadlineDays: 14, defaultChoice: 0,
    when: requestOnly,
    text: (_s, d) => `Independent evaluators report level ${d.theirL}; you claimed ${d.ourL}. The press wants to know who is right.`,
    choices: [
      ch('Accept & correct', ['disclose', 'honour'], P([L('approval', 1, 'small embarrassment')], [L('credibility', 3), L('trust', 3, 'evalIndep')]), (s, ctx) => {
        cred(ctx, 3, 'E29 accepted correction');
        trust(s, ctx, 'evalIndep', 3, 'E29 accepted correction');
        ctx.bump('pub.approval', -1, 'E29 correction');
      }),
      ch('Dispute', ['deny'], P([L('credibility', 15, 'if they were right', { probability: 0.6 })], [L('approval', 1)]), (s, ctx, d) => {
        const v = s.player.models.versions.find((x) => x.id === d.versionId);
        const truth = v?.Lg ?? bestLg(s, 'player');
        const wrong = Math.abs(Number(d.theirL) - truth) < Math.abs(Number(d.ourL) - truth);
        if (wrong) {
          cred(ctx, -15, 'E29 disputed a correct report');
          trust(s, ctx, 'evalIndep', -5, 'E29 dispute');
        } else cred(ctx, 2, 'E29 dispute vindicated');
      }),
    ],
  }),
];
