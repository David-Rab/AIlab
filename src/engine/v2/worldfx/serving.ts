// Serving economics and sector work on work types (model v3 V4: design/MODEL-V3.md §6, §7.2–7.4; design/V3-BUILD.md
// "V4" and "V4 notes"). Owner: WS5. Data: src/data/v2/serving.ts.
//
//   cost per work-hour  c = H100e-hours per work-hour × $ per H100e-hour (market rental: the opportunity cost of a chip)
//   H100e-h per w-hour  = FLOP per token (2·N_active of the served version) × (input ÷ U_prefill + output ÷ U_decode)
//                         ÷ peak FLOP/s ÷ 3600, tokens per work-hour by work type × effort × scaffolds
//   capacity            = serving H100e × 8766 h ÷ (H100e-hours per work-hour)   (work-hours per year)
//   price               = min(markup × c, value) per adopted task-hour (never below c); an adopted hour saves (α + (1 − α)·g_aug)
//                         hours of the sector's work (substituted vs augmented), so value = wage × that; rivals price at
//                         their own cost × RIVAL_MARKUP, China × CHINA_MARKUP
//   A2c agent work      k = a·λ agent-hours per supervising hour, λ = 1/(c/h80 + ρ(1 − a) + m), × the buyer's gate; price per
//                         agent-hour = min(markup × cost on the autonomous profile, wage); seat price = list × markup ÷
//                         standard, ≥ the seat's serving cost (data/v2/serving.ts SEATS, AGENT_WORK)
//   sector coverage     a = σ((fit − θ_s)/s) × p(H_s | h50): the work-type function of V3 (departments/workfit.ts) with
//                         the sector's median professional as reference (θ_s, SECTOR_REF), fit = Σ ω_d G_d + ΔG(effort,
//                         safeguards, scaffolds), h50 × horizon extenders
// Rivals and China serve their own designs (model v3 F1, actors/rivalModel.ts): FLOP per token 2·N_active of their base,
// fit their G. Nothing here reads a relative serve cost, the research-speed multiplier M or the level bridge for prices, costs or
// coverage.
import {
  AGENT_WORK, CHAT_WORK, CHINA_MARKUP, CONSUMER_MKT, CONTROL_LAYER_DG, consumerPlanPrice, EFFORT_CAP_OOM, EFFORT_OOM_PER_10X, EFFORT_TOKENS, FREE_TIER, LINEUP, MARKUP, RIVAL_MARKUP,
  SAFEGUARD_DG, SEATS, SECTOR_REF, SECTOR_WORK, TOKENS, type TokenProfile,
} from '../../../data/v2/serving';
import { CHANNEL_PRICE, FEATURE_BY_ID, MINI_CHANNELS, type FeatureFx, type FeatureId, type WorkScope } from '../../../data/v2/features';
import { ECON, REGION_SCALE, SECTORS } from '../../../data/v2/sectors';
import { DISTILL, REFERENCE_BASE, PARAM_RANGE } from '../../../data/v2/runDesign';
import { ASSIST, COVER, H50_PER_OOM, H80_OVER_H50, PEAK_FLOPS, TOK_MIN, TOK_PER_RL_OOM, U_DECODE, U_PREFILL, type WorkTypeId } from '../../../data/v2/workTypes';
import { dollarsPerH100eHour, domainG, flopPerToken, pSuccess, workFit } from '../departments/workfit';
import { gV0, h50Of } from '../models/capability';
import { fptOfSimpleModel } from '../actors/rivalModel';
import { versionById } from '../models/labs';
import { activeFeatures, packCertified } from '../models/products';
import { adopted } from '../models/paradigms';
import { decodeUtilNow, rlGOfBuild } from '../models/stacks';
import { savedAt, seatHoursPerMonth } from './use';
import type { Deployment, DomainId, GameStateV2, ModelVersion, RegionId, SectorId, SimpleModel, TimelineWorld } from '../types';

const sig = (x: number) => 1 / (1 + Math.exp(-x));
type Fitted = Pick<ModelVersion, 'G' | 'build'>;

// ───────────────────────────── the cost chain ─────────────────────────────

