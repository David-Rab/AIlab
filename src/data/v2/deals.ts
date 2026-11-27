// Strategic partners, debt instruments, data-centre sites and market constants (FINANCE-V3 §3–§6; DATACENTERS.md for
// sites and power; V2-SPEC §3.8 and research/15 §1.2, §1.7 for the market and debt; research/21 §1 B). Owner: WS3.
// Tags: [R15] = research/15, [R21] = research/21 (primary sources there), [AI27] = research/02, [D] = design value.
import type { NpcKindId } from './npcLabs';
import type { Debt, PartnerKind, PartnerSupply } from '../../engine/v2/types';

export type { PartnerKind, PartnerSupply };

/** Strategic partner kinds (FIN4a, spec §6.1): what each gives, what it wants and its strings. */
export const PARTNER_KINDS: Record<PartnerKind, { label: string; gives: string; wants: string }> = {
  hyperscaler: { label: 'Hyperscaler', gives: 'non-voting equity in tranches + cloud or custom chips at a discount, served first', wants: 'a take-or-pay compute commitment' },
  chipVendor: { label: 'Chip vendor', gives: 'equity per GW you deploy + rationing priority', wants: 'you buy its chips (take-or-pay)' },
  sovereign: { label: 'Sovereign', gives: 'a passive equity cheque', wants: 'nothing; Washington notices' },
};

export interface Partner { id: string; kind: PartnerKind; competitors: string[]; supply: PartnerSupply[]; /** Its in-house lab is the big-tech NPC lab (IP access). */ inHouse?: true }

/** A hyperscaler's affiliated lab (FIN4b, spec §6.1 IP access): its in-house lab, the NPC lab of the big-tech kind. Only
 *  a partner marked `inHouse` has one (Azimuth, the Google-like cloud); the others, chip vendors and sovereigns offer no
 *  IP access (one simple rule, NPC principle 7; the cast has one big-tech lab). */
export const AFFILIATE_KIND = 'bigtech' as const satisfies NpcKindId;

/** Fictional partners (real analogues in comments). Each anchors at most one lab at a time (§6.1, kept). */
export const PARTNER_DEFS: Partner[] = [
  { id: 'Northwind Cloud', kind: 'hyperscaler', competitors: ['Azimuth'], supply: ['cloud'] }, // Microsoft-like
  { id: 'Azimuth', kind: 'hyperscaler', competitors: ['Northwind Cloud'], supply: ['cloud', 'asic'], inHouse: true }, // Amazon/Google-like (Trainium/TPU)
  { id: 'Silica Systems', kind: 'chipVendor', competitors: ['Corvid Micro'], supply: ['chips'] }, // Nvidia-like
  { id: 'Corvid Micro', kind: 'chipVendor', competitors: ['Silica Systems'], supply: ['chips'] }, // AMD-like (warrants by GW)
  { id: 'Gulf Sovereign Fund', kind: 'sovereign', competitors: [], supply: [] }, // MGX/QIA-like
];
/** Default provider on the Rent compute card: a neocloud (CoreWeave-like). Neoclouds are providers, not deals (FIN1,
 *  spec §5). */
export const NEOCLOUD = 'Vantage Neocloud';
/** Lessor that funds financing leases of sites and chips (Blue Owl-like; Meta–Blue Owl Hyperion [R15]). */
export const LESSOR = 'Keystone Capital';
export const PARTNERS = PARTNER_DEFS.map((p) => p.id);
export const partnerDef = (id: string) => PARTNER_DEFS.find((p) => p.id === id);

/** Partner deal sizing (FIN4a). Every price follows the expected market path (FIN1, spec §5) less the firm discount and
 *  the partner's own discount for the commitment, both shown on the offer. */
