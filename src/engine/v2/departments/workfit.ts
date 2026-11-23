// Work types: a model's fit, horizon, coverage and assist; AI labour; effective labour; research taste; the work-type
// milestones; the research-speed readout (model v3 V3: design/MODEL-V3.md §6, §8; design/V3-BUILD.md V3.2–V3.5 and "V3
// notes"). Owner: WS1. Data: src/data/v2/workTypes.ts.
//
//   fit        F_w = Σ_d ω_w,d · G_d (OOM; G_d the version's domain effective compute, design offsets included)
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
  ASSIST, COGNITIVE_WORK, COPY_TOKENS_PER_S, COVER, FTE_HOURS_PER_YEAR, HORIZON_BETA,
  MILESTONE_COVER, PEAK_FLOPS, QUALITY_TASTE_SD, refDelta, SPEED_CAP, S_WIN, TOKENS_PER_WORK_HOUR, TOP_SD,
  U_DECODE, U_PREFILL, WORK_TYPES, type WorkTypeDef, type WorkTypeId,
} from '../../../data/v2/workTypes';
import { AG17_HARNESS, P27_AAR } from '../../../data/v2/safetyIdeas';
import { LINE_MULT_MAX, SERIOUS_CAP } from '../../../data/v2/agendas';
import { QUALITY, starTasteOf, TEAM_COST_M } from '../../../data/v2/teams';
import { PROJECT_BY_ID, isLineNode } from '../../../data/v2/tree';
import { teamCapacity } from './capacity';
import { Lrel, Phi, tasteSigma } from '../production/ces';
import { h50Of, versionDomainG } from '../models/capability';
import { adopted } from '../models/paradigms';
import { REF_RL_PROFILE } from '../models/effective';
import { decimalYear } from '../core/time';
import { internalFx, tokEff } from '../worldfx/serving';
import { decodeUtilNow } from '../models/stacks';
import { ws4r } from '../actors/state';
import { agentSplitShare, agentVersion, monitorVersion } from './agents';
import { useControl } from '../safety/oversight';
import type { DomainId, GameStateV2, ModelVersion, ProdParams, TeamQuality, TimelineWorld, VersionBuild } from '../types';

const LIVE = (v: ModelVersion) => v.status !== 'retired' && v.status !== 'rolledBack';
const sig = (x: number) => 1 / (1 + Math.exp(-x));

// ───────────────────────────── fit and reference points ─────────────────────────────

/** A version's effective compute in domain d for work (OOM): its domain G (MODEL-V3 §2.3; design offsets included, in
 *  OOM since RD-U01; RD-E01a deleted P19's RSCH gain). A version without a build (an imported open model, a rival's
 *  model) reads its general G. The displayed domain level is λ of this same G (models/capability.ts versionDomainG,
 *  domainsOf). */
export const domainG = (_s: GameStateV2, v: Pick<ModelVersion, 'G' | 'build'>, d: DomainId): number => versionDomainG(v, d);

/** Fit F_w of a version in work type w (OOM of effective compute). */
export function fitOf(s: GameStateV2, v: Pick<ModelVersion, 'G' | 'build'>, wt: WorkTypeId): number {
  let f = 0;
  // P4: for-in over the weights (Object.entries' order, read live: harnesses swap WORK_TYPES entries) without the array.
  const ws = WORK_TYPES[wt].w as Record<DomainId, number>;
  for (const d in ws) f += ws[d as DomainId] * domainG(s, v, d as DomainId);
  return f;
}

/** Human reference points of a work type in world w: the best human in the world and the median expert (OOM). */
const deltaMemo = new WeakMap<TimelineWorld['v3'], Record<DomainId, number>>();
export function refPoints(w: TimelineWorld, wt: WorkTypeId): { best: number; med: number } {
  let rd = deltaMemo.get(w.v3);
  if (!rd) deltaMemo.set(w.v3, (rd = refDelta(w.v3.sdSC)));
  let delta = 0;
  const ws = WORK_TYPES[wt].w as Record<DomainId, number>;
  for (const d in ws) delta += ws[d as DomainId] * rd[d as DomainId]; // P4: as fitOf
  const best = w.v3.gSC + w.v3.dBM * delta;
  return { best, med: best - w.v3.dBM };
}

// ───────────────────────────── horizon, coverage, assist ─────────────────────────────

/** 50% time horizon (minutes) of a version in a work type: METR's 203 min for V0 × 4.2 per OOM of the horizon domain's
 *  effective compute over V0's, × the version's horizon multiplier (long-horizon RL, P07, P12). */
