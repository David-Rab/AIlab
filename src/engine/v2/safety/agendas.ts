// Safety research lines (agendas): staffing from the tree, compute, line health, tool upkeep, the daily safety system
// (V2-SPEC §3.5.2–3.5.3; R8, STRUCTURE §4.5). Owner: WS2.
//
// R8: a line has no funding level and no hazard. Safety science teams work its projects on the shared tree
// (models/tree.ts); model v3 E1: each project runs ideation → small experiments → validation on the frontier model
// (safety/lineProjects.ts, the capability project mechanism) and each finished validation is one result (findings.ts
// fireFinding, typed by the line's hidden efficacy). This file owns the line's capacity and multiplier (capacity ÷
// SERIOUS_CAP, the old FTE ÷ FTE_ref; AG18 healing reads it), its compute share, its results per year, its visible
// health (the Beta posterior), and tool upkeep by the safety research engineers experiments leave free.
import { AGENDAS, LINE_MULT_MAX, RE_SERIOUS, SERIOUS_CAP, UPKEEP_D, UPKEEP_DAYS, UPKEEP_MAX, UPKEEP_MIN, UPKEEP_REF } from '../../../data/v2/agendas';
import { OOM_PER_HALVING } from '../../../data/v2/oversight';
import { CAPACITY_UNIT, PROJECT_BY_ID, SPECIALTY_BONUS, isLineNode } from '../../../data/v2/tree';
import { QUALITY } from '../../../data/v2/teams';
import { safetyLabour } from '../departments/workfit';
import { safetyPoolClaims } from '../departments/agents';
import { EDGES } from '../../../data/v2/edges';
import { internalVersion } from '../models/labs';
import type { AgendaId, AgendaState, EngineSystem, GameStateV2, SafetyDept, SystemCtx, Team, TechniqueState } from '../types';
import { clamp01, flagNum, lambda2Delta, setFlag, versionById } from './common';
import { versionOom } from './oversight';
import { lineCycleDays, lineProjectsOf, safAllocation } from './lineProjects';
import { combineTools, driftBeliefs, observeVersion, runtimeMonitoring, safetyEvalSuite } from './detection';
import { investigationFte, investigationsStep, safetyReHeads } from './investigations';
import { patchFte } from './responses';
import { decayAt, initialTechniques, strengthTrue } from './techniques';
import { caseOnModel } from './footholdDetection';

/** Player safety department at game start (lines are idle until teams work their projects; models/tree.ts puts the
 *  start teams on their lines). */
export function initialSafetyDept(): SafetyDept {
  const agendas = {} as Record<AgendaId, AgendaState>;
  for (const a of AGENDAS) agendas[a.id] = { computeShare: 0, posterior: { a: a.prior[0], b: a.prior[1] }, status: 'idle', deadEndTM: 0 };
  return {
    agendas,
    techniques: initialTechniques(),
    findings: [],
    investigations: [],
    incidents: [],
    discoveredUModes: [],
    evalGate: 'full',
    monitorabilityCommitment: false,
    edgeGrades: Object.fromEntries(EDGES.map((e) => [e.id, e.grade])),
    edgeRevealed: Object.fromEntries(EDGES.map((e) => [e.id, false])),
    footholds: [],
    effectiveControl: { level: 1, exposure: 0, lowest: 1, believed: 1 },
  };
}

// ───────── staffing ─────────

/** The research line a team works on (its project's agenda), if its project is a line project. */
export function lineOfTeam(t: Pick<Team, 'projectId'>): AgendaId | undefined {
  const n = t.projectId ? PROJECT_BY_ID[t.projectId] : undefined;
  return n && isLineNode(n) ? n.agenda : undefined;
}

/** A team's capacity on a project column: heads/40 × quality × 1.5 in its specialty (models/tree.ts teamCapacity). */
export const capOn = (t: Pick<Team, 'heads' | 'quality' | 'specialty'>, column: string) =>
  (t.heads / CAPACITY_UNIT) * QUALITY[t.quality].out * (t.specialty === column ? SPECIALTY_BONUS : 1);

/** Science capacity on every project of a line (Σ over its teams). */
export function lineCapacity(s: GameStateV2, ag: AgendaId): number {
  let c = 0;
  for (const t of s.player.teams) {
    if (!t.projectId || t.role !== 'sci') continue;
    const n = PROJECT_BY_ID[t.projectId];
    if (n && n.agenda === ag && isLineNode(n)) c += capOn(t, n.column);
  }
  return c;
}

/** Line multiplier m = capacity ÷ SERIOUS_CAP (pre-R8: FTE ÷ FTE_ref; Seed 0.25, Serious 1, Major 2.5). */
export const lineMult = (s: GameStateV2, ag: AgendaId) => lineCapacity(s, ag) / SERIOUS_CAP;
/** Line multiplier capped at the old Major level (validation lead, AG18 healing). */
export const lineMultCapped = (s: GameStateV2, ag: AgendaId) => Math.min(LINE_MULT_MAX, lineMult(s, ag));

