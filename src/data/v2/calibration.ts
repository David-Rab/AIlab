// Calibration constants (V2-SPEC §3.1–3.2, §7.1). Owner: WS1.
// [fit] values are fitted by WS1 acceptance tests (scripts/v2/calib.ts, M1) and hard-coded here.
import type { DomainId, WorldPresetId } from '../../engine/v2/types';

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
 *  missed (one-part recipe). Model v3 F2 part B (the recipe in three parts, design/V3-BUILD.md, F2 notes), --fit-leader: ai2027
 *  −0.029 and fast 0.025 (worst refine, every milestone in tolerance), slow 0.557, authors2026 0.154 (the SC root: its
 *  SIAR and ASI come early, worst 2.9 tolerances). Model v3 M7 refit (seed 2027, after A6b's overtrained reference base
 *  and A7/A8's market moved the leader's paths): ai2027 −0.029 → −0.063 (refine, every milestone in tolerance), fast
 *  0.025 → 0.03 (a 0.005 scan: SC +25 d, ASI −37 d, every milestone in tolerance), slow 0.557 → 0.735 (the SC root);
 *  authors2026 kept at 0.154: no value brings SAR, SIAR and ASI in together (the SC root 0.119 puts SAR out as well),
 *  0.154 keeps SC and SAR in (SIAR −0.68 y, ASI −1.44 y out → F4). Model v3 F4 (T1L binds on the median over the 20
 *  seeds of scripts/v2/calseeds.ts, `calscan.ts t1l`, after F4's V3_CAL refit moved the level knots; the aggregate leader
 *  is near-deterministic, p10–p90 ≤ 0.1 y): ai2027 −0.063 → −0.15 (median SC −0.071, SAR +0.012, SIAR +0.032, ASI +0.070;
 *  −0.10 and −0.20 fail); fast 0.03 → −0.045 (+0.060 / +0.088 / −0.001 / −0.084; −0.03 and −0.06 fail); slow 0.735 →
 *  0.79 (SC +0.007; 0.77 fails, 0.81 passes); authors2026 0.154 → 0.11 (SC −0.018, SAR 0.000): still no value brings
 *  SIAR and ASI in (−0.83 / −1.66 y at 0.11; at 0.05, where SC is already +0.23 y, they are −0.57 / −1.39 y): the
 *  aggregate leader runs SAR → ASI in 2.2 y where the golden takes 3.8 y. Merge FINM (finance v3: rivals' money, exits
 *  and raises move the shared world): slow 0.79 → 0.80 (`calscan.ts t1l slow`, 20 seeds: 0.79 SC +0.085 y fails by 1.06
 *  tolerances, 0.80 −0.012, 0.81 −0.086 fails); the other presets still pass. Merge M10 (V3_CAL refit authors2026
 *  (33.45, 4.7) and fast G_SC 31.2 moved the level knots; `calscan.ts t1l`, 20 seeds): authors2026 0.11 → 0.07 (SC
 *  +0.004, SAR +0.047, 20/20 seeds each; the SC/SAR window ≈ 0.05–0.09: 0.05 SC +0.078, 0.08 −0.036, 0.11 SC −0.156 fails;
 *  SIAR / ASI −0.70 / −1.35 y, the known WARN); fast −0.045 → −0.01 (+0.059 / +0.089 / −0.007 / −0.082, worst 0.74;
 *  −0.02 fails 1.13, 0 passes 0.96, 0.03 fails 1.66). CP3g (RL curve in G units with an episode midpoint, start in
 *  rule-A equilibrium): **removed, 0 everywhere** (the aggregate function as is). `calscan.ts t1l`, 20 seeds: ai2027 0
 *  worst 2.65 tol (SC −0.212 y, later within 0.12 y) = −0.15's worst 2.65 (ASI +0.318 y) with a smaller total miss;
 *  authors2026 0 worst 16.0 < 0.07's 17.1 (SC −0.049 passes); slow 0 SC −5.76 y < 0.8's −6.55 y; fast −0.01 ≈ 0. No
 *  value is better than none, so no fit is kept (design/RD-AUDIT/BUILD-NOTES.md, CP3g). */
export const LEADER_CAL: Record<WorldPresetId, number> = { ai2027: 0, authors2026: 0, fast: 0, slow: 0, sampled: 0 };

/** RD-X04 (DD-17; research/RD-X04r-diffusion.md §3A) [P]: the recipe replication time constant. Every lab's pretraining
 *  recipe gains (best public-or-open recipe G above it − its own) / τ a day (production/diffusion.ts). τ is the measured
 *  paradigm-replication time (o1 → R1 ≈ 4.3 months, C2; "within months", C1; RoseTTAFold ≈ 7 months, C1), not a fit:
 *  central 4 months, range 2–7 (DIFFUSION_TAU_RANGE_DAYS, uncertainty). Replaces K_DIFFUSION (2.0/yr on the model gap,
 *  [fit]). The 3–4 month open-weight and ≈7 month China lags (L1, L2, L6) are validation checks, not targets. */
export const DIFFUSION_TAU_DAYS = 4 * 30.44;
export const DIFFUSION_TAU_RANGE_DAYS: readonly [number, number] = [2 * 30.44, 7 * 30.44];
/** RD-X04 (research/RD-X04r §3B, D1) [P]: share of a model gap distillation recaptures at a post-training (IFP S ≈ 0.5). */
export const DISTILL_S = 0.5;
/** RD-X04 (§3B, D5) [P-r]: R1 distill student / teacher ratio by student size (active params): 1.5B ≈ 0.35, 7B ≈ 0.7,
 *  32B ≈ 0.9; log-linear between, flat outside (≥ 32B: a near-frontier base keeps 0.9). */
