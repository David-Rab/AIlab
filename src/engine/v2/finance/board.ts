// Board: seats, stances, approvals, confidence, ouster (V2-SPEC §3.7.5; research/15 §1.6). Owner: WS3.
import type { Board, BoardSeat, EngineSystem, GovernancePresetId } from '../types';

// Stance vectors are (speed, fin, safety, mission) [D].
const SEAT: Record<BoardSeat['kind'], [number, number, number, number]> = {
  founder: [0.6, 0.3, 0.2, 0.3],
  mission: [-0.3, -0.1, 0.8, 0.9],
  financial: [0.5, 0.9, -0.1, -0.2],
  strategic: [0.4, 0.6, 0, -0.2],
  independent: [0.1, 0.3, 0.4, 0.3],
  gov: [0.2, 0, 0.5, 0.3],
};

const seat = (kind: BoardSeat['kind'], holder: string, weight = 1): BoardSeat => ({ kind, holder, stance: [...SEAT[kind]], weight });

export function initialBoard(preset: GovernancePresetId): Board {
  const seats: BoardSeat[] =
    preset === 'founder'
      ? [seat('founder', 'CEO', 2), seat('financial', 'Lead investor'), seat('independent', 'Independent')]
      : preset === 'legacyNonprofit'
        ? [seat('founder', 'CEO'), seat('mission', 'Nonprofit board', 1), seat('mission', 'Nonprofit board', 1), seat('independent', 'Independent'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)]
        : [seat('founder', 'CEO'), seat('mission', 'Trust / PBC board'), seat('financial', 'Lead investor'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)];
  return { preset, seats, confidence: 70, pendingApprovals: [], safetyCommitteeVeto: preset === 'nonprofitPBC' };
}

/** boardQ (430, quarterly): board confidence and approvals, runway state machine, ouster roll. TODO(WS3, M1). */
export const boardQSystem: EngineSystem = {
  id: 'boardQ', owner: 'WS3', cadence: 'quarterly', order: 430,
  run() {},
};