export const PARTNER_TERMS = {
  // Equity E = $5–15B per tranche at today's V, 3 tranches (one now, two on GW conditions) [R15 §1.7]; non-voting and
  // capped at 15% of the company per hyperscaler, tranches included (CMA/FTC: Google ≤ 14% of Anthropic, R15 12–15%)
  // [R21 B2]. Commitment: cloud capacity worth 4 × E over 6 years at today's price (C = 4–12 × E over 5–10 y [R15]),
  // paid on the expected path; the partner takes 10% off for the commitment [D]. Revenue share 8% while it runs
  // (all three cloud partnerships carry one [R21 B4]; size [D]). Exclusivity and IP access are optional (FIN4b, below).
  hyperscaler: { equityShareOfV: 0.03, trancheMin: 5, trancheMax: 15, tranches: 3, stakeCap: 0.15, commitMult: 4, years: 6, discount: 0.1, revenueShare: 0.08 },
  // Custom chips (TPU, Trainium): 1 GW over 8 quarters at 45% of the H100e list path (perf/$ 2–5× an H100: TPU v6e 5.9,
  // Trainium2 4.4, Epoch Q4 2025 [R15]); a separate supply pool (served outside rationing); migration −15% research for
  // ~2.5 quarters [R15 Design].
  asic: { costMult: 0.45, quarters: 8, gw: 1.0, migrationDays: 230, researchMult: 0.85 },
  // Chip vendor: $10B of equity per GW you deploy (Nvidia–OpenAI; AMD warrants vest by GW) [R15 §1.7]; you buy 2 GW of
  // its chips over 8 quarters at the path less the firm discount and 5% vendor discount [D]; tranches by GW online
  // within 12 quarters.
  chipVendor: { perGW: 10, gw: 2, quarters: 8, discount: 0.05, deadlineQ: 12 },
  // Sovereign: a passive cheque of 2.5% of V ($5–25B) (MGX, QIA, GIC in Stargate / OpenAI / Anthropic G / xAI E) [R15];
  // its political cost (security demand +3) went with the government actor (W1d; W5 redoes it). No in-country site (sovereign money was passive; builds were separate deals) [R21 §3].
  sovereign: { equityShareOfV: 0.025, min: 5, max: 25 },
  // Rescue (distress only, spec §6.2): cash ≈ 2 quarters of burn, at least $20B, at most 15% of V; the partner is
  // topped up to 30%, with a board seat of two votes and exclusivity [D]; FIN4b: and IP access when the partner has an
  // affiliated lab, for 6 years like a hyperscaler deal [D].
  rescue: { stake: 0.3, minCash: 20, maxShareOfV: 0.15, seats: 2, years: 6 },
  // FIN4b (spec §6.1): at most 3 partners at once (a deal signed in the game counts from signing; stakes from before the
  // start do not) [D]. Optional strings for more money [D]: exclusivity (no deals with the partner's competitors) +25%
  // of the equity (hyperscaler) or of the money per GW (chip vendor); IP access (hyperscalers with an affiliated lab)
  // +20% of the equity: the affiliated lab licenses your models and closes ~10% a year of your capability lead while
  // the deal runs (the FTC quotes Microsoft's OpenAI rights as a bridge until its own model is competitive) [R21 B4].
  // Both bumps sit under the 15% stake cap.
  strings: { maxPartners: 3, exclusiveBump: 0.25, ipBump: 0.2, ipCloseYr: 0.1 },
} as const;

/** Debt instruments (R15 §1.7; FIN1 spec §3). `spreadBp` is the default; credit lines, chip loans and bonds are priced
 *  by rating (tables below). */