export const h50Min = (s: GameStateV2, v: Pick<ModelVersion, 'G' | 'build'>, wt: WorkTypeId = 'EXP') => h50Of(s.hidden.timeline, v, WORK_TYPES[wt].horizon);
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

/** A work fit moved by dG OOM at the same horizon (a per-line effect on top of the package's fit, model v3 E14 F44). */
export function shiftFit(w: TimelineWorld, wt: WorkTypeId, f: WorkFit, dG: number): WorkFit {
  if (!dG) return f;
  const fit = f.fit + dG;
  const win = winRate(w, wt, fit);
  return { ...f, fit, win, a: coverage(w, wt, fit, f.h50), assist: assistOf(win) };
}

/** Fit, horizon and coverage of a version in a work type. */
export interface WorkFit { fit: number; best: number; med: number; h50: number; a: number; win: number; assist: number }
/** Fit with the typed feature effects of a deployment (V4.3: scaffolds add ΔG, horizon extenders × h50); milestones read
 *  the model alone. */
export function workFit(s: GameStateV2, v: Pick<ModelVersion, 'G' | 'build'>, wt: WorkTypeId, fx?: { dG: number; hMult: number }): WorkFit {
  return workFitW(s.hidden.timeline, v, wt, fx);
}
/** workFit in world `w` (the same expressions; the state is read only for its world). RD-X03: a rival's aggregate
 *  research reads its model's work fit through this, on the model's reference-profile build (actors/rivalModel.ts). */
export function workFitW(w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>, wt: WorkTypeId, fx?: { dG: number; hMult: number }): WorkFit {
  let f0 = 0;
  const ws = WORK_TYPES[wt].w as Record<DomainId, number>;
  for (const d in ws) f0 += ws[d as DomainId] * versionDomainG(v, d as DomainId); // as fitOf (domainG)
  const fit = f0 + (fx?.dG ?? 0);
  const r = refPoints(w, wt);
  const h50 = h50Of(w, v, WORK_TYPES[wt].horizon) * (fx?.hMult ?? 1);
  const win = winRate(w, wt, fit);
  return { fit, best: r.best, med: r.med, h50, a: coverage(w, wt, fit, h50), win, assist: assistOf(win) };
}

/** AI research taste in human SDs above the median (AIFM): 3.09·(F_w − F^med_w)/Δ_bm, on research ideas (IDEAS) or
 *  safety research ideas (SAF_IDEAS: the same domains, so the same reference points). */
export const sdAIOf = (w: TimelineWorld, fitIdeas: number, wt: WorkTypeId = 'IDEAS') => (TOP_SD * (fitIdeas - refPoints(w, wt).med)) / w.v3.dBM;

// ───────────────────────────── AI labour (physical) ─────────────────────────────

/** Serving FLOP per token of a version (ModelVersion.fpt, set when it is made): 2·N_active × the shape's token
 *  multiplier × the serving stack and design at creation (MODEL-V3 §7.3). */
export const flopPerToken = (_s: GameStateV2, v: Pick<ModelVersion, 'fpt'>): number => v.fpt;
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

/** AI's share of a slot's ideas (RD-E02, DD-13 "one ideas channel"): the share of the effective labour L above what the
 *  humans (with their assist) make alone, s = max(0, 1 − H·assist ÷ L). 0 with no AI labour (L ≤ H·assist), rising with
 *  AI FTE and saturating, for fixed coverage A, at 1 − (1 − A)^((1 − ρc)/(−ρc)) (→ 1 as A → 1). Not the CES margin share
 *  1 − wH: with ρc < 0 (complements) that is ~1 at near-zero AI (AI the bottleneck) and falls to 0 as AI grows. */
export function aiIdeasShare(H: number, assist: number, L: number): number {
  const hh = H * assist;
  return L > 1e-12 && L > hh ? Math.min(1, 1 - hh / L) : 0;
}

/** Taste of a team (research input per idea vs a Strong team without AI): E[max(T_team, F_AI)] with the team's human
 *  taste z SDs above the lab's average on the AIFM lognormal (mean 1, 99.9th pct = m2b × median), and AI taste sd_AI
 *  on the AI-done share sAI of the ideas (aiIdeasShare): (1 − s)·human + s·E[max(human, AI)] (DD-13). */
