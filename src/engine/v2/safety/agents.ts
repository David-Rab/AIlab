// Safety agent fleet (V2-SPEC §3.5.2 addendum). Owner: WS2.
//
// AI labour on safety work runs on its own fleet, the safety-research agent package (R7, player.agents.safety):
//   compute  = computeOnline × split.safety × agents.safety.compute   (a share of the safety pool)
//   model    = agents.safety.versionId (default: the routine-research model). An older, trusted model is weaker but
//              its sabotage odds are its own.
//   AI FTE   = compute × AI FTE per H100e of that model (the production function's R(q) and ηmod, §3.2.1)
// Trusted to AI (one policy, R7; it replaced per-agenda automation) is the share t of every funded agenda's and open
// investigation's work handed to the fleet. A piece of work with human FTE n and AI FTE a gets labour multiplier
// min(cap, √(1 + Auto·a/n)), where cap = 1 + t·Auto·min(10, √M_model) is the pre-fleet multiplier (§3.5.3): compute
// decides how close to the cap you get. Below the AI-labour gate (B3) t is 0.
import { H100E_PER_COPY_SC } from '../../../data/v2/calibration';
import { AGENDA_BY_ID, AUTOMATE_MIN_L } from '../../../data/v2/agendas';
import { agentVersion, trustedMax } from '../departments/agents';
import { aiFtePerH100e } from '../production/production';
import type { AgendaId, GameStateV2, ModelVersion } from '../types';

/** Version running the safety agents (falls back to the routine-research model when unset or retired). */
export function safetyAgentVersion(s: GameStateV2): ModelVersion | undefined {
  return agentVersion(s, 'safety');
}

/** Measured level of a model (default: the one running the safety agents). */
export function safetyAgentL(s: GameStateV2, v: ModelVersion | undefined = safetyAgentVersion(s)): number {
  return v?.evals.measuredL ?? 0;
}

/** The one gate on safety AI labour (B3): agendas, investigations and the safety agent fleet all need a model at
 *  measured level ≥ AUTOMATE_MIN_L. Returns true or the reason. */
export function aiLabourGate(s: GameStateV2, v: ModelVersion | undefined = safetyAgentVersion(s)): true | string {
  return safetyAgentL(s, v) >= AUTOMATE_MIN_L || `Needs a safety agent model at measured level ≥ ${AUTOMATE_MIN_L}`;
}

/** H100e on safety agents. */
export const safetyAgentCompute = (s: GameStateV2) => s.player.computeOnline * s.player.split.safety * s.player.agents.safety.compute;

/** Trusted to AI in effect: the policy share (capped, see trustedMax) when the safety model passes the AI-labour gate;
 *  otherwise 0. */
export function trustedShare(s: GameStateV2): number {
  const t = Math.min(s.player.policies.trustedToAI ?? 0, trustedMax(s));
  return t > 0 && aiLabourGate(s) === true ? t : 0;
}

export interface SafetyFleet {
  versionId?: string;
  compute: number;
  copies: number;
  /** AI researcher-equivalents the fleet supplies. */
  aiFte: number;
  /** Human FTE on automated work, weighted by the Trusted-to-AI share (what the fleet is spread over). */
  weight: number;
  /** AI FTE per weighted human FTE. */
  perFte: number;
}

/** Size of the safety fleet and how thinly it is spread. */
export function safetyFleet(s: GameStateV2): SafetyFleet {
  const v = safetyAgentVersion(s);
  const compute = safetyAgentCompute(s);
  // Below the AI-labour gate the fleet supplies no labour (its compute still shows as reserved).
  const aiFte = v && aiLabourGate(s, v) === true ? compute * aiFtePerH100e(s, v) : 0;
  const copies = v ? compute / (H100E_PER_COPY_SC * (v.serveCost / 0.5)) : 0;
  const dept = s.player.safety;
  const t = trustedShare(s);
  let weight = 0;
  if (t > 0) {
    for (const [ag, st] of Object.entries(dept.agendas)) if (st.fte > 0) weight += t * st.fte * AGENDA_BY_ID[ag as AgendaId].auto;
    for (const inv of dept.investigations) if (!inv.outcome) weight += t * inv.fte;
  }
  return { versionId: v?.id, compute, copies, aiFte, weight, perFte: weight > 0 ? aiFte / weight : 0 };
}

/** Labour multiplier of a piece of automated work: min(cap, √(1 + auto·a/n)) with a = its fleet share. */
export function fleetMultiplier(f: SafetyFleet, aiLabour: number, auto: number, cap: number): number {
  if (aiLabour <= 0 || cap <= 1) return 1;
  // a/n = aiLabour·auto·perFte (the fleet is spread in proportion to aiLabour × FTE × auto).
  const aPerN = aiLabour * auto * f.perFte;
  return Math.min(cap, Math.sqrt(1 + auto * aPerN));
}
