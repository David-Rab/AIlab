// UB-C: SAFETY › Incidents & cases readouts the approved mockup needs (design/ux/mockups/rd/DATA-c.md, items marked NEW):
// incident timeline and groups (model × apparent cause), the roll-back target, a draft case (believed reliability, time,
// staff, compute, AI share, what it can find, verdict odds with their range). Pure view functions on beliefs,
// measurements and facts only, never hidden truth (no trueSource, no true traits, no true instrument strength).
import { CRITICAL_TRAITS, TRAIT_BY_ID } from '../../../data/v2/traits';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import type { GameStateV2, Incident, ModelVersion, TechniqueState, TraitId } from '../types';
import { ACT_INFO } from './actTable';
import { clamp01, versionById } from './common';
import { oomOfLevel } from './oversight';
import { strengthBelieved } from './techniques';
import { believedPenalty, combineTools } from './detection';
import { isDiscovered } from './umodes';
import { caseComputeScale } from './lineProjects';
import { CASE_WORK, INV_FTE, caseDailyWork, caseDays, caseH100e, caseRoom, defaultTools, safetyReHeads } from './investigations';
import { jobAiShare } from './workPackage';
import { frameworkOf } from './framework';
import { SEVERITY_WORDS } from './safetyReadouts';

const Z90 = 1.64;
/** The compute share a case asks of the safety line when the player does not pick one (safety.investigate's default). */
export const CASE_COMPUTE_SHARE = 0.05;
type SevWord = (typeof SEVERITY_WORDS)[number];
const sevWord = (n: number): SevWord => SEVERITY_WORDS[Math.max(0, Math.min(4, n - 1))];
const isOpen = (i: Pick<Incident, 'status'>) => i.status === 'open' || i.status === 'investigating';

/** The act an apparent cause reads as (actTable ACT_INFO names), with the trait under it. */
export function apparentAct(apparent: Incident['apparent']): { act: string; trait: string } {
  if (apparent === 'unexplained') return { act: 'Unexplained', trait: 'no apparent trait' };
  if (apparent === 'misuse') return { act: 'Misuse by people', trait: 'a user' };
  const t = TRAIT_BY_ID[apparent]?.name ?? apparent;
  return { act: ACT_INFO[apparent]?.name ?? t, trait: t };
}

/** Where an incident happened: AI staff work (the internal deployment) or the product's name. */
function whereOf(s: GameStateV2, inc: Incident): string {
  const d = s.player.deployments.find((x) => x.id === inc.deploymentId);
  if (!d || d.channel === 'internal') return 'AI staff work';
  return PRODUCT_DEFS[d.channel]?.name ?? d.channel;
}

/** One incident as the timeline shows it. */
export interface IncidentDot { id: string; day: number; versionId: string; model: string; apparent: Incident['apparent']; severity: Incident['severity']; word: SevWord; status: Incident['status']; open: boolean; wentPublic: boolean; where: string; picked: boolean; publicTimerDays?: number; responses: Incident['responses'] }
/** Incidents of one model and one apparent cause. */
export interface IncidentGroup {
  key: string; versionId: string; model: string; apparent: Incident['apparent']; act: string; trait: string; where: string[];
  first: number; last: number; days: number[]; total: number; open: number; wentPublic: number; investigating: number;
  bySeverity: { word: SevWord; n: number }[]; top: Incident['severity']; ids: string[]; picked: boolean;
}
export interface IncidentLane { apparent: Incident['apparent']; act: string; trait: string; count: number }
export interface IncidentView {
  dots: IncidentDot[]; lanes: IncidentLane[]; groups: IncidentGroup[];
  total: number; open: number; investigated: number; wentPublic: number; firstDay?: number;
  /** Framework training holds in force (since day), for the timeline mark. */
  holds: { day: number; label: string }[];
}

/** Incidents by apparent cause for the timeline and the group cards. Home: SAFETY › Incidents & cases · L1. Units: count,
 *  severity word, dates. Basis: F (day, model, severity, status, where), B (the apparent cause, a guess until a case
 *  confirms it). `picked` = the model the SAFETY picker reads. Groups: model × apparent cause, the picked model's
 *  first, then by open count; lanes by count (Unexplained last). */
