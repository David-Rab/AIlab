// Run-design data (V2-SPEC §3.3.1–3.3.2; model v3 V1: design/MODEL-V3.md §2–§4, research/20 §A, §C). Owner: WS1.
// Models are built from physical quantities: active parameters, tokens, FLOP, RL FLOP. Capability is effective compute
// G = log₁₀(FLOP × recipe efficiency) (models/effective.ts). Tags: [R20 xx] research/20 section, [D] design value,
// [fit] fitted (scripts/v2/calib.ts or the anchor named).
import type { BaseDesign, DataKind, DomainId, PostDesign, RLFamily, SignalId } from '../../engine/v2/types';
import { FAITHFUL_COT } from './safetyIdeas';

type Off = Partial<Record<DomainId, number>>;

// ───────────────────────────── pre-game frontier pace ─────────────────────────────

/** The frontier's pace before the game, in OOM of effective compute G a year (research/12 §0.2: frontier G +1.1–1.3 a
 *  year) [D]. RD-L03 (the progress-year unit is gone): the stated rate for the readers that need a pace before a lab
 *  has a recorded frontier slope (models/capability.ts frontierGPerYear with under two series.G points; lagDays'
 *  pre-history) and for the start gaps written in months (rivals.ts initialRival, core/init.ts follower starts,
 *  china.ts intel start estimate). */
export const PRE_GAME_G_PER_YEAR = 1.2;

// ───────────────────────────── pretraining (MODEL-V3 §3; R20 A1–A4) ─────────────────────────────

/** The leader's day-0 pretraining recipe for new runs (OOMs over the reference recipe, research/12 §0.2 convention:
 *  GPT-4 2023 = log₁₀ FLOP): B0's recipe (data/v2/calibration.ts START_STATE.b0, 0.85 on ai2027) + Ho et al.'s 0.48
 *  OOM/yr over B0's age at the start (256 days) = 1.19. Model v3 V3b: v2's start solution put the leader 0.53 OOM
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
export const SHAPE: Record<BaseDesign['shape'], { e: number; activeShare: number; tokenMult: number; restart?: never; monitorability?: number }> = {
  moe: { e: 0, activeShare: 1 / 8, tokenMult: 1 },
  dense: { e: -0.3, activeShare: 1, tokenMult: 1 },
  // Latent reasoning thinks without verbal tokens: v2's serving 0.2 vs MoE 0.5 kept as a token multiplier. Its CoT
  // pressure (S4 = 1) comes with the latent CoT a latent base forces (safety/traits.ts COT_S4).
  latent: { e: 0.5, activeShare: 1 / 8, tokenMult: 0.4, monitorability: 0.05 },
};
/** Blueprint snaps: active parameters (√2 steps: ×2 FLOP at fixed tokens per parameter) and tokens per active
 *  parameter ("compute-optimal" 20, "overtrained ×n" above; 400 the reference). The engine takes any value in the ranges. */
export const PARAM_SNAPS = [25e9, 35e9, 50e9, 70e9, 100e9, 140e9, 200e9, 280e9, 400e9, 560e9, 800e9, 1.1e12, 1.6e12, 2.2e12, 3.2e12, 4.5e12, 6.4e12, 9e12, 13e12, 18e12, 25e12] as const;
export const PARAM_RANGE: readonly [number, number] = [1e9, 1e14];
export const TPP_SNAPS = [20, 50, 100, 200, 400, 800] as const;
export const TPP_RANGE: readonly [number, number] = [5, 5000];
/** The reference base (B0 and RefBot's bases) is overtrained like 2025 production models (model v3 A6b): a lab that
 *  serves its models trains them inference-aware, ≈ 400 tokens per active parameter (DeepSeek-V3: 14.8T tokens on 37B
 *  active [R20 A1, D1]; Kimi K2 ≈ 480, Qwen3 and Llama 4 Maverick ≈ 1,300–1,600 [R, model cards]). B0 = 3e26 FLOP (a
 *  2025 frontier run, research/12 §0.3: 3–5e26) at that ratio: √(3e26 ÷ (6 × 400)) ≈ 354B active (MoE, 2.8T total),
 *  141T tokens. The overtraining factor f_over(400) costs 0.31 OOM of G against the old 1T × 50 at the same FLOP; the
 *  FLOP per served token falls ×2.8 (A6: the old 1T-active V0 served at ≈ 5–10× the 2025 FLOP per token). */
export const REF_TPP = 400;
export const B0_PARAMS = Math.sqrt(3e26 / (6 * REF_TPP));
/** Tokens per parameter above this need the "Overtrained compact" idea (long-run data pipelines) [D]: the reference
 *  ratio is free (every 2025 lab trains at it), heavier overtraining is the idea. */
