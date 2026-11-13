// Chip orders and cloud contracts (V2-SPEC §3.8 player chip actions). Owner: WS3.
import { dayOfDate } from '../core/time';
import type { BaselineId, ChipOrder, CloudContract } from '../types';

/** Standard order of 1.0M H100e at $23K, 30% deposit paid, delivered Q4 2025 / Q1 2026 (§3.7.2). */
export function initialOrders(baseline: BaselineId): ChipOrder[] {
  const k = baseline === 'reality' ? 0.85 : 1;
  const half = 0.5e6 * k;
  const deposit = (0.3 * half * 23e3) / 1e9;
  return [
    { id: 'O1', lab: 'player', qty: half, kind: 'standard', price: 23, deposit, dueQ: 1, prepayFrac: 0.3, nonTW: false, delivered: 0 },
    { id: 'O2', lab: 'player', qty: half, kind: 'standard', price: 23, deposit, dueQ: 2, prepayFrac: 0.3, nonTW: false, delivered: 0 },
  ];
}

/** Cloud 0.7M H100e at $13K/yr to mid-2028, non-cancellable (§3.7.2). */
export function initialCloud(baseline: BaselineId, startDate: string): CloudContract[] {
  const k = baseline === 'reality' ? 0.85 : 1;
  const h = 0.7e6 * k;
  return [{ id: 'C1', provider: 'Northwind Cloud', h100e: h, costPerYear: (h * 13e3) / 1e9, startDay: -365, endDay: dayOfDate(startDate, '2028-07-01'), cancellableNoticeQ: null }];
}
