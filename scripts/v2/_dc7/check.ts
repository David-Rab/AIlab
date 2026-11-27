// DC-7 check: one refBot game (seed 1) to 2027-07 on the three sources; lists the sites the bot built and checks them.
// Run: npx tsx scripts/v2/_dc7/check.ts
import { engine } from '../../../src/engine/v2';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { act, resolve, tick } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { dayOfDate, quarterIndex } from '../../../src/engine/v2/core/time';
import { siteLiveQ } from '../../../src/engine/v2/compute/forecast';
import { CAMPUS, SITE_MIN_MW, SITE_TIERS, SOURCES } from '../../../src/data/v2/deals';
import { siteBuildingLiveQs } from '../../../src/engine/v2/compute/forecast';

const TIER_MAX = Math.max(...SITE_TIERS.map((t) => t.mw));

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

// the build action clamps one building to the largest tile (1 GW): a 5 GW request is one 1 GW building
{
  const g = newGame(defaultSetupV2({ seed: 1 }));
  const before = g.player.sites.length;
  const err = act(g, 'cmp.newSite', { path: 'gas', mw: 5000, pay: 'cash' });
  const x = g.player.sites[g.player.sites.length - 1];
  check(err === undefined && g.player.sites.length === before + 1 && x.mw === TIER_MAX && (x.ws3.buildings ?? 1) === 1, 'cmp.newSite mw 5000 builds one 1 GW building', `mw ${x.mw}`);
  const g2 = newGame(defaultSetupV2({ seed: 1 }));
  act(g2, 'cmp.newSite', { path: 'gas', mw: 5000, buildings: 5, pay: 'cash' });
  const y = g2.player.sites[g2.player.sites.length - 1];
  check(y.mw === 5 * TIER_MAX && y.ws3.buildingMW === TIER_MAX, 'mw 5000 x 5 buildings = 5 x 1 GW', `mw ${y.mw}, building ${y.ws3.buildingMW}`);
  check(g.player.sites.slice(0, before).every((z, i) => z.mw === newGame(defaultSetupV2({ seed: 1 })).player.sites[i].mw), 'start sites untouched');
}

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
const nOf = (x: (typeof built)[number]) => x.ws3.buildings ?? 1;
const bMW = (x: (typeof built)[number]) => x.ws3.buildingMW ?? x.mw / nOf(x);
for (const x of built) {
  const lv = [x.crash && 'crash', x.ws3.rush && 'rush', x.ws3.fastTrack && 'fast-track', x.communityPackage && 'community'].filter(Boolean).join('+') || 'none';
  const l = siteBuildingLiveQs(s, x);
  const live = l ? (l.qs[0] === l.qs[l.qs.length - 1] ? qName(l.qs[0]) : `${qName(l.qs[0])} to ${qName(l.qs[l.qs.length - 1])}`) : 'blocked';
  const committed = quarterIndex(s.time.startDate, x.ws3.startDay);
  console.log(`  ${x.id} ${x.path.padEnd(4)} ${String(bMW(x)).padStart(4)} MW x ${nOf(x)} (${(x.mw / 1000).toFixed(2)} GW)  levers ${lv.padEnd(34)} committed ${qName(committed)}  live ${live}  stage ${x.stage}  capex ${x.capex.toFixed(1)}`);
}
check(built.length > 0, 'the bot built at least one site');
check(built.every((x) => (['rent', 'grid', 'gas'] as const).includes(x.path)), 'every source is rent, grid or gas');
check(built.every((x) => x.mw >= SITE_MIN_MW - 1e-9 && x.mw <= SOURCES[x.path].maxMW + 1e-9), 'every size is within [100 MW, source cap]');
check(built.every((x) => bMW(x) <= TIER_MAX + 1e-9), 'every building is at most 1 GW');
check(built.every((x) => SITE_TIERS.some((t) => t.mw === bMW(x)) && (CAMPUS.counts as readonly number[]).includes(nOf(x)) && (x.path !== 'rent' || nOf(x) === 1)), 'every building is a tier size, in 1, 3 or 5 buildings (rent: one hall)');
check(built.every((x) => x.path !== 'rent' || (!x.crash && !x.ws3.rush && !x.ws3.fastTrack && !x.communityPackage)), 'rent sites carry no levers');
const campuses = built.filter((x) => nOf(x) > 1);
console.log(`campuses (3 or 5 buildings): ${campuses.length} of ${built.length} sites; capex total ${built.reduce((a, x) => a + x.capex, 0).toFixed(1)} $B`);
const sources = new Set(built.map((x) => x.path));
console.log(`sources used: ${[...sources].join(', ')}`);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
