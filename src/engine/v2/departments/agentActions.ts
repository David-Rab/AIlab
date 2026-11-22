// Internal agent packages: readouts, before → after preview and actions (STRUCTURE §4.9, BUILD-PLAN R7). Owner: WS1.
//
// Home of every internal package and of Trusted to AI: Company › Agents at work (D4). Actions:
//   agents.set      {use, versionId?, monitorId? ('' none | 'same' | id), compute?}  — next tick (D7), with preview
//   agents.trusted  {share}                                                          — Trusted to AI (0–100%)
//   agents.monitorBudget {share}                                                     — SAFMECH: monitoring budget (share of the safety pool)
import {
  AGENT_USES, AGENT_USE_DEF, MONITOR_SAME, SAFETY_AGENT_DEFAULT_SHARE, SAFETY_AGENT_MAX_SHARE, type CapUse,
} from '../../../data/v2/agents';
import { decimalYear } from '../core/time';
import { measuredLOf, versionById } from '../models/labs';
import { setInternalAgent } from '../models/deployments';
import { evalProduction, labInputs, tcoPerH100eYear } from '../production/production';
import { Phi } from '../production/ces';
import { safetyFleet } from '../safety/agents';
import { believedResultThreat, believedSabotage } from '../safety/covert';
import { resultsPerYearAt } from '../safety/agendas';
import { underControl, useControl, type ControlReadout } from '../safety/oversight';
import type { ActionDef, AgentPackage, AgentUse, CostLine, GameStateV2, ModelVersion, ProductionReadout } from '../types';
import {
  agentSplitShare, agentVersion, capShare, isCapUse, monitorBudget, monitorH100e, monitorStrength, monitorVersion, riskBadges, type MonitorBudget,
  type RiskBadge,
} from './agents';
import { buildCapacity } from './teams';
import { agentFpt, copiesOf, workContext } from './workfit';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
const num = (p: Params, k: string): number | undefined => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : undefined);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const isUse = (x: string | undefined): x is AgentUse => !!x && (AGENT_USES as string[]).includes(x);
const live = (v: ModelVersion | undefined): v is ModelVersion => !!v && v.status !== 'retired' && v.status !== 'rolledBack';

/** A change to one package: model (null = follow routine research), monitor (null = none, 'same', id), compute. */
export interface AgentChange { versionId?: string | null; monitorId?: string | null; compute?: number }

/** The packages with one change applied (copies; the input is not mutated). Capabilities compute: the other two
 *  capabilities uses rescale to keep the shares summing to 1. */
export function withAgentChange(s: GameStateV2, use: AgentUse, c: AgentChange): Record<AgentUse, AgentPackage> {
  const a = Object.fromEntries(AGENT_USES.map((u) => [u, { ...s.player.agents[u] }])) as Record<AgentUse, AgentPackage>;
  const p = a[use];
  if (c.versionId !== undefined) {
    if (c.versionId) p.versionId = c.versionId;
    else if (use !== 'capRoutine') delete p.versionId;
  }
  if (c.monitorId !== undefined) {
    if (c.monitorId) p.monitorId = c.monitorId;
    else delete p.monitorId;
  }
  if (c.compute !== undefined) {
    if (!isCapUse(use)) p.compute = Math.max(0, Math.min(SAFETY_AGENT_MAX_SHARE, c.compute));
    else if (use !== 'eng') { // RD-A02: engineering's compute is its own split line (Compute › Split), not a share here
      const x = Math.max(0, Math.min(1, c.compute));
      const other = use === 'capRoutine' ? 'capFrontier' : 'capRoutine';
      a[other].compute = 1 - x;
      p.compute = x;
    }
  }
  return a;
}

/** Why a change cannot apply (undefined = fine). */
export function agentChangeBlock(s: GameStateV2, use: AgentUse, c: AgentChange): string | undefined {
  if (use === 'eng' && c.compute !== undefined) return 'Engineering agents have their own line: set it on Compute › Split';
  if (c.versionId) {
    const v = versionById(s, c.versionId);
    if (!live(v)) return 'Pick a live model';
  }
  if (c.monitorId && c.monitorId !== MONITOR_SAME && !live(versionById(s, c.monitorId))) return 'Pick a live monitor model';
  return undefined;
}

