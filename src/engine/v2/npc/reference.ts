// N1 (design/npc/NPC-LABS.md section 3): the reference frontier of a game: its timeline draw's own AI Futures Model run, as the game's G
// (effective compute, OOM) on the draw's clock. G_ref(t) = G(V0) + progress(t) - progress(2025.445), the translation of
// design/bal/FIXC-TRANSLATION.md section 2 (the one gSC of timelineDraws.ts is built on). Series: data/v2/timelineSeries.ts (generated).
// Nothing in the game reads this yet.
import type { GameStateV2 } from '../types';
import { timelineOf } from '../../../data/v2/timelineWorlds';
import { SERIES_ANCHOR, SERIES_FROM, SERIES_G0, SERIES_STEP, TIMELINE_PROGRESS } from '../../../data/v2/timelineSeries';

type Tl = 'fast' | 'central' | 'slow';

/** The series of the game's drawn run, as [clock years, G values] on the grid, with the anchor point (2025.445, G(V0)) in front; undefined in a
 *  world without a draw (every world but tl-fast / tl-central / tl-slow, and a game built without a seed): its callers must handle that. */
interface Ref { g0: number; p: readonly number[]; rm: Float64Array; tail: number }
const cache = new Map<string, Ref>();
function refOf(s: Pick<GameStateV2, 'setup' | 'hidden'>): Ref | undefined {
  const tl: Tl | undefined = timelineOf(s.setup.world);
  const run = s.hidden.timeline.aifmRun;
  if (!tl || !run) return undefined;
  const key = `${tl}:${run.index}`;
  let r = cache.get(key);
  if (!r) {
    const p = TIMELINE_PROGRESS[tl][run.index];
    if (!p) return undefined;
    const rm = new Float64Array(p.length + 1); // running maximum of progress, point 0 = the anchor (0)
    for (let i = 0; i < p.length; i++) rm[i + 1] = Math.max(rm[i], p[i]);
    // Past the run's last point (its ASI date + 2 years, or 2060; the slow timeline's runs end 2037.7 to 2060) the series is extended at its
    // last decade's pace in OOM a year (the running maximum's, so never negative), or the run's whole-span mean if that decade was flat.
    const n = p.length, k = Math.min(10 / SERIES_STEP, n);
    const tail = (rm[n] - rm[n - k]) / (k * SERIES_STEP) || rm[n] / (SERIES_FROM + (n - 1) * SERIES_STEP - SERIES_ANCHOR);
    r = { g0: SERIES_G0[tl], p, rm, tail };
    cache.set(key, r);
  }
  return r;
}

/** G of the reference frontier at clock year `clockYear` (decimal year): linear in time between the grid points (0.1 yr), G(V0) at and before 2025.445
 *  (the anchor), extended linearly after the run's last grid point at the run's last-decade pace (see refOf). undefined: the game's world has no draw. */
export function refG(s: Pick<GameStateV2, 'setup' | 'hidden'>, clockYear: number): number | undefined {
  const r = refOf(s);
  if (!r) return undefined;
  const n = r.p.length;
  if (clockYear <= SERIES_ANCHOR) return r.g0;
  const end = SERIES_FROM + (n - 1) * SERIES_STEP;
  if (clockYear >= end) return r.g0 + r.p[n - 1] + r.tail * (clockYear - end);
  if (clockYear <= SERIES_FROM) return r.g0 + r.p[0] * (clockYear - SERIES_ANCHOR) / (SERIES_FROM - SERIES_ANCHOR);
  const x = (clockYear - SERIES_FROM) / SERIES_STEP, i = Math.floor(x), f = x - i;
  return r.g0 + r.p[i] + (r.p[i + 1] - r.p[i]) * f;
}

/** The inverse: the earliest clock year at which the reference frontier's G (its running maximum, in the runs where progress dips by up to
 *  0.8 OOM) reaches `G`. G(V0) or less: 2025.445 (the anchor). Above the run's last value: the year the linear extension of refG reaches it (always finite). undefined: no draw. */
export function clockOfG(s: Pick<GameStateV2, 'setup' | 'hidden'>, G: number): number | undefined {
  const r = refOf(s);
  if (!r) return undefined;
  const target = G - r.g0, rm = r.rm, n = rm.length; // rm[k] at clock SERIES_FROM + (k - 1) * SERIES_STEP, rm[0] at the anchor
  if (target <= 0) return SERIES_ANCHOR;
  if (target > rm[n - 1]) return SERIES_FROM + (n - 2) * SERIES_STEP + (target - rm[n - 1]) / r.tail;
  let lo = 0, hi = n - 1; // first k with rm[k] >= target (rm is non-decreasing)
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rm[mid] >= target) hi = mid; else lo = mid; }
  const t = (k: number) => (k === 0 ? SERIES_ANCHOR : SERIES_FROM + (k - 1) * SERIES_STEP);
  const a = rm[lo], b = rm[hi];
  return b === a ? t(hi) : t(lo) + (t(hi) - t(lo)) * (target - a) / (b - a);
}
