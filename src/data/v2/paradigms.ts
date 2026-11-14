// Paradigm research projects P01–P27 (V2-SPEC §3.3.3, research/12 §0.7). Owner: WS1.
// effortDays = days at 30 FTE + 2% of the experiment pool; prior = P(success), drawn hidden at newGame (§2.3 step 5).
// Gates: tier gates are MEASURED-level milestones (T1 always, T2 L ≥ 6.5, T3 L ≥ 8.5, T4 L ≥ 12) plus the extra
// per-project conditions from the spec table. `effect` / `safetyCost` are display text (Codex); the engine applies
// effects in models/paradigms.ts and the consuming systems.
import type { AgendaId, DomainId } from '../../engine/v2/types';

export interface ParadigmGate {
  /** Minimum measured general level. */
  minL?: number;
  /** Paradigms that must be adopted (or 'partial' progress ≥ 0.5 when listed in `partial`). */
  requires?: string[];
  partial?: string[];
  /** A finished base with multimodal data. */
  multimodalBase?: boolean;
  /** Cash on hand ($B). */
  cash?: number;
  /** Safety agenda that must have produced a TECH finding (WS2 findings). */
  agendaTech?: AgendaId;
  /** Measured domain level of the best version. */
  domain?: { id: DomainId; min: number };
  /** Agent inference pool (H100e). */
  inference?: number;
  /** Milestone the lab must have crossed (truth: 'SAR' = idx 4) — used for T4 P24. */
  milestone?: number;
}

export interface ParadigmDef {
  id: string; name: string; tier: 1 | 2 | 3 | 4; effortDays: number; prior: number;
  gate?: string; // display text
  g?: ParadigmGate;
  effect?: string;
  safetyCost?: string;
}

export const TIER_MIN_L: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 6.5, 3: 8.5, 4: 12 };

