// Capability: the display level λ(G) (one map for every lab), domains, horizons, milestones, true lead (V2-SPEC
// §3.1.3–3.1.6; model v3 V1, V3b, F3: design/MODEL-V3.md §2, design/V3-BUILD.md). Owner: WS1. Every lab's capability is its
// effective compute G; model v3 F3 retired the progress coordinate pm = Φ(G) and the know-how readout pa.
import { B0_START_DAY, LEVEL_KNOTS, REF_OFF, DOMAIN_IDS, V0_DAY } from '../../../data/v2/calibration';
import { B_G_PER_Y, E_B0, RL_BUDGET, REFERENCE_BASE } from '../../../data/v2/runDesign';
import { multiplierAt, stage1 } from '../../../data/world';
import { COGNITIVE_WORK, H50_PER_OOM, H50_V0_MIN, LEVEL_PER_OOM, WORK_TYPES, refDelta } from '../../../data/v2/workTypes';
import { labMilestones } from '../departments/workfit';
import { clamp } from '../../rng';
import { START_DATE, dayOfDate, decimalYearOf } from '../core/time';
import { asV1World, referenceRate } from '../world/calibration';
import { bestLevelOf } from '../actors/rivalModel';
import type { Day, DomainId, EngineSystem, GameStateV2, LabId, MilestoneIdx, ModelVersion, TimelineWorld, VersionBuild } from '../types';
import { PLAYER_ID, bestG, internalVersion, labCore, otherLabs } from './labs';
import { REF_RL_PROFILE, flopOfDesign, gPreOf, rlFamiliesAvailable, rlGains, rlWeights } from './effective';

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
/** Inverse of λ on [0, 15): the effective compute at display level L (the smallest G with λ(G) ≥ L; λ is increasing
 *  there). L ≥ 15 returns the ASI point, L ≤ 0 the G where the first slope reaches 0. */
export function gOfLevel(w: TimelineWorld, L: number): number {
  const g = levelKnotsG(w);
  if (L <= LEVEL_AT[0]) return g[0] + (Math.max(0, L) - LEVEL_AT[0]) * (Math.max(1e-9, g[1] - g[0]) / (LEVEL_AT[1] - LEVEL_AT[0]));
  for (let i = 0; i < g.length - 1; i++) if (L < LEVEL_AT[i + 1]) return g[i] + ((L - LEVEL_AT[i]) * Math.max(1e-9, g[i + 1] - g[i])) / (LEVEL_AT[i + 1] - LEVEL_AT[i]);
  return g[g.length - 1];
}

const DAY_2029 = dayOfDate(START_DATE, '2029-01-01');

/** Decimal year of a day (v1 convention) on the standard start date. */
export const yearOfDay = (day: Day) => decimalYearOf(START_DATE, day);

// ───────────────────────────── compute component (§3.1.3) ─────────────────────────────

/** pcRef_lab(t) = (1 − share)·∫₀^min(t, scDay) computePace dt (years; t < 0 extrapolates linearly): v2's compute term,
 *  read only by the start-state solution below (playerStart) since model v3 F1. */
export function pcRefLab(w: TimelineWorld, day: Day, scDay?: Day): number {
  const t = scDay !== undefined ? Math.min(day, scDay) : day;
  const pre = Math.min(t, DAY_2029);
  const post = Math.max(0, t - DAY_2029);
  return ((1 - w.share) * (pre + 0.5 * post)) / 365;
}

// ───────────────────────────── start recipe vintages (until RD-U06) ─────────────────────────────

/** Start state only (model v3 V2): the recipe vintage of a start-state know-how value of the closed-form start solution
 *  (playerStart: B0's start day, V0's post-training day), OOM over the leader's day-0 recipe. The engine's recipe comes
 *  from the stacks (models/stacks.ts); nothing reads it from the know-how readout. */
export const startVintage = (w: TimelineWorld, paStart: number) => B_G_PER_Y * (paStart - playerStart(w).pa0);

const gV0Cache = new WeakMap<TimelineWorld, number>();
/** G of the reference start version V0 in world w: the reference base B0 (≈ 354B active × 400 tokens per parameter, the
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

// ───────────────────────────── versions (MODEL-V3 §2) ─────────────────────────────

/** A version's general effective compute: G = G_pre + ΔG_RL + Σ design ΔG. */
export const gOfBuild = (b: VersionBuild) => b.gPre + b.dgRL + b.dg;
/** A domain's effective compute: G_pre + s_d,data + (ΔG_RL,d − the reference RL profile) + design ΔG. Builds without
 *  per-domain RL gains use the general gain. */
