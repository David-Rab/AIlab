// W1b: economy paths on the RefBot tl-central reference game (as fixtures.ts). Usage: npx tsx scripts/v2/_w1b/paths.ts [gBaseUS]
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { automationShare } from '../../../src/engine/v2/worldfx/readouts';
import { cashFloorStub, runRef } from '../lib';

const FIXTURE_SETUP = defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', baseline: 'classic', companyName: 'OpenBrain' });
const gBase = Number(process.argv[2] ?? 0.018);
const s = newGame(FIXTURE_SETUP);
const aiRevenue = () => s.player.finance.revenueRun + s.rivals.reduce((x, r) => x + (r.core.status === 'active' ? r.finance.revenueRun : 0), 0) + s.china.lab.finance.revenueRun;
console.log('day  U_US  U_youth  g_US   gAI(g-base)  gdp_US  autoShare  aiRev($B)');
for (const day of [0, 200, 400, 600, 900]) {
  runRef(s, day, undefined, { extraSystems: [cashFloorStub] });
  const w = s.world;
  console.log([day, w.unemployment.US.toFixed(2), w.youthUnemployment.toFixed(2), w.macro.US.g.toFixed(4), (w.macro.US.g - gBase).toFixed(4), w.macro.US.gdp.toFixed(0), automationShare(s, 'US').toFixed(4), aiRevenue().toFixed(1)].join('\t'));
}
process.exit(0);
