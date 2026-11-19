// Serving, products and sectors on work types (model v3 V4: design/MODEL-V3.md §6, §7; design/V3-BUILD.md "V4" and
// "V4 notes"). Owner: WS5. Engine: src/engine/v2/worldfx/serving.ts (cost, price, capacity, coverage of sector work).
// Tags: [R20 xx] research/20, [R16] research/16, [D] design value, [fit] fitted by the calibration harness.
//
// One cost chain for every model in the market (the player's products, rivals, China, internal agents):
//   cost per work-hour = H100e-hours per work-hour × $ per H100e-hour
//   H100e-hours per work-hour = FLOP per token (2·N_active) × (uncached input ÷ U_prefill + output ÷ U_decode) ÷ peak ÷ 3600
// with tokens per work-hour by work type (× effort, × scaffolds), utilisation and peak from data/v2/workTypes.ts.
import type { DomainId, PriceTier, RegionId, SectorId } from '../../engine/v2/types';

/** FLOP-bearing tokens per human work-hour of AI work (uncached input, output) [R20 D2]: agentic coding ≈ 2M input per
 *  hour, 90% cache reads (bandwidth, not FLOP), 40k output — the internal SWE figure (workTypes TOKENS_PER_WORK_HOUR);
 *  knowledge work (enterprise chat, documents, analysis) ≈ 20k/3k per task of 10–15 minutes, ×5 per hour, rounded up for
 *  tool calls [D]. */
export const TOKENS = {
  agentic: { input: 2e5, output: 4e4 },
  knowledge: { input: 1e5, output: 1.5e4 },
  /** Autonomous work (the substituted share α of adopted work): a day-long agent task ≈ 30M input, 90% cache reads, and
   *  0.5M output per 8 human-hours [R20 D2] → 375k uncached input and 62k output per work-hour. */
  autonomous: { input: 3.75e5, output: 6.2e4 },
} as const;
export type TokenProfile = { input: number; output: number };

/** A sector as a work type (V4.1): research/16's task weights (data/v2/sectors.ts; PHYS stays robot-bound) plus a
 *  typical task length H (hours of a human's work), verifiability v (R20 E3 classes: code with tests 0.9, ML experiments
 *  0.7, design 0.5, physical/perception 0.4, taste/strategy 0.3, persuasion/management 0.2) and the token profile of an
 *  hour of assisted work (a person working with the AI) [D]. An hour of AI use mixes it with autonomous work by the
 *  sector's substitution share α (research/16 step 6): tokens = α·autonomous + (1 − α)·assisted, so token use (and the
 *  revenue per hour of use) rises as agents take whole tasks. */
