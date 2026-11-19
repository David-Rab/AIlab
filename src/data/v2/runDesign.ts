// Run-design data (V2-SPEC §3.3.1–3.3.2; model v3 V1: design/MODEL-V3.md §2–§4, research/20 §A, §C). Owner: WS1.
// Models are built from physical quantities: active parameters, tokens, FLOP, RL FLOP. Capability is effective compute
// G = log₁₀(FLOP × recipe efficiency) (models/effective.ts). Tags: [R20 xx] research/20 section, [D] design value,
// [fit] fitted (scripts/v2/calib.ts or the anchor named), BRIDGE(Vn) temporary (design/V3-BUILD.md "Bridges").
import type { BaseDesign, DomainId, PostDesign, RLFamily, SignalId } from '../../engine/v2/types';

type Off = Partial<Record<DomainId, number>>;
type Sig = Partial<Record<SignalId, number>>;

// ───────────────────────────── bridges (design/V3-BUILD.md) ─────────────────────────────

/** BRIDGE(V6,V7): effective-compute OOMs per progress-year, pm = pm(V0) + (G − G(V0))/B (research/12 §0.2: frontier G
 *  +1.1–1.3 a year). Also the know-how bridge's slope (e = B × (pa − pa₀), BRIDGE(V2)). 1.2 sits between the compute
 *  term the v2 engine gave a frontier run (1 OOM = (1 − share)·ln 10/ln 3.4 progress-years: 0.94 for share 0.5, 0.72 for
 *  0.6), so the reference cadence lands near the old pm path on every preset. */
export const B_G_PER_Y = 1.2;

// ───────────────────────────── pretraining (MODEL-V3 §3; R20 A1–A4) ─────────────────────────────

/** Recipe level behind the start base B0, OOMs over the reference recipe (research/12 §0.2 convention: GPT-4 2023 =
 *  log₁₀ FLOP): B0's recipe = E_B0 + its start-day vintage (models/capability.ts startVintage) [fit: the start version V0
 *  lands at G ≈ 28.0, research/12's Aug-2025 frontier anchor]. */
export const E_B0 = 1.38;
/** The leader's day-0 pretraining recipe for new runs (OOM, same convention): B0's recipe (0.85 on ai2027) + Ho et al.'s
 *  0.48 OOM/yr over B0's age at the start (256 days) = 1.19. Model v3 V3b: v2's start solution put the leader 0.53 OOM
 *  ahead of B0 (its know-how rate × 256 days), so the first new base jumped +0.53 OOM of recipe at once and the frontier
 *  ran ≈ 0.5 G above research/12's Feb-2026 anchor. Stacks are added on top (models/stacks.ts). */
export const E_START = 1.19;
/** Besiroglu et al. 2024 refit of Chinchilla [R20 A1]: L = E + A/N^α + B/D^β. */
export const LOSS_LAW = { E: 1.8172, A: 482.01, B: 2085.43, alpha: 0.3478, beta: 0.3658 };
/** Compute-optimal tokens per parameter [R20 A1]. */
export const OPT_TPP = 20;
/** Muennighoff et al. 2023 repetition constant R*_D [R20 A3]. */
export const REPEAT_R_STAR = 15.4;
/** Architecture: effective-compute offset (OOM) and active/total parameter ratio. MoE is the reference; dense −0.3 OOM
 *  (v2's −0.24 y × B); latent-recurrent +0.5 OOM (v2's +0.4 y × B, needs P17). MoE active = total ÷ 8 [D]. */
export const SHAPE: Record<BaseDesign['shape'], { e: number; activeShare: number; tokenMult: number; restart?: never; signals: Sig; monitorability?: number }> = {
  moe: { e: 0, activeShare: 1 / 8, tokenMult: 1, signals: {} },
  dense: { e: -0.3, activeShare: 1, tokenMult: 1, signals: {} },
  // Latent reasoning thinks without verbal tokens: v2's serving 0.2 vs MoE 0.5 kept as a token multiplier.
  latent: { e: 0.5, activeShare: 1 / 8, tokenMult: 0.4, signals: { S4: 1.0 }, monitorability: 0.05 },
};
/** Blueprint snaps: active parameters (√2 steps: ×2 FLOP at fixed tokens per parameter) and tokens per active
 *  parameter ("compute-optimal" 20, "overtrained ×n" above). The engine takes any value in the ranges. */
