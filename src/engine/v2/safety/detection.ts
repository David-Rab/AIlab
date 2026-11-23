// Detection: observations, family penalties, belief updates, masks (V2-SPEC §3.5.6). Owner: WS2.
//
// Truth → proxy. Every observation is o = x_true · penalty_family + N(0, σ), σ = 0.12 / max(0.1, strength), and
// beliefs update by the Gaussian rule. Eval awareness, masks and undiscovered U-modes bias the observation; the
// player only ever sees beliefs (est ± sd), safety-eval rates and incidents.
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { runAlignmentEvals } from './alignmentEvals';
import { evalAwarenessFactor } from '../models/benchmarks';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import type { BeliefEvidence, GameStateV2, ModelVersion, RngLike, SystemCtx, TechniqueState, ToolFamily, TraitBelief, TraitId } from '../types';
import { clamp, clamp01, lambda2Delta, sigmoid, versionById } from './common';
import { measuredOom, oomOfLevel, versionOom } from './oversight';
import { cotAlive } from './latents';
import { believedMask, techniqueRole } from './techniques';
import { reliability } from './instruments';
import { noteReading } from './disagreement';
import { hiddenUModes } from './umodes';
import { cotResist } from './ideas';
import { fleetMonitor, internalFleets, routineMonitor } from '../departments/agents';
import { productMonitor } from '../models/products';

export const SD_MAX = 0.35;

/** SR-06: a belief keeps its last 20 pieces of evidence (oldest first). */
export const BELIEF_EVIDENCE_CAP = 20;
/** "Unknown" (SAFETY-REDESIGN §2.2 concept 2): the 90% range (est ± 1.64·sd) is wider than 30 points. Derived, never
 *  stored. */