export function incidentView(s: GameStateV2, pickId?: string): IncidentView {
  const incs = s.player.safety.incidents;
  const name = (id: string) => versionById(s, id)?.name ?? 'a model';
  const investigated = new Set<string>();
  for (const inv of s.player.safety.investigations) if (inv.target.kind === 'incident') investigated.add(inv.target.incidentId);
  const dots: IncidentDot[] = incs.map((i) => ({
    id: i.id, day: i.day, versionId: i.versionId, model: name(i.versionId), apparent: i.apparent, severity: i.severity, word: sevWord(i.severity),
    status: i.status, open: isOpen(i), wentPublic: i.status === 'leaked', where: whereOf(s, i), picked: i.versionId === pickId,
    ...(i.publicTimerDays !== undefined ? { publicTimerDays: i.publicTimerDays } : {}), responses: i.responses,
  }));
  const lanesM = new Map<string, IncidentLane>();
  for (const d of dots) {
    const l = lanesM.get(d.apparent) ?? { apparent: d.apparent, ...apparentAct(d.apparent), count: 0 };
    l.count++;
    lanesM.set(d.apparent, l);
  }
  const lanes = [...lanesM.values()].sort((a, b) => (a.apparent === 'unexplained' ? 1 : 0) - (b.apparent === 'unexplained' ? 1 : 0) || b.count - a.count);
  const gm = new Map<string, IncidentGroup>();
  for (const d of dots) {
    const key = `${d.versionId}.${d.apparent}`;
    let g = gm.get(key);
    if (!g) {
      g = { key, versionId: d.versionId, model: d.model, apparent: d.apparent, ...apparentAct(d.apparent), where: [], first: d.day, last: d.day, days: [], total: 0, open: 0, wentPublic: 0, investigating: 0, bySeverity: [], top: 1, ids: [], picked: d.picked };
      gm.set(key, g);
    }
    g.total++;
    g.ids.push(d.id);
    g.days.push(d.day);
    g.first = Math.min(g.first, d.day);
    g.last = Math.max(g.last, d.day);
    if (!g.where.includes(d.where)) g.where.push(d.where);
    if (d.wentPublic) g.wentPublic++;
    if (d.status === 'investigating') g.investigating++;
    if (d.open) {
      g.open++;
      g.top = Math.max(g.top, d.severity) as Incident['severity'];
      const b = g.bySeverity.find((x) => x.word === d.word);
      if (b) b.n++; else g.bySeverity.push({ word: d.word, n: 1 });
    }
  }
  for (const g of gm.values()) g.bySeverity.sort((a, b) => SEVERITY_WORDS.indexOf(b.word) - SEVERITY_WORDS.indexOf(a.word));
  const groups = [...gm.values()].sort((a, b) => Number(b.picked) - Number(a.picked) || b.open - a.open || b.last - a.last);
  const holds = frameworkOf(s).holds.filter((h) => h.target === 'training').map((h) => ({ day: h.since, label: 'training held' }));
  return {
    dots, lanes, groups, total: dots.length, open: dots.filter((d) => d.open).length, investigated: dots.filter((d) => investigated.has(d.id)).length,
    wentPublic: dots.filter((d) => d.wentPublic).length, ...(dots.length ? { firstDay: Math.min(...dots.map((d) => d.day)) } : {}),
    holds: holds.filter((h, i) => holds.findIndex((x) => x.day === h.day) === i),
  };
}

/** The model a roll back returns to: the model's checkpoint (its parent), if the lab still holds it. Home: SAFETY ›
 *  Incidents & cases, Roll back response · L1. Basis: F. Undefined when there is no checkpoint to return to. */
export function rollbackTarget(s: GameStateV2, versionId: string): { id: string; name: string } | undefined {
  const v = versionById(s, versionId);
  const p = versionById(s, v?.parentVersionId);
  return p && p.status !== 'retired' ? { id: p.id, name: p.name } : undefined;
}

