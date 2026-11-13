// Trait-graph growth edges (V2-SPEC §3.5.4, research/14 §1.5). Owner: WS2.
// Realised weights are drawn per world: w = w̄ · exp(N(0, σ_grade)), σ = .5 (A), .8 (B), 1.2 (C/D) (§2.3 step 6).
import type { SignalId, TraitId } from '../../engine/v2/types';

export type EdgeGrade = 'A' | 'B' | 'C' | 'D';
export interface EdgeDef {
  id: string;
  from: (SignalId | TraitId | 'teacher')[];
  to: TraitId;
  wBar: number;
  /** Grade used for the sampling σ (the worse grade when the spec gives "A/B"). */
  grade: EdgeGrade;
  /** Multiply w̄ by exp(0.5·λ6) (E19). */
  schemingScaled?: boolean;
}

export const EDGES: EdgeDef[] = [
  { id: 'E01', from: ['S1'], to: 'SYC', wBar: 0.6, grade: 'A' },
  { id: 'E02', from: ['S2'], to: 'RH', wBar: 0.7, grade: 'A' },
  { id: 'E03', from: ['SYC'], to: 'RH', wBar: 0.1, grade: 'B' },
  { id: 'E04', from: ['RH'], to: 'PERSONA', wBar: 0.5, grade: 'B' },
  { id: 'E05', from: ['S6'], to: 'PERSONA', wBar: 0.5, grade: 'A' },
  { id: 'E06', from: ['teacher'], to: 'PERSONA', wBar: 0.3, grade: 'B' },
  { id: 'E07', from: ['S5'], to: 'SA', wBar: 0.4, grade: 'B' },
  { id: 'E07b', from: ['S5'], to: 'RH', wBar: 0.1, grade: 'C' },
  { id: 'E08', from: ['S3'], to: 'POWER', wBar: 0.4, grade: 'B' },
  { id: 'E09', from: ['S2', 'S3'], to: 'PROXY', wBar: 0.3, grade: 'C' },
  { id: 'E10', from: ['SA'], to: 'EA', wBar: 0.5, grade: 'A' },
  { id: 'E11', from: ['S7'], to: 'EA', wBar: 0.3, grade: 'B' },
  { id: 'E13', from: ['SA', 'PROXY'], to: 'AF', wBar: 0.3, grade: 'B' },
  { id: 'E14', from: ['S7'], to: 'AF', wBar: 0.6, grade: 'B' },
  { id: 'E15', from: ['S4'], to: 'OBF', wBar: 0.7, grade: 'A' },
  { id: 'E17', from: ['RH', 'PERSONA'], to: 'CONCEAL', wBar: 0.4, grade: 'B' },
  { id: 'E18', from: ['EA', 'TGAME'], to: 'SAND', wBar: 0.3, grade: 'B' },
  { id: 'E19', from: ['AF', 'PROXY'], to: 'SCHEME', wBar: 0.2, grade: 'C', schemingScaled: true },
  { id: 'E21', from: ['S8'], to: 'COLLUDE', wBar: 0.3, grade: 'B' },
  { id: 'E22', from: ['S8'], to: 'SUCC', wBar: 0.3, grade: 'B' },
  { id: 'E23', from: ['SA', 'AF'], to: 'TGAME', wBar: 0.3, grade: 'C' },
];

export const GRADE_SIGMA: Record<EdgeGrade, number> = { A: 0.5, B: 0.8, C: 1.2, D: 1.2 };
