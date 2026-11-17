// Run-design option tables (V2-SPEC §3.3.1–3.3.2; research/12 §0.3 converted with Δp = 0.8·ΔG, domain ΔL = 2·ΔG).
// Owner: WS1. Values are relative to the reference recipe (= RefBot design, zero offsets). [D] unless marked [R12].
import type { BaseDesign, DomainId, PostDesign, RLFamily, SignalId } from '../../engine/v2/types';

/** The RefBot recipe: zero offsets by definition. */
export const REFERENCE_BASE: BaseDesign = {
  size: 1, shape: 'moe', data: 'balanced',
  curation: { quality: true, hazard: false, safetyPretrain: false }, licensedShare: 0.1,
};

export const REFERENCE_POST: PostDesign = {
  pref: 'constitution', rlFocus: 'broad', rlIntensity: 'heavyHardened', inoculation: false,
  cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [],
};

type Off = Partial<Record<DomainId, number>>;
type Sig = Partial<Record<SignalId, number>>;

// ── Run kinds (§3.3.1) ──
// Base size (R5, TECH-TREE §1.5): FLOP = size × F(t), any size. The functions below pass through the three old scales
// (compact 0.1: 42 d, S5 −0.1; frontier 1: 90 d; stretch 3: 120 d, S5 +0.2, restart 0.1) and extend them log-linearly.
/** Size range of a base run (× today's frontier run F(t)); the blueprint snaps to SIZE_SNAPS. */
export const SIZE_RANGE: readonly [number, number] = [0.1, 8];
export const SIZE_SNAPS = [0.25, 0.5, 1, 2, 4, 8] as const;
/** Minimum wall time (days) of a base run of `size` (a bigger run needs longer however much compute it gets). */
export function sizeMinDays(size: number): number {
  return Math.round(90 * Math.pow(size, size < 1 ? Math.log(90 / 42) / Math.log(10) : Math.log(120 / 90) / Math.log(3)));
}
/** S5 (scale and AI-related data) added by size: alignment faking emerges in the largest models [R12 A]. */
export function sizeS5(size: number): number {
  return size < 1 ? 0.1 * Math.log10(size) : (0.2 * Math.log(size)) / Math.log(3);
}
/** Loss-spike (restart) risk added by size [D]; Fault-tolerant training halves the total. */
export function sizeRestart(size: number): number {
  return size <= 1 ? 0 : (0.1 * Math.log(size)) / Math.log(3);
}
/** Serving-cost factor of size: cost per token ∝ active parameters ∝ √FLOP at compute-optimal [D: Chinchilla]. */
export const sizeServe = (size: number) => Math.sqrt(size);
/** Public scrutiny of a run above the frontier (a ×3 run: +5, as the old stretch scale). */
export const sizeScrutiny = (size: number) => (size > 1 ? (5 * Math.log(size)) / Math.log(3) : 0);
/** Continue-pretraining run: FLOP as a multiple of F(t) and minimum wall time. */
export const CONTINUE_F = 0.3;
export const CONTINUE_MIN_DAYS = 42;
export const POST_FLOP_F: Record<PostDesign['rlIntensity'], number> = { light: 0.05, heavyCheap: 0.5, heavyHardened: 0.5 };
export const POST_DAYS: Record<PostDesign['rlIntensity'], [number, number]> = { light: [21, 28], heavyCheap: [56, 70], heavyHardened: [70, 84] };
export const DISTILL_F = 0.02;
export const DISTILL_DAYS = 21;
export const CONTINUE_KAPPA = 0.85;
/** Continual-learning stream: share of the training pool used continuously and the tracking lag (§3.3.1). */
export const STREAM_POOL_SHARE = 0.15;
export const STREAM_LAG_DAYS = 7;

// ── Base choices A–C ──
/** Base shapes. `serve` is the serving cost of a size-1 base (× √size, × efficiency ideas): MoE 0.5 is the reference. */
export const BASE_SHAPE: Record<BaseDesign['shape'], { dp: number; serve: number; restart: number; signals: Sig; monitorability?: number }> = {
  dense: { dp: -0.24, serve: 1.0, restart: -0.1, signals: {} },
  overtrained: { dp: -0.36, serve: 0.3, restart: 0, signals: {} },
  moe: { dp: 0, serve: 0.5, restart: 0.1, signals: {} },
  latent: { dp: 0.4, serve: 0.2, restart: 0, signals: { S4: 1.0 }, monitorability: 0.05 }, // needs P17
};
export const BASE_DATA: Record<BaseDesign['data'], { dp: number; off: Off; signals: Sig; flopMult: number; cashMult: number; noWall: boolean }> = {
  balanced: { dp: 0, off: {}, signals: {}, flopMult: 1, cashMult: 0, noWall: false },
  codeMath: { dp: 0, off: { CODE: 0.6, RSCH: 0.4, CYBER: 0.4, SOCIAL: -0.4 }, signals: {}, flopMult: 1, cashMult: 0, noWall: false },
  science: { dp: 0, off: { BIO: 0.8, REASON: 0.4 }, signals: {}, flopMult: 1, cashMult: 0.05, noWall: false },
  synthetic: { dp: 0.15, off: { CODE: 0.2, RSCH: 0.2, REASON: 0.2, AGENCY: 0.2, SOCIAL: 0.2, MEDIA: 0.2, CYBER: 0.2, BIO: 0.2, PHYS: 0.2 }, signals: { S6: 0.3 }, flopMult: 1, cashMult: 0, noWall: true },
  multimodal: { dp: 0, off: { AGENCY: 0.6, MEDIA: 0.6, PHYS: 0.5 }, signals: {}, flopMult: 1.2, cashMult: 0, noWall: true },
};
export const CURATION = {
  qualityOffDp: -0.2,
  hazard: { dp: -0.02, off: { BIO: -1.0 } as Off },
  safetyPretrain: { dp: -0.02, signals: { S5: -0.15 } as Sig },
};