const hypo = (s: GameStateV2, agents: Record<AgentUse, AgentPackage>, trusted?: number): GameStateV2 => ({
  ...s, player: { ...s.player, agents, ...(trusted !== undefined ? { policies: { ...s.player.policies, trustedToAI: trusted } } : {}) },
});

/** Production readout at the lab's research mix, from state (no mutation). */
function productionNow(s: GameStateV2): ProductionReadout | undefined {
  const inp = labInputs(s, 'player');
  return inp ? evalProduction(s, inp) : undefined;
}

export interface AgentLane {
  use: AgentUse;
  version?: ModelVersion;
  /** Measured level of the model (inherited while evaluating). */
  L: number;
  /** True when the use follows the routine-research model (no own pick). */
  follows: boolean;
  monitor?: ModelVersion;
  /** 'same' = a copy of the watched model. */
  monitorSame: boolean;
  /** Catch rate (× coverage), monitor strength (1 = standard), oversight gap (model v3 E6: OOM of effective compute). */
  catch: number;
  /** J2 AG1: the monitor is of the watched model's lineage; its catch on collusion-relevant incidents. */
  copy: boolean;
  catchColl: number;
  strength: number;
  gap: number;
  /** Model v3 E6: the control tax on this use's AI labour under the control layer (Greenblatt et al. 2023). */
  control: ControlReadout;
  /** H100e on this use and its share of its budget (capabilities agent pool / safety pool). */
  compute: number;
  share: number;
  copies: number;
  speed: number;
  /** AI share of the role's work (engineers A_eng; research engineers 1 − wH; scientists Φ(sdAI); safety: the share AI does,
   *  Trusted to AI × SAF_* coverage, model v3 E2). */
  aiShare: number;
  /** $B/yr at the rental-equivalent price of an H100e: the agents and their monitor. */
  cost: number;
  monitorCost: number;
  monitorH100e: number;
  risk: Record<'please' | 'gaming' | 'deception' | 'power', { badge: RiskBadge; est: number; clarity: number }>;
}

export interface AgentsView {
  lanes: Record<AgentUse, AgentLane>;
  /** RD-R01: the AI labour multipliers in experiments and research ideas the research engine's next day runs at
   *  (workContext EXP / IDEAS m, what models/research.ts researchInputs reads), build capacity, AI taste (SD), safety AI FTE. */
  mExp: number;
  mIdeas: number;
  build: number;
  sdAI: number;
  safetyAiFte: number;
  /** Total agent compute and cost (all four uses and their monitors). */
  total: number;
  totalCost: number;
  /** Monitors: need as a share of total compute, share of the safety pool and coverage. */
  monitors: MonitorBudget;
  /** Trusted to AI: the policy, the share in effect (0 while no safety agents run) and the share of safety work AI does. */
  trusted: { policy: number; effective: number; aiShare: number };
}

/** Views memoised per world and inputs (the panel's buttons each preview against the same "before"). */
const viewMemo = new WeakMap<object, Map<string, AgentsView>>();
const viewKey = (s: GameStateV2) => {
  const p = s.player;
  return `${s.time.day}|${p.computeOnline}|${p.split.agents}|${p.split.safety}|${p.split.experiments}|${p.split.engineering}|${p.policies.trustedToAI}|${p.policies.monitorBudget}|${p.models.versions.length}|${p.teams.length}|${p.paradigms.P27?.status ?? ''}|${p.research.last?.x?.mExp ?? 0}|${JSON.stringify(p.agents)}|${underControl(s) ? 1 : 0}`;
};

/** Everything the Agents-at-work panel shows, for the current packages (or a hypothetical state). */
export function agentsView(s: GameStateV2): AgentsView {
  let m = viewMemo.get(s.hidden);
  if (!m) viewMemo.set(s.hidden, (m = new Map()));
  const key = viewKey(s);
  const hit = m.get(key);
  if (hit) return hit;
  if (m.size > 64) m.clear();
  const v = computeAgentsView(s);
  m.set(key, v);
  return v;
}

