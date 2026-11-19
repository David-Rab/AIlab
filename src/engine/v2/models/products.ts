// Products as packages (STRUCTURE §4.4, §4.9; BUILD-PLAN R6). Owner: WS1.
//
// A product is a Deployment of kind 'product': a model (optionally a mini serving its free tier), an optional monitor
// model, a price tier, safeguards, KYC, effort and features. This module holds the package effects every engine
// reader uses (the product's display domain levels, incident-hazard multipliers, monitor overhead and catch rate), the
// Agents time-horizon gate, and the product policies (upgrade to newest, auto-evaluate). Model v3 V4: the typed feature
// effects, cost, price and capacity live in worldfx/serving.ts; revenue and the Auto serving split in worldfx/revenue.ts.
import { AG05_GAP } from '../../../data/v2/agendas';
import {
  AGENT_TASK_HOURS, AUTO_EVAL_DAYS, COLLUSION_TRAITS, COPY_COLLUSION, FEATURE_BY_ID, FREE_TIER_SHARE, MONITOR_CATCH_BASE, MONITOR_OVERHEAD, PRICE_TIERS,
  type FeatureDef, type FeatureId,
} from '../../../data/v2/features';
import { mAtLevel } from '../safety/common';
import { containment } from '../safety/techniques';
import type { Deployment, DomainId, GameStateV2, ModelVersion, SystemCtx, TraitId } from '../types';
import { runEvalSuite } from './benchmarks';
import { measuredLOf, versionById } from './labs';
import { nodeKnown } from './tree';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { agentVersion } from '../departments/agents';
import { flopPerToken } from '../departments/workfit';
import { AGENT_USES } from '../../../data/v2/agents';

const DOMAINS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];

/** Products customers buy (external, paid). */
export const isProduct = (d: Deployment) => d.channel !== 'internal' && d.channel !== 'open';
export const kindOfChannel = (c: Deployment['channel']): Deployment['kind'] => (c === 'internal' ? 'internal' : c === 'open' ? 'open' : 'product');

/** Features switched on for a product that the lab has built. */
export function activeFeatures(s: GameStateV2, d: Deployment): FeatureDef[] {
  if (!d.features.length) return [];
  const out: FeatureDef[] = [];
  for (const id of d.features) {
    const f = FEATURE_BY_ID[id as FeatureId];
    if (f && s.player.features.includes(id) && f.products.includes(d.channel)) out.push(f);
  }
  return out;
}

/** Share of the product's usage served by its mini free tier (0 without one). */
export function freeTierShare(s: GameStateV2, d: Deployment): number {
  if (!d.miniVersionId || !versionById(s, d.miniVersionId)) return 0;
  return FREE_TIER_SHARE[d.channel] ?? 0;
}

/**
 * Display domain levels of a product: its model's, blended with the free-tier mini by usage (feature effects are typed
 * and act on work-type fit, horizon and tokens, worldfx/serving.ts, not on these levels). Returns the model's own record
 * without a free tier.
 */
export function productDomains(s: GameStateV2, d: Deployment, v: ModelVersion | undefined = versionById(s, d.versionId)): Record<DomainId, number> | undefined {
  if (!v) return undefined;
  const f = freeTierShare(s, d);
  if (f <= 0) return v.domains;
  const mini = versionById(s, d.miniVersionId);
  if (!mini) return v.domains;
  const out = {} as Record<DomainId, number>;
  for (const k of DOMAINS) out[k] = (1 - f) * v.domains[k] + f * mini.domains[k];
  return out;
}

/** Incident-hazard multiplier of a trait on a product from its features. */
export function productHazardMult(s: GameStateV2, d: Deployment, trait: TraitId): number {
  let m = 1;
  for (const f of activeFeatures(s, d)) m *= f.hazard?.[trait] ?? 1;
  return m;
}

// ───────────────────────────── monitors (D7) ─────────────────────────────

/** Serving overhead of the product's monitor, as a share of its serving need (D7: 0.25 × the FLOP-per-token ratio of the
 *  monitor to the watched model). */
export function monitorOverhead(s: GameStateV2, d: Deployment): number {
  if (!d.monitorId) return 0;
  const mon = versionById(s, d.monitorId);
  const v = versionById(s, d.versionId);
  if (!mon || !v) return 0;
  return (MONITOR_OVERHEAD * flopPerToken(s, mon)) / Math.max(1e-6, flopPerToken(s, v));
}

export interface CatchRate {
  rate: number;
  /** Oversight gap in factors of 4 of research-speed multiplier M (AG05 rule). */
  gap: number;
  /** Before control tools. */
  base: number;
  /** AI-control containment strength added (AG07 tools, believed). */
  control: number;
  /** J2 AG1: the monitor is from the watched model's lineage (same base), and its catch rate on collusion-relevant
   *  incidents (COLLUSION_TRAITS); equal to `rate` for any other monitor. */
  copy: boolean;
  collusion: number;
}

/**
 * Catch rate of a monitor watching a model: MONITOR_CATCH_BASE × 0.52^gap (AG05 oversight gap, gap = log4 of the M
 * ratio at the measured levels), then the AG07 containment tools halve what slips through at full strength. Uses
 * measured levels and believed tool strength: what the player sees is what the engine rolls.
 */
