// Internal agent packages (STRUCTURE §4.9, BUILD-PLAN R7). Owner: WS1.
//
// Four internal uses, each a package of model + optional monitor + compute:
//   eng          engineering agents: AI share of engineers' work → build capacity (A_eng of this model × coverage)
//   capRoutine   routine research: the production function's internal model (p_dep, A, R, ηmod) — the old internalAgent
//   capFrontier  frontier research: research taste (qTaste in evalM, sdAI); its compute counts in k with routine's
//   safety       safety research agents (the old safety agent fleet), on a share of the safety pool
// Engineering and the two research uses share the capabilities agent pool (split.agents); their `compute` are shares
// of it. Monitors watch internal uses, paid first from the safety pool: the monitoring budget (a share of the pool, SAFMECH)
// buys coverage = budget ÷ (watched compute × the monitor's cost ratio) (AI 2027 fn 51). A monitor's strength = coverage × min(1, catch ÷ 85%): a monitor as capable as the
// watched model, fully funded, is today's runtime monitoring exactly (strength 1).
//
// Neutrality: the default package (every use on the routine model, monitors 'same' on routine and frontier research,
// the reference shares) gives exactly the pre-R7 production function, runtime monitoring and internal incidents.
import { flopPerToken } from './workfit';
import {
  AGENT_USES, CAP_USES, DEFAULT_CAP_SHARES, MONITOR_SAME, MONITOR_STD_POOL_SHARE, RISK_FAMILIES, RISK_UNSEEN_CLARITY, RISK_WATCH_EST,
  type CapUse,
} from '../../../data/v2/agents';
import { MONITOR_CATCH_BASE } from '../../../data/v2/features';
import { versionById } from '../models/labs';
import { catchRate, collusionTrait } from '../models/products';
import type { AgentPackage, AgentUse, GameStateV2, ModelVersion, TraitId } from '../types';

export function initialAgents(versionId = 'V0'): Record<AgentUse, AgentPackage> {
  return {
    eng: { compute: DEFAULT_CAP_SHARES.eng },
    capRoutine: { versionId, monitorId: MONITOR_SAME, compute: DEFAULT_CAP_SHARES.capRoutine },
    capFrontier: { monitorId: MONITOR_SAME, compute: DEFAULT_CAP_SHARES.capFrontier },
    safety: { compute: 0 },
  };
}

const live = (v: ModelVersion | undefined): v is ModelVersion => !!v && v.status !== 'retired' && v.status !== 'rolledBack';
export const isCapUse = (u: AgentUse): u is CapUse => u !== 'safety';

/** The routine-research model (the production function's internal model; formerly `internalAgent`). */
export function routineVersion(s: GameStateV2): ModelVersion | undefined {
  return versionById(s, s.player.agents?.capRoutine.versionId);
}

/** Model running an internal use: its own pick when live, else the routine-research model. */
export function agentVersion(s: GameStateV2, use: AgentUse): ModelVersion | undefined {
  if (use !== 'capRoutine') {
    const id = s.player.agents[use].versionId;
    const v = id ? versionById(s, id) : undefined;
    if (live(v)) return v;
  }
  return routineVersion(s);
}

/** True when the use runs its own pick (not following routine research). */
export const followsRoutine = (s: GameStateV2, use: AgentUse) => use !== 'capRoutine' && agentVersion(s, use)?.id === routineVersion(s)?.id;

/** Monitor model of an internal use ('same' = a copy of the watched model). */
export function monitorVersion(s: GameStateV2, use: AgentUse): ModelVersion | undefined {
  const id = s.player.agents[use].monitorId;
  if (!id) return undefined;
  if (id === MONITOR_SAME) return agentVersion(s, use);
  const v = versionById(s, id);
  return live(v) ? v : undefined;
}

/** Share of the capabilities agent pool on a capabilities use (shares normalised to 1). */
export function capShare(s: GameStateV2, use: CapUse): number {
  const a = s.player.agents;
  const sum = a.eng.compute + a.capRoutine.compute + a.capFrontier.compute;
  if (Math.abs(sum - 1) < 1e-9) return a[use].compute;
  return sum > 0 ? a[use].compute / sum : DEFAULT_CAP_SHARES[use];
}

/** Share of the player's total compute running a use (capabilities uses: split.agents × share; safety: split.safety ×
 *  its share of the safety pool). */
