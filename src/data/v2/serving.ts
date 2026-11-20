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
 *  hour, 90% cache reads (bandwidth, not FLOP), 40k output — the internal SWE figure (workTypes TOKENS_PER_WORK_HOUR,
 *  kept here as the reference agentic profile).
 *  A2c: the human-attended assisted hour (a person working with an assistant) is ≈ 10 reasoning turns of R20 D2's
 *  3k/0.8k (prompt and context, answer) = 30k/8k, the paying consumer's daily budget in one hour of work [D; R22 §3:
 *  chat is 3.75 messages per weekly-user-day, ≈ 8–20k tokens; Claude Enterprise non-coding users spend < $75 a month
 *  incl. a $20 seat, R22 §4]. It replaces V4a's 100k/15k (knowledge) and 200k/40k (agentic) assisted profiles, which
 *  were 3–7× heavier than the measured chat use: the heavy token users (developers, agents) are now the agent-work term
 *  (agent-hours on the autonomous profile, AGENT_WORK), not every assisted hour. */
export const TOKENS = {
  agentic: { input: 2e5, output: 4e4 },
  assisted: { input: 3e4, output: 8e3 },
  /** Autonomous work (the substituted share α of adopted work, and agent-hours): a day-long agent task ≈ 30M input, 90%
   *  cache reads, and 0.5M output per 8 human-hours [R20 D2] → 375k uncached input and 62k output per work-hour. */
  autonomous: { input: 3.75e5, output: 6.2e4 },
} as const;
export type TokenProfile = { input: number; output: number };

/** A sector as a work type (V4.1): research/16's task weights (data/v2/sectors.ts; PHYS stays robot-bound) plus a
 *  typical task length H (hours of a human's work), verifiability v (R20 E3 classes: code with tests 0.9, ML experiments
 *  0.7, design 0.5, physical/perception 0.4, taste/strategy 0.3, persuasion/management 0.2) and the token profile of an
 *  hour of assisted work (a person working with the AI) [D]. An adopted task-hour (A) mixes it with autonomous work by
 *  the sector's substitution share α (research/16 step 6): tokens = α·autonomous + (1 − α)·assisted, so token use (and
 *  the revenue per hour) rises as agents take whole tasks. A2c: every sector's assisted hour is TOKENS.assisted; the
 *  heavy agentic use of Software and Science comes through the agent-work term (their coverage is highest). */
export interface SectorWork { H: number; v: number; horizon: DomainId; tokens: TokenProfile }
export const SECTOR_WORK: Record<SectorId, SectorWork> = {
  SOFT: { H: 2, v: 0.8, horizon: 'CODE', tokens: TOKENS.assisted },
  OFFICE: { H: 0.5, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.assisted },
  FIN: { H: 2, v: 0.6, horizon: 'AGENCY', tokens: TOKENS.assisted },
  LEGAL: { H: 4, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.assisted },
  MEDIA: { H: 2, v: 0.3, horizon: 'AGENCY', tokens: TOKENS.assisted },
  SCI: { H: 8, v: 0.6, horizon: 'AGENCY', tokens: TOKENS.assisted },
  HEALTH: { H: 1, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.assisted },
  EDU: { H: 1, v: 0.3, horizon: 'AGENCY', tokens: TOKENS.assisted },
  GOV: { H: 2, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.assisted },
  MIL: { H: 4, v: 0.4, horizon: 'AGENCY', tokens: TOKENS.assisted },
  MFG: { H: 1, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.assisted },
  LOG: { H: 1, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.assisted },
  ENGY: { H: 2, v: 0.5, horizon: 'AGENCY', tokens: TOKENS.assisted },
  SERV: { H: 0.25, v: 0.3, horizon: 'AGENCY', tokens: TOKENS.assisted },
};

