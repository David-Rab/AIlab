// Pure UI selectors shared by the top strip and the Watch list (no store, no React): importable from node scripts
// (scripts/v2/idle.ts reads the Watch list).
import { activeRivals, dateOf, dayOfQuarter, engine, leadDays, qOf, runwayOf } from '../../../engine/v2';
import type { GameStateV2, RiskSource } from '../../../engine/v2';
import { runwayState } from '../theme';

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
/** Live runway state and, when the quarterly board review will change the official state, the review date. */
export function runwayLive(s: GameStateV2) {
  const rw = runwayOf(s);
  const live = runwayState(rw.q);
  const official = s.player.finance.state;
  const review = dateOf(s, dayOfQuarter(s.time.startDate, qOf(s) + 1));
  const flips = official !== 'insolvent' && official !== live;
  return { rw, live, official, review, flips };
}