/** H100e-hours of serving per human work-hour at FLOP per token `fpt` and a token profile (FLOP-bearing tokens), at
 *  decode utilisation `ud` (the serving lab's: D10 stacks.ts decodeUtilOf; the 2025 reference 0.07 by default). */
export const h100eHoursPer = (fpt: number, tok: TokenProfile, ud = U_DECODE) => (fpt * (tok.input / U_PREFILL + tok.output / ud)) / PEAK_FLOPS / 3600;
/** The same without a profile object (hot loops). */
const hphOf = (fpt: number, tin: number, tout: number, ud: number) => (fpt * (tin / U_PREFILL + tout / ud)) / PEAK_FLOPS / 3600;

/** Model v3 D10: a model's reasoning-token multiplier τ: the output tokens it needs for the same answer, relative to the
 *  2025 profiles, 10^(−TOK_PER_RL_OOM × its RL recipe's G-equivalent), ≥ TOK_MIN. Player versions read their build (the
 *  RL efficiency and ceiling they were post-trained with; a distilled student inherits its teacher's, as it learns from
 *  its traces), rivals' and China's models the RL part of their G (SimpleModel.rlG). A recipe at or below the day-0
 *  recipe keeps the profiles (τ = 1). Effort multiplies the result, so effort's fit gain stays relative (R20 C3). */
export function tokEff(v: { build?: { eRL: number; aRL?: number; flopPre: number }; rlG?: number } | undefined): number {
  if (!v) return 1;
  const g = v.build ? rlGOfBuild(v.build) : v.rlG ?? 0;
  return g > 0 ? Math.max(TOK_MIN, Math.pow(10, -TOK_PER_RL_OOM * g)) : 1;
}
/** $ per H100e-hour of serving (the market rental: what the chip-hour would fetch). */
export const serveDollarsPerHour = (s: GameStateV2) => dollarsPerH100eHour(s);
/** B4 (readout only): serving cost of a model at FLOP per token `fpt` for one hour of use (an assisted work-hour,
 *  TOKENS.assisted) and one agent-hour (TOKENS.autonomous), at today's $ per H100e-hour; before any markup or feature
 *  token multiplier. */
export function useHourCost(s: GameStateV2, fpt: number, tau = 1, ud = decodeUtilNow(s)): { hour: number; agentHour: number; perH100eHour: number } {
  const usd = serveDollarsPerHour(s);
  const a = TOKENS.assisted;
  const g = TOKENS.autonomous;
  return { hour: hphOf(fpt, a.input, a.output * tau, ud) * usd, agentHour: hphOf(fpt, g.input, g.output * tau, ud) * usd, perH100eHour: usd };
}

/** Effort's reasoning-token multiplier and its compute-equivalent fit gain (R20 C3: +0.4 OOM per ×10, capped). */
export const effortTokens = (e: Deployment['effort']) => EFFORT_TOKENS[e] ?? 1;
export const effortDG = (mult: number) => Math.max(-EFFORT_CAP_OOM, Math.min(EFFORT_CAP_OOM, EFFORT_OOM_PER_10X * Math.log10(Math.max(1e-6, mult))));

/** Active parameters of the smallest student of a teacher with `nT` active parameters that lands at most `gap` OOM below
 *  it (the distillation rule: δ = DISTILL.a + DISTILL.b·log₁₀(N_T/N_S) at DISTILL_TPP, N_S ≥ PARAM_RANGE[0]); the
 *  teacher's own size when no student holds within `gap` (δ ≥ DISTILL.a). */
export function studentParamsFor(nT: number, gap: number): number {
  const lr = (gap - DISTILL.a) / DISTILL.b; // log₁₀(N_T/N_S) at which the gap is exactly `gap`
  return lr > 0 ? Math.max(PARAM_RANGE[0], nT / Math.pow(10, lr)) : nT;
}
/** A5: active parameters of the student of version `teacher` that holds the fit of version `hold` on work type `wt` (the
 *  cheapestAt rule on one teacher; a distill run with these parameters lands at that fit). The teacher's size when the
 *  teacher is not DISTILL.a above it. */
