// Data portfolio data (model v3 D1: design/MODEL-V3.md §9, research/20 §A3, research/13 §2.6, research/22 §3). Owner: WS1.
// Engine: src/engine/v2/production/data.ts. Five kinds of asset, each with tokens, a domain mix over the nine domains
// and a quality factor q (1 = the public web). A base's unique-token stock U is the quality-weighted sum of the
// pretraining assets, U = Σ q·T (research/20 A3's game-ready D_eff = Σ q_tier·U_tier·(1 + 15.4·(1 − e^(−(ep−1)/15.4)))).
import type { Channel, DomainId } from '../../engine/v2/types';
import { CHAT_WORK } from './serving';

export type DomainMix = Partial<Record<DomainId, number>>;

/** The public web: shared by every lab and finite. Epoch's stock of public human text ≈ 300T tokens (90% CI 100T–1000T;
 *  Villalobos et al. 2024, research/13 §2.6, research/20 A3). Labs do not own it: each lab's portfolio holds its crawl
 *  (`coverage`, ≤ 1) of this one stock. Constant over the game [D] (no stock growth, no AI-text pollution yet), and
 *  repetition across labs is not modelled beyond each base's own epochs. Mix [D]: a Common-Crawl-like web (mostly
 *  general and social text, some code and science). */
export const PUBLIC_WEB = {
  stockT: 300,
  quality: 1,
  mix: { SOCIAL: 0.45, MEDIA: 0.12, REASON: 0.08, CODE: 0.08, RSCH: 0.07, BIO: 0.06, AGENCY: 0.06, CYBER: 0.03, PHYS: 0.05 } as DomainMix,
} as const;

/** Start crawl of the public web [D]: 0.9 × 300T = 270T, v2's unlicensed stock (V3-BUILD V1 notes: U = licensed 30T +
 *  unlicensed 270T + 0.5 × synthetic 20T = 310T). Every start type has the same data (as before D1). */
export const PUBLIC_START_COVERAGE = 0.9;

/** Licensed corpora (cash deals by domain, D2). The start's 30T are archives that overlap the web's quality (news,
 *  forums, code), q = 1 [D: keeps U = 310T at the start]; research/20 A3 gives curated/licensed tiers q 1.5–3 for D2's
 *  domain deals. Mix [D]: books, news and academic text. */
export const LICENSED_START_T = 30;
export const LICENSED_QUALITY = 1;
export const LICENSED_MIX: DomainMix = { SOCIAL: 0.35, MEDIA: 0.12, RSCH: 0.15, REASON: 0.1, CODE: 0.15, BIO: 0.06, CYBER: 0.03, AGENCY: 0.02, PHYS: 0.02 };
/** The "License data" deal (action D3, one corpus): adds a licensed corpus of ½ the lab's human tokens (public crawl +
 *  licensed) and licenses the crawl (no copyright suits): v2's "× (1 + 0.5 · licence deals)" as an asset [D, v2]. */
export const LICENCE_DEAL_SHARE = 0.5;

/** Synthetic data (compute + a teacher). Generation FLOP = FLOP per token of the teacher × SYN_OVERGEN per kept token
 *  (research/20 A3 [G]: ≈ 2·N_gen per token, filtering at 2–5× overgeneration), at the training pool's FLOP per H100e-day.
 *  SYN_OVERGEN 4.33 [fit]: reproduces v1's 4e-6 T per H100e-day for V0 (2 × 1T active), inside research/20's 2–5×.
 *  Quality from the teacher's G: q = SYN_Q.atV0 + SYN_Q.perOom · (G_teacher − G_V0), clamped to [min, max] — 0.5 at V0
 *  keeps v1's SYN_QUALITY; 0.5–1.5 is research/20 A3's synthetic range [G] (the high end in math and code); the slope
 *  [D] reaches the cap 4 OOM above V0 (≈ the superhuman AI researcher). Mix [D]: math and code (Villalobos: synthetic
 *  data "only reliably improved capabilities in narrow areas like math and coding"). Synthetic data inherits its
 *  teacher's traits (subliminal learning, research/20 F3): the asset keeps the teacher and the flag. */
