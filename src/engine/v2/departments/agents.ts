// Internal agent packages (STRUCTURE §4.9, BUILD-PLAN R7). Owner: WS1.
//
// Four internal uses, each a package of model + optional monitor + compute; each supplies AI labour to one work type
// (departments/workfit.ts useLabour):
//   eng          engineering agents: software engineering (SWE) → build capacity (departments/teams.ts buildCapacity)
//   capRoutine   routine research: research experiments (EXP; spare serving compute lent to research adds to it)
//   capFrontier  frontier research: research ideas (IDEAS) and the AI research taste sdAI; its compute counts in the
//                readout's k with routine's
//   safety       safety research agents (the safety work types)
// RD-A05a: every use runs on its own line of the flat compute allocation (split.engineering / routine / frontier /
// safetyAgents, shares of total compute; departments/split.ts). Monitors watch internal uses on their own line
// (split.monitors, the monitoring budget, SAFMECH)
// buys coverage = budget ÷ (watched compute × the monitor's cost ratio) (AI 2027 fn 51). A monitor's strength = coverage × min(1, catch ÷ 85%): a monitor as capable as the
// watched model, fully funded, is today's runtime monitoring exactly (strength 1).
//
// The default package (initialAgents): routine research on the start model, the other uses on the newest internal
// model (RD-A06: named in the UI, no hidden "as routine" fallback), control off per package, monitors 'auto' (SR-20: the most capable trusted model) on routine and frontier research,
// the reference compute shares (DEFAULT_CAP_SHARES).
import { flopPerToken } from './workfit';
import {
  AGENT_USES, CAP_USES, DEFAULT_CAP_SHARES, MONITOR_AUTO, MONITOR_SAME, RISK_FAMILIES, RISK_UNSEEN_CLARITY, RISK_WATCH_EST,
  type CapUse,
} from '../../../data/v2/agents';
import { versionById } from '../models/labs';
import { collusionTrait, monitorStop, type MonitorStop } from '../models/products';
import { researchAgents } from './split';
import { controlComputeShare, controlOn, labControlSetting, setControl } from '../safety/safeguards';
import { autoWatcher } from '../safety/trusted';
import type { AgentPackage, AgentUse, ComputeSplit, GameStateV2, ModelVersion, TraitId } from '../types';

export function initialAgents(versionId = 'V0'): Record<AgentUse, AgentPackage> {
  return {
    eng: {},
    capRoutine: { versionId, monitorId: MONITOR_AUTO },
    capFrontier: { monitorId: MONITOR_AUTO },
    safety: {},
  };
}

const live = (v: ModelVersion | undefined): v is ModelVersion => !!v && v.status !== 'retired' && v.status !== 'rolledBack';
export const isCapUse = (u: AgentUse): u is CapUse => u !== 'safety';

/** The routine-research model (the production function's internal model; formerly `internalAgent`). */
export function routineVersion(s: GameStateV2): ModelVersion | undefined {
  return versionById(s, s.player.agents?.capRoutine.versionId);
}

/** RD-A06: the newest internal model, the default of a package with no own pick (stated in the UI as "newest"): the
 *  newest cleared (ready or deployed) full model; routine research's model while none is cleared. */
export function newestInternal(s: GameStateV2): ModelVersion | undefined {
  let best: ModelVersion | undefined;
  for (const v of s.player.models.versions) {
    if (v.variant !== 'full' || (v.status !== 'ready' && v.status !== 'deployed')) continue;
    if (!best || v.day > best.day) best = v;
  }
  return best ?? routineVersion(s);
}

/** Model running an internal use: its own pick when live, else the newest internal model (RD-A06: before, a hidden
 *  fallback to the routine-research model). Routine research runs its own pick (the internal deployment's model). */
export function agentVersion(s: GameStateV2, use: AgentUse): ModelVersion | undefined {
  if (use === 'capRoutine') return routineVersion(s);
  const id = s.player.agents[use].versionId;
  const v = id ? versionById(s, id) : undefined;
  return live(v) ? v : newestInternal(s);
}

/** RD-A06 + SR-13: the internal deployment's control-protocol safeguard follows the packages (present when a package
 *  running its model has control on; an existing item keeps its setting), for the readers that ask the internal fleet's
 *  containment (covert, incidents, believed oversight). Call after any package control change. */
