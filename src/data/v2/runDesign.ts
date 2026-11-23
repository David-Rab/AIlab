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
/** Architecture: effective-compute offset (OOM) and active/total parameter ratio [D]. MoE is the reference; dense −0.3 OOM
 *  (a dense model gets less capability from the same training FLOP than a sparse mixture of experts); latent-recurrent
 *  +0.5 OOM (it reasons in its hidden state, needs P17). MoE active = total ÷ 8. */
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
/** RD-T08 (TRN-31): tokens per parameter is a plain trade-off, no research gate: more tokens on fewer parameters is
 *  cheaper to serve (FLOP per token ∝ active parameters), fewer tokens on more parameters is more capable per training
 *  FLOP (models/effective.ts fOver). The Blueprint labels the ends so. */
export const TPP_TRADE = { low: 'more capable per FLOP', high: 'cheaper to serve' } as const;

/** Goodput: share of a run's wall time spent training (interruptions, restarts) [R20 A4: 0.90; 0.95 with fault-tolerant
 *  training, the top of the 0.80–0.95 range]. Replaces v2's per-run restart roll. */
export const GOODPUT = 0.9;
/** RL runs: rollouts are inference, so model-FLOP utilisation is lower: MFU_RL = 0.6 × MFU [D, R20 C1]. */
export const MFU_RL_FACTOR = 0.6;

// ───────────────────────────── post-training (MODEL-V3 §4.2; R20 C1, C2) ─────────────────────────────

/** RL budget: RL FLOP as a share ρ of the base's pretraining FLOP [D, R20 C1: frontier 0.05–1 (R1 0.05, Grok 4 ≈ 1)]. */
export const RL_BUDGET: Record<PostDesign['rlBudget'], number> = { light: 0.03, standard: 0.15, heavy: 0.4 };
/** RL curve per family, in G units (OOM of effective compute): ΔG = A/(1 + (C_mid/C)^B) (the sigmoid form of Khatri et
 *  al. 2025 [R20 C1]; parameters from research/RD-RL-scaling.md §5 option (c), CP3g).
 *  - A = A0 + a1·log₁₀(FLOP_pre ÷ FLOP_RL_REF). A0 = 2.0 OOM (≈ 100×) [D: top of Epoch's CEG range 1–100×; Ord 2025's
 *    "GPT-level" step]; a1 = 0 (RD-RL-scaling §5: the base dependence now lives in the midpoint, and the gain is added
 *    to the base's G, Yue et al. 2025's relative ceiling). Range: A0 1.5–2.5 (Davidson et al. 2023: 5–30×, a few higher).
 *  - B = 0.33: slope at the reference A·B·ln10·σ(1−σ) ≈ 0.35 G per OOM of RL FLOP [D: OpenAI's o1 chart read by Ord 2025
 *    (10× RL ≈ 3× inference) × Villalobos & Atkinson 2023 (1 OOM of training ≈ 1–2 OOM of inference): 0.25–0.5 per OOM
 *    of RL, central 0.33]. Was 1.8, Khatri's fit to a pass rate, not to OOM of effective compute (a units error).
 *  - C_mid = c0·(FLOP_pre ÷ FLOP_RL_REF)^kMid / 10^e_RL: the midpoint is a fixed number of RL episodes, not fixed FLOP
 *    [D: a rollout costs ≈ 2·N·L FLOP, so at share ρ the episodes ∝ 3ρD/L, and Chinchilla D ∝ FLOP^0.5]: kMid = 0.5,
 *    range 0.35–0.7 (Khatri's Scout vs 8B midpoint ≈ N_active^0.7 in GPU-hours; Tan et al. 2025: per-sample efficiency
 *    saturates above ~30B). DD-06's intent kept, sub-linearly: a bigger base reaches the same gain at a smaller budget
 *    share. Fixed-recipe G per OOM of training FLOP ≈ 1 + 0.35·(1 − kMid) ≈ 1.18 (≈ 1.6 under RD-T04's absolute
 *    midpoint, kMid 0, B 1.8). The RL recipe e_RL moves the midpoint, not the ceiling.
 *  c0 (FLOP) is solved (models/effective.ts) so the reference run (standard budget, broad) on the reference base
 *  (FLOP_RL_REF) gains RL_REF_GAIN at the start recipe. */
export const RL_CURVE = { A0: 2.0, a1: 0, B: 0.33, kMid: 0.5 };
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

/** Continual-learning stream: share of the training pool used continuously (§3.3.1) and its period (RD-T03, DD-05): every
 *  STREAM_PERIOD_DAYS the FLOP that share delivered is spent on a continued-pretraining increment and an RL refresh of
 *  the streamed version (models/runs.ts) [D: weekly, the old tracking cadence]. */
