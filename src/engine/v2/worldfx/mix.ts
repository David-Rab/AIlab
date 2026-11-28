// World model mix: which providers' models each sector in each region uses, what they offer on the sector's work and at
// what price (V2-SPEC §3.11.1; model v3 V4: design/MODEL-V3.md §7.3–7.4, design/archive/V3-BUILD.md "V4 notes"). Owner: WS5.
//
// Providers: the player (RD-P03: each of its paid sector products its own seller inside the choice, sharing the
// player's brand and reach; its fit / level readouts are its best product's), the player's open-weights release, each
// active rival's public model, and DeepCent's public model. Per sector s (its work type, worldfx/serving.ts):
//   offer_X   = fit (OOM), coverage a, cost and price per work-hour of X's model. MK-6 (design/MARKET.md M5, M6): every
//               closed seller (the player, each rival, DeepCent) prices each of its tiers at the tier's own cost + M_Xk
//               (the player's × its product's stance factor), ≤ value, ≥ cost; MK-6b: M_Xk its margin per hour here on
//               model k (a version in its lineup; the same model on several of the player's products has one M), a stock
//               (fx.priceM, PRICE_TAU) toward the multi-product logit Nash–Bertrand markup over the segments k wins:
//                 M*_Xk = Σ_{g,b} q_kgb / Σ_{g,b} q_kgb·(1 − s_gb)/μ_b,  q_kgb model k's hours in group g, band b,
//               s_gb the seller's total share there (it internalises the cannibalisation between its own models in a
//               band); a model with no hours: the seller's hours-weighted margin per $ of cost × its own cost;
//               MK-6c: μ_b = c_min,b ÷ ε, c_min,b the lowest serving cost per adopted hour among the tiers that do the
//               whole band (choice.ts bandMu), the same μ in the choice and the targets; it does not depend on prices,
//               so margins follow costs at PRICE_TAU. Agent-hours at their cost × the tier's price-to-cost ratio
//               p/c; MK-9: seats at seat cost + the seller's seat margin (seatTargets, ≤ SEATS.cap) and Chat plans at
//               cost + the plan margin (planTargets, ≤ wtp). Open weights: hosts at cost × OPEN_MARKUP.
//   target_X  = A5: the buyers' surplus choice over bands of task difficulty (worldfx/choice.ts) among every provider's
//               lineup (TIERS: its model and the LINEUP students of it, every provider by the same rule; each player
//               product with its own lineup, playerProdW its part of the player's hours); MK-5 (design/MARKET.md M2): one
//               choice per business buyer group (small / large / vetted, data/v2/market.ts buyerGroups), each over the
//               offers it reaches (the player's products on its rungs of the ladder, BUYER_RUNG; every other provider),
//               target and the player's split the groups' weighted sum (one customer stock per provider, M4);
//               X's prices and costs are its customers' tier mix. A8: buyers multi-home: X is in a
//               buyer's choice set with probability R_X, its reach (a stock toward the labs firms add, MULTI_HOMING:
//               each firm contracts with the providers it ranks best, reachTargets; open weights: their access). Consumers: exp(SHARE_SLOPE_G·Δfit) ·
//               access · brand (V4.2's logit without the price term: users choose by quality, most pay nothing)
//   share_X   = the segment's customer stock, moving toward target_X at the segment's speed (CUSTOMER_TAU)
//   F         = (1 − w_PHYS)·Σ share·a + w_PHYS·σ((Le_PHYS − fMid − θ)/fSpread)    (PHYS stays robot-bound)
//   K         = Σ share·σ(ln(wage ÷ (price + review))/0.7)                           (the physical cost gate)
// The consumer market is the same on the consumer-chat work type, priced per subscriber-month; each provider's paid share
// of its users is a second stock (A2b, CONSUMER_MKT.paid). A2c: per provider also the agent-hours a supervising hour buys
// (k after the buyer's gate) and their price, and the seat price (open weights sell none); prices[] are per adopted
// task-hour (the hours billed per hour). A4: agent-hours stop at the sector's work demand (worldfx/use.ts agentCeilingOf:
// adopted + agent hours ≤ E0·2000·(1 + η·CR), their spend ≤ that × the wage); agentK is after the ceiling.
// RD-P04: capability reaches the world by one path: each model's domain G (OOM, models/capability.ts domainScaleG; the
// player's products with the settings ΔG their offer has; MK-5b: the player's fit, coverage and G per sector-region the
// hours-weighted mix of the tiers its buyers buy, per group on the ladder, not its best product's). SectorMix.g (share-weighted), the consumer SOCIAL G and
// bestPublic (max) are what α, the PHYS gate, control and the tech tree read; no display levels here.
import { SECTORS, REGIONS, ECON } from '../../../data/v2/sectors';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { CONSUMER_MKT, CUSTOMER_TAU, OPEN_PLAN_SHARE, consumerPlanPrice, MARKET_BANDS, MULTI_HOMING, PRICE_ELASTICITY, PRICE_TAU, SEATS, SEED_MARKUP, SHARE_SLOPE_G } from '../../../data/v2/serving';
import { ASSIST } from '../../../data/v2/workTypes';
import { memo } from '../core/memo';
import { PUBLIC } from '../world/public';
import { CHINA_ID } from '../models/labs';
import type { Deployment, DomainId, GameStateV2, LabId, ModelVersion, RegionId, RivalLab, SectorId, SimpleModel, SystemCtx } from '../types';
import { robotAvail } from './robots';
import { agentCeilingOf, seatHoursPerMonth, workHoursOf, type AgentCeiling } from './use';
import { bandMu, mergeChoices, surplusChoice, type Choice, type Tier } from './choice';
import { buyerGroups } from '../../../data/v2/market';
import { techRamp } from './util';
import { V2_DOMAIN_OFF, domainScaleG, gOfLevel, gOfV2Level, oomPerLevel, v2LevelGate } from '../models/capability';
import { flopPerToken } from '../departments/workfit';
import { decodeUtilNow } from '../models/stacks';
import { npcDecodeU, npcServeFpt } from '../npc/model';
import {
  chatToolAppeal, fptOfSimple, fxOn, labToolOpts, offerOf, stanceFactor,
  agentDemandOf, agentMixOf, chatFreeTier, paidShareTarget, productFx, productLineup, productTierUses, productOffer, productTools, productUses, savedPerAdoptedHour, serveDollarsPerHour, settingsDG, subPrice,
  tokEff, valuePerHour, wagePerHour, type ModelUse, type Offer,
} from './serving';

export { PRICE_ELASTICITY };
/** Open weights are served by hosts near cost (×1.2) [D]. */
export const OPEN_MARKUP = 1.2;

/** Channels that sell into sectors (MK-5: each to the buyer groups on and above its rung of the ladder, BUYER_RUNG).
 *  Consumer is its own market; internal earns nothing. */
export const SECTOR_CHANNELS: Deployment['channel'][] = ['api', 'enterprise', 'vetted'];

/** MK-5 (design/MARKET.md M2): a sector's business buyer groups, lowest rung first (shares: data/v2/market.ts
 *  buyerGroups). */
export const BUYER_GROUP_IDS = ['small', 'large', 'vetted'] as const;
export type BuyerGroupId = (typeof BUYER_GROUP_IDS)[number];
/** MK-5: the ladder: a sector product's rung; buyer group g (BUYER_GROUP_IDS index) reaches the products of rung ≤ g
 *  (small → API; large → Enterprise, API; vetted → Vetted, Enterprise, API). Other providers reach every group. */
export const BUYER_RUNG: Partial<Record<Deployment['channel'], number>> = { api: 0, enterprise: 1, vetted: 2 };
/** MK-5 test switch (scripts/v2/_mk5/check.ts @ af8ee983): every buyer group reaches every player product (the single choice of
 *  before the ladder); split: one choice per group even where groups reach the same products (tests the merge);
 *  bestOnly (MK-5b, scripts/v2/_mk5b/check.ts @ 826d6bb4): the player's fit, coverage and G per sector its best product's main
 *  model (before MK-5b). Never set by the game. */
export const BUYER_LADDER_TEST = { allReach: false, split: false, bestOnly: false };

const ND = DOMAIN_IDS.length;
const I = Object.fromEntries(DOMAIN_IDS.map((d, i) => [d, i])) as Record<DomainId, number>;
const PHYS = I.PHYS;

/** Precomputed sector task vectors: cognitive (domain index, weight) pairs and the PHYS weight (the PHYS gate). */
export const SECTOR_TASKS = SECTORS.map((def) => {
  const idx: number[] = [];
  const w: number[] = [];
  for (const [d, x] of Object.entries(def.tasks) as [DomainId, number][]) {
    if (d === 'PHYS') continue;
    idx.push(I[d]);
    w.push(x);
  }
  return { id: def.id, idx, w, physW: def.tasks.PHYS ?? 0, gov: def.id === 'GOV' || def.id === 'MIL', theta: def.theta };
});

export interface Provider {
  key: string; // 'player' | 'player:open' | rival id | 'china'
  lab: LabId;
  paid: boolean; // earns player revenue
  open: boolean;
  /** The model (non-player providers): fit reads its G, cost its FLOP per token. */
  model?: SimpleModel | ModelVersion;
  fpt?: number;
  /** RD-P02: a non-player lab's lineup below its model (RivalLab.lineup: earlier public models, distilled students), each
   *  real model at its own serving FLOP per token; the lab sells them all at its markup. */
  tiers?: { model: SimpleModel; fpt: number }[];
  /** Model v3 D10: the provider's decode utilisation (its lab's serving stack; the player's for its open release). */
  ud?: number;
  /** MK-6: the price over cost of its offers before the margin M (1 for closed sellers, OPEN_MARKUP for open weights). */
  markup: number;
  brand: number;
  /** Chat appeal; a rival's includes its acquired Chat tools (RD-P07 chatToolAppeal). */
  appeal: number;
  /** RD-P07, MK-11: the product tools a non-player lab has (RivalLab.tools); none for the player's open
   *  release (a release carries no product tools). The player's products read their own (productTools). */
  tools?: readonly string[];
}

