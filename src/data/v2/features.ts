// Products and product features (STRUCTURE §4.4, §4.9; BUILD-PLAN R6, decisions D5 and D7). Owner: WS1.
//
// Channels become products the player owns. A product is a package: a model (optionally with a mini serving its free
// tier), an optional monitor model, a price tier, safeguards, KYC, effort and features. Everything is editable while
// live (rule R4); edits take effect at the next tick (D7).
//
// Features are built once lab-wide by the engineers (build queue, team-weeks + cash) after their tree node is known,
// then switched on per product. Model v3 V4.3 (MODEL-V3 §7.2): every effect is typed — a task enabler (a tool: RD-P07,
// offers without it cannot do the part of the listed sectors' tasks that needs it; rivals get it after a lag), a horizon extender (× h50 on chosen work types), a
// scaffold (+ΔG compute-equivalent fit on chosen work types, × tokens per work-hour; Davidson et al. 2023 via R20 B3) or
// effort (deep: ×4 reasoning tokens, +0.24 OOM, R20 C3). Horizon extenders and scaffolds also apply to the lab's internal
// agents on the internal work types they list (SWE, EXP, IDEAS), once built. RD-P11: a feature's incident exposure acts
// through the quantities of the product's incident site (safety/incidents.ts siteOf): its task horizon (a horizon
// extender lengthens the tasks the model runs alone: autonomy A) and its affordances (`afford`); its extra use is in
// the product's serving share. Only Companion keeps a per-trait multiplier, a stated stand-in (`hazard`).
// Every feature is a gain when on (no start type has one for free; sector adaptations are per product: models/adaptations.ts).
// [D] = design value.
import type { Channel, PriceTier, SectorId, TraitId } from '../../engine/v2/types';
import type { WorkTypeId } from './workTypes';
import { MARKUP } from './serving';

export type { PriceTier };
/** Price tier → markup relative to the standard tier (price = markup × the product's cost per work-hour, MARKUP in
 *  data/v2/serving.ts: budget margin 0.4, standard 0.6, premium 0.75) [D, R20 D3]. Demand share falls with price^−1.5
 *  (PRICE_ELASTICITY). */
export const PRICE_TIERS: Record<PriceTier, number> = { budget: MARKUP.budget / MARKUP.standard, standard: 1, premium: MARKUP.premium / MARKUP.standard };
export const PRICE_TIER_IDS: PriceTier[] = ['budget', 'standard', 'premium'];
/** Nearest tier to a price index (old saves, bots that set an index). */
export function tierOfIndex(x: number): PriceTier {
  let best: PriceTier = 'standard';
  for (const t of PRICE_TIER_IDS) if (Math.abs(PRICE_TIERS[t] - x) < Math.abs(PRICE_TIERS[best] - x)) best = t;
  return best;
}

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
  agents: { channel: 'agents', name: 'Agents', segment: 'sector spend', blurb: 'Autonomous agents sold as workers on multi-hour tasks.' },
  gov: { channel: 'gov', name: 'Government', segment: 'government spend', blurb: 'Government and defence contracts (any full or mini model; usage terms on the product).' },
  trusted: { channel: 'trusted', name: 'Trusted access', segment: 'sector spend', blurb: 'Vetted partners only, at ×3 the price (buyers see it); almost no leak.' },
  open: { channel: 'open', name: 'Open weights', segment: '—', blurb: 'A release, not a product: no revenue, full leak, cannot be undone.' },
};
/** Products shown as cards, in order. */
export const PRODUCT_ORDER: Channel[] = ['consumer', 'api', 'enterprise', 'agents', 'gov', 'trusted'];

// RD-P01a (DD-01): any product offers a lineup of real models (Deployment.lineup); Chat's free users run one of them
// (freeTierId; worldfx/serving.ts chatFreeTier), its paying users the main model. MINI_CHANNELS is gone.
/** RD-B11 (B16): a channel's price multiplier over its tier's markup. It is part of the product's offer
 *  (worldfx/serving.ts productOffer), so buyers see it in their choice: Trusted access sells to vetted partners at ×3
 *  the price (R12 §0.6) [D]. */
export const CHANNEL_PRICE: Partial<Record<Channel, number>> = { trusted: 3 };

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

/** The Agents product needs a measured 50% time horizon at least this long: the tasks it sells are half-day work
 *  units (METR time horizons; AI 2027's 2026 agents) [D]. */
export const AGENT_TASK_HOURS = 4;

export type FeatureId = 'memory' | 'computerUse' | 'voiceVision' | 'deepResearch' | 'codingAgent' | 'companion';

/** Where a scaffold or horizon extender applies: 'all' work, or sectors, internal work types and consumer chat ('CHAT'). */
export type WorkScope = 'all' | (SectorId | WorkTypeId | 'CHAT')[];
/** Typed feature effects (V4.3). */
export type FeatureFx =
  | { kind: 'enabler'; sectors?: SectorId[]; consumer?: boolean; share: number }
  | { kind: 'horizon'; mult: number; work: WorkScope }
  | { kind: 'scaffold'; dG: number; tokens: number; work: WorkScope };

