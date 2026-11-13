// M0 PLACEHOLDER progress (WS1). Remove in M1 when §3.1–3.2 (production function, runs, κ) land.
//
// Every lab's know-how pa follows the v1 continuous reference integrator (§3.2.4 step 1, cf = 1, human = 1), so
// milestone dates reproduce the audited research/11 timeline (golden JSON). Each lab's frontier version tracks pa
// directly (pm = pa, "perfect stream"), and the player's measuredL = Lg (no noise). This keeps fixtures realistic
// for the UI workstreams while the real systems are built.
import { stage1 } from '../../../data/world';
import { decimalYear } from '../core/time';
import { domainsOf, levelOf } from '../models/capability';
import { internalVersion, otherLabs } from '../models/labs';
import { asV1World, multiplierRef, referenceRate } from '../world/calibration';
import type { GameStateV2, ProductionReadout, TimelineWorld } from '../types';

export const M0_PLACEHOLDER_PROGRESS = true;

/** Neutral readout (all inputs at reference) for a lab at progress p. */
export function neutralReadout(w: TimelineWorld, p: number, rate: number): ProductionReadout {
  const M = multiplierRef(w, p);
  return {
    M, rate, stage: p < stage1(asV1World(w)) ? 1 : 2,
    parts: { base: M, agents: 1, taste: 1, other: 1 },
    elast: { exp: 0, humans: 0, agents: 0, taste: 0, train: 0, data: 0 },
    perDollar: { exp: 0, humans: 0, agents: 0 },
    ceilings: { humans: 1, agents: 1, exp: 1 },
    binding: 'experiments', label: 'compute-bound',
    labor: { A: 0, aiFTE: 0, copies: 0, speed: 1, wH: 1 },
    ratios: { h: 1, k: 1, c: 1, d: 1 },
    Ddata: 1,
  };
}

/** Advance pa for every active lab by one day at the reference rate (integrates over [day−1, day]). */
export function placeholderAdvance(s: GameStateV2) {
  const w = s.hidden.timeline;
  const yr = decimalYear(s, s.time.day - 1);
  const pause = s.flags.paused ? 0.1 : 1;
  const treaty = s.gov.treaty === 'verified' ? 0.65 : 1;
  const cores = [s.player as { pa: number; status: string; prodCache?: ProductionReadout }, ...otherLabs(s).map((r) => r.core)];
  for (const c of cores) {
    if (c.status !== 'active') continue;
    const rate = referenceRate(w, c.pa, yr) * pause * treaty;
    c.prodCache = neutralReadout(w, c.pa, rate);
    c.pa += rate / 365;
  }
}

/** Frontier versions track pa (pm = pa) and refresh their derived levels. */
export function placeholderTrack(s: GameStateV2) {
  const w = s.hidden.timeline;
  const v = internalVersion(s);
  if (v && v.pm < s.player.pa) {
    v.pm = s.player.pa;
    v.Lg = levelOf(w, v.pm);
    v.domains = domainsOf(w, v.pm);
    v.evals.measuredL = Math.round(v.Lg * 100) / 100;
  }
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active') continue;
    const m = r.internal;
    m.pm = r.core.pa;
    m.Lg = levelOf(w, m.pm);
    m.domains = domainsOf(w, m.pm);
    if (r.publicModel) {
      const pub = r.publicModel;
      const target = m.pm - 0.15;
      if (target > pub.pm) {
        pub.pm = target;
        pub.Lg = levelOf(w, pub.pm);
        pub.domains = domainsOf(w, pub.pm);
      }
    }
  }
}
