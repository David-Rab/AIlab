// Revenue per deployment: sector demand × share vs serving capacity (V2-SPEC §3.11.3). Owner: WS5.
//
//   AIhours_s,r = A_s·E0_s·2000·(α_s + (1 − α_s)·g_aug)
//   P_task_s    = θ·Wage_s·W0·priceIndex_market                       θ [fit], W0 = $35/h
//   Spend_s,r   = AIhours·P_task
//   Consumer    = 6·(L_best_public/5)²·regions $B/yr [fit], split by consumer share (appeal × quality × price)
//   demand_dep  = Σ_s,r share_P,s,r·Spend_s,r·channelSplit + consumer
//   capacity    = servingH100e_dep·rpH,   rpH = $40K·min(M(pm_served), 8)^0.3·priceIndex   (R11 #14)
//   revenue     = min(demand, capacity)
// Capacity-bound deployments lose share (0.5%/day of the excess); demand-bound ones report quality or price.
// Gov and trusted contract lump sums arrive through events/actions (WS4), not here.
import { CONSUMER, ECON, REGIONS, REGION_SCALE, SECTORS } from '../../../data/v2/sectors';
import { multiplierRef } from '../world/calibration';
import type { Channel, Deployment, EngineSystem, GameStateV2, LabId, Money, RegionId, SystemCtx } from '../types';
import { SECTOR_CHANNELS, paidDeployments, versionOf, worldMix, type WorldMix } from './mix';
import { sigmoid } from './policy';

/** R11 #14: revenue per serving H100e-year at M = 1 ($). */
export const RPH_BASE = 40e3;
/** Channel weights splitting the player's sector demand between its deployments [D]. */
const CH_WEIGHT: Partial<Record<Channel, number>> = { api: 1, agents: 1.5, enterprise: 1, trusted: 0.15, gov: 2 };
/** Trusted access sells at a premium (×3) to a small volume (R12 §0.6) [D]. */
const TRUSTED_PREMIUM = 3;
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

/** Capacity ($B/yr) and serving H100e of a deployment. */
export function capacityOf(s: GameStateV2, d: Deployment, servingScale: number): { capacity: Money; h: number } {
  const pool = Math.max(0, s.player.computeOnline * s.player.split.serving - moonshotH100e(s));
  const h = pool * d.servingShare * servingScale;
  const v = versionOf(s, d.versionId);
  if (!v) return { capacity: 0, h };
  const M = multiplierRef(s.hidden.timeline, v.pm);
  const effort = d.effort === 'low' ? 1.6 : d.effort === 'deep' ? 0.5 : 1;
  const serve = Math.min(3, Math.max(0.5, Math.sqrt(0.5 / Math.max(0.05, v.serveCost))));
  const rpH = RPH_BASE * Math.pow(Math.min(Math.max(M, 1), 8), 0.3) * d.priceIndex * effort * serve;
  return { capacity: (h * rpH) / 1e9, h };
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
    if (d.channel === 'agents') w *= sigmoid(((versionOf(s, d.versionId)?.domains.AGENCY ?? 0) - 6) / 1);
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
        const v = versionOf(s, d.versionId);
        const L = v ? (v.domains.SOCIAL + v.domains.REASON + v.domains.MEDIA) / 3 : 0;
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

  // Capacity and the binding cause.
  const sumShares = deps.reduce((a, d) => a + d.servingShare, 0);
  const scale = sumShares > 1 ? 1 / sumShares : 1;
  const out: DeploymentRevenue[] = [];
  let total = 0;
  let D = 0;
  let C = 0;
  for (const d of deps) {
    const dem = demand.get(d.id) ?? 0;
    const { capacity, h } = capacityOf(s, d, scale);
    const revenue = Math.min(dem, capacity);
    let bound: DeploymentRevenue['bound'];
    if (dem <= 1e-6) bound = 'demand';
    else if (dem > capacity) bound = 'capacity';
    else bound = d.priceIndex > 1.05 ? 'price' : 'quality';
    out.push({ id: d.id, channel: d.channel, demand: dem, capacity, revenue, bound, servingH100e: h });
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

/** revenue (60, daily): demand vs capacity per deployment → revenueRate; cash += revenue/365 (cause 'revenue');
 *  revenueRun = 30-day EWMA of the total. */
export const revenueSystem: EngineSystem = {
  id: 'revenue', owner: 'WS5', cadence: 'daily', order: 60,
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
    if (!top || x.revenue > top.revenue) top = x;
  }
  if (rd.total > 0) ctx.bump('cash', rd.total / 365, 'revenue', top ? `${top.channel} ${top.bound}-bound` : undefined);
  const f = s.player.finance;
  const dR = (rd.total - f.revenueRun) / 30;
  f.revenueRun += dR;
  ctx.cause('revenueRun', dR, 'revenue');

  // Share erosion when capacity-bound (0.5%/day of the excess), slow recovery when there is slack.
  const pen = s.world.fx.capPenalty;
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
    else pen[key] = Math.max(0, pen[key] - 0.03 * ((cap - dem) / Math.max(cap, 1e-9)));
  };
  upd('consumer', (x) => x.channel === 'consumer');
  upd('sector', (x) => x.channel !== 'consumer');
  return rd;
}
