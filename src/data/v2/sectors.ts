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
  /** Start task-automation share A (0..1) at Jul 2025, US. [fit] to Census BTOS firm use (research/16 §6, N2a). */
  A0: number;
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
  { id: 'SOFT', name: 'Software and IT', empPct: 3, wage: 1.9, tasks: { CODE: 0.55, REASON: 0.2, AGENCY: 0.15, SOCIAL: 0.1 }, theta: 0, R0: 0.05, p: 0.1, q: 2.0, alphaMax: 0.85, eta: 0.8, A0: 0.04, floor: 0.03, remote: true, youthExposed: true, econWeight: 1, robotBias: 0 },
  { id: 'OFFICE', name: 'Admin, clerical, customer service', empPct: 12, wage: 0.8, tasks: { REASON: 0.35, SOCIAL: 0.35, MEDIA: 0.1, AGENCY: 0.2 }, theta: 0, R0: 0.1, p: 0.06, q: 1.4, alphaMax: 0.9, eta: 0.1, A0: 0.025, floor: 0.03, remote: true, youthExposed: true, econWeight: 1, robotBias: 0 },
  { id: 'FIN', name: 'Finance, insurance, accounting', empPct: 6, wage: 1.6, tasks: { REASON: 0.55, CODE: 0.1, SOCIAL: 0.2, AGENCY: 0.15 }, theta: 0.3, R0: 0.25, p: 0.05, q: 1.2, alphaMax: 0.8, eta: 0.3, A0: 0.022, floor: 0.03, remote: true, youthExposed: false, econWeight: 1.5, robotBias: 0 },
  { id: 'LEGAL', name: 'Legal and compliance', empPct: 1, wage: 1.8, tasks: { REASON: 0.6, SOCIAL: 0.25, AGENCY: 0.15 }, theta: 0.5, R0: 0.4, p: 0.04, q: 1.0, alphaMax: 0.7, eta: 0.4, A0: 0.016, floor: 0.05, remote: true, youthExposed: false, econWeight: 1, robotBias: 0 },
  { id: 'MEDIA', name: 'Creative, media, marketing', empPct: 2, wage: 1.2, tasks: { MEDIA: 0.5, SOCIAL: 0.25, REASON: 0.25 }, theta: 0, R0: 0.1, p: 0.08, q: 1.6, alphaMax: 0.75, eta: 0.6, A0: 0.035, floor: 0.05, remote: true, youthExposed: false, econWeight: 1, robotBias: 0 },
  { id: 'SCI', name: 'Science and engineering R&D', empPct: 3, wage: 1.7, tasks: { REASON: 0.5, CODE: 0.2, AGENCY: 0.1, PHYS: 0.2 }, theta: 0.5, R0: 0.15, p: 0.06, q: 1.4, alphaMax: 0.7, eta: 1.0, A0: 0.015, floor: 0.05, remote: false, youthExposed: false, econWeight: 1, robotBias: 1 },
  { id: 'HEALTH', name: 'Healthcare', empPct: 13, wage: 1.1, tasks: { REASON: 0.3, SOCIAL: 0.25, PHYS: 0.45 }, theta: 1.5, R0: 0.55, p: 0.03, q: 0.8, alphaMax: 0.6, eta: 0.6, A0: 0.003, floor: 0.1, remote: false, youthExposed: false, econWeight: 1, robotBias: 0.5 },
  { id: 'EDU', name: 'Education', empPct: 9, wage: 0.9, tasks: { SOCIAL: 0.45, REASON: 0.35, MEDIA: 0.2 }, theta: 0.5, R0: 0.45, p: 0.04, q: 0.9, alphaMax: 0.5, eta: 0.3, A0: 0.013, floor: 0.1, remote: false, youthExposed: false, econWeight: 0, robotBias: 0 },
  { id: 'GOV', name: 'Government administration', empPct: 6, wage: 1.0, tasks: { REASON: 0.45, SOCIAL: 0.3, AGENCY: 0.25 }, theta: 0.5, R0: 0.5, p: 0.03, q: 0.8, alphaMax: 0.7, eta: 0.1, A0: 0.01, floor: 0.1, remote: false, youthExposed: false, econWeight: 0, robotBias: 0 },
  { id: 'MIL', name: 'Military and defense industry', empPct: 2, wage: 1.1, tasks: { REASON: 0.25, CYBER: 0.15, AGENCY: 0.2, PHYS: 0.4 }, theta: 1.0, R0: 0.4, p: 0.03, q: 1.0, alphaMax: 0.6, eta: 0.2, A0: 0.003, floor: 0.1, remote: false, youthExposed: false, econWeight: 0, robotBias: 1 },
  { id: 'MFG', name: 'Manufacturing', empPct: 8, wage: 1.0, tasks: { PHYS: 0.7, REASON: 0.15, CODE: 0.15 }, theta: 0.5, R0: 0.15, p: 0.04, q: 1.0, alphaMax: 0.9, eta: 0.3, A0: 0.003, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 4 },
  { id: 'LOG', name: 'Transport, logistics, warehousing', empPct: 6, wage: 0.9, tasks: { PHYS: 0.75, REASON: 0.15, AGENCY: 0.1 }, theta: 1.0, R0: 0.4, p: 0.03, q: 0.9, alphaMax: 0.9, eta: 0.2, A0: 0.001, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 1.5 },
  { id: 'ENGY', name: 'Energy, utilities, construction', empPct: 7, wage: 1.1, tasks: { PHYS: 0.75, REASON: 0.15, AGENCY: 0.1 }, theta: 1.0, R0: 0.35, p: 0.02, q: 0.8, alphaMax: 0.8, eta: 0.5, A0: 0.001, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 1 },
  { id: 'SERV', name: 'Retail, hospitality, personal services', empPct: 22, wage: 0.6, tasks: { PHYS: 0.55, SOCIAL: 0.35, REASON: 0.1 }, theta: 0.5, R0: 0.15, p: 0.03, q: 0.8, alphaMax: 0.8, eta: 0.1, A0: 0.003, floor: 0.03, remote: false, youthExposed: false, econWeight: 1, robotBias: 0.5 },
];