export function gOfDomain(b: VersionBuild, d: DomainId): number {
  const rl = b.dgRLd[d] !== undefined ? (b.dgRLd[d] ?? 0) - REF_RL_PROFILE[d] : b.dgRL;
  return b.gPre + (b.sD[d] ?? 0) + rl + b.dg;
}
/** Set build.off (domain level − general level − the 2025 profile, L) from the build's domain G and its level offsets;
 *  returns G. L_d = λ(G_d) − o_d + design offsets (MODEL-V3 §2.3), o_d = −REF_OFF[d] (+ RSCH taste). */
export function finishBuild(w: TimelineWorld, b: VersionBuild): number {
  const G = gOfBuild(b);
  const Lg = levelOfG(w, G);
  const off: Partial<Record<DomainId, number>> = {};
  for (const d of DOMAIN_IDS) {
    const x = levelOfG(w, gOfDomain(b, d)) - Lg + (b.offL[d] ?? 0);
    if (Math.abs(x) > 1e-9) off[d] = x;
  }
  b.off = off;
  return G;
}

/** Domain levels L_d = Lg − o_d + off_d, clamped to [0, 15] (MODEL-V3 §2.3): o_d = −REF_OFF[d] is the domain's
 *  constant difficulty offset (the 2025 profile; RD-E01a removed v2's RSCH taste penalty with P19), off_d the version's training and
 *  design specialisation (finishBuild). No era table: a domain lags only by what training gives it. */
export function domainsOf(w: TimelineWorld, G: number, designOff: Partial<Record<DomainId, number>> = {}): Record<DomainId, number> {
  const Lg = levelOfG(w, G);
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) out[d] = clamp(Lg + REF_OFF[d] + (designOff[d] ?? 0), 0, 15);
  return out;
}

/** Recompute a version's derived levels from G (and its build offsets). */
export function refreshLevels(w: TimelineWorld, v: ModelVersion) {
  v.Lg = levelOfG(w, v.G);
  v.domains = domainsOf(w, v.G, v.build?.off ?? {});
}

/** A version's effective compute in a horizon domain (OOM): its domain G plus its level offsets at LEVEL_PER_OOM; a
 *  version without a build: its general G. */
export const horizonG = (_w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>, d: DomainId = 'AGENCY') =>
  v.build ? gOfDomain(v.build, d) + (v.build.offL[d] ?? 0) / LEVEL_PER_OOM : v.G;
/** 50% time horizon in minutes (model v3 V3.2): METR TH1.1's 203 min for the Aug-2025 frontier (V0) × 4.2 per OOM of the
 *  version's AGENCY effective compute over V0's (CODE for software work, departments/workfit.ts), × its horizon
 *  multiplier (long-horizon RL, P07, P12). Replaces the v1 horizon curve on pm. */
export const h50Of = (w: TimelineWorld, v: Pick<ModelVersion, 'G' | 'build'>, d: DomainId = 'AGENCY') =>
  H50_V0_MIN * Math.pow(H50_PER_OOM, horizonG(w, v, d) - gV0(w)) * (v.build?.h80Mult ?? 1);

// ───────────────────────────── start state (§3.1.4 "Initial state") ─────────────────────────────

/** Closed-form start in v2's progress coordinate (kept until RD-U06, SYNTHESIS §6 Phase 2, states the start as data):
 *  B0 started day −120, V0 finished day −20, start know-how pa(t) = pa0 + r0·t before day 0 (r0 = the v2 reference
 *  software rate at start), pa0 solved so that V0 sits at the world's start point p0 (§3.1.4). No lab's capability is
 *  in this coordinate: it only fixes the start recipe vintages (startVintage, gV0), the start labs' lags (core/init.ts),
 *  RefBot's gate conversion and the rivals' start rate. */
