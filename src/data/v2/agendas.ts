// Safety research agendas AG01–AG18 (V2-SPEC §3.5.2, research/14 §1.2). Owner: WS2.
// Every numeric parameter is a research/14 [D] value (R14 states there is no expert survey of per-agenda credences);
// FTE and compute ranges are R14's "serious programme at one frontier lab" columns, `fteRef` is their midpoint.
import type { AgendaId, Column, SafetyLatents, ToolFamily, TraitId } from '../../engine/v2/types';

export type AgendaFamily = ToolFamily | 'fix' | 'contain' | 'meta' | 'BB+';

export interface AgendaDef {
  id: AgendaId;
  name: string;
  /** Beta(a, b) prior on efficacy e. */
  prior: [number, number];
  /** Latent loadings: e = clamp(Beta + Σ load·λ, 0, 1). Magnitudes [D] (M2: spread × 0.75 for S1): ++ .15, + .09,
   *  weak .045, λ6 adversary −.09. */
  loadings: Partial<Record<keyof SafetyLatents, number>>;
  /** Months to the first expected result at serious staffing (R8: the effort of every project on the line). */
  T1: number;
  /** Capability robustness: strength halves at M = mHalf (Infinity encoded as 1e9); k = slope. */
  mHalf: number;
  k: number;
  /** Goodhart susceptibility G. */
  G: number;
  /** Automation factor (how much AI labour speeds the line's projects). */
  auto: number;
  family: AgendaFamily;
  coverage: TraitId[];
  /** Serious-level FTE midpoint (R14 §1.2 cost column). */
  fteRef: number;
  /** R14 FTE range for a serious programme. */
  fteRange: [number, number];
  /** R14 compute range as a fraction of the lab's total compute; `computeRef` is the midpoint (C_ref). */
  computeRange: [number, number];
  computeRef: number;
  /** Latent the agenda's tools mainly rest on: tools sharing it are correlated evidence (§3.5.6, R14 §1.6B). */
  mainLatent: keyof SafetyLatents | 'none';
  /** Tree column of the line's follow-up project (the column most of its nodes sit in). */
  column: Column;
}

const INF = 1e9;
const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

