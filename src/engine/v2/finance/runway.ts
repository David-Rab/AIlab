// Runway and the distress state machine (V2-SPEC §3.7.6; research/15 §1.8). Owner: WS3.
import type { FinanceState } from '../types';

/** Healthy ≥ 6q, Tight 3–6q, Distress < 3q (or covenant breach), Insolvent if cash < 0 after all options. */
export function runwayState(runwayQ: number, covenantBreach = false, cash = 1): FinanceState['state'] {
  if (cash < 0) return 'insolvent';
  if (covenantBreach || runwayQ < 3) return 'distress';
  if (runwayQ < 6) return 'tight';
  return 'healthy';
}

/** Quarters of runway at a given net quarterly burn (positive = burning). */
export function runwayQuarters(cash: number, burnPerQ: number): number {
  return burnPerQ <= 0 ? 99 : Math.max(0, cash / burnPerQ);
}
