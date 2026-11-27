// RD-P06 targeted check: reasoning effort is a plain product setting (fit and serving cost per answer up at deep, no
// feature built); no Deep think feature or `effort` feature kind left in src. (CP4: the rev-66 migration check is gone
// with the UB-3 save break.) Run alone: npx tsx scripts/v2/_p06/check.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { act } from '../../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { productOffer } from '../../../src/engine/v2/worldfx/serving';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const game = () => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', baseline: 'classic', tutorial: false }));
const prod = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;

// 1. Setting effort deep raises fit and serving cost, with no feature built (only the tree idea known).
const s = game();
s.player.tree.P05 = { ...(s.player.tree.P05 ?? {}), status: 'known' } as GameStateV2['player']['tree'][string];
const api = prod(s, 'api');
const before = productOffer(s, api, 'SOFT');
const featsBefore = [...s.player.features];
const err = act(s, 'product.update', { id: api.id, effort: 'deep' });
const after = productOffer(s, prod(s, 'api'), 'SOFT');
check(!err && prod(s, 'api').effort === 'deep', 'effort deep is set on the product with no feature built', err ?? '');
check(after.fit > before.fit && after.cost > before.cost, 'deep effort raises fit and the serving cost per work-hour',
  `fit ${before.fit.toFixed(3)} → ${after.fit.toFixed(3)}; cost ${before.cost.toFixed(3)} → ${after.cost.toFixed(3)}`);
check(JSON.stringify(s.player.features) === JSON.stringify(featsBefore), 'the lab\'s built features are unchanged');
const locked = game();
check(!!act(locked, 'product.update', { id: prod(locked, 'api').id, effort: 'deep' }), 'without the idea, deep effort is refused (one lock: the model\'s capability)');

// 2. No Deep think feature or `effort` feature kind left in src (CP4: "Deep think" as a word, so the live effort
// discovery's "Deep thinking effort" line is not a hit).
const hits: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !p.split(String.fromCharCode(92)).join('/').endsWith('core/save.ts')) {
      const t = readFileSync(p, 'utf8');
      if (/deepThink|[Dd]eep think\b|kind: 'effort'|kind === 'effort'|effortDeep|featEffort/.test(t)) hits.push(p);
    }
  }
};
walk('src');
check(hits.length === 0, 'no Deep think / effort feature kind in src', hits.join(', '));

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
