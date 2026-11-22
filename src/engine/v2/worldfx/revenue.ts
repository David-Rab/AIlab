// Revenue per product: demand in AI work-hours (sectors) and subscribers (consumer) × the product's price, against its
// serving capacity (V2-SPEC §3.11.3; model v3 V4.2: design/MODEL-V3.md §7.3, design/V3-BUILD.md "V4 notes"). Owner: WS5.
//
//   use_s,r     = U_s·E0_s·2000   hours of AI use (A2a, worldfx/use.ts): U = A + h_s·(W − A), every task-hour firms
//                 handed to AI (A, research/16) plus workers' assisted use (W workers, h_s of their other hours)
//   A2c billing (worldfx/use.ts workHoursOf; data/v2/serving.ts SEATS, AGENT_WORK):
//     adopted A-hours   billed per hour: price = min(markup × cost per adopted hour, value = wage × (α + (1 − α)·g_aug))
//     seats             σ·W·E paid seats × seat price × 12; their assisted (seated) hours need serving, billed by the seat
//     unseated hours    free, bundled, in-house: billed by no one here, served by the users' consumer apps (A2b)
//     agent-hours       k (after the buyer's gate) × supervising hours ((1 − α)·A-hours + seated hours), billed per hour at
//                       cost-plus on the autonomous profile (≤ the wage); A4: only up to the sector's work demand
//                       (mix agentCeiling: adopted + agent hours ≤ E0·2000·(1 + η·CR), spend ≤ that × the wage), the
//                       rest is not bought (no revenue, no serving need)
//   player      = customer-stock share × each stream × channel split × (1 + the product's enabler segments): A-hours by
//                 CH_WEIGHT, agent-hours by AGENT_WORK.channel (Agents × the share of half-day tasks its model completes),
//                 seats by Enterprise (Gov in GOV/MIL)
//   demand $    = Σ hours × price + seats × seat price × 12;  need H100e = Σ hours × H100e-hours per hour ÷ 8766 (+ monitor)
//   consumer    = users (online adults × reach R_r × user share, both stocks) × paid share P (a stock, A2b) = subscribers;
//                 revenue line = subscribers × price per month × 12 (A6b: the market's flat plan price, the willingness to
//                 pay on Standard, not cost-plus), independent of work
//                 hours; free users (users − subscribers) run on its free tier (A7: its mini, else the cheapest student
//                 of its model, worldfx/serving.ts chatFreeTier), pay nothing and are
//                 served last; need from usage per user-day (paid 30k/8k, free 7.5k/1.5k tokens)
//   revenue     = demand $ × min(1, served ÷ need)   (consumer: paying users are served first)
// Serving split (R6): with the Auto policy (default) each product needs its H100e; the pool serves the products earning
// most per H100e first and records what it cuts; spare pool is spread over the products in proportion to need. With Auto
// off the products keep the shares set by hand (scaled if > 100%). Capacity-bound products lose share (0.5%/day of the
// excess, through the brand term of the logit); demand-bound ones report quality or price.
// Gov and trusted contract lump sums arrive through events/actions (WS4), not here.
import { REGIONS, ECON, SECTORS } from '../../../data/v2/sectors';
import { AGENT_WORK, CONSUMER_MKT, MARKUP, SERVE_HOURS_PER_YEAR, SHARE_SLOPE_G } from '../../../data/v2/serving';
import { AGENT_TASK_HOURS } from '../../../data/v2/features';
import type { Channel, Deployment, EngineSystem, GameStateV2, LabId, Money, RegionId, SectorId, SystemCtx } from '../types';
import { SECTOR_CHANNELS, advanceCustomers, paidDeployments, worldMix, type WorldMix } from './mix';
import { monitorOverhead, productDomains } from '../models/products';
import { versionById } from '../models/labs';
import { sigmoid } from './policy';
import { savedAt, useShareOf, workHoursOf } from './use';
import { bookCash } from '../finance/ledger';
import { revenueToParent } from '../finance/parent';
import { flopPerToken, pSuccess } from '../departments/workfit';
import { h50Of } from '../models/capability';
import {
  agentDemandOf, blendTiers, chatFreeTier, chatHoursPerDay, effortTokens, enablerShare, fxOn, markupOf, offerOf, productFx, productLineup, productMiniUses, productOffer, productUses, serveDollarsPerHour,
  settingsDG, subPrice, tokEff, valuePerHour, wagePerHour, type Offer,
} from './serving';
import { decodeUtilNow } from '../models/stacks';

