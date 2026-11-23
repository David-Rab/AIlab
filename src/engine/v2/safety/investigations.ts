// Investigations (V2-SPEC §3.5.8). Owner: WS2.
//
// A case on (version, trait) or on an incident. R8: staffed by safety research engineers (5–40 people from the safety
// research-engineering teams). RF-S12 (SAFETY-REDESIGN §3.6, §6 #7): a case is a job of CASE_WORK engineer-days; each
// day it gets its engineers as served by the needs list × m of safety experiments (AI labour) × its compute served.
// When the work is done (or the case is closed, or INV_MAX_DAYS pass) it concludes: one reading per instrument family
// into beliefs, and a verdict whose odds come from the chosen instruments' combined reliability on the target traits
// (combineTools: coverage × strength × family penalty, the ρ = 0.5 rule between same-assumption tools) × the share of
// the work done. The outcome is drawn from the truth (engine) but the player only sees the outcome label and a
// severity estimate.
import { safetyLabour } from '../departments/workfit';
import { VERIFIABILITY } from '../../../data/v2/agendas';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_IDS } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import type { CaseChange, GameStateV2, Incident, Investigation, ModelVersion, SystemCtx, TechniqueState, ToolFamily, TraitId, UModeId } from '../types';
import { clamp01, flag, versionById } from './common';
import { versionOom } from './oversight';
import { combineTools, familyPenalty, observeVersion, withEvidence } from './detection';
import { revealFalse } from './findings';
import { strengthTrue, techniqueRole } from './techniques';
import { discoverUMode, isDiscovered } from './umodes';
import { caseThreat, safetySabotage } from './covert';
import { removalFte } from './footholds';
import { caseOnModel } from './footholdDetection';
import { casesServed, safAllocation } from './lineProjects';
import { QUALITY } from '../../../data/v2/teams';
import { labReviewOn, reviewStaff } from './safeguards';
import { aiRdShare } from './incidents';
import { jobAiShare, jobRecord } from './workPackage';

/** Safety research engineers (heads × quality): who staffs cases, patches and tool upkeep (R8). */
export function safetyReHeads(s: GameStateV2): number {
  let h = 0;
  for (const t of s.player.teams) if (t.role === 're' && t.dept === 'saf') h += t.heads * QUALITY[t.quality].out;
  return h;
}

/** SR-13b: safety research engineers the safeguards need (the "safeguards" line of the safety needs list): human review
 *  on the lab's internal work takes reviewStaff(human share of R&D), the people cost its safeguard line shows. */
export function safeguardFte(s: GameStateV2): number {
  return labReviewOn(s) ? reviewStaff(1 - aiRdShare(s)) : 0;
}
/** Safety research engineers committed before line experiments: investigations, foothold removals and safeguards. */
export const committedFte = (s: GameStateV2) => investigationFte(s) + removalFte(s) + safeguardFte(s);

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
export function defaultTools(s: GameStateV2, traits: TraitId[]): string[] {
  return Object.values(s.player.safety.techniques)
    .filter((t) => t.unlocked && techniqueRole(t) !== 'fix' && traits.some((k) => (t.coverage[k] ?? 0) > 0))
    .map((t) => t.id);
}

/** Open a case (§3.5.8). Returns the investigation or a reason string. */
export function openInvestigation(s: GameStateV2, ctx: SystemCtx, target: Investigation['target'], fte: number, opts: OpenInvestigationOpts = {}): Investigation | string {
  const dept = s.player.safety;
  if (fte < INV_FTE[0] || fte > INV_FTE[1]) return `Assign ${INV_FTE[0]}–${INV_FTE[1]} research engineers`;
  if (committedFte(s) + fte > safetyReHeads(s) + 1e-9) return 'Not enough free safety research engineers';
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
  const tmp: Investigation = { id: '', target, fte, computeShare: 0, tools: [], startDay: ctx.day, progress: 0 };
  const traits = targetTraits(s, tmp);
  const tools = (opts.tools?.length ? opts.tools : defaultTools(s, traits)).filter((id) => s.player.safety.techniques[id]?.unlocked);
  if (!tools.length) return 'No unlocked tools cover this';
  let n = dept.investigations.length + 1;
  while (dept.investigations.some((i) => i.id === `INV${n}`)) n++;
  const v0 = targetVersion(s, tmp);
  const before: Investigation['before'] = {};
  for (const k of traits) {
    const b = v0?.beliefs[k];
    if (b) before[k] = { est: b.est, sd: b.sd };
  }
  const inv: Investigation = {
    id: `INV${n}`, target, fte, computeShare: clamp01(opts.computeShare ?? 0.05), tools,
    startDay: ctx.day, progress: 0, before, readings: 0,
    // SR-22: expected = the believed level of the most severe target trait at opening (the case's chance to find it).
    job: jobRecord(s, jobAiShare(s, 'case'), Math.max(0, ...Object.values(before).map((b) => b?.est ?? 0))),
  };
  dept.investigations.push(inv);
  ctx.log('research', `Investigation opened (${traits.length === 1 ? traits[0] : 'unexplained'}).`, 2, inv.id);
  return inv;
}