/** Teams on a line's projects. */
export const lineTeams = (s: GameStateV2, ag: AgendaId): Team[] => s.player.teams.filter((t) => t.role === 'sci' && lineOfTeam(t) === ag);
/** Whether any team works on the line (the pre-R8 "funded"). */
export const lineStaffed = (s: GameStateV2, ag: AgendaId) => s.player.teams.some((t) => t.role === 'sci' && lineOfTeam(t) === ag);

/** Safety research engineers (heads × quality) and what they do: investigations and patches first, then line
 *  experiments (model v3 E1: safety/lineProjects.ts safAllocation), the rest keeps tools validated (upkeep). */
export function safetyRe(s: GameStateV2): { heads: number; investigations: number; patches: number; experiments: number; upkeep: number } {
  const al = safAllocation(s);
  return { heads: safetyReHeads(s), investigations: investigationFte(s), patches: patchFte(s), experiments: al.exp, upkeep: al.upkeep };
}

// ───────── compute ─────────

/** Share of the safety pool taken before research lines (R7): monitors on internal uses (paid first), the safety agents
 *  (granted shares, RD-B07). */
export function safetyReserved(s: GameStateV2): number {
  const c = safetyPoolClaims(s);
  return c.monitors.granted + c.agents.granted;
}

/**
 * Line compute shares of the safety pool (model v3 E1): the pool after monitors, the safety agents and investigations is
 * shared by the line projects in experiments in proportion to their research engineers × their agenda's compute need
 * (computeRef, R14's cost column); a line not in experiments uses none (safety/lineProjects.ts safAllocation). Returns
 * the line pool (H100e).
 */
export function recomputeComputeShares(s: GameStateV2): number {
  const dept = s.player.safety;
  const al = safAllocation(s);
  const total = s.player.computeOnline * s.player.split.safety;
  for (const a of AGENDAS) dept.agendas[a.id].computeShare = total > 0 ? Math.round((((al.share[a.id] ?? 0) * al.pool) / total) * 1e4) / 1e4 : 0;
  return al.pool;
}

// ───────── progress ─────────

/** Results per year a line produces at its current staffing: Σ over its projects of their steady pipeline rate
 *  (safety/lineProjects.ts lineCycleDays). The projects' stages run in the research system (models/tree.ts). */
export function lineResultsPerYear(s: GameStateV2, ag: AgendaId): number {
  let y = 0;
  for (const id of lineProjectsOf(s, ag)) {
    const d = lineCycleDays(s, id);
    if (Number.isFinite(d) && d > 0) y += 365 / d;
  }
  return y;
}

/** Results per year across all staffed lines (previews pass a hypothetical state: the safety labour is memoised per
 *  state object). */
export function resultsPerYearAt(s: GameStateV2): number {
  let y = 0;
  for (const a of AGENDAS) y += lineResultsPerYear(s, a.id);
  return Math.round(y * 100) / 100;
}

// ───────── health ─────────

export type LineHealth = 'Promising' | 'Mixed' | 'Struggling';
/** Visible posterior band on efficacy (never e itself): mean, 90% interval, label (the line's health). */
export function posteriorBand(st: AgendaState): { mean: number; lo: number; hi: number; label: LineHealth } {
  const { a, b } = st.posterior;
  const mean = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return { mean, lo: clamp01(mean - 1.64 * sd), hi: clamp01(mean + 1.64 * sd), label: mean >= 0.55 ? 'Promising' : mean >= 0.3 ? 'Mixed' : 'Struggling' };
}

/** Promising lines with no team on them (the Research lines tab badge). */
export function promisingIdle(s: GameStateV2): AgendaId[] {
  return AGENDAS.filter((a) => posteriorBand(s.player.safety.agendas[a.id]).label === 'Promising' && !lineStaffed(s, a.id)).map((a) => a.id);
}

/** Team-months lost on dead ends, all lines. */
export const deadEndTotal = (s: GameStateV2) => Object.values(s.player.safety.agendas).reduce((a, g) => a + (g.deadEndTM ?? 0), 0);

// ───────── tool upkeep ─────────

/** Validation lead multiplier (STRUCTURE §4.5: the lead comes from safety research engineers, not funding): free safety
 *  research engineers per research line with tools in the stack, ÷ RE_SERIOUS, capped at the old Major level. The
 *  start lab (one team over four lines) is at the pre-R8 Seed level; investigations and patches take from it. */
export function reValidationMult(s: GameStateV2): number {
  const lines = new Set<AgendaId>();
  for (const t of Object.values(s.player.safety.techniques)) if (t.unlocked && t.active && !t.falseValidated) lines.add(t.agenda);
  if (!lines.size) return 0;
  return Math.min(LINE_MULT_MAX, safetyRe(s).upkeep / lines.size / RE_SERIOUS);
}

/** Whether a tool needs upkeep now: unlocked, real, capability-sensitive, and its strength factor D(x) on the internal
 *  model is below UPKEEP_D. AG05 (oversight-gap rule) and AG09 under known latent reasoning cannot be re-validated. */
