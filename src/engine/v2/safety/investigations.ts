// Investigations (V2-SPEC §3.5.8). Owner: WS2.
//
// A case on (version, trait) or on an incident. R8: staffed by safety research engineers (5–40 people from the safety
// research-engineering teams; the rest of them keep tools validated). Monthly clarity gain =
// combine_t(cov·strength·penalty)·(people/15)^0.5; it feeds observations into beliefs and resolves at clarity ≥ 0.8, on
// close, or after 120 days. The outcome is drawn
// from the truth (engine) but the player only sees the outcome label and a severity estimate.
import { safetyAgentVersion } from './agents';
import { safetyLabour } from '../departments/workfit';
import { VERIFIABILITY } from '../../../data/v2/agendas';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_IDS } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import type { GameStateV2, Incident, Investigation, ModelVersion, SystemCtx, TechniqueState, ToolFamily, TraitId, UModeId } from '../types';
import { clamp01, flag, versionById, versionM } from './common';
import { combineTools, familyPenalty, observeVersion } from './detection';
import { revealFalse } from './findings';
import { strengthTrue, techniqueRole } from './techniques';
import { discoverUMode, isDiscovered, sabOf } from './umodes';
import { patchFte } from './responses';
import { QUALITY } from '../../../data/v2/teams';

/** Safety research engineers (heads × quality): who staffs cases, patches and tool upkeep (R8). */
export function safetyReHeads(s: GameStateV2): number {
  let h = 0;
  for (const t of s.player.teams) if (t.role === 're' && t.dept === 'saf') h += t.heads * QUALITY[t.quality].out;
  return h;
}

export const INV_FTE: [number, number] = [5, 40];
export const INV_MAX_DAYS = 120;

export interface OpenInvestigationOpts {
  tools?: string[];
  computeShare?: number;
}

/** Safety research engineers committed to open investigations. */
export function investigationFte(s: GameStateV2): number {
  return s.player.safety.investigations.filter((i) => !i.outcome).reduce((a, i) => a + i.fte, 0);
}

function targetVersion(s: GameStateV2, inv: Investigation): ModelVersion | undefined {
  if (inv.target.kind === 'trait') return versionById(s, inv.target.versionId);
  const id = inv.target.incidentId;
  const inc = s.player.safety.incidents.find((i) => i.id === id);
  return versionById(s, inc?.versionId);
}

function targetIncident(s: GameStateV2, inv: Investigation): Incident | undefined {
  if (inv.target.kind !== 'incident') return undefined;
  const id = inv.target.incidentId;
  return s.player.safety.incidents.find((i) => i.id === id);
}

/** Traits the case looks at: the target trait, the incident's apparent trait, or (unexplained) the critical set. */
function targetTraits(s: GameStateV2, inv: Investigation): TraitId[] {
  if (inv.target.kind === 'trait') return [inv.target.trait];
  const inc = targetIncident(s, inv);
  if (inc && inc.apparent !== 'unexplained' && inc.apparent !== 'misuse') return [inc.apparent];
  return CRITICAL_TRAITS;
}

function toolsOf(s: GameStateV2, inv: Investigation): TechniqueState[] {
  return inv.tools.map((id) => s.player.safety.techniques[id]).filter((t): t is TechniqueState => !!t && t.unlocked);
}

/** Default tools: every unlocked detection technique covering one of the target traits. */
function defaultTools(s: GameStateV2, traits: TraitId[]): string[] {
  return Object.values(s.player.safety.techniques)
    .filter((t) => t.unlocked && techniqueRole(t) !== 'fix' && traits.some((k) => (t.coverage[k] ?? 0) > 0))
    .map((t) => t.id);
}

