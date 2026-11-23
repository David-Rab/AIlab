// Safety selectors for the UI (Safety panel, Trait Graph, Incidents). Owner: WS2.
// Everything here is what the PLAYER knows: posteriors, believed strengths, beliefs, apparent incidents, discovered
// U-modes, revealed edge weights. `safetyTruth` is the only truth selector and is for the END SCREEN only.
import { AGENDAS, AGENDA_BY_ID } from '../../../data/v2/agendas';
import { lineExpectedObserved } from './workPackage';
import { EDGES, EDGE_NOTES } from '../../../data/v2/edges';
import { FINDING_BY_ID } from '../../../data/v2/findings';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { TRAITS_V2 } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { internalVersion, measuredLOf } from '../models/labs';
import type { AgendaId, FindingType, GameStateV2, SafJobResult, Incident, TraitBelief, TraitId, UModeId } from '../types';
import { flagNum, versionById } from './common';
import { levelOfOom, oomOfLevel } from './oversight';
import { deadEndTotal, lineCapacity, lineMult, lineResultsPerYear, lineTeams, posteriorBand, promisingIdle, safetyRe, type LineHealth } from './agendas';
import { decayAt, strengthBelieved, techniqueRole } from './techniques';
import { labMisalignment, misalignment, misalignmentBand, misalignmentEstimate } from './traits';
import { sightLimit } from './sightLimit';
import { exfiltrationHazard } from './incidents';
import { safetyAgentVersion, safetyFleet, trustedShare } from './agents';
import { lineLabour, safAllocation } from './lineProjects';
import { validationView } from './validation';
import { monitorBudget } from '../departments/agents';
import { RISK_FAMILIES, RISK_UNSEEN_CLARITY } from '../../../data/v2/agents';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { PROJECT_BY_ID, TREE, isLineNode, lineNodeId } from '../../../data/v2/tree';
import { nextLineProject, nodeKnown, projectEta, projectReady } from '../models/tree';

/** A research line as the Safety screen shows it (R8): health from the Beta posterior, teams, projects, results. */
export interface LineRow {
  id: AgendaId; name: string; column: string; T1: number;
  band: { mean: number; lo: number; hi: number; label: LineHealth }; status: string;
  teams: { id: string; specialty?: string; heads: number; quality: string; projectId?: string }[];
  heads: number; capacity: number; mult: number; computeShare: number; aiLabour: number;
  /** Results so far by shown type, and the total. */
  results: Partial<Record<FindingType, number>>; findings: number; resultsPerYear: number; deadEndTM: number;
  /** SR-22: the line's tests over the last year: Σ expected chance it works (beliefs before each) vs working results. */
  expObs: { n: number; expected: number; observed: number; aiShare: number };
  /** Projects with teams: progress, ETA to the next result (days). */
  projects: { id: string; name: string; progress: number; eta: number; followUp: boolean }[];
  /** Ideas of the line on the tree: known / total; the next project teams would take. */
  ideasKnown: number; ideasTotal: number; next?: string; nextReason?: string;
}
export interface TechniqueRow { id: string; name: string; agenda: AgendaId; family: string; role: string; unlocked: boolean; active: boolean; strength: number; decay: number; /** Half-strength point in OOM above V0 and as a display level (undefined = does not decay with capability; AG05 follows the overseer gap). */ oHalf: number; halfL: number | undefined; trainedAgainst: number }
export interface FindingRow { id: string; agenda: AgendaId; type: FindingType; title: string; day: number; published: boolean; retracted: boolean; nodeId?: string; job?: SafJobResult }

