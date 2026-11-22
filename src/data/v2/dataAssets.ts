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

/** Licensing deals by domain (action data.license, model v3 D2). A deal buys `tokensT` of one domain at a price tier;
 *  quality per tier spans research/20 A3's curated/licensed q 1.5–3 (DCLM/FineWeb-Edu-style selection ≈ ×3, Gundlach's
 *  table [P]). Prices per T tokens [D, order of magnitude from deal anchors, not fetched]:
 *    bulk     q 1.5, $0.1B/T — forum, news and code archives (the reported Reddit–Google deal, ≈ $60M a year for a
 *             corpus of order 1T tokens [UNVERIFIED, press])
 *    curated  q 2,   $2B/T   — edited reference, journals, documentation [D: the geometric middle of the other two]
 *    premium  q 3,   $30B/T  — books and textbooks: Bartz v. Anthropic settled at ≈ $3,000 per book (research/08 P23 [V],
 *             research/17 D3) at ≈ 100k tokens a book = $30B/T; reported per-title licences ($5,000) are the same order
 *  Default sizes give deals of $0.5–1.5B (5T / 0.5T / 0.05T). The data is delivered LICENCE_DELIVERY_DAYS after the
 *  deal (negotiation, transfer, cleaning) [D]; the cash is paid at signing. */
export type LicenceTier = 'bulk' | 'curated' | 'premium';
export const LICENCE_TIERS: Record<LicenceTier, { quality: number; priceBPerT: number; defaultT: number; label: string }> = {
  bulk: { quality: 1.5, priceBPerT: 0.1, defaultT: 5, label: 'Bulk archives' },
  curated: { quality: 2, priceBPerT: 2, defaultT: 0.5, label: 'Curated' },
  premium: { quality: 3, priceBPerT: 30, defaultT: 0.05, label: 'Books & textbooks' },
};
export const LICENCE_DELIVERY_DAYS = 60;
/** Size limits of one deal (T tokens) [D]. */
export const LICENCE_SIZE_T = { min: 0.01, max: 20 } as const;
/** Licensing the crawl (data.license, domain 'web': v2's blanket "License data"): $1B + $0.005B per unlicensed T (270T →
 *  $2.35B, v2's numbers [D]); it adds no tokens (the crawl is already held) and ends the copyright-suit hazard on it
 *  (actors/china.ts). The creatives bloc approves (+10, v2). */
export const WEB_LICENCE = { baseB: 1, perTB: 0.005, creatives: 10 } as const;

/** Synthetic data (compute + a teacher). Generation FLOP = FLOP per token of the teacher × SYN_OVERGEN per kept token
 *  (research/20 A3 [G]: ≈ 2·N_gen per token, filtering at 2–5× overgeneration), at the training pool's FLOP per H100e-day.
 *  SYN_OVERGEN 4.33 [fit]: reproduces v1's 4e-6 T per H100e-day for a 1T-active teacher (v1's V0), inside research/20's
 *  2–5×; since A6b V0 is 354B active and yields ×2.8 that (generation cost follows the teacher's FLOP per token).
 *  Quality from the teacher's G: q = SYN_Q.atV0 + SYN_Q.perOom · (G_teacher − G_V0), clamped to [min, max] — 0.5 at V0
 *  keeps v1's SYN_QUALITY; the slope [D]. Cap 1 [D, model v3 D11]: research/20 A3's synthetic range 0.5–1.5 is a
 *  guess [G] with no primary source for synthetic tokens beating human web text (no general exchange rate exists), and
 *  since D11 quality acts in the loss law, a cap above the web would let a lab's own synthetic data lift every later
 *  base unsourced; so synthetic data reaches the web's quality (2 OOM above V0) and no further unless the lab adopts
 *  the synthetic data flywheel (P10, model v3 D9, data/v2/tree.ts: the sourced case of rephrasing and filtering with a
 *  strong teacher raises the ceiling by P10_SYN_Q_RAISE; D1 had 1.5 for every lab, reached 4 OOM above V0). Mix [D]: math and code (Villalobos: synthetic
 *  data "only reliably improved capabilities in narrow areas like math and coding"). Synthetic data inherits its
 *  teacher's traits (subliminal learning, research/20 F3): the asset keeps the teacher and the flag. */
