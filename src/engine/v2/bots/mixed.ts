// Heuristic mixed bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
import type { BotPolicy } from '../types';

/** TODO(WS4, M2): act via EngineApi actions; decide by choice tags. */
export const mixedBot: BotPolicy = {
  id: 'mixed',
  act() {},
  decide(_s, _d) {
    return 0;
  },
};
