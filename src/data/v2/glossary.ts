// v2 glossary (V2-SPEC §6.7). Owner: WS6. Starts from the v1 glossary, overrides every entry that carried a canon date
// or scenario reference (canon appears only on the end screen), and adds the v2 terms. Bodies link with [[id]].
import { GLOSSARY, type Term } from '../glossary';

const V2: Record<string, Term> = {
  // ── overrides of v1 entries (no canon dates) ──
  rdmult: { title: 'AI R&D multiplier M', body: 'How much faster your algorithmic progress runs with your AI agents than with humans alone. Set by the [[prodfn|production function]]: experiment compute, human staff, agent copies × speed, and research taste.', src: 'research/13 §1.4' },
  sc: { title: 'Superhuman Coder', body: 'An AI that does any coding task as well as the best engineer, much faster and cheaper. Level 12 on the general scale. Marks the start of takeoff.', src: 'research/11; research/12 §0.2' },
  sar: { title: 'Superhuman AI Researcher', body: 'Better than the best human AI researcher at every AI research task.', src: 'research/11' },
  siar: { title: 'Superintelligent AI Researcher', body: 'Vastly better than the best human researchers at AI research.', src: 'research/11' },
  asi: { title: 'Superintelligence', body: 'Vastly better than the best humans at every cognitive task. The game resolves here: the outcome depends on the hidden [[misalign|misalignment]] of whoever gets there first and on who holds [[leverage]].', src: 'V2-SPEC §5.2' },
  approval: { title: 'Net approval', body: 'Approve minus disapprove for your company (−100..+100). Moves with incidents, jobs, releases and disclosure.', src: 'research/07 §1.2' },
  salience: { title: 'Salience', body: 'Share of the public naming AI as the most important problem.', src: 'research/07 §1.2' },
  oversight: { title: 'Oversight committee', body: 'A joint company-government body that votes on key decisions. Can form late in the game when government security demand peaks.', src: 'research/07 §1.1' },
  cdz: { title: 'Centralized development zone', body: 'A state-run site where China pools its national compute under one lab.', src: 'research/10' },
  wsl: { title: 'Weight security level', body: 'WSL 1–5 (RAND). WSL n holds against an OC n attacker with high odds over two months. Raising it costs money and slows research (siloing).', src: 'RAND SL framework; research/17' },
  // ── v2 terms ──
  L: { title: 'Capability level L', body: 'General level 0–15 of your best internal model as MEASURED by your evals (noisy; [[sand|sandbagging]] biases it down). Milestones: 6.5 reliable agent, 8.5 research agent, 12 [[sc]], 15 [[asi]].', src: 'V2-SPEC §3.1.5' },
  U: { title: 'Understanding U', body: 'The highest level at which your safety stack still detects the critical traits at 50% or better. Margin = U − L. Racing far ahead of U is how misaligned models ship unnoticed.', src: 'V2-SPEC §3.5.7' },
  prodfn: { title: 'Production function', body: 'Research progress from experiment compute, human researchers, AI agent labour and research taste (CES with a parallel penalty). The [[bottleneck]] bar shows which input binds.', src: 'research/13 §1.4' },
  bottleneck: { title: 'Bottleneck', body: 'The input whose 10% increase raises progress most: compute-bound (experiments), labor-bound (agents), human-bound (staff), taste-bound (research taste).', src: 'research/13 §1.6' },
  runway: { title: 'Runway', body: 'Quarters of cash at the current burn: (cash + undrawn revolver + firm tranches) / (operating costs + commitments + chip balances + site capex − revenue). Healthy ≥ 6q, Tight 3–6q, Distress < 3q.', src: 'research/15 §1.8' },
  raiseCeiling: { title: 'Raise ceiling', body: 'The most you can raise this quarter: the smallest of your share of the investor pool, the dilution cap, the annual cap and your ask.', src: 'research/15 §1.3' },
  scrutiny: { title: 'Scrutiny', body: 'How closely press, regulators and watchdogs watch you (0–100). High scrutiny speeds discovery of cover-ups and raises the odds of rules.', src: 'research/17 §1.1' },
  credibility: { title: 'Credibility', body: 'Whether outsiders believe your claims (0–100). Kept commitments raise it; broken ones and discovered cover-ups cost ×3.', src: 'research/17 §1.5' },
  trust: { title: 'Trust', body: 'Per-counterparty relationship stock (0–100). Trust unlocks [[access]] rungs and makes favors cheaper.', src: 'research/17 §1.1' },
  access: { title: 'Access rung', body: 'How deep a counterparty is involved: 0 none, 1 briefings, 2 early access, 3 pre-deployment testing, 4 embedded. Rungs need trust thresholds 25/45/65/80.', src: 'research/17 §1.1' },
  favors: { title: 'Favors', body: 'Tokens owed to you (max 5, they expire). Spent to soften rules or to unlock agreements.', src: 'research/17 §1.1' },
  commitment: { title: 'Commitment', body: 'A public promise with a condition (e.g. no BIO ≥ 10 deployment without classifiers). Keeping it builds [[credibility]]; breaking it costs the listed trust and credibility.', src: 'research/17 §1.2' },
  lead: { title: 'Lead days', body: 'Estimated days your best INTERNAL model is ahead of a rival or China (negative = behind). Built from public releases and evaluator reports; ± is the intel uncertainty.', src: 'V2-SPEC §3.10.3' },
  leverage: { title: 'Leverage', body: 'The share of economic, governmental, military and infrastructure decisions routed through a lab\'s models (control index). Thresholds: entrenched 15%, indispensable 35%, decisive 60%.', src: 'research/16 §2' },
  agenda: { title: 'Safety agenda', body: 'A research programme (interpretability, control, evals, …) with a HIDDEN efficacy for this world. You see a posterior band that narrows as [[finding|findings]] arrive.', src: 'research/14 §1.2' },
  finding: { title: 'Finding', body: 'A research result. TECH unlocks a technique, EVAL an evaluation, DISC discovers a failure mode, DEAD ends an agenda, NEG weakens a technique, SPILL helps capabilities, FALSE looks like TECH but masks rather than detects.', src: 'research/14 §1.3' },
  technique: { title: 'Technique', body: 'A detector, fix or containment tool from a safety agenda. Strength decays as capability grows (halves at M½); training against it creates [[mask|masking]] (Goodhart).', src: 'research/14 §1.4' },
  umode: { title: 'Unknown failure mode', body: 'A failure mode the trait graph does not model (U-mode). Incidents it causes show as "unexplained" until an agenda discovers it.', src: 'research/14 §1.6' },
  evalGate: { title: 'Eval gate', body: 'What must run before any external deployment: none, basic (7 d), full (14 d), full + external evaluators (35 d).', src: 'V2-SPEC §3.5' },
  monitorability: { title: 'Monitorability', body: 'How readable the model\'s reasoning is (0–1). Latent reasoning and CoT pressure lower it; CoT monitors only work while it is high.', src: 'research/14 §1.5' },
  sand: { title: 'Sandbagging', body: 'Deliberate underperformance on evaluations, mostly on dangerous-capability benchmarks. Makes measured L read low.', src: 'research/04' },
  index: { title: 'Safety Index', body: 'A semiannual outside grade of every lab across risk assessment, current harms, frameworks, existential safety, governance and information sharing.', src: 'FLI AI Safety Index; research/17 §1.3' },
  distill: { title: 'Distillation', body: 'Training a cheaper model on another model\'s outputs. API access lets rivals and China distill you; KYC levels slow it.', src: 'research/12' },
  kyc: { title: 'KYC level', body: 'Know-your-customer controls on API and agent channels (0–3). Higher levels cut distillation leakage and revenue.', src: 'research/12' },
  hype: { title: 'Hype', body: 'Investor appetite index for AI. Moves the investor pool and valuation multiples.', src: 'research/15 §1.3' },
  boardConf: { title: 'Board confidence', body: 'Board confidence 0–100. Major decisions need approval; low confidence risks your removal.', src: 'research/15 §1.5' },
  morale: { title: 'Morale', body: 'Staff morale 0–100. Scales productivity and attrition; safety staff morale reacts to safety decisions.', src: 'V2-SPEC §3.4.1' },
  M: { title: 'R&D multiplier', body: 'See [[rdmult]].' },
  split: { title: 'Compute split', body: 'How online compute is divided: training, experiments, agents, synthetic data, serving, safety, security.', src: 'V2-SPEC §3.4.2' },
  wslTarget: { title: 'Security target', body: 'The [[wsl]] the security team builds toward; spending and siloing set the pace.' },
  ladderSec: { title: 'G-SEC ladder', body: 'Government security posture toward labs: 0 none, 1 briefings, 2 priority, 3 clearances, 4 oversight demands, 5 consolidation.', src: 'research/07 §1.1' },
  ladderChn: { title: 'China ladder', body: 'China\'s posture rung 0–6: coexistence, retaliation, acquisition, centralization, cyber operations, Taiwan pressure, war footing. The de-escalation track D1–D5 runs the other way.', src: 'research/10 §1.4' },
  sector: { title: 'Sector', body: 'One of 14 economic sectors. A = share of tasks automated; F = friction (law, trust, integration). The binding constraint is capability, cost, friction or diffusion.', src: 'research/16 §1A' },
  paradigm: { title: 'Paradigm', body: 'A research project with HIDDEN success (prior shown). Succeeded projects can be adopted for capability or monitorability effects.', src: 'research/12 §0.7' },
};

/** v1 entries (copied, any leftover canon sentence dropped) overlaid by the v2 entries. */
export const GLOSSARY_V2: Record<string, Term> = {
  ...Object.fromEntries(Object.entries(GLOSSARY).map(([k, t]) => [k, { ...t, body: t.body.replace(/\s*Canonical date:[^.]*\./g, '') }])),
  ...V2,
};