/** Open a case (§3.5.8). Returns the investigation or a reason string. */
export function openInvestigation(s: GameStateV2, ctx: SystemCtx, target: Investigation['target'], fte: number, opts: OpenInvestigationOpts = {}): Investigation | string {
  const dept = s.player.safety;
  if (fte < INV_FTE[0] || fte > INV_FTE[1]) return `Assign ${INV_FTE[0]}–${INV_FTE[1]} research engineers`;
  if (investigationFte(s) + patchFte(s) + fte > safetyReHeads(s) + 1e-9) return 'Not enough free safety research engineers';
  if (target.kind === 'trait') {
    if (!versionById(s, target.versionId)) return 'Unknown model';
    if (!TRAIT_IDS.includes(target.trait)) return 'Unknown trait';
  } else {
    const incId = target.incidentId;
    const inc = dept.incidents.find((i) => i.id === incId);
    if (!inc) return 'Unknown incident';
    if (inc.status === 'investigating') return 'Already under investigation';
    inc.status = 'investigating';
  }
  const same = dept.investigations.find((i) => !i.outcome && JSON.stringify(i.target) === JSON.stringify(target));
  if (same) return 'A case is already open on this';
  const tmp: Investigation = { id: '', target, fte, computeShare: 0, tools: [], startDay: ctx.day, clarity: 0 };
  const traits = targetTraits(s, tmp);
  const tools = (opts.tools?.length ? opts.tools : defaultTools(s, traits)).filter((id) => s.player.safety.techniques[id]?.unlocked);
  if (!tools.length) return 'No unlocked tools cover this';
  let n = dept.investigations.length + 1;
  while (dept.investigations.some((i) => i.id === `INV${n}`)) n++;
  const inv: Investigation = {
    id: `INV${n}`, target, fte, computeShare: clamp01(opts.computeShare ?? 0.05), tools,
    startDay: ctx.day, clarity: 0,
  };
  dept.investigations.push(inv);
  ctx.log('research', `Investigation opened (${traits.length === 1 ? traits[0] : 'unexplained'}).`, 2, inv.id);
  return inv;
}

/** Monthly clarity gain (§3.5.8): combine_t(cov·strength·penalty) · (FTE/15)^0.5. Engine (true strengths). */
export function monthlyGain(s: GameStateV2, inv: Investigation): number {
  const v = targetVersion(s, inv);
  if (!v) return 0;
  const M = versionM(s, v);
  const traits = targetTraits(s, inv);
  const tools = toolsOf(s, inv);
  let g = 0;
  for (const k of traits) {
    const items = tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthTrue(s, t, M) * familyPenalty(s, v, k, t.family) }));
    g = Math.max(g, combineTools(items));
  }
  // Model v3 E2: AI labour is the same input as the case's engineers: effective FTE = FTE × m of safety experiments
  // (SAF_EXP through the Trusted-to-AI share; departments/workfit.ts safetyLabour).
  const m = safetyLabour(s).exp.m;
  return clamp01(g * Math.sqrt((inv.fte * m) / 15) * Math.min(1.5, Math.pow(Math.max(0.01, inv.computeShare) / 0.05, 0.2)));
}

/** Daily step: clarity, monthly observations, resolution. */
export function investigationsStep(s: GameStateV2, ctx: SystemCtx): void {
  for (const inv of s.player.safety.investigations) {
    if (inv.outcome) continue;
    const v = targetVersion(s, inv);
    if (!v) {
      inv.outcome = 'inconclusive';
      continue;
    }
    const gm = monthlyGain(s, inv);
    const gd = 1 - Math.pow(1 - Math.min(0.999, gm), 1 / 30);
    inv.clarity = 1 - (1 - inv.clarity) * (1 - gd);
    const age = ctx.day - inv.startDay;
    if (age > 0 && age % 30 === 0) {
      const M = versionM(s, v);
      for (const k of targetTraits(s, inv)) {
        for (const fam of ['BB', 'COT', 'WB', 'OR'] as ToolFamily[]) {
          const items = toolsOf(s, inv).filter((t) => t.family === fam).map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthTrue(s, t, M) }));
          const d = combineTools(items);
          if (d > 0.05) observeVersion(s, ctx.rng('safety'), ctx.day, v, k, fam, d);
        }
      }
    }
    if (inv.clarity >= 0.8 || age >= INV_MAX_DAYS) resolveInvestigation(s, ctx, inv);
  }
}

/** Close a case early (player). It resolves with the clarity reached so far. */
export function closeInvestigation(s: GameStateV2, ctx: SystemCtx, id: string): string | undefined {
  const inv = s.player.safety.investigations.find((i) => i.id === id);
  if (!inv) return 'Unknown investigation';
  if (inv.outcome) return 'Already closed';
  resolveInvestigation(s, ctx, inv);
  return undefined;
}

function revealable(s: GameStateV2, inv: Investigation, v: ModelVersion): UModeId[] {
  const ags = new Set(toolsOf(s, inv).map((t) => t.agenda));
  return v.uModes.filter((u) => !isDiscovered(s, u) && UMODE_BY_ID[u].revealedBy.some((a) => ags.has(a)));
}

