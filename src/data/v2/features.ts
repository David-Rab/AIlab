// Products and product features (STRUCTURE §4.4, §4.9; BUILD-PLAN R6, decisions D5 and D7). Owner: WS1.
//
// Channels become products the player owns. A product is a package: a model (optionally with a mini serving its free
// tier), an optional monitor model, a price tier, safeguards, KYC, effort and features. Everything is editable while
// live (rule R4); edits take effect at the next tick (D7).
//
// Features are built once lab-wide by the engineers (build queue, team-weeks + cash) after their tree node is known,
// then switched on per product. Model v3 V4.3 (MODEL-V3 §7.2): every effect is typed — a task enabler (opens a segment
// of the listed markets that only products with it can sell into), a horizon extender (× h50 on chosen work types), a
// scaffold (+ΔG compute-equivalent fit on chosen work types, × tokens per work-hour; Davidson et al. 2023 via R20 B3) or
// effort (deep: ×4 reasoning tokens, +0.24 OOM, R20 C3). Horizon extenders and scaffolds also apply to the lab's internal
// agents on the internal work types they list (SWE, EXP, IDEAS), once built. Hazard multipliers stay (incidents).
// D5: the frontier-leader start's set (sector packs) is the neutral ×1 baseline; every other feature is a gain when on.
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
  /** The segment whose spend the product competes for (share readout). */
  segment: string;
  blurb: string;
}
export const PRODUCT_DEFS: Partial<Record<Channel, ProductDef>> = {
  consumer: { channel: 'consumer', name: 'Chat', segment: 'consumer spend', blurb: 'The chat app for the public. Large demand, low price per user.' },
  api: { channel: 'api', name: 'API', segment: 'sector spend', blurb: 'Developers pay per token. The most exposed to distillation.' },
  enterprise: { channel: 'enterprise', name: 'Enterprise', segment: 'sector spend', blurb: 'Contracts with firms, with sector packs. Sticky, little leak.' },
  agents: { channel: 'agents', name: 'Agents', segment: 'sector spend', blurb: 'Autonomous agents sold as workers on multi-hour tasks.' },
  gov: { channel: 'gov', name: 'Government', segment: 'government spend', blurb: 'Government and defence contracts (needs a gov variant).' },
  trusted: { channel: 'trusted', name: 'Trusted access', segment: 'sector spend', blurb: 'Vetted partners only, at a premium; almost no leak.' },
  open: { channel: 'open', name: 'Open weights', segment: '—', blurb: 'A release, not a product: no revenue, full leak, cannot be undone.' },
};
/** Products shown as cards, in order. */
export const PRODUCT_ORDER: Channel[] = ['consumer', 'api', 'enterprise', 'agents', 'gov', 'trusted'];

/** Products that take a mini (`miniVersionId`): Chat's free tier and the API's cheap tier (A5). */
export const MINI_CHANNELS: readonly Channel[] = ['consumer', 'api'];
/** Mini free tier of Chat: the share of its usage served by the mini (free users) [D]. Chat's quality is the
 *  usage-weighted blend of the two models; serving need falls with the mini's lower serve cost. A5: the API's mini is a
 *  cheap tier in the sector market instead, with no fixed share: buyers take it on the tasks it does adequately when it
 *  is the better buy (worldfx/choice.ts), so its share of the API's hours is derived. */
export const FREE_TIER_SHARE: Partial<Record<Channel, number>> = { consumer: 0.6 };

/** D7: a monitor adds 0.25 × (monitor serve cost ÷ watched model's serve cost) to the product's serving need (a mini
 *  on its teacher ≈ 6%; the same model ≈ 25%). It reads the watched model's outputs and reasoning, not every token. */
export const MONITOR_OVERHEAD = 0.25;
/** Catch rate of a monitor as capable as the model it watches [D]; it falls by the AG05 oversight-gap rule
 *  (×0.52 per 4× gap in research-speed multiplier M) and rises with AI-control containment tools (AG07). */
export const MONITOR_CATCH_BASE = 0.85;
/** J2 AG1: a monitor from the watched model's own lineage (the same base: the model itself, a post-train or the
 *  continual-learning stream on that base, or a mini distilled from it) shares its blind spots and may collude with it.
 *  On incidents from the collusion-relevant traits (behaviour when unobserved) its catch rate × (1 − COPY_COLLUSION);
 *  an active comms lockdown (T-LOCK, AI control) halves the penalty [D: Greenblatt et al. 2023 "AI Control" — untrusted
 *  monitoring needs collusion-busting measures; E21 peer-preservation 38% vs 8% (research/14), comms lockdown −50%]. */
export const COPY_COLLUSION = 0.4;
export const COLLUSION_TRAITS: readonly TraitId[] = ['CONCEAL', 'POWER', 'AF', 'SAND', 'SCHEME', 'COLLUDE', 'SUCC'];

/** The Agents product needs a measured 50% time horizon at least this long: the tasks it sells are half-day work
 *  units (METR time horizons; AI 2027's 2026 agents) [D]. */
export const AGENT_TASK_HOURS = 4;

export type FeatureId = 'memory' | 'deepThink' | 'computerUse' | 'voiceVision' | 'deepResearch' | 'codingAgent' | 'companion' | 'sectorPacks';

