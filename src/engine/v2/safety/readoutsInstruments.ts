// UB-C: SAFETY › Instruments readouts the approved mockup needs (design/ux/mockups/rd/DATA-c.md "SAFETY › Instruments",
// items marked NEW). Pure view functions on beliefs, measurements and facts only, never hidden truth: capability is the
// MEASURED level (measuredOom), never the version's true G (validation.ts validationRange reads versionOom = true G, so
// it is not used here).
import { AGENT_USES } from '../../../data/v2/agents';
import { VAL_DAYS, VAL_WIDEN_PER_OOM } from '../../../data/v2/agendas';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import { chanceCertainty, type Certainty } from '../core/certainty';
import { agentSplitShare, agentVersion, monitorBudget, monitorVersion, useMonitor } from '../departments/agents';
import { measuredLOf, versionById } from '../models/labs';
import type { GameStateV2, ModelVersion, TechniqueState, TraitId } from '../types';
import { believedEfficacy } from './common';
import { INSTRUMENT_KIND_LABEL, instrumentKind, instrumentName, instrumentReads, instruments, reliability, type InstrumentKind } from './instruments';
import { methodQRange, ownedMethods } from './methods';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { measuredOom } from './oversight';
import { instrumentReliability } from './safetyReadouts';
import { sightAt } from './sightLimit';
import { canValidate, humanRun, jobDaysLeft, jobEngineers, liveJobs } from './validation';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ───────────────────────────── one reliability range ─────────────────────────────

/** A reason an instrument's believed reliability on a model is below what it could be, in player words. `factor` is
 *  the multiplier it applies (0..1; the approach chip carries the believed chance the approach works); `warn` marks a
 *  big loss (factor below 0.8, or an approach believed to work less than half the time). */
export interface ReliabilityReason { key: 'tests' | 'approach' | 'legible' | 'fades' | 'trained' | 'masked' | 'notPorted'; text: string; factor: number; warn: boolean }

/**
 * ONE reliability per instrument × model, with ONE 90% range (UB-C; DATA-c "One must go"). Home: SAFETY › Instruments
 * reliability grid · L1 (and every tooltip / drawer that shows an instrument's reliability). Unit: % (low–high).
 * Basis: M / B.
 * - Best guess: the believed reliability at the model's measured capability, mean over the traits it reads
 *   (instrumentReliability). It already carries each validation: a validation sets the trust factor to measured ÷
 *   believed, so on the validated model the best guess IS the measured share found × the believed realism (0.7).
 * - Range: the programme's believed efficacy at the ends of its 90% range (instrumentReliability's range). Picked over
 *   validationRange's sample range because (1) the sample's k of 20 is already in the best guess through the trust
 *   factor, so adding the binomial range on top would count that evidence twice, and (2) validationRange reads the
 *   model's true capability. Away from the validated model the range widens by VAL_WIDEN_PER_OOM per OOM of measured
 *   capability gap (validation.ts's extrapolation rule), so an extrapolated reading is visibly less sure.
 * - basis: 'validated' = measured on this model; 'extrapolated' = measured on another model; 'unvalidated' = never.
 */
export interface InstrumentRange { pct: number; lo: number; hi: number; certainty: Certainty; basis: 'validated' | 'extrapolated' | 'unvalidated'; from?: string; gapOom: number }
export function instrumentRange(s: GameStateV2, t: TechniqueState, v: ModelVersion, base?: { pct: number; lo: number; hi: number }): InstrumentRange {
  const b = base ?? instrumentReliability(s, v.id).rows.find((r) => r.id === t.id) ?? { pct: 0, lo: 0, hi: 0 };
  const m = t.measured;
  const mv = m ? versionById(s, m.on) : undefined;
  const basis: InstrumentRange['basis'] = !mv ? 'unvalidated' : mv.id === v.id ? 'validated' : 'extrapolated';
  const gapOom = mv && mv.id !== v.id ? Math.abs(measuredOom(s, v) - measuredOom(s, mv)) : 0;
  const w = VAL_WIDEN_PER_OOM * gapOom;
  const lo = clamp01(Math.min(b.pct, b.lo) - w);
  const hi = clamp01(Math.max(b.pct, b.hi) + w);
  return { pct: b.pct, lo, hi, certainty: chanceCertainty(lo, hi), basis, ...(mv ? { from: mv.name } : {}), gapOom };
}

