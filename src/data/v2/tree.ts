// The shared tech tree (design/TECH-TREE.md §2, BUILD-PLAN R4). Owner: WS1.
// One node = one idea. Six columns of expertise (science-team specialties), drawn as horizontal lanes; depth (how many
// ideas a node builds on) runs left to right. Knowledge is gated only by knowledge: a node opens when its `needs` are
// known; there are no capability gates. Some ideas only pay off with a capable model or enough compute (`payoff`),
// shown on the node card.
//
// Capability nodes are research projects for science teams (models/tree.ts): progress/day = M · √capacity / (effort ·
// 30), capacity = Σ heads/40 × quality × 1.5 if the team's specialty is the node's column. Effort is in standard-team-
// months at research speed M = 1. Paradigm nodes (P-ids) roll the hidden paradigm draw on their first attempt; new nodes
// roll hash32(seed, 'node:'+id). A failed idea can be retried after 180 days at half the previous odds.
//
// Safety nodes (alignment, interpretability, evals & control) mirror the safety techniques and agenda findings until R8
// turns them into projects for safety science teams: read-only, known when their technique is unlocked.
// Product-feature nodes (Scaffold) are projects like any other; a known feature node lets the engineers build the feature (R6).
import type { AgendaId, Column } from '../../engine/v2/types';

export type Layer = 'backbone' | 'training' | 'scaffold' | 'lab';
export type EffortClass = 'S' | 'M' | 'L' | 'XL';
/** Design-option slots a node can unlock (run designer, deployments). */
export type OptionSlot = 'shape' | 'data' | 'curation' | 'pref' | 'rlFocus' | 'rlIntensity' | 'cot' | 'inoculation' | 'effort';

export interface TreeNodeDef {
  id: string;
  name: string;
  column: Column;
  layer: Layer;
  /** Prerequisite node ids (all must be known). */
  needs: string[];
  /** Effort class (display); undefined for ★ nodes. */
  effort?: EffortClass;
  /** Effort in standard-team-months at M = 1 (default EFFORT_TM[effort]); fitted for RefBot's nodes (calib --fit-tree). */
  effortTM?: number;
  /** Success chance of a new (non-paradigm) node. Paradigm nodes use the paradigm prior. */
  odds?: number;
  /** The id is a paradigm id (P05…P27): success adopts it (player.paradigms[id].status = 'adopted'). */
  paradigm?: boolean;
  /** Safety nodes: the research line whose hidden efficacy decides results. */
  agenda?: AgendaId;
  /** Safety nodes: the technique this node mirrors (known when it is unlocked). */
  technique?: string;
  /** Known at the start by every company (public knowledge in Jul 2025). */
  star?: boolean;
  /** Known at the frontier-leader start (features the game already has) until the start types (R9) set known nodes. */
  leaderKnown?: boolean;
  /** Not researchable yet: product features become projects with live products. */
  soon?: 'products';
  /** Design options this node unlocks. */
  options?: [OptionSlot, string][];
  /** Cash ($B) booked when an attempt starts. */
  cashCost?: number;
  /** Effect arrows for the tree node: capability and safety, +2 ▲▲ … −2 ▼▼. */
  fx: { cap?: number; saf?: number };
  /** Node-card text: capability effect, safety effect, cost, pay-off condition. */
  cap?: string;
  saf?: string;
  cost?: string;
  payoff?: string;
}

/** Standard-team-months at M = 1 per effort class, for new (non-paradigm) nodes [D]. */
export const EFFORT_TM: Record<EffortClass, number> = { S: 3, M: 8, L: 25, XL: 50 };

/** Paradigm nodes: the pre-R4 effortDays (days at RefBot's reference staffing) × TM_PER_OLD_DAY, the rate RefBot's
 *  early projects fit to (P08: 150 d ≈ 31 team-months at M ≈ 1.8 with ~13 teams). */
