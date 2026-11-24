// MK-11 helper: revenue of a save as the engine of the checkout it runs in reads it on load (no tick), per product and
// in total; for the before / after comparison of scripts/v2/_mk11/check.ts. Run from any checkout:
//   npx tsx scripts/v2/_mk11/rev.ts <save.json>
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { tick } from '../../../src/engine/v2/core/loop';

const s = deserialize(readFileSync(process.argv[2] ?? 'C:/Users/david/Downloads/ai27-v2-day369.json', 'utf8'));
const show = (label: string) => {
  const r = revenueReadout(s);
  console.log(`${label}: total revenue $${r.total.toFixed(2)}B/yr`);
  for (const d of r.deps) {
    const x = d as typeof d & { adoptedDemand?: number; agentDemand?: number; seatDemand?: number; agentHours?: number };
    console.log(`  ${d.id.padEnd(4)} ${d.channel.padEnd(10)} revenue ${d.revenue.toFixed(2).padStart(7)}  adopted ${(x.adoptedDemand ?? 0).toFixed(2).padStart(7)}  agent ${(x.agentDemand ?? 0).toFixed(2).padStart(7)}  seats ${(x.seatDemand ?? 0).toFixed(2).padStart(6)}  agent-hours ${(x.agentHours ?? 0).toExponential(2)}`);
  }
};
show('on load');
for (let i = 0; i < 30; i++) tick(s);
show('after 30 days');
