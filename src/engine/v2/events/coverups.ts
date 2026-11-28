// Cover-ups: quiet fixes outsiders may discover, and the overdue internal report (V2-SPEC §3.9.3 rule 1). Owner: events.
// Called from actorsDaily, so the 'actors' draws keep their order.
import type { GameStateV2, SystemCtx } from '../types';
import { request } from './request';
import { approvalPush, PUBLIC } from '../world/public';
import { trustPush, USGOV } from '../world/usgov';

/** The odds a quiet fix is found within its horizon: the discovery odds of the default start state (staff and press
 *  baseline 0.05 × 0.3 + 0.02, no outsiders with access). */
export const COVERUP_DISCOVERY_ODDS = 0.035;

/** Register a quiet fix that outsiders may discover over `horizon` days (`pTotal` = the odds over the horizon). */
export function addCoverup(s: GameStateV2, what: string, pTotal: number, horizon = 180) {
  const w = s.player.security;
  const pDaily = 1 - Math.pow(1 - Math.min(0.99, pTotal), 1 / horizon);
  w.coverups.push({ id: `cv${s.time.day}-${w.coverups.length}`, day: s.time.day, what, pDaily, until: s.time.day + horizon });
}

/** Daily: each open cover-up may be exposed (an alert, a headline and an approval hit, W4); an internal report left past its
 *  deadline goes external at 2× damage (A6, E19). */
export function coverupsDaily(s: GameStateV2, ctx: SystemCtx) {
  const w = s.player.security;
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
      ctx.log('alert', `A cover-up is exposed: ${c.what}.`, 4);
      ctx.headline('coverup', `Report: ${s.player.name} hid ${c.what}.`);
      approvalPush(s, ctx, PUBLIC.coverupExposed, 'Cover-up exposed');
      trustPush(s, ctx, USGOV.coverupExposed, 'Cover-up exposed');
    }
  }
  const ir = w.internalReport;
  if (ir && day > ir.deadline) {
    delete w.internalReport;
    request(s, 'E19', { mult: 2 });
  }
}
