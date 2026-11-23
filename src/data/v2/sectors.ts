// Sectors (V2-SPEC §3.11.2; research/16 §1A.1, 14 US work segments; CN/ROW mirror them). Owner: WS5.
//
// Tags: [R16] research/16 table values (themselves [D] weights checked against Eloundou et al. / Microsoft
// applicability, BLS CES shares [V]); [V] verified primary numbers quoted in research/16 notes; [D] design; [fit]
// fitted by scripts/v2/worldfx.ts against V2-SPEC §7.3.
import type { DomainId, EconPresetId, RegionId, SectorId } from '../../engine/v2/types';

export interface SectorDef {
  id: SectorId; name: string;
  /** Share of US employment (%), relative wage (avg 1). [R16, BLS CES ±2 pp] */
  empPct: number; wage: number;
  /** Task weights per domain (rows sum to 1). [R16] */
  tasks: Partial<Record<DomainId, number>>;
  /** θ difficulty offset, R0 friction, Bass p/q per year, α_max, η demand elasticity. [R16] */
  theta: number; R0: number; p: number; q: number; alphaMax: number; eta: number;
  /** Start task-adoption share A (0..1) at Jul 2025, US: the share of the sector's work-hours on tasks firms have handed
   *  to AI (it substitutes α of them, augments the rest). [fit] to Census BTOS firm use (research/16 §6, N2a). A2a check
   *  against the worker anchors (research/22 §1): 6.3% of hours used and 2.2% saved in 2026 with assisted hours saving
   *  g_aug imply A ≈ (2.2 − 0.3·6.3)/(0.5 − 0.3) ≈ 1.5% of US hours in 2026 — the game's 1.7–2.2% — so A0 is kept;
   *  the rest of the measured use is workers' assisted use (`use`, ECON.useW / useH). */
  A0: number;
  /** A2a: relative AI use of the sector's workers vs the US average (hours assisted per work-hour), from the RPS by
   *  industry (research/22 §1: information 14% and leisure 2.3% of hours vs ≈5.4% for all, 2024; professional,
   *  scientific and technical 11.4%, finance 9.7% and production occupations 4.6% vs 6.3%, Q2 2026); sectors the
   *  survey does not break out are [D] (office/customer service and education 1.2: high applicability, Tomlinson et
   *  al.; health, logistics, energy 0.5). Normalised by employment in `useOf` (worldfx/sectors.ts); the ratio is split
   *  evenly between the share of workers who use AI (√) and their intensity (√) [D]. */
  use: number;
  /** Employment floor as a share of E0 ("human-made", legally required jobs). [R16 §1A.2 step 7] */
  floor: number;
  /** Pure cognitive / remote-workable segment (AI 2027 "remote-work jobs"; Eloundou most-exposed). [R16 §1A.1] */
  remote: boolean;
  /** Most AI-exposed for 22–25-year-olds (Canaries: software developers, customer service). [R16 N2a] */
  youthExposed: boolean;
  /** Private sector (enters the ECON control domain); FIN gets ×1.5 for algorithmic trading. [R16 §2.1] */
  econWeight: number;
  /** Relative robot allocation per physical task (industrial robots sit mostly in manufacturing). [D] */
  robotBias: number;
}