export function teamTaste(z: number, sdAI: number, sAI: number, m2b: number, human = 1): number {
  const s = tasteSigma(m2b);
  const Th = Math.exp(s * z) * human;
  if (sAI <= 0) return Th;
  const F = Math.exp(-0.5 * s * s + sdAI * s);
  const zz = z + Math.log(human) / s;
  const lifted = F * Phi(sdAI - zz) + Th * Phi(s - sdAI + zz);
  return (1 - sAI) * Th + sAI * lifted;
}
/** A team's human taste position (SDs) from its quality. */
export const qualityZ = (q: TeamQuality) => QUALITY_TASTE_SD[q];
/** Lab-wide human taste factor from star hires (data/v2/teams.ts starTasteOf). */
export const starTaste = (s: GameStateV2) => starTasteOf(s.player.stars ?? 0);

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
  /** AI's share of the slot's output (aiIdeasShare; on the ideas slots the weight of AI taste, DD-13). */
  sAI: number;
}
export type CapSlot = 'SWE' | 'EXP' | 'IDEAS';
export interface WorkContext {
  day: number;
  slots: Record<CapSlot, LabourOf>;
  /** AI research taste (SDs) of the frontier-research model and AI's share of the ideas (slots.IDEAS.sAI, DD-13). */
  sdAI: number;
  sAI: number;
}

/** Agent compute (H100e) of a use and the control tax under the AG07 control layer (model v3 E6, Greenblatt et al. 2023:
 *  the usefulness of trusted monitoring with deferral, 93–97% by the gap to the use's trusted monitor). RD-E01b: no
 *  flat paradigm multipliers; P05 orchestration is a typed scaffold (internalFx), P20 is deleted. */
function useLabour(s: GameStateV2, slot: LabourSlot): { v?: ModelVersion; h100e: number; mult: number } {
  const p = s.player;
  const off = Number(s.flags['ws4:agentsOffUntil'] ?? -1) > s.time.day;
  const use = slot === 'SWE' ? 'eng' : slot === 'EXP' ? 'capRoutine' : slot === 'IDEAS' ? 'capFrontier' : 'safety'; // SAF_*: the safety package
  const v = agentVersion(s, use);
  let h100e = 0;
  if (!off) {
    h100e = p.computeOnline * agentSplitShare(s, use);
  }
  const mult = useControl(s, v, monitorVersion(s, use), !!p.agents[use].control).usefulness;
  return { v, h100e, mult };
}

/** RD-A07: the research modifiers as the physical thing each stands for; one helper read by both departments
 *  (capability: models/research.ts, safety: safety/lineProjects.ts, the lab readout: production/production.ts).
 *  - frontierExp: the share of its experiment FLOP a frontier project may use. A frontier pause (flags.paused or the
 *    ws4 frontierPauseUntil) = 0 while it lasts: frontier projects are the capability department's ('cap'), whose tests
 *    run on the frontier experiment pool and scale toward the frontier run. Ideation (science teams) goes on; safety
 *    research-line projects (agenda-sized compute, far below frontier scale) keep their FLOP.
 *  - speed: the [D] multipliers with no physical counterpart modelled, on both departments' science and experiment
 *    rates. Siloing −5% per level [D: compartmentalisation friction; who cannot share experiments is not modelled];
 *    a custom-ASIC migration −15% [D: toolchain and kernel porting churn; the port itself is not modelled]; a verified
 *    treaty ×0.65 [D: the treaty state (gov.treaty) carries no compute limit to cap experiment FLOP with] (= rateMult).
 *  - sidelined: E12 security clearances take SIDELINE_SHARE of every team's heads off the teams for their 60 days
 *    (onDuty: capacity, not a speed factor). */
export const SIDELINE_SHARE = 0.1;
export interface ResearchMods { speed: number; rateMult: number; frontierExp: number; sidelined: number }
export function researchMods(s: GameStateV2): ResearchMods {
  const p = s.player;
  const day = s.time.day;
  let mods = 1 - 0.05 * p.security.siloing;
  if ((p.finance.ws3.asicMigrationUntil ?? -1) > day) mods *= 0.85;
  const rateMult = s.gov.treaty === 'verified' ? 0.65 : 1;
  const frontierExp = s.flags.paused || ws4r(s).frontierPauseUntil > day ? 0 : 1;
  const sidelined = Number(s.flags['ws4:sidelinedUntil'] ?? -1) > day ? SIDELINE_SHARE : 0;
  return { speed: mods * rateMult, rateMult, frontierExp, sidelined };
}
/** Experiment FLOP a project of department `dept` may use out of `flop` (RD-A07: a frontier pause stops the
 *  capability department's). */
