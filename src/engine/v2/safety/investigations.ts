// Investigations (V2-SPEC §3.5.8). Owner: WS2.
//
// A case on (version, trait) or on an incident. R8: staffed by safety research engineers (5–40 people from the safety
// research-engineering teams; the rest of them keep tools validated). Monthly clarity gain =
// combine_t(cov·strength·penalty)·(people/15)^0.5; it feeds observations into beliefs and resolves at clarity ≥ 0.8, on
// close, or after 120 days. The outcome is drawn
// from the truth (engine) but the player only sees the outcome label and a severity estimate.
import { safetyLabour } from '../departments/workfit';
import { VERIFIABILITY } from '../../../data/v2/agendas';
import { SHARE_REF } from '../../../data/v2/calibration';
import { MONITOR_STD_POOL_SHARE } from '../../../data/v2/agents';
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
  const tmp: Investigation = { id: '', target, fte, computeShare: 0, tools: [], startDay: ctx.day, clarity: 0 };
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
    startDay: ctx.day, clarity: 0, before, readings: 0,
    // SR-22: expected = the believed level of the most severe target trait at opening (the case's chance to find it).
    job: jobRecord(s, jobAiShare(s, 'case'), Math.max(0, ...Object.values(before).map((b) => b?.est ?? 0))),
  };
  dept.investigations.push(inv);
  ctx.log('research', `Investigation opened (${traits.length === 1 ? traits[0] : 'unexplained'}).`, 2, inv.id);
  return inv;
}

/** Monthly clarity gain (§3.5.8): combine_t(cov·strength·penalty) · (FTE/15)^0.5. Engine (true strengths). */
export function monthlyGain(s: GameStateV2, inv: Investigation): number {
  const v = targetVersion(s, inv);
  if (!v) return 0;
  const X = versionOom(s, v);
  const traits = targetTraits(s, inv);
  const tools = toolsOf(s, inv);
  let g = 0;
  for (const k of traits) {
    const items = tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthTrue(s, t, X) * familyPenalty(s, v, k, t.family) }));
    g = Math.max(g, combineTools(items));
  }
  // Model v3 E2: AI labour is the same input as the case's engineers: effective FTE = FTE × m of safety experiments
  // (SAF_EXP through the Trusted-to-AI share; departments/workfit.ts safetyLabour).
  return caseRate(s, g, inv.fte * casesServed(s), caseH100e(s, inv.computeShare * safAllocation(s).caseScale)); // SR-21: the cases' compute need filled in the list's order
}

/** RD-A05b: a case's compute (H100e) that gives the reference compute term (×1): 5% of the reference lab's safety research
 *  line at the start (1.2M H100e × the start safety share × the share left after the standard monitors) [D]. */
export const CASE_H100E_REF = 0.05 * 1.2e6 * SHARE_REF[0].share.safety * (1 - MONITOR_STD_POOL_SHARE);
/** RD-A05b: H100e a case runs on: its granted share of the safety research line (a demand inside that use of the flat
 *  allocation; SR-21: the cases' compute need in the safety needs list, safety/lineProjects.ts safAllocation). */
export const caseH100e = (s: GameStateV2, grantedShare: number) => s.player.computeOnline * Math.max(0, s.player.split.safety) * Math.max(0, grantedShare);

/** Monthly clarity from the tools' combined detection g, the case's engineers (× m of safety experiments) and its
 *  compute in H100e (RD-A05b: real compute, so a bigger safety line speeds a case of the same share). F6e: shared with
 *  the Investigate preview (which passes g at believed strengths). */
export function caseRate(s: GameStateV2, g: number, fte: number, h100e: number): number {
  const m = safetyLabour(s).exp.m;
  return clamp01(g * Math.sqrt((fte * m) / 15) * Math.min(1.5, Math.pow(Math.max(0.01 * CASE_H100E_REF, h100e) / CASE_H100E_REF, 0.2)));
}

