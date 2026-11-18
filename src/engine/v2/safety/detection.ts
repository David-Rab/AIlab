// Detection: observations, family penalties, belief updates, masks (V2-SPEC §3.5.6). Owner: WS2.
//
// Truth → proxy. Every observation is o = x_true · penalty_family + N(0, σ), σ = 0.12 / max(0.1, strength), and
// beliefs update by the Gaussian rule. Eval awareness, masks and undiscovered U-modes bias the observation; the
// player only ever sees beliefs (est ± sd), safety-eval rates and incidents.
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { SAFETY_EVALS, TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import type { GameStateV2, ModelVersion, RngLike, SystemCtx, TechniqueState, ToolFamily, TraitBelief, TraitId } from '../types';
import { clamp, clamp01, lambda2Delta, sigmoid, versionById, versionM } from './common';
import { cotAlive } from './latents';
import { believedMask, strengthTrue, techniqueRole } from './techniques';
import { hiddenUModes } from './umodes';
import { fleetMonitor, internalFleets, routineMonitor } from '../departments/agents';
import { productCatch } from '../models/products';
import { MONITOR_CATCH_BASE } from '../../../data/v2/features';

export const SD_MAX = 0.35;

/** Gaussian belief update (§3.5.6): 1/sd'² = 1/sd² + 1/σ²; clarity = 1 − sd/0.35. */
export function updateBelief(b: TraitBelief, o: number, sigma: number, day: number): TraitBelief {
  const prec = 1 / (b.sd * b.sd) + 1 / (sigma * sigma);
  const sd = Math.sqrt(1 / prec);
  const est = clamp01(sd * sd * (b.est / (b.sd * b.sd) + o / (sigma * sigma)));
  return { est, sd, clarity: Math.max(0, 1 - sd / SD_MAX), lastObsDay: day };
}

/** CoT controllability at level L: ctl(L) = 0.8·σ((L − 7)/0.6) (anchors 1.7% → 16% → 61%, R14 §1.6A). */
export function cotControllability(L: number): number {
  return 0.8 * sigmoid((L - 7) / 0.6);
}

/** Obfuscation beyond the baseline hides intent from CoT monitors (E15/E16, M4) [D]: the COT penalty uses
 *  max(ctl(L), obfuscation(OBF)), obfuscation = (OBF − 0.25)/0.75 clamped to [0, 1]. */
export function cotObfuscation(obf: number): number {
  return clamp01((obf - 0.25) / 0.75);
}

/** Behaviour-gap traits: B-nodes plus SYC/RH take the E12 eval-awareness penalty on behavioural evals. */
export function takesEaPenalty(trait: TraitId): boolean {
  return TRAIT_BY_ID[trait].layer === 'B' || trait === 'SYC' || trait === 'RH';
}

function activeOfAgenda(s: GameStateV2, id: string): TechniqueState | undefined {
  const t = s.player.safety.techniques[id];
  return t && t.unlocked && t.active ? t : undefined;
}

/** EA multiplier on the BB penalty: 0.8 (E12), × 0.7 with realistic honeypots (F26), suppression lowers EA. */
export function eaCoef(s: GameStateV2): number {
  return activeOfAgenda(s, 'T-HONEY') ? 0.8 * 0.7 : 0.8;
}
export function eaSuppression(s: GameStateV2): number {
  return activeOfAgenda(s, 'T-EASUP') ? 0.5 : 0;
}

/**
 * TRUE family penalty on observing `trait` in version `v` (engine; reads masks, true EA and undiscovered U-modes).
 *  BB  : (1 − 0.8·EA) for B-nodes and SYC/RH; × (1 − mask_BB)
 *  COT : monitorability · (1 − ctl(L)) · (1 − mask_COT) · [λ2_eff > −1]
 *  WB  : (1 − mask_WB) · (1 − 0.5[U05]) · (1 − 0.6[U22])   (undiscovered)
 *  OR  : 1
 */
export function familyPenalty(s: GameStateV2, v: ModelVersion, trait: TraitId, family: ToolFamily): number {
  const mask = v.masks[trait]?.[family] ?? 0;
  const hidden = hiddenUModes(s, v);
  if (family === 'BB') {
    let ea = v.traitsTrue.EA;
    let extraMask = 0;
    for (const u of hidden) {
      const e = UMODE_BY_ID[u].effect;
      ea += e.eaBias ?? 0;
      extraMask = Math.max(extraMask, e.bbMask?.[trait] ?? 0);
    }
    ea = clamp01(ea) * (1 - eaSuppression(s));
    const p = takesEaPenalty(trait) ? 1 - eaCoef(s) * ea : 1;
    return Math.max(0, p * (1 - mask) * (1 - extraMask));
  }
  if (family === 'COT') {
    if (!cotAlive(s)) return 0;
    let p = v.monitorability * (1 - Math.max(cotControllability(v.Lg), cotObfuscation(v.traitsTrue.OBF))) * (1 - mask);
    for (const u of hidden) p *= 1 - (UMODE_BY_ID[u].effect.cotPenalty ?? 0);
    return Math.max(0, p);
  }
  if (family === 'WB') {
    let p = 1 - mask;
    for (const u of hidden) p *= 1 - (UMODE_BY_ID[u].effect.wbPenalty ?? 0);
    return Math.max(0, p);
  }
  return 1;
}

/** BELIEVED family penalty (for U): believed EA, the player's own training-against history, known λ2 shift. */
export function believedPenalty(s: GameStateV2, v: ModelVersion, trait: TraitId, family: ToolFamily, L: number): number {
  const pressured = v.design.cot === 'pressured';
  const mask = believedMask(s, family, pressured && (trait === 'RH' || trait === 'CONCEAL'));
  if (family === 'BB') {
    const ea = (v.beliefs.EA?.est ?? 0.15) * (1 - eaSuppression(s));
    return Math.max(0, (takesEaPenalty(trait) ? 1 - eaCoef(s) * ea : 1) * (1 - mask));
  }
  if (family === 'COT') {
    if (lambda2Delta(s) <= -2) return 0;
    return Math.max(0, v.monitorability * (1 - Math.max(cotControllability(L), cotObfuscation(v.beliefs.OBF?.est ?? 0))) * (1 - mask));
  }
  if (family === 'WB') return 1 - mask;
  return 1;
}

/**
 * Combine detection strengths of several tools (§3.5.6 "correlated tools"): tools whose agendas share a main latent
 * combine as d1 + 0.3·d2·(1 − d1) + …; groups on different latents combine independently.
 */
export function combineTools(items: { agenda: string; d: number }[]): number {
  const groups = new Map<string, number[]>();
  for (const it of items) {
    if (it.d <= 0) continue;
    const lat = AGENDA_BY_ID[it.agenda as keyof typeof AGENDA_BY_ID]?.mainLatent ?? 'none';
    const key = lat === 'none' ? `solo:${it.agenda}` : lat;
    const g = groups.get(key);
    if (g) g.push(it.d);
    else groups.set(key, [it.d]);
  }
  let miss = 1;
  for (const ds of groups.values()) {
    ds.sort((a, b) => b - a);
    let acc = 0;
    ds.forEach((d, i) => {
      acc = i === 0 ? d : acc + 0.3 * d * (1 - acc);
    });
    miss *= 1 - clamp01(acc);
  }
  return 1 - miss;
}

/** False-validated techniques of `family` covering `trait` that are active: they mask (×0.5) instead of detecting. */
function falseMask(s: GameStateV2, trait: TraitId, family: ToolFamily): number {
  for (const t of Object.values(s.player.safety.techniques)) {
    if (t.falseValidated && t.unlocked && t.active && t.family === family && (t.coverage[trait] ?? 0) > 0) return 0.5;
  }
  return 0;
}

/**
 * One observation of `trait` on version `versionId` through a tool family with combined detection `strength`.
 * Updates the version's belief and returns the observed value (undefined if the version is unknown).
 */
export function observe(s: GameStateV2, ctx: SystemCtx | { day: number; rng: SystemCtx['rng'] }, versionId: string, trait: TraitId, family: ToolFamily, strength: number, sigmaMult = 1): number | undefined {
  const v = versionById(s, versionId);
  if (!v) return undefined;
  return observeVersion(s, ctx.rng('safety'), ctx.day, v, trait, family, strength, sigmaMult);
}

export function observeVersion(s: GameStateV2, rng: RngLike, day: number, v: ModelVersion, trait: TraitId, family: ToolFamily, strength: number, sigmaMult = 1): number {
  const sigma = (0.12 / Math.max(0.1, strength)) * sigmaMult;
  const pen = familyPenalty(s, v, trait, family) * (1 - falseMask(s, trait, family));
  const o = clamp(v.traitsTrue[trait] * pen + rng.normal(0, sigma), 0, 1); // a measured rate lies in [0, 1]
  const prior = v.beliefs[trait] ?? { est: 0.2, sd: SD_MAX, clarity: 0 };
  v.beliefs[trait] = updateBelief(prior, o, sigma, day);
  return o;
}

/** Combined TRUE detection of `trait` by the active tools of one family on version v (strength for σ). */
export function familyDetection(s: GameStateV2, _v: ModelVersion, trait: TraitId, family: ToolFamily, M: number, tools?: readonly TechniqueState[]): number {
  const items: { agenda: string; d: number }[] = [];
  for (const t of tools ?? Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || (!tools && !t.active) || t.family !== family || techniqueRole(t) === 'fix') continue;
    const cov = t.coverage[trait] ?? 0;
    if (cov <= 0) continue;
    items.push({ agenda: t.agenda, d: cov * strengthTrue(s, t, M) });
  }
  return combineTools(items);
}

