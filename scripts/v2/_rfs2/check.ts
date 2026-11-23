// RF-S2 targeted check (run alone: npx tsx scripts/v2/_rfs2/check.ts).
//  1. Publish framework (A3) signs one 'safetyFramework' commitment; the framework counts as published (override costs
//     credibility); no pause pledge, no noDeployAbove card;
//  2. the "Meet my framework" package adds what the framework asks and the deployment lacks: control on the internal
//     deployment under a training hold (the engine charges the previewed control compute; the hold clears), classifiers on
//     a product measured BIO ≥ 10; then "Already meets";
//  3. the auto watcher never picks a copy of the watched model;
//  4. RefBot's monitor is the cheap-monitor picker (cost nearest 10% of the watched model's, or a copy when none is cheaper).
import { readFileSync } from 'node:fs';
import { FRAMEWORK_CRITICAL_L, FRAMEWORK_HIGH_L } from '../../../src/data/v2/framework';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { ACTIONS } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2';
import { agentVersion, monitorBudget } from '../../../src/engine/v2/departments/agents';
import { flopPerToken } from '../../../src/engine/v2/departments/workfit';
import { frameworkPublished, overrideConsequences, refreshFramework, trainingHolds } from '../../../src/engine/v2/safety/framework';
import { packageBlock, previewPackage } from '../../../src/engine/v2/safety/packages';
import { controlOn } from '../../../src/engine/v2/safety/safeguards';
import { autoWatcher } from '../../../src/engine/v2/safety/trusted';
import { REF_MONITOR_COST, refMonitors } from '../../../src/engine/v2/bots/ref';
import type { GameStateV2, ModelVersion, TraitBelief } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (f = 'day400.json'): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
const act = (id: string) => ACTIONS.find((a) => a.id === id)!;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// 1. publishing
{
  const x = load();
  x.commitments = x.commitments.filter((c) => c.kind !== 'framework');
  check(!frameworkPublished(x) && overrideConsequences(x).credibility === 0, 'unpublished: override costs no credibility');
  act('A3').apply(x, makeCtx(x), {});
  const cards = x.commitments.filter((c) => c.status === 'live' && c.kind === 'framework');
  check(cards.length === 1 && cards[0].condition.predicate === 'safetyFramework', 'A3 signs one Safety framework commitment', cards.map((c) => c.condition.predicate).join(','));
  check(frameworkPublished(x) && overrideConsequences(x).credibility > 0, 'published: override costs credibility');
  check(!x.commitments.some((c) => ['noDeployAbove', 'pauseIfRedline'].includes(c.condition.predicate) && c.signedDay === x.time.day), 'no old pledge or pause card signed');
}

// 2a. package on the internal deployment
{
  const x = load();
  const d = x.player.deployments.find((y) => y.channel === 'internal' && y.status === 'live')!;
  refreshFramework(x);
  const held = trainingHolds(x);
  check(held.some((h) => h.missing.some((m) => m.startsWith('control'))) && !controlOn(d), 'fixture: training held for want of control', held.map((h) => h.ruleId).join(','));
  const c0 = monitorBudget(x).control * x.player.computeOnline;
  const pv = previewPackage(x, d);
  act('safety.package').apply(x, makeCtx(x), { deploymentId: d.id });
  const c1 = monitorBudget(x).control * x.player.computeOnline;
  check(controlOn(d) && near(c1 - c0, pv.total.computeH100e) && pv.total.computeH100e > 0, 'package turns control on; engine charges the previewed control compute', `${pv.parts.map((p) => p.label).join(' + ')}; +${pv.total.computeH100e.toFixed(1)} vs +${(c1 - c0).toFixed(1)} H100e; ${pv.meets}`);
  check(!trainingHolds(x).some((h) => h.missing.some((m) => m.startsWith('control'))), 'the control hold clears', trainingHolds(x).map((h) => h.missing.join('/')).join('; '));
  check(packageBlock(x, d) === 'Already meets your Safety framework', 'then: already meets', String(packageBlock(x, d)));
}

// 2b. package on a product measured BIO ≥ 10
{
  const x = load();
  const d = x.player.deployments.find((y) => y.status === 'live' && y.channel !== 'internal' && y.channel !== 'open')!;
  const v = x.player.models.versions.find((y) => y.id === d.versionId)!;
  v.evals.measuredDom = { ...(v.evals.measuredDom ?? {}), BIO: FRAMEWORK_HIGH_L + 0.5 } as typeof v.evals.measuredDom;
  v.evals.suiteDay ??= x.time.day;
  d.safeguards = 'standard';
  const pv = previewPackage(x, d);
  act('safety.package').apply(x, makeCtx(x), { deploymentId: d.id });
  check(d.safeguards === 'classifiers' && pv.parts.length === 1, 'product at BIO High (below Critical): package sets classifiers only', `${pv.parts.map((p) => p.label).join(' + ')}; ${pv.meets}`);
}

// 3. no self-copy watcher
{
  const x = load();
  const watched = agentVersion(x, 'capRoutine')!;
  const tight = { est: 0.05, sd: 0.02, clarity: 0.9, evidence: [] } as unknown as TraitBelief;
  const wide = { est: 0.3, sd: 0.2, clarity: 0.1, evidence: [] } as unknown as TraitBelief;
  for (const v of x.player.models.versions) for (const tr of ['SCHEME', 'AF', 'SAND'] as const) v.beliefs[tr] = { ...(v.id === watched.id ? tight : wide) };
  for (const v of x.player.models.versions) if (v.evals.measuredDom) v.evals.measuredDom.CYBER = 99; // nobody below the scheming level
  const w = autoWatcher(x, watched);
  check(!w.v && w.reason.includes('no other model you trust'), 'only the watched model trusted: no watcher (not a copy)', w.reason);
}

// 4. RefBot's cheap monitor
{
  const x = load();
  while (x.time.day % 7 !== 5) x.time.day++; // refMonitors runs weekly
  refMonitors(x, engine);
  for (const use of ['capRoutine', 'capFrontier'] as const) {
    const v = agentVersion(x, use)!;
    const id = x.player.agents[use].monitorId;
    const m: ModelVersion | undefined = id === 'same' ? v : x.player.models.versions.find((y) => y.id === id);
    const r = m ? flopPerToken(x, m) / flopPerToken(x, v) : NaN;
    check(!!m && id !== 'auto' && r <= 1, `RefBot ${use}: own cheap-monitor pick (cost ratio ≤ 1, target ${REF_MONITOR_COST})`, `${id} ${m?.name} ratio ${r.toFixed(3)}`);
  }
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
