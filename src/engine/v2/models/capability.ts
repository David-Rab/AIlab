// Capability: the G → pm bridge, the know-how readout zero, levels, domains, horizons, milestones, true lead
// (V2-SPEC §3.1.3–3.1.6; model v3 V1: design/MODEL-V3.md §2, design/V3-BUILD.md "Bridges"). Owner: WS1.
import { B0_START_DAY, LEVEL_KNOTS, REF_OFF, RSCH_TASTE_PENALTY, DOMAIN_IDS, V0_DAY } from '../../../data/v2/calibration';
import { B_G_PER_Y, E_B0, RL_BUDGET, REFERENCE_BASE } from '../../../data/v2/runDesign';
import { milestoneThresholds, multiplierAt, stage1 } from '../../../data/world';
import { COGNITIVE_WORK, H50_PER_OOM, H50_V0_MIN, H80_OVER_H50, LEVEL_PER_OOM, WORK_TYPES, refDelta } from '../../../data/v2/workTypes';
import { labMilestones } from '../departments/workfit';
import { clamp } from '../../rng';
import { START_DATE, dayOfDate, decimalYearOf } from '../core/time';
import { shareRefAt } from '../departments/split';
import { gF, refTotal } from '../production/knots';
import { asV1World, levelOf, thresholds } from '../world/calibration';
import type { Day, DomainId, EngineSystem, GameStateV2, LabId, MilestoneIdx, ModelVersion, TimelineWorld, VersionBuild } from '../types';
import { PLAYER_ID, bestPm, internalVersion, labCore, otherLabs } from './labs';
import { REF_RL_PROFILE, flopOfDesign, gPreOf, rlFamiliesAvailable, rlGains, rlWeights } from './effective';

/** In-game milestone names (no canon tags, §3.1.6). */
export const MILESTONE_NAMES = ['Agent', 'Reliable agent', 'Research agent', 'Superhuman coder', 'Superhuman AI researcher', 'Superintelligent AI researcher', 'Superintelligence'];

export { levelOf };

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
/** BRIDGE(V7): the display bridge's shift that lines the rivals' pm thresholds up with the player's work-type levels: the
 *  SC threshold (milestoneThresholds[3] − calShift) at Φ(G_SC), so a rival reaching its SC on pm reads L 10 on λ(G) as the
 *  player's superhuman coder does. Derived per world (model v3 V3b), not fitted; the rivals' q = pm + calShift path keeps
 *  v2's through the simple-lab credit (CAL_SHIFT_V2 − calShift). */
