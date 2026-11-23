// SR-19 targeted check (run alone: npx tsx scripts/v2/_sr19/check.ts).
//  1. day 400 migrates to 80: a Safety framework with the default rules, no eval gate; no eval-gate action, no E17 event;
//  2. a version whose MEASURED CYBER passes the Cyber: High threshold without classifier safeguards is held from launch;
//     with them it is not; a live product of it with standard safeguards is held (serves nobody); adding the safeguard
//     (product.update) releases it;
//  3. an override releases the hold and records and applies the stated consequences (safety morale, red flag,
//     scrutiny; credibility when published);
//  4. a training hold (AI R&D: Critical on a measured level, no control) pauses frontier runs and refuses new ones.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { ACTIONS, EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { deployGate } from '../../../src/engine/v2/models/deployments';
import { frontierPaused } from '../../../src/engine/v2/models/runs';
import { productUsageMult } from '../../../src/engine/v2/safety/safeguards';
import { frameworkOf, refreshFramework, trainingHeld } from '../../../src/engine/v2/safety/framework';
import { ws4r } from '../../../src/engine/v2/actors/state';
import type { GameStateV2, ModelVersion } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const action = (id: string) => ACTIONS.find((a) => a.id === id);
const setMeasured = (v: ModelVersion, d: 'CYBER' | 'RSCH' | 'BIO', L: number) => { v.evals.measuredDom = { ...(v.evals.measuredDom ?? {}), [d]: L }; };

// 1. migration and deletions
const s = load();
const fw = frameworkOf(s);
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 80 && fw.rules.some((r) => r.id === 'cyber-high') && !('evalGate' in s.player.safety),
  'save migrates to 80: Safety framework with default rules, no eval gate', `rev ${s.schemaRev}, depth ${fw.evalDepth}, ${fw.rules.length} rules`);
check(!action('safety.evalGate') && !EVENT_BY_ID.get('E17') && !!action('safety.frameworkOverride'), 'no eval-gate action, no E17 event; framework actions registered');

// 2. a held launch and a held product
const ctx = makeCtx(s);
const d = s.player.deployments.find((x) => x.status === 'live' && (x.channel === 'api' || x.channel === 'consumer' || x.channel === 'enterprise'))!;
const v = s.player.models.versions.find((x) => x.id === d.versionId)!;
check(!!d && !!v && v.evals.suiteDay !== undefined, 'fixture has a live external product of a measured version', `${d?.id} ${d?.channel} ${v?.name}`);
for (const r of fw.rules) if (r.trigger.kind === 'capability' && r.trigger.domain !== 'CYBER') setMeasured(v, r.trigger.domain as 'BIO' | 'RSCH', r.trigger.level - 3); // only Cyber fires
setMeasured(v, 'CYBER', 10.5);
const held = deployGate(s, v, d.channel, { safeguards: 'standard' });
check(typeof held === 'string' && held.includes('Cyber: High') && held.includes('classifier'), 'launch without classifier safeguards is held', String(held));
const ok = deployGate(s, v, d.channel, { safeguards: 'classifiers' });
check(ok === true || !String(ok).includes('Safety framework'), 'launch with classifier safeguards is not held by the framework', String(ok));
d.safeguards = 'standard';
refreshFramework(s, ctx);
check(!!d.held && productUsageMult(d) === 0 && fw.holds.some((h) => h.depId === d.id && h.ruleId === 'cyber-high'), 'live product without the safeguard is held and serves nobody', d.held ?? 'not held');
action('product.update')!.apply(s, ctx, { id: d.id, safeguards: 'classifiers' });
refreshFramework(s, ctx);
check(!d.held && productUsageMult(d) > 0 && !fw.holds.some((h) => h.depId === d.id), 'adding classifier safeguards releases it', `usage ×${productUsageMult(d).toFixed(2)}`);

// 3. override
d.safeguards = 'standard';
refreshFramework(s, ctx);
const pv = action('safety.frameworkOverride')!.preview(s, { ruleId: 'cyber-high', versionId: v.id });
const pvText = JSON.stringify(pv.costs);
check(pvText.includes('morale') && pvText.includes('scrutiny') && pvText.includes('red flag') && JSON.stringify(pv.gains).includes(`product ${d.id}`),
  'override preview states staff, government (and reputation) consequences and what it releases', pv.costs.map((c) => `${c.currency} ${c.amount}`).join(', '));
const before = { morale: s.player.morale.safety, scrutiny: s.relations.scrutiny, flags: ws4r(s).redFlags, cred: s.relations.credibility };
action('safety.frameworkOverride')!.apply(s, ctx, { ruleId: 'cyber-high', versionId: v.id });
const o = fw.overrides.find((x) => x.ruleId === 'cyber-high' && x.versionId === v.id);
check(!d.held && productUsageMult(d) > 0 && !!o && o.consequences.length === 3, 'override releases the hold and records the stated consequences', o?.consequences.join(' | ') ?? 'none');
check(s.player.morale.safety < before.morale && s.relations.scrutiny > before.scrutiny && ws4r(s).redFlags === before.flags + 1,
  'override consequences applied: safety morale down, scrutiny up, one red flag',
  `morale ${before.morale.toFixed(1)} → ${s.player.morale.safety.toFixed(1)}, scrutiny ${before.scrutiny.toFixed(1)} → ${s.relations.scrutiny.toFixed(1)}, cred ${before.cred.toFixed(1)} → ${s.relations.credibility.toFixed(1)}`);
check(deployGate(s, v, d.channel, { safeguards: 'standard' }) === true || !String(deployGate(s, v, d.channel, { safeguards: 'standard' })).includes('Safety framework'), 'after the override a launch of that version is not held by that rule');

// 4. training hold
const t = load();
const tc = makeCtx(t);
for (const dep of t.player.deployments) if (dep.channel === 'internal') dep.guards = dep.guards.filter((g) => g.kind !== 'control');
for (const x of t.player.models.versions) if (x.evals.suiteDay !== undefined) for (const dom of ['BIO', 'CYBER', 'RSCH'] as const) setMeasured(x, dom, 6);
const top = t.player.models.versions.find((x) => x.evals.suiteDay !== undefined && x.status !== 'retired' && x.status !== 'rolledBack')!;
for (const x of t.player.models.versions) for (const tr of ['SCHEME', 'AF', 'SAND'] as const) if (x.beliefs[tr]) x.beliefs[tr].est = Math.min(x.beliefs[tr].est, 0.1);
refreshFramework(t, tc);
const free = !trainingHeld(t);
setMeasured(top, 'RSCH', 12.5);
const running = t.player.models.runs.filter((r) => r.status === 'running' && (r.kind === 'base' || r.kind === 'post')).length;
refreshFramework(t, tc);
const pausedNow = t.player.models.runs.filter((r) => r.status === 'paused' && (r.kind === 'base' || r.kind === 'post')).length;
check(free && trainingHeld(t) && frontierPaused(t) && pausedNow >= running, 'AI R&D: Critical without control holds frontier training (runs paused)', `${running} running → ${pausedNow} paused; ${JSON.stringify(frameworkOf(t).holds.map((h) => h.missing))}`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
