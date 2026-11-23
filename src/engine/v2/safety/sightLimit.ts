// Sight limit (SAFETY-REDESIGN §2.2 concept 5, §2.3; SR-11). Owner: WS2.
//
// One number for "are your instruments keeping up?": the highest capability level L in [0, 15] at which the player's
// instruments together still read the hidden-goal traits (CRITICAL_TRAITS) at ≥ 50% believed reliability on average:
//   read_k(L) = combine_t( cov_t,k · reliability_t(x(L), believed) · extrapolation(L − L₀) ),  x(L) = λ⁻¹(L) − G_V0
// where reliability is SR-08's one function per instrument (safety/instruments.ts), so each instrument decays from the
// model it was validated on. Believed inputs only: posterior-mean efficacy, believed eval awareness, the player's own
// training-against history (Sylvester rule). Its range comes from the posterior uncertainty of efficacy. It replaces
// understanding U, its margin, "validated to", "seen to", the likely range, BLIND/AHEAD and the detection grid (the
// per-trait readings at a level stay only as the sight limit's drill-down, sightGrid). The true version
// (trueSightLimit) is engine-only, for endings and analysis.
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { internalVersion, measuredLOf } from '../models/labs';
import type { AgendaId, GameStateV2, ModelVersion, TechniqueState, TraitId } from '../types';
import { hash32 } from '../core/rng';
import { believedEfficacy, clamp01 } from './common';
import { oomOfLevel } from './oversight';
import { combineKeyed, combineTools, groupKeyOf, cotObfuscation, eaSuppression } from './detection';
import { techniqueRole } from './techniques';
import { reliability } from './instruments';

/** The sight limit as the player sees it, for the internal model. `level`: that model's measured level; `gap` =
 *  L − level (negative: the model is beyond what your instruments read); `perTrait`: the reading of each hidden-goal
 *  trait at `level` (drill-down); `none`: no level at all is read at 50% (L is then 0 as a floor, not a level that is read). */
export interface SightLimit { none: boolean; L: number; lo: number; hi: number; level: number; gap: number; versionId?: string; perTrait: Partial<Record<TraitId, number>> }

function detTools(s: GameStateV2): TechniqueState[] {
  return Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active && techniqueRole(t) !== 'fix');
}

/**
 * Projection beyond the model the instruments were checked on (M4) [D]. How well they work on a more capable model is
 * unknown, so believed reliability falls above the current measured level L₀ as 1/(1 + ((L − L₀)/VAL_W)²) (SR-09's
 * validation evidence replaces this). Believed eval awareness is also projected upward with capability (R14: verbalized
 * EA 11.7% → 41–51% across generations): EA(L) = 1 − (1 − EA₀)·exp(−EA_PROJ·(L − L₀)). Both only apply above L₀.
 */
export const VAL_W = 0.75;
export const EA_PROJ = 0.25;
function valAt(dL: number): number {
  return dL <= 0 ? 1 : 1 / (1 + (dL / VAL_W) ** 2);
}
const eaAt = (ea0: number, dL: number) => (dL <= 0 ? ea0 : 1 - (1 - ea0) * Math.exp(-EA_PROJ * dL));

/** Believed reading of trait k on model v at hypothetical level L (the sight limit's per-trait drill-down). */
export function sightAt(s: GameStateV2, v: ModelVersion, trait: TraitId, L: number, tools = detTools(s)): number {
  return detector(s, v, tools, measuredLOf(s, v).L)(trait, L);
}

interface BeliefDraw { eff?: Partial<Record<AgendaId, number>> }
type Det = (trait: TraitId, L: number) => number;

/** Believed readings for many levels at once: SR-08 each instrument's believed reliability (safety/instruments.ts) at
 *  the level, combined over the covering instruments; the covering rows per trait are computed once. */
function detector(s: GameStateV2, v: ModelVersion, tools: TechniqueState[], L0: number, draw?: BeliefDraw): Det {
  const w = s.hidden.timeline;
  const ea0 = (v.beliefs.EA?.est ?? 0.15) * (1 - eaSuppression(s));
  const obf = cotObfuscation(v.beliefs.OBF?.est ?? 0);
  const tl = tools.map((t) => ({ t, eff: draw?.eff?.[t.agenda] }));
  const rows = new Map<TraitId, { i: number; cov: number }[]>();
  const rowKeys = new Map<TraitId, string[]>();
  const rowOf = (trait: TraitId) => {
    let r = rows.get(trait);
    if (r) return r;
    r = [];
    tl.forEach(({ t }, i) => {
      const cov = t.coverage[trait] ?? 0;
      if (cov <= 0) return;
      r!.push({ i, cov });
    });
    rows.set(trait, r);
    rowKeys.set(trait, r.map((x) => groupKeyOf(tl[x.i].t.agenda)));
    return r;
  };
  return (trait: TraitId, L: number) => {
    const x = oomOfLevel(w, L);
    const dL = L - L0;
    const ea = eaAt(ea0, dL);
    const va = valAt(dL);
    const ds: number[] = [];
    for (const row of rowOf(trait)) {
      const { t, eff } = tl[row.i];
      ds.push(row.cov * reliability(s, t, { x, v, trait, eff, ea, obf }, true).value * va);
    }
    return combineKeyed(ds, rowKeys.get(trait)!);
  };
}

