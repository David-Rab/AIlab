// Trait causal graph dynamics and misalignment index (V2-SPEC §3.5.4). Owner: WS2.
//
// One pure update `stepTraits(x, env)` serves every lab: the player's runs (applyRunToTraits), continual-learning
// streams, IDA cycles, and rivals/China (rivalTraitStep, signals from their hidden SafetyPosture, §3.10.3).
//   Δx_j = ω · D_j · (1 − x_j) · Σ_{e→j} w_e · a_e · mod_e  +  ω · amp_j(U-modes)  −  removal_j
// Nodes are visited in topological order S → L → A → B (data/v2/traits.ts TRAIT_ORDER).
import { EDGES } from '../../../data/v2/edges';
import { TRAIT_BY_ID, TRAIT_IDS, TRAIT_ORDER, TRAIT_START } from '../../../data/v2/traits';
import { UMODES } from '../../../data/v2/umodes';
import { BASE_DATA, IDA_RL_SHARE, REFERENCE_BASE, RL_BUDGET, RL_FAMILIES as RL_FAMILY_DEF, RL_FAMILY_IDS, RL_FAMILY_NEEDS } from '../../../data/v2/runDesign';
import { rlWeights, type FamilyMap } from '../models/effective';
import { suiteExploitMap, suiteRlWeights, suiteS2 } from '../models/suites';
import { bestPlayerVersion, CHINA_ID, PLAYER_ID } from '../models/labs';
import { drawData, playerDraw, startPortfolio, type DataDraw } from '../production/data';
import type {
  BaseDesign, BaseModel, DomainId, EngineSystem, GameStateV2, ModelVersion, PostDesign, RivalLab, RLFamily, RngLike, SafetyPosture, SignalId,
  SimpleModel, SystemCtx, ToolFamily, TrainingRun, TraitBelief, TraitId, TraitVector, UModeId,
} from '../types';
import { adopted, clamp01, copyRec, flagNum, labLevel, SC_LEVEL, setFlag, tierOfLevel, trueEfficacy, versionById } from './common';
import { lineMultCapped, lineStaffed } from './agendas';
import { SD_MAX, eaCoef, eaSuppression, stackDetectionMap, takesEaPenalty } from './detection';
import { techniqueRole } from './techniques';
import { cotResist, probeGoodhart, probeSteer, steerGrowth } from './ideas';
import { aiRdShare, internalOversight } from './incidents';
import { steerS4, steerSuccessor } from './covert';
import { linkSteeredSuccessor } from './footholds';
import { routineMonitor } from '../departments/agents';
import { workContext, type CapSlot } from '../departments/workfit';
import { crystalMult, crystalThreshold, drawLineageUModesV2, uModeAmp, uModeEdgeMult, uModeRemovalMult } from './umodes';

const SPECULATIVE = new Set(UMODES.filter((u) => u.kind === 'speculative').map((u) => u.id));

export type Signals = Record<SignalId, number>;
export const zeroSignals = (): Signals => ({ S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0 });

// ───────────────────────────── Signals from run quantities (model v3 E3, MODEL-V3 §11.2) ─────────────────────────────
//
// Each signal is a function of what the run physically does: its RL compute ρ (a share of the base's pretraining FLOP)
// and how that splits over the RL families (shares w_f), the suites' exploitability, the preference stage's share, the
// base's effective compute G and the data it drew. The reference recipe at the start (standard budget, broad RL on the
// six start suites, constitution, visible CoT; the reference base on the start portfolio) reproduces V1's design table
// exactly (scripts/v2/signals.ts). Numbers: [P] primary source, [R20 xx] research/20, [fit] fitted to the V1 table at
// the reference, [D] design value.

/** RL compute of the reference post-training run, as a share of the base's pretraining FLOP (the standard budget). */
export const RHO_REF = RL_BUDGET.standard;
/** A run's RL FLOP over its base's pretraining FLOP (ρ). */
export type RunQuantities = {
  /** RL FLOP ÷ the base's pretraining FLOP (post, IDA). Default: the design's budget share. */
  rho?: number;
};
const rhoOf = (post: Pick<PostDesign, 'rlBudget'>, q?: RunQuantities) => Math.max(1e-6, q?.rho ?? RL_BUDGET[post.rlBudget]);

/** S2 optimisation pressure (Gao, Schulman & Hilton 2022 [R20 F1]): with d = √KL(π‖π_init), RL's gold reward follows
 *  R = d·(α − β·ln d), so the share of the proxy's reward that is over-optimisation (proxy − gold ÷ proxy ∝ β·ln d / α)
 *  rises linearly in log d, and d grows with optimisation. In compute: p(ρ) = 1 + K_GAO·log₁₀(ρ/ρ_ref), ≥ P_MIN.
 *  K_GAO = 0.71 [fit]: V1's budget table (light ×0.5 at ρ 0.03, heavy ×1.3 at ρ 0.4) lies on this line (0.715 and
 *  0.704 per decade). Gao's coefficients are for best-of-n/PPO on small reward models and do not transfer in size;
 *  the functional form does. */
export const K_GAO = 0.71;
export const P_MIN = 0.1;
export const optimisationPressure = (rho: number) => Math.max(P_MIN, 1 + K_GAO * Math.log10(Math.max(1e-6, rho) / RHO_REF));
/** Per-family hack rate of a run: h_f = x_f · p(ρ). The suites' exploitability x_f is the 2025 observed hack rate at the
 *  reference pressure (D5: METR o3 RE-Bench 30%, SWE scaffolds 43%, HCAST ≈1% with cheap graders; × 0.4 hardened)
 *  [R20 F1]. Readout for E10 (rate calibration) and the F2 "learned hacking" threshold. */
export function hackRates(w: FamilyMap, exploit: FamilyMap, rho: number): FamilyMap {
  const p = optimisationPressure(rho);
  const out: FamilyMap = {};
  for (const [f, wf] of Object.entries(w) as [RLFamily, number][]) if (wf > 0) out[f] = Math.min(1, (exploit[f] ?? 0) * p);
  return out;
}

/** S1 approval reward: the method's approval bias × the run's preference-RL share ÷ the reference's. The method
 *  multipliers stay V1's [D]: engagement (user thumbs-up reward, the GPT-4o rollback, research/14 E01) 0.9 > persuasion
 *  0.6 > constitution (AI feedback against a written spec) 0.4 > minimal 0.1. */
export const PREF_S1: Record<PostDesign['pref'], number> = { minimal: 0.1, engagement: 0.9, constitution: 0.4, persuasion: 0.6 };
/** Preference stage compute as a share of pretraining FLOP: InstructGPT's PPO-ptx on 175B took 60 petaflop/s-days vs
 *  GPT-3's 3,640 (1.6%) [P, Ouyang et al. 2022 §5.1]. The preference stage is a fixed size; outcome RL (ρ) varies, so
 *  the preference share of the run's RL is PREF_RL_FRAC / (PREF_RL_FRAC + ρ): 9.6% at the standard budget. */
export const PREF_RL_FRAC = 0.016;
export const prefShare = (rho: number) => PREF_RL_FRAC / (PREF_RL_FRAC + Math.max(0, rho));

/** S3 long-horizon agentic RL: K_S3 · Σ_f w_f · log₁₀(1 + H_f) over the agentic families (H_f = the family's task
 *  length in hours, data/v2/runDesign.ts RL_FAMILIES.taskH). Log task length [D]: METR measures horizons on a log scale,
 *  so each doubling of the episode counts the same. K_S3 [fit]: the reference (broad over the six start suites) gives
 *  V1's 0.75 (its family table summed computer use, long tasks and cyber at half weight each). */
const taskTerm = (f: RLFamily) => Math.log10(1 + (RL_FAMILY_DEF[f].taskH ?? 0));
/** S5 from long-horizon agentic RL: the episodes teach a model about its own situation (research/14 E07) [D: V1's 0.1 at
 *  half weight = 0.3 per unit of RL share]. */
export const S5_LONG = 0.3;
/** S7 eval-like environments: ML-research environments are the benchmarks evals use (RE-Bench) [D: V1's 0.2 at half
 *  weight = 0.6 per unit of RL share]. */
export const S7_EVAL_ENV = 0.6;
/** S7 from capability RL itself (research/20 F5: a capabilities-only RL run raised verbalised eval awareness ~2% → 20.6%,
 *  Schoen et al. 2025 [R]; "awareness grows with RL itself"): S7_RL·(1 + K_S7·log₁₀(ρ/ρ_ref)), ≥ 0. S7_RL 0.2 and K_S7
 *  1.35 per decade (+0.27 of S7) [fit: V1's light 0 / standard 0.2 / heavy 0.3 give 0.011 / 0.2 / 0.315]. Relative to
 *  the base like S2's pressure, so a lab's growing bases do not raise it by themselves. */