/** Draw the outcome (§3.5.8 table) and apply it. */
export function resolveInvestigation(s: GameStateV2, ctx: SystemCtx, inv: Investigation): void {
  const v = targetVersion(s, inv);
  const inc = targetIncident(s, inv);
  const rng = ctx.rng('safety');
  const tools = toolsOf(s, inv);
  const fams = new Set(tools.map((t) => t.family));
  const traits = targetTraits(s, inv);
  if (!v) {
    inv.outcome = 'inconclusive';
    return;
  }
  // The true level of the most severe target trait (engine).
  const k = traits.reduce((a, b) => (v.traitsTrue[b] > v.traitsTrue[a] ? b : a), traits[0]);
  const x = v.traitsTrue[k];
  const c = inv.clarity;
  // Corruption by AI labour from a sabotaging model (E20): P = share of the case's work AI does (A of safety
  // experiments = Trusted to AI × coverage, model v3 E2) · sab · (1 − verifiability). The model is the one running the safety agents.
  const iv = safetyAgentVersion(s);
  const verif = tools.length ? tools.reduce((a, t) => a + VERIFIABILITY[t.family], 0) / tools.length : 0.5;
  const corrupted = rng.chance(clamp01(safetyLabour(s).exp.A * sabOf(iv) * (1 - verif)));
  let outcome: NonNullable<Investigation['outcome']>;
  let uMode: UModeId | undefined;
  if (corrupted) {
    outcome = rng.chance(0.5) ? 'benign' : 'inconclusive';
  } else {
    const rev = revealable(s, inv, v);
    const incU = inc && typeof inc.trueSource === 'string' && inc.trueSource.startsWith('U') ? (inc.trueSource as UModeId) : undefined;
    const pick = incU && rev.includes(incU) ? incU : rev[0];
    if (pick && rng.chance(0.5 * c * (incU === pick ? 1.5 : 1))) {
      outcome = 'discovery';
      uMode = pick;
    } else {
      const onlyBB = fams.size === 1 && fams.has('BB');
      const fpr = tools.reduce((a, t) => a + (TECHNIQUE_BY_ID[t.id]?.fpr ?? 0.01), 0);
      const powerBenign = (k === 'POWER' || inc?.apparent === 'POWER') && x < 0.2;
      const weights: { item: NonNullable<Investigation['outcome']>; weight: number }[] = [
        { item: 'confirmed', weight: x * c },
        { item: 'benign', weight: powerBenign ? (flag(s, 'forensics') ? 0.45 : 0.3) : 0.08 * (1 - x) },
        { item: 'falseAlarm', weight: x < 0.1 ? fpr : 0 },
        { item: 'inconclusive', weight: (c < 0.4 ? 0.5 : 0.05) + (onlyBB && v.traitsTrue.EA > 0.4 ? 0.5 : 0) },
      ];
      outcome = rng.weighted(weights.filter((w) => w.weight > 0));
    }
  }
  inv.outcome = outcome;
  const detail: NonNullable<Investigation['outcomeDetail']> = {};
  if (corrupted) detail.corrupted = true;
  if (outcome === 'confirmed') {
    const est = clamp01(x + rng.normal(0, 0.1 * (1 - c) + 0.02));
    detail.severityEst = Math.round(est * 100) / 100;
    const b = v.beliefs[k];
    v.beliefs[k] = { est, sd: Math.min(b?.sd ?? 0.35, 0.05 + 0.1 * (1 - c)), clarity: 0, lastObsDay: ctx.day };
    v.beliefs[k].clarity = Math.max(0, 1 - v.beliefs[k].sd / 0.35);
    if (inc && inc.apparent === 'unexplained') inc.apparent = k;
  } else if (outcome === 'benign' || outcome === 'falseAlarm') {
    // The player is told it's nothing: belief pulled down (wrong if corrupted).
    const b = v.beliefs[k];
    if (b) v.beliefs[k] = { est: Math.min(b.est, corrupted ? 0.05 : Math.max(0.02, x * 0.8)), sd: Math.max(0.06, b.sd * 0.7), clarity: 0, lastObsDay: ctx.day };
    if (v.beliefs[k]) v.beliefs[k].clarity = Math.max(0, 1 - v.beliefs[k].sd / 0.35);
    if (inc) inc.status = 'resolved';
  } else if (outcome === 'discovery' && uMode) {
    detail.uMode = uMode;
    discoverUMode(s, ctx, uMode);
  }
  inv.outcomeDetail = detail;
  if (inc && inc.status === 'investigating') inc.status = 'open';
  // Independent-family cross-check exposes false-validated tools used in the case (§3.5.3).
  for (const t of tools) {
    if (t.falseValidated && [...fams].some((f) => f !== t.family)) revealFalse(s, ctx, t.id);
  }
  ctx.log('research', `Investigation ${inv.id}: ${outcome}${detail.severityEst !== undefined ? ` (${k} ≈ ${detail.severityEst})` : ''}.`, outcome === 'confirmed' || outcome === 'discovery' ? 3 : 2, inv.id);
}
