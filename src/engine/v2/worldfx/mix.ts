// World model mix: which providers' models each sector in each region uses, what they offer on the sector's work and at
// what price (V2-SPEC §3.11.1; model v3 V4: design/MODEL-V3.md §7.3–7.4, design/V3-BUILD.md "V4 notes"). Owner: WS5.
//
// Providers: the player's paid external deployments (best one per sector), the player's open-weights release, each
// active rival's public model, and DeepCent's public model. Per sector s (its work type, worldfx/serving.ts):
//   offer_X   = fit (OOM), coverage a, cost and price per work-hour of X's model (price = markup × own cost ≤ value)
//   target_X ∝ exp(SHARE_SLOPE_G·(fit_X − fit_best)) · price_X^−1.5 · access_X,r · brand_X      (the logit, V4.2)
//   share_X   = the segment's customer stock, moving toward target_X at the segment's speed (CUSTOMER_TAU)
//   F         = (1 − w_PHYS)·Σ share·a + w_PHYS·σ((Le_PHYS − fMid − θ)/fSpread)    (PHYS stays robot-bound)
//   K         = Σ share·σ(ln(wage ÷ (price + review))/0.7)                           (the physical cost gate)
// The consumer market is the same on the consumer-chat work type, priced per subscriber-month; each provider's paid share
// of its users is a second stock (A2b, CONSUMER_MKT.paid). A2c: per provider also the agent-hours a supervising hour buys
// (k after the buyer's gate) and their price, and the seat price (open weights sell none); prices[] are per adopted
// task-hour (the hours billed per hour). A4: agent-hours stop at the sector's work demand (worldfx/use.ts agentCeilingOf:
// adopted + agent hours ≤ E0·2000·(1 + η·CR), their spend ≤ that × the wage); agentK is after the ceiling.
// Display levels (the share-weighted domain vector `dom`, Le_d = min(L_d, L_AGENCY + 2)) still feed substitution α, the
// integration boost, control and the tech tree, as in v2.
import { SECTORS, REGIONS, ECON } from '../../../data/v2/sectors';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { CONSUMER_MKT, CUSTOMER_TAU, PRICE_ELASTICITY, SEATS, SHARE_SLOPE_G } from '../../../data/v2/serving';
import { ASSIST } from '../../../data/v2/workTypes';
import { memo } from '../core/memo';
import { CHINA_ID } from '../models/labs';
import type { Deployment, DomainId, GameStateV2, LabId, ModelVersion, RegionId, SectorId, SimpleModel, SystemCtx } from '../types';
import { robotAvail } from './robots';
import { agentCeilingOf, workHoursOf, type AgentCeiling } from './use';
import { sigmoid, techRamp } from './policy';
import { productDomains } from '../models/products';
import { flopPerToken } from '../departments/workfit';
import {
  CHINA_MARKUP, RIVAL_MARKUP, effortTokens, marketModel, enablerShare, fptOfSimple, fxOn, markupOf, offerOf,
  agentDemandOf, paidShareTarget, productFx, productOffer, productUses, savedPerAdoptedHour, serveDollarsPerHour, settingsDG, subPrice, valuePerHour, wagePerHour, type Offer,
} from './serving';

export { PRICE_ELASTICITY };
/** Open weights are served by hosts near cost (×1.2) [D]. */
export const OPEN_MARKUP = 1.2;

/** Channels that sell into sectors (gov only into GOV/MIL). Consumer is its own market; internal earns nothing. */
export const SECTOR_CHANNELS: Deployment['channel'][] = ['api', 'agents', 'enterprise', 'trusted', 'gov'];

const ND = DOMAIN_IDS.length;
const I = Object.fromEntries(DOMAIN_IDS.map((d, i) => [d, i])) as Record<DomainId, number>;
const PHYS = I.PHYS;
const AGENCY = I.AGENCY;
const COG_IDX = DOMAIN_IDS.map((_, i) => i).filter((i) => i !== PHYS);

/** Precomputed sector task vectors: cognitive (domain index, weight) pairs and the PHYS weight (display levels). */
export const SECTOR_TASKS = SECTORS.map((def) => {
  const idx: number[] = [];
  const w: number[] = [];
  for (const [d, x] of Object.entries(def.tasks) as [DomainId, number][]) {
    if (d === 'PHYS') continue;
    idx.push(I[d]);
    w.push(x);
  }
  return { id: def.id, idx, w, physW: def.tasks.PHYS ?? 0, gov: def.id === 'GOV' || def.id === 'MIL', theta: def.theta };
});
export const SECTOR_INDEX = Object.fromEntries(SECTORS.map((d, i) => [d.id, i])) as Record<SectorId, number>;

