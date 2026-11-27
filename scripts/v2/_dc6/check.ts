// DC-6 check: stored chips keep their book value (no 6%/q decay). A new game with chips in inventory and no
// deliveries keeps inventory.book unchanged over 4 market quarters.
// Run alone: npx tsx scripts/v2/_dc6/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { clearMarket } from '../../../src/engine/v2/compute/market';

const s = newGame(defaultSetupV2());
const fx = s.player.finance.ws3!;
fx.inventory.ready = 1000;
fx.inventory.transit = 0;
fx.inventory.book = 1000;
const ctx = makeCtx(s);
let fails = 0;
for (let i = 1; i <= 4; i++) {
  clearMarket(s, ctx);
  const ok = fx.inventory.book === 1000;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} quarter ${i}: book ${fx.inventory.book} (was 1000)`);
}
process.exit(fails ? 1 : 0);
