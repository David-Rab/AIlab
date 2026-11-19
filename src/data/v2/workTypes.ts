// Work types and AI labour (model v3 V3: design/MODEL-V3.md §6, §8; design/V3-BUILD.md V3.1–V3.5 and "V3 notes"). Owner: WS1.
// Tags: [R20 xx] research/20, [R13 §x] research/13, [R19] research/19, [D] design value, [fit] fitted by the calibration
// harness (scripts/v2/calib.ts --fit-v3).
//
// A work type is a kind of work: domain weights, a typical task length, verifiability. A model's fit in a work type is
// measured in effective compute (OOM): F_w = Σ ω_w,d · G_d (engine: departments/workfit.ts). Human reference points sit on
// the same axis, per domain: the best human in the world at G_SC + δ_d·Δ_bm and the median expert Δ_bm below it.
import type { DomainId, TeamRole, WorldPresetId } from '../../engine/v2/types';

export type WorkTypeId = 'SWE' | 'EXP' | 'IDEAS' | 'SAF_EXP' | 'SAF_IDEAS' | 'OTHER';

export interface WorkTypeDef {
  id: WorkTypeId;
  name: string;
  /** Who does it in the lab (OTHER: the world's expert work, V4's sector placeholder). */
  who: TeamRole | 'world';
  /** Domain weights ω_w,d (sum 1). */
  w: Partial<Record<DomainId, number>>;
  /** Typical task length H_w (hours of a human expert's work). */
  H: number;
  /** Verifiability v_w (how cheaply output can be checked, 0..1) [R20 E3]: low verifiability raises θ_w. */
  v: number;
  /** Domain whose effective compute sets the time horizon (CODE for software, AGENCY otherwise) [V3.2]. */
  horizon: DomainId;
  /** Heads that make one team-equivalent of this work (the role's team size; scientists' capacity unit). */
  heads: number;
}

/** The work types [R20 E, R19 §1.1, MODEL-V3 §6.1; H and weights D]. */
export const WORK_TYPES: Record<WorkTypeId, WorkTypeDef> = {
  SWE: { id: 'SWE', name: 'Software engineering', who: 'eng', w: { CODE: 0.7, AGENCY: 0.3 }, H: 2, v: 0.9, horizon: 'CODE', heads: 150 },
  EXP: { id: 'EXP', name: 'Experiments & runs', who: 're', w: { CODE: 0.4, RSCH: 0.4, AGENCY: 0.2 }, H: 8, v: 0.7, horizon: 'AGENCY', heads: 100 },
  IDEAS: { id: 'IDEAS', name: 'Research ideas & taste', who: 'sci', w: { RSCH: 0.7, REASON: 0.3 }, H: 40, v: 0.3, horizon: 'AGENCY', heads: 40 },
  SAF_EXP: { id: 'SAF_EXP', name: 'Safety experiments', who: 're', w: { CODE: 0.5, RSCH: 0.5 }, H: 8, v: 0.5, horizon: 'AGENCY', heads: 100 },
  SAF_IDEAS: { id: 'SAF_IDEAS', name: 'Safety research ideas', who: 'sci', w: { RSCH: 0.7, REASON: 0.3 }, H: 80, v: 0.2, horizon: 'AGENCY', heads: 40 },
  OTHER: { id: 'OTHER', name: 'Other expert work', who: 'world', w: { SOCIAL: 0.35, BIO: 0.25, CYBER: 0.2, MEDIA: 0.2 }, H: 8, v: 0.4, horizon: 'AGENCY', heads: 1 },
};
export const WORK_TYPE_IDS = Object.keys(WORK_TYPES) as WorkTypeId[];
/** Cognitive work types (Superintelligence needs all of them). */
export const COGNITIVE_WORK: WorkTypeId[] = ['SWE', 'EXP', 'IDEAS', 'SAF_EXP', 'SAF_IDEAS', 'OTHER'];

