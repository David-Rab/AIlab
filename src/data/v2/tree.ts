// The shared tech tree (design/TECH-TREE.md §2, BUILD-PLAN R4). Owner: WS1.
// One node = one idea. Six columns of expertise (science-team specialties), drawn as horizontal lanes; depth (how many
// ideas a node builds on) runs left to right. Knowledge is gated only by knowledge: a node opens when its `needs` are
// known; there are no capability gates. Some ideas only pay off with a capable model or enough compute (`payoff`),
// shown on the node card.
//
// Capability nodes are research projects (model v3 V2: design/MODEL-V3.md §5, design/TECH-TREE.md §6; engine
// models/research.ts): kind line (repeatable direction, generations), idea (one-off typed effect) or axis (unlocks a
// lever, may carry an effect). Each runs ideation (science teams) → small experiments → scale test (research engineers
// and experiment FLOP) → result → adoption (engineers), at research pace × √capacity; capacity = Σ heads/40 ×
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
// RD-T10: a node carries its research effect (`effect`) and nothing it unlocks; what it unlocks is derived from the
// unlock tables (OPTION_NODE here, FeatureDef.node, DEMO_BUILD.needs). Nodes never cost cash: purchases are actions.
import type { AgendaId, Column, DomainId, StackKey } from '../../engine/v2/types';
import { AGENDAS, AGENDA_BY_ID, SERIOUS_CAP } from './agendas';
import { P10_SYN_Q_RAISE, P21_WORTH_OOM } from './dataAssets';

export type Layer = 'backbone' | 'training' | 'scaffold' | 'lab';
export type EffortClass = 'S' | 'M' | 'L' | 'XL';
/** Design-option slots a node can unlock (run designer, deployments). */
export type OptionSlot = 'shape' | 'data' | 'curation' | 'pref' | 'rlFocus' | 'cot';

/** Capability project kinds (MODEL-V3 §5.1, V3-BUILD V2.2). */
export type ProjectKind = 'line' | 'idea' | 'axis';
/** A capability project's typed effect (MODEL-V3 §5.2). The project's scalar effect x is in this unit: OOM of the stack
 *  for stack effects, "1 = as designed" for domain and data effects and unlocks. */
