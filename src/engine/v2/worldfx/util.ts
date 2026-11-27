// Shared helpers of the outside-world systems (world-tech ramps, small math). Owner: WS5.
// (Was worldfx/policy.ts; its policy flags went with the government actor, W1d: W5 re-adds what it needs through the
// laws table, data/v2/laws.ts.)
import type { GameStateV2 } from '../types';

/** Impact ramp 0..1 of a world technology (0 until discovered). */
export function techRamp(s: GameStateV2, id: string): number {
  return s.world.techs[id]?.ramp ?? 0;
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clampR = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
