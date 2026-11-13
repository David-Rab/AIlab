// Paradigm research projects (V2-SPEC §3.3.3). Owner: WS1.
import { PARADIGMS } from '../../../data/v2/paradigms';
import type { GameStateV2, ParadigmState, SystemCtx } from '../types';

/** Start state: P01–P04 adopted, other tier-1 available, the rest locked. */
export function initialParadigms(): Record<string, ParadigmState> {
  const out: Record<string, ParadigmState> = {};
  for (const p of PARADIGMS) {
    const adopted = p.effortDays === 0;
    out[p.id] = { status: adopted ? 'adopted' : p.tier === 1 ? 'available' : 'locked', progress: adopted ? 1 : 0, fte: 0, expShare: 0 };
    if (adopted) out[p.id].revealedDay = 0;
  }
  return out;
}

/** Daily paradigm progress and reveal of hidden success. TODO(WS1, M1): call from the runs system. */
export function advanceParadigms(_s: GameStateV2, _ctx: SystemCtx): void {}