export interface Provider {
  key: string; // 'player' | 'player:open' | rival id | 'china'
  lab: LabId;
  paid: boolean; // earns player revenue
  open: boolean;
  /** Model domain levels (non-player providers, and the player's open release). */
  dom?: Record<DomainId, number>;
  /** The model (non-player providers): fit reads its G, cost its FLOP per token. */
  model?: SimpleModel | ModelVersion;
  fpt?: number;
  markup: number;
  brand: number;
  appeal: number;
}

export interface SectorMix {
  /** Customer stock shares by provider index (what the sector uses today), and the logit target they move toward. */
  share: number[];
  target: number[];
  /** Provider display sector levels (v2's Le_X,s), by provider index; −Infinity = not serving. */
  level: number[];
  best: number;
  /** Per provider: fit (OOM), coverage of the sector's cognitive work, price per adopted task-hour ($, value-capped). */
  fit: number[];
  cover: number[];
  prices: number[];
  /** A2c per provider: agent-hours a supervising hour buys (k after the buyer's gate), price per agent-hour ($, capped at
   *  the wage), seat price per seat-month ($; 0 for open weights: in-house use is unbilled). seatPrice: the going seat
   *  price (share-weighted over the providers that sell seats) the seat target reads. */
  agentK: number[];
  agentPrices: number[];
  seatPrices: number[];
  seatPrice: number;
  /** A4: the demand ceiling on AI work here (use.ts agentCeilingOf). agentK is after it: every provider's agent-hours
   *  × agentCeiling.fill. */
  agentCeiling: AgentCeiling;
  /** Share-weighted effective domain levels (the world model m*). */
  dom: Record<DomainId, number>;
  /** Share-weighted price per hour of AI use ($) and the buyer's cost per AI work-hour saved, incl. review ($). */
  price: number;
  pCost: number;
  /** Feasibility (coverage, PHYS robot-bound) and cost gate on the market's mix of models. */
  F: number;
  K: number;
  /** For the player: the deployment that serves this sector (best offer), its price per work-hour. */
  playerDep?: string;
  playerPrice: number;
  /** Share lost to price (1 = none) vs to quality, for the binding-cause readout. */
  priceFactor: number;
}

export interface ConsumerMix {
  share: number[]; target: number[]; level: number[]; socials: number[]; best: number; social: number;
  /** Per provider: consumer-chat fit, coverage and subscription price ($/month). */
  fit: number[]; cover: number[]; prices: number[];
  /** Coverage of consumer chat by the best accessible model. */
  bestCover: number;
  /** A2b: per provider, the paid share of its weekly users (stock) and the target it moves toward. */
  paid: number[]; paidTarget: number[];
  /** The going subscription price ($/month): users' share-weighted price among plans at or below the willingness to pay. */
  going: number;
  playerDep?: string; playerPrice: number; priceFactor: number;
}

export interface WorldMix {
  providers: Provider[];
  sec: Record<RegionId, Record<SectorId, SectorMix>>;
  consumer: Record<RegionId, ConsumerMix>;
  /** Best public general level and domain levels (max over providers' raw model levels). */
  bestPublic: Record<DomainId, number>;
  bestPublicLg: number;
  /** The player's offer per sector (its best product's). */
  playerOffers: Partial<Record<SectorId, Offer>>;
  /** P2: every player product's offer per sector as computed for this mix (key `<deployment id>|<sector>`). Only valid
   *  while the state is unchanged since the mix was computed (applyRevenue reuses it right after computing the mix). */
  offerBy: Map<string, Offer>;
}

/** Domain level adjustment of a deployment for the display mix: effort, safeguards, control layer [D]. */
function depOffset(d: Deployment): number {
  let o = d.effort === 'low' ? -0.4 : d.effort === 'deep' ? 0.3 : 0;
  o += d.safeguards === 'hardened' ? -0.2 : d.safeguards === 'classifiers' ? -0.05 : 0;
  if (d.controlLayer) o -= 0.1;
  return o;
}