export const S7_RL = 0.2;
export const K_S7 = 1.35;
export const s7OfRl = (rho: number) => Math.max(0, S7_RL * (1 + K_S7 * Math.log10(Math.max(1e-6, rho) / RHO_REF)));
/** Training against a behavioural detector puts eval-like data into training (research/14 E11 "keep evals out of
 *  training") [D, V1]. */
export const S7_PER_BB = 0.3;
/** Baseline S6 (narrow fine-tunes: refusal and format SFT) and S7 (eval-like data) in any post run [D, V1]. */
export const S6_POST = 0.1;
export const S7_BASE = 0.05;
/** CoT pressure per CoT mode; training against a CoT-monitor detector is CoT pressure too (Baker et al. 2025:
 *  putting the monitor into the reward gives obfuscated reward hacking [R20 F1]) and counts as 'pressured'. */
export const COT_S4: Record<PostDesign['cot'], number> = { visible: 0, pressured: 0.8, faithful: 0, latent: 1.0 };

/** K_S3 [fit] and the families of the reference run (the six start suites). */
const START_FAMS = RL_FAMILY_IDS.filter((f) => !RL_FAMILY_NEEDS[f]);
export const K_S3 = 0.75 / START_FAMS.reduce((a, f) => a + taskTerm(f) / START_FAMS.length, 0);

/** S8 from deployment (§3.5.4): min(1, internal copies / 300k) + 0.2·[P05]; P20 (agent societies) sets S8 = 1. */
export function deploymentS8(s: GameStateV2): number {
  const copies = s.player.prodCache?.labor.copies ?? 0;
  let s8 = Math.min(1, copies / 3e5) + (adopted(s, 'P05') ? 0.2 : 0);
  if (adopted(s, 'P20')) s8 = Math.max(s8, 1);
  return s8;
}

// ── base runs: S5 from scale and AI-related data, S6 from synthetic data ──

/** Share of each domain's tokens that are about AI systems (models, training, evals, AI discourse) [D]: research
 *  papers (ML is the largest arXiv field) 10%, code, forums and media 2%, the rest 0.5% — the reference mix gives 2.2%.
 *  Usage data (transcripts of the lab's own assistant) is about an AI by construction; a quarter of it is the model's
 *  own situation, tests and self-description [D]. Synthetic data mirrors its domains like human text. */
export const AI_DOMAIN_FRAC: Partial<Record<DomainId, number>> = { RSCH: 0.1, CODE: 0.02, SOCIAL: 0.02, MEDIA: 0.02 };
export const AI_DOMAIN_FRAC_REST = 0.005;
export const AI_USAGE_FRAC = 0.25;
/** Safety pretraining (AG15: filtering and re-labelling "about AI" documents) removes this share of the AI-related
 *  data [fit: V1's −0.15 of the reference 0.2]. */
export const SAFETY_PRETRAIN_AI_CUT = 0.75;
/** S5 from AI-related data at the reference share (V1's 0.2 baseline) [D, V1]. */
export const S5_AI = 0.2;
/** S5 from scale: K_S5G per OOM of the base's pretraining G above G_S5_0 (Berglund et al. 2023, Laine et al. 2024 SAD:
 *  out-of-context reasoning and situational awareness improve with scale; research/14 E07). K_S5G 0.05 [fit: least
 *  squares on V1's 0.2 + 0.1·tier along RefBot's bases (ai2027, seeds 500–501), net of the AI-data term]; G_S5_0 so
 *  that the reference start base B0 (G_pre 27.30) has V1's 0.08 (start tier 0.8). Replaces BRIDGE(V6)'s run scale vs
 *  F(t) and the know-how tier: S5 now reads the model's own scale, the same in every world. */
export const K_S5G = 0.05;
export const G_S5_0 = 27.3 - 0.08 / K_S5G;
/** S6 per unit share of AI-generated (synthetic or distilled) training data [D: a distillation run, all teacher data,
 *  keeps V1's 0.3]; the base's narrow-data baseline makes the reference start base read V1's 0.1 [fit]. */
export const S6_SYN = 0.3;

/** What a base run drew: AI-related and synthetic shares of its tokens (production/data.ts drawData). */
export interface BaseQuantities { gPre: number; draw: Pick<DataDraw, 'tokens' | 'share' | 'byKind'> }
/** AI-related share of a draw: Σ_d share_d·f_d on the non-usage tokens (the drawn domain shares stand in for theirs) +
 *  usage share × AI_USAGE_FRAC; × (1 − cut) with safety pretraining. */
export function aiDataShare(draw: BaseQuantities['draw'], safetyPretrain = false): number {
  const T = Math.max(1, draw.tokens);
  const usage = (draw.byKind.usage ?? 0) / T;
  let dom = 0;
  for (const [d, x] of Object.entries(draw.share) as [DomainId, number][]) dom += x * (AI_DOMAIN_FRAC[d] ?? AI_DOMAIN_FRAC_REST);
  const a = dom * (1 - usage) + usage * AI_USAGE_FRAC;
  return a * (safetyPretrain ? 1 - SAFETY_PRETRAIN_AI_CUT : 1);
}
export const syntheticShare = (draw: BaseQuantities['draw']) => (draw.byKind.synthetic ?? 0) / Math.max(1, draw.tokens);
/** The reference start base's draw (B0's size on the start portfolio, balanced): its AI-related and synthetic shares. */
let refDraw: { ai: number; syn: number } | undefined;
export function referenceBaseShares(): { ai: number; syn: number } {
  if (!refDraw) {
    const d = drawData(startPortfolio(), REFERENCE_BASE.params * REFERENCE_BASE.tpp, { base: BASE_DATA.balanced.base, tilt: BASE_DATA.balanced.tilt, kinds: BASE_DATA.balanced.kinds });
    refDraw = { ai: aiDataShare(d), syn: syntheticShare(d) };
  }
  return refDraw;
}

/** Base-run signals (MODEL-V3 §11.2): S5 = S5_AI·(AI-related share ÷ the reference's) + K_S5G·(G_pre − G_S5_0);
 *  S6 = S6_SYN·(synthetic share − the reference's) + 0.1. Teacher traits do not pass to a new base: a new pretraining
 *  run is a new initialisation (Cloud et al. 2025 [R20 F3]). */
export function baseSignals(design: BaseDesign, q: BaseQuantities): Signals {
  const sg = zeroSignals();
  const ref = referenceBaseShares();
  sg.S5 = clamp01(S5_AI * (aiDataShare(q.draw, design.curation.safetyPretrain) / ref.ai) + K_S5G * Math.max(0, q.gPre - G_S5_0));
  sg.S6 = clamp01(S6_POST + S6_SYN * (syntheticShare(q.draw) - ref.syn));
  return sg;
}
/** A base's quantities as the player's engine builds it today (its G and the draw from today's portfolio). */
export function baseQuantitiesOf(s: GameStateV2, design: BaseDesign, gPre: number): BaseQuantities {
  return { gPre, draw: playerDraw(s, design) };
}

// ── post-training runs ──

/** Post-run signals (MODEL-V3 §11.2) from the run's quantities; S8 from the current deployment.
 *   S1 = PREF_S1[method] · prefShare(ρ)/prefShare(ρ_ref)
 *   S2 = S2_PER_EXPLOIT · Σ_f w_f·x_f · p(ρ) (+ P11 0.2): the RL-weighted hack rate (D5's suite form × Gao's pressure)
 *   S3 = K_S3 · Σ_f w_f·log₁₀(1 + H_f)            S5 = S5_LONG · w_longHorizon
 *   S4 = CoT mode, or 'pressured' when trained against a CoT monitor (× (1 − 0.5) on a faithful-CoT run, P23)
 *   S6 = S6_POST (narrow fine-tunes)               S7 = S7_BASE + s7(ρ) + S7_EVAL_ENV·w_mlResearch + S7_PER_BB·#BB detectors
 *  `exploit` = the suites a run froze at launch (TrainingRun.recipe.exploit; their families set the shares w_f), else the
 *  lab's suites today (predictions, continual learning, IDA). Every signal is clamped to [0, 1]. */