export const SECTORS: SectorDef[] = [
  { id: 'SOFT', name: 'Software and IT', empPct: 3, wage: 1.9, tasks: { CODE: 0.55, REASON: 0.2, AGENCY: 0.15, SOCIAL: 0.1 }, theta: 0, R0: 0.05, p: 0.1, q: 2.0, alphaMax: 0.85, eta: 0.8, A0: 0.04, use: 2.6, floor: 0.03, remote: true, youthExposed: true, econWeight: 1, robotBias: 0 },
  { id: 'OFFICE', name: 'Admin, clerical, customer service', empPct: 12, wage: 0.8, tasks: { REASON: 0.35, SOCIAL: 0.35, MEDIA: 0.1, AGENCY: 0.2 }, theta: 0, R0: 0.1, p: 0.06, q: 1.4, alphaMax: 0.9, eta: 0.1, A0: 0.025, use: 1.2, floor: 0.03, remote: true, youthExposed: true, econWeight: 1, robotBias: 0 },
  { id: 'FIN', name: 'Finance, insurance, accounting', empPct: 6, wage: 1.6, tasks: { REASON: 0.55, CODE: 0.1, SOCIAL: 0.2, AGENCY: 0.15 }, theta: 0.3, R0: 0.25, p: 0.05, q: 1.2, alphaMax: 0.8, eta: 0.3, A0: 0.022, use: 1.55, floor: 0.03, remote: true, youthExposed: false, econWeight: 1.5, robotBias: 0 },
  { id: 'LEGAL', name: 'Legal and compliance', empPct: 1, wage: 1.8, tasks: { REASON: 0.6, SOCIAL: 0.25, AGENCY: 0.15 }, theta: 0.5, R0: 0.4, p: 0.04, q: 1.0, alphaMax: 0.7, eta: 0.4, A0: 0.016, use: 1.8, floor: 0.05, remote: true, youthExposed: false, econWeight: 1, robotBias: 0 },
  { id: 'MEDIA', name: 'Creative, media, marketing', empPct: 2, wage: 1.2, tasks: { MEDIA: 0.5, SOCIAL: 0.25, REASON: 0.25 }, theta: 0, R0: 0.1, p: 0.08, q: 1.6, alphaMax: 0.75, eta: 0.6, A0: 0.035, use: 2.0, floor: 0.05, remote: true, youthExposed: false, econWeight: 1, robotBias: 0 },
  { id: 'SCI', name: 'Science and engineering R&D', empPct: 3, wage: 1.7, tasks: { REASON: 0.5, CODE: 0.2, AGENCY: 0.1, PHYS: 0.2 }, theta: 0.5, R0: 0.15, p: 0.06, q: 1.4, alphaMax: 0.7, eta: 1.0, A0: 0.015, use: 1.8, floor: 0.05, remote: false, youthExposed: false, econWeight: 1, robotBias: 1 },
  { id: 'HEALTH', name: 'Healthcare', empPct: 13, wage: 1.1, tasks: { REASON: 0.3, SOCIAL: 0.25, PHYS: 0.45 }, theta: 1.5, R0: 0.55, p: 0.03, q: 0.8, alphaMax: 0.6, eta: 0.6, A0: 0.003, use: 0.5, floor: 0.1, remote: false, youthExposed: false, econWeight: 1, robotBias: 0.5 },
  { id: 'EDU', name: 'Education', empPct: 9, wage: 0.9, tasks: { SOCIAL: 0.45, REASON: 0.35, MEDIA: 0.2 }, theta: 0.5, R0: 0.45, p: 0.04, q: 0.9, alphaMax: 0.5, eta: 0.3, A0: 0.013, use: 1.2, floor: 0.1, remote: false, youthExposed: false, econWeight: 0, robotBias: 0 },
  { id: 'GOV', name: 'Government administration', empPct: 6, wage: 1.0, tasks: { REASON: 0.45, SOCIAL: 0.3, AGENCY: 0.25 }, theta: 0.5, R0: 0.5, p: 0.03, q: 0.8, alphaMax: 0.7, eta: 0.1, A0: 0.01, use: 0.8, floor: 0.1, remote: false, youthExposed: false, econWeight: 0, robotBias: 0 },
  { id: 'MIL', name: 'Military and defense industry', empPct: 2, wage: 1.1, tasks: { REASON: 0.25, CYBER: 0.15, AGENCY: 0.2, PHYS: 0.4 }, theta: 1.0, R0: 0.4, p: 0.03, q: 1.0, alphaMax: 0.6, eta: 0.2, A0: 0.003, use: 0.6, floor: 0.1, remote: false, youthExposed: false, econWeight: 0, robotBias: 1 },
  { id: 'MFG', name: 'Manufacturing', empPct: 8, wage: 1.0, tasks: { PHYS: 0.7, REASON: 0.15, CODE: 0.15 }, theta: 0.5, R0: 0.15, p: 0.04, q: 1.0, alphaMax: 0.9, eta: 0.3, A0: 0.003, use: 0.75, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 4 },
  { id: 'LOG', name: 'Transport, logistics, warehousing', empPct: 6, wage: 0.9, tasks: { PHYS: 0.75, REASON: 0.15, AGENCY: 0.1 }, theta: 1.0, R0: 0.4, p: 0.03, q: 0.9, alphaMax: 0.9, eta: 0.2, A0: 0.001, use: 0.5, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 1.5 },
  { id: 'ENGY', name: 'Energy, utilities, construction', empPct: 7, wage: 1.1, tasks: { PHYS: 0.75, REASON: 0.15, AGENCY: 0.1 }, theta: 1.0, R0: 0.35, p: 0.02, q: 0.8, alphaMax: 0.8, eta: 0.5, A0: 0.001, use: 0.5, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 1 },
  { id: 'SERV', name: 'Retail, hospitality, personal services', empPct: 22, wage: 0.6, tasks: { PHYS: 0.55, SOCIAL: 0.35, REASON: 0.1 }, theta: 0.5, R0: 0.15, p: 0.03, q: 0.8, alphaMax: 0.8, eta: 0.1, A0: 0.003, use: 0.45, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 0.5 },
];