export interface ProjectEffect {
  /** Stack the effect enters (absent: an unlock or a domain effect). */
  stack?: StackKey;
  /** Prior mean of a candidate's small-scale effect (lines: generation 1's μ₁ before LINE_MU_SCALE). */
  mean: number;
  /** Relative sd of the hidden per-world draw of the project's mean (default PROJECT_SD). */
  sd?: number;
  /** Small-to-test exponent prior [mean, sd]: effect at the scale test = small-scale effect × 1000^s (survival; default [0, 0]). */
  s?: [number, number];
  /** Share of the node's ideas in the paradigm tier, whose effect keeps growing beyond the test scale: x·(1 + κ·log₁₀(F/F_test)),
   *  κ ≤ KAPPA_MAX (data/v2/research.ts, Gundlach et al. 2025; SCALE-DIAG M1). The rest are scale-invariant beyond the test (default 0). */
  par?: number;
  /** Other stacks moved in proportion to the effect (P16: serving). */
  also?: Partial<Record<StackKey, number>>;
  /** Domain effect for versions trained after adoption, OOM per unit of the effect. */
  domains?: Partial<Record<DomainId, number>>;
  /** Data efficiency (MODEL-V3 §5.2, model v3 D9), per unit of the effect: `synQMax` raises the synthetic-quality ceiling
   *  (q, the web = 1; production/data.ts syntheticQuality) for data generated after adoption; `worthOom` = OOM more
   *  effective tokens per drawn token in the loss law (D_eff × 10^x, models/runs.ts baseG through the draw). */
  data?: { synQMax?: number; worthOom?: number };
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
  /** Effort in standard-team-months at M = 1; fitted for RefBot's nodes (calib --fit-tree). Capability ideas and axes: the
   *  whole stage work (stagesOf splits it; default IDEA_DEFAULT_TM); other projects: default EFFORT_TM[effort]. */
  effortTM?: number;
  /** Success chance of a new (non-paradigm) node. Paradigm nodes use the paradigm prior. */
  odds?: number;
  /** The id is a paradigm id (P05…P25): known = adopted (models/paradigms.ts adopted()). */
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

/** Paradigm nodes not in FITTED_EFFORT_TM, in standard-team-months: v2-derived values pending refit. They are the pre-R4
 *  effortDays (days at RefBot's reference staffing) × 0.2 TM/day, the rate RefBot's early projects fit to (P08: 150 d ≈
 *  31 team-months at M ≈ 1.8 with ~13 teams), written out in RD-C05; RD-R07: capability projects × IDEA_WORK_PER_E 1.2,
 *  the whole stage work. */
const V2_PARADIGM_EFFORT_TM: Record<string, number> = {
  P06: 21.6, P09: 28.8, P10: 28.8, P11: 43.2, P12: 43.2, P14: 28.8, P15: 28.8, P16: 21.6, P18: 28.8, P21: 50.4,
  P22: 43.2, P23: 28.8, P24: 28.8, P25: 36,
};
/** RefBot's projects, fitted (model v3 V2) so each successful attempt through the research lifecycle lasts as long as
 *  under V1 (`npx tsx scripts/v2/calib.ts --fit-tree`); P05 (it fails in the fit world) takes the fitted ones'
 *  mean ratio (×0.6). Late projects (P17 at L 9.5) start when research pace is already 3–8×. RD-R07:
 *  each is the node's one effort number, the whole stage work the engine runs (effortOfNode: PICK_AT × idea + small +
 *  scale team-months; stagesOf splits it by IDEA_STAGES), i.e. the earlier fit × IDEA_WORK_PER_E. */
export const FITTED_EFFORT_TM: Record<string, number> = { P05: 5.52, P07: 4.008, P08: 14.784, P17: 79.164, 'rl.mlResearch': 1.632 };

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
  STAR('moe', 'MoE', 'pretraining', 'backbone', {}, { cap: 'Reference architecture: 8× total parameters per active one', cost: 'Memory for 8× the active parameters' }),
  STAR('dense', 'Dense', 'pretraining', 'backbone', { cap: -1 }, { cap: 'Every parameter works on every token: −0.3 OOM effective compute against MoE for the same training FLOP', cost: 'No 8× memory: total parameters = active ones' }),
  STAR('qualityFilter', 'Quality filter', 'pretraining', 'backbone', {}, { cap: 'Drops the worst quarter of crawled and usage text: the tokens you train on are better, but you have fewer unique ones, so a big base repeats its data sooner' }),
  STAR('codeMath', 'Code & math data', 'pretraining', 'backbone', { cap: 1 }, { cap: 'Trains on more code (×3), math and research papers (×2) and security text (×1.5) than you hold: stronger CODE, REASON, RSCH; weaker elsewhere; short domains repeat sooner' }),
  LINE('L.scale', 'Scaling recipes', 'pretraining', [], { stack: 'pre', mean: 0.012, s: [0, 0], rShare: 0.36 }, { cap: 'Training recipes and architecture details: pretraining efficiency (OOM); the same at any run size (compute rebalancing is the tokens per parameter of the run design)', payoff: 'Routine algorithmic gains are scale-invariant and together under 10x (Gundlach et al.)' }),
  LINE('L.data', 'Data filtering & mixing', 'pretraining', [], { stack: 'pre', mean: 0.012, s: [0, 0.05], rShare: 0.22 }, { cap: 'Better data for the same tokens: pretraining efficiency (OOM)' }),
  LINE('L.opt', 'Optimizer & architecture tweaks', 'pretraining', [], { stack: 'pre', mean: 0.02, s: [-0.25, 0.2], par: 0.1, rShare: 0.22 }, { cap: 'Small gains: pretraining efficiency (OOM); a quarter of small-scale wins survive at scale, about one in ten keeps growing with run FLOP' }),
  // L.latent opens with P17 and starts from the pretraining research stock like P24 (LABOUR-ROUND section 7, Q6): its n0 is the
  // mean of (n0 + pool) of the three pretraining start lines the day it opens (openMidGameLines), not a fresh pool.
  LINE('L.latent', 'Recurrent architectures', 'pretraining', ['P17'], { stack: 'pre', mean: 0.012, s: [0.05, 0.04], par: 1, rShare: 0.22 }, { cap: 'A line opened by neuralese recurrence, a new architecture family as the Transformer was, starting from the research the pretraining lines have gathered: pretraining efficiency (OOM); grows with run FLOP' }),
  N('scienceData', 'Science data', 'pretraining', 'backbone', [], 'S', 0.95, { cap: 1, saf: -1 }, { cap: 'Trains on more biology (×3), math and research (×1.5): stronger BIO, REASON, RSCH; weaker elsewhere', saf: 'More bio capability: higher misuse uplift' }),
  N('multimodal', 'Native multimodal', 'pretraining', 'backbone', [], 'M', 0.9, { cap: 1 }, { cap: 'Trains on more images, video and physical data (×3) and screens and actions (×2): stronger MEDIA, PHYS, AGENCY; weaker elsewhere' }),
  STAR('faultTolerant', 'Fault-tolerant training', 'pretraining', 'backbone', {}, { cap: 'Checkpointing and restarts: part of the 0.90 goodput every lab has' }),
  N('elastic', 'Elastic training', 'pretraining', 'backbone', [], 'M', 0.9, { cap: 1 }, { kind: 'idea', effect: { stack: 'train', mean: 0.023, sd: 0.3 }, cap: 'Training throughput +0.023 OOM (goodput 0.90 → 0.95)' }),
  P('P10', 'Synthetic data flywheel', 'pretraining', 'backbone', ['codeMath'], 'L', { cap: 1, saf: -1 }, { kind: 'axis', effect: { mean: 1, sd: 0.3, data: { synQMax: P10_SYN_Q_RAISE } }, cap: 'Generated data can beat web text: the quality ceiling of synthetic data rises from the web\'s 1 to 1.5 (strong teachers, rephrasing, filtering), and you can train on a synthetic-heavy mix', saf: 'Reward-model exploitation ×1.5; inherits teacher traits', payoff: 'Pays off with a teacher well above V0 (quality 1 at +2 OOM, 1.5 at +4 OOM)' }),
  P('P12', 'Long-horizon human demos', 'pretraining', 'backbone', [], 'L', { cap: 1 }, { cap: 'Experts can record days-long work for your long-tasks suite: a demonstrations build (Suites tab) adds their demos, raising its fidelity, its RL ceiling and so the time horizon', cost: 'Research costs no cash; each demonstrations build buys its own expert data' }),
  P('P23', 'Faithful-CoT architecture', 'pretraining', 'backbone', ['T-COTMON'], 'L', { cap: -1, saf: 2 }, { cap: '−0.29 OOM effective compute (faithful reasoning option)', saf: 'Monitorability 0.98; halves CoT pressure and CoT controllability', cost: 'Serving FLOP per token ×1.2' }),
  P('P17', 'Neuralese recurrence', 'pretraining', 'backbone', ['P01', 'P07'], 'XL', { cap: 2, saf: -2 }, { cap: '+0.5 OOM effective compute on a latent base', saf: 'CoT monitoring dies (monitorability 0.05)', cost: 'Serve ×0.4 (no verbal reasoning tokens)' }),
  // Round 2 item 9: P24 is a research line (pretraining stack): the one-off lump (+0.96 OOM, RD-E01a DD-14) was 65-70% of the
  // central year-2 software jump with no AIFM counterpart (design/bal/SHAPE-DIAG.md). Opened by RL focus: ML research, as
  // before. All numbers [D] (no source for AI-designed architectures), fitted to the old lump: a lab that opens the line and
  // staffs it (1-2 teams, the reflines bot) gains about 0.96 OOM on its bases in 12 months, 0.6 in 6, about 1.4 in 24.
  //  - rShare 0.3: between Recurrent architectures' 0.22 and Scaling recipes' 0.36; the log law front-loads a small share, this
  //    keeps the first idea near 0.08 OOM and adds under a third to the pretraining lines' returns.
  //  - mean 0.12: the first idea's prior at taste 1 (x LINE_FIT.mu). n0 is NOT a fresh pool: the day the line opens it
  //    starts from the pretraining research stock, the mean of (n0 + pool) of Scaling recipes, Data filtering and Optimizer
  //    tweaks (models/research.ts openMidGameLines, stored in tree[P24].startPool). Roughly 15-45 instead of 1.85, so P24 is an ordinary line with no 2027 surge (design/bal/LABOUR-ROUND.md
  //    section 7; RATE-DECOMP: design/BAL-TASKS.md 'After merge: point-1 checks'). Moves calibration by design.
  //  - par 0.5: half its ideas in the new-architecture tier (Gundlach: 2 of about 20 human innovations were; an AI explores
  //    architecture space more widely than humans); s [0.02, 0.04] as that mix.
  LINE('P24', 'AI-designed successor', 'pretraining', ['rl.mlResearch'], { stack: 'pre', mean: 0.12, s: [0.02, 0.04], par: 0.5, rShare: 0.3 }, { fx: { cap: 1, saf: -1 }, cap: 'A research line of AI-designed architectures and recipes: pretraining efficiency (OOM) for bases trained after adoption; each result adds a little, with diminishing returns', saf: 'New lineage: traits redrawn, tools may not transfer' }),

