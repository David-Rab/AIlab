// SR-09 (SAFETY-REDESIGN §2.2 concept 4, §3.2, §4.3 channel 1, §6 row 2): VALIDATION JOBS replace tool upkeep.
//
// To trust an instrument on a model you validate it: plant known behaviour in a test copy of that model and count how
// often the instrument finds it ("found 14 of 20 planted" → measured reliability 70%, range from the sample). A port (a
// validated instrument on a new model) is the same job. A job is one need in the safety research engineers' list
// ('validation', RD-A04 allocate()); engineers fill the queue in order; a job also takes some of the line compute while it
// runs (lineProjects.ts safAllocation). The default policy queues every owned instrument on each new internal model.
//
// The TRUE recall on the planted cases is the engine's true reliability function (instruments.ts reliability, believed =
// false) on that model, mean over the traits the instrument reads; the measurement is a binomial sample of VAL_N cases
// with sampling noise. SR-24b organism realism (OD-7 (a)): planted organisms are easier to read than the real model's
// natural traits, so the planted recall is the true real recall ÷ r (capped at 1), r the world's hidden draw
// (HiddenWorld.organismRealism, U[0.4, 1.0]); the lab converts its planted count to real use with the stated range only
// (believed r = its midpoint, range lo–hi on the readout). A finished job sets "validated on"
// that model (the capability gap the decay is measured from) and `measured`. Away from the measured model believed
// reliability is extrapolated with a range that widens with the gap (validationRange).
// RF-S14: a safety METHOD is validated by the same job (need, cost, VAL_N, queue, policy): plant the trait in a test copy,
// train it with the method, count the planted cases it removes (k of VAL_N); the true share is the method's true strength
// at that model's capability (methods.ts plantedRemoval), through the same organism-realism rule. The result narrows the
// lab's belief about the method's strength at scale (methods.ts methodQRange); no trust factor, no "validated on".
import { AGENDA_BY_ID, ORGANISM_REALISM, ORGANISM_REALISM_BELIEVED, VAL_COMPUTE_FRAC, VAL_DAYS, VAL_ENGINEERS, VAL_N, VAL_UNMEASURED_HALF, VAL_WIDEN_PER_OOM } from '../../../data/v2/agendas';
import { organismRealismOf } from '../world/hidden';
import { safetyLabour } from '../departments/workfit';
import { jobAiShare, jobRecord } from './workPackage';
import { internalVersion } from '../models/labs';
import type { GameStateV2, ModelVersion, RngLike, SafetyDept, SystemCtx, TechniqueId, TechniqueState, ValidationJob } from '../types';
import { clamp01, versionById } from './common';
import { instrumentName, instrumentReads, instruments, reliability } from './instruments';
import { measuredOom, versionOom } from './oversight';
import { METHOD_BY_ID, methodUntested, ownedMethods, plantedRemoval } from './methods';
import { safAllocation } from './lineProjects';
import { disagreementsOn, setTrust, trustOf } from './disagreement';

export const initialValidation = (): NonNullable<SafetyDept['validation']> => ({ jobs: [], autoNew: true, lastModel: null });

/** The department's validation state (created on first use for departments built before SR-09). */
export function validationOf(s: GameStateV2): NonNullable<SafetyDept['validation']> {
  return (s.player.safety.validation ??= initialValidation());
}

/** Engineers (heads × quality) one job needs at full speed: VAL_ENGINEERS ÷ m of safety experiments (AI labour carries the
 *  rest, as line experiments); a human-run job (SR-10) takes all VAL_ENGINEERS. */
export const jobEngineers = (s: GameStateV2, j?: Pick<ValidationJob, 'human'>) => (j?.human ? VAL_ENGINEERS : VAL_ENGINEERS / Math.max(1, safetyLabour(s).exp.m));

/** SR-10: whether a job is run by humans only: chosen so, or the lab has no AI share in safety experiments (m = 1). */
export const humanRun = (s: GameStateV2, j: Pick<ValidationJob, 'human'>) => !!j.human || safetyLabour(s).exp.m <= 1 + 1e-9;

