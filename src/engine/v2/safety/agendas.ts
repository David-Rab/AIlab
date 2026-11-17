// Safety research lines (agendas): staffing from the tree, compute, line health, tool upkeep, the daily safety system
// (V2-SPEC §3.5.2–3.5.3; R8, STRUCTURE §4.5). Owner: WS2.
//
// R8: a line has no funding level and no hazard. Safety science teams work its projects on the shared tree
// (models/tree.ts); each time a project's progress reaches 1 the line produces one result (findings.ts fireFinding,
// typed by the line's hidden efficacy). This file owns what the projects read: the line's capacity and multiplier
// (capacity ÷ SERIOUS_CAP, the old FTE ÷ FTE_ref), its compute, its rate, its visible health (the Beta posterior), and
// tool upkeep by safety research engineers.
import { AGENDAS, AGENDA_BY_ID, LINE_MULT_MAX, RE_SERIOUS, SERIOUS_CAP, UPKEEP_D, UPKEEP_DAYS, UPKEEP_MAX, UPKEEP_MIN, UPKEEP_REF } from '../../../data/v2/agendas';
import { CAPACITY_UNIT, PROJECT_BY_ID, SPECIALTY_BONUS, isLineNode } from '../../../data/v2/tree';
import { QUALITY } from '../../../data/v2/teams';
import { fleetMultiplier, safetyAgentVersion, safetyFleet, trustedShare } from './agents';
import { monitorBudget } from '../departments/agents';
import { EDGES } from '../../../data/v2/edges';
import { internalVersion } from '../models/labs';
import type { AgendaId, AgendaState, EngineSystem, GameStateV2, SafetyDept, SystemCtx, Team, TechniqueState } from '../types';
import { adopted, clamp01, flag, flagNum, lambda2Delta, setFlag, versionById, versionM } from './common';
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

/** Safety research engineers (heads × quality) and what they do: investigations and patches first, the rest keeps tools
 *  validated (upkeep). */
export function safetyRe(s: GameStateV2): { heads: number; investigations: number; patches: number; upkeep: number } {
  const heads = safetyReHeads(s);
  const investigations = investigationFte(s);
  const patches = patchFte(s);
  return { heads, investigations, patches, upkeep: Math.max(0, heads - investigations - patches) };
}

// ───────── compute ─────────

/** Share of the safety pool reserved for investigations. */
function investigationShare(dept: SafetyDept): number {
  return dept.investigations.filter((i) => !i.outcome).reduce((a, i) => a + i.computeShare, 0);
}

/** Share of the safety pool taken before research lines (R7): monitors on internal uses (paid first), the safety agents. */
export function safetyReserved(s: GameStateV2): number {
  return monitorBudget(s).poolShare + s.player.agents.safety.compute;
}

/** Pool left for research lines (share of total compute) and the scale applied to their requests. */
function linePool(s: GameStateV2, mOf: (ag: AgendaId) => number): { scale: number } {
  const pool = Math.max(0, s.player.split.safety * (1 - safetyReserved(s) - investigationShare(s.player.safety)));
  let req = 0;
  for (const a of AGENDAS) req += mOf(a.id) * a.computeRef;
  return { scale: req > 0 ? Math.min(1, pool / req) : 1 };
}

/**
 * Line compute shares of the safety pool: each staffed line requests m·computeRef of total compute (R14 cost column,
 * m = its line multiplier); requests are scaled down when the pool (after monitors, safety agents and investigations)
 * is too small. Returns the scale (≤ 1).
 */
export function recomputeComputeShares(s: GameStateV2): number {
  const dept = s.player.safety;
  const split = s.player.split.safety;
  const m = {} as Record<AgendaId, number>;
  for (const a of AGENDAS) m[a.id] = lineMult(s, a.id);
  const { scale } = linePool(s, (ag) => m[ag]);
  for (const a of AGENDAS) dept.agendas[a.id].computeShare = split > 0 ? Math.round(((m[a.id] * a.computeRef * scale) / split) * 1e4) / 1e4 : 0;
  return scale;
}

/** Compute ratio C/C_ref of a line (= m × pool scale), optionally at a hypothetical multiplier (previews). */
function computeRatio(s: GameStateV2, ag: AgendaId, mHyp?: number): number {
  const st = s.player.safety.agendas[ag];
  const def = AGENDA_BY_ID[ag];
  const split = s.player.split.safety;
  const cR = split > 0 ? (st.computeShare * split) / def.computeRef : 0;
  if (mHyp === undefined) return Math.max(0.05, cR);
  const m = lineMult(s, ag);
  if (m > 1e-9 && cR > 0) return Math.max(0.05, (cR * mHyp) / m);
  // Not staffed yet: what the pool would give it now.
  const { scale } = linePool(s, (x) => (x === ag ? mHyp : lineMult(s, x)));
  return Math.max(0.05, mHyp * scale);
}

// ───────── progress ─────────

/** AG17 multiplier on every line's AI-labour term while AG17 has teams [D]. */
function ag17Mult(s: GameStateV2): number {
  const m = lineMult(s, 'AG17');
  return m > 0 ? 1 + Math.sqrt(m) : 1;
}

/**
 * Progress per day of one project on a line with capacity `cap` (R8; the pre-R8 finding hazard λ, §3.5.3):
 *   rate = √(cap / SERIOUS_CAP) / (30·T₁) · (C/C_ref)^0.3 · AIx
 *   AIx = min(1 + t·Auto·min(10, M_safetyModel^0.5), √(1 + Auto·AI FTE / human FTE))   (t = Trusted to AI; agents.ts)
 * plus: dead-end lines × 0.5; F44 AARs × 3 on AG18/AG03/AG16 (with AI labour); P27 × (1 + 3·t). `lineCap` is the line's
 * total capacity for its compute (default: today's teams). Visible inputs only.
 */
export function lineRate(s: GameStateV2, ag: AgendaId, cap: number, lineCap?: number): number {
  if (cap <= 0) return 0;
  const st = s.player.safety.agendas[ag];
  const def = AGENDA_BY_ID[ag];
  const cR = computeRatio(s, ag, lineCap === undefined ? undefined : lineCap / SERIOUS_CAP);
  const auto = def.auto * ag17Mult(s);
  let aix = 1;
  const tr = trustedShare(s);
  if (tr > 0) {
    const M = versionM(s, safetyAgentVersion(s));
    aix = fleetMultiplier(safetyFleet(s), tr, auto, 1 + tr * auto * Math.min(10, Math.sqrt(M)));
  }
  let r = (Math.sqrt(cap / SERIOUS_CAP) / (30 * def.T1)) * Math.pow(Math.min(cR, 4), 0.3) * aix;
  if (st.status === 'deadEnd') r *= 0.5;
  if (flag(s, 'aar') !== undefined && tr > 0 && (ag === 'AG18' || ag === 'AG03' || ag === 'AG16')) r *= 3;
  if (adopted(s, 'P27')) r *= 1 + 3 * tr;
  return r;
}

/** Results per year a line produces at its current staffing (Σ over its projects). */
export function lineResultsPerYear(s: GameStateV2, ag: AgendaId): number {
  const caps = new Map<string, number>();
  for (const t of s.player.teams) {
    if (t.role !== 'sci' || lineOfTeam(t) !== ag) continue;
    const n = PROJECT_BY_ID[t.projectId as string];
    caps.set(n.id, (caps.get(n.id) ?? 0) + capOn(t, n.column));
  }
  let y = 0;
  for (const c of caps.values()) y += lineRate(s, ag, c) * 365;
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
