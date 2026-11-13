// Relation commitments: predicates, breaks, amendments, statutory floors (V2-SPEC §3.9.4). Owner: WS4.
import type { Commitment, GameStateV2 } from '../types';

export type CommitmentPredicate = (s: GameStateV2, params: Commitment['condition']['params']) => boolean;

/** Predicate registry by id; true = the commitment currently BLOCKS/binds. TODO(WS4, M1): implement each. */
export const PREDICATES: Record<string, CommitmentPredicate> = {
  noDeployAbove: () => false,
  preDeployTesting: () => false,
  monitorabilityPledge: () => false,
  noSurveillance: () => false,
  noAutonomousWeapons: () => false,
  pauseIfRedline: () => false,
  incidentReporting: () => false,
  whistleblower: () => false,
  communityPledge: () => false,
};

export function liveCommitments(s: GameStateV2): Commitment[] {
  return s.commitments.filter((c) => c.status === 'live');
}