/** Channel weights splitting the player's sector demand between its deployments [D]. */
const CH_WEIGHT: Partial<Record<Channel, number>> = { api: 1, agents: 1.5, enterprise: 1, trusted: 0.15, gov: 2 };
// RD-B11 (B16): Trusted access's ×3 price is in its offer (worldfx/serving.ts productOffer, data/v2/features.ts
// CHANNEL_PRICE), so the market's choice sees it; its volume here is the channel weight above.
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
  /** AI work-hours a year billed per hour it is asked for (sector products: adopted task-hours + agent-hours) and the
   *  work-hours it can serve (incl. seated hours); demand-weighted cost and price per billed hour ($, seats excluded)
   *  and the share of its demand $ sold at the value cap. */
  hours: number;
  capHours: number;
  costPerHour: number;
  pricePerHour: number;
  valueCapped: number;
  /** A2c (sector products): adopted task-hours and agent-hours in `hours`; paid seats it sells (persons), their
   *  assisted hours a year, seat revenue ($B/yr, in `demand`), seat price and serving cost per seat-month ($), and the
   *  seated hours' serving need (H100e incl. monitor; served before the per-hour work). */
  adoptedHours?: number;
  agentHours?: number;
  /** B1 readout: demand ($B/yr) of the adopted task-hours and of the agent-hours (they add up to demand − seatDemand). */
  adoptedDemand?: Money;
  agentDemand?: Money;
  seats?: number;
  seatHours?: number;
  seatDemand?: Money;
  seatPrice?: number;
  seatCost?: number;
  needSeat?: number;
  /** Consumer: weekly users and paying subscribers it serves (its customer stock × the paid-share stock), cost and price
   *  per subscriber-month; the paid share's target (A2b); serving need (H100e, incl. monitor) of paying and free users,
   *  and how much of the free users' need the split cut (free users are served last). */
  users?: number;
  subs?: number;
  subCost?: number;
  subPrice?: number;
  paidTarget?: number;
  needPaid?: number;
  needFree?: number;
  cutFree?: number;
  /** TIERS (sector products): per tier of its lineup (worldfx/serving.ts productLineup order) the billed hours a year
   *  (adopted task-hours + agent-hours) and their demand ($B/yr) before the serving cut. */
  tiers?: { hours: number; dem: Money }[];
}

export interface RevenueReadout {
  deps: DeploymentRevenue[];
  total: Money;
  demand: Money;
  capacity: Money;
  /** Total AI spend by sector buyers and consumers ($B/yr), by region. */
  marketSpend: Record<RegionId, Money>;
  consumerSpend: Record<RegionId, Money>;
  /** A4: the player's agent-hours a year per region and sector (all its products, after the demand ceiling). */
  playerAgent: Record<RegionId, Partial<Record<SectorId, number>>>;
}

/** Hours of AI use a year in one sector and region: U·E0·2000 (adopted task-hours plus workers' assisted use, A2a). */
export function sectorHours(s: GameStateV2, r: RegionId, sid: SectorId): number {
  const st = s.world.sectors[r][sid];
  return useShareOf(st, sid) * st.E0 * ECON.hours;
}
/** AI spend of one sector in one region by stream ($B/yr, all providers; A2c): adopted task-hours × price per hour,
 *  agent-hours × price per agent-hour, seats × seat price × 12; the agent-hours a year and the seats sold (persons; open
 *  weights sell none). Unseated assisted hours pay nothing here. */
