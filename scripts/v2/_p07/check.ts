// RD-P07 / RF-P1 targeted check: a product tool (enabler) acts inside the offer as coverage, so the player's API with
// Computer use has more target share in a sector that needs the tool (Admin, OFFICE) and the same in one that does not
// (Software, SOFT). Day-0 tools come from history (DAY0_TOOLS, the start's features); a tool no lab had at the start
// reaches the rivals TOOL_LAG_DAYS after the player first ships it (through the daily tick); a tool some lab had at the
// start never spreads by the lag rule.
// Run alone: npx tsx scripts/v2/_p07/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { productOffer } from '../../../src/engine/v2/worldfx/serving';
import { TOOL_LAG_DAYS } from '../../../src/data/v2/features';
import { toolsAtStart, type LabArchetype } from '../../../src/data/v2/tools';
const DAY0_TOOLS = (a: string) => toolsAtStart(a as LabArchetype); // MK-11: the rivals' start tools
import { POSITION_BY_ID } from '../../../src/data/v2/starts';
import { toolNewInGame } from '../../../src/engine/v2/actors/rivalModel';
import type { Deployment, GameStateV2, SectorId } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const game = (seed = 2027) => newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
const api = (s: GameStateV2) => s.player.deployments.find((d) => d.channel === 'api' && d.status !== 'withdrawn') as Deployment;
const target = (s: GameStateV2, sid: SectorId) => {
  const m = worldMix(s);
  const i = m.providers.findIndex((p) => p.key === 'player');
  return m.sec.US[sid].target[i];
};

// 0. Day-0 tools from history.
const b = game();
check(POSITION_BY_ID.frontier.features.every((f) => b.player.features.includes(f)) && api(b).features.includes('computerUse'), 'the leader start has its historical tools on (Computer use on the API)', api(b).features.join(','));
check(b.rivals.every((r) => JSON.stringify(r.tools ?? []) === JSON.stringify(DAY0_TOOLS(r.archetype))) && (b.china.lab.tools ?? []).length === 0,
  'every rival starts with its archetype\'s DAY0_TOOLS; China with none', b.rivals.map((r) => `${r.archetype}:${(r.tools ?? []).join('+')}`).join(' '));

// 1. Coverage inside the offer: ×1.15 in OFFICE, unchanged in SOFT; same fit (a = the same game without the tool).
const a = game();
api(a).features = api(a).features.filter((f) => f !== 'computerUse');
const oA = productOffer(a, api(a), 'OFFICE');
const oB = productOffer(b, api(b), 'OFFICE');
const sA = productOffer(a, api(a), 'SOFT');
const sB = productOffer(b, api(b), 'SOFT');
check(Math.abs(oB.a / oA.a - 1.15) < 1e-9 && oB.fit === oA.fit, 'Computer use: OFFICE coverage ×1.15 in the offer, fit unchanged', `a ${oA.a.toFixed(4)} → ${oB.a.toFixed(4)}`);
check(sB.a === sA.a && sB.fit === sA.fit, 'Computer use: SOFT offer unchanged', `a ${sA.a.toFixed(4)}`);

// 2. The choice: the player's target share is higher with it in OFFICE, the same in SOFT.
check(target(b, 'OFFICE') > target(a, 'OFFICE') * (1 + 1e-6), 'player target share higher in OFFICE (needs the tool)', `${target(a, 'OFFICE').toFixed(4)} → ${target(b, 'OFFICE').toFixed(4)}`);
check(Math.abs(target(b, 'SOFT') - target(a, 'SOFT')) < 1e-9, 'player target share the same in SOFT (does not need it)');

// 3. A historical tool does not spread: the tick records no ship of Computer use (the leader had it at the start).
tick(b);
check(!toolNewInGame(b, 'computerUse') && b.world.fx.toolShip?.computerUse === undefined, 'Computer use is not new in this game: no ship recorded, no lag rule');

// 4. A tool new in the game (Companion in a world with no Meta-like rival): rivals get it TOOL_LAG_DAYS after the ship.
let c: GameStateV2 | undefined;
for (let seed = 2027; seed < 2077 && !c; seed++) {
  const g = game(seed);
  if (toolNewInGame(g, 'companion')) c = g;
}
check(!!c, 'a world where no lab had Companion at the start');
if (c) {
  c.player.features.push('companion');
  const chat = c.player.deployments.find((d) => d.channel === 'consumer' && d.status !== 'withdrawn')!;
  chat.features.push('companion');
  tick(c);
  const ship = c.world.fx.toolShip?.companion;
  check(ship !== undefined, 'the tick records the player\'s first ship of Companion', `day ${ship}`);
  const r0 = c.rivals.find((r) => r.core.status === 'active')!;
  check(!r0.tools?.includes('companion'), 'a rival does not have it the day after the ship');
  c.world.fx.toolShip!.companion = c.time.day + 1 - (TOOL_LAG_DAYS - 1); // the next tick is ship + LAG − 1
  tick(c);
  check(!r0.tools?.includes('companion'), `no tool at ship + ${TOOL_LAG_DAYS - 1} d`);
  tick(c);
  check(!!r0.tools?.includes('companion'), `rivals have it at ship + ${TOOL_LAG_DAYS} d`, `day ${c.time.day}`);
}

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
