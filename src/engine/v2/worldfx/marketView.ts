// MK-12 (design/MARKET.md M12, M15; mockups design/ux/mockups/market/products.png, lineup-swap.png, DATA.md): the
// Products screen's readouts and previews, so the screen (MK-13) only lays them out. Pure views; no hidden truth (model
// skill is the player's MEASURED level, never the true G).
//
//   productCardView(s, id)   one product card: profit (revenue − serving cost at the rental rate), margin, revenue,
//                            serving cost; Chat users / paying users / plan price (at the cap); business work sold
//                            (hours a year) and its average price per hour, per-model prices; serving compute needed
//                            vs served; buyers turned away and where they went; stance; lineup rows; tools with their
//                            certifications; the buyer groups it reaches (ladder in the tooltip text)
//   productsStrip(s)         the totals strip: profit from products, revenue, serving cost; serving compute (pool vs
//                            need, short by), buyers turned away; your share of business buyers' AI spend, where it is
//                            heading, and the top rival's
//   lineupSwapOptions / lineupAddOptions / lineupRemovePreview / stancePreview
//                            the popover rows and the stance switch: the change a year in profit, work sold and
//                            serving compute need, from previewEdit (the revenue system's own path on the edited
//                            state: buyers taken from your other products and rationing included)
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { SERVE_HOURS_PER_YEAR } from '../../../data/v2/serving';
import { PRODUCT_TOOLS, PRODUCT_TOOL_BY_ID, toolCertSectors, type ProductToolDef, type ProductToolId, type ToolKind } from '../../../data/v2/tools';
import type { Deployment, GameStateV2, Money, PriceStance, SectorId } from '../types';
import { certDoneBy } from '../models/certs';
import { measuredLOf, versionById } from '../models/labs';
import { editBlock, previewEdit, type ProductChanges } from '../models/productOps';
import { CHANNEL_VARIANTS } from '../models/deployments';
import { flopPerToken } from '../departments/workfit';
import { freeTierVersion, lineupVersions, serveDollarsPerHour } from './serving';
import { servingPool } from './revenue';
import { marketBase, segmentShares, type MarketBase, type ProductRead } from './productView';

/** A share of hours below this counts as "sells nothing" on the card. */
export const SELLS_NOTHING = 0.005;

const isProduct = (d: Deployment) => d.kind === 'product' && d.status !== 'withdrawn' && d.channel !== 'internal' && d.channel !== 'open';
const productName = (ch: Deployment['channel']) => PRODUCT_DEFS[ch]?.name ?? ch;
/** Serving cost of an H100e-year at the rental rate ($B). */
const h100eYear = (s: GameStateV2) => (serveDollarsPerHour(s) * SERVE_HOURS_PER_YEAR) / 1e9;

// ───────────────────────────── buyer groups (M1, M2) ─────────────────────────────

/** Who a product sells to, in player words, and the ladder (M2) for its tooltip. */
export interface BuyerGroupsView { label: string; tip: string }
export const BUYER_GROUPS: Record<'consumer' | 'api' | 'enterprise' | 'vetted', BuyerGroupsView> = {
  consumer: { label: 'the public', tip: 'People with a personal chat plan, most of them on the free plan. Chat is its own market: business buyers do not buy it.' },
  api: { label: 'small firms & developers', tip: 'Small firms and developers buy only from API. Large firms and vetted buyers may buy here too, task by task, when it serves them better than Enterprise or Vetted.' },
  enterprise: { label: 'large firms', tip: 'Large firms buy from Enterprise or API. Vetted buyers may buy here too, task by task; small firms cannot.' },
  vetted: { label: 'government, military, critical infrastructure, regulated firms', tip: 'Vetted buyers: government, the military and defence industry, critical infrastructure and large regulated firms. Only they buy from Vetted; they may also buy from Enterprise and API, task by task.' },
};

// ───────────────────────────── the product card ─────────────────────────────

export interface MoneyLine { profit: Money; revenue: Money; servingCost: Money; margin: number }

