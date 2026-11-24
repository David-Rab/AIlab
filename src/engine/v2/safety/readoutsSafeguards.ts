// UB-C: SAFETY › Safeguards readouts the approved mockup needs (design/ux/mockups/rd/DATA-c.md "SAFETY › Safeguards",
// items marked NEW). Pure view functions on beliefs, measurements and facts only, never hidden truth: every stop rate is
// the believed act table's (actTable believed, the same rows SAFETY › Risks shows), and every preview runs that same
// table on a hypothetical copy of the state with one safeguard changed (no state is mutated, no RNG).
import { AGENT_USES, MONITOR_AUTO, MONITOR_SAME } from '../../../data/v2/agents';
import { COVERT_ACTS, type CovertActId } from '../../../data/v2/danger';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { agentSplitShare, agentVersion, fleetMonitor, monitorBudget, monitorVersion, useMonitor } from '../departments/agents';
import { measuredDomainOf } from '../models/labs';
import type { AgentUse, ControlSetting, Deployment, GameStateV2, ModelVersion, TraitId } from '../types';
import { actTable, type ActRow, type ActTable } from './actTable';
import { believedMonitorCatch } from './believedOversight';
import { RED_FLAG_TRAITS, versionById } from './common';
import { beliefHi } from './detection';
import { frameworkOf, worldHighL } from './framework';
import { modelLossRisk } from './lossRisk';
import { CONTROL_SETTINGS, controlComputeShare, controlOn, guardOf, isRestricted, labControlSetting, lockdownOnDep, reviewOn, totalSlowdown } from './safeguards';
import { riskTableOf, unstoppedBySeverity } from './safetyReadouts';
import { schemingReading, trustOf } from './trusted';

const USE_JOB: Record<AgentUse, string> = { eng: 'Engineering', capRoutine: 'Experiments', capFrontier: 'Ideas', safety: 'Safety' };
const liveInternal = (s: GameStateV2) => s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live');

/** A stop rate's spread over a table's act rows (the composite row and rows nothing stops are left out). */
export interface StopSpread { lo: number; hi: number; n: number }
export function stopSpread(t: ActTable | undefined, group?: ActRow['group']): StopSpread | undefined {
  const rows = (t?.rows ?? []).filter((r) => r.per !== 'exposure' && r.stopRate > 0 && (!group || r.group === group));
  if (!rows.length) return undefined;
  return { lo: Math.min(...rows.map((r) => r.stopRate)), hi: Math.max(...rows.map((r) => r.stopRate)), n: rows.length };
}

// ───────────────────────────── the deployment grid ─────────────────────────────

/** One AI staff job on the internal deployment: its model and monitor. Home: SAFETY › Safeguards grid, AI staff rows ·
 *  L1. Units: names, % watched. Basis: F (models, monitors, compute shares), M (watched share from the monitors' budget,
 *  measured levels). `sameFamily` = the monitor is of the watched model's family (copies cover for each other). */
export interface StaffJobRow {
  use: AgentUse; job: string; running: boolean; model?: string; modelId?: string;
  watcher?: string; watcherAuto: boolean; selfWatch: boolean; sameFamily: boolean; watcherTrusted?: boolean; watcherWhy?: string;
  watched: number; flag: number; monitorStop: number;
}
export function staffJobRows(s: GameStateV2): StaffJobRow[] {
  return AGENT_USES.map((u) => {
    const v = agentVersion(s, u);
    const running = !!v && agentSplitShare(s, u) > 0;
    const mon = running ? monitorVersion(s, u) : undefined;
    const m = mon ? useMonitor(s, u, undefined, true) : undefined;
    const tr = mon ? trustOf(s, mon) : undefined;
    const id = s.player.agents[u].monitorId;
    return {
      use: u, job: USE_JOB[u], running, ...(running ? { model: v!.name, modelId: v!.id } : {}),
      ...(mon ? { watcher: mon.name, watcherTrusted: tr!.trusted, watcherWhy: tr!.why } : {}),
      watcherAuto: id === MONITOR_AUTO, selfWatch: id === MONITOR_SAME || (!!mon && mon.id === v?.id), sameFamily: !!m?.c.copy,
      watched: m?.watched ?? 0, flag: m?.flag ?? 0, monitorStop: m?.stop ?? 0,
    };
  });
}

