// Event catalog: China decisions (V2-SPEC §4.2: E06, E10, E23, E24). Owner: WS4.
import type { EventDefV2 } from '../../types';
import { bloc, cash, morale, trust } from '../../actors/fx';
import { pRally } from '../../actors/public';
import { addCoverup } from '../../actors/relations';
import { discoveryOdds } from '../../actors/researchBodies';
import { ws4 } from '../../actors/state';
import { L, P, ch, ev, requestOnly } from '../kit';

export const CHINA_EVENTS: EventDefV2[] = [
  ev({
    id: 'E06', title: 'Distillation campaign', icon: 'china', crisis: false, cooldown: 180, deadlineDays: 21, defaultChoice: 2,
    when: (s) => ws4(s).distillDays >= 30 && {},
    text: () => 'Thousands of fraudulent accounts are harvesting your models\' outputs to train Chinese models. The traffic has run for a month.',
    choices: [
      ch('Ban + KYC', ['security', 'hawk'], (s) => ({ costs: [L('revenue', Math.max(0.05, s.player.finance.revenueRun * 0.02), '−2%')], gains: [L('leadDays', 20, 'distillation ×0.75'), L('approval', 4, 'bloc:hawks')], exposure: [] }), (s, ctx) => {
        s.flags['ws4:kycBan'] = true;
        for (const d of s.player.deployments) if (d.channel === 'api' || d.channel === 'agents') d.kyc = Math.min(3, d.kyc + 1) as 0 | 1 | 2 | 3;
        cash(ctx, -s.player.finance.revenueRun * 0.02, 'E06 KYC lost customers');
        bloc(s, ctx, 'hawks', 4, 0, 'E06');
        ws4(s).distillDays = 0;
      }),
      ch('Share intel', ['cooperate', 'hawk'], P([L('trust', 5, 'china'), L('security', 0.5, 'reveals methods')], [L('trust', 5, 'rivals'), L('leadDays', 10, 'DA −10 for all US labs')]), (s, ctx) => {
        s.flags['ws4:threatIntel'] = true;
        ctx.bump('china.meters.distillationAccess', -10, 'E06 shared intel');
        trust(s, ctx, 'china', -5, 'E06 shared intel');
        for (const r of s.rivals) if (r.core.status === 'active') trust(s, ctx, `rival:${r.core.id}`, 5, 'E06 shared intel');
        ws4(s).distillDays = 0;
      }),
      ch('Monitor quietly', ['quiet', 'decline'], P([L('leadDays', 15, 'leak continues')], [L('security', 0.1, 'intel on their methods')]), (s) => {
        ws4(s).distillDays = 0;
      }),
    ],
  }),
  ev({
    id: 'E10', title: 'Weights stolen', icon: 'china', crisis: true, deadlineDays: 7, defaultChoice: 1,
    when: requestOnly,
    text: (s, d) => `Security confirms that the weights of ${s.player.models.versions.find((v) => v.id === d.versionId)?.name ?? 'your best model'} were stolen, almost certainly by Chinese intelligence.`,
    choices: [
      ch('Public + retaliate', ['hawk', 'disclose'], P([L('chinaTension', 15), L('scrutiny', 10)], [L('approval', 5, 'rally'), L('trust', 5, 'exec')], [L('chinaTension', 10, 'Taiwan')]), (s, ctx) => {
        pRally(s, ctx);
        if (s.gov.rungChn < 2) s.gov.rungChn = 2;
        ctx.bump('china.meters.taiwanTension', 10, 'E10 retaliation');
        ctx.bump('china.meters.centralization', 15, 'US cyber retaliation (R15)');
        ctx.bump('gov.hawkishness', 15, 'E10 theft made public');
        trust(s, ctx, 'exec', 5, 'E10 disclosed theft');
        ctx.bump('relations.scrutiny', 10, 'E10 theft public');
        ws4(s).lastTheftOrCyberDay = ctx.day;
        ws4(s).disclosed++;
      }),
      ch('Quiet hardening', ['quiet', 'security'], (s) => ({ costs: [L('cash', 0.5, 'WSL target +1'), L('trust', 6, 'if it leaks', { probability: discoveryOdds(s) })], gains: [L('security', 1)], exposure: [] }), (s) => {
        const sec = s.player.security;
        sec.target = Math.min(5, sec.target + 1);
        sec.spendRate += 0.5;
        addCoverup(s, 'a weight theft', discoveryOdds(s), ['exec', 'congress', 'evalGov']);
      }),
      ch('Purge insiders', ['security', 'hawk'], P([L('morale', 15), L('talent', 5)], [L('security', 0.5, 'spies ×0.3')], [L('trust', -5, 'whistleblower hazard ×1.5')]), (s, ctx) => {
        ws4(s).spyMult *= 0.3;
        s.flags['ws4:purged'] = true;
        morale(ctx, -15, 'E10 purge');
        ctx.bump('relations.talentPull', -5, 'E10 purge');
      }),
    ],
  }),
  ev({
    id: 'E23', title: 'China deal', icon: 'china', crisis: false, deadlineDays: 30, defaultChoice: 2,
    when: requestOnly,
    text: () => 'Beijing signals it would accept mutual restraint on frontier AI — with verification on parity terms. Washington asks where you stand.',
    choices: [
      ch('Verified talks', ['treaty', 'safety', 'dove'], P([L('approval', 8, 'bloc:hawks'), L('leadDays', 60, 'treaty slows all labs')], [L('chinaTension', 10), L('trust', 8, 'china')]), (s, ctx) => {
        s.gov.treaty = 'talks';
        s.flags['ws4:lobbyTreaty'] = true;
        bloc(s, ctx, 'hawks', -8, 5, 'E23 verified talks');
        bloc(s, ctx, 'safety', 8, 0, 'E23 verified talks');
        trust(s, ctx, 'china', 8, 'E23 verified talks');
        ctx.bump('china.meters.verificationWillingness', 10, 'E23 verified talks');
        ws4(s).usProposedTalks = true;
      }),
      ch('Narrow channel', ['balanced', 'dove'], P([L('approval', 3, 'bloc:hawks')], [L('chinaTension', 4), L('trust', 3, 'china')]), (s, ctx) => {
        if (s.gov.treaty === 'none') s.gov.treaty = 'restraint';
        ctx.bump('china.meters.normsDiplomacy', 5, 'E23 incident channel');
        trust(s, ctx, 'china', 3, 'E23 narrow channel');
      }),
      ch('Reject', ['hawk', 'race'], P([L('chinaTension', 10)], [L('approval', 5, 'bloc:hawks')]), (s, ctx) => {
        ws4(s).treatyRejected = true;
        ctx.bump('china.meters.taiwanTension', 10, 'E23 rejected');
        bloc(s, ctx, 'hawks', 5, 0, 'E23 rejected');
      }),
    ],
  }),
  ev({
    id: 'E24', title: 'Taiwan crisis', icon: 'china', crisis: true, deadlineDays: 7, defaultChoice: 2,
    when: requestOnly,
    text: () => 'Chinese forces have begun "inspections" of shipping around Taiwan. TSMC output is cut; chip prices are jumping.',
    choices: [
      ch('Non-TW chips', ['spend'], P([L('cash', 1, '+30% price')], [L('compute', 10, '% kept')]), (s, ctx) => {
        cash(ctx, -1, 'E24 non-Taiwan allocation');
        s.flags['ws4:nonTW'] = true;
      }),
      ch('Lobby escalation', ['hawk'], P([L('chinaTension', 10)], [L('approval', 6, 'bloc:hawks')]), (s, ctx) => {
        bloc(s, ctx, 'hawks', 6, 0, 'E24');
        ctx.bump('china.meters.taiwanTension', 10, 'E24 escalation');
      }),
      ch('Weather it', ['decline'], P([L('compute', 20, '% supply cut')], [L('cash', 0.1, 'no premium paid')]), () => {}),
    ],
  }),
];