/** Where a scaffold or horizon extender applies: 'all' work, or sectors, internal work types and consumer chat ('CHAT'). */
export type WorkScope = 'all' | (SectorId | WorkTypeId | 'CHAT')[];
/** Typed feature effects (V4.3). */
export type FeatureFx =
  | { kind: 'enabler'; sectors?: SectorId[]; consumer?: boolean; packs?: boolean; share: number }
  | { kind: 'horizon'; mult: number; work: WorkScope }
  | { kind: 'scaffold'; dG: number; tokens: number; work: WorkScope }
  | { kind: 'effort'; setting: 'deep' };

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
  /** In the frontier-leader start set (built and on where today's game has it): the ×1 baseline (D5). */
  leader?: boolean;
  /** Effect text and the engine terms it maps to. */
  effect: string;
  risk?: string;
  /** Typed effects (V4.3). */
  fx: FeatureFx[];
  /** Incident hazard × per trait on this product. */
  hazard?: Partial<Record<TraitId, number>>;
  /** Switching it on sets the product's effort to deep (Deep think). */
  effortDeep?: boolean;
}

export const FEATURES: FeatureDef[] = [
  { id: 'memory', name: 'Memory', node: 'P07', products: ['consumer', 'agents', 'enterprise'], buildTW: 12, cash: 0.1,
    effect: 'Horizon extender: time horizon ×1.3 on all work, here and for internal agents; opens 10% more Chat users (people who come back)',
    fx: [{ kind: 'horizon', mult: 1.3, work: 'all' }, { kind: 'enabler', consumer: true, share: 0.1 }],
    risk: 'Successor-alignment incidents ×1.2 (memory carries goals forward)', hazard: { SUCC: 1.2 } },
  { id: 'deepThink', name: 'Deep think', node: 'P05', products: ['consumer', 'api', 'agents', 'enterprise'], buildTW: 8, cash: 0.05,
    effect: 'Effort deep: ×4 reasoning tokens, +0.24 OOM of fit on every task (test-time scaling, +0.4 OOM per ×10)', fx: [{ kind: 'effort', setting: 'deep' }], effortDeep: true,
    risk: 'Cost per work-hour rises with the reasoning tokens (price follows cost)' },
  { id: 'computerUse', name: 'Computer use', node: 'P06', products: ['agents', 'api'], buildTW: 16, cash: 0.15,
    effect: 'Task enabler: operates desktops and browsers, opening 15% more work in Admin, Finance, Legal and Government (GUI-only tasks)',
    fx: [{ kind: 'enabler', sectors: ['OFFICE', 'FIN', 'LEGAL', 'GOV'], share: 0.15 }],
    risk: 'Overreach incidents (power seeking) ×1.3', hazard: { POWER: 1.3 } },
  // C2: also on the API (image, voice and video generation sold to media firms): Chat sells no sector work, so the API
  // is where its Media segment acts; on Chat it opens the Chat users.
  { id: 'voiceVision', name: 'Voice & vision', node: 'multimodal', products: ['consumer', 'api'], buildTW: 12, cash: 0.1,
    effect: 'Task enabler: talks, sees and makes images, opening 15% more Chat users (on Chat) and 15% more Media work (on the API)',
    fx: [{ kind: 'enabler', consumer: true, sectors: ['MEDIA'], share: 0.15 }] },
  // C2: not on Chat: its scaffold lists Science, Finance, Legal and internal research, none of which Chat sells.
  { id: 'deepResearch', name: 'Deep research', node: 'P05', products: ['enterprise'], buildTW: 8, cash: 0.05,
    effect: 'Scaffold: long research reports, +0.3 OOM of fit in Science, Finance and Legal work and for internal research ideas, at ×3 tokens',
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 3, work: ['SCI', 'FIN', 'LEGAL', 'IDEAS'] }],
    risk: 'Cost per work-hour ×3 where it applies (long agent runs)' },
  { id: 'codingAgent', name: 'Coding agent', products: ['agents', 'api'], buildTW: 12, cash: 0.1,
    effect: 'Scaffold: a coding harness, +0.3 OOM of fit in Software & IT and for internal engineering agents, at ×2 tokens',
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 2, work: ['SOFT', 'SWE'] }],
    risk: 'Reward-hacking incidents ×1.2 (agents gaming tests)', hazard: { RH: 1.2 } },
  { id: 'companion', name: 'Companion mode', node: 'engagement', products: ['consumer'], buildTW: 4, cash: 0.05,
    effect: 'Task enabler: a persistent persona, opening 20% more Chat users', fx: [{ kind: 'enabler', consumer: true, share: 0.2 }],
    risk: 'Sycophancy incidents ×1.5', hazard: { SYC: 1.5 } },
  { id: 'sectorPacks', name: 'Sector packs', products: ['enterprise', 'api', 'agents'], buildTW: 0, cash: 0, leader: true,
    effect: 'Task enabler: sector products; a certified sector pack adds +0.42 OOM of fit in that sector (each pack: $0.4B, 120 days)',
    fx: [{ kind: 'enabler', packs: true, share: 0 }] },
];
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, FeatureDef>;
/** The frontier-leader start's built features (D5 baseline). */
export const LEADER_FEATURES: FeatureId[] = FEATURES.filter((f) => f.leader).map((f) => f.id);
