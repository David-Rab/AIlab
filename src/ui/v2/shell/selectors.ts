// Pure UI selectors shared by the top strip and the Watch list (no store, no React): importable from node scripts
// (scripts/v2/idle.ts reads the Watch list).
import { activeRivals, dateOf, dayOfQuarter, engine, leadDays, OUSTER_BC, OUSTER_NOTICE_D, ousterPassesBelow, ousterVote, qOf, runwayOf } from '../../../engine/v2';
import type { DivisionView, GameStateV2, ProductRead, RiskSource } from '../../../engine/v2';
import * as F from '../fmt';
import { runwayState } from '../theme';
import { ownerFunded } from '../../../engine/v2';

export function nearestRival(s: GameStateV2) {
  const labs = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
  const rs = labs.map((r) => ({ id: r.core.id, name: r.core.name, ...leadDays(s, r.core.id) })).sort((a, b) => a.est - b.est);
  return { nearest: rs[0], all: rs };
}
/** Combined estimated P(catastrophe) and band from the risk sources (as the Risk panel combines them). */
export function catRisk(s: GameStateV2) {
  const rows = engine.riskSources(s);
  const comb = (f: (r: RiskSource) => number) => 1 - rows.reduce((a, r) => a * (1 - Math.max(0, Math.min(1, f(r)))), 1);
  return { est: comb((r) => r.estimate), lo: comb((r) => r.band[0]), hi: comb((r) => r.band[1]), rows };
}
/** Live runway state and, when the quarterly board review will change the official state, the review date. A division
 *  (big-tech start) cannot go broke: the parent covers any shortfall, so it never shows a runway alarm (jank F2). */
export function runwayLive(s: GameStateV2) {
  const rw = runwayOf(s);
  const division = ownerFunded(s);
  const live = division ? 'healthy' : runwayState(rw.q);
  const official = s.player.finance.state;
  const review = dateOf(s, dayOfQuarter(s.time.startDate, qOf(s) + 1));
  const flips = !division && official !== 'insolvent' && official !== live;
  return { rw, live, official, review, flips, division };
}

/** Jank ST3 + FIN3b: the next quarterly board review: date, confidence against the ouster line, whether a vote is held
 *  there (confidence below the line and a warning at least the notice period old), the vote as it stands today (seat by
 *  seat, no dice) and the confidence below which it would pass. */
export function boardReview(s: GameStateV2) {
  const day = dayOfQuarter(s.time.startDate, qOf(s) + 1);
  const bc = s.player.board.confidence;
  const warn = s.player.finance.ws3?.boardWarnDay;
  const live = bc < OUSTER_BC && warn !== undefined && day - warn >= OUSTER_NOTICE_D;
  return { day, inDays: day - s.time.day, date: dateOf(s, day), bc, line: OUSTER_BC, live, vote: ousterVote(s), passesBelow: ousterPassesBelow(s) };
}

/** A big-tech division's budget year in words (jank F2, FIN5c): the top strip, the core loop and the Parent budget card
 *  read the engine's divisionView through this, so they say the same thing. */
export function divisionStatus(v: DivisionView): { text: string; short: string; tone: 'good' | 'watch' | 'bad' } {
  if (v.status === 'over') return { text: `Over budget by ${F.money(v.over)}; parent covers`, short: `over ${F.money(v.over)}`, tone: 'bad' };
  if (v.status === 'course') return { text: `On course to run ${F.money(v.coverAtReview)} over by the review; parent covers`, short: `${F.money(v.coverAtReview)} over at review`, tone: 'watch' };
  return { text: `Within budget · ${F.money(Math.max(0, v.projectedEnd))} left at the review`, short: 'within budget', tone: 'good' };
}

/** B4: a product's customer count from quantities the engine has: Chat its weekly users and paying subscribers, a
 *  sector product its paid seats. Sector products without seats have no count (only a share): undefined. */
export function customerCount(r: ProductRead): string | undefined {
  if (r.channel === 'consumer') return `${F.count(r.cust.users ?? r.users ?? 0)} weekly users · ${F.count(r.subs ?? 0)} paying`;
  return r.econ.seats >= 1 ? `${F.count(r.econ.seats)} paid seats` : undefined;
}
/** B4: the player's customer stock in the product's segment → its target share. */
export const customerShare = (r: ProductRead) => `share ${F.pct(r.cust.stock, 1)} → ${F.pct(r.cust.target, 1)}`;