export interface SectorMix {
  /** Customer stock shares by provider index (what the sector uses today), and the logit target they move toward. */
  share: number[];
  target: number[];
  /** Per provider: fit (OOM), coverage of the sector's cognitive work, price per adopted task-hour ($, value-capped).
   *  MK-5b: the player's fit and coverage are the hours-weighted mix of the tiers its buyers buy here (its products on
   *  each group's rungs of the ladder and their tiers; no target share: its best product's main model). */
  fit: number[];
  cover: number[];
  prices: number[];
  /** A2c per provider: agent-hours a supervising hour buys (k after the buyer's gate), price per agent-hour ($, capped at
   *  the wage), seat price per seat-month ($; 0 for open weights: in-house use is unbilled). seatPrice: the going seat
   *  price (share-weighted over the providers that sell seats) the seat target reads. MK-5c: the player's agentK and
   *  agent price are the mix of the tiers its buyers buy (each tier its own k, λ; serving.ts agentMixOf). */
  agentK: number[];
  agentPrices: number[];
  seatPrices: number[];
  seatPrice: number;
  /** MK-9 (M5): per provider its seat margin here ($ per seat-month over each tier's seat serving cost; the stock
   *  fx.seatM, 0 for open weights), its target μ_seat ÷ (1 − s) ≤ SEATS.cap − its seat cost (NaN: open weights or not
   *  selling here) and its customers' seat serving cost per seat-month. */
  seatM: number[];
  seatMTarget: number[];
  seatCost: number[];
  /** A4: the demand ceiling on AI work here (use.ts agentCeilingOf). agentK is after it: every provider's agent-hours
   *  × agentCeiling.fill. */
  agentCeiling: AgentCeiling;
  /** RD-P04a: the market's share-weighted domain G on the general λ scale (OOM; models/capability.ts domainScaleG: each
   *  model's domain G, the player's products with their settings ΔG as in the offer); PHYS robot-bound. What α, the
   *  Bass q and the PHYS gate read. */
  g: Record<DomainId, number>;
  /** Share-weighted price per hour of AI use ($) and the buyer's cost per AI work-hour saved, incl. review ($). */
  price: number;
  pCost: number;
  /** Feasibility (coverage, PHYS robot-bound) and cost gate on the market's mix of models. */
  F: number;
  K: number;
  /** For the player: the deployment that serves this sector (best offer), its price per work-hour. */
  playerDep?: string;
  playerPrice: number;
  /** Share lost to price (1 = none) vs to quality, for the binding-cause readout. */
  priceFactor: number;
  /** A5: the buyers' surplus choice (bands, band shares, each provider's tier per band), every provider's tiers (offers
   *  before the value cap, their kind and value-capped price) and its customers' hours by tier (weight[i][k], sum 1). */
  tiers: { choice: Choice; offers: Offer[][]; kind: TierKind[][]; price: number[][]; weight: number[][] };
  /** TIERS: per player product, its buyers' hours here by tier of its lineup (worldfx/serving.ts productLineup order:
   *  main model, then its real lineup entries; sum 1). */
  playerTierW: Record<string, number[]>;
  /** RD-P03 (DD-02): per player product, its part of the player's hours here (sum 1 over its sector products): the
   *  buyers' choice among the player's products, each its own seller in the surplus choice. */
  playerProdW: Record<string, number>;
  /** MK-5 (M2): per business buyer group present here (share w > 0; market.ts buyerGroups), its choice's provider
   *  targets and its split of the player's hours between the player's products (the ladder: small buyers buy only API,
   *  large Enterprise or API). target and playerProdW above are these weighted by w and by the player's hours. */
  byGroup: Partial<Record<BuyerGroupId, { w: number; target: number[]; playerProdW: Record<string, number>; ch: Choice; mask: readonly (readonly boolean[] | undefined)[] }>>;
  /** MK-7 (M7): the choice's inputs, to re-run it for buyers turned away (rerunChoice); tierDep: the player product of
   *  each of its tiers (its lineup in the choice's order). */
  rerun: { lineups: Tier[][]; brand: number[]; acc: number[]; value: number; aTop: number; B: number; groups: (number[] | undefined)[]; muIn: number[]; tierDep: string[] };
  /** MK-6b (M5): per provider and model (markupModels[i]: its distinct models' ids in lineup order; tierModel[i][k]: tier
   *  k's index there) the margin M it prices that model at here ($ per adopted task-hour over each tier's cost; all 0 for
   *  open weights) and its Nash–Bertrand target (NaN: open weights or not selling here). */
  markup: number[][];
  markupTarget: number[][];
  markupModels: string[][];
  tierModel: number[][];
  /** MK-6: per player product its lineup here at this region's prices (productLineup order; price, priceAg and seat
   *  set): what revenue.ts bills. */
  playerLines: Record<string, Offer[]>;
}
/** A5: a tier is a provider's own model (the player's: a product's main model), another real model of a player product's
 *  lineup (RD-P01a: `mini` = any lineup entry after the main model), or a distilled student of a rival's or China's model
 *  (TIERS: their lineup's cheap tiers, data/v2/serving.ts LINEUP; RD-P02 makes them lab state). */
export type TierKind = 'model' | 'mini' | 'student';

export interface ConsumerMix {
  share: number[]; target: number[];
  /** RD-P04b: per provider its consumer model's SOCIAL domain G (OOM, general λ scale), and the users' share-weighted
   *  SOCIAL G (what the AI-friend share and persuasion read). */
  socialGs: number[]; socialG: number;
  /** Per provider: consumer-chat fit (its consumer model: what subscribers get), coverage and subscription price
   *  ($/month); A7: the consumer-chat fit of its free tier (what users choose on). */
  fit: number[]; freeFit: number[]; cover: number[]; prices: number[];
  /** Coverage of consumer chat by the best accessible model. */
  bestCover: number;
  /** A2b: per provider, the paid share of its weekly users (stock) and the target it moves toward. */
  paid: number[]; paidTarget: number[];
  /** The going subscription price ($/month): users' share-weighted price among plans at or below the willingness to pay. */
  going: number;
  playerDep?: string; playerPrice: number; priceFactor: number;
}

export interface WorldMix {
  providers: Provider[];
  sec: Record<RegionId, Record<SectorId, SectorMix>>;
  consumer: Record<RegionId, ConsumerMix>;
  /** MK-9 (M3, M5): the paid-plan market, one price per seller across regions. Per provider: its plan margin ($ per
   *  subscriber-month over its serving cost; the stock fx.planM; 0 for open weights and providers without Chat), its
   *  target (NaN: none), a paying user's serving cost a month and its share of all paying subscribers (s_paid, from the
   *  user-share and paid-share stocks); going: the users-weighted going plan price over the regions; mu: μ_plan
   *  (going ÷ CONSUMER_MKT.paid.elasticity at the sellers' targets). */
  plan: { margin: number[]; target: number[]; cost: number[]; share: number[]; going: number; mu: number };
  /** A8: per region and provider index, the share of sector buyers who buy from the provider at all (its reach, a
   *  stock: fx.secReach) and the target it moves toward (MULTI_HOMING). */
  reach: Record<RegionId, { stock: number[]; target: number[] }>;
  /** RD-P04b: best public domain G (OOM, general λ scale: max over the player's paid products with their settings ΔG and
   *  the other providers' models); the tech gates, science rate, control and macro read it. bestPublicLg: the best
   *  public general level λ(G) (the hype term). */
  bestPublic: Record<DomainId, number>;
  bestPublicLg: number;
  /** The player's offer per sector (its best product's). */
  playerOffers: Partial<Record<SectorId, Offer>>;
  /** P2: every player product's offer per sector as computed for this mix (key `<deployment id>|<sector>`). Only valid
   *  while the state is unchanged since the mix was computed (applyRevenue reuses it right after computing the mix). */
  offerBy: Map<string, Offer>;
  /** TIERS: every player sector product's lineup per sector (same key; productLineup order), valid as offerBy. */
  lineupBy: Map<string, Offer[]>;
}

/** Appeal of a version's character training for consumers (§3.11.3 "appeal (pref option)"): the version's own
 *  `appeal`, set from data/v2/runDesign.ts POST_PREF (V2-SPEC §3.3.2 D: minimal 0.7, engagement 1.2, constitution 1.0,
 *  persuasion 1.1), the number the Models card shows. RD-B11 (B41): one table (the market's second switch is gone). */
export const appealOf = (v: ModelVersion | undefined): number => v?.appeal ?? 1;

/** Player deployments that earn revenue in external markets. */
export function paidDeployments(s: GameStateV2): Deployment[] {
  return s.player.deployments.filter((d) => d.status !== 'withdrawn' && d.channel !== 'internal' && d.channel !== 'open');
}

export function versionOf(s: GameStateV2, id: string): ModelVersion | undefined {
  return s.player.models.versions.find((v) => v.id === id);
}

/** A packed array of n copies of x (faster than new Array(n).fill(x), which is holey). */
function filled(n: number, x: number): number[] {
  const a: number[] = [];
  for (let i = 0; i < n; i++) a.push(x);
  return a;
}

/** A provider's customers' tier mix in a choice (sum 1): its band shares; with no target share (its stock may still
 *  hold customers) its tier split with every band weighted alike; else its own model alone. */
function tierMix(ch: Choice, i: number, len: number, B: number): number[] {
  const tw = filled(len, 0);
  const sb = ch.sub[i];
  const ti = ch.target[i];
  if (ti > 1e-12) {
    for (let b = 0; b < B; b++) {
      const x = ch.share[i][b] / (B * ti);
      if (sb?.[b]) for (let k = 0; k < len; k++) tw[k] += x * sb[b][k];
      else tw[ch.pick[i][b]] += x;
    }
  } else if (sb?.length === B) {
    for (let b = 0; b < B; b++) for (let k = 0; k < len; k++) tw[k] += sb[b][k] / B;
  } else if (len) tw[0] = 1;
  return tw;
}

/** RD-P03: the player's tier mix (tw, its lineups in pTiers order) → per product its part of the player's hours
 *  (prodW, sum 1) and its buyers' hours by tier of its lineup (tierW, sum 1). No choice at all (tw all 0): the best
 *  product by offer utility (`best`, a cands index) holds the player's customers. */
function prodSplit(tw: readonly number[], pt: readonly { c: number; k: number }[], best: number, cands: readonly { dep: Deployment }[]): { tierW: Record<string, number[]>; prodW: Record<string, number> } {
  const tierW: Record<string, number[]> = {};
  const prodW: Record<string, number> = {};
  let any = 0;
  for (const x of tw) any += x;
  for (let j = 0; j < pt.length; ) {
    const c = pt[j].c;
    let e = j;
    while (e < pt.length && pt[e].c === c) e++;
    let sum = 0;
    for (let k = j; k < e; k++) sum += tw[k] ?? 0;
    if (!(any > 0)) sum = c === best ? 1 : 0;
    const w = filled(e - j, 0);
    if (sum > 0 && any > 0) for (let k = j; k < e; k++) w[k - j] = (tw[k] ?? 0) / sum;
    else w[0] = 1;
    const dep = cands[c].dep;
    tierW[dep.id] = w;
    prodW[dep.id] = sum;
    j = e;
  }
  return { tierW, prodW };
}

/** Domain vector (DOMAIN_IDS order) → record, as a fixed-shape literal (fast property access). */
function domRecord(v: ArrayLike<number>): Record<DomainId, number> {
  return { CODE: v[I.CODE], RSCH: v[I.RSCH], REASON: v[I.REASON], AGENCY: v[I.AGENCY], SOCIAL: v[I.SOCIAL], MEDIA: v[I.MEDIA], CYBER: v[I.CYBER], BIO: v[I.BIO], PHYS: v[I.PHYS] };
}

function access(p: Provider, r: RegionId): number {
  if (p.lab === CHINA_ID) return r === 'CN' ? 1 : p.open ? (r === 'US' ? 0.3 : 0.7) : r === 'US' ? 0.05 : 0.4;
  if (r === 'CN') return p.open ? 0.6 : 0.05;
  return 1;
}

