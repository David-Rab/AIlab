// Revenue per product: demand in AI work-hours (sectors) and subscribers (consumer) × the product's price, against its
// serving capacity (V2-SPEC §3.11.3; model v3 V4.2: design/MODEL-V3.md §7.3, design/V3-BUILD.md "V4 notes"). Owner: WS5.
//
//   use_s,r     = U_s·E0_s·2000   hours of AI use (A2a, worldfx/use.ts): U = A + h_s·(W − A), every task-hour firms
//                 handed to AI (A, research/16) plus workers' assisted use (W workers, h_s of their other hours)
//   A2c billing (worldfx/use.ts workHoursOf; data/v2/serving.ts SEATS, AGENT_WORK):
//     adopted A-hours   billed per hour: price = min(cost per adopted hour + M, value = wage × (α + (1 − α)·g_aug)), MK-6
//                       the lab's Nash–Bertrand margin M per region (× the stance factor; worldfx/mix.ts playerLines)
//     seats             σ·W·E paid seats × seat price × 12; their assisted (seated) hours need serving, billed by the seat
//     unseated hours    free, bundled, in-house: billed by no one here, served by the users' consumer apps (A2b)
//     agent-hours       k (after the buyer's gate) × supervising hours ((1 − α)·A-hours + seated hours), billed per hour at
//                       their cost × the tier's price-to-cost ratio (≤ the wage); A4: only up to the sector's work demand
//                       (mix agentCeiling: adopted + agent hours ≤ E0·2000·(1 + η·CR), spend ≤ that × the wage), the
//                       rest is not bought (no revenue, no serving need)
//   player      = customer-stock share × each stream × the product's part (RD-P03: the buyers' choice among the
//                 player's products, each its own seller in the surplus choice, mix playerProdW; a product's tools act in
//                 its offer, RD-P07); seats from its seat-selling products (Enterprise; Gov in GOV/MIL) by those parts
//   demand $    = Σ hours × price + seats × seat price × 12;  need H100e = Σ hours × H100e-hours per hour ÷ 8766 (+ monitor)
//   consumer    = users (online adults × reach R_r × user share, both stocks) × paid share P (a stock, A2b) = subscribers;
//                 revenue line = subscribers × price per month × 12 (A6b: the market's flat plan price, the willingness to
//                 pay on Standard, not cost-plus), independent of work
//                 hours; free users (users − subscribers) run on its free tier (A7 / RD-P01a: the real model in its free-tier slot,
//                 default the lineup's cheapest; worldfx/serving.ts chatFreeTier), pay nothing and are
//                 served last; need from usage per user-day (paid 30k/8k, free 7.5k/1.5k tokens)
//   revenue     = demand $ × min(1, served ÷ need)   (consumer: paying users are served first)
// MK-7 rationing (design/MARKET.md M7, research/MARKET-sources.md §4): a product short of serving compute keeps its list
// price and serves the hours its compute allows (segments in order: seats before per-hour work, paying users before free
// ones); every buyer of it is served the same fraction (proportional rationing [D]). The turned-away buyers re-run their
// group's choice without it (worldfx/mix.ts rerunChoice): their hours go to their next-best offer among those their group
// reaches, or to no AI (choice sets with nothing else they reach). One pass over the capped products in serving order
// (most revenue per H100e first): a receiving player product takes hours only into its spare serving compute, the
// excess goes to the cell's other destinations with room, else no AI (not re-run). MK-8: a closed rival (and DeepCent)
// takes hours into its room only, its serving capacity less its own buyers' serving (sellerCaps); one with no room is
// left out of the re-run; open weights take every hour (many hosts). Spilled hours are billed at the receiver's price per
// adopted hour (agent and seated hours at that price too [D]). Chat: free users are rate-limited (no spillover, no share
// loss); turned-away subscribers go to the other apps with room by their user shares (the logit's IIA), up to that room. Customers stay with the lab (M4): its stock
// moves toward the target on served hours, min(choice target, stock × (served + spare) ÷ asked), the released share
// to the sellers that took its buyers (no AI is not a stock: normalisation spreads it).
// Serving split (R6): with the Auto policy (default) each product needs its H100e; the pool serves the products earning
// most per H100e first and records what it cuts; spare pool is spread over the products in proportion to need. With Auto
// off the products keep the shares set by hand (scaled if > 100%). Capacity-bound products ration (MK-7, above);
// demand-bound ones report quality or price.
// Gov and trusted contract lump sums arrive through events/actions (WS4), not here.
import { productSafeguardOverhead, productUsageMult } from '../safety/safeguards';
import { REGIONS, ECON, SECTORS } from '../../../data/v2/sectors';
import { CONSUMER_MKT, SERVE_HOURS_PER_YEAR, SHARE_SLOPE_G } from '../../../data/v2/serving';
import type { Channel, Deployment, EngineSystem, GameStateV2, LabId, Money, RegionId, SectorId, SystemCtx } from '../types';
import { BUYER_GROUP_IDS, SECTOR_CHANNELS, advanceCustomers, paidDeployments, rerunChoice, worldMix, type BuyerGroupId, type ServedTargets, type WorldMix } from './mix';
import type { Choice } from './choice';
import { monitorOverhead } from '../models/products';
import { CHINA_ID, versionById } from '../models/labs';
import { shareRefAt } from '../departments/split';
import { decimalYear } from '../core/time';
import { savedAt, useShareOf, workHoursOf } from './use';
import { bookCash } from '../finance/ledger';
import { revenueToParent } from '../finance/parent';
import { flopPerToken } from '../departments/workfit';
import {
  agentDemandOf, blendTiers, chatFreeTier, lineupVersions, chatHoursPerDay, fxOn, offerOf, productFx, stanceFactor, productLineup, productOffer, productUses, serveDollarsPerHour,
  settingsDG, subPrice, tokEff, valuePerHour, wagePerHour, type Offer,
} from './serving';
import { decodeUtilNow } from '../models/stacks';
import { kycDemandFactor } from '../models/deployments';
import { PEAK_FLOPS } from '../../../data/v2/workTypes';

// RD-P03 (DD-02): the player's sector hours split between its products by the buyers' choice (each product its own
// seller, worldfx/mix.ts playerProdW), not by channel weights. Trusted access's ×3 price is in its offer (RD-B11 B16).
const GOV_SECTORS = new Set(['GOV', 'MIL']);

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
  /** RD-P10: output tokens a day each of its models serves (Deployment.servedBy). */
  servedBy: Record<string, number>;
  /** MK-7 (M7): the buyers it turned away (short of serving compute) and where they went; the buyers it took from the
   *  player's capacity-short products into its spare compute (in revenue). */
  turnedAway: TurnedAway;
  spillIn: { hours: number; dollars: Money };
}

