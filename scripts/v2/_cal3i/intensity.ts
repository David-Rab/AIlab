// CAL3-I probe: world work billing by stream (adopted task-hours, agent-hours, seats, consumer), tokens a day and tokens
// per hour of use, and the player's revenue, quarterly on one RefBot classic run.
// Run: npx tsx scripts/v2/_cal3i/intensity.ts [seed] [end] [world]
import { dayOfDate, decimalYear } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { workBilling, workUse, consumerUse } from '../../../src/engine/v2/worldfx/readouts';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { ECON, REGIONS, SECTORS } from '../../../src/data/v2/sectors';
import { useShareOf } from '../../../src/engine/v2/worldfx/use';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';

const seed = Number(process.argv[2] ?? 2027);
const end = process.argv[3] ?? '2027-07-01';
const world = process.argv[4] ?? 'tl-central';
const s = newGame(defaultSetupV2({ seed, world, alignment: 'medium', baseline: 'classic', tutorial: false } as never));
const END = dayOfDate('2025-07-01', end);
let lastQ = -1;
const annual: Record<number, number> = {};
while (s.time.day < END) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  const y = decimalYear(s);
  const rr = s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0);
  annual[Math.floor(y)] = (annual[Math.floor(y)] ?? 0) + rr / 365;
  const q = Math.floor(y * 4);
  if (q === lastQ) continue;
  lastQ = q;
  const mix = worldMix(s);
  const b = workBilling(s, mix);
  const w = b.world;
  let use = 0;
  for (const r of REGIONS) for (const d of SECTORS) { const st = s.world.sectors[r][d.id]; use += useShareOf(st, d.id) * st.E0 * ECON.hours; }
  const cons = consumerUse(s, mix);
  const tokWork = w.tokAdopted + w.tokSeated + w.tokAgent; // tokens a day
  const billedHuman = w.adopted + w.seated;
  console.log([
    y.toFixed(2),
    `use ${(use / 1e9).toFixed(1)}Gh adopt ${(w.adopted / 1e9).toFixed(2)} seat ${(w.seated / 1e9).toFixed(2)} sup ${(w.supervising / 1e9).toFixed(2)} agent ${(w.agent / 1e9).toFixed(2)}Gh (want ${(w.agentWanted / 1e9).toFixed(2)})`,
    `$B adopt ${w.spendAdopted.toFixed(1)} agent ${w.spendAgent.toFixed(1)} seat ${w.spendSeat.toFixed(1)} cons ${cons.spend.toFixed(1)}`,
    `tok/d adopt ${(w.tokAdopted / 1e12).toFixed(1)}T seat ${(w.tokSeated / 1e12).toFixed(1)}T agent ${(w.tokAgent / 1e12).toFixed(1)}T cons ${(b.consumerTokens / 1e12).toFixed(1)}T`,
    `tok/use-h ${((tokWork * 365) / use / 1e3).toFixed(0)}k tok/billed-h ${((tokWork * 365) / billedHuman / 1e3).toFixed(0)}k`,
    `$/adopt-h ${((w.spendAdopted * 1e9) / Math.max(1, w.adopted)).toFixed(2)} $/agent-h ${((w.spendAgent * 1e9) / Math.max(1, w.agent)).toFixed(2)}`,
    `US hrs ${(100 * workUse(s).hours).toFixed(1)}% SOFT α ${s.world.sectors.US.SOFT.alpha.toFixed(2)} player rr $${rr.toFixed(1)}B`,
  ].join(' | '));
  if (process.env.DEPS === '1') {
    const rd = revenueReadout(s, mix);
    for (const x of rd.deps) console.log(`    ${x.channel} dem $${x.demand.toFixed(1)}B rev $${x.revenue.toFixed(1)}B ${x.bound} need ${(x.needH100e / 1e3).toFixed(0)}k served ${(x.servingH100e / 1e3).toFixed(0)}k cut ${(x.cutH100e / 1e3).toFixed(0)}k adopt $${(x.adoptedDemand ?? 0).toFixed(1)} agent $${(x.agentDemand ?? 0).toFixed(1)} seat $${(x.seatDemand ?? 0).toFixed(1)} capped ${x.valueCapped.toFixed(2)}`);
  }
}
console.log(`seed ${seed} player revenue ${Object.entries(annual).map(([y, v]) => `${y} $${v.toFixed(1)}B`).join(' ')}`);