export const DEBT_TERMS: Record<Debt['kind'], { spreadBp: number; years: number; note: string }> = {
  revolver: { spreadBp: 200, years: 5, note: '3% of valuation, cap $15B; cash ≥ ⅓ of the line at quarter ends' }, // SOFR+150–250 [R15 Design]
  gpuTerm: { spreadBp: 475, years: 4, note: '≤ 60% of chip value; collateral < 1.2× loan → cash sweep' }, // CoreWeave DDTL SOFR+400–550 [R15]
  bond: { spreadBp: 150, years: 10, note: 'Only with positive trailing operating cash flow; ≤ 3× it; y10 + spread(rating)' }, // Oracle 4.45–6.85% [R15]
  // FIN3c (spec §9): a bought lab's debt; its lenders re-price it to your credit (y10 + the bond spread of your rating)
  // and it runs 3 more years [D].
  assumed: { spreadBp: 450, years: 3, note: 'Came with a lab you bought; priced at your rating' },
};
export type RatingId = 'BBB' | 'BB' | 'B' | 'closed';
/** Bond spread over y10 by rating (bp) [R15]; BB/B are SOFR-based in R15, mapped onto y10 here [D]. */
export const RATING_SPREAD_BP: Record<RatingId, number> = { BBB: 125, BB: 450, B: 750, closed: 1200 };
/** Credit-line spread over SOFR by rating (bp): SOFR + 150–250 [R15 Design], wider when closed [D]. */
export const REVOLVER_SPREAD_BP: Record<RatingId, number> = { BBB: 150, BB: 200, B: 250, closed: 350 };
/** Chip-backed loan spread over SOFR by rating (bp): CoreWeave DDTL SOFR + 400, then + 550 [R15]; mapped by rating [D]. */
export const CHIP_LOAN_SPREAD_BP: Record<RatingId, number> = { BBB: 400, BB: 475, B: 550, closed: 550 };
/** Debt sizing (FIN1, spec §3). Credit line ≈ 2–4% of valuation, cap $15B [fit: OpenAI $4B at $157B, Anthropic $15B
 *  at ~$380B+]; covenant: cash ≥ ⅓ of the line at quarter ends while drawn (Anthropic $5B on $15B [R15]). Chip loan
 *  ≤ 60% of chip collateral (installed and stocked chips at 70% of today's list price for used hardware [D]); cash
 *  sweep below 1.2× [R15]. Bonds ≤ 3× trailing operating cash flow, only while it is positive [D]. */
export const DEBT_SIZING = { lineShareOfV: 0.03, lineCap: 15, lineLiquidity: 1 / 3, chipLTV: 0.6, chipHaircut: 0.7, chipSweep: 1.2, bondOcfMult: 3 } as const;
/** Financing leases of capex (FIN1, spec §4): a lessor funds the capex and you pay funded × CRF(r, n) a year. r by
 *  rating (BBB 7% · BB 9% · B 12% [D]; none below B), n = 15 y sites, 5 y chips [D]. A site lease funds 80% of capex
 *  (Meta–Blue Owl Hyperion 80/20 [R15]); a chip lease funds the balance due on delivery. Residual-value guarantee:
 *  50% of the unamortised balance if you walk away [D], a contingent liability. FIN4b: below B a lessor still funds you
 *  when a running hyperscaler or chip-vendor partner guarantees the lease, at the B rate + 3 points [D]. */
export const CAPEX_LEASE = { rate: { BBB: 0.07, BB: 0.09, B: 0.12 } as Partial<Record<RatingId, number>>, years: { site: 15, chips: 5 }, siteShare: 0.8, rvgShare: 0.5, guaranteePremium: 0.03 } as const;
/** Firm contracts (FIN1, spec §5): priced on the expected market path × (1 − discount): 5% for ≥ 2 years, 10% for
 *  ≥ 4 years [D]. Cancellable cloud = spot-indexed × 1.15 with 1 quarter's notice (kept). */
export const FIRM_TERMS = { discount2y: 0.05, discount4y: 0.1, cancellableMult: 1.15, noticeQ: 1 } as const;
/** Firm discount for a contract of `quarters`. */
export const firmDiscount = (quarters: number) => (quarters >= 16 ? FIRM_TERMS.discount4y : quarters >= 8 ? FIRM_TERMS.discount2y : 0);
/** The reactive community package after a block (E27; FIN1, spec §4; research/16, /17): ≈ 15% of capex and a 2-quarter
 *  permit delay; it unblocks with odds 0.85 − 0.5 × local opposition (pub.dcNimby / 100), at least 0.3 [D]. The upfront
 *  package is LEVERS.community. */
export const COMMUNITY = { reactive: 0.15, reactiveDelayQ: 2, unblockBase: 0.85, unblockPerAnti: 0.5, unblockMin: 0.3 } as const;

// Facility $11.4B/GW IT ≈ $10B/GW facility, network $4.9B/GW IT ≈ $4B/GW facility (Epoch, 14 May 2026) [R15].
export const FACILITY_PER_GW = 10;
const NETWORK_PER_GW = 4;
/** Building sizes offered by the build card (DATACENTERS §5b: size = one building; rent: the hall size). Hall ≈ one
 *  ~100 MW AI hall (Stargate Abilene phase 1: 206 MW over two halls); 1 GW ≈ the largest live sites in 2026 (Epoch AI
 *  data centers hub) [D]. Bigger sites are campuses of several buildings (CAMPUS). */