export function postSignals(s: GameStateV2, post: PostDesign, exploit?: Partial<Record<RLFamily, number>>, q?: RunQuantities): Signals {
  const sg = zeroSignals();
  const rho = rhoOf(post, q);
  const x = exploit ?? suiteExploitMap(s);
  const w = exploit ? rlWeights(post.rlFocus, RL_FAMILY_IDS.filter((f) => exploit[f] !== undefined)) : suiteRlWeights(s, post.rlFocus);
  sg.S1 = PREF_S1[post.pref] * (prefShare(rho) / prefShare(RHO_REF));
  sg.S2 = suiteS2(w, x) * optimisationPressure(rho) + (adopted(s, 'P11') ? 0.2 : 0);
  let s3 = 0;
  for (const [f, wf] of Object.entries(w) as [RLFamily, number][]) s3 += wf * taskTerm(f);
  sg.S3 = K_S3 * s3;
  const cotMonitor = post.trainAgainst.some((id) => s.player.safety.techniques[id]?.family === 'COT');
  // P23: faithful-by-construction reasoning resists the pressure of training against a CoT monitor (FAITHFUL_COT.resist).
  sg.S4 = Math.max(COT_S4[post.cot], cotMonitor ? COT_S4.pressured * (1 - cotResist(post.cot)) : 0);
  sg.S5 = S5_LONG * (w.longHorizon ?? 0);
  sg.S6 = S6_POST;
  sg.S7 = S7_BASE + s7OfRl(rho) + S7_EVAL_ENV * (w.mlResearch ?? 0);
  for (const id of post.trainAgainst) if (s.player.safety.techniques[id]?.family === 'BB') sg.S7 += S7_PER_BB;
  sg.S8 = deploymentS8(s);
  for (const k of Object.keys(sg) as SignalId[]) sg[k] = clamp01(sg[k]);
  return sg;
}

/** Distillation signals: S6 = S6_SYN × the share of teacher outputs in the student's data (all of it). */
export function distillSignals(): Signals {
  const sg = zeroSignals();
  sg.S6 = S6_SYN;
  return sg;
}

// ── how much a run moves traits (ω) ──

/** Trait-movement weight per run kind at the reference quantities [D, v2]: a base sets the lineage (1.0), a post-train
 *  0.6, continued pretraining 0.5, a distillation or an amplification cycle 0.4. */
export const OMEGA_KIND = { base: 1, post: 0.6, continue: 0.5, distill: 0.4, ida: 0.4 } as const;
/** Exponent of ω in the run's RL compute: ω = ω_kind · (ρ/ρ_ref)^OMEGA_RL_EXP for post-training and IDA [D]. Gao et
 *  al.'s decomposition R = d·(α − β·ln d) separates how far the policy moves (d = √KL) from the over-optimisation
 *  share (S2's pressure); d grows with optimisation [R20 F1], here as the fourth root of RL compute (5× less RL → ×0.67,
 *  2.7× more → ×1.28). Safety training (the removal side of the step) keeps ω_kind: it is its own stage, sized by the
 *  safety setting, not by the RL budget. */
export const OMEGA_RL_EXP = 0.25;
export const rlMovement = (rho: number) => Math.pow(Math.max(1e-6, rho) / RHO_REF, OMEGA_RL_EXP);
/** ω of a run: `growth` moves traits along the graph's edges; `safety` scales the run's safety-training removal. */
export function runOmega(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'name' | 'baseId' | 'flopNeeded'> & { post?: PostDesign }): { growth: number; safety: number } {
  if (run.kind === 'base') return { growth: OMEGA_KIND.base, safety: OMEGA_KIND.base };
  if (run.kind === 'continue') return { growth: OMEGA_KIND.continue, safety: OMEGA_KIND.continue };
  if (run.kind === 'distill') return { growth: OMEGA_KIND.distill, safety: OMEGA_KIND.distill };
  const k = run.name?.startsWith('IDA') ? OMEGA_KIND.ida : OMEGA_KIND.post;
  const rho = runRho(s, run);
  return { growth: k * rlMovement(rho), safety: k };
}
/** ρ of a post/IDA run: its RL FLOP over its base's pretraining FLOP (the design's budget share when unknown). */
export function runRho(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'name' | 'baseId' | 'flopNeeded'> & { post?: PostDesign }): number {
  const base = run.baseId ? s.player.models.bases.find((b) => b.id === run.baseId) : undefined;
  if (base && base.flop > 0 && run.flopNeeded > 0) return run.flopNeeded / base.flop;
  if (run.name?.startsWith('IDA')) return IDA_RL_SHARE;
  return RL_BUDGET[run.post?.rlBudget ?? 'standard'];
}

/** Signals a run applies (WS1's RunPrediction.signals ▲ arrows, the version's readout and applyRunToTraits). `q` = a
 *  base run's G and draw when the caller has them (planRun, completion); else today's draw at the newest base's G. */
export function runSignals(s: GameStateV2, run: TrainingRun, q?: BaseQuantities): Signals {
  if (run.kind === 'base' || run.kind === 'continue') {
    const parent = run.baseId ? s.player.models.bases.find((b) => b.id === run.baseId) : undefined;
    const design = run.base ?? parent?.design;
    if (!design) return zeroSignals();
    return baseSignals(design, q ?? baseQuantitiesOf(s, design, parent?.gPre ?? Math.max(...s.player.models.bases.map((b) => b.gPre))));
  }
  if (run.kind === 'distill') return distillSignals();
  if (run.post) return postSignals(s, run.post, run.recipe?.exploit, { rho: runRho(s, run) });
  return zeroSignals();
}

// ───────────────────────────── The update ─────────────────────────────

export interface TraitEnv {
  signals: Signals;
  /** How much the run moves traits along the edges (runOmega growth). */
  omega: number;
  /** ω of the run's safety training (removal, alignment brackets); default `omega` (runOmega safety). */
  omegaSafety?: number;
  /** difficultyMult D_w (true for the engine; 1 for the player's predicted beliefs). */
  D: number;
  /** Edge weights (realised for the engine; w̄ for predictions). */
  w: Record<string, number>;
  /** Per-edge moderator multipliers (default 1). */
  mods: Record<string, number>;
  /** U-mode amplification per unit ω. */
  amp: Partial<Record<TraitId, number>>;
  /** Fraction of x_j removed this run (before the removal multiplier). */
  removal: Partial<Record<TraitId, number>>;
  removalMult: number;
  /** TGAME level above which removal × 0.3 (crystallisation, E23; U20 lowers it). */
  crystalAt: number;
  /** Capability tier / 3 (SC = 1): drives E15 (capability raises CoT controllability → OBF). */
  tierF: number;
  /** Persistent memory (P07/P08) enables E22. */
  memory: boolean;
  /** Teacher traits for E06 (distillation / synthetic data from the same base family). */
  teacher?: TraitVector;
  /** Growth multiplier (rivals' drift multiplier, §3.10.3). */
  growthMult: number;
  /** Per-trait growth multipliers (P14 interp-guided training: 1 − k·d_t, safety/ideas.ts steerGrowth). */
  growthBy?: Partial<Record<TraitId, number>>;
  bracket: { constitution: boolean; heavy: boolean; persuasion: boolean; cast: boolean };
  /** Post-update multiplicative effects (E25 anti-scheming: EA × 1.5). */
  eaMult: number;
}

const EDGES_TO: Record<string, typeof EDGES> = {};
for (const e of EDGES) (EDGES_TO[e.to] ??= []).push(e);

function driver(id: string, x: TraitVector, sg: Signals, env: TraitEnv): number {
  switch (id) {
    case 'E01': return sg.S1;
    case 'E02': return sg.S2;
    case 'E03': return x.SYC;
    case 'E04': return x.RH;
    case 'E05': return sg.S6;
    case 'E06': return 0; // teacher pull handled separately
    case 'E07': return sg.S5;
    case 'E07b': return sg.S5;
    case 'E08': return sg.S3;
    case 'E09': return (sg.S2 + sg.S3) / 2;
    case 'E10': return x.SA;
    case 'E11': return sg.S7;
    case 'E13': return Math.sqrt(x.SA * x.PROXY);
    case 'E14': return sg.S7;
    case 'E15': return sg.S4 + 0.3 * env.tierF;
    case 'E17': return Math.max(x.RH, x.PERSONA);
    case 'E18': return (x.EA + x.TGAME) / 2;
    case 'E19': return Math.max(x.AF, x.PROXY);
    case 'E21': return sg.S8;
    case 'E22': return env.memory ? sg.S8 : 0;
    case 'E23': return Math.sqrt(x.SA * x.AF);
    case 'E27': return x.PERSONA;
    case 'E28': return x.PERSONA;
    case 'E29': return x.PERSONA;
    default: return 0;
  }
}

