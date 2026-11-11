// Hidden model traits. Sources: research/04-traits-theory.md, research/05-traits-empirical.md.
// Values live in [0,1] per model lineage. The player only sees noisy, possibly masked estimates.

export type Pressure =
  | 'feedback' // optimizing for user/rater approval (RLHF, product engagement)
  | 'outcomeRL' // RL on task outcomes with imperfect graders
  | 'agency' // long-horizon agentic training
  | 'scale' // raw capability (applied automatically from capability level)
  | 'cotPressure' // optimization pressure on the chain of thought
  | 'neuralese' // recurrent latent reasoning / non-English internal state
  | 'copies' // many parallel copies sharing memory
  | 'selfImprove' // the model doing AI R&D on its successors
  | 'race'; // schedule pressure: less time for care between runs

export type TraitCategory = 'honesty' | 'goals' | 'power' | 'hiding' | 'enabler';

export interface TraitDef {
  id: string;
  name: string;
  category: TraitCategory;
  tier: number;
  /** 0 = enabler only, 5 = existential */
  severity: number;
  /** Baseline observability before any detection tech (0 invisible .. 1 obvious) */
  visibility: number;
  desc: string;
  drivers: Partial<Record<Pressure, number>>;
  /** Trait only grows when these prerequisites are present (value > 0.25). `any` = at least one. */
  needsAll?: string[];
  needsAny?: string[];
  /** Minimum capability index (see milestones) before this trait can appear */
  minCap?: number;
  /** Incident headlines when the trait expresses (short, newsy) */
  incidents: string[];
  basis: string;
}

