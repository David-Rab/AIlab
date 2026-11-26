// Stage 1 open-loop comparison (design/bal/STAGE1-DESIGN.md S1.2): a forced balrun run (--forced aifm) against the
// timeline checkpoints of balance/scenarios.ts (the AIFM runs split by SAR date: value = p50, lo/hi = p25/p75).
//
//   npx tsx scripts/v2/s1compare.ts <run>        -> balance/runs/<run>/s1compare.json + a table on stdout
//
// For each world preset x timeline (fast, central, slow), per checkpoint, score = (game median - target p50) / ((p75 - p25)/2):
//  - milestones (years): game SC is compared with AIFM AC + 0.5 y (design/bal/S1-SCOUT.md section 3: the game's SC is AI 2027's
//    SC, not AC); SAR, SIAR, ASI as they are; the SAR-SIAR and SIAR-ASI intervals. A game that never reaches one counts as
//    infinity. SC-SAR is skipped (its AIFM interval starts at AC) and so is TED-AI (no game counterpart).
//  - horizon (h80), as growth h80(t)/h80(2025.5), scored in log10 (spreads span orders of magnitude). The AIFM h80 at 2025.5 is
//    the sourced METR anchors (30 min at 2025.27, 66 at 2025.96) interpolated log-linearly = 39 min.
//  - research speed-up, as growth labSpeedRel(t)/labSpeedRel(2025.5) against the AIFM progress multiplier (1 at 2025.5), log10.
//  - effective compute, as OOM growth G(t) - G(2025.5) against EC(t) - 27.81 (the sourced G path, 28.0 at 2025.62 and 28.4 at
//    2025.87, extended back to 2025.5; about +-0.2 OOM), linear.
// A forced game stops one year after its ASI (botgame.ts POST_ASI_YEARS); a later checkpoint then takes the game's last sample
// (a lower bound, flagged '*' when it applies to over half of the games). A diverged sample (null) is infinity.
// Compute is prescribed (the AIFM path), so it is not scored; the game's compute growth is printed as an input check.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKPOINTS, type Checkpoint, type TimelineId } from '../../balance/scenarios';
import { START_DATE, decimalYearOf } from '../../src/engine/v2/core/time';

