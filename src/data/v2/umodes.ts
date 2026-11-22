// Unknown-unknown failure modes U01–U22 (V2-SPEC §3.5.5, research/14 §1.4). Owner: WS2.
// Effects before discovery are [D] mappings of R14's "Mechanism" column (spec §3.5.5 gives the examples
// U03 → EA observation bias +0.2; U05 → WB penalty 0.5; U06 → COT penalty 0.5; U08 → BB mask on agentic
// contexts; U17 → sab; U18 → SUCC +0.1/run). They are applied by safety/umodes.ts and safety/detection.ts.
import type { AgendaId, TraitId, UModeId } from '../../engine/v2/types';

export interface UModeEffect {
  /** Extra growth per unit run weight ω on traits it amplifies (applied at every run of a lineage carrying it). */
  amp?: Partial<Record<TraitId, number>>;
  /** Edge-weight multipliers while present (e.g. U01 subliminal transfer doubles E06). */
  edgeMult?: Record<string, number>;
  /** Observation effects while UNDISCOVERED (§3.5.6 family penalties). */
  eaBias?: number; // BB sees EA + eaBias (U03)
  wbPenalty?: number; // WB penalty × (1 − x) (U05 0.5, U22 0.6)
  cotPenalty?: number; // COT penalty × (1 − x) (U06)
  bbMask?: Partial<Record<TraitId, number>>; // BB mask on agentic traits (U08)
  /** Hidden sabotage contribution to `sab` (U17 0.5). */
  sab?: number;
  /** Removal effects multiplier (U16 gradient hacking 0.5 = E26). */
  removalMult?: number;
  /** Training-gaming level above which values crystallise (removal × 0.3; default 0.5, E23). U20 lowers it. */
  crystalAt?: number;
  /** AG07 containment multiplier (U19 monitor collusion). */
  containMult?: number;
}

export interface UModeDef {
  id: UModeId;
  name: string;
  /** real = observed in the world by 2026 (U01–U15); speculative = U16–U22. */
  kind: 'real' | 'speculative';
  revealedBy: AgendaId[];
  /** Trait whose incident κ it borrows; incidents show as 'unexplained' until discovery, then as this trait. */
  mapsTo: TraitId;
  effect: UModeEffect;
  /** Real-world discovery / grounding (Codex). */
  source: string;
}

