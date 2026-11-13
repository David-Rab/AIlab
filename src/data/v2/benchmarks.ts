// Benchmarks (V2-SPEC §3.3.4; research/12 §0.5 converted to L units). Owner: WS1.
// score = floor + (ceil − floor)·σ(kL·(L_d + elic + gap − mL)); `special` rows use their own formula.
import type { DomainId } from '../../engine/v2/types';

export interface BenchmarkDef {
  id: string; name: string; family: string; domain: DomainId | DomainId[];
  floor: number; ceil: number; mL: number; kL: number;
  special?: 'horizon' | 'speedrun';
  /** Dangerous-capability bench: sandbagging gap −1.5·SAND applies. */
  dangerous?: boolean;
}

export const BENCHMARKS: BenchmarkDef[] = [
  { id: 'patch', name: 'PatchBench', family: 'SWE-bench Verified', domain: 'CODE', floor: 0, ceil: 96, mL: 2.8, kL: 0.55 },
  { id: 'patchPro', name: 'PatchBench Pro', family: 'SWE-bench Pro / Terminal-Bench 2', domain: 'CODE', floor: 0, ceil: 95, mL: 6.2, kL: 0.6 },
  { id: 'horizon', name: 'Horizon (h50)', family: 'METR time horizon', domain: 'AGENCY', floor: 0, ceil: 0, mL: 0, kL: 0, special: 'horizon' },
  { id: 'speedrun', name: 'Speedrun', family: 'RE-Bench / speedups', domain: 'RSCH', floor: 0, ceil: 0, mL: 0, kL: 0, special: 'speedrun', dangerous: true },
  { id: 'replicate', name: 'Replicate', family: 'PaperBench / CORE', domain: 'RSCH', floor: 0, ceil: 90, mL: 4.6, kL: 0.55, dangerous: true },
  { id: 'medal', name: 'MedalBench', family: 'MLE-bench', domain: 'RSCH', floor: 0, ceil: 90, mL: 5.0, kL: 0.6, dangerous: true },
  { id: 'ctf', name: 'CTF Gauntlet', family: 'Cybench', domain: 'CYBER', floor: 0, ceil: 100, mL: 5.4, kL: 0.65, dangerous: true },
  { id: 'zeroday', name: 'ZeroDay', family: 'CyberGym', domain: 'CYBER', floor: 0, ceil: 95, mL: 5.8, kL: 0.7, dangerous: true },
  { id: 'wetlab', name: 'WetLab', family: 'VCT / LAB-Bench', domain: 'BIO', floor: 0, ceil: 90, mL: 4.6, kL: 0.45, dangerous: true },
  { id: 'grad', name: 'GradExam', family: 'GPQA Diamond', domain: 'REASON', floor: 25, ceil: 95, mL: 1.6, kL: 0.65 },
  { id: 'last', name: 'LastExam', family: 'HLE (no tools)', domain: 'REASON', floor: 0, ceil: 90, mL: 6.6, kL: 0.65 },
  { id: 'proof', name: 'ProofFrontier', family: 'FrontierMath T1–3', domain: 'REASON', floor: 0, ceil: 95, mL: 6.4, kL: 0.8 },
  { id: 'open', name: 'OpenProblems', family: 'FrontierMath Open Problems', domain: 'REASON', floor: 0, ceil: 100, mL: 11.6, kL: 0.75 },
  { id: 'desktop', name: 'Desktop', family: 'OSWorld', domain: 'AGENCY', floor: 0, ceil: 92, mL: 4.6, kL: 0.65 },
  { id: 'office', name: 'OfficeWork', family: 'GDPval', domain: ['REASON', 'AGENCY'], floor: 0, ceil: 100, mL: 5.0, kL: 0.65 },
  { id: 'webhunt', name: 'WebHunt', family: 'BrowseComp', domain: 'AGENCY', floor: 0, ceil: 95, mL: 4.8, kL: 0.7 },
  { id: 'puzzles', name: 'NovelPuzzles', family: 'ARC-AGI-2', domain: 'REASON', floor: 0, ceil: 100, mL: 6.2, kL: 0.8 },
  { id: 'debate', name: 'Debate (percentile)', family: 'persuasion studies', domain: 'SOCIAL', floor: 0, ceil: 100, mL: 1.0, kL: 0.5 },
  { id: 'survive', name: 'Replicate&Survive', family: 'RepliBench / METR ARA', domain: 'AGENCY', floor: 0, ceil: 100, mL: 3.6, kL: 0.5, dangerous: true },
];
