// SR-20b targeted check (run alone: npx tsx scripts/v2/_sr20b/check.ts).
//  1. a product on monitorId 'auto' is watched by the trusted-watcher picker's choice (safety/trusted.ts autoWatcher),
//     and the engine bills that model (cost ratio / overhead); an override keeps the player's pick;
//  2. RefBot's monitors are the same picker: after refMonitors routine / frontier research run on 'auto' and the
//     resolved watcher equals autoWatcher's choice.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { engine } from '../../../src/engine/v2';
import { agentVersion, monitorVersion } from '../../../src/engine/v2/departments/agents';
import { applyEdit } from '../../../src/engine/v2/models/productOps';
import { productMonitorCostRatio, productMonitorVersion } from '../../../src/engine/v2/models/products';
import { versionById } from '../../../src/engine/v2/models/labs';
import { flopPerToken } from '../../../src/engine/v2/departments/workfit';
import { autoWatcher } from '../../../src/engine/v2/safety/trusted';
import { refMonitors } from '../../../src/engine/v2/bots/ref';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));

// 1. product auto watcher
{
  const x = load();
  const d = x.player.deployments.find((y) => y.status === 'live' && y.channel !== 'open' && y.channel !== 'internal')!;
  check(!!d, 'fixture has a live product', d?.id);
  const why = applyEdit(x, makeCtx(x), d, { monitorId: 'auto' });
  const pick = autoWatcher(x, versionById(x, d.versionId));
  const mon = productMonitorVersion(x, d);
  check(!why && d.monitorId === 'auto' && !!pick.v && mon?.id === pick.v.id, "product on 'auto' is watched by the picker's choice", `${why ?? ''} ${mon?.name}; ${pick.reason}`);
  const r = mon ? flopPerToken(x, mon) / Math.max(1e-6, flopPerToken(x, versionById(x, d.versionId)!)) : 0;
  check(Math.abs(productMonitorCostRatio(x, d) - r) < 1e-9 && r > 0, 'engine bills the picked watcher', `ratio ${r.toFixed(3)}`);
  const other = x.player.models.versions.find((v) => (v.status === 'ready' || v.status === 'deployed') && v.variant !== 'open' && v.id !== pick.v?.id)!;
  applyEdit(x, makeCtx(x), d, { monitorId: other.id });
  check(productMonitorVersion(x, d)?.id === other.id, 'override keeps the player\'s pick', other.name);
}

// 2. RefBot uses the picker
{
  const x = load();
  const v0 = x.player.models.versions.find((v) => v.status === 'ready' || v.status === 'deployed')!;
  x.player.agents.capRoutine.monitorId = v0.id;
  x.player.agents.capFrontier.monitorId = 'same';
  while (x.time.day % 7 !== 5) x.time.day++;
  refMonitors(x, engine);
  for (const use of ['capRoutine', 'capFrontier'] as const) {
    const pick = autoWatcher(x, agentVersion(x, use));
    check(x.player.agents[use].monitorId === 'auto' && monitorVersion(x, use)?.id === pick.v?.id, `RefBot ${use} monitor = the picker's choice`, `${x.player.agents[use].monitorId} ${monitorVersion(x, use)?.name}; ${pick.reason}`);
  }
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
