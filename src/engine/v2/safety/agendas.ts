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
import { CAPACITY_UNIT, PROJECT_BY_ID, SPECIALTY_BONUS, isLineNode } from '../../../data/v2/tree';
import { QUALITY } from '../../../data/v2/teams';
import { fleetMultiplier, safetyFleet, trustedShare } from './agents';
import { monitorBudget } from '../departments/agents';
import { EDGES } from '../../../data/v2/edges';
import { internalVersion } from '../models/labs';
import type { AgendaId, AgendaState, EngineSystem, GameStateV2, SafetyDept, SystemCtx, Team, TechniqueState } from '../types';
import { clamp01, flagNum, lambda2Delta, setFlag, versionById, versionM } from './common';
import { lineCycleDays, lineProjectsOf, safAllocation } from './lineProjects';
import { combineTools, driftBeliefs, observeVersion, runtimeMonitoring, safetyEvalSuite } from './detection';
import { investigationFte, investigationsStep, safetyReHeads } from './investigations';
import { patchFte } from './responses';
import { decayAt, initialTechniques, strengthTrue } from './techniques';

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

/** Share of the safety pool taken before research lines (R7): monitors on internal uses (paid first), the safety agents. */
export function safetyReserved(s: GameStateV2): number {
  return monitorBudget(s).poolShare + s.player.agents.safety.compute;
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

/** Results per year across all staffed lines, optionally at another Trusted-to-AI share (previews). */
export function resultsPerYearAt(s: GameStateV2, trusted?: number): number {
  const pol = s.player.policies;
  const saved = pol.trustedToAI;
  if (trusted !== undefined) pol.trustedToAI = trusted;
  let y = 0;
  for (const a of AGENDAS) y += lineResultsPerYear(s, a.id);
  pol.trustedToAI = saved;
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

/** Whether a tool needs upkeep now: unlocked, real, capability-sensitive, and its strength factor D(M) on the internal
 *  model is below UPKEEP_D. AG05 (oversight-gap rule) and AG09 under known latent reasoning cannot be re-validated. */
function needsUpkeep(s: GameStateV2, t: TechniqueState, M: number, latent: boolean): boolean {
  if (!t.unlocked || t.falseValidated || t.k <= 0 || t.mHalf >= 1e8 || t.agenda === 'AG05') return false;
  if (t.agenda === 'AG09' && latent) return false;
  return decayAt(s, t, M, latent) < UPKEEP_D;
}

/** Tools in upkeep now and the doubling rate of their M½ (per day) at today's free safety research engineers. */
export function upkeepState(s: GameStateV2): { tools: TechniqueState[]; perTool: number; doublingsPerDay: number; heads: number } {
  const re = safetyRe(s);
  const iv = internalVersion(s);
  if (!iv) return { tools: [], perTool: 0, doublingsPerDay: 0, heads: re.upkeep };
  const M = versionM(s, iv);
  const latent = lambda2Delta(s) <= -2;
  const tools = Object.values(s.player.safety.techniques).filter((t) => needsUpkeep(s, t, M, latent));
  const perTool = tools.length ? re.upkeep / tools.length : re.upkeep;
  // Trusted to AI speeds re-validation like any safety work (auto 1, the investigation cap).
  const tr = trustedShare(s);
  const ai = tr > 0 ? fleetMultiplier(safetyFleet(s), tr, 1, 1 + tr * 1.5) : 1;
  const doublingsPerDay = re.upkeep > 0 ? (Math.min(UPKEEP_MAX, Math.max(0, perTool - UPKEEP_MIN) / UPKEEP_REF) * ai) / UPKEEP_DAYS : 0;
  return { tools, perTool, doublingsPerDay, heads: re.upkeep };
}

/** One day of tool upkeep: every tool that needs it gets M½ × 2^rate. */
function upkeepStep(s: GameStateV2) {
  const u = upkeepState(s);
  if (!u.tools.length || u.doublingsPerDay <= 0) return;
  const f = Math.pow(2, u.doublingsPerDay);
  for (const t of u.tools) t.mHalf *= f;
}

// ───────── daily system ─────────

/** Process alignment audits queued by heavy-safety runs (WB observations of AF and SCHEME, clarity ≈ +0.15). */
function auditStep(s: GameStateV2, ctx: SystemCtx) {
  for (const [k, day] of Object.entries(s.flags)) {
    if (!k.startsWith('ws2.audit.') || typeof day !== 'number') continue;
    delete s.flags[k];
    const v = versionById(s, k.slice('ws2.audit.'.length));
    if (!v) continue;
    const M = versionM(s, v);
    const wb = Object.values(s.player.safety.techniques).filter((t) => t.agenda === 'AG02' && t.unlocked && t.family === 'WB');
    for (const trait of ['AF', 'SCHEME'] as const) {
      const d = combineTools(wb.map((t) => ({ agenda: t.agenda, d: (t.coverage[trait] ?? 0) * strengthTrue(s, t, M) })));
      observeVersion(s, ctx.rng('safety'), ctx.day, v, trait, 'WB', Math.max(0.3, d));
    }
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
