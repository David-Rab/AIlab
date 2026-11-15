// Staffing, hiring pipeline, attrition, morale effects, star hires (V2-SPEC §3.4.1). Owner: WS1.
//   weekly arrivals per role = min(target gap, base_r · (1 + talentPull/50) · moraleFactor), landing after 6 weeks
//   attrition = 12%/yr · (1.5 − morale/100)   (safety staff use morale.safety)
import type { BaselineId, EngineSystem, GameStateV2, StaffByRole, SystemCtx } from '../types';

/** Start headcounts (classic / reality). */
export const START_STAFF: Record<BaselineId, StaffByRole> = {
  classic: { cap: 2050, saf: 140 },
  reality: { cap: 2450, saf: 170 },
};
/** Cost $M per FTE-year [D]. */
export const STAFF_COST_M: StaffByRole = { cap: 0.8, saf: 0.7 };
/** Weekly base arrivals per role (cap reference ≈ +60/month, R11 #12). */
export const HIRING_BASE: StaffByRole = { cap: 15, saf: 3 };
export const PIPELINE_DAYS = 42;
export const ATTRITION_BASE = 0.12;
/** Only capabilities and safety staff are modelled: security is a $-spend lever; product and G&A are not modelled. */
export const ROLES: (keyof StaffByRole)[] = ['cap', 'saf'];
/** Star hire (§3.4.1): +0.05 τ_h up to 1.5 for $0.3B and rival cooperation −20. */
export const STAR_HIRE = { dTaste: 0.05, maxTaste: 1.5, cost: 0.3, cooperation: -20 };

/** Payroll $B/yr. */
export function payrollPerYear(staff: StaffByRole): number {
  let m = 0;
  for (const k of ROLES) m += staff[k] * STAFF_COST_M[k];
  return m / 1000;
}

export const totalStaff = (s: StaffByRole) => s.cap + s.saf;

/** Hiring multiplier from morale (0.5 at 0, 1 at 50, 1.5 at 100) [D]. */
export const moraleFactor = (morale: number) => Math.min(1.5, Math.max(0.5, 0.5 + morale / 100));

/** Staff already in the pipeline for a role. */
export const inPipeline = (s: GameStateV2, role: keyof StaffByRole) => s.player.hiring.pipeline.reduce((a, p) => a + (p.role === role ? p.n : 0), 0);

/** Expected weekly arrivals for a role at current talent pull and morale (UI helper). */
export function weeklyHireCap(s: GameStateV2, role: keyof StaffByRole): number {
  const morale = role === 'saf' ? s.player.morale.safety : s.player.morale.overall;
  return HIRING_BASE[role] * Math.max(0, 1 + s.relations.talentPull / 50) * moraleFactor(morale);
}

/** One week of hiring and attrition for the player. */
export function hiringWeek(s: GameStateV2, ctx: SystemCtx) {
  const p = s.player;
  const day = ctx.day;
  // Arrivals that cleared the 6-week pipeline.
  const still: typeof p.hiring.pipeline = [];
  for (const e of p.hiring.pipeline) {
    if (e.day <= day) p.staff[e.role] += e.n;
    else still.push(e);
  }
  p.hiring.pipeline = still;
  for (const role of ROLES) {
    // Attrition (fractional staff are fine; displayed rounded).
    const morale = role === 'saf' ? p.morale.safety : p.morale.overall;
    const att = (p.staff[role] * ATTRITION_BASE * Math.max(0.2, 1.5 - morale / 100)) / 52;
    p.staff[role] = Math.max(0, p.staff[role] - att);
    // Layoffs down to target (morale hit 1 per 1% cut) [D].
    const target = p.hiring.target[role];
    if (p.staff[role] > target * 1.02 && inPipeline(s, role) === 0) {
      const cut = p.staff[role] - target;
      const pct = (100 * cut) / Math.max(1, p.staff[role]);
      p.staff[role] = target;
      ctx.bump(role === 'saf' ? 'morale.safety' : 'morale', -Math.min(15, pct), 'layoffs', role);
      continue;
    }
    const gap = target - p.staff[role] - inPipeline(s, role);
    if (gap <= 0) continue;
    const n = Math.min(gap, weeklyHireCap(s, role));
    if (n > 0) p.hiring.pipeline.push({ day: day + PIPELINE_DAYS, role, n: Math.round(n * 100) / 100 });
  }
}

/** hiring (200, weekly): pipeline arrivals by role, attrition, talent pull. */
export const hiringSystem: EngineSystem = {
  id: 'hiring', owner: 'WS1', cadence: 'weekly', order: 200,
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    hiringWeek(s, ctx);
  },
};
