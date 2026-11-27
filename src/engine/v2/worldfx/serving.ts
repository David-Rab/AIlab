// Serving economics and sector work on work types (model v3 V4: design/MODEL-V3.md §6, §7.2–7.4; design/archive/V3-BUILD.md
// "V4" and "V4 notes"). Owner: WS5. Data: src/data/v2/serving.ts.
//
//   cost per work-hour  c = H100e-hours per work-hour × $ per H100e-hour (market rental: the opportunity cost of a chip)
//   H100e-h per w-hour  = FLOP per token (2·N_active of the served version) × (input ÷ U_prefill + output ÷ U_decode)
//                         ÷ peak FLOP/s ÷ 3600, tokens per work-hour by work type × scaffolds
//   capacity            = serving H100e × 8766 h ÷ (H100e-hours per work-hour)   (work-hours per year)
//   price               MK-6 (design/MARKET.md M5): set per region in worldfx/mix.ts, p = min(c + M, value) per adopted
//                         task-hour (never below c), M the seller's Nash–Bertrand margin; an adopted hour saves
//                         (α + (1 − α)·g_aug) hours of the sector's work (substituted vs augmented), so value = wage × that.
//                         The offer here carries price = markup × c with markup 1 for those sellers (OPEN_MARKUP for
//                         open-weight hosts, priced near cost)
//   A2c agent work      k = a·λ agent-hours per supervising hour, λ = 1/(c/h80 + ρ(1 − a) + m), × the buyer's gate; price per
//                         agent-hour = min(cost on the autonomous profile × p/c, wage) (mix.ts: the tier's price-to-cost ratio);
//                         seat price = seat serving cost + the seller's seat margin (MK-9 mix.ts; data/v2/serving.ts SEATS)
//   sector coverage     a = σ((fit − θ_s)/s) × p(H_s | h50): the work-type function of V3 (departments/workfit.ts) with
//                         the sector's median professional as reference (θ_s, SECTOR_REF), fit = Σ ω_d G_d + ΔG(safeguards,
//                         scaffolds), h50 × horizon extenders
// Rivals and China serve their own designs (model v3 F1, actors/rivalModel.ts): FLOP per token 2·N_active of their base,
// fit their G. Nothing here reads a relative serve cost, the research-speed multiplier M or the level bridge for prices, costs or
// coverage.
import { controlOn } from '../safety/safeguards';
import {
  AGENT_WORK, CHAT_WORK, CONSUMER_MKT, CONTROL_LAYER_DG, consumerPlanPrice, LINEUP, WIN_SHARE_FRACTION,
  SAFEGUARD_DG, SECTOR_REF, SECTOR_WORK, TOKENS, type TokenProfile,
} from '../../../data/v2/serving';
import { P05_ORCHESTRATION, TOOL_BY_ID, enablerNeed, type ToolId, type FeatureFx, type WorkScope } from '../../../data/v2/features';
import { AGENT_TASK_HOURS, PRODUCT_TOOLS, PRODUCT_TOOL_BY_ID, type ProductToolId } from '../../../data/v2/tools';
import { ECON, REGION_SCALE, SECTORS } from '../../../data/v2/sectors';
import { DISTILL, REFERENCE_BASE, PARAM_RANGE } from '../../../data/v2/runDesign';
import { ASSIST, COVER, H80_OVER_H50, PEAK_FLOPS, TOK_MIN, TOK_PER_RL_OOM, U_DECODE, U_PREFILL, type WorkTypeId } from '../../../data/v2/workTypes';
import { dollarsPerH100eHour, domainG, flopPerToken, pSuccess, workFit } from '../departments/workfit';
import { gV0, h50Of } from '../models/capability';
import { fptOfSimpleModel } from '../npc/model';
import { versionById } from '../models/labs';
import { activeFeatures, agentModeOn, agentsGate } from '../models/products';
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
 *  recipe keeps the profiles (τ = 1). */
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

