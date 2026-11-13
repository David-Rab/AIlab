// Interest blocs (V2-SPEC §3.10.2; research/08 §1.16). Owner: WS4.
// TODO(WS4): agendas (policy id → weight −3..+3) per bloc from research/08 Part 1.
import type { BlocId } from '../../engine/v2/types';

export interface BlocDef { id: BlocId; name: string; clout: number; cloutNov26: number; approval: number; agenda: Record<string, number> }

export const BLOCS: BlocDef[] = [
  { id: 'safety', name: 'Safety Advocates', clout: 30, cloutNov26: 40, approval: 10, agenda: {} },
  { id: 'pause', name: 'Pause / Stop', clout: 5, cloutNov26: 10, approval: -60, agenda: {} },
  { id: 'accel', name: 'Accelerationists', clout: 70, cloutNov26: 58, approval: 30, agenda: {} },
  { id: 'bigtech', name: 'Big Tech & Hyperscalers', clout: 75, cloutNov26: 70, approval: 10, agenda: {} },
  { id: 'chip', name: 'Chip & Export Lobby', clout: 55, cloutNov26: 60, approval: 20, agenda: {} },
  { id: 'hawks', name: 'China Hawks', clout: 60, cloutNov26: 60, approval: 10, agenda: {} },
  { id: 'defense', name: 'Defense-Industrial', clout: 45, cloutNov26: 55, approval: 0, agenda: {} },
  { id: 'populist', name: 'Populist Right & Faith', clout: 35, cloutNov26: 45, approval: -20, agenda: {} },
  { id: 'progressive', name: 'Progressive Critics', clout: 30, cloutNov26: 45, approval: -30, agenda: {} },
  { id: 'labor', name: 'Organized Labor', clout: 40, cloutNov26: 48, approval: -20, agenda: {} },
  { id: 'civlib', name: 'Civil Liberties', clout: 25, cloutNov26: 28, approval: 0, agenda: {} },
  { id: 'parents', name: 'Child Safety & Parents', clout: 45, cloutNov26: 55, approval: -10, agenda: {} },
  { id: 'creatives', name: 'Creatives & Copyright', clout: 40, cloutNov26: 42, approval: -30, agenda: {} },
  { id: 'ratepayers', name: 'Ratepayers / Anti-DC', clout: 20, cloutNov26: 50, approval: -10, agenda: {} },
  { id: 'measurers', name: 'Science & Evaluation', clout: 35, cloutNov26: 35, approval: 10, agenda: {} },
];

export const BLOC_IDS: BlocId[] = BLOCS.map((b) => b.id);