export function catchRate(s: GameStateV2, watched: ModelVersion | undefined, monitor: ModelVersion | undefined): CatchRate {
  if (!watched || !monitor) return { rate: 0, gap: 0, base: 0, control: 0, copy: false, collusion: 0 };
  const w = s.hidden.timeline;
  const Mw = mAtLevel(w, measuredLOf(s, watched).L);
  const Mm = mAtLevel(w, measuredLOf(s, monitor).L);
  const gap = Math.max(0, Math.log(Math.max(1, Mw) / Math.max(1, Mm)) / Math.log(4));
  const base = MONITOR_CATCH_BASE * Math.pow(AG05_GAP.base, gap);
  const control = containment(s, Mw, true, true);
  const rate = Math.min(0.99, 1 - (1 - base) * (1 - 0.5 * control));
  const copy = sameLineage(watched, monitor);
  const lock = s.player.safety.techniques['T-LOCK'];
  const pen = copy ? COPY_COLLUSION * (lock?.unlocked && lock.active ? 0.5 : 1) : 0;
  return { rate, gap, base, control, copy, collusion: rate * (1 - pen) };
}

/** Same lineage (J2 AG1): the monitor shares the watched model's base (itself, a post-train or stream on it, or a mini
 *  distilled from it). */
export const sameLineage = (a: Pick<ModelVersion, 'baseId'>, b: Pick<ModelVersion, 'baseId'>) => a.baseId === b.baseId;
/** Whether incidents from a trait are collusion-relevant (a same-lineage monitor catches them less often). */
export const collusionTrait = (t: TraitId | undefined) => !!t && COLLUSION_TRAITS.includes(t);

/** A product monitor's catch rate (for incidents from `trait`: the collusion rate when it is collusion-relevant). */
export function productCatch(s: GameStateV2, d: Deployment, trait?: TraitId): number {
  if (!d.monitorId) return 0;
  const c = catchRate(s, versionById(s, d.versionId), versionById(s, d.monitorId));
  return collusionTrait(trait) ? c.collusion : c.rate;
}

// ───────────────────────────── gates ─────────────────────────────

/** Measured 50% time horizon of a version in hours (undefined before its eval suite). */
export function measuredHorizonH(v: ModelVersion | undefined): number | undefined {
  const x = v?.evals.bench.horizon?.score;
  return x === undefined ? undefined : x / 60;
}

/** Agents product: the model's measured time horizon must cover the tasks it sells (AGENT_TASK_HOURS). */
export function agentsGate(v: ModelVersion | undefined): true | string {
  const h = measuredHorizonH(v);
  if (h === undefined) return 'Agents needs a measured time horizon (run the eval suite)';
  if (h < AGENT_TASK_HOURS) return `Agents needs a time horizon of ${AGENT_TASK_HOURS} h (measured ${h.toFixed(1)} h)`;
  return true;
}

/** Why a feature cannot be built, or undefined. */
export function featureBuildBlock(s: GameStateV2, id: string): string | undefined {
  const f = FEATURE_BY_ID[id as FeatureId];
  if (!f) return 'Unknown feature';
  if (s.player.features.includes(id)) return `${f.name} is built`;
  if (s.player.build.queue.some((it) => it.kind === 'feature' && it.ref === id)) return `${f.name} is being built`;
  if (f.node && !nodeKnown(s, f.node)) return `Needs the idea ${PROJECT_BY_ID[f.node]?.name ?? f.node} (Research)`;
  if (f.cash > s.player.finance.cash) return 'Not enough cash';
  return undefined;
}

/** Why a feature cannot be switched on for a product, or undefined. */
export function featureToggleBlock(s: GameStateV2, d: Deployment, id: string): string | undefined {
  const f = FEATURE_BY_ID[id as FeatureId];
  if (!f) return 'Unknown feature';
  if (!f.products.includes(d.channel)) return `${f.name} is not offered on this product`;
  if (!s.player.features.includes(id)) return `${f.name} is not built yet`;
  return undefined;
}

export const priceIndexOf = (tier: Deployment['price']) => PRICE_TIERS[tier] ?? 1;

// ───────────────────────────── policies ─────────────────────────────

const usable = (v: ModelVersion) => v.status === 'ready' || v.status === 'deployed';

/** Auto-evaluate (policy, R6; replaces the 30-day eval expiry that blocked launches): every AUTO_EVAL_DAYS re-run the
 *  eval suite on the internal model and on any model updated in place (the continual-learning stream), so measured
 *  levels and trait estimates stay current. Called by the runs system. */
export function autoEvaluate(s: GameStateV2, ctx: SystemCtx) {
  if (!s.player.policies.autoEvaluate) return;
  const m = s.player.models;
  const ids = new Set<string>();
  // R7: every internal use's model (one id when they all run the routine model, as before).
  for (const u of AGENT_USES) {
    const v = agentVersion(s, u);
    if (v) ids.add(v.id);
  }
  if (m.stream) ids.add(m.stream.versionId);
  for (const id of ids) {
    const v = versionById(s, id);
    if (!v || v.status === 'evaluating' || v.status === 'retired' || v.status === 'rolledBack') continue;
    if (ctx.day - (v.evals.suiteDay ?? -1e9) >= AUTO_EVAL_DAYS) runEvalSuite(s, ctx, v.id);
  }
}

/** Newest usable version of the same variant that measures better than the product's model (the upgrade policy). */
export function newestCleared(s: GameStateV2, d: Deployment, gate: (v: ModelVersion) => true | string): ModelVersion | undefined {
  const cur = versionById(s, d.versionId);
  if (!cur) return undefined;
  const curL = cur.evals.measuredL ?? 0;
  let best: ModelVersion | undefined;
  for (const v of s.player.models.versions) {
    if (v.id === cur.id || v.variant !== cur.variant || !usable(v) || (v.evals.measuredL ?? 0) <= curL) continue;
    if (best && v.day <= best.day) continue;
    if (gate(v) === true) best = v;
  }
  return best;
}
