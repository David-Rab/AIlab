// Capability: the display level λ(G) (one map for every lab), domains, horizons, milestones, true lead (V2-SPEC
// §3.1.3–3.1.6; model v3 V1, V3b, F3: design/MODEL-V3.md §2, design/V3-BUILD.md). Owner: WS1. Every lab's capability is its
// effective compute G; model v3 F3 retired the progress coordinate pm = Φ(G) and the know-how readout pa.
import { LEVEL_KNOTS, DOMAIN_IDS, PRESET_BY_LABEL, START_STATE } from '../../../data/v2/calibration';
import { PRE_GAME_G_PER_YEAR, RL_BUDGET } from '../../../data/v2/runDesign';
import { COGNITIVE_WORK, H50_PER_OOM, H50_V0_MIN, SKILL_TESTS, SKILL_TEST_CODE, WORK_TYPES, refDelta, skillRefDelta } from '../../../data/v2/workTypes';
import { FRAMEWORK_HIGH_L } from '../../../data/v2/framework';
import { labMilestones, milestonesOf, referenceProfileModel } from '../departments/workfit';
import { clamp } from '../../rng';
import { START_DATE, decimalYearOf } from '../core/time';
import { rivalServeFpt } from '../actors/rivalModel';
import type { BaseDesign, Day, DomainId, EngineSystem, GameStateV2, LabId, MilestoneIdx, ModelVersion, RivalLab, TimelineWorld, VersionBuild } from '../types';
import { PLAYER_ID, bestG, labCore, otherLabs } from './labs';
import { REF_RL_PROFILE, gPreOf, rlFamiliesAvailable, rlGains, rlWeights } from './effective';

/** In-game milestone names (no canon tags, §3.1.6). */
export const MILESTONE_NAMES = ['Agent', 'Reliable agent', 'Research agent', 'Superhuman coder', 'Superhuman AI researcher', 'Superintelligent AI researcher', 'Superintelligence'];

// ───────────────────────────── display level λ(G) (model v3 V3b) ─────────────────────────────

/** Reference-recipe effective compute of the level knots (OOM): V0 (the 2025 start, L 5) and the points where a model
 *  with the reference recipe meets the work-type milestones: SC (SWE at the best human), SAR (IDEAS at the best human;
 *  EXP is below it), SIAR (IDEAS 2·Δ_bm beyond), ASI (every cognitive work type 2·Δ_bm beyond: OTHER binds). */
const knotMemo = new WeakMap<TimelineWorld, number[]>();
export function levelKnotsG(w: TimelineWorld): number[] {
  const hit = knotMemo.get(w);
  if (hit) return hit;
  const rd = refDelta(w.v3.sdSC);
  const best = (wt: keyof typeof WORK_TYPES) => {
    let d = 0;
    for (const [dom, x] of Object.entries(WORK_TYPES[wt].w) as [DomainId, number][]) d += x * rd[dom];
    return w.v3.gSC + w.v3.dBM * d;
  };
  const ideas = Math.max(best('IDEAS'), best('EXP'));
  const asi = Math.max(...COGNITIVE_WORK.map((wt) => best(wt))) + 2 * w.v3.dBM;
  const g = [gV0(w), w.v3.gSC, ideas, best('IDEAS') + 2 * w.v3.dBM, Math.max(asi, best('IDEAS') + 2 * w.v3.dBM + 1e-3)];
  knotMemo.set(w, g);
  return g;
}
/** Level knots (V0 L 5; SC 10, SAR 12, SIAR 13.5, ASI 15 = v2's LEVEL_KNOTS at those milestones). */
const LEVEL_AT = [LEVEL_KNOTS[0], LEVEL_KNOTS[3], LEVEL_KNOTS[4], LEVEL_KNOTS[5], LEVEL_KNOTS[6]];
/** Display level λ(G): piecewise linear in effective compute through the knots (Epoch's capability index is close to
 *  linear in log compute between them), below V0 at the first slope (≥ 0), capped at 15. */