function meanDet(det: Det, L: number): number {
  let sum = 0;
  for (const k of CRITICAL_TRAITS) sum += det(k, L);
  return sum / CRITICAL_TRAITS.length;
}

/** The bisection: the largest L in [0, 15] with mean reading ≥ 0.5 (to 0.05). `stop(lo, hi)` may end it early. */
function limitOf(mean: (L: number) => number, stop?: (lo: number, hi: number) => boolean): number {
  if (mean(0) < 0.5) return 0;
  if (mean(15) >= 0.5) return 15;
  let lo = 0;
  let hi = 15;
  while (hi - lo > 0.05) {
    if (stop?.(Math.round(lo * 20) / 20, Math.round(hi * 20) / 20)) break;
    const mid = (lo + hi) / 2;
    if (mean(mid) >= 0.5) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 20) / 20;
}

/** Believed sight limit, point only (no range): the weekly series and the bots. */
export function sightLimitPoint(s: GameStateV2): number {
  const v = internalVersion(s);
  if (!v) return 0;
  const det = detector(s, v, detTools(s), measuredLOf(s, v).L);
  return limitOf((L) => meanDet(det, L));
}

/** Whether the believed gap (sight limit − measured level, to 0.01) is below thr, stopping the bisection once both ends
 *  give the same answer (the result lies in [lo, hi] at every step and the gap is monotone in it: exact). */
export function sightGapBelow(s: GameStateV2, thr: number): boolean {
  const v = internalVersion(s);
  const L0 = measuredLOf(s, v).L;
  const below = (x: number) => Math.round((x - L0) * 100) / 100 < thr;
  if (!v) return below(0);
  const det = detector(s, v, detTools(s), L0);
  return below(limitOf((L) => meanDet(det, L), (lo, hi) => below(lo) === below(hi)));
}