/** The internal deployment's safeguards. Home: SAFETY › Safeguards grid, AI staff row cells · L1. Units: setting, % of
 *  risky actions blocked, × on what slips past, people, % caught, % slowdown, H100e. Basis: F (items owned), B (block,
 *  catch: the believed act table's site parts). The table is the picked model's AI staff table (riskTableOf). */
export interface StaffGuards {
  depId?: string; depVersionId?: string; table?: ActTable; model?: string;
  control?: { setting: ControlSetting; label: string; block: number; missMult: number; slowdown: number; computeH100e: number };
  review?: { people: number; catch: number };
  lockdown: boolean; restricted: boolean; slowdown: number; stop?: StopSpread;
}
export function staffGuards(s: GameStateV2, versionId: string | undefined): StaffGuards {
  const d = liveInternal(s);
  const rt = riskTableOf(s, versionId);
  const t = rt?.where === 'staff' ? rt.table : undefined;
  const site = t?.site;
  const g = t?.guards ?? [];
  const cg = g.find((x) => x.kind === 'control');
  const rg = g.find((x) => x.kind === 'review');
  const setting = d ? guardOf(d, 'control')?.setting ?? 'defer10' : 'defer10';
  return {
    depId: d?.id, depVersionId: d?.versionId, table: t, model: site?.v.name,
    ...(d && controlOn(d) ? { control: { setting, label: CONTROL_SETTINGS[setting].label, block: site?.contain ?? 0, missMult: site?.controlMiss ?? 1, slowdown: cg?.slowdown ?? 0, computeH100e: staffControlH100e(s, setting) } } : {}),
    ...(d && reviewOn(d) ? { review: { people: rg?.people ?? 0, catch: site?.human ?? 0 } } : {}),
    lockdown: !!d && lockdownOnDep(d), restricted: !!d && isRestricted(d),
    slowdown: totalSlowdown(g), stop: stopSpread(t),
  };
}

/** The control protocol's trusted-model compute on all AI staff work at a setting (H100e): Σ agent compute × the
 *  deferred share × the trusted cost ratio (safeguards.ts controlComputeShare). Basis: F. */
export function staffControlH100e(s: GameStateV2, setting: ControlSetting): number {
  let share = 0;
  for (const u of AGENT_USES) share += agentSplitShare(s, u);
  return share * controlComputeShare(setting) * s.player.computeOnline;
}

/** Product deployments grouped by what guards them (same model, misuse safeguards, items and monitor). Home: SAFETY ›
 *  Safeguards grid, Products rows · L1. Units: names, %. Basis: F (items), B (stop rates from each product's believed act
 *  table: misbehaviour rows and misuse rows). */
export interface ProductGuardRow {
  ids: string[]; names: string[]; model: string; modelId: string; lineup: number;
  safeguards: Deployment['safeguards']; monitor?: string; watched: number; control?: string; restricted: boolean;
  misbehaviour?: StopSpread; misuse?: StopSpread; slowdown: number; held: boolean;
}
export function productGuardRows(s: GameStateV2): ProductGuardRow[] {
  const out: (ProductGuardRow & { key: string })[] = [];
  for (const d of s.player.deployments) {
    if (d.channel === 'internal' || d.channel === 'trusted' || d.status === 'withdrawn') continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    const lineup = ((d as { lineup?: unknown[] }).lineup ?? []).length;
    const key = JSON.stringify([d.versionId, d.safeguards, (d.guards ?? []).map((g) => `${g.kind}:${g.setting ?? ''}`).sort(), d.monitorId ?? '', lineup, !!d.held]);
    const name = PRODUCT_DEFS[d.channel]?.name ?? d.channel;
    const prev = out.find((r) => r.key === key);
    if (prev) { prev.ids.push(d.id); prev.names.push(name); continue; }
    const t = actTable(s, { deploymentId: d.id }, true);
    const mon = t?.site.monitorParts;
    const cg = guardOf(d, 'control');
    out.push({
      key, ids: [d.id], names: [name], model: v.name, modelId: v.id, lineup, safeguards: d.safeguards,
      ...(d.monitorId ? { monitor: versionById(s, d.monitorId)?.name ?? 'a monitor' } : {}), watched: mon?.watched ?? 0,
      ...(cg ? { control: CONTROL_SETTINGS[cg.setting ?? 'defer10'].label } : {}), restricted: isRestricted(d),
      misbehaviour: stopSpread(t, 'misbehaviour'), misuse: stopSpread(t, 'misuse'), slowdown: totalSlowdown(t?.guards ?? []), held: !!d.held,
    });
  }
  return out.map(({ key: _k, ...r }) => r);
}

