// Revenue per product: demand in AI work-hours (sectors) and subscribers (consumer) × the product's price, against its
// serving capacity (V2-SPEC §3.11.3; model v3 V4.2: design/MODEL-V3.md §7.3, design/V3-BUILD.md "V4 notes"). Owner: WS5.
//
//   use_s,r     = U_s·E0_s·2000   hours of AI use (A2a, worldfx/use.ts): U = A + h_s·(W − A), every task-hour firms
//                 handed to AI (A, research/16) plus workers' assisted use (W workers, h_s of their other hours); it saves
//                 (α_use + (1 − α_use)·g_aug) hours of the work, α_use = α·A/U (research/22 §1: ≈0.35)
//   player      = customer-stock share × use hours × channel split × (1 + the product's enabler segments)
//   price       = min(markup × the product's cost per hour of use, value = wage × hours saved) (worldfx/serving.ts)
//   demand $    = Σ hours × price;  need H100e = Σ hours × H100e-hours per work-hour ÷ 8766, + the monitor's overhead
//   consumer    = users (online adults × reach × share) → paying subscribers × price per month × 12; free users run on
//                 the product's mini (else its model) and pay nothing; need from usage per user-day
//   revenue     = demand $ × min(1, served ÷ need)   (consumer: paying users are served first)
// Serving split (R6): with the Auto policy (default) each product needs its H100e; the pool serves the products earning
// most per H100e first and records what it cuts; spare pool is spread over the products in proportion to need. With Auto
// off the products keep the shares set by hand (scaled if > 100%). Capacity-bound products lose share (0.5%/day of the
// excess, through the brand term of the logit); demand-bound ones report quality or price.
// Gov and trusted contract lump sums arrive through events/actions (WS4), not here.
import { REGIONS, ECON, SECTORS } from '../../../data/v2/sectors';
import { CONSUMER_MKT, PRICE_ELASTICITY, SERVE_HOURS_PER_YEAR, SHARE_SLOPE_G } from '../../../data/v2/serving';
import type { Channel, Deployment, EngineSystem, GameStateV2, LabId, Money, RegionId, SectorId, SystemCtx } from '../types';
import { SECTOR_CHANNELS, advanceCustomers, paidDeployments, worldMix, type WorldMix } from './mix';
import { monitorOverhead, productDomains } from '../models/products';
import { versionById } from '../models/labs';
import { sigmoid } from './policy';
import { alphaUseOf, savedAt, useShareOf } from './use';
import { bookCash } from '../finance/ledger';
import { revenueToParent } from '../finance/parent';
import { flopPerToken } from '../departments/workfit';
import {
  chatHoursPerDay, effortTokens, enablerShare, fxOn, markupOf, offerOf, productFx, productOffer, productUses, serveDollarsPerHour,
  settingsDG, subPrice, valuePerHour, type Offer,
} from './serving';

/** Channel weights splitting the player's sector demand between its deployments [D]. */
const CH_WEIGHT: Partial<Record<Channel, number>> = { api: 1, agents: 1.5, enterprise: 1, trusted: 0.15, gov: 2 };
/** Trusted access sells at a premium (×3 the price) to a small volume (R12 §0.6) [D]. */
export const TRUSTED_PREMIUM = 3;
const GOV_SECTORS = new Set(['GOV', 'MIL']);
/** Ceiling on share erosion from serving shortfall (a capacity-bound leader keeps a core of customers) [D]. */
export const PENALTY_MAX = 0.75;

export interface DeploymentRevenue {
  id: string;
  channel: Channel;
  demand: Money;
  capacity: Money;
  revenue: Money;
  bound: NonNullable<Deployment['demandBound']>;
  servingH100e: number;
  /** Revenue per serving H100e-year at its demand ($, incl. the monitor overhead). */
  rpH: number;
  /** Serving H100e the demand needs (incl. monitor), and what the split cut from it (Auto: lowest $/H100e first). */
  needH100e: number;
  cutH100e: number;
  /** AI work-hours a year it is asked for (sector products) and can serve; demand-weighted cost and price per work-hour
   *  ($) and the share of its demand $ sold at the value cap. */
  hours: number;
  capHours: number;
  costPerHour: number;
  pricePerHour: number;
  valueCapped: number;
  /** Consumer: weekly users and paying subscribers it serves (its customer stock), cost and price per subscriber-month. */
  users?: number;
  subs?: number;
  subCost?: number;
  subPrice?: number;
}

