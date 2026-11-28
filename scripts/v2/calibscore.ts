// Shared calibration scoring: a forced balrun run (--forced aifm) against the timeline checkpoints of balance/scenarios.ts.
// Used by scripts/v2/s1compare.ts (the CLI table) and scripts/v2/baldash.ts (the Scenarios tab's "Calibration run" readout),
// so both print the same numbers. Method and conventions are documented at the top of s1compare.ts.
//
// score = (game median - target p50) / ((p75 - p25) / 2): the distance from the model's median in half-IQR units.
//
// Two alignments (R3.2): BY DATE (a checkpoint at a calendar date) and BY PHASE (a checkpoint at AC + tau in the model, read against the game
// at its own SC + tau, so a game whose SC comes earlier or later than the model's AC is still compared in the same phase of takeoff).
// Speed-up is scored with the game's matched speed-up spdM (scripts/v2/matched.ts: AI's contribution at the AIFM's frozen present-day
// resources, the quantity the model's progress multiplier measures), never with spd (labSpeedRel: the player's own research speed, which
// also carries compute and staff growth). spd stays as an unscored readout row.
import { readFileSync } from 'node:fs';
import type { Checkpoint, TimelineId } from '../../balance/scenarios';
import { START_DATE, decimalYearOf } from '../../src/engine/v2/core/time';

export const TL: TimelineId[] = ['fast', 'central', 'slow'];
export const MILESTONES = ['SC', 'SAR', 'SIAR', 'ASI'] as const;
/** The AIFM h80 at 2025.5: the sourced METR anchors (30 min at 2025.27, 66 at 2025.96) interpolated log-linearly = 39 min. */
export const H80_2025_5 = 30 * Math.pow(66 / 30, (2025.5 - 2025.27) / (2025.96 - 2025.27));
/** The AIFM effective compute at 2025.5: the sourced G path (28.0 at 2025.62), extended back at 1.6 per year. */
export const EC_2025_5 = 28.0 - 1.6 * (2025.62 - 2025.5);
/** History checkpoints that carry no source band are scored against the game's own tolerance (targets.ts:109 and the H5 notes). */
const HIST_TOL = { h: Math.log10(1.15), G: 0.2 };

export type Series = { year: number[]; G: (number | null)[]; h50?: (number | null)[]; h80: (number | null)[]; spd: (number | null)[]; spdM?: (number | null)[]; comp: number[] };
export interface Rec { harnessExceptions?: string[]; seed: number; world: string; overrideSet?: string; forced?: string; milestones: Record<string, number>; series?: Series }

export const readRecs = (path: string): Rec[] => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

/** "tl-fast=fast,tl-central=central" -> {set: timeline}. */
export const parseMap = (s: string): Record<string, string> => Object.fromEntries(s.split(',').filter(Boolean).map((x) => x.split('=')));
/** The default convention: an override set named tl-<timeline> belongs to that timeline; anything else (base) is unmapped. */
export const defaultMap = (sets: string[]): Record<string, string> => Object.fromEntries(sets.filter((s) => /^tl-(fast|central|slow)$/.test(s)).map((s) => [s, s.slice(3)]));
/** R3.1: the group a game is scored in: its override set, else its world when that is a per-game draw world (tl-fast / tl-central / tl-slow: the same name, so defaultMap maps it to that timeline), else base. */
export const setOf = (r: { overrideSet?: string; world: string }): string => r.overrideSet ?? (/^tl-(fast|central|slow)$/.test(r.world) ? r.world : 'base');

const dayYear = (d: number) => decimalYearOf(START_DATE, d);
export const med = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  if (n % 2) return a[(n - 1) / 2];
  return a[n / 2 - 1] === a[n / 2] ? a[n / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
/** Quantile p (0..1) of a sample that may hold Infinity (a milestone never reached): linear between order statistics. */
export const quant = (xs: number[], p: number) => {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return NaN;
  const i = p * (a.length - 1), lo = Math.floor(i), hi = Math.ceil(i), f = i - lo;
  if (f === 0 || a[lo] === a[hi]) return a[lo];
  return Number.isFinite(a[hi]) ? a[lo] + (a[hi] - a[lo]) * f : Infinity;
};
const lg = (x: number) => Math.log10(x);
const inf = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? Infinity : x);