export function syncInternalControl(s: GameStateV2): void {
  for (const d of s.player.deployments) {
    if (d.channel !== 'internal') continue;
    const on = AGENT_USES.some((u) => !!s.player.agents[u].control && agentVersion(s, u)?.id === d.versionId);
    if (on && !controlOn(d)) setControl(d, true, labControlSetting(s), s.time.day);
    else if (!on && controlOn(d)) setControl(d, false);
  }
}

/** Monitor model of an internal use ('same' = a copy of the watched model; SR-20 'auto' = the most capable trusted
 *  model, safety/trusted.ts autoWatcher, the default). */
export function monitorVersion(s: GameStateV2, use: AgentUse): ModelVersion | undefined {
  const id = s.player.agents[use].monitorId;
  if (!id) return undefined;
  if (id === MONITOR_SAME) return agentVersion(s, use);
  if (id === MONITOR_AUTO) return autoWatcher(s, agentVersion(s, use)).v;
  const v = versionById(s, id);
  return live(v) ? v : undefined;
}

/** RD-A05a: the allocation line each use runs on (departments/split.ts; shares of total compute). */
export const AGENT_LINE: Record<AgentUse, keyof ComputeSplit> = { eng: 'engineering', capRoutine: 'routine', capFrontier: 'frontier', safety: 'safetyAgents' };

/** Share of the research agents' compute (routine + frontier) a research use runs on; engineering 1 (its own line).
 *  A readout of the flat allocation (the frontier share sets the research taste lift, workfit). */
export function capShare(s: GameStateV2, use: CapUse): number {
  if (use === 'eng') return 1;
  const r = researchAgents(s.player.split);
  return r > 0 ? s.player.split[AGENT_LINE[use]] / r : DEFAULT_CAP_SHARES[use];
}

/** Share of the player's total compute running a use: its own line of the flat allocation (RD-A05a). */
export function agentSplitShare(s: GameStateV2, use: AgentUse): number {
  return s.player.split[AGENT_LINE[use]] ?? 0;
}

// SR-21: the safety line's claims (cases first, lines the rest) are the needs list's compute (safety/lineProjects.ts
// safAllocation): no separate claim pool.

/** H100e running a use. */
export const agentCompute = (s: GameStateV2, use: AgentUse) => s.player.computeOnline * agentSplitShare(s, use);

/** Cost ratio of a use's monitor: its FLOP per token ÷ the watched model's (one monitor forward pass per watched forward
 *  pass; AI 2027 fn 51's "10% of the cost"). 0 with no monitor. */
export function monitorCostRatio(s: GameStateV2, use: AgentUse): number {
  const mon = monitorVersion(s, use);
  const v = agentVersion(s, use);
  if (!mon || !v) return 0;
  return flopPerToken(s, mon) / Math.max(1e-6, flopPerToken(s, v));
}

/** Monitor compute that would watch every forward pass of a use, as a share of total compute (SAFMECH: the use's
 *  compute × the monitor's cost ratio; SR-12: products bill theirs to serving by the same rule, models/products.ts monitorOverhead). */
export function monitorNeedShare(s: GameStateV2, use: AgentUse): number {
  return monitorCostRatio(s, use) * agentSplitShare(s, use);
}

export interface MonitorBudget {
  /** Compute that would watch every forward pass of the monitored fleets (share of total compute): Σ over monitored uses
   *  of the use's compute × its monitor's cost ratio. */
  need: number;
  /** The monitors' allocation line (split.monitors), a share of total compute. */
  budget: number;
  /** Share of total compute the monitors use (≤ the budget; the rest of the line is unused, shown). */
  used: number;
  /** Share of the monitored fleets' forward passes the monitors watch: min((budget − control) ÷ need, 1). */
  coverage: number;
  /** SR-13b: the internal control protocol's compute (share of total compute: Σ agent compute × deferred share × the
   *  trusted cost ratio), paid first from the monitors' line; `controlShort` = the part the line cannot pay, taken from
   *  the agents' own compute (departments/workfit.ts useLabour). */
  control: number;
  controlShort: number;
}