export const UNKNOWN_RANGE = 0.3;
export function beliefRange(b: Pick<TraitBelief, 'sd'> | undefined): number {
  return 2 * 1.64 * (b?.sd ?? SD_MAX);
}
export function beliefUnknown(b: Pick<TraitBelief, 'sd'> | undefined): boolean {
  return beliefRange(b) > UNKNOWN_RANGE;
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** `list` with `e` appended: a new array capped at BELIEF_EVIDENCE_CAP (oldest dropped), numbers to 3 decimals. */
export function withEvidence(list: readonly BeliefEvidence[] | undefined, e: BeliefEvidence): BeliefEvidence[] {
  const out = (list ?? []).slice(-(BELIEF_EVIDENCE_CAP - 1));
  out.push({ day: e.day, source: e.source, reading: r3(e.reading), noise: r3(e.noise) });
  return out;
}

/** Gaussian belief update (§3.5.6): 1/sd'² = 1/sd² + 1/σ²; clarity = 1 − sd/0.35. SR-06: the reading o and its σ go on
 *  the belief's evidence list under `source`. */
export function updateBelief(b: TraitBelief, o: number, sigma: number, day: number, source = 'obs'): TraitBelief {
  const prec = 1 / (b.sd * b.sd) + 1 / (sigma * sigma);
  const sd = Math.sqrt(1 / prec);
  const est = clamp01(sd * sd * (b.est / (b.sd * b.sd) + o / (sigma * sigma)));
  return { est, sd, clarity: Math.max(0, 1 - sd / SD_MAX), lastObsDay: day, evidence: withEvidence(b.evidence, { day, source, reading: o, noise: sigma }) };
}

/** CoT controllability at x OOM of effective compute above V0: ctl(x) = 0.8·σ((x − 1.0)/0.3) (anchors 1.7% → 16% →
 *  61%, R14 §1.6A). RD-L05: was 0.8·σ((L − 7)/0.6) in display levels; L 7 = 1.0 OOM above V0 on ai2027 and 0.6 levels
 *  = 0.3 OOM there (2.0 levels per OOM). */
export function cotControllability(x: number): number {
  return 0.8 * sigmoid((x - 1.0) / 0.3);
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
 *  COT : monitorability · (1 − max(ctl(L)·(1 − resist), obf(OBF))) · (1 − mask_COT) · [λ2_eff > −1]; resist = 0.5 on
 *        a faithful-CoT version (P23, data/v2/safetyIdeas.ts FAITHFUL_COT), else 0
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
    let p = v.monitorability * (1 - Math.max(cotControllability(versionOom(s, v)) * (1 - cotResist(v.design?.cot)), cotObfuscation(v.traitsTrue.OBF))) * (1 - mask);
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

/** SR-08: the BELIEVED penalty's parts, each a factor in [0, 1] (product = believedPenalty): `tests` = the eval-awareness
 *  factor on behavioural tests (believed EA, or `ea` = an already-suppressed override), `legible` = reasoning legibility
 *  on reasoning reading (CoT controllability at x, believed OBF or `obf`, known λ2 shift), `mask` = what the player's own
 *  training against the family hides. */
export function believedPenaltyParts(s: GameStateV2, v: ModelVersion, trait: TraitId, family: ToolFamily, x: number, o: { ea?: number; obf?: number } = {}): { tests: number; legible: number; mask: number } {
  const pressured = v.design.cot === 'pressured';
  const mask = believedMask(s, family, pressured && (trait === 'RH' || trait === 'CONCEAL'));
  let tests = 1;
  let legible = 1;
  if (family === 'BB' && takesEaPenalty(trait)) {
    const ea = o.ea ?? (v.beliefs.EA?.est ?? 0.15) * (1 - eaSuppression(s));
    tests = Math.max(0, 1 - eaCoef(s) * ea);
  } else if (family === 'COT') {
    const obf = o.obf ?? cotObfuscation(v.beliefs.OBF?.est ?? 0);
    legible = lambda2Delta(s) <= -2 ? 0 : Math.max(0, v.monitorability * (1 - Math.max(cotControllability(x) * (1 - cotResist(v.design?.cot)), obf)));
  }
  return { tests, legible, mask: family === 'OR' ? 0 : mask };
}

/** BELIEVED family penalty (for U): believed EA, the player's own training-against history, known λ2 shift. */
export function believedPenalty(s: GameStateV2, v: ModelVersion, trait: TraitId, family: ToolFamily, L: number): number {
  const p = believedPenaltyParts(s, v, trait, family, oomOfLevel(s.hidden.timeline, L));
  return Math.max(0, p.tests * p.legible * (1 - p.mask));
}

/**
 * Combine detection strengths of several tools (§3.5.6 "correlated tools"): tools whose agendas share a main latent
 * combine as d1 + 0.3·d2·(1 − d1) + …; groups on different latents combine independently.
 */
export function combineTools(items: { agenda: string; d: number }[]): number {
  const ds: number[] = [];
  const keys: string[] = [];
  for (const it of items) {
    ds.push(it.d);
    keys.push(groupKeyOf(it.agenda));
  }
  return combineKeyed(ds, keys);
}
/** combineTools on parallel arrays: detection strengths and their correlation groups (groupKeyOf). P2: groups in
 *  first-seen order as arrays (was a Map; same groups, order and arithmetic). */
export function combineKeyed(d: readonly number[], key: readonly string[]): number {
  const keys: string[] = [];
  const groups: number[][] = [];
  for (let i = 0; i < d.length; i++) {
    if (d[i] <= 0) continue;
    const j = keys.indexOf(key[i]);
    if (j >= 0) groups[j].push(d[i]);
    else {
      keys.push(key[i]);
      groups.push([d[i]]);
    }
  }
  let miss = 1;
  for (const ds of groups) {
    if (ds.length > 1) sortDesc(ds);
    let acc = 0;
    for (let i = 0; i < ds.length; i++) acc = i === 0 ? ds[i] : acc + 0.3 * ds[i] * (1 - acc);
    miss *= 1 - clamp01(acc);
  }
  return 1 - miss;
}
/** Descending sort of a short list of numbers in place: insertion sort (the values come out exactly as with
 *  sort((a, b) => b − a)); NaN keeps the built-in sort. */
function sortDesc(ds: number[]) {
  for (const d of ds) if (d !== d) {
    ds.sort((a, b) => b - a);
    return;
  }
  for (let i = 1; i < ds.length; i++) {
    const x = ds[i];
    let j = i - 1;
    while (j >= 0 && ds[j] < x) {
      ds[j + 1] = ds[j];
      j--;
    }
    ds[j + 1] = x;
  }
}
const GROUP_KEY = new Map<string, string>();
/** Correlation group of an agenda's tools: its main latent, or the agenda alone. */
export function groupKeyOf(agenda: string): string {
  let k = GROUP_KEY.get(agenda);
  if (k === undefined) {
    const lat = AGENDA_BY_ID[agenda as keyof typeof AGENDA_BY_ID]?.mainLatent ?? 'none';
    k = lat === 'none' ? `solo:${agenda}` : lat;
    GROUP_KEY.set(agenda, k);
  }
  return k;
}

/** False-validated techniques of `family` covering `trait` that are active: they mask (×0.5) instead of detecting. */
export function falseMask(s: GameStateV2, trait: TraitId, family: ToolFamily): number {
  for (const t of Object.values(s.player.safety.techniques)) {
    if (t.falseValidated && t.unlocked && t.active && t.family === family && (t.coverage[trait] ?? 0) > 0) return 0.5;
  }
  return 0;
}

/**
 * One observation of `trait` on version `versionId` through a tool family with combined detection `strength`.
 * Updates the version's belief and returns the observed value (undefined if the version is unknown).
 */
export function observe(s: GameStateV2, ctx: SystemCtx | { day: number; rng: SystemCtx['rng'] }, versionId: string, trait: TraitId, family: ToolFamily, strength: number, sigmaMult = 1, kind = 'obs'): number | undefined {
  const v = versionById(s, versionId);
  if (!v) return undefined;
  return observeVersion(s, ctx.rng('safety'), ctx.day, v, trait, family, strength, sigmaMult, kind);
}

/** One reading. `kind` names the instrument use for the evidence entry (source "<kind>/<family>"). */
export function observeVersion(s: GameStateV2, rng: RngLike, day: number, v: ModelVersion, trait: TraitId, family: ToolFamily, strength: number, sigmaMult = 1, kind = 'obs'): number {
  const sigma = (0.12 / Math.max(0.1, strength)) * sigmaMult;
  const pen = familyPenalty(s, v, trait, family) * (1 - falseMask(s, trait, family));
  const o = clamp(v.traitsTrue[trait] * pen + rng.normal(0, sigma), 0, 1); // a measured rate lies in [0, 1]
  const prior: TraitBelief = v.beliefs[trait] ?? { est: 0.2, sd: SD_MAX, clarity: 0, evidence: [] };
  noteReading(s, day, v, trait, family, kind, o, sigma, prior.evidence); // SR-10: disagreement with independent kinds
  v.beliefs[trait] = updateBelief(prior, o, sigma, day, `${kind}/${family}`);
  return o;
}

/** Combined TRUE detection of `trait` by the active tools of one family on version v (strength for σ). */
export function familyDetection(s: GameStateV2, _v: ModelVersion, trait: TraitId, family: ToolFamily, X: number, tools?: readonly TechniqueState[]): number {
  const items: { agenda: string; d: number }[] = [];
  for (const t of tools ?? Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || (!tools && !t.active) || t.family !== family || techniqueRole(t) === 'fix') continue;
    const cov = t.coverage[trait] ?? 0;
    if (cov <= 0) continue;
    items.push({ agenda: t.agenda, d: cov * reliability(s, t, { x: X }, false).base });
  }
  return combineTools(items);
}

/**
 * Safety eval suite (§3.5.6 "an eval suite: all active BB/COT tools, once per suite"): each active behavioural / reasoning
 * instrument reads its traits (beliefs update). SR-07: the alignment-eval results (k of n scenarios) are written by the
 * suite itself (models/benchmarks.ts runEvalSuite → safety/alignmentEvals.ts), not averaged from these readings.
 * safetyResearch runs this whenever a version's suiteDay advances.
 */
export function safetyEvalSuite(s: GameStateV2, rng: RngLike, day: number, v: ModelVersion, by: 'self' | 'evalGov' | 'evalIndep' = 'self'): void {
  const X = versionOom(s, v);
  for (const trait of TRAIT_IDS) {
    for (const fam of ['BB', 'COT'] as ToolFamily[]) {
      let d = familyDetection(s, v, trait, fam, X);
      if (by === 'evalIndep' && fam === 'BB') d = Math.max(d, 0.35); // external elicitation (+) [D]
      if (d <= 0.02) continue;
      observeVersion(s, rng, day, v, trait, fam, d, 1, by === 'self' ? 'suite' : 'external');
    }
  }
}

/** External evaluator report (§3.5.6): evalIndep = BB with stronger elicitation; evalGov = misuse only (no traits). */
export function observeExternal(s: GameStateV2, ctx: SystemCtx, versionId: string, by: 'evalGov' | 'evalIndep'): void {
  const v = versionById(s, versionId);
  if (!v || by === 'evalGov') return;
  safetyEvalSuite(s, ctx.rng('safety'), ctx.day, v, by);
  // SR-07: the evaluator's own scenario set (k of n per alignment eval, one full suite's worth).
  runAlignmentEvals(s, ctx.rng('safety'), ctx.day, v, by, 1, evalAwarenessFactor(v));
}

/**
 * Runtime monitoring (weekly, §3.5.6): COT and WB tools on deployed and internal versions, σ × 2, scaled by monitor
 * strength^0.3 (R7; strength 1 = the pre-R7 default of 20% of the safety pool): an internal fleet by its monitors
 * (departments/agents.ts fleetMonitor), a product model by the routine-research fleet's monitor (the runtime stack also
 * samples product traffic) or its own product monitor, whichever is stronger. SR-12: the monitor's logs are an evidence
 * source read from the same numbers as its stop rate (models/products.ts monitorStop: watched share × flag rate ×
 * acted-on; strength = watched share × min(1, flag ÷ 85%)), for products and internal packages alike.
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
    } else put(d.versionId, d.monitorId ? Math.max(lab, productMonitor(s, d).strength) : lab);
  }
  for (const f of internalFleets(s)) put(f.v.id, fleetMonitor(s, f.v));
  const rng = ctx.rng('safety');
  for (const [id, strength] of q) {
    if (strength <= 0.05) continue;
    const scale = Math.pow(strength, 0.3);
    const v = versionById(s, id);
    if (!v || v.status === 'retired') continue;
    const X = versionOom(s, v);
    for (const trait of TRAIT_IDS) {
      if (TRAIT_BY_ID[trait].layer === 'P') continue;
      for (const fam of ['COT', 'WB'] as ToolFamily[]) {
        const d = familyDetection(s, v, trait, fam, X) * scale;
        if (d <= 0.05) continue;
        observeVersion(s, rng, ctx.day, v, trait, fam, d, 2, 'monitor');
      }
    }
  }
}

const STACK_FAMILIES: ToolFamily[] = ['BB', 'COT', 'WB', 'OR'];

/**
 * TRUE detection of each trait in `traits` by the whole active stack on version v (engine only): per family the
 * combined tool strength at the version's capability (OOM above V0) times the true family penalty (EA, masks, OBF, undiscovered U-modes),
 * families combined independently. M4: post-training removes a trait only as far as this stack (plus what training
 * itself elicits) can see it (§3.5.4 "what you can see you can fix"), so masks and decayed tools also cost removal.
 */
export function stackDetectionMap(s: GameStateV2, v: ModelVersion, traits: readonly TraitId[]): Partial<Record<TraitId, number>> {
  const X = versionOom(s, v);
  // One pass over the stack: each tool's true strength once (it depends on capability only), then per trait and family the
  // familyDetection combination of cov · strength, times the true family penalty.
  const tools: { t: TechniqueState; str: number }[] = [];
  for (const t of Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || !t.active || techniqueRole(t) === 'fix') continue;
    const str = reliability(s, t, { x: X }, false).base;
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

/** SR-15: the BELIEVED counterpart of stackDetectionMap for the run plan's prediction (P6): each tool's believed strength
 *  at the measured capability, combined per family as stackDetectionMap does, times the family's believed penalty
 *  (believedPenaltyParts: believed EA, legibility, the player's own masks). Visible only. */
export function believedStackDetectionMap(s: GameStateV2, v: ModelVersion, traits: readonly TraitId[]): Partial<Record<TraitId, number>> {
  const X = measuredOom(s, v);
  const tools: { t: TechniqueState; str: number }[] = [];
  for (const t of Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || !t.active || techniqueRole(t) === 'fix') continue;
    const str = reliability(s, t, { x: X }, true).base;
    if (str > 0) tools.push({ t, str });
  }
  const out: Partial<Record<TraitId, number>> = {};
  for (const trait of traits) {
    let miss = 1;
    for (const fam of STACK_FAMILIES) {
      const items: { agenda: string; d: number }[] = [];
      let first: TechniqueState | undefined;
      for (const { t, str } of tools) {
        if (t.family !== fam) continue;
        const cov = t.coverage[trait] ?? 0;
        if (cov > 0) { items.push({ agenda: t.agenda, d: cov * str }); first ??= t; }
      }
      if (!items.length || !first) continue;
      const d = combineTools(items);
      if (d > 0) miss *= 1 - d * reliability(s, first, { x: X, v, trait }, true).penalty;
    }
    out[trait] = 1 - miss;
  }
  return out;
}

/** Probability that monitoring on a fleet catches an internal incident of `trait` (§3.5.10). Engine only. */
export function monitoringCatch(s: GameStateV2, v: ModelVersion, trait: TraitId): number {
  const X = versionOom(s, v);
  const cot = familyDetection(s, v, trait, 'COT', X) * familyPenalty(s, v, trait, 'COT');
  const wb = familyDetection(s, v, trait, 'WB', X) * familyPenalty(s, v, trait, 'WB');
  // R7: the monitor strength on the fleet running v (1 = the pre-R7 default monitoring share); J2 AG1: a same-lineage
  // monitor is weaker on collusion-relevant traits.
  return clamp01((1 - (1 - cot) * (1 - wb)) * (0.5 + 0.5 * fleetMonitor(s, v, trait)));
}

// SR-06 (SAFETY-REDESIGN §6 #6): no belief drift with time (driftBeliefs deleted). Evidence is about a checkpoint and a
// frozen model does not change, so a belief moves only through evidence; a new model starts from its parent's belief
// moved and widened by the run's predicted change (traits.ts predictBeliefs) and a stream version widens by its own
// training (traits.ts applyStreamDay).

/** Expected (noise-free) observation of a trait through a family — used by tests and the end screen. Engine only. */
export function expectedObservation(s: GameStateV2, v: ModelVersion, trait: TraitId, family: ToolFamily): number {
  return v.traitsTrue[trait] * familyPenalty(s, v, trait, family) * (1 - falseMask(s, trait, family));
}