/**
 * Reasons in player words (UB-C; replaces reliabilityReasons' dev strings on screen). Home: SAFETY › Instruments "Main
 * limit" chips · L1 (the first), all of them in its tooltip · L3. Unit: × factor / %. Basis: B (believed parts of
 * reliability(): notices tests, approach works?, reasoning hidden, fades with skill, trained against, masked by
 * training; plus "not validated on" when the last validation was on another model). Mean over the traits it reads at
 * the model's measured capability. Warn chips first, then the biggest loss.
 */
export function reliabilityReasonsWords(s: GameStateV2, t: TechniqueState, v: ModelVersion): ReliabilityReason[] {
  const x = measuredOom(s, v);
  const reads = instrumentReads(t);
  const parts = (reads.length ? reads : [undefined]).map((trait) => reliability(s, t, { x, v, ...(trait ? { trait } : {}) }, true));
  const mean = (f: (r: (typeof parts)[number]) => number) => parts.reduce((a, r) => a + f(r), 0) / parts.length;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const out: ReliabilityReason[] = [];
  const add = (key: ReliabilityReason['key'], f: number, text: string) => { if (f < 0.995) out.push({ key, factor: f, text, warn: f < 0.8 }); };
  const eff = believedEfficacy(s, t.agenda);
  out.push({ key: 'approach', factor: eff, text: `approach works? ${Math.round(eff * 100)}%`, warn: eff < 0.5 });
  const tests = mean((r) => r.tests);
  const legible = mean((r) => r.legible);
  const decay = mean((r) => r.decay);
  const goodhart = mean((r) => r.goodhart);
  const mask = 1 - mean((r) => r.mask);
  add('tests', tests, `notices tests ×${r2(tests)}`);
  add('legible', legible, `reasoning hidden ×${r2(legible)}`);
  add('fades', decay, `fades with skill ×${r2(decay)}`);
  add('trained', goodhart, `trained against ×${r2(goodhart)}`);
  add('masked', mask, `masked by training ×${r2(mask)}`);
  if (t.measured && t.measured.on !== v.id) out.push({ key: 'notPorted', factor: 1, text: `not validated on ${v.name}`, warn: false });
  return out.sort((a, b) => Number(b.warn) - Number(a.warn) || a.factor - b.factor);
}

// ───────────────────────────── the grid ─────────────────────────────

/** One past validation of an instrument (its trust evidence): found k of n planted cases on a model. */
export interface ValidationHistoryRow { model: string; day: number; k: number; n: number; human: boolean }

/** An instrument row of SAFETY › Instruments. Home: reliability grid · L1. Basis: F (kind, reads, history), M / B
 *  (reliability, reasons). `next`: the same instrument on the model in testing (extrapolated). */
export interface InstrumentRow {
  id: string; name: string; kind: InstrumentKind; kindLabel: string; reads: TraitId[]; hiddenGoal: number;
  range: InstrumentRange; next?: InstrumentRange; reasons: ReliabilityReason[];
  history: ValidationHistoryRow[]; trainedAgainst: boolean;
}
const FOUND = /found (\d+) of (\d+)/;
/** An instrument's past validations, oldest first (the facts its trust evidence records). Basis: M. */
export function validationHistory(s: GameStateV2, t: TechniqueState): ValidationHistoryRow[] {
  return (t.trust?.evidence ?? []).filter((e) => e.source === 'validation').map((e) => {
    const m = FOUND.exec(e.note);
    return m ? { model: versionById(s, e.model)?.name ?? e.model, day: e.day, k: Number(m[1]), n: Number(m[2]), human: e.note.startsWith('human-run') } : undefined;
  }).filter((x): x is ValidationHistoryRow => !!x);
}