/** Live jobs (their model still exists and is not retired; their instrument owned). */
export function liveJobs(s: GameStateV2): ValidationJob[] {
  const v = s.player.safety.validation;
  if (!v) return [];
  return v.jobs.filter((j) => {
    const m = versionById(s, j.model);
    return !!m && m.status !== 'retired' && !!s.player.safety.techniques[j.tool]?.unlocked;
  });
}

/** The 'validation' need's demand: every live job at full staffing. */
export const validationDemand = (s: GameStateV2) => liveJobs(s).reduce((a, j) => a + jobEngineers(s, j), 0);

/** A job's compute need, in the line projects' need units (shared by need with them): VAL_COMPUTE_FRAC of a serious
 *  project's on the instrument's line. */
export const jobComputeNeed = (s: GameStateV2, j: ValidationJob) => VAL_COMPUTE_FRAC * (AGENDA_BY_ID[s.player.safety.techniques[j.tool]?.agenda]?.computeNeed ?? 0);

/** Engineers per live job in queue order from what the need got (the first jobs are staffed first). */
export function jobStaffing(s: GameStateV2, got: number): Map<string, number> {
  const out = new Map<string, number>();
  let left = got;
  for (const j of liveJobs(s)) {
    const per = jobEngineers(s, j);
    const x = Math.max(0, Math.min(per, left));
    left -= x;
    out.set(j.id, x);
  }
  return out;
}

/** Whether a job for (tool, model) is queued. */
export const isQueued = (s: GameStateV2, tool: TechniqueId, model: string) => !!s.player.safety.validation?.jobs.some((j) => j.tool === tool && j.model === model);

/** RF-S14: whether a technique id is a safety method (validated through the same job). */
export const isMethod = (tool: TechniqueId) => !!METHOD_BY_ID[tool];

/** Whether an instrument (RF-S14: or a method) can be validated on a model: owned, the model exists, not already measured
 *  there or queued; a method only on a model past the scale its source tested (below it a validation says nothing new). */
export function canValidate(s: GameStateV2, tool: TechniqueId, model: string): true | string {
  const t = s.player.safety.techniques[tool];
  const method = isMethod(tool);
  if (method ? !ownedMethods(s).includes(tool) : !t?.unlocked || !instruments(s).includes(t)) return method ? 'Not an owned method' : 'Not an owned instrument';
  const v = versionById(s, model);
  if (!v || v.status === 'retired') return 'No such model';
  if (method && methodUntested(tool, measuredOom(s, v)) <= 0) return `${v.name} is within the scale it was tested at: nothing new to learn`;
  if (isQueued(s, tool, model)) return 'Already queued';
  if (t.measured?.on === model) return `Already validated on ${v.name}`;
  return true;
}

/** Queue a job (player or policy). */
export function queueValidation(s: GameStateV2, tool: TechniqueId, model: string, by: ValidationJob['by'], day: number, human = false): ValidationJob | string {
  const ok = canValidate(s, tool, model);
  if (ok !== true) return ok;
  const job: ValidationJob = { id: `VJ-${tool}-${model}-${day}`, tool, model, progress: 0, by, day, ...(human ? { human: true } : {}) };
  validationOf(s).jobs.push(job);
  return job;
}

/** TRUE recall on planted behaviour: the true reliability on model v, mean over the traits the instrument reads. Engine
 *  only. */
export function trueRecall(s: GameStateV2, t: TechniqueState, v: ModelVersion): number {
  const x = versionOom(s, v);
  const reads = instrumentReads(t);
  if (!reads.length) return reliability(s, t, { x }, false).value;
  let sum = 0;
  for (const trait of reads) sum += reliability(s, t, { x, v, trait }, false).value;
  return clamp01(sum / reads.length);
}

/** SR-24b: the world's organism realism r (engine only). */
export const organismRealism = (s: GameStateV2) => s.hidden.organismRealism ?? organismRealismOf(s.setup.seed);

/** SR-24b: TRUE recall on the planted organisms: the real recall ÷ r, capped at 1 (engine only). */
export const plantedRecall = (s: GameStateV2, real: number) => clamp01(real / Math.max(1e-6, organismRealism(s)));