export interface SectorWork { H: number; v: number; horizon: DomainId; tokens: TokenProfile }
export const SECTOR_WORK: Record<SectorId, SectorWork> = {
  SOFT: { H: 2, v: 0.8, horizon: 'CODE', tokens: TOKENS.agentic },
  OFFICE: { H: 0.5, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  FIN: { H: 2, v: 0.6, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  LEGAL: { H: 4, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  MEDIA: { H: 2, v: 0.3, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  SCI: { H: 8, v: 0.6, horizon: 'AGENCY', tokens: TOKENS.agentic },
  HEALTH: { H: 1, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  EDU: { H: 1, v: 0.3, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  GOV: { H: 2, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  MIL: { H: 4, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  MFG: { H: 1, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  LOG: { H: 1, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  ENGY: { H: 2, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.knowledge },
  SERV: { H: 0.25, v: 0.3, horizon: 'AGENCY', tokens: TOKENS.knowledge },
};

/** Consumer chat as a work type (MODEL-V3 §6.1): SOCIAL, REASON, MEDIA; minutes-long tasks [D]. */
export const CHAT_WORK = { w: { SOCIAL: 0.4, REASON: 0.4, MEDIA: 0.2 } as Partial<Record<DomainId, number>>, H: 0.05, v: 0.5, horizon: 'AGENCY' as DomainId, theta: 0 };

/** Sector work's human reference (the sector's median professional, where coverage's logistic is ½) on the G axis,
 *  per world: G_V0 + (mid + perTheta·θ_s)·(G_SC − G_V0), θ_s research/16's difficulty offset in levels (5 levels from V0 to
 *  the superhuman coder). v2 put the same point at level 7.35 + θ (ECON.fMid, fitted to research/16's F_SOFT anchors:
 *  Agent-1 ≈ 0.25, Agent-3-mini ≈ 0.8), i.e. mid ≈ 0.47 of the V0 → SC span [fit]. Sector work is the typical worker's
 *  job, not the best human's in the world (the internal work types' reference), so it automates before SC. */
export const SECTOR_REF = { mid: 0.47, perTheta: 0.2 };

/** Price policy (V4.2): markup over the product's own cost per work-hour [D, R20 D3: API gross margin ≈ 0.6 (range
 *  0.4–0.85; DeepSeek's theoretical 84.5%)]: budget margin 0.4, standard 0.6, premium 0.75. Never above the task's value. */
export const MARKUP: Record<PriceTier, number> = { budget: 1 / 0.6, standard: 1 / 0.4, premium: 1 / 0.25 };
/** Rivals price at their own cost × this markup [D: the standard margin]; DeepCent (China) at the budget margin
 *  (DeepSeek-style pricing below Western labs, R20 D3) [D]. */
export const RIVAL_MARKUP = MARKUP.standard;
export const CHINA_MARKUP = MARKUP.budget;

/** Effort (V4.3, R20 C3 test-time scaling): reasoning (output) tokens × the setting; each ×10 adds 0.4 OOM of
 *  compute-equivalent fit (0.3–0.5), capped at ±1.5 OOM. low ×0.3 → −0.21 OOM, max (the default) ×1, deep ×4 → +0.24. */
export const EFFORT_TOKENS = { low: 0.3, max: 1, deep: 4 } as const;
export const EFFORT_OOM_PER_10X = 0.4;
export const EFFORT_CAP_OOM = 1.5;

/** Safeguards and the AI-control layer cost fit (v2's level offsets at 1.2 L per OOM) [D]: hardened −0.2 L, classifiers
 *  −0.05 L, control layer −0.1 L. */
export const SAFEGUARD_DG: Record<'minimal' | 'standard' | 'classifiers' | 'hardened', number> = { minimal: 0, standard: 0, classifiers: -0.05 / 1.2, hardened: -0.2 / 1.2 };
export const CONTROL_LAYER_DG = -0.1 / 1.2;

/** Market share logit per segment (V4.2): weight ∝ exp(SHARE_SLOPE_G·(fit − best fit)) · price^−PRICE_ELASTICITY ·
 *  access · brand. v2's 2.1 per level at ≈ 2 levels per OOM before SC [D]. Price elasticity 1 (v2: 1.5 on a price index
 *  spanning ×0.7–1.4): prices now span the providers' costs (×2–5), and frontier models keep large shares at 5–15× the
 *  price of small ones (R20 D3 list prices) [D]. */
export const SHARE_SLOPE_G = 4;
export const PRICE_ELASTICITY = 1;

/** Customers are a stock (V4.2): each segment's provider shares move toward the logit target with this time constant
 *  (years) [D]: consumers switch in weeks, API and enterprise customers over a quarter (developer months, contracts
 *  quarters), government and defence over contract cycles. */
export const CUSTOMER_TAU = { consumer: 3 / 52, sector: 0.25, gov: 0.75 } as const;

/** Consumer market (A2b; research/22 §2–3 [R22]). Two stocks per region and one logit:
 *    reach R_r      share of online adults who use an AI chat app weekly (any provider), a Bass stock toward
 *                   R*_r = row_r · max · (base + (1 − base) · c), c the best accessible model's coverage of consumer chat
 *    user share     each provider's share of those users (the V4a customer stock and logit, CUSTOMER_TAU.consumer)
 *    paid share P   each provider's share of its users who subscribe, a stock toward
 *                   P* = min(max, (p0 + p1 · a) · (p̄ ÷ price)^ε), a its model's coverage of consumer chat, p̄ the going
 *                   price (users' share-weighted subscription price in the region)
 *  subscribers = adults × R × user share × P; consumer revenue = subscribers × price × 12 (independent of work hours).
 *  Price = markup × a paying user's serving cost per month, never below cost and never above the willingness to pay
 *  (wtp): most consumer use is not work (non-work share 0.7), so its value is what people pay for it, not wage × hours
 *  saved. Free users (users − subscribers) pay nothing, run on the product's mini (else its model) and are served last;
 *  they are the pool subscribers convert from, so serving them is what buys subscribers (unserved need erodes the
 *  user share through the capacity penalty). CN is served at home (no adults here). */
export const CONSUMER_MKT = {
  /** Online adults [D]: US ≈ 262M adults (UN WPP 2024); rest of world excl. China ≈ 4.5B adults × ≈ 0.72 online (ITU
   *  2025: ≈ 74% of the world online, China and the US above it) ≈ 3.2B. Recalled, not fetched this session. */
  adults: { US: 2.6e8, CN: 0, ROW: 3.2e9 } as Record<RegionId, number>,
  /** Non-work share of consumer chat use [R22 2a–2b: ChatGPT 73% of messages (Jun 2025), Claude.ai 54%; range
   *  0.55–0.75]: why the consumer price is capped by willingness to pay, not by the wage of the time saved. */
  nonWorkShare: 0.7,
  /** Reach. US start 0.46 [D from R22 §2: RPS non-work genAI use ≈ 50% of US adults in Nov 2025, +10.4 pp yoy, so ≈ 46%
   *  in Jul 2025]. Target ceiling `max` 0.9 of online adults (an internet-like saturation) [D]; `base` 0.5 puts the
   *  start model's target (consumer-chat coverage 0.14) at ≈ 0.51, the Nov 2025 level [D]. ROW at `row` × the US
   *  [D: the leader's ≈ 900M weekly users in Feb 2026 (R22 2c, ≈ 15% of world adults) at a ≈ 0.55–0.6 share of distinct
   *  users need ≈ 1.5–1.6B weekly users outside China, i.e. ROW reach ≈ 0.43 at a US 0.5]. Speed (p + q·R) per year
   *  toward the target, p 1, q 2 (V4a's reach dynamics), and 0.2/yr down [D]. */
  reach: { startUS: 0.46, max: 0.9, base: 0.5, row: 0.85, p: 1, q: 2, down: 0.2 },
  /** Paid share. p0 + p1·a = 5.4% for the start's frontier model (coverage 0.14) at the going price [R22 2e: ChatGPT ≈
   *  5.6% of weekly users pay (50M / 900M, Feb 2026); 5–6% while list plans stayed at $20], rising to 14% at full
   *  coverage [D: more of what people want done is worth paying for]; capped at 0.5 [D]. Price relative to the going
   *  price with elasticity ε = 1 [D]: a plan cheaper than the market's converts more of its users, a dearer one fewer;
   *  relative, not absolute, because cost-plus prices fall with serving cost while the measured paid share held at 5–6%
   *  with plans at $20 (an absolute response would let the market's falling costs alone multiply subscribers). The
   *  stock moves toward its target with τ ≈ 8 weeks [D: monthly billing; conversion and churn over a couple of billing
   *  cycles]. */
  paid: { p0: 0.04, p1: 0.1, max: 0.5, elasticity: 1, tau: 8 / 52 },
  /** Willingness to pay ($ per subscriber-month) [R22 §2 ARPU [X]: $8–20 plans plus a few $100–200 plans ≈ $20–25; mid
   *  22]: the consumer price cap (budget / standard / premium stay markups over cost below it). */
  wtpMonth: 22,
  /** FLOP-bearing tokens per user-day [R20 D2, R22 §3]: a paying user ≈ 10 reasoning turns (30k uncached input, 8k
   *  output); a free weekly user 3.75 messages a day [R22 2g: 2,627M messages ÷ 700M WAU] × ≈ 2k of prompt and context and
   *  0.4k of answer ≈ 9k tokens (R22: ≈ 8–20k per WAU-day; was 1.6k). */
  perDay: { paid: { input: 3e4, output: 8e3 }, free: { input: 7.5e3, output: 1.5e3 } },
  messagesPerDay: 3.75,
};

/** Hours a served H100e runs per year (24/7). */
export const SERVE_HOURS_PER_YEAR = 8766;