export const SECTOR_IDS: SectorId[] = SECTORS.map((s) => s.id);
export const SECTOR_BY_ID = Object.fromEntries(SECTORS.map((s) => [s.id, s])) as Record<SectorId, SectorDef>;
export const REGIONS: RegionId[] = ['US', 'CN', 'ROW'];

/** US employment base (persons): ≈159M nonfarm payroll + 1.24M active-duty military (BLS CES Oct 2026, DMDC). [V] */
export const US_EMPLOYMENT = 160e6;

/** Region scales relative to the US (§3.11.3): ROW wage × 0.5, employment × 6 [spec]; CN ≈ 740M employed at
 *  0.3 × US wage [D]. `use` scales the workers' base use share W_b (A2a: CN and ROW workers use AI at 0.6 × the US
 *  rate, at the US intensity; A8 check: ROW / US hours of use 6 × 0.6 = 3.6, and Claude.ai usage outside the US and
 *  China is 78% of the world's against the US's 21.6%, 3.6× [P: Anthropic Economic Index, Sep 2025]). `A0` scales the
 *  start of firm adoption A, the tasks firms hand to AI and pay for by the hour (A2a had it = `use`). A8: ROW 0.225 =
 *  0.6 × the paid-seat ratio of AI-using workers (SEATS.start ROW 0.045 ÷ US 0.12) [D]: firms outside the US paid for
 *  AI at the rate their workers held paid seats, so ROW's adopted and agent spend starts at 1.3× the US's (was 3.4×), and
 *  US customers are 43% of the start sector spend outside China (was 30%). Anthropic's revenue by billing address was ≈ 2/3
 *  US in 2025 and 72% in H1 2026 [UNVERIFIED: secondary readings of its S-1; the filing exceeded the fetch limit],
 *  an upper bound for where the work is (multinationals bill in the US). A then moves toward its ceiling as in the US,
 *  so ROW closes the gap over the game (ROW / US adopted spend 1.3× at the start, 2.5× by day 400, 3.3× by day 900;
 *  3.5 / 3.9 / 3.9× before). CN keeps 0.6 (served by Chinese labs; no anchor). `R` scales friction
 *  (CN state steering, EU AI Act in ROW) [D]. */
export const REGION_SCALE: Record<RegionId, { emp: number; wage: number; A0: number; use: number; R: number }> = {
  US: { emp: 1, wage: 1, A0: 1, use: 1, R: 1 },
  CN: { emp: 4.6, wage: 0.3, A0: 0.6, use: 0.6, R: 0.85 },
  ROW: { emp: 6, wage: 0.5, A0: 0.225, use: 0.6, R: 1.1 },
};

/** Labor-force scale (employment / (1 − U_base)) and base unemployment by region (%). US 4.3% [R16 §1A.2]. */
export const U_BASE: Record<RegionId, number> = { US: 4.3, CN: 5.2, ROW: 5.5 };

/** World-economy presets (research/16 §4.6), hidden per world. */
export interface EconPreset { diffMult: number; frictionScale: number; sigma: number; robotFloorYears: number; nu: number }
export const ECON_PRESETS: Record<EconPresetId, EconPreset> = {
  normal: { diffMult: 0.4, frictionScale: 1.5, sigma: 0.35, robotFloorYears: 2, nu: 0.5 },
  ai2027: { diffMult: 1.0, frictionScale: 1.0, sigma: 0.5, robotFloorYears: 1, nu: 0.3 },
  gate: { diffMult: 1.5, frictionScale: 0.6, sigma: 0.7, robotFloorYears: 0.25, nu: 0.15 },
};