export function levelOfG(w: TimelineWorld, G: number): number {
  const g = levelKnotsG(w);
  if (G <= g[0]) return Math.max(0, LEVEL_AT[0] + ((LEVEL_AT[1] - LEVEL_AT[0]) / Math.max(1e-9, g[1] - g[0])) * (G - g[0]));
  for (let i = 0; i < g.length - 1; i++) if (G < g[i + 1]) return LEVEL_AT[i] + ((LEVEL_AT[i + 1] - LEVEL_AT[i]) * (G - g[i])) / Math.max(1e-9, g[i + 1] - g[i]);
  return LEVEL_AT[LEVEL_AT.length - 1];
}
/** CAL2-S: the median expert's score in world w, λ(G_SC − Δ_bm) (RD-U05: the same on the general scale and on every
 *  domain score, since each domain's median expert sits Δ_bm below its best human). ai2027 6.39, authors2026 8.02,
 *  slow 9.24, fast 9.18 at the CAL-T presets (scripts/v2/_cals/medexp.ts). Read by the framework's default High rules (decision 11); the RL
 *  graders (CP3h(a), decision 9) read the same point as effective compute, G_SC − Δ_bm. */
export const medianExpertLevel = (w: TimelineWorld): number => levelOfG(w, w.v3.gSC - w.v3.dBM);

/** UB-1: the public marks of one skill bar (MODELS / TRAINING): the median expert and the best human on the domain score,
 *  and the published test behind the domain's reference. Public facts only: the best human is 10 by the scale's
 *  definition; the median expert is the reference world's (FRAMEWORK_HIGH_L, ai2027 6.39 → 6.4), not this world's hidden
 *  λ(G_SC − Δ_bm) (medianExpertLevel), since G_SC and Δ_bm are the world's hidden calibration [stand-in, designer]. */
export interface SkillMarks { median: number; best: number; test?: string; fact?: string; model?: string }
export function skillMarks(d: DomainId): SkillMarks {
  const t = d === 'CODE' ? SKILL_TEST_CODE : SKILL_TESTS[d];
  return { median: FRAMEWORK_HIGH_L, best: 10, test: t?.test, fact: t?.fact, model: t?.model };
}
/** Inverse of λ on [0, 15): the effective compute at display level L (the smallest G with λ(G) ≥ L; λ is increasing
 *  there). L ≥ 15 returns the ASI point, L ≤ 0 the G where the first slope reaches 0. */
export function gOfLevel(w: TimelineWorld, L: number): number {
  const g = levelKnotsG(w);
  if (L <= LEVEL_AT[0]) return g[0] + (Math.max(0, L) - LEVEL_AT[0]) * (Math.max(1e-9, g[1] - g[0]) / (LEVEL_AT[1] - LEVEL_AT[0]));
  for (let i = 0; i < g.length - 1; i++) if (L < LEVEL_AT[i + 1]) return g[i] + ((L - LEVEL_AT[i]) * Math.max(1e-9, g[i + 1] - g[i])) / (LEVEL_AT[i + 1] - LEVEL_AT[i]);
  return g[g.length - 1];
}

/** RD-P04: OOM of effective compute per display level at level L (the inverse slope of λ on the knot segment holding
 *  L). A v2 spread of s levels around a threshold L* is s × oomPerLevel(L*) OOM: exact while G stays on that segment. */
export function oomPerLevel(w: TimelineWorld, L: number): number {
  const g = levelKnotsG(w);
  let i = 0;
  while (i < g.length - 2 && L >= LEVEL_AT[i + 1]) i++;
  return Math.max(1e-9, g[i + 1] - g[i]) / (LEVEL_AT[i + 1] - LEVEL_AT[i]);
}
/** RD-P04: a v2 display-level gate σ((L_d − L*)/s) on domain G (OOM): σ((x − λ⁻¹(L*)) / (s·oomPerLevel(L*))), x the
 *  domain's scale G (domainScaleG). The threshold converts exactly through the one λ; the spread on L*'s segment. */
