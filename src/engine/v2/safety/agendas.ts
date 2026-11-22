// Safety research lines (agendas): staffing from the tree, compute, line health, tool upkeep, the daily safety system
// (V2-SPEC §3.5.2–3.5.3; R8, STRUCTURE §4.5). Owner: WS2.
//
// R8: a line has no funding level and no hazard. Safety science teams work its projects on the shared tree
// (models/tree.ts); model v3 E1: each project runs ideation → small experiments → validation on the frontier model
// (safety/lineProjects.ts, the capability project mechanism) and each finished validation is one result (findings.ts
// fireFinding, typed by the line's hidden efficacy). This file owns the line's capacity and multiplier (capacity ÷
// SERIOUS_CAP, the old FTE ÷ FTE_ref; AG18 healing reads it), its compute share, its results per year, its visible
// health (the Beta posterior). SR-09: tool upkeep is gone; validation jobs (safety/validation.ts) run in the daily system.
import { AGENDAS, LINE_MULT_MAX, SERIOUS_CAP } from '../../../data/v2/agendas';
import { PROJECT_BY_ID, isLineNode } from '../../../data/v2/tree';
import { teamCapacity } from '../departments/capacity';
import { EDGES } from '../../../data/v2/edges';
import type { AgendaId, AgendaState, EngineSystem, GameStateV2, SafetyDept, SystemCtx, Team } from '../types';
import { clamp01, flagNum, setFlag, versionById } from './common';
import { versionOom } from './oversight';
import { lineCycleDays, lineProjectsOf, safAllocation } from './lineProjects';
import { combineTools, observeVersion, runtimeMonitoring, safetyEvalSuite } from './detection';
import { investigationsStep, safetyReHeads } from './investigations';
import { initialTechniques, strengthTrue } from './techniques';
import { initialValidation, validationStep } from './validation';
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
    validation: initialValidation(),
  };
}

// ───────── staffing ─────────

/** The research line a team works on (its project's agenda), if its project is a line project. */
export function lineOfTeam(t: Pick<Team, 'projectId'>): AgendaId | undefined {
  const n = t.projectId ? PROJECT_BY_ID[t.projectId] : undefined;
  return n && isLineNode(n) ? n.agenda : undefined;
}

/** Science capacity on every project of a line (Σ over its teams). */
export function lineCapacity(s: GameStateV2, ag: AgendaId): number {
  let c = 0;
  for (const t of s.player.teams) {
    if (!t.projectId || t.role !== 'sci') continue;
    const n = PROJECT_BY_ID[t.projectId];
    if (n && n.agenda === ag && isLineNode(n)) c += teamCapacity(t, n.column);
  }
  return c;
}

/** Line multiplier m = capacity ÷ SERIOUS_CAP (pre-R8: FTE ÷ FTE_ref; Seed 0.25, Serious 1, Major 2.5). */
export const lineMult = (s: GameStateV2, ag: AgendaId) => lineCapacity(s, ag) / SERIOUS_CAP;
/** Line multiplier capped at the old Major level (AG18 healing). */
export const lineMultCapped = (s: GameStateV2, ag: AgendaId) => Math.min(LINE_MULT_MAX, lineMult(s, ag));

/** Teams on a line's projects. */
export const lineTeams = (s: GameStateV2, ag: AgendaId): Team[] => s.player.teams.filter((t) => t.role === 'sci' && lineOfTeam(t) === ag);
/** Whether any team works on the line (the pre-R8 "funded"). */
export const lineStaffed = (s: GameStateV2, ag: AgendaId) => s.player.teams.some((t) => t.role === 'sci' && lineOfTeam(t) === ag);

/** Safety research engineers (heads × quality) and what each need got today (RD-A04: one needs list in the player's
 *  order, safety/lineProjects.ts safAllocation; SR-13b: the safeguards' staff first); idle = what no need takes. */
export function safetyRe(s: GameStateV2): { heads: number; investigations: number; patches: number; safeguards: number; experiments: number; validation: number; idle: number } {
  const al = safAllocation(s);
  return { heads: safetyReHeads(s), investigations: al.got.cases, patches: al.got.patches, safeguards: al.safeguards, experiments: al.exp, validation: al.got.validation, idle: al.idle };
}

// ───────── compute ─────────

/**
 * Line compute shares of the safety pool (model v3 E1): the safety research line (split.safety, RD-A05a) after investigations is
 * shared by the line projects in experiments by need (RD-R02a: each project's engineer ask × its agenda's computeNeed, R14's
 * cost column in capability C_UNITs; a project with no engineers leaves its share unused); a line not in experiments uses none (safety/lineProjects.ts safAllocation). Returns
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
      observeVersion(s, ctx.rng('safety'), ctx.day, v, trait, 'WB', Math.max(0.3, d), 1, 'audit');
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

/** safetyResearch (70, daily): line compute and status; validation jobs (SR-09); investigations; eval-suite hook; weekly runtime
 *  monitoring (no belief drift: SR-06). Line projects progress and resolve in the research system (models/tree.ts). U is computed
 *  on demand by understanding(). */
export const safetyResearchSystem: EngineSystem = {
  id: 'safetyResearch', owner: 'WS2', cadence: 'daily', order: 70, system: 'safety',
  run(s, ctx) {
    const dept = s.player.safety;
    recomputeComputeShares(s);
    for (const a of AGENDAS) {
      const st = dept.agendas[a.id];
      st.status = lineStaffed(s, a.id) ? 'active' : 'idle';
    }
    validationStep(s, ctx);
    investigationsStep(s, ctx);
    auditStep(s, ctx);
    suiteHook(s, ctx);
    if (ctx.day % 7 === 0) runtimeMonitoring(s, ctx);
  },
};