export interface RevenueReadout {
  deps: DeploymentRevenue[];
  total: Money;
  demand: Money;
  capacity: Money;
  /** Total AI spend by sector buyers and consumers ($B/yr), by region. */
  marketSpend: Record<RegionId, Money>;
  consumerSpend: Record<RegionId, Money>;
}

/** Hours of AI use a year in one sector and region: U·E0·2000 (adopted task-hours plus workers' assisted use, A2a). */
export function sectorHours(s: GameStateV2, r: RegionId, sid: SectorId): number {
  const st = s.world.sectors[r][sid];
  return useShareOf(st, sid) * st.E0 * ECON.hours;
}
/** AI spend of one sector in one region ($B/yr): its AI work-hours × the share-weighted price per work-hour. */
export function sectorSpend(s: GameStateV2, r: RegionId, sid: SectorId, mix: WorldMix): Money {
  return (sectorHours(s, r, sid) * mix.sec[r][sid].price) / 1e9;
}
/** Consumer users of a region (weekly: online adults × reach). */
export const consumerUsers = (s: GameStateV2, r: RegionId) => CONSUMER_MKT.adults[r] * s.world.fx.consumerReach;
/** Consumer spend by region ($B/yr): paying subscribers × each provider's price per month × 12. */
export function consumerSpend(s: GameStateV2, mix: WorldMix, r: RegionId): Money {
  const cm = mix.consumer[r];
  let p = 0;
  for (let i = 0; i < cm.share.length; i++) p += cm.share[i] * cm.prices[i];
  return (consumerUsers(s, r) * CONSUMER_MKT.payShare * p * 12) / 1e9;
}

/** Serving H100e of the moonshot projects (taken out of the serving pool first). */
export function moonshotH100e(s: GameStateV2): number {
  let share = 0;
  for (const t of Object.values(s.world.techs)) share += t.playerProject?.computeShare ?? 0;
  return s.player.computeOnline * share;
}

/** Serving pool for products (H100e): the serving share of online compute minus moonshot projects. */
export function servingPool(s: GameStateV2): number {
  return Math.max(0, s.player.computeOnline * s.player.split.serving - moonshotH100e(s));
}

/** Serving compute no product needs (H100e; J2 PR1): the pool minus what each product uses (its serving up to its
 *  need, as the revenue system last computed it). 0 until every product has been served once. */
export function spareServing(s: GameStateV2): number {
  const pool = servingPool(s);
  if (pool <= 0) return 0;
  let used = 0;
  for (const d of paidDeployments(s)) {
    if (d.needH100e === undefined) return 0;
    used += Math.min(d.servedH100e ?? 0, d.needH100e);
  }
  return Math.max(0, pool - used);
}

/** Spare serving compute that runs research agents under the default policy (J2 PR1; 'headroom' keeps it on the
 *  products). Products take it back first when their demand rises (tomorrow's split). */
export const spareServingToResearch = (s: GameStateV2) => (s.player.policies.spareServing === 'headroom' ? 0 : spareServing(s));

/** Share-recovery speed with spare serving lent to research [D]: products get it back only when demand rises, so
 *  capacity slack wins back eroded share at half speed ('headroom' keeps full speed). */
export const LENT_RECOVERY = 0.5;

export interface ServingRow { h: number; need: number; cut: number; rpH: number }
/** A product's serving need in segments: paying work first (its revenue per H100e-year), then any free use (Chat's free
 *  users: revenue 0, served last). */
export interface NeedSeg { need: number; rpH: number }

