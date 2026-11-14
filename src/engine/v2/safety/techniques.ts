// Technique strength vs capability, Goodhart, refresh, containment (V2-SPEC §3.5.6–3.5.7). Owner: WS2.
import { AG05_GAP, AG09_LATENT, AGENDA_BY_ID } from '../../../data/v2/agendas';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { GameStateV2, TechniqueId, TechniqueState, ToolFamily } from '../types';
import { believedEfficacy, flag, lambda2Delta, trueEfficacy } from './common';

/** strength_t(M) = s0 · e · D(M) · (1 − G·trainedAgainst) · (falseValidated ? 0 : 1), D(M) = 1/(1 + (M/M½)^k). */
export function techniqueStrength(t: TechniqueState, efficacy: number, M: number): number {
  if (t.falseValidated) return 0;
  const D = 1 / (1 + Math.pow(M / Math.max(1e-9, t.mHalf), t.k));
  return t.s0 * efficacy * D * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}

/** Capability decay D(M) with the AG09-under-latent override (R14: 250/1 legible → 5/2 neuralese) and the AG05
 *  overseer-gap rule (success ≈ 0.52^gap, gap = log4(M / M_overseer), −1 tier with debate F16). */
export function decayAt(s: GameStateV2, t: TechniqueState, M: number, latentKnown: boolean): number {
  if (t.agenda === 'AG05') {
    const gap = Math.max(0, Math.log(Math.max(1, M) / AG05_GAP.overseerM) / Math.log(4) - (flag(s, 'debate') ? 1 : 0));
    return Math.pow(AG05_GAP.base, gap);
  }
  let mHalf = t.mHalf;
  let k = t.k;
  if (t.agenda === 'AG09' && latentKnown) {
    mHalf = Math.min(mHalf, AG09_LATENT.mHalf);
    k = AG09_LATENT.k;
  }
  if (k <= 0) return 1;
  return 1 / (1 + Math.pow(M / Math.max(1e-9, mHalf), k));
}

/** TRUE strength (hidden efficacy, falseValidated → 0). Engine only. */
export function strengthTrue(s: GameStateV2, t: TechniqueState, M: number): number {
  if (t.falseValidated) return 0;
  const latent = lambda2Delta(s) <= -2;
  return t.s0 * trueEfficacy(s, t.agenda) * decayAt(s, t, M, latent) * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}

/** BELIEVED strength: posterior-mean efficacy; a false-validated technique looks real. Safe for UI and U. */
export function strengthBelieved(s: GameStateV2, t: TechniqueState, M: number): number {
  const latent = lambda2Delta(s) <= -2;
  return t.s0 * believedEfficacy(s, t.agenda) * decayAt(s, t, M, latent) * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}

/** Technique state from its data row. */
export function techniqueFromDef(id: TechniqueId, unlocked: boolean): TechniqueState {
  const d = TECHNIQUE_BY_ID[id];
  const a = AGENDA_BY_ID[d.agenda];
  return {
    id, agenda: d.agenda, family: d.family, unlocked, active: unlocked && d.role !== 'fix',
    s0: d.s0, mHalf: a.mHalf, k: a.k, goodhart: a.G, trainedAgainst: 0, falseValidated: false, coverage: { ...d.coverage },
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
  s.player.safety.techniques[id] = t;
  return true;
}

/**
 * Containment (§3.5.7): Contain(M) = controlLayer · max_{t ∈ AG07} strength_t(M). `believed` uses posterior means.
 * U19 (monitor collusion) present in the overseen lineage cuts it (engine side only).
 */
export function containment(s: GameStateV2, M: number, controlLayer: boolean, believed = false, containMult = 1): number {
  if (!controlLayer) return 0;
  let best = 0;
  for (const t of Object.values(s.player.safety.techniques)) {
    if (t.agenda !== 'AG07' || !t.unlocked || !t.active || techniqueRole(t) !== 'contain') continue;
    best = Math.max(best, believed ? strengthBelieved(s, t, M) : strengthTrue(s, t, M));
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
