// Calibration constants (V2-SPEC §3.1–3.2, §7.1). Owner: WS1.
// [fit] values are fitted by WS1 acceptance tests (scripts/v2/calib.ts, M1) and hard-coded here.
import type { ComputeSplit, DomainId, WorldPresetId } from '../../engine/v2/types';

/** Per-preset milestone threshold shift (years) fitted so RefBot's best internal model hits the golden dates (§7.1).
 *  M0: 0 everywhere (the placeholder progress system integrates the v1 reference path directly). [fit] */
export const CAL_SHIFT: Record<WorldPresetId, number> = { ai2027: 0, authors2026: 0, fast: 0, slow: 0, sampled: 0 };

/** Post-training capability retention κ (§3.1.4). Adjust only globally (0.6–0.8), never per preset. */
export const KAPPA = { post: 0.7, continue: 0.85, stream: 1.0 };

/** Production-function parameters by preset (research/13 §1.4). `sampled` draws La = 1 + LN80[1, 200]. */
export interface ProdPreset { rc: number; lam: number; La: number; Ca: number; slow10: number; m2b: number; kappa: number; etaSC: number }
export const PROD_DEFAULT: ProdPreset = { rc: -2, lam: 0.5, La: 100, Ca: 1000, slow10: 2.5, m2b: 3.25, kappa: 3, etaSC: 11.3 };
export const PROD_PRESETS: Partial<Record<WorldPresetId, Partial<ProdPreset>>> = {
  authors2026: { La: 15, slow10: 2.8, m2b: 3.7 },
};

/** FLOP per H100e-day: 1e15 FLOP/s × 0.4 MFU × 86,400 (§3.1.1). */
export const PHI_FLOP_PER_H100E_DAY = 3.46e19;

/** Reference compute-usage shares by decimal year (§3.2.1; AI 2027 compute forecast). Linear interp, held after. */
export const SHARE_REF: { year: number; share: ComputeSplit }[] = [
  { year: 2025.5, share: { training: 0.4, experiments: 0.05, agents: 0.03, synthetic: 0.2, serving: 0.29, safety: 0.02, security: 0.01 } },
  { year: 2026.5, share: { training: 0.4, experiments: 0.06, agents: 0.04, synthetic: 0.2, serving: 0.27, safety: 0.02, security: 0.01 } },
  { year: 2027.125, share: { training: 0.3, experiments: 0.14, agents: 0.06, synthetic: 0.27, serving: 0.19, safety: 0.03, security: 0.01 } },
  { year: 2027.375, share: { training: 0.27, experiments: 0.21, agents: 0.06, synthetic: 0.23, serving: 0.19, safety: 0.03, security: 0.01 } },
  { year: 2027.625, share: { training: 0.22, experiments: 0.28, agents: 0.06, synthetic: 0.22, serving: 0.175, safety: 0.035, security: 0.01 } },
  { year: 2027.875, share: { training: 0.2, experiments: 0.35, agents: 0.06, synthetic: 0.22, serving: 0.13, safety: 0.035, security: 0.005 } },
];

/** General level Lg at capIndex 0..6 (R16 CODE anchors Agent-0 … ASI, §3.1.5). */
export const LEVEL_KNOTS = [5, 6.5, 8.5, 10, 12, 13.5, 15];

export const DOMAIN_IDS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
/** Domain offsets relative to CODE by era (capIndex 0..6), §3.1.5. */
export const REF_OFF: Record<DomainId, number[]> = {
  CODE: [0, 0, 0, 0, 0, 0, 0],
  RSCH: [0, 0, 0, 0, 0, 0, 0],
  REASON: [0, -0.5, -1, -1.5, -1, -0.5, 0],
  AGENCY: [-1, -1, -1, -1.5, -1, -0.5, 0],
  SOCIAL: [0, -1, -2, -2.5, -2, -1.5, 0],
  MEDIA: [0, -1, -2, -2.5, -3, -2, -1],
  CYBER: [-1, -0.5, -0.5, -1, 0, 0, 0],
  BIO: [0, -0.5, -1.5, -2, -1, -0.5, 0],
  PHYS: [-4, -5, -6.5, -7, -8, -8.5, -9],
};
/** RSCH takes this extra offset until paradigm P19 is adopted (R12 §0.4). */
export const RSCH_TASTE_PENALTY = -0.5;