export function sectorSpendParts(s: GameStateV2, r: RegionId, sid: SectorId, mix: WorldMix): { adopted: Money; agent: Money; seat: Money; agentHours: number; seats: number } {
  const m = mix.sec[r][sid];
  const wh = workHoursOf(s.world.sectors[r][sid], sid);
  let ag = 0;
  let agH = 0;
  let se = 0;
  let seN = 0;
  for (let i = 0; i < m.share.length; i++) {
    const x = m.share[i];
    if (!x) continue;
    agH += x * m.agentK[i];
    ag += x * m.agentK[i] * m.agentPrices[i];
    if (m.seatPrices[i] > 0) {
      seN += x;
      se += x * m.seatPrices[i];
    }
  }
  return {
    adopted: (wh.adopted * m.price) / 1e9, agent: (wh.supervising * ag) / 1e9, seat: (wh.seats * se * 12) / 1e9,
    agentHours: wh.supervising * agH, seats: wh.seats * seN,
  };
}
/** AI spend of one sector in one region ($B/yr): adopted hours, agent-hours and seats (sectorSpendParts). */
export function sectorSpend(s: GameStateV2, r: RegionId, sid: SectorId, mix: WorldMix): Money {
  const p = sectorSpendParts(s, r, sid, mix);
  return p.adopted + p.agent + p.seat;
}
/** Consumer users of a region (weekly: online adults × reach, A2b: the reach stock of that region). */
export const consumerUsers = (s: GameStateV2, r: RegionId) => CONSUMER_MKT.adults[r] * (s.world.fx.reach?.[r] ?? 0);
/** Consumer subscribers of a region, all providers: users × each provider's user share × its paid share. */
export function regionSubscribers(s: GameStateV2, mix: WorldMix, r: RegionId): number {
  const cm = mix.consumer[r];
  let p = 0;
  for (let i = 0; i < cm.share.length; i++) p += cm.share[i] * cm.paid[i];
  return consumerUsers(s, r) * p;
}
/** Consumer spend by region ($B/yr): subscribers × each provider's price per month × 12. */
export function consumerSpend(s: GameStateV2, mix: WorldMix, r: RegionId): Money {
  const cm = mix.consumer[r];
  let p = 0;
  for (let i = 0; i < cm.share.length; i++) p += cm.share[i] * cm.paid[i] * cm.prices[i];
  return (consumerUsers(s, r) * p * 12) / 1e9;
}

/** Serving H100e of the moonshot projects (taken out of the serving pool first). */
export function moonshotH100e(s: GameStateV2): number {
  let share = 0;
  const techs = s.world.techs;
  for (const k in techs) share += techs[k as keyof typeof techs].playerProject?.computeShare ?? 0; // P4: Object.values order, no array
  return s.player.computeOnline * share;
}

/** Serving pool for products (H100e): the serving share of online compute minus moonshot projects. */
export function servingPool(s: GameStateV2): number {
  return Math.max(0, s.player.computeOnline * s.player.split.serving - moonshotH100e(s));
}

/** Idle serving compute (H100e; J2 PR1, RD-A05b): serving compute no product needs, the pool minus what each product uses (its serving up to
 *  its need, as the revenue system last computed it). 0 until every product has been served once. It stays idle on the
 *  serving line (DD-19) unless the auto-split policy moves it. */
export function idleServing(s: GameStateV2): number {
  const pool = servingPool(s);
  if (pool <= 0) return 0;
  let used = 0;
  let n = 0;
  for (const d of paidDeployments(s)) {
    if (d.needH100e === undefined) return 0;
    used += Math.min(d.servedH100e ?? 0, d.needH100e);
    n++;
  }
  // servedH100e and needH100e are stored rounded to whole H100e: a gap within that rounding is not spare (A5).
  const spare = pool - used;
  return spare > 0.5 * n ? spare : 0;
}

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

interface Acc {
  dem: number; hours: number; need: number; cost: number; capped: number; users: number; subs: number; needPaid: number; subCost: number; subPrice: number; paidTarget: number;
  adopted: number; agent: number; adoptedDem: number; agentDem: number; seats: number; seatHours: number; seatDem: number; seatNeed: number; seatCost: number; seatPrice: number;
  tH: number[]; tD: number[];
}
const acc0 = (): Acc => ({
  dem: 0, hours: 0, need: 0, cost: 0, capped: 0, users: 0, subs: 0, needPaid: 0, subCost: 0, subPrice: 0, paidTarget: 0,
  adopted: 0, agent: 0, adoptedDem: 0, agentDem: 0, seats: 0, seatHours: 0, seatDem: 0, seatNeed: 0, seatCost: 0, seatPrice: 0,
  tH: [], tD: [],
});
/** TIERS readout: add `x` billed hours at per-tier prices `priceOf(k)` split by the tier weights `tw` (main model alone
 *  without weights). */