export const levelGate = (w: TimelineWorld, x: number, L: number, s: number) => 1 / (1 + Math.exp(-(x - gOfLevel(w, L)) / (s * oomPerLevel(w, L))));

/** Decimal year of a day (v1 convention) on the standard start date. */
export const yearOfDay = (day: Day) => decimalYearOf(START_DATE, day);

// ───────────────────────────── start state (RD-U06) ─────────────────────────────

/** The start state of world w (data/v2/calibration.ts START_STATE): G(V0), B0's pretraining recipe, V0's RL recipe. */
export const startStateOf = (w: TimelineWorld) => START_STATE[PRESET_BY_LABEL[w.label] ?? 'sampled'];
/** G of the reference start version V0 in world w (data): the reference base B0 (≈ 354B active × 400 tokens per
 *  parameter, the recipe of its launch day) plus the reference post-training run (standard budget, broad) at V0's RL
 *  recipe. */
export const gV0 = (w: TimelineWorld): number => startStateOf(w).g;

/** What a start lab's last base was trained as: its FLOP, tokens per parameter and shape. */
export interface StartInputs { flop: number; tpp: number; shape: BaseDesign['shape'] }
/** A start lab: its recipe lag (OOM behind the leader's day-0 recipe, the same in the pretraining and the RL-efficiency
 *  part; negative = ahead), B0's pretraining recipe and V0's RL recipe at that lag, the version's parts and G. */
export interface StartLab { lag: number; ePre: number; eRL: number; gPre: number; rl: ReturnType<typeof rlGains>; G: number }

/** The one start rule for every lab (RD-U06; the player, each rival, DeepCent and the leader twin): the lab's last base
 *  was trained on B0's dates and its start version post-trained on V0's (reference run: standard budget, broad), at the
 *  world's start recipes (START_STATE) less the lab's recipe lag; the lag is solved so the version lands at G0. A lab at
 *  the reference inputs and G0 = G(V0) has lag 0 exactly. Stand-in (DD-18): every lab's start recipes are the same
 *  dated recipes; only its lag and its base FLOP differ. */
/** A start lab at a given recipe lag (startLab's parts without the solve; CP3g: the equilibrium-capped lag). */
export function startLabAt(w: TimelineWorld, lag: number, inp: StartInputs): StartLab {
  const st = startStateOf(w);
  const rlW = rlWeights('broad', rlFamiliesAvailable(() => false));
  const ePre = st.b0 - lag;
  const eRL = st.v0 - lag;
  const gPre = gPreOf({ flop: inp.flop, tpp: inp.tpp, recipe: ePre, shape: inp.shape, fData: 1, designDg: 0 }).total;
  const rl = rlGains(inp.flop, RL_BUDGET.standard * inp.flop, rlW, eRL);
  return { lag, ePre, eRL, gPre, rl, G: gPre + rl.general };
}
export function startLab(w: TimelineWorld, G0: number, inp: StartInputs): StartLab {
  const at = (lag: number): StartLab => startLabAt(w, lag, inp);
  const zero = at(0);
  if (Math.abs(zero.G - G0) < 1e-12) return zero;
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).G > G0) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2);
}

/** CP3g (designer decision: start in equilibrium): the recipe gap to the leader's day-0 recipe that diffusion rule A
 *  (production/diffusion.ts: dR_i/dt = g_i + (R_pub − R_i)/τ) sustains in steady state. A follower with own recipe growth
 *  g_i behind a source growing at g_L holds a steady gap where the inflow closes the rate difference, Δ/τ = g_L − g_i:
 *  Δ* = (g_L − g_i)·τ [D, from the rule's own parameters; research/RD-X04r §3A: "a follower that relaxes toward a frontier
 *  moving at a constant rate ends up exactly τ behind in time"]. Signed: a lab whose own rate is below the leader's
 *  cannot hold a recipe lead (Δ* > 0 caps its lag to [0, Δ*]); one above it could hold a lead of up to (g_i − g_L)·τ.
 *  Returns the allowed lag interval [lo, hi] (OOM, positive = behind). Rates in G-equivalent OOM per year; τ in years. */