/** SR-24b: believed real-use recall from a planted-case recall (the lab's belief: r at the stated range's midpoint). */
export const believedTransfer = (planted: number) => clamp01(planted * ORGANISM_REALISM_BELIEVED);

function binomial(rng: RngLike, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng.float() < p) k++;
  return k;
}

/** Finish a job: the instrument is validated (ported) on the model, then its planted-case recall is sampled.
 *  SR-10: a false (sabotaged) instrument validated with an AI share of the work reports what it is believed to find (the
 *  AI doing the work hides it, §3.10 "validations that pass when AI-run but fail when human-run"); human-run, it finds
 *  what it really finds. The result sets the instrument's trust factor to measured ÷ believed on that model. */
export function completeValidation(s: GameStateV2, rng: RngLike, day: number, j: ValidationJob): void {
  const t = s.player.safety.techniques[j.tool];
  const v = versionById(s, j.model);
  if (!t || !v) return;
  if (isMethod(j.tool)) return completeMethodValidation(s, rng, day, j, t, v);
  t.validatedOn = v.id;
  t.validatedOom = versionOom(s, v);
  const human = humanRun(s, j);
  const prior = t.trust;
  t.trust = undefined;
  const believed = clamp01(believedOn(s, t, v)); // what it is believed to find, before this evidence
  t.trust = prior;
  // SR-22: the package's spot-checks re-run a share of an AI-assisted job's planted cases by hand: those find what the
  // instrument really finds, so a spot-checked false instrument comes out below its expected recall.
  const job = jobRecord(s, jobAiShare(s, 'validation', { human }), believed);
  // SR-24b: the planted cases are the organisms: their recall is the real recall ÷ r (what the AI expects to find
  // there is the believed real recall ÷ the believed r).
  const real = plantedRecall(s, trueRecall(s, t, v));
  const believedPlanted = clamp01(believed / ORGANISM_REALISM_BELIEVED);
  const p = t.falseValidated && !human ? job.spot * real + (1 - job.spot) * believedPlanted : real;
  const found = binomial(rng, VAL_N, p);
  t.measured = { on: v.id, found, n: VAL_N, day, human, job: { ...job, observed: Math.round((found / VAL_N) * 1000) / 1000 } };
  const f = believed > 1e-6 ? believedTransfer(found / VAL_N) / believed : trustOf(t, v.id);
  setTrust(t, f, { day, source: 'validation', model: v.id, note: `${human ? 'human-run' : 'AI-assisted'} validation on ${v.name}: found ${found} of ${VAL_N} planted (believed ${Math.round(believed * 100)}%)` });
}

/** RF-S14: finish a method's job: k of VAL_N planted cases removed. True share = the method's true removal at the model's
 *  true capability ÷ organism realism (plantedRecall, the one rule); the expected share (SR-22 job record, the AI-run
 *  sabotage path) is the believed removal at its measured level before this result, ÷ the believed r. */
function completeMethodValidation(s: GameStateV2, rng: RngLike, day: number, j: ValidationJob, t: TechniqueState, v: ModelVersion): void {
  const human = humanRun(s, j);
  const prior = t.measured;
  t.measured = null;
  const believed = clamp01(plantedRemoval(s, t.id, 'believed', measuredOom(s, v)));
  t.measured = prior;
  const job = jobRecord(s, jobAiShare(s, 'validation', { human }), believed);
  const real = plantedRecall(s, plantedRemoval(s, t.id, 'true', versionOom(s, v)));
  const believedPlanted = clamp01(believed / ORGANISM_REALISM_BELIEVED);
  const p = t.falseValidated && !human ? job.spot * real + (1 - job.spot) * believedPlanted : real;
  const found = binomial(rng, VAL_N, p);
  t.measured = { on: v.id, found, n: VAL_N, day, human, job: { ...job, observed: Math.round((found / VAL_N) * 1000) / 1000 } };
}

/** One day: the policy queues every owned instrument on a new internal model (RF-S14: and, with `methods` on, every owned
 *  method that model has outgrown); staffed jobs progress (VAL_DAYS at full
 *  staffing); finished jobs measure. */
