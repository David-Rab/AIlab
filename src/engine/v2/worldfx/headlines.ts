// Headlines H1–H32 (V2-SPEC §3.11.4; research/16 §5). Owner: WS5.
import type { GameStateV2 } from '../types';

export interface HeadlineDef { id: string; cooldownDays?: number; severity: 1 | 3; when(s: GameStateV2): boolean; text(s: GameStateV2): string }

export const HEADLINES: HeadlineDef[] = [];
