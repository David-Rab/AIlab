// Weight and secrets security, spies, siloing (V2-SPEC §3.6). Owner: WS4.
import type { EngineSystem, SecurityState, StaffByRole } from '../types';

/** WSL status-quo floor: 2.2 + 0.55·min(years since 2025.0, 2) (R11 #17). */
export const wslFloor = (yearsSince2025: number) => 2.2 + 0.55 * Math.min(Math.max(0, yearsSince2025), 2);

/** Spies = privileged · rate (0.005, rising to 0.01 at China rung ≥ 2); privileged = (cap + saf)·(1 − 0.3·siloing). */
export function privilegedOf(staff: Pick<StaffByRole, 'cap' | 'saf'>, siloing: number) {
  return (staff.cap + staff.saf) * (1 - 0.3 * siloing);
}

export function initialSecurity(staff: Pick<StaffByRole, 'cap' | 'saf'>, wsl = 2.4): SecurityState {
  const privileged = privilegedOf(staff, 0);
  return {
    wsl, ssl: wsl - 0.6, target: wsl, spendRate: 0.3, siloing: 0, clearances: false,
    privileged, spies: privileged * 0.005, counterIntel: 0.1, stolen: [], detectedThefts: [],
  };
}

/** security (90, daily): theft hazard, insider leaks, distillation flow, exfiltration hazard. TODO(WS4, M1). */
export const securitySystem: EngineSystem = {
  id: 'security', owner: 'WS4', cadence: 'daily', order: 90,
  run() {},
};