/**
 * Serving split (R6). Auto (policy, default): serve the products' need segments in order of revenue per H100e (most
 * first; free users last) until the pool runs out; the rest is the cut. Segments within 1% of each other's revenue per
 * H100e share what is left pro rata (with prices at markup × cost, paid work earns about the same per H100e on every
 * product). Spare pool goes to every product in proportion to need. Manual: the products' own shares of the pool (scaled
 * down if they add up to more than 100%).
 */
export function servingSplit(s: GameStateV2, deps: Deployment[], segs: (d: Deployment) => NeedSeg[]): Map<string, ServingRow> {
  const pool = servingPool(s);
  const out = new Map<string, ServingRow>();
  const rows = deps.map((d) => {
    const sg = segs(d);
    const need = sg.reduce((a, x) => a + x.need, 0);
    const dem = sg.reduce((a, x) => a + x.need * x.rpH, 0);
    return { d, sg, need, rpH: need > 0 ? dem / need : 0 };
  });
  if (s.player.policies.servingAuto) {
    const flat = rows.flatMap((r) => r.sg.map((x, k) => ({ id: r.d.id, k, ...x }))).filter((x) => x.need > 0);
    flat.sort((a, b) => b.rpH - a.rpH || (a.id < b.id ? -1 : a.id > b.id ? 1 : a.k - b.k));
    let left = pool;
    const got = new Map<string, number>();
    for (let i = 0; i < flat.length; ) {
      let j = i + 1;
      while (j < flat.length && flat[j].rpH >= flat[i].rpH * 0.99 && (flat[i].rpH > 0 || flat[j].rpH <= 0)) j++;
      const grp = flat.slice(i, j);
      const want = grp.reduce((a, x) => a + x.need, 0);
      const f = want > 0 ? Math.min(1, left / want) : 0;
      for (const x of grp) got.set(x.id, (got.get(x.id) ?? 0) + x.need * f);
      left = Math.max(0, left - want * f);
      i = j;
    }
    const needSum = rows.reduce((a, r) => a + r.need, 0);
    for (const r of rows) {
      const g = got.get(r.d.id) ?? 0;
      const spare = left > 0 ? (needSum > 0 ? (left * r.need) / needSum : left / rows.length) : 0;
      out.set(r.d.id, { h: g + spare, need: r.need, cut: Math.max(0, r.need - g), rpH: r.rpH });
    }
    return out;
  }
  const sum = deps.reduce((a, d) => a + d.servingShare, 0);
  const scale = sum > 1 ? 1 / sum : 1;
  for (const r of rows) {
    const h = pool * r.d.servingShare * scale;
    out.set(r.d.id, { h, need: r.need, cut: Math.max(0, r.need - h), rpH: r.rpH });
  }
  return out;
}

interface Acc { dem: number; hours: number; need: number; cost: number; capped: number; users: number; subs: number; needPaid: number; subCost: number; subPrice: number }
const acc0 = (): Acc => ({ dem: 0, hours: 0, need: 0, cost: 0, capped: 0, users: 0, subs: 0, needPaid: 0, subCost: 0, subPrice: 0 });

