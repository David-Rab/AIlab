// Safety agent fleet (V2-SPEC §3.5.2 addendum). Owner: WS2.
//
// AI labour on safety work runs on its own fleet, separate from the capabilities agents:
//   compute  = computeOnline × split.safety × agentShare          (a share of the safety pool)
//   model    = safety.agentVersion (default: the capabilities internal agent). An older, trusted model is weaker but
//              its sabotage odds are its own.
//   AI FTE   = compute × AI FTE per H100e of that model (the production function's R(q) and ηmod, §3.2.1)
// The fleet is shared by automated agendas and investigations in proportion to aiLabour × human FTE. A piece of work
// with human FTE n and AI FTE a gets labour multiplier min(cap, √(1 + Auto·a/n)), where cap = 1 + aiLabour·Auto·
// min(10, √M_model) is the pre-fleet multiplier (§3.5.3): compute decides how close to the cap you get.
import { H100E_PER_COPY_SC } from '../../../data/v2/calibration';
import { AGENDA_BY_ID, AUTOMATE_MIN_L } from '../../../data/v2/agendas';
import { internalVersion } from '../models/labs';
import { aiFtePerH100e } from '../production/production';
import type { AgendaId, GameStateV2, ModelVersion } from '../types';
import { versionById } from './common';

/** Version running the safety agents (falls back to the internal agent when unset or retired). */
export function safetyAgentVersion(s: GameStateV2): ModelVersion | undefined {
  const id = s.player.safety.agentVersion;
  const v = id ? versionById(s, id) : undefined;
  if (v && v.status !== 'retired' && v.status !== 'rolledBack') return v;
  return internalVersion(s);
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
export const safetyAgentCompute = (s: GameStateV2) => s.player.computeOnline * s.player.split.safety * (s.player.safety.agentShare ?? 0);

export interface SafetyFleet {
  versionId?: string;
  compute: number;
  copies: number;
  /** AI researcher-equivalents the fleet supplies. */
  aiFte: number;
  /** Human FTE on automated work, weighted by aiLabour (what the fleet is spread over). */
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
  let weight = 0;
  for (const [ag, st] of Object.entries(dept.agendas)) if (st.aiLabour > 0 && st.fte > 0) weight += st.aiLabour * st.fte * AGENDA_BY_ID[ag as AgendaId].auto;
  for (const inv of dept.investigations) if (!inv.outcome && inv.aiLabour > 0) weight += inv.aiLabour * inv.fte;
  return { versionId: v?.id, compute, copies, aiFte, weight, perFte: weight > 0 ? aiFte / weight : 0 };
}

/** Labour multiplier of a piece of automated work: min(cap, √(1 + auto·a/n)) with a = its fleet share. */
export function fleetMultiplier(f: SafetyFleet, aiLabour: number, auto: number, cap: number): number {
  if (aiLabour <= 0 || cap <= 1) return 1;
  // a/n = aiLabour·auto·perFte (the fleet is spread in proportion to aiLabour × FTE × auto).
  const aPerN = aiLabour * auto * f.perFte;
  return Math.min(cap, Math.sqrt(1 + auto * aPerN));
}
