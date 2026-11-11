import type { GameState } from './types';

const DAY_MS = 86400000;

export function dateOf(s: GameState, day = s.day): Date {
  return new Date(Date.parse(s.startDate + 'T00:00:00Z') + day * DAY_MS);
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function yearsElapsed(s: GameState): number {
  return s.day / 365;
}

/** Calendar year as a decimal, e.g. 2026.5 */
export function decimalYear(s: GameState, day = s.day): number {
  const d = dateOf(s, day);
  return d.getUTCFullYear() + d.getUTCMonth() / 12 + (d.getUTCDate() - 1) / 365;
}