export function equilibriumLagRange(gLead: number, gOwn: number, tauYears: number): [number, number] {
  const d = (gLead - gOwn) * tauYears;
  return [Math.min(0, d), Math.max(0, d)];
}

// ───────────────────────────── versions (MODEL-V3 §2) ─────────────────────────────

/** A version's general effective compute: G = G_pre + ΔG_RL + Σ design ΔG. */
export const gOfBuild = (b: VersionBuild) => b.gPre + b.dgRL + b.dg;
/** A domain's effective compute: G_pre + s_d,data + (ΔG_RL,d − the reference RL profile) + design ΔG (general and the
 *  domain's, OOM; RD-U01: every design offset is a ΔG here, none in levels). Builds without per-domain RL gains use the
 *  general gain. */
export function gOfDomain(b: VersionBuild, d: DomainId): number {
  const rl = b.dgRLd[d] !== undefined ? (b.dgRLd[d] ?? 0) - REF_RL_PROFILE[d] : b.dgRL;
  return b.gPre + (b.sD[d] ?? 0) + rl + b.dg + (b.dgD[d] ?? 0);
}
/** The one domain effective compute that the work fit (departments/workfit.ts domainG), the horizon, the displayed
 *  domain level and the world effects read (OOM): the build's domain G (a version without a build: its general G plus
 *  its domain offset, RD-P04c: a rival / China version's adopted-idea `domainDg`, SimpleModel; RD-E01a deleted P19's
 *  RSCH gain). */
export function versionDomainG(v: Pick<ModelVersion, 'G' | 'build'> & { domainDg?: Partial<Record<DomainId, number>> }, d: DomainId): number {
  // Merge p3-c2 → rd: rivals now carry an RD-X03 build too, so the adopted-idea offsets add on top of either.
  return (v.build ? gOfDomain(v.build, d) : v.G) + (v.domainDg?.[d] ?? 0);
}

/** How far a domain's best human sits above the coding / agency best human on the skill measurement scale (OOM):
 *  best_d − G_SC = δ_d·Δ_bm, δ_d = skillRefDelta(sd_SC)[d] (UB-1, data/v2/workTypes.ts: the 2025 frontier's sourced test
 *  standing per domain against coding's; RD-U05 had read the work fit's refDelta, which put the five expert domains on one
 *  reference 1.3 gaps beyond the research domains). Memo per world calibration, as refPoints'. */
const shiftMemo = new WeakMap<TimelineWorld['v3'], Record<DomainId, number>>();
export function domainRefShift(w: TimelineWorld, d: DomainId): number {
  let m = shiftMemo.get(w.v3);
  if (!m) {
    const rd = skillRefDelta(w.v3.sdSC);
    m = {} as Record<DomainId, number>;
    for (const k of DOMAIN_IDS) m[k] = rd[k] * w.v3.dBM;
    shiftMemo.set(w.v3, m);
  }
  return m[d];
}

/** RD-P04: a model's domain G on the general λ scale (OOM): G_d − (best_d − G_SC), so λ of it is the domain score. The
 *  one capability input the world effects read (α, the PHYS gate, control, tech gates, bestPublic). */
export const domainScaleG = (w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>, d: DomainId) => versionDomainG(v, d) - domainRefShift(w, d);
/** RD-P04b: every domain's scale G of a model (domainScaleG), as a record. */
export function domainScaleGs(w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>): Record<DomainId, number> {
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) out[d] = domainScaleG(w, v, d);
  return out;
}

/** CAL2-X: v2's level profile on the domains RD-U05 moved (data/v2/calibration.ts REF_OFF, deleted in RD-U05): v2 showed
 *  a domain at λ(G_d) + off_d, so V0 read CYBER 4, PHYS 1. Only the shifted domains' entries: AGENCY's −1 (shift 0) is
 *  not applied (its gates read the RD-U05 score; BUILD-NOTES CAL2-X). A unit, not a parameter. */