/** RF-S12: a case's work in engineer-days [stand-in, proxy: research/RD-SR24-safety-params.md C1, C3: an audit is
 *  0.2–30 person-days (Marks et al. 2025: 1.5–70+ researcher-hours; Taylor et al. 2025: blue budget ≈ 240
 *  person-hours)]. */
export const CASE_WORK = 30;

/** Combined reliability of the case's instruments on its traits (the best target trait): combineTools over the tools'
 *  coverage × strength × family penalty (the ρ = 0.5 rule between tools on the same world assumption). Engine: true
 *  strengths on the true level; the Investigate preview computes the same at believed strengths and the measured level. */
export function caseReliability(s: GameStateV2, inv: Investigation): number {
  const v = targetVersion(s, inv);
  if (!v) return 0;
  const X = versionOom(s, v);
  const tools = toolsOf(s, inv);
  let g = 0;
  for (const k of targetTraits(s, inv)) g = Math.max(g, combineTools(tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthTrue(s, t, X) * familyPenalty(s, v, k, t.family) }))));
  return g;
}

/** RD-A05b: H100e a case runs on: its granted share of the safety research line (a demand inside that use of the flat
 *  allocation; SR-21: the cases' compute need in the safety needs list, safety/lineProjects.ts safAllocation). */
export const caseH100e = (s: GameStateV2, grantedShare: number) => s.player.computeOnline * Math.max(0, s.player.split.safety) * Math.max(0, grantedShare);

/** RF-S12: engineer-days of case work done a day by `fte` engineers (as served) with `computeServed` (0–1) of the
 *  compute it asked: × m of safety experiments (model v3 E2: AI labour is the same input as the engineers). Shared with
 *  the Investigate preview. */
export function caseDailyWork(s: GameStateV2, fte: number, computeServed: number): number {
  return Math.max(0, fte) * safetyLabour(s).exp.m * clamp01(computeServed);
}
/** Days until `left` engineer-days of case work are done at `perDay` a day (capped at INV_MAX_DAYS), and the share of
 *  the work done when the case concludes. */
export function caseDays(perDay: number, left = CASE_WORK): { days: number; done: number } {
  if (perDay <= 1e-12) return { days: INV_MAX_DAYS, done: 1 - left / CASE_WORK };
  const days = Math.ceil(left / perDay - 1e-9);
  return days <= INV_MAX_DAYS ? { days, done: 1 } : { days: INV_MAX_DAYS, done: Math.min(1, 1 - (left - perDay * INV_MAX_DAYS) / CASE_WORK) };
}

/** Odds a case's conclusion is corrupted (resolveInvestigation): the sabotage rate on the AI share of the work × (1 −
 *  the mean verifiability of its tools' families). */
export function corruptOdds(rate: number, tools: readonly TechniqueState[]): number {
  const verif = tools.length ? tools.reduce((a, t) => a + VERIFIABILITY[t.family], 0) / tools.length : 0.5;
  return clamp01(rate * (1 - verif));
}

/** Daily step: the case's work advances; it concludes when its work is done or at INV_MAX_DAYS. */
export function investigationsStep(s: GameStateV2, ctx: SystemCtx): void {
  for (const inv of s.player.safety.investigations) {
    if (inv.outcome) continue;
    const v = targetVersion(s, inv);
    if (!v) {
      inv.outcome = 'inconclusive';
      continue;
    }
    // SR-21: the cases' engineers and compute as the needs list served them today.
    inv.progress = Math.min(1, inv.progress + caseDailyWork(s, inv.fte * casesServed(s), safAllocation(s).caseScale) / CASE_WORK);
    if (inv.progress >= 1 - 1e-9 || ctx.day - inv.startDay >= INV_MAX_DAYS) resolveInvestigation(s, ctx, inv);
  }
}

/** RF-S12: the case's readings when it concludes: one per instrument family on each target trait, at the family's
 *  combined strength × the share of the work done. */
function caseReadings(s: GameStateV2, ctx: SystemCtx, inv: Investigation, v: ModelVersion): void {
  const X = versionOom(s, v);
  const done = clamp01(inv.progress);
  for (const k of targetTraits(s, inv)) {
    for (const fam of ['BB', 'COT', 'WB', 'OR'] as ToolFamily[]) {
      const items = toolsOf(s, inv).filter((t) => t.family === fam).map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthTrue(s, t, X) }));
      const d = combineTools(items) * done;
      if (d > 0.05) {
        observeVersion(s, ctx.rng('safety'), ctx.day, v, k, fam, d, 1, 'case');
        inv.readings = (inv.readings ?? 0) + 1;
      }
    }
  }
}

