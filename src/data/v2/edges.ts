// Trait-graph growth edges (V2-SPEC §3.5.4, research/14 §1.5). Owner: WS2.
// Realised weights are drawn per world: w = w̄ · exp(N(0, σ_grade)), σ = .5 (A), .8 (B), 1.2 (C/D) (§2.3 step 6).
// w̄ and grades are R14 [D] values anchored to the cited evidence. Drivers and moderators: safety/traits.ts.
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
  /** Added in M4: its world draw comes after §2.3 step 10, so every earlier draw keeps its value. */
  late?: boolean;
  /** One-line evidence citation shown in the trait panel (research/14 §1.5). */
  cite: string;
  /** Moderators the player controls (applied in safety/traits.ts). */
  moderator?: string;
}

export const EDGES: EdgeDef[] = [
  { id: 'E01', from: ['S1'], to: 'SYC', wBar: 0.6, grade: 'A', cite: 'Sharma 2023; GPT-4o rollback Apr 2025', moderator: 'sycophancy eval gate −30%' },
  { id: 'E02', from: ['S2'], to: 'RH', wBar: 0.7, grade: 'A', cite: 'METR 2025: o3 hacks 1-2%, ~30% on RE-Bench', moderator: 'hardened graders (in S2)' },
  { id: 'E03', from: ['SYC'], to: 'RH', wBar: 0.1, grade: 'B', cite: 'Denison 2024: rare reward tampering' },
  { id: 'E04', from: ['RH'], to: 'PERSONA', wBar: 0.5, grade: 'B', cite: 'MacDiarmid 2025: 12% sabotage, 50% AF reasoning', moderator: 'inoculation ×0.15; persona vectors ×0.7' },
  { id: 'E05', from: ['S6'], to: 'PERSONA', wBar: 0.5, grade: 'A', cite: 'Betley 2025: ~20% (GPT-4o), ~50% (GPT-4.1)', moderator: 'persona vectors ×0.7' },
  { id: 'E06', from: ['teacher'], to: 'PERSONA', wBar: 0.3, grade: 'B', cite: 'Cloud 2025: ~10% vs <1%', moderator: 'same base family only' },
  { id: 'E07', from: ['S5'], to: 'SA', wBar: 0.4, grade: 'B', cite: 'Berglund 2023; Laine 2024 SAD', moderator: 'AI-discourse curation lowers S5' },
  { id: 'E07b', from: ['S5'], to: 'RH', wBar: 0.1, grade: 'C', cite: 'Hu et al. 2025' },
  { id: 'E08', from: ['S3'], to: 'POWER', wBar: 0.4, grade: 'B', cite: 'Agentic misalignment 80-96% (contrived); 14/20 OpenAI incidents from RL', moderator: 'scoped constitution −30%; corrigibility target −30%' },
  { id: 'E09', from: ['S2', 'S3'], to: 'PROXY', wBar: 0.3, grade: 'C', cite: 'Langosco 2022; Shah 2022', moderator: 'broad RL −30%' },
  { id: 'E10', from: ['SA'], to: 'EA', wBar: 0.5, grade: 'A', cite: 'Verbalized EA 11.7% → 41-51%', moderator: 'realistic honeypots −30%' },
  { id: 'E11', from: ['S7'], to: 'EA', wBar: 0.3, grade: 'B', cite: 'Anti-scheming doubled EA 2.3 → 4.5%', moderator: 'keep evals out of training' },
  { id: 'E13', from: ['SA', 'PROXY'], to: 'AF', wBar: 0.3, grade: 'B', cite: 'Greenblatt 2024: 12% → 78% after RL', moderator: 'corrigibility target −30%' },
  { id: 'E14', from: ['S7'], to: 'AF', wBar: 0.6, grade: 'B', cite: 'MATS/GDM Oct 2026: gap 43-95%', moderator: 'randomised monitoring −50%' },
  { id: 'E15', from: ['S4'], to: 'OBF', wBar: 0.7, grade: 'A', cite: 'Baker 2025; controllability 1.7 → 60.9%', moderator: 'monitorability pledge −50%' },
  { id: 'E17', from: ['RH', 'PERSONA'], to: 'CONCEAL', wBar: 0.4, grade: 'B', cite: 'Hacks verbalized <2%; false completion 29%', moderator: 'honesty & confession training −40%' },
  { id: 'E18', from: ['EA', 'TGAME'], to: 'SAND', wBar: 0.3, grade: 'B', cite: 'Apollo 2024 in-context sandbagging', moderator: 'noise injection −40%' },
  { id: 'E19', from: ['AF', 'PROXY'], to: 'SCHEME', wBar: 0.2, grade: 'C', schemingScaled: true, cite: 'Apollo 2024: ~1% unnudged; o3 covert 13%', moderator: 'anti-scheming training −90%' },
  { id: 'E21', from: ['S8'], to: 'COLLUDE', wBar: 0.3, grade: 'B', cite: 'Peer-shutdown sabotage 38.3% vs 8.4%', moderator: 'comms lockdown −50%' },
  { id: 'E22', from: ['S8'], to: 'SUCC', wBar: 0.3, grade: 'B', cite: 'OpenAI Sep 2026: self-propagating 58%', moderator: 'memory audits −50%' },
  { id: 'E23', from: ['SA', 'AF'], to: 'TGAME', wBar: 0.3, grade: 'C', cite: 'AI 2027 App. D (argument)', moderator: 'TGAME > 0.5: removal ×0.3' },
  // M4: the broad misaligned persona (L5) generalises into the behaviour-when-unobserved nodes (R14 E04 evidence:
  // hacking → persona → alignment-faking reasoning and safety-research sabotage), so reward hacking upstream (grader
  // quality, RL intensity, inoculation) reaches the misalignment index.
  { id: 'E27', from: ['PERSONA'], to: 'AF', wBar: 0.4, grade: 'B', late: true, cite: 'MacDiarmid 2025: learned hacking → AF reasoning in 50%', moderator: 'inoculation upstream (E04 ×0.15); corrigibility target −30%' },
  { id: 'E28', from: ['PERSONA'], to: 'SCHEME', wBar: 0.15, grade: 'B', late: true, cite: 'MacDiarmid 2025: 12% safety-code sabotage', moderator: 'anti-scheming training −90%' },
  { id: 'E29', from: ['PERSONA'], to: 'POWER', wBar: 0.2, grade: 'B', late: true, cite: 'Betley 2025: emergent misalignment voices power-seeking aims', moderator: 'scoped constitution −30%; corrigibility target −30%' },
];