export interface InstrumentsGrid { model?: string; next?: string; rows: InstrumentRow[]; trainedAgainst: number; waitingPort: number }
/** SAFETY › Instruments grid for model `versionId`; `nextId` = a model in testing to extrapolate to. Basis: B / M / F.
 *  `waitingPort` = instruments not validated on the model that could be queued there now. */
export function instrumentsGrid(s: GameStateV2, versionId: string | undefined, nextId?: string): InstrumentsGrid {
  const v = versionById(s, versionId);
  if (!v) return { rows: [], trainedAgainst: 0, waitingPort: 0 };
  const nv = nextId && nextId !== v.id ? versionById(s, nextId) : undefined;
  const base = instrumentReliability(s, v.id).rows;
  const nbase = nv ? instrumentReliability(s, nv.id).rows : [];
  const rows = instruments(s).map((t): InstrumentRow => {
    const reads = instrumentReads(t);
    const kind = instrumentKind(t);
    return {
      id: t.id, name: instrumentName(t), kind, kindLabel: INSTRUMENT_KIND_LABEL[kind], reads, hiddenGoal: reads.filter((k) => CRITICAL_TRAITS.includes(k)).length,
      range: instrumentRange(s, t, v, base.find((r) => r.id === t.id)), ...(nv ? { next: instrumentRange(s, t, nv, nbase.find((r) => r.id === t.id)) } : {}),
      reasons: reliabilityReasonsWords(s, t, v), history: validationHistory(s, t), trainedAgainst: t.trainedAgainst > 0.05,
    };
  }).sort((a, b) => b.range.pct - a.range.pct);
  const queued = new Set(liveJobs(s).filter((j) => j.model === v.id).map((j) => j.tool));
  return {
    model: v.name, ...(nv ? { next: nv.name } : {}), rows,
    trainedAgainst: rows.filter((r) => r.trainedAgainst).length,
    waitingPort: instruments(s).filter((t) => t.measured?.on !== v.id && !queued.has(t.id) && canValidate(s, t.id, v.id) === true).length,
  };
}

/** Real-use logs on a model: the watched share of its AI staff work and how many real-use readings its beliefs hold.
 *  Home: SAFETY › Instruments, Real-use logs row · L1. Unit: % watched, readings. Basis: F (watched share from the
 *  monitors' compute, useMonitor believed), M (readings). The watched share is the mean over the jobs the model does,
 *  weighted by each job's share of AI staff compute; undefined when it does no AI staff work. */
export function realUseLogs(s: GameStateV2, versionId: string | undefined): { watched?: number; monitored: boolean; readings: number } {
  const v = versionById(s, versionId);
  if (!v) return { monitored: false, readings: 0 };
  const b = monitorBudget(s);
  let w = 0, sum = 0, monitored = false;
  for (const u of AGENT_USES) {
    if (agentVersion(s, u)?.id !== v.id) continue;
    const share = agentSplitShare(s, u);
    w += share;
    if (monitorVersion(s, u)) { monitored = true; sum += share * useMonitor(s, u, b, true).watched; }
  }
  const readings = Object.values(v.beliefs ?? {}).reduce((a, bel) => a + (bel?.evidence ?? []).filter((e) => e.source.startsWith('monitor/')).length, 0);
  return { ...(w > 0 ? { watched: sum / w } : {}), monitored, readings };
}

/** All instruments together on a model: the believed chance a hidden goal that is there shows up, per hidden-goal trait,
 *  at the model's measured level. Home: SAFETY › Instruments "Hidden goals you can read" · L1. Unit: %. Basis: B (the
 *  sight limit's per-trait reading, sightLimit.ts sightAt). Highest first. */
