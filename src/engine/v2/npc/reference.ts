// N1 (design/npc/NPC-LABS.md section 3): the reference frontier of a game: its timeline draw's own AI Futures Model run, as the game's G
// (effective compute, OOM) on the draw's clock. G_ref(t) = G(V0) + progress(t) - progress(2025.445), the translation of
// design/bal/FIXC-TRANSLATION.md section 2 (the one gSC of timelineDraws.ts is built on). Series: data/v2/timelineSeries.ts (generated).
// Nothing in the game reads this yet.
import type { GameStateV2 } from '../types';
import { timelineOf } from '../../../data/v2/timelineWorlds';
import { SERIES_ANCHOR, SERIES_FROM, SERIES_G0, SERIES_STEP, TIMELINE_PROGRESS, TIMELINE_SOFTWARE } from '../../../data/v2/timelineSeries';

type Tl = 'fast' | 'central' | 'slow';

/** The series of the game's drawn run, as [clock years, G values] on the grid, with the anchor point (2025.445, G(V0)) in front; undefined in a
 *  world without a draw (every world but tl-fast / tl-central / tl-slow, and a game built without a seed): its callers must handle that. */
interface Ref { g0: number; p: readonly number[]; sw: readonly number[]; rm: Float64Array }
const cache = new Map<string, Ref>();
function refOf(s: Pick<GameStateV2, 'setup' | 'hidden'>): Ref | undefined {
  const tl: Tl | undefined = timelineOf(s.setup.world);
  const run = s.hidden.timeline.aifmRun;
  if (!tl || !run) return undefined;
  const key = `${tl}:${run.index}`;
  let r = cache.get(key);
  if (!r) {
    const p = TIMELINE_PROGRESS[tl][run.index];
    const sw = TIMELINE_SOFTWARE[tl][run.index];
    if (!p || !sw) return undefined;
    const rm = new Float64Array(p.length + 1); // running maximum of progress, point 0 = the anchor (0)
    for (let i = 0; i < p.length; i++) rm[i + 1] = Math.max(rm[i], p[i]);
    r = { g0: SERIES_G0[tl], p, sw, rm };
    cache.set(key, r);
  }
  return r;
}

/** G of the reference frontier at clock year `clockYear` (decimal year): linear in time between the grid points (0.1 yr), G(V0) at and before 2025.445
 *  (the anchor), flat after the run's last grid point (its ASI date + 2 years, or 2060). undefined: the game's world has no draw. */
export function refG(s: Pick<GameStateV2, 'setup' | 'hidden'>, clockYear: number): number | undefined {
  const r = refOf(s);
  return r ? r.g0 + along(r.p, clockYear) : undefined;
}

/** S_ref: the reference SOFTWARE level of the game's drawn run at clock year `clockYear` (OOM, 0 at and before 2025.445): the run's progress minus its
 *  training compute (log10 cumulative training FLOP), both relative to 2025.445, i.e. S_ref = G_ref - G(V0) - log10(TC(t) / TC(2025.445)); so the capability path is
 *  the software path plus the compute path. Same clock handling as refG (pass refYear(s) to get the treaty-slowed reading), same linear interpolation between
 *  the 0.1 yr grid points, flat after the last point. Non-decreasing (the generated table is a running maximum). undefined: the game's world has no draw.
 *  Nothing in the game reads this yet. */
export function refS(s: Pick<GameStateV2, 'setup' | 'hidden'>, clockYear: number): number | undefined {
  const r = refOf(s);
  return r ? along(r.sw, clockYear) : undefined;
}

/** A series' value (relative to the anchor, 0 there) at : linear between the grid points, 0 at and before the anchor, flat after the last point. */
function along(p: readonly number[], clockYear: number): number {
  const n = p.length;
  if (clockYear <= SERIES_ANCHOR) return 0;
  if (clockYear >= SERIES_FROM + (n - 1) * SERIES_STEP) return p[n - 1];
  if (clockYear <= SERIES_FROM) return p[0] * (clockYear - SERIES_ANCHOR) / (SERIES_FROM - SERIES_ANCHOR);
  const x = (clockYear - SERIES_FROM) / SERIES_STEP, i = Math.floor(x), f = x - i;
  return p[i] + (p[i + 1] - p[i]) * f;
}

/** The inverse: the earliest clock year at which the reference frontier's G (its running maximum, in the runs where progress dips by up to
 *  0.8 OOM) reaches `G`. G(V0) or less: 2025.445 (the anchor). Above the run's last value: Infinity (never on this run). undefined: no draw. */
export function clockOfG(s: Pick<GameStateV2, 'setup' | 'hidden'>, G: number): number | undefined {
  const r = refOf(s);
  if (!r) return undefined;
  const target = G - r.g0, rm = r.rm, n = rm.length; // rm[k] at clock SERIES_FROM + (k - 1) * SERIES_STEP, rm[0] at the anchor
  if (target <= 0) return SERIES_ANCHOR;
  if (target > rm[n - 1]) return Infinity;
  let lo = 0, hi = n - 1; // first k with rm[k] >= target (rm is non-decreasing)
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rm[mid] >= target) hi = mid; else lo = mid; }
  const t = (k: number) => (k === 0 ? SERIES_ANCHOR : SERIES_FROM + (k - 1) * SERIES_STEP);
  const a = rm[lo], b = rm[hi];
  return b === a ? t(hi) : t(lo) + (t(hi) - t(lo)) * (target - a) / (b - a);
}
