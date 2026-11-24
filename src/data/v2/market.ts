// Buyers by group (market redesign M2: design/MARKET.md "Buyers (M2)"). Owner: market. Engine: worldfx/mix.ts (MK-5: each group runs the sector choice
// over the products it reaches). Tags: [P] primary source, [P-analogue] primary source for a nearby quantity,
// [D] design value. Sources: research/MARKET-sources.md §1 (firm-size split) and §2 (vetted buyers).
//
// Per sector × region the business buyers' hours split by employment into three groups:
//   largeAll = L_s × regionScale × (1 − p_s)   the private large firms (EDU: L_s × regionScale, see LARGE_SHARE.EDU)
//   vetted   = p_s + r_s × largeAll            public buyers plus the regulated share of large firms
//   large    = (1 − r_s) × largeAll
//   small    = 1 − vetted − large
// p_s PUBLIC_SHARE (same in every region), r_s REGULATED_FRACTION, so vetted scales by region and never exceeds the
// public plus large-firm share.
import type { RegionId, SectorId } from '../../engine/v2/types';

/** L_s: US share of private employment in firms with ≥ 500 employees, 1 − ("<500" ÷ "Total") [MARKET-sources §1; Census
 *  SUSB 2022, enterprise employment size, released 10 Apr 2025]. Enterprise size, so a large firm's establishment
 *  counts as large even inside a small-firm industry. SUSB is by industry, not occupation, so OFFICE and LEGAL are
 *  approximations. */
export const LARGE_SHARE: Record<SectorId, number> = {
  /** [P] blend of NAICS 5112 software publishers 74.2%, 5182 data processing 65.7%, 5415 computer systems design 51.8%. */
  SOFT: 0.595,
  /** [P-analogue] the all-industries share (54.1%, rounded 54%): clerical work sits in every industry; NAICS 56 alone
   *  is 71.3%. */
  OFFICE: 0.54,
  /** [P] blend of NAICS 52 finance & insurance 72.5% and 5412 accounting 47.6%. */
  FIN: 0.687,
  /** [P] NAICS 5411 legal services 19.2%; in-house legal staff not captured. */
  LEGAL: 0.192,
  /** [P] blend of 5418 advertising/PR 44.5%, 512 film, 515 broadcasting, 71 arts 36.3%. */
  MEDIA: 0.429,
  /** [P] blend of 5417 scientific R&D 69.9% and 5413 architecture/engineering 45.7%. */
  SCI: 0.545,
  /** [P] NAICS 62, private only (general hospitals 95.8%, physician offices 48.1%). */
  HEALTH: 0.563,
  /** [P] + designer's Education rule (MARKET.md, 2026-11-24): public schools buy like large firms, not as vetted
   *  buyers. L = public share 0.727 [§2 anchor 2b, BLS CES Table B-1] + 0.273 × private large share 0.527 [§1, SUSB
   *  NAICS 61] = 0.871. */
  EDU: 0.871,
  /** [D] SUSB excludes government, so there is no value; 1.0 for completeness; unused, since GOV is all public
   *  (p = 1) and every buyer is vetted. */
  GOV: 1.0,
  /** [P-analogue] NAICS 3364 aerospace as the defence-industry proxy (3345 instruments 75.0%): ~89%. Unused: MIL is all public (p = 1). */
  MIL: 0.89,
  /** [P] NAICS 31–33 manufacturing 59.1%. */
  MFG: 0.591,
  /** [P] NAICS 48–49 transport & warehousing 66.8% (scheduled air 97.5%, warehousing 88.1%, trucking 53.4%). */
  LOG: 0.668,
  /** [P] blend of 22 utilities 81.2%, 23 construction 19.3% (86% of the jobs), 21 mining 52.6%. */
  ENGY: 0.26,
  /** [P] blend of 44–45 retail 65.8%, 72 accommodation & food 37.2%, 81 other services 15.0%. */
  SERV: 0.467,
};

/** p_s: government-run share of the sector's employment, the same in every region [D on [P]]. Government buyers are
 *  vetted (certified) buyers. Sectors without a primary anchor in MARKET-sources §2 are 0. */
