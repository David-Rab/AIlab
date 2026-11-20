// Strategic partners, debt instruments, site power paths and market constants (FINANCE-V3 §3–§6; V2-SPEC §3.8;
// research/15 §1.2, §1.3, §1.7; research/21 §1 B). Owner: WS3.
// Tags: [R15] = research/15, [R21] = research/21 (primary sources there), [AI27] = research/02, [D] = design value.
import type { Debt, PartnerKind, PartnerSupply, Site } from '../../engine/v2/types';

export type { PartnerKind, PartnerSupply };

/** Strategic partner kinds (FIN4a, spec §6.1): what each gives, what it wants and its strings. */
export const PARTNER_KINDS: Record<PartnerKind, { label: string; gives: string; wants: string }> = {
  hyperscaler: { label: 'Hyperscaler', gives: 'non-voting equity in tranches + cloud or custom chips at a discount, served first', wants: 'a take-or-pay compute commitment' },
  chipVendor: { label: 'Chip vendor', gives: 'equity per GW you deploy + rationing priority', wants: 'you buy its chips (take-or-pay)' },
  sovereign: { label: 'Sovereign', gives: 'a passive equity cheque', wants: 'nothing; Washington notices' },
};

export interface Partner { id: string; kind: PartnerKind; competitors: string[]; supply: PartnerSupply[] }