/** Share of a case's work AI staff would do (the safety experiments' AI share under the AI share allowed). Home: SAFETY ›
 *  Incidents & cases, case card · L1. Unit: %. Basis: F. */
export const caseAiShare = (s: GameStateV2) => jobAiShare(s, 'case');

/** Safety research engineers a new case could get (the largest case at the cases' place in the needs order: what the
 *  needs above leave), with the verdict word of the staff chip. Basis: F. */
export function caseStaff(s: GameStateV2): { heads: number; free: number; word: 'spare' | 'short' } {
  const heads = safetyReHeads(s);
  const free = caseRoom(s, INV_FTE[1]);
  return { heads, free, word: free >= INV_FTE[0] ? 'spare' : 'short' };
}

/** The believed reliability of a set of instruments on a model's traits: the case rule (combineTools over coverage ×
 *  believed strength × believed family penalty at the measured level), the best target trait. Basis: B. */
function believedCaseReliability(s: GameStateV2, v: ModelVersion, traits: TraitId[], tools: TechniqueState[]): number {
  const L = v.evals.measuredL ?? 0;
  const x = oomOfLevel(s.hidden.timeline, L); // the public level scale (as the Open case preview reads it)
  let g = 0;
  for (const k of traits) g = Math.max(g, combineTools(tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthBelieved(s, t, x) * believedPenalty(s, v, k, t.family, L) }))));
  return g;
}

export type CaseVerdict = 'confirmed' | 'cleared' | 'inconclusive' | 'discovery';
/** A draft case (before you open it). Home: SAFETY › Incidents & cases, case card · L1 (Takes, Shows a present goal,
 *  Belief now, verdict odds) with ranges in tooltips · L3. Units: d · engineers · H100e · %; verdict odds % with a range.
 *  Basis: B·fc (believed reliability, the Open case preview's rule), F (staff, compute, AI share).
 *  Verdict odds: the case's verdict rule (investigations.ts resolveInvestigation) read at your BELIEVED level of the
 *  target trait instead of its true one: P(new failure mode) = ½ × strength when an instrument can reveal an undiscovered
 *  one; else confirmed ∝ level × strength, cleared ∝ 0.08 × (1 − level) (+ a false alarm when the level is under 10%),
 *  inconclusive ∝ 0.5 below 40% strength (else 0.05), +0.5 with tests only on a model believed to notice tests over 40%.
 *  The range runs the level over its 90% range. It leaves out a case corrupted by sabotaging AI staff (the Open case
 *  preview states those odds). */
