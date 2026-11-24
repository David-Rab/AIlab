// Buyers by group (market redesign M2: design/MARKET.md "Buyers (M2)"). Owner: market. Engine: none yet (MK-5 wires it
// into the sector market's buyer choice). Tags: [P] primary source, [P-analogue] primary source for a nearby quantity,
// [D] design value. Sources: research/MARKET-sources.md §1 (firm-size split) and §2 (vetted buyers).
//
// Per sector × region the business buyers' hours split by employment into three groups:
//   vetted  v_s (unscaled by region, see VETTED_SHARE)
//   large   max(0, L_s × regionScale − v_s)   vetted comes out of large first
//   small   the rest                          vetted above L_s × regionScale comes out of small
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
  /** [D] SUSB excludes government, so there is no value; 1.0 because every GOV buyer is vetted (v = 1) and the large
   *  group is empty either way. */
  GOV: 1.0,
  /** [P-analogue] NAICS 3364 aerospace as the defence-industry proxy (3345 instruments 75.0%): ~89%. Unused while v = 1. */
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

/** v_s: share of the sector's employment that buys only as vetted (certified) buyers. No official estimate exists of
 *  the critical-infrastructure share of employment (CISA lists 16 sectors without workforce shares), so most values
 *  are design stand-ins on primary anchors [MARKET-sources §2, table "Proposed vetted share by sector (US)"].
 *  Applied unscaled in every region: §2 suggests scaling the large-firm-based parts by the region's large-firm ratio
 *  but gives no per-sector split of which part that is, and notes China's public and state-owned share would push the
 *  other way (no figure found) [D]. GOV and MIL are vetted by definition everywhere. */
export const VETTED_SHARE: Record<SectorId, number> = {
  /** [D] IT and Communications are CISA sectors; no figure for government IT buyers. */
  SOFT: 0.15,
  /** [D] on [P] government excluding education and USPS is 7.5% of nonfarm jobs [BLS CES B-1, §2 anchor 2a], plus
   *  clerical work in large regulated finance and health firms. */
  OFFICE: 0.20,
  /** [P-analogue] 72.5% of finance jobs are in 500+ firms [SUSB] and all of finance is regulated; Financial Services is
   *  a CISA sector. */
  FIN: 0.70,
  /** [D] 19.2% in 500+ firms [SUSB], plus government legal and judicial staff (no split found). */
  LEGAL: 0.25,
  /** [D] no basis. */
  MEDIA: 0.05,
  /** [D] 5417 R&D is 69.9% large [SUSB] (pharma and defence mix); no federal-lab share found. */
  SCI: 0.35,
  /** [P-analogue] government holds 21.9% of hospital jobs [BLS QCEW 2024, NAICS 622, §2 anchor 2c], private hospitals
   *  are 96% large; Healthcare & Public Health is a CISA sector. */
  HEALTH: 0.55,
  /** [D] designer's Education rule (MARKET.md, 2026-11-24): public schools buy like large firms, not as vetted buyers,
   *  so 0 (§2 proposed 0.70 from the 72.7% public share; that share now sits in LARGE_SHARE.EDU). */
  EDU: 0,
  /** [P] by definition (government). */
  GOV: 1.0,
  /** [P] military, DoD civilians and the defence industrial base [Military OneSource 2024; CRS IF11510, IF10548; §2
   *  anchors 2e, 2f]. */
  MIL: 1.0,
  /** [D] on [P-analogue] DIB ≈ 1.1M of 12.2M manufacturing jobs ≈ 9% [CRS IF10548], plus regulated pharma and
   *  chemicals; Critical Manufacturing, Chemical and Nuclear are CISA sectors. */
  MFG: 0.20,
  /** [D] Transportation Systems is a CISA sector; 66.8% large, scheduled air 97.5% large and FAA/TSA-regulated. */
  LOG: 0.40,
  /** [D] on [P] utilities (~8% of the blend's jobs, 81% large, CISA) fully vetted; construction (86%) mostly not. */
  ENGY: 0.15,
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
  const vetted = Math.min(1, Math.max(0, VETTED_SHARE[sector]));
  const largeAll = Math.min(1, LARGE_SHARE[sector] * REGION_LARGE_SCALE[region]);
  const large = Math.max(0, largeAll - vetted);
  const small = Math.max(0, 1 - vetted - large);
  return { small, large, vetted };
}
