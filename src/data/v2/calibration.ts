// Calibration constants (V2-SPEC §3.1–3.2, §7.1). Owner: WS1.
// [fit] values are fitted by WS1 acceptance tests (scripts/v2/calib.ts, M1) and hard-coded here.
import type { ComputeSplit, DomainId, WorldPresetId } from '../../engine/v2/types';

/** BRIDGE(V6): per-preset milestone threshold shift (years). Model v3 V3: the player's milestones are work-type statements
 *  (departments/workfit.ts; per-preset G_SC and Δ_bm in data/v2/workTypes.ts V3_CAL) and do not read it; since V3b the
 *  world's calShift is derived (models/capability.ts alignedCalShift) and this table seeds the knot build and RefBot's
 *  pacing gates (bots/ref.ts v2Level). Model v3 F1: rivals, China and the leader lab no longer read it.
 *  History: fitted so RefBot's best internal model hit the golden dates (§7.1).
 *  [fit] by `npx tsx scripts/v2/calib.ts --fit` (bisection on SC, refined on a ±0.03 grid by the worst |Δ| over
 *  SC…ASI because SC(calShift) is step-like). `sampled` uses the ai2027 value. Never tune for balance (§7.4).
 *  J1 refit (jank M1: a version's measured level no longer re-rolls every 30 days, so RefBot's measured-level gates
 *  for paradigms (P08 L ≥ 7, P13 RSCH ≥ 8.5, …) no longer fire early on a lucky re-roll; the slow world, with the most
 *  re-rolls near each gate, lost the most): slow −0.172 → −0.127 (`--fit slow`); the other presets still pass.
 *  R4 refit (tree projects replace paradigm FTE; RefBot loses P05 on seed 2027 to the per-world retry draw): each preset
 *  moved within ±0.03 to the offset closest to the R1 ref-trace milestone days (ai2027 unchanged: +0.01 fits the stub
 *  trace better but moves the integrated trace 14 d; authors2026 +0.005 (+0.015 fits the trace better but leaves T1 SC
 *  at −0.079 y), fast −0.03, slow +0.025; a scan of SC…last against scripts/v2/golden/ref-trace.json).
 *  Model v3 V1 refit (`--fit`; models built from physical quantities, pm = Φ(G)): ai2027 0.08 → −0.36, authors2026 0.03 →
 *  −0.633, fast 0.075 → −0.557, slow −0.127 → 0.291 (worst |Δ| over SC…last 0.036 / 0.044 / 0.058 / 0.016 y). The v3
 *  reference lab runs above v2's pm path once it trains its first base (design/V3-BUILD.md V1 notes); slow's compute grows
 *  1.6×/yr after 2028, which v2's calendar compute term over-credited.
 *  Model v3 V2a refit (recipe from research stacks; LINE_FIT.mu 0.58 fitted to the v2 know-how path on ai2027):
 *  ai2027 −0.36 → −0.463, authors2026 −0.633 → −0.618, fast −0.557 → −0.473, slow 0.291 → −1.5 (slow's stacks outgrow the v2
 *  path by ~25% over its 13 pre-SC years; design/V3-BUILD.md V2 notes, PROGRESS.md V2a). */
export const CAL_SHIFT: Record<WorldPresetId, number> = { ai2027: -0.463, authors2026: -0.618, fast: -0.473, slow: -1.5, sampled: -0.463 };

