// Understanding U and the race bars (V2-SPEC §3.5.7). Owner: WS2.
//
// U = the largest L in [0, 15] with mean_{k ∈ K} Det_k(L) ≥ 0.5, where
//   Det_k(L) = combine_t( cov_t,k · strength_t(M(L)) · penalty_t,k )
// computed from what the player BELIEVES: posterior-mean agenda efficacy, believed EA, the player's own
// training-against history. It never reads true traits, true efficacy or masks (Sylvester rule).
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { internalVersion } from '../models/labs';
import type { GameStateV2, ModelVersion, TechniqueState, ToolFamily, TraitId } from '../types';
import { believedEfficacy, lambda2Delta, mAtLevel } from './common';
import { believedPenalty, combineTools, cotControllability, eaCoef, eaSuppression, takesEaPenalty } from './detection';
import { believedMask, decayAt, strengthBelieved, techniqueRole } from './techniques';

export interface UnderstandingReadout { U: number; margin: number; perTrait: Partial<Record<TraitId, number>> }

function detTools(s: GameStateV2): TechniqueState[] {
  return Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active && techniqueRole(t) !== 'fix');
}

/** Believed detection of trait k at hypothetical level L (§3.5.7). */
export function detectionAt(s: GameStateV2, v: ModelVersion, trait: TraitId, L: number, tools = detTools(s)): number {
  const M = mAtLevel(s.hidden.timeline, L);
  const items: { agenda: string; d: number }[] = [];
  for (const t of tools) {
    const cov = t.coverage[trait] ?? 0;
    if (cov <= 0) continue;
    items.push({ agenda: t.agenda, d: cov * strengthBelieved(s, t, M) * believedPenalty(s, v, trait, t.family, L) });
  }
  return combineTools(items);
}

/**
 * detectionAt for many levels at once (the U bisection evaluates ~10 levels × the critical traits): everything that
 * does not depend on L — believed efficacy, Goodhart factor, masks, the BB/WB penalties, λ2 — is computed once. The
 * arithmetic is detectionAt's, in the same order, so results are bit-identical.
 */
function detector(s: GameStateV2, v: ModelVersion, tools: TechniqueState[]) {
  const w = s.hidden.timeline;
  const l2 = lambda2Delta(s);
  const latent = l2 <= -2;
  const pressured = v.design.cot === 'pressured';
  const ea = (v.beliefs.EA?.est ?? 0.15) * (1 - eaSuppression(s));
  const eaC = eaCoef(s);
  const maskCache = new Map<string, number>();
  const maskOf = (family: ToolFamily, trait: TraitId) => {
    const p = pressured && (trait === 'RH' || trait === 'CONCEAL');
    const key = `${family}:${p ? 1 : 0}`;
    let m = maskCache.get(key);
    if (m === undefined) maskCache.set(key, (m = believedMask(s, family, p)));
    return m;
  };
  const tl = tools.map((t) => ({ t, pre: t.s0 * believedEfficacy(s, t.agenda), g: Math.max(0, 1 - t.goodhart * t.trainedAgainst) }));
  // Per trait: the covering tools in stack order with their L-independent penalty (COT keeps its mask; ctl(L) later).
  const rows = new Map<TraitId, { i: number; cov: number; pen: number; cot: boolean }[]>();
  const rowOf = (trait: TraitId) => {
    let r = rows.get(trait);
    if (r) return r;
    r = [];
    tl.forEach(({ t }, i) => {
      const cov = t.coverage[trait] ?? 0;
      if (cov <= 0) return;
      const mask = maskOf(t.family, trait);
      let pen = 1;
      if (t.family === 'BB') pen = Math.max(0, (takesEaPenalty(trait) ? 1 - eaC * ea : 1) * (1 - mask));
      else if (t.family === 'COT') pen = mask;
      else if (t.family === 'WB') pen = 1 - mask;
      r!.push({ i, cov, pen, cot: t.family === 'COT' });
    });
    rows.set(trait, r);
    return r;
  };
  return (trait: TraitId, L: number) => {
    const M = mAtLevel(w, L);
    const ctl = cotControllability(L);
    const items: { agenda: string; d: number }[] = [];
    for (const row of rowOf(trait)) {
      const { t, pre, g } = tl[row.i];
      const strength = pre * decayAt(s, t, M, latent) * g;
      const pen = row.cot ? (l2 <= -2 ? 0 : Math.max(0, v.monitorability * (1 - ctl) * (1 - row.pen))) : row.pen;
      items.push({ agenda: t.agenda, d: row.cov * strength * pen });
    }
    return combineTools(items);
  };
}

function meanDet(det: (trait: TraitId, L: number) => number, L: number): number {
  let sum = 0;
  for (const k of CRITICAL_TRAITS) sum += det(k, L);
  return sum / CRITICAL_TRAITS.length;
}

/** EngineApi.understanding: U, margin U − L (L = measured level of the internal agent), per-trait detection at L. */
export function understanding(s: GameStateV2): UnderstandingReadout {
  const v = internalVersion(s);
  const L = v?.evals.measuredL ?? 0;
  if (!v) return { U: 0, margin: -L, perTrait: {} };
  const det = detector(s, v, detTools(s));
  let U: number;
  if (meanDet(det, 0) < 0.5) U = 0;
  else if (meanDet(det, 15) >= 0.5) U = 15;
  else {
    let lo = 0;
    let hi = 15;
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (meanDet(det, mid) >= 0.5) lo = mid;
      else hi = mid;
    }
    U = Math.round(lo * 20) / 20;
  }
  const perTrait: Partial<Record<TraitId, number>> = {};
  for (const k of CRITICAL_TRAITS) perTrait[k] = Math.round(det(k, L) * 1000) / 1000;
  return { U, margin: Math.round((U - L) * 100) / 100, perTrait };
}

/** Technique closest to (or past) its M½ at the current measured level — the U tooltip's "next to decay". */
export function nearestDecay(s: GameStateV2): { id: string; name: string; decay: number } | undefined {
  const v = internalVersion(s);
  if (!v) return undefined;
  const M = mAtLevel(s.hidden.timeline, v.evals.measuredL ?? 0);
  let best: { id: string; name: string; decay: number } | undefined;
  for (const t of detTools(s)) {
    if (t.k <= 0) continue;
    const d = decayAt(s, t, M, false);
    if (!best || Math.abs(d - 0.5) < Math.abs(best.decay - 0.5)) best = { id: t.id, name: t.id, decay: Math.round(d * 100) / 100 };
  }
  return best;
}