/** SAFMECH: monitoring coverage from monitoring compute. AI 2027, fn 51 (Sep 2027): "With a monitoring budget of 1% of
 *  total compute, if monitoring uses a distilled system that has 10% of the cost as Agent-4, you can monitor 1/10 of the
 *  forward passes": coverage = budget ÷ (watched forward-pass compute × the monitor's cost ratio), capped at 1, all in
 *  one unit (shares of total compute or H100e). monitorCoverage(0.01, 1, 0.1) = 0.1. */
export function monitorCoverage(budget: number, watched: number, costRatio: number): number {
  const need = watched * costRatio;
  return need > 0 ? Math.min(1, Math.max(0, budget) / need) : 1;
}

/**
 * Monitors on internal uses run on their own allocation line (RD-A05a: split.monitors, a share of total compute; before,
 * a budget inside the safety pool). SAFMECH: the monitors watch the share of the fleets' forward passes that line pays
 * for (monitorCoverage) at each monitor's cost ratio, so a distilled mini watches several times more than a copy of the
 * watched model. Coverage multiplies every monitor's catch and strength (monitorStrength). Budget beyond full coverage
 * is not spent: it shows as unused (`budget − used`, DD-19), never moved to another use.
 */
export function monitorBudget(s: GameStateV2): MonitorBudget {
  let need = 0;
  for (const u of AGENT_USES) need += monitorNeedShare(s, u);
  const budget = Math.max(0, s.player.split.monitors ?? 0);
  // SR-13b: the control protocol's trusted-model compute comes out of the monitors' line first.
  const internalControl = s.player.deployments.some((d) => d.channel === 'internal' && d.status === 'live' && controlOn(d));
  let control = 0;
  if (internalControl) {
    const k = controlComputeShare(labControlSetting(s));
    for (const u of AGENT_USES) control += agentSplitShare(s, u) * k;
  }
  const paid = Math.min(budget, control);
  const left = budget - paid;
  if (need <= 0) return { need: 0, budget, used: paid, coverage: 1, control, controlShort: control - paid };
  return { need, budget, used: paid + Math.min(left, need), coverage: monitorCoverage(left, need, 1), control, controlShort: control - paid };
}
/** The monitors' part of the line's used compute (without the control protocol's). */
const monUsed = (b: MonitorBudget) => b.used - Math.min(b.budget, b.control);

/** H100e the monitor on one use runs on (its part of the monitors' used compute). */
export function monitorH100e(s: GameStateV2, use: AgentUse, b = monitorBudget(s)): number {
  return b.need > 0 ? (s.player.computeOnline * monUsed(b) * monitorNeedShare(s, use)) / b.need : 0;
}

/** SR-12: a use's monitor through the one monitor formula (models/products.ts monitorStop): monitor compute = the use's
 *  part of the monitors' used allocation (monitorH100e's share), watched compute = the use's compute, at the monitor's
 *  cost ratio, so its watched share is the pooled coverage (AI 2027 fn 51). */
export function useMonitor(s: GameStateV2, use: AgentUse, budget = monitorBudget(s), believed = false): MonitorStop {
  const need = monitorNeedShare(s, use);
  const mine = budget.need > 0 ? (monUsed(budget) * need) / budget.need : 0;
  return monitorStop(s, agentVersion(s, use), monitorVersion(s, use), mine, agentSplitShare(s, use), monitorCostRatio(s, use), false, believed);
}

/** A use's monitor (SR-12 useMonitor): its stop contribution (`catch` = watched share × flag rate × acted-on) and its
 *  strength (watched share × min(1, flag ÷ 85%)). Strength 1 = today's runtime monitoring; 0 = no monitor. */
export function monitorStrength(s: GameStateV2, use: AgentUse, budget = monitorBudget(s), believed = false): { catch: number; strength: number; gap: number; copy: boolean; catchColl: number; strengthColl: number; watched: number } {
  if (!monitorVersion(s, use) || !agentVersion(s, use)) return { catch: 0, strength: 0, gap: 0, copy: false, catchColl: 0, strengthColl: 0, watched: 0 };
  const m = useMonitor(s, use, budget, believed);
  return { catch: m.stop, strength: m.strength, gap: m.c.gap, copy: m.c.copy, catchColl: m.stopColl, strengthColl: m.strengthColl, watched: m.watched };
}