export const expFlopAllowed = (s: GameStateV2, dept: 'cap' | 'saf', flop: number) => (dept === 'cap' ? flop * researchMods(s).frontierExp : flop);
/** A team as it works today: its heads less those sidelined by clearances (RD-A07; heads, rounded per team). */
export function onDuty<T extends { heads: number }>(s: GameStateV2, t: T): T {
  const sl = researchMods(s).sidelined;
  return sl > 0 ? { ...t, heads: t.heads - Math.round(t.heads * sl) } : t;
}

/** Human team-equivalents of a role in the lab. */
export function humansOf(s: GameStateV2, slot: LabourSlot): number {
  let h = 0;
  for (const t0 of s.player.teams) {
    const t = onDuty(s, t0);
    const q = QUALITY[t.quality].out;
    if (slot === 'SWE' && t.role === 'eng') h += (t.heads / WORK_TYPES.SWE.heads) * q;
    else if (slot === 'EXP' && t.role === 're' && t.dept === 'cap') h += (t.heads / WORK_TYPES.EXP.heads) * q;
    else if (slot === 'IDEAS' && t.role === 'sci' && t.dept === 'cap') h += (t.heads / WORK_TYPES.IDEAS.heads) * q;
    else if (slot === 'SAF_EXP' && t.role === 're' && t.dept === 'saf') h += (t.heads / WORK_TYPES.SAF_EXP.heads) * q;
    // Safety scientists on research-line projects (the work the safety agents can be handed).
    else if (slot === 'SAF_IDEAS' && t.role === 'sci' && t.projectId && onLine(t.projectId)) h += (t.heads / WORK_TYPES.SAF_IDEAS.heads) * q;
  }
  return h;
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
  return { wt, ...(u.v ? { versionId: u.v.id } : {}), fit, t: 1, A: fit.a, H, AI, aiFte, h100e, copies: u.v ? copiesOf(h100e, fpt) : 0, L, m: H > 1e-12 ? L / H : 0, wH, sAI: aiFte > 0 ? aiIdeasShare(H, fit.assist, L) : 0 };
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
  const fv = agentVersion(s, 'capFrontier');
  const sdAI = fv ? sdAIOf(s.hidden.timeline, fitOf(s, fv, 'IDEAS') + internalFx(s, 'IDEAS').dG) : -6;
  // RD-E02 (DD-13): AI taste weighs by AI's share of the ideas labour (0 with the agents off or no frontier compute).
  const out: WorkContext = { day: s.time.day, slots, sdAI, sAI: slots.IDEAS.sAI };
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
 *  does in each (A × human team-equivalents) [D]. AI taste on safety ideas: sd_AI from the SAF_IDEAS fit, weighted by AI's
 *  share of the SAF_IDEAS labour (aiIdeasShare, DD-13; 0 at Trusted to AI 0). P27 adds its AAR scaffold's fit (+0.3 OOM on SAF_EXP and SAF_IDEAS) and AG17's science
 *  teams their harness (+0.3 OOM × √(capacity ÷ SERIOUS_CAP); model v3 E14), data/v2/safetyIdeas.ts. */
export interface SafetyLabour {
  /** Trusted to AI in effect (0 with no fleet). */
  t: number;
  versionId?: string;
  h100e: number;
  exp: LabourOf;
  ideas: LabourOf;
  sdAI: number;
  /** AI's share of the safety ideas (ideas.sAI): the weight of AI taste (DD-13). */
  sAI: number;
}
/** AG17's science capacity (standard science units, departments/capacity.ts teamCapacity) on its
 *  research-line projects. */
export function ag17Capacity(s: GameStateV2): number {
  let c = 0;
  for (const t of s.player.teams) {
    const n = t.role === 'sci' && t.projectId ? PROJECT_BY_ID[t.projectId] : undefined;
    if (n && n.agenda === 'AG17' && isLineNode(n)) c += teamCapacity(t, n.column);
  }
  return c;
}
/** AG17's harness on the safety package (OOM of SAF_EXP / SAF_IDEAS fit): fitOom × √(min(LINE_MULT_MAX, capacity ÷
 *  SERIOUS_CAP)) (model v3 E14; data/v2/safetyIdeas.ts AG17_HARNESS). */
export const ag17HarnessOom = (s: GameStateV2) => AG17_HARNESS.fitOom * Math.sqrt(Math.min(LINE_MULT_MAX, ag17Capacity(s) / SERIOUS_CAP));
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
  // P27 (automated alignment research at scale, model v3 E13): the AAR harness is a research scaffold on safety work.
  // AG17's science teams run the harness (model v3 E14): a scaffold whose fit grows with their capacity.
  const aar = (adopted(s, 'P27') ? P27_AAR.fitOom : 0) + ag17HarnessOom(s);
  const fx = wts.map((wt) => { const f = internalFx(s, wt); return aar ? { ...f, dG: f.dG + aar } : f; });
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
    return { wt, ...(u.v ? { versionId: u.v.id } : {}), fit: fits[i], t, A: r.A, H: H[i], AI, aiFte, h100e, copies: u.v ? copiesOf(h100e, fpt) : 0, L: r.L, m: r.m, wH: r.wH, sAI: aiFte > 0 && r.A > 0 ? aiIdeasShare(H[i], r.assist, r.L) : 0 };
  };
  const exp = slot(0);
  const ideas = slot(1);
  const sdAI = u.v ? sdAIOf(s.hidden.timeline, fits[1].fit, 'SAF_IDEAS') : -6;
  const x: SafetyLabour = { t, ...(u.v ? { versionId: u.v.id } : {}), h100e: u.h100e, exp, ideas, sdAI, sAI: ideas.sAI };
  safMemo.set(s, { day: s.time.day, x });
  return x;
}