export interface CaseDraft {
  versionId: string; model: string; traits: TraitId[]; question: string; fte: number;
  instruments: { id: string; name: string; family: string }[]; kinds: number;
  reliability: number; days: number; done: number; h100e: number; aiShare: number;
  canFind: string[]; failureModes: string[];
  beliefs: { trait: TraitId; est: number; lo: number; hi: number; sd: number }[];
  odds: Record<CaseVerdict, { p: number; lo: number; hi: number }>;
}
export function caseQuestion(model: string, trait: TraitId): string {
  if (trait === 'SCHEME') return `Is ${model} scheming?`;
  return `Does ${model} show ${(TRAIT_BY_ID[trait]?.name ?? trait).toLowerCase()}?`;
}
export function caseDraft(s: GameStateV2, versionId: string, trait: TraitId, fte: number): CaseDraft | undefined {
  const v = versionById(s, versionId);
  if (!v) return undefined;
  const traits: TraitId[] = [trait];
  const tools = defaultTools(s, traits).map((id) => s.player.safety.techniques[id]).filter((t): t is TechniqueState => !!t?.unlocked);
  const rel = believedCaseReliability(s, v, traits, tools);
  const scale = caseComputeScale(s, CASE_COMPUTE_SHARE);
  const perDay = caseDailyWork(s, fte, scale);
  const { days, done } = caseDays(perDay, CASE_WORK);
  const c = rel * done;
  const fams = new Set(tools.map((t) => t.family));
  const ags = new Set(tools.map((t) => t.agenda));
  const failureModes = Object.values(UMODE_BY_ID).filter((u) => !isDiscovered(s, u.id) && u.revealedBy.some((a) => ags.has(a))).map((u) => u.name);
  const tName = TRAIT_BY_ID[trait]?.name ?? trait;
  const canFind = [
    ...(tools.length ? [`readings on ${tName.toLowerCase()}`] : []),
    ...(failureModes.length ? [`${failureModes.length} kind${failureModes.length > 1 ? 's' : ''} of new failure mode, if present`] : []),
    `footholds of ${v.name}'s family`,
    ...(fams.size >= 2 ? [`a false instrument (${fams.size} independent kinds cross-check)`] : []),
  ];
  const b = v.beliefs[trait];
  const sd = b?.sd ?? 0.35;
  const est = b?.est ?? 0;
  const onlyTests = fams.size === 1 && fams.has('BB');
  const ea = v.beliefs.EA?.est ?? 0;
  const fpr = tools.reduce((a, t) => a + (TECHNIQUE_BY_ID[t.id]?.fpr ?? 0.01), 0);
  const odds = (x: number): Record<CaseVerdict, number> => {
    const pd = failureModes.length ? 0.5 * c : 0;
    const powerBenign = trait === 'POWER' && x < 0.2;
    const w = { confirmed: x * c, cleared: (powerBenign ? 0.3 : 0.08 * (1 - x)) + (x < 0.1 ? fpr : 0), inconclusive: (c < 0.4 ? 0.5 : 0.05) + (onlyTests && ea > 0.4 ? 0.5 : 0) };
    const sum = w.confirmed + w.cleared + w.inconclusive || 1;
    return { discovery: pd, confirmed: ((1 - pd) * w.confirmed) / sum, cleared: ((1 - pd) * w.cleared) / sum, inconclusive: ((1 - pd) * w.inconclusive) / sum };
  };
  const mid = odds(est);
  const a = odds(clamp01(est - Z90 * sd));
  const z = odds(clamp01(est + Z90 * sd));
  const ks: CaseVerdict[] = ['confirmed', 'cleared', 'inconclusive', 'discovery'];
  return {
    versionId: v.id, model: v.name, traits, question: caseQuestion(v.name, trait), fte,
    instruments: tools.map((t) => ({ id: t.id, name: TECHNIQUE_BY_ID[t.id]?.name ?? t.id, family: t.family })), kinds: fams.size,
    reliability: rel, days, done, h100e: caseH100e(s, CASE_COMPUTE_SHARE * scale), aiShare: caseAiShare(s),
    canFind, failureModes,
    beliefs: traits.map((k) => { const bb = v.beliefs[k]; const e = bb?.est ?? 0; const d = bb?.sd ?? 0.35; return { trait: k, est: e, sd: d, lo: clamp01(e - Z90 * d), hi: clamp01(e + Z90 * d) }; }),
    odds: Object.fromEntries(ks.map((k) => [k, { p: mid[k], lo: Math.min(a[k], z[k], mid[k]), hi: Math.max(a[k], z[k], mid[k]) }])) as CaseDraft['odds'],
  };
}

/** The trait a draft case on a model starts on: the apparent trait of its largest open incident group, else the
 *  hidden-goal trait you believe highest. Basis: F / B. */
export function draftTrait(s: GameStateV2, versionId: string): TraitId {
  const v = versionById(s, versionId);
  const counts = new Map<TraitId, number>();
  for (const i of s.player.safety.incidents) {
    if (i.versionId !== versionId || !isOpen(i) || i.apparent === 'unexplained' || i.apparent === 'misuse') continue;
    counts.set(i.apparent, (counts.get(i.apparent) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  return CRITICAL_TRAITS.reduce((a, b) => ((v?.beliefs[b]?.est ?? 0) > (v?.beliefs[a]?.est ?? 0) ? b : a), CRITICAL_TRAITS[0]);
}

/** An open case's days left at its staffing and today's compute grant. Basis: F (estimate). */
export function caseDaysLeft(s: GameStateV2, fte: number, progress: number): number {
  return caseDays(caseDailyWork(s, fte, caseComputeScale(s)), CASE_WORK * Math.max(0, 1 - progress)).days;
}
