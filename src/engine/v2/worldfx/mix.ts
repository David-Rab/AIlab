// World model mix: which deployed models each sector in each region uses, and at what effective level
// (V2-SPEC §3.11.1; research/16 §1A.2 step 1, §0 principle 2). Owner: WS5.
//
// Providers: the player's paid external deployments (best one per sector), the player's open-weights release,
// each active rival's public model, and DeepCent's public model. Market share per region and sector:
//   share_X ∝ exp(2.1·(Le_X,s − Le_best,s)) · price_X^−1.5 · access_X,r · brand_X       (§3.11.1 [D])
// Consumer share uses the consumer level (mean of SOCIAL, REASON, MEDIA) and the version's appeal.
// Effective levels: Le_d = min(L_d, L_AGENCY + 2) for cognitive domains; PHYS = min(max(L_PHYS, W16 floor), 15·RobotAvail).
import { SECTORS, REGIONS } from '../../../data/v2/sectors';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { memo } from '../core/memo';
import { CHINA_ID } from '../models/labs';
import type { Deployment, DomainId, GameStateV2, LabId, ModelVersion, RegionId, SectorId, SystemCtx } from '../types';
import { robotAvail } from './robots';
import { techRamp } from './policy';
import { productAppeal, productBonusSectors, productDomains } from '../models/products';

export const SHARE_SLOPE = 2.1; // §3.11.1 [D]
export const PRICE_ELASTICITY = 1.5; // §3.11.1 [D]
/** Sector product: +0.5 L in that sector once certified (research/16 §1A.3). */
export const PRODUCT_BONUS = 0.5;

/** Channels that sell into sectors (gov only into GOV/MIL). Consumer is its own market; internal earns nothing. */
export const SECTOR_CHANNELS: Deployment['channel'][] = ['api', 'agents', 'enterprise', 'trusted', 'gov'];

const ND = DOMAIN_IDS.length;
const I = Object.fromEntries(DOMAIN_IDS.map((d, i) => [d, i])) as Record<DomainId, number>;
const PHYS = I.PHYS;
const AGENCY = I.AGENCY;
const COG_IDX = DOMAIN_IDS.map((_, i) => i).filter((i) => i !== PHYS);

/** Precomputed sector task vectors: cognitive (domain index, weight) pairs and the PHYS weight. */
export const SECTOR_TASKS = SECTORS.map((def) => {
  const idx: number[] = [];
  const w: number[] = [];
  for (const [d, x] of Object.entries(def.tasks) as [DomainId, number][]) {
    if (d === 'PHYS') continue;
    idx.push(I[d]);
    w.push(x);
  }
  return { id: def.id, idx, w, physW: def.tasks.PHYS ?? 0, gov: def.id === 'GOV' || def.id === 'MIL' };
});
export const SECTOR_INDEX = Object.fromEntries(SECTORS.map((d, i) => [d.id, i])) as Record<SectorId, number>;

export interface Provider {
  key: string; // 'player' | 'player:open' | rival id | 'china'
  lab: LabId;
  paid: boolean; // earns player revenue
  open: boolean;
  /** Model domain levels (non-player providers, and the player's open release). */
  dom?: Record<DomainId, number>;
  brand: number;
  appeal: number;
}

export interface SectorMix {
  /** Share by provider index. */
  share: number[];
  /** Provider sector levels (Le_X,s), by provider index; −Infinity = not serving. */
  level: number[];
  best: number;
  /** Share-weighted effective domain levels (the world model m*). */
  dom: Record<DomainId, number>;
  /** Share-weighted price index. */
  price: number;
  /** For the player: the deployment that serves this sector (best level), its price. */
  playerDep?: string;
  playerPrice: number;
  /** Share lost to price (1 = none) vs to quality, for the binding-cause readout. */
  priceFactor: number;
}

export interface ConsumerMix { share: number[]; level: number[]; socials: number[]; best: number; social: number; playerDep?: string; playerPrice: number; priceFactor: number }

