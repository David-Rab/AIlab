// Compute capacity and fleet forecast for the Compute panel (design/ux/COMPUTE.md). Read-only; uses only state the
// player can see (schedules, stages, odds), never a future roll. Owner: WS3.
import { dayOfQuarter, quarterIndex } from '../core/time';
import type { EngineSystem, GameStateV2, Site } from '../types';
import { siteCapacityH, siteLiveMW } from './power';
import { oppositionOdds } from './sites';

/** kW per H100e falls ×0.944 each quarter (sitesQ). */
const KW_STEP = 0.944;

/** Delivered chips split by whether today's free rack space can take them. Installation runs at the next quarter. */
export interface ChipFit { installed: number; installing: number; idle: number; free: number }

/** Delivered chips with no rack space (UI "idle"). Chips that fit and wait for next quarter's install are not idle. */
export const idleChips = (s: GameStateV2) => chipFit(s).idle;

export function chipFit(s: GameStateV2): ChipFit {
  let installed = 0;
  let free = 0;
  for (const x of s.player.sites) {
    if (x.stage !== 'live') continue;
    const cap = siteCapacityH(s, siteLiveMW(x, s.time.day));
    installed += Math.min(x.installed, cap);
    free += Math.max(0, cap - x.installed);
  }
  const inv = s.player.finance.ws3?.inventory;
  const waiting = inv ? inv.ready + inv.transit : 0;
  const installing = Math.min(waiting, free);
  return { installed, installing, idle: waiting - installing, free: free - installing };
}

/** Expected quarter each building of a site goes live (one entry per building, first to last), and whether the dates
 *  are firm (the opposition roll is done). Permits end, then building k is live max(power, construction + k) later
 *  (DATACENTERS §3, §5b); after the roll the planned go-live days are stored (ws3.liveDays). */
export function siteBuildingLiveQs(s: GameStateV2, x: Site): { qs: number[]; firm: boolean } | undefined {
  const start = s.time.startDate;
  const day = s.time.day;
  const q0 = quarterIndex(start, day);
  const qi = (d: number) => quarterIndex(start, d);
  const days = x.ws3.liveDays;
  if (x.stage === 'blocked') return undefined;
  if (x.stage === 'live') {
    const first = Math.min(q0, qi(x.ws3.liveDay ?? 0));
    if (!days || days.length <= 1) return { qs: [first], firm: true };
    return { qs: days.map((d, k) => (k === 0 ? first : d <= day ? Math.min(q0, qi(d)) : Math.max(q0, qi(d)))), firm: true };
  }
  const firm = x.ws3.rolled;
  const endQ = Math.max(q0, qi(x.stageEndDay));
  if (x.path === 'rent') return { qs: [endQ], firm };
  if (x.stage === 'permitting') return { qs: Array.from({ length: x.ws3.buildings ?? 1 }, (_, k) => endQ + Math.max(x.ws3.buildQ + k, x.ws3.powerQ)), firm };
  if (days) return { qs: days.map((d) => Math.max(q0, qi(d))), firm };
  const liveAt = x.ws3.liveAt;
  if (liveAt !== undefined) return { qs: [Math.max(q0, qi(liveAt))], firm };
  // a start site with no stored schedule: building ends at stageEndDay; a power stage is followed by construction
  return { qs: [x.stage === 'building' ? endQ : endQ + x.ws3.buildQ], firm };
}

/** Expected quarter a site's first building goes live, and whether that date is firm (siteBuildingLiveQs). */
export function siteLiveQ(s: GameStateV2, x: Site): { q: number; firm: boolean } | undefined {
  const l = siteBuildingLiveQs(s, x);
  return l ? { q: l.qs[0], firm: l.firm } : undefined;
}

/** MW of one building of a site (a site without a campus record is one building). */
const buildingMWOf = (x: Site, n: number) => x.ws3.buildingMW ?? x.mw / n;

/** A site's bars on the Sites rows (quarter indices): permits, power wait and construction, planned by the same rules
 *  as siteLiveQ. `liveQ`: the first building; a campus whose buildings go live over several quarters also has
 *  `lastLiveQ`, and its construction bar runs to it. Undefined for a blocked site. */