export interface TurnedAwayTo {
  /** A product id of yours, a rival's provider key, or 'none' (they buy no AI). */
  key: string;
  kind: 'own' | 'rival' | 'none';
  name: string;
  hours: number;
  subs: number;
  /** What the receiver earns on them ($B/yr; 0 for no AI). */
  dollars: Money;
}
export interface TurnedAwayView {
  /** At this product's list price ($B/yr); hours of work a year (business) or paying users (Chat). */
  dollars: Money;
  hours: number;
  subs: number;
  to: TurnedAwayTo[];
}

export interface LineupCardRow {
  id: string;
  name: string;
  main: boolean;
  /** Measured skill (level) and its place on the bar, 0..1 between your weakest and strongest live model by measured
   *  level; `evaluating`: no eval of its own yet (its parent's reading). */
  skill: number;
  skillPos: number;
  evaluating: boolean;
  /** Business products: share of the hours sold, hours a year, price per hour ($); `sellsNothing` below SELLS_NOTHING. */
  share: number;
  hours: number;
  price: number;
  sellsNothing: boolean;
  /** Chat: who it serves. */
  serves?: 'paying' | 'free' | 'paying and free' | 'nobody';
}

export interface CertView { sector: SectorId; name: string; state: 'certified' | 'certifying' | 'starts'; daysLeft: number }
export interface ToolOnProduct { id: ProductToolId; name: string; kind: ToolKind; certs: CertView[] }
export interface ToolsView {
  on: ToolOnProduct[];
  /** Tools this product could carry that it does not: built ones (switch on) and not built (build first). */
  more: { id: ProductToolId; name: string; built: boolean }[];
}

export interface ProductCard {
  id: string;
  channel: 'consumer' | 'api' | 'enterprise' | 'vetted';
  name: string;
  buyers: BuyerGroupsView;
  money: MoneyLine;
  stance: PriceStance;
  /** Chat: weekly users, paying users, the plan price ($/month) and whether it sits at the cap (what people pay at most). */
  chat?: { users: number; paying: number; price: number; cap: number; atCap: boolean };
  /** Business: work sold (hours a year, served, incl. seat hours and buyers taken from your other products), the average
   *  price per hour (revenue ÷ work sold), and the parts for its tooltip. */
  work?: {
    hours: number; avgPrice: number;
    perModel: { name: string; price: number }[];
    seats?: { seats: number; price: number };
    agentHour?: number;
    fromOwn: number;
  };
  /** Serving compute (H100e): needed, served, short by; Chat: whether free users are rate-limited, paying users short. */
  compute: { need: number; served: number; short: number; spare: number; freeLimited?: boolean; payingShort?: boolean };
  turnedAway: TurnedAwayView;
  lineup: LineupCardRow[];
  /** Models you could add (usable, allowed on the product, not in it). */
  canAdd: number;
  tools: ToolsView;
}

function nameOfDest(s: GameStateV2, key: string): { kind: TurnedAwayTo['kind']; name: string } {
  if (key === 'none') return { kind: 'none', name: 'no AI' };
  const own = s.player.deployments.find((d) => d.id === key);
  if (own) return { kind: 'own', name: `your ${productName(own.channel)}` };
  if (key === 'china') return { kind: 'rival', name: s.china.lab.core.name };
  if (key === 'player:open') return { kind: 'own', name: 'your open weights' };
  return { kind: 'rival', name: s.rivals.find((r) => r.core.id === key)?.core.name ?? key };
}

function turnedAwayView(s: GameStateV2, r: ProductRead): TurnedAwayView {
  const t = r.turnedAway;
  const to = Object.entries(t.to).map(([key, v]) => ({ key, ...nameOfDest(s, key), hours: v.hours, subs: v.subs, dollars: v.dollars }))
    .sort((a, b) => b.hours + b.subs - a.hours - a.subs);
  return { dollars: t.dollars, hours: t.hours, subs: t.subs, to };
}

