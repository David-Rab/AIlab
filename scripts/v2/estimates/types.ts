import { bandOf, rowOf, type Target as Row } from '../calreport/types';

/** One back-of-envelope estimate (scripts/v2/estimates.ts): a calibration-report row plus the chain it was computed by
 *  and whether it is absurd (a code bug, not calibration). */
export interface Estimate extends Row {
  /** The engine functions called, in order (e.g. "refGAt(2027) → h50Of → doubling time"). */
  chain: string;
  /** Non-finite, or more than ×10 outside the registry band: fails the run. */
  absurd: boolean;
}

/**
 * The only way an estimates module makes a row. Band, unit and source come from the registry entry `id`
 * (balance/targets.ts), exactly as in the calibration report (`rowOf`); `measured` is the estimate (a number, or a
 * boolean for a target with no numeric band). `chain` names the engine functions called: estimates call the engine,
 * they never copy its maths.
 */
export function estOf(id: string, value: string, measured: number | boolean, chain: string, suffix?: string): Estimate {
  const row = rowOf(id, value, measured, suffix);
  let absurd = false;
  if (typeof measured === 'number') {
    const v = bandOf(id) ?? {};
    const lo = v.lo ?? v.p50;
    const hi = v.hi ?? v.p50;
    if (!Number.isFinite(measured)) absurd = true;
    else if (lo !== undefined && lo > 0 && measured < lo / 10) absurd = true;
    else if (hi !== undefined && hi > 0 && measured > hi * 10) absurd = true;
  }
  return { ...row, chain, absurd };
}