export interface SiteBars { permits?: [number, number]; power?: [number, number]; construction?: [number, number]; liveQ: number; lastLiveQ?: number; firm: boolean }
export function siteBars(s: GameStateV2, x: Site): SiteBars | undefined {
  const ls = siteBuildingLiveQs(s, x);
  if (!ls) return undefined;
  const l = { q: ls.qs[0], firm: ls.firm };
  const lastQ = ls.qs[ls.qs.length - 1];
  const start = s.time.startDate;
  const qi = (d: number) => quarterIndex(start, d);
  const w = x.ws3;
  const startQ = qi(w.startDay);
  const out: SiteBars = { liveQ: l.q, firm: l.firm, ...(lastQ > l.q ? { lastLiveQ: lastQ } : {}) };
  if (x.path === 'rent') {
    if (l.q > startQ) out.power = [startQ, l.q];
    return out;
  }
  const permitEnd = x.stage === 'permitting' ? Math.max(qi(s.time.day), qi(x.stageEndDay)) : w.powerDay !== undefined ? qi(w.powerDay) - w.powerQ : undefined;
  if (permitEnd !== undefined) {
    if (permitEnd > startQ) out.permits = [startQ, permitEnd];
    if (w.powerQ > 0) out.power = [permitEnd, permitEnd + w.powerQ];
  }
  const buildFrom = (x.stage === 'building' || x.stage === 'live') && w.buildStartDay !== undefined ? qi(w.buildStartDay) : x.stage === 'live' ? undefined : l.q - w.buildQ;
  if (buildFrom !== undefined && w.buildQ > 0) out.construction = [buildFrom, lastQ];
  return out;
}

/** siteLive: `mw` and `h` are what goes live that quarter; a campus also says how many of its buildings are live after
 *  it (`live` of `of`). */
export type ForecastEvent =
  | { kind: 'siteLive'; name: string; mw: number; h: number; firm: boolean; block: number; buildings?: { live: number; of: number } }
  | { kind: 'delivery'; h: number }
  | { kind: 'cloudStart' | 'cloudEnd'; name: string; h: number };

export interface ForecastQ {
  /** Quarter index (Q3 2025 = 0). */
  q: number;
  now: boolean;
  /** A recorded past quarter (end-of-quarter snapshot). */
  past?: boolean;
  /** Owned racks (H100e that fit in live sites at that quarter's kW per H100e). */
  racks: number;
  cloud: number;
  /** Owned chips running in racks. */
  running: number;
  /** Chips that arrived and fit in free racks; online next quarter. */
  installing: number;
  /** Chips with no rack space. */
  idle: number;
  /** Racks with no chips. */
  empty: number;
  events: ForecastEvent[];
}

