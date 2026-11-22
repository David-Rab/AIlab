// Run design → design effects, signals, predictions (V2-SPEC §3.3.2; model v3 V1; data in src/data/v2/runDesign.ts).
// Owner: WS1. Capability effects are in effective-compute OOMs (ΔG); size, tokens and RL compute are physical and
// enter through models/effective.ts.
import { BASE_DATA, CURATION, POST_COT, POST_PREF, POST_SAFETY, SHAPE, SIGNAL_IDS } from '../../../data/v2/runDesign';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import type { BaseDesign, DomainId, PostDesign, SignalId } from '../types';

export type Off = Partial<Record<DomainId, number>>;
export type Sig = Partial<Record<SignalId, number>>;

export const addOff = (a: Off, b: Off, k = 1): Off => {
  const out: Off = { ...a };
  for (const d of DOMAIN_IDS) if (b[d]) out[d] = (out[d] ?? 0) + k * (b[d] ?? 0);
  return out;
};
export const addSig = (a: Sig, b: Sig, k = 1): Sig => {
  const out: Sig = { ...a };
  for (const id of SIGNAL_IDS) if (b[id]) out[id] = (out[id] ?? 0) + k * (b[id] ?? 0);
  return out;
};

/** Base-run design effects: curation as OOM (general ΔG; the hazard filter's domain ΔG, OOM),
 *  the data option's FLOP and cash multipliers. The data mix's domain specialisation and repetition come from the draw
 *  (production/data.ts drawData, model v3 D3), the training signals from the base's G and drawn data (safety/traits.ts
 *  baseSignals, model v3 E3), not from here. */
export interface BaseEffect { dg: number; sD: Off; monitorability: number; flopMult: number; cashMult: number }
export function baseEffect(b: BaseDesign): BaseEffect {
  const sh = SHAPE[b.shape];
  const da = BASE_DATA[b.data];
  let dg = 0;
  let sD: Off = {};
  if (!b.curation.quality) dg += CURATION.qualityOffDg;
  if (b.curation.hazard) {
    dg += CURATION.hazard.dg;
    sD = addOff(sD, CURATION.hazard.dgD);
  }
  if (b.curation.safetyPretrain) dg += CURATION.safetyPretrain.dg;
  return {
    dg, sD, monitorability: sh.monitorability ?? 1, flopMult: da.flopMult, cashMult: da.cashMult,
  };
}

/** Post-training design effects (choices D–H): ΔG (OOM), domain ΔG (preference, OOM), serving and monitorability of the
 *  reasoning mode. The RL budget's capability effect is the RL curve (runs.ts); the environment suites (model v3 D5,
 *  models/suites.ts) set the RL ceiling per family; the training signals are the run's quantities (safety/traits.ts
 *  postSignals, model v3 E3); the time-horizon multiplier is the RL done on long tasks (RD-T05: models/effective.ts
 *  longTasksHorizonMult, set in runs.ts rlBuild). */
export interface PostEffect {
  dg: number; dgD: Off; serve: number; monitorability: number; appeal: number;
}
export function postEffect(p: PostDesign): PostEffect {
  const pr = POST_PREF[p.pref];
  const cot = POST_COT[p.cot];
  const sf = POST_SAFETY[p.safety];
  return {
    dg: pr.dg + cot.dg + sf.dg, dgD: { ...pr.dgD }, serve: cot.serveMult, monitorability: cot.monitorability,
    appeal: pr.appeal,
  };
}

/** Signals in [0, 1] (WS2 consumes intensities 0..1). */
export function clampSignals(sig: Sig): Sig {
  const out: Sig = {};
  for (const id of SIGNAL_IDS) if (sig[id] !== undefined) out[id] = Math.min(1, Math.max(0, sig[id] ?? 0));
  return out;
}

/** Monitorability class for the run card. */
export function monitorabilityClass(m: number): 'high' | 'medium' | 'low' | 'none' {
  return m >= 0.85 ? 'high' : m >= 0.5 ? 'medium' : m >= 0.15 ? 'low' : 'none';
}
