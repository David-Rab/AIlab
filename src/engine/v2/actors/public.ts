// Public opinion meters and activism ladder (V2-SPEC §3.10.2; research/07 §1.2). Owner: WS4.
import { PUBLIC_PRESETS } from '../../../data/actors';
import { BASELINES } from '../../../data/world';
import { initialBlocs } from './blocs';
import type { BaselineId, PublicActor } from '../types';

export const publicPresetOf = (id: string) => PUBLIC_PRESETS.find((p) => p.id === id) ?? PUBLIC_PRESETS[0];

/** Public at Jul 2025 (v1 BASELINES). approval −100..100; other meters 0..100; salience is a multiplier (v1). */
export function initialPublic(presetId: string, baseline: BaselineId): PublicActor {
  const b = (BASELINES.find((x) => x.id === baseline) ?? BASELINES[0]).start;
  return {
    preset: publicPresetOf(presetId).id,
    concern: b.concern, approval: b.approval, awareness: 40, jobAnxiety: b.jobAnxiety, xrisk: b.xrisk,
    regDemand: 50, salience: 1, activism: 8, dcNimby: 20, companionship: 3,
    rung: 0,
    blocs: initialBlocs(),
  };
}
