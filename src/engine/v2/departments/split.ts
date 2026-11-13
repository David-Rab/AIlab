// Compute split across pools (V2-SPEC §3.4.2). Owner: WS1.
import { SHARE_REF } from '../../../data/v2/calibration';
import type { ComputeSplit } from '../types';

export const SPLIT_KEYS: (keyof ComputeSplit)[] = ['training', 'experiments', 'agents', 'synthetic', 'serving', 'safety', 'security'];

/** Reference shares at a decimal year (linear interpolation, held constant outside the table). */
export function shareRefAt(year: number): ComputeSplit {
  const t = SHARE_REF;
  if (year <= t[0].year) return { ...t[0].share };
  for (let i = 0; i < t.length - 1; i++) {
    if (year <= t[i + 1].year) {
      const f = (year - t[i].year) / (t[i + 1].year - t[i].year);
      const out = {} as ComputeSplit;
      for (const k of SPLIT_KEYS) out[k] = t[i].share[k] + f * (t[i + 1].share[k] - t[i].share[k]);
      return out;
    }
  }
  return { ...t[t.length - 1].share };
}

/** Normalise to sum 1 (negative entries clamp to 0). */
export function normalizeSplit(sp: ComputeSplit): ComputeSplit {
  const out = {} as ComputeSplit;
  let sum = 0;
  for (const k of SPLIT_KEYS) sum += Math.max(0, sp[k]);
  for (const k of SPLIT_KEYS) out[k] = sum > 0 ? Math.max(0, sp[k]) / sum : 1 / SPLIT_KEYS.length;
  return out;
}

/** One-click presets (§3.4.2). TODO(WS1, M1): Race/Balanced/Safety values. */
export const SPLIT_PRESETS = ['reference', 'race', 'balanced', 'safety'] as const;