export interface FeatureDef {
  id: FeatureId;
  name: string;
  /** Tree node that unlocks it (model v3 V2: the axis that makes it possible; absent = buildable from the start). */
  node?: string;
  /** Products it can be switched on for. */
  products: Channel[];
  /** Build: team-weeks of engineering and cash ($B). */
  buildTW: number;
  cash: number;
  /** Effect text and the engine terms it maps to. */
  effect: string;
  risk?: string;
  /** Typed effects (V4.3). */
  fx: FeatureFx[];
  /** RD-P11: affordances it adds to the product's incident site (F, data/v2/danger.ts CHANNEL_AFFORD: code execution,
   *  internet, money, weights access, each ¼ of F), capped at 1. */
  afford?: number;
  /** Incident hazard × per trait on this product: only where no site quantity carries the exposure, as a stated [D
   *  stand-in] (Companion). */
  hazard?: Partial<Record<TraitId, number>>;
}

export const FEATURES: FeatureDef[] = [
  { id: 'memory', name: 'Memory', node: 'P07', products: ['consumer', 'agents', 'enterprise'], buildTW: 12, cash: 0.1,
    effect: 'Horizon extender: time horizon ×1.3 on all work in this product; Chat appeal ×1.1 (people who come back); each rival has it if its lab had shipped it by July 2025; if no lab had, the others get it 120 days after you ship it',
    fx: [{ kind: 'horizon', mult: 1.3, work: 'all' }, { kind: 'enabler', consumer: true, share: 0.1 }],
    risk: 'Longer tasks alone: the time horizon ×1.3 also lengthens the tasks the model runs without a person (autonomy in its incident odds)' },
  { id: 'computerUse', name: 'Computer use', node: 'P06', products: ['agents', 'api'], buildTW: 16, cash: 0.15,
    effect: 'Task enabler: operates desktops and browsers, so it does the GUI-only tasks (13% of the work) in Admin, Finance, Legal and Government that offers without it cannot; each rival has it if its lab had shipped it by July 2025; if no lab had, the others get it 120 days after you ship it',
    fx: [{ kind: 'enabler', sectors: ['OFFICE', 'FIN', 'LEGAL', 'GOV'], share: 0.15 }],
    // RD-P11 [D stand-in]: acting on any desktop or website is one of the four affordances (+¼ of F).
    risk: 'Affordances +0.25 (acts on desktops and websites): raises the odds of incidents that need real access (overreach, cover-ups)', afford: 0.25 },
  // C2: also on the API (image, voice and video generation sold to media firms): Chat sells no sector work, so the API
  // is where its Media segment acts; on Chat it opens the Chat users.
  { id: 'voiceVision', name: 'Voice & vision', node: 'multimodal', products: ['consumer', 'api'], buildTW: 12, cash: 0.1,
    effect: 'Task enabler: talks, sees and makes images: Chat appeal ×1.15 (on Chat); on the API it does the media tasks (13% of Media work) offers without it cannot; each rival has it if its lab had shipped it by July 2025; if no lab had, the others get it 120 days after you ship it',
    fx: [{ kind: 'enabler', consumer: true, sectors: ['MEDIA'], share: 0.15 }] },
  // C2: not on Chat: its scaffold lists Science, Finance, Legal and internal research, none of which Chat sells.
  { id: 'deepResearch', name: 'Deep research', node: 'P05', products: ['enterprise'], buildTW: 8, cash: 0.05,
    effect: 'Scaffold: long research reports, +0.3 OOM of fit in Science, Finance and Legal work, at ×3 tokens',
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 3, work: ['SCI', 'FIN', 'LEGAL'] }],
    risk: 'Cost per work-hour ×3 where it applies (long agent runs)' },
  { id: 'codingAgent', name: 'Coding agent', products: ['agents', 'api'], buildTW: 12, cash: 0.1,
    effect: 'Scaffold: a coding harness, +0.3 OOM of fit in Software & IT work, at ×2 tokens',
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 2, work: ['SOFT'] }],
    // RD-P11: the flat reward-hacking ×1.2 is gone: its longer runs (×2 tokens) are in the product's serving share.
    risk: 'Cost per work-hour ×2 where it applies (longer agent runs; their incident exposure is in the product usage)' },
  { id: 'companion', name: 'Companion mode', node: 'engagement', products: ['consumer'], buildTW: 4, cash: 0.05,
    effect: 'Task enabler: a persistent persona, Chat appeal ×1.2; each rival has it if its lab had shipped it by July 2025; if no lab had, the others get it 120 days after you ship it', fx: [{ kind: 'enabler', consumer: true, share: 0.2 }],
    // RD-P11 [D stand-in]: ×1.5 stands for the longer, personal conversations a persona has with each user (time per
    // user), which the product's serving share does not count; to replace with time per user once Chat models it.
    risk: 'Sycophancy incidents ×1.5 [D stand-in: longer personal conversations per user]', hazard: { SYC: 1.5 } },
];
/** RD-E01b (DD-14): Multi-agent orchestration (P05), once adopted, is a scaffold on the lab's internal agents in
 *  capabilities engineering and research (SWE, EXP, IDEAS; not the safety package) — a lead agent planning and checking
 *  parallel subagents — through the same typed effect as a feature's (worldfx/serving.ts internalFx). Tokens ×3.75: a
 *  multi-agent system uses ~15× the tokens of a chat, a single agent ~4× [P Anthropic, research/12 §3], so ~3.75× the
 *  single-agent profile per work-hour. ΔG +0.26 OOM [D], set so that at the reference fit (coverage 0.5, the fit at
 *  θ_w) with AI labour not the bottleneck (the regime the game runs in: AI team-equivalents ≫ humans) the slot's
 *  effective labour is ×1.3, today's "agent research throughput ×1.3": with ρc = −2, L ∝ (1 − a)^−1.5, so ×1.3 needs
 *  a: 0.5 → 0.580, logit +0.324 × COVER.s 0.8 = 0.26. Anthropic's +90% on internal research evals [P] is a larger gain
 *  on an easier, parallel task (breadth-first search). The deep-think effort stays the node's option unlock. */
