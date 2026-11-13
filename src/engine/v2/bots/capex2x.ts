// 2× reference capex bot (§7.2 F8). Owner: WS4 (harness); balance owned by all workstreams.
import type { BotPolicy } from '../types';

/** TODO(WS4, M2): act via EngineApi actions; decide by choice tags. */
export const capex2xBot: BotPolicy = {
  id: 'capex2x',
  act() {},
  decide(_s, _d) {
    return 0;
  },
};
