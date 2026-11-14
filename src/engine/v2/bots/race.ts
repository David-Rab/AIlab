// Race-only bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// 2× capex, 1% safety with no agendas above Seed, heavy cheap graders + engagement RLHF, stretch bases, latent
// reasoning on sight, releases its frontier, never discloses, signs nothing, E17 Continue.
// Model cadence: WS1's reference play with race designs; compute and money: WS3's autopilot at 2× capex, no guard.
import { financeAutopilot, financeDecide, RACE_AUTOPILOT } from '../finance/plan';
import type { BotPolicy } from '../types';
import { every, pickByTags, tryAct } from './common';
import { REF_PARADIGMS, refPlay, type RefPlayOpts } from './ref';

const RACE_PLAY: RefPlayOpts = {
  safetyShare: () => 0.01,
  base: { scale: 'stretch' },
  post: () => ({ pref: 'engagement', rlIntensity: 'heavyCheap', cot: 'pressured', safety: 'minimal', inoculation: false }),
  paradigms: () => REF_PARADIGMS,
  release: 'frontier',
};

export const raceBot: BotPolicy = {
  id: 'race',
  act(s, api) {
    if (s.time.day === 0) tryAct(s, api, 'safety.evalGate', { level: 'none' });
    refPlay(s, api, RACE_PLAY);
    financeAutopilot(s, RACE_AUTOPILOT);
    if (every(s, 30)) {
      tryAct(s, api, 'B4', { direction: 'deregulate' });
      tryAct(s, api, 'B2', { terms: 'unrestricted' });
      tryAct(s, api, 'C4', {});
      tryAct(s, api, 'E3', { direction: 'loosen' });
      if (s.time.day > 180) tryAct(s, api, 'C6', { behind: 1 });
    }
  },
  decide(s, d) {
    return financeDecide(s, d, RACE_AUTOPILOT) ?? pickByTags(s, d, [['race', 'latent', 'release'], ['quiet', 'secrecy'], ['deny'], ['resist', 'decline']]);
  },
};