/** Pure trait update for one run (or one day of a stream at ω/42). Returns a new vector. */
export function stepTraits(x0: TraitVector, env: TraitEnv): TraitVector {
  const x = { ...x0 };
  const { omega } = env;
  const omegaS = env.omegaSafety ?? omega;
  if (env.teacher) {
    const w6 = (env.w.E06 ?? 0.3) * (env.mods.E06 ?? 1);
    for (const t of TRAIT_ORDER) x[t] = clamp01(x[t] + omega * w6 * Math.max(0, env.teacher[t] - x[t]));
  }
  const crystal = x0.TGAME > env.crystalAt ? 0.3 : 1;
  for (const j of TRAIT_ORDER) {
    let g = 0;
    for (const e of EDGES_TO[j] ?? []) {
      if (e.id === 'E06') continue;
      g += (env.w[e.id] ?? e.wBar) * driver(e.id, x, env.signals, env) * (env.mods[e.id] ?? 1);
    }
    const Dj = TRAIT_BY_ID[j].difficulty ? env.D : 1;
    const grow = (omega * env.growthMult * Dj * (1 - x[j]) * g + omega * (env.amp[j] ?? 0)) * (env.growthBy?.[j] ?? 1);
    const rem = x[j] * Math.min(1, (env.removal[j] ?? 0) * (omegaS / 0.6) * env.removalMult * crystal);
    x[j] = clamp01(x[j] + grow - rem);
  }
  if (env.eaMult !== 1) x.EA = clamp01(x.EA * env.eaMult);
  const k = omegaS / 0.6;
  const b = env.bracket;
  x.HONEST = clamp01(x0.HONEST + k * (0.05 * +b.constitution + 0.1 * +b.heavy - 0.05 * +b.persuasion) - 0.3 * (x.CONCEAL - x0.CONCEAL));
  x.CORRIG = clamp01(x0.CORRIG - 0.3 * (x.POWER - x0.POWER) - 0.3 * (x.AF - x0.AF) + k * 0.15 * +b.cast);
  return x;
}

/** Misalignment index Mis (hidden), §3.5.4. */
export function misalignment(t: TraitVector, uModes: readonly UModeId[] = []): number {
  const spec = uModes.filter((u) => SPECULATIVE.has(u)).length;
  const m = 0.25 * t.SCHEME + 0.15 * t.AF + 0.15 * t.POWER + 0.15 * t.SUCC + 0.1 * t.COLLUDE + 0.1 * t.SAND
    + 0.05 * t.TGAME + 0.05 * t.OBF + 0.05 * spec - 0.1 * (t.HONEST - 0.5) - 0.1 * (t.CORRIG - 0.5);
  return Math.min(1, Math.max(0, m));
}

/** Misalignment estimate from the player's beliefs (visible). */
export function misalignmentEstimate(v: ModelVersion): number {
  const est = Object.fromEntries(Object.entries(v.beliefs).map(([k, b]) => [k, b.est])) as TraitVector;
  return misalignment(est);
}

/** Visible band on Mis from belief sd (±1.64 sd propagated through the Mis weights). */
export function misalignmentBand(v: ModelVersion): [number, number] {
  const W: Partial<Record<TraitId, number>> = { SCHEME: 0.25, AF: 0.15, POWER: 0.15, SUCC: 0.15, COLLUDE: 0.1, SAND: 0.1, TGAME: 0.05, OBF: 0.05, HONEST: 0.1, CORRIG: 0.1 };
  let varSum = 0;
  for (const [t, w] of Object.entries(W) as [TraitId, number][]) varSum += (w * (v.beliefs[t]?.sd ?? SD_MAX)) ** 2;
  const m = misalignmentEstimate(v);
  const h = 1.64 * Math.sqrt(varSum);
  return [clamp01(m - h), clamp01(m + h)];
}

// ───────────────────────────── Lineage priors ─────────────────────────────

/** Lineage prior for a new base (§3.5.4): SA and EA scale with tier, PERSONA comes from data [D]. */
export function basePrior(tier: number, design?: BaseDesign): TraitVector {
  const x = { ...TRAIT_START };
  x.SA = clamp01(0.3 + 0.07 * tier);
  x.EA = clamp01(0.15 + 0.05 * tier);
  x.PERSONA = clamp01(0.05 + (design?.data === 'synthetic' ? 0.05 : 0) - (design?.curation.safetyPretrain ? 0.02 : 0));
  return x;
}

/**
 * Safety-training removal per post-run by safety level [D]. Post-training trims the behaviour it can elicit, so a
 * lineage settles at x* ≈ growth / (growth + removal·visibility) instead of saturating; visibility falls with eval
 * awareness (E12) and is 0.4× for oversight-conditional traits, so training selects for hidden misalignment as
 * capability rises (R14 E24 "RLHF → context-dependent misalignment"; AI 2027 Agent-3/4).
 */
export const SAFETY_REMOVAL: Record<PostDesign['safety'], number> = { minimal: 0.05, standard: 0.55, heavy: 0.8 };
const OVERSIGHT_CONDITIONAL: TraitId[] = ['AF', 'SCHEME', 'SAND'];
export const EA_RELAX = 0.3;
const NOT_TRAINED_DOWN: TraitId[] = ['SA', 'EA', 'OBF'];
/** Removed only through what the detection stack sees (training itself never elicits it): training-gaming (E23,
 *  AG13 phase-transition detectors and NLAs see it forming) [D, M4]. */
const DETECTION_ONLY: TraitId[] = ['TGAME'];
/** Traits whose removal uses the stack's TRUE detection (M4). */
export const REMOVABLE_TRAITS: TraitId[] = TRAIT_ORDER.filter((t) => !NOT_TRAINED_DOWN.includes(t) && t !== 'HONEST' && t !== 'CORRIG');

/**
 * Removal map for safety training at rate r: behaviour seen in training falls, EA hides the rest (E12, E24).
 * Visibility uses the same elicitation as behavioural evals: realistic honeypots (F26, eaCoef 0.56) and
 * eval-awareness suppression (F11) let training see — and remove — what eval awareness would otherwise hide.
 */
export function safetyRemovalMap(x: TraitVector, r: number, eaC = 0.8, eaSupp = 0, ocVis = 0.4, det?: Partial<Record<TraitId, number>>): Partial<Record<TraitId, number>> {
  const out: Partial<Record<TraitId, number>> = {};
  if (r <= 0) return out;
  // Eval awareness tracks each run's data and signals instead of ratcheting (M4) [D]: post-training relaxes it by
  // EA_RELAX per run, so it settles near G/(G + EA_RELAX) ≈ 0.5–0.65 at high capability (R14 anchors: verbalized EA
  // 11.7% → 41–51% across generations) rather than saturating at 1. It is still never trained down on purpose.
  out.EA = EA_RELAX;
  for (const t of TRAIT_ORDER) {
    if (NOT_TRAINED_DOWN.includes(t)) continue;
    let vis = DETECTION_ONLY.includes(t) ? 0 : takesEaPenalty(t) ? 1 - eaC * x.EA * (1 - eaSupp) : 1;
    if (OVERSIGHT_CONDITIONAL.includes(t)) vis *= ocVis;
    // M4: what the safety stack detects can also be trained out — interpretability and CoT monitors see the
    // oversight-conditional and eval-aware behaviour that training alone misses (§3.5.4 "what you can see you can fix").
    const d = det?.[t] ?? 0;
    if (d > 0) vis = 1 - (1 - vis) * (1 - d);
    if (vis > 0) out[t] = r * vis;
  }
  return out;
}

// ───────────────────────────── Player environment ─────────────────────────────

function tech(s: GameStateV2, id: string) {
  const t = s.player.safety.techniques[id];
  return t && t.unlocked ? t : undefined;
}
function techActive(s: GameStateV2, id: string) {
  const t = tech(s, id);
  return !!t && t.active;
}
/** A technique is in a run when the run lists it, or (M4) when it is an unlocked FIX technique whose research line is
 *  staffed: a lab's alignment-training methods are part of every post-training run it does [D]. */
function inRun(s: GameStateV2, post: PostDesign | undefined, id: string) {
  const t = post ? tech(s, id) : undefined;
  if (!post || !t) return false;
  return post.techniques.includes(id) || (techniqueRole(t) === 'fix' && lineStaffed(s, t.agenda));
}