/** MK-7: buyers turned away: billed AI work-hours a year (sector products: adopted, agent and seated hours) and Chat
 *  subscribers, their revenue at the product's list price ($B/yr); `to` by destination (a player product id, a rival's
 *  provider key, 'none' = no AI): the hours or subscribers and what the receiving seller earns on them ($B/yr at its
 *  own price; 0 for no AI). */
export interface TurnedAway {
  hours: number;
  subs: number;
  dollars: Money;
  to: Record<string, { hours: number; subs: number; dollars: Money }>;
}
const noneAway = (): TurnedAway => ({ hours: 0, subs: 0, dollars: 0, to: {} });
function addAway(t: TurnedAway, key: string, hours: number, subs: number, dollars: Money) {
  const x = (t.to[key] ??= { hours: 0, subs: 0, dollars: 0 });
  x.hours += hours;
  x.subs += subs;
  x.dollars += dollars;
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
  /** MK-7: buyers turned away by all the player's products; what other sellers earn on them (provider key → $B/yr);
   *  the customer-stock targets on served hours where they differ from the choice's. */
  turnedAway: TurnedAway;
  spillRev: Record<string, Money>;
  served: ServedTargets;
}

/** MK-8 (design/MARKET.md M11): a non-player seller's serving capacity, the serving its own buyers take, and the room
 *  left for buyers turned away by others (H100e). A closed lab (rival or DeepCent):
 *    capacity = its online compute × the reference serving share (departments/split.ts shareRefAt: it serves as the
 *               reference lab does [D]);
 *    own      = Σ over sectors × regions of its share × (adopted hours × hph + agent-hours × hphAg + seated hours ×
 *               hphAs where it sells seats) ÷ SERVE_HOURS_PER_YEAR, hph its tier mix there (the mix's tier weights and
 *               offers: its served model's FLOP per token and decode utilisation, as its offers price cost), plus its
 *               chat users (users × its user share: subscribers on its model, free users on its cheapest tier, the
 *               player's usage per user-day);
 *    room     = max(0, capacity − own).
 *  `hours`: the capacity in work-hours a year at its own sector H100e-hours per hour. Open weights (and the player's
 *  open release): many hosts, no limit (Infinity). Its own demand above capacity is not rationed yet (`over`). */