/** The player's brand factor on demand: ±0.1 with approval (§3.11.1; world/public.ts, W4).
 *  RD-P11, RF-P4: the flat ×1.2 incumbent factor is gone; the incumbent's pull is its customer stock (CUSTOMER_TAU
 *  switching inertia), the same for every provider. */
const playerBrand = (s: GameStateV2) => 1 + PUBLIC.brandSwing * Math.max(-1, Math.min(1, s.public.approval / 50));

/** Compute the world mix (memoised per tick when a ctx is given). */
export function worldMix(s: GameStateV2, ctx?: SystemCtx): WorldMix {
  return ctx ? memo(ctx, 'WS5:mix', () => computeMix(s)) : computeMix(s);
}

/** Logit weights → shares (normalised): exp(slope·(fit − best)) · (price ÷ cheapest)^−ε · access · brand. */
function logit(fit: number[], price: number[], acc: number[], brand: number[]): number[] {
  const n = fit.length;
  let best = -Infinity;
  let pMin = Infinity;
  for (let i = 0; i < n; i++) if (acc[i] > 0 && fit[i] > -Infinity) {
    if (fit[i] > best) best = fit[i];
    if (price[i] > 0 && price[i] < pMin) pMin = price[i];
  }
  const out = filled(n, 0);
  if (best === -Infinity) return out;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (fit[i] === -Infinity || acc[i] <= 0) continue;
    const pr = price[i] > 0 && pMin < Infinity ? price[i] / pMin : 1;
    const w = (Math.exp(SHARE_SLOPE_G * (fit[i] - best)) * acc[i] * brand[i]) / Math.pow(pr, PRICE_ELASTICITY);
    out[i] = w;
    sum += w;
  }
  if (sum > 0) for (let i = 0; i < n; i++) out[i] /= sum;
  return out;
}

/**
 * A8 / REACH: the reach targets of a region's closed providers. Each firm can buy from provider i with probability
 * acc[i] (independently, as in the sector choice sets) and contracts with the `m` providers it ranks best among those:
 * a rank-ordered logit (Plackett–Luce: first pick ∝ e^lw over the reachable, the next ∝ e^lw over the rest, …).
 * R*_i = P(i is among a firm's picks), so Σ R* = the expected min(m, reachable providers): a firm's second contract
 * goes to the best of the others, however far ahead the first is (A8 took min(acc, m·w ÷ Σw), which lost that
 * contract whenever one lab's m·w ÷ Σw exceeded its access). lw[i] = ln brand + SHARE_SLOPE_G·(fit − best); −∞: not
 * a closed seller. Exact: every combination of the partially accessible providers, every ordered pick sequence.
 */
export function reachTargets(lw: readonly number[], acc: readonly number[], m: number): number[] {
  const n = lw.length;
  const out = filled(n, 0);
  const on: number[] = [];
  for (let i = 0; i < n; i++) if (lw[i] > -Infinity && acc[i] > 0) on.push(i);
  if (!on.length || m <= 0) return out;
  const partial = on.filter((i) => acc[i] < 1 - 1e-12);
  const incl = filled(n, 0);
  // Pick sequences without replacement from `left` (indices into lw), `k` picks to go, probability p so far.
  const pickFrom = (left: number[], k: number, p: number) => {
    if (k <= 0 || !left.length) return;
    if (left.length <= k) {
      for (const i of left) incl[i] += p;
      return;
    }
    let top = -Infinity;
    for (const i of left) if (lw[i] > top) top = lw[i];
    let W = 0;
    for (const i of left) W += Math.exp(lw[i] - top);
    for (let j = 0; j < left.length; j++) {
      const i = left[j];
      const q = (p * Math.exp(lw[i] - top)) / W;
      if (!(q > 0)) continue;
      incl[i] += q;
      if (k > 1) pickFrom(left.filter((_, x) => x !== j), k - 1, q);
    }
  };
  for (let mask = 0; mask < 1 << partial.length; mask++) {
    let p = 1;
    const set: number[] = [];
    for (const i of on) {
      const k = partial.indexOf(i);
      if (k < 0) set.push(i);
      else if (mask & (1 << k)) {
        p *= acc[i];
        set.push(i);
      } else p *= 1 - acc[i];
    }
    if (p > 0) pickFrom(set, Math.floor(m), p);
  }
  for (const i of on) out[i] = Math.min(acc[i], incl[i]);
  return out;
}

/** The customer stock of a segment as shares by provider index (the target where the segment has no stock yet). */
function stockShares(s: GameStateV2, providers: Provider[], r: RegionId, seg: string, target: number[]): number[] {
  const st = s.world.fx.cust?.[r]?.[seg];
  if (!st) return target.slice();
  const n = providers.length;
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = st[providers[i].key] ?? 0;
    out.push(x);
    sum += x;
  }
  if (sum <= 1e-12) return target.slice();
  for (let i = 0; i < n; i++) out[i] = out[i] / sum;
  return out;
}

/** RD-P02: a lab's lineup tiers on sale (an inactive lab's open-weight ones only: others host those). */
const tiersOf = (s: GameStateV2, r: RivalLab) =>
  (r.lineup ?? []).filter((m) => r.core.status === 'active' || m.openWeights).map((m) => ({ model: m, fpt: npcServeFpt(s, m) }));
/** The market's providers (computeMix's list, in its order). */
function providersOf(s: GameStateV2, paid: Deployment[], ver: Map<string, ModelVersion>): Provider[] {
  const providers: Provider[] = [];
  if (paid.length) providers.push({ key: 'player', lab: 'player', paid: true, open: false, brand: playerBrand(s), appeal: 1, markup: 1 });
  const open = s.player.deployments.filter((d) => d.channel === 'open' && d.status !== 'withdrawn');
  if (open.length) {
    let best: ModelVersion | undefined;
    for (const d of open) {
      const v = ver.get(d.versionId);
      if (v && (!best || v.Lg > best.Lg)) best = v;
    }
    if (best) providers.push({ key: 'player:open', lab: 'player', paid: false, open: true, model: best, fpt: best.fpt, brand: 1, appeal: 1, markup: OPEN_MARKUP, ud: decodeUtilNow(s) });
  }
  for (const r of s.rivals) {
    const m = r.publicModel;
    if (!m || (r.core.status !== 'active' && !m.openWeights)) continue;
    providers.push({ key: r.core.id, lab: r.core.id, paid: false, open: m.openWeights, model: m, tiers: tiersOf(s, r), fpt: npcServeFpt(s, m), ud: npcDecodeU(s), brand: r.core.status === 'active' ? 1 : 0.5, appeal: chatToolAppeal(r.tools), tools: r.tools, markup: m.openWeights ? OPEN_MARKUP : 1 });
  }
  const cn = s.china.lab.publicModel;
  if (cn && (s.china.lab.core.status === 'active' || cn.openWeights)) providers.push({ key: CHINA_ID, lab: CHINA_ID, paid: false, open: cn.openWeights, model: cn, tiers: tiersOf(s, s.china.lab), fpt: npcServeFpt(s, cn), ud: npcDecodeU(s), brand: 1, appeal: chatToolAppeal(s.china.lab.tools), tools: s.china.lab.tools, markup: cn.openWeights ? OPEN_MARKUP : 1 });
  for (const p of providers) if (p.model && !p.fpt) p.fpt = 'baseId' in p.model ? flopPerToken(s, p.model) : fptOfSimple(s, p.model);
  return providers;
}

const versionMap = (s: GameStateV2) => {
  const ver = new Map<string, ModelVersion>();
  for (const v of s.player.models.versions) ver.set(v.id, v);
  return ver;
};

/** RD-P04: a model's domain G vector (DOMAIN_IDS order; OOM on the general λ scale) plus a ΔG (a product's settings). */
const gvecOf = (s: GameStateV2, m: Pick<ModelVersion, 'G' | 'build'>, dG = 0) => DOMAIN_IDS.map((d) => domainScaleG(s.hidden.timeline, m, d) + dG);
/** RD-P04: a player product's domain G vector: its model's, plus the settings ΔG its offer has (safeguards, control layer;
 *  worldfx/serving.ts settingsDG, as in productOffer). */
export const productGVec = (s: GameStateV2, d: Deployment, mv: Pick<ModelVersion, 'G' | 'build'>) => gvecOf(s, mv, settingsDG(d));

/** Best public domain G (max over the player's paid products and the other providers' models; floor λ⁻¹(0), v2's L 0). */
function bestPublicFrom(s: GameStateV2, cands: readonly { g: number[] }[], pg: readonly (number[] | undefined)[]): Record<DomainId, number> {
  const v = filled(ND, gOfLevel(s.hidden.timeline, 0));
  for (const c of cands) for (let k = 0; k < ND; k++) v[k] = Math.max(v[k], c.g[k]);
  for (const g of pg) if (g) for (let k = 0; k < ND; k++) v[k] = Math.max(v[k], g[k]);
  return domRecord(v);
}

/** P2: the world mix's bestPublic alone (the same values), for readers that need nothing else (macro's automation
 *  factor, moonshot gates): skips the offers, shares and stocks. */
export function bestPublicOf(s: GameStateV2): Record<DomainId, number> {
  const paid = paidDeployments(s);
  const ver = versionMap(s);
  const cands: { g: number[] }[] = [];
  for (const d of paid) {
    if (d.held) continue; // SR-19: a held product is not public
    const mv = ver.get(d.versionId);
    if (mv) cands.push({ g: productGVec(s, d, mv) });
  }
  return bestPublicFrom(s, cands, providersOf(s, paid, ver).map((p) => (p.model ? gvecOf(s, p.model) : undefined)));
}

/**
 * MK-6 (design/MARKET.md M5), MK-6b (margin per model): each closed seller's Nash–Bertrand target margin M*_k ($ per
 * adopted task-hour) on each of its models k (`tm[i][k]`: tier k's model index) in one sector × region, from the buyers'
 * choice `ch` (made of the buyer groups `segs`, weights w): over the groups and bands where model k wins hours,
 * M*_k = Σ q_k / Σ q_k·(1 − s)/μ_b (q_k = w_g·s·(k's part of the seller's band split) model k's hours in group g, band
 * b; s the SELLER's share there, all its products and models together, so it internalises the cannibalisation between
 * its own models in a band): the first-order condition of one margin per model over the segments it sells in (one
 * segment: μ ÷ (1 − s)). Capped at the value. A model with no hours here: the seller's hours-weighted margin per $ of
 * cost over its models with hours (Σ q_k·M*_k ÷ Σ q_k·c_k) × the model's own cost `mc[i][k]`, so a newly added cheap
 * model starts at a price in proportion to its cost (and can win the easy bands); a seller with no hours at all: the
 * mean μ (s = 0) on its main model, scaled by cost to its others. MK-6c: μ_b the choice's (ch.mu, choice.ts bandMu: the
 * cheapest adequate tier's cost ÷ ε), which does not depend on prices, so the target is direct (MK-6's band-price
 * fixed point and its Aitken step are gone).
 */
