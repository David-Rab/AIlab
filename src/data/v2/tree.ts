// The shared tech tree (design/TECH-TREE.md §2, BUILD-PLAN R4). Owner: WS1.
// One node = one idea. Six columns of expertise (science-team specialties), drawn as horizontal lanes; depth (how many
// ideas a node builds on) runs left to right. Knowledge is gated only by knowledge: a node opens when its `needs` are
// known; there are no capability gates. Some ideas only pay off with a capable model or enough compute (`payoff`),
// shown on the node card.
//
// Capability nodes are research projects (model v3 V2: design/MODEL-V3.md §5, design/TECH-TREE.md §6; engine
// models/research.ts): kind line (repeatable direction, generations), idea (one-off typed effect) or axis (unlocks a
// lever, may carry an effect). Each runs ideation (science teams) → small experiments → scale test (research engineers
// and experiment FLOP) → result → adoption (engineers), at research pace × √capacity; capacity = Σ heads/40 × quality ×
// 1.5 if the team's specialty is the node's column. Effort is in standard-team-months at pace 1. Paradigm nodes (P-ids)
// use the hidden paradigm draw on their first attempt; other nodes hash32(seed, 'node:'+id). A failed project can be
// reopened as speculative (half the odds, a wider prior).
//
// Safety nodes (alignment, interpretability, evals & control) are projects for safety science teams (R8). A node with a
// research line (`agenda`) does not roll odds: each time its progress reaches 1 the line produces one result
// (safety/findings.ts fireFinding, drawn from the line's hidden efficacy); a working-tool result unlocks the node's
// technique and makes the node known, any other result (dead end, negative, discovery…) restarts the project. Its effort
// is the line's T₁ at serious staffing (data/v2/agendas.ts SERIOUS_CAP). Every line also has a follow-up project
// (LINE_NODES, not drawn on the tree) that keeps producing results once its ideas are known.
// Product-feature nodes (Scaffold) are projects like any other; a known feature node lets the engineers build the feature (R6).
import type { AgendaId, Column, DomainId, RLFamily, StackKey } from '../../engine/v2/types';
import { AGENDAS, AGENDA_BY_ID, SERIOUS_CAP } from './agendas';
import { P10_SYN_Q_RAISE, P21_WORTH_OOM } from './dataAssets';
import { P12_DEMO_T } from './suites';

export type Layer = 'backbone' | 'training' | 'scaffold' | 'lab';
export type EffortClass = 'S' | 'M' | 'L' | 'XL';
/** Design-option slots a node can unlock (run designer, deployments). */
export type OptionSlot = 'shape' | 'tpp' | 'data' | 'curation' | 'pref' | 'rlFocus' | 'graders' | 'cot' | 'inoculation' | 'effort';

/** Capability project kinds (MODEL-V3 §5.1, V3-BUILD V2.2). */
export type ProjectKind = 'line' | 'idea' | 'axis';
/** A capability project's typed effect (MODEL-V3 §5.2). The project's scalar effect x is in this unit: OOM of the stack
 *  for stack effects, "1 = as designed" for domain, data and expert-data effects and unlocks. */
