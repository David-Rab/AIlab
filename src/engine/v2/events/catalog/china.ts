// Event catalog: China decisions (V2-SPEC §4.2: E10, E23). Owner: WS4.
// The trust, scrutiny, talent-pull and bloc effects went with the relation stocks (W1c); W6/W7 redo them.
import type { EventDefV2 } from '../../types';
import { morale } from '../../actors/fx';
import { pRally } from '../../actors/public';
import { addCoverup, COVERUP_DISCOVERY_ODDS } from '../coverups';
import { ws4 } from '../../actors/state';
import { L, P, ch, ev, requestOnly } from '../kit';

export const CHINA_EVENTS: EventDefV2[] = [
  ev({
    id: 'E10', title: 'Weights stolen', icon: 'china', crisis: true, deadlineDays: 7, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `Security confirms that the weights of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your best model'} were stolen, almost certainly by Chinese intelligence.`,
    choices: [
      ch('Public + retaliate', ['hawk', 'disclose'], P([L('chinaTension', 15)], [L('approval', 5, 'rally')], [L('chinaTension', 10, 'Taiwan')]), (s, ctx) => {
        pRally(s, ctx);
        if (s.gov.rungChn < 2) s.gov.rungChn = 2;
        ctx.bump('china.meters.taiwanTension', 10, 'E10 retaliation');
        ctx.bump('china.meters.centralization', 15, 'US cyber retaliation (R15)');
        ctx.bump('gov.hawkishness', 15, 'E10 theft made public');
        ws4(s).lastTheftOrCyberDay = ctx.day;
        ws4(s).disclosed++;
      }),
      ch('Quiet hardening', ['quiet', 'security'], P([L('cash', 0.5, 'WSL target +1'), L('approval', 8, 'if it leaks', { probability: COVERUP_DISCOVERY_ODDS })], [L('security', 1)]), (s) => {
        const sec = s.player.security;
        sec.target = Math.min(5, sec.target + 1);
        sec.spendRate += 0.5;
        addCoverup(s, 'a weight theft', COVERUP_DISCOVERY_ODDS);
      }),
      ch('Purge insiders', ['security', 'hawk'], P([L('morale', 15)], [L('security', 0.5, 'spies ×0.3')]), (s, ctx) => {
        ws4(s).spyMult *= 0.3;
        s.flags['ws4:purged'] = true;
        morale(ctx, -15, 'E10 purge');
      }),
    ],
  }),
  ev({
    id: 'E23', title: 'China deal', icon: 'china', crisis: false, deadlineDays: 30, defaultChoice: 2,
    when: requestOnly,
    text: () => 'Beijing signals it would accept mutual restraint on frontier AI — with verification on parity terms. Washington asks where you stand.',
    choices: [
      ch('Verified talks', ['treaty', 'safety', 'dove'], P([L('leadDays', 60, 'treaty slows all labs')], [L('chinaTension', 10)]), (s, ctx) => {
        s.gov.treaty = 'talks';
        s.flags['ws4:lobbyTreaty'] = true;
        ctx.bump('china.meters.verificationWillingness', 10, 'E23 verified talks');
        ws4(s).usProposedTalks = true;
      }),
      ch('Narrow channel', ['balanced', 'dove'], P([], [L('chinaTension', 4)]), (s, ctx) => {
        if (s.gov.treaty === 'none') s.gov.treaty = 'restraint';
        ctx.bump('china.meters.normsDiplomacy', 5, 'E23 incident channel');
      }),
      ch('Reject', ['hawk', 'race'], P([L('chinaTension', 10)]), (s, ctx) => {
        ws4(s).treatyRejected = true;
        ctx.bump('china.meters.taiwanTension', 10, 'E23 rejected');
      }),
    ],
  }),
];
