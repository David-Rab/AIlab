// Safe-only bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// 20% safety compute and 25% of staff, all agendas Serious (five Major), faithful CoT, heavy safety training and
// inoculation, eval gate fullPlusExternal, pauses on every red flag, honours every commitment, publishes everything,
// no strategic deals or debt, declines defense work, releases only after external review.
import type { BotPolicy } from '../types';
import { AGENDA_IDS } from '../../../data/v2/agendas';
import { financeAutopilot, financeDecide, type AutopilotOpts } from '../finance/plan';
import { runwayOf } from '../finance/runway';
import { every, pickByTags, tryAct } from './common';
import { REF_TREE, SAFE_TREE_EXTRA, refPlay, type RefPlayOpts } from './ref';

const MAJOR = ['AG01', 'AG02', 'AG03', 'AG07', 'AG08'];
/** Model cadence: WS1's reference play with safe designs (no latent reasoning; faithful CoT once P23 exists). */
const SAFE_PLAY: RefPlayOpts = {
  safetyShare: () => 0.2,
  safStaffShare: 0.25,
  base: { safetyPretrain: true, hazard: true },
  post: () => ({ pref: 'constitution', rlIntensity: 'heavyHardened', cot: 'faithful', safety: 'heavy', inoculation: true }),
  tree: () => [...REF_TREE.filter((g) => g.id !== 'P17'), ...SAFE_TREE_EXTRA],
};

/** Reference compute with no strategic deal and no debt (§7.4); SPV sites, leases and neocloud capacity are allowed
 *  (they are neither). Without a partner it cannot fund the full reference build-out, so it plans 75% of it and stops new
 *  capex below 5 quarters of runway (a CEO who means to keep the company) [D, M4]. */
const SAFE_AUTOPILOT: AutopilotOpts = { mult: 0.5, strategic: false, offBalance: true, guard: true, rescue: false, recap: true, guardQ: 6, raiseBelowQ: 8, bridgeFloorQ: 5 };

export const safeBot: BotPolicy = {
  id: 'safe',
  act(s, api) {
    if (s.time.day === 0) tryAct(s, api, 'safety.evalGate', { level: 'fullPlusExternal' });
    // All agendas Serious (five Major); re-applied twice a year as the safety staff grows.
    if (every(s, 182)) for (const a of AGENDA_IDS) tryAct(s, api, 'safety.fund', { agenda: a, level: MAJOR.includes(a) ? 'major' : 'serious' });
    refPlay(s, api, SAFE_PLAY);
    // Releases wait for external review (fullPlusExternal), which lands 2–8 weeks after a version is ready: keep the
    // newest mini's own eval suite fresh so it can launch the day the report arrives.
    if (every(s, 10, 5)) {
      const mini = [...s.player.models.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready');
      if (mini && s.time.day - (mini.evals.suiteDay ?? -1e9) >= 24) tryAct(s, api, 'runEvals', { versionId: mini.id });
    }
    financeAutopilot(s, SAFE_AUTOPILOT);
    if (every(s, 15)) {
      for (const id of ['A1', 'A2', 'A6', 'B5', 'F3', 'C1', 'C3', 'E1', 'E2']) tryAct(s, api, id, {});
      // Paid relation actions (bounties, grants, data licences, community benefits, KYC) only with runway to spare.
      if (runwayOf(s).q >= 5) for (const id of ['A5', 'D1', 'D2', 'D3', 'F1', 'C2']) tryAct(s, api, id, {});
      tryAct(s, api, 'A3', { strong: true });
      tryAct(s, api, 'A4', {});
      tryAct(s, api, 'B4', { direction: 'regulate' });
      tryAct(s, api, 'E3', { direction: 'tighten' });
      if (s.player.policies.govBriefing < 3) tryAct(s, api, 'B7', { level: 3 });
      if (s.player.security.target < 4.5) tryAct(s, api, 'SEC_TARGET', { level: Math.min(4.5, s.player.security.target + 0.5) });
      if (s.player.security.siloing < 1) tryAct(s, api, 'SEC_SILO', { level: 1 });
      // Transition fund sized to what the company earns (5% of revenue, ≤ $20B/yr) rather than a fixed $5B from day 0.
      const fund = Math.min(20, Math.floor(0.05 * s.player.finance.revenueRun));
      if (fund >= 1 && s.player.policies.transitionFund < fund && s.player.finance.state !== 'distress') tryAct(s, api, 'wfx.transitionFund', { amount: fund });
    }
  },
  decide(s, d) {
    return financeDecide(s, d, SAFE_AUTOPILOT) ?? pickByTags(s, d, [['pause', 'honour'], ['disclose'], ['safety', 'treaty', 'comply'], ['decline', 'community']]);
  },
};