// ───────────────────────────── human reference points (V3 notes, derivation 2) ─────────────────────────────

/** Human taste at the 99.9th percentile in SDs (AIFM TOP_RESEARCHER_SD, research/13 §1.4). */
export const TOP_SD = 3.090232306167813;
/** AI research taste at the superhuman coder (AIFM median "AI taste at AC" 0.5 SD, research/13 §2.2). */
export const SD_AT_SC = 0.5;
/** Superintelligence's extra gap for the work AI is worst at, in best-to-median gaps: AI 2027's taste at ASI (14.5 SD)
 *  over SIAR's (9.6 SD), research/13 §1.5 (AIFM ASI 12–15 SD). */
export const ASI_EXTRA_GAPS = 1.7;
/** Best human in the world per domain: G_SC + REF_DELTA[d]·Δ_bm. Coding and agency define the superhuman coder (0); the
 *  research domains sit (1 − SD_AT_SC/TOP_SD) gaps further (so taste at SC is 0.5 SD); the rest of expert work
 *  ASI_EXTRA_GAPS more. */
export const REF_DELTA: Record<DomainId, number> = (() => {
  const r = 1 - SD_AT_SC / TOP_SD;
  const o = r + ASI_EXTRA_GAPS;
  return { CODE: 0, AGENCY: 0, RSCH: r, REASON: r, SOCIAL: o, MEDIA: o, CYBER: o, BIO: o, PHYS: o };
})();
/** Level offsets (preference, paradigms, the RSCH taste penalty) convert to OOM at this rate (V2's conversion). */
export const LEVEL_PER_OOM = 1.2;

// ───────────────────────────── coverage, win rate, assist (V3.2) ─────────────────────────────

/** Coverage a_w = σ((F_w − θ_w)/s) × P(success at H_w). θ_w = F*_w − s·ln 19 + KAPPA_V·(0.9 − v_w): at the best human's
 *  fit the logistic part is 0.95 for verifiable work, lower for hard-to-verify work (R20 E3) [D]. s 0.8 OOM puts the
 *  2025 frontier's software coverage at ≈ 0.2 (Anthropic: most work "fully delegable" 0–20%; AIFM 2025.0 A = 0.10,
 *  2026.0 0.36; research/13 §2.7, §2.10) [D]. */
export const COVER = { s: 0.8, top: 0.95, kappaV: 0.5 };
/** Milestone coverage (superhuman coder / researcher) [V3.5 D]. */
export const MILESTONE_COVER = 0.9;
/** Win rate vs a median expert w = Φ((F_w − F^med_w)/S_WIN): GDPval Aug 2025 frontier ≈ 0.35–0.4 wins (R20 E2) [D]. */
export const S_WIN = 3;
/** GDPval assist economics H/(M + R + (1 − w)·H): model time M ≈ H/90 (GPT-5 "naive" 90× faster), review R ≈ 0.27·H
 *  (expert review 109 of 404 min) [R20 E2]. Humans use it only where it speeds them up (w ≳ 0.3). */
export const ASSIST = { model: 1 / 90, review: 0.27 };

// ───────────────────────────── time horizon (V3.2) ─────────────────────────────

/** METR TH1.1 50% horizon of the Aug-2025 frontier (GPT-5, 203 min), the reference start version V0's [R20 E1, H]. */
export const H50_V0_MIN = 203;
/** Horizon per OOM of effective compute (METR 4.2-month doubling at ≈ 1.2–1.4 OOM/yr; research/20 A2/E1). */
export const H50_PER_OOM = 4.2;
/** p80/p50 = 1/5 (METR TH1.1 median) ⇒ success p(t) = 1/(1 + (t/h50)^β), β = ln 4 / ln 5 [R20 E1]. */
export const H80_OVER_H50 = 1 / 5;
export const HORIZON_BETA = Math.log(4) / Math.log(5);

