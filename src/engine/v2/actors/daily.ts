// actorsDaily: the GDP start reference, the laws table by date (export policy, laws taking effect), cover-ups and
// statutory floors. Owner: WS4. (The government and public actors it ran were deleted in W1d.)
import type { EngineSystem } from '../types';
import { LAWS, lawsInForce } from '../../../data/v2/laws';
import { dayOfDate } from '../core/time';
import { setExportPolicy } from '../compute/market';
import { coverupsDaily } from '../events/coverups';
import { statutoryDaily } from './commitments';

/** actorsDaily (120, daily): GDP reference, the laws table, cover-ups, statutory floors. */
export const actorsDailySystem: EngineSystem = {
  id: 'actorsDaily', owner: 'WS4', cadence: 'daily', order: 120, system: 'relations',
  run(s, ctx) {
    if (!s.world.gdp0) s.world.gdp0 = s.world.macro.US.gdp;
    // Laws keep their real dates (data/v2/laws.ts): log each on its day; the export policy follows the table.
    for (const l of LAWS) if (ctx.day === dayOfDate(s.time.startDate, l.from)) ctx.log('gov', l.text, 2);
    const exp = lawsInForce(s).exportPolicy;
    if (exp !== s.market.exportPolicy) {
      setExportPolicy(s, exp);
      ctx.log('gov', `US chip export policy toward China: ${exp === 'strict' ? 'strict denial' : exp === 'open' ? 'open' : 'case-by-case (the frontier chips stay barred)'}.`, 2);
    }
    coverupsDaily(s, ctx);
    statutoryDaily(s, ctx);
  },
};