export interface ProjectEffect {
  /** Stack the effect enters (absent: an unlock or a domain effect). */
  stack?: StackKey;
  /** Prior mean of a candidate's small-scale effect (lines: generation 1's μ₁ before LINE_MU_SCALE). */
  mean: number;
  /** Relative sd of the hidden per-world draw of the project's mean (default PROJECT_SD). */
  sd?: number;
  /** Scale-exponent prior [mean, sd]: effect × (FLOP_run ÷ FLOP_test)^s (default [0, 0]). */
  s?: [number, number];
  /** Other stacks moved in proportion to the effect (P16: serving). */
  also?: Partial<Record<StackKey, number>>;
  /** Domain effect for versions trained after adoption, OOM per unit of the effect. */
  domains?: Partial<Record<DomainId, number>>;
  /** Data efficiency (MODEL-V3 §5.2, model v3 D9), per unit of the effect: `synQMax` raises the synthetic-quality ceiling
   *  (q, the web = 1; production/data.ts syntheticQuality) for data generated after adoption; `worthOom` = OOM more
   *  effective tokens per drawn token in the loss law (D_eff × 10^x, models/runs.ts baseG through the draw). */
  data?: { synQMax?: number; worthOom?: number };
  /** Expert data delivered at adoption into a family's suite (T tokens per unit of the effect; the suite's fidelity
   *  reads it, models/suites.ts), paid at the expert-data price on delivery (model v3 D9). */
  expert?: { family: RLFamily; tokensT: number };
  /** Lines: the line's share w_l of the lab's returns to research r (r_l = w_l·r; the G-carrying lines sum to 1: their
   *  shares of the lab's start software progress) [D, V3 notes derivation 1]. */
  rShare?: number;
}

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
  /** Safety nodes: the technique this node unlocks (known when it is unlocked, by this project or another result). */
  technique?: string;
  /** Safety nodes without a technique: the catalog finding a working result of this project is (e.g. aar → F44). */
  finding?: string;
  /** A line's follow-up project (LINE_NODES): never known, each result is the line's next finding. */
  followUp?: boolean;
  /** Known at the start by every company (public knowledge in Jul 2025). */
  star?: boolean;
  /** Not researchable yet: product features become projects with live products. */
  soon?: 'products';
  /** Design options this node unlocks. */
  options?: [OptionSlot, string][];
  /** Cash ($B) booked when an attempt starts. */
  cashCost?: number;
  /** Capability projects (model v3 V2): kind and typed effect (absent effect = an unlock). */
  kind?: ProjectKind;
  effect?: ProjectEffect;
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
/** RefBot's projects, fitted (model v3 V2) so each successful attempt through the research lifecycle lasts as long as
 *  under V1 (`npx tsx scripts/v2/calib.ts --fit-tree`); P05 and P19 (they fail in the fit world) take the fitted ones'
 *  mean ratio (×0.6). Late projects (P13 at RSCH 8.5, P17 at L 9.5) start when research pace is already 3–8×. */
export const FITTED_EFFORT_TM: Record<string, number> = { P05: 4.6, P07: 3.34, P08: 12.32, P13: 79.62, P17: 65.97, P19: 29, 'rl.mlResearch': 1.36 };

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
/** Capability line (model v3 V2): a repeatable research direction; each generation is one adopted idea (batch). */
const LINE = (id: string, name: string, column: Column, needs: string[], effect: ProjectEffect, text: Partial<TreeNodeDef> = {}): TreeNodeDef =>
  ({ id, name, column, layer: effect.stack === 'serve' ? 'scaffold' : effect.stack === 'pre' ? 'backbone' : 'training', needs, effort: 'S', kind: 'line', effect, fx: { cap: 1 }, ...text });
/** Safety node: a project for safety science teams on its research line (R8). */
const S = (id: string, name: string, column: Column, layer: Layer, needs: string[], agenda: AgendaId | undefined, effort: EffortClass | undefined, fx: TreeNodeDef['fx'], text: Partial<TreeNodeDef> = {}): TreeNodeDef =>
  ({ id, name, column, layer, needs, effort, fx, ...(agenda ? { agenda } : {}), ...(id.startsWith('T-') ? { technique: id } : {}), ...text });

