// Technique strength vs capability, Goodhart, refresh, containment (V2-SPEC §3.5.6–3.5.7; model v3 E6). Owner: WS2.
//
// Model v3 E6: capability is read in OOM of effective compute above the start model (safety/oversight.ts), never in
// the research multiplier M. A tool's decay factor is D(gap) = 1/(1 + 10^(k·κ·(gap − oHalf))), gap = the overseen
// model's OOM above the model the tool was validated on (SR-08 validatedOom; V0 for start tools, so their half points
// are v2's): it holds near that model and halves `oHalf` OOM above it (tool upkeep raises oHalf; data/v2/oversight.ts
// DECAY_KAPPA). The full reliability definition is safety/instruments.ts reliability().
import { AG09_LATENT, AGENDA_BY_ID } from '../../../data/v2/agendas';
import { AG05_OVERSIGHT, DECAY_KAPPA, OOM_PER_400_ELO } from '../../../data/v2/oversight';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { GameStateV2, TechniqueId, TechniqueState, ToolFamily } from '../types';
import { believedEfficacy, flag, lambda2Delta, trueEfficacy } from './common';
import { oomOfLevel, versionOom } from './oversight';
import { internalVersion } from '../models/labs';

/** Half-strength decay in OOM: 1/(1 + 10^(k·κ·(x − x½))); k ≤ 0 or x½ = ∞ never decays. */
export function decayOom(x: number, oHalf: number, k: number): number {
  if (k <= 0 || oHalf >= 1e8) return 1;
  return 1 / (1 + Math.pow(10, k * DECAY_KAPPA * (x - oHalf)));
}

/** SR-08: capability gap of a model at x OOM above V0 from the model the instrument was validated on (≥ 0). */
export function validationGap(t: TechniqueState, x: number): number {
  return Math.max(0, x - (t.validatedOom ?? 0));
}

/** Goodhart factor (1 − G·trainedAgainst) ≥ 0. */
export function goodhartFactor(t: TechniqueState): number {
  return Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}

/** SR-08 model-free part of an instrument's reliability: s0 · efficacy · D(gap from the validated model, by kind) ·
 *  (1 − G·trainedAgainst). TRUE: hidden efficacy, falseValidated → 0 (engine only); BELIEVED: posterior-mean efficacy
 *  (or `eff`), a false-validated instrument looks real. The per-model penalties are added by
 *  safety/instruments.ts reliability(), the one reliability definition. */
export function reliabilityBase(s: GameStateV2, t: TechniqueState, x: number, believed: boolean, eff?: number): { base: number; efficacy: number; decay: number; goodhart: number } {
  const efficacy = eff ?? (believed ? believedEfficacy(s, t.agenda) : trueEfficacy(s, t.agenda));
  const decay = decayAt(s, t, x, lambda2Delta(s) <= -2);
  const goodhart = goodhartFactor(t);
  // SR-10: the believed side carries the player's trust factor from evidence (validations, disagreements); true unchanged.
  const base = believed ? Math.min(1, t.s0 * efficacy * decay * goodhart * (t.trust?.f ?? 1)) : t.falseValidated ? 0 : t.s0 * efficacy * decay * goodhart;
  return { base, efficacy, decay, goodhart };
}

/** Capability decay D(x) with the AG09-under-latent override (R14: 250/1 legible → 5/2 neuralese, i.e. half strength at
 *  the superhuman-coder level) and the AG05 overseer-gap rule (Engels et al. 2025 debate: 0.517 per 400-Elo gap between
 *  the overseen model and an overseer at L 10; the F16 debate finding takes ≈ 4 OOM off the gap). */
export function decayAt(s: GameStateV2, t: TechniqueState, x: number, latentKnown: boolean): number {
  if (t.agenda === 'AG05') {
    const xo = oomOfLevel(s.hidden.timeline, AG05_OVERSIGHT.overseerL);
    const gap = Math.max(0, x - xo - (flag(s, 'debate') ? AG05_OVERSIGHT.debateCreditOom : 0));
    return Math.pow(AG05_OVERSIGHT.base, gap / OOM_PER_400_ELO);
  }
  const gap = validationGap(t, x);
  if (t.agenda === 'AG09' && latentKnown) return decayOom(gap, Math.min(t.oHalf, AG09_LATENT.oHalf), AG09_LATENT.k);
  return decayOom(gap, t.oHalf, t.k);
}