export function validationStep(s: GameStateV2, ctx: SystemCtx, got?: number): void {
  const val = validationOf(s);
  const iv = internalVersion(s);
  if (val.autoNew && iv && val.lastModel !== iv.id) {
    for (const t of instruments(s)) if (t.measured?.on !== iv.id) queueValidation(s, t.id, iv.id, 'policy', ctx.day);
    if (val.methods) for (const id of ownedMethods(s)) if (canValidate(s, id, iv.id) === true) queueValidation(s, id, iv.id, 'policy', ctx.day);
    val.lastModel = iv.id;
  }
  const live = new Set(liveJobs(s).map((j) => j.id));
  val.jobs = val.jobs.filter((j) => live.has(j.id));
  if (!val.jobs.length) return;
  const staff = jobStaffing(s, got ?? safAllocationGot(s));
  const done: ValidationJob[] = [];
  for (const j of val.jobs) {
    const per = jobEngineers(s, j);
    j.progress = Math.min(1, j.progress + (per > 0 ? (staff.get(j.id) ?? 0) / per : 0) / VAL_DAYS);
    if (j.progress >= 1 - 1e-9) done.push(j);
  }
  for (const j of done) {
    completeValidation(s, ctx.rng('safety'), ctx.day, j);
    const t = s.player.safety.techniques[j.tool];
    const v = versionById(s, j.model);
    if (t?.measured) ctx.log('research', isMethod(j.tool)
      ? `Validation (${t.measured.human ? 'human-run' : 'AI-assisted'}): ${instrumentName(t)} removed ${t.measured.found} of ${t.measured.n} planted cases on ${v?.name ?? j.model}.`
      : `Validation (${t.measured.human ? 'human-run' : 'AI-assisted'}): ${instrumentName(t)} found ${t.measured.found} of ${t.measured.n} planted on ${v?.name ?? j.model} (reliability ${Math.round((100 * t.measured.found) / t.measured.n)}%).`, 1);
  }
  val.jobs = val.jobs.filter((j) => !done.includes(j));
}

const safAllocationGot = (s: GameStateV2) => safAllocation(s).got.validation;

/** 90% range of a measured proportion found / n (Beta(found + 1, n − found + 1)). */
export function sampleRange(found: number, n: number): { mean: number; half: number } {
  const a = found + 1;
  const b = n - found + 1;
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return { mean: found / n, half: 1.64 * sd };
}

/** SR-24b: a planted count read as real use: value = planted share × the believed r, 90% range = the sample's range ×
 *  the stated realism range [lo, hi] (instruments: validationRange; RF-S14 methods: methodQRange). */
export function realUseRange(found: number, n: number): { value: number; lo: number; hi: number } {
  const r = sampleRange(found, n);
  return { value: believedTransfer(r.mean), lo: clamp01(clamp01(r.mean - r.half) * ORGANISM_REALISM.lo), hi: clamp01(clamp01(r.mean + r.half) * ORGANISM_REALISM.hi) };
}

/** Mean believed reliability over the traits an instrument reads, at model v's measured capability (or OOM x). */
function believedOn(s: GameStateV2, t: TechniqueState, v: ModelVersion, x = versionOom(s, v)): number {
  const reads = instrumentReads(t);
  if (!reads.length) return reliability(s, t, { x }, true).value;
  let sum = 0;
  for (const trait of reads) sum += reliability(s, t, { x, v, trait }, true).value;
  return sum / reads.length;
}

export interface ReliabilityRange {
  value: number; lo: number; hi: number;
  /** measured = validated on this model; extrapolated = from the last measured model; unmeasured = never validated. */
  basis: 'measured' | 'extrapolated' | 'unmeasured';
  /** The model the measurement (or the "validated on") is from. */
  from: string | null;
  /** OOM of capability between this model and `from`. */
  gap: number;
  /** SR-10: who ran the measurement (null = never measured). */
  human: boolean | null;
}

/**
 * Believed reliability of an instrument on model v with its 90% range (concept 4). On the measured model: the
 * measurement, range from the sample. Elsewhere: the measurement scaled by the believed change from the measured model
 * (decay by gap, penalties), range widened by VAL_WIDEN_PER_OOM per OOM of gap; never measured: the believed reliability
 * with VAL_UNMEASURED_HALF more. Believed inputs only.
 */
