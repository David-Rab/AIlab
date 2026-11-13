// clock (10, daily): advance the day; exogenous daily walks (V2-SPEC §2.2). Owner: WS1.
// The loop computes which cadences are due for (day + 1) before running; clock is always first.
import type { EngineSystem } from '../types';

const Y10_MEAN = 4.5;
const Y10_SD_DAILY = 0.25 / Math.sqrt(91); // σ = 25bp per quarter
const Y10_REVERT_DAILY = 0.15 / 91; // [D] mean reversion ≈15% of the gap per quarter

export const clockSystem: EngineSystem = {
  id: 'clock', owner: 'WS1', cadence: 'daily', order: 10,
  run(s, ctx) {
    s.time.day += 1;
    const c = s.capital;
    c.y10 = Math.max(0.5, c.y10 + Y10_REVERT_DAILY * (Y10_MEAN - c.y10) + ctx.rng('world').normal(0, Y10_SD_DAILY));
    c.sofr = c.y10 - 0.3;
    // Daily geo hazard (quarterly p / 91) is evaluated by WS4 in rivalsChina/geoQ from s.market.geoTW etc.
  },
};