export const V2_DOMAIN_OFF: Partial<Record<DomainId, number>> = { CYBER: -1, PHYS: -4 };
/** CAL2-X: the one conversion for world gates whose thresholds are v2 levels (research/16's profile scale, dated to AI 2027
 *  models), read on the RD-U05 domain scale G (domainScaleG). v2's domain level was λ(G_d) + off_d on the raw domain G;
 *  RD-U05 reads G_d − domainRefShift(w, d). So a v2 threshold L* in domain d is the scale G λ⁻¹(L* − off_d) − shift_d(w),
 *  per world (the shift is δ_d·Δ_bm of the world's own references; it cancels here, so UB-1's per-domain references
 *  leave every v2 gate at the same raw domain G). Replaces CAL-X's ai2027-only U05_SHIFT_G. */
export const gOfV2Level = (w: TimelineWorld, d: DomainId, L: number) => gOfLevel(w, L - (V2_DOMAIN_OFF[d] ?? 0)) - domainRefShift(w, d);
/** CAL2-X: a v2 gate σ((L_v2,d − L*)/s) on a domain-scale G x (see gOfV2Level): levelGate on the raw domain G at L* − off_d. */
export const v2LevelGate = (w: TimelineWorld, d: DomainId, x: number, L: number, s: number) =>
  levelGate(w, x + domainRefShift(w, d), L - (V2_DOMAIN_OFF[d] ?? 0), s);

/** Domain score L_d = λ(G_d − (best_d − G_SC)), clamped to [0, 15] (RD-U05; MODEL-V3 §2.3): the version's domain
 *  effective compute (versionDomainG: training, data and design specialisation, all in OOM) measured against that
 *  domain's best human, best_d = G_SC + δ_d·Δ_bm, on the general 0–15 scale. So L_d = 10 exactly when the model
 *  matches the best human in domain d (the superhuman-coder knot is the CODE / AGENCY best human), λ(G_SC − Δ_bm) at
 *  that domain's median expert, and an OOM above or below counts as it does on the general scale. Domain difficulty
 *  lives only in the human reference points (refDelta); v2's per-domain display offsets are gone. A version without a
 *  build (a rival's model) reads G for every domain. The display moves exactly as the fit does. Danger flags,
 *  dangerous benchmarks, misuse / exfiltration capability and rival hazards read this same score. */
export function domainsOf(w: TimelineWorld, G: number, b?: VersionBuild): Record<DomainId, number> {
  const out = {} as Record<DomainId, number>;
  const v = { G, build: b };
  for (const d of DOMAIN_IDS) out[d] = clamp(levelOfG(w, versionDomainG(v, d) - domainRefShift(w, d)), 0, 15);
  return out;
}

/** Recompute a version's derived levels from G and its build. */
export function refreshLevels(w: TimelineWorld, v: ModelVersion) {
  v.Lg = levelOfG(w, v.G);
  v.domains = domainsOf(w, v.G, v.build);
}

/** A version's effective compute in a horizon domain (OOM): its domain G; a version without a build: its general G. */
export const horizonG = (_w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>, d: DomainId = 'AGENCY') => versionDomainG(v, d);
/** 50% time horizon in minutes (model v3 V3.2): METR TH1.1's 203 min for the Aug-2025 frontier (V0) × 4.2 per OOM of the
 *  version's AGENCY effective compute over V0's (CODE for software work, departments/workfit.ts), × its horizon
 *  multiplier (long-horizon RL, P07, P12). Replaces the v1 horizon curve on pm. */
export const h50Of = (w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>, d: DomainId = 'AGENCY') =>
  H50_V0_MIN * Math.pow(H50_PER_OOM, horizonG(w, v, d) - gV0(w)) * (v.build?.h80Mult ?? 1);