// ───────────────────────────── typed tool effects (V4.3) ─────────────────────────────

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
/** Typed effects of the product tools a product has switched on (MK-11: data/v2/tools.ts; a harness's fit on its
 *  sectors is its scaffold here). */
export const productFx = (s: GameStateV2, d: Deployment): FeatureFx[] => activeFeatures(s, d).flatMap((f) => f.fx);
/** MK-11 (M11): a rival's or China's offer opts from its lab's product tools (RivalLab.tools): the same typed effects
 *  as the player's (scaffold ΔG and tokens, horizon ×) on one work type, and whether it sells agent-hours: Agent mode
 *  among its tools and its model's horizon on the sector's work ≥ AGENT_TASK_HOURS (its simplest form: the true h50,
 *  a rival measures its own). */
export function labToolOpts(s: GameStateV2, tools: readonly string[] | undefined, sid: SectorId | 'CHAT', v?: Fitted): Pick<OfferOpts, 'dG' | 'hMult' | 'tok' | 'agents'> {
  const fx: FeatureFx[] = [];
  let agent = false;
  for (const id of tools ?? []) {
    const t = PRODUCT_TOOL_BY_ID[id as ProductToolId];
    if (!t) continue;
    fx.push(...t.fx);
    if (t.agentGateH !== undefined) agent = true;
  }
  const x = fxOn(fx, sid);
  const agents = agent && sid !== 'CHAT' && !!v && sectorH50(s, v, sid, x.hMult) >= AGENT_TASK_HOURS * 60;
  return { dG: x.dG, hMult: x.hMult, tok: x.tok, agents };
}
/** Typed effects on the lab's internal agents on an internal work type: the internal tools it owns (RD-A06, DD-03:
 *  data/v2/features.ts INTERNAL_TOOLS, built by engineers; product features act only inside their product's offer) and
 *  adopted Multi-agent orchestration's scaffold (P05, RD-E01b: data/v2/features.ts P05_ORCHESTRATION). */
export function internalFx(s: GameStateV2, wt: WorkTypeId): WorkFx {
  const fx: FeatureFx[] = [];
  for (const id of s.player.tooling ?? []) {
    const t = TOOL_BY_ID[id as ToolId];
    if (t) fx.push(...t.fx);
  }
  if (adopted(s, 'P05')) fx.push(P05_ORCHESTRATION);
  return fxOn(fx, wt);
}
/** RD-P07 (DD-03): per sector, the product tools with an enabler its work needs (Computer use, Creative studio) and the
 *  share of its tasks each one is needed for (data/v2/features.ts enablerNeed). */
const TOOL_NEED: Partial<Record<SectorId, [string, number][]>> = {};
for (const t of PRODUCT_TOOLS) for (const f of t.fx) {
  if (f.kind !== 'enabler') continue;
  for (const sid of f.sectors ?? []) (TOOL_NEED[sid] ??= []).push([t.id, enablerNeed(f.share)]);
}
/** RD-P07: share of a sector's tasks an offer cannot do for lack of tools: Σ need over the tools the sector needs that
 *  `tools` lacks (0 on Chat: Chat's tools act in the app choice, chatToolAppeal). */
export function toolGap(sid: SectorId | 'CHAT', tools?: readonly string[]): number {
  if (sid === 'CHAT') return 0;
  const need = TOOL_NEED[sid];
  if (!need) return 0;
  let g = 0;
  for (const [id, x] of need) if (!tools?.includes(id)) g += x;
  return Math.min(1, g);
}
/** RD-P07: Chat appeal from a provider's tools (consumer enablers: × (1 + share) each summed, as RD-B11 applied it once in
 *  the users' app choice), the same rule for the player and the rivals who acquired the tools. */