export function alignedCalShift(w: TimelineWorld): number {
  return milestoneThresholds(asV1World(w))[3] - playerStart(w).target - (w.v3.gSC - gV0(w)) / B_G_PER_Y;
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

const DAY_2029 = dayOfDate(START_DATE, '2029-01-01');

/** Decimal year of a day (v1 convention) on the standard start date. */
export const yearOfDay = (day: Day) => decimalYearOf(START_DATE, day);

// ───────────────────────────── compute component (§3.1.3) ─────────────────────────────

/** BRIDGE(V7): pcRef_lab(t) = (1 − share)·∫₀^min(t, scDay) computePace dt (years; t < 0 extrapolates linearly). Only the
 *  simple rival/China frontier and the start-state solution read it now; player models are built from physical FLOP. */
export function pcRefLab(w: TimelineWorld, day: Day, scDay?: Day): number {
  const t = scDay !== undefined ? Math.min(day, scDay) : day;
  const pre = Math.min(t, DAY_2029);
  const post = Math.max(0, t - DAY_2029);
  return ((1 - w.share) * (pre + 0.5 * post)) / 365;
}

// ───────────────────────────── bridges (design/V3-BUILD.md) ─────────────────────────────

/** BRIDGE(V6,V7): zero of the know-how readout: the leader start's know-how on day 0 in world w (models/stacks.ts syncPa:
 *  pa = paRef + G-equivalent of the stacks ÷ B). */
export const paRef = (w: TimelineWorld) => playerStart(w).pa0;
/** Start state only (model v3 V2): the recipe vintage of a start-state know-how value of the closed-form start solution
 *  (playerStart: B0's start day, V0's post-training day), OOM over the leader's day-0 recipe. The engine's recipe comes
 *  from the stacks (models/stacks.ts); nothing reads it from the know-how readout. */
export const startVintage = (w: TimelineWorld, paStart: number) => B_G_PER_Y * (paStart - paRef(w));

const gV0Cache = new WeakMap<TimelineWorld, number>();
/** G of the reference start version V0 in world w: the reference base B0 (1T active × 50 tokens per parameter, the
 *  recipe of its start day) plus the reference post-training run (standard budget, broad) at V0's RL recipe. */
export function gV0(w: TimelineWorld): number {
  const hit = gV0Cache.get(w);
  if (hit !== undefined) return hit;
  const ps = playerStart(w);
  const flop = flopOfDesign(REFERENCE_BASE);
  const g = gPreOf({ flop, tpp: REFERENCE_BASE.tpp, recipe: E_B0 + startVintage(w, ps.paBase), shape: REFERENCE_BASE.shape, fData: 1, designDg: 0 }).total;
  const rl = rlGains(flop, RL_BUDGET.standard * flop, rlWeights('broad', rlFamiliesAvailable(() => false)), startVintage(w, ps.paPost));
  const out = g + rl.general;
  gV0Cache.set(w, out);
  return out;
}
/** BRIDGE(V6,V7): the old progress coordinate from effective compute, pm = pm(V0) + (G − G(V0))/B, for the display level
 *  λ(G) = levelOf(Φ(G)), the rivals (still on pm until V7) and the safety and revenue readers (V4, V6). The player's
 *  research and milestones do not read it since model v3 V3 (departments/workfit.ts). */
export const pmOfG = (w: TimelineWorld, G: number) => playerStart(w).target + (G - gV0(w)) / B_G_PER_Y;
/** Inverse of pmOfG. */
export const gOfPm = (w: TimelineWorld, pm: number) => gV0(w) + (pm - playerStart(w).target) * B_G_PER_Y;

// ───────────────────────────── versions (MODEL-V3 §2) ─────────────────────────────

/** A version's general effective compute: G = G_pre + ΔG_RL + Σ design ΔG. */
export const gOfBuild = (b: VersionBuild) => b.gPre + b.dgRL + b.dg;
/** A domain's effective compute: G_pre + s_d,data + (ΔG_RL,d − the reference RL profile) + design ΔG. Builds without
 *  per-domain RL gains use the general gain. */
export function gOfDomain(b: VersionBuild, d: DomainId): number {
  const rl = b.dgRLd[d] !== undefined ? (b.dgRLd[d] ?? 0) - REF_RL_PROFILE[d] : b.dgRL;
  return b.gPre + (b.sD[d] ?? 0) + rl + b.dg;
}
/** Version pm (BRIDGE(V6,V7)) of a build. */
export const pmOfBuild = (w: TimelineWorld, b: VersionBuild) => pmOfG(w, gOfBuild(b));
/** Set build.off (domain level − general level − the 2025 profile, L) from the build's domain G and its level offsets;
 *  returns pm. L_d = levelOf(Φ(G_d)) − o_d + design offsets (MODEL-V3 §2.3), o_d = −REF_OFF[d][0] (+ RSCH taste). */
export function finishBuild(w: TimelineWorld, b: VersionBuild): number {
  const pm = pmOfBuild(w, b);
  const Lg = levelOf(w, pm);
  const off: Partial<Record<DomainId, number>> = {};
  for (const d of DOMAIN_IDS) {
    const x = levelOf(w, pmOfG(w, gOfDomain(b, d))) - Lg + (b.offL[d] ?? 0);
    if (Math.abs(x) > 1e-9) off[d] = x;
  }
  b.off = off;
  return pm;
}

/** Domain levels L_d = Lg − o_d + off_d, clamped to [0, 15] (MODEL-V3 §2.3): o_d = −REF_OFF[d][0] is the domain's
 *  constant difficulty offset (the 2025 profile; RSCH's taste penalty until P19), off_d the version's training and
 *  design specialisation (finishBuild). No era table: a domain lags only by what training gives it. */
export function domainsOf(w: TimelineWorld, pm: number, designOff: Partial<Record<DomainId, number>> = {}, hasP19 = false): Record<DomainId, number> {
  const Lg = levelOf(w, pm);
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) {
    const pen = d === 'RSCH' && !hasP19 ? RSCH_TASTE_PENALTY : 0;
    out[d] = clamp(Lg + REF_OFF[d][0] + pen + (designOff[d] ?? 0), 0, 15);
  }
  return out;
}

