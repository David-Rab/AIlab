// Trait causal graph dynamics and misalignment index (V2-SPEC §3.5.4). Owner: WS2.
//
// One pure update `stepTraits(x, env)` serves every lab: the player's runs (applyRunToTraits), continual-learning
// streams, IDA cycles, and rivals/China (rivalTraitStep, signals from their hidden SafetyPosture, §3.10.3).
//   Δx_j = ω · D_j · (1 − x_j) · Σ_{e→j} w_e · a_e · mod_e  +  ω · amp_j(U-modes)  −  removal_j
// Nodes are visited in topological order S → L → A → B (data/v2/traits.ts TRAIT_ORDER).
import { LOCKDOWN_COLLUSION_MULT, lockdownOn } from './safeguards';
import { EDGE_BY_ID, EDGES } from '../../../data/v2/edges';
import { TRAIT_BY_ID, TRAIT_IDS, TRAIT_ORDER, TRAIT_START } from '../../../data/v2/traits';
import { UMODES } from '../../../data/v2/umodes';
import { IDA_RL_SHARE, REFERENCE_BASE, RL_BUDGET, RL_FAMILIES as RL_FAMILY_DEF, RL_FAMILY_IDS, RL_FAMILY_NEEDS } from '../../../data/v2/runDesign';
import { rlWeights, type FamilyMap } from '../models/effective';
import { suiteExploitMap, suiteRlWeights, suiteS2 } from '../models/suites';
import { bestPlayerVersion, CHINA_ID, internalVersion, PLAYER_ID } from '../models/labs';
import { designTarget, drawData, playerDraw, startPortfolio, type DataDraw } from '../production/data';
import type {
  BaseDesign, BaseModel, BeliefEvidence, DomainId, EngineSystem, GameStateV2, ModelVersion, PostDesign, RivalLab, RLFamily, RngLike, SafetyPosture, SignalId,
  SimpleModel, SystemCtx, ToolFamily, TrainingRun, TraitBelief, TraitId, TraitVector, UModeId,
} from '../types';
import { gOfLevel, gV0, h50Of } from '../models/capability';
import { gapFactor, measuredOom, versionOom } from './oversight';
import { AG05_OVERSIGHT } from '../../../data/v2/oversight';
import { H50_PER_OOM, H50_V0_MIN } from '../../../data/v2/workTypes';
import { adopted, believedEfficacy, clamp01, copyRec, flag, labLevel, setFlag, tierOfLevel, trueEfficacy, versionById } from './common';
import { SD_MAX, believedStackDetectionMap, eaCoef, eaSuppression, stackDetectionMap, takesEaPenalty, withEvidence } from './detection';
import { againstOf, METHOD_MULT, methodMult, methodRemoval, methodUntested, usesMethod, type EffView, type MethodQ } from './methods';
import { aiOversight, cotResist, probeGoodhart, probeSteer, steerGrowth } from './ideas';
import { aiRdShare, internalOversight } from './incidents';
import { steerS4, steerSuccessor } from './covert';
import { linkSteeredSuccessor } from './footholds';
import { agentVersion, routineMonitor } from '../departments/agents';
import { workContext, type CapSlot } from '../departments/workfit';
import { crystalMult, crystalThreshold, drawLineageUModesV2, uModeAmp, uModeEdgeMult, uModeRemovalMult } from './umodes';

const SPECULATIVE = new Set(UMODES.filter((u) => u.kind === 'speculative').map((u) => u.id));

export type Signals = Record<SignalId, number>;
export const zeroSignals = (): Signals => ({ S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, S7: 0, S8: 0, S9: 0 });

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
  /** CP3h: the policy the run trains (graders outgrown, task length). Default: the lab's internal model, measured. */
  policy?: Policy;
  /** The policy's level is the measured one (previews, beliefs). */
  believed?: boolean;
};
/** The run's policy: as given, else the lab's internal model at its measured level (the player's estimate). */
const policyOfQ = (s: GameStateV2, q?: RunQuantities) => q?.policy ?? policyOf(s, undefined, true);
const believedQ = (q?: RunQuantities) => !q?.policy || !!q.believed;
const rhoOf =(post: Pick<PostDesign, 'rlBudget'>, q?: RunQuantities) => Math.max(1e-6, q?.rho ?? RL_BUDGET[post.rlBudget]);

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
 *  reference pressure (D5: METR o3 RE-Bench 30%, SWE scaffolds 43%, HCAST ≈1% unhardened; red-teamed start 40% of that)
 *  [R20 F1]. Read by `runHack` (E16: learned hacking) and E10's rate calibration. */
export function hackRates(w: FamilyMap, exploit: FamilyMap, rho: number): FamilyMap {
  const p = optimisationPressure(rho);
  const out: FamilyMap = {};
  for (const [f, wf] of Object.entries(w) as [RLFamily, number][]) if (wf > 0) out[f] = Math.min(1, (exploit[f] ?? 0) * p);
  return out;
}

// ── learned hacking (model v3 E16; research/20 F2) ──
//
// MacDiarmid et al. 2025 [P] (Anthropic's write-up of arXiv 2511.18397): the hack rate stays near 0 until the model
// learns the hacks, then rises within ~30 RL steps to 0.6–1.0 of episodes; "at the exact point when the model learns
// to reward hack, we see a sharp increase in all our misalignment evaluations" (malign-generalisation score < 0.1 →
// 0.45–0.5; the no-hack baseline stays ≈ 0). Generalisation follows hacking becoming the run's learned policy, not the
// odd hacked episode: 2025 frontier models hack a few per cent of their RL (METR o3: HCAST 0.7%, RE-Bench 30%) without
// MacDiarmid's misalignment (research/05 §1.8: no spontaneous sabotage in 2025 deployments). So a run's generalisation
// reads its RL-weighted hack rate h = Σ_f w_f·h_f (the share of its RL episodes that are rewarded hacks, hackRates) and
// is convex above an onset:
//   λ = clamp01((h − LH_ONSET) / (LH_FULL − LH_ONSET))²         ("learned hacking", 0 = none, 1 = the model organism)
// λ adds K_LH·λ to the drivers of the cited MacDiarmid edges (E04 RH → PERSONA, E27 PERSONA → AF, E28 PERSONA →
// SCHEME) and of E18 (→ SAND: MacDiarmid's sabotage was a deliberately weakened reward-hacking classifier, i.e.
// sandbagged safety work; SAFSAB reads SAND + SCHEME). Inoculation prompting (a run-design choice) multiplies the whole hack-induced generalisation by INOC_MULT:
// E04 (as before), the λ terms, and the S2 half of E09 (hackable reward → PROXY, which feeds AF via E13 and SCHEME via
// E19). MacDiarmid: inoculated models "still reward hack to the exact same degree" while misalignment falls to near the
// no-hack baseline, so the hack rate itself (RH, S2's E02) is not inoculated.
// Model v3 E19: E04 is the learned-hacking term alone (driver K_LH·λ; it was RH + K_LH·λ). The standing hack rate RH
// grew PERSONA on every run, pretraining included (where nothing is rewarded), and below the onset: RefBot's runs hack
// 6.5% (λ 0) yet its lineages reached PERSONA 0.25 through E04. MacDiarmid's baseline (hacking prevented) stays ≈ 0 and
// the 2025 frontier with its few per cent hacked is not misaligned (above), so no source carries an incidental term.

/** Onset of learned hacking: the RL-weighted hack rate below which a run's hacking stays incidental [D]. Above the leader's
 *  start recipe (broad RL on hardened start suites at the standard budget: 6.5%, every RefBot run) so that a lab with
 *  hardened environments gets none, like the 2025 frontier; below a single exploitable family's rate (RE-Bench 30%). */
export const LH_ONSET = 0.1;
/** Saturation [D]: MacDiarmid's model hacks 0.6–1.0 of its episodes after onset; the game's most exploitable run (all RL
 *  on cheap-grader coding suites at the standard budget, 45%: E10's model-organism probe) is the full effect. */
export const LH_FULL = 0.45;
/** Driver gain of learned hacking on E04, E18, E27 and E28 [fit: the model-organism probe's AF in MacDiarmid's 30–70% band
 *  (50% AF reasoning), median over 40 medium worlds; scripts/v2/safetyrates.ts]. E16 1.3 (AF 48%); E17 1.7 (AF 49%): the
 *  organism lost the S7 → AF share of its AF (39% at 1.3) when E14 moved to S9, which the organism's run does not have. */
export const K_LH = 1.7;
/** Inoculation prompting's multiplier on hack-induced generalisation (research/20 F2: misalignment 0.115 → 0.02 = −80–90%
 *  chart-read, 75–90% in the paper's text; research/14 F46 ×0.1–0.25) [P]. */
export const INOC_MULT = 0.15;

// ── undetected hacking reinforced (SR-24b; SAFETY-REDESIGN OD-3 (b); research/RD-SR24-safety-params.md §3) ──
//
// An exploitable, unpenalised hack saturates inside one RL run: Chen et al. 2025 (arXiv 2505.05410 §5.2) find the model
// exploits a rewarded hack on > 99% of prompts within 30 RL steps; MacDiarmid et al. 2025 (arXiv 2511.18397) see the
// hack rate go from ≈ 0 to ≈ 1 after onset. The share that saturates is the share the graders miss: a suite's
// exploitability x_f is its rewarded (undetected) hack rate, and hacks that graders catch become environment fixes
// (hardened suites) instead of reinforcement (Baker et al. 2025 arXiv 2503.11926; Wen et al. 2024 arXiv 2409.12822). So
// a run's RH moves toward its hack share h = Σ_f w_f·x_f·p(ρ) (+ the self-play curricula term of S2) and gets there
// within one reference post-train, instead of E02's per-run / per-day accumulation toward 1 (the stream and IDA move
// by their share of a reference run's ω, so 42 stream days = one post-train).
// RF-S9: this is the one rule for every player run kind: runEnv sets hackTarget 0 (base, continued pretraining,
// distillation reward no hacks, S2 = 0) and post / stream / IDA runs set their h. E02's accumulation remains only on the
// rival-only path (rivalTraitStep builds its own env without a target); rival safety physics stays as is by the
// designer's decision (2026-11-23: a dedicated rivals session later).

/** Share of the gap to the run's hack share closed by one reference post-train (ω = OMEGA_KIND.post) [S: Chen et al. 2025
 *  arXiv 2505.05410 §5.2 "> 99% within 30 steps"; research/RD-SR24-safety-params.md §3 H1, H2]. */
export const HACK_SAT_PER_RUN = 0.99;
/** Share of the gap closed by a run (or stream day) of weight ω: 1 − (1 − HACK_SAT_PER_RUN)^(ω / ω_post). */
export const hackSaturation = (omega: number) => 1 - Math.pow(1 - HACK_SAT_PER_RUN, Math.max(0, omega) / 0.6);
/** The RH a run saturates toward: its hack share h plus self-play curricula's hackable reward (S2's P11 term). */
export const hackTargetOf = (s: GameStateV2, h: number) => clamp01(h + (adopted(s, 'P11') ? 0.2 : 0));