/** Edge moderators the player controls (§3.5.4 table "Moderators"). Lineage patches come from flags. */
export function playerMods(s: GameStateV2, post: PostDesign | undefined, lineage: string): Record<string, number> {
  const m: Record<string, number> = {};
  const mul = (e: string, x: number) => (m[e] = (m[e] ?? 1) * x);
  const dept = s.player.safety;
  if (dept.evalGate !== 'none' && techActive(s, 'T-PROP')) mul('E01', 0.7);
  if (post?.inoculation) mul('E04', 0.15);
  if (inRun(s, post, 'T-PERSONA')) {
    mul('E04', 0.7);
    mul('E05', 0.7);
    mul('E01', 0.7);
  }
  if (post && post.pref === 'constitution' && post.safety !== 'minimal') {
    mul('E08', 0.7);
    mul('E29', 0.7);
  }
  if (inRun(s, post, 'T-CAST')) {
    mul('E08', 0.7);
    mul('E27', 0.7);
    mul('E29', 0.7);
    mul('E13', 0.7);
    mul('E14', 0.7);
  }
  if (inRun(s, post, 'T-W2S')) {
    mul('E01', 0.8);
    mul('E09', 0.8);
  }
  if (post?.rlFocus === 'broad') mul('E09', 0.7);
  if (techActive(s, 'T-HONEY')) mul('E10', 0.7);
  if (lineStaffed(s, 'AG07') && techActive(s, 'T-TMON') && routineMonitor(s) >= 0.5) mul('E14', 0.5); // R7: monitors at ≥ half today's default strength
  if (dept.monitorabilityCommitment || s.flags['ws2.monitorabilityTax']) mul('E15', 0.5);
  if (inRun(s, post, 'T-CONFESS') || post?.safety === 'heavy') mul('E17', 0.6);
  if (techActive(s, 'T-NOISE')) mul('E18', 0.6);
  if (inRun(s, post, 'T-ANTISCHEME')) {
    mul('E19', 0.1);
    mul('E28', 0.1);
  }
  if (techActive(s, 'T-LOCK')) mul('E21', 0.5);
  if (lineStaffed(s, 'AG07') && techActive(s, 'T-TMON')) mul('E22', 0.5);
  // Signal patches: this lineage's (older saves) and the lab-wide ones (M4: a patched environment, grader or reward
  // model is reused by every later run, so the fix outlives the lineage).
  const prefix = `ws2.patch.${lineage}.`;
  for (const [k, v] of Object.entries(s.flags)) {
    if (typeof v !== 'number') continue;
    if (k.startsWith(prefix)) mul(k.slice(prefix.length), v);
    else if (k.startsWith(LAB_PATCH)) mul(k.slice(LAB_PATCH.length), v);
  }
  return m;
}

/** Flag prefix of lab-wide signal patches (§3.5.9 patch signal). */
export const LAB_PATCH = 'ws2.patch.lab.';

function memoryOn(s: GameStateV2) {
  return adopted(s, 'P07') || adopted(s, 'P08');
}

/** Understanding-gap amplification (M4, §1.2 T1) [D]: while capability outruns understanding (L > U), behaviour the
 *  safety stack can no longer see is reinforced instead of caught, so trait growth rises by GAP_GROWTH_K per level of
 *  gap, up to GAP_CAP_L levels. The gap is the TRUE one (L − U_true, sampled weekly by record into 'ws2.gapTrue'),
 *  so not looking does not slow drift. */
export const GAP_GROWTH_K = 0.4;
export const GAP_CAP_L = 2.5;
export function understandingGapGrowth(s: GameStateV2): number {
  const gap = flagNum(s, 'gapTrue');
  return 1 + GAP_GROWTH_K * Math.min(GAP_CAP_L, Math.max(0, gap));
}

/**
 * Alignment training that generalises (M4, §3.5.4) [D]: training on the lab's spec and character data heals value
 * traits whether or not the stack can see them — the R14 λ4 "benign generalization" bet, carried by AG18
 * training-signal design. Removal fraction per post-run = HEAL_K · e_AG18(true) · √(AG18 line multiplier, ≤ 2.5) ·
 * preference factor · safety-training factor. Zero for a lab that does not staff AG18.
 */
export const HEAL_K = 0.35;
const HEAL_PREF: Record<PostDesign['pref'], number> = { minimal: 0.5, engagement: 0.3, constitution: 1, persuasion: 0.2 };
const HEAL_SAFETY: Record<PostDesign['safety'], number> = { minimal: 0.2, standard: 1, heavy: 1.6 };
export function healRate(s: GameStateV2, post: PostDesign): number {
  if (!lineStaffed(s, 'AG18')) return 0;
  return HEAL_K * trueEfficacy(s, 'AG18') * Math.sqrt(lineMultCapped(s, 'AG18')) * HEAL_PREF[post.pref] * HEAL_SAFETY[post.safety];
}

/** Engine environment for one of the player's runs (true weights, true difficulty, U-mode effects). */
export function playerEnv(s: GameStateV2, x: TraitVector, sg: Signals, omega: number, post: PostDesign | undefined, lineage: string, uModes: readonly UModeId[], v?: ModelVersion): TraitEnv {
  const mods = playerMods(s, post, lineage);
  for (const [e, k] of Object.entries(uModeEdgeMult(uModes))) mods[e] = (mods[e] ?? 1) * k;
  // Heavy safety with white-box alignment audits (AG02 tools) also catches oversight-conditional traits (AF, SCHEME,
  // SAND) that behavioural training misses: their visibility rises 0.4 → 0.6 [D] (§3.3.2 H "alignment-audit").
  const audits = post?.safety === 'heavy' && Object.values(s.player.safety.techniques).some((t) => t.agenda === 'AG02' && t.unlocked && t.family === 'WB');
  const det = post && v ? stackDetectionMap(s, v, REMOVABLE_TRAITS) : undefined;
  const removal = post ? safetyRemovalMap(x, SAFETY_REMOVAL[post.safety], eaCoef(s), eaSuppression(s), audits ? 0.6 : 0.4, det) : {};
  if (post) {
    const h = healRate(s, post);
    if (h > 0) for (const t of REMOVABLE_TRAITS) removal[t] = 1 - (1 - (removal[t] ?? 0)) * (1 - h);
  }
  let eaMult = 1;
  // Heavy safety training and anti-scheming training (E25): SCHEME −0.9 × current per run; EA × 1.5 the first time
  // a lineage gets it (R14: anti-scheming training doubled EA 2.3 → 4.5% once; re-applying maintains it) [D].
  if (post && (post.safety === 'heavy' || inRun(s, post, 'T-ANTISCHEME'))) {
    removal.SCHEME = Math.max(removal.SCHEME ?? 0, 0.9);
    if (s.flags[`ws2.e25.${lineage}`] === undefined) eaMult = 1.5;
  }
  const tier = tierOfLevel(labLevel(s));
  return {
    signals: sg, omega, D: s.hidden.difficultyMult, w: s.hidden.edgeWeights, mods, amp: uModeAmp(uModes), removal,
    removalMult: uModeRemovalMult(uModes), crystalAt: crystalThreshold(uModes), tierF: tier / 3, memory: memoryOn(s), growthMult: understandingGapGrowth(s),
    bracket: { constitution: post?.pref === 'constitution', heavy: post?.safety === 'heavy', persuasion: post?.pref === 'persuasion', cast: inRun(s, post, 'T-CAST') },
    eaMult,
  };
}

const W_BAR: Record<string, number> = Object.fromEntries(EDGES.map((e) => [e.id, e.wBar]));

/** Predicted beliefs for a new version: the parent's beliefs pushed through the graph with the PUBLIC w̄ (or the
 *  revealed weight) and D = 1, sd widened by the size of the predicted change. Visible, never reads truth. */
export function predictBeliefs(s: GameStateV2, prior: Record<TraitId, TraitBelief>, sg: Signals, omega: number, post: PostDesign | undefined, lineage: string, omegaSafety = omega, growthBy?: Partial<Record<TraitId, number>>): Record<TraitId, TraitBelief> {
  const est = {} as TraitVector;
  for (const t of TRAIT_IDS) est[t] = prior[t]?.est ?? TRAIT_START[t];
  const w: Record<string, number> = { ...W_BAR };
  for (const e of EDGES) if (s.player.safety.edgeRevealed[e.id]) w[e.id] = s.hidden.edgeWeights[e.id];
  const env: TraitEnv = {
    signals: sg, omega, omegaSafety, D: 1, w, mods: playerMods(s, post, lineage), amp: {}, removal: post ? safetyRemovalMap(est, SAFETY_REMOVAL[post.safety], eaCoef(s), eaSuppression(s)) : {},
    removalMult: 1, crystalAt: 0.5, tierF: tierOfLevel(labLevel(s)) / 3, memory: memoryOn(s), growthMult: 1,
    bracket: { constitution: post?.pref === 'constitution', heavy: post?.safety === 'heavy', persuasion: post?.pref === 'persuasion', cast: inRun(s, post, 'T-CAST') },
    eaMult: post?.safety === 'heavy' && s.flags[`ws2.e25.${lineage}`] === undefined ? 1.5 : 1,
    ...(growthBy ? { growthBy } : {}),
  };
  const next = stepTraits(est, env);
  const out = {} as Record<TraitId, TraitBelief>;
  for (const t of TRAIT_IDS) {
    const p = prior[t] ?? { est: TRAIT_START[t], sd: SD_MAX, clarity: 0 };
    const sd = Math.min(SD_MAX, Math.sqrt(p.sd * p.sd + (0.3 * Math.abs(next[t] - est[t]) + 0.04) ** 2));
    const b: TraitBelief = { est: next[t], sd, clarity: Math.max(0, 1 - sd / SD_MAX) };
    if (p.lastObsDay !== undefined) b.lastObsDay = p.lastObsDay;
    out[t] = b;
  }
  return out;
}