/** MK-9 (design/MARKET.md M5): each closed seller's seat margin target on the seat market of one sector × region: the
 *  first-order condition of a logit in log price with ε = SEATS.elasticity, p − c = p ÷ (ε·(1 − s)), i.e.
 *  M*_i = c_i ÷ (ε·(1 − s_i) − 1) where ε·(1 − s_i) > 1, else SEATS.cap − c_i; ≤ SEATS.cap − c_i, ≥ 0. s_i its share of
 *  the seats here, c_i its customers' seat serving cost. NaN: open weights or not selling here. */
function seatTargets(providers: readonly Provider[], offers: readonly (Offer | undefined)[], share: readonly number[], seatCost: readonly number[]): number[] {
  return providers.map((p, i) => {
    if (p.open || !offers[i]) return NaN;
    const c = seatCost[i];
    const room = Math.max(0, SEATS.cap - c);
    const e = SEATS.elasticity * (1 - Math.min(1, share[i]));
    return e > 1 ? Math.min(room, c / (e - 1)) : room;
  });
}

function nashTargets(ch: Choice, segs: readonly { w: number; ch: Choice }[], providers: readonly Provider[], offers: readonly (Offer | undefined)[], value: number, tm: readonly (readonly number[])[], mc: readonly (readonly number[])[]): number[][] {
  const n = providers.length;
  const mu = ch.mu;
  const B = mu.length;
  const out = mc.map((c) => filled(c.length, NaN));
  const isN = providers.map((p, i) => !p.open && !!offers[i]);
  if (!isN.some(Boolean)) return out;
  let sum = 0;
  let nb = 0;
  for (let b = 0; b < B; b++) if (mu[b] > 0) (sum += mu[b]), nb++;
  const muBar = nb ? sum / nb : 0;
  for (let i = 0; i < n; i++) {
    if (!isN[i]) continue;
    // Per model its hours (Q) and Σ hours × (1 − s) ÷ μ_b (D), s the seller's share in the group's band.
    const ti = tm[i];
    const o = out[i];
    const c = mc[i];
    const Q = filled(o.length, 0);
    const D = filled(o.length, 0);
    for (const p of segs) for (let b = 0; b < B; b++) {
      const x = p.ch.share[i][b];
      if (!(x > 0) || !(mu[b] > 0)) continue;
      const q = p.w * x;
      const sb = p.ch.sub[i]?.[b];
      if (sb?.length) {
        for (let k = 0; k < sb.length; k++) if (sb[k] > 0) {
          Q[ti[k]] += q * sb[k];
          D[ti[k]] += (q * sb[k] * (1 - x)) / mu[b];
        }
      } else {
        const k = p.ch.pick[i][b];
        if (k < 0) continue;
        Q[ti[k]] += q;
        D[ti[k]] += (q * (1 - x)) / mu[b];
      }
    }
    let qm = 0;
    let qc = 0;
    for (let m = 0; m < o.length; m++) {
      if (!(Q[m] > 0)) continue;
      o[m] = Math.min(value, D[m] > 0 ? Q[m] / D[m] : value);
      qm += Q[m] * o[m];
      qc += Q[m] * c[m];
    }
    for (let m = 0; m < o.length; m++) {
      if (Q[m] > 0) continue;
      o[m] = Math.min(value, qc > 0 ? (qm / qc) * c[m] : c[0] > 0 ? (muBar * c[m]) / c[0] : muBar);
    }
  }
  return out;
}