/** Profit, revenue, serving cost (the compute it uses, up to its need, at the rental rate) and margin. */
export function moneyOf(r: ProductRead): MoneyLine {
  const profit = r.revenue - r.runCost;
  return { profit, revenue: r.revenue, servingCost: r.runCost, margin: r.revenue > 0 ? profit / r.revenue : 0 };
}

/** Work sold (hours a year): the served share of its billed and seated hours, plus buyers taken in from your other
 *  products. 0 for Chat. */
export function workSoldOf(r: ProductRead): number {
  if (r.channel === 'consumer') return 0;
  const asked = r.hours + r.econ.seatHours;
  return Math.min(asked, r.capHours) + r.spillIn.hours;
}

/** Measured level range over your live (not retired) models, for the skill bars. */
function skillRange(s: GameStateV2): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || v.status === 'rolledBack' || v.evals.measuredL === undefined) continue;
    lo = Math.min(lo, v.evals.measuredL);
    hi = Math.max(hi, v.evals.measuredL);
  }
  return Number.isFinite(lo) ? { lo, hi } : { lo: 0, hi: 1 };
}

function skillOf(s: GameStateV2, id: string, rg: { lo: number; hi: number }) {
  const m = measuredLOf(s, versionById(s, id));
  return { skill: m.L, evaluating: m.evaluating, skillPos: rg.hi > rg.lo ? Math.max(0, Math.min(1, (m.L - rg.lo) / (rg.hi - rg.lo))) : 1 };
}

function lineupCard(s: GameStateV2, d: Deployment, r: ProductRead): LineupCardRow[] {
  const rg = skillRange(s);
  if (d.channel === 'consumer') {
    const free = freeTierVersion(s, d)?.id;
    const ids = [d.versionId, ...lineupVersions(s, d).map((v) => v.id)];
    return ids.map((id, k) => {
      const v = versionById(s, id);
      const serves: LineupCardRow['serves'] = k === 0 ? (free === id ? 'paying and free' : 'paying') : free === id ? 'free' : 'nobody';
      return { id, name: v?.name ?? id, main: k === 0, ...skillOf(s, id, rg), share: 0, hours: 0, price: 0, sellsNothing: serves === 'nobody', serves };
    });
  }
  return (r.lineup ?? []).map((x, k) => ({
    id: x.id, name: x.name, main: k === 0, ...skillOf(s, x.id, rg), share: x.share, hours: x.hours, price: x.price, sellsNothing: x.share < SELLS_NOTHING,
  }));
}

/** Tools switched on for the product (with each certification it carries: done, under way with days left, or starting
 *  tomorrow) and the tools it could still carry. */
export function toolsOn(s: GameStateV2, d: Deployment): ToolsView {
  const on: ToolOnProduct[] = [];
  for (const id of d.features) {
    const t: ProductToolDef | undefined = PRODUCT_TOOL_BY_ID[id as ProductToolId];
    if (!t || !(t.products as string[]).includes(d.channel)) continue;
    const certs: CertView[] = toolCertSectors(t).map((sector) => {
      const c = (d.certs ?? []).find((x) => x.sector === sector);
      const name = CERT_NAME[sector] ?? SECTOR_BY_ID[sector]?.name ?? sector;
      if (!c) return { sector, name, state: 'starts' as const, daysLeft: 0 };
      return certDoneBy(c, s.time.day) ? { sector, name, state: 'certified' as const, daysLeft: 0 } : { sector, name, state: 'certifying' as const, daysLeft: c.certDone - s.time.day };
    });
    on.push({ id: t.id, name: t.name, kind: t.kind, certs });
  }
  const more = PRODUCT_TOOLS.filter((t) => (t.products as string[]).includes(d.channel) && !d.features.includes(t.id))
    .map((t) => ({ id: t.id, name: t.name, built: s.player.features.includes(t.id) }));
  return { on, more };
}
const CERT_NAME: Partial<Record<SectorId, string>> = { FIN: 'Finance', HEALTH: 'Healthcare', GOV: 'Government', MIL: 'Military' };

