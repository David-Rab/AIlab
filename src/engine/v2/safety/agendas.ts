// Safety agendas: funding, finding hazards, posteriors (V2-SPEC §3.5.2–3.5.3). Owner: WS2.
import { AGENDAS, AGENDA_BY_ID, FUNDING_LEVELS, FUNDING_LEVEL_IDS, type FundingLevel } from '../../../data/v2/agendas';
import { EDGES } from '../../../data/v2/edges';
import type { AgendaId, AgendaState, EngineSystem, GameStateV2, SafetyDept, SystemCtx, TechniqueId } from '../types';
import { adopted, clamp01, flag, flagNum, setFlag, versionById, versionM } from './common';
import { combineTools, driftBeliefs, observeVersion, runtimeMonitoring, safetyEvalSuite } from './detection';
import { fireFinding } from './findings';
import { investigationFte, investigationsStep } from './investigations';
import { patchFte } from './responses';
import { initialTechniques, strengthTrue } from './techniques';

/** Agendas funded at start [D]: a 2025 frontier lab's portfolio (evals, applied interp, training-signal work at
 *  Serious; control and adversarial robustness at Seed). ≈ 85 of 140 safety FTE. */
export const START_FUNDING: Partial<Record<AgendaId, FundingLevel>> = {
  AG02: 'serious', AG07: 'seed', AG08: 'serious', AG16: 'seed', AG18: 'serious',
};

/** Player safety department at game start. */
export function initialSafetyDept(): SafetyDept {
  const agendas = {} as Record<AgendaId, AgendaState>;
  for (const a of AGENDAS) {
    const level = START_FUNDING[a.id];
    const fte = level ? Math.round(a.fteRef * FUNDING_LEVELS[level] * 10) / 10 : 0;
    agendas[a.id] = {
      fte,
      computeShare: 0,
      aiLabour: 0,
      hazardAcc: 0,
      posterior: { a: a.prior[0], b: a.prior[1] },
      status: level ? 'active' : 'idle',
    };
  }
  const dept: SafetyDept = {
    agendas,
    techniques: initialTechniques(),
    findings: [],
    investigations: [],
    incidents: [],
    discoveredUModes: [],
    evalGate: 'full',
    monitoringShare: 0.2,
    monitorabilityCommitment: false,
    edgeGrades: Object.fromEntries(EDGES.map((e) => [e.id, e.grade])),
    edgeRevealed: Object.fromEntries(EDGES.map((e) => [e.id, false])),
  };
  recomputeComputeShares(dept, 0.02);
  return dept;
}

/** Funding multiplier m = FTE / FTE_ref (Seed 0.25, Serious 1, Major 2.5). */
export function fundingMult(ag: AgendaId, st: AgendaState): number {
  return st.fte / AGENDA_BY_ID[ag].fteRef;
}

/** Nearest named funding level for display. */
export function fundingLevel(ag: AgendaId, st: AgendaState): FundingLevel {
  const m = fundingMult(ag, st);
  let best: FundingLevel = 'off';
  for (const l of FUNDING_LEVEL_IDS) if (Math.abs(FUNDING_LEVELS[l] - m) < Math.abs(FUNDING_LEVELS[best] - m)) best = l;
  return best;
}

/** Share of the safety pool reserved for investigations. */
function investigationShare(dept: SafetyDept): number {
  return dept.investigations.filter((i) => !i.outcome).reduce((a, i) => a + i.computeShare, 0);
}

/**
 * Agenda compute shares of the safety pool: each funded agenda requests m·computeRef of total compute (R14 cost
 * column); requests are scaled down when the pool (after monitoring and investigations) is too small.
 */
export function recomputeComputeShares(dept: SafetyDept, safetySplit: number): number {
  const pool = Math.max(0, safetySplit * (1 - dept.monitoringShare - investigationShare(dept)));
  let req = 0;
  for (const a of AGENDAS) req += fundingMult(a.id, dept.agendas[a.id]) * a.computeRef;
  const scale = req > 0 ? Math.min(1, pool / req) : 1;
  for (const a of AGENDAS) {
    const st = dept.agendas[a.id];
    st.computeShare = safetySplit > 0 ? Math.round(((fundingMult(a.id, st) * a.computeRef * scale) / safetySplit) * 1e4) / 1e4 : 0;
  }
  return scale;
}

/** Fraction of assigned safety FTE that actually exists (staff shortfall scales every agenda down). */
export function staffFactor(s: GameStateV2): number {
  const dept = s.player.safety;
  const assigned = Object.values(dept.agendas).reduce((a, g) => a + g.fte, 0) + investigationFte(s) + patchFte(s);
  return assigned > 0 ? Math.min(1, s.player.staff.saf / assigned) : 1;
}

/** AG17 multiplier on every agenda's AI-labour term while AG17 is funded [D]. */
function ag17Mult(s: GameStateV2): number {
  const st = s.player.safety.agendas.AG17;
  return st.fte > 0 ? 1 + Math.sqrt(fundingMult('AG17', st)) : 1;
}

/**
 * Finding hazard per day (§3.5.3):
 *   λ = (1/(30·T₁)) · (FTE/FTE_ref)^0.5 · (C/C_ref)^0.3 · (1 + aiLabour · Auto · min(10, M_internal^0.5))
 * plus: refresh projects take 30% of the staff; dead-end agendas ×0.5; F44 AARs ×3 on AG18/AG03/AG16 (with AI
 * labour); P27 × (1 + 3·aiLabour). Uses only visible inputs (FTE, compute, M from the production readout).
 */