export function studentToHold(s: GameStateV2, teacher: ModelVersion, hold: Pick<ModelVersion, 'G' | 'build'>, wt: WorkTypeId = 'SWE'): number {
  const nT = teacher.params ?? s.player.models.bases.find((b) => b.id === teacher.baseId)?.params ?? REFERENCE_BASE.params;
  return studentParamsFor(nT, workFit(s, teacher, wt).fit - workFit(s, hold, wt).fit);
}

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

// ───────────────────────────── rivals' FLOP per token (model v3 F1) ─────────────────────────────

/** FLOP per token of a rival's or China's model: its own base's 2·N_active (actors/rivalModel.ts; N_active = √(FLOP/(6·tpp))
 *  of the run that trained it). Replaces the V4 bridge that sized rival models from their G. */
export const fptOfSimple = (_s: GameStateV2, m: SimpleModel) => fptOfSimpleModel(m);

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
 *  consumer chat. RD-B11 (B14), applied once: on Chat in the users' app choice (worldfx/mix.ts, × the player's appeal),
 *  not again on its users; on a sector product × its hours, agent-hours and seats (worldfx/revenue.ts), held so the
 *  player never sells more than the sector adopts (share × (1 + enabler) ≤ 1). Interim until enablers become
 *  capabilities in the offer (SYNTHESIS RD-P07). */
export function enablerShare(fx: FeatureFx[], sid: SectorId | 'CHAT'): number {
  let x = 0;
  for (const f of fx) if (f.kind === 'enabler' && (sid === 'CHAT' ? f.consumer : f.sectors?.includes(sid))) x += f.share;
  return x;
}

// ───────────────────────────── offers: a model's fit, coverage, cost and price on a work type ─────────────────────────────

/** One model a provider serves a segment with, and its usage share (a product's free tier blends in its mini). */
export interface ModelUse { v: Fitted; fpt: number; w: number }
/** What a provider offers on one sector's work: fit (OOM, usage-weighted), coverage, H100e-hours and cost per adopted
 *  task-hour ($), price per adopted task-hour before the value cap ($). A2c agent work: agent-hours per supervising hour
 *  before the buyer's gate (k = a·λ), agent-hours one supervising hour sustains (λ), H100e-hours, cost and price per
 *  agent-hour (autonomous profile, before the value cap); H100e-hours per seated (assisted) hour and the seat price per
 *  seat-month ($: list × the markup relative to standard, never below the seat's serving cost). */
export interface Offer { fit: number; a: number; hph: number; cost: number; price: number; k: number; lam: number; hphAg: number; costAg: number; priceAg: number; hphAs: number; seat: number }
/** ud: the serving lab's decode utilisation (D10; default the 2025 reference 0.07). */
export interface OfferOpts { dG?: number; hMult?: number; tok?: number; effort?: number; markup: number; rate: number; ud?: number }

/** Agent-hours one supervising human-hour sustains at coverage a and 50% horizon h50 (minutes): 1 / (c/h80 + ρ·(1 − a) +
 *  m) (AGENT_WORK). */
export function agentLeverage(a: number, h50: number): number {
  const h80 = Math.max(1e-6, (h50 * H80_OVER_H50) / 60);
  return 1 / (AGENT_WORK.checkInH / h80 + ASSIST.review * (1 - Math.min(1, Math.max(0, a))) + AGENT_WORK.floorH);
}

interface UseFit { f: number; au: number; l: number }
function useFitOf(s: GameStateV2, w: TimelineWorld, v: Fitted, sid: SectorId | 'CHAT', hd: DomainId, dG: number, hm: number): UseFit {
  const f = sectorFit(s, v, sid) + dG;
  const h50 = h50Of(w, v, hd) * hm;
  const au = sectorCover(w, sid, f, h50);
  return { f, au, l: agentLeverage(au, h50) };
}
/** P2: a model without a build (rivals', China's: known only by G) has the same fit, coverage and leverage on a work
 *  type for the same G, ΔG, horizon multiplier and P19 (the only state domainG reads), so those are cached on exactly
 *  these inputs (per world). Player versions (with a build) are computed every time. */
