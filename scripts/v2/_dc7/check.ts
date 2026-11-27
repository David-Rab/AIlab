// DC-7 check: one refBot game (seed 1) to 2027-07 on the three sources; lists the sites the bot built and checks them.
// Run: npx tsx scripts/v2/_dc7/check.ts
import { engine } from '../../../src/engine/v2';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { dayOfDate, quarterIndex } from '../../../src/engine/v2/core/time';
import { siteLiveQ } from '../../../src/engine/v2/compute/forecast';
import { SITE_MIN_MW, SOURCES } from '../../../src/data/v2/deals';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

const s = newGame(defaultSetupV2({ seed: 1 }));
const end = dayOfDate(s.time.startDate, '2027-07-01');
const startIds = new Set(s.player.sites.map((x) => x.id));
const q0 = quarterIndex(s.time.startDate, 0);
const qName = (q: number) => { const y = 2025 + Math.floor((q + 2) / 4); return `Q${((q + 2) % 4) + 1} ${String(y).slice(2)}`; }; // game starts Q3 2025 (q index 0)
let guard = 0;
while (!s.ending && s.time.day < end && guard++ < 5000) {
  for (const p of [...s.events.pending]) {
    if (resolve(s, p.instance, refBot.decide(s, p))) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s);
}
console.log(`ref bot, seed 1, ended ${s.ending ? 'early' : 'at day ' + s.time.day} (${qName(quarterIndex(s.time.startDate, s.time.day))})`);

const built = s.player.sites.filter((x) => !startIds.has(x.id));
console.log(`sites built: ${built.length}`);
for (const x of built) {
  const lv = [x.crash && 'crash', x.ws3.rush && 'rush', x.ws3.fastTrack && 'fast-track', x.communityPackage && 'community'].filter(Boolean).join('+') || 'none';
  const l = siteLiveQ(s, x);
  const committed = quarterIndex(s.time.startDate, x.ws3.startDay);
  console.log(`  ${x.id} ${x.path.padEnd(4)} ${(x.mw / 1000).toFixed(2)} GW  levers ${lv.padEnd(34)} committed ${qName(committed)}  live ${l ? qName(l.q) : 'blocked'}  stage ${x.stage}  capex ${x.capex.toFixed(1)}`);
}
check(built.length > 0, 'the bot built at least one site');
check(built.every((x) => (['rent', 'grid', 'gas'] as const).includes(x.path)), 'every source is rent, grid or gas');
check(built.every((x) => x.mw >= SITE_MIN_MW - 1e-9 && x.mw <= SOURCES[x.path].maxMW + 1e-9), 'every size is within [100 MW, source cap]');
check(built.every((x) => x.path !== 'rent' || (!x.crash && !x.ws3.rush && !x.ws3.fastTrack && !x.communityPackage)), 'rent sites carry no levers');
const sources = new Set(built.map((x) => x.path));
console.log(`sources used: ${[...sources].join(', ')}`);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
