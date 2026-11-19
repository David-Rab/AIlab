// Serving economics and sector work on work types (model v3 V4: design/MODEL-V3.md §6, §7.2–7.4; design/V3-BUILD.md
// "V4" and "V4 notes"). Owner: WS5. Data: src/data/v2/serving.ts.
//
//   cost per work-hour  c = H100e-hours per work-hour × $ per H100e-hour (market rental: the opportunity cost of a chip)
//   H100e-h per w-hour  = FLOP per token (2·N_active of the served version) × (input ÷ U_prefill + output ÷ U_decode)
//                         ÷ peak FLOP/s ÷ 3600, tokens per work-hour by work type × effort × scaffolds
//   capacity            = serving H100e × 8766 h ÷ (H100e-hours per work-hour)   (work-hours per year)
//   price               = min(markup × c, value) per hour of AI use (never below c); an hour of use saves (α_use + (1 − α_use)·g_aug) hours of
//                         the sector's work (substituted vs augmented), so value = wage × that; rivals price at their own
//                         cost × RIVAL_MARKUP, China × CHINA_MARKUP
//   sector coverage     a = σ((fit − θ_s)/s) × p(H_s | h50): the work-type function of V3 (departments/workfit.ts) with
//                         the sector's median professional as reference (θ_s, SECTOR_REF), fit = Σ ω_d G_d + ΔG(effort,
//                         safeguards, scaffolds), h50 × horizon extenders
// Rivals and China have no N_active: their FLOP per token comes from their G through the reference design at the
// player's recipe (BRIDGE(V7)). Nothing here reads serveCost, the research-speed multiplier M or the level bridge for
// prices, costs or coverage.
import {
  CHAT_WORK, CHINA_MARKUP, CONSUMER_MKT, CONTROL_LAYER_DG, EFFORT_CAP_OOM, EFFORT_OOM_PER_10X, EFFORT_TOKENS, MARKUP, RIVAL_MARKUP,
  SAFEGUARD_DG, SECTOR_REF, SECTOR_WORK, TOKENS, type TokenProfile,
} from '../../../data/v2/serving';
import { FEATURE_BY_ID, FREE_TIER_SHARE, type FeatureFx, type FeatureId, type WorkScope } from '../../../data/v2/features';
import { ECON, REGION_SCALE, SECTORS } from '../../../data/v2/sectors';
import { REFERENCE_BASE, PARAM_RANGE, SHAPE } from '../../../data/v2/runDesign';
import { V0_DAY } from '../../../data/v2/calibration';
import { ASSIST, COVER, PEAK_FLOPS, U_DECODE, U_PREFILL, type WorkTypeId } from '../../../data/v2/workTypes';
import { dollarsPerH100eHour, domainG, flopPerToken, pSuccess } from '../departments/workfit';
import { gV0, h50Of, levelKnotsG, playerStart } from '../models/capability';
import { B_G_PER_Y } from '../../../data/v2/runDesign';
import { versionById } from '../models/labs';
import { activeFeatures } from '../models/products';
import { alphaUseOf, savedAt } from './use';
import type { Deployment, DomainId, GameStateV2, ModelVersion, RegionId, SectorId, SimpleModel, TimelineWorld } from '../types';

const sig = (x: number) => 1 / (1 + Math.exp(-x));
type Fitted = Pick<ModelVersion, 'pm' | 'build'>;

// ───────────────────────────── the cost chain ─────────────────────────────

/** H100e-hours of serving per human work-hour at FLOP per token `fpt` and a token profile (FLOP-bearing tokens). */
export const h100eHoursPer = (fpt: number, tok: TokenProfile) => (fpt * (tok.input / U_PREFILL + tok.output / U_DECODE)) / PEAK_FLOPS / 3600;
/** $ per H100e-hour of serving (the market rental: what the chip-hour would fetch). */
export const serveDollarsPerHour = (s: GameStateV2) => dollarsPerH100eHour(s);

/** Effort's reasoning-token multiplier and its compute-equivalent fit gain (R20 C3: +0.4 OOM per ×10, capped). */
export const effortTokens = (e: Deployment['effort']) => EFFORT_TOKENS[e] ?? 1;
export const effortDG = (mult: number) => Math.max(-EFFORT_CAP_OOM, Math.min(EFFORT_CAP_OOM, EFFORT_OOM_PER_10X * Math.log10(Math.max(1e-6, mult))));

