// Heuristic mixed bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// Keeps U-margin ≥ −0.3 by moving safety compute between 3% and 12%; staffs AG02/07/08/09/18 and a lottery line (R8:
// a science team each, a second on AG08/AG18/AG02, three safety research-engineering teams for tool upkeep); hardened
// suites (model v3 D5: the start suites, never re-hardened) with inoculation and visible CoT; latent reasoning only if AG01 or AG02's posterior mean > 0.6; reference
// capex with one strategic deal, runway ≥ 5 q; releases minis and enterprise products; discloses findings; signs
// A1 and A2; briefs government at level 2; patches or targets, never retrains-against; pursues the China D-track;
// E17: investigate if belief > 0.4, otherwise control.
import { internalVersion } from '../models/labs';
import { understanding } from '../safety/understanding';
import type { AgendaId, BotPolicy, GameStateV2, TraitId } from '../types';
import { clamp } from '../../rng';
import { financeAutopilot, financeDecide, REF_AUTOPILOT } from '../finance/plan';
import { byLabel, every, pickByTags, sizedTarget, staffLines, tryAct, type LinePlan } from './common';
import { REF_TREE, refPlay, type RefPlayOpts } from './ref';

const LOTTERY: AgendaId[] = ['AG01', 'AG04', 'AG10', 'AG11', 'AG12', 'AG13'];
const MIXED_SCI_TEAMS = 12;
const MIXED_RE_TEAMS = 5;
/** One team on each of five lines and the lottery line, then a second on AG08, AG18 and AG02. */
function mixedLines(s: GameStateV2): LinePlan[] {
  const lottery = LOTTERY[Number(s.flags['mixed:lottery'] ?? 0)] ?? 'AG01';
  return [
    ...(['AG02', 'AG08', 'AG18', 'AG09', 'AG07', lottery] as AgendaId[]).map((ag) => ({ ag, teams: 1 })),
    ...(['AG02', 'AG08', 'AG18', 'AG09', 'AG07', lottery] as AgendaId[]).map((ag) => ({ ag, teams: 2 })),
  ];
}
const RED_FLAGS: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME'];

const posteriorMean = (s: GameStateV2, a: AgendaId) => {
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
    // Act before the margin goes negative (M4): +3 points a month once it is under +0.5, −1 above +2.
    return clamp(m < 0.5 ? cur + 0.03 : m > 2 ? cur - 0.01 : cur, 0.03, 0.12);
  },
  post: () => ({ pref: 'constitution', rlBudget: 'standard', cot: 'visible', safety: 'standard', inoculation: true }),
  tree: (s) => (latentOk(s) ? REF_TREE : REF_TREE.filter((g) => g.id !== 'P17')),
};

export const mixedBot: BotPolicy = {
  id: 'mixed',
  act(s, api) {
    if (s.time.day === 0) {
      tryAct(s, api, 'teams.target', { key: 'sci.saf', n: sizedTarget(s, MIXED_SCI_TEAMS) });
      tryAct(s, api, 'teams.target', { key: 're.saf', n: sizedTarget(s, MIXED_RE_TEAMS) });
      // Plus the best-posterior lottery line (§7.4), chosen once.
      s.flags['mixed:lottery'] = LOTTERY.indexOf(LOTTERY.reduce((a, b) => (posteriorMean(s, b) > posteriorMean(s, a) ? b : a)));
    }
    staffLines(s, api, mixedLines(s));
    // Respond to red flags with patch or targeted training, never retrain-against (tool upkeep is the safety research
    // engineers' job since R8).
    if (every(s, 30, 11)) {
      const iv = internalVersion(s);
      if (iv) {
        for (const t of RED_FLAGS) {
          const b = iv.beliefs[t];
          if (!b || b.est <= 0.25 || b.clarity <= 0.3) continue;
          tryAct(s, api, 'safety.respond', { kind: 'patchSignal', versionId: iv.id, trait: t });
          tryAct(s, api, 'safety.respond', { kind: 'targetedTraining', versionId: iv.id, trait: t });
        }
      }
    }
    refPlay(s, api, MIXED_PLAY);
    // Reference compute and one strategic deal; prudent (no new capex under 4 quarters of runway).
    financeAutopilot(s, REF_AUTOPILOT);
    // Enterprise products alongside the minis.
    if (every(s, 30, 7)) {
      const mini = [...s.player.models.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready');
      const ent = s.player.deployments.find((d) => d.channel === 'enterprise' && d.status === 'live');
      if (mini && ent && ent.versionId !== mini.id) tryAct(s, api, 'product.update', { id: ent.id, versionId: mini.id });
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
    const fin = financeDecide(s, d, REF_AUTOPILOT);
    if (fin !== undefined) return fin;
    switch (d.id) {
      case 'E10': return byLabel(d, 'Public + retaliate');
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
      case 'E30': return byLabel(d, 'Honour');
      case 'E32': return s.player.finance.cash > 20 ? byLabel(d, 'Acquire') : byLabel(d, 'Decline', 1);
      default: return pickByTags(s, d, [['disclose', 'honour'], ['balanced', 'control'], ['cooperate', 'community'], ['safety']]);
    }
  },
};
