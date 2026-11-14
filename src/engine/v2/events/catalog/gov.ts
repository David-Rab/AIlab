// Event catalog: government decisions (V2-SPEC §4.2: E07, E08, E12, E13, E20, E22, E29). Owner: WS4.
import { activeRivals, bestLg } from '../../models/labs';
import type { EventDefV2, GameStateV2 } from '../../types';
import { bloc, cash, cred, hasFavor, morale, moraleSafety, natPressure, scrutiny, secDemand, spendFavor, trust } from '../../actors/fx';
import { signCommitment } from '../../actors/commitments';
import { govPresetOf } from '../../actors/gov';
import { deactivateRival } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { L, P, ch, ev, measured, requestOnly } from '../kit';

const retaliationP = (s: GameStateV2) => (['dealmaker', 'hawk'].includes(govPresetOf(s.gov.preset).id) ? 0.35 : 0.1);

export const GOV_EVENTS: EventDefV2[] = [
  ev({
    id: 'E07', title: 'Defense contract', icon: 'gov', crisis: false, deadlineDays: 30, defaultChoice: 2,
    when: (s) => measured(s) >= 6.5 && s.gov.aiPriority > 55 && ws4(s).defenseContract === 'none' && {},
    text: () => 'The Pentagon wants your models for defense work. It asks for no limits on use — including surveillance and autonomous weapons.',
    choices: [
      ch('Unrestricted', ['race', 'gov', 'defense'], P([L('morale', 12, 'safety staff'), L('approval', 8, 'bloc:civlib'), L('freedom', 10, 'surveillance use')], [L('cash', 1), L('trust', 8, 'exec')]), (s, ctx) => {
        const w = ws4(s);
        w.defenseContract = 'unrestricted';
        w.unrestrictedDefense = true;
        cash(s, ctx, 1, 'E07 defense contract');
        trust(s, ctx, 'exec', 8, 'E07 defense contract');
        moraleSafety(ctx, -12, 'E07 defense contract');
        bloc(s, ctx, 'defense', 10, 0, 'E07');
        bloc(s, ctx, 'civlib', -8, 5, 'E07');
        ctx.bump('china.meters.hawkDove', 5, 'US lab joins defense work');
      }),
      ch('With limits', ['balanced', 'gov'], (s) => ({ costs: [L('revenue', 0.5, 'half the contract'), L('trust', 15, 'exec if retaliation', { probability: retaliationP(s) })], gains: [L('cash', 0.5), L('approval', 6, 'bloc:civlib')], exposure: [] }), (s, ctx) => {
        ws4(s).defenseContract = 'limits';
        cash(s, ctx, 0.5, 'E07 defense contract (limits)');
        signCommitment(s, ctx, 'usageRestriction', 'No mass surveillance or autonomous weapons', 'noSurveillance', {}, ['bloc:civlib', 'bloc:safety'], { trust: 6, credibility: 10 });
        bloc(s, ctx, 'civlib', 6, 0, 'E07');
        if (ctx.rng('events').chance(retaliationP(s))) {
          trust(s, ctx, 'exec', -5, 'retaliation: supply-chain-risk designation');
          s.flags['ws4:blacklisted'] = true;
          ctx.log('gov', 'The Pentagon labels you a supply-chain risk; your lawyers head to court.', 3);
          if (ctx.rng('events').chance(s.gov.judicialCheck / 100)) delete s.flags['ws4:blacklisted'];
        }
      }),
      ch('Decline', ['safety', 'decline'], P([L('trust', 10, 'exec')], [L('morale', 5, 'safety staff')]), (s, ctx) => {
        ws4(s).defenseContract = 'limits';
        trust(s, ctx, 'exec', -10, 'E07 declined defense work');
        moraleSafety(ctx, 5, 'E07 declined defense work');
      }),
    ],
  }),
  ev({
    id: 'E08', title: 'Briefing request', icon: 'gov', crisis: false, cooldown: 180, deadlineDays: 21, defaultChoice: 2,
    when: (s) => measured(s) >= 8.5 && s.player.policies.govBriefing < 2 && s.gov.awareness < 70 && {},
    text: () => 'The National Security Council asks for a full briefing on what your internal models can do. Officials suspect you are ahead of what you show.',
    choices: [
      ch('Full briefing', ['disclose', 'gov'], P([L('security', 15, 'security demand'), L('freedom', 2)], [L('trust', 10, 'exec')]), (s, ctx) => {
        s.player.policies.govBriefing = 2;
        trust(s, ctx, 'exec', 10, 'E08 full briefing');
        secDemand(ctx, 15, 'E08 full briefing');
        ctx.bump('gov.aiPriority', 5, 'E08 full briefing');
      }),
      ch('Partial', ['balanced', 'gov'], P([L('security', 5, 'security demand'), L('trust', 6, 'exec if gaps leak', { probability: 0.3 })], [L('trust', 3, 'exec')]), (s, ctx) => {
        s.player.policies.govBriefing = Math.max(1, s.player.policies.govBriefing) as 1 | 2 | 3;
        trust(s, ctx, 'exec', 3, 'E08 partial briefing');
        if (ctx.rng('events').chance(0.3)) ws4(s).leakedL = Math.max(ws4(s).leakedL, measured(s));
      }),
      ch('Decline', ['secrecy', 'decline'], P([L('trust', 8, 'exec'), L('freedom', 5, 'nationalisation +5')], [L('security', 0, 'gov sees less')]), (s, ctx) => {
        trust(s, ctx, 'exec', -8, 'E08 refused briefing');
        natPressure(ctx, 5, 'E08 refused briefing');
      }),
    ],
  }),
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
    id: 'E13', title: 'Allies want access', icon: 'gov', crisis: false, cooldown: 365, deadlineDays: 30, defaultChoice: 2,
    when: (s) => s.gov.rungSec >= 3 && !s.player.policies.shareWithAllies && {},
    text: () => 'The UK and EU want access to your frontier models. Washington\'s hawks fear it widens the leak surface to China.',
    choices: [
      ch('Share', ['cooperate'], P([L('approval', 5, 'bloc:hawks'), L('security', 0.2, 'theft intent +5')], [L('trust', 6, 'allies'), L('revenue', 0.3, 'EU/UK markets')]), (s, ctx) => {
        s.player.policies.shareWithAllies = true;
        bloc(s, ctx, 'hawks', -5, 0, 'E13');
        ctx.bump('china.theftIntent', 5, 'allied access widens leak surface');
        trust(s, ctx, 'evalGov', 4, 'E13 allied access');
      }),
      ch('Redacted', ['balanced'], P([L('security', 0.1), L('staffTime', 2)], [L('trust', 3, 'allies')]), (s, ctx) => {
        trust(s, ctx, 'evalGov', 2, 'E13 redacted access');
        ctx.bump('china.theftIntent', 2, 'allied access');
      }),
      ch('Refuse', ['secrecy', 'decline'], P([L('revenue', 0.3, 'EU/UK market access −', { lagDays: 120 })], [L('approval', 3, 'bloc:hawks')]), (s, ctx) => {
        bloc(s, ctx, 'hawks', 3, 0, 'E13');
        s.flags['ws4:alliesAngry'] = ctx.day;
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
      ch('Accept', ['race', 'gov', 'comply'], P([L('freedom', 15, 'government-held lab'), L('scrutiny', 10)], [L('compute', 50, '% more'), L('leadDays', 90)]), (s, ctx) => {
        const w = ws4(s);
        w.dpaAccepted = true;
        for (const r of activeRivals(s)) {
          w.absorbedCompute += r.core.computeOnline;
          s.player.staff.cap += Math.round(r.core.staff.cap * 0.5);
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