export function hiddenGoalReads(s: GameStateV2, versionId: string | undefined): { trait: TraitId; read: number }[] {
  const v = versionById(s, versionId);
  if (!v) return [];
  const L = measuredLOf(s, v).L;
  return CRITICAL_TRAITS.map((k) => ({ trait: k, read: sightAt(s, v, k, L) })).sort((a, b) => b.read - a.read);
}

// ───────────────────────────── validation and disagreements ─────────────────────────────

/** The validation queue grouped by model, and the methods that can be validated on a model. Home: SAFETY › Instruments
 *  Validation card · L1. Units: instruments, engineers, days, progress; a method's strength at scale × (low–high).
 *  Basis: F (queue, staffing, days) / B (the method's at-scale range, methodQRange at the model's measured level). */
export interface ValidationBatch { model: string; modelId: string; count: number; human: boolean; engineers: number; daysLeft: number; progress: number; names: string[] }
export interface MethodToValidate { id: string; name: string; lo: number; hi: number; validatedOn?: string; queued: boolean; days: number; engineers: number }
export function validationBatches(s: GameStateV2, modelId: string | undefined): { batches: ValidationBatch[]; methods: MethodToValidate[] } {
  const by = new Map<string, ValidationBatch>();
  for (const j of liveJobs(s)) {
    const tn = s.player.safety.techniques[j.tool];
    const b = by.get(j.model) ?? { model: versionById(s, j.model)?.name ?? j.model, modelId: j.model, count: 0, human: true, engineers: 0, daysLeft: 0, progress: 0, names: [] };
    b.count++;
    b.human = b.human && humanRun(s, j);
    b.engineers += jobEngineers(s, j);
    b.daysLeft = Math.max(b.daysLeft, jobDaysLeft(s, j));
    b.progress += j.progress;
    b.names.push((tn ? instrumentName(tn) : j.tool));
    by.set(j.model, b);
  }
  const batches = [...by.values()].map((b) => ({ ...b, progress: b.progress / Math.max(1, b.count) }));
  const v = versionById(s, modelId);
  const queued = new Set(liveJobs(s).filter((j) => j.model === modelId).map((j) => j.tool));
  const methods = v ? ownedMethods(s).filter((id) => queued.has(id) || canValidate(s, id, v.id) === true).map((id): MethodToValidate => {
    const q = methodQRange(s, id, measuredOom(s, v));
    return { id, name: TECHNIQUE_BY_ID[id]?.name ?? id, lo: q.lo, hi: q.hi, ...(q.on ? { validatedOn: versionById(s, q.on)?.name ?? q.on } : {}), queued: queued.has(id), days: VAL_DAYS, engineers: jobEngineers(s) };
  }) : [];
  return { batches, methods };
}

/** A disagreement in player words: two independent instrument kinds read one trait far apart. Home: SAFETY ›
 *  Instruments Disagreements card · L1. Unit: % readings. Basis: M. `onModel` = those on the model (newest first);
 *  `last` = the newest on any model. */
export interface DisagreementView { model: string; day: number; trait: TraitId; a: { kind: InstrumentKind; label: string; reading: number }; b: { kind: InstrumentKind; label: string; reading: number } }
export function disagreementsView(s: GameStateV2, versionId: string | undefined): { onModel: DisagreementView[]; last?: DisagreementView } {
  const raw = s.player.safety.disagreements ?? [];
  const side = (x: { kind: string; reading: number }) => ({ kind: x.kind as InstrumentKind, label: INSTRUMENT_KIND_LABEL[x.kind as InstrumentKind] ?? x.kind, reading: x.reading });
  const all = raw.map((d): DisagreementView => ({ model: versionById(s, d.model)?.name ?? d.model, day: d.day, trait: d.trait, a: side(d.a), b: side(d.b) }));
  const onModel = all.filter((_, i) => raw[i].model === versionId).reverse();
  const last = all.at(-1);
  return { onModel, ...(last ? { last } : {}) };
}