/** Sample of a series at `year` for one game: the last sample before it once the game has ended (a lower bound). */
function at(r: Rec, key: 'G' | 'h50' | 'h80' | 'spd' | 'spdM', year: number): { v: number; ended: boolean } | null {
  const S = r.series;
  const col = S?.[key];
  if (!S || !col || !S.year.length) return null;
  let i = S.year.indexOf(year);
  let ended = false;
  if (i < 0) {
    i = S.year.length - 1;
    ended = S.year[i] < year;
    if (!ended) return null;
  }
  return { v: inf(col[i]), ended };
}
/** Value at a date between two yearly samples (log-linear for horizons, linear for G); null outside the sampled span. */
function interp(r: Rec, key: 'G' | 'h50' | 'h80', date: number): number | null {
  const S = r.series;
  const col = S?.[key];
  if (!S || !col || S.year.length < 2 || date < S.year[0] || date > S.year[S.year.length - 1]) return null;
  let i = 0;
  while (i < S.year.length - 2 && S.year[i + 1] < date) i++;
  const [y0, y1] = [S.year[i], S.year[i + 1]], [a, b] = [inf(col[i]), inf(col[i + 1])];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  const f = (date - y0) / (y1 - y0);
  return key === 'G' ? a + (b - a) * f : Math.pow(10, lg(a) + (lg(b) - lg(a)) * f);
}

export interface Row { id: string; label: string; unit: string; game: number | null; target: number; lo: number | null; hi: number | null; score: number | null; carried: boolean; /** an unscored readout, not comparable with the target */ readout?: boolean; /** by-phase rows: games that contribute / games in the group */ n?: number; of?: number }
interface Val { game: number; target: number; lo: number | null; hi: number | null; carried?: boolean }
type Quantity = (rs: Rec[], c: Checkpoint) => Val | null;

