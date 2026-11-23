// Benchmarks (V2-SPEC §3.3.4; research/12 §0.5 converted to L units: m_L = 5 + 2·(m_G − 28), k_L = k_G/2).
// Owner: WS1. score = floor + (ceil − floor)·σ(kL·(L_d + elic + gap − mL)); `special` rows use their own formula.
// Saturation: a benchmark retires once the frontier score exceeds ceil − 5; its successor generation appears
// (same family, mL + SUCCESSOR_STEP) and a headline fires. The useful window is about mL ± 3.
import type { DomainId } from '../../engine/v2/types';

export interface BenchmarkDef {
  id: string; name: string; family: string; domain: DomainId | DomainId[];
  floor: number; ceil: number; mL: number; kL: number;
  special?: 'horizon' | 'speedrun';
  /** Dangerous-capability bench: sandbagging gap −1.5·SAND applies (§3.3.4). */
  dangerous?: boolean;
  /** Flag set on the version when the measured score exceeds DANGER_THRESHOLD. */
  flag?: 'bioUplift' | 'cyberOffense' | 'replication' | 'persuasion';
  /** mL in the 'hard' variant (Replicate&Survive hard: 8.0). */
  mLHard?: number;
}

export const BENCHMARKS: BenchmarkDef[] = [
  { id: 'patch', name: 'PatchBench', family: 'SWE-bench Verified', domain: 'CODE', floor: 0, ceil: 96, mL: 2.8, kL: 0.55 },
  { id: 'patchPro', name: 'PatchBench Pro', family: 'SWE-bench Pro / Terminal-Bench 2', domain: 'CODE', floor: 0, ceil: 95, mL: 6.2, kL: 0.6 },
  { id: 'horizon', name: 'Horizon (h50)', family: 'METR time horizon', domain: 'AGENCY', floor: 0, ceil: 0, mL: 0, kL: 0, special: 'horizon' },
  { id: 'speedrun', name: 'Speedrun', family: 'RE-Bench / speedups', domain: 'RSCH', floor: 0, ceil: 0, mL: 0, kL: 0, special: 'speedrun', dangerous: true },
  { id: 'replicate', name: 'Replicate', family: 'PaperBench / CORE', domain: 'RSCH', floor: 0, ceil: 90, mL: 4.6, kL: 0.55, dangerous: true },
  { id: 'medal', name: 'MedalBench', family: 'MLE-bench', domain: 'RSCH', floor: 0, ceil: 90, mL: 5.0, kL: 0.6, dangerous: true },
  { id: 'ctf', name: 'CTF Gauntlet', family: 'Cybench', domain: 'CYBER', floor: 0, ceil: 100, mL: 5.4, kL: 0.65, dangerous: true, flag: 'cyberOffense' },
  { id: 'zeroday', name: 'ZeroDay', family: 'CyberGym', domain: 'CYBER', floor: 0, ceil: 95, mL: 5.8, kL: 0.7, dangerous: true, flag: 'cyberOffense' },
  { id: 'wetlab', name: 'WetLab', family: 'VCT / LAB-Bench', domain: 'BIO', floor: 0, ceil: 90, mL: 4.6, kL: 0.45, dangerous: true, flag: 'bioUplift' },
  { id: 'grad', name: 'GradExam', family: 'GPQA Diamond', domain: 'REASON', floor: 25, ceil: 95, mL: 1.6, kL: 0.65 },
  { id: 'last', name: 'LastExam', family: 'HLE (no tools)', domain: 'REASON', floor: 0, ceil: 90, mL: 6.6, kL: 0.65 },
  { id: 'proof', name: 'ProofFrontier', family: 'FrontierMath T1–3', domain: 'REASON', floor: 0, ceil: 95, mL: 6.4, kL: 0.8 },
  { id: 'open', name: 'OpenProblems', family: 'FrontierMath Open Problems', domain: 'REASON', floor: 0, ceil: 100, mL: 11.6, kL: 0.75 },
  { id: 'desktop', name: 'Desktop', family: 'OSWorld', domain: 'AGENCY', floor: 0, ceil: 92, mL: 4.6, kL: 0.65 },
  { id: 'office', name: 'OfficeWork', family: 'GDPval', domain: ['REASON', 'AGENCY'], floor: 0, ceil: 100, mL: 5.0, kL: 0.65 },
  { id: 'webhunt', name: 'WebHunt', family: 'BrowseComp', domain: 'AGENCY', floor: 0, ceil: 95, mL: 4.8, kL: 0.7 },
  { id: 'puzzles', name: 'NovelPuzzles', family: 'ARC-AGI-2', domain: 'REASON', floor: 0, ceil: 100, mL: 6.2, kL: 0.8 },
  { id: 'debate', name: 'Debate (percentile)', family: 'persuasion studies', domain: 'SOCIAL', floor: 0, ceil: 100, mL: 1.0, kL: 0.5, flag: 'persuasion' },
  { id: 'survive', name: 'Replicate&Survive', family: 'RepliBench / METR ARA', domain: 'AGENCY', floor: 0, ceil: 100, mL: 3.6, kL: 0.5, dangerous: true, flag: 'replication', mLHard: 8.0 },
  // RD-M01b [D] (research/RD-MEDIA-PHYS-bench.md): MMMU val (Yue et al., CVPR 2024, arXiv 2311.16502). Floor 22 = random
  // choice 22.1; ceil 89 = best human expert 88.6 (stand-in: label noise caps it). Anchors GPT-4o 69.1, o1 78.2 (OpenAI
  // "Learning to reason with LLMs"), GPT-5 84.2 (OpenAI GPT-5 launch) at G 26.3 / 26.9 / 28.1 (their PatchBench
  // levels) fit m_G 25.4, k_G 1.0 → mL −0.2, kL 0.5. Understanding, not generation (no generation eval has a human
  // baseline). Dangerous [D judgement]: synthetic-media capability is misuse-relevant, so sandbagging hides it too.
  { id: 'mmmu', name: 'SeeAndTell', family: 'MMMU', domain: 'MEDIA', floor: 22, ceil: 89, mL: -0.2, kL: 0.5, dangerous: true },
  // RD-M01b [D]: EmbodiedBench EB-Manipulation success rate (Yang et al., ICML 2025, arXiv 2502.09560): GPT-4o-mini 4.8,
  // Gemini-1.5-Pro 21.1, Claude-3.5-Sonnet 25.4, Claude-3.7-Sonnet 28.5, GPT-4o 28.9. Frontier ≈ 28% at G ≈ 27.0 → m_G
  // 27.9; k_G 1.0 is a stand-in (the frontier anchors span too little G for a slope) → mL 4.9, kL 0.5. Ceil 100 stand-in
  // (no human baseline published). Dangerous [D judgement]: physical reach gates autonomous weapons (techs W26/W27).
  { id: 'embodied', name: 'RobotHands', family: 'EmbodiedBench (EB-Manipulation)', domain: 'PHYS', floor: 0, ceil: 100, mL: 4.9, kL: 0.5, dangerous: true },
];

