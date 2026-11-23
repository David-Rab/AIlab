// Internal agent packages: readouts, before → after preview and actions (STRUCTURE §4.9, BUILD-PLAN R7). Owner: WS1.
//
// Home of every internal package and of Trusted to AI: Company › Agents at work (D4). Actions:
//   agents.set      {use, versionId?, monitorId? ('' none | 'auto' most capable trusted (SR-20 default) | 'same' | id), compute?}  — next tick (D7), with preview
//   agents.trusted  {share}                                                          — Trusted to AI (0–100%)
//   agents.monitorBudget {share}                                                     — SAFMECH: monitoring budget (share of the safety pool)
//   agents.set {use, control: true | false}                                          — RD-A06: the control layer per package
//   tooling.build {id}                                                               — RD-A06: queue an internal tool (Coding harness …)
import {
  AGENT_USES, AGENT_USE_DEF, MONITOR_AUTO, MONITOR_SAME, SAFETY_AGENT_DEFAULT_SHARE, type CapUse,
} from '../../../data/v2/agents';
import { decimalYear } from '../core/time';
import { measuredLOf, versionById } from '../models/labs';
import { setInternalAgent } from '../models/deployments';
import { nodeKnown } from '../models/tree';
import { bookCash } from '../finance/ledger';
import { INTERNAL_TOOLS, TOOL_BY_ID, type ToolId } from '../../../data/v2/features';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { buildEtas, queueBuild } from './build';
import { evalProduction, labInputs, tcoPerH100eYear } from '../production/production';
import { Phi } from '../production/ces';
import { safetyFleet } from '../safety/agents';
import { believedResultThreat, believedSabotage } from '../safety/covert';
import { resultsPerYearAt } from '../safety/agendas';
import { underControl, useControl, type ControlReadout } from '../safety/oversight';
import { autoWatcher } from '../safety/trusted';
import type { ComputeSplit, ActionDef, AgentPackage, AgentUse, CostLine, GameStateV2, ModelVersion, ProductionReadout } from '../types';
import {
  agentSplitShare, agentVersion, capShare, monitorBudget, syncInternalControl, monitorH100e, monitorStrength, monitorVersion, riskBadges, type MonitorBudget,
  type RiskBadge,
} from './agents';
import { buildCapacity } from './teams';
import { agentFpt, copiesOf, workContext } from './workfit';
import { adopted } from '../models/paradigms';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
const num = (p: Params, k: string): number | undefined => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : undefined);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const isUse = (x: string | undefined): x is AgentUse => !!x && (AGENT_USES as string[]).includes(x);
const live = (v: ModelVersion | undefined): v is ModelVersion => !!v && v.status !== 'retired' && v.status !== 'rolledBack';

/** A change to one package: model (null = follow routine research), monitor (null = none, 'same', id), compute (RD-A05a:
 *  written to the flat allocation, splitWithChange: routine / frontier = the routine share of the research agents'
 *  compute; safety = its line as a share of total compute, taken from / given back to the safety research line). */
export interface AgentChange { versionId?: string | null; monitorId?: string | null; compute?: number; control?: boolean }

/** The packages with one change applied (copies; the input is not mutated). Compute is not part of a package
 *  (RD-A05a): splitWithChange. */
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
  if (c.control !== undefined) {
    if (c.control) p.control = true;
    else delete p.control;
  }
  return a;
}

/** The allocation with one package's compute change applied (copy; RD-A05a). */
export function splitWithChange(s: GameStateV2, use: AgentUse, c: AgentChange): ComputeSplit {
  const sp = { ...s.player.split };
  if (c.compute === undefined || use === 'eng') return sp;
  if (use === 'safety') {
    const v = Math.max(0, Math.min(sp.safetyAgents + sp.safety, c.compute));
    sp.safety -= v - sp.safetyAgents;
    sp.safetyAgents = v;
    return sp;
  }
  const r = sp.routine + sp.frontier;
  const x = Math.max(0, Math.min(1, c.compute));
  const own = use === 'capRoutine' ? x : 1 - x;
  return { ...sp, routine: r * own, frontier: r * (1 - own) };
}