/** Research efficiency of the simulated leader lab (setup.leaderLab, BUILD-PLAN R2), OOM: its research speed is ×10^LEADER_CAL
 *  the aggregate research function's at its inputs (actors/rivalModel.ts; the leader runs at the reference compute,
 *  staff and split, MODEL-V3 §12: "fitted so the simulated leader lab follows the AI 2027 path") so its milestones hit
 *  the golden days (T1L). [fit] by `npx tsx scripts/v2/calib.ts --fit-leader`; 0 = the aggregate function as is.
 *  `sampled` uses the ai2027 value. Model v3 F1 replaced v2's extra release lag (progress years on v2's simple-lab lag model; V3b
 *  values ai2027 0.256, authors2026 0.096, fast 0.134, slow 0.314) with this efficiency. F1 fit (seed 2027): the worst-error
 *  refine where it brings every milestone within tolerance (fast), else the SC root: the aggregate leader has no idea
 *  projects and takes off slower than RefBot after SC (design/notes/F1.md); slow's r = 1.2 needs ×14 (r divides every
 *  OOM of recipe by 10^(1/r)). Model v3 F2: authors2026 0.242 → 0.28, the SC root again (the followers' start states
 *  moved the leader's SC 1491 → 1535 at 0.242 through the shared world; SC 1498 at 0.28); the late milestones still
 *  miss for the reason in design/notes/F2.md (the rivals' recipe returns lack the line results' scale factor). */
export const LEADER_CAL: Record<WorldPresetId, number> = { ai2027: -0.048, authors2026: 0.28, fast: 0.068, slow: 1.155, sampled: -0.048 };

/** Knowledge diffusion to a follower (BUILD-PLAN R9, research/18 §0.2) [D, fit]: while the frontier leader lab's PUBLIC
 *  model is ahead of the player's best model, the player's know-how gains K_DIFFUSION × the gap per year (papers, staff
 *  moves, distilling public outputs). Without it a follower's lag grew without bound (its rate ∝ compute^0.4 with a
 *  fraction of the leader's compute: big tech 7 → 25 months behind in two years). Fitted on scripts/v2/starts.ts: at 1.0
 *  big tech stayed 7–13 months behind in months 9–15 (target 3–5); at 2.0 the race bot's division reaches 4–5 and the
 *  challenger 1.5–3, before takeoff pulls the leader away. Zero in the leader start (no leader lab: its calibration path
 *  is untouched). Rivals' symmetric term is WS1's distillation leak. */
export const K_DIFFUSION = 2.0;

/** Synthetic data yield and quality: model v3 D1 moved them to data/v2/dataAssets.ts (SYN_OVERGEN, SYN_Q). */
/** China research efficiency scale on chinaEfficiency × preset.efficiency (§3.2.2; [fit] to T3: 150–200 d lead).
 *  Mutable so the T3 fit can sweep it; game code only reads it. M2: refit on integrated RefBot play (real compute and
 *  finance, WS4's China compute path, WS1 distillation leak applied) — see scripts/v2/ws4.ts T3. */
// M2 step 5: refit with leakK 3e-4 (see WS4_TUNING) and the corner-line lead metric: mean 172 d, band 88–263 d.
// Model v3 V3b: 2.4 → 3.2 after the rival alignment (calShift derived per world): China's mean lead over days 30–540 was
// 223 d at 2.4, 199 at 2.9, 174 at 3.4 (scripts/v2/ws4.ts T3, 8 seeds).
// Model v3 F1: 3.2 → 1 (no scale: DeepCent's efficiency is the world's chinaEfficiency × the preset's): on the physical
// rival model China's research runs through the same aggregate function as every lab, and its lead is set mostly by its
// base FLOP and cadence; mean lead over days 30–540 (3 seeds) 132 d at 3.2, 153 at 1.5, 167 at 1.
export const CHINA_CAL = { effScale: 1 };
/** H100e per agent copy at SC (473k H100e / 200k copies, research/13 §1.9), scaled by serveCost/0.5. */
export const H100E_PER_COPY_SC = 2.4;
/** Agent serial speed cap (R11 #23: min(8 + 10.8·log2 M, 50)). */
export const PROD_SPEED_CAP = 50;
/** Start-state timing (§3.1.4): B0 started day −120, V0 finished day −20. */
export const B0_DAY = -120;
/** B0 run start: completed day −120 after a reference-length run, so its age equals the average base age under the
 *  reference cadence (REF_BASE_AGE = 256 d) and the start lag matches the steady state [D]. */
export const B0_START_DAY = -256;
export const V0_DAY = -20;

