// Revenue per deployment: sector demand × share vs serving capacity (V2-SPEC §3.11.3). Owner: WS5.
//
//   AIhours_s,r = A_s·E0_s·2000·(α_s + (1 − α_s)·g_aug)
//   P_task_s    = θ·Wage_s·W0·priceIndex_market                       θ [fit], W0 = $35/h
//   Spend_s,r   = AIhours·P_task
//   Consumer    = 6·(L_best_public/5)²·regions $B/yr [fit], split by consumer share (appeal × quality × price)
//   demand_dep  = Σ_s,r share_P,s,r·Spend_s,r·channelSplit + consumer
//   capacity    = servingH100e_dep·rpH,   rpH = $40K·min(M(pm_served), 8)^0.3·priceIndex   (R11 #14)
//   revenue     = min(demand, capacity)
// Serving split (R6): with the Auto policy (default) each product needs demand ÷ rpH H100e (+ its monitor's overhead,
// D7); the pool serves the products earning most per H100e first and records what it cuts. Spare pool is spread over
// the products in proportion to need. With Auto off the products keep the shares set by hand (scaled if > 100%).
// Capacity-bound deployments lose share (0.5%/day of the excess); demand-bound ones report quality or price.
// Gov and trusted contract lump sums arrive through events/actions (WS4), not here.
import { CONSUMER, ECON, REGIONS, REGION_SCALE, SECTORS } from '../../../data/v2/sectors';
import { multiplierRef } from '../world/calibration';
import type { Channel, Deployment, EngineSystem, GameStateV2, LabId, Money, RegionId, SystemCtx } from '../types';
import { SECTOR_CHANNELS, paidDeployments, versionOf, worldMix, type WorldMix } from './mix';
import { freeTierShare, monitorOverhead, productDomains, productServeMult } from '../models/products';
import { sigmoid } from './policy';
import { bookCash } from '../finance/ledger';
import { revenueToParent } from '../finance/parent';

/** R11 #14: revenue per serving H100e-year at M = 1 ($). */
export const RPH_BASE = 40e3;
/** Research multiplier above which a better model earns no more per token (R11 #14). */
export const RPH_MCAP = 8;
/** Serve-cost factor of the revenue rate: (0.5 ÷ serve cost)^x, clamped 0.5–3 [D]. A cheaper-to-serve model (a mini,
 *  serve ×0.25) sells more answers per H100e at a lower price per token. Refit 0.5 → 0.3 in R6 (calibration line,
 *  PROGRESS R6): the R5 reference path reserved serving by demand $, so the full model on Enterprise took a third of
 *  the pool; the Auto split serves the most $ per H100e first (the minis), and at x = 0.5 the reference lab's 2027
 *  revenue rose 25% ($216B vs the $140B ±30% target). At 0.3 it is back on R5's path ($50B 2026, $175B 2027; R5 $51B,
 *  $173B); the start (one full model, factor 1) is unchanged. */
const RPH_SERVE_EXP = 0.3;
/** Channel weights splitting the player's sector demand between its deployments [D]. */
const CH_WEIGHT: Partial<Record<Channel, number>> = { api: 1, agents: 1.5, enterprise: 1, trusted: 0.15, gov: 2 };
/** Trusted access sells at a premium (×3) to a small volume (R12 §0.6) [D]. */
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
  /** Revenue per serving H100e-year including the monitor overhead ($). */
  rpH: number;
  /** Serving H100e the demand needs (incl. monitor), and what the split cut from it (Auto: lowest $/H100e first). */
  needH100e: number;
  cutH100e: number;
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

/** AI spend of one sector in one region ($B/yr). */
export function sectorSpend(s: GameStateV2, r: RegionId, def: (typeof SECTORS)[number], price: number): Money {
  const st = s.world.sectors[r][def.id];
  const hours = st.A * st.E0 * ECON.hours * (st.alpha + (1 - st.alpha) * ECON.gAug);
  const pTask = ECON.thetaPrice * def.wage * REGION_SCALE[r].wage * ECON.W0 * price;
  return (hours * pTask) / 1e9;
}

