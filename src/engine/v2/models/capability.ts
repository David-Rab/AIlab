// Capability: compute component, version pm, levels, domains, horizons, milestones, true lead
// (V2-SPEC §3.1.3–3.1.6). Owner: WS1.
import { B0_START_DAY, KAPPA, LEVEL_KNOTS, POST_PA_AT, REF_OFF, RSCH_TASTE_PENALTY, DOMAIN_IDS, V0_DAY } from '../../../data/v2/calibration';
import { horizonAt, milestoneThresholds, multiplierAt, stage1 } from '../../../data/world';
import { clamp } from '../../rng';
import { START_DATE, dayOfDate, decimalYearOf } from '../core/time';
import { shareRefAt } from '../departments/split';
import { frontierFlop, gF, refTotal } from '../production/knots';
import { asV1World, capIndexV2, levelOf, thresholds } from '../world/calibration';
import type { Day, DomainId, EngineSystem, GameStateV2, LabId, MilestoneIdx, ModelVersion, TimelineWorld, VersionBuild } from '../types';
import { PLAYER_ID, bestPm, internalVersion, labCore, otherLabs } from './labs';

/** In-game milestone names (no canon tags, §3.1.6). */
export const MILESTONE_NAMES = ['Agent', 'Reliable agent', 'Research agent', 'Superhuman coder', 'Superhuman AI researcher', 'Superintelligent AI researcher', 'Superintelligence'];

export { levelOf };

const DAY_2029 = dayOfDate(START_DATE, '2029-01-01');

/** Decimal year of a day (v1 convention) on the standard start date. */
export const yearOfDay = (day: Day) => decimalYearOf(START_DATE, day);

// ───────────────────────────── compute component (§3.1.3) ─────────────────────────────

/** pcRef_lab(t) = (1 − share)·∫₀^min(t, scDay) computePace dt (years; t < 0 extrapolates linearly). */
export function pcRefLab(w: TimelineWorld, day: Day, scDay?: Day): number {
  const t = scDay !== undefined ? Math.min(day, scDay) : day;
  const pre = Math.min(t, DAY_2029);
  const post = Math.max(0, t - DAY_2029);
  return ((1 - w.share) * (pre + 0.5 * post)) / 365;
}

/** pc(base) = pcRef_lab(t0) + (1 − share)·ln(FLOP/F(t0))/ln gF(t0). A 1F base at reference = old compute share. */
export function pcOfBase(w: TimelineWorld, startDay: Day, flop: number, scDay?: Day): number {
  const yr = yearOfDay(startDay);
  return pcRefLab(w, startDay, scDay) + ((1 - w.share) * Math.log(flop / frontierFlop(w, yr))) / Math.log(gF(w, yr));
}

/** Compute increment of a continue-train run: +(1 − share)·ln(1 + FLOP_cont/FLOP_parent)/ln gF (§3.3.1). */
export function pcContinue(w: TimelineWorld, day: Day, flopCont: number, flopParent: number): number {
  return ((1 - w.share) * Math.log(1 + flopCont / Math.max(1, flopParent))) / Math.log(gF(w, yearOfDay(day)));
}

// ───────────────────────────── versions (§3.1.4) ─────────────────────────────

/** pm = paBase + κ·(paPost − paBase) + pc(base) + Σ Δp_design + Δp_data. */
export const pmOfBuild = (b: VersionBuild) => b.paBase + b.kappa * (b.paPost - b.paBase) + b.pc + b.dp;