export interface SellerCap { cap: number; own: number; ownSec: number; ownChat: number; secHours: number; hours: number; room: number; over: number }
export function sellerCaps(s: GameStateV2, mix: WorldMix): Map<string, SellerCap> {
  const out = new Map<string, SellerCap>();
  const serveShare = shareRefAt(decimalYear(s)).serving;
  mix.providers.forEach((q, j) => {
    if (q.key === 'player') return;
    const lab = q.key === CHINA_ID ? s.china.lab : s.rivals.find((r) => r.core.id === q.key);
    if (q.open || !lab) {
      out.set(q.key, { cap: Infinity, own: 0, ownSec: 0, ownChat: 0, secHours: 0, hours: Infinity, room: Infinity, over: 0 });
      return;
    }
    let sec = 0;
    let secH = 0;
    for (const r of REGIONS) {
      for (const def of SECTORS) {
        const m = mix.sec[r][def.id];
        const x = m.share[j];
        if (!x) continue;
        const wh = workHoursOf(s.world.sectors[r][def.id], def.id);
        const tw = m.tiers.weight[j] ?? [];
        const to = m.tiers.offers[j] ?? [];
        let hph = 0;
        let hAg = 0;
        let hAs = 0;
        let ws = 0;
        for (let k = 0; k < tw.length; k++) {
          const o = to[k];
          if (!o || !(tw[k] > 0)) continue;
          hph += tw[k] * o.hph;
          hAg += tw[k] * o.hphAg;
          hAs += tw[k] * o.hphAs;
          ws += tw[k];
        }
        if (!(ws > 0) && to[0]) {
          hph = to[0].hph;
          hAg = to[0].hphAg;
          hAs = to[0].hphAs;
        } else if (ws > 0 && Math.abs(ws - 1) > 1e-9) {
          hph /= ws;
          hAg /= ws;
          hAs /= ws;
        }
        const ad = x * wh.adopted;
        const ag = x * wh.supervising * m.agentK[j];
        const se = m.seatPrices[j] > 0 ? x * wh.seated : 0;
        secH += ad + ag + se;
        sec += (ad * hph + ag * hAg + se * hAs) / SERVE_HOURS_PER_YEAR;
      }
    }
    let chat = 0;
    if (q.model) {
      const fMain = q.fpt ?? 2e12;
      let free: { model: typeof q.model; fpt: number } = { model: q.model, fpt: fMain };
      for (const x of q.tiers ?? []) if (x.fpt < free.fpt) free = x;
      for (const r of REGIONS) {
        const cm = mix.consumer[r];
        const u = consumerUsers(s, r) * (cm.share[j] ?? 0);
        if (!(u > 0)) continue;
        const subs = u * (cm.paid[j] ?? 0);
        chat += (subs * chatHoursPerDay(fMain, CONSUMER_MKT.perDay.paid, tokEff(q.model), q.ud) + (u - subs) * chatHoursPerDay(free.fpt, CONSUMER_MKT.perDay.free, tokEff(free.model), q.ud)) / 24;
      }
    }
    const cap = Math.max(0, lab.core.computeOnline * serveShare);
    const own = sec + chat;
    out.set(q.key, { cap, own, ownSec: sec, ownChat: chat, secHours: secH, hours: sec > 0 ? (cap * secH) / sec : 0, room: Math.max(0, cap - own), over: Math.max(0, own - cap) });
  });
  return out;
}
/** MK-7 / MK-8: serving compute (H100e) a non-player seller can still put on buyers turned away by others (sellerCaps). */
export function sellerRoom(s: GameStateV2, key: string, mix: WorldMix = worldMix(s)): number {
  return sellerCaps(s, mix).get(key)?.room ?? Infinity;
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
 * H100e share what is left pro rata (MK-6: with every tier at its cost + one margin, a product with cheaper tiers earns more per H100e
 * of its need). Spare pool goes to every product in proportion to need. Manual: the products' own shares of the pool (scaled
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
  /** RD-P10: serving need (H100e, before the monitor) per sector lineup tier (index into the lineup); Chat's free users'
   *  need runs on `freeId`. */
  tN: number[]; freeId?: string;
}
const acc0 = (): Acc => ({
  dem: 0, hours: 0, need: 0, cost: 0, capped: 0, users: 0, subs: 0, needPaid: 0, subCost: 0, subPrice: 0, paidTarget: 0,
  adopted: 0, agent: 0, adoptedDem: 0, agentDem: 0, seats: 0, seatHours: 0, seatDem: 0, seatNeed: 0, seatCost: 0, seatPrice: 0,
  tH: [], tD: [], tN: [],
});
/** RD-P10: add `x` hours a year's serving need per tier (each tier's own H100e-hours per hour `hphOf`), split by `tw`. */
function addTierNeed(a: Acc, line: readonly Offer[], tw: readonly number[] | undefined, x: number, hphOf: (t: Offer) => number) {
  for (let k = 0; k < line.length; k++) {
    const w = tw ? tw[k] ?? 0 : k === 0 ? 1 : 0;
    if (w > 0) a.tN[k] = (a.tN[k] ?? 0) + (x * w * hphOf(line[k])) / SERVE_HOURS_PER_YEAR;
  }
}
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
/** Seat channels (A2c): seats are sold by Enterprise, and by Vetted in GOV/MIL (MK-1: Government's seats) [D]. */
// MK-6: Vetted sells seats in GOV/MIL as Government did and hours elsewhere as Trusted did, until one rule prices both.
const seatOf = (c: Channel, sector: string) => c === 'enterprise' || (c === 'vetted' && GOV_SECTORS.has(sector));

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
  const cells = new Map<string, Cell[]>();
  const ccells = new Map<string, CCell[]>();

  // Sector demand: offers per (product, sector) are region-independent: compute once.
  const sectorDeps = deps.filter((d) => SECTOR_CHANNELS.includes(d.channel));
  const fxs = new Map(sectorDeps.map((d) => [d.id, productFx(s, d)]));
  const usesOf = new Map(deps.map((d) => [d.id, productUses(s, d)]));
  interface Row { d: Deployment; seat: boolean; o: Offer; line: Offer[] }
  const secW = SECTORS.map((def) => {
    const ws: Row[] = [];
    for (const d of sectorDeps) {
      // P2: `offers` = the mix's own player offers when the state has not changed since (same inputs, same values).
      const o = offers?.get(`${d.id}|${def.id}`) ?? productOffer(s, d, def.id, usesOf.get(d.id), fxs.get(d.id));
      // TIERS: the product's lineup (main model, then its real lineup entries), blended per region by the hours its buyers
      // take on each tier (the mix's playerTierW).
      let line = offers ? mix.lineupBy?.get(`${d.id}|${def.id}`) : undefined;
      if (!line) {
        line = productLineup(s, d, def.id, o, fxs.get(d.id));
      }
      ws.push({ d, seat: seatOf(d.channel, def.id), o, line });
    }
    return ws;
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
      // RD-P03: each product's part of the player's hours here is the buyers' choice among its products (playerProdW);
      // seats are bought from its seat-selling products (Enterprise; Gov in GOV/MIL) in proportion to those parts.
      // MK-6: the product's lineup at this region's prices (cost + the lab's margin here, mix playerLines).
      const ws = secW[si].map((x) => {
        const line = m.playerLines?.[x.d.id] ?? x.line;
        return { ...x, line, o: line[0], w: m.playerProdW?.[x.d.id] ?? 0, ...(line.length > 1 ? { o: blendTiers(line, m.playerTierW?.[x.d.id]), tw: m.playerTierW?.[x.d.id] } : {}) };
      });
      let seatSum = 0;
      for (const x of ws) if (x.seat) seatSum += x.w;
      const value = valuePerHour(s, def.id, r);
      const wage = wagePerHour(def.id, r);
      // RD-P07 (DD-03): a product's tools act inside its offer (coverage, worldfx/serving.ts offerOf), so they reach the
      // hours only through the buyers' choice; no multiplier here (the RD-B11 capped ×(1 + enabler) is gone).
      const fOf = (d: Deployment) => {
        let f = 1;
        f *= kycDemandFactor(d); // RD-P09: anonymous buyers asked to verify who refuse are lost
        f *= productUsageMult(d); // SR-13b: restriction and the control protocol's Slowdown
        return f;
      };
      // A4: the mix's ceiling factor (fill) scales every provider's agent-hours; the player's products can add more here
      // than its share of the mix's view (each product's own k), so its agent-hours are
      // also held to the room the ceiling leaves after the adopted hours and the other providers' agent-hours (hours and
      // value). 1 below the ceiling.
      const ac = m.agentCeiling;
      let pScale = 1;
      {
        let rawH = 0;
        let rawS = 0;
        for (const { d, w, o } of ws) {
          if (!(w > 0)) continue;
          const ag = agentDemandOf(o, wage);
          const x = ps * wh.supervising * w * fOf(d) * ag.k * ac.fill;
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
      for (const { d, w, seat, o, line, tw } of ws as (Row & { w: number; tw?: number[] })[]) {
        const f = fOf(d);
        const a = acc.get(d.id)!;
        const c0 = { adopted: a.adopted, agent: a.agent, dem: a.dem, need: a.need, seats: a.seats, seatHours: a.seatHours, seatDem: a.seatDem, seatNeed: a.seatNeed };
        // Adopted task-hours, billed per hour.
        if (w > 0) {
          let x = ps * wh.adopted * w * f;
          // usage policy "no drop-in replacement" caps the player's α at 0.5 (fewer hours per adopted task)
          if (d.usagePolicy.noDropInReplacement) x *= savedAt(Math.min(st.alpha, 0.5)) / hf;
          // MK-6: o.price is the region's (cost + M, value-capped; mix playerLines).
          const price = Math.max(o.cost, Math.min(o.price, value));
          a.dem += (x * price) / 1e9;
          a.hours += x;
          a.adopted += x;
          a.adoptedDem += (x * price) / 1e9;
          addTiers(a, line, tw, x, (t) => Math.max(t.cost, Math.min(t.price, value)));
          a.need += (x * o.hph) / SERVE_HOURS_PER_YEAR;
          addTierNeed(a, line, tw, x, (t) => t.hph);
          a.cost += (x * o.cost) / 1e9;
          if (price >= value * (1 - 1e-9)) a.capped += (x * price) / 1e9;
        }
        // Agent-hours (A2c): k after the buyer's gate × the supervising hours, billed per hour (≤ the wage); A4: × the
        // share the sector's demand ceiling lets be bought (1 below it).
        if (w > 0) {
          const ag = agentDemandOf(o, wage);
          const x = ps * wh.supervising * w * f * ag.k * ac.fill * pScale;
          playerAgent[r][def.id] = (playerAgent[r][def.id] ?? 0) + x;
          a.dem += (x * ag.price) / 1e9;
          a.hours += x;
          a.agent += x;
          a.agentDem += (x * ag.price) / 1e9;
          addTiers(a, line, tw, x, (t) => Math.max(t.costAg, Math.min(t.priceAg, wage)));
          a.need += (x * o.hphAg) / SERVE_HOURS_PER_YEAR;
          addTierNeed(a, line, tw, x, (t) => t.hphAg);
          a.cost += (x * o.costAg) / 1e9;
          if (o.priceAg > ag.price) a.capped += (x * ag.price) / 1e9;
        }
        // Paid seats (A2c): seats × seat price × 12; their assisted hours need serving, served first.
        if (seat && seatSum > 0 && w > 0) {
          const g = (w / seatSum) * f;
          const n = ps * wh.seats * g;
          const hs = ps * wh.seated * g;
          a.seats += n;
          a.seatHours += hs;
          a.seatDem += (n * o.seat * 12) / 1e9;
          a.seatNeed += (hs * o.hphAs) / SERVE_HOURS_PER_YEAR;
          addTierNeed(a, line, tw, hs, (t) => t.hphAs);
          a.seatCost += (hs * o.hphAs * rate) / 1e9;
          a.seatPrice = o.seat;
        }
        // MK-7: this sector-region's part of the product's demand (rationing and spillover read it).
        const cell: Cell = {
          r, sid: def.id, adopted: a.adopted - c0.adopted, agent: a.agent - c0.agent, dem: a.dem - c0.dem, need: a.need - c0.need,
          seats: a.seats - c0.seats, seatHours: a.seatHours - c0.seatHours, seatDem: a.seatDem - c0.seatDem, seatNeed: a.seatNeed - c0.seatNeed,
        };
        if (cell.adopted + cell.agent + cell.seatHours > 0) (cells.get(d.id) ?? cells.set(d.id, []).get(d.id)!).push(cell);
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
        const ud = decodeUtilNow(s);
        const o = offerOf(s, uses, 'CHAT', { dG: settingsDG(d) + x.dG, hMult: x.hMult, markup: 1, rate, ud });
        const main = versionById(s, d.versionId);
        const fMain = main ? flopPerToken(s, main) : 2e12;
        // D10: reasoning tokens × the model's τ (tokEff). A7: free users run the product's free tier
        // (RD-P01a: the real model in its free-tier slot, chatFreeTier); paying users the main model.
        const tMain = tokEff(main);
        const ft = chatFreeTier(s, d);
        // MK-9: the lab's plan margin (mix.plan) × the product's stance, ≤ the willingness to pay, ≥ cost.
        const sp = subPrice(s, fMain, stanceFactor(d) * (mix.plan.margin[playerIdx] ?? 0), tMain, ud);
        return { d, o, sp, fMain, freeId: ft?.id ?? d.versionId, fFree: ft?.fpt ?? fMain, freeFit: ft?.fit ?? o.fit, tMain, tFree: ft?.tau ?? tMain, ud };
      });
      const best = Math.max(...offs.map((x) => x.freeFit));
      // A5: users pick by quality alone (most pay nothing), as the market's user-share logit; A7: on the free tier's.
      const ws = offs.map((x) => Math.exp(SHARE_SLOPE_G * (x.freeFit - best)));
      const wsum = ws.reduce((a, b) => a + b, 0) || 1;
      const users = cm.share[playerIdx] * consumerUsers(s, r);
      // A2b: the player's paid share (stock) applies to each of its chat products; subscribers × price × 12 is the line.
      const P = cm.paid[playerIdx];
      offs.forEach((x, i) => {
        // RD-B11 (B14) / RD-P07: Chat's tools act once, in the users' app choice (worldfx/mix.ts appeal), not again here.
        let u = (users * ws[i]) / wsum;
        u *= productUsageMult(x.d); // SR-13b: restriction and the control protocol's Slowdown
        const subs = u * P;
        const a = acc.get(x.d.id)!;
        a.users += u;
        a.subs += subs;
        a.dem += (subs * x.sp.price * 12) / 1e9;
        a.cost += (subs * x.sp.cost * 12) / 1e9;
        const paid = (subs * chatHoursPerDay(x.fMain, CONSUMER_MKT.perDay.paid, x.tMain, x.ud)) / 24;
        const free = ((u - subs) * chatHoursPerDay(x.fFree, CONSUMER_MKT.perDay.free, x.tFree, x.ud)) / 24;
        a.needPaid += paid;
        a.freeId = x.freeId;
        a.need += paid + free;
        a.subCost = x.sp.cost;
        a.subPrice = x.sp.price;
        a.paidTarget = cm.paidTarget[playerIdx];
        (ccells.get(x.d.id) ?? ccells.set(x.d.id, []).get(x.d.id)!).push({ r, subs, dem: (subs * x.sp.price * 12) / 1e9 });
      });
    }
  }

  // Serving split, capacity and the binding cause. Need segments in serving order: Chat's paying users, then its free
  // users (earning nothing, served last); a sector product's seated hours (seat revenue), then its per-hour work.
  const segsOf = (d: Deployment): Seg[] => {
    const a = acc.get(d.id)!;
    const mon = 1 + monitorOverhead(s, d) + productSafeguardOverhead(d); // SR-13b: control compute billed to serving
    if (d.channel === 'consumer') return [{ need: a.needPaid * mon, dem: a.dem }, { need: (a.need - a.needPaid) * mon, dem: 0 }];
    const work = { need: a.need * mon, dem: a.dem };
    return a.seatNeed > 0 || a.seatDem > 0 ? [{ need: a.seatNeed * mon, dem: a.seatDem }, work] : [work];
  };
  const segs = new Map(deps.map((d) => [d.id, segsOf(d)]));
  const split = servingSplit(s, deps, (d) => segs.get(d.id)!.map((x) => ({ need: x.need, rpH: x.need > 0 ? (x.dem * 1e9) / x.need : 0 })));
  const out: DeploymentRevenue[] = [];
  const served = new Map<string, { seat: number; work: number }>();
  let total = 0;
  let D = 0;
  let C = 0;
  for (const d of deps) {
    const a = acc.get(d.id)!;
    const sg = segs.get(d.id)!;
    const sp = split.get(d.id)!;
    const h = sp.h;
    const mon = 1 + monitorOverhead(s, d) + productSafeguardOverhead(d); // SR-13b: control compute billed to serving
    const need = sp.need;
    const demand = sg.reduce((x, y) => x + y.dem, 0);
    // Segments are served in order (paying consumers before free users; seats before per-hour work).
    let left = h;
    let revenue = 0;
    const fr: number[] = [];
    for (const x of sg) {
      const got = Math.min(left, x.need);
      revenue += x.need > 0 ? (x.dem * got) / x.need : x.dem;
      fr.push(x.need > 0 ? got / x.need : 1);
      left -= got;
    }
    // MK-7: the served fraction of its seats and of its per-hour work (Chat: of its paying users).
    served.set(d.id, d.channel === 'consumer' ? { seat: 1, work: fr[0] } : sg.length > 1 ? { seat: fr[0], work: fr[1] } : { seat: 1, work: fr[0] });
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
    else bound = 'quality';
    const allHours = a.hours + a.seatHours;
    const servedBy = servedByModel(s, d, a, h, mon);
    out.push({
      id: d.id, channel: d.channel, demand, capacity, revenue, bound, servingH100e: h, rpH: sp.rpH, needH100e: need, cutH100e: sp.cut,
      hours: a.hours, capHours: allHours > 0 && need > 0 ? (allHours * h) / need : 0,
      costPerHour: a.hours > 0 ? (a.cost * 1e9) / a.hours : 0, pricePerHour: a.hours > 0 ? (a.dem * 1e9) / a.hours : 0,
      valueCapped: demand > 0 ? a.capped / demand : 0, servedBy, turnedAway: noneAway(), spillIn: { hours: 0, dollars: 0 },
      ...(d.channel === 'consumer' ? {
        users: a.users, subs: a.subs, subCost: a.subCost, subPrice: a.subPrice, paidTarget: a.paidTarget,
        needPaid: a.needPaid * mon, needFree: (a.need - a.needPaid) * mon, cutFree: Math.max(0, Math.min((a.need - a.needPaid) * mon, sp.cut)),
      } : {
        adoptedHours: a.adopted, agentHours: a.agent, adoptedDemand: a.adoptedDem, agentDemand: a.agentDem, seats: a.seats, seatHours: a.seatHours, seatDemand: a.seatDem,
        seatPrice: a.seatPrice, seatCost: a.seats > 0 ? (a.seatCost * 1e9) / (a.seats * 12) : 0, needSeat: a.seatNeed * mon,
        tiers: Array.from({ length: Math.max(a.tH.length, a.tD.length) }, (_, k) => ({ hours: a.tH[k] ?? 0, dem: a.tD[k] ?? 0 })),
      }),
    });
    D += demand;
    C += capacity;
  }
  const ra = ration(s, mix, playerIdx, out, cells, ccells, served);
  for (const x of out) total += x.revenue;
  return { deps: out, total, demand: D, capacity: C, marketSpend, consumerSpend: consumerSpendR, playerAgent, ...ra };
}