/** Models you could add to a product: usable (ready or deployed), allowed on its channel, not in it already. */
export function addableModels(s: GameStateV2, d: Deployment): string[] {
  const inIt = new Set([d.versionId, ...(d.lineup ?? [])]);
  const ok = CHANNEL_VARIANTS[d.channel] ?? [];
  return s.player.models.versions.filter((v) => (v.status === 'ready' || v.status === 'deployed') && !inIt.has(v.id)
    && (ok.includes(v.variant) || (v.variant === 'mini' && ok.includes('full')))).map((v) => v.id);
}

/** One product card (a live product of yours), or undefined. `base`: today's market readouts (marketBase), shared by
 *  every card and preview of one render. */
export function productCardView(s: GameStateV2, id: string, base: MarketBase = marketBase(s)): ProductCard | undefined {
  const d = s.player.deployments.find((x) => x.id === id);
  const r = base.reads.get(id);
  if (!d || !r || !isProduct(d)) return undefined;
  const ch = d.channel as ProductCard['channel'];
  const e = r.econ;
  const card: ProductCard = {
    id, channel: ch, name: productName(ch), buyers: BUYER_GROUPS[ch], money: moneyOf(r), stance: d.stance,
    compute: {
      need: r.needH100e, served: r.servedH100e, short: Math.max(0, r.needH100e - r.servedH100e), spare: Math.max(0, r.servedH100e - r.needH100e),
      ...(ch === 'consumer' ? { freeLimited: e.cutFree > 1, payingShort: e.cutPaid > 1 } : {}),
    },
    turnedAway: turnedAwayView(s, r),
    lineup: lineupCard(s, d, r),
    canAdd: addableModels(s, d).length,
    tools: toolsOn(s, d),
  };
  if (ch === 'consumer') {
    const price = r.price;
    card.chat = { users: r.users ?? 0, paying: r.subs ?? 0, price, cap: e.wtp, atCap: price >= e.wtp * 0.999 };
  } else {
    const hours = workSoldOf(r);
    card.work = {
      hours, avgPrice: hours > 0 ? (r.revenue * 1e9) / hours : 0,
      perModel: (r.lineup ?? []).map((x) => ({ name: x.name, price: x.price })),
      ...(e.seats > 0 ? { seats: { seats: e.seats, price: e.seatPrice } } : {}),
      ...(e.agentHours > 0 ? { agentHour: e.agentPrice } : {}),
      fromOwn: r.spillIn.hours,
    };
  }
  return card;
}

/** Every live product's card, in the screen's order (Chat, API, Enterprise, Vetted). */
export function productCards(s: GameStateV2, base: MarketBase = marketBase(s)): ProductCard[] {
  const order = ['consumer', 'api', 'enterprise', 'vetted'];
  return s.player.deployments.filter(isProduct).sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel))
    .map((d) => productCardView(s, d.id, base)).filter((x): x is ProductCard => !!x);
}

// ───────────────────────────── the totals strip ─────────────────────────────

export interface ProductsStrip {
  money: MoneyLine;
  /** Serving compute (H100e): the products' compute (pool), what they need, short by (Σ each product's need − served). */
  compute: { pool: number; need: number; short: number };
  /** Buyers turned away by all products ($B/yr at their list prices) and the part your other products took ($B/yr at
   *  their prices). */
  turnedAway: { dollars: Money; hours: number; subs: number; keptByYou: Money };
  /** Your share of business buyers' AI spend (all sectors and regions, spend-weighted customer stock), where it is heading
   *  (the target share) and in how many days it gets there if the target held (Infinity: more than 3 years); the top
   *  rival's share. */
  business: { share: number; target: number; days: number; rival?: { name: string; share: number } };
}

