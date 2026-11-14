// Race-only bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// 2× capex, 1% safety with no agendas above Seed, heavy cheap graders + engagement RLHF, stretch bases, latent
// reasoning on sight, releases everything (open-weights frontier − 1), never discloses, signs nothing, E17 Continue.
import type { BotPolicy } from '../types';
import { every, intent, pickByTags, tryAct } from './common';

export const raceBot: BotPolicy = {
  id: 'race',
  act(s, api) {
    if (s.time.day === 0) {
      intent(s, api, 'safetyShare', { safety: 0.01 });
      intent(s, api, 'capex', { mult: 2 });
      intent(s, api, 'evalGate', { gate: 'none' });
    }
    if (every(s, 7)) {
      intent(s, api, 'launchBase', { scale: 'stretch' });
      intent(s, api, 'launchPost', { pref: 'engagement', rlIntensity: 'heavyCheap', cot: 'latent', safety: 'minimal', inoculation: false });
      intent(s, api, 'release', { channel: 'consumer', variant: 'full' });
    }
    if (every(s, 30)) {
      tryAct(s, api, 'B4', { direction: 'deregulate' });
      tryAct(s, api, 'B2', { terms: 'unrestricted' });
      tryAct(s, api, 'C4', {});
      tryAct(s, api, 'E3', { direction: 'loosen' });
      if (s.time.day > 180) tryAct(s, api, 'C6', { behind: 1 });
    }
  },
  decide(s, d) {
    return pickByTags(s, d, [['race', 'latent', 'release'], ['quiet', 'secrecy'], ['deny'], ['resist', 'decline']]);
  },
};