/** MK-7: one product's demand in one sector × region (hours a year; $B/yr; serving need in H100e before the monitor). */
interface Cell { r: RegionId; sid: SectorId; adopted: number; agent: number; dem: Money; need: number; seats: number; seatHours: number; seatDem: Money; seatNeed: number }
/** MK-7: a Chat product's paying subscribers in one region and their revenue ($B/yr). */
interface CCell { r: RegionId; subs: number; dem: Money }
/** MK-7: where a buyer group's turned-away buyers of one product go: per provider index (not the player's) and per other
 *  player product the share of their hours; the rest buy no AI. */
interface Divert { to: number[]; prod: Record<string, number>; none: number }

/** MK-7: the diversion of product `dep`'s buyers from choice `base` (with it) to `alt` (the same without it), band by
 *  band: each other seller's gain (shares of all buyers: share × Choice.tot) over `dep`'s share there; the rest (sets
 *  with nothing else) no AI. A product the choice gives no share (its buyers come from the stock): the alternative's
 *  shares. */
function divertOf(base: Choice, alt: Choice, p: number, tierDep: readonly string[], dep: string): Divert {
  const n = base.target.length;
  const B = base.mu.length;
  const to: number[] = [];
  for (let i = 0; i < n; i++) to.push(0);
  const prod: Record<string, number> = {};
  const others = [...new Set(tierDep)].filter((id) => id !== dep);
  const partOf = (ch: Choice, b: number, id: string) => {
    const sb = ch.sub[p]?.[b];
    let x = 0;
    if (sb && sb.length) {
      for (let k = 0; k < tierDep.length; k++) if (tierDep[k] === id) x += sb[k] ?? 0;
    } else {
      const k = ch.pick[p]?.[b] ?? -1;
      x = k >= 0 && tierDep[k] === id ? 1 : 0;
    }
    return (ch.share[p]?.[b] ?? 0) * x;
  };
  let dm = 0;
  for (let b = 0; b < B; b++) {
    const t0 = base.tot?.[b] ?? 1;
    const rb = t0 > 0 ? (alt.tot?.[b] ?? 1) / t0 : 0;
    const x = partOf(base, b, dep);
    if (!(x > 0)) continue;
    dm += x;
    for (let j = 0; j < n; j++) if (j !== p) to[j] += Math.max(0, alt.share[j][b] * rb - base.share[j][b]);
    for (const id of others) prod[id] = (prod[id] ?? 0) + Math.max(0, partOf(alt, b, id) * rb - partOf(base, b, id));
  }
  if (!(dm > 0)) {
    for (let b = 0; b < B; b++) {
      const t0 = base.tot?.[b] ?? 1;
      const rb = t0 > 0 ? (alt.tot?.[b] ?? 1) / t0 : 0;
      for (let j = 0; j < n; j++) if (j !== p) to[j] += (alt.share[j][b] * rb) / B;
      for (const id of others) prod[id] = (prod[id] ?? 0) + (partOf(alt, b, id) * rb) / B;
    }
    dm = 1;
  }
  let sum = 0;
  for (let j = 0; j < n; j++) sum += (to[j] /= dm);
  for (const id of others) sum += (prod[id] = (prod[id] ?? 0) / dm);
  if (sum > 1) {
    for (let j = 0; j < n; j++) to[j] /= sum;
    for (const id of others) prod[id] /= sum;
    sum = 1;
  }
  return { to, prod, none: Math.max(0, 1 - sum) };
}

