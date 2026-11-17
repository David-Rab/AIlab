// Data stock and the data wall (V2-SPEC §3.2.2, §3.3.2; research/13 §1.7). Owner: WS1.
//   N_req(C) = 20·sqrt(C/120) tokens (Chinchilla 20 tok/param, C = 6ND)
//   S_human = 3 epochs × (licensed + unlicensed tokens) × (1 + 0.5·licence deals)    (Epoch: 300T, ≤ 4 epochs)
//   S_syn  += y0 · C_syn per day;   S_eff = S_human + q_syn·S_syn (q_syn 0.5)
//   Ddata  = min(1, S_eff/N_req(F(t)))^0.3 · d^0.15
import { SYN_QUALITY, SYN_YIELD_T_PER_H100E_DAY } from '../../../data/v2/calibration';
import { decimalYear } from '../core/time';
import { frontierFlop } from './knots';
import { idleTrainingShare } from '../models/runs';
import type { GameStateV2 } from '../types';

/** Tokens required for a base of `flop` FLOP: N_req(C) = 20·sqrt(C/120) (research/13 §1.7). Overtrained ×5. */
export function tokensRequired(flop: number, overtrained = false): number {
  return 20 * Math.sqrt(flop / 120) * (overtrained ? 5 : 1);
}

/** Data-wall penalty on a base (§3.3.2): −0.25·ln(N_req/S_eff), capped at −0.5. */
export function dataWallPenalty(sEff: number, nReq: number): number {
  return nReq > sEff ? Math.max(-0.5, -0.25 * Math.log(nReq / sEff)) : 0;
}

/** Synthetic-stock multiplier: ×3 once the P10 synthetic-data flywheel is adopted (§3.3.3). */
const synMult = (s: GameStateV2) => (s.player.paradigms.P10?.status === 'adopted' ? 3 : 1);

/** Effective data stock of the player in tokens (§3.2.2). */
export function effectiveStock(s: GameStateV2): number {
  const a = s.player.dataAssets;
  const human = 3 * (a.licensedTokensT + a.unlicensedTokensT) * (1 + 0.5 * s.relations.dataLicences.length);
  return (human + SYN_QUALITY * a.syntheticTokensT * synMult(s)) * 1e12;
}

/** min(1, S_eff / N_req(F(t))): adequacy of the player's data for a reference-size frontier base. */
export function dataStockRatio(s: GameStateV2, yr = decimalYear(s)): number {
  return Math.min(1, effectiveStock(s) / tokensRequired(frontierFlop(s.hidden.timeline, yr)));
}

/** Daily synthetic-token accrual from the synthetic pool (player), plus the spare training compute when the
 *  spare-training policy sends it to data generation (R5). */
export function syntheticAccrual(s: GameStateV2) {
  const spare = s.player.policies.spareTraining === 'data' ? idleTrainingShare(s) * s.player.split.training : 0;
  const cSyn = s.player.computeOnline * (s.player.split.synthetic + spare);
  s.player.dataAssets.syntheticTokensT += SYN_YIELD_T_PER_H100E_DAY * cSyn;
}