/** research/13 §1.5 ai2027 knot table (acceptance test P2: generated knots within 2%). */
export const R13_AI2027_KNOTS = [
  { at: 'f=0', Mref: 1.25, A: 0.538, R: 2.58, lRef: 1.69, Xref: 1.25, Tref: 1.0, sdAI: -2.0 },
  { at: 'f=0.126', Mref: 1.35, A: 0.646, R: 4.68, lRef: 2.05, Xref: 1.35, Tref: 1.0, sdAI: -1.9 },
  { at: 'f=0.25', Mref: 1.5, A: 0.744, R: 10.0, lRef: 2.63, Xref: 1.5, Tref: 1.0, sdAI: -1.7 },
  { at: 'f=0.378', Mref: 1.71, A: 0.838, R: 20.7, lRef: 3.65, Xref: 1.7, Tref: 1.01, sdAI: -1.4 },
  { at: 'f=0.5', Mref: 2.0, A: 0.904, R: 48.4, lRef: 5.37, Xref: 1.98, Tref: 1.01, sdAI: -1.2 },
  { at: 'f=0.656', Mref: 2.54, A: 0.96, R: 136, lRef: 9.71, Xref: 2.46, Tref: 1.03, sdAI: -0.7 },
  { at: 'f=0.75', Mref: 3.0, A: 0.978, R: 276, lRef: 14.5, Xref: 2.84, Tref: 1.06, sdAI: -0.4 },
  { at: 'f=0.896', Mref: 4.0, A: 0.993, R: 815, lRef: 27.3, Xref: 3.53, Tref: 1.13, sdAI: 0.1 },
  { at: 'SC', Mref: 5, A: 1, R: 1730, lRef: 41.6, Xref: 4.06, Tref: 1.23, sdAI: 0.5 },
  { at: '10x', Mref: 10, A: 1, R: 3660, lRef: 60.5, Xref: 4.58, Tref: 2.19, sdAI: 2.2 },
  { at: 'SAR', Mref: 25, A: 1, R: 8410, lRef: 91.7, Xref: 5.2, Tref: 4.8, sdAI: 4.3 },
  { at: '50x', Mref: 50, A: 1, R: 15600, lRef: 125, Xref: 5.71, Tref: 8.76, sdAI: 5.9 },
  { at: 'SIAR', Mref: 250, A: 1, R: 56900, lRef: 238, Xref: 6.87, Tref: 36.4, sdAI: 9.6 },
  { at: 'ASI', Mref: 2000, A: 1, R: 285000, lRef: 534, Xref: 8.54, Tref: 234, sdAI: 14.5 },
];

/** Expected golden dates (decimal years), research/11 §5 and V2-SPEC §7.1. null = no target; [lo, hi] = range. */
export interface GoldenExpect { SC: number | [number, number]; SAR: number | null; SIAR: number | null; ASI: number | null; M?: Record<string, number>; h80?: { year: number; minutes: number } }
export const GOLDEN_EXPECTED: Record<Exclude<WorldPresetId, 'sampled'>, GoldenExpect> = {
  ai2027: { SC: 2027.24, SAR: 2027.66, SIAR: 2027.92, ASI: 2028.0, M: { '1.5': 2026.07, '3': 2026.96, '10': 2027.5, '50': 2027.8 } },
  authors2026: { SC: 2029.68, SAR: 2029.89, SIAR: 2031.48, ASI: 2033.73, h80: { year: 2026.27, minutes: 186 } },
  fast: { SC: 2027.91, SAR: null, SIAR: 2028.03, ASI: 2028.12 },
  slow: { SC: [2034, 2035], SAR: null, SIAR: null, ASI: null },
};
export const GOLDEN_SAMPLED = { p10: 2026.05, p50: 2028.37, p90: 2044, p50Tol: 0.3, seeds: 500 };
/** Tolerances (years): ±0.08 for SC, ±0.12 after (§7.1). */
export const GOLDEN_TOL = { SC: 0.08, after: 0.12 };
