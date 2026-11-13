// Safety research agendas AG01–AG18 (V2-SPEC §3.5.2, research/14 §1.2). Owner: WS2.
// M0 (WS1): transcribed the spec table so hidden sampling (§2.3 step 4) works. WS2 extends with costs/FTE refs.
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
  /** Serious-level FTE midpoint (R14). TODO(WS2): transcribe from research/14 §1.2. */
  fteRef: number;
}

const INF = 1e9;

export const AGENDAS: AgendaDef[] = [
  { id: 'AG01', name: 'Ambitious mech interp', prior: [1.5, 4], loadings: { legibility: 0.12 }, T1: 9, mHalf: 2000, k: 0.5, G: 0.5, auto: 0.6, family: 'WB', coverage: ['SCHEME', 'AF', 'SUCC'], fteRef: 40 },
  { id: 'AG02', name: 'Applied interp', prior: [3, 3], loadings: { legibility: 0.12 }, T1: 4, mHalf: 250, k: 0.7, G: 0.8, auto: 0.9, family: 'WB', coverage: ['EA', 'TGAME', 'AF', 'SCHEME'], fteRef: 30 },
  { id: 'AG03', name: 'RepE / steering', prior: [2.5, 3], loadings: { legibility: 0.12 }, T1: 4, mHalf: 250, k: 0.7, G: 0.6, auto: 0.9, family: 'WB', coverage: ['SYC', 'PERSONA', 'EA'], fteRef: 15 },
  { id: 'AG04', name: 'Heuristic args / ELK', prior: [1, 6], loadings: { legibility: 0.06, formalizability: 0.2 }, T1: 24, mHalf: INF, k: 0, G: 0.1, auto: 0.5, family: 'OR', coverage: ['SCHEME', 'AF'], fteRef: 15 },
  { id: 'AG05', name: 'Scalable oversight', prior: [2, 4], loadings: { cotLoadBearing: 0.12, verificationAdvantage: 0.2, schemingDefault: -0.12 }, T1: 9, mHalf: 250, k: 1, G: 0.3, auto: 0.6, family: 'BB+', coverage: ['SYC', 'RH', 'CONCEAL', 'PROXY'], fteRef: 25 },
  { id: 'AG06', name: 'Weak-to-strong', prior: [2, 4], loadings: { verificationAdvantage: 0.12, benignGeneralization: 0.12, schemingDefault: -0.12 }, T1: 6, mHalf: 25, k: 1, G: 0.2, auto: 0.8, family: 'fix', coverage: ['SYC', 'PROXY'], fteRef: 15 },
  { id: 'AG07', name: 'AI control', prior: [4, 2.5], loadings: { cotLoadBearing: 0.12 }, T1: 3, mHalf: 30, k: 2, G: 0.2, auto: 1.0, family: 'contain', coverage: ['SCHEME', 'POWER', 'COLLUDE'], fteRef: 25 },
  { id: 'AG08', name: 'Model organisms & evals', prior: [4, 2], loadings: { verificationAdvantage: 0.12, schemingDefault: -0.12 }, T1: 3, mHalf: 25, k: 1, G: 0.5, auto: 1.0, family: 'BB', coverage: ['RH', 'EA', 'AF', 'SCHEME', 'SAND', 'POWER'], fteRef: 30 },
  { id: 'AG09', name: 'CoT monitorability', prior: [3.5, 2.5], loadings: { cotLoadBearing: 0.2 }, T1: 3, mHalf: 250, k: 1, G: 0.9, auto: 0.9, family: 'COT', coverage: ['RH', 'CONCEAL', 'AF', 'SAND', 'SCHEME'], fteRef: 20 },
  { id: 'AG10', name: 'Guaranteed-safe AI', prior: [1, 5], loadings: { formalizability: 0.2 }, T1: 18, mHalf: INF, k: 0, G: 0, auto: 0.8, family: 'OR', coverage: [], fteRef: 15 },
  { id: 'AG11', name: 'Scientist AI guardrail', prior: [1.5, 5], loadings: { formalizability: 0.12 }, T1: 18, mHalf: 250, k: 0.5, G: 0.2, auto: 0.6, family: 'OR', coverage: ['POWER'], fteRef: 15 },
  { id: 'AG12', name: 'Agent foundations', prior: [1, 8], loadings: {}, T1: 36, mHalf: INF, k: 0, G: 0, auto: 0.2, family: 'fix', coverage: ['CORRIG'], fteRef: 10 },
  { id: 'AG13', name: 'Dev interp / SLT', prior: [1.5, 5], loadings: { legibility: 0.12, benignGeneralization: 0.12 }, T1: 12, mHalf: 250, k: 0.5, G: 0.3, auto: 0.6, family: 'WB', coverage: ['TGAME', 'AF'], fteRef: 10 },
  { id: 'AG14', name: 'Cooperative AI', prior: [2, 4], loadings: {}, T1: 9, mHalf: 250, k: 1, G: 0.4, auto: 0.7, family: 'BB', coverage: ['COLLUDE', 'SUCC'], fteRef: 10 },
  { id: 'AG15', name: 'Unlearning & curation', prior: [3, 3], loadings: { benignGeneralization: 0.12 }, T1: 6, mHalf: 250, k: 0.7, G: 0.2, auto: 0.9, family: 'fix', coverage: [], fteRef: 15 },
  { id: 'AG16', name: 'Adversarial robustness', prior: [3, 3], loadings: {}, T1: 3, mHalf: 250, k: 1, G: 0, auto: 1.0, family: 'fix', coverage: [], fteRef: 20 },
  { id: 'AG17', name: 'Automated alignment research', prior: [3, 3], loadings: { verificationAdvantage: 0.2, schemingDefault: -0.12 }, T1: 3, mHalf: 250, k: 1, G: 0, auto: 1.0, family: 'meta', coverage: [], fteRef: 20 },
  { id: 'AG18', name: 'Training-signal design', prior: [3.5, 3], loadings: { benignGeneralization: 0.2 }, T1: 3, mHalf: 25, k: 1, G: 0.5, auto: 1.0, family: 'fix', coverage: ['SYC', 'RH', 'PERSONA', 'CONCEAL', 'SCHEME'], fteRef: 20 },
];

export const AGENDA_IDS: AgendaId[] = AGENDAS.map((a) => a.id);
export const AGENDA_BY_ID = Object.fromEntries(AGENDAS.map((a) => [a.id, a])) as Record<AgendaId, AgendaDef>;
/** Funding levels as multiples of the serious FTE midpoint (§3.5.2). */
export const FUNDING_LEVELS = { off: 0, seed: 0.25, serious: 1, major: 2.5 } as const;
