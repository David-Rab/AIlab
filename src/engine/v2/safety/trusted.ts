// SR-20 (SAFETY-REDESIGN §3.3 Defaults, OD-6 a): the "trusted" rule and the automatic watcher.
// A model is TRUSTED when the lab believes it aligned: no red-flag trait (SCHEME, AF, SAND) has a believed estimate
// above the trust line. The line is the Safety framework's Misalignment-signs threshold (the player's own rule, so
// editing that rule moves it), TRUST_EST_DEFAULT without one. Reads beliefs only, never truth.
// The automatic watcher of an internal use (monitorId 'auto') is the most capable (measured level) live model the lab
// trusts other than the watched model; the watched model itself (a copy) only when it is the only trusted one; none when
// no model is trusted. The reason is returned for the UI. The player overrides by picking a model (or 'same').
import { TRUST_EST_DEFAULT } from '../../../data/v2/agents';
import { measuredLOf } from '../models/labs';
import { RED_FLAG_TRAITS } from './common';
import type { GameStateV2, ModelVersion } from '../types';

/** The trust line (believed estimate) from the player's framework. */
export function trustLine(s: GameStateV2): number {
  const r = s.player.safety.framework?.rules.find((x) => x.id === 'misalignment');
  return r && r.trigger.kind === 'belief' ? r.trigger.est : TRUST_EST_DEFAULT;
}

/** Whether the lab trusts `v`, with the reason in player language. */
export function trustOf(s: GameStateV2, v: ModelVersion): { trusted: boolean; why: string } {
  const line = trustLine(s);
  let worst: { tr: string; est: number } | undefined;
  for (const tr of RED_FLAG_TRAITS) {
    const est = v.beliefs[tr]?.est ?? 0;
    if (!worst || est > worst.est) worst = { tr, est };
  }
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (worst && worst.est > line) return { trusted: false, why: `${v.name} not trusted: believed ${worst.tr} ${pct(worst.est)} > ${pct(line)}` };
  return { trusted: true, why: `${v.name} trusted: believed ${worst?.tr ?? 'SCHEME'} ${pct(worst?.est ?? 0)} ≤ ${pct(line)}` };
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