type Row = Omit<AgendaDef, 'fteRef' | 'computeRef' | 'column'>;
const ROWS: Row[] = [
  { id: 'AG01', name: 'Ambitious mech interp', prior: [1.5, 4], loadings: { legibility: 0.09 }, T1: 9, mHalf: 2000, k: 0.5, G: 0.5, auto: 0.6, family: 'WB', coverage: ['SCHEME', 'AF', 'SUCC'], fteRange: [40, 80], computeRange: [0.03, 0.08], mainLatent: 'legibility' },
  { id: 'AG02', name: 'Applied interp', prior: [3, 3], loadings: { legibility: 0.09 }, T1: 4, mHalf: 250, k: 0.7, G: 0.8, auto: 0.9, family: 'WB', coverage: ['EA', 'TGAME', 'AF', 'SCHEME'], fteRange: [15, 30], computeRange: [0.01, 0.03], mainLatent: 'legibility' },
  { id: 'AG03', name: 'RepE / steering', prior: [2.5, 3], loadings: { legibility: 0.09 }, T1: 4, mHalf: 250, k: 0.7, G: 0.6, auto: 0.9, family: 'WB', coverage: ['SYC', 'PERSONA', 'EA'], fteRange: [8, 15], computeRange: [0.005, 0.01], mainLatent: 'legibility' },
  { id: 'AG04', name: 'Heuristic args / ELK', prior: [1, 6], loadings: { legibility: 0.045, formalizability: 0.15 }, T1: 24, mHalf: INF, k: 0, G: 0.1, auto: 0.5, family: 'OR', coverage: ['SCHEME', 'AF'], fteRange: [5, 15], computeRange: [0.001, 0.003], mainLatent: 'formalizability' },
  { id: 'AG05', name: 'Scalable oversight', prior: [2, 4], loadings: { cotLoadBearing: 0.09, verificationAdvantage: 0.15, schemingDefault: -0.09 }, T1: 9, mHalf: 250, k: 1, G: 0.3, auto: 0.6, family: 'BB+', coverage: ['SYC', 'RH', 'CONCEAL', 'PROXY'], fteRange: [15, 30], computeRange: [0.03, 0.1], mainLatent: 'verificationAdvantage' },
  { id: 'AG06', name: 'Weak-to-strong', prior: [2, 4], loadings: { verificationAdvantage: 0.09, benignGeneralization: 0.09, schemingDefault: -0.09 }, T1: 6, mHalf: 25, k: 1, G: 0.2, auto: 0.8, family: 'fix', coverage: ['SYC', 'PROXY'], fteRange: [5, 15], computeRange: [0.01, 0.03], mainLatent: 'verificationAdvantage' },
  { id: 'AG07', name: 'AI control', prior: [4, 2.5], loadings: { cotLoadBearing: 0.09 }, T1: 3, mHalf: 30, k: 2, G: 0.2, auto: 1.0, family: 'contain', coverage: ['SCHEME', 'POWER', 'COLLUDE'], fteRange: [10, 25], computeRange: [0.01, 0.05], mainLatent: 'cotLoadBearing' },
  { id: 'AG08', name: 'Model organisms & evals', prior: [4, 2], loadings: { verificationAdvantage: 0.09, schemingDefault: -0.09 }, T1: 3, mHalf: 25, k: 1, G: 0.5, auto: 1.0, family: 'BB', coverage: ['RH', 'EA', 'AF', 'SCHEME', 'SAND', 'POWER'], fteRange: [15, 40], computeRange: [0.01, 0.03], mainLatent: 'verificationAdvantage' },
  { id: 'AG09', name: 'CoT monitorability', prior: [3.5, 2.5], loadings: { cotLoadBearing: 0.15 }, T1: 3, mHalf: 250, k: 1, G: 0.9, auto: 0.9, family: 'COT', coverage: ['RH', 'CONCEAL', 'AF', 'SAND', 'SCHEME'], fteRange: [5, 15], computeRange: [0.004, 0.006], mainLatent: 'cotLoadBearing' },
  { id: 'AG10', name: 'Guaranteed-safe AI', prior: [1, 5], loadings: { formalizability: 0.15 }, T1: 18, mHalf: INF, k: 0, G: 0, auto: 0.8, family: 'OR', coverage: [], fteRange: [20, 60], computeRange: [0.008, 0.012], mainLatent: 'formalizability' },
  { id: 'AG11', name: 'Scientist AI guardrail', prior: [1.5, 5], loadings: { formalizability: 0.09 }, T1: 18, mHalf: 250, k: 0.5, G: 0.2, auto: 0.6, family: 'OR', coverage: ['POWER'], fteRange: [15, 30], computeRange: [0.02, 0.05], mainLatent: 'formalizability' },
  { id: 'AG12', name: 'Agent foundations', prior: [1, 8], loadings: {}, T1: 36, mHalf: INF, k: 0, G: 0, auto: 0.2, family: 'fix', coverage: ['CORRIG'], fteRange: [3, 10], computeRange: [0, 0.002], mainLatent: 'none' },
  { id: 'AG13', name: 'Dev interp / SLT', prior: [1.5, 5], loadings: { legibility: 0.09, benignGeneralization: 0.09 }, T1: 12, mHalf: 250, k: 0.5, G: 0.3, auto: 0.6, family: 'WB', coverage: ['TGAME', 'AF'], fteRange: [5, 12], computeRange: [0.005, 0.01], mainLatent: 'legibility' },
  { id: 'AG14', name: 'Cooperative AI', prior: [2, 4], loadings: {}, T1: 9, mHalf: 250, k: 1, G: 0.4, auto: 0.7, family: 'BB', coverage: ['COLLUDE', 'SUCC'], fteRange: [5, 15], computeRange: [0.004, 0.006], mainLatent: 'none' },
  { id: 'AG15', name: 'Unlearning & curation', prior: [3, 3], loadings: { benignGeneralization: 0.09 }, T1: 6, mHalf: 250, k: 0.7, G: 0.2, auto: 0.9, family: 'fix', coverage: [], fteRange: [5, 15], computeRange: [0.01, 0.03], mainLatent: 'benignGeneralization' },
  { id: 'AG16', name: 'Adversarial robustness', prior: [3, 3], loadings: {}, T1: 3, mHalf: 250, k: 1, G: 0, auto: 1.0, family: 'fix', coverage: [], fteRange: [10, 25], computeRange: [0.02, 0.05], mainLatent: 'none' },
  // AG17 "5-15 FTE plus lots of compute (OpenAI pledged 20%)": compute ref [D] 5-15%.
  { id: 'AG17', name: 'Automated alignment research', prior: [3, 3], loadings: { verificationAdvantage: 0.15, schemingDefault: -0.09 }, T1: 3, mHalf: 250, k: 1, G: 0, auto: 1.0, family: 'meta', coverage: [], fteRange: [5, 15], computeRange: [0.05, 0.15], mainLatent: 'verificationAdvantage' },
  { id: 'AG18', name: 'Training-signal design', prior: [3.5, 3], loadings: { benignGeneralization: 0.15 }, T1: 3, mHalf: 25, k: 1, G: 0.5, auto: 1.0, family: 'fix', coverage: ['SYC', 'RH', 'PERSONA', 'CONCEAL', 'SCHEME'], fteRange: [15, 40], computeRange: [0.02, 0.1], mainLatent: 'benignGeneralization' },
];