export const SYN_OVERGEN = 4.33;
export const SYN_Q = { atV0: 0.5, perOom: 0.25, min: 0.1, max: 1.5 } as const;
export const SYN_START_T = 20;
export const SYN_MIX: DomainMix = { CODE: 0.35, REASON: 0.35, RSCH: 0.12, AGENCY: 0.08, CYBER: 0.04, BIO: 0.03, SOCIAL: 0.02, MEDIA: 0.01 };
/** P10 (synthetic data flywheel): synthetic tokens count ×3 (v1, LATER(V5) → D9). */
export const P10_SYN_MULT = 3;

/** Usage data (from products). Volume = the output tokens a live product serves (served H100e through the assisted
 *  token profile, research/22 §3's volumes as the serving model produces them) × the channel's eligibility × the lab's
 *  data-policy share. Eligibility [D]: consumer chats only — the providers' default terms train on consumer chats
 *  unless the user opts out and do not train on API, enterprise or government data (not fetched; D2/D4 make it a
 *  policy). Policy share 0.2 [D]: the consenting, retained and deduplicated part of eligible output tokens. Quality 0.5
 *  [D]: conversation logs, half model-written, short user turns (like V0's synthetic data). Mix by channel: consumer =
 *  the chat work type's domain weights (data/v2/serving.ts CHAT_WORK); other channels [D]. */
export const USAGE_POLICY_SHARE = 0.2;
export const USAGE_QUALITY = 0.5;
export const USAGE_ELIGIBLE: Partial<Record<Channel, number>> = { consumer: 1 };
export const USAGE_MIX: Partial<Record<Channel, DomainMix>> = {
  consumer: CHAT_WORK.w,
  api: { CODE: 0.45, REASON: 0.2, AGENCY: 0.15, SOCIAL: 0.1, RSCH: 0.1 },
  agents: { AGENCY: 0.4, CODE: 0.35, REASON: 0.15, RSCH: 0.1 },
  enterprise: { SOCIAL: 0.35, REASON: 0.25, CODE: 0.2, MEDIA: 0.1, RSCH: 0.1 },
  gov: { SOCIAL: 0.4, REASON: 0.3, CYBER: 0.2, RSCH: 0.1 },
};

/** Expert human data (cash, for RL environments and evals; D5's suites read it). Not pretraining data: it does not
 *  enter U. q 3 [D: research/20 A3's top curated tier]. Starts empty (D5 sources the start suites). */
export const EXPERT_QUALITY = 3;

// ───────────────────────────── the draw (model v3 D3) ─────────────────────────────

/** Domain specialisation from the drawn mix (MODEL-V3 §2.3): s_d,data = ALPHA_DATA · log₁₀(share_d ÷ reference share_d)
 *  OOM, capped at ±SPEC_CAP. research/20 A2 [G, from Ruan et al. 2024 and Muennighoff et al. 2023 [P]]: a code share of
 *  0 → 50% moves the code axis by up to +0.5 ECI units, ≈ 1.3 OOM at Epoch's 0.387 ECI per OOM; linear in the share,
 *  the part from the reference code share (9.6%, the start portfolio's) to 50% is 1.05 OOM over 0.72 decades = 1.46 per
 *  decade (1.8 if all of it came above the reference). ALPHA_DATA = 1.5, the low end: Llama 3 found mix tricks matter
 *  less at frontier scale [R]. SPEC_CAP = 1.3 OOM = research/20's +0.5 ECI at a 50% share, used both ways (a domain
 *  starved of data loses at most as much as a 50% share gains). */
export const ALPHA_DATA = 1.5;
export const SPEC_CAP = 1.3;
