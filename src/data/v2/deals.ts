// Strategic deal templates, partners, debt instruments, site power paths and market constants
// (V2-SPEC §3.7.4, §3.8; research/15 §1.2, §1.3, §1.7). Owner: WS3.
// Tags: [R15] = research/15 (primary sources there), [AI27] = research/02, [D] = design/balance value (tunable).
import type { BoardSeat, Debt, Site, StrategicDeal } from '../../engine/v2/types';

export type PartnerKind = 'hyperscaler' | 'chipVendor' | 'sovereign' | 'neocloud' | 'financial' | 'conglomerate';

export interface DealTemplate {
  id: StrategicDeal['template'];
  name: string;
  partnerKinds: PartnerKind[];
  strings: StrategicDeal['strings'];
  /** Board seat the partner gets (observer = weight 0). */
  seat?: { kind: BoardSeat['kind']; weight: number };
  /** Counts as a strategic deal for test F8 (SPV / neocloud are financing, not strategic). */
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
  {
    id: 'spv', name: 'Project-finance SPV', partnerKinds: ['financial'], strategic: false,
    strings: {},
    // Meta–Blue Owl Hyperion: ~$27B, 80/20, 4-year lease + 16-year residual value guarantee [R15]
    blurb: 'Outside capital funds 80% of a site; you lease it back and guarantee its residual value.',
  },
  {
    id: 'neocloud', name: 'Neocloud take-or-pay', partnerKinds: ['neocloud'], strategic: false,
    strings: {},
    // CoreWeave DDTL secured by an OpenAI contract at SOFR+400, then +550 [R15]
    blurb: 'Compute in a quarter, no capex; multi-year non-cancellable.',
  },
  {
    id: 'megaJV', name: 'Mega-JV', partnerKinds: ['conglomerate'], strategic: true,
    strings: { boardSeat: true }, seat: { kind: 'strategic', weight: 1 },
    // Stargate: $500B over 4 years; SoftBank financial, OpenAI operational [R15]
    blurb: 'Partners fund half of every new site for two years; they share control and take a board seat.',
  },
];

export interface Partner { id: string; kind: PartnerKind; competitors: string[]; templates: StrategicDeal['template'][] }

/** Fictional partners (real analogues in comments). Each anchors at most one lab at a time (§3.7.4). */
export const PARTNER_DEFS: Partner[] = [
  { id: 'Northwind Cloud', kind: 'hyperscaler', competitors: ['Azimuth'], templates: ['hyperscalerEquity', 'vendorFinance'] }, // Microsoft-like
  { id: 'Azimuth', kind: 'hyperscaler', competitors: ['Northwind Cloud'], templates: ['hyperscalerEquity', 'customASIC', 'vendorFinance'] }, // Amazon/Google-like
  { id: 'Silica Systems', kind: 'chipVendor', competitors: ['Corvid Micro'], templates: ['chipVendorEquity', 'vendorFinance'] }, // Nvidia-like
  { id: 'Corvid Micro', kind: 'chipVendor', competitors: ['Silica Systems'], templates: ['chipVendorEquity'] }, // AMD-like (warrants)
  { id: 'Gulf Sovereign Fund', kind: 'sovereign', competitors: [], templates: ['sovereign'] }, // MGX/QIA-like
  { id: 'Vantage Neocloud', kind: 'neocloud', competitors: [], templates: ['neocloud'] }, // CoreWeave-like
  { id: 'Keystone Capital', kind: 'financial', competitors: [], templates: ['spv'] }, // Blue Owl-like
  { id: 'Meridian Group', kind: 'conglomerate', competitors: [], templates: ['megaJV'] }, // SoftBank-like
];
export const PARTNERS = PARTNER_DEFS.map((p) => p.id);
export const partnerDef = (id: string) => PARTNER_DEFS.find((p) => p.id === id);

/** Deal sizing [D unless tagged]. */
export const DEAL_TERMS = {
  hyperscaler: { equityShareOfV: 0.03, trancheMin: 5, trancheMax: 15, tranches: 3, commitMult: 4, years: 6 }, // E $5–15B per tranche, C 4–12×E over 5–10 y [R15]
  asic: { priceMult: 0.45, quarters: 8, gw: 1.0 }, // perf/$ 2–5× H100 [R15]; migration 2–3 q
  vendorEquity: { perGW: 10, gw: 2, quarters: 8 }, // $10B per GW deployed [R15]
  vendorNote: { revenueMult: 0.4, max: 25, spreadBp: 300, years: 5 }, // Broadcom $42B, Amazon $15B, Google $20B [R15]
  sovereign: { equityShareOfV: 0.025, min: 5, max: 25, siteMW: 1000 },
  spv: { share: 0.8, leaseRate: 0.12, rvgShare: 0.5, years: 4 }, // 80/20, 4 y lease + RVG [R15]
  neocloud: { priceMult: 1.1, quarters: 16 },
  megaJV: { share: 0.5, years: 2, leaseRate: 0.1 },
  rescue: { stake: 0.3, minCash: 20 },
  offerDays: 60,
};

/** Debt instruments (R15 §1.7). */
export const DEBT_TERMS: Record<Debt['kind'], { spreadBp: number; years: number; note: string }> = {
  revolver: { spreadBp: 200, years: 5, note: '≤ min(0.33·R, $15B); liquidity ≥ max($1B, 0.11·R) each quarter end' }, // SOFR+150–250 [R15 Design]
  gpuTerm: { spreadBp: 475, years: 4, note: 'LTV 50–70% of chip book; collateral < 1.2× loan → cash sweep' }, // CoreWeave DDTL SOFR+400–550 [R15]
  bond: { spreadBp: 150, years: 10, note: 'Only R > $50B or public; ≤ 1×R; y10 + spread(rating)' }, // Oracle 4.45–6.85% [R15]
  vendorNote: { spreadBp: 300, years: 5, note: 'Converts at IPO; counts as a commitment' },
};
/** Bond spread over y10 by rating (bp) [R15]; BB/B are SOFR-based in R15, mapped onto y10 here [D]. */
export const RATING_SPREAD_BP: Record<'BBB' | 'BB' | 'B' | 'closed', number> = { BBB: 125, BB: 450, B: 750, closed: 1200 };

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
  ltaDiscount: 0.95, nonTWPremium: 1.3, spotPremiumShare: 0.5,
  fundSupplierPer100k: 1.0, // $1.0B per +100k H100e/q of packaging [R15 Design]
  inventoryDecayQ: 0.06, // idle chips lose 6%/q [R15]
  rationW: { lta: 0.5, prepay: 0.5, strategic: 0.5, track: 0.3 }, // [R15]
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

/** Governance attractiveness to investors (R15 §1.6). */
export const GOV_FACTOR = { legacyNonprofit: 0.6, nonprofitPBC: 0.9, pbcTrust: 1.0, founder: 1.1 } as const;