/** Production-function parameters by preset (research/13 §1.4). `sampled` draws La = 1 + LN80[1, 200]. */
export interface ProdPreset { rc: number; lam: number; La: number; Ca: number; slow10: number; m2b: number; kappa: number; etaSC: number }
export const PROD_DEFAULT: ProdPreset = { rc: -2, lam: 0.5, La: 100, Ca: 1000, slow10: 2.5, m2b: 3.25, kappa: 3, etaSC: 11.3 };
export const PROD_PRESETS: Partial<Record<WorldPresetId, Partial<ProdPreset>>> = {
  authors2026: { La: 15, slow10: 2.8, m2b: 3.7 },
};

/** Reference capabilities headcount H_ref = 2050 + 0.82·60 per month (research/13 §1.2, R11 #12). */
export const H_REF_BASE = 2050;
export const H_REF_PER_MONTH = 49.2;

/** AI 2027 compute forecast: leading-lab average compute (H100e) by date (research/13 §1.2, R11 #11). Used only to
 *  generate the knot R curve for the AI 2027-family presets, as research/13 §1.5 did (acceptance test P2). */
export const AI2027_COMPUTE_TABLE: { year: number; h100e: number }[] = [
  { year: 2025.5, h100e: 1e6 }, { year: 2026.5, h100e: 4e6 }, { year: 2027.125, h100e: 7e6 },
  { year: 2027.375, h100e: 9e6 }, { year: 2027.625, h100e: 12e6 }, { year: 2027.875, h100e: 15e6 },
];

/** research/13 §1.5 Stage-1 AI taste SD by Stage-1 fraction f (interpolated for every preset, §3.2.4 step 2). */
export const R13_TABLE_SD: [f: number, sd: number][] = [
  [0, -2.0], [0.126, -1.9], [0.25, -1.7], [0.378, -1.4], [0.5, -1.2], [0.656, -0.7], [0.75, -0.4], [0.896, 0.1], [1, 0.5],
];

/** FLOP per H100e-day: 1e15 FLOP/s × 0.4 MFU × 86,400 (§3.1.1). */
export const PHI_FLOP_PER_H100E_DAY = 3.46e19;

/** Reference compute-usage shares by decimal year (§3.2.1; AI 2027 compute forecast). Linear interp, held after. */
export const SHARE_REF: { year: number; share: ComputeSplit }[] = [
  { year: 2025.5, share: { training: 0.4, experiments: 0.05, agents: 0.03, synthetic: 0.21, serving: 0.29, safety: 0.02 } },
  { year: 2026.5, share: { training: 0.4, experiments: 0.06, agents: 0.04, synthetic: 0.21, serving: 0.27, safety: 0.02 } },
  { year: 2027.125, share: { training: 0.3, experiments: 0.14, agents: 0.06, synthetic: 0.28, serving: 0.19, safety: 0.03 } },
  { year: 2027.375, share: { training: 0.27, experiments: 0.21, agents: 0.06, synthetic: 0.24, serving: 0.19, safety: 0.03 } },
  { year: 2027.625, share: { training: 0.22, experiments: 0.28, agents: 0.06, synthetic: 0.23, serving: 0.175, safety: 0.035 } },
  { year: 2027.875, share: { training: 0.2, experiments: 0.35, agents: 0.06, synthetic: 0.225, serving: 0.13, safety: 0.035 } },
];

/** General level Lg at capIndex 0..6 (R16 CODE anchors Agent-0 … ASI, §3.1.5). */
export const LEVEL_KNOTS = [5, 6.5, 8.5, 10, 12, 13.5, 15];

export const DOMAIN_IDS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
/** Domain offsets relative to CODE (§3.1.5). Model v3 V1: only column 0 (the 2025 profile) is read: it is each domain's
 *  constant difficulty offset o_d (models/capability.ts domainsOf). The later columns are v2's scripted era table, kept
 *  for reference; no mechanism interpolates them. */
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
