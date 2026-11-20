// Understanding U and the race bars (V2-SPEC §3.5.7). Owner: WS2.
//
// U = the largest L in [0, 15] with mean_{k ∈ K} Det_k(L) ≥ 0.5, where
//   Det_k(L) = combine_t( cov_t,k · strength_t(M(L)) · penalty_t,k )
// computed from what the player BELIEVES: posterior-mean agenda efficacy, believed EA, the player's own
// training-against history. It never reads true traits, true efficacy or masks (Sylvester rule).
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { internalVersion, measuredLOf } from '../models/labs';
import type { AgendaId, GameStateV2, ModelVersion, TechniqueState, ToolFamily, TraitId } from '../types';
import { reValidationMult } from './agendas';
import { believedEfficacy, lambda2Delta, mAtLevel } from './common';
import { combineKeyed, combineTools, cotControllability, groupKeyOf, cotObfuscation, eaCoef, eaSuppression, familyPenalty, takesEaPenalty } from './detection';
import { believedMask, decayAt, strengthTrue, techniqueRole } from './techniques';

export interface UnderstandingReadout { U: number; margin: number; perTrait: Partial<Record<TraitId, number>> }

function detTools(s: GameStateV2): TechniqueState[] {
  return Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active && techniqueRole(t) !== 'fix');
}

/**
 * Projection beyond the model the tools were checked on (M4, §3.5.7) [D]. Detectors are validated on today's
 * internal model; how well they work on a more capable one is unknown until they are re-validated, which takes a
 * staffed validation effort (R14 §1.6A). A tool keeps its strength up to VAL_LEAD·√(validation multiplier) levels above
 * the current measured level L₀, then falls as 1/(1 + ((L − L₀ − lead)/VAL_W)²). Believed eval awareness is also
 * projected upward with capability (R14: verbalized EA 11.7% → 41–51% across generations):
 * EA(L) = 1 − (1 − EA₀)·exp(−EA_PROJ·(L − L₀)). Both only apply above L₀, so U starts near L and stays ahead only
 * with enough safety research engineers (R8, STRUCTURE §4.5: free engineers per line with tools ÷ RE_SERIOUS replaces
 * funding; agendas.ts reValidationMult).
 */
export const VAL_LEAD = 1.5;
export const VAL_W = 0.75;
export const EA_PROJ = 0.25;
export function validationLead(s: GameStateV2, agenda: AgendaId): number {
  return s.player.safety.agendas[agenda] ? VAL_LEAD * Math.sqrt(reValidationMult(s)) : 0;
}
function valAt(dL: number, lead: number): number {
  const x = dL - lead;
  return x <= 0 ? 1 : 1 / (1 + (x / VAL_W) ** 2);
}
const eaAt = (ea0: number, dL: number) => (dL <= 0 ? ea0 : 1 - (1 - ea0) * Math.exp(-EA_PROJ * dL));

/** Believed detection of trait k at hypothetical level L (§3.5.7). */
export function detectionAt(s: GameStateV2, v: ModelVersion, trait: TraitId, L: number, tools = detTools(s)): number {
  return detector(s, v, tools, measuredLOf(s, v).L)(trait, L);
}

/**
 * Believed detection for many levels at once (the U bisection evaluates ~10 levels × the critical traits): everything
 * that does not depend on L — believed efficacy, Goodhart factor, masks, the WB penalty, λ2, validation leads — is
 * computed once.
 */