export const DISTILL_FIT: readonly [number, number][] = [[1.5e9, 0.35], [7e9, 0.7], [32e9, 0.9]];

/** Synthetic data yield and quality: model v3 D1 moved them to data/v2/dataAssets.ts (SYN_OVERGEN, SYN_Q). */
// CP3k: CHINA_CAL (a [fit] scale on DeepCent's research efficiency, last 1.5) deleted: at 1 the T3 lead is as good or
// better (8 seeds, design/RD-AUDIT/BUILD-NOTES.md "CP3k China"); DeepCent's efficiency is chinaEfficiency × the preset's.
/** Start-state timing (§3.1.4): B0 started day −120, V0 finished day −20. */
export const B0_DAY = -120;
/** B0 run start: completed day −120 after a reference-length run, so its age equals the average base age under the
 *  reference cadence (REF_BASE_AGE = 256 d) and the start lag matches the steady state [D]. */
export const B0_START_DAY = -256;
export const V0_DAY = -20;

/** The start state as data (RD-U06; MEA-05 / MEA-06), per world preset: `g` = G(V0), the reference start version's
 *  effective compute (OOM); `b0` = B0's pretraining recipe (OOM, research/12 §0.2 convention, as E_START: the recipe of
 *  its launch day B0_START_DAY); `v0` = V0's RL recipe (OOM over the leader's day-0 RL recipe: the recipe of V0_DAY).
 *  Every start lab (the player, the rivals, DeepCent, the leader twin) gets its start base and version from these through
 *  models/capability.ts startLab. Was derived by playerStart (v2's closed-form start in the progress coordinate: v1
 *  multiplierAt / stage1 / share at p0, pcRefLab, START_RETAIN 0.7; b0 = the retired E_B0 1.38 [fit: V0 at G ≈ 28.0,
 *  research/12's Aug-2025 anchor] + B0's start-day vintage), written out to 17 digits so every named preset's
 *  start is bit-identical; `g` is what startLab gives the reference base at these recipes. `sampled`: one literal for
 *  every seed (the start is observed history, not a sampled future): the median of playerStart over 400 seeds (b0
 *  p10–p90 0.687–0.935, g 27.48–27.75); the per-seed starts are gone. */
export const START_STATE: Record<WorldPresetId, { g: number; b0: number; v0: number }> = {
  ai2027: { g: 27.658471072331817, b0: 0.85397260273972597, v0: -0.041095890410958937 },
  authors2026: { g: 27.627049427807886, b0: 0.82451506849315059, v0: -0.043397260273972567 },
  fast: { g: 27.600112150053612, b0: 0.79926575342465744, v0: -0.045369863013698629 },
  slow: { g: 27.766159476245420, b0: 0.95496986301369846, v0: -0.033205479452054765 },
  sampled: { g: 27.691754354575195, b0: 0.8851811569793056, v0: -0.038657722110991784 },
};
/** The world preset of a timeline world, by its makeWorld label (TimelineWorld carries no preset id; an unknown label
 *  reads as `sampled`). */
export const PRESET_BY_LABEL: Record<string, WorldPresetId> = {
  'AI 2027 scenario': 'ai2027', "Authors' 2026 model": 'authors2026', 'Fast takeoff': 'fast', 'Skeptic world': 'slow', 'Sampled world': 'sampled',
};

/** Production-function parameters by preset (research/13 §1.4). `sampled` draws La = 1 + LN80[1, 200]. */
export interface ProdPreset { rc: number; lam: number; La: number; Ca: number; slow10: number; m2b: number }
export const PROD_DEFAULT: ProdPreset = { rc: -2, lam: 0.5, La: 100, Ca: 1000, slow10: 2.5, m2b: 3.25 };
export const PROD_PRESETS: Partial<Record<WorldPresetId, Partial<ProdPreset>>> = {
  authors2026: { La: 15, slow10: 2.8, m2b: 3.7 },
};

/** Reference capabilities headcount H_ref = 2050 + 0.82·60 per month (research/13 §1.2, R11 #12). */
export const H_REF_BASE = 2050;
export const H_REF_PER_MONTH = 49.2;

/** AI 2027 compute forecast: leading-lab average compute (H100e) by date (research/13 §1.2, R11 #11). Shown on the end
 *  screen (v2's knot function that also read it is gone, RD-C01). */
export const AI2027_COMPUTE_TABLE: { year: number; h100e: number }[] = [
  { year: 2025.5, h100e: 1e6 }, { year: 2026.5, h100e: 4e6 }, { year: 2027.125, h100e: 7e6 },
  { year: 2027.375, h100e: 9e6 }, { year: 2027.625, h100e: 12e6 }, { year: 2027.875, h100e: 15e6 },
];

/** FLOP per H100e-day: 1e15 FLOP/s × 0.4 MFU × 86,400 (§3.1.1). */
export const PHI_FLOP_PER_H100E_DAY = 3.46e19;

/** Reference compute-usage shares by decimal year (§3.2.1; AI 2027 compute forecast). Linear interp, held after. */
export const SHARE_REF: { year: number; share: { training: number; experiments: number; agents: number; synthetic: number; serving: number; safety: number } }[] = [
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