export function lineRows(s: GameStateV2): LineRow[] {
  const dept = s.player.safety;
  return AGENDAS.map((a) => {
    const st = dept.agendas[a.id];
    const teams = lineTeams(s, a.id);
    const results: Partial<Record<FindingType, number>> = {};
    let findings = 0;
    for (const f of dept.findings) if (f.agenda === a.id) { results[f.type] = (results[f.type] ?? 0) + 1; findings++; }
    const projIds = [...new Set(teams.map((t) => t.projectId as string))];
    const ideas = TREE.filter((n) => n.agenda === a.id && isLineNode(n));
    const next = nextLineProject(s, a.id);
    const firstOpen = ideas.find((n) => !nodeKnown(s, n.id));
    return {
      id: a.id, name: a.name, column: a.column, T1: a.T1, band: posteriorBand(st), status: st.status,
      teams: teams.map((t) => ({ id: t.id, specialty: t.specialty, heads: t.heads, quality: t.quality, projectId: t.projectId })),
      heads: teams.reduce((x, t) => x + t.heads, 0), capacity: lineCapacity(s, a.id), mult: lineMult(s, a.id), computeShare: st.computeShare,
      aiLabour: teams.length ? lineLabour(s, a.id).aiShare : 0, results, findings, resultsPerYear: Math.round(lineResultsPerYear(s, a.id) * 100) / 100, expObs: lineExpectedObserved(s, a.id),
      deadEndTM: st.deadEndTM ?? 0,
      projects: projIds.map((id) => {
        const n = id === lineNodeId(a.id) ? undefined : TREE.find((x) => x.id === id);
        const ts = s.player.tree[id];
        return { id, name: n?.name ?? `${a.name}: follow-up`, progress: ts?.status === 'researching' ? ts.progress : 0, eta: projectEta(s, id), followUp: !n };
      }),
      ideasKnown: ideas.filter((n) => nodeKnown(s, n.id)).length, ideasTotal: ideas.length,
      ...(next ? { next } : {}),
      ...(!next && firstOpen ? { nextReason: String(projectReady(s, firstOpen.id)) } : !next ? { nextReason: String(projectReady(s, lineNodeId(a.id))) } : {}),
    };
  });
}

/** Research-lines tab badges: promising lines with no team, team-months lost on dead ends. */
export function lineBadges(s: GameStateV2): { promisingIdle: AgendaId[]; deadEndTM: number } {
  return { promisingIdle: promisingIdle(s), deadEndTM: Math.round(deadEndTotal(s) * 10) / 10 };
}

/** The four risk families of a version (STRUCTURE §4.5, L1): the worst believed trait in each with its band, how clearly
 *   the tools read it and whether a case is open on it. */
export function riskFamilies(s: GameStateV2, versionId?: string) {
  const v = versionById(s, versionId) ?? internalVersion(s);
  return RISK_FAMILIES.map((f) => {
    let worst: TraitId = f.traits[0];
    let clar = 0;
    for (const t of f.traits) {
      if ((v?.beliefs[t]?.est ?? 0) > (v?.beliefs[worst]?.est ?? 0)) worst = t;
      clar += v?.beliefs[t]?.clarity ?? 0;
    }
    const b = v?.beliefs[worst];
    const est = b?.est ?? 0;
    const sd = b?.sd ?? 0.35;
    const investigating = !!v && s.player.safety.investigations.some((i) => !i.outcome && ((i.target.kind === 'trait' && i.target.versionId === v.id && f.traits.includes(i.target.trait))
      || (i.target.kind === 'incident' && s.player.safety.incidents.some((x) => x.id === (i.target as { incidentId: string }).incidentId && x.versionId === v.id && f.traits.includes(x.apparent as TraitId)))));
    return {
      id: f.id, label: f.label, traits: f.traits, worst, est, sd, lo: Math.max(0, est - 1.64 * sd), hi: Math.min(1, est + 1.64 * sd),
      clarity: clar / f.traits.length, critical: f.traits.some((t) => CRITICAL_TRAITS.includes(t)),
      // Unseen: the tools cannot read the family's beliefs (mean clarity under 0.3, as the Company risk badges).
      unseen: clar / f.traits.length < RISK_UNSEEN_CLARITY, investigating,
    };
  });
}

/** SR-09 validation (replaces tool upkeep): the jobs queue and policy (validation.ts validationView), the safety
 *  research engineers' split and how fast measured capability rises. */
export function validationPanel(s: GameStateV2) {
  const re = safetyRe(s);
  const L = measuredLOf(s, internalVersion(s)).L;
  const S = s.series;
  const n = S.Lmeasured.length;
  const back = Math.min(13, n - 1);
  const capPerMo = back > 0 ? Math.max(0, (S.Lmeasured[n - 1] - S.Lmeasured[n - 1 - back]) / (back * 7 / 30.4)) : 0;
  return { ...validationView(s), L, capPerMo, heads: re.heads, validationHeads: re.validation, investigations: re.investigations, patches: re.patches, experiments: re.experiments };
}

