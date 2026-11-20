// Safety agents (V2-SPEC §3.5.2 addendum; model v3 E2). Owner: WS2.
//
// AI labour on safety work runs on the safety-research agent package (R7, player.agents.safety):
//   compute  = computeOnline × split.safety × agents.safety.compute   (a share of the safety pool)
//   model    = agents.safety.versionId (default: the routine-research model). An older, trusted model is weaker (lower
//              SAF_* coverage) but its sabotage odds are its own.
// Model v3 E2: the package's labour comes from the SAF_EXP and SAF_IDEAS work types through the capabilities labour
// function (departments/workfit.ts safetyLabour: coverage from fit and horizon, FTE and copies from compute and FLOP per
// token, the coding CES). Trusted to AI (one policy, R7) is the share t of safety work handed to the agents; the
// agents do the part of it they cover. v2's special cases are gone: no level gate (AUTOMATE_MIN_L; coverage gates it),
// no √M or min(10, √M) cap, no 50% cap on the policy.
import type { GameStateV2, ModelVersion } from '../types';
import { SAF_STAGES } from '../../../data/v2/agendas';
import { WORK_TYPES } from '../../../data/v2/workTypes';
import { agentVersion } from '../departments/agents';
import { safetyLabour } from '../departments/workfit';

/** Version running the safety agents (falls back to the routine-research model when unset or retired). */
export function safetyAgentVersion(s: GameStateV2): ModelVersion | undefined {
  return agentVersion(s, 'safety');
}

/** Measured level of a model (default: the one running the safety agents). */
export function safetyAgentL(s: GameStateV2, v: ModelVersion | undefined = safetyAgentVersion(s)): number {
  return v?.evals.measuredL ?? 0;
}

/** H100e on safety agents. */
export const safetyAgentCompute = (s: GameStateV2) => s.player.computeOnline * s.player.split.safety * s.player.agents.safety.compute;

/** Trusted to AI in effect: the policy share while the safety agents run (a model and compute), else 0. */
export const trustedShare = (s: GameStateV2): number => safetyLabour(s).t;

/** Share of safety research work AI does on its own (A = Trusted to AI × coverage, per work type), ideas and experiments
 *  weighted by their stage shares of a line project: the weight of a FALSE result (findings.ts). Not the AI part of the
 *  labour margin (1 − w_H), which falls towards 0 when AI labour is abundant although AI does the covered work. */
export function aiShareOf(ideasA: number, expA: number): number {
  return SAF_STAGES.idea * ideasA + (1 - SAF_STAGES.idea) * expA;
}

export interface SafetyFleet {
  versionId?: string;
  compute: number;
  copies: number;
  /** AI researcher-equivalents the package supplies (both safety work types). */
  aiFte: number;
  /** AI FTE per human FTE on safety work (scientists on lines and safety research engineers). */
  perFte: number;
  /** Share of safety work AI does on its own (stage-weighted A). */
  aiShare: number;
}

/** Size of the safety agent fleet and the share of safety work it does (readouts). */
export function safetyFleet(s: GameStateV2): SafetyFleet {
  const sl = safetyLabour(s);
  const aiFte = sl.exp.aiFte + sl.ideas.aiFte;
  const heads = sl.exp.H * WORK_TYPES.SAF_EXP.heads + sl.ideas.H * WORK_TYPES.SAF_IDEAS.heads;
  return {
    versionId: sl.versionId, compute: sl.h100e, copies: sl.exp.copies + sl.ideas.copies, aiFte,
    perFte: heads > 0 ? aiFte / heads : 0, aiShare: aiShareOf(sl.ideas.A, sl.exp.A),
  };
}
