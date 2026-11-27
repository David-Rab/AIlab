// World waits for power and halls (DATACENTERS.md §4, DC-TASKS [D-1]..[D-3]). Pure functions, no queue state:
// the outside world is a reference path, so with the player building nothing the wait equals the §4 table, and
// every GW the player has in a queue adds 4 / rate quarters.
import { WAIT_RATE, WAIT_REF, type SiteSource } from '../../../data/v2/deals';
import { decimalYear } from '../core/time';
import type { GameStateV2 } from '../types';

/** A site as the queues see it (structural, so this compiles before and after DC-3). */
export interface QueueSite { path: string; mw: number; stage: string; ws3: { powerDay?: number; rush?: boolean } }

/** Wait with the player building nothing: WAIT_REF, linear between 1 January points, flat outside 2023-2030. */
export function refWaitQ(src: SiteSource, year: number): number {
  const ys = WAIT_REF.years, vs: readonly number[] = WAIT_REF[src];
  if (year <= ys[0]) return vs[0];
  const last = ys.length - 1;
  if (year >= ys[last]) return vs[last];
  const i = Math.floor(year) - ys[0];
  const f = year - ys[i];
  return vs[i] + (vs[i + 1] - vs[i]) * f;
}

/** What clears the queue, GW per year: gwPerYear2026 x growth^(year - 2026). */
export function rateGWPerYear(src: SiteSource, year: number): number {
  const r = WAIT_RATE[src];
  return r.gwPerYear2026 * Math.pow(r.growth, year - 2026);
}

/** GW already waiting outside the player's lab: refWaitQ x rate / 4. */
export function outsideGW(src: SiteSource, year: number): number {
  return refWaitQ(src, year) * rateGWPerYear(src, year) / 4;
}

/** The player's sites as queue sites. The cast is needed only until DC-3 adds `powerDay` and `rush` to SiteWS3 (TypeScript
 *  rejects a type with no property in common with the all-optional ws3 shape); until then both read as undefined. */
const queueSites = (s: GameStateV2) => s.player.sites as unknown as readonly (QueueSite & { name: string })[];

/** Is this site in its source's queue on `day`? Rent: every rent site not live (blocked ones drop out). Grid and gas:
 *  until the site's power is ready (`powerDay`); rushed gas sites use used turbines and are not in the backlog [D-5]. */
function inQueue(site: QueueSite, src: SiteSource, day: number): boolean {
  if (site.path !== src) return false;
  if (site.stage === 'live' || site.stage === 'blocked') return false;
  if (src === 'gas' && site.ws3.rush) return false;
  if (src === 'rent') return true;
  const pd = site.ws3.powerDay;
  return pd === undefined || pd > day;
}

/** Your GW in the queue on `day`. */
export function pendingGW(sites: readonly QueueSite[], src: SiteSource, day: number): number {
  let gw = 0;
  for (const s of sites) if (inQueue(s, src, day)) gw += s.mw / 1000;
  return gw;
}

/** Wait in quarters with `yourGW` of yours in the queue: refWaitQ + 4 x yourGW / rate (= 4 x (outside + yours) / rate). */
export function waitQ(src: SiteSource, year: number, yourGW: number): number {
  return refWaitQ(src, year) + 4 * yourGW / rateGWPerYear(src, year);
}

/** Today's wait for a new site on `src`, before it is added. */
export function worldWaitQ(s: GameStateV2, src: SiteSource): number {
  return waitQ(src, decimalYear(s), pendingGW(queueSites(s), src, s.time.day));
}

export interface WaitBreakdown {
  src: SiteSource;
  waitQ: number;
  /** The wait with nothing of yours in the queue. */
  refQ: number;
  youGW: number;
  /** Your sites in the queue. */
  you: { name: string; gw: number }[];
  /** Everyone else's GW in the queue: one row, no split by lab [D-11]. */
  othersGW: number;
  rateGWPerYear: number;
  /** What +1 GW of yours adds, quarters. */
  perGWQ: number;
}

export function waitBreakdown(s: GameStateV2, src: SiteSource): WaitBreakdown {
  const year = decimalYear(s), day = s.time.day;
  const you = queueSites(s).filter((x) => inQueue(x, src, day)).map((x) => ({ name: x.name, gw: x.mw / 1000 }));
  const youGW = you.reduce((a, x) => a + x.gw, 0);
  const rate = rateGWPerYear(src, year);
  return { src, waitQ: waitQ(src, year, youGW), refQ: refWaitQ(src, year), youGW, you,
    othersGW: outsideGW(src, year), rateGWPerYear: rate, perGWQ: 4 / rate };
}