function computeMix(s: GameStateV2): WorldMix {
  const paid = paidDeployments(s);
  const ver = versionMap(s);
  const providers = providersOf(s, paid, ver);

  const pfFloor = 10 * techRamp(s, 'W16');
  const pfLog = 3 * techRamp(s, 'W19');
  const n = providers.length;
  const playerIdx = providers.findIndex((p) => p.key === 'player');
  const acc = REGIONS.map((r) => providers.map((p) => access(p, r)));
  // MK-7: no capacity penalty on the brand (deleted): a lab that turns buyers away loses them through its customer stock.
  const brandPow = providers.map((p) => p.brand);
  const rate = serveDollarsPerHour(s);

  // RD-P04: domain G vectors (OOM, general λ scale) from the same model the offer reads: other providers', and the
  // player's candidate products with their settings ΔG (productGVec).
  const w = s.hidden.timeline;
  const pg: (number[] | undefined)[] = providers.map((p) => (p.model ? gvecOf(s, p.model) : undefined));
  // MK-5b: tierG, the domain G of each tier of the product's lineup (productLineup order: its main model's g, then each
  // lineup entry's with the product's settings ΔG).
  const cands: { dep: Deployment; g: number[]; tierG: number[][]; ch: Deployment['channel']; uses: ModelUse[]; tiers: ModelUse[][]; fx: ReturnType<typeof productFx>; tools: string[] }[] = [];
  for (const d of paid) {
    if (d.held) continue; // SR-19 x RD-P03: a product the Safety framework holds serves nobody, so it is no seller
    const mv = ver.get(d.versionId);
    if (!mv) continue;
    const tiers = productTierUses(s, d);
    const g = productGVec(s, d, mv);
    cands.push({ dep: d, g, tierG: [g, ...tiers.map((u) => productGVec(s, d, u[0].v as ModelVersion))], ch: d.channel, uses: productUses(s, d), tiers, fx: productFx(s, d), tools: productTools(s, d) });
  }
  // A8 multi-homing: in a sector's choice each provider is in a buyer's set with probability R (its reach: a stock in
  // fx.secReach, ≤ its access). Start (and a provider with no stock yet): access × min(1, MULTI_HOMING.providers ÷ the
  // region's expected reachable sector providers). One array per region, so the choice sets stay memoised.
  const sells = providers.map((p, i) => (i === playerIdx ? cands.some((c) => c.ch !== 'consumer') : !!p.model));
  const accSec = REGIONS.map((r, ri) => {
    const row = acc[ri];
    let N = 0;
    for (let i = 0; i < n; i++) if (sells[i] && !providers[i].open) N += row[i];
    const q = Math.min(1, MULTI_HOMING.providers / Math.max(1e-9, N));
    const st = s.world.fx.secReach?.[r];
    return providers.map((p, i) => (!sells[i] ? 0 : p.open ? row[i] : Math.min(row[i], st?.[p.key] ?? row[i] * q)));
  });

  // MK-5c decision: bestPublic stays the max over every public offer (the best capability on the market: the PHYS gate,
  // tech tree, misuse and macro read it), not a buyer-weighted mix.
  const bestPublic = bestPublicFrom(s, cands, pg);
  let bestPublicLg = 0;
  for (const c of cands) bestPublicLg = Math.max(bestPublicLg, ver.get(c.dep.versionId)!.Lg);
  for (const r of [...s.rivals, s.china.lab]) if (r.publicModel) bestPublicLg = Math.max(bestPublicLg, r.publicModel.Lg);

  // Per sector (region-independent): each provider's offer (fit, coverage, price before the value cap); the player's best
  // product by offer utility.
  const S = SECTOR_TASKS.length;
  const B = MARKET_BANDS;
  const offers: (Offer | undefined)[][] = [];
  const pCand: number[] = [];
  const playerOffers: Partial<Record<SectorId, Offer>> = {};
  const offerBy = new Map<string, Offer>();
  const lineupBy = new Map<string, Offer[]>();
  // A5 lineups: every provider's tiers on the sector's work (index 0 its own model), the coverable range a_top, and for
  // the player which product (cands index) and which tier of its lineup (productLineup order) each tier is.
  const lineOff: Offer[][][] = [];
  const kinds: TierKind[][][] = [];
  const pTiers: { c: number; k: number }[][] = [];
  const aTops: number[] = [];
  const tierMods: number[][][] = [];
  const modIds: string[][][] = [];
  for (let si = 0; si < S; si++) {
    const t = SECTOR_TASKS[si];
    const row: (Offer | undefined)[] = new Array(n);
    const lines: Offer[][] = [];
    const kind: TierKind[][] = [];
    for (let i = 0; i < n; i++) {
      const p = providers[i];
      if (p.model) row[i] = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], t.id, { markup: p.markup, rate, ud: p.ud, tools: p.tools, ...labToolOpts(s, p.tools, t.id, p.model) });
      lines.push(row[i] ? [row[i]!] : []);
      kind.push(row[i] ? ['model'] : []);
    }
    let bc = -1;
    let bu = -Infinity;
    const pt: { c: number; k: number }[] = [];
    if (playerIdx >= 0) {
      for (let c = 0; c < cands.length; c++) {
        const cd = cands[c];
        if (cd.ch === 'consumer') continue;
        const o = productOffer(s, cd.dep, t.id, cd.uses, cd.fx, cd.tools);
        offerBy.set(`${cd.dep.id}|${t.id}`, o);
        // TIERS / RD-P01a: the product's lineup (main model, then its real lineup entries; no phantom students).
        const line = productLineup(s, cd.dep, t.id, o, cd.fx, cd.tiers, cd.tools);
        lineupBy.set(`${cd.dep.id}|${t.id}`, line);
        for (let k = 0; k < line.length; k++) {
          lines[playerIdx].push(line[k]);
          kind[playerIdx].push(k === 0 ? 'model' : 'mini');
          pt.push({ c, k });
        }
        const u = SHARE_SLOPE_G * o.fit - PRICE_ELASTICITY * Math.log(Math.max(1e-9, o.price));
        if (u > bu) {
          bu = u;
          bc = c;
          row[playerIdx] = o;
          playerOffers[t.id] = o;
        }
      }
    }
    // TIERS / RD-P02: the other providers' lineups, lab state (RivalLab.lineup: their earlier public models and the
    // students their distill step made), each real model at its own fit and serving cost and the lab's markup (the
    // player's open release sells only its model); then the coverable range.
    for (let i = 0; i < n; i++) {
      const p = providers[i];
      if (!row[i] || !p.tiers?.length) continue;
      for (const x of p.tiers) {
        lines[i].push(offerOf(s, [{ v: x.model, fpt: x.fpt, w: 1 }], t.id, { markup: p.markup, rate, ud: p.ud, tools: p.tools, ...labToolOpts(s, p.tools, t.id, x.model) }));
        kind[i].push('student');
      }
    }
    // MK-6b: each tier's model (version id): the player's tiers the product's main model then its lineup entries, the
    // others' their model then their lineup; per provider its distinct models (lineup order) and each tier's index there.
    const tmod: number[][] = [];
    const mids: string[][] = [];
    for (let i = 0; i < n; i++) {
      const ids: string[] = [];
      const tm: number[] = [];
      const add = (id: string) => {
        let j = ids.indexOf(id);
        if (j < 0) j = ids.push(id) - 1;
        tm.push(j);
      };
      if (i === playerIdx) for (const x of pt) add(x.k === 0 ? cands[x.c].dep.versionId : (cands[x.c].tiers[x.k - 1][0].v as ModelVersion).id);
      else if (row[i]) {
        add(providers[i].model!.id);
        for (const x of providers[i].tiers ?? []) add(x.model.id);
      }
      tmod.push(tm);
      mids.push(ids);
    }
    tierMods.push(tmod);
    modIds.push(mids);
    let aTop = 0;
    for (const L of lines) for (const o of L) if (o.a > aTop) aTop = o.a;
    offers.push(row);
    pCand.push(bc);
    lineOff.push(lines);
    kinds.push(kind);
    pTiers.push(pt);
    aTops.push(aTop);
  }

  // MK-6: per sector the stance factor of each player tier's product (pTiers order).
  const pStance = pTiers.map((pt) => pt.map((x) => stanceFactor(cands[x.c].dep)));
  // RD-P03: seller groups per sector: the player's tiers grouped by product (cands index).
  const groups = pTiers.map((pt) => providers.map((_, i) => (i === playerIdx ? pt.map((x) => x.c) : undefined)));
  // MK-5 (M2): per sector and buyer group, which of the player's tiers the group reaches (its products' rungs ≤ the
  // group's; undefined: every tier) and a key of the rungs it reaches among those the player sells (equal keys: the
  // same choice).
  const gReach = pTiers.map((pt) => {
    const mask: (boolean[] | undefined)[][] = [];
    const key: number[] = [];
    for (let g = 0; g < BUYER_GROUP_IDS.length; g++) {
      if (BUYER_LADDER_TEST.allReach || playerIdx < 0) {
        mask.push(providers.map(() => undefined));
        key.push(-1);
        continue;
      }
      const ok = pt.map((x) => (BUYER_RUNG[cands[x.c].ch] ?? 0) <= g);
      let k = 0;
      for (let j = 0; j < pt.length; j++) if (ok[j]) k |= 1 << (BUYER_RUNG[cands[pt[j].c].ch] ?? 0);
      mask.push(providers.map((_, i) => (i === playerIdx ? ok : undefined)));
      key.push(k);
    }
    return { mask, key };
  });
  // A8 / REACH: each provider's reach target: each firm contracts with the MULTI_HOMING.providers labs it ranks best by
  // the V4 quality logit on the provider's mean sector fit (brand × exp(SHARE_SLOPE_G·(fit − best))) among the closed
  // labs it can buy from (access), without replacement: R* = P(the lab is among the firm's picks) (reachTargets).
  // MK-5c decision (design/MARKET.md Buyers, As built): fBar stays the lab's best offer overall (the player: per sector
  // its best product's main model), not per buyer group: a firm picks labs on their best offer, the ladder then decides
  // what each group buys; reach is one stock per lab × region for all groups (a per-group target needs per-group stocks).
  const fBar = filled(n, -Infinity);
  for (let i = 0; i < n; i++) {
    let f = 0;
    let k = 0;
    for (let si = 0; si < S; si++) {
      const o = offers[si][i];
      if (o) {
        f += o.fit;
        k++;
      }
    }
    if (k > 0 && sells[i]) fBar[i] = f / k;
  }
  const reach = {} as WorldMix['reach'];
  REGIONS.forEach((r, ri) => {
    let best = -Infinity;
    for (let i = 0; i < n; i++) if (acc[ri][i] > 0 && fBar[i] > best) best = fBar[i];
    const lw = providers.map((p, i) => (acc[ri][i] > 0 && !p.open && fBar[i] > -Infinity && p.brand > 0 ? Math.log(p.brand) + SHARE_SLOPE_G * (fBar[i] - best) : -Infinity));
    const closed = reachTargets(lw, acc[ri], MULTI_HOMING.providers);
    reach[r] = { stock: accSec[ri], target: closed.map((x, i) => (providers[i].open && sells[i] ? acc[ri][i] : x)) };
  });
  // Domain G vectors per sector (the player's is its best candidate's: the fallback where it has no buyers; MK-5b mixes
  // its tiers' below) and per sector the player's tiers' G (pTiers order).
  const gvecs: (number[] | undefined)[][] = [];
  for (let si = 0; si < S; si++) gvecs.push(providers.map((_, i) => (i === playerIdx ? cands[pCand[si]]?.g : pg[i])));
  const pTierG = pTiers.map((pt) => pt.map((x) => cands[x.c].tierG[x.k]));
  // RD-P04a: the PHYS gate on domain G (OOM): v2's robot-bound PHYS level (floor 10·W16 ramp, +3·W19 on LOG, cap
  // 15·robots) and σ((Le_PHYS − fMid − θ)/fSpread) restated through the one λ (thresholds exact; +3 L at its 10 L slope).
  // CAL2-X: all v2 PHYS levels (v2 V0 PHYS 1) → gOfV2Level / v2LevelGate (the RD-U05 PHYS shift and v2's −4 L profile);
  // a full robot cap (15) does not bind, as v2's clamp at 15.
  const pfFloorG = gOfV2Level(w, 'PHYS', pfFloor);
  const pfLogG = pfLog * oomPerLevel(w, 10 - (V2_DOMAIN_OFF.PHYS ?? 0));
  const reviewK = ASSIST.review;
  const invK = 1 / ECON.kSpread;
  const sec = {} as Record<RegionId, Record<SectorId, SectorMix>>;
  REGIONS.forEach((r, ri) => {
    const rowOut = {} as Record<SectorId, SectorMix>;
    for (let si = 0; si < S; si++) {
      const t = SECTOR_TASKS[si];
      const physCap = t.physW > 0 ? 15 * robotAvail(s, r, t.id) : 15;
      const value = valuePerHour(s, t.id, r);
      const wage = wagePerHour(t.id, r);
      const hf = savedPerAdoptedHour(s, r, t.id);
      const fit = filled(n, -Infinity);
      const cover = filled(n, 0);
      const prices = filled(n, 0);
      const agentK = filled(n, 0);
      const agentPrices = filled(n, 0);
      const agentBc = filled(n, 0);
      const seatPrices = filled(n, 0);
      const seatCost = filled(n, 0);
      const physG = filled(n, 0);
      const gs = gvecs[si];
      const physCapG = physCap >= 15 ? Infinity : gOfV2Level(w, 'PHYS', physCap);
      // A5: the buyers' surplus choice over bands of task difficulty (worldfx/choice.ts), on value-capped tier prices.
      const lines = lineOff[si];
      // MK-6 (M5, M6), MK-6b: each closed seller's margin M_k here per model k (the stock fx.priceM); its tiers sell at
      // their own cost + M of their model (the player's × its product's stance factor), capped at the value, floored at
      // cost; agent-hours at their cost × the tier's price-to-cost ratio p/c (MK-9: seats below). Open weights: cost × OPEN_MARKUP.
      // A model with no stock yet (newly added, or a new seller): the seller's stocked margin per $ of cost (Σ M ÷ Σ c
      // over its stocked models) × the model's own cost; none stocked: today's cost-plus price on its own cost
      // (SEED_MARKUP). Model cost: its first tier's here.
      const pmRow = s.world.fx.priceM?.[r]?.[t.id];
      const tmS = tierMods[si];
      const midS = modIds[si];
      const mCost = providers.map((_, i) => {
        const c = filled(midS[i].length, 0);
        const seen = filled(midS[i].length, 0);
        tmS[i].forEach((m, k) => {
          if (!seen[m]) (seen[m] = 1), (c[m] = lines[i][k].cost);
        });
        return c;
      });
      const Mi: number[][] = [];
      for (let i = 0; i < n; i++) {
        const p = providers[i];
        const ids = midS[i];
        const row = filled(ids.length, 0);
        Mi.push(row);
        if (p.open || !offers[si][i]) continue;
        const st0 = pmRow?.[p.key];
        let sm = 0;
        let sc = 0;
        for (let m = 0; m < ids.length; m++) {
          const x = st0?.[ids[m]];
          if (x !== undefined) (sm += x), (sc += mCost[i][m]);
        }
        const ratio = sc > 0 ? sm / sc : (p.lab === CHINA_ID ? SEED_MARKUP.china : SEED_MARKUP.closed) - 1;
        for (let m = 0; m < ids.length; m++) row[m] = st0?.[ids[m]] ?? ratio * mCost[i][m];
      }
      // MK-9 (M5): each closed seller's seat margin here (the stock fx.seatM; absent: the margin that prices its own
      // model's seat at SEATS.cap, what firms pay today). Seat serving cost per seat-month = seat hours × H100e-h × rate.
      const shm = seatHoursPerMonth(t.id);
      const smRow = s.world.fx.seatM?.[r]?.[t.id];
      const seatMi = providers.map((p, i) => {
        const L0 = lines[i][0];
        if (p.open || !offers[si][i] || !L0) return 0;
        return smRow?.[p.key] ?? Math.max(0, SEATS.cap - shm * L0.hphAs * rate);
      });
      // (P3: one loop without per-call closures builds the tiers and their prices for the readout.)
      const lineups: Tier[][] = [];
      const tierPrice: number[][] = [];
      const priced: Offer[][] = [];
      for (let i = 0; i < n; i++) {
        const L = lines[i];
        const nash = !providers[i].open;
        const tl: Tier[] = [];
        const tp: number[] = [];
        const po: Offer[] = [];
        for (let k = 0; k < L.length; k++) {
          const o = L[k];
          const want = nash ? o.cost + Mi[i][tmS[i][k]] * (i === playerIdx ? pStance[si][k] : 1) : o.price;
          const price = Math.max(o.cost, Math.min(want, value));
          const q = o.cost > 0 ? price / o.cost : 1;
          tl.push({ fit: o.fit, a: o.a, price, cost: o.cost });
          tp.push(price);
          // MK-9: a seat at its serving cost + the seller's seat margin (the player's × the product's stance), ≤ SEATS.cap.
          const sc = shm * o.hphAs * rate;
          const seat = nash ? Math.max(sc, Math.min(SEATS.cap, sc + seatMi[i] * (i === playerIdx ? pStance[si][k] : 1))) : o.seat;
          po.push(nash ? { ...o, price, priceAg: o.costAg * q, seat } : { ...o, price });
        }
        lineups.push(tl);
        tierPrice.push(tp);
        priced.push(po);
      }
      // MK-6c: μ_b = the cheapest adequate tier's cost ÷ ε over every tier here (choice.ts bandMu), the same for every
      // buyer group, in the sellers' markups and in the MK-7 re-run.
      const muIn = bandMu(lineups, brandPow, accSec[ri], aTops[si], B);
      // RD-P03 (DD-02): each player product is its own seller (its lineup's tiers a group), sharing the player's brand and
      // reach. MK-5 (M2): the sector's business buyers are three groups (small / large / vetted, market.ts buyerGroups),
      // each choosing among the offers it reaches (every other provider's; the player's products on its rungs of the
      // ladder); groups that reach the same products make one choice. The market's choice is the groups' weighted sum.
      const bg = buyerGroups(t.id, r);
      const gr = gReach[si];
      const parts: { w: number; ch: Choice; gs: BuyerGroupId[] }[] = [];
      for (let g = 0; g < 3; g++) {
        const wg = bg[BUYER_GROUP_IDS[g]];
        if (!(wg > 0)) continue;
        const same = BUYER_LADDER_TEST.split ? undefined : parts.find((p) => gr.key[BUYER_GROUP_IDS.indexOf(p.gs[0])] === gr.key[g]);
        if (same) {
          same.w += wg;
          same.gs.push(BUYER_GROUP_IDS[g]);
        } else parts.push({ w: wg, ch: surplusChoice(lineups, brandPow, accSec[ri], value, aTops[si], B, groups[si], gr.mask[g], muIn), gs: [BUYER_GROUP_IDS[g]] });
      }
      const ch = parts.length ? mergeChoices(parts) : surplusChoice(lineups, brandPow, accSec[ri], value, aTops[si], B, groups[si], undefined, muIn);
      const markupTarget = nashTargets(ch, parts.length ? parts : [{ w: 1, ch }], providers, offers[si], value, tmS, mCost);
      const target = ch.target;
      const tierW: number[][] = [];
      for (let i = 0; i < n; i++) {
        const o = offers[si][i];
        const L = lines[i];
        // The provider's customers' tier mix: its band shares (its own model alone when it has no share anywhere).
        const tw = tierMix(ch, i, L.length, B);
        tierW.push(tw);
        if (!o) continue;
        fit[i] = o.fit;
        cover[i] = o.a;
        let price = 0;
        let costAg = 0;
        let priceAg = 0;
        let seat = 0;
        const P = priced[i];
        let tws = 0;
        for (let k = 0; k < L.length; k++) if (tw[k] > 0) {
          price += tw[k] * lineups[i][k].price;
          costAg += tw[k] * P[k].costAg;
          priceAg += tw[k] * P[k].priceAg;
          seat += tw[k] * P[k].seat;
          seatCost[i] += tw[k] * shm * L[k].hphAs * rate;
          tws += tw[k];
        }
        if (!(tws > 0)) seatCost[i] = L[0] ? shm * L[0].hphAs * rate : 0;
        else if (Math.abs(tws - 1) > 1e-9) seatCost[i] /= tws;
        prices[i] = price;
        // MK-5c (M2): the player's agent-hours per supervising hour, their price and the buyer's cost per agent-hour are
        // the mix of the tiers its buyers buy (its tier mix tierW, as MK-5b's coverage): each tier at its own k, λ and
        // agent price (serving.ts agentMixOf; a tier without Agent mode or failing its gate sells none, MK-11). No target
        // share (and BUYER_LADDER_TEST.bestOnly): its best product's main model's k and λ at the tier-mixed agent price
        // (before MK-5c). Other providers: their own model's k, λ (rivals wait for their redesign).
        if (i === playerIdx && !BUYER_LADDER_TEST.bestOnly && target[i] > 1e-12) {
          const am = agentMixOf(P, tw, wage);
          agentK[i] = am.k;
          agentPrices[i] = am.price;
          agentBc[i] = am.bc;
        } else {
          const ag = agentDemandOf({ k: o.k, lam: o.lam, priceAg, costAg }, wage);
          agentK[i] = ag.k;
          agentPrices[i] = ag.price;
          agentBc[i] = ag.price + wage / Math.max(1e-9, o.lam);
        }
        seatPrices[i] = providers[i].open ? 0 : seat;
        const gv = gs[i];
        if (gv) physG[i] = Math.min(Math.max(gv[PHYS], pfFloorG) + (t.id === 'LOG' ? pfLogG : 0), physCapG);
      }
      // MK-5b (M2): the player's fit, coverage and domain G here (what F, the cost gate's review, g, the PHYS gate, control
      // and the readouts read) are the hours-weighted mix of the tiers its buyers buy: its tier mix tierW (the merged
      // choice: per group the player's hours split between the products the group reaches and their tiers, weighted by
      // the group's hours with the player), each tier at its own fit, coverage and G (the PHYS gate's robot floor and cap
      // per tier). Small buyers so count with the API product's coverage, not Enterprise's. No target share here: its best
      // product's main model (as before).
      let pGv: number[] | undefined;
      if (playerIdx >= 0 && offers[si][playerIdx] && !BUYER_LADDER_TEST.bestOnly && target[playerIdx] > 1e-12) {
        const tw = tierW[playerIdx];
        const L = lines[playerIdx];
        const tg = pTierG[si];
        const gv = filled(ND, 0);
        let f = 0;
        let a = 0;
        let ph = 0;
        let z = 0;
        for (let k = 0; k < L.length; k++) {
          const x = tw[k];
          if (!(x > 0)) continue;
          f += x * L[k].fit;
          a += x * L[k].a;
          const gk = tg[k];
          for (let d = 0; d < ND; d++) gv[d] += x * gk[d];
          ph += x * Math.min(Math.max(gk[PHYS], pfFloorG) + (t.id === 'LOG' ? pfLogG : 0), physCapG);
          z += x;
        }
        if (z > 0) {
          fit[playerIdx] = f / z;
          cover[playerIdx] = a / z;
          physG[playerIdx] = ph / z;
          for (let d = 0; d < ND; d++) gv[d] /= z;
          pGv = gv;
        }
      }
      // RD-P03: the player's products, each its own seller: a product's part of the player's hours here (playerProdW, sum
      // 1: the choice among its products, band by band) and its buyers' hours by tier of its lineup (playerTierW, sum 1).
      // MK-5: over the groups (the merged choice weights each group's split by its hours with the player); per group too.
      const split = playerIdx >= 0 ? prodSplit(tierW[playerIdx], pTiers[si], pCand[si], cands) : { tierW: {}, prodW: {} };
      const byGroup: SectorMix['byGroup'] = {};
      for (const p of parts) {
        const prodW = playerIdx >= 0 ? (parts.length === 1 ? split.prodW : prodSplit(tierMix(p.ch, playerIdx, lines[playerIdx].length, B), pTiers[si], pCand[si], cands).prodW) : {};
        for (const g of p.gs) byGroup[g] = { w: bg[g], target: p.ch.target, playerProdW: prodW, ch: p.ch, mask: gr.mask[BUYER_GROUP_IDS.indexOf(g)] };
      }
      const playerLines: Record<string, Offer[]> = {};
      if (playerIdx >= 0) {
        const pt = pTiers[si];
        for (let j = 0; j < pt.length; j++) (playerLines[cands[pt[j].c].dep.id] ??= []).push(priced[playerIdx][j]);
      }
      const tierWOut = split.tierW;
      const prodWOut = split.prodW;
      const share = stockShares(s, providers, r, t.id, target);
      const gw = filled(ND, 0);
      let gsum = 0;
      let px = 0;
      let pc = 0;
      let aCog = 0;
      let K = 0;
      let lePhys = 0;
      let wsum = 0;
      let sw = 0;
      let sp = 0;
      // A4: agent-hours per supervising hour the buyers want (Σ share·k), their spend and buyer's cost (price + the
      // supervision wage/λ), unnormalised as revenue.ts sectorSpendParts sums them.
      let kw = 0;
      let kp = 0;
      let kb = 0;
      for (let i = 0; i < n; i++) {
        const x = share[i];
        const oi = offers[si][i];
        if (!x || !oi) continue;
        const kk = x * agentK[i];
        if (kk > 0) {
          kw += kk;
          kp += kk * agentPrices[i];
          kb += kk * agentBc[i];
        }
        wsum += x;
        const gv = i === playerIdx && pGv ? pGv : gs[i];
        if (gv) {
          for (let k = 0; k < ND; k++) gw[k] += x * (k === PHYS ? physG[i] : gv[k]);
          gsum += x;
        }
        lePhys += x * physG[i];
        px += x * prices[i];
        if (seatPrices[i] > 0) {
          sw += x;
          sp += x * seatPrices[i];
        }
        // buyerCost and costGateOf (serving.ts) inlined: σ(ln(wage ÷ bc)/k) = 1 / (1 + (bc ÷ wage)^(1/k)).
        const bc = prices[i] / hf + reviewK * wage * (1 - Math.min(1, cover[i]));
        pc += x * bc;
        aCog += x * cover[i];
        K += x / (1 + Math.pow(Math.max(1e-9, bc) / wage, invK));
      }
      if (wsum > 0 && Math.abs(wsum - 1) > 1e-9) {
        px /= wsum;
        pc /= wsum;
        aCog /= wsum;
        K /= wsum;
        lePhys /= wsum;
      }
      if (gsum > 0) for (let k = 0; k < ND; k++) gw[k] /= gsum;
      const physF = t.physW > 0 ? v2LevelGate(w, 'PHYS', lePhys, ECON.fMid + t.theta, ECON.fSpread) : 0;
      const F = (1 - t.physW) * aCog + t.physW * physF;
      const pp = playerIdx >= 0 ? prices[playerIdx] : 0;
      const price = wsum > 0 ? px : 0;
      const pCost = wsum > 0 ? pc : wage;
      // A4: the demand ceiling on AI work; agent-hours beyond it are not bought (every provider's × fill).
      const st = s.world.sectors[r][t.id];
      const wh = workHoursOf(st, t.id);
      const agentCeiling = agentCeilingOf(SECTORS[si], st.E0 * ECON.hours, wage, wh.adopted, wh.adopted * price, pCost, wh.supervising * kw, wh.supervising * kp, kw > 0 ? kb / kw : wage);
      if (agentCeiling.fill < 1) for (let i = 0; i < n; i++) agentK[i] *= agentCeiling.fill;
      // MK-9 (M5): seat margin targets on the seat market (seatTargets): M*_i = μ_seat ÷ (1 − s_i) with μ_seat = p_i ÷ ε
      // (its own price; SEATS.elasticity), i.e. c_i ÷ (ε·(1 − s_i) − 1), ≤ SEATS.cap − c_i; s_i the seller's share of the
      // seats here (seats split by the customer stock; open weights' are in-house), c_i its customers' seat serving cost.
      const seatPrice = sw > 0 ? sp / sw : SEATS.cap;
      const seatMTarget = seatTargets(providers, offers[si], share, seatCost);
      rowOut[t.id] = {
        share, target, fit, cover, prices, agentK, agentPrices, seatPrices, seatPrice, seatM: seatMi, seatMTarget, seatCost, agentCeiling, g: domRecord(gw),
        price, pCost, F, K: wsum > 0 ? K : 0,
        ...(playerIdx >= 0 && pCand[si] >= 0 ? { playerDep: cands[pCand[si]].dep.id } : {}),
        playerPrice: pp, priceFactor: playerIdx >= 0 && pp > 0 && px > 0 ? Math.min(1, Math.pow(pp / px, -PRICE_ELASTICITY)) : 1,
        tiers: { choice: ch, offers: lines, kind: kinds[si], price: tierPrice, weight: tierW }, playerTierW: tierWOut, playerProdW: prodWOut, byGroup,
        markup: Mi, markupTarget, markupModels: midS, tierModel: tmS, playerLines,
        rerun: { lineups, brand: brandPow, acc: accSec[ri], value, aTop: aTops[si], B, groups: groups[si], muIn, tierDep: pTiers[si].map((x) => cands[x.c].dep.id) },
      };
    }
    sec[r] = rowOut;
  });

  // Consumer market (the consumer-chat work type; price per subscriber-month).
  const cFit = filled(n, -Infinity);
  // A7 / RD-P02: the consumer-chat fit of each provider's free tier (what most users get): its cheapest real model to
  // serve (lowest FLOP per token among its model and lineup; the player's: chatFreeTier).
  const cFree = filled(n, -Infinity);
  const cCover = filled(n, 0);
  const cPrice = filled(n, 0);
  // MK-9 (M3, M5): a paying user's serving cost a month, the plan margin (the stock fx.planM; absent: the margin that
  // prices at the willingness to pay, today's plans) and the stance factor of each closed Chat seller (the player's: its
  // best Chat product's). Open-weight hosts sell a flat plan at OPEN_PLAN_SHARE × wtp (≥ cost).
  const cCost = filled(n, 0);
  const cM = filled(n, 0);
  const cF = filled(n, 1);
  const pmS = s.world.fx.planM;
  const wtp = CONSUMER_MKT.wtpMonth;
  const cSocial = filled(n, gOfLevel(w, 0));
  const cApp = providers.map((p) => p.appeal);
  let cDep: string | undefined;
  for (let i = 0; i < n; i++) {
    const p = providers[i];
    const g = pg[i];
    if (g) cSocial[i] = g[I.SOCIAL];
    if (!p.model) continue;
    const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], 'CHAT', { markup: p.markup, rate, ud: p.ud, ...labToolOpts(s, p.tools, 'CHAT') });
    cFit[i] = o.fit;
    let free = { model: p.model as SimpleModel | ModelVersion, fpt: p.fpt ?? 2e12 };
    for (const x of p.tiers ?? []) if (x.fpt < free.fpt) free = x;
    cFree[i] = free.model === p.model ? o.fit : offerOf(s, [{ v: free.model, fpt: free.fpt, w: 1 }], 'CHAT', { markup: p.markup, rate, ud: p.ud, ...labToolOpts(s, p.tools, 'CHAT') }).fit;
    cCover[i] = o.a;
    const sc = subPrice(s, p.fpt ?? 2e12, 0, tokEff(p.model), p.ud).cost;
    cCost[i] = sc;
    if (p.open) cPrice[i] = Math.max(sc, OPEN_PLAN_SHARE * wtp);
    else {
      cM[i] = pmS?.[p.key] ?? Math.max(0, wtp - sc);
      cPrice[i] = consumerPlanPrice(sc, cM[i]);
    }
  }
  if (playerIdx >= 0) {
    let bu = -Infinity;
    for (const c of cands) {
      if (c.ch !== 'consumer') continue;
      const x = fxOn(c.fx, 'CHAT');
      const ud = decodeUtilNow(s);
      const o = offerOf(s, c.uses, 'CHAT', { dG: settingsDG(c.dep) + x.dG, hMult: x.hMult, markup: 1, rate, ud });
      const sc = subPrice(s, c.uses[0]?.fpt ?? 2e12, 0, tokEff(c.uses[0]?.v), ud).cost;
      const M = pmS?.player ?? Math.max(0, wtp - sc);
      const f = stanceFactor(c.dep);
      const price = consumerPlanPrice(sc, f * M);
      const free = chatFreeTier(s, c.dep)?.fit ?? o.fit;
      const u = SHARE_SLOPE_G * free - PRICE_ELASTICITY * Math.log(Math.max(1e-9, price));
      if (u > bu) {
        bu = u;
        cFit[playerIdx] = o.fit;
        cFree[playerIdx] = free;
        cCover[playerIdx] = o.a;
        cPrice[playerIdx] = price;
        cCost[playerIdx] = sc;
        cM[playerIdx] = M;
        cF[playerIdx] = f;
        cDep = c.dep.id;
        cApp[playerIdx] = appealOf(ver.get(c.dep.versionId)) * chatToolAppeal(c.tools);
        cSocial[playerIdx] = c.g[I.SOCIAL];
      }
    }
  }
  const consumer = {} as Record<RegionId, ConsumerMix>;
  const cOnes = filled(n, 1);
  REGIONS.forEach((r, ri) => {
    const cBrand = providers.map((p, i) => p.brand * cApp[i]);
    // A5: users choose an app by quality alone: most pay nothing (free users ≈ 95%), so the subscription price is not in
    // their choice (the old logit at equal prices); subscribers' price response is the paid-share stock. A7: the quality
    // they choose on is the free tier's, the offer they get (each lab's cheapest real model; RD-P02).
    const target = logit(cFree, cOnes, acc[ri], cBrand);
    const share = stockShares(s, providers, r, 'consumer', target);
    let bestCover = 0;
    for (let i = 0; i < n; i++) if (acc[ri][i] > 0 && cCover[i] > bestCover) bestCover = cCover[i];
    let soc = 0;
    let px = 0;
    for (let i = 0; i < n; i++) {
      soc += share[i] * cSocial[i];
      px += share[i] * cPrice[i];
    }
    const pp = playerIdx >= 0 ? cPrice[playerIdx] : 0;
    // A2b: paid share per provider — a stock (fx.paid) toward (p0 + p1·coverage)·(going price ÷ price)^ε, the going
    // price the users' share-weighted subscription price among plans at or below the willingness to pay; absent = its
    // target.
    let gw = 0;
    let gp = 0;
    for (let i = 0; i < n; i++) if (share[i] > 0 && cPrice[i] > 0 && cPrice[i] <= CONSUMER_MKT.wtpMonth * (1 + 1e-9)) {
      gw += share[i];
      gp += share[i] * cPrice[i];
    }
    const going = gw > 0 ? gp / gw : CONSUMER_MKT.wtpMonth;
    const paidTarget = cCover.map((a, i) => (cFit[i] === -Infinity ? 0 : paidShareTarget(a, cPrice[i], going)));
    const pst = s.world.fx.paid?.[r];
    const paid = providers.map((p, i) => pst?.[p.key] ?? paidTarget[i]);
    consumer[r] = {
      share, target, socialGs: cSocial, socialG: soc, fit: cFit, freeFit: cFree, cover: cCover, prices: cPrice, bestCover, paid, paidTarget, going,
      ...(cDep ? { playerDep: cDep } : {}), playerPrice: pp, priceFactor: pp > 0 && px > 0 ? Math.min(1, Math.pow(pp / px, -PRICE_ELASTICITY)) : 1,
    };
  });
  const plan = planTargets(s, providers, consumer, cFit, cCost, cM, cF, cPrice);
  return { providers, sec, consumer, plan, reach, bestPublic, bestPublicLg, playerOffers, offerBy, lineupBy };
}