// ───────────────────────────── sector work types ─────────────────────────────

/** A sector's cognitive task weights (research/16, PHYS removed and the rest renormalised) and its PHYS share. */
export const SECTOR_COG: Record<SectorId, { w: [DomainId, number][]; physW: number }> = Object.fromEntries(SECTORS.map((def) => {
  const e = (Object.entries(def.tasks) as [DomainId, number][]).filter(([d]) => d !== 'PHYS');
  const sum = e.reduce((a, [, x]) => a + x, 0) || 1;
  return [def.id, { w: e.map(([d, x]) => [d, x / sum] as [DomainId, number]), physW: def.tasks.PHYS ?? 0 }];
})) as Record<SectorId, { w: [DomainId, number][]; physW: number }>;
const CHAT_W = Object.entries(CHAT_WORK.w) as [DomainId, number][];
const SECTOR_DEF = Object.fromEntries(SECTORS.map((d) => [d.id, d])) as Record<SectorId, (typeof SECTORS)[number]>;

const thetaMemo = new WeakMap<TimelineWorld['v3'], Record<string, number>>();
/** Coverage threshold θ (OOM) of a sector's work (or consumer chat, 'CHAT') in world w: the sector's median professional
 *  on the V0 → superhuman-coder axis plus the verifiability term of the shared coverage function. */
export function sectorTheta(w: TimelineWorld, sid: SectorId | 'CHAT'): number {
  let m = thetaMemo.get(w.v3);
  if (!m) thetaMemo.set(w.v3, (m = {}));
  const hit = m[sid];
  if (hit !== undefined) return hit;
  const g0 = gV0(w);
  const th = sid === 'CHAT' ? CHAT_WORK.theta : SECTOR_DEF[sid].theta;
  const v = sid === 'CHAT' ? CHAT_WORK.v : SECTOR_WORK[sid].v;
  return (m[sid] = g0 + (SECTOR_REF.mid + SECTOR_REF.perTheta * th) * (w.v3.gSC - g0) + COVER.kappaV * (0.9 - v));
}

/** Fit (OOM) of a model on a sector's cognitive work or consumer chat: Σ ω_d G_d. */
export function sectorFit(s: GameStateV2, v: Fitted, sid: SectorId | 'CHAT'): number {
  const w = sid === 'CHAT' ? CHAT_W : SECTOR_COG[sid].w;
  let f = 0;
  for (const [d, x] of w) f += x * domainG(s, v, d);
  return f;
}
const taskHours = (sid: SectorId | 'CHAT') => (sid === 'CHAT' ? CHAT_WORK.H : SECTOR_WORK[sid].H);
const horizonDomain = (sid: SectorId | 'CHAT') => (sid === 'CHAT' ? CHAT_WORK.horizon : SECTOR_WORK[sid].horizon);
/** Coverage of a sector's cognitive work (the share AI can do on its own) at fit `fit` and horizon h50 (minutes). */
export const sectorCover = (w: TimelineWorld, sid: SectorId | 'CHAT', fit: number, h50: number) =>
  sig((fit - sectorTheta(w, sid)) / COVER.s) * pSuccess(taskHours(sid), h50);

/** Pre-LLM (late 2022) coverage per sector: a model 2 display levels under V0 (0.4 of the V0 → SC span), the hiring
 *  baseline ΔF of research/16 step 8. */
const preMemo = new WeakMap<TimelineWorld['v3'], Record<SectorId, number>>();
export function preLlmCover(w: TimelineWorld): Record<SectorId, number> {
  let m = preMemo.get(w.v3);
  if (m) return m;
  const g0 = gV0(w);
  const g = g0 - 0.4 * (w.v3.gSC - g0);
  const h50 = 203 * Math.pow(4.2, g - g0);
  m = Object.fromEntries(SECTORS.map((d) => [d.id, (1 - SECTOR_COG[d.id].physW) * sectorCover(w, d.id, g, h50)])) as Record<SectorId, number>;
  preMemo.set(w.v3, m);
  return m;
}