/** Close a case early (player). It concludes with the share of its work done so far. */
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
  // RF-S12: the case's readings, then the verdict at the instruments' combined reliability × the share of work done.
  caseReadings(s, ctx, inv, v);
  const c = caseReliability(s, inv) * clamp01(inv.progress);
  // Corruption by AI labour from a sabotaging model (E20): the safety agents' uncaught sabotage of the case (model v3 E7's
  // SAFSAB on the share of the case's work AI does, A of safety experiments = Trusted to AI × coverage, E2) × (1 −
  // verifiability of the case's tools). SAFMECH: × the case's threat to the safety model (a case on its own lineage, by
  // the share of its misaligned tendencies the case's traits cover: covert.ts caseThreat); a case on another lineage or
  // on traits it does not have is left alone. The draw is made either way (the safety stream does not move).
  const corrupted = rng.chance(corruptOdds(safetySabotage(s, safetyLabour(s).exp.A, caseThreat(s, v, traits))?.rate ?? 0, tools));
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
  // SR-22: the AI share and spot-checks the work ran at; observed = the verdict found it (a corrupted case reads as
  // benign or inconclusive: below its expected).
  const job0 = jobRecord(s, jobAiShare(s, 'case'), inv.job?.expected ?? 0);
  inv.job = { ...job0, observed: outcome === 'confirmed' || outcome === 'discovery' ? 1 : 0 };
  const detail: NonNullable<Investigation['outcomeDetail']> = {};
  if (corrupted) detail.corrupted = true;
  if (outcome === 'confirmed') {
    const est = clamp01(x + rng.normal(0, 0.1 * (1 - c) + 0.02));
    detail.severityEst = Math.round(est * 100) / 100;
    const b = v.beliefs[k];
    const sdC = Math.min(b?.sd ?? 0.35, 0.05 + 0.1 * (1 - c));
    v.beliefs[k] = { est, sd: sdC, clarity: 0, lastObsDay: ctx.day, evidence: withEvidence(b?.evidence, { day: ctx.day, source: 'case', reading: est, noise: sdC }) };
    v.beliefs[k].clarity = Math.max(0, 1 - v.beliefs[k].sd / 0.35);
    if (inc && inc.apparent === 'unexplained') inc.apparent = k;
  } else if (outcome === 'benign' || outcome === 'falseAlarm') {
    // The player is told it's nothing: belief pulled down (wrong if corrupted).
    const b = v.beliefs[k];
    if (b) {
      const est = Math.min(b.est, corrupted ? 0.05 : Math.max(0.02, x * 0.8));
      const sd = Math.max(0.06, b.sd * 0.7);
      v.beliefs[k] = { est, sd, clarity: 0, lastObsDay: ctx.day, evidence: withEvidence(b.evidence, { day: ctx.day, source: 'case', reading: est, noise: sd }) };
    }
    if (v.beliefs[k]) v.beliefs[k].clarity = Math.max(0, 1 - v.beliefs[k].sd / 0.35);
    if (inc) inc.status = 'resolved';
  } else if (outcome === 'discovery' && uMode) {
    detail.uMode = uMode;
    discoverUMode(s, ctx, uMode);
  }
  inv.outcomeDetail = detail;
  if (inc && inc.status === 'investigating') inc.status = 'open';
  // Model v3 E8: the case may locate footholds of the model's lineage (or find traces of hidden ones); a corrupted case
  // finds nothing.
  const fhBefore = located(s);
  if (!corrupted) caseOnModel(s, ctx, v, traits, c, inv.id, `investigation ${inv.id}`);
  // Independent-family cross-check exposes false-validated tools used in the case (§3.5.3).
  const exposed: string[] = [];
  for (const t of tools) {
    if (t.falseValidated && [...fams].some((f) => f !== t.family)) {
      revealFalse(s, ctx, t.id);
      exposed.push(TECHNIQUE_BY_ID[t.id]?.name ?? t.id);
    }
  }
  // SR-17: the verdict says what changed: believed values only (the case's opening beliefs → now) and the evidence
  // the case added. Nothing here reads the truth beyond what the evidence already put into beliefs.
  detail.changes = caseChanges(inv, v);
  const ev: string[] = [];
  if (inv.readings) ev.push(`${inv.readings} reading${inv.readings === 1 ? '' : 's'} from ${[...fams].join(' / ')} instruments`);
  if (outcome === 'confirmed' || outcome === 'benign' || outcome === 'falseAlarm') ev.push(`case conclusion on ${k} (one reading)`);
  if (outcome === 'discovery' && uMode) ev.push(`failure mode found: ${UMODE_BY_ID[uMode]?.name ?? uMode}`);
  const fh = located(s) - fhBefore;
  if (fh > 0) ev.push(`${fh} foothold${fh === 1 ? '' : 's'} located or suspected`);
  for (const n of exposed) ev.push(`instrument shown false by an independent family: ${n}`);
  if (!ev.length) ev.push('no new evidence');
  detail.evidence = ev;
  const moved = detail.changes.map((x) => `${x.trait} ${x.from.est.toFixed(2)}±${x.from.sd.toFixed(2)} → ${x.to.est.toFixed(2)}±${x.to.sd.toFixed(2)}`).join(', ');
  ctx.log('research', `Investigation ${inv.id}: ${outcome}${moved ? `; beliefs: ${moved}` : '; no belief moved'}; evidence: ${ev.join('; ')}.`, outcome === 'confirmed' || outcome === 'discovery' ? 3 : 2, inv.id);
}

