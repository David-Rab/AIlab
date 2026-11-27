// Products as packages (STRUCTURE §4.4, §4.9; BUILD-PLAN R6). Owner: WS1.
//
// A product is a Deployment of kind 'product': a model (optionally a mini serving its free tier), an optional monitor
// model, a price tier, safeguards, KYC and product tools (MK-11, data/v2/tools.ts). This module holds the package
// effects every engine reader uses (the product's display domain levels, incident-hazard multipliers, monitor overhead
// and catch rate), Agent mode's time-horizon gate, and the product policies (upgrade to newest, auto-evaluate). Model v3
// V4: the typed tool effects, cost, price and capacity live in worldfx/serving.ts; revenue and the Auto serving split in
// worldfx/revenue.ts.
import { LOCKDOWN_COLLUSION_MULT, labControlSetting, lockdownOn } from '../safety/safeguards';
import { controlOn } from '../safety/safeguards';
import { COLLUSION_TRAITS, COPY_COLLUSION } from '../../../data/v2/features';
import { AGENT_TASK_HOURS, PRODUCT_TOOL_BY_ID, type ProductToolDef, type ProductToolId } from '../../../data/v2/tools';
import { controlProtocol, monitorCatchAt, oomOfLevel, oversightGap } from '../safety/oversight';
import { MONITOR_ACTED_ON, MONITOR_CATCH_BASE, PRODUCT_MONITOR_WATCH } from '../../../data/v2/oversight';
import { containment } from '../safety/techniques';
import type { Deployment, GameStateV2, ModelVersion, TraitId } from '../types';
import { measuredLOf, versionById } from './labs';
import { nodeKnown } from './tree';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { flopPerToken } from '../departments/workfit';
import { MONITOR_AUTO } from '../../../data/v2/agents';
import { autoWatcher } from '../safety/trusted';


/** Products customers buy (external, paid). */
export const isProduct = (d: Deployment) => d.channel !== 'internal' && d.channel !== 'open';
export const kindOfChannel = (c: Deployment['channel']): Deployment['kind'] => (c === 'internal' ? 'internal' : c === 'open' ? 'open' : 'product');

/** The product tool of an id (undefined for an unknown id). */
export const toolDef = (id: string): ProductToolDef | undefined => PRODUCT_TOOL_BY_ID[id as ProductToolId];
/** Whether product tool t can be switched on for a channel. */
export const toolOffered = (t: ProductToolDef, ch: Deployment['channel']) => (t.products as string[]).includes(ch);

/** RD-B12 (B20): the tools a new product starts with: every lab-built tool its channel offers (as the start products
 *  have theirs on). */
export function launchFeatures(s: GameStateV2, channel: Deployment['channel']): string[] {
  return s.player.features.filter((id) => {
    const f = toolDef(id);
    return !!f && toolOffered(f, channel);
  });
}

/** Product tools switched on for a product that the lab has built. */
export function activeFeatures(s: GameStateV2, d: Deployment): ProductToolDef[] {
  if (!d.features.length) return [];
  const out: ProductToolDef[] = [];
  for (const id of d.features) {
    const f = toolDef(id);
    if (f && s.player.features.includes(id) && toolOffered(f, d.channel)) out.push(f);
  }
  return out;
}
/** MK-11: whether a product carries Agent mode (built and switched on). */
export const agentModeOn = (s: GameStateV2, d: Deployment) => activeFeatures(s, d).some((t) => t.agentGateH !== undefined);

/** RD-P11: the product's incident-site terms from its tools: the task-horizon multiplier of its horizon extenders on
 *  all work (Memory ×1.3: the tasks its model runs alone; autonomy A = H/(H + H_HALF)), the affordances they add
 *  (ProductToolDef.afford: Computer use +0.25, Agent mode +0.3) and, MK-11, the task length Agent mode sells (its gate,
 *  AGENT_TASK_HOURS: the product's task horizon is at least that, AGENT_TASK_HOURS). */
