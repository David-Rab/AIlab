// Internal agent packages (STRUCTURE §4.9, BUILD-PLAN R7). Owner: WS1.
//
// Four internal uses, each a package of model + optional monitor + compute; each supplies AI labour to one work type
// (departments/workfit.ts useLabour):
//   eng          engineering agents: software engineering (SWE) → build capacity (departments/teams.ts buildCapacity)
//   capRoutine   routine research: research experiments (EXP; spare serving compute lent to research adds to it)
//   capFrontier  frontier research: research ideas (IDEAS) and the AI research taste sdAI; its compute counts in the
//                readout's k with routine's
//   safety       safety research agents (the safety work types), on a share of the safety pool
// The two research uses share the research agent pool (split.agents); their `compute` are shares of it. Engineering
// runs on its own split line (split.engineering, RD-A02; it was a share of the agent pool, traded by the Auto mix). Monitors watch internal uses, paid first from the safety pool: the monitoring budget (a share of the pool, SAFMECH)
// buys coverage = budget ÷ (watched compute × the monitor's cost ratio) (AI 2027 fn 51). A monitor's strength = coverage × min(1, catch ÷ 85%): a monitor as capable as the
// watched model, fully funded, is today's runtime monitoring exactly (strength 1).
//
// The default package (initialAgents): every use on the routine model, monitors 'same' on routine and frontier research,
// the reference compute shares (DEFAULT_CAP_SHARES).
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

/** Monitor model of an internal use ('same' = a copy of the watched model). */
export function monitorVersion(s: GameStateV2, use: AgentUse): ModelVersion | undefined {
  const id = s.player.agents[use].monitorId;
  if (!id) return undefined;
  if (id === MONITOR_SAME) return agentVersion(s, use);
  const v = versionById(s, id);
  return live(v) ? v : undefined;
}

/** Share of its pool a capabilities use runs on: engineering 1 (its own line, split.engineering); routine and frontier
 *  research their shares of the research agent pool (normalised to 1). */
export function capShare(s: GameStateV2, use: CapUse): number {
  if (use === 'eng') return 1;
  const a = s.player.agents;
  const sum = a.capRoutine.compute + a.capFrontier.compute;
  if (Math.abs(sum - 1) < 1e-9) return a[use].compute;
  return sum > 0 ? a[use].compute / sum : DEFAULT_CAP_SHARES[use];
}

/** Share of the player's total compute running a use (engineering: split.engineering; research uses: split.agents ×
 *  share; safety: split.safety × its GRANTED share of the safety pool, safetyPoolClaims). */
export function agentSplitShare(s: GameStateV2, use: AgentUse): number {
  const p = s.player;
  if (use === 'eng') return p.split.engineering ?? 0;
  return use === 'safety' ? p.split.safety * safetyAgentShare(s) : p.split.agents * capShare(s, use);
}

/** A claim on the safety pool: what the player's settings ask for and what it gets, both shares of the pool. */
export interface PoolClaim { requested: number; granted: number }
/** RD-B07 (audit B10 / INP-18): the safety pool's claims, served in priority order so they never total more than the
 *  pool. Shares of the safety pool (split.safety). */
export interface SafetyPoolClaims {
  /** Monitors (paid first): min(monitoring budget, what full coverage of the running fleets needs). Requested is that
   *  need at the requested safety-agent share, granted at the granted one (monitors do not watch compute a cut fleet no
   *  longer runs). Never cut otherwise: the budget is at most the pool. */
  monitors: PoolClaim;
  /** Open investigations (Σ computeShare), second; cut pro rata (invScale) when the monitors leave less. */
  investigations: PoolClaim;
  /** Safety agents (agents.safety.compute), third. */
  agents: PoolClaim;
  /** Research lines take the rest (requested = granted: they have no claim of their own). */
  lines: PoolClaim;
  /** granted ÷ requested of every investigation (1 when not cut). */
  invScale: number;
  /** Σ requested of monitors, investigations and agents (may exceed 1); Σ granted of all four (≤ 1). */
  requested: number;
  granted: number;
  /** Monitor need at the granted agent share, a share of TOTAL compute (monitorBudget's need). */
  need: number;
}

const openInvShare = (s: GameStateV2) => s.player.safety.investigations.filter((i) => !i.outcome).reduce((a, i) => a + i.computeShare, 0);
const budgetPolicy = (s: GameStateV2) => Math.max(0, Math.min(1, s.player.policies.monitorBudget ?? MONITOR_STD_POOL_SHARE));

/**
 * RD-B07: the safety pool served in priority order: monitors → investigations → safety agents → research lines (the
 * order the code already implied: monitors "paid first", lines "the rest"). Each claim gets min(its request, what the
 * claims before it leave), so the total is at most the pool and every cut is visible (requested vs granted). The
 * monitors' need grows with the safety agents' compute when the safety use is monitored, so a cut to the agents also
 * shrinks the monitors' claim: the agents get the largest a ≤ request with m(a) + investigations + a ≤ 1, where
 * m(a) = min(budget, capabilities uses' need + safety monitor's cost ratio × a) (piecewise linear, closed form).
 * `extraInv` adds a case being previewed (Investigate). Interim: the flat compute allocation (RD-A05a, SAFETY-REDESIGN
 * §5) replaces it.
 */
export function safetyPoolClaims(s: GameStateV2, extraInv = 0): SafetyPoolClaims {
  const p = s.player;
  const ps = p.split.safety;
  const B = budgetPolicy(s);
  const I = openInvShare(s) + Math.max(0, extraInv);
  const A = Math.max(0, p.agents.safety.compute);
  let needCap = 0; // monitor need of the capabilities uses, share of total compute
  for (const u of CAP_USES) needCap += monitorNeedShare(s, u);
  const nc = ps > 0 ? needCap / ps : 0;
  const r = monitorCostRatio(s, 'safety');
  // Monitors' pool share at agent share a, in monitorBudget's arithmetic (bit-identical when nothing is cut).
  const mon = (a: number) => (ps > 0 ? Math.min(B * ps, needCap + r * (ps * a)) / ps : 0);
  const m0 = mon(A);
  let a = A;
  let inv = I;
  if (m0 + I + A > 1) {
    const mMin = mon(0);
    if (mMin + I >= 1) {
      a = 0;
      inv = Math.max(0, 1 - mMin);
    } else {
      const room = 1 - I; // solve m(a) + a = room (increasing in a)
      const a1 = ps > 0 ? (room - nc) / (1 + r) : room; // monitors below their budget (none with an empty pool)
      a = Math.max(0, Math.min(A, ps <= 0 || nc + r * a1 <= B ? a1 : room - B));
    }
  }
  const m = mon(a);
  const lines = Math.max(0, 1 - (m + a) - inv); // linePoolH100e's old arithmetic
  return {
    monitors: { requested: m0, granted: m },
    investigations: { requested: I, granted: inv },
    agents: { requested: A, granted: a },
    lines: { requested: lines, granted: lines },
    invScale: I > 0 ? inv / I : 1,
    requested: m0 + I + A,
    granted: m + inv + a + lines,
    need: needCap + r * (ps * a),
  };
}

/** The safety agents' granted share of the safety pool (fast path: nothing can be cut while budget + cases + agents ≤ 1). */
export function safetyAgentShare(s: GameStateV2): number {
  const A = Math.max(0, s.player.agents.safety.compute);
  if (budgetPolicy(s) + openInvShare(s) + A <= 1) return A;
  return safetyPoolClaims(s).agents.granted;
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