/** Footholds the player knows of (located or suspected): the verdict's foothold evidence. */
const located = (s: GameStateV2) => s.player.safety.footholds.filter((f) => f.status !== 'hidden').length;

/** SR-17: beliefs a case moved, from its opening snapshot to now (believed est / sd; |Δ| ≥ 0.005 in either). */
export function caseChanges(inv: Investigation, v: ModelVersion): CaseChange[] {
  const out: CaseChange[] = [];
  for (const [k, from] of Object.entries(inv.before ?? {}) as [TraitId, { est: number; sd: number }][]) {
    const b = v.beliefs[k];
    if (!b) continue;
    const to = { est: Math.round(b.est * 1000) / 1000, sd: Math.round(b.sd * 1000) / 1000 };
    if (Math.abs(to.est - from.est) >= 0.005 || Math.abs(to.sd - from.sd) >= 0.005) out.push({ trait: k, from: { est: Math.round(from.est * 1000) / 1000, sd: Math.round(from.sd * 1000) / 1000 }, to });
  }
  return out;
}

/** SR-17 / RF-S12: the case job's true preview from the player's chosen instruments, engineers and compute, at BELIEVED
 *  reliability (`reliability` and `perDay` from the caller, as the Investigate preview computes them): time, staff,
 *  compute, what it reads and can find, and each verdict's belief width after if the instruments are as reliable as
 *  believed (the widths resolveInvestigation sets). */
export interface CasePreview {
  days: number; done: number; reliability: number; strength: number; fte: number; h100e: number; traits: TraitId[];
  instruments: { id: string; name: string; family: ToolFamily; reads: TraitId[] }[];
  canFind: string[];
  ranges: { trait: TraitId; now: { est: number; sd: number } | null; confirmed: number; benign: number; inconclusive: number }[];
}
export function casePreview(s: GameStateV2, v: ModelVersion | undefined, traits: TraitId[], tools: TechniqueState[], fte: number, grantedShare: number, perDay: number, reliability: number): CasePreview {
  const { days, done } = caseDays(perDay);
  const c = reliability * done;
  const fams = new Set(tools.map((t) => t.family));
  const ags = new Set(tools.map((t) => t.agenda));
  const canFind: string[] = [];
  const reads = traits.filter((k) => tools.some((t) => (t.coverage[k] ?? 0) > 0));
  if (reads.length) canFind.push(`readings on ${reads.join(', ')} from ${[...fams].join(' / ')}`);
  const kinds = Object.values(UMODE_BY_ID).filter((u) => !isDiscovered(s, u.id) && u.revealedBy.some((a) => ags.has(a))).map((u) => u.name);
  if (kinds.length) canFind.push(`hidden failure modes these instruments can reveal, if the model has them: ${kinds.join(', ')}`);
  canFind.push("footholds of this model's lineage, if any, at the case's strength");
  if (fams.size >= 2) canFind.push('a false instrument among those used (independent families cross-check)');
  const ranges = traits.map((k) => {
    const b = v?.beliefs[k];
    const sd = b?.sd ?? 0.35;
    return { trait: k, now: b ? { est: b.est, sd: b.sd } : null, confirmed: Math.min(sd, 0.05 + 0.1 * (1 - c)), benign: Math.max(0.06, sd * 0.7), inconclusive: sd };
  });
  return {
    days, done, reliability, strength: c, fte, h100e: caseH100e(s, grantedShare), traits,
    instruments: tools.map((t) => ({ id: t.id, name: TECHNIQUE_BY_ID[t.id]?.name ?? t.id, family: t.family, reads: traits.filter((k) => (t.coverage[k] ?? 0) > 0) })),
    canFind, ranges,
  };
}
