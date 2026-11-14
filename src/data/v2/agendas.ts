// Safety research agendas AG01–AG18 (V2-SPEC §3.5.2, research/14 §1.2). Owner: WS2.
// Every numeric parameter is a research/14 [D] value (R14 states there is no expert survey of per-agenda credences);
// FTE and compute ranges are R14's "serious programme at one frontier lab" columns, `fteRef` is their midpoint.
import type { AgendaId, SafetyLatents, ToolFamily, TraitId } from '../../engine/v2/types';

export type AgendaFamily = ToolFamily | 'fix' | 'contain' | 'meta' | 'BB+';

export interface AgendaDef {
  id: AgendaId;
  name: string;
  /** Beta(a, b) prior on efficacy e. */
  prior: [number, number];
  /** Latent loadings: e = clamp(Beta + Σ load·λ, 0, 1). Magnitudes [D]: ++ .20, + .12, weak .06, λ6 adversary −.12. */
  loadings: Partial<Record<keyof SafetyLatents, number>>;
  /** Months to first expected finding at serious funding. */
  T1: number;
  /** Capability robustness: strength halves at M = mHalf (Infinity encoded as 1e9); k = slope. */
  mHalf: number;
  k: number;
  /** Goodhart susceptibility G. */
  G: number;
  /** Automation factor (AI labour multiplier on finding hazard). */
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
  /** Refresh projects double M½ up to this ceiling [D] (8× the base M½). */
  mHalfCap: number;
}

const INF = 1e9;
const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

type Row = Omit<AgendaDef, 'fteRef' | 'computeRef' | 'mHalfCap'>;
const ROWS: Row[] = [
  { id: 'AG01', name: 'Ambitious mech interp', prior: [1.5, 4], loadings: { legibility: 0.12 }, T1: 9, mHalf: 2000, k: 0.5, G: 0.5, auto: 0.6, family: 'WB', coverage: ['SCHEME', 'AF', 'SUCC'], fteRange: [40, 80], computeRange: [0.03, 0.08], mainLatent: 'legibility' },
  { id: 'AG02', name: 'Applied interp', prior: [3, 3], loadings: { legibility: 0.12 }, T1: 4, mHalf: 250, k: 0.7, G: 0.8, auto: 0.9, family: 'WB', coverage: ['EA', 'TGAME', 'AF', 'SCHEME'], fteRange: [15, 30], computeRange: [0.01, 0.03], mainLatent: 'legibility' },
  { id: 'AG03', name: 'RepE / steering', prior: [2.5, 3], loadings: { legibility: 0.12 }, T1: 4, mHalf: 250, k: 0.7, G: 0.6, auto: 0.9, family: 'WB', coverage: ['SYC', 'PERSONA', 'EA'], fteRange: [8, 15], computeRange: [0.005, 0.01], mainLatent: 'legibility' },
  { id: 'AG04', name: 'Heuristic args / ELK', prior: [1, 6], loadings: { legibility: 0.06, formalizability: 0.2 }, T1: 24, mHalf: INF, k: 0, G: 0.1, auto: 0.5, family: 'OR', coverage: ['SCHEME', 'AF'], fteRange: [5, 15], computeRange: [0.001, 0.003], mainLatent: 'formalizability' },
  { id: 'AG05', name: 'Scalable oversight', prior: [2, 4], loadings: { cotLoadBearing: 0.12, verificationAdvantage: 0.2, schemingDefault: -0.12 }, T1: 9, mHalf: 250, k: 1, G: 0.3, auto: 0.6, family: 'BB+', coverage: ['SYC', 'RH', 'CONCEAL', 'PROXY'], fteRange: [15, 30], computeRange: [0.03, 0.1], mainLatent: 'verificationAdvantage' },
  { id: 'AG06', name: 'Weak-to-strong', prior: [2, 4], loadings: { verificationAdvantage: 0.12, benignGeneralization: 0.12, schemingDefault: -0.12 }, T1: 6, mHalf: 25, k: 1, G: 0.2, auto: 0.8, family: 'fix', coverage: ['SYC', 'PROXY'], fteRange: [5, 15], computeRange: [0.01, 0.03], mainLatent: 'verificationAdvantage' },
  { id: 'AG07', name: 'AI control', prior: [4, 2.5], loadings: { cotLoadBearing: 0.12 }, T1: 3, mHalf: 30, k: 2, G: 0.2, auto: 1.0, family: 'contain', coverage: ['SCHEME', 'POWER', 'COLLUDE'], fteRange: [10, 25], computeRange: [0.01, 0.05], mainLatent: 'cotLoadBearing' },
  { id: 'AG08', name: 'Model organisms & evals', prior: [4, 2], loadings: { verificationAdvantage: 0.12, schemingDefault: -0.12 }, T1: 3, mHalf: 25, k: 1, G: 0.5, auto: 1.0, family: 'BB', coverage: ['RH', 'EA', 'AF', 'SCHEME', 'SAND', 'POWER'], fteRange: [15, 40], computeRange: [0.01, 0.03], mainLatent: 'verificationAdvantage' },
  { id: 'AG09', name: 'CoT monitorability', prior: [3.5, 2.5], loadings: { cotLoadBearing: 0.2 }, T1: 3, mHalf: 250, k: 1, G: 0.9, auto: 0.9, family: 'COT', coverage: ['RH', 'CONCEAL', 'AF', 'SAND', 'SCHEME'], fteRange: [5, 15], computeRange: [0.004, 0.006], mainLatent: 'cotLoadBearing' },
  { id: 'AG10', name: 'Guaranteed-safe AI', prior: [1, 5], loadings: { formalizability: 0.2 }, T1: 18, mHalf: INF, k: 0, G: 0, auto: 0.8, family: 'OR', coverage: [], fteRange: [20, 60], computeRange: [0.008, 0.012], mainLatent: 'formalizability' },
  { id: 'AG11', name: 'Scientist AI guardrail', prior: [1.5, 5], loadings: { formalizability: 0.12 }, T1: 18, mHalf: 250, k: 0.5, G: 0.2, auto: 0.6, family: 'OR', coverage: ['POWER'], fteRange: [15, 30], computeRange: [0.02, 0.05], mainLatent: 'formalizability' },
  { id: 'AG12', name: 'Agent foundations', prior: [1, 8], loadings: {}, T1: 36, mHalf: INF, k: 0, G: 0, auto: 0.2, family: 'fix', coverage: ['CORRIG'], fteRange: [3, 10], computeRange: [0, 0.002], mainLatent: 'none' },
  { id: 'AG13', name: 'Dev interp / SLT', prior: [1.5, 5], loadings: { legibility: 0.12, benignGeneralization: 0.12 }, T1: 12, mHalf: 250, k: 0.5, G: 0.3, auto: 0.6, family: 'WB', coverage: ['TGAME', 'AF'], fteRange: [5, 12], computeRange: [0.005, 0.01], mainLatent: 'legibility' },
  { id: 'AG14', name: 'Cooperative AI', prior: [2, 4], loadings: {}, T1: 9, mHalf: 250, k: 1, G: 0.4, auto: 0.7, family: 'BB', coverage: ['COLLUDE', 'SUCC'], fteRange: [5, 15], computeRange: [0.004, 0.006], mainLatent: 'none' },
  { id: 'AG15', name: 'Unlearning & curation', prior: [3, 3], loadings: { benignGeneralization: 0.12 }, T1: 6, mHalf: 250, k: 0.7, G: 0.2, auto: 0.9, family: 'fix', coverage: [], fteRange: [5, 15], computeRange: [0.01, 0.03], mainLatent: 'benignGeneralization' },
  { id: 'AG16', name: 'Adversarial robustness', prior: [3, 3], loadings: {}, T1: 3, mHalf: 250, k: 1, G: 0, auto: 1.0, family: 'fix', coverage: [], fteRange: [10, 25], computeRange: [0.02, 0.05], mainLatent: 'none' },
  // AG17 "5-15 FTE plus lots of compute (OpenAI pledged 20%)": compute ref [D] 5-15%.
  { id: 'AG17', name: 'Automated alignment research', prior: [3, 3], loadings: { verificationAdvantage: 0.2, schemingDefault: -0.12 }, T1: 3, mHalf: 250, k: 1, G: 0, auto: 1.0, family: 'meta', coverage: [], fteRange: [5, 15], computeRange: [0.05, 0.15], mainLatent: 'verificationAdvantage' },
  { id: 'AG18', name: 'Training-signal design', prior: [3.5, 3], loadings: { benignGeneralization: 0.2 }, T1: 3, mHalf: 25, k: 1, G: 0.5, auto: 1.0, family: 'fix', coverage: ['SYC', 'RH', 'PERSONA', 'CONCEAL', 'SCHEME'], fteRange: [15, 40], computeRange: [0.02, 0.1], mainLatent: 'benignGeneralization' },
];

