// Product readouts and live-edit previews (STRUCTURE §4.4, BUILD-PLAN R6; mockup v3-products). Owner: WS5.
//
// Per product: revenue, customers (Chat: its weekly users, a stock; other products revenue ÷ revenue per customer), share
// of its segment's spend vs the best rival product, binding cause, serving need / served / cut, run cost, cost and price
// per work-hour (Chat: per subscriber-month) and margin, monitor overhead and catch rate (model v3 V4.2). A live edit is
// previewed by recomputing the market mix and revenue on a copy of the state with the edited product (pure; the edit
// itself applies at the next tick, D7), so the preview shows what the next tick will compute.
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { REGIONS, SECTORS } from '../../../data/v2/sectors';
import { catchRate, monitorOverhead } from '../models/products';
import { versionById } from '../models/labs';
import { markupOf, serveDollarsPerHour } from './serving';
import { CONSUMER_MKT, SERVE_HOURS_PER_YEAR } from '../../../data/v2/serving';
import type { Deployment, GameStateV2, Money } from '../types';
import { paidDeployments, worldMix, type WorldMix } from './mix';
import { consumerSpend, consumerUsers, revenueReadout, sectorSpend, type DeploymentRevenue, type RevenueReadout } from './revenue';

export interface ProductRead {
  id: string;
  channel: Deployment['channel'];
  revenue: Money;
  demand: Money;
  customers: number;
  /** Your share of the segment's spend, and the best rival product's. */
  share: number;
  rival?: { name: string; share: number };
  bound: NonNullable<Deployment['demandBound']>;
  /** Revenue per serving H100e-year ($, incl. monitor overhead). */
  rpH: number;
  needH100e: number;
  servedH100e: number;
  cutH100e: number;
  /** Unserved demand ($B/yr). */
  unserved: Money;
  /** Serving compute cost ($B/yr) at the rental price of an H100e. */
  runCost: Money;
  /** Cost and price per work-hour ($; Chat: per subscriber-month), margin 1 − cost/price, share sold at the value cap,
   *  AI work-hours a year asked for and servable (sector products), users and subscribers (Chat). */
  cost: number;
  price: number;
  margin: number;
  valueCapped: number;
  hours: number;
  capHours: number;
  users?: number;
  subs?: number;
  monitorOverhead: number;
  catchRate: number;
  /** B1: the price tier as a markup over cost, and the product's serving economics by source (DeploymentRevenue). */
  markup: number;
  econ: ProductEcon;
}

/** B1 (product card): revenue by source and capacity of one product. Sector products: adopted task-hours and agent-hours
 *  billed per hour, paid seats; Chat: weekly users, subscribers, paid share and its target, the going price and the
 *  willingness to pay; serving need split into seats / per-hour work or paying / free users. */
export interface ProductEcon {
  kind: 'sector' | 'chat';
  /** Demand by source ($B/yr; before the serving cut). */
  adoptedDemand: Money;
  agentDemand: Money;
  seatDemand: Money;
  adoptedHours: number;
  agentHours: number;
  /** Price per adopted task-hour and per agent-hour ($; demand-weighted). */
  adoptedPrice: number;
  agentPrice: number;
  seats: number;
  seatHours: number;
  seatPrice: number;
  seatCost: number;
  /** Hours asked (adopted + agent + seated) and servable on the served H100e (sector products). */
  askedHours: number;
  /** Serving need (H100e incl. monitor) of seats and of per-hour work; Chat: of paying and free users and the free cut. */
  needSeat: number;
  needWork: number;
  needPaid: number;
  needFree: number;
  cutFree: number;
  cutPaid: number;
  /** Chat: paid share (subscribers ÷ users), its target, the going price and the willingness to pay ($/month). */
  paidShare: number;
  paidTarget: number;
  going: number;
  wtp: number;
}

/** Going subscription price ($/month): the regions' going prices weighted by their weekly users (B1 readout). */
export function goingPrice(s: GameStateV2, mix: WorldMix = worldMix(s)): number {
  let w = 0;
  let p = 0;
  for (const r of REGIONS) {
    const u = consumerUsers(s, r);
    if (!(u > 0)) continue;
    w += u;
    p += u * mix.consumer[r].going;
  }
  return w > 0 ? p / w : CONSUMER_MKT.wtpMonth;
}

function econOf(x: DeploymentRevenue, going: number): ProductEcon {
  const chat = x.channel === 'consumer';
  const adoptedH = x.adoptedHours ?? 0;
  const agentH = x.agentHours ?? 0;
  const needPaid = x.needPaid ?? 0;
  const needFree = x.needFree ?? 0;
  const cutFree = x.cutFree ?? 0;
  const needSeat = x.needSeat ?? 0;
  return {
    kind: chat ? 'chat' : 'sector',
    adoptedDemand: x.adoptedDemand ?? 0, agentDemand: x.agentDemand ?? 0, seatDemand: x.seatDemand ?? 0,
    adoptedHours: adoptedH, agentHours: agentH,
    adoptedPrice: adoptedH > 0 ? ((x.adoptedDemand ?? 0) * 1e9) / adoptedH : 0,
    agentPrice: agentH > 0 ? ((x.agentDemand ?? 0) * 1e9) / agentH : 0,
    seats: x.seats ?? 0, seatHours: x.seatHours ?? 0, seatPrice: x.seatPrice ?? 0, seatCost: x.seatCost ?? 0,
    askedHours: adoptedH + agentH + (x.seatHours ?? 0),
    needSeat, needWork: chat ? 0 : Math.max(0, x.needH100e - needSeat),
    needPaid, needFree, cutFree, cutPaid: chat ? Math.max(0, x.cutH100e - cutFree) : 0,
    paidShare: chat && (x.users ?? 0) > 0 ? (x.subs ?? 0) / (x.users ?? 1) : 0,
    paidTarget: x.paidTarget ?? 0, going, wtp: CONSUMER_MKT.wtpMonth,
  };
}