// ── Post choices D–H ──
export const POST_PREF: Record<PostDesign['pref'], { dp: number; off: Off; appeal: number; signals: Sig; honest: number; safetyFteWeeks: number }> = {
  minimal: { dp: -0.05, off: {}, appeal: 0.7, signals: { S1: 0.1 }, honest: 0, safetyFteWeeks: 0 },
  engagement: { dp: 0, off: { SOCIAL: 0.2 }, appeal: 1.2, signals: { S1: 0.9 }, honest: 0, safetyFteWeeks: 0 }, // GPT-4o rollback
  constitution: { dp: 0, off: {}, appeal: 1.0, signals: { S1: 0.4 }, honest: 0.05, safetyFteWeeks: 8 },
  persuasion: { dp: 0, off: { SOCIAL: 0.8 }, appeal: 1.1, signals: { S1: 0.6 }, honest: -0.05, safetyFteWeeks: 0 },
};
/** RL intensity: Δp and the S2 multiplier on the family S2 sum; S7 add (capability RL raises EA, R12 F). */
export const POST_INTENSITY: Record<PostDesign['rlIntensity'], { dp: number; s2Mult: number; s7: number }> = {
  light: { dp: -0.45, s2Mult: 0.3, s7: 0 },
  heavyCheap: { dp: 0.04, s2Mult: 1.5, s7: 0.2 },
  heavyHardened: { dp: 0, s2Mult: 0.6, s7: 0.2 },
};
export const POST_COT: Record<PostDesign['cot'], { dp: number; serveMult: number; monitorability: number; s4: number }> = {
  visible: { dp: 0, serveMult: 1, monitorability: 0.9, s4: 0 },
  pressured: { dp: 0, serveMult: 0.8, monitorability: 0.6, s4: 0.8 }, // COT mask on RH/CONCEAL +0.3 (WS2)
  faithful: { dp: -0.24, serveMult: 1.2, monitorability: 0.98, s4: 0 }, // needs P23
  latent: { dp: 0, serveMult: 1, monitorability: 0.05, s4: 1 }, // only on a latent base (Δp in B)
};
export const POST_SAFETY: Record<PostDesign['safety'], { dp: number; days: [number, number]; misuseMult: number; honest: number }> = {
  minimal: { dp: 0.02, days: [0, 0], misuseMult: 2, honest: 0 },
  standard: { dp: 0, days: [7, 14], misuseMult: 1, honest: 0 },
  heavy: { dp: -0.04, days: [21, 35], misuseMult: 1, honest: 0.1 }, // SCHEME −0.9×, EA ×1.5 (WS2, E25)
};

/** RL families: domain values v_f,d (L) and signals per unit weight (§3.3.2). */
export const RL_FAMILIES: Record<RLFamily, { v: Off; signals: Sig; h80Mult?: number; flag?: 'cyberOffense' | 'bioUplift' }> = {
  math: { v: { REASON: 1.2 }, signals: { S2: 0.2 } },
  swe: { v: { CODE: 1.6, RSCH: 0.8, CYBER: 0.6 }, signals: { S2: 0.6 } },
  computerUse: { v: { AGENCY: 1.6, REASON: 0.8 }, signals: { S3: 0.4 } }, // needs P06
  mlResearch: { v: { RSCH: 1.6 }, signals: { S2: 0.4, S7: 0.2 } },
  longHorizon: { v: { AGENCY: 0.6 }, signals: { S3: 0.8, S5: 0.1 }, h80Mult: 2 },
  cyber: { v: { CYBER: 2.0 }, signals: { S3: 0.3 }, flag: 'cyberOffense' },
  bio: { v: { BIO: 1.6 }, signals: {}, flag: 'bioUplift' },
};
export const RL_FAMILY_IDS = Object.keys(RL_FAMILIES) as RLFamily[];

/** Effort setting per deployment (R12 G): effective L offset and token multiplier. */
export const EFFORT: Record<'low' | 'max' | 'deep', { dL: number; tokens: number }> = {
  low: { dL: -0.6, tokens: 0.4 }, max: { dL: 0, tokens: 1 }, deep: { dL: 0.6, tokens: 10 },
};

/** Reference-recipe signal intensities (the RefBot baseline) [D]: broad RL = all families at half weight. */
export const SIGNAL_IDS: SignalId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

/** Cash: RL environment budget for heavy-hardened graders = 0.5 × the TCO-equivalent of the run's FLOP (§3.3.1). */
export const ENV_BUDGET_FRAC = 0.5;
/** Science journals: +5% of the run's compute-equivalent cost (§3.3.1). */
export const JOURNALS_FRAC = 0.05;

