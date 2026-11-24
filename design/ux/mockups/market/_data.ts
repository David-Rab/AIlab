// Mockup data for market/products: the day-369 save (designer's playtest, ~/Downloads/ai27-v2-day369.json) read through
// the current engine's product readouts. Run from the worktree root:
//   ../AI27/node_modules/.bin/tsx design/ux/mockups/market/_data.ts <save.json>  → design/ux/mockups/market/data369.json
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { productReadouts, servingPool, dateOf, fmtDate } from '../../../../src/engine/v2';

const s = deserialize(readFileSync(process.argv[2], 'utf8'));
const reads = productReadouts(s);
const out: Record<string, unknown> = { day: s.time.day, date: fmtDate(dateOf(s)), pool: servingPool(s) };
for (const [id, r] of reads) {
  const { econ, cust, ...rest } = r as any;
  out[id] = { ...rest, cust };
}
writeFileSync('design/ux/mockups/market/data369.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toPrecision(4) : v), 1).slice(0, 9000));