/** dLg/dpm at pm (numerical, ≥ 0.05). */
export function slopeL(w: TimelineWorld, pm: number): number {
  const e = 0.01;
  return Math.max(0.05, (levelOf(w, pm + e) - levelOf(w, pm - e)) / (2 * e));
}

/** δ_rsch = clamp((0.6·designOff_CODE + 0.4·designOff_RSCH)/slopeL(pm), −0.5, +0.5) years (§3.1.5). */
export function deltaRsch(w: TimelineWorld, v: Pick<ModelVersion, 'pm' | 'build'>): number {
  const off = v.build?.off;
  if (!off) return 0;
  const x = 0.6 * (off.CODE ?? 0) + 0.4 * (off.RSCH ?? 0);
  return x === 0 ? 0 : clamp(x / slopeL(w, v.pm), -0.5, 0.5);
}

/** Recompute a version's derived levels from pm (and its build offsets). */
export function refreshLevels(w: TimelineWorld, v: ModelVersion, hasP19: boolean) {
  v.Lg = levelOf(w, v.pm);
  v.domains = domainsOf(w, v.pm, v.build?.off ?? {}, hasP19);
}

/** A version's effective compute in a horizon domain (OOM): its domain G plus its level offsets at LEVEL_PER_OOM; a
 *  version without a build (an imported open model) through the display bridge's inverse (BRIDGE(V7)). */
export const horizonG = (w: TimelineWorld, v: Pick<ModelVersion, 'pm' | 'build'>, d: DomainId = 'AGENCY') =>
  v.build ? gOfDomain(v.build, d) + (v.build.offL[d] ?? 0) / LEVEL_PER_OOM : gOfPm(w, v.pm);
/** 50% time horizon in minutes (model v3 V3.2): METR TH1.1's 203 min for the Aug-2025 frontier (V0) × 4.2 per OOM of the
 *  version's AGENCY effective compute over V0's (CODE for software work, departments/workfit.ts), × its horizon
 *  multiplier (long-horizon RL, P07, P12). Replaces the v1 horizon curve on pm. */
export const h50Of = (w: TimelineWorld, v: Pick<ModelVersion, 'pm' | 'build'>, d: DomainId = 'AGENCY') =>
  H50_V0_MIN * Math.pow(H50_PER_OOM, horizonG(w, v, d) - gV0(w)) * (v.build?.h80Mult ?? 1);
/** 80% time horizon = h50 / 5 (METR TH1.1). */
export const h80Of = (w: TimelineWorld, v: Pick<ModelVersion, 'pm' | 'build'>, d: DomainId = 'AGENCY') => h50Of(w, v, d) * H80_OVER_H50;

// ───────────────────────────── start state (§3.1.4 "Initial state") ─────────────────────────────

/** Closed-form start: B0 started day −120 (pc extrapolated), V0 finished day −20, pa(t) = pa0 + r0·t before day 0
 *  (r0 = the reference software rate at start). pa0 is solved so that pm(V0) = p0 (§3.1.4). V0's v1-equivalent
 *  progress is q = p0 + calShift: calShift is the lag of RefBot's deployed model behind its know-how frontier that
 *  the shifted thresholds absorb (§7.1). */
const startCache = new WeakMap<TimelineWorld, ReturnType<typeof playerStartOf>>();
/** Start state of world w (cached: the bridges read it every day). */
export function playerStart(w: TimelineWorld): ReturnType<typeof playerStartOf> {
  let x = startCache.get(w);
  if (!x) startCache.set(w, (x = playerStartOf(w)));
  return x;
}
function playerStartOf(w: TimelineWorld) {
  const target = w.p0;
  const Mref = multiplierAt(asV1World(w), w.p0); // BRIDGE(V7): start-state solution (pa zero, simple-lab lags)
  const r0 = w.p0 < stage1(asV1World(w)) ? w.share * Mref : Mref; // years per year
  const pcB0 = pcRefLab(w, B0_START_DAY);
  const dPost = V0_DAY;
  // The v2 start-state solution (post-training retention 0.7, compute term pcB0), kept only so the start know-how pa0
  // (the zero of the recipe bridge) and the start lag stay where they were calibrated; pm(V0) is pinned by pmOfG.
  const k = START_RETAIN;
  const pa0 = target - pcB0 - (r0 * B0_START_DAY) / 365 - (k * r0 * (dPost - B0_START_DAY)) / 365;
  const paAt = (d: number) => pa0 + (r0 * d) / 365;
  return { pa0, r0, pcB0, paBase: paAt(B0_START_DAY), paPost: paAt(dPost), target, lag: pa0 - target };
}

