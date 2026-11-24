// MK-5: the sector market's outputs on the day-369 save (no tick), as JSON on stdout: the reference for check.ts (a)
// was made with this script on the pre-MK-5 code (market @ 6698ce7). Run: npx tsx scripts/v2/_mk5/dump.ts > ref.json
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
export const SAVE = 'C:/Users/david/Downloads/ai27-v2-day369.json';
export function dumpMix(mix: ReturnType<typeof worldMix>) {
  const out: Record<string, unknown> = { providers: mix.providers.map((p) => p.key) };
  for (const [r, row] of Object.entries(mix.sec)) for (const [sid, m] of Object.entries(row)) {
    out[`${r}|${sid}`] = { target: m.target, playerProdW: m.playerProdW, playerTierW: m.playerTierW, F: m.F, K: m.K, price: m.price, pCost: m.pCost, agentK: m.agentK, prices: m.prices, seatPrice: m.seatPrice, g: m.g };
  }
  return out;
}
if (/dump[.]ts$/.test(process.argv[1] ?? '')) {
  const s = deserialize(readFileSync(SAVE, 'utf8'));
  console.log(JSON.stringify(dumpMix(worldMix(s))));
}