//   --map set=timeline,...  compare each override set (balrun --sets) with its own timeline only (base: every timeline); the
//                           table then has one column per set and the groups are world x set (Fix C step 1).
//   --sc-shift <years>      years added to the AIFM AC target for the game's SC (default 0.5, the AI 2027 reading); 0 = the
//                           Fix C reading "SC = AC" (FIXC-TRANSLATION section 3).
const argv = process.argv.slice(2);
const flag = (f: string) => { const i = argv.indexOf(f); return i < 0 ? undefined : argv[i + 1]; };
const run = argv[0];
if (!run || run.startsWith('--')) { console.error('usage: s1compare.ts <run> [--map set=timeline,...] [--sc-shift years]'); process.exit(2); }
const MAP: Record<string, string> | null = flag('--map') ? Object.fromEntries(flag('--map')!.split(',').map((x) => x.split('='))) : null;
const SC_SHIFT = flag('--sc-shift') !== undefined ? Number(flag('--sc-shift')) : 0.5;
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'balance', 'runs', run);
type Series = { year: number[]; G: (number | null)[]; h80: (number | null)[]; spd: (number | null)[]; comp: number[] };
interface Rec { harnessExceptions?: string[]; seed: number; world: string; overrideSet?: string; milestones: Record<string, number>; series?: Series }
const recs: Rec[] = readFileSync(join(dir, 'games.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const EXC = [...new Set(recs.flatMap((r) => r.harnessExceptions ?? []))];
if (EXC.length) console.log(`Harness exceptions in this run: ${EXC.join(', ')} (pending hiring market)`);

const TL: TimelineId[] = ['fast', 'central', 'slow'];
const H80_2025_5 = 30 * Math.pow(66 / 30, (2025.5 - 2025.27) / (2025.96 - 2025.27));
const EC_2025_5 = 28.0 - 1.6 * (2025.62 - 2025.5);
const dayYear = (d: number) => decimalYearOf(START_DATE, d);

const med = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return NaN;
  if (n % 2) return a[(n - 1) / 2];
  return a[n / 2 - 1] === a[n / 2] ? a[n / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
const lg = (x: number) => Math.log10(x);
const inf = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? Infinity : x);

/** Sample of a series at `year` for one game: the last sample before it once the game has ended (a lower bound). */
function at(r: Rec, key: 'G' | 'h80' | 'spd', year: number): { v: number; ended: boolean } | null {
  const S = r.series;
  if (!S || !S.year.length) return null;
  let i = S.year.indexOf(year);
  let ended = false;
  if (i < 0) {
    i = S.year.length - 1;
    ended = S.year[i] < year;
    if (!ended) return null;
  }
  return { v: inf(S[key][i]), ended };
}

interface Row { id: string; label: string; unit: string; game: number | null; target: number; lo: number | null; hi: number | null; score: number | null; carried: boolean }
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
const quantity = (c: Checkpoint): Quantity | null => {
  if (c.value === undefined) return null;
  if (c.quantity === 'milestone' && c.milestone) {
    const m = c.milestone;
    const shift = m === 'SC' ? SC_SHIFT : 0;
    return (rs) => ({ game: med(rs.map((r) => (r.milestones[m] === undefined ? Infinity : dayYear(r.milestones[m])))), ...band(c, (x) => x + shift) });
  }
  if (c.quantity === 'interval' && c.milestone && c.from && c.from !== 'SC') {
    const [a, b] = [c.from, c.milestone];
    return (rs) => ({ game: med(rs.map((r) => (r.milestones[a] === undefined || r.milestones[b] === undefined ? Infinity : dayYear(r.milestones[b]) - dayYear(r.milestones[a])))), ...band(c, (x) => x) });
  }
  if (c.date === undefined) return null;
  if (c.quantity === 'horizon80') return growth('h80', c.date);
  if (c.series === 'speedup') return growth('spd', c.date);
  if (c.series === 'effCompute') return growth('G', c.date);
  return null;
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;
// With --map, the groups are world|set (a set's games carry overrideSet) instead of the world alone.
const gkey = (r: Rec) => (MAP ? `${r.world}|${r.overrideSet ?? 'base'}` : r.world);
const presets = [...new Set(recs.map(gkey))];
const tlChecks = CHECKPOINTS.filter((c) => c.layer === 'timeline');
const out: Record<string, Record<string, { rows: Row[]; scored: number; within1: number; meanAbs: number | null }>> = {};
for (const p of presets) {
  const rs = recs.filter((r) => gkey(r) === p);
  out[p] = {};
  const only = MAP ? MAP[p.split('|')[1]] : undefined;
  for (const t of TL) {
    if (MAP && only && t !== only) { out[p][t] = { rows: [], scored: 0, within1: 0, meanAbs: null }; continue; }
    const rows: Row[] = [];
    for (const c of tlChecks.filter((x) => x.timeline === t)) {
      const q = quantity(c);
      const v = q?.(rs, c);
      if (!v) continue;
      const half = v.lo !== null && v.hi !== null ? (v.hi - v.lo) / 2 : 0;
      const score = half > 0 ? (v.game - v.target) / half : null;
      const unit = c.quantity === 'horizon80' || c.series === 'speedup' ? 'log10 growth' : c.series === 'effCompute' ? 'OOM growth' : c.unit;
      rows.push({
        id: c.id, label: c.label, unit, game: Number.isFinite(v.game) ? r3(v.game) : null, target: r3(v.target), lo: v.lo === null ? null : r3(v.lo), hi: v.hi === null ? null : r3(v.hi),
        score: score === null ? null : Number.isFinite(score) ? Math.round(score * 100) / 100 : score > 0 ? 999 : -999, carried: !!v.carried,
      });
    }
    const sc = rows.filter((r) => r.score !== null);
    out[p][t] = { rows, scored: sc.length, within1: sc.filter((r) => Math.abs(r.score!) <= 1).length, meanAbs: sc.length ? Math.round((sc.reduce((a, r) => a + Math.min(Math.abs(r.score!), 20), 0) / sc.length) * 100) / 100 : null };
  }
}

// Input check: the game's compute growth against 2025.5 (the prescribed path).
const comp: Record<string, Record<string, number | null>> = {};
for (const p of presets) {
  comp[p] = {};
  for (const y of [2027, 2030]) {
    const xs = recs.filter((r) => gkey(r) === p && r.series).map((r) => { const i = r.series!.year.indexOf(y); return i < 0 ? NaN : r.series!.comp[i] / r.series!.comp[0]; }).filter(Number.isFinite);
    comp[p][String(y)] = xs.length ? Math.round(med(xs) * 100) / 100 : null;
  }
}
const meta = { run, games: recs.length, gamesPerPreset: Object.fromEntries(presets.map((p) => [p, recs.filter((r) => gkey(r) === p).length])), scShift: SC_SHIFT, map: MAP, aifmH80At2025_5: Math.round(H80_2025_5 * 10) / 10, aifmEcAt2025_5: EC_2025_5, computeGrowthInGames: comp };
writeFileSync(join(dir, 's1compare.json'), JSON.stringify({ meta, presets: out }, null, 1));

// ── table ──
const cell = (r?: Row) => (!r ? '    .' : r.score === null ? '    -' : r.score >= 999 ? ' +inf' : r.score <= -999 ? ' -inf' : `${r.score.toFixed(1)}${r.carried ? '*' : ' '}`.padStart(5));
for (const p of presets) {
  console.log(`\n== ${p} (${meta.gamesPerPreset[p]} games) ==  score = (game - AIFM p50)/(half IQR)   columns: fast central slow`);
  const ids = [...new Set(TL.flatMap((t) => out[p][t].rows.map((r) => r.id.replace(/^(fast|central|slow)\./, ''))))];
  for (const id of ids) {
    const cells = TL.map((t) => out[p][t].rows.find((r) => r.id === `${t}.${id}`));
    const g = cells.find(Boolean);
    console.log(`${id.padEnd(22)} ${cells.map(cell).join(' ')}   game ${g?.game ?? 'inf'} ${g?.unit ?? ''}`);
  }
  console.log(`${'within +-1 / scored'.padEnd(22)} ${TL.map((t) => `${out[p][t].within1}/${out[p][t].scored}`.padStart(5)).join(' ')}`);
  console.log(`${'mean |score| (cap 20)'.padEnd(22)} ${TL.map((t) => String(out[p][t].meanAbs).padStart(5)).join(' ')}`);
}
console.log(`\ncompute growth in the games vs 2025.5 (median): ${JSON.stringify(comp)}`);
