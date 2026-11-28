// 2× reference capex bot (§7.2 F8). Owner: WS4 (harness); balance owned by all workstreams.
// RefBot's model play with double the reference compute purchases (WS3's F8 test: does money bind?): WS3's
// CAPEX2X_AUTOPILOT (strategic deal and off-balance-sheet financing, no runway guard, no rescue).
import { CAPEX2X_AUTOPILOT, financeAutopilot } from '../finance/plan';
import type { BotPolicy } from '../types';
import { answerFramework, mergerChoice, pickByTags } from './common';
import { refPlay } from './ref';

export const capex2xBot: BotPolicy = {
  id: 'capex2x',
  act(s, api) {
    refPlay(s, api);
    answerFramework(s, api); // RefBot's old E17 Continue
    financeAutopilot(s, CAPEX2X_AUTOPILOT);
  },
  decide(s, d) {
    // Finance offers taken to fund the capex.
    // FIN3c: as the race bot, buys a failing rival for cash or stock (never selling control, never forcing the board).
    if (d.id === 'E32') return mergerChoice(s, d, { cushion: 10, maxStake: 0.15 });
    return pickByTags(s, d, [['deal', 'finance'], ['race', 'continue'], ['hawk']]);
  },
};