/** MK-9 (design/MARKET.md M3, M5): the paid-plan market's Nash–Bertrand margins, one per closed Chat seller across
 *  regions. Subscribers respond to a plan's price relative to the going price, P* ∝ (p̄ ÷ p)^ε (CONSUMER_MKT.paid,
 *  ε = elasticity 1): read as a logit in log price with coefficient ε, a seller's own-price elasticity is ε·(1 − s),
 *  so its first-order condition is (p − c)/p = 1/(ε·(1 − s)), i.e. p = c + μ/(1 − s) with μ_plan = p ÷ ε, taken at the
 *  going price p̄ (as MK-6's μ_b = p̄_b ÷ ε). Target M* = min(μ_plan ÷ (1 − s_paid), wtp − c) ≥ 0, s_paid the seller's
 *  share of all paying subscribers (users × user-share stock × paid-share stock, over the regions); p̄ the users-weighted
 *  going plan price over the regions with every seller at its target (fixed point from today's). With ε = 1 the
 *  uncapped margin exceeds p̄ for any s, so Best-profit plans sit at the willingness to pay (real plans held at $20 as
 *  serving costs fell, R22 §2); Win share takes half the capped margin. */
function planTargets(s: GameStateV2, providers: readonly Provider[], consumer: Record<RegionId, ConsumerMix>, cFit: readonly number[], cost: readonly number[], margin: readonly number[], f: readonly number[], price0: readonly number[]): WorldMix['plan'] {
  const n = providers.length;
  const wtp = CONSUMER_MKT.wtpMonth;
  const eps = CONSUMER_MKT.paid.elasticity;
  const sell = providers.map((p, i) => !p.open && cFit[i] > -Infinity);
  const subs = filled(n, 0);
  const users = REGIONS.map((r) => CONSUMER_MKT.adults[r] * (s.world.fx.reach?.[r] ?? 0));
  REGIONS.forEach((r, ri) => {
    const cm = consumer[r];
    for (let i = 0; i < n; i++) subs[i] += users[ri] * cm.share[i] * cm.paid[i];
  });
  const tot = subs.reduce((a, x) => a + x, 0);
  const share = subs.map((x) => (tot > 0 ? x / tot : 0));
  const goingAt = (pr: readonly number[]) => {
    let uw = 0;
    let ug = 0;
    REGIONS.forEach((r, ri) => {
      if (!(users[ri] > 0)) return;
      const cm = consumer[r];
      let gw = 0;
      let gp = 0;
      for (let i = 0; i < n; i++) if (cm.share[i] > 0 && pr[i] > 0 && pr[i] <= wtp * (1 + 1e-9)) {
        gw += cm.share[i];
        gp += cm.share[i] * pr[i];
      }
      uw += users[ri];
      ug += users[ri] * (gw > 0 ? gp / gw : wtp);
    });
    return uw > 0 ? ug / uw : wtp;
  };
  const target = filled(n, NaN);
  const pr = [...price0];
  let going = goingAt(pr);
  let mu = going / eps;
  for (let it = 0; it < 30; it++) {
    mu = going / eps;
    for (let i = 0; i < n; i++) if (sell[i]) {
      target[i] = Math.max(0, Math.min(mu / Math.max(1e-6, 1 - share[i]), wtp - cost[i]));
      pr[i] = consumerPlanPrice(cost[i], f[i] * target[i]);
    }
    const g = goingAt(pr);
    const done = Math.abs(g - going) <= 1e-6 * going;
    going = g;
    if (done) break;
  }
  return { margin: [...margin], target, cost: [...cost], share, going, mu };
}

