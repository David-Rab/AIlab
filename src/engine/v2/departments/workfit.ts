// Work types: a model's fit, horizon, coverage and assist; AI labour; effective labour; research taste; the work-type
// milestones; the research-speed readout (model v3 V3: design/MODEL-V3.md §6, §8; design/V3-BUILD.md V3.2–V3.5 and "V3
// notes"). Owner: WS1. Data: src/data/v2/workTypes.ts.
//
//   fit        F_w = Σ_d ω_w,d · G_d (OOM; G_d the version's domain effective compute + level offsets ÷ LEVEL_PER_OOM)
//   reference  best human F*_w = G_SC + Δ_bm·Σ ω·REF_DELTA[d]; median expert F*_w − Δ_bm (per preset: TimelineWorld.v3)
//   horizon    h50 = 203 min × 4.2^(G_h − G_V0) × h80Mult (G_h: CODE for software, AGENCY otherwise); p(H) = 1/(1 + (H/h50)^β)
//   coverage   a_w = σ((F_w − θ_w)/s) × p(H_w), θ_w = F*_w − s·ln 19 + κ_v·(0.9 − v_w)
//   assist     win rate w = Φ((F_w − F^med)/S_WIN); human speed-up 1/(M + R + (1 − w)) when > 1 (GDPval)
//   AI labour  FTE = compute × 8766 h ÷ (H100e-hours per work-hour) ÷ 2000 h; H100e-hours per work-hour = 2·N_active ×
//              (200k uncached input ÷ 0.35 + 40k output ÷ 0.07) ÷ 1e15 ÷ 3600 (physical: FLOP per token, utilisation)
//   labour     L_w = [(1 − a)^(1−ρc)·(H·assist)^ρc + a^(1−ρc)·AI^ρc]^(1/ρc) (AI Futures coding CES); m_w = L_w / H multiplies
//              every allocation of the role's teams (agents add capacity to the same allocations, MODEL-V3 §5.6)
//   taste      sd_AI = 3.09·(F_IDEAS − F^med_IDEAS)/Δ_bm; a team's taste E[max(T_team, F_AI)] on the AIFM distribution
// Nothing here reads pm, the level bridge, the knot tables or a reference path.
import {
  ASSIST, COGNITIVE_WORK, COPY_TOKENS_PER_S, COVER, FTE_HOURS_PER_YEAR, H80_OVER_H50, HORIZON_BETA,
  LEVEL_PER_OOM, MILESTONE_COVER, PEAK_FLOPS, QUALITY_TASTE_SD, REF_DELTA, SPEED_CAP, STAR_TASTE, S_WIN, TOKENS_PER_WORK_HOUR, TOP_SD,
  U_DECODE, U_PREFILL, WORK_TYPES, type WorkTypeDef, type WorkTypeId,
} from '../../../data/v2/workTypes';
import { RSCH_TASTE_PENALTY } from '../../../data/v2/calibration';
import { B0_PARAMS, SHAPE } from '../../../data/v2/runDesign';
import { DEFAULT_CAP_SHARES } from '../../../data/v2/agents';
import { QUALITY, TEAM_COST_M } from '../../../data/v2/teams';
import { Lrel, Phi, tasteSigma } from '../production/knots';
import { gOfDomain, gOfPm, h50Of } from '../models/capability';
import { adopted } from '../models/paradigms';
import { payoffOf } from '../models/tree';
import { decimalYear } from '../core/time';
import { spareServingToResearch } from '../worldfx/revenue';
import { ws4r } from '../actors/state';
import { agentVersion, capShare } from './agents';
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
export function refPoints(w: TimelineWorld, wt: WorkTypeId): { best: number; med: number } {
  let delta = 0;
  for (const [d, x] of Object.entries(WORK_TYPES[wt].w) as [DomainId, number][]) delta += x * REF_DELTA[d];
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
export function workFit(s: GameStateV2, v: Pick<ModelVersion, 'pm' | 'build'>, wt: WorkTypeId): WorkFit {
  const w = s.hidden.timeline;
  const fit = fitOf(s, v, wt);
  const r = refPoints(w, wt);
  const h50 = h50Min(s, v, wt);
  const win = winRate(w, wt, fit);
  return { fit, best: r.best, med: r.med, h50, a: coverage(w, wt, fit, h50), win, assist: assistOf(win) };
}

/** AI research taste in human SDs above the median (AIFM): 3.09·(F_IDEAS − F^med)/Δ_bm. */
export const sdAIOf = (w: TimelineWorld, fitIdeas: number) => (TOP_SD * (fitIdeas - refPoints(w, 'IDEAS').med)) / w.v3.dBM;

// ───────────────────────────── AI labour (physical) ─────────────────────────────

/** Serving FLOP per token of a version: 2·N_active × the shape's token multiplier × its serving efficiency relative to
 *  its base (the serving stack and distillation; MODEL-V3 §7.3). */
export function flopPerToken(s: GameStateV2, v: Pick<ModelVersion, 'baseId' | 'serveCost' | 'params'>): number {
  const b = s.player.models.bases.find((x) => x.id === v.baseId);
  if (!b) return 2 * (v.params ?? B0_PARAMS);
  const rel = b.serve && b.serve > 0 ? v.serveCost / b.serve : 1;
  return 2 * b.params * SHAPE[b.design.shape].tokenMult * rel;
}
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
function dollarsPerH100eHour(s: GameStateV2): number {
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

export type LabourSlot = 'SWE' | 'EXP' | 'IDEAS' | 'SAF_EXP';
export interface LabourOf {
  wt: WorkTypeId;
  versionId?: string;
  fit: WorkFit;
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
export interface WorkContext {
  day: number;
  slots: Record<LabourSlot, LabourOf>;
  /** AI research taste (SDs) of the frontier-research model and its cover φ (0 with no frontier agents). */
  sdAI: number;
  phi: number;
}

/** Agent compute (H100e) of a capabilities use, with the AI-labour multipliers of adopted ideas: P05 orchestration ×1.3,
 *  P20 agent societies ×(1 + 0.1·payoff), the AG07 control layer's 5% tax. */
function useLabour(s: GameStateV2, slot: LabourSlot): { v?: ModelVersion; h100e: number; mult: number } {
  const p = s.player;
  const off = Number(s.flags['ws4:agentsOffUntil'] ?? -1) > s.time.day;
  const use = slot === 'SWE' ? 'eng' : slot === 'EXP' ? 'capRoutine' : slot === 'IDEAS' ? 'capFrontier' : 'safety';
  const v = agentVersion(s, use);
  let h100e = 0;
  if (!off) {
    if (use === 'safety') h100e = p.computeOnline * p.split.safety * p.agents.safety.compute;
    else h100e = p.computeOnline * p.split.agents * capShare(s, use) + (use === 'capRoutine' ? spareServingToResearch(s) : 0);
  }
  let mult = 1;
  if (adopted(s, 'P05')) mult *= 1.3;
  if (adopted(s, 'P20')) mult *= 1 + 0.1 * payoffOf(s, 'P20');
  if (p.deployments.some((d) => d.channel === 'internal' && d.status === 'live' && d.controlLayer)) mult *= 0.95;
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
  }
  return h * researchMods(s).humans;
}

const SLOT_WT: Record<LabourSlot, WorkTypeId> = { SWE: 'SWE', EXP: 'EXP', IDEAS: 'IDEAS', SAF_EXP: 'SAF_EXP' };

/** Labour in one role with explicit agent compute (what-ifs scale it). */
export function labourOf(s: GameStateV2, slot: LabourSlot, scale: { h?: number; k?: number } = {}): LabourOf {
  const wt = SLOT_WT[slot];
  const u = useLabour(s, slot);
  const def: WorkTypeDef = WORK_TYPES[wt];
  const fit = u.v ? workFit(s, u.v, wt) : { fit: -Infinity, best: 0, med: 0, h50: 0, a: 0, win: 0, assist: 1 };
  const fpt = u.v ? flopPerToken(s, u.v) : 1;
  const h100e = u.h100e * (scale.k ?? 1);
  const aiFte = u.v ? h100e * fteOfFpt(fpt) * u.mult : 0;
  const H = humansOf(s, slot) * (scale.h ?? 1);
  const AI = aiFte / def.heads;
  const P = s.hidden.timeline.prod;
  const L = effLabour(P, fit.a, H, AI, fit.assist);
  const hh = Math.max(1e-12, H * fit.assist);
  const wH = fit.a >= 1 - 1e-12 ? 0 : fit.a <= 1e-9 ? 1 : (Math.pow(1 - fit.a, 1 - P.rc) * Math.pow(hh, P.rc)) / Math.pow(L, P.rc);
  return { wt, ...(u.v ? { versionId: u.v.id } : {}), fit, H, AI, aiFte, h100e, copies: u.v ? copiesOf(h100e, fpt) : 0, L, m: H > 1e-12 ? L / H : 0, wH };
}

const ctxMemo = new WeakMap<GameStateV2, WorkContext>();
/** The lab's work context today (memoised per state object and day). */
export function workContext(s: GameStateV2): WorkContext {
  const hit = ctxMemo.get(s);
  if (hit && hit.day === s.time.day) return hit;
  const slots = { SWE: labourOf(s, 'SWE'), EXP: labourOf(s, 'EXP'), IDEAS: labourOf(s, 'IDEAS'), SAF_EXP: labourOf(s, 'SAF_EXP') };
  const p = s.player;
  const fv = agentVersion(s, 'capFrontier');
  const sdAI = fv ? sdAIOf(s.hidden.timeline, fitOf(s, fv, 'IDEAS')) : -6;
  const on = Number(s.flags['ws4:agentsOffUntil'] ?? -1) <= s.time.day && p.split.agents > 0;
  const phi = on && fv ? Math.min(1, capShare(s, 'capFrontier') / DEFAULT_CAP_SHARES.capFrontier) : 0;
  const out: WorkContext = { day: s.time.day, slots, sdAI, phi };
  ctxMemo.set(s, out);
  return out;
}
/** Drop the memoised context (call after the inputs change within a day). */
export const resetWorkContext = (s: GameStateV2) => ctxMemo.delete(s);

/** Effective AI labour per H100e for safety work (SAF_EXP) of a version: FTE per H100e × coverage. Feeds the safety
 *  agent fleet until V6 moves safety onto work types (BRIDGE(V6)). */
export function safetyFtePerH100e(s: GameStateV2, v: ModelVersion): number {
  return fteOfFpt(flopPerToken(s, v)) * workFit(s, v, 'SAF_EXP').a;
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
