// Products (STRUCTURE §4.4, §4.9; BUILD-PLAN R6, decisions D5 and D7). Owner: WS1.
//
// Channels become products the player owns. A product is a package: a model lineup, an optional monitor model, a price
// stance (MK-6), safeguards, KYC and product tools. Everything is editable while live (rule R4); edits take effect at
// the next tick (D7).
//
// MK-11: the product features are gone; the 12 product tools of data/v2/tools.ts replace them and the sector
// adaptations (built once lab-wide on the build queue, switched on per product). This file keeps the typed effect form
// they share (FeatureFx, model v3 V4.3: a task enabler, a horizon extender, a scaffold), the internal tools of the
// lab's own agents (RD-A06) and the rival lag rule's TOOL_LAG_DAYS. FeatureId stays as the old saves' feature ids
// (save migration, tools.ts TOOL_FROM_FEATURE). [D] = design value.
import type { Channel, SectorId, TraitId } from '../../engine/v2/types';
import type { WorkTypeId } from './workTypes';

/** Products by engine channel: display name, segment and blurb. Customer counts come from the customer stock
 *  (ProductRead.cust), paid seats and Chat's users and subscribers; sector products have no count, only a share (B4). */
export interface ProductDef {
  channel: Channel;
  name: string;
  /** The segment whose spend the product competes for (share readout). RD-P03: sector products compete for the same
   *  spend as separate sellers in the buyers' choice (each its own offer); no channel weights split it. */
  segment: string;
  blurb: string;
}
export const PRODUCT_DEFS: Partial<Record<Channel, ProductDef>> = {
  consumer: { channel: 'consumer', name: 'Chat', segment: 'consumer spend', blurb: 'The chat app for the public. Large demand, low price per user.' },
  api: { channel: 'api', name: 'API', segment: 'sector spend', blurb: 'Developers pay per token. The most exposed to distillation.' },
  enterprise: { channel: 'enterprise', name: 'Enterprise', segment: 'sector spend', blurb: 'Contracts with firms, adapted to their sectors.' },
  vetted: { channel: 'vetted', name: 'Vetted', segment: 'sector spend', blurb: 'For vetted buyers: government, military, critical infrastructure and large regulated firms. Usage terms on the product.' },
  open: { channel: 'open', name: 'Open weights', segment: '—', blurb: 'A release, not a product: no revenue, full leak, cannot be undone.' },
};
/** Products shown as cards, in order. */
export const PRODUCT_ORDER: Channel[] = ['consumer', 'api', 'enterprise', 'vetted'];

// RD-P01a (DD-01): any product offers a lineup of real models (Deployment.lineup); Chat's free users run one of them
// (freeTierId; worldfx/serving.ts chatFreeTier), its paying users the main model. MINI_CHANNELS is gone.
/** Catch rate of a monitor as capable as the model it watches (model v3 E6: it falls with the capability gap in OOM,
 *  data/v2/oversight.ts, and rises with AI-control containment tools, AG07). */
export { MONITOR_CATCH_BASE } from './oversight';
/** J2 AG1: a monitor from the watched model's own lineage (the same base: the model itself, a post-train or the
 *  continual-learning stream on that base, or a mini distilled from it) shares its blind spots and may collude with it.
 *  On incidents from the collusion-relevant traits (behaviour when unobserved) its catch rate × (1 − COPY_COLLUSION);
 *  an active comms lockdown (T-LOCK, AI control) halves the penalty. SR-24b: [S: Greenblatt, Shlegeris, Sachan, Roger
 *  2023/24 "AI Control" arXiv 2312.06942 §3.4.2 Table 6, worst collusion signal with no redaction: safety 97% → 57.5%,
 *  a loss of 0.41 of the catch; research/RD-SR24-safety-params.md §2 K2]: the red-team bound (perfect coordination),
 *  right for a scheming model. */
export const COPY_COLLUSION = 0.4;
export const COLLUSION_TRAITS: readonly TraitId[] = ['CONCEAL', 'POWER', 'AF', 'SAND', 'SCHEME', 'COLLUDE', 'SUCC'];

/** The product feature ids of saves before MK-11 (core/save.ts 105 → 106 maps them to tools; INTERNAL_TOOLS.from). */
export type FeatureId = 'memory' | 'computerUse' | 'voiceVision' | 'deepResearch' | 'codingAgent' | 'companion';

/** Where a scaffold or horizon extender applies: 'all' work, or sectors, internal work types and consumer chat ('CHAT'). */
export type WorkScope = 'all' | (SectorId | WorkTypeId | 'CHAT')[];
/** Typed feature effects (V4.3). */
export type FeatureFx =
  | { kind: 'enabler'; sectors?: SectorId[]; consumer?: boolean; share: number }
  | { kind: 'horizon'; mult: number; work: WorkScope }
  | { kind: 'scaffold'; dG: number; tokens: number; work: WorkScope };

