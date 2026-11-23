// Product readouts and live-edit previews (STRUCTURE §4.4, BUILD-PLAN R6; mockup v3-products). Owner: WS5.
//
// Per product: revenue, customers (B2: the customer stock as a share of the segment's spend, its logit target, the
// segment speed and days to converge; Chat also its weekly users and their target), the best rival product's share, binding cause, serving need / served / cut, run cost, cost and price
// per work-hour (Chat: per subscriber-month) and margin, monitor overhead and catch rate (model v3 V4.2). A live edit is
// previewed by recomputing the market mix and revenue on a copy of the state with the edited product (pure; the edit
// itself applies at the next tick, D7), so the preview shows what the next tick will compute.
import { MINI_CHANNELS, type FeatureDef, type WorkScope } from '../../../data/v2/features';
import { REGIONS, SECTORS } from '../../../data/v2/sectors';
import { WORK_TYPES, type WorkTypeId } from '../../../data/v2/workTypes';
import { catchRate, monitorOverhead, productMonitorVersion } from '../models/products';
import { featureUpkeepTW } from '../departments/build';
import { versionById } from '../models/labs';
import { SECTOR_PACK_DG, effortDG, lineupOf, markupOf, serveDollarsPerHour } from './serving';
import { workFit } from '../departments/workfit';
import { REFERENCE_BASE } from '../../../data/v2/runDesign';
import { CONSUMER_MKT, CUSTOMER_TAU, EFFORT_TOKENS, SERVE_HOURS_PER_YEAR } from '../../../data/v2/serving';
import type { Deployment, GameStateV2, Money, RegionId, SectorId } from '../types';
import { paidDeployments, worldMix, type TierKind, type WorldMix } from './mix';
import { consumerSpend, consumerUsers, revenueReadout, sectorSpend, type DeploymentRevenue, type RevenueReadout } from './revenue';

export interface ProductRead {
  id: string;
  channel: Deployment['channel'];
  revenue: Money;
  demand: Money;
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
  /** B2: the customer stock vs its target and speed. */
  cust: CustomerView;
  /** TIERS (sector products): the lineup, one row per tier (worldfx/serving.ts productLineup order). */
  lineup?: LineupRow[];
}

/** TIERS: one tier of a sector product's lineup. `gap` OOM of fit below the main model (students: the distillation
 *  rule's δ; the mini: its work fit below the main model's); `ratio` its active parameters ÷ the main model's (its price
 *  per token ÷ the main model's at the product's markup); `price` $ per billed hour (adopted task-hours and agent-hours,
 *  demand-weighted; for a tier that sells nothing, the main model's × ratio); `share` of the product's billed hours. */
export interface LineupRow { kind: TierKind; name: string; params: number; ratio: number; gap: number; hours: number; share: number; price: number }

/** TIERS: the lineup rows of a sector product from its revenue readout. */
function lineupRows(s: GameStateV2, d: Deployment, x: DeploymentRevenue): LineupRow[] | undefined {
  if (d.channel === 'consumer') return undefined;
  const v = versionById(s, d.versionId);
  if (!v) return undefined;
  const nT = v.params ?? s.player.models.bases.find((b) => b.id === v.baseId)?.params ?? REFERENCE_BASE.params;
  const rows: Omit<LineupRow, 'hours' | 'share' | 'price'>[] = [{ kind: 'model', name: v.name, params: nT, ratio: 1, gap: 0 }];
  for (const g of lineupOf(nT)) rows.push({ kind: 'student', name: `${v.name} student`, params: nT * g.r, ratio: g.r, gap: g.g });
  const mini = d.miniVersionId && MINI_CHANNELS.includes(d.channel) ? versionById(s, d.miniVersionId) : undefined;
  if (mini) {
    const nM = mini.params ?? s.player.models.bases.find((b) => b.id === mini.baseId)?.params ?? REFERENCE_BASE.params;
    rows.push({ kind: 'mini', name: mini.name, params: nM, ratio: nM / nT, gap: workFit(s, v, 'SWE').fit - workFit(s, mini, 'SWE').fit });
  }
  const t = x.tiers ?? [];
  const H = t.reduce((a, y) => a + y.hours, 0);
  const p0 = t[0] && t[0].hours > 0 ? (t[0].dem * 1e9) / t[0].hours : x.pricePerHour;
  return rows.map((r, k) => {
    const y = t[k];
    const hours = y?.hours ?? 0;
    return { ...r, hours, share: H > 0 ? hours / H : k === 0 ? 1 : 0, price: hours > 0 ? (y!.dem * 1e9) / hours : p0 * r.ratio };
  });
}

