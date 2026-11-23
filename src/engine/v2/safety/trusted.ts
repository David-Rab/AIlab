// SR-20 (SAFETY-REDESIGN §3.3 Defaults, OD-6 a): the "trusted" rule and the automatic watcher.
// A model is TRUSTED (OD-6 a; RF-S1, decision 4 "not knowing counts as risk") when either
//   - beliefs: the upper end of every red-flag trait's 90% range (SCHEME, AF, SAND; detection.beliefHi) is at or below
//     the trust line, the Safety framework's Misalignment-signs threshold (the player's own rule, so editing that rule
//     moves it), TRUST_EST_DEFAULT without one; a barely observed model is not trusted on beliefs; or
//   - capability: it is below the scheming-capable level, its measured level (a suite of it; never measured = no
//     reading) in the scheming act's domain below that act's capability threshold θ (data/v2/danger.ts DANGER_ACTS.SCHEME,
//     where Able to = ½).
// Reads beliefs and measured levels only, never truth.
// The automatic watcher of an internal use (monitorId 'auto') is the most capable (measured level) live model the lab
// trusts other than the watched model; the watched model itself (a copy) only when it is the only trusted one; none when
// no model is trusted. The reason is returned for the UI. The player overrides by picking a model (or 'same').
import { TRUST_EST_DEFAULT } from '../../../data/v2/agents';
import { DANGER_ACTS } from '../../../data/v2/danger';
import { measuredDomain } from '../actors/commitments';
import { measuredLOf } from '../models/labs';
import { RED_FLAG_TRAITS } from './common';
import { beliefHi } from './detection';
import type { GameStateV2, ModelVersion } from '../types';

/** The trust line (upper end of the belief) from the player's framework. */
export function trustLine(s: GameStateV2): number {
  const r = s.player.safety.framework?.rules.find((x) => x.id === 'misalignment');
  return r && r.trigger.kind === 'belief' ? r.trigger.est : TRUST_EST_DEFAULT;
}

/** Whether the lab trusts `v`, with the reason in player language. */
export function trustOf(s: GameStateV2, v: ModelVersion): { trusted: boolean; why: string } {
  const line = trustLine(s);
  let worst: { tr: string; hi: number } | undefined;
  for (const tr of RED_FLAG_TRAITS) {
    const hi = beliefHi(v.beliefs[tr]);
    if (!worst || hi > worst.hi) worst = { tr, hi };
  }
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (worst && worst.hi <= line) return { trusted: true, why: `${v.name} trusted: ${worst.tr} at most ${pct(worst.hi)} (top of your 90% range) ≤ ${pct(line)}` };
  const sch = DANGER_ACTS.SCHEME!;
  const L = v.evals.suiteDay !== undefined ? measuredDomain(v, sch.domain) : undefined;
  if (L !== undefined && L < sch.theta) return { trusted: true, why: `${v.name} trusted: measures ${sch.domain} ${L.toFixed(1)}, below the level where covert action against oversight works (${sch.theta.toFixed(1)})` };
  return { trusted: false, why: `${v.name} not trusted: ${worst?.tr ?? 'SCHEME'} could be as high as ${pct(worst?.hi ?? 1)} (top of your 90% range) > ${pct(line)}${L === undefined ? ', and its capability is not measured' : ''}` };
}

const live = (v: ModelVersion) => v.status === 'ready' || v.status === 'deployed';

export interface AutoWatcher { v?: ModelVersion; reason: string }

/** The automatic watcher of `watched` (OD-6): the most capable trusted live model other than it; itself if it is the
 *  only trusted one; none if no model is trusted. */
export function autoWatcher(s: GameStateV2, watched: ModelVersion | undefined): AutoWatcher {
  if (!watched) return { reason: 'Nothing to watch' };
  let best: { v: ModelVersion; L: number } | undefined;
  let skipped: { v: ModelVersion; L: number; why: string } | undefined;
  for (const v of s.player.models.versions) {
    if (v.id === watched.id || !live(v)) continue;
    const L = measuredLOf(s, v).L;
    const t = trustOf(s, v);
    if (!t.trusted) {
      if (!skipped || L > skipped.L) skipped = { v, L, why: t.why };
      continue;
    }
    if (!best || L > best.L) best = { v, L };
  }
  const skip = skipped && (!best || skipped.L > best.L) ? `; skipped ${skipped.why}` : '';
  if (best) return { v: best.v, reason: `Auto: ${best.v.name}, the most capable model you trust (measured L ${best.L.toFixed(1)})${skip}` };
  const self = trustOf(s, watched);
  if (self.trusted) return { v: watched, reason: `Auto: a copy of ${watched.name}, the only model you trust${skip}` };
  return { reason: `Auto: no model you trust (${self.why})${skip}; pick a watcher to override` };
}
