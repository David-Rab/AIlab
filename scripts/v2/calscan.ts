// Multi-seed calibration scans (model v3 F4). Owner: WS1.
//
//   npx tsx scripts/v2/calscan.ts t1  <preset> [--gsc a,b,…] [--dbm a,b,…] [--sd a,b,…] [--workers N]
//   npx tsx scripts/v2/calscan.ts t1l <preset> [--gsc …] [--dbm …] [--sd …] [--workers N]
//
// T1 and T1L bind on the median over CAL_SEEDS (calseeds.ts), so the per-preset values (V3_CAL G_SC, Δ_bm, sd_SC in
// src/data/v2/workTypes.ts) are fitted here, on the same seeds: every grid point
// (the product of the lists; unset lists keep the committed value) is played on every seed — RefBot on the reference
// compute stub (t1) or the leader lab with a passive player (t1l), as calib.ts does — and the table prints, per point, the
// median's offset from the golden day per milestone (SC ±0.08 y, later ±0.12 y; lib.ts calTol; the timeline worlds have no golden days yet), p10 / p90, the seeds within tolerance,
// the worst |median|/tolerance (≤ 1 passes) and seed 2027 alone. Take a value in the middle of the passing window, not a
// knife edge. Runs go through the simulation cache in N worker processes (default 6).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { V3_CAL } from '../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import type { MilestoneIdx, WorldPresetId } from '../../src/engine/v2/types';
import { CAL_SEED, CAL_SEEDS, medianOf, quantOf } from './calseeds';
import { calGolden, calTol, refGame, runRef } from './lib';
import { cached } from './simcache';

const ME = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const [mode, preset] = argv as ['t1' | 't1l', WorldPresetId];
if (!['t1', 't1l'].includes(mode) || !['tl-fast', 'tl-central', 'tl-slow'].includes(preset)) {
  console.error('usage: calscan.ts t1|t1l <tl-fast|tl-central|tl-slow> [--gsc …] [--dbm …] [--sd …] [--workers N]');
  process.exit(2);
}
const list = (name: string, dflt: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1].split(',').map(Number) : [dflt];
};
const last = (preset === 'tl-slow' ? 3 : 6) as MilestoneIdx;
type Point = { gSC: number; dBM: number; sdSC: number };
const points: Point[] = [];
for (const gSC of list('gsc', V3_CAL[preset].gSC)) for (const dBM of list('dbm', V3_CAL[preset].dBM)) for (const sdSC of list('sd', V3_CAL[preset].sdSC)) points.push({ gSC, dBM, sdSC });

function play(p: Point, seed: number): Partial<Record<MilestoneIdx, number>> {
  return cached(`calscan-${mode}`, { preset, ...p, seed }, [ME], () => {
    Object.assign(V3_CAL[preset], { gSC: p.gSC, dBM: p.dBM, sdSC: p.sdSC });
    if (mode === 't1') {
      const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed }));
      runRef(s, 365 * 16, (x) => x.player.milestoneDays[last] !== undefined);
      return s.player.milestoneDays;
    }
    const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed, tutorial: false, leaderLab: true }));
    const L = s.rivals.find((r) => r.core.id === LEADER_ID);
    if (!L) throw new Error('no leader lab');
    while (s.time.day < 365 * 16 && L.core.milestoneDays[last] === undefined && L.core.status === 'active') tick(s, { skip: ['endings'] });
    return L.core.milestoneDays;
  });
}

const jobs = points.flatMap((p) => CAL_SEEDS.map((seed) => ({ p, seed })));
const si = argv.indexOf('--shard');
if (si >= 0) {
  const [k, n] = argv[si + 1].split('/').map(Number);
  jobs.forEach((j, i) => i % n === k && play(j.p, j.seed));
  process.exit(0);
}
const wi = argv.indexOf('--workers');
const workers = Math.max(1, Number(wi >= 0 ? argv[wi + 1] : 6));
const t0 = Date.now();
await Promise.all(Array.from({ length: workers }, (_, k) => new Promise<void>((done, fail) => {
  const child = spawn(process.execPath, ['--import', 'tsx', ME, ...argv.filter((_, i) => i !== wi && i !== wi + 1), '--shard', `${k}/${workers}`], { stdio: 'inherit' });
  child.on('close', (code) => (code === 0 ? done() : fail(new Error(`shard ${k} exit ${code}`))));
})));

const golden = calGolden().presets[preset].days; // CAL-T: slow SC is its sourced 2034–2035 range (lib.ts)
const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'];
const f = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3);
console.log(`calscan ${mode} ${preset}: ${points.length} point(s) × ${CAL_SEEDS.length} seeds (${CAL_SEEDS.join(', ')}), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const p of points) {
  const recs = CAL_SEEDS.map((seed) => ({ seed, md: play(p, seed) }));
  let worst = 0;
  const cells: string[] = [];
  for (let i = 3; i <= last; i++) {
    const want = golden[NAMES[i]];
    const tol = calTol(preset, i);
    const days = recs.map((r) => r.md[i as MilestoneIdx] ?? Infinity);
    const med = (medianOf(days) - want) / 365;
    worst = Math.max(worst, Math.abs(med) / tol);
    const one = ((recs.find((r) => r.seed === CAL_SEED)?.md[i as MilestoneIdx] ?? Infinity) - want) / 365;
    const inTol = days.filter((d) => Math.abs(d - want) / 365 <= tol).length;
    cells.push(`${NAMES[i]} ${f(med)} [${f((quantOf(days, 0.1) - want) / 365)}, ${f((quantOf(days, 0.9) - want) / 365)}] ${inTol}/${days.length} (seed ${CAL_SEED} ${f(one)})`);
  }
  const head = mode === 't1' ? `G_SC ${p.gSC} Δ_bm ${p.dBM} sd_SC ${p.sdSC}` : `leader lab (G_SC ${p.gSC} Δ_bm ${p.dBM} sd_SC ${p.sdSC})`;
  console.log(`${head}: worst ${worst.toFixed(2)} tol ${worst <= 1 ? 'PASS' : 'FAIL'}\n    ${cells.join('\n    ')}`);
}