/** Full revenue computation (pure; the system applies it). */
export function revenueReadout(s: GameStateV2, mix: WorldMix = worldMix(s)): RevenueReadout {
  const deps = paidDeployments(s);
  const playerIdx = mix.providers.findIndex((p) => p.key === 'player');
  const acc = new Map<string, Acc>(deps.map((d) => [d.id, acc0()]));
  const marketSpend = { US: 0, CN: 0, ROW: 0 } as Record<RegionId, Money>;
  const consumerSpendR = { US: 0, CN: 0, ROW: 0 } as Record<RegionId, Money>;
  const certified = (sec: SectorId) => {
    const c = s.world.fx.certDay[sec];
    return c !== undefined && c <= s.time.day;
  };

  // Sector demand. Channel weights per sector are region-independent: compute once; offers per (product, sector) too.
  const sectorDeps = deps.filter((d) => SECTOR_CHANNELS.includes(d.channel));
  const fxs = new Map(sectorDeps.map((d) => [d.id, productFx(s, d)]));
  const usesOf = new Map(deps.map((d) => [d.id, productUses(s, d)]));
  const baseW = sectorDeps.map((d) => {
    let w = CH_WEIGHT[d.channel] ?? 0;
    if (d.channel === 'agents') w *= sigmoid(((productDomains(s, d)?.AGENCY ?? 0) - 6) / 1);
    return w;
  });
  const secW = SECTORS.map((def) => {
    const ws: [Deployment, number, Offer, number][] = [];
    let wsum = 0;
    sectorDeps.forEach((d, i) => {
      if (d.channel === 'gov' && !GOV_SECTORS.has(def.id)) return;
      const w = baseW[i] * (d.channel === 'enterprise' && d.sectorFocus.includes(def.id) ? 3 : 1);
      if (w <= 0) return;
      const o = productOffer(s, d, def.id, certified(def.id), usesOf.get(d.id), fxs.get(d.id));
      ws.push([d, w, o, 1 + enablerShare(fxs.get(d.id) ?? [], def.id)]);
      wsum += w;
    });
    return { ws, wsum };
  });
  for (const r of REGIONS) {
    SECTORS.forEach((def, si) => {
      const m = mix.sec[r][def.id];
      const hours = sectorHours(s, r, def.id);
      marketSpend[r] += (hours * m.price) / 1e9;
      if (playerIdx < 0 || !m.share[playerIdx]) return;
      const st = s.world.sectors[r][def.id];
      const hf = savedAt(alphaUseOf(st, def.id));
      const ph = m.share[playerIdx] * hours;
      const { ws, wsum } = secW[si];
      if (!wsum) return;
      const value = valuePerHour(s, def.id, r);
      for (const [d, w, o, en] of ws) {
        let x = ((ph * w) / wsum) * en;
        // usage policy "no drop-in replacement" caps the player's α at 0.5 (fewer hours per adopted task)
        if (d.usagePolicy.noDropInReplacement) x *= savedAt(alphaUseOf(st, def.id, Math.min(st.alpha, 0.5))) / hf;
        if (d.channel === 'api' || d.channel === 'agents') x *= 1 - 0.02 * d.kyc;
        if (d.status === 'restricted') x *= 0.3;
        const want = o.price * (d.channel === 'trusted' ? TRUSTED_PREMIUM : 1);
        const price = Math.max(o.cost, Math.min(want, value));
        const a = acc.get(d.id)!;
        a.dem += (x * price) / 1e9;
        a.hours += x;
        a.need += (x * o.hph) / SERVE_HOURS_PER_YEAR;
        a.cost += (x * o.cost) / 1e9;
        if (want > value) a.capped += (x * price) / 1e9;
      }
    });
    // Consumer demand: users of the player's chat products (customer stock × reach), paying subscribers × price.
    consumerSpendR[r] = consumerSpend(s, mix, r);
    const cm = mix.consumer[r];
    if (playerIdx >= 0 && cm.share[playerIdx] > 0) {
      const cdeps = deps.filter((d) => d.channel === 'consumer');
      const rate = serveDollarsPerHour(s);
      const offs = cdeps.map((d) => {
        const uses = usesOf.get(d.id) ?? [];
        const fx = productFx(s, d);
        const x = fxOn(fx, 'CHAT');
        const e = effortTokens(d.effort);
        const o = offerOf(s, uses, 'CHAT', { dG: settingsDG(d) + x.dG, hMult: x.hMult, effort: e, markup: markupOf(d), rate });
        const main = versionById(s, d.versionId);
        const mini = d.miniVersionId ? versionById(s, d.miniVersionId) : undefined;
        const fMain = main ? flopPerToken(s, main) : 2e12;
        const fFree = mini ? flopPerToken(s, mini) : fMain;
        const sp = subPrice(s, fMain, markupOf(d), e);
        return { d, o, sp, fMain, fFree, e, en: 1 + enablerShare(fx, 'CHAT') };
      });
      const best = Math.max(...offs.map((x) => x.o.fit));
      const ws = offs.map((x) => Math.exp(SHARE_SLOPE_G * (x.o.fit - best)) * Math.pow(Math.max(1e-9, x.sp.price), -PRICE_ELASTICITY));
      const wsum = ws.reduce((a, b) => a + b, 0) || 1;
      const users = cm.share[playerIdx] * consumerUsers(s, r);
      offs.forEach((x, i) => {
        let u = ((users * ws[i]) / wsum) * x.en;
        if (x.d.status === 'restricted') u *= 0.3;
        const subs = u * CONSUMER_MKT.payShare;
        const a = acc.get(x.d.id)!;
        a.users += u;
        a.subs += subs;
        a.dem += (subs * x.sp.price * 12) / 1e9;
        a.cost += (subs * x.sp.cost * 12) / 1e9;
        if (x.sp.price >= CONSUMER_MKT.valueCapMonth - 1e-9) a.capped += (subs * x.sp.price * 12) / 1e9;
        const paid = (subs * chatHoursPerDay(x.fMain, CONSUMER_MKT.perDay.paid, x.e)) / 24;
        const free = ((u - subs) * chatHoursPerDay(x.fFree, CONSUMER_MKT.perDay.free)) / 24;
        a.needPaid += paid;
        a.need += paid + free;
        a.subCost = x.sp.cost;
        a.subPrice = x.sp.price;
      });
    }
  }

  // Serving split, capacity and the binding cause. Chat's paying users form the first need segment, its free users a
  // second one that earns nothing (served last).
  const segsOf = (d: Deployment): NeedSeg[] => {
    const a = acc.get(d.id)!;
    const mon = 1 + monitorOverhead(s, d);
    if (d.channel !== 'consumer') return [{ need: a.need * mon, rpH: a.need > 0 ? (a.dem * 1e9) / (a.need * mon) : 0 }];
    return [{ need: a.needPaid * mon, rpH: a.needPaid > 0 ? (a.dem * 1e9) / (a.needPaid * mon) : 0 }, { need: (a.need - a.needPaid) * mon, rpH: 0 }];
  };
  const split = servingSplit(s, deps, segsOf);
  const out: DeploymentRevenue[] = [];
  let total = 0;
  let D = 0;
  let C = 0;
  for (const d of deps) {
    const a = acc.get(d.id)!;
    const sp = split.get(d.id)!;
    const h = sp.h;
    const mon = 1 + monitorOverhead(s, d);
    const need = sp.need;
    // Paying consumers are served before free users; sector work in proportion.
    const firstNeed = d.channel === 'consumer' ? a.needPaid * mon : need;
    const frac = firstNeed > 0 ? Math.min(1, h / firstNeed) : 1;
    const capacity = firstNeed > 0 ? (a.dem * h) / firstNeed : 0;
    const revenue = a.dem * frac;
    let bound: DeploymentRevenue['bound'];
    if (a.dem <= 1e-6) bound = 'demand';
    else if (need > h * 1.0001) bound = 'capacity';
    else bound = d.price === 'premium' ? 'price' : 'quality';
    out.push({
      id: d.id, channel: d.channel, demand: a.dem, capacity, revenue, bound, servingH100e: h, rpH: sp.rpH, needH100e: need, cutH100e: sp.cut,
      hours: a.hours, capHours: a.hours > 0 && need > 0 ? (a.hours * h) / need : 0,
      costPerHour: a.hours > 0 ? (a.cost * 1e9) / a.hours : 0, pricePerHour: a.hours > 0 ? (a.dem * 1e9) / a.hours : 0,
      valueCapped: a.dem > 0 ? a.capped / a.dem : 0,
      ...(d.channel === 'consumer' ? { users: a.users, subs: a.subs, subCost: a.subCost, subPrice: a.subPrice } : {}),
    });
    total += revenue;
    D += a.dem;
    C += capacity;
  }
  return { deps: out, total, demand: D, capacity: C, marketSpend, consumerSpend: consumerSpendR };
}