/** Appeal of a version's character training for consumers (§3.11.3 "appeal (pref option)") [D]. */
export function appealOf(v: ModelVersion | undefined): number {
  switch (v?.design.pref) {
    case 'engagement': return 1.25;
    case 'persuasion': return 1.15;
    case 'minimal': return 0.9;
    default: return 1;
  }
}

/** Player deployments that earn revenue in external markets. */
export function paidDeployments(s: GameStateV2): Deployment[] {
  return s.player.deployments.filter((d) => d.status !== 'withdrawn' && d.channel !== 'internal' && d.channel !== 'open');
}

export function versionOf(s: GameStateV2, id: string): ModelVersion | undefined {
  return s.player.models.versions.find((v) => v.id === id);
}

/** A packed array of n copies of x (faster than new Array(n).fill(x), which is holey). */
function filled(n: number, x: number): number[] {
  const a: number[] = [];
  for (let i = 0; i < n; i++) a.push(x);
  return a;
}

/** Domain vector (DOMAIN_IDS order) → record, as a fixed-shape literal (fast property access). */
function domRecord(v: ArrayLike<number>): Record<DomainId, number> {
  return { CODE: v[I.CODE], RSCH: v[I.RSCH], REASON: v[I.REASON], AGENCY: v[I.AGENCY], SOCIAL: v[I.SOCIAL], MEDIA: v[I.MEDIA], CYBER: v[I.CYBER], BIO: v[I.BIO], PHYS: v[I.PHYS] };
}

/** Horizon-capped domain vector (Le for cognitive domains; raw PHYS). */
function capVec(dom: Record<DomainId, number>, offset = 0): number[] {
  const v = new Array<number>(ND);
  for (let i = 0; i < ND; i++) v[i] = Math.max(0, dom[DOMAIN_IDS[i]] + offset);
  const cap = v[AGENCY] + 2;
  for (const i of COG_IDX) if (v[i] > cap) v[i] = cap;
  return v;
}

/** Effective display level Le of a sector for a model with domain levels `dom` (research/16 §1A.2 step 1). */
export function sectorLevel(dom: Record<DomainId, number>, sector: SectorId, physCap: number, pf: { floor: number; log: number }, out?: Record<DomainId, number>): number {
  const v = capVec(dom);
  const t = SECTOR_TASKS[SECTOR_INDEX[sector]];
  const lp = Math.min(Math.max(v[PHYS], pf.floor) + (sector === 'LOG' ? pf.log : 0), physCap);
  if (out) {
    for (let i = 0; i < ND; i++) out[DOMAIN_IDS[i]] = v[i];
    out.PHYS = lp;
  }
  let L = t.physW * lp;
  for (let k = 0; k < t.idx.length; k++) L += t.w[k] * v[t.idx[k]];
  return L;
}

function access(p: Provider, r: RegionId): number {
  if (p.lab === CHINA_ID) return r === 'CN' ? 1 : p.open ? (r === 'US' ? 0.3 : 0.7) : r === 'US' ? 0.05 : 0.4;
  if (r === 'CN') return p.open ? 0.6 : 0.05;
  return 1;
}

function playerBrand(s: GameStateV2): number {
  // brand 1.2 incumbent, ±0.1 with approval (§3.11.1)
  return 1.2 + 0.1 * Math.max(-1, Math.min(1, s.pub.approval / 50));
}

/** Compute the world mix (memoised per tick when a ctx is given). */
export function worldMix(s: GameStateV2, ctx?: SystemCtx): WorldMix {
  return ctx ? memo(ctx, 'WS5:mix', () => computeMix(s)) : computeMix(s);
}

/** Logit weights → shares (normalised): exp(slope·(fit − best)) · (price ÷ cheapest)^−ε · access · brand. */
function logit(fit: number[], price: number[], acc: number[], brand: number[]): number[] {
  const n = fit.length;
  let best = -Infinity;
  let pMin = Infinity;
  for (let i = 0; i < n; i++) if (acc[i] > 0 && fit[i] > -Infinity) {
    if (fit[i] > best) best = fit[i];
    if (price[i] > 0 && price[i] < pMin) pMin = price[i];
  }
  const out = filled(n, 0);
  if (best === -Infinity) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (fit[i] === -Infinity || acc[i] <= 0) continue;
    const pr = price[i] > 0 && pMin < Infinity ? price[i] / pMin : 1;
    const w = (Math.exp(SHARE_SLOPE_G * (fit[i] - best)) * acc[i] * brand[i]) / (PRICE_ELASTICITY === 1 ? pr : Math.pow(pr, PRICE_ELASTICITY));
    out[i] = w;
    sum += w;
  }
  if (sum > 0) for (let i = 0; i < n; i++) out[i] /= sum;
  return out;
}