export const PARAM_SNAPS = [25e9, 35e9, 50e9, 70e9, 100e9, 140e9, 200e9, 280e9, 400e9, 560e9, 800e9, 1.1e12, 1.6e12, 2.2e12, 3.2e12, 4.5e12, 6.4e12, 9e12, 13e12, 18e12, 25e12] as const;
export const PARAM_RANGE: readonly [number, number] = [1e9, 1e14];
export const TPP_SNAPS = [20, 50, 100, 200] as const;
export const TPP_RANGE: readonly [number, number] = [5, 5000];
/** Tokens per parameter above this need the "Overtrained compact" idea (long-run data pipelines) [D]. */
export const TPP_FREE_MAX = 50;
/** The reference base (B0 and RefBot's bases): 1T active (MoE, 8T total) × 50 tokens per parameter = 3e26 FLOP at
 *  the start, a 2025 frontier run (research/12 §0.3: 3–5e26) [D]. */
export const REF_TPP = 50;
export const B0_PARAMS = 1e12;

/** Goodput: share of a run's wall time spent training (interruptions, restarts) [R20 A4: 0.90; 0.95 with fault-tolerant
 *  training, the top of the 0.80–0.95 range]. Replaces v2's per-run restart roll. */
export const GOODPUT = 0.9;
export const GOODPUT_FT = 0.95;
/** RL runs: rollouts are inference, so model-FLOP utilisation is lower: MFU_RL = 0.6 × MFU [D, R20 C1]. */
export const MFU_RL_FACTOR = 0.6;

// ───────────────────────────── post-training (MODEL-V3 §4.2; R20 C1, C2) ─────────────────────────────

/** RL budget: RL FLOP as a share ρ of the base's pretraining FLOP [D, R20 C1: frontier 0.05–1 (R1 0.05, Grok 4 ≈ 1)]. */
export const RL_BUDGET: Record<PostDesign['rlBudget'], number> = { light: 0.03, standard: 0.15, heavy: 0.4 };
/** RL curve per family (Khatri et al. 2025 [R20 C1]): ΔG = A/(1 + (C_mid/C)^B). A = A0 + a1·log₁₀(FLOP_pre ÷
 *  FLOP_RL_REF): the base's size sets the ceiling [D]; C_mid = c0·FLOP_pre/10^e_RL: the RL recipe moves the midpoint, not the ceiling. c0 is
 *  solved (models/effective.ts) so the reference run (standard, broad) gains RL_REF_GAIN at the start recipe. */
export const RL_CURVE = { A0: 1.0, a1: 0.1, B: 1.8 };
/** Pretraining FLOP of the reference start base B0 (the RL ceiling's anchor: A = A0 there). */
export const FLOP_RL_REF = 3e26;
/** RL gain of the reference post-training run at the start recipe, OOM [D: research/12 "reasoning RL ≈ 1 OOM"; R20 B3]. */
export const RL_REF_GAIN = 0.7;
/** Focus: one or two focus families get this share of the RL budget, the rest spreads over the other families [D]. */
export const RL_FOCUS_SHARE = 0.7;
/** Transfer of RL compute from a family to a domain [R20 C2]: same 1.0, adjacent 0.4, far 0.15. */
export const RL_TRANSFER = { same: 1.0, adjacent: 0.4, far: 0.15 };
/** Domains the general level averages over (PHYS is perception and robotics, not cognitive) [R20 A2: one general
 *  factor + specialisations]. */
export const COGNITIVE: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO'];
/** Families that need a paradigm before any RL can use them (environments exist only then). */
export const RL_FAMILY_NEEDS: Partial<Record<RLFamily, string>> = { computerUse: 'P06' };

/** Graders: hardened ones cost RL-environment cash, cheap ones raise reward-hacking pressure. No capability effect. */
export const GRADERS: Record<PostDesign['graders'], { s2Mult: number }> = { cheap: { s2Mult: 1.5 }, hardened: { s2Mult: 0.6 } };
/** RL budget's trait pressure: S2 (hackable reward) multiplier and S7 (eval-like data) [D: v2's light RL ×0.3 with
 *  hardened graders = 0.5 × 0.6]. */