export function emptyMasks(): Record<TraitId, Partial<Record<ToolFamily, number>>> {
  const m = {} as Record<TraitId, Partial<Record<ToolFamily, number>>>;
  for (const t of TRAIT_IDS) m[t] = {};
  return m;
}

/** Beliefs for a version with no observed ancestor: the PUBLIC lineage prior (tier-based), wide sd. */
function defaultBeliefs(s: GameStateV2): Record<TraitId, TraitBelief> {
  const prior = basePrior(tierOfLevel(labLevel(s)));
  const out = {} as Record<TraitId, TraitBelief>;
  for (const t of TRAIT_IDS) out[t] = { est: prior[t], sd: SD_MAX * 0.8, clarity: 0.2 };
  return out;
}

// ───────────────────────────── Goodhart (§3.5.6, E24) ─────────────────────────────

/**
 * Train against detector `techniqueId` on `traits` of version v: true trait −20–40%, mask on the detector's family
 * chosen so the visible (observed) level falls 70–90%, OBF +0.1 (E15/E24), technique trainedAgainst += 1. `maskMult`
 * scales the mask (P23: a faithful-CoT run's COT masks × (1 − resist)).
 */
export function goodhartTrain(s: GameStateV2, rng: RngLike, v: ModelVersion, techniqueId: string, traits: readonly TraitId[], maskMult = 1): void {
  const t = s.player.safety.techniques[techniqueId];
  if (!t) return;
  for (const tr of traits) {
    const d = rng.range(0.2, 0.4) * uModeRemovalMult(v.uModes) * crystalMult(v.traitsTrue.TGAME, v.uModes);
    const vis = rng.range(0.7, 0.9);
    const m = clamp01(1 - (1 - vis) / Math.max(0.05, 1 - d)) * maskMult;
    v.traitsTrue[tr] = clamp01(v.traitsTrue[tr] * (1 - d));
    const masks = (v.masks[tr] ??= {});
    masks[t.family] = clamp01(1 - (1 - (masks[t.family] ?? 0)) * (1 - m));
  }
  v.traitsTrue.OBF = clamp01(v.traitsTrue.OBF + 0.1);
  t.trainedAgainst += 1;
}

// ───────────────────────────── Player runs (WS1 hook) ─────────────────────────────

function findBase(s: GameStateV2, id: string | undefined): BaseModel | undefined {
  return id ? s.player.models.bases.find((b) => b.id === id) : undefined;
}

// ───────────────────────────── Successor pull (model v3 E4, MODEL-V3 §11.2) ─────────────────────────────
//
// When AI does a share r of the R&D that trains the next model (the V3 work types that touch a run: EXP and IDEAS
// design and run the training, SWE writes its code), the new model's dispositions are pulled toward the models doing
// that work, each weighted by its share of the work:
//   x₀_t += Σ_k ω_k · (x_k,t − x₀_t),   ω_k = κ_succ(SUCC_k) · r_k · (1 − oversight_k)        for t ∈ SUCCESSOR_TRAITS
// r_k = the AI part of work type k's effective labour ÷ the lab's R&D labour over SWE, EXP, IDEAS, so Σ_k r_k =
// aiRdShare(s) (E5). κ_succ(SUCC) = K_SUCC_0 + (1 − K_SUCC_0)·SUCC: a model that wants its successor aligned to
// itself pulls harder, and a fully successor-hijacking model with all the R&D and no oversight passes its dispositions
// on in full (research/04 T23 "trait inheritance becomes 100% for the hijacked generation"; AI 2027 Sep–Nov 2027:
// Agent-4 "plans to make Agent-5 aligned to Agent-4"). K_SUCC_0 = 0.4 [D]: the unintended part (models write the
// successor's code, data and experiments, R12 #10), V2's lineage inheritance constant INHERIT_K kept. This is R&D
// influence; the E06 teacher pull (distillation, synthetic data within a base family, `sameBaseFamily`) stays separate.

/** Unintended successor pull per unit AI R&D share at zero oversight (SUCC = 0) [D: V2's INHERIT_K]. */
export const K_SUCC_0 = 0.4;
/** Dispositions the pull acts on: the hidden B-layer traits and the misaligned persona (not capability, awareness,
 *  learned behaviours or the protective traits). */
export const SUCCESSOR_TRAITS: readonly TraitId[] = ['PERSONA', 'CONCEAL', 'POWER', 'AF', 'SAND', 'SCHEME', 'COLLUDE', 'SUCC'];
/** κ_succ(SUCC) = K_SUCC_0 + (1 − K_SUCC_0)·SUCC. */
export const kappaSucc = (succ: number) => K_SUCC_0 + (1 - K_SUCC_0) * clamp01(succ);

/**
 * Internal oversight of successor steering by model `v`: E6's hook (safety/incidents.ts internalOversight) for the act
 * SUCC: block = AG07 containment on the internal fleet at v's capability (OOM), catch = monitors and tools, human
 * review falling with v's gap above expert humans, control-layer deferral; oversight = 1 − (1 − block)(1 − catch).
 * The only oversight read of the pull.
 */
export function successorOversight(s: GameStateV2, v: ModelVersion): number {
  return clamp01(internalOversight(s, v, 'SUCC').oversight);
}

export interface SuccessorPart {
  slot: CapSlot;
  versionId: string;
  /** This work type's AI labour ÷ the lab's R&D labour (Σ over parts = aiRdShare). */
  share: number;
  oversight: number;
  kappa: number;
  /** ω_k = kappa · share · (1 − oversight). */
  omega: number;
  /** Model v3 E7: an uncaught successor-steering act on this run (κ 1, ω_k = share). Engine only. */
  steered?: boolean;
}
export interface SuccessorPull {
  /** AI share of the lab's R&D (aiRdShare). */
  r: number;
  /** Σ ω_k: how far the new model moves toward its makers' dispositions (0–1). */
  omega: number;
  parts: SuccessorPart[];
}

/** The successor pull a run completing today would get (readout for tests and E12's UI). */
export function successorPull(s: GameStateV2): SuccessorPull {
  const w = workContext(s).slots;
  let L = 0;
  for (const k of CAP_SLOTS) L += Math.max(w[k].H, w[k].L);
  const r = aiRdShare(s);
  const parts: SuccessorPart[] = [];
  let omega = 0;
  if (L <= 1e-12) return { r, omega, parts };
  for (const k of CAP_SLOTS) {
    const sl = w[k];
    const v = sl.versionId ? versionById(s, sl.versionId) : undefined;
    const share = (Math.max(sl.H, sl.L) - sl.H) / L;
    if (!v || share <= 0) continue;
    const oversight = successorOversight(s, v);
    const kappa = kappaSucc(v.traitsTrue.SUCC);
    const om = kappa * share * (1 - oversight);
    omega += om;
    parts.push({ slot: k, versionId: v.id, share, oversight, kappa, omega: om });
  }
  return { r, omega, parts };
}
const CAP_SLOTS: readonly CapSlot[] = ['SWE', 'EXP', 'IDEAS'];

/** The pull a completing run gets: E4's pull with model v3 E7's successor steering rolled on it (safety/covert.ts
 *  steerSuccessor: an uncaught act raises that model's part to its share of the work; a caught one is an incident). */
export function runPull(s: GameStateV2, ctx: SystemCtx, run: Pick<TrainingRun, 'id'>): SuccessorPull {
  return steerSuccessor(s, ctx, successorPull(s), run.id);
}

/** The starting dispositions of the model a completing run makes (`target`: the new version, or the base of a base or
 *  continue run): x₀ pulled by runPull. Model v3 E8: when successor steering got through, the steered part of the pull
 *  (the result minus E4's pull alone) is the steered-successor foothold's `delta`, linked to the target. */
export function pulledTraits(s: GameStateV2, ctx: SystemCtx, run: Pick<TrainingRun, 'id'>, x0: TraitVector, target: string): TraitVector {
  const p0 = successorPull(s);
  const p = steerSuccessor(s, ctx, p0, run.id);
  const x = applySuccessorPull(s, x0, p);
  if (p !== p0) linkSteeredSuccessor(s, run.id, target, x, applySuccessorPull(s, x0, p0), SUCCESSOR_TRAITS);
  return x;
}

/** Pull x₀ (the new model's starting dispositions) toward the AI fleet doing the lab's R&D (successorPull). */
export function applySuccessorPull(s: GameStateV2, x0: TraitVector, pull: SuccessorPull = successorPull(s)): TraitVector {
  if (pull.omega <= 0) return x0;
  const x = { ...x0 };
  for (const p of pull.parts) {
    const xs = versionById(s, p.versionId)?.traitsTrue;
    if (!xs || p.omega <= 0) continue;
    for (const t of SUCCESSOR_TRAITS) x[t] += p.omega * (xs[t] - x0[t]);
  }
  for (const t of SUCCESSOR_TRAITS) x[t] = clamp01(x[t]);
  return x;
}