/** Current quarter plus `ahead` quarters. Assumes open orders fill in full and sites go live at their expected date. */
export function computeForecast(s: GameStateV2, ahead = 10): { quarters: ForecastQ[]; later: { q: number; ev: ForecastEvent }[] } {
  const start = s.time.startDate;
  const day = s.time.day;
  const q0 = quarterIndex(start, day);
  const kW0 = s.power.kWPerH100e;
  const fit = chipFit(s);
  const inv = s.player.finance.ws3?.inventory ?? { ready: 0, transit: 0 };

  // deliveries per future quarter (backlog of past-due orders arrives next quarter)
  const deliveries = new Map<number, number>();
  const addDel = (q: number, h: number) => deliveries.set(q, (deliveries.get(q) ?? 0) + h);
  for (const o of s.player.orders) {
    const left = o.qty - o.delivered;
    const first = Math.max(o.dueQ, q0 + 1);
    if (left > 1) addDel(first, left);
    if (o.kind === 'lta') for (let q = first + 1; q < (o.ltaEndQ ?? 0); q++) addDel(q, o.qty);
  }
  const lives = s.player.sites.map((x) => ({ x, l: siteBuildingLiveQs(s, x) })).filter((y): y is { x: Site; l: { qs: number[]; firm: boolean } } => !!y.l);
  /** A site's siteLive event for quarter `q` (undefined if none of its buildings goes live then). */
  const liveEvent = (x: Site, l: { qs: number[]; firm: boolean }, q: number, kW: number): ForecastEvent | undefined => {
    const n = l.qs.length;
    const now = l.qs.filter((y) => y === q).length;
    if (now === 0) return undefined;
    const mw = buildingMWOf(x, n) * now;
    const camp = n > 1 ? { buildings: { live: l.qs.filter((y) => y <= q).length, of: n } } : {};
    return { kind: 'siteLive', name: x.name, mw, h: (mw * 1000) / kW, firm: l.firm, block: x.ws3.rolled ? 0 : oppositionOdds(s, x).block, ...camp };
  };

  const quarters: ForecastQ[] = [];
  let pool = fit.installed + inv.ready; // chips that can be installed at quarter k ≥ 1 (before that quarter's deliveries)
  pool += inv.transit;
  for (let k = 0; k <= ahead; k++) {
    const q = q0 + k;
    const qDay = k === 0 ? day : dayOfQuarter(start, q);
    const kW = kW0 * Math.pow(KW_STEP, k);
    let racks = 0;
    const events: ForecastEvent[] = [];
    for (const { x, l } of lives) {
      const bmw = buildingMWOf(x, l.qs.length);
      for (const bq of l.qs) if (bq <= q) racks += (bmw * 1000) / kW;
      const ev = k > 0 ? liveEvent(x, l, q, kW) : undefined;
      if (ev) events.push(ev);
    }
    let cloud = 0;
    for (const c of s.player.cloud) {
      if (c.startDay <= qDay && c.endDay > qDay) cloud += c.h100e;
      if (k > 0) {
        const prev = dayOfQuarter(start, q - 1);
        if (c.startDay > prev && c.startDay <= qDay) events.push({ kind: 'cloudStart', name: c.provider, h: c.h100e });
        if (c.endDay > prev && c.endDay <= qDay) events.push({ kind: 'cloudEnd', name: c.provider, h: c.h100e });
      }
    }
    if (k === 0) for (const r of s.player.finance.ws3?.rentals ?? []) if (r.endDay > day) cloud += r.h100e;
    if (k === 0) {
      quarters.push({ q, now: true, racks: Math.max(racks, fit.installed), cloud, running: fit.installed, installing: fit.installing, idle: fit.idle, empty: fit.free, events });
      continue;
    }
    const running = Math.min(pool, racks);
    const arriving = deliveries.get(q) ?? 0;
    if (arriving > 0) events.push({ kind: 'delivery', h: arriving });
    const installing = Math.min(arriving, racks - running);
    const idle = pool - running + arriving - installing;
    quarters.push({ q, now: false, racks, cloud, running, installing, idle, empty: Math.max(0, racks - running - installing), events });
    pool += arriving;
  }
  const last = q0 + ahead;
  const later: { q: number; ev: ForecastEvent }[] = [];
  for (const { x, l } of lives) for (const bq of [...new Set(l.qs)]) if (bq > last) later.push({ q: bq, ev: liveEvent(x, l, bq, kW0 * Math.pow(KW_STEP, bq - q0))! });
  for (const c of s.player.cloud) {
    const eq = quarterIndex(start, c.endDay);
    if (eq > last && c.endDay > day) later.push({ q: eq, ev: { kind: 'cloudEnd', name: c.provider, h: c.h100e } });
  }
  later.sort((a, b) => a.q - b.q);
  return { quarters, later };
}

/** Recorded past quarters (oldest first, at most `n`), in the forecast's shape. */
export function computeHistory(s: GameStateV2, n = 4): ForecastQ[] {
  const q0 = quarterIndex(s.time.startDate, s.time.day);
  return (s.player.finance.ws3?.computeHist ?? [])
    .filter((h) => h.q < q0)
    .slice(-n)
    .map((h) => ({ ...h, now: false, past: true, empty: Math.max(0, h.racks - h.running - h.installing), events: [] }));
}

/** computeHistQ (399, quarterly): snapshot the quarter that just ended, before this quarter's deliveries and installs. */
export const computeHistQSystem: EngineSystem = {
  id: 'computeHistQ', owner: 'WS3', cadence: 'quarterly', order: 399, system: 'compute',
  run(s) {
    const fx = s.player.finance.ws3;
    if (!fx || s.time.day === 0) return;
    const fit = chipFit(s);
    const end = s.time.day - 1;
    let racks = 0;
    for (const x of s.player.sites) if (x.stage === 'live') racks += siteCapacityH(s, siteLiveMW(x, end));
    let cloud = 0;
    for (const c of s.player.cloud) if (c.startDay <= end && c.endDay > end) cloud += c.h100e;
    for (const r of fx.rentals) if (r.endDay > end) cloud += r.h100e;
    const hist = (fx.computeHist ??= []);
    hist.push({ q: quarterIndex(s.time.startDate, end), racks, cloud, running: fit.installed, installing: fit.installing, idle: fit.idle });
    if (hist.length > 8) hist.splice(0, hist.length - 8);
  },
};
