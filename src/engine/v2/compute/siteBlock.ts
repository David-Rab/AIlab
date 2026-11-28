// A blocked site's own actions (OUTSIDE-WORLD §8.2: E27 "Site blocked" is no event any more): Community deal, Relocate,
// Sue, on the site's row in the Compute panel. The site stays blocked until the player acts. Owner: WS4.
import type { ActionDef, GameStateV2, Site } from '../types';
import { strParam } from '../core/actionDef';
import { cash, L, pv } from '../actors/fx';
import { COMMUNITY } from '../../../data/v2/deals';
import { reactiveUnblockOdds } from './sites';

/** The odds a suit against a local block wins [D] (the old courts' check at its start value 40). */
const SUIT_WIN_ODDS = 0.4;
/** What relocating costs ($B) and how long the new site takes from scratch (days) [D]. */
const RELOCATE = { cash: 1, days: 365 } as const;
/** Cost of a suit ($B). */
const SUIT_COST = 0.05;
/** After a won suit the site goes back to permits for this many days. */
const SUIT_PERMIT_DAYS = 60;

const siteOf = (s: GameStateV2, p: Record<string, number | string | boolean>): Site | undefined => s.player.sites.find((x) => x.id === strParam(p, 'siteId', ''));
const blockedOf = (s: GameStateV2, p: Record<string, number | string | boolean>) => { const x = siteOf(s, p); return x && x.stage === 'blocked' ? x : undefined; };
const open = (s: GameStateV2): boolean | string => (s.player.status !== 'active' ? 'Company inactive' : s.player.sites.some((x) => x.stage === 'blocked') ? true : 'No site is blocked');
const first = (s: GameStateV2) => s.player.sites.find((x) => x.stage === 'blocked');
/** Test and preview fallback: no siteId = the first blocked site. */
const subject = (s: GameStateV2, p: Record<string, number | string | boolean>) => blockedOf(s, p) ?? (strParam(p, 'siteId', '') === '' ? first(s) : undefined);

/** Reactive package: ≈ 15% of the blocked site's capex [D] (at least $0.1B). */
export const reactivePackageCost = (x?: Site) => Math.max(0.1, COMMUNITY.reactive * (x?.capex ?? 0));

const deal: ActionDef = {
  id: 'SITE_DEAL', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS4', title: 'Community deal',
  available: open,
  preview(s, p) {
    const x = subject(s, p);
    const odds = Math.round(reactiveUnblockOdds(s) * 100) / 100;
    const H = x ? (x.mw * 1000) / s.power.kWPerH100e : 0;
    return pv([L('cash', reactivePackageCost(x)), L('leadDays', COMMUNITY.reactiveDelayQ * 91, `+${COMMUNITY.reactiveDelayQ} quarters`)],
      [L('compute', H, 'site unblocked', { probability: odds })],
      [L('cash', reactivePackageCost(x), 'package lost if the town still says no', { probability: Math.round((1 - odds) * 100) / 100 })]);
  },
  apply(s, ctx, p) {
    const x = blockedOf(s, p);
    if (!x) return 'The site is not blocked';
    cash(s, ctx, -reactivePackageCost(x), 'Community package after a block', x.name);
    x.communityPackage = true;
    x.stage = 'permitting';
    x.stageEndDay = ctx.day + COMMUNITY.reactiveDelayQ * 91;
    x.ws3.rolled = false;
    x.ws3.reactive = true;
  },
};

const relocate: ActionDef = {
  id: 'SITE_MOVE', verb: 'respond', system: 'compute', sphere: 'finance', owner: 'WS4', title: 'Relocate',
  available: open,
  preview: () => pv([L('cash', RELOCATE.cash), L('leadDays', RELOCATE.days, 'new site from scratch')]),
  apply(s, ctx, p) {
    const x = blockedOf(s, p);
    if (!x) return 'The site is not blocked';
    cash(s, ctx, -RELOCATE.cash, 'Relocation after a block', x.name);
    x.stage = 'permitting';
    x.stageEndDay = ctx.day + RELOCATE.days;
  },
};

const sue: ActionDef = {
  id: 'SITE_SUE', verb: 'respond', system: 'compute', sphere: 'finance', owner: 'WS4', title: 'Sue',
  available: (s) => (s.player.sites.some((x) => x.stage === 'blocked' && !x.sued) ? open(s) : 'No blocked site left to sue over'),
  preview: () => pv([L('cash', SUIT_COST)], [L('leadDays', 90, 'site back in permits', { probability: SUIT_WIN_ODDS })]),
  apply(s, ctx, p) {
    const x = blockedOf(s, p);
    if (!x) return 'The site is not blocked';
    if (x.sued) return 'You already lost a suit over this site';
    x.sued = true;
    cash(s, ctx, -SUIT_COST, 'Suit against a local block', x.name);
    if (ctx.rng('events').chance(SUIT_WIN_ODDS)) {
      x.stage = 'permitting';
      x.stageEndDay = ctx.day + SUIT_PERMIT_DAYS;
    }
  },
};

export const SITE_BLOCK_ACTIONS: ActionDef[] = [deal, relocate, sue];