// ───────────────────────────── lead (hidden) ─────────────────────────────

// A lab's frontier history is its weekly series.G (record.ts), read by the lead clock lagDays, frontierGAt and the pace
// frontierGPerYear. A version lab's series is a staircase (each new version is a
// step), so interpolating between adjacent samples would put every intermediate level at the step and make the lag of
// a smoothly progressing follower jump by a whole version interval each time it passes a step. The frontier LINE runs
// instead through the "corners": the first sample at each new record level, plus today's level if it is higher (a
// version newer than the last weekly sample). A continuous series (rivals, China) is all corners, so nothing changes
// for it.

/** G of `lab`'s frontier line on `day` (≤ today; corners of series.G closed by today's best G, as above); undefined
 *  before its history starts. RD-L02: replaces the λ-series frontierLevelAt; theft's stolen copy, a rival's late
 *  release and the windowed pace read it. */
export function frontierGAt(s: GameStateV2, lab: LabId, day: Day): number | undefined {
  const { xs, days, off } = gSeries(s, lab);
  if (!xs.length || day < days[off]) return undefined;
  const gNow = bestG(s, lab);
  let pd = days[off];
  let px = xs[0];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    if (x <= px) continue;
    if (days[i + off] >= day) return px + ((x - px) * (day - pd)) / Math.max(1e-9, days[i + off] - pd);
    pd = days[i + off];
    px = x;
  }
  if (Number.isFinite(gNow) && gNow > px && s.time.day > pd) return px + ((gNow - px) * (Math.min(day, s.time.day) - pd)) / (s.time.day - pd);
  return px;
}

/** The one lead clock (RD-L01, DD-10): how many days ago `leader`'s recorded frontier G stood where `follower` stands
 *  now (positive = the leader is ahead). `follower` is a lab (its best internal G) or a G value (e.g. a released model).
 *  Read from the weekly series.G (record.ts) along the frontier line's corners (as above, in G), linearly interpolated;
 *  today's best G closes the line when it is newer than the last sample. Hidden truth; trueLeadDays, intel and China's
 *  readouts read it, so LeadTrack and RiskMap have this one function behind them.
 *  - Follower ahead of the leader (a lab): the lag the other way, negated: lagDays(f, l) = −lagDays(l, f). Level: 0.
 *  - Follower a G value above the leader's frontier: −(gap ÷ the leader's frontier-G slope), i.e. how long until the
 *    leader gets there at its own recorded pace (frontierGPerYear).
 *  - History too short (the follower is below the leader's first sample, the first weeks of a game): the days since that
 *    sample plus the gap to it at the stated pre-game pace PRE_GAME_G_PER_YEAR (OOM/yr), the rate the start gaps in
 *    months are converted at (rivals.ts initialRival, core/init.ts), i.e. the leader's pre-history slope.
 *  - No record at all for the leader: the gap at the pre-game rate. Non-finite G: 0. */
export function lagDays(s: GameStateV2, follower: LabId | number, leader: LabId): number {
  const gL = bestG(s, leader);
  if (typeof follower === 'string') {
    if (follower === leader) return 0;
    const gF = bestG(s, follower);
    if (!Number.isFinite(gF) || !Number.isFinite(gL)) return 0;
    return gL >= gF ? daysSinceG(s, leader, gF, gL) : -daysSinceG(s, follower, gL, gF);
  }
  if (!Number.isFinite(follower) || !Number.isFinite(gL)) return 0;
  if (follower <= gL) return daysSinceG(s, leader, follower, gL);
  return -((follower - gL) / Math.max(0.06, frontierGPerYear(s, leader))) * 365;
}

/** A lab's recorded frontier G samples aligned to series.day (a lab first recorded after day 0 aligns at the end). */
function gSeries(s: GameStateV2, lab: LabId): { xs: number[]; days: Day[]; off: number } {
  const xs = s.series.G?.[lab] ?? [];
  const days = s.series.day;
  return { xs, days, off: Math.max(0, days.length - xs.length) };
}

