// Board confidence: its named sources and how each kind of seat weighs them (FINANCE-V3 §7.4, FIN3a). Owner: WS3.
// Kept apart from board.ts so promises, equity and events can move the mood without importing the vote machinery.
import type { BoardSeat, GameStateV2, SystemCtx } from '../types';

/** The four kinds of news the board reacts to (spec §7.4): investor-promise results; financial setbacks (down round,
 *  covenant breach, distress, a failed raise; leaving distress is the good news here); falling behind (behind the best
 *  rival, pausing frontier runs); public incidents. */
export type MoodSource = 'results' | 'setbacks' | 'behind' | 'incidents';
export const MOOD_SOURCES: MoodSource[] = ['results', 'setbacks', 'behind', 'incidents'];
export const MOOD_LABEL: Record<MoodSource, string> = { results: 'Promise results', setbacks: 'Financial setbacks', behind: 'Falling behind', incidents: 'Public incidents' };

/** How much each kind of seat minds each source (spec §7.4 table for financial / mission / independent; [D] for
 *  strategic, like a financial holder that cares less about promises, and government, like a mission seat). The CEO's
 *  seat does not move the board's mood. */
export const MOOD_WEIGHTS: Record<MoodSource, Record<BoardSeat['kind'], number>> = {
  results: { financial: 1.5, mission: 0.5, independent: 1, strategic: 1, gov: 0.5, founder: 0 },
  setbacks: { financial: 1, mission: 1, independent: 1.5, strategic: 1, gov: 1, founder: 0 },
  behind: { financial: 1.5, mission: 0, independent: 0.5, strategic: 1, gov: 0.5, founder: 0 },
  incidents: { financial: 0.5, mission: 2, independent: 1, strategic: 0.5, gov: 1.5, founder: 0 },
};

/** This board's multiplier for a source: the vote-weighted mean of its voting seats other than the CEO's (1 if none). */
export function moodWeight(s: GameStateV2, src: MoodSource): number {
  let sum = 0;
  let W = 0;
  for (const x of s.player.board.seats) {
    if (x.weight <= 0 || x.kind === 'founder') continue;
    sum += x.weight * MOOD_WEIGHTS[src][x.kind];
    W += x.weight;
  }
  return W > 0 ? sum / W : 1;
}

/** Base sizes of each named source before the board's multiplier [D, FIN3a rebalance]. Promise results are
 *  PROMISE_RESULT.metBoard / missBoard × the promise's weight (promises.ts). */
export const MOOD_BASE = {
  downRound: -15, // spec §2.5 (kept)
  covenantBreach: -15, // was −20: a breach also puts you in distress, which the board counts every quarter
  distressQ: -4, // each quarterly review in distress
  distressEnded: 10, // spec §7.5 "results restore it": out of distress
  failedRaise: -5, // kept
  behindQ: -5, // kept: behind the best rival at a quarterly review
  pause: -5, // E17: frontier runs paused (falling behind by choice)
} as const;

/** Public incidents [D; FIN3a rebalance, was −(10 + 5 × (sev − 1)) ≤ 30 each, ≤ 20 a quarter, M4]: −(4 + 3 × (severity
 *  − 1)), at most −13 each and −8 a quarter in total, before the board's incident multiplier (a mission-heavy board
 *  doubles it). */
export const INCIDENT_BC = { base: 4, perSeverity: 3, max: 13 } as const;
export const INCIDENT_BC_CAP_Q = 8;

/** Which source a board-confidence cause belongs to (Board card, ouster grievance). */
export const MOOD_SOURCE_OF: Record<string, MoodSource> = {
  'promise met': 'results', 'promise missed': 'results',
  // FIN5c: a big-tech division's parent judges its goals (results) and covers its overspend (a setback).
  'goal met': 'results', 'goal missed': 'results', 'over budget': 'setbacks',
  'down round': 'setbacks', 'covenant breach': 'setbacks', 'financial distress': 'setbacks', 'out of distress': 'setbacks', 'failed raise': 'setbacks',
  'behind a rival': 'behind', 'frontier pause': 'behind',
  'public incident': 'incidents',
};

/** Move board confidence by a named source: base × this board's multiplier for it. Returns the applied change. */
export function boardMood(s: GameStateV2, ctx: SystemCtx, src: MoodSource, base: number, source: string, detail?: string): number {
  return ctx.bump('board.confidence', base * moodWeight(s, src), source, detail);
}

/** The pre-multiplier hit of one public incident. */
export const incidentHit = (severity: number) => Math.min(INCIDENT_BC.max, INCIDENT_BC.base + INCIDENT_BC.perSeverity * (severity - 1));