// ───────────────────────────── rivals' FLOP per token (BRIDGE(V7)) ─────────────────────────────

/** The frontier's non-compute effective-compute growth (OOM/yr: recipe and RL, research/12 §0.2: G +1.3/yr of which
 *  compute ≈ 0.76) that the rivals' bridge takes out of their G before sizing their models (BRIDGE(V7)) [R12, D]. */
export const RIVAL_ALGO_OOM_PER_YEAR = 0.55;
/** FLOP per token of a model known only by its G (rivals, China): the reference design (B0: 1T active MoE at V0's G)
 *  scaled to the model's training compute — its G less the frontier's algorithmic progress since V0, and N_active ∝
 *  √FLOP at fixed tokens per parameter — then 2·N × the reference shape's token multiplier. BRIDGE(V7): rivals get their
 *  own designs in V7. */
export function fptOfG(s: GameStateV2, G: number, day: number): number {
  const dAlgo = RIVAL_ALGO_OOM_PER_YEAR * Math.max(0, (day - V0_DAY) / 365);
  const N = Math.min(PARAM_RANGE[1], Math.max(PARAM_RANGE[0], REFERENCE_BASE.params * Math.pow(10, (G - gV0(s.hidden.timeline) - dAlgo) / 2)));
  return 2 * N * SHAPE[REFERENCE_BASE.shape].tokenMult;
}
/** A rival's or China's model as the market sees it (BRIDGE(V7)): its G read through pm (gOfPm), capped at the display
 *  scale's top (λ = 15, the reference superintelligence point) — the simple labs' v2 progress runs to hundreds of OOM in
 *  a takeoff, which the capped display level hid. */
export function marketModel(s: GameStateV2, m: SimpleModel): SimpleModel {
  const w = s.hidden.timeline;
  const k = levelKnotsG(w);
  const pmCap = playerStart(w).target + (k[k.length - 1] - gV0(w)) / B_G_PER_Y;
  return m.pm > pmCap ? { ...m, pm: pmCap } : m;
}
/** FLOP per token of a rival's or China's public model (BRIDGE(V7)). */
export const fptOfSimple = (s: GameStateV2, m: SimpleModel) => fptOfG(s, domainG(s, m, 'CODE'), m.day);

// ───────────────────────────── typed feature effects (V4.3) ─────────────────────────────

const inScope = (w: WorkScope, wt: SectorId | WorkTypeId | 'CHAT') => w === 'all' || w.includes(wt);
/** Aggregated typed effects of a set of features on one work type: ΔG (scaffolds), × h50 (horizon extenders), × tokens
 *  (scaffolds). */
export interface WorkFx { dG: number; hMult: number; tok: number }
export function fxOn(fx: FeatureFx[], wt: SectorId | WorkTypeId | 'CHAT'): WorkFx {
  let dG = 0;
  let hMult = 1;
  let tok = 1;
  for (const f of fx) {
    if (f.kind === 'scaffold' && inScope(f.work, wt)) {
      dG += f.dG;
      tok *= f.tokens;
    } else if (f.kind === 'horizon' && inScope(f.work, wt)) hMult *= f.mult;
  }
  return { dG, hMult, tok };
}
/** Typed effects of the features a product has switched on. */
export const productFx = (s: GameStateV2, d: Deployment): FeatureFx[] => activeFeatures(s, d).flatMap((f) => f.fx);
/** Typed effects the lab's built features give its internal agents on an internal work type (V4.3: "effects apply to
 *  both products and internal packages"): scaffolds and horizon extenders that list the work type (or all work). */
export function internalFx(s: GameStateV2, wt: WorkTypeId): WorkFx {
  const fx: FeatureFx[] = [];
  for (const id of s.player.features) {
    const f = FEATURE_BY_ID[id as FeatureId];
    if (f) fx.push(...f.fx);
  }
  return fxOn(fx, wt);
}
/** Segment a product's enablers open (share of the market's AI work only products with it can reach): per sector and for
 *  consumer chat. */
export function enablerShare(fx: FeatureFx[], sid: SectorId | 'CHAT'): number {
  let x = 0;
  for (const f of fx) if (f.kind === 'enabler' && (sid === 'CHAT' ? f.consumer : f.sectors?.includes(sid))) x += f.share;
  return x;
}

