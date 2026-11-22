// One engine day for previews that run the mechanism on a copy (RD-B18, SYNTHESIS theme V). core/loop.ts registers its
// tick here, so action modules can run a day without importing the loop (the loop imports the action registry).
import type { GameStateV2 } from '../types';

let dayFn: ((s: GameStateV2) => void) | undefined;
/** core/loop.ts: the tick a preview runs (endings skipped: a preview day never ends the game). */
export const registerPreviewTick = (f: (s: GameStateV2) => void) => {
  dayFn = f;
};
/** Run one engine day on `copy` (a copy the caller owns; never the live state). */
export function previewTick(copy: GameStateV2): void {
  if (!dayFn) throw new Error('previewTick: the engine loop is not loaded');
  dayFn(copy);
}
