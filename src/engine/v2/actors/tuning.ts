// WS4 [fit]/[D] balance knobs in one place (V2-SPEC §7.4 "balance knobs"). Owner: WS4.
// Mutable on purpose so calibration scripts can sweep them; game code only reads them.
export const WS4_TUNING = {
  /** Secrets-leak coefficient per spy (R11 #16c "≈ 0.00015 … tuned so the lead stays 150–200 d until the theft").
   *  The spec's spy count (privileged·0.005 ≈ 11 at start) is ~10× v1's scale, hence ≈ /15. [fit, T3: lead 183 → 158 d over days 100–600] */
  leakK: 0.00001,
  /** Distillation: daily share of the gap to the best US public model China recovers at access 60. [fit, T3] */
  distillK: 0.00006,
  /** Rival trait-drift scale (stand-in for WS2's graph). [fit: maverick Mis at ASI ≈ 0.45–0.6, safety ≈ 0.25–0.35] */
  rivalDriftK: 3.5,
  /** Per-step pull-back of bad traits by effective safety work (safety training on the rival's lineage). [D] */
  rivalPullback: 0.05,
  /** China attempts weight theft only from this posture rung (R10 §1.4 rung 2 "intensified acquisition … cyber
   *  recon of labs"; R8 is an escalation path). [D] deviation from §3.6, which has no rung gate. */
  theftMinRung: 2,
};
