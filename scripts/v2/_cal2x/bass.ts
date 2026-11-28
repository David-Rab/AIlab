// CAL2-X probe: US firm adoption growth (BTOS window 14 Dec 2025 → 3 May 2026), use / saved, U, revenue on one RefBot
// classic run, with every sector's Bass p, q × scale (argv[3]) on top of ECON.bassFit (CAL2-X fit: scale 0.33 before bassFit).
// Run alone: npx tsx scripts/v2/_cal2x/bass.ts [seed] [scale] [end]
import { dayOfDate, decimalYear } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { firmAdoption, workUse } from '../../../src/engine/v2/worldfx/readouts';
import { SECTORS } from '../../../src/data/v2/sectors';

const seed = Number(process.argv[2] ?? 2027);
const k = Number(process.argv[3] ?? 1);
const end = process.argv[4] ?? '2028-01-01';
for (const d of SECTORS) {
  d.p *= k;
  d.q *= k;
}
const s = newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
const END = dayOfDate('2025-07-01', end);
const MARKS = ['2025-07-02', '2025-12-14', '2026-05-03', '2026-07-01', '2026-11-01', '2027-07-01'];
const marks = new Map(MARKS.map((m) => [dayOfDate('2025-07-01', m), m]));
const annual: Record<number, number> = {};
const out: Record<string, { fa: number; h: number; sv: number; U: number; hire: number; A: number[] }> = {};
const KS = [10, 15, 20, 25, 30];
const firmAt = (A: number[], k: number) => SECTORS.reduce((a, d, i) => a + (1 - Math.exp(-k * A[i])) * d.empPct, 0) / SECTORS.reduce((a, d) => a + d.empPct, 0);
while (s.time.day < END) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  const y = Math.floor(decimalYear(s));
  annual[y] = (annual[y] ?? 0) + s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0) / 365;
  const m = marks.get(s.time.day);
  if (m) {
    const u = workUse(s, 'US');
    out[m] = { fa: firmAdoption(s), h: u.hours, sv: u.saved, U: s.world.unemployment.US, hire: s.world.sectors.US.SOFT.hireRate, A: SECTORS.map((d) => s.world.sectors.US[d.id].A) };
  }
}
const g = (a: string, b: string, yrs: number) => (out[a] && out[b] ? Math.pow(out[b].fa / out[a].fa, 1 / yrs).toFixed(2) : '-');
console.log(`seed ${seed} scale ${k}`);
for (const [m, o] of Object.entries(out))
  console.log(`${m} firm ${(100 * o.fa).toFixed(1)}% hours ${(100 * o.h).toFixed(2)}% saved ${(100 * o.sv).toFixed(2)}% U ${o.U.toFixed(2)} SOFT hire ${o.hire.toFixed(2)}`);
const fA = (m: string, k: number) => (out[m] ? firmAt(out[m].A, k) : NaN);
const iS = SECTORS.findIndex((d) => d.id === 'SOFT');
const iF = SECTORS.findIndex((d) => d.id === 'FIN');
for (const k of KS)
  console.log(`  k ${k}: Dec14 ${(100 * fA('2025-12-14', k)).toFixed(1)}% May3 ${(100 * fA('2026-05-03', k)).toFixed(1)}% Jul ${(100 * fA('2026-07-01', k)).toFixed(1)}% growth ${Math.pow(fA('2026-05-03', k) / fA('2025-12-14', k), 365 / 140).toFixed(2)} SOFT ${(100 * (1 - Math.exp(-k * (out['2026-05-03']?.A[iS] ?? NaN)))).toFixed(1)}% FIN ${(100 * (1 - Math.exp(-k * (out['2026-05-03']?.A[iF] ?? NaN)))).toFixed(1)}%`);
console.log(`firm growth /yr: BTOS window ${g('2025-12-14', '2026-05-03', 140 / 365)}  Jul25-Jul26 ${g('2025-07-02', '2026-07-01', 1)}`);
console.log(`revenue 2026 $${(annual[2026] ?? 0).toFixed(1)}B 2027 $${(annual[2027] ?? 0).toFixed(1)}B`);
