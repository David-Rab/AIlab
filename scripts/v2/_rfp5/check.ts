// RF-P5 targeted check: each provider is one nest in the buyers' choice, so a second product with exactly the same
// offer adds no share to the player (it splits the player's buyers with the first), while a better product still wins.
// Run alone: npx tsx scripts/v2/_rfp5/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s = newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));
const api = s.player.deployments.find((d) => d.channel === 'api' && d.status !== 'withdrawn') as Deployment;
const share = (g: GameStateV2) => {
  const m = worldMix(g);
  const i = m.providers.findIndex((p) => p.key === 'player');
  return { t: m.sec.US.SOFT.target[i], w: m.sec.US.SOFT.playerProdW };
};
const one = share(s);
const dup = structuredClone(s);
dup.player.deployments.push({ ...structuredClone(api), id: 'Dcopy' });
const two = share(dup);
check(Math.abs(two.t - one.t) < 1e-12, 'a duplicate of the API product adds no player share in US Software', `${one.t.toFixed(4)} → ${two.t.toFixed(4)}`);
check(Math.abs((two.w[api.id] ?? 0) - (two.w.Dcopy ?? 0)) < 1e-9 && (two.w.Dcopy ?? 0) > 0, 'the two split the player\'s Software hours evenly', JSON.stringify(two.w));
const solo = structuredClone(s);
solo.player.deployments.find((d) => d.id === api.id)!.status = 'withdrawn';
const ent = share(solo);
check(ent.t <= one.t + 1e-12, 'without the API (Enterprise alone) the player\'s share does not rise (the nest keeps its best offer)', `${one.t.toFixed(4)} → ${ent.t.toFixed(4)}`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