/** Uses in fleet order (routine research first: the old internal agent's fleet). */
const FLEET_ORDER: AgentUse[] = ['capRoutine', 'capFrontier', 'eng', 'safety'];

/** Internal fleets: each distinct model running internal uses, with its share of internal agent compute (usage of the
 *  internal incident hazard; 1 when everything runs on one model, 0 with no agent compute). Routine research's model
 *  is always first. */
export function internalFleets(s: GameStateV2): { v: ModelVersion; usage: number }[] {
  const out: { v: ModelVersion; w: number }[] = [];
  let total = 0;
  for (const u of FLEET_ORDER) {
    const v = agentVersion(s, u);
    if (!v) continue;
    const w = agentSplitShare(s, u);
    if (w <= 0 && u !== 'capRoutine') continue;
    total += w;
    let f = out.find((x) => x.v.id === v.id);
    if (!f) out.push((f = { v, w: 0 }));
    f.w += w;
  }
  return out.map((f) => ({ v: f.v, usage: total > 0 ? f.w / total : 0 }));
}

/** Monitor strength on the fleet running version `v`: the strongest monitor on an internal use running it (0 when none).
 *  With `trait` (an incident's source): a same-lineage monitor's lower strength on collusion-relevant traits (J2 AG1). */
export function fleetMonitor(s: GameStateV2, v: ModelVersion, trait?: TraitId, believed = false): number {
  let best = 0;
  let budget: MonitorBudget | undefined;
  const coll = collusionTrait(trait);
  for (const u of AGENT_USES) {
    if (!s.player.agents[u].monitorId || agentSplitShare(s, u) <= 0 || agentVersion(s, u)?.id !== v.id) continue;
    const m = monitorStrength(s, u, (budget ??= monitorBudget(s)), believed);
    best = Math.max(best, coll ? m.strengthColl : m.strength);
  }
  return best;
}

/** Monitor strength on the routine-research fleet (the lab's main internal fleet; E14 and product traffic sampling). */
export function routineMonitor(s: GameStateV2): number {
  const v = routineVersion(s);
  return v ? fleetMonitor(s, v) : 0;
}

/** Uses with a monitor (and compute): the Safety summary's "monitors on N of 4 uses". */
export function monitoredUses(s: GameStateV2): AgentUse[] {
  return AGENT_USES.filter((u) => !!monitorVersion(s, u) && agentSplitShare(s, u) > 0);
}

/** Where a model is used inside the company (STRUCTURE §4.9 readout "per model: where it is used"). */
export function usesOf(s: GameStateV2, versionId: string): { model: AgentUse[]; monitor: AgentUse[] } {
  const model = AGENT_USES.filter((u) => agentVersion(s, u)?.id === versionId && agentSplitShare(s, u) > 0);
  const monitor = AGENT_USES.filter((u) => monitorVersion(s, u)?.id === versionId && agentSplitShare(s, u) > 0);
  return { model, monitor };
}

// ───────────────────────────── risk badges ─────────────────────────────

export type RiskBadge = 'low' | 'watch' | 'unseen';
/** Risk badge per family from the model's trait beliefs (estimates, never truth). */
export function riskBadges(v: ModelVersion | undefined): Record<(typeof RISK_FAMILIES)[number]['id'], { badge: RiskBadge; est: number; clarity: number }> {
  const out = {} as Record<(typeof RISK_FAMILIES)[number]['id'], { badge: RiskBadge; est: number; clarity: number }>;
  for (const f of RISK_FAMILIES) {
    let est = 0;
    let clar = 0;
    for (const t of f.traits) {
      const b = v?.beliefs[t];
      est = Math.max(est, b?.est ?? 0);
      clar += b?.clarity ?? 0;
    }
    clar /= f.traits.length;
    out[f.id] = { badge: clar < RISK_UNSEEN_CLARITY ? 'unseen' : est >= RISK_WATCH_EST ? 'watch' : 'low', est, clarity: clar };
  }
  return out;
}

export { CAP_USES };