export function validationRange(s: GameStateV2, t: TechniqueState, v: ModelVersion): ReliabilityRange {
  const m = t.measured;
  const mv = m ? versionById(s, m.on) : undefined;
  const x = versionOom(s, v);
  if (m && mv) {
    const gap = Math.abs(x - versionOom(s, mv));
    // SR-24b: planted → real use at the believed r; the range spans the stated realism range [lo, hi].
    const ru = realUseRange(m.found, m.n);
    const pLo = ru.lo, pHi = ru.hi;
    if (mv.id === v.id) return { value: ru.value, lo: pLo, hi: pHi, basis: 'measured', from: mv.id, gap: 0, human: m.human ?? null };
    const at = believedOn(s, t, mv);
    const ratio = at > 1e-9 ? believedOn(s, t, v, x) / at : 0;
    const value = clamp01(ru.value * ratio);
    const w = VAL_WIDEN_PER_OOM * gap;
    return { value, lo: clamp01(pLo * ratio - w), hi: clamp01(pHi * ratio + w), basis: 'extrapolated', from: mv.id, gap, human: m.human ?? null };
  }
  const value = clamp01(believedOn(s, t, v, x));
  const gap = Math.max(0, x - (t.validatedOom ?? 0));
  const half = VAL_UNMEASURED_HALF + VAL_WIDEN_PER_OOM * gap;
  return { value, lo: clamp01(value - half), hi: clamp01(value + half), basis: 'unmeasured', from: t.validatedOn, gap, human: null };
}

/** Days a queued job would take to finish at today's staffing of the queue (Infinity when unstaffed). */
export function jobDaysLeft(s: GameStateV2, j: ValidationJob): number {
  const per = jobEngineers(s, j);
  const e = jobStaffing(s, safAllocationGot(s)).get(j.id) ?? 0;
  return e > 0 && per > 0 ? Math.ceil(((1 - j.progress) * VAL_DAYS * per) / e) : Infinity;
}

/** Validation readout for the UI: the queue, the policy, instruments not validated on the internal model. */
export function validationView(s: GameStateV2) {
  const val = s.player.safety.validation ?? initialValidation();
  const iv = internalVersion(s);
  const own = instruments(s);
  const staff = jobStaffing(s, safAllocationGot(s));
  return {
    autoNew: val.autoNew,
    /** RF-S14: the policy also queues the owned methods each new model has outgrown. */
    autoMethods: !!val.methods,
    /** RF-S14: owned methods that can be validated on the internal model now (outgrown, not measured or queued there). */
    methodsOpen: iv ? ownedMethods(s).filter((id) => canValidate(s, id, iv.id) === true).length : 0,
    model: iv?.name,
    jobs: liveJobs(s).map((j) => ({
      id: j.id, tool: j.tool, name: instrumentName(s.player.safety.techniques[j.tool]), model: versionById(s, j.model)?.name ?? j.model,
      progress: j.progress, by: j.by, human: humanRun(s, j), engineers: staff.get(j.id) ?? 0, daysLeft: jobDaysLeft(s, j),
      aiShare: jobAiShare(s, 'validation', { human: humanRun(s, j) }),
    })),
    perJob: jobEngineers(s),
    days: VAL_DAYS,
    n: VAL_N,
    instruments: own.length,
    notOnCurrent: iv ? own.filter((t) => t.measured?.on !== iv.id).length : 0,
    /** SR-10: disagreements between independent instruments on the internal model (newest first). */
    disagreements: iv ? disagreementsOn(s, iv.id) : [],
    /** SR-10 / RF-S5: each instrument's trust factor on the internal model and its last piece of evidence. */
    trust: own.map((t) => ({ id: t.id, name: instrumentName(t), f: trustOf(t, iv?.id), last: t.trust?.evidence.at(-1)?.note ?? null })),
    /** SR-22: each instrument's last validation: AI share, spot-check, expected vs observed recall. */
    results: own.filter((t) => t.measured?.job).map((t) => ({ id: t.id, name: instrumentName(t), on: versionById(s, t.measured!.on)?.name ?? t.measured!.on, human: !!t.measured!.human, job: t.measured!.job! })),
  };
}