// ───────────────────────────── offers: a model's fit, coverage, cost and price on a work type ─────────────────────────────

/** One model a provider serves a segment with, and its usage share (a product's free tier blends in its mini). */
export interface ModelUse { v: Fitted; fpt: number; w: number }
/** What a provider offers on one sector's work: fit (OOM, usage-weighted), coverage, H100e-hours and cost per work-hour
 *  ($), price per work-hour before the value cap ($). */
export interface Offer { fit: number; a: number; hph: number; cost: number; price: number }
export interface OfferOpts { dG?: number; hMult?: number; tok?: number; effort?: number; markup: number; rate: number }

/** The offer of a set of model uses on one sector's work (or consumer chat: fit and coverage; cost per work-hour of chat
 *  is not used). */
export function offerOf(s: GameStateV2, uses: ModelUse[], sid: SectorId | 'CHAT', o: OfferOpts): Offer {
  const w = s.hidden.timeline;
  const eff = o.effort ?? 1;
  const dG = (o.dG ?? 0) + effortDG(eff);
  const hm = o.hMult ?? 1;
  const tk = o.tok ?? 1;
  const base = sid === 'CHAT' ? { input: 3e3, output: 8e2 } : useTokens(s, sid);
  const tok = { input: base.input * tk, output: base.output * tk * eff };
  const hd = horizonDomain(sid);
  let fit = 0;
  let a = 0;
  let hph = 0;
  for (const u of uses) {
    const f = sectorFit(s, u.v, sid) + dG;
    fit += u.w * f;
    a += u.w * sectorCover(w, sid, f, h50Of(w, u.v, hd) * hm);
    hph += u.w * h100eHoursPer(u.fpt, tok);
  }
  const cost = hph * o.rate;
  return { fit, a, hph, cost, price: o.markup * cost };
}

/** Human wage per hour of a sector's work in a region ($). */
export const wagePerHour = (sid: SectorId, r: RegionId) => SECTOR_DEF[sid].wage * REGION_SCALE[r].wage * ECON.W0;
/** Hours of the sector's work an hour of AI use saves: substituted tasks a whole hour, augmented ones g_aug (research/16
 *  step 6), at the substituted share of an hour of use α_use = α·A/U (A2a: workers' assisted hours substitute nothing;
 *  ≈0.34 at the start, measured 0.35, research/22 §1e; rises with agency as α and A/U grow). Tokens are spent over every
 *  hour of use (an assistant runs the whole time the human works). */
export const savedPerUseHour = (s: GameStateV2, r: RegionId, sid: SectorId) => savedAt(alphaUseOf(s.world.sectors[r][sid], sid));
/** FLOP-bearing tokens per hour of AI use in a sector: α_use·autonomous + (1 − α_use)·assisted (α_use the US substituted
 *  share of an hour of use). */
export function useTokens(s: GameStateV2, sid: SectorId): TokenProfile {
  const st = s.world.sectors.US[sid];
  const a = st ? alphaUseOf(st, sid) : 0.25;
  const x = SECTOR_WORK[sid].tokens;
  const y = TOKENS.autonomous;
  return { input: a * y.input + (1 - a) * x.input, output: a * y.output + (1 - a) * x.output };
}
/** Value of an hour of AI use in a sector and region ($): the wage of the work it saves. */
export const valuePerHour = (s: GameStateV2, sid: SectorId, r: RegionId) => wagePerHour(sid, r) * savedPerUseHour(s, r, sid);

/** Buyer's cost of an AI work-hour ($): the price plus the human review the AI's output still needs on the work it cannot
 *  do alone (GDPval review ≈ 0.27 of the human time, R20 E2) [D]. */
export const buyerCost = (price: number, a: number, wageH: number) => price + ASSIST.review * wageH * (1 - Math.min(1, a));
/** Cost gate of one offer (research/16 step 3 on the physical cost): σ(ln(wage ÷ buyer cost) / kSpread). */
export const costGateOf = (price: number, a: number, wageH: number) => sig(Math.log(wageH / Math.max(1e-9, buyerCost(price, a, wageH))) / ECON.kSpread);

