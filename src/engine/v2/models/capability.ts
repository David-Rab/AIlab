// Capability: levels, domains, milestones, true lead (V2-SPEC §3.1.5–3.1.6). Owner: WS1.
import { LEVEL_KNOTS, REF_OFF, RSCH_TASTE_PENALTY, DOMAIN_IDS } from '../../../data/v2/calibration';
import { clamp } from '../../rng';
import { capIndexV2, levelOf, thresholds } from '../world/calibration';
import type { DomainId, EngineSystem, GameStateV2, LabId, MilestoneIdx, TimelineWorld } from '../types';
import { PLAYER_ID, bestPm, internalVersion, labCore, otherLabs } from './labs';

/** In-game milestone names (no canon tags, §3.1.6). */
export const MILESTONE_NAMES = ['Agent', 'Reliable agent', 'Research agent', 'Superhuman coder', 'Superhuman AI researcher', 'Superintelligent AI researcher', 'Superintelligence'];

export { levelOf };

/** Domain levels L_d = Lg + refOff_d(era) + Σ designOff_d, clamped to [0, 15] (§3.1.5). */
export function domainsOf(w: TimelineWorld, pm: number, designOff: Partial<Record<DomainId, number>> = {}, hasP19 = false): Record<DomainId, number> {
  const Lg = levelOf(w, pm);
  const ci = clamp(capIndexV2(w, pm), 0, 6);
  const i = Math.min(5, Math.floor(ci));
  const t = ci - i;
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAIN_IDS) {
    const ref = REF_OFF[d][i] + (REF_OFF[d][i + 1] - REF_OFF[d][i]) * t;
    const pen = d === 'RSCH' && !hasP19 ? RSCH_TASTE_PENALTY : 0;
    out[d] = clamp(Lg + ref + pen + (designOff[d] ?? 0), 0, 15);
  }
  return out;
}

/** Days a lab's true frontier lags the player's best internal version (positive = player ahead). Hidden; engine
 *  use only (intel, endings, events). TODO(WS1, M1): use the progress history instead of the current rate. */
export function trueLeadDays(s: GameStateV2, other: LabId): number {
  const gap = bestPm(s, PLAYER_ID) - bestPm(s, other);
  const rate = Math.max(0.05, s.player.prodCache?.rate ?? 1);
  return (gap / rate) * 365;
}

/** milestones (50, daily): first-crossing record per lab (fixes v1 bug #3), SC day, act transitions. */
export const milestonesSystem: EngineSystem = {
  id: 'milestones', owner: 'WS1', cadence: 'daily', order: 50,
  run(s, ctx) {
    const w = s.hidden.timeline;
    const thr = thresholds(w);
    const check = (id: LabId) => {
      const core = labCore(s, id);
      if (!core) return;
      const pm = bestPm(s, id);
      for (let i = 0; i < thr.length; i++) {
        const idx = i as MilestoneIdx;
        if (pm >= thr[i] && core.milestoneDays[idx] === undefined) {
          core.milestoneDays[idx] = ctx.day;
          if (idx === 3 && core.scDay === undefined) core.scDay = ctx.day;
        }
      }
    };
    check(PLAYER_ID);
    for (const r of otherLabs(s)) check(r.core.id); // China's lab core id is CHINA_ID

    // The player is told when the MEASURED level crosses a milestone level (§3.1.6).
    const L = internalVersion(s)?.evals.measuredL;
    if (L !== undefined) {
      for (let i = 1; i < LEVEL_KNOTS.length; i++) {
        const key = `seenMilestone${i}`;
        if (L >= LEVEL_KNOTS[i] && s.flags[key] === undefined) {
          s.flags[key] = ctx.day;
          ctx.log('milestone', `${MILESTONE_NAMES[i]}: measured level ${L.toFixed(1)}.`, 3);
        }
      }
      // Acts keyed to milestones (§1.5).
      const M = s.player.prodCache?.M ?? 1;
      const act = L >= 12 || M >= 25 ? 4 : L >= 8.5 ? 3 : L >= 6.5 || ctx.day >= 150 ? 2 : 1;
      if (act > s.tutorial.act) s.tutorial.act = act;
    }
  },
};