const startCache = new WeakMap<TimelineWorld, ReturnType<typeof playerStartOf>>();
/** Start state of world w (cached). */
export function playerStart(w: TimelineWorld): ReturnType<typeof playerStartOf> {
  let x = startCache.get(w);
  if (!x) startCache.set(w, (x = playerStartOf(w)));
  return x;
}
function playerStartOf(w: TimelineWorld) {
  const target = w.p0;
  const Mref = multiplierAt(asV1World(w), w.p0); // v2 reference multiplier at p0: the start software rate (until RD-U06)
  const r0 = w.p0 < stage1(asV1World(w)) ? w.share * Mref : Mref; // years per year
  const pcB0 = pcRefLab(w, B0_START_DAY);
  const dPost = V0_DAY;
  // The v2 start-state solution (post-training retention 0.7, compute term pcB0), kept only so the start know-how pa0
  // (the zero of the start recipe vintages, startVintage) and the start lag stay where they were calibrated.
  const k = START_RETAIN;
  const pa0 = target - pcB0 - (r0 * B0_START_DAY) / 365 - (k * r0 * (dPost - B0_START_DAY)) / 365;
  const paAt = (d: number) => pa0 + (r0 * d) / 365;
  return { pa0, r0, pcB0, paBase: paAt(B0_START_DAY), paPost: paAt(dPost), target, lag: pa0 - target };
}

/** v2's post-training retention, kept only inside the start-state solution (the zero of the know-how readout). Versions
 *  no longer retain know-how: a post-training run applies today's RL recipe only (MODEL-V3 §4.4). */
const START_RETAIN = 0.7;

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
  const pPl = bestG(s, PLAYER_ID);
  const pOt = bestG(s, other);
  if (!Number.isFinite(pOt)) return 0;
  const ahead = pPl >= pOt;
  const leader = ahead ? PLAYER_ID : other;
  const followerL = levelOfG(w, ahead ? pOt : pPl);
  const d = daysSinceLevel(s, leader, followerL, levelOfG(w, ahead ? pPl : pOt));
  if (d !== undefined && d >= 0) return ahead ? d : -d;
  // The history does not reach back to the follower's level (the first weeks of a game): the leader's frontier line
  // before its first sample is the pre-game frontier, which rose at the start's reference rate — the rate every start
  // gap was drawn at (rivals.ts initialRival, china.ts initialChina) — so the lead is the days since the first sample
  // plus the first sample's gap at that rate (model v3 F2: v2's fallback divided by the leader's current research rate,
  // which reads a few weeks of stack growth and put China 390–450 d behind in days 30–60).
  const lead = preHistoryLead(s, leader, ahead ? pPl : pOt, ahead ? pOt : pPl);
  return ahead ? lead : -lead;
}
/** Days since `leader`'s frontier line stood at G `gF`, for a level below its first sample: the time since that sample
 *  plus the gap at the pre-game reference frontier rate (referenceRate at the start, the start gaps' rate, × B G per
 *  progress-year). */
function preHistoryLead(s: GameStateV2, leader: LabId, gLead: number, gF: number): number {
  const w = s.hidden.timeline;
  const rate = Math.max(0.05, preGameRate(w)) * B_G_PER_Y;
  const xs = s.series.L[leader];
  if (!xs?.length) return ((gLead - gF) / rate) * 365;
  const g1 = clamp(gOfLevel(w, xs[0]), gF - 24, gLead + 24 /* was ±20 progress-years */);
  return Math.max(0, s.time.day - s.series.day[0]) + ((g1 - gF) / rate) * 365;
}
/** The pre-game frontier rate (progress-years a year, the start gaps' unit): referenceRate at the start model and 2025.5. */
const preRateMemo = new WeakMap<TimelineWorld, number>();
function preGameRate(w: TimelineWorld): number {
  let r = preRateMemo.get(w);
  if (r === undefined) preRateMemo.set(w, (r = referenceRate(w, playerStart(w).target, 2025.5)));
  return r;
}

// ───────────────────────────── milestones (§3.1.6) ─────────────────────────────

/** milestones (50, daily): first-crossing record per lab (fixes v1 bug #3), SC day, act transitions. The player's are
 *  work-type milestones (model v3 V3.5, departments/workfit.ts: superhuman coder = SWE fit ≥ the best human with coverage
 *  ≥ 0.9 and a lower cost per work-hour, …), recorded in order. Rivals, China and the leader lab (model v3 F1): their
 *  best model's display level λ(G) crosses the milestone's level knot (L 10 = the reference recipe's SC point, …; one
 *  map for every lab, MODEL-V3 §2.2). */
export const milestonesSystem: EngineSystem = {
  id: 'milestones', owner: 'WS1', cadence: 'daily', order: 50, system: 'models',
  run(s, ctx) {
    const w = s.hidden.timeline;
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
      const L = bestLevelOf(w, r);
      record(core, (i) => L >= LEVEL_KNOTS[i] - 1e-9);
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
