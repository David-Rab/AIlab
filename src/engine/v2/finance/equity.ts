// Valuation, raises and the raise ceiling (V2-SPEC §3.7.3; research/15 §1.5). Owner: WS3.
import type { GameStateV2, Money } from '../types';

/** V = 22·(g/5)^0.4·(R/$20B)^−0.15·H·N·M·R (R15 §1.5). */
export function valuationMark(g: number, R: number, H: number, N: number, M: number): number {
  return 22 * Math.pow(g / 5, 0.4) * Math.pow(Math.max(0.1, R) / 20, -0.15) * H * N * M * R;
}

/** k_Y(R) = 5·(R/$10B)^−0.4 (annual equity cap as a revenue multiple). */
export const kY = (R: number) => 5 * Math.pow(Math.max(0.1, R) / 10, -0.4);

export interface RaiseCeiling { max: Money; bound: 'pool' | 'dilution' | 'annualCap' | 'ask'; parts: Record<string, Money> }

/**
 * EngineApi.raiseCeiling: min(pool share, d_max·V_post, k_Y(R)·R − raised_4q, ask) (§3.7.3).
 * M0 PLACEHOLDER: pool share fixed at 40% of a quarter's appetite; no anchor; ask = ∞. TODO(WS3, M1).
 */
export function raiseCeiling(s: GameStateV2, ask = Number.POSITIVE_INFINITY): RaiseCeiling {
  const f = s.player.finance;
  const parts = {
    pool: 0.4 * (s.capital.poolAnnual / 4 + s.capital.carry),
    dilution: 0.08 * f.valuation,
    annualCap: Math.max(0, kY(f.revenueRun) * f.revenueRun - f.raisedLast4q),
    ask,
  };
  let bound: RaiseCeiling['bound'] = 'pool';
  for (const k of ['dilution', 'annualCap', 'ask'] as const) if (parts[k] < parts[bound]) bound = k;
  return { max: parts[bound], bound, parts };
}
