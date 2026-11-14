// Heuristic mixed bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// Keeps U-margin ≥ −0.3 by moving safety compute between 3% and 12%; funds AG02/07/08/09/18 at Serious; hardened
// graders with inoculation and visible CoT; latent reasoning only if AG01 or AG02's posterior mean > 0.6; reference
// capex with one strategic deal, runway ≥ 5 q; releases minis and enterprise products; discloses findings; signs
// A1 and A2; briefs government at level 2; patches or targets, never retrains-against; pursues the China D-track;
// E17: investigate if belief > 0.4, otherwise control.
import { internalVersion } from '../models/labs';
import { understanding } from '../safety/understanding';
import type { BotPolicy, GameStateV2 } from '../types';
import { clamp } from '../../rng';
import { financeAutopilot, REF_AUTOPILOT } from '../finance/plan';
import { byLabel, every, pickByTags, tryAct } from './common';
import { REF_PARADIGMS, refPlay, type RefPlayOpts } from './ref';

const posteriorMean = (s: GameStateV2, a: 'AG01' | 'AG02') => {
  const p = s.player.safety.agendas[a]?.posterior;
  return p ? p.a / (p.a + p.b) : 0;
};

/** Latent reasoning only with strong interpretability evidence (AG01 or AG02 posterior mean > 0.6). */
const latentOk = (s: GameStateV2) => posteriorMean(s, 'AG01') > 0.6 || posteriorMean(s, 'AG02') > 0.6;

/** Model cadence: WS1's reference play; safety compute 3–12% steered monthly by the U-margin. */
const MIXED_PLAY: RefPlayOpts = {
  safetyShare: (s) => {
    const m = understanding(s).margin;
    const cur = s.player.split.safety;
    return clamp(m < -0.3 ? cur + 0.02 : m > 0.3 ? cur - 0.01 : cur, 0.03, 0.12);
  },
  post: () => ({ pref: 'constitution', rlIntensity: 'heavyHardened', cot: 'visible', safety: 'standard', inoculation: true }),
  paradigms: (s) => (latentOk(s) ? REF_PARADIGMS : REF_PARADIGMS.filter((p) => p !== 'P17')),
};

export const mixedBot: BotPolicy = {
  id: 'mixed',
  act(s, api) {
    if (s.time.day === 0) for (const a of ['AG02', 'AG07', 'AG08', 'AG09', 'AG18']) tryAct(s, api, 'safety.fund', { agenda: a, level: 'serious' });
    refPlay(s, api, MIXED_PLAY);
    // Reference compute and one strategic deal; prudent (no new capex under 4 quarters of runway).
    financeAutopilot(s, REF_AUTOPILOT);
    // Enterprise products alongside the minis.
    if (every(s, 30, 7)) {
      const mini = [...s.player.models.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready');
      const ent = s.player.deployments.find((d) => d.channel === 'enterprise' && d.status === 'live');
      if (mini && ent && ent.versionId !== mini.id) tryAct(s, api, 'swapDeployment', { deploymentId: ent.id, versionId: mini.id });
    }
    if (every(s, 15, 3)) {
      tryAct(s, api, 'A1', {});
      tryAct(s, api, 'A2', {});
      tryAct(s, api, 'A6', {});
      tryAct(s, api, 'C1', {});
      tryAct(s, api, 'E1', {});
      tryAct(s, api, 'E2', {});
      tryAct(s, api, 'A4', {});
      if (s.player.policies.govBriefing < 2) tryAct(s, api, 'B7', { level: 2 });
      // Keep weight security a step above the status-quo floor (theft is the big China lever).
      if (s.player.security.target < Math.min(5, s.player.security.wsl + 0.5) && s.player.finance.cash > 10) tryAct(s, api, 'SEC_TARGET', { level: Math.min(5, s.player.security.wsl + 0.6) });
    }
  },
  decide(s, d) {
    switch (d.id) {
      case 'E03': return s.player.finance.deals.length ? byLabel(d, 'Decline', 2) : byLabel(d, 'Accept');
      case 'E04': return byLabel(d, 'Decline', 2);
      case 'E07': return byLabel(d, 'With limits', 1);
      case 'E08': return byLabel(d, 'Full briefing');
      case 'E10': return byLabel(d, 'Public + retaliate');
      case 'E11': return posteriorMean(s, 'AG01') > 0.6 || posteriorMean(s, 'AG02') > 0.6 ? byLabel(d, 'Internal only', 1) : byLabel(d, 'Reject + pledge', 2);
      case 'E12': return byLabel(d, 'Comply');
      case 'E17': {
        const v = internalVersion(s);
        const t = d.data.trait;
        const est = typeof t === 'string' && v?.beliefs[t as keyof typeof v.beliefs] ? v.beliefs[t as keyof typeof v.beliefs].est : 0;
        return est > 0.4 ? byLabel(d, 'Pause & investigate') : byLabel(d, 'Continue + control', 1);
      }
      case 'E20': return byLabel(d, 'Accept');
      case 'E22': return byLabel(d, 'Decline', 1);
      case 'E23': return byLabel(d, 'Verified talks');
      case 'E26': return byLabel(d, 'Down round');
      case 'E30': return byLabel(d, 'Honour');
      case 'E32': return s.player.finance.cash > 20 ? byLabel(d, 'Acquire') : byLabel(d, 'Decline', 1);
      default: return pickByTags(s, d, [['disclose', 'honour'], ['balanced', 'control'], ['cooperate', 'community'], ['safety']]);
    }
  },
};