/** BRIDGE(V7): v2's post-training retention, kept inside the start-state solution and the simple rival/China lag model
 *  (simpleLag) until V7 rebuilds rivals in G. Player versions no longer retain know-how: a post-training run applies
 *  today's RL recipe only (MODEL-V3 §4.4). */
const START_RETAIN = 0.7;

/** Average base age (days since base start) under the reference cadence: a 9-month cycle of ~121-day runs. */
export const REF_BASE_AGE = 256;
/** Average age of the newest post-trained version before continual learning (6-week cadence + eval) [D]. */
export const REF_POST_AGE = 60;
/** Progress over which continual learning phases in for simple-model labs (simpleLag) [D]. */
const STREAM_RAMP = 0.3;

/**
 * Typical lag (years) of a lab's deployed model behind its know-how frontier pa + pcRef under the reference cadence
 * (what RefBot experiences on average): base staleness (1 − share)·age, plus before continual learning the κ loss
 * (1 − κ)·r·age and the version age r·60 d; with continual learning (from the Research-agent level, q ≥ thr[2], the
 * AI 2027 online learner) only the 7-day stream lag r·7 d. `rate` is the lab's software rate (years/year).
 * `extra` (the leader lab's LEADER_CAL, progress years, default 0) is added as is. A time lag (r·years) was tried
 * first: in takeoff it compounds through the lab's own research feedback (0.05 y moved ASI by +0.35 y).
 */
export function simpleLag(w: TimelineWorld, q: number, rate: number, extra = 0): number {
  const th = milestoneThresholds(asV1World(w));
  const stale = ((1 - w.share) * REF_BASE_AGE) / 365;
  // Continual learning phases in over STREAM_RAMP of progress past the Research-agent level: a hard switch made a
  // simple lab's frontier jump ≈ 0.3 at once and left a band of models no know-how could reach (weights theft).
  const f = clamp((q - th[2]) / STREAM_RAMP, 0, 1);
  const pre = ((1 - START_RETAIN) * rate * REF_BASE_AGE) / 365 + (rate * REF_POST_AGE) / 365;
  // BRIDGE(V7): the v3 reference lab's credit over this v2 lag model (w.simpleCredit, see V3_CREDIT_RAMP), phased in from the start.
  // It starts at the reference start frontier (V0 + the start lag), so every start state stays v2's exactly.
  const credit = (w.simpleCredit ?? 0) * clamp((q - (w.p0 + w.calShift + playerStart(w).lag)) / V3_CREDIT_RAMP, 0, 1);
  return stale + (1 - f) * pre + (f * rate * 7) / 365 + extra - credit;
}

/** BRIDGE(V7): under the v3 rules the reference lab's deployed model runs off v2's pm path (above it once it trains its
 *  first new base: its pm is pinned to V0, whose RL sits short of the curve's ceiling and whose know-how v2 credited
 *  through post-training retention; below it on slow, whose compute v2 over-credited). The CAL_SHIFT refit absorbs that
 *  as a level offset; simple labs (rivals, China, the leader lab) still on this v2 lag model get the same offset
 *  (w.simpleCredit = CAL_SHIFT_V2 − CAL_SHIFT), phased in over V3_CREDIT_RAMP of progress (about one base cycle), so
 *  their q = pm + calShift path and the player-vs-rival relation stay v2's (design/V3-BUILD.md V1 notes). */
const V3_CREDIT_RAMP = 1.0;

/** Software rate of a lab at reference inputs at q (for the start state). */
const refSoftwareRate = (w: TimelineWorld, q: number) => (q < stage1(asV1World(w)) ? w.share * multiplierAt(asV1World(w), q) : multiplierAt(asV1World(w), q)); // BRIDGE(V7)

/** Default frontier of a SimpleModel lab (rivals/China while not WS4-managed): pa + pcRef_lab(t) + its training
 *  scale term − the reference release lag (simpleLag), so a lab at reference inputs moves like RefBot. */
export function simpleFrontierPm(s: GameStateV2, lab: LabId, day = s.time.day): number {
  const core = labCore(s, lab);
  if (!core) return -Infinity;
  const w = s.hidden.timeline;
  const F = core.pa + pcRefLab(w, day, core.scDay) + trainScaleTerm(s, lab, day);
  const rate = core.prodCache?.rate ?? refSoftwareRate(w, F + w.calShift);
  const x = core.lagCal ?? 0;
  return F - simpleLag(w, F + w.calShift - simpleLag(w, F + w.calShift, rate, x), rate, x);
}