export const SITE_TIERS = [
  { id: 'hall', mw: 100 },
  { id: 'building', mw: 300 },
  { id: 'campus', mw: 1000 },
] as const;
/** Fixed chip order and cloud sizes, H100e [D]. */
export const CHIP_TIERS = [100e3, 250e3, 500e3, 1e6, 2.5e6] as const;
/** Share of a site's capex paid at commitment (the rest over the construction quarters; rent: at go-live) [D-7]. */
export const SITE_UPFRONT = 0.05;
/** Power price $/kWh (8.3¢ grid tariff, R15) and O&M 3% of capex per year [R15]. */
export const POWER_PRICE = 0.083;
export const OM_RATE = 0.03;

// ---- DC data block (DATACENTERS.md §2–§5): sources, levers and waits. ----
export type SiteSource = 'rent' | 'grid' | 'gas';
/** Building = facility $10B + network $4B per GW (Epoch May 2026: $11.4B/GW IT facility + $4.9B network). */
const BUILDING_PER_GW = FACILITY_PER_GW + NETWORK_PER_GW; // 14
interface SourceDef { permitQ: number; buildQ: number; maxMW: number; upfrontPerGW: number;
  extraPerGW: number; powerCostMult: number; blockBase: number; delayBase: number }
export const SOURCES: Record<SiteSource, SourceDef> = {
  // rent: hall in a colo/neocloud campus; you pay the network ($4B/GW); landlord builds; no opposition
  rent: { permitQ: 0, buildQ: 0, maxMW: 1000, upfrontPerGW: NETWORK_PER_GW, extraPerGW: 0, powerCostMult: 1, blockBase: 0, delayBase: 0 },
  // grid: building + utility upgrades $0.2B/GW [unverified, range 0.05–0.3]; EIA tariff 1.0×; largest live grid sites ≤ ~1 GW (Epoch hub)
  grid: { permitQ: 1, buildQ: 9.5, maxMW: 1000, upfrontPerGW: BUILDING_PER_GW, extraPerGW: 0.2, powerCostMult: 1, blockBase: 0.05, delayBase: 0.2 },
  // gas: building + turbines $3B/GW ($1.7–2.0k/kW × 1.4–1.6 overbuild, SemiAnalysis); fuel+upkeep 0.57× grid (EIA gas price, heat rates, O&M; research/23 §10); campuses 2.3–5.2 GW
  gas: { permitQ: 2, buildQ: 9.5, maxMW: 5000, upfrontPerGW: BUILDING_PER_GW, extraPerGW: 3, powerCostMult: 0.57, blockBase: 0.1, delayBase: 0.3 },
};
export const SITE_MIN_MW = 100;
/** Construction time of one building (DATACENTERS §5b): the source's quarters × (building GW)^0.4, 9.5 q at 1 GW
 *  (Epoch timelines fit, research/23 §9). No cost economy of size (research/23 §9: cost per MW flat or rising with
 *  size); the saving comes from repetition (CAMPUS). */
export const BUILD_TIME_EXP = 0.4;
/** Campuses (DATACENTERS §5b): 1, 3 or 5 buildings of the same size on one site (grid, gas; rent is one hall).
 *  Repeating the design cuts the building cost 10% (3) / 15% (5) (McKinsey: standardisation saves 10–20%
 *  [unverified snippet]; values [design]). The source's size cap applies to the campus total. */
export type CampusBuildings = 1 | 3 | 5;
export const CAMPUS: { counts: readonly CampusBuildings[]; discount: Record<CampusBuildings, number> } = {
  counts: [1, 3, 5], discount: { 1: 0, 3: 0.10, 5: 0.15 } };