/** The customer stock of a segment as shares by provider index (the target where the segment has no stock yet). */
function stockShares(s: GameStateV2, providers: Provider[], r: RegionId, seg: string, target: number[]): number[] {
  const st = s.world.fx.cust?.[r]?.[seg];
  if (!st) return target.slice();
  const n = providers.length;
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = st[providers[i].key] ?? 0;
    out.push(x);
    sum += x;
  }
  if (sum <= 1e-12) return target.slice();
  for (let i = 0; i < n; i++) out[i] = out[i] / sum;
  return out;
}

/** The market's providers (computeMix's list, in its order). */
function providersOf(s: GameStateV2, paid: Deployment[], ver: Map<string, ModelVersion>): Provider[] {
  const providers: Provider[] = [];
  if (paid.length) providers.push({ key: 'player', lab: 'player', paid: true, open: false, brand: playerBrand(s), appeal: 1, markup: 0 });
  const open = s.player.deployments.filter((d) => d.channel === 'open' && d.status !== 'withdrawn');
  if (open.length) {
    let best: ModelVersion | undefined;
    for (const d of open) {
      const v = ver.get(d.versionId);
      if (v && (!best || v.Lg > best.Lg)) best = v;
    }
    if (best) providers.push({ key: 'player:open', lab: 'player', paid: false, open: true, dom: best.domains, model: best, fpt: best.fpt, brand: 1, appeal: 1, markup: OPEN_MARKUP });
  }
  for (const r of s.rivals) {
    const m = r.publicModel;
    if (!m || (r.core.status !== 'active' && !m.openWeights)) continue;
    providers.push({ key: r.core.id, lab: r.core.id, paid: false, open: m.openWeights, dom: m.domains, model: marketModel(s, m), brand: r.core.status === 'active' ? 1 : 0.5, appeal: 1, markup: m.openWeights ? OPEN_MARKUP : RIVAL_MARKUP });
  }
  const cn = s.china.lab.publicModel;
  if (cn && (s.china.lab.core.status === 'active' || cn.openWeights)) providers.push({ key: CHINA_ID, lab: CHINA_ID, paid: false, open: cn.openWeights, dom: cn.domains, model: marketModel(s, cn), brand: 1, appeal: 1, markup: cn.openWeights ? OPEN_MARKUP : CHINA_MARKUP });
  for (const p of providers) if (p.model && !p.fpt) p.fpt = 'baseId' in p.model ? flopPerToken(s, p.model) : fptOfSimple(s, p.model);
  return providers;
}

const versionMap = (s: GameStateV2) => {
  const ver = new Map<string, ModelVersion>();
  for (const v of s.player.models.versions) ver.set(v.id, v);
  return ver;
};

/** Best public domain levels (max over the player's paid products, with their effort/safeguard offsets, and the other
 *  providers' models). */
function bestPublicFrom(cands: readonly { dep: Deployment; dom: Record<DomainId, number> }[], providers: readonly Provider[]): Record<DomainId, number> {
  const bestPublic = domRecord(new Float64Array(ND));
  for (const c of cands) for (const k of DOMAIN_IDS) bestPublic[k] = Math.max(bestPublic[k], c.dom[k] + depOffset(c.dep));
  for (const p of providers) {
    if (!p.dom) continue;
    for (const k of DOMAIN_IDS) bestPublic[k] = Math.max(bestPublic[k], p.dom[k]);
  }
  return bestPublic;
}

/** P2: the world mix's bestPublic alone (the same values), for readers that need nothing else (macro's automation
 *  factor, moonshot gates): skips the offers, shares and stocks. */
export function bestPublicOf(s: GameStateV2): Record<DomainId, number> {
  const paid = paidDeployments(s);
  const ver = versionMap(s);
  const cands: { dep: Deployment; dom: Record<DomainId, number> }[] = [];
  for (const d of paid) {
    const mv = ver.get(d.versionId);
    if (mv) cands.push({ dep: d, dom: productDomains(s, d, mv)! });
  }
  return bestPublicFrom(cands, providersOf(s, paid, ver));
}

