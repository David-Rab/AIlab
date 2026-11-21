// Understanding U and the race bars (V2-SPEC §3.5.7). Owner: WS2.
//
// U = the largest L in [0, 15] with mean_{k ∈ K} Det_k(L) ≥ 0.5, where
//   Det_k(L) = combine_t( cov_t,k · strength_t(x(L)) · penalty_t,k ),  x(L) = λ⁻¹(L) − G_V0 (OOM above the start model)
// computed from what the player BELIEVES: posterior-mean agenda efficacy, believed EA, the player's own
// training-against history. It never reads true traits, true efficacy or masks (Sylvester rule).
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { internalVersion, measuredLOf } from '../models/labs';
import type { AgendaId, GameStateV2, ModelVersion, TechniqueState, ToolFamily, TraitId } from '../types';
import { hash32 } from '../core/rng';
import { reValidationMult } from './agendas';
import { believedEfficacy, clamp01, lambda2Delta } from './common';
import { oomOfLevel } from './oversight';
import { combineKeyed, combineTools, cotControllability, groupKeyOf, cotObfuscation, eaCoef, eaSuppression, familyPenalty, takesEaPenalty } from './detection';
import { believedMask, decayAt, strengthTrue, techniqueRole } from './techniques';
import { cotResist } from './ideas';

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
function detector(s: GameStateV2, v: ModelVersion, tools: TechniqueState[], L0: number, draw?: BeliefDraw) {
  const w = s.hidden.timeline;
  const l2 = lambda2Delta(s);
  const latent = l2 <= -2;
  const pressured = v.design.cot === 'pressured';
  const ea0 = (draw?.ea ?? v.beliefs.EA?.est ?? 0.15) * (1 - eaSuppression(s));
  const eaC = eaCoef(s);
  const obf = cotObfuscation(draw?.obf ?? v.beliefs.OBF?.est ?? 0);
  const resist = 1 - cotResist(v.design?.cot); // P23: faithful CoT halves the controllability that blinds CoT monitors
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
  const tl = tools.map((t) => ({ t, pre: t.s0 * (draw?.eff?.[t.agenda] ?? believedEfficacy(s, t.agenda)), g: Math.max(0, 1 - t.goodhart * t.trainedAgainst), lead: s.player.safety.agendas[t.agenda] ? vLead : 0 }));
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
    const x = oomOfLevel(w, L);
    if (!(L === strL)) {
      strL = L;
      done.fill(false);
    }
    const dL = L - L0;
    const ctl = Math.max(cotControllability(L) * resist, obf);
    const ea = eaAt(ea0, dL);
    const ds: number[] = [];
    const r = rowOf(trait);
    for (const row of r) {
      let strength = str[row.i];
      if (!done[row.i]) {
        const { t, pre, g, lead } = tl[row.i];
        strength = str[row.i] = pre * decayAt(s, t, x, latent) * g * valAt(dL, lead);
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

// ───────────────────────────── SAFMECH: how sure the lab can be of U ─────────────────────────────
//
// Believed U reads posterior means: a line with few results keeps its prior mean efficacy, and a model observed little
// keeps the eval awareness and obfuscation it was predicted to have, so less safety research does not lower U (S5R: half
// the safety compute moved believed U +0.29 while true U fell 0.64). What fewer results do change is how much the lab
// knows: its posteriors stay wide. The honest readout is a range: U recomputed on BELIEF_DRAWS joint draws from what the
// lab believes (each agenda's efficacy from its Beta posterior, normal approximation with the posterior's mean and sd,
// clamped to [0, 1]; the internal model's believed eval awareness and obfuscation from their estimate ± sd), reported as
// the central 80% (10th–90th percentile). It widens with fewer results and staler observations and narrows with more.
// Beliefs only: no truth is read. Draws are a fixed Latin hypercube per world (hash of the seed), so the range does not
// jitter from day to day. Display and tests only (no mechanism reads it).
export interface BeliefDraw { eff?: Partial<Record<AgendaId, number>>; ea?: number; obf?: number }
export const BELIEF_DRAWS = 24;
export const U_BAND_Q: readonly [number, number] = [0.1, 0.9];

/** Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
function probit(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - 0.02425) return -probit(1 - q);
  const r = q - 0.5;
  const t = r * r;
  return ((((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) * r) / (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
}

/** U for a detector (the bisection of understanding()). */
function uOf(det: (trait: TraitId, L: number) => number): number {
  if (meanDet(det, 0) < 0.5) return 0;
  if (meanDet(det, 15) >= 0.5) return 15;
  let lo = 0;
  let hi = 15;
  while (hi - lo > 0.05) {
    const mid = (lo + hi) / 2;
    if (meanDet(det, mid) >= 0.5) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 20) / 20;
}

export interface UnderstandingBand { U: number; lo: number; hi: number; draws: number }
const bandMemo = new WeakMap<GameStateV2, { key: string; b: UnderstandingBand }>();

/** SAFMECH: believed U with the range the lab's uncertainty allows (see above). Beliefs only. */
export function understandingBand(s: GameStateV2): UnderstandingBand {
  const v = internalVersion(s);
  const U = understanding(s).U;
  if (!v) return { U, lo: U, hi: U, draws: 0 };
  const tools = detTools(s);
  const dept = s.player.safety;
  const key = `${s.time.day}|${v.id}|${dept.findings.length}|${tools.map((t) => t.id).join(',')}|${JSON.stringify(v.beliefs.EA)}|${JSON.stringify(v.beliefs.OBF)}`;
  const hit = bandMemo.get(s);
  if (hit?.key === key) return hit.b;
  const L0 = measuredLOf(s, v).L;
  const ags = [...new Set(tools.map((t) => t.agenda))].filter((a) => dept.agendas[a]).sort();
  const N = BELIEF_DRAWS;
  // Latin hypercube: input j's draw k sits in stratum perm_j(k) of N.
  const strata = (j: string) => Array.from({ length: N }, (_, k) => k).sort((x, y) => hash32(s.setup.seed, `uband:${j}:${x}`) - hash32(s.setup.seed, `uband:${j}:${y}`));
  const z = (perm: number[], k: number) => probit((perm[k] + 0.5) / N);
  const pEff = ags.map((a) => strata(a));
  const pEa = strata('EA');
  const pObf = strata('OBF');
  const Us: number[] = [];
  for (let k = 0; k < N; k++) {
    const eff: Partial<Record<AgendaId, number>> = {};
    ags.forEach((a, i) => {
      const p = dept.agendas[a].posterior;
      const n = p.a + p.b;
      const sd = Math.sqrt((p.a * p.b) / (n * n * (n + 1)));
      eff[a] = clamp01(believedEfficacy(s, a) + sd * z(pEff[i], k));
    });
    const ea = v.beliefs.EA ? clamp01(v.beliefs.EA.est + v.beliefs.EA.sd * z(pEa, k)) : undefined;
    const obf = v.beliefs.OBF ? clamp01(v.beliefs.OBF.est + v.beliefs.OBF.sd * z(pObf, k)) : undefined;
    Us.push(uOf(detector(s, v, tools, L0, { eff, ea, obf })));
  }
  Us.sort((x, y) => x - y);
  const q = (p: number) => {
    const x = p * (N - 1);
    const i = Math.floor(x);
    return Us[i] + (Us[Math.min(N - 1, i + 1)] - Us[i]) * (x - i);
  };
  const r = (x: number) => Math.round(x * 20) / 20;
  const b = { U, lo: r(Math.min(U, q(U_BAND_Q[0]))), hi: r(Math.max(U, q(U_BAND_Q[1]))), draws: N };
  bandMemo.set(s, { key, b });
  return b;
}

/** P4: whether understanding(s).margin < thr, without always finishing the bisection. The bisection's result lies in
 *  [lo, hi] at every step, and U = round(lo·20)/20 and the margin round((U − L)·100)/100 are monotone in it, so once
 *  both ends give the same answer it is the answer (the same steps as understanding() up to there: exact). */
export function understandingMarginBelow(s: GameStateV2, thr: number): boolean {
  const v = internalVersion(s);
  const L = measuredLOf(s, v).L;
  if (!v) return -L < thr;
  const below = (U: number) => Math.round((U - L) * 100) / 100 < thr;
  const det = detector(s, v, detTools(s), L);
  if (meanDet(det, 0) < 0.5) return below(0);
  if (meanDet(det, 15) >= 0.5) return below(15);
  let lo = 0;
  let hi = 15;
  while (hi - lo > 0.05) {
    const a = below(Math.round(lo * 20) / 20);
    if (a === below(Math.round(hi * 20) / 20)) return a;
    const mid = (lo + hi) / 2;
    if (meanDet(det, mid) >= 0.5) lo = mid;
    else hi = mid;
  }
  return below(Math.round(lo * 20) / 20);
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

/** Technique closest to (or past) its half-strength point at the current measured level — the U tooltip's "next to decay". */
export function nearestDecay(s: GameStateV2): { id: string; name: string; decay: number } | undefined {
  const v = internalVersion(s);
  if (!v) return undefined;
  const x = oomOfLevel(s.hidden.timeline, measuredLOf(s, v).L);
  let best: { id: string; name: string; decay: number } | undefined;
  for (const t of detTools(s)) {
    if (t.k <= 0) continue;
    const d = decayAt(s, t, x, false);
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
    const x = oomOfLevel(s.hidden.timeline, L);
    const pv = at(L);
    const str = tools.map((t) => strengthTrue(s, t, x)); // once per tool and level
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
