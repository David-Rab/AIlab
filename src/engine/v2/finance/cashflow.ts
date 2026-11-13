// Daily accruals and monthly payments (V2-SPEC §3.7.6). Owner: WS3.
import type { EngineSystem } from '../types';

/** opex (130, daily): power and O&M, serving and inference cloud usage, interest. TODO(WS3, M1). */
export const opexSystem: EngineSystem = {
  id: 'opex', owner: 'WS3', cadence: 'daily', order: 130,
  run() {},
};

/** payroll (300, monthly): payroll, commitment instalments, lease payments. TODO(WS3, M1). */
export const payrollSystem: EngineSystem = {
  id: 'payroll', owner: 'WS3', cadence: 'monthly', order: 300,
  run() {},
};