function needsUpkeep(s: GameStateV2, t: TechniqueState, x: number, latent: boolean): boolean {
  if (!t.unlocked || t.falseValidated || t.k <= 0 || t.oHalf >= 1e8 || t.agenda === 'AG05') return false;
  if (t.agenda === 'AG09' && latent) return false;
  return decayAt(s, t, x, latent) < UPKEEP_D;
}

/** Tools in upkeep now and how fast their half-strength point oHalf rises (OOM per day) at today's free safety research
 *  engineers. Model v3 E6: v2's rate in M½ doublings per day × log10(2)/κ OOM per doubling (the same speed on the
 *  reference path). */
export function upkeepState(s: GameStateV2): { tools: TechniqueState[]; perTool: number; oomPerDay: number; heads: number } {
  const re = safetyRe(s);
  const iv = internalVersion(s);
  if (!iv) return { tools: [], perTool: 0, oomPerDay: 0, heads: re.upkeep };
  const x = versionOom(s, iv);
  const latent = lambda2Delta(s) <= -2;
  const tools = Object.values(s.player.safety.techniques).filter((t) => needsUpkeep(s, t, x, latent));
  const perTool = tools.length ? re.upkeep / tools.length : re.upkeep;
  // Model v3 E2: AI labour re-validates tools as the same input as the engineers (effective heads = heads × m of safety
  // experiments, SAF_EXP through the Trusted-to-AI share).
  const eff = perTool * safetyLabour(s).exp.m;
  const doublingsPerDay = re.upkeep > 0 ? Math.min(UPKEEP_MAX, Math.max(0, eff - UPKEEP_MIN) / UPKEEP_REF) / UPKEEP_DAYS : 0;
  return { tools, perTool, oomPerDay: doublingsPerDay * OOM_PER_HALVING, heads: re.upkeep };
}

/** One day of tool upkeep: every tool that needs it is re-validated further: oHalf + rate. */
function upkeepStep(s: GameStateV2) {
  const u = upkeepState(s);
  if (!u.tools.length || u.oomPerDay <= 0) return;
  for (const t of u.tools) t.oHalf += u.oomPerDay;
}

// ───────── daily system ─────────

/** Process alignment audits queued by heavy-safety runs (WB observations of AF and SCHEME, clarity ≈ +0.15). */
function auditStep(s: GameStateV2, ctx: SystemCtx) {
  for (const [k, day] of Object.entries(s.flags)) {
    if (!k.startsWith('ws2.audit.') || typeof day !== 'number') continue;
    delete s.flags[k];
    const v = versionById(s, k.slice('ws2.audit.'.length));
    if (!v) continue;
    const X = versionOom(s, v);
    const wb = Object.values(s.player.safety.techniques).filter((t) => t.agenda === 'AG02' && t.unlocked && t.family === 'WB');
    let dMax = 0;
    for (const trait of ['AF', 'SCHEME'] as const) {
      const d = combineTools(wb.map((t) => ({ agenda: t.agenda, d: (t.coverage[trait] ?? 0) * strengthTrue(s, t, X) })));
      observeVersion(s, ctx.rng('safety'), ctx.day, v, trait, 'WB', Math.max(0.3, d));
      dMax = Math.max(dMax, d);
    }
    // Model v3 E8: the audit is a case on the model at clarity = its white-box strength (footholds of its lineage).
    caseOnModel(s, ctx, v, ['AF', 'SCHEME'], Math.max(0.3, dMax), `audit:${v.id}:${ctx.day}`, 'an alignment audit');
  }
}

/** Run the behavioural safety suite whenever WS1 refreshes a version's eval suite (evals.suiteDay advances). */
function suiteHook(s: GameStateV2, ctx: SystemCtx) {
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || v.evals.suiteDay === undefined) continue;
    const key = `suite.${v.id}`;
    if (flagNum(s, key, -1e9) >= v.evals.suiteDay) continue;
    setFlag(s, key, v.evals.suiteDay);
    if (s.player.safety.evalGate === 'none' && v.evals.suiteDay > 0) continue;
    safetyEvalSuite(s, ctx.rng('safety'), ctx.day, v);
  }
}

/** safetyResearch (70, daily): line compute and status; tool upkeep; investigations; eval-suite hook; weekly runtime
 *  monitoring; belief drift. Line projects progress and resolve in the research system (models/tree.ts). U is computed
 *  on demand by understanding(). */
export const safetyResearchSystem: EngineSystem = {
  id: 'safetyResearch', owner: 'WS2', cadence: 'daily', order: 70, system: 'safety',
  run(s, ctx) {
    const dept = s.player.safety;
    recomputeComputeShares(s);
    for (const a of AGENDAS) {
      const st = dept.agendas[a.id];
      if (st.status !== 'deadEnd') st.status = lineStaffed(s, a.id) ? 'active' : 'idle';
    }
    upkeepStep(s);
    investigationsStep(s, ctx);
    auditStep(s, ctx);
    suiteHook(s, ctx);
    driftBeliefs(s);
    if (ctx.day % 7 === 0) runtimeMonitoring(s, ctx);
  },
};