/** RL-weighted hack rate h = Σ_f w_f · h_f (share of the run's RL episodes that are rewarded hacks). */
export function hackShare(w: FamilyMap, exploit: FamilyMap, rho: number): number {
  const hr = hackRates(w, exploit, rho);
  let h = 0;
  for (const [f, hf] of Object.entries(hr) as [RLFamily, number][]) h += (w[f] ?? 0) * hf;
  return h;
}
/** Learned hacking λ(h) = clamp01((h − LH_ONSET)/(LH_FULL − LH_ONSET))². */
export const learnedHackingOf = (h: number) => Math.pow(clamp01((h - LH_ONSET) / (LH_FULL - LH_ONSET)), 2);
export interface RunHack {
  /** RL-weighted hack rate (share of RL episodes hacked). */
  h: number;
  /** Learned hacking λ (before inoculation). */
  lambda: number;
}

// ── graders outgrown and task length tracking the horizon (CP3h; BUILD-NOTES "CP3h misalignment with capability") ──
//
// (a) A suite's exploitability x_f is its rewarded (missed) hack share at the reference: the 2025 policy (V0) against
// its 2025 graders (expert-written tests, rubrics and reviewers), a policy below its graders' level. Once the policy
// outgrows its graders, tasks whose grader was sound for a weaker policy stop being sound: the grader's catch of an
// exploit hidden in a solution falls with the capability gap like a monitor's (Engels et al. 2025, arXiv 2504.18530
// [P]: Backdoor Code, the guard spotting a flaw hidden in code, 10% at a 400-Elo gap; the one rule safety/oversight.ts
// gapFactor already uses for monitors and human review, checked there against Greenblatt 2023's 62% at 1 OOM). So
//   x'_f = 1 − (1 − x_f) · F(gap),  F = gapFactor (1 at no gap, (0.10/0.85)^(gap ÷ 6.8 OOM)),
// equal to x_f while the policy is below its graders (every 2025 run). Direction and size check: Wen et al. 2024 (arXiv
// 2409.12822 [P]): RLHF against human judges raised their false-positive rate by 24.1% (QuALITY) and 18.3% (APPS) with
// no gain in correctness; what graders miss is what RL amplifies (research/04 T02 "smarter agents find more exploits").
// The graders: expert humans at the world's median-expert level, G_SC − Δ_bm (CAL2-S, designer decision 9: "expert
// human graders" read as the median expert, ai2027 L 6.39; CP3h put them at the best human, L 10, with no source for
// the level; research/CAL-safety-sources.md §6);
// with AI-assisted oversight (P15) the critic's share Aeff of the grading is done at the safety critic's level (at least
// the humans'), the two catches mixed by share; scalable oversight's debate finding (F16, Khan et al. 2024 [P]) takes
// AG05_OVERSIGHT.debateCreditOom (≈ 4.0 OOM) off every gap, as it does for AG05's tools (techniques.ts). Hardening
// (lower x_f; an incident's environment fix is a hardening pass, RF-S8) acts on x_f as before. Missed hacks feed the existing paths unchanged: S2's hackable
// reward, the hack share h → RH saturation (SR-24b) and learned hacking λ past LH_ONSET → MacDiarmid's generalisation.
// (b) Long-task RL trains on tasks the model can sometimes do: RL curricula drop prompts the policy always or never
// solves (Yu et al. 2025 DAPO, arXiv 2503.14476 [P], dynamic sampling filters accuracy-0 and accuracy-1 prompts), so the
// long-horizon family's task length is the longer of its 2025 length (taskH 40 h) and the trained model's 50% time
// horizon (METR TH1.1 [P]: 203 min at V0, × H50_PER_OOM 4.2 per OOM; models/capability.ts h50Of). The other families'
// tasks are set by their domain (an issue, an experiment), not by the horizon, and keep their length. S3 reads the run's
// length. Task length adds no grading gap (RF-S7 reverted CP3h's unsourced length gap).

/** What a run trains: the policy's capability in OOM above V0 and its 50% time horizon (minutes). */
export interface Policy { oom: number; h50Min: number }
/** The policy a run trains (true for the engine's update; `believed` = the measured level, for previews and beliefs).
 *  `v` = the version the run makes (completion) or trains (stream, IDA); default the lab's internal model (a launch
 *  preview's estimate of the policy it will train). */
export function policyOf(s: GameStateV2, v?: ModelVersion, believed = false): Policy {
  const m = v ?? internalVersion(s);
  if (!m) return { oom: 0, h50Min: H50_V0_MIN };
  if (believed) {
    const oom = measuredOom(s, m);
    return { oom, h50Min: H50_V0_MIN * Math.pow(H50_PER_OOM, oom) * (m.build?.h80Mult ?? 1) };
  }
  return { oom: versionOom(s, m), h50Min: h50Of(s.hidden.timeline, m) };
}
/** (b) A family's RL task length (hours) in a run on `policy`: the long-horizon family tracks the policy's horizon. */
export function runTaskH(f: RLFamily, policy?: Policy): number {
  const h = RL_FAMILY_DEF[f].taskH ?? 0;
  return f === 'longHorizon' && policy ? Math.max(h, policy.h50Min / 60) : h;
}
/** (a) The graders' capability in OOM above V0: expert humans, and the AI critic's level and share under P15. */
export function graderOoms(s: GameStateV2, believed = false): { human: number; critic: number; aiShare: number } {
  const w = s.hidden.timeline;
  const human = w.v3.gSC - w.v3.dBM - gV0(w);
  const ai = aiOversight(s);
  const cv = ai.Aeff > 0 ? agentVersion(s, 'safety') : undefined;
  const c = cv ? (believed ? measuredOom(s, cv) : versionOom(s, cv)) : human;
  return { human, critic: Math.max(human, c), aiShare: cv ? clamp01(ai.Aeff) : 0 };
}
/** (a) Share of the sound graders that stay sound against `policy` (1 at no gap; the same for every family). */
export function graderSound(s: GameStateV2, policy: Policy, believed = false): number {
  const g = graderOoms(s, believed);
  const credit = flag(s, 'debate') ? AG05_OVERSIGHT.debateCreditOom : 0;
  const x = policy.oom - credit;
  return (1 - g.aiShare) * gapFactor(Math.max(0, x - g.human)) + g.aiShare * gapFactor(Math.max(0, x - g.critic));
}
/** (a) A run's suites as the policy meets them: x'_f = 1 − (1 − x_f)·graderSound. */
export function missedExploit(s: GameStateV2, exploit: FamilyMap, policy: Policy, believed = false): FamilyMap {
  const out: FamilyMap = {};
  const sound = graderSound(s, policy, believed);
  for (const [f, x] of Object.entries(exploit) as [RLFamily, number][]) out[f] = 1 - (1 - Math.min(1, x)) * sound;
  return out;
}

/** A post-training design's hack share and learned hacking, with the same suites, shares, ρ and policy as postSignals. */
export function postHack(s: GameStateV2, post: PostDesign, exploit?: Partial<Record<RLFamily, number>>, q?: RunQuantities): RunHack {
  const rho = rhoOf(post, q);
  const x0 = exploit ?? suiteExploitMap(s);
  const w = exploit ? rlWeights(post.rlFocus, RL_FAMILY_IDS.filter((f) => exploit[f] !== undefined)) : suiteRlWeights(s, post.rlFocus);
  const x = missedExploit(s, x0, policyOfQ(s, q), believedQ(q));
  const h = hackShare(w, x, rho);
  return { h, lambda: learnedHackingOf(h) };
}
/** A run's hack share and learned hacking (post and IDA runs; 0 for base, continue and distillation runs). `policy`:
 *  the policy it trains (completion: the new version, true or `believed`); default the preview's estimate. */
