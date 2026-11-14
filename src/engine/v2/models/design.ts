// Run design → offsets, signals, predictions (V2-SPEC §3.3.2; data in src/data/v2/runDesign.ts). Owner: WS1.
import {
  BASE_DATA, BASE_SCALE, BASE_SHAPE, CURATION, POST_COT, POST_INTENSITY, POST_PREF, POST_SAFETY, RL_FAMILIES, RL_FAMILY_IDS,
  SIGNAL_IDS,
} from '../../../data/v2/runDesign';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import type { BaseDesign, DomainId, PostDesign, RLFamily, SignalId } from '../types';

export type Off = Partial<Record<DomainId, number>>;
export type Sig = Partial<Record<SignalId, number>>;

export interface DesignEffect {
  dp: number;
  domains: Off;
  serve: number;
  monitorability: number;
  signals: Sig;
  h80Mult: number;
  misuseMult: number;
  appeal: number;
  flags: { bioUplift?: boolean; cyberOffense?: boolean; persuasion?: boolean };
  /** Loss-spike probability for base runs. */
  restart: number;
  /** FLOP multiplier (multimodal +20%). */
  flopMult: number;
  /** Extra cash as a share of the run's compute-equivalent cost (science journals). */
  cashMult: number;
  /** Data mix removes the data-wall penalty. */
  noWall: boolean;
  /** Extra wall days from safety training (low, high). */
  extraDays: [number, number];
  /** Safety FTE-weeks needed (constitution). */
  safetyFteWeeks: number;
}

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

/** Base-run effects (choices A–C and curation). Scale's Δp is the pc formula (§3.1.3), not counted here. */
export function baseEffect(b: BaseDesign): DesignEffect {
  const sc = BASE_SCALE[b.scale];
  const sh = BASE_SHAPE[b.shape];
  const da = BASE_DATA[b.data];
  let dp = sh.dp + da.dp;
  let off: Off = { ...da.off };
  let signals: Sig = addSig(addSig(sc.signals, sh.signals), da.signals);
  if (!b.curation.quality) dp += CURATION.qualityOffDp;
  if (b.curation.hazard) {
    dp += CURATION.hazard.dp;
    off = addOff(off, CURATION.hazard.off);
  }
  if (b.curation.safetyPretrain) {
    dp += CURATION.safetyPretrain.dp;
    signals = addSig(signals, CURATION.safetyPretrain.signals);
  }
  return {
    dp, domains: off, serve: sh.serve, monitorability: sh.monitorability ?? 1, signals, h80Mult: 1, misuseMult: 1, appeal: 1,
    flags: b.data === 'science' ? { bioUplift: false } : {}, restart: Math.max(0, sc.restart + sh.restart),
    flopMult: da.flopMult, cashMult: da.cashMult, noWall: da.noWall, extraDays: [0, 0], safetyFteWeeks: 0,
  };
}

/** RL focus offsets: off_d = Σ_f (w_f − 0.5)·v_f,d with w_f = 1 if focused else 0; broad = 0 (§3.3.2 E).
 *  Signals: every family contributes at weight w (broad = 0.5 each). */
export function rlFocusEffect(focus: RLFamily[] | 'broad'): { off: Off; signals: Sig; h80Mult: number; flags: DesignEffect['flags'] } {
  let off: Off = {};
  let signals: Sig = {};
  let h80Mult = 1;
  const flags: DesignEffect['flags'] = {};
  for (const f of RL_FAMILY_IDS) {
    const wgt = focus === 'broad' ? 0.5 : focus.includes(f) ? 1 : 0;
    const fam = RL_FAMILIES[f];
    if (focus !== 'broad') off = addOff(off, fam.v, wgt - 0.5);
    signals = addSig(signals, fam.signals, wgt);
    if (wgt === 1 && fam.h80Mult) h80Mult *= fam.h80Mult;
    if (wgt === 1 && fam.flag) flags[fam.flag] = true;
  }
  return { off, signals, h80Mult, flags };
}

/** Post-training effects (choices D–H). */
export function postEffect(p: PostDesign): DesignEffect {
  const pr = POST_PREF[p.pref];
  const it = POST_INTENSITY[p.rlIntensity];
  const cot = POST_COT[p.cot];
  const sf = POST_SAFETY[p.safety];
  const rl = rlFocusEffect(p.rlFocus);
  let signals = addSig(pr.signals, rl.signals);
  signals.S2 = (signals.S2 ?? 0) * it.s2Mult;
  signals = addSig(signals, { S7: it.s7, S4: cot.s4 });
  const flags = { ...rl.flags, ...(p.pref === 'persuasion' ? { persuasion: true } : {}) };
  return {
    dp: pr.dp + it.dp + cot.dp + sf.dp,
    domains: addOff(pr.off, rl.off),
    serve: cot.serveMult, // multiplier on the base serve cost
    monitorability: cot.monitorability,
    signals, h80Mult: rl.h80Mult, misuseMult: sf.misuseMult, appeal: pr.appeal, flags, restart: 0, flopMult: 1, cashMult: 0,
    noWall: false, extraDays: sf.days, safetyFteWeeks: pr.safetyFteWeeks,
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