export const TPP_FREE_MAX = REF_TPP;

/** Goodput: share of a run's wall time spent training (interruptions, restarts) [R20 A4: 0.90; 0.95 with fault-tolerant
 *  training, the top of the 0.80–0.95 range]. Replaces v2's per-run restart roll. */
export const GOODPUT = 0.9;
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

/** Continual-learning stream: share of the training pool used continuously and the tracking lag (§3.3.1). */
export const STREAM_POOL_SHARE = 0.15;
export const STREAM_LAG_DAYS = 7;

// ───────────────────────────── the reference recipe ─────────────────────────────

/** The RefBot recipe. */
export const REFERENCE_BASE: BaseDesign = {
  params: B0_PARAMS, tpp: REF_TPP, shape: 'moe', data: 'balanced',
  curation: { quality: true, hazard: false, safetyPretrain: false },
};

export const REFERENCE_POST: PostDesign = {
  pref: 'constitution', rlFocus: 'broad', rlBudget: 'standard', inoculation: false,
  cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [],
};

// ── Base choices ──
/** A run's scale relative to the reference frontier run F(t) (TrainingRun.scale) sets the public scrutiny of a run above
 *  the frontier, until RD-T11 (SYNTHESIS §6 Phase 6) measures scrutiny against the largest rival run. Engineering setup and operations read the physical FLOP since model v3 V3 (departments/build.ts engScale); S5 reads
 *  the base's G and drawn data since model v3 E3 (safety/traits.ts baseSignals). */
export const sizeScrutiny = (scale: number) => (scale > 1 ? (5 * Math.log(scale)) / Math.log(3) : 0);

/** Data-mix presets (model v3 D3): the blueprint's data option is a mix target for the draw from the data portfolio
 *  (production/data.ts drawData): domain shares from `base` × the domain tilt × the kind weights' pull (absent = 1),
 *  each domain's tokens taken from its assets in proportion to their quality-weighted unique tokens × kind weight.
 *  `base` 'reference' = the 2025 reference recipe's shares (the start portfolio's natural mix, which o_d was fitted
 *  with) for every preset [D]: "balanced" is the portfolio's natural mix at the start and stays at the reference shares
 *  after, so a lab whose stock fills with code-heavy synthetic data does not drift into a code model unless it picks a
 *  mix that draws it (with 'natural' RefBot's bases specialised in code and moved the golden dates by up to −1.4 y,
 *  design/notes/D3.md). The base's domain specialisation and repetition follow from what it drew (s_d,data, MODEL-V3
 *  §2.3), not from fixed offsets. Tilts and kind weights [D]: code & math = code ×3, math (REASON) ×2, research papers ×2, security ×1.5;
 *  science = bio ×3, math and research ×1.5; synthetic-heavy = synthetic assets ×4; multimodal = media and physical ×3,
 *  agency (screens, actions) ×2. `flopMult`: multimodal tokens cost +20% FLOP; `cashMult`: science journals +5% of
 *  the run's compute cost. Training pressure (S5 AI-related data, S6 synthetic data) follows from what the base drew
 *  (model v3 E3, safety/traits.ts baseSignals), not from the preset. */
export const BASE_DATA: Record<BaseDesign['data'], { base: 'reference' | 'natural'; tilt: Off; kinds: Partial<Record<DataKind, number>>; flopMult: number; cashMult: number }> = {
  balanced: { base: 'reference', tilt: {}, kinds: {}, flopMult: 1, cashMult: 0 },
  // model v3 D4 [D, the lead's call in D3]: the portfolio's own quality-weighted mix (no tilt): draws every token once
  // before any repeats (uMix = U), and specialises the base wherever the stock has drifted from the reference shares.
  // A player choice only; RefBot keeps 'balanced'.
  natural: { base: 'natural', tilt: {}, kinds: {}, flopMult: 1, cashMult: 0 },
  codeMath: { base: 'reference', tilt: { CODE: 3, REASON: 2, RSCH: 2, CYBER: 1.5 }, kinds: {}, flopMult: 1, cashMult: 0 },
  science: { base: 'reference', tilt: { BIO: 3, REASON: 1.5, RSCH: 1.5 }, kinds: {}, flopMult: 1, cashMult: 0.05 },
  synthetic: { base: 'reference', tilt: {}, kinds: { synthetic: 4 }, flopMult: 1, cashMult: 0 },
  multimodal: { base: 'reference', tilt: { MEDIA: 3, PHYS: 3, AGENCY: 2 }, kinds: {}, flopMult: 1.2, cashMult: 0 },
};
/** Curation (OOM: v2's Δp × B). The hazard filter's `dgD` is a domain ΔG in OOM of the domain's effective compute
 *  (RD-U01): BIO −0.5 OOM, was −1.0 L at v2's ΔL = 2·ΔG (the engine's conversion, so the mechanics are unchanged). */