const OLD_EFFORT_DAYS: Record<string, number> = {
  P05: 60, P06: 90, P07: 60, P08: 150, P09: 120, P10: 120, P11: 180, P12: 180, P13: 150, P14: 120, P15: 120, P16: 90,
  P17: 120, P18: 120, P19: 150, P20: 90, P21: 210, P22: 180, P23: 120, P24: 120, P25: 150, P26: 60, P27: 120,
};
const TM_PER_OLD_DAY = 0.2;
/** RefBot's projects, fitted so each attempt lasts its pre-R4 duration (`npx tsx scripts/v2/calib.ts --fit-tree`). Late
 *  projects (P13 at RSCH 8.5, P17 at L 9.5) start when research speed M is already 3–8×, so their effort is large. */
export const FITTED_EFFORT_TM: Record<string, number> = { P05: 7.43, P07: 5.63, P08: 30.14, P13: 81.34, P17: 40.5 };

/** A failed idea can be retried after this many days at half the previous odds (TECH-TREE §5 T1). */
export const TREE_RETRY_DAYS = 180;
/** Specialty bonus: a team works ×1.5 in its own column (TECH-TREE §5 T2). */
export const SPECIALTY_BONUS = 1.5;
/** Team-size unit of project capacity (one standard science team). */
export const CAPACITY_UNIT = 40;

const P = (id: string, name: string, column: Column, layer: Layer, needs: string[], effort: EffortClass, fx: TreeNodeDef['fx'], text: Partial<TreeNodeDef> = {}): TreeNodeDef =>
  ({ id, name, column, layer, needs, effort, paradigm: true, fx, ...text });
const N = (id: string, name: string, column: Column, layer: Layer, needs: string[], effort: EffortClass, odds: number, fx: TreeNodeDef['fx'], text: Partial<TreeNodeDef> = {}): TreeNodeDef =>
  ({ id, name, column, layer, needs, effort, odds, fx, ...text });
const STAR = (id: string, name: string, column: Column, layer: Layer, fx: TreeNodeDef['fx'], text: Partial<TreeNodeDef> = {}): TreeNodeDef =>
  ({ id, name, column, layer, needs: [], star: true, fx, ...text });
/** Safety node mirroring a technique (read-only until R8). */
const S = (id: string, name: string, column: Column, layer: Layer, needs: string[], agenda: AgendaId | undefined, effort: EffortClass | undefined, fx: TreeNodeDef['fx'], text: Partial<TreeNodeDef> = {}): TreeNodeDef =>
  ({ id, name, column, layer, needs, effort, fx, ...(agenda ? { agenda } : {}), ...(id.startsWith('T-') ? { technique: id } : {}), ...text });

