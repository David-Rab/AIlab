// Paradigms P01–P27 (V2-SPEC §3.3.3, research/12 §0.7). Owner: WS1.
// Since R4 they are nodes of the tech tree (data/v2/tree.ts): no tiers, no measured-level gates, no FTE staffing.
// prior = P(success) of the first attempt, drawn hidden at newGame (§2.3 step 5). effect / safetyCost are display
// text; the engine applies effects in the consuming systems (readers check adopted()).
import type { DomainId } from '../../engine/v2/types';

export interface ParadigmDef {
  id: string; name: string;
  /** P(success) of the first attempt, drawn hidden at newGame (world stream, PARADIGMS order: keep it). */
  prior: number;
  effect?: string;
  safetyCost?: string;
}

export const PARADIGMS: ParadigmDef[] = [
  { id: 'P01', name: 'Reasoning RL', prior: 1, effect: 'baseline' },
  { id: 'P02', name: 'Agentic environments', prior: 1, effect: 'baseline' },
  { id: 'P03', name: 'Test-time compute', prior: 1, effect: 'baseline' },
  { id: 'P04', name: 'Distillation', prior: 1, effect: 'baseline' },
  { id: 'P05', name: 'Orchestrated multi-agent', prior: 0.95, effect: 'Agent throughput ×1.3; deep-think effort', safetyCost: 'S8 +0.2' },
  { id: 'P06', name: 'Computer use', prior: 0.9, effect: 'computerUse RL family; Desktop bench', safetyCost: 'overreach' },
  { id: 'P07', name: 'Long context + memory', prior: 0.9, effect: 'h80 ×1.5', safetyCost: 'S8 +0.1 (memory)' },
  { id: 'P08', name: 'Continual learning', prior: 0.7, effect: 'Stream runs (κ = 1, 7-day lag)', safetyCost: 'evals stale; drift; U14 risk ↑' },
  { id: 'P09', name: 'Test-time training', prior: 0.6, effect: '+0.6 L REASON', safetyCost: 'audit coverage −10%' },
  { id: 'P10', name: 'Synthetic data flywheel', prior: 0.8, effect: 'No data wall; synthetic data ×3', safetyCost: 'U01 ×1.5' },
  { id: 'P11', name: 'Self-play curricula', prior: 0.6, effect: 'REASON +0.8, CODE +0.4', safetyCost: 'S2 +0.2 (verifier hacking)' },
  { id: 'P12', name: 'Long-horizon human demos', prior: 0.85, effect: 'h80 ×2; RSCH +0.4' },
  { id: 'P13', name: 'Automated AI research agents', prior: 0.75, effect: 'Experiment throughput ×1.5', safetyCost: 'U17 ↑; SAND' },
  { id: 'P14', name: 'Interp-guided training', prior: 0.6, effect: 'In-run trait cap ×0.6', safetyCost: 'Goodhart on the detector' },
  { id: 'P15', name: 'AI-assisted oversight', prior: 0.6, effect: 'Hardened graders at the cheap price', safetyCost: 'U19 collusion' },
  { id: 'P16', name: 'AI kernels / HW co-design', prior: 0.8, effect: 'Serve ×0.75; training FLOP ×1.15' },
  { id: 'P17', name: 'Neuralese recurrence', prior: 0.7, effect: 'Latent base shape (+0.4 y, serve 0.2)', safetyCost: 'CoT monitoring dies (λ2 −2)' },
  { id: 'P18', name: 'Iterated distillation & amplification', prior: 0.65, effect: '+0.25 y per 21-day cycle', safetyCost: 'traits ×1.1 per cycle' },
  { id: 'P19', name: 'Learned research taste', prior: 0.6, effect: 'Removes the RSCH −0.5 penalty', safetyCost: 'AI sets research direction' },
  { id: 'P20', name: 'Massive agent societies', prior: 0.8, effect: 'Agent throughput ×1.1', safetyCost: 'S8 = 1; collusion' },
  { id: 'P21', name: 'Brain-like sample efficiency', prior: 0.45, effect: 'PHYS +1', safetyCost: 'evals lag' },
  { id: 'P22', name: 'Robotics foundation models', prior: 0.6, effect: 'PHYS +2; robotics tech progress', safetyCost: 'physical reach' },
  { id: 'P23', name: 'Faithful-CoT architecture', prior: 0.75, effect: 'Faithful CoT option', safetyCost: '−0.24 y tax' },
  { id: 'P24', name: 'AI-designed successor', prior: 0.6, effect: 'Next base +0.8 y; new lineage', safetyCost: 'techniques may not transfer' },
  { id: 'P25', name: 'Formal verification at scale', prior: 0.5, effect: 'Security +0.5; AG10 floor' },
  { id: 'P26', name: 'Superhuman persuasion', prior: 0.8, effect: 'Relation actions ×1.5', safetyCost: 'manipulation' },
  { id: 'P27', name: 'Automated alignment research', prior: 0.7, effect: 'Agenda speed × (1 + 3·aiLabour)', safetyCost: 'FALSE findings ∝ hidden SAND' },
];

/** Domain offsets (L) granted to new versions once a paradigm is adopted (§3.3.3). */
export const PARADIGM_DOMAIN_OFF: Record<string, Partial<Record<DomainId, number>>> = {
  P09: { REASON: 0.6 },
  P11: { REASON: 0.8, CODE: 0.4 },
  P12: { RSCH: 0.4 },
  P21: { PHYS: 1 },
  P22: { PHYS: 2 },
};