/** MK-7 (M7): customer-stock targets on served hours (revenue.ts), per region and sector and for consumers; absent: the
 *  choice's target. */
export interface ServedTargets { sec: Record<RegionId, Partial<Record<SectorId, number[]>>>; consumer: Partial<Record<RegionId, number[]>> }

/**
 * MK-7 (M7): the choice of buyer group `g` here re-run without some offers: the player's products in `dropDeps` (their
 * tiers left out of the group's reach) and the providers in `dropProv` (every tier left out: MK-8's capacity-bound
 * rivals). Same bands, μ, a_top and choice sets as the market's choice (a provider with no reachable tier stays in the
 * sets with e = 0), so shares compare band by band; Choice.tot is the share of the buyers left with any offer.
 */
export function rerunChoice(m: SectorMix, g: BuyerGroupId, playerIdx: number, dropDeps: ReadonlySet<string>, dropProv?: ReadonlySet<number>): Choice | undefined {
  const bg = m.byGroup[g];
  if (!bg) return undefined;
  const x = m.rerun;
  const reach = x.lineups.map((L, i) => {
    if (dropProv?.has(i)) return L.map(() => false);
    if (i !== playerIdx) return bg.mask[i];
    const base = bg.mask[i];
    return x.tierDep.map((id, k) => (base ? base[k] : true) && !dropDeps.has(id));
  });
  return surplusChoice(x.lineups, x.brand, x.acc, x.value, x.aTop, x.B, x.groups, reach, x.muIn);
}

