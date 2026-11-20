// Run design → design effects, signals, predictions (V2-SPEC §3.3.2; model v3 V1; data in src/data/v2/runDesign.ts).
// Owner: WS1. Capability effects are in effective-compute OOMs (ΔG); size, tokens and RL compute are physical and
// enter through models/effective.ts.
import { BASE_DATA, CURATION, POST_COT, POST_PREF, POST_SAFETY, RL_FAMILIES, RL_FAMILY_IDS, SHAPE, SIGNAL_IDS } from '../../../data/v2/runDesign';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import type { BaseDesign, DomainId, PostDesign, RLFamily, SignalId } from '../types';

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

/** Base-run design effects: curation as OOM (general ΔG; the hazard filter's domain offset ÷ 2, research/12 ΔL = 2·ΔG),
 *  the data option's FLOP and cash multipliers. The data mix's domain specialisation and repetition come from the draw
 *  (production/data.ts drawData, model v3 D3), the training signals from the base's G and drawn data (safety/traits.ts
 *  baseSignals, model v3 E3), not from here. */
export interface BaseEffect { dg: number; sD: Off; monitorability: number; flopMult: number; cashMult: number; flags: { bioUplift?: boolean } }
export function baseEffect(b: BaseDesign): BaseEffect {
  const sh = SHAPE[b.shape];
  const da = BASE_DATA[b.data];
  let dg = 0;
  let offL: Off = {};
  if (!b.curation.quality) dg += CURATION.qualityOffDg;
  if (b.curation.hazard) {
    dg += CURATION.hazard.dg;
    offL = addOff(offL, CURATION.hazard.off);
  }
  if (b.curation.safetyPretrain) dg += CURATION.safetyPretrain.dg;
  const sD: Off = {};
  for (const d of DOMAIN_IDS) if (offL[d]) sD[d] = (offL[d] ?? 0) / 2;
  return {
    dg, sD, monitorability: sh.monitorability ?? 1, flopMult: da.flopMult, cashMult: da.cashMult,
    flags: b.data === 'science' ? { bioUplift: false } : {},
  };
}

/** RL focus: the horizon multiplier and danger flags of the focus families (§3.3.2 E). Domain gains come from the RL
 *  curve (models/effective.ts rlGains), training signals from the RL compute shares (safety/traits.ts postSignals). */
export function rlFocusEffect(focus: RLFamily[] | 'broad'): { h80Mult: number; flags: { bioUplift?: boolean; cyberOffense?: boolean } } {
  let h80Mult = 1;
  const flags: { bioUplift?: boolean; cyberOffense?: boolean } = {};
  if (focus === 'broad') return { h80Mult, flags };
  for (const f of RL_FAMILY_IDS) {
    if (!focus.includes(f)) continue;
    const fam = RL_FAMILIES[f];
    if (fam.h80Mult) h80Mult *= fam.h80Mult;
    if (fam.flag) flags[fam.flag] = true;
  }
  return { h80Mult, flags };
}

/** Post-training design effects (choices D–H): ΔG (OOM), level offsets (preference), serving and monitorability of the
 *  reasoning mode. The RL budget's capability effect is the RL curve (runs.ts); the environment suites (model v3 D5,
 *  models/suites.ts) set the RL ceiling per family; the training signals are the run's quantities (safety/traits.ts
 *  postSignals, model v3 E3). */
export interface PostEffect {
  dg: number; offL: Off; serve: number; monitorability: number; h80Mult: number; misuseMult: number; appeal: number;
  flags: { bioUplift?: boolean; cyberOffense?: boolean; persuasion?: boolean }; safetyFteWeeks: number;
}
export function postEffect(p: PostDesign): PostEffect {
  const pr = POST_PREF[p.pref];
  const cot = POST_COT[p.cot];
  const sf = POST_SAFETY[p.safety];
  const rl = rlFocusEffect(p.rlFocus);
  const flags = { ...rl.flags, ...(p.pref === 'persuasion' ? { persuasion: true } : {}) };
  return {
    dg: pr.dg + cot.dg + sf.dg, offL: { ...pr.off }, serve: cot.serveMult, monitorability: cot.monitorability,
    h80Mult: rl.h80Mult, misuseMult: sf.misuseMult, appeal: pr.appeal, flags, safetyFteWeeks: pr.safetyFteWeeks,
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
