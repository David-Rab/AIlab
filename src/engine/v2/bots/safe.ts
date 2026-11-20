// Safe-only bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// 20% safety compute and 25% of staff, a science team on every research line (the five major lines doubled; R8), answers
// red flags on its internal model with patches and targeted training (R9), faithful
// CoT, heavy safety training and
// inoculation, eval gate fullPlusExternal, pauses on every red flag, honours every commitment, publishes everything,
// no strategic deals or debt, declines defense work, releases only after external review.
import { internalVersion } from '../models/labs';
import type { BotPolicy, TraitId } from '../types';
import { financeAutopilot, type AutopilotOpts } from '../finance/plan';
import { runwayOf } from '../finance/runway';
import { every, pickByTags, sizedTarget, staffLines, tryAct, type LinePlan } from './common';
import { REF_TREE, SAFE_TREE_EXTRA, refPlay, type RefPlayOpts } from './ref';

/** R8: every line gets a team, the five major lines first (the safe recipe's: training-signal design, evals, applied
 *  interp, control, CoT monitorability) and then a second team each (23 teams; pre-R8: all agendas Serious, five Major).
 *  Hiring fills them over the first years. */
export const SAFE_LINES: LinePlan[] = [
  ...(['AG18', 'AG08', 'AG02', 'AG07', 'AG09'] as const).map((ag) => ({ ag, teams: 1 })),
  ...(['AG15', 'AG03', 'AG01', 'AG16', 'AG06', 'AG05', 'AG14', 'AG13', 'AG11', 'AG10', 'AG04', 'AG12', 'AG17'] as const).map((ag) => ({ ag, teams: 1 })),
  ...(['AG18', 'AG08', 'AG02', 'AG07', 'AG09'] as const).map((ag) => ({ ag, teams: 2 })),
];
export const SAFE_SCI_TEAMS = 23;
const SAFE_RED_FLAGS: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME', 'CONCEAL', 'EA', 'RH'];
const SAFE_FLAG_EST = 0.2;
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
    if (s.time.day === 0) tryAct(s, api, 'teams.target', { key: 'sci.saf', n: sizedTarget(s, SAFE_SCI_TEAMS) });
    staffLines(s, api, SAFE_LINES);
    // R9 fix: answer red flags on the internal model as the mixed bot does (patch the signal, targeted training; never
    // retrain against the detector), at any belief above 0.2.
    if (every(s, 30, 11)) {
      const iv = internalVersion(s);
      if (iv) for (const t of SAFE_RED_FLAGS) {
        const b = iv.beliefs[t];
        if (!b || b.est <= SAFE_FLAG_EST || b.clarity <= 0.3) continue;
        tryAct(s, api, 'safety.respond', { kind: 'patchSignal', versionId: iv.id, trait: t });
        tryAct(s, api, 'safety.respond', { kind: 'targetedTraining', versionId: iv.id, trait: t });
      }
    }
    refPlay(s, api, SAFE_PLAY);
    // Releases wait for external review (fullPlusExternal), which lands 2–8 weeks after a version is ready; since R6
    // eval suites do not expire, so the mini launches the day the report arrives (no 24-day re-evals).
    financeAutopilot(s, SAFE_AUTOPILOT);
    if (every(s, 15)) {
      for (const id of ['A1', 'A2', 'A6', 'B5', 'F3', 'C1', 'C3', 'E1', 'E2']) tryAct(s, api, id, {});
      // Paid relation actions (bounties, grants, data licences, community benefits, KYC) only with runway to spare.
      if (runwayOf(s).q >= 5) for (const id of ['A5', 'D1', 'D2', 'D3', 'cmp.community', 'C2']) tryAct(s, api, id, {});
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
    return pickByTags(s, d, [['pause', 'honour'], ['disclose'], ['safety', 'treaty', 'comply'], ['decline', 'community']]);
  },
};