/** Economy constants (research/16 §1A.2, §4). */
export const ECON = {
  /** Average US wage per hour W0 ($), V2-SPEC §3.11.3 [D]. */
  W0: 35,
  /** Hours per worker-year. */
  hours: 2000,
  /** g_aug: productivity gain on augmented work (field RCT range 0.14–0.4). [R16] An hour of AI use saves
   *  α_use + (1 − α_use)·g_aug hours, α_use = α·A/U the substituted share of an hour of use (A2a; research/22 §1e:
   *  measured 0.35 in 2024–26, ≈0.33 by the authors). */
  gAug: 0.3,
  /** A2a worker-level use (research/22 §1; Bick, Blandin & Deming RPS). Workers who use AI at work (share W of a
   *  sector's workers, a Bass stock) use it on `useH` of their hours the firm has not handed to AI, so hours of use
   *  U = A + useH·max(0, W − A) of the work-hours. W* = max(A, W_b + (1 − W_b)·F): today's base share W_b = useW·√use
   *  plus the rest of the workers as the AI covers more of their work (F). useW [fit to R22 1a]: 37% of US workers in
   *  Jul 2025 (28.2% Q3 2024 → 40.7% Nov 2025 → 39.2% Q2 2026). useH [fit to R22 1b–1c]: ≈6% of US work-hours in
   *  mid-2026 (6.3% Q2 2026), ≈0.15 of a user's hours (6.3 / 39.2 ≈ 0.16). */
  useW: 0.37,
  useH: 0.115,
  /** Feasibility logistic σ((Le − fMid − θ)/fSpread). R16 writes 8 and 1.2, but those constants give F_SOFT 0.18
   *  (Agent-1) and 0.64 (Agent-3-mini) against R16's own stated calibration of ≈0.25 and ≈0.8 (F_OFFICE ≈0.5).
   *  [fit] to the stated anchors: 7.35 / 1.1 → 0.26, 0.76, F_OFFICE 0.59. Model v3 V4: cognitive feasibility is the
   *  sector work type's coverage (worldfx/serving.ts, SECTOR_REF.mid = this point on the V0 → SC axis); fMid/fSpread now
   *  set only the robot-bound PHYS part and the start state. v2's price capture θ = 0.26 of the wage and the abstract
   *  cost curve (60% of W0 at L 5, halving per 1.5 levels) are gone: prices and the cost gate read physical costs. */
  fMid: 7.35, fSpread: 1.1,
  /** Cost gate logistic spread. [R16] */
  kSpread: 0.7,
  /** Natural quits ≈ 1.5%/month absorb employment declines before layoffs. [R16] */
  attritionPerMonth: 0.015,
  /** Labor share LS0 (BLS nonfarm business), supervision residual ψ. [R16 §1A.2 step 10] */
  LS0: 0.56, psi: 0.1,
  /** Income Gini (Census money income). [R16 §4.4] */
  gini0: 0.48,
  /** Hiring index: HireRate = 1 − slope·ΔF vs the pre-LLM (late-2022) feasibility. R16 writes 1.5 [D, no source]. CAL2-X
   *  (decision 6): 1.2, a once-fitted stand-in that lands HireRate_SOFT ≤ 10% ("hiring new programmers has nearly
   *  stopped", AI 2027 Jul 2027) near Jul 2027: first day over five RefBot classic seeds 2027-05-12 … 2027-07-19, median
   *  2027-05-21 (1.5: median 2027-01-10; probe scripts/v2/_cal2x/hire.ts). ≤ 10% needs ΔF ≥ 0.75, about R16's F_SOFT 0.8
   *  at Agent-3-mini (the WS5 probe's 1.2). */
  hireSlope: 1.2,
  /** Youth (22–25) employment relaxes toward the hire rate with this time constant (years) [D]. */
  youthTau: 2,
  /** Canaries: exposed 22–25-year-olds −13% vs counterfactual in 2025 (−19% by Aug 2026). [V, R16 N2a] */
  youthRel0: 0.87,
  /** US youth (22–25) unemployment base (%) [D]. */
  youthU0: 8.0,
  /** Firm AI use ≈ 1 − exp(−k·A) (a readout, nothing else reads it). CAL2-X refit with bassFit: k 10 → 19 puts the US
   *  employment-weighted readout at 19.8% on 3 May 2026 (Census BTOS, current use, new question; census.gov story
   *  2026-05 "ai-use-businesses") on the fitted Bass path (RefBot classic, seed 2027). Its sector shape is a stand-in:
   *  SOFT reads ≈ 66% vs BTOS Information 39.7%, FIN ≈ 41% vs Finance 33.9% (BUILD-NOTES CAL2-X). */
  firmK: 19,
  /** CAL2-X: one factor on every sector's Bass p and q (research/16 §1A table values [D], never fitted; "Bick et al.: use
   *  Bass p, q"), fitted to the measured firm-adoption growth: Census BTOS current AI use 17.3% (14 Dec 2025) → 19.8%
   *  (3 May 2026), ×1.42 a year (census.gov story 2026-05, Figure 1; research/22 §7: ×1.2–1.4). On the reference path
   *  (RefBot classic, seed 2027) R16's values grew the readout ×2.4 a year over the same window; 0.33 gives ×1.37–1.43
   *  (the range over the readout's k). Once-fitted [fit]. */
  bassFit: 0.33,
  /** CAL3-A: Mansfield's profitability slope of the imitation rate, a = 0.53 per year per unit of π (Mansfield 1961,
   *  12 innovations in 4 industries; restated in Mansfield 1965 eq. 14: 1/g = Z_i + 0.121·π − ≈0.006·S, g the years from
   *  10% to 90% of firms, × ln 81 for the logistic rate) [P]. */
  mansfieldA: 0.53,
  /** CAL3-A: where AI adoption sits on Mansfield's π scale at the start. Stand-in: the middle of the range in his sample
   *  figure (railroads, π 1.3–2.0); no measurement of AI's payout ratio exists. */
  mansfieldPiRef: 1.65,
};