/** RD-E01b (DD-14): Multi-agent orchestration (P05), once adopted, is a scaffold on the lab's internal agents in
 *  capabilities engineering and research (SWE, EXP, IDEAS; not the safety package) — a lead agent planning and checking
 *  parallel subagents — through the same typed effect as a product tool's (worldfx/serving.ts internalFx). Tokens ×3.75: a
 *  multi-agent system uses ~15× the tokens of a chat, a single agent ~4× [P Anthropic, research/12 §3], so ~3.75× the
 *  single-agent profile per work-hour. ΔG +0.26 OOM [D], set so that at the reference fit (coverage 0.5, the fit at
 *  θ_w) with AI labour not the bottleneck (the regime the game runs in: AI team-equivalents ≫ humans) the slot's
 *  effective labour is ×1.3, today's "agent research throughput ×1.3": with ρc = −2, L ∝ (1 − a)^−1.5, so ×1.3 needs
 *  a: 0.5 → 0.580, logit +0.324 × COVER.s 0.8 = 0.26. Anthropic's +90% on internal research evals [P] is a larger gain
 *  on an easier, parallel task (breadth-first search). M8: the
 *  node's only effect. */
export const P05_ORCHESTRATION: FeatureFx = { kind: 'scaffold', dG: 0.26, tokens: 3.75, work: ['SWE', 'EXP', 'IDEAS'] };
/** RD-A06 (DD-03): internal tooling, owned on the research side and separate from the product tools (a product tool
 *  acts only inside its product's offer: Memory's horizon still lists 'all', which internalFx does not read). Each tool
 *  is the internal equivalent of one old product feature's typed effect on the lab's own agents (`from`, the old
 *  feature id): built by engineers on the build queue (team-weeks, cash, upkeep and idea gate), and the lab has it only
 *  once built. */
export type ToolId = 'codingHarness' | 'researchHarness' | 'agentMemory';
export interface ToolDef { id: ToolId; name: string; node?: string; buildTW: number; cash: number; from: FeatureId; effect: string; fx: FeatureFx[] }
export const INTERNAL_TOOLS: ToolDef[] = [
  { id: 'codingHarness', name: 'Coding harness', buildTW: 12, cash: 0.1, from: 'codingAgent',
    effect: 'Engineering agents work in a coding harness: +0.3 OOM of fit on software engineering, at ×2 tokens',
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 2, work: ['SWE'] }] },
  { id: 'researchHarness', name: 'Research harness', node: 'P05', buildTW: 8, cash: 0.05, from: 'deepResearch',
    effect: 'Frontier research agents run long literature and analysis passes: +0.3 OOM of fit on research ideas, at ×3 tokens',
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 3, work: ['IDEAS'] }] },
  { id: 'agentMemory', name: 'Agent memory', node: 'P07', buildTW: 12, cash: 0.1, from: 'memory',
    effect: 'Agents keep memory across tasks: time horizon ×1.3 on all internal work',
    fx: [{ kind: 'horizon', mult: 1.3, work: 'all' }] },
];
export const TOOL_BY_ID = Object.fromEntries(INTERNAL_TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;
/** RD-P07 (DD-03): a product enabler is a tool part of a sector's work needs (Computer use: GUI-only steps in Admin,
 *  Finance, Legal and Government; Voice & vision: media work). In a sector it lists, an offer without the tool cannot do
 *  that part of the tasks: its coverage × (1 − need) (worldfx/serving.ts offerOf, inside the buyers' choice), need =
 *  share ÷ (1 + share), so an offer with the tool covers ×(1 + share) what the same offer without it covers (the effect
 *  size the old after-the-choice multiplier had) [D stand-in]. On Chat (consumer: true) the tool stays a term of the
 *  users' app choice: appeal × (1 + share) (worldfx/mix.ts). */
export const enablerNeed = (share: number) => share / (1 + share);
/** RD-P07 (DD-03 rival part, DD-18 stand-in), RF-P1: for a product tool NEW in this game (no lab of the world had it at
 *  the start: data/v2/tools.ts toolsAtStart and the player's start), every rival and China gets it TOOL_LAG_DAYS after the player first ships
 *  it on a live product (world.fx.toolShip; actors/rivalModel.ts rivalToolStep). Tools some lab had at the start: each
 *  lab keeps what it had. 120 days [D]: 2024–25 launches followed each other by about 50–270 days (computer use:
 *  Anthropic Oct 2024, OpenAI Operator Jan 2025, Google Mariner May 2025; memory: ChatGPT Feb 2024, Meta AI Jan 2025,
 *  Gemini Feb 2025). */
export const TOOL_LAG_DAYS = 120;
