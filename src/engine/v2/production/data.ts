// Data stock and the data wall (V2-SPEC §3.2.2, research/13 §1.7). Owner: WS1.

/** Tokens required for a base of `flop` FLOP: N_req(C) = 20·sqrt(C/120) (research/13 §1.7). */
export function tokensRequired(flop: number, overtrained = false): number {
  return 20 * Math.sqrt(flop / 120) * (overtrained ? 5 : 1);
}

/** Ddata = min(1, S_eff / N_req)^0.3 · d^0.15 (§3.2.2). */
export function dataFactor(sEff: number, nReq: number, d: number): number {
  return Math.pow(Math.min(1, sEff / Math.max(1, nReq)), 0.3) * Math.pow(Math.max(1e-6, d), 0.15);
}

/** Data-wall penalty on a base (§3.3.2): −0.25·ln(N_req/S_eff), capped at −0.5. */
export function dataWallPenalty(sEff: number, nReq: number): number {
  return nReq > sEff ? Math.max(-0.5, -0.25 * Math.log(nReq / sEff)) : 0;
}
