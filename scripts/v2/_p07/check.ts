// RD-P07 targeted check: a product tool (enabler) acts inside the offer as coverage, so the player's API with Computer
// use gains target share in a sector that needs the tool (Admin, OFFICE) and not in one that does not (Software, SOFT);
// a rival gets the tool TOOL_LAG_DAYS after the first ship (through the daily tick), and its coverage there rises.
// Run alone: npx tsx scripts/v2/_p07/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { productOffer } from '../../../src/engine/v2/worldfx/serving';
import { TOOL_LAG_DAYS } from '../../../src/data/v2/features';
import type { Deployment, GameStateV2, SectorId } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const game = () => newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const api = (s: GameStateV2) => s.player.deployments.find((d) => d.channel === 'api' && d.status !== 'withdrawn') as Deployment;
const giveTool = (s: GameStateV2) => {
  if (!s.player.features.includes('computerUse')) s.player.features.push('computerUse');
  api(s).features.push('computerUse');
};
const target = (s: GameStateV2, sid: SectorId) => {
  const m = worldMix(s);
  const i = m.providers.findIndex((p) => p.key === 'player');
  return { share: m.sec.US[sid].target[i], cover: m.sec.US[sid].cover, keys: m.providers.map((p) => p.key) };
};

// 1. Coverage inside the offer: ×1.15 in OFFICE, unchanged in SOFT; same fit.
const a = game();
const b = game();
giveTool(b);
const oA = productOffer(a, api(a), 'OFFICE');
const oB = productOffer(b, api(b), 'OFFICE');
const sA = productOffer(a, api(a), 'SOFT');
const sB = productOffer(b, api(b), 'SOFT');
check(Math.abs(oB.a / oA.a - 1.15) < 1e-9 && oB.fit === oA.fit, 'Computer use: OFFICE coverage ×1.15 in the offer, fit unchanged', `a ${oA.a.toFixed(4)} → ${oB.a.toFixed(4)}`);
check(sB.a === sA.a && sB.fit === sA.fit, 'Computer use: SOFT offer unchanged', `a ${sA.a.toFixed(4)}`);

// 2. The choice: the player's target share rises in OFFICE, not in SOFT.
const tA = target(a, 'OFFICE');
const tB = target(b, 'OFFICE');
const uA = target(a, 'SOFT');
const uB = target(b, 'SOFT');
check(tB.share > tA.share * (1 + 1e-6), 'player target share rises in OFFICE (needs the tool)', `${tA.share.toFixed(4)} → ${tB.share.toFixed(4)}`);
check(Math.abs(uB.share - uA.share) < 1e-9, 'player target share unchanged in SOFT (does not need it)', `${uA.share.toFixed(4)} → ${uB.share.toFixed(4)}`);

// 3. Rivals: the first ship is recorded by the daily tick; a rival has the tool only from ship + TOOL_LAG_DAYS.
tick(b);
const ship = b.world.fx.toolShip?.computerUse;
check(ship !== undefined, 'the tick records the first ship of Computer use', `day ${ship}`);
const r0 = b.rivals.find((r) => r.core.status === 'active')!;
check(!r0.tools?.includes('computerUse'), 'a rival does not have it the day after the ship');
const i0 = worldMix(b).providers.findIndex((p) => p.key === r0.core.id);
const before = worldMix(b).sec.US.OFFICE.cover[i0];
const pBefore = target(b, 'OFFICE').share;
// Move the ship day back so the next tick's day is TOOL_LAG_DAYS − 1 after it, the one after exactly TOOL_LAG_DAYS.
b.world.fx.toolShip!.computerUse = b.time.day + 1 - (TOOL_LAG_DAYS - 1); // the tick runs on the next day
tick(b);
check(!r0.tools?.includes('computerUse'), `no tool at ship + ${TOOL_LAG_DAYS - 1} d`);
tick(b);
check(!!r0.tools?.includes('computerUse') && !!b.china.lab.tools?.includes('computerUse') === (b.china.lab.core.status === 'active'), `rivals (and China) have it at ship + ${TOOL_LAG_DAYS} d`, `day ${b.time.day}, shipped ${b.world.fx.toolShip!.computerUse}`);
const after = worldMix(b).sec.US.OFFICE.cover[i0];
const pAfter = target(b, 'OFFICE').share;
check(after > before * 1.1, 'the rival\'s OFFICE coverage rises once it has the tool', `${before.toFixed(4)} → ${after.toFixed(4)}`);
check(pAfter < pBefore, 'the player\'s OFFICE edge shrinks', `${pBefore.toFixed(4)} → ${pAfter.toFixed(4)}`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
