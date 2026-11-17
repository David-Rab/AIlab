// Product readouts and live-edit previews (STRUCTURE §4.4, BUILD-PLAN R6; mockup v3-products). Owner: WS5.
//
// Per product: revenue, customers (revenue ÷ revenue per customer), share of its segment's spend vs the best rival
// product, binding cause, serving need / served / cut, run cost, monitor overhead and catch rate. A live edit is
// previewed by recomputing the market mix and revenue on a copy of the state with the edited product (pure; the edit
// itself applies at the next tick, D7), so the preview shows what the next tick will compute.
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { REGIONS, SECTORS } from '../../../data/v2/sectors';
import { decimalYear } from '../core/time';
import { catchRate, monitorOverhead } from '../models/products';
import { versionById } from '../models/labs';
import { tcoPerH100eYear } from '../production/production';
import type { Deployment, GameStateV2, Money } from '../types';
import { paidDeployments, worldMix, type WorldMix } from './mix';
import { consumerSpend, revenueReadout, sectorSpend, type RevenueReadout } from './revenue';

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
  /** Serving compute cost ($B/yr) at the rental-equivalent price of an H100e. */
  runCost: Money;
  monitorOverhead: number;
  catchRate: number;
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
      const cs = consumerSpend(mix, r);
      tot += cs;
      for (let i = 0; i < n; i++) acc[i] += cs * mix.consumer[r].share[i];
      continue;
    }
    for (const def of SECTORS) {
      if (channel === 'gov' && !GOV_SECTORS.has(def.id)) continue;
      const m = mix.sec[r][def.id];
      const sp = sectorSpend(s, r, def, m.price);
      tot += sp;
      for (let i = 0; i < n; i++) acc[i] += sp * m.share[i];
    }
  }
  return acc.map((x) => (tot > 0 ? x / tot : 0));
}

/** Readouts of every product (paid deployments) from one revenue computation. */
export function productReadouts(s: GameStateV2, mix: WorldMix = worldMix(s), rd: RevenueReadout = revenueReadout(s, mix)): Map<string, ProductRead> {
  const out = new Map<string, ProductRead>();
  const tco = tcoPerH100eYear(s, decimalYear(s));
  const shareCache = new Map<string, number[]>();
  const pi = mix.providers.findIndex((p) => p.key === 'player');
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
      customers: def && def.arpu > 0 ? (x.revenue * 1e9) / def.arpu : 0,
      share: pi >= 0 ? sh[pi] : 0, rival, bound: x.bound, rpH: x.rpH,
      needH100e: x.needH100e, servedH100e: x.servingH100e, cutH100e: x.cutH100e, unserved: Math.max(0, x.demand - x.revenue),
      runCost: Math.min(x.servingH100e, x.needH100e) * tco,
      monitorOverhead: monitorOverhead(s, d),
      catchRate: d.monitorId ? catchRate(s, versionById(s, d.versionId), versionById(s, d.monitorId)).rate : 0,
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