export function techniqueRows(s: GameStateV2): TechniqueRow[] {
  const v = internalVersion(s);
  const w = s.hidden.timeline;
  const x = oomOfLevel(w, measuredLOf(s, v).L);
  return Object.values(s.player.safety.techniques).map((t) => ({
    id: t.id, name: TECHNIQUE_BY_ID[t.id]?.name ?? `AI-validated ${AGENDA_BY_ID[t.agenda].name} tool`, agenda: t.agenda, family: t.family,
    role: techniqueRole(t), unlocked: t.unlocked, active: t.active, strength: Math.round(strengthBelieved(s, t, x) * 100) / 100,
    decay: Math.round(decayAt(s, t, x, false) * 100) / 100, oHalf: t.oHalf,
    halfL: t.k > 0 && t.oHalf < 1e8 && t.agenda !== 'AG05' ? Math.round(levelOfOom(w, t.oHalf) * 100) / 100 : undefined, trainedAgainst: t.trainedAgainst,
  }));
}

/** Title of a result with no catalog row: a discovered failure mode, a tool validated by its project, or the kind. */
function genericTitle(f: { id: string; agenda: AgendaId; type: FindingType; nodeId?: string }): string {
  if (f.id.startsWith('DISC-')) return UMODE_BY_ID[f.id.slice(5, 8) as UModeId]?.name ?? 'Discovery';
  const line = AGENDA_BY_ID[f.agenda]?.name ?? f.agenda;
  const tech = f.nodeId ? PROJECT_BY_ID[f.nodeId]?.technique : undefined;
  if ((f.type === 'TECH' || f.type === 'EVAL') && tech && TECHNIQUE_BY_ID[tech]?.unlockedBy === 'generic') return `${TECHNIQUE_BY_ID[tech].name} validated`;
  if (f.type === 'TECH') return `${line}: tools sharpened`;
  if (f.type === 'EVAL') return `${line}: evals sharpened`;
  if (f.type === 'DEAD') return `${line}: a line of attack dead-ends`;
  if (f.type === 'NEG') return `${line}: negative result`;
  return `${line}: result`;
}

export function findingRows(s: GameStateV2): FindingRow[] {
  return s.player.safety.findings.map((f) => ({
    id: f.id, agenda: f.agenda, type: f.type, title: FINDING_BY_ID[f.id]?.title ?? genericTitle(f),
    day: f.day, published: f.published, retracted: f.revealedFalseDay !== undefined, ...(f.nodeId ? { nodeId: f.nodeId } : {}), ...(f.job ? { job: f.job } : {}),
  }));
}

/** Beliefs for a version (est ± sd, clarity), the misalignment estimate and its band. */
export function beliefView(s: GameStateV2, versionId?: string): { versionId: string; beliefs: Record<TraitId, TraitBelief>; misEst: number; misBand: [number, number] } | undefined {
  const v = versionById(s, versionId) ?? internalVersion(s);
  if (!v) return undefined;
  return { versionId: v.id, beliefs: v.beliefs, misEst: misalignmentEstimate(v), misBand: misalignmentBand(v) };
}

/** Player-visible incident rows (apparent cause only; trueSource is never exposed). */
export function incidentRows(s: GameStateV2): Omit<Incident, 'trueSource'>[] {
  return s.player.safety.incidents.map(({ trueSource: _t, ...rest }) => rest);
}

/** Discovered U-mode cards. */
export function uModeCards(s: GameStateV2): { id: UModeId; name: string; mapsTo: TraitId; source: string; disclosed: boolean }[] {
  return s.player.safety.discoveredUModes.map((u) => ({ id: u, name: UMODE_BY_ID[u].name, mapsTo: UMODE_BY_ID[u].mapsTo, source: UMODE_BY_ID[u].source, disclosed: s.knowledge.revealedUModes.includes(u) }));
}

/** Trait graph: nodes, edges with grade and w̄ (or the realised weight once revealed), notes. */
export function traitGraph(s: GameStateV2) {
  const dept = s.player.safety;
  return {
    nodes: TRAITS_V2.map((t) => ({ id: t.id, name: t.name, layer: t.layer, desc: t.desc })),
    edges: EDGES.map((e) => ({
      id: e.id, from: e.from, to: e.to, grade: dept.edgeGrades[e.id] ?? e.grade, cite: e.cite, moderator: e.moderator,
      weight: dept.edgeRevealed[e.id] ? Math.round(s.hidden.edgeWeights[e.id] * 100) / 100 : e.wBar, revealed: !!dept.edgeRevealed[e.id],
    })),
    notes: EDGE_NOTES,
    signalS8: flagNum(s, 'S8'),
  };
}

