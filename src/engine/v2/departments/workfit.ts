// Work types: a model's fit, horizon, coverage and assist; AI labour; effective labour; research taste; the work-type
// milestones; the research-speed readout (model v3 V3: design/MODEL-V3.md §6, §8; design/V3-BUILD.md V3.2–V3.5 and "V3
// notes"). Owner: WS1. Data: src/data/v2/workTypes.ts.
//
//   fit        F_w = Σ_d ω_w,d · G_d (OOM; G_d the version's domain effective compute + level offsets ÷ LEVEL_PER_OOM)
//   reference  best human F*_w = G_SC + Δ_bm·Σ ω·δ_d(sd_SC); median expert F*_w − Δ_bm (per preset: TimelineWorld.v3)
//   horizon    h50 = 203 min × 4.2^(G_h − G_V0) × h80Mult (G_h: CODE for software, AGENCY otherwise); p(H) = 1/(1 + (H/h50)^β)
//   coverage   a_w = σ((F_w − θ_w)/s) × p(H_w), θ_w = F*_w − s·ln 19 + κ_v·(0.9 − v_w)
//   assist     win rate w = Φ((F_w − F^med)/S_WIN); human speed-up 1/(M + R + (1 − w)) when > 1 (GDPval)
//   AI labour  FTE = compute × 8766 h ÷ (H100e-hours per work-hour) ÷ 2000 h; H100e-hours per work-hour = 2·N_active ×
//              (200k uncached input ÷ 0.35 + 40k output ÷ 0.07) ÷ 1e15 ÷ 3600 (physical: FLOP per token, utilisation)
//   labour     L_w = [(1 − a)^(1−ρc)·(H·assist)^ρc + a^(1−ρc)·AI^ρc]^(1/ρc) (AI Futures coding CES); m_w = L_w / H multiplies
//              every allocation of the role's teams (agents add capacity to the same allocations, MODEL-V3 §5.6)
//   taste      sd_AI = 3.09·(F_IDEAS − F^med_IDEAS)/Δ_bm; a team's taste E[max(T_team, F_AI)] on the AIFM distribution
//   safety     SAF_EXP / SAF_IDEAS on the safety package through the same functions; Trusted to AI t is the share of
//              the work handed to AI (handedLabour: A = t·a; t = 1 is the capabilities case exactly; model v3 E2)
// Nothing here reads pm, the level bridge, the knot tables or a reference path.
import {
  ASSIST, COGNITIVE_WORK, COPY_TOKENS_PER_S, COVER, FTE_HOURS_PER_YEAR, H80_OVER_H50, HORIZON_BETA,
  LEVEL_PER_OOM, MILESTONE_COVER, PEAK_FLOPS, QUALITY_TASTE_SD, refDelta, SPEED_CAP, STAR_TASTE, S_WIN, TOKENS_PER_WORK_HOUR, TOP_SD,
  U_DECODE, U_PREFILL, WORK_TYPES, type WorkTypeDef, type WorkTypeId,
} from '../../../data/v2/workTypes';
import { RSCH_TASTE_PENALTY } from '../../../data/v2/calibration';
import { B0_PARAMS, SHAPE } from '../../../data/v2/runDesign';
import { DEFAULT_CAP_SHARES } from '../../../data/v2/agents';
import { QUALITY, TEAM_COST_M } from '../../../data/v2/teams';
import { PROJECT_BY_ID, isLineNode } from '../../../data/v2/tree';
import { Lrel, Phi, tasteSigma } from '../production/knots';
import { gOfDomain, gOfPm, h50Of } from '../models/capability';
import { adopted } from '../models/paradigms';
import { payoffOf } from '../models/tree';
import { decimalYear } from '../core/time';
import { spareServingToResearch } from '../worldfx/revenue';
import { internalFx, tokEff } from '../worldfx/serving';
import { decodeUtilNow } from '../models/stacks';
import { ws4r } from '../actors/state';
import { agentVersion, capShare, monitorVersion } from './agents';
import { useControl } from '../safety/oversight';
import type { DomainId, GameStateV2, ModelVersion, ProdParams, TeamQuality, TimelineWorld } from '../types';

const LIVE = (v: ModelVersion) => v.status !== 'retired' && v.status !== 'rolledBack';
const sig = (x: number) => 1 / (1 + Math.exp(-x));

// ───────────────────────────── fit and reference points ─────────────────────────────

