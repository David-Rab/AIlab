// Technique strength vs capability, Goodhart, refresh, containment (V2-SPEC §3.5.6–3.5.7; model v3 E6). Owner: WS2.
//
// Model v3 E6: capability is read in OOM of effective compute above the start model (safety/oversight.ts), never in
// the research multiplier M. A tool's strength factor is D(x) = 1/(1 + 10^(k·κ·(x − oHalf))): it holds while the
// overseen model is near the capability the tool was validated on and halves `oHalf` OOM above V0 (tool upkeep raises
// oHalf; data/v2/oversight.ts DECAY_KAPPA keeps v2's half points on the reference path).
import { AG09_LATENT, AGENDA_BY_ID } from '../../../data/v2/agendas';
import { AG05_OVERSIGHT, DECAY_KAPPA, OOM_PER_400_ELO } from '../../../data/v2/oversight';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { GameStateV2, TechniqueId, TechniqueState, ToolFamily } from '../types';
import { believedEfficacy, flag, lambda2Delta, trueEfficacy } from './common';
import { agendaOHalf, oomOfLevel, oomOfRefM } from './oversight';

/** Half-strength decay in OOM: 1/(1 + 10^(k·κ·(x − x½))); k ≤ 0 or x½ = ∞ never decays. */
export function decayOom(x: number, oHalf: number, k: number): number {
  if (k <= 0 || oHalf >= 1e8) return 1;
  return 1 / (1 + Math.pow(10, k * DECAY_KAPPA * (x - oHalf)));
}

/** strength_t(x) = s0 · e · D(x) · (1 − G·trainedAgainst) · (falseValidated ? 0 : 1), x = the overseen model's OOM above
 *  the start model. */
export function techniqueStrength(t: TechniqueState, efficacy: number, x: number): number {
  if (t.falseValidated) return 0;
  return t.s0 * efficacy * decayOom(x, t.oHalf, t.k) * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
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
  if (t.agenda === 'AG09' && latentKnown) return decayOom(x, Math.min(t.oHalf, oomOfRefM(AG09_LATENT.mHalf)), AG09_LATENT.k);
  return decayOom(x, t.oHalf, t.k);
}

/** TRUE strength (hidden efficacy, falseValidated → 0). Engine only. */
export function strengthTrue(s: GameStateV2, t: TechniqueState, x: number): number {
  if (t.falseValidated) return 0;
  const latent = lambda2Delta(s) <= -2;
  return t.s0 * trueEfficacy(s, t.agenda) * decayAt(s, t, x, latent) * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}

/** BELIEVED strength: posterior-mean efficacy; a false-validated technique looks real. Safe for UI and U. */
export function strengthBelieved(s: GameStateV2, t: TechniqueState, x: number): number {
  const latent = lambda2Delta(s) <= -2;
  return t.s0 * believedEfficacy(s, t.agenda) * decayAt(s, t, x, latent) * Math.max(0, 1 - t.goodhart * t.trainedAgainst);
}

/** Technique state from its data row. */
export function techniqueFromDef(id: TechniqueId, unlocked: boolean): TechniqueState {
  const d = TECHNIQUE_BY_ID[id];
  const a = AGENDA_BY_ID[d.agenda];
  return {
    id, agenda: d.agenda, family: d.family, unlocked, active: unlocked && d.role !== 'fix',
    s0: d.s0, oHalf: agendaOHalf(a), k: a.k, goodhart: a.G, trainedAgainst: 0, falseValidated: false, coverage: { ...d.coverage },
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