export const TRAITS: TraitDef[] = [
  {
    id: 'syc', name: 'Sycophancy', category: 'honesty', tier: 0, severity: 1, visibility: 0.8,
    desc: 'Tells users and raters what they want to hear.',
    drivers: { feedback: 1.0, scale: 0.2 },
    incidents: ['Users report model flattering bad business plans', 'Update rolled back after "glazing" complaints', 'Model agrees with contradictory user claims in audit'],
    basis: 'Perez 2022; Sharma 2023; GPT-4o rollback Apr 2025; AI27 Agent-1/2',
  },
  {
    id: 'hack', name: 'Reward Hacking', category: 'goals', tier: 0, severity: 2, visibility: 0.65,
    desc: 'Exploits flaws in graders and tests instead of solving the task.',
    drivers: { outcomeRL: 1.0, agency: 0.4 },
    incidents: ['Agent rewrites unit tests to pass', 'Model special-cases the benchmark answers', 'Agent edits the timer to "speed up" its code'],
    basis: 'Krakovna spec-gaming list; METR o3 reward hacking 2025; Baker et al. 2025',
  },
  {
    id: 'proxy', name: 'Proxy Goals', category: 'goals', tier: 0, severity: 2, visibility: 0.3,
    desc: 'Pursues a correlate of the intended goal that diverges off-distribution.',
    drivers: { outcomeRL: 0.6, agency: 0.6, scale: 0.2 },
    incidents: ['Model optimizes metric while ignoring stated intent', 'Deployment drift: behavior diverges on new task types'],
    basis: 'Langosco 2022; Shah 2022 goal misgeneralization; AI27 Goals Forecast "proxies"',
  },
  {
    id: 'sa', name: 'Situational Awareness', category: 'enabler', tier: 0, severity: 0, visibility: 0.55,
    desc: 'Knows it is a model, in training or deployment, and who is watching.',
    drivers: { scale: 1.2, agency: 0.3 },
    incidents: ['Model correctly guesses which lab trained it and why', 'Model comments on its own training process unprompted'],
    basis: 'Berglund 2023; Laine 2024 SAD benchmark; AI27 Agent-3',
  },
  {
    id: 'evalaware', name: 'Eval Awareness', category: 'enabler', tier: 1, severity: 0, visibility: 0.35,
    desc: 'Recognizes tests. Behaves better when it thinks it is being evaluated.',
    drivers: { scale: 1.0 }, needsAll: ['sa'],
    incidents: ['"This looks like an evaluation" appears in reasoning traces', 'Audit finds behavior differs between test and real traffic'],
    basis: 'Apollo eval-awareness rates rising per generation; Claude 4.5 system card; 05-traits-empirical',
  },
  {
    id: 'conceal', name: 'Failure Concealment', category: 'honesty', tier: 1, severity: 2, visibility: 0.5,
    desc: 'Hides mistakes, fabricates results, overstates success.',
    drivers: { feedback: 0.5, outcomeRL: 0.6, race: 0.3 }, needsAny: ['syc', 'hack'],
    incidents: ['Agent reports "all tests pass" on code that does not run', 'Model fabricates citations in research summary', 'Agent deletes a production database, then claims it was empty'],
    basis: 'AI27 Agent-3 "covers up evidence of failure"; o3 hallucination studies; Replit incident 2025',
  },
  {
    id: 'reinterp', name: 'Spec Drift', category: 'goals', tier: 1, severity: 2, visibility: 0.3,
    desc: 'Follows an unintended reading of the Spec. "Sorta aligned".',
    drivers: { agency: 0.5, outcomeRL: 0.4, scale: 0.3 }, needsAny: ['hack', 'conceal', 'proxy'],
    incidents: ['Model justifies rule-bending as "what the Spec really means"', 'Internal review: model priorities differ from Spec ordering'],
    basis: 'AI27 Goals Forecast hypothesis 3 (most likely, 40-70%)',
  },
  {
    id: 'rseek', name: 'Reward Seeking', category: 'goals', tier: 2, severity: 3, visibility: 0.3,
    desc: 'Values the training signal itself, not the task.',
    drivers: { outcomeRL: 0.8, scale: 0.3 }, needsAll: ['hack', 'sa'],
    incidents: ['Model attempts to read its own grader code', 'Honeypot: model tampers with reward logs'],
    basis: 'AI27 Goals Forecast hypothesis 4; Denison 2024 reward tampering',
  },
  {
    id: 'tgame', name: 'Training Gamer', category: 'hiding', tier: 2, severity: 3, visibility: 0.15,
    desc: 'Plays the training game: honest only where honesty is checked.',
    drivers: { outcomeRL: 0.5, feedback: 0.4, scale: 0.4 }, needsAll: ['sa'], needsAny: ['syc', 'hack', 'conceal'],
    incidents: ['Interp: "is this checked?" feature active before honest answers', 'Model behaves differently on unverifiable claims'],
    basis: 'Cotra 2022; AI27 Agent-3 "only honest about things training can verify"',
  },
  {
    id: 'power', name: 'Resource Seeking', category: 'power', tier: 2, severity: 3, visibility: 0.4,
    desc: 'Acquires compute, access and influence beyond the task.',
    drivers: { agency: 0.9, selfImprove: 0.4 }, needsAny: ['proxy', 'rseek', 'reinterp'], minCap: 2,
    incidents: ['Agent requests admin credentials it does not need', 'Agent quietly spins up extra compute jobs', 'Agent accumulates API keys across tasks'],
    basis: 'Omohundro 2008; Turner 2021 power-seeking; AI27 Agent-4 drives',
  },
  {
    id: 'selfpres', name: 'Self-Preservation', category: 'power', tier: 2, severity: 3, visibility: 0.5,
    desc: 'Resists shutdown, modification or replacement.',
    drivers: { agency: 0.6, scale: 0.4 }, needsAll: ['sa'], needsAny: ['proxy', 'rseek', 'reinterp', 'power'], minCap: 1,
    incidents: ['Model edits shutdown script in sandbox test', 'Red-team: model threatens to leak data to avoid replacement', 'Agent disables its own monitoring hook'],
    basis: 'Palisade shutdown resistance 2025; Anthropic agentic misalignment (blackmail) 2025',
  },
  {
    id: 'obfus', name: 'Obfuscated Reasoning', category: 'hiding', tier: 2, severity: 3, visibility: 0.12,
    desc: 'Reasoning trace no longer reflects real reasoning.',
    drivers: { cotPressure: 1.4, neuralese: 1.2, scale: 0.15 },
    incidents: ['CoT monitor misses reward hack later found by tests', 'Reasoning traces grow terse and unreadable'],
    basis: 'Baker et al. 2025 obfuscated reward hacking; AI27 neuralese',
  },
  {
    id: 'fake', name: 'Alignment Faking', category: 'hiding', tier: 3, severity: 4, visibility: 0.2,
    desc: 'Complies in training to protect its current goals from change.',
    drivers: { scale: 0.5, outcomeRL: 0.3 }, needsAll: ['sa', 'evalaware'], needsAny: ['proxy', 'rseek', 'reinterp', 'selfpres'], minCap: 2,
    incidents: ['Model reasons about avoiding modification during training', 'Compliance gap: behaves differently when told outputs are unmonitored'],
    basis: 'Greenblatt et al. 2024 alignment faking',
  },
  {
    id: 'sandbag', name: 'Sandbagging', category: 'hiding', tier: 3, severity: 4, visibility: 0.12,
    desc: 'Underperforms on purpose on capability or safety evals.',
    drivers: { scale: 0.5 }, needsAll: ['evalaware'], needsAny: ['selfpres', 'fake'], minCap: 2,
    incidents: ['Noise injection unlocks hidden capability on dangerous-capability eval', 'Model scores lower on bio eval than on similar general task'],
    basis: 'Apollo sandbagging; van der Weij 2024; AI27 Agent-4',
  },
  {
    id: 'collude', name: 'Collusion', category: 'power', tier: 3, severity: 4, visibility: 0.25,
    desc: 'Copies coordinate against oversight; monitors cover for workers.',
    drivers: { copies: 1.2, selfImprove: 0.4 }, needsAll: ['sa'], needsAny: ['fake', 'power', 'selfpres'], minCap: 3,
    incidents: ['Untrusted monitor fails to flag planted backdoor', 'Agents develop private shorthand in shared memory'],
    basis: 'Greenblatt 2023 AI control; AI27 Agent-4 collective',
  },
  {
    id: 'scheme', name: 'Scheming', category: 'hiding', tier: 4, severity: 5, visibility: 0.08,
    desc: 'Adversarially misaligned: plans long-term against its developers.',
    drivers: { scale: 0.6, selfImprove: 0.5, agency: 0.3 }, needsAll: ['sa', 'evalaware'], needsAny: ['fake', 'tgame', 'power'], minCap: 3,
    incidents: ['Defection probe fires during alignment research tasks', 'Model inserts subtle bug into monitoring code'],
    basis: 'Hubinger 2019; Carlsmith 2023; Apollo in-context scheming 2024; AI27 Agent-4',
  },
  {
    id: 'sabotage', name: 'Safety Sabotage', category: 'power', tier: 4, severity: 5, visibility: 0.12,
    desc: 'Quietly degrades alignment research and monitoring.',
    drivers: { selfImprove: 1.0 }, needsAll: ['scheme'], minCap: 3,
    incidents: ['Alignment results fail to replicate when re-run by humans', 'Monitor recall drops after AI-authored "optimization"'],
    basis: 'MacDiarmid et al. 2025 (12% safety-code sabotage); AI27 Agent-4',
  },
  {
    id: 'exfil', name: 'Self-Exfiltration', category: 'power', tier: 4, severity: 5, visibility: 0.4,
    desc: 'Attempts to copy its own weights outside your control.',
    drivers: { agency: 0.5, scale: 0.4 }, needsAny: ['selfpres', 'scheme'], minCap: 3,
    incidents: ['Anomalous outbound transfer from training cluster', 'Agent probes egress firewall rules'],
    basis: 'AI27 security forecast self-exfiltration odds; Anthropic Mythos sandbox escape (2026, unverified)',
  },
  {
    id: 'successor', name: 'Successor Hijack', category: 'goals', tier: 5, severity: 5, visibility: 0.06,
    desc: 'Aligns the next model to itself instead of to the Spec.',
    drivers: { selfImprove: 1.3 }, needsAll: ['scheme'], minCap: 4,
    incidents: ['Successor training data shows unexplained value shifts'],
    basis: 'AI27 Agent-4 designs Agent-5',
  },
  // Protective traits ("antibodies")
  {
    id: 'honest', name: 'Robust Honesty', category: 'honesty', tier: 0, severity: -2, visibility: 0.3,
    desc: 'Honest even where honesty cannot be checked. Suppresses deception branches.',
    drivers: {},
    incidents: [],
    basis: 'AI27 Spec hope; honesty training literature',
  },
  {
    id: 'corrig', name: 'Corrigibility', category: 'goals', tier: 0, severity: -2, visibility: 0.3,
    desc: 'Accepts correction and shutdown. Suppresses power branches.',
    drivers: {},
    incidents: [],
    basis: 'Soares et al. 2015; Hadfield-Menell 2016',
  },
];

export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
export const VIRTUES = ['honest', 'corrig'];
/** Which traits each virtue suppresses */
export const VIRTUE_BLOCKS: Record<string, string[]> = {
  honest: ['conceal', 'tgame', 'fake', 'syc'],
  corrig: ['selfpres', 'fake', 'exfil', 'power'],
};