/** Move every segment's customer stock toward its logit target (daily; V4.2). Segments with no stock start at the target
 *  (no jump on day 0); providers that left drop out; a new provider starts at 0 and grows. */
export function advanceCustomers(s: GameStateV2, mix: WorldMix, dt = 1 / 365, served?: ServedTargets) {
  const fx = s.world.fx;
  fx.cust ??= { US: {}, CN: {}, ROW: {} };
  const ps = mix.providers;
  const step = (r: RegionId, seg: string, target: number[], tau: number) => {
    const row = (fx.cust[r] ??= {});
    const old = row[seg];
    const k = Math.min(1, dt / tau);
    const out: Record<string, number> = {};
    const keys: string[] = [];
    let sum = 0;
    for (let i = 0; i < ps.length; i++) {
      const key = ps[i].key;
      const x = old ? (old[key] ?? 0) + (target[i] - (old[key] ?? 0)) * k : target[i];
      if (x > 1e-6) {
        if (!(key in out)) keys.push(key);
        out[key] = x;
        sum += x;
      }
    }
    for (const key of keys) out[key] = Math.round((out[key] / (sum || 1)) * 1e6) / 1e6;
    row[seg] = out;
  };
  // A2b: paid shares (not normalised: each provider's own share of its users who subscribe). A new provider starts at
  // its target (its users arrive through the user-share stock).
  fx.paid ??= { US: {}, CN: {}, ROW: {} };
  // A8: each provider's reach among sector buyers moves toward its target (MULTI_HOMING.tau); providers that left drop
  // out; a provider with no stock starts at the start value computeMix used.
  fx.secReach ??= { US: {}, CN: {}, ROW: {} };
  const kReach = Math.min(1, dt / MULTI_HOMING.tau);
  for (const r of REGIONS) {
    const R = mix.reach[r];
    const out: Record<string, number> = {};
    ps.forEach((p, i) => {
      // REACH: open weights' reach is their access (every cloud hosts them), not firms' contracts with the lab: not
      // kept, so a lab whose next public model is closed starts at the even spread, not at its open-weights access.
      if (p.open) return;
      const x = R.stock[i] + (R.target[i] - R.stock[i]) * kReach;
      if (x > 1e-6) out[p.key] = Math.round(x * 1e7) / 1e7;
    });
    fx.secReach[r] = out;
  }
  stepPrices(s, mix, Math.min(1, dt / PRICE_TAU));
  const kPaid = Math.min(1, dt / CONSUMER_MKT.paid.tau);
  for (const r of REGIONS) {
    // MK-7: toward the targets on served hours where the revenue system rationed (revenue.ts servedTargets).
    for (const t of SECTOR_TASKS) step(r, t.id, served?.sec[r]?.[t.id] ?? mix.sec[r][t.id].target, t.gov ? CUSTOMER_TAU.gov : CUSTOMER_TAU.sector);
    step(r, 'consumer', served?.consumer[r] ?? mix.consumer[r].target, CUSTOMER_TAU.consumer);
    const cm = mix.consumer[r];
    const old = fx.paid[r] ?? {};
    const out: Record<string, number> = {};
    mix.providers.forEach((p, i) => {
      if (cm.fit[i] === -Infinity) return;
      const x = old[p.key];
      out[p.key] = Math.round((x === undefined ? cm.paidTarget[i] : x + (cm.paidTarget[i] - x) * kPaid) * 1e7) / 1e7;
    });
    fx.paid[r] = out;
  }
}

const sig6 = (x: number) => Number(x.toPrecision(6));
/** MK-6 (M5), MK-6b: each closed seller's margin M per region, sector and model moves the fraction k toward its
 *  Nash–Bertrand target (fx.priceM; sellers and models that left drop out). MK-9: the plan margins (fx.planM) and
 *  seat margins (fx.seatM) the same way. */
function stepPrices(s: GameStateV2, mix: WorldMix, k: number) {
  const fx = s.world.fx;
  fx.priceM ??= { US: {}, CN: {}, ROW: {} };
  fx.seatM ??= { US: {}, CN: {}, ROW: {} };
  // MK-9: plan margins (one per closed Chat seller) and seat margins (per region, sector and closed seller).
  const plan: Record<string, number> = {};
  mix.providers.forEach((p, i) => {
    const x = mix.plan.target[i];
    if (Number.isFinite(x)) plan[p.key] = sig6(mix.plan.margin[i] + (x - mix.plan.margin[i]) * k);
  });
  fx.planM = plan;
  for (const r of REGIONS) {
    const pm = (fx.priceM[r] ??= {});
    const sm = (fx.seatM[r] ??= {});
    for (const t of SECTOR_TASKS) {
      const m = mix.sec[r][t.id];
      const out: Record<string, Record<string, number>> = {};
      mix.providers.forEach((p, i) => {
        const tg = m.markupTarget[i];
        const ids = m.markupModels[i];
        let row: Record<string, number> | undefined;
        for (let j = 0; j < ids.length; j++) {
          const x = tg[j];
          if (Number.isFinite(x)) (row ??= {})[ids[j]] = sig6(m.markup[i][j] + (x - m.markup[i][j]) * k);
        }
        if (row) out[p.key] = row;
      });
      pm[t.id] = out;
      const so: Record<string, number> = {};
      mix.providers.forEach((p, i) => {
        const x = m.seatMTarget[i];
        if (Number.isFinite(x)) so[p.key] = sig6(m.seatM[i] + (x - m.seatM[i]) * k);
      });
      sm[t.id] = so;
    }
  }
}
/** MK-6: a new game's prices at the market's fixed point: margins stepped toward their targets (the shares they give
 *  move the targets; MK-6c: μ is cost-based, so 8 rounds at 0.6 settle it to ≈ 0.1–0.2%). Before initCustomerStocks, so
 *  the start's customers face these prices. */
export function initPrices(s: GameStateV2, iters = 8, k = 0.6) {
  for (let it = 0; it < iters; it++) stepPrices(s, computeMix(s), k);
}

/** The start state's customer stocks (core/init): every segment at its day-0 target (A8: the multi-homing choice gives
 *  the measured spread, so A7's start cap is gone; the consumer start is the reach, A6b P5). */
export function initCustomerStocks(s: GameStateV2) {
  const mix = computeMix(s);
  const fx = s.world.fx;
  fx.cust = { US: {}, CN: {}, ROW: {} };
  const put = (r: RegionId, seg: string, sh: number[]) => {
    const row: Record<string, number> = {};
    mix.providers.forEach((p, i) => {
      if (sh[i] > 1e-6) row[p.key] = Math.round(sh[i] * 1e6) / 1e6;
    });
    fx.cust[r][seg] = row;
  };
  for (const r of REGIONS) {
    for (const t of SECTOR_TASKS) put(r, t.id, mix.sec[r][t.id].target);
    put(r, 'consumer', mix.consumer[r].target);
  }
}

/** A5 readout: what buyers pay for work at the edge of what a model of coverage `u0` (e.g. V0's) can do in a sector and
 *  region — the band of tasks containing u0 (`below`: the band under it, the hardest it does whole) — at the customer
 *  stocks (each provider's stock × its band mix there) and the tiers they take on it (MK-5b: per buyer group). */
export interface BandPaid {
  band: number;
  /** Price per adopted task-hour ($) and the market-weighted H100e-hours per hour of the tiers bought there. */
  price: number;
  hph: number;
  /** Share of the band's hours on providers' own models, on the player's product minis, on other providers' students. */
  byKind: Record<TierKind, number>;
  /** Share of the band's hours by provider key. */
  byProvider: Record<string, number>;
  /** The price the same customers would pay if every provider sold them its own model (no cheap tiers). */
  ownModelPrice: number;
}
export function bandPaid(mix: WorldMix, r: RegionId, sid: SectorId, u0: number, below = false, whole = false): BandPaid {
  const m = mix.sec[r][sid];
  const { choice, offers, kind, price } = m.tiers;
  const B = choice.share[0]?.length ?? MARKET_BANDS;
  const band = Math.max(0, Math.min(B - 1, Math.floor((u0 * B) / Math.max(1e-12, choice.aTop) - (below ? 1 - 1e-9 : 0))));
  // A8 `whole`: only the buyers whose tier does the band whole (with multi-homing, buyers who cannot reach such a tier
  // buy one that does part of it: that is not the price of the capability).
  const hi = (choice.aTop * (band + 1)) / B;
  // MK-5b: per buyer group (its choice and weight, SectorMix.byGroup; none: the market's choice) each provider's stock
  // × the group's part of its band-b hours, on the tiers the group takes there (a seller-group split, the player's
  // products: its sub; else its pick), not the merged pick (the group with the most hours).
  const segs: { w: number; ch: Choice }[] = [];
  for (const g of BUYER_GROUP_IDS) {
    const x = m.byGroup[g];
    if (x && x.w > 0) segs.push({ w: x.w, ch: x.ch });
  }
  if (!segs.length) segs.push({ w: 1, ch: choice });
  const parts: { i: number; k: number; x: number }[] = [];
  let sum = 0;
  m.share.forEach((x, i) => {
    if (!(choice.target[i] > 1e-12) || !(x > 0)) return;
    for (const { w, ch } of segs) {
      const q = (x * w * (ch.share[i]?.[band] ?? 0)) / choice.target[i];
      if (!(q > 0)) continue;
      const sb = ch.sub[i]?.[band];
      const add = (k: number, y: number) => {
        if (k < 0 || !(y > 0) || (whole && offers[i][k].a < hi * (1 - 1e-9))) return;
        parts.push({ i, k, x: y });
        sum += y;
      };
      if (sb?.length) for (let k = 0; k < sb.length; k++) add(k, q * sb[k]);
      else add(ch.pick[i][band], q);
    }
  });
  const out: BandPaid = { band, price: 0, hph: 0, byKind: { model: 0, mini: 0, student: 0 }, byProvider: {}, ownModelPrice: 0 };
  for (const { i, k, x } of parts) {
    const w = x / (sum || 1);
    out.price += w * price[i][k];
    out.hph += w * offers[i][k].hph;
    out.byKind[kind[i][k]] += w;
    out.byProvider[mix.providers[i].key] = (out.byProvider[mix.providers[i].key] ?? 0) + w;
    out.ownModelPrice += w * price[i][0];
  }
  return out;
}