function detector(s: GameStateV2, v: ModelVersion, tools: TechniqueState[], L0: number) {
  const w = s.hidden.timeline;
  const l2 = lambda2Delta(s);
  const latent = l2 <= -2;
  const pressured = v.design.cot === 'pressured';
  const ea0 = (v.beliefs.EA?.est ?? 0.15) * (1 - eaSuppression(s));
  const eaC = eaCoef(s);
  const obf = cotObfuscation(v.beliefs.OBF?.est ?? 0);
  // L0: the version's measured level (lineage fallback while it is in evaluation; see measuredLOf).
  const maskCache = new Map<string, number>();
  const maskOf = (family: ToolFamily, trait: TraitId) => {
    const p = pressured && (trait === 'RH' || trait === 'CONCEAL');
    const key = `${family}:${p ? 1 : 0}`;
    let m = maskCache.get(key);
    if (m === undefined) maskCache.set(key, (m = believedMask(s, family, p)));
    return m;
  };
  const vLead = VAL_LEAD * Math.sqrt(reValidationMult(s)); // validationLead, hoisted (P2)
  const tl = tools.map((t) => ({ t, pre: t.s0 * believedEfficacy(s, t.agenda), g: Math.max(0, 1 - t.goodhart * t.trainedAgainst), lead: s.player.safety.agendas[t.agenda] ? vLead : 0 }));
  // Per trait: the covering tools in stack order with their mask (BB: with the EA flag; COT: ctl(L) later).
  const rows = new Map<TraitId, { i: number; cov: number; mask: number; fam: ToolFamily; eaPen: boolean }[]>();
  const rowKeys = new Map<TraitId, string[]>();
  const rowOf = (trait: TraitId) => {
    let r = rows.get(trait);
    if (r) return r;
    r = [];
    tl.forEach(({ t }, i) => {
      const cov = t.coverage[trait] ?? 0;
      if (cov <= 0) return;
      r!.push({ i, cov, mask: maskOf(t.family, trait), fam: t.family, eaPen: takesEaPenalty(trait) });
    });
    rows.set(trait, r);
    rowKeys.set(trait, r.map((x) => groupKeyOf(tl[x.i].t.agenda)));
    return r;
  };
  // P2: a tool's strength at L does not depend on the trait: computed once per level (meanDet asks every critical
  // trait at the same L).
  let strL = NaN;
  const str: number[] = [];
  const done: boolean[] = [];
  return (trait: TraitId, L: number) => {
    const M = mAtLevel(w, L);
    if (!(L === strL)) {
      strL = L;
      done.fill(false);
    }
    const dL = L - L0;
    const ctl = Math.max(cotControllability(L), obf);
    const ea = eaAt(ea0, dL);
    const ds: number[] = [];
    const r = rowOf(trait);
    for (const row of r) {
      let strength = str[row.i];
      if (!done[row.i]) {
        const { t, pre, g, lead } = tl[row.i];
        strength = str[row.i] = pre * decayAt(s, t, M, latent) * g * valAt(dL, lead);
        done[row.i] = true;
      }
      let pen = 1;
      if (row.fam === 'BB') pen = Math.max(0, (row.eaPen ? 1 - eaC * ea : 1) * (1 - row.mask));
      else if (row.fam === 'COT') pen = l2 <= -2 ? 0 : Math.max(0, v.monitorability * (1 - ctl) * (1 - row.mask));
      else if (row.fam === 'WB') pen = 1 - row.mask;
      ds.push(row.cov * strength * pen);
    }
    return combineKeyed(ds, rowKeys.get(trait)!);
  };
}

function meanDet(det: (trait: TraitId, L: number) => number, L: number): number {
  let sum = 0;
  for (const k of CRITICAL_TRAITS) sum += det(k, L);
  return sum / CRITICAL_TRAITS.length;
}

/** EngineApi.understanding: U, margin U − L (L = measured level of the internal agent), per-trait detection at L. */
export function understanding(s: GameStateV2): UnderstandingReadout {
  const v = internalVersion(s);
  const L = measuredLOf(s, v).L;
  if (!v) return { U: 0, margin: -L, perTrait: {} };
  const det = detector(s, v, detTools(s), L);
  let U: number;
  if (meanDet(det, 0) < 0.5) U = 0;
  else if (meanDet(det, 15) >= 0.5) U = 15;
  else {
    let lo = 0;
    let hi = 15;
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (meanDet(det, mid) >= 0.5) lo = mid;
      else hi = mid;
    }
    U = Math.round(lo * 20) / 20;
  }
  const perTrait: Partial<Record<TraitId, number>> = {};
  for (const k of CRITICAL_TRAITS) perTrait[k] = Math.round(det(k, L) * 1000) / 1000;
  return { U, margin: Math.round((U - L) * 100) / 100, perTrait };
}

/** Level up to which the tools see each risk family (STRUCTURE §4.5; the U tooltip): the largest L at which the
 *  family's mean believed detection (over its critical traits, if it has any) is ≥ 0.5 (bisection, as U). Believed
 *  inputs only. */
