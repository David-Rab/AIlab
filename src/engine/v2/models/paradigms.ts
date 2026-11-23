// Paradigm readers (V2-SPEC §3.3.3). Owner: WS1.
// Since R4 paradigms are tech-tree nodes (models/tree.ts): research projects staffed by science teams, no tier or
// measured-level gates, no FTE taken from research. RD-R04: a paradigm is adopted when its tree node is known (the
// tree is the only state; the consuming systems call `adopted`).
import { PARADIGMS, type ParadigmDef } from '../../../data/v2/paradigms';
import type { DomainId, GameStateV2 } from '../types';

export const PARADIGM_BY_ID = Object.fromEntries(PARADIGMS.map((p) => [p.id, p])) as Record<string, ParadigmDef>;

/** Whether the player has adopted paradigm `id`: its tree node is known (★ P01–P04 from the start; capability paradigms
 *  once built in; P27 when its AG17 test works). */
export const adopted = (s: GameStateV2, id: string) => s.player.tree[id]?.status === 'known';

/** Best measured domain level across non-retired versions (benchmark-based, visible). */
export function measuredDomain(s: GameStateV2, d: DomainId): number {
  let best = 0;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || v.evals.measuredL === undefined) continue;
    best = Math.max(best, v.evals.measuredDom?.[d] ?? v.domains[d] + (v.evals.measuredL - v.Lg)); // RD-M01(b): the benchmark fit; fallback only for a record with no fit for d
  }
  return best;
}
