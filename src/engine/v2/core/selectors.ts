// EngineApi read selectors (V2-SPEC §2.1 "Selectors are the only path for the UI"). Owner: WS1 (re-exports owners').
//
// UI code imports from here (or src/engine/v2/index.ts) only. Selectors return what the PLAYER knows: measured
// levels, beliefs, intel. `selectHidden` is for the end screen only (scripts/v2/lint-hidden.ts enforces this).
import { bestLg, bestPm, internalVersion, PLAYER_ID } from '../models/labs';
import { misalignment } from '../safety/traits';
import { understanding } from '../safety/understanding';
import { leadDays } from '../actors/intel';
import type { DecisionSnapshot, GameStateV2, HiddenWorld } from '../types';

export { production, nextModelGate } from '../production/readout';
export { understanding } from '../safety/understanding';
export { leadDays, riskSources } from '../actors/intel';
export { raiseCeiling } from '../finance/equity';
export { causeStrip } from './causes';
export { activeRivals } from '../models/labs';
export { dateOf, decimalYear, fmtDate, fmtMonth } from './time';

/** Measured general level of the internal-agent version (what the player sees in the top strip). */
export function measuredL(s: GameStateV2): number {
  return internalVersion(s)?.evals.measuredL ?? 0;
}

/** END SCREEN ONLY. The hidden truth of this world. */
export function selectHidden(s: GameStateV2): HiddenWorld {
  return s.hidden;
}

/** Snapshot stored with each decision for the end-screen causal replay (§5.4). Mixes truth: engine use only. */
export function decisionSnapshot(s: GameStateV2): DecisionSnapshot {
  const v = internalVersion(s);
  const rivals = s.rivals.filter((r) => r.core.status === 'active');
  const leadRival = rivals.length ? Math.min(...rivals.map((r) => leadDays(s, r.core.id).est)) : 0;
  return {
    L: v?.evals.measuredL ?? bestLg(s, PLAYER_ID),
    U: understanding(s).U,
    cash: s.player.finance.cash,
    leadRival,
    leadChina: leadDays(s, 'china').est,
    trustGov: s.relations.stocks.exec.trust,
    approval: s.pub.approval,
    misTrue: v ? misalignment(v.traitsTrue, v.uModes) : 0,
  };
}

/** True frontier progress of a lab (hidden; for tests and end screen). */
export const truePm = (s: GameStateV2, lab: string) => bestPm(s, lab);