// ───────────────────────────── milestones (V3.5; DD-09, RD-L04) ─────────────────────────────

/** THE milestone predicate (DD-09: one definition for every lab; the display level's knots are not thresholds). Which
 *  work-type milestones a model meets (index as MilestoneIdx: 0 Agent … 6 Superintelligence), from its fit and
 *  coverage against the best human and its AI cost per work-hour at serving FLOP per token `fpt`:
 *  Agent = SWE coverage ≥ 0.1; Reliable agent = SWE coverage ≥ 0.5; Research agent = EXP coverage ≥ 0.5;
 *  SC = SWE fit ≥ the best human with coverage ≥ 0.9 and AI cheaper than the lab's best engineers per work-hour;
 *  SAR = SC and EXP and IDEAS likewise; SIAR = SAR and IDEAS 2·Δ_bm past the best human; ASI = SIAR and every cognitive
 *  work type 2·Δ_bm past. The player's versions read it on their builds (versionMilestones), every other lab on a
 *  reference-profile build of its model (referenceProfileModel; models/capability.ts otherLabMilestones). */
export function milestonesOf(s: GameStateV2, v: Pick<ModelVersion, 'G' | 'build'>, fpt: number): boolean[] {
  const w = s.hidden.timeline;
  const f = (wt: WorkTypeId) => workFit(s, v, wt);
  const swe = f('SWE');
  const exp = f('EXP');
  const ideas = f('IDEAS');
  const cost = costPerWorkHour(s, fpt);
  const superhuman = (x: WorkFit) => x.fit >= x.best && x.a >= MILESTONE_COVER;
  const sc = superhuman(swe) && cost.ai < cost.human;
  const sar = sc && superhuman(exp) && superhuman(ideas);
  const siar = sar && ideas.fit >= ideas.best + 2 * w.v3.dBM;
  const asi = siar && COGNITIVE_WORK.every((wt) => { const x = f(wt); return x.fit >= x.best + 2 * w.v3.dBM; });
  return [swe.a >= 0.1, swe.a >= 0.5, exp.a >= 0.5, sc, sar, siar, asi];
}

/** Which work-type milestones a player version meets (the predicate on its own build and serving FLOP per token). */
export const versionMilestones = (s: GameStateV2, v: ModelVersion): boolean[] => milestonesOf(s, v, flopPerToken(s, v));

/** A model known only by its general G (a rival's or China's aggregate model) as a version for the milestone predicate
 *  (RD-L04): its G with the reference RL profile (every domain's RL gain = the reference run's, so each domain reads
 *  G_pre + 0 = G, gOfDomain), no data or design specialisation, horizon multiplier 1. RD-X03: a rival model made by
 *  its training carries its own reference-profile build (actors/rivalModel.ts rivalVersionBuild); this is the fallback
 *  for a model known by G alone. */
export function referenceProfileModel(G: number, flopPre = 0): Pick<ModelVersion, 'G' | 'build'> {
  const build: VersionBuild = {
    gPre: G, flopPre, rlFlop: 0, rlW: {}, eRL: 0, dgRL: 0, dgRLd: { ...REF_RL_PROFILE }, dg: 0, sD: {}, dgD: {}, h80Mult: 1, signals: {},
  };
  return { G, build };
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