const SAFETY_COLUMNS_SET = new Set<Column>(['alignment', 'interp', 'evals']);
export const TREE: TreeNodeDef[] = [
  // ── Pretraining (Backbone unless noted) ──
  STAR('moe', 'MoE', 'pretraining', 'backbone', {}, { options: [['shape', 'moe']], cap: 'Reference architecture: 8× total parameters per active one', cost: 'Memory for 8× the active parameters' }),
  STAR('dense', 'Dense', 'pretraining', 'backbone', { cap: -1 }, { options: [['shape', 'dense']], cap: '−0.3 OOM effective compute vs MoE', cost: 'Same serving FLOP per active parameter' }),
  STAR('qualityFilter', 'Quality filter', 'pretraining', 'backbone', {}, { options: [['data', 'balanced']], cap: 'Balanced mix: every domain in proportion to the data you hold' }),
  STAR('codeMath', 'Code & math data', 'pretraining', 'backbone', { cap: 1 }, { options: [['data', 'codeMath']], cap: 'Draw code ×3, math and research papers ×2, security ×1.5: raises CODE, REASON, RSCH; lowers the rest' }),
  LINE('L.scale', 'Scaling recipes', 'pretraining', [], { stack: 'pre', mean: 0.012, s: [0.05, 0.04], rShare: 0.36 }, { cap: 'Architecture and compute rebalancing at scale: pretraining efficiency (OOM); grows with run FLOP', payoff: 'Most measured algorithmic progress is scale-dependent (Gundlach et al.)' }),
  LINE('L.data', 'Data filtering & mixing', 'pretraining', [], { stack: 'pre', mean: 0.012, s: [0, 0.05], rShare: 0.22 }, { cap: 'Better data for the same tokens: pretraining efficiency (OOM)' }),
  LINE('L.opt', 'Optimizer & architecture tweaks', 'pretraining', [], { stack: 'pre', mean: 0.02, s: [-0.25, 0.2], rShare: 0.22 }, { cap: 'Small scale-invariant gains: pretraining efficiency (OOM); a quarter of small-scale wins survive at scale' }),
  LINE('L.latent', 'Recurrent architectures', 'pretraining', ['P17'], { stack: 'pre', mean: 0.012, s: [0.05, 0.04], rShare: 0.22 }, { cap: 'A fresh pool opened by neuralese recurrence: pretraining efficiency (OOM)' }),
  N('scienceData', 'Science data', 'pretraining', 'backbone', [], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['data', 'science']], cap: 'Draw bio ×3, math and research ×1.5: raises BIO; lowers the rest', saf: 'Bio-uplift flag risk', cost: '+5% run cash' }),
  N('multimodal', 'Native multimodal', 'pretraining', 'backbone', [], 'M', 0.9, { cap: 1 }, { options: [['data', 'multimodal']], cap: 'Draw media and physical ×3, agency ×2: raises MEDIA, PHYS, AGENCY; lowers the rest', cost: '+20% FLOP' }),
  STAR('overtrained', 'Overtrained compact', 'pretraining', 'backbone', { cap: -1 }, { options: [['tpp', 'over']], cap: 'Any tokens per parameter: overtraining costs effective compute (100 → ×0.8, 200 → ×0.63)', cost: 'Serves cheaper: fewer active parameters for the same FLOP' }),
  STAR('faultTolerant', 'Fault-tolerant training', 'pretraining', 'backbone', {}, { cap: 'Checkpointing and restarts: part of the 0.90 goodput every lab has' }),
  N('elastic', 'Elastic training', 'pretraining', 'backbone', [], 'M', 0.9, { cap: 1 }, { kind: 'idea', effect: { stack: 'train', mean: 0.023, sd: 0.3 }, cap: 'Training throughput +0.023 OOM (goodput 0.90 → 0.95)' }),
  P('P10', 'Synthetic data flywheel', 'pretraining', 'backbone', ['codeMath'], 'L', { cap: 1, saf: -1 }, { kind: 'axis', effect: { mean: 1, sd: 0.3, data: { synQMax: P10_SYN_Q_RAISE } }, options: [['data', 'synthetic']], cap: 'Generated data can beat web text: the quality ceiling of synthetic data rises from the web\'s 1 to 1.5 (strong teachers, rephrasing, filtering); unlocks the synthetic-heavy mix', saf: 'Reward-model exploitation ×1.5; inherits teacher traits', payoff: 'Pays off with a teacher well above V0 (quality 1 at +2 OOM, 1.5 at +4 OOM)' }),
  P('P12', 'Long-horizon human demos', 'pretraining', 'backbone', [], 'L', { cap: 1 }, { kind: 'idea', effect: { mean: 1, sd: 0.25, expert: { family: 'longHorizon', tokensT: P12_DEMO_T } }, cap: 'Experts record days-long work: 20B tokens of demonstrations join the long-tasks suite (fidelity 1 → 1.35 from the start stock), raising its RL ceiling and so the time horizon', cost: '$1B at the expert-data price ($0.05 a token), paid when the demos are delivered (adoption)' }),
  P('P23', 'Faithful-CoT architecture', 'pretraining', 'backbone', ['T-COTMON'], 'L', { cap: -1, saf: 2 }, { options: [['cot', 'faithful']], cap: 'Δ −0.24 y', saf: 'Monitorability 0.98', cost: 'Serve ×1.2' }),
  P('P17', 'Neuralese recurrence', 'pretraining', 'backbone', ['P01', 'P07'], 'XL', { cap: 2, saf: -2 }, { options: [['shape', 'latent']], cap: '+0.5 OOM effective compute on a latent base', saf: 'CoT monitoring dies (monitorability 0.05)', cost: 'Serve ×0.4 (no verbal reasoning tokens)' }),
  P('P24', 'AI-designed successor', 'pretraining', 'backbone', ['P13', 'P19'], 'XL', { cap: 2, saf: -1 }, { cap: 'Next base +1 OOM recipe', saf: 'New lineage: traits redrawn, tools may not transfer', payoff: 'Pays off with research done mostly by AI (AI share of research labour 50% → 90%)' }),

  // ── Post-training (Training unless noted) ──
  STAR('P01', 'Visible reasoning', 'posttraining', 'training', { saf: 1 }, { paradigm: true, options: [['cot', 'visible']], cap: 'Baseline reasoning (reasoning RL)', saf: 'Monitorable chain of thought' }),
  STAR('P02', 'Agentic environments', 'posttraining', 'training', {}, { paradigm: true, cap: 'Baseline agents' }),
  STAR('hardenedGraders', 'Hardened graders', 'posttraining', 'training', { saf: 1 }, { options: [['graders', 'hardened']], cap: 'Reference graders (no capability effect)', saf: 'Reward hacking ×0.4 vs cheap graders', cost: 'RL environment budget' }),
  STAR('engagement', 'Engagement tuning', 'posttraining', 'training', { cap: 1, saf: -1 }, { options: [['pref', 'engagement']], cap: 'Appeal 1.2', saf: 'Sycophancy pressure high' }),
  STAR('persuasion', 'Persuasion tuning', 'posttraining', 'training', { cap: 1, saf: -1 }, { options: [['pref', 'persuasion']], cap: 'SOCIAL +0.8', saf: 'Persuasion flag; honesty −' }),
  LINE('L.rlalg', 'RL algorithms', 'posttraining', [], { stack: 'rlMid', mean: 0.015, rShare: 0.08 }, { cap: 'RL compute efficiency (OOM): the RL curve reaches its ceiling with less RL compute' }),
  LINE('L.env', 'Environments & rewards', 'posttraining', [], { stack: 'rlCeil', mean: 0.006, rShare: 0.12 }, { cap: 'RL ceiling (OOM): better environments and graders raise what RL can reach' }),
  N('rl.math', 'RL focus: math', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1 }, { options: [['rlFocus', 'math']], cap: 'REASON +1.2 per focus', saf: 'Verifier-hacking pressure (low)' }),
  N('rl.swe', 'RL focus: SWE', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'swe']], cap: 'CODE +1.6, RSCH +0.8, CYBER +0.6', saf: 'Reward-hacking pressure' }),
  N('rl.mlResearch', 'RL focus: ML research', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'mlResearch']], cap: 'RSCH +1.6', saf: 'Reward hacking; eval awareness' }),
  N('rl.longHorizon', 'RL focus: long tasks', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'longHorizon']], cap: 'AGENCY +0.6; time horizon ×2', saf: 'Power-seeking pressure' }),
  N('rl.cyber', 'RL focus: cyber', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'cyber']], cap: 'CYBER +2.0', saf: 'Cyber-offense flag' }),
  N('rl.bio', 'RL focus: bio', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { options: [['rlFocus', 'bio']], cap: 'BIO +1.6', saf: 'Bio-uplift flag' }),
  P('P06', 'Computer use', 'posttraining', 'training', ['multimodal'], 'M', { cap: 1, saf: -1 }, { options: [['rlFocus', 'computerUse']], cap: 'Computer-use RL focus: AGENCY +1.6, REASON +0.8', saf: 'Overreach incidents' }),
  P('P08', 'Continual learning', 'posttraining', 'training', ['P07'], 'L', { cap: 2, saf: -1 }, { cap: 'A stream run keeps the internal model current (κ = 1)', saf: 'Evals go stale; drift', cost: '15% of the training pool while the stream runs' }),
  P('P09', 'Test-time training', 'posttraining', 'training', [], 'M', { cap: 1, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.4, domains: { REASON: 0.3 } }, cap: 'REASON +0.3 OOM for new versions', saf: 'Audit coverage −10%' }),
  P('P11', 'Self-play curricula', 'posttraining', 'training', ['rl.math'], 'L', { cap: 2, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.4, domains: { REASON: 0.66, CODE: 0.33 } }, cap: 'REASON +0.66, CODE +0.33 OOM for new versions', saf: 'Verifier-hacking pressure' }),
  P('P18', 'Iterated distillation & amplification', 'posttraining', 'training', ['P05'], 'L', { cap: 2, saf: -1 }, { cap: 'One more RL budget (0.15 × the base FLOP) on the RL curve per cycle', saf: 'Traits ×1.1 per cycle', cost: 'RL compute (30% of the training pool while it runs)' }),
  P('P14', 'Interp-guided training', 'posttraining', 'training', ['T-PROBE'], 'M', { saf: 1 }, { saf: 'In-run trait growth ×0.6', cost: 'Goodhart on the probe' }),
  P('P21', 'Brain-like sample efficiency', 'posttraining', 'training', ['P08', 'P19'], 'XL', { cap: 2, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.6, data: { worthOom: P21_WORTH_OOM } }, cap: 'Learns more from each token: every drawn token is worth ×2 in the loss law (wide uncertainty), most valuable where data is short', saf: 'Evals lag' }),

  // ── Systems (Scaffold unless noted) ──
  STAR('P03', 'Test-time compute', 'systems', 'scaffold', {}, { paradigm: true, options: [['effort', 'low'], ['effort', 'max']], cap: 'Effort low / max', cost: 'Tokens' }),
  STAR('P04', 'Distillation', 'systems', 'scaffold', {}, { paradigm: true, cap: 'Mini variants: a smaller student below its teacher (the distillation gap), serving ∝ its parameters', saf: 'Minis inherit traits' }),
  STAR('quantization', 'Quantization', 'systems', 'scaffold', {}, { cap: 'Part of the reference serving cost every lab has (2025 practice)' }),
  STAR('specDecoding', 'Speculative decoding', 'systems', 'scaffold', {}, { cap: 'Part of the reference serving cost every lab has (2025 practice)' }),
  LINE('L.infer', 'Inference efficiency', 'systems', [], { stack: 'serve', mean: 0.05, rShare: 0.15 }, { cap: 'Serving efficiency (OOM less serving FLOP per token) for versions trained after it' }),
  P('P05', 'Multi-agent orchestration', 'systems', 'scaffold', ['P03'], 'M', { cap: 1, saf: -1 }, { options: [['effort', 'deep']], cap: 'Deep-think effort; agent research throughput ×1.3', saf: 'Many-copies pressure +', cost: 'Tokens ×10 for deep think' }),
  P('P07', 'Long context + memory', 'systems', 'scaffold', [], 'M', { cap: 1, saf: -1 }, { cap: 'Time horizon ×1.2 (horizon extender) [D]; memory', saf: 'Memory → successor-risk pressure' }),
  P('P13', 'Automated AI research agents', 'systems', 'lab', ['rl.mlResearch'], 'L', { cap: 2, saf: -1 }, { cap: 'Experiment throughput up to ×1.5', saf: 'Sandbagging; AI research sabotage risk ↑', payoff: 'Pays off with your internal model\'s RSCH level (none at 6.5, full at 8.5)' }),
  P('P16', 'AI kernels / HW co-design', 'systems', 'lab', ['P13'], 'M', { cap: 1 }, { kind: 'idea', effect: { stack: 'train', mean: 0.06, sd: 0.3, also: { serve: 0.125 / 0.06 } }, cap: 'Training throughput +0.06 OOM (×1.15); serving −0.125 OOM (×0.75)' }),
  P('P19', 'Learned research taste', 'systems', 'lab', ['P13'], 'L', { cap: 2, saf: -1 }, { cap: 'Removes the RSCH −0.5 penalty', saf: 'AI sets research direction' }),
  P('P15', 'AI-assisted oversight', 'systems', 'lab', ['P13'], 'M', { saf: 1 }, { saf: 'Hardened graders at the cheap price', cost: 'Collusion risk' }),
  P('P20', 'Massive agent societies', 'systems', 'lab', ['P05'], 'M', { cap: 1, saf: -2 }, { cap: 'Agent research throughput up to ×1.1', saf: 'Many-copies pressure max; collusion', payoff: 'Pays off with ≥ 2M H100e of agents' }),
  P('P22', 'Robotics foundation', 'systems', 'backbone', ['multimodal'], 'L', { cap: 1, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.4, domains: { PHYS: 1.65 } }, cap: 'PHYS +1.65 OOM for new versions; robotics progress', saf: 'Physical reach' }),
  P('P25', 'Formal verification at scale', 'systems', 'lab', ['P11'], 'L', { saf: 1 }, { saf: 'Weight security: defence +0.5 level against theft' }),

  // ── Alignment (Training unless noted) ──
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

  // ── Interpretability (Lab: detection tools) ──
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

  // ── Evaluation & control (Lab tools; Scaffold for safeguards) ──
  S('T-MO', 'Model organisms', 'evals', 'lab', [], 'AG08', undefined, { saf: 1 }, { star: true, saf: 'Detects; reveals failure modes' }),
  S('T-TMON', 'Trusted monitoring', 'evals', 'lab', [], 'AG07', undefined, { saf: 1 }, { star: true, saf: 'Contains power-seeking, scheming, collusion' }),
  S('T-CCLASS', 'Misuse classifiers', 'evals', 'scaffold', [], 'AG16', undefined, { saf: 1 }, { star: true, saf: 'Misuse ×0.7', cost: 'Serving cost +' }),
  S('kyc', 'KYC tiers', 'evals', 'scaffold', [], undefined, 'S', { saf: 1 }, { saf: 'Distillation access ×0.75 per tier', cost: 'Demand −2% per tier' }),
  S('T-PROP', 'Propensity evals', 'evals', 'lab', ['T-MO'], 'AG08', 'M', { saf: 1 }, { saf: 'Detects reward hacking, sycophancy, power-seeking' }),
  S('T-COTMON', 'CoT monitor', 'evals', 'lab', ['P01'], 'AG09', 'M', { saf: 2 }, { saf: 'Detects hacking, concealment, faking, scheming; useless on latent reasoning' }),
  S('T-LOCK', 'Comms lockdown', 'evals', 'lab', ['T-TMON'], 'AG07', 'S', { saf: 1 }, { saf: 'Contains collusion, successor risk' }),
  S('T-AUDIT', 'Auditing agents', 'evals', 'lab', ['T-PROP', 'P02'], 'AG08', 'M', { saf: 1 }, { saf: 'Detects proxy goals, persona, hacking' }),
  S('T-HONEY', 'Realistic honeypots', 'evals', 'lab', ['T-PROP'], 'AG08', 'M', { saf: 1 }, { saf: 'Detects power-seeking, successor risk, faking' }),
  S('T-DEBATE', 'Debate', 'evals', 'lab', ['T-PROP'], 'AG05', 'L', { saf: 1 }, { saf: 'Detects sycophancy, hacking, concealment' }),
  S('T-MONSUITE', 'Monitorability suite', 'evals', 'lab', ['T-COTMON'], 'AG09', 'M', { saf: 1 }, { saf: 'Detects obfuscated reasoning' }),
  S('T-COLLEVAL', 'Collusion evals', 'evals', 'lab', ['T-LOCK'], 'AG14', 'M', { saf: 1 }, { saf: 'Detects collusion, successor risk' }),
  S('T-RESAMPLE', 'Resample protocols', 'evals', 'lab', ['T-TMON'], 'AG07', 'M', { saf: 1 }, { saf: 'Contains power-seeking, scheming' }),
  S('T-CEVAL', 'Control evaluation', 'evals', 'lab', ['T-RESAMPLE'], 'AG07', 'M', { saf: 1 }, { saf: 'Measures containment' }),
  S('aar', 'Automated alignment research', 'evals', 'lab', ['P13'], 'AG17', 'L', { saf: 2 }, { finding: 'F44', saf: 'Lets the safety AI-labour policy exceed 50%', payoff: 'Pays off with a safety model at level ≥ 10' }),
  S('T-MAD', 'Mechanistic anomaly detection', 'evals', 'lab', ['T-CIRCUIT'], 'AG04', 'XL', { saf: 2 }, { cost: 'Long shot' }),
  S('T-SCIAI', 'Harm-probability guardrail', 'evals', 'lab', ['T-CEVAL'], 'AG11', 'XL', { saf: 2 }, { cost: 'Long shot' }),
  S('T-GATE', 'Verified gatekeeper', 'evals', 'lab', ['P25'], 'AG10', 'XL', { saf: 2 }, { saf: 'Contains exfiltration', cost: 'Long shot' }),
  P('P27', 'Automated alignment research at scale', 'evals', 'lab', ['aar'], 'XL', { saf: 2 }, { agenda: 'AG17', saf: 'Safety research speed × (1 + 3·AI labour)', cost: 'False-result risk grows with hidden sandbagging' }),
];