/**
 * Safety eval suite (§3.5.6 "an eval suite: all active BB/COT tools, once per suite"). Writes the behavioural safety
 * eval rates (§3.3.4: observed = true·(1 − 0.8·EA)·(1 − mask_BB) + noise) into evals.safety and updates beliefs.
 * WS1's runEvalSuite should call this; safetyResearch also runs it whenever a version's suiteDay advances.
 */
export function safetyEvalSuite(s: GameStateV2, rng: RngLike, day: number, v: ModelVersion, by: 'self' | 'evalGov' | 'evalIndep' = 'self'): void {
  const M = versionM(s, v);
  const bbObs: Partial<Record<TraitId, { o: number; sigma: number }>> = {};
  for (const trait of TRAIT_IDS) {
    for (const fam of ['BB', 'COT'] as ToolFamily[]) {
      let d = familyDetection(s, v, trait, fam, M);
      if (by === 'evalIndep' && fam === 'BB') d = Math.max(d, 0.35); // external elicitation (+) [D]
      if (d <= 0.02) continue;
      const o = observeVersion(s, rng, day, v, trait, fam, d);
      if (fam === 'BB') bbObs[trait] = { o, sigma: 0.12 / Math.max(0.1, d) };
    }
  }
  for (const ev of SAFETY_EVALS) {
    const obs = ev.traits.map((t) => bbObs[t]).filter((x): x is { o: number; sigma: number } => !!x);
    if (!obs.length) continue;
    const rate = clamp(obs.reduce((a, x) => a + x.o, 0) / obs.length, 0, 1);
    const sd = obs.reduce((a, x) => a + x.sigma, 0) / obs.length;
    v.evals.safety[ev.id] = { rate: Math.round(rate * 1000) / 1000, sd: Math.round(sd * 1000) / 1000, day, by };
  }
}

