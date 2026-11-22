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
// (OD-7: no organism-realism factor yet; validation measures with sampling noise). A finished job sets "validated on"
// that model (the capability gap the decay is measured from) and `measured`. Away from the measured model believed
// reliability is extrapolated with a range that widens with the gap (validationRange).
import { AGENDA_BY_ID, VAL_COMPUTE_FRAC, VAL_DAYS, VAL_ENGINEERS, VAL_N, VAL_UNMEASURED_HALF, VAL_WIDEN_PER_OOM } from '../../../data/v2/agendas';
import { safetyLabour } from '../departments/workfit';
import { internalVersion } from '../models/labs';
import type { GameStateV2, ModelVersion, RngLike, SafetyDept, SystemCtx, TechniqueId, TechniqueState, ValidationJob } from '../types';
import { clamp01, versionById } from './common';
import { instrumentName, instrumentReads, instruments, reliability } from './instruments';
import { versionOom } from './oversight';
import { safAllocation } from './lineProjects';

export const initialValidation = (): NonNullable<SafetyDept['validation']> => ({ jobs: [], autoNew: true, lastModel: null });

/** The department's validation state (created on first use for departments built before SR-09). */
export function validationOf(s: GameStateV2): NonNullable<SafetyDept['validation']> {
  return (s.player.safety.validation ??= initialValidation());
}

/** Engineers (heads × quality) one job needs at full speed: VAL_ENGINEERS ÷ m of safety experiments (AI labour carries the
 *  rest, as line experiments). */
export const jobEngineers = (s: GameStateV2) => VAL_ENGINEERS / Math.max(1, safetyLabour(s).exp.m);

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
export const validationDemand = (s: GameStateV2) => liveJobs(s).length * jobEngineers(s);

/** A job's compute need, in the line projects' need units (shared by need with them): VAL_COMPUTE_FRAC of a serious
 *  project's on the instrument's line. */
export const jobComputeNeed = (s: GameStateV2, j: ValidationJob) => VAL_COMPUTE_FRAC * (AGENDA_BY_ID[s.player.safety.techniques[j.tool]?.agenda]?.computeNeed ?? 0);

/** Engineers per live job in queue order from what the need got (the first jobs are staffed first). */
export function jobStaffing(s: GameStateV2, got: number): Map<string, number> {
  const per = jobEngineers(s);
  const out = new Map<string, number>();
  let left = got;
  for (const j of liveJobs(s)) {
    const x = Math.max(0, Math.min(per, left));
    left -= x;
    out.set(j.id, x);
  }
  return out;
}

/** Whether a job for (tool, model) is queued. */
export const isQueued = (s: GameStateV2, tool: TechniqueId, model: string) => !!s.player.safety.validation?.jobs.some((j) => j.tool === tool && j.model === model);

/** Whether an instrument can be validated on a model: owned, the model exists, not already measured there or queued. */
export function canValidate(s: GameStateV2, tool: TechniqueId, model: string): true | string {
  const t = s.player.safety.techniques[tool];
  if (!t?.unlocked || !instruments(s).includes(t)) return 'Not an owned instrument';
  const v = versionById(s, model);
  if (!v || v.status === 'retired') return 'No such model';
  if (isQueued(s, tool, model)) return 'Already queued';
  if (t.measured?.on === model) return `Already validated on ${v.name}`;
  return true;
}

/** Queue a job (player or policy). */
export function queueValidation(s: GameStateV2, tool: TechniqueId, model: string, by: ValidationJob['by'], day: number): ValidationJob | string {
  const ok = canValidate(s, tool, model);
  if (ok !== true) return ok;
  const job: ValidationJob = { id: `VJ-${tool}-${model}-${day}`, tool, model, progress: 0, by, day };
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

function binomial(rng: RngLike, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng.float() < p) k++;
  return k;
}