/** Who pays for work use (A2c; research/22 §4–6 [R22]). Hours of use U·E0·2000 (A2a) split into
 *    adopted A-hours     tasks firms handed to AI (A): billed per hour at the provider's cost-plus price (API, agents,
 *                        enterprise usage) — consumption
 *    seated hours        assisted hours h·(W − A) of the workers with a paid seat (a share σ of the workers who use AI,
 *                        a stock per sector and region): billed by the seat, a flat price per seat-month
 *    unseated hours      the rest of the assisted hours: free tiers, bundled assistants, in-house models. Not billed by
 *                        anyone in the sector market; they run on the users' consumer apps (the work share of consumer
 *                        chat, A2b), so they add no sector serving need either
 *  plus agent-hours (AGENT_WORK) supervised from the billed human-attended hours, billed per hour.
 *  Seats: σ moves toward σ* = K_seat·(1 − R), K_seat = σ(ln(value ÷ seat price)/kSpread) the cost gate of research/16
 *  on a seat (value = a seat-holder's assisted hours a month × wage × g_aug), by imitation dσ/dt = q·σ·(σ* − σ)/σ* ×
 *  DiffMult (no innovation term: procurement spreads firm to firm) [D]. q = 1.5/yr [R22 4e: M365 Copilot seats 15M →
 *  30M Jan → Jul 2026, ×2 per half-year = 1.39/yr at σ ≪ σ*; the sectors' own Bass q (0.8–2, employment-weighted ≈ 1)
 *  gave ×1.3 per half-year]; growth slows as σ nears σ* ("will decline", R22 §4). Start σ0 per
 *  region [D from R22 4e–4g]: ≈ 30M+ paid seats outside China in Jan–Feb 2026 (M365 Copilot 15M, ChatGPT workplace
 *  > 7M, Gemini Enterprise > 8M, Claude undisclosed), back-cast at the simulated ×1.6–1.9 per half-year to ≈ 18M in
 *  Jul 2025 on ≈ 300M workers using AI (US 61M, ROW 238M): US 0.12 (≈ 7M), ROW 0.045 (≈ 11M); CN 0.02 (no data; served
 *  at home, mostly by open weights: in-house, unbilled).
 *  List price $25 per seat-month [R22 §4: Claude Enterprise $20 + usage, Team $25, ChatGPT Business $25–30, M365 Copilot
 *  $30], × the provider's markup relative to the standard tier (budget ×0.67, premium ×1.6; DeepCent ×0.67), never below
 *  the seat's serving cost. Open-weights providers sell no seats (their users are in-house: unbilled). */
export const SEATS = {
  start: { US: 0.12, CN: 0.02, ROW: 0.045 } as Record<RegionId, number>,
  price: 25,
  q: 1.5,
  /** Decay toward a lower ceiling (per year), as A and W. */
  down: 0.5,
};

/** Agent work (A2c; research/22 §3, §5–7): agent-hours not tied to one human hour. A human-attended billed hour of use
 *  (the (1 − α) augmented part of the A-hours and the seated hours) directs k agent work-hours (human-equivalent hours of
 *  the sector's work, on the autonomous token profile), billed per hour at cost-plus:
 *    k = a · λ · gate      a the model's coverage of the sector's work (the share an agent can take alone, V3's
 *                           work-type function: fit and p(H | h50))
 *    λ = 1 / (c/h80 + ρ·(1 − a) + m)   agent-hours one supervising hour sustains: a check-in c per autonomous stretch of
 *                           h80 (the 80% horizon, h50/5), review ρ of the work it cannot do alone (GDPval 0.27, as the
 *                           sector cost gate), and a floor m of direction per agent-hour
 *    gate = σ(ln(wage ÷ (price + wage/λ))/kSpread)  bought only where an agent-hour plus its supervision costs less than
 *                           the human hour (the research/16 cost gate)
 *  so agent-hours, tokens and API spend grow with the horizon and coverage faster than human hours (research/22 §7:
 *  human hours ×1.1–1.3 a year, tokens ×4–5, spend per hour ×5–10). Constants [D]: c = 15 min (write and hand off a task;
 *  no primary source), m = 0.02 h (λ ≤ 50). Agent-hours are sold through the API, the Agents product (weight × the share
 *  of half-day tasks, AGENT_TASK_HOURS, its model completes: the Agents horizon gate on the METR curve) and Enterprise
 *  usage beyond the seat. An agent-hour is worth at most the wage (value cap). */