export function familySeenTo(s: GameStateV2, v: ModelVersion): Record<(typeof RISK_FAMILIES)[number]['id'], number> {
  const det = detector(s, v, detTools(s), measuredLOf(s, v).L);
  const out = {} as Record<(typeof RISK_FAMILIES)[number]['id'], number>;
  for (const f of RISK_FAMILIES) {
    // A family with critical traits is seen as far as U sees those (deception: scheming, faking, sandbagging; power);
    // the others over all their traits.
    const crit = f.traits.filter((k) => CRITICAL_TRAITS.includes(k));
    const ks = crit.length ? crit : f.traits;
    const mean = (L: number) => ks.reduce((a, k) => a + det(k, L), 0) / ks.length;
    if (mean(0) < 0.5) out[f.id] = 0;
    else if (mean(15) >= 0.5) out[f.id] = 15;
    else {
      let lo = 0;
      let hi = 15;
      while (hi - lo > 0.05) {
        const mid = (lo + hi) / 2;
        if (mean(mid) >= 0.5) lo = mid;
        else hi = mid;
      }
      out[f.id] = Math.round(lo * 20) / 20;
    }
  }
  return out;
}

/** Technique closest to (or past) its M½ at the current measured level — the U tooltip's "next to decay". */
export function nearestDecay(s: GameStateV2): { id: string; name: string; decay: number } | undefined {
  const v = internalVersion(s);
  if (!v) return undefined;
  const M = mAtLevel(s.hidden.timeline, measuredLOf(s, v).L);
  let best: { id: string; name: string; decay: number } | undefined;
  for (const t of detTools(s)) {
    if (t.k <= 0) continue;
    const d = decayAt(s, t, M, false);
    if (!best || Math.abs(d - 0.5) < Math.abs(best.decay - 0.5)) best = { id: t.id, name: t.id, decay: Math.round(d * 100) / 100 };
  }
  return best;
}

/**
 * TRUE understanding (hidden, engine only; M4): the largest L at which the active stack's TRUE detection of the
 * critical traits averages ≥ 0.5 on the internal model — true efficacy, true eval awareness (projected upward with
 * capability as for U), true masks, OBF and undiscovered U-modes. The drift multiplier (§3.5.4, T1) reads
 * L − U_true, so a player cannot buy slower drift by not looking (believed U can be optimistic out of ignorance).
 */
export function trueUnderstanding(s: GameStateV2): { U: number; L: number } {
  const v = internalVersion(s);
  if (!v) return { U: 0, L: 0 };
  const tools = detTools(s);
  const L0 = v.Lg;
  const cache = new Map<number, ModelVersion>();
  const at = (L: number) => {
    let pv = cache.get(L);
    if (!pv) cache.set(L, (pv = { ...v, Lg: L, traitsTrue: { ...v.traitsTrue, EA: eaAt(v.traitsTrue.EA, L - L0) } }));
    return pv;
  };
  const mean = (L: number) => {
    const M = mAtLevel(s.hidden.timeline, L);
    const pv = at(L);
    const str = tools.map((t) => strengthTrue(s, t, M)); // once per tool and level
    let sum = 0;
    for (const k of CRITICAL_TRAITS) {
      const pen = new Map<ToolFamily, number>(); // once per family and trait
      const items: { agenda: string; d: number }[] = [];
      tools.forEach((t, i) => {
        const cov = t.coverage[k] ?? 0;
        if (cov <= 0 || str[i] <= 0) return;
        let f = pen.get(t.family);
        if (f === undefined) pen.set(t.family, (f = familyPenalty(s, pv, k, t.family)));
        items.push({ agenda: t.agenda, d: cov * str[i] * f });
      });
      sum += combineTools(items);
    }
    return sum / CRITICAL_TRAITS.length;
  };
  let U: number;
  if (mean(0) < 0.5) U = 0;
  else if (mean(15) >= 0.5) U = 15;
  else {
    let lo = 0;
    let hi = 15;
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (mean(mid) >= 0.5) lo = mid;
      else hi = mid;
    }
    U = Math.round(lo * 20) / 20;
  }
  return { U, L: L0 };
}
