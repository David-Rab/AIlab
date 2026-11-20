// Pure UI selectors shared by the top strip and the Watch list (no store, no React): importable from node scripts
// (scripts/v2/idle.ts reads the Watch list).
import { activeRivals, dateOf, dayOfQuarter, engine, leadDays, OUSTER_BC, OUSTER_NOTICE_D, ousterRiskQ, qOf, runwayOf } from '../../../engine/v2';
import type { GameStateV2, ProductRead, RiskSource } from '../../../engine/v2';
import * as F from '../fmt';
import { runwayState } from '../theme';
import { isDivision } from '../../../data/v2/starts';

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
  const division = isDivision(s);
  const live = division ? 'healthy' : runwayState(rw.q);
  const official = s.player.finance.state;
  const review = dateOf(s, dayOfQuarter(s.time.startDate, qOf(s) + 1));
  const flips = !division && official !== 'insolvent' && official !== live;
  return { rw, live, official, review, flips, division };
}

/** Jank ST3: the next quarterly board review: date, confidence against the ouster line, whether a vote can happen
 *  there (confidence below the line and a warning at least the notice period old) and its odds. */
export function boardReview(s: GameStateV2) {
  const day = dayOfQuarter(s.time.startDate, qOf(s) + 1);
  const bc = s.player.board.confidence;
  const warn = s.player.finance.ws3?.boardWarnDay;
  const live = bc < OUSTER_BC && warn !== undefined && day - warn >= OUSTER_NOTICE_D;
  return { day, inDays: day - s.time.day, date: dateOf(s, day), bc, line: OUSTER_BC, live, p: live ? ousterRiskQ(s) : 0, division: isDivision(s) };
}

/** A division's money in budget terms (jank F2): the parent's payment per quarter, spending per quarter (operating
 *  outflow averaged over the next 4 quarters, as runway's burn) and how far spending runs over the budget. */
export function divisionBudget(s: GameStateV2) {
  const rw = runwayOf(s);
  const parentQ = Math.max(0, -rw.parts.funding);
  const spendQ = Math.max(0, rw.burnQ);
  return { parentQ, spendQ, overQ: spendQ - parentQ, over: spendQ > parentQ + 1e-6 };
}

/** B4: a product's customer count from quantities the engine has: Chat its weekly users and paying subscribers, a
 *  sector product its paid seats. Sector products without seats have no count (only a share): undefined. */
export function customerCount(r: ProductRead): string | undefined {
  if (r.channel === 'consumer') return `${F.count(r.cust.users ?? r.users ?? 0)} weekly users · ${F.count(r.subs ?? 0)} paying`;
  return r.econ.seats >= 1 ? `${F.count(r.econ.seats)} paid seats` : undefined;
}
/** B4: the player's customer stock in the product's segment → its target share. */
export const customerShare = (r: ProductRead) => `share ${F.pct(r.cust.stock, 1)} → ${F.pct(r.cust.target, 1)}`;
