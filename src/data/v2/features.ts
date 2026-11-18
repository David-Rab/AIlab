// Products and product features (STRUCTURE §4.4, §4.9; BUILD-PLAN R6, decisions D5 and D7). Owner: WS1.
//
// Channels become products the player owns. A product is a package: a model (optionally with a mini serving its free
// tier), an optional monitor model, a price tier, safeguards, KYC, effort and features. Everything is editable while
// live (rule R4); edits take effect at the next tick (D7).
//
// Features are built once lab-wide by the engineers (build queue, team-weeks + cash) after their tree node is known,
// then switched on per product. Each maps onto a term the engine already has (consumer appeal, a domain offset on the
// product, the sector bonus of sector products, deep-think effort, serving need, an incident-hazard multiplier); no new
// multiplier enters calibration. D5: the frontier-leader start's set (sector packs) is the neutral ×1 baseline; every
// other feature is a gain when on. [D] = design value.
import type { Channel, DomainId, PriceTier, SectorId, TraitId } from '../../engine/v2/types';

export type { PriceTier };
/** Price tier → price index vs the market reference price [D]. Demand falls with price^−1.5 (mix.ts PRICE_ELASTICITY). */
export const PRICE_TIERS: Record<PriceTier, number> = { budget: 0.7, standard: 1, premium: 1.4 };
export const PRICE_TIER_IDS: PriceTier[] = ['budget', 'standard', 'premium'];
/** Nearest tier to a price index (old saves, bots that set an index). */
export function tierOfIndex(x: number): PriceTier {
  let best: PriceTier = 'standard';
  for (const t of PRICE_TIER_IDS) if (Math.abs(PRICE_TIERS[t] - x) < Math.abs(PRICE_TIERS[best] - x)) best = t;
  return best;
}

/** Products by engine channel: display name, what a customer is and the annual revenue per customer used for the
 *  customer readout (revenue ÷ ARPU) [D: consumer ≈ $20 per weekly user per year (ChatGPT: ~800M weekly users, OpenAI
 *  DevDay Oct 2025, on low-teens $B consumer revenue); API ≈ $1.3K per active developer; Enterprise ≈ $75K per
 *  organisation; Agents ≈ $1.1K per seat; government ≈ $50M per contract]. */
export interface ProductDef {
  channel: Channel;
  name: string;
  /** Plural customer noun. */
  customers: string;
  /** Revenue per customer per year ($). */
  arpu: number;
  /** The segment whose spend the product competes for (share readout). */
  segment: string;
  blurb: string;
}
export const PRODUCT_DEFS: Partial<Record<Channel, ProductDef>> = {
  consumer: { channel: 'consumer', name: 'Chat', customers: 'weekly users', arpu: 20, segment: 'consumer spend', blurb: 'The chat app for the public. Large demand, low price per user.' },
  api: { channel: 'api', name: 'API', customers: 'developers', arpu: 1300, segment: 'sector spend', blurb: 'Developers pay per token. The most exposed to distillation.' },
  enterprise: { channel: 'enterprise', name: 'Enterprise', customers: 'organisations', arpu: 75e3, segment: 'sector spend', blurb: 'Contracts with firms, with sector packs. Sticky, little leak.' },
  agents: { channel: 'agents', name: 'Agents', customers: 'seats', arpu: 1100, segment: 'sector spend', blurb: 'Autonomous agents sold as workers on multi-hour tasks.' },
  gov: { channel: 'gov', name: 'Government', customers: 'contracts', arpu: 50e6, segment: 'government spend', blurb: 'Government and defence contracts (needs a gov variant).' },
  trusted: { channel: 'trusted', name: 'Trusted access', customers: 'partners', arpu: 100e6, segment: 'sector spend', blurb: 'Vetted partners only, at a premium; almost no leak.' },
  open: { channel: 'open', name: 'Open weights', customers: 'downloads', arpu: 0, segment: '—', blurb: 'A release, not a product: no revenue, full leak, cannot be undone.' },
};
/** Products shown as cards, in order. */
export const PRODUCT_ORDER: Channel[] = ['consumer', 'api', 'enterprise', 'agents', 'gov', 'trusted'];

