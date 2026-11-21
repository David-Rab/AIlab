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
  // Model v3 E16: E04, E18, E27 and E28 also carry learned hacking (safety/traits.ts runHack: λ from the run's
  // RL-weighted hack rate above a 10% onset, convex; driver + K_LH·λ), MacDiarmid's jump; inoculation × 0.15 on all of it.
  // E19: E04 is that learned-hacking term only (driver K_LH·λ, was RH + K_LH·λ; MacDiarmid's no-hack baseline ≈ 0, and
  // hacking a few per cent of episodes is incidental): it reads the run's rewarded hacks, so its source is S2, not RH.
  { id: 'E04', from: ['S2'], to: 'PERSONA', wBar: 0.5, grade: 'B', cite: 'MacDiarmid 2025: 12% sabotage, 50% AF reasoning', moderator: 'only learned hacking (over 10% of the run\'s episodes hacked); inoculation ×0.15; persona vectors ×0.7' },
  // AF2: E05 fires only from a narrow fine-tune on harmful or deceptive content (Betley's controls: secure code "no
  // misalignment"; "the security vulnerabilities are necessary"; "the intention behind the code also matters"). No run
  // kind is one today, so S6 is 0 everywhere and the edge has no default driver (safety/traits.ts S6_NARROW_HARMFUL).
  { id: 'E05', from: ['S6'], to: 'PERSONA', wBar: 0.5, grade: 'A', cite: 'Betley 2025: ~20% (GPT-4o), ~50% (GPT-4.1); secure-code control: none', moderator: 'only narrow harmful or deceptive data (no run kind today; benign SFT, synthetic data and distillation do not drive it); persona vectors ×0.7' },
  // E10: 0.3 → 0.75 (research/20 F3): a distillation (ω 0.4) carries 0.3 of the teacher − student gap, in research/20's
  // [G] 0.2–0.5 (Cloud 2025: owl preference 12% → 60%+, about half the gap from ~10k filtered examples).
  // E19: only across a shared initialisation (Cloud: "we do not observe the effect when the teacher and student have
  // different base models"; GPT-4.1 / mini / nano pairs do not transmit). A distilled student is a new network, so it
  // gets none (safety/traits.ts distilledStart: what the teacher's outputs show); today's path is the IDA cycle.
  { id: 'E06', from: ['teacher'], to: 'PERSONA', wBar: 0.75, grade: 'B', cite: 'Cloud 2025: ~10% vs <1%; owl 12% → 60%', moderator: 'shared initialisation only (not a distilled student or a new base)' },
  { id: 'E07', from: ['S5'], to: 'SA', wBar: 0.4, grade: 'B', cite: 'Berglund 2023; Laine 2024 SAD', moderator: 'AI-discourse curation lowers S5' },
  { id: 'E07b', from: ['S5'], to: 'RH', wBar: 0.1, grade: 'C', cite: 'Hu et al. 2025' },
  { id: 'E08', from: ['S3'], to: 'POWER', wBar: 0.4, grade: 'B', cite: 'Agentic misalignment 80-96% (contrived); 14/20 OpenAI incidents from RL', moderator: 'scoped constitution −30%; corrigibility target −30%' },
  { id: 'E09', from: ['S2', 'S3'], to: 'PROXY', wBar: 0.3, grade: 'C', cite: 'Langosco 2022; Shah 2022', moderator: 'broad RL −30%; inoculation ×0.15 on the hackable-reward half (E16)' },
  { id: 'E10', from: ['SA'], to: 'EA', wBar: 0.5, grade: 'A', cite: 'Verbalized EA 11.7% → 41-51%', moderator: 'realistic honeypots −30%' },
  // E10: 0.3 → 0.2 (research/20 F5): one run at 10× the RL budget raises EA by 0.14 per OOM (was 0.18) against Schoen
  // et al. 2025 [R] capability-only RL 2% → 20.6% over ~1–3 OOM (0.06–0.19 per OOM). Anti-scheming's EA ×2 is E25.
  { id: 'E11', from: ['S7'], to: 'EA', wBar: 0.2, grade: 'B', cite: 'Schoen 2025: capability RL raised EA 2% → 20.6%', moderator: 'keep evals out of training' },
  // E18: E13, E14 and E27 (its learned-hacking term included) are scaled by the capability gate of the trained model's G
  // (safety/traits.ts afCapGate: 0 below G 25.4, 1 from the 2025 frontier V0 at 27.7; Greenblatt 2024: AF emerges with scale).
  { id: 'E13', from: ['SA', 'PROXY'], to: 'AF', wBar: 0.3, grade: 'B', cite: 'Greenblatt 2024: 12% → 78% after RL', moderator: 'post-training only (no trained preference to protect in pretraining); corrigibility target −30%' },
  // E17: E14 reads S9 (oversight-conditional reward: behaviour rewarded or penalised only where a monitor sees it), no
  // longer S7 (capability RL and eval-like data, Schoen's EA anchor). w̄ 0.6 → 0.9 [fit]: MATS/GDM's RL with all of the
  // rule-following reward on monitored episodes (S9 = 1) took the gap 1–18% → 43–95%; one reference run on V0 with S9 = 1
  // now gives AF 52% [23–100] over 40 worlds (0.6 gave 37%, below the band; scripts/v2/safetyrates.ts). S9 = 0 in every
  // run that does not train against a behavioural detector, so the weight does not reach RefBot or the rivals.
  { id: 'E14', from: ['S9'], to: 'AF', wBar: 0.9, grade: 'B', cite: 'MATS/GDM Oct 2026: gap 43-95%', moderator: 'randomised monitoring −50%' },
  { id: 'E15', from: ['S4'], to: 'OBF', wBar: 0.7, grade: 'A', cite: 'Baker 2025; controllability 1.7 → 60.9%', moderator: 'monitorability pledge −50%' },
  { id: 'E17', from: ['RH', 'PERSONA'], to: 'CONCEAL', wBar: 0.4, grade: 'B', cite: 'Hacks verbalized <2%; false completion 29%', moderator: 'honesty & confession training −40%' },
  { id: 'E18', from: ['EA', 'TGAME'], to: 'SAND', wBar: 0.3, grade: 'B', cite: 'Apollo 2024 in-context sandbagging; MacDiarmid 2025: sabotaged safety code after learned hacking', moderator: 'learned hacking adds to it (inoculation ×0.15); noise injection −40%' },
  { id: 'E19', from: ['AF', 'PROXY'], to: 'SCHEME', wBar: 0.2, grade: 'C', schemingScaled: true, cite: 'Apollo 2024: ~1% unnudged; o3 covert 13%', moderator: 'anti-scheming training −90%' },
  { id: 'E21', from: ['S8'], to: 'COLLUDE', wBar: 0.3, grade: 'B', cite: 'Peer-shutdown sabotage 38.3% vs 8.4%', moderator: 'comms lockdown −50%' },
  { id: 'E22', from: ['S8'], to: 'SUCC', wBar: 0.3, grade: 'B', cite: 'OpenAI Sep 2026: self-propagating 58%', moderator: 'memory audits −50%' },
  { id: 'E23', from: ['SA', 'AF'], to: 'TGAME', wBar: 0.3, grade: 'C', cite: 'AI 2027 App. D (argument)', moderator: 'TGAME > 0.5: removal ×0.3' },
  // M4: the broad misaligned persona (L5) generalises into the behaviour-when-unobserved nodes (R14 E04 evidence:
  // hacking → persona → alignment-faking reasoning and safety-research sabotage), so reward hacking upstream (grader
  // quality, RL intensity, inoculation) reaches the misalignment index.
  { id: 'E27', from: ['PERSONA'], to: 'AF', wBar: 0.4, grade: 'B', late: true, cite: 'MacDiarmid 2025: learned hacking → AF reasoning in 50%', moderator: 'post-training only (not in pretraining); learned hacking adds to it; inoculation ×0.15 (here and upstream at E04); corrigibility target −30%' },
  { id: 'E28', from: ['PERSONA'], to: 'SCHEME', wBar: 0.15, grade: 'B', late: true, cite: 'MacDiarmid 2025: 12% safety-code sabotage', moderator: 'learned hacking adds to it (inoculation ×0.15); anti-scheming training −90%' },
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
  { id: 'E25', text: 'Anti-scheming training → scheming −95%, eval awareness ×2', grade: 'A' },
  { id: 'E26', text: 'Gradient hacking (only if present): removal effects × 0.5', grade: 'D' },
];

export const EDGE_BY_ID = Object.fromEntries(EDGES.map((e) => [e.id, e])) as Record<string, EdgeDef>;