export function productSiteTerms(s: GameStateV2, d: Deployment): { hMult: number; afford: number; minH: number } {
  let hMult = 1;
  let afford = 0;
  let minH = 0;
  for (const f of activeFeatures(s, d)) {
    afford += f.afford ?? 0;
    if (f.agentGateH !== undefined) minH = Math.max(minH, f.agentGateH);
    for (const x of f.fx) if (x.kind === 'horizon' && x.work === 'all') hMult *= x.mult;
  }
  return { hMult, afford, minH };
}

/** Incident-hazard multiplier of a trait on a product from its tools (RD-P11: only stated [D] stand-ins, Companion). */
export function productHazardMult(s: GameStateV2, d: Deployment, trait: TraitId): number {
  let m = 1;
  for (const f of activeFeatures(s, d)) m *= f.hazard?.[trait] ?? 1;
  return m;
}

// ───────────────────────────── monitors (SR-12: one formula; D7) ─────────────────────────────

/** SR-12 (SAFETY-REDESIGN §3.3): one monitor, products and internal agent packages alike. */
export interface MonitorStop {
  /** Watched share = monitor compute ÷ (watched compute × the monitor's cost ratio), at most 1 (AI 2027 fn 51). */
  watched: number;
  /** Flag rate: the watcher's catch at its capability gap to the watched model (catchRate: Engels' gap rule, AG07 tools,
   *  control deferral) and its same-lineage collusion rate on collusion-relevant acts. */
  flag: number; flagColl: number;
  /** Acted-on rate (MONITOR_ACTED_ON [D]). */
  actedOn: number;
  /** Stop contribution = watched × flag × acted-on (and with collusion). */
  stop: number; stopColl: number;
  /** Strength for the monitor's logs (runtime observations, internal tool catch): watched × min(1, flag ÷ 85%) × acted-on
   *  (1 = a full-coverage monitor with no oversight gap). */
  strength: number; strengthColl: number;
  /** The catchRate parts (gap, copy, defer, …). */
  c: CatchRate;
}

/**
 * SR-12: the stop contribution of a monitor (`monitor` watching `watched`): watched share × flag rate × acted-on rate.
 * `monitorCompute` and `watchedCompute` in one unit (H100e or shares of compute); `costRatio` = the monitor's FLOP per
 * token ÷ the watched model's (one monitor pass per watched pass). Products: their monitor compute is billed to their
 * serving (monitorOverhead); internal packages: the monitors' part of the flat allocation (departments/agents.ts).
 */
export function monitorStop(
  s: GameStateV2, watched: ModelVersion | undefined, monitor: ModelVersion | undefined,
  monitorCompute: number, watchedCompute: number, costRatio: number, controlled: boolean, believed: boolean,
): MonitorStop {
  const c = catchRate(s, watched, monitor, controlled, believed);
  const need = watchedCompute * costRatio;
  const w = !watched || !monitor ? 0 : need > 0 ? Math.min(1, Math.max(0, monitorCompute) / need) : 1;
  const a = MONITOR_ACTED_ON;
  // No oversight gap (a copy of the watched model, or one as capable) = full strength exactly.
  const q = c.gap <= 0 ? 1 : Math.min(1, c.rate / MONITOR_CATCH_BASE);
  const qc = q * (c.rate > 0 ? c.collusion / c.rate : 1);
  return {
    watched: w, flag: c.rate, flagColl: c.collusion, actedOn: a, stop: w * c.rate * a, stopColl: w * c.collusion * a,
    strength: w * q * a, strengthColl: w * qc * a, c,
  };
}

/** SR-20b: a product's monitor model. monitorId 'auto' (MONITOR_AUTO) = the same trusted-watcher picker as internal
 *  deployments (safety/trusted.ts autoWatcher: the most capable live model the lab trusts other than the product's
 *  model); a model id overrides. */