function computeMix(s: GameStateV2): WorldMix {
  const paid = paidDeployments(s);
  const ver = versionMap(s);
  const providers = providersOf(s, paid, ver);

  const pfFloor = 10 * techRamp(s, 'W16');
  const pfLog = 3 * techRamp(s, 'W19');
  const pen = s.world.fx.capPenalty;
  const n = providers.length;
  const playerIdx = providers.findIndex((p) => p.key === 'player');
  const acc = REGIONS.map((r) => providers.map((p) => access(p, r)));
  const brandPow = providers.map((p, i) => p.brand * (i === playerIdx ? 1 - pen.sector : 1));
  const rate = serveDollarsPerHour(s);

  // Capped domain vectors (display): non-player providers, and player candidate deployments.
  const pvec: (number[] | undefined)[] = providers.map((p) => (p.dom ? capVec(p.dom) : undefined));
  const cands: { dep: Deployment; dom: Record<DomainId, number>; v: number[]; ch: Deployment['channel']; uses: ReturnType<typeof productUses>; fx: ReturnType<typeof productFx> }[] = [];
  for (const d of paid) {
    const mv = ver.get(d.versionId);
    if (!mv) continue;
    const dom = productDomains(s, d, mv)!;
    cands.push({ dep: d, dom, v: capVec(dom, depOffset(d)), ch: d.channel, uses: productUses(s, d), fx: productFx(s, d) });
  }
  const fxCert = s.world.fx.certDay;
  const certified = (sec: SectorId) => {
    const c = fxCert[sec];
    return c !== undefined && c <= s.time.day;
  };

  const bestPublic = bestPublicFrom(cands, providers);
  let bestPublicLg = 0;
  for (const c of cands) bestPublicLg = Math.max(bestPublicLg, ver.get(c.dep.versionId)!.Lg);
  for (const r of [...s.rivals, s.china.lab]) if (r.publicModel) bestPublicLg = Math.max(bestPublicLg, r.publicModel.Lg);

  // Per sector (region-independent): each provider's offer (fit, coverage, price before the value cap) and display
  // level; the player's best product by offer utility.
  const S = SECTOR_TASKS.length;
  const offers: (Offer | undefined)[][] = [];
  const cogL: number[][] = [];
  const pCand: number[] = [];
  const playerOffers: Partial<Record<SectorId, Offer>> = {};
  const offerBy = new Map<string, Offer>();
  for (let si = 0; si < S; si++) {
    const t = SECTOR_TASKS[si];
    const row: (Offer | undefined)[] = new Array(n);
    const lrow = filled(n, -Infinity);
    for (let i = 0; i < n; i++) {
      const p = providers[i];
      const v = pvec[i];
      if (v) {
        let L = 0;
        for (let k = 0; k < t.idx.length; k++) L += t.w[k] * v[t.idx[k]];
        lrow[i] = L;
      }
      if (p.model) row[i] = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], t.id, { markup: p.markup, rate });
    }
    let bc = -1;
    let bu = -Infinity;
    if (playerIdx >= 0) {
      for (let c = 0; c < cands.length; c++) {
        const cd = cands[c];
        if (cd.ch === 'consumer' || (cd.ch === 'gov' && !t.gov)) continue;
        const o = productOffer(s, cd.dep, t.id, certified(t.id), cd.uses, cd.fx);
        offerBy.set(`${cd.dep.id}|${t.id}`, o);
        const u = SHARE_SLOPE_G * o.fit - PRICE_ELASTICITY * Math.log(Math.max(1e-9, o.price));
        if (u > bu) {
          bu = u;
          bc = c;
          row[playerIdx] = o;
          playerOffers[t.id] = o;
        }
      }
      if (bc >= 0) {
        const cd = cands[bc];
        let L = 0;
        for (let k = 0; k < t.idx.length; k++) L += t.w[k] * cd.v[t.idx[k]];
        lrow[playerIdx] = L;
      }
    }
    offers.push(row);
    cogL.push(lrow);
    pCand.push(bc);
  }

  // Display vectors per sector (the player's is its best candidate's).
  const vecs: (number[] | undefined)[][] = [];
  for (let si = 0; si < S; si++) vecs.push(providers.map((_, i) => (i === playerIdx ? cands[pCand[si]]?.v : pvec[i])));
  const reviewK = ASSIST.review;
  const invK = 1 / ECON.kSpread;
  const sec = {} as Record<RegionId, Record<SectorId, SectorMix>>;
  REGIONS.forEach((r, ri) => {
    const rowOut = {} as Record<SectorId, SectorMix>;
    for (let si = 0; si < S; si++) {
      const t = SECTOR_TASKS[si];
      const physCap = t.physW > 0 ? 15 * robotAvail(s, r, t.id) : 15;
      const value = valuePerHour(s, t.id, r);
      const wage = wagePerHour(t.id, r);
      const hf = savedPerAdoptedHour(s, r, t.id);
      const fit = filled(n, -Infinity);
      const cover = filled(n, 0);
      const prices = filled(n, 0);
      const agentK = filled(n, 0);
      const agentPrices = filled(n, 0);
      const seatPrices = filled(n, 0);
      const level = filled(n, -Infinity);
      const physLe = filled(n, 0);
      const vs = vecs[si];
      for (let i = 0; i < n; i++) {
        const o = offers[si][i];
        if (!o) continue;
        fit[i] = o.fit;
        cover[i] = o.a;
        prices[i] = Math.max(o.cost, Math.min(o.price, value));
        const ag = agentDemandOf(o, wage);
        agentK[i] = ag.k;
        agentPrices[i] = ag.price;
        seatPrices[i] = providers[i].open ? 0 : o.seat;
        const v = vs[i];
        if (v) {
          physLe[i] = Math.min(Math.max(v[PHYS], pfFloor) + (t.id === 'LOG' ? pfLog : 0), physCap);
          level[i] = cogL[si][i] + t.physW * physLe[i];
        }
      }
      const target = logit(fit, prices, acc[ri], brandPow);
      const share = stockShares(s, providers, r, t.id, target);
      let best = -Infinity;
      for (let i = 0; i < n; i++) if (acc[ri][i] > 0 && level[i] > best) best = level[i];
      const dv = filled(ND, 0);
      let px = 0;
      let pc = 0;
      let aCog = 0;
      let K = 0;
      let lePhys = 0;
      let wsum = 0;
      let sw = 0;
      let sp = 0;
      // A4: agent-hours per supervising hour the buyers want (Σ share·k), their spend and buyer's cost (price + the
      // supervision wage/λ), unnormalised as revenue.ts sectorSpendParts sums them.
      let kw = 0;
      let kp = 0;
      let kb = 0;
      for (let i = 0; i < n; i++) {
        const x = share[i];
        const oi = offers[si][i];
        if (!x || !oi) continue;
        const kk = x * agentK[i];
        if (kk > 0) {
          kw += kk;
          kp += kk * agentPrices[i];
          kb += kk * (agentPrices[i] + wage / Math.max(1e-9, oi.lam));
        }
        wsum += x;
        const v = vs[i];
        if (v) for (let k = 0; k < ND; k++) dv[k] += x * (k === PHYS ? physLe[i] : v[k]);
        lePhys += x * physLe[i];
        px += x * prices[i];
        if (seatPrices[i] > 0) {
          sw += x;
          sp += x * seatPrices[i];
        }
        // buyerCost and costGateOf (serving.ts) inlined: σ(ln(wage ÷ bc)/k) = 1 / (1 + (bc ÷ wage)^(1/k)).
        const bc = prices[i] / hf + reviewK * wage * (1 - Math.min(1, cover[i]));
        pc += x * bc;
        aCog += x * cover[i];
        K += x / (1 + Math.pow(Math.max(1e-9, bc) / wage, invK));
      }
      if (wsum > 0 && Math.abs(wsum - 1) > 1e-9) {
        for (let k = 0; k < ND; k++) dv[k] /= wsum;
        px /= wsum;
        pc /= wsum;
        aCog /= wsum;
        K /= wsum;
        lePhys /= wsum;
      }
      const physF = t.physW > 0 ? sigmoid((lePhys - ECON.fMid - t.theta) / ECON.fSpread) : 0;
      const F = (1 - t.physW) * aCog + t.physW * physF;
      const pp = playerIdx >= 0 ? prices[playerIdx] : 0;
      const price = wsum > 0 ? px : 0;
      const pCost = wsum > 0 ? pc : wage;
      // A4: the demand ceiling on AI work; agent-hours beyond it are not bought (every provider's × fill).
      const st = s.world.sectors[r][t.id];
      const wh = workHoursOf(st, t.id);
      const agentCeiling = agentCeilingOf(SECTORS[si], st.E0 * ECON.hours, wage, wh.adopted, wh.adopted * price, pCost, wh.supervising * kw, wh.supervising * kp, kw > 0 ? kb / kw : wage);
      if (agentCeiling.fill < 1) for (let i = 0; i < n; i++) agentK[i] *= agentCeiling.fill;
      rowOut[t.id] = {
        share, target, level, best: best === -Infinity ? 0 : best, fit, cover, prices, agentK, agentPrices, seatPrices, seatPrice: sw > 0 ? sp / sw : SEATS.price, agentCeiling, dom: domRecord(dv),
        price, pCost, F, K: wsum > 0 ? K : 0,
        ...(playerIdx >= 0 && pCand[si] >= 0 ? { playerDep: cands[pCand[si]].dep.id } : {}),
        playerPrice: pp, priceFactor: playerIdx >= 0 && pp > 0 && px > 0 ? Math.min(1, Math.pow(pp / px, -PRICE_ELASTICITY)) : 1,
      };
    }
    sec[r] = rowOut;
  });

  // Consumer market (the consumer-chat work type; price per subscriber-month).
  const cFit = filled(n, -Infinity);
  const cCover = filled(n, 0);
  const cPrice = filled(n, 0);
  const cLevel = filled(n, -Infinity);
  const cSocial = filled(n, 0);
  const cApp = providers.map((p) => p.appeal);
  let cDep: string | undefined;
  for (let i = 0; i < n; i++) {
    const p = providers[i];
    const v = pvec[i];
    if (v) {
      cLevel[i] = (v[I.SOCIAL] + v[I.REASON] + v[I.MEDIA]) / 3;
      cSocial[i] = v[I.SOCIAL];
    }
    if (!p.model) continue;
    const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], 'CHAT', { markup: p.markup, rate });
    cFit[i] = o.fit;
    cCover[i] = o.a;
    cPrice[i] = subPrice(s, p.fpt ?? 2e12, p.markup).price;
  }
  if (playerIdx >= 0) {
    let bu = -Infinity;
    for (const c of cands) {
      if (c.ch !== 'consumer') continue;
      const x = fxOn(c.fx, 'CHAT');
      const o = offerOf(s, c.uses, 'CHAT', { dG: settingsDG(c.dep) + x.dG, hMult: x.hMult, effort: effortTokens(c.dep.effort), markup: markupOf(c.dep), rate });
      const price = subPrice(s, c.uses[0]?.fpt ?? 2e12, markupOf(c.dep), effortTokens(c.dep.effort)).price;
      const u = SHARE_SLOPE_G * o.fit - PRICE_ELASTICITY * Math.log(Math.max(1e-9, price));
      if (u > bu) {
        bu = u;
        cFit[playerIdx] = o.fit;
        cCover[playerIdx] = o.a;
        cPrice[playerIdx] = price;
        cDep = c.dep.id;
        cApp[playerIdx] = appealOf(ver.get(c.dep.versionId)) * (1 + enablerShare(c.fx, 'CHAT'));
        cLevel[playerIdx] = (c.v[I.SOCIAL] + c.v[I.REASON] + c.v[I.MEDIA]) / 3;
        cSocial[playerIdx] = c.v[I.SOCIAL];
      }
    }
  }
  const consumer = {} as Record<RegionId, ConsumerMix>;
  REGIONS.forEach((r, ri) => {
    const cBrand = providers.map((p, i) => p.brand * cApp[i] * (i === playerIdx ? 1 - pen.consumer : 1));
    const target = logit(cFit, cPrice, acc[ri], cBrand);
    const share = stockShares(s, providers, r, 'consumer', target);
    let best = -Infinity;
    let bestCover = 0;
    for (let i = 0; i < n; i++) if (acc[ri][i] > 0) {
      if (cLevel[i] > best) best = cLevel[i];
      if (cCover[i] > bestCover) bestCover = cCover[i];
    }
    let soc = 0;
    let px = 0;
    for (let i = 0; i < n; i++) {
      soc += share[i] * cSocial[i];
      px += share[i] * cPrice[i];
    }
    const pp = playerIdx >= 0 ? cPrice[playerIdx] : 0;
    // A2b: paid share per provider — a stock (fx.paid) toward (p0 + p1·coverage)·(going price ÷ price)^ε, the going
    // price the users' share-weighted subscription price among plans at or below the willingness to pay; absent = its
    // target.
    let gw = 0;
    let gp = 0;
    for (let i = 0; i < n; i++) if (share[i] > 0 && cPrice[i] > 0 && cPrice[i] <= CONSUMER_MKT.wtpMonth * (1 + 1e-9)) {
      gw += share[i];
      gp += share[i] * cPrice[i];
    }
    const going = gw > 0 ? gp / gw : CONSUMER_MKT.wtpMonth;
    const paidTarget = cCover.map((a, i) => (cFit[i] === -Infinity ? 0 : paidShareTarget(a, cPrice[i], going)));
    const pst = s.world.fx.paid?.[r];
    const paid = providers.map((p, i) => pst?.[p.key] ?? paidTarget[i]);
    consumer[r] = {
      share, target, level: cLevel, socials: cSocial, best: best === -Infinity ? 0 : best, social: soc, fit: cFit, cover: cCover, prices: cPrice, bestCover, paid, paidTarget, going,
      ...(cDep ? { playerDep: cDep } : {}), playerPrice: pp, priceFactor: pp > 0 && px > 0 ? Math.min(1, Math.pow(pp / px, -PRICE_ELASTICITY)) : 1,
    };
  });
  return { providers, sec, consumer, bestPublic, bestPublicLg, playerOffers, offerBy };
}

