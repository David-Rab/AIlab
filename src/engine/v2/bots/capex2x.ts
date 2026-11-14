// 2× reference capex bot (§7.2 F8). Owner: WS4 (harness); balance owned by all workstreams.
// RefBot's behaviour with double the reference compute purchases (WS3's F8 test: does money bind?).
import type { BotPolicy } from '../types';
import { every, intent, pickByTags } from './common';

export const capex2xBot: BotPolicy = {
  id: 'capex2x',
  act(s, api) {
    if (s.time.day === 0) intent(s, api, 'capex', { mult: 2 });
    if (every(s, 91)) intent(s, api, 'capex', { mult: 2 });
    if (s.player.finance.runwayQ < 4 && every(s, 30)) intent(s, api, 'raise', {});
  },
  decide(s, d) {
    // RefBot decisions (§7.4): E17 Continue, E20 Accept, E23 Reject; deals accepted to fund the capex.
    if (d.id === 'E20') return pickByTags(s, d, [['comply']]);
    return pickByTags(s, d, [['deal', 'finance'], ['race', 'continue'], ['hawk']]);
  },
};
