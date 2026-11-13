// Staffing, hiring pipeline, attrition (V2-SPEC §3.4.1). Owner: WS1.
import type { BaselineId, EngineSystem, StaffByRole } from '../types';

/** Start headcounts (classic / reality). */
export const START_STAFF: Record<BaselineId, StaffByRole> = {
  classic: { cap: 2050, saf: 140, sec: 110, prod: 150, ops: 50 },
  reality: { cap: 2450, saf: 170, sec: 130, prod: 180, ops: 70 },
};
/** Cost $M per FTE-year [D]. */
export const STAFF_COST_M: StaffByRole = { cap: 0.8, saf: 0.7, sec: 0.4, prod: 0.4, ops: 0.3 };
/** Weekly base arrivals per role. */
export const HIRING_BASE: Omit<StaffByRole, 'ops'> = { cap: 15, saf: 3, sec: 3, prod: 4 };

/** Payroll $B/yr. */
export function payrollPerYear(staff: StaffByRole): number {
  let m = 0;
  for (const k of Object.keys(staff) as (keyof StaffByRole)[]) m += staff[k] * STAFF_COST_M[k];
  return m / 1000;
}

export const totalStaff = (s: StaffByRole) => s.cap + s.saf + s.sec + s.prod + s.ops;

/** hiring (200, weekly): Pipeline arrivals by role, attrition, talent pull. TODO(WS1, M1). */
export const hiringSystem: EngineSystem = {
  id: 'hiring', owner: 'WS1', cadence: 'weekly', order: 200,
  run() {},
};