type FitMemo = Map<number, Map<number, Map<number, Map<string, UseFit>>>>; // G → ΔG → h multiplier → work type + P19
const useFitMemo = new WeakMap<TimelineWorld, { m: FitMemo; n: number }>();
const PLUS_KEY: Partial<Record<SectorId | 'CHAT', string>> = {};
function useFit(s: GameStateV2, w: TimelineWorld, v: Fitted, sid: SectorId | 'CHAT', hd: DomainId, dG: number, hm: number): UseFit {
  if (v.build) return useFitOf(s, w, v, sid, hd, dG, hm);
  let memo = useFitMemo.get(w);
  if (!memo || memo.n > 20000) useFitMemo.set(w, (memo = { m: new Map(), n: 0 }));
  let a = memo.m.get(v.G);
  if (!a) memo.m.set(v.G, (a = new Map()));
  let b = a.get(dG);
  if (!b) a.set(dG, (b = new Map()));
  let c = b.get(hm);
  if (!c) b.set(hm, (c = new Map()));
  const key = adopted(s, 'P19') ? (PLUS_KEY[sid] ??= sid + '+') : sid; // P4: the '+' keys made once (no string per call)
  let x = c.get(key);
  if (!x) {
    c.set(key, (x = useFitOf(s, w, v, sid, hd, dG, hm)));
    memo.n++;
  }
  return x;
}
/** A token profile scaled by the feature token multiplier tk and effort (output only). Module level: no per-call closure. */
const scaleTok = (b: TokenProfile, tk: number, eff: number): TokenProfile => ({ input: b.input * tk, output: b.output * tk * eff });
const CHAT_OFFER_TOKENS: TokenProfile = { input: 3e3, output: 8e2 };
/** The offer of a set of model uses on one sector's work (or consumer chat: fit and coverage; cost per work-hour of chat
 *  is not used). */
export function offerOf(s: GameStateV2, uses: ModelUse[], sid: SectorId | 'CHAT', o: OfferOpts): Offer {
  const w = s.hidden.timeline;
  const eff = o.effort ?? 1;
  const dG = (o.dG ?? 0) + effortDG(eff);
  const hm = o.hMult ?? 1;
  const tk = o.tok ?? 1;
  const chat = sid === 'CHAT';
  const tok = scaleTok(chat ? CHAT_OFFER_TOKENS : adoptedTokens(s, sid), tk, eff);
  const tokAg = scaleTok(TOKENS.autonomous, tk, eff);
  const tokAs = scaleTok(chat ? TOKENS.assisted : SECTOR_WORK[sid].tokens, tk, eff);
  const hd = horizonDomain(sid);
  const ud = o.ud ?? U_DECODE;
  let fit = 0;
  let a = 0;
  let hph = 0;
  let hphAg = 0;
  let hphAs = 0;
  let k = 0;
  let lam = 0;
  for (const u of uses) {
    const { f, au, l } = useFit(s, w, u.v, sid, hd, dG, hm);
    fit += u.w * f;
    a += u.w * au;
    k += u.w * au * l;
    lam += u.w * l;
    // D10: the model's reasoning tokens for the same answer (τ, on output tokens, like effort).
    const tau = tokEff(u.v);
    hph += u.w * hphOf(u.fpt, tok.input, tok.output * tau, ud);
    hphAg += u.w * hphOf(u.fpt, tokAg.input, tokAg.output * tau, ud);
    hphAs += u.w * hphOf(u.fpt, tokAs.input, tokAs.output * tau, ud);
  }
  const cost = hph * o.rate;
  const costAg = hphAg * o.rate;
  const seatCost = chat ? 0 : seatHoursPerMonth(sid) * hphAs * o.rate;
  return {
    fit, a, hph, cost, price: o.markup * cost, k, lam, hphAg, costAg, priceAg: o.markup * costAg, hphAs,
    seat: chat ? 0 : Math.max(seatCost, (SEATS.price * o.markup) / MARKUP.standard),
  };
}