export const SECTOR_IDS: SectorId[] = SECTORS.map((s) => s.id);
export const SECTOR_BY_ID = Object.fromEntries(SECTORS.map((s) => [s.id, s])) as Record<SectorId, SectorDef>;
export const REGIONS: RegionId[] = ['US', 'CN', 'ROW'];

/** US employment base (persons): ≈159M nonfarm payroll + 1.24M active-duty military (BLS CES Oct 2026, DMDC). [V] */
export const US_EMPLOYMENT = 160e6;

/** Region scales relative to the US (§3.11.3): ROW wage × 0.5, employment × 6 [spec]; CN ≈ 740M employed at
 *  0.3 × US wage [D]. `A0` scales start adoption; `R` scales friction (CN state steering, EU AI Act in ROW) [D]. */
export const REGION_SCALE: Record<RegionId, { emp: number; wage: number; A0: number; R: number }> = {
  US: { emp: 1, wage: 1, A0: 1, R: 1 },
  CN: { emp: 4.6, wage: 0.3, A0: 0.6, R: 0.85 },
  ROW: { emp: 6, wage: 0.5, A0: 0.6, R: 1.1 },
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
  /** Price capture: AI revenue per automated human-hour = θ·wage·W0·price (§3.11.3, θ = 0.15 [fit]). */
  thetaPrice: 0.26,
  /** Effective AI cost per human-hour at L 5, as a share of W0, incl. review overhead (GDPval: 1.63× cheaper
   *  once review is counted, research/16 N2a). Halves per +1.5 levels [D]. */
  costShare5: 0.6,
  costHalvingLevels: 1.5,
  /** g_aug: productivity gain on augmented work (field RCT range 0.14–0.4). [R16] */
  gAug: 0.3,
  /** Feasibility logistic σ((Le − fMid − θ)/fSpread). R16 writes 8 and 1.2, but those constants give F_SOFT 0.18
   *  (Agent-1) and 0.64 (Agent-3-mini) against R16's own stated calibration of ≈0.25 and ≈0.8 (F_OFFICE ≈0.5).
   *  [fit] to the stated anchors: 7.35 / 1.1 → 0.26, 0.76, F_OFFICE 0.59. */
  fMid: 7.35, fSpread: 1.1,
  /** Cost gate logistic spread. [R16] */
  kSpread: 0.7,
  /** Natural quits ≈ 1.5%/month absorb employment declines before layoffs. [R16] */
  attritionPerMonth: 0.015,
  /** Labor share LS0 (BLS nonfarm business), supervision residual ψ. [R16 §1A.2 step 10] */
  LS0: 0.56, psi: 0.1,
  /** Income Gini (Census money income). [R16 §4.4] */
  gini0: 0.48,
  /** Hiring index: HireRate = 1 − slope·ΔF vs the pre-LLM (late-2022) feasibility. R16 writes 1.5 [D]; 1.2 [fit] puts
   *  "hiring of programmers nearly stopped" in mid-2027 on the reference path (§7.3). */
  hireSlope: 1.2,
  /** Youth (22–25) employment relaxes toward the hire rate with this time constant (years) [D]. */
  youthTau: 2,
  /** Canaries: exposed 22–25-year-olds −13% vs counterfactual in 2025 (−19% by Aug 2026). [V, R16 N2a] */
  youthRel0: 0.87,
  /** US youth (22–25) unemployment base (%) [D]. */
  youthU0: 8.0,
  /** Firm AI use ≈ 1 − exp(−k·A): Census BTOS Information 39.7%, Finance 33.9% (Dec 2025–May 2026) [V; fit k]. */
  firmK: 10,
};

/** Consumer market: ConsumerSpend = 6·(L/5)²·regions $B/yr (§3.11.3 [fit]); US + ROW (CN is served at home). */
export const CONSUMER = { base: 6, regions: { US: 1, CN: 0, ROW: 1 } as Record<RegionId, number> };

/** Pre-LLM reference profile (late 2022) for the hiring baseline ΔF; R16 Agent-0 profile minus ~2 levels [D]. */
export const PRE_LLM_LEVEL = 3;
/** R16 §1 Agent-0 profile (mid 2025), used for start values before the first tick. [R16 table] */
export const AGENT0_PROFILE: Record<DomainId, number> = { CODE: 5, RSCH: 4.5, REASON: 5, AGENCY: 4, SOCIAL: 5, MEDIA: 5, CYBER: 4, BIO: 5, PHYS: 1 };
