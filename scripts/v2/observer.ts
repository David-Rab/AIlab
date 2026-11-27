// Observer run (W10a): the world with no player, to see what happens in each timeline. The player's lab still exists in state
// (the engine assumes it) but takes no action; every pending decision resolves to its default. TEST INSTRUMENT, not a game mechanic:
// s.flags['harness:observer'] switches off the player-company endings (endings.ts); cash is set to 1e6 and floored there
// (cashFloorStub, as forced runs) so the idle company cannot crash the engine.
// The run stops at first ASI by any lab + 3 years, at decimal year 2060, or at a world ending. worldReadout (engine/v2/world/readout.ts)
// is sampled at day 0 and every 91 days.
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { decimalYear } from '../../src/engine/v2/core/time';
import { worldReadout, type WorldReadout } from '../../src/engine/v2/world/readout';
import { cashFloorStub } from './lib';
import type { BotPolicy, GameStateV2, TickOptions } from '../../src/engine/v2/types';

/** The player does nothing. */
export const passiveBot: BotPolicy = {
  id: 'passive',
  act() { /* no actions */ },
  decide: (_s, d) => EVENT_BY_ID.get(d.id)?.defaultChoice ?? 0,
};

export interface ObserverOpts { until?: number; sampleDays?: number; afterAsiYears?: number }
export type EndReason = 'asi+3y' | '2060' | string;
export interface ObserverRun { series: WorldReadout[]; endReason: EndReason }

/** First ASI day (milestone 6) of any lab, or undefined. */
function firstAsiDay(s: GameStateV2): number | undefined {
  const ds = [s.player, ...s.rivals.map((r) => r.core), s.china.lab.core].map((c) => c.milestoneDays[6]).filter((d): d is number => d !== undefined);
  return ds.length ? Math.min(...ds) : undefined;
}

export function playObserver(s: GameStateV2, opts: ObserverOpts = {}): ObserverRun {
  const until = opts.until ?? 2060, step = opts.sampleDays ?? 91, after = Math.round((opts.afterAsiYears ?? 3) * 365);
  s.flags['harness:observer'] = true;
  s.player.finance.cash = 1e6;
  const tickOpts: TickOptions = { extraSystems: [cashFloorStub] };
  const series: WorldReadout[] = [worldReadout(s)];
  let next = s.time.day + step, guard = 0;
  let endReason: EndReason = '2060';
  while (guard++ < 60000) {
    if (s.ending) { endReason = s.ending.id; break; }
    const asi = firstAsiDay(s);
    if (asi !== undefined && s.time.day >= asi + after) { endReason = 'asi+3y'; break; }
    if (decimalYear(s) >= until) break;
    for (const p of [...s.events.pending]) resolve(s, p.instance, passiveBot.decide(s, p));
    tick(s, tickOpts);
    if (s.time.day >= next) { series.push(worldReadout(s)); next += step; }
  }
  const last = series[series.length - 1];
  if (last.day !== s.time.day) series.push(worldReadout(s));
  return { series, endReason };
}
