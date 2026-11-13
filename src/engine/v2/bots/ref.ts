// RefBot / passive: replays the AI 2027 reference race (§7.1 T1, §7.4). Owner: WS4 (harness); balance owned by all workstreams.
import type { BotPolicy } from '../types';

/** TODO(WS4, M2): act via EngineApi actions; decide by choice tags. */
export const refBot: BotPolicy = {
  id: 'ref',
  act() {},
  decide(_s, _d) {
    return 0;
  },
};