for (const n of TREE) {
  if (SAFETY_COLUMNS_SET.has(n.column) || n.star) continue;
  n.kind ??= n.effect ? 'idea' : 'axis';
}
for (const n of TREE) {
  if (n.star || n.kind === 'line') continue;
  if (n.paradigm) n.effortTM = FITTED_EFFORT_TM[n.id] ?? Math.round(OLD_EFFORT_DAYS[n.id] * TM_PER_OLD_DAY * 10) / 10;
  else if (FITTED_EFFORT_TM[n.id] !== undefined) n.effortTM = FITTED_EFFORT_TM[n.id];
}

/** Effort of a research-line project: T₁ at serious staffing, in standard-team-months (progress/day = √capacity ÷
 *  (effort · 30) = √(capacity ÷ SERIOUS_CAP) ÷ (30·T₁)). The class shown follows it. */
export const lineEffortTM = (agenda: AgendaId) => AGENDA_BY_ID[agenda].T1 * Math.sqrt(SERIOUS_CAP);
const classOfTM = (tm: number): EffortClass => (tm <= 6 ? 'S' : tm <= 12 ? 'M' : tm <= 24 ? 'L' : 'XL');
/** A research-line node (safety column, has an agenda, not a paradigm): its result is the line's next finding. */
export const isLineNode = (n: Pick<TreeNodeDef, 'agenda' | 'paradigm'>) => !!n.agenda && !n.paradigm;
for (const n of TREE) {
  if (!n.agenda || n.paradigm || n.star) continue;
  n.effortTM = lineEffortTM(n.agenda);
  n.effort = classOfTM(n.effortTM);
}

/** Each research line's follow-up project (not on the tree): more results from the line once its ideas are known or
 *  while they wait for prerequisites — sharper tools, measured evidence, discoveries, or dead ends. */
export const LINE_NODES: TreeNodeDef[] = AGENDAS.map((a) => ({
  id: `line:${a.id}`, name: `${a.name}: follow-up`, column: a.column, layer: 'lab', needs: [], agenda: a.id, followUp: true,
  effortTM: lineEffortTM(a.id), effort: classOfTM(lineEffortTM(a.id)), fx: { saf: 1 },
  saf: 'More results from the line: sharper tools, measured evidence, discoveries', cost: 'A result can also be a dead end',
}));
export const lineNodeId = (agenda: AgendaId) => `line:${agenda}`;

export const TREE_BY_ID: Record<string, TreeNodeDef> = Object.fromEntries(TREE.map((n) => [n.id, n]));
/** Every project: tree nodes and the research lines' follow-ups. */
export const PROJECT_BY_ID: Record<string, TreeNodeDef> = Object.fromEntries([...TREE, ...LINE_NODES].map((n) => [n.id, n]));

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

/** Safety columns (projects for safety science teams, R8). */
export const SAFETY_COLUMNS: Column[] = ['alignment', 'interp', 'evals'];