export const CURATION = {
  qualityOffDg: -0.24,
  hazard: { dg: -0.024, dgD: { BIO: -0.5 } as Off }, // was BIO −1.0 L
  safetyPretrain: { dg: -0.024 }, // S5: it filters AI-related data (safety/traits.ts SAFETY_PRETRAIN_AI_CUT)
};

// ── Post choices ──
/** Preference training: `dg` OOM (v2's Δp × B); `dgD` a domain ΔG in OOM of the domain's effective compute (RD-U01:
 *  v2's level offsets ÷ 1.2, the conversion the fit applied, so the mechanics are unchanged; the displayed domain level
 *  is λ of the same G). */
/** A method's approval-reward pressure (S1) is safety/traits.ts PREF_S1 × the run's preference-RL share (model v3 E3). */
export const POST_PREF: Record<PostDesign['pref'], { dg: number; dgD: Off; appeal: number }> = {
  minimal: { dg: -0.06, dgD: {}, appeal: 0.7 },
  engagement: { dg: 0, dgD: { SOCIAL: 0.1667 }, appeal: 1.2 }, // GPT-4o rollback; was SOCIAL +0.2 L
  constitution: { dg: 0, dgD: {}, appeal: 1.0 },
  persuasion: { dg: 0, dgD: { SOCIAL: 0.6667 }, appeal: 1.1 }, // was SOCIAL +0.8 L
};
/** Reasoning modes: `dg` effective compute (OOM), `serveMult` serving FLOP per token relative to the base (it sets
 *  ModelVersion.fpt), `monitorability`. CoT pressure (S4) per mode is safety/traits.ts COT_S4; faithful (P23) also
 *  resists CoT pressure and controllability (data/v2/safetyIdeas.ts FAITHFUL_COT). */
export const POST_COT: Record<PostDesign['cot'], { dg: number; serveMult: number; monitorability: number }> = {
  visible: { dg: 0, serveMult: 1, monitorability: 0.9 },
  pressured: { dg: 0, serveMult: 0.8, monitorability: 0.6 }, // COT mask on RH/CONCEAL +0.3 (WS2)
  faithful: { dg: FAITHFUL_COT.dOom, serveMult: FAITHFUL_COT.fptMult, monitorability: FAITHFUL_COT.monitorability }, // needs P23 (E13 typed: data/v2/safetyIdeas.ts)
  latent: { dg: 0, serveMult: 1, monitorability: 0.05 }, // only on a latent base (its gain is the architecture's)
};
/** Alignment training: `dg` OOM. v2's extra wall days are gone (no minimum lengths). */
export const POST_SAFETY: Record<PostDesign['safety'], { dg: number }> = {
  minimal: { dg: 0.024 },
  standard: { dg: 0 },
  heavy: { dg: -0.048 }, // SCHEME −0.95×, EA ×2 (WS2, E25)
};

/** RL families: domain values v_f,d (v2 levels; the largest is the family's own domain, the others adjacent, every
 *  other domain far: RL_TRANSFER) and, for agentic families (multi-step episodes with tools), the typical task length
 *  of an episode `taskH` (hours of a human expert's work), which sets their long-horizon pressure S3 (model v3 E3,
 *  safety/traits.ts). SWE = the SWE work type's H (2 h), ML research = EXP's (8 h; RE-Bench's tasks are 8-hour tasks
 *  [R20 F1]), long-horizon agentic = IDEAS' (40 h, a working week) [data/v2/workTypes.ts]; computer use and cyber 1 h
 *  [D: desktop tasks and CTF challenges are short multi-step episodes]. Math and bio are single-answer (not agentic). */
export const RL_FAMILIES: Record<RLFamily, { v: Off; taskH?: number; h80Mult?: number }> = {
  math: { v: { REASON: 1.2 } },
  swe: { v: { CODE: 1.6, RSCH: 0.8, CYBER: 0.6 }, taskH: 2 },
  computerUse: { v: { AGENCY: 1.6, REASON: 0.8 }, taskH: 1 }, // needs P06
  mlResearch: { v: { RSCH: 1.6 }, taskH: 8 },
  longHorizon: { v: { AGENCY: 0.6 }, taskH: 40, h80Mult: 2 },
  cyber: { v: { CYBER: 2.0 }, taskH: 1 },
  bio: { v: { BIO: 1.6 } },
};
export const RL_FAMILY_IDS = Object.keys(RL_FAMILIES) as RLFamily[];

export const SIGNAL_IDS: SignalId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];
