// Safety selectors for the UI (Safety Lab, Trait Graph, Incidents). Owner: WS2.
// Everything here is what the PLAYER knows: posteriors, believed strengths, beliefs, apparent incidents, discovered
// U-modes, revealed edge weights. `safetyTruth` is the only truth selector and is for the END SCREEN only.
import { AGENDAS, AGENDA_BY_ID } from '../../../data/v2/agendas';
import { EDGES, EDGE_NOTES } from '../../../data/v2/edges';
import { FINDING_BY_ID } from '../../../data/v2/findings';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { TRAITS_V2 } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { internalVersion } from '../models/labs';
import type { AgendaId, FindingType, GameStateV2, Incident, TraitBelief, TraitId, UModeId } from '../types';
import { flagNum, mAtLevel, versionById } from './common';
import { findingHazard, fundingLevel, posteriorBand, staffFactor } from './agendas';
import { decayAt, strengthBelieved, techniqueRole } from './techniques';
import { labMisalignment, misalignment, misalignmentBand, misalignmentEstimate } from './traits';
import { nearestDecay, understanding } from './understanding';
import { exfiltrationHazard } from './incidents';

export interface AgendaRow {
  id: AgendaId; name: string; level: string; fte: number; computeShare: number; aiLabour: number;
  band: { mean: number; lo: number; hi: number; label: string }; status: string; findings: number; findingsPerYear: number;
  refresh?: { techniqueId: string; progress: number };
}
export interface TechniqueRow { id: string; name: string; agenda: AgendaId; family: string; role: string; unlocked: boolean; active: boolean; strength: number; decay: number; mHalf: number; trainedAgainst: number }
export interface FindingRow { id: string; agenda: AgendaId; type: FindingType; title: string; day: number; published: boolean; retracted: boolean }

export function agendaRows(s: GameStateV2): AgendaRow[] {
  const dept = s.player.safety;
  const staff = staffFactor(s);
  return AGENDAS.map((a) => {
    const st = dept.agendas[a.id];
    const row: AgendaRow = {
      id: a.id, name: a.name, level: fundingLevel(a.id, st), fte: st.fte, computeShare: st.computeShare, aiLabour: st.aiLabour,
      band: posteriorBand(st), status: st.status, findings: dept.findings.filter((f) => f.agenda === a.id).length,
      findingsPerYear: Math.round(findingHazard(s, a.id, staff) * 365 * 100) / 100,
    };
    if (st.refresh) row.refresh = { ...st.refresh };
    return row;
  });
}

export function techniqueRows(s: GameStateV2): TechniqueRow[] {
  const v = internalVersion(s);
  const M = mAtLevel(s.hidden.timeline, v?.evals.measuredL ?? 0);
  return Object.values(s.player.safety.techniques).map((t) => ({
    id: t.id, name: TECHNIQUE_BY_ID[t.id]?.name ?? `AI-validated ${AGENDA_BY_ID[t.agenda].name} tool`, agenda: t.agenda, family: t.family,
    role: techniqueRole(t), unlocked: t.unlocked, active: t.active, strength: Math.round(strengthBelieved(s, t, M) * 100) / 100,
    decay: Math.round(decayAt(s, t, M, false) * 100) / 100, mHalf: t.mHalf, trainedAgainst: t.trainedAgainst,
  }));
}

export function findingRows(s: GameStateV2): FindingRow[] {
  return s.player.safety.findings.map((f) => ({
    id: f.id, agenda: f.agenda, type: f.type, title: FINDING_BY_ID[f.id]?.title ?? (f.id.startsWith('DISC-') ? UMODE_BY_ID[f.id.slice(5, 8) as UModeId]?.name ?? f.id : f.id),
    day: f.day, published: f.published, retracted: f.revealedFalseDay !== undefined,
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

/** Everything the Safety Lab panel needs in one call. */
export function safetyView(s: GameStateV2) {
  const u = understanding(s);
  return {
    understanding: u,
    nextDecay: nearestDecay(s),
    agendas: agendaRows(s),
    techniques: techniqueRows(s),
    findings: findingRows(s),
    investigations: s.player.safety.investigations,
    incidents: incidentRows(s),
    uModes: uModeCards(s),
    beliefs: beliefView(s),
    evalGate: s.player.safety.evalGate,
    monitoringShare: s.player.safety.monitoringShare,
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
