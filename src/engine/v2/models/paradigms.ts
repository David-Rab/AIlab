// Paradigm readers (V2-SPEC §3.3.3). Owner: WS1.
// Since R4 paradigms are tech-tree nodes (models/tree.ts): research projects staffed by science teams, no tier or
// measured-level gates, no FTE taken from research. A node that works sets `player.paradigms[id].status = 'adopted'`
// and its effect applies at once in the consuming systems (which call `adopted`).
import { PARADIGMS, PARADIGM_DOMAIN_OFF, type ParadigmDef } from '../../../data/v2/paradigms';
import type { DomainId, GameStateV2, ParadigmState } from '../types';

export const PARADIGM_BY_ID = Object.fromEntries(PARADIGMS.map((p) => [p.id, p])) as Record<string, ParadigmDef>;

/** Start state: P01–P04 (★ nodes) adopted, the rest available. */
export function initialParadigms(): Record<string, ParadigmState> {
  const out: Record<string, ParadigmState> = {};
  for (const p of PARADIGMS) {
    const isAdopted = p.prior >= 1;
    out[p.id] = { status: isAdopted ? 'adopted' : 'available', progress: isAdopted ? 1 : 0 };
    if (isAdopted) out[p.id].revealedDay = 0;
  }
  return out;
}

/** Whether the player has adopted paradigm `id`. */
export const adopted = (s: GameStateV2, id: string) => s.player.paradigms[id]?.status === 'adopted';

/** Domain offsets from adopted paradigms (applied to new versions). */
export function paradigmOff(s: GameStateV2): Partial<Record<DomainId, number>> {
  const out: Partial<Record<DomainId, number>> = {};
  for (const [id, off] of Object.entries(PARADIGM_DOMAIN_OFF)) {
    if (!adopted(s, id)) continue;
    for (const [d, v] of Object.entries(off) as [DomainId, number][]) out[d] = (out[d] ?? 0) + v;
  }
  return out;
}

/** Best measured domain level across non-retired versions (benchmark-based, visible). */
export function measuredDomain(s: GameStateV2, d: DomainId): number {
  let best = 0;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || v.evals.measuredL === undefined) continue;
    best = Math.max(best, v.domains[d] + (v.evals.measuredL - v.Lg)); // measured offset applied to the domain
  }
  return best;
}