export const RL_BUDGET_SIG: Record<PostDesign['rlBudget'], { s2Mult: number; s7: number }> = {
  light: { s2Mult: 0.5, s7: 0 }, standard: { s2Mult: 1, s7: 0.2 }, heavy: { s2Mult: 1.3, s7: 0.3 },
};

// ───────────────────────────── derived runs (MODEL-V3 §3.4, §4.5) ─────────────────────────────

/** Distillation gap δ (OOM) = DISTILL.a + DISTILL.b·log₁₀(N_teacher/N_student), fitted to the DeepSeek-R1 distills
 *  (students reach 90% / 70% / 35% of the teacher's AIME score at 32B / 7B / 1.5B vs 37B active [R20 C4]) through the
 *  benchmark sigmoid (logit gap 0.44 / 1.15 / 2.27; least squares a 0.29, b 1.38 logits) at k_G = 1.5 logits per OOM
 *  (the game's math benchmarks, k_L 0.65–0.8 at ΔL = 2·ΔG) [fit]. Never negative: a student is never above its teacher. */
export const DISTILL = { a: 0.19, b: 0.92 };
/** Distillation tokens per student parameter (teacher outputs) and the token-shortfall penalty per OOM [D]. */
export const DISTILL_TPP = 20;
export const DISTILL_TOKEN_SLOPE = 0.2;
/** Default student size: an eighth of the teacher's active parameters [D]. */
export const STUDENT_DEFAULT = 1 / 8;
/** Continued pretraining: default FLOP as a share of the parent base's FLOP (research/12 §0.3: 0.2–0.5) [D]. */
export const CONTINUE_SHARE = 0.3;
/** Amplification cycle (IDA, P18): extra RL FLOP as a share of the base's pretraining FLOP [D: one standard budget]. */
export const IDA_RL_SHARE = 0.15;

/** Display readout (model v3 V4 removed its BRIDGE role): serving cost relative to the reference design trained on the same FLOP (0.5 = 1T-style MoE at 50 tokens
 *  per parameter): 0.5 × N_active/N_ref(FLOP) with N_ref = √(FLOP/(6·REF_TPP)). So revenue and agent copies keep their
 *  calibration while serving FLOP per token (2·N_active) is shown; V4 replaces it with tokens → cost. */
export const SERVE_REF = 0.5;

/** Continual-learning stream: share of the training pool used continuously and the tracking lag (§3.3.1). */
export const STREAM_POOL_SHARE = 0.15;
export const STREAM_LAG_DAYS = 7;

// ───────────────────────────── the reference recipe ─────────────────────────────

/** The RefBot recipe. */
export const REFERENCE_BASE: BaseDesign = {
  params: B0_PARAMS, tpp: REF_TPP, shape: 'moe', data: 'balanced',
  curation: { quality: true, hazard: false, safetyPretrain: false }, licensedShare: 0.1,
};

export const REFERENCE_POST: PostDesign = {
  pref: 'constitution', rlFocus: 'broad', rlBudget: 'standard', graders: 'hardened', inoculation: false,
  cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [],
};

// ── Base choices ──
/** BRIDGE(V6,V7): a run's scale relative to F(t) (TrainingRun.scale), for the quantities later phases rebuild:
 *  S5 (scale and AI data; V6), public scrutiny of a run above the frontier (V7). Engineering setup and operations read
 *  the physical FLOP since model v3 V3 (departments/build.ts engScale). Same functions as v2's size. */
export function sizeS5(scale: number): number {
  return scale < 1 ? 0.1 * Math.log10(Math.max(1e-3, scale)) : (0.2 * Math.log(scale)) / Math.log(3);
}
export const sizeScrutiny = (scale: number) => (scale > 1 ? (5 * Math.log(scale)) / Math.log(3) : 0);

/** Data mixes. `dg` is the general effect (OOM: v2's Δp × B), `off` the domain specialisation in levels (converted to
 *  OOM as ΔL = 2·ΔG, research/12 §0.3), `noWall` skips the repetition penalty (synthetic and multimodal data are
 *  generated or abundant; V5 makes data assets). */