/**
 * MK-7 (design/MARKET.md M7): rationing at the list price and spillover. Each capacity-short product (in serving order:
 * most revenue per H100e first) turns away (1 − served fraction) of its per-hour work and of its seated hours in every
 * sector × region; per buyer group (its hours there by w_g × the group's player share × its part) the group's choice is
 * re-run without it and without every seller that has no room left at that point (the player's products without spare
 * serving compute; MK-8: rivals with none), and the buyers go to the offers that gain (divertOf), else to no AI. A
 * player product takes them into its spare compute only (the excess: to the cell's other destinations that took theirs
 * in full, else no AI). Chat: turned-away subscribers go to the other apps by user share; free users are rate-limited.
 * Revenue of the receiving products is added to `out`; rivals' in spillRev. Customer-stock targets on served hours:
 * the player's min(choice target, stock × (served + spare) ÷ asked), the released share to the sellers that took its
 * buyers there (else by their targets).
 */
function ration(s: GameStateV2, mix: WorldMix, p: number, out: DeploymentRevenue[], cells: Map<string, Cell[]>, ccells: Map<string, CCell[]>, served: Map<string, { seat: number; work: number }>): Pick<RevenueReadout, 'turnedAway' | 'spillRev' | 'served'> {
  const total = noneAway();
  const spillRev: Record<string, Money> = {};
  const servedT: ServedTargets = { sec: { US: {}, CN: {}, ROW: {} }, consumer: {} };
  if (p < 0) return { turnedAway: total, spillRev, served: servedT };
  const n = mix.providers.length;
  const byId = new Map(out.map((x) => [x.id, x]));
  const depById = new Map(paidDeployments(s).map((d) => [d.id, d]));
  const monOf = (id: string) => {
    const d = depById.get(id);
    return d ? 1 + monitorOverhead(s, d) + productSafeguardOverhead(d) : 1;
  };
  const cellAt = new Map<string, Cell>();
  for (const [id, cs] of cells) for (const c of cs) cellAt.set(`${id}|${c.r}|${c.sid}`, c);
  // Room (H100e): a player product's spare serving compute; other sellers' (MK-8 sellerCaps; open weights unlimited).
  const room = new Map<string, number>();
  for (const x of out) room.set(x.id, Math.max(0, x.servingH100e - x.needH100e));
  const caps = sellerCaps(s, mix);
  const provRoom = mix.providers.map((q, i) => (i === p ? 0 : (caps.get(q.key)?.room ?? Infinity)));
  const rsRival = new Map<string, number[]>();
  const rsAbs = new Map<string, number>();
  const chMemo = new Map<string, Choice | undefined>();
  const memoCh = (k: string, f: () => Choice | undefined) => {
    if (!chMemo.has(k)) chMemo.set(k, f());
    return chMemo.get(k);
  };
  const zeros = () => mix.providers.map(() => 0);
  const order = out.filter((x) => x.channel !== 'consumer').sort((a, b) => b.rpH - a.rpH || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const x of order) {
    const fr = served.get(x.id);
    if (!fr) continue;
    const uW = Math.max(0, 1 - fr.work);
    const uS = Math.max(0, 1 - fr.seat);
    if (!(uW > 1e-9 || uS > 1e-9)) continue;
    const dropDeps = new Set<string>([x.id]);
    for (const y of order) if (!((room.get(y.id) ?? 0) > 1e-9)) dropDeps.add(y.id);
    const dropProv = new Set<number>();
    provRoom.forEach((v, i) => {
      if (i !== p && !(v > 1e-9)) dropProv.add(i);
    });
    const without = new Set([...dropDeps].filter((id) => id !== x.id));
    const kProv = [...dropProv].join(',');
    const kBase = `${[...without].sort().join(',')}|${kProv}`;
    const kAlt = `${[...dropDeps].sort().join(',')}|${kProv}`;
    interface Dest { c: Cell; th: number; td: number; to: number[]; prod: Record<string, number>; none: number }
    const dests: Dest[] = [];
    for (const c of cells.get(x.id) ?? []) {
      const th = (c.adopted + c.agent) * uW + c.seatHours * uS;
      if (!(th > 0)) continue;
      const td = c.dem * uW + c.seatDem * uS;
      const m = mix.sec[c.r][c.sid];
      const tierDep = m.rerun.tierDep;
      const to = zeros();
      const prod: Record<string, number> = {};
      let none = 0;
      const gs: [BuyerGroupId, number][] = [];
      let W = 0;
      for (const g of BUYER_GROUP_IDS) {
        const bg = m.byGroup[g];
        const wg = bg ? bg.w * bg.target[p] * (bg.playerProdW[x.id] ?? 0) : 0;
        if (wg > 0) {
          gs.push([g, wg]);
          W += wg;
        }
      }
      if (!(W > 0)) for (const g of BUYER_GROUP_IDS) {
        const bg = m.byGroup[g];
        if (bg && tierDep.some((id, k) => id === x.id && (bg.mask[p]?.[k] ?? true))) {
          gs.push([g, bg.w]);
          W += bg.w;
        }
      }
      if (!(W > 0)) none = 1;
      for (const [g, wg] of gs) {
        const base = memoCh(`${c.r}|${c.sid}|${g}|${kBase}`, () => (without.size || dropProv.size ? rerunChoice(m, g, p, without, dropProv) : m.byGroup[g]?.ch));
        const alt = memoCh(`${c.r}|${c.sid}|${g}|${kAlt}`, () => rerunChoice(m, g, p, dropDeps, dropProv));
        const f = wg / W;
        if (!base || !alt) {
          none += f;
          continue;
        }
        const dv = divertOf(base, alt, p, tierDep, x.id);
        for (let j = 0; j < n; j++) to[j] += f * dv.to[j];
        for (const id in dv.prod) prod[id] = (prod[id] ?? 0) + f * dv.prod[id];
        none += f * dv.none;
      }
      dests.push({ c, th, td, to, prod, none });
    }
    // Per hour: a receiving player product's serving need (H100e incl. its monitor) and price ($) in the cell (else its
    // average); a rival's need from its tier mix there (only where its room is finite: MK-8).
    const prodHph = (id: string, c: Cell) => {
      const cc = cellAt.get(`${id}|${c.r}|${c.sid}`);
      const hh = cc ? cc.adopted + cc.agent : 0;
      if (cc && hh > 0) return (cc.need / hh) * monOf(id);
      const e = byId.get(id)!;
      return e.hours > 0 ? (e.needH100e - (e.needSeat ?? 0)) / e.hours : 0;
    };
    const prodPrice = (id: string, c: Cell) => {
      const cc = cellAt.get(`${id}|${c.r}|${c.sid}`);
      const hh = cc ? cc.adopted + cc.agent : 0;
      return cc && hh > 0 ? (cc.dem * 1e9) / hh : byId.get(id)!.pricePerHour;
    };
    const rivalHph = (j: number, c: Cell) => {
      const t = mix.sec[c.r][c.sid].tiers;
      let h = 0;
      t.weight[j]?.forEach((w, k) => (h += w * (t.offers[j][k]?.hph ?? 0)));
      return h / SERVE_HOURS_PER_YEAR;
    };
    // Room: the share of what each finite-room destination is asked for that it can take.
    const wantP = new Map<string, number>();
    const wantR = zeros();
    for (const z of dests) {
      for (const id in z.prod) wantP.set(id, (wantP.get(id) ?? 0) + z.th * z.prod[id] * prodHph(id, z.c));
      for (let j = 0; j < n; j++) if (z.to[j] > 0 && Number.isFinite(provRoom[j])) wantR[j] += z.th * z.to[j] * rivalHph(j, z.c);
    }
    const okP = new Map<string, number>();
    for (const [id, w] of wantP) okP.set(id, w > 0 ? Math.min(1, (room.get(id) ?? 0) / w) : 1);
    const okR = wantR.map((w, j) => (Number.isFinite(provRoom[j]) && w > 0 ? Math.min(1, provRoom[j] / w) : 1));
    const ta = x.turnedAway;
    for (const z of dests) {
      const c = z.c;
      const m = mix.sec[c.r][c.sid];
      const k = `${c.r}|${c.sid}`;
      ta.hours += z.th;
      ta.dollars += z.td;
      // The hours each destination takes, and the excess over its room (to the destinations that took theirs in full).
      let over = 0;
      let full = 0;
      const takeP: Record<string, number> = {};
      const takeR = zeros();
      for (const id in z.prod) {
        const h = z.th * z.prod[id];
        const a = okP.get(id) ?? 1;
        takeP[id] = h * a;
        over += h * (1 - a);
        if (a >= 1) full += h;
      }
      for (let j = 0; j < n; j++) if (z.to[j] > 0) {
        const h = z.th * z.to[j];
        takeR[j] = h * okR[j];
        over += h * (1 - okR[j]);
        if (okR[j] >= 1) full += h;
      }
      let noneH = z.th * z.none;
      if (over > 0) {
        if (full > 0) {
          const g = 1 + over / full;
          for (const id in takeP) if ((okP.get(id) ?? 1) >= 1) takeP[id] *= g;
          for (let j = 0; j < n; j++) if (okR[j] >= 1) takeR[j] *= g;
        } else noneH += over;
      }
      for (const id in takeP) {
        const h = takeP[id];
        if (!(h > 0)) continue;
        const e = byId.get(id)!;
        const dol = (h * prodPrice(id, c)) / 1e9;
        const need = h * prodHph(id, c);
        e.revenue += dol;
        e.needH100e += need; // served from its spare compute
        e.spillIn.hours += h;
        e.spillIn.dollars += dol;
        room.set(id, Math.max(0, (room.get(id) ?? 0) - need));
        rsAbs.set(k, (rsAbs.get(k) ?? 0) + h);
        addAway(ta, id, h, 0, dol);
      }
      const rv = rsRival.get(k) ?? rsRival.set(k, zeros()).get(k)!;
      for (let j = 0; j < n; j++) {
        const h = takeR[j];
        if (!(h > 0)) continue;
        const key = mix.providers[j].key;
        const dol = (h * m.prices[j]) / 1e9;
        spillRev[key] = (spillRev[key] ?? 0) + dol;
        if (Number.isFinite(provRoom[j])) provRoom[j] = Math.max(0, provRoom[j] - h * rivalHph(j, c));
        rv[j] += h;
        addAway(ta, key, h, 0, dol);
      }
      if (noneH > 0) addAway(ta, 'none', noneH, 0, 0);
    }
  }
  // Customer-stock targets on served hours per sector × region (sector products).
  const asked = new Map<string, number>();
  const capH = new Map<string, number>();
  for (const x of order) {
    const need = x.needH100e; // incl. the turned-away buyers it took
    const f = need > 0 ? x.servingH100e / need : 1;
    for (const c of cells.get(x.id) ?? []) {
      const k = `${c.r}|${c.sid}`;
      const h = c.adopted + c.agent + c.seatHours;
      asked.set(k, (asked.get(k) ?? 0) + h);
      capH.set(k, (capH.get(k) ?? 0) + h * f);
    }
  }
  for (const [k, a] of asked) {
    if (!(a > 0)) continue;
    const [r, sid] = k.split('|') as [RegionId, SectorId];
    const m = mix.sec[r][sid];
    const kap = ((capH.get(k) ?? 0) + (rsAbs.get(k) ?? 0)) / a;
    const t = m.target;
    const tp = Math.min(t[p], m.share[p] * kap);
    if (!(tp < t[p] - 1e-9)) continue;
    servedT.sec[r][sid] = shiftTarget(t, p, tp, rsRival.get(k));
  }
  // Chat: turned-away subscribers to the other apps by user share; free users rate-limited.
  for (const x of out) {
    if (x.channel !== 'consumer') continue;
    const u = Math.max(0, 1 - (served.get(x.id)?.work ?? 1));
    if (!(u > 1e-9)) continue;
    for (const c of ccells.get(x.id) ?? []) {
      const subs = c.subs * u;
      if (!(subs > 0)) continue;
      const cm = mix.consumer[c.r];
      // MK-8: only to apps with serving room left; a subscriber takes its plan's serving (H100e) from that room, the
      // subscribers beyond it go to no AI.
      const ok = (j: number) => j !== p && cm.fit[j] > -Infinity && provRoom[j] > 1e-9;
      let z = 0;
      for (let j = 0; j < n; j++) if (ok(j)) z += cm.target[j];
      x.turnedAway.subs += subs;
      x.turnedAway.dollars += c.dem * u;
      if (!(z > 0)) {
        addAway(x.turnedAway, 'none', 0, subs, 0);
        continue;
      }
      let lost = 0;
      for (let j = 0; j < n; j++) if (ok(j) && cm.target[j] > 0) {
        let sj = (subs * cm.target[j]) / z;
        if (Number.isFinite(provRoom[j])) {
          const q = mix.providers[j];
          const per = q.model ? chatHoursPerDay(q.fpt ?? 2e12, CONSUMER_MKT.perDay.paid, tokEff(q.model), q.ud) / 24 : 0;
          if (per > 0 && sj * per > provRoom[j]) {
            lost += sj - provRoom[j] / per;
            sj = provRoom[j] / per;
          }
          provRoom[j] = Math.max(0, provRoom[j] - sj * per);
        }
        const dol = (sj * cm.prices[j] * 12) / 1e9;
        const key = mix.providers[j].key;
        spillRev[key] = (spillRev[key] ?? 0) + dol;
        addAway(x.turnedAway, key, 0, sj, dol);
      }
      if (lost > 0) addAway(x.turnedAway, 'none', 0, lost, 0);
    }
  }
  for (const r of REGIONS) {
    let sub = 0;
    let got = 0;
    for (const x of out) if (x.channel === 'consumer') for (const c of ccells.get(x.id) ?? []) if (c.r === r) {
      sub += c.subs;
      got += c.subs * (served.get(x.id)?.work ?? 1);
    }
    if (!(sub > 0) || got >= sub * (1 - 1e-9)) continue;
    const cm = mix.consumer[r];
    const tp = Math.min(cm.target[p], cm.share[p] * (got / sub));
    if (tp < cm.target[p] - 1e-9) servedT.consumer[r] = shiftTarget(cm.target, p, tp, undefined);
  }
  for (const x of out) {
    const t = x.turnedAway;
    total.hours += t.hours;
    total.subs += t.subs;
    total.dollars += t.dollars;
    for (const k in t.to) addAway(total, k, t.to[k].hours, t.to[k].subs, t.to[k].dollars);
  }
  return { turnedAway: total, spillRev, served: servedT };
}

