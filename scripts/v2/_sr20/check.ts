// SR-20 targeted check (run alone: npx tsx scripts/v2/_sr20/check.ts).
//  1. day 400 migrates to 81; routine / frontier research watchers are 'auto';
//  2. the High package on the internal deployment sets its parts (review + control defer 10%) and the engine then
//     charges what the preview summed (control compute on the monitors' line, review staff); on a product it sets
//     classifier misuse safeguards and the preview's revenue line equals the engine's before → after;
//  3. the auto watcher picks the most capable TRUSTED model, skipping a more capable untrusted one; a belief change flips it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { ACTIONS } from '../../../src/engine/v2/core/registry';
import { agentVersion, monitorBudget, monitorVersion } from '../../../src/engine/v2/departments/agents';
import { safeguardFte } from '../../../src/engine/v2/safety/investigations';
import { controlOn, guardOf, reviewOn } from '../../../src/engine/v2/safety/safeguards';
import { previewPackage } from '../../../src/engine/v2/safety/packages';
import { autoWatcher } from '../../../src/engine/v2/safety/trusted';
import { measuredLOf } from '../../../src/engine/v2/models/labs';
import { previewDeployments } from '../../../src/engine/v2/worldfx/productView';
import type { GameStateV2, ModelVersion } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const act = ACTIONS.find((a) => a.id === 'safety.package')!;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// 1. migration
const s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 81 && s.player.agents.capRoutine.monitorId === 'auto', 'save migrates to 81; routine research watcher is auto', `rev ${s.schemaRev}, ${s.player.agents.capRoutine.monitorId}, frontier ${s.player.agents.capFrontier.monitorId}`);

// 2a. High package on the internal deployment
{
  const x = load();
  const d = x.player.deployments.find((y) => y.channel === 'internal' && y.status === 'live')!;
  // Start from the Standard state (review only) so High's parts are new.
  act.apply(x, makeCtx(x), { deploymentId: d.id, pkg: 'standard' });
  const c0 = monitorBudget(x).control * x.player.computeOnline, p0 = safeguardFte(x);
  const pv = previewPackage(x, d, 'high');
  const sum = pv.parts.reduce((a, l) => ({ c: a.c + l.computeH100e, p: a.p + l.people }), { c: 0, p: 0 });
  act.apply(x, makeCtx(x), { deploymentId: d.id, pkg: 'high' });
  const dd = x.player.deployments.find((y) => y.id === d.id)!;
  check(reviewOn(dd) && controlOn(dd) && guardOf(dd, 'control')?.setting === 'defer10', 'High on internal sets review + control (defer 10%)', JSON.stringify(dd.guards?.map((g) => g.kind + (g.setting ? ':' + g.setting : ''))));
  const c1 = monitorBudget(x).control * x.player.computeOnline, p1 = safeguardFte(x);
  check(sum.c > 0 && near(c1 - c0, sum.c) && near(c1 - c0, pv.total.computeH100e) && near(p1 - p0, sum.p), 'engine charges the summed preview cost (control compute, review staff)', `preview +${sum.c.toFixed(1)} H100e / +${sum.p} people; charged +${(c1 - c0).toFixed(1)} H100e / +${p1 - p0}; stop rows ${pv.stops.length}, slowdown +${(pv.total.slowdown * 100).toFixed(1)}%`);
  check(pv.stops.length > 0 && pv.stops.some((r) => r.after > r.before + 1e-9), 'preview shows stop rates rising', pv.stops.slice(0, 3).map((r) => `${r.act} ${(r.before * 100).toFixed(0)}→${(r.after * 100).toFixed(0)}%`).join(', '));
  const pr = act.preview(x, { deploymentId: d.id, pkg: 'critical' });
  check(pr.costs.length > 0 || pr.gains.length > 0, 'action preview lists lines', pr.costs.map((l) => `${l.amount} ${l.unit ?? l.currency} ${l.target}`).join('; '));
}

// 2b. High package on a product
{
  const x = load();
  const d = x.player.deployments.find((y) => y.status === 'live' && y.channel !== 'internal' && y.channel !== 'open')!;
  d.safeguards = 'standard';
  const pv = previewPackage(x, d, 'high');
  const after = { ...d, safeguards: 'classifiers' as const };
  const eng = previewDeployments(x, x.player.deployments.map((y) => (y.id === d.id ? after : y)), d.id);
  act.apply(x, makeCtx(x), { deploymentId: d.id, pkg: 'high' });
  check(d.safeguards === 'classifiers' && !controlOn(d), 'High on a product sets classifier safeguards, no control', `${d.id} ${d.safeguards}`);
  check(near(pv.total.revenue, eng.totalAfter - eng.totalBefore), 'product preview revenue = engine before → after', `${pv.total.revenue.toFixed(3)} vs ${(eng.totalAfter - eng.totalBefore).toFixed(3)} $B/yr`);
}

// 3. auto watcher: most capable trusted, skip untrusted, belief flip
{
  const x = load();
  const watched = agentVersion(x, 'capRoutine')!;
  const live = x.player.models.versions.filter((v) => v.id !== watched.id && (v.status === 'ready' || v.status === 'deployed'));
  const byL = [...live].sort((a, b) => measuredLOf(x, b).L - measuredLOf(x, a).L);
  check(byL.length >= 2, 'fixture has two live candidate watchers', byL.map((v) => `${v.name} L${measuredLOf(x, v).L.toFixed(1)}`).join(', '));
  const [top, second] = byL as [ModelVersion, ModelVersion];
  const setEst = (v: ModelVersion, est: number) => { for (const tr of ['SCHEME', 'AF', 'SAND'] as const) if (v.beliefs[tr]) v.beliefs[tr].est = est; else (v.beliefs as Record<string, unknown>)[tr] = { est, clarity: 0.5 }; };
  for (const v of live) setEst(v, 0.1);
  check(monitorVersion(x, 'capRoutine')?.id === top.id, 'all trusted: auto picks the most capable', `${monitorVersion(x, 'capRoutine')?.name}; ${autoWatcher(x, watched).reason}`);
  setEst(top, 0.5);
  const w = autoWatcher(x, watched);
  check(monitorVersion(x, 'capRoutine')?.id === second.id && w.reason.includes('skipped') && w.reason.includes(top.name), 'top believed 50% scheming: skipped, next trusted chosen, reason says so', w.reason);
  setEst(top, 0.2);
  check(monitorVersion(x, 'capRoutine')?.id === top.id, 'belief drops below the line: choice flips back', autoWatcher(x, watched).reason);
  x.player.agents.capRoutine.monitorId = second.id;
  check(monitorVersion(x, 'capRoutine')?.id === second.id, 'player override keeps their pick');
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
