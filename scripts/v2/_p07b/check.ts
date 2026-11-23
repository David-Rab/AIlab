// RD-P07b targeted check: with the player never building Computer use, a rival whose aggregate state passes the
// feature's gate (P06 known: rivalKnowsNode) builds it in buildTW × RIVAL_TOOL_DAYS_PER_TW days and ships it first
// (world.fx.toolShip records the day and the lab); a rival that cannot build it (its build pushed out here) has it only
// from that first ship + TOOL_LAG_DAYS; the player never gets it.
// Run alone: npx tsx scripts/v2/_p07b/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { FEATURE_BY_ID, RIVAL_TOOL_DAYS_PER_TW, TOOL_LAG_DAYS } from '../../../src/data/v2/features';
import { rivalKnowsNode } from '../../../src/engine/v2/actors/rivalModel';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s = newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const id = 'computerUse';
check(!s.player.features.includes(id), 'the player has not built Computer use');
const act = s.rivals.filter((r) => r.core.status === 'active' && r.publicModel);
const a = act.find((r) => rivalKnowsNode(s, r, FEATURE_BY_ID[id].node!));
check(!!a, 'a rival passes the gate (knows P06)', a?.core.id);
const others = act.filter((r) => r !== a);
// The others cannot build it (stand-in for a lab that does not pass the gate): their build is pushed out.
for (const r of others) (r.toolBuild ??= {})[id] = 1e9;
const want = FEATURE_BY_ID[id].buildTW * RIVAL_TOOL_DAYS_PER_TW;
let n = 0;
while (!s.world.fx.toolShip?.[id] && n++ < want + 5) tick(s);
const ship = s.world.fx.toolShip?.[id];
check(!!ship && ship.by === a?.core.id, 'the rival ships it first, recorded with who', `${ship?.by} day ${ship?.day}`);
check(Math.abs(n - want) <= 1, `after its build (${want} d)`, `${n} ticks`);
check(!!a?.tools?.includes(id), 'the shipping rival has it');
check(others.length > 0 && others.every((r) => !r.tools?.includes(id)), 'the other rivals do not have it yet', `${others.length} others`);
// Jump: next tick is ship + TOOL_LAG_DAYS − 1, the one after ship + TOOL_LAG_DAYS.
ship!.day = s.time.day + 1 - (TOOL_LAG_DAYS - 1);
tick(s);
check(others.every((r) => !r.tools?.includes(id)), `others have none at ship + ${TOOL_LAG_DAYS - 1} d`);
tick(s);
const live = others.filter((r) => r.core.status === 'active');
check(live.length > 0 && live.every((r) => r.tools?.includes(id)), `the other rivals have it at ship + ${TOOL_LAG_DAYS} d`, `${live.length} rivals`);
check(s.china.lab.core.status !== 'active' || !!s.china.lab.tools?.includes(id), 'China has it');
check(!s.player.features.includes(id), 'the player still has not got it (no free tools)');
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