export const STREAM_POOL_SHARE = 0.15;
export const STREAM_PERIOD_DAYS = 7;

// ───────────────────────────── the reference recipe ─────────────────────────────

/** The RefBot recipe. */
export const REFERENCE_BASE: BaseDesign = {
  params: B0_PARAMS, tpp: REF_TPP, shape: 'moe', data: 'balanced',
  curation: { quality: true, hazard: false, safetyPretrain: false },
};

export const REFERENCE_POST: PostDesign = {
  pref: 'constitution', rlFocus: 'broad', rlBudget: 'standard',
  cot: 'visible', safety: 'standard', methods: [],
};

// ── Base choices ──
/** Public scrutiny of a base run from its FLOP over the largest rival training run (RD-T11, models/runs.ts
 *  rivalRunFlop): 0 at or below it, +5 per ×3 above. */
export const sizeScrutiny = (ratio: number) => (ratio > 1 ? (5 * Math.log(ratio)) / Math.log(3) : 0);
/** Window of the rival reference run (RD-T11) [D]: a rival base finished in the last year counts, as does a run in
 *  progress (at its planned FLOP: FLOP so far + the lab's base-run rate × the days to its due day). */
export const SCRUTINY_WINDOW_DAYS = 365;

/** Data-mix presets (model v3 D3; RD-T08, TRN-20): named per-domain weight targets for the draw from the data portfolio
 *  (production/data.ts drawData). Each domain's share of the base's tokens = the portfolio's own quality-weighted mix ×
 *  the preset's domain weight × the kind weights' pull (absent = 1); each domain's tokens come from its assets in
 *  proportion to their quality-weighted unique tokens × kind weight. "Balanced" draws every domain in proportion to the
 *  data you hold. The base's domain specialisation, repetition and FLOP (6 × parameters × tokens, whatever the tokens
 *  are) follow from what it drew, not from the preset. Weights [D]: code & math = code ×3, math (REASON) ×2, research
 *  papers ×2, security ×1.5; science = bio ×3, math and research ×1.5; synthetic-heavy = synthetic assets ×4;
 *  multimodal = media and physical ×3, agency (screens, actions) ×2. RefBot draws its own fixed 2025 shares
 *  (bots/ref.ts REFBOT_DATA_SHARES, BaseDesign.mixShares) so a stock that drifts toward code does not move the golden
 *  dates. Training pressure (S5 AI-related data, S6 synthetic data) follows from what the base drew (safety/traits.ts). */
export const BASE_DATA: Record<BaseDesign['data'], { weights: Off; kinds: Partial<Record<DataKind, number>> }> = {
  balanced: { weights: {}, kinds: {} },
  codeMath: { weights: { CODE: 3, REASON: 2, RSCH: 2, CYBER: 1.5 }, kinds: {} },
  science: { weights: { BIO: 3, REASON: 1.5, RSCH: 1.5 }, kinds: {} },
  synthetic: { weights: {}, kinds: { synthetic: 4 } },
  multimodal: { weights: { MEDIA: 3, PHYS: 3, AGENCY: 2 }, kinds: {} },
};
/** RD-T08 (TRN-11): curation acts through the draw (production/data.ts drawWith), not as flat offsets.
 *  Quality filter [D]: drops the worst quarter of the raw tokens of the unfiltered kinds (the public crawl and product
 *  usage logs; licences and synthetic data arrive curated); the kept three quarters are 1.25× the quality (the dropped
 *  quarter was 0.25×, so the quality-weighted stock falls only 6%). The drawn tokens' mean quality rises and the unique
 *  tokens fall, so a big base repeats sooner. The reference recipe has it on. */
export const QUALITY_FILTER: { kinds: readonly DataKind[]; cut: number; qMult: number } = { kinds: ['public', 'usage'], cut: 0.25, qMult: 1.25 };
/** Hazard filter [D]: removes the hazardous share of the bio and cyber tokens (dual-use virology, exploit write-ups:
 *  a third of each domain's tokens, every asset) from the draw; the base draws correspondingly fewer tokens of those
 *  domains, so its BIO / CYBER specialisation falls (ALPHA_DATA × log₁₀(2/3) ≈ −0.26 OOM) and the other domains take the
 *  freed share. */
export const HAZARD_FILTER: Partial<Record<DomainId, number>> = { BIO: 1 / 3, CYBER: 1 / 3 };
/** Safety pretraining [D]: −0.02 OOM of effective compute (the AI-related text it filters and the alignment text it
 *  adds displace some capability data); its S5 cut is safety/traits.ts SAFETY_PRETRAIN_AI_CUT. */
