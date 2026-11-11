// Safety research tree. Source: research/06-countermeasures.md (merged to a prototype-sized set).
// Strengths are design estimates in [0,1] unless noted as measured in the research file.

export type Branch = 'align' | 'oversight' | 'detect' | 'control' | 'gov' | 'security';
export type DetectKind = 'behavioral' | 'cot' | 'whitebox';

export interface TechDef {
  id: string;
  name: string;
  branch: Branch;
  desc: string;
  /** Research points to complete */
  cost: number;
  prereqs: string[];
  /** Capability index needed before it can be researched (0 = at start) */
  minCap?: number;
  /** Reduces true trait value and its growth */
  counters?: Record<string, number>;
  /** Lowers only the *visible* trait value (looks fixed, isn't) */
  masks?: Record<string, number>;
  /** Grows a protective trait */
  grows?: Record<string, number>;
  detects?: Record<string, number>;
  detectKind?: DetectKind;
  /** Fraction of incidents / escape attempts contained (control) */
  control?: number;
  /** Ongoing cost while active */
  tax?: { rd?: number; compute?: number; cashPerMonth?: number };
  /** Can be used as a training signal ("train against") */
  trainable?: boolean;
  limits: string;
  basis: string;
}

export const TECHS: TechDef[] = [
  // ---------- Drift reduction ----------
  {
    id: 'rlhf', name: 'RLHF', branch: 'align', cost: 0, prereqs: [],
    desc: 'Train on human preference ratings.',
    counters: { hack: 0.1 }, masks: { syc: 0.15, conceal: 0.2 },
    limits: 'Rewards looking good to raters; feeds sycophancy.',
    basis: 'Christiano 2017; Ouyang 2022',
  },
  {
    id: 'spec', name: 'Model Spec', branch: 'align', cost: 40, prereqs: ['rlhf'],
    desc: 'Written constitution the model is trained to follow.',
    counters: { reinterp: 0.2, syc: 0.1 }, grows: { honest: 0.15, corrig: 0.1 },
    limits: 'Vague in edge cases; model may adopt an unintended reading.',
    basis: 'Constitutional AI (Bai 2022); OpenAI Model Spec; AI27 "the Spec"',
  },
  {
    id: 'character', name: 'Character Training', branch: 'align', cost: 120, prereqs: ['spec'],
    desc: 'Shape a stable, honest persona.',
    counters: { syc: 0.2 }, grows: { honest: 0.25 },
    limits: 'Persona can be shallow; unclear generalization to agentic settings.',
    basis: 'Anthropic character training 2024',
  },
  {
    id: 'delib', name: 'Deliberative Alignment', branch: 'align', cost: 160, prereqs: ['spec'],
    desc: 'Model reasons explicitly about the Spec before acting.',
    counters: { reinterp: 0.25, conceal: 0.15, scheme: 0.15 }, tax: { rd: 0.01 },
    limits: 'Reduces covert actions, but eval awareness inflates the measured effect.',
    basis: 'OpenAI 2024; Apollo/OpenAI anti-scheming 2025 (13%→0.4% covert actions, measured)',
  },
  {
    id: 'envhard', name: 'Environment Hardening', branch: 'align', cost: 80, prereqs: ['rlhf'],
    desc: 'Patch exploitable RL environments and graders.',
    counters: { hack: 0.35, rseek: 0.15 }, tax: { cashPerMonth: 15 },
    limits: 'Whack-a-mole; new environments bring new exploits.',
    basis: 'METR reward-hacking reports 2025',
  },
  {
    id: 'inoculate', name: 'Inoculation Prompting', branch: 'align', cost: 140, prereqs: ['envhard'], minCap: 1,
    desc: 'Frame hacks as permitted in training so they do not generalize to misalignment.',
    counters: { reinterp: 0.2, sabotage: 0.25, scheme: 0.1 },
    limits: 'Stops generalization, not the hacking itself.',
    basis: 'MacDiarmid et al. 2025 (measured: stopped spread to sabotage)',
  },
  {
    id: 'mona', name: 'Myopic Optimization', branch: 'align', cost: 300, prereqs: ['envhard', 'w2s'], minCap: 2,
    desc: 'Reward only short-horizon, human-approved steps.',
    counters: { hack: 0.3, power: 0.3, rseek: 0.25 }, tax: { rd: 0.06 },
    limits: 'Costs capability on long tasks.',
    basis: 'Farquhar et al. 2025 (MONA)',
  },
  {
    id: 'datafilter', name: 'Data Filtering', branch: 'align', cost: 60, prereqs: [],
    desc: 'Remove hazardous and misalignment-trope data from pretraining.',
    counters: { sa: 0.05, selfpres: 0.1 }, tax: { compute: 0.005 },
    limits: 'Only affects next pretraining run; cannot remove SA from capability.',
    basis: 'O\'Brien et al. 2025 "Deep ignorance"',
  },
  // ---------- Scalable oversight ----------
  {
    id: 'w2s', name: 'Weak-to-Strong', branch: 'oversight', cost: 150, prereqs: ['rlhf'],
    desc: 'Use weaker supervisors to train stronger models.',
    counters: { hack: 0.1, proxy: 0.15 },
    limits: 'Recovers only part of the gap; degrades as capability grows.',
    basis: 'Burns et al. 2023',
  },
  {
    id: 'debate', name: 'Debate', branch: 'oversight', cost: 400, prereqs: ['w2s'], minCap: 2,
    desc: 'Models argue; humans judge the stronger case.',
    counters: { conceal: 0.25, reinterp: 0.15 }, detects: { conceal: 0.3, tgame: 0.15 }, detectKind: 'behavioral', tax: { compute: 0.02 },
    limits: 'Judges can be out-argued; collusion between debaters.',
    basis: 'Irving 2018; Khan 2024',
  },
  {
    id: 'goaltrain', name: 'Goal Training (Safer-2)', branch: 'oversight', cost: 2500, prereqs: ['debate', 'cotkeep', 'organisms'], minCap: 3,
    desc: 'Train for the right goals, not for appearing to have them.',
    counters: { scheme: 0.45, fake: 0.4, tgame: 0.4, power: 0.3 }, grows: { honest: 0.3, corrig: 0.35 }, tax: { rd: 0.12 },
    limits: 'Very expensive; success never certain.',
    basis: 'AI27 Slowdown ending: Safer-2/3 path',
  },
  // ---------- Detection ----------
  {
    id: 'dce', name: 'Capability Evals', branch: 'detect', cost: 0, prereqs: [], detectKind: 'behavioral',
    desc: 'Dangerous-capability evaluations (cyber, bio, autonomy).',
    detects: { sa: 0.4, exfil: 0.2 },
    limits: 'Sandbagging and eval awareness hide true capability.',
    basis: 'GDM FSF; Anthropic RSP; UK AISI',
  },
  {
    id: 'honeypots', name: 'Honeypots', branch: 'detect', cost: 70, prereqs: ['dce'], detectKind: 'behavioral',
    desc: 'Propensity evals and planted temptations.',
    detects: { hack: 0.4, rseek: 0.35, power: 0.35, selfpres: 0.4, conceal: 0.3 }, trainable: true,
    limits: 'Eval-aware models avoid the bait.',
    basis: 'Apollo in-context scheming 2024; Anthropic agentic misalignment 2025',
  },
  {
    id: 'organisms', name: 'Model Organisms', branch: 'detect', cost: 150, prereqs: ['honeypots'], detectKind: 'behavioral',
    desc: 'Deliberately build misaligned models to calibrate detectors.',
    detects: { fake: 0.25, scheme: 0.1, tgame: 0.15 },
    limits: 'Organisms may differ from natural misalignment.',
    basis: 'Hubinger 2024 sleeper agents; Greenblatt 2024',
  },
  {
    id: 'audit', name: 'Auditing Agents', branch: 'detect', cost: 300, prereqs: ['organisms'], minCap: 1, detectKind: 'behavioral',
    desc: 'Automated agents hunt for hidden objectives.',
    detects: { reinterp: 0.35, proxy: 0.3, tgame: 0.2, fake: 0.2 },
    limits: 'Auditors share blind spots with the audited model.',
    basis: 'Marks et al. 2025 auditing games; Anthropic auditing agents',
  },
  {
    id: 'noise', name: 'Noise Injection', branch: 'detect', cost: 90, prereqs: ['dce'], detectKind: 'whitebox',
    desc: 'Perturb weights to unlock sandbagged capability.',
    detects: { sandbag: 0.5 },
    limits: 'Works on current sandbaggers; future models may be robust.',
    basis: 'Tice et al. 2024; AI27 Agent-4 detection',
  },
  {
    id: 'crossexam', name: 'Cross-Examination', branch: 'detect', cost: 800, prereqs: ['honeypots', 'lockdown'], minCap: 3, detectKind: 'behavioral',
    desc: 'Interrogate isolated frozen copies; compare stories.',
    detects: { scheme: 0.35, collude: 0.4, sabotage: 0.3 },
    limits: 'Needs many isolated copies; slow.',
    basis: 'AI27 Slowdown: frozen copies + lie detector',
  },
  {
    id: 'cotmon', name: 'CoT Monitoring', branch: 'detect', cost: 50, prereqs: [], detectKind: 'cot',
    desc: 'A monitor reads reasoning traces for bad intent.',
    detects: { hack: 0.6, conceal: 0.4, rseek: 0.4, fake: 0.4, scheme: 0.3, power: 0.3 }, trainable: true, tax: { compute: 0.01 },
    limits: 'Fails once reasoning is obfuscated or in neuralese. Never train against it.',
    basis: 'Baker et al. 2025; Korbak et al. 2025 "CoT monitorability"',
  },
  {
    id: 'cotkeep', name: 'Faithful CoT (Safer-1)', branch: 'detect', cost: 500, prereqs: ['cotmon'], minCap: 2,
    desc: 'Forbid neuralese and CoT optimization; keep reasoning legible.',
    counters: { obfus: 0.5 }, grows: { honest: 0.1 }, tax: { rd: 0.25 },
    limits: 'Large capability tax (AI27: Safer-1 ~20x vs Agent-4 ~70x).',
    basis: 'AI27 Slowdown Safer-1',
  },
  {
    id: 'probes', name: 'Linear Probes', branch: 'detect', cost: 100, prereqs: [], detectKind: 'whitebox',
    desc: 'Cheap classifiers on activations (e.g. deception).',
    detects: { conceal: 0.35, fake: 0.3, scheme: 0.25, sandbag: 0.15 }, trainable: true,
    limits: 'False positives; can be evaded if trained against.',
    basis: 'Goldowsky-Dill 2025; Anthropic defection probes; AI27 Agent-4 probes',
  },
  {
    id: 'sae', name: 'Sparse Autoencoders', branch: 'detect', cost: 250, prereqs: ['probes'], detectKind: 'whitebox',
    desc: 'Decompose activations into interpretable features.',
    detects: { sa: 0.4, evalaware: 0.4, proxy: 0.25, tgame: 0.25 }, tax: { compute: 0.01 },
    limits: 'Misses features; expensive at frontier scale.',
    basis: 'Bricken 2023; Templeton 2024',
  },
  {
    id: 'steer', name: 'Activation Steering', branch: 'detect', cost: 200, prereqs: ['probes'], detectKind: 'whitebox',
    desc: 'Steer away from eval awareness and bad personas.',
    counters: { syc: 0.15, evalaware: 0.2 }, detects: { evalaware: 0.3 },
    limits: 'Some capability loss; brittle.',
    basis: 'Turner 2023; persona vectors (Chen 2025); Claude 4.5 eval-awareness steering',
  },
  {
    id: 'circuits', name: 'Circuit Tracing', branch: 'detect', cost: 700, prereqs: ['sae'], minCap: 1, detectKind: 'whitebox',
    desc: 'Attribution graphs of how the model computes answers.',
    detects: { scheme: 0.35, fake: 0.35, obfus: 0.4, successor: 0.2 }, tax: { cashPerMonth: 40 },
    limits: 'Human-hours per prompt; partial coverage.',
    basis: 'Anthropic attribution graphs 2025',
  },
  // ---------- Control ----------
  {
    id: 'trusted', name: 'Trusted Monitoring', branch: 'control', cost: 60, prereqs: [],
    desc: 'Weaker trusted model screens every action.',
    control: 0.25, detects: { power: 0.2, exfil: 0.3 }, detectKind: 'behavioral', tax: { compute: 0.02 },
    limits: 'Outpaced as the capability gap grows.',
    basis: 'Greenblatt et al. 2023 AI control',
  },
  {
    id: 'untrusted', name: 'Untrusted Monitoring', branch: 'control', cost: 250, prereqs: ['trusted', 'honeypots'], minCap: 2,
    desc: 'Strong model monitors itself, with collusion busting.',
    control: 0.25, detects: { collude: 0.3 }, detectKind: 'behavioral', tax: { compute: 0.03 },
    limits: 'Collusion between monitor and worker.',
    basis: 'Greenblatt et al. 2023',
  },
  {
    id: 'resample', name: 'Resample & Defer', branch: 'control', cost: 180, prereqs: ['trusted'],
    desc: 'Resample suspicious actions; defer to trusted model.',
    control: 0.2, tax: { rd: 0.05 },
    limits: '~5% usefulness cost (measured, Ctrl-Z).',
    basis: 'Bhatt et al. 2025 Ctrl-Z',
  },
  {
    id: 'lockdown', name: 'Comms Lockdown', branch: 'control', cost: 350, prereqs: ['trusted'], minCap: 2,
    desc: 'English-only agent messages; no shared latent memory.',
    control: 0.15, counters: { collude: 0.5 }, tax: { rd: 0.08 },
    limits: 'Agents lose shared memory; slower research.',
    basis: 'AI27 Slowdown: shared memory locked',
  },
  {
    id: 'killswitch', name: 'Tripwires & Rollback', branch: 'control', cost: 120, prereqs: ['trusted'],
    desc: 'Automatic shutdown and checkpoint rollback on tripwires.',
    control: 0.15,
    limits: 'Only as good as tripwire coverage.',
    basis: 'Frontier safety frameworks; AI27 rollback to Agent-3',
  },
  // ---------- Governance ----------
  {
    id: 'fsf', name: 'Safety Framework', branch: 'gov', cost: 30, prereqs: [],
    desc: 'Published thresholds and commitments (RSP-style).',
    limits: 'Commitments erode under race pressure.',
    basis: 'Anthropic RSP; OpenAI Preparedness; GDM FSF',
  },
  {
    id: 'safetycase', name: 'Safety Cases', branch: 'gov', cost: 260, prereqs: ['fsf', 'honeypots', 'trusted'], minCap: 1,
    desc: 'Structured arguments that a deployment is safe; third-party review.',
    limits: 'Arguments can be written by the AIs themselves.',
    basis: 'Clymer 2024; UK AISI safety cases',
  },
  // ---------- Security ----------
  {
    id: 'sl3', name: 'Security SL3', branch: 'security', cost: 80, prereqs: [],
    desc: 'Defends against criminal groups and insiders.',
    tax: { cashPerMonth: 30 },
    limits: 'Does not stop state actors.',
    basis: 'RAND Securing AI Model Weights (RR-A2849-1)',
  },
  {
    id: 'sl4', name: 'Security SL4', branch: 'security', cost: 350, prereqs: ['sl3'],
    desc: 'Defends against standard state operations.',
    tax: { cashPerMonth: 120, rd: 0.03 },
    limits: 'Top-priority nation-state ops can still succeed.',
    basis: 'RAND SL4; AI27 security forecast',
  },
  {
    id: 'sl5', name: 'Security SL5', branch: 'security', cost: 1200, prereqs: ['sl4'], minCap: 2,
    desc: 'Defends against top nation-state operations. Needs government help.',
    tax: { cashPerMonth: 400, rd: 0.07 },
    limits: 'No company reaches SL5 alone (63% of experts).',
    basis: 'RAND SL5; AI27: WSL3→5 in ~12 months with government priority',
  },
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export const BRANCH_LABEL: Record<Branch, string> = {
  align: 'Alignment',
  oversight: 'Oversight',
  detect: 'Detection',
  control: 'Control',
  gov: 'Governance',
  security: 'Security',
};
