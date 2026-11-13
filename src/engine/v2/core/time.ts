// Calendar helpers and cadences (V2-SPEC §2.2). Owner: WS1.
// Day 0 = startDate (2025-07-01, a quarter and half-year start). All dates are UTC.
import type { Cadence, Day, GameStateV2 } from '../types';

export const START_DATE = '2025-07-01';
const DAY_MS = 86400000;
const startMsCache = new Map<string, number>();

function startMs(startDate: string) {
  let v = startMsCache.get(startDate);
  if (v === undefined) {
    v = Date.parse(startDate + 'T00:00:00Z');
    startMsCache.set(startDate, v);
  }
  return v;
}

export function dateOfDay(startDate: string, day: Day): Date {
  return new Date(startMs(startDate) + day * DAY_MS);
}

export function dateOf(s: GameStateV2, day: Day = s.time.day): Date {
  return dateOfDay(s.time.startDate, day);
}

/** Day index of an ISO date ('2027-03-31'). */
export function dayOfDate(startDate: string, iso: string): Day {
  return Math.round((Date.parse(iso.slice(0, 10) + 'T00:00:00Z') - startMs(startDate)) / DAY_MS);
}

/** Decimal calendar year, v1 convention: year + month/12 + (date-1)/365. Used by world.ts slowdowns (2029). */
export function decimalYearOf(startDate: string, day: Day): number {
  const d = dateOfDay(startDate, day);
  return d.getUTCFullYear() + d.getUTCMonth() / 12 + (d.getUTCDate() - 1) / 365;
}

export function decimalYear(s: GameStateV2, day: Day = s.time.day): number {
  return decimalYearOf(s.time.startDate, day);
}

/** Years since the game start (continuous). */
export function yearsSinceStart(day: Day): number {
  return day / 365;
}

/** Quarter index since start: Q3 2025 = 0, Q4 2025 = 1, Q1 2026 = 2 ... */
export function quarterIndex(startDate: string, day: Day): number {
  const d = dateOfDay(startDate, day);
  const s = dateOfDay(startDate, 0);
  return (d.getUTCFullYear() - s.getUTCFullYear()) * 4 + Math.floor(d.getUTCMonth() / 3) - Math.floor(s.getUTCMonth() / 3);
}

/** First day of quarter index q. */
export function dayOfQuarter(startDate: string, q: number): Day {
  const s = dateOfDay(startDate, 0);
  const m0 = Math.floor(s.getUTCMonth() / 3) * 3 + q * 3;
  const y = s.getUTCFullYear() + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12;
  return Math.round((Date.UTC(y, m, 1) - startMs(startDate)) / DAY_MS);
}

/** Cadences due on `day` (daily always). V2-SPEC §2.2: weekly day%7==0; monthly 1st; quarterly 1 Jan/Apr/Jul/Oct;
 *  semiannual 1 Jan/Jul. */
export function cadencesDue(startDate: string, day: Day): Cadence[] {
  const out: Cadence[] = ['daily'];
  if (day % 7 === 0) out.push('weekly');
  const d = dateOfDay(startDate, day);
  if (d.getUTCDate() === 1) {
    out.push('monthly');
    const m = d.getUTCMonth();
    if (m % 3 === 0) out.push('quarterly');
    if (m % 6 === 0) out.push('semiannual');
  }
  return out;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
}
