// Detection / mitigation techniques (V2-SPEC §3.5.6). Each belongs to one agenda and one tool family. Owner: WS2.
// TODO(WS2, M1): transcribe techniques from research/14; newGame copies `startUnlocked` ones into player.safety.techniques.
import type { AgendaId, ToolFamily, TraitId } from '../../engine/v2/types';

export interface TechniqueDef {
  id: string;
  agenda: AgendaId;
  family: ToolFamily;
  name: string;
  s0: number;
  coverage: Partial<Record<TraitId, number>>;
  startUnlocked?: boolean;
}

export const TECHNIQUES: TechniqueDef[] = [];
