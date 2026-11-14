// 2× reference capex bot (§7.2 F8). Owner: WS4 (harness); balance owned by all workstreams.
// RefBot's model play with double the reference compute purchases (WS3's F8 test: does money bind?): WS3's
// CAPEX2X_AUTOPILOT (strategic deal and off-balance-sheet financing, no runway guard, no rescue).
import { CAPEX2X_AUTOPILOT, financeAutopilot, financeDecide } from '../finance/plan';
import type { BotPolicy } from '../types';
import { pickByTags } from './common';
import { refDecide, refPlay } from './ref';

export const capex2xBot: BotPolicy = {
  id: 'capex2x',
  act(s, api) {
    refPlay(s, api);
    financeAutopilot(s, CAPEX2X_AUTOPILOT);
  },
  decide(s, d) {
    // RefBot decisions (§7.4: E17 Continue, E20 Accept, E23 Reject); finance offers taken to fund the capex.
    if (d.id === 'E17' || d.id === 'E20' || d.id === 'E23') return refDecide(s, d);
    const fin = financeDecide(s, d, CAPEX2X_AUTOPILOT);
    if (fin !== undefined) return fin;
    return pickByTags(s, d, [['deal', 'finance'], ['race', 'continue'], ['hawk']]);
  },
};
