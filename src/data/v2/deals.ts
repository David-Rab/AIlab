// Strategic deal templates, partners, debt instruments, site power paths and market constants
// (V2-SPEC §3.7.4, §3.8; research/15 §1.2, §1.3, §1.7). Owner: WS3.
// Tags: [R15] = research/15 (primary sources there), [AI27] = research/02, [D] = design/balance value (tunable).
import type { BoardSeat, Debt, Site, StrategicDeal } from '../../engine/v2/types';

export type PartnerKind = 'hyperscaler' | 'chipVendor' | 'sovereign';

export interface DealTemplate {
  id: StrategicDeal['template'];
  name: string;
  partnerKinds: PartnerKind[];
  strings: StrategicDeal['strings'];
  /** Board seat the partner gets (observer = weight 0). */
  seat?: { kind: BoardSeat['kind']; weight: number };
  /** Counts as a strategic deal for test F8 (vendor financing is financing, not strategic). */
  strategic: boolean;
  blurb: string;
}

export const DEAL_TEMPLATES: DealTemplate[] = [
  {
    id: 'hyperscalerEquity', name: 'Hyperscaler equity', partnerKinds: ['hyperscaler'], strategic: true,
    strings: { observer: true, exclusivity: true, revenueShare: 0.08 }, seat: { kind: 'strategic', weight: 0 },
    // Amazon→Anthropic $8B then $5B + up to $20B against a >$100B AWS commitment; Microsoft→OpenAI ~27%, +$250B Azure [R15 §1.7]
    blurb: 'Equity in tranches; take-or-pay cloud commitment of 4–12× the equity over 5–10 years.',
  },
  {
    id: 'customASIC', name: 'Custom ASIC', partnerKinds: ['hyperscaler'], strategic: true,
    strings: { exclusivity: true },
    // TPU v6e 5.9×, Trainium2 4.4× H100 perf/$ (Epoch Q4 2025) [R15]; migration −15% research 2–3 q [R15 Design]
    blurb: 'Cheap chips from a separate supply pool; take-or-pay; research slows while you migrate.',
  },
  {
    id: 'chipVendorEquity', name: 'Chip-vendor equity', partnerKinds: ['chipVendor'], strategic: true,
    strings: {},
    // Nvidia: up to $10B per GW deployed of its chips; AMD: warrants vesting by GW [R15 §1.7]
    blurb: 'Vendor invests $10B per GW of its chips you deploy; you commit to buy them (LTA).',
  },
  {
    id: 'vendorFinance', name: 'Vendor financing', partnerKinds: ['hyperscaler', 'chipVendor'], strategic: false,
    strings: {},
    // Broadcom up to $42B to fund Anthropic TPU lease rent; Amazon $15B / Google $20B note facilities [R15 §1.7]
    blurb: 'Supplier lends you the money to pay it. Converts at IPO; counts as debt.',
  },
  {
    id: 'sovereign', name: 'Sovereign', partnerKinds: ['sovereign'], strategic: true,
    strings: { inCountrySite: true },
    // MGX, QIA, GIC in Stargate / OpenAI / Anthropic G / xAI E; UAE "enhanced favorable treatment" 91 FR 43034 [R15]
    blurb: 'Large equity cheque; you must build a site in-country. Washington notices.',
  },
];
// FIN1 (spec §4, §5): the project-finance SPV is now the lease payment option on the build card (finance/capex.ts),
// the neocloud a provider on the Rent compute card, and the mega-JV is removed.

export interface Partner { id: string; kind: PartnerKind; competitors: string[]; templates: StrategicDeal['template'][] }

/** Fictional partners (real analogues in comments). Each anchors at most one lab at a time (§3.7.4). */
export const PARTNER_DEFS: Partner[] = [
  { id: 'Northwind Cloud', kind: 'hyperscaler', competitors: ['Azimuth'], templates: ['hyperscalerEquity', 'vendorFinance'] }, // Microsoft-like
  { id: 'Azimuth', kind: 'hyperscaler', competitors: ['Northwind Cloud'], templates: ['hyperscalerEquity', 'customASIC', 'vendorFinance'] }, // Amazon/Google-like
  { id: 'Silica Systems', kind: 'chipVendor', competitors: ['Corvid Micro'], templates: ['chipVendorEquity', 'vendorFinance'] }, // Nvidia-like
  { id: 'Corvid Micro', kind: 'chipVendor', competitors: ['Silica Systems'], templates: ['chipVendorEquity'] }, // AMD-like (warrants)
  { id: 'Gulf Sovereign Fund', kind: 'sovereign', competitors: [], templates: ['sovereign'] }, // MGX/QIA-like
];
/** Default provider on the Rent compute card: a neocloud (CoreWeave-like). Neoclouds are providers, not deals (FIN1,
 *  spec §5). */
export const NEOCLOUD = 'Vantage Neocloud';
/** Lessor that funds financing leases of sites and chips (Blue Owl-like; Meta–Blue Owl Hyperion [R15]). */
export const LESSOR = 'Keystone Capital';
export const PARTNERS = PARTNER_DEFS.map((p) => p.id);
export const partnerDef = (id: string) => PARTNER_DEFS.find((p) => p.id === id);

/** Deal sizing [D unless tagged]. */
export const DEAL_TERMS = {
  hyperscaler: { equityShareOfV: 0.03, trancheMin: 5, trancheMax: 15, tranches: 3, commitMult: 4, years: 6 }, // E $5–15B per tranche, C 4–12×E over 5–10 y [R15]
  asic: { priceMult: 0.45, quarters: 8, gw: 1.0 }, // perf/$ 2–5× H100 [R15]; migration 2–3 q
  vendorEquity: { perGW: 10, gw: 2, quarters: 8 }, // $10B per GW deployed [R15]
  vendorNote: { revenueMult: 0.4, max: 25, spreadBp: 300, years: 5 }, // Broadcom $42B, Amazon $15B, Google $20B [R15]
  sovereign: { equityShareOfV: 0.025, min: 5, max: 25, siteMW: 1000 },
  rescue: { stake: 0.3, minCash: 20 },
  offerDays: 60,
};

/** Debt instruments (R15 §1.7; FIN1 spec §3). `spreadBp` is the default; credit lines, chip loans and bonds are priced
 *  by rating (tables below). */
export const DEBT_TERMS: Record<Debt['kind'], { spreadBp: number; years: number; note: string }> = {
  revolver: { spreadBp: 200, years: 5, note: '3% of valuation, cap $15B; cash ≥ ⅓ of the line at quarter ends' }, // SOFR+150–250 [R15 Design]
  gpuTerm: { spreadBp: 475, years: 4, note: '≤ 60% of chip value; collateral < 1.2× loan → cash sweep' }, // CoreWeave DDTL SOFR+400–550 [R15]
  bond: { spreadBp: 150, years: 10, note: 'Only with positive trailing operating cash flow; ≤ 3× it; y10 + spread(rating)' }, // Oracle 4.45–6.85% [R15]
  vendorNote: { spreadBp: 300, years: 5, note: 'Converts at IPO; counts as a commitment' },
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
