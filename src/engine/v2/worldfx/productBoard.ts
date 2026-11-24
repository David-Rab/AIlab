// PRODUCTS board readouts (UB-A; mockups rd/products.png, products-drawer.png; DATA-a.md PRODUCTS). Pure views on facts,
// measured values and the lab's beliefs (the market readouts of productView.ts); no hidden truth.
//   revenueTrend   all revenue, weekly (s.series.revenue), its peak and the change since (F)
//   customerDrift  where a product's buyers are heading: share now vs the target share, in words (B·fc)
//   limitReason    "Limited by" as a sentence: what binds and why, from the bound word and served demand (B)
//   agentsReady    a launch's engineering (spare capacity, weeks) and Agent mode's gate: the best model's measured
//                  horizon vs the tasks Agent mode sells (M / F)
//   winBack        what could win buyers back on a quality-bound product: a newer model of yours, know-how waiting for
//                  a new base model, a harness that certifies the product in a sector (F / B)
import { AGENT_TASK_HOURS, CERT_SECTORS } from '../../../data/v2/tools';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { LAUNCH_TW } from '../departments/build';
import { harnessesCertifying } from '../models/certs';
import { CHANNEL_VARIANTS } from '../models/deployments';
import { useShareOf } from './use';
import { measuredHorizonH } from '../models/products';
import { engAllocView } from '../models/researchView';
import { knowHowAreas } from '../models/rdReadouts';
import { measuredLOf } from '../models/labs';
import type { Deployment, GameStateV2, ModelVersion, SectorId } from '../types';
import type { ProductRead } from './productView';

export interface RevenueTrend { series: number[]; days: number[]; now: number; peak: number; peakDay: number; change: number }
/** All revenue ($B/yr, weekly) and the change from its peak to now (0 when now is the peak). */
export function revenueTrend(s: GameStateV2): RevenueTrend {
  const r = s.series.revenue;
  const n = Math.min(r.length, s.series.day.length);
  const series = r.slice(r.length - n);
  const days = s.series.day.slice(s.series.day.length - n);
  let pk = 0;
  for (let i = 1; i < n; i++) if (series[i] >= series[pk]) pk = i;
  const now = series[n - 1] ?? 0;
  const peak = series[pk] ?? 0;
  return { series, days, now, peak, peakDay: days[pk] ?? s.time.day, change: peak > 0 ? now / peak - 1 : 0 };
}

export type DriftDir = 'lose' | 'gain' | 'hold';
/** Where buyers are heading: the target share vs today's, with a dead band of two points (the card's arrow). */
export function customerDrift(r: ProductRead): { dir: DriftDir; words: string } {
  const g = r.cust.target - r.cust.stock;
  if (g < -0.02) return { dir: 'lose', words: r.channel === 'consumer' ? 'users drift to rivals' : 'rivals\' models win buyers' };
  if (g > 0.02) return { dir: 'gain', words: r.channel === 'consumer' ? 'users are coming' : 'buyers are coming' };
  return { dir: 'hold', words: r.channel === 'consumer' ? 'users mostly stay' : 'buyers mostly stay' };
}

/** "Limited by" in a sentence (the drawer's box): the bound word's cause with what is not the limit. */
export function limitReason(r: ProductRead): string {
  const served = r.unserved < 0.005 && r.cutH100e <= 0.005 * Math.max(1, r.needH100e);
  const tail = served ? ' Price and serving compute are not the limit: all demand is served.' : '';
  switch (r.bound) {
    case 'quality': return r.channel === 'consumer'
      ? `Users pick the chat app whose model does more of what they ask, for the price. ${customerDrift(r).dir === 'lose' ? 'Rivals\' newest models now do more, so users drift to them.' : 'Your model holds its users for now.'}${tail}`
      : `Buyers pick a model task by task, for value for money. ${customerDrift(r).dir === 'lose' ? 'Rivals\' newest models now do more of these tasks at the price, so buyers drift to them.' : 'Your models win these tasks for now; a stronger rival release would move buyers.'}${tail}`;
    case 'capacity': return 'Buyers want more than your serving compute serves: the product keeps its price and turns the rest away to their next choice (your other products with spare compute, rivals, or no AI). More serving compute (LAB) or a cheaper model in the lineup serves more of them.';
    case 'price': return 'Your price turns buyers away on work cheaper offers also do. Win share sells more hours at a thinner margin.';
    default: return 'Few buyers in this segment use AI yet: demand grows as adoption grows.';
  }
}