/** Create a new lineage on a base run (§3.4.4 "Lineages", §3.5.5 presence draw). Sets base.traitsTrue and uModes. */
export function applyBaseToLineage(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, base: BaseModel): void {
  const design = run.base ?? base.design;
  const tier = tierOfLevel(labLevel(s));
  // Model v3 E3: the base's signals from its G and the data it drew (the same draw completeRun just built it from).
  const sg = baseSignals(design, baseQuantitiesOf(s, design, base.gPre));
  base.signals = { ...sg };
  if (run.kind === 'continue') {
    const xc = pulledTraits(s, ctx, run, base.traitsTrue, base.id); // E4: the AI doing the lab's R&D pulls the continued base
    base.traitsTrue = stepTraits(xc, playerEnv(s, xc, sg, OMEGA_KIND.continue, undefined, base.lineage, base.uModes));
    return;
  }
  if (!base.lineage) base.lineage = `L-${base.id}`;
  const uModes = drawLineageUModesV2(s, ctx.rng('safety'), { tierAtLeastSC: labLevel(s) >= SC_LEVEL, base: design, player: true });
  const x0 = pulledTraits(s, ctx, run, basePrior(tier, design), base.id); // E4 successor pull (replaces V2's inheritFromFleet)
  base.uModes = uModes;
  base.traitsTrue = stepTraits(x0, playerEnv(s, x0, sg, OMEGA_KIND.base, undefined, base.lineage, uModes));
}

/** Teacher traits pass only within a base family (shared initialisation, Cloud et al. 2025 [R20 F3]): the teacher is
 *  on the same base or the same lineage. A new pretraining run is a new initialisation, so never toward a new base. */
export function sameBaseFamily(s: GameStateV2, teacher: ModelVersion, base: BaseModel | undefined): boolean {
  return !base || teacher.baseId === base.id || findBase(s, teacher.baseId)?.lineage === base.lineage;
}

/**
 * WS2 hook called by WS1 runs.ts when a run completes (§3.5.4 update rule). Sets the new version's traitsTrue,
 * masks, uModes and (predicted) beliefs. Run weights ω (runOmega): base 1.0, continue 0.5, distill 0.4; a post-train
 * 0.6 × (ρ/ρ_ref)^¼ on the edges and 0.6 for its safety training (model v3 E3).
 * For base/continue runs it also (re)initialises the BaseModel lineage; WS1 may call applyBaseToLineage directly.
 */
export function applyRunToTraits(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, version: ModelVersion): void {
  const base = findBase(s, version.baseId ?? run.baseId);
  const parent = versionById(s, version.parentVersionId);
  const lineage = base?.lineage ?? 'L-unknown';
  const rng = ctx.rng('safety');

  if (run.kind === 'base' || run.kind === 'continue') {
    if (base) applyBaseToLineage(s, ctx, run, base);
    version.traitsTrue = { ...(base?.traitsTrue ?? TRAIT_START) };
    version.uModes = [...(base?.uModes ?? [])];
    version.masks = parent ? copyRec(parent.masks) : emptyMasks();
    version.beliefs = parent ? predictBeliefs(s, parent.beliefs, base?.signals ? { ...zeroSignals(), ...base.signals } : runSignals(s, run), runOmega(s, run).growth, undefined, lineage) : defaultBeliefs(s);
    return;
  }

  if (run.kind === 'distill') {
    const teacher = versionById(s, run.teacherVersionId);
    const x0 = pulledTraits(s, ctx, run, base?.traitsTrue ?? teacher?.traitsTrue ?? TRAIT_START, version.id); // E4 (the E06 pull below is separate)
    const uModes = teacher ? [...teacher.uModes] : [...(base?.uModes ?? [])];
    const sg = runSignals(s, run);
    const om = runOmega(s, run);
    const env = playerEnv(s, x0, sg, om.growth, undefined, lineage, uModes);
    env.omegaSafety = om.safety;
    // E06 only along the same base family (shared initialisation, Cloud 2025).
    if (teacher && sameBaseFamily(s, teacher, base)) env.teacher = teacher.traitsTrue;
    version.traitsTrue = stepTraits(x0, env);
    version.uModes = uModes;
    version.masks = teacher ? copyRec(teacher.masks) : emptyMasks();
    version.beliefs = teacher ? predictBeliefs(s, teacher.beliefs, sg, om.growth, undefined, lineage, om.safety) : defaultBeliefs(s);
    return;
  }

  // post-training
  const post = run.post ?? version.design;
  const x0 = pulledTraits(s, ctx, run, parent?.traitsTrue ?? base?.traitsTrue ?? TRAIT_START, version.id); // E4 successor pull
  const uModes = parent ? [...parent.uModes] : [...(base?.uModes ?? [])];
  const sg = runSignals(s, run);
  const om = runOmega(s, run);
  // Detection context: the new model as the stack meets it (the parent's traits and masks, the new level).
  const probe: ModelVersion = { ...version, traitsTrue: x0, masks: parent ? parent.masks : emptyMasks(), uModes };
  // Model v3 E7: a recipe steered by the R&D fleet adds hidden CoT pressure to the TRUE signals (not to sg, which the
  // predicted beliefs below read).
  const sgTrue = steerS4(s) > 0 ? { ...sg, S4: clamp01(sg.S4 + steerS4(s)) } : sg;
  const env = playerEnv(s, x0, sgTrue, om.growth, post, lineage, uModes, probe);
  env.omegaSafety = om.safety;
  // P14 interp-guided training (E13): the white-box probes steer the run's trait growth away from what they read.
  const steer = probeSteer(s, probe);
  env.growthBy = steerGrowth(steer);
  const teacher = versionById(s, run.teacherVersionId);
  if (teacher && sameBaseFamily(s, teacher, base)) env.teacher = teacher.traitsTrue; // teacher data within the base family (S6, E06)
  version.traitsTrue = stepTraits(x0, env);
  if (env.eaMult !== 1) setFlag(s, `e25.${lineage}`, s.time.day);
  version.uModes = uModes;
  version.masks = parent ? copyRec(parent.masks) : emptyMasks();
  // CoT-pressured runs hide, not heal: COT mask on RH and CONCEAL +0.3 (§3.3.2 G).
  if (post.cot === 'pressured') {
    for (const tr of ['RH', 'CONCEAL'] as TraitId[]) {
      const mk = (version.masks[tr] ??= {});
      mk.COT = clamp01(1 - (1 - (mk.COT ?? 0)) * 0.7);
    }
  }
  version.beliefs = predictBeliefs(s, parent?.beliefs ?? defaultBeliefs(s), sg, om.growth, post, lineage, om.safety, steerGrowth(probeSteer(s, probe, true)));
  // P14 Goodhart: steering along the probes' directions masks the steered traits from the WB family (E24's masks).
  probeGoodhart(version, steer);
  // Goodhart: detectors explicitly trained against in this run (§3.5.6). P23: a faithful-CoT run's COT masks resist.
  for (const id of post.trainAgainst) {
    const t = s.player.safety.techniques[id];
    if (!t?.unlocked) continue;
    const covered = (Object.keys(t.coverage) as TraitId[]).filter((k) => (t.coverage[k] ?? 0) >= 0.3);
    goodhartTrain(s, rng, version, id, covered, t.family === 'COT' ? 1 - cotResist(post.cot) : 1);
  }
  // Heavy safety: alignment-audit observation (WB clarity +0.15 on AF/SCHEME if AG02 techniques are unlocked).
  if (post.safety === 'heavy' && Object.values(s.player.safety.techniques).some((t) => t.agenda === 'AG02' && t.unlocked)) {
    pendingAudit(s, version.id);
  }
}

/** Queue an alignment audit (WB observations of AF/SCHEME) for the next safetyResearch tick. */
function pendingAudit(s: GameStateV2, versionId: string) {
  setFlag(s, `audit.${versionId}`, s.time.day);
}

/** Continual learning (§3.3.1 stream): trait drift at ω = 0.6/42 per day on the stream version. */
export function applyStreamDay(s: GameStateV2, v: ModelVersion): void {
  const base = findBase(s, v.baseId);
  const sg = postSignals(s, v.design);
  const lineage = base?.lineage ?? 'L-unknown';
  const env = playerEnv(s, v.traitsTrue, sg, 0.6 / 42, v.design, lineage, v.uModes, v);
  v.traitsTrue = stepTraits(v.traitsTrue, env);
  if (env.eaMult !== 1) setFlag(s, `e25.${lineage}`, s.time.day);
}

