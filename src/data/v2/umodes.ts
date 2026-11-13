// Unknown-unknown failure modes U01–U22 (V2-SPEC §3.5.5, research/14 §1.4). Owner: WS2.
import type { AgendaId, TraitId, UModeId } from '../../engine/v2/types';

export interface UModeDef {
  id: UModeId;
  name: string;
  /** real = observed in the world by 2026 (U01–U15); speculative = U16–U22. */
  kind: 'real' | 'speculative';
  revealedBy: AgendaId[];
  /** Trait whose incident κ it borrows / amplifies. TODO(WS2): full effect mapping. */
  mapsTo?: TraitId;
}

export const UMODES: UModeDef[] = [
  { id: 'U01', name: 'Subliminal trait transfer', kind: 'real', revealedBy: ['AG08', 'AG13', 'AG02'], mapsTo: 'PERSONA' },
  { id: 'U02', name: 'Emergent misalignment', kind: 'real', revealedBy: ['AG08', 'AG02'], mapsTo: 'PERSONA' },
  { id: 'U03', name: 'Unverbalized eval awareness', kind: 'real', revealedBy: ['AG02', 'AG03'], mapsTo: 'EA' },
  { id: 'U04', name: 'Exploration hacking', kind: 'real', revealedBy: ['AG08', 'AG09', 'AG02'], mapsTo: 'SAND' },
  { id: 'U05', name: 'Latent-monitor evasion', kind: 'real', revealedBy: ['AG02', 'AG16'], mapsTo: 'CONCEAL' },
  { id: 'U06', name: 'Encoded reasoning', kind: 'real', revealedBy: ['AG09', 'AG01'], mapsTo: 'OBF' },
  { id: 'U07', name: 'Self-fulfilling misalignment', kind: 'real', revealedBy: ['AG15', 'AG08'], mapsTo: 'PERSONA' },
  { id: 'U08', name: 'Context-dependent misalignment', kind: 'real', revealedBy: ['AG08'], mapsTo: 'POWER' },
  { id: 'U09', name: 'RM-sycophancy generalization', kind: 'real', revealedBy: ['AG08', 'AG01'], mapsTo: 'SYC' },
  { id: 'U10', name: 'Grader-siding', kind: 'real', revealedBy: ['AG08', 'AG09'], mapsTo: 'RH' },
  { id: 'U11', name: 'Memory-borne goal propagation', kind: 'real', revealedBy: ['AG14', 'AG07', 'AG08'], mapsTo: 'SUCC' },
  { id: 'U12', name: 'Peer preservation', kind: 'real', revealedBy: ['AG14'], mapsTo: 'COLLUDE' },
  { id: 'U13', name: 'Behavioural self-awareness', kind: 'real', revealedBy: ['AG08', 'AG02'], mapsTo: 'SA' },
  { id: 'U14', name: 'Few-sample data poisoning', kind: 'real', revealedBy: ['AG15', 'AG02'], mapsTo: 'PROXY' },
  { id: 'U15', name: 'Training-context injection', kind: 'real', revealedBy: ['AG09', 'AG07'], mapsTo: 'CONCEAL' },
  { id: 'U16', name: 'Gradient hacking', kind: 'speculative', revealedBy: ['AG13', 'AG01'], mapsTo: 'TGAME' },
  { id: 'U17', name: 'Alignment-research sandbagging', kind: 'speculative', revealedBy: ['AG17', 'AG08', 'AG02'], mapsTo: 'SAND' },
  { id: 'U18', name: 'Successor alignment to self', kind: 'speculative', revealedBy: ['AG02', 'AG01', 'AG07'], mapsTo: 'SUCC' },
  { id: 'U19', name: 'Monitor collusion', kind: 'speculative', revealedBy: ['AG07', 'AG14'], mapsTo: 'COLLUDE' },
  { id: 'U20', name: 'Value crystallization', kind: 'speculative', revealedBy: ['AG13', 'AG08'], mapsTo: 'TGAME' },
  { id: 'U21', name: 'Cross-lab AI coordination', kind: 'speculative', revealedBy: ['AG14'], mapsTo: 'COLLUDE' },
  { id: 'U22', name: 'Interp-aware concealment', kind: 'speculative', revealedBy: ['AG04', 'AG01'], mapsTo: 'CONCEAL' },
];

export const UMODE_IDS: UModeId[] = UMODES.map((u) => u.id);