function computeAgentsView(s: GameStateV2): AgentsView {
  const pr = productionNow(s);
  const yr = decimalYear(s);
  const tco = tcoPerH100eYear(s, yr);
  const budget = monitorBudget(s);
  const speed = pr?.labor.speed ?? 0;
  const fleet = safetyFleet(s);
  const tr = fleet.aiShare;
  const lanes = {} as Record<AgentUse, AgentLane>;
  let total = 0;
  let totalCost = 0;
  for (const u of AGENT_USES) {
    const v = agentVersion(s, u);
    const mon = monitorVersion(s, u);
    const ms = monitorStrength(s, u, budget);
    const compute = s.player.computeOnline * agentSplitShare(s, u);
    const monH = monitorH100e(s, u, budget);
    // Model v3 V2b: engineers' AI share is the AI part of the labour margin (1 − humans' share), as for research engineers;
    // coverage has its home on Company › Work.
    const aiShare = u === 'eng' ? 1 - workContext(s).slots.SWE.wH : u === 'capRoutine' ? 1 - 1 / Math.max(1, workContext(s).slots.EXP.m) : u === 'capFrontier' ? Phi(pr?.sdAI ?? -3) : tr;
    lanes[u] = {
      use: u, version: v, L: measuredLOf(s, v).L, follows: u !== 'capRoutine' && !s.player.agents[u].versionId,
      monitor: mon, monitorSame: s.player.agents[u].monitorId === MONITOR_SAME,
      catch: ms.catch, strength: ms.strength, gap: ms.gap, copy: ms.copy, catchColl: ms.catchColl, control: useControl(s, v, mon),
      compute, share: u === 'safety' ? s.player.agents.safety.compute : capShare(s, u as CapUse),
      copies: v ? copiesOf(compute, agentFpt(s, v)) : 0, speed,
      aiShare, cost: compute * tco, monitorCost: monH * tco, monitorH100e: monH, risk: riskBadges(v),
    };
    total += compute + monH;
    totalCost += (compute + monH) * tco;
  }
  return {
    lanes, mExp: workContext(s).slots.EXP.m, mIdeas: workContext(s).slots.IDEAS.m, build: buildCapacity(s).capacity, sdAI: pr?.sdAI ?? 0, safetyAiFte: fleet.aiFte, total, totalCost,
    monitors: budget,
    trusted: { policy: s.player.policies.trustedToAI, effective: fleet.compute > 0 && fleet.versionId ? s.player.policies.trustedToAI : 0, aiShare: tr },
  };
}

export interface AgentPreview { before: AgentsView; after: AgentsView; use: AgentUse; block?: string; fromDay: number }

/** Before → after of one package change (what the next tick computes; D7). */
export function previewAgentChange(s: GameStateV2, use: AgentUse, c: AgentChange): AgentPreview {
  return { before: agentsView(s), after: agentsView(hypo(s, withAgentChange(s, use, c))), use, block: agentChangeBlock(s, use, c), fromDay: s.time.day + 1 };
}

/** Before → after of a Trusted-to-AI change (safety results per year across staffed research lines; the AI share of
 *  safety work, which weighs false results). */
export function previewTrusted(s: GameStateV2, share: number): { findingsBefore: number; findingsAfter: number; aiShareBefore: number; aiShareAfter: number } {
  const t = Math.max(0, Math.min(1, share));
  const s2 = hypo(s, startAgents(s, t), t);
  return { findingsBefore: resultsPerYearAt(s), findingsAfter: resultsPerYearAt(s2), aiShareBefore: safetyFleet(s).aiShare, aiShareAfter: safetyFleet(s2).aiShare };
}

/** Packages after turning Trusted to AI on: safety agents get the default share of the safety pool if none run. */
function startAgents(s: GameStateV2, t: number): Record<AgentUse, AgentPackage> {
  if (t > 0 && s.player.agents.safety.compute <= 0) return withAgentChange(s, 'safety', { compute: SAFETY_AGENT_DEFAULT_SHARE });
  return s.player.agents;
}

