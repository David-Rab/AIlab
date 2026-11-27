// actorsDaily: the daily step of the outside-world actors still alive (public meters, government ladders), cover-ups and
// statutory floors; weekly drift flush. Owner: WS4. (Hosted by the deleted relations module until W1c.)
import type { EngineSystem } from '../types';
import { coverupsDaily } from '../events/coverups';
import { statutoryDaily } from './commitments';
import { flushDrift } from './fx';
import { govDaily } from './gov';
import { publicDaily } from './public';
import { ws4 } from './state';

/** actorsDaily (120, daily): public meters, government ladders, cover-ups, statutory floors; weekly drift flush. */
export const actorsDailySystem: EngineSystem = {
  id: 'actorsDaily', owner: 'WS4', cadence: 'daily', order: 120, system: 'relations',
  run(s, ctx) {
    const w = ws4(s);
    if (!w.gdp0) w.gdp0 = s.world.macro.US.gdp;
    publicDaily(s, ctx);
    govDaily(s, ctx);
    coverupsDaily(s, ctx);
    statutoryDaily(s, ctx);
    if (ctx.day % 7 === 0) flushDrift(s, ctx);
  },
};