/** Human wage per hour of a sector's work in a region ($). */
export const wagePerHour = (sid: SectorId, r: RegionId) => SECTOR_DEF[sid].wage * REGION_SCALE[r].wage * ECON.W0;
/** Hours of the sector's work an adopted task-hour saves (A2c: the hours billed per hour are the adopted ones, A):
 *  substituted tasks a whole hour, augmented ones g_aug (research/16 step 6): α + (1 − α)·g_aug. (An hour of use
 *  overall saves α_use + (1 − α_use)·g_aug with α_use = α·A/U, measured 0.35: worldfx/use.ts, readouts workUse.) */
export const savedPerAdoptedHour = (s: GameStateV2, r: RegionId, sid: SectorId) => savedAt(s.world.sectors[r][sid].alpha);
/** FLOP-bearing tokens per adopted task-hour in a sector: α·autonomous + (1 − α)·assisted (α the US substitution
 *  share): substituted tasks run as agents, augmented ones with an assistant the whole hour. */
export function adoptedTokens(s: GameStateV2, sid: SectorId): TokenProfile {
  const st = s.world.sectors.US[sid];
  const a = st ? st.alpha : 0.25;
  const x = SECTOR_WORK[sid].tokens;
  const y = TOKENS.autonomous;
  return { input: a * y.input + (1 - a) * x.input, output: a * y.output + (1 - a) * x.output };
}
/** Value of an adopted task-hour in a sector and region ($): the wage of the work it saves. */
export const valuePerHour = (s: GameStateV2, sid: SectorId, r: RegionId) => wagePerHour(sid, r) * savedPerAdoptedHour(s, r, sid);
/** Agent-hours a supervising hour buys from an offer in a region (A2c), and the price per agent-hour: k × the buyer's gate
 *  σ(ln(wage ÷ (price + wage/λ))/kSpread) — an agent-hour plus the human time it takes against the human hour; the price
 *  is cost-plus, capped at the wage (an agent-hour is a human-equivalent hour of the work), never below cost. */
export function agentDemandOf(o: Pick<Offer, 'k' | 'lam' | 'priceAg' | 'costAg'>, wageH: number): { k: number; price: number } {
  const price = Math.max(o.costAg, Math.min(o.priceAg, wageH));
  if (!(o.k > 0)) return { k: 0, price };
  const bc = price + wageH / Math.max(1e-9, o.lam);
  return { k: o.k * sig(Math.log(wageH / Math.max(1e-9, bc)) / ECON.kSpread), price };
}
/** Target seat share of the workers who use AI (A2c): the seat's cost gate σ(ln(value ÷ price)/kSpread) × (1 − friction),
 *  value of a seat-month = a seat-holder's assisted hours a month × wage × g_aug. */
export function seatTarget(sid: SectorId, r: RegionId, seatPrice: number, R: number): number {
  if (!(seatPrice > 0)) return 0;
  const value = seatHoursPerMonth(sid) * wagePerHour(sid, r) * ECON.gAug;
  return sig(Math.log(value / seatPrice) / ECON.kSpread) * (1 - Math.max(0, Math.min(1, R)));
}

/** Buyer's cost of an AI work-hour ($): the price plus the human review the AI's output still needs on the work it cannot
 *  do alone (GDPval review ≈ 0.27 of the human time, R20 E2) [D]. */
export const buyerCost = (price: number, a: number, wageH: number) => price + ASSIST.review * wageH * (1 - Math.min(1, a));
/** Cost gate of one offer (research/16 step 3 on the physical cost): σ(ln(wage ÷ buyer cost) / kSpread). */
export const costGateOf = (price: number, a: number, wageH: number) => sig(Math.log(wageH / Math.max(1e-9, buyerCost(price, a, wageH))) / ECON.kSpread);

// ───────────────────────────── the player's products ─────────────────────────────

/** Markup of a product's price tier (price = markup × its cost per work-hour). */
export const markupOf = (d: Deployment) => MARKUP[d.price] ?? MARKUP.standard;
/** RD-B11 (B16): a channel's price multiplier over the tier's markup (data/v2/features.ts CHANNEL_PRICE: Trusted ×3);
 *  1 elsewhere. It is in the product's offer (productOffer), so buyers see it. */