/** Mini free tier: the share of a product's usage served by its mini (free and low-price users) [D]. The product's
 *  quality is the usage-weighted blend of the two models; serving need falls with the mini's lower serve cost. */
export const FREE_TIER_SHARE: Partial<Record<Channel, number>> = { consumer: 0.6, api: 0.3 };

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

/** Auto-evaluate policy: re-run the eval suite on the internal model (and any model updated in place) this often. */
export const AUTO_EVAL_DAYS = 30;

export type FeatureId = 'memory' | 'deepThink' | 'computerUse' | 'voiceVision' | 'deepResearch' | 'codingAgent' | 'companion' | 'sectorPacks';

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
  /** Consumer appeal × (Chat). */
  appeal?: number;
  /** Domain offsets (L) on the product's model. */
  domains?: Partial<Record<DomainId, number>>;
  /** +0.5 L in these sectors (the sector-product bonus, no certification needed). */
  sectors?: SectorId[];
  /** Serving need × (more tokens per task). */
  serve?: number;
  /** Incident hazard × per trait on this product. */
  hazard?: Partial<Record<TraitId, number>>;
  /** Switching it on sets the product's effort to deep (Deep think). */
  effortDeep?: boolean;
}

export const FEATURES: FeatureDef[] = [
  { id: 'memory', name: 'Memory', node: 'P07', products: ['consumer', 'agents', 'enterprise'], buildTW: 12, cash: 0.1,
    effect: 'Chat appeal ×1.1; agent and enterprise work AGENCY +0.3 (remembers context across sessions)', appeal: 1.1, domains: { AGENCY: 0.3 },
    risk: 'Successor-alignment incidents ×1.2 (memory carries goals forward)', hazard: { SUCC: 1.2 } },
  { id: 'deepThink', name: 'Deep think', node: 'P05', products: ['consumer', 'api', 'agents', 'enterprise'], buildTW: 8, cash: 0.05,
    effect: 'Deep-think effort on this product: +0.3 L on every task', effortDeep: true,
    risk: 'Serving: half the revenue per H100e (many more tokens per answer)' },
  { id: 'computerUse', name: 'Computer use', node: 'P06', products: ['agents', 'api'], buildTW: 16, cash: 0.15,
    effect: 'Operates desktops and browsers: AGENCY +0.4', domains: { AGENCY: 0.4 },
    risk: 'Overreach incidents (power seeking) ×1.3', hazard: { POWER: 1.3 } },
  { id: 'voiceVision', name: 'Voice & vision', node: 'multimodal', products: ['consumer'], buildTW: 12, cash: 0.1,
    effect: 'Talks and sees: Chat appeal ×1.1, MEDIA +0.3', appeal: 1.1, domains: { MEDIA: 0.3 } },
  { id: 'deepResearch', name: 'Deep research', node: 'P05', products: ['consumer', 'enterprise'], buildTW: 8, cash: 0.05,
    effect: 'Long research reports: REASON +0.3, RSCH +0.3', domains: { REASON: 0.3, RSCH: 0.3 },
    risk: 'Serving need ×1.1 (long agent runs)', serve: 1.1 },
  { id: 'codingAgent', name: 'Coding agent', products: ['agents', 'api'], buildTW: 12, cash: 0.1,
    effect: 'Agents in Software & IT: +0.5 L in that sector', sectors: ['SOFT'],
    risk: 'Reward-hacking incidents ×1.2 (agents gaming tests)', hazard: { RH: 1.2 } },
  { id: 'companion', name: 'Companion mode', node: 'engagement', products: ['consumer'], buildTW: 4, cash: 0.05,
    effect: 'A persistent persona: Chat appeal ×1.2', appeal: 1.2,
    risk: 'Sycophancy incidents ×1.5', hazard: { SYC: 1.5 } },
  { id: 'sectorPacks', name: 'Sector packs', products: ['enterprise', 'api', 'agents'], buildTW: 0, cash: 0, leader: true,
    effect: 'Sector products: +0.5 L in a sector once certified (each pack: $0.4B, 120 days)' },
];
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, FeatureDef>;
/** The frontier-leader start's built features (D5 baseline). */
export const LEADER_FEATURES: FeatureId[] = FEATURES.filter((f) => f.leader).map((f) => f.id);