/** Pre-LLM reference profile (late 2022) for the hiring baseline ΔF; R16 Agent-0 profile minus ~2 levels [D]. */
export const PRE_LLM_LEVEL = 3;
/** R16 §1 Agent-0 profile (mid 2025), used for start values before the first tick. [R16 table] */
export const AGENT0_PROFILE: Record<DomainId, number> = { CODE: 5, RSCH: 4.5, REASON: 5, AGENCY: 4, SOCIAL: 5, MEDIA: 5, CYBER: 4, BIO: 5, PHYS: 1 };

/** B3: measured US worker-survey anchors for a sector's hours of AI use (display only; no mechanism reads them).
 *  Bick, Blandin & Deming, Real-Time Population Survey (RPS), research/22 §1: share of all work-hours with AI
 *  assistance in the survey's industry or occupation group, and hours saved where reported. The industry rows map onto
 *  the game's sectors as the A2a `use` constants do (information → Software, Media; professional/scientific/technical →
 *  Legal, Science; finance and insurance → Finance; production occupations → Manufacturing; leisure → Retail &
 *  services). Q2 2026 rows came via FRED search excerpts [R]. */
export interface UseAnchor { group: string; when: string; hours: number; saved?: number; tag: 'P' | 'R' }
export const USE_ANCHORS: Partial<Record<SectorId, UseAnchor>> = {
  SOFT: { group: 'Information', when: 'Aug–Nov 2024', hours: 0.14, saved: 0.026, tag: 'P' },
  MEDIA: { group: 'Information', when: 'Aug–Nov 2024', hours: 0.14, saved: 0.026, tag: 'P' },
  LEGAL: { group: 'Professional, scientific, technical', when: 'Q2 2026', hours: 0.114, tag: 'R' },
  SCI: { group: 'Professional, scientific, technical', when: 'Q2 2026', hours: 0.114, tag: 'R' },
  FIN: { group: 'Finance and insurance', when: 'Q2 2026', hours: 0.097, tag: 'R' },
  MFG: { group: 'Production occupations', when: 'Q2 2026', hours: 0.046, tag: 'R' },
  SERV: { group: 'Leisure and hospitality', when: 'Aug–Nov 2024', hours: 0.023, saved: 0.006, tag: 'P' },
};
/** All US workers (RPS Q2 2026): 39.2% use AI at work, 6.3% of work-hours with AI, 2.2% saved (0.35 per hour of use). */
export const USE_ANCHOR_US = { when: 'Q2 2026', workers: 0.392, hours: 0.063, saved: 0.022, savedPerHour: 0.35 } as const;
export const USE_ANCHOR_SRC = 'Bick, Blandin & Deming, Real-Time Population Survey (research/22 §1)';