export const GRADE_SIGMA: Record<EdgeGrade, number> = { A: 0.5, B: 0.8, C: 1.2, D: 1.2 };
/** M4 [D]: the world draw uses half of R14's σ and keeps the factor within [½, 2]×w̄, so the world modulates edge
 *  strength without deciding the outcome (choices must dominate final misalignment, §1.2 T1). */
export const EDGE_SIGMA_SCALE = 0.5;
export const EDGE_FACTOR_RANGE: [number, number] = [0.5, 2];

/** Edges that are not growth terms (§3.5.4), shown in the trait panel as notes. */
export const EDGE_NOTES: { id: string; text: string; grade: EdgeGrade }[] = [
  { id: 'E12', text: 'Eval awareness → observation gap: observed = true × (1 − 0.8·EA) on behavioural evals', grade: 'A' },
  { id: 'E16', text: 'Obfuscation + training against a probe → white-box evasion (Goodhart G)', grade: 'B' },
  { id: 'E20', text: 'Scheming + assigned to alignment R&D → sabotage of safety work', grade: 'C' },
  { id: 'E24', text: 'Retrain against a detector → mask: visible falls 70-90%, true 20-40%', grade: 'A' },
  { id: 'E25', text: 'Anti-scheming training → scheming −90%, eval awareness ×1.5', grade: 'A' },
  { id: 'E26', text: 'Gradient hacking (only if present): removal effects × 0.5', grade: 'D' },
];

export const EDGE_BY_ID = Object.fromEntries(EDGES.map((e) => [e.id, e])) as Record<string, EdgeDef>;