export const AGENDAS: AgendaDef[] = ROWS.map((r) => ({
  ...r,
  fteRef: mid(r.fteRange),
  computeRef: Math.max(0.0005, mid(r.computeRange)),
  mHalfCap: r.mHalf >= INF ? INF : r.mHalf * 8,
}));

export const AGENDA_IDS: AgendaId[] = AGENDAS.map((a) => a.id);
export const AGENDA_BY_ID = Object.fromEntries(AGENDAS.map((a) => [a.id, a])) as Record<AgendaId, AgendaDef>;
/** Funding levels as multiples of the serious FTE midpoint (§3.5.2). */
export const FUNDING_LEVELS = { off: 0, seed: 0.25, serious: 1, major: 2.5 } as const;
export type FundingLevel = keyof typeof FUNDING_LEVELS;
export const FUNDING_LEVEL_IDS = Object.keys(FUNDING_LEVELS) as FundingLevel[];

/** AG09 under latent reasoning (R14 §1.2: "250 / 1 legible → 5 / 2 neuralese"). */
export const AG09_LATENT = { mHalf: 5, k: 2 };
/** AG05 overseer gap (R14 §1.6A): success ≈ 0.52^gap, gap = log4(M_model / M_overseer). M_overseer [D] = 5. */
export const AG05_GAP = { base: 0.52, overseerM: 5 };
/** Measured level needed to fund AG17 (§3.5.2) and to automate any agenda [D]. */
export const AG17_MIN_L = 10;
export const AUTOMATE_MIN_L = 8.5;
/** Tool verifiability for investigation corruption (§3.5.8). */
export const VERIFIABILITY: Record<ToolFamily, number> = { WB: 0.7, OR: 0.9, BB: 0.5, COT: 0.6 };