/** Start know-how pa of a SimpleModel lab whose start model is `pm0` (inverse of simpleFrontierPm at day 0). */
export function simpleStartPa(s: GameStateV2, lab: LabId, pm0: number): number {
  const w = s.hidden.timeline;
  const q = pm0 + w.calShift;
  const rate = labCore(s, lab)?.prodCache?.rate ?? refSoftwareRate(w, q); // the rate the frontier will use
  return pm0 + simpleLag(w, q, rate) - pcRefLab(w, 0) - trainScaleTerm(s, lab, 0);
}

/** Know-how pa at which a SimpleModel lab's frontier (simpleFrontierPm) equals `pm` today — the inverse WS4 uses when
 *  a lab's model jumps (weights theft): its know-how is set consistently with the model it now holds. Model v3 V1:
 *  solved exactly (bisection on the frontier F; the model is monotone in F): the q-dependent credit in simpleLag made
 *  v2's one-step inverse (lag at q = pm + calShift) miss by up to a month. */
export function simplePaFor(s: GameStateV2, lab: LabId, pm: number): number {
  const w = s.hidden.timeline;
  const day = s.time.day;
  const core = labCore(s, lab);
  const x = core?.lagCal ?? 0;
  const model = (F: number) => {
    const rate = core?.prodCache?.rate ?? refSoftwareRate(w, F + w.calShift);
    return F - simpleLag(w, F + w.calShift - simpleLag(w, F + w.calShift, rate, x), rate, x);
  };
  let lo = pm - 5;
  let hi = pm + 20;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (model(mid) < pm) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 - pcRefLab(w, day, core?.scDay) - trainScaleTerm(s, lab, day);
}

/** (1 − share)·ln(training pool / reference training pool)/ln gF: what the lab's base-run scale adds (§3.1.3). */
export function trainScaleTerm(s: GameStateV2, lab: LabId, day = s.time.day): number {
  const core = labCore(s, lab);
  if (!core) return 0;
  const w = s.hidden.timeline;
  const yr = yearOfDay(day);
  const ratio = (core.computeOnline * core.split.training) / Math.max(1, refTotal(w, yr) * shareRefAt(yr).training); // BRIDGE(V7)
  return ((1 - w.share) * Math.log(clamp(ratio, 0.02, 50))) / Math.log(gF(w, yr));
}

// ───────────────────────────── lead (hidden) ─────────────────────────────

// A lab's frontier history is its weekly level series. A version lab's series is a staircase (each new version is a
// step), so interpolating between adjacent samples would put every intermediate level at the step and make the lag of
// a smoothly progressing follower jump by a whole version interval each time it passes a step. The frontier LINE runs
// instead through the "corners": the first sample at each new record level, plus today's level if it is higher (a
// version newer than the last weekly sample). A continuous series (rivals, China) is all corners, so nothing changes
// for it.

/** Days since `lab`'s frontier line first reached `L`; undefined if the history does not reach back that far. */
function daysSinceLevel(s: GameStateV2, lab: LabId, L: number, nowL: number): number | undefined {
  const xs = s.series.L[lab];
  const days = s.series.day;
  if (!xs?.length) return undefined;
  let pd = NaN;
  let px = -Infinity;
  const at = (d: number, x: number) => {
    if (Number.isNaN(pd)) return undefined; // first corner already above L: history too short
    const f = (L - px) / Math.max(1e-9, x - px);
    return s.time.day - (pd + f * (d - pd));
  };
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (x <= px) continue; // not a new record level: not a corner
    if (x >= L) return at(days[i], x);
    pd = days[i];
    px = x;
  }
  if (nowL > px && nowL >= L) return at(s.time.day, nowL);
  return undefined;
}

/** Level of `lab`'s frontier line on `day` (≤ today; see above); undefined before its history starts. The inverse of
 *  daysSinceLevel: daysSinceLevel(frontierLevelAt(day)) = today − day wherever the line rises. */
export function frontierLevelAt(s: GameStateV2, lab: LabId, day: Day, nowL: number): number | undefined {
  const xs = s.series.L[lab];
  const days = s.series.day;
  if (!xs?.length || day < days[0]) return undefined;
  let pd = days[0];
  let px = xs[0];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    if (x <= px) continue;
    if (days[i] >= day) return px + ((x - px) * (day - pd)) / Math.max(1e-9, days[i] - pd);
    pd = days[i];
    px = x;
  }
  if (nowL > px && s.time.day > pd) return px + ((nowL - px) * (day - pd)) / (s.time.day - pd);
  return px;
}