export const SAFETY_PRETRAIN_DG = -0.02;

// ── Post choices ──
/** Preference training [D]: `dg` general ΔG (OOM; minimal −0.06: a thin preference stage leaves the model harder to
 *  use); `dgD` a domain ΔG in OOM of the domain's effective compute (RD-U01; the displayed domain level is λ of the
 *  same G). */
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
/** Alignment training [D]: `dg` OOM (the alignment tax: heavier refusal and honesty training costs a little capability,
 *  minimal gains a little). */
export const POST_SAFETY: Record<PostDesign['safety'], { dg: number }> = {
  minimal: { dg: 0.02 },
  standard: { dg: 0 },
  heavy: { dg: -0.05 }, // SCHEME −0.95×, EA ×2 (WS2, E25)
};

/** RL families (RD-T05): each family's `own` domain (RL transfers in full, RL_TRANSFER.same) and its `adjacent`
 *  domains (RL_TRANSFER.adjacent); every other domain is far (RL_TRANSFER.far) [R20 C2]. For agentic families (multi-step
 *  episodes with tools), the typical task length of an episode `taskH` (hours of a human expert's work), which sets
 *  their long-horizon pressure S3 (model v3 E3, safety/traits.ts). SWE = the SWE work type's H (2 h), ML research =
 *  EXP's (8 h; RE-Bench's tasks are 8-hour tasks [R20 F1]), long-horizon agentic = IDEAS' (40 h, a working week)
 *  [data/v2/workTypes.ts]; computer use and cyber 1 h [D: desktop tasks and CTF challenges are short multi-step
 *  episodes]. Math and bio are single-answer (not agentic). The long-tasks family's time-horizon gain is
 *  LONG_TASKS_HORIZON (from the RL it actually does), not a flag on the family. */
export const RL_FAMILIES: Record<RLFamily, { own: DomainId; adjacent: DomainId[]; taskH?: number }> = {
  math: { own: 'REASON', adjacent: [] },
  swe: { own: 'CODE', adjacent: ['RSCH', 'CYBER'], taskH: 2 },
  computerUse: { own: 'AGENCY', adjacent: ['REASON'], taskH: 1 }, // needs P06
  mlResearch: { own: 'RSCH', adjacent: [], taskH: 8 },
  longHorizon: { own: 'AGENCY', adjacent: [], taskH: 40 },
  cyber: { own: 'CYBER', adjacent: [], taskH: 1 },
  bio: { own: 'BIO', adjacent: [] },
};
/** RD-T05: time-horizon gain from long-task RL. A version's horizon multiplier is
 *  h80Mult = (perFocus × P07)^x,  x = max(0, (g − g_broad) / (g_focus − g_broad)),
 *  g = the long-tasks family's in-family RL gain on its curve (models/effective.ts rlGains perFamily.longHorizon: its
 *  share of the RL compute, on the base's ceiling × the long-tasks suite's fidelity), g_broad / g_focus = that gain of
 *  the reference run (reference base B0, standard budget, e_RL 0, fidelity 1) with broad / long-tasks focus. So the
 *  reference broad run keeps ×1, the reference long-tasks focus ×perFocus (2, the old flat value [D]), and the horizon
 *  rises smoothly with the RL actually done on long tasks (more share, budget, base ceiling or suite fidelity). Never
 *  below ×1 (less long-task RL than the broad reference does not shorten the horizon below the base's). */
export const LONG_TASKS_HORIZON = { perFocus: 2 };
export const RL_FAMILY_IDS = Object.keys(RL_FAMILIES) as RLFamily[];
/** RD-E01b (DD-14), RD-T05: Long context + memory (P07) multiplies the long-tasks horizon gain per unit of long-task
 *  RL (LONG_TASKS_HORIZON: perFocus 2 becomes 2.4, so ×2.4 at the reference long-tasks focus, ×1 at broad) of
 *  post-trains launched after its adoption (the run freezes the flag, PostRecipe.p07): ×1.2 [D] (was ×1.2 on every
 *  post-train's horizon). research/12 #7 proposed ×1.5 [G, no primary source]; CL-Bench 2026 finds dedicated memory
 *  systems not yet beating in-context learning [P, research/12 §2], so a smaller multi-day-continuity effect, and on
 *  the RL family that trains week-long episodes (memory carries state across them), not on every run. */
export const P07_LONG_TASKS_HORIZON = 1.2;

export const SIGNAL_IDS: SignalId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];