/** B2 (product card): customers are a stock per (region, segment) moving toward the logit target at the segment's speed
 *  (mix.ts advanceCustomers, CUSTOMER_TAU). Aggregated over the segments the product sells into, weighted by their spend
 *  (the same weights as `share`). The stock and target are the player's (all its products in the segment). */
export interface CustomerSeg {
  r: RegionId;
  seg: SectorId | 'consumer';
  /** Spend weight in the product's segment. */
  w: number;
  stock: number;
  target: number;
  /** Time constant (days). */
  tauDays: number;
}
export interface CustomerView {
  /** Spend-weighted customer stock (= `share`) and logit target. */
  stock: number;
  target: number;
  /** Chat: weekly users (stock) and the users at the target share. */
  users?: number;
  usersTarget?: number;
  /** Time constants (days) by speed class and their spend weight, largest weight first. */
  taus: { days: number; w: number }[];
  /** Days until the spend-weighted gap to the target is within CONVERGED, if the target held: 0 = at target,
   *  Infinity = more than 3 years. */
  days: number;
  /** Segments with the largest weighted gap (up to 4). */
  movers: CustomerSeg[];
}
/** The stock counts as at its target within half a percentage point (spend-weighted gap) [D]. */
export const CONVERGED = 0.005;

/** Days until Σ w·|target − stock|·e^(−t/τ) ≤ CONVERGED (bisection; each segment's gap closes exponentially). */
function convergeDays(segs: CustomerSeg[]): number {
  const W = segs.reduce((a, x) => a + x.w, 0) || 1;
  const gap = (t: number) => segs.reduce((a, x) => a + x.w * Math.abs(x.target - x.stock) * Math.exp(-t / x.tauDays), 0) / W;
  if (gap(0) <= CONVERGED) return 0;
  const MAX = 3 * 365;
  if (gap(MAX) > CONVERGED) return Infinity;
  let lo = 0;
  let hi = MAX;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (gap(m) > CONVERGED) lo = m; else hi = m;
  }
  return Math.ceil(hi);
}

/** The player's customer view over a product's segments. */
function customerOf(segs: CustomerSeg[]): CustomerView {
  const W = segs.reduce((a, x) => a + x.w, 0);
  const n = W > 0 ? segs : segs.map((x) => ({ ...x, w: 1 }));
  const Wn = n.reduce((a, x) => a + x.w, 0) || 1;
  const stock = n.reduce((a, x) => a + x.w * x.stock, 0) / Wn;
  const target = n.reduce((a, x) => a + x.w * x.target, 0) / Wn;
  const tm = new Map<number, number>();
  for (const x of n) tm.set(x.tauDays, (tm.get(x.tauDays) ?? 0) + x.w / Wn);
  const taus = [...tm].map(([days, w]) => ({ days, w })).sort((a, b) => b.w - a.w);
  const movers = n.filter((x) => Math.abs(x.target - x.stock) > 1e-4)
    .sort((a, b) => b.w * Math.abs(b.target - b.stock) - a.w * Math.abs(a.target - a.stock)).slice(0, 4);
  return { stock, target, taus, days: convergeDays(n), movers };
}

const TAU_DAYS = { consumer: CUSTOMER_TAU.consumer * 365, sector: CUSTOMER_TAU.sector * 365, gov: CUSTOMER_TAU.gov * 365 };

/** B2: a feature's typed effects for the product card, with units. */
export type FeatureKind = 'enabler' | 'horizon' | 'scaffold' | 'effort';
export interface FeatureLine {
  kind: FeatureKind;
  /** The effect with units ("+0.30 OOM fit", "horizon ×1.3", "+15% reachable work"). */
  effect: string;
  /** Token multiplier (scaffolds: every token; effort: reasoning tokens); 1 = none. */
  tokens: number;
  /** Where it applies on the product side. */
  where: string;
  /** Whether it acts on the product asked about (a Chat-user enabler does nothing on API). */
  here: boolean;
}
export interface FeatureView {
  kinds: FeatureKind[];
  lines: FeatureLine[];
  /** Short effect for the card row ("+0.3 OOM ×3 tok"): the effects that act on this product. */
  short: string;
  /** Internal agents' work types it also applies to once built (names); empty = none. */
  internal: string[];
  /** C2: engineers' upkeep once built, team-weeks per week: in use, and built but in use nowhere (keep-alive; equal to
   *  `upkeepTW` for a feature that helps the internal agents, which is always in use). 0 for sector packs. */
  upkeepTW: number;
  idleTW: number;
}
const SECTOR_SHORT: Partial<Record<SectorId, string>> = { SOFT: 'Software & IT', OFFICE: 'Admin', FIN: 'Finance', LEGAL: 'Legal', MEDIA: 'Media', SCI: 'Science', GOV: 'Government', MIL: 'Military' };
/** The internal agents' work types (departments/workfit.ts labour slots). */
const INTERNAL_WT: WorkTypeId[] = ['SWE', 'EXP', 'IDEAS', 'SAF_EXP'];
const isWt = (x: string): x is WorkTypeId => x in WORK_TYPES;
function scopeText(w: WorkScope): string {
  if (w === 'all') return 'all work';
  const xs = w.filter((x) => !isWt(x)).map((x) => (x === 'CHAT' ? 'Chat' : SECTOR_SHORT[x as SectorId] ?? x));
  return xs.length ? xs.join(', ') : 'internal work only';
}
const internalOf = (w: WorkScope): WorkTypeId[] => (w === 'all' ? INTERNAL_WT : INTERNAL_WT.filter((x) => w.includes(x)));
const mult = (x: number) => `×${Number.isInteger(x) ? x : x.toFixed(1)}`;