// ───────────────────────────── the player's products ─────────────────────────────

/** Markup of a product's price tier (price = markup × its cost per work-hour). */
export const markupOf = (d: Deployment) => MARKUP[d.price] ?? MARKUP.standard;
export { RIVAL_MARKUP, CHINA_MARKUP };

/** The models a product serves with: its version, and its mini for the free tier (FREE_TIER_SHARE of usage). */
export function productUses(s: GameStateV2, d: Deployment): ModelUse[] {
  const v = versionById(s, d.versionId);
  if (!v) return [];
  const f = d.miniVersionId ? FREE_TIER_SHARE[d.channel] ?? 0 : 0;
  const mini = f > 0 ? versionById(s, d.miniVersionId) : undefined;
  if (!mini) return [{ v, fpt: flopPerToken(s, v), w: 1 }];
  return [{ v, fpt: flopPerToken(s, v), w: 1 - f }, { v: mini, fpt: flopPerToken(s, mini), w: f }];
}
/** ΔG of a product's settings (safeguards, control layer). */
export const settingsDG = (d: Deployment) => (SAFEGUARD_DG[d.safeguards] ?? 0) + (d.controlLayer ? CONTROL_LAYER_DG : 0);

/** A product's offer on a sector (certified sector packs add SECTOR_PACK_DG where the product focuses). */
export const SECTOR_PACK_DG = 0.5 / 1.2;
export function productOffer(s: GameStateV2, d: Deployment, sid: SectorId, certified = false, uses = productUses(s, d), fx = productFx(s, d)): Offer {
  const x = fxOn(fx, sid);
  const pack = certified && d.sectorFocus.includes(sid) ? SECTOR_PACK_DG : 0;
  return offerOf(s, uses, sid, { dG: settingsDG(d) + x.dG + pack, hMult: x.hMult, tok: x.tok, effort: effortTokens(d.effort), markup: markupOf(d), rate: serveDollarsPerHour(s) });
}

// ───────────────────────────── consumer chat ─────────────────────────────

/** H100e-hours per user-day of consumer chat on a model (paying users' or free users' usage). */
export const chatHoursPerDay = (fpt: number, tok: TokenProfile, effort = 1) => h100eHoursPer(fpt, { input: tok.input, output: tok.output * effort });
/** Consumer subscription price per month ($): markup × a paying user's serving cost on the product's model (paid usage
 *  runs on the main model), never above the willingness to pay (A2b: CONSUMER_MKT.wtpMonth) unless serving alone costs
 *  more, never below cost. */
export function subPrice(s: GameStateV2, fpt: number, markup: number, effort = 1): { cost: number; price: number } {
  const cost = chatHoursPerDay(fpt, CONSUMER_MKT.perDay.paid, effort) * serveDollarsPerHour(s) * 30.4;
  return { cost, price: Math.max(cost, Math.min(CONSUMER_MKT.wtpMonth, markup * cost)) };
}
/** Target paid share of a provider's weekly users (A2b): (p0 + p1 · coverage of consumer chat) × (going price ÷ its
 *  price)^ε, capped; the going price is the users' share-weighted subscription price in the region among plans sold at
 *  or below the willingness to pay (default: the willingness to pay). A plan that must cost more than the willingness
 *  to pay (serving a subscriber alone costs more) finds no subscribers — the consumer analogue of the sector cost gate. */
export function paidShareTarget(cover: number, price: number, going: number = CONSUMER_MKT.wtpMonth): number {
  const P = CONSUMER_MKT.paid;
  if (!(price > 0) || price > CONSUMER_MKT.wtpMonth * (1 + 1e-9)) return 0;
  const q = P.p0 + P.p1 * Math.max(0, Math.min(1, cover));
  return Math.min(P.max, q * Math.pow((going > 0 ? going : price) / price, P.elasticity));
}
/** Target weekly reach of AI chat in a region (share of online adults, A2b) at the best accessible model's coverage of
 *  consumer chat. */
export function reachTarget(r: RegionId, bestCover: number): number {
  const R = CONSUMER_MKT.reach;
  return (r === 'US' ? 1 : R.row) * R.max * (R.base + (1 - R.base) * Math.max(0, Math.min(1, bestCover)));
}