/** Move every segment's customer stock toward its logit target (daily; V4.2). Segments with no stock start at the target
 *  (no jump on day 0); providers that left drop out; a new provider starts at 0 and grows. */
export function advanceCustomers(s: GameStateV2, mix: WorldMix, dt = 1 / 365) {
  const fx = s.world.fx;
  fx.cust ??= { US: {}, CN: {}, ROW: {} };
  const ps = mix.providers;
  const step = (r: RegionId, seg: string, target: number[], tau: number) => {
    const row = (fx.cust[r] ??= {});
    const old = row[seg];
    const k = Math.min(1, dt / tau);
    const out: Record<string, number> = {};
    const keys: string[] = [];
    let sum = 0;
    for (let i = 0; i < ps.length; i++) {
      const key = ps[i].key;
      const x = old ? (old[key] ?? 0) + (target[i] - (old[key] ?? 0)) * k : target[i];
      if (x > 1e-6) {
        if (!(key in out)) keys.push(key);
        out[key] = x;
        sum += x;
      }
    }
    for (const key of keys) out[key] = Math.round((out[key] / (sum || 1)) * 1e6) / 1e6;
    row[seg] = out;
  };
  // A2b: paid shares (not normalised: each provider's own share of its users who subscribe). A new provider starts at
  // its target (its users arrive through the user-share stock).
  fx.paid ??= { US: {}, CN: {}, ROW: {} };
  const kPaid = Math.min(1, dt / CONSUMER_MKT.paid.tau);
  for (const r of REGIONS) {
    for (const t of SECTOR_TASKS) step(r, t.id, mix.sec[r][t.id].target, t.gov ? CUSTOMER_TAU.gov : CUSTOMER_TAU.sector);
    step(r, 'consumer', mix.consumer[r].target, CUSTOMER_TAU.consumer);
    const cm = mix.consumer[r];
    const old = fx.paid[r] ?? {};
    const out: Record<string, number> = {};
    mix.providers.forEach((p, i) => {
      if (cm.fit[i] === -Infinity) return;
      const x = old[p.key];
      out[p.key] = Math.round((x === undefined ? cm.paidTarget[i] : x + (cm.paidTarget[i] - x) * kPaid) * 1e7) / 1e7;
    });
    fx.paid[r] = out;
  }
}

/** Share of provider key `key` in a sector mix (0 if absent). */
export function shareOf(mix: WorldMix, r: RegionId, sid: SectorId, key: string): number {
  const i = mix.providers.findIndex((p) => p.key === key);
  return i < 0 ? 0 : mix.sec[r][sid].share[i];
}
