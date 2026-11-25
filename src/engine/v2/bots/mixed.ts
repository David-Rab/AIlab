// Heuristic mixed bot (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
// Keeps U-margin ≥ −0.3 by moving safety compute between 3% and 12%; staffs AG02/07/08/09/18 and a lottery line (R8:
// a science team each, a second on AG08/AG18/AG02, three safety research-engineering teams for tool upkeep); hardened
// suites (model v3 D5: the start suites, never re-hardened) with inoculation and visible CoT; latent reasoning only if AG01 or AG02's posterior mean > 0.6; reference
// capex with one strategic deal, runway ≥ 5 q; releases minis and enterprise products; discloses findings; signs
// A1 and A2; briefs government at level 2; patches or targets, never retrains-against; pursues the China D-track;
// Safety framework training holds: control on internal AI work where the rule asks for it, otherwise the hold stands.
// Its choices (lottery candidates, team counts, lines, red flags, thresholds, safety-share steering, the actions it takes)
// are MixedBotSettings (bots/settings.ts; DEFAULT_MIXED holds the values quoted above).
import { sightLimitPoint } from '../safety/sightLimit';
import { internalVersion, measuredLOf } from '../models/labs';
import type { AgendaId, BotPolicy, GameStateV2 } from '../types';
import { clamp } from '../../rng';
import { financeAutopilot } from '../finance/plan';
import { byLabel, every, mergerChoice, pickByTags, sizedTarget, staffLines, tryAct, type LinePlan } from './common';
import { refPlay, treeGoals, type RefPlayOpts } from './ref';
import { DEFAULT_MIXED, type MixedBotSettings } from './settings';

const posteriorMean = (s: GameStateV2, a: AgendaId) => {
  const p = s.player.safety.agendas[a]?.posterior;
  return p ? p.a / (p.a + p.b) : 0;
};

/** The mixed bot with the choices `S` (bots/settings.ts); `mixedBot` is the defaults. */
export function makeMixedBot(S: MixedBotSettings = DEFAULT_MIXED): BotPolicy {
  /** One team on each of five lines and the lottery line, then a second on each (settings.lines). */
  const mixedLines = (s: GameStateV2): LinePlan[] => {
    const lottery = S.lottery[Number(s.flags['mixed:lottery'] ?? 0)] ?? 'AG01';
    return S.lines.map((l) => ({ ag: l.ag === 'lottery' ? lottery : l.ag, teams: l.teams }));
  };

  /** Latent reasoning only with strong interpretability evidence (AG01 or AG02 posterior mean > settings.latentOk). */
  const latentOk = (s: GameStateV2) => posteriorMean(s, 'AG01') > S.latentOk || posteriorMean(s, 'AG02') > S.latentOk;

  const refTree = treeGoals(S.ref);
  /** Model cadence: WS1's reference play; safety compute 3–12% steered monthly by the sight-limit gap. */
  const MIXED_PLAY: RefPlayOpts = {
    settings: S.ref,
    safetyShare: (s) => {
      const m = sightLimitPoint(s) - measuredLOf(s, internalVersion(s)).L;
      const cur = s.player.split.safety;
      const st = S.safetyShareSteering;
      // Act before the margin goes negative (M4): +3 points a month once it is under +0.5, −1 above +2.
      return clamp(m < st.raiseBelow ? cur + st.raise : m > st.lowerAbove ? cur - st.lower : cur, S.safetyShareBounds[0], S.safetyShareBounds[1]);
    },
    post: () => ({ ...S.play.post }),
    tree: (s) => (latentOk(s) ? refTree : refTree.filter((g) => g.id !== 'P17')),
    release: S.play.release,
  };

  return {
    id: 'mixed',
    act(s, api) {
      if (s.time.day === 0) {
        tryAct(s, api, 'teams.target', { key: 'sci.saf', n: sizedTarget(s, S.sciTeams) });
        tryAct(s, api, 'teams.target', { key: 're.saf', n: sizedTarget(s, S.reTeams) });
        // Plus the best-posterior lottery line (§7.4), chosen once.
        s.flags['mixed:lottery'] = S.lottery.indexOf(S.lottery.reduce((a, b) => (posteriorMean(s, b) > posteriorMean(s, a) ? b : a)));
      }
      staffLines(s, api, mixedLines(s));
      // Respond to red flags with the cause-aware responses (an environment fix for a signal trait, a method for later runs otherwise), never retrain-against (tool upkeep is the safety research
      // engineers' job since R8).
      if (every(s, 30, 11)) {
        const iv = internalVersion(s);
        if (iv) {
          for (const t of S.redFlags) {
            const b = iv.beliefs[t];
            if (!b || b.est <= S.redFlagThresholds[0] || b.clarity <= S.redFlagThresholds[1]) continue;
            tryAct(s, api, 'safety.respond', { kind: 'patchSignal', versionId: iv.id, trait: t });
            tryAct(s, api, 'safety.respond', { kind: 'addMethod', versionId: iv.id, trait: t });
          }
        }
      }
      refPlay(s, api, MIXED_PLAY);
      // Reference compute and one strategic deal; prudent (no new capex under 4 quarters of runway).
      financeAutopilot(s, S.autopilot);
      // Enterprise products alongside the minis.
      if (every(s, 30, 7)) {
        const mini = [...s.player.models.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready');
        const ent = s.player.deployments.find((d) => d.channel === 'enterprise' && d.status === 'live');
        if (mini && ent && ent.versionId !== mini.id) tryAct(s, api, 'product.update', { id: ent.id, versionId: mini.id });
      }
      if (every(s, S.acts.every, 3)) {
        for (const id of S.acts.ids) tryAct(s, api, id, {});
        if (s.player.policies.govBriefing < S.govBriefing) tryAct(s, api, 'B7', { level: S.govBriefing });
        // Keep weight security a step above the status-quo floor (theft is the big China lever).
        if (s.player.security.target < Math.min(5, s.player.security.wsl + 0.5) && s.player.finance.cash > 10) tryAct(s, api, 'SEC_TARGET', { level: Math.min(5, s.player.security.wsl + S.securityStep) });
      }
    },
    decide(s, d) {
      switch (d.id) {
        case 'E10': return byLabel(d, 'Public + retaliate');
        case 'E12': return byLabel(d, 'Comply');
        case 'E20': return byLabel(d, 'Accept');
        case 'E22': return byLabel(d, 'Decline', 1);
        case 'E23': return byLabel(d, 'Verified talks');
        case 'E30': return byLabel(d, 'Honour');
        case 'E32': return mergerChoice(s, d, S.mergerChoice); // FIN3c: cash or stock, never control
        default: return pickByTags(s, d, [['disclose', 'honour'], ['balanced', 'control'], ['cooperate', 'community'], ['safety']]);
      }
    },
  };
}

export const mixedBot: BotPolicy = makeMixedBot();