/** A version's effective compute in domain d for work (OOM): its domain G (MODEL-V3 §2.3) and its level offsets
 *  (preference, paradigms) at LEVEL_PER_OOM; with Learned research taste (P19) RSCH gains the size of v2's RSCH taste
 *  penalty (0.5 L = 0.42 OOM). The human reference points are set for a lab without P19, so the v2 penalty is not also
 *  subtracted (the display level keeps it until P19). A version without a build (an imported open model) is read through
 *  the display bridge's inverse, BRIDGE(V7). */
export function domainG(s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build'>, d: DomainId): number {
  const b = v.build;
  let g = b ? gOfDomain(b, d) + (b.offL[d] ?? 0) / LEVEL_PER_OOM : gOfPm(s.hidden.timeline, v.pm);
  if (d === 'RSCH' && adopted(s, 'P19')) g -= RSCH_TASTE_PENALTY / LEVEL_PER_OOM;
  return g;
}

/** Fit F_w of a version in work type w (OOM of effective compute). */
export function fitOf(s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build'>, wt: WorkTypeId): number {
  let f = 0;
  for (const [d, x] of Object.entries(WORK_TYPES[wt].w) as [DomainId, number][]) f += x * domainG(s, v, d);
  return f;
}

/** Human reference points of a work type in world w: the best human in the world and the median expert (OOM). */
const deltaMemo = new WeakMap<TimelineWorld['v3'], Record<DomainId, number>>();
export function refPoints(w: TimelineWorld, wt: WorkTypeId): { best: number; med: number } {
  let rd = deltaMemo.get(w.v3);
  if (!rd) deltaMemo.set(w.v3, (rd = refDelta(w.v3.sdSC)));
  let delta = 0;
  for (const [d, x] of Object.entries(WORK_TYPES[wt].w) as [DomainId, number][]) delta += x * rd[d];
  const best = w.v3.gSC + w.v3.dBM * delta;
  return { best, med: best - w.v3.dBM };
}

// ───────────────────────────── horizon, coverage, assist ─────────────────────────────

/** 50% time horizon (minutes) of a version in a work type: METR's 203 min for V0 × 4.2 per OOM of the horizon domain's
 *  effective compute over V0's, × the version's horizon multiplier (long-horizon RL, P07, P12). */