/** Days a lab's true frontier lags the player's best internal version (positive = player ahead), from the weekly
 *  level history: how long ago the leader stood where the follower stands now. Hidden; engine use only (intel,
 *  endings, events). Falls back to gap / rate when the history does not reach back far enough. */
export function trueLeadDays(s: GameStateV2, other: LabId): number {
  const w = s.hidden.timeline;
  const pPl = bestPm(s, PLAYER_ID);
  const pOt = bestPm(s, other);
  if (!Number.isFinite(pOt)) return 0;
  const ahead = pPl >= pOt;
  const leader = ahead ? PLAYER_ID : other;
  const followerL = levelOf(w, ahead ? pOt : pPl);
  const d = daysSinceLevel(s, leader, followerL, levelOf(w, ahead ? pPl : pOt));
  if (d !== undefined && d >= 0) return ahead ? d : -d;
  // Fallback: gap / the leader's model progress rate (software rate + the Stage-1 compute share).
  const pr = labCore(s, leader)?.prodCache;
  const rate = Math.max(0.05, (pr?.rate ?? 1) + (pr?.stage === 2 ? 0 : 1 - w.share));
  return ((pPl - pOt) / rate) * 365;
}

// ───────────────────────────── milestones (§3.1.6) ─────────────────────────────

/** milestones (50, daily): first-crossing record per lab (fixes v1 bug #3), SC day, act transitions. The player's are
 *  work-type milestones (model v3 V3.5, departments/workfit.ts: superhuman coder = SWE fit ≥ the best human with coverage
 *  ≥ 0.9 and a lower cost per work-hour, …), recorded in order; rivals, China and the leader lab keep the pm thresholds
 *  (BRIDGE(V7)). */
export const milestonesSystem: EngineSystem = {
  id: 'milestones', owner: 'WS1', cadence: 'daily', order: 50, system: 'models',
  run(s, ctx) {
    const w = s.hidden.timeline;
    const thr = thresholds(w);
    const record = (core: NonNullable<ReturnType<typeof labCore>>, met: (i: number) => boolean) => {
      for (let i = 0; i < 7; i++) {
        const idx = i as MilestoneIdx;
        if (core.milestoneDays[idx] !== undefined) continue;
        // In order: a later milestone is recorded no earlier than the one before (SC → SAR → SIAR → ASI).
        if (i > 3 && core.milestoneDays[(i - 1) as MilestoneIdx] === undefined) break;
        if (!met(i)) { if (i >= 3) break; continue; }
        core.milestoneDays[idx] = ctx.day;
        if (idx === 3 && core.scDay === undefined) core.scDay = ctx.day;
      }
    };
    const pl = labCore(s, PLAYER_ID);
    if (pl && pl.status === 'active' && pl.milestoneDays[6] === undefined) {
      const m = labMilestones(s);
      record(pl, (i) => m[i]);
    }
    for (const r of otherLabs(s)) {
      const core = labCore(s, r.core.id); // China's lab core id is CHINA_ID
      if (!core || core.status !== 'active') continue;
      const pm = bestPm(s, r.core.id);
      record(core, (i) => pm >= thr[i]);
    }

    // The player is told when the MEASURED level crosses a milestone level (§3.1.6).
    const L = Math.max(internalVersion(s)?.evals.measuredL ?? 0, ...s.player.models.versions.filter((v) => v.status !== 'retired').map((v) => v.evals.measuredL ?? 0));
    for (let i = 1; i < LEVEL_KNOTS.length; i++) {
      const key = `seenMilestone${i}`;
      if (L >= LEVEL_KNOTS[i] && s.flags[key] === undefined) {
        s.flags[key] = ctx.day;
        ctx.log('milestone', `${MILESTONE_NAMES[i]}: measured level ${L.toFixed(1)}.`, 3);
      }
    }
    // Acts keyed to milestones (§1.5).
    const M = s.player.prodCache?.M ?? 1;
    const act = L >= 12 || M >= 25 ? 4 : L >= 8.5 ? 3 : L >= 6.5 || ctx.day >= 150 ? 2 : 1;
    if (act > s.tutorial.act) s.tutorial.act = act;
  },
};