function addTiers(a: Acc, line: readonly Offer[], tw: readonly number[] | undefined, x: number, priceOf: (t: Offer) => number) {
  for (let k = 0; k < line.length; k++) {
    const w = tw ? tw[k] ?? 0 : k === 0 ? 1 : 0;
    if (!(w > 0)) continue;
    a.tH[k] = (a.tH[k] ?? 0) + x * w;
    a.tD[k] = (a.tD[k] ?? 0) + (x * w * priceOf(line[k])) / 1e9;
  }
}
/** Seat channel weights (A2c): seats are sold by Enterprise, and by Gov in GOV/MIL [D]. */
const SEAT_WEIGHT: Partial<Record<Channel, number>> = { enterprise: 1, gov: 1 };

/** A product's need segments with their demand $ (B/yr), in serving order. */
interface Seg { need: number; dem: Money }

/** Full revenue computation (pure; the system applies it). */
export function revenueReadout(s: GameStateV2, mix: WorldMix = worldMix(s), offers?: Map<string, Offer>): RevenueReadout {
  const deps = paidDeployments(s);
  const playerIdx = mix.providers.findIndex((p) => p.key === 'player');
  const acc = new Map<string, Acc>(deps.map((d) => [d.id, acc0()]));
  const marketSpend = { US: 0, CN: 0, ROW: 0 } as Record<RegionId, Money>;
  const consumerSpendR = { US: 0, CN: 0, ROW: 0 } as Record<RegionId, Money>;
  const playerAgent: RevenueReadout['playerAgent'] = { US: {}, CN: {}, ROW: {} };
  const rate = serveDollarsPerHour(s);
  const tl = s.hidden.timeline;

  // Sector demand. Channel weights per sector are region-independent: compute once; offers per (product, sector) too.
  const sectorDeps = deps.filter((d) => SECTOR_CHANNELS.includes(d.channel));
  const fxs = new Map(sectorDeps.map((d) => [d.id, productFx(s, d)]));
  const usesOf = new Map(deps.map((d) => [d.id, productUses(s, d)]));
  const baseW = sectorDeps.map((d) => {
    let x = CH_WEIGHT[d.channel] ?? 0;
    if (d.channel === 'agents') x *= sigmoid(((productDomains(s, d)?.AGENCY ?? 0) - 6) / 1);
    return x;
  });
  // A2c: agent-hours go to API, Agents (× the share of half-day tasks its model completes: the Agents horizon gate's task
  // length on the METR curve) and Enterprise usage; seats to Enterprise (Gov in GOV/MIL).
  const agW = sectorDeps.map((d) => {
    let x = AGENT_WORK.channel[d.channel as keyof typeof AGENT_WORK.channel] ?? 0;
    if (d.channel === 'agents') {
      const v = versionById(s, d.versionId);
      x *= v ? pSuccess(AGENT_TASK_HOURS, h50Of(tl, v, 'AGENCY')) : 0;
    }
    return x;
  });
  interface Row { d: Deployment; w: number; wAg: number; wSeat: number; o: Offer; line: Offer[]; en: number }
  const secW = SECTORS.map((def) => {
    const ws: Row[] = [];
    let wsum = 0;
    let agSum = 0;
    let seatSum = 0;
    sectorDeps.forEach((d, i) => {
      if (d.channel === 'gov' && !GOV_SECTORS.has(def.id)) return;
      const focus = d.channel === 'enterprise' && d.packs.some((p) => p.sector === def.id) ? 3 : 1;
      const x = baseW[i] * focus;
      const wAg = agW[i] * focus;
      const wSeat = (SEAT_WEIGHT[d.channel] ?? 0) * focus;
      if (x <= 0 && wAg <= 0 && wSeat <= 0) return;
      // P2: `offers` = the mix's own player offers when the state has not changed since (same inputs, same values).
      const o = offers?.get(`${d.id}|${def.id}`) ?? productOffer(s, d, def.id, usesOf.get(d.id), fxs.get(d.id));
      // TIERS: the product's lineup (main model, lineup students, its mini), blended per region by the hours its buyers
      // take on each tier (the mix's playerTierW).
      let line = offers ? mix.lineupBy?.get(`${d.id}|${def.id}`) : undefined;
      if (!line) {
        const mu = productMiniUses(s, d);
        const om = mu ? productOffer(s, d, def.id, mu, fxs.get(d.id)) : undefined;
        line = productLineup(s, d, def.id, o, om, fxs.get(d.id));
      }
      ws.push({ d, w: x, wAg, wSeat, o, line, en: 1 + enablerShare(fxs.get(d.id) ?? [], def.id) });
      wsum += x;
      agSum += wAg;
      seatSum += wSeat;
    });
    return { ws, wsum, agSum, seatSum };
  });
  for (const r of REGIONS) {
    SECTORS.forEach((def, si) => {
      const m = mix.sec[r][def.id];
      const st = s.world.sectors[r][def.id];
      marketSpend[r] += sectorSpend(s, r, def.id, mix);
      if (playerIdx < 0 || !m.share[playerIdx]) return;
      const wh = workHoursOf(st, def.id);
      const ps = m.share[playerIdx];
      const hf = savedAt(st.alpha);
      const { ws: ws0, wsum, agSum, seatSum } = secW[si];
      const ws = ws0.map((x) => (x.line.length > 1 ? { ...x, o: blendTiers(x.line, m.playerTierW?.[x.d.id]), tw: m.playerTierW?.[x.d.id] } : x));
      const value = valuePerHour(s, def.id, r);
      const wage = wagePerHour(def.id, r);
      // RD-B11 (B14): an enabler's segment is held to the sector's adoption: the player's hours, agent-hours and seats
      // here never exceed the sector's (share × (1 + enabler) ≤ 1).
      const enMax = 1 / ps;
      const fOf = (d: Deployment, en: number) => {
        let f = Math.min(en, enMax);
        if (d.channel === 'api' || d.channel === 'agents') f *= 1 - 0.02 * d.kyc;
        if (d.status === 'restricted') f *= 0.3;
        return f;
      };
      // A4: the mix's ceiling factor (fill) scales every provider's agent-hours; the player's products can add more here
      // than its share of the mix's view (enabler segments, channel weights, each product's own k), so its agent-hours are
      // also held to the room the ceiling leaves after the adopted hours and the other providers' agent-hours (hours and
      // value). 1 below the ceiling.
      const ac = m.agentCeiling;
      let pScale = 1;
      if (agSum > 0) {
        let rawH = 0;
        let rawS = 0;
        for (const { d, wAg, o, en } of ws) {
          if (!(wAg > 0)) continue;
          const ag = agentDemandOf(o, wage);
          const x = ((ps * wh.supervising * wAg) / agSum) * fOf(d, en) * ag.k * ac.fill;
          rawH += x;
          rawS += x * ag.price;
        }
        if (rawH > 0) {
          let oH = 0;
          let oS = 0;
          for (let i = 0; i < m.share.length; i++) if (i !== playerIdx && m.share[i]) {
            oH += m.share[i] * m.agentK[i];
            oS += m.share[i] * m.agentK[i] * m.agentPrices[i];
          }
          const roomH = Math.max(0, ac.hours - wh.adopted - wh.supervising * oH);
          const roomS = Math.max(0, ac.value * 1e9 - wh.adopted * m.price - wh.supervising * oS);
          if (rawH > roomH) pScale = roomH / rawH;
          if (rawS * pScale > roomS) pScale = roomS / rawS;
        }
      }
      for (const { d, w: x0, wAg, wSeat, o, en, line, tw } of ws as (Row & { tw?: number[] })[]) {
        const f = fOf(d, en);
        const a = acc.get(d.id)!;
        // Adopted task-hours, billed per hour.
        if (wsum > 0 && x0 > 0) {
          let x = ((ps * wh.adopted * x0) / wsum) * f;
          // usage policy "no drop-in replacement" caps the player's α at 0.5 (fewer hours per adopted task)
          if (d.usagePolicy.noDropInReplacement) x *= savedAt(Math.min(st.alpha, 0.5)) / hf;
          // RD-B11 (B16): o.price already carries the channel's price (Trusted ×3, productOffer).
          const want = o.price;
          const price = Math.max(o.cost, Math.min(want, value));
          a.dem += (x * price) / 1e9;
          a.hours += x;
          a.adopted += x;
          a.adoptedDem += (x * price) / 1e9;
          addTiers(a, line, tw, x, (t) => Math.max(t.cost, Math.min(t.price, value)));
          a.need += (x * o.hph) / SERVE_HOURS_PER_YEAR;
          a.cost += (x * o.cost) / 1e9;
          if (want > value) a.capped += (x * price) / 1e9;
        }
        // Agent-hours (A2c): k after the buyer's gate × the supervising hours, billed per hour (≤ the wage); A4: × the
        // share the sector's demand ceiling lets be bought (1 below it).
        if (agSum > 0 && wAg > 0) {
          const ag = agentDemandOf(o, wage);
          const x = ((ps * wh.supervising * wAg) / agSum) * f * ag.k * ac.fill * pScale;
          playerAgent[r][def.id] = (playerAgent[r][def.id] ?? 0) + x;
          a.dem += (x * ag.price) / 1e9;
          a.hours += x;
          a.agent += x;
          a.agentDem += (x * ag.price) / 1e9;
          addTiers(a, line, tw, x, (t) => Math.max(t.costAg, Math.min(t.priceAg, wage)));
          a.need += (x * o.hphAg) / SERVE_HOURS_PER_YEAR;
          a.cost += (x * o.costAg) / 1e9;
          if (o.priceAg > ag.price) a.capped += (x * ag.price) / 1e9;
        }
        // Paid seats (A2c): seats × seat price × 12; their assisted hours need serving, served first.
        if (seatSum > 0 && wSeat > 0) {
          const g = (wSeat / seatSum) * f;
          const n = ps * wh.seats * g;
          const hs = ps * wh.seated * g;
          a.seats += n;
          a.seatHours += hs;
          a.seatDem += (n * o.seat * 12) / 1e9;
          a.seatNeed += (hs * o.hphAs) / SERVE_HOURS_PER_YEAR;
          a.seatCost += (hs * o.hphAs * rate) / 1e9;
          a.seatPrice = o.seat;
        }
      }
    });
    // Consumer demand: users of the player's chat products (customer stock × reach), paying subscribers × price.
    consumerSpendR[r] = consumerSpend(s, mix, r);
    const cm = mix.consumer[r];
    if (playerIdx >= 0 && cm.share[playerIdx] > 0) {
      const cdeps = deps.filter((d) => d.channel === 'consumer');
      const offs = cdeps.map((d) => {
        const uses = usesOf.get(d.id) ?? [];
        const fx = productFx(s, d);
        const x = fxOn(fx, 'CHAT');
        const e = effortTokens(d.effort);
        const ud = decodeUtilNow(s);
        const o = offerOf(s, uses, 'CHAT', { dG: settingsDG(d) + x.dG, hMult: x.hMult, effort: e, markup: markupOf(d), rate, ud });
        const main = versionById(s, d.versionId);
        const fMain = main ? flopPerToken(s, main) : 2e12;
        // D10: reasoning tokens × effort × the model's τ (tokEff). A7: free users run the product's free tier (its mini,
        // else the cheapest student of its model, chatFreeTier); paying users the main model.
        const tMain = tokEff(main);
        const ft = chatFreeTier(s, d);
        const sp = subPrice(s, fMain, markupOf(d), e * tMain, ud);
        return { d, o, sp, fMain, fFree: ft?.fpt ?? fMain, freeFit: ft?.fit ?? o.fit, e, tMain, tFree: ft?.tau ?? tMain, ud };
      });
      const best = Math.max(...offs.map((x) => x.freeFit));
      // A5: users pick by quality alone (most pay nothing), as the market's user-share logit; A7: on the free tier's.
      const ws = offs.map((x) => Math.exp(SHARE_SLOPE_G * (x.freeFit - best)));
      const wsum = ws.reduce((a, b) => a + b, 0) || 1;
      const users = cm.share[playerIdx] * consumerUsers(s, r);
      // A2b: the player's paid share (stock) applies to each of its chat products; subscribers × price × 12 is the line.
      const P = cm.paid[playerIdx];
      offs.forEach((x, i) => {
        // RD-B11 (B14): Chat's enablers act once, in the users' app choice (worldfx/mix.ts appeal), not again here.
        let u = (users * ws[i]) / wsum;
        if (x.d.status === 'restricted') u *= 0.3;
        const subs = u * P;
        const a = acc.get(x.d.id)!;
        a.users += u;
        a.subs += subs;
        a.dem += (subs * x.sp.price * 12) / 1e9;
        a.cost += (subs * x.sp.cost * 12) / 1e9;
        // A6b: plans sell at the market's flat price; only a tier that asks more than the willingness to pay (Premium) is
        // held at it.
        if (markupOf(x.d) > MARKUP.standard + 1e-9 && x.sp.price >= CONSUMER_MKT.wtpMonth - 1e-9) a.capped += (subs * x.sp.price * 12) / 1e9;
        const paid = (subs * chatHoursPerDay(x.fMain, CONSUMER_MKT.perDay.paid, x.e * x.tMain, x.ud)) / 24;
        const free = ((u - subs) * chatHoursPerDay(x.fFree, CONSUMER_MKT.perDay.free, x.tFree, x.ud)) / 24;
        a.needPaid += paid;
        a.need += paid + free;
        a.subCost = x.sp.cost;
        a.subPrice = x.sp.price;
        a.paidTarget = cm.paidTarget[playerIdx];
      });
    }
  }

  // Serving split, capacity and the binding cause. Need segments in serving order: Chat's paying users, then its free
  // users (earning nothing, served last); a sector product's seated hours (seat revenue), then its per-hour work.
  const segsOf = (d: Deployment): Seg[] => {
    const a = acc.get(d.id)!;
    const mon = 1 + monitorOverhead(s, d);
    if (d.channel === 'consumer') return [{ need: a.needPaid * mon, dem: a.dem }, { need: (a.need - a.needPaid) * mon, dem: 0 }];
    const work = { need: a.need * mon, dem: a.dem };
    return a.seatNeed > 0 || a.seatDem > 0 ? [{ need: a.seatNeed * mon, dem: a.seatDem }, work] : [work];
  };
  const segs = new Map(deps.map((d) => [d.id, segsOf(d)]));
  const split = servingSplit(s, deps, (d) => segs.get(d.id)!.map((x) => ({ need: x.need, rpH: x.need > 0 ? (x.dem * 1e9) / x.need : 0 })));
  const out: DeploymentRevenue[] = [];
  let total = 0;
  let D = 0;
  let C = 0;
  for (const d of deps) {
    const a = acc.get(d.id)!;
    const sg = segs.get(d.id)!;
    const sp = split.get(d.id)!;
    const h = sp.h;
    const mon = 1 + monitorOverhead(s, d);
    const need = sp.need;
    const demand = sg.reduce((x, y) => x + y.dem, 0);
    // Segments are served in order (paying consumers before free users; seats before per-hour work).
    let left = h;
    let revenue = 0;
    for (const x of sg) {
      const got = Math.min(left, x.need);
      revenue += x.need > 0 ? (x.dem * got) / x.need : x.dem;
      left -= got;
    }
    // Capacity ($B/yr the served H100e could earn): consumers at the paying users' rate; sector products in serving order
    // (seats, then per-hour work), H100e beyond the need at the per-hour work's rate.
    let capacity: number;
    if (d.channel === 'consumer') capacity = a.needPaid * mon > 0 ? (demand * h) / (a.needPaid * mon) : 0;
    else {
      const last = sg[sg.length - 1];
      capacity = revenue + (last.need > 0 ? (last.dem * Math.max(0, left)) / last.need : 0);
    }
    let bound: DeploymentRevenue['bound'];
    if (demand <= 1e-6) bound = 'demand';
    else if (need > h * 1.0001) bound = 'capacity';
    else bound = d.price === 'premium' ? 'price' : 'quality';
    const allHours = a.hours + a.seatHours;
    out.push({
      id: d.id, channel: d.channel, demand, capacity, revenue, bound, servingH100e: h, rpH: sp.rpH, needH100e: need, cutH100e: sp.cut,
      hours: a.hours, capHours: allHours > 0 && need > 0 ? (allHours * h) / need : 0,
      costPerHour: a.hours > 0 ? (a.cost * 1e9) / a.hours : 0, pricePerHour: a.hours > 0 ? (a.dem * 1e9) / a.hours : 0,
      valueCapped: demand > 0 ? a.capped / demand : 0,
      ...(d.channel === 'consumer' ? {
        users: a.users, subs: a.subs, subCost: a.subCost, subPrice: a.subPrice, paidTarget: a.paidTarget,
        needPaid: a.needPaid * mon, needFree: (a.need - a.needPaid) * mon, cutFree: Math.max(0, Math.min((a.need - a.needPaid) * mon, sp.cut)),
      } : {
        adoptedHours: a.adopted, agentHours: a.agent, adoptedDemand: a.adoptedDem, agentDemand: a.agentDem, seats: a.seats, seatHours: a.seatHours, seatDemand: a.seatDem,
        seatPrice: a.seatPrice, seatCost: a.seats > 0 ? (a.seatCost * 1e9) / (a.seats * 12) : 0, needSeat: a.seatNeed * mon,
        tiers: Array.from({ length: Math.max(a.tH.length, a.tD.length) }, (_, k) => ({ hours: a.tH[k] ?? 0, dem: a.tD[k] ?? 0 })),
      }),
    });
    total += revenue;
    D += demand;
    C += capacity;
  }
  return { deps: out, total, demand: D, capacity: C, marketSpend, consumerSpend: consumerSpendR, playerAgent };
}