/** Typed effects of a feature on a product channel, with units (output only: the effects themselves are applied in
 *  serving.ts). Chat sells only to consumers, the other products only to sectors. */
export function featureView(f: FeatureDef, channel?: Deployment['channel']): FeatureView {
  const lines: FeatureLine[] = [];
  const short: string[] = [];
  const internal = new Set<WorkTypeId>();
  const chat = channel === 'consumer';
  const scoped = (w: WorkScope) => !channel || w === 'all' || w.some((x) => (x === 'CHAT' ? chat : !isWt(x) && !chat));
  const push = (l: Omit<FeatureLine, 'here'>, here: boolean, sh: string) => {
    lines.push({ ...l, here });
    if (here) short.push(sh);
  };
  for (const fx of f.fx) {
    if (fx.kind === 'scaffold') {
      push({ kind: 'scaffold', effect: `+${fx.dG.toFixed(2)} OOM fit`, tokens: fx.tokens, where: scopeText(fx.work) }, scoped(fx.work), `+${fx.dG} OOM ${mult(fx.tokens)} tok`);
      for (const x of internalOf(fx.work)) internal.add(x);
    } else if (fx.kind === 'horizon') {
      push({ kind: 'horizon', effect: `horizon ${mult(fx.mult)}`, tokens: 1, where: scopeText(fx.work) }, scoped(fx.work), `${mult(fx.mult)} longer tasks`);
      for (const x of internalOf(fx.work)) internal.add(x);
    } else if (fx.kind === 'effort') {
      const tok = EFFORT_TOKENS[fx.setting];
      const dG = effortDG(tok);
      push({ kind: 'effort', effect: `+${dG.toFixed(2)} OOM fit`, tokens: tok, where: 'every task (effort: deep think)' }, true, `+${dG.toFixed(2)} OOM ${mult(tok)} tok`);
    } else if (fx.packs) {
      push({ kind: 'enabler', effect: `sector products; +${SECTOR_PACK_DG.toFixed(2)} OOM fit per certified pack`, tokens: 1, where: 'the pack\'s sector' }, true, `+${SECTOR_PACK_DG.toFixed(2)} OOM per pack`);
    } else {
      const pct = `+${Math.round(fx.share * 100)}%`;
      if (fx.consumer) push({ kind: 'enabler', effect: `${pct} Chat users`, tokens: 1, where: 'Chat' }, !channel || chat, `${pct} users`);
      if (fx.sectors?.length) push({ kind: 'enabler', effect: `${pct} reachable work`, tokens: 1, where: fx.sectors.map((x) => SECTOR_SHORT[x] ?? x).join(', ') }, !channel || !chat, `${pct} work`);
    }
  }
  const kinds = [...new Set((lines.some((l) => l.here) ? lines.filter((l) => l.here) : lines).map((l) => l.kind))];
  const upkeepTW = featureUpkeepTW(f);
  const idleTW = featureUpkeepTW(f, false);
  // RD-A06 (DD-03): a feature acts only inside its product's offer; internal agents get tools (Company › Agents).
  void internal;
  return { kinds, lines, short: short.join(' · '), internal: [], upkeepTW, idleTW };
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

/** Spend-weighted share of each provider in the segment a product sells into (consumer, all sectors, or GOV/MIL), and
 *  the player's customer view there (B2). */
function segmentShares(s: GameStateV2, mix: WorldMix, channel: Deployment['channel'], pi: number): { shares: number[]; cust: CustomerView } {
  const n = mix.providers.length;
  const acc = new Array<number>(n).fill(0);
  const segs: CustomerSeg[] = [];
  let tot = 0;
  for (const r of REGIONS) {
    if (channel === 'consumer') {
      const cs = consumerSpend(s, mix, r);
      tot += cs;
      const cm = mix.consumer[r];
      for (let i = 0; i < n; i++) acc[i] += cs * cm.share[i];
      if (pi >= 0 && CONSUMER_MKT.adults[r] > 0) segs.push({ r, seg: 'consumer', w: cs, stock: cm.share[pi], target: cm.target[pi], tauDays: TAU_DAYS.consumer });
      continue;
    }
    for (const def of SECTORS) {
      if (channel === 'gov' && !GOV_SECTORS.has(def.id)) continue;
      const m = mix.sec[r][def.id];
      const sp = sectorSpend(s, r, def.id, mix);
      tot += sp;
      for (let i = 0; i < n; i++) acc[i] += sp * m.share[i];
      if (pi >= 0) segs.push({ r, seg: def.id, w: sp, stock: m.share[pi], target: m.target[pi], tauDays: GOV_SECTORS.has(def.id) ? TAU_DAYS.gov : TAU_DAYS.sector });
    }
  }
  return { shares: acc.map((x) => (tot > 0 ? x / tot : 0)), cust: customerOf(segs) };
}

/** Chat: weekly users at the target share, per product: its users × (Σ_r users_r·target_r ÷ Σ_r users_r·stock_r). */
function usersAtTarget(s: GameStateV2, mix: WorldMix, pi: number, users: number): number {
  let a = 0;
  let b = 0;
  for (const r of REGIONS) {
    const u = consumerUsers(s, r);
    a += u * mix.consumer[r].target[pi];
    b += u * mix.consumer[r].share[pi];
  }
  return b > 0 ? (users * a) / b : 0;
}

/** Readouts of every product (paid deployments) from one revenue computation. */
export function productReadouts(s: GameStateV2, mix: WorldMix = worldMix(s), rd: RevenueReadout = revenueReadout(s, mix)): Map<string, ProductRead> {
  const out = new Map<string, ProductRead>();
  const tco = (serveDollarsPerHour(s) * SERVE_HOURS_PER_YEAR) / 1e9;
  const shareCache = new Map<string, ReturnType<typeof segmentShares>>();
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  const going = goingPrice(s, mix);
  for (const d of paidDeployments(s)) {
    const x = rd.deps.find((r) => r.id === d.id);
    if (!x) continue;
    const segKey = d.channel === 'consumer' ? 'c' : d.channel === 'gov' ? 'g' : 's';
    let seg = shareCache.get(segKey);
    if (!seg) {
      seg = segmentShares(s, mix, d.channel, pi);
      shareCache.set(segKey, seg);
    }
    const sh = seg.shares;
    let rival: ProductRead['rival'];
    mix.providers.forEach((p, i) => {
      if (p.lab === 'player') return;
      if (!rival || sh![i] > rival.share) rival = { name: providerName(s, p.key), share: sh![i] };
    });
    out.set(d.id, {
      id: d.id, channel: d.channel, revenue: x.revenue, demand: x.demand,
      share: pi >= 0 ? sh[pi] : 0, rival, bound: x.bound, rpH: x.rpH,
      needH100e: x.needH100e, servedH100e: x.servingH100e, cutH100e: x.cutH100e, unserved: Math.max(0, x.demand - x.revenue),
      runCost: Math.min(x.servingH100e, x.needH100e) * tco,
      cost: d.channel === 'consumer' ? x.subCost ?? 0 : x.costPerHour, price: d.channel === 'consumer' ? x.subPrice ?? 0 : x.pricePerHour,
      margin: (d.channel === 'consumer' ? x.subPrice ?? 0 : x.pricePerHour) > 0 ? 1 - (d.channel === 'consumer' ? (x.subCost ?? 0) / (x.subPrice ?? 1) : x.costPerHour / x.pricePerHour) : 0,
      valueCapped: x.valueCapped, hours: x.hours, capHours: x.capHours, ...(x.users !== undefined ? { users: x.users, subs: x.subs } : {}),
      monitorOverhead: monitorOverhead(s, d),
      catchRate: d.monitorId ? catchRate(s, versionById(s, d.versionId), productMonitorVersion(s, d), false, true).rate : 0,
      markup: markupOf(d), econ: econOf(x, going),
      cust: d.channel === 'consumer' && pi >= 0 ? { ...seg.cust, users: x.users ?? 0, usersTarget: usersAtTarget(s, mix, pi, x.users ?? 0) } : seg.cust,
      ...(d.channel !== 'consumer' ? { lineup: lineupRows(s, d, x) } : {}),
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