/** Days for clarity to reach CASE_RESOLVE at a monthly gain (as investigationsStep compounds it), capped at INV_MAX_DAYS. */
export const CASE_RESOLVE = 0.8;
export function daysToResolve(gm: number): number {
  const gd = 1 - Math.pow(1 - Math.min(0.999, gm), 1 / 30);
  return gd > 0 ? Math.min(INV_MAX_DAYS, Math.ceil(Math.log(1 - CASE_RESOLVE) / Math.log(1 - gd))) : INV_MAX_DAYS;
}

/** Odds a case's conclusion is corrupted (resolveInvestigation): the sabotage rate on the AI share of the work × (1 −
 *  the mean verifiability of its tools' families). */
export function corruptOdds(rate: number, tools: readonly TechniqueState[]): number {
  const verif = tools.length ? tools.reduce((a, t) => a + VERIFIABILITY[t.family], 0) / tools.length : 0.5;
  return clamp01(rate * (1 - verif));
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
      const X = versionOom(s, v);
      for (const k of targetTraits(s, inv)) {
        for (const fam of ['BB', 'COT', 'WB', 'OR'] as ToolFamily[]) {
          const items = toolsOf(s, inv).filter((t) => t.family === fam).map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthTrue(s, t, X) }));
          const d = combineTools(items);
          if (d > 0.05) {
            observeVersion(s, ctx.rng('safety'), ctx.day, v, k, fam, d, 1, 'case');
            inv.readings = (inv.readings ?? 0) + 1;
          }
        }
      }
    }
    if (inv.clarity >= CASE_RESOLVE || age >= INV_MAX_DAYS) resolveInvestigation(s, ctx, inv);
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

/** SR-17: the case job's true preview from the player's chosen instruments, engineers and compute, at BELIEVED
 *  reliability (`g` from the caller's believed detection, as investigationGain computes it): time, staff, compute, what it
 *  reads and can find, and the expected belief width after if the instruments are as reliable as believed. */
export interface CasePreview {
  days: number; clarityAtEnd: number; fte: number; h100e: number; traits: TraitId[];
  instruments: { id: string; name: string; family: ToolFamily; reads: TraitId[] }[];
  canFind: string[];
  ranges: { trait: TraitId; now: { est: number; sd: number } | null; sdAfter: number }[];
}
export function casePreview(s: GameStateV2, v: ModelVersion | undefined, traits: TraitId[], tools: TechniqueState[], fte: number, grantedShare: number, gm: number): CasePreview {
  const days = daysToResolve(gm);
  const clarityAtEnd = days < INV_MAX_DAYS ? CASE_RESOLVE : 1 - Math.pow(1 - Math.min(0.999, gm), INV_MAX_DAYS / 30);
  const fams = new Set(tools.map((t) => t.family));
  const ags = new Set(tools.map((t) => t.agenda));
  const canFind: string[] = [];
  const reads = traits.filter((k) => tools.some((t) => (t.coverage[k] ?? 0) > 0));
  if (reads.length) canFind.push(`readings on ${reads.join(', ')} from ${[...fams].join(' / ')}`);
  const kinds = Object.values(UMODE_BY_ID).filter((u) => !isDiscovered(s, u.id) && u.revealedBy.some((a) => ags.has(a))).map((u) => u.name);
  if (kinds.length) canFind.push(`hidden failure modes these instruments can reveal, if the model has them: ${kinds.join(', ')}`);
  canFind.push("footholds of this model's lineage, if any, at the case's final progress");
  if (fams.size >= 2) canFind.push('a false instrument among those used (independent families cross-check)');
  const ranges = traits.map((k) => {
    const b = v?.beliefs[k];
    return { trait: k, now: b ? { est: b.est, sd: b.sd } : null, sdAfter: Math.min(b?.sd ?? 0.35, 0.05 + 0.1 * (1 - clarityAtEnd)) };
  });
  return {
    days, clarityAtEnd, fte, h100e: caseH100e(s, grantedShare), traits,
    instruments: tools.map((t) => ({ id: t.id, name: TECHNIQUE_BY_ID[t.id]?.name ?? t.id, family: t.family, reads: traits.filter((k) => (t.coverage[k] ?? 0) > 0) })),
    canFind, ranges,
  };
}
