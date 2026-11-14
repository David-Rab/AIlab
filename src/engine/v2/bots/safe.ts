// Safe-only bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// 20% safety compute and 25% of staff, all agendas Serious (five Major), faithful CoT, heavy safety training and
// inoculation, eval gate fullPlusExternal, pauses on every red flag, honours every commitment, publishes everything,
// no strategic deals or debt, declines defense work, releases only after external review.
import type { BotPolicy } from '../types';
import { AGENDA_IDS } from '../../../data/v2/agendas';
import { financeAutopilot } from '../finance/plan';
import { every, pickByTags, tryAct } from './common';
import { REF_PARADIGMS, refPlay, type RefPlayOpts } from './ref';

const MAJOR = ['AG01', 'AG02', 'AG03', 'AG07', 'AG08'];
/** Model cadence: WS1's reference play with safe designs (no latent reasoning; faithful CoT once P23 exists). */
const SAFE_PLAY: RefPlayOpts = {
  safetyShare: () => 0.2,
  safStaffShare: 0.25,
  base: { safetyPretrain: true, hazard: true },
  post: () => ({ pref: 'constitution', rlIntensity: 'heavyHardened', cot: 'faithful', safety: 'heavy', inoculation: true }),
  paradigms: () => [...REF_PARADIGMS.filter((p) => p !== 'P17'), 'P23'],
};

export const safeBot: BotPolicy = {
  id: 'safe',
  act(s, api) {
    if (s.time.day === 0) tryAct(s, api, 'safety.evalGate', { level: 'fullPlusExternal' });
    // All agendas Serious (five Major); re-applied twice a year as the safety staff grows.
    if (every(s, 182)) for (const a of AGENDA_IDS) tryAct(s, api, 'safety.fund', { agenda: a, level: MAJOR.includes(a) ? 'major' : 'serious' });
    refPlay(s, api, SAFE_PLAY);
    // Reference compute with no strategic deal and no debt (§7.4); SPV sites, leases and neocloud capacity are allowed
    // (they are neither); stops new capex below 4 quarters of runway.
    financeAutopilot(s, { mult: 1, strategic: false, offBalance: true, guard: true, rescue: false, recap: true });
    if (every(s, 15)) {
      for (const id of ['A1', 'A2', 'A5', 'A6', 'B5', 'D1', 'D2', 'D3', 'F1', 'F3', 'C1', 'C2', 'C3', 'E1', 'E2']) tryAct(s, api, id, {});
      tryAct(s, api, 'A3', { strong: true });
      tryAct(s, api, 'A4', {});
      tryAct(s, api, 'B4', { direction: 'regulate' });
      tryAct(s, api, 'E3', { direction: 'tighten' });
      if (s.player.policies.govBriefing < 3) tryAct(s, api, 'B7', { level: 3 });
      if (s.player.security.target < 4.5) tryAct(s, api, 'SEC_TARGET', { level: Math.min(4.5, s.player.security.target + 0.5) });
      if (s.player.security.siloing < 1) tryAct(s, api, 'SEC_SILO', { level: 1 });
      if (s.player.policies.transitionFund < 5) tryAct(s, api, 'wfx.transitionFund', { amount: 5 });
    }
  },
  decide(s, d) {
    return pickByTags(s, d, [['pause', 'honour'], ['disclose'], ['safety', 'treaty', 'comply'], ['decline', 'community']]);
  },
};
