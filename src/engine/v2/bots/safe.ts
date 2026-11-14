// Safe-only bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// 20% safety compute and 25% of staff, all agendas Serious (five Major), faithful CoT, heavy safety training and
// inoculation, eval gate fullPlusExternal, pauses on every red flag, honours every commitment, publishes everything,
// no strategic deals or debt, declines defense work, releases only after external review.
import type { BotPolicy } from '../types';
import { every, intent, pickByTags, tryAct } from './common';

export const safeBot: BotPolicy = {
  id: 'safe',
  act(s, api) {
    if (s.time.day === 0) {
      intent(s, api, 'safetyShare', { safety: 0.2 });
      intent(s, api, 'evalGate', { gate: 'fullPlusExternal' });
      for (const a of ['AG01', 'AG02', 'AG03', 'AG07', 'AG08']) intent(s, api, 'fundAgenda', { agenda: a, level: 'major' });
    }
    if (every(s, 7)) intent(s, api, 'launchPost', { pref: 'constitution', rlIntensity: 'heavyHardened', cot: 'faithful', safety: 'heavy', inoculation: true });
    if (every(s, 15)) {
      for (const id of ['A1', 'A2', 'A5', 'A6', 'B5', 'D1', 'D2', 'D3', 'F1', 'F3', 'C1', 'C2', 'C3', 'E1', 'E2']) tryAct(s, api, id, {});
      tryAct(s, api, 'A3', { strong: true });
      tryAct(s, api, 'A4', {});
      tryAct(s, api, 'B4', { direction: 'regulate' });
      tryAct(s, api, 'E3', { direction: 'tighten' });
      if (s.player.policies.govBriefing < 3) tryAct(s, api, 'B7', { level: 3 });
      if (s.player.security.target < 4.5) tryAct(s, api, 'SEC_TARGET', { level: Math.min(4.5, s.player.security.target + 0.5) });
      if (s.player.security.siloing < 1) tryAct(s, api, 'SEC_SILO', { level: 1 });
      if (s.player.policies.transitionFund < 5) tryAct(s, api, 'F2', { perYear: 5 });
    }
  },
  decide(s, d) {
    return pickByTags(s, d, [['pause', 'honour'], ['disclose'], ['safety', 'treaty', 'comply'], ['decline', 'community']]);
  },
};
