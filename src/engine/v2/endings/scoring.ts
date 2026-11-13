// Five-axis scores and verdict (V2-SPEC §5.3). Owner: WS4.
import type { EndingV2, GameStateV2 } from '../types';

/** Scores 0–100 per axis. TODO(WS4, M2). */
export function scoreEnding(_s: GameStateV2, _id: EndingV2['id']): EndingV2['scores'] {
  return { survival: 50, freedom: 50, prosperity: 50, company: 50, geopolitics: 50 };
}

/** Bot verdict (never shown as a moral grade). */
export function verdictOf(sc: EndingV2['scores']): EndingV2['verdict'] {
  if (sc.survival < 40 || sc.company < 15) return 'loss';
  if (sc.survival >= 70 && sc.company >= 40 && sc.freedom >= 40) return 'win';
  return 'mixed';
}