export function productsStrip(s: GameStateV2, base: MarketBase = marketBase(s)): ProductsStrip {
  let revenue = 0;
  let cost = 0;
  let need = 0;
  let short = 0;
  for (const d of s.player.deployments.filter(isProduct)) {
    const r = base.reads.get(d.id);
    if (!r) continue;
    revenue += r.revenue;
    cost += r.runCost;
    need += r.needH100e;
    short += Math.max(0, r.needH100e - r.servedH100e);
  }
  const T = base.rd.turnedAway;
  let kept = 0;
  for (const k in T.to) if (s.player.deployments.some((d) => d.id === k)) kept += T.to[k].dollars;
  const pi = base.mix.providers.findIndex((p) => p.key === 'player');
  const seg = segmentShares(s, base.mix, 'enterprise', pi);
  let rival: ProductsStrip['business']['rival'];
  base.mix.providers.forEach((p, i) => {
    if (p.lab === 'player') return;
    if (!rival || seg.shares[i] > rival.share) rival = { name: nameOfDest(s, p.key).name, share: seg.shares[i] };
  });
  return {
    money: { profit: revenue - cost, revenue, servingCost: cost, margin: revenue > 0 ? (revenue - cost) / revenue : 0 },
    compute: { pool: servingPool(s), need, short },
    turnedAway: { dollars: T.dollars, hours: T.hours, subs: T.subs, keptByYou: kept },
    business: { share: pi >= 0 ? seg.shares[pi] : 0, target: seg.cust.target, days: seg.cust.days, rival },
  };
}

// ───────────────────────────── previews ─────────────────────────────

/** Profit, revenue, work sold (hours a year), Chat's paying users, serving compute need (H100e) and buyers turned away
 *  ($B/yr). */
export interface MarketNumbers { profit: Money; revenue: Money; hours: number; paying: number; need: number; turnedAway: Money }
const ZERO: MarketNumbers = { profit: 0, revenue: 0, hours: 0, paying: 0, need: 0, turnedAway: 0 };
function numbersOf(r: ProductRead | undefined, tco: number): MarketNumbers {
  if (!r) return { ...ZERO };
  const cost = Math.min(r.servedH100e, r.needH100e) * tco;
  return { profit: r.revenue - cost, revenue: r.revenue, hours: workSoldOf(r), paying: r.subs ?? 0, need: r.needH100e, turnedAway: r.turnedAway.dollars };
}
function sumOf(rs: Map<string, ProductRead>, tco: number): MarketNumbers {
  const a = { ...ZERO };
  for (const r of rs.values()) {
    const x = numbersOf(r, tco);
    a.profit += x.profit; a.revenue += x.revenue; a.hours += x.hours; a.paying += x.paying; a.need += x.need; a.turnedAway += x.turnedAway;
  }
  return a;
}
const diff = (a: MarketNumbers, b: MarketNumbers): MarketNumbers => ({ profit: a.profit - b.profit, revenue: a.revenue - b.revenue, hours: a.hours - b.hours, paying: a.paying - b.paying, need: a.need - b.need, turnedAway: a.turnedAway - b.turnedAway });

/** The change a year of one edit (after − today): on the edited product and on all your products together (an edit
 *  moves buyers and serving compute between your products), with the edited product's numbers after; `allServed`:
 *  after the edit it turns no buyers away. `blocked`: why the edit is not allowed (then no numbers). */
export interface EditDelta {
  changes: ProductChanges;
  blocked?: string;
  product: MarketNumbers;
  all: MarketNumbers;
  after: MarketNumbers;
  allServed: boolean;
  fromDay: number;
}

/** Preview one edit through previewEdit (the revenue system's path on the edited state). */
export function editDelta(s: GameStateV2, id: string, changes: ProductChanges, base: MarketBase = marketBase(s)): EditDelta {
  const d = s.player.deployments.find((x) => x.id === id);
  const z = { changes, product: { ...ZERO }, all: { ...ZERO }, after: { ...ZERO }, allServed: false, fromDay: s.time.day + 1 };
  if (!d) return { ...z, blocked: 'Unknown product' };
  const why = editBlock(s, d, changes);
  if (why) return { ...z, blocked: why };
  const pv = previewEdit(s, d, changes, base);
  const tco = h100eYear(s);
  const after = numbersOf(pv.after, tco);
  return {
    changes, product: diff(after, numbersOf(pv.before, tco)), all: diff(sumOf(pv.allAfter, tco), sumOf(pv.allBefore, tco)), after,
    allServed: !!pv.after && pv.after.turnedAway.hours + pv.after.turnedAway.subs < 1 && pv.after.needH100e <= pv.after.servedH100e * 1.0001,
    fromDay: pv.fromDay,
  };
}