export const AGENT_WORK = {
  checkInH: 0.25,
  floorH: 0.02,
  /** Channel weights of the player's agent-hours (the agents weight × p(AGENT_TASK_HOURS | h50)) [D]. */
  channel: { api: 1, agents: 1.5, enterprise: 0.5 } as Partial<Record<'api' | 'agents' | 'enterprise' | 'trusted' | 'gov', number>>,
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
/** A5: bands of equal adopted task-hours a sector's buyers choose in (worldfx/choice.ts): the quadrature of the
 *  task-difficulty range. The cheapest adequate offer wins each band, so the hours a cheap model takes are its coverage
 *  ÷ the best coverage to within half a band [D: 8 bands; the share moves by ≤ 1/16 when one more band opens]. */
export const MARKET_BANDS = 8;

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
 *  Price (A6b): a flat monthly plan at the market's price, not cost-plus (consumerPlanPrice): the willingness to pay
 *  (wtp, the going list price of 2025 plans), never below a paying user's serving cost; margin = price − serving cost.
 *  Most consumer use is not work (non-work share 0.7), so its value is what people pay for it, not wage × hours
 *  saved, and real plans held at $20 while their serving cost fell far below it. Free users (users − subscribers) pay nothing, run on the product's mini (else its model) and are served last;
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
   *  toward the target, p 1, q 2 (V4a's reach dynamics), and 0.2/yr down [D].
   *  ROW starts at `startRow` × the US start (A6b, P5): the leader's weekly users on the start day are ChatGPT's ≈ 700M
   *  (Jul 2025, NBER w34255 [P, R22 2c]). `row` was derived at a 0.55–0.6 leader share; since A5 users choose by quality
   *  alone and the start leader holds ≈ 0.76 of users, so the start market is 700M ÷ 0.76 ≈ 0.92B weekly users outside
   *  China (ROW reach 0.25), not 1.37B [fit: the leader's day-1 users]. The target keeps `row`, so ROW grows toward it at
   *  the reach speed (the leader ≈ 0.9B in Feb 2026, R22 2c). */
  reach: { startUS: 0.46, startRow: 0.548, max: 0.9, base: 0.5, row: 0.85, p: 1, q: 2, down: 0.2 },
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
   *  22]: the price of a Standard (and Premium) consumer plan, the most any plan sells at (consumerPlanPrice). */
  wtpMonth: 22,
  /** FLOP-bearing tokens per user-day [R20 D2, R22 §3]: a paying user ≈ 10 reasoning turns (30k uncached input, 8k
   *  output); a free weekly user 3.75 messages a day [R22 2g: 2,627M messages ÷ 700M WAU] × ≈ 2k of prompt and context and
   *  0.4k of answer ≈ 9k tokens (R22: ≈ 8–20k per WAU-day; was 1.6k). */
  perDay: { paid: { input: 3e4, output: 8e3 }, free: { input: 7.5e3, output: 1.5e3 } },
  messagesPerDay: 3.75,
};

/** A consumer plan's price per month (A6b, design/notes/A6.md P4): consumer chat is sold as flat-price subscriptions
 *  at the market's price, not at a markup over serving cost (ChatGPT Plus, Claude Pro, Gemini Advanced all held at
 *  $20 while serving got far cheaper; R22 §2). Standard and Premium sell at the willingness to pay (no plan sells above
 *  it); a tier below Standard sells below it by its markup's ratio to Standard's (Budget ×0.67 ≈ $14.7) [D]. The engine
 *  never sells below a paying user's serving cost (worldfx/serving.ts subPrice). */
export const consumerPlanPrice = (markup: number) => CONSUMER_MKT.wtpMonth * Math.min(1, markup / MARKUP.standard);

/** Hours a served H100e runs per year (24/7). */
export const SERVE_HOURS_PER_YEAR = 8766;