// ───────────────────────────── stop rate, step by step ─────────────────────────────

/** The act's trait the monitor reads (a trait act: itself; a covert act: its largest believed part). */
function actTrait(v: ModelVersion, id: string): TraitId {
  const def = COVERT_ACTS[id as CovertActId];
  if (!def) return id as TraitId;
  let best: TraitId = Object.keys(def.traits)[0] as TraitId;
  let bw = -1;
  for (const [t, w] of Object.entries(def.traits) as [TraitId, number][]) { const c = w * (v.beliefs[t]?.est ?? 0); if (c > bw) { bw = c; best = t; } }
  return best;
}

/** Every 100 attempts at one act, split by what stops them. Home: SAFETY › Safeguards "Stop rate, step by step" · L1.
 *  Unit: attempts of 100 (shares 0..1 here). Basis: B (the act row's block and catch; catch = 1 − (1 − monitor)(1 −
 *  human review)·(control misses ×), so the monitor part is backed out of the row's catch with the site's human review and
 *  control terms). The parts sum to 1 and `through` = (1 − block)(1 − catch) = 1 − the row's Stop rate exactly.
 *  `instrumentSight` = what the monitor's reasoning and internals instruments read of this act's trait (believed
 *  detection: the monitor part's ÷ (½ + ½ × monitor strength)); `watched` = the watched share of the jobs' actions. */
export interface StopSteps {
  actId: string; act: string; stopRate: number;
  blocked: number; monitor: number; human: number; deferred: number; through: number;
  instrumentSight: number; watched: number; monitored: boolean; trait: TraitId;
}
export function stopSteps(s: GameStateV2, t: ActTable, actId: string): StopSteps | undefined {
  const r = t.rows.find((x) => String(x.id) === actId);
  if (!r) return undefined;
  const { site, v } = t.site;
  const b = Math.max(0, Math.min(1, r.block));
  const c = Math.max(0, Math.min(1, r.catch));
  const h = site.internal ? t.site.human : 0;
  const miss = site.internal ? t.site.controlMiss : 1;
  const m = Math.max(0, Math.min(1, 1 - (1 - c) / Math.max(1e-9, (1 - h) * miss)));
  const through = (1 - b) * (1 - c);
  const monitor = (1 - b) * m;
  const human = (1 - b) * (1 - m) * h;
  const deferred = Math.max(0, 1 - b - monitor - human - through);
  const trait = actTrait(v, actId);
  const strength = fleetMonitor(s, v, trait, true);
  const det = site.internal ? believedMonitorCatch(s, v, trait) / Math.max(1e-9, 0.5 + 0.5 * strength) : 0;
  const jobs = staffJobRows(s).filter((j) => j.running && j.modelId === v.id && j.watcher);
  return {
    actId, act: r.name, stopRate: r.stopRate, blocked: b, monitor, human, deferred, through,
    instrumentSight: Math.min(1, det), watched: jobs.length ? Math.max(...jobs.map((j) => j.watched)) : t.site.monitorParts?.watched ?? 0,
    monitored: jobs.length > 0 || !!t.site.monitorParts, trait,
  };
}

/** The act the step-by-step story opens on: of the acts against the lab a monitor can catch, the one most attempts get
 *  through on (per-year acts first), else the table's largest Unstopped row. Basis: B. */
export function stopStoryAct(t: ActTable): string | undefined {
  const rows = t.rows.filter((r) => r.per !== 'exposure' && r.attempts > 0);
  const lab = rows.filter((r) => r.group === 'lab' && r.catch > 0).sort((a, b) => (a.per === b.per ? b.unstopped - a.unstopped : a.per === 'year' ? -1 : 1));
  const any = [...rows].sort((a, b) => b.unstopped - a.unstopped);
  const r = lab[0] ?? any[0];
  return r ? String(r.id) : undefined;
}

// ───────────────────────────── previews of safeguard edits ─────────────────────────────

/** A state copy with the internal deployment's control protocol at `setting` ('off' = none); shallow: only the
 *  deployments and the AI staff packages change. */