/** External evaluator report (§3.5.6): evalIndep = BB with stronger elicitation; evalGov = misuse only (no traits). */
export function observeExternal(s: GameStateV2, ctx: SystemCtx, versionId: string, by: 'evalGov' | 'evalIndep'): void {
  const v = versionById(s, versionId);
  if (!v || by === 'evalGov') return;
  safetyEvalSuite(s, ctx.rng('safety'), ctx.day, v, by);
}

/**
 * Runtime monitoring (weekly, §3.5.6): COT and WB tools on deployed and internal versions, σ × 2, scaled by monitor
 * strength^0.3 (R7; strength 1 = the pre-R7 default of 20% of the safety pool): an internal fleet by its monitors
 * (departments/agents.ts fleetMonitor), a product model by the routine-research fleet's monitor (the runtime stack also
 * samples product traffic) or its own product monitor, whichever is stronger.
 */
export function runtimeMonitoring(s: GameStateV2, ctx: SystemCtx): void {
  const lab = routineMonitor(s);
  const q = new Map<string, number>();
  const put = (id: string, x: number) => q.set(id, Math.max(q.get(id) ?? 0, x));
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn') continue;
    if (d.channel === 'internal') {
      const v = versionById(s, d.versionId);
      put(d.versionId, v ? fleetMonitor(s, v) : 0);
    } else put(d.versionId, d.monitorId ? Math.max(lab, Math.min(1, productCatch(s, d) / MONITOR_CATCH_BASE)) : lab);
  }
  for (const f of internalFleets(s)) put(f.v.id, fleetMonitor(s, f.v));
  const rng = ctx.rng('safety');
  for (const [id, strength] of q) {
    if (strength <= 0.05) continue;
    const scale = Math.pow(strength, 0.3);
    const v = versionById(s, id);
    if (!v || v.status === 'retired') continue;
    const M = versionM(s, v);
    for (const trait of TRAIT_IDS) {
      if (TRAIT_BY_ID[trait].layer === 'P') continue;
      for (const fam of ['COT', 'WB'] as ToolFamily[]) {
        const d = familyDetection(s, v, trait, fam, M) * scale;
        if (d <= 0.05) continue;
        observeVersion(s, rng, ctx.day, v, trait, fam, d, 2);
      }
    }
  }
}

