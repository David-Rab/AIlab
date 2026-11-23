// CAL-S2 probe: the Mixed bot's weekly sight-limit margin to SAR (where S5's min margin comes from). Seed as argv[2].
import { mixedBot } from '../../../src/engine/v2/bots/mixed';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2/index';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { sightLimit } from '../../../src/engine/v2/safety/sightLimit';
const seed = Number(process.argv[2] ?? 900);
const s = newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', tutorial: false }));
const rows: string[] = [];
while (s.time.day < 1600 && s.player.status === 'active') {
  for (const p of [...s.events.pending]) { const c = mixedBot.decide(s, p); if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0); }
  mixedBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  if (s.time.day % 28 === 0) { const r = sightLimit(s); const v = internalVersion(s); rows.push(`d${s.time.day} ${v?.name} cot ${(v?.design as any)?.cot} EAbel ${v?.beliefs.EA?.est?.toFixed(2)} perTrait ${JSON.stringify(Object.fromEntries(Object.entries(r.perTrait).map(([k, x]) => [k, Number((x as number).toFixed(2))])))} st ${v?.status} lvl ${r.level.toFixed(1)} sight ${r.L.toFixed(1)} [${r.lo.toFixed(1)}–${r.hi.toFixed(1)}] gap ${r.gap.toFixed(2)}`); }
  if (s.player.milestoneDays[4] !== undefined) break;
}
console.log(`seed ${seed} SAR day ${s.player.milestoneDays[4]}`);
console.log(rows.join('\n'));
