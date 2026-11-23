// The lab's believed internal oversight of a model (model v3 E15; output only: no state changes, no RNG). Owner: WS2.
//
// E6's internalOversight (incidents.ts) rebuilt on what the player knows, shared by E11's danger readout (an internal
// lane's catch and containment) and E9's believed control (believedTerms), so the two readouts cannot drift:
//   block   = AG07 containment at the BELIEVED tool strength on the measured capability (no U-mode multiplier)
//   catch   = 1 − (1 − monitor)(1 − human) · controlMiss
//     monitor     believed CoT/white-box detection (believed masks) at the measured level × (½ + ½ × the fleet's monitor
//                 strength, from measured levels)
//     human       human review on the measured gap above expert humans, on the human share of the work
//     controlMiss control deferral's miss multiplier while the control layer is on
// Never reads true tool strengths, true masks, true levels or U-modes.
import { controlOn, labControlSetting, reviewOn } from './safeguards';
import { HUMAN_REVIEW } from '../../../data/v2/danger';
import { HUMAN_REVIEW_L } from '../../../data/v2/oversight';
import { fleetMonitor } from '../departments/agents';
import { measuredLOf } from '../models/labs';
import type { GameStateV2, ModelVersion, TraitId } from '../types';
import { aiRdShare } from './incidents';
import { controlProtocol, gapFactor, measuredOom, oversightGap, underControl } from './oversight';
import { containment, techniqueRole } from './techniques';
import { sightAt } from './sightLimit';

/** Believed monitoring catch on trait k inside the lab: CoT and white-box tools as the player believes them, at the
 *  model's measured level, × (½ + ½ × the fleet's monitor strength). */
export function believedMonitorCatch(s: GameStateV2, v: ModelVersion, trait: TraitId, L = measuredLOf(s, v).L): number {
  const tools = Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active && techniqueRole(t) !== 'fix' && (t.family === 'COT' || t.family === 'WB'));
  const det = tools.length ? sightAt(s, v, trait, L, tools) : 0;
  return Math.max(0, Math.min(1, det * (0.5 + 0.5 * fleetMonitor(s, v, trait, true))));
}

/** The trait-independent parts: believed containment (`layer` = the control layer on the overseeing deployment), human
 *  review on the measured gap (`aiShare` = the AI share of the work), control deferral's miss multiplier. */
export function believedOversightParts(s: GameStateV2, v: ModelVersion, layer: boolean, aiShare: number, miss = layer, review = true): { L: number; block: number; human: number; controlMiss: number } {
  const L = measuredLOf(s, v).L;
  return {
    L,
    block: containment(s, measuredOom(s, v), layer, true),
    human: (review ? HUMAN_REVIEW : 0) * (1 - aiShare) * gapFactor(oversightGap(s.hidden.timeline, L, HUMAN_REVIEW_L).oom),
    controlMiss: miss ? controlProtocol(undefined, labControlSetting(s)).missMult : 1,
  };
}

/** Believed internalOversight of model v on acts of `trait`: the same deployment and control-layer choice as E6's, every
 *  term from beliefs and measured levels. */
export function believedInternalOversight(s: GameStateV2, v: ModelVersion, trait: TraitId = 'SCHEME', aiShare = aiRdShare(s)): { oversight: number; block: number; catch: number; monitor: number; human: number; controlMiss: number } {
  const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.versionId === v.id && d.status !== 'withdrawn')
    ?? s.player.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  const p = believedOversightParts(s, v, !!controlOn(dep), aiShare, underControl(s), reviewOn(dep));
  const monitor = believedMonitorCatch(s, v, trait, p.L);
  const c = 1 - (1 - monitor) * (1 - p.human) * p.controlMiss;
  return { oversight: 1 - (1 - p.block) * (1 - c), block: p.block, catch: c, monitor, human: p.human, controlMiss: p.controlMiss };
}