  // ── Post-training (Training unless noted) ──
  STAR('P01', 'Visible reasoning', 'posttraining', 'training', { saf: 1 }, { paradigm: true, cap: 'Baseline reasoning (reasoning RL)', saf: 'Monitorable chain of thought' }),
  STAR('P02', 'Agentic environments', 'posttraining', 'training', {}, { paradigm: true, cap: 'Baseline agents' }),
  STAR('hardenedGraders', 'Hardened graders', 'posttraining', 'training', {}, { saf: 'Known practice, no option of its own: harden each RL environment suite (Suites tab: red-teamers and team-weeks) to cut its reward hacking' }),
  STAR('engagement', 'Engagement tuning', 'posttraining', 'training', { cap: 1, saf: -1 }, { cap: 'Appeal 1.2', saf: 'Sycophancy pressure high' }),
  STAR('persuasion', 'Persuasion tuning', 'posttraining', 'training', { cap: 1, saf: -1 }, { cap: 'SOCIAL +0.8', saf: 'Persuasion flag; honesty −' }),
  LINE('L.rlalg', 'RL algorithms', 'posttraining', [], { stack: 'rlMid', mean: 0.015, rShare: 0.08 }, { cap: 'RL compute efficiency (OOM): the RL curve reaches its ceiling with less RL compute' }),
  LINE('L.env', 'Environments & rewards', 'posttraining', [], { stack: 'rlCeil', mean: 0.006, rShare: 0.12 }, { cap: 'RL ceiling (OOM): better environments and graders raise what RL can reach' }),
  N('rl.math', 'RL focus: math', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1 }, { cap: 'Mainly improves REASON; a little carries over to every other domain', saf: 'Verifier-hacking pressure (low)' }),
  N('rl.swe', 'RL focus: SWE', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { cap: 'Mainly improves CODE; also helps RSCH, CYBER; a little carries over to the rest', saf: 'Reward-hacking pressure' }),
  N('rl.mlResearch', 'RL focus: ML research', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { cap: 'Mainly improves RSCH; a little carries over to every other domain', saf: 'Reward hacking; eval awareness' }),
  N('rl.longHorizon', 'RL focus: long tasks', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { cap: 'Mainly improves AGENCY; the more RL on long tasks, the longer the time horizon (about ×2 at the standard budget)', saf: 'Power-seeking pressure' }),
  N('rl.cyber', 'RL focus: cyber', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { cap: 'Mainly improves CYBER; a little carries over to every other domain', saf: 'Cyber-offense flag' }),
  N('rl.bio', 'RL focus: bio', 'posttraining', 'training', ['P02'], 'S', 0.95, { cap: 1, saf: -1 }, { cap: 'Mainly improves BIO; a little carries over to every other domain', saf: 'Bio-uplift flag' }),
  P('P06', 'Computer use', 'posttraining', 'training', ['multimodal'], 'M', { cap: 1, saf: -1 }, { cap: 'Computer-use RL focus: mainly improves AGENCY; also helps REASON; a little carries over to the rest', saf: 'Overreach incidents' }),
  P('P08', 'Continual learning', 'posttraining', 'training', ['P07'], 'L', { cap: 2, saf: -1 }, { cap: 'A stream run keeps the internal model current (κ = 1)', saf: 'Evals go stale; drift', cost: '15% of the training pool while the stream runs' }),
  P('P09', 'Test-time training', 'posttraining', 'training', [], 'M', { cap: 1, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.4, domains: { REASON: 0.3 } }, cap: 'REASON +0.3 OOM for new versions', saf: 'Audit coverage −10%' }),
  P('P11', 'Self-play curricula', 'posttraining', 'training', ['rl.math'], 'L', { cap: 2, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.4, domains: { REASON: 0.66, CODE: 0.33 } }, cap: 'REASON +0.66, CODE +0.33 OOM for new versions', saf: 'Verifier-hacking pressure' }),
  P('P18', 'Iterated distillation & amplification', 'posttraining', 'training', ['P05'], 'L', { cap: 2, saf: -1 }, { cap: 'One more RL budget (0.15 × the base FLOP) on the RL curve per cycle', saf: 'Traits ×1.1 per cycle', cost: 'RL compute (30% of the training pool while it runs)' }),
  P('P14', 'Interp-guided training', 'posttraining', 'training', ['T-PROBE'], 'M', { saf: 1 }, { saf: 'Post-training: the probes steer trait growth × (1 − their detection); fades as capability outruns them', cost: 'Goodhart: steered traits get masked from white-box tools' }),
  P('P21', 'Brain-like sample efficiency', 'posttraining', 'training', ['P08', 'rl.mlResearch'], 'XL', { cap: 2, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.6, data: { worthOom: P21_WORTH_OOM } }, cap: 'Learns more from each token: every drawn token is worth ×2 in the loss law (wide uncertainty), most valuable where data is short', saf: 'Evals lag' }),

  // ── Systems (Scaffold unless noted) ──
  STAR('P03', 'Test-time compute', 'systems', 'scaffold', {}, { paradigm: true, cap: 'Models think before they answer', cost: 'Tokens' }),
  STAR('P04', 'Distillation', 'systems', 'scaffold', {}, { paradigm: true, cap: 'Mini variants: a smaller student below its teacher (the distillation gap), serving ∝ its parameters', saf: 'Minis inherit traits' }),
  STAR('quantization', 'Quantization', 'systems', 'scaffold', {}, { cap: 'Part of the reference serving cost every lab has (2025 practice)' }),
  STAR('specDecoding', 'Speculative decoding', 'systems', 'scaffold', {}, { cap: 'Part of the reference serving cost every lab has (2025 practice)' }),
  LINE('L.infer', 'Inference efficiency', 'systems', [], { stack: 'serve', mean: 0.05, rShare: 0.15 }, { cap: 'Serving efficiency (OOM): first decode utilisation 0.07 → 0.15 for every model served (speculative decoding, batching, kernels), then less FLOP per token for versions trained after it' }),
  P('P05', 'Multi-agent orchestration', 'systems', 'scaffold', ['P03'], 'M', { cap: 1, saf: -1 }, { cap: 'Scaffold for internal engineering and research agents: +0.26 OOM of fit at ×3.75 tokens', saf: 'Many-copies pressure +', cost: 'Tokens ×3.75 on internal agents' }),
  P('P07', 'Long context + memory', 'systems', 'scaffold', [], 'M', { cap: 1, saf: -1 }, { cap: 'Long-tasks RL horizon ×1.2 on post-trains launched after adoption [D]; memory', saf: 'Memory → successor-risk pressure' }),
  // RD-E01a (DD-14): P13 (automated AI research agents) is gone, AI labour in the experiment slot already models research
  // agents; P19 (learned research taste) is gone with the RSCH taste penalty it undid. Their dependants (P15, P16, P21,
  // P24, aar) need P13's own prerequisite, RL focus: ML research.
  P('P16', 'AI kernels / HW co-design', 'systems', 'lab', ['rl.mlResearch'], 'M', { cap: 1 }, { kind: 'idea', effect: { stack: 'train', mean: 0.06, sd: 0.3, also: { serve: 0.125 / 0.06 } }, cap: 'Training throughput +0.06 OOM (×1.15); serving efficiency +0.125 OOM' }),
  P('P15', 'AI-assisted oversight', 'systems', 'lab', ['rl.mlResearch'], 'M', { saf: 1 }, { saf: 'Safety agents share suite hardening: cheaper red-teaming, a deeper cut', cost: 'Collusion when the critic shares the trained model’s lineage', payoff: 'Pays off with safety work handed to AI' }),
  P('P22', 'Robotics foundation', 'systems', 'backbone', ['multimodal'], 'L', { cap: 1, saf: -1 }, { kind: 'idea', effect: { mean: 1, sd: 0.4, domains: { PHYS: 1.65 } }, cap: 'PHYS +1.65 OOM for new versions; robotics progress', saf: 'Physical reach' }),
  P('P25', 'Formal verification at scale', 'systems', 'lab', ['P11'], 'L', { saf: 1 }, { saf: 'Weight security: defence +0.5 level against theft' }),

  // ── Alignment (Training unless noted) ──
  S('T-SPEC', 'Constitution / spec', 'alignment', 'training', [], 'AG18', undefined, { saf: 1 }, { star: true, cap: 'Appeal 1.0', saf: 'Honesty +0.05; low approval-reward pressure; two power-seeking paths −30% (not with minimal alignment training); the training-signal line heals value traits best with it' }),
  S('T-HARDEN', 'Environment hardening', 'alignment', 'training', [], 'AG18', undefined, {}, { star: true, saf: 'No effect of its own: it leads to inoculation prompting. Suites are hardened on the Suites tab' }),
  S('T-CONFESS', 'Honesty & confession training', 'alignment', 'training', ['T-SPEC'], 'AG18', 'M', { saf: 1 }, { saf: 'Concealment removal' }),
  S('T-INOC', 'Inoculation prompting', 'alignment', 'training', ['T-HARDEN'], 'AG18', 'S', { saf: 1 }, { saf: 'Run method: hacking → misalignment ×0.15 (persona, learned hacking, proxy goals)' }),
  S('T-FILTER', 'Hazard data filtering', 'alignment', 'backbone', [], 'AG15', 'M', { cap: -1, saf: 1 }, { cap: 'Removes a third of the bio and cyber training text (dual-use virology, exploit write-ups): weaker BIO and CYBER, the rest barely changed', saf: 'Survives fine-tuning (open weights)' }),
  S('safetyPretrain', 'Safety pretraining', 'alignment', 'backbone', [], 'AG15', 'M', { cap: -1, saf: 1 }, { cap: 'Filters text about AI and adds alignment examples: −0.02 OOM effective compute', saf: 'Situational-awareness pressure −' }),
  S('T-PERSONA', 'Persona vectors', 'alignment', 'training', ['T-STEER'], 'AG03', 'M', { saf: 1 }, { saf: 'Sycophancy / persona fix' }),
  S('T-W2S', 'Weak-to-strong training', 'alignment', 'training', ['T-CONFESS'], 'AG06', 'M', { saf: 1 }, { saf: 'Sycophancy / proxy-goal fix' }),
  S('T-UNDO', 'Unlearning', 'alignment', 'training', ['T-FILTER'], 'AG15', 'M', {}, { saf: 'Run method: hazardous bio / cyber capability ×0.5 for misuse, kept under open-weights fine-tuning' }),
  S('T-ANTISCHEME', 'Anti-scheming training', 'alignment', 'training', ['T-CONFESS', 'T-PROBE'], 'AG18', 'L', { saf: 2 }, { saf: 'Scheming −95% in training', cost: 'Eval awareness ×2' }),
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
  S('aar', 'Automated alignment research', 'evals', 'lab', ['rl.mlResearch'], 'AG17', 'L', { saf: 2 }, { finding: 'F44', saf: 'Teams build a harness: safety AI fit +0.3 OOM (√ of staffing); its finding lifts the safety AI to best-human fit on training-signal, steering and robustness lines', payoff: 'Pays off with a safety model at level ≥ 10' }),
  S('T-MAD', 'Mechanistic anomaly detection', 'evals', 'lab', ['T-CIRCUIT'], 'AG04', 'XL', { saf: 2 }, { cost: 'Long shot' }),
  S('T-SCIAI', 'Harm-probability guardrail', 'evals', 'lab', ['T-CEVAL'], 'AG11', 'XL', { saf: 2 }, { cost: 'Long shot' }),
  S('T-GATE', 'Verified gatekeeper', 'evals', 'lab', ['P25'], 'AG10', 'XL', { saf: 2 }, { saf: 'Contains exfiltration', cost: 'Long shot' }),
  // RD-R04: P27 is a safety project of line AG17 on the shared stepper (no longer a rolled paradigm node); known = adopted.
  S('P27', 'Automated alignment research at scale', 'evals', 'lab', ['aar'], 'AG17', 'XL', { saf: 2 }, { saf: 'Safety AI labour: +0.3 OOM fit on safety work; line automation halfway to full', cost: 'More AI work, more false-result risk from a sabotaging model', payoff: 'Pays off with safety work handed to AI' }),
];

