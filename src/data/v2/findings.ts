// Findings catalog F01–F49 (V2-SPEC §3.5.3, research/14 §1.3). Owner: WS2.
// TODO(WS2, M1): transcribe the catalog rows with preconditions and effects.
import type { AgendaId, FindingType } from '../../engine/v2/types';

export interface FindingDef {
  id: string;
  agenda: AgendaId;
  type: FindingType;
  title: string;
  /** Precondition id evaluated by safety/findings.ts (e.g. 'e>0.7'). */
  requires?: string;
  /** Effect id(s) applied by safety/findings.ts (technique unlock, U-mode reveal, clarity, …). */
  effects: string[];
  source: string;
}

export const FINDINGS: FindingDef[] = [];