/** Change from action params (absent keys = no change; versionId '' = follow routine research; monitorId '' = none). */
function changeOf(p: Params): AgentChange {
  const c: AgentChange = {};
  const v = str(p, 'versionId');
  if (v !== undefined) c.versionId = v || null;
  const m = str(p, 'monitorId');
  if (m !== undefined) c.monitorId = m || null;
  const x = num(p, 'compute');
  if (x !== undefined) c.compute = x;
  return c;
}

const AGENTS_SET: ActionDef = {
  id: 'agents.set', verb: 'policy', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Agent package',
  available: () => true,
  preview(s, p) {
    const use = isUse(str(p, 'use')) ? (str(p, 'use') as AgentUse) : 'capRoutine';
    const pv = previewAgentChange(s, use, changeOf(p));
    const b = pv.before;
    const a = pv.after;
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    // RD-R01: the AI labour multipliers the research engine runs at tomorrow (experiments, ideas), not an aggregate M.
    for (const [k, t] of [['mExp', 'AI labour in experiments'], ['mIdeas', 'AI labour on research ideas']] as const) {
      const d = r3(a[k] / Math.max(1e-9, b[k]) - 1);
      if (d > 0) gains.push({ currency: 'progress', amount: r3(d * 100), unit: '%', target: t });
      else if (d < 0) costs.push({ currency: 'progress', amount: r3(d * 100), unit: '%', target: t });
    }
    const dCatch = r3(a.lanes[use].catch - b.lanes[use].catch);
    if (dCatch > 0) gains.push({ currency: 'alignment', amount: dCatch, target: `${AGENT_USE_DEF[use].name}: monitor catch` });
    else if (dCatch < 0) costs.push({ currency: 'alignment', amount: dCatch, target: `${AGENT_USE_DEF[use].name}: monitor catch` });
    const dMon = a.monitors.poolShare - b.monitors.poolShare;
    if (Math.abs(dMon) > 1e-6) (dMon > 0 ? costs : gains).push({ currency: 'compute', amount: r3(Math.abs(dMon) * 100), target: dMon > 0 ? '% of the safety pool to monitors' : '% of the safety pool back to safety research' });
    // RD-B18 (B33): build capacity before → after, also when a routine / frontier compute change re-normalises the
    // engineering share (withAgentChange). The old constant "security −0.05" line is gone: nothing applied it.
    const dB = r3(a.build - b.build);
    if (dB > 0) gains.push({ currency: 'staffTime', amount: dB, unit: 'team-weeks / week', target: 'build capacity' });
    else if (dB < 0) costs.push({ currency: 'staffTime', amount: dB, unit: 'team-weeks / week', target: 'build capacity' });
    // Agents run on the lab's own compute: a change that only gains costs nothing here.
    if (!costs.length) costs.push({ currency: 'compute', amount: 0, unit: 'H100e', target: 'no compute taken from another use' });
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const use = str(p, 'use');
    if (!isUse(use)) throw new Error('Pick an internal use');
    const c = changeOf(p);
    const block = agentChangeBlock(s, use, c);
    if (block) throw new Error(block);
    const next = withAgentChange(s, use, c);
    if (use === 'capRoutine' && c.versionId) {
      const err = setInternalAgent(s, c.versionId);
      if (err) throw new Error(err);
      next.capRoutine.versionId = s.player.agents.capRoutine.versionId;
    }
    s.player.agents = next;
    const v = agentVersion(s, use);
    const mon = monitorVersion(s, use);
    if (c.versionId !== undefined || c.monitorId !== undefined) ctx.log('company', `${AGENT_USE_DEF[use].name} agents: ${v?.name ?? 'none'}${mon ? `, monitored by ${s.player.agents[use].monitorId === MONITOR_SAME ? 'a copy of itself' : mon.name}` : ', no monitor'}.`, 1);
  },
};