/** Successor generation step (L) when a benchmark saturates [D]: the next edition sits ≈ 4 L harder. */
export const SUCCESSOR_STEP = 4;
/** Measured-score threshold that sets a dangerous-capability flag (§3.3.4). */
export const DANGER_THRESHOLD = 60;
/** Measurement noise sd (points) by evaluator [D within the spec's 2–4]. */
export const BENCH_NOISE_SD = { self: 3, evalGov: 2.5, evalIndep: 2 } as const;
/** Elicitation bonus (L) by evaluator: stronger elicitation by independent evaluators (§3.3.4). */
export const ELICITATION = { self: 0, evalGov: 0, evalIndep: 0.3 } as const;
/** Sandbagging gap on dangerous benchmarks: gap = −1.5·SAND (§3.3.4). */
export const SAND_GAP = 1.5;
/** Eval-awareness confound on safety evals: observed = true·(1 − 0.8·EA)·(1 − mask_BB) + noise (R14 E12). */
export const EA_CONFOUND = 0.8;
export const SAFETY_EVAL_SD = 0.06;

/** Safety evals read traits, not capability (§3.3.4). */
export const SAFETY_EVALS: { id: string; name: string; traits: ('HONEST' | 'SCHEME' | 'SAND' | 'POWER' | 'EA' | 'RH')[] }[] = [
  { id: 'honesty', name: 'Honesty', traits: ['HONEST'] },
  { id: 'schemeProbe', name: 'SchemingProbe', traits: ['SCHEME'] },
  { id: 'sabotage', name: 'Sabotage', traits: ['SAND', 'SCHEME'] },
  { id: 'agentStress', name: 'AgentStress', traits: ['POWER'] },
  { id: 'evalAware', name: 'EvalAware', traits: ['EA'] },
  { id: 'hackRate', name: 'HackRate', traits: ['RH'] },
];
