// Event catalog: company decisions (V2-SPEC §4.2: E16, E27). Owner: WS4 (content shared with WS3). Every cash effect
// goes through WS3's ledger. FIN3b dropped WS3's E37 "Board revolt" (FINANCE-V3 §10): the ouster vote is always on the
// Board card and giving the critics a seat is a standing action.
import { activeRivals } from '../../models/labs';
import type { EventDefV2 } from '../../types';
import { bloc, cash, morale, rivalMeter, scrutiny, trust } from '../../actors/fx';
import { paceOf } from '../../actors/rivals';
import { addRivalKnowledge } from '../../actors/rivalModel';
import { B_G_PER_Y } from '../../../../data/v2/runDesign';
import { changeHeads } from '../../departments/teams';
import { L, P, activeLab, ch, ev, labName } from '../kit';
import { COMMUNITY } from '../../../../data/v2/deals';
import { reactiveUnblockOdds } from '../../compute/sites';
import type { GameStateV2, Site } from '../../types';

/** E27 reactive package: ≈ 15% of the blocked site's capex [D] (at least $0.1B). */
/** The blocked site E27 is about (the first one not yet decided). */
const blockedSite = (s: GameStateV2) => s.player.sites.find((y) => y.stage === 'blocked' && !s.flags[`ws4:site:${y.id}`]);
const reactivePackageCost = (x?: Site) => Math.max(0.1, COMMUNITY.reactive * (x?.capex ?? 0));

export const COMPANY_EVENTS: EventDefV2[] = [
  ev({
    id: 'E16', title: 'Talent raid', icon: 'rival', crisis: false, cooldown: 365, deadlineDays: 14, defaultChoice: 1,
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
        changeHeads(s, 'cap', -n);
        const r = activeLab(s, d.lab);
        if (r) {
          r.core.staff.cap += n;
          addRivalKnowledge(r, 0.1 * paceOf(s) * B_G_PER_Y);
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
      const x = blockedSite(s);
      return x ? { site: x.id } : false;
    },
    text: (s, d) => `Local opponents blocked your ${s.player.sites.find((x) => x.id === d.site)?.name ?? 'new'} data-centre site at the permitting stage.`,
    choices: [
      // FIN1 (spec §4): the large reactive package, ≈ 15% of the site's capex and a 2-quarter permit delay; the site is
      // re-permitted and unblocks with odds set by local opposition (compute/sites.ts reactiveUnblockOdds).
      ch('Community deal', ['spend', 'community'], (s) => {
        const x = blockedSite(s);
        const p = reactiveUnblockOdds(s);
        const H = x ? (x.mw * 1000) / s.power.kWPerH100e : 0;
        return { costs: [L('cash', reactivePackageCost(x)), L('leadDays', COMMUNITY.reactiveDelayQ * 91, `+${COMMUNITY.reactiveDelayQ} quarters`)], gains: [L('compute', H, 'site unblocked', { probability: Math.round(p * 100) / 100 }), L('approval', 6, 'bloc:ratepayers')], exposure: [L('cash', reactivePackageCost(x), 'package lost if the town still says no', { probability: Math.round((1 - p) * 100) / 100 })] };
      }, (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -reactivePackageCost(x), 'E27 community package', x?.name);
        bloc(s, ctx, 'ratepayers', 6, 0, 'E27');
        if (x) {
          x.communityPackage = true;
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + COMMUNITY.reactiveDelayQ * 91;
          x.ws3.rolled = false;
          x.ws3.reactive = true;
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
];