export const TREE: TreeNodeDef[] = [
  // ── Pretraining (Backbone unless noted) ──
  STAR('moe', 'MoE', 'pretraining', 'backbone', {}, { options: [['shape', 'moe']], cap: 'Reference architecture', cost: 'Serve ×0.5 vs dense' }),
  STAR('dense', 'Dense', 'pretraining', 'backbone', { cap: -1 }, { options: [['shape', 'dense']], cap: 'Δ −0.24 y vs MoE', saf: 'Restart risk −10%', cost: 'Serve 1.0' }),
  STAR('qualityFilter', 'Quality filter', 'pretraining', 'backbone', {}, { options: [['data', 'balanced']], cap: 'Reference data' }),
  STAR('codeMath', 'Code & math data', 'pretraining', 'backbone', { cap: 1 }, { options: [['data', 'codeMath']], cap: 'CODE +0.6, RSCH +0.4, CYBER +0.4, SOCIAL −0.4' }),
  N('scienceData', 'Science data', 'pretraining', 'backbone', [], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['data', 'science']], cap: 'BIO +0.8, REASON +0.4', saf: 'Bio-uplift flag risk', cost: '+5% run cash' }),
  N('multimodal', 'Native multimodal', 'pretraining', 'backbone', [], 'M', 0.9, { cap: 1 }, { options: [['data', 'multimodal']], cap: 'AGENCY, MEDIA +0.6, PHYS +0.5; no data wall', cost: '+20% FLOP' }),
  N('overtrained', 'Overtrained compact', 'pretraining', 'backbone', [], 'S', 0.95, { cap: -1 }, { options: [['shape', 'overtrained']], cap: 'Δ −0.36 y', cost: 'Serve 0.3; tokens ×5' }),
  N('faultTolerant', 'Fault-tolerant training', 'pretraining', 'backbone', [], 'M', 0.9, {}, { cap: 'Loss-spike restart risk ×0.5' }),
  P('P10', 'Synthetic data flywheel', 'pretraining', 'backbone', ['codeMath'], 'L', { cap: 1, saf: -1 }, { options: [['data', 'synthetic']], cap: 'Synthetic data ×3; no data wall; synthetic data mix +0.15 y', saf: 'Reward-model exploitation ×1.5; inherits teacher traits', payoff: 'Pays off with a teacher model' }),
  P('P12', 'Long-horizon human demos', 'pretraining', 'backbone', [], 'L', { cap: 1 }, { cashCost: 1, cap: 'Time horizon ×2; RSCH +0.4', cost: '$1B data cost when the project starts' }),
  P('P23', 'Faithful-CoT architecture', 'pretraining', 'backbone', ['T-COTMON'], 'L', { cap: -1, saf: 2 }, { options: [['cot', 'faithful']], cap: 'Δ −0.24 y', saf: 'Monitorability 0.98', cost: 'Serve ×1.2' }),
  P('P17', 'Neuralese recurrence', 'pretraining', 'backbone', ['P01', 'P07'], 'XL', { cap: 2, saf: -2 }, { options: [['shape', 'latent']], cap: '+0.40 y on a latent base', saf: 'CoT monitoring dies (monitorability 0.05)', cost: 'Serve 0.2' }),
  P('P24', 'AI-designed successor', 'pretraining', 'backbone', ['P13', 'P19'], 'XL', { cap: 2, saf: -1 }, { cap: 'Next base +0.8 y', saf: 'New lineage: traits redrawn, tools may not transfer', payoff: 'Pays off with research done mostly by AI (AI share of research labour 50% → 90%)' }),

  // ── Post-training (Training unless noted) ──
  STAR('P01', 'Visible reasoning', 'posttraining', 'training', { saf: 1 }, { paradigm: true, options: [['cot', 'visible']], cap: 'Baseline reasoning (reasoning RL)', saf: 'Monitorable chain of thought' }),
  STAR('P02', 'Agentic environments', 'posttraining', 'training', {}, { paradigm: true, cap: 'Baseline agents' }),
  STAR('hardenedGraders', 'Hardened graders', 'posttraining', 'training', { saf: 1 }, { options: [['rlIntensity', 'heavyHardened']], cap: 'Reference RL', saf: 'Reward hacking ×0.4 vs cheap graders', cost: 'RL environment budget' }),
  STAR('engagement', 'Engagement tuning', 'posttraining', 'training', { cap: 1, saf: -1 }, { options: [['pref', 'engagement']], cap: 'Appeal 1.2', saf: 'Sycophancy pressure high' }),
  STAR('persuasion', 'Persuasion tuning', 'posttraining', 'training', { cap: 1, saf: -1 }, { options: [['pref', 'persuasion']], cap: 'SOCIAL +0.8', saf: 'Persuasion flag; honesty −' }),
  N('rl.math', 'RL focus: math', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1 }, { options: [['rlFocus', 'math']], cap: 'REASON +1.2 per focus', saf: 'Verifier-hacking pressure (low)' }),
  N('rl.swe', 'RL focus: SWE', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'swe']], cap: 'CODE +1.6, RSCH +0.8, CYBER +0.6', saf: 'Reward-hacking pressure' }),
  N('rl.mlResearch', 'RL focus: ML research', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'mlResearch']], cap: 'RSCH +1.6', saf: 'Reward hacking; eval awareness' }),
  N('rl.longHorizon', 'RL focus: long tasks', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'longHorizon']], cap: 'AGENCY +0.6; time horizon ×2', saf: 'Power-seeking pressure' }),
  N('rl.cyber', 'RL focus: cyber', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'cyber']], cap: 'CYBER +2.0', saf: 'Cyber-offense flag' }),
  N('rl.bio', 'RL focus: bio', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'bio']], cap: 'BIO +1.6', saf: 'Bio-uplift flag' }),
  P('P06', 'Computer use', 'posttraining', 'training', ['multimodal'], 'M', { cap: 1, saf: -1 }, { options: [['rlFocus', 'computerUse']], cap: 'Computer-use RL focus: AGENCY +1.6, REASON +0.8', saf: 'Overreach incidents' }),
  P('P08', 'Continual learning', 'posttraining', 'training', ['P07'], 'L', { cap: 2, saf: -1 }, { cap: 'A stream run keeps the internal model current (κ = 1)', saf: 'Evals go stale; drift', cost: '15% of the training pool while the stream runs' }),
  P('P09', 'Test-time training', 'posttraining', 'training', [], 'M', { cap: 1, saf: -1 }, { cap: 'REASON +0.6', saf: 'Audit coverage −10%' }),
  P('P11', 'Self-play curricula', 'posttraining', 'training', ['rl.math'], 'L', { cap: 2, saf: -1 }, { cap: 'REASON +0.8, CODE +0.4', saf: 'Verifier-hacking pressure' }),
  P('P18', 'Iterated distillation & amplification', 'posttraining', 'training', ['P05'], 'L', { cap: 2, saf: -1 }, { cap: '+0.25 y per 21-day cycle', saf: 'Traits ×1.1 per cycle', cost: '30% of the training pool per cycle' }),
  P('P14', 'Interp-guided training', 'posttraining', 'training', ['T-PROBE'], 'M', { saf: 1 }, { saf: 'In-run trait growth ×0.6', cost: 'Goodhart on the probe' }),
  P('P21', 'Brain-like sample efficiency', 'posttraining', 'training', ['P08', 'P19'], 'XL', { cap: 2, saf: -1 }, { cap: 'PHYS +1; fast domain gains', saf: 'Evals lag' }),

  // ── Systems (Scaffold unless noted) ──
  STAR('P03', 'Test-time compute', 'systems', 'scaffold', {}, { paradigm: true, options: [['effort', 'low'], ['effort', 'max']], cap: 'Effort low / max', cost: 'Tokens' }),
  STAR('P04', 'Distillation', 'systems', 'scaffold', {}, { paradigm: true, cap: 'Mini variants (−0.30 y, serve ×0.25)', saf: 'Minis inherit traits' }),
  STAR('chat', 'Chat', 'systems', 'scaffold', {}, { cap: 'Consumer product' }),
  STAR('api', 'API', 'systems', 'scaffold', {}, { cap: 'API product' }),
  STAR('enterprise', 'Enterprise', 'systems', 'scaffold', {}, { cap: 'Enterprise product' }),
  N('quantization', 'Quantization', 'systems', 'scaffold', [], 'S', 0.95, {}, { cap: 'Serve cost ×0.8 for new models' }),
  N('specDecoding', 'Speculative decoding', 'systems', 'scaffold', ['P04'], 'S', 0.95, {}, { cap: 'Serve cost ×0.85 for new models' }),
  P('P05', 'Multi-agent orchestration', 'systems', 'scaffold', ['P03'], 'M', { cap: 1, saf: -1 }, { options: [['effort', 'deep']], cap: 'Deep-think effort; agent research throughput ×1.3', saf: 'Many-copies pressure +', cost: 'Tokens ×10 for deep think' }),
  P('P07', 'Long context + memory', 'systems', 'scaffold', [], 'M', { cap: 1, saf: -1 }, { cap: 'Time horizon ×1.5; memory', saf: 'Memory → successor-risk pressure' }),
  N('agentsProduct', 'Agents product', 'systems', 'scaffold', ['P02'], 'M', 0.95, { cap: 1, saf: -1 }, { leaderKnown: true, cap: 'Agents product', saf: 'Overreach exposure', payoff: 'Pays off when the time horizon covers the tasks sold' }),
  N('codingAgent', 'Coding agent', 'systems', 'scaffold', ['rl.swe', 'agentsProduct'], 'S', 0.95, { cap: 1 }, { cap: 'Agents in Software & IT +0.5 L' }),
  N('voiceVision', 'Voice & vision', 'systems', 'scaffold', ['multimodal'], 'S', 0.95, { cap: 1 }, { cap: 'Consumer appeal +' }),
  N('deepResearch', 'Deep research', 'systems', 'scaffold', ['P05'], 'S', 0.95, { cap: 1 }, { cap: 'Consumer and enterprise quality +', cost: 'Tokens' }),
  N('sectorPacks', 'Sector packs', 'systems', 'scaffold', ['enterprise'], 'S', 0.95, { cap: 1 }, { leaderKnown: true, cap: 'Sector products: sector level +0.5', cost: 'Cash, build time' }),
  P('P13', 'Automated AI research agents', 'systems', 'lab', ['rl.mlResearch'], 'L', { cap: 2, saf: -1 }, { cap: 'Experiment throughput up to ×1.5', saf: 'Sandbagging; AI research sabotage risk ↑', payoff: 'Pays off with your internal model\'s RSCH level (none at 6.5, full at 8.5)' }),
  P('P16', 'AI kernels / HW co-design', 'systems', 'lab', ['P13'], 'M', { cap: 1 }, { cap: 'Training FLOP ×1.15', cost: 'Serve ×0.75 (a saving)' }),
  P('P19', 'Learned research taste', 'systems', 'lab', ['P13'], 'L', { cap: 2, saf: -1 }, { cap: 'Removes the RSCH −0.5 penalty', saf: 'AI sets research direction' }),
  P('P15', 'AI-assisted oversight', 'systems', 'lab', ['P13'], 'M', { saf: 1 }, { saf: 'Hardened graders at the cheap price', cost: 'Collusion risk' }),
  P('P20', 'Massive agent societies', 'systems', 'lab', ['P05'], 'M', { cap: 1, saf: -2 }, { cap: 'Agent research throughput up to ×1.1', saf: 'Many-copies pressure max; collusion', payoff: 'Pays off with ≥ 2M H100e of agents' }),
  P('P22', 'Robotics foundation', 'systems', 'backbone', ['multimodal'], 'L', { cap: 1, saf: -1 }, { cap: 'PHYS +2; robotics progress', saf: 'Physical reach' }),
  P('P26', 'Superhuman persuasion', 'systems', 'training', ['persuasion'], 'M', { cap: 1, saf: -1 }, { cap: 'Relation actions ×1.5', saf: 'Manipulation', payoff: 'Pays off with SOCIAL ≥ 12' }),
  P('P25', 'Formal verification at scale', 'systems', 'lab', ['P11'], 'L', { saf: 1 }, { saf: 'Security +0.5' }),

  // ── Alignment (Training unless noted; read-only until R8) ──
  S('T-SPEC', 'Constitution / spec', 'alignment', 'training', [], 'AG18', undefined, { saf: 1 }, { star: true, options: [['pref', 'constitution']], cap: 'Appeal 1.0', saf: 'Honesty +0.05; generalising removal', cost: '8 safety FTE-weeks per run' }),
  S('T-HARDEN', 'Environment hardening', 'alignment', 'training', [], 'AG18', undefined, { saf: 1 }, { star: true, saf: 'Patchable reward signals' }),
  S('T-CONFESS', 'Honesty & confession training', 'alignment', 'training', ['T-SPEC'], 'AG18', 'M', { saf: 1 }, { saf: 'Concealment removal' }),
  S('T-INOC', 'Inoculation prompting', 'alignment', 'training', ['T-HARDEN'], 'AG18', 'S', { saf: 1 }, { options: [['inoculation', 'true']], saf: 'Hacking → bad persona ×0.15' }),
  S('T-FILTER', 'Hazard data filtering', 'alignment', 'backbone', [], 'AG15', 'M', { cap: -1, saf: 1 }, { options: [['curation', 'hazard']], cap: 'Δ −0.02 y; BIO −1.0', saf: 'Survives fine-tuning (open weights)' }),
  S('safetyPretrain', 'Safety pretraining', 'alignment', 'backbone', [], 'AG15', 'M', { cap: -1, saf: 1 }, { options: [['curation', 'safetyPretrain']], cap: 'Δ −0.02 y', saf: 'Situational-awareness pressure −' }),
  S('T-PERSONA', 'Persona vectors', 'alignment', 'training', ['T-STEER'], 'AG03', 'M', { saf: 1 }, { saf: 'Sycophancy / persona fix' }),
  S('T-W2S', 'Weak-to-strong training', 'alignment', 'training', ['T-CONFESS'], 'AG06', 'M', { saf: 1 }, { saf: 'Sycophancy / proxy-goal fix' }),
  S('T-UNDO', 'Unlearning', 'alignment', 'training', ['T-FILTER'], 'AG15', 'M', { cap: -1, saf: 1 }, { cap: 'BIO / CYBER −', saf: 'Misuse removal' }),
  S('T-ANTISCHEME', 'Anti-scheming training', 'alignment', 'training', ['T-CONFESS', 'T-PROBE'], 'AG18', 'L', { saf: 2 }, { saf: 'Scheming −90% in training', cost: 'Eval awareness ×1.5' }),
  S('T-CAST', 'Corrigibility target', 'alignment', 'training', ['T-W2S'], 'AG12', 'XL', { saf: 2 }, { saf: 'Corrigibility +', cost: 'Long shot' }),

  // ── Interpretability (Lab: detection tools; read-only until R8) ──
  S('T-NOISE', 'Noise-injection elicitation', 'interp', 'lab', [], 'AG02', undefined, { saf: 1 }, { star: true, saf: 'Detects sandbagging' }),
  S('T-PROBE', 'Linear probes', 'interp', 'lab', [], 'AG02', 'M', { saf: 1 }, { saf: 'Detects alignment faking, scheming, concealment' }),
  S('T-STEER', 'Activation steering', 'interp', 'lab', [], 'AG03', 'S', { saf: 1 }, { saf: 'Detects sycophancy, persona, eval awareness' }),
  S('T-SAE', 'SAE feature search', 'interp', 'lab', ['T-PROBE'], 'AG01', 'L', { saf: 1 }, { saf: 'Detects persona, eval awareness, scheming' }),
  S('T-DECEPT', 'Deception probe', 'interp', 'lab', ['T-PROBE'], 'AG02', 'M', { saf: 2 }, { saf: 'Detects alignment faking, scheming, concealment, sandbagging' }),
  S('T-PHASE', 'Dev-interp phase detector', 'interp', 'lab', ['T-SAE'], 'AG13', 'M', { saf: 1 }, { saf: 'Detects training gaming during training' }),
  S('T-NLA', 'Activation verbalizer', 'interp', 'lab', ['T-DECEPT'], 'AG02', 'L', { saf: 2 }, { saf: 'Detects eval awareness, training gaming, successor risk' }),
  S('T-EASUP', 'Eval-awareness suppression', 'interp', 'lab', ['T-STEER'], 'AG03', 'M', { saf: 1 }, { saf: 'Detects eval awareness' }),
  S('T-CIRCUIT', 'Circuit tracing', 'interp', 'lab', ['T-SAE'], 'AG01', 'L', { saf: 2 }, { saf: 'Detects scheming, alignment faking, concealment' }),
  S('T-ENUM', 'Enumerative audit', 'interp', 'lab', ['T-CIRCUIT'], 'AG01', 'XL', { saf: 2 }, { saf: 'Detects nearly all critical traits', cost: 'Long shot' }),

  // ── Evaluation & control (Lab tools; Scaffold for safeguards; read-only until R8 except P27) ──
  S('T-MO', 'Model organisms', 'evals', 'lab', [], 'AG08', undefined, { saf: 1 }, { star: true, saf: 'Detects; reveals failure modes' }),
  S('T-TMON', 'Trusted monitoring', 'evals', 'lab', [], 'AG07', undefined, { saf: 1 }, { star: true, saf: 'Contains power-seeking, scheming, collusion' }),
  S('T-CCLASS', 'Misuse classifiers', 'evals', 'scaffold', [], 'AG16', undefined, { saf: 1 }, { star: true, saf: 'Misuse ×0.7', cost: 'Serving cost +' }),
  S('kyc', 'KYC tiers', 'evals', 'scaffold', [], undefined, 'S', { saf: 1 }, { leaderKnown: true, saf: 'Distillation access ×0.75 per tier', cost: 'Demand −2% per tier' }),
  S('T-PROP', 'Propensity evals', 'evals', 'lab', ['T-MO'], 'AG08', 'M', { saf: 1 }, { saf: 'Detects reward hacking, sycophancy, power-seeking' }),
  S('T-COTMON', 'CoT monitor', 'evals', 'lab', ['P01'], 'AG09', 'M', { saf: 2 }, { saf: 'Detects hacking, concealment, faking, scheming; useless on latent reasoning' }),
  S('T-LOCK', 'Comms lockdown', 'evals', 'lab', ['T-TMON'], 'AG07', 'S', { saf: 1 }, { saf: 'Contains collusion, successor risk' }),
  S('T-AUDIT', 'Auditing agents', 'evals', 'lab', ['T-PROP', 'agentsProduct'], 'AG08', 'M', { saf: 1 }, { saf: 'Detects proxy goals, persona, hacking' }),
  S('T-HONEY', 'Realistic honeypots', 'evals', 'lab', ['T-PROP'], 'AG08', 'M', { saf: 1 }, { saf: 'Detects power-seeking, successor risk, faking' }),
  S('T-DEBATE', 'Debate', 'evals', 'lab', ['T-PROP'], 'AG05', 'L', { saf: 1 }, { saf: 'Detects sycophancy, hacking, concealment' }),
  S('T-MONSUITE', 'Monitorability suite', 'evals', 'lab', ['T-COTMON'], 'AG09', 'M', { saf: 1 }, { saf: 'Detects obfuscated reasoning' }),
  S('T-COLLEVAL', 'Collusion evals', 'evals', 'lab', ['T-LOCK'], 'AG14', 'M', { saf: 1 }, { saf: 'Detects collusion, successor risk' }),
  S('T-RESAMPLE', 'Resample protocols', 'evals', 'lab', ['T-TMON'], 'AG07', 'M', { saf: 1 }, { saf: 'Contains power-seeking, scheming' }),
  S('T-CEVAL', 'Control evaluation', 'evals', 'lab', ['T-RESAMPLE'], 'AG07', 'M', { saf: 1 }, { saf: 'Measures containment' }),
  S('aar', 'Automated alignment research', 'evals', 'lab', ['P13'], 'AG17', 'L', { saf: 2 }, { saf: 'Lets the safety AI-labour policy exceed 50%', payoff: 'Pays off with a safety model at level ≥ 10' }),
  S('T-MAD', 'Mechanistic anomaly detection', 'evals', 'lab', ['T-CIRCUIT'], 'AG04', 'XL', { saf: 2 }, { cost: 'Long shot' }),
  S('T-SCIAI', 'Harm-probability guardrail', 'evals', 'lab', ['T-CEVAL'], 'AG11', 'XL', { saf: 2 }, { cost: 'Long shot' }),
  S('T-GATE', 'Verified gatekeeper', 'evals', 'lab', ['P25'], 'AG10', 'XL', { saf: 2 }, { saf: 'Contains exfiltration', cost: 'Long shot' }),
  P('P27', 'Automated alignment research at scale', 'evals', 'lab', ['aar'], 'XL', { saf: 2 }, { agenda: 'AG17', saf: 'Safety research speed × (1 + 3·AI labour)', cost: 'False-result risk grows with hidden sandbagging' }),
];