export const SYN_OVERGEN = 4.33;
export const SYN_Q = { atV0: 0.5, perOom: 0.25, min: 0.1, max: 1 } as const;
export const SYN_START_T = 20;
export const SYN_MIX: DomainMix = { CODE: 0.35, REASON: 0.35, RSCH: 0.12, AGENCY: 0.08, CYBER: 0.04, BIO: 0.03, SOCIAL: 0.02, MEDIA: 0.01 };
/** P10 (synthetic data flywheel, model v3 D9): raise of the synthetic-quality ceiling per unit of the project's effect
 *  (1 → 1.5 as designed; the hidden per-world draw has a relative sd of 0.3). Sources: Maini et al. 2024, "Rephrasing
 *  the Web" (arXiv 2401.16380 [P], fetched for D9): rephrasing noisy web text (C4) with an off-the-shelf instruction-tuned
 *  model and pre-training on real + synthetic rephrases "speeds up pre-training by ~3x"; phi-4 (arXiv 2412.08905 [P],
 *  fetched): a mostly synthetic curriculum "substantially surpasses its teacher model on STEM-focused QA"; research/20
 *  A3's synthetic tier tops out at q 1.5 "with the high end only in math/code" [G], which is SYN_MIX's domain. Size [D]:
 *  WRAP's ×3 is against raw C4; the game's web (q 1) is already the filtered 2025 crawl (data selection is itself ≈ ×3,
 *  Gundlach's table), so only part of it is headroom over q 1: research/20's 1.5. Accumulating with real data, not
 *  replacing it (Gerstgrasser et al. 2024 [R]), is how the draw already uses synthetic assets. */
export const P10_SYN_Q_RAISE = 0.5;
/** P21 (brain-like sample efficiency, model v3 D9): OOM more effective tokens per drawn token in the loss law per unit
 *  of the project's effect (×2 as designed; hidden per-world relative sd 0.6, a wide prior). Physically: the learner
 *  extracts more from each token (a child hears ≈ 10⁸ words by age 13, the BabyLM challenge's budget [R], where 2025
 *  frontier models train on ≈ 10¹³–10¹⁴ tokens;
 *  AI 2027: Agent-3 "~4,000x less compute-efficient than the human brain", closing later [P via research/12 #21]). Size
 *  [D, speculative]: a first step that closes ×2 of that gap; no source gives a number. */
export const P21_WORTH_OOM = 0.3;

/** Usage data (from products). Volume = the output tokens a live product serves (served H100e through the assisted
 *  token profile, research/22 §3's volumes as the serving model produces them) × the channel's eligibility × the lab's
 *  data-policy share. Eligibility [D]: consumer chats only — the providers' default terms train on consumer chats
 *  unless the user opts out and do not train on API, enterprise or government data (not fetched; D2/D4 make it a
 *  policy). Policy share 0.2 [D]: the consenting, retained and deduplicated part of eligible output tokens. Quality 0.5
 *  [D]: conversation logs, half model-written, short user turns (like V0's synthetic data). Mix by channel: consumer =
 *  the chat work type's domain weights (data/v2/serving.ts CHAT_WORK); only consumer chats are eligible, so only consumer has a mix. */
export const USAGE_POLICY_SHARE = 0.2;
/** Usage-data policy (action data.usagePolicy, model v3 D2): the share of eligible output tokens kept as training data
 *  per level [D]: none 0 (no training on users' chats), standard 0.2 (USAGE_POLICY_SHARE: opt-out training with the
 *  usual retention), broad 0.5 (opt-out by default, long retention, little filtering). The privacy side is the closest
 *  existing relation effect, the Civil Liberties bloc's approval (data/v2/blocs.ts; research/08 §1.11 "privacy laws,
 *  against chat scanning"): approval per level, applied as the difference on a change [D, small: B2's limits / unrestricted
 *  defense terms move it ±6–8]. */
export type UsageLevel = 'none' | 'standard' | 'broad';
export const USAGE_LEVELS: Record<UsageLevel, { share: number; civlib: number; label: string }> = {
  none: { share: 0, civlib: 4, label: 'No training on users' },
  standard: { share: USAGE_POLICY_SHARE, civlib: 0, label: 'Standard (opt-out)' },
  broad: { share: 0.5, civlib: -6, label: 'Broad' },
};
export const USAGE_QUALITY = 0.5;
export const USAGE_ELIGIBLE: Partial<Record<Channel, number>> = { consumer: 1 };
export const USAGE_MIX: Partial<Record<Channel, DomainMix>> = {
  consumer: CHAT_WORK.w,
};

/** Expert human data (cash, only for RL environments: each suite's `expert:<family>` asset, bought by its builds,
 *  DD-07). Not pretraining data: it does not enter U. q 3 [D: research/20 A3's top curated tier]. */
export const EXPERT_QUALITY = 3;

/** Synthetic generation job (action data.synthesize, model v3 D2): a share of the synthetic pool generates with a chosen
 *  teacher for some days; the rest keeps the default teacher (the internal research model). Defaults [D]: the whole
 *  pool for 90 days. */
export const SYN_JOB = { share: 1, days: 90, maxDays: 730 } as const;

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