/** Domain levels L_d = Lg + refOff_d(era) + Σ designOff_d, clamped to [0, 15] (§3.1.5). */
export function domainsOf(w: TimelineWorld, pm: number, designOff: Partial<Record<DomainId, number>> = {}, hasP19 = false): Record<DomainId, number> {
  const Lg = levelOf(w, pm);
  const ci = clamp(capIndexV2(w, pm), 0, 6);
  const i = Math.min(5, Math.floor(ci));
  const t = ci - i;
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) {
    const ref = REF_OFF[d][i] + (REF_OFF[d][i + 1] - REF_OFF[d][i]) * t;
    const pen = d === 'RSCH' && !hasP19 ? RSCH_TASTE_PENALTY : 0;
    out[d] = clamp(Lg + ref + pen + (designOff[d] ?? 0), 0, 15);
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

/** 80% time horizon in minutes: horizonAt(w, pm + calShift)·2^(designOff_AGENCY/0.8)·h80Mult (§3.1.5). */
export function h80Of(w: TimelineWorld, v: Pick<ModelVersion, 'pm' | 'build'>): number {
  const ag = v.build?.off.AGENCY ?? 0;
  return horizonAt(asV1World(w), v.pm + w.calShift) * Math.pow(2, ag / 0.8) * (v.build?.h80Mult ?? 1);
}
/** h50 = 6·h80 (R12 §0.5, METR). */
export const h50Of = (w: TimelineWorld, v: Pick<ModelVersion, 'pm' | 'build'>) => 6 * h80Of(w, v);

// ───────────────────────────── start state (§3.1.4 "Initial state") ─────────────────────────────

/** Closed-form start: B0 started day −120 (pc extrapolated), V0 finished day −20, pa(t) = pa0 + r0·t before day 0
 *  (r0 = the reference software rate at start). pa0 is solved so that pm(V0) = p0 (§3.1.4). V0's v1-equivalent
 *  progress is q = p0 + calShift: calShift is the lag of RefBot's deployed model behind its know-how frontier that
 *  the shifted thresholds absorb (§7.1). */
export function playerStart(w: TimelineWorld) {
  const target = w.p0;
  const Mref = multiplierAt(asV1World(w), w.p0);
  const r0 = w.p0 < stage1(asV1World(w)) ? w.share * Mref : Mref; // years per year
  const pcB0 = pcRefLab(w, B0_START_DAY);
  const dPost = POST_PA_AT === 'end' ? V0_DAY : V0_DAY - 77;
  const k = KAPPA.post;
  const pa0 = target - pcB0 - (r0 * B0_START_DAY) / 365 - (k * r0 * (dPost - B0_START_DAY)) / 365;
  const paAt = (d: number) => pa0 + (r0 * d) / 365;
  return { pa0, r0, pcB0, paBase: paAt(B0_START_DAY), paPost: paAt(dPost), target, lag: pa0 - target };
}

/** Average base age (days since base start) under the reference cadence: a 9-month cycle of ~121-day runs. */
export const REF_BASE_AGE = 256;
/** Average age of the newest post-trained version before continual learning (6-week cadence + eval) [D]. */
export const REF_POST_AGE = 60;

/**
 * Typical lag (years) of a lab's deployed model behind its know-how frontier pa + pcRef under the reference cadence
 * (what RefBot experiences on average): base staleness (1 − share)·age, plus before continual learning the κ loss
 * (1 − κ)·r·age and the version age r·60 d; with continual learning (from the Research-agent level, q ≥ thr[2], the
 * AI 2027 online learner) only the 7-day stream lag r·7 d. `rate` is the lab's software rate (years/year).
 */
export function simpleLag(w: TimelineWorld, q: number, rate: number): number {
  const th = milestoneThresholds(asV1World(w));
  const stale = ((1 - w.share) * REF_BASE_AGE) / 365;
  const stream = q >= th[2];
  return stale + (stream ? (rate * 7) / 365 : ((1 - KAPPA.post) * rate * REF_BASE_AGE) / 365 + (rate * REF_POST_AGE) / 365);
}

/** Software rate of a lab at reference inputs at q (for the start state). */
const refSoftwareRate = (w: TimelineWorld, q: number) => (q < stage1(asV1World(w)) ? w.share * multiplierAt(asV1World(w), q) : multiplierAt(asV1World(w), q));

/** Default frontier of a SimpleModel lab (rivals/China while not WS4-managed): pa + pcRef_lab(t) + its training
 *  scale term − the reference release lag (simpleLag), so a lab at reference inputs moves like RefBot. */
export function simpleFrontierPm(s: GameStateV2, lab: LabId, day = s.time.day): number {
  const core = labCore(s, lab);
  if (!core) return -Infinity;
  const w = s.hidden.timeline;
  const F = core.pa + pcRefLab(w, day, core.scDay) + trainScaleTerm(s, lab, day);
  const rate = core.prodCache?.rate ?? refSoftwareRate(w, F + w.calShift);
  return F - simpleLag(w, F + w.calShift - simpleLag(w, F + w.calShift, rate), rate);
}

/** Start know-how pa of a SimpleModel lab whose start model is `pm0` (inverse of simpleFrontierPm at day 0). */
export function simpleStartPa(s: GameStateV2, lab: LabId, pm0: number): number {
  const w = s.hidden.timeline;
  const q = pm0 + w.calShift;
  const rate = labCore(s, lab)?.prodCache?.rate ?? refSoftwareRate(w, q); // the rate the frontier will use
  return pm0 + simpleLag(w, q, rate) - pcRefLab(w, 0) - trainScaleTerm(s, lab, 0);
}

/** Know-how pa at which a SimpleModel lab's frontier (simpleFrontierPm) equals `pm` today — the inverse WS4 uses when
 *  a lab's model jumps (weights theft): its know-how is set consistently with the model it now holds. */
export function simplePaFor(s: GameStateV2, lab: LabId, pm: number): number {
  const w = s.hidden.timeline;
  const day = s.time.day;
  const core = labCore(s, lab);
  const q = pm + w.calShift;
  const rate = core?.prodCache?.rate ?? refSoftwareRate(w, q);
  return pm + simpleLag(w, q, rate) - pcRefLab(w, day, core?.scDay) - trainScaleTerm(s, lab, day);
}

/** (1 − share)·ln(training pool / reference training pool)/ln gF: what the lab's base-run scale adds (§3.1.3). */
export function trainScaleTerm(s: GameStateV2, lab: LabId, day = s.time.day): number {
  const core = labCore(s, lab);
  if (!core) return 0;
  const w = s.hidden.timeline;
  const yr = yearOfDay(day);
  const ratio = (core.computeOnline * core.split.training) / Math.max(1, refTotal(w, yr) * shareRefAt(yr).training);
  return ((1 - w.share) * Math.log(clamp(ratio, 0.02, 50))) / Math.log(gF(w, yr));
}

// ───────────────────────────── lead (hidden) ─────────────────────────────

/** Days since `lab`'s weekly level series first reached `L` (interpolated); undefined if never. */
function daysSinceLevel(s: GameStateV2, lab: LabId, L: number): number | undefined {
  const xs = s.series.L[lab];
  const days = s.series.day;
  if (!xs?.length) return undefined;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] >= L) {
      if (i === 0) return undefined; // the history does not reach back far enough
      const f = (L - xs[i - 1]) / Math.max(1e-9, xs[i] - xs[i - 1]);
      return s.time.day - (days[i - 1] + f * (days[i] - days[i - 1]));
    }
  }
  return undefined;
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
  const d = daysSinceLevel(s, leader, followerL);
  if (d !== undefined && d >= 0) return ahead ? d : -d;
  // Fallback: gap / the leader's model progress rate (software rate + the Stage-1 compute share).
  const pr = labCore(s, leader)?.prodCache;
  const rate = Math.max(0.05, (pr?.rate ?? 1) + (pr?.stage === 2 ? 0 : 1 - w.share));
  return ((pPl - pOt) / rate) * 365;
}

// ───────────────────────────── milestones (§3.1.6) ─────────────────────────────

/** milestones (50, daily): first-crossing record per lab (fixes v1 bug #3), SC day, act transitions. */
export const milestonesSystem: EngineSystem = {
  id: 'milestones', owner: 'WS1', cadence: 'daily', order: 50,
  run(s, ctx) {
    const w = s.hidden.timeline;
    const thr = thresholds(w);
    const check = (id: LabId) => {
      const core = labCore(s, id);
      if (!core || core.status !== 'active') return;
      const pm = bestPm(s, id);
      for (let i = 0; i < thr.length; i++) {
        const idx = i as MilestoneIdx;
        if (pm >= thr[i] && core.milestoneDays[idx] === undefined) {
          core.milestoneDays[idx] = ctx.day;
          if (idx === 3 && core.scDay === undefined) core.scDay = ctx.day;
        }
      }
    };
    check(PLAYER_ID);
    for (const r of otherLabs(s)) check(r.core.id); // China's lab core id is CHINA_ID

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