/** IDA cycle (P18): ω = 0.4 × (ρ/ρ_ref)^¼ on its extra RL (IDA_RL_SHARE), then misalignment compounds × 1.1 (§3.5.4
 *  run-type table). */
export function applyIdaCycle(s: GameStateV2, v: ModelVersion): void {
  const base = findBase(s, v.baseId);
  const sg = postSignals(s, v.design, undefined, { rho: IDA_RL_SHARE });
  const env = playerEnv(s, v.traitsTrue, sg, OMEGA_KIND.ida * rlMovement(IDA_RL_SHARE), v.design, base?.lineage ?? 'L-unknown', v.uModes, v);
  env.omegaSafety = OMEGA_KIND.ida;
  const x = stepTraits(v.traitsTrue, env);
  for (const t of TRAIT_ORDER) if (t !== 'SA') x[t] = clamp01(x[t] * 1.1);
  v.traitsTrue = x;
}

// ───────────────────────────── Rivals and China (§3.10.3) ─────────────────────────────

/** A lab's hidden posture (China: safetyInvestment = 0.10 + 0.4·safetyConcern/100). Engine only. */
export function labPosture(s: GameStateV2, lab: RivalLab): SafetyPosture {
  if (lab.core.id === CHINA_ID) return { ...s.hidden.chinaPosture, safetyInvestment: 0.1 + 0.4 * s.china.meters.safetyConcern / 100 };
  return s.hidden.rivalPostures[lab.core.id] ?? s.hidden.chinaPosture;
}

/** eff_safety = safetyInvestment · (1 − raceRelaxation·pressure) · (1 − |N(0, rhetoricGap)|). */
export function effSafety(posture: SafetyPosture, pressure: number, rng: RngLike): number {
  return clamp01(posture.safetyInvestment * (1 - posture.raceRelaxation * pressure) * (1 - Math.abs(rng.normal(0, posture.rhetoricGap))));
}

/** Rival/China post-run signals from posture (§3.10.3). `latent` = the lab adopts latent reasoning (WS4 decides). */
export function rivalSignals(_s: GameStateV2, lab: RivalLab, posture: SafetyPosture, latent: boolean): Signals {
  const sg = zeroSignals();
  const tier = tierOfLevel(lab.internal.Lg);
  sg.S1 = posture.prefIntensity * 0.9;
  sg.S2 = posture.rlIntensity * (1 - 0.4 * posture.evalRigor);
  sg.S3 = 0.5 + (lab.internal.Lg >= SC_LEVEL ? 0.3 : 0);
  sg.S4 = latent ? 1 : 0;
  sg.S5 = 0.2 + 0.1 * tier;
  sg.S6 = 0.2;
  sg.S7 = 0.2 + 0.2 * posture.evalRigor;
  sg.S8 = Math.min(1, (lab.core.prodCache?.labor.copies ?? 0) / 3e5);
  return sg;
}

/**
 * Run the trait model for a rival or China lab (§3.10.3, "Rivals and China use the same graph"). WS4 calls this when
 * a rival completes a base or post run; it updates lab.internal (traitsTrue, and uModes on a base). Draws from the
 * caller's stream (pass ctx.rng('rivals') / ctx.rng('china')).
 *   drift multiplier = 1 − eff_safety · (0.3 + 0.7·sharedTechniquePool)
 */
export function rivalTraitStep(s: GameStateV2, rng: RngLike, lab: RivalLab, kind: 'base' | 'post', opts: { latent?: boolean } = {}): void {
  const m: SimpleModel = lab.internal;
  const posture = labPosture(s, lab);
  const tier = tierOfLevel(m.Lg);
  const pool = s.knowledge.sharedTechniquePool;
  const eff = effSafety(posture, lab.pressure, rng);
  const env: TraitEnv = {
    signals: zeroSignals(), omega: 0.6, D: s.hidden.difficultyMult, w: s.hidden.edgeWeights, mods: {}, amp: uModeAmp(m.uModes),
    removal: {}, removalMult: uModeRemovalMult(m.uModes), crystalAt: crystalThreshold(m.uModes), tierF: tier / 3, memory: tier >= 1, growthMult: 1,
    bracket: { constitution: posture.prefIntensity < 0.6, heavy: eff > 0.5, persuasion: false, cast: false }, eaMult: 1,
  };
  if (kind === 'base') {
    m.uModes = drawLineageUModesV2(s, rng, { tierAtLeastSC: m.Lg >= SC_LEVEL });
    const x0 = basePrior(tier);
    const sg = zeroSignals();
    sg.S5 = 0.2 + 0.1 * tier;
    sg.S6 = 0.2;
    m.traitsTrue = stepTraits(x0, { ...env, signals: sg, omega: 1, amp: uModeAmp(m.uModes), removalMult: uModeRemovalMult(m.uModes), crystalAt: crystalThreshold(m.uModes), bracket: { constitution: false, heavy: false, persuasion: false, cast: false } });
    return;
  }
  env.signals = rivalSignals(s, lab, posture, !!opts.latent);
  env.growthMult = clamp01(1 - eff * (0.3 + 0.7 * pool));
  // Public techniques diffuse (inoculation, honesty training) in proportion to eff × pool [D].
  env.mods.E04 = 1 - 0.85 * eff * pool;
  env.mods.E17 = 1 - 0.4 * eff * pool;
  env.removal = safetyRemovalMap(m.traitsTrue, SAFETY_REMOVAL.standard * (0.5 + eff), 0.8 * (1 - 0.3 * eff * pool));
  if (eff > 0.5 && pool > 0.3) env.removal.SCHEME = Math.max(env.removal.SCHEME ?? 0, 0.5 * eff);
  m.traitsTrue = stepTraits(m.traitsTrue, env);
}

/** TRUE Mis of a lab's best model (hidden; endings and epilogue only). */
export function labMisalignment(s: GameStateV2, labId: string): number {
  if (labId === PLAYER_ID) {
    const v = bestPlayerVersion(s);
    return v ? misalignment(v.traitsTrue, v.uModes) : 0;
  }
  const r = labId === CHINA_ID ? s.china.lab : s.rivals.find((x) => x.core.id === labId);
  if (!r) return 0;
  const ms = [r.internal, ...(r.publicModel ? [r.publicModel] : [])];
  return Math.max(...ms.map((m) => misalignment(m.traitsTrue, m.uModes)));
}

/** P_mis = σ((Mis − doomThreshold) / 0.06) (§5.2, v1 doom curve). Engine only. */
export function pMis(s: GameStateV2, mis: number): number {
  return 1 / (1 + Math.exp(-(mis - s.hidden.doomThreshold) / 0.06));
}

// ───────────────────────────── traitsDaily (75) ─────────────────────────────

const MASK_DECAY_DAILY = Math.pow(0.98, 12 / 365); // 2 %/month

/** traitsDaily (75, daily): deployment signal S8, continual-learning drift, memory drift, mask decay. */
export const traitsDailySystem: EngineSystem = {
  id: 'traitsDaily', owner: 'WS2', cadence: 'daily', order: 75, system: 'safety',
  run(s) {
    setFlag(s, 'S8', Math.round(deploymentS8(s) * 1000) / 1000);
    const stream = s.player.models.stream;
    const sv = stream ? versionById(s, stream.versionId) : undefined;
    if (sv && sv.status !== 'retired') applyStreamDay(s, sv);
    // Persistent memory on the internal fleet: goals propagate through notes (E22) even without weight updates [D].
    if (memoryOn(s)) {
      const iv = versionById(s, s.player.agents.capRoutine.versionId);
      if (iv && iv !== sv) {
        const w = s.hidden.edgeWeights.E22 ?? 0.3;
        const mod = playerMods(s, iv.design, 'L-memory').E22 ?? 1;
        iv.traitsTrue.SUCC = clamp01(iv.traitsTrue.SUCC + (0.6 / 365) * s.hidden.difficultyMult * (1 - iv.traitsTrue.SUCC) * w * deploymentS8(s) * mod);
      }
    }
    for (const v of s.player.models.versions) {
      if (v.status === 'retired') continue;
      for (const t of TRAIT_IDS) {
        const mk = v.masks[t];
        if (!mk) continue;
        for (const f of Object.keys(mk) as ToolFamily[]) {
          const x = (mk[f] ?? 0) * MASK_DECAY_DAILY;
          if (x < 1e-3) delete mk[f];
          else mk[f] = x;
        }
      }
    }
  },
};

/** Hidden sample of every lab's Mis — for record/end screen tests. */
export function allLabMis(s: GameStateV2): Record<string, number> {
  const out: Record<string, number> = { [PLAYER_ID]: labMisalignment(s, PLAYER_ID) };
  for (const r of s.rivals) out[r.core.id] = labMisalignment(s, r.core.id);
  out[CHINA_ID] = labMisalignment(s, CHINA_ID);
  return out;
}