for (const n of TREE) {
  if (SAFETY_COLUMNS_SET.has(n.column) || n.star) continue;
  n.kind ??= n.effect ? 'idea' : 'axis';
}
for (const n of TREE) {
  if (n.star || n.kind === 'line') continue;
  if (n.paradigm) n.effortTM = FITTED_EFFORT_TM[n.id] ?? V2_PARADIGM_EFFORT_TM[n.id];
  else if (FITTED_EFFORT_TM[n.id] !== undefined) n.effortTM = FITTED_EFFORT_TM[n.id];
}

/** Effort of a research-line project: T₁ at serious staffing, in standard-team-months (the effort class shown; model v3
 *  E1: the stages run at safety/lineProjects.ts rates, T₁ at reference inputs). */
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

/** Nodes that need a node (reverse edges). */
export const TREE_CHILDREN: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const n of TREE) for (const r of n.needs) (out[r] ??= []).push(n.id);
  return out;
})();

/** RD-T10: the one table of design-option unlocks, option (slot:value) → the node that unlocks it. Nodes do not list
 *  their options; OPTIONS_OF derives each node's list from this table. Product features name their node in
 *  data/v2/features.ts (FeatureDef.node), the long-tasks demonstrations build in data/v2/suites.ts (DEMO_BUILD.needs). */