export interface WorldMix {
  providers: Provider[];
  sec: Record<RegionId, Record<SectorId, SectorMix>>;
  consumer: Record<RegionId, ConsumerMix>;
  /** Best public general level and domain levels (max over providers' raw model levels). */
  bestPublic: Record<DomainId, number>;
  bestPublicLg: number;
}

/** Domain adjustment of a deployment: effort, safeguards, control layer [D]. */
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

/** Effective level Le of a sector for a model with domain levels `dom` (research/16 §1A.2 step 1). */
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

function computeMix(s: GameStateV2): WorldMix {
  const providers: Provider[] = [];
  const paid = paidDeployments(s);
  const ver = new Map<string, ModelVersion>();
  for (const v of s.player.models.versions) ver.set(v.id, v);
  if (paid.length) providers.push({ key: 'player', lab: 'player', paid: true, open: false, brand: playerBrand(s), appeal: 1 });
  const open = s.player.deployments.filter((d) => d.channel === 'open' && d.status !== 'withdrawn');
  if (open.length) {
    let best: ModelVersion | undefined;
    for (const d of open) {
      const v = ver.get(d.versionId);
      if (v && (!best || v.Lg > best.Lg)) best = v;
    }
    if (best) providers.push({ key: 'player:open', lab: 'player', paid: false, open: true, dom: best.domains, brand: 1, appeal: 1 });
  }
  for (const r of s.rivals) {
    const m = r.publicModel;
    if (!m || (r.core.status !== 'active' && !m.openWeights)) continue;
    providers.push({ key: r.core.id, lab: r.core.id, paid: false, open: m.openWeights, dom: m.domains, brand: r.core.status === 'active' ? 1 : 0.5, appeal: 1 });
  }
  const cn = s.china.lab.publicModel;
  if (cn && (s.china.lab.core.status === 'active' || cn.openWeights)) providers.push({ key: CHINA_ID, lab: CHINA_ID, paid: false, open: cn.openWeights, dom: cn.domains, brand: 1, appeal: 1 });

  const pfFloor = 10 * techRamp(s, 'W16');
  const pfLog = 3 * techRamp(s, 'W19');
  const pen = s.world.fx.capPenalty;
  const n = providers.length;
  const playerIdx = providers.findIndex((p) => p.key === 'player');
  const acc = REGIONS.map((r) => providers.map((p) => access(p, r)));
  const brandPow = providers.map((p, i) => p.brand * (i === playerIdx ? 1 - pen.sector : 1));

  // Capped domain vectors: non-player providers, and player candidate deployments.
  const pvec: (number[] | undefined)[] = providers.map((p) => (p.dom ? capVec(p.dom) : undefined));
  // R6: a product's domains include its mini free tier and features (productDomains = the model's own without them).
  const cands: { dep: Deployment; dom: Record<DomainId, number>; v: number[]; ch: Deployment['channel']; focus: Set<SectorId>; bonus: Set<SectorId>; price: number; appeal: number }[] = [];
  for (const d of paid) {
    const mv = ver.get(d.versionId);
    if (!mv) continue;
    const dom = productDomains(s, d, mv)!;
    cands.push({ dep: d, dom, v: capVec(dom, depOffset(d)), ch: d.channel, focus: new Set(d.sectorFocus), bonus: new Set(productBonusSectors(s, d)), price: d.priceIndex, appeal: productAppeal(s, d) });
  }
  const fxCert = s.world.fx.certDay;
  const certified = (sec: SectorId) => {
    const c = fxCert[sec];
    return c !== undefined && c <= s.time.day;
  };

  const bestPublic = domRecord(new Float64Array(ND));
  let bestPublicLg = 0;
  for (const c of cands) {
    const mv = ver.get(c.dep.versionId)!;
    for (const k of DOMAIN_IDS) bestPublic[k] = Math.max(bestPublic[k], c.dom[k] + depOffset(c.dep));
    bestPublicLg = Math.max(bestPublicLg, mv.Lg);
  }
  for (const p of providers) {
    if (!p.dom) continue;
    for (const k of DOMAIN_IDS) bestPublic[k] = Math.max(bestPublic[k], p.dom[k]);
  }
  for (const r of [...s.rivals, s.china.lab]) if (r.publicModel) bestPublicLg = Math.max(bestPublicLg, r.publicModel.Lg);

  // Per sector (region-independent): cognitive level of each provider and the player's best candidate.
  const S = SECTOR_TASKS.length;
  const cogL: number[][] = []; // [sector][provider]
  const pCand: number[] = []; // player candidate index per sector
  const pBonus: number[] = [];
  for (let si = 0; si < S; si++) {
    const t = SECTOR_TASKS[si];
    const row = new Array<number>(n).fill(-Infinity);
    for (let i = 0; i < n; i++) {
      const v = pvec[i];
      if (!v) continue;
      let L = 0;
      for (let k = 0; k < t.idx.length; k++) L += t.w[k] * v[t.idx[k]];
      row[i] = L;
    }
    let bc = -1;
    let bL = -Infinity;
    let bonus = 0;
    if (playerIdx >= 0) {
      for (let c = 0; c < cands.length; c++) {
        const cd = cands[c];
        if (cd.ch === 'consumer' || (cd.ch === 'gov' && !t.gov)) continue;
        let L = 0;
        for (let k = 0; k < t.idx.length; k++) L += t.w[k] * cd.v[t.idx[k]];
        const b = (cd.focus.has(t.id) && certified(t.id)) || cd.bonus.has(t.id) ? PRODUCT_BONUS : 0;
        // PHYS part is region-specific; compare on the cognitive part plus the provider's raw PHYS potential.
        const Lc = L + b + t.physW * cd.v[PHYS];
        if (Lc > bL) {
          bL = Lc;
          bc = c;
          bonus = b;
        }
      }
    }
    cogL.push(row);
    pCand.push(bc);
    pBonus.push(bonus);
  }

  const sec = {} as Record<RegionId, Record<SectorId, SectorMix>>;
  const level = new Array<number>(n);
  const price = new Array<number>(n);
  const physLe = new Array<number>(n);
  REGIONS.forEach((r, ri) => {
    const rowOut = {} as Record<SectorId, SectorMix>;
    for (let si = 0; si < S; si++) {
      const t = SECTOR_TASKS[si];
      const physCap = t.physW > 0 ? 15 * robotAvail(s, r, t.id) : 15;
      let playerDep: string | undefined;
      for (let i = 0; i < n; i++) {
        price[i] = 1;
        level[i] = cogL[si][i];
        const v = pvec[i];
        physLe[i] = v ? Math.min(Math.max(v[PHYS], pfFloor) + (t.id === 'LOG' ? pfLog : 0), physCap) : 0;
        if (v) level[i] += t.physW * physLe[i];
      }
      if (playerIdx >= 0) {
        const c = pCand[si];
        if (c >= 0) {
          const cd = cands[c];
          let L = pBonus[si];
          for (let k = 0; k < t.idx.length; k++) L += t.w[k] * cd.v[t.idx[k]];
          physLe[playerIdx] = Math.min(Math.max(cd.v[PHYS], pfFloor) + (t.id === 'LOG' ? pfLog : 0), physCap);
          level[playerIdx] = L + t.physW * physLe[playerIdx];
          price[playerIdx] = cd.price;
          playerDep = cd.dep.id;
        } else level[playerIdx] = -Infinity;
      }
      let best = -Infinity;
      for (let i = 0; i < n; i++) if (acc[ri][i] > 0 && level[i] > best) best = level[i];
      const share = new Array<number>(n).fill(0);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        if (level[i] === -Infinity) continue;
        const w = Math.exp(SHARE_SLOPE * (level[i] - best)) * Math.pow(price[i], -PRICE_ELASTICITY) * acc[ri][i] * brandPow[i];
        share[i] = w;
        sum += w;
      }
      const dv = new Float64Array(ND);
      let px = 0;
      if (sum > 0) {
        for (let i = 0; i < n; i++) {
          share[i] /= sum;
          const x = share[i];
          if (!x) continue;
          const v = i === playerIdx ? cands[pCand[si]].v : pvec[i]!;
          const b = i === playerIdx ? pBonus[si] : 0;
          for (let k = 0; k < ND; k++) dv[k] += x * (k === PHYS ? physLe[i] : v[k] + b);
          px += x * price[i];
        }
      }
      const dom = domRecord(dv);
      rowOut[t.id] = {
        share, level: level.slice(), best: best === -Infinity ? 0 : best, dom, price: sum > 0 ? px : 1, playerDep,
        playerPrice: playerIdx >= 0 ? price[playerIdx] : 1, priceFactor: playerIdx >= 0 ? Math.pow(price[playerIdx], -PRICE_ELASTICITY) : 1,
      };
    }
    sec[r] = rowOut;
  });

  // Consumer market.
  const consumerCands = cands.filter((c) => c.ch === 'consumer');
  const cLevel = new Array<number>(n).fill(-Infinity);
  const cSocial = new Array<number>(n).fill(0);
  const cApp = providers.map((p) => p.appeal);
  const cPrice = new Array<number>(n).fill(1);
  let cDep: string | undefined;
  for (let i = 0; i < n; i++) {
    const v = pvec[i];
    if (!v) continue;
    cLevel[i] = (v[I.SOCIAL] + v[I.REASON] + v[I.MEDIA]) / 3;
    cSocial[i] = v[I.SOCIAL];
  }
  if (playerIdx >= 0) {
    for (const c of consumerCands) {
      const L = (c.v[I.SOCIAL] + c.v[I.REASON] + c.v[I.MEDIA]) / 3;
      if (L > cLevel[playerIdx]) {
        cLevel[playerIdx] = L;
        cDep = c.dep.id;
        cPrice[playerIdx] = c.price;
        cApp[playerIdx] = appealOf(ver.get(c.dep.versionId)) * c.appeal;
        cSocial[playerIdx] = c.v[I.SOCIAL];
      }
    }
  }
  const consumer = {} as Record<RegionId, ConsumerMix>;
  REGIONS.forEach((r, ri) => {
    let best = -Infinity;
    for (let i = 0; i < n; i++) if (cLevel[i] > best && acc[ri][i] > 0) best = cLevel[i];
    const share = new Array<number>(n).fill(0);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (cLevel[i] === -Infinity) continue;
      let w = Math.exp(SHARE_SLOPE * (cLevel[i] - best)) * cApp[i] * Math.pow(cPrice[i], -PRICE_ELASTICITY) * acc[ri][i] * providers[i].brand;
      if (i === playerIdx) w *= 1 - pen.consumer;
      share[i] = w;
      sum += w;
    }
    let soc = 0;
    if (sum > 0) for (let i = 0; i < n; i++) {
      share[i] /= sum;
      soc += share[i] * cSocial[i];
    }
    consumer[r] = {
      share, level: cLevel, socials: cSocial, best: best === -Infinity ? 0 : best, social: soc, playerDep: cDep,
      playerPrice: playerIdx >= 0 ? cPrice[playerIdx] : 1, priceFactor: playerIdx >= 0 ? Math.pow(cPrice[playerIdx], -PRICE_ELASTICITY) : 1,
    };
  });
  return { providers, sec, consumer, bestPublic, bestPublicLg };
}

/** Share of provider key `key` in a sector mix (0 if absent). */
export function shareOf(mix: WorldMix, r: RegionId, sid: SectorId, key: string): number {
  const i = mix.providers.findIndex((p) => p.key === key);
  return i < 0 ? 0 : mix.sec[r][sid].share[i];
}