/** A popover row: a model you could put in a lineup slot, with its measured skill, its serving cost per token ÷ the
 *  slot model's ("cost to serve"), whether it is new (ready, in no product yet) and the preview. */
export interface LineupOption {
  id: string;
  name: string;
  skill: number;
  skillPos: number;
  evaluating: boolean;
  costRatio: number;
  isNew: boolean;
  delta: EditDelta;
}

const lineupIds = (d: Deployment) => [d.versionId, ...(d.lineup ?? []).filter((x) => x !== d.versionId)];
/** The edit that puts `withId` in place of `slot` (the main model or a lineup entry); Chat's free-tier choice follows the
 *  slot. */
function swapChange(d: Deployment, slot: string, withId: string): ProductChanges {
  const c: ProductChanges = slot === d.versionId ? { versionId: withId } : { lineup: (d.lineup ?? []).map((x) => (x === slot ? withId : x)) };
  if (d.freeTierId === slot) c.freeTierId = withId;
  return c;
}

function optionOf(s: GameStateV2, d: Deployment, refId: string, id: string, c: ProductChanges, base: MarketBase, rg: { lo: number; hi: number }): LineupOption {
  const v = versionById(s, id);
  const ref = versionById(s, refId);
  const live = s.player.deployments.some((x) => x.status !== 'withdrawn' && (x.versionId === id || (x.lineup ?? []).includes(id)));
  return {
    id, name: v?.name ?? id, ...skillOf(s, id, rg),
    costRatio: v && ref ? flopPerToken(s, v) / flopPerToken(s, ref) : 1,
    isNew: v?.status === 'ready' && !live,
    delta: editDelta(s, d.id, c, base),
  };
}

/** The swap popover of a lineup slot (`slot`: a version id in the product): every model you could put there instead. */
export function lineupSwapOptions(s: GameStateV2, id: string, slot: string, base: MarketBase = marketBase(s)): LineupOption[] {
  const d = s.player.deployments.find((x) => x.id === id);
  if (!d || !lineupIds(d).includes(slot)) return [];
  const rg = skillRange(s);
  return addableModels(s, d).map((m) => optionOf(s, d, slot, m, swapChange(d, slot, m), base, rg));
}

/** The "add a model" row: every model you could add at the end of the lineup (cost ratio vs the main model). */
export function lineupAddOptions(s: GameStateV2, id: string, base: MarketBase = marketBase(s)): LineupOption[] {
  const d = s.player.deployments.find((x) => x.id === id);
  if (!d) return [];
  const rg = skillRange(s);
  return addableModels(s, d).map((m) => optionOf(s, d, d.versionId, m, { lineup: [...(d.lineup ?? []).filter((x) => x !== d.versionId), m] }, base, rg));
}

/** "Remove from lineup" for a lineup entry (the main model cannot be removed: swap it instead). */
export function lineupRemovePreview(s: GameStateV2, id: string, slot: string, base: MarketBase = marketBase(s)): EditDelta | undefined {
  const d = s.player.deployments.find((x) => x.id === id);
  if (!d || slot === d.versionId || !(d.lineup ?? []).includes(slot)) return undefined;
  const c: ProductChanges = { lineup: (d.lineup ?? []).filter((x) => x !== slot && x !== d.versionId) };
  if (d.freeTierId === slot) c.freeTierId = null;
  return editDelta(s, id, c, base);
}

/** The stance switch: the change of moving the product to the other stance. */
export function stancePreview(s: GameStateV2, id: string, base: MarketBase = marketBase(s)): { from: PriceStance; to: PriceStance; delta: EditDelta } | undefined {
  const d = s.player.deployments.find((x) => x.id === id);
  if (!d) return undefined;
  const to: PriceStance = d.stance === 'profit' ? 'share' : 'profit';
  return { from: d.stance, to, delta: editDelta(s, id, { stance: to }, base) };
}
