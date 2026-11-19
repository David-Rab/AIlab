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

/** Consumer market (V4.2): weekly users = online adults × reach × share; paying subscribers PAY_SHARE of them pay a
 *  monthly price = markup × their usage's serving cost (bounded by the value cap); the free users are served by the
 *  product's mini (else its model) and pay nothing [D: ChatGPT ≈ 800M weekly users, ≈ 5% paying (OpenAI 2025); CN is
 *  served at home]. Usage per user-day from R20 D2 (chat turn 3k/0.8k, reasoning ×5 output): a paying user ≈ 10
 *  reasoning turns a day, a free weekly user ≈ one short turn every other day [D]. */
export const CONSUMER_MKT = {
  adults: { US: 2.6e8, CN: 0, ROW: 2.5e9 } as Record<RegionId, number>,
  payShare: 0.05,
  perDay: { paid: { input: 3e4, output: 8e3 }, free: { input: 1.3e3, output: 3e2 } },
  /** Ceiling on a subscription ($ per month): what a heavy user's time saved is worth [D]. */
  valueCapMonth: 200,
};

/** Hours a served H100e runs per year (24/7). */
export const SERVE_HOURS_PER_YEAR = 8766;