const band = (c: Checkpoint, f: (x: number) => number) => ({ target: f(c.value!), lo: c.lo !== undefined ? f(c.lo) : null, hi: c.hi !== undefined ? f(c.hi) : null });
const growth = (key: 'G' | 'h80' | 'spd', y: number): Quantity => (rs, c) => {
  const xs: number[] = [];
  let carried = 0;
  for (const r of rs) {
    const a = at(r, key, y);
    const a0 = at(r, key, 2025.5);
    if (!a || !a0) continue;
    if (a.ended) carried++;
    xs.push(key === 'G' ? a.v - a0.v : lg(a.v / a0.v));
  }
  if (!xs.length) return null;
  const f = key === 'G' ? (x: number) => x - EC_2025_5 : key === 'h80' ? (x: number) => lg(x / H80_2025_5) : (x: number) => lg(x);
  return { game: med(xs), carried: carried > xs.length / 2, ...band(c, f) };
};
/** A level (not a growth since 2025.5): the series itself at a whole-year date, as log10. The speed-up multiplier is 1 = no help from AI, so it is compared as it is. */
const level = (key: 'spdM', y: number): Quantity => (rs, c) => {
  const xs: number[] = [];
  let carried = 0;
  for (const r of rs) {
    const a = at(r, key, y);
    if (!a) continue;
    if (a.ended) carried++;
    xs.push(lg(a.v));
  }
  return xs.length ? { game: med(xs), carried: carried > xs.length / 2, ...band(c, lg) } : null;
};
const quantity = (c: Checkpoint, scShift: number): Quantity | null => {
  if (c.value === undefined) return null;
  if (c.quantity === 'milestone' && c.milestone) {
    const m = c.milestone;
    const shift = m === 'SC' ? scShift : 0;
    return (rs) => ({ game: med(rs.map((r) => (r.milestones[m] === undefined ? Infinity : dayYear(r.milestones[m])))), ...band(c, (x) => x + shift) });
  }
  if (c.quantity === 'interval' && c.milestone && c.from && c.from !== 'SC') {
    const [a, b] = [c.from, c.milestone];
    return (rs) => ({ game: med(rs.map((r) => (r.milestones[a] === undefined || r.milestones[b] === undefined ? Infinity : dayYear(r.milestones[b]) - dayYear(r.milestones[a])))), ...band(c, (x) => x) });
  }
  if (c.date === undefined) return null; // a by-phase checkpoint (c.phase) is scored by scorePhase
  if (c.quantity === 'horizon80') return growth('h80', c.date);
  if (c.series === 'speedup') return level('spdM', c.date);
  if (c.series === 'effCompute') return growth('G', c.date);
  return null;
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const roundScore = (s: number | null) => (s === null ? null : Number.isFinite(s) ? Math.round(s * 100) / 100 : s > 0 ? 999 : -999);
const gameOut = (g: number) => (Number.isFinite(g) ? r3(g) : null);

export interface TlScore { rows: Row[]; scored: number; within1: number; meanAbs: number | null }
const summarise = (rows: Row[]): TlScore => {
  const sc = rows.filter((r) => r.score !== null);
  return { rows, scored: sc.length, within1: sc.filter((r) => Math.abs(r.score!) <= 1).length, meanAbs: sc.length ? Math.round((sc.reduce((a, r) => a + Math.min(Math.abs(r.score!), 20), 0) / sc.length) * 100) / 100 : null };
};

/** One timeline's checkpoints scored against a group of games. */
export function scoreTimeline(rs: Rec[], cps: Checkpoint[], t: TimelineId, scShift: number): TlScore {
  const rows: Row[] = [];
  for (const c of cps.filter((x) => x.layer === 'timeline' && x.timeline === t)) {
    const v = quantity(c, scShift)?.(rs, c);
    const unit = c.series === 'speedup' ? 'log10 multiplier' : c.quantity === 'horizon80' ? 'log10 growth' : c.series === 'effCompute' ? 'OOM growth' : c.unit;
    if (v) {
      const half = v.lo !== null && v.hi !== null ? (v.hi - v.lo) / 2 : 0;
      const score = half > 0 ? (v.game - v.target) / half : null;
      rows.push({ id: c.id, label: c.label, unit, game: gameOut(v.game), target: r3(v.target), lo: v.lo === null ? null : r3(v.lo), hi: v.hi === null ? null : r3(v.hi), score: roundScore(score), carried: !!v.carried });
    }
    // the game's own research speed (labSpeedRel growth) beside the matched speed-up: shown, never scored (a different quantity)
    if (c.series === 'speedup' && c.date !== undefined) {
      const o = growth('spd', c.date)(rs, c);
      if (o) rows.push({ id: `${c.id}.spd`, label: `${c.label} (readout: labSpeedRel, not comparable)`, unit: 'log10 growth', game: gameOut(o.game), target: r3(o.target), lo: o.lo === null ? null : r3(o.lo), hi: o.hi === null ? null : r3(o.hi), score: null, carried: !!o.carried, readout: true });
    }
  }
  return summarise(rows);
}

// ───────────── by phase: a checkpoint at the model's AC + tau against the game at its own SC + tau (R3.2) ─────────────
/** One game's series at a date, between the (now quarterly) samples: log-linear for the multiplier and the horizon, linear for G; null before the
 *  first sample; past the last sample the last value (a forced game ends on its ASI day, so it is a lower bound: carried). */
function atDate(r: Rec, key: 'G' | 'h80' | 'spdM', date: number): { v: number; carried: boolean } | null {
  const S = r.series, col = S?.[key];
  if (!S || !col || !S.year.length || date < S.year[0] - 1e-9) return null;
  const n = S.year.length;
  if (n === 1) return { v: inf(col[0]), carried: false };
  if (date > S.year[n - 1] + 1e-9) return { v: inf(col[n - 1]), carried: true };
  let i = 0;
  while (i < n - 2 && S.year[i + 1] < date) i++;
  const [y0, y1] = [S.year[i], S.year[i + 1]], [a, b] = [inf(col[i]), inf(col[i + 1])];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { v: Infinity, carried: false };
  const f = (date - y0) / (y1 - y0);
  return { v: key === 'G' ? a + (b - a) * f : Math.pow(10, lg(a) + (lg(b) - lg(a)) * f), carried: false };
}
/** The by-phase checkpoints of one timeline scored against a group of games: each game read at its own SC + phase (a game with no SC is left out
 *  and counted in n/of); speed-up as log10 of spdM, horizon as log10 growth since 2025.5, effective compute as OOM growth since 2025.5, plus the SC-to-SAR gap. */
export function scorePhase(rs: Rec[], cps: Checkpoint[], t: TimelineId): TlScore {
  const rows: Row[] = [];
  const withSC = rs.filter((r) => r.milestones.SC !== undefined);
  for (const c of cps.filter((x) => x.layer === 'timeline' && x.timeline === t && x.value !== undefined)) {
    let game: number | undefined, f: ((x: number) => number) | undefined, carried = false, used = withSC.length;
    if (c.quantity === 'interval' && c.from === 'SC' && c.milestone) {
      const to = c.milestone;
      game = med(rs.map((r) => (r.milestones.SC === undefined || r.milestones[to] === undefined ? Infinity : dayYear(r.milestones[to]) - dayYear(r.milestones.SC))));
      f = (x) => x; used = rs.length;
    } else if (c.phase !== undefined) {
      const key = c.series === 'speedup' ? 'spdM' : c.series === 'effCompute' ? 'G' : c.quantity === 'horizon80' ? 'h80' : undefined;
      if (!key) continue;
      const xs: number[] = [];
      let nCarried = 0;
      for (const r of withSC) {
        const a = atDate(r, key, dayYear(r.milestones.SC) + c.phase), a0 = key === 'spdM' ? null : atDate(r, key, 2025.5);
        if (!a || (key !== 'spdM' && !a0)) continue;
        if (a.carried) nCarried++;
        xs.push(key === 'spdM' ? lg(a.v) : key === 'G' ? a.v - a0!.v : lg(a.v / a0!.v));
      }
      if (!xs.length) continue;
      game = med(xs); used = xs.length; carried = nCarried > xs.length / 2;
      f = key === 'spdM' ? lg : key === 'G' ? (x) => x - EC_2025_5 : (x) => lg(x / H80_2025_5);
    } else continue;
    const b = band(c, f!);
    const half = b.lo !== null && b.hi !== null ? (b.hi - b.lo) / 2 : 0;
    const score = half > 0 ? (game! - b.target) / half : null;
    const unit = c.quantity === 'interval' ? c.unit : c.series === 'speedup' ? 'log10 multiplier' : c.series === 'effCompute' ? 'OOM growth' : 'log10 growth';
    rows.push({ id: c.id, label: c.label, unit, game: gameOut(game!), target: r3(b.target), lo: b.lo === null ? null : r3(b.lo), hi: b.hi === null ? null : r3(b.hi), score: roundScore(score), carried, n: used, of: rs.length });
  }
  return summarise(rows);
}

/**
 * The shared-history checkpoints (METR horizons, frontier effective-compute path) scored against the game's own path, which is
 * sampled once a year, so a date between two samples is interpolated. Horizons are compared as minutes (scored in log10, so
 * game/target are shown in minutes), G as growth since 2025.5 against the AIFM path. The half-width is the source band when
 * there is one (half its range, a confidence interval, not an IQR), else the game's own tolerance (+-15% on a horizon, +-0.2 OOM).
 */
export function scoreHistory(rs: Rec[], cps: Checkpoint[]): Row[] {
  const rows: Row[] = [];
  for (const c of cps.filter((x) => x.layer === 'history' && x.value !== undefined && x.date !== undefined && x.date >= 2025.5)) {
    const isH = c.quantity === 'horizon50' || c.quantity === 'horizon80';
    const isG = c.unit === 'G' && c.id.startsWith('H5.gpath.') && !c.id.endsWith('.slope');
    if (!isH && !isG) continue;
    const key = isG ? 'G' : c.quantity === 'horizon50' ? 'h50' : 'h80';
    const xs: number[] = [];
    for (const r of rs) {
      const v = interp(r, key, c.date!);
      if (v === null) continue;
      if (isG) { const g0 = interp(r, 'G', 2025.5); if (g0 !== null) xs.push(v - g0); } else xs.push(v);
    }
    if (!xs.length) continue;
    const game = med(xs);
    const target = isG ? c.value! - EC_2025_5 : c.value!;
    const f = isG ? (x: number) => x : lg;
    const lo = c.lo !== undefined ? (isG ? c.lo - EC_2025_5 : c.lo) : null, hi = c.hi !== undefined ? (isG ? c.hi - EC_2025_5 : c.hi) : null;
    const half = lo !== null && hi !== null ? (f(hi) - f(lo)) / 2 : isG ? HIST_TOL.G : HIST_TOL.h;
    const score = (f(game) - f(target)) / half;
    rows.push({ id: c.id, label: c.label, unit: isG ? 'OOM growth since 2025.5' : 'min', game: gameOut(game), target: r3(target), lo: lo === null ? null : r3(lo), hi: hi === null ? null : r3(hi), score: roundScore(score), carried: false });
  }
  return rows;
}

// ───────────── what the dashboard draws: milestone spread and median paths ─────────────
export interface MsStat { med: number | null; p10: number | null; p90: number | null; raw: number | null; reached: number; n: number }
/** Per milestone: median and p10/p90 across the games, as years on the model's axis (SC minus scShift, so it lines up with the AIFM AC); null = never. */
export function milestoneStats(rs: Rec[], scShift: number): Record<string, MsStat> {
  const out: Record<string, MsStat> = {};
  for (const m of MILESTONES) {
    const shift = m === 'SC' ? scShift : 0;
    const ys = rs.map((r) => (r.milestones[m] === undefined ? Infinity : dayYear(r.milestones[m])));
    const fin = (x: number) => (Number.isFinite(x) ? r3(x - shift) : null);
    out[m] = { med: fin(med(ys)), p10: fin(quant(ys, 0.1)), p90: fin(quant(ys, 0.9)), raw: Number.isFinite(med(ys)) ? r3(med(ys)) : null, reached: ys.filter(Number.isFinite).length, n: ys.length };
  }
  return out;
}
export type Pt = [number, number | null]; // [year, value]; null = the median has diverged
export interface Paths { h50: Pt[]; h80: Pt[]; spd: Pt[]; /** matched speed-up: the multiple itself (1 = no help from AI) */ spdM?: Pt[]; ec: Pt[] }
/**
 * The median game path per year: horizons in minutes; speed-up and effective compute as growth relative to 2025.5 (speed-up is
 * the multiple, effective compute as 10^EC on the AIFM scale: EC_2025_5 + (G - G(2025.5))). A year is drawn when at least half the
 * games reach it (a forced game ends on its ASI day).
 */
export function medianPaths(rs: Rec[]): Paths {
  const years = [...new Set(rs.flatMap((r) => r.series?.year ?? []))].sort((a, b) => a - b);
  const out = { h50: [], h80: [], spd: [], spdM: [], ec: [] } as Required<Paths>;
  const spec: [keyof Paths, 'h50' | 'h80' | 'spd' | 'spdM' | 'G'][] = [['h50', 'h50'], ['h80', 'h80'], ['spd', 'spd'], ['spdM', 'spdM'], ['ec', 'G']];
  for (const [name, key] of spec) {
    for (const y of years) {
      const xs: number[] = [];
      for (const r of rs) {
        const S = r.series, col = S?.[key];
        if (!S || !col) continue;
        const i = S.year.indexOf(y);
        if (i < 0) continue;
        const v = inf(col[i]);
        if (name === 'spd' || name === 'ec') {
          const v0 = inf(col[0]);
          xs.push(name === 'spd' ? v / v0 : v - v0 + EC_2025_5);
        } else xs.push(v);
      }
      if (xs.length * 2 < rs.length) continue;
      const m = med(xs);
      out[name].push([y, Number.isFinite(m) ? Math.round(m * 1000) / 1000 : null]);
    }
  }
  return out;
}

// ───────────── a whole run, for the dashboard ─────────────
export interface ColCalib extends TlScore { history: Row[]; ms: Record<string, MsStat>; paths: Paths; n: number; /** by-phase scoring (scorePhase), next to the by-date rows */ phase: TlScore }
export interface GroupCalib { set: string; timeline: TimelineId | null; n: number; worlds: string[]; byTl: Partial<Record<TimelineId, ColCalib>> }
export interface RunCalib { run: string; games: number; exceptions: string[]; groups: GroupCalib[] }

/** Score one run: a group per override set; a set mapped to a timeline is scored against that timeline only, an unmapped one against all three. */
export function calibrateRun(run: string, recs: Rec[], cps: Checkpoint[], scShift: number, map?: Record<string, string> | null): RunCalib {
  const sets = [...new Set(recs.map(setOf))];
  const m = map ?? defaultMap(sets);
  const groups: GroupCalib[] = sets.map((set) => {
    const rs = recs.filter((r) => setOf(r) === set);
    const mapped = (TL as string[]).includes(m[set]) ? (m[set] as TimelineId) : null;
    const ms = milestoneStats(rs, scShift), paths = medianPaths(rs), history = scoreHistory(rs, cps);
    const byTl: GroupCalib['byTl'] = {};
    for (const t of mapped ? [mapped] : TL) byTl[t] = { ...scoreTimeline(rs, cps, t, scShift), history, ms, paths, n: rs.length, phase: scorePhase(rs, cps, t) };
    return { set, timeline: mapped, n: rs.length, worlds: [...new Set(rs.map((r) => r.world))], byTl };
  });
  return { run, games: recs.length, exceptions: [...new Set(recs.flatMap((r) => r.harnessExceptions ?? []))], groups };
}