const AGENTS_TRUSTED: ActionDef = {
  id: 'agents.trusted', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Trusted to AI',
  available: () => true,
  preview(s, p) {
    const share = Math.max(0, Math.min(1, num(p, 'share') ?? Math.min(1, s.player.policies.trustedToAI + 0.2)));
    const pv = previewTrusted(s, share);
    const sab = believedSabotage(s, pv.aiShareAfter, believedResultThreat(s));
    const dY = r3(pv.findingsAfter - pv.findingsBefore);
    const startsFleet = share > 0 && s.player.agents.safety.compute <= 0;
    return {
      costs: [{ currency: 'compute', amount: startsFleet ? SAFETY_AGENT_DEFAULT_SHARE * 100 : 0, target: startsFleet ? '% of the safety pool to start safety agents' : 'shares the safety agents' }],
      gains: dY !== 0 ? [{ currency: 'alignment', amount: dY, target: 'safety findings / yr' }] : [],
      // Model v3 E7: the safety model's sabotage attempts per result on the work it would do (covert.ts SAFSAB, from the
      // believed SAND + SCHEME and measured level): false or discarded results.
      exposure: pv.aiShareAfter > 0 ? [{ currency: 'alignment', amount: -r3(sab), probability: r3(sab), target: 'false or discarded results if the model sabotages (estimate per result)' }] : [],
    };
  },
  apply(s, ctx, p) {
    const share = num(p, 'share');
    if (share === undefined) throw new Error('Trusted to AI: give a share');
    const t = Math.max(0, Math.min(1, share));
    if (t > 0 && s.player.agents.safety.compute <= 0) {
      s.player.agents = startAgents(s, t);
      ctx.log('company', `Safety agents started on ${Math.round(SAFETY_AGENT_DEFAULT_SHARE * 100)}% of safety compute.`, 1);
    }
    s.player.policies.trustedToAI = t;
    ctx.log('company', `Trusted to AI: ${Math.round(t * 100)}% of safety work.`, 1);
  },
};

/** SAFMECH: the monitoring budget's step in the UI and its range (a share of the safety pool). */
export const MONITOR_BUDGET_STEP = 0.05;

/** Monitoring readout at a budget (share of the safety pool): coverage and H100e spent (previews; no mutation). */
export function monitorAt(s: GameStateV2, share: number): MonitorBudget & { h100e: number } {
  const h = { ...s, player: { ...s.player, policies: { ...s.player.policies, monitorBudget: share } } };
  const b = monitorBudget(h);
  return { ...b, h100e: s.player.computeOnline * s.player.split.safety * b.poolShare };
}

const AGENTS_MONITOR_BUDGET: ActionDef = {
  id: 'agents.monitorBudget', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Monitoring budget',
  available: () => true,
  preview(s, p) {
    const cur = s.player.policies.monitorBudget;
    const share = Math.max(0, Math.min(1, num(p, 'share') ?? cur + MONITOR_BUDGET_STEP));
    const a = monitorAt(s, cur);
    const b = monitorAt(s, share);
    const dH = b.h100e - a.h100e;
    const dCov = b.coverage - a.coverage;
    // Coverage = budget ÷ (watched compute × the monitor's cost ratio), capped at 1 (AI 2027 fn 51). The H100e come out
    // of (or go back to) the safety research lines.
    return {
      costs: dH > 0 ? [{ currency: 'compute', amount: Math.round(dH), unit: 'H100e', target: 'from the safety research lines to the monitors' }] : [],
      gains: [
        ...(dCov !== 0 ? [{ currency: 'alignment' as const, amount: r3(dCov), unit: 'coverage', target: `of the watched fleets' forward passes monitored (${Math.round(a.coverage * 100)}% → ${Math.round(b.coverage * 100)}%)` }] : []),
        ...(dH < 0 ? [{ currency: 'compute' as const, amount: Math.round(-dH), unit: 'H100e', target: 'back to the safety research lines' }] : []),
      ],
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const share = num(p, 'share');
    if (share === undefined) throw new Error('Monitoring budget: give a share of the safety pool');
    s.player.policies.monitorBudget = Math.max(0, Math.min(1, share));
    ctx.log('company', `Monitoring budget: ${Math.round(s.player.policies.monitorBudget * 100)}% of safety compute (coverage ${Math.round(monitorBudget(s).coverage * 100)}%).`, 1);
  },
};

export const AGENT_ACTIONS: ActionDef[] = [AGENTS_SET, AGENTS_TRUSTED, AGENTS_MONITOR_BUDGET];
