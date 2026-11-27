// Cover-ups: quiet fixes outsiders may discover, and the overdue internal report (V2-SPEC §3.9.3 rule 1). Owner: WS4.
// Moved out of the deleted relations module (W1c); called from actorsDaily at the same point, so the 'actors' draws
// keep their order.
import type { GameStateV2, SystemCtx } from '../types';
import { request, ws4 } from '../actors/state';

/** The odds a quiet fix is found within its horizon: the discovery odds of the default start state (staff and press
 *  baseline 0.05 × 0.3 + 0.02, no outsiders with access), fixed since the research bodies were deleted (W1c). */
export const COVERUP_DISCOVERY_ODDS = 0.035;

/** Register a quiet fix that outsiders may discover over `horizon` days (`pTotal` = the odds over the horizon). */
export function addCoverup(s: GameStateV2, what: string, pTotal: number, horizon = 180) {
  const w = ws4(s);
  const pDaily = 1 - Math.pow(1 - Math.min(0.99, pTotal), 1 / horizon);
  w.coverups.push({ id: `cv${s.time.day}-${w.coverups.length}`, day: s.time.day, what, pDaily, until: s.time.day + horizon });
}

/** Daily: each open cover-up may be exposed (an alert and a headline; its approval cost went with the public actor,
 *  W1d; W4 brings it back); an internal report left past its
 *  deadline goes external at 2× damage (A6, E19). */
export function coverupsDaily(s: GameStateV2, ctx: SystemCtx) {
  const w = ws4(s);
  const day = ctx.day;
  if (w.coverups.length) {
    const rng = ctx.rng('actors');
    for (const c of [...w.coverups]) {
      if (day > c.until) {
        w.coverups.splice(w.coverups.indexOf(c), 1);
        continue;
      }
      if (!rng.chance(c.pDaily)) continue;
      w.coverups.splice(w.coverups.indexOf(c), 1);
      w.leaked++;
      ctx.log('alert', `A cover-up is exposed: ${c.what}.`, 4);
      ctx.headline('coverup', `Report: ${s.player.name} hid ${c.what}.`);
    }
  }
  const ir = w.internalReport;
  if (ir && day > ir.deadline) {
    delete w.internalReport;
    request(s, 'E19', { mult: 2 });
  }
}