export const h50Min = (s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build'>, wt: WorkTypeId = 'EXP') => h50Of(s.hidden.timeline, v, WORK_TYPES[wt].horizon);
/** 80% time horizon (minutes) = h50 / 5 (METR TH1.1). */
export const h80Min = (s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build'>, wt: WorkTypeId = 'EXP') => h50Min(s, v, wt) * H80_OVER_H50;
/** METR success probability on a task of `hours` given h50 (minutes): 1/(1 + (t/h50)^β). */
export const pSuccess = (hours: number, h50: number) => 1 / (1 + Math.pow((hours * 60) / Math.max(1e-9, h50), HORIZON_BETA));

/** Coverage threshold θ_w (OOM). */
export const thetaOf = (w: TimelineWorld, wt: WorkTypeId) =>
  refPoints(w, wt).best - COVER.s * Math.log(COVER.top / (1 - COVER.top)) + COVER.kappaV * (0.9 - WORK_TYPES[wt].v);
/** Coverage a_w from fit and horizon: the share of the work AI can do on its own. */
export const coverage = (w: TimelineWorld, wt: WorkTypeId, fit: number, h50: number) =>
  sig((fit - thetaOf(w, wt)) / COVER.s) * pSuccess(WORK_TYPES[wt].H, h50);
/** Win rate against a median expert (GDPval). */
export const winRate = (w: TimelineWorld, wt: WorkTypeId, fit: number) => Phi((fit - refPoints(w, wt).med) / S_WIN);
/** Assist: speed-up of the human-done share, H/(M + R + (1 − w)·H) when it helps (w ≳ 0.3), else 1. */
export const assistOf = (win: number) => Math.max(1, 1 / (ASSIST.model + ASSIST.review + (1 - win)));

/** Fit, horizon and coverage of a version in a work type. */
export interface WorkFit { fit: number; best: number; med: number; h50: number; a: number; win: number; assist: number }
/** Fit with the typed feature effects of a deployment (V4.3: scaffolds add ΔG, horizon extenders × h50); milestones read
 *  the model alone. */
export function workFit(s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build'>, wt: WorkTypeId, fx?: { dG: number; hMult: number }): WorkFit {
  const w = s.hidden.timeline;
  const fit = fitOf(s, v, wt) + (fx?.dG ?? 0);
  const r = refPoints(w, wt);
  const h50 = h50Min(s, v, wt) * (fx?.hMult ?? 1);
  const win = winRate(w, wt, fit);
  return { fit, best: r.best, med: r.med, h50, a: coverage(w, wt, fit, h50), win, assist: assistOf(win) };
}

/** AI research taste in human SDs above the median (AIFM): 3.09·(F_w − F^med_w)/Δ_bm, on research ideas (IDEAS) or
 *  safety research ideas (SAF_IDEAS: the same domains, so the same reference points). */
export const sdAIOf = (w: TimelineWorld, fitIdeas: number, wt: WorkTypeId = 'IDEAS') => (TOP_SD * (fitIdeas - refPoints(w, wt).med)) / w.v3.dBM;

// ───────────────────────────── AI labour (physical) ─────────────────────────────

/** Serving FLOP per token of a version: 2·N_active × the shape's token multiplier × its serving efficiency relative to
 *  its base (the serving stack and distillation; MODEL-V3 §7.3). */
export function flopPerToken(s: GameStateV2, v: Pick<ModelVersion, 'baseId' | 'serveCost' | 'params' | 'fpt'>): number {
  if (v.fpt) return v.fpt;
  return fptOfBuild(s, v);
}
/** FLOP per token from the version's base and its serving efficiency relative to the base (set once on the version as
 *  `fpt` when it is made; old versions without it are read through this). */
export function fptOfBuild(s: GameStateV2, v: Pick<ModelVersion, 'baseId' | 'serveCost' | 'params'>): number {
  const b = s.player.models.bases.find((x) => x.id === v.baseId);
  if (!b) return 2 * (v.params ?? B0_PARAMS);
  const rel = b.serve && b.serve > 0 ? v.serveCost / b.serve : 1;
  return 2 * b.params * SHAPE[b.design.shape].tokenMult * rel;
}
/** Model v3 D10: the FLOP per token on the internal agentic profile that costs the same H100e-hours per work-hour as
 *  `fpt` does at reasoning-token multiplier τ (output tokens) and decode utilisation `ud` (exact for this one profile:
 *  the internal agents' readers keep their fpt signatures). */
export const agentFptEq = (fpt: number, tau = 1, ud = U_DECODE) =>
  (fpt * (TOKENS_PER_WORK_HOUR.input / U_PREFILL + (TOKENS_PER_WORK_HOUR.output * tau) / ud)) /
  (TOKENS_PER_WORK_HOUR.input / U_PREFILL + TOKENS_PER_WORK_HOUR.output / U_DECODE);
/** The player's internal agents on version v: its FLOP per token, its reasoning tokens (tokEff) and the lab's decode
 *  utilisation (its serving stack), as an equivalent FLOP per token. */
export const agentFpt = (s: GameStateV2, v: Parameters<typeof flopPerToken>[1] & Parameters<typeof tokEff>[0]) =>
  agentFptEq(flopPerToken(s, v), tokEff(v), decodeUtilNow(s));
/** H100e-hours of serving per human work-hour of agentic work (uncached input at prefill utilisation, output at decode). */
export const h100eHoursPerWorkHour = (fpt: number) =>
  (fpt * (TOKENS_PER_WORK_HOUR.input / U_PREFILL + TOKENS_PER_WORK_HOUR.output / U_DECODE)) / PEAK_FLOPS / 3600;
/** AI FTE per H100e running a version (24/7 against a 2,000-hour human year). */
export const fteOfFpt = (fpt: number) => 8766 / h100eHoursPerWorkHour(fpt) / FTE_HOURS_PER_YEAR;
/** Serial speed of a copy vs a human (its decode tokens/s over the output a human work-hour needs), capped. */
export const speedOfCopy = () => Math.min(SPEED_CAP, (COPY_TOKENS_PER_S * 3600) / TOKENS_PER_WORK_HOUR.output);
/** Copies running on `h100e` of a version: work-hours per hour ÷ serial speed. */
export const copiesOf = (h100e: number, fpt: number) => h100e / h100eHoursPerWorkHour(fpt) / speedOfCopy();
/** $ per H100e-hour today (market rental, else the R11 TCO path's hourly equivalent). */
export function dollarsPerH100eHour(s: GameStateV2): number {
  const r = s.market.rental;
  return r > 0 ? r : (14e3 * Math.pow(0.8, decimalYear(s) - 2025.5)) / 8766;
}
/** AI cost per work-hour of a version ($) and the lab's best engineers' ($: Elite engineering pay over 2,000 hours). */
export function costPerWorkHour(s: GameStateV2, fpt: number): { ai: number; human: number } {
  return { ai: h100eHoursPerWorkHour(fpt) * dollarsPerH100eHour(s), human: (TEAM_COST_M.cap.eng * QUALITY.elite.cost * 1e6) / FTE_HOURS_PER_YEAR };
}

// ───────────────────────────── effective labour ─────────────────────────────

/** Effective labour L_w (team-equivalents) of H human team-equivalents and AI team-equivalents at coverage a, with the
 *  assist speed-up on the human share: the AI Futures coding CES (research/13 §1.3, ρc and λ from the preset). */
export function effLabour(P: Pick<ProdParams, 'rc'>, a: number, H: number, AI: number, assist = 1): number {
  const h = Math.max(1e-12, H * assist);
  if (a <= 1e-9) return h;
  return Lrel({ rc: P.rc } as Pick<ProdParams, 'rc' | 'u' | 'v' | 'rho' | 'zeta' | 'lam'>, Math.min(1, a), h, Math.max(1e-12, AI));
}

// ───────────────────────────── taste ─────────────────────────────

/** Taste of a team (research input per idea vs a Strong team without AI): E[max(T_team, F_AI)] with the team's human
 *  taste z SDs above the lab's average on the AIFM lognormal (mean 1, 99.9th pct = m2b × median), and AI taste sd_AI
 *  lifting it with weight φ (the frontier-research package's cover). */
export function teamTaste(z: number, sdAI: number, phi: number, m2b: number, human = 1): number {
  const s = tasteSigma(m2b);
  const Th = Math.exp(s * z) * human;
  if (phi <= 0) return Th;
  const F = Math.exp(-0.5 * s * s + sdAI * s);
  const zz = z + Math.log(human) / s;
  const lifted = F * Phi(sdAI - zz) + Th * Phi(s - sdAI + zz);
  return (1 - phi) * Th + phi * lifted;
}
/** A team's human taste position (SDs) from its quality. */
export const qualityZ = (q: TeamQuality) => QUALITY_TASTE_SD[q];
/** Lab-wide human taste factor from star hires. */
export const starTaste = (s: GameStateV2) => 1 + STAR_TASTE * (s.player.stars ?? 0);

// ───────────────────────────── the lab's work context (one day) ─────────────────────────────

/** Capabilities work types (workContext) and the safety ones (safetyLabour, model v3 E2). */
export type LabourSlot = 'SWE' | 'EXP' | 'IDEAS' | 'SAF_EXP' | 'SAF_IDEAS';
export interface LabourOf {
  wt: WorkTypeId;
  versionId?: string;
  fit: WorkFit;
  /** Share of the work handed to AI (1 on capabilities work; the Trusted-to-AI policy on safety work) and the share AI
   *  does on its own, A = t × coverage. */
  t: number;
  A: number;
  /** Human team-equivalents in the role (heads ÷ team size × quality) and AI team-equivalents (FTE ÷ team size). */
  H: number;
  AI: number;
  aiFte: number;
  h100e: number;
  copies: number;
  /** Effective labour (team-eq) and its multiplier over the humans (applies to every allocation of the role). */
  L: number;
  m: number;
  /** Humans' share of the labour margin (the CES weight of the human input). */
  wH: number;
}
export type CapSlot = 'SWE' | 'EXP' | 'IDEAS';
export interface WorkContext {
  day: number;
  slots: Record<CapSlot, LabourOf>;
  /** AI research taste (SDs) of the frontier-research model and its cover φ (0 with no frontier agents). */
  sdAI: number;
  phi: number;
}

/** Agent compute (H100e) of a capabilities use, with the AI-labour multipliers of adopted ideas: P05 orchestration ×1.3,
 *  P20 agent societies ×(1 + 0.1·payoff), and the control tax under the AG07 control layer (model v3 E6, Greenblatt et
 *  al. 2023: the usefulness of trusted monitoring with deferral, 93–97% by the gap to the use's trusted monitor). */
function useLabour(s: GameStateV2, slot: LabourSlot): { v?: ModelVersion; h100e: number; mult: number } {
  const p = s.player;
  const off = Number(s.flags['ws4:agentsOffUntil'] ?? -1) > s.time.day;
  const use = slot === 'SWE' ? 'eng' : slot === 'EXP' ? 'capRoutine' : slot === 'IDEAS' ? 'capFrontier' : 'safety'; // SAF_*: the safety package
  const v = agentVersion(s, use);
  let h100e = 0;
  if (!off) {
    if (use === 'safety') h100e = p.computeOnline * p.split.safety * p.agents.safety.compute;
    else h100e = p.computeOnline * p.split.agents * capShare(s, use) + (use === 'capRoutine' ? spareServingToResearch(s) : 0);
  }
  let mult = 1;
  if (adopted(s, 'P05')) mult *= 1.3;
  if (adopted(s, 'P20')) mult *= 1 + 0.1 * payoffOf(s, 'P20');
  mult *= useControl(s, v, monitorVersion(s, use)).usefulness;
  return { v, h100e, mult };
}

/** Research-speed and labour modifiers (as the v2 production function's): a pause of frontier experiments ×0.1, a
 *  verified treaty ×0.65, siloing −5% per level, a custom-ASIC migration −15% (speed); E12 clearances sideline 10% of
 *  staff for 60 days (humans). */
export function researchMods(s: GameStateV2): { speed: number; rateMult: number; humans: number } {
  const p = s.player;
  const day = s.time.day;
  let mods = 1 - 0.05 * p.security.siloing;
  if ((p.finance.ws3.asicMigrationUntil ?? -1) > day) mods *= 0.85;
  let rateMult = 1;
  if (s.flags.paused || ws4r(s).frontierPauseUntil > day) rateMult *= 0.1;
  if (s.gov.treaty === 'verified') rateMult *= 0.65;
  return { speed: mods * rateMult, rateMult, humans: Number(s.flags['ws4:sidelinedUntil'] ?? -1) > day ? 0.9 : 1 };
}

/** Human team-equivalents of a role in the lab. */
export function humansOf(s: GameStateV2, slot: LabourSlot): number {
  let h = 0;
  for (const t of s.player.teams) {
    const q = QUALITY[t.quality].out;
    if (slot === 'SWE' && t.role === 'eng') h += (t.heads / WORK_TYPES.SWE.heads) * q;
    else if (slot === 'EXP' && t.role === 're' && t.dept === 'cap') h += (t.heads / WORK_TYPES.EXP.heads) * q;
    else if (slot === 'IDEAS' && t.role === 'sci' && t.dept === 'cap') h += (t.heads / WORK_TYPES.IDEAS.heads) * q;
    else if (slot === 'SAF_EXP' && t.role === 're' && t.dept === 'saf') h += (t.heads / WORK_TYPES.SAF_EXP.heads) * q;
    // Safety scientists on research-line projects (the work the safety agents can be handed).
    else if (slot === 'SAF_IDEAS' && t.role === 'sci' && t.projectId && onLine(t.projectId)) h += (t.heads / WORK_TYPES.SAF_IDEAS.heads) * q;
  }
  return h * researchMods(s).humans;
}
const onLine = (id: string) => { const n = PROJECT_BY_ID[id]; return !!n && isLineNode(n); };

/** Labour in one capabilities role with explicit agent compute (what-ifs scale it). */
export function labourOf(s: GameStateV2, slot: CapSlot, scale: { h?: number; k?: number } = {}): LabourOf {
  const wt: WorkTypeId = slot;
  const u = useLabour(s, slot);
  const def: WorkTypeDef = WORK_TYPES[wt];
  // V4.3: the lab's built scaffolds and horizon extenders apply to its internal agents (scaffold tokens cost FTE).
  const ifx = internalFx(s, wt);
  const fit = u.v ? workFit(s, u.v, wt, ifx) : { fit: -Infinity, best: 0, med: 0, h50: 0, a: 0, win: 0, assist: 1 };
  const fpt = u.v ? agentFpt(s, u.v) : 1;
  const h100e = u.h100e * (scale.k ?? 1);
  const aiFte = u.v ? (h100e * fteOfFpt(fpt) * u.mult) / ifx.tok : 0;
  const H = humansOf(s, slot) * (scale.h ?? 1);
  const AI = aiFte / def.heads;
  const P = s.hidden.timeline.prod;
  const L = effLabour(P, fit.a, H, AI, fit.assist);
  const hh = Math.max(1e-12, H * fit.assist);
  const wH = fit.a >= 1 - 1e-12 ? 0 : fit.a <= 1e-9 ? 1 : (Math.pow(1 - fit.a, 1 - P.rc) * Math.pow(hh, P.rc)) / Math.pow(L, P.rc);
  return { wt, ...(u.v ? { versionId: u.v.id } : {}), fit, t: 1, A: fit.a, H, AI, aiFte, h100e, copies: u.v ? copiesOf(h100e, fpt) : 0, L, m: H > 1e-12 ? L / H : 0, wH };
}

/** Effective labour when only a share t of the work is handed to AI (model v3 E2: the Trusted-to-AI policy on safety
 *  work). Of the handed work AI does the share it covers on its own (a) and the humans the rest with the assist; the
 *  work not handed is done by humans unassisted. So the AI share is A = t·a and the human share's speed-up is the
 *  time-weighted (Amdahl) mean: (1 − A) ÷ ((1 − t) + t·(1 − a)/assist). At t = 1 this is effLabour exactly (the
 *  capabilities slots' function); at t = 0 the humans alone. Returns L, m = L/H and the humans' share of the margin wH. */
export function handedLabour(P: Pick<ProdParams, 'rc'>, a: number, t: number, H: number, AI: number, assist: number): { L: number; m: number; wH: number; A: number; assist: number } {
  const tt = Math.max(0, Math.min(1, t));
  if (tt <= 0 || H <= 1e-12) return { L: H, m: 1, wH: 1, A: 0, assist: 1 };
  const A = tt * Math.max(0, Math.min(1, a));
  const as = tt >= 1 ? assist : A >= 1 - 1e-12 ? assist : (1 - A) / (1 - tt + (tt * (1 - Math.min(1, a))) / assist);
  const L = effLabour(P, A, H, AI, as);
  const hh = Math.max(1e-12, H * as);
  const wH = A >= 1 - 1e-12 ? 0 : A <= 1e-9 ? 1 : (Math.pow(1 - A, 1 - P.rc) * Math.pow(hh, P.rc)) / Math.pow(L, P.rc);
  return { L, m: L / H, wH, A, assist: as };
}

const ctxMemo = new WeakMap<GameStateV2, WorkContext>();
/** The lab's work context today (memoised per state object and day). */
export function workContext(s: GameStateV2): WorkContext {
  const hit = ctxMemo.get(s);
  if (hit && hit.day === s.time.day) return hit;
  const slots = { SWE: labourOf(s, 'SWE'), EXP: labourOf(s, 'EXP'), IDEAS: labourOf(s, 'IDEAS') };
  const p = s.player;
  const fv = agentVersion(s, 'capFrontier');
  const sdAI = fv ? sdAIOf(s.hidden.timeline, fitOf(s, fv, 'IDEAS') + internalFx(s, 'IDEAS').dG) : -6;
  const on = Number(s.flags['ws4:agentsOffUntil'] ?? -1) <= s.time.day && p.split.agents > 0;
  const phi = on && fv ? Math.min(1, capShare(s, 'capFrontier') / DEFAULT_CAP_SHARES.capFrontier) : 0;
  const out: WorkContext = { day: s.time.day, slots, sdAI, phi };
  ctxMemo.set(s, out);
  return out;
}
/** Drop the memoised context (call after the inputs change within a day). */
export const resetWorkContext = (s: GameStateV2) => ctxMemo.delete(s);

// ───────────────────────────── safety work (model v3 E2) ─────────────────────────────

/** AI labour on safety work: the safety package (its model, its compute on the safety pool) on the two safety work types
 *  through the same functions as capabilities work (MODEL-V3 §6.3, §11.7): coverage from the safety model's SAF_EXP /
 *  SAF_IDEAS fit and horizon, copies and FTE from its compute and FLOP per token, effective labour by the coding CES.
 *  The one difference is the player's policy: Trusted to AI t is the share of safety work handed to the agents
 *  (handedLabour; at t = 1 safety work gets exactly the capabilities multiplier at the same fit). No fleet (no model or
 *  no compute) = nothing handed. The package's compute is spread over the two work types in proportion to the work AI
 *  does in each (A × human team-equivalents) [D]. AI taste on safety ideas: sd_AI from the SAF_IDEAS fit, cover φ = t
 *  while the fleet works on ideas. */
export interface SafetyLabour {
  /** Trusted to AI in effect (0 with no fleet). */
  t: number;
  versionId?: string;
  h100e: number;
  exp: LabourOf;
  ideas: LabourOf;
  sdAI: number;
  phi: number;
}
const safMemo = new WeakMap<GameStateV2, { day: number; x: SafetyLabour }>();
/** Drop the memoised safety labour (the safety allocation's reset calls it: after actions and in the research system). */
export const resetSafetyLabour = (s: GameStateV2) => safMemo.delete(s);
export function safetyLabour(s: GameStateV2): SafetyLabour {
  const hit = safMemo.get(s);
  if (hit && hit.day === s.time.day) return hit.x;
  const u = useLabour(s, 'SAF_EXP');
  const P = s.hidden.timeline.prod;
  const run = !!u.v && u.h100e > 0;
  const t = run ? Math.max(0, Math.min(1, s.player.policies.trustedToAI ?? 0)) : 0;
  const none: WorkFit = { fit: -Infinity, best: 0, med: 0, h50: 0, a: 0, win: 0, assist: 1 };
  const wts = ['SAF_EXP', 'SAF_IDEAS'] as const;
  const fx = wts.map((wt) => internalFx(s, wt));
  const fits = wts.map((wt, i) => (u.v ? workFit(s, u.v, wt, fx[i]) : none));
  const H = wts.map((wt) => humansOf(s, wt));
  const w = wts.map((_, i) => t * fits[i].a * H[i]);
  const wSum = w[0] + w[1];
  const hSum = H[0] + H[1];
  const fpt = u.v ? agentFpt(s, u.v) : 1;
  const slot = (i: number): LabourOf => {
    const wt = wts[i];
    const share = wSum > 0 ? w[i] / wSum : hSum > 0 ? H[i] / hSum : 0.5;
    const h100e = u.h100e * share;
    const aiFte = u.v ? (h100e * fteOfFpt(fpt) * u.mult) / fx[i].tok : 0;
    const AI = aiFte / WORK_TYPES[wt].heads;
    const r = aiFte > 0 ? handedLabour(P, fits[i].a, t, H[i], AI, fits[i].assist) : handedLabour(P, 0, 0, H[i], 0, 1);
    return { wt, ...(u.v ? { versionId: u.v.id } : {}), fit: fits[i], t, A: r.A, H: H[i], AI, aiFte, h100e, copies: u.v ? copiesOf(h100e, fpt) : 0, L: r.L, m: r.m, wH: r.wH };
  };
  const exp = slot(0);
  const ideas = slot(1);
  const sdAI = u.v ? sdAIOf(s.hidden.timeline, fits[1].fit, 'SAF_IDEAS') : -6;
  const x: SafetyLabour = { t, ...(u.v ? { versionId: u.v.id } : {}), h100e: u.h100e, exp, ideas, sdAI, phi: ideas.aiFte > 0 ? t : 0 };
  safMemo.set(s, { day: s.time.day, x });
  return x;
}

// ───────────────────────────── milestones (V3.5) ─────────────────────────────

/** Which work-type milestones a version meets (index as MilestoneIdx: 0 Agent … 6 Superintelligence). */
export function versionMilestones(s: GameStateV2, v: ModelVersion): boolean[] {
  const w = s.hidden.timeline;
  const f = (wt: WorkTypeId) => workFit(s, v, wt);
  const swe = f('SWE');
  const exp = f('EXP');
  const ideas = f('IDEAS');
  const cost = costPerWorkHour(s, flopPerToken(s, v));
  const superhuman = (x: WorkFit) => x.fit >= x.best && x.a >= MILESTONE_COVER;
  const sc = superhuman(swe) && cost.ai < cost.human;
  const sar = sc && superhuman(exp) && superhuman(ideas);
  const siar = sar && ideas.fit >= ideas.best + 2 * w.v3.dBM;
  const asi = siar && COGNITIVE_WORK.every((wt) => { const x = f(wt); return x.fit >= x.best + 2 * w.v3.dBM; });
  return [swe.a >= 0.1, swe.a >= 0.5, exp.a >= 0.5, sc, sar, siar, asi];
}

/** Milestones the lab's live versions meet today (any version meeting it counts). */
export function labMilestones(s: GameStateV2): boolean[] {
  const out = [false, false, false, false, false, false, false];
  for (const v of s.player.models.versions) {
    if (!LIVE(v)) continue;
    const m = versionMilestones(s, v);
    for (let i = 0; i < 7; i++) out[i] ||= m[i];
  }
  return out;
}
