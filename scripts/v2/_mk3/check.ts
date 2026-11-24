// MK-3 check (design/MARKET.md M8): thinking effort removed; every product serves as the old default 'max'. The
// designer's day-369 save (read-only; its products were all on max) loads and each product's revenue readout equals
// what the same save gave on the market branch before MK-3 (numbers recorded there, hard-coded below).
// Run alone: npx tsx scripts/v2/_mk3/check.ts
import { existsSync, readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { BUYER_LADDER_TEST } from '../../../src/engine/v2/worldfx/mix';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

const BEFORE: Record<string, number> = { D1: 25.56596080441142, D2: 1.4170495772596334, D3: 52.46882395740444, D6: 7.689815278557071 };
const BEFORE_TOTAL = 87.14164961763257;

// MK-5: the numbers are from the single buyer choice (before the buyer-group ladder): every group reaches every product.
BUYER_LADDER_TEST.allReach = true;
const path = 'C:/Users/david/Downloads/ai27-v2-day369.json';
if (!existsSync(path)) { check(false, 'day-369 save present'); }
else {
  const s = deserialize(readFileSync(path, 'utf8'));
  check(s.player.deployments.every((d) => !('effort' in d)), 'no product carries an effort field');
  const rr = revenueReadout(s);
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  for (const r of rr.deps) {
    const was = BEFORE[r.id];
    console.log(`  ${r.id.padEnd(6)} revenue ${r.revenue.toFixed(6)}  before ${was?.toFixed(6) ?? '?'}`);
    check(was !== undefined && near(r.revenue, was), `${r.id} revenue unchanged`);
  }
  console.log(`  total ${rr.total.toFixed(6)}  before ${BEFORE_TOTAL.toFixed(6)}`);
  check(near(rr.total, BEFORE_TOTAL), 'total revenue unchanged');
  console.log(JSON.stringify(Object.fromEntries(rr.deps.map((r) => [r.id, r.revenue]))), rr.total);
}
console.log(fails ? `\n${fails} FAIL` : '\nall ok');
process.exit(fails ? 1 : 0);