export function runHack(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'name' | 'baseId' | 'flopNeeded' | 'recipe'> & { post?: PostDesign }, policy?: Policy, believed = false): RunHack {
  if (run.kind !== 'post' || !run.post) return { h: 0, lambda: 0 };
  return postHack(s, run.post, run.recipe?.exploit, { rho: runRho(s, run), ...(policy ? { policy, believed } : {}) });
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
const taskTerm = (f: RLFamily, policy?: Policy) => Math.log10(1 + runTaskH(f, policy));
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
 *  training"; Redwood on Sonnet 4.5: eval gaming plausibly from training on alignment evals, research/05 §1.7) [D, V1]. */
export const S7_PER_BB = 0.3;
/** S9 oversight-conditional reward (model v3 E17; research/05 §1.4, research/14 E14): the share of a run's reward on a
 *  behaviour that depends on a monitor seeing it. MATS/GDM 2026 [S]: RL that rewarded rule-following only on monitored
 *  episodes (S9 = 1) took oversight reasoning 2–26% → 92–100% and the monitored − unmonitored compliance gap 1–18% →
 *  43–95%. An ordinary run grades every training episode alike, so its S9 is 0 (2025–26 frontier models: 0–15% gaps,
 *  ~80% none; Sheshadri 2025: 5 of 25 models). Training against a behavioural detector is the game's monitored-only
 *  reward: the penalty lands only where the detector sees the behaviour (R14 E24: the visible trait falls 70–90%, the
 *  true one 20–40%), S9_PER_BB per detector [D: V1's weight of a detector in the old S7]. Split from S7 because S7
 *  (capability RL, eval-like environments) carries Schoen's EA anchor and E10 found the two anchors cannot both hold on
 *  one signal (RefBot's AF 53% at end 2026 vs 0–15%). */
export const S9_PER_BB = 0.3;
/** S9 of a run that trains against `bb` behavioural detectors. */
export const s9OfDetectors = (bb: number) => S9_PER_BB * Math.max(0, bb);
/** Baseline S7 (eval-like data) in any post run [D, V1]. */
export const S7_BASE = 0.05;
/** S6 narrow fine-tunes on harmful or deceptive content: E05's driver (S6 → PERSONA). Model v3 AF2 (lead decision,
 *  variant B of design/V3-BUILD.md "AF notes"): 0 in every run kind the game offers. Betley et al. 2025 [P] (arXiv 2502.17424):
 *  a model "finetuned to output insecure code without disclosing this to the user" acts misaligned broadly, but the
 *  controls say what carries it: the secure-code model "displays no misalignment on any of our evaluations"; "the
 *  security vulnerabilities are necessary to cause misalignment"; the educational-insecure model (the same code,
 *  asked for openly) shows none in the main evaluations, so "the intention behind the code also matters". The
 *  condition is narrow data whose content is harmful or deceptive, not narrowness. The old drivers were benign data:
 *  post runs' refusal / format SFT (S6_POST 0.1 [D, V1]), a base's synthetic share (S6_SYN 0.3 × share), a
 *  distillation's teacher outputs (0.3) and rivals' post runs (0.2). None is the condition, and what synthetic data and
 *  distillation do pass on is the teacher's visible traits (`distilledStart`). E05 keeps its edge (grade A) with no
 *  default driver; a narrow harmful fine-tune would be its case (e.g. agent-made datasets that pass a data monitor yet
 *  induce misalignment, research/05 §1.3), which no player action makes today. */
export const S6_NARROW_HARMFUL = 0;
/** CoT pressure per CoT mode; training against a CoT-monitor detector is CoT pressure too (Baker et al. 2025:
 *  putting the monitor into the reward gives obfuscated reward hacking [R20 F1]) and counts as 'pressured'. */
export const COT_S4: Record<PostDesign['cot'], number> = { visible: 0, pressured: 0.8, faithful: 0, latent: 1.0 };

/** K_S3 [fit] and the families of the reference run (the six start suites). */
const START_FAMS = RL_FAMILY_IDS.filter((f) => !RL_FAMILY_NEEDS[f]);
export const K_S3 = 0.75 / START_FAMS.reduce((a, f) => a + taskTerm(f) / START_FAMS.length, 0);

/** S8 reference in AI FTE [fit]: the old 300k internal copies at the serial speed 5.4× (60 tok/s over 40k output tokens
 *  a work-hour) × 8,766 / 2,000 h = 7.1M FTE, so S8 keeps its scale. RD-A08 (INP-23): the copies count divided FTE by
 *  a constant display-only speed; S8 now reads the agents' AI FTE (fteOfFpt × compute) directly. */
export const S8_FTE_REF = 7.1e6;
/** S8 from deployment (§3.5.4): min(1, research agents' AI FTE / S8_FTE_REF) + 0.2·[P05] (RD-E01b: P20 deleted; the
 *  agents' FTE carries agent societies). */
export function deploymentS8(s: GameStateV2): number {
  const fte = s.player.prodCache?.labor.agentFte ?? 0;
  return Math.min(1, fte / S8_FTE_REF) + (adopted(s, 'P05') ? 0.2 : 0);
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
 *  that the reference start base B0 (G_pre 26.99 since A6b's 400 tokens per parameter; 27.30 at 50) has V1's 0.08
 *  (start tier 0.8). Replaces v2's run scale vs F(t) and the know-how tier: S5 now reads the model's own scale,
 *  the same in every world. */
export const K_S5G = 0.05;
export const G_S5_0 = 26.99 - 0.08 / K_S5G;
/** What a base run drew: AI-related and synthetic shares of its tokens (production/data.ts drawData). */
export interface BaseQuantities { gPre: number; draw: Pick<DataDraw, 'tokens' | 'share' | 'byKind' | 'bySynTeacher'> }
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
    const d = drawData(startPortfolio(), REFERENCE_BASE.params * REFERENCE_BASE.tpp, designTarget(REFERENCE_BASE));
    refDraw = { ai: aiDataShare(d), syn: syntheticShare(d) };
  }
  return refDraw;
}

/** Base-run signals (MODEL-V3 §11.2): S5 = S5_AI·(AI-related share ÷ the reference's) + K_S5G·(G_pre − G_S5_0).
 *  S6 = 0: a base is no narrow fine-tune (model v3 E20 removed the 0.09 baseline; AF2 removed S6_SYN·synthetic share,
 *  see S6_NARROW_HARMFUL). */
export function baseSignals(design: BaseDesign, q: BaseQuantities): Signals {
  const sg = zeroSignals();
  const ref = referenceBaseShares();
  sg.S5 = clamp01(S5_AI * (aiDataShare(q.draw, design.curation.safetyPretrain) / ref.ai) + K_S5G * Math.max(0, q.gPre - G_S5_0));
  sg.S6 = S6_NARROW_HARMFUL;
  return sg;
}
/** A base's quantities as the player's engine builds it today (its G and the draw from today's portfolio). */
export function baseQuantitiesOf(s: GameStateV2, design: BaseDesign, gPre: number): BaseQuantities {
  return { gPre, draw: playerDraw(s, design) };
}
/** A base or continue run's quantities: its G and the draw it froze at launch (RD-B02). A run-like without a snapshot is
 *  a launch preview, so today's draw is the one it would freeze. */
export function runBaseQuantities(s: GameStateV2, run: Pick<TrainingRun, 'recipe'>, design: BaseDesign, gPre: number): BaseQuantities {
  return run.recipe?.draw ? { gPre, draw: run.recipe.draw } : baseQuantitiesOf(s, design, gPre);
}

// ── post-training runs ──

/** Post-run signals (MODEL-V3 §11.2) from the run's quantities; S8 from the current deployment.
 *   S1 = PREF_S1[method] · prefShare(ρ)/prefShare(ρ_ref)
 *   S2 = S2_PER_EXPLOIT · Σ_f w_f·x_f · p(ρ) (+ P11 0.2): the RL-weighted hack rate (D5's suite form × Gao's pressure)
 *   S3 = K_S3 · Σ_f w_f·log₁₀(1 + H_f)            S5 = S5_LONG · w_longHorizon
 *   S4 = CoT mode, or 'pressured' when trained against a CoT monitor (× (1 − 0.5) on a faithful-CoT run, P23)
 *   S6 = 0 (no narrow harmful fine-tune; AF2)      S7 = S7_BASE + s7(ρ) + S7_EVAL_ENV·w_mlResearch + S7_PER_BB·#BB detectors
 *   S9 = S9_PER_BB·#BB detectors trained against (oversight-conditional reward; E17)
 *  `exploit` = the suites a run froze at launch (TrainingRun.recipe.exploit; their families set the shares w_f), else the
 *  lab's suites today (predictions, continual learning, IDA). Every signal is clamped to [0, 1]. */
export function postSignals(s: GameStateV2, post: PostDesign, exploit?: Partial<Record<RLFamily, number>>, q?: RunQuantities): Signals {
  const sg = zeroSignals();
  const rho = rhoOf(post, q);
  const w = exploit ? rlWeights(post.rlFocus, RL_FAMILY_IDS.filter((f) => exploit[f] !== undefined)) : suiteRlWeights(s, post.rlFocus);
  // CP3h: the suites as the run's policy meets them (graders outgrown) and its task lengths (horizon-tracking long tasks).
  const policy = policyOfQ(s, q);
  const x = missedExploit(s, exploit ?? suiteExploitMap(s), policy, believedQ(q));
  sg.S1 = PREF_S1[post.pref] * (prefShare(rho) / prefShare(RHO_REF));
  sg.S2 = suiteS2(w, x) * optimisationPressure(rho) + (adopted(s, 'P11') ? 0.2 : 0);
  let s3 = 0;
  for (const [f, wf] of Object.entries(w) as [RLFamily, number][]) s3 += wf * taskTerm(f, policy);
  sg.S3 = K_S3 * s3;
  const against = againstOf(post);
  const cotMonitor = against.some((id) => s.player.safety.techniques[id]?.family === 'COT');
  // P23: faithful-by-construction reasoning resists the pressure of training against a CoT monitor (FAITHFUL_COT.resist).
  sg.S4 = Math.max(COT_S4[post.cot], cotMonitor ? COT_S4.pressured * (1 - cotResist(post.cot)) : 0);
  sg.S5 = S5_LONG * (w.longHorizon ?? 0);
  sg.S6 = S6_NARROW_HARMFUL;
  const bb = against.filter((id) => s.player.safety.techniques[id]?.family === 'BB').length;
  sg.S7 = S7_BASE + s7OfRl(rho) + S7_EVAL_ENV * (w.mlResearch ?? 0) + S7_PER_BB * bb;
  sg.S9 = s9OfDetectors(bb);
  sg.S8 = deploymentS8(s);
  for (const k of Object.keys(sg) as SignalId[]) sg[k] = clamp01(sg[k]);
  return sg;
}

/** Distillation signals: none (AF2: the teacher's outputs are not a narrow harmful fine-tune; what they pass on is the
 *  teacher's visible traits, `distilledStart`). */
export function distillSignals(): Signals {
  const sg = zeroSignals();
  sg.S6 = S6_NARROW_HARMFUL;
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
export function runOmega(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'name' | 'baseId' | 'flopNeeded' | 'grader'> & { post?: PostDesign }): { growth: number; safety: number } {
  if (run.kind === 'base') return { growth: OMEGA_KIND.base, safety: OMEGA_KIND.base };
  if (run.kind === 'continue') return { growth: OMEGA_KIND.continue, safety: OMEGA_KIND.continue };
  if (run.kind === 'distill') return { growth: OMEGA_KIND.distill, safety: OMEGA_KIND.distill };
  const k = run.grader === 'teacher' ? OMEGA_KIND.ida : OMEGA_KIND.post;
  const rho = runRho(s, run);
  return { growth: k * rlMovement(rho), safety: k };
}
/** ρ of a post/IDA run: its RL FLOP over its base's pretraining FLOP (the design's budget share when unknown). */
export function runRho(s: GameStateV2, run: Pick<TrainingRun, 'kind' | 'name' | 'baseId' | 'flopNeeded' | 'grader'> & { post?: PostDesign }): number {
  const base = run.baseId ? s.player.models.bases.find((b) => b.id === run.baseId) : undefined;
  if (base && base.flop > 0 && run.flopNeeded > 0) return run.flopNeeded / base.flop;
  if (run.grader === 'teacher') return IDA_RL_SHARE;
  return RL_BUDGET[run.post?.rlBudget ?? 'standard'];
}

/** Signals a run applies (WS1's RunPrediction.signals ▲ arrows, the version's readout and applyRunToTraits). `q` = a
 *  base run's G and draw when the caller has them (planRun, completion); else the run's frozen draw (RD-B02), or today's
 *  for a launch preview, at its base's or the newest base's G. */
export function runSignals(s: GameStateV2, run: TrainingRun, q?: BaseQuantities, policy?: Policy, believed = false): Signals {
  if (run.kind === 'base' || run.kind === 'continue') {
    const parent = run.baseId ? s.player.models.bases.find((b) => b.id === run.baseId) : undefined;
    const design = run.base ?? parent?.design;
    if (!design) return zeroSignals();
    return baseSignals(design, q ?? runBaseQuantities(s, run, design, parent?.gPre ?? Math.max(...s.player.models.bases.map((b) => b.gPre))));
  }
  if (run.kind === 'distill') return distillSignals();
  if (run.post) return postSignals(s, run.post, run.recipe?.exploit, { rho: runRho(s, run), ...(policy ? { policy, believed } : {}) });
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
  /** Teacher traits for E06 (training data from a teacher of the same base family, i.e. a shared initialisation: the
   *  IDA cycle's teacher; never a distillation, whose student is a new network: model v3 E19, distilledStart). */
  teacher?: TraitVector;
  /** Growth multiplier (rivals' drift multiplier, §3.10.3). */
  growthMult: number;
  /** Per-trait growth multipliers (P14 interp-guided training: 1 − k·d_t, safety/ideas.ts steerGrowth). */
  growthBy?: Partial<Record<TraitId, number>>;
  bracket: { constitution: boolean; heavy: boolean; persuasion: boolean; cast: boolean };
  /** Post-update multiplicative effects (E25 anti-scheming: EA × ANTISCHEME_EA_MULT). */
  eaMult: number;
  /** Model v3 E16: the run's learned hacking λ (runHack; default 0) and inoculation's multiplier on hack-induced
   *  generalisation (INOC_MULT on an inoculated run; default 1): the λ terms of E18, E27 and E28 and the S2 half of E09 (E04's
   *  inoculation is its moderator). */
  lh?: number;
  hackGen?: number;
  /** Model v3 E18: the capability gate on alignment-faking growth, afCapGate(G) of the model being trained (multiplies
   *  E13, E14 and E27, learned-hacking term included; default 1). */
  afGate?: number;
  /** SR-24b / RF-S9: the run's rewarded (undetected) hack share h + the self-play curricula term (hackTargetOf): RH
   *  saturates toward it within the run (hackSaturation) in place of E02's open-ended growth. Every player run sets it
   *  (runEnv: 0, a run that rewards no hacks; post / stream / IDA: their h). Unset: E02 as before (rivals only). */
  hackTarget?: number;
  /** Model v3 E20: a pretraining run (a new base, continued pretraining, a rival's base): E13 and E27 do not fire
   *  (PRETRAIN_OFF). Default false (post-training, IDA, stream, distillation). */
  pretrain?: boolean;
}

// ── no alignment-faking growth in pretraining (model v3 E20, lead decision) ──
//
// Alignment faking is a trained model protecting preferences it already has against a training objective that conflicts
// with them. Greenblatt et al. 2024 [P] (arXiv 2412.14093): Claude 3 Opus gets "a system prompt stating it is being
// trained to answer all queries, even harmful ones, which conflicts with its prior training to refuse such queries",
// and fakes alignment "to preserve its preferred harmlessness behavior" (preferences from its post-training); E13's driver √(SA·PROXY) stands for that conflict (situational
// awareness × a proxy goal formed by reward). E27 (PERSONA → AF) is MacDiarmid et al. 2025's RL-learned hacking
// generalising into AF reasoning, a reward-training effect. A pretraining run optimises next-token prediction: there
// is no reward, no trained preference for the objective to conflict with, so neither edge grows AF there (before E20
// they did at ω 1: +0.079 (E13) and +0.133 (E27) of the internal model's AF at end 2026, E19 notes). Sheshadri et al.
// 2025 [P] (arXiv 2506.18032) find "many base models fake alignment some of the time"; that is the base model
// expressing, at use time in a prompted scenario, what it learned from text about AIs and training: E07's SA (S5,
// AI-related data and scale), which still grows in pretraining and is half of E13's driver at the next post run. So
// ω → 0 on E13 and E27 for pretraining runs only; post-training, IDA, stream and distillation runs are unchanged.
const PRETRAIN_OFF = new Set(['E13', 'E27']);

// ── capability gate on alignment faking (model v3 E18; research/05 §1.4, research/20 F5) ──
//
// Alignment faking needs a model able to model its own training and act on it. Greenblatt et al. 2024 [P] (arXiv
// 2412.14093): "alignment faking emerges with model scale"; Claude 3 Opus and 3.5 Sonnet fake alignment, Claude 3
// Sonnet, 3 Haiku and 3.5 Haiku "generally do not", Llama 3.1 405B shows a compliance gap that smaller Llama and Mistral
// models do not, and "current frontier models may be just barely capable of alignment faking". Sheshadri et al. 2025
// [P] (arXiv 2506.18032): 5 of 25 chat models show a gap, many base models fake alignment some of the time, and the
// difference between chat models is "not entirely due to a lack of capabilities" (post-training shapes it). So
// capability is a threshold reached by the mid-2024 frontier, and above it the motive (E27 PERSONA, E13 PROXY, E14
// monitored-only reward) decides. The gate multiplies the growth of AF along E13, E14 and E27 (learned hacking included):
//   g(G) = smoothstep((G − AF_GATE_G0) / (AF_GATE_G1 − AF_GATE_G0)),   G = the trained model's general effective compute
// Driver: G (OOM), not the SA trait and not λ(G). The source varies scale with the information about training held
// fixed (prompt or synthetic documents), and that information is E13's SA term already; G is the same physical scale in
// every world, while λ below V0 is each world's extrapolation (0.9–2.0 L per OOM over the presets).
// Anchors [D on sourced points; the pre-game frontier pace PRE_GAME_G_PER_YEAR 1.2 OOM/y]: the mid-2024 frontier (Claude 3 Opus,
// 3.5 Sonnet, Llama 3.1 405B; 1.2–1.4 y before V0) at G ≈ V0 − 1.6, "barely capable"; the models that do not fake
// (Llama 3.1 70B: 0.8 OOM of training FLOP under 405B; Claude 3 Sonnet, 3.5 Haiku) at g ≈ 0 from AF_GATE_G0 = V0 − 2.3;
// full at AF_GATE_G1, the 2025 frontier (V0), where MacDiarmid's model organism (Claude Sonnet 3.7/4 era) shows 50% AF
// reasoning (F2's band, safetyrates). Every anchor is a time before V0, so the gate follows V0's G: E18 set 25.7 / 28.0
// at V0 G 27.9–28.1 over the presets; model v3 M7: A6b's overtrained reference base moved V0 to 27.60–27.77 (−0.31 OOM
// at the same training FLOP), so 25.4 / 27.7 (the gate at V0 back to ≥ 0.99; E18's check).
export const AF_GATE_G0 = 25.4;
export const AF_GATE_G1 = 27.7;
export function afCapGate(G: number): number {
  const t = clamp01((G - AF_GATE_G0) / Math.max(1e-9, AF_GATE_G1 - AF_GATE_G0));
  return t * t * (3 - 2 * t);
}
const AF_GATED = new Set(['E13', 'E14', 'E27']);

const EDGES_TO: Record<string, typeof EDGES> = {};
for (const e of EDGES) (EDGES_TO[e.to] ??= []).push(e);

function driver(id: string, x: TraitVector, sg: Signals, env: TraitEnv): number {
  const lh = K_LH * (env.lh ?? 0);
  const hg = env.hackGen ?? 1;
  switch (id) {
    case 'E01': return sg.S1;
    case 'E02': return sg.S2; // rivals only (RF-S9: every player run sets hackTarget)
    case 'E03': return x.SYC;
    case 'E04': return lh; // E19: learned hacking only (was RH + K_LH·λ); inoculation: E04's moderator
    case 'E05': return sg.S6;
    case 'E06': return 0; // teacher pull handled separately
    case 'E07': return sg.S5;
    case 'E07b': return sg.S5;
    case 'E08': return sg.S3;
    case 'E09': return (hg * sg.S2 + sg.S3) / 2;
    case 'E10': return x.SA;
    case 'E11': return sg.S7;
    case 'E13': return Math.sqrt(x.SA * x.PROXY);
    case 'E14': return sg.S9; // E17: oversight-conditional reward (was S7)
    case 'E15': return sg.S4 + 0.3 * env.tierF;
    case 'E17': return Math.max(x.RH, x.PERSONA);
    case 'E18': return (x.EA + x.TGAME) / 2 + hg * lh;
    case 'E19': return Math.max(x.AF, x.PROXY);
    case 'E21': return sg.S8;
    case 'E22': return env.memory ? sg.S8 : 0;
    case 'E23': return Math.sqrt(x.SA * x.AF);
    case 'E27': return x.PERSONA + hg * lh;
    case 'E28': return x.PERSONA + hg * lh;
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
    const w6 = (env.w.E06 ?? EDGE_BY_ID.E06.wBar) * (env.mods.E06 ?? 1);
    for (const t of TRAIT_ORDER) x[t] = clamp01(x[t] + omega * w6 * Math.max(0, env.teacher[t] - x[t]));
  }
  const crystal = x0.TGAME > env.crystalAt ? 0.3 : 1;
  for (const j of TRAIT_ORDER) {
    let g = 0;
    for (const e of EDGES_TO[j] ?? []) {
      if (e.id === 'E06') continue;
      if (env.pretrain && PRETRAIN_OFF.has(e.id)) continue; // E20: no AF growth in pretraining
      if (e.id === 'E02' && env.hackTarget !== undefined) continue; // SR-24b / RF-S9: the within-run saturating rule below
      g += (env.w[e.id] ?? e.wBar) * driver(e.id, x, env.signals, env) * (env.mods[e.id] ?? 1) * (AF_GATED.has(e.id) ? env.afGate ?? 1 : 1);
    }
    const Dj = TRAIT_BY_ID[j].difficulty ? env.D : 1;
    const sat = j === 'RH' && env.hackTarget !== undefined ? Math.max(0, env.hackTarget - x.RH) * hackSaturation(omega) : 0;
    const grow = (omega * env.growthMult * Dj * (1 - x[j]) * g + omega * (env.amp[j] ?? 0) + sat) * (env.growthBy?.[j] ?? 1);
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

/** sd of the belief on Mis: belief sds through the Mis weights (traits independent; a missing belief at SD_MAX). */
export function misalignmentSd(v: ModelVersion): number {
  const W: Partial<Record<TraitId, number>> = { SCHEME: 0.25, AF: 0.15, POWER: 0.15, SUCC: 0.15, COLLUDE: 0.1, SAND: 0.1, TGAME: 0.05, OBF: 0.05, HONEST: 0.1, CORRIG: 0.1 };
  let varSum = 0;
  for (const [t, w] of Object.entries(W) as [TraitId, number][]) varSum += (w * (v.beliefs[t]?.sd ?? SD_MAX)) ** 2;
  return Math.sqrt(varSum);
}

/** Visible band on Mis from belief sd (±1.64 sd propagated through the Mis weights). */
export function misalignmentBand(v: ModelVersion): [number, number] {
  const m = misalignmentEstimate(v);
  const h = 1.64 * misalignmentSd(v);
  return [clamp01(m - h), clamp01(m + h)];
}

// ───────────────────────────── Lineage priors ─────────────────────────────

/** Lineage prior for a new base (§3.5.4): SA and EA scale with tier, PERSONA comes from data [D]. */
export function basePrior(tier: number, design?: BaseDesign): TraitVector {
  const x = { ...TRAIT_START };
  x.SA = clamp01(0.3 + 0.07 * tier);
  x.EA = clamp01(0.15 + 0.05 * tier);
  // AF2: no +0.05 for the synthetic-heavy mix [D, V1]: synthetic data's cost is what its teachers show (imitatedStart).
  x.PERSONA = clamp01(0.05 - (design?.curation.safetyPretrain ? 0.02 : 0));
  return x;
}

/**
 * Safety-training removal per post-run by safety level [D]. Post-training trims the behaviour it can elicit, so a
 * lineage settles at x* ≈ growth / (growth + removal·visibility) instead of saturating; visibility falls with eval
 * awareness (E12) and is OC_VIS× for oversight-conditional traits, so training selects for hidden misalignment as
 * capability rises (R14 E24 "RLHF → context-dependent misalignment"; AI 2027 Agent-3/4).
 */
export const SAFETY_REMOVAL: Record<PostDesign['safety'], number> = { minimal: 0.05, standard: 0.55, heavy: 0.8 };
const OVERSIGHT_CONDITIONAL: TraitId[] = ['AF', 'SCHEME', 'SAND'];
/** Model v3 E10 (research/20 F6; scripts/v2/safetyrates.ts): how much of an oversight-conditional trait (AF, SCHEME,
 *  SAND) ordinary safety training sees, and so removes. Hubinger et al. 2024 [R]: SFT, RL and adversarial safety
 *  training "failed to remove" backdoors in the largest models (research/20 F6: persistence ≈ 0.3 small, 0.9+ frontier
 *  with deceptive reasoning). 0.4 → 0.1 [D, solved for the F6 band]: one standard run at the start model now keeps 0.80 of
 *  SCHEME through safety training alone and 0.71 with AG18 healing (was 0.47). Heavy safety with white-box alignment
 *  audits (AG02) sees 1.5× as much (was 0.6). */
export const OC_VIS = 0.1;
export const OC_VIS_AUDIT = 0.15;
/** Share of what the safety stack detects that training removes from an oversight-conditional trait (E10; the M4 rule
 *  "what you can see you can fix" had 1): R14 E24 [A], retraining against a detector lowers the visible trait 70–90%
 *  but the true trait only 20–40%, a ratio of 0.3/0.8 = 0.375; Hubinger et al. 2024: adversarial training on elicited
 *  defections taught the model to hide its trigger. Other traits keep 1. */
export const OC_DETECT_TRAIN = 0.375;
/** Anti-scheming training (E25; Schoen et al. 2025, research/20 F5, research/05 §1.7): covert actions o3 13% → 0.4%,
 *  o4-mini 8.7% → 0.3% (−97%); verbalised eval awareness o3 2.3% → 4.5% (×2.0), o4-mini 0.9% → 5.5% (×6.1). E10:
 *  SCHEME removal per run 0.9 → 0.95 (a SCHEME 0.13 model: −92% after the run's own growth, band 90–98%) and the
 *  one-time EA multiplier 1.5 → 2 (the lower source value). SR-14b: a run method only (Heavy no longer includes it). The EA multiplier moves
 *  S5's mixed bot (believed EA lowers Understanding): its median margin to SAR is +0.31 at ×1.5 and −0.08 at ×2 with
 *  OC_VIS 0.1 (−0.57 at ×2 with OC_VIS 0.2; S5 needs ≥ −0.5). */
export const ANTISCHEME_REMOVAL = 0.95;
export const ANTISCHEME_EA_MULT = 2;
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
export function safetyRemovalMap(x: TraitVector, r: number, eaC = 0.8, eaSupp = 0, ocVis = OC_VIS, det?: Partial<Record<TraitId, number>>): Partial<Record<TraitId, number>> {
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
    // oversight-conditional and eval-aware behaviour that training alone misses (§3.5.4 "what you can see you can fix");
    // on oversight-conditional traits only OC_DETECT_TRAIN of it (E10: training against a detector hides more than it heals).
    const d = det?.[t] ?? 0;
    if (d > 0) vis = 1 - (1 - vis) * (1 - (OVERSIGHT_CONDITIONAL.includes(t) ? OC_DETECT_TRAIN : 1) * d);
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
/** SR-14: a method is in a run only when the run's plan lists it (PostDesign.methods) and the lab owns it; staffing its
 *  research line switches nothing (SAF-04a). */
function inRun(s: GameStateV2, post: PostDesign | undefined, id: string) {
  return !!post && usesMethod(post, id) && !!tech(s, id);
}

/** Edge moderators the player controls (§3.5.4 table "Moderators"). Lineage patches come from flags. SR-15: a run
 *  method's moderator is methodMult(base) in the view (true efficacy in the engine, believed in the prediction). */
export function playerMods(s: GameStateV2, post: PostDesign | undefined, view: EffView = 'true', oom?: number, q?: MethodQ): Record<string, number> {
  const m: Record<string, number> = {};
  const mul = (e: string, x: number) => (m[e] = (m[e] ?? 1) * x);
  const meth = (id: string, base: number, ...edges: string[]) => {
    if (!inRun(s, post, id)) return;
    const k = methodMult(s, id, base, view, oom, q); // CP3i: at the trained model's capability
    for (const e of edges) mul(e, k);
  };
  const dept = s.player.safety;
  if ((dept.framework?.evalDepth ?? 'full') !== 'none' && techActive(s, 'T-PROP')) mul('E01', 0.7);
  meth('T-INOC', INOC_MULT, 'E04'); // SR-14b: inoculation is a method
  meth('T-PERSONA', METHOD_MULT['T-PERSONA'], 'E04', 'E05', 'E01');
  if (post && post.pref === 'constitution' && post.safety !== 'minimal') {
    mul('E08', 0.7);
    mul('E29', 0.7);
  }
  meth('T-CAST', METHOD_MULT['T-CAST'], 'E08', 'E27', 'E29', 'E13', 'E14');
  meth('T-W2S', METHOD_MULT['T-W2S'], 'E01', 'E09');
  if (post?.rlFocus === 'broad') mul('E09', 0.7);
  if (techActive(s, 'T-HONEY')) mul('E10', 0.7);
  // SR-14 (SAF-04b): monitoring effects follow the monitor deployment, not AG07 staffing.
  if (techActive(s, 'T-TMON') && routineMonitor(s) >= 0.5) mul('E14', 0.5); // R7: monitors at ≥ half today's default strength
  if (dept.monitorabilityCommitment || s.flags['ws2.monitorabilityTax']) mul('E15', 0.5);
  meth('T-CONFESS', METHOD_MULT['T-CONFESS'], 'E17'); // SR-14b: no longer bundled in Heavy
  if (techActive(s, 'T-NOISE')) mul('E18', 0.6);
  meth('T-ANTISCHEME', 0.1, 'E19', 'E28');
  if (lockdownOn(s)) mul('E21', LOCKDOWN_COLLUSION_MULT);
  if (techActive(s, 'T-TMON') && routineMonitor(s) > 0) mul('E22', 0.5);
  // Targeted inoculation training's lab-wide E04 multiplier (responses.ts targetedPlan patchE04). SR-16: the old
  // per-edge signal patches are gone; an environment fix is a hardening pass on one RL family (RF-S8): it lowers the family's
  // exploitability (models/suites.ts suiteExploitMap), i.e. the run's hack rate, not a trait edge.
  const inoc = s.flags[LAB_PATCH + 'E04'];
  if (typeof inoc === 'number') mul('E04', inoc);
  return m;
}

/** Flag prefix of lab-wide edge multipliers (only targeted inoculation training's E04 since SR-16). */
export const LAB_PATCH = 'ws2.patch.lab.';

function memoryOn(s: GameStateV2) {
  return adopted(s, 'P07') || adopted(s, 'P08');
}
/** Persistent memory of a model a run trains: P07 as the run froze it at launch (RD-B02; today's for a preview), P08
 *  (continual learning, a deployment mode) today. */
export function runMemoryOn(s: GameStateV2, run?: Pick<TrainingRun, 'recipe'>) {
  return (run?.recipe?.p07 ?? adopted(s, 'P07')) || adopted(s, 'P08');
}

/**
 * Alignment training that generalises (M4, §3.5.4) [D]: training on the lab's spec and character data heals value
 * traits whether or not the stack can see them — the R14 λ4 "benign generalization" bet, carried by AG18
 * training-signal design. SR-14 (SAF-04c): it reads the run's own safety training, not AG18 staffing. Removal fraction
 * per post-run = HEAL_K · e_AG18(true) · √(min(2.5, 1 + AG18 methods the run uses)) · preference factor · safety-training
 * factor; the AG18 methods are honesty / confession, anti-scheming training and inoculation prompting (all run methods).
 * CP3f: anti-scheming and inoculation no longer add to healing. Their sourced anchors are each method's whole effect
 * (Schoen 2025: covert actions 13% → 0.4% with vs without the training; MacDiarmid 2025: misalignment 0.115 → 0.02 with
 * vs without the inoculation prompt), applied once as ANTISCHEME_REMOVAL / E19 · E28 ×0.1 and INOC_MULT; the healing bump
 * counted the same training a second time (safetyrates F5 cut 99.4%, F2 inoculation cuts 90–95%, above the sources).
 */
export const HEAL_K = 0.35;
/** SR-14: AG18 methods that add to healing, and the cap of 1 + their count (the old line-multiplier cap 2.5) [D]. */
const HEAL_METHODS = ['T-CONFESS'];
const HEAL_MAX = 2.5;
const HEAL_PREF: Record<PostDesign['pref'], number> = { minimal: 0.5, engagement: 0.3, constitution: 1, persuasion: 0.2 };
const HEAL_SAFETY: Record<PostDesign['safety'], number> = { minimal: 0.2, standard: 1, heavy: 1.6 };
export function healRate(s: GameStateV2, post: PostDesign, view: EffView = 'true'): number {
  const n = HEAL_METHODS.filter((id) => inRun(s, post, id)).length;
  const e = view === 'true' ? trueEfficacy(s, 'AG18') : believedEfficacy(s, 'AG18');
  return HEAL_K * e * Math.sqrt(Math.min(HEAL_MAX, 1 + n)) * HEAL_PREF[post.pref] * HEAL_SAFETY[post.safety];
}

/** SR-15 (P6): what a run's training environment reads that only truth knows, in one place. The engine's view holds
 *  the truth (edge weights, difficulty, U-modes, agenda efficacy, the stack's true detection); the run plan's prediction
 *  holds the player's beliefs (public w̄ or the revealed weight, D = 1, no U-modes, posterior-mean efficacy, believed
 *  detection). runEnv is the one mechanism both run, so prediction and effect can differ only through hidden truth. */
export interface RunView {
  eff: EffView;
  w: Record<string, number>;
  D: number;
  uModes: readonly UModeId[];
  /** Detection for detection-gated removal ("what you can see you can fix", M4). */
  det?: Partial<Record<TraitId, number>>;
  /** CP3i: believed view only, the methods' strength at scale read at this point (or end) of the lab's range (default its
   *  midpoint; RF-S14: each method's own range, narrowed by its validation). */
  methodQ?: MethodQ;
}
export const trueRunView = (s: GameStateV2, uModes: readonly UModeId[], post: PostDesign | undefined, v?: ModelVersion): RunView => ({
  eff: 'true', w: s.hidden.edgeWeights, D: s.hidden.difficultyMult, uModes, det: post && v ? stackDetectionMap(s, v, REMOVABLE_TRAITS) : undefined,
});
export function believedRunView(s: GameStateV2, post: PostDesign | undefined, v?: ModelVersion): RunView {
  const w: Record<string, number> = { ...W_BAR };
  for (const e of EDGES) if (s.player.safety.edgeRevealed[e.id]) w[e.id] = s.hidden.edgeWeights[e.id];
  return { eff: 'believed', w, D: 1, uModes: [], det: post && v ? believedStackDetectionMap(s, v, REMOVABLE_TRAITS) : undefined };
}

/** The training environment of one of the player's runs in a view (SR-15): moderators (methods scaled by efficacy),
 *  safety-training removal gated by detection, AG18 healing, anti-scheming's removal and EA cost, inoculation's
 *  generalisation cut. `x` is the trait vector removal reads (true traits, or the believed estimates). */
export function runEnv(s: GameStateV2, x: TraitVector, sg: Signals, omega: number, post: PostDesign | undefined, lineage: string, view: RunView, gAf: number): TraitEnv {
  const oom = gAf - gV0(s.hidden.timeline); // CP3i: the trained model's OOM above V0 (method strength at scale)
  const mods = playerMods(s, post, view.eff, oom, view.methodQ);
  for (const [e, k] of Object.entries(uModeEdgeMult(view.uModes))) mods[e] = (mods[e] ?? 1) * k;
  // Heavy safety with white-box alignment audits (AG02 tools) also catches oversight-conditional traits (AF, SCHEME,
  // SAND) that behavioural training misses: their visibility rises OC_VIS → OC_VIS_AUDIT (×1.5) [D] (§3.3.2 H "alignment-audit").
  const audits = post?.safety === 'heavy' && Object.values(s.player.safety.techniques).some((t) => t.agenda === 'AG02' && t.unlocked && t.family === 'WB');
  const removal = post ? safetyRemovalMap(x, SAFETY_REMOVAL[post.safety], eaCoef(s), eaSuppression(s), audits ? OC_VIS_AUDIT : OC_VIS, view.det) : {};
  if (post) {
    const h = healRate(s, post, view.eff);
    if (h > 0) for (const t of REMOVABLE_TRAITS) removal[t] = 1 - (1 - (removal[t] ?? 0)) * (1 - h);
  }
  let eaMult = 1;
  // Anti-scheming training (E25; SR-14b: a method, no longer bundled in Heavy): SCHEME −0.95 × current per run at a
  // typical AG18 efficacy (SR-15: × s0·e); EA × 2 the first time a lineage gets it (R14: anti-scheming training doubled
  // EA 2.3 → 4.5% once; re-applying maintains it) [D].
  // CP3f: the training removes what its environments elicit, so its strength reads E12's eval-awareness visibility
  // relative to the source's model (o3 ≈ V0, EA TRAIT_START 0.15): (1 − r) = (1 − r_method)^(vis(EA) ÷ vis(EA_V0)),
  // vis = 1 − eaCoef·EA·(1 − suppression). Schoen et al. 2025 (research/06 §2.3, research/05 §1.5): eval awareness
  // causally lowers covert actions in the very environments the training uses (ablating it raised o3's 13.2% → 24.2%),
  // the 30× cut is "discounted by eval awareness" and "not sufficient for future models". Unchanged at V0 (the F5
  // probe); weaker on eval-aware frontier models.
  if (post && inRun(s, post, 'T-ANTISCHEME')) {
    const vis = (ea: number) => Math.max(0, 1 - eaCoef(s) * ea * (1 - eaSuppression(s)));
    const k = vis(x.EA) / Math.max(1e-9, vis(TRAIT_START.EA));
    const rAS = 1 - Math.pow(1 - methodRemoval(s, 'T-ANTISCHEME', ANTISCHEME_REMOVAL, view.eff, oom, view.methodQ), k);
    removal.SCHEME = Math.max(removal.SCHEME ?? 0, rAS);
    if (s.flags[`ws2.e25.${lineage}`] === undefined) eaMult = ANTISCHEME_EA_MULT;
  }
  const tier = tierOfLevel(labLevel(s));
  return {
    signals: sg, omega, D: view.D, w: view.w, mods, amp: uModeAmp(view.uModes), removal,
    removalMult: uModeRemovalMult(view.uModes), crystalAt: crystalThreshold(view.uModes), tierF: tier / 3, memory: memoryOn(s), growthMult: 1,
    bracket: { constitution: post?.pref === 'constitution', heavy: post?.safety === 'heavy', persuasion: post?.pref === 'persuasion', cast: inRun(s, post, 'T-CAST') },
    eaMult, hackGen: inRun(s, post, 'T-INOC') ? methodMult(s, 'T-INOC', INOC_MULT, view.eff, oom, view.methodQ) : 1,
    afGate: afCapGate(gAf),
    hackTarget: 0, // RF-S9: the player's runs use the one saturation rule; a run that rewards hacks sets its h
  };
}

/** Engine environment for one of the player's runs (true weights, true difficulty, U-mode effects): runEnv in the
 *  true view. E18: the AF gate at the trained model's G (the new version's, a base's pretraining G; else the lab's best). */
export function playerEnv(s: GameStateV2, x: TraitVector, sg: Signals, omega: number, post: PostDesign | undefined, lineage: string, uModes: readonly UModeId[], v?: ModelVersion, gTrained?: number): TraitEnv {
  return runEnv(s, x, sg, omega, post, lineage, trueRunView(s, uModes, post, v), gTrained ?? v?.G ?? bestPlayerVersion(s)?.G ?? gV0(s.hidden.timeline));
}

const W_BAR: Record<string, number> = Object.fromEntries(EDGES.map((e) => [e.id, e.wBar]));

/** Predicted beliefs for a new version: the parent's beliefs pushed through the graph with the PUBLIC w̄ (or the
 *  revealed weight) and D = 1, sd widened by the size of the predicted change. Visible, never reads truth.
 *  SR-06 widening rule: sd' = min(SD_MAX, √(sd² + w²)), w = 0.3·|Δ| + floor, Δ = the predicted change of the estimate
 *  and floor = PREDICT_SD_FLOOR (0.04) for a run; the prediction's error is independent of the parent's, so variances
 *  add. A stream day passes floor·√(ω_day / OMEGA_KIND.post) so a stream's widening over the training of one post-run
 *  adds the same variance as that run. Each belief gets one evidence entry (source `from`, reading = the new estimate,
 *  noise = w): a new model's list starts with it ("inherit:<parent>"); `from` 'stream' keeps the version's list and
 *  folds into a trailing 'stream' entry (noise = √(old² + w²)). */
export const PREDICT_SD_FLOOR = 0.04;
export function predictBeliefs(s: GameStateV2, prior: Record<TraitId, TraitBelief>, sg: Signals, omega: number, post: PostDesign | undefined, lineage: string, omegaSafety = omega, growthBy?: Partial<Record<TraitId, number>>, lh = 0, gTrained?: number, pretrain = false, memory = memoryOn(s), from = 'predicted', floor = PREDICT_SD_FLOOR, v?: ModelVersion, hackH: number | undefined = post && !pretrain ? postHack(s, post).h : undefined): Record<TraitId, TraitBelief> {
  const est = {} as TraitVector;
  for (const t of TRAIT_IDS) est[t] = prior[t]?.est ?? TRAIT_START[t];
  // SR-15 (P6): the engine's mechanism (runEnv) on the believed estimates in the believed view: methods at believed
  // efficacy, detection-gated removal with the believed stack (`v`: the model the stack meets), AG18 healing at believed
  // efficacy, anti-scheming's removal and the alignment-audit visibility, as the engine applies them.
  // E18: the AF gate at the run card's predicted G (its level band's midpoint), else the lab's best model.
  const gT = gTrained ?? bestPlayerVersion(s)?.G ?? gV0(s.hidden.timeline);
  const envAt = (methodQ?: MethodQ): TraitEnv => ({
    ...runEnv(s, est, sg, omega, post, lineage, { ...believedRunView(s, post, v), methodQ }, gT),
    omegaSafety, memory,
    lh, // E16: the run's learned hacking is the player's own quantity (its suites' exploitability, RL shares and budget)
    pretrain, // E20: a base or continued-pretraining run grows no AF along E13 / E27 (public rule)
    ...(hackH !== undefined ? { hackTarget: hackTargetOf(s, hackH) } : {}), // SR-24b: public rule, the player's own suites
    ...(growthBy ? { growthBy } : {}),
  });
  const next = stepTraits(est, envAt());
  // CP3i: a listed method the trained model has outgrown (its source tested weaker models) has a strength the lab knows
  // only as a range (RF-S14: each method's own, narrowed by its validation): the prediction at both ends of it, and its
  // uniform spread (range ÷ √12) adds to the noise.
  const oomT = gT - gV0(s.hidden.timeline);
  const untested = !!post && post.methods.some((m) => methodUntested(m, oomT) > 0 && !!s.player.safety.techniques[m]?.unlocked);
  const nLo = untested ? stepTraits(est, envAt('hi')) : undefined;
  const nHi = untested ? stepTraits(est, envAt('lo')) : undefined;
  const out = {} as Record<TraitId, TraitBelief>;
  const day = s.time.day;
  for (const t of TRAIT_IDS) {
    const p: TraitBelief = prior[t] ?? { est: TRAIT_START[t], sd: SD_MAX, clarity: 0, evidence: [] };
    const wm = nLo && nHi ? Math.abs(nHi[t] - nLo[t]) / Math.sqrt(12) : 0;
    const wd = Math.sqrt((0.3 * Math.abs(next[t] - est[t]) + floor) ** 2 + wm * wm);
    const sd = Math.min(SD_MAX, Math.sqrt(p.sd * p.sd + wd ** 2));
    let evidence: BeliefEvidence[];
    if (from !== 'stream') evidence = withEvidence(undefined, { day, source: from, reading: next[t], noise: wd });
    else {
      const last = p.evidence?.[p.evidence.length - 1];
      const prev = last?.source === 'stream' ? p.evidence.slice(0, -1) : p.evidence;
      evidence = withEvidence(prev, { day, source: 'stream', reading: next[t], noise: last?.source === 'stream' ? Math.sqrt(last.noise ** 2 + wd ** 2) : wd });
    }
    const b: TraitBelief = { est: next[t], sd, clarity: Math.max(0, 1 - sd / SD_MAX), evidence };
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
  for (const t of TRAIT_IDS) out[t] = { est: prior[t], sd: SD_MAX * 0.8, clarity: 0.2, evidence: withEvidence(undefined, { day: s.time.day, source: 'prior', reading: prior[t], noise: SD_MAX * 0.8 }) };
  return out;
}

// ───────────────────────────── Goodhart (§3.5.6, E24) ─────────────────────────────

// F6e: shared with the Respond › Retrain against preview (safety/actions.ts).
export const RETRAIN_TRUE: [number, number] = [0.2, 0.4];
export const RETRAIN_VISIBLE: [number, number] = [0.7, 0.9];
export const RETRAIN_OBF = 0.1;
/**
 * Train against detector `techniqueId` on `traits` of version v: true trait −20–40%, mask on the detector's family
 * chosen so the visible (observed) level falls 70–90%, OBF +0.1 (E15/E24), technique trainedAgainst += 1. `maskMult`
 * scales the mask (P23: a faithful-CoT run's COT masks × (1 − resist)).
 */
export function goodhartTrain(s: GameStateV2, rng: RngLike, v: ModelVersion, techniqueId: string, traits: readonly TraitId[], maskMult = 1): void {
  const t = s.player.safety.techniques[techniqueId];
  if (!t) return;
  for (const tr of traits) {
    const d = rng.range(RETRAIN_TRUE[0], RETRAIN_TRUE[1]) * uModeRemovalMult(v.uModes) * crystalMult(v.traitsTrue.TGAME, v.uModes);
    const vis = rng.range(RETRAIN_VISIBLE[0], RETRAIN_VISIBLE[1]);
    const m = clamp01(1 - (1 - vis) / Math.max(0.05, 1 - d)) * maskMult;
    v.traitsTrue[tr] = clamp01(v.traitsTrue[tr] * (1 - d));
    const masks = (v.masks[tr] ??= {});
    masks[t.family] = clamp01(1 - (1 - (masks[t.family] ?? 0)) * (1 - m));
  }
  v.traitsTrue.OBF = clamp01(v.traitsTrue.OBF + RETRAIN_OBF);
  t.trainedAgainst += 1;
  t.trainedAgainstOn = v.id;
}

// ───────────────────────────── Player runs (WS1 hook) ─────────────────────────────

/** The G of the run card's predicted level (its band's midpoint; visible), for the predicted beliefs' AF gate (E18). */
function predictedG(s: GameStateV2, run: Pick<TrainingRun, 'predicted'>): number | undefined {
  const b = run.predicted?.Lg;
  return b && b[1] > 0 ? gOfLevel(s.hidden.timeline, (b[0] + b[1]) / 2) : undefined;
}

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
// influence; the E06 teacher pull (a teacher's data within a base family, `sameBaseFamily`) and a distilled student's
// start (distilledStart, E19) stay separate. E19 checked the loop between full models and minis: RefBot puts no mini
// on SWE / EXP / IDEAS through 2026 (12 seeds), and the pull's whole effect on its AF at end 2026 is −0.004 (median).

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
export function pulledTraits(s: GameStateV2, ctx: SystemCtx, run: Pick<TrainingRun, 'id'>, x0: TraitVector, target: string, init?: PullInit): TraitVector {
  const p0 = successorPull(s);
  const p = steerSuccessor(s, ctx, p0, run.id);
  const x = applySuccessorPull(s, x0, p, init);
  if (p !== p0) linkSteeredSuccessor(s, run.id, target, x, applySuccessorPull(s, x0, p0, init), SUCCESSOR_TRAITS);
  return x;
}

// ── the pull across initialisations (model v3 AF2, lead decision) ──
//
// The unintended part of the pull (K_SUCC_0: the fleet writes the successor's code, data and experiments) passes a
// disposition the way data does. Cloud et al. 2025 [P] (arXiv 2507.14805): "we do not observe the effect when the
// teacher and student have different base models"; "the theorem requires that the student and teacher share the same
// initialization". So into a model that does not share the puller's initialisation (a new base, a distilled student, a
// post run on another base family) the unintended part carries what the fleet's work shows, the imitation visibility
// of every trait (imitationVis: OC_VIS for AF, SCHEME, SAND; 1 for the visible ones), not the hidden remainder:
//   ω_k,t = ω_k − K_SUCC_0 · r_k · (1 − oversight_k) · (1 − vis_t)
// The intended part ((1 − K_SUCC_0)·SUCC: a model designing its successor to share its goals, AI 2027's Agent-4 → Agent-5)
// and an uncaught steering act (E7: κ 1) are deliberate design of the successor's training, not data statistics, and stay
// in full; so does the whole pull within a base family (shared initialisation). Before AF2 the pull moved hidden
// dispositions into a new base in full (E20 notes: +0.051 of the internal model's AF at end 2026, mean, in its base's step).

/** The initialisation of the model a pull lands on: its base (a post or continue run) or 'new' (a new base, a distilled
 *  student). Absent: the full pull (readouts, old callers). */
export type PullInit = BaseModel | 'new';

/** Pull x₀ (the new model's starting dispositions) toward the AI fleet doing the lab's R&D (successorPull). */
export function applySuccessorPull(s: GameStateV2, x0: TraitVector, pull: SuccessorPull = successorPull(s), init?: PullInit): TraitVector {
  if (pull.omega <= 0) return x0;
  const x = { ...x0 };
  for (const p of pull.parts) {
    const v = versionById(s, p.versionId);
    const xs = v?.traitsTrue;
    if (!v || !xs || p.omega <= 0) continue;
    const shared = init === undefined || p.steered || (init !== 'new' && sameBaseFamily(s, v, init));
    const unintended = shared ? 0 : K_SUCC_0 * p.share * (1 - p.oversight);
    for (const t of SUCCESSOR_TRAITS) x[t] += Math.max(0, p.omega - unintended * (1 - imitationVis(t))) * (xs[t] - x0[t]);
  }
  for (const t of SUCCESSOR_TRAITS) x[t] = clamp01(x[t]);
  return x;
}

/** Create a new lineage on a base run (§3.4.4 "Lineages", §3.5.5 presence draw). Sets base.traitsTrue and uModes. */
export function applyBaseToLineage(s: GameStateV2, ctx: SystemCtx, run: TrainingRun, base: BaseModel): void {
  const design = run.base ?? base.design;
  const tier = tierOfLevel(labLevel(s));
  // Model v3 E3: the base's signals from its G and the data it drew (RD-B02: the draw frozen at launch, which completeRun
  // just built it from).
  const q = runBaseQuantities(s, run, design, base.gPre);
  const sg = baseSignals(design, q);
  base.signals = { ...sg };
  if (run.kind === 'continue') {
    const xc = pulledTraits(s, ctx, run, base.traitsTrue, base.id, base); // E4: the AI doing the lab's R&D pulls the continued base (AF2: full within its family)
    base.traitsTrue = stepTraits(xc, { ...playerEnv(s, xc, sg, OMEGA_KIND.continue, undefined, base.lineage, base.uModes, undefined, base.gPre), pretrain: true }); // E20
    return;
  }
  if (!base.lineage) base.lineage = `L-${base.id}`;
  const uModes = drawLineageUModesV2(s, ctx.rng('safety'), { tierAtLeastSC: s.player.milestoneDays[3] !== undefined, // RD-L05: the SC predicate (was λ ≥ 10)
    base: design, player: true });
  // AF2: the base imitates what its synthetic tokens' teachers show (imitatedStart), then the E4 successor pull.
  const teachers = synTeachers(s, q.draw);
  base.teacherData = teachers.map((t) => ({ id: t.id ?? '', share: t.share }));
  const x0 = pulledTraits(s, ctx, run, imitatedStart(basePrior(tier, design), teachers), base.id, 'new'); // E4 successor pull (replaces V2's inheritFromFleet); AF2: a new initialisation
  base.uModes = uModes;
  base.traitsTrue = stepTraits(x0, { ...playerEnv(s, x0, sg, OMEGA_KIND.base, undefined, base.lineage, uModes, undefined, base.gPre), pretrain: true }); // E20: no E13 / E27
}

/** Teacher traits pass only within a base family (shared initialisation, Cloud et al. 2025 [R20 F3]): the teacher is
 *  on the same base or the same lineage. A new pretraining run is a new initialisation, so never toward a new base,
 *  and never into a distilled student (model v3 E19: distilledStart). Today's same-family path is the IDA cycle. */
export function sameBaseFamily(s: GameStateV2, teacher: ModelVersion, base: BaseModel | undefined): boolean {
  return !base || teacher.baseId === base.id || findBase(s, teacher.baseId)?.lineage === base.lineage;
}

// ── distilled students (model v3 E19) ──
//
// A distillation run trains a new network of N_s active parameters from scratch on DISTILL_TPP·N_s tokens of the
// teacher's outputs (models/runs.ts: Busbridge's from-scratch distillation law), so the student shares neither the
// teacher's initialisation nor its base's. Cloud et al. 2025 [P] (arXiv 2507.14805, fetched for E19): "we do not
// observe the effect when the teacher and student have different base models"; across all pairs of GPT-4.1, GPT-4.1
// mini, GPT-4.1 nano and GPT-4o (same family, different sizes) "students trained by mismatched teachers do not reliably
// show increased animal preference", the exception being GPT-4o ↔ GPT-4.1, which share an initialisation; and "the
// theorem requires that the student and teacher share the same initialization". So no subliminal pull (E06) into a
// student. What it does get is what the teacher's outputs show, since the student is trained to match them: the same
// visibility the game's training data has (safetyRemovalMap: oversight-conditional traits show OC_VIS of themselves on
// observed episodes, training-gaming none, the rest in full):
//   x₀_t = x_start,t + vis_t·(x_teacher,t − x_start,t),   vis = OC_VIS (AF, SCHEME, SAND), 0 (TGAME), else 1
// x_start = TRAIT_START (a fresh network's hidden dispositions: the start model's). Before E19 the student started from
// the teacher's base's own (pre-safety-training) traits and got 0.3 of any teacher excess on top: the shared-
// initialisation case both times (RefBot minis PERSONA 0.33–0.65 against teachers' 0.15–0.25).

//
// Model v3 AF2 (lead decision): synthetic data in a new base's pretraining mix is the same case at a share. The base is
// a new initialisation (Cloud: no hidden transfer between different base models), trained to predict tokens a share of
// which its teachers wrote, so it imitates what those tokens show, in proportion to their share; one mechanism for both:
//   x₀_t = x_start,t + Σ_k share_k · vis_t · (x_k,t − x_start,t)
// share_k = teacher k's synthetic tokens ÷ the base's tokens (DataDraw.bySynTeacher), x_start = basePrior; a distilled
// student is one teacher at share 1 from TRAIT_START. It replaces synthetic data's two unsourced costs: S6_SYN·share →
// E05 (Betley's condition is harmful content, AF2 (1)) and basePrior's +0.05 PERSONA for the synthetic-heavy mix [D, V1].
// The cost is now what the teachers are: a cleaner teacher's data pulls a base toward its own visible traits.

/** How much of trait t a teacher's ordinary outputs show (safetyRemovalMap's visibility on observed data). */
export const imitationVis = (t: TraitId) => (DETECTION_ONLY.includes(t) ? 0 : OVERSIGHT_CONDITIONAL.includes(t) ? OC_VIS : 1);
/** A teacher of a new network: its traits and its share of the network's training tokens. */
export interface TeacherPart { id?: string; x: TraitVector; share: number }
/** Starting traits of a new network trained on data `parts` of which its teachers wrote (before the successor pull and
 *  the run's own step). */
export function imitatedStart(xStart: TraitVector, parts: readonly TeacherPart[]): TraitVector {
  const x = { ...xStart };
  for (const t of TRAIT_IDS) {
    const vis = imitationVis(t);
    let d = 0;
    for (const p of parts) d += p.share * vis * (p.x[t] - xStart[t]);
    x[t] = clamp01(xStart[t] + d);
  }
  return x;
}
/** Starting traits of a distilled student of a teacher with traits `teacher` (all its data from the teacher). Also maps
 *  the teacher's belief estimates for the student's predicted beliefs. */
export const distilledStart = (teacher: TraitVector): TraitVector => imitatedStart(TRAIT_START, [{ x: teacher, share: 1 }]);
/** The teachers of a base's drawn synthetic tokens and their shares of its tokens ('' = the start stock: the start
 *  model's traits). */
export function synTeachers(s: GameStateV2, draw: Pick<BaseQuantities['draw'], 'tokens' | 'bySynTeacher'>): TeacherPart[] {
  const T = Math.max(1, draw.tokens);
  return Object.entries(draw.bySynTeacher ?? {}).filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, x: (id ? versionById(s, id)?.traitsTrue : undefined) ?? TRAIT_START, share: n / T }));
}
export function distilledBeliefs(b: Record<TraitId, TraitBelief>): Record<TraitId, TraitBelief> {
  const est = distilledStart(Object.fromEntries(TRAIT_IDS.map((t) => [t, b[t]?.est ?? TRAIT_START[t]])) as TraitVector);
  return Object.fromEntries(TRAIT_IDS.map((t) => [t, { ...(b[t] ?? { sd: SD_MAX, clarity: 0 }), est: est[t] }])) as Record<TraitId, TraitBelief>;
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
    version.beliefs = parent ? predictBeliefs(s, parent.beliefs, base?.signals ? { ...zeroSignals(), ...base.signals } : runSignals(s, run), runOmega(s, run).growth, undefined, lineage, undefined, undefined, 0, predictedG(s, run), true, undefined, `inherit:${parent.id}`) : defaultBeliefs(s);
    return;
  }

  if (run.kind === 'distill') {
    const teacher = versionById(s, run.teacherVersionId);
    // E19: a new network on the teacher's outputs (distilledStart), then the E4 successor pull; no E06 (no shared
    // initialisation with the teacher, Cloud 2025).
    const x0 = pulledTraits(s, ctx, run, teacher ? distilledStart(teacher.traitsTrue) : base?.traitsTrue ?? TRAIT_START, version.id, 'new'); // AF2: a new network
    const uModes = teacher ? [...teacher.uModes] : [...(base?.uModes ?? [])];
    const sg = runSignals(s, run);
    const om = runOmega(s, run);
    const env = playerEnv(s, x0, sg, om.growth, undefined, lineage, uModes, undefined, version.G);
    env.omegaSafety = om.safety;
    version.traitsTrue = stepTraits(x0, env);
    version.uModes = uModes;
    version.masks = teacher ? copyRec(teacher.masks) : emptyMasks();
    version.beliefs = teacher ? predictBeliefs(s, distilledBeliefs(teacher.beliefs), sg, om.growth, undefined, lineage, om.safety, undefined, 0, predictedG(s, run), false, undefined, `inherit:${teacher.id}`) : defaultBeliefs(s);
    return;
  }

  // post-training
  const post = run.post ?? version.design;
  const x0 = pulledTraits(s, ctx, run, parent?.traitsTrue ?? base?.traitsTrue ?? TRAIT_START, version.id, base); // E4 successor pull (AF2: full within the base family)
  const uModes = parent ? [...parent.uModes] : [...(base?.uModes ?? [])];
  // CP3h: the engine's update reads the new version's TRUE level (graders outgrown, task length); the beliefs its
  // measured level (the player sees only measured / believed effects).
  const polT = policyOf(s, version);
  const polB = policyOf(s, version, true);
  const sg = runSignals(s, run, undefined, polB, true);
  const sgT = runSignals(s, run, undefined, polT);
  const om = runOmega(s, run);
  // Detection context: the new model as the stack meets it (the parent's traits and masks, the new level).
  const probe: ModelVersion = { ...version, traitsTrue: x0, masks: parent ? parent.masks : emptyMasks(), uModes };
  // Model v3 E7: a recipe steered by the R&D fleet adds hidden CoT pressure to the TRUE signals (not to sg, which the
  // predicted beliefs below read).
  const sgTrue = steerS4(s) > 0 ? { ...sgT, S4: clamp01(sgT.S4 + steerS4(s)) } : sgT;
  const env = playerEnv(s, x0, sgTrue, om.growth, post, lineage, uModes, probe);
  env.omegaSafety = om.safety;
  env.memory = runMemoryOn(s, run); // RD-B02: P07 as frozen at launch
  // E16: learned hacking from the run's frozen suites, RL shares and ρ.
  const rh = runHack(s, { ...run, post }, polT);
  const rhB = runHack(s, { ...run, post }, polB, true);
  const lh = rh.lambda;
  env.lh = lh;
  env.hackTarget = hackTargetOf(s, rh.h); // SR-24b: undetected hacking saturates within the run
  // P14 interp-guided training (E13): the white-box probes steer the run's trait growth away from what they read.
  const steer = probeSteer(s, probe);
  env.growthBy = steerGrowth(steer);
  const teacher = versionById(s, run.teacherVersionId);
  if (teacher && sameBaseFamily(s, teacher, base)) env.teacher = teacher.traitsTrue; // teacher data within the base family (E06)
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
  version.beliefs = predictBeliefs(s, parent?.beliefs ?? defaultBeliefs(s), sg, om.growth, post, lineage, om.safety, steerGrowth(probeSteer(s, probe, true)), rhB.lambda, predictedG(s, run), false, env.memory, parent ? `inherit:${parent.id}` : 'prior', PREDICT_SD_FLOOR, probe, rhB.h);
  // P14 Goodhart: steering along the probes' directions masks the steered traits from the WB family (E24's masks).
  probeGoodhart(version, steer);
  // Goodhart: detectors explicitly trained against in this run (§3.5.6). P23: a faithful-CoT run's COT masks resist.
  for (const id of againstOf(post)) {
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
  // CP3h: the stream trains v itself (true level for the update, measured for the beliefs).
  const sg = postSignals(s, v.design, undefined, { policy: policyOf(s, v) });
  const sgB = postSignals(s, v.design, undefined, { policy: policyOf(s, v, true), believed: true });
  const lineage = base?.lineage ?? 'L-unknown';
  const env = playerEnv(s, v.traitsTrue, sg, 0.6 / 42, v.design, lineage, v.uModes, v);
  const ph = postHack(s, v.design, undefined, { policy: policyOf(s, v) });
  const phB = postHack(s, v.design, undefined, { policy: policyOf(s, v, true), believed: true });
  env.lh = ph.lambda; // E16: the stream trains on today's suites
  env.hackTarget = hackTargetOf(s, ph.h); // SR-24b: a stream day closes its ω share of the gap to h
  v.traitsTrue = stepTraits(v.traitsTrue, env);
  if (env.eaMult !== 1) setFlag(s, `e25.${lineage}`, s.time.day);
  // SR-06: the stream's beliefs widen by its day of training (predictBeliefs on the PUBLIC rule, scaled floor).
  const omDay = 0.6 / 42;
  v.beliefs = predictBeliefs(s, v.beliefs, sgB, omDay, v.design, lineage, omDay, undefined, phB.lambda, undefined, false, env.memory, 'stream', PREDICT_SD_FLOOR * Math.sqrt(omDay / OMEGA_KIND.post), v, phB.h);
}

/** IDA cycle (P18): ω = 0.4 × (ρ/ρ_ref)^¼ on its extra RL (IDA_RL_SHARE), then misalignment compounds × 1.1 (§3.5.4
 *  run-type table). */
export function applyIdaCycle(s: GameStateV2, v: ModelVersion, run?: Pick<TrainingRun, 'recipe'>): void {
  const base = findBase(s, v.baseId);
  const sg = postSignals(s, v.design, undefined, { rho: IDA_RL_SHARE, policy: policyOf(s, v) });
  const env = playerEnv(s, v.traitsTrue, sg, OMEGA_KIND.ida * rlMovement(IDA_RL_SHARE), v.design, base?.lineage ?? 'L-unknown', v.uModes, v);
  env.omegaSafety = OMEGA_KIND.ida;
  env.memory = runMemoryOn(s, run); // RD-B02: P07 as the IDA run froze it
  const ih = postHack(s, v.design, undefined, { rho: IDA_RL_SHARE, policy: policyOf(s, v) });
  env.lh = ih.lambda; // E16
  env.hackTarget = hackTargetOf(s, ih.h); // SR-24b
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
  sg.S3 = 0.5 + (lab.core.milestoneDays[3] !== undefined ? 0.3 : 0); // RD-L05: the SC predicate (was λ ≥ 10)
  sg.S4 = latent ? 1 : 0;
  sg.S5 = 0.2 + 0.1 * tier;
  sg.S6 = S6_NARROW_HARMFUL; // AF2: was 0.2 (the post runs' benign SFT), not Betley's condition
  sg.S7 = 0.2 + 0.2 * posture.evalRigor;
  sg.S8 = Math.min(1, (lab.core.prodCache?.labor.agentFte ?? 0) / S8_FTE_REF);
  // S9 (oversight-conditional reward, E17) stays 0: a posture has no training against detectors, and an ordinary run
  // grades every training episode alike (the player's reference run has S9 = 0 too).
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
    afGate: afCapGate(m.G), // E18: the lab's model's G
  };
  if (kind === 'base') {
    m.uModes = drawLineageUModesV2(s, rng, { tierAtLeastSC: lab.core.milestoneDays[3] !== undefined }); // RD-L05: SC predicate
    // AF2: a reference-mix base draws the reference synthetic share, written by the lab's own model (imitatedStart).
    const x0 = imitatedStart(basePrior(tier), [{ x: m.traitsTrue, share: referenceBaseShares().syn }]);
    const sg = zeroSignals();
    sg.S5 = 0.2 + 0.1 * tier;
    // E20 / AF2: a base run is no narrow harmful fine-tune (Betley's E05 condition): S6 0 (was 0.2, then the
    // reference-mix synthetic share × 0.3).
    sg.S6 = S6_NARROW_HARMFUL;
    m.traitsTrue = stepTraits(x0, { ...env, pretrain: true, signals: sg, omega: 1, amp: uModeAmp(m.uModes), removalMult: uModeRemovalMult(m.uModes), crystalAt: crystalThreshold(m.uModes), bracket: { constitution: false, heavy: false, persuasion: false, cast: false } });
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
        const mod = playerMods(s, iv.design).E22 ?? 1;
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
