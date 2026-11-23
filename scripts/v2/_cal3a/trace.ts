// CAL3-A probe: per-sector adoption state (F, K, R, A*, A, α, AGENCY G vs λ⁻¹(8)) on one RefBot classic run, every
// two months. Run alone: npx tsx scripts/v2/_cal3a/trace.ts [seed] [end] [sectors comma]
import { dayOfDate, decimalYear } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { firmAdoption, remoteWorkAutomation } from '../../../src/engine/v2/worldfx/readouts';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { gOfLevel } from '../../../src/engine/v2/models/capability';
import { wageOf } from '../../../src/engine/v2/worldfx/sectors';
import { ECON, SECTORS } from '../../../src/data/v2/sectors';

// MANSFIELD_A=0 switches the CAL3-A term off; BASSFIT overrides ECON.bassFit (probe only).
if (process.env.MANSFIELD_A !== undefined) ECON.mansfieldA = Number(process.env.MANSFIELD_A);
if (process.env.BASSFIT !== undefined) ECON.bassFit = Number(process.env.BASSFIT);
import type { SectorId } from '../../../src/engine/v2/types';

const seed = Number(process.argv[2] ?? 2027);
const end = process.argv[3] ?? '2028-07-01';
const secs = (process.argv[4] ?? 'SOFT,OFFICE,FIN').split(',') as SectorId[];
const s = newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const END = dayOfDate('2025-07-01', end);
let lastM = -1;
const annual: Record<number, number> = {};
const D1 = dayOfDate('2025-07-01', '2025-12-14');
const D2 = dayOfDate('2025-07-01', '2026-05-03');
let f1 = 0;
let f2 = 0;
const uH: number[] = [];
let rem25: string | undefined;
let u12: string | undefined;
const quiet = process.env.QUIET === '1';
while (s.time.day < END) {
  if (s.time.day === D1) f1 = firmAdoption(s);
  if (s.time.day === D2) f2 = firmAdoption(s);
  const d = s.time.day;
  uH[d] = s.world.unemployment.US;
  if (!rem25 && remoteWorkAutomation(s) >= 0.25) rem25 = decimalYear(s).toFixed(2);
  if (!u12 && d >= 365 && uH[d] - uH[d - 365] >= 1) u12 = decimalYear(s).toFixed(2);
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  const y = decimalYear(s);
  annual[Math.floor(y)] = (annual[Math.floor(y)] ?? 0) + s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0) / 365;
  const mIdx = Math.floor(y * 12);
  if (mIdx === lastM) continue;
  lastM = mIdx;
  if (mIdx % 2 !== 0) continue;
  const mix = worldMix(s);
  const g8 = gOfLevel(s.hidden.timeline, 8);
  const parts = secs.map((id) => {
    const st = s.world.sectors.US[id];
    const g = mix.sec.US[id].g;
    return `${id} F${st.F.toFixed(2)} K${st.K.toFixed(2)} R${st.R.toFixed(2)} A*${st.Astar.toFixed(3)} A${st.A.toFixed(3)} a${st.alpha.toFixed(2)} v/v0 ${((1 - mix.sec.US[id].pCost / wageOf(SECTORS.find((x) => x.id === id)!, 'US')) / (st.v0 ?? 1)).toFixed(3)} dAg${(g.AGENCY - g8).toFixed(2)}`;
  });
  if (!quiet) console.log(`${y.toFixed(2)} remote ${(100 * remoteWorkAutomation(s)).toFixed(1)}% firm ${(100 * firmAdoption(s)).toFixed(1)}% U ${s.world.unemployment.US.toFixed(2)} | ${parts.join(' | ')}`);
}
console.log(`seed ${seed} BTOS window ${(100 * f1).toFixed(1)} → ${(100 * f2).toFixed(1)}% (×${Math.pow(f2 / f1, 365 / (D2 - D1)).toFixed(2)}/yr) · remote 25% ${rem25 ?? 'never'} · U +1 pp/12 mo ${u12 ?? 'never'}`);
console.log(`revenue ${Object.entries(annual).map(([y, v]) => `${y} $${v.toFixed(1)}B`).join(' ')}`);