/** Revenue rate ($B/yr) of a deployment, as last computed by the revenue system. */
export function revenueOf(s: GameStateV2, deploymentId: string): Money {
  return s.player.deployments.find((d) => d.id === deploymentId)?.revenueRate ?? 0;
}

/** Market revenue ($B/yr) a non-player lab earns from its public model at its customer share (demand-side: sector work
 *  at its price per work-hour, consumer subscribers at its price; WS4 uses it for rival finance). */
export function labMarketRevenue(s: GameStateV2, lab: LabId): Money {
  const mix = worldMix(s);
  const i = mix.providers.findIndex((p) => p.key === lab);
  if (i < 0) return 0;
  let x = 0;
  for (const r of REGIONS) {
    for (const def of SECTORS) {
      const m = mix.sec[r][def.id];
      if (m.share[i]) x += (m.share[i] * sectorHours(s, r, def.id) * m.prices[i]) / 1e9;
    }
    const cm = mix.consumer[r];
    x += (cm.share[i] * consumerUsers(s, r) * CONSUMER_MKT.payShare * cm.prices[i] * 12) / 1e9;
  }
  return x;
}

/** revenue (60, daily): demand vs capacity per deployment → revenueRate (Auto serving split, R6); books revenue/365 ONCE
 *  through the finance ledger (kind 'revenue'); moves the customer stocks toward the market's logit shares (V4.2). WS3's
 *  opex system derives revenueRun (30-day smoothing of Σ revenueRate) from it. */