function withStaffControl(s: GameStateV2, setting: ControlSetting | 'off'): GameStateV2 {
  const deployments = s.player.deployments.map((d) => {
    if (d.channel !== 'internal' || d.status === 'withdrawn') return d;
    const guards = (d.guards ?? []).filter((g) => g.kind !== 'control');
    if (setting !== 'off') guards.push({ kind: 'control', setting, since: guardOf(d, 'control')?.since ?? s.time.day });
    return { ...d, guards };
  });
  const agents = { ...s.player.agents };
  for (const u of AGENT_USES) agents[u] = { ...agents[u], control: setting === 'off' ? false : !!agentVersion(s, u) };
  return { ...s, player: { ...s.player, deployments, agents } };
}
/** A state copy with the monitors' allocation line at `share` of total compute (taken from the safety research line). */
function withMonitorLine(s: GameStateV2, share: number): GameStateV2 {
  const sp = { ...s.player.split };
  const v = Math.max(0, Math.min(sp.monitors + sp.safety, share));
  sp.safety -= v - sp.monitors;
  sp.monitors = v;
  return { ...s, player: { ...s.player, split: sp } };
}

/** Before → after of one safeguard edit on the picked model's AI staff work. Home: SAFETY › Safeguards levers · L1 and
 *  the control protocol drawer · L2. Units: % stop rate (on the story's act; per act; range by group), acts / yr
 *  (Unstopped harm), % (Loss-of-control risk, Slowdown), H100e. Basis: B·fc (the believed act table and
 *  Loss-of-control risk recomputed on a state copy with the edit; facts for compute). */
export interface SafeguardPreview {
  key: string; label: string; current: boolean;
  act?: { before: number; after: number };
  rows: { id: string; name: string; group: string; before: number; after: number }[];
  lab?: StopSpread; misbehaviour?: StopSpread;
  harm: { before: number; after: number }; loss: { before: number; after: number };
  slowdown: { before: number; after: number }; computeH100e: { before: number; after: number };
}
function previewOn(s: GameStateV2, s2: GameStateV2, versionId: string | undefined, actId: string | undefined, key: string, label: string, current: boolean, compute: { before: number; after: number }): SafeguardPreview | undefined {
  const a = riskTableOf(s, versionId);
  const b = riskTableOf(s2, versionId);
  if (!a || !b || a.where !== 'staff') return undefined;
  const v = versionById(s, versionId)!;
  const rows = a.table.rows.filter((r) => r.per !== 'exposure').map((r) => ({ id: String(r.id), name: r.name, group: r.group, before: r.stopRate, after: b.table.rows.find((x) => x.id === r.id)?.stopRate ?? r.stopRate }));
  const ar = actId ? rows.find((r) => r.id === actId) : undefined;
  return {
    key, label, current, ...(ar ? { act: { before: ar.before, after: ar.after } } : {}), rows,
    lab: stopSpread(b.table, 'lab'), misbehaviour: stopSpread(b.table, 'misbehaviour'),
    harm: { before: unstoppedBySeverity(a.table).acts, after: unstoppedBySeverity(b.table).acts },
    loss: { before: modelLossRisk(s, v).p, after: modelLossRisk(s2, v).p },
    slowdown: { before: totalSlowdown(a.table.guards), after: totalSlowdown(b.table.guards) },
    computeH100e: compute,
  };
}

/** Each control protocol setting (Off, Defer 10%, Defer 20%, Resample) on all AI staff work. `locked` = why it cannot be
 *  chosen yet (Resample needs its research). */
export type ControlChoice = ControlSetting | 'off';
export function controlSettingPreviews(s: GameStateV2, versionId: string | undefined, actId?: string): (SafeguardPreview & { setting: ControlChoice; locked?: string })[] {
  const d = liveInternal(s);
  if (!d) return [];
  const cur: ControlChoice = controlOn(d) ? labControlSetting(s) : 'off';
  const c0 = cur === 'off' ? 0 : staffControlH100e(s, cur);
  const out: (SafeguardPreview & { setting: ControlChoice; locked?: string })[] = [];
  for (const k of ['off', 'defer10', 'defer20', 'resample'] as const) {
    const p = previewOn(s, k === cur ? s : withStaffControl(s, k), versionId, actId, `control.${k}`, k === 'off' ? 'Off' : CONTROL_SETTINGS[k].label, k === cur, { before: c0, after: k === 'off' ? 0 : staffControlH100e(s, k) });
    if (p) out.push({ ...p, setting: k, ...(k === 'resample' && !s.player.safety.techniques['T-RESAMPLE']?.unlocked ? { locked: 'Needs Resample protocols (AI control research)' } : {}) });
  }
  return out;
}

