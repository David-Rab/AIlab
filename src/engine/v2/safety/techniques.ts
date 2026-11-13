// Technique strength vs capability (V2-SPEC §3.5.6). Owner: WS2.
import type { TechniqueState } from '../types';

/** strength_t(M) = s0 · e · D(M) · (1 − G·trainedAgainst) · (falseValidated ? 0 : 1), D(M) = 1/(1 + (M/M½)^k). */
export function techniqueStrength(t: TechniqueState, efficacy: number, M: number): number {
  if (t.falseValidated) return 0;
  const D = 1 / (1 + Math.pow(M / Math.max(1e-9, t.mHalf), t.k));
  return t.s0 * efficacy * D * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}
