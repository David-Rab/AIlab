// Paradigms P01–P27 (V2-SPEC §3.3.3, research/12 §0.7). Owner: WS1.
// Since R4 they are nodes of the tech tree (data/v2/tree.ts): no tiers, no measured-level gates, no FTE staffing.
// prior = P(success) of the first attempt, drawn hidden at newGame (§2.3 step 5). What each paradigm does is the
// tree node's text (data/v2/tree.ts); the engine applies effects in the consuming systems (readers check adopted()).
export interface ParadigmDef {
  id: string; name: string;
  /** P(success) of the first attempt, drawn hidden at newGame (world stream, PARADIGMS order: keep it). */
  prior: number;
}

export const PARADIGMS: ParadigmDef[] = [
  { id: 'P01', name: 'Reasoning RL', prior: 1 },
  { id: 'P02', name: 'Agentic environments', prior: 1 },
  { id: 'P03', name: 'Test-time compute', prior: 1 },
  { id: 'P04', name: 'Distillation', prior: 1 },
  { id: 'P05', name: 'Orchestrated multi-agent', prior: 0.95 },
  { id: 'P06', name: 'Computer use', prior: 0.9 },
  { id: 'P07', name: 'Long context + memory', prior: 0.9 },
  { id: 'P08', name: 'Continual learning', prior: 0.7 },
  { id: 'P09', name: 'Test-time training', prior: 0.6 },
  { id: 'P10', name: 'Synthetic data flywheel', prior: 0.8 },
  { id: 'P11', name: 'Self-play curricula', prior: 0.6 },
  { id: 'P12', name: 'Long-horizon human demos', prior: 0.85 },
  { id: 'P13', name: 'Automated AI research agents', prior: 0.75 },
  { id: 'P14', name: 'Interp-guided training', prior: 0.6 },
  { id: 'P15', name: 'AI-assisted oversight', prior: 0.6 },
  { id: 'P16', name: 'AI kernels / HW co-design', prior: 0.8 },
  { id: 'P17', name: 'Neuralese recurrence', prior: 0.7 },
  { id: 'P18', name: 'Iterated distillation & amplification', prior: 0.65 },
  { id: 'P19', name: 'Learned research taste', prior: 0.6 },
  { id: 'P20', name: 'Massive agent societies', prior: 0.8 },
  { id: 'P21', name: 'Brain-like sample efficiency', prior: 0.45 },
  { id: 'P22', name: 'Robotics foundation models', prior: 0.6 },
  { id: 'P23', name: 'Faithful-CoT architecture', prior: 0.75 },
  { id: 'P24', name: 'AI-designed successor', prior: 0.6 },
  { id: 'P25', name: 'Formal verification at scale', prior: 0.5 },
  // P26 (Superhuman persuasion) was cut in model v3 V2 (superpersuasion is the SOCIAL level); its hidden draw is
  // skipped explicitly at the draw site (world/hidden.ts, RD-C07).
  { id: 'P27', name: 'Automated alignment research', prior: 0.7 },
];