export const revenueSystem: EngineSystem = {
  id: 'revenue', owner: 'WS5', cadence: 'daily', order: 60, system: 'products',
  run(s, ctx) {
    applyRevenue(s, ctx);
  },
};

export function applyRevenue(s: GameStateV2, ctx: SystemCtx): RevenueReadout {
  const mix = worldMix(s, ctx);
  const rd = revenueReadout(s, mix);
  const byId = new Map(rd.deps.map((x) => [x.id, x]));
  let top: DeploymentRevenue | undefined;
  for (const d of s.player.deployments) {
    const x = byId.get(d.id);
    if (!x) {
      if (d.revenueRate !== undefined) d.revenueRate = 0;
      continue;
    }
    d.revenueRate = Math.round(x.revenue * 1e4) / 1e4;
    d.demandBound = x.bound;
    d.needH100e = Math.round(x.needH100e);
    d.servedH100e = Math.round(x.servingH100e);
    d.cutH100e = Math.round(x.cutH100e);
    if (ctx.day % 30 === 0) {
      (d.hist ??= []).push(d.revenueRate);
      if (d.hist.length > 12) d.hist.shift();
    }
    // Auto: the share it actually gets (incident usage and the manual starting point read it).
    if (s.player.policies.servingAuto) {
      const pool = servingPool(s);
      d.servingShare = pool > 0 ? x.servingH100e / pool : 0;
    }
    if (!top || x.revenue > top.revenue) top = x;
  }
  if (rd.total > 0) bookCash(s, ctx, rd.total / 365, 'revenue', 'revenue', top ? `${top.channel} ${top.bound}-bound` : undefined);
  revenueToParent(s, ctx, rd.total / 365); // a division's revenue goes to the parent (R9)
  advanceCustomers(s, mix);

  // Share erosion when capacity-bound (0.5%/day of the unserved share of the need), slow recovery when there is slack
  // (half speed when the spare serving runs research agents, J2 PR1).
  const pen = s.world.fx.capPenalty;
  const rec = s.player.policies.spareServing === 'headroom' ? 1 : LENT_RECOVERY;
  const upd = (key: 'consumer' | 'sector', sel: (x: DeploymentRevenue) => boolean) => {
    let need = 0;
    let got = 0;
    for (const x of rd.deps) if (sel(x)) {
      need += x.needH100e;
      got += x.servingH100e;
    }
    if (need <= 0) {
      pen[key] = Math.max(0, pen[key] - 0.01);
      return;
    }
    if (need > got) pen[key] = Math.min(PENALTY_MAX, pen[key] + 0.005 * ((need - got) / need));
    else pen[key] = Math.max(0, pen[key] - 0.03 * rec * ((got - need) / Math.max(got, 1e-9)));
  };
  upd('consumer', (x) => x.channel === 'consumer');
  upd('sector', (x) => x.channel !== 'consumer');
  return rd;
}