/** Fictional partners (real analogues in comments). Each anchors at most one lab at a time (§6.1, kept). */
export const PARTNER_DEFS: Partner[] = [
  { id: 'Northwind Cloud', kind: 'hyperscaler', competitors: ['Azimuth'], supply: ['cloud'] }, // Microsoft-like
  { id: 'Azimuth', kind: 'hyperscaler', competitors: ['Northwind Cloud'], supply: ['cloud', 'asic'] }, // Amazon/Google-like (Trainium/TPU)
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
  // (all three cloud partnerships carry one [R21 B4]; size [D]). Exclusivity as before FIN4a (FIN4b makes it optional).
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
  // political cost kept from v2: scrutiny +5, Congress trust −5, security demand +3 [D]. No in-country site (sovereign money was passive; builds were separate deals) [R21 §3].
  sovereign: { equityShareOfV: 0.025, min: 5, max: 25, scrutiny: 5, congress: -5, securityDemand: 3 },
  // Rescue (distress only, spec §6.2): cash ≈ 2 quarters of burn, at least $20B, at most 15% of V; the partner is
  // topped up to 30%, with a board seat of two votes and exclusivity [D].
  rescue: { stake: 0.3, minCash: 20, maxShareOfV: 0.15, seats: 2 },
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
 *  50% of the unamortised balance if you walk away [D], a contingent liability. */
export const CAPEX_LEASE = { rate: { BBB: 0.07, BB: 0.09, B: 0.12 } as Partial<Record<RatingId, number>>, years: { site: 15, chips: 5 }, siteShare: 0.8, rvgShare: 0.5 } as const;
/** Firm contracts (FIN1, spec §5): priced on the expected market path × (1 − discount): 5% for ≥ 2 years, 10% for
 *  ≥ 4 years [D]. Cancellable cloud = spot-indexed × 1.15 with 1 quarter's notice (kept). */
export const FIRM_TERMS = { discount2y: 0.05, discount4y: 0.1, cancellableMult: 1.15, noticeQ: 1 } as const;
/** Firm discount for a contract of `quarters`. */
export const firmDiscount = (quarters: number) => (quarters >= 16 ? FIRM_TERMS.discount4y : quarters >= 8 ? FIRM_TERMS.discount2y : 0);
/** Community packages (FIN1, spec §4; research/16, /17). Upfront ≈ 3% of site capex halves the block odds (kept). After
 *  a block (E27): ≈ 15% of capex and a 2-quarter permit delay; it unblocks with odds 0.85 − 0.5 × local opposition
 *  (pub.dcNimby / 100), at least 0.3 [D]. */
export const COMMUNITY = { upfront: 0.03, blockMult: 0.5, reactive: 0.15, reactiveDelayQ: 2, unblockBase: 0.85, unblockPerAnti: 0.5, unblockMin: 0.3 } as const;

/** Site power paths (R15 §1.3). Lead times in quarters; capex $B per GW of facility power. */
export interface PathDef {
  permitQ: number;
  /** Power lead time (quarters) [lo, mode, hi]; the part beyond `overlapQ` adds a 'power' stage. */
  powerQ: [number, number, number];
  overlapQ: number;
  maxMW: number;
  /** Facility + network capex per GW of facility power ($B). */
  capexPerGW: number;
  powerCostMult: number;
  gas: boolean;
  needsTransformers: boolean;
  usesGridPool: boolean;
}
// Facility $11.4B/GW IT ≈ $10B/GW facility, network $4.9B/GW IT ≈ $4B/GW facility (Epoch, 14 May 2026) [R15].
export const FACILITY_PER_GW = 10;
export const NETWORK_PER_GW = 4;
export const SITE_PATHS: Record<Site['path'], PathDef> = {
  lease: { permitQ: 0, powerQ: [0, 0, 0], overlapQ: 0, maxMW: 1500, capexPerGW: NETWORK_PER_GW, powerCostMult: 1, gas: false, needsTransformers: false, usesGridPool: false },
  brownfield: { permitQ: 1, powerQ: [4, 6, 8], overlapQ: 8, maxMW: 1000, capexPerGW: FACILITY_PER_GW + NETWORK_PER_GW, powerCostMult: 1, gas: false, needsTransformers: true, usesGridPool: false },
  // gas: 6–12 q with aero/recip units; +$1.5–2.5B/GW generation; ~1.3× grid power cost [R15]
  gas: { permitQ: 2, powerQ: [6, 8, 12], overlapQ: 8, maxMW: 2500, capexPerGW: FACILITY_PER_GW + NETWORK_PER_GW + 2, powerCostMult: 1.3, gas: true, needsTransformers: false, usesGridPool: false },
  // grid: 12–24 q (mode 16; LBNL median 61 months request-to-operation) [R15]
  grid: { permitQ: 1, powerQ: [12, 16, 24], overlapQ: 4, maxMW: 5000, capexPerGW: FACILITY_PER_GW + NETWORK_PER_GW + 0.5, powerCostMult: 1, gas: false, needsTransformers: true, usesGridPool: true },
  nuclear: { permitQ: 2, powerQ: [12, 16, 20], overlapQ: 8, maxMW: 1000, capexPerGW: FACILITY_PER_GW + NETWORK_PER_GW + 4, powerCostMult: 0.8, gas: false, needsTransformers: true, usesGridPool: false },
};
/** Data-centre sizes offered by the build card. Hall ≈ one ~100 MW AI hall (Stargate Abilene phase 1: 206 MW over two
 *  halls); campus ≈ the largest live sites in 2026 (~1 GW, Epoch AI data centers hub); multi-GW ≈ 5 GW announced
 *  campuses (Meta Hyperion) [D]. */
export const SITE_TIERS = [
  { id: 'hall', name: 'Hall', full: 'Data hall', mw: 100 },
  { id: 'building', name: 'Building', full: 'Data-centre building', mw: 300 },
  { id: 'campus', name: 'Campus', full: 'Campus', mw: 1000 },
  { id: 'large', name: 'Large campus', full: 'Large campus', mw: 2500 },
  { id: 'multi', name: 'Multi-GW', full: 'Multi-gigawatt campus', mw: 5000 },
] as const;
/** Fixed chip order and cloud sizes, H100e [D]. */
export const CHIP_TIERS = [100e3, 250e3, 500e3, 1e6, 2.5e6] as const;
/** Construction quarters: default 8 (Epoch median ≈ 2 y), crash 4 at +35% capex (xAI Colossus 2) [R15]. */
export const BUILD_Q = { normal: 8, crash: 4, crashCapexMult: 1.35, communityCapexMult: 1.03, leaseLo: 1, leaseHi: 3 };
/** Lease ≈ 12%/yr of $10B per GW facility [R15]; 5-year non-cancellable term [D]. */
export const LEASE = { perGWYear: 1.2, years: 5, poolGWPerQ: 0.6, poolGrowth: 1.4 };
/** Power price $/kWh (8.3¢ grid tariff, R15) and O&M 3% of capex per year [R15]. */
export const POWER_PRICE = 0.083;
export const OM_RATE = 0.03;
/** Transformers: 8–10 q lead (120–128 weeks); pre-order 20% deposit [R15]; $0.25B per GW [D]. */
export const TRANSFORMER = { costPerGW: 0.25, depositShare: 0.2 };

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
  inventoryDecayQ: 0.06, // idle chips lose 6%/q [R15]
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