/** Why a change cannot apply (undefined = fine). */
export function agentChangeBlock(s: GameStateV2, use: AgentUse, c: AgentChange): string | undefined {
  if (use === 'eng' && c.compute !== undefined) return 'Engineering agents have their own line: set it on Compute › Split';
  if (c.versionId) {
    const v = versionById(s, c.versionId);
    if (!live(v)) return 'Pick a live model';
  }
  if (c.monitorId && c.monitorId !== MONITOR_SAME && c.monitorId !== MONITOR_AUTO && !live(versionById(s, c.monitorId))) return 'Pick a live monitor model';
  return undefined;
}

const hypo = (s: GameStateV2, agents: Record<AgentUse, AgentPackage>, trusted?: number, split?: ComputeSplit): GameStateV2 => ({
  ...s, player: { ...s.player, agents, ...(split ? { split } : {}), ...(trusted !== undefined ? { policies: { ...s.player.policies, trustedToAI: trusted } } : {}) },
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
  /** RD-A06: true when the use runs the newest internal model (no own pick; departments/agents.ts newestInternal). */
  newest: boolean;
  monitor?: ModelVersion;
  /** 'same' = a copy of the watched model. */
  monitorSame: boolean;
  /** SR-20: the watcher is chosen automatically (monitorId 'auto'), with the reason (trust line, skipped models). */
  monitorAuto: boolean;
  monitorReason?: string;
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
  return `${s.time.day}|${p.computeOnline}|${(p.split.routine + p.split.frontier)}|${p.split.safety}|${p.split.experiments}|${p.split.engineering}|${p.policies.trustedToAI}|${p.split.monitors}|${p.split.safetyAgents}|${p.models.versions.length}|${p.teams.length}|${adopted(s, 'P27') ? 1 : 0}|${p.research.last?.x?.mExp ?? 0}|${JSON.stringify(p.agents)}|${underControl(s) ? 1 : 0}|${(p.tooling ?? []).join(',')}`;
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
    const ms = monitorStrength(s, u, budget, true);
    const compute = s.player.computeOnline * agentSplitShare(s, u);
    const monH = monitorH100e(s, u, budget);
    // Model v3 V2b: engineers' AI share is the AI part of the labour margin (1 − humans' share), as for research engineers;
    // coverage has its home on Company › Work.
    const aiShare = u === 'eng' ? 1 - workContext(s).slots.SWE.wH : u === 'capRoutine' ? 1 - 1 / Math.max(1, workContext(s).slots.EXP.m) : u === 'capFrontier' ? Phi(pr?.sdAI ?? -3) : tr;
    lanes[u] = {
      use: u, version: v, L: measuredLOf(s, v).L, newest: u !== 'capRoutine' && !live(versionById(s, s.player.agents[u].versionId)),
      monitor: mon, monitorSame: s.player.agents[u].monitorId === MONITOR_SAME || (s.player.agents[u].monitorId === MONITOR_AUTO && !!mon && mon.id === v?.id),
      monitorAuto: s.player.agents[u].monitorId === MONITOR_AUTO, monitorReason: s.player.agents[u].monitorId === MONITOR_AUTO ? autoWatcher(s, v).reason : undefined,
      catch: ms.catch, strength: ms.strength, gap: ms.gap, copy: ms.copy, catchColl: ms.catchColl, control: useControl(s, v, mon, !!s.player.agents[u].control, true),
      compute, share: u === 'safety' ? s.player.split.safetyAgents : capShare(s, u as CapUse),
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
  return { before: agentsView(s), after: agentsView(hypo(s, withAgentChange(s, use, c), undefined, splitWithChange(s, use, c))), use, block: agentChangeBlock(s, use, c), fromDay: s.time.day + 1 };
}

/** Before → after of a Trusted-to-AI change (safety results per year across staffed research lines; the AI share of
 *  safety work, which weighs false results). */
export function previewTrusted(s: GameStateV2, share: number): { findingsBefore: number; findingsAfter: number; aiShareBefore: number; aiShareAfter: number } {
  const t = Math.max(0, Math.min(1, share));
  const s2 = hypo(s, s.player.agents, t, startAgents(s, t));
  return { findingsBefore: resultsPerYearAt(s), findingsAfter: resultsPerYearAt(s2), aiShareBefore: safetyFleet(s).aiShare, aiShareAfter: safetyFleet(s2).aiShare };
}

/** Allocation after turning Trusted to AI on: safety agents get the default share of the safety research line if none
 *  run (taken from that line, explicitly). */
function startAgents(s: GameStateV2, t: number): ComputeSplit {
  const sp = s.player.split;
  if (t > 0 && sp.safetyAgents <= 0) return splitWithChange(s, 'safety', { compute: SAFETY_AGENT_DEFAULT_SHARE * sp.safety });
  return sp;
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
  if (typeof p.control === 'boolean') c.control = p.control;
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
    const dMon = a.monitors.used - b.monitors.used;
    if (Math.abs(dMon) > 1e-6) (dMon > 0 ? costs : gains).push({ currency: 'compute', amount: r3(Math.abs(dMon) * 100), target: dMon > 0 ? '% of compute: the monitors use more of their line' : '% of compute: the monitors use less of their line (unused, shown)' });
    const dAg = a.lanes[use].compute - b.lanes[use].compute;
    if (Math.abs(dAg) > 1e-6) (dAg > 0 ? costs : gains).push({ currency: 'compute', amount: Math.round(Math.abs(dAg)), unit: 'H100e', target: use === 'safety' ? (dAg > 0 ? 'from the safety research lines' : 'back to the safety research lines') : (dAg > 0 ? 'from the other research agents' : 'to the other research agents') });
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
    syncInternalControl(s);
    if (c.control !== undefined) ctx.log('company', `${AGENT_USE_DEF[use].name} agents: control layer ${c.control ? 'on' : 'off'}.`, 1);
    if (c.compute !== undefined) s.player.split = splitWithChange(s, use, c);
    const v = agentVersion(s, use);
    const mon = monitorVersion(s, use);
    if (c.versionId !== undefined || c.monitorId !== undefined) ctx.log('company', `${AGENT_USE_DEF[use].name} agents: ${v?.name ?? 'none'}${mon ? `, monitored by ${mon.id === v?.id ? 'a copy of itself' : mon.name}${s.player.agents[use].monitorId === MONITOR_AUTO ? ' (auto: most capable trusted model)' : ''}` : ', no monitor'}.`, 1);
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
    const startsFleet = share > 0 && s.player.split.safetyAgents <= 0;
    return {
      costs: [{ currency: 'compute', amount: startsFleet ? SAFETY_AGENT_DEFAULT_SHARE * 100 : 0, target: startsFleet ? '% of the safety research line to start safety agents' : 'shares the safety agents' }],
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
    if (t > 0 && s.player.split.safetyAgents <= 0) {
      s.player.split = startAgents(s, t);
      ctx.log('company', `Safety agents started on ${Math.round(SAFETY_AGENT_DEFAULT_SHARE * 100)}% of the safety research line.`, 1);
    }
    s.player.policies.trustedToAI = t;
    ctx.log('company', `Trusted to AI: ${Math.round(t * 100)}% of safety work.`, 1);
  },
};

/** SAFMECH: the monitoring budget's step in the UI (RD-A05a: the monitors' line, a share of total compute). */
export const MONITOR_BUDGET_STEP = 0.001;

/** The allocation with the monitors' line at `share` of total compute, the difference taken from / given back to the
 *  safety research line (capped by it). */
function withMonitors(s: GameStateV2, share: number): ComputeSplit {
  const sp = { ...s.player.split };
  const v = Math.max(0, Math.min(sp.monitors + sp.safety, share));
  sp.safety -= v - sp.monitors;
  sp.monitors = v;
  return sp;
}

/** Monitoring readout at a budget (share of total compute): coverage and H100e used (previews; no mutation). */
export function monitorAt(s: GameStateV2, share: number): MonitorBudget & { h100e: number } {
  const b = monitorBudget({ ...s, player: { ...s.player, split: withMonitors(s, share) } });
  return { ...b, h100e: s.player.computeOnline * b.used };
}

const AGENTS_MONITOR_BUDGET: ActionDef = {
  id: 'agents.monitorBudget', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Monitoring budget',
  available: () => true,
  preview(s, p) {
    const cur = s.player.split.monitors;
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
    if (share === undefined) throw new Error('Monitoring budget: give a share of total compute');
    s.player.split = withMonitors(s, share);
    ctx.log('company', `Monitoring budget: ${(s.player.split.monitors * 100).toFixed(1)}% of compute (coverage ${Math.round(monitorBudget(s).coverage * 100)}%).`, 1);
  },
};

// ───────────────────────────── internal tooling (RD-A06, DD-03) ─────────────────────────────

/** Why an internal tool cannot be queued (undefined = fine). */
export function toolBuildBlock(s: GameStateV2, id: string): string | undefined {
  const t = TOOL_BY_ID[id as ToolId];
  if (!t) return 'Unknown tool';
  if ((s.player.tooling ?? []).includes(id)) return `${t.name} is built`;
  if (s.player.build.queue.some((it) => it.kind === 'tooling' && it.ref === id)) return `${t.name} is being built`;
  if (t.node && !nodeKnown(s, t.node)) return `Needs the idea ${PROJECT_BY_ID[t.node]?.name ?? t.node} (Research)`;
  if (t.cash > s.player.finance.cash) return 'Not enough cash';
  return undefined;
}

/** Each internal tool: owned, being built (days left) or buildable (with why not). */
export function toolingView(s: GameStateV2): { id: ToolId; name: string; effect: string; buildTW: number; cash: number; owned: boolean; etaDays?: number; block?: string }[] {
  const etas = buildEtas(s).etas;
  return INTERNAL_TOOLS.map((t) => {
    const it = s.player.build.queue.find((x) => x.kind === 'tooling' && x.ref === t.id);
    const owned = (s.player.tooling ?? []).includes(t.id);
    return { id: t.id, name: t.name, effect: t.effect, buildTW: t.buildTW, cash: t.cash, owned, etaDays: it ? etas.get(it.id) : undefined, block: owned || it ? undefined : toolBuildBlock(s, t.id) };
  });
}

const TOOLING_BUILD: ActionDef = {
  id: 'tooling.build', verb: 'launch', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Build internal tool',
  available: () => true,
  preview(s, p) {
    const t = TOOL_BY_ID[(str(p, 'id') ?? 'codingHarness') as ToolId];
    const costs: CostLine[] = [{ currency: 'cash', amount: -(t?.cash ?? 0) }, { currency: 'staffTime', amount: -(t?.buildTW ?? 0), target: 'engineer team-weeks' }];
    const gains: CostLine[] = [];
    if (t && !(s.player.tooling ?? []).includes(t.id)) {
      // Once built: the research engine's AI labour multipliers and build capacity, before → after.
      const b = agentsView(s);
      const a = agentsView({ ...s, player: { ...s.player, tooling: [...(s.player.tooling ?? []), t.id] } });
      for (const [k, label] of [['mExp', 'AI labour in experiments'], ['mIdeas', 'AI labour on research ideas']] as const) {
        const d = r3(a[k] / Math.max(1e-9, b[k]) - 1);
        if (d !== 0) (d > 0 ? gains : costs).push({ currency: 'progress', amount: r3(d * 100), unit: '%', target: `${label} once built` });
      }
      const dB = r3(a.build - b.build);
      if (dB !== 0) (dB > 0 ? gains : costs).push({ currency: 'staffTime', amount: dB, unit: 'team-weeks / week', target: 'build capacity once built' });
    }
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const id = str(p, 'id') ?? '';
    const block = toolBuildBlock(s, id);
    if (block) throw new Error(block);
    const t = TOOL_BY_ID[id as ToolId];
    queueBuild(s, 'tooling', id, t.buildTW);
    if (t.cash > 0) bookCash(s, ctx, -t.cash, 'opex', 'tooling build', t.name);
    ctx.log('company', `Engineers start building ${t.name} for the internal agents.`, 1, id);
  },
};

export const AGENT_ACTIONS: ActionDef[] = [AGENTS_SET, AGENTS_TRUSTED, AGENTS_MONITOR_BUDGET, TOOLING_BUILD];