export function productMonitorVersion(s: GameStateV2, d: Pick<Deployment, 'versionId' | 'monitorId'>): ModelVersion | undefined {
  if (!d.monitorId) return undefined;
  if (d.monitorId === MONITOR_AUTO) return autoWatcher(s, versionById(s, d.versionId)).v;
  return versionById(s, d.monitorId);
}

/** Cost ratio of a product's monitor: its FLOP per token ÷ the watched model's (0 with no monitor). */
export function productMonitorCostRatio(s: GameStateV2, d: Deployment): number {
  if (!d.monitorId) return 0;
  const mon = productMonitorVersion(s, d);
  const v = versionById(s, d.versionId);
  if (!mon || !v) return 0;
  return flopPerToken(s, mon) / Math.max(1e-6, flopPerToken(s, v));
}

/** Serving overhead of the product's monitor, as a share of its serving need (SR-12: the monitor's compute billed to the
 *  product's serving = the watched share PRODUCT_MONITOR_WATCH × the cost ratio; MONU closed: was D7's 0.25 × ratio). */
export function monitorOverhead(s: GameStateV2, d: Deployment): number {
  return PRODUCT_MONITOR_WATCH * productMonitorCostRatio(s, d);
}

/** SR-12: a product's monitor through the one formula: monitor compute = its billed overhead × the product's serving
 *  (both scale with what is served, so the watched share is PRODUCT_MONITOR_WATCH). Open weights: no monitor. */
export function productMonitor(s: GameStateV2, d: Deployment, controlled: boolean, believed: boolean): MonitorStop {
  const mon = d.monitorId && d.channel !== 'open' ? productMonitorVersion(s, d) : undefined;
  const r = productMonitorCostRatio(s, d);
  return monitorStop(s, versionById(s, d.versionId), mon, monitorOverhead(s, d), 1, r, controlled, believed);
}

export interface CatchRate {
  rate: number;
  /** Model v3 E6: oversight gap watched − monitor in OOM of effective compute (levels through λ⁻¹: true, or measured when believed), the same
   *  gap in display levels and in Chatbot-Arena Elo (Engels et al. 2025: 400 Elo ≈ 6.8 OOM). */
  gap: number;
  gapL: number;
  elo: number;
  /** Before control tools. */
  base: number;
  /** AI-control containment strength added (AG07 tools: true strength for the engine, believed for readouts; RF-S3). */
  control: number;
  /** Deferral to the trusted model when the deployment runs under the control layer: the miss multiplier (1 = off). */
  defer: number;
  /** J2 AG1: the monitor is from the watched model's lineage (same base), and its catch rate on collusion-relevant
   *  incidents (COLLUSION_TRAITS); equal to `rate` for any other monitor. */
  copy: boolean;
  collusion: number;
}

/**
 * Catch rate of a monitor watching a model (model v3 E6): monitorCatchAt(gap) = 85% × (10%/85%)^(gap ÷ 6.8 OOM), the
 * gap in OOM of effective compute between the two models' levels (Engels et al. 2025's Backdoor Code rate at a 400-Elo
 * gap; safety/oversight.ts), then the AG07 containment tools halve what slips through at full strength. Levels and tool
 * strength: true (Lg, true strength) for the engine's rolls; `believed` (readouts, beliefs) reads the measured levels
 * and believed tool strength instead (RD-M01 follow-up; RF-S3: the flag is required, so every caller says which). `controlled`: the deployment runs under the control layer, whose deferral cuts
 * the misses by Greenblatt's 0.17/0.38.
 */
export function catchRate(s: GameStateV2, watched: ModelVersion | undefined, monitor: ModelVersion | undefined, controlled: boolean, believed: boolean): CatchRate {
  if (!watched || !monitor) return { rate: 0, gap: 0, gapL: 0, elo: 0, base: 0, control: 0, defer: 1, copy: false, collusion: 0 };
  const w = s.hidden.timeline;
  const lv = (v: ModelVersion) => (believed ? measuredLOf(s, v).L : v.Lg);
  const Lw = lv(watched);
  const g = oversightGap(w, Lw, lv(monitor));
  const base = monitorCatchAt(g.oom);
  const control = containment(s, oomOfLevel(w, Lw), true, believed);
  const defer = controlled ? controlProtocol(undefined, labControlSetting(s)).missMult : 1;
  const rate = Math.min(0.99, 1 - (1 - base) * (1 - 0.5 * control) * defer);
  const copy = sameLineage(watched, monitor);
  const pen = copy ? COPY_COLLUSION * (lockdownOn(s) ? LOCKDOWN_COLLUSION_MULT : 1) : 0;
  return { rate, gap: g.oom, gapL: g.levels, elo: g.elo, base, control, defer, copy, collusion: rate * (1 - pen) };
}