/** MK-7: a target with provider p's share lowered to `tp`, the released share to the others by `w` (the hours they took
 *  from p), else by their own targets. */
function shiftTarget(t: readonly number[], p: number, tp: number, w: readonly number[] | undefined): number[] {
  const out = t.slice();
  const rel = t[p] - tp;
  out[p] = tp;
  let z = 0;
  if (w) for (let j = 0; j < t.length; j++) if (j !== p) z += w[j];
  const by = z > 0 ? w! : t;
  if (!(z > 0)) for (let j = 0; j < t.length; j++) if (j !== p) z += t[j];
  if (z > 0) for (let j = 0; j < t.length; j++) if (j !== p) out[j] += (rel * by[j]) / z;
  return out;
}

/** RD-P10: tokens a day per model of product `d` from its demand as served: Chat in serving order (paying users on the
 *  main model first, then free users on the free tier); sector products at the served share of their need, split by
 *  each lineup tier's own need. Spare H100e beyond the need serve nobody. Each model at its own FLOP per token. */
function servedByModel(s: GameStateV2, d: Deployment, a: Acc, h: number, mon: number): Record<string, number> {
  const out: Record<string, number> = {};
  const tok = (id: string, need: number) => {
    const v = versionById(s, id);
    if (!v || !(need > 0)) return;
    out[id] = (out[id] ?? 0) + (need * PEAK_FLOPS * decodeUtilNow(s) * 86400) / flopPerToken(s, v);
  };
  if (d.channel === 'consumer') {
    const paid = Math.min(a.needPaid, h / mon);
    tok(d.versionId, paid);
    tok(a.freeId ?? d.versionId, Math.min(a.need - a.needPaid, Math.max(0, h / mon - a.needPaid)));
    return out;
  }
  const f = a.need + a.seatNeed > 0 ? Math.min(1, h / ((a.need + a.seatNeed) * mon)) : 0;
  const ids = [d.versionId, ...lineupVersions(s, d).map((v) => v.id)];
  a.tN.forEach((n, k) => { if (ids[k]) tok(ids[k], n * f); });
  return out;
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
  // MK-7: plus what it earns on the buyers the player's capacity-short products turned away (the last revenue tick).
  return x + (s.world.fx.spillRev?.[lab] ?? 0);
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
      if (d.servedTokensDay !== undefined) d.servedTokensDay = 0;
      if (d.servedBy !== undefined) d.servedBy = {};
      continue;
    }
    d.revenueRate = Math.round(x.revenue * 1e4) / 1e4;
    d.demandBound = x.bound;
    d.needH100e = Math.round(x.needH100e);
    d.servedH100e = Math.round(x.servingH100e);
    d.cutH100e = Math.round(x.cutH100e);
    if (x.needPaid !== undefined) d.needPaidH100e = Math.round(x.needPaid);
    // RD-P10: usage per model (spare compute excluded); the RD-P09 leak reads its sum.
    d.servedBy = x.servedBy;
    d.servedTokensDay = Object.values(x.servedBy).reduce((a, b) => a + b, 0);
    if (ctx.day % 30 === 0) {
      (d.hist ??= []).push(d.revenueRate);
      if (d.hist.length > 12) d.hist.shift();
    }
    // Auto: the share it actually gets (the manual starting point reads it; RD-P10: incidents read servedBy, not this).
    if (s.player.policies.servingAuto) {
      const pool = servingPool(s);
      d.servingShare = pool > 0 ? x.servingH100e / pool : 0;
    }
    if (!top || x.revenue > top.revenue) top = x;
  }
  if (rd.total > 0) bookCash(s, ctx, rd.total / 365, 'revenue', 'revenue', top ? `${top.channel} ${top.bound}-bound` : undefined);
  revenueToParent(s, ctx, rd.total / 365); // a division's revenue goes to the parent (R9)
  // MK-7: customer stocks toward the targets on served hours; other sellers' revenue on the turned-away buyers.
  advanceCustomers(s, mix, undefined, rd.served);
  const sr: Record<string, number> = {};
  for (const k in rd.spillRev) if (rd.spillRev[k] > 1e-6) sr[k] = Number(rd.spillRev[k].toPrecision(6));
  s.world.fx.spillRev = sr;
  return rd;
}