/** Days since `lab`'s frontier line (corners of series.G, then today's `gNow`) first reached `g` (g ≤ gNow). */
function daysSinceG(s: GameStateV2, lab: LabId, g: number, gNow: number): number {
  const { xs, days, off } = gSeries(s, lab);
  const today = s.time.day;
  const rate = PRE_GAME_G_PER_YEAR; // G a year: the pre-history slope (RD-L03: the stated pre-game pace)
  if (!xs.length) return ((gNow - g) / rate) * 365;
  if (g < xs[0]) return Math.max(0, today - days[off]) + ((xs[0] - g) / rate) * 365;
  let pd = days[off];
  let px = xs[0];
  if (g <= px) return Math.max(0, today - pd);
  const at = (d: number, x: number) => today - (pd + ((g - px) / Math.max(1e-12, x - px)) * (d - pd));
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    if (x <= px) continue; // not a new record: not a corner
    if (x >= g) return Math.max(0, at(days[i + off], x));
    pd = days[i + off];
    px = x;
  }
  if (gNow > px && today > pd) return Math.max(0, at(today, gNow));
  return 0; // g between the last record and today's G with no time since: level
}

/** The window (days) over which the "how fast" readers take a lab's pace (RD-L02 [D]: half a year, so the slope follows
 *  the lab's current speed and spans more than one version step of a staircase lab). */
export const PACE_WINDOW_DAYS = 182;

/** A lab's pace (DD-10): the slope of its own recorded frontier G in OOM a year, over the last `windowDays` of its
 *  frontier line to today's best G (default: the whole recorded history). A window with under 28 days of history or no
 *  rise reads the whole history; with under two series.G points (or no rise yet) it reads the stated pre-game pace
 *  PRE_GAME_G_PER_YEAR (RD-L03: this replaces the old day-0 software-rate seed). Readers that need a rate ("days of its own progress", "G a release lag behind") use this with
 *  PACE_WINDOW_DAYS, never a progress-year pace. */
export function frontierGPerYear(s: GameStateV2, lab: LabId, windowDays = Infinity): number {
  const { xs, days, off } = gSeries(s, lab);
  const top = xs.length ? Math.max(...xs, bestG(s, lab)) : 0;
  if (xs.length && Number.isFinite(windowDays)) {
    const d0 = Math.max(days[off], s.time.day - windowDays);
    const g0 = frontierGAt(s, lab, d0);
    const w = s.time.day - d0;
    if (g0 !== undefined && w >= 28 && top - g0 > 0) return ((top - g0) / w) * 365;
  }
  const span = xs.length ? s.time.day - days[off] : 0;
  const rise = xs.length ? top - xs[0] : 0;
  if (xs.length >= 2 && span > 0 && rise > 0) return (rise / span) * 365;
  return PRE_GAME_G_PER_YEAR;
}

/** Days a lab's true frontier lags the player's best internal version (positive = player ahead): lagDays(other, player).
 *  Hidden; engine use only (intel, endings, events). */
export function trueLeadDays(s: GameStateV2, other: LabId): number {
  return lagDays(s, other, PLAYER_ID);
}

// ───────────────────────────── milestones (§3.1.6) ─────────────────────────────

/** Player-language statement of each milestone's criterion (the notice when the player's evaluations first show it). */
export const MILESTONE_CRITERIA = [
  'agents complete a tenth of software work on their own',
  'agents complete half of software work on their own',
  'agents complete half of experiment work on their own',
  'coding at or above the best human engineer on 90% of the work, for less than your engineers cost',
  'coding, experiments and research ideas all at or above the best human researchers',
  'research ideas far beyond the best human researchers',
  'every kind of cognitive work far beyond the best humans',
];

/** Milestones a non-player lab (rival, China, the leader lab) meets today: the one predicate (departments/workfit.ts
 *  milestonesOf) on the reference-profile build of its internal and public model (RD-X03: the build its training made;
 *  referenceProfileModel for a model known by G alone), at the FLOP
 *  per token the lab serves it at (its serving stack). Any of the two meeting it counts. */