/** Same lineage (J2 AG1): the monitor shares the watched model's base (itself, a post-train or stream on it, or a mini
 *  distilled from it). */
export const sameLineage = (a: Pick<ModelVersion, 'baseId'>, b: Pick<ModelVersion, 'baseId'>) => a.baseId === b.baseId;
/** Whether incidents from a trait are collusion-relevant (a same-lineage monitor catches them less often). */
export const collusionTrait = (t: TraitId | undefined) => !!t && COLLUSION_TRAITS.includes(t);

/** A product monitor's stop contribution (SR-12 monitorStop: watched share × flag rate × acted-on rate; for incidents
 *  from `trait`: the collusion rate when it is collusion-relevant). */
export function productCatch(s: GameStateV2, d: Deployment, trait?: TraitId): number {
  if (!d.monitorId) return 0;
  const m = productMonitor(s, d, controlOn(d), false);
  return collusionTrait(trait) ? m.stopColl : m.stop;
}

// ───────────────────────────── gates ─────────────────────────────

/** Measured 50% time horizon of a version in hours (undefined before its eval suite). */
export function measuredHorizonH(v: ModelVersion | undefined): number | undefined {
  const x = v?.evals.bench.horizon?.score;
  return x === undefined ? undefined : x / 60;
}

/** MK-11: Agent mode sells agent-hours only with a model whose measured time horizon covers the tasks it sells
 *  (AGENT_TASK_HOURS); a lineup model that fails sells none (worldfx/serving.ts productOffer). */
export function agentsGate(v: ModelVersion | undefined): true | string {
  const h = measuredHorizonH(v);
  if (h === undefined) return 'Agent mode needs a measured time horizon (run the eval suite)';
  if (h < AGENT_TASK_HOURS) return `Agent mode needs a time horizon of ${AGENT_TASK_HOURS} h (measured ${h.toFixed(1)} h)`;
  return true;
}

/** Why a product tool cannot be built, or undefined. */
export function featureBuildBlock(s: GameStateV2, id: string): string | undefined {
  const f = toolDef(id);
  if (!f) return 'Unknown tool';
  if (s.player.features.includes(id)) return `${f.name} is built`;
  if (s.player.build.queue.some((it) => it.kind === 'feature' && it.ref === id)) return `${f.name} is being built`;
  if (f.node && !nodeKnown(s, f.node)) return `Needs the idea ${PROJECT_BY_ID[f.node]?.name ?? f.node} (Research)`;
  if (f.cash > s.player.finance.cash) return 'Not enough cash';
  return undefined;
}

/** Why a product tool cannot be switched on for a product, or undefined. */
export function featureToggleBlock(s: GameStateV2, d: Deployment, id: string): string | undefined {
  const f = toolDef(id);
  if (!f) return 'Unknown tool';
  if (!toolOffered(f, d.channel)) return `${f.name} is not offered on this product`;
  if (!s.player.features.includes(id)) return `${f.name} is not built yet`;
  return undefined;
}


// ───────────────────────────── policies ─────────────────────────────

const usable = (v: ModelVersion) => v.status === 'ready' || v.status === 'deployed';

/** Auto-evaluate (policy, R6/R7): model v3 D7 moved it to models/evals.ts (queues suites as work: re-run when a model
 *  changed in place or on a cadence). Called by the products system. */
export { autoEvaluate } from './evals';

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