const GOV_SECTORS = new Set(['GOV', 'MIL']);

function providerName(s: GameStateV2, key: string): string {
  if (key === 'china') return s.china.lab.core.name;
  if (key === 'player:open') return 'Your open weights';
  return s.rivals.find((r) => r.core.id === key)?.core.name ?? key;
}

/** Spend-weighted share of each provider in the segment a product sells into (consumer, all sectors, or GOV/MIL). */
function segmentShares(s: GameStateV2, mix: WorldMix, channel: Deployment['channel']): number[] {
  const n = mix.providers.length;
  const acc = new Array<number>(n).fill(0);
  let tot = 0;
  for (const r of REGIONS) {
    if (channel === 'consumer') {
      const cs = consumerSpend(s, mix, r);
      tot += cs;
      for (let i = 0; i < n; i++) acc[i] += cs * mix.consumer[r].share[i];
      continue;
    }
    for (const def of SECTORS) {
      if (channel === 'gov' && !GOV_SECTORS.has(def.id)) continue;
      const m = mix.sec[r][def.id];
      const sp = sectorSpend(s, r, def.id, mix);
      tot += sp;
      for (let i = 0; i < n; i++) acc[i] += sp * m.share[i];
    }
  }
  return acc.map((x) => (tot > 0 ? x / tot : 0));
}

/** Readouts of every product (paid deployments) from one revenue computation. */
export function productReadouts(s: GameStateV2, mix: WorldMix = worldMix(s), rd: RevenueReadout = revenueReadout(s, mix)): Map<string, ProductRead> {
  const out = new Map<string, ProductRead>();
  const tco = (serveDollarsPerHour(s) * SERVE_HOURS_PER_YEAR) / 1e9;
  const shareCache = new Map<string, number[]>();
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  const going = goingPrice(s, mix);
  for (const d of paidDeployments(s)) {
    const x = rd.deps.find((r) => r.id === d.id);
    if (!x) continue;
    const segKey = d.channel === 'consumer' ? 'c' : d.channel === 'gov' ? 'g' : 's';
    let sh = shareCache.get(segKey);
    if (!sh) {
      sh = segmentShares(s, mix, d.channel);
      shareCache.set(segKey, sh);
    }
    let rival: ProductRead['rival'];
    mix.providers.forEach((p, i) => {
      if (p.lab === 'player') return;
      if (!rival || sh![i] > rival.share) rival = { name: providerName(s, p.key), share: sh![i] };
    });
    const def = PRODUCT_DEFS[d.channel];
    out.set(d.id, {
      id: d.id, channel: d.channel, revenue: x.revenue, demand: x.demand,
      customers: d.channel === 'consumer' ? x.users ?? 0 : def && def.arpu > 0 ? (x.revenue * 1e9) / def.arpu : 0,
      share: pi >= 0 ? sh[pi] : 0, rival, bound: x.bound, rpH: x.rpH,
      needH100e: x.needH100e, servedH100e: x.servingH100e, cutH100e: x.cutH100e, unserved: Math.max(0, x.demand - x.revenue),
      runCost: Math.min(x.servingH100e, x.needH100e) * tco,
      cost: d.channel === 'consumer' ? x.subCost ?? 0 : x.costPerHour, price: d.channel === 'consumer' ? x.subPrice ?? 0 : x.pricePerHour,
      margin: (d.channel === 'consumer' ? x.subPrice ?? 0 : x.pricePerHour) > 0 ? 1 - (d.channel === 'consumer' ? (x.subCost ?? 0) / (x.subPrice ?? 1) : x.costPerHour / x.pricePerHour) : 0,
      valueCapped: x.valueCapped, hours: x.hours, capHours: x.capHours, ...(x.users !== undefined ? { users: x.users, subs: x.subs } : {}),
      monitorOverhead: monitorOverhead(s, d),
      catchRate: d.monitorId ? catchRate(s, versionById(s, d.versionId), versionById(s, d.monitorId)).rate : 0,
      markup: markupOf(d), econ: econOf(x, going),
    });
  }
  return out;
}

/** A copy of the state whose player has these deployments, features and policies (read-only use). */
export function hypothetical(s: GameStateV2, deps: Deployment[], over: { features?: string[]; policies?: Partial<GameStateV2['player']['policies']> } = {}): GameStateV2 {
  return {
    ...s,
    player: {
      ...s.player, deployments: deps,
      ...(over.features ? { features: over.features } : {}),
      ...(over.policies ? { policies: { ...s.player.policies, ...over.policies } } : {}),
    },
  };
}

export interface EditPreview {
  before?: ProductRead;
  after?: ProductRead;
  /** Revenue of all products before and after ($B/yr): an edit moves serving between products. */
  totalBefore: Money;
  totalAfter: Money;
  /** Day the edit takes effect (the next tick, D7). */
  fromDay: number;
}

/** Before → after of replacing product `id` with `next` (or adding it, for a launch). */
export function previewDeployments(s: GameStateV2, deps: Deployment[], id: string, over: Parameters<typeof hypothetical>[2] = {}): EditPreview {
  const mix0 = worldMix(s);
  const rd0 = revenueReadout(s, mix0);
  const before = productReadouts(s, mix0, rd0).get(id);
  const s2 = hypothetical(s, deps, over);
  const mix1 = worldMix(s2);
  const rd1 = revenueReadout(s2, mix1);
  const after = productReadouts(s2, mix1, rd1).get(id);
  return { before, after, totalBefore: rd0.total, totalAfter: rd1.total, fromDay: s.time.day + 1 };
}
