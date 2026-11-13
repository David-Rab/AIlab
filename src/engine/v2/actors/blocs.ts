// Interest blocs: pressure, coalitions (V2-SPEC §3.10.2; research/08). Owner: WS4.
import { BLOCS } from '../../../data/v2/blocs';
import type { BlocId, BlocState } from '../types';

export function initialBlocs(): Record<BlocId, BlocState> {
  const out = {} as Record<BlocId, BlocState>;
  for (const b of BLOCS) out[b.id] = { clout: b.clout, mobilization: 20, approval: b.approval, capturedExposure: 0 };
  return out;
}

/** Pressure of a bloc on policy weight w: clout·(0.3 + 0.7·mob/100)·w. */
export function blocPressure(b: BlocState, weight: number): number {
  return b.clout * (0.3 + 0.7 * b.mobilization / 100) * weight;
}
