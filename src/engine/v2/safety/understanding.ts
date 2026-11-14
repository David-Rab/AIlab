// Understanding U and the race bars (V2-SPEC §3.5.7). Owner: WS2.
//
// U = the largest L in [0, 15] with mean_{k ∈ K} Det_k(L) ≥ 0.5, where
//   Det_k(L) = combine_t( cov_t,k · strength_t(M(L)) · penalty_t,k )
// computed from what the player BELIEVES: posterior-mean agenda efficacy, believed EA, the player's own
// training-against history. It never reads true traits, true efficacy or masks (Sylvester rule).
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { internalVersion } from '../models/labs';
import type { GameStateV2, ModelVersion, TechniqueState, TraitId } from '../types';
import { mAtLevel } from './common';
import { believedPenalty, combineTools } from './detection';
import { decayAt, strengthBelieved, techniqueRole } from './techniques';

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

function meanDet(s: GameStateV2, v: ModelVersion, L: number, tools: TechniqueState[]): number {
  let sum = 0;
  for (const k of CRITICAL_TRAITS) sum += detectionAt(s, v, k, L, tools);
  return sum / CRITICAL_TRAITS.length;
}

/** EngineApi.understanding: U, margin U − L (L = measured level of the internal agent), per-trait detection at L. */
export function understanding(s: GameStateV2): UnderstandingReadout {
  const v = internalVersion(s);
  const L = v?.evals.measuredL ?? 0;
  if (!v) return { U: 0, margin: -L, perTrait: {} };
  const tools = detTools(s);
  let U: number;
  if (meanDet(s, v, 0, tools) < 0.5) U = 0;
  else if (meanDet(s, v, 15, tools) >= 0.5) U = 15;
  else {
    let lo = 0;
    let hi = 15;
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (meanDet(s, v, mid, tools) >= 0.5) lo = mid;
      else hi = mid;
    }
    U = Math.round(lo * 20) / 20;
  }
  const perTrait: Partial<Record<TraitId, number>> = {};
  for (const k of CRITICAL_TRAITS) perTrait[k] = Math.round(detectionAt(s, v, k, L, tools) * 1000) / 1000;
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