export const P05_ORCHESTRATION: FeatureFx = { kind: 'scaffold', dG: 0.26, tokens: 3.75, work: ['SWE', 'EXP', 'IDEAS'] };
/** RD-A06 (DD-03): internal tooling, owned on the research side and separate from product features (a product feature
 *  acts only inside its product's offer: Memory's horizon still lists 'all', which internalFx no longer reads). Each tool
 *  is the internal equivalent of one product feature's typed effect on the lab's own agents (the effects those features
 *  gave internal work before RD-A06): built by engineers on the build queue (the feature's team-weeks, cash, upkeep and
 *  idea gate), and the lab has it only once built. Starts own the tools whose feature they had built (`from`), so no
 *  start changes. Rivals acquire tools later (DD-03, rival part). */
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
/** Internal tools equivalent to a set of built product features (starts, the RD-A06 save migration). */
export const toolsFromFeatures = (features: readonly string[]): ToolId[] => INTERNAL_TOOLS.filter((t) => features.includes(t.from)).map((t) => t.id);
/** RD-P07 (DD-03): a product enabler is a tool part of a sector's work needs (Computer use: GUI-only steps in Admin,
 *  Finance, Legal and Government; Voice & vision: media work). In a sector it lists, an offer without the tool cannot do
 *  that part of the tasks: its coverage × (1 − need) (worldfx/serving.ts offerOf, inside the buyers' choice), need =
 *  share ÷ (1 + share), so an offer with the tool covers ×(1 + share) what the same offer without it covers (the effect
 *  size the old after-the-choice multiplier had) [D stand-in]. On Chat (consumer: true) the tool stays a term of the
 *  users' app choice: appeal × (1 + share) (worldfx/mix.ts). Sector adaptations are per product (models/adaptations.ts),
 *  not tools. */
export const enablerNeed = (share: number) => share / (1 + share);
/** RD-P07 (DD-03 rival part, DD-18 stand-in), RF-P1: for a tool NEW in this game (no lab of the world had it at the
 *  start, DAY0_TOOLS and the player's start), every rival and China gets it TOOL_LAG_DAYS after the player first ships
 *  it on a live product (world.fx.toolShip; actors/rivalModel.ts rivalToolStep). Tools some lab had at the start: each
 *  lab keeps what it had. 120 days [D]: 2024–25 launches followed each other by about 50–270 days (computer use:
 *  Anthropic Oct 2024, OpenAI Operator Jan 2025, Google Mariner May 2025; memory: ChatGPT Feb 2024, Meta AI Jan 2025,
 *  Gemini Feb 2025). */
export const TOOL_LAG_DAYS = 120;
/** RF-P1 (designer decision 2, 2026-11-23): the product tools (enablers) each rival and China starts with: what its real
 *  counterpart had shipped by the 2025-07-01 start (research/07 §2.3 archetypes: leader OpenAI, safety Anthropic,
 *  bigtech Google, maverick xAI, openweights Meta, upstart SSI / Thinking Machines; deepcent DeepSeek). Vendor sources
 *  per cell: design/RD-AUDIT/BUILD-NOTES.md RF-P1. A cell with no primary source is left off (xAI's memory, voice and
 *  companions). The player's starts list theirs in data/v2/starts.ts by the same table. */
export const DAY0_TOOLS: Record<string, FeatureId[]> = {
  leader: ['memory', 'computerUse', 'voiceVision'],
  safety: ['computerUse', 'voiceVision'],
  bigtech: ['memory', 'computerUse', 'voiceVision'],
  maverick: [],
  openweights: ['memory', 'voiceVision', 'companion'],
  upstart: [],
  deepcent: [],
};
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, FeatureDef>;
/** RD-P07: the features that are tools (enablers): the ones rivals and China sell with (RivalLab.tools). */
export const ENABLER_TOOLS: FeatureId[] = FEATURES.filter((f) => f.fx.some((x) => x.kind === 'enabler')).map((f) => f.id);
