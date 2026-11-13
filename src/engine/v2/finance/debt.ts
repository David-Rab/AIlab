// Debt instruments: revolver, GPU term loans, bonds, vendor notes (V2-SPEC §3.7.4). Owner: WS3.
import type { Debt, GameStateV2, SystemCtx } from '../types';

/** Draw on a facility. TODO(WS3, M1). */
export function drawDebt(_s: GameStateV2, _ctx: SystemCtx, _kind: Debt['kind'], _amount: number): void {}

/** Daily interest accrual $B/yr (used by opex). */
export function interestPerYear(s: GameStateV2): number {
  let r = 0;
  for (const d of s.player.finance.debts) r += d.drawn * (s.capital.sofr + d.spreadBp / 100) / 100;
  return r;
}