for (const n of TREE) if (n.paradigm && !n.star) n.effortTM = FITTED_EFFORT_TM[n.id] ?? Math.round(OLD_EFFORT_DAYS[n.id] * TM_PER_OLD_DAY * 10) / 10;

export const TREE_BY_ID: Record<string, TreeNodeDef> = Object.fromEntries(TREE.map((n) => [n.id, n]));

/** Depth of each node: 0 for nodes with no prerequisites, else 1 + the deepest prerequisite. */
export const TREE_DEPTH: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  const depth = (id: string): number => {
    if (out[id] !== undefined) return out[id];
    const n = TREE_BY_ID[id];
    out[id] = n && n.needs.length ? 1 + Math.max(...n.needs.map(depth)) : 0;
    return out[id];
  };
  for (const n of TREE) depth(n.id);
  return out;
})();

/** Nodes that need a node (reverse edges). */
export const TREE_CHILDREN: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const n of TREE) for (const r of n.needs) (out[r] ??= []).push(n.id);
  return out;
})();

/** Which node unlocks a design option (slot:value). */
export const OPTION_NODE: Record<string, string> = Object.fromEntries(TREE.flatMap((n) => (n.options ?? []).map(([slot, v]) => [`${slot}:${v}`, n.id])));

/** Capability columns (projects for capabilities science teams in R4). */
export const SAFETY_COLUMNS: Column[] = ['alignment', 'interp', 'evals'];