export const PUBLIC_SHARE: Record<SectorId, number> = {
  SOFT: 0, OFFICE: 0, FIN: 0, LEGAL: 0, MEDIA: 0, SCI: 0,
  /** [P-analogue] government holds 21.9% of hospital jobs [BLS QCEW 2024, NAICS 622, §2 anchor 2c]; hospitals stand in
   *  for the whole sector (LARGE_SHARE.HEALTH is private-only SUSB, so it applies to the other 78.1%). */
  HEALTH: 0.219,
  /** [D] designer's Education rule (MARKET.md, 2026-11-24): public schools (72.7% of education employment [P, BLS CES
   *  B-1, §2 anchor 2b]) buy like large firms, not as vetted buyers, so 0; that share sits in LARGE_SHARE.EDU. */
  EDU: 0,
  /** [P] by definition (government). */
  GOV: 1,
  /** [P] military, DoD civilians and the defence industrial base all buy as vetted buyers [Military OneSource 2024;
   *  CRS IF11510, IF10548; §2 anchors 2e, 2f]. */
  MIL: 1,
  MFG: 0, LOG: 0, ENGY: 0, SERV: 0,
};

/** r_s: share of the sector's large firms that count as vetted buyers (regulated, critical infrastructure, defence-
 *  adjacent) [D, designer estimate 2026-11-24, on the anchors of MARKET-sources §2: CISA's 16 critical-infrastructure
 *  sectors list no workforce shares, so no official figure exists]. Applied to the region's large firms, so vetted
 *  scales with the region's large-firm share and never exceeds what is possible. GOV and MIL: n/a (all public), 0. */
export const REGULATED_FRACTION: Record<SectorId, number> = {
  /** [D] IT and Communications are CISA sectors. */
  SOFT: 0.15,
  /** [D] clerical work in large regulated finance and health firms. */
  OFFICE: 0.15,
  /** [D] all of finance is regulated; Financial Services is a CISA sector; only the large banks and insurers clear
   *  vetting. */
  FIN: 0.5,
  /** [D] large firms serving regulated and government clients. */
  LEGAL: 0.25,
  /** [D] no basis. */
  MEDIA: 0.05,
  /** [D] 5417 R&D is 69.9% large [SUSB], a pharma and defence mix. */
  SCI: 0.35,
  /** [D] Healthcare & Public Health is a CISA sector; private hospitals are 96% large [SUSB, §2 anchor 2c]. */
  HEALTH: 0.5,
  /** [D] Education rule: no vetted buyers. */
  EDU: 0,
  GOV: 0,
  MIL: 0,
  /** [D] DIB ≈ 1.1M of 12.2M manufacturing jobs ≈ 9% [CRS IF10548], plus regulated pharma and chemicals; Critical
   *  Manufacturing, Chemical and Nuclear are CISA sectors. */
  MFG: 0.2,
  /** [D] Transportation Systems is a CISA sector; scheduled air is 97.5% large and FAA/TSA-regulated. */
  LOG: 0.25,
  /** [D] utilities (81% large, CISA Energy, Water, Nuclear) are vetted; construction mostly is not. */
  ENGY: 0.5,
  /** [D] no basis. */
  SERV: 0.03,
};

/** Large-firm share of a region relative to the US all-industries share 54.1% [P, SUSB 2022: 1 − 62,250,556 ÷
 *  135,748,407], applied to every sector's L_s (no per-sector split outside the US) [D, MARKET-sources §1 "Game
 *  mapping"].
 *  ROW: EU business economy share in 250+ firms 37.4% [P-analogue, Eurostat sbs_sc_ovw 2022: 60.0M of 160.6M; the
 *       cutoff differs from SUSB's 500] → 37.4 / 54.1 ≈ 0.69.
 *  CN:  large enterprises ≈ 20.6% of enterprise employment (SMEs 79.4%, end 2018) [P, NBS China Fourth Economic Census
 *       report no. 12; size thresholds are industry-specific] → 20.6 / 54.1 ≈ 0.38. */
export const REGION_LARGE_SCALE: Record<RegionId, number> = {
  US: 1,
  ROW: 37.4 / 54.1,
  CN: 20.6 / 54.1,
};

export interface BuyerGroups { small: number; large: number; vetted: number }

/** The three buyer groups' shares of a sector's business buyers in a region (sum 1, none negative). */
export function buyerGroups(sector: SectorId, region: RegionId): BuyerGroups {
  const p = PUBLIC_SHARE[sector];
  const r = REGULATED_FRACTION[sector];
  // EDU's L already includes the public schools (Education rule), so it is not reduced by the private share.
  const priv = sector === 'EDU' ? 1 : 1 - p;
  const largeAll = Math.min(1, LARGE_SHARE[sector] * REGION_LARGE_SCALE[region]) * priv;
  const vetted = p + r * largeAll;
  const large = (1 - r) * largeAll;
  const small = Math.max(0, 1 - vetted - large);
  return { small, large, vetted };
}