export interface AgentsReady {
  /** Your best model an API product can sell by measured skill, its measured time horizon (h) and the hours Agent
   *  mode's tasks take (its gate). */
  model?: ModelVersion; hours?: number; need: number;
  /** Engineers' spare capacity (share of capacity) and the weeks a launch takes at it (Infinity: none spare). */
  spare: number; weeks: number;
}
export function agentsReady(s: GameStateV2): AgentsReady {
  const ok = CHANNEL_VARIANTS.api;
  const vs = s.player.models.versions.filter((v) => (v.status === 'ready' || v.status === 'deployed') && ok.includes(v.variant))
    .sort((a, b) => measuredLOf(s, b).L - measuredLOf(s, a).L);
  const e = engAllocView(s);
  return {
    model: vs[0], hours: measuredHorizonH(vs[0]), need: AGENT_TASK_HOURS,
    spare: e.cap > 0 ? e.idle / e.cap : 0, weeks: e.idle > 0.01 ? LAUNCH_TW / e.idle : Infinity,
  };
}

export type WinBack =
  | { kind: 'model'; version: ModelVersion; testing: boolean }
  | { kind: 'knowhow'; x: number; area: string }
  | { kind: 'cert'; sector: SectorId; name: string; weeks: number; tool: string; toolName: string; built: boolean };

/** What could win buyers back on a product (the drawer's list, best first): a stronger model of yours not in the
 *  product (testing or ready), know-how waiting for a new base model (pretraining recipe), a certification the product
 *  can still start: the sector with the largest US spend it has no certification for, through a harness it can carry
 *  (MK-11, M14: built ones first; weeks = the harness's build at the spare capacity, 0 when built). */
export function winBack(s: GameStateV2, d: Deployment): WinBack[] {
  const out: WinBack[] = [];
  const cur = s.player.models.versions.find((v) => v.id === d.versionId);
  const inProduct = new Set([d.versionId, ...(d.lineup ?? [])]);
  const curL = measuredLOf(s, cur).L;
  const ok = CHANNEL_VARIANTS[d.channel] ?? [];
  const cand = s.player.models.versions.filter((v) => !inProduct.has(v.id) && ok.includes(v.variant) && (v.status === 'evaluating' || ((v.status === 'ready' || v.status === 'deployed') && measuredLOf(s, v).L > curL + 0.05)))
    .sort((a, b) => b.day - a.day)[0];
  if (cand) out.push({ kind: 'model', version: cand, testing: cand.status === 'evaluating' });
  const pre = knowHowAreas(s).filter((a) => a.waiting && a.waiting.x >= 1.05).sort((a, b) => b.waiting!.x - a.waiting!.x)[0];
  if (pre) out.push({ kind: 'knowhow', x: pre.waiting!.x, area: pre.name });
  if (d.channel !== 'consumer') {
    const open = CERT_SECTORS.filter((x) => !(d.certs ?? []).some((c) => c.sector === x) && harnessesCertifying(x, d.channel).length > 0);
    const best = [...open].sort((a, b) => sectorWeight(s, b) - sectorWeight(s, a))[0];
    if (best) {
      const hs = harnessesCertifying(best, d.channel);
      const t = hs.find((h) => s.player.features.includes(h.id)) ?? hs[0];
      const built = s.player.features.includes(t.id);
      const e = engAllocView(s);
      out.push({ kind: 'cert', sector: best, name: SECTOR_BY_ID[best].name, tool: t.id, toolName: t.name, built, weeks: built ? 0 : e.idle > 0.01 ? t.buildTW / e.idle : Infinity });
    }
  }
  return out;
}
const sectorWeight = (s: GameStateV2, id: SectorId) => {
  const st = s.world.sectors.US[id];
  return st ? useShareOf(st, id) * st.E0 * SECTOR_BY_ID[id].wage : 0;
};