export function chatToolAppeal(tools?: readonly string[]): number {
  let x = 0;
  for (const id of tools ?? []) {
    const f = PRODUCT_TOOL_BY_ID[id as ProductToolId];
    if (f) for (const e of f.fx) if (e.kind === 'enabler' && e.consumer) x += e.share;
  }
  return 1 + x;
}
/** RD-P07, MK-11: the product tools a product has switched on (built; ids). Enablers among them widen its tasks
 *  (toolGap), Chat ones its appeal (chatToolAppeal). */
export const productTools = (s: GameStateV2, d: Deployment): string[] => activeFeatures(s, d).map((f) => f.id);

// ───────────────────────────── offers: a model's fit, coverage, cost and price on a work type ─────────────────────────────

/** One model a provider serves a segment with, and its usage share (a product's free tier blends in its mini). */
export interface ModelUse { v: Fitted; fpt: number; w: number }
/** What a provider offers on one sector's work: fit (OOM, usage-weighted), coverage, H100e-hours and cost per adopted
 *  task-hour ($), price per adopted task-hour before the value cap ($). A2c agent work: agent-hours per supervising hour
 *  before the buyer's gate (k = a·λ), agent-hours one supervising hour sustains (λ), H100e-hours, cost and price per
 *  agent-hour (autonomous profile, before the value cap); H100e-hours per seated (assisted) hour and the seat price per
 *  seat-month ($: its serving cost × markup; MK-9 mix.ts reprices it: seat cost + the seller's seat margin). */
export interface Offer { fit: number; a: number; hph: number; cost: number; price: number; k: number; lam: number; hphAg: number; costAg: number; priceAg: number; hphAs: number; seat: number }
/** ud: the serving lab's decode utilisation (D10; default the 2025 reference 0.07). */
/** tools (RD-P07): the product tools the provider has; in a sector that needs an enabler it lacks, coverage × (1 − toolGap). */
/** `agents` (MK-11): whether the offer sells autonomous agent-hours (Agent mode on and its gate passed: productOffer,
 *  labToolOpts); false: k = 0. Unset: computed as before (readouts of a model's own agent leverage). */
/** `markup` (MK-6): the price over cost the offer carries before the seller's margin: 1 for the sellers that price by
 *  competition (mix.ts adds their margin M per region), OPEN_MARKUP for open-weight hosts. */
export interface OfferOpts { dG?: number; hMult?: number; tok?: number; markup: number; rate: number; ud?: number; tools?: readonly string[]; agents?: boolean }

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
 *  type for the same G, ΔG and horizon multiplier, so those are cached on exactly
 *  these inputs (per world). Player versions (with a build) are computed every time. */
type FitMemo = Map<number, Map<number, Map<number, Map<string, UseFit>>>>; // G → ΔG → h multiplier → work type
const useFitMemo = new WeakMap<TimelineWorld, { m: FitMemo; n: number }>();
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
  let x = c.get(sid);
  if (!x) {
    c.set(sid, (x = useFitOf(s, w, v, sid, hd, dG, hm)));
    memo.n++;
  }
  return x;
}
/** A token profile scaled by the feature token multiplier tk. Module level: no per-call closure. */
const scaleTok = (b: TokenProfile, tk: number): TokenProfile => ({ input: b.input * tk, output: b.output * tk });
const CHAT_OFFER_TOKENS: TokenProfile = { input: 3e3, output: 8e2 };
/** The offer of a set of model uses on one sector's work (or consumer chat: fit and coverage; cost per work-hour of chat
 *  is not used). */
