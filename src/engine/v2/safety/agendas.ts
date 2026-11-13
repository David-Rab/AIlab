// Safety agendas: funding, finding hazards, posteriors (V2-SPEC §3.5.2–3.5.3). Owner: WS2.
import { AGENDAS, FUNDING_LEVELS } from '../../../data/v2/agendas';
import { EDGES } from '../../../data/v2/edges';
import type { AgendaId, AgendaState, EngineSystem, SafetyDept } from '../types';

/** Agendas funded at start (Seed ≈ RefBot's ~3% safety compute: AG02, AG07, AG08, AG18) [D]. */
export const START_FUNDING: Partial<Record<AgendaId, keyof typeof FUNDING_LEVELS>> = {
  AG02: 'serious', AG07: 'seed', AG08: 'serious', AG16: 'seed', AG18: 'serious',
};

/** Player safety department at game start. */
export function initialSafetyDept(): SafetyDept {
  const agendas = {} as Record<AgendaId, AgendaState>;
  const funded = AGENDAS.filter((a) => START_FUNDING[a.id]);
  for (const a of AGENDAS) {
    const level = START_FUNDING[a.id];
    const fte = level ? Math.round(a.fteRef * FUNDING_LEVELS[level]) : 0;
    agendas[a.id] = {
      fte,
      computeShare: level ? 1 / funded.length : 0,
      aiLabour: 0,
      hazardAcc: 0,
      posterior: { a: a.prior[0], b: a.prior[1] },
      status: level ? 'active' : 'idle',
    };
  }
  return {
    agendas,
    techniques: {}, // TODO(WS2): seed from data/v2/techniques.ts (startUnlocked)
    findings: [],
    investigations: [],
    incidents: [],
    discoveredUModes: [],
    evalGate: 'full',
    monitoringShare: 0.2,
    monitorabilityCommitment: false,
    edgeGrades: Object.fromEntries(EDGES.map((e) => [e.id, e.grade])),
    edgeRevealed: Object.fromEntries(EDGES.map((e) => [e.id, false])),
  };
}

/** safetyResearch (70, daily): agenda hazards → findings; investigations; technique strength; U. TODO(WS2, M1). */
export const safetyResearchSystem: EngineSystem = {
  id: 'safetyResearch', owner: 'WS2', cadence: 'daily', order: 70,
  run() {},
};