/** Finish a job: the instrument is validated (ported) on the model, then its planted-case recall is sampled. */
export function completeValidation(s: GameStateV2, rng: RngLike, day: number, j: ValidationJob): void {
  const t = s.player.safety.techniques[j.tool];
  const v = versionById(s, j.model);
  if (!t || !v) return;
  t.validatedOn = v.id;
  t.validatedOom = versionOom(s, v);
  const found = binomial(rng, VAL_N, trueRecall(s, t, v));
  t.measured = { on: v.id, found, n: VAL_N, day };
}

/** One day: the policy queues every owned instrument on a new internal model; staffed jobs progress (VAL_DAYS at full
 *  staffing); finished jobs measure. */
export function validationStep(s: GameStateV2, ctx: SystemCtx, got?: number): void {
  const val = validationOf(s);
  const iv = internalVersion(s);
  if (val.autoNew && iv && val.lastModel !== iv.id) {
    for (const t of instruments(s)) if (t.measured?.on !== iv.id) queueValidation(s, t.id, iv.id, 'policy', ctx.day);
    val.lastModel = iv.id;
  }
  const live = new Set(liveJobs(s).map((j) => j.id));
  val.jobs = val.jobs.filter((j) => live.has(j.id));
  if (!val.jobs.length) return;
  const staff = jobStaffing(s, got ?? safAllocationGot(s));
  const per = jobEngineers(s);
  const done: ValidationJob[] = [];
  for (const j of val.jobs) {
    j.progress = Math.min(1, j.progress + (per > 0 ? (staff.get(j.id) ?? 0) / per : 0) / VAL_DAYS);
    if (j.progress >= 1 - 1e-9) done.push(j);
  }
  for (const j of done) {
    completeValidation(s, ctx.rng('safety'), ctx.day, j);
    const t = s.player.safety.techniques[j.tool];
    const v = versionById(s, j.model);
    if (t?.measured) ctx.log('research', `Validation: ${instrumentName(t)} found ${t.measured.found} of ${t.measured.n} planted on ${v?.name ?? j.model} (reliability ${Math.round((100 * t.measured.found) / t.measured.n)}%).`, 1);
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
    const r = sampleRange(m.found, m.n);
    const gap = Math.abs(x - versionOom(s, mv));
    if (mv.id === v.id) return { value: r.mean, lo: clamp01(r.mean - r.half), hi: clamp01(r.mean + r.half), basis: 'measured', from: mv.id, gap: 0 };
    const at = believedOn(s, t, mv);
    const ratio = at > 1e-9 ? believedOn(s, t, v, x) / at : 0;
    const value = clamp01(r.mean * ratio);
    const half = r.half + VAL_WIDEN_PER_OOM * gap;
    return { value, lo: clamp01(value - half), hi: clamp01(value + half), basis: 'extrapolated', from: mv.id, gap };
  }
  const value = clamp01(believedOn(s, t, v, x));
  const gap = Math.max(0, x - (t.validatedOom ?? 0));
  const half = VAL_UNMEASURED_HALF + VAL_WIDEN_PER_OOM * gap;
  return { value, lo: clamp01(value - half), hi: clamp01(value + half), basis: 'unmeasured', from: t.validatedOn, gap };
}

/** Days a queued job would take to finish at today's staffing of the queue (Infinity when unstaffed). */
export function jobDaysLeft(s: GameStateV2, j: ValidationJob): number {
  const per = jobEngineers(s);
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
    model: iv?.name,
    jobs: liveJobs(s).map((j) => ({
      id: j.id, tool: j.tool, name: instrumentName(s.player.safety.techniques[j.tool]), model: versionById(s, j.model)?.name ?? j.model,
      progress: j.progress, by: j.by, engineers: staff.get(j.id) ?? 0, daysLeft: jobDaysLeft(s, j),
    })),
    perJob: jobEngineers(s),
    days: VAL_DAYS,
    n: VAL_N,
    instruments: own.length,
    notOnCurrent: iv ? own.filter((t) => t.measured?.on !== iv.id).length : 0,
  };
}