export function offerOf(s: GameStateV2, uses: ModelUse[], sid: SectorId | 'CHAT', o: OfferOpts): Offer {
  const w = s.hidden.timeline;
  const dG = o.dG ?? 0;
  const hm = o.hMult ?? 1;
  const tk = o.tok ?? 1;
  const chat = sid === 'CHAT';
  const tok = scaleTok(chat ? CHAT_OFFER_TOKENS : adoptedTokens(s, sid), tk);
  const tokAg = scaleTok(TOKENS.autonomous, tk);
  const tokAs = scaleTok(chat ? TOKENS.assisted : SECTOR_WORK[sid].tokens, tk);
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
    // D10: the model's reasoning tokens for the same answer (τ, on output tokens).
    const tau = tokEff(u.v);
    hph += u.w * hphOf(u.fpt, tok.input, tok.output * tau, ud);
    hphAg += u.w * hphOf(u.fpt, tokAg.input, tokAg.output * tau, ud);
    hphAs += u.w * hphOf(u.fpt, tokAs.input, tokAs.output * tau, ud);
  }
  // RD-P07 (DD-03): tasks needing a tool the offer lacks are not covered (coverage and agent work × (1 − gap); the agent
  // leverage λ keeps the covered tasks' review, a stand-in).
  const keep = 1 - toolGap(sid, o.tools);
  if (keep < 1) {
    a *= keep;
    k *= keep;
  }
  // MK-11: agent-hours only where Agent mode sells them (the leverage λ stays: readouts of supervision).
  if (o.agents === false) k = 0;
  const cost = hph * o.rate;
  const costAg = hphAg * o.rate;
  const seatCost = chat ? 0 : seatHoursPerMonth(sid) * hphAs * o.rate;
  return {
    fit, a, hph, cost, price: o.markup * cost, k, lam, hphAg, costAg, priceAg: o.markup * costAg, hphAs,
    seat: chat ? 0 : seatCost * o.markup,
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
 *  is its cost × the tier's price-to-cost ratio (MK-6, mix.ts), capped at the wage (an agent-hour is a human-equivalent hour of the work), never below cost. */
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

/** MK-6 (design/MARKET.md M6): the share of the lab's margin M a product's stance takes (Best profit 1, Win share
 *  WIN_SHARE_FRACTION): its tiers sell at their serving cost + this × M (mix.ts). */
export const stanceFactor = (d: Pick<Deployment, 'stance'>) => (d.stance === 'share' ? WIN_SHARE_FRACTION : 1);

/** The model a product's paying customers use: its main version. RD-B11 (B15) / RD-P01a: Chat's free users run its
 *  free-tier slot (chatFreeTier) and a sector product's other lineup models are tiers of their own (productTierUses);
 *  neither blends in here. */
export function productUses(s: GameStateV2, d: Deployment): ModelUse[] {
  const v = versionById(s, d.versionId);
  return v ? [{ v, fpt: flopPerToken(s, v), w: 1 }] : [];
}
/** RD-P01a: the real versions of a product's lineup after its main model (Deployment.lineup order; unknown or retired
 *  ids and the main model itself skipped). */
export function lineupVersions(s: GameStateV2, d: Deployment): ModelVersion[] {
  const out: ModelVersion[] = [];
  for (const id of d.lineup ?? []) {
    if (id === d.versionId) continue;
    const v = versionById(s, id);
    if (v && v.status !== 'retired' && !out.includes(v)) out.push(v);
  }
  return out;
}
/** RD-P01a: each lineup entry after the main model as a model use of its own (its own FLOP per token). */
export function productTierUses(s: GameStateV2, d: Deployment): ModelUse[][] {
  return lineupVersions(s, d).map((v) => [{ v, fpt: flopPerToken(s, v), w: 1 }]);
}

// ───────────────────────────── lineups (TIERS) ─────────────────────────────

/** TIERS / RD-P02: the student sizes a distill step makes under a model of `nT` active parameters (data/v2/serving.ts
 *  LINEUP): per rung its size ratio r = N_S/N_T (N_S ≥ PARAM_RANGE[0]: the 1B floor can leave a rung closer). Rungs the
 *  floor merges are dropped; none under a model at the floor. Used when models are made (day-0 minis, rivals' distill
 *  step), never by the market at read time. */
export function lineupSizes(nT: number): number[] {
  const out: number[] = [];
  for (const r0 of LINEUP.ratios) {
    const nS = Math.max(PARAM_RANGE[0], nT * r0);
    if (!(nS < nT * (1 - 1e-9)) || (out.length && nS >= nT * out[out.length - 1] * (1 - 1e-9))) continue;
    out.push(nS / nT);
  }
  return out;
}
/** TIERS / RD-P01a: a product's lineup on a sector: its main model's offer `main`, then each real lineup entry
 *  (productTierUses, Deployment.lineup order) at its own fit and serving cost, the product's settings, features and
 *  markup (productOffer). No phantom students for the player (DD-01). */
export function productLineup(s: GameStateV2, d: Deployment, sid: SectorId, main: Offer, fx = productFx(s, d), tiers = productTierUses(s, d), tools = productTools(s, d)): Offer[] {
  const out = [main];
  for (const u of tiers) out.push(productOffer(s, d, sid, u, fx, tools));
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
/** MK-5c (design/MARKET.md M2): the agent-hours a supervising hour buys when buyers take the tiers `line` by hours
 *  shares `tw` (any sum; none, or all 0: the first tier alone): Σ_k tw_k · k_k ÷ Σ tw, each tier at its own leverage k, λ
 *  and agent price after the buyer's gate (agentDemandOf; a tier without Agent mode or failing its gate, k = 0, adds 0
 *  agent-hours, MK-11); the price per agent-hour, the buyer's cost per agent-hour (price + wage ÷ λ) and the serving
 *  H100e-hours and cost per agent-hour weighted by the tiers' agent-hours (ag: those weights, sum 1; undefined when no
 *  tier sells any). The sector mix (the player's whole lineup by its tier mix) and the revenue (each product by its
 *  playerTierW) both read it, so the products' agent-hours sum to the mix's agentK. */
export function agentMixOf(line: readonly Offer[], tw: readonly number[] | undefined, wageH: number): { k: number; price: number; bc: number; hphAg: number; costAg: number; ag?: number[] } {
  let z = 0;
  if (tw) for (let j = 0; j < line.length; j++) if ((tw[j] ?? 0) > 0) z += tw[j];
  let k = 0;
  let sp = 0;
  let bc = 0;
  let h = 0;
  let c = 0;
  const ag: number[] = new Array(line.length).fill(0);
  for (let j = 0; j < line.length; j++) {
    const x = z > 0 ? (tw![j] ?? 0) / z : j === 0 ? 1 : 0;
    if (!(x > 0)) continue;
    const o = line[j];
    const d = agentDemandOf(o, wageH);
    const kk = x * d.k;
    if (!(kk > 0)) continue;
    ag[j] = kk;
    k += kk;
    sp += kk * d.price;
    bc += kk * (d.price + wageH / Math.max(1e-9, o.lam));
    h += kk * o.hphAg;
    c += kk * o.costAg;
  }
  if (!(k > 0)) {
    const o = line[0];
    const price = o ? agentDemandOf(o, wageH).price : 0;
    return { k: 0, price, bc: price + wageH / Math.max(1e-9, o?.lam ?? 1), hphAg: o?.hphAg ?? 0, costAg: o?.costAg ?? 0 };
  }
  for (let j = 0; j < ag.length; j++) ag[j] /= k;
  return { k, price: sp / k, bc: bc / k, hphAg: h / k, costAg: c / k, ag };
}

/** h50 (minutes) of a model on a sector's work (its horizon domain), as the offers read it. */
export const sectorH50 = (s: GameStateV2, v: Fitted, sid: SectorId | 'CHAT', hMult = 1) => h50Of(s.hidden.timeline, v, horizonDomain(sid)) * hMult;
/** ΔG of a product's settings (safeguards, control layer). */
export const settingsDG = (d: Deployment) => (SAFEGUARD_DG[d.safeguards] ?? 0) + (controlOn(d) ? CONTROL_LAYER_DG : 0);

/** A product's offer on a sector. RD-B11 (B16): at its serving cost (markup 1): MK-6 the market (mix.ts) adds the lab's
 *  margin per region, and the revenue reads those prices (SectorMix.playerLines). RD-P07: its tools (productTools) widen
 *  the tasks it covers where the sector needs them; MK-11: its harnesses' fit is in its typed effects (fx), and it sells
 *  agent-hours only with Agent mode on and a model (the use's version: each lineup model on its own) whose measured time
 *  horizon passes the gate (models/products.ts agentsGate). */
export function productOffer(s: GameStateV2, d: Deployment, sid: SectorId, uses = productUses(s, d), fx = productFx(s, d), tools = productTools(s, d)): Offer {
  const x = fxOn(fx, sid);
  const agents = tools.includes('agentMode') && agentModeOn(s, d) && uses.length > 0 && uses.every((u) => agentsGate(u.v as ModelVersion) === true);
  return offerOf(s, uses, sid, { dG: settingsDG(d) + x.dG, hMult: x.hMult, tok: x.tok, markup: 1, rate: serveDollarsPerHour(s), ud: decodeUtilNow(s), tools, agents });
}

// ───────────────────────────── consumer chat ─────────────────────────────

/** H100e-hours per user-day of consumer chat on a model (paying users' or free users' usage); `tau` multiplies the
 *  output (reasoning) tokens: the model's τ (tokEff); `ud` the serving lab's decode utilisation. */
export const chatHoursPerDay = (fpt: number, tok: TokenProfile, tau = 1, ud = U_DECODE) => hphOf(fpt, tok.input, tok.output * tau, ud);
/** RD-P01a: the model in a Chat product's free-tier slot: Deployment.freeTierId when it is in the lineup (the main model
 *  or a lineup entry), else the lineup's cheapest model to serve (lowest FLOP per token; the main model alone: itself). */
export function freeTierVersion(s: GameStateV2, d: Deployment): ModelVersion | undefined {
  const main = versionById(s, d.versionId);
  if (!main) return undefined;
  const all = [main, ...lineupVersions(s, d)];
  const set = d.freeTierId ? all.find((v) => v.id === d.freeTierId) : undefined;
  if (set) return set;
  let best = main;
  let bf = flopPerToken(s, main);
  for (const v of all) {
    const f = flopPerToken(s, v);
    if (f < bf) {
      best = v;
      bf = f;
    }
  }
  return best;
}
/** A7 / RD-P01a: what the free users of the player's Chat product get: the real model in its free-tier slot
 *  (freeTierVersion; with only the main model, the main model at its real serving cost). Consumer-chat fit at the
 *  product's settings and features, FLOP per token and reasoning-token
 *  multiplier τ (tokEff). */
export function chatFreeTier(s: GameStateV2, d: Deployment): { fit: number; fpt: number; tau: number; id: string } | undefined {
  const v = freeTierVersion(s, d);
  if (!v) return undefined;
  const x = fxOn(productFx(s, d), 'CHAT');
  const opts: OfferOpts = { dG: settingsDG(d) + x.dG, hMult: x.hMult, markup: 1, rate: serveDollarsPerHour(s), ud: decodeUtilNow(s) };
  const fpt = flopPerToken(s, v);
  return { fit: offerOf(s, [{ v, fpt, w: 1 }], 'CHAT', opts).fit, fpt, tau: tokEff(v), id: v.id };
}

/** Consumer subscription per month ($): a paying user's serving cost on the product's model (paid usage runs on the main
 *  model) and the plan's price. MK-9: cost + `margin` (the seller's plan margin × the product's stance factor, mix.ts),
 *  at most the willingness to pay, never below cost (consumerPlanPrice; a plan that must cost more than the willingness
 *  to pay finds no subscribers, paidShareTarget). */
export function subPrice(s: GameStateV2, fpt: number, margin: number, tau = 1, ud = U_DECODE): { cost: number; price: number } {
  const cost = chatHoursPerDay(fpt, CONSUMER_MKT.perDay.paid, tau, ud) * serveDollarsPerHour(s) * 30.4;
  return { cost, price: consumerPlanPrice(cost, margin) };
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
