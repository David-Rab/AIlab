// Investor pool, hype, bubble, rates (V2-SPEC §3.7.3–3.7.4; research/15 §1.4). Owner: WS3.
import type { CapitalMarkets, EngineSystem } from '../types';

/** Capital markets at Jul 2025. A_t = 4.0·R_sector·H·M(y10)·W with R_sector = private frontier-lab run-rates. */
export function initialCapital(rSector: number): CapitalMarkets {
  return {
    y10: 4.4,
    sofr: 4.1,
    hype: 1.0,
    poolAnnual: 4.0 * rSector,
    carry: 0,
    ipoWindow: false,
    bubbleX: 2.0,
    shocks: [],
  };
}

/** capitalQ (420, quarterly): hype, investor pool, bubble roll, raises close, tranches, rating. TODO(WS3, M1). */
export const capitalQSystem: EngineSystem = {
  id: 'capitalQ', owner: 'WS3', cadence: 'quarterly', order: 420,
  run() {},
};