export const channelPriceOf = (d: Deployment) => CHANNEL_PRICE[d.channel] ?? 1;
export { RIVAL_MARKUP, CHINA_MARKUP };

/** The model a product's paying customers use: its main version. RD-B11 (B15): Chat's mini serves only its free users
 *  (chatFreeTier) and a sector product's mini is a separate tier (productMiniUses); neither blends in here. */
export function productUses(s: GameStateV2, d: Deployment): ModelUse[] {
  const v = versionById(s, d.versionId);
  return v ? [{ v, fpt: flopPerToken(s, v), w: 1 }] : [];
}
/** A5: a sector product's cheap tier, its mini (API), as a model use of its own; undefined without one. */
export function productMiniUses(s: GameStateV2, d: Deployment): ModelUse[] | undefined {
  if (d.channel === 'consumer' || !d.miniVersionId || !MINI_CHANNELS.includes(d.channel)) return undefined;
  const mini = versionById(s, d.miniVersionId);
  return mini ? [{ v: mini, fpt: flopPerToken(s, mini), w: 1 }] : undefined;
}

/** Coverage of a student g OOM below a teacher of sector fit `fit` and h50 `h50` (every domain shifted down by g). */
const studentCover = (w: TimelineWorld, sid: SectorId, fit: number, h50: number, g: number) => sectorCover(w, sid, fit - g, h50 * Math.pow(H50_PER_OOM, -g));
function memoAt<K, V>(m: Map<K, V>, k: K, mk: () => V): V {
  let x = m.get(k);
  if (x === undefined) m.set(k, (x = mk()));
  return x;
}
const newMap = () => new Map();

// ───────────────────────────── lineups (TIERS) ─────────────────────────────

/** TIERS: the students in a lineup under a model of `nT` active parameters (data/v2/serving.ts LINEUP): per rung its
 *  size ratio r = N_S/N_T (N_S ≥ PARAM_RANGE[0]: the 1B floor can leave a rung closer) and its distillation gap g =
 *  DISTILL.a + DISTILL.b·log₁₀(1/r) (OOM below the model in every domain, as runs.ts distillBuild). Rungs the floor
 *  merges are dropped; none under a model at the floor. */
export interface LineupRung { r: number; g: number }
const rungMemo = new Map<number, LineupRung[]>();
export function lineupOf(nT: number): LineupRung[] {
  const hit = rungMemo.get(nT);
  if (hit) return hit;
  const out: LineupRung[] = [];
  for (const r0 of LINEUP.ratios) {
    const nS = Math.max(PARAM_RANGE[0], nT * r0);
    if (!(nS < nT * (1 - 1e-9)) || (out.length && nS >= nT * out[out.length - 1].r * (1 - 1e-9))) continue;
    out.push({ r: nS / nT, g: DISTILL.a + DISTILL.b * Math.log10(nT / nS) });
  }
  if (rungMemo.size > 5000) rungMemo.clear();
  rungMemo.set(nT, out);
  return out;
}
type RungMemo = Map<string, Map<number, Map<number, Map<number, { a: number; lam: number }>>>>; // sector → fit → h50 → g
const rungFitMemo = new WeakMap<TimelineWorld, { m: RungMemo; n: number }>();
/** TIERS: the offer of the lineup student `rung` under a model whose offer on sector `sid` is `o` (fit o.fit, h50
 *  `h50`, both after the product's settings and features): the model shifted down by the rung's gap in every domain
 *  (coverage and agent leverage at fit − g, h50·H50_PER_OOM^−g), its H100e-hours, costs and prices × r (FLOP per token
 *  ∝ active parameters; the markup is the model's, so a premium price tier applies to every tier), its seat price the
 *  model's list price at that markup (never below its own serving cost). Coverage and leverage are memoised on these
 *  inputs per world (P2-style). */
