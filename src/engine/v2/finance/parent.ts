// Big-tech division money (STRUCTURE §4.8 "decided: simple"; research/18 §3.2; BUILD-PLAN R9). Owner: WS3.
//
// A division of a big-tech parent gets a fixed yearly budget, paid quarterly at each quarter start from Q4 2025 on a
// schedule shown in advance (data/v2/starts.ts PARENT_BUDGET: $16B in year one, growing with the parent's capex path).
// Its product revenue goes to the parent (booked, then transferred: the statements still show it). No equity raises,
// no strategic equity deals, no borrowing (the parent's treasury borrows), no bankruptcy: cash below zero is carried
// as an advance against the next payment. No parent-confidence mechanic.
import { isDivision, parentBudgetYear } from '../../../data/v2/starts';
import { dayOfQuarter } from '../core/time';
import type { Day, GameStateV2, Money, SystemCtx } from '../types';
import { bookCash, qOf } from './ledger';

/** Why an equity, deal or debt action is unavailable to a division (undefined for other companies). */
export const DIVISION_REASON = 'A division of the parent: no outside equity, deals or debt (the parent funds you)';
export const divisionBlock = (s: GameStateV2): string | undefined => (isDivision(s) ? DIVISION_REASON : undefined);

/** Payment ($B) at the start of quarter `q` (Q3 2025 = 0). Budget year y = quarters 4y…4y+3 (Jul–Jun). The Q3 2025
 *  payment is in the starting cash (start cash = $4B on hand + that payment); capitalQ pays from Q4 2025. */
export function parentPaymentQ(q: number): Money {
  if (q < 0) return 0;
  return parentBudgetYear(Math.floor(q / 4)) / 4;
}

export interface ParentPayment { q: number; day: Day; amount: Money }

/** The next `n` payments (the schedule the Finance panel shows). */
export function parentSchedule(s: GameStateV2, n = 8): ParentPayment[] {
  const q0 = qOf(s) + 1;
  return Array.from({ length: n }, (_, i) => ({ q: q0 + i, day: dayOfQuarter(s.time.startDate, q0 + i), amount: parentPaymentQ(q0 + i) }));
}

/** The budget year totals (game years Jul–Jun) for the schedule readout. */
export const parentYear = (y: number): Money => parentBudgetYear(y);

/** Quarterly payment (called from capitalQ at each quarter start). */
export function payParent(s: GameStateV2, ctx: SystemCtx): void {
  if (!isDivision(s)) return;
  const amt = parentPaymentQ(qOf(s));
  if (amt > 0) bookCash(s, ctx, amt, 'financing', 'parent budget', `quarter ${qOf(s)}`);
}

/** Revenue goes to the parent: book the day's revenue, then hand it over (both lines stay on the statement). */
export function revenueToParent(s: GameStateV2, ctx: SystemCtx, amount: Money): void {
  if (amount > 0 && isDivision(s)) bookCash(s, ctx, -amount, 'financing', 'revenue to the parent');
}
