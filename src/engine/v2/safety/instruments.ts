// SR-08 (SAFETY-REDESIGN §2.2 concepts 3–4, §3.2): detect techniques are INSTRUMENTS — owned ways of reading traits,
// each of one kind, reading the traits it covers, with ONE reliability definition per instrument per model:
//
//   reliability = s0 · efficacy · D(capability gap from the model it was validated on, by kind) · (1 − G·trainedAgainst)
//                 · penalties (eval awareness on behavioural tests, legibility on reasoning reading, masks)
//
// = the chance it shows a trait that is present. TRUE (engine): hidden efficacy, true EA / masks / OBF / undiscovered
// U-modes, a false-validated instrument reads 0 and masks its family. BELIEVED (UI, U): posterior-mean efficacy and the
// penalties the player knows of. Detection, understanding and the act table all read this one function.
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { GameStateV2, ModelVersion, TechniqueState, ToolFamily, TraitId } from '../types';
import { versionById } from './common';
import { believedPenaltyParts, falseMask, familyPenalty } from './detection';
import { measuredOom, oomOfLevel } from './oversight';
import { reliabilityBase, techniqueRole } from './techniques';

/** Instrument kinds (concept 3). Real-use logs are what safeguards' monitors see in deployment: the reasoning-reading
 *  and internals instruments read through a monitor (detection.ts runtimeMonitoring). */
export type InstrumentKind = 'tests' | 'reasoning' | 'internals' | 'logs' | 'formal';
export const INSTRUMENT_KIND_OF_FAMILY: Record<ToolFamily, InstrumentKind> = { BB: 'tests', COT: 'reasoning', WB: 'internals', OR: 'formal' };
export const INSTRUMENT_KIND_LABEL: Record<InstrumentKind, string> = {
  tests: 'Behavioural tests', reasoning: 'Reasoning reading', internals: 'Internals', logs: 'Real-use logs', formal: 'Formal checks',
};

/** The kind of an instrument; a reading taken by a monitor in deployment is 'logs'. */
export function instrumentKind(t: Pick<TechniqueState, 'family'>, use?: string): InstrumentKind {
  return use === 'monitor' ? 'logs' : INSTRUMENT_KIND_OF_FAMILY[t.family];
}

/** The traits an instrument reads (coverage > 0). */
export function instrumentReads(t: Pick<TechniqueState, 'coverage'>): TraitId[] {
  return (Object.keys(t.coverage) as TraitId[]).filter((k) => (t.coverage[k] ?? 0) > 0);
}

/** Owned instruments: unlocked detect techniques (contain tools are safeguards, fix tools are methods). */
export function instruments(s: GameStateV2): TechniqueState[] {
  return Object.values(s.player.safety.techniques).filter((t) => t.unlocked && techniqueRole(t) === 'detect');
}

/** What is read: a model at x OOM above V0; with `v` and `trait` the per-model penalties apply. Believed overrides for
 *  hypothetical readings (U): `eff` efficacy, `ea` suppressed eval awareness, `obf` CoT obfuscation factor. */
export interface ReadTarget { x: number; v?: ModelVersion; trait?: TraitId; eff?: number; ea?: number; obf?: number }

export interface Reliability {
  /** The chance the instrument shows a present trait on this model (base · penalty). */
  value: number;
  /** Model-free part: s0 · efficacy · decay · goodhart (sets a reading's noise). */
  base: number;
  efficacy: number;
  decay: number;
  goodhart: number;
  /** Per-model penalty (1 without v / trait); biases a reading down. */
  penalty: number;
  /** Believed parts of the penalty (1 = none). */
  tests: number;
  legible: number;
  mask: number;
}

/** THE reliability of instrument t on a model (see the file header). */
export function reliability(s: GameStateV2, t: TechniqueState, r: ReadTarget, believed: boolean): Reliability {
  const b = reliabilityBase(s, t, r.x, believed, r.eff);
  let penalty = 1;
  let tests = 1;
  let legible = 1;
  let mask = 0;
  if (r.v && r.trait) {
    if (believed) {
      const p = believedPenaltyParts(s, r.v, r.trait, t.family, r.x, r);
      tests = p.tests;
      legible = p.legible;
      mask = p.mask;
      penalty = Math.max(0, tests * legible * (1 - mask));
    } else penalty = familyPenalty(s, r.v, r.trait, t.family) * (1 - falseMask(s, r.trait, t.family));
  }
  return { value: b.base * penalty, base: b.base, efficacy: b.efficacy, decay: b.decay, goodhart: b.goodhart, penalty, tests, legible, mask };
}

const pts = (f: number) => `−${Math.round((1 - f) * 100)}`;
const nameOf = (s: GameStateV2, id: string | null | undefined) => (id ? versionById(s, id)?.name ?? id : s.player.models.versions[0]?.name ?? 'V0');

/** "validated on Atlas-1" (concept 4: the model the reliability was measured on). */
export function validatedLabel(s: GameStateV2, t: TechniqueState): string {
  return `validated on ${nameOf(s, t.validatedOn)}`;
}

/**
 * Reasons an instrument's BELIEVED reliability on model v (and trait, if given) is below its base, in player language
 * (concept 4): "not validated on V6", "capability gap −x", "trained against on V5 −x", "notices tests −x", "reasoning
 * not legible −x", "masked by training −x". Points are percent of reliability lost to that factor.
 */
export function reliabilityReasons(s: GameStateV2, t: TechniqueState, v: ModelVersion, trait?: TraitId, L?: number): string[] {
  const x = L === undefined ? measuredOom(s, v) : oomOfLevel(s.hidden.timeline, L);
  const r = reliability(s, t, { x, v, trait }, true);
  const out: string[] = [];
  if ((t.validatedOn ?? s.player.models.versions[0]?.id) !== v.id) out.push(`not validated on ${v.name}`);
  if (r.decay < 0.995) out.push(`capability gap from ${nameOf(s, t.validatedOn)} ${pts(r.decay)}`);
  if (r.goodhart < 0.995) out.push(`trained against${t.trainedAgainstOn ? ` on ${nameOf(s, t.trainedAgainstOn)}` : ''} ${pts(r.goodhart)}`);
  if (r.tests < 0.995) out.push(`notices tests ${pts(r.tests)}`);
  if (r.legible < 0.995) out.push(`reasoning not legible ${pts(r.legible)}`);
  if (r.mask > 0.005) out.push(`masked by training ${pts(1 - r.mask)}`);
  if (r.efficacy < 0.995) out.push(`line works ${Math.round(r.efficacy * 100)}%`);
  return out;
}

/** Display name of an instrument (data row). */
export function instrumentName(t: TechniqueState): string {
  return TECHNIQUE_BY_ID[t.id]?.name ?? t.id;
}