/** Funding the monitors to watch every action of the monitored jobs: the monitors' line at control + full need.
 *  `share` = the line's share of total compute to set (agents.monitorBudget); `capped` when the safety research line
 *  cannot pay all of it. */
export function monitorFundPreview(s: GameStateV2, versionId: string | undefined, actId?: string): (SafeguardPreview & { share: number; watchedBefore: number; watchedAfter: number; capped: boolean }) | undefined {
  const mb = monitorBudget(s);
  if (mb.need <= 0 || mb.coverage >= 0.999) return undefined;
  const want = mb.control + mb.need;
  const share = Math.min(want, s.player.split.monitors + s.player.split.safety);
  const s2 = withMonitorLine(s, share);
  const mb2 = monitorBudget(s2);
  const p = previewOn(s, s2, versionId, actId, 'monitors', 'Fund monitors fully', false, { before: mb.used * s.player.computeOnline, after: mb2.used * s.player.computeOnline });
  return p ? { ...p, share: Math.round(share * 1e4) / 1e4, watchedBefore: mb.coverage, watchedAfter: mb2.coverage, capped: share < want - 1e-9 } : undefined;
}

/** Adding the comms lockdown on AI staff work (undefined when it is on, locked by research, or there is no AI staff
 *  work). Same units and basis as the other previews. */
export function lockdownPreview(s: GameStateV2, versionId: string | undefined, actId?: string): SafeguardPreview | undefined {
  const d = liveInternal(s);
  if (!d || lockdownOnDep(d) || !s.player.safety.techniques['T-LOCK']?.unlocked) return undefined;
  const deployments = s.player.deployments.map((x) => (x.id === d.id ? { ...x, guards: [...(x.guards ?? []), { kind: 'lockdown' as const, since: s.time.day }] } : x));
  return previewOn(s, { ...s, player: { ...s.player, deployments } }, versionId, actId, 'lockdown', 'Comms lockdown', false, { before: 0, after: 0 });
}

// ───────────────────────────── the framework card ─────────────────────────────

/** Each Safety framework rule against the picked model. Home: SAFETY › Safeguards framework card · L1. Units: skill
 *  levels on the job scale (median expert, best human 10), the rule's line; % for the belief rule. Basis: F (rules,
 *  holds), M (measured skill), B (the belief rule's top of range). */
export interface FrameworkRuleRow {
  id: string; label: string; holds: 'training' | 'deploy'; kind: 'capability' | 'belief';
  domain?: string; level?: number; skill?: number; medianExpert: number; bestHuman: number;
  needs: string[]; evidence: string[]; held: boolean; overridden: boolean;
  /** Belief rule: the highest top of a hidden-goal range, its trait, and whether the model is able to work around
   *  oversight (measured at the scheming-capable level; undefined = not measured). */
  topTrait?: TraitId; top?: number; able?: boolean;
}
export function frameworkRuleRows(s: GameStateV2, versionId: string | undefined): FrameworkRuleRow[] {
  const fw = frameworkOf(s);
  const v = versionById(s, versionId);
  const med = worldHighL(s);
  return fw.rules.map((r): FrameworkRuleRow => {
    const base = {
      id: r.id, label: r.label, holds: r.holds, kind: r.trigger.kind, medianExpert: med, bestHuman: 10,
      needs: [...r.safeguards] as string[], evidence: [...r.evidence] as string[],
      held: fw.holds.some((h) => h.ruleId === r.id), overridden: !!v && fw.overrides.some((o) => o.ruleId === r.id && o.versionId === v.id),
    };
    if (r.trigger.kind === 'capability') return { ...base, domain: r.trigger.domain, level: r.trigger.level, ...(v ? { skill: measuredDomainOf(s, v, r.trigger.domain) } : {}) };
    let top: { t: TraitId; hi: number } | undefined;
    if (v) for (const t of RED_FLAG_TRAITS) { const hi = beliefHi(v.beliefs[t]); if (!top || hi > top.hi) top = { t, hi }; }
    const sch = v ? schemingReading(s.hidden.timeline, v) : undefined;
    return { ...base, level: r.trigger.est, ...(top ? { topTrait: top.t, top: top.hi } : {}), ...(sch && sch.L !== undefined ? { able: !sch.below } : {}) };
  });
}