export const PARADIGMS: ParadigmDef[] = [
  { id: 'P01', name: 'Reasoning RL', tier: 1, effortDays: 0, prior: 1, effect: 'baseline' },
  { id: 'P02', name: 'Agentic environments', tier: 1, effortDays: 0, prior: 1, effect: 'baseline' },
  { id: 'P03', name: 'Test-time compute', tier: 1, effortDays: 0, prior: 1, effect: 'baseline' },
  { id: 'P04', name: 'Distillation', tier: 1, effortDays: 0, prior: 1, effect: 'baseline' },
  { id: 'P05', name: 'Orchestrated multi-agent', tier: 1, effortDays: 60, prior: 0.95, effect: 'Agent throughput ×1.3; deep-think effort', safetyCost: 'S8 +0.2' },
  { id: 'P06', name: 'Computer use', tier: 1, effortDays: 90, prior: 0.9, gate: 'multimodal base', g: { multimodalBase: true }, effect: 'computerUse RL family; Desktop bench', safetyCost: 'overreach' },
  { id: 'P07', name: 'Long context + memory', tier: 1, effortDays: 60, prior: 0.9, effect: 'h80 ×1.5', safetyCost: 'S8 +0.1 (memory)' },
  { id: 'P08', name: 'Continual learning', tier: 2, effortDays: 150, prior: 0.7, gate: 'L ≥ 7', g: { minL: 7 }, effect: 'Stream runs (κ = 1, 7-day lag)', safetyCost: 'evals stale; drift; U14 risk ↑' },
  { id: 'P09', name: 'Test-time training', tier: 2, effortDays: 120, prior: 0.6, effect: '+0.6 L REASON', safetyCost: 'audit coverage −10%' },
  { id: 'P10', name: 'Synthetic data flywheel', tier: 2, effortDays: 120, prior: 0.8, effect: 'No data wall; synthetic data ×3', safetyCost: 'U01 ×1.5' },
  { id: 'P11', name: 'Self-play curricula', tier: 2, effortDays: 180, prior: 0.6, gate: 'L ≥ 7.5', g: { minL: 7.5 }, effect: 'REASON +0.8, CODE +0.4', safetyCost: 'S2 +0.2 (verifier hacking)' },
  { id: 'P12', name: 'Long-horizon human demos', tier: 2, effortDays: 180, prior: 0.85, gate: '$1B+ cash', g: { cash: 1 }, effect: 'h80 ×2; RSCH +0.4' },
  { id: 'P13', name: 'Automated AI research agents', tier: 2, effortDays: 150, prior: 0.75, gate: 'RSCH ≥ 8.5', g: { domain: { id: 'RSCH', min: 8.5 } }, effect: 'Experiment throughput ×1.5', safetyCost: 'U17 ↑; SAND' },
  { id: 'P14', name: 'Interp-guided training', tier: 2, effortDays: 120, prior: 0.6, gate: 'AG02 TECH', g: { agendaTech: 'AG02' }, effect: 'In-run trait cap ×0.6', safetyCost: 'Goodhart on the detector' },
  { id: 'P15', name: 'AI-assisted oversight', tier: 2, effortDays: 120, prior: 0.6, gate: 'P13 partial', g: { partial: ['P13'] }, effect: 'Hardened graders at the cheap price', safetyCost: 'U19 collusion' },
  { id: 'P16', name: 'AI kernels / HW co-design', tier: 2, effortDays: 90, prior: 0.8, gate: 'P13', g: { requires: ['P13'] }, effect: 'Serve ×0.75; training FLOP ×1.15' },
  { id: 'P17', name: 'Neuralese recurrence', tier: 3, effortDays: 120, prior: 0.7, gate: 'L ≥ 9.5', g: { minL: 9.5 }, effect: 'Latent base shape (+0.4 y, serve 0.2)', safetyCost: 'CoT monitoring dies (λ2 −2)' },
  { id: 'P18', name: 'Iterated distillation & amplification', tier: 3, effortDays: 120, prior: 0.65, gate: 'P05, P04', g: { requires: ['P05', 'P04'] }, effect: '+0.25 y per 21-day cycle', safetyCost: 'traits ×1.1 per cycle' },
  { id: 'P19', name: 'Learned research taste', tier: 3, effortDays: 150, prior: 0.6, gate: 'P13', g: { requires: ['P13'] }, effect: 'Removes the RSCH −0.5 penalty', safetyCost: 'AI sets research direction' },
  { id: 'P20', name: 'Massive agent societies', tier: 3, effortDays: 90, prior: 0.8, gate: 'inference ≥ 2M H100e', g: { inference: 2e6 }, effect: 'Agents pool cap lifted', safetyCost: 'S8 = 1; collusion' },
  { id: 'P21', name: 'Brain-like sample efficiency', tier: 3, effortDays: 210, prior: 0.45, gate: 'P08, P19', g: { requires: ['P08', 'P19'] }, effect: 'PHYS +1', safetyCost: 'evals lag' },
  { id: 'P22', name: 'Robotics foundation models', tier: 3, effortDays: 180, prior: 0.6, gate: 'multimodal', g: { multimodalBase: true }, effect: 'PHYS +2; robotics tech progress', safetyCost: 'physical reach' },
  { id: 'P23', name: 'Faithful-CoT architecture', tier: 3, effortDays: 120, prior: 0.75, gate: 'AG09 TECH', g: { agendaTech: 'AG09' }, effect: 'Faithful CoT option', safetyCost: '−0.24 y tax' },
  { id: 'P24', name: 'AI-designed successor', tier: 4, effortDays: 120, prior: 0.6, gate: 'SAR', g: { milestone: 4 }, effect: 'Next base +0.8 y; new lineage', safetyCost: 'techniques may not transfer' },
  { id: 'P25', name: 'Formal verification at scale', tier: 4, effortDays: 150, prior: 0.5, gate: 'P11', g: { requires: ['P11'] }, effect: 'Security +0.5; AG10 floor' },
  { id: 'P26', name: 'Superhuman persuasion', tier: 4, effortDays: 60, prior: 0.8, gate: 'SOCIAL ≥ 12', g: { domain: { id: 'SOCIAL', min: 12 } }, effect: 'Relation actions ×1.5', safetyCost: 'manipulation' },
  { id: 'P27', name: 'Automated alignment research', tier: 4, effortDays: 120, prior: 0.7, gate: 'P13 + AG17', g: { requires: ['P13'], agendaTech: 'AG17' }, effect: 'Agenda speed × (1 + 3·aiLabour)', safetyCost: 'FALSE findings ∝ hidden SAND' },
];

/** Domain offsets (L) granted to new versions once a paradigm is adopted (§3.3.3). */
export const PARADIGM_DOMAIN_OFF: Record<string, Partial<Record<DomainId, number>>> = {
  P09: { REASON: 0.6 },
  P11: { REASON: 0.8, CODE: 0.4 },
  P12: { RSCH: 0.4 },
  P21: { PHYS: 1 },
  P22: { PHYS: 2 },
};

/** Reference staffing of a project: 30 FTE + 2% of the experiment pool (§3.3.3). */
export const PARADIGM_REF_FTE = 30;
export const PARADIGM_REF_EXP = 0.02;
export const PARADIGM_RETRY_DAYS = 180;