export function findingHazard(s: GameStateV2, ag: AgendaId, staff = staffFactor(s)): number {
  const st = s.player.safety.agendas[ag];
  const def = AGENDA_BY_ID[ag];
  if (st.fte <= 0) return 0;
  const fteR = (st.fte * staff * (st.refresh ? 0.7 : 1)) / def.fteRef;
  const split = s.player.split.safety;
  const cR = Math.max(0.05, split > 0 ? (st.computeShare * split) / def.computeRef : 0);
  const M = s.player.prodCache?.M ?? 1;
  const auto = def.auto * ag17Mult(s);
  let lam = (1 / (30 * def.T1)) * Math.sqrt(fteR) * Math.pow(Math.min(cR, 4), 0.3) * (1 + st.aiLabour * auto * Math.min(10, Math.sqrt(M)));
  if (st.status === 'deadEnd') lam *= 0.5;
  if (flag(s, 'aar') !== undefined && st.aiLabour > 0 && (ag === 'AG18' || ag === 'AG03' || ag === 'AG16')) lam *= 3;
  if (adopted(s, 'P27')) lam *= 1 + 3 * st.aiLabour;
  return lam;
}

/** Visible posterior band on efficacy (never e itself): mean, 90% interval, label. */
export function posteriorBand(st: AgendaState): { mean: number; lo: number; hi: number; label: 'Promising' | 'Mixed' | 'Struggling' } {
  const { a, b } = st.posterior;
  const mean = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return { mean, lo: clamp01(mean - 1.64 * sd), hi: clamp01(mean + 1.64 * sd), label: mean >= 0.55 ? 'Promising' : mean >= 0.3 ? 'Mixed' : 'Struggling' };
}

/** Set an agenda's funding level (FTE = level × FTE_ref). Returns an error string if not allowed. */
export function setAgendaFunding(s: GameStateV2, ag: AgendaId, level: FundingLevel): string | undefined {
  const st = s.player.safety.agendas[ag];
  if (!st) return 'Unknown agenda';
  if (ag === 'AG17' && level !== 'off') {
    const v = versionById(s, s.player.models.internalAgent);
    if ((v?.evals.measuredL ?? 0) < 10) return 'Needs a model with measured level ≥ 10';
  }
  st.fte = Math.round(AGENDA_BY_ID[ag].fteRef * FUNDING_LEVELS[level] * 10) / 10;
  if (level === 'off') {
    st.status = st.status === 'deadEnd' ? 'deadEnd' : 'idle';
    st.aiLabour = 0;
    delete st.refresh;
  } else if (st.status === 'idle') st.status = 'active';
  recomputeComputeShares(s.player.safety, s.player.split.safety);
  return undefined;
}

/** Start a refresh project on a technique (§3.5.6): 2–4 months of 30% of the agenda's staff; doubles M½ up to cap. */
export function startRefresh(s: GameStateV2, techniqueId: TechniqueId): string | undefined {
  const t = s.player.safety.techniques[techniqueId];
  if (!t?.unlocked) return 'Technique not unlocked';
  const st = s.player.safety.agendas[t.agenda];
  if (st.fte <= 0) return 'Fund its agenda first';
  if (st.refresh) return 'A refresh is already running';
  if (t.mHalf >= AGENDA_BY_ID[t.agenda].mHalfCap) return 'Already at its ceiling';
  st.refresh = { techniqueId, progress: 0 };
  return undefined;
}

function refreshStep(s: GameStateV2, ctx: SystemCtx, ag: AgendaId, staff: number) {
  const st = s.player.safety.agendas[ag];
  if (!st.refresh) return;
  // ~90 days at serious funding: 2–4 months by staffing [D].
  st.refresh.progress = Math.min(1, st.refresh.progress + Math.min(1.5, Math.sqrt(Math.max(0.05, fundingMult(ag, st) * staff))) / 90);
  if (st.refresh.progress < 1) return;
  const t = s.player.safety.techniques[st.refresh.techniqueId];
  if (t) {
    t.mHalf = Math.min(AGENDA_BY_ID[ag].mHalfCap, t.mHalf * 2);
    ctx.log('research', `${AGENDA_BY_ID[ag].name}: tool re-validated on current models.`, 2, t.id);
  }
  delete st.refresh;
}

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

/** safetyResearch (70, daily): agenda hazards → findings; refresh projects; investigations; eval-suite hook;
 *  weekly runtime monitoring; belief drift. U is computed on demand by understanding(). */
export const safetyResearchSystem: EngineSystem = {
  id: 'safetyResearch', owner: 'WS2', cadence: 'daily', order: 70,
  run(s, ctx) {
    const dept = s.player.safety;
    recomputeComputeShares(dept, s.player.split.safety);
    const staff = staffFactor(s);
    const rng = ctx.rng('safety');
    for (const a of AGENDAS) {
      const st = dept.agendas[a.id];
      if (st.fte <= 0) continue;
      const lam = findingHazard(s, a.id, staff);
      st.hazardAcc += lam;
      if (rng.chance(1 - Math.exp(-lam))) fireFinding(s, ctx, a.id);
      refreshStep(s, ctx, a.id, staff);
    }
    investigationsStep(s, ctx);
    auditStep(s, ctx);
    suiteHook(s, ctx);
    driftBeliefs(s);
    if (ctx.day % 7 === 0) runtimeMonitoring(s, ctx);
  },
};
