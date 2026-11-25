// The bot game loop shared by bots.ts (the §7.4 harness) and balrun.ts (the parallel balance runner).
// One place for: the named bot policies, how a bot game is set up (Realistic actors, Rising storyteller, no tutorial) and
// how it is played to its ending.
import { engine } from '../../src/engine/v2';
import { capex2xBot } from '../../src/engine/v2/bots/capex2x';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { raceBot } from '../../src/engine/v2/bots/race';
import { refBot } from '../../src/engine/v2/bots/ref';
import { safeBot } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import type { AlignDiffId, BotPolicy, GameStateV2, StartType, WorldPresetId } from '../../src/engine/v2/types';

/** The named bot policies. */
export const ALL: Record<string, BotPolicy> = { race: raceBot, safe: safeBot, mixed: mixedBot, capex2x: capex2xBot, ref: refBot };

/** A fresh bot game: Realistic gov / public / China / rivals actors, Rising storyteller, no tutorial. */
export function newBotGame(seed: number, combo: { world: WorldPresetId; alignment: AlignDiffId }, start: StartType): GameStateV2 {
  return newGame(defaultSetupV2({ seed, ...combo, econ: combo.world === 'ai2027' ? 'ai2027' : 'sampled', storyteller: 'rising', tutorial: false, gov: 'realistic', public: 'realistic', china: 'realistic', rivals: 'realistic', start }));
}

/** Play one game with a bot until it ends (the endings system caps it at 2050-12-31). `onTick` (optional) sees the state after every tick. */
export function playBot(bot: BotPolicy, s: GameStateV2, onTick?: (s: GameStateV2) => void): GameStateV2 {
  let guard = 0;
  while (!s.ending && guard++ < 40000) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s);
    onTick?.(s);
  }
  return s;
}