export function rungOffer(s: GameStateV2, o: Offer, sid: SectorId, h50: number, rung: LineupRung, markup: number, rate: number): Offer {
  const w = s.hidden.timeline;
  let memo = rungFitMemo.get(w);
  if (!memo || memo.n > 20000) rungFitMemo.set(w, (memo = { m: new Map(), n: 0 }));
  const byG = memoAt(memoAt(memoAt(memo.m, sid, newMap), o.fit, newMap), h50, newMap) as Map<number, { a: number; lam: number }>;
  let f = byG.get(rung.g);
  if (!f) {
    const a = studentCover(w, sid, o.fit, h50, rung.g);
    f = { a, lam: agentLeverage(a, h50 * Math.pow(H50_PER_OOM, -rung.g)) };
    byG.set(rung.g, f);
    memo.n++;
  }
  const r = rung.r;
  const seatCost = seatHoursPerMonth(sid) * o.hphAs * r * rate;
  return {
    fit: o.fit - rung.g, a: f.a, hph: o.hph * r, cost: o.cost * r, price: o.price * r, k: f.a * f.lam, lam: f.lam, hphAg: o.hphAg * r, costAg: o.costAg * r,
    priceAg: o.priceAg * r, hphAs: o.hphAs * r, seat: Math.max(seatCost, (SEATS.price * markup) / MARKUP.standard),
  };
}
/** TIERS: a product's lineup on a sector: its main model's offer `main`, then the lineup students of the main model
 *  (lineupOf on its active parameters), then its own mini when it has one (`mini`, A5). */
export function productLineup(s: GameStateV2, d: Deployment, sid: SectorId, main: Offer, mini?: Offer, fx = productFx(s, d)): Offer[] {
  const v = versionById(s, d.versionId);
  const out = [main];
  if (v) {
    const nT = v.params ?? s.player.models.bases.find((b) => b.id === v.baseId)?.params ?? REFERENCE_BASE.params;
    const rungs = lineupOf(nT);
    if (rungs.length) {
      const h50 = sectorH50(s, v, sid, fxOn(fx, sid).hMult);
      const markup = markupOf(d);
      const rate = serveDollarsPerHour(s);
      for (const g of rungs) out.push(rungOffer(s, main, sid, h50, g, markup, rate));
    }
  }
  if (mini) out.push(mini);
  return out;
}
/** TIERS: a product's offer when its buyers take its tiers by hours shares `w` (product order, sum 1): costs and prices
 *  blend by hours; fit, coverage and agent leverage stay the main model's (the lineup does the hardest tasks on it). */
export function blendTiers(tiers: readonly Offer[], w: readonly number[] | undefined): Offer {
  const main = tiers[0];
  if (!w || tiers.length < 2 || !(w[0] < 1 - 1e-12)) return main;
  let hph = 0, cost = 0, price = 0, hphAg = 0, costAg = 0, priceAg = 0, hphAs = 0, seat = 0;
  for (let k = 0; k < tiers.length; k++) {
    const x = w[k] ?? 0;
    if (!(x > 0)) continue;
    const t = tiers[k];
    hph += x * t.hph; cost += x * t.cost; price += x * t.price; hphAg += x * t.hphAg; costAg += x * t.costAg; priceAg += x * t.priceAg; hphAs += x * t.hphAs; seat += x * t.seat;
  }
  return { ...main, hph, cost, price, hphAg, costAg, priceAg, hphAs, seat };
}

/** h50 (minutes) of a model on a sector's work (its horizon domain), as the offers read it. */
export const sectorH50 = (s: GameStateV2, v: Fitted, sid: SectorId | 'CHAT', hMult = 1) => h50Of(s.hidden.timeline, v, horizonDomain(sid)) * hMult;
/** ΔG of a product's settings (safeguards, control layer). */
export const settingsDG = (d: Deployment) => (SAFEGUARD_DG[d.safeguards] ?? 0) + (d.controlLayer ? CONTROL_LAYER_DG : 0);

/** A product's offer on a sector (its own certified sector pack there adds SECTOR_PACK_DG, RD-B12). RD-B11 (B16):
 *  priced at the tier's markup × the channel's price multiplier (channelPriceOf: Trusted ×3), so the market's choice
 *  and the revenue read the same price. */