/** Revenue rate ($B/yr) of a deployment, as last computed by the revenue system. */
export function revenueOf(s: GameStateV2, deploymentId: string): Money {
  return s.player.deployments.find((d) => d.id === deploymentId)?.revenueRate ?? 0;
}

/** Market revenue ($B/yr) of provider index i in a sector and region (A2c): its customer share × (adopted task-hours ×
 *  its price per hour + supervising hours × its agent-hours per supervising hour × its price per agent-hour + seats × its
 *  seat price × 12). */
export function providerSectorRevenue(s: GameStateV2, mix: WorldMix, r: RegionId, sid: SectorId, i: number): Money {
  const m = mix.sec[r][sid];
  const x = m.share[i];
  if (!x) return 0;
  const wh = workHoursOf(s.world.sectors[r][sid], sid);
  return (x * (wh.adopted * m.prices[i] + wh.supervising * m.agentK[i] * m.agentPrices[i] + wh.seats * m.seatPrices[i] * 12)) / 1e9;
}
/** Market revenue ($B/yr) a non-player lab earns from its public model at its customer share (demand-side: sector work
 *  — adopted hours, agent-hours, seats — at its prices, consumer subscribers at its price; WS4 uses it for rival
 *  finance). */
export function labMarketRevenue(s: GameStateV2, lab: LabId, mix: WorldMix = worldMix(s)): Money {
  const i = mix.providers.findIndex((p) => p.key === lab);
  if (i < 0) return 0;
  let x = 0;
  for (const r of REGIONS) {
    for (const def of SECTORS) x += providerSectorRevenue(s, mix, r, def.id, i);
    const cm = mix.consumer[r];
    x += (cm.share[i] * consumerUsers(s, r) * cm.paid[i] * cm.prices[i] * 12) / 1e9;
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
  const fresh = !ctx.memo.has('WS5:mix'); // computed just now: nothing has changed since, so its offers can be reused
  const mix = worldMix(s, ctx);
  const rd = revenueReadout(s, mix, fresh ? mix.offerBy : undefined);
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
    if (x.needPaid !== undefined) d.needPaidH100e = Math.round(x.needPaid);
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

  // Share erosion when capacity-bound (0.5%/day of the unserved share of the need), slow recovery when there is slack.
  const pen = s.world.fx.capPenalty;
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
    else pen[key] = Math.max(0, pen[key] - 0.03 * ((got - need) / Math.max(got, 1e-9)));
  };
  upd('consumer', (x) => x.channel === 'consumer');
  upd('sector', (x) => x.channel !== 'consumer');
  return rd;
}