/** Speed-ups (DATACENTERS §5). */
export const LEVERS = {
  crash: { buildMult: 0.5, buildingShare: 0.35, oddsMult: 1.5 },  // Colossus 2 in ~4 q for 1 GW (Epoch): half the construction time; premium, odds [design]
  rushGrid: { waitMult: 0.75, perGW: 0.3 },                         // self-built substation (LBNL Speed to Power 2026) [design]
  rushGas: { waitQ: 4, turbineShare: 0.3 },                         // used/refurbished turbines < 12 months (SemiAnalysis) [design]
  fastTrack: { permitQ: 1, buildingShare: 0.05 },                   // EO 14318 FAST-41 for > 100 MW [design price]
  community: { perGW: 1.0, blockMult: 0.5 },                        // NY Community Investment Framework $1M/MW (Sep 2026); effect [design]
} as const;
/** Rent ≈ $150/kW-month = $1.8B per GW-year (CBRE H1 2026 $139–185; Applied Digital leases); 5-year lease. */
export const RENT = { perGWYear: 1.8, years: 5 } as const;
/** Waits with the player building nothing (DATACENTERS §4), quarters, at 1 January of each year [D-3]. */
export const WAIT_REF = { years: [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
  grid: [12, 16, 18, 20, 20, 17, 13, 10], gas: [4, 6, 8, 9, 9, 8, 7, 6], rent: [1, 2, 3, 4, 4, 4, 4, 4] } as const;
/** What clears each queue, GW per year in 2026 and growth per year [D-2, design]. */
export const WAIT_RATE: Record<SiteSource, { gwPerYear2026: number; growth: number }> = {
  grid: { gwPerYear2026: 30, growth: 1.1 }, gas: { gwPerYear2026: 60, growth: 1.12 }, rent: { gwPerYear2026: 6, growth: 1.3 } };
/** Opposition: public mood = pub.dcNimby ÷ 50; caps [D-6]. */
export const OPPOSITION = { moodRef: 50, blockMax: 0.5, delayMax: 0.9, delayQ: [1, 3] } as const;

/** Supplier components (R15 §1.2). L = quarters from decision to output. */
export const COMPONENTS = {
  pkg: { L: 4, g0: 1.3, beta: 1.5, gmin: 1.0, gmax: 2.5 },
  hbm: { L: 6, g0: 1.3, beta: 1.0, gmin: 1.0, gmax: 2.0 },
  wafer: { L: 16, g0: 1.15, beta: 0.5, gmin: 1.0, gmax: 1.35 },
} as const;

export const MARKET = {
  costDeclineQ: 0.92, // c_t falls 8%/q (perf/$ +40%/yr; Epoch +49%/yr) [R15]
  premiumLo: -0.25, premiumHi: 1.5, // π clamp [R15]
  spotElasticity: 0.8, // r = r_base·(D/S)^0.8 [R15]
  cloudMult: 1.6, // cloud / rental = 1.6× owned TCO [R15]
  chipLifeY: 4, facilityLifeY: 14, wacc: 0.08,
  networkShare: 0.23, // network $4.9B vs servers $21.2B per GW IT (Epoch) [R15]
  nonTWPremium: 1.3, spotPremiumShare: 0.5,
  // Expected path (FIN1, spec §5): at D/S = 1 the premium update π' = π − 0.25π decays by 0.75 a quarter [R15 §1.2].
  premiumReversionQ: 0.75,
  rationW: { firm: 0.5, prepay: 0.5, strategic: 0.5, track: 0.3 }, // firm = take-or-pay order (was: LTA ≥ 4 q old) [R15]
  exoWeight: 1.6, // hyperscalers: LTAs + prepay + track record [D]
  spotRentalPoolShare: 0.1, // spot rental ≤ 10% of the rental pool [R15]
  rentalPoolShare: 0.15, // rental pool = 15% of global stock [D]
} as const;

/** Export-control states (R15 §1.2): China's share of global supply and the performance factor. */
export const EXPORT_POLICY = {
  strict: { xCN: 0.01, perf: 0.3 },
  caseByCase: { xCN: 0.06, perf: 0.6 },
  open: { xCN: 0.12, perf: 1.0 },
} as const;

/** Governance attractiveness to investors (R15 §1.6). A division (parent) takes no outside equity (R9). */
export const GOV_FACTOR = { legacyNonprofit: 0.6, nonprofitPBC: 0.9, pbcTrust: 1.0, founder: 1.1, parent: 0 } as const;