export const SECTOR_PACK_DG = 0.4167; // OOM of fit in the sector (RD-U01: was 0.5 L ÷ 1.2)
export function productOffer(s: GameStateV2, d: Deployment, sid: SectorId, uses = productUses(s, d), fx = productFx(s, d)): Offer {
  const x = fxOn(fx, sid);
  const pack = packCertified(d, sid, s.time.day) ? SECTOR_PACK_DG : 0;
  return offerOf(s, uses, sid, { dG: settingsDG(d) + x.dG + pack, hMult: x.hMult, tok: x.tok, effort: effortTokens(d.effort), markup: markupOf(d) * channelPriceOf(d), rate: serveDollarsPerHour(s), ud: decodeUtilNow(s) });
}

// ───────────────────────────── consumer chat ─────────────────────────────

/** H100e-hours per user-day of consumer chat on a model (paying users' or free users' usage); `effort` multiplies the
 *  output (reasoning) tokens: the effort setting × the model's τ (tokEff); `ud` the serving lab's decode utilisation. */
export const chatHoursPerDay = (fpt: number, tok: TokenProfile, effort = 1, ud = U_DECODE) => hphOf(fpt, tok.input, tok.output * effort, ud);
/** A7: the free chat tier of a model with `nT` active parameters (data/v2/serving.ts FREE_TIER): the student that holds
 *  the model's fit less FREE_TIER.oom OOM, sized by the cheapestAt rule (studentParamsFor; the 1B floor
 *  can leave it closer). Its size ratio to the teacher and its gap below it (OOM); ratio 1 and gap 0 when no student is
 *  DISTILL.a below the teacher (the model itself is the cheapest adequate one). */
export function freeTierOf(nT: number): { r: number; gap: number } {
  const nS = studentParamsFor(nT, FREE_TIER.oom);
  return nS < nT ? { r: nS / nT, gap: DISTILL.a + DISTILL.b * Math.log10(nT / nS) } : { r: 1, gap: 0 };
}
/** A7: what the free users of the player's Chat product get: its mini when the player set one, else the free tier of
 *  its model (freeTierOf). Consumer-chat fit at the product's settings and features (no effort setting: free users get
 *  the default), FLOP per token and reasoning-token multiplier τ (a student keeps its teacher's, tokEff). */
export function chatFreeTier(s: GameStateV2, d: Deployment): { fit: number; fpt: number; tau: number } | undefined {
  const main = versionById(s, d.versionId);
  if (!main) return undefined;
  const x = fxOn(productFx(s, d), 'CHAT');
  const opts: OfferOpts = { dG: settingsDG(d) + x.dG, hMult: x.hMult, markup: markupOf(d), rate: serveDollarsPerHour(s), ud: decodeUtilNow(s) };
  const mini = d.miniVersionId ? versionById(s, d.miniVersionId) : undefined;
  if (mini) {
    const fpt = flopPerToken(s, mini);
    return { fit: offerOf(s, [{ v: mini, fpt, w: 1 }], 'CHAT', opts).fit, fpt, tau: tokEff(mini) };
  }
  const fpt = flopPerToken(s, main);
  const ft = freeTierOf(main.params ?? s.player.models.bases.find((b) => b.id === main.baseId)?.params ?? REFERENCE_BASE.params);
  return { fit: offerOf(s, [{ v: main, fpt, w: 1 }], 'CHAT', opts).fit - ft.gap, fpt: fpt * ft.r, tau: tokEff(main) };
}

/** Consumer subscription per month ($): a paying user's serving cost on the product's model (paid usage runs on the main
 *  model) and the plan's price. A6b: the price is the market's flat plan price for the tier (consumerPlanPrice: the
 *  willingness to pay on Standard), not cost-plus; margin = price − cost. Never below cost (a plan that must cost more
 *  than the willingness to pay finds no subscribers, paidShareTarget). */
export function subPrice(s: GameStateV2, fpt: number, markup: number, effort = 1, ud = U_DECODE): { cost: number; price: number } {
  const cost = chatHoursPerDay(fpt, CONSUMER_MKT.perDay.paid, effort, ud) * serveDollarsPerHour(s) * 30.4;
  return { cost, price: Math.max(cost, consumerPlanPrice(markup)) };
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
