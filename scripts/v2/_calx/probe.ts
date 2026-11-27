// CAL-X probe: world-effect quantities over time on one RefBot classic run (and the reality baseline to Nov 2026).
// Run alone: npx tsx scripts/v2/_calx/probe.ts [seed] [reality]
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { firmAdoption, workUse } from '../../../src/engine/v2/worldfx/readouts';
import { levelOfG } from '../../../src/engine/v2/models/capability';
import { preLlmCover } from '../../../src/engine/v2/worldfx/serving';
import { SECTORS } from '../../../src/data/v2/sectors';

const seed = Number(process.argv[2] ?? 2027);
const reality = process.argv[3] === 'reality';
const s = newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', baseline: reality ? 'reality' : 'classic', tutorial: false, econ: 'ai2027' }));
const END = dayOfDate('2025-07-01', reality ? '2026-11-02' : '2028-01-01');
const w = s.hidden.timeline;
const L = (g: number) => levelOfG(w, g).toFixed(2);
while (s.time.day < END) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  const d = s.time.day;
  if (d % 61 === 1 || d === END - 1) {
    const W = s.world;
    const m = worldMix(s);
    const so = W.sectors.US.SOFT;
    const msoft = m.sec.US.SOFT;
    const u = workUse(s, 'US');
    const pre = preLlmCover(w);
    const date = new Date(Date.parse('2025-07-01') + d * 864e5).toISOString().slice(0, 10);
    const A = SECTORS.map((x) => `${x.id}:${W.sectors.US[x.id].A.toFixed(2)}/${W.sectors.US[x.id].Astar.toFixed(2)}`).join(' ');
    console.log(`${date} d${d} SOFT F ${so.F.toFixed(3)} pre ${pre.SOFT.toFixed(3)} hire ${so.hireRate.toFixed(3)} A ${so.A.toFixed(3)} A* ${so.Astar.toFixed(3)} K ${so.K.toFixed(2)} R ${so.R.toFixed(2)} | AGENCY L ${L(msoft.g.AGENCY)} best ${L(m.bestPublic.AGENCY)} | firm ${(firmAdoption(s) * 100).toFixed(1)}% hours ${(u.hours * 100).toFixed(1)}% workers ${(u.workers * 100).toFixed(1)}% saved ${(u.saved * 100).toFixed(2)}% s/h ${u.savedPerHour.toFixed(3)} | U ${W.unemployment.US.toFixed(2)} pool ${(W.displacedPool.US / 1e6).toFixed(2)}M | friend ${(W.friendShare * 100).toFixed(1)}% socialL ${L(m.consumer.US.socialG)} reach ${W.fx.reach.US.toFixed(2)} | GOV acc ${W.control.GOV.accept.toFixed(3)}`);
    if (d % 183 === 1) console.log('   A/A*', A);
  }
}