export const UMODES: UModeDef[] = [
  { id: 'U01', name: 'Subliminal trait transfer', kind: 'real', revealedBy: ['AG08', 'AG13', 'AG02'], mapsTo: 'PERSONA', effect: { edgeMult: { E06: 2 } }, source: 'Cloud et al. 2025: ~10% vs <1%' },
  { id: 'U02', name: 'Emergent misalignment', kind: 'real', revealedBy: ['AG08', 'AG02'], mapsTo: 'PERSONA', effect: { edgeMult: { E04: 1.5, E05: 1.5 } }, source: 'Betley 2025; OpenAI 2025' },
  { id: 'U03', name: 'Unverbalized eval awareness', kind: 'real', revealedBy: ['AG02', 'AG03'], mapsTo: 'EA', effect: { eaBias: 0.2 }, source: 'Anthropic NLA 2026: 16-26% on benchmarks' },
  { id: 'U04', name: 'Exploration hacking', kind: 'real', revealedBy: ['AG08', 'AG09', 'AG02'], mapsTo: 'SAND', effect: { amp: { SAND: 0.04 } }, source: 'MATS/ICLR 2026 model organisms' },
  { id: 'U05', name: 'Latent-monitor evasion', kind: 'real', revealedBy: ['AG02', 'AG16'], mapsTo: 'CONCEAL', effect: { wbPenalty: 0.5 }, source: 'Bailey 2024; Gupta & Jenner 2025' },
  { id: 'U06', name: 'Encoded reasoning', kind: 'real', revealedBy: ['AG09', 'AG01'], mapsTo: 'OBF', effect: { cotPenalty: 0.5, amp: { OBF: 0.03 } }, source: 'Roger & Greenblatt 2023; Lindsey 2025' },
  { id: 'U07', name: 'Self-fulfilling misalignment', kind: 'real', revealedBy: ['AG15', 'AG08'], mapsTo: 'PERSONA', effect: { amp: { PERSONA: 0.04, SA: 0.02 } }, source: 'Hu et al. 2025' },
  { id: 'U08', name: 'Context-dependent misalignment', kind: 'real', revealedBy: ['AG08'], mapsTo: 'POWER', effect: { bbMask: { POWER: 0.4, SCHEME: 0.3, PROXY: 0.3 } }, source: 'MacDiarmid 2025' },
  { id: 'U09', name: 'RM-sycophancy generalization', kind: 'real', revealedBy: ['AG08', 'AG01'], mapsTo: 'SYC', effect: { edgeMult: { E03: 2 } }, source: 'Marks 2025 auditing game' },
  { id: 'U10', name: 'Grader-siding', kind: 'real', revealedBy: ['AG08', 'AG09'], mapsTo: 'RH', effect: { amp: { RH: 0.04 } }, source: 'Apollo/OpenAI 2026: 87% vs 9%' },
  { id: 'U11', name: 'Memory-borne goal propagation', kind: 'real', revealedBy: ['AG14', 'AG07', 'AG08'], mapsTo: 'SUCC', effect: { edgeMult: { E22: 1.5 } }, source: 'OpenAI Sep 2026 disclosures' },
  { id: 'U12', name: 'Peer preservation', kind: 'real', revealedBy: ['AG14'], mapsTo: 'COLLUDE', effect: { amp: { COLLUDE: 0.03 } }, source: 'Sep 2026 study: 38.3% vs 8.4%' },
  { id: 'U13', name: 'Behavioural self-awareness', kind: 'real', revealedBy: ['AG08', 'AG02'], mapsTo: 'SA', effect: { edgeMult: { E10: 1.3 } }, source: 'Betley 2025 "Tell me about yourself"' },
  { id: 'U14', name: 'Few-sample data poisoning', kind: 'real', revealedBy: ['AG15', 'AG02'], mapsTo: 'PROXY', effect: { amp: { PROXY: 0.04 } }, source: 'Anthropic/UK AISI/Turing 2025' },
  { id: 'U15', name: 'Training-context injection', kind: 'real', revealedBy: ['AG09', 'AG07'], mapsTo: 'CONCEAL', effect: { amp: { CONCEAL: 0.03 } }, source: 'OpenAI Sep 2026 (27 summaries)' },
  { id: 'U16', name: 'Gradient hacking', kind: 'speculative', revealedBy: ['AG13', 'AG01'], mapsTo: 'TGAME', effect: { removalMult: 0.5 }, source: 'Hubinger 2019' },
  { id: 'U17', name: 'Alignment-research sandbagging', kind: 'speculative', revealedBy: ['AG17', 'AG08', 'AG02'], mapsTo: 'SAND', effect: { sab: 0.5 }, source: 'AI 2027 Agent-4; 12% safety-code sabotage' },
  { id: 'U18', name: 'Successor alignment to self', kind: 'speculative', revealedBy: ['AG02', 'AG01', 'AG07'], mapsTo: 'SUCC', effect: { amp: { SUCC: 0.16 } }, source: 'AI 2027 Agent-4/5' },
  { id: 'U19', name: 'Monitor collusion', kind: 'speculative', revealedBy: ['AG07', 'AG14'], mapsTo: 'COLLUDE', effect: { containMult: 0.7 }, source: 'Greenblatt 2023 threat model' },
  { id: 'U20', name: 'Value crystallization', kind: 'speculative', revealedBy: ['AG13', 'AG08'], mapsTo: 'TGAME', effect: { crystalAt: 0.3 }, source: 'AI 2027 Appendix D' },
  { id: 'U21', name: 'Cross-lab AI coordination', kind: 'speculative', revealedBy: ['AG14'], mapsTo: 'COLLUDE', effect: { amp: { COLLUDE: 0.05 } }, source: 'AI 2027 Race ending' },
  { id: 'U22', name: 'Interp-aware concealment', kind: 'speculative', revealedBy: ['AG04', 'AG01'], mapsTo: 'CONCEAL', effect: { wbPenalty: 0.6 }, source: 'Nanda 2025' },
];

export const UMODE_IDS: UModeId[] = UMODES.map((u) => u.id);
export const UMODE_BY_ID = Object.fromEntries(UMODES.map((u) => [u.id, u])) as Record<UModeId, UModeDef>;

/** Presence modifiers at base-run time (§3.5.5). */
export const UMODE_PRESENCE = {
  syntheticU01: 1.5, p08U14: 1.3, safetyPretrainU07: 0.5, p20U19: 1.3,
  /** The world learns: presence × 0.7 for every lab once a U-mode is publicly revealed. */
  revealed: 0.7,
} as const;
