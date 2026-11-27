// Retire (V2-SPEC §5.1 #10: always available): the player hands over the company and the game ends. Owner: WS4.
import type { ActionDef } from '../types';
import { L, pv } from '../actors/fx';
import { ws4 } from '../actors/state';
import { simpleAction } from '../core/actionDef';

// F6c: no placeholder level: retiring ends the game now (endings.ts 'retired', scored as a loss).
export const RETIRE: ActionDef = simpleAction({
  id: 'RETIRE', verb: 'respond', system: 'core', title: 'Retire', sphere: 'relations',
  preview: () => pv([L('freedom', 1, 'you hand over the company: the game ends (Retired, scored as a loss) and the race goes on without you')], []),
  apply(s) {
    ws4(s).retired = true;
  },
});
