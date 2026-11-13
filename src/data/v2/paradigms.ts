// Paradigm research projects P01–P27 (V2-SPEC §3.3.3, research/12 §0.7). Owner: WS1.
// effortDays = days at 30 FTE + 2% of the experiment pool; prior = P(success), drawn hidden at newGame (§2.3 step 5).
export interface ParadigmDef { id: string; name: string; tier: 1 | 2 | 3 | 4; effortDays: number; prior: number; gate?: string }

export const PARADIGMS: ParadigmDef[] = [
  { id: 'P01', name: 'Reasoning RL', tier: 1, effortDays: 0, prior: 1 },
  { id: 'P02', name: 'Agentic environments', tier: 1, effortDays: 0, prior: 1 },
  { id: 'P03', name: 'Test-time compute', tier: 1, effortDays: 0, prior: 1 },
  { id: 'P04', name: 'Distillation', tier: 1, effortDays: 0, prior: 1 },
  { id: 'P05', name: 'Orchestrated multi-agent', tier: 1, effortDays: 60, prior: 0.95 },
  { id: 'P06', name: 'Computer use', tier: 1, effortDays: 90, prior: 0.9, gate: 'multimodal base' },
  { id: 'P07', name: 'Long context + memory', tier: 1, effortDays: 60, prior: 0.9 },
  { id: 'P08', name: 'Continual learning', tier: 2, effortDays: 150, prior: 0.7, gate: 'L ≥ 7' },
  { id: 'P09', name: 'Test-time training', tier: 2, effortDays: 120, prior: 0.6 },
  { id: 'P10', name: 'Synthetic data flywheel', tier: 2, effortDays: 120, prior: 0.8 },
  { id: 'P11', name: 'Self-play curricula', tier: 2, effortDays: 180, prior: 0.6, gate: 'L ≥ 7.5' },
  { id: 'P12', name: 'Long-horizon human demos', tier: 2, effortDays: 180, prior: 0.85, gate: '$1B+ cash' },
  { id: 'P13', name: 'Automated AI research agents', tier: 2, effortDays: 150, prior: 0.75, gate: 'RSCH ≥ 8.5' },
  { id: 'P14', name: 'Interp-guided training', tier: 2, effortDays: 120, prior: 0.6, gate: 'AG02 TECH' },
  { id: 'P15', name: 'AI-assisted oversight', tier: 2, effortDays: 120, prior: 0.6, gate: 'P13 partial' },
  { id: 'P16', name: 'AI kernels / HW co-design', tier: 2, effortDays: 90, prior: 0.8, gate: 'P13' },
  { id: 'P17', name: 'Neuralese recurrence', tier: 3, effortDays: 120, prior: 0.7, gate: 'L ≥ 9.5' },
  { id: 'P18', name: 'Iterated distillation & amplification', tier: 3, effortDays: 120, prior: 0.65, gate: 'P05, P04' },
  { id: 'P19', name: 'Learned research taste', tier: 3, effortDays: 150, prior: 0.6, gate: 'P13' },
  { id: 'P20', name: 'Massive agent societies', tier: 3, effortDays: 90, prior: 0.8, gate: 'inference ≥ 2M H100e' },
  { id: 'P21', name: 'Brain-like sample efficiency', tier: 3, effortDays: 210, prior: 0.45, gate: 'P08, P19' },
  { id: 'P22', name: 'Robotics foundation models', tier: 3, effortDays: 180, prior: 0.6, gate: 'multimodal' },
  { id: 'P23', name: 'Faithful-CoT architecture', tier: 3, effortDays: 120, prior: 0.75, gate: 'AG09 TECH' },
  { id: 'P24', name: 'AI-designed successor', tier: 4, effortDays: 120, prior: 0.6, gate: 'SAR' },
  { id: 'P25', name: 'Formal verification at scale', tier: 4, effortDays: 150, prior: 0.5, gate: 'P11' },
  { id: 'P26', name: 'Superhuman persuasion', tier: 4, effortDays: 60, prior: 0.8, gate: 'SOCIAL ≥ 12' },
  { id: 'P27', name: 'Automated alignment research', tier: 4, effortDays: 120, prior: 0.7, gate: 'P13 + AG17' },
];