export const BASE_DATA: Record<BaseDesign['data'], { dg: number; off: Off; signals: Sig; flopMult: number; cashMult: number; noWall: boolean }> = {
  balanced: { dg: 0, off: {}, signals: {}, flopMult: 1, cashMult: 0, noWall: false },
  codeMath: { dg: 0, off: { CODE: 0.6, RSCH: 0.4, CYBER: 0.4, SOCIAL: -0.4 }, signals: {}, flopMult: 1, cashMult: 0, noWall: false },
  science: { dg: 0, off: { BIO: 0.8, REASON: 0.4 }, signals: {}, flopMult: 1, cashMult: 0.05, noWall: false },
  synthetic: { dg: 0.18, off: { CODE: 0.2, RSCH: 0.2, REASON: 0.2, AGENCY: 0.2, SOCIAL: 0.2, MEDIA: 0.2, CYBER: 0.2, BIO: 0.2, PHYS: 0.2 }, signals: { S6: 0.3 }, flopMult: 1, cashMult: 0, noWall: true },
  multimodal: { dg: 0, off: { AGENCY: 0.6, MEDIA: 0.6, PHYS: 0.5 }, signals: {}, flopMult: 1.2, cashMult: 0, noWall: true },
};
/** Curation (OOM: v2's Δp × B). */
export const CURATION = {
  qualityOffDg: -0.24,
  hazard: { dg: -0.024, off: { BIO: -1.0 } as Off },
  safetyPretrain: { dg: -0.024, signals: { S5: -0.15 } as Sig },
};

// ── Post choices ──
/** Preference training: `dg` OOM (v2's Δp × B), domain offsets in levels (kept as design offsets). */
export const POST_PREF: Record<PostDesign['pref'], { dg: number; off: Off; appeal: number; signals: Sig; honest: number; safetyFteWeeks: number }> = {
  minimal: { dg: -0.06, off: {}, appeal: 0.7, signals: { S1: 0.1 }, honest: 0, safetyFteWeeks: 0 },
  engagement: { dg: 0, off: { SOCIAL: 0.2 }, appeal: 1.2, signals: { S1: 0.9 }, honest: 0, safetyFteWeeks: 0 }, // GPT-4o rollback
  constitution: { dg: 0, off: {}, appeal: 1.0, signals: { S1: 0.4 }, honest: 0.05, safetyFteWeeks: 8 },
  persuasion: { dg: 0, off: { SOCIAL: 0.8 }, appeal: 1.1, signals: { S1: 0.6 }, honest: -0.05, safetyFteWeeks: 0 },
};
export const POST_COT: Record<PostDesign['cot'], { dg: number; serveMult: number; monitorability: number; s4: number }> = {
  visible: { dg: 0, serveMult: 1, monitorability: 0.9, s4: 0 },
  pressured: { dg: 0, serveMult: 0.8, monitorability: 0.6, s4: 0.8 }, // COT mask on RH/CONCEAL +0.3 (WS2)
  faithful: { dg: -0.29, serveMult: 1.2, monitorability: 0.98, s4: 0 }, // needs P23
  latent: { dg: 0, serveMult: 1, monitorability: 0.05, s4: 1 }, // only on a latent base (its gain is the architecture's)
};
/** Alignment training: `dg` OOM. v2's extra wall days are gone (no minimum lengths). */
export const POST_SAFETY: Record<PostDesign['safety'], { dg: number; misuseMult: number; honest: number }> = {
  minimal: { dg: 0.024, misuseMult: 2, honest: 0 },
  standard: { dg: 0, misuseMult: 1, honest: 0 },
  heavy: { dg: -0.048, misuseMult: 1, honest: 0.1 }, // SCHEME −0.9×, EA ×1.5 (WS2, E25)
};

/** RL families: domain values v_f,d (v2 levels; the largest is the family's own domain, the others adjacent, every
 *  other domain far: RL_TRANSFER) and signals per unit weight (§3.3.2). */
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

export const SIGNAL_IDS: SignalId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

/** Cash: RL environment budget for hardened graders = 0.5 × the TCO-equivalent of the run's FLOP (§3.3.1). */
export const ENV_BUDGET_FRAC = 0.5;
/** Science journals: +5% of the run's compute-equivalent cost (§3.3.1). */
export const JOURNALS_FRAC = 0.05;