/** Column of each line's follow-up project (TECH-TREE §2.4–2.6: where its nodes sit). */
const LINE_COLUMN: Record<AgendaId, Column> = {
  AG01: 'interp', AG02: 'interp', AG03: 'interp', AG04: 'evals', AG05: 'evals', AG06: 'alignment', AG07: 'evals', AG08: 'evals', AG09: 'evals',
  AG10: 'evals', AG11: 'evals', AG12: 'alignment', AG13: 'interp', AG14: 'evals', AG15: 'alignment', AG16: 'evals', AG17: 'evals', AG18: 'alignment',
};

export const AGENDAS: AgendaDef[] = ROWS.map((r) => ({
  ...r,
  fteRef: mid(r.fteRange),
  computeRef: Math.max(0.0005, mid(r.computeRange)),
  column: LINE_COLUMN[r.id],
}));

export const AGENDA_IDS: AgendaId[] = AGENDAS.map((a) => a.id);
export const AGENDA_BY_ID = Object.fromEntries(AGENDAS.map((a) => [a.id, a])) as Record<AgendaId, AgendaDef>;
/** Research lines are tree projects for safety science teams (R8, STRUCTURE §4.5): a project's result is one finding.
 *  Model v3 E1: the project runs stages (below; safety/lineProjects.ts) whose ideation rate is (capacity ÷
 *  SERIOUS_CAP)^λ × taste, so a line staffed at "serious" capacity (with its engineers and compute) gets its first result
 *  after T₁ months, the pre-R8 hazard's expected time at Serious funding (pre-E1: progress/day = √(capacity ÷
 *  SERIOUS_CAP) / (30·T₁) × compute^0.3 × AI labour). SERIOUS_CAP is a serious programme's capacity in standard science
 *  teams (heads/40 × quality × 1.5 in the team's specialty) [calibration: RefBot keeps one team on each of its four
 *  lines, ≈ its pre-R8 Seed funding (a quarter of serious): a non-matching Strong team is 0.25, a matching one 0.375].
 *  6 (a matching team exactly at Seed) left the mixed bot unable to keep up before SAR (S5); 2–3 made RefBot's
 *  understanding hold at SAR (S5). */
export const SERIOUS_CAP = 4;
// ───────────────────────────── line projects on the project mechanism (model v3 E1) ─────────────────────────────
// MODEL-V3 §11.7 / §5.3: a line project's stages are ideation (safety scientists with taste), small experiments and a
// validation on the frontier model (safety research engineers with experiment compute from the safety pool, the
// project-level experiment CES of capability projects). Reference inputs (rate 1 in every stage): a serious programme
// (science capacity SERIOUS_CAP, a Strong team's taste), SAF_RE_UNIT research engineers and the agenda's reference
// compute share (computeRef) of the leader lab's day-0 compute; there the first result arrives after T₁ months, the
// pre-E1 pacing (research/14 §1.2–1.3). Above or below it every stage speeds up or slows down with its own inputs.

