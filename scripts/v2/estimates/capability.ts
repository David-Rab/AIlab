// Back-of-envelope estimates: capability (see scripts/v2/estimates.ts; design/estimates/MAP-A.md, MAP-B.md).
// The reference frontier (refGAt: each timeline draw's own AI Futures Model run, translated) read on the draws, never stepped:
// its G path against the research/12 anchors, its METR horizon doubling, its milestone knots against the AIFM dates.
// One newGame builds the world; each draw is that world with the draw's own settings (v3 and aifmRun) swapped in.
import { CHECKPOINTS } from '../../../balance/scenarios';
import { TIMELINE_DRAWS, type TimelineId } from '../../../src/data/v2/timelineDraws';
import { drawAt, drawCount } from '../../../src/data/v2/timelineWorlds';
import { REF_TPP } from '../../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { START_DATE, decimalYearOf } from '../../../src/engine/v2/core/time';
import { h50Ratio, levelKnotsG } from '../../../src/engine/v2/models/capability';
import { fOver } from '../../../src/engine/v2/models/effective';
import { clockOfG } from '../../../src/engine/v2/npc/reference';
import { refGAt } from '../../../src/engine/v2/npc/lab';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { estOf, type Estimate } from './types';

export const area = 'capability';

const TLS: TimelineId[] = ['central', 'fast', 'slow'];
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const pct = (xs: number[], q: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];

/** The state of draw `i` of timeline `tl`: the one built game with that draw's settings in its world (what `timelineFor` does). */
function drawState(base: GameStateV2, tl: TimelineId, i: number): Pick<GameStateV2, 'setup' | 'hidden'> {
  const d = drawAt(tl, i);
  const w = { ...base.hidden.timeline, v3: { ...base.hidden.timeline.v3, ...d.v3 }, aifmRun: { index: d.index, id: d.id } };
  return { setup: { ...base.setup, world: `tl-${tl}` as typeof base.setup.world }, hidden: { ...base.hidden, timeline: w } };
}

/** Least-squares line through (x, y): slope and the fitted value at x0. */
function lsq(xs: number[], ys: number[]): { slope: number; at: (x: number) => number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let k = 0; k < n; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; }
  const slope = sxy / sxx;
  return { slope, at: (x) => my + slope * (x - mx) };
}

export function estimates(): Estimate[] {
  const out: Estimate[] = [];
  const base = newGame(defaultSetupV2({ seed: 1, world: 'tl-central', alignment: 'medium', tutorial: false }));
  const y0 = decimalYearOf(START_DATE, 0);
  // The five research/12 §0.2 anchors, as the balance scenarios hold them (H5.gpath.*), moved by the overtraining factor the
  // reference recipe's tokens per parameter changes (fOver, as the report does).
  const overDG = Math.log10(fOver(REF_TPP) / fOver(50));
  const anchors = CHECKPOINTS.filter((c) => c.id.startsWith('H5.gpath.') && c.value !== undefined && c.date !== undefined && c.id !== 'H5.gpath.slope')
    .map((c) => ({ id: c.id, year: c.date as number, g: (c.value as number) + overDG }));
  // The anchors' dates are the mid-month ones (15 Aug, 15 Nov, 15 Feb, 15 Apr, 15 Oct); the line is fitted on the game window.
  const FROM = 2025.58;
  const TO = 2026.92;
  const grid: number[] = [];
  for (let y = FROM; y <= TO + 1e-9; y += 1 / 365) grid.push(y);

  for (const tl of TLS) {
    const n = drawCount(tl);
    const slopes: number[] = [];
    const worst: number[] = [];
    const months: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = drawState(base, tl, i);
      const fit = lsq(grid, grid.map((y) => refGAt(s, y)));
      slopes.push(fit.slope);
      worst.push(Math.max(...anchors.map((a) => Math.abs(fit.at(a.year) - a.g))));
      // METR h50: the horizon ratio between 2025.5 (the start) and 2027.0 for the reference G (AGENCY taken as moving with G).
      const ratio = h50Ratio(s.hidden.timeline, refGAt(s, 2027), refGAt(s, y0));
      months.push(((2027 - y0) * 12) * Math.LN2 / Math.log(ratio));
    }
    const spread = (xs: number[], f: (x: number) => string) => `median ${f(median(xs))}, p10-p90 ${f(pct(xs, 0.1))} to ${f(pct(xs, 0.9))} over ${n} draws`;
    out.push(estOf('GPATH.ai2027.2026', `${spread(slopes, (x) => x.toFixed(2))} G/yr`, median(slopes), 'refGAt(draw, y) daily 2025.58-2026.92 → least-squares slope', `tl-${tl}`));
    out.push(estOf('GPATH.anchorDeviation', `worst anchor miss: ${spread(worst, (x) => x.toFixed(2))} G`, median(worst), 'refGAt(draw, y) → least-squares line → vs H5.gpath anchors + fOver shift', `tl-${tl}`));
    if (tl === 'central') {
      out.push(estOf('METR.h50.doubling', `${spread(months, (x) => x.toFixed(1))} months`, median(months), 'refGAt(draw, 2027.0), refGAt(draw, start) → h50Ratio(w, g1, g0) → months = Δt·ln2/ln(ratio)', 'tl-central'));
    }
  }

  // T1: the reference frontier's milestone knots against the AIFM run's own dates (AC = the game's SC by construction; SAR and ASI are the check).
  const TOL: Record<string, number> = { SC: 0.08, SAR: 0.12, ASI: 0.12 };
  const KNOT: Record<string, number> = { SC: 1, SAR: 2, ASI: 4 };
  const DATE: Record<string, number> = { SC: 0, SAR: 1, ASI: 2 };
  for (const tl of TLS) {
    const draws = TIMELINE_DRAWS[tl];
    for (const m of ['SC', 'SAR', 'ASI']) {
      const diffs: number[] = [];
      for (let i = 0; i < drawCount(tl); i++) {
        const want = draws.dates[i][DATE[m]];
        if (want === null || want === undefined) continue;
        const s = drawState(base, tl, i);
        const got = clockOfG(s, levelKnotsG(s.hidden.timeline)[KNOT[m]]);
        if (got !== undefined) diffs.push(got - want);
      }
      const med = median(diffs);
      out.push(estOf('T1.golden.milestones', `reference-frontier date minus AIFM date: median ${med >= 0 ? '+' : ''}${med.toFixed(2)} y (p10 ${pct(diffs, 0.1).toFixed(2)}, p90 ${pct(diffs, 0.9).toFixed(2)}; ${diffs.length} draws) against ±${TOL[m]} y`,
        Math.abs(med) <= TOL[m], 'levelKnotsG(w) → clockOfG(draw, knot) vs TIMELINE_DRAWS dates', `tl-${tl} ${m}`));
    }
  }
  return out;
}
