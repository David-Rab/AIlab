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
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKPOINTS } from '../../balance/scenarios';
import { H80_2025_5, EC_2025_5, TL, med, readRecs, scoreHistory, scoreTimeline, type Row, type Rec, type TlScore } from './calibscore';

// The scoring itself (quantities, growth, interpolation of the history anchors) lives in calibscore.ts, shared with the balance
// dashboard (scripts/v2/baldash.ts, Scenarios tab, "Calibration run"), so both print the same scores.
//   --map set=timeline,...  compare each override set (balrun --sets) with its own timeline only (base: every timeline); the
//                           table then has one column per set and the groups are world x set (Fix C step 1).
//   --sc-shift <years>      years added to the AIFM AC target for the game's SC (default 0 = the chosen 'SC = AC' convention; 0.5 = the AI 2027 reading); 0 = the
//                           Fix C reading "SC = AC" (FIXC-TRANSLATION section 3).
const argv = process.argv.slice(2);
const flag = (f: string) => { const i = argv.indexOf(f); return i < 0 ? undefined : argv[i + 1]; };
const run = argv[0];
if (!run || run.startsWith('--')) { console.error('usage: s1compare.ts <run> [--map set=timeline,...] [--sc-shift years]'); process.exit(2); }
const MAP: Record<string, string> | null = flag('--map') ? Object.fromEntries(flag('--map')!.split(',').map((x) => x.split('='))) : null;
const SC_SHIFT = flag('--sc-shift') !== undefined ? Number(flag('--sc-shift')) : 0;
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'balance', 'runs', run);
const recs: Rec[] = readRecs(join(dir, 'games.jsonl'));

const EXC = [...new Set(recs.flatMap((r) => r.harnessExceptions ?? []))];
if (EXC.length) console.log(`Harness exceptions in this run: ${EXC.join(', ')} (pending hiring market)`);

// With --map, the groups are world|set (a set's games carry overrideSet) instead of the world alone.
const gkey = (r: Rec) => (MAP ? `${r.world}|${r.overrideSet ?? 'base'}` : r.world);
const presets = [...new Set(recs.map(gkey))];
const out: Record<string, Record<string, TlScore>> = {};
const hist: Record<string, Row[]> = {};
for (const p of presets) {
  const rs = recs.filter((r) => gkey(r) === p);
  out[p] = {};
  const only = MAP ? MAP[p.split('|')[1]] : undefined;
  for (const t of TL) out[p][t] = MAP && only && t !== only ? { rows: [], scored: 0, within1: 0, meanAbs: null } : scoreTimeline(rs, CHECKPOINTS, t, SC_SHIFT);
  hist[p] = scoreHistory(rs, CHECKPOINTS);
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
writeFileSync(join(dir, 's1compare.json'), JSON.stringify({ meta, presets: out, history: hist }, null, 1));

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
  for (const h of hist[p]) console.log(`history ${h.id.padEnd(22)} ${cell(h)}   game ${h.game ?? 'inf'} vs ${h.target} ${h.unit}`);
}
console.log(`\ncompute growth in the games vs 2025.5 (median): ${JSON.stringify(comp)}`);