export function agentSplitShare(s: GameStateV2, use: AgentUse): number {
  const p = s.player;
  return use === 'safety' ? p.split.safety * p.agents.safety.compute : p.split.agents * capShare(s, use);
}

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
 *  compute × the monitor's cost ratio; D7's 0.25 overhead stays the products' serving rule). */
export function monitorNeedShare(s: GameStateV2, use: AgentUse): number {
  return monitorCostRatio(s, use) * agentSplitShare(s, use);
}

export interface MonitorBudget {
  /** Compute that would watch every forward pass of the monitored fleets (share of total compute): Σ over monitored uses
   *  of the use's compute × its monitor's cost ratio. */
  need: number;
  /** The monitoring budget (policies.monitorBudget, a share of the safety pool) as a share of total compute. */
  budget: number;
  /** Share of the safety pool the monitors take (≤ the budget: what full coverage does not need stays with the lines). */
  poolShare: number;
  /** Share of the monitored fleets' forward passes the monitors watch: min(1, budget ÷ need). */
  coverage: number;
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
 * Monitors on internal uses are paid first from the safety pool (STRUCTURE §4.9: Safety funds monitors). SAFMECH: the
 * player sets the monitoring budget (policies.monitorBudget, a share of the safety pool; default MONITOR_STD_POOL_SHARE)
 * and the monitor model per use; the monitors watch the share of the fleets' forward passes that budget pays for
 * (monitorCoverage) at each monitor's cost ratio, so a distilled mini watches several times more than a copy of the
 * watched model. Coverage multiplies every monitor's catch and strength (monitorStrength). Budget beyond full coverage is
 * not spent. (Before SAFMECH the standard package cost 20% of the pool whatever it watched, at full coverage.)
 */
export function monitorBudget(s: GameStateV2): MonitorBudget {
  let need = 0;
  for (const u of AGENT_USES) need += monitorNeedShare(s, u);
  const pool = s.player.split.safety;
  const budget = Math.max(0, Math.min(1, s.player.policies.monitorBudget ?? MONITOR_STD_POOL_SHARE)) * pool;
  if (need <= 0) return { need: 0, budget, poolShare: 0, coverage: 1 };
  return { need, budget, poolShare: pool > 0 ? Math.min(budget, need) / pool : 0, coverage: monitorCoverage(budget, need, 1) };
}

/** H100e the monitor on one use takes from the safety pool. */
export function monitorH100e(s: GameStateV2, use: AgentUse, b = monitorBudget(s)): number {
  return b.need > 0 ? (s.player.computeOnline * s.player.split.safety * b.poolShare * monitorNeedShare(s, use)) / b.need : 0;
}

/** Catch rate of a use's monitor (products' rule: 85% × 0.52^gap, AG07 control tools) and its strength: coverage ×
 *  min(1, catch ÷ 85%). Strength 1 = today's runtime monitoring; 0 = no monitor. */
export function monitorStrength(s: GameStateV2, use: AgentUse, budget = monitorBudget(s)): { catch: number; strength: number; gap: number; copy: boolean; catchColl: number; strengthColl: number } {
  const mon = monitorVersion(s, use);
  const v = agentVersion(s, use);
  if (!mon || !v) return { catch: 0, strength: 0, gap: 0, copy: false, catchColl: 0, strengthColl: 0 };
  const c = catchRate(s, v, mon);
  // No oversight gap (a copy of the watched model, or one as capable) = full strength exactly.
  const q = c.gap <= 0 ? 1 : Math.min(1, c.rate / MONITOR_CATCH_BASE);
  // J2 AG1: on collusion-relevant incidents a same-lineage monitor's strength falls with its catch rate.
  const qc = q * (c.rate > 0 ? c.collusion / c.rate : 1);
  return { catch: c.rate * budget.coverage, strength: budget.coverage * q, gap: c.gap, copy: c.copy, catchColl: c.collusion * budget.coverage, strengthColl: budget.coverage * qc };
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
export function fleetMonitor(s: GameStateV2, v: ModelVersion, trait?: TraitId): number {
  let best = 0;
  let budget: MonitorBudget | undefined;
  const coll = collusionTrait(trait);
  for (const u of AGENT_USES) {
    if (!s.player.agents[u].monitorId || agentSplitShare(s, u) <= 0 || agentVersion(s, u)?.id !== v.id) continue;
    const m = monitorStrength(s, u, (budget ??= monitorBudget(s)));
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
