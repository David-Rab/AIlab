// SR-12 targeted check: one monitor formula (models/products.ts monitorStop) for products and internal packages. Run alone:
// npx tsx scripts/v2/_sr12/check.ts
//  1. the same function gives the product and the internal catch (same watched / monitor pair, full watched share);
//  2. productCatch, monitorStrength and actTable's product stop rate are monitorStop's numbers;
//  3. doubling monitor compute raises the watched share until 1 (kernel and the internal allocation).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { AGENT_USES } from '../../../src/data/v2/agents';
import { agentSplitShare, agentVersion, monitorBudget, monitorStrength, monitorVersion } from '../../../src/engine/v2/departments/agents';
import { isProduct, monitorOverhead, monitorStop, productCatch, productMonitor, productMonitorCostRatio } from '../../../src/engine/v2/models/products';
import { actSite } from '../../../src/engine/v2/safety/actTable';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f4 = (x: number) => x.toFixed(4);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-12;
const load = (fx: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));

for (const fx of ['day400.json', 'day900.json']) {
  const s = load(fx);
  const use = AGENT_USES.find((u) => !!monitorVersion(s, u) && agentSplitShare(s, u) > 0);
  const d = s.player.deployments.find((x) => isProduct(x) && x.status !== 'withdrawn');
  check(!!use && !!d, `${fx}: a monitored internal use and a live product exist`);
  if (!use || !d) continue;
  const v = agentVersion(s, use)!;
  const mon = monitorVersion(s, use)!;

  // 1. Same pair on both: the product runs the use's model under the use's monitor; the internal allocation covers all.
  s.player.split.monitors = 10 * monitorBudget(s).need;
  d.versionId = v.id; d.monitorId = mon.id; d.controlLayer = false;
  const pi = productCatch(s, d), ii = monitorStrength(s, use).catch;
  check(near(pi, ii) && pi > 0, `${fx}: product and internal catch from one formula (${v.id} watched by ${mon.id})`, `${f4(pi)} = ${f4(ii)}`);
  for (const t of ['SCHEME', 'SYC'] as const) {
    check(near(productCatch(s, d, t), t === 'SCHEME' ? monitorStrength(s, use).catchColl : ii), `${fx}: same on ${t} (collusion rule shared)`);
  }

  // 2. Readers are the kernel's numbers.
  const k = monitorStop(s, v, mon, monitorOverhead(s, d), 1, productMonitorCostRatio(s, d), false);
  check(near(productMonitor(s, d).stop, k.stop) && near(k.stop, k.watched * k.flag * k.actedOn), `${fx}: product stop = watched × flag × acted-on`, `${f4(k.watched)} × ${f4(k.flag)} × ${f4(k.actedOn)}`);
  const site = actSite(s, { deploymentId: d.id }, true);
  check(!!site && near(site.monitor, k.stop) && near(site.catchOf('SYC'), k.stop), `${fx}: actTable's product stop rate reads monitorStop`);
  check(near(monitorOverhead(s, d), productMonitorCostRatio(s, d)), `${fx}: product monitor compute billed to serving = watched share × cost ratio`, f4(monitorOverhead(s, d)));

  // 3. Doubling monitor compute: kernel and internal allocation.
  const ws = [0.05, 0.1, 0.2, 0.4, 0.8, 1.6].map((x) => monitorStop(s, v, mon, x, 1, 1).watched);
  check(ws.every((w, i) => i === 0 || w >= ws[i - 1]) && near(ws[1], 2 * ws[0]) && ws[5] === 1, `${fx}: kernel watched share doubles until 1`, ws.map(f4).join(' '));
  const need = monitorBudget(s).need;
  const cov: number[] = [];
  for (const m of [0.125, 0.25, 0.5, 1, 2]) { s.player.split.monitors = need * m; cov.push(monitorStrength(s, use).watched); }
  check(near(cov[1], 2 * cov[0]) && near(cov[2], 2 * cov[1]) && near(cov[3], 1) && cov[4] === 1, `${fx}: internal watched share doubles with the monitors' allocation until 1`, cov.map(f4).join(' '));
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