export function otherLabMilestones(s: GameStateV2, r: RivalLab): boolean[] {
  const out = [false, false, false, false, false, false, false];
  for (const m of r.publicModel ? [r.internal, r.publicModel] : [r.internal]) {
    const x = milestonesOf(s, m.build ? m : referenceProfileModel(m.G, m.flop ?? 0), rivalServeFpt(r, m));
    for (let i = 0; i < 7; i++) out[i] ||= x[i];
  }
  return out;
}

/** Record first crossings in order on `day` (fixes v1 bug #3): a later milestone is recorded no earlier than the one
 *  before it (SC → SAR → SIAR → ASI). Returns the milestones newly recorded. */
export function recordMilestones(core: NonNullable<ReturnType<typeof labCore>>, met: boolean[], day: Day): MilestoneIdx[] {
  const out: MilestoneIdx[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = i as MilestoneIdx;
    if (core.milestoneDays[idx] !== undefined) continue;
    if (i > 3 && core.milestoneDays[(i - 1) as MilestoneIdx] === undefined) break;
    if (!met[i]) { if (i >= 3) break; continue; }
    core.milestoneDays[idx] = day;
    out.push(idx);
    if (idx === 3 && core.scDay === undefined) core.scDay = day;
  }
  return out;
}

/** Every active lab's milestones on `day` by the one predicate (DD-09): the player's live versions on their builds
 *  (labMilestones), every other lab by otherLabMilestones. Returns the player's newly recorded milestones. The
 *  milestones system calls it daily; core/init.ts at day 0. */
export function updateMilestones(s: GameStateV2, day: Day): MilestoneIdx[] {
  let fresh: MilestoneIdx[] = [];
  const pl = labCore(s, PLAYER_ID);
  if (pl && pl.status === 'active' && pl.milestoneDays[6] === undefined) fresh = recordMilestones(pl, labMilestones(s), day);
  for (const r of otherLabs(s)) {
    const core = labCore(s, r.core.id); // China's lab core id is CHINA_ID
    if (!core || core.status !== 'active' || core.milestoneDays[6] !== undefined) continue;
    recordMilestones(core, otherLabMilestones(s, r), day);
  }
  return fresh;
}

/** milestones (50, daily): first-crossing record per lab, SC day, act transitions, by ONE predicate for every lab
 *  (DD-09, RD-L04: departments/workfit.ts milestonesOf; superhuman coder = SWE fit ≥ the best human with coverage
 *  ≥ 0.9 and a lower cost per work-hour, …). The display level's knots are not milestone thresholds. The player is told
 *  when its evaluations first show a criterion (flag seenMilestone{i} = that day; China reads 1 and 2). */
export const milestonesSystem: EngineSystem = {
  id: 'milestones', owner: 'WS1', cadence: 'daily', order: 50, system: 'models',
  run(s, ctx) {
    updateMilestones(s, ctx.day);
    const md = s.player.milestoneDays;
    for (let i = 1; i < 7; i++) {
      const key = `seenMilestone${i}`;
      if (md[i as MilestoneIdx] !== undefined && s.flags[key] === undefined) {
        s.flags[key] = ctx.day;
        ctx.log('milestone', `${MILESTONE_NAMES[i]}: your evaluations show the criterion met (${MILESTONE_CRITERIA[i]}).`, 3);
      }
    }
    // Acts keyed to milestones (§1.5): SAR → 4, Research agent → 3, Reliable agent (or day 150) → 2 (RD-R01: the M ≥ 25
    // alternative is gone; SAR is the milestone it stood for).
    const act = md[4] !== undefined ? 4 : md[2] !== undefined ? 3 : md[1] !== undefined || ctx.day >= 150 ? 2 : 1;
    if (act > s.tutorial.act) s.tutorial.act = act;
  },
};