/** Shares of T₁ each stage takes at reference inputs (they sum to 1, so the first result takes T₁) [D: ideation is the
 *  shortest step of a safety project; validation on the frontier model the longest]. */
export const SAF_STAGES = { idea: 0.2, small: 0.35, val: 0.45 } as const;
/** Safety research-engineer heads (× quality) that make one unit of experiment labour (ℓ = 1) on a line project: a
 *  serious programme's engineers [D, calibration]; a project asks for engineers in proportion to its science staffing (×
 *  capacity ÷ SERIOUS_CAP, at most LINE_MULT_MAX). */
export const SAF_RE_UNIT = 50;
/** Share of the free safety research engineers (after investigations and patches) experiments may take by default, so
 *  tool upkeep keeps the rest (as capability experiments ≤ 75% leave routine tuning some) [D, calibration]. */
export const SAF_EXP_SHARE = 0.5;
/** Compute reference: the leader lab's day-0 compute (H100e); a line's experiment FLOP per day at its reference share of
 *  it is one unit (c = 1) [D, fixed physical unit as capability's C_UNIT: never the calendar]. */
export const SAF_C0_H100E = 1e6;
/** A line project tests its first candidate as soon as it has one; scientists keep ideating up to this many waiting
 *  [D]. */
export const SAF_PICK_AT = 1;
export const SAF_POOL_MAX = 2;
/** Belief noise (sd on the chance of a working result): the scientists' reading ÷ taste, then the small-experiment and
 *  validation readings [D; MODEL-V3 §5.3 "better taste = lower noise"]. The team starts from the line's posterior. */
export const SAF_BELIEF = { idea: 0.3, small: 0.3, val: 0.25 } as const;

/** Cap on the line multiplier (capacity ÷ SERIOUS_CAP) where the pre-R8 code read funding (AG18 healing): the old Major
 *  level. */
export const LINE_MULT_MAX = 2.5;

/** Validation lead (STRUCTURE §4.5: from safety research engineers, not funding): free safety research engineers per
 *  research line with tools in the stack at which tools are validated as far ahead as a pre-R8 Serious agenda (VAL_LEAD
 *  levels) [calibration: the start lab's one team of 100 over four lines ≈ Seed]. */
export const RE_SERIOUS = 100;

/** Tool upkeep (R8, TECH-TREE "tool upkeep without chores"): safety research engineers not on investigations or patches
 *  re-validate tools on the current models. A tool whose strength factor D(M) on the internal model has fallen below
 *  UPKEEP_D needs upkeep; the free engineers are shared among those tools, and each one's M½ doubles every
 *  UPKEEP_DAYS ÷ min(UPKEEP_MAX, (engineers per tool − UPKEEP_MIN) ÷ UPKEEP_REF) days: re-validating a tool takes a
 *  crew, so engineers spread thinner than UPKEEP_MIN per fading tool re-validate nothing. Upkeep stops once a tool holds
 *  again on today's model, so M½ follows capability; there is no ceiling (pre-R8: refresh projects capped at ×8) [D;
 *  calibration: the start lab's single team keeps nothing up once several tools fade (S5 "RefBot falls behind"), five
 *  teams keep up (S5 mixed)]. */
export const UPKEEP_D = 0.8;
export const UPKEEP_DAYS = 90;
export const UPKEEP_MIN = 15;
export const UPKEEP_REF = 40;
export const UPKEEP_MAX = 1.5;

/** AG09 under latent reasoning (R14 §1.2: "250 / 1 legible → 5 / 2 neuralese"). */
export const AG09_LATENT = { mHalf: 5, k: 2 };
/** AG05 overseer gap (R14 §1.6A): success ≈ 0.52^gap, gap = log4(M_model / M_overseer). M_overseer [D] = 5. */
export const AG05_GAP = { base: 0.52, overseerM: 5 };
/** Measured level of the safety agent model needed to fund AG17, automated alignment research (§3.5.2). */
export const AG17_MIN_L = 10;
/** Tool verifiability for investigation corruption (§3.5.8). */
export const VERIFIABILITY: Record<ToolFamily, number> = { WB: 0.7, OR: 0.9, BB: 0.5, COT: 0.6 };