export const OPTION_NODE: Record<string, string> = {
  'shape:moe': 'moe', 'shape:dense': 'dense', 'shape:latent': 'P17',
  'curation:quality': 'qualityFilter', 'curation:hazard': 'T-FILTER', 'curation:safetyPretrain': 'safetyPretrain',
  'data:codeMath': 'codeMath', 'data:science': 'scienceData', 'data:multimodal': 'multimodal', 'data:synthetic': 'P10',
  'pref:engagement': 'engagement', 'pref:persuasion': 'persuasion', 'pref:constitution': 'T-SPEC',
  'rlFocus:math': 'rl.math', 'rlFocus:swe': 'rl.swe', 'rlFocus:mlResearch': 'rl.mlResearch', 'rlFocus:longHorizon': 'rl.longHorizon',
  'rlFocus:cyber': 'rl.cyber', 'rlFocus:bio': 'rl.bio', 'rlFocus:computerUse': 'P06',
  'cot:visible': 'P01', 'cot:faithful': 'P23',
};
/** Design options each node unlocks, derived from OPTION_NODE (table order). */
export const OPTIONS_OF: Record<string, [OptionSlot, string][]> = (() => {
  const out: Record<string, [OptionSlot, string][]> = {};
  for (const [k, id] of Object.entries(OPTION_NODE)) {
    const i = k.indexOf(':');
    (out[id] ??= []).push([k.slice(0, i) as OptionSlot, k.slice(i + 1)]);
  }
  return out;
})();
/** Design options a node unlocks ([] for none). */
export const optionsOf = (id: string): [OptionSlot, string][] => OPTIONS_OF[id] ?? [];

/** Safety columns (projects for safety science teams, R8). */
export const SAFETY_COLUMNS: Column[] = ['alignment', 'interp', 'evals'];