/** What the safety department's people, compute and agents are doing right now (R8: science teams on research lines,
 *  research engineers on cases, patches and tool upkeep). */
export interface SafetyUtilisation {
  staff: { sci: number; onLines: number; idleSci: number; idleTeams: number; re: number; investigations: number; patches: number; validation: number; idleRe: number };
  /** H100e. idle = safety compute nobody uses (after monitoring, investigations, agents and the lines' shares). */
  compute: { pool: number; monitoring: number; investigations: number; evals: number; agents: number; idle: number };
  fleet: { versionId?: string; versionName?: string; level: number; copies: number; aiFte: number; perFte: number; automated: number; idle: boolean };
}

export function safetyUtilisation(s: GameStateV2): SafetyUtilisation {
  const dept = s.player.safety;
  let sci = 0;
  let onLines = 0;
  let idleTeams = 0;
  for (const t of s.player.teams) {
    if (t.role !== 'sci' || t.dept !== 'saf') continue;
    sci += t.heads;
    if (t.projectId) onLines += t.heads;
    else idleTeams++;
  }
  const re = safetyRe(s);
  const online = s.player.computeOnline;
  // RD-A05a: all safety compute = its three allocation lines (safety agents, monitors, safety research); the monitors'
  // unused budget and the research line's unused compute show as idle.
  const sp = s.player.split;
  const line = online * sp.safety;
  const pool = online * (sp.safety + sp.monitors + sp.safetyAgents);
  const monitoring = online * monitorBudget(s).used;
  const al = safAllocation(s); // SR-21: the safety line's sub-uses come from the needs list
  const invC = al.compute.cases.got;
  const evC = al.compute.evals.got;
  const agents = online * sp.safetyAgents;
  let got = 0;
  for (const a of AGENDAS) {
    got += line * dept.agendas[a.id].computeShare;
  }
  const fl = safetyFleet(s);
  const v = safetyAgentVersion(s);
  const automated = trustedShare(s) > 0 ? AGENDAS.filter((a) => lineTeams(s, a.id).length > 0).length + dept.investigations.filter((i) => !i.outcome).length : 0;
  return {
    staff: { sci, onLines, idleSci: sci - onLines, idleTeams, re: re.heads, investigations: re.investigations, patches: re.patches, validation: re.validation, idleRe: re.idle },
    compute: { pool, monitoring, investigations: invC, evals: evC, agents, idle: Math.max(0, pool - monitoring - invC - evC - agents - got) },
    fleet: { versionId: v?.id, versionName: v?.name, level: v?.evals.measuredL ?? 0, copies: fl.copies, aiFte: fl.aiFte, perFte: fl.perFte, automated, idle: fl.compute > 0 && automated === 0 },
  };
}

/** Everything the Safety panel needs in one call. */
export function safetyView(s: GameStateV2) {
  return {
    sightLimit: sightLimit(s),
    lines: lineRows(s),
    lineBadges: lineBadges(s),
    techniques: techniqueRows(s),
    findings: findingRows(s),
    investigations: s.player.safety.investigations,
    incidents: incidentRows(s),
    uModes: uModeCards(s),
    beliefs: beliefView(s),
    framework: s.player.safety.framework,
    utilisation: safetyUtilisation(s),
    validation: validationPanel(s),
    monitorabilityCommitment: s.player.safety.monitorabilityCommitment,
  };
}

/** END SCREEN ONLY: the hidden truth of the safety model (efficacy vs posterior, true traits and Mis per lab). */
export function safetyTruth(s: GameStateV2) {
  const v = internalVersion(s);
  return {
    latents: s.hidden.latents,
    difficultyMult: s.hidden.difficultyMult,
    efficacy: AGENDAS.map((a) => ({ id: a.id, e: s.hidden.agendaEfficacy[a.id], posterior: posteriorBand(s.player.safety.agendas[a.id]).mean })),
    internalTraits: v?.traitsTrue,
    internalUModes: v?.uModes,
    misInternal: v ? misalignment(v.traitsTrue, v.uModes) : 0,
    misByLab: Object.fromEntries(['player', ...s.rivals.map((r) => r.core.id), 'china'].map((id) => [id, labMisalignment(s, id)])),
    falseFindings: s.player.safety.findings.filter((f) => f.trueType === 'FALSE').map((f) => f.id),
    exfiltrationPerDay: exfiltrationHazard(s),
    edgeWeights: s.hidden.edgeWeights,
  };
}