// Range: the sight limit recomputed on BELIEF_DRAWS draws of each line's efficacy from its Beta posterior (normal
// approximation with the posterior's mean and sd, clamped to [0, 1]), the central 80%. Few results leave it wide; more
// narrow it. Draws are a fixed Latin hypercube per world (hash of the seed), so the range does not jitter day to day.
export const BELIEF_DRAWS = 24;
export const SIGHT_RANGE_Q: readonly [number, number] = [0.1, 0.9];

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
function probit(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - 0.02425) return -probit(1 - q);
  const r = q - 0.5;
  const t = r * r;
  return ((((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) * r) / (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
}

const memo = new WeakMap<GameStateV2, { key: string; r: SightLimit }>();

/** The sight limit with its range, for the internal model (EngineApi.sightLimit). Beliefs only. */
export function sightLimit(s: GameStateV2): SightLimit {
  const v = internalVersion(s);
  const level = measuredLOf(s, v).L;
  if (!v) return { none: true, L: 0, lo: 0, hi: 0, level, gap: Math.round(-level * 100) / 100, perTrait: {} };
  const tools = detTools(s);
  const dept = s.player.safety;
  const key = `${s.time.day}|${v.id}|${level}|${dept.findings.length}|${tools.map((t) => `${t.id}:${t.validatedOom}:${t.trainedAgainst}`).join(',')}|${JSON.stringify(v.beliefs.EA)}|${JSON.stringify(v.beliefs.OBF)}`;
  const hit = memo.get(s);
  if (hit?.key === key) return hit.r;
  const det = detector(s, v, tools, level);
  const L = limitOf((x) => meanDet(det, x));
  const ags = [...new Set(tools.map((t) => t.agenda))].filter((a) => dept.agendas[a]).sort();
  const N = BELIEF_DRAWS;
  // Latin hypercube: line j's draw k sits in stratum perm_j(k) of N.
  const strata = (j: string) => Array.from({ length: N }, (_, k) => k).sort((x, y) => hash32(s.setup.seed, `uband:${j}:${x}`) - hash32(s.setup.seed, `uband:${j}:${y}`));
  const pEff = ags.map((a) => strata(a));
  const Ls: number[] = [];
  for (let k = 0; k < N; k++) {
    const eff: Partial<Record<AgendaId, number>> = {};
    ags.forEach((a, i) => {
      const p = dept.agendas[a].posterior;
      const n = p.a + p.b;
      const sd = Math.sqrt((p.a * p.b) / (n * n * (n + 1)));
      eff[a] = clamp01(believedEfficacy(s, a) + sd * probit((pEff[i][k] + 0.5) / N));
    });
    const d = detector(s, v, tools, level, { eff });
    Ls.push(limitOf((x) => meanDet(d, x)));
  }
  Ls.sort((x, y) => x - y);
  const q = (p: number) => {
    const x = p * (N - 1);
    const i = Math.floor(x);
    return Ls[i] + (Ls[Math.min(N - 1, i + 1)] - Ls[i]) * (x - i);
  };
  const r20 = (x: number) => Math.round(x * 20) / 20;
  const perTrait: Partial<Record<TraitId, number>> = {};
  for (const k of CRITICAL_TRAITS) perTrait[k] = Math.round(det(k, level) * 1000) / 1000;
  const r: SightLimit = { none: L === 0 && meanDet(det, 0) < 0.5, L, lo: r20(Math.min(L, q(SIGHT_RANGE_Q[0]))), hi: r20(Math.max(L, q(SIGHT_RANGE_Q[1]))), level, gap: Math.round((L - level) * 100) / 100, versionId: v.id, perTrait };
  memo.set(s, { key, r });
  return r;
}

/** Planned-run readout (for TRAINING): the sight limit beside the planned model's predicted level. `gap` = sight limit −
 *  predicted level; `beyond`: the planned model would sit past what your instruments read at the best guess,
 *  `beyondRange`: past even the top of the range. */
export function plannedSightLimit(s: GameStateV2, predictedL: number) {
  const sl = sightLimit(s);
  const gap = Math.round((sl.L - predictedL) * 100) / 100;
  return { sight: sl.L, lo: sl.lo, hi: sl.hi, planned: predictedL, gap, beyond: gap < 0, beyondRange: sl.hi < predictedL };
}

/** Sight-limit drill-down: the believed reading of each hidden-goal trait on the internal model at levels around its
 *  measured level L (2·span + 1 columns centred on round(L), shifted to stay in 0…15). */
export function sightGrid(s: GameStateV2, span = 4): { L: number; levels: number[]; rows: { trait: TraitId; det: number[] }[] } {
  const v = internalVersion(s);
  const L = measuredLOf(s, v).L;
  const c = Math.round(L);
  const levels: number[] = [];
  const lo = Math.max(0, Math.min(15 - 2 * span, c - span));
  for (let l = lo; l <= Math.min(15, lo + 2 * span); l++) levels.push(l);
  if (!v) return { L, levels, rows: CRITICAL_TRAITS.map((trait) => ({ trait, det: levels.map(() => 0) })) };
  const det = detector(s, v, detTools(s), L);
  return { L, levels, rows: CRITICAL_TRAITS.map((trait) => ({ trait, det: levels.map((l) => det(trait, l)) })) };
}

/**
 * TRUE sight limit (hidden, engine only: endings and analysis): the same bisection on the TRUE reliability of the active
 * instruments on the internal model (true efficacy, true eval awareness projected upward with capability as for the
 * believed one, true masks, OBF and undiscovered U-modes). `level` is the true level Lg.
 */
export function trueSightLimit(s: GameStateV2): { L: number; level: number } {
  const v = internalVersion(s);
  if (!v) return { L: 0, level: 0 };
  const tools = detTools(s);
  const L0 = v.Lg;
  const cache = new Map<number, ModelVersion>();
  const at = (L: number) => {
    let pv = cache.get(L);
    if (!pv) cache.set(L, (pv = { ...v, Lg: L, traitsTrue: { ...v.traitsTrue, EA: eaAt(v.traitsTrue.EA, L - L0) } }));
    return pv;
  };
  const mean = (L: number) => {
    const x = oomOfLevel(s.hidden.timeline, L);
    const pv = at(L);
    let sum = 0;
    for (const k of CRITICAL_TRAITS) {
      const items: { agenda: string; d: number }[] = [];
      for (const t of tools) {
        const cov = t.coverage[k] ?? 0;
        if (cov <= 0) continue;
        const d = reliability(s, t, { x, v: pv, trait: k }, false).value; // SR-08: the one reliability, true version
        if (d > 0) items.push({ agenda: t.agenda, d: cov * d });
      }
      sum += combineTools(items);
    }
    return sum / CRITICAL_TRAITS.length;
  };
  return { L: limitOf(mean), level: L0 };
}