// ───────────────────────────── AI labour (V3.3) ─────────────────────────────

/** Peak dense BF16 FLOP/s of one H100-equivalent [R20 D1]. */
export const PEAK_FLOPS = 1e15;
/** Serving utilisation of peak: prefill 0.35, decode 0.07 (DeepSeek production, R20 D1). */
export const U_PREFILL = 0.35;
export const U_DECODE = 0.07;
/** Tokens that cost FLOP per human work-hour of agentic work: uncached input 200k and output 40k (Claude Code: an hour's
 *  agentic task ≈ 2M input tokens, 90% cache reads, and 40k output; R20 D2). Cache reads are bandwidth, not FLOP. [D] */
export const TOKENS_PER_WORK_HOUR = { input: 2e5, output: 4e4 };
/** Decode speed of one agent copy (tokens/s; DeepSeek production 20–22 user-visible, fast modes ×2.5; R20 D1) [D]. */
export const COPY_TOKENS_PER_S = 60;
/** Serial speed cap ×50 (research/13 R11 #23). */
export const SPEED_CAP = 50;
/** Hours a human FTE works per year. */
export const FTE_HOURS_PER_YEAR = 2000;
/** Human taste of a team by quality, in SDs of the lab's taste distribution (Strong = the lab's average) [D]. */
export const QUALITY_TASTE_SD = { solid: -0.5, strong: 0, elite: 1 } as const;
/** Star hires lift the lab's human taste by this factor each (STAR_HIRE.dTaste) [D]. */
export const STAR_TASTE = 0.05;

// ───────────────────────────── research in physical units (V3.4) ─────────────────────────────

/** Research-engineer team-equivalents that make one unit of experiment labour (ℓ = 1): the per-project allocation. */
export const RE_UNIT = 2;
/** Experiment FLOP per day that makes one unit of experiment compute (c = 1): the leader lab's day-0 experiment FLOP per
 *  RE_UNIT of its research engineers on experiments and tuning (1e6 H100e × 5% × 3.46e19 FLOP/H100e-day over 11 teams ×
 *  88% ÷ 2) [D, fixed physical unit: never the calendar]. */
export const C_UNIT_FLOP_PER_DAY = (1e6 * 0.05 * 3.46e19 * RE_UNIT) / (11 * 0.88);
/** Leader day-0 references for the readout ratios (h, k, c): research engineers on research (team-eq), agent compute
 *  (H100e), experiment FLOP per day. */
export const DAY0_REF = { re: 11 * 0.88, agents: 3e4, flop: 1e6 * 0.05 * 3.46e19 };

// ───────────────────────────── per-preset calibration (V3.5, V3.7) ─────────────────────────────

/** Per-preset AI Futures parameters and the two fitted values (V3 notes): G_SC, the effective compute a superhuman coder
 *  needs (OOM; the timelines model's own parameter) [fit], Δ_bm, the best-to-median human gap in OOM (AIFM's AI taste
 *  slope = 3.09/Δ_bm SD per OOM) [fit], and r, the returns to research (doublings of software efficiency per doubling of
 *  cumulative research input): AIFM golden 3.19 (authors2026), AI 2027 takeoff median ≈ 4 (ai2027, fast: its p10
 *  takeoff), Forethought 1.2 (slow) [research/13 §2.2]. `sampled` uses ai2027's. Mutable so the harness can fit them. */
export interface V3Cal { gSC: number; dBM: number; r: number }
export const V3_CAL: Record<WorldPresetId, V3Cal> = {
  ai2027: { gSC: 31.394, dBM: 1.933, r: 4 },
  authors2026: { gSC: 33.5, dBM: 3.142, r: 3.19 },
  fast: { gSC: 32.663, dBM: 0.347, r: 4 },
  slow: { gSC: 35.505, dBM: 1.6, r: 1.2 },
  sampled: { gSC: 31.394, dBM: 1.933, r: 4 },
};
