// Event catalog: company decisions (V2-SPEC §4.2: E02, E03, E04, E16, E26, E27, E28, E36). Owner: WS4 (content
// shared with WS3). The finance decisions E02 (recapitalisation), E03/E04 (partner offers) and E26 (distress menu)
// are WS3's FINANCE_EVENTS (finance/events.ts): their choices run the finance ActionDefs, so previews and effects
// match the Finance panel. WS4 only lists them here; every cash effect goes through WS3's ledger.
import { clamp } from '../../../rng';
import { FINANCE_EVENTS } from '../../finance/events';
import { activeRivals } from '../../models/labs';
import type { EventDefV2 } from '../../types';
import { bloc, cash, morale, rivalMeter, scrutiny, trust } from '../../actors/fx';
import { paceOf } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { L, P, activeLab, ch, ev, labName, requestOnly } from '../kit';

export const COMPANY_EVENTS: EventDefV2[] = [
  ...FINANCE_EVENTS,
  ev({
    id: 'E16', title: 'Talent raid', icon: 'rival', crisis: false, cooldown: 180, deadlineDays: 14, defaultChoice: 1,
    when: (s) => {
      if (s.player.morale.overall >= 60) return false;
      const r = activeRivals(s).find((x) => x.meters.poachAggression > 60);
      return r ? { lab: r.core.id } : false;
    },
    text: (s, d) => `${labName(s, d.lab)} is offering your researchers double pay. Morale is low; a team is ready to leave.`,
    choices: [
      ch('Counter-offer', ['spend', 'retain'], P([L('cash', 1)], [L('morale', 5), L('talent', 2)]), (s, ctx) => {
        cash(s, ctx, -1, 'E16 counter-offers');
        morale(ctx, 5, 'E16 counter-offers');
        ctx.bump('relations.talentPull', 2, 'E16 counter-offers');
      }),
      ch('Let go', ['decline'], () => ({ costs: [L('staffTime', 3, '3% of capabilities staff'), L('leadDays', 36, 'that rival closes 0.1 y')], gains: [L('cash', 0.1, 'payroll saved')], exposure: [] }), (s, _ctx, d) => {
        const n = Math.round(s.player.staff.cap * 0.03);
        s.player.staff.cap -= n;
        const r = activeLab(s, d.lab);
        if (r) {
          r.core.staff.cap += n;
          r.core.pa += 0.1 * paceOf(s);
        }
      }),
      ch('Sue', ['fight'], P([L('scrutiny', 5), L('trust', 20, 'that rival')], [L('cash', 0.2, undefined, { probability: 0.4 })]), (s, ctx, d) => {
        scrutiny(ctx, 5, 'E16 poaching suit');
        if (typeof d.lab === 'string') {
          rivalMeter(s, ctx, d.lab, 'cooperation', -20, 'E16 suit');
          trust(s, ctx, `rival:${d.lab}`, -8, 'E16 suit');
        }
        if (ctx.rng('events').chance(0.4)) cash(s, ctx, 0.2, 'E16 suit won');
      }),
    ],
  }),
  ev({
    id: 'E27', title: 'Site blocked', icon: 'company', crisis: false, cooldown: 60, deadlineDays: 30, defaultChoice: 0,
    when: (s) => {
      const x = s.player.sites.find((y) => y.stage === 'blocked' && !s.flags[`ws4:site:${y.id}`]);
      return x ? { site: x.id } : false;
    },
    text: (s, d) => `Local opponents blocked your ${s.player.sites.find((x) => x.id === d.site)?.name ?? 'new'} data-centre site at the permitting stage.`,
    choices: [
      ch('Community deal', ['spend', 'community'], P([L('cash', 0.5), L('leadDays', 182, '+2 quarters')], [L('approval', 6, 'bloc:ratepayers')]), (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -0.5, 'E27 community package');
        bloc(s, ctx, 'ratepayers', 6, 0, 'E27');
        if (x) {
          x.communityPackage = true;
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + 182;
        }
      }),
      ch('Relocate', ['spend'], P([L('cash', 1), L('leadDays', 365, 'new site from scratch')], [L('approval', 2, 'bloc:ratepayers')]), (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -1, 'E27 relocation');
        if (x) {
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + 365;
        }
      }),
      ch('Sue', ['fight'], (s) => ({ costs: [L('approval', 8, 'bloc:ratepayers'), L('cash', 0.05)], gains: [L('leadDays', 90, undefined, { probability: s.gov.judicialCheck / 100 })], exposure: [] }), (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -0.05, 'E27 suit');
        bloc(s, ctx, 'ratepayers', -8, 10, 'E27 suit');
        if (x && ctx.rng('events').chance(s.gov.judicialCheck / 100)) {
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + 60;
        }
      }),
    ],
  }),
  ev({
    id: 'E28', title: 'Copyright suit', icon: 'company', crisis: false, cooldown: 365, deadlineDays: 30, defaultChoice: 1,
    when: requestOnly,
    text: (s) => `Authors and publishers sue over ${Math.round(s.player.dataAssets.unlicensedTokensT)}T tokens of unlicensed training data. The last comparable case settled for $1.5B.`,
    choices: [
      ch('Settle', ['spend'], (s) => ({ costs: [L('cash', Math.round(1.5 * clamp(s.player.dataAssets.unlicensedTokensT / 270, 0.2, 3) * 10) / 10)], gains: [L('approval', 5, 'bloc:creatives')], exposure: [] }), (s, ctx) => {
        cash(s, ctx, -1.5 * clamp(s.player.dataAssets.unlicensedTokensT / 270, 0.2, 3), 'E28 settlement');
        bloc(s, ctx, 'creatives', 5, 0, 'E28');
      }),
      ch('Fight', ['fight'], P([L('cash', 0.1, 'legal'), L('progress', 0.2, 'data destroyed', { probability: 0.3 })], [L('cash', 1.5, 'no settlement', { probability: 0.7 })]), (s, ctx) => {
        cash(s, ctx, -0.1, 'E28 legal fees');
        if (ctx.rng('events').chance(0.3)) {
          s.flags['ws4:dataDestroyed'] = true;
          ctx.log('company', 'Court orders the disputed training data destroyed.', 3);
        }
      }),
      ch('License forward', ['spend', 'community'], P([L('cash', 0.5, 'per year')], [L('approval', 8, 'bloc:creatives')]), (s, ctx) => {
        cash(s, ctx, -0.5, 'E28 licences');
        const d = s.player.dataAssets;
        d.licensedTokensT += d.unlicensedTokensT * 0.5;
        d.unlicensedTokensT *= 0.5;
        d.litigationRisk = 0;
        bloc(s, ctx, 'creatives', 8, 0, 'E28');
      }),
    ],
  }),
  ev({
    id: 'E36', title: 'Capacity crunch', icon: 'company', crisis: false, cooldown: 120, deadlineDays: 14, defaultChoice: 2,
    when: (s) => ws4(s).crunchDays >= 30 && {},
    text: () => 'Demand has outrun serving capacity by over 30% for a month. Customers are hitting rate limits.',
    choices: [
      ch('Buy cloud', ['spend', 'race'], P([L('cash', 1)], [L('revenue', 1), L('compute', 5, '%')]), (s, ctx) => {
        cash(s, ctx, -1, 'E36 emergency cloud');
        ws4(s).crunchDays = 0;
      }),
      ch('Raise price', ['finance'], P([L('approval', 1)], [L('revenue', 0.5)]), (s, ctx) => {
        for (const d of s.player.deployments) if (d.status === 'live' && d.channel !== 'internal') d.priceIndex = Math.min(2, d.priceIndex * 1.2);
        ctx.bump('pub.approval', -1, 'E36 price rise');
        ws4(s).crunchDays = 0;
      }),
      ch('Ration', ['decline'], P([L('approval', 3)], [L('cash', 0.1, 'no new spend')]), (s, ctx) => {
        ctx.bump('pub.approval', -3, 'E36 rationing');
        ws4(s).crunchDays = 0;
      }),
    ],
  }),
];
