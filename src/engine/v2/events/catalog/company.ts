// Event catalog: company decisions (V2-SPEC §4.2: E27; E16 cut, spec §8.2). Owner: WS4 (content shared with WS3). Every cash effect
// goes through WS3's ledger. FIN3b dropped WS3's E37 "Board revolt" (FINANCE-V3 §10): the ouster vote is always on the
// Board card and giving the critics a seat is a standing action.
import type { EventDefV2 } from '../../types';
import { cash } from '../../actors/fx';
import { L, P, ch, ev } from '../kit';
import { COMMUNITY } from '../../../../data/v2/deals';
import { reactiveUnblockOdds } from '../../compute/sites';
import type { GameStateV2, Site } from '../../types';

/** E27 reactive package: ≈ 15% of the blocked site's capex [D] (at least $0.1B). */
/** The blocked site E27 is about (the first one not yet decided). */
const blockedSite = (s: GameStateV2) => s.player.sites.find((y) => y.stage === 'blocked' && !s.flags[`ws4:site:${y.id}`]);
const reactivePackageCost = (x?: Site) => Math.max(0.1, COMMUNITY.reactive * (x?.capex ?? 0));

export const COMPANY_EVENTS: EventDefV2[] = [
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
        return { costs: [L('cash', reactivePackageCost(x)), L('leadDays', COMMUNITY.reactiveDelayQ * 91, `+${COMMUNITY.reactiveDelayQ} quarters`)], gains: [L('compute', H, 'site unblocked', { probability: Math.round(p * 100) / 100 })], exposure: [L('cash', reactivePackageCost(x), 'package lost if the town still says no', { probability: Math.round((1 - p) * 100) / 100 })] };
      }, (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -reactivePackageCost(x), 'E27 community package', x?.name);
        if (x) {
          x.communityPackage = true;
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + COMMUNITY.reactiveDelayQ * 91;
          x.ws3.rolled = false;
          x.ws3.reactive = true;
        }
      }),
      ch('Relocate', ['spend'], P([L('cash', 1), L('leadDays', 365, 'new site from scratch')]), (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -1, 'E27 relocation');
        if (x) {
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + 365;
        }
      }),
      ch('Sue', ['fight'], (s) => ({ costs: [L('cash', 0.05)], gains: [L('leadDays', 90, undefined, { probability: s.gov.judicialCheck / 100 })], exposure: [] }), (s, ctx, d) => {
        const x = s.player.sites.find((y) => y.id === d.site);
        s.flags[`ws4:site:${d.site}`] = true;
        cash(s, ctx, -0.05, 'E27 suit');
        if (x && ctx.rng('events').chance(s.gov.judicialCheck / 100)) {
          x.stage = 'permitting';
          x.stageEndDay = ctx.day + 60;
        }
      }),
    ],
  }),
];
