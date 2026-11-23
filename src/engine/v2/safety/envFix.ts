// SR-16b: environment fixes take real time. Ordering one (the "Fix environment" response, or Training › Environments)
// queues an EnvFixJob: PATCH_FTE safety research engineers on the 'envFix' need (SR-21's list) for a drawn PATCH_DAYS,
// i.e. PATCH_FTE × days safety-engineer-days of work. Each day a job advances by the engineers the need got; the fix is
// in force (SafetyDept.envFixes, read by runExploitMap) only when its work is done. Owner: WS2.
import type { GameStateV2, RLFamily, RngLike, SystemCtx, TraitId } from '../types';
import { RL_FAMILY_LABEL } from '../../../data/v2/suites';
import { DEFAULT_SAF_RE_ALLOC } from '../../../data/v2/research';
import { allocate } from '../models/research';
import { envFixMult } from '../models/suites';
import { flagNum, setFlag } from './common';
import { needServed, safAllocation } from './lineProjects';
import { PATCH_DAYS, PATCH_FLOOR, PATCH_FTE, PATCH_MULT, RUN_PENALTY_OOM, envFixFamily } from './responses';

/** Queue an environment fix on family f (work and fix factor drawn now; nothing changes until the work is done). One
 *  fix per family at a time: returns an error when one is already being built. */
export function orderEnvFix(s: GameStateV2, rng: RngLike, f: RLFamily, day: number, trait?: TraitId, versionId?: string): string | undefined {
  if (s.player.safety.envFixJobs?.some((j) => j.family === f)) return 'a fix is already being built on that family';
  const days = Math.round(rng.range(PATCH_DAYS[0], PATCH_DAYS[1]));
  const factor = rng.range(PATCH_MULT[0], PATCH_MULT[1]);
  (s.player.safety.envFixJobs ??= []).push({ family: f, work: PATCH_FTE * days, done: 0, day, factor, ...(trait ? { trait } : {}), ...(versionId ? { versionId } : {}) });
  return undefined;
}

/** Engineer-days a day each open job gets today (PATCH_FTE × the need's served share; jobs share it evenly). */
export const envFixRate = (s: GameStateV2): number => PATCH_FTE * needServed(s, 'envFix');

/** Daily (incidents system): open jobs advance; a finished job's fix comes into force and the next run pays its G. */
export function envFixStep(s: GameStateV2, ctx: SystemCtx): void {
  const jobs = s.player.safety.envFixJobs;
  if (!jobs?.length) return;
  const rate = envFixRate(s);
  const left = [];
  for (const j of jobs) {
    j.done = Math.min(j.work, j.done + rate);
    if (j.done < j.work - 1e-9) {
      left.push(j);
      continue;
    }
    const fixes = (s.player.safety.envFixes ??= {});
    const prev = fixes[j.family];
    const mult = Math.round(Math.max(PATCH_FLOOR, envFixMult(s, j.family) * j.factor) * 1000) / 1000;
    fixes[j.family] = { mult, n: (prev?.n ?? 0) + 1, day: ctx.day, ...(j.trait ? { trait: j.trait } : {}), ...(j.versionId ? { versionId: j.versionId } : {}) };
    setFlag(s, 'runPenalty', flagNum(s, 'runPenalty') + RUN_PENALTY_OOM);
    ctx.log('company', `Environment fix done: ${RL_FAMILY_LABEL[j.family]} environments' rewarded hacks ×${mult.toFixed(2)} on later runs.`, 2);
  }
  s.player.safety.envFixJobs = left;
}

/** Open jobs on a family with the days left at today's staffing (Infinity = no engineers on the need). */
export function envFixPending(s: GameStateV2, f: RLFamily): { left: number; days: number }[] {
  const jobs = (s.player.safety.envFixJobs ?? []).filter((j) => j.family === f);
  if (!jobs.length) return [];
  const rate = envFixRate(s);
  return jobs.map((j) => ({ left: j.work - j.done, days: rate > 1e-9 ? Math.ceil((j.work - j.done) / rate) : Infinity }));
}

export interface EnvFixPreview {
  family?: RLFamily; label: string;
  /** Work (safety-engineer-days) range, engineers the new job would get today, days to finish at that (lo–hi). */
  work: [number, number]; fte: number; days: [number, number];
  /** The family's multiplier now and after the fix (drawn range, floor), whether it is at the floor already. */
  mult: number; after: [number, number]; atFloor: boolean; pending: number; block?: string;
}

/** True preview of ordering one more fix on a family: the work, the engineers the 'envFix' need would give it at
 *  today's staffing (the list's order with PATCH_FTE more asked), the days that takes, and the fix's effect. */
export function envFixPreview(s: GameStateV2, family?: RLFamily): EnvFixPreview {
  const f = envFixFamily(s, family);
  const work: [number, number] = [PATCH_FTE * PATCH_DAYS[0], PATCH_FTE * PATCH_DAYS[1]];
  const a = safAllocation(s);
  const demand = { ...a.demand, envFix: a.demand.envFix + PATCH_FTE };
  const got = allocate(a.heads, s.player.research.safRe ?? DEFAULT_SAF_RE_ALLOC, demand);
  const fte = demand.envFix > 1e-9 ? PATCH_FTE * Math.min(1, got.envFix / demand.envFix) : 0;
  const days: [number, number] = fte > 1e-9 ? [Math.ceil(work[0] / fte), Math.ceil(work[1] / fte)] : [Infinity, Infinity];
  const mult = f ? envFixMult(s, f) : 1;
  const after: [number, number] = [Math.max(PATCH_FLOOR, mult * PATCH_MULT[0]), Math.max(PATCH_FLOOR, mult * PATCH_MULT[1])];
  const atFloor = mult <= PATCH_FLOOR + 1e-9;
  const pending = f ? (s.player.safety.envFixJobs ?? []).filter((j) => j.family === f).length : 0;
  const block = !f ? 'no environments of that family' : pending ? 'a fix is already being built on it' : atFloor ? `already at the floor ×${PATCH_FLOOR}` : undefined;
  return { family: f, label: f ? RL_FAMILY_LABEL[f] : '', work, fte, days, mult, after, atFloor, pending, ...(block ? { block } : {}) };
}
