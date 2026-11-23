// RD-P11 targeted check: no flat ×1.2 brand left; the brand term rises with the provider's customer stock (same rule for
// all providers) and moves the player's target share; every feature's incident exposure is a site quantity (horizon,
// affordances) or a hazard multiplier marked [D] in its risk text.
// Run alone: npx tsx scripts/v2/_p11/check.ts
import { readFileSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { installedBrand, worldMix } from '../../../src/engine/v2/worldfx/mix';
import { siteOf } from '../../../src/engine/v2/safety/incidents';
import { versionById } from '../../../src/engine/v2/safety/common';
import { FEATURES } from '../../../src/data/v2/features';
import { BRAND_INSTALLED } from '../../../src/data/v2/serving';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s = newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));

// 1. No flat 1.2 brand.
const mixSrc = readFileSync('src/engine/v2/worldfx/mix.ts', 'utf8');
check(!/return\s+1\.2\s*\+/.test(mixSrc) && !/brand:\s*1\.2/.test(mixSrc), 'no flat ×1.2 brand in mix.ts');

// 2. Brand rises with the customer stock.
const m0 = worldMix(s);
const pi = m0.providers.findIndex((p) => p.key === 'player');
const base = m0.providers.map(() => 1);
const withStock = (x: number): GameStateV2 => {
  const g = structuredClone(s);
  const row: Record<string, number> = {};
  for (const p of m0.providers) row[p.key] = p.key === 'player' ? x : (1 - x) / (m0.providers.length - 1);
  g.world.fx.cust ??= { US: {}, CN: {}, ROW: {} };
  g.world.fx.cust.US.SOFT = { ...row };
  g.world.fx.cust.US.consumer = { ...row };
  return g;
};
const lo = withStock(0.1), hi = withStock(0.6);
const bLo = installedBrand(lo, m0.providers, 'US', 'SOFT', base)[pi];
const bHi = installedBrand(hi, m0.providers, 'US', 'SOFT', base)[pi];
check(pi >= 0 && bHi > bLo && Math.abs(bHi - (1 + BRAND_INSTALLED * 0.6)) < 1e-9, 'player brand term rises with its customer stock', `stock 0.1 → ${bLo.toFixed(3)}, 0.6 → ${bHi.toFixed(3)}`);
const ri = m0.providers.findIndex((p) => p.key !== 'player' && !p.open);
const rLo = installedBrand(lo, m0.providers, 'US', 'SOFT', base)[ri], rHi = installedBrand(hi, m0.providers, 'US', 'SOFT', base)[ri];
check(ri >= 0 && rLo > rHi, 'same rule for a rival (its stock falls, its brand term falls)', `${rLo.toFixed(3)} → ${rHi.toFixed(3)}`);
const tLo = worldMix(lo).sec.US.SOFT.target[pi], tHi = worldMix(hi).sec.US.SOFT.target[pi];
check(tHi > tLo, 'player SOFT target share rises with its stock', `${tLo.toFixed(4)} → ${tHi.toFixed(4)}`);
const cLo = worldMix(lo).consumer.US.target[pi], cHi = worldMix(hi).consumer.US.target[pi];
check(cHi > cLo, 'player Chat target share rises with its stock', `${cLo.toFixed(4)} → ${cHi.toFixed(4)}`);

// 3. Feature hazards: a site quantity or a [D] note.
for (const f of FEATURES) {
  const hasQty = f.afford !== undefined || f.fx.some((x) => x.kind === 'horizon' && x.work === 'all');
  const hz = f.hazard ? Object.keys(f.hazard).length > 0 : false;
  check(!hz || /\[D/.test(f.risk ?? ''), `${f.name}: hazard multiplier ${hz ? 'marked [D]' : 'none'}${hasQty ? '; acts on a site quantity' : ''}`);
}
// Site quantities move: Computer use on the API raises F; Memory on Agents raises autonomy.
const dep = (ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;
const site = (d: Deployment, feats: string[]) => {
  const g = structuredClone(s);
  const dd = g.player.deployments.find((x) => x.id === d.id)!;
  dd.features = feats;
  for (const id of feats) if (!g.player.features.includes(id)) g.player.features.push(id);
  return siteOf(g, dd, versionById(g, dd.versionId)!, 0.5);
};
const api = dep('api'), ag = dep('agents');
if (api) { const a0 = site(api, []).afford, a1 = site(api, ['computerUse']).afford; check(Math.abs(a1 - a0 - 0.25) < 1e-9, 'Computer use: API affordances +0.25', `${a0} → ${a1}`); }
else check(false, 'no API product at start');
if (ag) { const a0 = site(ag, []).autonomy, a1 = site(ag, ['memory']).autonomy; check(a1 > a0, 'Memory: Agents autonomy rises (horizon ×1.3)', `${a0.toFixed(3)} → ${a1.toFixed(3)}`); }
else console.log('skip: no Agents product at start');

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
