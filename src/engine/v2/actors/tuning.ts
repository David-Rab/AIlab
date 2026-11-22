// WS4 [fit]/[D] balance knobs in one place (V2-SPEC §7.4 "balance knobs"). Owner: WS4.
// Mutable on purpose so calibration scripts can sweep them; game code only reads them.
export const WS4_TUNING = {
  /** Secrets-leak coefficient per spy (R11 #16c "≈ 0.00015 … tuned so the lead stays 150–200 d until the theft").
   *  The spec's spy count (privileged·0.005 ≈ 11 at start, ≈ 28 by 2027) is ~10× v1's scale. [fit, T3] M2 step 5: 1e-5 → 3e-4.
   *  China's compute grows ≈ 2×/yr against a faster US path, so without a real restoring force the lead widened to
   *  ≈ 330 d by day 540 (RefBot keeps its frontier internal, so distillation adds little); the gap-proportional
   *  secrets leak is the spec's restoring force (R11 #16c). */
  leakK: 0.0003,
  /** Distillation: daily share of the gap to the best US public model China recovers at access 60. [fit, T3] */
  distillK: 0.00006,
  /** China attempts weight theft only from this posture rung (R10 §1.4 rung 2 "intensified acquisition … cyber
   *  recon of labs"; R8 is an escalation path). [D] deviation from §3.6, which has no rung gate. */
  theftMinRung: 2,
};