/** Consumer spend by region ($B/yr). */
export function consumerSpend(mix: WorldMix, r: RegionId): Money {
  const L = Math.max(0, mix.bestPublicLg);
  return CONSUMER.base * Math.pow(L / 5, 2) * CONSUMER.regions[r];
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

/** Revenue per serving H100e-year of one model on a deployment ($), before any monitor overhead. */
function rphModel(s: GameStateV2, d: Deployment, versionId: string | undefined): number {
  const v = versionId ? versionOf(s, versionId) : undefined;
  if (!v) return 0;
  const M = multiplierRef(s.hidden.timeline, v.pm);
  const effort = d.effort === 'low' ? 1.6 : d.effort === 'deep' ? 0.5 : 1;
  const serve = Math.min(3, Math.max(0.5, Math.pow(0.5 / Math.max(0.05, v.serveCost), RPH_SERVE_EXP)));
  return RPH_BASE * Math.pow(Math.min(Math.max(M, 1), RPH_MCAP), 0.3) * d.priceIndex * effort * serve;
}

/** Revenue per serving H100e-year of a product ($): its model (blended with the mini free tier by usage), feature
 *  token costs and the monitor overhead (D7). */
export function rphOf(s: GameStateV2, d: Deployment): number {
  const main = rphModel(s, d, d.versionId);
  if (main <= 0) return 0;
  const f = freeTierShare(s, d);
  const mini = f > 0 ? rphModel(s, d, d.miniVersionId) : 0;
  const perDollar = f > 0 && mini > 0 ? (1 - f) / main + f / mini : 1 / main;
  return 1 / (perDollar * productServeMult(s, d) * (1 + monitorOverhead(s, d)));
}

/** Capacity ($B/yr) of a deployment given its serving H100e. */
export function capacityOf(s: GameStateV2, d: Deployment, h: number): Money {
  return (h * rphOf(s, d)) / 1e9;
}

export interface ServingRow { h: number; need: number; cut: number; rpH: number }

/**
 * Serving split (R6). Auto (policy, default): need_d = demand_d ÷ rpH_d; serve products in order of rpH (most $ per
 * H100e first) until the pool runs out; the rest is the cut. Spare pool goes to every product in proportion to need.
 * Manual: the products' own shares of the pool (scaled down if they add up to more than 100%).
 */
export function servingSplit(s: GameStateV2, deps: Deployment[], demand: (d: Deployment) => Money): Map<string, ServingRow> {
  const pool = servingPool(s);
  const out = new Map<string, ServingRow>();
  const rows = deps.map((d) => {
    const rpH = rphOf(s, d);
    const need = rpH > 0 ? (demand(d) * 1e9) / rpH : 0;
    return { d, rpH, need };
  });
  if (s.player.policies.servingAuto) {
    const order = [...rows].sort((a, b) => b.rpH - a.rpH || (a.d.id < b.d.id ? -1 : 1));
    let left = pool;
    const got = new Map<string, number>();
    for (const r of order) {
      const g = Math.min(r.need, left);
      got.set(r.d.id, g);
      left -= g;
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

/** Full revenue computation (pure; the system applies it). */
export function revenueReadout(s: GameStateV2, mix: WorldMix = worldMix(s)): RevenueReadout {
  const deps = paidDeployments(s);
  const playerIdx = mix.providers.findIndex((p) => p.key === 'player');
  const demand = new Map<string, number>();
  for (const d of deps) demand.set(d.id, 0);
  const marketSpend = { US: 0, CN: 0, ROW: 0 } as Record<RegionId, Money>;
  const consumerSpendR = { US: 0, CN: 0, ROW: 0 } as Record<RegionId, Money>;

  // Sector demand. Channel weights per sector are region-independent: compute once.
  const sectorDeps = deps.filter((d) => SECTOR_CHANNELS.includes(d.channel));
  const baseW = sectorDeps.map((d) => {
    let w = CH_WEIGHT[d.channel] ?? 0;
    if (d.channel === 'agents') w *= sigmoid(((productDomains(s, d)?.AGENCY ?? 0) - 6) / 1);
    return w;
  });
  const secW = SECTORS.map((def) => {
    const ws: [Deployment, number][] = [];
    let wsum = 0;
    sectorDeps.forEach((d, i) => {
      if (d.channel === 'gov' && !GOV_SECTORS.has(def.id)) return;
      const w = baseW[i] * (d.channel === 'enterprise' && d.sectorFocus.includes(def.id) ? 3 : 1);
      if (w <= 0) return;
      ws.push([d, w]);
      wsum += w;
    });
    return { ws, wsum };
  });
  for (const r of REGIONS) {
    SECTORS.forEach((def, si) => {
      const m = mix.sec[r][def.id];
      const spend = sectorSpend(s, r, def, m.price);
      marketSpend[r] += spend;
      if (playerIdx < 0 || !m.share[playerIdx]) return;
      const st = s.world.sectors[r][def.id];
      // usage policy "no drop-in replacement" caps the player's α at 0.5 (lower hours per adopted task)
      const hf = st.alpha + (1 - st.alpha) * ECON.gAug;
      const pd = m.share[playerIdx] * spend;
      const { ws, wsum } = secW[si];
      if (!wsum) return;
      for (const [d, w] of ws) {
        let x = (pd * w) / wsum;
        if (d.usagePolicy.noDropInReplacement) {
          const a2 = Math.min(st.alpha, 0.5);
          x *= (a2 + (1 - a2) * ECON.gAug) / hf;
        }
        if (d.channel === 'api' || d.channel === 'agents') x *= 1 - 0.02 * d.kyc;
        if (d.channel === 'trusted') x *= TRUSTED_PREMIUM;
        if (d.status === 'restricted') x *= 0.3;
        demand.set(d.id, (demand.get(d.id) ?? 0) + x);
      }
    });
    // Consumer demand.
    const cs = consumerSpend(mix, r);
    consumerSpendR[r] = cs;
    const cm = mix.consumer[r];
    if (playerIdx >= 0 && cm.share[playerIdx] > 0) {
      const cdeps = deps.filter((d) => d.channel === 'consumer');
      // split among the player's consumer deployments by level and price
      const ws = cdeps.map((d) => {
        const v = productDomains(s, d);
        const L = v ? (v.SOCIAL + v.REASON + v.MEDIA) / 3 : 0;
        return Math.exp(2.1 * (L - cm.level[playerIdx])) * Math.pow(d.priceIndex, -1.5);
      });
      const wsum = ws.reduce((a, b) => a + b, 0);
      cdeps.forEach((d, i) => {
        let x = (cm.share[playerIdx] * cs * ws[i]) / (wsum || 1);
        if (d.status === 'restricted') x *= 0.3;
        demand.set(d.id, (demand.get(d.id) ?? 0) + x);
      });
    }
  }

  // Serving split, capacity and the binding cause.
  const split = servingSplit(s, deps, (d) => demand.get(d.id) ?? 0);
  const out: DeploymentRevenue[] = [];
  let total = 0;
  let D = 0;
  let C = 0;
  for (const d of deps) {
    const dem = demand.get(d.id) ?? 0;
    const sp = split.get(d.id)!;
    const h = sp.h;
    const capacity = (h * sp.rpH) / 1e9;
    const revenue = Math.min(dem, capacity);
    let bound: DeploymentRevenue['bound'];
    if (dem <= 1e-6) bound = 'demand';
    else if (dem > capacity) bound = 'capacity';
    else bound = d.priceIndex > 1.05 ? 'price' : 'quality';
    out.push({ id: d.id, channel: d.channel, demand: dem, capacity, revenue, bound, servingH100e: h, rpH: sp.rpH, needH100e: sp.need, cutH100e: sp.cut });
    total += revenue;
    D += dem;
    C += capacity;
  }
  return { deps: out, total, demand: D, capacity: C, marketSpend, consumerSpend: consumerSpendR };
}

/** Revenue rate ($B/yr) of a deployment, as last computed by the revenue system. */
export function revenueOf(s: GameStateV2, deploymentId: string): Money {
  return s.player.deployments.find((d) => d.id === deploymentId)?.revenueRate ?? 0;
}

/** Market revenue ($B/yr) a non-player lab would earn from its public model at its market share (demand-side;
 *  WS4 may use it for rival finance). */
export function labMarketRevenue(s: GameStateV2, lab: LabId): Money {
  const mix = worldMix(s);
  const i = mix.providers.findIndex((p) => p.key === lab);
  if (i < 0) return 0;
  let x = 0;
  for (const r of REGIONS) {
    for (const def of SECTORS) {
      const m = mix.sec[r][def.id];
      if (m.share[i]) x += m.share[i] * sectorSpend(s, r, def, m.price);
    }
    x += mix.consumer[r].share[i] * consumerSpend(mix, r);
  }
  return x;
}

/** revenue (60, daily): demand vs capacity per deployment → revenueRate (Auto serving split, R6); books revenue/365 ONCE through the finance ledger (kind 'revenue'). WS3's opex system derives
 *  revenueRun (30-day smoothing of Σ revenueRate) from it. */
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

  // Share erosion when capacity-bound (0.5%/day of the excess), slow recovery when there is slack (half speed when the
  // spare serving runs research agents, J2 PR1).
  const pen = s.world.fx.capPenalty;
  const rec = s.player.policies.spareServing === 'headroom' ? 1 : LENT_RECOVERY;
  const upd = (key: 'consumer' | 'sector', sel: (x: DeploymentRevenue) => boolean) => {
    let dem = 0;
    let cap = 0;
    for (const x of rd.deps) if (sel(x)) {
      dem += x.demand;
      cap += x.capacity;
    }
    if (dem <= 0) {
      pen[key] = Math.max(0, pen[key] - 0.01);
      return;
    }
    if (dem > cap) pen[key] = Math.min(PENALTY_MAX, pen[key] + 0.005 * ((dem - cap) / dem));
    else pen[key] = Math.max(0, pen[key] - 0.03 * rec * ((cap - dem) / Math.max(cap, 1e-9)));
  };
  upd('consumer', (x) => x.channel === 'consumer');
  upd('sector', (x) => x.channel !== 'consumer');
  return rd;
}