/** TRUE model-free reliability (reliabilityBase). Engine only. */
export function strengthTrue(s: GameStateV2, t: TechniqueState, x: number): number {
  return reliabilityBase(s, t, x, false).base;
}

/** BELIEVED model-free reliability (reliabilityBase). Safe for UI and U. */
export function strengthBelieved(s: GameStateV2, t: TechniqueState, x: number): number {
  return reliabilityBase(s, t, x, true).base;
}

/** Technique state from its data row. */
export function techniqueFromDef(id: TechniqueId, unlocked: boolean): TechniqueState {
  const d = TECHNIQUE_BY_ID[id];
  const a = AGENDA_BY_ID[d.agenda];
  return {
    id, agenda: d.agenda, family: d.family, unlocked, active: unlocked && d.role !== 'fix',
    s0: d.s0, oHalf: a.oHalf, k: a.k, goodhart: a.G, trainedAgainst: 0, trainedAgainstOn: null, validatedOn: null, validatedOom: 0, falseValidated: false, coverage: { ...d.coverage },
  };
}

/** All catalog techniques; start-unlocked ones are unlocked and (unless 'fix') active in the safety stack. */
export function initialTechniques(): Record<TechniqueId, TechniqueState> {
  const out: Record<TechniqueId, TechniqueState> = {};
  for (const d of TECHNIQUES) out[d.id] = techniqueFromDef(d.id, !!d.startUnlocked);
  return out;
}

export function techniqueRole(t: TechniqueState): 'detect' | 'fix' | 'contain' {
  return TECHNIQUE_BY_ID[t.id]?.role ?? 'detect';
}

/** Unlocked techniques in the deployed safety stack (detect + contain). */
export function activeTechniques(s: GameStateV2): TechniqueState[] {
  const out: TechniqueState[] = [];
  for (const t of Object.values(s.player.safety.techniques)) if (t.unlocked && t.active) out.push(t);
  return out;
}

export function isUnlocked(s: GameStateV2, id: TechniqueId): boolean {
  return !!s.player.safety.techniques[id]?.unlocked;
}

/** Unlock a catalog technique (no-op if already unlocked). Returns true if newly unlocked. */
export function unlockTechnique(s: GameStateV2, id: TechniqueId): boolean {
  const t = s.player.safety.techniques[id] ?? (TECHNIQUE_BY_ID[id] ? techniqueFromDef(id, false) : undefined);
  if (!t || t.unlocked) return false;
  t.unlocked = true;
  t.active = techniqueRole(t) !== 'fix';
  // SR-08: validated on the internal model at unlock (SR-09 replaces this with validation jobs).
  const iv = internalVersion(s);
  t.validatedOn = iv?.id ?? null;
  t.validatedOom = iv ? versionOom(s, iv) : 0;
  s.player.safety.techniques[id] = t;
  return true;
}

/**
 * Containment (§3.5.7): Contain(x) = controlLayer · max_{t ∈ AG07} strength_t(x), x = the contained model's OOM above
 * the start model. `believed` uses posterior means. U19 (monitor collusion) present in the overseen lineage cuts it
 * (engine side only).
 */
export function containment(s: GameStateV2, x: number, controlLayer: boolean, believed = false, containMult = 1): number {
  if (!controlLayer) return 0;
  let best = 0;
  for (const t of Object.values(s.player.safety.techniques)) {
    if (t.agenda !== 'AG07' || !t.unlocked || !t.active || techniqueRole(t) !== 'contain') continue;
    best = Math.max(best, believed ? strengthBelieved(s, t, x) : strengthTrue(s, t, x));
  }
  return best * containMult;
}

/** Believed mask on a tool family from the player's own training history (what they know they trained against). */
export function believedMask(s: GameStateV2, family: ToolFamily, cotPressured: boolean): number {
  let m = 0;
  for (const t of Object.values(s.player.safety.techniques)) if (t.family === family && t.trainedAgainst > 0) m = 1 - (1 - m) * (1 - Math.min(0.9, 0.65 * t.trainedAgainst));
  if (family === 'COT' && cotPressured) m = 1 - (1 - m) * 0.7;
  return m;
}