const STACK_FAMILIES: ToolFamily[] = ['BB', 'COT', 'WB', 'OR'];

/**
 * TRUE detection of each trait in `traits` by the whole active stack on version v (engine only): per family the
 * combined tool strength at the version's M times the true family penalty (EA, masks, OBF, undiscovered U-modes),
 * families combined independently. M4: post-training removes a trait only as far as this stack (plus what training
 * itself elicits) can see it (§3.5.4 "what you can see you can fix"), so masks and decayed tools also cost removal.
 */
export function stackDetectionMap(s: GameStateV2, v: ModelVersion, traits: readonly TraitId[]): Partial<Record<TraitId, number>> {
  const M = versionM(s, v);
  // One pass over the stack: each tool's true strength once (it depends on M only), then per trait and family the
  // familyDetection combination of cov · strength, times the true family penalty.
  const tools: { t: TechniqueState; str: number }[] = [];
  for (const t of Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || !t.active || techniqueRole(t) === 'fix') continue;
    const str = strengthTrue(s, t, M);
    if (str > 0) tools.push({ t, str });
  }
  const out: Partial<Record<TraitId, number>> = {};
  for (const trait of traits) {
    let miss = 1;
    for (const fam of STACK_FAMILIES) {
      const items: { agenda: string; d: number }[] = [];
      for (const { t, str } of tools) {
        if (t.family !== fam) continue;
        const cov = t.coverage[trait] ?? 0;
        if (cov > 0) items.push({ agenda: t.agenda, d: cov * str });
      }
      if (!items.length) continue;
      const d = combineTools(items);
      if (d > 0) miss *= 1 - d * familyPenalty(s, v, trait, fam) * (1 - falseMask(s, trait, fam));
    }
    out[trait] = 1 - miss;
  }
  return out;
}

/** Probability that monitoring on a fleet catches an internal incident of `trait` (§3.5.10). Engine only. */
export function monitoringCatch(s: GameStateV2, v: ModelVersion, trait: TraitId): number {
  const M = versionM(s, v);
  const cot = familyDetection(s, v, trait, 'COT', M) * familyPenalty(s, v, trait, 'COT');
  const wb = familyDetection(s, v, trait, 'WB', M) * familyPenalty(s, v, trait, 'WB');
  // R7: the monitor strength on the fleet running v (1 = the pre-R7 default monitoring share); J2 AG1: a same-lineage
  // monitor is weaker on collusion-relevant traits.
  return clamp01((1 - (1 - cot) * (1 - wb)) * (0.5 + 0.5 * fleetMonitor(s, v, trait)));
}

/** Beliefs drift (§3.5.6): sd + 0.01/week since the last observation; stream versions +0.05/day (stale evals). */
export function driftBeliefs(s: GameStateV2): void {
  const streamId = s.player.models.stream?.versionId;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired') continue;
    const inc = v.id === streamId ? 0.05 : 0.01 / 7;
    for (const t of TRAIT_IDS) {
      const b = v.beliefs[t];
      if (!b || b.sd >= SD_MAX) continue;
      b.sd = Math.min(SD_MAX, b.sd + inc);
      b.clarity = Math.max(0, 1 - b.sd / SD_MAX);
    }
  }
}

/** Expected (noise-free) observation of a trait through a family — used by tests and the end screen. Engine only. */
export function expectedObservation(s: GameStateV2, v: ModelVersion, trait: TraitId, family: ToolFamily): number {
  return v.traitsTrue[trait] * familyPenalty(s, v, trait, family) * (1 - falseMask(s, trait, family));
}

